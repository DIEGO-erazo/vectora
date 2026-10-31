/* Vectora — barra de tareas contextual: acciones frecuentes flotando bajo la selección */
'use strict';

const TaskBar = {
  on: (() => { try { return localStorage.getItem('vectora-taskbar') !== '0'; } catch (e) { return true; } })(),
  init() {
    const b = this.el = document.createElement('div'); b.id = 'taskBar'; b.hidden = true;
    $('canvasWrap').appendChild(b);
    b.addEventListener('pointerdown', e => e.stopPropagation());
    for (const ev of ['selection', 'change', 'view', 'transform']) App.on(ev, () => this.schedule());
  },
  toggle(v = !this.on) { this.on = v; try { localStorage.setItem('vectora-taskbar', v ? '1' : '0'); } catch (e) { /* sin almacenamiento */ } this.update(); },
  schedule() { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.update(); }); },
  actions() {
    const s = App.selection, one = s.length === 1 ? s[0] : null, A = (label, fn, icon = '') => ({ label, fn, icon });
    const list = [];
    if (one && one.tagName === 'text') list.push(A('Crear contornos', () => TextOutline.run(), 'Aa'), A('Carácter', () => Dock.show('pChar'), '¶'));
    else if (one && one.tagName === 'image') list.push(A('Calco de imagen', () => Trace.dialog(), '◩'));
    else if (one && one.tagName === 'g') list.push(A('Desagrupar', () => Actions.ungroup(), '⧉'), A('Aislar', () => Isolation.enter(one), '⊡'));
    if (s.length > 1) list.push(A('Agrupar', () => Actions.group(), '▣'), A('Unificar', () => Pathfinder.run('unite'), '◼'), A('Creador de formas', () => Tools.use('builder'), '⊕'));
    if (s.length && !(one && ['text', 'image'].includes(one.tagName))) list.push(A('Editar colores', () => Recolor.saturate(), '🎨'));
    list.push(A('Duplicar', () => Actions.duplicate(), '⧉'), A('Bloquear', () => Actions.lock(), '🔒'));
    return list;
  },
  update() {
    const b = this.el; if (!b) return;
    const show = this.on && App.selection.length && !Home.visible && !Transformer.active && !Dialog.isOpen && !TextTool.editing
      && ['select', 'direct', 'group'].includes(App.toolName);
    if (!show) { b.hidden = true; return; }
    const box = Selection.box(); if (!box) { b.hidden = true; return; }
    const acts = this.actions(), key = acts.map(a => a.label).join('|');
    if (b.dataset.key !== key) {
      b.dataset.key = key; b.innerHTML = '';
      acts.forEach(a => {
        const btn = document.createElement('button'); btn.title = a.label;
        btn.innerHTML = `<span class="tb-i">${a.icon}</span><span>${a.label}</span>`;
        btn.onclick = () => History.named(a.label, a.fn); b.appendChild(btn);
      });
      const more = document.createElement('button'); more.className = 'tb-more'; more.title = 'Más acciones'; more.textContent = '⋯';
      more.onclick = e => { const r = more.getBoundingClientRect(); ContextMenu.show(r.left, r.bottom + 4); e.stopPropagation(); };
      const x = document.createElement('button'); x.className = 'tb-more'; x.title = 'Ocultar la barra (Ventana ▸ Barra de tareas contextual)'; x.textContent = '✕';
      x.onclick = () => this.toggle(false);
      b.append(more, x);
    }
    b.hidden = false;
    /* debajo de la selección, dentro del lienzo; si no cabe, encima */
    const wrap = $('canvasWrap').getBoundingClientRect();
    const s = View.docToStage(box.x + box.width / 2, box.y + box.height), top = View.docToStage(box.x, box.y).y;
    const w = b.offsetWidth, h = b.offsetHeight;
    let y = s.y + 18; if (y + h > wrap.height - 8) y = top - h - 18;
    b.style.left = clamp(s.x - w / 2, 8, wrap.width - w - 8) + 'px'; b.style.top = clamp(y, 34, wrap.height - h - 8) + 'px';
  },
};
