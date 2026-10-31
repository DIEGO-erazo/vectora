/* Vectora — edición de nodos: pluma, selección directa y convertir punto de ancla */
'use strict';

/* ---------- utilidades comunes ---------- */
const editable = el => el && SHAPE_TAGS.has(el.tagName) && !['text', 'image'].includes(el.tagName) && !Layers.isLocked(el) && !Layers.isHidden(el);
function pathItem(el) { el = PathData.convert(el); return { el, subs: PathData.parse(el.getAttribute('d') || '') }; }
function renderItem(it) { it.el.setAttribute('d', PathData.serialize(it.subs)); }
function reverseSub(s) { s.nodes.reverse(); s.nodes.forEach(n => { [n.hin, n.hout] = [n.hout, n.hin]; }); }
/* doc -> local y vector doc -> local para el elemento */
const toLocal = (el, p) => Geo.pt(Geo.toDoc(el).inverse(), p.x, p.y);
function localDelta(el, dx, dy) { const m = Geo.toDoc(el).inverse(); return { x: m.a * dx + m.c * dy, y: m.b * dx + m.d * dy }; }
function shiftNode(n, d) { n.x += d.x; n.y += d.y; for (const k of ['hin', 'hout']) if (n[k]) { n[k].x += d.x; n[k].y += d.y; } }

/* qué hay bajo el punto de pantalla sp: manejador, ancla o segmento */
function hitPath(it, sp, handlesOf) {
  const m = it.el.getCTM(); if (!m) return null;
  const S = q => Geo.pt(m, q.x, q.y), near = (q, r = 6) => q && Geo.dist(S(q), sp) < r;
  if (handlesOf) for (const s of it.subs) for (const n of s.nodes) if (handlesOf.has(n)) {
    if (near(n.hin)) return { kind: 'hin', node: n, sub: s, it };
    if (near(n.hout)) return { kind: 'hout', node: n, sub: s, it };
  }
  for (const s of it.subs) for (const [i, n] of s.nodes.entries()) if (near(n)) return { kind: 'anchor', node: n, sub: s, i, it };
  let best = null;
  for (const s of it.subs) s.nodes.forEach((a, i) => {
    if (i === s.nodes.length - 1 && !s.closed) return;
    const b = s.nodes[(i + 1) % s.nodes.length];
    for (let t = 0.02; t < 1; t += 0.02) {
      const d = Geo.dist(S(bez(a, b, t)), sp);
      if (d < 5 && (!best || d < best.d)) best = { kind: 'segment', d, sub: s, i, t, it };
    }
  });
  return best;
}
function drawItemNodes(g, it, selected, allHandles) {
  const m = it.el.getCTM(); if (!m) return;
  for (const s of it.subs) for (const n of s.nodes) {
    const a = toStage(m, n), on = selected.has(n);
    if (on || allHandles) { if (n.hin) overlayHandle(g, a, toStage(m, n.hin)); if (n.hout) overlayHandle(g, a, toStage(m, n.hout)); }
    overlayAnchor(g, a, on);
  }
}

