/* Vectora — funciones rápidas: Repetir (radial, cuadrícula, espejo), añadir/quitar/promediar
   puntos de ancla, Dividir objetos debajo, Dividir en cuadrícula, Limpiar, Rasterizar,
   Recortar imagen, paneles Navegador e Información y Rotar vista */
'use strict';

/* ---------- Objeto ▸ Repetir ---------- */
/* g[data-repeat] = { type, … } con el original (g[data-rep-src]) y copias <use> que lo referencian:
   al editar el original (doble clic: modo aislamiento) las copias cambian solas */
const Repeat = {
  get(g) { try { return JSON.parse(g.getAttribute('data-repeat') || 'null'); } catch (e) { return null; } },
  src(g) { return g.querySelector(':scope > [data-rep-src]'); },
  of(el) { return el && el.closest && el.closest('g[data-repeat]'); },
  defaults(type, b) {
    if (type === 'radial') return { type, n: 8, r: Math.max(20, round(b.height * 1.2, 1)), cx: round(b.x + b.width / 2, 2), cy: round(b.y + b.height / 2 + Math.max(20, b.height * 1.2), 2) };
    if (type === 'grid') return { type, cols: 4, rows: 3, gx: 10, gy: 10, flip: 'none' };
    return { type: 'mirror', axis: round(b.x + b.width + 10, 2), dir: 'v' };
  },
  /* crea la repetición con la selección */
  make(type) {
    const sel = docOrder(App.selection.filter(e => !Layers.isLocked(e))); if (!sel.length) return Dialog.alert('Selecciona uno o más objetos para repetir.');
    const b = Geo.selBox(sel), src = svgEl('g', { id: uid('rsrc'), 'data-rep-src': '1' }), g = svgEl('g', { id: uid('rep'), 'data-name': 'Repetición' });
    sel[sel.length - 1].after(g); g.appendChild(src);
    for (const e of sel) { const m = Geo.toDoc(e); src.appendChild(e); Geo.setMatrix(e, Geo.toDoc(src).inverse().multiply(m)); normalizeTransform(e); }
    g.setAttribute('data-repeat', JSON.stringify(this.defaults(type, b)));
    this.render(g); Selection.set([g]); History.named('Repetir', () => History.commit()); App.emit('layers');
  },
  render(g) {
    const p = this.get(g), src = this.src(g); if (!p || !src) return;
    g.querySelectorAll(':scope > use[data-rep]').forEach(u => u.remove());
    const add = tf => { const u = svgEl('use', { 'data-rep': '1', transform: tf }); setHref(u, src.id); g.appendChild(u); };
    if (p.type === 'radial') {
      const n = clamp(Math.round(+p.n || 2), 2, 200), b = Geo.bbox(src); if (!b) return;
      /* el original queda arriba del círculo, a distancia r del centro */
      const sc = { x: b.x + b.width / 2, y: b.y + b.height / 2 }, cx = sc.x, cy = sc.y + (+p.r || 0); p.cx = cx; p.cy = cy;
      for (let i = 1; i < n; i++) add(`rotate(${round(360 * i / n, 4)} ${round(cx, 3)} ${round(cy, 3)})`);
    } else if (p.type === 'grid') {
      const b = Geo.bbox(src); if (!b) return;
      for (let r = 0; r < Math.max(1, +p.rows); r++) for (let c = 0; c < Math.max(1, +p.cols); c++) {
        if (!r && !c) continue;
        const dx = c * (b.width + +p.gx), dy = r * (b.height + +p.gy);
        let tf = `translate(${round(dx, 3)} ${round(dy, 3)})`;
        const fx = (p.flip === 'h' || p.flip === 'both') && c % 2, fy = (p.flip === 'v' || p.flip === 'both') && r % 2;
        if (fx || fy) { const ox = b.x + b.width / 2, oy = b.y + b.height / 2; tf += ` translate(${ox} ${oy}) scale(${fx ? -1 : 1} ${fy ? -1 : 1}) translate(${-ox} ${-oy})`; }
        add(tf);
      }
    } else {
      const a = +p.axis || 0;
      add(p.dir === 'h' ? `matrix(1 0 0 -1 0 ${2 * a})` : `matrix(-1 0 0 1 ${2 * a} 0)`);
    }
    g.setAttribute('data-repeat', JSON.stringify(p));
  },
  fields(p) {
    if (p.type === 'radial') return [{ id: 'n', label: 'Número de copias', type: 'number', value: p.n, min: 2, max: 200 }, { id: 'r', label: 'Radio (px)', type: 'number', value: p.r, min: 0 }];
    if (p.type === 'grid') return [{ id: 'cols', label: 'Columnas', type: 'number', value: p.cols, min: 1, max: 100 }, { id: 'rows', label: 'Filas', type: 'number', value: p.rows, min: 1, max: 100 },
      { id: 'gx', label: 'Espacio horizontal (px)', type: 'number', value: p.gx }, { id: 'gy', label: 'Espacio vertical (px)', type: 'number', value: p.gy },
      { id: 'flip', label: 'Reflejar filas/columnas', type: 'select', value: p.flip || 'none', options: [['none', 'No'], ['h', 'Columnas alternas'], ['v', 'Filas alternas'], ['both', 'Ambas']] }];
    return [{ id: 'axis', label: 'Posición del eje (px)', type: 'number', value: p.axis }, { id: 'dir', label: 'Eje', type: 'select', value: p.dir, options: [['v', 'Vertical'], ['h', 'Horizontal']] }];
  },
  async options(g = this.of(App.selection[0])) {
    if (!g) return Dialog.alert('Selecciona una repetición.');
    const p0 = this.get(g), id = g.id, snap = History.snapshot();
    const apply = v => { const e = document.getElementById(id); if (!e) return; const p = { ...this.get(e) }; for (const [k, x] of Object.entries(v)) p[k] = k === 'flip' || k === 'dir' ? x : +x; e.setAttribute('data-repeat', JSON.stringify(p)); this.render(e); Selection.draw(); };
    const v = await Dialog.form('Opciones de repetición', this.fields(p0), { preview: apply, revert: () => Dialog.revertTo(snap) });
    if (!v) return; delete v._button; apply(v); History.named('Opciones de repetición', () => History.commit()); Selection.changed();
  },
  /* convierte las copias en objetos normales (agrupados) */
  expand(g = this.of(App.selection[0])) {
    if (!g) return; const src = this.src(g);
    for (const u of [...g.querySelectorAll(':scope > use[data-rep]')]) {
      const c = cloneWithIds(src); c.removeAttribute('data-rep-src'); const m = Geo.local(u).multiply(Geo.local(src)); u.replaceWith(c); Geo.setMatrix(c, m);
    }
    src.removeAttribute('data-rep-src'); g.removeAttribute('data-repeat'); g.setAttribute('data-name', 'Grupo');
    Selection.set([g]); History.named('Expandir repetición', () => History.commit()); App.emit('layers');
  },
  /* liberar: solo queda el original */
  release(g = this.of(App.selection[0])) {
    if (!g) return; const src = this.src(g), kids = [...src.children], m = Geo.toDoc(src);
    for (const k of kids) { const km = m.multiply(Geo.local(k)); g.before(k); Geo.setMatrix(k, Geo.toDoc(k.parentNode).inverse().multiply(km)); normalizeTransform(k); }
    g.remove(); Selection.set(kids); History.named('Liberar repetición', () => History.commit()); App.emit('layers');
  },
  init() {
    /* las copias siguen al original: tras cada cambio se recalculan (radio y cuadrícula dependen de su caja) */
    App.on('change', () => App.els.content.querySelectorAll('g[data-repeat]').forEach(g => this.render(g)));
    /* panel Propiedades: sección Repetir */
    const base = PropsPanel.render.bind(PropsPanel);
    PropsPanel.render = function (...a) {
      base(...a);
      const g = App.selection.length === 1 && App.selection[0].hasAttribute && App.selection[0].hasAttribute('data-repeat') ? App.selection[0] : null; if (!g) return;
      const sec = document.createElement('div'); sec.className = 'pp-sec';
      sec.innerHTML = `<div class="pp-title">Repetir</div><div class="pp-row"><button class="text-btn" data-a="o">Opciones…</button><button class="text-btn" data-a="e">Expandir</button><button class="text-btn" data-a="r">Liberar</button></div>`;
      sec.querySelector('[data-a=o]').onclick = () => Repeat.options(g); sec.querySelector('[data-a=e]').onclick = () => Repeat.expand(g); sec.querySelector('[data-a=r]').onclick = () => Repeat.release(g);
      const first = this.body.querySelector('.pp-sec:nth-of-type(2)'); first ? first.after(sec) : this.body.appendChild(sec);
    };
  },
};

