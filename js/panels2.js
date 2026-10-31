/* Vectora — paneles avanzados: muestras propias, degradado, transparencia, carácter, puntas de flecha */
'use strict';

/* ---------- Muestras propias (en el documento) y colores recientes ---------- */
const Swatches = {
  recent: (() => { try { return JSON.parse(localStorage.getItem('vectora-recent') || '[]'); } catch (e) { return []; } })(),
  init() {
    $('swAdd').onclick = () => {
      const c = App[App.activeFS]; if (!/^#[0-9a-f]{6}$/i.test(c)) return;
      const list = App.doc.swatches || (App.doc.swatches = []);
      if (!list.includes(c)) { list.push(c); History.commit(); }
      this.render();
    };
    App.on('change', () => this.render());
    this.render();
  },
  pushRecent(c) {
    c = c.toLowerCase(); this.recent = [c, ...this.recent.filter(x => x !== c)].slice(0, 12);
    try { localStorage.setItem('vectora-recent', JSON.stringify(this.recent)); } catch (e) { /* sin almacenamiento */ }
    this.renderRecent();
  },
  chip(c, custom) {
    const s = document.createElement('div'); s.className = 'sw' + (custom ? ' custom' : ''); s.title = c; paintBox(s, c);
    s.onclick = e => {
      if (custom && e.altKey) { App.doc.swatches = App.doc.swatches.filter(x => x !== c); History.commit(); this.render(); return; }
      Panels.setColor(App.activeFS, c);
    };
    return s;
  },
  render() {
    const g = $('swatchGrid'); g.querySelectorAll('.custom').forEach(e => e.remove());
    for (const c of App.doc.swatches || []) g.appendChild(this.chip(c, true));
    this.renderRecent();
  },
  renderRecent() { const r = $('recentGrid'); r.innerHTML = ''; this.recent.forEach(c => r.appendChild(this.chip(c, false))); },
};

/* ---------- Panel Degradado ---------- */
const GradientPanel = {
  stops: [{ o: 0, c: '#ffffff', a: 1 }, { o: 1, c: '#000000', a: 1 }], cur: 0,
  init() {
    $('pgBar').onclick = e => {
      const r = $('pgBar').getBoundingClientRect(), o = clamp((e.clientX - r.left) / r.width, 0, 1);
      this.stops.push({ o, c: this.colorAt(o), a: 1 }); this.sortStops(o); this.update(true);
    };
    $('pgColor').oninput = e => { this.stops[this.cur].c = e.target.value; this.update(false); };
    $('pgColor').onchange = () => this.update(true);
    $('pgPos').onchange = e => { const s = this.stops[this.cur]; s.o = clamp(+e.target.value / 100, 0, 1); this.sortStops(s.o); this.update(true); };
    $('pgOp').onchange = e => { this.stops[this.cur].a = clamp(+e.target.value / 100, 0, 1); this.update(true); };
    $('pgType').onchange = () => this.update(true);
    $('pgAngle').onchange = () => this.update(true);
    $('pgDel').onclick = () => { if (this.stops.length > 2) { this.stops.splice(this.cur, 1); this.cur = 0; this.update(true); } };
    $('pgApply').onclick = () => this.applyTo('fill');
    $('pgApplyS').onclick = () => this.applyTo('stroke');
    App.on('selection', () => this.pull());
    this.render();
  },
  sortStops(o) { this.stops.sort((a, b) => a.o - b.o); this.cur = Math.max(0, this.stops.findIndex(s => s.o === o)); },
  colorAt(o) {
    const s = this.stops; let i = s.findIndex(x => x.o >= o); if (i <= 0) return s[Math.max(i, 0)].c;
    const a = s[i - 1], b = s[i], t = (o - a.o) / ((b.o - a.o) || 1), A = hexToRgb(a.c), B = hexToRgb(b.c);
    return rgbToHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
  },
  /* degradados referenciados por la selección en la propiedad indicada */
  gradientsOf(prop) {
    const ids = new Set();
    for (const s of App.selection.flatMap(leafShapes)) { const m = (getStyle(s, prop) || '').match(/url\(\s*#([^)]+)\)/); if (m) ids.add(m[1]); }
    return [...ids].map(id => document.getElementById(id)).filter(g => g && /Gradient$/.test(g.tagName));
  },
  pull() {
    const g = this.gradientsOf(App.activeFS)[0] || this.gradientsOf('fill')[0];
    if (g) {
      const stops = [...g.querySelectorAll('stop')].map(s => ({ o: parseFloat(s.getAttribute('offset')) / (String(s.getAttribute('offset')).includes('%') ? 100 : 1) || 0,
        c: normColor(s.getAttribute('stop-color') || '#000'), a: s.getAttribute('stop-opacity') == null ? 1 : +s.getAttribute('stop-opacity') }));
      if (stops.length >= 2) this.stops = stops;
      $('pgType').value = g.tagName === 'radialGradient' ? 'radial' : 'linear';
      if (g.tagName === 'linearGradient') {
        const n = k => parseFloat(g.getAttribute(k)) || 0;
        $('pgAngle').value = round(Math.atan2(n('y2') - n('y1'), (g.hasAttribute('x2') ? n('x2') : 1) - n('x1')) * 180 / Math.PI, 1);
      }
      this.cur = Math.min(this.cur, this.stops.length - 1);
    }
    this.render();
  },
  render() {
    const css = this.stops.map(s => { const c = hexToRgb(s.c); return `rgba(${c.r},${c.g},${c.b},${s.a}) ${s.o * 100}%`; }).join(',');
    $('pgBar').innerHTML = `<div class="fill" style="background:linear-gradient(90deg,${css})"></div>`;
    const box = $('pgStops'); box.innerHTML = '';
    this.stops.forEach((s, i) => {
      const m = document.createElement('div'); m.className = 'pg-stop' + (i === this.cur ? ' on' : '');
      m.style.left = s.o * 100 + '%'; m.style.background = s.c;
      m.onpointerdown = e => {
        e.preventDefault(); this.cur = i; this.render();
        const r = box.getBoundingClientRect();
        const move = ev => { s.o = clamp((ev.clientX - r.left) / r.width, 0, 1); this.update(false); };
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); this.sortStops(s.o); this.update(true); };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
      };
      box.appendChild(m);
    });
    const s = this.stops[this.cur];
    if (document.activeElement !== $('pgColor')) $('pgColor').value = s.c;
    if (document.activeElement !== $('pgPos')) $('pgPos').value = round(s.o * 100, 1);
    if (document.activeElement !== $('pgOp')) $('pgOp').value = round(s.a * 100, 0);
  },
  /* escribe tipo, ángulo y paradas en un degradado (lo reemplaza si cambia el tipo) */
  write(g) {
    const radial = $('pgType').value === 'radial';
    if ((g.tagName === 'radialGradient') !== radial) {
      const n = svgEl(radial ? 'radialGradient' : 'linearGradient', { id: g.id }); g.replaceWith(n); g = n;
    }
    g.innerHTML = '';
    this.stops.forEach(s => svgEl('stop', { offset: round(s.o, 4), 'stop-color': s.c, 'stop-opacity': s.a === 1 ? null : s.a }, g));
    if (!radial) {
      const a = (+$('pgAngle').value || 0) * Math.PI / 180, cx = Math.cos(a) / 2, cy = Math.sin(a) / 2;
      const userSpace = g.getAttribute('gradientUnits') === 'userSpaceOnUse';
      const prevAngle = userSpace ? Math.atan2(+g.getAttribute('y2') - +g.getAttribute('y1'), +g.getAttribute('x2') - +g.getAttribute('x1')) : null;
      if (!userSpace || Math.abs(prevAngle - a) > 1e-3) {
        g.removeAttribute('gradientUnits');
        setA(g, { x1: 0.5 - cx, y1: 0.5 - cy, x2: 0.5 + cx, y2: 0.5 + cy });
      }
    }
  },
  update(commit) {
    const gs = this.gradientsOf(App.activeFS).concat(this.gradientsOf('fill'));
    [...new Set(gs)].forEach(g => this.write(g));
    this.render();
    if (commit && gs.length) History.commit();
  },
  applyTo(prop) {
    const shapes = App.selection.flatMap(leafShapes).filter(s => s.tagName !== 'image'); if (!shapes.length) return;
    const g = svgEl('linearGradient', { id: uid('grad') }, docDefs()); this.write(document.getElementById(g.id));
    setStyle(shapes, prop, `url(#${g.id})`);
    App[prop] = `url(#${g.id})`; History.commit(); Panels.refresh(); this.render();
  },
};

/* ---------- Panel Transparencia ---------- */
const TranspPanel = {
  init() {
    $('ptBlend').onchange = e => {
      App.selection.forEach(el => { el.style.mixBlendMode = e.target.value === 'normal' ? '' : e.target.value; if (!el.getAttribute('style')) el.removeAttribute('style'); });
      if (App.selection.length) History.commit();
    };
    const bind = (id, fn) => { $(id).oninput = e => fn(+e.target.value / 100); $(id).onchange = () => App.selection.length && History.commit(); };
    bind('ptOpacity', v => App.selection.forEach(el => v === 1 ? el.removeAttribute('opacity') : el.setAttribute('opacity', v)));
    bind('ptFillOp', v => setStyle(App.selection, 'fill-opacity', v === 1 ? null : v));
    bind('ptStrokeOp', v => setStyle(App.selection, 'stroke-opacity', v === 1 ? null : v));
    App.on('selection', () => this.pull()); App.on('change', () => this.pull());
    this.pull();
  },
  pull() {
    const el = App.selection[0];
    $('ptBlend').value = (el && el.style.mixBlendMode) || 'normal';
    $('ptOpacity').value = el ? +(el.getAttribute('opacity') ?? 1) * 100 : 100;
    $('ptFillOp').value = el ? +(getStyle(el, 'fill-opacity') ?? 1) * 100 : 100;
    $('ptStrokeOp').value = el ? +(getStyle(el, 'stroke-opacity') ?? 1) * 100 : 100;
  },
};

/* ---------- Panel Carácter ---------- */
const CharPanel = {
  init() {
    $('pcFont').innerHTML = FONTS.map(f => `<option>${f}</option>`).join('');
    const texts = () => App.selection.flatMap(e => e.tagName === 'text' ? [e] : [...e.querySelectorAll('text')]);
    const apply = (fn, opt) => { opt(); const ts = texts(); ts.forEach(fn); if (ts.length) { History.commit(); Selection.draw(); } };
    $('pcFont').onchange = e => apply(t => t.setAttribute('font-family', e.target.value), () => App.textOpts.family = e.target.value);
    $('pcSize').onchange = e => apply(t => t.setAttribute('font-size', +e.target.value), () => App.textOpts.size = +e.target.value);
    $('pcStyle').onchange = e => { const [w, s] = e.target.value.split('|');
      apply(t => { t.setAttribute('font-weight', w); t.setAttribute('font-style', s); }, () => Object.assign(App.textOpts, { weight: w, style: s })); };
    $('pcAlign').onchange = e => apply(t => t.setAttribute('text-anchor', e.target.value), () => App.textOpts.anchor = e.target.value);
    $('pcLead').onchange = e => apply(t => {
      t.setAttribute('data-leading', +e.target.value);
      [...t.querySelectorAll('tspan')].forEach((ts, i) => i && ts.setAttribute('dy', round(+e.target.value / 100, 3) + 'em'));
    }, () => {});
    $('pcTrack').onchange = e => apply(t => +e.target.value ? t.setAttribute('letter-spacing', round(+e.target.value / 1000, 3) + 'em') : t.removeAttribute('letter-spacing'), () => {});
    App.on('selection', () => this.pull()); App.on('change', () => this.pull());
    this.pull();
  },
  pull() {
    const t = App.selection.find(e => e.tagName === 'text'), o = App.textOpts;
    const fam = t ? t.getAttribute('font-family') || 'Arial' : o.family;
    if (![...$('pcFont').options].some(op => op.value === fam)) $('pcFont').insertAdjacentHTML('beforeend', `<option>${fam}</option>`);
    $('pcFont').value = fam;
    $('pcSize').value = t ? +t.getAttribute('font-size') || 16 : o.size;
    $('pcStyle').value = `${(t ? t.getAttribute('font-weight') : o.weight) === 'bold' ? 'bold' : 'normal'}|${(t ? t.getAttribute('font-style') : o.style) === 'italic' ? 'italic' : 'normal'}`;
    $('pcAlign').value = (t ? t.getAttribute('text-anchor') : o.anchor) || 'start';
    $('pcLead').value = t ? +(t.getAttribute('data-leading') || 120) : 120;
    const ls = t && t.getAttribute('letter-spacing');
    $('pcTrack').value = ls ? round(parseFloat(ls) * (ls.endsWith('em') ? 1000 : 1000 / (+t.getAttribute('font-size') || 16)), 0) : 0;
  },
};

/* ---------- Puntas de flecha (panel Trazo) ---------- */
const ARROWS = {
  none: ['Ninguna'], arrow: ['Flecha', 'M0 0L10 5L0 10Z', 2], open: ['Flecha abierta', 'M0 0L10 5L0 10', 8], circle: ['Círculo', 'M5 0A5 5 0 1 1 5 10A5 5 0 1 1 5 0Z', 5],
  square: ['Cuadrado', 'M0 0H10V10H0Z', 5], bar: ['Barra', 'M4 0H6V10H4Z', 5],
};
const Arrows = {
  init() {
    const opts = Object.entries(ARROWS).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('');
    $('psStart').innerHTML = opts; $('psEnd').innerHTML = opts;
    $('psStart').onchange = e => this.set('marker-start', e.target.value);
    $('psEnd').onchange = e => this.set('marker-end', e.target.value);
    App.on('selection', () => this.pull());
  },
  targets() { return App.selection.flatMap(leafShapes).filter(s => ['path', 'line', 'polyline'].includes(s.tagName)); },
  marker(type, color) {
    const id = `mk-${type}-${color.replace('#', '')}`;
    if (!document.getElementById(id)) {
      const [, d, refX] = ARROWS[type], open = type === 'open';
      const m = svgEl('marker', { id, viewBox: '-1 -1 12 12', refX, refY: 5, markerWidth: 4, markerHeight: 4, orient: 'auto-start-reverse', markerUnits: 'strokeWidth' }, docDefs());
      svgEl('path', { d, fill: open ? 'none' : color, stroke: open ? color : 'none', 'stroke-width': open ? 1.5 : 0, 'stroke-linejoin': 'round' }, m);
    }
    return `url(#${id})`;
  },
  typeOf(v) { const m = (v || '').match(/mk-([a-z]+)-/); return m ? m[1] : 'none'; },
  set(attr, type) {
    const ts = this.targets(); if (!ts.length) return;
    for (const s of ts) {
      if (type === 'none') { s.removeAttribute(attr); continue; }
      const st = normColor(getStyle(s, 'stroke') || '#000000');
      s.setAttribute(attr, this.marker(type, st.startsWith('#') ? st : '#000000'));
    }
    History.commit();
  },
  /* al cambiar el color del trazo, las puntas lo siguen */
  recolor(els) {
    for (const s of els.flatMap(leafShapes)) for (const attr of ['marker-start', 'marker-end']) {
      const t = this.typeOf(s.getAttribute(attr)); if (t === 'none') continue;
      const st = normColor(getStyle(s, 'stroke') || '#000000');
      if (st.startsWith('#')) s.setAttribute(attr, this.marker(t, st));
    }
  },
  pull() {
    const s = this.targets()[0];
    $('psStart').value = s ? this.typeOf(s.getAttribute('marker-start')) : 'none';
    $('psEnd').value = s ? this.typeOf(s.getAttribute('marker-end')) : 'none';
  },
};

Swatches.init(); GradientPanel.init(); TranspPanel.init(); CharPanel.init(); Arrows.init();
