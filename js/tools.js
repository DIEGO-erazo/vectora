/* Vectora — herramientas básicas: selección, formas, texto, mano, zoom, cuentagotas */
'use strict';

const ICONS = {
  select: '<path d="M5 3l11 8-5 1 3 6-2 1-3-6-4 4z" style="fill:var(--icon)" stroke="none"/>',
  direct: '<path d="M5 3l11 8-5 1 3 6-2 1-3-6-4 4z"/>',
  pen: '<path d="M12 3l6 9-4 6H10l-4-6zM12 3v7"/><circle cx="12" cy="11" r="1.4"/>',
  pencil: '<path d="M4 20l1-5L16 4l4 4L9 19zM14 6l4 4"/>',
  text: '<path d="M5 5h14M12 5v15M9 20h6"/>',
  line: '<path d="M5 19L19 5"/>',
  rect: '<rect x="4" y="6" width="16" height="12"/>',
  rrect: '<rect x="4" y="6" width="16" height="12" rx="4"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6"/>',
  polygon: '<path d="M12 4l8 6-3 9H7l-3-9z"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  rotate: '<path d="M19 12a7 7 0 1 1-2-5M17 3v4h-4"/>',
  scale: '<rect x="4" y="10" width="10" height="10"/><path d="M10 4h10v10M14 10l6-6"/>',
  eyedropper: '<path d="M14 4l6 6-2 2-6-6zM12 6L5 13v4l-1 3 3-1h4l7-7"/>',
  gradient: '<rect x="4" y="4" width="16" height="16"/><path d="M4 20L20 4" stroke-dasharray="2 2"/>',
  eraser: '<path d="M8 20h12M4 14l9-9 6 6-9 9H8z"/>',
  hand: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v5V4.5a1.5 1.5 0 0 1 3 0V11V6a1.5 1.5 0 0 1 3 0v8c0 4-2 6-6 6-3 0-4-1-6-4l-2-3a1.5 1.5 0 0 1 2.5-1.6L8 13"/>',
  zoom: '<circle cx="10" cy="10" r="6"/><path d="M15 15l5 5M7 10h6M10 7v6"/>',
  artboard: '<path d="M7 3v18M17 3v18M3 7h18M3 17h18"/>',
};

/* registro de herramientas: id -> [nombre, atajo] */
const TOOL_INFO = {
  select: ['Selección', 'V'], direct: ['Selección directa', 'A'], group: ['Selección de grupos', ''],
  wand: ['Varita mágica', 'Y'], lasso: ['Lazo', 'Q'],
  pen: ['Pluma', 'P'], convert: ['Convertir punto de ancla', 'Mayús+C'],
  text: ['Texto', 'T'], areatext: ['Texto de área', ''], pathtext: ['Texto en trazado', ''],
  line: ['Segmento de línea', '\\'], arc: ['Arco', ''], spiral: ['Espiral', ''], rgrid: ['Cuadrícula rectangular', ''], pgrid: ['Cuadrícula polar', ''],
  rect: ['Rectángulo', 'M'], rrect: ['Rectángulo redondeado', ''], ellipse: ['Elipse', 'L'], polygon: ['Polígono', ''], star: ['Estrella', ''],
  brush: ['Pincel', 'B'], blob: ['Pincel de manchas', 'Mayús+B'], pencil: ['Lápiz', 'N'],
  eraser: ['Borrador', 'Mayús+E'], scissors: ['Tijeras', 'C'], knife: ['Cuchillo', ''],
  rotate: ['Rotar', 'R'], reflect: ['Reflejar', 'O'], scale: ['Escala', 'S'], shear: ['Distorsionar', ''],
  builder: ['Creador de formas', 'Mayús+M'], gradient: ['Degradado', 'G'], eyedropper: ['Cuentagotas', 'I'], blend: ['Fusión', 'W'],
  artboard: ['Mesa de trabajo', 'Mayús+O'], hand: ['Mano', 'H'], zoom: ['Zoom', 'Z'],
};
/* grupos de la barra (como en Illustrator: la primera es la visible; mantener pulsado muestra el resto) */
const TOOL_GROUPS = [
  ['select'], ['direct', 'group'], ['wand', 'lasso'], '|',
  ['pen', 'convert'], ['text', 'areatext', 'pathtext'], ['line', 'arc', 'spiral', 'rgrid', 'pgrid'],
  ['rect', 'rrect', 'ellipse', 'polygon', 'star'], ['brush', 'blob'], ['pencil'], ['eraser', 'scissors', 'knife'], '|',
  ['rotate', 'reflect'], ['scale', 'shear'], ['builder'], '|',
  ['gradient'], ['eyedropper'], ['blend'], '|', ['artboard'], ['hand'], ['zoom'],
];

