/* Vectora — anotador de degradado: editar el degradado directamente sobre el objeto
   (herramienta Degradado): mover/girar con los extremos, mover paradas, clic en la barra
   para añadir una parada y arrastrarla lejos de la barra para quitarla */
'use strict';

const GradAnnot = {
  /* primera forma seleccionada con relleno de degradado */
  target() {
    for (const s of App.selection.flatMap(leafShapes)) {
      const m = (getStyle(s, 'fill') || '').match(/url\(\s*#([^)]+)\)/), g = m && document.getElementById(m[1]);
      if (g && /Gradient$/.test(g.tagName)) return { s, g };
    }
    return null;
  },
  num(g, k, def) { const v = g.getAttribute(k); if (v == null) return def; return v.endsWith('%') ? parseFloat(v) / 100 : +v; },
  /* extremos en coordenadas locales de la forma */
  local({ s, g }) {
    const user = g.getAttribute('gradientUnits') === 'userSpaceOnUse', b = s.getBBox();
    const P = (u, v) => (user ? { x: u, y: v } : { x: b.x + u * b.width, y: b.y + v * b.height });
    if (g.tagName === 'radialGradient') {
      const cx = this.num(g, 'cx', user ? b.x + b.width / 2 : 0.5), cy = this.num(g, 'cy', user ? b.y + b.height / 2 : 0.5), r = this.num(g, 'r', user ? b.width / 2 : 0.5);
      const c = P(cx, cy); return { a: c, b: user ? { x: c.x + r, y: c.y } : { x: c.x + r * b.width, y: c.y } };
    }
    return { a: P(this.num(g, 'x1', 0), this.num(g, 'y1', 0)), b: P(this.num(g, 'x2', user ? 1 : 1), this.num(g, 'y2', 0)) };
  },
  /* pasa el degradado a coordenadas de usuario (propio de esta forma) para poder moverlo libremente */
  ensureUser(t) {
    let { s, g } = t;
    const users = [...App.els.content.querySelectorAll('*')].filter(e => (e.getAttribute('fill') || '').includes(`#${g.id})`));
    if (users.length > 1) { const c = g.cloneNode(true); c.id = uid('grad'); g.after(c); s.setAttribute('fill', `url(#${c.id})`); g = c; }
    if (g.getAttribute('gradientUnits') !== 'userSpaceOnUse') {
      const L = this.local({ s, g }); g.setAttribute('gradientUnits', 'userSpaceOnUse');
      this.setLocal({ s, g }, L.a, L.b);
    }
    return { s, g };
  },
  setLocal({ g }, a, b) {
    if (g.tagName === 'radialGradient') setA(g, { cx: a.x, cy: a.y, r: Math.max(0.5, Geo.dist(a, b)), fx: a.x, fy: a.y });
    else setA(g, { x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  },
  stops(g) { return [...g.querySelectorAll('stop')]; },
  /* color interpolado del degradado en la posición u (0..1) */
  colorAt(g, u) {
    const S = this.stops(g).map(st => ({ o: this.offset(st), c: hexToRgb(normColor(st.getAttribute('stop-color') || '#000')) })).sort((a, b) => a.o - b.o);
    const i = S.findIndex(s => s.o >= u); if (i <= 0) { const s = S[Math.max(i, 0)] || S[0]; return rgbToHex(s.c.r, s.c.g, s.c.b); }
    const a = S[i - 1], b = S[i], t = (u - a.o) / ((b.o - a.o) || 1);
    return rgbToHex(a.c.r + (b.c.r - a.c.r) * t, a.c.g + (b.c.g - a.c.g) * t, a.c.b + (b.c.b - a.c.b) * t);
  },
  offset(st) { const o = st.getAttribute('offset') || '0'; return o.endsWith('%') ? parseFloat(o) / 100 : +o; },
  /* geometría en pantalla */
  screen(t) {
    const L = this.local(t), m = t.s.getCTM(); if (!m) return null;
    const A = Geo.pt(m, L.a.x, L.a.y), B = Geo.pt(m, L.b.x, L.b.y);
    const at = o => ({ x: A.x + (B.x - A.x) * o, y: A.y + (B.y - A.y) * o });
    /* las paradas van un poco por debajo de la barra para no tapar los tiradores de los extremos */
    const len = Math.hypot(B.x - A.x, B.y - A.y) || 1, n = { x: -(B.y - A.y) / len * 14, y: (B.x - A.x) / len * 14 };
    return { A, B, at, stops: this.stops(t.g).map(st => { const q = at(this.offset(st)); return { st, p: { x: q.x + n.x, y: q.y + n.y }, q }; }) };
  },
  hit(sp) {
    const t = this.target(); if (!t) return null; const S = this.screen(t); if (!S) return null;
    for (const k of S.stops) if (Geo.dist(k.p, sp) < 7) return { t, kind: 'stop', st: k.st, S };
    if (Geo.dist(S.A, sp) < 8) return { t, kind: 'a', S };
    if (Geo.dist(S.B, sp) < 8) return { t, kind: 'b', S };
    /* sobre la barra: añadir parada */
    const dx = S.B.x - S.A.x, dy = S.B.y - S.A.y, L2 = dx * dx + dy * dy || 1, u = ((sp.x - S.A.x) * dx + (sp.y - S.A.y) * dy) / L2;
    const q = S.at(u); if (u > 0 && u < 1 && Geo.dist(q, sp) < 5) return { t, kind: 'bar', u, S };
    return null;
  },
  draw(g) {
    const t = this.target(); if (!t || App.toolName !== 'gradient') return;
    const S = this.screen(t); if (!S) return;
    svgEl('line', { x1: S.A.x, y1: S.A.y, x2: S.B.x, y2: S.B.y, stroke: '#000', 'stroke-width': 4, 'stroke-linecap': 'round', opacity: .35 }, g);
    svgEl('line', { x1: S.A.x, y1: S.A.y, x2: S.B.x, y2: S.B.y, stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
    svgEl('circle', { cx: S.A.x, cy: S.A.y, r: 6, fill: '#fff', stroke: '#1e90ff', 'stroke-width': 1.5 }, g);
    svgEl('rect', { x: S.B.x - 5, y: S.B.y - 5, width: 10, height: 10, fill: '#fff', stroke: '#1e90ff', 'stroke-width': 1.5 }, g);
    for (const k of S.stops) {
      const c = k.st.getAttribute('stop-color') || '#000';
      svgEl('line', { x1: k.q.x, y1: k.q.y, x2: k.p.x, y2: k.p.y, stroke: '#fff', 'stroke-width': 1 }, g);
      svgEl('circle', { cx: k.p.x, cy: k.p.y, r: 5.5, fill: c, stroke: k.st === this.cur ? '#1e90ff' : '#fff', 'stroke-width': 2 }, g);
    }
  },
  drag(d, sp) {
    let t = d.t;
    if (!d.user) { t = d.t = this.ensureUser(t); d.user = true; if (d.st) d.st = this.stops(t.g)[d.idx]; }
    const inv = t.s.getCTM().inverse(), q = Geo.pt(inv, sp.x, sp.y), L = this.local(t);
    if (d.kind === 'a') this.setLocal(t, q, L.b);
    else if (d.kind === 'b') this.setLocal(t, L.a, q);
    else if (d.kind === 'stop') {
      const S = this.screen(t), dx = S.B.x - S.A.x, dy = S.B.y - S.A.y, L2 = dx * dx + dy * dy || 1;
      const u = clamp(((sp.x - S.A.x) * dx + (sp.y - S.A.y) * dy) / L2, 0, 1);
      d.off = Geo.dist(S.at(u), sp) > 45; /* lejos de la barra: se quitará al soltar */
      d.st.setAttribute('offset', round(u, 4)); d.st.setAttribute('stop-opacity', d.off ? 0.3 : (d.st.dataset.op || 1));
      /* mantener las paradas ordenadas */
      const all = this.stops(t.g).sort((x, y) => this.offset(x) - this.offset(y)); all.forEach(s => t.g.appendChild(s));
    }
    Selection.draw();
  },
};

/* integración con la herramienta Degradado */
(() => {
  const tool = App.tools.gradient, base = { down: tool.down, move: tool.move, up: tool.up };
  Object.assign(tool, {
    down(p, ev, sp) {
      const h = GradAnnot.hit(sp);
      if (!h) return base.down.call(this, p, ev, sp);
      if (h.kind === 'bar') { /* añadir parada en ese punto, con el color intermedio */
        const t = GradAnnot.ensureUser(h.t), st = svgEl('stop', { offset: round(h.u, 4), 'stop-color': GradAnnot.colorAt(t.g, h.u) });
        const after = GradAnnot.stops(t.g).find(s => GradAnnot.offset(s) > h.u); after ? after.before(st) : t.g.appendChild(st);
        GradAnnot.cur = st; History.named('Añadir parada', () => History.commit()); GradientPanel.pull(); Selection.draw(); return;
      }
      const idx = h.st ? GradAnnot.stops(h.t.g).indexOf(h.st) : -1;
      if (h.st) { GradAnnot.cur = h.st; h.st.dataset.op = h.st.getAttribute('stop-opacity') || 1; }
      this.annot = { ...h, idx };
    },
    move(p, ev, sp) { if (this.annot) return GradAnnot.drag(this.annot, sp); return base.move.call(this, p, ev, sp); },
    up(...a) {
      const d = this.annot; if (!d) return base.up.apply(this, a);
      this.annot = null;
      if (d.kind === 'stop' && d.st) {
        if (d.off && GradAnnot.stops(d.t.g).length > 2) d.st.remove(); else d.st.setAttribute('stop-opacity', d.st.dataset.op || 1);
        delete d.st.dataset.op; if (d.st.getAttribute('stop-opacity') === '1') d.st.removeAttribute('stop-opacity');
      }
      History.named('Editar degradado', () => History.commit()); GradientPanel.pull(); Selection.draw();
    },
    overlay(g) { GradAnnot.draw(g); },
    hover(p, ev, sp) { App.els.stage.style.cursor = GradAnnot.hit(sp) ? 'pointer' : 'crosshair'; },
  });
})();
