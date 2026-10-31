/* Vectora — diálogo «Nuevo documento» (categorías, ajustes preestablecidos, unidades,
   orientación y sangrado) y «Ajustar documento» */
'use strict';

const NewDoc = {
  /* mode: 'new' | 'setup' -> Promise<{name, width, height, units, bleed}|null> (medidas en px) */
  open(mode = 'new') {
    return new Promise(resolve => {
      const setup = mode === 'setup', d = App.doc;
      const st = {
        cat: setup ? null : (this.lastCat || 'Imprimir'),
        units: setup ? d.units || 'px' : 'mm', w: setup ? d.width : Units.fromU(210, 'mm'), h: setup ? d.height : Units.fromU(297, 'mm'),
        bleed: setup ? d.bleed || 0 : Units.fromU(3, 'mm'), name: setup ? d.title : 'Sin título-' + (IO.count + 1), preset: setup ? null : 'A4',
      };
      const back = document.createElement('div'); back.className = 'dlg-back';
      const box = document.createElement('div'); box.className = 'dlg nd'; back.appendChild(box);
      const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
      box.innerHTML = `<div class="dlg-title">${setup ? 'Ajustar documento' : 'Nuevo documento'}</div>
        <div class="nd-main">
          ${setup ? '' : `<div class="nd-left"><div class="nd-tabs">${Object.keys(DOC_PRESETS).map(c => `<button data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
            <div class="nd-grid"></div></div>`}
          <div class="nd-right">
            <div class="nd-sec">Detalles del ajuste preestablecido</div>
            <input type="text" id="ndName" value="${esc(st.name)}">
            <div class="grid2">
              <label>Anchura</label><div class="nd-row"><input type="number" id="ndW" min="0.01" step="any"><select id="ndU">${Units.options(st.units)}</select></div>
              <label>Altura</label><input type="number" id="ndH" min="0.01" step="any">
              <label>Orientación</label><div class="nd-row nd-orient">
                <button id="ndPortrait" title="Vertical"><svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18"/></svg></button>
                <button id="ndLandscape" title="Horizontal"><svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10"/></svg></button></div>
              <label>Sangrado</label><input type="number" id="ndBleed" min="0" step="any">
            </div>
            <div class="nd-info" id="ndInfo"></div>
          </div>
        </div>
        <div class="dlg-foot"><button data-cancel>Cerrar</button><button class="primary" data-ok>${setup ? 'Aceptar' : 'Crear'}</button></div>`;
      document.body.appendChild(back); Dialog.isOpen = true;
      const $q = s => box.querySelector(s);
      const num = (px) => round(Units.toU(px, st.units), Units.decimals(st.units) + 1);
      const sync = () => {
        $q('#ndW').value = num(st.w); $q('#ndH').value = num(st.h); $q('#ndBleed').value = num(st.bleed); $q('#ndU').value = st.units;
        $q('#ndPortrait').classList.toggle('on', st.h >= st.w); $q('#ndLandscape').classList.toggle('on', st.w > st.h);
        const ppi = (v) => Math.round(v * 300 / 72);
        $q('#ndInfo').textContent = `${round(st.w, 2)} × ${round(st.h, 2)} pt · a 300 ppp: ${ppi(st.w)} × ${ppi(st.h)} píxeles`;
        box.querySelectorAll('.nd-card').forEach(c => c.classList.toggle('on', c.dataset.name === st.preset));
      };
      const renderCat = () => {
        if (setup) return;
        box.querySelectorAll('.nd-tabs button').forEach(b => b.classList.toggle('on', b.dataset.cat === st.cat));
        const g = $q('.nd-grid'); g.innerHTML = '';
        for (const [name, w, h, u, b] of DOC_PRESETS[st.cat]) {
          const c = document.createElement('button'); c.className = 'nd-card'; c.dataset.name = name;
          const k = 44 / Math.max(w, h), rw = Math.max(4, w * k), rh = Math.max(4, h * k);
          c.innerHTML = `<div class="nd-thumb"><div style="width:${rw}px;height:${rh}px"></div></div><b>${esc(name)}</b><span>${w} × ${h} ${u}</span>`;
          c.onclick = () => { Object.assign(st, { preset: name, units: u, w: Units.fromU(w, u), h: Units.fromU(h, u), bleed: Units.fromU(b || 0, u) }); sync(); };
          c.ondblclick = () => done(true);
          g.appendChild(c);
        }
        sync();
      };
      box.querySelectorAll('.nd-tabs button').forEach(b => b.onclick = () => { st.cat = b.dataset.cat; this.lastCat = st.cat; renderCat(); });
      $q('#ndU').onchange = e => { st.units = e.target.value; sync(); };
      const setNum = (k, el) => el.onchange = () => { const v = Units.fromU(+el.value, st.units); if (v > 0 || (k === 'bleed' && v >= 0)) { st[k] = v; st.preset = null; } sync(); };
      setNum('w', $q('#ndW')); setNum('h', $q('#ndH')); setNum('bleed', $q('#ndBleed'));
      $q('#ndPortrait').onclick = () => { if (st.w > st.h) [st.w, st.h] = [st.h, st.w]; sync(); };
      $q('#ndLandscape').onclick = () => { if (st.h > st.w) [st.w, st.h] = [st.h, st.w]; sync(); };
      const done = ok => {
        box.querySelectorAll('input[type=number]').forEach(i => i.onchange && i.onchange());
        back.remove(); Dialog.isOpen = false;
        resolve(ok ? { name: $q('#ndName').value.trim() || st.name, width: round(st.w, 4), height: round(st.h, 4), units: st.units, bleed: round(st.bleed, 4) } : null);
      };
      $q('[data-ok]').onclick = () => done(true); $q('[data-cancel]').onclick = () => done(false);
      back.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') done(false); if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); done(true); } });
      renderCat(); sync(); setTimeout(() => { $q('#ndName').focus(); $q('#ndName').select(); }, 0);
    });
  },
  async setup() {
    const v = await this.open('setup'); if (!v) return;
    Object.assign(App.doc, { title: v.name, width: v.width, height: v.height, units: v.units, bleed: v.bleed });
    View.updateArtboard(); History.commit(); Panels.refreshControlBar(); Rulers.draw(); Selection.draw();
  },
};
