/* Vectora — programa de escritorio (Electron): ventana, diálogos nativos y archivos */
'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const OPENABLE = /\.(svg|pdf|ai|png|jpe?g|webp|gif|bmp|avif)$/i;
const allowed = new Set();          // rutas que el usuario eligió o abrió: solo esas se pueden leer/escribir
let win = null, dirty = false;

function fileFromArgs(argv) {
  return argv.slice(1).find(a => !a.startsWith('-') && OPENABLE.test(a) && fs.existsSync(a)) || null;
}
let pendingFile = fileFromArgs(process.argv);

if (!app.requestSingleInstanceLock()) app.quit();
else app.on('second-instance', (e, argv) => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
  const f = fileFromArgs(argv); if (f) openInWindow(f);
});

function openInWindow(file) { allowed.add(file); win.webContents.send('open-file', file); }

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600, show: false,
    backgroundColor: '#262626', title: 'Vectora',
    icon: path.join(__dirname, '..', 'icons', 'icon-512.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  /* la interfaz tiene su propia barra de menús; en macOS se deja el menú mínimo del sistema */
  Menu.setApplicationMenu(process.platform === 'darwin' ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }]) : null);
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  win.webContents.setVisualZoomLevelLimits(1, 1);
  win.once('ready-to-show', () => { win.maximize(); win.show(); });

  /* enlaces externos en el navegador; ventanas en blanco (imprimir) permitidas */
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: url === 'about:blank' || url === '' ? 'allow' : 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); });

  /* «¿Guardar los cambios?» al cerrar */
  win.on('close', e => {
    if (!dirty) return;
    e.preventDefault();
    const r = dialog.showMessageBoxSync(win, {
      type: 'question', buttons: ['Guardar', 'No guardar', 'Cancelar'], defaultId: 0, cancelId: 2, noLink: true,
      title: 'Vectora', message: '¿Quieres guardar los cambios del documento?', detail: 'Si no los guardas, se perderán.',
    });
    if (r === 0) win.webContents.send('save-and-close');
    else if (r === 1) { dirty = false; win.close(); }
  });
  win.on('closed', () => { win = null; });
}

/* ---------- puente con la interfaz ---------- */
ipcMain.handle('dlg:save', async (e, o) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: o.defaultPath, filters: o.filters });
  if (r.canceled || !r.filePath) return null;
  allowed.add(r.filePath); return r.filePath;
});
ipcMain.handle('dlg:open', async (e, o) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', ...(o.multiple ? ['multiSelections'] : [])], filters: o.filters });
  if (r.canceled) return [];
  r.filePaths.forEach(p => allowed.add(p)); return r.filePaths;
});
ipcMain.handle('fs:write', async (e, p, data) => {
  if (!allowed.has(p)) throw new Error('Ruta no autorizada');
  await fs.promises.writeFile(p, Buffer.from(data));
});
ipcMain.handle('fs:read', async (e, p) => {
  if (!allowed.has(p)) throw new Error('Ruta no autorizada');
  return new Uint8Array(await fs.promises.readFile(p));
});
ipcMain.handle('launch-file', () => { const f = pendingFile; pendingFile = null; if (f) allowed.add(f); return f; });
ipcMain.on('dirty', (e, v) => { dirty = !!v; });
ipcMain.on('close-now', () => { dirty = false; if (win) win.close(); });

/* macOS: abrir archivos arrastrados al icono del Dock */
app.on('open-file', (e, file) => { e.preventDefault(); if (win) openInWindow(file); else pendingFile = file; });

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
