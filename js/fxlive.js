/* Vectora — efectos en vivo (no destructivos) y panel Apariencia.
   Un trazado con efectos guarda su geometría original en data-src y la lista de
   efectos en data-fx; lo que se ve (d) se recalcula a partir de ambos. */
'use strict';

/* efectos geométricos: funciones puras subs -> subs (coordenadas locales del trazado) */
const FX = {
  pucker: { name: 'Fruncir y engordar', fields: [{ id: 'a', label: 'Cantidad (%)', type: 'number', value: 30, min: -200, max: 200, step: 5 }],
    run(subs, p) { const k = (+p.a || 0) / 100, c = centerOf(subs); subs = curvify(subs);
      mapPoints(subs, (q, kind) => (kind === 'a' ? { x: q.x + (q.x - c.x) * k * 0.5, y: q.y + (q.y - c.y) * k * 0.5 } : { x: q.x - (q.x - c.x) * k, y: q.y - (q.y - c.y) * k })); return subs; } },
  twist: { name: 'Retorcer', fields: [{ id: 'a', label: 'Ángulo (°)', type: 'number', value: 60, step: 5 }],
    run(subs, p) { subs = subdivide(subs, 6); const c = centerOf(subs), A = (+p.a || 0) * Math.PI / 180;
      mapPoints(subs, q => { const d = Math.hypot(q.x - c.x, q.y - c.y), t = A * (1 - Math.min(1, d / c.r)), co = Math.cos(t), si = Math.sin(t);
        return { x: c.x + (q.x - c.x) * co - (q.y - c.y) * si, y: c.y + (q.x - c.x) * si + (q.y - c.y) * co }; }); return subs; } },
  zigzag: { name: 'Zigzag', fields: [{ id: 's', label: 'Tamaño (px)', type: 'number', value: 8, min: 0 }, { id: 'n', label: 'Crestas por segmento', type: 'number', value: 6, min: 1, max: 100 },
    { id: 'smooth', label: 'Puntos', type: 'select', value: 'corner', options: [['corner', 'Vértice'], ['smooth', 'Suavizar']] }],
    run(subs, p) { return subs.map(s => {
      const pts = resample(s, Math.max(1, Math.round(+p.n)) * 2), size = +p.s || 0;
      const out = pts.map((q, i) => { if (!s.closed && (i === 0 || i === pts.length - 1)) return q;
        const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1, sg = i % 2 ? 1 : -1;
        return { x: q.x - dy / L * size * sg, y: q.y + dx / L * size * sg }; });
      return { nodes: p.smooth === 'smooth' ? smoothNodes(out, s.closed) : out.map(q => ({ ...q, hin: null, hout: null })), closed: s.closed }; }); } },
  roughen: { name: 'Rugosidad', fields: [{ id: 's', label: 'Tamaño (px)', type: 'number', value: 6, min: 0 }, { id: 'd', label: 'Detalle (puntos por segmento)', type: 'number', value: 8, min: 1, max: 100 },
    { id: 'smooth', label: 'Puntos', type: 'select', value: 'smooth', options: [['smooth', 'Suavizar'], ['corner', 'Vértice']] }, { id: 'seed', label: 'Variación', type: 'number', value: 1, min: 1 }],
    run(subs, p) { rngSeed = Math.max(1, Math.round(+p.seed || 1)) * 9973; return subs.map(s => {
      const pts = resample(s, Math.max(1, Math.round(+p.d))), size = +p.s || 0, out = pts.map(q => ({ x: q.x + (rnd() * 2 - 1) * size, y: q.y + (rnd() * 2 - 1) * size }));
      return { nodes: p.smooth === 'smooth' ? smoothNodes(out, s.closed) : out.map(q => ({ ...q, hin: null, hout: null })), closed: s.closed }; }); } },
  round: { name: 'Redondear esquinas', fields: [{ id: 'r', label: 'Radio (px)', type: 'number', value: 12, min: 0 }],
    run(subs, p) { return subs.map(s => roundAt(s, new Set(s.nodes.map((n, i) => i).filter(i => isCorner(s, i))), +p.r || 0)); } },
};

