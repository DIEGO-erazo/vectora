/* Vectora — operaciones de trazado: unir, simplificar, contornear trazo,
   desplazar trazado, transformar de nuevo y borrador real */
'use strict';

const isShape = e => e && !['g', 'text', 'image', 'use'].includes(e.tagName);
const docScale = el => { const m = Geo.toDoc(el); return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1; };
/* un trazado creado en coordenadas del documento, compensando la transformación del padre */
function placeDocPath(p) {
  const P = Geo.toDoc(p.parentNode);
  if (Math.abs(P.a - 1) + Math.abs(P.b) + Math.abs(P.c) + Math.abs(P.d - 1) + Math.abs(P.e) + Math.abs(P.f) > 1e-9) Geo.setMatrix(p, P.inverse());
  return p;
}
function replaceWithPath(old, subs, attrs) {
  const d = PathData.serialize(subs); if (!d) { old.remove(); return null; }
  const p = svgEl('path', { id: uid(), ...attrs, d }); old.before(p); old.remove(); return placeDocPath(p);
}
/* ¿se tocan dos polígonos? (contención de vértices o cruce de aristas) */
function polysTouch(A, B) {
  if (A.rings.some(r => r.some(p => Boolean2D.inside(B, p))) || B.rings.some(r => r.some(p => Boolean2D.inside(A, p)))) return true;
  const cross = (a, b, c, d) => {
    const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
    return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
  };
  for (const ra of A.rings) for (let i = 0; i < ra.length; i++) {
    const a = ra[i], b = ra[(i + 1) % ra.length];
    for (const rb of B.rings) for (let j = 0; j < rb.length; j++) if (cross(a, b, rb[j], rb[(j + 1) % rb.length])) return true;
  }
  return false;
}
function signedArea(pts) { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y); return a / 2; }
function circlePoly(c, r, n = 24) { const out = []; for (let i = 0; i < n; i++) { const a = i / n * 2 * Math.PI; out.push({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }); } return out; }

/* polígono (regla nonzero) del área cubierta por el trazo de unas polilíneas */
function strokePolygon(lines, hw, join = 'miter', cap = 'butt', miterLimit = 4) {
  const rings = [];
  const add = pts => { if (pts.length < 3) return; if (signedArea(pts) < 0) pts.reverse(); rings.push(pts.map(p => ({ x: p.x, y: p.y }))); };
  for (const { pts: raw, closed } of lines) {
    const pts = raw.filter((p, i) => i === 0 || Geo.dist(p, raw[i - 1]) > 1e-6);
    if (closed && pts.length > 1 && Geo.dist(pts[0], pts[pts.length - 1]) < 1e-6) pts.pop();
    if (pts.length < 2) { if (pts.length === 1 && cap === 'round') add(circlePoly(pts[0], hw)); continue; }
    const n = pts.length, segCount = closed ? n : n - 1;
    const dir = i => { const a = pts[i], b = pts[(i + 1) % n], L = Geo.dist(a, b); return { x: (b.x - a.x) / L, y: (b.y - a.y) / L }; };
    for (let i = 0; i < segCount; i++) {
      const a = pts[i], b = pts[(i + 1) % n], d = dir(i), nx = -d.y * hw, ny = d.x * hw;
      let ea = { ...a }, eb = { ...b };
      if (!closed && cap === 'square') { if (i === 0) ea = { x: a.x - d.x * hw, y: a.y - d.y * hw }; if (i === segCount - 1) eb = { x: b.x + d.x * hw, y: b.y + d.y * hw }; }
      add([{ x: ea.x + nx, y: ea.y + ny }, { x: eb.x + nx, y: eb.y + ny }, { x: eb.x - nx, y: eb.y - ny }, { x: ea.x - nx, y: ea.y - ny }]);
    }
    /* uniones */
    for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
      const v = pts[i], d1 = dir((i - 1 + n) % n), d2 = dir(i);
      const cross = d1.x * d2.y - d1.y * d2.x; if (Math.abs(cross) < 1e-9 && d1.x * d2.x + d1.y * d2.y > 0) continue;
      if (join === 'round') { add(circlePoly(v, hw)); continue; }
      const s = cross > 0 ? -1 : 1; /* lado exterior del giro */
      const p1 = { x: v.x - d1.y * hw * s, y: v.y + d1.x * hw * s }, p2 = { x: v.x - d2.y * hw * s, y: v.y + d2.x * hw * s };
      const cosT = clamp(d1.x * d2.x + d1.y * d2.y, -1, 1), half = Math.acos(-cosT) / 2;
      const mlen = hw / Math.max(Math.sin(half), 1e-9);
      if (join === 'miter' && mlen / hw <= miterLimit) {
        const bis = { x: (p1.x + p2.x) / 2 - v.x, y: (p1.y + p2.y) / 2 - v.y }, bl = Math.hypot(bis.x, bis.y) || 1;
        add([v, p1, { x: v.x + bis.x / bl * mlen, y: v.y + bis.y / bl * mlen }, p2]);
      } else add([v, p1, p2]);
    }
    if (!closed && cap === 'round') { add(circlePoly(pts[0], hw)); add(circlePoly(pts[n - 1], hw)); }
  }
  return { rings, rule: 'nonzero' };
}
/* polilíneas (en coordenadas del documento) de una forma */
function shapeLines(el) {
  return pathSubsDoc(el).map(s => ({ pts: Boolean2D.flatten(s), closed: s.closed }));
}
function outlinePoly(el, width) {
  const hw = width / 2;
  const sp = strokePolygon(shapeLines(el), hw, el.getAttribute('stroke-linejoin') || 'miter', el.getAttribute('stroke-linecap') || 'butt', +(el.getAttribute('stroke-miterlimit') || 4));
  return Boolean2D.op(sp, { rings: [], rule: 'nonzero' }, 'union');
}

