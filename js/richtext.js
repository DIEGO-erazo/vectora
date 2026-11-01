/* Vectora — formato por rangos en el texto (una palabra en negrita, otro color o tamaño…).
   El editor es un <div contenteditable> que imita la API del antiguo textarea (value);
   el texto se guarda como tramos en data-runs: [{t, b, i, c, sz, ff, u}] y se dibuja con
   un <tspan> por tramo, también en el texto de área (con medida por tramo). */
'use strict';

const RT = {
  ed() { return $('textEditor'); },
  /* texto plano del editor (los <br> son saltos de línea) */
  val(div) {
    let s = '';
    const walk = n => { for (const c of n.childNodes) { if (c.nodeType === 3) s += c.nodeValue; else if (c.tagName === 'BR') s += '\n'; else { if (c.tagName === 'DIV' && s && !s.endsWith('\n')) s += '\n'; walk(c); } } };
    walk(div); return s.replace(/ /g, ' ');
  },
  /* estilo de un nodo respecto al del editor */
  styleOf(el, base) {
    const cs = getComputedStyle(el), z = App.view.zoom, st = {};
    if ((parseInt(cs.fontWeight) || 400) >= 600 && (parseInt(base.fontWeight) || 400) < 600) st.b = 1;
    if (/italic|oblique/.test(cs.fontStyle) && !/italic|oblique/.test(base.fontStyle)) st.i = 1;
    if (cs.color !== base.color) st.c = normColor(cs.color);
    if (Math.abs(parseFloat(cs.fontSize) - parseFloat(base.fontSize)) > 0.2) st.sz = round(parseFloat(cs.fontSize) / z, 2);
    if (cs.fontFamily !== base.fontFamily) st.ff = cs.fontFamily.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
    const deco = cs.textDecorationLine || ''; if (/underline/.test(deco)) st.u = 'underline'; if (/line-through/.test(deco)) st.u = (st.u ? st.u + ' ' : '') + 'line-through';
    return st;
  },
  same(a, b) { return ['b', 'i', 'c', 'sz', 'ff', 'u'].every(k => (a[k] || null) === (b[k] || null)); },
  /* tramos del editor */
  runs(div) {
    const base = getComputedStyle(div), out = [];
    const NL = String.fromCharCode(10);
    const push = (t, st) => { const last = out[out.length - 1]; if (last && this.same(last, st)) last.t += t; else out.push({ t, ...st }); };
    const walk = n => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { if (c.nodeValue) push(c.nodeValue.replace(/ /g, ' '), this.styleOf(c.parentElement, base)); }
        else if (c.tagName === 'BR') { if (out.length) out[out.length - 1].t += NL; else out.push({ t: NL }); }
        else { if (c.tagName === 'DIV' && out.length && !out[out.length - 1].t.endsWith('\n')) push('\n', {}); walk(c); }
      }
    };
    walk(div);
    return out.filter(r => r.t);
  },
  styled(runs) { return runs.some(r => ['b', 'i', 'c', 'sz', 'ff', 'u'].some(k => r[k])); },
  esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); },
  /* HTML del editor a partir de los tramos */
  html(runs) {
    const z = App.view.zoom;
    return runs.map(r => {
      const css = [r.b && 'font-weight:bold', r.i && 'font-style:italic', r.c && `color:${r.c}`, r.sz && `font-size:${r.sz * z}px`, r.ff && `font-family:'${r.ff}'`, r.u && `text-decoration:${r.u}`].filter(Boolean).join(';');
      const body = this.esc(r.t).replace(/\n/g, '<br>');
      return css ? `<span style="${css}">${body}</span>` : body;
    }).join('') + (runs.length && runs[runs.length - 1].t.endsWith('\n') ? '<br>' : '');
  },
  attrs(r) { return { 'font-weight': r.b ? 'bold' : null, 'font-style': r.i ? 'italic' : null, fill: r.c || null, 'font-size': r.sz || null, 'font-family': r.ff || null, 'text-decoration': r.u || null }; },
  get(el) { try { return JSON.parse(el.getAttribute('data-runs') || 'null'); } catch (e) { return null; } },
  /* parte los tramos en líneas (por \n) */
  lines(runs) {
    const L = [[]];
    for (const r of runs) r.t.split('\n').forEach((part, k) => { if (k) L.push([]); if (part) L[L.length - 1].push({ ...r, t: part }); });
    return L;
  },
  addSpans(parent, segs) { for (const s of segs) { const t = svgEl('tspan', this.attrs(s), parent); t.textContent = s.t; } },
  /* texto de punto o en trazado con tramos */
  render(el, runs) {
    if (TextLayout.area(el)) return TextLayout.layoutArea(el, runs.map(r => r.t).join(''));
    const tp = el.querySelector('textPath');
    if (tp) { tp.textContent = ''; this.addSpans(tp, runs.map(r => ({ ...r, t: r.t.replace(/\n+/g, ' ') }))); return; }
    const x = el.getAttribute('x') || 0, lead = round((+el.getAttribute('data-leading') || 120) / 100, 3) + 'em';
    el.textContent = '';
    this.lines(runs).forEach((segs, i) => { const t = svgEl('tspan', { x, dy: i ? lead : null }, el); if (segs.length) this.addSpans(t, segs); else t.textContent = ' '; });
  },
  /* selección guardada del editor (los paneles le quitan el foco) */
  range: null,
  hasSel() { return TextTool.editing && this.range && !this.range.collapsed && this.ed().contains(this.range.commonAncestorContainer); },
  restore() { const ed = this.ed(); ed.focus(); if (this.range) { const s = getSelection(); s.removeAllRanges(); s.addRange(this.range); } },
  exec(cmd, val) { this.restore(); document.execCommand('styleWithCSS', false, true); document.execCommand(cmd, false, val); this.save(); TextTool.styleEditor(); },
  save() { const s = getSelection(); if (s.rangeCount && this.ed().contains(s.anchorNode)) this.range = s.getRangeAt(0).cloneRange(); },
  setSize(sz) {
    this.restore(); document.execCommand('styleWithCSS', false, true); document.execCommand('fontSize', false, '7');
    this.ed().querySelectorAll('span, font').forEach(e => { if (e.style.fontSize === 'xxx-large' || e.getAttribute('size') === '7') { e.removeAttribute('size'); e.style.fontSize = sz * App.view.zoom + 'px'; } });
    this.save(); TextTool.styleEditor();
  },
};