const LiveFX = {
  list(el) { try { return JSON.parse(el.getAttribute('data-fx') || '[]'); } catch (e) { return []; } },
  render(el) {
    const src = el.getAttribute('data-src'); if (src == null) return;
    let subs = PathData.parse(src);
    const L = this.list(el).filter(f => f.on !== false && FX[f.t]);
    this.paint(el, L.some(f => FX[f.t].outline));
    const ctx = { w: this.baseWidth(el) };
    for (const f of L) subs = FX[f.t].run(subs, f.p || {}, ctx);
    el.setAttribute('d', PathData.serialize(subs));
  },
  /* pinceles y anchura variable convierten el trazo en un contorno relleno:
     el trazo original (color, grosor y relleno) se guarda en data-ostroke */
  ostroke(el) { try { return JSON.parse(el.getAttribute('data-ostroke') || 'null'); } catch (e) { return null; } },
  baseWidth(el) { const o = this.ostroke(el); return o ? +o.w || 1 : +(getStyle(el, 'stroke-width') || 1); },
  paint(el, outline) {
    const o = this.ostroke(el);
    if (outline && !o) {
      const st = getStyle(el, 'stroke') || 'none', c = st === 'none' ? '#000000' : st;
      el.setAttribute('data-ostroke', JSON.stringify({ s: c, w: +(getStyle(el, 'stroke-width') || 1), f: getStyle(el, 'fill') || 'none' }));
      for (const k of ['stroke', 'stroke-width', 'fill']) el.style.removeProperty(k);
      el.setAttribute('fill', c); el.setAttribute('stroke', 'none'); el.removeAttribute('stroke-width');
    } else if (!outline && o) {
      el.setAttribute('stroke', o.s); el.setAttribute('stroke-width', o.w); el.setAttribute('fill', o.f); el.removeAttribute('data-ostroke');
    }
  },
  write(el, list) {
    if (list.length) el.setAttribute('data-fx', JSON.stringify(list));
    else { el.removeAttribute('data-fx'); this.paint(el, false); if (el.hasAttribute('data-src')) { el.setAttribute('d', el.getAttribute('data-src')); el.removeAttribute('data-src'); } return; }
    this.render(el);
  },
  prepare(el) { el = PathData.convert(el); if (!el.hasAttribute('data-src')) el.setAttribute('data-src', el.getAttribute('d') || ''); return el; },
  targets() { return App.selection.flatMap(e => (e.tagName === 'g' ? leafShapes(e) : [e])).filter(isShape).map(e => (e.id || (e.id = uid()))); },
  byIds(ids) { return ids.map(id => document.getElementById(id)).filter(Boolean); },
  /* las figuras convertidas a <path> conservan el id: volver a apuntar la selección */
  resync() { Selection.set(App.selection.map(e => (e.isConnected ? e : document.getElementById(e.id))).filter(Boolean)); },
  /* añadir un efecto (con vista previa) a los trazados seleccionados */
  async add(type) {
    const fx = FX[type], ids = this.targets(); if (!ids.length) return Dialog.alert('Selecciona uno o más trazados.');
    const snap = History.snapshot();
    const apply = v => { for (const el of this.byIds(ids)) { const e = this.prepare(el); this.write(e, [...this.list(e), { t: type, p: v }]); } Selection.draw(); };
    const v = await Dialog.form(fx.name, fx.fields, { preview: apply, revert: () => Dialog.revertTo(snap), note: 'El efecto queda editable en el panel Apariencia.' });
    if (!v) return; delete v._button; apply(v); this.resync();
    History.named(fx.name, () => History.commit()); Selection.changed();
  },
  async edit(el, i) {
    const list = this.list(el), f = list[i], fx = FX[f.t]; if (!fx) return;
    const snap = History.snapshot(), id = el.id;
    const apply = v => { const e = document.getElementById(id); if (!e) return; const L = this.list(e); L[i] = { ...L[i], p: v }; this.write(e, L); Selection.draw(); };
    const v = await Dialog.form(fx.name, fx.fields.map(x => ({ ...x, value: (f.p || {})[x.id] ?? x.value })), { preview: apply, revert: () => Dialog.revertTo(snap) });
    if (!v) return; delete v._button; apply(v); History.named(fx.name, () => History.commit()); Selection.changed();
  },
  toggle(el, i) { const L = this.list(el); L[i].on = L[i].on === false; this.write(el, L); History.named('Efecto', () => History.commit()); Selection.changed(); },
  remove(el, i) { const L = this.list(el); L.splice(i, 1); this.write(el, L); History.named('Quitar efecto', () => History.commit()); Selection.changed(); },
  /* expandir apariencia: lo que se ve pasa a ser la geometría real */
  expand(els = App.selection.flatMap(e => [e, ...e.querySelectorAll('[data-fx]')])) {
    let n = 0; for (const el of els) if (el.hasAttribute && el.hasAttribute('data-fx')) { el.removeAttribute('data-fx'); el.removeAttribute('data-src'); el.removeAttribute('data-ostroke'); n++; }
    if (n) { History.named('Expandir apariencia', () => History.commit()); Selection.changed(); }
  },
};

