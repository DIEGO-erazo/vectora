/* Vectora — máscaras de opacidad, modos de dibujo (normal, detrás, dentro) y Entrelazar */
'use strict';

/* ---------- máscara de opacidad ---------- */
/* g[data-opmask] con mask="url(#…)"; la máscara guarda su contenido en g[data-mask-content]
   y, si no recorta, un rectángulo blanco detrás (lo que queda fuera se ve) */
const OpMask = {
  INV: '<feColorMatrix type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 1 0"/>',
  of(el) { return el && el.closest && el.closest('[mask]'); },
  def(g) { const id = ((g && g.getAttribute('mask')) || '').match(/#([^)]+)/); return id && document.getElementById(id[1]); },
  content(m) { return m.querySelector('[data-mask-content]'); },
  /* el objeto superior pasa a ser la máscara de los de debajo */
  make() {
    const sel = docOrder(App.selection.filter(e => !Layers.isLocked(e)));
    if (sel.length < 2) return Dialog.alert('Selecciona el objeto que hará de máscara (encima) y los objetos que quieres enmascarar.');
    const top = sel.pop(), g = svgEl('g', { id: uid(), 'data-opmask': '1', 'data-name': '<Máscara de opacidad>' }); top.after(g);
    sel.forEach(e => { const m = Geo.toDoc(e); g.appendChild(e); Geo.setMatrix(e, Geo.toDoc(g).inverse().multiply(m)); normalizeTransform(e); });
    const m = svgEl('mask', { id: uid('mask'), maskUnits: 'userSpaceOnUse', x: -100000, y: -100000, width: 200000, height: 200000, 'data-clip': '1', 'data-name': 'Máscara' }, docDefs());
    const wrap = svgEl('g', { 'data-mask-wrap': '1' }, m), content = svgEl('g', { id: uid(), 'data-mask-content': '1', 'data-name': 'Máscara' }, wrap);
    const tm = Geo.toDoc(top); content.appendChild(top); Geo.setMatrix(top, Geo.toDoc(g).inverse().multiply(tm));
    g.setAttribute('mask', `url(#${m.id})`);
    Selection.set([g]); History.named('Crear máscara de opacidad', () => History.commit()); App.emit('layers'); this.sync();
  },
  /* opciones Recortar / Invertir */
  set(opt, on, g = this.of(App.selection[0])) {
    const m = this.def(g); if (!m) return;
    m.setAttribute('data-' + opt, on ? '1' : '0');
    const wrap = m.querySelector('[data-mask-wrap]'); wrap.querySelector('[data-mask-bg]')?.remove();
    if (m.getAttribute('data-clip') === '0') wrap.prepend(svgEl('rect', { 'data-mask-bg': '1', x: -100000, y: -100000, width: 200000, height: 200000, fill: '#fff' }));
    let f = m.querySelector('filter'); if (f) { f.remove(); wrap.removeAttribute('filter'); }
    if (m.getAttribute('data-invert') === '1') { f = svgEl('filter', { id: uid('minv'), x: '-50%', y: '-50%', width: '200%', height: '200%', 'color-interpolation-filters': 'sRGB' }, m); f.innerHTML = this.INV; wrap.setAttribute('filter', `url(#${f.id})`); }
    History.named('Opciones de máscara', () => History.commit()); this.sync(); Selection.draw();
  },
  release(g = this.of(App.selection[0])) {
    const m = this.def(g); if (!g || !m) return;
    const c = this.content(m), out = [], G = Geo.toDoc(g);
    for (const k of [...c.children]) { const km = G.multiply(Geo.local(k)); g.after(k); Geo.setMatrix(k, Geo.toDoc(k.parentNode).inverse().multiply(km)); normalizeTransform(k); out.push(k); }
    g.removeAttribute('mask'); m.remove();
    if (g.hasAttribute('data-opmask')) { for (const k of [...g.children]) { const km = G.multiply(Geo.local(k)); g.before(k); Geo.setMatrix(k, Geo.toDoc(k.parentNode).inverse().multiply(km)); normalizeTransform(k); out.unshift(k); } g.remove(); }
    Selection.set(out); History.named('Liberar máscara de opacidad', () => History.commit()); App.emit('layers'); this.sync();
  },
  edit(g = this.of(App.selection[0])) {
    const m = this.def(g); if (!m) return;
    DefEdit.enter(this.content(m), Geo.toDoc(g), null);
  },
  /* botones del panel Transparencia */
  init() {
    $('pTransp').querySelector('.panel-body').insertAdjacentHTML('beforeend', `<label>Máscara</label><div class="om-row">
      <button class="text-btn" id="omMake" title="El objeto superior enmascara a los de debajo (su luminosidad da la opacidad)">Crear máscara</button>
      <button class="text-btn" id="omEdit" title="Editar el contenido de la máscara">Editar</button>
      <button class="text-btn" id="omRel" title="Liberar la máscara">Liberar</button></div>
      <label></label><div class="om-row"><label><input type="checkbox" id="omClip"> Recortar</label><label><input type="checkbox" id="omInv"> Invertir máscara</label></div>`);
    $('omMake').onclick = () => this.make(); $('omEdit').onclick = () => this.edit(); $('omRel').onclick = () => this.release();
    $('omClip').onchange = e => this.set('clip', e.target.checked); $('omInv').onchange = e => this.set('invert', e.target.checked);
    App.on('selection', () => this.sync()); App.on('change', () => this.sync());
    this.sync();
  },
  sync() {
    const g = this.of(App.selection[0]), m = this.def(g), has = !!m;
    $('omMake').hidden = has; $('omEdit').hidden = $('omRel').hidden = !has;
    $('omClip').disabled = $('omInv').disabled = !has;
    $('omClip').checked = has ? m.getAttribute('data-clip') !== '0' : true; $('omInv').checked = has && m.getAttribute('data-invert') === '1';
  },
};

/* ---------- modos de dibujo: normal, detrás y dentro (Mayús+D alterna) ---------- */
const DrawMode = {
  mode: 'normal', inside: null,
  set(mode) {
    if (mode === 'inside') {
      const s = App.selection.length === 1 ? App.selection[0] : null;
      if (s && s.hasAttribute('data-drawinside')) this.inside = s;
      else if (s && (isShape(s) || s.tagName === 'text')) this.inside = this.wrap(s);
      else { $('sbHint').textContent = 'Dibujar dentro: selecciona primero un solo objeto'; mode = 'normal'; }
    }
    if (mode !== 'inside') this.inside = null;
    this.mode = mode; this.render(); Selection.draw();
  },
  cycle() { this.set({ normal: 'behind', behind: 'inside', inside: 'normal' }[this.mode]); },
  /* el objeto se convierte en un grupo de recorte con él mismo dentro */
  wrap(s) {
    const g = svgEl('g', { id: uid(), 'data-drawinside': '1', 'data-name': '<Grupo de recorte>' }); s.before(g);
    const cp = svgEl('clipPath', { id: uid('clip'), clipPathUnits: 'userSpaceOnUse' }, docDefs()), c = s.cloneNode(true); c.id = uid();
    cp.appendChild(c); Geo.setMatrix(c, Geo.toDoc(s));
    const m = Geo.toDoc(s); g.appendChild(s); Geo.setMatrix(s, Geo.toDoc(g).inverse().multiply(m));
    g.setAttribute('clip-path', `url(#${cp.id})`); Selection.set([g]); History.named('Dibujar dentro', () => History.commit()); App.emit('layers');
    return g;
  },
  render() {
    $('dmBtns').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === this.mode));
  },
  init() {
    document.querySelector('.fs-widget').insertAdjacentHTML('afterend', `<div id="dmBtns" class="dm-btns">
      <button data-m="normal" title="Dibujar normal"><svg viewBox="0 0 20 20"><rect x="3" y="3" width="10" height="10"/><rect x="7" y="7" width="10" height="10" fill="currentColor"/></svg></button>
      <button data-m="behind" title="Dibujar detrás"><svg viewBox="0 0 20 20"><rect x="7" y="7" width="10" height="10"/><rect x="3" y="3" width="10" height="10" fill="currentColor"/></svg></button>
      <button data-m="inside" title="Dibujar dentro (selecciona un objeto)"><svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" stroke-dasharray="2 2"/><circle cx="10" cy="10" r="4" fill="currentColor"/></svg></button></div>`);
    $('dmBtns').querySelectorAll('button').forEach(b => b.onclick = () => this.set(b.dataset.m));
    this.render();
    const base = addObject;
    addObject = function (el) {
      const D = DrawMode;
      if (D.mode === 'inside' && D.inside && D.inside.isConnected && !Layers.isLocked(D.inside)) {
        if (!el.id) el.id = uid(); D.inside.appendChild(el); const P = Geo.toDoc(D.inside); if (!P.isIdentity) Geo.setMatrix(el, P.inverse()); App.emit('layers'); return el;
      }
      const r = base(el);
      if (r && D.mode === 'behind') { const s = App.selection[0]; if (s && s.parentNode && s !== r && s.parentNode === r.parentNode) s.before(r); else r.parentNode.prepend(r); App.emit('layers'); }
      return r;
    };
    /* marco discontinuo del objeto en el que se dibuja dentro */
    const sel = App.tools.select, baseOv = sel.overlay;
    const drawFrame = g => {
      const D = DrawMode; if (D.mode !== 'inside' || !D.inside || !D.inside.isConnected) return;
      const b = Geo.bbox(D.inside); if (!b) return; const a = View.docToStage(b.x, b.y), z = App.view.zoom, w = b.width * z, h = b.height * z, L = Math.min(14, w / 3, h / 3);
      svgEl('path', { d: `M${a.x} ${a.y + L}V${a.y}H${a.x + L}M${a.x + w - L} ${a.y}H${a.x + w}V${a.y + L}M${a.x + w} ${a.y + h - L}V${a.y + h}H${a.x + w - L}M${a.x + L} ${a.y + h}H${a.x}V${a.y + h - L}`, fill: 'none', stroke: '#1e90ff', 'stroke-width': 2, 'stroke-dasharray': '3 2' }, g);
    };
    sel.overlay = function (g) { baseOv.call(this, g); drawFrame(g); };
    const baseDraw = Selection.draw.bind(Selection);
    Selection.draw = function (...a) { baseDraw(...a); if (App.toolName !== 'select') drawFrame(App.els.overlay); };
  },
};

