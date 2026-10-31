/* Vectora — color avanzado: modo CMYK (panel y documento), colores globales y planos
   (con matices), Volver a colorear ilustración con rueda de color, e impresión con
   marcas de corte, sangrado y una página por mesa de trabajo */
'use strict';

/* ---------- CMYK ---------- */
function rgbToCmyk(r, g, b) {
  const k = 1 - Math.max(r, g, b) / 255; if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  const f = x => Math.round((1 - x / 255 - k) / (1 - k) * 100);
  return { c: f(r), m: f(g), y: f(b), k: Math.round(k * 100) };
}
function cmykToRgb(c, m, y, k) { const f = x => 255 * (1 - x / 100) * (1 - k / 100); return { r: f(c), g: f(m), b: f(y) }; }

(() => {
  $('pcMode').insertAdjacentHTML('beforeend', '<option value="cmyk">CMYK</option>');
  $('pcB').closest('.slider-row').insertAdjacentHTML('afterend', '<div class="slider-row" id="pcKRow" hidden><span id="pcL3">K</span> <input type="range" id="pcK" min="0" max="100"><span id="pcKv"></span></div>');
  $('pcK').oninput = () => Panels.setColor(App.activeFS, Panels.slidersToHex(), false);
  $('pcK').onchange = () => History.commit();
  const baseMode = Panels.applyColorMode.bind(Panels), baseHex = Panels.slidersToHex.bind(Panels), baseRefresh = Panels.refresh.bind(Panels);
  Panels.applyColorMode = function () {
    const cmyk = App.colorMode === 'cmyk'; $('pcKRow').hidden = !cmyk;
    if (!cmyk) return baseMode();
    ['C', 'M', 'Y'].forEach((l, i) => { $('pcL' + i).textContent = l; $('pc' + 'RGB'[i]).max = 100; });
  };
  Panels.slidersToHex = function () {
    if (App.colorMode !== 'cmyk') return baseHex();
    const o = cmykToRgb(+$('pcR').value, +$('pcG').value, +$('pcB').value, +$('pcK').value); return rgbToHex(o.r, o.g, o.b);
  };
  Panels.refresh = function () {
    baseRefresh();
    if (App.colorMode !== 'cmyk') return;
    const c = App[App.activeFS], rgb = hexToRgb(c && c.startsWith('#') ? c : '#000000'), v = rgbToCmyk(rgb.r, rgb.g, rgb.b), vals = [v.c, v.m, v.y, v.k];
    const dragging = ['pcR', 'pcG', 'pcB', 'pcK'].includes(document.activeElement && document.activeElement.id);
    ['R', 'G', 'B', 'K'].forEach((s, i) => { if (!dragging) $('pc' + s).value = vals[i]; $('pc' + s + 'v').textContent = dragging ? $('pc' + s).value : vals[i]; });
  };
  Panels.applyColorMode();
})();
/* modo de color del documento (se muestra en el título y fija el modo del panel Color) */
const DocColor = {
  set(mode) {
    App.doc.colorMode = mode; App.colorMode = mode === 'cmyk' ? 'cmyk' : 'rgb'; $('pcMode').value = App.colorMode;
    Panels.applyColorMode(); Panels.refresh(); View.apply(); History.named('Modo de color del documento', () => History.commit());
  },
};

