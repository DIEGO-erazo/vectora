/* Vectora — menús, atajos de teclado y archivo (abrir / guardar / exportar) */
'use strict';

const IO = {
  async newDoc(w = 800, h = 600, ask = true) {
    let title = 'Sin título-' + (IO.count + 1), units = 'px', bleed = 0;
    if (ask) {
      const v = await NewDoc.open('new'); if (!v) return;
      ({ width: w, height: h, units, bleed } = v); title = v.name;
    }
    Docs.create(); /* cada documento nuevo abre su propia pestaña */
    IO.count++; IO.current = null;
    App.els.content.innerHTML = ''; App.activeLayer = null; App.selection = [];
    for (const k of Object.keys(App.doc)) delete App.doc[k];
    Object.assign(App.doc, { width: w, height: h, title, units, bleed, guides: [], swatches: [], gstyles: [], paraStyles: [], charStyles: [], brushes: [], gswatches: [], colorMode: 'rgb' });
    Layers.create('Capa 1'); View.updateArtboard(); View.fit(); History.reset(); Selection.changed();
    App.emit('layers'); Panels.refresh(); Rulers.draw(); Docs.render(); View.apply();
  },
  count: 0,
  sanitize(root) {
    root.querySelectorAll('script,foreignObject,iframe').forEach(e => e.remove());
    for (const e of [root, ...root.querySelectorAll('*')]) for (const a of [...e.attributes]) {
      if (/^on/i.test(a.name)) e.removeAttribute(a.name);
      if (/href$/i.test(a.name) && /^\s*javascript:/i.test(a.value)) e.removeAttribute(a.name);
    }
    this.inlineCSS(root);
  },
  /* Convierte las hojas <style> y los atributos style="" en atributos de presentación,
     para que el CSS importado no afecte a la interfaz y los colores sean editables. */
  PRES: new Set(['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit',
    'opacity', 'fill-opacity', 'stroke-opacity', 'fill-rule', 'clip-rule', 'clip-path', 'mask', 'filter', 'font-family', 'font-size', 'font-weight',
    'font-style', 'text-anchor', 'letter-spacing', 'display', 'visibility', 'stop-color', 'stop-opacity']),
  inlineCSS(root) {
    for (const st of [...root.querySelectorAll('style')]) {
      try {
        const sheet = new CSSStyleSheet(); sheet.replaceSync(st.textContent);
        for (const r of sheet.cssRules) {
          if (!r.selectorText) continue;
          let els; try { els = root.querySelectorAll(r.selectorText); } catch (e) { continue; }
          els.forEach(e => { for (const p of r.style) if (this.PRES.has(p)) e.setAttribute(p, r.style.getPropertyValue(p)); });
        }
        /* solo se conservan las fuentes incrustadas (@font-face), que no afectan a la interfaz */
        const fonts = [...sheet.cssRules].filter(r => r instanceof CSSFontFaceRule).map(r => r.cssText);
        if (fonts.length) { st.textContent = fonts.join('\n'); continue; }
      } catch (e) { /* CSS no válido: se ignora */ }
      st.remove();
    }
    for (const e of root.querySelectorAll('[style]')) {
      const decl = e.getAttribute('style').split(';');
      const keep = [];
      for (const d of decl) {
        const i = d.indexOf(':'); if (i < 0) continue;
        const p = d.slice(0, i).trim().toLowerCase(), v = d.slice(i + 1).replace(/!important/i, '').trim();
        if (this.PRES.has(p)) e.setAttribute(p, v); else if (p) keep.push(`${p}:${v}`);
      }
      keep.length ? e.setAttribute('style', keep.join(';')) : e.removeAttribute('style');
    }
  },
  /* elimina de <defs> lo que nadie referencia (gradientes, filtros, máscaras huérfanas) */
  purgeDefs(svg) {
    for (let pass = 0; pass < 4; pass++) {
      const text = new XMLSerializer().serializeToString(svg);
      const used = new Set([...text.matchAll(/url\(\s*['"]?#([^)'"\s]+)/g), ...text.matchAll(/href="#([^"]+)"/g)].map(m => m[1]));
      let removed = 0;
      for (const d of svg.querySelectorAll('defs > [id]')) if (!used.has(d.id)) { d.remove(); removed++; }
      if (!removed) break;
    }
    svg.querySelectorAll('defs').forEach(d => { if (!d.children.length) d.remove(); });
  },
  loadSVG(text, name) {
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml'), svg = doc.documentElement;
    if (svg.tagName !== 'svg') return Dialog.alert('El archivo no es un SVG válido.');
    this.sanitize(svg);
    const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
    let w = parseFloat(svg.getAttribute('width')), h = parseFloat(svg.getAttribute('height'));
    if (vb.length === 4) { w = vb[2]; h = vb[3]; }
    w = w || 800; h = h || 600;
    let meta = {}; try { const m = svg.querySelector('metadata#vectora-meta'); if (m) meta = JSON.parse(m.textContent); } catch (e) { meta = {}; }
    Docs.create();
    const c = App.els.content; c.innerHTML = ''; App.activeLayer = null; App.selection = [];
    for (const k of Object.keys(App.doc)) delete App.doc[k];
    const defs = svgEl('defs', {}, c);
    const kids = [...svg.children].map(n => document.importNode(n, true));
    const own = kids.some(k => k.classList && k.classList.contains('layer'));
    let layer = null;
    for (const k of kids) {
      if (k.tagName === 'defs') { [...k.children].forEach(d => defs.appendChild(d)); continue; }
      if (k.tagName === 'style') { defs.appendChild(k); continue; }
      if (['title', 'desc', 'metadata'].includes(k.tagName)) continue;
      if (own && k.classList.contains('layer')) { c.appendChild(k); continue; }
      if (!layer) layer = Layers.create('Capa 1');
      layer.appendChild(k);
    }
    /* contenido de capa en la posición del viewBox */
    if (vb.length === 4 && (vb[0] || vb[1])) for (const l of Layers.all()) for (const o of [...l.children]) Geo.applyDoc(o, new DOMMatrix().translate(-vb[0], -vb[1]));
    for (const e of c.querySelectorAll('.layer > *')) if (!e.id) e.id = uid();
    Object.assign(App.doc, { width: w, height: h, title: (name || 'Importado').replace(/\.svg$/i, ''),
      swatches: Array.isArray(meta.swatches) ? meta.swatches.filter(s => /^#[0-9a-f]{6}$/i.test(s)) : [],
      paraStyles: Array.isArray(meta.paraStyles) ? meta.paraStyles.filter(g => g && typeof g.name === 'string' && g.a) : [],
      charStyles: Array.isArray(meta.charStyles) ? meta.charStyles.filter(g => g && typeof g.name === 'string' && g.a) : [],
      brushes: Array.isArray(meta.brushes) ? meta.brushes.filter(b => b && b.id && b.fx && FX[b.fx.t]) : [],
      gswatches: Array.isArray(meta.gswatches) ? meta.gswatches.filter(g => g && g.id && /^#[0-9a-f]{6}$/i.test(g.c)) : [], colorMode: meta.colorMode === 'cmyk' ? 'cmyk' : 'rgb',
      gstyles: Array.isArray(meta.gstyles) ? meta.gstyles.filter(g => g && typeof g.name === 'string' && g.a && typeof g.a === 'object').map(g => ({ ...g, id: uid('gs') })) : [],
      guides: Array.isArray(meta.guides) ? meta.guides.filter(g => g && (g.axis === 'x' || g.axis === 'y') && isFinite(g.v)) : [],
      units: Units.list[meta.units] ? meta.units : 'px', bleed: isFinite(meta.bleed) ? Math.max(0, +meta.bleed) : 0,
      artboards: Array.isArray(meta.artboards) ? meta.artboards.filter(a => a && [a.x, a.y, a.width, a.height].every(isFinite)).map(a => ({ name: String(a.name || 'Mesa de trabajo'), x: +a.x, y: +a.y, width: +a.width, height: +a.height })) : undefined, activeArtboard: 0 });
    Layers.ensure(); View.updateArtboard(); View.fit(); History.reset(); Selection.changed(); App.emit('layers');
    Panels.refresh(); Rulers.draw(); Swatches.render(); Docs.render(); View.apply();
  },
  /* box: área exportada (por defecto la mesa de trabajo); only: exportar solo esos objetos */
  serialize(forExport = true, box = null, only = null) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Creado con Vectora (editor vectorial libre) -->\n' + new XMLSerializer().serializeToString(this.buildSVG(forExport, box, only));
  },
  buildSVG(forExport = true, box = null, only = null) {
    const d = App.doc, b = box || { x: 0, y: 0, width: d.width, height: d.height };
    const svg = svgEl('svg', { xmlns: NS, width: round(b.width), height: round(b.height), viewBox: `${round(b.x)} ${round(b.y)} ${round(b.width)} ${round(b.height)}` });
    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    if (only) only.forEach(e => e.setAttribute('data-exp', '1'));
    for (const ch of App.els.content.children) {
      if (forExport && ch.hasAttribute('data-noprint')) continue; /* capas no imprimibles o de plantilla */
      const c = ch.cloneNode(true);
      if (forExport) c.querySelectorAll('[opacity="0"]').forEach(e => { if (e.tagName === 'text') e.removeAttribute('opacity'); });
      if (only && c.classList.contains('layer')) [...c.children].forEach(o => { if (!o.hasAttribute('data-exp')) o.remove(); });
      c.querySelectorAll('[data-exp]').forEach(e => e.removeAttribute('data-exp'));
      svg.appendChild(c);
    }
    if (only) only.forEach(e => e.removeAttribute('data-exp'));
    if (forExport) this.purgeDefs(svg);
    /* muestras propias y guías viajan dentro del SVG */
    const meta = {}; if ((d.swatches || []).length) meta.swatches = d.swatches; if ((d.guides || []).length) meta.guides = d.guides; if ((d.gstyles || []).length) meta.gstyles = d.gstyles; if ((d.gswatches || []).length) meta.gswatches = d.gswatches; if (d.colorMode === 'cmyk') meta.colorMode = 'cmyk'; if ((d.brushes || []).length) meta.brushes = d.brushes; for (const k of ['paraStyles', 'charStyles']) if ((d[k] || []).length) meta[k] = d[k];
    if (d.units && d.units !== 'px') meta.units = d.units; if (d.bleed) meta.bleed = d.bleed;
    if (Artboards.count() > 1 || Artboards.list()[0].name !== 'Mesa de trabajo 1') meta.artboards = Artboards.list().map(a => ({ name: a.name, x: a.x, y: a.y, width: a.width, height: a.height }));
    if (!only && Object.keys(meta).length) svg.prepend(Object.assign(svgEl('metadata', { id: 'vectora-meta' }), { textContent: JSON.stringify(meta) }));
    return svg;
  },
  download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  rasterize(svgText, w, h, scale, bg, type, quality = 0.92) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
      img.onload = () => {
        const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * scale)); cv.height = Math.max(1, Math.round(h * scale));
        const ctx = cv.getContext('2d');
        if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, cv.width, cv.height); }
        ctx.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        cv.toBlob(b => b ? res(b) : rej(new Error('canvas')), type, quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
      img.src = url;
    });
  },
  printPDF(svgText, w, h) {
    const win = window.open('', '_blank');
    if (!win) return Dialog.alert('El navegador bloqueó la ventana emergente. Permítela para exportar a PDF.');
    const body = svgText.replace(/^<\?xml[^>]*>\s*/, '');
    win.document.write(`<!doctype html><html><head><title>${App.doc.title}</title><style>@page{size:${w}px ${h}px;margin:0}
      html,body{margin:0;background:#fff}svg{display:block;width:100%;height:auto}</style></head><body>${body}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  },
  placeSVG(text) {
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement; if (svg.tagName !== 'svg') return;
    this.sanitize(svg);
    const g = svgEl('g', { id: uid(), 'data-name': '<SVG colocado>' });
    for (const k of [...svg.children]) {
      const n = document.importNode(k, true);
      if (n.tagName === 'defs') [...n.children].forEach(d => docDefs().appendChild(d)); else if (!['title', 'desc', 'metadata'].includes(n.tagName)) g.appendChild(n);
    }
    if (addObject(g)) { Selection.set([g]); History.commit(); }
  },
  /* autoguardado en IndexedDB (cientos de MB, frente a los ~5 MB de localStorage) */
  /* autoguardado de la sesión completa (todas las pestañas) */
  async autosave() {
    try {
      const s = Docs.session(), ids = new Set(s.docs.flatMap(d => ImageStore.used(d.html)));
      await KV.set('session', { ...s, count: IO.count, images: [...ids].map(id => [id, ImageStore.byId.get(id)]) });
      if ($('sbHint').dataset.warn) { $('sbHint').textContent = ''; delete $('sbHint').dataset.warn; }
    } catch (e) {
      $('sbHint').textContent = '⚠ No se pudo autoguardar: guarda tu trabajo como SVG'; $('sbHint').dataset.warn = '1';
    }
  },
  /* devuelve la sesión guardada ({active, docs}) o null */
  async restore() {
    try {
      let s = await KV.get('session');
      if (!s) { /* formato anterior: un solo documento */
        const old = await KV.get('autosave');
        if (old && old.html) s = { active: 0, docs: [{ html: old.html, doc: old.doc }], images: old.images };
      }
      if (!s || !Array.isArray(s.docs)) return null;
      for (const [id, url] of s.images || []) {
        if (!url) continue;
        ImageStore.byId.set(id, url); ImageStore.byUrl.set(url, id);
        ImageStore.n = Math.max(ImageStore.n, +id.slice(4) + 1);
      }
      IO.count = s.count || s.docs.length;
      return s;
    } catch (e) { return null; }
  },
};

/* almacén clave-valor mínimo sobre IndexedDB */
const KV = {
  db() {
    return this._db ||= new Promise((res, rej) => {
      const r = indexedDB.open('vectora', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  async get(k) {
    const db = await this.db();
    return new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  },
  async set(k, v) {
    const db = await this.db();
    return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
  },
};

/* ---------- Definición de menús ---------- */
const MENUS = {
  'Archivo': [
    ['Nuevo…', 'Ctrl+N', () => IO.newDoc()], ['Abrir…', 'Ctrl+O', () => Import.open()], '-',
    ['Cerrar', 'Ctrl+W', () => Docs.close()], ['Cerrar todo', 'Ctrl+Alt+W', () => Docs.closeAll()],
    ['Guardar', 'Ctrl+S', () => IO.save()], ['Guardar como…', 'Ctrl+Shift+S', () => IO.saveAs()], '-',
    ['Colocar…', 'Ctrl+Shift+P', () => Import.place()], '-',
    ['Exportar ▸ Exportar como…', 'Ctrl+Shift+E', () => Export.dialog()],
    ['Exportar ▸ Exportar para pantallas…', 'Ctrl+Alt+E', () => Export.screens()],
    ['Exportar ▸ PDF…', 'Ctrl+Alt+Shift+S', () => Export.dialog('pdf')], '-',
    ['Ajustar documento…', 'Ctrl+Alt+P', () => NewDoc.setup()], ['Mesa de trabajo', 'Shift+O', () => Tools.use('artboard')], '-',
    ['Modo de color del documento ▸ Color RGB', '', () => DocColor.set('rgb'), () => App.doc.colorMode !== 'cmyk'], ['Modo de color del documento ▸ Color CMYK', '', () => DocColor.set('cmyk'), () => App.doc.colorMode === 'cmyk'],
    ['Scripts ▸ Consola de scripts…', 'Ctrl+F12', () => Scripts.console()], ['Scripts ▸ Ejecutar script guardado…', '', () => Scripts.runSaved()], ['Scripts ▸ Abrir archivo de script…', '', () => Scripts.openFile()],
    ['Imprimir…', 'Ctrl+P', () => Print.dialog()],
    ...(window.vectoraDesktop ? ['-', ['Salir', 'Ctrl+Q', () => window.close()]] : []),
  ],
  'Edición': [
    ['Deshacer', 'Ctrl+Z', () => History.undo()], ['Rehacer', 'Ctrl+Shift+Z', () => History.redo()], '-',
    ['Cortar', 'Ctrl+X', () => Actions.cut()], ['Copiar', 'Ctrl+C', () => Actions.copy()], ['Pegar', 'Ctrl+V', () => Actions.paste()],
    ['Pegar delante', 'Ctrl+F', () => Actions.paste('front')], ['Pegar detrás', 'Ctrl+B', () => Actions.paste('back')],
    ['Borrar', 'Delete', () => Actions.del()], ['Duplicar', 'Ctrl+Alt+D', () => Actions.duplicate()], '-',
    ['Buscar y reemplazar…', '', () => FindReplace.dialog()], '-',
    ['Preferencias…', 'Ctrl+K', () => Prefs.dialog()], ['Atajos de teclado…', 'Ctrl+Alt+Shift+K', () => KeyShortcuts.dialog()], '-',
    ['Editar colores ▸ Volver a colorear ilustración…', '', () => RecolorArt.open()], ['Editar colores ▸ Invertir colores', '', () => Recolor.invert()], ['Editar colores ▸ Convertir a escala de grises', '', () => Recolor.grayscale()],
    ['Editar colores ▸ Saturar…', '', () => Recolor.saturate()], ['Editar colores ▸ Ajustar equilibrio de color…', '', () => Recolor.balance()],
    ['Editar colores ▸ Fusionar de delante a detrás', '', () => Recolor.blendFrontBack()], '-',
    ['Ajustar a cuadrícula', 'Ctrl+Shift+\'', () => { App.snap = !App.snap; Menus.refreshChecks(); }, () => App.snap],
  ],
  'Objeto': [
    ['Transformar ▸ Transformar de nuevo', 'Ctrl+D', () => PathOps.transformAgain()],
    ['Transformar ▸ Mover…', 'Ctrl+Shift+M', () => Actions.moveDialog()], ['Transformar ▸ Transformar cada uno…', 'Ctrl+Alt+Shift+D', () => TransformEach.dialog()], ['Transformar ▸ Rotar…', '', () => Actions.rotateDialog()],
    ['Transformar ▸ Escalar…', '', () => Actions.scaleDialog()], ['Transformar ▸ Reflejar horizontal', '', () => Actions.reflect('h')],
    ['Transformar ▸ Reflejar vertical', '', () => Actions.reflect('v')], ['Transformar ▸ Reflejar…', '', () => Actions.reflectDialog()],
    ['Transformar ▸ Distorsionar…', '', () => Actions.shearDialog()], '-',
    ['Mesas de trabajo ▸ Nueva', '', () => { Artboards.add(); Artboards.fitAll(); History.commit(); }], ['Mesas de trabajo ▸ Eliminar', '', () => { Artboards.remove(); History.commit(); }],
    ['Mesas de trabajo ▸ Ajustar a límites de ilustración', '', () => { const b = Geo.selBox(Layers.objects()); if (b) { Artboards.setRect(Artboards.activeIndex(), b); History.commit(); } }],
    ['Mesas de trabajo ▸ Ajustar a límites de selección', '', () => { const b = Selection.box(); if (b) { Artboards.setRect(Artboards.activeIndex(), b); History.commit(); } }], '-',
    ['Fusión ▸ Crear', 'Ctrl+Alt+B', () => Blend.make(App.selection)], ['Fusión ▸ Liberar', 'Ctrl+Alt+Shift+B', () => Blend.release()],
    ['Fusión ▸ Expandir', '', () => Blend.expand()], ['Fusión ▸ Opciones de fusión…', '', () => Blend.options()], '-',
    ['Organizar ▸ Traer al frente', 'Ctrl+Shift+]', () => Actions.arrange('front')], ['Organizar ▸ Hacia delante', 'Ctrl+]', () => Actions.arrange('forward')],
    ['Organizar ▸ Hacia atrás', 'Ctrl+[', () => Actions.arrange('backward')], ['Organizar ▸ Enviar al fondo', 'Ctrl+Shift+[', () => Actions.arrange('back')], '-',
    ['Agrupar', 'Ctrl+G', () => Actions.group()], ['Aislar grupo seleccionado', '', () => Isolation.enter(App.selection.find(e => e.tagName === 'g'))],
    ['Salir del modo aislamiento', '', () => Isolation.exit()], ['Desagrupar', 'Ctrl+Shift+G', () => Actions.ungroup()], '-',
    ['Bloquear selección', 'Ctrl+2', () => Actions.lock()], ['Desbloquear todo', 'Ctrl+Alt+2', () => Actions.unlockAll()],
    ['Ocultar selección', 'Ctrl+3', () => Actions.hide()], ['Mostrar todo', 'Ctrl+Alt+3', () => Actions.showAll()], '-',
    ['Buscatrazos ▸ Unificar', '', () => Pathfinder.run('unite')], ['Buscatrazos ▸ Menos frente', '', () => Pathfinder.run('minus')],
    ['Buscatrazos ▸ Intersecar', '', () => Pathfinder.run('intersect')], ['Buscatrazos ▸ Excluir', '', () => Pathfinder.run('exclude')],
    ['Buscatrazos ▸ Dividir', '', () => Pathfinder.run('divide')], ['Buscatrazos ▸ Recortar', '', () => Pathfinder.run('trim')],
    ['Buscatrazos ▸ Combinar', '', () => Pathfinder.run('merge')], ['Buscatrazos ▸ Cortar', '', () => Pathfinder.run('crop')],
    ['Buscatrazos ▸ Contorno', '', () => Pathfinder.run('outline')], ['Buscatrazos ▸ Menos fondo', '', () => Pathfinder.run('minusBack')], '-',
    ['Símbolo ▸ Nuevo símbolo…', 'F8', () => Symbols.create()], ['Símbolo ▸ Editar símbolo', '', () => Symbols.edit(App.selection.find(e => e.tagName === 'use'))],
    ['Símbolo ▸ Romper vínculo', '', () => Symbols.breakLink()], ['Símbolo ▸ Redefinir símbolo', '', () => Symbols.redefine()],
    ['Motivo ▸ Crear…', '', () => Patterns.create()], ['Motivo ▸ Editar motivo', '', () => Patterns.edit()], '-',
    ['Convertir en trazado', '', () => Actions.toPath()], ['Calco de imagen ▸ Crear y expandir…', '', () => Trace.dialog()],
    ['Repetir ▸ Radial', '', () => Repeat.make('radial')], ['Repetir ▸ Cuadrícula', '', () => Repeat.make('grid')], ['Repetir ▸ Espejo', '', () => Repeat.make('mirror')],
    ['Repetir ▸ Opciones…', '', () => Repeat.options()], ['Repetir ▸ Expandir', '', () => Repeat.expand()], ['Repetir ▸ Liberar', '', () => Repeat.release()], '-',
    ['Trazado ▸ Unir', 'Ctrl+J', () => PathOps.join()], ['Trazado ▸ Simplificar…', '', () => PathOps.simplify()],
    ['Trazado ▸ Contornear trazo', '', () => PathOps.outlineStroke()], ['Trazado ▸ Desplazar trazado…', '', () => PathOps.offsetPath()],
    ['Trazado ▸ Promediar…', 'Ctrl+Alt+J', () => Anchors.average()], ['Trazado ▸ Añadir puntos de ancla', '', () => Anchors.add()], ['Trazado ▸ Quitar puntos de ancla', '', () => Anchors.remove()],
    ['Trazado ▸ Dividir objetos debajo', '', () => QuickOps.divideBelow()], ['Trazado ▸ Dividir en cuadrícula…', '', () => QuickOps.splitGrid()], ['Trazado ▸ Limpiar…', '', () => QuickOps.cleanup()],
    ['Rasterizar…', '', () => Raster.rasterize()], ['Recortar imagen', '', () => Raster.crop()],
    ['Trazado compuesto ▸ Crear', 'Ctrl+8', () => Pathfinder.compound()], ['Trazado compuesto ▸ Liberar', 'Ctrl+Alt+Shift+8', () => Pathfinder.release()],
    ['Máscara de recorte ▸ Crear', 'Ctrl+7', () => Actions.makeClip()], ['Máscara de recorte ▸ Liberar', 'Ctrl+Alt+7', () => Actions.releaseClip()],
    '-', ['Distorsión de envolvente ▸ Deformar…', 'Ctrl+Alt+Shift+W', () => Envelope.warp()], ['Expandir apariencia', '', () => LiveFX.expand()],
  ],
  'Texto': [
    ['Crear contornos', 'Ctrl+Shift+O', () => TextOutline.run()], '-',
    ['Herramienta Texto', 'T', () => Tools.use('text')], ['Herramienta Texto de área', '', () => Tools.use('areatext')], ['Herramienta Texto en trazado', '', () => Tools.use('pathtext')],
    ['Convertir en texto de área', '', () => TextActions.toArea()], '-',
    ['Cambiar mayúsculas ▸ MAYÚSCULAS', '', () => TextActions.changeCase('upper')], ['Cambiar mayúsculas ▸ minúsculas', '', () => TextActions.changeCase('lower')],
    ['Cambiar mayúsculas ▸ Tipo Título', '', () => TextActions.changeCase('title')], ['Cambiar mayúsculas ▸ Tipo oración', '', () => TextActions.changeCase('sentence')], '-',
    ['Texto enlazado ▸ Crear', '', () => TextThreadCmd.create()], ['Texto enlazado ▸ Liberar selección', '', () => TextThreadCmd.release()], ['Texto enlazado ▸ Quitar enlace', '', () => TextThreadCmd.remove()], '-',
    ['Buscar y reemplazar…', '', () => FindReplace.dialog()], ['Revisar ortografía automáticamente', '', () => FindReplace.toggleSpell(), () => FindReplace.spell], '-',
    ['Rellenar con texto de muestra', '', () => TextActions.placeholder()], '-',
    ['Carácter', 'Ctrl+T', () => Menus.togglePanel('pChar')], ['Párrafo', 'Ctrl+Alt+T', () => Menus.togglePanel('pPara')],
    ['Estilos de texto', '', () => Menus.togglePanel('pTextStyles')], ['Glifos', 'Alt+Shift+F11', () => Menus.togglePanel('pGlyphs')], ['Fuentes del sistema…', '', () => Fonts.load()],
  ],
  'Seleccionar': [
    ['Todo', 'Ctrl+A', () => Actions.selectAll()], ['Deseleccionar', 'Ctrl+Shift+A', () => Selection.clear()],
    ['Invertir selección', '', () => Actions.invertSelection()], '-',
    ['Igual ▸ Relleno y trazo', '', () => SelectOps.same('fillstroke')], ['Igual ▸ Color de relleno', '', () => Actions.selectSame('fill')],
    ['Igual ▸ Color de trazo', '', () => Actions.selectSame('stroke')], ['Igual ▸ Grosor de trazo', '', () => Actions.selectSame('stroke-width')],
    ['Igual ▸ Opacidad', '', () => SelectOps.same('opacity')], ['Igual ▸ Modo de fusión', '', () => SelectOps.same('blend')],
    ['Igual ▸ Tipo de objeto', '', () => SelectOps.same('kind')], ['Igual ▸ Familia de fuentes', '', () => SelectOps.same('font')], '-',
    ['Objeto ▸ Todo en la misma capa', '', () => SelectOps.object('layer')], ['Objeto ▸ Objetos de texto', '', () => SelectOps.object('text')],
    ['Objeto ▸ Imágenes', '', () => SelectOps.object('image')], ['Objeto ▸ Grupos', '', () => SelectOps.object('group')],
    ['Objeto ▸ Máscaras de recorte', '', () => SelectOps.object('clip')], ['Objeto ▸ Puntos sueltos', '', () => SelectOps.object('stray')], '-',
    ['Objeto siguiente encima', 'Ctrl+Alt+]', () => SelectOps.neighbor('above')], ['Objeto siguiente debajo', 'Ctrl+Alt+[', () => SelectOps.neighbor('below')], '-',
    ['Guardar selección…', '', () => SelectOps.save()], ['Selecciones guardadas…', '', () => SelectOps.load()], '-',
    ['Mismo color de relleno', '', () => Actions.selectSame('fill')], ['Mismo color de trazo', '', () => Actions.selectSame('stroke')],
    ['Mismo grosor de trazo', '', () => Actions.selectSame('stroke-width')],
  ],
  'Efecto': [
    ['Distorsionar y transformar ▸ Fruncir y engordar…', '', () => LiveFX.add('pucker')], ['Distorsionar y transformar ▸ Retorcer…', '', () => LiveFX.add('twist')],
    ['Distorsionar y transformar ▸ Zigzag…', '', () => LiveFX.add('zigzag')], ['Distorsionar y transformar ▸ Rugosidad…', '', () => LiveFX.add('roughen')],
    ['Estilizar ▸ Redondear esquinas…', '', () => LiveFX.add('round')], '-',
    ['Deformar ▸ Arco…', '', () => Envelope.warp('arc')], ['Deformar ▸ Arco inferior…', '', () => Envelope.warp('arcLower')], ['Deformar ▸ Arco superior…', '', () => Envelope.warp('arcUpper')], ['Deformar ▸ Arcada…', '', () => Envelope.warp('arch')], ['Deformar ▸ Abombado…', '', () => Envelope.warp('bulge')], ['Deformar ▸ Bandera…', '', () => Envelope.warp('flag')], ['Deformar ▸ Onda…', '', () => Envelope.warp('wave')], ['Deformar ▸ Pez…', '', () => Envelope.warp('fish')], ['Deformar ▸ Ascendente…', '', () => Envelope.warp('rise')], ['Deformar ▸ Ojo de pez…', '', () => Envelope.warp('fisheye')], ['Deformar ▸ Inflar…', '', () => Envelope.warp('inflate')], ['Deformar ▸ Comprimir…', '', () => Envelope.warp('squeeze')], ['Deformar ▸ Giro…', '', () => Envelope.warp('twist')],
    ['Estilizar ▸ Caligrafía…', '', () => LiveFX.add('calli')], ['Estilizar ▸ Perfil de anchura…', '', () => LiveFX.add('width')], '-',
    ['Sombra paralela…', '', () => Effects.shadow()], ['Desenfoque gaussiano…', '', () => Effects.blur()],
    ['Quitar efectos', '', () => Effects.clear()], ['Expandir apariencia', '', () => LiveFX.expand()],
  ],
  'Ver': [
    ['Rotar vista ▸ Herramienta Rotar vista', 'Shift+H', () => Tools.use('rotateview')], ['Rotar vista ▸ Restablecer rotación de vista', 'Shift+Escape', () => View.setRotation(0)], '-',
    ['Acercar', 'Ctrl+=', () => View.zoomAt(1.25)], ['Alejar', 'Ctrl+-', () => View.zoomAt(0.8)],
    ['Encajar mesa de trabajo en ventana', 'Ctrl+0', () => View.fit()], ['Encajar todas en la ventana', 'Ctrl+Alt+0', () => Artboards.fitAll()], ['Tamaño real', 'Ctrl+1', () => View.setZoom(1)], '-',
    ['Contornear', 'Ctrl+Y', () => { App.els.content.classList.toggle('outline'); Menus.refreshChecks(); }, () => App.els.content.classList.contains('outline')],
    ['Mostrar cuadrícula', 'Ctrl+\'', () => { Grid.toggle(); Menus.refreshChecks(); }, () => Grid.on], '-',
    ['Reglas', 'Ctrl+R', () => Rulers.toggle(), () => Rulers.on],
    ['Guías inteligentes', 'Ctrl+U', () => { SmartGuides.on = !SmartGuides.on; }, () => SmartGuides.on],
    ['Guías ▸ Ocultar guías', 'Ctrl+;', () => GuideOps.hide(), () => Guides.hidden], ['Guías ▸ Bloquear guías', 'Ctrl+Alt+;', () => GuideOps.lock(), () => App.doc.guidesLocked],
    ['Guías ▸ Crear guías', 'Ctrl+5', () => GuideOps.make()], ['Guías ▸ Borrar guías', '', () => Guides.clear()],
    ['Restablecer origen de reglas', '', () => GuideOps.resetOrigin()],
  ],
  'Ventana': [
    ['Documento siguiente', 'Ctrl+Tab', () => Docs.next(1)], ['Documento anterior', 'Ctrl+Shift+Tab', () => Docs.next(-1)],
    ['Pantalla de inicio', '', () => { Docs.capture(); Home.show(); }], '-',
    ['Barra de tareas contextual', '', () => TaskBar.toggle(), () => TaskBar.on], '-',
    ['Propiedades', '', () => Menus.togglePanel('pProps')], ['Transformar', 'Shift+F8', () => Menus.togglePanel('pTransform')],
    ['Historial', '', () => Menus.togglePanel('pHistory')], ['Símbolos', 'Ctrl+Shift+F11', () => Menus.togglePanel('pSymbols')], ['Color', 'F6', () => Menus.togglePanel('pColor')], ['Muestras', '', () => Menus.togglePanel('pSwatches')], ['Trazo', '', () => Menus.togglePanel('pStroke')],
    ['Degradado', '', () => Menus.togglePanel('pGradient')], ['Transparencia', '', () => Menus.togglePanel('pTransp')], ['Apariencia', 'Shift+F6', () => Menus.togglePanel('pAppearance')], ['Estilos gráficos', 'Shift+F5', () => Menus.togglePanel('pGStyles')], ['Pinceles', 'F5', () => Menus.togglePanel('pBrushes')], ['Navegador', '', () => Menus.togglePanel('pNavigator')], ['Información', 'Ctrl+F8', () => Menus.togglePanel('pInfo')], ['Carácter', '', () => Menus.togglePanel('pChar')], ['Párrafo', '', () => Menus.togglePanel('pPara')], ['Glifos', '', () => Menus.togglePanel('pGlyphs')],
    ['Alinear', '', () => Menus.togglePanel('pAlign')], ['Buscatrazos', '', () => Menus.togglePanel('pPathfinder')], ['Capas', '', () => Menus.togglePanel('pLayers')],
  ],
  'Ayuda': [
    ['Atajos de teclado', 'F1', () => Dialog.alert(HELP_TEXT, 'Atajos de teclado')], '-',
    ...(window.vectoraDesktop ? [] : [['Instalar como aplicación…', '', () => Shell.install()],
      ['Descargar programa de escritorio', '', () => Shell.openRepo('/releases/latest')]]),
    ['Buscar actualizaciones…', '', () => Updates.check()], ['Código fuente en GitHub', '', () => Shell.openRepo()], ['Informar de un problema', '', () => Shell.openRepo('/issues/new/choose')], '-',
    ['Acerca de Vectora', '', () => Dialog.alert(`Vectora ${APP_INFO.version}\nEditor de gráficos vectoriales libre y de código abierto (licencia MIT).\n\n${APP_INFO.repo}`)],
  ],
};
const HELP_TEXT = `HERRAMIENTAS  (mantén pulsado un botón con triángulo para ver las ocultas)
V Selección · A Selección directa · Y Varita mágica · Q Lazo
P Pluma · Mayús+\` Curvatura · Mayús+C Convertir punto de ancla · T Texto · \ Línea · M Rectángulo · L Elipse
B Pincel · Mayús+B Pincel de manchas · N Lápiz · Mayús+E Borrador · C Tijeras
R Rotar · O Reflejar · S Escala · E Transformación libre · Mayús+W Anchura
Mayús+M Creador de formas · K Pintura interactiva · W Fusión
G Degradado · I Cuentagotas · Mayús+O Mesa de trabajo · H Mano (o Espacio) · Z Zoom

DOCUMENTOS
Ctrl+N Nuevo · Ctrl+O Abrir · Ctrl+S Guardar · Ctrl+Mayús+S Guardar como · Ctrl+W Cerrar
Ctrl+Tab Documento siguiente · Ctrl+Mayús+E Exportar como · Ctrl+Alt+E Exportar para pantallas

EDICIÓN Y OBJETO
Ctrl+Z / Ctrl+Mayús+Z Deshacer / Rehacer · Ctrl+C / X / V Copiar, cortar, pegar (también con otras apps)
Ctrl+F / Ctrl+B Pegar delante / detrás · Ctrl+G / Ctrl+Mayús+G Agrupar / Desagrupar
Ctrl+D Transformar de nuevo · Ctrl+J Unir · Ctrl+7 Máscara de recorte · Ctrl+8 Trazado compuesto
Ctrl+Mayús+O Crear contornos · Ctrl+Alt+B Fusión · Ctrl+2 / Ctrl+3 Bloquear / Ocultar
Ctrl+Alt+Mayús+W Deformar · Ctrl+K Preferencias · Ctrl+Alt+Mayús+K Atajos de teclado · Ctrl+F12 Scripts

VISTA
Ctrl+0 Encajar mesa · Ctrl+Alt+0 Encajar todas · Ctrl+1 Tamaño real · Ctrl+R Reglas
Ctrl+U Guías inteligentes · Ctrl+' Cuadrícula · Ctrl+Y Contornear

COLOR, TEXTO Y PANELES
X alternar relleno/trazo · Mayús+X intercambiar · D por defecto · / ninguno
Ctrl+T Carácter · Ctrl+Alt+T Párrafo · Alt+Mayús+F11 Glifos · F5 Pinceles · Mayús+F5 Estilos gráficos · Mayús+F6 Apariencia

MODIFICADORES
Mayús: proporción / 45° · Alt: desde el centro / duplicar al arrastrar · Ctrl: sin ajuste
Flechas: mover 1 px (Mayús: 10 px) · Rueda: desplazar · Ctrl+Rueda: zoom
Doble clic en un grupo: modo aislamiento (Esc para salir)
Selección directa: doble clic en un segmento añade un punto · Alt+clic en un punto lo convierte en esquina
Pluma: clic = esquina, arrastrar = curva (Alt rompe el manejador), clic en el primer punto = cerrar`;

const Effects = {
  ensure(el) {
    let id = (el.getAttribute('filter') || '').match(/#([^)]+)/); id = id && id[1];
    let f = id && document.getElementById(id);
    if (!f) { f = svgEl('filter', { id: uid('fx'), x: '-50%', y: '-50%', width: '200%', height: '200%' }, docDefs()); el.setAttribute('filter', `url(#${f.id})`); }
    return f;
  },
  shadow() {
    Dialog.edit('Sombra paralela', [
      { id: 'dx', label: 'Desplazamiento X', type: 'number', value: 4 }, { id: 'dy', label: 'Desplazamiento Y', type: 'number', value: 4 },
      { id: 'b', label: 'Desenfoque', type: 'number', value: 3, min: 0, step: 0.5 }, { id: 'o', label: 'Opacidad (%)', type: 'number', value: 50, min: 0, max: 100 },
      { id: 'c', label: 'Color', type: 'color', value: '#000000' },
    ], v => App.selection.forEach(el => { const f = this.ensure(el); f.innerHTML = '';
      svgEl('feDropShadow', { dx: +v.dx || 0, dy: +v.dy || 0, stdDeviation: +v.b || 0, 'flood-color': v.c, 'flood-opacity': clamp(+v.o, 0, 100) / 100 }, f); }));
  },
  blur() {
    Dialog.edit('Desenfoque gaussiano', [{ id: 'r', label: 'Radio', type: 'number', value: 4, min: 0, step: 0.5 }],
      v => App.selection.forEach(el => { const f = this.ensure(el); f.innerHTML = ''; svgEl('feGaussianBlur', { stdDeviation: +v.r || 0 }, f); }));
  },
  clear() { App.selection.forEach(el => el.removeAttribute('filter')); History.commit(); },
};

const Grid = {
  on: false,
  toggle() {
    this.on = !this.on;
    let r = $('gridRect');
    if (!r) {
      const p = svgEl('pattern', { id: 'gridPat', width: App.gridSize, height: App.gridSize, patternUnits: 'userSpaceOnUse' }, $('stageDefs'));
      svgEl('path', { d: `M${App.gridSize} 0H0V${App.gridSize}`, fill: 'none', stroke: '#c8d4ff', 'stroke-width': .5 }, p);
      r = svgEl('rect', { id: 'gridRect', fill: 'url(#gridPat)', 'pointer-events': 'none' }); App.els.content.before(r);
    }
    r.setAttribute('width', App.doc.width); r.setAttribute('height', App.doc.height);
    r.style.display = this.on ? '' : 'none';
  },
};

const Menus = {
  shortcuts: [],
  build() {
    const bar = $('menus'), pop = $('menuPopup');
    for (const name in MENUS) {
      const b = document.createElement('div'); b.className = 'menu-btn'; b.textContent = name; bar.appendChild(b);
      b.onmousedown = e => { e.stopPropagation(); this.openMenu === name ? this.close() : this.show(name, b); };
      b.onmouseenter = () => { if (this.openMenu && this.openMenu !== name) this.show(name, b); };
      for (const it of MENUS[name]) if (it !== '-' && it[1]) this.shortcuts.push({ combo: this.parse(it[1]), fn: () => History.named(it[0].split(' ▸ ').pop().replace('…', ''), it[2]) });
    }
    document.addEventListener('mousedown', e => { if (!pop.contains(e.target)) this.close(); });
  },
  show(name, btn) {
    const pop = $('menuPopup'); this.openMenu = name;
    document.querySelectorAll('.menu-btn').forEach(m => m.classList.toggle('open', m === btn));
    pop.innerHTML = '';
    for (const it of MENUS[name]) {
      if (it === '-') { pop.insertAdjacentHTML('beforeend', '<div class="menu-sep"></div>'); continue; }
      const [label, key, fn, check] = it, row = document.createElement('div'); row.className = 'menu-item';
      row.innerHTML = `<span>${check && check() ? '✓ ' : ''}${label}</span><span class="kbd">${key.replace('Delete', 'Supr')}</span>`;
      row.onclick = () => { this.close(); History.named(label.split(' ▸ ').pop().replace('…', ''), fn); };
      pop.appendChild(row);
    }
    const r = btn.getBoundingClientRect(); pop.style.left = r.left + 'px'; pop.style.top = r.bottom + 'px'; pop.hidden = false;
  },
  close() { this.openMenu = null; $('menuPopup').hidden = true; document.querySelectorAll('.menu-btn').forEach(m => m.classList.remove('open')); },
  refreshChecks() { /* las marcas se recalculan al abrir el menú */ },
  togglePanel(id) { Dock.show(id); },
  parse(s) {
    const parts = s.split('+'), key = parts.pop();
    return { ctrl: parts.includes('Ctrl'), shift: parts.includes('Shift'), alt: parts.includes('Alt'), key: key.toLowerCase() };
  },
  match(ev) {
    const k = ev.key.toLowerCase(), code = ev.code;
    for (const s of this.shortcuts) {
      const c = s.combo;
      if (c.ctrl !== (ev.ctrlKey || ev.metaKey) || c.alt !== ev.altKey) continue;
      const keyOk = k === c.key || (c.key === '=' && (k === '+' || code === 'Equal' || code === 'NumpadAdd')) || (c.key === '-' && code === 'NumpadSubtract')
        || (c.key === ']' && code === 'BracketRight') || (c.key === '[' && code === 'BracketLeft') || (c.key === "'" && code === 'Quote')
        || (/^\d$/.test(c.key) && code === 'Digit' + c.key);
      if (!keyOk) continue;
      if (c.shift !== ev.shiftKey && !(c.key === '=' && k === '+')) continue;
      return s.fn;
    }
    return null;
  },
};