/* ---------- el editor pasa a ser contenteditable ---------- */
(() => {
  const old = $('textEditor'), ed = document.createElement('div');
  ed.id = 'textEditor'; ed.contentEditable = 'true'; ed.spellcheck = false; old.replaceWith(ed);
  Object.defineProperty(ed, 'value', { get: () => RT.val(ed), set: v => { ed.textContent = v; } });
  ed.addEventListener('paste', e => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); });
  ed.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.ctrlKey) { e.preventDefault(); document.execCommand('insertLineBreak'); TextTool.styleEditor(); } }, true);
  document.addEventListener('selectionchange', () => { if (TextTool.editing) RT.save(); });

  const baseEdit = TextTool.edit.bind(TextTool), baseCommit = TextTool.commit.bind(TextTool);
  TextTool.edit = function (el, ...rest) {
    baseEdit(el, ...rest);
    const runs = this.editing && this.editing.el && RT.get(this.editing.el);
    if (runs) { ed.innerHTML = RT.html(runs); this.styleEditor(); }
    /* cursor al final */
    const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); RT.range = null;
  };
  TextTool.commit = function () {
    const e = this.editing; if (!e) return baseCommit();
    const runs = RT.runs(ed), rich = RT.styled(runs);
    baseCommit();
    const el = e.el && e.el.isConnected ? e.el : App.selection[0];
    if (!el || el.tagName !== 'text') return;
    if (rich) { el.setAttribute('data-runs', JSON.stringify(runs)); RT.render(el, runs); History.named('Texto', () => History.commit()); }
    else if (el.hasAttribute('data-runs')) { el.removeAttribute('data-runs'); }
    ed.innerHTML = '';
  };
})();

