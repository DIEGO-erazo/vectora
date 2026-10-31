/* Vectora — selección, caja delimitadora y transformaciones interactivas */
'use strict';

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

const Selection = {
  set(els) { App.selection = [...new Set(els.filter(e => e && e.isConnected))]; this.changed(); },
  add(el) { if (!App.selection.includes(el)) App.selection.push(el); this.changed(); },
  toggle(el) { const i = App.selection.indexOf(el); i < 0 ? App.selection.push(el) : App.selection.splice(i, 1); this.changed(); },
  clear() { if (App.selection.length) { App.selection = []; this.changed(); } },
  has(el) { return App.selection.includes(el); },
  changed() { this.draw(); App.emit('selection'); },
  box() { return Geo.selBox(App.selection); },

  /* marco del cuadro delimitador: F lleva del marco al documento. Un único objeto
     rotado (sin sesgo) conserva un cuadro girado, como en Illustrator. */
  frame(els = App.selection) {
    if (els.length === 1) {
      const el = els[0], m = Geo.toDoc(el), ang = Math.atan2(m.b, m.a) * 180 / Math.PI;
      const ortho = Math.abs(m.a * m.c + m.b * m.d) < 1e-6 * (Math.abs(m.a * m.d) + Math.abs(m.b * m.c) + 1e-12);
      let lb = null; try { lb = el.getBBox(); } catch (e) { /* sin geometría */ }
      if (lb && Math.abs(ang) > 0.01 && ortho) {
        const F = new DOMMatrix().rotate(ang), Fi = F.inverse(), M = Fi.multiply(m);
        const ps = [[lb.x, lb.y], [lb.x + lb.width, lb.y], [lb.x, lb.y + lb.height], [lb.x + lb.width, lb.y + lb.height]].map(([x, y]) => Geo.pt(M, x, y));
        const x = Math.min(...ps.map(q => q.x)), y = Math.min(...ps.map(q => q.y));
        return { F, Fi, box: { x, y, width: Math.max(...ps.map(q => q.x)) - x, height: Math.max(...ps.map(q => q.y)) - y } };
      }
    }
    const box = Geo.selBox(els); return box && { F: new DOMMatrix(), Fi: new DOMMatrix(), box };
  },
  /* puntos de manejador en coordenadas de pantalla (escenario) */
  handlePoints(b, F = new DOMMatrix()) {
    const p = (x, y) => { const q = Geo.pt(F, x, y); return View.docToStage(q.x, q.y); };
    const { x, y, width: w, height: h } = b;
    return { nw: p(x, y), n: p(x + w / 2, y), ne: p(x + w, y), e: p(x + w, y + h / 2),
      se: p(x + w, y + h), s: p(x + w / 2, y + h), sw: p(x, y + h), w: p(x, y + h / 2) };
  },
  handleAt(sx, sy) {
    if (!App.selection.length) return null;
    const fr = this.frame(); if (!fr) return null;
    const hp = this.handlePoints(fr.box, fr.F);
    for (const k of HANDLES) if (Math.abs(hp[k].x - sx) <= 5 && Math.abs(hp[k].y - sy) <= 5) return k;
    for (const k of ['nw', 'ne', 'se', 'sw']) { const d = Math.hypot(hp[k].x - sx, hp[k].y - sy); if (d > 5 && d < 18) return 'rot'; }
    return null;
  },

  outline(g, el, color) {
    for (const s of leafShapes(el)) {
      const d = PathData.fromShape(s); if (!d) continue;
      const m = s.getCTM(); if (!m) continue;
      svgEl('path', { d, fill: 'none', stroke: color, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke',
        transform: `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})` }, g);
    }
  },

  draw() {
    const g = App.els.overlay; g.innerHTML = '';
    const sel = App.selection;
    if (typeof Guides !== 'undefined') Guides.draw(g);
    if (typeof Artboards !== 'undefined') Artboards.drawLabels(g);
    const showBox = sel.length && App.toolName !== 'direct' && App.toolName !== 'pen';
    for (const el of sel) {
      const ly = Layers.layerOf(el); const c = (ly && ly.getAttribute('data-color')) || '#4f8cff';
      this.outline(g, el, c);
    }
    if (showBox) {
      const fr = this.frame();
      if (fr) {
        const b = fr.box, ly = Layers.layerOf(sel[0]); const c = (ly && ly.getAttribute('data-color')) || '#4f8cff';
        const hp = this.handlePoints(b, fr.F);
        svgEl('path', { d: `M${hp.nw.x} ${hp.nw.y}L${hp.ne.x} ${hp.ne.y}L${hp.se.x} ${hp.se.y}L${hp.sw.x} ${hp.sw.y}Z`, fill: 'none', stroke: c, 'stroke-width': 1 }, g);
        for (const k of HANDLES) svgEl('rect', { x: hp[k].x - 3.5, y: hp[k].y - 3.5, width: 7, height: 7, fill: '#fff', stroke: c }, g);
        const cq = Geo.pt(fr.F, b.x + b.width / 2, b.y + b.height / 2), cp = View.docToStage(cq.x, cq.y);
        svgEl('path', { d: `M${cp.x - 4} ${cp.y}h8M${cp.x} ${cp.y - 4}v8`, stroke: c }, g);
      }
    }
    if (App.tool && App.tool.overlay) App.tool.overlay(g);
    if (typeof SmartGuides !== 'undefined') SmartGuides.draw(g);
    /* etiqueta de medida junto al cursor (mover, escalar, rotar, dibujar) */
    if (App.measure && App.pointer) {
      const t = svgEl('text', { x: App.pointer.x + 16, y: App.pointer.y + 30, fill: '#fff', 'font-size': 11, 'font-family': 'Segoe UI, sans-serif' }, g);
      t.textContent = App.measure;
      const bb = t.getBBox(); t.before(svgEl('rect', { x: bb.x - 5, y: bb.y - 3, width: bb.width + 10, height: bb.height + 6, rx: 3, fill: 'rgba(30,30,30,.88)' }));
    }
  },
};

