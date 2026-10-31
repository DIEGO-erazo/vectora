/* Vectora — formas en vivo (rectángulos, polígonos, estrellas) y esquinas en vivo */
'use strict';

const LiveShape = {
  kind(el) {
    if (!el) return null;
    if (el.tagName === 'rect') return 'rect';
    const k = el.getAttribute('data-shape');
    return el.tagName === 'polygon' && (k === 'polygon' || k === 'star') ? k : null;
  },
  params(el) { const n = k => +el.getAttribute('data-' + k); return { cx: n('cx'), cy: n('cy'), r: n('r'), n: n('n') || 5, inner: n('inner') || 0.5 }; },
  regen(el, p = {}) {
    const P = { ...this.params(el), ...p }, star = this.kind(el) === 'star';
    P.n = clamp(Math.round(P.n), 3, 200); P.r = Math.max(0.5, P.r); P.inner = clamp(P.inner, 0.05, 0.99);
    setA(el, { 'data-cx': P.cx, 'data-cy': P.cy, 'data-r': P.r, 'data-n': P.n, ...(star ? { 'data-inner': P.inner } : {}) });
    el.setAttribute('points', polyPoints(P.cx, P.cy, P.r, P.r, P.n, star, P.inner));
  },
  radius(el) { return +(el.getAttribute('rx') || el.getAttribute('ry') || 0); },
  setRadius(el, r) {
    r = clamp(r, 0, Math.min(+el.getAttribute('width'), +el.getAttribute('height')) / 2);
    if (r > 0.01) setA(el, { rx: r, ry: r }); else { el.removeAttribute('rx'); el.removeAttribute('ry'); }
  },
  /* sección «Forma» del panel Propiedades */
  propsHTML(el) {
    const k = this.kind(el); if (!k) return '';
    if (k === 'rect') return `<div class="pp-row"><label title="Radio de las esquinas">◜ Esquinas <input type="number" min="0" step="any" id="lsR" value="${Units.fmt(this.radius(el))}"></label></div>`;
    const P = this.params(el);
    return `<div class="pp-row"><label>${k === 'star' ? 'Puntas' : 'Lados'} <input type="number" min="3" max="200" id="lsN" value="${P.n}"></label>
      <label>Radio <input type="number" min="0" step="any" id="lsRad" value="${Units.fmt(P.r)}"></label>
      ${k === 'star' ? `<label>Interior <input type="number" min="5" max="99" id="lsIn" value="${round(P.inner * 100)}">%</label>` : ''}</div>`;
  },
  bindProps(root, el) {
    const q = id => root.querySelector('#' + id), done = () => { History.named('Forma en vivo', () => History.commit()); Selection.draw(); };
    if (q('lsR')) q('lsR').onchange = e => { this.setRadius(el, Units.fromU(+e.target.value)); done(); };
    if (q('lsN')) q('lsN').onchange = e => { this.regen(el, { n: +e.target.value }); done(); };
    if (q('lsRad')) q('lsRad').onchange = e => { this.regen(el, { r: Units.fromU(+e.target.value) }); done(); };
    if (q('lsIn')) q('lsIn').onchange = e => { this.regen(el, { inner: +e.target.value / 100 }); done(); };
  },
};