const Tools = {
  build() {
    const box = $('tools');
    for (const g of TOOL_GROUPS) {
      if (g === '|') { box.insertAdjacentHTML('beforeend', '<div class="tool-sep"></div>'); continue; }
      const ids = g.filter(id => App.tools[id]); if (!ids.length) continue;
      const d = document.createElement('div');
      d.className = 'tool' + (ids.length > 1 ? ' has-more' : ''); d.dataset.group = ids.join(',');
      this.paint(d, ids[0]);
      let timer = null;
      d.onpointerdown = e => { if (e.button === 0 && ids.length > 1) timer = setTimeout(() => { timer = null; this.flyout(d, ids); }, 350); };
      d.onpointerup = e => {
        if (e.button !== 0 || (ids.length > 1 && !timer)) return;
        clearTimeout(timer); timer = null;
        if (e.altKey && ids.length > 1) Tools.use(ids[(ids.indexOf(d.dataset.tool) + 1) % ids.length]); /* Alt+clic: siguiente del grupo */
        else Tools.use(d.dataset.tool);
      };
      d.onpointerleave = () => { if (timer) { clearTimeout(timer); timer = null; } };
      d.oncontextmenu = e => { e.preventDefault(); if (ids.length > 1) this.flyout(d, ids); };
      box.appendChild(d);
    }
    document.addEventListener('pointerdown', e => { const f = $('toolFlyout'); if (f && !f.contains(e.target)) f.remove(); });
  },
  label(id) { const [n, k] = TOOL_INFO[id] || [id, '']; return k ? `${n} (${k})` : n; },
  paint(d, id) { d.dataset.tool = id; d.title = this.label(id); d.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[id] || ''}</svg>`; },
  /* menú lateral con las herramientas ocultas del grupo */
  flyout(btn, ids) {
    let f = $('toolFlyout'); if (f) f.remove();
    f = document.createElement('div'); f.id = 'toolFlyout'; f.className = 'tool-flyout';
    for (const id of ids) {
      const r = document.createElement('div'); r.className = 'tf-row' + (id === App.toolName ? ' on' : '');
      const [n, k] = TOOL_INFO[id];
      r.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[id] || ''}</svg><span>${n}</span><span class="kbd">${k}</span>`;
      r.onclick = () => { f.remove(); Tools.use(id); };
      f.appendChild(r);
    }
    document.body.appendChild(f);
    const b = btn.getBoundingClientRect();
    f.style.left = b.right + 4 + 'px'; f.style.top = Math.min(b.top, innerHeight - f.offsetHeight - 8) + 'px';
  },
  use(name) {
    if (!App.tools[name]) return;
    if (App.tool && App.tool.deactivate) App.tool.deactivate();
    App.toolName = name; App.tool = App.tools[name];
    document.querySelectorAll('.tool').forEach(t => {
      const inGroup = t.dataset.group.split(',').includes(name);
      if (inGroup) this.paint(t, name);
      t.classList.toggle('active', inGroup);
    });
    $('sbTool').textContent = (TOOL_INFO[name] || [name])[0];
    App.els.stage.style.cursor = App.tool.cursor || 'default';
    $('cbToolOpts').innerHTML = App.tool.options ? App.tool.options() : '';
    if (App.tool.bindOptions) App.tool.bindOptions();
    if (App.tool.activate) App.tool.activate();
    Selection.draw(); if (typeof TaskBar !== 'undefined') TaskBar.schedule();
  },
};

