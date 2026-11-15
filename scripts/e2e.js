/* Pruebas de extremo a extremo: abre Vectora en un navegador real y comprueba que nada se rompe.
   Uso: npm test            (necesita `npx playwright install chromium` la primera vez)
        npm test -- menus   (solo los grupos cuyo nombre contenga «menus»)
   Variables: VECTORA_CHANNEL=msedge|chrome usa un navegador ya instalado.

   Grupos:
     unidad        tests.html (geometría, trazados, operaciones booleanas)
     arranque      la aplicación carga sin errores en la consola
     llamadas      ninguna llamada Objeto.metodo() apunta a un método que no existe
     menus         cada comando de menú, con varias selecciones, sin excepciones ni NaN, y se puede deshacer
     herramientas  cada herramienta, arrastrando y haciendo clic sobre el lienzo
     archivo       guardar y volver a abrir conserva el dibujo
     saneado       un SVG malicioso no ejecuta código ni carga nada de internet
     rendimiento   mover miles de objetos sigue siendo rápido
     idioma        la interfaz en inglés no deja textos en español
     accesibilidad roles y nombres para lectores de pantalla; herramientas y menús con el teclado
     pdf           el PDF vectorial conserva sombras, desenfoques, máscaras y degradados */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const only = process.argv.slice(2);
const wants = name => !only.length || only.some(o => name.includes(o));

/* ---------- servidor de archivos mínimo ---------- */
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
function serve() {
  return new Promise(resolve => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
      const file = path.join(ROOT, rel);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    }).listen(0, '127.0.0.1', () => resolve({ srv, base: `http://127.0.0.1:${srv.address().port}/` }));
  });
}

/* ---------- utilidades ---------- */
const results = [];
function report(group, ok, detail = '') {
  results.push({ group, ok });
  console.log(`${ok ? '✔' : '✘'} ${group}${detail ? ' — ' + detail : ''}`);
}
const CAPTURE = `
  window.__errs = [];
  window.addEventListener('error', e => window.__errs.push('error: ' + (e.message || e) + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno));
  window.addEventListener('unhandledrejection', e => window.__errs.push('promesa: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));`;

async function openApp(browser, base, locale = 'es-ES') {
  /* sin service worker: al instalarse recarga la página a mitad de la prueba */
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(CAPTURE);
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
  await page.goto(base);
  await page.waitForFunction(() => !document.documentElement.classList.contains('booting') && typeof Shell !== 'undefined');
  const bootErrors = [...await page.evaluate(() => window.__errs.slice()), ...consoleErrors];
  await page.evaluate(() => { if (Home.visible) return IO.newDoc(800, 600, false); });
  await page.waitForTimeout(200);
  return { ctx, page, consoleErrors, bootErrors };
}

/* deja el documento con una escena conocida y esa selección */
const SCENES = {
  nada: `[]`,
  dos: `[add('rect',{x:100,y:100,width:200,height:120,fill:'#3478f6',stroke:'#000','stroke-width':2}),add('ellipse',{cx:280,cy:200,rx:90,ry:70,fill:'#e33',stroke:'none'})]`,
  trazado: `[add('path',{d:'M100 300C150 200 250 200 300 300S450 400 500 300',fill:'none',stroke:'#000','stroke-width':3})]`,
  texto: `[(()=>{const t=add('text',{x:120,y:200,fill:'#000','font-family':'Arial','font-size':40});svgEl('tspan',{x:120},t).textContent='Hola mundo';return t})()]`,
  grupo: `[(()=>{const a=add('rect',{x:100,y:100,width:100,height:100,fill:'#0a0',stroke:'none'}),b=add('polygon',{points:'300,100 400,250 200,250',fill:'#fc0',stroke:'#000'});Selection.set([a,b]);Actions.group();return App.selection[0]})()]`,
};
const setScene = (page, code) => page.evaluate(code => {
  document.querySelectorAll('.dlg-back').forEach(d => d.remove()); Dialog.isOpen = false;
  if (Isolation.active()) Isolation.exit();
  Tools.use('select');
  App.els.content.innerHTML = ''; App.activeLayer = null; App.selection = [];
  const L = Layers.create('Capa 1');
  const add = (tag, a) => { const e = svgEl(tag, { id: uid(), ...a }); L.appendChild(e); return e; }; /* eslint-disable-line no-unused-vars */
  const els = eval(code);
  History.reset(); Selection.set(els.filter(Boolean));
  window.__errs.length = 0;
}, code);
/* atributos con NaN, undefined o Infinity: señal de un cálculo roto */
const badAttrs = page => page.evaluate(() => [...App.els.content.querySelectorAll('*')].flatMap(e => [...e.attributes]
  .filter(a => !/^(data-|href|xlink:href)/.test(a.name) && /NaN|undefined|Infinity/.test(a.value)).map(a => `${e.tagName}[${a.name}=${a.value.slice(0, 40)}]`)).slice(0, 3));
