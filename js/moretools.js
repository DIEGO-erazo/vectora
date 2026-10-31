/* Vectora — más herramientas: selección de grupos, varita mágica, lazo, tijeras, cuchillo,
   arco, espiral, cuadrículas, reflejar, distorsionar, pincel, pincel de manchas y fusión */
'use strict';

Object.assign(ICONS, {
  group: '<path d="M5 3l11 8-5 1 3 6-2 1-3-6-4 4z"/><path d="M18 16h5M20.5 13.5v5"/>',
  wand: '<path d="M4 20L14 10"/><path d="M16 3v3M16 10v3M12.5 6.5H15M17 6.5h3M13.5 4l1.2 1.2M18.5 9l-1.2-1.2"/>',
  lasso: '<ellipse cx="13" cy="9" rx="8" ry="5"/><path d="M7 12.5c-2.5 2-1.5 5 .8 5s2 2.5-.3 4"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6L20 18M8.6 16.4L20 6"/>',
  knife: '<path d="M3 21L14 10l3 3L6 21z"/><path d="M14 10l6-6v4l-3 5"/>',
  arc: '<path d="M4 20C4 11 11 4 20 4"/>',
  spiral: '<path d="M12 12a1.5 1.5 0 0 1 3 0a3 3 0 0 1-6 0a4.5 4.5 0 0 1 9 0a6 6 0 0 1-12 0a7.5 7.5 0 0 1 15 0"/>',
  rgrid: '<rect x="4" y="4" width="16" height="16"/><path d="M4 9.3h16M4 14.6h16M9.3 4v16M14.6 4v16"/>',
  pgrid: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 4v16M4 12h16"/>',
  reflect: '<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M9 7L3 18h6zM15 7l6 11h-6z"/>',
  shear: '<path d="M9 5h11l-5 14H4z"/>',
  brush: '<path d="M14 4l6 6-8 8-3-3z"/><path d="M9 15c-3 0-5 2-5 5 3 0 5-2 5-5"/>',
  blob: '<path d="M7 20c-3-2-2-6 1-6.5S12 11 11 8s2-5 5-3.5 2.5 6-1 8-2 4-4 6-3 2.5-4 1.5z"/>',
  blend: '<circle cx="5.5" cy="17" r="3"/><circle cx="18.5" cy="7" r="3"/><circle cx="10" cy="13.5" r="2.3" stroke-dasharray="1.5 1.5"/><circle cx="14.2" cy="10.3" r="2.3" stroke-dasharray="1.5 1.5"/>',
});

const inPolygon = (pts, p) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
};
const visibleShapes = () => Layers.objects().flatMap(o => leafShapes(o)).filter(editable);
const cloneNode = n => ({ x: n.x, y: n.y, hin: n.hin && { ...n.hin }, hout: n.hout && { ...n.hout } });
function drawPolyline(g, pts, extra = {}) {
  if (pts.length < 2) return;
  svgEl('path', { d: 'M' + pts.map(q => { const s = View.docToStage(q.x, q.y); return `${s.x} ${s.y}`; }).join('L'), fill: 'none', stroke: '#1e90ff', ...extra }, g);
}

