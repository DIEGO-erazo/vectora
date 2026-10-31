# Plan de paridad: Vectora frente a Adobe Illustrator

Comparación entre Vectora 1.1 y Adobe Illustrator (versión actual), y plan por fases para acercarnos.
Leyenda: ✅ lo tenemos · 🟡 parcial · ❌ falta. Esfuerzo: **S** (horas) · **M** (1–2 días) · **L** (varios días).

## 1. Dónde estamos

| Área | Vectora 1.1 | Illustrator | Estado |
|---|---|---|---|
| Interfaz general | Herramientas por grupos, Propiedades contextual, paneles en pestañas, pestañas de documentos, inicio | Igual, más paneles flotantes, espacios de trabajo, barra de tareas contextual, temas de color | 🟡 |
| Herramientas de dibujo | Pluma, lápiz, pincel, pincel de manchas, formas, arco, espiral, cuadrículas | Además: Curvatura, Suavizar, Borrador de trazados, Unir, Ancho, pinceles caligráficos/arte/dispersión | 🟡 |
| Edición de nodos | Selección directa multi-trazado, convertir ancla, lazo, tijeras, cuchillo | Además: esquinas en vivo (widgets), Promediar, Remodelar | 🟡 |
| Buscatrazos | Unificar, Menos frente, Intersecar, Excluir, Creador de formas | Además: Dividir, Recortar, Combinar, Cortar, Contorno, Menos fondo | 🟡 |
| Formas en vivo | ❌ (un rectángulo redondeado no se puede reajustar) | Esquinas y propiedades editables siempre | ❌ |
| Apariencia | Relleno y trazo únicos; efectos destructivos (salvo sombra y desenfoque) | Varios rellenos/trazos, efectos editables, estilos gráficos | ❌ |
| Símbolos y motivos | ❌ | Panel Símbolos, instancias, motivos con modo de edición | ❌ |
| Degradados | Lineal y radial, varias paradas, panel | Además: edición sobre el objeto, degradado de forma libre, en trazos, malla | 🟡 |
| Color | RGB/HSB, muestras, recientes, editar colores | Además: CMYK, colores globales y planos, grupos de color, Volver a colorear con rueda, Guía de color | 🟡 |
| Texto | Punto, área, en trazado, Carácter, contornos | Además: párrafo (justificar, sangrías), estilos, texto enlazado entre cajas, glifos, OpenType, ajuste de texto, buscar y reemplazar, ortografía | 🟡 |
| Transformar | Mover, rotar, escalar, reflejar, distorsionar, Ctrl+D, punto de referencia | Además: Transformar cada uno, Transformación libre, Envolventes, Deformar, Deformación de posición libre | 🟡 |
| Precisión | Guías inteligentes (bordes, centros, anclas), reglas, guías, cuadrícula | Además: etiquetas de medida al dibujar, guías desde objetos, origen de reglas, cuadrícula de píxeles, perspectiva | 🟡 |
| Capas | Capas, grupos desplegables, ocultar, bloquear, reordenar | Además: subcapas, miniaturas, «localizar objeto», capas de plantilla, liberar a capas | 🟡 |
| Selección | Todo, invertir, mismo relleno/trazo/grosor, varita | Además: Seleccionar ▸ Igual (opacidad, fusión…), Objeto (textos, máscaras, puntos sueltos), guardar selección | 🟡 |
| Mesas de trabajo | Varias, panel, exportar por mesa | Además: reorganizar, numeración, opciones por mesa | ✅ |
| Calco y contornos | Calco de imagen, crear contornos | Calco en vivo reeditable | ✅ |
| Importar / exportar | SVG, PDF, AI (PDF), imágenes; PNG/JPG/WebP/SVG/PDF; pantallas | Además: .ai nativo, EPS, DXF/DWG, PSD con capas, TIFF, PDF/X, panel Exportar recursos | 🟡 |
| Aplicación | Escritorio (Win/Mac/Linux), PWA, autoguardado, recientes | Además: actualizaciones automáticas, preferencias, atajos personalizables, scripts | 🟡 |
| Idioma | Solo español | Multilingüe | ❌ |
| Funciones avanzadas | ❌ | 3D y materiales, Pintura interactiva, Malla, Gráficas, IA generativa | ❌ |

## 2. Plan por fases