/* objeto seleccionable bajo el puntero */
function hitTarget(ev) { return document.elementFromPoint(ev.clientX, ev.clientY); }
function hitObject(ev) {
  const t = hitTarget(ev);
  if (!t || !App.els.content.contains(t) || t === App.els.content) return null;
  const o = Layers.topObject(t);
  if (!o || Layers.isLocked(o) || Layers.isHidden(o)) return null;
  return o;
}
/* ajuste a cuadrícula o, si no, a las guías inteligentes (preparadas al pulsar) */
function snapPt(p, ev) {
  if (App.snap) { const g = App.gridSize; return { x: Math.round(p.x / g) * g, y: Math.round(p.y / g) * g }; }
  if (ev && ev.ctrlKey) { SmartGuides.clear(); return p; }
  return SmartGuides.snapPoint(p);
}
function addObject(el) {
  const layer = Layers.ensure();
  if (Layers.isLocked(layer)) { Dialog.alert('La capa activa está bloqueada.'); return null; }
  if (!el.id) el.id = uid();
  const iso = typeof Isolation !== 'undefined' && Isolation.active();
  if (iso) { /* modo aislamiento: lo nuevo va dentro del grupo, en coordenadas del documento */
    iso.appendChild(el); const P = Geo.toDoc(iso); if (!P.isIdentity) Geo.setMatrix(el, P.inverse());
  } else layer.appendChild(el);
  App.emit('layers');
  return el;
}

/* rectángulo de selección por marco */
const Marquee = {
  start(p) { this.p0 = p; this.el = svgEl('rect', { fill: 'rgba(30,144,255,.08)', stroke: '#1e90ff', 'stroke-dasharray': '3 2' }, App.els.overlay); },
  move(p) {
    if (!this.el) return; const a = View.docToStage(this.p0.x, this.p0.y), b = View.docToStage(p.x, p.y);
    if (!this.el.isConnected) App.els.overlay.appendChild(this.el);
    Object.entries({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) })
      .forEach(([k, v]) => this.el.setAttribute(k, v));
    this.p1 = p;
  },
  end(add) {
    const p0 = this.p0, p1 = this.p1; this.el && this.el.remove(); this.el = null; this.p1 = null;
    if (!p1) return [];
    const r = { x: Math.min(p0.x, p1.x), y: Math.min(p0.y, p1.y), x2: Math.max(p0.x, p1.x), y2: Math.max(p0.y, p1.y) };
    return Layers.objects().filter(o => {
      if (Layers.isLocked(o) || Layers.isHidden(o)) return false;
      const b = Geo.bbox(o); return b && b.x < r.x2 && b.x + b.width > r.x && b.y < r.y2 && b.y + b.height > r.y;
    });
  },
};

/* ---------- Selección (V) ---------- */
App.tools.select = {
  cursor: 'default',
  down(p, ev, sp) {
    const h = Selection.handleAt(sp.x, sp.y);
    if (h) { Transformer.begin(h === 'rot' ? 'rotate' : 'scale', h, p); return; }
    const o = hitObject(ev);
    if (o) {
      if (ev.shiftKey) { Selection.toggle(o); return; }
      if (!Selection.has(o)) Selection.set([o]);
      Transformer.begin('move', null, p, { duplicate: ev.altKey });
    } else {
      const gd = Guides.hit(sp);
      if (gd) { Guides.drag(gd, false); return; }
      if (!ev.shiftKey) Selection.clear();
      Marquee.start(p);
    }
  },
  move(p, ev) {
    if (Transformer.active) Transformer.update(p, ev);
    else if (Marquee.el) Marquee.move(p);
  },
  hover(p, ev, sp) {
    const h = Selection.handleAt(sp.x, sp.y), gd = !h && !hitObject(ev) && Guides.hit(sp);
    App.els.stage.style.cursor = h === 'rot' ? 'alias' : h ? CURSORS[h] : gd ? (gd.axis === 'x' ? 'col-resize' : 'row-resize') : 'default';
  },
  up(p, ev) {
    if (Transformer.active) Transformer.end();
    else if (Marquee.el) { const f = Marquee.end(); Selection.set(ev.shiftKey ? [...App.selection, ...f] : f); }
  },
  dblclick(p, ev) {
    const o = hitObject(ev);
    if (o && o.tagName === 'text') { Tools.use('text'); TextTool.edit(o); }
    else if (o && o.tagName === 'g') Isolation.enter(o);       /* doble clic en grupo: aislarlo */
    else if (!o && Isolation.active()) Isolation.exit();       /* doble clic fuera: salir */
  },
};