/* los movimientos y escalas también se aplican a la geometría original */
(() => {
  const baseNT = normalizeTransform;
  normalizeTransform = function (el) {
    if (el.tagName !== 'path' || !el.hasAttribute('data-src')) return baseNT(el);
    const m = Geo.local(el); if (m.isIdentity) { el.removeAttribute('transform'); return; }
    if (m.b !== 0 || m.c !== 0) return;
    const T = p => p && ({ x: m.a * p.x + m.e, y: m.d * p.y + m.f }), subs = PathData.parse(el.getAttribute('data-src'));
    subs.forEach(s => s.nodes.forEach(n => { const q = T(n); n.x = q.x; n.y = q.y; n.hin = T(n.hin); n.hout = T(n.hout); }));
    el.setAttribute('data-src', PathData.serialize(subs)); el.removeAttribute('transform');
    /* cajas de referencia de los efectos (envolventes) */
    const L = LiveFX.list(el); let boxed = false;
    for (const f of L) if (f.p && f.p.box) { const [x, y, w, h] = f.p.box, A = T({ x, y }), B = T({ x: x + w, y: y + h }); f.p.box = [Math.min(A.x, B.x), Math.min(A.y, B.y), Math.abs(B.x - A.x), Math.abs(B.y - A.y)]; boxed = true; }
    if (boxed) el.setAttribute('data-fx', JSON.stringify(L));
    LiveFX.render(el);
  };
  /* la selección directa edita el trazado original */
  const basePI = pathItem, baseRI = renderItem;
  pathItem = function (el) { if (el.tagName === 'path' && el.hasAttribute('data-src')) return { el, subs: PathData.parse(el.getAttribute('data-src')), live: true }; return basePI(el); };
  renderItem = function (it) { if (!it.live) return baseRI(it); it.el.setAttribute('data-src', PathData.serialize(it.subs)); LiveFX.render(it.el); };
})();

