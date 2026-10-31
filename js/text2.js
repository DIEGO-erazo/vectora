/* Vectora — texto de área, texto en trazado y «Crear contornos» */
'use strict';

Object.assign(ICONS, {
  areatext: '<rect x="3" y="3" width="18" height="18" stroke-dasharray="2 2"/><path d="M8 8h8M12 8v9"/>',
  pathtext: '<path d="M3 19c4-9 14-9 18 0" stroke-dasharray="2 2"/><path d="M8 5h8M12 5v8"/>',
});

const TextLayout = {
  /* rectángulo del texto de área (coordenadas del propio texto) o null */
  area(el) {
    const a = el && el.getAttribute('data-area'); if (!a) return null;
    const [x, y, width, height] = a.split(/\s+/).map(Number); return { x, y, width, height };
  },
  measurer: document.createElement('canvas').getContext('2d'),
  /* reparte el texto en líneas que caben en la anchura del área */
  wrap(el, txt, width) {
    const ctx = this.measurer, size = +el.getAttribute('font-size') || 16;
    ctx.font = `${el.getAttribute('font-style') || 'normal'} ${el.getAttribute('font-weight') || 'normal'} ${size}px "${el.getAttribute('font-family') || 'Arial'}"`;
    const ls = parseFloat(el.getAttribute('letter-spacing') || 0) * ((el.getAttribute('letter-spacing') || '').endsWith('em') ? size : 1);
    const w = s => ctx.measureText(s).width + ls * s.length, lines = [];
    for (const para of txt.split('\n')) {
      let line = '';
      for (const word of para.split(/ +/)) {
        const test = line ? line + ' ' + word : word;
        if (w(test) <= width || !line) {
          if (w(test) <= width) { line = test; continue; }
          /* palabra más larga que el área: se parte por caracteres */
          let part = ''; for (const ch of word) { if (w(part + ch) > width && part) { lines.push(part); part = ''; } part += ch; }
          line = part; continue;
        }
        lines.push(line); line = word;
      }
      lines.push(line);
    }
    return lines;
  },
  layoutArea(el, txt) {
    const a = this.area(el), size = +el.getAttribute('font-size') || 16, anchor = el.getAttribute('text-anchor') || 'start';
    const x = anchor === 'middle' ? a.x + a.width / 2 : anchor === 'end' ? a.x + a.width : a.x;
    const lead = round((+el.getAttribute('data-leading') || 120) / 100, 3) + 'em';
    el.setAttribute('x', round(x, 2)); el.setAttribute('y', round(a.y + size * 0.9, 2));
    el.setAttribute('data-text', txt); el.textContent = '';
    this.wrap(el, txt, a.width).forEach((line, i) => { const t = svgEl('tspan', { x: round(x, 2), dy: i ? lead : null }, el); t.textContent = line || ' '; });
  },
  /* convierte un trazado en la guía de un texto en trazado (el trazado deja de verse, como en Illustrator) */
  attachPath(el, src) {
    const pid = uid('tp');
    svgEl('path', { id: pid, d: PathData.serialize(pathSubsDoc(src)) }, docDefs());
    src.remove();
    const tp = svgEl('textPath', { href: '#' + pid, startOffset: '0' }, el);
    el.removeAttribute('x'); el.removeAttribute('y');
    return tp;
  },
  /* reajusta los textos de área (tras cambiar fuente, tamaño o interlineado) */
  relayout(els) { for (const el of els) if (this.area(el)) this.layoutArea(el, el.getAttribute('data-text') || el.textContent); },
};

