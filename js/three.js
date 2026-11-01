/* Vectora — 3D sencillo: Extruir y biselar, y Revolución. El resultado es un grupo de caras
   sombreadas (g[data-3d]) que guarda el trazado de origen para volver a editarlo. */
'use strict';

const Three = {
  /* rotación X, Y, Z (grados) de un punto 3D */
  rot(p, ax, ay, az) {
    const r = Math.PI / 180, [cx, sx, cy, sy, cz, sz] = [Math.cos(ax * r), Math.sin(ax * r), Math.cos(ay * r), Math.sin(ay * r), Math.cos(az * r), Math.sin(az * r)];
    let { x, y, z } = p;
    [y, z] = [y * cx - z * sx, y * sx + z * cx];
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    [x, y] = [x * cz - y * sz, x * sz + y * cz];
    return { x, y, z };
  },
  /* color de una cara según su normal (luz desde arriba a la izquierda, delante) */
  shade(hex, n, light) {
    const L = { x: -0.45, y: -0.6, z: 0.66 }, ln = Math.hypot(L.x, L.y, L.z), d = (n.x * L.x + n.y * L.y + n.z * L.z) / ln;
    const k = 0.35 + 0.65 * Math.max(0, d) * light + 0.25 * (1 - light), c = hexToRgb(/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#888888');
    const hi = Math.max(0, d) ** 24 * 0.35 * light;
    return rgbToHex(clamp(c.r * k + 255 * hi, 0, 255), clamp(c.g * k + 255 * hi, 0, 255), clamp(c.b * k + 255 * hi, 0, 255));
  },
  normal(f) {
    const [a, b, c] = f; const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }, v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const n = { x: u.y * v.z - u.z * v.y, y: u.z * v.x - u.x * v.z, z: u.x * v.y - u.y * v.x }, l = Math.hypot(n.x, n.y, n.z) || 1;
    return { x: n.x / l, y: n.y / l, z: n.z / l };
  },
  /* caras 3D (listas de puntos) a partir del trazado */
  faces(subs, p) {
    const rings = subs.map(s => { const pts = Boolean2D.flatten(s); if (s.closed && pts.length > 1 && Geo.dist(pts[0], pts[pts.length - 1]) < 1e-6) pts.pop(); return { pts: rdp(pts, 0.3), closed: s.closed }; }).filter(r => r.pts.length > 1);
    const all = rings.flatMap(r => r.pts), b = Geo.union(all.map(q => ({ x: q.x, y: q.y, width: 0, height: 0 }))), c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const F = [];
    if (p.kind === 'revolve') {
      /* el perfil gira alrededor de un eje vertical en el borde izquierdo (o derecho) */
      const axis = p.side === 'right' ? b.x + b.width : b.x, N = clamp(Math.round(+p.segs || 24), 6, 96), ang = clamp(+p.angle || 360, 1, 360) * Math.PI / 180;
      for (const r of rings) {
        const segs = r.closed ? r.pts.length : r.pts.length - 1;
        for (let i = 0; i < segs; i++) {
          const a = r.pts[i], bb = r.pts[(i + 1) % r.pts.length];
          for (let k = 0; k < N; k++) {
            const t0 = ang * k / N, t1 = ang * (k + 1) / N, P = (q, t) => { const rr = q.x - axis; return { x: rr * Math.cos(t), y: q.y - c.y, z: rr * Math.sin(t) }; };
            F.push({ pts: [P(a, t0), P(bb, t0), P(bb, t1), P(a, t1)], side: true });
          }
        }
      }
    } else {
      const d = (+p.depth || 50) / 2, bev = Math.max(0, +p.bevel || 0);
      const front = rings.filter(r => r.closed).map(r => r.pts.map(q => ({ x: q.x - c.x, y: q.y - c.y, z: d })));
      const back = front.map(r => r.map(q => ({ ...q, z: -d })).reverse());
      F.push({ pts: front, cap: true }, { pts: back, cap: true });
      for (const r of rings) {
        const segs = r.closed ? r.pts.length : r.pts.length - 1;
        for (let i = 0; i < segs; i++) {
          const a = r.pts[i], bb = r.pts[(i + 1) % r.pts.length], A = { x: a.x - c.x, y: a.y - c.y }, B = { x: bb.x - c.x, y: bb.y - c.y };
          if (bev) { /* bisel: una banda inclinada en el frente */
            const mid = d - bev;
            F.push({ pts: [{ ...A, z: -d }, { ...B, z: -d }, { ...B, z: mid }, { ...A, z: mid }], side: true });
            const s = (q, k) => ({ x: q.x * k, y: q.y * k });
            const k = Math.max(0.2, 1 - bev / Math.max(b.width, b.height));
            F.push({ pts: [{ ...A, z: mid }, { ...B, z: mid }, { ...s(B, k), z: d }, { ...s(A, k), z: d }], side: true });
          } else F.push({ pts: [{ ...A, z: -d }, { ...B, z: -d }, { ...B, z: d }, { ...A, z: d }], side: true });
        }
      }
      if (bev) { const k = Math.max(0.2, 1 - bev / Math.max(b.width, b.height)); F[0].pts = F[0].pts.map(r => r.map(q => ({ x: q.x * k, y: q.y * k, z: q.z }))); }
    }
    return { F, c };
  },
  /* proyecta, sombrea y ordena (pintor) */
  render(g) {
    const P = JSON.parse(g.getAttribute('data-3d')), subs = PathData.parse(P.d), { F, c } = this.faces(subs, P);
    const persp = +P.persp || 0, f = persp ? 1200 / (persp / 30) : 0;
    const proj = q => { const r = this.rot(q, +P.rx || 0, +P.ry || 0, +P.rz || 0), k = f ? f / (f - r.z) : 1; return { x: c.x + r.x * k, y: c.y + r.y * k, z: r.z }; };
    const out = [];
    for (const face of F) {
      const rings = face.cap ? face.pts : [face.pts]; if (!rings.length || !rings[0].length) continue;
      const R = rings.map(r => r.map(proj)), n = this.normal(rings[0].map(q => this.rot(q, +P.rx || 0, +P.ry || 0, +P.rz || 0)));
      const z = R.flat().reduce((s, q) => s + q.z, 0) / R.flat().length;
      out.push({ R, z, col: this.shade(P.fill, n.z < 0 ? { x: -n.x, y: -n.y, z: -n.z } : n, (+P.light || 70) / 100) });
    }
    out.sort((a, b) => a.z - b.z);
    g.querySelectorAll(':scope > path').forEach(e => e.remove());
    for (const o of out) {
      const d = o.R.map(r => 'M' + r.map(q => `${round(q.x, 2)} ${round(q.y, 2)}`).join('L') + 'Z').join('');
      svgEl('path', { d, fill: o.col, stroke: o.col, 'stroke-width': 0.6, 'stroke-linejoin': 'round', 'fill-rule': 'evenodd' }, g);
    }
  },
  fields(kind, P = {}) {
    const f = [
      { id: 'rx', label: 'Rotación X (°)', type: 'number', value: P.rx ?? -18, step: 5 }, { id: 'ry', label: 'Rotación Y (°)', type: 'number', value: P.ry ?? -26, step: 5 },
      { id: 'rz', label: 'Rotación Z (°)', type: 'number', value: P.rz ?? 8, step: 5 }, { id: 'persp', label: 'Perspectiva (0–160°)', type: 'number', value: P.persp ?? 0, min: 0, max: 160, step: 10 },
      { id: 'light', label: 'Intensidad de la luz (%)', type: 'number', value: P.light ?? 70, min: 0, max: 100 },
    ];
    if (kind === 'revolve') f.push({ id: 'angle', label: 'Ángulo (°)', type: 'number', value: P.angle ?? 360, min: 1, max: 360 }, { id: 'segs', label: 'Segmentos', type: 'number', value: P.segs ?? 32, min: 6, max: 96 },
      { id: 'side', label: 'Eje', type: 'select', value: P.side || 'left', options: [['left', 'Borde izquierdo'], ['right', 'Borde derecho']] });
    else f.push({ id: 'depth', label: 'Profundidad de extrusión (px)', type: 'number', value: P.depth ?? 50, min: 0 }, { id: 'bevel', label: 'Bisel (px)', type: 'number', value: P.bevel ?? 0, min: 0 });
    return f;
  },
  async make(kind) {
    const s = App.selection.length === 1 && (isShape(App.selection[0]) || App.selection[0].hasAttribute('data-3d')) ? App.selection[0] : null;
    if (!s) return Dialog.alert('Selecciona un solo trazado o forma (los textos, conviértelos antes en contornos).');
    const existing = s.hasAttribute('data-3d') ? s : null, P0 = existing ? JSON.parse(existing.getAttribute('data-3d')) : null;
    if (existing) kind = P0.kind;
    const fill = P0 ? P0.fill : (() => { const f = getStyle(s, 'fill'); return f && f.startsWith('#') ? f : (getStyle(s, 'stroke') || '#888888'); })();
    const snap = History.snapshot(), src = existing || s, id = src.id;
    const d = P0 ? P0.d : PathData.serialize(pathSubsDoc(s)), styles = P0 ? P0.styles : styleAttrs(s);
    const apply = v => {
      let g = document.getElementById(id); if (!g) return;
      if (!g.hasAttribute('data-3d')) { const ng = svgEl('g', { id: uid('3d'), 'data-name': kind === 'revolve' ? 'Revolución 3D' : 'Extrusión 3D' }); g.before(ng); g.remove(); ng.id = id; g = ng; placeDocPath(g); }
      g.setAttribute('data-3d', JSON.stringify({ kind, d, fill, styles, ...v })); this.render(g); Selection.set([g]);
    };
    const v = await Dialog.form(kind === 'revolve' ? 'Opciones de revolución 3D' : 'Opciones de extrusión y bisel 3D', this.fields(kind, P0 || {}), { preview: apply, revert: () => Dialog.revertTo(snap), note: 'Para cambiarlo después, selecciona el objeto 3D y vuelve a abrir este comando.' });
    if (!v) return; delete v._button; apply(v); History.named('3D', () => History.commit()); App.emit('layers');
  },
  /* convertir en trazados normales o volver al original */
  release() {
    const g = App.selection.find(e => e.hasAttribute('data-3d')); if (!g) return;
    const P = JSON.parse(g.getAttribute('data-3d')), p = svgEl('path', { id: uid(), ...P.styles, d: P.d }); g.before(p); g.remove(); placeDocPath(p);
    Selection.set([p]); History.named('Quitar 3D', () => History.commit()); App.emit('layers');
  },
  expand() { const g = App.selection.find(e => e.hasAttribute('data-3d')); if (!g) return; g.removeAttribute('data-3d'); History.named('Expandir 3D', () => History.commit()); App.emit('layers'); },
};