/* ---------- puntos de ancla ---------- */
const Anchors = {
  /* añade un punto en medio de cada segmento */
  add() {
    const shapes = App.selection.flatMap(e => (e.tagName === 'g' ? leafShapes(e) : [e])).filter(isShape); if (!shapes.length) return;
    const out = [];
    for (const s of shapes) {
      const it = pathItem(s);
      it.subs.forEach(sub => {
        const N = sub.nodes, segs = sub.closed ? N.length : N.length - 1, res = [];
        for (let i = 0; i < N.length; i++) { res.push(N[i]); if (i < segs) res.push(splitBez(N[i], N[(i + 1) % N.length], 0.5)); }
        sub.nodes = res;
      });
      renderItem(it); out.push(it.el);
    }
    LiveFX.resync(); History.named('Añadir puntos de ancla', () => History.commit()); Selection.draw();
  },
  direct() { const t = App.tools.direct; return App.toolName === 'direct' && t.sel && t.sel.size ? t : null; },
  /* quita los puntos elegidos con la Selección directa (o los intermedios de cada tramo) */
  remove() {
    const t = this.direct(); if (!t) return Dialog.alert('Elige los puntos con la herramienta Selección directa (A).');
    for (const it of t.items) {
      it.subs.forEach(s => { s.nodes = s.nodes.filter(n => !t.sel.has(n)); });
      it.subs = it.subs.filter(s => s.nodes.length > 1);
      if (!it.subs.length) it.el.remove(); else renderItem(it);
    }
    t.sel = new Set(); t.items = t.items.filter(it => it.el.isConnected);
    History.named('Quitar puntos de ancla', () => History.commit()); Selection.draw(); App.emit('layers');
  },
  /* Promediar (Ctrl+Alt+J) */
  async average() {
    const t = this.direct(); if (!t || t.sel.size < 2) return Dialog.alert('Elige dos o más puntos con la herramienta Selección directa (A).');
    const v = await Dialog.form('Promediar', [{ id: 'axis', label: 'Eje', type: 'select', value: 'both', options: [['h', 'Horizontal'], ['v', 'Vertical'], ['both', 'Ambos']] }]); if (!v) return;
    const pts = [];
    for (const it of t.items) { const m = Geo.toDoc(it.el); it.subs.forEach(s => s.nodes.forEach(n => { if (t.sel.has(n)) pts.push({ it, n, m, p: Geo.pt(m, n.x, n.y) }); })); }
    const ax = pts.reduce((a, q) => a + q.p.x, 0) / pts.length, ay = pts.reduce((a, q) => a + q.p.y, 0) / pts.length;
    for (const { it, n, m, p } of pts) {
      const target = { x: v.axis === 'v' ? p.x : ax, y: v.axis === 'h' ? p.y : ay }, q = Geo.pt(m.inverse(), target.x, target.y), dx = q.x - n.x, dy = q.y - n.y;
      n.x += dx; n.y += dy; if (n.hin) { n.hin.x += dx; n.hin.y += dy; } if (n.hout) { n.hout.x += dx; n.hout.y += dy; }
      void it;
    }
    t.items.forEach(it => renderItem(it)); History.named('Promediar', () => History.commit()); Selection.draw();
  },
};

