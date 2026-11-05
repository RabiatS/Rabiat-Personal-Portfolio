// Small canvas helpers shared by Audio Lab chapters.
import { COLORS } from '../../study/kit/kit.js';

export const C = COLORS;
export const MONO = '500 11px "DM Mono", ui-monospace, Menlo, monospace';
export const MONO_S = '500 10px "DM Mono", ui-monospace, Menlo, monospace';
export const HEAD = '700 13px "Rajdhani", system-ui, sans-serif';
export const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function txt(g, s, x, y, { color = C.muted, align = 'left', base = 'alphabetic', font = MONO } = {}) {
  g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = base; g.fillText(s, x, y);
}
export function title(g, s, x, y, color = C.muted) {
  g.save(); g.font = '600 11px "Rajdhani", system-ui, sans-serif'; g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'top';
  if ('letterSpacing' in g) g.letterSpacing = '1.6px';
  g.fillText(s.toUpperCase(), x, y); g.restore();
}

export function rr(g, x, y, w, h, r = 8) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export function box(g, x, y, w, h, label) {
  g.save(); rr(g, x + 0.5, y + 0.5, w - 1, h - 1, 10); g.fillStyle = 'rgba(20,20,20,.55)'; g.fill(); g.strokeStyle = C.border; g.lineWidth = 1; g.stroke(); g.restore();
  if (label) title(g, label, x + 12, y + 10);
}

export function fmtHz(f) {
  if (f >= 1000) return `${(f / 1000).toFixed(f >= 10000 ? 1 : 2)} kHz`;
  if (f >= 100) return `${Math.round(f)} Hz`;
  return `${f.toFixed(1)} Hz`;
}
export const tickHz = (f) => (f >= 1000 ? `${f / 1000}k` : `${f}`);

export const logPos = (f, f0, f1) => Math.log(f / f0) / Math.log(f1 / f0);
export const logFreq = (t, f0, f1) => f0 * Math.pow(f1 / f0, t);

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function noteOf(f) {
  const n = 12 * Math.log2(f / 440) + 69; const r = Math.round(n);
  return { name: `${NAMES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`, cents: Math.round((n - r) * 100), midi: r };
}
export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Log frequency grid with labels under the plot.
export function freqGrid(g, x, y, w, h, f0, f1, { labels = true, minor = true } = {}) {
  g.save(); g.lineWidth = 1;
  for (let dec = 1; dec <= 100000; dec *= 10) {
    for (let m = 1; m < 10; m++) {
      const f = dec * m; if (f < f0 || f > f1) continue;
      const major = m === 1 || m === 2 || m === 5;
      if (!major && !minor) continue;
      const px = Math.round(x + logPos(f, f0, f1) * w) + 0.5;
      g.strokeStyle = major ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.03)';
      g.beginPath(); g.moveTo(px, y); g.lineTo(px, y + h); g.stroke();
      if (labels && major) txt(g, tickHz(f), px, y + h + 13, { align: 'center', font: MONO_S, color: C.subtle });
    }
  }
  g.restore();
}
export function dbGrid(g, x, y, w, h, dmin, dmax, step = 20, { labels = true, unit = '' } = {}) {
  g.save();
  for (let d = Math.ceil(dmin / step) * step; d <= dmax; d += step) {
    const py = Math.round(y + (1 - (d - dmin) / (dmax - dmin)) * h) + 0.5;
    g.strokeStyle = d === 0 ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.05)';
    g.beginPath(); g.moveTo(x, py); g.lineTo(x + w, py); g.stroke();
    if (labels) txt(g, `${d}${unit}`, x + 4, py - 3, { font: MONO_S, color: C.subtle });
  }
  g.restore();
}

