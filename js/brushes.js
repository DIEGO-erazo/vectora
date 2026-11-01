/* Vectora — pinceles (caligráfico, de arte y de dispersión), perfiles de anchura,
   herramienta Anchura (Mayús+W) y distorsión de envolvente (Deformar).
   Todo son efectos en vivo (fxlive.js): el trazado original se conserva y se puede editar. */
'use strict';

/* ---------- muestreo por longitud de arco ---------- */
const segLen = (a, b) => { const p1 = a.hout || a, p2 = b.hin || b; return Geo.dist(a, p1) + Geo.dist(p1, p2) + Geo.dist(p2, b); };
function arcSamples(sub, step) {
  const N = sub.nodes, segs = sub.closed ? N.length : N.length - 1, pts = [];
  for (let i = 0; i < segs; i++) {
    const a = N[i], b = N[(i + 1) % N.length], K = Math.max(2, Math.min(400, Math.ceil(segLen(a, b) / step)));
    for (let k = 0; k < K; k++) pts.push(bez(a, b, k / K));
  }
  const last = sub.closed ? N[0] : N[N.length - 1]; pts.push({ x: last.x, y: last.y });
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Geo.dist(pts[i - 1], pts[i]));
  return { pts, cum, L: cum[cum.length - 1], closed: sub.closed };
}
/* punto, tangente y normal a una distancia s del inicio */
function arcAt(S, s) {
  const { pts, cum } = S; s = clamp(s, 0, S.L);
  let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi], t = (s - cum[lo]) / ((cum[hi] - cum[lo]) || 1);
  const i0 = Math.max(0, lo - 1), i1 = Math.min(pts.length - 1, hi + 1);
  let tx = pts[i1].x - pts[i0].x, ty = pts[i1].y - pts[i0].y; const L = Math.hypot(tx, ty) || 1; tx /= L; ty /= L;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, tx, ty, nx: -ty, ny: tx };
}
/* contorno de anchura variable: wAt(u, ángulo) da la anchura total en la posición u (0..1) */
function widthOutline(sub, wAt) {
  const S = arcSamples(sub, 1.5); if (S.L < 1e-6) return [];
  const left = [], right = [], n = S.pts.length - (S.closed ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const q = arcAt(S, S.cum[i]), w = Math.max(0, wAt(S.cum[i] / S.L, Math.atan2(q.ty, q.tx))) / 2;
    left.push({ x: q.x + q.nx * w, y: q.y + q.ny * w }); right.push({ x: q.x - q.nx * w, y: q.y - q.ny * w });
  }
  const poly = r => ({ nodes: rdpClosed(r, 0.12).map(p => ({ x: p.x, y: p.y, hin: null, hout: null })), closed: true });
  if (S.closed) return [poly(left), poly(right.reverse())];
  return [poly([...left, ...right.reverse()])];
}
/* interpolación suave entre puntos de anchura [[u, m], ...] */
function widthAt(pts, u) {
  if (!pts.length) return 1;
  if (u <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (u <= pts[i][0]) {
    const [u0, m0] = pts[i - 1], [u1, m1] = pts[i], t = (u - u0) / ((u1 - u0) || 1), k = (1 - Math.cos(t * Math.PI)) / 2;
    return m0 + (m1 - m0) * k;
  }
  return pts[pts.length - 1][1];
}
const WIDTH_PROFILES = {
  uniform: ['Uniforme', [[0, 1], [1, 1]]], lens: ['Afilado en ambos extremos', [[0, 0], [0.5, 1], [1, 0]]],
  start: ['Afilado al inicio', [[0, 0], [1, 1]]], end: ['Afilado al final', [[0, 1], [1, 0]]],
  bulge: ['Abultado', [[0, 1], [0.5, 2], [1, 1]]], pinch: ['Estrangulado', [[0, 1], [0.5, 0.25], [1, 1]]],
  drop: ['Gota', [[0, 0], [0.25, 1.4], [1, 0]]],
};

/* forma de un pincel: d normalizado (arte: u 0..1 a lo largo, v -0.5..0.5 a lo ancho; dispersión: centrado en 0) */
function brushShape(d, n = 6) { return subdivide(curvify(PathData.parse(d)), n); }

Object.assign(FX, {
  width: { name: 'Perfil de anchura', outline: true,
    fields: [{ id: 'profile', label: 'Perfil', type: 'select', value: 'lens', options: Object.entries(WIDTH_PROFILES).map(([k, v]) => [k, v[0]]) }, { id: 'k', label: 'Escala de anchura', type: 'number', value: 1, min: 0.1, step: 0.1 }],
    run(subs, p, ctx) { const pts = p.pts || (WIDTH_PROFILES[p.profile] || WIDTH_PROFILES.uniform)[1], W = ctx.w * (+p.k || 1); return subs.flatMap(s => widthOutline(s, u => W * widthAt(pts, u))); } },
  calli: { name: 'Pincel caligráfico', outline: true,
    fields: [{ id: 'a', label: 'Ángulo (°)', type: 'number', value: 30, step: 5 }, { id: 'r', label: 'Redondez (%)', type: 'number', value: 30, min: 0, max: 100 }, { id: 's', label: 'Tamaño (% del trazo)', type: 'number', value: 300, min: 10 }],
    run(subs, p, ctx) {
      const A = (+p.a || 0) * Math.PI / 180, r = clamp(+p.r, 0, 100) / 100, W = ctx.w * (+p.s || 100) / 100;
      return subs.flatMap(s => widthOutline(s, (u, ang) => W * (r + (1 - r) * Math.abs(Math.sin(ang - A)))));
    } },
  art: { name: 'Pincel de arte', outline: true, hidden: true,
    fields: [{ id: 'k', label: 'Grosor (× trazo)', type: 'number', value: 6, min: 0.1, step: 0.5 }, { id: 'flip', label: 'Voltear', type: 'checkbox', value: false }],
    run(subs, p, ctx) {
      const shape = brushShape(p.shape || 'M0 -0.5H1V0.5H0Z'), T = ctx.w * (+p.k || 6) * (p.flip ? -1 : 1), out = [];
      for (const s of subs) {
        const S = arcSamples(s, 1); if (S.L < 1e-6) continue;
        const map = q => { if (!q) return null; const a = arcAt(S, q.x * S.L); return { x: a.x + a.nx * q.y * T, y: a.y + a.ny * q.y * T }; };
        for (const sh of shape) out.push({ closed: sh.closed, nodes: sh.nodes.map(n => ({ ...map(n), hin: map(n.hin), hout: map(n.hout) })) });
      }
      return out;
    } },
  scatter: { name: 'Pincel de dispersión', outline: true, hidden: true,
    fields: [{ id: 's', label: 'Tamaño (× trazo)', type: 'number', value: 5, min: 0.1, step: 0.5 }, { id: 'g', label: 'Espaciado (%)', type: 'number', value: 140, min: 10 },
      { id: 'rnd', label: 'Aleatorio (%)', type: 'number', value: 0, min: 0, max: 100 }, { id: 'rot', label: 'Girar con el trazado', type: 'checkbox', value: true }],
    run(subs, p, ctx) {
      const shape = brushShape(p.shape || 'M0 -0.5A0.5 0.5 0 1 1 0 0.5A0.5 0.5 0 1 1 0 -0.5Z', 3), size = ctx.w * (+p.s || 5), gap = size * (+p.g || 100) / 100, R = clamp(+p.rnd || 0, 0, 100) / 100, out = [];
      rngSeed = 4271;
      for (const s of subs) {
        const S = arcSamples(s, 1); if (S.L < 1e-6) continue;
        for (let d = gap / 2; d <= S.L + 1e-6; d += gap) {
          const a = arcAt(S, d), k = size * (1 + (rnd() * 2 - 1) * R * 0.6), off = (rnd() * 2 - 1) * R * size;
          const ang = (p.rot === false ? 0 : Math.atan2(a.ty, a.tx)) + (rnd() * 2 - 1) * R * Math.PI, co = Math.cos(ang), si = Math.sin(ang);
          const cx = a.x + a.nx * off, cy = a.y + a.ny * off;
          const map = q => q && ({ x: cx + (q.x * co - q.y * si) * k, y: cy + (q.x * si + q.y * co) * k });
          for (const sh of shape) out.push({ closed: sh.closed, nodes: sh.nodes.map(n => ({ ...map(n), hin: map(n.hin), hout: map(n.hout) })) });
        }
      }
      return out;
    } },
  warp: { name: 'Deformar',
    fields: [{ id: 'style', label: 'Estilo', type: 'select', value: 'arc', options: [['arc', 'Arco'], ['arcLower', 'Arco inferior'], ['arcUpper', 'Arco superior'], ['arch', 'Arcada'], ['bulge', 'Abombado'],
      ['shellLower', 'Concha inferior'], ['shellUpper', 'Concha superior'], ['flag', 'Bandera'], ['wave', 'Onda'], ['fish', 'Pez'], ['rise', 'Ascendente'], ['fisheye', 'Ojo de pez'],
      ['inflate', 'Inflar'], ['squeeze', 'Comprimir'], ['twist', 'Giro']] },
    { id: 'b', label: 'Curvar (%)', type: 'number', value: 50, min: -100, max: 100, step: 5 }, { id: 'h', label: 'Distorsión horizontal (%)', type: 'number', value: 0, min: -100, max: 100, step: 5 },
    { id: 'v', label: 'Distorsión vertical (%)', type: 'number', value: 0, min: -100, max: 100, step: 5 }],
    run(subs, p) {
      let box; if (p.box) { const [x, y, width, height] = p.box; box = { x, y, width, height }; }
      else box = Geo.union(subs.flatMap(s => s.nodes).map(n => ({ x: n.x, y: n.y, width: 0, height: 0 })));
      if (!box || !box.width || !box.height) return subs;
      subs = subdivide(curvify(subs), 4);
      const b = (+p.b || 0) / 100, H = (+p.h || 0) / 100, V = (+p.v || 0) / 100, cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      const f = warpFn(p.style, b);
      mapPoints(subs, q => {
        let u = (q.x - cx) / (box.width / 2), v = (q.y - cy) / (box.height / 2);
        u *= 1 + H * v * 0.5; v *= 1 + V * u * 0.5;   /* distorsiones de perspectiva */
        const r = f(u, v); return { x: cx + r.u * box.width / 2, y: cy + r.v * box.height / 2 };
      });
      return subs;
    } },
});
/* estilos de deformación sobre coordenadas normalizadas (-1..1) */
function warpFn(style, b) {
  const P = u => 1 - u * u;
  switch (style) {
    case 'arc': return (u, v) => ({ u, v: v - b * P(u) * 0.8 });
    case 'arcLower': return (u, v) => ({ u, v: v + b * P(u) * (v + 1) * 0.4 });
    case 'arcUpper': return (u, v) => ({ u, v: v - b * P(u) * (1 - v) * 0.4 });
    case 'arch': return (u, v) => ({ u, v: v - b * P(u) * 0.8 + b * P(u) * (v + 1) * 0.2 });
    case 'bulge': return (u, v) => ({ u, v: v * (1 + b * P(u) * 0.6) });
    case 'shellLower': return (u, v) => ({ u, v: v + b * P(u) * (v + 1) * 0.4 - b * (1 - P(u)) * (v + 1) * 0.2 });
    case 'shellUpper': return (u, v) => ({ u, v: v - b * P(u) * (1 - v) * 0.4 + b * (1 - P(u)) * (1 - v) * 0.2 });
    case 'flag': return (u, v) => ({ u, v: v + b * 0.4 * Math.sin(u * Math.PI) });
    case 'wave': return (u, v) => ({ u, v: v + b * 0.35 * Math.sin(u * Math.PI * 1.5 + v * 0.6) });
    case 'fish': return (u, v) => ({ u, v: v * (1 + b * 0.6 * Math.cos(u * Math.PI / 2) - b * 0.3 * (1 - Math.cos(u * Math.PI / 2))) });
    case 'rise': return (u, v) => ({ u, v: v - b * 0.4 * (u + 1) * (u + 1) / 2 + b * 0.4 });
    case 'fisheye': return (u, v) => { const r = Math.min(1, Math.hypot(u, v) / 1.414), k = 1 + b * 0.6 * (1 - r * r); return { u: u * k, v: v * k }; };
    case 'inflate': return (u, v) => ({ u: u * (1 + b * 0.4 * (1 - v * v)), v: v * (1 + b * 0.4 * (1 - u * u)) });
    case 'squeeze': return (u, v) => ({ u: u * (1 - b * 0.4 * (1 - v * v)), v: v * (1 + b * 0.2 * (1 - u * u)) });
    case 'twist': return (u, v) => { const r = Math.min(1, Math.hypot(u, v) / 1.414), a = b * Math.PI * (1 - r), co = Math.cos(a), si = Math.sin(a); return { u: u * co - v * si, v: u * si + v * co }; };
    default: return (u, v) => ({ u, v });
  }
}

/* el trazo de un trazado con pincel se edita como un trazo normal (paneles Color, Trazo…) */
(() => {
  const baseSet = setStyle, baseGet = getStyle;
  setStyle = function (els, prop, value) {
    for (const el of els) for (const s of leafShapes(el)) {
      const o = LiveFX.ostroke(s);
      if (!o || !['stroke', 'stroke-width', 'fill'].includes(prop)) { baseSet([s], prop, value); continue; }
      if (prop === 'stroke') { o.s = value || 'none'; s.setAttribute('fill', o.s); }
      else if (prop === 'fill') o.f = value || 'none';
      else o.w = +value || 1;
      s.setAttribute('data-ostroke', JSON.stringify(o)); LiveFX.render(s);
    }
  };
  getStyle = function (el, prop) {
    const s = leafShapes(el)[0], o = s && s.hasAttribute && s.hasAttribute('data-ostroke') && LiveFX.ostroke(s);
    if (o) { if (prop === 'stroke') return o.s; if (prop === 'fill') return o.f; if (prop === 'stroke-width') return String(o.w); }
    return baseGet(el, prop);
  };
  /* editar un efecto conserva los parámetros que no salen en el diálogo (forma del pincel, caja…) */
  LiveFX.edit = async function (el, i) {
    const list = this.list(el), f = list[i]; if (!f || !FX[f.t]) return;
    const snap = History.snapshot(), id = el.id, fx = FX[f.t];
    const apply = v => { const e = document.getElementById(id); if (!e) return; const L = this.list(e); L[i] = { ...L[i], p: { ...L[i].p, ...v } }; if (v.profile) delete L[i].p.pts; this.write(e, L); Selection.draw(); };
    const v = await Dialog.form(fx.name, fx.fields.map(x => ({ ...x, value: (f.p || {})[x.id] ?? x.value })), { preview: apply, revert: () => Dialog.revertTo(snap) });
    if (!v) return; delete v._button; apply(v); History.named(fx.name, () => History.commit()); Selection.changed();
  };
})();

/* ---------- pinceles ---------- */
const BRUSH_SHAPES = {
  leaf: 'M0 0C0.25 -0.55 0.75 -0.55 1 0C0.75 0.55 0.25 0.55 0 0Z',
  ink: 'M0 0C0.05 -0.3 0.25 -0.5 0.5 -0.45C0.75 -0.42 0.92 -0.25 1 0C0.93 0.12 0.75 0.28 0.5 0.32C0.28 0.36 0.06 0.25 0 0Z',
  arrow: 'M0 -0.1H0.78V-0.5L1 0L0.78 0.5V0.1H0Z',
  ribbon: 'M0 -0.5H1L0.88 0L1 0.5H0L0.12 0Z',
  dot: 'M0 -0.5A0.5 0.5 0 1 1 0 0.5A0.5 0.5 0 1 1 0 -0.5Z',
  star: 'M0 -0.5L0.12 -0.16L0.48 -0.15L0.19 0.06L0.29 0.4L0 0.2L-0.29 0.4L-0.19 0.06L-0.48 -0.15L-0.12 -0.16Z',
  heart: 'M0 0.45C-0.25 0.25 -0.5 0.05 -0.5 -0.18C-0.5 -0.4 -0.3 -0.5 -0.15 -0.45C-0.07 -0.42 -0.02 -0.36 0 -0.3C0.02 -0.36 0.07 -0.42 0.15 -0.45C0.3 -0.5 0.5 -0.4 0.5 -0.18C0.5 0.05 0.25 0.25 0 0.45Z',
};
const BRUSH_PRESETS = [
  { id: 'basic', name: 'Básico', fx: null },
  { id: 'calli', name: 'Caligráfico ovalado', fx: { t: 'calli', p: { a: 30, r: 40, s: 300 } } },
  { id: 'flat', name: 'Caligráfico plano', fx: { t: 'calli', p: { a: 45, r: 8, s: 400 } } },
  { id: 'taper', name: 'Afilado', fx: { t: 'width', p: { profile: 'lens', k: 3 } } },
  { id: 'drop', name: 'Gota', fx: { t: 'width', p: { profile: 'drop', k: 3 } } },
  { id: 'leaf', name: 'Hoja', fx: { t: 'art', p: { shape: BRUSH_SHAPES.leaf, k: 8 } } },
  { id: 'ink', name: 'Tinta', fx: { t: 'art', p: { shape: BRUSH_SHAPES.ink, k: 6 } } },
  { id: 'arrow', name: 'Flecha', fx: { t: 'art', p: { shape: BRUSH_SHAPES.arrow, k: 6 } } },
  { id: 'ribbon', name: 'Cinta', fx: { t: 'art', p: { shape: BRUSH_SHAPES.ribbon, k: 5 } } },
  { id: 'dots', name: 'Puntos', fx: { t: 'scatter', p: { shape: BRUSH_SHAPES.dot, s: 4, g: 160, rnd: 0, rot: true } } },
  { id: 'stars', name: 'Estrellas', fx: { t: 'scatter', p: { shape: BRUSH_SHAPES.star, s: 7, g: 130, rnd: 35, rot: true } } },
  { id: 'hearts', name: 'Corazones', fx: { t: 'scatter', p: { shape: BRUSH_SHAPES.heart, s: 6, g: 140, rnd: 0, rot: false } } },
];
const BRUSH_TYPES = ['width', 'calli', 'art', 'scatter'];
const Brushes = {
  current: 'basic',
  all() { return [...BRUSH_PRESETS, ...(App.doc.brushes || [])]; },
  get(id) { return this.all().find(b => b.id === id); },
  /* aplica un pincel a un elemento (sustituye el pincel que tuviera) */
  applyTo(el, b) {
    let L = LiveFX.list(el).filter(f => !BRUSH_TYPES.includes(f.t));
    if (b && b.fx) { el = LiveFX.prepare(el); L = [{ t: b.fx.t, p: JSON.parse(JSON.stringify(b.fx.p)), brush: b.id }, ...L]; }
    LiveFX.write(el, L); return el;
  },
  apply(id) {
    const b = this.get(id); if (!b) return; this.current = id;
    const ts = App.selection.flatMap(e => (e.tagName === 'g' ? leafShapes(e) : [e])).filter(s => isShape(s) && !Layers.isLocked(s));
    if (ts.length) { ts.forEach(s => this.applyTo(s, b)); LiveFX.resync(); History.named('Pincel', () => History.commit()); Selection.changed(); }
    this.render();
  },
  async create() {
    const shapes = App.selection.flatMap(e => (e.tagName === 'g' ? leafShapes(e) : [e])).filter(isShape);
    if (!shapes.length) return Dialog.alert('Selecciona la ilustración (trazados) para el pincel nuevo.');
    const v = await Dialog.form('Nuevo pincel', [{ id: 'n', label: 'Nombre', value: `Pincel ${(App.doc.brushes || []).length + 1}` },
      { id: 'type', label: 'Tipo', type: 'select', value: 'art', options: [['art', 'Pincel de arte (se estira a lo largo)'], ['scatter', 'Pincel de dispersión (copias)']] }]);
    if (!v || !v.n.trim()) return;
    const subs = shapes.flatMap(s => pathSubsDoc(s)), b = Geo.union(subs.flatMap(s => s.nodes).map(n => ({ x: n.x, y: n.y, width: 0, height: 0 })));
    if (!b || !b.width || !b.height) return;
    const art = v.type === 'art', M = Math.max(b.width, b.height);
    const N = q => q && (art ? { x: (q.x - b.x) / b.width, y: (q.y - b.y - b.height / 2) / b.height } : { x: (q.x - b.x - b.width / 2) / M, y: (q.y - b.y - b.height / 2) / M });
    const shape = PathData.serialize(subs.map(s => ({ closed: s.closed, nodes: s.nodes.map(n => ({ ...N(n), hin: N(n.hin), hout: N(n.hout) })) })));
    const br = { id: uid('br'), name: v.n.trim(), fx: art ? { t: 'art', p: { shape, k: Math.max(1, round(6 * b.height / b.width * 4, 1)) } } : { t: 'scatter', p: { shape, s: 6, g: 130, rnd: 0, rot: true } } };
    (App.doc.brushes ||= []).push(br); this.current = br.id;
    History.named('Nuevo pincel', () => History.commit()); this.render();
  },
  remove() {
    const L = App.doc.brushes || [], i = L.findIndex(b => b.id === this.current);
    if (i < 0) return Dialog.alert('Solo se pueden eliminar los pinceles creados en este documento.');
    L.splice(i, 1); this.current = 'basic'; History.named('Eliminar pincel', () => History.commit()); this.render();
  },
  preview(b) {
    const sample = PathData.parse('M6 22C16 4 30 4 38 16S58 28 70 8');
    let d = PathData.serialize(sample), fill = 'none', stroke = '#222';
    if (b.fx) { d = PathData.serialize(FX[b.fx.t].run(sample, b.fx.p, { w: 1.4 })); fill = '#222'; stroke = 'none'; }
    return `<svg viewBox="0 0 76 30"><path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/></svg>`;
  },
  render() {
    const box = $('brGrid'); if (!box || $('pBrushes').hidden) return;
    const sel = App.selection.flatMap(e => (e.tagName === 'g' ? leafShapes(e) : [e]))[0], on = sel ? (LiveFX.list(sel).find(f => BRUSH_TYPES.includes(f.t)) || {}).brush || (sel ? 'basic' : null) : this.current;
    box.innerHTML = '';
    for (const b of this.all()) {
      const c = document.createElement('div'); c.className = 'br' + (b.id === on ? ' on' : ''); c.title = b.name;
      c.innerHTML = this.preview(b) + `<span></span>`; c.querySelector('span').textContent = b.name;
      c.onclick = () => this.apply(b.id); box.appendChild(c);
    }
  },
  init() {
    $('brNew').onclick = () => this.create(); $('brDel').onclick = () => this.remove();
    $('brNone').onclick = () => this.apply('basic');
    $('brOpts').onclick = () => { const s = App.selection[0], i = s ? LiveFX.list(s).findIndex(f => BRUSH_TYPES.includes(f.t)) : -1; if (i >= 0) LiveFX.edit(s, i); };
    App.on('selection', () => this.render()); App.on('change', () => this.render()); App.on('dock', t => { if (t === 'pBrushes') this.render(); });
    /* la herramienta Pincel dibuja con el pincel actual */
    const brush = App.tools.brush, baseUp = brush.up;
    brush.up = function (...a) {
      baseUp.apply(this, a);
      const b = Brushes.get(Brushes.current), el = App.selection[0];
      if (b && b.fx && el && el.tagName === 'path' && !el.hasAttribute('data-fx')) { const e = Brushes.applyTo(el, b); Selection.set([e]); History.named('Pincel', () => History.commit()); }
    };
    /* perfil de anchura en el panel Trazo */
    const body = $('pStroke').querySelector('.grid2') || $('pStroke').querySelector('.panel-body');
    body.insertAdjacentHTML('beforeend', `<label>Perfil</label><select id="psProfile">${Object.entries(WIDTH_PROFILES).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}<option value="custom" hidden>Personalizado</option></select>`);
    $('psProfile').onchange = e => {
      const ts = App.selection.flatMap(x => (x.tagName === 'g' ? leafShapes(x) : [x])).filter(s => isShape(s) && !Layers.isLocked(s)); if (!ts.length) return;
      for (const s of ts) Brushes.applyTo(s, e.target.value === 'uniform' ? null : { id: 'profile', fx: { t: 'width', p: { profile: e.target.value, k: 1 } } });
      LiveFX.resync(); History.named('Perfil de anchura', () => History.commit()); Selection.changed();
    };
    const pull = () => { const s = App.selection[0], f = s && LiveFX.list(s).find(x => x.t === 'width'); $('psProfile').value = f ? (f.p.pts ? 'custom' : f.p.profile || 'uniform') : 'uniform'; };
    App.on('selection', pull); App.on('change', pull);
  },
};

/* ---------- herramienta Anchura (Mayús+W) ---------- */
ICONS.width = '<path d="M3 12c4-6 14-6 18 0c-4 6-14 6-18 0z"/><path d="M12 6v12M10 8l2-2 2 2M10 16l2 2 2-2"/>';
TOOL_INFO.width = ['Anchura', 'Mayús+W'];
TOOL_GROUPS.find(g => Array.isArray(g) && g.includes('rotate')).push('width');
App.tools.width = {
  cursor: 'crosshair',
  candidates() {
    const sel = App.selection.flatMap(e => (e.tagName === 'g' ? leafShapes(e) : [e])).filter(s => s.tagName === 'path' || isShape(s));
    const all = sel.length ? sel : Layers.objects().filter(o => !Layers.isLocked(o) && !Layers.isHidden(o)).flatMap(o => (o.tagName === 'g' ? leafShapes(o) : [o])).filter(isShape).slice(0, 300);
    return all.filter(s => s.hasAttribute('data-ostroke') || (getStyle(s, 'stroke') || 'none') !== 'none');
  },
  near(sp) {
    let best = null;
    for (const el of this.candidates()) {
      const m = el.getCTM(); if (!m) continue;
      const subs = el.tagName === 'path' ? PathData.parse(el.getAttribute('data-src') ?? el.getAttribute('d') ?? '') : PathData.parse(Geo.fromShape(el) || '');
      const sc = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1, W = LiveFX.baseWidth(el);
      subs.forEach((s, si) => {
        const S = arcSamples(s, 2 / sc);
        S.pts.forEach((q, i) => { const p = Geo.pt(m, q.x, q.y), d = Geo.dist(p, sp); if (d < 12 + W * sc && (!best || d < best.d)) best = { el, si, u: S.L ? S.cum[i] / S.L : 0, S, i, d, sc }; });
      });
    }
    return best;
  },
  hover(p, ev, sp) { this.hot = this.near(sp); Selection.draw(); },
  down(p, ev, sp) {
    const h = this.near(sp); if (!h) return;
    let el = h.el;
    if (!LiveFX.list(el).some(f => f.t === 'width')) el = Brushes.applyTo(el, { id: 'profile', fx: { t: 'width', p: { profile: 'uniform', k: 1 } } });
    const L = LiveFX.list(el), f = L.find(x => x.t === 'width');
    f.p.pts ||= (WIDTH_PROFILES[f.p.profile] || WIDTH_PROFILES.uniform)[1].map(x => [...x]); delete f.p.profile;
    let pt = f.p.pts.find(q => Math.abs(q[0] - h.u) < 0.025);
    if (!pt) { pt = [round(h.u, 4), widthAt(f.p.pts, h.u)]; f.p.pts.push(pt); f.p.pts.sort((a, b) => a[0] - b[0]); }
    LiveFX.write(el, L);
    const q = arcAt(h.S, h.S.cum[h.i]);
    this.drag = { id: el.id, u: pt[0], q, k: +f.p.k || 1 };
    Selection.set([el]);
  },
  move(p, ev, sp) {
    const d = this.drag; if (!d) return;
    const el = document.getElementById(d.id); if (!el) return;
    const inv = el.getCTM().inverse(), q = Geo.pt(inv, sp.x, sp.y), dist = Math.abs((q.x - d.q.x) * d.q.nx + (q.y - d.q.y) * d.q.ny);
    const L = LiveFX.list(el), f = L.find(x => x.t === 'width'); if (!f) return;
    const pt = f.p.pts.find(x => x[0] === d.u); if (!pt) return;
    pt[1] = round(Math.max(0, 2 * dist / (LiveFX.baseWidth(el) * d.k)), 3);
    LiveFX.write(el, L); Selection.draw();
  },
  up() { if (!this.drag) return; this.drag = null; History.named('Anchura', () => History.commit()); App.emit('selection'); },
  /* doble clic sobre un punto de anchura: quitarlo */
  dblclick(p, ev, sp) {
    const h = this.near(sp); if (!h) return;
    const L = LiveFX.list(h.el), f = L.find(x => x.t === 'width'); if (!f || !f.p.pts) return;
    const i = f.p.pts.findIndex(q => Math.abs(q[0] - h.u) < 0.025 && q[0] > 0 && q[0] < 1);
    if (i >= 0) { f.p.pts.splice(i, 1); LiveFX.write(h.el, L); History.named('Quitar punto de anchura', () => History.commit()); Selection.draw(); }
  },
  overlay(g) {
    const draw = (el, S, u, mark) => {
      const m = el.getCTM(), L = LiveFX.list(el), f = L.find(x => x.t === 'width'), W = LiveFX.baseWidth(el) * (f ? +f.p.k || 1 : 1);
      const pts = f ? f.p.pts || (WIDTH_PROFILES[f.p.profile] || WIDTH_PROFILES.uniform)[1] : [[0, 1], [1, 1]];
      const a = arcAt(S, u * S.L), w = W * widthAt(pts, u) / 2;
      const A = Geo.pt(m, a.x + a.nx * w, a.y + a.ny * w), B = Geo.pt(m, a.x - a.nx * w, a.y - a.ny * w);
      svgEl('line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: '#1e90ff', 'stroke-width': 1 }, g);
      for (const P of [A, B]) svgEl('rect', { x: P.x - 3, y: P.y - 3, width: 6, height: 6, transform: `rotate(45 ${P.x} ${P.y})`, fill: mark ? '#1e90ff' : '#fff', stroke: '#1e90ff' }, g);
      return f;
    };
    if (this.hot) {
      const f = draw(this.hot.el, this.hot.S, this.hot.u, false);
      if (f && f.p.pts) for (const [u] of f.p.pts) if (u > 0 && u < 1) draw(this.hot.el, this.hot.S, u, true);
    }
  },
};

/* ---------- Objeto ▸ Distorsión de envolvente ▸ Deformar ---------- */
const Envelope = {
  async warp(style = 'arc') {
    const ids = LiveFX.targets(); if (!ids.length) return Dialog.alert('Selecciona uno o más trazados (convierte los textos en contornos para deformarlos).');
    const els = LiveFX.byIds(ids), all = Geo.union(els.map(e => Geo.bbox(e)).filter(Boolean)); if (!all) return;
    /* caja común en coordenadas locales de cada trazado, para deformar el conjunto como un todo */
    const boxOf = el => { const inv = Geo.toDoc(el).inverse(), c = [[all.x, all.y], [all.x + all.width, all.y], [all.x, all.y + all.height], [all.x + all.width, all.y + all.height]].map(([x, y]) => Geo.pt(inv, x, y));
      const xs = c.map(q => q.x), ys = c.map(q => q.y); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)].map(v => round(v, 3)); };
    const boxes = Object.fromEntries(els.map(e => [e.id, boxOf(e)]));
    const snap = History.snapshot();
    const apply = v => { for (const el of LiveFX.byIds(ids)) { const e = LiveFX.prepare(el); LiveFX.write(e, [...LiveFX.list(e), { t: 'warp', p: { ...v, box: boxes[e.id] } }]); } Selection.draw(); };
    const v = await Dialog.form('Opciones de deformación', FX.warp.fields.map(f => (f.id === 'style' ? { ...f, value: style } : f)), { preview: apply, revert: () => Dialog.revertTo(snap), note: 'La deformación queda editable en el panel Apariencia; Objeto ▸ Expandir apariencia la fija.' });
    if (!v) return; delete v._button; apply(v); LiveFX.resync(); History.named('Deformar', () => History.commit()); Selection.changed();
  },
};