/* ---------- colores globales y planos ---------- */
const GSW_ATTR = { fill: 'data-gfill', stroke: 'data-gstroke' };
const GlobalSwatches = {
  list() { return App.doc.gswatches || (App.doc.gswatches = []); },
  get(id) { return this.list().find(s => s.id === id); },
  tint(c, t) { if (t >= 100) return c; const o = hexToRgb(c), k = t / 100; return rgbToHex(255 - (255 - o.r) * k, 255 - (255 - o.g) * k, 255 - (255 - o.b) * k); },
  /* aplica el color global (enlazado) a la selección */
  apply(sw, which = App.activeFS, tint = 100) {
    const color = this.tint(sw.c, tint);
    this.applying = true;
    try { Panels.setColor(which, color); } finally { this.applying = false; }
    for (const el of App.selection.flatMap(e => leafShapes(e))) el.setAttribute(GSW_ATTR[which], tint >= 100 ? sw.id : `${sw.id}@${tint}`);
  },
  /* actualiza todos los objetos que usan el color global */
  propagate(sw) {
    for (const [prop, attr] of Object.entries(GSW_ATTR)) for (const el of App.els.content.querySelectorAll(`[${attr}^="${sw.id}"]`)) {
      const [id, t] = el.getAttribute(attr).split('@'); if (id !== sw.id) continue;
      this.applying = true; try { setStyle([el], prop, this.tint(sw.c, t ? +t : 100)); } finally { this.applying = false; }
    }
  },
  async edit(sw) {
    const isNew = !sw, v = await Dialog.form(isNew ? 'Nueva muestra' : 'Opciones de muestra', [
      { id: 'n', label: 'Nombre', value: sw ? sw.name : `Color global ${this.list().length + 1}` },
      { id: 'type', label: 'Tipo de color', type: 'select', value: sw && sw.spot ? 'spot' : 'global', options: [['global', 'Color global (cuatricromía)'], ['spot', 'Color plano (tinta directa)']] },
      { id: 'c', label: 'Color', type: 'color', value: sw ? sw.c : (/^#/.test(App[App.activeFS]) ? App[App.activeFS] : '#2d8ceb') },
    ], { note: 'Al cambiar un color global se actualizan todos los objetos que lo usan.', buttons: isNew ? [] : [['Eliminar', 'del']] });
    if (!v) return;
    if (v._button === 'del') return this.remove(sw);
    if (isNew) { sw = { id: uid('gsw'), name: v.n.trim() || 'Color', c: v.c, spot: v.type === 'spot' }; this.list().push(sw); }
    else Object.assign(sw, { name: v.n.trim() || sw.name, c: v.c, spot: v.type === 'spot' });
    this.propagate(sw); History.named(isNew ? 'Nueva muestra global' : 'Editar muestra global', () => History.commit()); this.render(); Selection.draw();
  },
  remove(sw) {
    this.list().splice(this.list().indexOf(sw), 1);
    for (const attr of Object.values(GSW_ATTR)) App.els.content.querySelectorAll(`[${attr}^="${sw.id}"]`).forEach(e => e.removeAttribute(attr));
    History.named('Eliminar muestra', () => History.commit()); this.render();
  },
  render() {
    const box = $('gswGrid'); if (!box) return; box.innerHTML = '';
    const el = App.selection[0] && leafShapes(App.selection[0])[0], cur = el && (el.getAttribute(GSW_ATTR[App.activeFS]) || '').split('@')[0];
    for (const sw of this.list()) {
      const s = document.createElement('div'); s.className = 'sw gsw' + (sw.spot ? ' spot' : '') + (sw.id === cur ? ' on' : ''); s.title = `${sw.name}${sw.spot ? ' (color plano)' : ' (global)'} — clic: aplicar · Mayús+clic: matiz · doble clic: editar`;
      paintBox(s, sw.c);
      s.onclick = async e => {
        if (e.shiftKey) { const v = await Dialog.form('Matiz', [{ id: 't', label: 'Matiz (%)', type: 'number', value: 50, min: 1, max: 100 }]); if (!v) return; this.apply(sw, App.activeFS, clamp(+v.t, 1, 100)); }
        else this.apply(sw);
        History.named('Color global', () => History.commit()); this.render();
      };
      s.ondblclick = () => this.edit(sw);
      box.appendChild(s);
    }
    if (!box.children.length) box.innerHTML = '<p class="empty-note">Pulsa ◆＋ para crear un color global o plano.</p>';
  },
  init() {
    $('recentGrid').previousElementSibling.insertAdjacentHTML('beforebegin', '<div class="btn-group-label">Colores globales y planos</div><div id="gswGrid" class="sw-row"></div>');
    $('swAdd').insertAdjacentHTML('afterend', '<button id="gswAdd" title="Nuevo color global o plano">◆＋</button>');
    $('gswAdd').onclick = () => this.edit(null);
    App.on('change', () => this.render()); App.on('selection', () => this.render());
    /* cambiar el color a mano rompe el vínculo con el color global */
    const baseSet = setStyle;
    setStyle = function (els, prop, value) {
      baseSet(els, prop, value);
      if (!GlobalSwatches.applying && GSW_ATTR[prop]) for (const el of els) for (const s of leafShapes(el)) s.removeAttribute(GSW_ATTR[prop]);
    };
    this.render();
  },
};

/* ---------- Volver a colorear ilustración ---------- */
const RecolorArt = {
  /* referencias a todos los colores de la selección */
  collect() {
    const refs = [], grads = new Set();
    for (const s of App.selection.flatMap(e => [e, ...e.querySelectorAll('*')])) {
      if (!isShape(s) && s.tagName !== 'text') continue;
      for (const a of ['fill', 'stroke']) {
        const v = getStyle(s, a); if (!v || v === 'none') continue;
        const m = v.match(/url\(\s*#([^)]+)\)/); if (m) { grads.add(m[1]); continue; }
        const c = normColor(v); if (/^#[0-9a-f]{6}$/i.test(c)) refs.push({ el: s, a, c: c.toLowerCase() });
      }
    }
    for (const id of grads) for (const st of (document.getElementById(id) || { querySelectorAll: () => [] }).querySelectorAll('stop')) {
      const c = normColor(st.getAttribute('stop-color') || '#000'); if (/^#[0-9a-f]{6}$/i.test(c)) refs.push({ el: st, a: 'stop-color', c: c.toLowerCase(), stop: true });
    }
    return refs;
  },
  write(r, c) { if (r.stop) r.el.setAttribute('stop-color', c); else { GlobalSwatches.applying = false; setStyle([r.el], r.a, c); } },
  open() {
    const refs = this.collect(); if (!refs.length) return Dialog.alert('Selecciona ilustración con colores para volver a colorearla.');
    const counts = {}; refs.forEach(r => counts[r.c] = (counts[r.c] || 0) + 1);
    const rows = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).map(c => ({ from: c, to: c }));
    const st = { hue: 0, sat: 0, bri: 0, link: true };
    const back = document.createElement('div'); back.className = 'dlg-back';
    back.innerHTML = `<div class="dlg rc-dlg"><div class="dlg-title">Volver a colorear ilustración</div><div class="dlg-body rc-body">
      <div class="rc-left"><canvas id="rcWheel" width="220" height="220"></canvas>
        <label class="dlg-prev"><input type="checkbox" id="rcLink" checked> Vincular colores de armonía</label>
        <div class="rc-sl"><label>Tono</label><input type="range" id="rcHue" min="-180" max="180" value="0"></div>
        <div class="rc-sl"><label>Saturación</label><input type="range" id="rcSat" min="-100" max="100" value="0"></div>
        <div class="rc-sl"><label>Brillo</label><input type="range" id="rcBri" min="-100" max="100" value="0"></div>
        <div class="rc-btns"><button class="text-btn" id="rcShuffle" title="Reordenar colores al azar">Aleatorio</button><button class="text-btn" id="rcReset">Restablecer</button><button class="text-btn" id="rcGray">Grises</button></div></div>
      <div class="rc-right"><div class="rc-head"><span>Actual</span><span></span><span>Nuevo</span></div><div id="rcRows"></div></div></div>
      <div class="dlg-foot"><button data-cancel>Cancelar</button><button class="primary" data-ok>Aceptar</button></div></div>`;
    document.body.appendChild(back); Dialog.isOpen = true;
    const q = s => back.querySelector(s);
    const final = r => { const o = hexToRgb(r.to), h = rgbToHsv(o.r, o.g, o.b);
      const v = hsvToRgb((h.h + st.hue + 360) % 360, clamp(h.s * (1 + st.sat / 100), 0, 1), clamp(h.v * (1 + st.bri / 100), 0, 1)); return rgbToHex(v.r, v.g, v.b); };
    const preview = () => { const map = Object.fromEntries(rows.map(r => [r.from, final(r)])); refs.forEach(r => this.write(r, map[r.c])); Selection.draw(); };
    const W = q('#rcWheel'), ctx = W.getContext('2d'), R = 100, C = 110;
    const wheelImg = (() => { const img = ctx.createImageData(220, 220);
      for (let y = 0; y < 220; y++) for (let x = 0; x < 220; x++) { const dx = x - C, dy = y - C, d = Math.hypot(dx, dy); if (d > R) continue;
        const c = hsvToRgb((Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, d / R, 1), i = (y * 220 + x) * 4; img.data[i] = c.r; img.data[i + 1] = c.g; img.data[i + 2] = c.b; img.data[i + 3] = 255; }
      return img; })();
    const pos = r => { const o = hexToRgb(final(r)), h = rgbToHsv(o.r, o.g, o.b), a = h.h * Math.PI / 180; return { x: C + Math.cos(a) * h.s * R, y: C + Math.sin(a) * h.s * R }; };
    const drawWheel = () => {
      ctx.clearRect(0, 0, 220, 220); ctx.putImageData(wheelImg, 0, 0);
      rows.forEach((r, i) => { const p = pos(r); ctx.beginPath(); ctx.moveTo(C, C); ctx.lineTo(p.x, p.y); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(p.x, p.y, i === 0 ? 8 : 6, 0, Math.PI * 2); ctx.fillStyle = final(r); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); });
    };
    const renderRows = () => {
      const box = q('#rcRows'); box.innerHTML = '';
      rows.forEach(r => {
        const d = document.createElement('div'); d.className = 'rc-row';
        d.innerHTML = `<span class="rc-chip" style="background:${r.from}" title="${r.from} · ${counts[r.from]} uso(s)"></span><span class="rc-arrow">→</span><input type="color" value="${final(r)}">`;
        d.querySelector('input').oninput = e => { r.to = e.target.value; st.hue = st.sat = st.bri = 0; q('#rcHue').value = q('#rcSat').value = q('#rcBri').value = 0; update(false); };
        box.appendChild(d);
      });
    };
    const update = (rowsToo = true) => { preview(); drawWheel(); if (rowsToo) renderRows(); else q('#rcRows').querySelectorAll('input').forEach((inp, i) => { inp.value = final(rows[i]); }); };
    /* arrastrar en la rueda: con armonía vinculada gira y satura todos los colores a la vez */
    let drag = null;
    W.onpointerdown = e => {
      const r0 = W.getBoundingClientRect(), p = { x: e.clientX - r0.left, y: e.clientY - r0.top };
      let best = -1, bd = 14; rows.forEach((r, i) => { const d = Geo.dist(pos(r), p); if (d < bd) { bd = d; best = i; } }); if (best < 0) return;
      W.setPointerCapture(e.pointerId); const o = pos(rows[best]);
      drag = { i: best, a0: Math.atan2(o.y - C, o.x - C), d0: Math.hypot(o.x - C, o.y - C) || 1, base: rows.map(r => r.to) };
    };
    W.onpointermove = e => {
      if (!drag) return;
      const r0 = W.getBoundingClientRect(), p = { x: e.clientX - r0.left - C, y: e.clientY - r0.top - C };
      const da = (Math.atan2(p.y, p.x) - drag.a0) * 180 / Math.PI, ks = Math.min(R, Math.hypot(p.x, p.y)) / drag.d0;
      rows.forEach((r, i) => {
        if (!q('#rcLink').checked && i !== drag.i) return;
        const o = hexToRgb(drag.base[i]), h = rgbToHsv(o.r, o.g, o.b), v = hsvToRgb((h.h + da + 360) % 360, clamp(h.s * ks, 0, 1), h.v); r.to = rgbToHex(v.r, v.g, v.b);
      });
      update(false);
    };
    W.onpointerup = () => { drag = null; };
    for (const [id, k] of [['#rcHue', 'hue'], ['#rcSat', 'sat'], ['#rcBri', 'bri']]) q(id).oninput = e => { st[k] = +e.target.value; update(false); };
    q('#rcShuffle').onclick = () => { const cs = rows.map(r => r.to); for (let i = cs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cs[i], cs[j]] = [cs[j], cs[i]]; } rows.forEach((r, i) => r.to = cs[i]); update(); };
    q('#rcReset').onclick = () => { rows.forEach(r => r.to = r.from); Object.assign(st, { hue: 0, sat: 0, bri: 0 }); q('#rcHue').value = q('#rcSat').value = q('#rcBri').value = 0; update(); };
    q('#rcGray').onclick = () => { rows.forEach(r => { const o = hexToRgb(r.to), g = 0.299 * o.r + 0.587 * o.g + 0.114 * o.b; r.to = rgbToHex(g, g, g); }); update(); };
    const close = ok => {
      back.remove(); Dialog.isOpen = false;
      if (!ok) { refs.forEach(r => this.write(r, r.c)); Selection.draw(); return; }
      preview(); History.named('Volver a colorear ilustración', () => History.commit()); Selection.changed();
    };
    q('[data-ok]').onclick = () => close(true); q('[data-cancel]').onclick = () => close(false);
    back.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(false); if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') close(true); });
    update(); q('[data-ok]').focus();
  },
};

/* ---------- Imprimir ---------- */
const PAPERS = { auto: ['Igual que la mesa de trabajo'], a4: ['A4', 595.28, 841.89], letter: ['Carta', 612, 792], a3: ['A3', 841.89, 1190.55], legal: ['Legal', 612, 1008], tabloid: ['Tabloide', 792, 1224] };
const Print = {
  async dialog() {
    const v = await Dialog.form('Imprimir', [
      { id: 'abs', label: 'Mesas de trabajo', type: 'select', value: 'all', options: [['all', `Todas (${Artboards.count()})`], ['active', 'Solo la activa']] },
      { id: 'paper', label: 'Tamaño de papel', type: 'select', value: 'auto', options: Object.entries(PAPERS).map(([k, p]) => [k, p[0]]) },
      { id: 'orient', label: 'Orientación', type: 'select', value: 'auto', options: [['auto', 'Automática'], ['portrait', 'Vertical'], ['landscape', 'Horizontal']], show: x => x.paper !== 'auto' },
      { id: 'scale', label: 'Escala', type: 'select', value: 'fit', options: [['fit', 'Ajustar a la página'], ['100', '100 %']], show: x => x.paper !== 'auto' },
      { id: 'h1', label: 'Marcas y sangrado', type: 'heading' },
      { id: 'marks', label: 'Marcas de recorte', type: 'checkbox', value: false },
      { id: 'reg', label: 'Marcas de registro', type: 'checkbox', value: false },
      { id: 'info', label: 'Información de página', type: 'checkbox', value: false },
      { id: 'bleed', label: `Usar sangrado del documento (${App.doc.bleed || 0} px)`, type: 'checkbox', value: !!App.doc.bleed },
    ], { ok: 'Imprimir', note: 'Se abrirá el cuadro de impresión del sistema; desde él también puedes guardar como PDF.' });
    if (!v) return;
    this.run(v);
  },
  run(v) {
    const abs = v.abs === 'active' ? [Artboards.active()] : Artboards.list();
    const bl = v.bleed ? App.doc.bleed || 0 : 0, M = v.marks || v.reg || v.info ? 36 : 0, pages = [];
    let pageCss = '';
    abs.forEach((ab, i) => {
      const box = { x: ab.x - bl, y: ab.y - bl, width: ab.width + 2 * bl, height: ab.height + 2 * bl };
      const art = IO.serialize(true, box).replace(/^<\?xml[^>]*>\s*(<!--.*?-->\s*)?/s, '');
      const W = box.width + 2 * M, H = box.height + 2 * M;
      let marks = '';
      if (v.marks) { /* marcas de recorte en las esquinas de la mesa (fuera del sangrado) */
        const x0 = M + bl, y0 = M + bl, x1 = x0 + ab.width, y1 = y0 + ab.height, g = bl + 6, L = 18;
        for (const [x, y, sx, sy] of [[x0, y0, -1, -1], [x1, y0, 1, -1], [x1, y1, 1, 1], [x0, y1, -1, 1]])
          marks += `<path d="M${x + sx * g} ${y}h${sx * L}M${x} ${y + sy * g}v${sy * L}" stroke="#000" stroke-width="0.5" fill="none"/>`;
      }
      if (v.reg) for (const [x, y] of [[W / 2, M / 2], [W / 2, H - M / 2], [M / 2, H / 2], [W - M / 2, H / 2]])
        marks += `<g stroke="#000" stroke-width="0.5" fill="none"><circle cx="${x}" cy="${y}" r="6"/><circle cx="${x}" cy="${y}" r="3"/><path d="M${x - 10} ${y}h20M${x} ${y - 10}v20"/></g>`;
      if (v.info) marks += `<text x="${M}" y="${H - 8}" font-family="Arial" font-size="8" fill="#000">${App.doc.title.replace(/</g, '&lt;')} · ${ab.name.replace(/</g, '&lt;')} · ${new Date().toLocaleString()}</text>`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${marks}<svg x="${M}" y="${M}" width="${box.width}" height="${box.height}" viewBox="0 0 ${box.width} ${box.height}" overflow="hidden">${art.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</svg></svg>`;
      /* tamaño de página */
      let pw = W, ph = H;
      if (v.paper !== 'auto') { const [, a, b] = PAPERS[v.paper], land = v.orient === 'landscape' || (v.orient === 'auto' && W > H); [pw, ph] = land ? [b * 96 / 72, a * 96 / 72] : [a * 96 / 72, b * 96 / 72]; }
      const k = v.paper === 'auto' || v.scale === 'fit' ? Math.min(pw / W, ph / H) : 1;
      pageCss += `@page p${i}{size:${pw}px ${ph}px;margin:0}`;
      pages.push(`<div class="pg" style="page:p${i};width:${pw}px;height:${ph}px"><div style="width:${W * k}px;height:${H * k}px">${svg.replace('<svg ', `<svg style="width:100%;height:100%" `)}</div></div>`);
    });
    const win = window.open('', '_blank');
    if (!win) return Dialog.alert('El navegador bloqueó la ventana emergente. Permítela para imprimir.');
    win.document.write(`<!doctype html><html><head><title>${App.doc.title.replace(/</g, '&lt;')}</title><style>${pageCss}
      html,body{margin:0;background:#fff}.pg{display:flex;align-items:center;justify-content:center;overflow:hidden;break-after:page}.pg:last-child{break-after:auto}</style></head><body>${pages.join('')}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  },
};

const ColorX = { init() { GlobalSwatches.init(); if (App.doc.colorMode === 'cmyk') { App.colorMode = 'cmyk'; $('pcMode').value = 'cmyk'; Panels.applyColorMode(); } } };
