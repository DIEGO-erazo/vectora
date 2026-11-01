/* Vectora — panel Acciones: grabar una serie de comandos de menú (con los valores de sus
   diálogos) y reproducirla sobre otra selección */
'use strict';

const ActionsPanel = {
  rec: null, playing: false, queue: [], cur: null, open: new Set(),
  load() { try { return JSON.parse(localStorage.getItem('vectora-actions') || 'null') || this.defaults(); } catch (e) { return this.defaults(); } },
  save(L) { try { localStorage.setItem('vectora-actions', JSON.stringify(L)); } catch (e) { /* sin almacenamiento */ } },
  defaults() {
    return [
      { name: 'Copia desplazada 10 px', steps: [{ menu: 'Objeto', label: 'Transformar ▸ Mover…', dialogs: [{ title: 'Mover', v: { x: '10', y: '10', _button: 'copy' } }] }] },
      { name: 'Contornear trazo', steps: [{ menu: 'Objeto', label: 'Trazado ▸ Contornear trazo', dialogs: [] }] },
    ];
  },
  list() { return this.actions || (this.actions = this.load()); },
  /* envuelve cada comando de menú para poder grabarlo */
  wrapMenus() {
    for (const [m, items] of Object.entries(MENUS)) for (const it of items) {
      if (it === '-' || it.wrapped) continue;
      const fn = it[2], label = it[0];
      it[2] = (...a) => {
        if (this.rec && !this.playing && !/^(Acciones|Grabar)/.test(label)) { this.cur = { menu: m, label, dialogs: [] }; this.rec.steps.push(this.cur); this.render(); }
        return fn(...a);
      };
      it.wrapped = true;
    }
    /* los diálogos: al grabar se guardan sus valores; al reproducir se responden solos */
    const base = Dialog.form.bind(Dialog);
    Dialog.form = (title, fields, opts = {}) => {
      if (this.playing && this.queue.length) { const d = this.queue.shift(); return Promise.resolve(d.v); }
      const p = base(title, fields, opts);
      if (this.rec && this.cur) { const step = this.cur; p.then(v => { if (v) { step.dialogs.push({ title, v }); this.save(this.list()); this.render(); } }); }
      return p;
    };
  },
  record() {
    if (this.rec) return this.stop();
    const name = `Acción ${this.list().length + 1}`;
    this.rec = { name, steps: [] }; this.list().push(this.rec); this.open.add(this.list().length - 1);
    $('sbHint').textContent = 'Grabando acción: usa los menús; pulsa ■ para terminar'; this.render();
  },
  stop() { if (!this.rec) return; if (!this.rec.steps.length) this.list().splice(this.list().indexOf(this.rec), 1); this.rec = null; this.cur = null; this.save(this.list()); $('sbHint').textContent = ''; this.render(); },
  async play(i = this.sel) {
    const a = this.list()[i]; if (!a || this.rec) return;
    this.playing = true;
    try {
      for (const s of a.steps) {
        if (s.off) continue;
        const it = (MENUS[s.menu] || []).find(x => x !== '-' && x[0] === s.label);
        if (!it) { Dialog.alert(`No se encontró el comando «${s.label}».`); break; }
        this.queue = (s.dialogs || []).map(d => ({ ...d, v: { ...d.v } }));
        await History.named(s.label.split(' ▸ ').pop().replace('…', ''), it[2]);
        await new Promise(r => setTimeout(r, 0));
      }
    } finally { this.playing = false; this.queue = []; }
    Selection.changed();
  },
  async rename(i) { const a = this.list()[i]; const v = await Dialog.form('Opciones de acción', [{ id: 'n', label: 'Nombre', value: a.name }]); if (v && v.n.trim()) { a.name = v.n.trim(); this.save(this.list()); this.render(); } },
  remove(i = this.sel) { if (i == null || !this.list()[i]) return; this.list().splice(i, 1); this.sel = null; this.save(this.list()); this.render(); },
  render() {
    const box = $('actList'); if (!box) return; box.innerHTML = '';
    this.list().forEach((a, i) => {
      const d = document.createElement('div'); d.className = 'act' + (i === this.sel ? ' on' : '') + (a === this.rec ? ' rec' : '');
      const open = this.open.has(i);
      d.innerHTML = `<div class="act-head"><span class="act-tw">${open ? '▾' : '▸'}</span><span class="act-name"></span><small>${a.steps.length} paso(s)</small></div>`;
      d.querySelector('.act-name').textContent = a.name;
      d.querySelector('.act-tw').onclick = e => { e.stopPropagation(); open ? this.open.delete(i) : this.open.add(i); this.render(); };
      d.querySelector('.act-head').onclick = () => { this.sel = i; this.render(); };
      d.querySelector('.act-head').ondblclick = () => this.rename(i);
      if (open) for (const [k, s] of a.steps.entries()) {
        const r = document.createElement('div'); r.className = 'act-step' + (s.off ? ' off' : '');
        r.innerHTML = `<input type="checkbox" ${s.off ? '' : 'checked'} title="Incluir este paso"><span></span><button title="Quitar paso">✕</button>`;
        r.querySelector('span').textContent = `${s.menu} ▸ ${s.label}${s.dialogs && s.dialogs.length ? ' (con valores)' : ''}`;
        r.querySelector('input').onchange = e => { s.off = !e.target.checked; this.save(this.list()); this.render(); };
        r.querySelector('button').onclick = () => { a.steps.splice(k, 1); this.save(this.list()); this.render(); };
        d.appendChild(r);
      }
      box.appendChild(d);
    });
    $('actRec').classList.toggle('on', !!this.rec); $('actRec').textContent = this.rec ? '■' : '●';
  },
  init() {
    this.wrapMenus();
    $('actRec').onclick = () => this.record();
    $('actPlay').onclick = () => this.play();
    $('actDel').onclick = () => this.remove();
    App.on('dock', id => { if (id === 'pActions') this.render(); });
    this.render();
  },
};
/* los menús se envuelven antes de construirse (los atajos también usan estas funciones) */
ActionsPanel.wrapMenus();
ActionsPanel.init = (init => function () { this.wrapMenus = () => {}; return init.call(this); })(ActionsPanel.init);