/* ---------- herramientas Texto de área y Texto en trazado ---------- */
App.tools.areatext = {
  cursor: 'crosshair',
  options: (...a) => TextTool.options(...a), bindOptions: (...a) => TextTool.bindOptions(...a),
  down(p, ev) {
    ev.preventDefault();
    if (TextTool.editing) return TextTool.commit();
    const o = hitObject(ev); if (o && o.tagName === 'text') return TextTool.edit(o);
    this.p0 = snapPt(p, ev); Marquee.start(this.p0);
  },
  move(p) { if (this.p0) Marquee.move(p); },
  up() {
    const p0 = this.p0, p1 = Marquee.p1; this.p0 = null; Marquee.el && Marquee.el.remove(); Marquee.el = null; Marquee.p1 = null;
    if (!p0) return;
    let r = p1 && { x: Math.min(p0.x, p1.x), y: Math.min(p0.y, p1.y), width: Math.abs(p1.x - p0.x), height: Math.abs(p1.y - p0.y) };
    if (!r || r.width * App.view.zoom < 8) r = { x: p0.x, y: p0.y, width: 200, height: 100 }; /* clic: área por defecto */
    TextTool.edit(null, null, { area: r });
  },
  deactivate() { TextTool.commit(); },
};
App.tools.pathtext = {
  cursor: 'crosshair',
  options: (...a) => TextTool.options(...a), bindOptions: (...a) => TextTool.bindOptions(...a),
  down(p, ev) {
    ev.preventDefault();
    if (TextTool.editing) return TextTool.commit();
    let t = hitTarget(ev); if (t && t.tagName === 'tspan') t = t.closest('text');
    if (t && t.tagName === 'textPath') t = t.closest('text');
    if (t && t.tagName === 'text') return TextTool.edit(t);
    if (!t || !editable(t)) return void ($('sbHint').textContent = 'Texto en trazado: haz clic sobre un trazado');
    TextTool.edit(null, null, { path: PathData.convert(t) });
  },
  deactivate() { TextTool.commit(); },
};

