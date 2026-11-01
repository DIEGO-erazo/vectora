/* Vectora — malla de degradado (U). Los navegadores no dibujan mallas SVG, así que la malla
   se calcula como imagen (interpolación de los colores de cada celda) recortada a la forma.
   Los datos (puntos y colores) se guardan en data-mesh y la imagen se regenera al editar. */
'use strict';

const Mesh = {
  get(g) { try { return JSON.parse(g.getAttribute('data-mesh')); } catch (e) { return null; } },
  of(el) { return el && el.closest && el.closest('g[data-mesh]'); },
  /* convierte una forma en malla de 1×1 celdas con su color */
  create(s) {
    const b = Geo.bbox(s), f = getStyle(s, 'fill'), col = f && /^#/.test(normColor(f)) ? normColor(f) : '#888888';
    const M = { d: PathData.serialize(pathSubsDoc(s)), P: [[{ x: b.x, y: b.y }, { x: b.x + b.width, y: b.y }], [{ x: b.x, y: b.y + b.height }, { x: b.x + b.width, y: b.y + b.height }]], C: [[col, col], [col, col]] };
    const g = svgEl('g', { id: uid('mesh'), 'data-name': 'Malla de degradado' }); s.before(g); s.remove(); placeDocPath(g);
    g.setAttribute('data-mesh', JSON.stringify(M)); this.render(g); return g;
  },
  /* punto de la celda (i, j) en (u, v): superficie suave (Catmull-Rom) que pasa por los puntos,
     así las líneas de la malla se curvan al mover un punto, como en Illustrator */
  at(M, i, j, u, v) {
    const R = M.P.length, C = M.P[0].length, P = (r, c) => M.P[clamp(r, 0, R - 1)][clamp(c, 0, C - 1)];
    const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
    const row = r => { const a = P(r, j - 1), b = P(r, j), c = P(r, j + 1), d = P(r, j + 2); return { x: cr(a.x, b.x, c.x, d.x, u), y: cr(a.y, b.y, c.y, d.y, u) }; };
    const q0 = row(i - 1), q1 = row(i), q2 = row(i + 1), q3 = row(i + 2);
    return { x: cr(q0.x, q1.x, q2.x, q3.x, v), y: cr(q0.y, q1.y, q2.y, q3.y, v) };
  },
  /* versión bilineal (la usa el muestreo rápido de la imagen) */
  atLinear(M, i, j, u, v) {
    const a = M.P[i][j], b = M.P[i][j + 1], c = M.P[i + 1][j + 1], d = M.P[i + 1][j];
    return { x: (1 - u) * (1 - v) * a.x + u * (1 - v) * b.x + u * v * c.x + (1 - u) * v * d.x, y: (1 - u) * (1 - v) * a.y + u * (1 - v) * b.y + u * v * c.y + (1 - u) * v * d.y };
  },
  colorAt(M, i, j, u, v) {
    const s = t => t * t * (3 - 2 * t), U = s(u), V = s(v), C = [M.C[i][j], M.C[i][j + 1], M.C[i + 1][j + 1], M.C[i + 1][j]].map(hexToRgb);
    const w = [(1 - U) * (1 - V), U * (1 - V), U * V, (1 - U) * V], k = ch => C.reduce((a, c, n) => a + c[ch] * w[n], 0);
    return `rgb(${Math.round(k('r'))},${Math.round(k('g'))},${Math.round(k('b'))})`;
  },
  /* celda y coordenadas locales de un punto (búsqueda por subdivisión) */
  locate(M, p) {
    let best = null;
    for (let i = 0; i < M.P.length - 1; i++) for (let j = 0; j < M.P[0].length - 1; j++) {
      const N = 24;
      for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) {
        const u = (b + 0.5) / N, v = (a + 0.5) / N, q = this.at(M, i, j, u, v), d = Geo.dist(q, p);
        if (!best || d < best.d) best = { i, j, u, v, d };
      }
    }
    /* refinar dentro de la celda encontrada */
    if (best) for (let step = 1 / 24; step > 1e-4; step /= 2) {
      let improved = true;
      while (improved) {
        improved = false;
        for (const [du, dv] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
          const u = clamp(best.u + du, 0, 1), v = clamp(best.v + dv, 0, 1), d = Geo.dist(this.at(M, best.i, best.j, u, v), p);
          if (d < best.d - 1e-9) { Object.assign(best, { u, v, d }); improved = true; }
        }
      }
    }
    return best;
  },
  render(g) {
    const M = this.get(g); if (!M) return;
    const all = M.P.flat(), b = Geo.union(all.map(q => ({ x: q.x, y: q.y, width: 0, height: 0 }))), sb = Geo.union([b, ...PathData.parse(M.d).flatMap(s => s.nodes).map(n => ({ x: n.x, y: n.y, width: 0, height: 0 }))]);
    const k = Math.min(3, 1600 / Math.max(sb.width, sb.height, 1)), cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(sb.width * k)); cv.height = Math.max(1, Math.ceil(sb.height * k));
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, idata = ctx.createImageData(W, H), D = idata.data;
    const sm = t => t * t * (3 - 2 * t);
    /* muestreo directo: cada celda se recorre con paso de ~0,5 px y se escriben los píxeles */
    for (let i = 0; i < M.P.length - 1; i++) for (let j = 0; j < M.P[0].length - 1; j++) {
      const a = M.P[i][j], b = M.P[i][j + 1], c = M.P[i + 1][j + 1], d = M.P[i + 1][j];
      const C = [M.C[i][j], M.C[i][j + 1], M.C[i + 1][j + 1], M.C[i + 1][j]].map(hexToRgb);
      const nu = clamp(Math.ceil(Math.max(Geo.dist(a, b), Geo.dist(d, c)) * k * 2), 2, 4000), nv = clamp(Math.ceil(Math.max(Geo.dist(a, d), Geo.dist(b, c)) * k * 2), 2, 4000);
      /* posiciones de la superficie suave en una red gruesa; dentro, bilineal (rápido) */
      const G = 16, grid = []; for (let gy = 0; gy <= G; gy++) { const r = []; for (let gx = 0; gx <= G; gx++) r.push(this.at(M, i, j, gx / G, gy / G)); grid.push(r); }
      for (let y = 0; y <= nv; y++) {
        const v = y / nv, V = sm(v), gy = Math.min(G - 1, Math.floor(v * G)), fv = v * G - gy;
        for (let x = 0; x <= nu; x++) {
          const u = x / nu, U = sm(u), gx = Math.min(G - 1, Math.floor(u * G)), fu = u * G - gx;
          const A = grid[gy][gx], B = grid[gy][gx + 1], Cc = grid[gy + 1][gx + 1], Dd = grid[gy + 1][gx];
          const w0 = (1 - fu) * (1 - fv), w1 = fu * (1 - fv), w2 = fu * fv, w3 = (1 - fu) * fv;
          const px = Math.floor(((w0 * A.x + w1 * B.x + w2 * Cc.x + w3 * Dd.x) - sb.x) * k), py = Math.floor(((w0 * A.y + w1 * B.y + w2 * Cc.y + w3 * Dd.y) - sb.y) * k);
          if (px < 0 || py < 0 || px >= W || py >= H) continue;
          const q0 = (1 - U) * (1 - V), q1 = U * (1 - V), q2 = U * V, q3 = (1 - U) * V, o = (py * W + px) * 4;
          D[o] = C[0].r * q0 + C[1].r * q1 + C[2].r * q2 + C[3].r * q3; D[o + 1] = C[0].g * q0 + C[1].g * q1 + C[2].g * q2 + C[3].g * q3;
          D[o + 2] = C[0].b * q0 + C[1].b * q1 + C[2].b * q2 + C[3].b * q3; D[o + 3] = 255;
        }
      }
    }
    ctx.putImageData(idata, 0, 0);
    let cp = g.querySelector(':scope > clipPath'); if (!cp) cp = svgEl('clipPath', { id: uid('mclip'), clipPathUnits: 'userSpaceOnUse' }, g);
    cp.innerHTML = ''; svgEl('path', { d: M.d }, cp);
    let img = g.querySelector(':scope > image'); if (!img) img = svgEl('image', { preserveAspectRatio: 'none' }, g);
    setA(img, { x: sb.x, y: sb.y, width: sb.width, height: sb.height }); img.setAttribute('href', cv.toDataURL('image/png')); img.setAttribute('clip-path', `url(#${cp.id})`);
  },
  /* añade una fila y una columna que pasan por el punto */
  addLines(g, p) {
    const M = this.get(g), L = this.locate(M, p); if (!L || L.d > 2 / App.view.zoom || L.u < 0.01 || L.u > 0.99 || L.v < 0.01 || L.v > 0.99) return null;
    const R = M.P.length, Cn = M.P[0].length;
    /* columna nueva en u (en todas las filas, entre j y j+1) */
    for (let r = 0; r < R; r++) {
      const a = M.P[r][L.j], b = M.P[r][L.j + 1], ca = hexToRgb(M.C[r][L.j]), cb = hexToRgb(M.C[r][L.j + 1]);
      M.P[r].splice(L.j + 1, 0, { x: a.x + (b.x - a.x) * L.u, y: a.y + (b.y - a.y) * L.u });
      M.C[r].splice(L.j + 1, 0, rgbToHex(ca.r + (cb.r - ca.r) * L.u, ca.g + (cb.g - ca.g) * L.u, ca.b + (cb.b - ca.b) * L.u));
    }
    /* fila nueva en v (entre i e i+1) */
    const row = [], crow = [];
    for (let c = 0; c < Cn + 1; c++) {
      const a = M.P[L.i][c], b = M.P[L.i + 1][c], ca = hexToRgb(M.C[L.i][c]), cb = hexToRgb(M.C[L.i + 1][c]);
      row.push({ x: a.x + (b.x - a.x) * L.v, y: a.y + (b.y - a.y) * L.v }); crow.push(rgbToHex(ca.r + (cb.r - ca.r) * L.v, ca.g + (cb.g - ca.g) * L.v, ca.b + (cb.b - ca.b) * L.v));
    }
    M.P.splice(L.i + 1, 0, row); M.C.splice(L.i + 1, 0, crow);
    /* el punto nuevo queda exactamente donde se hizo clic */
    M.P[L.i + 1][L.j + 1] = { x: p.x, y: p.y };
    g.setAttribute('data-mesh', JSON.stringify(M)); this.render(g);
    return [L.i + 1, L.j + 1];
  },
  release(g = this.of(App.selection[0])) {
    if (!g) return; const M = this.get(g), p = svgEl('path', { id: uid(), d: M.d, fill: M.C[0][0] }); g.before(p); g.remove(); placeDocPath(p);
    Selection.set([p]); History.named('Liberar malla', () => History.commit()); App.emit('layers');
  },
};
App.tools.mesh = {
  cursor: 'crosshair',
  pts(g) { const M = Mesh.get(g); return M ? M.P.flatMap((r, i) => r.map((q, j) => ({ i, j, q }))) : []; },
  hitPoint(g, sp) { return this.pts(g).find(({ q }) => Geo.dist(View.docToStage(q.x, q.y), sp) < 7); },
  down(p, ev, sp) {
    let g = Mesh.of(App.selection[0]);
    const h = g && this.hitPoint(g, sp);
    if (h) { this.sel = [h.i, h.j]; this.drag = { g, p0: p, q0: { ...h.q } }; Selection.draw(); return; }
    let o = hitObject(ev);
    if (o && Mesh.of(o)) g = Mesh.of(o);
    else if (o && isShape(o)) { g = Mesh.create(o); Selection.set([g]); }
    if (!g) return;
    Selection.set([g]); const s = Mesh.addLines(g, p); if (s) this.sel = s;
    History.named('Malla de degradado', () => History.commit()); Selection.draw();
  },
  move(p) {
    const d = this.drag; if (!d) return;
    const M = Mesh.get(d.g), [i, j] = this.sel; M.P[i][j] = { x: d.q0.x + p.x - d.p0.x, y: d.q0.y + p.y - d.p0.y };
    d.g.setAttribute('data-mesh', JSON.stringify(M)); Mesh.render(d.g); Selection.draw();
  },
  up() { if (this.drag) { this.drag = null; History.named('Mover punto de malla', () => History.commit()); } },
  overlay(g) {
    const m = Mesh.of(App.selection[0]); if (!m) return; const M = Mesh.get(m); if (!M) return;
    const S = q => View.docToStage(q.x, q.y);
    const R = M.P.length, C = M.P[0].length, K = 12, pts = [];
    for (let i = 0; i < R; i++) { const L = []; for (let j = 0; j < C - 1; j++) for (let k = 0; k <= K; k++) L.push(S(Mesh.at(M, Math.min(i, R - 2), j, k / K, i === R - 1 ? 1 : 0))); pts.push(L); }
    for (let j = 0; j < C; j++) { const L = []; for (let i = 0; i < R - 1; i++) for (let k = 0; k <= K; k++) L.push(S(Mesh.at(M, i, Math.min(j, C - 2), j === C - 1 ? 1 : 0, k / K))); pts.push(L); }
    for (const L of pts) svgEl('polyline', { points: L.map(s => `${s.x},${s.y}`).join(' '), fill: 'none', stroke: '#1e90ff' }, g);
    M.P.forEach((r, i) => r.forEach((q, j) => { const s = S(q), on = this.sel && this.sel[0] === i && this.sel[1] === j; svgEl('rect', { x: s.x - 3.5, y: s.y - 3.5, width: 7, height: 7, transform: `rotate(45 ${s.x} ${s.y})`, fill: on ? '#1e90ff' : M.C[i][j], stroke: on ? '#fff' : '#1e90ff' }, g); }));
  },
  activate() { this.sel = null; $('sbHint').textContent = 'Malla: clic en una forma para crear la malla o añadir líneas · elige un punto y un color · arrastra los puntos'; },
  deactivate() { $('sbHint').textContent = ''; },
};
ICONS.mesh = '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 11c5-2 11 2 16 0M11 4c-2 5 2 11 0 16"/>';
TOOL_INFO.mesh = ['Malla', 'U'];
TOOL_GROUPS.find(g => Array.isArray(g) && g.includes('gradient')).push('mesh');
/* con la herramienta Malla y un punto elegido, el color se aplica al punto */
(() => {
  const base = Panels.setColor.bind(Panels);
  Panels.setColor = function (which, value, commit = true) {
    const t = App.tools.mesh, g = Mesh.of(App.selection[0]);
    if (App.toolName === 'mesh' && g && t.sel && /^#[0-9a-f]{6}$/i.test(value)) {
      const M = Mesh.get(g); M.C[t.sel[0]][t.sel[1]] = value.toLowerCase(); g.setAttribute('data-mesh', JSON.stringify(M)); Mesh.render(g);
      App[which] = value; if (commit) History.named('Color de malla', () => History.commit()); this.refresh(); Selection.draw(); return;
    }
    return base(which, value, commit);
  };
})();
