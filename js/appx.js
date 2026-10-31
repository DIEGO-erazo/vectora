/* Vectora — aplicación: atajos de teclado personalizables, scripts (automatización con
   JavaScript) y comprobación de actualizaciones */
'use strict';

/* ---------- atajos de teclado ---------- */
const KeyShortcuts = {
  load() { try { return JSON.parse(localStorage.getItem('vectora-keys') || '{}'); } catch (e) { return {}; } },
  save(o) { try { localStorage.setItem('vectora-keys', JSON.stringify(o)); } catch (e) { /* sin almacenamiento */ } },
  /* valores de fábrica, para poder restablecer */
  defaults: null,
  snapshotDefaults() {
    if (this.defaults) return;
    this.defaults = { menus: {}, tools: {} };
    for (const [m, items] of Object.entries(MENUS)) for (const it of items) if (it !== '-') this.defaults.menus[`${m}/${it[0]}`] = it[1];
    for (const [id, v] of Object.entries(TOOL_INFO)) this.defaults.tools[id] = v[1];
  },
  /* aplica los atajos guardados a los menús y herramientas (antes de construirlos) */
  apply(o = this.load()) {
    this.snapshotDefaults();
    for (const [m, items] of Object.entries(MENUS)) for (const it of items) if (it !== '-') { const k = `${m}/${it[0]}`; it[1] = k in o ? o[k] : this.defaults.menus[k]; }
    for (const id of Object.keys(TOOL_INFO)) { const k = `tool:${id}`; TOOL_INFO[id][1] = k in o ? o[k] : this.defaults.tools[id]; }
  },
  rebuild() {
    Menus.shortcuts = [];
    for (const items of Object.values(MENUS)) for (const it of items) if (it !== '-' && it[1]) Menus.shortcuts.push({ combo: Menus.parse(it[1]), fn: () => History.named(it[0].split(' ▸ ').pop().replace('…', ''), it[2]) });
  },
  /* texto de una combinación pulsada: Ctrl+Shift+K */
  combo(ev) {
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(ev.key)) return null;
    let k = ev.key.length === 1 ? ev.key.toUpperCase() : ev.key;
    if (/^Digit\d$/.test(ev.code)) k = ev.code.slice(5);
    if (ev.code === 'BracketLeft') k = '['; if (ev.code === 'BracketRight') k = ']';
    if (k === ' ') k = 'Space';
    return [ev.ctrlKey || ev.metaKey ? 'Ctrl' : '', ev.altKey ? 'Alt' : '', ev.shiftKey ? 'Shift' : '', k].filter(Boolean).join('+');
  },
  dialog() {
    const o = { ...this.load() };
    const cur = key => (key in o ? o[key] : key.startsWith('tool:') ? this.defaults.tools[key.slice(5)] : this.defaults.menus[key]) || '';
    const back = document.createElement('div'); back.className = 'dlg-back';
    back.innerHTML = `<div class="dlg ks-dlg"><div class="dlg-title">Atajos de teclado</div><div class="dlg-body">
      <div class="ks-top"><select id="ksSet"><option value="menus">Comandos de menú</option><option value="tools">Herramientas</option></select><input type="text" id="ksFind" placeholder="Buscar comando…"></div>
      <div id="ksList" class="ks-list"></div><div class="dlg-note" id="ksNote">Haz clic en un atajo y pulsa la nueva combinación. Supr lo borra, Esc cancela.</div></div>
      <div class="dlg-foot"><button id="ksReset">Restablecer todo</button><button data-cancel>Cancelar</button><button class="primary" data-ok>Aceptar</button></div></div>`;
    document.body.appendChild(back); Dialog.isOpen = true;
    const q = s => back.querySelector(s);
    const rows = () => q('#ksSet').value === 'tools'
      ? Object.entries(TOOL_INFO).filter(([id]) => App.tools[id]).map(([id, v]) => ({ key: `tool:${id}`, label: v[0] }))
      : Object.entries(MENUS).flatMap(([m, items]) => items.filter(it => it !== '-').map(it => ({ key: `${m}/${it[0]}`, label: `${m} ▸ ${it[0]}` })));
    const used = () => { const u = {}; for (const r of [...rows()]) { const c = cur(r.key); if (c) (u[c] ||= []).push(r.label); } return u; };
    const render = () => {
      const f = q('#ksFind').value.trim().toLowerCase(), box = q('#ksList'), U = used(); box.innerHTML = '';
      for (const r of rows().filter(r => !f || r.label.toLowerCase().includes(f))) {
        const d = document.createElement('div'), c = cur(r.key); d.className = 'ks-row' + (c && U[c].length > 1 ? ' clash' : '');
        d.innerHTML = `<span></span><button class="ks-key"></button>`; d.firstChild.textContent = r.label; d.lastChild.textContent = c || '—';
        if (c && U[c].length > 1) d.title = 'Atajo repetido: ' + U[c].join(', ');
        d.lastChild.onclick = () => {
          const b = d.lastChild; b.textContent = 'Pulsa una tecla…'; b.classList.add('wait');
          const onKey = e => {
            e.preventDefault(); e.stopPropagation();
            if (e.key === 'Escape') { cleanup(); render(); return; }
            if (e.key === 'Delete' || e.key === 'Backspace') { o[r.key] = ''; cleanup(); render(); return; }
            let c = this.combo(e); if (!c) return;
            if (r.key.startsWith('tool:')) c = (e.shiftKey ? 'Mayús+' : '') + c.split('+').pop();
            o[r.key] = c; cleanup(); render();
          };
          const cleanup = () => document.removeEventListener('keydown', onKey, true);
          document.addEventListener('keydown', onKey, true);
        };
        box.appendChild(d);
      }
    };
    q('#ksSet').onchange = render; q('#ksFind').oninput = render;
    q('#ksReset').onclick = () => { for (const k of Object.keys(o)) delete o[k]; render(); };
    const close = ok => {
      back.remove(); Dialog.isOpen = false; if (!ok) return;
      this.save(o); this.apply(o); this.rebuild();
      Dialog.alert('Atajos guardados. Los de las herramientas se aplican al volver a abrir Vectora.');
    };
    q('[data-ok]').onclick = () => close(true); q('[data-cancel]').onclick = () => close(false);
    back.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape' && e.target.id !== 'ksFind') close(false); });
    render(); q('#ksFind').focus();
  },
};
KeyShortcuts.apply();