El orden prioriza lo que **más se nota al usarlo a diario** y lo que **mejor aprovecha lo que ya existe**
(motor booleano con curvas exactas, regiones del Creador de formas, diálogos con vista previa).

### Fase A — El día a día, igual que en Illustrator (prioridad máxima)

| # | Mejora | Cómo | Esfuerzo |
|---|---|---|---|
| A1 | **Buscatrazos completo**: Dividir, Recortar, Combinar, Cortar, Contorno, Menos fondo | Reutilizar `Faces.build` (builder.js): Dividir = regiones separadas; Recortar/Combinar = regiones según el objeto de encima y su color | M |
| A2 | **Barra de tareas contextual** flotante bajo la selección (Illustrator 2024+) | Barra HTML posicionada bajo el cuadro de selección con las acciones de Propiedades | S |
| A3 | **Etiquetas de medida** al dibujar y mover (An × Al, ángulo, dX/dY) junto al cursor | Ampliar `SmartGuides.draw` con una etiqueta | S |
| A4 | **Esquinas en vivo**: widgets circulares en las esquinas con Selección directa; radio editable en Propiedades | Guardar el radio por esquina en `data-corners` y regenerar el trazado (reutilizar `Distort.roundCorners`) | M |
| A5 | **Alinear a objeto clave**, distribuir espaciado con valor, alinear a mesa o selección | Ampliar `Actions.align` y el panel Alinear | S |
| A6 | **Transformar cada uno** (Alt+Ctrl+Mayús+D) con valores aleatorios opcionales | Diálogo con vista previa aplicado objeto a objeto sobre su propio centro | S |
| A7 | **Seleccionar ▸ Igual / Objeto** (opacidad, modo de fusión, textos, máscaras, puntos sueltos) y guardar selección | Ampliar `Actions.selectSame` | S |
| A8 | **Guías**: crear desde objetos (Ctrl+5), bloquear, cambiar el origen de reglas | `Guides` + campo `App.doc.rulerOrigin` | S |
| A9 | **Capas**: subcapas, miniaturas, «localizar objeto», arrastrar la selección entre capas | Reescribir `renderLayers` con miniaturas en `<svg><use>` | M |
| A10 | **Preferencias** (unidades por defecto, incremento de teclado, autoguardado) y **tema claro/medio/oscuro** | Diálogo + variables CSS ya existentes en `:root` | M |

### Fase B — Apariencia no destructiva

| # | Mejora | Cómo | Esfuerzo |
|---|---|---|---|
| B1 | **Formas en vivo**: rectángulos, elipses, polígonos y estrellas reeditables (lados, radio, esquinas) | Guardar los parámetros en `data-shape` y regenerar al editar en Propiedades | M |
| B2 | **Panel Apariencia**: varios rellenos y trazos por objeto | Representar el objeto como grupo de capas de pintura sobre un mismo `d` (`<use>` del trazado base) | L |
| B3 | **Efectos editables** (zigzag, retorcer, redondear…): guardar el original y la lista de efectos | `data-source-d` + `data-effects` (JSON); se recalcula al cambiar parámetros | L |
| B4 | **Estilos gráficos** (guardar y aplicar apariencias) | Lista en el documento (como las muestras propias) | M |
| B5 | **Símbolos**: panel, instancias, editar el símbolo actualiza todas | `<symbol>` en `defs` + `<use>`; modo aislamiento para editar | M |
| B6 | **Motivos (patrones)** como muestras, con modo de edición | `<pattern>` en `defs`; reutilizar el modo aislamiento | M |
| B7 | **Degradados sobre el objeto**: barra con paradas arrastrables encima del dibujo; degradado en trazos | Herramienta Degradado con superposición editable | M |

### Fase C — Tipografía profesional

| # | Mejora | Cómo | Esfuerzo |
|---|---|---|---|
| C1 | **Panel Párrafo**: alinear, justificar, sangrías, espacio antes/después | Ampliar `TextLayout.layoutArea` (justificado = `word-spacing` por línea) | M |
| C2 | **Estilos de carácter y de párrafo** | Lista en el documento; aplicar atributos | M |
| C3 | **Texto enlazado** entre varias cajas de área | `data-thread` con el siguiente cuadro; reparto de líneas en cadena | M |
| C4 | **OpenType** (ligaduras, alternativos, versalitas), menú de fuentes con vista previa y fuentes del sistema | `font-feature-settings` + `queryLocalFonts` (ya usado en Crear contornos) | M |
| C5 | **Panel Glifos**, buscar y reemplazar, ortografía (corrector de Electron), ajuste de texto alrededor de objetos | Varias piezas pequeñas | M |

