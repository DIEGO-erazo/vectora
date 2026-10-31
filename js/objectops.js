/* Vectora — objeto clave y alinear, transformar cada uno, menú Seleccionar ampliado y guías */
'use strict';

/* ---------- objeto clave: clic sobre un objeto ya seleccionado (con varios seleccionados) ---------- */
App.keyObject = null;
App.alignTo = 'sel'; /* 'sel' | 'key' | 'artboard' */
(() => {
  const sel = App.tools.select, base = { down: sel.down, up: sel.up, overlay: sel.overlay };
  Object.assign(sel, {
    down(p, ev, sp) {
      const o = !RectCorners.hit(sp) && !Selection.handleAt(sp.x, sp.y) ? hitObject(ev) : null;
      this.keyCand = o && App.selection.length > 1 && Selection.has(o) && !ev.shiftKey && !ev.altKey ? o : null;
      return base.down.call(this, p, ev, sp);
    },
    up(...a) {
      const cand = this.keyCand, moved = Transformer.active && Transformer.active.M; this.keyCand = null;
      base.up.apply(this, a);
      if (cand && !moved) { App.keyObject = App.keyObject === cand ? null : cand; App.alignTo = App.keyObject ? 'key' : 'sel'; Align.syncUI(); Selection.draw(); }
    },
    overlay(g) {
      base.overlay.call(this, g);
      const k = App.keyObject; if (!k || !Selection.has(k)) return;
      const b = Geo.bbox(k), a = View.docToStage(b.x, b.y), z = App.view.zoom;
      svgEl('rect', { x: a.x - 1, y: a.y - 1, width: b.width * z + 2, height: b.height * z + 2, fill: 'none', stroke: '#1e90ff', 'stroke-width': 3 }, g);
    },
  });
  App.on('selection', () => { if (App.keyObject && (!Selection.has(App.keyObject) || App.selection.length < 2)) { App.keyObject = null; if (App.alignTo === 'key') App.alignTo = 'sel'; Align.syncUI(); } });
})();