/* ---------- scripts ---------- */
const SCRIPT_SAMPLES = {
  'Círculos al azar': `// Dibuja 30 círculos de colores al azar sobre la mesa de trabajo activa
const ab = vectora.artboard();
for (let i = 0; i < 30; i++) {
  const r = 5 + Math.random() * 30;
  vectora.add('circle', { cx: ab.x + Math.random() * ab.width, cy: ab.y + Math.random() * ab.height, r,
    fill: \`hsl(\${Math.random() * 360} 70% 60%)\` });
}`,
  'Numerar la selección': `// Pone un número encima de cada objeto seleccionado (de arriba abajo e izquierda a derecha)
const items = vectora.selection().map(e => ({ e, b: vectora.bbox(e) })).sort((a, b) => a.b.y - b.b.y || a.b.x - b.b.x);
items.forEach(({ b }, i) => vectora.text(String(i + 1), b.x + b.width / 2, b.y - 6, { 'font-size': 14, 'text-anchor': 'middle' }));`,
  'Cuadrícula de copias': `// Repite el primer objeto seleccionado en una cuadrícula de 5 × 4
const src = vectora.selection()[0];
if (!src) throw new Error('Selecciona un objeto');
const b = vectora.bbox(src), gap = 10;
for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) if (r || c) vectora.copy(src, c * (b.width + gap), r * (b.height + gap));`,
  'Colores al azar': `// Da un color de relleno al azar a cada objeto seleccionado
for (const e of vectora.selection()) vectora.style(e, 'fill', \`hsl(\${Math.random() * 360} 65% 55%)\`);`,
};
const Scripts = {
  saved() { try { return JSON.parse(localStorage.getItem('vectora-scripts') || '[]'); } catch (e) { return []; } },
  store(list) { try { localStorage.setItem('vectora-scripts', JSON.stringify(list)); } catch (e) { /* sin almacenamiento */ } },
  /* API sencilla para los scripts */
  api() {
    const made = [];
    const api = {
      App, Selection, History, Layers, PathData, Geo, svgEl, uid,
      selection: () => [...App.selection],
      select: els => Selection.set(els),
      artboard: () => ({ ...Artboards.active() }),
      bbox: e => Geo.bbox(e),
      add(tag, attrs = {}) { const e = addObject(svgEl(tag, attrs)); if (e) made.push(e); return e; },
      path(d, attrs = {}) { return api.add('path', { fill: App.fill, stroke: App.stroke, ...attrs, d }); },
      text(s, x, y, attrs = {}) { const e = api.add('text', { x, y, fill: '#000000', 'font-family': 'Arial', 'font-size': 16, ...attrs }); if (e) { e.textContent = s; e.setAttribute('data-name', s.slice(0, 30)); } return e; },
      copy(e, dx = 0, dy = 0) { const c = cloneWithIds(e); e.after(c); Geo.applyDoc(c, new DOMMatrix().translate(dx, dy)); normalizeTransform(c); made.push(c); return c; },
      style(e, prop, v) { setStyle([e], prop, v); },
      move(e, dx, dy) { Geo.applyDoc(e, new DOMMatrix().translate(dx, dy)); normalizeTransform(e); },
      alert: m => Dialog.alert(String(m)),
      log: (...a) => console.log('[script]', ...a),
    };
    return { api, made };
  },
  run(code, name = 'Script') {
    const { api, made } = this.api();
    try {
      History.named(name, () => { new Function('vectora', '"use strict";\n' + code)(api); });
      if (made.length && !App.selection.some(e => made.includes(e))) Selection.set(made.filter(e => e.isConnected));
      History.named(name, () => History.commit()); App.emit('layers'); Selection.draw();
      return true;
    } catch (e) {
      made.forEach(x => x.remove()); Selection.draw();
      Dialog.alert(`Error en el script «${name}»:\n${e.message}`); return false;
    }
  },
  openFile() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.js,.txt';
    inp.onchange = async () => { const f = inp.files[0]; if (f) this.run(await f.text(), f.name.replace(/\.\w+$/, '')); };
    inp.click();
  },
  console(initial) {
    const list = this.saved();
    const back = document.createElement('div'); back.className = 'dlg-back';
    back.innerHTML = `<div class="dlg sc-dlg"><div class="dlg-title">Scripts</div><div class="dlg-body">
      <div class="ks-top"><select id="scPick"><option value="">— Ejemplos y scripts guardados —</option>
        <optgroup label="Ejemplos">${Object.keys(SCRIPT_SAMPLES).map(n => `<option value="s:${n}">${n}</option>`).join('')}</optgroup>
        <optgroup label="Mis scripts">${list.map((s, i) => `<option value="u:${i}">${s.name.replace(/</g, '&lt;')}</option>`).join('')}</optgroup></select>
        <input type="text" id="scName" placeholder="Nombre" value="Mi script"></div>
      <textarea id="scCode" spellcheck="false"></textarea>
      <div class="dlg-note">API: vectora.selection(), add(tag, attrs), path(d), text(s, x, y), copy(obj, dx, dy), move(obj, dx, dy), style(obj, prop, valor), bbox(obj), artboard(), select(lista), alert(msg). Todo el script se deshace con un solo Ctrl+Z.</div></div>
      <div class="dlg-foot"><button id="scDel">Eliminar</button><button id="scSave">Guardar</button><button data-cancel>Cerrar</button><button class="primary" id="scRun">Ejecutar</button></div></div>`;
    document.body.appendChild(back); Dialog.isOpen = true;
    const q = s => back.querySelector(s), ta = q('#scCode');
    ta.value = initial || SCRIPT_SAMPLES['Círculos al azar'];
    q('#scPick').onchange = e => { const v = e.target.value; if (!v) return; if (v[0] === 's') { ta.value = SCRIPT_SAMPLES[v.slice(2)]; q('#scName').value = v.slice(2); } else { const s = this.saved()[+v.slice(2)]; ta.value = s.code; q('#scName').value = s.name; } };
    q('#scSave').onclick = () => { const L = this.saved(), n = q('#scName').value.trim() || 'Script', i = L.findIndex(s => s.name === n); if (i >= 0) L[i].code = ta.value; else L.push({ name: n, code: ta.value }); this.store(L); q('#scSave').textContent = 'Guardado ✓'; setTimeout(() => { q('#scSave').textContent = 'Guardar'; }, 1200); };
    q('#scDel').onclick = () => { const n = q('#scName').value.trim(); this.store(this.saved().filter(s => s.name !== n)); back.remove(); Dialog.isOpen = false; this.console(ta.value); };
    const close = () => { back.remove(); Dialog.isOpen = false; };
    q('#scRun').onclick = () => { const code = ta.value, name = q('#scName').value.trim() || 'Script'; close(); this.run(code, name); };
    q('[data-cancel]').onclick = close;
    ta.onkeydown = e => { if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); } if (e.key === 'Enter' && e.ctrlKey) q('#scRun').click(); };
    back.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') close(); });
    ta.focus();
  },
  async runSaved() {
    const L = this.saved(); if (!L.length) return Dialog.alert('Aún no hay scripts guardados. Abre Archivo ▸ Scripts ▸ Consola de scripts para crear uno.');
    const v = await Dialog.form('Ejecutar script', [{ id: 'i', label: 'Script', type: 'select', value: 0, options: L.map((s, i) => [i, s.name]) }], { ok: 'Ejecutar' });
    if (v) this.run(L[+v.i].code, L[+v.i].name);
  },
};

