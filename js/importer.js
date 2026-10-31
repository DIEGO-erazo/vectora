/* Vectora — importación (Abrir / Colocar: SVG, PDF, AI, imágenes) y Guardar / Guardar como */
'use strict';

const readDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
const loadImage = url => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('imagen no válida')); i.src = url; });

const Import = {
  types: [FT.svg, FT.pdf, FT.ai, FT.image],
  kind(file) {
    const n = file.name.toLowerCase();
    if (n.endsWith('.svg') || file.type === 'image/svg+xml') return 'svg';
    if (/\.(pdf|ai)$/.test(n) || file.type === 'application/pdf') return 'pdf';
    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif|ico)$/.test(n)) return 'image';
    return null;
  },
  async open() { const [f] = await Files.pick(this.types); if (f) await this.openFile(f); },
  /* abre un archivo como documento nuevo */
  async openFile({ file, handle, path }) {
    const k = this.kind(file), name = file.name.replace(/\.[^.]+$/, '');
    try {
      if (k === 'svg') IO.loadSVG(await file.text(), file.name);
      else if (k === 'pdf') { const t = await this.pdfToSVG(file); if (!t) return; IO.loadSVG(t, name); }
      else if (k === 'image') {
        const url = await readDataURL(file), img = await loadImage(url);
        IO.newDoc(img.naturalWidth, img.naturalHeight, false); App.doc.title = name;
        const el = addObject(svgEl('image', { href: url, x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight, preserveAspectRatio: 'none', 'data-name': file.name }));
        History.reset(); Selection.set([el]);
      } else return Dialog.alert(`«${file.name}» no es un formato compatible.\nAbre SVG, PDF, AI (compatible con PDF) o imágenes.`);
      IO.current = k === 'svg' && (handle || path) ? { handle, path, name: file.name } : null;
      Recent.add(handle || path ? { handle, path, name: file.name } : null);
      App.dirty = false; View.apply();
    } catch (e) { Dialog.alert('No se pudo abrir el archivo: ' + e.message); }
  },
  async place() { for (const f of await Files.pick(this.types, true)) await this.placeFile(f.file); },
  /* coloca un archivo en el documento actual */
  async placeFile(file) {
    const k = this.kind(file);
    try {
      if (k === 'svg') IO.placeSVG(await file.text());
      else if (k === 'pdf') { const t = await this.pdfToSVG(file); if (t) IO.placeSVG(t); }
      else if (k === 'image') Actions.placeImage(await readDataURL(file));
      else Dialog.alert(`«${file.name}» no es un formato compatible.`);
    } catch (e) { Dialog.alert('No se pudo colocar el archivo: ' + e.message); }
  },
  /* PDF / AI -> SVG vectorial con pdf.js (SVGGraphics) */
  async pdfToSVG(file) {
    Export.busy('Leyendo PDF…');
    try {
      await Lib.load(Lib.url('pdfjs'));
      pdfjsLib.GlobalWorkerOptions.workerSrc = Lib.url('pdfworker');
      let pdf;
      try { pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise; }
      catch (e) { throw new Error(/\.ai$/i.test(file.name) ? 'este .ai no es compatible con PDF. En Illustrator, guárdalo con «Crear archivo compatible con PDF».' : 'el PDF está dañado o protegido.'); }
      let n = 1;
      if (pdf.numPages > 1) {
        Export.busy('');
        const v = await Dialog.form('Importar PDF', [{ id: 'p', label: `Página (1 – ${pdf.numPages})`, type: 'number', value: 1, min: 1, max: pdf.numPages }]);
        if (!v) return null; n = clamp(Math.round(+v.p) || 1, 1, pdf.numPages);
        Export.busy('Leyendo PDF…');
      }
      const page = await pdf.getPage(n), vp = page.getViewport({ scale: 1 });
      const gfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs, true); gfx.embedFonts = true;
      const svg = await gfx.getSVG(await page.getOperatorList(), vp);
      let text = new XMLSerializer().serializeToString(svg).replace(/<(\/?)svg:/g, '<$1').replace(/\sxmlns:svg="[^"]*"/g, '');
      if (!/^<svg[^>]*\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(text)) text = text.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      return text;
    } catch (e) {
      if (/cargar/.test(e.message)) throw new Error('para abrir PDF/AI la versión web necesita conexión a internet la primera vez.');
      throw e;
    } finally { Export.busy(''); }
  },
};

/* ---------- Guardar / Guardar como ---------- */
Object.assign(IO, {
  current: null,
  docBlob() { return new Blob([IO.serialize(false)], { type: 'image/svg+xml' }); },
  async save() {
    if (!this.current) return this.saveAs();
    try { await Files.write(this.current, this.docBlob()); this.saved(); }
    catch (e) { this.current = null; return this.saveAs(); }
    return true;
  },
  async saveAs() {
    const t = await Files.pickSave(Export.cleanName(App.doc.title) + '.svg', [FT.svg]); if (!t) return false;
    await Files.write(t, this.docBlob());
    if (!t.download) { this.current = t; App.doc.title = t.name.replace(/\.svg$/i, ''); }
    this.saved(); return true;
  },
  saved() { App.dirty = false; View.apply(); Docs.render(); if (this.current) Recent.add(this.current); $('sbHint').textContent = '✔ Guardado'; setTimeout(() => { if ($('sbHint').textContent === '✔ Guardado') $('sbHint').textContent = ''; }, 2500); },
});
App.on('change', () => { App.dirty = true; View.apply(); });
