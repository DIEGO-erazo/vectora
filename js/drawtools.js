/* Vectora — más herramientas de dibujo: Curvatura, Suavizar, Borrador de trazados, Unir,
   Transformación libre (distorsión libre y perspectiva) y Pintura interactiva */
'use strict';

Object.assign(ICONS, {
  curvature: '<path d="M4 18C6 8 12 6 20 6"/><circle cx="4" cy="18" r="1.6"/><circle cx="11" cy="9" r="1.6"/><circle cx="20" cy="6" r="1.6"/>',
  smooth: '<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M3 9c3-3 5 3 8 0" stroke-dasharray="2 1.5"/>',
  patheraser: '<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4"/><path d="M2 21h7" stroke-dasharray="2 2"/>',
  join: '<path d="M4 18c4 0 5-6 8-6s4 6 8 6"/><path d="M9 6l3 3 3-3"/>',
  freetransform: '<path d="M5 7l14-3-2 16-11-2z" stroke-dasharray="2 1.5"/><rect x="3.5" y="5.5" width="3" height="3"/><rect x="17.5" y="2.5" width="3" height="3"/><rect x="15.5" y="18.5" width="3" height="3"/><rect x="4.5" y="16.5" width="3" height="3"/>',
  livepaint: '<path d="M5 11l7-7 7 7-7 7z"/><path d="M19 13c1 2 2 3 2 4a2 2 0 0 1-4 0c0-1 1-2 2-4z"/>',
});
Object.assign(TOOL_INFO, {
  curvature: ['Curvatura', 'Mayús+`'], smooth: ['Suavizar', ''], patheraser: ['Borrador de trazados', ''], join: ['Unir', ''],
  freetransform: ['Transformación libre', 'E'], livepaint: ['Bote de pintura interactiva', 'K'],
});
/* añadir a los grupos de la barra */
(() => {
  const at = id => TOOL_GROUPS.find(g => Array.isArray(g) && g.includes(id));
  at('pen').push('curvature'); at('pencil').push('smooth', 'patheraser', 'join');
  at('scale').push('freetransform'); at('builder').push('livepaint');
})();

