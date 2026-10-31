/* Vectora — guías inteligentes (ajuste a objetos), reglas y guías */
'use strict';

const SmartGuides = {
  on: true, xs: [], ys: [], lines: [],
  /* recopila bordes y centros de los demás objetos, la mesa de trabajo y las guías */
  prepare(exclude = []) {
    const ex = new Set(exclude), xs = [], ys = [];
    const push = b => { xs.push(b.x, b.x + b.width / 2, b.x + b.width); ys.push(b.y, b.y + b.height / 2, b.y + b.height); };
    for (const a of Artboards.all()) push(a);
    for (const o of Layers.objects()) {
      if (ex.has(o) || Layers.isHidden(o)) continue;
      const b = Geo.bbox(o); if (b) push(b);
    }
    for (const g of App.doc.guides || []) (g.axis === 'x' ? xs : ys).push(g.v);
    this.xs = xs; this.ys = ys; this.lines = [];
  },
  near(list, vals, tol) {
    let best = null;
    for (const v of vals) for (const t of list) { const d = t - v; if (Math.abs(d) <= tol && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t }; }
    return best;
  },
  /* desplazamiento para que una caja se ajuste; registra las líneas a dibujar */
  snapBox(b) {
    this.lines = [];
    if (!this.on) return { dx: 0, dy: 0 };
    const tol = 5 / App.view.zoom;
    const sx = this.near(this.xs, [b.x, b.x + b.width / 2, b.x + b.width], tol), sy = this.near(this.ys, [b.y, b.y + b.height / 2, b.y + b.height], tol);
    if (sx) this.lines.push({ axis: 'x', v: sx.t }); if (sy) this.lines.push({ axis: 'y', v: sy.t });
    return { dx: sx ? sx.d : 0, dy: sy ? sy.d : 0 };
  },
  snapPoint(p) {
    this.lines = [];
    if (!this.on) return p;
    const tol = 5 / App.view.zoom, sx = this.near(this.xs, [p.x], tol), sy = this.near(this.ys, [p.y], tol);
    if (sx) this.lines.push({ axis: 'x', v: sx.t }); if (sy) this.lines.push({ axis: 'y', v: sy.t });
    return { x: sx ? sx.t : p.x, y: sy ? sy.t : p.y };
  },
  clear() { this.lines = []; },
  draw(g) {
    const r = App.els.stage.getBoundingClientRect();
    for (const l of this.lines) {
      const s = View.docToStage(l.v, l.v);
      if (l.axis === 'x') svgEl('line', { x1: s.x + .5, x2: s.x + .5, y1: 0, y2: r.height, stroke: '#ff3fbf', 'stroke-width': 1 }, g);
      else svgEl('line', { y1: s.y + .5, y2: s.y + .5, x1: 0, x2: r.width, stroke: '#ff3fbf', 'stroke-width': 1 }, g);
    }
  },
};

/* ---------- Guías del usuario (se guardan en el documento) ---------- */
const Guides = {
  list() { return App.doc.guides || (App.doc.guides = []); },
  draw(g) {
    const r = App.els.stage.getBoundingClientRect();
    for (const gd of this.list()) {
      const s = View.docToStage(gd.v, gd.v), sel = gd === this.dragging;
      const attrs = { stroke: sel ? '#1e90ff' : '#00c8ff', 'stroke-width': 1, 'stroke-opacity': .9 };
      if (gd.axis === 'x') svgEl('line', { x1: s.x + .5, x2: s.x + .5, y1: 0, y2: r.height, ...attrs }, g);
      else svgEl('line', { y1: s.y + .5, y2: s.y + .5, x1: 0, x2: r.width, ...attrs }, g);
    }
  },
  hit(sp) {
    for (const gd of this.list()) {
      const s = View.docToStage(gd.v, gd.v);
      if (gd.axis === 'x' ? Math.abs(s.x - sp.x) < 4 : Math.abs(s.y - sp.y) < 4) return gd;
    }
    return null;
  },
  /* arrastra una guía (nueva o existente) hasta soltar; si se suelta sobre una regla se borra */
  drag(gd, isNew) {
    if (isNew) this.list().push(gd);
    this.dragging = gd;
    const move = e => { const p = View.screenToDoc(e.clientX, e.clientY); gd.v = round(gd.axis === 'x' ? p.x : p.y, 2); Selection.draw(); };
    const up = e => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      const r = App.els.stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const off = Rulers.on ? 20 : 0;
      if (x < off || y < off || x > r.width || y > r.height) this.list().splice(this.list().indexOf(gd), 1);
      this.dragging = null; History.commit(); Selection.draw();
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  },
  clear() { if (!this.list().length) return; App.doc.guides = []; History.commit(); Selection.draw(); },
};

