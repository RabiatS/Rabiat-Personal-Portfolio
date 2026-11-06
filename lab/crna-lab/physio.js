// CRNA Lab respiratory models and plot helpers. Used by the physiology and pathophysiology chapters (re-exported from shared.js).
// All models are textbook simplifications: one compartment lung mechanics, the Hill equation for oxygen binding,
// the alveolar gas and shunt equations, and a simple oxygen store model for apnea.

export const PATM = 760; export const PH2O = 47;
export const HILL_N = 2.7; export const P50_STD = 26.8;

// Oxygen hemoglobin dissociation (Hill equation), PO2 in mmHg, result 0..1
export const hillSat = (po2, p50 = P50_STD, n = HILL_N) => (po2 <= 0 ? 0 : 1 / (1 + Math.pow(p50 / po2, n)));
export const hillPO2 = (s, p50 = P50_STD, n = HILL_N) => p50 * Math.pow(s / (1 - s), 1 / n);

// P50 shift (Severinghaus style factors for temperature, pH and PCO2; 2,3-DPG from a published fit, about 0.8 mmHg per mmol/L)
export function p50For({ temp = 37, pH = 7.4, pco2 = 40, dpg = 4.65 } = {}) {
  const lg = 0.024 * (temp - 37) + 0.40 * (7.4 - pH) + 0.06 * Math.log10(Math.max(5, pco2) / 40);
  const d = (dpg - 4.65) * 1e-3;
  return P50_STD * Math.pow(10, lg) + 795.63 * d - 19660.89 * d * d;
}

// Alveolar gas equation (mmHg)
export const alveolarO2 = (fio2, paco2 = 40, rq = 0.8, patm = PATM) => fio2 * (patm - PH2O) - paco2 / rq;
// Oxygen content (mL O2 per dL blood)
export const o2Content = (po2, hb = 15, p50 = P50_STD) => 1.34 * hb * hillSat(po2, p50) + 0.003 * po2;
export function po2FromContent(c, hb = 15, p50 = P50_STD) {
  let lo = 0.5; let hi = 700;
  if (o2Content(hi, hb, p50) < c) return hi;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (o2Content(m, hb, p50) < c) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
// Arterial PO2 with a true shunt fraction s, fixed arteriovenous content difference avd (mL/dL)
export function shuntPaO2(fio2, s, { hb = 15, paco2 = 40, avd = 5 } = {}) {
  const pA = Math.max(1, alveolarO2(fio2, paco2));
  const cc = o2Content(pA, hb);
  const ca = cc - (avd * s) / Math.max(1e-6, 1 - s);
  return { pA, pa: po2FromContent(ca, hb), ca, cc };
}

// Volume controlled ventilation of one compartment (C in mL/cmH2O, R in cmH2O/L/s, flow in L/min)
// Inspiration at constant flow, passive exponential expiration. Iterates breaths until end expiratory volume is steady (auto PEEP).
export function ventilate({ C = 50, R = 5, VT = 500, flow = 50, peep = 5, rr = 12, plateau = 0.3 } = {}) {
  const Fi = flow / 60; // L/s
  const Ti = VT / 1000 / Fi; const T = 60 / rr; const Te = Math.max(0.05, T - Ti - plateau);
  const tau = (R * C) / 1000; // s
  let trapped = 0; // mL above PEEP volume at end expiration
  for (let k = 0; k < 60; k++) trapped = (trapped + VT) * Math.exp(-Te / tau);
  const autoPeep = trapped / C;
  const N = 360; const t = []; const p = []; const f = []; const v = [];
  for (let i = 0; i <= N; i++) {
    const tt = (i / N) * T; let vol; let fl; let pr;
    if (tt < Ti) { vol = trapped + Fi * 1000 * tt; fl = Fi; pr = peep + vol / C + R * Fi; } else if (tt < Ti + plateau) { vol = trapped + VT; fl = 0; pr = peep + vol / C; } else {
      const te = tt - Ti - plateau; vol = (trapped + VT) * Math.exp(-te / tau); fl = -vol / 1000 / tau; pr = peep;
    }
    t.push(tt); v.push(vol); f.push(fl * 60); p.push(pr);
  }
  const ppeak = peep + (trapped + VT) / C + R * Fi; const pplat = peep + (trapped + VT) / C;
  return { t, p, f, v, T, Ti, Te, tau, ppeak, pplat, autoPeep, trapped, driving: pplat - peep - autoPeep, peep, VT, C, R, flowLs: Fi, endFlow: f[N] };
}

// Lung volumes (L) for an illustrative 70 kg adult. Closing capacity rises with age and meets supine FRC near 44 and upright FRC near 66.
export function lungVolumes({ age = 30, pos = 'upright', ga = false, bmi = 24, copd = 0 } = {}) {
  const TLC0 = 6.0; let RV = 1.2 + 0.01 * Math.max(0, age - 25);
  let FRC = 3.0;
  if (pos === 'supine') FRC -= 0.7; if (pos === 'trend') FRC -= 0.9;
  if (ga) FRC -= 0.45;
  if (bmi > 25) FRC *= Math.max(0.55, 1 - 0.015 * (bmi - 25));
  let TLC = TLC0;
  RV += copd * 1.6; FRC += copd * 1.3; TLC += copd * 1.0;
  FRC = Math.max(RV + 0.15, FRC);
  const CC = 1.54 + 0.0318 * (age - 20) + copd * 0.8;
  return { TLC, RV, FRC, CC, ERV: FRC - RV, IC: TLC - FRC, VC: TLC - RV, closes: CC > FRC };
}

// Apneic desaturation: the oxygen in the FRC plus the blood that equilibrates with it (qb litres, Hb g/dL) is drawn down
// by VO2 with no inflow. Returns minutes to SpO2 90% and a sampler at(min) -> { pa, sat }.
export function apnea({ frc = 2.3, vo2 = 250, fao2 = 0.87, aa = 5, qb = 2.5, hb = 15 } = {}) {
  const dry = PATM - PH2O; const cap = qb * 10 * 1.34 * hb; // mL O2 at 100% saturation
  const paOf = (fa) => Math.max(0, fa * dry - aa);
  const total = (fa) => frc * 1000 * fa + cap * hillSat(paOf(fa));
  const faFor = (tot) => { let lo = 0; let hi = 1; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (total(m) < tot) lo = m; else hi = m; } return (lo + hi) / 2; };
  const T0 = total(fao2); const dt = 0.02; const tl = [];
  let t90 = null;
  for (let t = 0; t <= 30.0001; t += dt) {
    const tot = T0 - vo2 * t; const fa = tot <= 0 ? 0 : faFor(tot); const pa = paOf(fa); const sat = hillSat(pa);
    tl.push([pa, sat]);
    if (t90 == null && sat < 0.9) t90 = t;
    if (tot <= 0) break;
  }
  const at = (min) => { const i = Math.min(tl.length - 1, Math.max(0, Math.round(min / dt))); return { pa: tl[i][0], sat: tl[i][1] }; };
  return { t90: t90 == null ? 30 : t90, at };
}

