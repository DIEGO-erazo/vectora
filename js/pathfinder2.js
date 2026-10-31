/* Vectora — Buscatrazos: Dividir, Recortar, Combinar, Cortar, Contorno y Menos fondo
   (los modos de forma Unificar/Menos frente/Intersecar/Excluir están en actions.js) */
'use strict';

const PF2 = {
  input(min = 2) {
    const sel = docOrder(App.selection).filter(e => !['text', 'image'].includes(e.tagName));
    const shapes = sel.flatMap(e => (e.tagName === 'g' ? leafShapes(e) : [e])).filter(isShape);
    if (shapes.length < min) { Dialog.alert(`Selecciona al menos ${min} formas.`); return null; }
    return { sel, shapes, polys: shapes.map(s => Boolean2D.fromSubs(pathSubsDoc(s), s.getAttribute('fill-rule') || 'nonzero')) };
  },
  path(rings, attrs) { const d = Boolean2D.toPath({ rings }); return d && svgEl('path', { id: uid(), ...attrs, d }); },
  /* agrupa los resultados donde estaba el objeto superior y quita los originales */
  finish(sel, els, name) {
    els = els.filter(Boolean);
    const anchor = sel[sel.length - 1], g = svgEl('g', { id: uid(), 'data-name': `<${name}>` });
    anchor.after(g); els.forEach(e => { g.appendChild(e); placeDocPath(e); });
    sel.forEach(e => e.remove());
    if (!g.children.length) { g.remove(); Selection.clear(); } else Selection.set([g]);
    History.commit(); App.emit('layers');
  },
  fillOnly(s) { const a = styleAttrs(s); delete a.stroke; delete a['stroke-width']; delete a['stroke-dasharray']; return { ...a, stroke: 'none' }; },
  sameFill(a, b) { return normColor(getStyle(a, 'fill') || '#000') === normColor(getStyle(b, 'fill') || '#000'); },

  /* Dividir: cada región en que se cortan las formas pasa a ser un objeto */
  divide() {
    const I = this.input(1); if (!I) return;
    const faces = Faces.build(I.shapes);
    this.finish(I.sel, faces.map(f => this.path(Faces.rings(f), styleAttrs(I.shapes[f.top]))), 'Dividir');
  },
  /* partes visibles de cada objeto (lo tapado se elimina; sin trazos) */
  visible(I) {
    const out = []; let cover = { rings: [], rule: 'nonzero' };
    for (let i = I.polys.length - 1; i >= 0; i--) {
      out[i] = cover.rings.length ? Boolean2D.op(I.polys[i], cover, 'difference') : Boolean2D.op(I.polys[i], { rings: [], rule: 'nonzero' }, 'union');
      cover = cover.rings.length ? Boolean2D.op(cover, I.polys[i], 'union') : I.polys[i];
    }
    return out;
  },
  /* Recortar: quita las partes ocultas */
  trim() {
    const I = this.input(); if (!I) return;
    this.finish(I.sel, this.visible(I).map((v, i) => v.rings.length && this.path(v.rings, this.fillOnly(I.shapes[i]))), 'Recortar');
  },
  /* Combinar: como Recortar, y además une los objetos del mismo color que se tocan */
  merge() {
    const I = this.input(); if (!I) return;
    const vis = this.visible(I), groups = [];
    vis.forEach((v, i) => {
      if (!v.rings.length) return;
      const g = groups.find(x => this.sameFill(I.shapes[x.i], I.shapes[i]) && polysTouch(x.poly, v));
      if (g) { g.poly = Boolean2D.op(g.poly, v, 'union'); g.i = i; } else groups.push({ poly: v, i });
    });
    this.finish(I.sel, groups.sort((a, b) => a.i - b.i).map(g => this.path(g.poly.rings, this.fillOnly(I.shapes[g.i]))), 'Combinar');
  },
  /* Cortar: el objeto superior hace de molde; se quedan las partes de debajo que caen dentro */
  crop() {
    const I = this.input(); if (!I) return;
    const top = I.polys[I.polys.length - 1];
    this.finish(I.sel, I.polys.slice(0, -1).map((p, i) => { const r = Boolean2D.op(p, top, 'intersect'); return r.rings.length && this.path(r.rings, this.fillOnly(I.shapes[i])); }), 'Cortar');
  },
  /* Contorno: las regiones pasan a ser solo trazos del color de su relleno */
  outline() {
    const I = this.input(1); if (!I) return;
    this.finish(I.sel, Faces.build(I.shapes).map(f => {
      const src = I.shapes[f.top], c = getStyle(src, 'fill'), stroke = c && c !== 'none' && !c.startsWith('url(') ? c : (getStyle(src, 'stroke') || '#000000');
      return this.path(Faces.rings(f), { fill: 'none', stroke, 'stroke-width': 1 });
    }), 'Contorno');
  },
  /* Menos fondo: al objeto de delante se le restan todos los de detrás */
  minusBack() {
    const I = this.input(); if (!I) return;
    const back = I.polys.slice(0, -1).reduce((a, b) => Boolean2D.op(a, b, 'union'));
    const r = Boolean2D.op(I.polys[I.polys.length - 1], back, 'difference');
    const el = r.rings.length && this.path(r.rings, styleAttrs(I.shapes[I.shapes.length - 1]));
    const anchor = I.sel[I.sel.length - 1];
    if (el) { anchor.after(el); placeDocPath(el); }
    I.sel.forEach(e => e.remove()); Selection.set(el ? [el] : []); History.commit(); App.emit('layers');
  },
};

/* Pathfinder.run atiende también los comandos nuevos */
(() => {
  const base = Pathfinder.run.bind(Pathfinder);
  const map = { divide: 'divide', trim: 'trim', merge: 'merge', crop: 'crop', outline: 'outline', minusBack: 'minusBack' };
  Pathfinder.run = op => (map[op] ? PF2[map[op]]() : base(op));
})();
