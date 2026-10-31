/* Vectora — varias mesas de trabajo.
   Invariante: la mesa 1 está siempre en el origen (0,0) y su tamaño es App.doc.width/height;
   así todo lo que usa el tamaño del documento sigue funcionando. Las demás guardan su posición. */
'use strict';

const Artboards = {
  list() {
    const d = App.doc;
    if (!Array.isArray(d.artboards) || !d.artboards.length) d.artboards = [{ name: 'Mesa de trabajo 1' }];
    const a = d.artboards; Object.assign(a[0], { x: 0, y: 0, width: d.width, height: d.height });
    return a;
  },
  count() { return this.list().length; },
  activeIndex() { return clamp(App.doc.activeArtboard || 0, 0, this.count() - 1); },
  rect(i) { const a = this.list()[i]; return a && { x: a.x, y: a.y, width: a.width, height: a.height, name: a.name }; },
  active() { return this.rect(this.activeIndex()); },
  all() { return this.list().map((a, i) => this.rect(i)); },
  indexAt(p) { const L = this.list(); for (let i = L.length - 1; i >= 0; i--) { const a = L[i]; if (p.x >= a.x && p.x <= a.x + a.width && p.y >= a.y && p.y <= a.y + a.height) return i; } return -1; },
  setActive(i) { if (i < 0 || i >= this.count()) return; App.doc.activeArtboard = i; this.render(); Selection.draw(); App.emit('artboards'); },
  /* desplaza todo el documento (arte, mesas adicionales y guías) */
  translateAll(dx, dy) {
    if (!dx && !dy) return;
    const M = new DOMMatrix().translate(dx, dy);
    for (const o of Layers.objects()) { Geo.applyDoc(o, M); normalizeTransform(o); }
    this.list().forEach((a, i) => { if (i) { a.x += dx; a.y += dy; } });
    for (const g of App.doc.guides || []) g.v += g.axis === 'x' ? dx : dy;
    App.view.x -= dx * App.view.zoom; App.view.y -= dy * App.view.zoom; View.apply();
  },
  /* cambia posición/tamaño; con moveArt, el arte que estaba dentro se mueve con la mesa */
  setRect(i, r, moveArt = false) {
    const L = this.list(), old = this.rect(i); if (!old || r.width < 1 || r.height < 1) return;
    if (moveArt && (r.x !== old.x || r.y !== old.y)) {
      const M = new DOMMatrix().translate(r.x - old.x, r.y - old.y);
      for (const o of Layers.objects()) {
        const b = Geo.bbox(o); if (!b || Layers.isLocked(o)) continue;
        if (b.x >= old.x - 0.5 && b.y >= old.y - 0.5 && b.x + b.width <= old.x + old.width + 0.5 && b.y + b.height <= old.y + old.height + 0.5) { Geo.applyDoc(o, M); normalizeTransform(o); }
      }
    }
    if (i === 0) {
      App.doc.width = round(r.width, 4); App.doc.height = round(r.height, 4);
      this.translateAll(-r.x, -r.y); /* la mesa 1 vuelve al origen */
    } else Object.assign(L[i], { x: round(r.x, 4), y: round(r.y, 4), width: round(r.width, 4), height: round(r.height, 4) });
    this.list(); View.updateArtboard();
  },
  add(r, name) {
    const L = this.list();
    if (!r) { const a = this.active(), right = Math.max(...L.map(b => b.x + b.width)); r = { x: right + 40, y: a.y, width: a.width, height: a.height }; }
    L.push({ name: name || `Mesa de trabajo ${L.length + 1}`, x: round(r.x, 4), y: round(r.y, 4), width: round(r.width, 4), height: round(r.height, 4) });
    App.doc.activeArtboard = L.length - 1; View.updateArtboard(); App.emit('artboards');
    return L.length - 1;
  },
  remove(i = this.activeIndex()) {
    const L = this.list(); if (L.length < 2) return Dialog.alert('Un documento necesita al menos una mesa de trabajo.');
    if (i === 0) {
      const { x: dx, y: dy, width, height } = L[1];
      App.doc.width = width; App.doc.height = height; L.splice(0, 1);
      this.translateAll(-dx, -dy); /* la nueva mesa 1 pasa al origen */
    }
    else L.splice(i, 1);
    App.doc.activeArtboard = Math.min(i, L.length - 1); View.updateArtboard(); App.emit('artboards');
  },
  fitActive() { const a = this.active(); View.fitRect(a); },
  fitAll() { View.fitRect(Geo.union(this.all())); },
  /* dibuja las mesas adicionales (la 1 usa #artboard) */
  render() {
    let g = $('abExtra');
    if (!g) { g = svgEl('g', { id: 'abExtra', 'pointer-events': 'none' }); $('artboard').after(g); }
    g.innerHTML = '';
    const b = App.doc.bleed || 0;
    this.list().forEach((a, i) => {
      if (!i) return;
      svgEl('rect', { x: a.x + 3 / App.view.zoom, y: a.y + 3 / App.view.zoom, width: a.width, height: a.height, fill: 'rgba(0,0,0,.35)' }, g);
      svgEl('rect', { x: a.x, y: a.y, width: a.width, height: a.height, fill: '#fff' }, g);
      if (b) svgEl('rect', { x: a.x - b, y: a.y - b, width: a.width + 2 * b, height: a.height + 2 * b, fill: 'none', stroke: '#e5332a', 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, g);
    });
  },
  /* nombres sobre cada mesa (en la capa de superposición) */
  drawLabels(g) {
    if (this.count() < 2 && App.toolName !== 'artboard') return;
    const act = this.activeIndex();
    this.list().forEach((a, i) => {
      const s = View.docToStage(a.x, a.y);
      const t = svgEl('text', { x: s.x, y: s.y - 6, fill: i === act ? '#fff' : '#bbb', 'font-size': 11, 'font-family': 'Segoe UI, sans-serif', 'font-weight': i === act ? 600 : 400 }, g);
      t.textContent = `${i + 1} - ${a.name}`;
      if (i === act) {
        const z = App.view.zoom;
        svgEl('rect', { x: s.x - .5, y: s.y - .5, width: a.width * z + 1, height: a.height * z + 1, fill: 'none', stroke: App.toolName === 'artboard' ? '#1e90ff' : '#111', 'stroke-width': 1 }, g);
      }
    });
  },
};

/* ---------- herramienta Mesa de trabajo (Mayús+O) ---------- */
App.tools.artboard = {
  cursor: 'crosshair',
  options() {
    const a = Artboards.active();
    const groups = Object.entries(DOC_PRESETS).map(([cat, list]) => `<optgroup label="${cat}">${list.map(([n, w, h, u], i) =>
      `<option value="${cat}|${i}">${n} (${w}×${h} ${u})</option>`).join('')}</optgroup>`).join('');
    return `<input type="text" id="optAbName" value="${a.name.replace(/"/g, '&quot;')}" title="Nombre" style="width:130px">
      An <input type="number" id="optAbW" step="any" value="${Units.fmt(a.width)}"> Al <input type="number" id="optAbH" step="any" value="${Units.fmt(a.height)}">
      <select id="optAbUnit" title="Unidades">${Units.options()}</select>
      <select id="optAbPreset"><option value="">Ajuste preestablecido…</option>${groups}</select>
      <button id="optAbRot" class="icon-btn" style="width:auto;padding:0 6px" title="Cambiar orientación">⟲</button>
      <button id="optAbNew" class="icon-btn" style="width:auto;padding:0 6px" title="Nueva mesa de trabajo">＋ Nueva</button>
      <button id="optAbDel" class="icon-btn" style="width:auto;padding:0 6px" title="Eliminar mesa de trabajo (Supr)">🗑</button>
      <button id="optAbFit" class="icon-btn" style="width:auto;padding:0 6px">Ajustar al arte</button>`;
  },
  bindOptions() {
    const i = () => Artboards.activeIndex(), done = (label) => { History.named(label, () => History.commit()); Tools.use('artboard'); };
    const size = (w, h) => { const a = Artboards.active(); Artboards.setRect(i(), { ...a, width: Math.max(1, w), height: Math.max(1, h) }); done('Mesa de trabajo'); };
    $('optAbName').onchange = e => { Artboards.list()[i()].name = e.target.value.trim() || Artboards.active().name; done('Nombre de mesa'); };
    $('optAbW').onchange = e => size(Units.fromU(+e.target.value), Artboards.active().height);
    $('optAbH').onchange = e => size(Artboards.active().width, Units.fromU(+e.target.value));
    $('optAbUnit').onchange = e => { App.doc.units = e.target.value; Panels.refreshControlBar(); Rulers.draw(); done('Unidades'); };
    $('optAbPreset').onchange = e => {
      const [cat, k] = e.target.value.split('|'), p = DOC_PRESETS[cat] && DOC_PRESETS[cat][+k]; if (!p) return;
      App.doc.units = p[3]; size(Units.fromU(p[1], p[3]), Units.fromU(p[2], p[3])); Rulers.draw();
    };
    $('optAbRot').onclick = () => { const a = Artboards.active(); size(a.height, a.width); };
    $('optAbNew').onclick = () => { Artboards.add(); Artboards.fitAll(); done('Nueva mesa de trabajo'); };
    $('optAbDel').onclick = () => { Artboards.remove(); done('Eliminar mesa de trabajo'); };
    $('optAbFit').onclick = () => { const b = Geo.selBox(Layers.objects()); if (b) { Artboards.setRect(i(), b); done('Ajustar al arte'); } };
  },
  activate() { Artboards.render(); },
  handleAt(sp) {
    const a = Artboards.active(), hp = Selection.handlePoints(a);
    return HANDLES.find(k => Math.abs(hp[k].x - sp.x) <= 6 && Math.abs(hp[k].y - sp.y) <= 6) || null;
  },
  down(p, ev, sp) {
    const h = this.handleAt(sp);
    if (h) return void (this.op = { kind: 'resize', h, a: Artboards.active(), p0: p });
    const k = Artboards.indexAt(p);
    if (k >= 0) { Artboards.setActive(k); this.op = { kind: 'move', a: Artboards.active(), p0: p, copy: ev.altKey }; Tools.use('artboard'); return; }
    this.op = { kind: 'new', p0: snapPt(p, ev) };
  },
  move(p, ev) {
    const o = this.op; if (!o) return;
    const dx = p.x - o.p0.x, dy = p.y - o.p0.y;
    if (o.kind === 'move') o.r = { ...o.a, x: o.a.x + dx, y: o.a.y + dy };
    else if (o.kind === 'new') { const q = snapPt(p, ev); o.r = { x: Math.min(o.p0.x, q.x), y: Math.min(o.p0.y, q.y), width: Math.abs(q.x - o.p0.x), height: Math.abs(q.y - o.p0.y) }; }
    else {
      const a = o.a, h = o.h; let x1 = a.x, y1 = a.y, x2 = a.x + a.width, y2 = a.y + a.height;
      if (h.includes('w')) x1 += dx; if (h.includes('e')) x2 += dx; if (h.includes('n')) y1 += dy; if (h.includes('s')) y2 += dy;
      o.r = { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
    }
    Selection.draw();
  },
  up() {
    const o = this.op; this.op = null; if (!o || !o.r) return Selection.draw();
    if (o.kind === 'new') { if (o.r.width * App.view.zoom > 4 && o.r.height * App.view.zoom > 4) { Artboards.add(o.r); History.named('Nueva mesa de trabajo', () => History.commit()); } }
    else if (o.kind === 'move' && o.copy) { Artboards.add(o.r, Artboards.active().name + ' copia'); History.named('Duplicar mesa de trabajo', () => History.commit()); }
    else { Artboards.setRect(Artboards.activeIndex(), o.r, o.kind === 'move'); History.named(o.kind === 'move' ? 'Mover mesa de trabajo' : 'Mesa de trabajo', () => History.commit()); }
    Tools.use('artboard');
  },
  hover(p, ev, sp) {
    const h = this.handleAt(sp);
    App.els.stage.style.cursor = h ? CURSORS[h] : Artboards.indexAt(p) >= 0 ? 'move' : 'crosshair';
  },
  onDelete() { Artboards.remove(); History.named('Eliminar mesa de trabajo', () => History.commit()); Tools.use('artboard'); return true; },
  overlay(g) {
    const r = this.op && this.op.r, a = r || Artboards.active(), z = App.view.zoom, s = View.docToStage(a.x, a.y);
    svgEl('rect', { x: s.x, y: s.y, width: a.width * z, height: a.height * z, fill: r ? 'rgba(30,144,255,.08)' : 'none', stroke: '#1e90ff', 'stroke-dasharray': r ? '4 3' : null }, g);
    if (!r) { const hp = Selection.handlePoints(a); for (const k of HANDLES) svgEl('rect', { x: hp[k].x - 3.5, y: hp[k].y - 3.5, width: 7, height: 7, fill: '#fff', stroke: '#1e90ff' }, g); }
  },
};

/* ---------- panel Mesas de trabajo ---------- */
const ArtboardsPanel = {
  init() {
    const p = $('pArtboards');
    p.querySelector('#abNew').onclick = () => { Artboards.add(); Artboards.fitAll(); History.named('Nueva mesa de trabajo', () => History.commit()); };
    p.querySelector('#abDel').onclick = () => { Artboards.remove(); History.named('Eliminar mesa de trabajo', () => History.commit()); };
    p.querySelector('#abFitAll').onclick = () => Artboards.fitAll();
    for (const ev of ['change', 'artboards']) App.on(ev, () => this.render());
    App.on('dock', t => { if (t === 'pArtboards') this.render(); });
    this.render();
  },
  render() {
    const box = $('abList'); if (!box || $('pArtboards').hidden) return;
    box.innerHTML = ''; const act = Artboards.activeIndex();
    Artboards.list().forEach((a, i) => {
      const r = document.createElement('div'); r.className = 'ab-row' + (i === act ? ' on' : '');
      r.innerHTML = `<span class="ab-i">${i + 1}</span><span class="ab-name"></span><span class="ab-size">${Units.fmt(a.width)} × ${Units.fmt(a.height)}</span>`;
      r.querySelector('.ab-name').textContent = a.name;
      r.onclick = () => { Artboards.setActive(i); Artboards.fitActive(); };
      r.ondblclick = () => {
        const n = r.querySelector('.ab-name'); n.innerHTML = '<input type="text">'; const inp = n.firstChild; inp.value = a.name; inp.focus(); inp.select();
        inp.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') inp.blur(); };
        inp.onblur = () => { a.name = inp.value.trim() || a.name; History.named('Nombre de mesa', () => History.commit()); };
      };
      box.appendChild(r);
    });
    $('abCount').textContent = `${Artboards.count()} mesa${Artboards.count() === 1 ? '' : 's'}`;
  },
};