/* ---------- controles de esquina del rectángulo (herramienta Selección) ---------- */
const RectCorners = {
  target() { const s = App.selection; return s.length === 1 && s[0].tagName === 'rect' && !Layers.isLocked(s[0]) && !Transformer.active ? s[0] : null; },
  widgets(el) {
    const m = el.getCTM(); if (!m) return [];
    const x = +el.getAttribute('x') || 0, y = +el.getAttribute('y') || 0, w = +el.getAttribute('width'), h = +el.getAttribute('height');
    const zs = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1, off = Math.min(Math.max(LiveShape.radius(el), 12 / zs), w / 2, h / 2);
    if (w * zs < 40 || h * zs < 40) return [];
    return [[x, y, 1, 1], [x + w, y, -1, 1], [x + w, y + h, -1, -1], [x, y + h, 1, -1]].map(([cx, cy, sx, sy]) =>
      ({ corner: { x: cx, y: cy }, dir: { x: sx, y: sy }, at: Geo.pt(m, cx + sx * off, cy + sy * off) }));
  },
  hit(sp) { const el = this.target(); if (!el) return null; const w = this.widgets(el).find(k => Geo.dist(k.at, sp) < 6); return w ? { el, ...w } : null; },
  drag(d, sp) {
    const q = Geo.pt(d.el.getCTM().inverse(), sp.x, sp.y);
    const r = ((q.x - d.corner.x) * d.dir.x + (q.y - d.corner.y) * d.dir.y) / 2;
    LiveShape.setRadius(d.el, Math.max(0, r)); App.measure = `Radio: ${Units.fmt(LiveShape.radius(d.el))} ${Units.u}`;
    Selection.draw(); App.emit('transform');
  },
  draw(g) {
    const el = this.target(); if (!el || App.toolName !== 'select') return;
    for (const k of this.widgets(el)) {
      svgEl('circle', { cx: k.at.x, cy: k.at.y, r: 4, fill: '#fff', stroke: '#1e90ff', 'stroke-width': 1.2 }, g);
      svgEl('circle', { cx: k.at.x, cy: k.at.y, r: 1.4, fill: '#1e90ff' }, g);
    }
  },
};
(() => {
  const sel = App.tools.select, base = { down: sel.down, move: sel.move, up: sel.up, hover: sel.hover };
  Object.assign(sel, {
    down(p, ev, sp) { const w = RectCorners.hit(sp); if (w) { this.corner = w; return; } return base.down.call(this, p, ev, sp); },
    move(p, ev, sp) { if (this.corner) return RectCorners.drag(this.corner, sp); return base.move.call(this, p, ev, sp); },
    up(...a) {
      if (!this.corner) return base.up.apply(this, a);
      this.corner = null; App.measure = null; History.named('Redondear esquinas', () => History.commit()); Selection.changed();
    },
    hover(p, ev, sp) { if (RectCorners.hit(sp)) { App.els.stage.style.cursor = 'pointer'; return; } return base.hover.call(this, p, ev, sp); },
    overlay(g) { RectCorners.draw(g); },
  });
})();

