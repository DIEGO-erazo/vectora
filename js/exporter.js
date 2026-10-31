/* Vectora — exportación: «Exportar como» con opciones por formato y «Exportar para pantallas» */
'use strict';

/* ---------- utilidades binarias: CRC32, ZIP (sin compresión) y resolución en PNG/JPG ---------- */
const Bin = {
  crc32(u8) {
    let t = this._t;
    if (!t) { t = this._t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } }
    let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = t[(c ^ u8[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  },
  zip(files) {
    const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
    for (const f of files) {
      const nm = enc.encode(f.name), crc = this.crc32(f.data), sz = f.data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true);
      parts.push(new Uint8Array(lh.buffer), nm, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true);
      ch.setUint16(28, nm.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nm);
      offset += 30 + nm.length + sz;
    }
    const cd = central.reduce((n, p) => n + p.length, 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cd, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  },
  /* fragmento pHYs: el PNG declara sus ppp (72, 150, 300…) */
  pngDpi(u8, ppi) {
    const ppm = Math.round(ppi / 0.0254), chunk = new Uint8Array(21), dv = new DataView(chunk.buffer);
    dv.setUint32(0, 9); chunk.set([0x70, 0x48, 0x59, 0x73], 4); dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
    dv.setUint32(17, this.crc32(chunk.subarray(4, 17)));
    const out = new Uint8Array(u8.length + 21); out.set(u8.subarray(0, 33)); out.set(chunk, 33); out.set(u8.subarray(33), 54);
    return out;
  },
  jpgDpi(u8, ppi) {
    if (u8[2] === 0xFF && u8[3] === 0xE0 && u8[6] === 0x4A) { u8[13] = 1; u8[14] = ppi >> 8; u8[15] = ppi & 255; u8[16] = ppi >> 8; u8[17] = ppi & 255; }
    return u8;
  },
};

/* ---------- opciones de SVG ---------- */
const GEOM_ATTRS = ['d', 'points', 'transform', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'fx', 'fy', 'width', 'height',
  'stroke-width', 'viewBox', 'dx', 'dy', 'font-size', 'stdDeviation', 'offset', 'refX', 'refY', 'markerWidth', 'markerHeight'];
const STYLE_ATTRS = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-miterlimit', 'fill-opacity',
  'stroke-opacity', 'fill-rule', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor'];
const SvgOpts = {
  apply(svg, o) {
    const dec = +o.dec || 3, rnd = s => s.replace(/-?\d*\.\d+(?:e-?\d+)?/gi, m => String(round(+m, dec)));
    for (const el of [svg, ...svg.querySelectorAll('*')]) for (const a of GEOM_ATTRS) if (el.hasAttribute(a)) el.setAttribute(a, rnd(el.getAttribute(a)));
    if (!o.vdata) {
      const used = new Set();
      svg.querySelectorAll('metadata#vectora-meta').forEach(m => m.remove());
      for (const el of svg.querySelectorAll('*')) {
        const nm = el.getAttribute('data-name');
        if (nm && !el.id.startsWith('grad') && el.classList.contains('layer')) {
          let id = nm.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^(\d)/, '_$1') || 'capa';
          while (used.has(id)) id += '_'; used.add(id); el.id = id;
        }
        for (const a of [...el.attributes]) if (a.name.startsWith('data-')) el.removeAttribute(a.name);
        el.classList.remove('layer'); if (el.getAttribute('class') === '') el.removeAttribute('class');
      }
    }
    if (o.css === 'css') {
      const map = new Map();
      for (const el of svg.querySelectorAll('path,rect,ellipse,circle,polygon,polyline,line,text')) {
        const decl = STYLE_ATTRS.filter(a => el.hasAttribute(a)).map(a => `${a}:${el.getAttribute(a)}`).join(';'); if (!decl) continue;
        if (!map.has(decl)) map.set(decl, 'st' + map.size);
        STYLE_ATTRS.forEach(a => el.removeAttribute(a)); el.classList.add(map.get(decl));
      }
      if (map.size) {
        let defs = svg.querySelector(':scope > defs'); if (!defs) { defs = svgEl('defs'); svg.prepend(defs); }
        const st = svgEl('style'); st.textContent = [...map].map(([d, c]) => `.${c}{${d}}`).join(o.minify ? '' : '\n'); defs.prepend(st);
      }
    }
    if (o.resp) { svg.removeAttribute('width'); svg.removeAttribute('height'); }
    let text = new XMLSerializer().serializeToString(svg);
    if (!o.minify) text = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Creado con Vectora (editor vectorial libre) -->\n' + text;
    return text;
  },
};

/* ---------- exportación ---------- */
const Export = {
  cleanName(s) { return String(s).replace(/[\\/:*?"<>|]+/g, '-').trim() || 'vectora'; },
  /* área exportada: mesa de trabajo, con sangrado, selección o todo el arte */
  area(kind) {
    const d = App.doc, b = d.bleed || 0;
    if (kind === 'sel' && App.selection.length) return { box: Geo.selBox(App.selection), only: App.selection };
    if (kind === 'art') return { box: Geo.selBox(Layers.objects().filter(o => !Layers.isHidden(o))) || { x: 0, y: 0, width: d.width, height: d.height }, only: null };
    if (kind === 'bleed') return { box: { x: -b, y: -b, width: d.width + 2 * b, height: d.height + 2 * b }, only: null };
    return { box: { x: 0, y: 0, width: d.width, height: d.height }, only: null };
  },
  bgColor(v, mime) {
    if (v.bg === 'transparent') return mime === 'image/jpeg' ? '#ffffff' : null;
    return { white: '#ffffff', black: '#000000' }[v.bg] || v.bgc;
  },
  /* imagen rasterizada a escala (ppp / 72), con ppp declarados en el archivo */
  async raster(box, only, ppi, mime, v) {
    const svg = IO.buildSVG(true, box, only);
    if (v.aa === 'none') svg.setAttribute('shape-rendering', 'crispEdges');
    const blob = await IO.rasterize(new XMLSerializer().serializeToString(svg), box.width, box.height, ppi / 72, this.bgColor(v, mime), mime, clamp(+v.q, 0, 10) / 10);
    let u8 = new Uint8Array(await blob.arrayBuffer());
    if (mime === 'image/png') u8 = Bin.pngDpi(u8, ppi); else if (mime === 'image/jpeg') u8 = Bin.jpgDpi(u8, ppi);
    return new Blob([u8], { type: mime });
  },
  /* marcas de recorte en las esquinas de la mesa de trabajo (para imprenta) */
  addCropMarks(svg, box) {
    const d = App.doc, b = d.bleed || 0, off = b + 6, len = 18, m = off + len + 6;
    const nb = { x: -m, y: -m, width: d.width + 2 * m, height: d.height + 2 * m };
    Object.assign(box, nb); svg.setAttribute('viewBox', `${nb.x} ${nb.y} ${nb.width} ${nb.height}`); svg.setAttribute('width', nb.width); svg.setAttribute('height', nb.height);
    const g = svgEl('g', { stroke: '#000', 'stroke-width': 0.3, fill: 'none' }, svg);
    for (const [x, y, sx, sy] of [[0, 0, -1, -1], [d.width, 0, 1, -1], [0, d.height, -1, 1], [d.width, d.height, 1, 1]]) {
      svgEl('line', { x1: x + sx * off, y1: y, x2: x + sx * (off + len), y2: y }, g);
      svgEl('line', { x1: x, y1: y + sy * off, x2: x, y2: y + sy * (off + len) }, g);
    }
  },
  async pdfBlob(svg, box) {
    await Lib.load(Lib.url('jspdf')); await Lib.load(Lib.url('svg2pdf'));
    const { jsPDF } = window.jspdf, w = box.width, h = box.height;
    const pdf = new jsPDF({ unit: 'pt', format: [w, h], orientation: w > h ? 'landscape' : 'portrait', compress: true });
    const holder = document.createElement('div'); holder.style.cssText = 'position:fixed;left:-99999px;top:0';
    holder.appendChild(svg); document.body.appendChild(holder);
    try { await pdf.svg(svg, { x: 0, y: 0, width: w, height: h }); } finally { holder.remove(); }
    pdf.setProperties({ title: App.doc.title, creator: 'Vectora' });
    return pdf.output('blob');
  },
  busy(msg) { $('sbHint').textContent = msg || ''; document.body.style.cursor = msg ? 'progress' : ''; },

  async dialog(fmt = 'png') {
    const d = App.doc, hasSel = App.selection.length > 0;
    const raster = v => ['png', 'jpg', 'webp'].includes(v.fmt);
    const v = await Dialog.form('Exportar como', [
      { id: 'fmt', label: 'Formato', type: 'select', value: fmt, options: [['png', 'PNG'], ['jpg', 'JPEG'], ['webp', 'WebP'], ['svg', 'SVG'], ['pdf', 'PDF']] },
      { id: 'area', label: 'Área', type: 'select', value: 'doc', options: [['doc', 'Mesa de trabajo'], ...(d.bleed ? [['bleed', 'Mesa de trabajo + sangrado']] : []),
        ...(hasSel ? [['sel', 'Solo la selección']] : []), ['art', 'Todo el arte (ajustado)']] },
      { id: 'h1', type: 'heading', label: 'Opciones de imagen', show: raster },
      { id: 'res', label: 'Resolución', type: 'select', value: '150', options: [['72', 'Pantalla (72 ppp)'], ['150', 'Media (150 ppp)'], ['300', 'Alta (300 ppp)'], ['custom', 'Otra…']], show: raster },
      { id: 'ppi', label: 'ppp', type: 'number', value: 600, min: 10, max: 2400, show: v => raster(v) && v.res === 'custom' },
      { id: 'bg', label: 'Fondo', type: 'select', value: 'white', options: [['transparent', 'Transparente'], ['white', 'Blanco'], ['black', 'Negro'], ['custom', 'Color…']], show: raster },
      { id: 'bgc', label: 'Color de fondo', type: 'color', value: '#ffffff', show: v => raster(v) && v.bg === 'custom' },
      { id: 'aa', label: 'Suavizado', type: 'select', value: 'art', options: [['art', 'Optimizado para el arte'], ['none', 'Ninguno (píxeles nítidos)']], show: raster },
      { id: 'q', label: 'Calidad (0-10)', type: 'number', value: 8, min: 0, max: 10, show: v => v.fmt === 'jpg' || v.fmt === 'webp' },
      { id: 'h2', type: 'heading', label: 'Opciones SVG', show: v => v.fmt === 'svg' },
      { id: 'css', label: 'Estilo', type: 'select', value: 'attr', options: [['attr', 'Atributos de presentación'], ['css', 'CSS interno']], show: v => v.fmt === 'svg' },
      { id: 'dec', label: 'Decimales', type: 'select', value: '3', options: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']], show: v => v.fmt === 'svg' },
      { id: 'minify', label: 'Minificar', type: 'checkbox', value: false, show: v => v.fmt === 'svg' },
      { id: 'resp', label: 'Adaptable (responsive)', type: 'checkbox', value: false, show: v => v.fmt === 'svg' },
      { id: 'vdata', label: 'Conservar datos de Vectora', type: 'checkbox', value: false, show: v => v.fmt === 'svg' },
      { id: 'h3', type: 'heading', label: 'Opciones PDF', show: v => v.fmt === 'pdf' },
      { id: 'pdfMode', label: 'Tipo', type: 'select', value: 'vector', options: [['vector', 'PDF vectorial'], ['print', 'Imprimir / Guardar como PDF']], show: v => v.fmt === 'pdf' },
      { id: 'marks', label: 'Marcas de recorte', type: 'checkbox', value: false, show: v => v.fmt === 'pdf' && v.pdfMode === 'vector' },
    ], { ok: 'Exportar…' });
    if (v) await this.run(v);
  },
  async run(v) {
    const { box, only } = this.area(v.area);
    if (!box || !box.width || !box.height) return Dialog.alert('El área elegida está vacía.');
    const base = this.cleanName(App.doc.title + (v.area === 'sel' ? '-seleccion' : ''));
    try {
      if (v.fmt === 'svg') {
        const text = SvgOpts.apply(IO.buildSVG(true, box, only), v);
        return void await Files.save(new Blob([text], { type: 'image/svg+xml' }), base + '.svg', [FT.svg]);
      }
      if (v.fmt === 'pdf') {
        const svg = IO.buildSVG(true, { ...box }, only), pbox = { ...box };
        if (v.pdfMode === 'print') return IO.printPDF(new XMLSerializer().serializeToString(svg), box.width, box.height);
        if (v.marks) this.addCropMarks(svg, pbox);
        const target = await Files.pickSave(base + '.pdf', [FT.pdf]); if (!target) return;
        this.busy('Generando PDF…');
        return void await Files.write(target, await this.pdfBlob(svg, pbox));
      }
      const mime = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[v.fmt], ppi = v.res === 'custom' ? clamp(+v.ppi || 72, 10, 2400) : +v.res;
      const px = Math.round(box.width * ppi / 72) * Math.round(box.height * ppi / 72);
      if (px > 16384 * 16384 / 2) return Dialog.alert('La imagen sería demasiado grande. Baja la resolución.');
      const target = await Files.pickSave(base + '.' + v.fmt, [FT[v.fmt]]); if (!target) return;
      this.busy('Exportando…');
      await Files.write(target, await this.raster(box, only, ppi, mime, v));
    } catch (e) {
      Dialog.alert('No se pudo exportar: ' + e.message + (v.fmt === 'pdf' ? '\nEl PDF vectorial necesita conexión a internet la primera vez (versión web).' : ''));
    } finally { this.busy(''); }
  },

  /* ---------- Exportar para pantallas: varias escalas y formatos en un ZIP ---------- */
  async screens() {
    const hasSel = App.selection.length > 0;
    const v = await Dialog.form('Exportar para pantallas', [
      { id: 'assets', label: 'Recursos', type: 'select', value: hasSel ? 'sel' : 'doc', options: [['doc', 'Mesa de trabajo'], ...(hasSel ? [['sel', 'Cada objeto seleccionado']] : []), ['layers', 'Cada capa']] },
      { id: 'preset', label: 'Formatos', type: 'select', value: 'web', options: [['web', 'Web (1x, 2x PNG + SVG)'], ['ios', 'iOS (1x, 2x, 3x PNG)'],
        ['android', 'Android (mdpi … xxxhdpi PNG)'], ['custom', 'Personalizado…']] },
      { id: 'scales', label: 'Escalas', value: '1, 2', show: v => v.preset === 'custom' },
      { id: 'png', label: 'PNG', type: 'checkbox', value: true, show: v => v.preset === 'custom' },
      { id: 'jpg', label: 'JPEG', type: 'checkbox', value: false, show: v => v.preset === 'custom' },
      { id: 'webp', label: 'WebP', type: 'checkbox', value: false, show: v => v.preset === 'custom' },
      { id: 'svg', label: 'SVG', type: 'checkbox', value: false, show: v => v.preset === 'custom' },
      { id: 'pdf', label: 'PDF', type: 'checkbox', value: false, show: v => v.preset === 'custom' },
      { id: 'prefix', label: 'Prefijo', value: '' },
    ], { ok: 'Exportar…', note: 'Se genera un archivo ZIP con todos los recursos.' });
    if (!v) return;
    /* recursos */
    const assets = [];
    if (v.assets === 'doc') assets.push({ name: App.doc.title, ...this.area('doc') });
    else if (v.assets === 'sel') App.selection.forEach((el, i) => assets.push({ name: el.getAttribute('data-name') || `${objName(el).replace(/[<>]/g, '')}-${i + 1}`, box: Geo.bbox(el), only: [el] }));
    else Layers.all().filter(l => l.getAttribute('display') !== 'none').forEach(l => { const only = [...l.children]; const box = Geo.selBox(only); if (box) assets.push({ name: l.getAttribute('data-name'), box, only }); });
    /* formatos: [carpeta, sufijo, escala, formato] */
    const specs = {
      web: [['', '', 1, 'png'], ['', '@2x', 2, 'png'], ['', '', 1, 'svg']],
      ios: [['', '', 1, 'png'], ['', '@2x', 2, 'png'], ['', '@3x', 3, 'png']],
      android: [['drawable-mdpi/', '', 1, 'png'], ['drawable-hdpi/', '', 1.5, 'png'], ['drawable-xhdpi/', '', 2, 'png'], ['drawable-xxhdpi/', '', 3, 'png'], ['drawable-xxxhdpi/', '', 4, 'png']],
    }[v.preset] || (() => {
      const scales = v.scales.split(/[\s,;x]+/).map(Number).filter(s => s > 0 && s <= 16), out = [];
      for (const f of ['png', 'jpg', 'webp']) if (v[f]) for (const s of scales) out.push(['', s === 1 ? '' : `@${s}x`, s, f]);
      for (const f of ['svg', 'pdf']) if (v[f]) out.push(['', '', 1, f]);
      return out;
    })();
    if (!assets.length || !specs.length) return Dialog.alert('No hay nada que exportar.');
    const target = await Files.pickSave(this.cleanName(App.doc.title) + '-recursos.zip', [FT.zip]); if (!target) return;
    const files = [], opts = { bg: 'transparent', aa: 'art', q: 9, dec: 3, css: 'attr', vdata: false, minify: false, resp: false };
    try {
      let n = 0;
      for (const a of assets) for (const [dir, suf, s, f] of specs) {
        this.busy(`Exportando ${++n} de ${assets.length * specs.length}…`);
        const name = `${dir}${this.cleanName(v.prefix + a.name)}${suf}.${f}`;
        let blob;
        if (f === 'svg') blob = new Blob([SvgOpts.apply(IO.buildSVG(true, a.box, a.only), opts)]);
        else if (f === 'pdf') blob = await this.pdfBlob(IO.buildSVG(true, a.box, a.only), a.box);
        else blob = await this.raster(a.box, a.only, 72 * s, { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[f], { ...opts, bg: f === 'jpg' ? 'white' : 'transparent' });
        files.push({ name, data: new Uint8Array(await blob.arrayBuffer()) });
      }
      await Files.write(target, Bin.zip(files));
      $('sbHint').textContent = `✔ ${files.length} archivos exportados`;
      setTimeout(() => this.busy(''), 3000); document.body.style.cursor = '';
    } catch (e) { this.busy(''); Dialog.alert('No se pudo exportar: ' + e.message); }
  },
};
