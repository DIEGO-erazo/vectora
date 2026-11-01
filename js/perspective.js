/* Vectora — cuadrícula de perspectiva de 2 puntos (Mayús+P): planos izquierdo y derecho que
   fugan hacia dos puntos del horizonte. Con la herramienta se ajustan los puntos de fuga,
   el horizonte y el suelo, y al arrastrar sobre un plano se dibuja un rectángulo en perspectiva.
   Objeto ▸ Perspectiva ▸ Adjuntar lleva la selección al plano (izquierdo o derecho). */
'use strict';

const Persp = {
  get() {
    const ab = Artboards.active();
    return App.doc.persp || (App.doc.persp = { x0: ab.x + ab.width / 2, ground: ab.y + ab.height * 0.78, horizon: ab.y + ab.height * 0.42, vl: ab.x - ab.width * 0.25, vr: ab.x + ab.width * 1.25, cell: 40 });
  },
  visible: false,
  /* t(u): fracción del camino hacia el punto de fuga a una distancia u del origen */
  t(u, side) { const G = this.get(), D = Math.abs((side < 0 ? G.vl : G.vr) - G.x0) * 0.9; return u / (u + D); },
  /* punto del plano (u: distancia horizontal desde la arista, v: altura) */
  pt(side, u, v) {
    const G = this.get(), V = { x: side < 0 ? G.vl : G.vr, y: G.horizon }, base = { x: G.x0, y: G.ground - v }, t = this.t(Math.max(0, u), side);
    return { x: base.x + (V.x - base.x) * t, y: base.y + (V.y - base.y) * t };
  },
  /* intersección de dos rectas (a→b y c→d) */
  cross(a, b, c, d) { const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y }, den = r.x * s.y - r.y * s.x || 1e-9, t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den; return { x: a.x + r.x * t, y: a.y + r.y * t }; },
  /* punto de cualquier plano: -1 izquierdo, 1 derecho (u profundidad, v altura) y 0 suelo (u hacia la derecha, v hacia la izquierda) */
  plane(side, u, v) {
    if (side) return this.pt(side, u, v);
    /* el suelo se extiende hacia el observador, delante de la arista: profundidades negativas en las bases */
    const G = this.get(), A = this.base(-1, -Math.max(0, v)), B = this.base(1, -Math.max(0, u));
    return this.cross(A, { x: G.vr, y: G.horizon }, B, { x: G.vl, y: G.horizon });
  },
  /* punto de la arista de base a una profundidad d (negativa: delante de la esquina) */
  base(side, d) {
    const G = this.get(), V = { x: side < 0 ? G.vl : G.vr, y: G.horizon }, D = Math.abs(V.x - G.x0) * 0.9, dd = Math.max(d, -0.9 * D), t = dd / (dd + D);
    return { x: G.x0 + (V.x - G.x0) * t, y: G.ground + (V.y - G.ground) * t };
  },
  invPlane(side, p) {
    if (side) return this.inv(side, p);
    const G = this.get(), O = { x: G.x0, y: G.ground }, VL = { x: G.vl, y: G.horizon }, VR = { x: G.vr, y: G.horizon };
    const depth = (V, q, D) => { const vx = V.x - O.x, vy = V.y - O.y, t = Math.min(0.98, ((q.x - O.x) * vx + (q.y - O.y) * vy) / (vx * vx + vy * vy)); return t * D / (1 - t); };
    const qR = this.cross(VL, p, O, VR), qL = this.cross(VR, p, O, VL);
    return { u: Math.max(0, -depth(VR, qR, Math.abs(G.vr - G.x0) * 0.9)), v: Math.max(0, -depth(VL, qL, Math.abs(G.vl - G.x0) * 0.9)) };
  },
  /* plano bajo un punto del documento (por debajo de las aristas de base: el suelo) */
  sideAt(p) {
    const G = this.get(), pref = App.perspPlane || 'auto'; if (pref !== 'auto') return +pref;
    const left = p.x < G.x0, V = left ? G.vl : G.vr, baseY = G.ground + (G.horizon - G.ground) * clamp((p.x - G.x0) / (V - G.x0), 0, 1);
    return p.y > baseY + 1 ? 0 : left ? -1 : 1;
  },
  /* coordenadas del plano (inversa aproximada) de un punto del documento */
  inv(side, p) {
    const G = this.get(), V = { x: side < 0 ? G.vl : G.vr, y: G.horizon }, D = Math.abs(V.x - G.x0) * 0.9;
    const t = clamp((p.x - G.x0) / (V.x - G.x0), 0, 0.98), u = t * D / (1 - t);
    const yb = (p.y - V.y * t) / (1 - t); return { u, v: G.ground - yb };
  },
  map(side, q, ref) { return this.pt(side, side < 0 ? ref.x0 - q.x : q.x - ref.x0, ref.ground - q.y); },
  draw(g) {
    if (!this.visible) return;
    const G = this.get(), S = q => View.docToStage(q.x, q.y), line = (a, b, c, w = 1) => { const A = S(a), B = S(b); svgEl('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: c, 'stroke-width': w, 'pointer-events': 'none' }, g); };
    const ab = Artboards.active(), far = Math.max(ab.width, ab.height) * 3;
    line({ x: G.vl - far, y: G.horizon }, { x: G.vr + far, y: G.horizon }, '#6c6cff', 1.2);
    for (const [side, col] of [[-1, '#3fb76b'], [1, '#e8743b']]) {
      for (let u = 0; u <= far; u += G.cell) line(this.pt(side, u, 0), this.pt(side, u, (G.ground - G.horizon) * 2.2), col + '88');
      for (let v = 0; v <= (G.ground - G.horizon) * 2.2; v += G.cell) line(this.pt(side, 0, v), this.pt(side, far, v), col + '88');
    }
    /* suelo */
    const fl = 0.5 * 0.9 * Math.min(Math.abs(G.vr - G.x0), Math.abs(G.vl - G.x0));
    for (let u = 0; u <= fl; u += G.cell) line(this.plane(0, u, 0), this.plane(0, u, fl), '#4f8cff66');
    for (let v = 0; v <= fl; v += G.cell) line(this.plane(0, 0, v), this.plane(0, fl, v), '#4f8cff66');
    line({ x: G.x0, y: G.ground }, { x: G.x0, y: G.ground - (G.ground - G.horizon) * 2.2 }, '#222', 1.5);
    const dot = (q, c) => { const s = S(q); svgEl('circle', { cx: s.x, cy: s.y, r: 6, fill: c, stroke: '#fff', 'stroke-width': 1.5 }, g); };
    dot({ x: G.vl, y: G.horizon }, '#3fb76b'); dot({ x: G.vr, y: G.horizon }, '#e8743b'); dot({ x: G.x0, y: G.ground }, '#222'); dot({ x: G.x0, y: G.horizon }, '#6c6cff');
  },
  toggle() { this.visible = !this.visible; this.get(); Selection.draw(); },
  /* lleva la selección al plano: x respecto a la arista central = profundidad, y = altura */
  attach(sideWanted) {
    const els = App.selection.flatMap(e => (e.tagName === 'g' ? leafShapes(e) : [e])).filter(isShape); if (!els.length) return Dialog.alert('Selecciona trazados o formas (los textos, conviértelos antes en contornos).');
    const G = this.get(), made = [];
    for (const s of els) {
      const b = Geo.bbox(s), side = sideWanted != null ? sideWanted : (b.x + b.width / 2 < G.x0 ? -1 : 1);
      const subs = subdivideCurves(pathSubsDoc(s), 3).map(sub => ({ closed: sub.closed, nodes: sub.nodes }));
      const T = q => q && (side ? this.map(side, q, G) : this.plane(0, q.x - b.x, b.y + b.height - q.y));
      subs.forEach(sub => sub.nodes.forEach(n => { const q = T(n); n.hin = T(n.hin); n.hout = T(n.hout); n.x = q.x; n.y = q.y; }));
      made.push(replaceWithPath(s, subs, styleAttrs(s)));
    }
    this.visible = true; Selection.set(made.filter(Boolean)); History.named('Adjuntar a perspectiva', () => History.commit()); App.emit('layers');
  },
};
App.tools.perspective = {
  cursor: 'crosshair',
  options() { const v = App.perspPlane || 'auto'; return `Plano de dibujo <select id="optPlane">${[['auto', 'Automático'], ['-1', 'Izquierdo'], ['1', 'Derecho'], ['0', 'Suelo']].map(([k, n]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${n}</option>`).join('')}</select>`; },
  bindOptions() { $('optPlane').onchange = e => { App.perspPlane = e.target.value; }; },
  activate() { Persp.visible = true; Persp.get(); $('sbHint').textContent = 'Perspectiva: arrastra los puntos de fuga, el horizonte o el suelo · arrastra sobre un plano para dibujar un rectángulo'; Selection.draw(); },
  deactivate() { $('sbHint').textContent = ''; },
  handles() { const G = Persp.get(); return [['vl', { x: G.vl, y: G.horizon }], ['vr', { x: G.vr, y: G.horizon }], ['ground', { x: G.x0, y: G.ground }], ['horizon', { x: G.x0, y: G.horizon }]]; },
  down(p, ev, sp) {
    const h = this.handles().find(([, q]) => Geo.dist(View.docToStage(q.x, q.y), sp) < 9);
    if (h) { this.drag = { k: h[0], p0: p, G0: { ...Persp.get() } }; return; }
    const side = Persp.sideAt(p); this.rect = { side, a: Persp.invPlane(side, p), b: null };
  },
  move(p) {
    if (this.drag) {
      const d = this.drag, G = Persp.get(), dx = p.x - d.p0.x, dy = p.y - d.p0.y;
      if (d.k === 'vl') { G.vl = Math.min(d.G0.vl + dx, G.x0 - 20); G.horizon = d.G0.horizon + dy; }
      else if (d.k === 'vr') { G.vr = Math.max(d.G0.vr + dx, G.x0 + 20); G.horizon = d.G0.horizon + dy; }
      else if (d.k === 'horizon') G.horizon = Math.min(d.G0.horizon + dy, G.ground - 10);
      else { G.ground = Math.max(d.G0.ground + dy, G.horizon + 10); G.x0 = d.G0.x0 + dx; }
      Selection.draw(); return;
    }
    if (this.rect) { this.rect.b = Persp.invPlane(this.rect.side, p); Selection.draw(); }
  },
  quad(r) {
    const u0 = Math.min(r.a.u, r.b.u), u1 = Math.max(r.a.u, r.b.u), v0 = Math.min(r.a.v, r.b.v), v1 = Math.max(r.a.v, r.b.v);
    return [Persp.plane(r.side, u0, v0), Persp.plane(r.side, u1, v0), Persp.plane(r.side, u1, v1), Persp.plane(r.side, u0, v1)];
  },
  up() {
    if (this.drag) { this.drag = null; History.named('Cuadrícula de perspectiva', () => History.commit()); return; }
    const r = this.rect; this.rect = null; if (!r || !r.b || Math.abs(r.a.u - r.b.u) < 1 || Math.abs(r.a.v - r.b.v) < 1) { Selection.draw(); return; }
    const Q = this.quad(r), el = addObject(svgEl('path', { ...newShapeAttrs(), d: 'M' + Q.map(q => `${round(q.x, 2)} ${round(q.y, 2)}`).join('L') + 'Z', 'data-name': 'Rectángulo en perspectiva' }));
    if (el) { Selection.set([el]); History.named('Rectángulo en perspectiva', () => History.commit()); }
  },
  overlay(g) {
    if (this.rect && this.rect.b) { const Q = this.quad(this.rect).map(q => View.docToStage(q.x, q.y)); svgEl('polygon', { points: Q.map(s => `${s.x},${s.y}`).join(' '), fill: 'rgba(30,144,255,.2)', stroke: '#1e90ff' }, g); }
  },
};
ICONS.perspective = '<path d="M2 12h20M12 4v16M12 6L2 12l10 6M12 6l10 6-10 6" />';
TOOL_INFO.perspective = ['Cuadrícula de perspectiva', 'Mayús+P'];
TOOL_GROUPS.find(g => Array.isArray(g) && g.includes('freetransform')).push('perspective');
/* la cuadrícula se dibuja bajo la superposición, con cualquier herramienta */
(() => { const base = Selection.draw.bind(Selection); Selection.draw = function (...a) { base(...a); if (!Persp.visible) return; const sub = svgEl('g', { 'pointer-events': 'none' }); App.els.overlay.prepend(sub); Persp.draw(sub); }; })();
