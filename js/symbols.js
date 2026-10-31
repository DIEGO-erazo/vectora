/* Vectora — símbolos (instancias que se actualizan juntas) y motivos (rellenos de patrón) */
'use strict';

const XLINK = 'http://www.w3.org/1999/xlink';
const stripIds = el => { el.removeAttribute('id'); el.querySelectorAll('[id]').forEach(n => n.removeAttribute('id')); return el; };
const setHref = (el, id) => { el.setAttribute('href', '#' + id); el.setAttributeNS(XLINK, 'xlink:href', '#' + id); };
const hrefOf = el => (el.getAttribute('href') || el.getAttributeNS(XLINK, 'href') || '').replace(/^#/, '');

const Defs = {
  /* copia de unos objetos con su caja en el origen (para símbolos y motivos) */
  capture(els) {
    const box = Geo.selBox(els), g = svgEl('g');
    for (const e of docOrder(els)) {
      const c = stripIds(e.cloneNode(true)); g.appendChild(c);
      Geo.setMatrix(c, new DOMMatrix().translate(-box.x, -box.y).multiply(Geo.toDoc(e)));
    }
    App.els.content.appendChild(g); [...g.children].forEach(normalizeTransform); g.remove();
    return { g, box };
  },
};

/* ---------- edición en el lienzo de un símbolo o motivo (modo aislamiento) ---------- */
const DefEdit = {
  active: null,
  enter(def, placement, hide) {
    const layer = Layers.ensure(), tmp = svgEl('g', { id: uid(), 'data-defedit': def.id, 'data-name': def.getAttribute('data-name') || 'Edición' });
    layer.appendChild(tmp); Geo.setMatrix(tmp, Geo.toDoc(layer).inverse().multiply(placement));
    for (const c of def.children) { const k = c.cloneNode(true); k.id = uid(); tmp.appendChild(k); }
    if (hide) hide.setAttribute('display', 'none');
    this.active = { def, tmp, hide }; Isolation.enter(tmp);
    $('sbHint').textContent = `Editando «${def.getAttribute('data-name')}» · Esc para terminar`;
  },
  sync() {
    const a = this.active; if (!a) return;
    if (!a.tmp.isConnected || !a.def.isConnected) { this.active = null; return; }
    a.def.replaceChildren(...[...a.tmp.children].map(c => stripIds(c.cloneNode(true))));
  },
  finish() {
    const a = this.active; if (!a) return; this.sync(); this.active = null;
    if (a.tmp.isConnected) a.tmp.remove(); if (a.hide && a.hide.isConnected) a.hide.removeAttribute('display');
    $('sbHint').textContent = ''; History.named('Editar ' + (a.def.tagName === 'pattern' ? 'motivo' : 'símbolo'), () => History.commit()); App.emit('layers'); Symbols.render(); Patterns.render();
  },
};
App.on('change', () => { if (DefEdit.active) DefEdit.sync(); });
(() => {
  const exit = Isolation.exit.bind(Isolation);
  Isolation.exit = silent => { const editing = DefEdit.active && Isolation.el === DefEdit.active.tmp; exit(silent); if (editing) DefEdit.finish(); };
})();

/* ---------- símbolos ---------- */
const Symbols = {
  list() { return [...docDefs().querySelectorAll(':scope > g[data-symbol]')]; },
  instances(sym) { return [...App.els.content.querySelectorAll('use')].filter(u => hrefOf(u) === sym.id); },
  selected() { return this.list().find(s => s.id === this.cur) || null; },
  async create() {
    const sel = App.selection.filter(e => !Layers.isLocked(e)); if (!sel.length) return Dialog.alert('Selecciona la ilustración que quieres convertir en símbolo.');
    const v = await Dialog.form('Opciones de símbolo', [{ id: 'n', label: 'Nombre', value: `Símbolo ${this.list().length + 1}` }]); if (!v) return;
    const { g, box } = Defs.capture(sel); g.id = uid('sym'); g.setAttribute('data-symbol', '1'); g.setAttribute('data-name', v.n.trim() || 'Símbolo');
    docDefs().appendChild(g);
    const anchor = docOrder(sel).pop(), u = svgEl('use', { id: uid(), 'data-name': g.getAttribute('data-name') }); setHref(u, g.id);
    anchor.after(u); Geo.setMatrix(u, Geo.toDoc(u.parentNode).inverse().multiply(new DOMMatrix().translate(box.x, box.y)));
    sel.forEach(e => e.remove()); this.cur = g.id;
    Selection.set([u]); History.named('Nuevo símbolo', () => History.commit()); App.emit('layers'); this.render();
  },
  place(sym = this.selected()) {
    if (!sym) return;
    const u = addObject(svgEl('use', { 'data-name': sym.getAttribute('data-name') })); if (!u) return; setHref(u, sym.id);
    const b = Geo.bbox(u), a = Artboards.active();
    if (b) { Geo.applyDoc(u, new DOMMatrix().translate(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2)); }
    Selection.set([u]); History.named('Colocar símbolo', () => History.commit());
  },
  /* romper vínculo: la instancia pasa a ser ilustración normal */
  breakLink(us = App.selection.filter(e => e.tagName === 'use')) {
    const out = [];
    for (const u of us) {
      const sym = document.getElementById(hrefOf(u)); if (!sym) continue;
      const g = svgEl('g', { id: uid(), 'data-name': u.getAttribute('data-name') || sym.getAttribute('data-name') });
      for (const c of sym.children) { const k = c.cloneNode(true); k.id = uid(); g.appendChild(k); }
      u.before(g); Geo.setMatrix(g, Geo.local(u).multiply(new DOMMatrix().translate(+u.getAttribute('x') || 0, +u.getAttribute('y') || 0)));
      u.remove(); out.push(g);
    }
    if (out.length) { Selection.set(out); History.named('Romper vínculo', () => History.commit()); App.emit('layers'); }
  },
  /* redefinir: el símbolo pasa a ser la selección actual (todas las instancias cambian) */
  redefine(sym = this.selected()) {
    const sel = App.selection.filter(e => e.tagName !== 'use'); if (!sym || !sel.length) return Dialog.alert('Selecciona la ilustración nueva y el símbolo en el panel.');
    sym.replaceChildren(...Defs.capture(sel).g.children);
    History.named('Redefinir símbolo', () => History.commit()); this.render();
  },
  remove(sym = this.selected()) {
    if (!sym) return;
    this.breakLink(this.instances(sym)); sym.remove(); this.cur = null;
    History.named('Eliminar símbolo', () => History.commit()); this.render();
  },
  edit(u) {
    const sym = u ? document.getElementById(hrefOf(u)) : this.selected(); if (!sym) return;
    const at = u ? Geo.toDoc(u).multiply(new DOMMatrix().translate(+u.getAttribute('x') || 0, +u.getAttribute('y') || 0))
      : new DOMMatrix().translate(Artboards.active().x + 40, Artboards.active().y + 40);
    DefEdit.enter(sym, at, u);
  },
  render() {
    const box = $('symGrid'); if (!box) return;
    box.innerHTML = '';
    for (const s of this.list()) {
      const c = document.createElement('div'); c.className = 'sym' + (s.id === this.cur ? ' on' : ''); c.title = s.getAttribute('data-name');
      let b = null; const tmp = svgEl('use', {}); setHref(tmp, s.id); App.els.content.appendChild(tmp); try { b = tmp.getBBox(); } catch (e) { /* vacío */ } tmp.remove();
      const vb = b && b.width ? `${b.x} ${b.y} ${b.width} ${b.height}` : '0 0 10 10';
      c.innerHTML = `<svg viewBox="${vb}" preserveAspectRatio="xMidYMid meet"><use href="#${s.id}"/></svg><span></span>`;
      c.querySelector('span').textContent = s.getAttribute('data-name');
      c.onclick = () => { this.cur = s.id; this.render(); };
      c.ondblclick = () => this.place(s);
      c.draggable = true; c.ondragstart = e => { e.dataTransfer.setData('text/x-vectora-symbol', s.id); };
      box.appendChild(c);
    }
    if (!box.children.length) box.innerHTML = '<p class="empty-note">Selecciona ilustración y pulsa ＋ para crear un símbolo.</p>';
  },
  init() {
    const p = $('pSymbols');
    p.querySelector('#symNew').onclick = () => this.create();
    p.querySelector('#symPlace').onclick = () => this.place();
    p.querySelector('#symBreak').onclick = () => this.breakLink();
    p.querySelector('#symEdit').onclick = () => this.edit(App.selection.find(e => e.tagName === 'use'));
    p.querySelector('#symRedef').onclick = () => this.redefine();
    p.querySelector('#symDel').onclick = () => this.remove();
    /* soltar un símbolo del panel en el lienzo */
    const wrap = $('canvasWrap');
    wrap.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('text/x-vectora-symbol')) e.preventDefault(); });
    wrap.addEventListener('drop', e => {
      const id = e.dataTransfer.getData('text/x-vectora-symbol'); if (!id) return;
      e.preventDefault(); e.stopPropagation(); const sym = document.getElementById(id); if (!sym) return;
      this.place(sym); const u = App.selection[0], b = Geo.bbox(u), p2 = View.screenToDoc(e.clientX, e.clientY);
      if (b) { Geo.applyDoc(u, new DOMMatrix().translate(p2.x - b.x - b.width / 2, p2.y - b.y - b.height / 2)); History.commit(); Selection.draw(); }
    }, true);
    App.on('change', () => this.render()); App.on('dock', t => { if (t === 'pSymbols') this.render(); });
    this.render();
  },
};

