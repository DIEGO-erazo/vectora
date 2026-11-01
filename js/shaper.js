/* Vectora — herramienta Shaper (Mayús+N): dibuja a mano alzada y la forma se reconoce
   (línea, círculo, elipse, triángulo, rectángulo, polígono); un garabato sobre formas
   superpuestas une las regiones que toca o, si queda dentro de una sola, la elimina.
   Y las herramientas de Licuar: Deformar, Remolino, Fruncir, Engordar, Cristalizar, Arrugar. */
'use strict';

/* ---------- reconocimiento de formas ---------- */
const ShapeGuess = {
  guess(pts) {
    const b = Geo.union(pts.map(p => ({ x: p.x, y: p.y, width: 0, height: 0 }))), diag = Math.hypot(b.width, b.height);
    if (diag < 4) return null;
    let len = 0; for (let i = 1; i < pts.length; i++) len += Geo.dist(pts[i - 1], pts[i]);
    const closed = Geo.dist(pts[0], pts[pts.length - 1]) < diag * 0.28;
    if (!closed) {
      /* línea: casi recta; se ajusta a 0/45/90° si está cerca */
      if (rdp(pts, diag * 0.07).length === 2) {
        let a = pts[0], z = pts[pts.length - 1]; const ang = Math.atan2(z.y - a.y, z.x - a.x), snap = Math.round(ang / (Math.PI / 4)) * Math.PI / 4;
        if (Math.abs(ang - snap) < 0.12) { const L = Geo.dist(a, z); z = { x: a.x + Math.cos(snap) * L, y: a.y + Math.sin(snap) * L }; }
        return { kind: 'line', a, z };
      }
      return null;
    }
    /* elipse: el error respecto a la elipse inscrita en la caja es pequeño */
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2, rx = b.width / 2, ry = b.height / 2;
    const err = pts.reduce((s, p) => s + Math.abs(Math.hypot((p.x - cx) / (rx || 1), (p.y - cy) / (ry || 1)) - 1), 0) / pts.length;
    const ring = pts.slice(0, -1), corners = rdpClosed(ring, diag * 0.09);
    if (err < 0.11 && corners.length > 4) return Math.abs(rx - ry) < Math.max(rx, ry) * 0.12 ? { kind: 'circle', cx, cy, r: (rx + ry) / 2 } : { kind: 'ellipse', cx, cy, rx, ry };
    if (corners.length === 3) return { kind: 'poly', pts: corners };
    if (corners.length === 4) {
      /* rectángulo: lados casi alineados con los ejes */
      const axis = corners.every((p, i) => { const q = corners[(i + 1) % 4], a = Math.abs(Math.atan2(q.y - p.y, q.x - p.x)) % (Math.PI / 2); return a < 0.25 || a > Math.PI / 2 - 0.25; });
      if (axis) return { kind: 'rect', x: b.x, y: b.y, w: b.width, h: b.height };
      return { kind: 'poly', pts: corners };
    }
    if (corners.length >= 5 && corners.length <= 8) {
      /* polígono regular centrado */
      const c = { x: corners.reduce((s, p) => s + p.x, 0) / corners.length, y: corners.reduce((s, p) => s + p.y, 0) / corners.length };
      const R = corners.reduce((s, p) => s + Geo.dist(p, c), 0) / corners.length, a0 = Math.atan2(corners[0].y - c.y, corners[0].x - c.x), n = corners.length;
      return { kind: 'poly', pts: [...Array(n)].map((_, i) => ({ x: c.x + R * Math.cos(a0 + i * 2 * Math.PI / n), y: c.y + R * Math.sin(a0 + i * 2 * Math.PI / n) })) };
    }
    if (err < 0.18) return { kind: 'ellipse', cx, cy, rx, ry };
    return null;
  },
  /* ¿es un garabato? (mucho recorrido para su tamaño y muchos cambios de sentido) */
  scribble(pts) {
    const b = Geo.union(pts.map(p => ({ x: p.x, y: p.y, width: 0, height: 0 }))), diag = Math.hypot(b.width, b.height) || 1;
    let len = 0, turns = 0;
    for (let i = 1; i < pts.length; i++) len += Geo.dist(pts[i - 1], pts[i]);
    const s = rdp(pts, diag * 0.05);
    for (let i = 2; i < s.length; i++) { const a = Math.atan2(s[i - 1].y - s[i - 2].y, s[i - 1].x - s[i - 2].x), c = Math.atan2(s[i].y - s[i - 1].y, s[i].x - s[i - 1].x); let d = Math.abs(c - a); if (d > Math.PI) d = 2 * Math.PI - d; if (d > 2.2) turns++; }
    return len > diag * 2.6 && turns >= 3;
  },
};
App.tools.shaper = {
  cursor: 'crosshair',
  down(p) { this.pts = [p]; },
  move(p) { if (!this.pts) return; if (Geo.dist(p, this.pts[this.pts.length - 1]) * App.view.zoom > 1.5) this.pts.push(p); Selection.draw(); },
  overlay(g) { if (this.pts && this.pts.length > 1) drawPolyline(g, this.pts, { stroke: '#e5332a', 'stroke-width': 2 }); },
  up() {
    const pts = this.pts; this.pts = null; if (!pts || pts.length < 3) { Selection.draw(); return; }
    if (ShapeGuess.scribble(pts) && this.scrub(pts)) return;
    const s = ShapeGuess.guess(pts); if (!s) { $('sbHint').textContent = 'Shaper: forma no reconocida, inténtalo de nuevo'; Selection.draw(); return; }
    const a = newShapeAttrs(); let el;
    if (s.kind === 'line') el = svgEl('line', { x1: round(s.a.x, 2), y1: round(s.a.y, 2), x2: round(s.z.x, 2), y2: round(s.z.y, 2), stroke: a.stroke === 'none' ? '#000000' : a.stroke, 'stroke-width': a['stroke-width'] });
    else if (s.kind === 'circle') el = svgEl('circle', { ...a, cx: round(s.cx, 2), cy: round(s.cy, 2), r: round(s.r, 2) });
    else if (s.kind === 'ellipse') el = svgEl('ellipse', { ...a, cx: round(s.cx, 2), cy: round(s.cy, 2), rx: round(s.rx, 2), ry: round(s.ry, 2) });
    else if (s.kind === 'rect') el = svgEl('rect', { ...a, x: round(s.x, 2), y: round(s.y, 2), width: round(s.w, 2), height: round(s.h, 2) });
    else el = svgEl('path', { ...a, d: 'M' + s.pts.map(q => `${round(q.x, 2)} ${round(q.y, 2)}`).join('L') + 'Z' });
    el = addObject(el); if (!el) return;
    Selection.set([el]); History.named('Shaper', () => History.commit());
  },
  /* garabato sobre formas: une las regiones tocadas o borra la única que toca */
  scrub(pts) {
    const b = Geo.union(pts.map(p => ({ x: p.x, y: p.y, width: 0, height: 0 })));
    const shapes = Layers.objects().filter(o => isShape(o) && !Layers.isLocked(o) && !Layers.isHidden(o)).filter(o => { const c = Geo.bbox(o); return c && c.x < b.x + b.width && c.x + c.width > b.x && c.y < b.y + b.height && c.y + c.height > b.y; });
    if (!shapes.length) return false;
    const F = Faces.build(shapes), hit = new Set();
    for (const p of pts) { let best = null; for (const f of F) if (Faces.contains(f, p) && (!best || Math.abs(f.area) < Math.abs(best.area))) best = f; if (best) hit.add(best); }
    if (!hit.size) return false;
    const builder = App.tools.builder;
    builder.src = shapes; builder.F = F; builder.drag = { set: hit, erase: hit.size === 1, path: pts };
    builder.up(); builder.F = null; builder.hot = null; $('sbHint').textContent = '';
    return true;
  },
};
ICONS.shaper = '<path d="M4 17c2-6 4-9 7-9s3 5 6 5 3-3 3-5"/><path d="M14 4l6 2-2 6" stroke-dasharray="2 1.5"/>';
TOOL_INFO.shaper = ['Shaper', 'Mayús+N'];
TOOL_GROUPS.find(g => Array.isArray(g) && g.includes('pencil')).unshift('shaper');

