/* Vectora — arranque y eventos de puntero / teclado */
'use strict';

(async function init() {
  Object.assign(App.els, { stage: $('stage'), viewport: $('viewport'), content: $('content'), overlay: $('overlay'), artboard: $('artboard') });
  document.documentElement.classList.add('booting'); /* sin interacción hasta recuperar el autoguardado */
  Tools.build(); Menus.build(); Panels.init(); Rulers.init();
  Dock.init(); TransformPanel.init(); PropsPanel.init(); HistoryPanel.init(); ArtboardsPanel.init(); TaskBar.init(); Align.initUI(); initRulerOrigin(); LayersPanel.init(); Symbols.init(); Patterns.init(); Appearance.init(); GraphicStyles.init(); Prefs.load();

  const session = await IO.restore();
  Tools.use('select');
  if (session && session.docs.length) Docs.restore(session); /* recuperar todas las pestañas */
  else if (Prefs.get('home')) Docs.empty();                  /* pantalla de inicio */
  else IO.newDoc(800, 600, false);
  Panels.refresh(); Panels.renderLayers();
  document.documentElement.classList.remove('booting');
  Shell.init();

  let saveT; App.on('change', () => { if (!Prefs.get('autosave')) return; clearTimeout(saveT); saveT = setTimeout(() => IO.autosave(), 400); });
  window.addEventListener('resize', () => Selection.draw());
  window.addEventListener('beforeunload', () => IO.autosave());

  /* ---------- puntero ---------- */
  const stage = App.els.stage;
  let pressed = false, tempHand = null;
  const stagePt = ev => { const r = stage.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
  const tool = () => tempHand || App.tool;

  stage.addEventListener('pointerdown', ev => {
    if (ev.button === 2) return;
    Menus.close(); document.activeElement && document.activeElement.blur && document.activeElement !== $('textEditor') && document.activeElement.blur();
    if (ev.button === 1) { tempHand = App.tools.hand; ev.preventDefault(); }
    pressed = true; stage.setPointerCapture(ev.pointerId);
    const p = View.screenToDoc(ev.clientX, ev.clientY);
    tool().down && tool().down(p, ev, stagePt(ev));
  });
  stage.addEventListener('pointermove', ev => {
    const p = View.screenToDoc(ev.clientX, ev.clientY);
    const o = Units.origin(); $('sbPos').textContent = `X: ${Units.fmt(p.x - o.x)}  Y: ${Units.fmt(p.y - o.y)} ${Units.u}`;
    App.pointer = stagePt(ev);
    const t = tool();
    if (pressed) t.move && t.move(p, ev, stagePt(ev));
    else t.hover && t.hover(p, ev, stagePt(ev));
  });
  const up = ev => {
    if (!pressed) return; pressed = false;
    const p = View.screenToDoc(ev.clientX, ev.clientY), t = tool();
    t.up && t.up(p, ev, stagePt(ev));
    if (ev.button === 1) { tempHand = null; stage.style.cursor = App.tool.cursor || 'default'; }
  };
  stage.addEventListener('pointerup', up);
  stage.addEventListener('pointercancel', up);
  stage.addEventListener('dblclick', ev => { const t = tool(); t.dblclick && t.dblclick(View.screenToDoc(ev.clientX, ev.clientY), ev, stagePt(ev)); });
  stage.addEventListener('contextmenu', ev => {
    ev.preventDefault();
    if (['select', 'direct', 'rotate', 'scale'].includes(App.toolName)) {
      const o = hitObject(ev); if (o && !Selection.has(o)) Selection.set([o]);
    }
    ContextMenu.show(ev.clientX, ev.clientY);
  });

  /* ---------- portapapeles del sistema y soltar archivos ---------- */
  const typingNow = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement && document.activeElement.tagName) || Dialog.isOpen;
  document.addEventListener('copy', e => {
    if (typingNow() || !App.selection.length) return;
    Actions.copy(); e.clipboardData.setData('text/plain', App.clipboardText); e.preventDefault();
  });
  document.addEventListener('cut', e => {
    if (typingNow() || !App.selection.length) return;
    Actions.copy(); e.clipboardData.setData('text/plain', App.clipboardText); e.preventDefault(); Actions.del();
  });
  document.addEventListener('paste', e => {
    if (typingNow()) return;
    e.preventDefault();
    const dt = e.clipboardData, file = [...(dt.files || [])].find(f => f.type.startsWith('image/'));
    if (file) return placeFile(file);
    const text = (dt.getData('text/plain') || '').trim();
    if (text && text !== App.clipboardText && /^(<\?xml[\s\S]*?\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(text)) return IO.placeSVG(text);
    Actions.paste();
  });
  const placeFile = f => Import.placeFile(f);
  const wrap = $('canvasWrap');
  wrap.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  wrap.addEventListener('drop', e => { e.preventDefault(); [...e.dataTransfer.files].forEach(placeFile); });
  stage.addEventListener('wheel', ev => {
    ev.preventDefault();
    if (ev.ctrlKey || ev.altKey) { const sp = stagePt(ev); View.zoomAt(Math.exp(-ev.deltaY * 0.0018), sp.x, sp.y); }
    else { App.view.x -= ev.shiftKey ? ev.deltaY : ev.deltaX; App.view.y -= ev.shiftKey ? 0 : ev.deltaY; View.apply(); }
    Selection.draw();
  }, { passive: false });

  /* ---------- teclado ---------- */
  /* atajos de herramientas a partir de TOOL_INFO: 'V' -> v, 'Mayús+E' -> s+e */
  const TOOL_KEYS = {};
  for (const [id, [, k]] of Object.entries(TOOL_INFO)) if (k && App.tools[id]) TOOL_KEYS[(k.startsWith('Mayús+') ? 's+' + k.slice(6) : k).toLowerCase()] = id;
  document.addEventListener('keydown', ev => {
    if (Dialog.isOpen) return;
    if (Home.visible && !(ev.ctrlKey || ev.metaKey)) return; /* en la pantalla de inicio solo valen los atajos de menú */
    const tag = document.activeElement && document.activeElement.tagName;
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
    if (typing) { if (ev.key === 'Escape') document.activeElement.blur(); return; }
    if (ev.key === 'F1') { ev.preventDefault(); Dialog.alert(HELP_TEXT, 'Atajos de teclado'); return; }
    /* Ctrl+C / X / V se dejan pasar para usar el portapapeles del sistema */
    if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && !ev.shiftKey && ['c', 'x', 'v'].includes(ev.key.toLowerCase())) return;
    const fn = Menus.match(ev);
    if (fn) { ev.preventDefault(); fn(); return; }
    if (App.tool.key && App.tool.key(ev)) { ev.preventDefault(); return; }
    if (ev.ctrlKey || ev.metaKey) return;
    const k = ev.key;
    if (k === ' ' && !tempHand && !pressed) { tempHand = App.tools.hand; stage.style.cursor = 'grab'; ev.preventDefault(); return; }
    if (k === 'Delete' || k === 'Backspace') { ev.preventDefault(); Actions.del(); return; }
    if (k.startsWith('Arrow')) {
      ev.preventDefault(); const d = ev.shiftKey ? Prefs.get('nudgeBig') : Prefs.get('nudge');
      const dx = k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0, dy = k === 'ArrowUp' ? -d : k === 'ArrowDown' ? d : 0;
      if (!(App.tool.nudge && App.tool.nudge(dx, dy))) Actions.nudge(dx, dy);
      return;
    }
    if (k === 'Escape') { if (App.toolName !== 'select') Tools.use('select'); else if (!App.selection.length && Isolation.active()) Isolation.exit(); else Selection.clear(); return; }
    if (ev.shiftKey && k.toLowerCase() === 'x') return Actions.swapFS();
    if (k === 'x') { App.activeFS = App.activeFS === 'fill' ? 'stroke' : 'fill'; Panels.refresh(); return; }
    if (k === 'd') return Actions.defaultFS();
    if (k === '/') return Panels.setColor(App.activeFS, 'none');
    const sk = (ev.shiftKey ? 's+' : '') + k.toLowerCase();
    if (!ev.altKey && TOOL_KEYS[sk]) Tools.use(TOOL_KEYS[sk]);
  });
  document.addEventListener('keyup', ev => {
    if (ev.key === ' ' && tempHand && !pressed) { tempHand = null; stage.style.cursor = App.tool.cursor || 'default'; }
  });
})();