/* ---------- Selección de grupos: clic = objeto; otro clic = su grupo ---------- */
App.tools.group = {
  cursor: 'default',
  down(p, ev, sp) {
    const h = Selection.handleAt(sp.x, sp.y);
    if (h) return void Transformer.begin(h === 'rot' ? 'rotate' : 'scale', h, p);
    let t = hitTarget(ev); if (t && t.tagName === 'tspan') t = t.closest('text');
    const valid = t && App.els.content.contains(t) && t !== App.els.content && !t.classList.contains('layer') && t.tagName !== 'defs'
      && !Layers.isLocked(t) && !Layers.isHidden(t);
    if (!valid) { if (!ev.shiftKey) Selection.clear(); return void Marquee.start(p); }
    const cur = App.selection.find(s => s.contains(t));
    this.climb = !!cur && !ev.shiftKey;
    if (ev.shiftKey) Selection.toggle(t); else if (!cur) Selection.set([t]);
    Transformer.begin('move', null, p, { duplicate: ev.altKey });
  },
  move(p, ev) { if (Transformer.active) Transformer.update(p, ev); else if (Marquee.el) Marquee.move(p); },
  up(p, ev) {
    if (Marquee.el) { const f = Marquee.end(); return Selection.set(ev.shiftKey ? [...App.selection, ...f] : f); }
    const moved = Transformer.active && Transformer.active.M;
    if (moved) return Transformer.end();
    Transformer.active = null; SmartGuides.clear();
    /* clic sin arrastrar sobre algo ya seleccionado: sube un nivel en la jerarquía */
    if (this.climb && App.selection.length === 1) {
      const par = App.selection[0].parentNode;
      if (par && !par.classList.contains('layer') && par !== App.els.content) Selection.set([par]);
    }
  },
  hover: (...a) => App.tools.select.hover(...a),
};

/* ---------- Varita mágica (Y): mismo color de relleno ---------- */
App.wandTol = 32;
App.tools.wand = {
  cursor: 'pointer',
  options: () => `Tolerancia <input type="number" id="optTol" min="0" max="255" value="${App.wandTol}">`,
  bindOptions() { $('optTol').oninput = e => App.wandTol = clamp(+e.target.value, 0, 255); },
  down(p, ev) {
    const o = hitObject(ev); if (!o) { if (!ev.shiftKey) Selection.clear(); return; }
    const ref = normColor(getStyle(o, 'fill') || '#000'), tol = App.wandTol;
    const same = c => {
      c = normColor(c || '#000');
      if (!ref.startsWith('#') || !c.startsWith('#')) return c === ref;
      const a = hexToRgb(ref), b = hexToRgb(c);
      return Math.max(Math.abs(a.r - b.r), Math.abs(a.g - b.g), Math.abs(a.b - b.b)) <= tol;
    };
    const hits = Layers.objects().filter(x => !Layers.isLocked(x) && !Layers.isHidden(x) && same(getStyle(x, 'fill')));
    Selection.set(ev.shiftKey ? [...App.selection, ...hits] : ev.altKey ? App.selection.filter(x => !hits.includes(x)) : hits);
  },
};

/* ---------- Lazo (Q): selecciona puntos de ancla a mano alzada ---------- */
App.tools.lasso = {
  cursor: 'crosshair',
  down(p) { this.pts = [p]; },
  move(p) { if (this.pts) { this.pts.push(p); Selection.draw(); } },
  overlay(g) { if (this.pts) drawPolyline(g, [...this.pts, this.pts[0]], { 'stroke-dasharray': '3 2' }); },
  up(p, ev) {
    const poly = this.pts; this.pts = null; if (!poly || poly.length < 3) { Selection.clear(); return; }
    const hits = visibleShapes().filter(el => {
      const m = Geo.toDoc(el);
      return PathData.parse(PathData.fromShape(el) || '').some(s => s.nodes.some(n => inPolygon(poly, Geo.pt(m, n.x, n.y))));
    });
    if (!hits.length) { if (!ev.shiftKey) Selection.clear(); Selection.draw(); return; }
    Selection.set([...new Set(hits.map(h => Layers.topObject(h) || h))]);
    Tools.use('direct');
    const d = App.tools.direct; d.sel = new Set();
    d.items = d.items.filter(it => {
      const m = Geo.toDoc(it.el); let any = false;
      it.subs.forEach(s => s.nodes.forEach(n => { if (inPolygon(poly, Geo.pt(m, n.x, n.y))) { d.sel.add(n); any = true; } }));
      return any;
    });
    Selection.draw();
  },
};

