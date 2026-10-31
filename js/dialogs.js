/* Vectora — cuadros de diálogo propios y menú contextual */
'use strict';

const Dialog = {
  isOpen: false,
  /* fields: [{id, label, type: number|text|select|color|checkbox, value, options, min, max, step}]
     opts: {preview(values), revert(), ok: 'Aceptar', buttons: [[label, value]], note} -> Promise<values|null> */
  form(title, fields, opts = {}) {
    return new Promise(resolve => {
      const back = document.createElement('div'); back.className = 'dlg-back';
      const box = document.createElement('div'); box.className = 'dlg'; back.appendChild(box);
      const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
      const input = f => {
        if (f.type === 'select') return `<select data-id="${f.id}">${f.options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(f.value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
        if (f.type === 'checkbox') return `<input type="checkbox" data-id="${f.id}" ${f.value ? 'checked' : ''}>`;
        const ex = ['min', 'max', 'step'].filter(k => f[k] != null).map(k => `${k}="${f[k]}"`).join(' ');
        return `<input type="${f.type || 'text'}" data-id="${f.id}" value="${esc(f.value ?? '')}" ${ex}>`;
      };
      box.innerHTML = `<div class="dlg-title">${esc(title)}</div>
        <div class="dlg-body">${opts.note ? `<div class="dlg-note">${esc(opts.note).replace(/\n/g, '<br>')}</div>` : ''}
          ${fields.length ? `<div class="grid2">${fields.map(f => f.type === 'heading'
            ? `<div class="dlg-row dlg-h" data-row="${f.id}">${esc(f.label)}</div>`
            : `<div class="dlg-row" data-row="${f.id}" style="display:contents"><label>${esc(f.label)}</label>${input(f)}</div>`).join('')}</div>` : ''}
          ${opts.preview ? '<label class="dlg-prev"><input type="checkbox" data-prev checked> Previsualizar</label>' : ''}</div>
        <div class="dlg-foot">${(opts.buttons || []).map(([l, v]) => `<button data-v="${esc(v)}">${esc(l)}</button>`).join('')}
          ${opts.cancel === false ? '' : '<button data-cancel>Cancelar</button>'}<button class="primary" data-ok>${esc(opts.ok || 'Aceptar')}</button></div>`;
      document.body.appendChild(back); this.isOpen = true;
      const values = () => {
        const v = {};
        box.querySelectorAll('[data-id]').forEach(el => v[el.dataset.id] = el.type === 'checkbox' ? el.checked : el.value);
        return v;
      };
      const prevOn = () => { const c = box.querySelector('[data-prev]'); return c && c.checked; };
      /* campos condicionales: f.show(values) decide si se ven */
      const visibility = () => { const v = values(); for (const f of fields) if (f.show) box.querySelector(`[data-row="${f.id}"]`).style.display = f.show(v) ? (f.type === 'heading' ? '' : 'contents') : 'none'; };
      const preview = () => { visibility(); if (!opts.preview) return; opts.revert && opts.revert(); if (prevOn()) opts.preview(values()); };
      const close = (result) => {
        back.remove(); this.isOpen = false;
        if (opts.preview && opts.revert) opts.revert();
        resolve(result);
      };
      box.addEventListener('input', preview); box.addEventListener('change', preview);
      box.querySelector('[data-ok]').onclick = () => close(values());
      const c = box.querySelector('[data-cancel]'); if (c) c.onclick = () => close(null);
      box.querySelectorAll('[data-v]').forEach(b => b.onclick = () => close({ ...values(), _button: b.dataset.v }));
      back.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Escape') close(opts.cancel === false ? values() : null);
        if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); close(values()); }
      });
      back.addEventListener('mousedown', e => { if (e.target === back) e.preventDefault(); });
      const first = box.querySelector('input,select') || box.querySelector('[data-ok]');
      setTimeout(() => { first.focus(); first.select && first.select(); preview(); }, 0);
    });
  },
  alert(msg, title = 'Vectora') { return this.form(title, [], { note: msg, cancel: false }); },
  async confirm(msg, title = 'Vectora') { return !!(await this.form(title, [], { note: msg, ok: 'Sí' })); },

  /* restaura el contenido a una instantánea sin tocar el historial */
  revertTo(snap) {
    App.els.content.innerHTML = ImageStore.unpack(snap.html);
    Selection.set(snap.sel.map(id => document.getElementById(id)).filter(Boolean));
  },
  /* diálogo que modifica la selección con vista previa */
  async edit(title, fields, apply) {
    if (!App.selection.length) return;
    const snap = History.snapshot();
    const v = await this.form(title, fields, { preview: v => apply(v), revert: () => this.revertTo(snap) });
    if (!v) return;
    apply(v); History.commit(); Selection.changed();
  },
  /* diálogo de transformación con vista previa y botón «Copiar» */
  async transform(title, fields, build) {
    if (!App.selection.length) return;
    const snap = History.snapshot();
    const apply = (v, copy) => {
      const M = build(v); if (!M) return null;
      let els = App.selection.filter(e => !Layers.isLocked(e));
      if (copy) { els = els.map(e => { const c = cloneWithIds(e); e.after(c); return c; }); Selection.set(els); }
      els.forEach(e => { Geo.applyDoc(e, M); normalizeTransform(e); });
      Selection.draw(); return M;
    };
    const v = await this.form(title, fields, {
      preview: v => apply(v, false),
      revert: () => this.revertTo(snap),
      buttons: [['Copiar', 'copy']],
    });
    if (!v) return;
    const copy = v._button === 'copy', M = apply(v, copy);
    if (M) { App.lastTransform = { matrix: M, duplicate: copy }; History.commit(); Selection.changed(); App.emit('layers'); }
  },
};

/* ---------- Menú contextual (clic derecho) ---------- */
const ContextMenu = {
  items() {
    const s = App.selection, has = s.length > 0, one = s.length === 1;
    const anyGroup = s.some(e => e.tagName === 'g' && !e.hasAttribute('clip-path')), clip = s.some(e => e.hasAttribute('clip-path'));
    const L = [['Deshacer', 'Ctrl+Z', () => History.undo()], ['Rehacer', 'Ctrl+Shift+Z', () => History.redo()], '-'];
    if (!has) return [...L, ['Pegar', 'Ctrl+V', () => Actions.paste()], ['Seleccionar todo', 'Ctrl+A', () => Actions.selectAll()], '-',
      ['Encajar mesa de trabajo en ventana', 'Ctrl+0', () => View.fit()], ['Mostrar reglas', 'Ctrl+R', () => Rulers.toggle()]];
    return [...L,
      ['Cortar', 'Ctrl+X', () => Actions.cut()], ['Copiar', 'Ctrl+C', () => Actions.copy()], ['Pegar', 'Ctrl+V', () => Actions.paste()],
      ['Duplicar', 'Ctrl+Alt+D', () => Actions.duplicate()], ['Eliminar', 'Supr', () => Actions.del()], '-',
      ['Transformar ▸ Mover…', 'Ctrl+Shift+M', () => Actions.moveDialog()], ['Transformar ▸ Rotar…', '', () => Actions.rotateDialog()],
      ['Transformar ▸ Escalar…', '', () => Actions.scaleDialog()], ['Transformar ▸ Reflejar horizontal', '', () => Actions.reflect('h')],
      ['Transformar ▸ Transformar de nuevo', 'Ctrl+D', () => PathOps.transformAgain()], '-',
      ['Organizar ▸ Traer al frente', 'Ctrl+Shift+]', () => Actions.arrange('front')], ['Organizar ▸ Hacia delante', 'Ctrl+]', () => Actions.arrange('forward')],
      ['Organizar ▸ Hacia atrás', 'Ctrl+[', () => Actions.arrange('backward')], ['Organizar ▸ Enviar al fondo', 'Ctrl+Shift+[', () => Actions.arrange('back')], '-',
      ...(s.length > 1 ? [['Agrupar', 'Ctrl+G', () => Actions.group()]] : []),
      ...(anyGroup || clip ? [['Desagrupar', 'Ctrl+Shift+G', () => Actions.ungroup()]] : []),
      ...(s.length > 1 ? [['Crear máscara de recorte', 'Ctrl+7', () => Actions.makeClip()], ['Crear trazado compuesto', 'Ctrl+8', () => Pathfinder.compound()]] : []),
      ...(clip ? [['Liberar máscara de recorte', 'Ctrl+Alt+7', () => Actions.releaseClip()]] : []),
      ...(s.length <= 2 ? [['Unir', 'Ctrl+J', () => PathOps.join()]] : []),
      ...(s.some(e => e.tagName === 'use') ? [['Editar símbolo', '', () => Symbols.edit(s.find(e => e.tagName === 'use'))], ['Romper vínculo con símbolo', '', () => Symbols.breakLink()]] : []),
      ['Contornear trazo', '', () => PathOps.outlineStroke()],
      ...(s.some(e => e.tagName === 'text') ? [['Crear contornos', 'Ctrl+Shift+O', () => TextOutline.run()]] : []),
      ...(s.some(e => e.tagName === 'image') ? [['Calco de imagen…', '', () => Trace.dialog()]] : []), '-',
      ['Bloquear selección', 'Ctrl+2', () => Actions.lock()], ['Ocultar selección', 'Ctrl+3', () => Actions.hide()],
      ...(one && s[0].tagName === 'text' ? [['Editar texto', '', () => { const t = s[0]; Tools.use('text'); TextTool.edit(t); }]] : []),
    ];
  },
  show(x, y) {
    const pop = $('menuPopup'); Menus.close(); Menus.openMenu = '__ctx'; pop.innerHTML = '';
    for (const it of this.items()) {
      if (it === '-') { pop.insertAdjacentHTML('beforeend', '<div class="menu-sep"></div>'); continue; }
      const row = document.createElement('div'); row.className = 'menu-item';
      row.innerHTML = `<span>${it[0]}</span><span class="kbd">${it[1]}</span>`;
      row.onclick = () => { Menus.close(); it[2](); };
      pop.appendChild(row);
    }
    pop.hidden = false;
    const r = pop.getBoundingClientRect();
    pop.style.left = Math.min(x, innerWidth - r.width - 4) + 'px'; pop.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
  },
};