async function closeDialogs(page) {
  for (let i = 0; i < 4 && await page.locator('.dlg-back').count(); i++) {
    try { await page.locator('.dlg-back [data-ok]').last().click({ timeout: 800 }); }
    catch (e) { await page.evaluate(() => { document.querySelectorAll('.dlg-back').forEach(d => d.remove()); Dialog.isOpen = false; }); }
    await page.waitForTimeout(40);
  }
}

/* ---------- grupos de pruebas ---------- */
async function unidad(browser, base) {
  const page = await browser.newPage();
  await page.goto(base + 'tests.html');
  await page.waitForFunction(() => /\d+ \/ \d+/.test(document.getElementById('sum').textContent));
  const sum = await page.innerText('#sum'), fails = await page.locator('.fail').count();
  const failed = fails ? await page.locator('tr:has(.fail)').allInnerTexts() : [];
  await page.close();
  report('unidad', fails === 0, sum + (failed.length ? '\n   ' + failed.join('\n   ') : ''));
}

async function arranque(browser, base) {
  const { ctx, bootErrors } = await openApp(browser, base);
  await ctx.close();
  report('arranque', bootErrors.length === 0, bootErrors.join(' | ') || 'sin errores en la consola');
}

async function llamadas(browser, base) {
  /* pares Objeto.metodo( del código; se ignoran las variables de una letra (son locales) */
  const pairs = new Map();
  for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
    fs.readFileSync(path.join(ROOT, 'js', f), 'utf8').split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/(?<![\w.$])([A-Z][A-Za-z0-9_]+)\.([A-Za-z_$][\w$]*)\s*\(/g)) if (!pairs.has(m[1] + '.' + m[2])) pairs.set(m[1] + '.' + m[2], `${f}:${i + 1}`);
    });
  }
  const { ctx, page } = await openApp(browser, base);
  const missing = await page.evaluate(list => list.filter(k => {
    const [o, m] = k.split('.');
    try { const obj = eval(o); return obj != null && (typeof obj === 'object' || typeof obj === 'function') && !(m in obj); } catch (e) { return false; } /* sin definir: librería que se carga después */
  }), [...pairs.keys()]);
  await ctx.close();
  report('llamadas', missing.length === 0, missing.length ? missing.map(k => `${k} (${pairs.get(k)})`).join(', ') : `${pairs.size} llamadas comprobadas`);
}

