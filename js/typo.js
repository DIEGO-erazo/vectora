/* Vectora — tipografía: párrafo (alineación, justificar, sangrías, espacios), texto enlazado
   entre cuadros, funciones OpenType, fuentes instaladas, glifos, buscar y reemplazar,
   revisión ortográfica y estilos de párrafo y de carácter */
'use strict';

/* ---------- ajustes de párrafo (data-para; la alineación simple sigue en text-anchor) ---------- */
const PARA_DEF = { align: 'left', li: 0, ri: 0, fi: 0, sb: 0, sa: 0 };
const Para = {
  get(el) {
    let p = {}; try { p = JSON.parse(el.getAttribute('data-para') || '{}'); } catch (e) { /* valor dañado */ }
    if (!/^justify/.test(p.align)) { const an = el.getAttribute('text-anchor'); p.align = an === 'middle' ? 'center' : an === 'end' ? 'right' : 'left'; }
    return { ...PARA_DEF, ...p };
  },
  set(el, p) {
    const o = {}; for (const k of ['li', 'ri', 'fi', 'sb', 'sa']) if (+p[k]) o[k] = +p[k];
    if (/^justify/.test(p.align)) o.align = p.align;
    Object.keys(o).length ? el.setAttribute('data-para', JSON.stringify(o)) : el.removeAttribute('data-para');
    const an = p.align === 'center' ? 'middle' : p.align === 'right' ? 'end' : null;
    an ? el.setAttribute('text-anchor', an) : el.removeAttribute('text-anchor');
  },
};

/* ---------- texto enlazado: el primer cuadro guarda toda la historia (data-text) ---------- */
const Thread = {
  next(el) { const n = el && document.getElementById(el.getAttribute('data-next') || ''); return n && n.getAttribute('data-prev') === el.id ? n : null; },
  prev(el) { const p = el && document.getElementById(el.getAttribute('data-prev') || ''); return p && p.getAttribute('data-next') === el.id ? p : null; },
  head(el) { const seen = new Set(); while (this.prev(el) && !seen.has(el)) { seen.add(el); el = this.prev(el); } return el; },
  chain(el) { const out = []; el = this.head(el); while (el && !out.includes(el)) { out.push(el); el = this.next(el); } return out; },
  relayout(el) { const h = this.head(el); TextLayout.layoutArea(h, h.getAttribute('data-text') ?? TextLayout.getText(h)); },
  link(from, to) {
    if (from === to || this.chain(from).includes(to)) return;
    const story = this.head(from).getAttribute('data-text') || '', extra = (to.getAttribute('data-text') ?? TextLayout.getText(to)).trim();
    const after = this.next(from);
    from.setAttribute('data-next', to.id); to.setAttribute('data-prev', from.id);
    if (after) { to.setAttribute('data-next', after.id); after.setAttribute('data-prev', to.id); } else to.removeAttribute('data-next');
    for (const k of ['font-family', 'font-size', 'font-weight', 'font-style', 'fill', 'letter-spacing', 'data-leading', 'data-para', 'text-anchor', 'style'])
      from.hasAttribute(k) ? to.setAttribute(k, from.getAttribute(k)) : to.removeAttribute(k);
    TextLayout.layoutArea(this.head(from), extra ? story + '\n' + extra : story);
  },
  /* crea un cuadro igual al de origen en el punto p (documento) y lo enlaza */
  linkNew(from, p) {
    const a = TextLayout.area(from), t = svgEl('text', { x: p.x, y: p.y }); t.id = uid();
    t.setAttribute('data-area', [p.x, p.y, a.width, a.height].map(v => round(v, 2)).join(' '));
    from.parentNode.appendChild(t); this.link(from, t); return t;
  },
  /* quitar enlace: cada cuadro se queda con el texto que muestra */
  unthread(els) {
    for (const el of new Set(els.flatMap(e => (TextLayout.area(e) ? this.chain(e) : [])))) {
      const txt = [...el.querySelectorAll('tspan')].map(t => t.textContent).join(' ').replace(/ {2,}/g, ' ').trim();
      el.removeAttribute('data-next'); el.removeAttribute('data-prev'); el.removeAttribute('data-overflow'); TextLayout.layoutArea(el, txt);
    }
  },
  /* liberar: el cuadro sale de la cadena (vacío) y el texto fluye por los demás */
  release(el) {
    const p = this.prev(el), n = this.next(el), h = this.head(el), story = h.getAttribute('data-text') || '';
    if (p && n) { p.setAttribute('data-next', n.id); n.setAttribute('data-prev', p.id); } else if (p) p.removeAttribute('data-next'); else if (n) { n.removeAttribute('data-prev'); }
    el.removeAttribute('data-next'); el.removeAttribute('data-prev');
    if (h === el) { if (n) TextLayout.layoutArea(n, story); TextLayout.layoutArea(el, ''); } else { TextLayout.layoutArea(el, ''); this.relayout(h); }
  },
  /* puerto de salida en pantalla (esquina inferior derecha del área) */
  port(el) {
    const a = TextLayout.area(el), m = el.getCTM(); if (!a || !m) return null;
    const q = Geo.pt(m, a.x + a.width, a.y + a.height); return { x: q.x - 6, y: q.y + 10 };
  },
  portIn(el) { const a = TextLayout.area(el), m = el.getCTM(); if (!a || !m) return null; const q = Geo.pt(m, a.x, a.y); return { x: q.x + 6, y: q.y - 10 }; },
};