/* ---------- Pluma (P) ---------- */
App.tools.pen = {
  cursor: 'crosshair',
  activate() { this.cur = null; },
  deactivate() { this.finish(); },
  finish() {
    const c = this.cur;
    if (c) {
      if (c.sub.nodes.length < 2 && !c.continued) { c.el.remove(); App.emit('layers'); }
      else { Selection.set([Layers.topObject(c.el) || c.el]); History.commit(); }
    }
    this.cur = null; this.drag = null; SmartGuides.clear(); $('sbHint').textContent = ''; Selection.draw();
  },
  render() { const c = this.cur; c.el.setAttribute('d', PathData.serialize([c.sub, ...c.others])); },
  /* extremo de un trazado abierto bajo el puntero (para continuarlo) */
  findEndpoint(sp) {
    for (const o of Layers.objects()) for (const el of leafShapes(o)) {
      if (el.tagName !== 'path' || !editable(el)) continue;
      const subs = PathData.parse(el.getAttribute('d') || ''), m = el.getCTM();
      for (const [si, s] of subs.entries()) {
        if (s.closed || !s.nodes.length) continue;
        for (const end of [0, s.nodes.length - 1]) if (Geo.dist(toStage(m, s.nodes[end]), sp) < 7) return { el, subs, si, end };
      }
    }
    return null;
  },
  selectedPaths() { return App.selection.length === 1 ? leafShapes(App.selection[0]).filter(s => s.tagName === 'path' && editable(s)) : []; },
  /* con un trazado seleccionado: clic en segmento añade punto, clic en ancla lo borra */
  addDeleteHit(sp) {
    for (const el of this.selectedPaths()) {
      const it = { el, subs: PathData.parse(el.getAttribute('d') || '') }, h = hitPath(it, sp);
      if (!h) continue;
      if (h.kind === 'anchor' && !(!h.sub.closed && (h.i === 0 || h.i === h.sub.nodes.length - 1))) return { op: 'del', h };
      if (h.kind === 'segment') return { op: 'add', h };
    }
    return null;
  },
  hover(p, ev, sp) {
    this.cursorPt = p;
    if (!this.cur) {
      const ad = this.addDeleteHit(sp);
      $('sbHint').textContent = ad ? (ad.op === 'add' ? 'Pluma: añadir punto de ancla' : 'Pluma: eliminar punto de ancla') : this.findEndpoint(sp) ? 'Pluma: continuar trazado' : '';
    }
    if (this.cur) Selection.draw();
  },
  down(p, ev, sp) {
    SmartGuides.prepare(this.cur ? [Layers.topObject(this.cur.el) || this.cur.el] : []);
    if (!this.cur) {
      const ad = this.addDeleteHit(sp);
      if (ad) {
        const { h } = ad, it = h.it;
        if (ad.op === 'del') h.sub.nodes.splice(h.i, 1);
        else { const s = h.sub, a = s.nodes[h.i], b = s.nodes[(h.i + 1) % s.nodes.length]; s.nodes.splice(h.i + 1, 0, splitBez(a, b, h.t)); }
        renderItem(it); History.commit(); Selection.draw(); return;
      }
      const ep = this.findEndpoint(sp);
      if (ep) {
        const sub = ep.subs[ep.si]; if (ep.end === 0) reverseSub(sub);
        this.cur = { el: ep.el, sub, others: ep.subs.filter((_, i) => i !== ep.si), continued: true };
        this.drag = sub.nodes[sub.nodes.length - 1];
        Selection.set([Layers.topObject(ep.el) || ep.el]); return;
      }
      p = snapPt(p, ev);
      const a = newShapeAttrs(); if (a.stroke === 'none') a.stroke = '#000000';
      const el = addObject(svgEl('path', { ...a, d: `M${p.x} ${p.y}` })); if (!el) return;
      const q = toLocal(el, p), n = { x: q.x, y: q.y, hin: null, hout: null };
      this.cur = { el, sub: { nodes: [n], closed: false }, others: [] }; this.drag = n; return;
    }
    p = snapPt(p, ev);
    const c = this.cur, nodes = c.sub.nodes, first = nodes[0], m = c.el.getCTM();
    if (nodes.length > 1 && Geo.dist(toStage(m, first), sp) < 7) { c.sub.closed = true; this.drag = first; this.closing = true; this.render(); return; }
    const q = toLocal(c.el, p), n = { x: q.x, y: q.y, hin: null, hout: null };
    nodes.push(n); this.drag = n; this.render();
  },
  move(p, ev) {
    this.cursorPt = p;
    const n = this.drag;
    if (n && this.cur) {
      let h = toLocal(this.cur.el, p);
      if (Geo.dist(h, n) * App.view.zoom > 2) {
        if (ev.shiftKey) { const a = Math.round(Math.atan2(h.y - n.y, h.x - n.x) / (Math.PI / 4)) * Math.PI / 4, l = Geo.dist(h, n); h = { x: n.x + l * Math.cos(a), y: n.y + l * Math.sin(a) }; }
        n.hout = h;
        if (!ev.altKey) n.hin = { x: 2 * n.x - h.x, y: 2 * n.y - h.y }; /* Alt rompe el manejador */
        this.render();
      }
    }
    Selection.draw();
  },
  up() { this.drag = null; SmartGuides.clear(); if (this.closing) { this.closing = false; this.finish(); } },
  key(ev) { if (ev.key === 'Enter' || ev.key === 'Escape') { this.finish(); return true; } },
  overlay(g) {
    const c = this.cur;
    if (!c) { for (const el of this.selectedPaths()) drawItemNodes(g, { el, subs: PathData.parse(el.getAttribute('d') || '') }, new Set()); return; }
    const m = c.el.getCTM(), nodes = c.sub.nodes, last = nodes[nodes.length - 1];
    if (this.cursorPt && !this.drag) {
      const a = toStage(m, last), cpt = View.docToStage(this.cursorPt.x, this.cursorPt.y), h = last.hout ? toStage(m, last.hout) : a;
      svgEl('path', { d: `M${a.x} ${a.y}Q${h.x} ${h.y} ${cpt.x} ${cpt.y}`, fill: 'none', stroke: '#1e90ff', 'stroke-dasharray': '3 2' }, g);
    }
    nodes.forEach((n, i) => {
      const a = toStage(m, n);
      if (i === nodes.length - 1 || n === this.drag) { if (n.hin) overlayHandle(g, a, toStage(m, n.hin)); if (n.hout) overlayHandle(g, a, toStage(m, n.hout)); }
      overlayAnchor(g, a, i === nodes.length - 1);
    });
  },
};