/* ---------- Dividir objetos debajo · Dividir en cuadrícula · Limpiar ---------- */
const QuickOps = {
  divideBelow() {
    const top = App.selection.length === 1 && isShape(App.selection[0]) ? App.selection[0] : null;
    if (!top) return Dialog.alert('Selecciona un solo trazado: cortará los objetos que tenga debajo.');
    const cutter = Boolean2D.fromSubs(pathSubsDoc(top), top.getAttribute('fill-rule') || 'nonzero'), tb = Geo.bbox(top), made = [];
    const all = [...App.els.content.querySelectorAll('.layer *')].filter(e => isShape(e) && e !== top && !Layers.isLocked(e) && !Layers.isHidden(e));
    const order = [...App.els.content.querySelectorAll('*')], ti = order.indexOf(top);
    for (const s of all) {
      if (order.indexOf(s) > ti) continue; const b = Geo.bbox(s);
      if (!b || b.x > tb.x + tb.width || b.x + b.width < tb.x || b.y > tb.y + tb.height || b.y + b.height < tb.y) continue;
      const P = Boolean2D.fromSubs(pathSubsDoc(s), s.getAttribute('fill-rule') || 'nonzero'), attrs = styleAttrs(s);
      const inn = Boolean2D.op(P, cutter, 'intersect'), out = Boolean2D.op(P, cutter, 'difference');
      if (!inn.rings.length) continue;
      for (const R of [out, inn]) if (R.rings.length) { const p = svgEl('path', { id: uid(), ...attrs, d: Boolean2D.toPath(R) }); s.before(p); placeDocPath(p); made.push(p); }
      s.remove();
    }
    top.remove(); Selection.set(made); History.named('Dividir objetos debajo', () => History.commit()); App.emit('layers');
  },
  async splitGrid() {
    const sel = App.selection.filter(isShape); if (!sel.length) return Dialog.alert('Selecciona uno o más objetos.');
    const b0 = Geo.bbox(sel[0]);
    const v = await Dialog.form('Dividir en cuadrícula', [
      { id: 'rows', label: 'Filas', type: 'number', value: 2, min: 1, max: 100 }, { id: 'gy', label: 'Medianil vertical (px)', type: 'number', value: 10, min: 0 },
      { id: 'cols', label: 'Columnas', type: 'number', value: 2, min: 1, max: 100 }, { id: 'gx', label: 'Medianil horizontal (px)', type: 'number', value: 10, min: 0 },
      { id: 'guides', label: 'Añadir guías', type: 'checkbox', value: false },
    ], { note: `Tamaño de cada celda según el primer objeto (${round(b0.width)} × ${round(b0.height)} px).` });
    if (!v) return; const R = Math.max(1, +v.rows), C = Math.max(1, +v.cols), gx = +v.gx || 0, gy = +v.gy || 0, made = [];
    for (const s of sel) {
      const b = Geo.bbox(s), w = (b.width - gx * (C - 1)) / C, h = (b.height - gy * (R - 1)) / R, attrs = styleAttrs(s);
      if (w <= 0 || h <= 0) continue;
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const e = svgEl('rect', { id: uid(), ...attrs, x: round(b.x + c * (w + gx), 3), y: round(b.y + r * (h + gy), 3), width: round(w, 3), height: round(h, 3) }); s.before(e); placeDocPath(e); made.push(e); }
      if (v.guides) { for (let c = 0; c <= C; c++) Guides.list().push({ axis: 'x', v: round(b.x + c * (w + gx) - (c === C ? gx : 0), 3) }); for (let r = 0; r <= R; r++) Guides.list().push({ axis: 'y', v: round(b.y + r * (h + gy) - (r === R ? gy : 0), 3) }); }
      s.remove();
    }
    Selection.set(made); History.named('Dividir en cuadrícula', () => History.commit()); App.emit('layers');
  },
  async cleanup() {
    const v = await Dialog.form('Limpiar', [{ id: 'stray', label: 'Puntos sueltos', type: 'checkbox', value: true }, { id: 'unpainted', label: 'Objetos sin pintura', type: 'checkbox', value: true },
      { id: 'text', label: 'Trazados de texto vacíos', type: 'checkbox', value: true }, { id: 'groups', label: 'Grupos vacíos', type: 'checkbox', value: true }]);
    if (!v) return; let n = 0;
    for (const e of [...App.els.content.querySelectorAll('.layer *')]) {
      if (!e.isConnected || Layers.isLocked(e)) continue;
      const kill = (v.stray && e.tagName === 'path' && PathData.parse(e.getAttribute('d') || '').every(s => s.nodes.length < 2))
        || (v.unpainted && isShape(e) && !e.closest('clipPath,mask,[data-rep-src]') && (getStyle(e, 'fill') || '#000') === 'none' && (getStyle(e, 'stroke') || 'none') === 'none')
        || (v.text && e.tagName === 'text' && !e.textContent.trim() && !e.hasAttribute('data-area'))
        || (v.groups && e.tagName === 'g' && !e.children.length && !e.classList.contains('layer'));
      if (kill) { e.remove(); n++; }
    }
    if (n) { Selection.clear(); History.named('Limpiar', () => History.commit()); App.emit('layers'); }
    Dialog.alert(n ? `Se eliminaron ${n} objeto(s).` : 'No había nada que limpiar.');
  },
};