/* ---------- Transformador interactivo (mover / escalar / rotar) ---------- */
const Transformer = {
  active: null,
  begin(kind, handle, start, opts = {}) {
    let els = App.selection.filter(e => !Layers.isLocked(e));
    if (!els.length) return false;
    if (kind === 'move' && opts.duplicate) {
      els = els.map(e => { const c = cloneWithIds(e); e.after(c); return c; });
      Selection.set(els);
    }
    const box = Geo.selBox(els);
    if (!box) return false;
    SmartGuides.prepare(els);
    const fr = Selection.frame(els), fb = fr.box;
    this.active = { kind, handle, start, els, box, fr, duplicate: kind === 'move' && opts.duplicate,
      orig: els.map(e => e.getAttribute('transform')), center: Geo.pt(fr.F, fb.x + fb.width / 2, fb.y + fb.height / 2) };
    return true;
  },
  reset() { const a = this.active; a.els.forEach((e, i) => a.orig[i] == null ? e.removeAttribute('transform') : e.setAttribute('transform', a.orig[i])); },
  update(p, ev) {
    const a = this.active; if (!a) return;
    this.reset();
    let M;
    if (a.kind === 'move') {
      let dx = p.x - a.start.x, dy = p.y - a.start.y;
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      if (App.snap) { const g = App.gridSize; dx = Math.round((a.box.x + dx) / g) * g - a.box.x; dy = Math.round((a.box.y + dy) / g) * g - a.box.y; }
      else if (!ev.ctrlKey) {
        const s = SmartGuides.snapBox({ ...a.box, x: a.box.x + dx, y: a.box.y + dy });
        const hOnly = ev.shiftKey && dy === 0, vOnly = ev.shiftKey && dx === 0 && !hOnly;
        if (!vOnly) dx += s.dx; if (!hOnly) dy += s.dy;
        if (hOnly) SmartGuides.lines = SmartGuides.lines.filter(l => l.axis === 'x');
        if (vOnly) SmartGuides.lines = SmartGuides.lines.filter(l => l.axis === 'y');
      }
      M = new DOMMatrix().translate(dx, dy);
      App.measure = `dX: ${Units.fmt(dx)}  dY: ${Units.fmt(dy)} ${Units.u}`;
    } else if (a.kind === 'rotate') {
      const c = a.center;
      let ang = (Math.atan2(p.y - c.y, p.x - c.x) - Math.atan2(a.start.y - c.y, a.start.x - c.x)) * 180 / Math.PI;
      if (ev.shiftKey) ang = Math.round(ang / 45) * 45;
      M = Geo.rotateAbout(ang, c.x, c.y);
      App.measure = `${round(ang, 1)}°`;
    } else {
      if (!ev.ctrlKey && !ev.altKey && a.fr.F.isIdentity) p = SmartGuides.snapPoint(p);
      p = Geo.pt(a.fr.Fi, p.x, p.y); /* trabajar en el marco (girado) del cuadro */
      const b = a.fr.box, h = a.handle;
      const fx = h.includes('w') ? 0 : h.includes('e') ? 1 : 0.5, fy = h.includes('n') ? 0 : h.includes('s') ? 1 : 0.5;
      const hx = b.x + fx * b.width, hy = b.y + fy * b.height;
      const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      const ax = ev.altKey ? cx : b.x + (1 - fx) * b.width, ay = ev.altKey ? cy : b.y + (1 - fy) * b.height;
      let sx = fx === 0.5 ? 1 : (p.x - ax) / ((hx - ax) || 1), sy = fy === 0.5 ? 1 : (p.y - ay) / ((hy - ay) || 1);
      if (ev.shiftKey) {
        if (fx === 0.5) sx = Math.abs(sy) * Math.sign(sx || 1);
        else if (fy === 0.5) sy = Math.abs(sx) * Math.sign(sy || 1);
        else { const s = Math.max(Math.abs(sx), Math.abs(sy)); sx = s * Math.sign(sx || 1); sy = s * Math.sign(sy || 1); }
      }
      if (Math.abs(sx) < 1e-3) sx = 1e-3; if (Math.abs(sy) < 1e-3) sy = 1e-3;
      M = a.fr.F.multiply(Geo.scaleAbout(sx, sy, ax, ay)).multiply(a.fr.Fi);
      App.measure = `An: ${Units.fmt(b.width * Math.abs(sx))}  Al: ${Units.fmt(b.height * Math.abs(sy))} ${Units.u}`;
    }
    a.els.forEach(e => Geo.applyDoc(e, M));
    a.M = M;
    Selection.draw(); App.emit('transform');
  },
  end() {
    if (!this.active) return;
    if (this.active.M) App.lastTransform = { matrix: this.active.M, duplicate: !!this.active.duplicate };
    SmartGuides.clear();
    this.active.els.forEach(normalizeTransform);
    this.active = null; App.measure = null;
    History.commit(); Selection.changed();
  },
};