/* ---------- panel Apariencia ---------- */
const FILTER_NAMES = { feDropShadow: 'Sombra paralela', feGaussianBlur: 'Desenfoque gaussiano' };
const Appearance = {
  init() {
    App.on('selection', () => this.render()); App.on('change', () => this.render()); App.on('dock', t => { if (t === 'pAppearance') this.render(); });
    $('apAdd').onclick = e => { e.stopPropagation(); this.menu($('apAdd')); };
    $('apExpand').onclick = () => LiveFX.expand();
    $('apClear').onclick = () => { App.selection.forEach(el => { [el, ...el.querySelectorAll('[data-fx]')].forEach(x => LiveFX.write(x, [])); el.removeAttribute('filter'); }); History.named('Borrar apariencia', () => History.commit()); Selection.changed(); };
    this.render();
  },
  menu(btn) {
    const r = btn.getBoundingClientRect(), pop = $('menuPopup'); Menus.close(); Menus.openMenu = '__ap'; pop.innerHTML = '';
    const items = [...Object.entries(FX).filter(([, f]) => !f.hidden).map(([k, f]) => [f.name + '…', () => (k === 'warp' ? Envelope.warp() : LiveFX.add(k))]), '-', ...Object.entries(FILTERS).map(([k, f]) => [f.name + '…', () => FilterFX.add(k)])];
    for (const it of items) {
      if (it === '-') { pop.insertAdjacentHTML('beforeend', '<div class="menu-sep"></div>'); continue; }
      const row = document.createElement('div'); row.className = 'menu-item'; row.innerHTML = `<span>${it[0]}</span><span></span>`;
      row.onclick = () => { Menus.close(); it[1](); }; pop.appendChild(row);
    }
    pop.hidden = false; pop.style.left = Math.max(4, r.left) + 'px'; pop.style.top = Math.max(4, r.top - pop.offsetHeight - 4) + 'px';
  },
  render() {
    const box = $('apList'); if (!box || $('pAppearance').hidden) return;
    const el = App.selection[0]; box.innerHTML = '';
    if (!el) { box.innerHTML = '<p class="empty-note">Sin selección</p>'; return; }
    const leaf = el.tagName === 'g' ? el : (leafShapes(el)[0] || el);
    const row = (html, cls = '') => { const r = document.createElement('div'); r.className = 'ap-row ' + cls; r.innerHTML = html; box.appendChild(r); return r; };
    row(`<b>${objName(el).replace(/[<>]/g, '')}</b>`, 'ap-head');
    const fx = LiveFX.list(leaf);
    fx.forEach((f, i) => {
      const r = row(`<span class="ap-eye ${f.on === false ? 'off' : ''}" title="Activar/desactivar">👁</span><span class="ap-name">${FX[f.t] ? FX[f.t].name : f.t}</span><span class="ap-fx" title="Editar efecto">fx</span><span class="ap-del" title="Quitar">✕</span>`, 'ap-effect');
      r.querySelector('.ap-eye').onclick = () => LiveFX.toggle(leaf, i);
      r.querySelector('.ap-name').onclick = r.querySelector('.ap-fx').onclick = () => LiveFX.edit(leaf, i);
      r.querySelector('.ap-del').onclick = () => LiveFX.remove(leaf, i);
    });
    FilterFX.rows(el, row);
    const sw = (c, stroke) => `<span class="ap-sw ${c === 'none' ? 'none' : ''} ${stroke ? 'stroke' : ''}" style="${c && c !== 'none' ? `background:${c.startsWith('url(') ? 'linear-gradient(90deg,#fff,#000)' : c}` : ''}"></span>`;
    const stroke = normColor(getStyle(leaf, 'stroke') || 'none'), fill = normColor(getStyle(leaf, 'fill') || '#000');
    const rs = row(`<span class="ap-label">Trazo</span>${sw(stroke, true)}<span class="ap-val">${stroke === 'none' ? '' : (+(getStyle(leaf, 'stroke-width') ?? 1)) + ' pt'}</span>`);
    const rf = row(`<span class="ap-label">Relleno</span>${sw(fill)}`);
    rs.onclick = () => { App.activeFS = 'stroke'; Panels.refresh(); Dock.show('pColor'); };
    rf.onclick = () => { App.activeFS = 'fill'; Panels.refresh(); Dock.show('pColor'); };
    row(`<span class="ap-label">Opacidad</span><span class="ap-val">${round(+(el.getAttribute('opacity') ?? 1) * 100)}%${el.style.mixBlendMode ? ' · ' + el.style.mixBlendMode : ''}</span>`).onclick = () => Dock.show('pTransp');
  },
};
