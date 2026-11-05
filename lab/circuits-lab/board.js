// Circuits Lab board: an editable circuit on a grid, drawn on canvas and run by solver.js every frame.
//
//   const b = createBoard(ctx, {
//     circuit: { cols: 10, rows: 6, parts: [{ id: 'B1', type: 'battery', pts: [[1, 4], [1, 2]], V: 6 }, ...] },
//     palette: ['wire', 'resistor', 'bulb'],  // parts the learner can drag in (omit for none)
//     dotScale: 4,                            // dot speed in grid cells per second per amp, or 'auto'
//     layout(avail, w, h) { return rect },    // optional: where the circuit goes, the rest is yours
//     draw(g, w, h, t, b) {},                 // optional: draw extra things after the circuit
//     onStep(b, h) {},                        // optional: after every simulation step
//   });
//   b.part('B1').V = 9;  b.parts  b.time  b.V([x, y])  b.load(circuit)  b.reset()  b.dock(label, buttons)
//
// Interaction: drag a part from the palette onto the grid (or tap it, then tap the grid). Drag from any grid
// point to another to draw a wire. Drag a part to move it, drag the round handles of a selected part to
// stretch or reconnect it. Tap a part to select it and edit its value, tap a switch to flip it.

import { step, fmt, DEFAULTS, NAMES, LED_COLORS, ldrR, key } from './solver.js';

const STATE_KEYS = new Set(['i', 'v', 'va', 'vb', 'p', 'ph', 'vd', 'heat', 'vc', 'il', 'blown', 'burnt']);
const TWO = (t) => t !== 'spdt';

export const ICONS = {
  wire: '<path d="M3 12h22"/>',
  battery: '<path d="M3 12h8M17 12h8M11 7v10M17 4v16"/><path d="M20 4h4M22 2v4" stroke-width="1.2"/>',
  resistor: '<path d="M2 12h4l2-5 3 10 3-10 3 10 3-10 2 5h4"/>',
  bulb: '<circle cx="14" cy="12" r="7"/><path d="M9 7l10 10M19 7L9 17M2 12h5M21 12h5"/>',
  switch: '<path d="M2 14h6M20 14h6"/><circle cx="8" cy="14" r="1.6"/><circle cx="20" cy="14" r="1.6"/><path d="M8 14l11-7"/>',
  spdt: '<path d="M2 12h6M20 6h6M20 18h6"/><circle cx="8" cy="12" r="1.6"/><path d="M8 12l11-6"/><circle cx="20" cy="6" r="1.4"/><circle cx="20" cy="18" r="1.4"/>',
  led: '<path d="M2 12h7M19 12h7M9 6v12l10-6zM19 6v12"/><path d="M15 4l3-3M19 6l3-3" stroke-width="1.2"/>',
  diode: '<path d="M2 12h7M19 12h7M9 6v12l10-6zM19 6v12"/>',
  fuse: '<path d="M2 12h5M21 12h5"/><rect x="7" y="8" width="14" height="8" rx="1"/><path d="M8 12c3-3 4 3 6 0s4-3 6 0" stroke-width="1.2"/>',
  ammeter: '<path d="M2 12h5M21 12h5"/><circle cx="14" cy="12" r="7"/><path d="M11 16l3-8 3 8M12 13.5h4" stroke-width="1.4"/>',
  voltmeter: '<path d="M2 12h5M21 12h5"/><circle cx="14" cy="12" r="7"/><path d="M11 8l3 8 3-8" stroke-width="1.4"/>',
  capacitor: '<path d="M2 12h10M16 12h10M12 4v16M16 4v16"/>',
  inductor: '<path d="M2 14h3c0-6 5-6 5 0 0-6 5-6 5 0 0-6 5-6 5 0 0-6 5-6 5 0h1"/>',
  ldr: '<path d="M2 14h5M21 14h5"/><rect x="7" y="10" width="14" height="8" rx="1"/><path d="M8 2l4 5M13 1l4 5" stroke-width="1.2"/>',
};
const SHORT = { wire: 'Wire', battery: 'Battery', resistor: 'Resistor', bulb: 'Bulb', switch: 'Switch', spdt: '2 way', led: 'LED', diode: 'Diode', fuse: 'Fuse', ammeter: 'Ammeter', voltmeter: 'Voltmeter', capacitor: 'Capacitor', inductor: 'Inductor', ldr: 'LDR' };
export const icon = (t, size = 26) => `<svg width="${size}" height="${Math.round(size * 0.86)}" viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[t] || ''}</svg>`;

const CSS = `
.cl-pal button { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 4px 7px 5px; font-size: 10.5px; letter-spacing: .06em; touch-action: none; }
.cl-pal button.on { outline: 1.5px solid var(--c2); outline-offset: -1.5px; }
.cl-insp { position: absolute; z-index: 25; left: 0; width: 236px; max-width: calc(100% - 8px); border-radius: 12px; padding: 10px 12px 12px; display: grid; gap: 8px; font-size: 13.5px; }
.cl-insp .hd { display: flex; align-items: center; gap: 8px; }
.cl-insp .hd b { font: 700 15px var(--f-display); letter-spacing: .08em; text-transform: uppercase; flex: 1; }
.cl-insp .hd button { border: 0; background: transparent; color: var(--muted); font-size: 18px; line-height: 1; padding: 2px 4px; }
.cl-insp .rd { font: 500 12px/1.55 var(--f-mono); color: var(--text-2); display: grid; grid-template-columns: auto 1fr; gap: 0 10px; font-variant-numeric: tabular-nums; }
.cl-insp .rd span { color: var(--muted); }
.cl-insp .row .btn { flex: 1; justify-content: center; }
.cl-insp .warn { font: 500 12px var(--f-mono); color: var(--c4); }
.cl-toast { position: absolute; z-index: 26; left: 50%; top: 56px; transform: translateX(-50%); padding: 8px 14px; border-radius: 10px; font: 600 13px var(--f-display); letter-spacing: .1em; text-transform: uppercase; color: var(--text); pointer-events: none; transition: opacity .3s; white-space: nowrap; }
.cl-hint { position: absolute; z-index: 19; left: 50%; transform: translateX(-50%); font: 500 11px var(--f-mono); color: var(--muted); pointer-events: none; white-space: nowrap; }
@media (max-width: 860px) { .cl-insp { width: 210px; padding: 8px 10px 10px; gap: 6px; } .cl-pal button { padding: 3px 6px 4px; } }
`;
function injectCss() {
  if (document.getElementById('cl-css')) return;
  const s = document.createElement('style'); s.id = 'cl-css'; s.textContent = CSS; document.head.append(s);
}

let uid = 0;
export function makePart(type, pts, props = {}) {
  return { id: props.id || `${type}-${++uid}`, type, pts: pts.map((p) => [p[0], p[1]]), ...JSON.parse(JSON.stringify(DEFAULTS[type] || {})), ...props };
}
function clonePart(p) {
  const o = {};
  for (const [k, v] of Object.entries(p)) if (!STATE_KEYS.has(k)) o[k] = k === 'pts' ? v.map((q) => [q[0], q[1]]) : v;
  return o;
}
export function serialize(parts) { return parts.map(clonePart); }

const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const lerp = (a, b, t) => a + (b - a) * t;
function mixHex(c1, c2, t) {
  const a = parseInt(c1.slice(1), 16); const b = parseInt(c2.slice(1), 16);
  const r = Math.round(lerp(a >> 16, b >> 16, t)); const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)); const bl = Math.round(lerp(a & 255, b & 255, t));
  return `rgb(${r},${g},${bl})`;
}

