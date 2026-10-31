/* Vectora — pluma, lápiz, selección directa, texto, degradado y mesa de trabajo */
'use strict';

function docDefs() {
  let d = App.els.content.querySelector(':scope > defs');
  if (!d) { d = svgEl('defs'); App.els.content.prepend(d); }
  return d;
}
const toStage = (m, p) => Geo.pt(m, p.x, p.y);
function overlayAnchor(g, p, filled, color = '#1e90ff') {
  svgEl('rect', { x: p.x - 3, y: p.y - 3, width: 6, height: 6, fill: filled ? color : '#fff', stroke: color }, g);
}
function overlayHandle(g, a, h, color = '#1e90ff') {
  svgEl('line', { x1: a.x, y1: a.y, x2: h.x, y2: h.y, stroke: color }, g);
  svgEl('circle', { cx: h.x, cy: h.y, r: 3, fill: color }, g);
}

/* ---------- Lápiz (N) ---------- */
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  let dmax = 0, idx = 0; const a = pts[0], b = pts[pts.length - 1];
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((b.y - a.y) * pts[i].x - (b.x - a.x) * pts[i].y + b.x * a.y - b.y * a.x) / L;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= eps) return [a, b];
  return rdp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(pts.slice(idx), eps));
}
/* simplificación de un anillo cerrado (sin repetir el primer punto al final):
   se parte por el punto más alejado del inicio para que ningún tramo degenere */