const SKIP_MENU = /Abrir|Colocar|Cerrar|Salir|Imprimir|Guardar|Exportar|[Ss]cript|actualizaciones|Instalar|Nuevo|Acerca/;
async function menus(browser, base) {
  const { ctx, page, consoleErrors } = await openApp(browser, base);
  const cmds = await page.evaluate(() => Object.entries(MENUS).flatMap(([m, its]) => its.map((it, i) => it === '-' ? null : [m, i, it[0]]).filter(Boolean)));
  const found = []; let run = 0;
  for (const [scene, code] of Object.entries(SCENES)) {
    for (const [menu, i, label] of cmds) {
      if (menu === 'Ayuda' || SKIP_MENU.test(label)) continue;
      await setScene(page, code); consoleErrors.length = 0; run++;
      await page.evaluate(([m, i]) => {
        const it = MENUS[m][i];
        try { const r = History.named(it[0], it[2]); if (r && r.catch) r.catch(e => window.__errs.push('promesa: ' + (e && (e.stack || e.message) || e))); }
        catch (e) { window.__errs.push('excepción: ' + (e.stack || e.message)); }
      }, [menu, i]);
      await page.waitForTimeout(30);
      await closeDialogs(page);
      await page.evaluate(() => { try { History.undo(); History.redo(); } catch (e) { window.__errs.push('deshacer: ' + (e.stack || e.message)); } });
      const errs = [...await page.evaluate(() => window.__errs.slice()), ...consoleErrors, ...await badAttrs(page)];
      if (errs.length) found.push(`[${scene}] ${menu} ▸ ${label}: ${errs[0].split('\n')[0]}`);
    }
  }
  await ctx.close();
  report('menus', found.length === 0, found.length ? `${found.length} fallos\n   ` + found.slice(0, 15).join('\n   ') : `${run} ejecuciones de comandos`);
}

async function herramientas(browser, base) {
  const { ctx, page, consoleErrors } = await openApp(browser, base);
  const tools = await page.evaluate(() => Object.keys(App.tools));
  const box = await page.locator('#stage').boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const found = [];
  for (const t of tools) {
    await setScene(page, `[add('rect',{x:250,y:200,width:200,height:150,fill:'#3478f6',stroke:'#000','stroke-width':2}),
      (add('ellipse',{cx:480,cy:330,rx:90,ry:70,fill:'#e33',stroke:'none'}),add('path',{d:'M100 300C150 200 250 200 300 300S450 400 500 300',fill:'none',stroke:'#000','stroke-width':3}),null)]`);
    consoleErrors.length = 0;
    await page.evaluate(t => Tools.use(t), t);
    for (const [x0, y0, x1, y1] of [[cx - 60, cy - 40, cx + 80, cy + 60], [cx - 200, cy - 150, cx - 120, cy - 100]]) {
      await page.mouse.move(x0, y0); await page.mouse.down();
      await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 3 }); await page.mouse.move(x1, y1, { steps: 3 });
      await page.mouse.up();
    }
    await page.mouse.click(cx + 10, cy + 10); await page.mouse.dblclick(cx + 30, cy - 20);
    await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
    await page.waitForTimeout(30);
    await closeDialogs(page);
    await page.evaluate(() => { try { History.undo(); History.undo(); History.redo(); } catch (e) { window.__errs.push('deshacer: ' + e.message); } });
    const errs = [...await page.evaluate(() => window.__errs.slice()), ...consoleErrors, ...await badAttrs(page)];
    if (errs.length) found.push(`${t}: ${errs[0].split('\n')[0]}`);
  }
  await ctx.close();
  report('herramientas', found.length === 0, found.length ? found.join('\n   ') : `${tools.length} herramientas`);
}

async function archivo(browser, base) {
  const { ctx, page } = await openApp(browser, base);
  const r = await page.evaluate(async () => {
    App.els.content.innerHTML = ''; App.activeLayer = null; App.selection = []; Layers.create('Capa 1'); demoArtwork(); History.reset();
    const sig = () => Layers.objects().map(o => `${o.tagName}:${o.getAttribute('fill') || ''}:${Math.round(o.getBBox().width)}x${Math.round(o.getBBox().height)}`).join('|');
    const before = sig(), n = Layers.objects().length, svg = IO.buildSVG(true);
    const text = typeof svg === 'string' ? svg : new XMLSerializer().serializeToString(svg);
    IO.loadSVG(text, 'ida-y-vuelta'); await new Promise(r => setTimeout(r, 300));
    return { n, after: Layers.objects().length, same: before === sig(), errs: window.__errs.slice(), wellFormed: !new DOMParser().parseFromString(text, 'image/svg+xml').querySelector('parsererror') };
  });
  await ctx.close();
  const ok = r.same && r.n === r.after && r.n > 0 && r.wellFormed && !r.errs.length;
  report('archivo', ok, ok ? `${r.n} objetos idénticos tras guardar y abrir` : JSON.stringify(r));
}