// Capnogram shape: rise time constant k (s) shapes phase II; slope adds phase III upslope (obstruction gives a shark fin)
export function capno(t, { T = 5, Ti = 1.7, etco2 = 38, rise = 0.08, slope = 1.5 } = {}) {
  const tt = t % T; const te = tt - Ti;
  if (te < 0) return 0;
  const r = 1 - Math.exp(-te / rise); const base = etco2 - slope * (T - Ti);
  return r * (base + slope * te);
}

// ---------- drawing ----------
export const FONT = '500 11px "DM Mono", monospace';
export const SMALL = '500 10px "DM Mono", monospace';
const GRID = 'rgba(255,255,255,.06)'; const AXIS = 'rgba(245,245,240,.35)'; const TXT = '#A0A09A';

// A plot box with axes; returns mappers
export function axes(g, box, { x0 = 0, x1 = 1, y0 = 0, y1 = 1, xt = [], yt = [], xl = '', yl = '', title = '', fx = (v) => v, fy = (v) => v } = {}) {
  const { x, y, w, h } = box;
  const X = (v) => x + ((v - x0) / (x1 - x0)) * w; const Y = (v) => y + h - ((v - y0) / (y1 - y0)) * h;
  g.save(); g.lineWidth = 1; g.font = SMALL; g.fillStyle = TXT;
  for (const v of xt) { g.strokeStyle = GRID; g.beginPath(); g.moveTo(X(v), y); g.lineTo(X(v), y + h); g.stroke(); g.textAlign = 'center'; g.fillText(fx(v), X(v), y + h + 14); }
  for (const v of yt) { g.strokeStyle = GRID; g.beginPath(); g.moveTo(x, Y(v)); g.lineTo(x + w, Y(v)); g.stroke(); g.textAlign = 'right'; g.fillText(fy(v), x - 6, Y(v) + 3); }
  g.strokeStyle = AXIS; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h); g.lineTo(x + w, y + h); g.stroke();
  g.textAlign = 'right'; if (xl) g.fillText(xl, x + w, y + h + 28);
  g.textAlign = 'left'; if (yl) g.fillText(yl, x + 4, y - 6);
  if (title) { g.font = FONT; g.fillStyle = '#F5F5F0'; g.fillText(title, x, y - 22); }
  g.restore();
  return { X, Y };
}
export function line(g, pts, color, width = 2, dash = null, alpha = 1) {
  g.save(); g.strokeStyle = color; g.lineWidth = width; g.globalAlpha = alpha; g.lineJoin = 'round'; if (dash) g.setLineDash(dash);
  g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.stroke(); g.restore();
}
export function tag(g, x, y, text, color = '#F5F5F0', align = 'left') {
  g.save(); g.font = SMALL; const w = g.measureText(text).width + 10;
  const bx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  g.fillStyle = 'rgba(10,10,10,.82)'; g.strokeStyle = 'rgba(255,255,255,.12)';
  g.beginPath(); g.roundRect(bx, y - 9, w, 17, 4); g.fill(); g.stroke();
  g.fillStyle = color; g.textAlign = 'left'; g.fillText(text, bx + 5, y + 3); g.restore();
}