function rdpClosed(r, eps) {
  if (r.length < 4) return r;
  let far = 0, fd = -1;
  r.forEach((p, i) => { const d = Math.hypot(p.x - r[0].x, p.y - r[0].y); if (d > fd) { fd = d; far = i; } });
  const a = rdp(r.slice(0, far + 1), eps), b = rdp([...r.slice(far), r[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}
function smoothNodes(pts, closed) {
  const n = pts.length, nodes = pts.map(p => ({ x: p.x, y: p.y, hin: null, hout: null }));
  for (let i = 0; i < n; i++) {
    const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    if (!closed && (i === 0 || i === n - 1)) continue;
    const tx = (next.x - prev.x) / 6, ty = (next.y - prev.y) / 6;
    nodes[i].hin = { x: pts[i].x - tx, y: pts[i].y - ty }; nodes[i].hout = { x: pts[i].x + tx, y: pts[i].y + ty };
  }
  return nodes;
}
App.tools.pencil = {
  cursor: 'crosshair', smooth: 2.5,
  options() { return `Suavizado <input type="range" id="optSmooth" min="0.5" max="10" step="0.5" value="${this.smooth}">`; },
  bindOptions() { $('optSmooth').oninput = e => this.smooth = +e.target.value; },
  down(p) {
    this.pts = [p];
    const a = newShapeAttrs(); a.fill = 'none'; if (a.stroke === 'none') a.stroke = '#000000';
    this.el = addObject(svgEl('path', { ...a, d: `M${p.x} ${p.y}` }));
  },
  move(p) {
    if (!this.pts || !this.el) return;
    this.pts.push(p);
    this.el.setAttribute('d', 'M' + this.pts.map(q => `${round(q.x)} ${round(q.y)}`).join('L'));
  },
  up() {
    if (!this.pts || !this.el) return;
    const z = App.view.zoom, pts = this.pts;
    if (pts.length < 3) { this.el.remove(); this.pts = null; return; }
    const closed = Geo.dist(pts[0], pts[pts.length - 1]) * z < 10 && pts.length > 10;
    const s = closed ? rdpClosed(pts, this.smooth / z) : rdp(pts, this.smooth / z);
    this.el.setAttribute('d', PathData.serialize([{ nodes: smoothNodes(s, closed), closed }]));
    Selection.set([this.el]); History.commit(); this.pts = null; this.el = null;
  },
};

function bez(a, b, t) {
  const p1 = a.hout || a, p2 = b.hin || b, u = 1 - t;
  return { x: u * u * u * a.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * b.x,
           y: u * u * u * a.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * b.y };
}
function splitBez(a, b, t) {
  const L = (p, q) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  if (!a.hout && !b.hin) return { ...L(a, b), hin: null, hout: null };
  const p1 = a.hout || a, p2 = b.hin || b;
  const m1 = L(a, p1), m2 = L(p1, p2), m3 = L(p2, b), n1 = L(m1, m2), n2 = L(m2, m3), c = L(n1, n2);
  a.hout = m1; b.hin = m3;
  return { x: c.x, y: c.y, hin: n1, hout: n2 };
}

/* ---------- Texto (T) ---------- */
App.textOpts = { family: 'Arial', size: 24, weight: 'normal', style: 'normal', anchor: 'start' };
const FONTS = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana', 'Courier New', 'Trebuchet MS', 'Impact', 'Segoe UI', 'Comic Sans MS'];
const TextTool = App.tools.text = {
  cursor: 'text',
  options() {
    const o = App.textOpts;
    return `<select id="optFont">${FONTS.map(f => `<option ${f === o.family ? 'selected' : ''}>${f}</option>`).join('')}</select>
      <input type="number" id="optSize" min="1" value="${o.size}"> pt
      <select id="optWeight"><option value="normal">Normal</option><option value="bold" ${o.weight === 'bold' ? 'selected' : ''}>Negrita</option></select>
      <select id="optStyle"><option value="normal">Recta</option><option value="italic" ${o.style === 'italic' ? 'selected' : ''}>Cursiva</option></select>
      <select id="optAnchor"><option value="start">Izquierda</option><option value="middle" ${o.anchor === 'middle' ? 'selected' : ''}>Centro</option><option value="end" ${o.anchor === 'end' ? 'selected' : ''}>Derecha</option></select>`;
  },
  bindOptions() {
    const map = { optFont: ['family', 'font-family'], optSize: ['size', 'font-size'], optWeight: ['weight', 'font-weight'], optStyle: ['style', 'font-style'], optAnchor: ['anchor', 'text-anchor'] };
    for (const id in map) $(id).onchange = e => {
      const [k, attr] = map[id]; App.textOpts[k] = id === 'optSize' ? +e.target.value : e.target.value;
      const texts = App.selection.filter(el => el.tagName === 'text');
      if (texts.length) { texts.forEach(t => t.setAttribute(attr, App.textOpts[k])); History.commit(); Selection.draw(); }
      if (this.editing) this.styleEditor();
    };
  },
  down(p, ev) {
    ev.preventDefault();
    if (this.editing) { this.commit(); return; }
    const o = hitObject(ev);
    if (o && o.tagName === 'text') return this.edit(o);
    this.edit(null, p);
  },
  edit(el, p) {
    const ta = $('textEditor'); this.editing = { el, p };
    if (el) {
      const lines = [...el.querySelectorAll('tspan')].map(t => t.textContent);
      ta.value = lines.length ? lines.join('\n') : el.textContent;
      Object.assign(App.textOpts, { family: el.getAttribute('font-family') || 'Arial', size: +el.getAttribute('font-size') || 24,
        weight: el.getAttribute('font-weight') || 'normal', style: el.getAttribute('font-style') || 'normal', anchor: el.getAttribute('text-anchor') || 'start' });
      this.editing.p = Geo.pt(Geo.toDoc(el), parseFloat(el.getAttribute('x')) || 0, parseFloat(el.getAttribute('y')) || 0);
      el.setAttribute('opacity', '0');
    } else ta.value = '';
    this.styleEditor(); ta.style.display = 'block'; ta.focus(); setTimeout(() => ta.focus(), 0);
    ta.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && e.ctrlKey)) this.commit(); };
    ta.oninput = () => this.styleEditor();
  },
  styleEditor() {
    const ta = $('textEditor'), o = App.textOpts, z = App.view.zoom, e = this.editing; if (!e) return;
    const s = View.docToStage(e.p.x, e.p.y - o.size * 0.95);
    const lines = ta.value.split('\n');
    const w = Math.max(40, Math.max(...lines.map(l => l.length)) * o.size * z * 0.62 + 20);
    const shift = o.anchor === 'middle' ? w / 2 : o.anchor === 'end' ? w : 0;
    Object.assign(ta.style, { left: s.x - shift + 'px', top: s.y + 'px', width: w + 'px', height: lines.length * o.size * z * 1.2 + 8 + 'px',
      textAlign: o.anchor === 'middle' ? 'center' : o.anchor === 'end' ? 'right' : 'left',
      fontFamily: o.family, fontSize: o.size * z + 'px', fontWeight: o.weight, fontStyle: o.style,
      color: App.fill === 'none' || App.fill.startsWith('url(') ? '#000' : App.fill });
  },
  commit() {
    const e = this.editing; if (!e) return; this.editing = null;
    const ta = $('textEditor'), txt = ta.value; ta.style.display = 'none'; ta.blur();
    const o = App.textOpts;
    let el = e.el;
    if (!txt.trim()) { if (el) { el.remove(); History.commit(); App.emit('layers'); } return; }
    if (!el) {
      el = addObject(svgEl('text', { x: round(e.p.x), y: round(e.p.y), fill: App.fill === 'none' ? '#000000' : App.fill,
        'font-family': o.family, 'font-size': o.size, 'font-weight': o.weight, 'font-style': o.style,
        'text-anchor': o.anchor === 'start' ? null : o.anchor }));
      if (!el) return;
    }
    el.removeAttribute('opacity');
    const x = el.getAttribute('x') || 0;
    el.textContent = '';
    const lead = round((+el.getAttribute('data-leading') || 120) / 100, 3) + 'em';
    txt.split('\n').forEach((line, i) => { const t = svgEl('tspan', { x, dy: i ? lead : null }, el); t.textContent = line || ' '; });
    el.setAttribute('data-name', txt.split('\n')[0].slice(0, 30));
    Selection.set([el]); History.commit(); App.emit('layers');
  },
  deactivate() { this.commit(); },
};

