# Cómo contribuir a Vectora

¡Gracias por querer ayudar! Algunas pautas para que sea fácil:

## Antes de empezar

- Para errores o ideas, abre primero un *issue* y explica qué quieres cambiar.
- Si es un cambio grande, coméntalo antes en el *issue* para acordar el enfoque.

## Preparar el entorno

```bash
git clone https://github.com/<tu-usuario>/vectora.git
cd vectora
npm install
npm start        # programa de escritorio
npm run web      # versión web en http://localhost:8080
```

## Estilo del código

- JavaScript sin compilación ni frameworks: cada archivo de `js/` es un script normal incluido en `index.html`.
- Sigue el estilo del archivo que estés tocando: nombres en inglés y comentarios e interfaz en español.
- Toda la geometría del documento se guarda en px (1 px = 1 pt). Usa `Units` solo para mostrar o leer valores.
- Cualquier cambio en el documento debe terminar con `History.commit()` para poder deshacerlo.
- Si añades un archivo a `js/`, inclúyelo en `index.html`. `npm run check` lo comprueba.

## Antes de enviar una *pull request*

1. `npm run check` sin errores.
2. `tests.html` al 100 % (ábrelo con `npm run web`).
3. Prueba el cambio en el programa de escritorio (`npm start`).
4. Describe en la *pull request* qué cambia y cómo probarlo.

Al contribuir aceptas que tu aportación se publique bajo la licencia [MIT](LICENSE).