export function createBoard(ctx, o = {}) {
  injectCss();
  const COL = ctx.colors;
  const opt = { palette: null, editable: true, labels: true, dotScale: 4, flow: 'conv', vcolors: false, hotA: 12, timeScale: 1, hmax: 0.004, ...o };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = ctx.canvas(); const g = cv.ctx;
  cv.el.style.touchAction = 'none';
  let parts = []; let cols = 10; let rows = 6; let source = null;
  let V = new Map(); let simT = 0; let paused = false;
  let selected = null; let hover = null; let hoverNode = null; let mouse = null;
  let drag = null; let placing = null; let ghost = null;
  let cell = 40; let ox = 0; let oy = 0; let rect = { x: 0, y: 0, w: 0, h: 0 }; let avail = rect;
  let flashes = []; let autoRef = 0.1; let lastOk = true;

  // ---------- docks ----------
  let topDock = null; let pal = null;
  if (opt.palette && opt.palette.length) {
    topDock = ctx.h('<div class="dock" style="top:0;bottom:auto"></div>');
    pal = ctx.h(`<div class="grp glass cl-pal" role="toolbar" aria-label="Parts"><span>Parts</span>${opt.palette.map((t) => `<button data-t="${t}" title="${NAMES[t]}: drag onto the grid, or tap then tap the grid">${icon(t)}${SHORT[t]}</button>`).join('')}</div>`);
    topDock.append(pal); ctx.stage.append(topDock);
  }
  const botDock = ctx.h('<div class="dock"></div>');
  ctx.stage.append(botDock);
  const insp = ctx.h('<div class="cl-insp glass" hidden></div>');
  ctx.stage.append(insp);
  const toast = ctx.h('<div class="cl-toast glass" style="opacity:0"></div>');
  ctx.stage.append(toast);
  const hint = ctx.h('<div class="cl-hint"></div>');
  ctx.stage.append(hint);

  function dock(label, buttons) {
    const grp = ctx.h(`<div class="grp glass">${label ? `<span>${ctx.esc(label)}</span>` : ''}</div>`);
    for (const bt of buttons) {
      const el = document.createElement('button');
      el.textContent = bt.label; if (bt.title) el.title = bt.title;
      if (bt.on) el.classList.add('on');
      el.addEventListener('click', () => bt.onClick(el));
      grp.append(el);
    }
    botDock.append(grp);
    requestAnimationFrame(fit);
    return grp;
  }
  function segDock(label, options, value, onChange) {
    let grp = null;
    grp = dock(label, options.map(([v, l]) => ({ label: l, on: v === value, onClick: (el) => { grp.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === el)); onChange(v); } })));
    grp.set = (v) => grp.querySelectorAll('button').forEach((x, i) => x.classList.toggle('on', options[i][0] === v));
    return grp;
  }
  const flowSeg = segDock('Flow', [['conv', 'Current'], ['electron', 'Electrons']], opt.flow, (v) => { opt.flow = v; showToast(v === 'conv' ? 'Conventional current: + to -' : 'Electron flow: - to +'); });
  flowSeg.querySelector('button').title = 'Conventional current, from + to - around the circuit';
  flowSeg.querySelectorAll('button')[1].title = 'Electrons drift the other way, from - to +';
  const showGrp = dock('Show', [
    { label: 'Values', on: opt.labels, onClick: (el) => { opt.labels = !opt.labels; el.classList.toggle('on', opt.labels); } },
    { label: 'Volts', title: 'Colour wires by voltage', on: opt.vcolors, onClick: (el) => { opt.vcolors = !opt.vcolors; el.classList.toggle('on', opt.vcolors); } },
  ]);
  if (opt.reset !== false) dock('', [{ label: 'Reset', title: 'Put the circuit back how it started', onClick: () => api.reset() }]);
  void showGrp;

  // ---------- geometry ----------
  function fit() {
    const W = cv.w; const H = cv.h; if (!W) return;
    const tp = topDock ? topDock.offsetHeight + 8 : 4; const bp = botDock.offsetHeight + 8;
    avail = { x: 0, y: tp, w: W, h: Math.max(60, H - tp - bp) };
    rect = opt.layout ? opt.layout(avail, W, H) : avail;
    cell = Math.max(10, Math.min(rect.w / (cols + 0.9), rect.h / (rows + 0.9), 76));
    ox = rect.x + (rect.w - cols * cell) / 2; oy = rect.y + (rect.h - rows * cell) / 2;
    insp.style.top = `${tp}px`;
    hint.style.top = `${tp + 2}px`;
  }
  cv.onResize(fit);
  const P = (pt) => [ox + pt[0] * cell, oy + pt[1] * cell];
  const toGrid = (x, y) => [(x - ox) / cell, (y - oy) / cell];
  const inGrid = (pt) => pt[0] >= 0 && pt[1] >= 0 && pt[0] <= cols && pt[1] <= rows;
  const clampPt = (pt) => [Math.max(0, Math.min(cols, pt[0])), Math.max(0, Math.min(rows, pt[1]))];
  function nearNode(x, y, tol) {
    const [gx, gy] = toGrid(x, y); const n = [Math.round(gx), Math.round(gy)];
    if (!inGrid(n)) return null;
    const [px, py] = P(n);
    return Math.hypot(px - x, py - y) <= (tol ?? Math.max(14, cell * 0.34)) ? n : null;
  }
  function segDist(x, y, A, B) {
    const dx = B[0] - A[0]; const dy = B[1] - A[1]; const L2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - A[0]) * dx + (y - A[1]) * dy) / L2));
    return { d: Math.hypot(x - (A[0] + t * dx), y - (A[1] + t * dy)), t, L: Math.sqrt(L2) };
  }
  // spdt geometry in grid units
  function spdtGeo(p) {
    const [c, t0, t1] = p.pts; const M = [(t0[0] + t1[0]) / 2, (t0[1] + t1[1]) / 2];
    const piv = [lerp(c[0], M[0], 0.38), lerp(c[1], M[1], 0.38)];
    const k0 = [lerp(t0[0], piv[0], 0.32), lerp(t0[1], piv[1], 0.32)];
    const k1 = [lerp(t1[0], piv[0], 0.32), lerp(t1[1], piv[1], 0.32)];
    return { c, t0, t1, piv, k0, k1 };
  }
  // Body length in px for a two terminal part of length L px
  function bodyLen(p, L) {
    switch (p.type) {
      case 'wire': return 0;
      case 'battery': return Math.min(L * 0.8, cell * 0.3);
      case 'capacitor': return Math.min(L * 0.8, cell * 0.22);
      case 'switch': return Math.min(L * 0.8, cell * 1.0);
      case 'bulb': case 'ammeter': case 'voltmeter': return Math.min(L * 0.8, cell * 0.8);
      case 'led': case 'diode': return Math.min(L * 0.8, cell * 0.5);
      default: return Math.min(L * 0.8, cell * 1.2);
    }
  }
  function hitBody(x, y, wires) {
    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k];
      if ((p.type === 'wire') !== wires) continue;
      if (p.type === 'spdt') {
        const G = spdtGeo(p); const pv = P(G.piv); const K = P(p.pos ? G.k1 : G.k0);
        if (Math.hypot(x - pv[0], y - pv[1]) < cell * 0.45 || segDist(x, y, pv, K).d < Math.max(10, cell * 0.25)) return p;
        continue;
      }
      const A = P(p.pts[0]); const B = P(p.pts[1]);
      const { d, t, L } = segDist(x, y, A, B);
      const along = t * L; const e = wires ? Math.min(cell * 0.28, L * 0.3) : Math.min(cell * 0.32, L * 0.3);
      const tol = wires ? Math.max(9, cell * 0.2) : Math.max(13, cell * 0.36);
      if (d < tol && along > e && along < L - e) return p;
    }
    return null;
  }

  // ---------- model ----------
  function load(circuit, keepSource) {
    if (!keepSource) source = JSON.parse(JSON.stringify(circuit));
    cols = circuit.cols || 10; rows = circuit.rows || 6;
    parts = (circuit.parts || []).map((p) => makePart(p.type, p.pts, p));
    selected = null; insp.hidden = true; simT = 0; flashes = [];
    normalize(); fit(); solveNow();
    opt.onLoad && opt.onLoad(api);
  }
  function solveNow() { const r = step(parts, 1e-3); if (r.ok) V = r.V; }
  // Split wires where another terminal sits on one of their inner grid points, drop zero length wires.
  function normalize() {
    parts = parts.filter((p) => !(p.type === 'wire' && p.pts[0][0] === p.pts[1][0] && p.pts[0][1] === p.pts[1][1]));
    for (let guard = 0; guard < 50; guard++) {
      const terms = new Set(); for (const p of parts) for (const pt of p.pts) terms.add(key(pt));
      let split = false;
      for (const w of parts) {
        if (w.type !== 'wire') continue;
        const [a, b] = w.pts; const dx = b[0] - a[0]; const dy = b[1] - a[1]; const n = gcd(Math.abs(dx), Math.abs(dy));
        for (let k = 1; k < n; k++) {
          const q = [a[0] + (dx / n) * k, a[1] + (dy / n) * k];
          if (terms.has(key(q))) {
            const w2 = makePart('wire', [q, b], {}); w.pts = [a, q];
            parts.splice(parts.indexOf(w) + 1, 0, w2); split = true; break;
          }
        }
        if (split) break;
      }
      if (!split) break;
    }
  }
  function changed() {
    normalize(); solveNow(); renderInsp();
    opt.onChange && opt.onChange(api);
  }
  function add(type, pts, props) { const p = makePart(type, pts, props); parts.push(p); changed(); return p; }
  function remove(p) { parts = parts.filter((x) => x !== p); if (selected === p) select(null); changed(); }
  function defaultPts(type, n) {
    const [x, y] = n;
    if (type === 'spdt') return [[x - 1, y], [x + 1, y - 1], [x + 1, y + 1]];
    if (type === 'wire') return [[x, y], [x + 2, y]];
    return [[x - 1, y], [x + 1, y]];
  }
  function fitInGrid(pts) {
    let dx = 0; let dy = 0;
    for (const q of pts) { if (q[0] + dx < 0) dx = -q[0]; if (q[0] + dx > cols) dx = cols - q[0]; if (q[1] + dy < 0) dy = -q[1]; if (q[1] + dy > rows) dy = rows - q[1]; }
    return pts.map((q) => [q[0] + dx, q[1] + dy]);
  }
  function rotate(p) {
    const cx = Math.round(p.pts.reduce((s, q) => s + q[0], 0) / p.pts.length); const cy = Math.round(p.pts.reduce((s, q) => s + q[1], 0) / p.pts.length);
    p.pts = fitInGrid(p.pts.map((q) => [cx - (q[1] - cy), cy + (q[0] - cx)]));
    changed();
  }
  function flip(p) {
    if (p.type === 'spdt') { const t = p.pts[1]; p.pts[1] = p.pts[2]; p.pts[2] = t; } else p.pts.reverse();
    if (p.vc) p.vc = -p.vc; if (p.il) p.il = -p.il; p.vd = 0;
    changed();
  }

  // ---------- inspector ----------
  function select(p) { selected = p; renderInsp(); }
  let rdEl = null; let warnEl = null;
  function logSlider(label, min, max, value, unit, set) {
    return ctx.slider({ label, min: Math.log10(min), max: Math.log10(max), step: 0.01, value: Math.log10(value), fmt: (v) => fmt(10 ** v, unit), onInput: (v) => { set(+(10 ** v).toPrecision(3)); } });
  }
  function renderInsp() {
    if (!selected || !parts.includes(selected)) { selected = null; insp.hidden = true; return; }
    const p = selected; const ed = opt.editable; const ev = opt.editValues !== false;
    insp.hidden = false; insp.innerHTML = '';
    const hd = ctx.h(`<div class="hd">${icon(p.type, 22)}<b>${ctx.esc(p.label ? `${p.label} · ${NAMES[p.type]}` : NAMES[p.type])}</b><button aria-label="Close">×</button></div>`);
    hd.querySelector('button').onclick = () => select(null);
    insp.append(hd);
    rdEl = ctx.h('<div class="rd"></div>'); insp.append(rdEl);
    warnEl = ctx.h('<div class="warn" hidden></div>'); insp.append(warnEl);
    const sliders = [];
    if (ev) {
      if (p.type === 'battery') {
        sliders.push(ctx.slider({ label: 'Voltage', min: 0, max: 24, step: 0.5, value: p.V, unit: ' V', fmt: (v) => `${(+v).toFixed(1)} V`, onInput: (v) => { p.V = v; } }));
        sliders.push(ctx.slider({ label: 'Internal resistance', min: 0.01, max: 2, step: 0.01, value: p.r, fmt: (v) => `${(+v).toFixed(2)} Ω`, onInput: (v) => { p.r = v; } }));
      }
      if (p.type === 'resistor') sliders.push(logSlider('Resistance', 1, 1e6, p.R, 'Ω', (v) => { p.R = v; }));
      if (p.type === 'bulb') {
        sliders.push(logSlider('Resistance', 1, 1000, p.R, 'Ω', (v) => { p.R = v; }));
        sliders.push(logSlider('Rated power', 0.1, 100, p.rated, 'W', (v) => { p.rated = v; }));
      }
      if (p.type === 'capacitor') sliders.push(logSlider('Capacitance', 1e-6, 1e-1, p.C, 'F', (v) => { p.C = v; }));
      if (p.type === 'inductor') sliders.push(logSlider('Inductance', 1e-3, 10, p.L, 'H', (v) => { p.L = v; }));
      if (p.type === 'fuse') sliders.push(ctx.slider({ label: 'Rating', min: 0.1, max: 10, step: 0.1, value: p.rating, fmt: (v) => `${(+v).toFixed(1)} A`, onInput: (v) => { p.rating = v; } }));
      if (p.type === 'ldr') sliders.push(ctx.slider({ label: 'Light level', min: 0, max: 1, step: 0.01, value: p.light, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => { p.light = v; } }));
      if (p.type === 'led') {
        const s = ctx.seg(Object.entries(LED_COLORS).map(([k, c]) => [k, c.label]), p.color, (v) => { p.color = v; p.vd = 0; renderInsp(); });
        insp.append(s);
      }
    }
    for (const s of sliders) insp.append(s);
    const row = ctx.h('<div class="row"></div>');
    const btn = (label, fn, cls = 'ghost') => { const b = ctx.h(`<button class="btn sm ${cls}">${label}</button>`); b.onclick = fn; row.append(b); return b; };
    if (p.type === 'switch') btn(p.closed ? 'Open it' : 'Close it', () => { p.closed = !p.closed; renderInsp(); }, '');
    if (p.type === 'spdt') btn('Flip', () => { p.pos = p.pos ? 0 : 1; renderInsp(); }, '');
    if (p.type === 'fuse' && p.blown) btn('New fuse', () => { p.blown = false; p.heat = 0; renderInsp(); }, '');
    if ((p.type === 'led' || p.type === 'diode') && p.burnt) btn('New LED', () => { p.burnt = false; p.heat = 0; p.vd = 0; renderInsp(); }, '');
    if (p.type === 'capacitor' && ev) btn('Discharge', () => { p.vc = 0; });
    if (ed && p.type !== 'wire') btn('Rotate', () => rotate(p));
    if (ed && ['battery', 'led', 'diode', 'capacitor'].includes(p.type)) btn('Flip', () => flip(p));
    if (ed && opt.canDelete !== false) btn('Delete', () => remove(p));
    if (row.children.length) insp.append(row);
    updateReadings();
  }
  function updateReadings() {
    if (!selected || insp.hidden || !rdEl) return;
    const p = selected; const lines = [];
    if (p.type === 'battery') lines.push(['Pushes', fmt(p.V, 'V')], ['Terminals', fmt(p.vb - p.va, 'V')], ['Current', fmt(p.i, 'A')], ['Power out', fmt(-p.p, 'W')]);
    else if (p.type === 'voltmeter') lines.push(['Reads', fmt(p.v, 'V')]);
    else if (p.type === 'ammeter') lines.push(['Reads', fmt(p.i, 'A')]);
    else {
      lines.push(['Voltage', fmt(Math.abs(p.v), 'V')], ['Current', fmt(Math.abs(p.i), 'A')]);
      if (p.type !== 'wire' && p.type !== 'switch' && p.type !== 'spdt') lines.push(['Power', fmt(Math.max(0, p.p), 'W')]);
      if (p.type === 'bulb') lines.push(['Brightness', `${Math.round(Math.min(1.5, Math.max(0, p.p) / p.rated) * 100)}%`]);
      if (p.type === 'ldr') lines.push(['Resistance', fmt(ldrR(p.light), 'Ω')]);
      if (p.type === 'capacitor') lines.push(['Charge', fmt(Math.abs(p.C * p.v), 'C')]);
    }
    rdEl.innerHTML = lines.map(([a, b]) => `<span>${a}</span><b style="font-weight:500">${b}</b>`).join('');
    let w = '';
    if (p.type === 'fuse' && p.blown) w = 'Blown. The thin wire inside melted.';
    if ((p.type === 'led' || p.type === 'diode') && p.burnt) w = 'Burnt out. Too much current.';
    if (p.type === 'led' && !p.burnt && p.i > (p.imax || 0.03)) w = 'Over its current limit!';
    if (p.type === 'switch' && !p.closed) w = 'Open: no path for current.';
    warnEl.hidden = !w; warnEl.textContent = w;
  }

  let toastT = 0;
  function showToast(text) { toast.textContent = text; toast.style.opacity = '1'; clearTimeout(toastT); toastT = setTimeout(() => { toast.style.opacity = '0'; }, 1800); }

  // ---------- pointer ----------
  const local = (e) => { const r = cv.el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function tap(p) {
    if (p.type === 'switch') { p.closed = !p.closed; opt.onToggle && opt.onToggle(p, api); }
    if (p.type === 'spdt') { p.pos = p.pos ? 0 : 1; opt.onToggle && opt.onToggle(p, api); }
    select(p);
  }
  function startPlacing(type, btn) {
    placing = type; pal.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === btn));
    hint.textContent = `Tap the grid to place the ${NAMES[type].toLowerCase()}`;
  }
  function stopPlacing() { placing = null; ghost = null; if (pal) pal.querySelectorAll('button').forEach((x) => x.classList.remove('on')); hint.textContent = ''; }
  function placeAt(type, n) {
    const pts = fitInGrid(defaultPts(type, n));
    const p = add(type, pts, type === 'battery' && opt.newBattery ? opt.newBattery : {});
    if (type !== 'wire') select(p);
    return p;
  }
  if (pal) {
    pal.querySelectorAll('button').forEach((btn) => {
      const type = btn.dataset.t;
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        const d = { x: e.clientX, y: e.clientY, moved: false };
        const mv = (ev) => {
          if (Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 8) d.moved = true;
          if (!d.moved) return;
          const [x, y] = local(ev); const [gx, gy] = toGrid(x, y); const n = [Math.round(gx), Math.round(gy)];
          ghost = inGrid(n) && y > avail.y ? { type, pts: fitInGrid(defaultPts(type, n)) } : null;
        };
        const up = (ev) => {
          btn.removeEventListener('pointermove', mv); btn.removeEventListener('pointerup', up); btn.removeEventListener('pointercancel', up);
          if (!d.moved) { if (placing === type) stopPlacing(); else startPlacing(type, btn); return; }
          const [x, y] = local(ev); const [gx, gy] = toGrid(x, y); const n = [Math.round(gx), Math.round(gy)];
          ghost = null;
          if (ev.type === 'pointerup' && inGrid(n) && y > avail.y) { placeAt(type, n); stopPlacing(); }
        };
        btn.addEventListener('pointermove', mv); btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up);
      });
    });
  }

  cv.el.addEventListener('pointerdown', (e) => {
    const [x, y] = local(e); mouse = { x, y, type: e.pointerType };
    if (placing) {
      const [gx, gy] = toGrid(x, y); const n = [Math.round(gx), Math.round(gy)];
      if (inGrid(n)) placeAt(placing, n);
      stopPlacing(); return;
    }
    cv.el.setPointerCapture(e.pointerId);
    const ed = opt.editable; const tolN = Math.max(14, cell * 0.34);
    drag = { x, y, moved: false, mode: 'none' };
    if (ed && selected) {
      const j = selected.pts.findIndex((q) => { const [px, py] = P(q); return Math.hypot(px - x, py - y) < tolN; });
      if (j >= 0) { drag = { ...drag, mode: 'end', part: selected, j }; return; }
    }
    const body = hitBody(x, y, false);
    if (body) { drag = { ...drag, mode: 'body', part: body, start: body.pts.map((q) => [...q]), g0: toGrid(x, y) }; return; }
    const n = ed ? nearNode(x, y) : null;
    if (n) { drag = { ...drag, mode: 'node', node: n }; return; }
    const w = hitBody(x, y, true);
    if (w) { drag = { ...drag, mode: 'body', part: w, start: w.pts.map((q) => [...q]), g0: toGrid(x, y) }; }
  }, { signal: ctx.signal });
  cv.el.addEventListener('pointermove', (e) => {
    const [x, y] = local(e); mouse = { x, y, type: e.pointerType };
    if (placing) { const [gx, gy] = toGrid(x, y); const n = [Math.round(gx), Math.round(gy)]; ghost = inGrid(n) ? { type: placing, pts: fitInGrid(defaultPts(placing, n)) } : null; }
    if (!drag) {
      hover = hitBody(x, y, false) || hitBody(x, y, true);
      hoverNode = hover ? null : nearNode(x, y, Math.max(10, cell * 0.22));
      cv.el.style.cursor = placing ? 'copy' : hover ? (hover.type === 'switch' || hover.type === 'spdt' ? 'pointer' : opt.editable ? 'grab' : 'pointer') : (opt.editable && nearNode(x, y) ? 'crosshair' : 'default');
      return;
    }
    if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) > 6) drag.moved = true;
    if (!drag.moved || !opt.editable) return;
    if (drag.mode === 'end') {
      const [gx, gy] = toGrid(x, y); const n = clampPt([Math.round(gx), Math.round(gy)]);
      const other = drag.part.pts.some((q, k) => k !== drag.j && q[0] === n[0] && q[1] === n[1]);
      if (!other) drag.part.pts[drag.j] = n;
    } else if (drag.mode === 'body') {
      const [gx, gy] = toGrid(x, y); const dx = Math.round(gx - drag.g0[0]); const dy = Math.round(gy - drag.g0[1]);
      drag.part.pts = fitInGrid(drag.start.map((q) => [q[0] + dx, q[1] + dy]));
    } else if (drag.mode === 'node') {
      const [gx, gy] = toGrid(x, y); drag.to = clampPt([Math.round(gx), Math.round(gy)]);
    }
  }, { signal: ctx.signal });
  const endDrag = (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    if (e.type === 'pointercancel') { if (d.mode === 'body' && d.moved) changed(); return; }
    if (d.mode === 'body') { if (!d.moved) tap(d.part); else changed(); }
    else if (d.mode === 'end') { if (d.moved) changed(); }
    else if (d.mode === 'node') {
      if (d.moved && d.to && (d.to[0] !== d.node[0] || d.to[1] !== d.node[1])) { add('wire', [d.node, d.to]); select(null); }
      else { const w = hitBody(d.x, d.y, true); if (w) tap(w); else select(null); }
    } else select(null);
  };
  cv.el.addEventListener('pointerup', endDrag, { signal: ctx.signal });
  cv.el.addEventListener('pointercancel', endDrag, { signal: ctx.signal });
  cv.el.addEventListener('pointerleave', () => { if (!drag) { hover = null; hoverNode = null; mouse = null; } }, { signal: ctx.signal });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === 'Escape') { stopPlacing(); select(null); }
    if (!selected || !opt.editable) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && opt.canDelete !== false) { e.preventDefault(); remove(selected); }
    if (e.key === 'r' || e.key === 'R') { if (selected.type !== 'wire') rotate(selected); }
  }, { signal: ctx.signal });

  // ---------- drawing ----------
  const FONT = '500 11px "DM Mono", ui-monospace, monospace';
  const WIRE = '#85857F';
  const BODY = '#E8E8E3';
  let vmax = 1;
  const vcol = (v) => mixHex(COL.c5, COL.c4, Math.max(0, Math.min(1, v / vmax)));
  const lw = () => Math.max(1.6, Math.min(3, cell * 0.055));
  function speed(i) {
    const vm = 6.5;
    const k = opt.dotScale === 'auto' ? 2.2 / autoRef : opt.dotScale;
    return vm * Math.tanh((i * k) / vm);
  }
  function isOpenPart(p) { return (p.type === 'switch' && !p.closed) || (p.type === 'fuse' && p.blown) || ((p.type === 'led' || p.type === 'diode') && p.burnt); }

  function strokeSeg(A, B, color, width) { g.strokeStyle = color; g.lineWidth = width; g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); }
  function leadColor(p, which) { return opt.vcolors ? vcol(which ? p.vb : p.va) : WIRE; }

  function drawGlow(p) {
    if (p.type === 'bulb') {
      const br = Math.min(1.5, Math.max(0, p.p) / p.rated); if (br < 0.01) return;
      const A = P(p.pts[0]); const B = P(p.pts[1]); const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      const r = cell * (0.5 + 1.6 * Math.sqrt(br));
      const gr = g.createRadialGradient(M[0], M[1], 0, M[0], M[1], r);
      gr.addColorStop(0, `rgba(255,214,128,${0.75 * Math.min(1, br)})`); gr.addColorStop(0.35, `rgba(255,190,90,${0.28 * Math.min(1, br)})`); gr.addColorStop(1, 'rgba(255,170,60,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(M[0], M[1], r, 0, Math.PI * 2); g.fill();
    }
    if (p.type === 'led' && !p.burnt) {
      const br = Math.min(1.4, Math.max(0, p.i) / 0.02); if (br < 0.02) return;
      const A = P(p.pts[0]); const B = P(p.pts[1]); const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      const c = (LED_COLORS[p.color] || LED_COLORS.red).rgb; const r = cell * (0.4 + 1.1 * Math.sqrt(br));
      const gr = g.createRadialGradient(M[0], M[1], 0, M[0], M[1], r);
      gr.addColorStop(0, hexA(c, 0.85 * Math.min(1, br))); gr.addColorStop(0.4, hexA(c, 0.25 * Math.min(1, br))); gr.addColorStop(1, hexA(c, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(M[0], M[1], r, 0, Math.PI * 2); g.fill();
    }
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

  function drawPart(p, alpha = 1) {
    g.save(); g.globalAlpha = alpha;
    const W = lw();
    if (p.type === 'spdt') { drawSpdt(p, W); g.restore(); return; }
    const A = P(p.pts[0]); const B = P(p.pts[1]);
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; const u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
    const bl = bodyLen(p, L); const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    const s1 = [M[0] - u[0] * bl / 2, M[1] - u[1] * bl / 2]; const s2 = [M[0] + u[0] * bl / 2, M[1] + u[1] * bl / 2];
    if (p.type === 'wire') {
      if (Math.abs(p.i) > opt.hotA) { // a wire carrying a huge current gets hot
        const k = Math.min(1, (Math.abs(p.i) - opt.hotA) / (opt.hotA * 2));
        g.save(); g.shadowColor = 'rgba(255,90,40,.9)'; g.shadowBlur = 10 * k; strokeSeg(A, B, `rgba(255,${Math.round(150 - 90 * k)},60,${0.5 + 0.5 * k})`, W * (1.6 + k)); g.restore();
      } else if (opt.vcolors && p.va != null) {
        const gr = g.createLinearGradient(A[0], A[1], B[0], B[1]); gr.addColorStop(0, vcol(p.va)); gr.addColorStop(1, vcol(p.vb));
        strokeSeg(A, B, gr, W);
      } else strokeSeg(A, B, WIRE, W);
      g.restore(); return;
    }
    strokeSeg(A, s1, leadColor(p, 0), W); strokeSeg(s2, B, leadColor(p, 1), W);
    g.translate(M[0], M[1]); g.rotate(Math.atan2(u[1], u[0]));
    const hl = bl / 2; const s = cell;
    g.strokeStyle = BODY; g.fillStyle = BODY; g.lineWidth = W; g.lineJoin = 'round'; g.lineCap = 'round';
    switch (p.type) {
      case 'resistor': {
        const n = 6; const amp = s * 0.17; g.beginPath(); g.moveTo(-hl, 0);
        for (let k = 0; k < n; k++) g.lineTo(-hl + (k + 0.5) * (2 * hl / n), (k % 2 ? 1 : -1) * amp);
        g.lineTo(hl, 0); g.stroke(); break;
      }
      case 'ldr': {
        g.strokeRect(-hl, -s * 0.15, 2 * hl, s * 0.3);
        g.fillStyle = `rgba(251,191,36,${0.15 + 0.5 * p.light})`; g.fillRect(-hl + 2, -s * 0.15 + 2, 2 * hl - 4, s * 0.3 - 4);
        g.strokeStyle = COL.c2; g.lineWidth = 1.3;
        for (const dx of [-0.2, 0.15]) { g.beginPath(); g.moveTo(dx * s - s * 0.2, -s * 0.55); g.lineTo(dx * s, -s * 0.24); g.stroke(); g.beginPath(); g.moveTo(dx * s - 4, -s * 0.24 - 3); g.lineTo(dx * s, -s * 0.24); g.lineTo(dx * s - 1, -s * 0.24 - 6); g.stroke(); }
        break;
      }
      case 'bulb': {
        const r = Math.min(hl, s * 0.4); const br = Math.min(1, Math.max(0, p.p) / p.rated);
        g.fillStyle = `rgba(255,214,128,${0.08 + 0.55 * br})`; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = br > 0.05 ? mixHex('#E8E8E3', '#FFD27A', br) : BODY; g.stroke();
        g.beginPath(); g.moveTo(-r, 0); g.lineTo(-r * 0.45, 0);
        g.bezierCurveTo(-r * 0.3, -r * 0.8, r * 0.3, -r * 0.8, r * 0.45, 0); g.lineTo(r, 0);
        g.strokeStyle = br > 0.05 ? mixHex('#E8E8E3', '#FFF3C4', br) : BODY; g.lineWidth = W * 0.8; g.stroke();
        break;
      }
      case 'battery': {
        const hs = s * 0.36; const hn = s * 0.18;
        g.lineWidth = W * 2.4; g.beginPath(); g.moveTo(-hl, -hn); g.lineTo(-hl, hn); g.stroke();
        g.lineWidth = W; g.beginPath(); g.moveTo(hl, -hs); g.lineTo(hl, hs); g.stroke();
        break;
      }
      case 'capacitor': {
        const hs = s * 0.32; const q = Math.max(-1, Math.min(1, (p.v || 0) / Math.max(1, vmax)));
        g.lineWidth = W * 1.4;
        g.strokeStyle = q > 0.02 ? mixHex('#E8E8E3', COL.c4, Math.abs(q)) : q < -0.02 ? mixHex('#E8E8E3', COL.c5, Math.abs(q)) : BODY;
        g.beginPath(); g.moveTo(-hl, -hs); g.lineTo(-hl, hs); g.stroke();
        g.strokeStyle = q < -0.02 ? mixHex('#E8E8E3', COL.c4, Math.abs(q)) : q > 0.02 ? mixHex('#E8E8E3', COL.c5, Math.abs(q)) : BODY;
        g.beginPath(); g.moveTo(hl, -hs); g.lineTo(hl, hs); g.stroke();
        // charge marks: + on the higher plate, - on the lower
        const nm = Math.round(Math.abs(q) * 4);
        g.font = FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (let k = 0; k < nm; k++) {
          const yy = -hs + (k + 0.5) * (2 * hs / 4);
          g.fillStyle = COL.c4; g.fillText('+', (q > 0 ? -hl : hl) + (q > 0 ? -7 : 7), yy);
          g.fillStyle = COL.c5; g.fillText('-', (q > 0 ? hl : -hl) + (q > 0 ? 7 : -7), yy);
        }
        break;
      }
      case 'inductor': {
        const n = 4; const w = 2 * hl / n; g.beginPath(); g.moveTo(-hl, 0);
        for (let k = 0; k < n; k++) g.arc(-hl + w * (k + 0.5), 0, w / 2, Math.PI, 0, false);
        g.stroke(); break;
      }
      case 'switch': {
        const r = Math.max(2.5, s * 0.06);
        g.beginPath(); g.arc(-hl, 0, r, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(hl, 0, r, 0, Math.PI * 2); g.fill();
        const ang = p.closed ? 0 : -0.55; g.strokeStyle = p.closed ? BODY : COL.c2;
        g.beginPath(); g.moveTo(-hl, 0); g.lineTo(-hl + Math.cos(ang) * 2 * hl, Math.sin(ang) * 2 * hl); g.stroke();
        break;
      }
      case 'fuse': {
        const hh = s * 0.15; g.lineWidth = W * 0.8; g.strokeRect(-hl, -hh, 2 * hl, 2 * hh);
        if (p.blown) {
          g.strokeStyle = COL.c4; g.beginPath(); g.moveTo(-hl, 0); g.lineTo(-hl * 0.25, hh * 0.3); g.moveTo(hl, 0); g.lineTo(hl * 0.25, -hh * 0.3); g.stroke();
          g.fillStyle = 'rgba(80,60,50,.6)'; g.beginPath(); g.ellipse(0, 0, hl * 0.3, hh * 0.7, 0, 0, Math.PI * 2); g.fill();
        } else {
          const heat = Math.min(1, (p.heat || 0) / 0.25 + Math.max(0, Math.abs(p.i || 0) / (p.rating || 1) - 0.5));
          g.strokeStyle = mixHex('#E8E8E3', '#FF8A3D', Math.min(1, heat)); g.beginPath(); g.moveTo(-hl, 0);
          for (let k = 0; k <= 12; k++) g.lineTo(-hl + (k / 12) * 2 * hl, Math.sin(k * 1.2) * hh * 0.35); g.stroke();
        }
        break;
      }
      case 'ammeter': case 'voltmeter': {
        const r = Math.min(hl, s * 0.38);
        g.fillStyle = 'rgba(20,20,20,.9)'; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
        g.strokeStyle = p.type === 'ammeter' ? COL.c1 : COL.c3; g.stroke();
        break;
      }
      case 'led': case 'diode': {
        const t = Math.min(hl, s * 0.24); const hh = s * 0.24;
        const c = p.type === 'led' ? (LED_COLORS[p.color] || LED_COLORS.red).rgb : BODY;
        const on = p.type === 'led' && !p.burnt && p.i > 0.0005;
        g.fillStyle = p.burnt ? '#2a2a2a' : on ? c : hexA(c === BODY ? '#E8E8E3' : c, 0.25);
        g.strokeStyle = p.burnt ? '#6a6a66' : p.type === 'led' ? c : BODY;
        g.beginPath(); g.moveTo(-t, -hh); g.lineTo(-t, hh); g.lineTo(t, 0); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(t, -hh); g.lineTo(t, hh); g.stroke();
        if (p.type === 'led') {
          g.lineWidth = 1.3;
          for (const dx of [-0.05, 0.12]) { const x0 = dx * s; g.beginPath(); g.moveTo(x0, -hh - 2); g.lineTo(x0 + s * 0.14, -hh - s * 0.16); g.stroke(); g.beginPath(); g.moveTo(x0 + s * 0.14 - 4, -hh - s * 0.16); g.lineTo(x0 + s * 0.14, -hh - s * 0.16); g.lineTo(x0 + s * 0.14, -hh - s * 0.16 + 4); g.stroke(); }
        }
        if (p.burnt) { g.strokeStyle = COL.c4; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-t * 0.6, -hh * 0.6); g.lineTo(t * 0.6, hh * 0.6); g.moveTo(-t * 0.6, hh * 0.6); g.lineTo(t * 0.6, -hh * 0.6); g.stroke(); }
        break;
      }
      default: break;
    }
    g.restore();
    // upright text inside meters and battery signs
    if (p.type === 'ammeter' || p.type === 'voltmeter') {
      g.save(); g.globalAlpha = alpha; g.fillStyle = p.type === 'ammeter' ? COL.c1 : COL.c3; g.font = `700 ${Math.round(Math.max(11, cell * 0.36))}px Rajdhani, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(p.type === 'ammeter' ? 'A' : 'V', M[0], M[1] + 1); g.restore();
    }
    if (p.type === 'battery') {
      g.save(); g.globalAlpha = alpha; g.fillStyle = COL.c4; g.font = FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
      const nrm = [-u[1], u[0]]; const off = cell * 0.36;
      const side = nrm[1] > 0 || (nrm[1] === 0 && nrm[0] > 0) ? -1 : 1;
      g.fillText('+', M[0] + u[0] * (bl / 2 + 7) + nrm[0] * off * side, M[1] + u[1] * (bl / 2 + 7) + nrm[1] * off * side);
      g.fillStyle = COL.c5; g.fillText('-', M[0] - u[0] * (bl / 2 + 7) + nrm[0] * off * side, M[1] - u[1] * (bl / 2 + 7) + nrm[1] * off * side);
      g.restore();
    }
  }
  function drawSpdt(p, W) {
    const G = spdtGeo(p); const c = P(G.c); const pv = P(G.piv); const t0 = P(G.t0); const t1 = P(G.t1); const k0 = P(G.k0); const k1 = P(G.k1);
    strokeSeg(c, pv, leadColor(p, 0), W); strokeSeg(t0, k0, opt.vcolors ? vcol(V.get(key(G.t0)) || 0) : WIRE, W); strokeSeg(t1, k1, opt.vcolors ? vcol(V.get(key(G.t1)) || 0) : WIRE, W);
    const r = Math.max(2.5, cell * 0.06); g.fillStyle = BODY;
    for (const q of [pv, k0, k1]) { g.beginPath(); g.arc(q[0], q[1], r, 0, Math.PI * 2); g.fill(); }
    const K = p.pos ? k1 : k0; strokeSeg(pv, K, BODY, W);
  }

  // Dot path for a part, as a list of px segments (skipping the body of components)
  function dotSegs(p) {
    if (p.type === 'spdt') {
      const G = spdtGeo(p); const t = p.pos ? G.t1 : G.t0; const k = p.pos ? G.k1 : G.k0;
      return [[P(G.c), P(G.piv)], [P(G.piv), P(k)], [P(k), P(t)]];
    }
    const A = P(p.pts[0]); const B = P(p.pts[1]);
    if (p.type === 'wire') return [[A, B]];
    const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; const u = [(B[0] - A[0]) / L, (B[1] - A[1]) / L];
    const bl = bodyLen(p, L) + (p.type === 'battery' || p.type === 'capacitor' ? 0 : 0);
    const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    return [[A, [M[0] - u[0] * bl / 2, M[1] - u[1] * bl / 2]], null, [[M[0] + u[0] * bl / 2, M[1] + u[1] * bl / 2], B]].map((x, k) => x || { gap: bl, k });
  }
  function drawDots(p) {
    if (isOpenPart(p) || p.type === 'voltmeter') return;
    const segs = dotSegs(p); const sp = cell * 0.5;
    const phase = (opt.flow === 'electron' ? -1 : 1) * (p.ph || 0) * cell;
    let s0 = ((phase % sp) + sp) % sp; let acc = 0;
    const rd = Math.max(1.8, Math.min(3.6, cell * 0.075));
    g.fillStyle = opt.flow === 'electron' ? COL.c5 : COL.c2;
    g.beginPath();
    for (const sg of segs) {
      if (sg.gap != null) { acc += sg.gap; continue; }
      const [A, B] = sg; const L = Math.hypot(B[0] - A[0], B[1] - A[1]); if (L < 0.5) continue;
      for (let d = s0 + Math.ceil((acc - s0) / sp) * sp; d < acc + L; d += sp) {
        if (d < acc) continue; const t = (d - acc) / L;
        const x = A[0] + (B[0] - A[0]) * t; const y = A[1] + (B[1] - A[1]) * t;
        g.moveTo(x + rd, y); g.arc(x, y, rd, 0, Math.PI * 2);
      }
      acc += L;
    }
    g.fill();
    s0 = 0;
  }

  function labelFor(p) {
    if (p.type === 'ammeter') return fmt(p.i, 'A');
    if (p.type === 'voltmeter') return fmt(p.v, 'V');
    if (!opt.labels) return p.label || '';
    const pre = p.label ? `${p.label} ` : '';
    switch (p.type) {
      case 'battery': return `${pre}${fmt(p.V, 'V')}`;
      case 'resistor': return `${pre}${fmt(p.R, 'Ω')}`;
      case 'bulb': return `${pre}${fmt(p.R, 'Ω')}`;
      case 'capacitor': return `${pre}${fmt(p.C, 'F')}`;
      case 'inductor': return `${pre}${fmt(p.L, 'H')}`;
      case 'fuse': return `${pre}${fmt(p.rating, 'A')}${p.blown ? ' blown' : ''}`;
      case 'ldr': return `${pre}${fmt(ldrR(p.light), 'Ω')}`;
      case 'led': return `${pre}${p.burnt ? 'burnt' : ''}`.trim();
      default: return p.label || '';
    }
  }
  function drawLabel(p) {
    const txt = labelFor(p); if (!txt || p.type === 'wire') return;
    let M; let nrm;
    if (p.type === 'spdt') { const G = spdtGeo(p); M = P(G.piv); nrm = [0, -1]; M = [M[0] - cell * 0.1, M[1] + cell * 0.55]; }
    else {
      const A = P(p.pts[0]); const B = P(p.pts[1]); M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
      const L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1; nrm = [-(B[1] - A[1]) / L, (B[0] - A[0]) / L];
      if (nrm[1] > 0.01 || (Math.abs(nrm[1]) <= 0.01 && nrm[0] > 0)) nrm = [-nrm[0], -nrm[1]];
      const vert = Math.abs(nrm[0]) > 0.7;
      const off = (p.type === 'ammeter' || p.type === 'voltmeter') ? cell * 0.62 : p.type === 'battery' ? cell * 0.62 : cell * 0.5;
      if (p.type === 'ammeter' || p.type === 'voltmeter') nrm = [-nrm[0], -nrm[1]];
      M = [M[0] + nrm[0] * off, M[1] + nrm[1] * off];
      g.textAlign = vert ? (nrm[0] < 0 ? 'right' : 'left') : 'center';
    }
    g.font = (p.type === 'ammeter' || p.type === 'voltmeter') ? `500 ${Math.max(11, Math.min(14, cell * 0.28))}px "DM Mono", monospace` : FONT;
    g.textBaseline = 'middle';
    const meter = p.type === 'ammeter' || p.type === 'voltmeter';
    if (meter) {
      const w = g.measureText(txt).width + 10; const al = g.textAlign; const x0 = al === 'center' ? M[0] - w / 2 : al === 'right' ? M[0] - w + 5 : M[0] - 5;
      g.fillStyle = 'rgba(10,10,10,.85)'; g.fillRect(x0, M[1] - 9, w, 18);
      g.fillStyle = p.type === 'ammeter' ? COL.c1 : COL.c3;
    } else g.fillStyle = p.burnt || p.blown ? COL.c4 : COL.muted;
    g.fillText(txt, M[0], M[1]);
    g.textAlign = 'center';
  }

  function drawTooltip() {
    if (!mouse || mouse.type !== 'mouse' || drag || placing) return;
    let lines = null;
    if (hover) {
      const p = hover;
      if (p.type === 'wire') lines = ['Wire', `I ${fmt(Math.abs(p.i), 'A')}`];
      else if (p.type === 'battery') lines = [`${p.label ? `${p.label} ` : ''}Battery ${fmt(p.V, 'V')}`, `I ${fmt(p.i, 'A')}`, `P ${fmt(-p.p, 'W')} out`];
      else lines = [`${p.label ? `${p.label} ` : ''}${NAMES[p.type]}`, `V ${fmt(Math.abs(p.v), 'V')}`, `I ${fmt(Math.abs(p.i), 'A')}`].concat(['wire', 'switch', 'spdt', 'ammeter', 'voltmeter'].includes(p.type) ? [] : [`P ${fmt(Math.max(0, p.p), 'W')}`]);
    } else if (hoverNode && V.has(key(hoverNode))) {
      lines = ['Node', `${fmt(V.get(key(hoverNode)), 'V')} vs battery -`];
    }
    if (!lines) return;
    g.font = FONT; const w = Math.max(...lines.map((l) => g.measureText(l).width)) + 16; const hh = lines.length * 15 + 10;
    let x = mouse.x + 14; let y = mouse.y + 14; if (x + w > cv.w - 4) x = mouse.x - w - 10; if (y + hh > cv.h - 4) y = mouse.y - hh - 10;
    g.fillStyle = 'rgba(20,20,20,.94)'; g.strokeStyle = '#3A3A38'; g.lineWidth = 1;
    g.beginPath(); g.roundRect(x, y, w, hh, 7); g.fill(); g.stroke();
    g.textAlign = 'left'; g.textBaseline = 'top';
    lines.forEach((l, k) => { g.fillStyle = k ? '#E8E8E3' : COL.muted; g.fillText(l, x + 8, y + 6 + k * 15); });
  }

  function draw(t) {
    const W = cv.w; const H = cv.h; g.clearRect(0, 0, W, H);
    // grid
    g.fillStyle = '#2E2E2C';
    const gr = Math.max(1, cell * 0.03);
    for (let x = 0; x <= cols; x++) for (let y = 0; y <= rows; y++) { g.beginPath(); g.arc(ox + x * cell, oy + y * cell, gr, 0, Math.PI * 2); g.fill(); }
    // voltage range
    vmax = 0.5; for (const v of V.values()) vmax = Math.max(vmax, v);
    // glows
    g.save(); g.globalCompositeOperation = 'lighter'; for (const p of parts) drawGlow(p); g.restore();
    // selection halo
    if (selected && parts.includes(selected)) {
      g.save(); g.strokeStyle = 'rgba(94,234,212,.28)'; g.lineWidth = Math.max(10, cell * 0.3); g.lineCap = 'round';
      const pts = selected.type === 'spdt' ? [P(selected.pts[0]), P(spdtGeo(selected).piv)] : selected.pts.map(P);
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) g.lineTo(q[0], q[1]); g.stroke(); g.restore();
    }
    for (const p of parts) if (p.type === 'wire') drawPart(p);
    for (const p of parts) if (p.type !== 'wire') drawPart(p);
    // terminals: junctions and loose ends
    const cnt = new Map(); for (const p of parts) for (const q of p.pts) cnt.set(key(q), (cnt.get(key(q)) || 0) + 1);
    const tr = Math.max(2.4, cell * 0.07);
    for (const [k, n] of cnt) {
      const [x, y] = k.split(',').map(Number); const [px, py] = P([x, y]);
      if (n >= 3) { g.fillStyle = '#B5B5AE'; g.beginPath(); g.arc(px, py, tr, 0, Math.PI * 2); g.fill(); }
      else if (n === 1) { g.strokeStyle = COL.c2; g.lineWidth = 1.4; g.beginPath(); g.arc(px, py, tr + 1, 0, Math.PI * 2); g.stroke(); }
    }
    for (const p of parts) drawDots(p);
    for (const p of parts) drawLabel(p);
    // handles on the selected part
    if (selected && opt.editable && parts.includes(selected)) {
      for (const q of selected.pts) { const [px, py] = P(q); g.fillStyle = COL.surface; g.strokeStyle = COL.teal; g.lineWidth = 2; g.beginPath(); g.arc(px, py, Math.max(6, cell * 0.14), 0, Math.PI * 2); g.fill(); g.stroke(); }
    }
    // wire being drawn
    if (drag && drag.mode === 'node' && drag.moved && drag.to) {
      const A = P(drag.node); const B = P(drag.to);
      g.setLineDash([6, 5]); strokeSeg(A, B, COL.teal, lw()); g.setLineDash([]);
      g.fillStyle = COL.teal; g.beginPath(); g.arc(B[0], B[1], 4, 0, Math.PI * 2); g.fill();
    }
    if (ghost) { const gp = makePart(ghost.type, ghost.pts, { id: 'ghost' }); drawPart(gp, 0.5); }
    // flashes for blown fuses and burnt LEDs
    flashes = flashes.filter((f) => t - f.t0 < 0.8);
    for (const f of flashes) {
      const k = (t - f.t0) / 0.8; const [px, py] = f.at;
      g.strokeStyle = `rgba(255,140,60,${1 - k})`; g.lineWidth = 3; g.beginPath(); g.arc(px, py, cell * (0.3 + k * 1.4), 0, Math.PI * 2); g.stroke();
    }
    if (!lastOk) { g.fillStyle = COL.c4; g.font = FONT; g.textAlign = 'center'; g.fillText('The solver could not settle this circuit. Check for loops of batteries.', W / 2, rect.y + 12); }
    opt.draw && opt.draw(g, W, H, t, api);
    drawTooltip();
  }

  // ---------- run ----------
  let readT = 0;
  ctx.loop((t, dt) => {
    if (!paused && dt > 0) {
      const dts = dt * opt.timeScale;
      const reactive = parts.some((p) => p.type === 'capacitor' || p.type === 'inductor');
      const n = reactive ? Math.min(80, Math.max(1, Math.ceil(dts / opt.hmax))) : 1;
      const h = dts / n;
      for (let k = 0; k < n; k++) {
        const r = step(parts, h); lastOk = r.ok;
        if (r.ok) V = r.V;
        simT += h;
        for (const ev of r.events) {
          const p = parts.find((x) => x.id === ev.id);
          if (p) {
            const A = P(p.pts[0]); const B = P(p.pts[1]); flashes.push({ t0: t, at: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2] });
            showToast(ev.type === 'blow' ? 'The fuse blew' : 'The LED burnt out');
            if (selected === p) renderInsp();
          }
          opt.onEvent && opt.onEvent(ev, api);
        }
        opt.onStep && opt.onStep(api, h);
      }
    }
    // dot phases and auto scale
    let imax = 1e-6;
    for (const p of parts) { if (p.type !== 'voltmeter' && isFinite(p.i)) imax = Math.max(imax, Math.abs(p.i)); }
    autoRef = Math.exp(lerp(Math.log(autoRef), Math.log(imax), Math.min(1, dt * 1.5)));
    const motion = reduced ? 0.6 : 1;
    for (const p of parts) p.ph = ((p.ph || 0) + speed(p.i || 0) * dt * motion) % 1000;
    draw(t);
    readT += dt; if (readT > 0.12) { readT = 0; updateReadings(); }
  });

  const api = {
    get parts() { return parts; },
    get time() { return simT; },
    set time(v) { simT = v; },
    get paused() { return paused; },
    set paused(v) { paused = v; },
    get rect() { return rect; },
    get avail() { return avail; },
    get cell() { return cell; },
    get selected() { return selected; },
    opt, P, fmt, dock, segDock, select, changed, add, remove, rotate, flip, showToast,
    part: (id) => parts.find((p) => p.id === id),
    V: (pt) => V.get(key(pt)) || 0,
    load: (c) => load(c),
    reset: () => { if (source) load(source, true); opt.onReset && opt.onReset(api); },
    serialize: () => ({ cols, rows, parts: serialize(parts) }),
    refit: fit,
    hint: (text) => { hint.textContent = text || ''; },
  };
  if (opt.circuit) load(opt.circuit);
  return api;
}

// ---------- small shared helpers for chapters ----------

// "Try this" list whose items tick themselves when check() becomes true.
export function tasks(ctx, items, title) {
  const box = ctx.h(`<div class="card try">${title ? `<p>${title}</p>` : ''}<ol class="cl-tasks" style="list-style:none;padding:0;margin:0;display:grid;gap:7px"></ol><p class="hint cl-tdone" hidden>All done. Nice work.</p></div>`);
  const ol = box.querySelector('ol');
  const rows = items.map((it) => {
    const li = ctx.h(`<li style="display:grid;grid-template-columns:18px 1fr;gap:8px;align-items:start"><span class="cl-box" style="width:16px;height:16px;border:1.5px solid var(--border-strong);border-radius:4px;margin-top:3px;display:grid;place-items:center;font:700 11px var(--f-mono);color:var(--r-void)"></span><span>${it.text}</span></li>`);
    ol.append(li); return { it, li, done: false };
  });
  let tick = 0;
  ctx.loop((t, dt) => {
    tick += dt; if (tick < 0.2) return; tick = 0;
    let all = true;
    for (const r of rows) {
      if (!r.done && r.it.check) { try { if (r.it.check()) { r.done = true; const b = r.li.querySelector('.cl-box'); b.style.background = 'var(--c2)'; b.style.borderColor = 'var(--c2)'; b.textContent = '✓'; r.li.style.color = 'var(--muted)'; } } catch { /* part removed */ } }
      if (!r.done && r.it.check) all = false;
    }
    box.querySelector('.cl-tdone').hidden = !all;
  });
  return box;
}

// Simple line plot. series: [{ data: [[x, y], ...], color, width, dash }]
export function plot(g, r, { xmin, xmax, ymin, ymax, series, xlabel, ylabel, xticks = [], yticks = [], colors }) {
  const C = colors;
  const X = (x) => r.x + ((x - xmin) / (xmax - xmin)) * r.w;
  const Y = (y) => r.y + r.h - ((y - ymin) / (ymax - ymin)) * r.h;
  g.save();
  g.fillStyle = 'rgba(20,20,20,.6)'; g.strokeStyle = '#2A2A2A'; g.lineWidth = 1;
  g.beginPath(); g.roundRect(r.x - 8, r.y - 8, r.w + 16, r.h + 16, 10); g.fill(); g.stroke();
  g.font = '500 10.5px "DM Mono", monospace'; g.fillStyle = C.muted; g.strokeStyle = '#2E2E2C';
  for (const [v, l] of yticks) { const y = Y(v); g.beginPath(); g.moveTo(r.x, y); g.lineTo(r.x + r.w, y); g.stroke(); g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(l, r.x + 2, y - 2); }
  for (const [v, l] of xticks) { const x = X(v); g.beginPath(); g.moveTo(x, r.y); g.lineTo(x, r.y + r.h); g.stroke(); g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(l, x, r.y + r.h + 3); }
  g.strokeStyle = '#5A5A55'; g.beginPath(); g.moveTo(r.x, r.y); g.lineTo(r.x, r.y + r.h); g.lineTo(r.x + r.w, r.y + r.h); g.stroke();
  g.beginPath(); g.rect(r.x, r.y - 4, r.w, r.h + 8); g.clip();
  for (const s of series) {
    if (!s.data.length) continue;
    g.strokeStyle = s.color; g.lineWidth = s.width || 2; g.setLineDash(s.dash || []);
    g.beginPath(); s.data.forEach(([x, y], k) => (k ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.stroke();
  }
  g.setLineDash([]);
  g.restore();
  g.save(); g.font = '500 10.5px "DM Mono", monospace'; g.fillStyle = C.muted;
  if (ylabel) { g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(ylabel, r.x, r.y - 10); }
  if (xlabel) { g.textAlign = 'right'; g.textBaseline = 'top'; g.fillText(xlabel, r.x + r.w, r.y + r.h + 14); }
  g.restore();
  return { X, Y };
}

// Split the free stage area into the circuit and a side area for a chapter's own drawing.
export function split(avail, frac = 0.42, min = 220) {
  const narrow = avail.w < 640;
  if (narrow) {
    const hh = Math.max(min * 0.6, avail.h * frac);
    return { circuit: { x: avail.x, y: avail.y, w: avail.w, h: avail.h - hh - 8 }, side: { x: avail.x + 12, y: avail.y + avail.h - hh + 4, w: avail.w - 24, h: hh - 8 }, narrow };
  }
  const ww = Math.max(min, avail.w * frac);
  return { circuit: { x: avail.x, y: avail.y, w: avail.w - ww - 10, h: avail.h }, side: { x: avail.x + avail.w - ww, y: avail.y + 10, w: ww - 14, h: avail.h - 20 }, narrow };
}
