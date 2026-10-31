/* Vectora — efectos de distorsión, redondear esquinas y editar colores */
'use strict';

/* aplica fn(subs, el) a cada forma seleccionada (en coordenadas del documento) */
function eachShapePath(fn) {
  for (const top of App.selection) for (const s of (top.tagName === 'g' ? leafShapes(top) : [top]).filter(isShape)) {
    const subs = pathSubsDoc(s); if (!subs.length) continue;
    const out = fn(subs, s); if (out) replaceWithPath(s, out, styleAttrs(s));
  }
  Selection.set(App.selection.filter(e => e.isConnected));
}
/* divide cada segmento en n tramos (para que las distorsiones queden suaves) */
function subdivide(subs, n) {
  return subs.map(s => {
    const N = s.nodes.map(c => ({ x: c.x, y: c.y, hin: c.hin && { ...c.hin }, hout: c.hout && { ...c.hout } }));
    const segs = s.closed ? N.length : N.length - 1, out = [];
    for (let i = 0; i < N.length; i++) {
      out.push(N[i]); if (i >= segs) continue;
      /* splitBez ajusta los manejadores de a y b: partir en 1/n, luego 1/(n-1)… da tramos iguales */
      let a = N[i]; const b = N[(i + 1) % N.length];
      for (let k = n; k > 1; k--) { const m = splitBez(a, b, 1 / k); out.push(m); a = m; }
    }
    return { nodes: out, closed: s.closed };
  });
}
const centerOf = subs => { const b = Geo.union(subs.flatMap(s => s.nodes).map(n => ({ x: n.x, y: n.y, width: 0, height: 0 }))); return { x: b.x + b.width / 2, y: b.y + b.height / 2, r: Math.hypot(b.width, b.height) / 2 || 1 }; };
const mapPoints = (subs, f) => subs.forEach(s => s.nodes.forEach(n => { Object.assign(n, f(n, 'a')); if (n.hin) n.hin = f(n.hin, 'h'); if (n.hout) n.hout = f(n.hout, 'h'); }));
/* convierte tramos rectos en curvas (manejadores a 1/3) para poder deformarlos */
function curvify(subs) {
  for (const s of subs) s.nodes.forEach((a, i) => {
    const b = s.nodes[(i + 1) % s.nodes.length]; if (!s.closed && i === s.nodes.length - 1) return;
    if (!a.hout && !b.hin) { a.hout = { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 }; b.hin = { x: a.x + (b.x - a.x) * 2 / 3, y: a.y + (b.y - a.y) * 2 / 3 }; }
  });
  return subs;
}
/* puntos equiespaciados por tramo (para zigzag y rugosidad) */
function resample(sub, perSeg) {
  const pts = [], N = sub.nodes, segs = sub.closed ? N.length : N.length - 1;
  for (let i = 0; i < segs; i++) { const a = N[i], b = N[(i + 1) % N.length]; for (let k = 0; k < perSeg; k++) pts.push(bez(a, b, k / perSeg)); }
  if (!sub.closed) pts.push({ x: N[N.length - 1].x, y: N[N.length - 1].y });
  return pts;
}
let rngSeed = 1; const rnd = () => ((rngSeed = (rngSeed * 16807) % 2147483647) / 2147483647);

