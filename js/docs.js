/* Vectora — varios documentos en pestañas, pantalla de inicio y archivos recientes */
'use strict';

const Docs = {
  list: [], active: -1, seq: 0,
  cur() { return this.list[this.active]; },
  anyDirty() { return !!App.dirty || this.list.some((d, i) => i !== this.active && d.dirty); },
  /* guarda el estado del documento activo en su entrada */
  capture() {
    const d = this.cur(); if (!d) return;
    Object.assign(d, {
      html: ImageStore.pack(App.els.content.innerHTML), doc: JSON.parse(JSON.stringify(App.doc)), view: { ...App.view },
      stack: History.stack, index: History.index, sel: App.selection.map(e => e.id).filter(Boolean),
      layer: App.activeLayer && App.activeLayer.id, current: IO.current, dirty: !!App.dirty,
    });
  },
  /* carga una entrada como documento activo */
  apply(d) {
    if (TextTool.editing) TextTool.commit();
    if (Isolation.active()) Isolation.exit(true);
    App.els.content.innerHTML = ImageStore.unpack(d.html || '');
    for (const k of Object.keys(App.doc)) delete App.doc[k];
    Object.assign(App.doc, JSON.parse(JSON.stringify(d.doc || { width: 800, height: 600, title: 'Sin título' })));
    History.stack = d.stack || []; History.index = d.index ?? -1;
    IO.current = d.current || null;
    App.activeLayer = d.layer ? document.getElementById(d.layer) : null; Layers.ensure();
    View.updateArtboard();
    if (d.view) Object.assign(App.view, d.view); else View.fit();
    if (!History.stack.length) History.reset();
    App.dirty = !!d.dirty;
    App.selection = (d.sel || []).map(id => document.getElementById(id)).filter(Boolean);
    Home.hide(); View.apply(); Selection.changed(); App.emit('layers'); Panels.refresh(); Rulers.draw(); Swatches.render();
    this.render();
  },
  /* nueva pestaña vacía (quien llama rellena el documento) */
  create() {
    this.capture();
    const d = { id: ++this.seq }; this.list.push(d); this.active = this.list.length - 1;
    Home.hide(); return d;
  },
  switchTo(i) {
    if (i === this.active || !this.list[i]) return;
    this.capture(); this.active = i; this.apply(this.list[i]);
  },
  next(dir = 1) { if (this.list.length > 1) this.switchTo((this.active + dir + this.list.length) % this.list.length); },
  /* cierra la pestaña (preguntando si hay cambios); devuelve false si se cancela */
  async close(i = this.active) {
    if (i < 0 || !this.list[i]) return true;
    if (i !== this.active) this.switchTo(i);
    if (App.dirty) {
      const r = await Dialog.form('Vectora', [], { note: `¿Guardar los cambios de «${App.doc.title}» antes de cerrarlo?`, buttons: [['No guardar', 'discard']], ok: 'Guardar' });
      if (!r) return false;
      if (r._button !== 'discard' && !(await IO.save())) return false;
    }
    this.list.splice(this.active, 1);
    if (!this.list.length) { this.active = -1; this.empty(); return true; }
    this.active = Math.min(this.active, this.list.length - 1); this.apply(this.list[this.active]);
    IO.autosave(); return true;
  },
  async closeAll() { while (this.list.length) if (!(await this.close(this.list.length - 1))) return false; return true; },
  /* guarda todos los documentos con cambios (al cerrar el programa) */
  async saveAll() {
    this.capture();
    for (let i = 0; i < this.list.length; i++) if (this.list[i].dirty) { this.switchTo(i); if (!(await IO.save())) return false; this.capture(); }
    return true;
  },
  empty() {
    App.els.content.innerHTML = ''; App.selection = []; App.dirty = false; IO.current = null;
    Layers.create('Capa 1'); History.reset(); this.render(); Home.show(); IO.autosave();
  },
  render() {
    const bar = $('docTabs'); bar.innerHTML = '';
    this.list.forEach((d, i) => {
      const on = i === this.active, title = on ? App.doc.title : (d.doc && d.doc.title) || 'Sin título', dirty = on ? App.dirty : d.dirty;
      const t = document.createElement('div'); t.className = 'doc-tab' + (on ? ' on' : '');
      t.title = title; t.innerHTML = `<span class="dt-name"></span><span class="dt-x" title="Cerrar (Ctrl+W)">${dirty ? '●' : '✕'}</span>`;
      t.firstChild.textContent = title + (on ? ` @ ${Math.round(App.view.zoom * 100)}%` : '');
      t.onmousedown = e => { if (e.button === 1) { e.preventDefault(); this.close(i); } else if (e.button === 0 && !e.target.classList.contains('dt-x')) this.switchTo(i); };
      t.querySelector('.dt-x').onclick = e => { e.stopPropagation(); this.close(i); };
      bar.appendChild(t);
    });
    const add = document.createElement('div'); add.className = 'doc-tab add'; add.title = 'Nuevo documento (Ctrl+N)'; add.textContent = '+';
    add.onclick = () => IO.newDoc(); bar.appendChild(add);
  },
  /* sesión (todas las pestañas) para el autoguardado */
  session() {
    this.capture();
    return { active: this.active, docs: this.list.map(d => ({ html: d.html || '', doc: d.doc, view: d.view, dirty: d.dirty })) };
  },
  restore(s) {
    this.list = (s.docs || []).map(d => ({ ...d, id: ++this.seq, dirty: !!d.dirty }));
    this.active = clamp(s.active ?? 0, 0, this.list.length - 1);
    if (this.list.length) this.apply(this.list[this.active]); else this.empty();
  },
};

