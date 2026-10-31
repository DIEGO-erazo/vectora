/* Vectora — operaciones booleanas (Buscatrazos) que conservan las curvas.
   Método: aplanar curvas recordando la Bézier de origen y su parámetro t, dividir
   los segmentos en sus intersecciones, conservar los que separan "dentro" de "fuera"
   del resultado, encadenarlos en anillos y reconstruir las Bézier exactas
   (subdivisión de De Casteljau) en los tramos que proceden de una misma curva.
   Cada punto de un anillo describe la arista que sale de él: {x, y, src, t, te}. */
'use strict';

function cubicAt(P, t) {
  const u = 1 - t;
  return { x: u * u * u * P[0].x + 3 * u * u * t * P[1].x + 3 * u * t * t * P[2].x + t * t * t * P[3].x,
           y: u * u * u * P[0].y + 3 * u * u * t * P[1].y + 3 * u * t * t * P[2].y + t * t * t * P[3].y };
}
function cubicSplit(P, t) {
  const L = (a, b) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const a = L(P[0], P[1]), b = L(P[1], P[2]), c = L(P[2], P[3]), d = L(a, b), e = L(b, c), f = L(d, e);
  return [[P[0], a, d, f], [f, e, c, P[3]]];
}
/* tramo de la cúbica P entre t0 y t1 (admite t0 > t1: tramo invertido) */
function cubicSub(P, t0, t1) {
  const rev = t0 > t1; if (rev) [t0, t1] = [t1, t0];
  let Q = t1 < 1 ? cubicSplit(P, t1)[0] : P;
  if (t0 > 0) Q = cubicSplit(Q, t0 / t1)[1];
  return rev ? [...Q].reverse() : Q;
}