/* ---------- maquetación del texto de área (reemplaza la básica) ---------- */
Object.assign(TextLayout, {
  measure(el) {
    const ctx = this.measurer, size = +el.getAttribute('font-size') || 16;
    ctx.font = `${el.getAttribute('font-style') || 'normal'} ${el.getAttribute('font-weight') || 'normal'} ${size}px "${el.getAttribute('font-family') || 'Arial'}"`;
    const ls = parseFloat(el.getAttribute('letter-spacing') || 0) * ((el.getAttribute('letter-spacing') || '').endsWith('em') ? size : 1);
    return s => ctx.measureText(s).width + ls * s.length;
  },
  /* líneas de un párrafo: la primera puede tener otra anchura (sangría de primera línea) */
  wrapPara(w, para, first, rest) {
    const lines = []; let line = '', width = first;
    const push = l => { lines.push(l); width = rest; };
    for (const word of para.split(/ +/)) {
      const test = line ? line + ' ' + word : word;
      if (w(test) <= width) { line = test; continue; }
      if (line) { push(line); line = ''; }
      if (w(word) <= width) { line = word; continue; }
      let part = ''; for (const ch of word) { if (w(part + ch) > width && part) { push(part); part = ''; } part += ch; }
      line = part;
    }
    lines.push(line);
    return lines;
  },
  layoutArea(el, txt) {
    const a = this.area(el); if (!a) return;
    const size = +el.getAttribute('font-size') || 16, P = Para.get(el), w = this.measure(el);
    const lead = size * (+el.getAttribute('data-leading') || 120) / 100;
    const x0 = a.x + P.li, x1 = a.x + a.width - P.ri, bottom = a.y + a.height;
    el.setAttribute('data-text', txt); el.textContent = '';
    const paras = txt.split('\n'); let y = a.y + size * 0.9, first = true, overflow = null;
    outer: for (let pi = 0; pi < paras.length; pi++) {
      if (pi) y += P.sb;
      const lines = this.wrapPara(w, paras[pi], Math.max(1, x1 - x0 - P.fi), Math.max(1, x1 - x0));
      for (let i = 0; i < lines.length; i++) {
        if (!first) y += lead;
        if (!first && y + size * 0.25 > bottom) { overflow = [lines.slice(i).join(' '), ...paras.slice(pi + 1)].join('\n'); break outer; }
        first = false;
        const L = x0 + (i === 0 ? P.fi : 0);
        const x = P.align === 'center' ? (L + x1) / 2 : P.align === 'right' ? x1 : L;
        const t = svgEl('tspan', { x: round(x, 2), y: round(y, 2) }, el); t.textContent = lines[i] || ' ';
        const gaps = (lines[i].match(/ /g) || []).length;
        if (gaps && ((P.align === 'justify' && i < lines.length - 1) || P.align === 'justify-all')) {
          const ws = (x1 - L - w(lines[i])) / gaps; if (ws > 0) t.setAttribute('word-spacing', round(ws, 3));
        }
      }
      y += P.sa;
    }
    const f = el.querySelector('tspan'); if (f) { el.setAttribute('x', f.getAttribute('x')); el.setAttribute('y', f.getAttribute('y')); }
    el.toggleAttribute('data-overflow', overflow != null && !!overflow.trim());
    const n = Thread.next(el);
    if (n) this.layoutArea(n, overflow || '');
    if (Thread.prev(el)) el.removeAttribute('data-text');
  },
  relayout(els) { for (const h of new Set(els.filter(e => this.area(e)).map(e => Thread.head(e)))) Thread.relayout(h); },
  getText(el) {
    if (el.hasAttribute('data-text')) return el.getAttribute('data-text');
    const tp = el.querySelector('textPath'); if (tp) return tp.textContent;
    const ts = [...el.querySelectorAll(':scope > tspan')]; return ts.length ? ts.map(t => t.textContent).join('\n') : el.textContent;
  },
  /* cambia el texto de un objeto respetando su tipo (punto, área o trazado) */
  setText(el, txt) {
    if (this.area(el)) return this.layoutArea(Thread.head(el), txt);
    const tp = el.querySelector('textPath'); if (tp) { tp.textContent = txt.replace(/\n+/g, ' '); return; }
    const x = el.getAttribute('x') || 0, lead = round((+el.getAttribute('data-leading') || 120) / 100, 3) + 'em';
    el.textContent = ''; txt.split('\n').forEach((line, i) => { const t = svgEl('tspan', { x, dy: i ? lead : null }, el); t.textContent = line || ' '; });
  },
});
/* las cajas enlazadas se editan desde el primer cuadro */
(() => {
  const baseEdit = TextTool.edit;
  TextTool.edit = function (el, ...rest) { if (el && TextLayout.area(el)) el = Thread.head(el); return baseEdit.call(this, el, ...rest); };
  /* escalar un texto de área cambia el tamaño del cuadro, no el de la letra */
  const baseNT = normalizeTransform;
  normalizeTransform = function (el) {
    if (el.tagName !== 'text' || !el.hasAttribute('data-area') || el.querySelector('textPath')) return baseNT(el);
    const m = Geo.local(el); if (m.isIdentity) { el.removeAttribute('transform'); return; }
    if (m.b !== 0 || m.c !== 0) return;
    const a = TextLayout.area(el); let x = m.a * a.x + m.e, y = m.d * a.y + m.f, w = a.width * m.a, h = a.height * m.d;
    if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
    el.setAttribute('data-area', [x, y, Math.max(4, w), Math.max(4, h)].map(v => round(v, 2)).join(' ')); el.removeAttribute('transform');
    Thread.relayout(el);
  };
})();

