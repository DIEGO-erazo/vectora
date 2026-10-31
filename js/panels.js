/* Vectora — paneles: color, muestras, trazo, alinear, capas y barra de control */
'use strict';

const TAG_NAMES = { path: 'Trazado', rect: 'Rectángulo', ellipse: 'Elipse', circle: 'Elipse', polygon: 'Polígono', polyline: 'Polilínea',
  line: 'Línea', text: 'Texto', g: 'Grupo', image: 'Imagen', use: 'Símbolo' };
const objName = el => el.getAttribute('data-name') || `<${TAG_NAMES[el.tagName] || el.tagName}>`;

const SWATCHES = ['none', '#ffffff', '#000000', '#e6e6e6', '#b3b3b3', '#808080', '#4d4d4d', '#1a1a1a',
  '#ed1c24', '#f15a24', '#f7931e', '#fbb03b', '#fcee21', '#d9e021', '#8cc63f', '#39b54a', '#009245', '#006837',
  '#22b573', '#00a99d', '#29abe2', '#0071bc', '#2e3192', '#1b1464', '#662d91', '#93278f', '#9e005d', '#d4145a',
  '#ed1e79', '#c7b299', '#998675', '#736357', '#534741', '#c69c6d', '#a67c52', '#8c6239', '#754c24', '#603813'];

function paintBox(el, color) {
  el.classList.toggle('none', color === 'none');
  el.style.background = color === 'none' ? '' : color.startsWith('url(') ? 'linear-gradient(90deg,#fff,#000)' : color;
}