const EVIL = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="200">
  <script>window.__pwn=1</script>
  <rect id="a" width="50" height="50" onclick="window.__pwn=2" onload="window.__pwn=3"/>
  <a xlink:href="javascript:window.__pwn=4"><rect id="b" x="60" width="50" height="50"/></a>
  <a href=" JaVaScRiPt:window.__pwn=5"><rect id="c" x="120" width="50" height="50"/></a>
  <a href="&#9;java&#10;script:window.__pwn=10"><text y="190">x</text></a>
  <a href="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;"><rect id="e" y="60" width="50" height="50"/></a>
  <a href="https://example.org/"><rect id="ok" y="60" x="60" width="50" height="50"/></a>
  <image id="d" href="x" onerror="window.__pwn=6"/>
  <set attributeName="onmouseover" to="window.__pwn=7"/>
  <animate xlink:href="#b" attributeName="href" values="javascript:window.__pwn=8"/>
  <use href="https://evil.example/x.svg#p"/>
  <image id="f" href="https://evil.example/rastreo.png" width="10" height="10"/>
  <image id="img" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" width="10" height="10"/>
  <rect id="g" y="120" width="50" height="50" style="fill:url(https://evil.example/f.svg#x)"/>
  <rect id="h" y="120" x="60" width="50" height="50" fill="url( 'https://evil.example/g.svg#y' )"/>
  <foreignObject><iframe src="javascript:window.__pwn=9"></iframe></foreignObject>
  <style>@import url(https://evil.example/x.css); rect{fill:red}</style>
</svg>`;
async function saneado(browser, base) {
  const { ctx, page } = await openApp(browser, base);
  const requests = [];
  page.on('request', q => { if (/evil\.example/.test(q.url())) requests.push(q.url()); });
  const r = await page.evaluate(async evil => {
    window.__pwn = 0;
    IO.loadSVG(evil, 'malo'); await new Promise(r => setTimeout(r, 300));
    IO.placeSVG(evil); await new Promise(r => setTimeout(r, 300));
    const c = App.els.content, all = [...c.querySelectorAll('*')], attrs = all.flatMap(e => [...e.attributes].map(a => [e.tagName, a.name, a.value]));
    const squash = v => v.replace(/[\x00-\x20]/g, '').toLowerCase();
    return {
      pwn: window.__pwn,
      codigo: c.querySelectorAll('script,foreignObject,iframe,object,embed,style').length,
      animaciones: c.querySelectorAll('set,animate,animateTransform,animateMotion').length,
      on: attrs.filter(([, n]) => /^on/i.test(n)).length,
      javascript: attrs.filter(([, , v]) => squash(v).includes('javascript:')).length,
      externos: attrs.filter(([t, , v]) => /evil\.example/.test(v) || (t !== 'a' && /^https?:/i.test(squash(v)))).length,
      dataHtml: attrs.filter(([, , v]) => /^data:text/i.test(squash(v))).length,
      conservaImagen: c.querySelectorAll('image[href^="data:image/png"]').length > 0,
      conservaEnlace: c.querySelectorAll('a[href="https://example.org/"]').length > 0,
    };
  }, EVIL);
  await ctx.close();
  const ok = !r.pwn && !r.codigo && !r.animaciones && !r.on && !r.javascript && !r.externos && !r.dataHtml && r.conservaImagen && r.conservaEnlace && !requests.length;
  report('saneado', ok, ok ? 'sin código, sin animaciones y sin peticiones a internet; se conservan las imágenes incrustadas y los enlaces http' : JSON.stringify({ ...r, requests }));
}

async function rendimiento(browser, base) {
  const { ctx, page } = await openApp(browser, base);
  const t = await page.evaluate(() => {
    App.els.content.innerHTML = ''; App.activeLayer = null; App.selection = []; const L = Layers.create('Capa 1');
    for (let i = 0; i < 3000; i++) L.appendChild(svgEl('rect', { id: uid(), x: (i % 60) * 13, y: Math.floor(i / 60) * 12, width: 10, height: 9, fill: '#abc', stroke: 'none' }));
    History.reset();
    const time = f => { const a = performance.now(); f(); return Math.round(performance.now() - a); };
    const out = { seleccionar: time(() => Selection.set(Layers.objects())), mover: time(() => Actions.nudge(5, 5)), deshacer: time(() => History.undo()) };
    out.movido = Layers.objects().length === 3000;
    return out;
  });
  await ctx.close();
  /* límites holgados (los servidores de CI son lentos): antes de optimizar eran 750, 1900 y 220 ms en un portátil */
  const ok = t.movido && t.seleccionar < 1200 && t.mover < 1500 && t.deshacer < 1500;
  report('rendimiento', ok, `3.000 objetos: seleccionar ${t.seleccionar} ms, mover ${t.mover} ms, deshacer ${t.deshacer} ms`);
}

async function idioma(browser, base) {
  const { ctx, page } = await openApp(browser, base, 'en-US');
  const r = await page.evaluate(async () => {
    const clean = s => s.replace(/^✓ /, '').replace(/…$/, '').trim(), spanish = /[áéíóúñ¿¡]/i;
    const menu = new Set();
    for (const its of Object.values(MENUS)) for (const it of its) if (it !== '-') for (const part of it[0].split(' ▸ ')) { const k = clean(part); if (spanish.test(Lang.t(k))) menu.add(k); }
    const tools = Object.values(TOOL_INFO).map(t => t[0]).filter(k => spanish.test(Lang.t(k)));
    /* textos visibles de la interfaz (no el contenido del documento) */
    const seen = new Set(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const n = w.currentNode, s = n.nodeValue.trim(), p = n.parentElement; if (s && s.length < 80 && p && !p.closest('script,style,#content,#textEditor,[data-noi18n]') && spanish.test(s)) seen.add(s); }
    for (const e of document.querySelectorAll('[title],[placeholder],[aria-label]')) for (const a of ['title', 'placeholder', 'aria-label']) { const v = e.getAttribute(a); if (v && spanish.test(v) && !e.closest('[data-noi18n]')) seen.add(`${a}: ${v}`); }
    return { lang: Lang.cur, menu: [...menu], tools, seen: [...seen] };
  });
  await ctx.close();
  const left = [...r.menu, ...r.tools, ...r.seen];
  report('idioma', r.lang === 'en' && left.length === 0, left.length ? `${left.length} textos sin traducir: ${left.slice(0, 20).join(' · ')}` : 'menús, herramientas y paneles en inglés');
}

/* El PDF vectorial debe verse como el PNG: se dibuja cada efecto, se exporta a PDF, se vuelve a pintar con PDF.js
   y se compara por zonas. Las librerías salen de node_modules si están instaladas; si no, del CDN. */
async function pdf(browser, base) {
  const { ctx, page } = await openApp(browser, base);
  await page.route('https://cdn.jsdelivr.net/npm/**', route => {
    const m = route.request().url().match(/\/npm\/((?:@[^/]+\/)?[^/@]+)@[^/]+\/(.+)$/), file = m && path.join(ROOT, 'node_modules', m[1], m[2]);
    if (file && fs.existsSync(file)) route.fulfill({ path: file, headers: { 'Access-Control-Allow-Origin': '*' } }); else route.continue();
  });
  const r = await page.evaluate(async () => {
    const ok = async () => { for (let i = 0; i < 4 && document.querySelector('.dlg-back'); i++) { const b = [...document.querySelectorAll('.dlg-back [data-ok]')].pop(); if (b) b.click(); await new Promise(r => setTimeout(r, 60)); } };
    App.els.content.innerHTML = ''; App.activeLayer = null; App.selection = []; Layers.create('Capa 1');
    App.doc.width = 800; App.doc.height = 400; View.updateArtboard();
    const add = (tag, a) => { const e = svgEl(tag, { id: uid(), ...a }); Layers.ensure().appendChild(e); return e; };
    const cells = [];
    const make = async (name, fn) => {
      const c = { x: 20 + (cells.length % 4) * 195, y: 20 + Math.floor(cells.length / 4) * 190 }, el = add('rect', { x: c.x + 30, y: c.y + 30, width: 100, height: 100, fill: '#2f7cf6', stroke: 'none' });
      Selection.set([el]);
      const pr = Promise.resolve(fn(el)); await new Promise(r => setTimeout(r, 80)); await ok(); await Promise.race([pr, new Promise(r => setTimeout(r, 1500))]); await ok();
      cells.push({ name, x: c.x, y: c.y, w: 160, h: 160 }); Selection.clear();
    };
    await make('liso', () => {});
    await make('sombra', () => FilterFX.add('shadow'));
    await make('desenfoque', () => FilterFX.add('blur'));
    await make('resplandor', () => FilterFX.add('outerglow'));
    await make('desvanecer', () => FilterFX.add('feather'));
    await make('opacidad', el => el.setAttribute('opacity', '0.5'));
    await make('máscara de opacidad', el => { const m = add('ellipse', { cx: +el.getAttribute('x') + 50, cy: +el.getAttribute('y') + 50, rx: 50, ry: 50, fill: '#fff', stroke: 'none' }); Selection.set([el, m]); return OpMask.make(); });
    await make('degradado', el => { const g = svgEl('linearGradient', { id: uid('grad'), x1: 0, y1: 0, x2: 1, y2: 0 }, docDefs()); svgEl('stop', { offset: 0, 'stop-color': '#f00' }, g); svgEl('stop', { offset: 1, 'stop-color': '#00f' }, g); el.setAttribute('fill', `url(#${g.id})`); });
    History.commit(); Selection.clear();
    const box = { x: 0, y: 0, width: 800, height: 400 };
    const png = await Export.raster(box, null, 72, 'image/png', { bg: 'white' });
    const svg = IO.buildSVG(true, box), withFx = svg.querySelectorAll('[filter],[mask]').length;
    const blob = await Export.pdfBlob(svg, box);
    await Lib.load(Lib.url('pdfjs')); pdfjsLib.GlobalWorkerOptions.workerSrc = Lib.url('pdfworker');
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise, pg = await doc.getPage(1);
    const canvas = () => { const c = document.createElement('canvas'); c.width = 800; c.height = 400; const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, 800, 400); return x; };
    const a = canvas(), b = canvas();
    a.drawImage(await createImageBitmap(png), 0, 0, 800, 400);
    await pg.render({ canvasContext: b, viewport: pg.getViewport({ scale: 1 }) }).promise;
    const diff = c => { const p = a.getImageData(c.x, c.y, c.w, c.h).data, q = b.getImageData(c.x, c.y, c.w, c.h).data; let s = 0; for (let i = 0; i < p.length; i += 4) s += Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]); return Math.round(s / (p.length / 4) / 3 * 10) / 10; };
    return { pages: doc.numPages, withFx, bytes: blob.size, cells: cells.map(c => [c.name, diff(c)]), errs: window.__errs.slice() };
  });
  await ctx.close();
  const bad = r.cells.filter(([, d]) => d > 3);
  const ok = r.pages === 1 && r.withFx >= 5 && !bad.length && !r.errs.length;
  report('pdf', ok, ok ? `${r.cells.length} efectos iguales en PDF y PNG (diferencia máxima ${Math.max(...r.cells.map(c => c[1]))} de 255)` : JSON.stringify({ ...r, bad }));
}