/* menú Texto ▸ Texto enlazado */
const TextThreadCmd = {
  create() {
    const sel = docOrder(App.selection), src = sel.find(e => e.tagName === 'text' && TextLayout.area(e));
    if (!src || sel.length < 2) return Dialog.alert('Selecciona un texto de área y uno o más textos de área o formas donde continuar.');
    let from = Thread.chain(src).pop();
    for (const o of sel) {
      if (o === src || Thread.chain(src).includes(o)) continue;
      if (o.tagName === 'text' && TextLayout.area(o)) { Thread.link(from, o); from = o; continue; }
      if (!isShape(o)) continue;
      const b = Geo.bbox(o), t = Thread.linkNew(from, { x: b.x, y: b.y });
      t.setAttribute('data-area', [b.x, b.y, b.width, b.height].map(v => round(v, 2)).join(' ')); o.remove(); from = t;
    }
    Thread.relayout(src); History.named('Enlazar texto', () => History.commit()); Selection.set([src]); App.emit('layers');
  },
  areas() { return App.selection.filter(e => e.tagName === 'text' && TextLayout.area(e)); },
  release() { const a = this.areas(); if (!a.length) return; a.forEach(e => Thread.release(e)); History.named('Liberar texto enlazado', () => History.commit()); Selection.draw(); },
  remove() { const a = this.areas(); if (!a.length) return; Thread.unthread(a); History.named('Quitar enlace', () => History.commit()); Selection.draw(); },
};

