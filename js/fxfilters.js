/* Vectora — efectos de filtro apilables (sombra, desenfoque, resplandor exterior e interior,
   desvanecer, grano), nuevos efectos geométricos en vivo (Transformar, Desplazar trazado,
   Contornear trazo, Garabato) y herramientas de símbolos (rociador, desplazar, dimensionar) */
'use strict';

/* ---------- filtros apilables: la lista vive en data-filters y el <filter> se reconstruye ---------- */
const FILTERS = {
  shadow: { name: 'Sombra paralela', layer: 'under', fields: [
    { id: 'dx', label: 'Desplazamiento X', type: 'number', value: 4 }, { id: 'dy', label: 'Desplazamiento Y', type: 'number', value: 4 },
    { id: 'b', label: 'Desenfoque', type: 'number', value: 3, min: 0, step: 0.5 }, { id: 'o', label: 'Opacidad (%)', type: 'number', value: 50, min: 0, max: 100 },
    { id: 'c', label: 'Color', type: 'color', value: '#000000' }],
    build: (p, k) => `<feGaussianBlur in="SourceAlpha" stdDeviation="${+p.b || 0}"/><feOffset dx="${+p.dx || 0}" dy="${+p.dy || 0}" result="o${k}"/>
      <feFlood flood-color="${p.c}" flood-opacity="${clamp(+p.o, 0, 100) / 100}"/><feComposite in2="o${k}" operator="in" result="L${k}"/>` },
  outerglow: { name: 'Resplandor exterior', layer: 'under', fields: [
    { id: 'b', label: 'Desenfoque', type: 'number', value: 6, min: 0, step: 0.5 }, { id: 'o', label: 'Opacidad (%)', type: 'number', value: 75, min: 0, max: 100 },
    { id: 'c', label: 'Color', type: 'color', value: '#ffd60a' }],
    build: (p, k) => `<feMorphology in="SourceAlpha" operator="dilate" radius="${(+p.b || 0) / 3}"/><feGaussianBlur stdDeviation="${+p.b || 0}" result="o${k}"/>
      <feFlood flood-color="${p.c}" flood-opacity="${clamp(+p.o, 0, 100) / 100}"/><feComposite in2="o${k}" operator="in" result="L${k}"/>` },
  innerglow: { name: 'Resplandor interior', layer: 'over', fields: [
    { id: 'b', label: 'Desenfoque', type: 'number', value: 6, min: 0, step: 0.5 }, { id: 'o', label: 'Opacidad (%)', type: 'number', value: 75, min: 0, max: 100 },
    { id: 'c', label: 'Color', type: 'color', value: '#ffffff' }, { id: 'from', label: 'Desde', type: 'select', value: 'edge', options: [['edge', 'Borde'], ['center', 'Centro']] }],
    build: (p, k) => {
      const band = p.from === 'center'
        ? `<feGaussianBlur in="SourceAlpha" stdDeviation="${+p.b || 0}" result="a${k}"/><feComposite in="SourceAlpha" in2="a${k}" operator="arithmetic" k2="0" k3="1" result="o${k}"/>`
        : `<feGaussianBlur in="SourceAlpha" stdDeviation="${+p.b || 0}" result="a${k}"/><feComposite in="SourceAlpha" in2="a${k}" operator="arithmetic" k2="1" k3="-1" result="o${k}"/>`;
      return `${band}<feFlood flood-color="${p.c}" flood-opacity="${clamp(+p.o, 0, 100) / 100}"/><feComposite in2="o${k}" operator="in"/><feComposite in2="SourceAlpha" operator="in" result="L${k}"/>`;
    } },
  blur: { name: 'Desenfoque gaussiano', layer: 'mod', fields: [{ id: 'r', label: 'Radio', type: 'number', value: 4, min: 0, step: 0.5 }],
    build: (p, k, src) => `<feGaussianBlur in="${src}" stdDeviation="${+p.r || 0}" result="S${k}"/>` },
  feather: { name: 'Desvanecer', layer: 'mod', fields: [{ id: 'r', label: 'Radio de desvanecimiento', type: 'number', value: 8, min: 0, step: 0.5 }],
    build: (p, k, src) => `<feMorphology in="SourceAlpha" operator="erode" radius="${(+p.r || 0) / 2}"/><feGaussianBlur stdDeviation="${(+p.r || 0) / 2}" result="m${k}"/>
      <feComposite in="${src}" in2="m${k}" operator="in" result="S${k}"/>` },
  grain: { name: 'Grano', layer: 'mod', fields: [{ id: 'i', label: 'Intensidad (%)', type: 'number', value: 35, min: 0, max: 100 }, { id: 'f', label: 'Tamaño del grano', type: 'number', value: 0.9, min: 0.05, max: 3, step: 0.05 }],
    build: (p, k, src) => `<feTurbulence type="fractalNoise" baseFrequency="${+p.f || 0.9}" numOctaves="2" seed="3" result="n${k}"/>
      <feColorMatrix in="n${k}" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${clamp(+p.i, 0, 100) / 50} -${clamp(+p.i, 0, 100) / 100}" result="g${k}"/>
      <feComposite in="g${k}" in2="${src}" operator="in" result="h${k}"/><feMerge result="S${k}"><feMergeNode in="${src}"/><feMergeNode in="h${k}"/></feMerge>` },
};
const FilterFX = {
  /* lista de filtros del elemento (con migración de los filtros antiguos de un solo efecto) */
  list(el) {
    if (!el || !el.getAttribute) return [];
    try { const L = JSON.parse(el.getAttribute('data-filters') || 'null'); if (L) return L; } catch (e) { /* dañado */ }
    const id = (el.getAttribute('filter') || '').match(/#([^)]+)/), F = id && document.getElementById(id[1]); if (!F) return [];
    const out = [];
    for (const prim of F.children) {
      if (prim.tagName === 'feDropShadow') out.push({ t: 'shadow', p: { dx: +prim.getAttribute('dx') || 0, dy: +prim.getAttribute('dy') || 0, b: +prim.getAttribute('stdDeviation') || 0, o: round((+(prim.getAttribute('flood-opacity') ?? 1)) * 100), c: normColor(prim.getAttribute('flood-color') || '#000') } });
      else if (prim.tagName === 'feGaussianBlur' && F.children.length === 1) out.push({ t: 'blur', p: { r: +prim.getAttribute('stdDeviation') || 0 } });
    }
    return out;
  },
  /* reconstruye el <filter> del elemento */
  write(el, list) {
    const id = (el.getAttribute('filter') || '').match(/#([^)]+)/); let F = id && document.getElementById(id[1]);
    const active = list.filter(f => f.on !== false && FILTERS[f.t]);
    if (!list.length) { el.removeAttribute('data-filters'); el.removeAttribute('filter'); if (F) F.remove(); return; }
    el.setAttribute('data-filters', JSON.stringify(list));
    if (!active.length) { el.removeAttribute('filter'); return; }
    if (!F || App.els.content.querySelectorAll(`[filter="url(#${F.id})"]`).length > 1) { F = svgEl('filter', { id: uid('fx') }, docDefs()); }
    setA(F, {}); Object.entries({ x: '-60%', y: '-60%', width: '220%', height: '220%', 'color-interpolation-filters': 'sRGB' }).forEach(([k, v]) => F.setAttribute(k, v));
    let src = 'SourceGraphic', html = ''; const under = [], over = [];
    active.forEach((f, k) => {
      const D = FILTERS[f.t];
      if (D.layer === 'mod') { html += D.build(f.p || {}, k, src); src = 'S' + k; }
    });
    active.forEach((f, k) => { const D = FILTERS[f.t]; if (D.layer === 'mod') return; html += D.build(f.p || {}, k, src); (D.layer === 'under' ? under : over).push('L' + k); });
    html += `<feMerge>${under.map(r => `<feMergeNode in="${r}"/>`).join('')}<feMergeNode in="${src}"/>${over.map(r => `<feMergeNode in="${r}"/>`).join('')}</feMerge>`;
    F.innerHTML = html; el.setAttribute('filter', `url(#${F.id})`);
  },
  targets() { return App.selection.filter(e => !Layers.isLocked(e)); },
  async add(t) {
    const D = FILTERS[t], els = this.targets(); if (!els.length) return Dialog.alert('Selecciona uno o más objetos.');
    const snap = History.snapshot(), ids = els.map(e => e.id || (e.id = uid()));
    const apply = v => { for (const id of ids) { const e = document.getElementById(id); if (e) this.write(e, [...this.list(e), { t, p: v }]); } Selection.draw(); };
    const v = await Dialog.form(D.name, D.fields, { preview: apply, revert: () => Dialog.revertTo(snap), note: 'El efecto queda editable en el panel Apariencia.' });
    if (!v) return; delete v._button; apply(v); History.named(D.name, () => History.commit()); Selection.changed();
  },
  async edit(el, i) {
    const L = this.list(el), f = L[i], D = FILTERS[f.t]; if (!D) return;
    const snap = History.snapshot(), id = el.id;
    const apply = v => { const e = document.getElementById(id); if (!e) return; const M = this.list(e); M[i] = { ...M[i], p: v }; this.write(e, M); Selection.draw(); };
    const v = await Dialog.form(D.name, D.fields.map(x => ({ ...x, value: (f.p || {})[x.id] ?? x.value })), { preview: apply, revert: () => Dialog.revertTo(snap) });
    if (!v) return; delete v._button; apply(v); History.named(D.name, () => History.commit()); Selection.changed();
  },
  toggle(el, i) { const L = this.list(el); L[i].on = L[i].on === false; this.write(el, L); History.named('Efecto', () => History.commit()); Selection.changed(); },
  remove(el, i) { const L = this.list(el); L.splice(i, 1); this.write(el, L); History.named('Quitar efecto', () => History.commit()); Selection.changed(); },
  clear() { this.targets().forEach(e => this.write(e, [])); History.named('Quitar efectos', () => History.commit()); Selection.changed(); },
  /* filas del panel Apariencia */
  rows(el, row) {
    this.list(el).forEach((f, i) => {
      const D = FILTERS[f.t]; if (!D) return;
      const r = row(`<span class="ap-eye ${f.on === false ? 'off' : ''}" title="Activar/desactivar">👁</span><span class="ap-name">${D.name}</span><span class="ap-fx" title="Editar efecto">fx</span><span class="ap-del" title="Quitar">✕</span>`, 'ap-effect');
      r.querySelector('.ap-eye').onclick = () => this.toggle(el, i);
      r.querySelector('.ap-name').onclick = r.querySelector('.ap-fx').onclick = () => this.edit(el, i);
      r.querySelector('.ap-del').onclick = () => this.remove(el, i);
    });
  },
};
/* los menús antiguos usan los filtros nuevos */
Object.assign(Effects, { shadow: () => FilterFX.add('shadow'), blur: () => FilterFX.add('blur'), clear: () => FilterFX.clear() });

/* ---------- efectos geométricos en vivo ---------- */
const subsBox = subs => Geo.union(subs.flatMap(s => s.nodes).map(n => ({ x: n.x, y: n.y, width: 0, height: 0 })));
Object.assign(FX, {
  transform: { name: 'Transformar',
    fields: [{ id: 'n', label: 'Copias', type: 'number', value: 3, min: 0, max: 200 }, { id: 'sx', label: 'Escala horizontal (%)', type: 'number', value: 100 }, { id: 'sy', label: 'Escala vertical (%)', type: 'number', value: 100 },
      { id: 'mx', label: 'Mover horizontal (px)', type: 'number', value: 20 }, { id: 'my', label: 'Mover vertical (px)', type: 'number', value: 0 }, { id: 'a', label: 'Ángulo (°)', type: 'number', value: 0 }],
    run(subs, p) {
      const b = subsBox(subs); if (!b) return subs;
      const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 }, n = clamp(Math.round(+p.n || 0), 0, 200), out = [...subs];
      const M = new DOMMatrix().translate(+p.mx || 0, +p.my || 0).translate(c.x, c.y).rotate(+p.a || 0).scale((+p.sx || 100) / 100, (+p.sy || 100) / 100).translate(-c.x, -c.y);
      let T = new DOMMatrix();
      for (let i = 0; i < n; i++) {
        T = M.multiply(T); const f = q => q && Geo.pt(T, q.x, q.y);
        for (const s of subs) out.push({ closed: s.closed, nodes: s.nodes.map(m => ({ ...f(m), hin: f(m.hin), hout: f(m.hout) })) });
      }
      return out;
    } },
  offset: { name: 'Desplazar trazado',
    fields: [{ id: 'd', label: 'Desplazamiento (px)', type: 'number', value: 10 }, { id: 'join', label: 'Uniones', type: 'select', value: 'round', options: [['miter', 'Inglete'], ['round', 'Redondas'], ['bevel', 'Biseladas']] }],
    run(subs, p) {
      const d = +p.d || 0; if (!d) return subs;
      const base = Boolean2D.fromSubs(subs.filter(s => s.closed)); if (!base.rings.length) return subs;
      const band = strokeOutline(base.rings.map(r => ({ pts: r, closed: true })), Math.abs(d), p.join, 'butt', 8);
      return Boolean2D.toSubs(Boolean2D.op(base, band, d > 0 ? 'union' : 'difference'));
    } },
  outlinestroke: { name: 'Contornear trazo', outline: true,
    fields: [{ id: 'join', label: 'Uniones', type: 'select', value: 'miter', options: [['miter', 'Inglete'], ['round', 'Redondas'], ['bevel', 'Biseladas']] }, { id: 'cap', label: 'Extremos', type: 'select', value: 'butt', options: [['butt', 'Planos'], ['round', 'Redondos'], ['square', 'Proyectados']] }],
    run(subs, p, ctx) { return Boolean2D.toSubs(strokeOutline(subs.map(s => ({ pts: Boolean2D.flatten(s), closed: s.closed })), ctx.w / 2, p.join, p.cap, 4)); } },
  scribble: { name: 'Garabato', outline: 'fill',
    fields: [{ id: 'a', label: 'Ángulo (°)', type: 'number', value: 30, step: 5 }, { id: 'gap', label: 'Espaciado (px)', type: 'number', value: 6, min: 1, step: 0.5 },
      { id: 'w', label: 'Anchura del trazo (px)', type: 'number', value: 2, min: 0.2, step: 0.5 }, { id: 'var', label: 'Variación (%)', type: 'number', value: 30, min: 0, max: 100 },
      { id: 'ov', label: 'Superposición (px)', type: 'number', value: 2, min: -20, max: 40 }],
    run(subs, p) {
      const P = Boolean2D.fromSubs(subs.filter(s => s.closed)); if (!P.rings.length) return subs;
      const b = subsBox(subs), A = (+p.a || 0) * Math.PI / 180, ca = Math.cos(A), sa = Math.sin(A), gap = Math.max(0.5, +p.gap || 6), V = clamp(+p.var || 0, 0, 100) / 100, ov = +p.ov || 0;
      const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 }, R = Math.hypot(b.width, b.height) / 2 + ov;
      rngSeed = 1234; const pts = [];
      /* zigzag continuo en un sistema girado: va y vuelve a lo ancho mientras avanza */
      for (let t = -R, k = 0; t <= R; t += gap, k++) {
        const side = k % 2 ? 1 : -1, j = (rnd() * 2 - 1) * V * gap, w = R * (1 + (rnd() * 2 - 1) * V * 0.15);
        const u = side * w, v = t + j;
        pts.push({ x: c.x + u * ca - v * sa, y: c.y + u * sa + v * ca });
      }
      const line = strokeOutline([{ pts, closed: false }], Math.max(0.1, (+p.w || 2) / 2), 'round', 'round');
      return Boolean2D.toSubs(Boolean2D.op(line, P, 'intersect'));
    } },
});
/* LiveFX.paint: los efectos «outline: 'fill'» pintan el resultado con el color de relleno */
(() => {
  const base = LiveFX.render.bind(LiveFX);
  LiveFX.render = function (el) {
    const L = this.list(el).filter(f => f.on !== false && FX[f.t]), mode = L.some(f => FX[f.t].outline === 'fill') ? 'fill' : null;
    base(el);
    if (mode === 'fill') { const o = this.ostroke(el); if (o) { el.setAttribute('fill', o.f === 'none' ? '#000000' : o.f); el.setAttribute('stroke', 'none'); } }
  };
})();

