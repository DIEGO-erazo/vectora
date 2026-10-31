/* Vectora — Creador de formas (Mayús+M): divide las formas seleccionadas en regiones;
   arrastrar sobre varias las fusiona, Alt+clic las elimina. Conserva las curvas. */
'use strict';

ICONS.builder = '<rect x="3" y="3" width="11" height="11"/><circle cx="14.5" cy="14.5" r="6"/><path d="M19 3v5M16.5 5.5h5"/>';

const Faces = {
  /* regiones planas que forman las formas: [{ring, area, pt, owners}] */
  build(shapes) {
    const polys = shapes.map(s => Boolean2D.fromSubs(pathSubsDoc(s), s.getAttribute('fill-rule') || 'nonzero'));
    const segs = [];
    polys.forEach(P => P.rings.forEach(r => r.forEach((a, i) => {
      const b = r[(i + 1) % r.length];
      if (a.x !== b.x || a.y !== b.y) segs.push({ a, b, src: a.src || null, t0: a.t || 0, t1: a.te == null ? 1 : a.te, cuts: [] });
    })));
    Boolean2D.split(segs);
    /* vértices soldados */
    const grid = new Map(), EPS = 1e-3; let nid = 0;
    const weld = p => {
      const gx = Math.round(p.x / EPS), gy = Math.round(p.y / EPS);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
        for (const c of grid.get((gx + dx) + ',' + (gy + dy)) || []) if (Math.abs(c.x - p.x) <= EPS && Math.abs(c.y - p.y) <= EPS) return c;
      const c = { x: p.x, y: p.y, id: nid++, out: [] }, k = gx + ',' + gy; (grid.get(k) || grid.set(k, []).get(k)).push(c); return c;
    };
    /* aristas únicas -> medias aristas en ambos sentidos */
    const seen = new Set();
    for (const s of segs) {
      const cuts = [{ t: 0, p: s.a }, ...s.cuts, { t: 1, p: s.b }].sort((x, y) => x.t - y.t), T = u => s.t0 + u * (s.t1 - s.t0);
      for (let i = 0; i + 1 < cuts.length; i++) {
        const a = weld(cuts[i].p), b = weld(cuts[i + 1].p); if (a === b) continue;
        const key = a.id < b.id ? a.id + '-' + b.id : b.id + '-' + a.id; if (seen.has(key)) continue; seen.add(key);
        const h1 = { from: a, to: b, src: s.src, ta: T(cuts[i].t), tb: T(cuts[i + 1].t) }, h2 = { from: b, to: a, src: s.src, ta: h1.tb, tb: h1.ta };
        h1.twin = h2; h2.twin = h1; a.out.push(h1); b.out.push(h2);
      }
    }
    const verts = [...grid.values()].flat();
    for (const v of verts) { for (const h of v.out) h.ang = Math.atan2(h.to.y - v.y, h.to.x - v.x); v.out.sort((p, q) => p.ang - q.ang); }
    /* recorrer caras: la siguiente arista es la anterior (en ángulo) a la gemela */
    const next = h => { const L = h.to.out, i = L.indexOf(h.twin); return L[(i - 1 + L.length) % L.length]; };
    const faces = [];
    for (const v of verts) for (const h0 of v.out) {
      if (h0.used) continue;
      const ring = []; let h = h0, guard = 0;
      do { h.used = true; ring.push({ x: h.from.x, y: h.from.y, src: h.src, t: h.ta, te: h.tb }); h = next(h); } while (h && h !== h0 && !h.used && guard++ < 1e5);
      if (h !== h0 || ring.length < 3) continue;
      const area = signedArea(ring);
      faces.push({ ring, area });
    }
    /* caras acotadas: punto interior y formas que la contienen */
    const bounded = [];
    for (const f of faces) {
      const pt = this.interior(f.ring); if (!pt) continue;
      const owners = polys.map((P, i) => (Boolean2D.inside(P, pt) ? i : -1)).filter(i => i >= 0);
      if (!owners.length) continue; /* exterior o agujero */
      bounded.push({ ...f, pt, owners, top: Math.max(...owners) });
    }
    /* los ciclos de orientación contraria son contornos exteriores o agujeros:
       cada agujero se asigna a la región más pequeña que lo rodea (p. ej. un anillo) */
    const sign = Math.sign(bounded.reduce((s, f) => s + Math.sign(f.area), 0)) || 1;
    const regions = bounded.filter(f => Math.sign(f.area) === sign).map(f => ({ ...f, holes: [] }));
    for (const c of faces) {
      if (Math.sign(c.area) === sign) continue;
      const p = this.outside(c.ring); if (!p) continue;
      let host = null;
      for (const f of regions) if (this.contains(f, p) && (!host || Math.abs(f.area) < Math.abs(host.area))) host = f;
      if (host) host.holes.push(c.ring);
    }
    return regions;
  },
  /* ¿el punto está en la región (dentro del contorno y fuera de sus agujeros)? */
  contains(f, p) { return inPolygon(f.ring, p) && !(f.holes || []).some(h => inPolygon(h, p)); },
  rings(f) { return [f.ring, ...(f.holes || [])]; },
  /* un punto justo fuera del anillo, junto a su arista más larga */
  outside(r) {
    let best = null;
    for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length], L = Geo.dist(a, b); if (!best || L > best.L) best = { a, b, L }; }
    if (!best || best.L < 1e-6) return null;
    const m = { x: (best.a.x + best.b.x) / 2, y: (best.a.y + best.b.y) / 2 }, nx = -(best.b.y - best.a.y) / best.L, ny = (best.b.x - best.a.x) / best.L;
    for (const e of [0.02, 0.2]) for (const s of [1, -1]) { const p = { x: m.x + nx * e * s, y: m.y + ny * e * s }; if (!inPolygon(r, p)) return p; }
    return null;
  },
  /* un punto dentro del anillo, junto a su arista más larga */
  interior(r) {
    let best = null;
    for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length], L = Geo.dist(a, b); if (!best || L > best.L) best = { a, b, L }; }
    if (!best || best.L < 1e-6) return null;
    const m = { x: (best.a.x + best.b.x) / 2, y: (best.a.y + best.b.y) / 2 }, nx = -(best.b.y - best.a.y) / best.L, ny = (best.b.x - best.a.x) / best.L;
    for (const e of [0.02, 0.2, 1]) for (const s of [1, -1]) { const p = { x: m.x + nx * e * s, y: m.y + ny * e * s }; if (inPolygon(r, p)) return p; }
    return null;
  },
};

