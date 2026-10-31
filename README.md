<p align="center"><img src="icons/icon-192.png" width="96" alt="Vectora"></p>

<h1 align="center">Vectora</h1>

<p align="center"><b>Editor de gráficos vectoriales libre y de código abierto</b>, inspirado en el flujo de trabajo de los editores profesionales.<br>
Programa de escritorio para Windows, macOS y Linux, y también aplicación web instalable.</p>

<p align="center"><img src="docs/screenshot.png" alt="Captura de Vectora" width="900"></p>

## Descargar

| Sistema | Archivo (en [Releases](../../releases/latest)) |
|---|---|
| **Windows** | `Vectora-Setup-x.y.z.exe` (instalador) o `Vectora-Portable-x.y.z.exe` (sin instalación) |
| **macOS** | `Vectora-x.y.z-arm64.dmg` / `-x64.dmg` |
| **Linux** | `Vectora-x.y.z-x86_64.AppImage` o `.deb` |
| **Navegador** | Versión web publicada con GitHub Pages: se puede instalar como app desde Chrome o Edge |

> Los instaladores aún no están firmados digitalmente. En Windows puede aparecer el aviso de SmartScreen: pulsa
> «Más información ▸ Ejecutar de todas formas». En macOS: clic derecho ▸ Abrir.

## Funciones

- **Interfaz profesional:** barra de herramientas con grupos desplegables, panel **Propiedades** contextual,
  paneles en pestañas plegables, **varios documentos en pestañas**, pantalla de inicio con plantillas y
  archivos recientes (con miniatura), menú contextual y ayuda de atajos (F1).
- **Herramientas (más de 35):** selección, selección directa, selección de grupos, varita mágica, lazo,
  pluma, convertir punto de ancla, texto, texto de área, texto en trazado, línea, arco, espiral,
  cuadrículas rectangular y polar, rectángulo (también redondeado), elipse, polígono, estrella, pincel,
  pincel de manchas, lápiz, borrador real, tijeras, cuchillo, rotar, reflejar, escala, distorsionar,
  **creador de formas**, degradado, cuentagotas, **fusión**, mesa de trabajo, mano y zoom.
- **Documento:** ajustes de Móvil, Web, Imprimir, Cine y vídeo, Redes sociales e Ilustración;
  unidades (px, pt, mm, cm, pulgadas, picas), orientación, sangrado y **varias mesas de trabajo**.
- **Precisión:** guías inteligentes con ajuste a bordes, centros y **puntos de ancla**, reglas y guías,
  cuadrícula, panel Transformar con **punto de referencia de 9 posiciones**, cuadro delimitador girado
  y **modo aislamiento** (doble clic en un grupo).
- **Trazados:** Buscatrazos con curvas exactas (unificar, menos frente, intersecar, excluir), unir,
  simplificar, contornear trazo, desplazar trazado, trazado compuesto, máscara de recorte y
  Transformar de nuevo (Ctrl+D).
- **Texto:** texto de punto, de área (ajuste automático de líneas) y en trazado; panel Carácter
  (interlineado, tracking); cambiar mayúsculas; **Crear contornos** con las fuentes instaladas.
- **Imagen:** **Calco de imagen** (fotografía, 3/6/16 colores, grises, blanco y negro, silueta).
- **Color y apariencia:** Color (RGB/HSB), muestras propias y recientes, Degradado con varias paradas,
  Transparencia con modos de fusión, puntas de flecha, **Editar colores** (invertir, grises, saturar,
  equilibrio, fusionar de delante a detrás).
- **Efectos:** sombra paralela, desenfoque, fruncir y engordar, retorcer, zigzag, rugosidad y redondear
  esquinas, todos con vista previa.
- **Historial** con nombre de cada paso, deshacer ilimitado por documento y autoguardado de la sesión.

### Importar y exportar