/* puertos de enlace en la herramienta Selección */
(() => {
  const sel = App.tools.select, base = { down: sel.down, overlay: sel.overlay };
  Object.assign(sel, {
    down(p, ev, sp) {
      const from = App.threadFrom;
      if (from) {
        App.threadFrom = null; $('sbHint').textContent = '';
        let o = hitObject(ev); if (o && o.tagName === 'tspan') o = o.closest('text');
        if (o && o.tagName === 'text' && TextLayout.area(o) && o !== from) Thread.link(from, o);
        else if (o && ['rect', 'path', 'ellipse', 'polygon'].includes(o.tagName) && o !== from) {
          const b = Geo.bbox(o), t = Thread.linkNew(from, { x: b.x, y: b.y });
          t.setAttribute('data-area', [b.x, b.y, b.width, b.height].map(v => round(v, 2)).join(' ')); o.remove(); Thread.relayout(from);
        } else Thread.linkNew(from, snapPt(p, ev));
        History.named('Enlazar texto', () => History.commit()); Selection.set([from]); App.emit('layers'); return;
      }
      for (const el of App.selection) if (el.tagName === 'text' && TextLayout.area(el)) {
        const q = Thread.port(el); if (q && Geo.dist(q, sp) < 8) { App.threadFrom = el; $('sbHint').textContent = 'Haz clic en el lienzo para crear un cuadro enlazado, o sobre un texto de área o una forma'; return; }
      }
      return base.down.call(this, p, ev, sp);
    },
    overlay(g) {
      base.overlay.call(this, g);
      for (const el of App.selection) {
        if (el.tagName !== 'text' || !TextLayout.area(el)) continue;
        for (const box of Thread.chain(el)) {
          const q = Thread.port(box), n = Thread.next(box), a = TextLayout.area(box), m = box.getCTM(); if (!q || !m) continue;
          const c = [[a.x, a.y], [a.x + a.width, a.y], [a.x + a.width, a.y + a.height], [a.x, a.y + a.height]].map(([x, y]) => Geo.pt(m, x, y));
          svgEl('polygon', { points: c.map(p => `${p.x},${p.y}`).join(' '), fill: 'none', stroke: '#1e90ff', 'stroke-width': 1, 'stroke-dasharray': box === el ? null : '3 2' }, g);
          const over = !n && box.hasAttribute('data-overflow');
          svgEl('rect', { x: q.x - 4.5, y: q.y - 4.5, width: 9, height: 9, fill: '#fff', stroke: over ? '#e00' : '#1e90ff', 'stroke-width': 1.2 }, g);
          if (over) svgEl('path', { d: `M${q.x - 2.5} ${q.y}H${q.x + 2.5}M${q.x} ${q.y - 2.5}V${q.y + 2.5}`, stroke: '#e00', 'stroke-width': 1.4 }, g);
          if (n) { const r = Thread.portIn(n); if (r) { svgEl('path', { d: `M${q.x - 2} ${q.y - 2.5}L${q.x + 2} ${q.y}L${q.x - 2} ${q.y + 2.5}Z`, fill: '#1e90ff' }, g);
            svgEl('line', { x1: q.x, y1: q.y, x2: r.x, y2: r.y, stroke: '#1e90ff', 'stroke-width': 1 }, g);
            svgEl('rect', { x: r.x - 4.5, y: r.y - 4.5, width: 9, height: 9, fill: '#fff', stroke: '#1e90ff', 'stroke-width': 1.2 }, g); } }
        }
      }
    },
  });
  const baseHover = sel.hover;
  sel.hover = function (p, ev, sp) {
    if (App.threadFrom) { App.els.stage.style.cursor = 'copy'; return; }
    for (const el of App.selection) if (el.tagName === 'text' && TextLayout.area(el)) { const q = Thread.port(el); if (q && Geo.dist(q, sp) < 8) { App.els.stage.style.cursor = 'pointer'; return; } }
    return baseHover ? baseHover.call(this, p, ev, sp) : undefined;
  };
})();

/* ---------- panel Párrafo ---------- */
const PARA_ICONS = {
  left: 'M3 5h18M3 9h12M3 13h18M3 17h10', center: 'M3 5h18M6 9h12M3 13h18M7 17h10', right: 'M3 5h18M9 9h12M3 13h18M11 17h10',
  justify: 'M3 5h18M3 9h18M3 13h18M3 17h10', 'justify-all': 'M3 5h18M3 9h18M3 13h18M3 17h18',
};
const ParaPanel = {
  texts() { return App.selection.flatMap(e => (e.tagName === 'text' ? [e] : [...e.querySelectorAll('text')])); },
  init() {
    const body = $('pPara').querySelector('.panel-body');
    body.innerHTML = `<div class="para-align">${Object.entries(PARA_ICONS).map(([k, d]) => `<button data-al="${k}" title="${{ left: 'Alinear a la izquierda', center: 'Centrar', right: 'Alinear a la derecha', justify: 'Justificar con la última línea alineada a la izquierda', 'justify-all': 'Justificar todas las líneas' }[k]}"><svg viewBox="0 0 24 24"><path d="${d}"/></svg></button>`).join('')}</div>
      <div class="grid2">
        <label>Sangría izquierda</label><input type="number" id="paLi" step="1">
        <label>Sangría derecha</label><input type="number" id="paRi" step="1">
        <label>Sangría 1.ª línea</label><input type="number" id="paFi" step="1">
        <label>Espacio antes</label><input type="number" id="paSb" step="1" min="0">
        <label>Espacio después</label><input type="number" id="paSa" step="1" min="0">
      </div><p class="empty-note">Justificar, sangrías y espacios se aplican al texto de área.</p>`;
    const apply = ch => {
      const ts = this.texts(); if (!ts.length) return;
      for (const t of new Set(ts.flatMap(t => (TextLayout.area(t) ? Thread.chain(t) : [t])))) Para.set(t, { ...Para.get(t), ...ch });
      TextLayout.relayout(ts); History.named('Párrafo', () => History.commit()); Selection.draw(); this.pull();
    };
    body.querySelectorAll('[data-al]').forEach(b => b.onclick = () => { apply({ align: b.dataset.al }); App.textOpts.anchor = b.dataset.al === 'center' ? 'middle' : b.dataset.al === 'right' ? 'end' : 'start'; });
    for (const [id, k] of [['paLi', 'li'], ['paRi', 'ri'], ['paFi', 'fi'], ['paSb', 'sb'], ['paSa', 'sa']]) $(id).onchange = e => apply({ [k]: +e.target.value || 0 });
    App.on('selection', () => this.pull()); App.on('change', () => this.pull());
    this.pull();
  },
  pull() {
    const t = this.texts()[0], P = t ? Para.get(t) : { ...PARA_DEF, align: App.textOpts.anchor === 'middle' ? 'center' : App.textOpts.anchor === 'end' ? 'right' : 'left' };
    $('pPara').querySelectorAll('[data-al]').forEach(b => b.classList.toggle('on', b.dataset.al === P.align));
    for (const [id, k] of [['paLi', 'li'], ['paRi', 'ri'], ['paFi', 'fi'], ['paSb', 'sb'], ['paSa', 'sa']]) if (document.activeElement !== $(id)) $(id).value = P[k];
  },
};