// Oxygen dissociation curves. curves: [{ p50, color, label, faint }], mark: PaO2 to read off the first curve
export function drawODC(g, box, { curves = [{ p50: P50_STD, color: '#5EEAD4' }], mark = null, title = 'Oxygen hemoglobin dissociation' } = {}) {
  const { X, Y } = axes(g, box, { x0: 0, x1: 120, y0: 0, y1: 100, xt: [0, 20, 40, 60, 80, 100, 120], yt: [0, 25, 50, 75, 90, 100], xl: 'PO2 mmHg', yl: 'SO2 %', title });
  for (const c of curves) {
    const pts = []; for (let p = 0.5; p <= 120; p += 0.5) pts.push([X(p), Y(100 * hillSat(p, c.p50))]);
    line(g, pts, c.color, c.faint ? 1.4 : 2.4, c.faint ? [4, 4] : null, c.faint ? 0.7 : 1);
    g.save(); g.setLineDash([2, 3]); g.strokeStyle = c.color; g.globalAlpha = 0.6; g.beginPath(); g.moveTo(X(c.p50), Y(50)); g.lineTo(X(c.p50), Y(0)); g.stroke(); g.restore();
  }
  if (mark != null && curves.length) {
    const s = hillSat(mark, curves[0].p50) * 100; const px = X(Math.min(120, mark)); const py = Y(s);
    g.save(); g.strokeStyle = 'rgba(245,245,240,.5)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(px, Y(0)); g.lineTo(px, py); g.lineTo(X(0), py); g.stroke(); g.restore();
    g.fillStyle = '#F5F5F0'; g.beginPath(); g.arc(px, py, 5, 0, 7); g.fill();
    tag(g, px + 8, py + (s > 85 ? 16 : -10), `PaO2 ${Math.round(mark)}  SpO2 about ${s.toFixed(s > 99 ? 0 : 0)}%`);
  }
  curves.forEach((c, i) => { if (c.label) tag(g, box.x + box.w - 4, box.y + box.h - 18 - i * 21, c.label, c.color, 'right'); });
  return { X, Y };
}