/* ---------- Rasterizar · Recortar imagen ---------- */
const Raster = {
  async rasterize() {
    const sel = App.selection.filter(e => !Layers.isLocked(e)); if (!sel.length) return Dialog.alert('Selecciona lo que quieres rasterizar.');
    const v = await Dialog.form('Rasterizar', [
      { id: 'ppi', label: 'Resolución', type: 'select', value: '150', options: [['72', 'Pantalla (72 ppp)'], ['150', 'Media (150 ppp)'], ['300', 'Alta (300 ppp)']] },
      { id: 'bg', label: 'Fondo', type: 'select', value: 'none', options: [['none', 'Transparente'], ['#ffffff', 'Blanco']] },
      { id: 'pad', label: 'Añadir alrededor (px)', type: 'number', value: 0, min: 0 },
    ]);
    if (!v) return;
    const b0 = Geo.selBox(sel), pad = +v.pad || 0, box = { x: b0.x - pad, y: b0.y - pad, width: b0.width + 2 * pad, height: b0.height + 2 * pad };
    const blob = await IO.rasterize(IO.serialize(true, box, sel), box.width, box.height, +v.ppi / 72, v.bg === 'none' ? null : v.bg, 'image/png');
    const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    const img = svgEl('image', { id: uid(), href: url, x: round(box.x, 3), y: round(box.y, 3), width: round(box.width, 3), height: round(box.height, 3), preserveAspectRatio: 'none', 'data-name': 'Imagen rasterizada' });
    const last = docOrder(sel).pop(); last.after(img); placeDocPath(img); sel.forEach(e => e.remove());
    Selection.set([img]); History.named('Rasterizar', () => History.commit()); App.emit('layers');
  },
  /* recorte: marco ajustable sobre la imagen (herramienta temporal) */
  crop() {
    const img = App.selection.length === 1 && App.selection[0].tagName === 'image' ? App.selection[0] : null;
    if (!img) return Dialog.alert('Selecciona una imagen.');
    const b = Geo.bbox(img); this.cropping = { img, r: { ...b }, prev: App.toolName };
    Tools.use('cropimage');
  },
  async applyCrop() {
    const c = this.cropping; if (!c) return; this.cropping = null;
    const { img, r } = c, b = Geo.bbox(img), src = img.getAttribute('href') || img.getAttributeNS(XLINK, 'href');
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const kx = im.naturalWidth / b.width, ky = im.naturalHeight / b.height;
    const sx = Math.max(0, (r.x - b.x) * kx), sy = Math.max(0, (r.y - b.y) * ky), sw = Math.min(im.naturalWidth - sx, r.width * kx), sh = Math.min(im.naturalHeight - sy, r.height * ky);
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(sw)); cv.height = Math.max(1, Math.round(sh));
    cv.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
    const inv = Geo.toDoc(img).inverse(), p0 = Geo.pt(inv, r.x, r.y), p1 = Geo.pt(inv, r.x + r.width, r.y + r.height);
    img.setAttribute('href', cv.toDataURL('image/png')); img.removeAttributeNS(XLINK, 'href');
    setA(img, { x: round(Math.min(p0.x, p1.x), 3), y: round(Math.min(p0.y, p1.y), 3), width: round(Math.abs(p1.x - p0.x), 3), height: round(Math.abs(p1.y - p0.y), 3) });
    Tools.use(c.prev === 'cropimage' ? 'select' : c.prev); Selection.set([img]); History.named('Recortar imagen', () => History.commit());
  },
};
App.tools.cropimage = {
  cursor: 'default',
  options() { return `<span style="color:#888">Arrastra los tiradores · Intro aplica · Esc cancela</span> <button class="text-btn" id="optCropOk">Aplicar</button>`; },
  bindOptions() { $('optCropOk').onclick = () => Raster.applyCrop(); },
  handles() { const c = Raster.cropping; if (!c) return []; const r = c.r; return [[r.x, r.y], [r.x + r.width / 2, r.y], [r.x + r.width, r.y], [r.x + r.width, r.y + r.height / 2], [r.x + r.width, r.y + r.height], [r.x + r.width / 2, r.y + r.height], [r.x, r.y + r.height], [r.x, r.y + r.height / 2]]; },
  down(p, ev, sp) {
    const c = Raster.cropping; if (!c) return;
    const i = this.handles().findIndex(([x, y]) => Geo.dist(View.docToStage(x, y), sp) < 8);
    const r = c.r; this.drag = { i, p0: p, r0: { ...r } };
    if (i < 0 && !(p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height)) this.drag = null;
  },
  move(p) {
    const d = this.drag, c = Raster.cropping; if (!d || !c) return;
    const b = Geo.bbox(c.img), dx = p.x - d.p0.x, dy = p.y - d.p0.y, r0 = d.r0; let { x, y, width: w, height: h } = r0;
    if (d.i < 0) { x = clamp(x + dx, b.x, b.x + b.width - w); y = clamp(y + dy, b.y, b.y + b.height - h); }
    else {
      const L = [0, 6, 7].includes(d.i), R = [2, 3, 4].includes(d.i), T = [0, 1, 2].includes(d.i), B = [4, 5, 6].includes(d.i);
      if (L) { const nx = clamp(x + dx, b.x, x + w - 2); w += x - nx; x = nx; } if (R) w = clamp(w + dx, 2, b.x + b.width - x);
      if (T) { const ny = clamp(y + dy, b.y, y + h - 2); h += y - ny; y = ny; } if (B) h = clamp(h + dy, 2, b.y + b.height - y);
    }
    c.r = { x, y, width: w, height: h }; Selection.draw();
  },
  up() { this.drag = null; },
  key(ev) { if (ev.key === 'Enter') { Raster.applyCrop(); return true; } if (ev.key === 'Escape') { const c = Raster.cropping; Raster.cropping = null; Tools.use(c && c.prev !== 'cropimage' ? c.prev : 'select'); return true; } return false; },
  overlay(g) {
    const c = Raster.cropping; if (!c) return; const b = Geo.bbox(c.img), r = c.r, z = App.view.zoom, A = View.docToStage(b.x, b.y), S = View.docToStage(r.x, r.y);
    svgEl('path', { d: `M${A.x} ${A.y}h${b.width * z}v${b.height * z}h${-b.width * z}Z M${S.x} ${S.y}v${r.height * z}h${r.width * z}v${-r.height * z}Z`, fill: 'rgba(0,0,0,.5)', 'fill-rule': 'evenodd' }, g);
    svgEl('rect', { x: S.x, y: S.y, width: r.width * z, height: r.height * z, fill: 'none', stroke: '#fff', 'stroke-width': 1.5 }, g);
    for (const [x, y] of this.handles()) { const s = View.docToStage(x, y); svgEl('rect', { x: s.x - 4, y: s.y - 4, width: 8, height: 8, fill: '#fff', stroke: '#1e90ff' }, g); }
  },
  deactivate() { if (Raster.cropping) { Raster.cropping = null; } },
};
TOOL_INFO.cropimage = ['Recortar imagen', ''];