/* ---------- Carácter: OpenType, subrayado/tachado y fuentes instaladas ---------- */
const OT_FEATURES = [
  ['liga', 'fi', 'Ligaduras estándar', true], ['dlig', 'st', 'Ligaduras discrecionales'], ['swsh', 'Ꭿ', 'Caracteres decorativos'],
  ['smcp', 'Tᴛ', 'Versalitas'], ['frac', '½', 'Fracciones'], ['ordn', 'aº', 'Ordinales'], ['sups', 'x²', 'Superíndice'],
  ['subs', 'x₂', 'Subíndice'], ['tnum', '0|0', 'Números tabulares'], ['onum', '123', 'Números de estilo antiguo'],
];
const Fonts = {
  init() {
    try { for (const f of JSON.parse(localStorage.getItem('vectora-fonts') || '[]')) if (!FONTS.includes(f)) FONTS.push(f); } catch (e) { /* sin almacenamiento */ }
  },
  options(sel) { return FONTS.map(f => `<option style="font-family:'${f.replace(/'/g, '')}'" ${f === sel ? 'selected' : ''}>${f.replace(/</g, '&lt;')}</option>`).join(''); },
  async load() {
    if (!('queryLocalFonts' in window)) return Dialog.alert('Este navegador no permite leer las fuentes instaladas. Usa Chrome, Edge o el programa de escritorio.');
    let list; try { list = await window.queryLocalFonts(); } catch (e) { return Dialog.alert('No se concedió permiso para leer las fuentes instaladas.'); }
    const fams = [...new Set(list.map(f => f.family))].sort((a, b) => a.localeCompare(b));
    for (const f of fams) if (!FONTS.includes(f)) FONTS.push(f);
    try { localStorage.setItem('vectora-fonts', JSON.stringify(fams)); } catch (e) { /* sin almacenamiento */ }
    $('pcFont').innerHTML = this.options($('pcFont').value); CharPanel.pull(); Tools.use(App.toolName);
    $('sbHint').textContent = `${fams.length} familias de fuentes disponibles`;
  },
};
const CharExtra = {
  feats(el) { const s = (el && el.style.fontFeatureSettings) || ''; const o = {}; for (const m of s.matchAll(/"(\w{4})"\s*(\d+|on|off)?/g)) o[m[1]] = !(m[2] === '0' || m[2] === 'off'); return o; },
  setFeat(el, k, on) {
    const o = this.feats(el); const def = OT_FEATURES.find(f => f[0] === k)[3] || false;
    if (on === def) delete o[k]; else o[k] = on;
    const s = Object.entries(o).map(([f, v]) => `"${f}" ${v ? 1 : 0}`).join(', ');
    el.style.fontFeatureSettings = s; if (!el.getAttribute('style')) el.removeAttribute('style');
  },
  init() {
    Fonts.init();
    $('pcFont').innerHTML = Fonts.options(App.textOpts.family);
    const body = $('pChar').querySelector('.panel-body');
    body.insertAdjacentHTML('beforeend', `<label>Decoración</label><div class="ot-row"><button data-dec="underline" title="Subrayado"><u>S</u></button><button data-dec="line-through" title="Tachado"><s>T</s></button></div>
      <label>OpenType</label><div class="ot-row">${OT_FEATURES.map(([k, l, t]) => `<button data-ot="${k}" title="${t}">${l}</button>`).join('')}</div>
      <label></label><button class="text-btn" id="pcLoadFonts" title="Añadir al menú las fuentes instaladas en el equipo">Cargar fuentes del sistema…</button>`);
    const texts = () => ParaPanel.texts();
    body.querySelectorAll('[data-ot]').forEach(b => b.onclick = () => {
      const ts = texts(); if (!ts.length) return; const k = b.dataset.ot, on = !b.classList.contains('on');
      ts.forEach(t => this.setFeat(t, k, on)); TextLayout.relayout(ts); History.named('OpenType', () => History.commit()); Selection.draw(); this.pull();
    });
    body.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => {
      const ts = texts(); if (!ts.length) return; const k = b.dataset.dec, cur = (ts[0].getAttribute('text-decoration') || '').split(/\s+/).filter(Boolean);
      const next = cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k];
      ts.forEach(t => (next.length ? t.setAttribute('text-decoration', next.join(' ')) : t.removeAttribute('text-decoration')));
      History.named('Decoración de texto', () => History.commit()); Selection.draw(); this.pull();
    });
    $('pcLoadFonts').onclick = () => Fonts.load();
    const basePull = CharPanel.pull.bind(CharPanel);
    CharPanel.pull = () => { basePull(); this.pull(); };
    this.pull();
  },
  pull() {
    const t = ParaPanel.texts()[0], f = this.feats(t), dec = ((t && t.getAttribute('text-decoration')) || '').split(/\s+/);
    $('pChar').querySelectorAll('[data-ot]').forEach(b => { const def = OT_FEATURES.find(x => x[0] === b.dataset.ot)[3] || false; b.classList.toggle('on', b.dataset.ot in f ? f[b.dataset.ot] : def); });
    $('pChar').querySelectorAll('[data-dec]').forEach(b => b.classList.toggle('on', dec.includes(b.dataset.dec)));
  },
};