/* Aplica traslaciones/escalas simples directamente a la geometría cuando es posible
   para que los atributos queden limpios (como Illustrator). */
function normalizeTransform(el) {
  const m = Geo.local(el);
  if (m.isIdentity) { el.removeAttribute('transform'); return; }
  if (m.b !== 0 || m.c !== 0) return; // con rotación: se conserva la matriz
  const tag = el.tagName, A = n => parseFloat(el.getAttribute(n)) || 0, S = (n, v) => el.setAttribute(n, round(v, 3));
  const tx = (x) => m.a * x + m.e, ty = (y) => m.d * y + m.f;
  if (tag === 'rect' || tag === 'image') {
    let x = tx(A('x')), y = ty(A('y')), w = A('width') * m.a, h = A('height') * m.d;
    if (w < 0) { x += w; w = -w; } if (h < 0) { y += h; h = -h; }
    S('x', x); S('y', y); S('width', w); S('height', h);
    if (tag === 'rect' && el.hasAttribute('rx')) { S('rx', A('rx') * Math.abs(m.a)); S('ry', (A('ry') || A('rx') / Math.abs(m.a)) * Math.abs(m.d)); }
  } else if (tag === 'ellipse') {
    S('cx', tx(A('cx'))); S('cy', ty(A('cy'))); S('rx', A('rx') * Math.abs(m.a)); S('ry', A('ry') * Math.abs(m.d));
  } else if (tag === 'line') {
    S('x1', tx(A('x1'))); S('y1', ty(A('y1'))); S('x2', tx(A('x2'))); S('y2', ty(A('y2')));
  } else if (tag === 'path') {
    const subs = PathData.parse(el.getAttribute('d') || '');
    const T = p => p && ({ x: tx(p.x), y: ty(p.y) });
    subs.forEach(s => s.nodes.forEach(n => { const q = T(n); n.x = q.x; n.y = q.y; n.hin = T(n.hin); n.hout = T(n.hout); }));
    el.setAttribute('d', PathData.serialize(subs));
  } else if (tag === 'text' && m.a === 1 && m.d === 1 && !el.querySelector('textPath')) {
    S('x', tx(A('x'))); S('y', ty(A('y')));
    const ar = el.getAttribute('data-area');
    if (ar) { const [ax, ay, aw, ah] = ar.split(/\s+/).map(Number); el.setAttribute('data-area', [tx(ax), ty(ay), aw, ah].map(v => round(v, 2)).join(' ')); }
    for (const ts of el.querySelectorAll('tspan')) if (ts.hasAttribute('x')) ts.setAttribute('x', round(tx(parseFloat(ts.getAttribute('x')) || 0), 3));
  } else return;
  el.removeAttribute('transform');
}

function cloneWithIds(el) {
  const c = el.cloneNode(true);
  if (c.id) c.id = uid(); c.querySelectorAll('[id]').forEach(n => n.id = uid());
  return c;
}