/* ---------- paneles Navegador e Información ---------- */
const Navigator = {
  init() {
    const body = $('pNavigator').querySelector('.panel-body');
    body.innerHTML = `<div id="navBox"><svg id="navSvg"></svg><div id="navView"></div></div>
      <div class="pp-row nav-zoom"><button class="text-btn" id="navOut">−</button><input type="range" id="navZoom" min="-5" max="6" step="0.05"><button class="text-btn" id="navIn">＋</button><span id="navPct"></span></div>`;
    $('navOut').onclick = () => { View.zoomAt(0.8); Selection.draw(); }; $('navIn').onclick = () => { View.zoomAt(1.25); Selection.draw(); };
    $('navZoom').oninput = e => { View.setZoom(Math.pow(2, +e.target.value)); Selection.draw(); };
    const box = $('navBox');
    const go = e => { const m = this.map; if (!m) return; const r = box.getBoundingClientRect(), dx = (e.clientX - r.left - m.ox) / m.k + m.b.x, dy = (e.clientY - r.top - m.oy) / m.k + m.b.y, s = View.stageRect(), v = App.view;
      v.x = s.width / 2 - dx * v.zoom; v.y = s.height / 2 - dy * v.zoom; View.apply(); Selection.draw(); };
    box.onpointerdown = e => { box.setPointerCapture(e.pointerId); go(e); box.onpointermove = go; };
    box.onpointerup = () => { box.onpointermove = null; };
    let t; const later = () => { clearTimeout(t); t = setTimeout(() => this.render(), 120); };
    for (const ev of ['change', 'view', 'layers']) App.on(ev, later);
    App.on('dock', id => { if (id === 'pNavigator') this.render(); });
  },
  render() {
    if ($('pNavigator').hidden) return;
    const box = $('navBox'), W = box.clientWidth || 220, H = 150, ab = Artboards.list(), b = Geo.union(ab.map(a => ({ ...a }))) || { x: 0, y: 0, width: App.doc.width, height: App.doc.height };
    const k = Math.min((W - 10) / b.width, (H - 10) / b.height), ox = (W - b.width * k) / 2, oy = (H - b.height * k) / 2; this.map = { k, ox, oy, b };
    const svg = $('navSvg'); svg.setAttribute('viewBox', `${b.x - ox / k} ${b.y - oy / k} ${W / k} ${H / k}`); svg.style.height = H + 'px';
    svg.innerHTML = ab.map(a => `<rect x="${a.x}" y="${a.y}" width="${a.width}" height="${a.height}" fill="#fff"/>`).join('') + `<use href="#content"/>`;
    const s = View.stageRect(), v = App.view, p0 = { x: -v.x / v.zoom, y: -v.y / v.zoom }, vw = s.width / v.zoom, vh = s.height / v.zoom;
    Object.assign($('navView').style, { left: ox + (p0.x - b.x) * k + 'px', top: oy + (p0.y - b.y) * k + 'px', width: vw * k + 'px', height: vh * k + 'px' });
    $('navZoom').value = Math.log2(v.zoom); $('navPct').textContent = Math.round(v.zoom * 100) + '%';
  },
};
const InfoPanel = {
  init() {
    $('pInfo').querySelector('.panel-body').innerHTML = `<div class="info-grid"><span>X</span><b id="inX">–</b><span>An</span><b id="inW">–</b><span>Y</span><b id="inY">–</b><span>Al</span><b id="inH">–</b></div>
      <div class="info-grid info-col"><span>Relleno</span><b id="inFill">–</b><span>Trazo</span><b id="inStroke">–</b></div><div class="info-note" id="inNote"></div>`;
    App.els.stage.addEventListener('pointermove', ev => { if ($('pInfo').hidden) return; const p = View.screenToDoc(ev.clientX, ev.clientY), o = Units.origin ? Units.origin() : { x: 0, y: 0 };
      $('inX').textContent = Units.fmt(p.x - o.x) + ' ' + Units.u; $('inY').textContent = Units.fmt(p.y - o.y) + ' ' + Units.u; });
    for (const ev of ['selection', 'change', 'transform']) App.on(ev, () => this.render());
    App.on('dock', id => { if (id === 'pInfo') this.render(); });
  },
  render() {
    if ($('pInfo').hidden) return;
    const s = App.selection, b = s.length ? Geo.selBox(s) : null, el = s[0];
    $('inW').textContent = b ? Units.fmt(b.width) + ' ' + Units.u : '–'; $('inH').textContent = b ? Units.fmt(b.height) + ' ' + Units.u : '–';
    const col = c => { if (!c || c === 'none') return 'ninguno'; if (c.startsWith('url(')) return 'degradado/motivo'; const o = hexToRgb(normColor(c)); return `${normColor(c)} · R${o.r} G${o.g} B${o.b}`; };
    $('inFill').textContent = el ? col(getStyle(el, 'fill')) : '–'; $('inStroke').textContent = el ? col(getStyle(el, 'stroke')) : '–';
    $('inNote').textContent = s.length > 1 ? `${s.length} objetos` : el ? objName(el) : '';
  },
};