// Ventilator waveforms (pressure, flow, volume stacked) for one or two runs
export function drawWaves(g, box, runs, { show = ['p', 'f', 'v'] } = {}) {
  const gap = 34; const n = show.length; const hh = (box.h - gap * (n - 1)) / n;
  const T = 2 * Math.max(...runs.map((r) => r.T));
  const pmax = Math.max(30, ...runs.map((r) => r.ppeak + 4)); const fmax = Math.max(60, ...runs.map((r) => Math.max(...r.f.map(Math.abs)))) * 1.1;
  const vmax = Math.max(700, ...runs.map((r) => Math.max(...r.v) + r.trapped * 0)) * 1.1;
  const out = {};
  show.forEach((k, i) => {
    const b = { x: box.x, y: box.y + i * (hh + gap), w: box.w, h: hh };
    const xt = []; for (let s = 0; s <= T + 1e-6; s += T > 8 ? 2 : 1) xt.push(s);
    const cfg = k === 'p' ? { y0: 0, y1: pmax, yt: [0, 10, 20, 30, 40, 50].filter((v) => v <= pmax), yl: 'Paw cmH2O' } : k === 'f' ? { y0: -fmax, y1: fmax, yt: [-Math.round(fmax / 20) * 10, 0, Math.round(fmax / 20) * 10], yl: 'Flow L/min' } : { y0: 0, y1: vmax, yt: [0, 250, 500, 750, 1000].filter((v) => v <= vmax), yl: 'Volume mL' };
    const { X, Y } = axes(g, b, { x0: 0, x1: T, ...cfg, xt: i === n - 1 ? xt : [], xl: i === n - 1 ? 'time s' : '', fx: (v) => `${v}` });
    if (k === 'f') { g.save(); g.strokeStyle = 'rgba(245,245,240,.25)'; g.beginPath(); g.moveTo(b.x, Y(0)); g.lineTo(b.x + b.w, Y(0)); g.stroke(); g.restore(); }
    runs.forEach((r) => {
      const arr = k === 'p' ? r.p : k === 'f' ? r.f : r.v;
      const pts = []; for (let c = 0; c * r.T < T - 1e-6; c++) r.t.forEach((tt, j) => { if (c * r.T + tt <= T) pts.push([X(c * r.T + tt), Y(arr[j])]); });
      line(g, pts, r.color, r.faint ? 1.3 : 2, r.faint ? [4, 4] : null, r.faint ? 0.7 : 1);
    });
    out[k] = { X, Y, b, T };
  });
  return out;
}

// Pressure volume loop (volume above PEEP volume vs airway pressure)
export function drawPV(g, box, runs, { title = 'Pressure volume loop' } = {}) {
  const pmax = Math.max(30, ...runs.map((r) => r.ppeak + 4)); const vmax = Math.max(700, ...runs.map((r) => Math.max(...r.v))) * 1.1;
  const { X, Y } = axes(g, box, { x0: 0, x1: pmax, y0: 0, y1: vmax, xt: [0, 10, 20, 30, 40, 50].filter((v) => v <= pmax), yt: [0, 250, 500, 750, 1000].filter((v) => v <= vmax), xl: 'Paw cmH2O', yl: 'Volume mL', title });
  runs.forEach((r) => {
    line(g, r.t.map((tt, j) => [X(r.p[j]), Y(r.v[j])]), r.color, r.faint ? 1.3 : 2, r.faint ? [4, 4] : null, r.faint ? 0.7 : 1);
    // static compliance line from PEEP through the plateau point
    line(g, [[X(r.peep + r.autoPeep), Y(r.trapped)], [X(r.pplat), Y(r.trapped + r.VT)]], r.color, 1, [2, 4], 0.6);
  });
  return { X, Y };
}

// Lung volume bars: list of { label, vols, color }
export function drawVolumes(g, box, sets, { vmax = 8.5 } = {}) {
  const { X, Y } = axes(g, box, { x0: 0, x1: sets.length, y0: 0, y1: vmax, yt: [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((v) => v <= vmax), yl: 'Litres' });
  const bw = Math.min(110, (box.w / sets.length) * 0.5);
  g.save();
  sets.forEach((s, i) => {
    const cx = X(i + 0.5); const v = s.vols; const x = cx - bw / 2;
    const seg = (a, b, col, lab) => { g.fillStyle = col; g.fillRect(x, Y(b), bw, Y(a) - Y(b)); if (lab && Y(a) - Y(b) > 14) { g.fillStyle = 'rgba(10,10,10,.85)'; g.font = SMALL; g.textAlign = 'center'; g.fillText(lab, cx, (Y(a) + Y(b)) / 2 + 3); } };
    seg(0, v.RV, 'rgba(160,160,154,.55)', 'RV');
    seg(v.RV, v.FRC, 'rgba(96,165,250,.75)', 'ERV');
    seg(v.FRC, v.TLC, 'rgba(94,234,212,.6)', 'IC');
    g.strokeStyle = '#60A5FA'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 8, Y(v.FRC)); g.lineTo(x + bw + 8, Y(v.FRC)); g.stroke();
    g.strokeStyle = v.closes ? '#FB7185' : '#FBBF24'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(x - 8, Y(v.CC)); g.lineTo(x + bw + 8, Y(v.CC)); g.stroke(); g.setLineDash([]);
    g.font = SMALL; g.fillStyle = '#F5F5F0'; g.textAlign = 'center'; g.fillText(s.label, cx, box.y + box.h + 14);
    if (i === sets.length - 1 || sets.length === 1) {
      tag(g, x + bw + 12, Y(v.FRC), `FRC ${v.FRC.toFixed(1)} L`, '#60A5FA');
      tag(g, x + bw + 12, Y(v.CC) + (Math.abs(Y(v.CC) - Y(v.FRC)) < 18 ? (v.CC > v.FRC ? -18 : 18) : 0), `CC ${v.CC.toFixed(1)} L`, v.closes ? '#FB7185' : '#FBBF24');
      tag(g, x + bw + 12, Y(v.TLC), `TLC ${v.TLC.toFixed(1)} L`, '#5EEAD4');
    }
  });
  g.restore();
  return { X, Y };
}