App.tools.builder = {
  cursor: 'crosshair',
  activate() { this.refresh(); },
  shapes() { return App.selection.flatMap(e => (e.tagName === 'g' ? leafShapes(e) : [e])).filter(s => isShape(s) && !Layers.isLocked(s)); },
  refresh() {
    this.src = this.shapes(); this.F = this.src.length ? Faces.build(this.src) : [];
    $('sbHint').textContent = this.src.length ? `Creador de formas: ${this.F.length} regiones · arrastra para unir, Alt+clic para eliminar` : 'Creador de formas: selecciona primero las formas';
  },
  faceAt(p) {
    let best = null;
    for (const f of this.F || []) if (Faces.contains(f, p) && (!best || Math.abs(f.area) < Math.abs(best.area))) best = f;
    return best;
  },
  hover(p) { this.hot = this.faceAt(p); Selection.draw(); },
  down(p, ev) {
    if (!this.F || !this.F.length) { const o = hitObject(ev); if (o) { Selection.set([o]); this.refresh(); } return; }
    const f = this.faceAt(p); if (!f) return;
    this.drag = { set: new Set([f]), erase: ev.altKey, path: [p] };
  },
  move(p) {
    if (!this.drag) return;
    const f = this.faceAt(p); if (f) this.drag.set.add(f);
    this.drag.path.push(p); this.hot = f; Selection.draw();
  },
  up() {
    const d = this.drag; this.drag = null; if (!d) return;
    const shapes = this.src, F = this.F, anchor = docOrder(shapes).pop();
    const styleOf = f => styleAttrs(shapes[f.top]), made = [];
    const emit = (rings, attrs) => {
      const el = svgEl('path', { id: uid(), ...attrs, d: Boolean2D.toPath({ rings }) }); anchor.after(el); placeDocPath(el); made.push(el);
    };
    /* regiones elegidas: unir (o eliminar con Alt); el resto quedan separadas */
    if (!d.erase) {
      const chosen = [...d.set];
      const merged = chosen.slice(1).reduce((acc, f) => Boolean2D.op(acc, { rings: Faces.rings(f), rule: 'nonzero' }, 'union'), { rings: Faces.rings(chosen[0]), rule: 'nonzero' });
      emit(merged.rings, styleOf(chosen[0]));
    }
    for (const f of F) if (!d.set.has(f)) emit(Faces.rings(f), styleOf(f));
    shapes.forEach(s => s.remove());
    Selection.set(made.filter(e => e.isConnected)); History.named('Creador de formas', () => History.commit()); App.emit('layers');
    this.refresh(); Selection.draw();
  },
  overlay(g) {
    const ringD = r => 'M' + r.map(q => { const s = View.docToStage(q.x, q.y); return `${s.x} ${s.y}`; }).join('L') + 'Z';
    const draw = (f, fill) => svgEl('path', { d: Faces.rings(f).map(ringD).join(' '), 'fill-rule': 'evenodd', fill, stroke: '#1e90ff', 'stroke-dasharray': '3 2' }, g);
    if (this.drag) { for (const f of this.drag.set) draw(f, this.drag.erase ? 'rgba(229,51,42,.35)' : 'rgba(30,144,255,.3)'); drawPolyline(g, this.drag.path, { stroke: this.drag.erase ? '#e5332a' : '#1e90ff' }); }
    else if (this.hot) draw(this.hot, 'rgba(160,160,160,.35)');
  },
  deactivate() { this.F = null; this.hot = null; $('sbHint').textContent = ''; },
};
