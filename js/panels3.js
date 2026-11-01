/* Vectora — dock con grupos de pestañas, panel Propiedades (contextual),
   panel Transformar (punto de referencia) y panel Historial */
'use strict';

/* ---------- transformación numérica con punto de referencia (9 posiciones) ---------- */
const Xf = {
  ref: [0, 0], lock: false,
  point(b) { return { x: b.x + this.ref[0] * b.width, y: b.y + this.ref[1] * b.height }; },
  /* aplica un valor (en px o grados) de un campo: x, y, w, h, rot, shear */
  set(field, v) {
    const sel = App.selection.filter(e => !Layers.isLocked(e)); if (!sel.length || !isFinite(v)) return;
    const b = Geo.selBox(sel), a = this.point(b); let M = null;
    const o = Units.origin(); /* X e Y se muestran respecto al origen de las reglas */
    if (field === 'x') M = new DOMMatrix().translate(v + o.x - a.x, 0);
    if (field === 'y') M = new DOMMatrix().translate(0, v + o.y - a.y);
    if (field === 'w' && v > 0 && b.width) { const s = v / b.width; M = Geo.scaleAbout(s, this.lock ? s : 1, a.x, a.y); }
    if (field === 'h' && v > 0 && b.height) { const s = v / b.height; M = Geo.scaleAbout(this.lock ? s : 1, s, a.x, a.y); }
    if (field === 'rot') M = Geo.rotateAbout(v - (sel.length === 1 ? Geo.angle(sel[0]) : 0), a.x, a.y);
    if (field === 'shear') { const k = Math.tan(clamp(v, -85, 85) * Math.PI / 180); M = new DOMMatrix().translate(a.x, a.y).multiply(new DOMMatrix([1, 0, k, 1, 0, 0])).translate(-a.x, -a.y); }
    if (!M) return;
    History.named('Transformar', () => { sel.forEach(e => { Geo.applyDoc(e, M); normalizeTransform(e); }); History.commit(); });
    App.lastTransform = { matrix: M, duplicate: false }; Selection.changed();
  },
  /* cuadrícula de 9 puntos de referencia */
  gridHTML(id) {
    return `<div class="refgrid" id="${id}">${[0, .5, 1].flatMap(y => [0, .5, 1].map(x => `<i data-r="${x},${y}"></i>`)).join('')}</div>`;
  },
  bindGrid(el) {
    const paint = () => el.querySelectorAll('i').forEach(i => i.classList.toggle('on', i.dataset.r === this.ref.join(',')));
    el.querySelectorAll('i').forEach(i => i.onclick = () => { this.ref = i.dataset.r.split(',').map(Number); App.emit('refpoint'); });
    paint(); App.on('refpoint', paint);
  },
};

/* campos X/Y/An/Al/ángulo/inclinación reutilizables (panel Transformar y Propiedades) */
function transformFieldsHTML(p) {
  return `<div class="tf-grid">
    ${Xf.gridHTML(p + 'Ref')}
    <div class="tf-fields">
      <label>X <input type="number" step="any" data-f="x"></label><label>An <input type="number" step="any" min="0" data-f="w"></label>
      <label>Y <input type="number" step="any" data-f="y"></label><label>Al <input type="number" step="any" min="0" data-f="h"></label>
      <label title="Ángulo de rotación">∠ <input type="number" step="any" data-f="rot"></label>
      <label title="Ángulo de inclinación">⫽ <input type="number" step="any" data-f="shear" value="0"></label>
    </div>
    <button class="lock-btn" title="Mantener proporciones de anchura y altura">🔗</button>
  </div>`;
}
function bindTransformFields(root) {
  Xf.bindGrid(root.querySelector('.refgrid'));
  root.querySelectorAll('[data-f]').forEach(inp => inp.onchange = () => {
    const f = inp.dataset.f, v = +inp.value; Xf.set(f, f === 'rot' || f === 'shear' ? v : Units.fromU(v));
    if (f === 'shear') inp.value = 0;
  });
  const lock = root.querySelector('.lock-btn');
  const paintLock = () => lock.classList.toggle('on', Xf.lock);
  lock.onclick = () => { Xf.lock = !Xf.lock; App.emit('lockratio'); }; App.on('lockratio', paintLock); paintLock();
}
function refreshTransformFields(root) {
  if (!root) return;
  const s = App.selection, b = s.length ? Geo.selBox(s) : null, a = b && Xf.point(b);
  const o = Units.origin(), vals = { x: a && Units.fmt(a.x - o.x), y: a && Units.fmt(a.y - o.y), w: b && Units.fmt(b.width), h: b && Units.fmt(b.height), rot: s.length === 1 ? round(Geo.angle(s[0]), 2) : (s.length ? 0 : '') };
  root.querySelectorAll('[data-f]').forEach(inp => {
    if (inp.dataset.f === 'shear') { inp.disabled = !s.length; return; }
    if (document.activeElement !== inp) inp.value = vals[inp.dataset.f] ?? '';
    inp.disabled = !s.length;
  });
}