// Iso shunt lines: PaO2 vs FiO2 for several shunt fractions; mark { fio2, s }
export function drawIsoShunt(g, box, { mark = null, hb = 15, paco2 = 40, lines = [0, 0.1, 0.2, 0.3, 0.5], color = '#A78BFA', title = 'PaO2 against FiO2 at fixed shunt' } = {}) {
  const { X, Y } = axes(g, box, { x0: 0.21, x1: 1, y0: 0, y1: 600, xt: [0.21, 0.4, 0.6, 0.8, 1], yt: [0, 100, 200, 300, 400, 500, 600], xl: 'FiO2', yl: 'PaO2 mmHg', title, fx: (v) => v.toFixed(2) });
  for (const s of lines) {
    const pts = []; for (let f = 0.21; f <= 1.0001; f += 0.01) pts.push([X(f), Y(Math.min(600, shuntPaO2(f, s, { hb, paco2 }).pa))]);
    const on = mark && Math.abs(mark.s - s) < 0.005;
    line(g, pts, on ? color : 'rgba(245,245,240,.45)', on ? 2.4 : 1.2);
    const end = shuntPaO2(1, s, { hb, paco2 }).pa;
    tag(g, X(1) - 4, Y(Math.min(590, end)) - 10, `${Math.round(s * 100)}%`, on ? color : TXT, 'right');
  }
  if (mark) {
    const r = shuntPaO2(mark.fio2, mark.s, { hb, paco2 });
    const pts = []; for (let f = 0.21; f <= 1.0001; f += 0.01) pts.push([X(f), Y(Math.min(600, shuntPaO2(f, mark.s, { hb, paco2 }).pa))]);
    line(g, pts, color, 2.4);
    g.fillStyle = '#F5F5F0'; g.beginPath(); g.arc(X(mark.fio2), Y(Math.min(600, r.pa)), 5, 0, 7); g.fill();
    tag(g, X(mark.fio2) + 8, Y(Math.min(600, r.pa)) - 12, `PaO2 ${Math.round(r.pa)}`);
  }
  return { X, Y };
}

// Apnea desaturation curves: runs [{ frc, vo2, fao2, color, label }]
export function drawApnea(g, box, runs, { tmax = 12, title = 'SpO2 during apnea (oxygen store model)' } = {}) {
  const xt = []; for (let s = 0; s <= tmax; s += tmax > 8 ? 2 : 1) xt.push(s);
  const { X, Y } = axes(g, box, { x0: 0, x1: tmax, y0: 40, y1: 100, xt, yt: [40, 60, 80, 90, 100], xl: 'minutes of apnea', yl: 'SpO2 %', title });
  g.save(); g.strokeStyle = 'rgba(251,113,133,.5)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(X(0), Y(90)); g.lineTo(X(tmax), Y(90)); g.stroke(); g.restore();
  runs.forEach((r, i) => {
    const m = apnea(r); const pts = [];
    for (let t = 0; t <= tmax; t += tmax / 300) pts.push([X(t), Y(Math.max(40, 100 * m.at(t).sat))]);
    line(g, pts, r.color, r.faint ? 1.4 : 2.2, r.faint ? [4, 4] : null);
    if (m.t90 > 0 && m.t90 < tmax) { g.fillStyle = r.color; g.beginPath(); g.arc(X(m.t90), Y(90), 4, 0, 7); g.fill(); }
    if (r.label) tag(g, box.x + 8, box.y + box.h - 16 - (runs.length - 1 - i) * 21, `${r.label}: 90% at ${m.t90 < 0.05 ? 'once apneic' : `${m.t90.toFixed(1)} min`}`, r.color);
  });
  return { X, Y };
}