const Panels = {
  init() {
    document.querySelectorAll('.panel-head').forEach(h => h.onclick = () => h.parentNode.classList.toggle('collapsed'));
    this.initFillStroke(); this.initColor(); this.initSwatches(); this.initStroke(); this.initControlBar();
    this.initAlign(); this.initPathfinder(); this.initLayers();
    App.on('selection', () => { this.pullFromSelection(); this.refresh(); this.renderLayers(); });
    App.on('colors', () => this.refresh());
    App.on('transform', () => this.refreshControlBar());
    App.on('change', () => { this.refreshControlBar(); this.renderLayers(); });
    App.on('layers', () => this.renderLayers());
    App.on('view', () => Selection.draw());
  },

  /* ----- color actual <-> selección ----- */
  pullFromSelection() {
    const el = App.selection[0]; if (!el) return;
    const f = getStyle(el, 'fill'), s = getStyle(el, 'stroke'), w = getStyle(el, 'stroke-width');
    if (el.tagName === 'image') return;
    App.fill = f == null ? '#000000' : normColor(f);
    App.stroke = s == null ? 'none' : normColor(s);
    App.strokeWidth = w == null ? 1 : +w;
  },
  setColor(which, value, commit = true) {
    App[which] = value;
    if (commit && /^#[0-9a-f]{6}$/i.test(value)) Swatches.pushRecent(value);
    if (App.selection.length) {
      setStyle(App.selection, which, value);
      if (which === 'stroke') Arrows.recolor(App.selection);
      if (commit) History.named(which === 'fill' ? 'Relleno' : 'Trazo', () => History.commit());
      Selection.draw();
    }
    this.refresh();
  },
  setStrokeAttr(attr, value) {
    if (attr === 'stroke-width') App.strokeWidth = +value;
    if (App.selection.length) { setStyle(App.selection, attr, value); History.named('Trazo', () => History.commit()); Selection.draw(); }
    this.refresh();
  },

  initFillStroke() {
    const front = w => { App.activeFS = w; this.refresh(); };
    $('fsFill').onclick = $('pcFill').onclick = () => front('fill');
    $('fsStroke').onclick = $('pcStroke').onclick = () => front('stroke');
    $('fsSwap').onclick = () => Actions.swapFS();
    $('fsDefault').onclick = () => Actions.defaultFS();
    $('fsNone').onclick = () => this.setColor(App.activeFS, 'none');
    $('cbFill').onclick = () => { front('fill'); $('pcPicker').click(); };
    $('cbStroke').onclick = () => { front('stroke'); $('pcPicker').click(); };
  },

  initColor() {
    const cur = () => App[App.activeFS];
    $('pcPicker').oninput = e => this.setColor(App.activeFS, e.target.value, false);
    $('pcPicker').onchange = e => { Swatches.pushRecent(e.target.value); History.commit(); };
    $('pcHex').onchange = e => { const v = normColor(e.target.value); this.setColor(App.activeFS, v); };
    for (const c of ['R', 'G', 'B']) {
      $('pc' + c).oninput = () => this.setColor(App.activeFS, this.slidersToHex(), false);
      $('pc' + c).onchange = () => History.commit();
    }
    $('pcMode').onchange = e => { App.colorMode = e.target.value; this.applyColorMode(); this.refresh(); };
    this.applyColorMode();
    const spec = $('pcSpectrum');
    const pick = e => {
      const r = spec.getBoundingClientRect(), h = clamp((e.clientX - r.left) / r.width, 0, 1) * 360, v = 1 - clamp((e.clientY - r.top) / r.height, 0, 1);
      const c = hsvToRgb(h, 1, v); this.setColor(App.activeFS, rgbToHex(c.r, c.g, c.b), false);
    };
    spec.onpointerdown = e => { spec.setPointerCapture(e.pointerId); pick(e); spec.onpointermove = pick; };
    spec.onpointerup = () => { spec.onpointermove = null; History.commit(); };
    void cur;
  },

  /* deslizadores en modo RGB (0-255) o HSB (0-360 / 0-100 / 0-100) */
  applyColorMode() {
    const hsb = App.colorMode === 'hsb', labels = hsb ? ['H', 'S', 'B'] : ['R', 'G', 'B'], max = hsb ? [360, 100, 100] : [255, 255, 255];
    ['R', 'G', 'B'].forEach((c, i) => { $('pcL' + i).textContent = labels[i]; $('pc' + c).max = max[i]; });
  },
  slidersToHex() {
    const a = +$('pcR').value, b = +$('pcG').value, c = +$('pcB').value;
    if (App.colorMode !== 'hsb') return rgbToHex(a, b, c);
    const rgb = hsvToRgb(a, b / 100, c / 100); return rgbToHex(rgb.r, rgb.g, rgb.b);
  },
  initSwatches() {
    const g = $('swatchGrid');
    for (const c of SWATCHES) {
      const s = document.createElement('div'); s.className = 'sw'; s.title = c === 'none' ? 'Ninguno' : c; paintBox(s, c);
      s.onclick = () => this.setColor(App.activeFS, c);
      g.appendChild(s);
    }
  },

  initStroke() {
    $('psWidth').onchange = $('cbStrokeW').onchange = e => this.setStrokeAttr('stroke-width', Math.max(0, +e.target.value));
    $('psCap').onchange = e => this.setStrokeAttr('stroke-linecap', e.target.value);
    $('psJoin').onchange = e => this.setStrokeAttr('stroke-linejoin', e.target.value);
    $('psDash').onchange = e => this.setStrokeAttr('stroke-dasharray', e.target.value.trim() || null);
  },

  refresh() {
    const fsFront = App.activeFS;
    for (const [f, s] of [['fsFill', 'fsStroke'], ['pcFill', 'pcStroke']]) {
      paintBox($(f), App.fill); paintBox($(s), App.stroke);
      $(f).classList.toggle('front', fsFront === 'fill'); $(s).classList.toggle('front', fsFront === 'stroke');
      $(f).style.zIndex = fsFront === 'fill' ? 3 : 1; $(s).style.zIndex = fsFront === 'stroke' ? 3 : 1;
    }
    paintBox($('cbFill'), App.fill); paintBox($('cbStroke'), App.stroke);
    const c = App[App.activeFS], hex = c.startsWith('#') ? c : '#000000';
    $('pcPicker').value = hex; $('pcHex').value = c === 'none' ? 'ninguno' : c.startsWith('url(') ? 'degradado' : c;
    const rgb = hexToRgb(hex), hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    const vals = App.colorMode === 'hsb' ? [Math.round(hsv.h), Math.round(hsv.s * 100), Math.round(hsv.v * 100)] : [rgb.r, rgb.g, rgb.b];
    const dragging = ['pcR', 'pcG', 'pcB'].includes(document.activeElement && document.activeElement.id);
    ['R', 'G', 'B'].forEach((c, i) => { if (!dragging) $('pc' + c).value = vals[i]; $('pc' + c + 'v').textContent = dragging ? $('pc' + c).value : vals[i]; });
    $('psWidth').value = $('cbStrokeW').value = App.strokeWidth;
    const el = App.selection[0];
    $('psCap').value = (el && getStyle(el, 'stroke-linecap')) || 'butt';
    $('psJoin').value = (el && getStyle(el, 'stroke-linejoin')) || 'miter';
    $('psDash').value = (el && getStyle(el, 'stroke-dasharray')) || '';
    this.refreshControlBar();
  },

  /* ----- barra de control: posición, tamaño, rotación, opacidad ----- */
  initControlBar() {
    /* mismos campos que el panel Transformar, con su punto de referencia */
    for (const [id, f] of [['cbX', 'x'], ['cbY', 'y'], ['cbW', 'w'], ['cbH', 'h'], ['cbRot', 'rot']])
      $(id).onchange = e => Xf.set(f, f === 'rot' ? +e.target.value : Units.fromU(+e.target.value));
    $('cbOpacity').onchange = e => {
      const v = clamp(+e.target.value, 0, 100) / 100;
      App.selection.forEach(el => v === 1 ? el.removeAttribute('opacity') : el.setAttribute('opacity', v));
      if (App.selection.length) History.commit();
    };
  },
  refreshControlBar() {
    const s = App.selection, b = s.length ? Selection.box() : null, a = b && Xf.point(b);
    $('cbSelLabel').textContent = !s.length ? 'Sin selección' : s.length === 1 ? objName(s[0]).replace(/[<>]/g, '') : `${s.length} objetos`;
    for (const [id, v] of [['cbX', a && a.x], ['cbY', a && a.y], ['cbW', b && b.width], ['cbH', b && b.height]])
      if (document.activeElement !== $(id)) $(id).value = v == null ? '' : Units.fmt(v);
    $('cbUnit').textContent = Units.u;
    if (document.activeElement !== $('cbRot')) $('cbRot').value = s.length === 1 ? round(Geo.angle(s[0]), 1) : '';
    if (document.activeElement !== $('cbOpacity')) $('cbOpacity').value = s.length ? round((+(s[0].getAttribute('opacity') ?? 1)) * 100, 0) : 100;
  },

  /* ----- alinear ----- */
  initAlign() {
    const I = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
    const btns = [
      ['Alinear objetos', null],
      ['left', 'Izquierda', I('<path d="M4 3v18"/><rect class="f" x="6" y="6" width="12" height="4"/><rect class="f" x="6" y="14" width="7" height="4"/>')],
      ['hcenter', 'Centro horizontal', I('<path d="M12 3v18"/><rect class="f" x="5" y="6" width="14" height="4"/><rect class="f" x="8" y="14" width="8" height="4"/>')],
      ['right', 'Derecha', I('<path d="M20 3v18"/><rect class="f" x="6" y="6" width="12" height="4"/><rect class="f" x="11" y="14" width="7" height="4"/>')],
      ['top', 'Arriba', I('<path d="M3 4h18"/><rect class="f" x="6" y="6" width="4" height="12"/><rect class="f" x="14" y="6" width="4" height="7"/>')],
      ['vcenter', 'Centro vertical', I('<path d="M3 12h18"/><rect class="f" x="6" y="5" width="4" height="14"/><rect class="f" x="14" y="8" width="4" height="8"/>')],
      ['bottom', 'Abajo', I('<path d="M3 20h18"/><rect class="f" x="6" y="6" width="4" height="12"/><rect class="f" x="14" y="11" width="4" height="7"/>')],
      ['Distribuir objetos', null],
      ['disth', 'Distribuir horizontalmente', I('<rect class="f" x="3" y="7" width="4" height="10"/><rect class="f" x="10" y="7" width="4" height="10"/><rect class="f" x="17" y="7" width="4" height="10"/>')],
      ['distv', 'Distribuir verticalmente', I('<rect class="f" x="7" y="3" width="10" height="4"/><rect class="f" x="7" y="10" width="10" height="4"/><rect class="f" x="7" y="17" width="10" height="4"/>')],
    ];
    const box = $('alignBtns');
    for (const b of btns) {
      if (b[1] === null) { box.insertAdjacentHTML('beforeend', `<div class="btn-group-label">${b[0]}</div>`); continue; }
      const el = document.createElement('button'); el.className = 'icon-btn'; el.title = b[1]; el.innerHTML = b[2];
      el.onclick = () => History.named(b[1], () => Actions.align(b[0])); box.appendChild(el);
    }
    box.insertAdjacentHTML('beforeend', '<div class="btn-group-label" id="alignTo">Con un objeto se alinea a la mesa de trabajo</div>');
  },

  initPathfinder() {
    const I = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
    const btns = [
      ['Modos de forma', null],
      ['unite', 'Unificar', I('<path class="f" d="M3 3h11v5h7v13H8v-5H3z"/>')],
      ['minus', 'Menos frente', I('<path class="f" d="M3 3h11v5H8v8H3z"/><path d="M8 8h13v13H8z"/>')],
      ['intersect', 'Intersecar', I('<path d="M3 3h11v13H3zM8 8h13v13H8z"/><path class="f" d="M8 8h6v8H8z"/>')],
      ['exclude', 'Excluir', I('<path class="f" d="M3 3h11v5H8v8H3zM14 8h7v13H8v-5h6z"/>')],
      ['Buscatrazos', null],
      ['divide', 'Dividir', I('<path d="M3 3h11v13H3zM8 8h13v13H8z"/><path d="M8 8h6v8H8z" class="f" opacity=".5"/>')],
      ['trim', 'Recortar', I('<path class="f" d="M3 3h11v5H8v8H3z"/><path class="f" d="M8 8h13v13H8z" opacity=".55"/>')],
      ['merge', 'Combinar', I('<path class="f" d="M3 3h11v5h7v13H8v-5H3z" opacity=".8"/>')],
      ['crop', 'Cortar', I('<path d="M3 3h11v13H3z" stroke-dasharray="2 2"/><path class="f" d="M8 8h6v8H8z"/><path d="M8 8h13v13H8z"/>')],
      ['outline', 'Contorno', I('<path d="M3 3h11v13H3zM8 8h13v13H8z"/>')],
      ['minusBack', 'Menos fondo', I('<path d="M3 3h11v13H3z"/><path class="f" d="M14 8h7v13H8v-5h6z"/>')],
      ['Trazado compuesto', null],
      ['compound', 'Crear trazado compuesto (Ctrl+8)', I('<path class="f" fill-rule="evenodd" d="M3 3h18v18H3zM8 8v8h8V8z"/>')],
      ['release', 'Liberar trazado compuesto', I('<path d="M3 3h18v18H3zM8 8v8h8V8z"/>')],
    ];
    const box = $('pathfinderBtns');
    for (const b of btns) {
      if (b[1] === null) { box.insertAdjacentHTML('beforeend', `<div class="btn-group-label">${b[0]}</div>`); continue; }
      const el = document.createElement('button'); el.className = 'icon-btn'; el.title = b[1]; el.innerHTML = b[2];
      el.onclick = () => History.named(b[1].replace(/ \(.*\)/, ''), () => Pathfinder.run(b[0])); box.appendChild(el);
    }
  },

  /* ----- capas ----- */
  expanded: new Set(),
  initLayers() {
    $('lyNew').onclick = () => { Layers.create(); History.commit(); };
    $('lyDel').onclick = () => {
      const l = App.activeLayer; if (!l || Layers.all().length < 2) return;
      Selection.set(App.selection.filter(e => Layers.layerOf(e) !== l)); l.remove(); App.activeLayer = null; Layers.ensure();
      History.commit(); App.emit('layers');
    };
  },
  renderLayers() {
    const list = $('layerList'); list.innerHTML = '';
    const layers = Layers.all().reverse();
    $('lyCount').textContent = `${layers.length} capa${layers.length === 1 ? '' : 's'}`;
    const row = (el, isLayer, depth) => {
      const r = document.createElement('div');
      const color = (Layers.layerOf(el) || el).getAttribute('data-color');
      r.className = 'ly-row' + (isLayer ? '' : ' ly-child') + (isLayer && el === App.activeLayer ? ' active' : '') + (App.selection.includes(el) ? ' selected' : '');
      const hidden = el.getAttribute('display') === 'none', locked = el.getAttribute('data-locked') === '1';
      const canOpen = isLayer || el.tagName === 'g';
      r.innerHTML = `<span class="ly-eye ${hidden ? 'off' : ''}" title="Visibilidad">👁</span><span class="ly-lock ${locked ? 'on' : ''}" title="Bloqueo">${locked ? '🔒' : '·'}</span>
        <span class="ly-color" style="background:${color}"></span>
        <span class="ly-twist">${canOpen ? (this.expanded.has(el.id) ? '▼' : '▶') : ''}</span>
        <span class="ly-name" style="padding-left:${depth * 12}px">${isLayer ? el.getAttribute('data-name') : objName(el).replace(/</g, '&lt;')}</span>
        <span class="ly-dot" style="${App.selection.includes(el) ? `background:${color}` : ''}"></span>`;
      r.querySelector('.ly-eye').onclick = e => { e.stopPropagation(); hidden ? el.removeAttribute('display') : el.setAttribute('display', 'none'); History.commit(); Selection.draw(); };
      r.querySelector('.ly-lock').onclick = e => { e.stopPropagation(); locked ? el.removeAttribute('data-locked') : el.setAttribute('data-locked', '1'); if (!locked) Selection.set(App.selection.filter(s => !Layers.isLocked(s))); History.commit(); };
      r.querySelector('.ly-twist').onclick = e => { e.stopPropagation(); this.expanded.has(el.id) ? this.expanded.delete(el.id) : this.expanded.add(el.id); this.renderLayers(); };
      r.querySelector('.ly-dot').onclick = e => { e.stopPropagation(); if (isLayer) Selection.set([...el.children].filter(c => !Layers.isLocked(c))); else Selection.set([el]); };
      r.onclick = e => {
        if (isLayer) { App.activeLayer = el; this.renderLayers(); return; }
        App.activeLayer = Layers.layerOf(el);
        const top = Layers.topObject(el) || el; if (Layers.isLocked(top)) return;
        e.shiftKey ? Selection.toggle(top) : Selection.set([top]);
      };
      r.ondblclick = () => {
        const n = r.querySelector('.ly-name'), cur = isLayer ? el.getAttribute('data-name') : (el.getAttribute('data-name') || '');
        n.innerHTML = `<input type="text" value="${cur.replace(/"/g, '&quot;')}">`; const inp = n.firstChild; inp.focus(); inp.select();
        inp.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') inp.blur(); };
        inp.onblur = () => { inp.value ? el.setAttribute('data-name', inp.value) : !isLayer && el.removeAttribute('data-name'); History.commit(); };
      };
      /* arrastrar y soltar para reordenar */
      r.draggable = true;
      r.ondragstart = e => { this.dragEl = el; e.dataTransfer.effectAllowed = 'move'; };
      r.ondragover = e => { if (this.dragEl && this.dragEl !== el) { e.preventDefault(); r.style.boxShadow = 'inset 0 2px 0 #1e90ff'; } };
      r.ondragleave = () => r.style.boxShadow = '';
      r.ondrop = e => {
        e.preventDefault(); r.style.boxShadow = ''; const d = this.dragEl; this.dragEl = null; if (!d || d.contains(el)) return;
        const dIsLayer = d.classList.contains('layer');
        if (dIsLayer && isLayer) el.after(d);
        else if (!dIsLayer && isLayer) el.appendChild(d);
        else if (!dIsLayer) el.after(d);
        else return;
        History.commit(); App.emit('layers'); Selection.draw();
      };
      list.appendChild(r);
      if (canOpen && this.expanded.has(el.id)) [...el.children].reverse().forEach(c => row(c, false, depth + 1));
    };
    layers.forEach(l => row(l, true, 0));
  },
};