/* ---------- el texto de área mide y escribe por tramos ---------- */
(() => {
  const baseLayout = TextLayout.layoutArea.bind(TextLayout);
  TextLayout.layoutArea = function (el, txt) {
    const runs = RT.get(el);
    if (!runs || runs.map(r => r.t).join('') !== txt || Thread.prev(el) || Thread.next(el)) {
      if (runs && runs.map(r => r.t).join('') !== txt) el.removeAttribute('data-runs');
      return baseLayout(el, txt);
    }
    const a = this.area(el), size = +el.getAttribute('font-size') || 16, P = Para.get(el), leadPct = (+el.getAttribute('data-leading') || 120) / 100;
    const ctx = this.measurer, fam = el.getAttribute('font-family') || 'Arial';
    const fontOf = r => `${r.i ? 'italic' : el.getAttribute('font-style') || 'normal'} ${r.b ? 'bold' : el.getAttribute('font-weight') || 'normal'} ${r.sz || size}px "${r.ff || fam}"`;
    const wOf = (s, r) => { ctx.font = fontOf(r); return ctx.measureText(s).width; };
    el.setAttribute('data-text', txt); el.textContent = '';
    const x0 = a.x + P.li, x1 = a.x + a.width - P.ri, bottom = a.y + a.height;
    let y = a.y, first = true, over = false;
    for (const [pi, segs] of RT.lines(runs).entries()) {
      if (pi) y += P.sb;
      /* palabras con sus trozos de estilo */
      const words = []; let cur = [];
      for (const s of segs) s.t.split(/( +)/).forEach(part => { if (!part) return; if (/^ +$/.test(part)) { if (cur.length) words.push(cur); cur = []; } else cur.push({ ...s, t: part }); });
      if (cur.length) words.push(cur);
      const ww = w => w.reduce((s, p) => s + wOf(p.t, p), 0), sp = r => wOf(' ', r);
      const lines = []; let line = [], lw = 0, width = x1 - x0 - P.fi;
      for (const w of words) { const W = ww(w), S = line.length ? sp(line[line.length - 1][0]) : 0; if (line.length && lw + S + W > width) { lines.push(line); line = []; lw = 0; width = x1 - x0; } lw += (line.length ? S : 0) + W; line.push(w); }
      lines.push(line);
      for (const [i, ln] of lines.entries()) {
        const big = Math.max(size, ...ln.flat().map(p => p.sz || size));
        y += first ? big * 0.9 : big * leadPct;
        if (!first && y + big * 0.25 > bottom) { over = true; break; }
        first = false;
        const L = x0 + (i === 0 ? P.fi : 0), W = ln.reduce((s, w, k) => s + ww(w) + (k ? sp(w[0]) : 0), 0);
        const x = P.align === 'center' ? (L + x1 - W) / 2 : P.align === 'right' ? x1 - W : L;
        const t = svgEl('tspan', { x: round(x, 2), y: round(y, 2), 'text-anchor': 'start' }, el);
        ln.forEach((w, k) => { if (k) RT.addSpans(t, [{ ...w[0], t: ' ' }]); RT.addSpans(t, w); });
        if (!ln.length) t.textContent = ' ';
        const gaps = ln.length - 1;
        if (gaps && ((P.align === 'justify' && i < lines.length - 1) || P.align === 'justify-all')) { const ws = (x1 - L - W) / gaps; if (ws > 0) t.setAttribute('word-spacing', round(ws, 3)); }
      }
      if (over) break;
      y += P.sa;
    }
    el.removeAttribute('text-anchor');
    const f = el.querySelector('tspan'); if (f) { el.setAttribute('x', f.getAttribute('x')); el.setAttribute('y', f.getAttribute('y')); }
    el.toggleAttribute('data-overflow', over);
  };
  /* cambiar el texto desde fuera (buscar y reemplazar…) quita el formato por rangos */
  const baseSet = TextLayout.setText.bind(TextLayout);
  TextLayout.setText = function (el, txt) { el.removeAttribute('data-runs'); return baseSet(el, txt); };
})();