const Align = {
  /* referencia según «Alinear a» */
  reference(sel) {
    if (App.alignTo === 'artboard' || sel.length === 1) return { box: Artboards.active(), fixed: null };
    if (App.alignTo === 'key' && App.keyObject && sel.includes(App.keyObject)) return { box: Geo.bbox(App.keyObject), fixed: App.keyObject };
    return { box: Geo.selBox(sel), fixed: null };
  },
  move(e, dx, dy) { if (dx || dy) { Geo.applyDoc(e, new DOMMatrix().translate(dx, dy)); normalizeTransform(e); } },
  run(kind) {
    const sel = App.selection.filter(e => !Layers.isLocked(e)); if (!sel.length) return;
    const { box: ref, fixed } = this.reference(sel);
    for (const e of sel) {
      if (e === fixed) continue;
      const b = Geo.bbox(e); let dx = 0, dy = 0;
      if (kind === 'left') dx = ref.x - b.x;
      if (kind === 'right') dx = ref.x + ref.width - b.x - b.width;
      if (kind === 'hcenter') dx = ref.x + ref.width / 2 - b.x - b.width / 2;
      if (kind === 'top') dy = ref.y - b.y;
      if (kind === 'bottom') dy = ref.y + ref.height - b.y - b.height;
      if (kind === 'vcenter') dy = ref.y + ref.height / 2 - b.y - b.height / 2;
      this.move(e, dx, dy);
    }
    History.commit(); Selection.changed();
  },
  /* distribuir centros (disth/distv) o espacios (spaceh/spacev) con un valor opcional */
  distribute(kind, gap) {
    const sel = App.selection.filter(e => !Layers.isLocked(e)), h = kind.endsWith('h');
    if (sel.length < (gap == null || isNaN(gap) ? 3 : 2)) return;
    const items = sel.map(e => ({ e, b: Geo.bbox(e) })).sort((a, b) => (h ? a.b.x - b.b.x : a.b.y - b.b.y));
    const pos = b => (h ? b.x : b.y), size = b => (h ? b.width : b.height);
    if (kind.startsWith('dist')) {
      const c = it => pos(it.b) + size(it.b) / 2, c0 = c(items[0]), c1 = c(items[items.length - 1]);
      items.forEach((it, i) => { const t = c0 + (c1 - c0) * i / (items.length - 1), d = t - c(it); this.move(it.e, h ? d : 0, h ? 0 : d); });
    } else {
      let g = gap;
      if (g == null || isNaN(g)) { const total = pos(items[items.length - 1].b) + size(items[items.length - 1].b) - pos(items[0].b); g = (total - items.reduce((s, it) => s + size(it.b), 0)) / (items.length - 1); }
      /* con objeto clave, el reparto parte de él */
      const k = Math.max(0, items.findIndex(it => it.e === App.keyObject));
      let at = pos(items[k].b) + size(items[k].b);
      for (let i = k + 1; i < items.length; i++) { const d = at + g - pos(items[i].b); this.move(items[i].e, h ? d : 0, h ? 0 : d); at += g + size(items[i].b); }
      at = pos(items[k].b);
      for (let i = k - 1; i >= 0; i--) { const d = at - g - size(items[i].b) - pos(items[i].b); this.move(items[i].e, h ? d : 0, h ? 0 : d); at -= g + size(items[i].b); }
    }
    History.commit(); Selection.changed();
  },
  /* controles extra del panel Alinear */
  initUI() {
    const box = $('alignBtns'), I = d => `<svg viewBox="0 0 24 24">${d}</svg>`;
    box.querySelectorAll('button').forEach(b => {
      const k = { Izquierda: 'left', 'Centro horizontal': 'hcenter', Derecha: 'right', Arriba: 'top', 'Centro vertical': 'vcenter', Abajo: 'bottom' }[b.title];
      if (k) b.onclick = () => History.named('Alinear', () => this.run(k));
      if (b.title.startsWith('Distribuir')) b.onclick = () => History.named('Distribuir', () => this.distribute(b.title.includes('horiz') ? 'disth' : 'distv'));
    });
    const note = $('alignTo'); if (note) note.remove();
    box.insertAdjacentHTML('beforeend', `<div class="btn-group-label">Distribuir espaciado</div>
      <button class="icon-btn" id="alSpH" title="Espaciado horizontal">${I('<rect class="f" x="3" y="6" width="4" height="12"/><rect class="f" x="17" y="6" width="4" height="12"/><path d="M8 12h8M8 10v4M16 10v4"/>')}</button>
      <button class="icon-btn" id="alSpV" title="Espaciado vertical">${I('<rect class="f" x="6" y="3" width="12" height="4"/><rect class="f" x="6" y="17" width="12" height="4"/><path d="M12 8v8M10 8h4M10 16h4"/>')}</button>
      <input type="number" id="alGap" placeholder="auto" title="Espacio (vacío = automático)" style="width:64px">
      <div class="btn-group-label">Alinear a</div>
      <select id="alTo" style="width:100%"><option value="sel">Selección</option><option value="key">Objeto clave</option><option value="artboard">Mesa de trabajo</option></select>`);
    const gap = () => { const v = $('alGap').value.trim(); return v === '' ? null : Units.fromU(+v); };
    $('alSpH').onclick = () => History.named('Distribuir espaciado', () => this.distribute('spaceh', gap()));
    $('alSpV').onclick = () => History.named('Distribuir espaciado', () => this.distribute('spacev', gap()));
    $('alTo').onchange = e => { App.alignTo = e.target.value; if (App.alignTo !== 'key') App.keyObject = null; Selection.draw(); };
    this.syncUI();
  },
  syncUI() { const s = $('alTo'); if (s) s.value = App.alignTo; },
};
Actions.align = kind => (kind.startsWith('dist') ? Align.distribute(kind) : Align.run(kind));

