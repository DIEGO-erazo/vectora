/* Vectora — idioma de la interfaz. El código está en español; en inglés se traducen en vivo
   los textos de la interfaz (menús, paneles, diálogos, avisos) con este diccionario.
   El contenido del documento nunca se traduce. Para añadir un idioma basta otro diccionario. */
'use strict';

const I18N_EN = `
Archivo=File|Edición=Edit|Objeto=Object|Texto=Type|Seleccionar=Select|Efecto=Effect|Ver=View|Ventana=Window|Ayuda=Help
Nuevo=New|Abrir=Open|Cerrar=Close|Cerrar todo=Close All|Guardar=Save|Guardar como=Save As|Colocar=Place|Exportar=Export|Exportar como=Export As
Exportar para pantallas=Export for Screens|Ajustar documento=Document Setup|Mesa de trabajo=Artboard|Modo de color del documento=Document Color Mode
Color RGB=RGB Color|Color CMYK=CMYK Color|Scripts=Scripts|Consola de scripts=Script Console|Ejecutar script guardado=Run Saved Script
Abrir archivo de script=Open Script File|Imprimir=Print|Deshacer=Undo|Rehacer=Redo|Cortar=Cut|Copiar=Copy|Pegar=Paste|Pegar delante=Paste in Front
Pegar detrás=Paste in Back|Borrar=Clear|Duplicar=Duplicate|Buscar y reemplazar=Find and Replace|Preferencias=Preferences|Atajos de teclado=Keyboard Shortcuts
Editar colores=Edit Colors|Volver a colorear ilustración=Recolor Artwork|Invertir colores=Invert Colors|Convertir a escala de grises=Convert to Grayscale
Saturar=Saturate|Ajustar equilibrio de color=Adjust Color Balance|Fusionar de delante a detrás=Blend Front to Back|Ajustar a cuadrícula=Snap to Grid
Transformar=Transform|Transformar de nuevo=Transform Again|Mover=Move|Transformar cada uno=Transform Each|Rotar=Rotate|Escalar=Scale
Reflejar horizontal=Reflect Horizontal|Reflejar vertical=Reflect Vertical|Reflejar=Reflect|Distorsionar=Shear|Mesas de trabajo=Artboards|Nueva=New
Eliminar=Delete|Ajustar a límites de ilustración=Fit to Artwork Bounds|Ajustar a límites de selección=Fit to Selected Art|Fusión=Blend|Crear=Make
Liberar=Release|Expandir=Expand|Opciones de fusión=Blend Options|Organizar=Arrange|Traer al frente=Bring to Front|Hacia delante=Bring Forward
Hacia atrás=Send Backward|Enviar al fondo=Send to Back|Agrupar=Group|Aislar grupo seleccionado=Isolate Selected Group|Salir del modo aislamiento=Exit Isolation Mode
Desagrupar=Ungroup|Bloquear selección=Lock Selection|Desbloquear todo=Unlock All|Ocultar selección=Hide Selection|Mostrar todo=Show All
Buscatrazos=Pathfinder|Unificar=Unite|Menos frente=Minus Front|Intersecar=Intersect|Excluir=Exclude|Dividir=Divide|Recortar=Trim|Combinar=Merge
Contorno=Outline|Menos fondo=Minus Back|Símbolo=Symbol|Nuevo símbolo=New Symbol|Editar símbolo=Edit Symbol|Romper vínculo=Break Link|Redefinir símbolo=Redefine Symbol
Motivo=Pattern|Editar motivo=Edit Pattern|Convertir en trazado=Convert to Path|Calco de imagen=Image Trace|Crear y expandir=Make and Expand|Trazado=Path
Unir=Join|Simplificar=Simplify|Contornear trazo=Outline Stroke|Desplazar trazado=Offset Path|Trazado compuesto=Compound Path|Máscara de recorte=Clipping Mask
Distorsión de envolvente=Envelope Distort|Deformar=Warp|Expandir apariencia=Expand Appearance|Crear contornos=Create Outlines|Herramienta Texto=Type Tool
Herramienta Texto de área=Area Type Tool|Herramienta Texto en trazado=Type on a Path Tool|Convertir en texto de área=Convert to Area Type|Cambiar mayúsculas=Change Case
MAYÚSCULAS=UPPERCASE|minúsculas=lowercase|Tipo Título=Title Case|Tipo oración=Sentence case|Texto enlazado=Threaded Text|Liberar selección=Release Selection
Quitar enlace=Remove Threading|Revisar ortografía automáticamente=Auto Spell Check|Rellenar con texto de muestra=Fill with Placeholder Text|Carácter=Character
Párrafo=Paragraph|Estilos de texto=Text Styles|Glifos=Glyphs|Fuentes del sistema=System Fonts|Todo=All|Deseleccionar=Deselect|Invertir selección=Inverse
Igual=Same|Relleno y trazo=Fill & Stroke|Color de relleno=Fill Color|Color de trazo=Stroke Color|Grosor de trazo=Stroke Weight|Opacidad=Opacity|Modo de fusión=Blending Mode
Tipo de objeto=Object Type|Familia de fuentes=Font Family|Todo en la misma capa=All on Same Layer|Objetos de texto=Text Objects|Imágenes=Images|Grupos=Groups
Máscaras de recorte=Clipping Masks|Puntos sueltos=Stray Points|Objeto siguiente encima=Next Object Above|Objeto siguiente debajo=Next Object Below
Guardar selección=Save Selection|Selecciones guardadas=Saved Selections|Mismo color de relleno=Same Fill Color|Mismo color de trazo=Same Stroke Color|Mismo grosor de trazo=Same Stroke Weight
Distorsionar y transformar=Distort & Transform|Fruncir y engordar=Pucker & Bloat|Retorcer=Twist|Zigzag=Zig Zag|Rugosidad=Roughen|Estilizar=Stylize|Redondear esquinas=Round Corners
Arco=Arc|Arco inferior=Arc Lower|Arco superior=Arc Upper|Arcada=Arch|Abombado=Bulge|Concha inferior=Shell Lower|Concha superior=Shell Upper|Bandera=Flag|Onda=Wave|Pez=Fish
Ascendente=Rise|Ojo de pez=Fisheye|Inflar=Inflate|Comprimir=Squeeze|Giro=Twist|Caligrafía=Calligraphy|Perfil de anchura=Width Profile|Sombra paralela=Drop Shadow
Desenfoque gaussiano=Gaussian Blur|Quitar efectos=Clear Effects|Acercar=Zoom In|Alejar=Zoom Out|Encajar mesa de trabajo en ventana=Fit Artboard in Window
Encajar todas en la ventana=Fit All in Window|Tamaño real=Actual Size|Contornear=Outline|Mostrar cuadrícula=Show Grid|Reglas=Rulers|Guías inteligentes=Smart Guides|Guías=Guides
Ocultar guías=Hide Guides|Bloquear guías=Lock Guides|Crear guías=Make Guides|Borrar guías=Clear Guides|Restablecer origen de reglas=Reset Ruler Origin|Documento siguiente=Next Document
Documento anterior=Previous Document|Pantalla de inicio=Home Screen|Barra de tareas contextual=Contextual Task Bar|Propiedades=Properties|Historial=History|Símbolos=Symbols
Color=Color|Muestras=Swatches|Trazo=Stroke|Degradado=Gradient|Transparencia=Transparency|Apariencia=Appearance|Estilos gráficos=Graphic Styles|Pinceles=Brushes|Alinear=Align
Capas=Layers|Instalar como aplicación=Install as App|Descargar programa de escritorio=Download Desktop App|Buscar actualizaciones=Check for Updates
Código fuente en GitHub=Source Code on GitHub|Informar de un problema=Report a Problem|Acerca de Vectora=About Vectora|Mesas=Artboards
Selección=Selection|Selección directa=Direct Selection|Selección de grupos=Group Selection|Varita mágica=Magic Wand|Lazo=Lasso|Pluma=Pen|Convertir punto de ancla=Anchor Point
Texto de área=Area Type|Texto en trazado=Type on a Path|Segmento de línea=Line Segment|Espiral=Spiral|Cuadrícula rectangular=Rectangular Grid|Cuadrícula polar=Polar Grid
Rectángulo=Rectangle|Rectángulo redondeado=Rounded Rectangle|Elipse=Ellipse|Polígono=Polygon|Estrella=Star|Pincel=Paintbrush|Pincel de manchas=Blob Brush|Lápiz=Pencil
Borrador=Eraser|Tijeras=Scissors|Cuchillo=Knife|Escala=Scale|Creador de formas=Shape Builder|Cuentagotas=Eyedropper|Mano=Hand|Zoom=Zoom|Curvatura=Curvature|Suavizar=Smooth
Borrador de trazados=Path Eraser|Transformación libre=Free Transform|Bote de pintura interactiva=Live Paint Bucket|Anchura=Width
Aceptar=OK|Cancelar=Cancel|Sí=Yes|No=No|Previsualizar=Preview|Nombre=Name|Tipo=Type|Estilo=Style|Tamaño=Size|Ángulo=Angle|Ángulo (°)=Angle (°)|Radio=Radius|Radio (px)=Radius (px)
Anchura (px)=Width (px)|Altura (px)=Height (px)|Altura=Height|Horizontal=Horizontal|Vertical=Vertical|Horizontal (px)=Horizontal (px)|Vertical (px)=Vertical (px)|Horizontal (%)=Horizontal (%)|Vertical (%)=Vertical (%)
Desplazamiento X=Offset X|Desplazamiento Y=Offset Y|Desplazamiento (px)=Offset (px)|Desenfoque=Blur|Opacidad (%)=Opacity (%)|Cantidad (%)=Amount (%)|Intensidad (%)=Intensity (%)
Tamaño (px)=Size (px)|Tamaño (pt)=Size (pt)|Crestas por segmento=Ridges per segment|Puntos=Points|Vértice=Corner|Suavizado=Smoothness|Variación=Variation|Detalle (puntos por segmento)=Detail (points per segment)
Rojo (%)=Red (%)|Verde (%)=Green (%)|Azul (%)=Blue (%)|Copiar=Copy|Restablecer=Reset|Restablecer todo=Reset All|Buscar=Find|Reemplazar por=Replace with|Reemplazar todo=Replace All
Coincidir mayúsculas=Match Case|Palabras completas=Whole Word|Ejecutar=Run|Ejecutar script=Run Script|Script=Script|Recientes=Recent|Biblioteca de motivos=Pattern Library|Motivos=Patterns
Colores globales y planos=Global and Spot Colors|Nueva muestra=New Swatch|Opciones de muestra=Swatch Options|Tipo de color=Color Type|Color global (cuatricromía)=Global Color (process)
Color plano (tinta directa)=Spot Color|Matiz=Tint|Matiz (%)=Tint (%)|Actual=Current|Nuevo=New|Vincular colores de armonía=Link Harmony Colors|Tono=Hue|Saturación=Saturation|Brillo=Brightness
Aleatorio=Randomize|Grises=Grayscale|Mesas de trabajo=Artboards|Tamaño de papel=Paper Size|Orientación=Orientation|Automática=Auto|Ajustar a la página=Fit to Page|Marcas y sangrado=Marks and Bleed
Marcas de recorte=Trim Marks|Marcas de registro=Registration Marks|Información de página=Page Information|Solo la activa=Active Only|Igual que la mesa de trabajo=Same as Artboard|Carta=Letter|Tabloide=Tabloid
Modo de color=Color Mode|Relleno=Fill|Relleno (X para alternar)=Fill (X to toggle)|Trazo (X para alternar)=Stroke (X to toggle)|Ninguno=None|Ninguno (/)=None (/)|ninguno=none|degradado=gradient
Relleno y trazo por defecto (D)=Default Fill and Stroke (D)|Intercambiar relleno y trazo (Mayús+X)=Swap Fill and Stroke (Shift+X)|Grosor=Weight|Extremo=Cap|Esquina=Corner|Uniones=Join
Inglete=Miter|Redonda=Round|Redondas=Round|Biselada=Bevel|Biseladas=Bevel|Plano=Butt|Redondo=Round|Proyectado=Projecting|Discontinua=Dashed Line|Discontinuo=Dashed|Punta inicial=Start Arrowhead|Punta final=End Arrowhead
Perfil=Profile|Uniforme=Uniform|Afilado en ambos extremos=Tapered Both Ends|Afilado al inicio=Tapered Start|Afilado al final=Tapered End|Estrangulado=Pinched|Gota=Drop|Personalizado=Custom
Modo de fusión=Blending Mode|Normal=Normal|Multiplicar=Multiply|Trama=Screen|Superponer=Overlay|Oscurecer=Darken|Aclarar=Lighten|Sobreexponer color=Color Dodge|Subexponer color=Color Burn
Luz fuerte=Hard Light|Luz suave=Soft Light|Diferencia=Difference|Exclusión=Exclusion|Luminosidad=Luminosity|Opacidad objeto=Object Opacity|Opacidad relleno=Fill Opacity|Opacidad trazo=Stroke Opacity
Fuente=Font|Negrita=Bold|Cursiva=Italic|Negrita cursiva=Bold Italic|Recta=Regular|Interlineado (%)=Leading (%)|Tracking (‰ em)=Tracking (‰ em)|Alineación=Alignment|Izquierda=Left|Centro=Center|Derecha=Right
Decoración=Decoration|Subrayado=Underline|Tachado=Strikethrough|Cargar fuentes del sistema=Load System Fonts|Sangría izquierda=Left Indent|Sangría derecha=Right Indent|Sangría 1.ª línea=First-Line Indent
Espacio antes=Space Before|Espacio después=Space After|Justificar, sangrías y espacios se aplican al texto de área.=Justification, indents and spacing apply to area type.
Alinear a la izquierda=Align Left|Centrar=Align Center|Alinear a la derecha=Align Right|Justificar con la última línea alineada a la izquierda=Justify with Last Line Aligned Left|Justificar todas las líneas=Justify All Lines
Ligaduras estándar=Standard Ligatures|Ligaduras discrecionales=Discretionary Ligatures|Caracteres decorativos=Swash|Versalitas=Small Caps|Fracciones=Fractions|Ordinales=Ordinals|Superíndice=Superscript
Subíndice=Subscript|Números tabulares=Tabular Figures|Números de estilo antiguo=Oldstyle Figures|Latín básico=Basic Latin|Latín extendido=Latin Extended|Griego=Greek|Cirílico=Cyrillic|Puntuación=Punctuation
Monedas=Currency|Letras y números=Letterlike Symbols|Flechas=Arrows|Matemáticas=Math|Técnicos=Technical|Formas geométricas=Geometric Shapes|Símbolos varios=Miscellaneous Symbols|Dingbats=Dingbats
Estilos de párrafo=Paragraph Styles|Estilos de carácter=Character Styles|[Párrafo normal]=[Normal Paragraph Style]|[Carácter normal]=[Normal Character Style]|Opciones de estilo=Style Options
Nuevo estilo de párrafo=New Paragraph Style|Nuevo estilo de carácter=New Character Style|Nuevo estilo con el formato del texto seleccionado=New style from selected text|Redefinir el estilo con el texto seleccionado=Redefine style from selected text
Eliminar estilo=Delete Style|Nuevo estilo gráfico=New Graphic Style|Opciones de estilo gráfico=Graphic Style Options|Abrir la biblioteca de estilos gráficos=Open Graphic Styles Library
Nuevo estilo gráfico con la apariencia de la selección=New graphic style from selection|Redefinir el estilo con la selección=Redefine style from selection|Eliminar estilo gráfico=Delete Graphic Style
Predeterminado=Default|Sombra suave=Soft Shadow|Contorno grueso=Thick Outline|Sello=Seal|Boceto=Sketch|Burbuja=Bubble|Neblina=Haze
Añadir nuevo efecto=Add New Effect|Borrar apariencia (quitar todos los efectos)=Clear Appearance|Activar/desactivar=Toggle visibility|Editar efecto=Edit Effect|Quitar=Remove|Sin selección=No Selection
Opciones de deformación=Warp Options|Curvar (%)=Bend (%)|Distorsión horizontal (%)=Horizontal Distortion (%)|Distorsión vertical (%)=Vertical Distortion (%)
Pincel caligráfico=Calligraphic Brush|Pincel de arte=Art Brush|Pincel de dispersión=Scatter Brush|Nuevo pincel=New Brush|Eliminar pincel=Delete Brush|Básico=Basic|Caligráfico ovalado=Oval Calligraphic
Caligráfico plano=Flat Calligraphic|Afilado=Tapered|Hoja=Leaf|Tinta=Ink|Flecha=Arrow|Cinta=Ribbon|Estrellas=Stars|Corazones=Hearts|Redondez (%)=Roundness (%)|Tamaño (% del trazo)=Size (% of stroke)
Grosor (× trazo)=Thickness (× stroke)|Voltear=Flip|Tamaño (× trazo)=Size (× stroke)|Espaciado (%)=Spacing (%)|Aleatorio (%)=Random (%)|Girar con el trazado=Rotate with path|Escala de anchura=Width scale
Quitar el pincel (trazo básico)=Remove brush (basic stroke)|Opciones del pincel del objeto seleccionado=Brush options of selected object|Nuevo pincel con la ilustración seleccionada=New brush from selected art
Pincel de arte (se estira a lo largo)=Art brush (stretches along path)|Pincel de dispersión (copias)=Scatter brush (copies)|Distorsión libre=Free Distort|Perspectiva=Perspective|Arrastra una esquina=Drag a corner
Tamaño de las esquinas=Corner Size|Radio de las esquinas=Corner Radius|Forma=Shape|Acciones rápidas=Quick Actions|Documento=Document|Unidades=Units|Píxeles=Pixels|Puntos=Points|Milímetros=Millimeters|Centímetros=Centimeters|Pulgadas=Inches
Alinear a=Align To|Distribuir espaciado=Distribute Spacing|Objeto clave=Key Object|Nueva capa=New Layer|Eliminar capa=Delete Layer|Opciones de capa=Layer Options|Plantilla=Template|Imprimir / exportar=Print / Export
Menú del panel Capas=Layers Panel Menu|Visibilidad=Visibility|Bloqueo=Lock|Nueva mesa de trabajo=New Artboard|Eliminar mesa de trabajo=Delete Artboard|Editar mesa de trabajo=Edit Artboard
Nuevo archivo=New File|Te damos la bienvenida a Vectora=Welcome to Vectora|Comenzar rápidamente=Quick Start|Borrar lista=Clear List|Los documentos que abras o guardes aparecerán aquí.=Documents you open or save will appear here.
Ilustración de ejemplo=Sample Artwork|Interfaz=Interface|General=General|Oscuro=Dark|Medio oscuro=Medium Dark|Medio claro=Medium Light|Claro=Light|Incremento del teclado (px)=Keyboard Increment (px)
Con Mayús (px)=With Shift (px)|Niveles de deshacer=Undo Levels|Autoguardado de la sesión=Session Autosave|Pantalla de inicio al abrir=Show Home Screen on Launch|Tolerancia de ajuste (px)=Snap Tolerance (px)
Ajustar a puntos de ancla=Snap to Anchor Points|Idioma=Language|Comandos de menú=Menu Commands|Herramientas=Tools|Buscar comando=Search command|Cerrar (Ctrl+W)=Close (Ctrl+W)
Guardar=Save|Formato=Format|Formatos=Formats|Escalas=Scales|Resolución=Resolution|Fondo=Background|Transparente=Transparent|Blanco=White|Negro=Black|Calidad (0-10)=Quality (0-10)|Prefijo=Prefix
Opciones PDF=PDF Options|Opciones SVG=SVG Options|PDF vectorial=Vector PDF|Imprimir / Guardar como PDF=Print / Save as PDF|Incluir sangrado=Include Bleed|Minificar=Minify|Decimales=Decimals
Cada mesa de trabajo=Each Artboard|Cada capa=Each Layer|Cada objeto seleccionado=Each Selected Object|Mesa de trabajo actual=Current Artboard|Mesa actual + sangrado=Current Artboard + Bleed|Todo el arte (ajustado)=All Artwork (trimmed)
Solo la selección=Selection Only|Pantalla (72 ppp)=Screen (72 ppi)|Media (150 ppp)=Medium (150 ppi)|Alta (300 ppp)=High (300 ppi)|Otra=Other|Optimizado para el arte=Art Optimized|Ninguno (píxeles nítidos)=None (sharp pixels)
Ajuste preestablecido=Preset|Detalles del ajuste preestablecido=Preset Details|Sangrado=Bleed|Cambiar orientación=Change Orientation|Mantener proporciones de anchura y altura=Constrain Width and Height Proportions
Colores=Colors|Umbral (0-255)=Threshold (0-255)|Ignorar el blanco=Ignore White|Conservar la imagen original=Keep Original Image|Blanco y negro=Black and White|Escala de grises=Grayscale|Ruido (px)=Noise (px)|Detalle (1-10)=Detail (1-10)
Importar PDF=Import PDF|Opciones de imagen=Image Options|Opciones de símbolo=Symbol Options|Eliminar símbolo=Delete Symbol|Romper vínculo con el símbolo=Break Link to Symbol|Romper vínculo con símbolo=Break Link to Symbol
Redefinir el símbolo con la selección=Redefine symbol with selection|Nuevo símbolo con la selección (F8)=New symbol from selection (F8)|Colocar instancia (o doble clic / arrastrar al lienzo)=Place instance (or double-click / drag to canvas)
Selecciona ilustración y pulsa ＋ para crear un símbolo.=Select artwork and press ＋ to create a symbol.|Crear motivo=Make Pattern|Clic para añadir una parada=Click to add a stop|Lineal=Linear|Radial=Radial
Color parada=Stop Color|Posición %=Location %|Opacidad %=Opacity %|Aplicar al relleno=Apply to Fill|Al trazo=To Stroke|Quitar parada=Delete Stop|Eliminar parada=Delete Stop
Nueva muestra con el color actual=New swatch from current color|Nuevo color global o plano=New global or spot color|Pulsa ◆＋ para crear un color global o plano.=Press ◆＋ to create a global or spot color.
Reordenar colores al azar=Shuffle colors|Editar texto=Edit Text|Calco de imagen…=Image Trace…|Crear máscara de recorte=Make Clipping Mask|Liberar máscara de recorte=Release Clipping Mask|Crear trazado compuesto=Make Compound Path
Mostrar reglas=Show Rulers|Seleccionar todo=Select All|Salir del modo aislamiento (Esc)=Exit Isolation Mode (Esc)|Bloquear=Lock|Ocultar=Hide|Editar=Edit|Rotar y reflejar=Rotate and Reflect|Reflejar X=Reflect X|Reflejar Y=Reflect Y
Reflejar horizontalmente=Reflect Horizontally|Reflejar verticalmente=Reflect Vertically|Transformar de nuevo (Ctrl+D)=Transform Again (Ctrl+D)|Eje=Axis|Ángulo de rotación=Rotation Angle|Ángulo de inclinación=Shear Angle
Pasos especificados=Specified Steps|Color suave=Smooth Color|Distancia especificada=Specified Distance|Espaciado horizontal=Horizontal Spacing|Espaciado vertical=Vertical Spacing|Espacio horizontal (px)=Horizontal gap (px)|Espacio vertical (px)=Vertical gap (px)
Tolerancia (px)=Tolerance (px)|Simplificar=Simplify|Encajar todas en la ventana (Ctrl+Alt+0)=Fit All in Window (Ctrl+Alt+0)|Eliminar mesa de trabajo (Supr)=Delete Artboard (Del)
Haz clic en un objeto y después en otro=Click an object, then another|Con un objeto se alinea a la mesa de trabajo=With one object it aligns to the artboard|Arrastra sobre la selección=Drag across the selection
Añadir al menú las fuentes instaladas en el equipo=Add installed fonts to the menu|Cuadrícula=Grid|Adaptable (responsive)=Responsive|Atributos de presentación=Presentation Attributes|CSS interno=Internal CSS|Conservar datos de Vectora=Preserve Vectora Data
Archivos compatibles=Supported Files|Recursos=Assets|Ajustar al arte=Fit to Artwork|Unidades del documento (Archivo ▸ Ajustar documento)=Document units (File ▸ Document Setup)|Área=Area|General=General
Resultado=Result|Error=Error|Vectora — Editor vectorial libre=Vectora — Free Vector Editor|Hacer clic en un objeto y después en otro=Click an object, then another|Usar sangrado del documento=Use document bleed
Atajos guardados. Los de las herramientas se aplican al volver a abrir Vectora.=Shortcuts saved. Tool shortcuts apply after restarting Vectora.|Mis scripts=My Scripts|Ejemplos=Examples|Cerrar=Close|Eliminar=Delete
Selecciona uno o más trazados.=Select one or more paths.|El efecto queda editable en el panel Apariencia.=The effect stays editable in the Appearance panel.|Selección directa=Direct Selection|Varios=Mixed
Trazados=Paths|Grupo=Group|Imagen=Image|Capa=Layer|Capa 1=Layer 1|Mesa de trabajo 1=Artboard 1|objetos=objects|2 objetos=2 objects|Estilo 1=Style 1|Nueva capa=New Layer
An=W|Al=H|Repetir=Repeat|Espejo=Mirror|Opciones=Options|Opciones de repetición=Repeat Options|Número de copias=Number of instances|Columnas=Columns|Filas=Rows|Reflejar filas/columnas=Flip rows/columns|Columnas alternas=Alternate columns|Filas alternas=Alternate rows|Ambas=Both|Posición del eje (px)=Axis position (px)|Repetición=Repeat|Promediar=Average|Añadir puntos de ancla=Add Anchor Points|Quitar puntos de ancla=Remove Anchor Points|Dividir objetos debajo=Divide Objects Below|Dividir en cuadrícula=Split Into Grid|Limpiar=Clean Up|Rasterizar=Rasterize|Recortar imagen=Crop Image|Navegador=Navigator|Información=Info|Rotar vista=Rotate View|Herramienta Rotar vista=Rotate View Tool|Restablecer rotación de vista=Reset Rotate View|Medianil vertical (px)=Vertical gutter (px)|Medianil horizontal (px)=Horizontal gutter (px)|Añadir guías=Add Guides|Objetos sin pintura=Unpainted Objects|Trazados de texto vacíos=Empty Text Paths|Grupos vacíos=Empty Groups|Añadir alrededor (px)=Add Around Object (px)|Aplicar=Apply|Imagen rasterizada=Rasterized Image|Expandir repetición=Expand Repeat|Liberar repetición=Release Repeat
Entrelazar=Intertwine|Entrelazado=Intertwine|Máscara de opacidad=Opacity Mask|Crear máscara=Make Mask|Liberar=Release|Recortar=Clip|Invertir máscara=Invert Mask|Máscara=Mask|Modo de dibujo=Drawing Mode|Detrás=Behind|Dentro=Inside|Alternar=Cycle|Dibujar normal=Draw Normal|Dibujar detrás=Draw Behind|Dibujar dentro (selecciona un objeto)=Draw Inside (select an object)|Dibujar dentro=Draw Inside|Shaper=Shaper|Deformar=Warp|Remolino=Twirl|Fruncir=Pucker|Engordar=Bloat|Cristalizar=Crystallize|Arrugar=Wrinkle|Intensidad=Intensity|Crear máscara de opacidad=Make Opacity Mask|Liberar máscara de opacidad=Release Opacity Mask
Resplandor exterior=Outer Glow|Resplandor interior=Inner Glow|Desvanecer=Feather|Grano=Grain|Textura=Texture|Garabato=Scribble|Radio de desvanecimiento=Feather Radius|Desde=From|Borde=Edge|Copias=Copies|Escala horizontal (%)=Horizontal scale (%)|Escala vertical (%)=Vertical scale (%)|Mover horizontal (px)=Move horizontal (px)|Mover vertical (px)=Move vertical (px)|Extremos=Caps|Planos=Butt|Redondos=Round|Proyectados=Projecting|Espaciado (px)=Spacing (px)|Anchura del trazo (px)=Stroke width (px)|Variación (%)=Variation (%)|Superposición (px)=Overlap (px)|Tamaño del grano=Grain size|Rociador de símbolos=Symbol Sprayer|Desplazador de símbolos=Symbol Shifter|Dimensionador de símbolos=Symbol Sizer|Conjunto de símbolos=Symbol Set|Diámetro=Diameter|Densidad=Density
Acciones=Actions|Grabar una acción nueva / detener=Record new action / stop|Reproducir la acción seleccionada=Play selected action|Eliminar acción=Delete Action|Opciones de acción=Action Options|Incluir este paso=Include this step|Quitar paso=Delete step|Copia desplazada 10 px=Offset copy 10 px
Separación=Spacing|Mayúsculas=Caps|Pinceles=Brushes|Aplicar=Apply|Pantalla=Screen|Impresión=Print|Web=Web|Vídeo=Film & Video|Móvil=Mobile|Arte y dibujo=Art & Illustration
`;