/* ---------- dock: grupos de paneles con pestañas ---------- */
const DOCK_GROUPS = [
  { id: 'gColor', panels: ['pColor', 'pSwatches', 'pSymbols', 'pGradient'] },
  { id: 'gMain', panels: ['pProps', 'pLayers', 'pArtboards', 'pHistory'], grow: true },
  { id: 'gStroke', panels: ['pStroke', 'pBrushes', 'pTransp', 'pAppearance', 'pGStyles'], collapsed: true },
  { id: 'gText', panels: ['pChar', 'pPara', 'pTextStyles', 'pGlyphs'], collapsed: true },
  { id: 'gXf', panels: ['pTransform', 'pAlign', 'pPathfinder'], collapsed: true },
  { id: 'gNav', panels: ['pNavigator', 'pInfo', 'pActions'], collapsed: true },
];
const Dock = {
  state: (() => { try { return JSON.parse(localStorage.getItem('vectora-dock') || '{}'); } catch (e) { return {}; } })(),
  save() { try { localStorage.setItem('vectora-dock', JSON.stringify(this.state)); } catch (e) { /* sin almacenamiento */ } },
  init() {
    const dock = $('dock');
    for (const g of DOCK_GROUPS) {
      const st = this.state[g.id] || (this.state[g.id] = { tab: g.panels[0], collapsed: !!g.collapsed });
      if (!g.panels.includes(st.tab)) st.tab = g.panels[0];
      const box = document.createElement('div'); box.className = 'pgroup' + (g.grow ? ' grow' : ''); box.id = g.id;
      const tabs = document.createElement('div'); tabs.className = 'pg-tabs';
      const body = document.createElement('div'); body.className = 'pg-body';
      for (const pid of g.panels) {
        const p = $(pid); if (!p) continue;
        p.classList.remove('collapsed'); p.querySelector('.panel-head').hidden = true; body.appendChild(p);
        const t = document.createElement('button'); t.className = 'pg-tab'; t.dataset.p = pid; t.textContent = p.querySelector('.panel-head').textContent;
        t.onclick = () => { if (st.tab === pid && !st.collapsed) st.collapsed = true; else { st.tab = pid; st.collapsed = false; } this.apply(g.id); };
        tabs.appendChild(t);
      }
      tabs.ondblclick = e => { if (e.target === tabs) { st.collapsed = !st.collapsed; this.apply(g.id); } };
      box.append(tabs, body); dock.appendChild(box);
      this.apply(g.id);
    }
    dock.querySelectorAll(':scope > .panel').forEach(p => p.remove()); /* restos sin grupo */
  },
  apply(gid) {
    const st = this.state[gid], box = $(gid);
    box.classList.toggle('collapsed', st.collapsed);
    box.querySelectorAll('.pg-tab').forEach(t => t.classList.toggle('on', t.dataset.p === st.tab));
    box.querySelectorAll('.pg-body > .panel').forEach(p => p.hidden = p.id !== st.tab);
    this.save(); App.emit('dock', st.tab);
  },
  /* muestra un panel (menú Ventana) */
  show(pid) {
    const g = DOCK_GROUPS.find(x => x.panels.includes(pid)); if (!g) return;
    Object.assign(this.state[g.id], { tab: pid, collapsed: false }); $(g.id).hidden = false; this.apply(g.id);
  },
};

