# Historial de versiones

## [1.3.1] - 2026-11-14

Versión de calidad: no añade funciones, arregla y acelera las que hay. El diagnóstico y las medidas están en [docs/PLAN-MEJORA.md](docs/PLAN-MEJORA.md).

### Corregido
- **Herramienta Anchura:** fallaba al pasar sobre rectángulos, elipses y polígonos.
- **PDF vectorial:** las sombras, desenfoques, resplandores, el desvanecer, el grano y las máscaras de opacidad no salían. Ahora esos objetos se incluyen como imagen a 300 ppp y el resto sigue vectorial.
- **Inglés:** 8 textos que seguían en español.

### Seguridad
- Al abrir o colocar un SVG se eliminan las animaciones, que podían reintroducir código.
- Las imágenes, los `<use>` y los rellenos ya no pueden apuntar a internet. Abrir un archivo no hace ninguna petición externa.
- Los enlaces solo admiten `http(s)`.
- `javascript:` se detecta aunque lleve espacios o saltos de línea en medio.

### Rendimiento
Con 3.000 objetos seleccionados:
- Arrastrar: de 1,1 s a 0,11 s por paso.
- Mover con las flechas: de 1,9 s a 0,15 s.
- Seleccionar todo: de 0,75 s a 0,08 s.

### Añadido
- **Uso con teclado:** la barra de herramientas y los menús se recorren con Tab, flechas, Intro y Escape.
- **Lectores de pantalla:** roles y nombres en herramientas, menús y los 58 campos de los paneles.
- **Pruebas automáticas** (`npm test`): 11 grupos que abren Vectora en un navegador y prueban cada comando, cada herramienta, guardar y abrir, el saneado, el PDF, el rendimiento, el idioma y el teclado. GitHub Actions las ejecuta en cada cambio.

## [1.3.0] - 2026-10-31

- Repetir (radial, cuadrícula, espejo), máscaras de opacidad, modos Dibujar detrás y dentro, Shaper, Entrelazar y Licuar.
- Malla de degradado, cuadrícula de perspectiva y 3D (extruir y biselar, revolución).
- Filtros apilables (resplandores, desvanecer, grano), Garabato y herramientas de símbolos.
- Formato por rangos en el texto.
- Paneles Navegador, Información y Acciones, espacios de trabajo con paneles flotantes y Rotar vista.

## [1.2.0] - 2026-10-31

- Las seis fases del plan de paridad: Buscatrazos completo, Apariencia y efectos en vivo, tipografía (párrafo, texto enlazado, OpenType, glifos), herramientas de dibujo (curvatura, anchura, pinceles), color (CMYK, colores globales, Volver a colorear).
- Interfaz en inglés, atajos personalizables, consola de scripts y búsqueda de actualizaciones.