/* ---------- archivos recientes (con miniatura) ---------- */
const Recent = {
  max: 12,
  async list() { try { return (await KV.get('recent')) || []; } catch (e) { return []; } },
  async add(target) {
    if (!target || (!target.path && !target.handle)) return;
    let thumb = '';
    try {
      const w = App.doc.width, h = App.doc.height, k = Math.min(240 / w, 170 / h);
      const blob = await IO.rasterize(IO.serialize(true), w, h, k, '#ffffff', 'image/png');
      thumb = await readDataURL(blob);
    } catch (e) { /* sin miniatura */ }
    const key = target.path || target.name, list = (await this.list()).filter(r => r.key !== key);
    list.unshift({ key, name: target.name, path: target.path || null, handle: target.handle || null, thumb, date: Date.now(), size: `${Units.fmt(App.doc.width)} × ${Units.fmt(App.doc.height)} ${Units.u}` });
    try { await KV.set('recent', list.slice(0, this.max)); } catch (e) { /* sin almacenamiento */ }
    if (Home.visible) Home.renderRecent();
  },
  async open(r) {
    try {
      if (r.path && Files.desktop) return Import.openFile(await Files.fromPath(r.path));
      if (r.handle) {
        const opts = { mode: 'readwrite' };
        if ((await r.handle.queryPermission(opts)) !== 'granted' && (await r.handle.requestPermission(opts)) !== 'granted') return;
        return Import.openFile({ file: await r.handle.getFile(), handle: r.handle });
      }
    } catch (e) {
      await KV.set('recent', (await this.list()).filter(x => x.key !== r.key));
      Home.renderRecent();
      Dialog.alert(`No se pudo abrir «${r.name}». Puede que se haya movido o borrado.`);
    }
  },
  async clear() { await KV.set('recent', []); Home.renderRecent(); },
};

/* ---------- pantalla de inicio ---------- */
const QUICK = [['A4', 210, 297, 'mm', 3], ['Carta', 8.5, 11, 'in', 0.125], ['Web 1920×1080', 1920, 1080, 'px'], ['Instagram', 1080, 1080, 'px'],
  ['Historia / Reel', 1080, 1920, 'px'], ['Miniatura YouTube', 1280, 720, 'px'], ['Icono', 512, 512, 'px'], ['Tarjeta de visita', 85, 55, 'mm', 3]];