const Distort = {
  pucker() {
    Dialog.edit('Fruncir y engordar', [{ id: 'a', label: 'Cantidad (%)', type: 'number', value: 30, min: -200, max: 200, step: 5 }], v => eachShapePath(subs => {
      const k = (+v.a || 0) / 100, c = centerOf(subs); subs = curvify(subs);
      mapPoints(subs, (p, kind) => kind === 'a' ? { x: p.x + (p.x - c.x) * k * 0.5, y: p.y + (p.y - c.y) * k * 0.5 } : { x: p.x - (p.x - c.x) * k, y: p.y - (p.y - c.y) * k });
      return subs;
    }));
  },
  twist() {
    Dialog.edit('Retorcer', [{ id: 'a', label: 'Ángulo (°)', type: 'number', value: 60, min: -3600, max: 3600, step: 5 }], v => eachShapePath(subs => {
      subs = subdivide(subs, 6); const c = centerOf(subs), A = (+v.a || 0) * Math.PI / 180;
      mapPoints(subs, p => { const d = Math.hypot(p.x - c.x, p.y - c.y), t = A * (1 - Math.min(1, d / c.r)), co = Math.cos(t), si = Math.sin(t);
        return { x: c.x + (p.x - c.x) * co - (p.y - c.y) * si, y: c.y + (p.x - c.x) * si + (p.y - c.y) * co }; });
      return subs;
    }));
  },
  zigzag() {
    Dialog.edit('Zigzag', [
      { id: 's', label: 'Tamaño (px)', type: 'number', value: 8, min: 0, step: 1 },
      { id: 'n', label: 'Crestas por segmento', type: 'number', value: 6, min: 1, max: 100 },
      { id: 'smooth', label: 'Puntos', type: 'select', value: 'corner', options: [['corner', 'Vértice'], ['smooth', 'Suavizar']] },
    ], v => eachShapePath(subs => subs.map(s => {
      const per = Math.max(1, Math.round(+v.n)) * 2, pts = resample(s, per), size = +v.s || 0;
      const out = pts.map((p, i) => {
        const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
        if (!s.closed && (i === 0 || i === pts.length - 1)) return p;
        const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, sg = i % 2 ? 1 : -1;
        return { x: p.x - dy / L * size * sg, y: p.y + dx / L * size * sg };
      });
      return { nodes: v.smooth === 'smooth' ? smoothNodes(out, s.closed) : out.map(p => ({ ...p, hin: null, hout: null })), closed: s.closed };
    })));
  },
  roughen() {
    Dialog.edit('Rugosidad', [
      { id: 's', label: 'Tamaño (px)', type: 'number', value: 6, min: 0, step: 1 },
      { id: 'd', label: 'Detalle (puntos por segmento)', type: 'number', value: 8, min: 1, max: 100 },
      { id: 'smooth', label: 'Puntos', type: 'select', value: 'smooth', options: [['smooth', 'Suavizar'], ['corner', 'Vértice']] },
      { id: 'seed', label: 'Variación', type: 'number', value: 1, min: 1, max: 9999 },
    ], v => { rngSeed = Math.max(1, Math.round(+v.seed)) * 9973; eachShapePath(subs => subs.map(s => {
      const pts = resample(s, Math.max(1, Math.round(+v.d))), size = +v.s || 0;
      const out = pts.map(p => ({ x: p.x + (rnd() * 2 - 1) * size, y: p.y + (rnd() * 2 - 1) * size }));
      return { nodes: v.smooth === 'smooth' ? smoothNodes(out, s.closed) : out.map(p => ({ ...p, hin: null, hout: null })), closed: s.closed };
    })); });
  },
  roundCorners() {
    Dialog.edit('Redondear esquinas', [{ id: 'r', label: 'Radio (px)', type: 'number', value: 12, min: 0, step: 1 }], v => eachShapePath(subs => subs.map(s => {
      const r = +v.r || 0, N = s.nodes, out = [], K = 0.5523;
      N.forEach((n, i) => {
        const prev = N[(i - 1 + N.length) % N.length], next = N[(i + 1) % N.length], end = !s.closed && (i === 0 || i === N.length - 1);
        if (end || n.hin || n.hout || prev.hout || next.hin || !r) return out.push({ ...n });
        const d1 = Geo.dist(n, prev), d2 = Geo.dist(n, next), t = Math.min(r, d1 / 2, d2 / 2);
        if (t < 0.01) return out.push({ ...n });
        const u1 = { x: (prev.x - n.x) / d1, y: (prev.y - n.y) / d1 }, u2 = { x: (next.x - n.x) / d2, y: (next.y - n.y) / d2 };
        const a = { x: n.x + u1.x * t, y: n.y + u1.y * t }, b = { x: n.x + u2.x * t, y: n.y + u2.y * t };
        out.push({ ...a, hin: null, hout: { x: a.x - u1.x * t * K, y: a.y - u1.y * t * K } }, { ...b, hin: { x: b.x - u2.x * t * K, y: b.y - u2.y * t * K }, hout: null });
      });
      return { nodes: out, closed: s.closed };
    })));
  },
};

/* ---------- Editar colores ---------- */
const Recolor = {
  /* aplica f(rgb) a todos los colores (relleno, trazo y paradas de degradado) de la selección */
  apply(f) {
    const conv = c => { c = normColor(c); if (!c.startsWith('#')) return null; const o = f(hexToRgb(c)); return rgbToHex(o.r, o.g, o.b); };
    const grads = new Set();
    for (const s of App.selection.flatMap(e => [e, ...e.querySelectorAll('*')])) {
      for (const a of ['fill', 'stroke']) {
        const v = getStyle(s, a); if (!v || v === 'none') continue;
        const m = v.match(/url\(\s*#([^)]+)\)/); if (m) { grads.add(m[1]); continue; }
        const n = conv(v); if (n) s.setAttribute(a, n);
      }
    }
    for (const id of grads) for (const st of (document.getElementById(id) || { querySelectorAll: () => [] }).querySelectorAll('stop')) { const n = conv(st.getAttribute('stop-color') || '#000'); if (n) st.setAttribute('stop-color', n); }
  },
  invert() { this.apply(c => ({ r: 255 - c.r, g: 255 - c.g, b: 255 - c.b })); History.commit(); },
  grayscale() { this.apply(c => { const g = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b; return { r: g, g, b: g }; }); History.commit(); },
  saturate() {
    Dialog.edit('Saturar', [{ id: 'k', label: 'Intensidad (%)', type: 'number', value: 30, min: -100, max: 100, step: 5 }], v => this.apply(c => {
      const h = rgbToHsv(c.r, c.g, c.b), s = clamp(h.s * (1 + +v.k / 100), 0, 1), o = hsvToRgb(h.h, s, h.v); return o; }));
  },
  balance() {
    Dialog.edit('Ajustar equilibrio de color', [
      { id: 'r', label: 'Rojo (%)', type: 'number', value: 0, min: -100, max: 100 }, { id: 'g', label: 'Verde (%)', type: 'number', value: 0, min: -100, max: 100 },
      { id: 'b', label: 'Azul (%)', type: 'number', value: 0, min: -100, max: 100 },
    ], v => this.apply(c => ({ r: clamp(c.r + 2.55 * +v.r, 0, 255), g: clamp(c.g + 2.55 * +v.g, 0, 255), b: clamp(c.b + 2.55 * +v.b, 0, 255) })));
  },
  /* fusionar de delante a detrás: los objetos intermedios toman colores intermedios */
  blendFrontBack() {
    const objs = docOrder(App.selection).filter(o => /^#/.test(normColor(getStyle(o, 'fill') || 'none')));
    if (objs.length < 3) return Dialog.alert('Selecciona al menos tres objetos con relleno de color.');
    const A = hexToRgb(normColor(getStyle(objs[objs.length - 1], 'fill'))), B = hexToRgb(normColor(getStyle(objs[0], 'fill')));
    objs.forEach((o, i) => { if (!i || i === objs.length - 1) return; const t = i / (objs.length - 1);
      setStyle([o], 'fill', rgbToHex(B.r + (A.r - B.r) * t, B.g + (A.g - B.g) * t, B.b + (A.b - B.b) * t)); });
    History.commit();
  },
};