/* Ilustración de bienvenida para el primer arranque */
function demoArtwork() {
  App.doc.width = 800; App.doc.height = 600;
  const L = Layers.ensure();
  const defs = docDefs();
  const g = svgEl('linearGradient', { id: 'gradSky', x1: 0, y1: 0, x2: 0, y2: 600, gradientUnits: 'userSpaceOnUse' }, defs);
  svgEl('stop', { offset: 0, 'stop-color': '#ffcf7a' }, g); svgEl('stop', { offset: 1, 'stop-color': '#ff6f61' }, g);
  const add = (tag, a) => { const e = svgEl(tag, { id: uid(), ...a }); L.appendChild(e); return e; };
  add('rect', { x: 0, y: 0, width: 800, height: 600, fill: 'url(#gradSky)', stroke: 'none', 'data-name': 'Cielo' });
  add('ellipse', { cx: 400, cy: 330, rx: 120, ry: 120, fill: '#fff4d6', stroke: 'none', 'data-name': 'Sol' });
  add('path', { d: 'M0 420C120 360 220 380 320 410C430 445 520 360 640 370C700 375 760 395 800 410L800 600L0 600Z', fill: '#6b3e75', stroke: 'none', 'data-name': 'Montañas' });
  add('path', { d: 'M0 480C140 450 260 500 400 485C540 470 640 440 800 470L800 600L0 600Z', fill: '#3b2352', stroke: 'none', 'data-name': 'Colinas' });
  add('polygon', { points: polyPoints(150, 120, 22, 22, 5, true, 0.45), fill: '#ffffff', stroke: 'none', opacity: .9 });
  const t = add('text', { x: 400, y: 120, fill: '#3b2352', 'font-family': 'Georgia', 'font-size': 56, 'font-weight': 'bold', 'text-anchor': 'middle', 'data-name': 'Vectora' });
  svgEl('tspan', { x: 400 }, t).textContent = 'Vectora';
  const t2 = add('text', { x: 400, y: 160, fill: '#3b2352', 'font-family': 'Segoe UI', 'font-size': 18, 'text-anchor': 'middle', 'data-name': 'Subtítulo' });
  svgEl('tspan', { x: 400 }, t2).textContent = 'Editor vectorial libre — pulsa F1 para ver los atajos';
}
