/* Vectora — núcleo: estado, vista, capas, historial y utilidades */
'use strict';
const NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);

const App = {
  doc: { width: 800, height: 600, title: 'Sin título-1' },
  view: { zoom: 1, x: 0, y: 0 },
  fill: '#ffffff', stroke: '#000000', strokeWidth: 1, activeFS: 'fill',
  selection: [], tool: null, toolName: 'select', tools: {},
  activeLayer: null, clipboard: null, snap: false, gridSize: 10,
  els: {}, _listeners: {}, _uid: 1,

  on(ev, fn) { (this._listeners[ev] ||= []).push(fn); },
  emit(ev, data) { (this._listeners[ev] || []).forEach(fn => fn(data)); },
};

/* ---------- Utilidades DOM ---------- */
function svgEl(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
}
function uid(prefix = 'o') {
  let id;
  do { id = prefix + (App._uid++); } while (document.getElementById(id));
  return id;
}
function round(n, d = 2) { const p = 10 ** d; return Math.round(n * p) / p; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

/* ---------- Colores ---------- */
const _cctx = document.createElement('canvas').getContext('2d');
function normColor(c) {
  if (!c || c === 'none' || c === 'transparent') return 'none';
  if (c.startsWith('url(')) return c;
  _cctx.fillStyle = '#000'; _cctx.fillStyle = c;
  const v = _cctx.fillStyle;
  return v.startsWith('#') ? v : rgbaToHex(v);
}
function rgbaToHex(s) {
  const m = s.match(/[\d.]+/g); if (!m) return '#000000';
  return rgbToHex(+m[0], +m[1], +m[2]);
}
function hexToRgb(h) {
  h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}
function hsvToRgb(h, s, v) {
  const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return { r: f(5) * 255, g: f(3) * 255, b: f(1) * 255 };
}

/* ---------- Vista (zoom / desplazamiento) ---------- */
const View = {
  apply() {
    const v = App.view;
    App.els.viewport.setAttribute('transform', `matrix(${v.zoom},0,0,${v.zoom},${v.x},${v.y})`);
    $('artboardShadow').setAttribute('x', 3 / v.zoom); $('artboardShadow').setAttribute('y', 3 / v.zoom);
    $('sbZoom').textContent = Math.round(v.zoom * 100) + '%';
    $('docTitle').textContent = `${App.dirty ? '● ' : ''}${App.doc.title} @ ${Math.round(v.zoom * 100)}% (RGB/Vista previa)`;
    document.title = `${App.dirty ? '● ' : ''}${App.doc.title} — Vectora`;
    if (window.vectoraDesktop) window.vectoraDesktop.setDirty(!!App.dirty);
    App.emit('view');
  },
  screenToDoc(cx, cy) {
    const r = App.els.stage.getBoundingClientRect(), v = App.view;
    return { x: (cx - r.left - v.x) / v.zoom, y: (cy - r.top - v.y) / v.zoom };
  },
  docToStage(x, y) { const v = App.view; return { x: x * v.zoom + v.x, y: y * v.zoom + v.y }; },
  zoomAt(factor, sx, sy) {
    const v = App.view, nz = clamp(v.zoom * factor, 0.03, 64);
    if (sx == null) { const r = App.els.stage.getBoundingClientRect(); sx = r.width / 2; sy = r.height / 2; }
    v.x = sx - (sx - v.x) * (nz / v.zoom); v.y = sy - (sy - v.y) * (nz / v.zoom); v.zoom = nz;
    this.apply();
  },
  setZoom(z) { this.zoomAt(z / App.view.zoom); },
  fit() {
    const r = App.els.stage.getBoundingClientRect(), d = App.doc;
    const z = Math.min((r.width - 80) / d.width, (r.height - 80) / d.height);
    App.view.zoom = z; App.view.x = (r.width - d.width * z) / 2; App.view.y = (r.height - d.height * z) / 2;
    this.apply();
  },
  updateArtboard() {
    const d = App.doc;
    for (const id of ['artboard', 'artboardShadow']) {
      const el = $(id); el.setAttribute('width', d.width); el.setAttribute('height', d.height);
    }
    /* sangrado: línea roja alrededor de la mesa de trabajo */
    let bl = $('bleedRect');
    if (!bl) bl = svgEl('rect', { id: 'bleedRect', fill: 'none', stroke: '#e5332a', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' });
    App.els.content.after(bl);
    const b = d.bleed || 0;
    Object.entries({ x: -b, y: -b, width: d.width + 2 * b, height: d.height + 2 * b }).forEach(([k, v]) => bl.setAttribute(k, v));
    bl.style.display = b > 0 ? '' : 'none';
    const gr = $('gridRect'); if (gr) { gr.setAttribute('width', d.width); gr.setAttribute('height', d.height); }
  },
};

/* ---------- Capas ---------- */
const LAYER_COLORS = ['#4f8cff', '#ff4f4f', '#3fcf6f', '#4fd2ff', '#ff4fd8', '#ffd84f', '#9a6bff', '#ff9a4f'];
const Layers = {
  all() { return [...App.els.content.children].filter(e => e.classList.contains('layer')); },
  create(name, select = true) {
    const n = this.all().length;
    const g = svgEl('g', { id: uid('L'), class: 'layer', 'data-name': name || `Capa ${n + 1}`,
      'data-color': LAYER_COLORS[n % LAYER_COLORS.length] }, App.els.content);
    if (select) App.activeLayer = g;
    App.emit('layers');
    return g;
  },
  ensure() {
    const all = this.all();
    if (!all.length) return this.create('Capa 1');
    if (!App.activeLayer || !App.activeLayer.isConnected) App.activeLayer = all[all.length - 1];
    return App.activeLayer;
  },
  layerOf(el) { while (el && !(el.classList && el.classList.contains('layer'))) el = el.parentNode; return el; },
  isLocked(el) {
    for (let e = el; e && e !== App.els.content; e = e.parentNode)
      if (e.getAttribute('data-locked') === '1') return true;
    return false;
  },
  isHidden(el) {
    for (let e = el; e && e !== App.els.content; e = e.parentNode)
      if (e.getAttribute('display') === 'none') return true;
    return false;
  },
  /* objeto de nivel superior (hijo directo de una capa) */
  topObject(el) {
    while (el && el.parentNode && !(el.parentNode.classList && el.parentNode.classList.contains('layer'))) el = el.parentNode;
    return el && el.parentNode && el.parentNode.classList && el.parentNode.classList.contains('layer') ? el : null;
  },
  objects() { return this.all().flatMap(l => [...l.children]); },
};

/* ---------- Historial (deshacer / rehacer) ---------- */
/* Registro de imágenes incrustadas: cada data-URL se guarda una sola vez y las
   instantáneas del historial / autoguardado solo llevan una referencia corta. */
const ImageStore = {
  byUrl: new Map(), byId: new Map(), n: 1,
  put(url) {
    let id = this.byUrl.get(url);
    if (!id) { id = 'vimg' + (this.n++); this.byUrl.set(url, id); this.byId.set(id, url); }
    return id;
  },
  pack(html) { return html.replace(/href="(data:[^"]{256,})"/g, (m, d) => `href="vimg:${this.put(d)}"`); },
  unpack(html) { return html.replace(/href="vimg:(vimg\d+)"/g, (m, id) => `href="${this.byId.get(id) || ''}"`); },
  used(html) { return [...new Set((html.match(/vimg:(vimg\d+)/g) || []).map(s => s.slice(5)))]; },
};

const History = {
  stack: [], index: -1, max: 120, maxChars: 40e6,
  snapshot() {
    return { html: ImageStore.pack(App.els.content.innerHTML), sel: App.selection.map(e => e.id),
      layer: App.activeLayer && App.activeLayer.id, doc: JSON.parse(JSON.stringify(App.doc)) };
  },
  commit() {
    this.stack.length = this.index + 1;
    this.stack.push(this.snapshot());
    let total = this.stack.reduce((n, s) => n + s.html.length, 0);
    while (this.stack.length > 2 && (this.stack.length > this.max || total > this.maxChars)) total -= this.stack.shift().html.length;
    this.index = this.stack.length - 1;
    App.emit('change');
  },
  restore(s) {
    App.els.content.innerHTML = ImageStore.unpack(s.html);
    Object.assign(App.doc, JSON.parse(JSON.stringify(s.doc))); View.updateArtboard();
    App.activeLayer = (s.layer && document.getElementById(s.layer)) || null;
    Layers.ensure();
    Selection.set(s.sel.map(id => document.getElementById(id)).filter(Boolean));
    App.emit('layers'); App.emit('change');
  },
  undo() { if (this.index > 0) { this.index--; this.restore(this.stack[this.index]); } },
  redo() { if (this.index < this.stack.length - 1) { this.index++; this.restore(this.stack[this.index]); } },
  reset() { this.stack = []; this.index = -1; this.commit(); App.dirty = false; },
};

/* ---------- Estilos de objetos ---------- */
const SHAPE_TAGS = new Set(['path', 'rect', 'ellipse', 'circle', 'polygon', 'polyline', 'line', 'text', 'image']);
function leafShapes(el) {
  if (el.tagName === 'g') return [...el.children].flatMap(leafShapes);
  return SHAPE_TAGS.has(el.tagName) ? [el] : [];
}
function setStyle(els, prop, value) {
  for (const el of els) for (const s of leafShapes(el)) {
    if (s.tagName === 'image') continue;
    if (s.style && s.style.getPropertyValue(prop)) { s.style.removeProperty(prop); if (!s.getAttribute('style')) s.removeAttribute('style'); }
    if (value == null || value === '') s.removeAttribute(prop); else s.setAttribute(prop, value);
  }
}
function getStyle(el, prop) {
  const s = leafShapes(el)[0]; if (!s) return null;
  return (s.style && s.style.getPropertyValue(prop)) || s.getAttribute(prop);
}
function newShapeAttrs() {
  return { fill: App.fill, stroke: App.stroke, 'stroke-width': App.strokeWidth };
}