/* ---------- herramientas de símbolos: rociador, desplazar y dimensionar ---------- */
App.symDensity = 40;
const SymTools = {
  sym() { return (Symbols.cur && document.getElementById(Symbols.cur)) || Symbols.list()[0] || null; },
  set() { const s = App.selection[0]; return s && s.hasAttribute && s.hasAttribute('data-symset') ? s : null; },
  options() { return `Diámetro <input type="number" id="optSymD" min="4" value="${App.liqSize}"> px · Densidad <input type="range" id="optSymN" min="5" max="100" value="${App.symDensity}"> <span style="color:#888">Alt: invertir</span>`; },
  bindOptions() { $('optSymD').oninput = e => App.liqSize = Math.max(4, +e.target.value); $('optSymN').oninput = e => App.symDensity = +e.target.value; },
  instances(g, p, R) { return [...g.querySelectorAll(':scope > use')].filter(u => { const b = Geo.bbox(u); return b && Geo.dist({ x: b.x + b.width / 2, y: b.y + b.height / 2 }, p) <= R; }); },
};
const symTool = (id, name, icon, step) => {
  ICONS[id] = icon; TOOL_INFO[id] = [name, id === 'symsprayer' ? 'Mayús+S' : ''];
  App.tools[id] = {
    cursor: 'crosshair', options: SymTools.options, bindOptions: SymTools.bindOptions,
    hover(p) { this.cur = p; Selection.draw(); },
    down(p, ev) { this.alt = ev.altKey; this.last = p; this.acc = 0; this.g = SymTools.set(); this.made = false; step.call(this, p, p, true); },
    move(p) { if (!this.last) return; this.acc += Geo.dist(p, this.last); step.call(this, this.last, p, false); this.last = p; this.cur = p; Selection.draw(); },
    up() { if (!this.last) return; this.last = null; if (this.made) { if (this.g) Selection.set([this.g]); History.named(name, () => History.commit()); App.emit('layers'); } Selection.draw(); },
    overlay(g) { const c = this.cur; if (!c) return; const s = View.docToStage(c.x, c.y); svgEl('circle', { cx: s.x, cy: s.y, r: App.liqSize / 2, fill: 'none', stroke: '#1e90ff' }, g); },
  };
};
symTool('symsprayer', 'Rociador de símbolos', '<circle cx="7" cy="8" r="2"/><circle cx="14" cy="6" r="1.5"/><circle cx="12" cy="13" r="2.5"/><circle cx="18" cy="15" r="1.5"/><circle cx="8" cy="17" r="1.5"/>', function (a, p, first) {
  const R = App.liqSize / 2 / App.view.zoom;
  if (this.alt) { if (!this.g) return; for (const u of SymTools.instances(this.g, p, R).slice(0, 1)) { u.remove(); this.made = true; } return; }
  const sym = SymTools.sym(); if (!sym) { if (first) Dialog.alert('Crea primero un símbolo (panel Símbolos).'); this.last = null; return; }
  const every = Math.max(2, (110 - App.symDensity) / 100 * R * 1.2); if (!first && this.acc < every) return; this.acc = 0;
  if (!this.g) { this.g = addObject(svgEl('g', { 'data-symset': '1', 'data-name': 'Conjunto de símbolos' })); if (!this.g) return; }
  const u = svgEl('use', { 'data-name': sym.getAttribute('data-name') }); setHref(u, sym.id); this.g.appendChild(u);
  const b = u.getBBox(), s = 0.75 + Math.random() * 0.5, ang = Math.random() * 2 * Math.PI, rr = Math.sqrt(Math.random()) * R * 0.8;
  const q = { x: p.x + Math.cos(ang) * rr, y: p.y + Math.sin(ang) * rr }, inv = Geo.toDoc(this.g).inverse(), L = Geo.pt(inv, q.x, q.y);
  u.setAttribute('transform', `translate(${round(L.x - (b.x + b.width / 2) * s, 2)} ${round(L.y - (b.y + b.height / 2) * s, 2)}) scale(${round(s, 3)})`);
  this.made = true;
});
symTool('symshifter', 'Desplazador de símbolos', '<circle cx="8" cy="12" r="3"/><path d="M13 12h8M18 9l3 3-3 3"/>', function (a, p) {
  if (!this.g) return; const R = App.liqSize / 2 / App.view.zoom, dx = p.x - a.x, dy = p.y - a.y; if (!dx && !dy) return;
  for (const u of SymTools.instances(this.g, a, R)) { Geo.applyDoc(u, new DOMMatrix().translate(dx, dy)); this.made = true; }
});
symTool('symsizer', 'Dimensionador de símbolos', '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" stroke-dasharray="2 2"/>', function (a, p) {
  if (!this.g) return; const R = App.liqSize / 2 / App.view.zoom, k = this.alt ? 0.97 : 1.03;
  for (const u of SymTools.instances(this.g, p, R)) { const b = Geo.bbox(u), c = { x: b.x + b.width / 2, y: b.y + b.height / 2 }; Geo.applyDoc(u, new DOMMatrix().translate(c.x, c.y).scale(k).translate(-c.x, -c.y)); this.made = true; }
});
TOOL_GROUPS.splice(TOOL_GROUPS.findIndex(g => Array.isArray(g) && g.includes('blend')) + 1, 0, ['symsprayer', 'symshifter', 'symsizer']);
