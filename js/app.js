/* Vectora — integración como aplicación: programa de escritorio (Electron)
   o aplicación web instalable (PWA) con funcionamiento sin conexión */
'use strict';

const APP_INFO = {
  version: '1.0.0',
  /* cambia esta dirección por la de tu repositorio de GitHub */
  repo: 'https://github.com/DIEGO-erazo/vectora',
};

const Shell = {
  installPrompt: null,
  init() {
    const d = window.vectoraDesktop;
    if (d) {
      document.documentElement.classList.add('desktop');
      d.onOpenFile(async p => Import.openFile(await Files.fromPath(p)));
      d.onSaveAndClose(async () => { if (await Docs.saveAll()) d.closeNow(); });
      d.launchFile().then(async p => { if (p) Import.openFile(await Files.fromPath(p)); });
      return;
    }
    /* web: service worker (sin conexión y actualizaciones) */
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').then(reg => {
        const offer = w => this.toast('Hay una nueva versión de Vectora.', 'Actualizar', () => w.postMessage('skipWaiting'));
        if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
        });
      }).catch(() => { /* sin service worker: la app sigue funcionando en línea */ });
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
    }
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.installPrompt = e; });
    window.addEventListener('appinstalled', () => { this.installPrompt = null; this.toast('Vectora se instaló como aplicación.'); });
    /* abrir archivos .svg desde el sistema cuando está instalada (File Handling API) */
    if ('launchQueue' in window) window.launchQueue.setConsumer(async params => {
      const h = params.files && params.files[0]; if (h) Import.openFile({ file: await h.getFile(), handle: h });
    });
  },
  async install() {
    if (this.installPrompt) { this.installPrompt.prompt(); await this.installPrompt.userChoice; this.installPrompt = null; return; }
    Dialog.alert('Para instalar Vectora como aplicación:\n\n• Chrome / Edge: icono de instalar en la barra de direcciones, o menú ⋮ ▸ «Instalar Vectora».\n'
      + '• Safari (Mac): Archivo ▸ «Añadir al Dock».\n\nTambién puedes descargar el programa de escritorio para Windows, Mac y Linux desde GitHub.', 'Instalar Vectora');
  },
  toast(msg, action, fn) {
    const t = document.createElement('div'); t.className = 'toast';
    t.innerHTML = `<span></span>${action ? '<button></button>' : ''}<button class="x" title="Cerrar">✕</button>`;
    t.firstChild.textContent = msg; if (action) t.children[1].textContent = action;
    if (action) t.children[1].onclick = () => { t.remove(); fn(); };
    t.querySelector('.x').onclick = () => t.remove();
    document.body.appendChild(t); if (!action) setTimeout(() => t.remove(), 5000);
  },
  openRepo(path = '') { window.open(APP_INFO.repo + path, '_blank', 'noopener'); },
};