const Lang = {
  cur: (() => { try { const s = localStorage.getItem('vectora-lang'); if (s) return s; } catch (e) { /* sin almacenamiento */ } return (navigator.language || 'es').toLowerCase().startsWith('es') ? 'es' : 'en'; })(),
  dict: null,
  build() {
    if (this.dict) return this.dict;
    this.dict = new Map();
    for (const line of I18N_EN.split('\n')) for (const pair of line.split('|')) { const i = pair.indexOf('='); if (i > 0) this.dict.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim()); }
    return this.dict;
  },
  /* traduce una etiqueta: admite «✓ », «…» final, submenús «A ▸ B» y sufijos entre paréntesis */
  t(s) {
    if (this.cur === 'es' || !s) return s;
    const D = this.build(), raw = s, lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0]; s = s.trim();
    if (D.has(s)) return lead + D.get(s) + trail;
    let pre = ''; if (s.startsWith('✓ ')) { pre = '✓ '; s = s.slice(2); }
    let dots = ''; if (s.endsWith('…')) { dots = '…'; s = s.slice(0, -1); }
    if (D.has(s)) return lead + pre + D.get(s) + dots + trail;
    if (s.includes(' ▸ ')) return lead + pre + s.split(' ▸ ').map(x => this.t(x)).join(' ▸ ') + dots + trail;
    const m = s.match(/^(.+?) \(([^()]+)\)$/);
    if (m && D.has(m[1])) return lead + pre + D.get(m[1]) + ` (${D.has(m[2]) ? D.get(m[2]) : m[2].replace(/Mayús\+/g, 'Shift+').replace(/Supr/g, 'Del')})` + dots + trail;
    /* nombres por defecto de documentos y el modo de vista del título */
    const r = raw.replace(/Sin título/g, 'Untitled').replace(/Vista previa/g, 'Preview');
    return r;
  },
  skip(n) {
    for (let e = n.nodeType === 1 ? n : n.parentElement; e; e = e.parentElement) {
      if (e === App.els.content || e.id === 'textEditor' || e.tagName === 'SCRIPT' || e.tagName === 'STYLE' || e.tagName === 'TEXTAREA' || e.hasAttribute('data-noi18n')) return true;
    }
    return false;
  },
  node(n) {
    if (n.nodeType === 3) { if (!n.nodeValue.trim() || this.skip(n)) return; const t = this.t(n.nodeValue); if (t !== n.nodeValue) n.nodeValue = t; return; }
    if (n.nodeType !== 1 || this.skip(n)) return;
    for (const a of ['title', 'placeholder', 'aria-label']) { const v = n.getAttribute(a); if (v) { const t = this.t(v); if (t !== v) n.setAttribute(a, t); } }
    if (n.tagName === 'INPUT' && (n.type === 'button' || n.type === 'submit') && n.value) n.value = this.t(n.value);
    for (const c of n.childNodes) this.node(c);
  },
  init() {
    document.documentElement.lang = this.cur;
    if (this.cur === 'es') return;
    this.node(document.body);
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'characterData') this.node(m.target);
        else if (m.type === 'attributes') this.node(m.target);
        else m.addedNodes.forEach(n => this.node(n));
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder'] });
    /* el título de la ventana y los avisos del sistema */
    const baseConfirm = window.confirm; window.confirm = m => baseConfirm(this.t(m));
  },
  set(lang) {
    try { localStorage.setItem('vectora-lang', lang); } catch (e) { /* sin almacenamiento */ }
    location.reload();
  },
};