/* ---------- Licuar ---------- */
const LIQUIFY = {
  warp: ['Deformar', 'Mayús+R', '<path d="M4 16c4 0 4-8 8-8s4 8 8 8"/><circle cx="12" cy="8" r="2"/>'],
  twirl: ['Remolino', '', '<path d="M12 12a2 2 0 1 1 2 2a4 4 0 1 1-4-6a6 6 0 1 1-4 9"/>'],
  pucker: ['Fruncir', '', '<circle cx="12" cy="12" r="8" stroke-dasharray="2 2"/><path d="M12 6v4M12 18v-4M6 12h4M18 12h-4"/>'],
  bloat: ['Engordar', '', '<circle cx="12" cy="12" r="4"/><path d="M12 4v4M12 20v-4M4 12h4M20 12h-4"/>'],
  crystallize: ['Cristalizar', '', '<path d="M12 3v5M12 21v-5M3 12h5M21 12h-5M6 6l3 3M18 18l-3-3M18 6l-3 3M6 18l3-3"/>'],
  wrinkle: ['Arrugar', '', '<path d="M3 12l3-3 3 3 3-3 3 3 3-3 3 3"/>'],
};
App.liqSize = 60; App.liqForce = 50;
for (const [id, [name, key, icon]] of Object.entries(LIQUIFY)) {
  ICONS[id] = icon; TOOL_INFO[id] = [name, key];
  App.tools[id] = {
    cursor: 'crosshair',
    options() { return `Tamaño <input type="number" id="optLqS" min="2" value="${App.liqSize}"> px · Intensidad <input type="range" id="optLqF" min="1" max="100" value="${App.liqForce}">`; },
    bindOptions() { $('optLqS').oninput = e => App.liqSize = Math.max(2, +e.target.value); $('optLqF').oninput = e => App.liqForce = +e.target.value; },
    hover(p) { this.cur = p; Selection.draw(); },
    targets(p) {
      const R = App.liqSize / 2 / App.view.zoom;
      const pool = App.selection.length ? App.selection : Layers.objects().filter(o => !Layers.isLocked(o) && !Layers.isHidden(o));
      return pool.flatMap(e => (e.tagName === 'g' ? leafShapes(e) : [e])).filter(s => isShape(s) && !Layers.isLocked(s)).filter(s => { const b = Geo.bbox(s); return b && p.x > b.x - R && p.x < b.x + b.width + R && p.y > b.y - R && p.y < b.y + b.height + R; });
    },
    down(p) {
      this.last = p; this.items = new Map(); this.apply(p, p, true);
    },
    move(p) { if (!this.items) return; this.apply(this.last, p, false); this.last = p; this.cur = p; Selection.draw(); },
    /* desplaza los nodos (en coordenadas del documento) que caen dentro del pincel */
    apply(prev, p, first) {
      const R = App.liqSize / 2 / App.view.zoom, k = App.liqForce / 100, step = R / 6;
      for (const s of this.targets(p)) {
        let it = this.items.get(s.id);
        if (!it) { /* el trazado se densifica una vez para que la deformación sea suave */
          const subs = subdivideCurves(pathSubsDoc(s).map(sub => ({ nodes: sub.nodes, closed: sub.closed })), 1).map(sub => ({ closed: sub.closed, nodes: resampleDense(sub, step) }));
          const el = replaceWithPath(s, subs, styleAttrs(s)); if (!el) continue; it = { el, subs }; this.items.set(el.id, it); if (s.id !== el.id) this.items.set(s.id, it);
        }
        let changed = false;
        for (const sub of it.subs) sub.nodes.forEach((n, i) => {
          const d = Geo.dist(n, p); if (d > R) return; const w = (1 - d / R) * (1 - d / R) * k, dx = n.x - p.x, dy = n.y - p.y; let q = null;
          switch (id) {
            case 'warp': q = { x: n.x + (p.x - prev.x) * w * 1.6, y: n.y + (p.y - prev.y) * w * 1.6 }; break;
            case 'twirl': { const a = w * 0.12, c = Math.cos(a), si = Math.sin(a); q = { x: p.x + dx * c - dy * si, y: p.y + dx * si + dy * c }; break; }
            case 'pucker': q = { x: n.x - dx * w * 0.08, y: n.y - dy * w * 0.08 }; break;
            case 'bloat': q = { x: n.x + dx * w * 0.08, y: n.y + dy * w * 0.08 }; break;
            case 'crystallize': { const sp = i % 3 === 0 ? 0.35 : -0.05; q = { x: n.x + dx * w * sp * 0.4, y: n.y + dy * w * sp * 0.4 }; break; }
            case 'wrinkle': { const j = (Math.sin(i * 12.9898) * 43758.5453) % 1; q = { x: n.x + (dy / (d || 1)) * w * R * 0.06 * (j - 0.5) * 2, y: n.y - (dx / (d || 1)) * w * R * 0.06 * (j - 0.5) * 2 }; break; }
          }
          if (q) { n.x = q.x; n.y = q.y; changed = true; }
        });
        if (changed) { for (const sub of it.subs) { const sm = smoothNodes(sub.nodes, sub.closed); sm.forEach((m, j) => { sub.nodes[j].hin = m.hin; sub.nodes[j].hout = m.hout; }); } it.el.setAttribute('d', PathData.serialize(it.subs)); placeDocPathReset(it.el); }
      }
      void first;
    },
    up() {
      if (!this.items) return; const els = [...new Set([...this.items.values()].map(i => i.el))].filter(e => e.isConnected); this.items = null;
      /* simplificar un poco los nodos que añadió el muestreo */
      for (const el of els) { const subs = PathData.parse(el.getAttribute('d')).map(sub => ({ closed: sub.closed, nodes: (sub.closed ? rdpClosed(sub.nodes.map(n => ({ x: n.x, y: n.y })), 0.25 / App.view.zoom) : rdp(sub.nodes.map(n => ({ x: n.x, y: n.y })), 0.25 / App.view.zoom)) })).map(sub => ({ closed: sub.closed, nodes: smoothNodes(sub.nodes, sub.closed) })); el.setAttribute('d', PathData.serialize(subs)); }
      if (els.length) { if (App.selection.length) Selection.set(els); History.named(LIQUIFY[id][0], () => History.commit()); }
      Selection.draw();
    },
    overlay(g) { const c = this.cur || this.last; if (!c) return; const s = View.docToStage(c.x, c.y); svgEl('circle', { cx: s.x, cy: s.y, r: App.liqSize / 2, fill: 'none', stroke: '#1e90ff' }, g); },
  };
}
TOOL_GROUPS.find(g => Array.isArray(g) && g.includes('scale')).push(...Object.keys(LIQUIFY));
/* puntos equiespaciados de un subtrazado (con manejadores nulos) */
function resampleDense(sub, step) {
  const pts = [], N = sub.nodes, segs = sub.closed ? N.length : N.length - 1;
  for (let i = 0; i < segs; i++) { const a = N[i], b = N[(i + 1) % N.length], K = Math.max(1, Math.ceil(segLen(a, b) / step)); for (let k = 0; k < K; k++) pts.push(bez(a, b, k / K)); }
  if (!sub.closed) pts.push({ x: N[N.length - 1].x, y: N[N.length - 1].y });
  return pts.map(p => ({ x: p.x, y: p.y, hin: null, hout: null }));
}
/* los trazados nuevos se crean en coordenadas del documento: compensar si el padre está transformado */
function placeDocPathReset(el) { if (!el.hasAttribute('transform')) placeDocPath(el); }