/* ---------- Figuras por arrastre ---------- */
App.shapeOpts = { radius: 12, sides: 6, points: 5, inner: 0.5 };
function dragShapeTool(build, extra = {}) {
  return Object.assign({
    cursor: 'crosshair',
    down(p, ev) { SmartGuides.prepare(); this.p0 = snapPt(p, ev); this.el = null; },
    move(p, ev) {
      if (!this.p0) return;
      p = snapPt(p, ev);
      let w = p.x - this.p0.x, h = p.y - this.p0.y;
      if (ev.shiftKey && !this.noConstrain) { const s = Math.max(Math.abs(w), Math.abs(h)); w = s * Math.sign(w || 1); h = s * Math.sign(h || 1); }
      let x = this.p0.x, y = this.p0.y;
      if (ev.altKey) { x -= w; y -= h; w *= 2; h *= 2; }
      const r = { x: Math.min(x, x + w), y: Math.min(y, y + h), w: Math.abs(w), h: Math.abs(h), x0: x, y0: y, x1: x + w, y1: y + h, ev };
      if (!this.el) { this.el = build(r); if (!addObject(this.el)) { this.p0 = null; return; } }
      else this.update(this.el, r);
      App.measure = this.noConstrain ? `${Units.fmt(Math.hypot(w, h))} ${Units.u}  ${round(Math.atan2(-h, w) * 180 / Math.PI, 1)}°` : `An: ${Units.fmt(r.w)}  Al: ${Units.fmt(r.h)} ${Units.u}`;
      Selection.set([this.el]);
    },
    up(p, ev) {
      SmartGuides.clear(); App.measure = null;
      if (this.el) { History.commit(); }
      else if (this.p0 && this.dialog) this.dialog(this.p0);
      this.p0 = null; this.el = null; Selection.draw();
    },
  }, extra);
}
const setA = (el, o) => { for (const k in o) el.setAttribute(k, round(o[k], 3)); };
async function sizeDialog(title) {
  const v = await Dialog.form(title, [{ id: 'w', label: 'Anchura (px)', type: 'number', value: 100, min: 0.1 }, { id: 'h', label: 'Altura (px)', type: 'number', value: 100, min: 0.1 }]);
  return v && +v.w > 0 && +v.h > 0 ? { w: +v.w, h: +v.h } : null;
}