/* ---------- panel Glifos ---------- */
const GLYPH_SETS = [
  ['Latín básico', 0x21, 0x7e], ['Latín-1', 0xa1, 0xff], ['Latín extendido', 0x100, 0x17f], ['Griego', 0x391, 0x3c9], ['Cirílico', 0x410, 0x44f],
  ['Puntuación', 0x2010, 0x205e], ['Monedas', 0x20a0, 0x20bf], ['Letras y números', 0x2100, 0x218b], ['Flechas', 0x2190, 0x21ff],
  ['Matemáticas', 0x2200, 0x22ff], ['Técnicos', 0x2300, 0x23ff], ['Formas geométricas', 0x25a0, 0x25ff], ['Símbolos varios', 0x2600, 0x26ff], ['Dingbats', 0x2700, 0x27bf],
];
const Glyphs = {
  recent: [],
  init() {
    const body = $('pGlyphs').querySelector('.panel-body');
    body.innerHTML = `<div class="gl-top"><select id="glSet">${GLYPH_SETS.map((s, i) => `<option value="${i}">${s[0]}</option>`).join('')}</select><select id="glFont"></select></div>
      <div id="glRecent" class="gl-grid gl-recent"></div><div id="glGrid" class="gl-grid"></div>`;
    $('glSet').onchange = () => this.render(); $('glFont').onchange = () => this.render();
    App.on('dock', t => { if (t === 'pGlyphs') this.render(); });
    App.on('selection', () => { if (!$('pGlyphs').hidden) this.render(); });
  },
  font() { const t = ParaPanel.texts()[0]; return (t && t.getAttribute('font-family')) || App.textOpts.family; },
  render() {
    if ($('pGlyphs').hidden) return;
    const sel = $('glFont'), want = this.font();
    if (sel.options.length !== FONTS.length || sel.dataset.auto !== want) { sel.innerHTML = Fonts.options(want); sel.dataset.auto = want; }
    const fam = sel.value, [, a, b] = GLYPH_SETS[+$('glSet').value || 0], g = $('glGrid'); g.innerHTML = ''; g.style.fontFamily = `'${fam}'`;
    const cell = (ch, box) => { const c = document.createElement('button'); c.className = 'gl'; c.textContent = ch; c.title = `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`; c.onclick = () => this.insert(ch); box.appendChild(c); };
    for (let u = a; u <= b; u++) if (u !== 0xad) cell(String.fromCodePoint(u), g);
    const r = $('glRecent'); r.innerHTML = ''; r.style.fontFamily = `'${fam}'`; this.recent.forEach(ch => cell(ch, r));
  },
  insert(ch) {
    this.recent = [ch, ...this.recent.filter(c => c !== ch)].slice(0, 12); this.render();
    const ta = $('textEditor');
    if (!TextTool.editing) {
      const t = ParaPanel.texts()[0];
      if (!t) { navigator.clipboard && navigator.clipboard.writeText(ch).catch(() => {}); $('sbHint').textContent = `«${ch}» copiado: haz clic en un texto para insertarlo`; return; }
      Tools.use('text'); TextTool.edit(t); ta.setSelectionRange(ta.value.length, ta.value.length);
    }
    ta.focus(); ta.setRangeText(ch, ta.selectionStart, ta.selectionEnd, 'end'); TextTool.styleEditor();
  },
};