// Draw an analyser's spectrum on a log frequency axis. buf must be Float32Array(frequencyBinCount).
export function spectrum(g, an, buf, x, y, w, h, { f0 = 20, f1 = 20000, dmin = -100, dmax = -10, color = C.c1, fill = true, read = true } = {}) {
  if (read) an.getFloatFrequencyData(buf);
  const binHz = an.context.sampleRate / an.fftSize; const n = buf.length;
  g.save(); g.beginPath();
  const val = (b) => { const i = Math.floor(b); const t = b - i; const a = buf[Math.min(n - 1, Math.max(0, i))]; const c = buf[Math.min(n - 1, Math.max(0, i + 1))]; return a + (c - a) * t; };
  for (let px = 0; px <= w; px += 1) {
    const fa = logFreq(px / w, f0, f1); const fb = logFreq((px + 1) / w, f0, f1);
    const ba = fa / binHz; const bb = fb / binHz; let v;
    if (bb - ba < 1) v = val(ba);
    else { v = -Infinity; for (let b = Math.floor(ba); b <= Math.ceil(bb) && b < n; b++) if (buf[b] > v) v = buf[b]; }
    if (!isFinite(v)) v = dmin;
    const py = y + (1 - Math.max(0, Math.min(1, (v - dmin) / (dmax - dmin)))) * h;
    if (px === 0) g.moveTo(x + px, py); else g.lineTo(x + px, py);
  }
  g.strokeStyle = color; g.lineWidth = 1.4; g.stroke();
  if (fill) {
    g.lineTo(x + w, y + h); g.lineTo(x, y + h); g.closePath();
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, hexA(color, 0.28)); gr.addColorStop(1, hexA(color, 0.02));
    g.fillStyle = gr; g.fill();
  }
  g.restore();
}

// Draw a time domain buffer (values -1..1) across a box.
export function wave(g, arr, x, y, w, h, { color = C.c1, lw = 1.6, gain = 1, from = 0, count } = {}) {
  const n = count || arr.length - from; const mid = y + h / 2;
  g.save(); g.beginPath();
  for (let px = 0; px <= w; px++) {
    const i = from + Math.min(n - 1, Math.floor((px / w) * (n - 1)));
    const py = mid - Math.max(-1, Math.min(1, arr[i] * gain)) * (h / 2);
    if (px === 0) g.moveTo(x, py); else g.lineTo(x + px, py);
  }
  g.strokeStyle = color; g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(); g.restore();
}

// Find a rising zero crossing so a periodic wave stands still on screen.
export function trigger(arr, maxLook) {
  const lim = Math.min(arr.length - 2, maxLook || arr.length / 2);
  for (let i = 1; i < lim; i++) if (arr[i - 1] < 0 && arr[i] >= 0) return i;
  return 0;
}

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Colour map for spectrograms: black, violet, rose, amber, bone.
const STOPS = [[0, [10, 10, 10]], [0.3, [58, 34, 110]], [0.55, [167, 139, 250]], [0.72, [251, 113, 133]], [0.88, [251, 191, 36]], [1, [245, 245, 240]]];
export function heat(t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [ta, a] = STOPS[i - 1]; const [tb, b] = STOPS[i]; const k = (t - ta) / (tb - ta);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

// Pointer drag helper: calls fn(x, y, e, phase) in canvas CSS pixels.
export function drag(el, fn, signal) {
  let down = false;
  const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => { down = true; try { el.setPointerCapture(e.pointerId); } catch { /* ok */ } fn(...pos(e), e, 'down'); }, { signal });
  el.addEventListener('pointermove', (e) => { if (down) fn(...pos(e), e, 'move'); else fn(...pos(e), e, 'hover'); }, { signal });
  const up = (e) => { if (down) { down = false; fn(...pos(e), e, 'up'); } };
  el.addEventListener('pointerup', up, { signal });
  el.addEventListener('pointercancel', up, { signal });
}

// Stage layout helper: returns plot areas with room for labels. pad keeps clear of a bottom dock.
export function areas(w, h, rows, { gap = 12, bottom = 0 } = {}) {
  const total = rows.reduce((a, b) => a + b, 0); const avail = h - bottom - gap * (rows.length - 1);
  let y = 0; return rows.map((r) => { const hh = (avail * r) / total; const o = { x: 0, y, w, h: hh }; y += hh + gap; return o; });
}
