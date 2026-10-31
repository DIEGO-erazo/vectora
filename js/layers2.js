/* Vectora — panel Capas: miniaturas, opciones de capa, menú del panel y mover la selección entre capas */
'use strict';

const LayersPanel = {
  /* caja del elemento en el espacio de su padre (lo que dibuja un <use>) */
  parentBox(el) {
    let b; try { b = el.getBBox(); } catch (e) { return null; }
    if (!b || (!b.width && !b.height)) return null;
    const m = Geo.local(el), ps = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => Geo.pt(m, x, y));
    const x = Math.min(...ps.map(p => p.x)), y = Math.min(...ps.map(p => p.y));
    return { x, y, width: Math.max(...ps.map(p => p.x)) - x || 1, height: Math.max(...ps.map(p => p.y)) - y || 1 };
  },
  thumb(el) {
    if (!el.id) el.id = uid();
    const b = el.classList.contains('layer') ? Geo.selBox([...el.children].filter(c => c.tagName !== 'defs')) : this.parentBox(el);
    if (!b) return '<span class="ly-thumb"></span>';
    const pad = Math.max(b.width, b.height) * 0.06;
    return `<svg class="ly-thumb" viewBox="${b.x - pad} ${b.y - pad} ${b.width + 2 * pad} ${b.height + 2 * pad}" preserveAspectRatio="xMidYMid meet"><use href="#${el.id}"/></svg>`;
  },
  render() {
    const P = Panels, list = $('layerList'); list.innerHTML = '';
    const layers = Layers.all().reverse();
    $('lyCount').textContent = `${layers.length} capa${layers.length === 1 ? '' : 's'}`;
    const selSet = new Set(App.selection), selLayers = new Set(App.selection.map(e => Layers.layerOf(e)));
    const row = (el, isLayer, depth) => {
      const r = document.createElement('div');
      const color = (Layers.layerOf(el) || el).getAttribute('data-color'), on = selSet.has(el);
      r.className = 'ly-row' + (isLayer ? '' : ' ly-child') + (isLayer && el === App.activeLayer ? ' active' : '') + (on ? ' selected' : '');
      if (el.hasAttribute('data-template')) r.classList.add('template');
      const hidden = el.getAttribute('display') === 'none', locked = el.getAttribute('data-locked') === '1';
      const canOpen = isLayer || el.tagName === 'g';
      const hasSel = isLayer ? selLayers.has(el) : on;
      r.innerHTML = `<span class="ly-eye ${hidden ? 'off' : ''}" title="Visibilidad (Alt+clic: ocultar las demás)">👁</span><span class="ly-lock ${locked ? 'on' : ''}" title="Bloqueo">${locked ? '🔒' : '·'}</span>
        <span class="ly-color" style="background:${color}"></span>
        <span class="ly-twist" style="margin-left:${depth * 12}px">${canOpen ? (P.expanded.has(el.id) ? '▼' : '▶') : ''}</span>
        ${this.thumb(el)}
        <span class="ly-name"></span>
        <span class="ly-dot ${hasSel ? 'has' : ''}" draggable="${hasSel}" title="${hasSel ? 'Arrastra a otra capa para mover la selección' : 'Seleccionar'}" style="${hasSel ? `background:${color}` : ''}"></span>`;
      r.querySelector('.ly-name').textContent = isLayer ? el.getAttribute('data-name') : objName(el);
      r.querySelector('.ly-eye').onclick = e => {
        e.stopPropagation();
        if (e.altKey && isLayer) { Layers.all().forEach(l => l === el ? l.removeAttribute('display') : l.setAttribute('display', 'none')); }
        else hidden ? el.removeAttribute('display') : el.setAttribute('display', 'none');
        History.named('Visibilidad', () => History.commit()); Selection.draw();
      };
      r.querySelector('.ly-lock').onclick = e => {
        e.stopPropagation(); locked ? el.removeAttribute('data-locked') : el.setAttribute('data-locked', '1');
        if (!locked) Selection.set(App.selection.filter(s => !Layers.isLocked(s))); History.named('Bloqueo', () => History.commit());
      };
      r.querySelector('.ly-twist').onclick = e => { e.stopPropagation(); P.expanded.has(el.id) ? P.expanded.delete(el.id) : P.expanded.add(el.id); this.render(); };
      const dot = r.querySelector('.ly-dot');
      dot.onclick = e => { e.stopPropagation(); if (isLayer) Selection.set([...el.children].filter(c => !Layers.isLocked(c) && c.tagName !== 'defs')); else Selection.set([Layers.topObject(el) || el]); };
      dot.ondragstart = e => { e.stopPropagation(); this.drag = { sel: true }; e.dataTransfer.effectAllowed = 'move'; };
      r.onclick = e => {
        if (isLayer) { App.activeLayer = el; this.render(); return; }
        App.activeLayer = Layers.layerOf(el);
        const top = Layers.topObject(el) || el; if (Layers.isLocked(top)) return;
        e.shiftKey ? Selection.toggle(top) : Selection.set([top]);
      };
      r.ondblclick = e => {
        if (isLayer && !e.target.classList.contains('ly-name')) return this.options(el);
        const n = r.querySelector('.ly-name'), cur = isLayer ? el.getAttribute('data-name') : (el.getAttribute('data-name') || '');
        n.innerHTML = '<input type="text">'; const inp = n.firstChild; inp.value = cur; inp.focus(); inp.select();
        inp.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.value = cur; inp.blur(); } };
        inp.onblur = () => { inp.value ? el.setAttribute('data-name', inp.value) : !isLayer && el.removeAttribute('data-name'); History.named('Renombrar', () => History.commit()); };
      };
      /* arrastrar: reordenar filas, o mover la selección (cuadradito) a otra capa */
      r.draggable = true;
      r.ondragstart = e => { this.drag = { el }; e.dataTransfer.effectAllowed = 'move'; };
      r.ondragover = e => { if (this.drag && this.drag.el !== el) { e.preventDefault(); r.style.boxShadow = 'inset 0 2px 0 #1e90ff'; } };
      r.ondragleave = () => r.style.boxShadow = '';
      r.ondrop = e => {
        e.preventDefault(); r.style.boxShadow = ''; const d = this.drag; this.drag = null; if (!d) return;
        if (d.sel) { const target = isLayer ? el : Layers.layerOf(el); this.moveSelectionTo(target); return; }
        const src = d.el; if (!src || src.contains(el)) return;
        const srcLayer = src.classList.contains('layer');
        if (srcLayer && isLayer) el.after(src); else if (!srcLayer && isLayer) el.appendChild(src); else if (!srcLayer) el.after(src); else return;
        History.named('Reordenar', () => History.commit()); App.emit('layers'); Selection.draw();
      };
      list.appendChild(r);
      if (canOpen && P.expanded.has(el.id)) [...el.children].filter(c => c.tagName !== 'defs').reverse().forEach(c => row(c, false, depth + 1));
    };
    layers.forEach(l => row(l, true, 0));
  },
  moveSelectionTo(layer) {
    if (!layer || Layers.isLocked(layer)) return;
    App.selection.forEach(e => { const m = Geo.toDoc(e); layer.appendChild(e); Geo.setMatrix(e, Geo.toDoc(layer).inverse().multiply(m)); normalizeTransform(e); });
    App.activeLayer = layer; History.named('Mover a capa', () => History.commit()); App.emit('layers'); Selection.draw();
  },
  async options(layer = App.activeLayer) {
    if (!layer) return;
    const v = await Dialog.form('Opciones de capa', [
      { id: 'name', label: 'Nombre', value: layer.getAttribute('data-name') },
      { id: 'color', label: 'Color', type: 'color', value: layer.getAttribute('data-color') || '#4f8cff' },
      { id: 'template', label: 'Plantilla', type: 'checkbox', value: layer.hasAttribute('data-template') },
      { id: 'show', label: 'Mostrar', type: 'checkbox', value: layer.getAttribute('display') !== 'none' },
      { id: 'lock', label: 'Bloquear', type: 'checkbox', value: layer.getAttribute('data-locked') === '1' },
      { id: 'print', label: 'Imprimir / exportar', type: 'checkbox', value: !layer.hasAttribute('data-noprint') },
    ], { note: 'Una capa de plantilla se ve atenuada, queda bloqueada y no se exporta (útil para calcar un boceto).' });
    if (!v) return;
    layer.setAttribute('data-name', v.name.trim() || layer.getAttribute('data-name')); layer.setAttribute('data-color', v.color);
    const flag = (a, on, val = '1') => (on ? layer.setAttribute(a, val) : layer.removeAttribute(a));
    flag('data-template', v.template); flag('display', !v.show, 'none'); flag('data-locked', v.lock || v.template); flag('data-noprint', !v.print || v.template);
    History.named('Opciones de capa', () => History.commit()); App.emit('layers'); Selection.draw();
  },
  duplicate() {
    const l = App.activeLayer; if (!l) return;
    const c = cloneWithIds(l); c.setAttribute('data-name', l.getAttribute('data-name') + ' copia'); l.after(c); App.activeLayer = c;
    History.named('Duplicar capa', () => History.commit()); App.emit('layers');
  },
  mergeDown() {
    const all = Layers.all(), l = App.activeLayer, i = all.indexOf(l); if (i < 1) return;
    const below = all[i - 1]; [...l.children].forEach(c => below.appendChild(c)); l.remove(); App.activeLayer = below;
    History.named('Combinar capas', () => History.commit()); App.emit('layers');
  },
  collect() {
    if (!App.selection.length) return;
    const top = docOrder(App.selection).pop(), host = Layers.layerOf(top), nl = Layers.create(null, true);
    host.after(nl); this.moveSelectionTo(nl);
  },
  /* liberar a capas (secuencia): cada objeto de la capa activa a su propia capa */
  release() {
    const l = App.activeLayer; if (!l) return;
    const kids = [...l.children].filter(c => c.tagName !== 'defs'); if (!kids.length) return;
    let at = l; kids.forEach((k, i) => { const nl = Layers.create(`${l.getAttribute('data-name')} ${i + 1}`, false); at.after(nl); nl.appendChild(k); at = nl; });
    History.named('Liberar a capas', () => History.commit()); App.emit('layers');
  },
  others(attr) {
    const keep = App.activeLayer; Layers.all().forEach(l => { if (l !== keep) l.setAttribute(attr, attr === 'display' ? 'none' : '1'); });
    History.commit(); App.emit('layers'); Selection.draw();
  },
  all(attr) { Layers.all().forEach(l => l.removeAttribute(attr)); History.commit(); App.emit('layers'); Selection.draw(); },
  locate() {
    const el = App.selection[0]; if (!el) return;
    Dock.show('pLayers');
    for (let e = el.parentNode; e && e !== App.els.content; e = e.parentNode) Panels.expanded.add(e.id);
    this.render();
    const row = [...document.querySelectorAll('#layerList .ly-row.selected')][0]; if (row) row.scrollIntoView({ block: 'center' });
  },
  menu(btn) {
    const r = btn.getBoundingClientRect(), pop = $('menuPopup'); Menus.close(); Menus.openMenu = '__ly'; pop.innerHTML = '';
    const items = [['Nueva capa', () => { Layers.create(); History.commit(); }], ['Duplicar capa', () => this.duplicate()], ['Opciones de capa…', () => this.options()], '-',
      ['Combinar con la capa inferior', () => this.mergeDown()], ['Recopilar en capa nueva', () => this.collect()], ['Liberar a capas (secuencia)', () => this.release()], '-',
      ['Localizar objeto', () => this.locate()], ['Ocultar las demás', () => this.others('display')], ['Bloquear las demás', () => this.others('data-locked')],
      ['Mostrar todas', () => this.all('display')], ['Desbloquear todas', () => this.all('data-locked')]];
    for (const it of items) {
      if (it === '-') { pop.insertAdjacentHTML('beforeend', '<div class="menu-sep"></div>'); continue; }
      const row = document.createElement('div'); row.className = 'menu-item'; row.innerHTML = `<span>${it[0]}</span><span></span>`;
      row.onclick = () => { Menus.close(); History.named(it[0].replace('…', ''), it[1]); }; pop.appendChild(row);
    }
    pop.hidden = false; const h = pop.offsetHeight; pop.style.left = Math.max(4, r.right - pop.offsetWidth) + 'px'; pop.style.top = Math.max(4, r.top - h - 4) + 'px';
  },
  init() {
    Panels.renderLayers = () => this.render();
    const foot = $('lyNew').parentNode;
    foot.insertAdjacentHTML('beforeend', '<button id="lyMenu" title="Menú del panel Capas">☰</button>');
    $('lyMenu').onclick = e => { e.stopPropagation(); this.menu($('lyMenu')); };
    $('lyNew').title = 'Nueva capa (Alt+clic: opciones)';
    this.render();
  },
};
