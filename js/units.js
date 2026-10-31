/* Vectora — unidades de medida y ajustes preestablecidos de documento.
   Internamente todo se guarda en px = pt (72 por pulgada), como Illustrator. */
'use strict';

const Units = {
  list: {
    px: ['Píxeles', 1], pt: ['Puntos', 1], pc: ['Picas', 12],
    in: ['Pulgadas', 72], mm: ['Milímetros', 72 / 25.4], cm: ['Centímetros', 72 / 2.54],
  },
  get u() { return App.doc.units || 'px'; },
  factor(u = this.u) { return (this.list[u] || this.list.px)[1]; },
  toU(px, u = this.u) { return px / this.factor(u); },
  fromU(v, u = this.u) { return v * this.factor(u); },
  decimals(u = this.u) { return u === 'px' || u === 'pt' ? 2 : u === 'mm' ? 2 : 3; },
  fmt(px, u = this.u) { return round(this.toU(px, u), this.decimals(u)); },
  options(sel = this.u) { return Object.entries(this.list).map(([k, [n]]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${n}</option>`).join(''); },
};

/* [nombre, anchura, altura, unidad, sangrado (en la unidad)] */
const DOC_PRESETS = {
  'Móvil': [
    ['iPhone 15 / 16 Pro', 393, 852, 'px'], ['iPhone 15 / 16 Pro Max', 430, 932, 'px'], ['iPhone SE', 375, 667, 'px'],
    ['Android grande', 412, 915, 'px'], ['Android compacto', 360, 800, 'px'], ['iPad Pro 11"', 834, 1194, 'px'],
    ['iPad Pro 12,9"', 1024, 1366, 'px'], ['Apple Watch 45 mm', 198, 242, 'px'],
  ],
  'Web': [
    ['Web común', 1366, 768, 'px'], ['Web grande', 1920, 1080, 'px'], ['Web mínima', 1024, 768, 'px'],
    ['MacBook Pro 14"', 1512, 982, 'px'], ['Escritorio 1440', 1440, 900, 'px'], ['Banner horizontal', 728, 90, 'px'],
    ['Rectángulo mediano', 300, 250, 'px'], ['Rascacielos', 160, 600, 'px'],
  ],
  'Imprimir': [
    ['A4', 210, 297, 'mm', 3], ['A3', 297, 420, 'mm', 3], ['A5', 148, 210, 'mm', 3], ['A6', 105, 148, 'mm', 3],
    ['Carta', 8.5, 11, 'in', 0.125], ['Legal', 8.5, 14, 'in', 0.125], ['Tabloide', 11, 17, 'in', 0.125],
    ['Tarjeta de visita', 85, 55, 'mm', 3], ['Tarjeta EE. UU.', 3.5, 2, 'in', 0.125], ['Postal', 148, 105, 'mm', 3],
    ['Póster 18×24"', 18, 24, 'in', 0.125], ['Póster A2', 420, 594, 'mm', 3], ['Sobre DL', 220, 110, 'mm', 3],
  ],
  'Cine y vídeo': [
    ['HD 1080p', 1920, 1080, 'px'], ['4K UHD', 3840, 2160, 'px'], ['HD 720p', 1280, 720, 'px'],
    ['Vídeo vertical', 1080, 1920, 'px'], ['Cine 2K', 2048, 1080, 'px'], ['Cine 4K', 4096, 2160, 'px'],
  ],
  'Redes sociales': [
    ['Instagram cuadrado', 1080, 1080, 'px'], ['Instagram vertical', 1080, 1350, 'px'], ['Historia / Reel', 1080, 1920, 'px'],
    ['Portada de Facebook', 820, 312, 'px'], ['Publicación de Facebook', 1200, 630, 'px'], ['Publicación de X', 1600, 900, 'px'],
    ['Miniatura de YouTube', 1280, 720, 'px'], ['Banner de YouTube', 2560, 1440, 'px'], ['Portada de LinkedIn', 1584, 396, 'px'],
    ['Pin de Pinterest', 1000, 1500, 'px'], ['TikTok', 1080, 1920, 'px'],
  ],
  'Ilustración': [
    ['Lienzo 800×600', 800, 600, 'px'], ['Logotipo', 500, 500, 'px'], ['Icono 1024', 1024, 1024, 'px'], ['Icono 512', 512, 512, 'px'],
    ['Icono 64', 64, 64, 'px'], ['Favicon', 32, 32, 'px'], ['Ilustración A4', 210, 297, 'mm'], ['Cómic (página)', 6.625, 10.25, 'in', 0.125],
  ],
};