/* ---------- Tijeras (C): corta un trazado por un punto ---------- */
App.tools.scissors = {
  cursor: 'crosshair',
  down(p, ev, sp) {
    const cands = [...App.selection.flatMap(leafShapes).filter(editable)];
    let t = hitTarget(ev); if (t && editable(t) && !cands.includes(t)) cands.push(t);
    for (const el of cands) {
      const probe = { el, subs: PathData.parse(PathData.fromShape(el) || '') }, h = hitPath(probe, sp);
      if (!h || (h.kind !== 'segment' && h.kind !== 'anchor')) continue;
      const si = probe.subs.indexOf(h.sub), it = pathItem(el), s = it.subs[si];
      let k = h.kind === 'anchor' ? h.i : h.i + 1;
      if (h.kind === 'segment') { const a = s.nodes[h.i], b = s.nodes[(h.i + 1) % s.nodes.length]; s.nodes.splice(h.i + 1, 0, splitBez(a, b, h.t)); }
      const out = [it.el];
      if (s.closed) {
        const n = s.nodes, rot = [...n.slice(k), ...n.slice(0, k)], last = cloneNode(rot[0]);
        rot[0].hin = null; last.hout = null; s.nodes = [...rot, last]; s.closed = false;
      } else {
        if (k <= 0 || k >= s.nodes.length - 1) return;
        const a = s.nodes.slice(0, k + 1), b = [cloneNode(s.nodes[k]), ...s.nodes.slice(k + 1)];
        a[a.length - 1].hout = null; b[0].hin = null;
        s.nodes = a;
        const p2 = it.el.cloneNode(false); p2.id = uid(); p2.setAttribute('d', PathData.serialize([{ nodes: b, closed: false }]));
        it.el.after(p2); out.push(p2);
      }
      renderItem(it); Selection.set(out.map(e => Layers.topObject(e) || e)); History.commit(); App.emit('layers');
      return;
    }
  },
};

/* ---------- Cuchillo: corta formas rellenas a mano alzada ---------- */
App.tools.knife = {
  cursor: 'crosshair',
  down(p) { this.pts = [p]; },
  move(p) { if (this.pts) { this.pts.push(p); Selection.draw(); } },
  overlay(g) { if (this.pts) drawPolyline(g, this.pts, { 'stroke-width': 1.5 }); },
  up() {
    const pts = this.pts; this.pts = null; if (!pts || pts.length < 2) return;
    const cut = Boolean2D.op(strokePolygon([{ pts, closed: false }], 0.4 / Math.max(App.view.zoom, 0.2), 'round', 'butt'), { rings: [], rule: 'nonzero' }, 'union');
    const targets = (App.selection.length ? App.selection.flatMap(leafShapes) : visibleShapes()).filter(s => editable(s) && (getStyle(s, 'fill') || '#000') !== 'none');
    const out = []; let changed = false;
    for (const s of targets) {
      const poly = Boolean2D.fromSubs(pathSubsDoc(s).filter(x => x.closed), s.getAttribute('fill-rule') || 'nonzero');
      if (!poly.rings.length || !polysTouch(poly, cut)) continue;
      const res = Boolean2D.op(poly, cut, 'difference');
      /* separar en piezas: cada anillo exterior con los agujeros que contiene */
      const depth = r => res.rings.filter(o => o !== r && inPolygon(o, r[0])).length;
      const outer = res.rings.filter(r => depth(r) % 2 === 0), holes = res.rings.filter(r => depth(r) % 2 === 1);
      if (outer.length < 2) continue;
      const attrs = styleAttrs(s);
      for (const o of outer) {
        const mine = holes.filter(h => inPolygon(o, h[0]));
        const el = svgEl('path', { id: uid(), ...attrs, d: Boolean2D.toPath({ rings: [o, ...mine] }) });
        s.before(el); placeDocPath(el); out.push(el);
      }
      s.remove(); changed = true;
    }
    if (changed) { Selection.set(out); History.commit(); App.emit('layers'); }
    Selection.draw();
  },
};