const Home = {
  visible: false,
  show() {
    this.visible = true; let h = $('home');
    if (!h) {
      h = document.createElement('div'); h.id = 'home';
      h.innerHTML = `<div class="home-side">
          <div class="home-brand"><img src="icons/icon.svg" alt=""><b>Vectora</b></div>
          <button class="home-btn primary" data-act="new">Nuevo archivo</button>
          <button class="home-btn" data-act="open">Abrir…</button>
          <button class="home-btn" data-act="demo">Ilustración de ejemplo</button>
          <button class="home-btn" data-act="back">← Volver al documento</button>
          <div class="home-foot"><a href="#" data-act="repo">Código fuente en GitHub</a><span>Versión ${APP_INFO.version}</span></div>
        </div>
        <div class="home-main">
          <h1>Te damos la bienvenida a Vectora</h1>
          <h2>Comenzar rápidamente</h2>
          <div class="home-quick"></div>
          <div class="home-rec-head"><h2>Recientes</h2><a href="#" data-act="clear">Borrar lista</a></div>
          <div class="home-recent"></div>
        </div>`;
      $('main').appendChild(h);
      h.querySelector('[data-act=new]').onclick = () => IO.newDoc();
      h.querySelector('[data-act=open]').onclick = () => Import.open();
      h.querySelector('[data-act=demo]').onclick = () => { IO.newDoc(800, 600, false); App.doc.title = 'Ejemplo'; demoArtwork(); History.reset(); View.fit(); App.emit('layers'); Docs.render(); };
      h.querySelector('[data-act=back]').onclick = () => Home.hide();
      h.querySelector('[data-act=repo]').onclick = e => { e.preventDefault(); Shell.openRepo(); };
      h.querySelector('[data-act=clear]').onclick = e => { e.preventDefault(); Recent.clear(); };
      const q = h.querySelector('.home-quick');
      for (const [name, w, hh, u, b] of QUICK) {
        const c = document.createElement('button'); c.className = 'home-card';
        const k = 46 / Math.max(w, hh);
        c.innerHTML = `<div class="nd-thumb"><div style="width:${Math.max(6, w * k)}px;height:${Math.max(6, hh * k)}px"></div></div><b>${name}</b><span>${w} × ${hh} ${u}</span>`;
        c.onclick = () => { IO.newDoc(Units.fromU(w, u), Units.fromU(hh, u), false); Object.assign(App.doc, { title: 'Sin título-' + IO.count, units: u, bleed: Units.fromU(b || 0, u) }); View.updateArtboard(); History.reset(); View.apply(); Docs.render(); Panels.refreshControlBar(); Rulers.draw(); };
        q.appendChild(c);
      }
    }
    h.querySelector('[data-act=back]').hidden = !Docs.list.length;
    h.hidden = false; document.documentElement.classList.add('at-home'); this.renderRecent();
  },
  hide() { this.visible = false; const h = $('home'); if (h) h.hidden = true; document.documentElement.classList.remove('at-home'); },
  async renderRecent() {
    const box = document.querySelector('#home .home-recent'); if (!box) return;
    const list = await Recent.list(); box.innerHTML = list.length ? '' : '<p class="home-empty">Los documentos que abras o guardes aparecerán aquí.</p>';
    for (const r of list) {
      const c = document.createElement('button'); c.className = 'home-rec';
      c.innerHTML = `<div class="home-thumb">${r.thumb ? `<img alt="" src="${r.thumb}">` : ''}</div><b></b><span></span>`;
      c.querySelector('b').textContent = r.name; c.querySelector('span').textContent = `${new Date(r.date).toLocaleDateString()} · ${r.size || ''}`;
      c.title = r.path || r.name; c.onclick = () => Recent.open(r);
      box.appendChild(c);
    }
  },
};
