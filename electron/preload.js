/* Vectora — puente seguro entre la interfaz y el sistema (solo lo imprescindible) */
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vectoraDesktop', {
  platform: process.platform,
  saveDialog: o => ipcRenderer.invoke('dlg:save', o),
  openDialog: o => ipcRenderer.invoke('dlg:open', o),
  writeFile: (path, data) => ipcRenderer.invoke('fs:write', path, data),
  readFile: path => ipcRenderer.invoke('fs:read', path),
  launchFile: () => ipcRenderer.invoke('launch-file'),
  setDirty: v => ipcRenderer.send('dirty', v),
  closeNow: () => ipcRenderer.send('close-now'),
  onOpenFile: cb => ipcRenderer.on('open-file', (e, path) => cb(path)),
  onSaveAndClose: cb => ipcRenderer.on('save-and-close', () => cb()),
});