/* ---------- Rotar vista (Mayús+H) ---------- */
/* el lienzo completo se gira con CSS alrededor de su centro; las coordenadas del ratón se desgiran */
Object.assign(View, {
  stageRect() {
    const st = App.els.stage, par = st.parentElement.getBoundingClientRect();
    return { left: par.left + st.parentElement.clientLeft, top: par.top + st.parentElement.clientTop, width: st.clientWidth || par.width, height: st.clientHeight || par.height };
  },
  clientToStage(cx, cy) {
    const r = this.stageRect(), a = -(App.view.rot || 0) * Math.PI / 180;
    let x = cx - r.left, y = cy - r.top;
    if (a) { const ox = r.width / 2, oy = r.height / 2, dx = x - ox, dy = y - oy; x = ox + dx * Math.cos(a) - dy * Math.sin(a); y = oy + dx * Math.sin(a) + dy * Math.cos(a); }
    return { x, y };
  },
  screenToDoc(cx, cy) { const s = this.clientToStage(cx, cy), v = App.view; return { x: (s.x - v.x) / v.zoom, y: (s.y - v.y) / v.zoom }; },
  setRotation(deg) {
    deg = ((deg % 360) + 540) % 360 - 180; App.view.rot = Math.abs(deg) < 0.01 ? 0 : deg;
    App.els.stage.style.transformOrigin = '50% 50%'; App.els.stage.style.transform = App.view.rot ? `rotate(${App.view.rot}deg)` : '';
    document.documentElement.classList.toggle('view-rotated', !!App.view.rot);
    $('sbHint').textContent = App.view.rot ? `Vista girada ${round(App.view.rot, 1)}° · Mayús+Esc la restablece` : '';
    Selection.draw(); App.emit('view');
  },
});
App.tools.rotateview = {
  cursor: 'grab',
  down(p, ev, sp) { const r = View.stageRect(); this.c = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; this.a0 = Math.atan2(ev.clientY - this.c.y, ev.clientX - this.c.x); this.r0 = App.view.rot || 0; },
  move(p, ev) { if (!this.c) return; let d = this.r0 + (Math.atan2(ev.clientY - this.c.y, ev.clientX - this.c.x) - this.a0) * 180 / Math.PI; if (ev.shiftKey) d = Math.round(d / 15) * 15; View.setRotation(d); },
  up() { this.c = null; },
  dblclick() { View.setRotation(0); },
};
ICONS.rotateview = '<path d="M5 12a7 7 0 1 0 2-5"/><path d="M4 4v4h4"/><rect x="9" y="9" width="6" height="6" transform="rotate(20 12 12)"/>';
TOOL_INFO.rotateview = ['Rotar vista', 'Mayús+H'];
TOOL_GROUPS.find(g => Array.isArray(g) && g.includes('hand')).push('rotateview');