/* ---------- esquinas en vivo de trazados (Selección directa) ---------- */
/* redondea las esquinas indicadas (índices) de un subtrazado */
function roundAt(sub, idx, r) {
  const N = sub.nodes, out = [], K = 0.5523;
  N.forEach((n, i) => {
    const prev = N[(i - 1 + N.length) % N.length], next = N[(i + 1) % N.length];
    if (!idx.has(i) || !r) return out.push({ ...n });
    const d1 = Geo.dist(n, prev), d2 = Geo.dist(n, next), t = Math.min(r, d1 / 2, d2 / 2);
    if (t < 0.01) return out.push({ ...n });
    const u1 = { x: (prev.x - n.x) / d1, y: (prev.y - n.y) / d1 }, u2 = { x: (next.x - n.x) / d2, y: (next.y - n.y) / d2 };
    const a = { x: n.x + u1.x * t, y: n.y + u1.y * t }, b = { x: n.x + u2.x * t, y: n.y + u2.y * t };
    out.push({ ...a, hin: null, hout: { x: a.x - u1.x * t * K, y: a.y - u1.y * t * K } },
      { ...b, hin: { x: b.x - u2.x * t * K, y: b.y - u2.y * t * K }, hout: null });
  });
  return { nodes: out, closed: sub.closed };
}
const isCorner = (s, i) => {
  const N = s.nodes, n = N[i], prev = N[(i - 1 + N.length) % N.length], next = N[(i + 1) % N.length];
  if (!s.closed && (i === 0 || i === N.length - 1)) return false;
  return !n.hin && !n.hout && !prev.hout && !next.hin;
};
const DirectCorners = {
  widgets(tool) {
    const out = [];
    for (const it of tool.items || []) {
      const m = it.el.getCTM(); if (!m) continue;
      it.subs.forEach((s, si) => s.nodes.forEach((n, i) => {
        if (!tool.sel.has(n) || !isCorner(s, i)) return;
        const N = s.nodes, prev = N[(i - 1 + N.length) % N.length], next = N[(i + 1) % N.length];
        const A = Geo.pt(m, n.x, n.y), P = Geo.pt(m, prev.x, prev.y), Q = Geo.pt(m, next.x, next.y);
        const u = { x: P.x - A.x, y: P.y - A.y }, v = { x: Q.x - A.x, y: Q.y - A.y }, lu = Math.hypot(u.x, u.y) || 1, lv = Math.hypot(v.x, v.y) || 1;
        const bis = { x: u.x / lu + v.x / lv, y: u.y / lu + v.y / lv }, lb = Math.hypot(bis.x, bis.y);
        if (lb < 1e-3) return;
        out.push({ it, si, i, A, bis: { x: bis.x / lb, y: bis.y / lb }, at: { x: A.x + bis.x / lb * 16, y: A.y + bis.y / lb * 16 } });
      }));
    }
    return out;
  },
  hit(tool, sp) { return this.widgets(tool).find(w => Geo.dist(w.at, sp) < 6) || null; },
};
(() => {
  const dir = App.tools.direct, base = { down: dir.down, move: dir.move, up: dir.up, overlay: dir.overlay };
  Object.assign(dir, {
    down(p, ev, sp) {
      const w = DirectCorners.hit(this, sp);
      if (!w) return base.down.call(this, p, ev, sp);
      /* todas las esquinas seleccionadas se redondean a la vez */
      const corners = DirectCorners.widgets(this);
      this.cornerDrag = { w, items: this.items.map(it => ({ it, orig: it.subs.map(s => ({ closed: s.closed, nodes: s.nodes.map(n => ({ ...n, hin: n.hin && { ...n.hin }, hout: n.hout && { ...n.hout } })) })),
        idx: it.subs.map((s, si) => new Set(corners.filter(c => c.it === it && c.si === si).map(c => c.i))) })) };
    },
    move(p, ev, sp) {
      const d = this.cornerDrag; if (!d) return base.move.call(this, p, ev, sp);
      const w = d.w, rs = Math.max(0, (sp.x - w.A.x) * w.bis.x + (sp.y - w.A.y) * w.bis.y - 8);
      /* de píxeles de pantalla a unidades del trazado */
      const m = w.it.el.getCTM(), zs = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1, r = rs / zs;
      for (const x of d.items) { x.it.subs = x.orig.map((s, si) => (x.idx[si].size ? roundAt(s, x.idx[si], r) : s)); renderItem(x.it); }
      const D = Geo.toDoc(w.it.el), ds = Math.sqrt(Math.abs(D.a * D.d - D.b * D.c)) || 1;
      this.sel = new Set(); App.measure = `Radio: ${Units.fmt(r * ds)} ${Units.u}`; Selection.draw();
    },
    up(...a) {
      if (!this.cornerDrag) return base.up.apply(this, a);
      this.cornerDrag = null; App.measure = null; History.named('Redondear esquinas', () => History.commit()); Selection.draw();
    },
    overlay(g) {
      base.overlay.call(this, g);
      if (this.cornerDrag) return;
      for (const w of DirectCorners.widgets(this)) {
        svgEl('circle', { cx: w.at.x, cy: w.at.y, r: 4, fill: '#fff', stroke: '#1e90ff', 'stroke-width': 1.2 }, g);
        svgEl('circle', { cx: w.at.x, cy: w.at.y, r: 1.4, fill: '#1e90ff' }, g);
      }
    },
  });
})();
