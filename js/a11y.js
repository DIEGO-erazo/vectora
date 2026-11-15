/* Vectora — accesibilidad: la barra de herramientas y los menús se pueden usar con el teclado
   y los lectores de pantalla saben qué es cada control (roles, nombres y estado). */
'use strict';

const A11y = {
  init() {
    this.toolbar(); this.menubar(); this.names(document.body);
    /* los paneles y diálogos se crean después: se nombran sus campos al aparecer */
    let t = null;
    new MutationObserver(list => {
      if (list.every(m => !m.addedNodes.length)) return;
      clearTimeout(t); t = setTimeout(() => this.names(document.body), 150);
    }).observe(document.body, { childList: true, subtree: true });
  },

  /* ---------- barra de herramientas ---------- */
  toolbar() {
    const box = $('tools'); if (!box) return;
    box.setAttribute('role', 'toolbar'); box.setAttribute('aria-orientation', 'vertical'); box.setAttribute('aria-label', Lang.t('Herramientas'));
    const sync = t => {
      t.setAttribute('role', 'button'); t.tabIndex = 0;
      t.setAttribute('aria-label', t.title); t.setAttribute('aria-pressed', String(t.classList.contains('active')));
      if (t.classList.contains('has-more')) t.setAttribute('aria-haspopup', 'menu');
    };
    const tools = () => [...box.querySelectorAll('.tool')];
    tools().forEach(sync);
    new MutationObserver(list => { for (const m of list) if (m.target.classList && m.target.classList.contains('tool')) sync(m.target); })
      .observe(box, { attributes: true, subtree: true, attributeFilter: ['class', 'title'] });
    box.addEventListener('keydown', e => {
      const t = e.target.closest('.tool'); if (!t) return;
      const all = tools(), i = all.indexOf(t);
      const go = j => { all[(j + all.length) % all.length].focus(); };
      if (e.key === 'Enter' || e.key === ' ') Tools.use(t.dataset.tool);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') go(i + 1);
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') go(i - 1);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(all.length - 1);
      else if ((e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) && t.classList.contains('has-more')) { Tools.flyout(t, t.dataset.group.split(',')); this.flyout(t); }
      else return;
      e.preventDefault(); e.stopPropagation(); /* que la tecla no se tome como atajo de herramienta */
    });
  },
  /* el desplegable de un grupo de herramientas, con flechas */
  flyout(owner) {
    const f = $('toolFlyout'); if (!f) return;
    f.setAttribute('role', 'menu');
    const rows = [...f.children]; rows.forEach(r => { r.setAttribute('role', 'menuitem'); r.tabIndex = -1; });
    if (rows[0]) rows[0].focus();
    f.addEventListener('keydown', e => {
      const i = rows.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') rows[(i + 1) % rows.length].focus();
      else if (e.key === 'ArrowUp') rows[(i - 1 + rows.length) % rows.length].focus();
      else if (e.key === 'Enter' || e.key === ' ') { rows[i] && rows[i].click(); owner.focus(); }
      else if (e.key === 'Escape') { f.remove(); owner.focus(); }
      else return;
      e.preventDefault(); e.stopPropagation();
    });
  },

  /* ---------- barra de menús ---------- */
  menubar() {
    const bar = $('menus'), pop = $('menuPopup'); if (!bar || !pop) return;
    bar.setAttribute('role', 'menubar'); pop.setAttribute('role', 'menu');
    const btns = () => [...bar.querySelectorAll('.menu-btn')];
    btns().forEach((b, i) => { b.setAttribute('role', 'menuitem'); b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-expanded', 'false'); b.tabIndex = i ? -1 : 0; });
    const items = () => [...pop.querySelectorAll('.menu-item')];
    const dress = () => {
      items().forEach(r => { r.setAttribute('role', 'menuitem'); r.tabIndex = -1; });
      pop.querySelectorAll('.menu-sep').forEach(s => s.setAttribute('role', 'separator'));
      btns().forEach(b => b.setAttribute('aria-expanded', String(b.classList.contains('open') && !pop.hidden)));
    };
    const open = (b, last) => { b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); dress(); const it = items(); if (it.length) it[last ? it.length - 1 : 0].focus(); };
    const current = () => bar.querySelector('.menu-btn.open');
    /* cada vez que se abre un menú, sus filas reciben rol y foco por teclado */
    new MutationObserver(dress).observe(pop, { childList: true, attributes: true, attributeFilter: ['hidden'] });

    bar.addEventListener('keydown', e => {
      const b = e.target.closest('.menu-btn'); if (!b) return;
      const all = btns(), i = all.indexOf(b), go = j => { const n = all[(j + all.length) % all.length]; all.forEach(x => x.tabIndex = x === n ? 0 : -1); n.focus(); return n; };
      if (e.key === 'ArrowRight') go(i + 1);
      else if (e.key === 'ArrowLeft') go(i - 1);
      else if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { if (!b.classList.contains('open')) open(b); else { dress(); const it = items(); it[0] && it[0].focus(); } }
      else if (e.key === 'ArrowUp') { if (!b.classList.contains('open')) open(b, true); }
      else if (e.key === 'Escape') Menus.close();
      else return;
      e.preventDefault(); e.stopPropagation();
    });
    pop.addEventListener('keydown', e => {
      const it = items(), i = it.indexOf(document.activeElement), b = current(), all = btns();
      const sibling = d => { if (!b) return; const n = all[(all.indexOf(b) + d + all.length) % all.length]; Menus.close(); all.forEach(x => x.tabIndex = x === n ? 0 : -1); n.focus(); open(n); };
      if (e.key === 'ArrowDown') it[(i + 1) % it.length].focus();
      else if (e.key === 'ArrowUp') it[(i - 1 + it.length) % it.length].focus();
      else if (e.key === 'Home') it[0].focus();
      else if (e.key === 'End') it[it.length - 1].focus();
      else if (e.key === 'ArrowRight') sibling(1);
      else if (e.key === 'ArrowLeft') sibling(-1);
      else if (e.key === 'Enter' || e.key === ' ') { if (it[i]) it[i].click(); }
      else if (e.key === 'Escape' || e.key === 'Tab') { Menus.close(); if (b) b.focus(); if (e.key === 'Tab') return; }
      else return;
      e.preventDefault(); e.stopPropagation();
    });
  },

  /* ---------- nombre accesible de los campos sin <label> ---------- */
  names(root) {
    for (const el of root.querySelectorAll('input, select, textarea')) {
      if (el.type === 'hidden' || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || (el.labels && el.labels.length)) continue;
      const name = this.guess(el);
      if (name) el.setAttribute('aria-label', name);
    }
  },
  /* campos que no tienen ningún texto al lado */
  NAMES: { pcPicker: 'Color', glSet: 'Conjunto de caracteres', glFont: 'Fuente', navZoom: 'Zoom', fileInput: 'Archivo' },
  guess(el) {
    if (this.NAMES[el.id]) return Lang.t(this.NAMES[el.id]);
    const clean = s => (s || '').replace(/\s+/g, ' ').replace(/[:：]\s*$/, '').trim();
    if (el.title) return clean(el.title);
    /* texto del elemento anterior (<label>Grosor</label><input>) o del que lo envuelve */
    for (let p = el.previousElementSibling, n = 0; p && n < 2; p = p.previousElementSibling, n++) {
      if (/^(LABEL|SPAN|DIV|B|STRONG|TD|TH)$/.test(p.tagName) && !p.querySelector('input,select,textarea,button')) { const t = clean(p.textContent); if (t && t.length <= 40) return t; }
    }
    const prev = el.previousSibling; if (prev && prev.nodeType === 3 && clean(prev.nodeValue)) return clean(prev.nodeValue).slice(0, 40);
    const row = el.closest('.dlg-row, .slider-row, .cb-item, .row, td, li, label');
    if (row) { const own = [...row.childNodes].filter(n => n.nodeType === 3 || (n.nodeType === 1 && /^(LABEL|SPAN|B)$/.test(n.tagName) && !n.contains(el))).map(n => n.textContent).join(' '); if (clean(own) && clean(own).length <= 40) return clean(own); }
    if (el.placeholder) return clean(el.placeholder);
    return '';
  },
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => A11y.init()); else A11y.init();