const PathOps = {
  /* Unir (Ctrl+J): cierra un trazado abierto o une dos por sus extremos más cercanos */
  join() {
    const sel = docOrder(App.selection).filter(isShape);
    if (sel.length === 1) {
      const subs = pathSubsDoc(sel[0]); let changed = false;
      subs.forEach(s => { if (!s.closed && s.nodes.length > 1) { s.closed = true; changed = true; } });
      if (!changed) return;
      Selection.set([replaceWithPath(sel[0], subs, styleAttrs(sel[0]))]); History.commit(); App.emit('layers'); return;
    }
    if (sel.length !== 2) return Dialog.alert('Selecciona uno o dos trazados abiertos.');
    const [A, B] = sel, sa = pathSubsDoc(A).find(s => !s.closed), sb = pathSubsDoc(B).find(s => !s.closed);
    if (!sa || !sb) return Dialog.alert('Los dos trazados deben estar abiertos.');
    const ends = (s) => [s.nodes[0], s.nodes[s.nodes.length - 1]];
    let best = null;
    for (const [ia, pa] of ends(sa).entries()) for (const [ib, pb] of ends(sb).entries()) {
      const d = Geo.dist(pa, pb); if (!best || d < best.d) best = { d, ia, ib };
    }
    const rev = s => { s.nodes.reverse(); s.nodes.forEach(n => { [n.hin, n.hout] = [n.hout, n.hin]; }); };
    if (best.ia === 0) rev(sa); /* el extremo de unión de A queda al final */
    if (best.ib === 1) rev(sb); /* el de B al principio */
    const la = sa.nodes[sa.nodes.length - 1], fb = sb.nodes[0];
    if (best.d < 0.5) { la.hout = fb.hout; sb.nodes.shift(); }
    sa.nodes.push(...sb.nodes);
    const others = pathSubsDoc(A).filter(s => s.closed).concat(pathSubsDoc(B).filter(s => s.closed));
    B.remove();
    Selection.set([replaceWithPath(A, [sa, ...others], styleAttrs(A))]); History.commit(); App.emit('layers');
  },

  async simplify() {
    const sel = App.selection.filter(isShape); if (!sel.length) return;
    const v = await Dialog.form('Simplificar', [{ id: 'tol', label: 'Tolerancia (px)', type: 'number', value: 2, step: 0.5, min: 0.1 }]);
    if (!v) return;
    const out = sel.map(el => {
      const subs = pathSubsDoc(el).map(s => {
        let pts = Boolean2D.flatten(s).map(p => ({ x: p.x, y: p.y }));
        if (s.closed) pts.push(pts[0]);
        pts = rdp(pts, +v.tol); if (s.closed) pts.pop();
        return { nodes: smoothNodes(pts, s.closed), closed: s.closed };
      });
      return replaceWithPath(el, subs, styleAttrs(el));
    }).filter(Boolean);
    Selection.set(out); History.commit(); App.emit('layers');
  },

  /* Contornear trazo: el trazo pasa a ser una forma rellena */
  outlineStroke() {
    const out = [];
    for (const el of docOrder(App.selection)) {
      const shapes = el.tagName === 'g' ? leafShapes(el).filter(isShape) : isShape(el) ? [el] : [];
      for (const s of shapes) {
        const stroke = getStyle(s, 'stroke'); if (!stroke || stroke === 'none') { out.push(s); continue; }
        const w = (+getStyle(s, 'stroke-width') || 1) * docScale(s);
        const d = Boolean2D.toPath(outlinePoly(s, w));
        const fill = getStyle(s, 'fill');
        const p = svgEl('path', { id: uid(), d, fill: stroke, stroke: 'none', opacity: s.getAttribute('opacity') });
        if (fill && fill !== 'none') {
          const base = Geo.toDoc(s), g = svgEl('g', { id: uid() }); s.before(g);
          g.appendChild(s); Geo.setMatrix(s, Geo.toDoc(g).inverse().multiply(base)); s.setAttribute('stroke', 'none'); g.appendChild(p);
          out.push(g);
        } else { s.before(p); s.remove(); placeDocPath(p); out.push(p); }
      }
    }
    Selection.set(out); History.commit(); App.emit('layers');
  },

  async offsetPath() {
    const sel = App.selection.filter(isShape); if (!sel.length) return;
    const v = await Dialog.form('Desplazar trazado', [
      { id: 'd', label: 'Desplazamiento (px)', type: 'number', value: 10, step: 1 },
      { id: 'join', label: 'Uniones', type: 'select', value: 'miter', options: [['miter', 'Inglete'], ['round', 'Redondas'], ['bevel', 'Biseladas']] },
    ]);
    if (!v || !+v.d) return;
    const d = +v.d, out = [];
    for (const el of sel) {
      const base = Boolean2D.fromSubs(pathSubsDoc(el).filter(s => s.closed), el.getAttribute('fill-rule') || 'nonzero');
      if (!base.rings.length) continue;
      const band = strokePolygon(base.rings.map(r => ({ pts: r, closed: true })), Math.abs(d), v.join, 'butt', 8);
      const res = Boolean2D.op(base, band, d > 0 ? 'union' : 'difference');
      const p = svgEl('path', { id: uid(), ...styleAttrs(el), d: Boolean2D.toPath(res) });
      el.before(p); placeDocPath(p); out.push(p); /* como en Illustrator, el original se conserva encima */
      el.parentNode.appendChild(el);
    }
    Selection.set(out); History.commit(); App.emit('layers');
  },

  /* Transformar de nuevo (Ctrl+D) */
  transformAgain() {
    const t = App.lastTransform; if (!t || !App.selection.length) return;
    let els = App.selection.filter(e => !Layers.isLocked(e));
    if (t.duplicate) els = els.map(e => { const c = cloneWithIds(e); e.after(c); return c; });
    els.forEach(e => { Geo.applyDoc(e, t.matrix); normalizeTransform(e); });
    Selection.set(els); History.commit(); App.emit('layers');
  },
};