/* distancia de un punto a una polilínea */
function distToPolyline(q, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)], dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
    const t = L2 ? clamp(((q.x - a.x) * dx + (q.y - a.y) * dy) / L2, 0, 1) : 0;
    best = Math.min(best, Math.hypot(q.x - a.x - dx * t, q.y - a.y - dy * t));
  }
  return best;
}
/* tramo de la Bézier a→b entre t0 y t1, como dos nodos con manejadores */
function bezPart(a, b, t0, t1) {
  let A = { x: a.x, y: a.y, hin: null, hout: a.hout && { ...a.hout } }, B = { x: b.x, y: b.y, hin: b.hin && { ...b.hin }, hout: null };
  if (t1 < 1) { const m = splitBez(A, B, t1); B = { x: m.x, y: m.y, hin: m.hin, hout: null }; }
  if (t0 > 0) { const m = splitBez(A, B, t0 / t1); A = { x: m.x, y: m.y, hin: null, hout: m.hout }; }
  return [A, B];
}
/* herramienta de pincel genérica: recoge el recorrido y dibuja el círculo del tamaño */
const strokeToolBase = (sizeKey, def) => ({
  cursor: 'crosshair',
  options() { return `Tamaño <input type="number" id="optTS" min="1" value="${App[sizeKey] ?? def}"> px`; },
  bindOptions() { $('optTS').oninput = e => App[sizeKey] = Math.max(1, +e.target.value); },
  size() { return (App[sizeKey] ?? def) / App.view.zoom; },
  down(p) { this.pts = [p]; },
  move(p) { if (!this.pts) return; if (Geo.dist(p, this.pts[this.pts.length - 1]) * App.view.zoom > 2) this.pts.push(p); Selection.draw(); },
  hover(p) { this.cursorPt = p; Selection.draw(); },
  overlay(g) {
    const w = (App[sizeKey] ?? def);
    if (this.pts) drawPolyline(g, this.pts.length > 1 ? this.pts : [this.pts[0], this.pts[0]], { stroke: 'rgba(30,144,255,.35)', 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    else if (this.cursorPt) { const s = View.docToStage(this.cursorPt.x, this.cursorPt.y); svgEl('circle', { cx: s.x, cy: s.y, r: w / 2, fill: 'none', stroke: '#1e90ff' }, g); }
  },
  targets() { return App.selection.flatMap(e => (e.tagName === 'g' ? leafShapes(e) : [e])).filter(s => isShape(s) && !Layers.isLocked(s)); },
});

/* ---------- Curvatura (Mayús+`): cada clic añade un punto y la curva pasa por todos ---------- */
App.tools.curvature = {
  cursor: 'crosshair',
  render(extra) {
    if (!this.el) return;
    const pts = extra ? [...this.pts, extra] : this.pts, nodes = smoothNodes(pts, this.closed);
    pts.forEach((p, i) => { if (p.corner) { nodes[i].hin = nodes[i].hout = null; } });
    this.el.setAttribute('d', PathData.serialize([{ nodes, closed: !!this.closed }]));
  },
  down(p, ev) {
    p = snapPt(p, ev); const z = App.view.zoom;
    if (!this.pts) {
      this.pts = [{ ...p }]; this.closed = false;
      this.el = addObject(svgEl('path', { ...newShapeAttrs(), d: `M${p.x} ${p.y}` })); return;
    }
    const last = this.pts[this.pts.length - 1];
    if (Geo.dist(p, last) * z < 4) { last.corner = !last.corner; this.render(); return; } /* doble clic: vértice */
    if (this.pts.length > 2 && Geo.dist(p, this.pts[0]) * z < 8) { this.closed = true; this.finish(); return; }
    this.pts.push({ ...p, corner: ev.altKey }); this.render();
  },
  hover(p) { if (this.pts) { this.render(p); Selection.draw(); } this.cur = p; },
  overlay(g) {
    if (!this.pts) return;
    for (const p of this.pts) { const s = View.docToStage(p.x, p.y); p.corner ? overlayAnchor(g, s, true) : svgEl('circle', { cx: s.x, cy: s.y, r: 3.5, fill: '#fff', stroke: '#1e90ff' }, g); }
  },
  key(ev) { if (this.pts && (ev.key === 'Enter' || ev.key === 'Escape')) { this.finish(); return true; } return false; },
  finish() {
    const el = this.el; this.render(); this.el = null; const pts = this.pts; this.pts = null;
    if (!el) return;
    if (!pts || pts.length < 2) { el.remove(); Selection.draw(); return; }
    Selection.set([el]); History.named('Curvatura', () => History.commit()); App.emit('layers');
  },
  deactivate() { if (this.pts) this.finish(); },
};

/* ---------- Suavizar: alisa la parte del trazado seleccionado por la que se pasa ---------- */
function sampleChain(chain, S) {
  const pts = [];
  for (let i = 0; i + 1 < chain.length; i++) for (let s = 0; s < S; s++) pts.push(bez(chain[i], chain[i + 1], s / S));
  pts.push({ x: chain[chain.length - 1].x, y: chain[chain.length - 1].y }); return pts;
}
/* remuestrea a paso fijo y aplica una media móvil (los extremos no se mueven) */
function relax(pts, step) {
  const R = [pts[0]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) { acc += Geo.dist(pts[i - 1], pts[i]); if (acc >= step) { R.push(pts[i]); acc = 0; } }
  if (R[R.length - 1] !== pts[pts.length - 1]) R.push(pts[pts.length - 1]);
  for (let pass = 0; pass < 2; pass++) {
    const src = R.map(q => ({ ...q }));
    for (let i = 1; i < R.length - 1; i++) {
      const w = Math.min(4, i, R.length - 1 - i); let x = 0, y = 0;
      for (let k = -w; k <= w; k++) { x += src[i + k].x; y += src[i + k].y; }
      R[i] = { x: x / (2 * w + 1), y: y / (2 * w + 1) };
    }
  }
  return R;
}
function smoothSub(sub, inR, tol, step) {
  const N = sub.nodes, n = N.length, closed = sub.closed;
  const mark = N.map((q, i) => inR(q) && (closed || (i > 0 && i < n - 1)));
  if (!mark.some(Boolean) || n < 3) return null;
  if (mark.every(Boolean)) {
    const pts = relax(sampleChain(closed ? [...N, N[0]] : N, 20), step); if (closed) pts.pop();
    const simp = closed ? rdpClosed(pts, tol) : rdp(pts, tol); return { nodes: smoothNodes(simp, closed), closed };
  }
  const start = closed ? mark.findIndex(m => !m) : 0, order = [...Array(n)].map((_, k) => (start + k) % n), out = [];
  let pendingHin = null;
  for (let k = 0; k < n;) {
    const i = order[k];
    if (!mark[i]) { const c = { ...N[i] }; if (pendingHin) { c.hin = pendingHin; pendingHin = null; } out.push(c); k++; continue; }
    let j = k; while (j < n && mark[order[j]]) j++;
    const Bi = j < n ? order[j] : order[0], A = out[out.length - 1], B = N[Bi];
    const chain = [N[order[k - 1]], ...order.slice(k, j).map(x => N[x]), B];
    const simp = rdp(relax(sampleChain(chain, 20), step), tol), nodes = smoothNodes(simp, false);
    A.hout = { x: A.x + (simp[1].x - A.x) / 3, y: A.y + (simp[1].y - A.y) / 3 };
    const hin = { x: B.x + (simp[simp.length - 2].x - B.x) / 3, y: B.y + (simp[simp.length - 2].y - B.y) / 3 };
    out.push(...nodes.slice(1, -1));
    if (j < n) pendingHin = hin; else out[0].hin = hin;
    k = j;
  }
  return { nodes: out, closed };
}
App.smoothSize = 24;
App.tools.smooth = Object.assign(strokeToolBase('smoothSize', 24), {
  up() {
    const pts = this.pts; this.pts = null; if (!pts) return;
    const r = this.size() / 2, tol = Math.max(1 / App.view.zoom, r * 0.12), made = [];
    const ts = this.targets(); if (!ts.length) { $('sbHint').textContent = 'Suavizar: selecciona primero un trazado'; Selection.draw(); return; }
    for (const s of ts) {
      const subs = pathSubsDoc(s); let changed = false;
      const out = subs.map(sub => { const o = smoothSub(sub, q => distToPolyline(q, pts) <= r, tol, r / 8); if (o) changed = true; return o || sub; });
      made.push(changed ? replaceWithPath(s, out, styleAttrs(s)) : s);
    }
    Selection.set(made.filter(e => e && e.isConnected)); History.named('Suavizar', () => History.commit());
  },
});

/* ---------- Borrador de trazados: borra los tramos del trazado por los que se pasa ---------- */
function eraseSub(sub, hit) {
  const N = sub.nodes, segs = sub.closed ? N.length : N.length - 1, K = 32, pieces = [];
  let cur = null, any = false;
  const startedAtZero = [];
  for (let i = 0; i < segs; i++) {
    const a = N[i], b = N[(i + 1) % N.length], er = [];
    for (let s = 0; s <= K; s++) er.push(hit(bez(a, b, s / K)));
    if (er.some(Boolean)) any = true;
    /* intervalos conservados (los límites caen entre muestras) */
    let s = 0;
    while (s <= K) {
      if (er[s]) { s++; continue; }
      let e = s; while (e < K && !er[e + 1]) e++;
      const t0 = s === 0 ? 0 : (s - 0.5) / K, t1 = e === K ? 1 : (e + 0.5) / K;
      if (t1 - t0 > 1e-4) {
        const [A, B] = bezPart(a, b, t0, t1);
        if (t0 === 0 && cur && cur.open) { cur.nodes[cur.nodes.length - 1].hout = A.hout; cur.nodes.push(B); }
        else { cur = { nodes: [A, B], open: true, start: i === 0 && t0 === 0 }; pieces.push(cur); }
        if (t1 < 1) cur.open = false;
      } else if (cur) cur.open = false;
      s = e + 1;
    }
    if (er[K] && cur) cur.open = false;
    startedAtZero.push(er[0]);
  }
  if (!any) return null;
  /* cerrado: la última pieza continúa en la primera */
  if (sub.closed && pieces.length > 1) {
    const first = pieces[0], last = pieces[pieces.length - 1];
    if (first.start && last.open) { last.nodes[last.nodes.length - 1].hout = first.nodes[0].hout; last.nodes.push(...first.nodes.slice(1)); pieces.shift(); }
  }
  return pieces.filter(p => p.nodes.length > 1).map(p => ({ nodes: p.nodes, closed: false }));
}
App.patheraserSize = 8;
App.tools.patheraser = Object.assign(strokeToolBase('patheraserSize', 8), {
  up() {
    const pts = this.pts; this.pts = null; if (!pts) return;
    const r = this.size() / 2, ts = this.targets();
    if (!ts.length) { $('sbHint').textContent = 'Borrador de trazados: selecciona primero un trazado'; Selection.draw(); return; }
    const made = [];
    for (const s of ts) {
      const subs = pathSubsDoc(s); let changed = false;
      const out = subs.flatMap(sub => { const o = eraseSub(sub, q => distToPolyline(q, pts) <= r); if (o) changed = true; return o || [sub]; });
      if (!changed) { made.push(s); continue; }
      if (!out.length) { s.remove(); continue; }
      made.push(replaceWithPath(s, out, styleAttrs(s)));
    }
    Selection.set(made.filter(e => e && e.isConnected)); History.named('Borrador de trazados', () => History.commit()); App.emit('layers');
  },
});

/* ---------- Unir: pasa por el hueco entre dos extremos abiertos para unirlos ---------- */
App.joinSize = 30;
App.tools.join = Object.assign(strokeToolBase('joinSize', 30), {
  up() {
    const pts = this.pts; this.pts = null; if (!pts) return;
    const r = this.size() / 2, ends = [];
    for (const o of Layers.objects().filter(o => !Layers.isLocked(o) && !Layers.isHidden(o)))
      for (const s of (o.tagName === 'g' ? leafShapes(o) : [o]).filter(isShape)) {
        const sub = pathSubsDoc(s).find(x => !x.closed && x.nodes.length > 1); if (!sub) continue;
        for (const q of [sub.nodes[0], sub.nodes[sub.nodes.length - 1]]) { const d = distToPolyline(q, pts); if (d <= r) ends.push({ s, d }); }
      }
    ends.sort((a, b) => a.d - b.d);
    const shapes = [...new Set(ends.map(e => e.s))].slice(0, 2);
    if (!shapes.length) { $('sbHint').textContent = 'Unir: pasa por encima de dos extremos abiertos'; Selection.draw(); return; }
    Selection.set(shapes); History.named('Unir', () => PathOps.join());
  },
});

/* como subdivide(), pero sin partir los tramos rectos (siguen rectos tras la perspectiva) */
function subdivideCurves(subs, n) {
  return subs.map(s => {
    const N = s.nodes.map(c => ({ x: c.x, y: c.y, hin: c.hin && { ...c.hin }, hout: c.hout && { ...c.hout } })), segs = s.closed ? N.length : N.length - 1, out = [];
    for (let i = 0; i < N.length; i++) {
      out.push(N[i]); if (i >= segs) continue;
      let a = N[i]; const b = N[(i + 1) % N.length]; if (!a.hout && !b.hin) continue;
      for (let k = n; k > 1; k--) { const m = splitBez(a, b, 1 / k); out.push(m); a = m; }
    }
    return { nodes: out, closed: s.closed };
  });
}

/* ---------- Transformación libre (E): distorsión libre y perspectiva con las esquinas ---------- */
function squareToQuad([p0, p1, p2, p3]) {
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  let g = 0, h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) { const den = dx1 * dy2 - dx2 * dy1 || 1e-9; g = (dx3 * dy2 - dx2 * dy3) / den; h = (dx1 * dy3 - dx3 * dy1) / den; }
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x, c = p0.x, d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y, f = p0.y;
  return (u, v) => { const w = g * u + h * v + 1; return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w }; };
}
App.ftMode = 'free';
App.tools.freetransform = {
  cursor: 'default',
  options() { return `<select id="optFT"><option value="free">Distorsión libre</option><option value="persp" ${App.ftMode === 'persp' ? 'selected' : ''}>Perspectiva</option></select> <span style="color:#888">Arrastra una esquina</span>`; },
  bindOptions() { $('optFT').onchange = e => App.ftMode = e.target.value; },
  activate() { this.quad = null; Selection.draw(); },
  box() { const b = Geo.union(App.selection.map(e => Geo.bbox(e)).filter(Boolean)); return b && b.width && b.height ? b : null; },
  corners(b) { return [{ x: b.x, y: b.y }, { x: b.x + b.width, y: b.y }, { x: b.x + b.width, y: b.y + b.height }, { x: b.x, y: b.y + b.height }]; },
  down(p, ev, sp) {
    const b = this.box();
    if (b) {
      const Q = this.corners(b), i = Q.findIndex(q => { const s = View.docToStage(q.x, q.y); return Geo.dist(s, sp) < 8; });
      if (i >= 0) { this.drag = { b, i, Q: Q.map(q => ({ ...q })), p0: p }; return; }
    }
    const o = hitObject(ev); if (o) Selection.set(ev.shiftKey ? [...App.selection, o] : [o]); else if (!ev.shiftKey) Selection.clear();
  },
  move(p, ev) {
    const d = this.drag; if (!d) return;
    const Q = this.corners(d.b), dx = p.x - d.p0.x, dy = p.y - d.p0.y, i = d.i;
    Q[i] = { x: Q[i].x + dx, y: Q[i].y + dy };
    if (App.ftMode === 'persp' || ev.shiftKey) {
      /* perspectiva: la esquina vecina del mismo lado se mueve en sentido contrario */
      const horiz = Math.abs(dx) > Math.abs(dy), j = horiz ? [1, 0, 3, 2][i] : [3, 2, 1, 0][i];
      Q[j] = horiz ? { x: Q[j].x - dx, y: Q[j].y } : { x: Q[j].x, y: Q[j].y - dy };
      if (horiz) Q[i].y = d.Q[i].y; else Q[i].x = d.Q[i].x;
    }
    d.quad = Q; Selection.draw();
  },
  up() {
    const d = this.drag; this.drag = null; if (!d || !d.quad) return;
    const F = squareToQuad(d.quad), b = d.b, map = q => q && F((q.x - b.x) / b.width, (q.y - b.y) / b.height), made = [];
    let skipped = 0;
    for (const top of App.selection) for (const s of (top.tagName === 'g' ? leafShapes(top) : [top])) {
      if (!isShape(s) || Layers.isLocked(s)) { skipped++; continue; }
      const subs = subdivideCurves(pathSubsDoc(s), 4);
      subs.forEach(sub => sub.nodes.forEach(n => { const q = map(n); n.hin = map(n.hin); n.hout = map(n.hout); n.x = q.x; n.y = q.y; }));
      const el = replaceWithPath(s, subs, styleAttrs(s)); if (top === s) made.push(el);
    }
    Selection.set([...App.selection.filter(e => e.isConnected), ...made].filter(Boolean));
    if (skipped) $('sbHint').textContent = 'Los textos e imágenes no se distorsionan (crea contornos primero)';
    History.named('Transformación libre', () => History.commit()); App.emit('layers');
  },
  overlay(g) {
    const b = this.box(); if (!b) return;
    const Q = (this.drag && this.drag.quad) || this.corners(b), S = Q.map(q => View.docToStage(q.x, q.y));
    svgEl('polygon', { points: S.map(s => `${s.x},${s.y}`).join(' '), fill: 'none', stroke: '#1e90ff', 'stroke-dasharray': this.drag ? '4 3' : null }, g);
    S.forEach(s => svgEl('rect', { x: s.x - 4, y: s.y - 4, width: 8, height: 8, fill: '#fff', stroke: '#1e90ff' }, g));
  },
  hover(p, ev, sp) {
    const b = this.box(); const on = b && this.corners(b).some(q => Geo.dist(View.docToStage(q.x, q.y), sp) < 8);
    App.els.stage.style.cursor = on ? (App.ftMode === 'persp' ? 'ew-resize' : 'crosshair') : 'default';
  },
};