/* ---------- Buscar y reemplazar · ortografía ---------- */
const FindReplace = {
  last: { f: '', r: '', cs: false, ww: false },
  regex(v) { const s = v.f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); return new RegExp(v.ww ? `\\b${s}\\b` : s, v.cs ? 'g' : 'gi'); },
  stories() { return [...App.els.content.querySelectorAll('text')].filter(t => !Layers.isLocked(t) && !(TextLayout.area(t) && Thread.prev(t))); },
  async dialog() {
    const v = await Dialog.form('Buscar y reemplazar', [
      { id: 'f', label: 'Buscar', value: this.last.f }, { id: 'r', label: 'Reemplazar por', value: this.last.r },
      { id: 'cs', label: 'Coincidir mayúsculas', type: 'checkbox', value: this.last.cs }, { id: 'ww', label: 'Palabras completas', type: 'checkbox', value: this.last.ww },
    ], { ok: 'Reemplazar todo', buttons: [['Buscar', 'find']] });
    if (!v || !v.f) return; this.last = v;
    const re = this.regex(v), hits = this.stories().filter(t => { re.lastIndex = 0; return re.test(TextLayout.getText(t)); });
    if (v._button === 'find') { Selection.set(hits); $('sbHint').textContent = hits.length ? `${hits.length} objeto(s) de texto contienen «${v.f}»` : `No se encontró «${v.f}»`; return; }
    let n = 0;
    for (const t of hits) { const txt = TextLayout.getText(t); const out = txt.replace(re, () => { n++; return v.r; }); TextLayout.setText(t, out); t.setAttribute('data-name', out.split('\n')[0].slice(0, 30)); }
    if (n) { History.named('Reemplazar', () => History.commit()); Selection.set(hits); App.emit('layers'); }
    Dialog.alert(n ? `Se reemplazaron ${n} coincidencias en ${hits.length} objeto(s).` : `No se encontró «${v.f}».`);
  },
  spell: (() => { try { return localStorage.getItem('vectora-spell') !== '0'; } catch (e) { return true; } })(),
  toggleSpell() { this.spell = !this.spell; try { localStorage.setItem('vectora-spell', this.spell ? '1' : '0'); } catch (e) { /* sin almacenamiento */ } this.applySpell(); },
  applySpell() { const ta = $('textEditor'); ta.spellcheck = this.spell; ta.lang = (navigator.language || 'es').slice(0, 2); },
};

