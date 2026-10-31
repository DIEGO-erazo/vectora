/* Vectora — geometría: matrices, cajas, análisis y conversión de trazados */
'use strict';

const Geo = {
  id() { return new DOMMatrix(); },
  local(el) {
    const t = el.transform && el.transform.baseVal.consolidate();
    return t ? DOMMatrix.fromMatrix(t.matrix) : new DOMMatrix();
  },
  /* coordenadas locales del elemento -> coordenadas del documento */
  toDoc(el) {
    const c = App.els.content.getCTM(), m = el.getCTM();
    if (!c || !m) return new DOMMatrix();
    return DOMMatrix.fromMatrix(c).inverse().multiply(DOMMatrix.fromMatrix(m));
  },
  setMatrix(el, m) {
    if (m.isIdentity) el.removeAttribute('transform');
    else el.setAttribute('transform', `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map(v => round(v, 5)).join(' ')})`);
  },
  /* aplica una transformación M (en espacio del documento) al elemento */
  applyDoc(el, M) {
    const P = this.toDoc(el.parentNode);
    const L = this.local(el);
    this.setMatrix(el, P.inverse().multiply(M).multiply(P).multiply(L));
  },
  pt(m, x, y) { const p = new DOMPoint(x, y).matrixTransform(m); return { x: p.x, y: p.y }; },
  bbox(el) {
    let b; try { b = el.getBBox(); } catch (e) { return null; }
    if (!b || (b.width === 0 && b.height === 0 && el.tagName !== 'line' && el.tagName !== 'path')) {
      if (!b) return null;
    }
    const m = this.toDoc(el);
    const ps = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => this.pt(m, x, y));
    const xs = ps.map(p => p.x), ys = ps.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  },
  union(boxes) {
    boxes = boxes.filter(Boolean); if (!boxes.length) return null;
    const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
    const x2 = Math.max(...boxes.map(b => b.x + b.width)), y2 = Math.max(...boxes.map(b => b.y + b.height));
    return { x, y, width: x2 - x, height: y2 - y };
  },
  selBox(els) { return this.union(els.map(e => this.bbox(e))); },
  angle(el) { const m = this.toDoc(el); return Math.atan2(m.b, m.a) * 180 / Math.PI; },
  rotateAbout(deg, cx, cy) { return new DOMMatrix().translate(cx, cy).rotate(deg).translate(-cx, -cy); },
  scaleAbout(sx, sy, cx, cy) { return new DOMMatrix().translate(cx, cy).scale(sx, sy).translate(-cx, -cy); },
  dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); },
};

