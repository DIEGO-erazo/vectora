/* Vectora — Calco de imagen: convierte una imagen rasterizada en trazados vectoriales (imagetracerjs) */
'use strict';

const TRACE_PRESETS = {
  photoHi: ['Fotografía de alta fidelidad', { colors: 48, detail: 9, noise: 4, blur: 0 }],
  photoLo: ['Fotografía de baja fidelidad', { colors: 20, detail: 6, noise: 8, blur: 1 }],
  c3: ['3 colores', { colors: 3, detail: 6, noise: 10, blur: 1 }],
  c6: ['6 colores', { colors: 6, detail: 6, noise: 8, blur: 1 }],
  c16: ['16 colores', { colors: 16, detail: 7, noise: 8, blur: 0 }],
  gray: ['Tonos de gris', { colors: 8, detail: 7, noise: 8, blur: 1, mode: 'gray' }],
  bw: ['Blanco y negro', { colors: 2, detail: 7, noise: 8, blur: 0, mode: 'bw', threshold: 128 }],
  silhouette: ['Silueta', { colors: 2, detail: 6, noise: 12, blur: 1, mode: 'bw', threshold: 128, ignoreWhite: true }],
};

const Trace = {
  images() { return App.selection.filter(e => e.tagName === 'image'); },
  async dialog() {
    const img = this.images()[0]; if (!img) return Dialog.alert('Selecciona una imagen para calcarla.');
    const P = TRACE_PRESETS;
    const v = await Dialog.form('Calco de imagen', [
      { id: 'preset', label: 'Ajuste preestablecido', type: 'select', value: 'c6', options: [...Object.entries(P).map(([k, [n]]) => [k, n]), ['custom', 'Personalizado']] },
      { id: 'colors', label: 'Colores', type: 'number', value: 6, min: 2, max: 64, show: v => v.preset === 'custom' },
      { id: 'mode', label: 'Modo', type: 'select', value: 'color', options: [['color', 'Color'], ['gray', 'Escala de grises'], ['bw', 'Blanco y negro']], show: v => v.preset === 'custom' },
      { id: 'threshold', label: 'Umbral (0-255)', type: 'number', value: 128, min: 0, max: 255, show: v => v.preset === 'custom' ? v.mode === 'bw' : ['bw', 'silhouette'].includes(v.preset) },
      { id: 'detail', label: 'Detalle (1-10)', type: 'number', value: 6, min: 1, max: 10, show: v => v.preset === 'custom' },
      { id: 'noise', label: 'Ruido (px)', type: 'number', value: 8, min: 0, max: 100, show: v => v.preset === 'custom' },
      { id: 'ignoreWhite', label: 'Ignorar el blanco', type: 'checkbox', value: false },
      { id: 'keep', label: 'Conservar la imagen original', type: 'checkbox', value: false },
    ], { ok: 'Calcar', note: 'El calco convierte la imagen en formas vectoriales editables. Las imágenes grandes pueden tardar unos segundos.' });
    if (!v) return;
    const o = v.preset === 'custom'
      ? { colors: clamp(Math.round(+v.colors), 2, 64), mode: v.mode, threshold: +v.threshold, detail: clamp(+v.detail, 1, 10), noise: Math.max(0, +v.noise), blur: 0 }
      : { ...P[v.preset][1], ...(v.preset === 'bw' || v.preset === 'silhouette' ? { threshold: +v.threshold } : {}) };
    o.ignoreWhite = v.ignoreWhite || o.ignoreWhite;
    for (const im of this.images()) await this.run(im, o, v.keep);
  },
  async run(img, o, keep) {
    Export.busy('Calcando imagen…');
    await new Promise(r => setTimeout(r, 30)); /* deja pintar el aviso */
    try {
      await Lib.load(Lib.url('trace'));
      const url = img.getAttribute('href') || img.getAttribute('xlink:href'), pic = await loadImage(url);
      /* trabajar a una resolución razonable: más detalle = más píxeles */
      const maxSide = 300 + o.detail * 90, k = Math.min(1, maxSide / Math.max(pic.naturalWidth, pic.naturalHeight));
      const cw = Math.max(1, Math.round(pic.naturalWidth * k)), ch = Math.max(1, Math.round(pic.naturalHeight * k));
      const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch); ctx.drawImage(pic, 0, 0, cw, ch);
      const data = ctx.getImageData(0, 0, cw, ch), px = data.data;
      if (o.mode === 'gray' || o.mode === 'bw') for (let i = 0; i < px.length; i += 4) {
        let g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        if (o.mode === 'bw') g = g < o.threshold ? 0 : 255;
        px[i] = px[i + 1] = px[i + 2] = g;
      }
      const opts = {
        numberofcolors: o.colors, colorsampling: o.mode === 'bw' ? 0 : 2, colorquantcycles: 3,
        pathomit: o.noise, ltres: 2.2 - o.detail * 0.2, qtres: 2.2 - o.detail * 0.2, blurradius: o.blur, blurdelta: 20,
        strokewidth: 0, linefilter: o.detail < 5, roundcoords: 2, viewbox: true, desc: false, scale: 1,
        ...(o.mode === 'bw' ? { pal: [{ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }] } : {}),
      };
      const svgText = ImageTracer.imagedataToSVG(data, opts);
      const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      /* grupo con la misma colocación que la imagen */
      const x = +img.getAttribute('x') || 0, y = +img.getAttribute('y') || 0, w = +img.getAttribute('width') || pic.naturalWidth, h = +img.getAttribute('height') || pic.naturalHeight;
      const g = svgEl('g', { id: uid(), 'data-name': '<Calco de imagen>' });
      let n = 0;
      for (const p of doc.querySelectorAll('path')) {
        const fill = normColor(p.getAttribute('fill') || '#000'), op = +(p.getAttribute('opacity') ?? p.getAttribute('fill-opacity') ?? 1);
        if (op < 0.05) continue;
        if (o.ignoreWhite && fill.startsWith('#')) { const c = hexToRgb(fill); if (c.r > 245 && c.g > 245 && c.b > 245) continue; }
        svgEl('path', { d: p.getAttribute('d'), fill, stroke: 'none' }, g); n++;
      }
      if (!n) throw new Error('el resultado quedó vacío; prueba otro ajuste');
      img.after(g);
      Geo.setMatrix(g, Geo.local(img).multiply(new DOMMatrix().translate(x, y).scale(w / cw, h / ch)));
      if (!keep) img.remove(); else img.setAttribute('display', 'none');
      Selection.set([g]); History.named('Calco de imagen', () => History.commit()); App.emit('layers');
      $('sbHint').textContent = `✔ Calco: ${n} formas`;
    } catch (e) {
      Dialog.alert('No se pudo calcar la imagen: ' + e.message + (/cargar/.test(e.message) ? '\n(La versión web necesita conexión la primera vez.)' : ''));
    } finally { document.body.style.cursor = ''; setTimeout(() => { if (/Calcando/.test($('sbHint').textContent)) $('sbHint').textContent = ''; }, 100); }
  },
};