async function accesibilidad(browser, base) {
  const { ctx, page } = await openApp(browser, base);
  const fails = [];
  const st = await page.evaluate(() => {
    const tools = [...document.querySelectorAll('#tools .tool')], fields = [...document.querySelectorAll('input,select,textarea')].filter(e => e.type !== 'hidden');
    return {
      tools: tools.length, toolsOk: tools.filter(t => t.getAttribute('role') === 'button' && t.tabIndex === 0 && t.getAttribute('aria-label') && t.hasAttribute('aria-pressed')).length,
      pressed: tools.filter(t => t.getAttribute('aria-pressed') === 'true').length,
      menubar: document.querySelector('#menus[role=menubar]') ? document.querySelectorAll('#menus [role=menuitem]').length : 0,
      unnamed: fields.filter(e => !(e.labels && e.labels.length) && !e.getAttribute('aria-label') && !e.title).map(e => e.id || e.className || e.type),
      fields: fields.length, lang: document.documentElement.lang,
    };
  });
  if (st.toolsOk !== st.tools || !st.tools) fails.push(`herramientas con rol y nombre: ${st.toolsOk}/${st.tools}`);
  if (st.pressed !== 1) fails.push(`herramientas marcadas como activas: ${st.pressed}`);
  if (!st.menubar) fails.push('la barra de menús no tiene roles');
  if (st.unnamed.length) fails.push(`campos sin nombre: ${st.unnamed.slice(0, 8).join(', ')}`);
  /* barra de herramientas con el teclado: bajar una herramienta y activarla */
  await page.locator('#tools .tool').first().focus();
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  const second = await page.evaluate(() => { const t = document.querySelectorAll('#tools .tool')[1]; return { expected: t.dataset.tool, got: App.toolName, pressed: t.getAttribute('aria-pressed') }; });
  if (second.expected !== second.got || second.pressed !== 'true') fails.push(`teclado en herramientas: ${JSON.stringify(second)}`);
  /* menús con el teclado: ir al menú que tiene «Todo» (Ctrl+A), bajar hasta la fila y ejecutarla */
  await setScene(page, SCENES.dos);
  await page.evaluate(() => Selection.clear());
  const where = await page.evaluate(() => { const names = Object.keys(MENUS); for (const [mi, n] of names.entries()) { const ii = MENUS[n].filter(x => x !== '-').findIndex(it => it[1] === 'Ctrl+A'); if (ii >= 0) return { mi, ii }; } return null; });
  await page.locator('#menus .menu-btn').first().focus();
  for (let i = 0; i < where.mi; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  const opened = await page.evaluate(mi => ({ open: !document.getElementById('menuPopup').hidden, focus: document.activeElement.className, role: document.activeElement.getAttribute('role'),
    expanded: document.querySelectorAll('#menus .menu-btn')[mi].getAttribute('aria-expanded') }), where.mi);
  if (!opened.open || !/menu-item/.test(opened.focus) || opened.role !== 'menuitem' || opened.expanded !== 'true') fails.push(`abrir menú con teclado: ${JSON.stringify(opened)}`);
  for (let i = 0; i < where.ii; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const after = await page.evaluate(() => ({ sel: App.selection.length, closed: document.getElementById('menuPopup').hidden }));
  if (after.sel !== 2 || !after.closed) fails.push(`ejecutar un comando con teclado: ${JSON.stringify(after)}`);
  /* Escape cierra el menú y devuelve el foco a la barra */
  await page.locator('#menus .menu-btn').first().focus();
  await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
  const esc = await page.evaluate(() => ({ closed: document.getElementById('menuPopup').hidden, focus: document.activeElement.className }));
  if (!esc.closed || !/menu-btn/.test(esc.focus)) fails.push(`Escape en el menú: ${JSON.stringify(esc)}`);
  const errs = await page.evaluate(() => window.__errs.slice()); if (errs.length) fails.push(errs[0]);
  await ctx.close();
  report('accesibilidad', fails.length === 0, fails.length ? fails.join(' · ') : `${st.tools} herramientas y ${st.menubar} menús con teclado; ${st.fields} campos con nombre`);
}

/* ---------- ejecución ---------- */
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (e) { console.error('Falta Playwright. Instálalo con: npm install && npx playwright install chromium'); process.exit(2); }
  const { srv, base } = await serve();
  const browser = await chromium.launch(process.env.VECTORA_CHANNEL ? { channel: process.env.VECTORA_CHANNEL } : {});
  const groups = { unidad, arranque, llamadas, menus, herramientas, archivo, saneado, rendimiento, idioma, accesibilidad, pdf };
  const started = Date.now();
  for (const [name, fn] of Object.entries(groups)) {
    if (!wants(name)) continue;
    try { await fn(browser, base); }
    catch (e) { report(name, false, 'la prueba no pudo terminar: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' ')); }
  }
  await browser.close(); srv.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length} de ${results.length} grupos correctos en ${Math.round((Date.now() - started) / 1000)} s.`);
  process.exit(failed.length ? 1 : 0);
})();