/* ---------- Selección directa (A): puntos de varios trazados ---------- */
App.tools.direct = {
  cursor: 'default',
  activate() {
    this.items = []; this.sel = new Set();
    for (const s of App.selection) for (const l of leafShapes(s)) if (editable(l)) this.items.push(pathItem(l));
  },
  deactivate() { this.items = []; this.sel = new Set(); },
  itemOf(n) { return this.items.find(it => it.subs.some(s => s.nodes.includes(n))); },
  sync() {
    this.items = this.items.filter(it => it.el.isConnected);
    Selection.set([...new Set(this.items.map(it => Layers.topObject(it.el) || it.el))]);
  },
  findHit(sp) { for (const it of this.items) { const h = hitPath(it, sp, this.sel); if (h) return h; } return null; },
  /* mueve los puntos seleccionados un vector del documento */
  moveSel(dx, dy) {
    for (const it of this.items) {
      const d = localDelta(it.el, dx, dy); let touched = false;
      for (const s of it.subs) for (const n of s.nodes) if (this.sel.has(n)) { shiftNode(n, d); touched = true; }
      if (touched) renderItem(it);
    }
  },
  down(p, ev, sp) {
    let h = this.findHit(sp);
    if (!h) {
      let t = hitTarget(ev); if (t && t.tagName === 'tspan') t = t.parentNode;
      if (t && App.els.content.contains(t) && editable(t)) {
        let it = this.items.find(i => i.el === t);
        if (!it) { it = pathItem(t); if (ev.shiftKey) this.items.push(it); else { this.items = [it]; this.sel = new Set(); } }
        h = hitPath(it, sp, this.sel);
        if (!h) { /* clic en el relleno: todo el trazado */
          if (!ev.shiftKey) this.sel = new Set();
          it.subs.forEach(s => s.nodes.forEach(n => this.sel.add(n)));
          this.drag = { kind: 'move', last: p }; this.sync(); return;
        }
      }
    }
    if (h) {
      if (h.kind === 'anchor') {
        if (ev.altKey) { h.node.hin = h.node.hout = null; renderItem(h.it); History.commit(); Selection.draw(); return; }
        if (ev.shiftKey) this.sel.has(h.node) ? this.sel.delete(h.node) : this.sel.add(h.node);
        else if (!this.sel.has(h.node)) this.sel = new Set([h.node]);
        this.drag = { kind: 'move', last: p };
      } else if (h.kind === 'segment') {
        const s = h.sub, a = s.nodes[h.i], b = s.nodes[(h.i + 1) % s.nodes.length];
        if (!ev.shiftKey) this.sel = new Set(); this.sel.add(a); this.sel.add(b);
        this.drag = { kind: 'move', last: p };
      } else this.drag = { kind: h.kind, node: h.node, it: h.it };
      this.sync(); return;
    }
    if (!ev.shiftKey) this.sel = new Set();
    Marquee.start(p); Selection.draw();
  },
  move(p, ev) {
    if (Marquee.el) return Marquee.move(p);
    const d = this.drag; if (!d) return;
    if (d.kind === 'move') { this.moveSel(p.x - d.last.x, p.y - d.last.y); d.last = p; }
    else {
      const n = d.node, q = toLocal(d.it.el, p), o = d.kind === 'hin' ? 'hout' : 'hin';
      n[d.kind] = q;
      if (n[o] && !ev.altKey) { const L = Geo.dist(n, n[o]), a = Math.atan2(n.y - q.y, n.x - q.x); n[o] = { x: n.x + L * Math.cos(a), y: n.y + L * Math.sin(a) }; }
      renderItem(d.it);
    }
    d.moved = true; Selection.draw();
  },
  up(p, ev) {
    if (Marquee.el) {
      const p0 = Marquee.p0, p1 = Marquee.p1; Marquee.end();
      if (p1) {
        const x1 = Math.min(p0.x, p1.x), x2 = Math.max(p0.x, p1.x), y1 = Math.min(p0.y, p1.y), y2 = Math.max(p0.y, p1.y);
        const inside = (el, n) => { const q = Geo.pt(Geo.toDoc(el), n.x, n.y); return q.x >= x1 && q.x <= x2 && q.y >= y1 && q.y <= y2; };
        for (const o of Layers.objects()) for (const el of leafShapes(o)) {
          if (!editable(el)) continue;
          const subs = PathData.parse(PathData.fromShape(el) || '');
          if (!subs.some(s => s.nodes.some(n => inside(el, n)))) continue;
          let it = this.items.find(i => i.el === el); if (!it) { it = pathItem(el); this.items.push(it); }
          it.subs.forEach(s => s.nodes.forEach(n => { if (inside(it.el, n)) this.sel.add(n); }));
        }
        this.items = this.items.filter(it => it.subs.some(s => s.nodes.some(n => this.sel.has(n))));
        this.sync();
      } else { this.items = []; this.sel = new Set(); Selection.clear(); }
      return;
    }
    if (this.drag && this.drag.moved) History.commit();
    this.drag = null;
  },
  dblclick(p, ev, sp) { /* doble clic en un segmento: añadir punto de ancla */
    const h = this.findHit(sp); if (!h || h.kind !== 'segment') return;
    const s = h.sub, a = s.nodes[h.i], b = s.nodes[(h.i + 1) % s.nodes.length], n = splitBez(a, b, h.t);
    s.nodes.splice(h.i + 1, 0, n); renderItem(h.it); this.sel = new Set([n]); History.commit(); Selection.draw();
  },
  nudge(dx, dy) { if (!this.sel.size) return false; this.moveSel(dx, dy); History.commit(); Selection.draw(); return true; },
  onDelete() {
    if (!this.sel.size) return false;
    for (const it of this.items) {
      it.subs.forEach(s => s.nodes = s.nodes.filter(n => !this.sel.has(n)));
      it.subs = it.subs.filter(s => s.nodes.length > 1);
      if (!it.subs.length) it.el.remove(); else renderItem(it);
    }
    this.sel = new Set(); this.sync(); History.commit(); App.emit('layers'); return true;
  },
  overlay(g) { for (const it of this.items) if (it.el.isConnected) drawItemNodes(g, it, this.sel); },
};

