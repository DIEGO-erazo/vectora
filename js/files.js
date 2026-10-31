/* Vectora — acceso a archivos.
   · Programa de escritorio (Electron): diálogos nativos y escritura directa en disco.
   · Chrome / Edge: File System Access API (guardar sobre el mismo archivo).
   · Otros navegadores: descarga e <input type=file>. */
'use strict';

const Files = {
  desktop: window.vectoraDesktop || null,
  /* tipos: [{ description, mime, ext: ['.png'] }] */
  async pickSave(name, types) {
    if (this.desktop) {
      const path = await this.desktop.saveDialog({ defaultPath: name, filters: types.map(t => ({ name: t.description, extensions: t.ext.map(e => e.slice(1)) })) });
      return path ? { path, name: path.split(/[\\/]/).pop() } : null;
    }
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: types.map(t => ({ description: t.description, accept: { [t.mime]: t.ext } })) });
        return { handle, name: handle.name };
      } catch (e) { if (e.name === 'AbortError') return null; }
    }
    return { download: true, name };
  },
  async write(target, blob) {
    if (target.path) return this.desktop.writeFile(target.path, new Uint8Array(await blob.arrayBuffer()));
    if (target.handle) { const w = await target.handle.createWritable(); await w.write(blob); await w.close(); return; }
    IO.download(blob, target.name);
  },
  async save(blob, name, types) { const t = await this.pickSave(name, types); if (t) await this.write(t, blob); return t; },
  /* devuelve [{ file: File, path?, handle? }] */
  async pick(types, multiple = false) {
    const exts = types.flatMap(t => t.ext);
    if (this.desktop) {
      const paths = await this.desktop.openDialog({ multiple, filters: [{ name: 'Archivos compatibles', extensions: exts.map(e => e.slice(1)) }, ...types.map(t => ({ name: t.description, extensions: t.ext.map(e => e.slice(1)) }))] });
      return Promise.all((paths || []).map(p => this.fromPath(p)));
    }
    if (window.showOpenFilePicker) {
      try {
        const hs = await window.showOpenFilePicker({ multiple, types: [{ description: 'Archivos compatibles', accept: Object.fromEntries(types.map(t => [t.mime, t.ext])) }] });
        return Promise.all(hs.map(async handle => ({ file: await handle.getFile(), handle })));
      } catch (e) { if (e.name === 'AbortError') return []; }
    }
    return new Promise(res => {
      const inp = $('fileInput'); inp.accept = exts.join(','); inp.multiple = multiple; inp.value = '';
      inp.onchange = () => res([...inp.files].map(file => ({ file })));
      inp.click();
    });
  },
  async fromPath(path) {
    const bytes = await this.desktop.readFile(path), name = path.split(/[\\/]/).pop();
    return { file: new File([bytes], name, { type: MIME_BY_EXT[(name.match(/\.[^.]+$/) || [''])[0].toLowerCase()] || '' }), path };
  },
};

const MIME_BY_EXT = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.bmp': 'image/bmp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.ai': 'application/pdf', '.zip': 'application/zip' };
const FT = {
  svg: { description: 'SVG (Vectora)', mime: 'image/svg+xml', ext: ['.svg'] },
  png: { description: 'Imagen PNG', mime: 'image/png', ext: ['.png'] },
  jpg: { description: 'Imagen JPEG', mime: 'image/jpeg', ext: ['.jpg', '.jpeg'] },
  webp: { description: 'Imagen WebP', mime: 'image/webp', ext: ['.webp'] },
  pdf: { description: 'Documento PDF', mime: 'application/pdf', ext: ['.pdf'] },
  ai: { description: 'Adobe Illustrator (compatible con PDF)', mime: 'application/pdf', ext: ['.ai'] },
  zip: { description: 'Archivo ZIP', mime: 'application/zip', ext: ['.zip'] },
  image: { description: 'Imágenes', mime: 'image/*', ext: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif', '.ico'] },
};

/* cargador perezoso de librerías externas (solo PDF); el service worker las guarda para uso sin conexión */
const LIBS = {
  jspdf: ['jspdf@2.5.1', 'dist/jspdf.umd.min.js'], svg2pdf: ['svg2pdf.js@2.2.3', 'dist/svg2pdf.umd.min.js'],
  pdfjs: ['pdfjs-dist@3.11.174', 'build/pdf.min.js'], pdfworker: ['pdfjs-dist@3.11.174', 'build/pdf.worker.min.js'],
};
const Lib = {
  cache: {},
  /* en el programa de escritorio las librerías van incluidas; en la web se cargan del CDN */
  url(key) { const [pkg, path] = LIBS[key]; return Files.desktop ? `node_modules/${pkg.replace(/@[^@]+$/, '')}/${path}` : `https://cdn.jsdelivr.net/npm/${pkg}/${path}`; },
  load(url) {
    return this.cache[url] ||= new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = url; s.crossOrigin = 'anonymous';
      s.onload = res; s.onerror = () => { delete this.cache[url]; rej(new Error('No se pudo cargar ' + url)); };
      document.head.appendChild(s);
    });
  },
};