/* ---------- Borrador real (Mayús+E): resta el área barrida ---------- */
App.eraserSize = 20;
App.tools.eraser = {
  cursor: 'crosshair',
  options() { return `Diámetro <input type="number" id="optErase" min="1" value="${App.eraserSize}"> px`; },
  bindOptions() { $('optErase').oninput = e => App.eraserSize = Math.max(1, +e.target.value); },
  down(p) { this.pts = [p]; },
  move(p) { if (!this.pts) return; if (Geo.dist(p, this.pts[this.pts.length - 1]) * App.view.zoom > 2) this.pts.push(p); Selection.draw(); },
  hover(p) { this.cursorPt = p; Selection.draw(); },
  overlay(g) {
    const z = App.view.zoom, w = App.eraserSize * z;
    if (this.pts) {
      const d = 'M' + this.pts.map(q => { const s = View.docToStage(q.x, q.y); return `${s.x} ${s.y}`; }).join('L');
      svgEl('path', { d, fill: 'none', stroke: 'rgba(30,144,255,.35)', 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    } else if (this.cursorPt) {
      const s = View.docToStage(this.cursorPt.x, this.cursorPt.y);
      svgEl('circle', { cx: s.x, cy: s.y, r: w / 2, fill: 'none', stroke: '#1e90ff' }, g);
    }
  },
  up() {
    const pts = this.pts; this.pts = null; if (!pts) return;
    if (pts.length === 1) pts.push({ x: pts[0].x + 0.01, y: pts[0].y });
    const hw = App.eraserSize / 2;
    const cut = Boolean2D.op(strokePolygon([{ pts, closed: false }], hw, 'round', 'round'), { rings: [], rule: 'nonzero' }, 'union');
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const area = { x: Math.min(...xs) - hw, y: Math.min(...ys) - hw, x2: Math.max(...xs) + hw, y2: Math.max(...ys) + hw };
    const targets = (App.selection.length ? App.selection : Layers.objects()).filter(o => !Layers.isLocked(o) && !Layers.isHidden(o));
    let changed = false;
    for (const o of targets) for (const s of (o.tagName === 'g' ? leafShapes(o) : [o]).filter(isShape)) {
      const b = Geo.bbox(s); if (!b || b.x > area.x2 || b.x + b.width < area.x || b.y > area.y2 || b.y + b.height < area.y) continue;
      const subs = pathSubsDoc(s), attrs = styleAttrs(s), fill = getStyle(s, 'fill');
      if (!fill || fill !== 'none') {
        const poly = Boolean2D.fromSubs(subs, s.getAttribute('fill-rule') || 'nonzero');
        if (!polysTouch(poly, cut)) continue;
        replaceWithPath(s, Boolean2D.toSubs(Boolean2D.op(poly, cut, 'difference')), attrs); changed = true;
      } else {
        /* trazo sin relleno: se corta la polilínea donde entra en la zona borrada */
        const parts = []; let hit = false;
        for (const sub of subs) {
          const raw = Boolean2D.flatten(sub).map(p => ({ x: p.x, y: p.y })); if (sub.closed) raw.push(raw[0]);
          /* densificar: puntos cada ~1 px para que el corte sea preciso también en tramos rectos */
          const fl = [];
          raw.forEach((p, i) => {
            if (i) { const q = raw[i - 1], n = Math.ceil(Geo.dist(p, q)); for (let k = 1; k < n; k++) fl.push({ x: q.x + (p.x - q.x) * k / n, y: q.y + (p.y - q.y) * k / n }); }
            fl.push(p);
          });
          let cur = [];
          for (const p of fl) { if (Boolean2D.inside(cut, p)) { hit = true; if (cur.length > 1) parts.push(cur); cur = []; } else cur.push(p); }
          if (cur.length > 1) parts.push(cur);
        }
        if (!hit) continue;
        replaceWithPath(s, parts.map(pp => ({ nodes: smoothNodes(rdp(pp, 0.5), false), closed: false })), attrs); changed = true;
      }
    }
    Selection.set(App.selection.filter(e => e.isConnected));
    if (changed) { History.commit(); App.emit('layers'); }
    Selection.draw();
  },
};
