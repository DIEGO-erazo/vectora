/* Comprobación rápida: sintaxis de todo el JavaScript y que index.html no apunte a archivos inexistentes.
   Uso: npm run check */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
let errors = 0;

const jsFiles = ['js', 'electron'].flatMap(d => fs.readdirSync(path.join(root, d)).filter(f => f.endsWith('.js')).map(f => path.join(d, f)));
for (const f of [...jsFiles, 'sw.js', 'scripts/check.js']) {
  try { execFileSync(process.execPath, ['--check', path.join(root, f)], { stdio: 'pipe' }); }
  catch (e) { errors++; console.error(`✘ ${f}\n${e.stderr}`); }
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const [, ref] of html.matchAll(/(?:src|href)="([^"#:?]+)"/g)) {
  if (!fs.existsSync(path.join(root, ref))) { errors++; console.error(`✘ index.html apunta a un archivo que no existe: ${ref}`); }
}
const listed = new Set([...html.matchAll(/<script src="(js\/[^"]+)"/g)].map(m => m[1]));
for (const f of fs.readdirSync(path.join(root, 'js'))) {
  if (f.endsWith('.js') && !listed.has('js/' + f)) { errors++; console.error(`✘ js/${f} no está incluido en index.html`); }
}
JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));

console.log(errors ? `\n${errors} problema(s) encontrado(s).` : `✔ ${jsFiles.length + 2} archivos JavaScript correctos; referencias de index.html correctas.`);
process.exit(errors ? 1 : 0);