/* ---------- los paneles actúan sobre lo seleccionado mientras se edita ---------- */
(() => {
  const intercept = (id, fn) => $(id).addEventListener('change', e => { if (!RT.hasSel()) return; e.stopImmediatePropagation(); fn(e.target.value); }, true);
  intercept('pcFont', v => RT.exec('fontName', v));
  intercept('pcSize', v => RT.setSize(+v));
  intercept('pcStyle', v => {
    const [w, s] = v.split('|'); RT.restore();
    if ((w === 'bold') !== document.queryCommandState('bold')) RT.exec('bold');
    if ((s === 'italic') !== document.queryCommandState('italic')) RT.exec('italic');
  });
  $('pChar').addEventListener('click', e => {
    const b = e.target.closest('[data-dec]'); if (!b || !RT.hasSel()) return;
    e.stopImmediatePropagation(); RT.exec(b.dataset.dec === 'underline' ? 'underline' : 'strikeThrough');
  }, true);
  const baseColor = Panels.setColor.bind(Panels);
  Panels.setColor = function (which, value, commit = true) {
    if (which === 'fill' && RT.hasSel() && /^#[0-9a-f]{6}$/i.test(value)) { RT.exec('foreColor', value); return; }
    return baseColor(which, value, commit);
  };
})();

/* ---------- Crear contornos respeta el estilo de cada tramo ---------- */
(() => {
  const base = TextOutline.convert.bind(TextOutline);
  TextOutline.convert = async function (t) {
    if (!t.hasAttribute('data-runs')) return base(t);
    const leaves = [...t.querySelectorAll('tspan')].filter(s => !s.querySelector('tspan')), n = t.getNumberOfChars(), parts = [];
    let i = 0;
    for (const leaf of leaves) {
      const cs = getComputedStyle(leaf), font = await this.face(cs), size = parseFloat(cs.fontSize) || 16, str = leaf.textContent; let d = '';
      for (let k = 0; k < str.length && i < n; k++, i++) {
        const ch = str[k]; if (/\s/.test(ch)) continue;
        let pos; try { pos = t.getStartPositionOfChar(i); } catch (e) { continue; }
        const P = (x, y) => `${round(pos.x + x, 2)} ${round(pos.y + y, 2)}`;
        for (const c of font.charToGlyph(ch).getPath(0, 0, size).commands) {
          if (c.type === 'M' || c.type === 'L') d += c.type + P(c.x, c.y); else if (c.type === 'C') d += 'C' + P(c.x1, c.y1) + ' ' + P(c.x2, c.y2) + ' ' + P(c.x, c.y);
          else if (c.type === 'Q') d += 'Q' + P(c.x1, c.y1) + ' ' + P(c.x, c.y); else if (c.type === 'Z') d += 'Z';
        }
      }
      if (d) parts.push(svgEl('path', { id: uid(), d, fill: normColor(cs.fill) || '#000000' }));
    }
    if (!parts.length) return null;
    const g = svgEl('g', { id: uid(), 'data-name': `Contornos: ${(t.getAttribute('data-name') || t.textContent).slice(0, 24)}` });
    for (const a of ['transform', 'opacity', 'filter']) if (t.hasAttribute(a)) g.setAttribute(a, t.getAttribute(a));
    parts.forEach(p => g.appendChild(p)); t.before(g); t.remove(); return g;
  };
})();

/* el panel Glifos inserta en la posición del cursor del editor */
Glyphs.insert = function (ch) {
  this.recent = [ch, ...this.recent.filter(c => c !== ch)].slice(0, 12); this.render();
  if (!TextTool.editing) {
    const t = ParaPanel.texts()[0];
    if (!t) { navigator.clipboard && navigator.clipboard.writeText(ch).catch(() => {}); $('sbHint').textContent = `«${ch}» copiado: haz clic en un texto para insertarlo`; return; }
    Tools.use('text'); TextTool.edit(t);
  }
  RT.restore(); document.execCommand('insertText', false, ch); RT.save(); TextTool.styleEditor();
};