/* ---------- Objeto ▸ Entrelazar ---------- */
/* g[data-intertwine]: los objetos originales y, encima, parches (copias recortadas a una zona de cruce) */
const Intertwine = {
  make() {
    const sel = docOrder(App.selection.filter(e => isShape(e) && !Layers.isLocked(e)));
    if (sel.length < 2) return Dialog.alert('Selecciona dos o más formas que se crucen.');
    const g = svgEl('g', { id: uid(), 'data-intertwine': '1', 'data-name': 'Entrelazado' }); sel[sel.length - 1].after(g);
    sel.forEach(e => { const m = Geo.toDoc(e); g.appendChild(e); e.setAttribute('data-iw-src', '1'); Geo.setMatrix(e, Geo.toDoc(g).inverse().multiply(m)); normalizeTransform(e); });
    Selection.set([g]); History.named('Entrelazar', () => History.commit()); App.emit('layers'); Tools.use('intertwine');
  },
  release(g = App.selection.find(e => e.hasAttribute('data-intertwine'))) {
    if (!g) return; g.querySelectorAll('[data-iw-patch]').forEach(p => { const id = (p.getAttribute('clip-path') || '').match(/#([^)]+)/); id && document.getElementById(id[1])?.remove(); p.remove(); });
    const out = [], G = Geo.toDoc(g);
    for (const k of [...g.children]) { const km = G.multiply(Geo.local(k)); k.removeAttribute('data-iw-src'); g.before(k); Geo.setMatrix(k, Geo.toDoc(k.parentNode).inverse().multiply(km)); normalizeTransform(k); out.push(k); }
    g.remove(); Selection.set(out); History.named('Liberar entrelazado', () => History.commit()); App.emit('layers');
  },
};
App.tools.intertwine = {
  cursor: 'crosshair',
  group() { const s = App.selection[0]; return s && s.closest && s.closest('g[data-intertwine]'); },
  activate() { this.refresh(); },
  refresh() {
    const g = this.group(); this.srcs = g ? [...g.querySelectorAll(':scope > [data-iw-src]')] : [];
    /* las formas sin relleno se entrelazan por su trazo: se usa el contorno del trazo */
    const tmp = this.srcs.map(s => {
      if ((getStyle(s, 'fill') || '#000') !== 'none' || (getStyle(s, 'stroke') || 'none') === 'none') return s;
      const p = svgEl('path', { d: Boolean2D.toPath(outlinePoly(s, (+getStyle(s, 'stroke-width') || 1) * docScale(s))) }); App.els.content.appendChild(p); p.dataset.tmp = '1'; return p;
    });
    this.F = this.srcs.length ? Faces.build(tmp) : [];
    tmp.forEach(t => t.dataset.tmp && t.remove());
    $('sbHint').textContent = g ? 'Entrelazar: clic en un cruce para cambiar qué objeto pasa por encima' : 'Entrelazar: selecciona un grupo entrelazado (Objeto ▸ Entrelazar ▸ Crear)';
  },
  faceAt(p) { let best = null; for (const f of this.F || []) if (f.owners.length > 1 && Faces.contains(f, p) && (!best || Math.abs(f.area) < Math.abs(best.area))) best = f; return best; },
  hover(p) { this.hot = this.faceAt(p); Selection.draw(); },
  down(p, ev) {
    const g = this.group(); if (!g) { const o = hitObject(ev); if (o && o.hasAttribute('data-intertwine')) { Selection.set([o]); this.refresh(); } return; }
    const f = this.faceAt(p); if (!f) return;
    const key = f.owners.join('-') + ':' + round(f.pt.x, 1) + ',' + round(f.pt.y, 1);
    const old = [...g.querySelectorAll('[data-iw-patch]')].find(e => e.getAttribute('data-iw-patch') === key || this.inPatch(e, f.pt));
    if (old) { const id = (old.getAttribute('clip-path') || '').match(/#([^)]+)/); id && document.getElementById(id[1])?.remove(); old.remove(); }
    else {
      /* el objeto de debajo en esta zona sube: copia recortada a la región */
      const lower = this.srcs[Math.min(...f.owners)], cp = svgEl('clipPath', { id: uid('iw'), clipPathUnits: 'userSpaceOnUse' }, docDefs());
      const inv = Geo.toDoc(g).inverse(), ring = r => r.map(q => Geo.pt(inv, q.x, q.y));
      svgEl('path', { d: Boolean2D.toPath({ rings: Faces.rings(f).map(ring) }) }, cp);
      const c = lower.cloneNode(true); c.id = uid(); c.removeAttribute('data-iw-src'); c.setAttribute('data-iw-patch', key); c.setAttribute('clip-path', `url(#${cp.id})`); g.appendChild(c);
    }
    History.named('Entrelazar', () => History.commit()); Selection.draw();
  },
  inPatch(e, pt) { const id = (e.getAttribute('clip-path') || '').match(/#([^)]+)/), cp = id && document.getElementById(id[1]), path = cp && cp.querySelector('path'); if (!path) return false; const q = Geo.pt(Geo.toDoc(e.parentNode).inverse(), pt.x, pt.y); try { return path.isPointInFill(new DOMPoint(q.x, q.y)); } catch (x) { return false; } },
  overlay(g) {
    if (!this.hot) return;
    const ringD = r => 'M' + r.map(q => { const s = View.docToStage(q.x, q.y); return `${s.x} ${s.y}`; }).join('L') + 'Z';
    svgEl('path', { d: Faces.rings(this.hot).map(ringD).join(' '), 'fill-rule': 'evenodd', fill: 'rgba(30,144,255,.25)', stroke: '#1e90ff', 'stroke-width': 2 }, g);
  },
  deactivate() { this.F = null; this.hot = null; $('sbHint').textContent = ''; },
};
ICONS.intertwine = '<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>';
TOOL_INFO.intertwine = ['Entrelazar', ''];
TOOL_GROUPS.find(g => Array.isArray(g) && g.includes('builder')).push('intertwine');