const Boolean2D = {
  fromSubs(subs, rule = 'nonzero') {
    return { rings: subs.map(s => this.flatten(s)).filter(r => r.length >= 3), rule };
  },
  /* anillo de puntos {x,y,src,t,te}; src = [p0,c1,c2,p3] de la curva o null si es recta */
  flatten(sub) {
    const n = sub.nodes, out = [];
    for (let i = 0; i < n.length; i++) {
      const a = n[i], b = n[(i + 1) % n.length];
      const last = i === n.length - 1;
      if (last && !sub.closed && !(a.hout || b.hin)) { out.push({ x: a.x, y: a.y, src: null, t: 0, te: 1 }); break; }
      if (a.hout || b.hin) {
        const P = [{ x: a.x, y: a.y }, a.hout || a, b.hin || b, { x: b.x, y: b.y }];
        const len = Geo.dist(P[0], P[1]) + Geo.dist(P[1], P[2]) + Geo.dist(P[2], P[3]);
        const steps = clamp(Math.ceil(len / 3), 6, 64);
        for (let k = 0; k < steps; k++) {
          const t = k / steps, p = k ? cubicAt(P, t) : { x: a.x, y: a.y };
          out.push({ x: p.x, y: p.y, src: P, t, te: (k + 1) / steps });
        }
      } else out.push({ x: a.x, y: a.y, src: null, t: 0, te: 1 });
    }
    return out;
  },
  inside(poly, p) {
    let wn = 0, cr = 0;
    for (const r of poly.rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[j], b = r[i];
      if ((a.y <= p.y) !== (b.y <= p.y)) {
        const x = a.x + (p.y - a.y) * (b.x - a.x) / (b.y - a.y);
        if (x > p.x) { cr++; wn += b.y > a.y ? 1 : -1; }
      }
    }
    return poly.rule === 'evenodd' ? cr % 2 === 1 : wn !== 0;
  },
  op(A, B, kind) {
    const f = { union: (a, b) => a || b, intersect: (a, b) => a && b, xor: (a, b) => a !== b, difference: (a, b) => a && !b }[kind];
    const segs = [];
    for (const poly of [A, B]) for (const r of poly.rings)
      for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length];
        if (a.x !== b.x || a.y !== b.y) segs.push({ a, b, src: a.src || null, t0: a.t || 0, t1: a.te == null ? 1 : a.te, cuts: [] });
      }
    this.split(segs);
    const pieces = [];
    for (const s of segs) {
      const cuts = [{ t: 0, p: s.a }, ...s.cuts, { t: 1, p: s.b }].sort((x, y) => x.t - y.t);
      const T = u => s.t0 + u * (s.t1 - s.t0);
      for (let i = 0; i + 1 < cuts.length; i++) {
        const a = cuts[i].p, b = cuts[i + 1].p; if (Geo.dist(a, b) < 1e-6) continue;
        pieces.push({ a, b, src: s.src, ta: T(cuts[i].t), tb: T(cuts[i + 1].t) });
      }
    }
    const kept = [], seen = new Set(), E = 0.01;
    const key = p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
    for (const s of pieces) {
      const dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, L = Math.hypot(dx, dy), nx = -dy / L * E, ny = dx / L * E;
      const m = { x: (s.a.x + s.b.x) / 2, y: (s.a.y + s.b.y) / 2 };
      const pl = { x: m.x + nx, y: m.y + ny }, pr = { x: m.x - nx, y: m.y - ny };
      const rl = f(this.inside(A, pl), this.inside(B, pl)), rr = f(this.inside(A, pr), this.inside(B, pr));
      if (rl === rr) continue;
      const seg = rl ? s : { a: s.b, b: s.a, src: s.src, ta: s.tb, tb: s.ta };
      const k = key(seg.a) + '>' + key(seg.b); if (seen.has(k)) continue; seen.add(k);
      kept.push(seg);
    }
    /* encadenar */
    const byStart = new Map();
    for (const s of kept) { const k = key(s.a); if (!byStart.has(k)) byStart.set(k, []); byStart.get(k).push(s); }
    const rings = [];
    for (const s0 of kept) {
      if (s0.used) continue;
      const ring = []; let s = s0, guard = 0;
      while (s && !s.used && guard++ < 1e5) {
        s.used = true; ring.push({ x: s.a.x, y: s.a.y, src: s.src, t: s.ta, te: s.tb });
        const next = (byStart.get(key(s.b)) || []).find(x => !x.used);
        if (!next) break; s = next;
      }
      if (ring.length >= 3) rings.push(this.simplify(ring));
    }
    return { rings: rings.filter(r => r.length >= 3), rule: 'nonzero' };
  },
  split(segs) {
    const E = 1e-9;
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      const s = segs[i], o = segs[j];
      if (Math.max(s.a.x, s.b.x) < Math.min(o.a.x, o.b.x) - 1e-9 || Math.min(s.a.x, s.b.x) > Math.max(o.a.x, o.b.x) + 1e-9 ||
          Math.max(s.a.y, s.b.y) < Math.min(o.a.y, o.b.y) - 1e-9 || Math.min(s.a.y, s.b.y) > Math.max(o.a.y, o.b.y) + 1e-9) continue;
      const d1x = s.b.x - s.a.x, d1y = s.b.y - s.a.y, d2x = o.b.x - o.a.x, d2y = o.b.y - o.a.y;
      const den = d1x * d2y - d1y * d2x, L1 = d1x * d1x + d1y * d1y, L2 = d2x * d2x + d2y * d2y;
      if (Math.abs(den) < 1e-9 * Math.sqrt(L1 * L2)) {
        /* paralelos: si son colineales, dividir en los extremos del otro */
        const cr = (o.a.x - s.a.x) * d1y - (o.a.y - s.a.y) * d1x;
        if (Math.abs(cr) > 1e-6 * Math.sqrt(L1)) continue;
        for (const p of [o.a, o.b]) { const t = ((p.x - s.a.x) * d1x + (p.y - s.a.y) * d1y) / L1; if (t > E && t < 1 - E) s.cuts.push({ t, p }); }
        for (const p of [s.a, s.b]) { const t = ((p.x - o.a.x) * d2x + (p.y - o.a.y) * d2y) / L2; if (t > E && t < 1 - E) o.cuts.push({ t, p }); }
        continue;
      }
      const t = ((o.a.x - s.a.x) * d2y - (o.a.y - s.a.y) * d2x) / den, u = ((o.a.x - s.a.x) * d1y - (o.a.y - s.a.y) * d1x) / den;
      const T = 1e-7;
      if (t < -T || t > 1 + T || u < -T || u > 1 + T) continue;
      let p;
      if (t <= T) p = s.a; else if (t >= 1 - T) p = s.b; else if (u <= T) p = o.a; else if (u >= 1 - T) p = o.b;
      else p = { x: s.a.x + t * d1x, y: s.a.y + t * d1y };
      if (t > T && t < 1 - T) s.cuts.push({ t, p });
      if (u > T && u < 1 - T) o.cuts.push({ t: u, p });
    }
  },
  /* quita vértices colineales entre dos aristas rectas */
  simplify(r) {
    const out = [];
    for (let i = 0; i < r.length; i++) {
      const a = out.length ? out[out.length - 1] : r[r.length - 1], b = r[i], c = r[(i + 1) % r.length];
      if (a.src || b.src) { out.push(b); continue; }
      const cr = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      if (Math.abs(cr) > 1e-4 || ((b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)) < 0) out.push(b);
    }
    return out;
  },
  /* anillo -> nodos Bézier: agrupa aristas contiguas de una misma curva */
  ringToNodes(r) {
    const n = r.length;
    const cont = i => { const a = r[(i - 1 + n) % n], b = r[i];
      return a.src && a.src === b.src && Math.abs(a.te - b.t) < 1e-9 && Math.sign(a.te - a.t) === Math.sign(b.te - b.t); };
    let start = 0; while (start < n && cont(start)) start++;
    if (start === n) start = 0;
    const groups = [];
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      if (k && cont(i)) groups[groups.length - 1].e = i; else groups.push({ s: i, e: i });
    }
    const nodes = groups.map(g => ({ x: r[g.s].x, y: r[g.s].y, hin: null, hout: null }));
    groups.forEach((g, gi) => {
      const p = r[g.s]; if (!p.src) return;
      const Q = cubicSub(p.src, p.t, r[g.e].te);
      nodes[gi].hout = { x: Q[1].x, y: Q[1].y }; nodes[(gi + 1) % nodes.length].hin = { x: Q[2].x, y: Q[2].y };
    });
    return nodes;
  },
  toSubs(poly) { return poly && poly.rings.length ? poly.rings.map(r => ({ nodes: this.ringToNodes(r), closed: true })) : []; },
  toPath(poly) { return PathData.serialize(this.toSubs(poly)); },
};