// Capnograms: runs [{ color, rise, slope, etco2, label }]
export function drawCapno(g, box, runs, { T = 5, Ti = 1.7, beats = 2, title = 'Capnogram' } = {}) {
  const tmax = T * beats; const xt = []; for (let s = 0; s <= tmax; s += 2) xt.push(s);
  const { X, Y } = axes(g, box, { x0: 0, x1: tmax, y0: 0, y1: 60, xt, yt: [0, 20, 40, 60], xl: 'time s', yl: 'CO2 mmHg', title });
  runs.forEach((r, i) => {
    const pts = []; for (let t = 0; t <= tmax; t += 0.02) pts.push([X(t), Y(capno(t, { T, Ti, ...r }))]);
    line(g, pts, r.color, r.faint ? 1.4 : 2.2, r.faint ? [4, 4] : null);
    if (r.label) tag(g, box.x + box.w - 4, box.y + 12 + i * 21, r.label, r.color, 'right');
  });
  return { X, Y };
}

// Layout helper: split a stage rectangle into n plot boxes with room for labels (stacked on narrow screens)
export function plotBoxes(w, h, n = 1, { top = 40, pad = 56 } = {}) {
  const narrow = w < 640 && n > 1;
  const boxes = [];
  if (narrow) {
    const hh = (h - top - 24 - (n - 1) * 62) / n;
    for (let i = 0; i < n; i++) boxes.push({ x: pad - 8, y: top + i * (hh + 62), w: w - pad - 20, h: hh });
  } else {
    const ww = (w - pad - 24 - (n - 1) * (pad + 24)) / n;
    for (let i = 0; i < n; i++) boxes.push({ x: pad + i * (ww + pad + 24), y: top, w: ww, h: h - top - 46 });
  }
  return boxes;
}

// Schematic flow volume loop (textbook shapes, not a fitted model). Volume runs from TLC (0) to RV (vc).
// opts: { vc, pef, pif, scoop 0..1 (lower airway obstruction), cap (L/s) and capType 'fixed' | 'extra' | 'intra' }
export function flowVolume({ vc = 5, pef = 8, pif = 6, scoop = 0, cap = null, capType = 'fixed' } = {}) {
  const k = 1 + 2.4 * scoop; const peak = pef * (1 - 0.55 * scoop);
  const ex = []; const ins = [];
  for (let i = 0; i <= 200; i++) {
    const v = (i / 200) * vc;
    let fe = peak * (1 - Math.exp(-v / (0.07 * vc))) * Math.pow(1 - v / vc, k) / Math.pow(1 - 0.12, k);
    fe = Math.min(fe, peak * (1 - Math.exp(-v / (0.07 * vc))));
    let fi = -pif * Math.pow(Math.sin(Math.PI * (v / vc)), 0.7);
    if (cap != null && (capType === 'fixed' || capType === 'intra')) fe = Math.min(fe, cap);
    if (cap != null && (capType === 'fixed' || capType === 'extra')) fi = Math.max(fi, -cap);
    ex.push([v, fe]); ins.push([v, fi]);
  }
  return { ex, ins, vc };
}
export function drawFlowVolume(g, box, loops, { title = 'Flow volume loop (schematic)' } = {}) {
  const { X, Y } = axes(g, box, { x0: 0, x1: 6, y0: -8, y1: 10, xt: [0, 1, 2, 3, 4, 5, 6], yt: [-8, -4, 0, 4, 8], xl: 'volume exhaled L (TLC at 0)', yl: 'flow L/s (out above, in below)', title });
  g.save(); g.strokeStyle = 'rgba(245,245,240,.3)'; g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(6), Y(0)); g.stroke(); g.restore();
  loops.forEach((l, i) => {
    const pts = [...l.ex.map(([v, f]) => [X(v), Y(f)]), ...l.ins.slice().reverse().map(([v, f]) => [X(v), Y(f)])];
    line(g, pts, l.color, l.faint ? 1.4 : 2.2, l.faint ? [4, 4] : null);
    if (l.label) tag(g, box.x + box.w - 4, box.y + 12 + i * 21, l.label, l.color, 'right');
  });
  return { X, Y };
}