/* ---------- Análisis de datos de trazado (d) a nodos ---------- */
const PathData = {
  tokenize(d) { return d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || []; },

  /* devuelve [{nodes:[{x,y,hin,hout}], closed}] en coordenadas absolutas */
  parse(d) {
    const t = this.tokenize(d); let i = 0, cmd = '', cx = 0, cy = 0, sx = 0, sy = 0;
    let lastC = null, lastQ = null; const subs = []; let cur = null;
    const num = () => parseFloat(t[i++]);
    const isNum = () => i < t.length && !/[a-zA-Z]/.test(t[i]);
    const start = (x, y) => { cur = { nodes: [{ x, y, hin: null, hout: null }], closed: false }; subs.push(cur); };
    const lineTo = (x, y) => { if (!cur) start(cx, cy); cur.nodes.push({ x, y, hin: null, hout: null }); };
    const curveTo = (x1, y1, x2, y2, x, y) => {
      if (!cur) start(cx, cy);
      cur.nodes[cur.nodes.length - 1].hout = { x: x1, y: y1 };
      cur.nodes.push({ x, y, hin: { x: x2, y: y2 }, hout: null });
    };
    while (i < t.length) {
      if (/[a-zA-Z]/.test(t[i])) cmd = t[i++];
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
      const ox = rel ? cx : 0, oy = rel ? cy : 0;
      if (C === 'Z') {
        if (cur) {
          cur.closed = true;
          const f = cur.nodes[0], l = cur.nodes[cur.nodes.length - 1];
          if (cur.nodes.length > 1 && Math.abs(f.x - l.x) < 1e-6 && Math.abs(f.y - l.y) < 1e-6) { f.hin = l.hin; cur.nodes.pop(); }
        }
        cx = sx; cy = sy; cur = null; lastC = lastQ = null; continue;
      }
      if (!isNum()) { i++; continue; }
      if (C === 'M') { cx = num() + ox; cy = num() + oy; sx = cx; sy = cy; start(cx, cy); cmd = rel ? 'l' : 'L'; lastC = lastQ = null; continue; }
      if (C === 'L') { cx = num() + ox; cy = num() + oy; lineTo(cx, cy); lastC = lastQ = null; }
      else if (C === 'H') { cx = num() + ox; lineTo(cx, cy); lastC = lastQ = null; }
      else if (C === 'V') { cy = num() + oy; lineTo(cx, cy); lastC = lastQ = null; }
      else if (C === 'C') {
        const x1 = num() + ox, y1 = num() + oy, x2 = num() + ox, y2 = num() + oy; cx = num() + ox; cy = num() + oy;
        curveTo(x1, y1, x2, y2, cx, cy); lastC = { x: x2, y: y2 }; lastQ = null;
      } else if (C === 'S') {
        const x1 = lastC ? 2 * cx - lastC.x : cx, y1 = lastC ? 2 * cy - lastC.y : cy;
        const x2 = num() + ox, y2 = num() + oy; cx = num() + ox; cy = num() + oy;
        curveTo(x1, y1, x2, y2, cx, cy); lastC = { x: x2, y: y2 }; lastQ = null;
      } else if (C === 'Q' || C === 'T') {
        let qx, qy;
        if (C === 'Q') { qx = num() + ox; qy = num() + oy; } else { qx = lastQ ? 2 * cx - lastQ.x : cx; qy = lastQ ? 2 * cy - lastQ.y : cy; }
        const x = num() + ox, y = num() + oy;
        curveTo(cx + 2 / 3 * (qx - cx), cy + 2 / 3 * (qy - cy), x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), x, y);
        cx = x; cy = y; lastQ = { x: qx, y: qy }; lastC = null;
      } else if (C === 'A') {
        const rx = num(), ry = num(), rot = num(), la = num(), sw = num(), x = num() + ox, y = num() + oy;
        for (const c of this.arcToCubic(cx, cy, rx, ry, rot, la, sw, x, y)) curveTo(...c);
        cx = x; cy = y; lastC = lastQ = null;
      } else i++;
    }
    return subs;
  },

  arcToCubic(x1, y1, rx, ry, phi, fa, fs, x2, y2) {
    if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2]];
    const r = phi * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r);
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
    rx = Math.abs(rx); ry = Math.abs(ry);
    const lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
    if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
    const sign = fa === fs ? -1 : 1;
    const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const co = sign * Math.sqrt(Math.max(0, num / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
    const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
    const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
    const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
    const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
    const n = Math.ceil(Math.abs(dt) / (Math.PI / 2)), out = [], step = dt / n;
    const k = 4 / 3 * Math.tan(step / 4);
    const P = (t) => ({ x: cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, y: cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos });
    const D = (t) => ({ x: -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, y: -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos });
    for (let j = 0; j < n; j++) {
      const a = t1 + j * step, b = a + step, pa = P(a), pb = P(b), da = D(a), db = D(b);
      out.push([pa.x + k * da.x, pa.y + k * da.y, pb.x - k * db.x, pb.y - k * db.y, pb.x, pb.y]);
    }
    return out;
  },

  serialize(subs) {
    const f = v => round(v, 3);
    const seg = (a, b) => (a.hout || b.hin)
      ? `C${f((a.hout || a).x)} ${f((a.hout || a).y)} ${f((b.hin || b).x)} ${f((b.hin || b).y)} ${f(b.x)} ${f(b.y)}`
      : `L${f(b.x)} ${f(b.y)}`;
    return subs.filter(s => s.nodes.length).map(s => {
      const n = s.nodes; let d = `M${f(n[0].x)} ${f(n[0].y)}`;
      for (let i = 1; i < n.length; i++) d += seg(n[i - 1], n[i]);
      if (s.closed) { if (n.length > 1 && (n[n.length - 1].hout || n[0].hin)) d += seg(n[n.length - 1], n[0]); d += 'Z'; }
      return d;
    }).join(' ');
  },

  /* geometría de figura básica -> d */
  fromShape(el) {
    const A = n => parseFloat(el.getAttribute(n)) || 0, K = 0.5522847498;
    const ell = (cx, cy, rx, ry) => `M${cx + rx} ${cy}C${cx + rx} ${cy + ry * K} ${cx + rx * K} ${cy + ry} ${cx} ${cy + ry}` +
      `C${cx - rx * K} ${cy + ry} ${cx - rx} ${cy + ry * K} ${cx - rx} ${cy}C${cx - rx} ${cy - ry * K} ${cx - rx * K} ${cy - ry} ${cx} ${cy - ry}` +
      `C${cx + rx * K} ${cy - ry} ${cx + rx} ${cy - ry * K} ${cx + rx} ${cy}Z`;
    switch (el.tagName) {
      case 'path': return el.getAttribute('d') || '';
      case 'rect': {
        const x = A('x'), y = A('y'), w = A('width'), h = A('height');
        let rx = Math.min(A('rx') || A('ry'), w / 2), ry = Math.min(A('ry') || A('rx'), h / 2);
        if (!rx) return `M${x} ${y}L${x + w} ${y}L${x + w} ${y + h}L${x} ${y + h}Z`;
        const kx = rx * (1 - K), ky = ry * (1 - K);
        return `M${x + rx} ${y}L${x + w - rx} ${y}C${x + w - kx} ${y} ${x + w} ${y + ky} ${x + w} ${y + ry}` +
          `L${x + w} ${y + h - ry}C${x + w} ${y + h - ky} ${x + w - kx} ${y + h} ${x + w - rx} ${y + h}` +
          `L${x + rx} ${y + h}C${x + kx} ${y + h} ${x} ${y + h - ky} ${x} ${y + h - ry}` +
          `L${x} ${y + ry}C${x} ${y + ky} ${x + kx} ${y} ${x + rx} ${y}Z`;
      }
      case 'ellipse': return ell(A('cx'), A('cy'), A('rx'), A('ry'));
      case 'circle': return ell(A('cx'), A('cy'), A('r'), A('r'));
      case 'line': return `M${A('x1')} ${A('y1')}L${A('x2')} ${A('y2')}`;
      case 'polygon': case 'polyline': {
        const p = (el.getAttribute('points') || '').trim().split(/[\s,]+/).map(Number);
        let d = ''; for (let i = 0; i + 1 < p.length; i += 2) d += (i ? 'L' : 'M') + p[i] + ' ' + p[i + 1];
        return d + (el.tagName === 'polygon' ? 'Z' : '');
      }
    }
    return null;
  },

  /* reemplaza una figura por un <path> equivalente */
  convert(el) {
    if (el.tagName === 'path') return el;
    const d = this.fromShape(el); if (d == null) return el;
    const p = svgEl('path', { d });
    const skip = new Set(['x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2', 'points', 'd']);
    for (const a of [...el.attributes]) if (!skip.has(a.name) && !/^data-(shape|cx|cy|r|n|inner)$/.test(a.name)) p.setAttribute(a.name, a.value);
    if (el.tagName === 'line' || el.tagName === 'polyline') p.setAttribute('fill', p.getAttribute('fill') || 'none');
    el.replaceWith(p);
    return p;
  },
};