/* ---------- Arco, espiral y cuadrículas ---------- */
const lineAttrs = () => ({ fill: 'none', stroke: App.stroke === 'none' ? '#000000' : App.stroke, 'stroke-width': App.strokeWidth });
App.tools.arc = dragShapeTool(r => svgEl('path', { ...lineAttrs(), d: arcD(r) }), {
  noConstrain: true,
  update(el, r) { el.setAttribute('d', arcD(r)); },
});
function arcD(r) {
  const { x0, y0, x1, y1 } = r, K = 0.5523;
  return PathData.serialize([{ closed: false, nodes: [
    { x: x0, y: y0, hin: null, hout: { x: x0, y: y0 + (y1 - y0) * K } },
    { x: x1, y: y1, hin: { x: x1 - (x1 - x0) * K, y: y1 }, hout: null }] }]);
}
App.spiralOpts = { decay: 80, segs: 10 };
App.tools.spiral = {
  cursor: 'crosshair',
  options: () => `Disminución <input type="number" id="optDecay" min="5" max="99" value="${App.spiralOpts.decay}">% Segmentos <input type="number" id="optSegs" min="2" max="200" value="${App.spiralOpts.segs}">`,
  bindOptions() { $('optDecay').oninput = e => App.spiralOpts.decay = clamp(+e.target.value, 5, 99); $('optSegs').oninput = e => App.spiralOpts.segs = clamp(Math.round(+e.target.value), 2, 200); },
  down(p, ev) { SmartGuides.prepare(); this.c = snapPt(p, ev); this.el = null; SmartGuides.clear(); },
  move(p) {
    if (!this.c) return;
    const R = Geo.dist(p, this.c); if (R < 2) return;
    const d = spiralD(this.c, R, Math.atan2(p.y - this.c.y, p.x - this.c.x), App.spiralOpts.decay / 100, App.spiralOpts.segs);
    if (!this.el) { this.el = addObject(svgEl('path', { ...lineAttrs(), d })); if (!this.el) { this.c = null; return; } }
    else this.el.setAttribute('d', d);
    Selection.set([this.el]);
  },
  up() { if (this.el) History.commit(); this.c = null; this.el = null; },
};
function spiralD(c, R, a0, decay, segs) {
  const q = Math.PI / 2, k = Math.log(decay) / q, nodes = [];
  const P = th => { const r = R * Math.exp(k * th); return { x: c.x + r * Math.cos(a0 + th), y: c.y + r * Math.sin(a0 + th) }; };
  const D = th => { const r = R * Math.exp(k * th), a = a0 + th; return { x: r * (k * Math.cos(a) - Math.sin(a)), y: r * (k * Math.sin(a) + Math.cos(a)) }; };
  for (let i = 0; i <= segs; i++) {
    const th = i * q, p = P(th), d = D(th), f = q / 3;
    nodes.push({ x: p.x, y: p.y, hin: i ? { x: p.x - d.x * f, y: p.y - d.y * f } : null, hout: i < segs ? { x: p.x + d.x * f, y: p.y + d.y * f } : null });
  }
  return PathData.serialize([{ nodes, closed: false }]);
}
App.gridOpts = { rows: 5, cols: 5, rings: 5, rays: 6 };
function buildRectGrid(g, r) {
  g.innerHTML = ''; const a = lineAttrs(), { rows, cols } = App.gridOpts;
  svgEl('rect', { ...a, x: round(r.x, 2), y: round(r.y, 2), width: round(r.w, 2), height: round(r.h, 2) }, g);
  for (let i = 1; i < rows; i++) { const y = round(r.y + r.h * i / rows, 2); svgEl('line', { ...a, x1: round(r.x, 2), y1: y, x2: round(r.x + r.w, 2), y2: y }, g); }
  for (let i = 1; i < cols; i++) { const x = round(r.x + r.w * i / cols, 2); svgEl('line', { ...a, x1: x, y1: round(r.y, 2), x2: x, y2: round(r.y + r.h, 2) }, g); }
}
function buildPolarGrid(g, r) {
  g.innerHTML = ''; const a = lineAttrs(), { rings, rays } = App.gridOpts, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  for (let i = rings; i >= 1; i--) svgEl('ellipse', { ...a, cx: round(cx, 2), cy: round(cy, 2), rx: round(r.w / 2 * i / rings, 2), ry: round(r.h / 2 * i / rings, 2) }, g);
  for (let i = 0; i < rays; i++) { const t = -Math.PI / 2 + i * 2 * Math.PI / rays;
    svgEl('line', { ...a, x1: round(cx, 2), y1: round(cy, 2), x2: round(cx + Math.cos(t) * r.w / 2, 2), y2: round(cy + Math.sin(t) * r.h / 2, 2) }, g); }
}
App.tools.rgrid = dragShapeTool(r => { const g = svgEl('g', { 'data-name': '<Cuadrícula>' }); buildRectGrid(g, r); return g; }, {
  update: buildRectGrid,
  options: () => `Filas <input type="number" id="optRows" min="1" max="100" value="${App.gridOpts.rows}"> Columnas <input type="number" id="optCols" min="1" max="100" value="${App.gridOpts.cols}">`,
  bindOptions() { $('optRows').oninput = e => App.gridOpts.rows = clamp(Math.round(+e.target.value), 1, 100); $('optCols').oninput = e => App.gridOpts.cols = clamp(Math.round(+e.target.value), 1, 100); },
});
App.tools.pgrid = dragShapeTool(r => { const g = svgEl('g', { 'data-name': '<Cuadrícula polar>' }); buildPolarGrid(g, r); return g; }, {
  update: buildPolarGrid,
  options: () => `Círculos <input type="number" id="optRings" min="1" max="50" value="${App.gridOpts.rings}"> Radios <input type="number" id="optRays" min="0" max="100" value="${App.gridOpts.rays}">`,
  bindOptions() { $('optRings').oninput = e => App.gridOpts.rings = clamp(Math.round(+e.target.value), 1, 50); $('optRays').oninput = e => App.gridOpts.rays = clamp(Math.round(+e.target.value), 0, 100); },
});