/* ---------- Bote de pintura interactiva (K): rellena las regiones que forman las formas ---------- */
App.tools.livepaint = {
  cursor: 'crosshair',
  activate() { this.refresh(); },
  group() { const s = App.selection; return s.length === 1 && s[0].tagName === 'g' && s[0].hasAttribute('data-livepaint') ? s[0] : null; },
  shapes() { return App.selection.flatMap(e => (e.tagName === 'g' ? leafShapes(e) : [e])).filter(s => isShape(s) && !s.hasAttribute('data-lpfill') && !Layers.isLocked(s)); },
  refresh() {
    this.F = this.shapes().length ? Faces.build(this.shapes()) : [];
    $('sbHint').textContent = this.F.length ? 'Pintura interactiva: clic o arrastra para rellenar regiones · Alt+clic toma el color' : 'Pintura interactiva: selecciona las formas que delimitan las regiones';
  },
  faceAt(p) { let best = null; for (const f of this.F || []) if (Faces.contains(f, p) && (!best || Math.abs(f.area) < Math.abs(best.area))) best = f; return best; },
  hover(p) { this.hot = this.faceAt(p); Selection.draw(); },
  fillAt(g, f) {
    const pt = f.pt || f.ring[0];
    return [...g.querySelectorAll(':scope > [data-lpfill]')].find(e => { const m = Geo.toDoc(e).inverse(), q = Geo.pt(m, pt.x, pt.y); try { return e.isPointInFill(new DOMPoint(q.x, q.y)); } catch (x) { return false; } });
  },
  paint(f) {
    if (!f || (this.done && this.done.has(f))) return; (this.done ||= new Set()).add(f);
    let g = this.group();
    if (!g) { Actions.group(); g = App.selection[0]; if (!g || g.tagName !== 'g') return; g.setAttribute('data-livepaint', '1'); g.setAttribute('data-name', 'Grupo de pintura interactiva'); }
    const old = this.fillAt(g, f), color = App.fill;
    if (old) { if (!color || color === 'none') old.remove(); else old.setAttribute('fill', color); return; }
    if (!color || color === 'none') return;
    const el = svgEl('path', { id: uid(), d: Boolean2D.toPath({ rings: Faces.rings(f) }), fill: color, stroke: 'none', 'data-lpfill': '1' });
    g.prepend(el); placeDocPath(el);
  },
  down(p, ev) {
    if (!this.F || !this.F.length) { const o = hitObject(ev); if (o) { Selection.set([o]); this.refresh(); } return; }
    const f = this.faceAt(p); if (!f) return;
    if (ev.altKey) { const g = this.group(), e = g && this.fillAt(g, f); if (e) { App.fill = e.getAttribute('fill'); Panels.refresh(); } return; }
    this.done = new Set(); this.dragging = true; this.paint(f);
  },
  move(p) { if (this.dragging) { const f = this.faceAt(p); this.paint(f); this.hot = f; Selection.draw(); } },
  up() { if (!this.dragging) return; this.dragging = false; this.done = null; History.named('Pintura interactiva', () => History.commit()); App.emit('layers'); Selection.draw(); },
  overlay(g) {
    if (!this.hot) return;
    const ringD = r => 'M' + r.map(q => { const s = View.docToStage(q.x, q.y); return `${s.x} ${s.y}`; }).join('L') + 'Z';
    svgEl('path', { d: Faces.rings(this.hot).map(ringD).join(' '), 'fill-rule': 'evenodd', fill: 'none', stroke: '#e5332a', 'stroke-width': 3 }, g);
  },
  deactivate() { this.F = null; this.hot = null; $('sbHint').textContent = ''; },
};
