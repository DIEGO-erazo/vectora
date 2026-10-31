/* Prueba de humo del programa de escritorio.
   Uso: npx electron scripts/smoke-electron.js [archivo.svg] [captura.png]
   Arranca Vectora, abre el archivo indicado, comprueba la integración con el sistema
   y las librerías PDF incluidas, guarda una captura y termina (código 0 = correcto). */
'use strict';
const { app, BrowserWindow } = require('electron');
const fs = require('fs');

const shot = process.argv.find(a => a.endsWith('.png'));
const errors = [];
require('../electron/main.js');

app.on('browser-window-created', (e, win) => {
  win.webContents.on('console-message', ev => { if (ev.level === 'error') errors.push(ev.message); });
  win.webContents.on('did-finish-load', async () => {
    await new Promise(r => setTimeout(r, 2500));
    const wc = win.webContents;
    const result = await wc.executeJavaScript(`(async () => {
      const r = { desktop: typeof window.vectoraDesktop === 'object', title: document.title, objects: Layers.objects().length };
      await Lib.load(Lib.url('jspdf')); await Lib.load(Lib.url('svg2pdf'));
      const { box } = Export.area('doc');
      const pdf = await Export.pdfBlob(IO.buildSVG(true, box), box);
      r.pdfBytes = pdf.size;
      await Import.openFile({ file: new File([pdf], 'ida-y-vuelta.pdf', { type: 'application/pdf' }) });
      r.reimported = Layers.objects().length > 0 && App.doc.title === 'ida-y-vuelta';
      /* calco de imagen y crear contornos con las librerías incluidas */
      await Lib.load(Lib.url('trace')); r.trace = typeof ImageTracer === 'object';
      const t = addObject(svgEl('text', { x: 20, y: 80, 'font-family': 'Arial', 'font-size': 40, fill: '#000' })); svgEl('tspan', { x: 20 }, t).textContent = 'Vectora';
      Selection.set([t]); await TextOutline.run(); r.outlines = App.selection[0] && App.selection[0].tagName === 'path';
      return r;
    })()`, true).catch(err => ({ error: String(err) }));
    if (shot) fs.writeFileSync(shot, (await win.capturePage()).toPNG());
    const ok = result.desktop && result.pdfBytes > 500 && result.reimported && result.trace && result.outlines && !result.error;
    console.log(JSON.stringify({ ok, ...result, consoleErrors: errors }, null, 2));
    win.destroy(); app.exit(ok ? 0 : 1);
  });
});