/* ---------- Reflejar (O) y Distorsionar: arrastrar o clic para el diálogo ---------- */
function liveTransformTool(build, dialog) {
  return {
    cursor: 'crosshair',
    down(p, ev) {
      if (!App.selection.length) { const o = hitObject(ev); if (o) Selection.set([o]); return; }
      const els = App.selection.filter(e => !Layers.isLocked(e)), b = Geo.selBox(els);
      this.s = { p0: p, els, orig: els.map(e => e.getAttribute('transform')), c: { x: b.x + b.width / 2, y: b.y + b.height / 2 }, moved: false };
    },
    move(p, ev) {
      const s = this.s; if (!s || Geo.dist(p, s.p0) * App.view.zoom < 3) return;
      s.moved = true; s.els.forEach((e, i) => s.orig[i] == null ? e.removeAttribute('transform') : e.setAttribute('transform', s.orig[i]));
      s.M = build(s, p, ev); s.els.forEach(e => Geo.applyDoc(e, s.M)); Selection.draw();
    },
    up() {
      const s = this.s; this.s = null; if (!s) return;
      if (!s.moved) return dialog();
      s.els.forEach(normalizeTransform); App.lastTransform = { matrix: s.M, duplicate: false }; History.commit(); Selection.changed();
    },
  };
}
const reflectAbout = (c, deg) => new DOMMatrix().translate(c.x, c.y).rotate(deg).scale(1, -1).rotate(-deg).translate(-c.x, -c.y);
App.tools.reflect = liveTransformTool((s, p, ev) => {
  let a = Math.atan2(p.y - s.c.y, p.x - s.c.x) * 180 / Math.PI; if (ev.shiftKey) a = Math.round(a / 45) * 45;
  return reflectAbout(s.c, a);
}, () => Actions.reflectDialog());
const shearMatrix = (c, kx, ky) => new DOMMatrix().translate(c.x, c.y).multiply(new DOMMatrix([1, ky, kx, 1, 0, 0])).translate(-c.x, -c.y);
App.tools.shear = liveTransformTool((s, p, ev) => {
  const dx = p.x - s.p0.x, dy = p.y - s.p0.y;
  return Math.abs(dx) >= Math.abs(dy) || ev.shiftKey ? shearMatrix(s.c, dx / ((s.p0.y - s.c.y) || 1), 0) : shearMatrix(s.c, 0, dy / ((s.p0.x - s.c.x) || 1));
}, () => Actions.shearDialog());
Object.assign(Actions, {
  reflectDialog() {
    const c = this.center(); if (!c) return;
    Dialog.transform('Reflejar', [
      { id: 'axis', label: 'Eje', type: 'select', value: 'v', options: [['v', 'Vertical'], ['h', 'Horizontal'], ['a', 'Ángulo']] },
      { id: 'ang', label: 'Ángulo (°)', type: 'number', value: 45, show: v => v.axis === 'a' },
    ], v => reflectAbout(c, v.axis === 'h' ? 0 : v.axis === 'v' ? 90 : +v.ang || 0));
  },
  shearDialog() {
    const c = this.center(); if (!c) return;
    Dialog.transform('Distorsionar', [
      { id: 'ang', label: 'Ángulo (°)', type: 'number', value: 20, min: -85, max: 85 },
      { id: 'axis', label: 'Eje', type: 'select', value: 'h', options: [['h', 'Horizontal'], ['v', 'Vertical']] },
    ], v => { const k = Math.tan(clamp(+v.ang || 0, -85, 85) * Math.PI / 180); return v.axis === 'h' ? shearMatrix(c, k, 0) : shearMatrix(c, 0, k); });
  },
});