/* ---------- Transformar cada uno ---------- */
const TransformEach = {
  dialog() {
    if (!App.selection.length) return;
    const snap = History.snapshot(), seeds = App.selection.map(() => [Math.random(), Math.random(), Math.random(), Math.random(), Math.random()]);
    const apply = (v, copy) => {
      let els = App.selection.filter(e => !Layers.isLocked(e));
      if (copy) { els = els.map(e => { const c = cloneWithIds(e); e.after(c); return c; }); Selection.set(els); }
      els.forEach((e, i) => {
        const r = v.rand ? seeds[i] : [1, 1, 1, 1, 1], b = Geo.bbox(e), c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        const sx = 1 + (+v.sh / 100 - 1) * r[0], sy = 1 + (+v.sv / 100 - 1) * (v.rand ? r[1] : r[0]);
        let M = new DOMMatrix().translate((+v.mh || 0) * r[2], (+v.mv || 0) * r[3])
          .multiply(Geo.rotateAbout((+v.rot || 0) * r[4], c.x, c.y)).multiply(Geo.scaleAbout(sx * (v.fx ? -1 : 1), sy * (v.fy ? -1 : 1), c.x, c.y));
        Geo.applyDoc(e, M); normalizeTransform(e);
      });
      Selection.draw();
    };
    Dialog.form('Transformar cada uno', [
      { id: 'h1', type: 'heading', label: 'Escala' },
      { id: 'sh', label: 'Horizontal (%)', type: 'number', value: 100 }, { id: 'sv', label: 'Vertical (%)', type: 'number', value: 100 },
      { id: 'h2', type: 'heading', label: 'Mover' },
      { id: 'mh', label: 'Horizontal (px)', type: 'number', value: 0 }, { id: 'mv', label: 'Vertical (px)', type: 'number', value: 0 },
      { id: 'h3', type: 'heading', label: 'Rotar y reflejar' },
      { id: 'rot', label: 'Ángulo (°)', type: 'number', value: 0 },
      { id: 'fx', label: 'Reflejar X', type: 'checkbox', value: false }, { id: 'fy', label: 'Reflejar Y', type: 'checkbox', value: false },
      { id: 'rand', label: 'Aleatorio', type: 'checkbox', value: false },
    ], { preview: v => apply(v, false), revert: () => Dialog.revertTo(snap), buttons: [['Copiar', 'copy']] }).then(v => {
      if (!v) return; apply(v, v._button === 'copy'); History.named('Transformar cada uno', () => History.commit()); Selection.changed(); App.emit('layers');
    });
  },
};

/* ---------- menú Seleccionar ampliado ---------- */
const SelectOps = {
  pool() { return Layers.objects().filter(o => !Layers.isLocked(o) && !Layers.isHidden(o)); },
  same(key) {
    const ref = App.selection[0]; if (!ref) return;
    const val = {
      fillstroke: o => `${normColor(getStyle(o, 'fill') || '#000')}|${normColor(getStyle(o, 'stroke') || 'none')}`,
      opacity: o => +(o.getAttribute('opacity') ?? 1), blend: o => o.style.mixBlendMode || 'normal', kind: o => o.tagName,
      font: o => (o.tagName === 'text' ? o.getAttribute('font-family') : null),
    }[key];
    const v = val(ref); if (v == null) return;
    Selection.set(this.pool().filter(o => val(o) === v));
  },
  object(kind) {
    const test = {
      layer: o => Layers.layerOf(o) === Layers.layerOf(App.selection[0] || App.activeLayer),
      text: o => o.tagName === 'text', image: o => o.tagName === 'image', group: o => o.tagName === 'g' && !o.hasAttribute('clip-path'),
      clip: o => o.hasAttribute('clip-path'),
      stray: o => o.tagName === 'path' && PathData.parse(o.getAttribute('d') || '').every(s => s.nodes.length < 2),
    }[kind];
    Selection.set(this.pool().filter(test));
  },
  neighbor(dir) {
    const o = App.selection[0]; if (!o) return;
    const all = this.pool(), i = all.indexOf(o), n = all[i + (dir === 'above' ? 1 : -1)];
    if (n) Selection.set([n]);
  },
  async save() {
    if (!App.selection.length) return;
    const v = await Dialog.form('Guardar selección', [{ id: 'n', label: 'Nombre', value: `Selección ${Object.keys(App.doc.savedSel || {}).length + 1}` }]);
    if (!v || !v.n.trim()) return;
    (App.doc.savedSel ||= {})[v.n.trim()] = App.selection.map(e => e.id).filter(Boolean); History.named('Guardar selección', () => History.commit());
  },
  async load() {
    const names = Object.keys(App.doc.savedSel || {}); if (!names.length) return Dialog.alert('Este documento no tiene selecciones guardadas.');
    const v = await Dialog.form('Selecciones guardadas', [{ id: 'n', label: 'Selección', type: 'select', value: names[0], options: names.map(n => [n, n]) }], { ok: 'Seleccionar', buttons: [['Eliminar', 'del']] });
    if (!v) return;
    if (v._button === 'del') { delete App.doc.savedSel[v.n]; History.commit(); return; }
    Selection.set((App.doc.savedSel[v.n] || []).map(id => document.getElementById(id)).filter(Boolean));
  },
};