/* ---------- Crear contornos: texto -> trazados, con las fuentes instaladas ---------- */
const TextOutline = {
  cache: {},
  async face(cs) {
    if (!('queryLocalFonts' in window)) throw new Error('este navegador no permite leer las fuentes instaladas. Usa Chrome, Edge o el programa de escritorio.');
    this.fonts ||= await window.queryLocalFonts();
    if (!this.fonts.length) { this.fonts = null; throw new Error('no se concedió acceso a las fuentes del sistema.'); }
    const families = cs.fontFamily.split(',').map(f => f.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
    const bold = +cs.fontWeight >= 600 || /bold/.test(cs.fontWeight), italic = /italic|oblique/.test(cs.fontStyle);
    let cands = [];
    for (const fam of [...families, 'arial', 'helvetica', 'liberation sans', 'dejavu sans']) { cands = this.fonts.filter(f => f.family.toLowerCase() === fam); if (cands.length) break; }
    if (!cands.length) cands = this.fonts;
    const score = f => { const s = f.style.toLowerCase(); return (/bold|black|heavy/.test(s) === bold ? 4 : 0) + (/italic|oblique/.test(s) === italic ? 2 : 0) + (/^(regular|normal|roman|book)$/.test(s) ? 1 : 0) - (/light|thin|condensed|narrow|semi|medium/.test(s) ? 1 : 0); };
    const best = cands.reduce((a, b) => (score(b) > score(a) ? b : a));
    if (!this.cache[best.postscriptName]) {
      await Lib.load(Lib.url('opentype'));
      this.cache[best.postscriptName] = opentype.parse(await (await best.blob()).arrayBuffer());
    }
    return this.cache[best.postscriptName];
  },
  /* coloca cada glifo donde el navegador lo dibuja (sirve para líneas, área y trazado) */
  async convert(t) {
    const cs = getComputedStyle(t), font = await this.face(cs), size = parseFloat(cs.fontSize) || 16;
    const n = t.getNumberOfChars(), parts = t.querySelector('textPath') ? [t.querySelector('textPath').textContent] : [...t.querySelectorAll('tspan')].map(s => s.textContent);
    let str = (parts.length ? parts : [t.textContent]).join('');
    if (str.length !== n) str = (parts.length ? parts : [t.textContent]).map(s => s.replace(/\s+/g, ' ')).join('');
    const f = v => round(v, 2); let d = '';
    for (let i = 0; i < Math.min(n, str.length); i++) {
      const ch = str[i]; if (/\s/.test(ch)) continue;
      let pos, rot; try { pos = t.getStartPositionOfChar(i); rot = t.getRotationOfChar(i); } catch (e) { continue; }
      const m = new DOMMatrix().translate(pos.x, pos.y).rotate(rot), P = (x, y) => { const q = new DOMPoint(x, y).matrixTransform(m); return `${f(q.x)} ${f(q.y)}`; };
      for (const c of font.charToGlyph(ch).getPath(0, 0, size).commands) {
        if (c.type === 'M' || c.type === 'L') d += c.type + P(c.x, c.y);
        else if (c.type === 'C') d += 'C' + P(c.x1, c.y1) + ' ' + P(c.x2, c.y2) + ' ' + P(c.x, c.y);
        else if (c.type === 'Q') d += 'Q' + P(c.x1, c.y1) + ' ' + P(c.x, c.y);
        else if (c.type === 'Z') d += 'Z';
      }
    }
    if (!d) return null;
    const p = svgEl('path', { id: uid(), d, 'data-name': `Contornos: ${(t.getAttribute('data-name') || str).slice(0, 24)}` });
    for (const a of ['fill', 'stroke', 'stroke-width', 'stroke-linejoin', 'opacity', 'transform', 'filter', 'fill-opacity', 'stroke-opacity']) if (t.hasAttribute(a)) p.setAttribute(a, t.getAttribute(a));
    if (!p.hasAttribute('fill')) p.setAttribute('fill', '#000000');
    t.before(p); t.remove();
    return p;
  },
  async run() {
    const texts = App.selection.flatMap(e => e.tagName === 'text' ? [e] : [...e.querySelectorAll('text')]);
    if (!texts.length) return Dialog.alert('Selecciona uno o más textos.');
    Export.busy('Creando contornos…');
    try {
      const out = []; for (const t of texts) { const p = await this.convert(t); if (p) out.push(p); }
      const keep = App.selection.filter(e => e.isConnected && e.tagName !== 'text');
      Selection.set([...keep, ...out.filter(p => Layers.topObject(p) === p)]); History.named('Crear contornos', () => History.commit()); App.emit('layers');
    } catch (e) {
      Dialog.alert('No se pudieron crear los contornos: ' + e.message);
    } finally { Export.busy(''); }
  },
};

/* ---------- acciones del menú Texto ---------- */
const TextActions = {
  texts() { return App.selection.flatMap(e => e.tagName === 'text' ? [e] : [...e.querySelectorAll('text')]); },
  changeCase(mode) {
    const ts = this.texts(); if (!ts.length) return;
    const fn = { upper: s => s.toLocaleUpperCase(), lower: s => s.toLocaleLowerCase(), title: s => s.toLocaleLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase()),
      sentence: s => s.toLocaleLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase()) }[mode];
    for (const t of ts) {
      if (t.hasAttribute('data-text')) { t.setAttribute('data-text', fn(t.getAttribute('data-text'))); TextLayout.relayout([t]); continue; }
      const nodes = t.querySelectorAll('tspan, textPath'); (nodes.length ? nodes : [t]).forEach(n => n.textContent = fn(n.textContent));
    }
    History.commit(); Selection.draw();
  },
  placeholder() {
    const ts = this.texts(); if (!ts.length) return;
    const lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet. Duis sagittis ipsum.';
    for (const t of ts) {
      if (TextLayout.area(t)) TextLayout.layoutArea(t, lorem);
      else { const tp = t.querySelector('textPath'); if (tp) tp.textContent = lorem.slice(0, 60); else { t.textContent = ''; svgEl('tspan', { x: t.getAttribute('x') || 0 }, t).textContent = 'Lorem ipsum dolor sit amet'; } }
    }
    History.commit(); Selection.draw();
  },
  /* texto de punto <-> texto de área */
  toArea() {
    for (const t of this.texts()) {
      if (TextLayout.area(t) || t.querySelector('textPath')) continue;
      const b = t.getBBox(), txt = [...t.querySelectorAll('tspan')].map(s => s.textContent).join('\n') || t.textContent;
      t.setAttribute('data-area', [b.x, b.y, Math.max(b.width + 4, 40), b.height + 4].map(v => round(v, 2)).join(' '));
      TextLayout.layoutArea(t, txt);
    }
    History.commit(); Selection.draw();
  },
};