/* ---------- actualizaciones ---------- */
const Updates = {
  async check(quiet = false) {
    const pkg = { version: APP_INFO.version }, m = APP_INFO.repo.match(/github\.com\/([^/]+\/[^/.]+)/);
    if (!m) { if (!quiet) Dialog.alert(`Vectora ${pkg.version}.
Para buscar actualizaciones, indica el repositorio en APP_INFO (js/app.js).`); return; }
    try {
      const r = await (await fetch(`https://api.github.com/repos/${m[1]}/releases/latest`)).json(), latest = String(r.tag_name || '').replace(/^v/, '');
      const newer = latest && latest.split('.').map(Number).some((n, i, a) => { const c = pkg.version.split('.').map(Number); for (let j = 0; j < a.length; j++) { if ((a[j] || 0) > (c[j] || 0)) return true; if ((a[j] || 0) < (c[j] || 0)) return false; } return false; });
      if (newer) { if (await Dialog.confirm(`Hay una versión nueva: ${latest} (tienes la ${pkg.version}).\n¿Abrir la página de descarga?`)) window.open(r.html_url, '_blank'); }
      else if (!quiet) Dialog.alert(`Tienes la última versión (${pkg.version}).`);
    } catch (e) { if (!quiet) Dialog.alert('No se pudo comprobar si hay actualizaciones (¿sin conexión?).'); }
  },
};