App.tools.rect = dragShapeTool(r => svgEl('rect', { ...newShapeAttrs(), x: r.x, y: r.y, width: r.w, height: r.h }), {
  update(el, r) { setA(el, { x: r.x, y: r.y, width: r.w, height: r.h }); },
  async dialog(p) {
    const v = await sizeDialog('Rectángulo'); if (!v) return;
    const el = addObject(svgEl('rect', { ...newShapeAttrs(), x: p.x, y: p.y, width: v.w, height: v.h }));
    if (el) { Selection.set([el]); History.commit(); }
  },
});
App.tools.rrect = dragShapeTool(r => svgEl('rect', { ...newShapeAttrs(), x: r.x, y: r.y, width: r.w, height: r.h, rx: App.shapeOpts.radius }), {
  update(el, r) { const rr = Math.min(App.shapeOpts.radius, r.w / 2, r.h / 2); setA(el, { x: r.x, y: r.y, width: r.w, height: r.h, rx: rr, ry: rr }); },
  options: () => `Radio <input type="number" id="optRadius" min="0" value="${App.shapeOpts.radius}">`,
  bindOptions() { $('optRadius').oninput = e => App.shapeOpts.radius = +e.target.value; },
});
App.tools.ellipse = dragShapeTool(r => svgEl('ellipse', { ...newShapeAttrs(), cx: r.x + r.w / 2, cy: r.y + r.h / 2, rx: r.w / 2, ry: r.h / 2 }), {
  update(el, r) { setA(el, { cx: r.x + r.w / 2, cy: r.y + r.h / 2, rx: r.w / 2, ry: r.h / 2 }); },
  async dialog(p) {
    const v = await sizeDialog('Elipse'); if (!v) return;
    const el = addObject(svgEl('ellipse', { ...newShapeAttrs(), cx: p.x + v.w / 2, cy: p.y + v.h / 2, rx: v.w / 2, ry: v.h / 2 }));
    if (el) { Selection.set([el]); History.commit(); }
  },
});
App.tools.line = dragShapeTool(r => svgEl('line', { fill: 'none', stroke: App.stroke === 'none' ? '#000000' : App.stroke, 'stroke-width': App.strokeWidth, x1: r.x0, y1: r.y0, x2: r.x1, y2: r.y1 }), {
  noConstrain: true,
  update(el, r) {
    let { x0, y0, x1, y1 } = r;
    if (r.ev.shiftKey) { const a = Math.round(Math.atan2(y1 - y0, x1 - x0) / (Math.PI / 4)) * Math.PI / 4, l = Math.hypot(x1 - x0, y1 - y0); x1 = x0 + l * Math.cos(a); y1 = y0 + l * Math.sin(a); }
    setA(el, { x1: x0, y1: y0, x2: x1, y2: y1 });
  },
});
function polyPoints(cx, cy, rx, ry, n, star, inner) {
  const pts = [], k = star ? n * 2 : n;
  for (let i = 0; i < k; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / k, f = star && i % 2 ? inner : 1;
    pts.push(round(cx + Math.cos(a) * rx * f, 2) + ',' + round(cy + Math.sin(a) * ry * f, 2));
  }
  return pts.join(' ');
}
function radialTool(star) {
  return {
    cursor: 'crosshair', noConstrain: true,
    down(p, ev) { SmartGuides.prepare(); this.p0 = snapPt(p, ev); this.el = null; SmartGuides.clear(); },
    move(p, ev) {
      if (!this.p0) return;
      const r = Math.hypot(p.x - this.p0.x, p.y - this.p0.y); if (r < 1) return;
      const o = App.shapeOpts, pts = polyPoints(this.p0.x, this.p0.y, r, r, star ? o.points : o.sides, star, o.inner);
      if (!this.el) { this.el = addObject(svgEl('polygon', { ...newShapeAttrs(), points: pts })); if (!this.el) { this.p0 = null; return; } }
      else this.el.setAttribute('points', pts);
      /* forma en vivo: los parámetros quedan guardados para poder cambiarlos después */
      setA(this.el, { 'data-cx': this.p0.x, 'data-cy': this.p0.y, 'data-r': r, 'data-n': star ? o.points : o.sides, ...(star ? { 'data-inner': o.inner } : {}) });
      this.el.setAttribute('data-shape', star ? 'star' : 'polygon');
      App.measure = `${star ? 'Puntas' : 'Lados'}: ${star ? o.points : o.sides}  Radio: ${Units.fmt(r)} ${Units.u}`;
      Selection.set([this.el]);
    },
    up() { App.measure = null; if (this.el) History.commit(); this.p0 = null; this.el = null; },
    options: () => star
      ? `Puntas <input type="number" id="optPts" min="3" max="60" value="${App.shapeOpts.points}"> Radio interior <input type="number" id="optInner" min="5" max="95" value="${App.shapeOpts.inner * 100}">%`
      : `Lados <input type="number" id="optSides" min="3" max="60" value="${App.shapeOpts.sides}">`,
    bindOptions() {
      if (star) { $('optPts').oninput = e => App.shapeOpts.points = Math.max(3, +e.target.value); $('optInner').oninput = e => App.shapeOpts.inner = clamp(+e.target.value / 100, .05, .95); }
      else $('optSides').oninput = e => App.shapeOpts.sides = Math.max(3, +e.target.value);
    },
  };
}
App.tools.polygon = radialTool(false);
App.tools.star = radialTool(true);