| | Formatos |
|---|---|
| **Abrir / Colocar** | SVG, PDF, AI (compatible con PDF), PNG, JPEG, WebP, GIF, BMP, AVIF; arrastrar y soltar o pegar |
| **Exportar como** | PNG, JPEG y WebP (72/150/300 ppp o personalizado, fondo, suavizado, calidad), SVG (decimales, CSS interno, minificado, adaptable), PDF vectorial (sangrado y marcas de corte) |
| **Varias mesas** | PDF de varias páginas o un archivo por mesa en ZIP |
| **Exportar para pantallas** | ZIP con varias escalas: Web (1x, 2x + SVG), iOS (1x, 2x, 3x), Android (mdpi … xxxhdpi) o personalizado |
| **Guardar** | SVG con capas, mesas de trabajo, guías, muestras, unidades y sangrado |

Pulsa **F1** dentro del programa para ver todos los atajos de teclado.

<p align="center"><img src="docs/inicio.png" alt="Pantalla de inicio" width="720"></p>

## Desarrollo

Requisitos: [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install          # dependencias (Electron y librerías PDF)
npm start            # abre el programa de escritorio
npm run web          # sirve la versión web en http://localhost:8080
npm run check        # comprueba la sintaxis y las referencias
npm run dist:win     # crea el instalador de Windows en dist/
```

- Las pruebas de geometría están en `tests.html`: ábrelo en el navegador con `npm run web`.
- `npx electron scripts/smoke-electron.js archivo.svg` arranca el programa, abre el archivo y comprueba la exportación e importación de PDF.

La interfaz es HTML, SVG y JavaScript sin dependencias ni compilación: `index.html` funciona tal cual en el navegador.

### Publicar una versión

1. Cambia `version` en `package.json` y en `js/app.js` (`APP_INFO`).
2. Crea y sube la etiqueta:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
3. GitHub Actions compila los instaladores de Windows, macOS y Linux y los publica en **Releases**.

La versión web se publica sola en **GitHub Pages** con cada cambio en `main`. Actívalo una vez en
*Settings ▸ Pages ▸ Source: GitHub Actions*.

### Estructura

| Ruta | Contenido |
|---|---|
| `index.html`, `css/` | interfaz |
| `js/core.js`, `js/units.js` | estado, vista, capas, historial y unidades |
| `js/geometry.js`, `js/pathfinder.js`, `js/pathops.js`, `js/builder.js` | geometría, operaciones booleanas, de trazado y creador de formas |
| `js/selection.js`, `js/tools.js`, `js/pentools.js`, `js/nodetools.js`, `js/moretools.js` | selección y herramientas |
| `js/text2.js`, `js/trace.js`, `js/effects2.js` | texto de área y en trazado, contornos, calco de imagen y efectos |
| `js/docs.js`, `js/artboards.js`, `js/isolation.js` | pestañas e inicio, mesas de trabajo y modo aislamiento |
| `js/panels*.js`, `js/menus.js`, `js/dialogs.js`, `js/newdoc.js`, `js/guides.js` | paneles (Propiedades, Transformar, Historial…), menús y diálogos |
| `js/files.js`, `js/importer.js`, `js/exporter.js` | archivos, importación y exportación |
| `js/app.js`, `sw.js`, `manifest.webmanifest` | integración como aplicación (escritorio y PWA) |
| `electron/` | programa de escritorio |

## Contribuir

Las contribuciones son bienvenidas. Lee [CONTRIBUTING.md](CONTRIBUTING.md) y abre un *issue* o una *pull request*.

## Licencia

[MIT](LICENSE). Usa [jsPDF](https://github.com/parallax/jsPDF), [svg2pdf.js](https://github.com/yWorks/svg2pdf.js) y [opentype.js](https://github.com/opentypejs/opentype.js) (MIT),
[PDF.js](https://github.com/mozilla/pdf.js) (Apache 2.0) e [imagetracerjs](https://github.com/jankovicsandras/imagetracerjs) (dominio público). Vectora es un proyecto independiente, sin relación con Adobe.

---

**English:** Vectora is a free, open-source vector graphics editor with a professional workflow: pen and node editing,
exact-curve boolean operations, a shape builder, blends, image trace, text on paths and create-outlines, multiple
artboards and document tabs, smart guides, gradients, document presets with real units, and import/export of
SVG, PDF, AI, PNG, JPEG and WebP. It ships as a desktop app for Windows, macOS and Linux (Electron) and as an
installable web app. The interface is in Spanish. MIT licensed.
