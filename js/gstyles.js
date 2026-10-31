/* Vectora — estilos gráficos: guardar una apariencia completa (relleno, trazo, opacidad,
   fusión, efectos en vivo y filtros) y aplicarla a otros objetos con un clic */
'use strict';

const GSTYLE_ATTRS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'fill-opacity', 'stroke-opacity'];
const GSTYLE_PRESETS = [
  { name: 'Predeterminado', a: { fill: '#ffffff', stroke: '#000000', 'stroke-width': '1' } },
  { name: 'Sombra suave', a: { fill: '#ffffff', stroke: 'none' }, filter: '<feDropShadow dx="3" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.35"/>' },
  { name: 'Contorno grueso', a: { fill: 'none', stroke: '#1473e6', 'stroke-width': '6', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' } },
  { name: 'Discontinuo', a: { fill: 'none', stroke: '#333333', 'stroke-width': '2', 'stroke-dasharray': '8 5' } },
  { name: 'Sello', a: { fill: '#e8473b', stroke: 'none' }, fx: [{ t: 'zigzag', p: { s: '4', n: '4', smooth: 'corner' } }] },
  { name: 'Boceto', a: { fill: 'none', stroke: '#222222', 'stroke-width': '1.5' }, fx: [{ t: 'roughen', p: { s: '2', d: '6', smooth: 'smooth', seed: '3' } }] },
  { name: 'Burbuja', a: { fill: '#7dc8ff', stroke: '#1473e6', 'stroke-width': '2' }, fx: [{ t: 'pucker', p: { a: '-35' } }] },
  { name: 'Neblina', a: { fill: '#9b5de5', stroke: 'none' }, op: 0.8, filter: '<feGaussianBlur stdDeviation="3"/>' },
  { name: 'Multiplicar', a: { fill: '#f9c80e', stroke: 'none' }, op: 0.9, blend: 'multiply' },
];

const GraphicStyles = {
  cur: null,
  list() { return App.doc.gstyles || (App.doc.gstyles = []); },
  /* apariencia del objeto como estilo */
  capture(el, name) {
    const leaf = el.tagName === 'g' ? (leafShapes(el)[0] || el) : el, st = { name, a: {} };
    for (const k of GSTYLE_ATTRS) { const v = getStyle(leaf, k); if (v != null && v !== '') st.a[k] = v; }
    const g = (st.a.fill || '').match(/url\(\s*#([^)]+)\)/), gd = g && document.getElementById(g[1]);
    if (gd) st.grad = gd.outerHTML;
    const f = (el.getAttribute('filter') || '').match(/#([^)]+)/), F = f && document.getElementById(f[1]);
    if (F && F.children.length) st.filter = F.innerHTML;
    const fx = LiveFX.list(leaf); if (fx.length) st.fx = fx;
    if (el.hasAttribute('opacity')) st.op = +el.getAttribute('opacity');
    if (el.style.mixBlendMode) st.blend = el.style.mixBlendMode;
    return st;
  },
  async create() {
    const el = App.selection[0]; if (!el) return Dialog.alert('Selecciona un objeto con la apariencia que quieres guardar.');
    const v = await Dialog.form('Nuevo estilo gráfico', [{ id: 'n', label: 'Nombre', value: `Estilo gráfico ${this.list().length + 1}` }]);
    if (!v || !v.n.trim()) return;
    const st = this.capture(el, v.n.trim()); st.id = uid('gs'); this.list().push(st); this.cur = st.id;
    History.named('Nuevo estilo gráfico', () => History.commit()); this.render();
  },
  /* añadir los estilos de la biblioteca al documento */
  addPresets() {
    for (const p of GSTYLE_PRESETS) if (!this.list().some(s => s.name === p.name)) this.list().push({ ...JSON.parse(JSON.stringify(p)), id: uid('gs') });
    History.named('Biblioteca de estilos gráficos', () => History.commit()); this.render();
  },
  /* referencia al degradado del estilo (lo recrea si ya no existe en el documento) */
  gradRef(st) {
    const id = (st.grad.match(/id="([^"]+)"/) || [])[1];
    if (id && document.getElementById(id)) return `url(#${id})`;
    const tmp = svgEl('g', {}); tmp.innerHTML = st.grad; const g = tmp.firstElementChild; if (!g) return null;
    g.id = uid('grad'); docDefs().appendChild(g); return `url(#${g.id})`;
  },
  apply(st, els = App.selection) {
    if (!st || !els.length) return;
    for (const el of els) {
      const shapes = el.tagName === 'g' ? leafShapes(el) : [el];
      /* el estilo reemplaza la apariencia: primero se limpia */
      for (const k of GSTYLE_ATTRS) setStyle([el], k, null);
      for (const [k, v] of Object.entries(st.a)) setStyle([el], k, k === 'fill' && st.grad && /^url/.test(v) ? this.gradRef(st) : v);
      if (st.op != null && st.op !== 1) el.setAttribute('opacity', st.op); else el.removeAttribute('opacity');
      el.style.mixBlendMode = st.blend || ''; if (!el.getAttribute('style')) el.removeAttribute('style');
      el.removeAttribute('filter');
      if (st.filter) { const f = svgEl('filter', { id: uid('fx'), x: '-50%', y: '-50%', width: '200%', height: '200%' }, docDefs()); f.innerHTML = st.filter; el.setAttribute('filter', `url(#${f.id})`); }
      for (let s of shapes.filter(isShape)) {
        if (st.fx && st.fx.length) { s = LiveFX.prepare(s); LiveFX.write(s, JSON.parse(JSON.stringify(st.fx))); }
        else if (s.hasAttribute('data-fx')) LiveFX.write(s, []);
      }
    }
    LiveFX.resync(); History.named('Aplicar estilo gráfico', () => History.commit()); Selection.changed();
  },
  async redefine() {
    const st = this.list().find(s => s.id === this.cur), el = App.selection[0]; if (!st || !el) return;
    Object.assign(st, this.capture(el, st.name), { id: st.id });
    History.named('Redefinir estilo gráfico', () => History.commit()); this.render();
  },
  remove() {
    const i = this.list().findIndex(s => s.id === this.cur); if (i < 0) return;
    this.list().splice(i, 1); this.cur = null; History.named('Eliminar estilo gráfico', () => History.commit()); this.render();
  },
  /* miniatura: un cuadrado con el estilo aplicado */
  thumb(st) {
    let d = 'M8 8H40V40H8Z';
    if (st.fx) { let subs = PathData.parse(d); for (const f of st.fx) if (FX[f.t]) subs = FX[f.t].run(subs, f.p || {}); d = PathData.serialize(subs); }
    const fid = uid('gsf'), attrs = Object.entries(st.a).filter(([k]) => !(k === 'fill' && st.grad)).map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`).join(' ');
    let defs = st.filter ? `<filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%">${st.filter}</filter>` : '', fill = '';
    if (st.grad) { const gid = uid('gsg'); defs += st.grad.replace(/id="[^"]+"/, `id="${gid}"`).replace(/gradientUnits="userSpaceOnUse"/, ''); fill = ` fill="url(#${gid})"`; }
    return `<svg viewBox="0 0 48 48"><defs>${defs}</defs><path d="${d}" ${attrs}${fill} ${st.filter ? `filter="url(#${fid})"` : ''} opacity="${st.op ?? 1}" style="mix-blend-mode:${st.blend || 'normal'}"/></svg>`;
  },
  render() {
    const box = $('gsGrid'); if (!box || $('pGStyles').hidden) return;
    box.innerHTML = '';
    for (const st of this.list()) {
      const c = document.createElement('div'); c.className = 'gs' + (st.id === this.cur ? ' on' : ''); c.title = st.name;
      c.innerHTML = this.thumb(st);
      c.onclick = () => { this.cur = st.id; if (App.selection.length) this.apply(st); else this.render(); };
      c.ondblclick = async () => {
        const v = await Dialog.form('Opciones de estilo gráfico', [{ id: 'n', label: 'Nombre', value: st.name }]);
        if (v && v.n.trim()) { st.name = v.n.trim(); History.commit(); this.render(); }
      };
      box.appendChild(c);
    }
    if (!box.children.length) box.innerHTML = '<p class="empty-note">Selecciona un objeto y pulsa ＋ para guardar su apariencia, o abre la biblioteca (☰).</p>';
  },
  init() {
    $('gsNew').onclick = () => this.create();
    $('gsLib').onclick = () => this.addPresets();
    $('gsRedef').onclick = () => this.redefine();
    $('gsDel').onclick = () => this.remove();
    App.on('change', () => this.render()); App.on('dock', t => { if (t === 'pGStyles') this.render(); });
    this.render();
  },
};