/* ---------- panel Transformar ---------- */
const TransformPanel = {
  init() {
    const body = $('pTransform').querySelector('.panel-body');
    body.innerHTML = transformFieldsHTML('pt') + `<div class="pt-actions">
      <button class="text-btn" data-a="fh" title="Reflejar horizontalmente">⇋ Reflejar H</button>
      <button class="text-btn" data-a="fv" title="Reflejar verticalmente">⇵ Reflejar V</button>
      <button class="text-btn" data-a="again" title="Transformar de nuevo (Ctrl+D)">↻ Repetir</button></div>`;
    bindTransformFields(body);
    body.querySelector('[data-a=fh]').onclick = () => History.named('Reflejar', () => Actions.reflect('h'));
    body.querySelector('[data-a=fv]').onclick = () => History.named('Reflejar', () => Actions.reflect('v'));
    body.querySelector('[data-a=again]').onclick = () => History.named('Transformar de nuevo', () => PathOps.transformAgain());
    const r = () => refreshTransformFields(body);
    for (const ev of ['selection', 'change', 'transform', 'refpoint']) App.on(ev, r);
    r();
  },
};

/* ---------- panel Propiedades (contextual, como en Illustrator) ---------- */
const PropsPanel = {
  init() {
    this.body = $('pProps').querySelector('.panel-body');
    for (const ev of ['selection', 'change', 'colors']) App.on(ev, () => this.schedule());
    App.on('transform', () => refreshTransformFields(this.body.querySelector('.pp-xf')));
    App.on('dock', t => { if (t === 'pProps') this.render(); });
    this.render();
  },
  schedule() { clearTimeout(this.t); this.t = setTimeout(() => this.render(), 30); },
  visible() { return !$('pProps').hidden && !$('gMain').classList.contains('collapsed'); },
  btn(label, fn, title = '') { return { label, fn, title }; },
  render() {
    if (!this.visible()) return;
    /* no redibujar mientras se escribe en un campo, salvo que haya cambiado la selección */
    const key = App.selection.map(e => e.id).join(',');
    if (this.body.contains(document.activeElement) && document.activeElement.tagName !== 'BUTTON' && key === this.lastKey) return;
    this.lastKey = key;
    const s = App.selection, b = this.body, one = s.length === 1 ? s[0] : null;
    const kind = !s.length ? 'Documento' : one ? objName(one).replace(/[<>]/g, '') : `${s.length} objetos`;
    const sec = (title, html) => `<div class="pp-sec"><div class="pp-title">${title}</div>${html}</div>`;
    let html = `<div class="pp-kind">${kind}</div>`;
    const actions = [];
    if (!s.length) {
      const ab = Artboards.active();
      html += sec(`Mesa de trabajo: ${ab.name.replace(/</g, '&lt;')}`, `<div class="pp-row"><label>An <input type="number" step="any" id="ppW" value="${Units.fmt(ab.width)}"></label>
        <label>Al <input type="number" step="any" id="ppH" value="${Units.fmt(ab.height)}"></label>
        <select id="ppUnit" title="Unidades">${Units.options()}</select></div>
        <div class="pp-row"><button class="text-btn" id="ppSetup">Ajustar documento…</button><button class="text-btn" id="ppAb">Editar mesa de trabajo</button></div>`);
      html += sec('Reglas y cuadrículas', `<div class="pp-row">
        <button class="text-btn ${Rulers.on ? 'on' : ''}" id="ppRul">Reglas</button><button class="text-btn ${Grid.on ? 'on' : ''}" id="ppGrid">Cuadrícula</button>
        <button class="text-btn ${SmartGuides.on ? 'on' : ''}" id="ppSmart">Guías inteligentes</button><button class="text-btn ${App.snap ? 'on' : ''}" id="ppSnap">Ajustar a cuadrícula</button></div>`);
      actions.push(this.btn('Seleccionar todo', () => Actions.selectAll()), this.btn('Colocar…', () => Import.place()), this.btn('Exportar…', () => Export.dialog()));
    } else {
      html += sec('Transformar', `<div class="pp-xf">${transformFieldsHTML('pp')}</div>`);
      if (one && LiveShape.kind(one)) html += sec('Forma', `<div class="pp-shape">${LiveShape.propsHTML(one)}</div>`);
      const st = one || s[0], f = getStyle(st, 'fill'), k = getStyle(st, 'stroke');
      html += sec('Apariencia', `<div class="pp-row pp-ap">
          <label>Relleno <button class="swatch-btn" id="ppFill"></button></label>
          <label>Trazo <button class="swatch-btn stroke" id="ppStroke"></button></label>
          <input type="number" min="0" step="0.5" id="ppSw" value="${+(getStyle(st, 'stroke-width') ?? 1)}" title="Grosor del trazo"> pt</div>
        <div class="pp-row"><label class="pp-op">Opacidad <input type="range" min="0" max="100" id="ppOp" value="${round(+(st.getAttribute('opacity') ?? 1) * 100)}"><span id="ppOpV">${round(+(st.getAttribute('opacity') ?? 1) * 100)}%</span></label></div>`);
      void f; void k;
      if (one && one.tagName === 'text') {
        html += sec('Carácter', `<div class="pp-row"><select id="ppFont">${FONTS.map(x => `<option ${x === one.getAttribute('font-family') ? 'selected' : ''}>${x}</option>`).join('')}</select>
          <input type="number" min="1" id="ppSize" value="${+one.getAttribute('font-size') || 16}" title="Tamaño"> pt</div>`);
      }
      const groups = s.some(e => e.tagName === 'g' && !e.hasAttribute('data-blend')), clip = s.some(e => e.hasAttribute('clip-path')), blend = s.some(e => e.hasAttribute('data-blend'));
      if (s.length > 1) actions.push(this.btn('Agrupar', () => Actions.group()));
      if (groups || clip) actions.push(this.btn('Desagrupar', () => Actions.ungroup()));
      actions.push(this.btn('Traer al frente', () => Actions.arrange('front')), this.btn('Enviar al fondo', () => Actions.arrange('back')));
      if (s.length > 1) actions.push(this.btn('Unificar', () => Pathfinder.run('unite')), this.btn('Menos frente', () => Pathfinder.run('minus')),
        this.btn('Crear máscara', () => Actions.makeClip()), this.btn('Fusión', () => Blend.make(App.selection)));
      if (clip) actions.push(this.btn('Liberar máscara', () => Actions.releaseClip()));
      if (blend) actions.push(this.btn('Opciones de fusión', () => Blend.options()), this.btn('Expandir fusión', () => Blend.expand()));
      if (s.some(e => leafShapes(e).some(x => (getStyle(x, 'stroke') || 'none') !== 'none'))) actions.push(this.btn('Contornear trazo', () => PathOps.outlineStroke()));
      if (s.some(e => e.tagName === 'image') && typeof Trace !== 'undefined') actions.push(this.btn('Calco de imagen', () => Trace.dialog()));
      if (s.some(e => e.tagName === 'text') && typeof TextOutline !== 'undefined') actions.push(this.btn('Crear contornos', () => TextOutline.run()));
      actions.push(this.btn('Bloquear', () => Actions.lock()), this.btn('Ocultar', () => Actions.hide()));
    }
    html += sec('Acciones rápidas', `<div class="pp-actions">${actions.map((a, i) => `<button class="text-btn" data-i="${i}" title="${a.title}">${a.label}</button>`).join('')}</div>`);
    b.innerHTML = html;
    b.querySelectorAll('.pp-actions [data-i]').forEach(el => el.onclick = () => { const a = actions[+el.dataset.i]; History.named(a.label, a.fn); });
    const q = id => b.querySelector('#' + id);
    if (!s.length) {
      q('ppUnit').value = Units.u;
      const abSize = (w, h) => { Artboards.setRect(Artboards.activeIndex(), { ...Artboards.active(), width: Math.max(1, w), height: Math.max(1, h) }); History.named('Mesa de trabajo', () => History.commit()); };
      q('ppW').onchange = e => abSize(Units.fromU(+e.target.value), Artboards.active().height);
      q('ppH').onchange = e => abSize(Artboards.active().width, Units.fromU(+e.target.value));
      q('ppUnit').onchange = e => { App.doc.units = e.target.value; History.named('Unidades', () => History.commit()); Panels.refreshControlBar(); Rulers.draw(); };
      q('ppSetup').onclick = () => NewDoc.setup(); q('ppAb').onclick = () => Tools.use('artboard');
      q('ppRul').onclick = () => { Rulers.toggle(); this.render(); }; q('ppGrid').onclick = () => { Grid.toggle(); this.render(); };
      q('ppSmart').onclick = () => { SmartGuides.on = !SmartGuides.on; this.render(); }; q('ppSnap').onclick = () => { App.snap = !App.snap; this.render(); };
    } else {
      const xf = b.querySelector('.pp-xf'); bindTransformFields(xf); refreshTransformFields(xf);
      if (b.querySelector('.pp-shape')) LiveShape.bindProps(b.querySelector('.pp-shape'), one);
      paintBox(q('ppFill'), App.fill); paintBox(q('ppStroke'), App.stroke);
      q('ppFill').onclick = () => { App.activeFS = 'fill'; Panels.refresh(); Dock.show('pColor'); $('pcPicker').click(); };
      q('ppStroke').onclick = () => { App.activeFS = 'stroke'; Panels.refresh(); Dock.show('pColor'); $('pcPicker').click(); };
      q('ppSw').onchange = e => Panels.setStrokeAttr('stroke-width', Math.max(0, +e.target.value));
      q('ppOp').oninput = e => { const v = +e.target.value / 100; q('ppOpV').textContent = e.target.value + '%'; App.selection.forEach(el => v === 1 ? el.removeAttribute('opacity') : el.setAttribute('opacity', v)); };
      q('ppOp').onchange = () => History.named('Opacidad', () => History.commit());
      if (q('ppFont')) {
        q('ppFont').onchange = e => { one.setAttribute('font-family', e.target.value); History.named('Fuente', () => History.commit()); Selection.draw(); };
        q('ppSize').onchange = e => { one.setAttribute('font-size', Math.max(1, +e.target.value)); History.named('Tamaño de fuente', () => History.commit()); Selection.draw(); };
      }
    }
  },
};

/* ---------- panel Historial ---------- */
const HistoryPanel = {
  init() {
    this.list = $('pHistory').querySelector('.panel-body');
    App.on('change', () => this.render()); App.on('dock', t => { if (t === 'pHistory') this.render(); });
    this.render();
  },
  render() {
    if ($('pHistory').hidden) return;
    const L = this.list; L.innerHTML = '';
    History.stack.forEach((s, i) => {
      const r = document.createElement('div'); r.className = 'hist-row' + (i === History.index ? ' on' : '') + (i > History.index ? ' future' : '');
      r.innerHTML = `<span class="hist-i">${i + 1}</span><span></span><span class="hist-t">${new Date(s.time || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
      r.children[1].textContent = s.label || 'Edición';
      r.onclick = () => History.goTo(i);
      L.appendChild(r);
    });
    const on = L.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  },
};