/* ---------- guías: desde objetos, bloquear, ocultar, origen de reglas ---------- */
const GuideOps = {
  make() {
    const sel = App.selection.filter(e => !Layers.isLocked(e)); if (!sel.length) return;
    for (const e of sel) {
      const b = Geo.bbox(e); if (!b) continue;
      const list = Guides.list();
      if (b.width < 0.5) list.push({ axis: 'x', v: round(b.x, 2) });
      else if (b.height < 0.5) list.push({ axis: 'y', v: round(b.y, 2) });
      else list.push({ axis: 'x', v: round(b.x, 2) }, { axis: 'x', v: round(b.x + b.width, 2) }, { axis: 'y', v: round(b.y, 2) }, { axis: 'y', v: round(b.y + b.height, 2) });
      e.remove();
    }
    Selection.clear(); History.commit(); App.emit('layers');
  },
  lock() { App.doc.guidesLocked = !App.doc.guidesLocked; History.commit(); },
  hide() { Guides.hidden = !Guides.hidden; Selection.draw(); },
  resetOrigin() { delete App.doc.origin; History.commit(); Rulers.draw(); Panels.refreshControlBar(); App.emit('refpoint'); },
};
(() => {
  /* guías ocultas o bloqueadas */
  const draw = Guides.draw.bind(Guides), hit = Guides.hit.bind(Guides), prep = SmartGuides.prepare.bind(SmartGuides);
  Guides.draw = g => { if (!Guides.hidden) draw(g); };
  Guides.hit = sp => (Guides.hidden || App.doc.guidesLocked ? null : hit(sp));
  SmartGuides.prepare = ex => { const keep = App.doc.guides; if (Guides.hidden) App.doc.guides = []; prep(ex); App.doc.guides = keep; };
})();

/* origen de las reglas: arrastrar desde la esquina de las reglas; doble clic lo restablece */
Units.origin = () => App.doc.origin || { x: 0, y: 0 };
function initRulerOrigin() {
  const c = Rulers.corner; if (!c) return;
  c.title = 'Arrastra para cambiar el origen de las reglas · doble clic para restablecerlo';
  c.onpointerdown = e => {
    e.preventDefault();
    const up = ev => {
      window.removeEventListener('pointerup', up);
      const r = App.els.stage.getBoundingClientRect();
      if (ev.clientX < r.left + 20 || ev.clientY < r.top + 20) return;
      const p = View.screenToDoc(ev.clientX, ev.clientY); App.doc.origin = { x: round(p.x, 2), y: round(p.y, 2) };
      History.named('Origen de reglas', () => History.commit()); Rulers.draw(); Panels.refreshControlBar(); App.emit('refpoint');
    };
    window.addEventListener('pointerup', up);
  };
  c.ondblclick = () => GuideOps.resetOrigin();
}