/* ---------- Pincel (B) ---------- */
App.brushSize = 4;
App.tools.brush = Object.assign(Object.create(App.tools.pencil), {
  options() { return `Grosor <input type="number" id="optBrush" min="0.1" step="0.5" value="${App.brushSize}"> Suavizado <input type="range" id="optSmooth" min="0.5" max="10" step="0.5" value="${this.smooth}">`; },
  bindOptions() { $('optBrush').oninput = e => App.brushSize = Math.max(0.1, +e.target.value); $('optSmooth').oninput = e => this.smooth = +e.target.value; },
  down(p) {
    App.tools.pencil.down.call(this, p);
    if (this.el) { this.el.setAttribute('stroke-width', App.brushSize); this.el.setAttribute('stroke-linecap', 'round'); this.el.setAttribute('stroke-linejoin', 'round'); }
  },
});

/* ---------- Pincel de manchas (Mayús+B): pinta formas rellenas que se fusionan ---------- */
App.blobSize = 16;
App.tools.blob = {
  cursor: 'crosshair',
  options: () => `Tamaño <input type="number" id="optBlob" min="1" value="${App.blobSize}"> px`,
  bindOptions() { $('optBlob').oninput = e => App.blobSize = Math.max(1, +e.target.value); },
  color() { return App.stroke !== 'none' && App.stroke.startsWith('#') ? App.stroke : App.fill.startsWith('#') ? App.fill : '#000000'; },
  down(p) { this.pts = [p]; },
  move(p) { if (!this.pts) return; if (Geo.dist(p, this.pts[this.pts.length - 1]) * App.view.zoom > 1.5) this.pts.push(p); Selection.draw(); },
  hover(p) { this.cursorPt = p; Selection.draw(); },
  overlay(g) {
    const w = App.blobSize * App.view.zoom;
    if (this.pts) drawPolyline(g, this.pts.length > 1 ? this.pts : [this.pts[0], this.pts[0]], { stroke: this.color(), 'stroke-opacity': .6, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    else if (this.cursorPt) { const s = View.docToStage(this.cursorPt.x, this.cursorPt.y); svgEl('circle', { cx: s.x, cy: s.y, r: w / 2, fill: 'none', stroke: '#1e90ff' }, g); }
  },
  up() {
    const pts = this.pts; this.pts = null; if (!pts) return;
    if (pts.length === 1) pts.push({ x: pts[0].x + 0.01, y: pts[0].y });
    const color = this.color(), layer = Layers.ensure(); if (Layers.isLocked(layer)) return;
    let poly = Boolean2D.op(strokePolygon([{ pts, closed: false }], App.blobSize / 2, 'round', 'round'), { rings: [], rule: 'nonzero' }, 'union');
    /* fusionar con manchas del mismo color que toca */
    const mates = [...layer.children].filter(o => o.tagName === 'path' && o.hasAttribute('data-blob') && normColor(o.getAttribute('fill')) === normColor(color));
    for (const m of mates) {
      const mp = Boolean2D.fromSubs(pathSubsDoc(m));
      if (polysTouch(mp, poly)) { poly = Boolean2D.op(poly, mp, 'union'); m.remove(); }
    }
    /* contorno simplificado sin suavizar: suavizar con curvas puede crear bucles que estropean las uniones siguientes */
    const subs = poly.rings.map(r => ({ nodes: rdpClosed(r.map(p => ({ x: p.x, y: p.y })), 0.2).map(p => ({ x: p.x, y: p.y, hin: null, hout: null })), closed: true }));
    const el = addObject(svgEl('path', { fill: color, stroke: 'none', 'data-blob': '1', d: PathData.serialize(subs) }));
    if (el) { placeDocPath(el); Selection.set([el]); History.commit(); }
  },
};

/* ---------- Fusión (W): formas y colores intermedios ---------- */
App.blendSteps = 6;
const Blend = {
  /* N puntos equidistantes a lo largo del primer subtrazado de una forma */
  sample(el, N) {
    const subs = pathSubsDoc(el); if (!subs.length) return null;
    const s = subs.reduce((a, b) => (b.nodes.length > a.nodes.length ? b : a));
    const pts = Boolean2D.flatten(s).map(p => ({ x: p.x, y: p.y })); if (s.closed) pts.push(pts[0]);
    const len = [0]; for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Geo.dist(pts[i - 1], pts[i]));
    const total = len[len.length - 1] || 1, out = [];
    for (let k = 0; k < N; k++) {
      const d = total * k / (s.closed ? N : N - 1); let i = 1; while (i < len.length - 1 && len[i] < d) i++;
      const t = (d - len[i - 1]) / ((len[i] - len[i - 1]) || 1);
      out.push({ x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t });
    }
    return { pts: out, closed: s.closed };
  },
  lerpColor(a, b, t) {
    a = normColor(a || 'none'); b = normColor(b || 'none');
    if (!a.startsWith('#') || !b.startsWith('#')) return t < 0.5 ? a : b;
    const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
  },
  between(A, B, steps) {
    const N = 48, sa = this.sample(A, N), sb = this.sample(B, N); if (!sa || !sb) return [];
    let pb = sb.pts;
    if (sa.closed && sb.closed) {
      if (Math.sign(signedArea(sa.pts)) !== Math.sign(signedArea(pb))) pb = [...pb].reverse();
      const ca = sa.pts.reduce((c, p) => ({ x: c.x + p.x / N, y: c.y + p.y / N }), { x: 0, y: 0 }), cb = pb.reduce((c, p) => ({ x: c.x + p.x / N, y: c.y + p.y / N }), { x: 0, y: 0 });
      let best = 0, bd = Infinity;
      for (let o = 0; o < N; o++) {
        let d = 0; for (let i = 0; i < N; i++) { const p = sa.pts[i], q = pb[(i + o) % N]; d += (p.x - ca.x - q.x + cb.x) ** 2 + (p.y - ca.y - q.y + cb.y) ** 2; }
        if (d < bd) { bd = d; best = o; }
      }
      pb = pb.map((_, i) => pb[(i + best) % N]);
    }
    const out = [], num = k => +(getStyle(A, k) ?? 1), numB = k => +(getStyle(B, k) ?? 1);
    for (let i = 1; i <= steps; i++) {
      const t = i / (steps + 1), pts = sa.pts.map((p, j) => ({ x: p.x + (pb[j].x - p.x) * t, y: p.y + (pb[j].y - p.y) * t }));
      const closed = sa.closed && sb.closed;
      out.push(svgEl('path', {
        id: uid(), 'data-blend-step': '1', d: PathData.serialize([{ nodes: smoothNodes(pts, closed), closed }]),
        fill: this.lerpColor(getStyle(A, 'fill'), getStyle(B, 'fill'), t), stroke: this.lerpColor(getStyle(A, 'stroke'), getStyle(B, 'stroke'), t),
        'stroke-width': round(+(getStyle(A, 'stroke-width') || 1) + (+(getStyle(B, 'stroke-width') || 1) - +(getStyle(A, 'stroke-width') || 1)) * t, 3),
        opacity: round(num('opacity') + (numB('opacity') - num('opacity')) * t, 3),
      }));
    }
    return out;
  },
  make(objs, steps = App.blendSteps) {
    objs = docOrder(objs).filter(o => leafShapes(o).some(isShape));
    if (objs.length < 2) return Dialog.alert('Selecciona al menos dos formas para crear una fusión.');
    const g = svgEl('g', { id: uid(), 'data-blend': steps, 'data-name': '<Fusión>' }); objs[objs.length - 1].after(g);
    objs.forEach(o => { const m = Geo.toDoc(o); g.appendChild(o); Geo.setMatrix(o, Geo.toDoc(g).inverse().multiply(m)); });
    this.rebuild(g); Selection.set([g]); History.commit(); App.emit('layers');
  },
  rebuild(g) {
    g.querySelectorAll(':scope > [data-blend-step]').forEach(e => e.remove());
    const keys = [...g.children], steps = +g.getAttribute('data-blend') || App.blendSteps;
    for (let i = 0; i + 1 < keys.length; i++) {
      const A = leafShapes(keys[i]).find(isShape), B = leafShapes(keys[i + 1]).find(isShape);
      for (const s of this.between(A, B, steps)) { keys[i + 1].before(s); placeDocPath(s); }
    }
  },
  selected() { return App.selection.filter(e => e.hasAttribute('data-blend')); },
  release() { for (const g of this.selected()) { g.querySelectorAll(':scope > [data-blend-step]').forEach(e => e.remove()); g.removeAttribute('data-blend'); } Selection.set(App.selection); Actions.ungroup(); },
  expand() { for (const g of this.selected()) { g.removeAttribute('data-blend'); g.querySelectorAll('[data-blend-step]').forEach(e => e.removeAttribute('data-blend-step')); g.setAttribute('data-name', '<Grupo>'); } History.commit(); App.emit('layers'); },
  async options() {
    const v = await Dialog.form('Opciones de fusión', [{ id: 'n', label: 'Pasos especificados', type: 'number', value: App.blendSteps, min: 1, max: 500 }]);
    if (!v) return; App.blendSteps = clamp(Math.round(+v.n), 1, 500);
    const gs = this.selected(); gs.forEach(g => { g.setAttribute('data-blend', App.blendSteps); this.rebuild(g); });
    if (gs.length) History.commit();
  },
};
App.tools.blend = {
  cursor: 'crosshair',
  options: () => `Pasos <input type="number" id="optSteps" min="1" max="500" value="${App.blendSteps}"> <span style="color:#888">Haz clic en un objeto y después en otro</span>`,
  bindOptions() { $('optSteps').oninput = e => App.blendSteps = clamp(Math.round(+e.target.value), 1, 500); },
  activate() { this.first = null; },
  down(p, ev) {
    const o = hitObject(ev); if (!o) return;
    if (!this.first || this.first === o || !this.first.isConnected) { this.first = o; Selection.set([o]); $('sbHint').textContent = 'Fusión: haz clic en el segundo objeto'; return; }
    $('sbHint').textContent = ''; const a = this.first; this.first = null; Blend.make([a, o]);
  },
};