/* ---------- motivos (patrones) ---------- */
const PATTERN_PRESETS = {
  'Rayas': [12, 12, '<rect width="12" height="6" fill="#1b1b1b"/>'],
  'Rayas diagonales': [10, 10, '<path d="M-2 2L2 -2M0 10L10 0M8 12L12 8" stroke="#1b1b1b" stroke-width="2.5"/>'],
  'Lunares': [16, 16, '<circle cx="8" cy="8" r="4" fill="#1b1b1b"/>'],
  'Cuadros': [20, 20, '<rect width="10" height="10" fill="#1b1b1b"/><rect x="10" y="10" width="10" height="10" fill="#1b1b1b"/>'],
  'Cuadrícula': [16, 16, '<path d="M16 0H0V16" fill="none" stroke="#1b1b1b" stroke-width="1"/>'],
  'Zigzag': [20, 10, '<path d="M0 8L5 2L10 8L15 2L20 8" fill="none" stroke="#1b1b1b" stroke-width="2"/>'],
  'Ladrillos': [24, 16, '<path d="M0 0H24V8H0zM12 8V16M0 0V8" fill="none" stroke="#1b1b1b" stroke-width="1"/>'],
};
const Patterns = {
  list() { return [...docDefs().querySelectorAll(':scope > pattern[data-swatch]')]; },
  add(name, w, h, inner) {
    const p = svgEl('pattern', { id: uid('pat'), patternUnits: 'userSpaceOnUse', width: w, height: h, 'data-swatch': '1', 'data-name': name }, docDefs());
    p.innerHTML = inner; return p;
  },
  preset(name) { return this.list().find(p => p.getAttribute('data-name') === name) || this.add(name, ...PATTERN_PRESETS[name]); },
  apply(p) {
    if (!App.selection.length) return;
    setStyle(App.selection, App.activeFS === 'stroke' ? 'stroke' : 'fill', `url(#${p.id})`);
    History.named('Aplicar motivo', () => History.commit()); Selection.draw();
  },
  async create() {
    const sel = App.selection.filter(e => !Layers.isLocked(e)); if (!sel.length) return Dialog.alert('Selecciona la ilustración que formará el motivo.');
    const v = await Dialog.form('Crear motivo', [
      { id: 'n', label: 'Nombre', value: `Motivo ${this.list().length + 1}` },
      { id: 'gx', label: 'Espacio horizontal (px)', type: 'number', value: 0, min: 0 }, { id: 'gy', label: 'Espacio vertical (px)', type: 'number', value: 0, min: 0 },
    ], { note: 'El motivo se añade al panel Muestras. Selecciona un objeto y haz clic en el motivo para rellenarlo.' });
    if (!v) return;
    const { g, box } = Defs.capture(sel), p = this.add(v.n.trim() || 'Motivo', round(box.width + (+v.gx || 0), 3), round(box.height + (+v.gy || 0), 3), '');
    p.replaceChildren(...g.children);
    History.named('Crear motivo', () => History.commit()); this.render(); Dock.show('pSwatches');
  },
  edit(p) {
    p = p || this.list().find(x => App.selection.some(e => (getStyle(e, 'fill') || '').includes(`#${x.id})`))); if (!p) return Dialog.alert('Selecciona un objeto relleno con un motivo.');
    const a = Artboards.active(); DefEdit.enter(p, new DOMMatrix().translate(a.x + 40, a.y + 40), null);
  },
  chip(p) {
    const c = document.createElement('div'); c.className = 'sw pat'; c.title = p.getAttribute('data-name') + ' (Alt+clic: editar)';
    c.innerHTML = `<svg viewBox="0 0 36 36"><rect width="36" height="36" fill="#fff"/><rect width="36" height="36" fill="url(#${p.id})"/></svg>`;
    c.onclick = e => (e.altKey ? this.edit(p) : this.apply(p));
    return c;
  },
  render() {
    const g = $('patGrid'); if (!g) return;
    g.innerHTML = ''; this.list().forEach(p => g.appendChild(this.chip(p)));
    const lib = $('patLib'); if (lib && !lib.children.length) for (const name of Object.keys(PATTERN_PRESETS)) {
      const b = document.createElement('button'); b.className = 'text-btn'; b.textContent = name;
      b.onclick = () => { const p = this.preset(name); this.apply(p); this.render(); }; lib.appendChild(b);
    }
  },
  init() { App.on('change', () => this.render()); this.render(); },
};

/* doble clic en una instancia de símbolo: editar el símbolo */
(() => {
  const sel = App.tools.select, dbl = sel.dblclick;
  sel.dblclick = function (p, ev) { const o = hitObject(ev); if (o && o.tagName === 'use' && hrefOf(o).startsWith('sym')) return Symbols.edit(o); return dbl.call(this, p, ev); };
})();
