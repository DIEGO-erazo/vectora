/* Vectora — acciones de edición y de objeto */
'use strict';

function docOrder(els) {
  const all = [...App.els.content.querySelectorAll('*')];
  return [...els].sort((a, b) => all.indexOf(a) - all.indexOf(b));
}
/* trazado con sus transformaciones aplicadas a los puntos (coordenadas del documento) */
function pathSubsDoc(el) {
  const d = PathData.fromShape(el); if (!d) return [];
  const m = Geo.toDoc(el), T = p => p && Geo.pt(m, p.x, p.y), subs = PathData.parse(d);
  subs.forEach(s => s.nodes.forEach(n => { const q = T(n); n.hin = T(n.hin); n.hout = T(n.hout); n.x = q.x; n.y = q.y; }));
  return subs;
}
function styleAttrs(el) {
  const out = {};
  for (const a of ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'opacity', 'fill-rule'])
    if (el.getAttribute(a) != null) out[a] = el.getAttribute(a);
  return out;
}

const Actions = {
  swapFS() { const f = App.fill; App.fill = App.stroke; App.stroke = f;
    if (App.selection.length) { setStyle(App.selection, 'fill', App.fill); setStyle(App.selection, 'stroke', App.stroke); History.commit(); }
    App.emit('colors'); Selection.draw(); },
  defaultFS() { App.fill = '#ffffff'; App.stroke = '#000000'; App.strokeWidth = 1;
    if (App.selection.length) { setStyle(App.selection, 'fill', '#ffffff'); setStyle(App.selection, 'stroke', '#000000'); setStyle(App.selection, 'stroke-width', 1); History.commit(); }
    App.emit('colors'); Selection.draw(); },

  /* ----- edición ----- */
  del() {
    if (App.tool && App.tool.onDelete && App.tool.onDelete()) return;
    if (!App.selection.length) return;
    App.selection.filter(e => !Layers.isLocked(e)).forEach(e => e.remove()); Selection.clear(); History.commit(); App.emit('layers');
  },
  copy() {
    if (!App.selection.length) return;
    const sel = docOrder(App.selection);
    App.clipboard = sel.map(e => e.outerHTML);
    /* copia también al portapapeles del sistema como SVG, para pegar en otras apps */
    App.clipboardText = IO.serialize(true, Geo.selBox(sel), sel);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(App.clipboardText).catch(() => {});
  },
  cut() { this.copy(); this.del(); },
  paste(mode = 'offset') {
    if (!App.clipboard) return;
    const layer = Layers.ensure(), wrap = svgEl('svg'); wrap.innerHTML = App.clipboard.join('');
    const els = [...wrap.children].map(e => { if (e.id) e.id = uid(); e.querySelectorAll('[id]').forEach(n => { if (!/^(grad|clip)/.test(n.id)) n.id = uid(); }); return e; });
    const ref = mode === 'back' && App.selection.length ? docOrder(App.selection)[0] : null;
    const front = mode === 'front' && App.selection.length ? docOrder(App.selection).pop() : null;
    let last = front;
    els.forEach(e => {
      if (ref) ref.before(e); else if (front) { last.after(e); last = e; } else layer.appendChild(e);
      if (mode === 'offset') { Geo.applyDoc(e, new DOMMatrix().translate(10, 10)); normalizeTransform(e); }
    });
    App.clipboard = els.map(e => e.outerHTML);
    Selection.set(els); History.commit(); App.emit('layers');
  },
  duplicate() { this.copy(); this.paste('offset'); },
  selectAll() { Selection.set(Layers.objects().filter(o => !Layers.isLocked(o) && !Layers.isHidden(o))); },
  invertSelection() { Selection.set(Layers.objects().filter(o => !Layers.isLocked(o) && !Layers.isHidden(o) && !App.selection.includes(o))); },
  selectSame(attr) {
    const v = App.selection[0] && getStyle(App.selection[0], attr); if (v == null) return;
    Selection.set(Layers.objects().filter(o => !Layers.isLocked(o) && !Layers.isHidden(o) && getStyle(o, attr) === v));
  },

  /* ----- organizar ----- */
  arrange(dir) {
    const sel = docOrder(App.selection); if (!sel.length) return;
    if (dir === 'front') sel.forEach(e => e.parentNode.appendChild(e));
    else if (dir === 'back') [...sel].reverse().forEach(e => e.parentNode.insertBefore(e, e.parentNode.firstElementChild));
    else if (dir === 'forward') [...sel].reverse().forEach(e => { const n = e.nextElementSibling; if (n && !sel.includes(n)) n.after(e); });
    else if (dir === 'backward') sel.forEach(e => { const p = e.previousElementSibling; if (p && !sel.includes(p) && p.tagName !== 'defs') p.before(e); });
    History.commit(); App.emit('layers');
  },

  /* ----- agrupar ----- */
  group() {
    const sel = docOrder(App.selection); if (sel.length < 2) return;
    const g = svgEl('g', { id: uid() }); sel[sel.length - 1].after(g);
    sel.forEach(e => { const m = Geo.toDoc(e); g.appendChild(e); Geo.setMatrix(e, Geo.toDoc(g).inverse().multiply(m)); normalizeTransform(e); });
    Selection.set([g]); History.commit(); App.emit('layers');
  },
  ungroup() {
    const out = [];
    for (const g of App.selection) {
      if (g.tagName !== 'g') { out.push(g); continue; }
      if (g.hasAttribute('clip-path')) { out.push(...this.releaseClip(g, false)); continue; }
      const G = Geo.local(g), op = g.getAttribute('opacity');
      for (const c of [...g.children]) {
        Geo.setMatrix(c, G.multiply(Geo.local(c))); normalizeTransform(c);
        if (op != null) c.setAttribute('opacity', (+(c.getAttribute('opacity') ?? 1)) * +op);
        g.before(c); out.push(c);
      }
      g.remove();
    }
    Selection.set(out); History.commit(); App.emit('layers');
  },

  /* ----- bloquear / ocultar ----- */
  lock() { App.selection.forEach(e => e.setAttribute('data-locked', '1')); Selection.clear(); History.commit(); App.emit('layers'); },
  unlockAll() { const els = [...App.els.content.querySelectorAll('.layer > [data-locked]')]; els.forEach(e => e.removeAttribute('data-locked')); Selection.set(els); History.commit(); },
  hide() { App.selection.forEach(e => e.setAttribute('display', 'none')); Selection.clear(); History.commit(); App.emit('layers'); },
  showAll() { const els = [...App.els.content.querySelectorAll('.layer > [display=none]')]; els.forEach(e => e.removeAttribute('display')); Selection.set(els); History.commit(); },

  /* ----- transformar ----- */
  transform(M) {
    if (!App.selection.length) return;
    App.lastTransform = { matrix: M, duplicate: false };
    App.selection.forEach(e => { Geo.applyDoc(e, M); normalizeTransform(e); }); History.commit(); Selection.changed();
  },
  center() { const b = Selection.box(); return b && { x: b.x + b.width / 2, y: b.y + b.height / 2 }; },
  reflect(axis) { const c = this.center(); if (c) this.transform(Geo.scaleAbout(axis === 'h' ? -1 : 1, axis === 'v' ? -1 : 1, c.x, c.y)); },
  rotateDialog() {
    const c = this.center(); if (!c) return;
    Dialog.transform('Rotar', [{ id: 'a', label: 'Ángulo (°)', type: 'number', value: 90, step: 1 }], v => Geo.rotateAbout(+v.a || 0, c.x, c.y));
  },
  scaleDialog() {
    const c = this.center(); if (!c) return;
    Dialog.transform('Escala', [
      { id: 'u', label: 'Uniforme', type: 'checkbox', value: true },
      { id: 'h', label: 'Horizontal (%)', type: 'number', value: 100, min: 1 }, { id: 'v', label: 'Vertical (%)', type: 'number', value: 100, min: 1 },
    ], v => { const h = +v.h / 100, w = v.u ? h : +v.v / 100; return h > 0 && w > 0 ? Geo.scaleAbout(h, w, c.x, c.y) : null; });
  },
  moveDialog() {
    if (!App.selection.length) return;
    Dialog.transform('Mover', [
      { id: 'x', label: 'Horizontal (px)', type: 'number', value: 10 }, { id: 'y', label: 'Vertical (px)', type: 'number', value: 0 },
    ], v => new DOMMatrix().translate(+v.x || 0, +v.y || 0));
  },
  nudge(dx, dy) { if (App.selection.length) this.transform(new DOMMatrix().translate(dx, dy)); },

  /* ----- alinear ----- */
  align(kind) {
    const sel = App.selection.filter(e => !Layers.isLocked(e)); if (!sel.length) return;
    const ref = sel.length === 1 ? Artboards.active() : Geo.selBox(sel);
    if (kind === 'disth' || kind === 'distv') {
      if (sel.length < 3) return;
      const h = kind === 'disth', items = sel.map(e => ({ e, b: Geo.bbox(e) })).sort((a, b) => h ? a.b.x - b.b.x : a.b.y - b.b.y);
      const first = items[0].b, last = items[items.length - 1].b;
      const c0 = h ? first.x + first.width / 2 : first.y + first.height / 2, c1 = h ? last.x + last.width / 2 : last.y + last.height / 2;
      items.forEach(({ e, b }, i) => {
        const target = c0 + (c1 - c0) * i / (items.length - 1), cur = h ? b.x + b.width / 2 : b.y + b.height / 2;
        Geo.applyDoc(e, new DOMMatrix().translate(h ? target - cur : 0, h ? 0 : target - cur)); normalizeTransform(e);
      });
    } else for (const e of sel) {
      const b = Geo.bbox(e); let dx = 0, dy = 0;
      if (kind === 'left') dx = ref.x - b.x;
      if (kind === 'right') dx = ref.x + ref.width - b.x - b.width;
      if (kind === 'hcenter') dx = ref.x + ref.width / 2 - b.x - b.width / 2;
      if (kind === 'top') dy = ref.y - b.y;
      if (kind === 'bottom') dy = ref.y + ref.height - b.y - b.height;
      if (kind === 'vcenter') dy = ref.y + ref.height / 2 - b.y - b.height / 2;
      Geo.applyDoc(e, new DOMMatrix().translate(dx, dy)); normalizeTransform(e);
    }
    History.commit(); Selection.changed();
  },

  /* ----- trazados ----- */
  toPath() {
    const out = App.selection.map(e => (e.tagName === 'g' || e.tagName === 'text' || e.tagName === 'image') ? e : PathData.convert(e));
    Selection.set(out); History.commit(); App.emit('layers');
  },
  /* ----- máscara de recorte ----- */
  makeClip() {
    const sel = docOrder(App.selection); if (sel.length < 2) return Dialog.alert('Selecciona al menos dos objetos: el superior será la máscara.');
    const mask = sel.pop(), g = svgEl('g', { id: uid(), 'data-name': '<Grupo de recorte>' }); mask.after(g);
    const cp = svgEl('clipPath', { id: uid('clip'), clipPathUnits: 'userSpaceOnUse' }, docDefs());
    const mm = Geo.toDoc(mask); cp.appendChild(mask); Geo.setMatrix(mask, mm);
    sel.forEach(e => { const m = Geo.toDoc(e); g.appendChild(e); Geo.setMatrix(e, m); normalizeTransform(e); });
    g.setAttribute('clip-path', `url(#${cp.id})`);
    Selection.set([g]); History.commit(); App.emit('layers');
  },
  releaseClip(g, commit = true) {
    g = g || App.selection.find(e => e.hasAttribute('clip-path')); if (!g) return [];
    const id = (g.getAttribute('clip-path').match(/#([^)]+)/) || [])[1], cp = id && document.getElementById(id);
    const out = [];
    const G = Geo.local(g);
    for (const c of [...g.children]) { Geo.setMatrix(c, G.multiply(Geo.local(c))); normalizeTransform(c); g.before(c); out.push(c); }
    if (cp) for (const c of [...cp.children]) { Geo.setMatrix(c, G.multiply(Geo.local(c))); normalizeTransform(c); c.setAttribute('fill', 'none'); c.setAttribute('stroke', 'none'); g.before(c); out.push(c); }
    cp && cp.remove(); g.remove();
    if (commit) { Selection.set(out); History.commit(); App.emit('layers'); }
    return out;
  },
  /* ----- imagen ----- */
  placeImage(dataUrl) {
    const img = new Image();
    img.onload = () => {
      const ab = Artboards.active();
      let w = img.width, h = img.height; const k = Math.min(1, ab.width / w, ab.height / h); w *= k; h *= k;
      const el = addObject(svgEl('image', { href: dataUrl, x: round(ab.x + (ab.width - w) / 2), y: round(ab.y + (ab.height - h) / 2), width: round(w), height: round(h), preserveAspectRatio: 'none' }));
      if (el) { Selection.set([el]); History.commit(); }
    };
    img.src = dataUrl;
  },
};

/* ---------- Trazado compuesto + entrada de Buscatrazos ---------- */
const Pathfinder = {
  run(op) {
    if (op === 'compound') return this.compound();
    if (op === 'release') return this.release();
    const sel = docOrder(App.selection).filter(e => !['text', 'image'].includes(e.tagName));
    const shapes = sel.flatMap(e => e.tagName === 'g' ? leafShapes(e) : [e]).filter(s => !['text', 'image'].includes(s.tagName));
    if (shapes.length < 2) return Dialog.alert('Selecciona al menos dos formas.');
    const polys = shapes.map(s => Boolean2D.fromSubs(pathSubsDoc(s), s.getAttribute('fill-rule') || 'nonzero'));
    let res;
    if (op === 'unite') res = polys.reduce((a, b) => Boolean2D.op(a, b, 'union'));
    else if (op === 'intersect') res = polys.reduce((a, b) => Boolean2D.op(a, b, 'intersect'));
    else if (op === 'exclude') res = polys.reduce((a, b) => Boolean2D.op(a, b, 'xor'));
    else if (op === 'minus') res = polys.slice(1).reduce((a, b) => Boolean2D.op(a, b, 'difference'), polys[0]);
    const styleFrom = op === 'minus' ? shapes[0] : shapes[shapes.length - 1];
    const attrs = styleAttrs(styleFrom);
    const d = Boolean2D.toPath(res);
    const anchor = sel[sel.length - 1];
    let el = null;
    if (d) { el = svgEl('path', { id: uid(), ...attrs, d }); anchor.after(el); placeDocPath(el); }
    sel.forEach(e => e.remove());
    Selection.set(el ? [el] : []); History.commit(); App.emit('layers');
  },
  compound() {
    const sel = docOrder(App.selection).filter(e => !['g', 'text', 'image'].includes(e.tagName)); if (sel.length < 2) return;
    const subs = sel.flatMap(pathSubsDoc);
    const el = svgEl('path', { id: uid(), ...styleAttrs(sel[0]), 'fill-rule': 'evenodd', d: PathData.serialize(subs), 'data-name': '<Trazado compuesto>' });
    sel[sel.length - 1].after(el); sel.forEach(e => e.remove()); placeDocPath(el);
    Selection.set([el]); History.commit(); App.emit('layers');
  },
  release() {
    const out = [];
    for (const e of App.selection) {
      if (e.tagName !== 'path') { out.push(e); continue; }
      const subs = pathSubsDoc(e); if (subs.length < 2) { out.push(e); continue; }
      const attrs = styleAttrs(e); delete attrs['fill-rule'];
      subs.forEach(s => { const p = svgEl('path', { id: uid(), ...attrs, d: PathData.serialize([s]) }); e.before(p); placeDocPath(p); out.push(p); });
      e.remove();
    }
    Selection.set(out); History.commit(); App.emit('layers');
  },
};