/* ---------- Rotar (R) y Escala (S) ---------- */
function pivotTool(kind) {
  return {
    cursor: 'crosshair',
    down(p, ev) {
      if (!App.selection.length) { const o = hitObject(ev); if (o) Selection.set([o]); return; }
      Transformer.begin(kind === 'rotate' ? 'rotate' : 'scale', 'se', p);
      if (kind === 'scale' && Transformer.active) { const b = Transformer.active.box; Transformer.active.start = p; this.c = { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
    },
    move(p, ev) {
      const a = Transformer.active; if (!a) return;
      if (kind === 'rotate') return Transformer.update(p, ev);
      Transformer.reset();
      const c = this.c, d0 = Math.hypot(a.start.x - c.x, a.start.y - c.y) || 1;
      let sx = (p.x - c.x) / ((a.start.x - c.x) || 1), sy = (p.y - c.y) / ((a.start.y - c.y) || 1);
      if (ev.shiftKey) sx = sy = Math.hypot(p.x - c.x, p.y - c.y) / d0;
      a.els.forEach(e => Geo.applyDoc(e, Geo.scaleAbout(sx, sy, c.x, c.y)));
      Selection.draw();
    },
    up() { Transformer.end(); },
  };
}
App.tools.rotate = pivotTool('rotate');
App.tools.scale = pivotTool('scale');

/* ---------- Mano (H) y Zoom (Z) ---------- */
App.tools.hand = {
  cursor: 'grab',
  down(p, ev) { this.s = { x: ev.clientX, y: ev.clientY, vx: App.view.x, vy: App.view.y }; App.els.stage.style.cursor = 'grabbing'; },
  move(p, ev) { if (!this.s) return; App.view.x = this.s.vx + ev.clientX - this.s.x; App.view.y = this.s.vy + ev.clientY - this.s.y; View.apply(); Selection.draw(); },
  up() { this.s = null; App.els.stage.style.cursor = 'grab'; },
};
App.tools.zoom = {
  cursor: 'zoom-in',
  down(p, ev, sp) { this.sp0 = sp; this.alt = ev.altKey; Marquee.start(p); },
  move(p) { if (Marquee.el) Marquee.move(p); },
  up(p, ev, sp) {
    const p0 = Marquee.p0, p1 = Marquee.p1; Marquee.el && Marquee.el.remove(); Marquee.el = null; Marquee.p1 = null;
    if (p1 && !this.alt && Math.hypot(sp.x - this.sp0.x, sp.y - this.sp0.y) > 6) {
      /* arrastrar: encuadrar el rectángulo marcado */
      const r = App.els.stage.getBoundingClientRect(), w = Math.abs(p1.x - p0.x), h = Math.abs(p1.y - p0.y);
      const z = clamp(Math.min(r.width / w, r.height / h), 0.03, 64), cx = Math.min(p0.x, p1.x) + w / 2, cy = Math.min(p0.y, p1.y) + h / 2;
      Object.assign(App.view, { zoom: z, x: r.width / 2 - cx * z, y: r.height / 2 - cy * z }); View.apply();
    } else View.zoomAt(this.alt ? 1 / 1.6 : 1.6, this.sp0.x, this.sp0.y);
    Selection.draw();
  },
};

/* ---------- Cuentagotas (I) ---------- */
App.tools.eyedropper = {
  cursor: 'copy',
  down(p, ev) {
    let t = hitTarget(ev); if (t && t.tagName === 'tspan') t = t.parentNode;
    if (!t || !App.els.content.contains(t) || !SHAPE_TAGS.has(t.tagName)) return;
    const f = t.getAttribute('fill'), s = t.getAttribute('stroke'), w = t.getAttribute('stroke-width');
    if (App.selection.length) {
      setStyle(App.selection, 'fill', f); setStyle(App.selection, 'stroke', s); setStyle(App.selection, 'stroke-width', w);
      History.commit();
    }
    App.fill = f ? normColor(f) : '#000000'; App.stroke = s ? normColor(s) : 'none'; App.strokeWidth = +w || 1;
    App.emit('colors');
  },
};
