/* Vectora — espacios de trabajo: grupos de paneles flotantes (arrastrando el asa ⠿ fuera del
   dock) y distribuciones guardadas (Esenciales, Tipografía, Pintura y las del usuario) */
'use strict';

const WS_PRESETS = {
  'Esenciales': { gColor: { tab: 'pColor' }, gMain: { tab: 'pProps' }, gStroke: { collapsed: true }, gText: { collapsed: true }, gXf: { collapsed: true }, gNav: { collapsed: true } },
  'Tipografía': { gColor: { tab: 'pSwatches', collapsed: true }, gMain: { tab: 'pProps' }, gStroke: { collapsed: true }, gText: { tab: 'pChar', collapsed: false }, gXf: { tab: 'pAlign', collapsed: false }, gNav: { collapsed: true } },
  'Pintura': { gColor: { tab: 'pColor' }, gMain: { tab: 'pLayers' }, gStroke: { tab: 'pBrushes', collapsed: false }, gText: { collapsed: true }, gXf: { collapsed: true }, gNav: { tab: 'pNavigator', collapsed: false } },
  'Diseño': { gColor: { tab: 'pSwatches' }, gMain: { tab: 'pProps' }, gStroke: { tab: 'pAppearance', collapsed: false }, gText: { collapsed: true }, gXf: { tab: 'pAlign', collapsed: false }, gNav: { tab: 'pInfo', collapsed: false } },
};
const Workspace = {
  cur: (() => { try { return localStorage.getItem('vectora-ws') || 'Esenciales'; } catch (e) { return 'Esenciales'; } })(),
  saved() { try { return JSON.parse(localStorage.getItem('vectora-workspaces') || '{}'); } catch (e) { return {}; } },
  store(o) { try { localStorage.setItem('vectora-workspaces', JSON.stringify(o)); } catch (e) { /* sin almacenamiento */ } },
  /* flota o acopla un grupo según su estado */
  place(gid) {
    const st = Dock.state[gid], box = $(gid); if (!box) return;
    if (st.float) {
      if (box.parentNode !== document.body) document.body.appendChild(box);
      box.classList.add('pg-float');
      const x = clamp(st.float.x, 0, innerWidth - 120), y = clamp(st.float.y, 30, innerHeight - 40);
      Object.assign(box.style, { left: x + 'px', top: y + 'px', width: (st.float.w || 270) + 'px' });
    } else {
      box.classList.remove('pg-float'); box.style.left = box.style.top = box.style.width = '';
      if (box.parentNode !== $('dock')) {
        /* volver a su sitio en el orden del dock */
        const order = DOCK_GROUPS.map(g => g.id), next = order.slice(order.indexOf(gid) + 1).map(id => $(id)).find(e => e && e.parentNode === $('dock'));
        next ? $('dock').insertBefore(box, next) : $('dock').appendChild(box);
      }
    }
  },
  apply(layout) {
    for (const g of DOCK_GROUPS) {
      const L = layout[g.id] || {}, st = Dock.state[g.id];
      st.tab = g.panels.includes(L.tab) ? L.tab : st.tab; st.collapsed = !!L.collapsed; st.float = L.float ? { ...L.float } : null;
      this.place(g.id); Dock.apply(g.id);
    }
    Selection.draw();
  },
  use(name) {
    const custom = this.saved()[name], preset = WS_PRESETS[name];
    if (!custom && !preset) return;
    this.cur = name; try { localStorage.setItem('vectora-ws', name); } catch (e) { /* sin almacenamiento */ }
    this.apply(custom || preset); this.menu();
  },
  snapshot() { const o = {}; for (const g of DOCK_GROUPS) { const st = Dock.state[g.id]; o[g.id] = { tab: st.tab, collapsed: st.collapsed, float: st.float || null }; } return o; },
  async create() {
    const v = await Dialog.form('Nuevo espacio de trabajo', [{ id: 'n', label: 'Nombre', value: `Espacio de trabajo ${Object.keys(this.saved()).length + 1}` }]);
    if (!v || !v.n.trim()) return; const o = this.saved(); o[v.n.trim()] = this.snapshot(); this.store(o); this.cur = v.n.trim();
    try { localStorage.setItem('vectora-ws', this.cur); } catch (e) { /* sin almacenamiento */ } this.menu();
  },
  reset() { const o = this.saved(); if (o[this.cur]) { this.apply(o[this.cur]); return; } this.apply(WS_PRESETS[this.cur] || WS_PRESETS['Esenciales']); },
  async manage() {
    const names = Object.keys(this.saved()); if (!names.length) return Dialog.alert('Aún no has guardado espacios de trabajo propios.');
    const v = await Dialog.form('Administrar espacios de trabajo', [{ id: 'n', label: 'Espacio', type: 'select', value: names[0], options: names.map(n => [n, n]) }], { ok: 'Eliminar' });
    if (!v) return; const o = this.saved(); delete o[v.n]; this.store(o); if (this.cur === v.n) this.cur = 'Esenciales'; this.menu();
  },
  /* submenú Ventana ▸ Espacio de trabajo (se regenera con los guardados) */
  menu() {
    const W = MENUS['Ventana'], keep = W.filter(it => it === '-' || !String(it[0]).startsWith('Espacio de trabajo ▸'));
    const names = [...Object.keys(WS_PRESETS), ...Object.keys(this.saved())];
    const items = [...names.map(n => [`Espacio de trabajo ▸ ${n}`, '', () => this.use(n), () => this.cur === n]),
      ['Espacio de trabajo ▸ Restablecer', '', () => this.reset()], ['Espacio de trabajo ▸ Nuevo espacio de trabajo…', '', () => this.create()], ['Espacio de trabajo ▸ Administrar espacios de trabajo…', '', () => this.manage()]];
    W.length = 0; W.push(...items, '-', ...keep.filter((it, i) => !(i === 0 && it === '-')));
  },
  init() {
    for (const g of DOCK_GROUPS) {
      const box = $(g.id), tabs = box.querySelector('.pg-tabs'), grip = document.createElement('span');
      grip.className = 'pg-grip'; grip.textContent = '⠿'; grip.title = 'Arrastra para sacar el panel del dock (o devolverlo)'; tabs.prepend(grip);
      grip.onpointerdown = e => {
        e.preventDefault(); grip.setPointerCapture(e.pointerId);
        const st = Dock.state[g.id], r = box.getBoundingClientRect(), off = { x: e.clientX - r.left, y: e.clientY - r.top }, dock = $('dock').getBoundingClientRect();
        let moved = false;
        grip.onpointermove = ev => {
          if (!moved && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 6) return; moved = true;
          st.float = { x: ev.clientX - off.x, y: ev.clientY - off.y, w: st.float ? st.float.w : Math.min(300, r.width) }; this.place(g.id);
          box.classList.toggle('pg-drop', ev.clientX > dock.left);
        };
        grip.onpointerup = ev => {
          grip.onpointermove = grip.onpointerup = null; box.classList.remove('pg-drop');
          if (moved && ev.clientX > dock.left) st.float = null; /* soltar sobre el dock: acoplar */
          this.place(g.id); Dock.save(); Selection.draw();
        };
      };
      this.place(g.id);
    }
    this.menu();
    window.addEventListener('resize', () => DOCK_GROUPS.forEach(g => Dock.state[g.id].float && this.place(g.id)));
  },
};
