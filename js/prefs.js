/* Vectora — Preferencias (Edición ▸ Preferencias, Ctrl+K): se guardan en este equipo */
'use strict';

const Prefs = {
  defaults: { theme: 'dark', nudge: 1, nudgeBig: 10, undo: 120, autosave: true, taskbar: true, snapTol: 5, snapAnchors: true, home: true },
  v: {},
  load() {
    try { this.v = { ...this.defaults, ...JSON.parse(localStorage.getItem('vectora-prefs') || '{}') }; } catch (e) { this.v = { ...this.defaults }; }
    this.apply();
  },
  save() { try { localStorage.setItem('vectora-prefs', JSON.stringify(this.v)); } catch (e) { /* sin almacenamiento */ } },
  get(k) { return this.v[k] ?? this.defaults[k]; },
  apply() {
    document.documentElement.dataset.theme = this.get('theme');
    History.max = clamp(Math.round(this.get('undo')), 10, 1000);
    if (typeof TaskBar !== 'undefined' && TaskBar.on !== this.get('taskbar')) TaskBar.toggle(this.get('taskbar'));
    if (typeof Rulers !== 'undefined') Rulers.draw();
  },
  async dialog() {
    const v = await Dialog.form('Preferencias', [
      { id: 'h1', type: 'heading', label: 'Interfaz' },
      { id: 'lang', label: 'Idioma / Language', type: 'select', value: Lang.cur, options: [['es', 'Español'], ['en', 'English']] },
      { id: 'theme', label: 'Brillo', type: 'select', value: this.get('theme'), options: [['dark', 'Oscuro'], ['mediumdark', 'Medio oscuro'], ['mediumlight', 'Medio claro'], ['light', 'Claro']] },
      { id: 'taskbar', label: 'Barra de tareas contextual', type: 'checkbox', value: this.get('taskbar') },
      { id: 'home', label: 'Pantalla de inicio al abrir', type: 'checkbox', value: this.get('home') },
      { id: 'h2', type: 'heading', label: 'General' },
      { id: 'nudge', label: 'Incremento del teclado (px)', type: 'number', value: this.get('nudge'), min: 0.01, step: 0.5 },
      { id: 'nudgeBig', label: 'Con Mayús (px)', type: 'number', value: this.get('nudgeBig'), min: 0.1, step: 1 },
      { id: 'undo', label: 'Niveles de deshacer', type: 'number', value: this.get('undo'), min: 10, max: 1000 },
      { id: 'autosave', label: 'Autoguardado de la sesión', type: 'checkbox', value: this.get('autosave') },
      { id: 'h3', type: 'heading', label: 'Guías inteligentes' },
      { id: 'snapTol', label: 'Tolerancia de ajuste (px)', type: 'number', value: this.get('snapTol'), min: 1, max: 20 },
      { id: 'snapAnchors', label: 'Ajustar a puntos de ancla', type: 'checkbox', value: this.get('snapAnchors') },
    ], { preview: v => { document.documentElement.dataset.theme = v.theme; Rulers.draw(); }, revert: () => { document.documentElement.dataset.theme = this.get('theme'); Rulers.draw(); } });
    if (!v) return;
    for (const k of ['nudge', 'nudgeBig', 'undo', 'snapTol']) v[k] = +v[k] || this.defaults[k];
    const lang = v.lang; delete v.lang;
    delete v._button; Object.assign(this.v, v); this.save(); this.apply();
    if (lang !== Lang.cur && await Dialog.confirm(lang === 'en' ? 'Restart the interface in English now? (your work is kept by autosave)' : '¿Reiniciar la interfaz en español ahora? (el trabajo se conserva con el autoguardado)')) { IO.autosave(); Lang.set(lang); }
  },
};