/* ---------- Reglas (Ctrl+R) ---------- */
const Rulers = {
  on: false,
  init() {
    const wrap = $('canvasWrap');
    this.top = document.createElement('canvas'); this.top.className = 'ruler ruler-top';
    this.left = document.createElement('canvas'); this.left.className = 'ruler ruler-left';
    this.corner = document.createElement('div'); this.corner.className = 'ruler-corner';
    wrap.append(this.top, this.left, this.corner);
    this.top.onpointerdown = e => { e.preventDefault(); Guides.drag({ axis: 'y', v: View.screenToDoc(e.clientX, e.clientY).y }, true); };
    this.left.onpointerdown = e => { e.preventDefault(); Guides.drag({ axis: 'x', v: View.screenToDoc(e.clientX, e.clientY).x }, true); };
    this.corner.ondblclick = () => View.fit();
    App.on('view', () => this.draw()); App.on('change', () => this.draw());
    window.addEventListener('resize', () => this.draw());
    this.apply();
  },
  toggle() { this.on = !this.on; this.apply(); },
  apply() { for (const el of [this.top, this.left, this.corner]) el.style.display = this.on ? '' : 'none'; this.draw(); },
  draw() {
    if (!this.on) return;
    /* z = píxeles de pantalla por unidad del documento (px, mm, in…) */
    const wrap = $('canvasWrap').getBoundingClientRect(), dpr = window.devicePixelRatio || 1, z = App.view.zoom * Units.factor();
    const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
    const step = steps.find(s => s * z >= 60) || 10000, minor = step / (String(step).replace(/[0.]/g, '')[0] === '2' ? 4 : 5);
    for (const [cv, horiz] of [[this.top, true], [this.left, false]]) {
      const W = horiz ? wrap.width : 20, H = horiz ? 20 : wrap.height;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
      const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
      ctx.fillStyle = '#2b2b2b'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#7a7a7a'; ctx.fillStyle = '#b5b5b5'; ctx.font = '9px Segoe UI, sans-serif'; ctx.lineWidth = 1;
      const len = horiz ? W : H, off = horiz ? App.view.x : App.view.y;
      const start = Math.floor((-off / z) / minor) * minor, end = (len - off) / z;
      ctx.beginPath();
      for (let v = start; v <= end; v += minor) {
        const s = Math.round(v * z + off) + .5, major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
        const t = major ? 20 : 5;
        if (horiz) { ctx.moveTo(s, 20); ctx.lineTo(s, 20 - t); } else { ctx.moveTo(20, s); ctx.lineTo(20 - t, s); }
        if (major) {
          const label = String(round(v, 2));
          if (horiz) ctx.fillText(label, s + 3, 9);
          else { ctx.save(); ctx.translate(9, s + 3); ctx.rotate(-Math.PI / 2); ctx.fillText(label, -ctx.measureText(label).width - 3, 0); ctx.restore(); }
        }
      }
      ctx.stroke();
      ctx.strokeStyle = '#111'; ctx.beginPath();
      if (horiz) { ctx.moveTo(0, 19.5); ctx.lineTo(W, 19.5); } else { ctx.moveTo(19.5, 0); ctx.lineTo(19.5, H); } ctx.stroke();
    }
  },
};