/* ---------- Degradado (G) ---------- */
App.gradOpts = { a: '#ffffff', b: '#000000', type: 'linear' };
App.tools.gradient = {
  cursor: 'crosshair',
  options() {
    const o = App.gradOpts;
    return `<select id="optGType"><option value="linear">Lineal</option><option value="radial" ${o.type === 'radial' ? 'selected' : ''}>Radial</option></select>
      Inicio <input type="color" id="optGA" value="${o.a}"> Fin <input type="color" id="optGB" value="${o.b}">
      <span style="color:#888">Arrastra sobre la selección</span>`;
  },
  bindOptions() {
    $('optGType').onchange = e => App.gradOpts.type = e.target.value;
    $('optGA').oninput = e => App.gradOpts.a = e.target.value;
    $('optGB').oninput = e => App.gradOpts.b = e.target.value;
  },
  down(p, ev) {
    if (!App.selection.length) { const o = hitObject(ev); if (o) Selection.set([o]); }
    if (!App.selection.length) return;
    this.p0 = p; this.grads = [];
    for (const s of App.selection.flatMap(leafShapes)) {
      if (s.tagName === 'image') continue;
      const o = App.gradOpts, id = uid('grad');
      const g = svgEl(o.type === 'radial' ? 'radialGradient' : 'linearGradient', { id, gradientUnits: 'userSpaceOnUse' }, docDefs());
      svgEl('stop', { offset: 0, 'stop-color': o.a }, g); svgEl('stop', { offset: 1, 'stop-color': o.b }, g);
      s.setAttribute('fill', `url(#${id})`); this.grads.push({ g, inv: Geo.toDoc(s).inverse() });
    }
    this.move(p);
  },
  move(p) {
    if (!this.p0) return;
    for (const { g, inv } of this.grads) {
      const a = Geo.pt(inv, this.p0.x, this.p0.y), b = Geo.pt(inv, p.x, p.y);
      if (g.tagName === 'radialGradient') setA(g, { cx: a.x, cy: a.y, r: Math.max(1, Geo.dist(a, b)) });
      else setA(g, { x1: a.x, y1: a.y, x2: b.x === a.x && b.y === a.y ? a.x + 1 : b.x, y2: b.y });
    }
  },
  up() { if (this.p0) { this.p0 = null; History.commit(); App.emit('selection'); } },
};