/* ---------- estilos de párrafo y de carácter ---------- */
const CHAR_ATTRS = ['font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'fill', 'text-decoration', 'data-leading'];
const TextStyles = {
  mode: 'para',
  key() { return this.mode === 'para' ? 'paraStyles' : 'charStyles'; },
  list() { return App.doc[this.key()] || (App.doc[this.key()] = []); },
  normal() { return { id: 'normal', name: this.mode === 'para' ? '[Párrafo normal]' : '[Carácter normal]', a: { 'font-family': 'Arial', 'font-size': '24', 'font-weight': 'normal', 'font-style': 'normal', fill: '#000000' }, para: this.mode === 'para' ? {} : undefined }; },
  capture(t, name) {
    const st = { id: uid('ts'), name, a: {} };
    for (const k of CHAR_ATTRS) if (t.hasAttribute(k)) st.a[k] = t.getAttribute(k);
    if (t.style.fontFeatureSettings) st.ff = t.style.fontFeatureSettings;
    if (this.mode === 'para') st.para = Para.get(t);
    return st;
  },
  apply(st) {
    const ts = ParaPanel.texts(); if (!ts.length) return;
    const all = new Set(ts.flatMap(t => (TextLayout.area(t) ? Thread.chain(t) : [t])));
    for (const t of all) {
      for (const k of CHAR_ATTRS) if (!(k in st.a) && k !== 'fill' && k !== 'font-family' && k !== 'font-size') t.removeAttribute(k);
      for (const [k, v] of Object.entries(st.a)) t.setAttribute(k, v);
      t.style.fontFeatureSettings = st.ff || ''; if (!t.getAttribute('style')) t.removeAttribute('style');
      if (st.para) Para.set(t, { ...PARA_DEF, ...st.para });
      t.setAttribute(this.mode === 'para' ? 'data-pstyle' : 'data-cstyle', st.id);
      if (!TextLayout.area(t)) { const lead = round((+t.getAttribute('data-leading') || 120) / 100, 3) + 'em'; [...t.querySelectorAll(':scope > tspan')].forEach((s, i) => i && s.setAttribute('dy', lead)); }
    }
    TextLayout.relayout([...all]); History.named('Aplicar estilo de ' + (this.mode === 'para' ? 'párrafo' : 'carácter'), () => History.commit()); Selection.changed();
  },
  async create() {
    const t = ParaPanel.texts()[0]; if (!t) return Dialog.alert('Selecciona un texto con el formato que quieres guardar.');
    const v = await Dialog.form(this.mode === 'para' ? 'Nuevo estilo de párrafo' : 'Nuevo estilo de carácter', [{ id: 'n', label: 'Nombre', value: `Estilo ${this.list().length + 1}` }]);
    if (!v || !v.n.trim()) return;
    const st = this.capture(t, v.n.trim()); this.list().push(st); t.setAttribute(this.mode === 'para' ? 'data-pstyle' : 'data-cstyle', st.id);
    History.named('Nuevo estilo de texto', () => History.commit()); this.render();
  },
  redefine() {
    const t = ParaPanel.texts()[0], id = t && t.getAttribute(this.mode === 'para' ? 'data-pstyle' : 'data-cstyle'), st = this.list().find(s => s.id === id);
    if (!st) return Dialog.alert('Selecciona un texto que use un estilo propio.');
    Object.assign(st, this.capture(t, st.name), { id: st.id });
    /* los demás textos con ese estilo se actualizan */
    const keep = App.selection; Selection.set([...App.els.content.querySelectorAll(`text[data-${this.mode === 'para' ? 'p' : 'c'}style="${st.id}"]`)]); this.apply(st); Selection.set(keep);
  },
  remove() {
    const t = ParaPanel.texts()[0], attr = this.mode === 'para' ? 'data-pstyle' : 'data-cstyle', id = (t && t.getAttribute(attr)) || this.cur;
    const i = this.list().findIndex(s => s.id === id); if (i < 0) return;
    this.list().splice(i, 1); App.els.content.querySelectorAll(`text[${attr}="${id}"]`).forEach(e => e.removeAttribute(attr));
    History.named('Eliminar estilo de texto', () => History.commit()); this.render();
  },
  render() {
    const box = $('tsList'); if (!box || $('pTextStyles').hidden) return;
    $('pTextStyles').querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === this.mode));
    const t = ParaPanel.texts()[0], cur = t && t.getAttribute(this.mode === 'para' ? 'data-pstyle' : 'data-cstyle');
    box.innerHTML = '';
    for (const st of [this.normal(), ...this.list()]) {
      const r = document.createElement('div'); r.className = 'ts-row' + (st.id === (cur || (t ? 'normal' : '')) ? ' on' : '');
      r.innerHTML = `<span style="font-family:'${(st.a['font-family'] || 'Arial').replace(/'/g, '')}';font-weight:${st.a['font-weight'] || 'normal'};font-style:${st.a['font-style'] || 'normal'}"></span><small>${st.a['font-size'] || ''} pt</small>`;
      r.firstChild.textContent = st.name;
      r.onclick = () => { this.cur = st.id; this.apply(st); };
      if (st.id !== 'normal') r.ondblclick = async () => { const v = await Dialog.form('Opciones de estilo', [{ id: 'n', label: 'Nombre', value: st.name }]); if (v && v.n.trim()) { st.name = v.n.trim(); History.commit(); this.render(); } };
      box.appendChild(r);
    }
  },
  init() {
    const p = $('pTextStyles');
    p.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { this.mode = b.dataset.mode; this.render(); });
    $('tsNew').onclick = () => this.create(); $('tsRedef').onclick = () => this.redefine(); $('tsDel').onclick = () => this.remove();
    for (const ev of ['selection', 'change']) App.on(ev, () => this.render());
    App.on('dock', t => { if (t === 'pTextStyles') this.render(); });
  },
};

const Typo = {
  init() { ParaPanel.init(); CharExtra.init(); Glyphs.init(); TextStyles.init(); FindReplace.applySpell(); },
};
