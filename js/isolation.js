/* Vectora — modo aislamiento: editar dentro de un grupo con el resto atenuado */
'use strict';

const Isolation = {
  el: null,
  active() { if (this.el && !this.el.isConnected) this.exit(true); return this.el; },
  enter(g) {
    if (!g || g.tagName !== 'g' || g.classList.contains('layer')) return;
    this.el = g; App.isolated = g;
    Selection.set([]); this.render(); App.emit('layers');
  },
  exit(silent) {
    const g = this.el; this.el = null; App.isolated = null;
    this.render();
    if (!silent && g && g.isConnected) Selection.set([Layers.topObject(g) || g]);
  },
  /* velo semitransparente sobre todo y, encima, una copia visual del grupo aislado */
  render() {
    let veil = $('isoVeil'), bar = $('isoBar');
    if (!this.el) { if (veil) veil.remove(); if (bar) bar.hidden = true; return; }
    if (!veil) {
      veil = svgEl('g', { id: 'isoVeil', 'pointer-events': 'none' });
      svgEl('rect', { x: -1e5, y: -1e5, width: 2e5, height: 2e5, fill: 'rgba(83,83,83,.62)' }, veil);
      svgEl('use', {}, veil);
    }
    App.els.content.after(veil);
    const use = veil.querySelector('use'); use.setAttribute('href', '#' + (this.el.id || (this.el.id = uid())));
    use.setAttribute('transform', Geo.toDoc(this.el.parentNode).toString());
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'isoBar';
      bar.innerHTML = '<button title="Salir del modo aislamiento (Esc)">←</button><span></span>';
      bar.firstChild.onclick = () => this.exit();
      $('canvasWrap').appendChild(bar);
    }
    const path = []; for (let e = this.el; e && e !== App.els.content; e = e.parentNode) path.unshift(e.classList.contains('layer') ? e.getAttribute('data-name') : objName(e).replace(/[<>]/g, ''));
    bar.querySelector('span').textContent = path.join('  ›  '); bar.hidden = false;
  },
};

/* integración: selección y creación de objetos dentro del grupo aislado */
(function hookLayers() {
  const top = Layers.topObject.bind(Layers), objs = Layers.objects.bind(Layers);
  Layers.topObject = el => {
    const g = Isolation.active();
    if (!g) return top(el);
    if (!el || !g.contains(el) || el === g) return null;
    while (el.parentNode !== g) el = el.parentNode;
    return el;
  };
  Layers.objects = () => { const g = Isolation.active(); return g ? [...g.children] : objs(); };
})();
App.on('change', () => { if (Isolation.el && !Isolation.el.isConnected) Isolation.exit(true); else if (Isolation.el) Isolation.render(); });
