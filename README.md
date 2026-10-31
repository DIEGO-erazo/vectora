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

- **Herramientas:** selección, selección directa, pluma, convertir punto de ancla, lápiz, texto, línea, rectángulo
  (también redondeado), elipse, polígono, estrella, rotar, escala, borrador real, cuentagotas, degradado,
  mesa de trabajo, mano y zoom.
- **Documento:** ajustes preestablecidos de Móvil, Web, Imprimir, Cine y vídeo, Redes sociales e Ilustración;
  unidades (px, pt, mm, cm, pulgadas, picas), orientación y sangrado.
- **Precisión:** guías inteligentes, reglas y guías, cuadrícula y cuadro delimitador girado.
- **Trazados:** Buscatrazos con curvas exactas (unificar, menos frente, intersecar, excluir), unir, simplificar,
  contornear trazo, desplazar trazado, trazado compuesto y máscara de recorte. Transformar de nuevo (Ctrl+D).
- **Paneles:** Color (RGB/HSB), Muestras, Trazo con puntas de flecha, Degradado, Transparencia con modos de fusión,
  Carácter, Alinear, Buscatrazos y Capas.
- **Efectos:** sombra paralela y desenfoque gaussiano, con vista previa.
- Deshacer ilimitado, autoguardado, menú contextual y portapapeles compartido con otras aplicaciones.

### Importar y exportar

| | Formatos |
|---|---|
| **Abrir / Colocar** | SVG, PDF, AI (compatible con PDF), PNG, JPEG, WebP, GIF, BMP, AVIF |
| **Exportar como** | PNG, JPEG y WebP (72/150/300 ppp o personalizado, fondo, suavizado, calidad), SVG (decimales, CSS interno, minificado, adaptable), PDF vectorial (con sangrado y marcas de corte) |
| **Exportar para pantallas** | ZIP con varias escalas: Web (1x, 2x + SVG), iOS (1x, 2x, 3x), Android (mdpi … xxxhdpi) o personalizado |
| **Guardar** | SVG con capas, guías, muestras, unidades y sangrado |

Pulsa **F1** dentro del programa para ver todos los atajos de teclado.

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
| `js/geometry.js`, `js/pathfinder.js`, `js/pathops.js` | geometría, operaciones booleanas y de trazado |
| `js/selection.js`, `js/tools.js`, `js/pentools.js`, `js/nodetools.js` | selección y herramientas |
| `js/panels*.js`, `js/menus.js`, `js/dialogs.js`, `js/newdoc.js`, `js/guides.js` | paneles, menús y diálogos |
| `js/files.js`, `js/importer.js`, `js/exporter.js` | archivos, importación y exportación |
| `js/app.js`, `sw.js`, `manifest.webmanifest` | integración como aplicación (escritorio y PWA) |
| `electron/` | programa de escritorio |

## Contribuir

Las contribuciones son bienvenidas. Lee [CONTRIBUTING.md](CONTRIBUTING.md) y abre un *issue* o una *pull request*.

## Licencia

[MIT](LICENSE). Usa [jsPDF](https://github.com/parallax/jsPDF) y [svg2pdf.js](https://github.com/yWorks/svg2pdf.js) (MIT)
y [PDF.js](https://github.com/mozilla/pdf.js) (Apache 2.0). Vectora es un proyecto independiente, sin relación con Adobe.

---

**English:** Vectora is a free, open-source vector graphics editor with a professional workflow: pen and node editing,
exact-curve boolean operations, smart guides, gradients, document presets with real units, and import/export of
SVG, PDF, AI, PNG, JPEG and WebP. It ships as a desktop app for Windows, macOS and Linux (Electron) and as an
installable web app. The interface is in Spanish. MIT licensed.