### Fase D — Más potencia de dibujo

| # | Mejora | Cómo | Esfuerzo |
|---|---|---|---|
| D1 | **Herramienta Curvatura** (dibujar curvas solo con clics) | Interpolación Catmull-Rom en vivo; reutiliza `smoothNodes` | M |
| D2 | **Herramientas Suavizar, Borrador de trazados y Unir** | Sobre `PathOps` existentes | S |
| D3 | **Herramienta Ancho** (trazo de grosor variable) y perfiles | Perfil de anchura por punto → contorno con `strokePolygon` | L |
| D4 | **Pinceles**: caligráfico, de arte (forma a lo largo del trazado), dispersión, motivo | Deformar una forma a lo largo de la curva (parametrización por longitud) | L |
| D5 | **Pintura interactiva** (Live Paint): rellenar regiones como con un cubo | Encaja directamente con `Faces.build` | M |
| D6 | **Transformación libre** (perspectiva, distorsión libre) y **Envolventes / Deformar** (arco, bandera, onda…) | Aplicar una función de deformación a puntos y manejadores tras subdividir (como `Distort.twist`) | M |

### Fase E — Color e imprenta

| # | Mejora | Cómo | Esfuerzo |
|---|---|---|---|
| E1 | **Modo CMYK**: deslizadores CMYK, conversión y aviso de gama | Conversión básica; con perfil ICC opcional (lcms compilado a WebAssembly) | M |
| E2 | **Colores globales y planos**: cambiar la muestra actualiza todos los objetos | Referencia `data-swatch` y repintado | M |
| E3 | **Volver a colorear ilustración** con rueda de color y armonías; Guía de color | Diálogo propio sobre `Recolor.apply` | M |
| E4 | **PDF para imprenta** (PDF/X), sobreimpresión simulada | Opciones nuevas en `Export.pdfPages` | M |

### Fase F — Aplicación y comunidad (clave para GitHub)

| # | Mejora | Cómo | Esfuerzo |
|---|---|---|---|
| F1 | **Interfaz en inglés** (y sistema para más idiomas) | Extraer textos a `i18n/es.json` y `en.json` | L |
| F2 | **Actualizaciones automáticas** desde GitHub Releases | `electron-updater` | S |
| F3 | **Scripts y complementos** (como Archivo ▸ Scripts de Illustrator) | Cargar `.js` del usuario con una API pública (`Vectora.selection`, `addObject`…) | M |
| F4 | **Atajos personalizables** | Editor sobre `Menus.shortcuts` | M |
| F5 | **Rendimiento con documentos grandes** (miles de objetos) | Historial por diferencias en lugar de copias completas; repintado de la superposición limitado a cuadros por segundo | M |
| F6 | **Más formatos**: EPS (importar), DXF (CAD), PSD con capas, TIFF | Lectores/escritores en JS por formato | L |
| F7 | **Firma de código** de los instaladores (sin aviso de SmartScreen) | Certificado de firma; paso en `release.yml` | S (+ coste del certificado) |

### Fuera de alcance (o solo opcional)

- **Guardar en .ai nativo**: formato propietario sin documentación pública completa. Se mantiene abrir .ai compatible con PDF.
- **Adobe Fonts, bibliotecas Pantone y Creative Cloud**: servicios y licencias de Adobe.
- **IA generativa** (texto a vector, volver a colorear generativo): posible solo como complemento opcional con la clave de API del propio usuario.
- **3D, malla de degradado y gráficas**: muy costosas para el uso habitual; se valorarán al final.

## 3. Recomendación

Empezar por la **Fase A completa**: son 10 mejoras pequeñas o medianas que se notan en cada sesión de trabajo y apenas
necesitan código nuevo de base. Después, **B1 + B5** (formas en vivo y símbolos) y **F1** (inglés), que es lo que más
multiplica la comunidad posible en GitHub. Cada mejora se entrega con prueba automática (`tests.html` o Playwright)
y su propio commit, igual que hasta ahora.
