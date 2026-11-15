# Plan de mejora: Vectora 1.3.1

Vectora 1.3 ya tiene muchas funciones. Este plan no añade más: busca lo que falla o va mal en las que hay, lo arregla y deja pruebas automáticas para que no vuelva a romperse.

## 1. Diagnóstico

Antes de planear se midió el programa con un navegador controlado por script. No se partió de suposiciones.

| Qué se revisó | Cómo | Resultado |
|---|---|---|
| Comandos de menú | Los 262 comandos, con 7 selecciones distintas | Ninguno lanza errores |
| Herramientas | Las 59, arrastrando y haciendo clic sobre el lienzo | **1 fallo:** Anchura |
| Llamadas a funciones | Las 558 llamadas `Objeto.metodo()` del código, comprobadas contra los objetos reales | **1 inexistente:** `Geo.fromShape` |
| Pruebas de geometría | `tests.html` | 30 de 30 |
| Guardar y abrir | Ida y vuelta de un dibujo | Idéntico |
| Abrir un SVG malicioso | Archivo con 15 trampas | **4 huecos** (ver fase 2) |
| Rendimiento | 3.000 objetos seleccionados | **Lento:** 1,1 s por cada paso de arrastre |
| PDF vectorial | Cada efecto comparado, píxel a píxel, con el PNG | **Se perdían 6 efectos y las máscaras de opacidad** |
| Interfaz en inglés | Textos visibles con el idioma en inglés | **8 textos en español** |
| Accesibilidad | Roles, nombres y uso con teclado | **Sin roles;** herramientas y menús solo con ratón; 38 campos sin nombre |
| Pruebas en GitHub | Qué se ejecuta en cada cambio | Solo sintaxis; **ninguna prueba en navegador** |

## 2. Plan y resultado

Las fases van ordenadas por daño al usuario: primero lo que falla, después lo que molesta y al final lo que previene.

### Fase 1 — Errores

- **Herramienta Anchura.** Fallaba al pasar el cursor sobre rectángulos, elipses y polígonos. Llamaba a `Geo.fromShape`, que no existe; la función correcta es `PathData.fromShape`. ✅ Corregido.

### Fase 2 — Seguridad al abrir archivos

El saneado de SVG ya quitaba `<script>`, los atributos `on*` y los enlaces `javascript:`. Faltaban estos casos:

| Hueco | Riesgo | Arreglo |
|---|---|---|
| Animaciones (`<animate>`, `<set>`) | Pueden reescribir un enlace o un `on*` después del saneado | Se eliminan |
| Imágenes, `<use>` y rellenos que apuntan a internet | Abrir un archivo avisaba a un servidor ajeno (rastreo) | Solo se admiten referencias internas (`#id`) e imágenes incrustadas |
| Enlaces `data:text/html` | Abren una página con código | Los enlaces solo admiten `http(s)` |
| `javascript:` con tabuladores o saltos de línea en medio | Saltaba el filtro | Se comparan sin espacios ni caracteres de control |

✅ Corregido. El archivo de prueba con 15 trampas ya no ejecuta nada ni hace peticiones a internet. Se conservan las imágenes incrustadas y los enlaces normales.

### Fase 3 — Rendimiento con dibujos grandes

Medido con 3.000 objetos seleccionados, en el mismo portátil:

| Acción | Antes | Después |
|---|---|---|
| Arrastrar la selección (cada paso) | 1.105 ms | 111 ms |
| Mover con las flechas | 1.925 ms | 153 ms |
| Seleccionar todo | 750 ms | 78 ms |
| Deshacer | 217 ms | 89 ms |

Había tres causas, cada una con su arreglo:

1. **Un contorno por objeto.** Cada redibujado creaba 3.000 trazados en la capa de selección. Con más de 400 objetos ahora se dibuja el rectángulo de cada uno dentro de un único trazado (`Selection.outlineMany`).
2. **La caja de la selección se recalculaba 8 veces por acción.** La pedían el redibujado, el panel Transformar, la barra de control y otros. Ahora se recuerda mientras el dibujo no cambie (`Geo.selBox`). Un `MutationObserver` consultado con `takeRecords()` avisa en el acto de cualquier cambio, así que nunca se usa una caja vieja.
3. **Lecturas y escrituras intercaladas.** Al transformar, se leía la matriz de un objeto, se escribía y se leía la del siguiente, lo que obligaba al navegador a recalcular el dibujo 3.000 veces. Ahora se leen todas primero y se escribe después (`Geo.applyDocAll`).

✅ Hecho.

### Fase 4 — PDF vectorial fiel

Era el punto pendiente del plan de paridad. La comparación mostró que el PDF perdía la sombra, el desenfoque, los resplandores, el desvanecer, el grano y las máscaras de opacidad. Los objetos salían lisos, porque la librería svg2pdf no admite filtros ni máscaras.

Ahora, al exportar, cada objeto con filtro o máscara se sustituye por su imagen a 300 ppp, en su sitio y en su orden (`Export.flattenEffects`). Todo lo demás sigue siendo vectorial. Es lo mismo que hacen los editores profesionales con los efectos de trama.

✅ Hecho. Diferencia máxima entre PDF y PNG: 1 sobre 255.

### Fase 5 — Inglés completo

Quedaban 8 textos en español con la interfaz en inglés: tres indicaciones de botones, dos opciones de lista y la versión, entre otros. ✅ Traducidos.

### Fase 6 — Accesibilidad

- La barra de herramientas y la barra de menús tienen roles (`toolbar`, `menubar`, `menuitem`), nombre y estado (`aria-pressed`, `aria-expanded`).
- Las herramientas se usan con el teclado: Tab para entrar, flechas para moverse, Intro para elegir y la tecla de menú para abrir el grupo.
- Los menús también: flechas para moverse, Intro para ejecutar y Escape para cerrar.
- Los 58 campos de los paneles tienen nombre para los lectores de pantalla.
- El foco del teclado se ve.

✅ Hecho en `js/a11y.js`.

### Fase 7 — Pruebas automáticas

Todo lo anterior queda vigilado por `npm test` (`scripts/e2e.js`), que GitHub Actions ejecuta en cada cambio:

| Grupo | Qué comprueba |
|---|---|
| `unidad` | Las 30 pruebas de geometría |
| `arranque` | La aplicación carga sin errores en la consola |
| `llamadas` | Ninguna llamada apunta a un método que no existe (habría detectado el fallo de Anchura) |
| `menus` | 1.180 ejecuciones de comandos: sin excepciones, sin valores `NaN` y con deshacer |
| `herramientas` | Las 59 herramientas con el ratón |
| `archivo` | Guardar y abrir conserva el dibujo |
| `saneado` | El SVG malicioso no ejecuta código ni llama a internet |
| `rendimiento` | 3.000 objetos dentro de un límite de tiempo |
| `idioma` | Ningún texto en español con la interfaz en inglés |
| `accesibilidad` | Roles, nombres y uso real con el teclado |
| `pdf` | El PDF vectorial se ve como el PNG |

✅ Hecho.

## 3. Lo que queda fuera

Sigue pendiente, por orden de valor:

1. **Firma de código de los instaladores.** Windows y macOS muestran un aviso al instalar. Requiere comprar un certificado.
2. **Separación de colores real en PDF.** Las tintas planas se exportan como RGB.
3. **Actualización automática** del programa de escritorio.
4. **Dibujos de más de 10.000 objetos.** El historial guarda una copia completa del dibujo en cada paso. Habría que guardar solo los cambios.
5. **Diálogos en inglés.** La prueba de idioma cubre menús, herramientas y paneles, pero no abre cada diálogo.