/* ---------- Convertir punto de ancla (Mayús+C) ---------- */
App.tools.convert = {
  cursor: 'crosshair',
  targets(ev) {
    const els = App.selection.flatMap(leafShapes).filter(editable);
    let t = hitTarget(ev); if (t && editable(t) && !els.includes(t)) els.push(t);
    return els.map(el => ({ el, subs: PathData.parse(PathData.fromShape(el) || '') }));
  },
  down(p, ev, sp) {
    for (const raw of this.targets(ev)) {
      const all = new Set(raw.subs.flatMap(s => s.nodes)), h = hitPath(raw, sp, all);
      if (!h || h.kind === 'segment') continue;
      const it = raw.el.tagName === 'path' ? raw : pathItem(raw.el);
      const node = it === raw ? h.node : it.subs[raw.subs.indexOf(h.sub)].nodes[h.sub.nodes.indexOf(h.node)];
      if (h.kind === 'anchor' && (node.hin || node.hout)) { node.hin = node.hout = null; renderItem(it); History.commit(); Selection.draw(); return; }
      this.drag = { it, node, kind: h.kind === 'anchor' ? 'pull' : h.kind };
      if (!App.selection.includes(Layers.topObject(it.el))) Selection.set([Layers.topObject(it.el) || it.el]);
      return;
    }
  },
  move(p) {
    const d = this.drag; if (!d) return;
    const q = toLocal(d.it.el, p), n = d.node;
    if (d.kind === 'pull') { n.hout = q; n.hin = { x: 2 * n.x - q.x, y: 2 * n.y - q.y }; }
    else n[d.kind] = q; /* manejadores independientes */
    d.moved = true; renderItem(d.it); Selection.draw();
  },
  up() { if (this.drag && this.drag.moved) History.commit(); this.drag = null; },
  overlay(g) {
    for (const el of App.selection.flatMap(leafShapes).filter(editable)) {
      const it = { el, subs: PathData.parse(PathData.fromShape(el) || '') };
      drawItemNodes(g, it, new Set(), true);
    }
  },
};
ICONS.convert = '<path d="M5 20l7-14 7 14"/><path d="M8 6h8" stroke-dasharray="2 2"/><rect x="10.5" y="4.5" width="3" height="3"/>';
TOOL_LIST.splice(TOOL_LIST.findIndex(t => t[0] === 'pen') + 1, 0, ['convert', 'Convertir punto de ancla', 'Mayús+C']);
