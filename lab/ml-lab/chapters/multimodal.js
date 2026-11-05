// Multimodal models: images become patch tokens, audio becomes spectrogram frames, and a CLIP-style shared space links pictures and words.

const FONT = '500 11px "DM Mono", monospace';
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const randn = (r) => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const unit = (v) => { const n = Math.sqrt(dot(v, v)) || 1; return v.map((x) => x / n); };

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) {
      const wr = Math.cos(ang * k); const wi = Math.sin(ang * k);
      const ur = re[i + k]; const ui = im[i + k]; const vr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi; const vi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
      re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
    }
  }
}

// Procedural pictures used for the image and shared space views
function icon(g, kind, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s / 100, s / 100);
  const bg = { sun: '#1d3a5a', cat: '#3a2f4a', car: '#2a3a2a', tree: '#203a50', fish: '#123a4a', house: '#3a3020', moon: '#101830', flower: '#2a4a2a' }[kind];
  g.fillStyle = bg; g.fillRect(0, 0, 100, 100);
  const P = (pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); g.fill(); };
  const O = (cx, cy, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); };
  if (kind === 'sun') { g.strokeStyle = '#FBBF24'; g.lineWidth = 5; for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; g.beginPath(); g.moveTo(50 + 26 * Math.cos(a), 50 + 26 * Math.sin(a)); g.lineTo(50 + 40 * Math.cos(a), 50 + 40 * Math.sin(a)); g.stroke(); } O(50, 50, 20, '#FDE68A'); }
  if (kind === 'cat') { O(50, 70, 24, '#111'); O(50, 38, 16, '#111'); P([[36, 30], [40, 14], [48, 26]], '#111'); P([[64, 30], [60, 14], [52, 26]], '#111'); g.strokeStyle = '#111'; g.lineWidth = 6; g.beginPath(); g.moveTo(72, 82); g.quadraticCurveTo(92, 80, 86, 56); g.stroke(); O(44, 37, 2.5, '#A3E635'); O(56, 37, 2.5, '#A3E635'); }
  if (kind === 'car') { P([[12, 62], [22, 46], [36, 44], [46, 30], [70, 30], [80, 44], [90, 48], [90, 64], [12, 64]], '#FB7185'); P([[50, 34], [68, 34], [74, 44], [46, 44]], '#BAE6FD'); O(30, 66, 9, '#111'); O(74, 66, 9, '#111'); g.fillStyle = '#555'; g.fillRect(0, 74, 100, 26); }
  if (kind === 'tree') { g.fillStyle = '#7c4a1e'; g.fillRect(44, 58, 12, 34); O(50, 40, 24, '#65A30D'); O(34, 52, 15, '#4D7C0F'); O(66, 52, 15, '#4D7C0F'); g.fillStyle = '#3f6212'; g.fillRect(0, 90, 100, 10); }
  if (kind === 'fish') { P([[20, 50], [50, 30], [76, 50], [50, 70]], '#FB923C'); P([[74, 50], [92, 34], [92, 66]], '#F97316'); O(36, 46, 3.5, '#111'); for (let i = 0; i < 3; i++) O(18 - i * 2, 28 - i * 9, 2.5 + i, 'rgba(186,230,253,.6)'); }
  if (kind === 'house') { g.fillStyle = '#E7D7B0'; g.fillRect(24, 46, 52, 40); P([[16, 48], [50, 18], [84, 48]], '#B91C1C'); g.fillStyle = '#5b3a1a'; g.fillRect(44, 62, 13, 24); g.fillStyle = '#93C5FD'; g.fillRect(30, 54, 10, 10); g.fillRect(62, 54, 10, 10); g.fillStyle = '#3f6212'; g.fillRect(0, 86, 100, 14); }
  if (kind === 'moon') { O(52, 48, 26, '#F5F5F0'); O(64, 40, 24, bg); O(18, 20, 1.5, '#fff'); O(84, 78, 1.5, '#fff'); O(28, 82, 1.2, '#fff'); O(80, 16, 1.2, '#fff'); }
  if (kind === 'flower') { g.strokeStyle = '#4D7C0F'; g.lineWidth = 4; g.beginPath(); g.moveTo(50, 50); g.lineTo(50, 96); g.stroke(); for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; O(50 + 15 * Math.cos(a), 40 + 15 * Math.sin(a), 11, '#F472B6'); } O(50, 40, 9, '#FBBF24'); }
  g.restore();
}

export default {
  mount(ctx) {
    const C = ctx.colors; const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let mode = ctx.store.get('mm:mode', 'image');
    const cv = ctx.canvas(); const g = cv.ctx;

    // ---------- image: patches ----------
    const IMG = 96; const off = document.createElement('canvas'); off.width = IMG; off.height = IMG;
    const og = off.getContext('2d');
    og.fillStyle = '#1d3a5a'; og.fillRect(0, 0, IMG, IMG);
    og.fillStyle = '#FDE68A'; og.beginPath(); og.arc(72, 22, 12, 0, 7); og.fill();
    og.fillStyle = '#3f6212'; og.beginPath(); og.moveTo(0, 70); og.quadraticCurveTo(30, 50, 60, 66); og.quadraticCurveTo(80, 76, 96, 62); og.lineTo(96, 96); og.lineTo(0, 96); og.fill();
    og.fillStyle = '#E7D7B0'; og.fillRect(18, 54, 26, 22); og.fillStyle = '#B91C1C'; og.beginPath(); og.moveTo(14, 56); og.lineTo(31, 40); og.lineTo(48, 56); og.fill(); og.fillStyle = '#5b3a1a'; og.fillRect(28, 64, 7, 12);
    og.fillStyle = '#7c4a1e'; og.fillRect(70, 58, 5, 16); og.fillStyle = '#65A30D'; og.beginPath(); og.arc(72.5, 54, 10, 0, 7); og.fill();
    const pix = og.getImageData(0, 0, IMG, IMG).data;
    let patch = ctx.store.get('mm:patch', 16); let phase = 0; let target = ctx.store.get('mm:phase', 1);
    const DIM = 8; let PW = null;
    function patchVec(px, py) {
      const n = patch * patch * 3; if (!PW || PW.n !== n) { const r = rng(5); PW = { n, W: Array.from({ length: DIM }, () => Array.from({ length: n }, () => randn(r) / Math.sqrt(n))) }; }
      const flat = []; for (let y = 0; y < patch; y++) for (let x = 0; x < patch; x++) { const o = ((py + y) * IMG + px + x) * 4; flat.push(pix[o] / 255 - 0.5, pix[o + 1] / 255 - 0.5, pix[o + 2] / 255 - 0.5); }
      return PW.W.map((row) => dot(row, flat));
    }
    const TEXT = ['Describe', 'this', 'image', ':'];
    const tr = rng(9); const textVec = TEXT.map(() => Array.from({ length: DIM }, () => randn(tr) * 0.8));

    function strip(x, y, w, h, v, scale) {
      const cw = w / v.length;
      v.forEach((val, i) => { const a = Math.max(-1, Math.min(1, val / scale)); g.fillStyle = a >= 0 ? C.c1 : C.c4; g.globalAlpha = 0.15 + 0.85 * Math.abs(a); g.fillRect(x + i * cw, y, cw - 0.5, h); });
      g.globalAlpha = 1;
    }
    function drawImage(w, h) {
      const n = IMG / patch; const count = n * n; const bottom = h - 56;
      const wide = w >= 640;
      const isz = Math.min(wide ? w * 0.36 : w * 0.5, (wide ? bottom - 30 : bottom * 0.42));
      const ix = wide ? 8 : (w - isz) / 2; const iy = 26;
      g.font = FONT; g.fillStyle = C.muted; g.textAlign = 'left';
      g.fillText(`${IMG}×${IMG} pixel image, ${patch}×${patch} patches: ${count} image tokens`, 4, 12);
      g.imageSmoothingEnabled = false;
      // sequence area
      const sx = wide ? ix + isz + 30 : 4; const sy = wide ? iy : iy + isz + 24; const sw = wide ? w - sx - 6 : w - 8; const sh = bottom - sy;
      const total = count + (phase > 3 ? TEXT.length : 0);
      let cols = Math.ceil(Math.sqrt(total * sw / sh)); let tile = Math.min(sw / cols - 4, 52);
      for (let k = 0; k < 20; k++) { const rows = Math.ceil(total / cols); const th = (tile + (phase > 2.5 ? tile * 0.35 : 0) + 6) * rows; if (th <= sh) break; cols++; tile = Math.min(sw / cols - 4, 52); }
      const vecH = tile * 0.3;
      const pr = Math.max(0, Math.min(1, phase - 1));
      const ease = pr < 0.5 ? 2 * pr * pr : 1 - (-2 * pr + 2) ** 2 / 2;
      // faded full image while patches are in place
      g.globalAlpha = 1 - ease * 0.7; g.drawImage(off, ix, iy, isz, isz); g.globalAlpha = 1;
      const cs = isz / n;
      for (let k = 0; k < count; k++) {
        const px = (k % n) * patch; const py = Math.floor(k / n) * patch;
        const ax = ix + (k % n) * cs; const ay = iy + Math.floor(k / n) * cs;
        const bxx = sx + (k % cols) * (tile + 4); const byy = sy + Math.floor(k / cols) * (tile + (phase > 2.5 ? vecH + 2 : 0) + 6);
        const x = ax + (bxx - ax) * ease; const y = ay + (byy - ay) * ease; const s = cs + (tile - cs) * ease;
        if (ease > 0) g.drawImage(off, px, py, patch, patch, x, y, s, s);
        if (phase > 0.5) { g.strokeStyle = 'rgba(245,245,240,.5)'; g.lineWidth = 0.6; g.strokeRect(x, y, s, s); }
        if (phase > 2.5 && ease >= 1) strip(bxx, byy + tile + 2, tile, vecH, patchVec(px, py), 1.2);
        if (ease >= 1 && tile > 20) { g.font = '500 9px "DM Mono", monospace'; g.fillStyle = 'rgba(10,10,10,.75)'; g.fillRect(bxx, byy, 16, 11); g.fillStyle = C.text; g.fillText(String(k + 1), bxx + 2, byy + 9); }
      }
      if (phase > 3.5) {
        for (let j = 0; j < TEXT.length; j++) {
          const k = count + j; const bxx = sx + (k % cols) * (tile + 4); const byy = sy + Math.floor(k / cols) * (tile + vecH + 8);
          g.strokeStyle = C.c2; g.lineWidth = 1.2; g.fillStyle = 'rgba(251,191,36,.12)'; g.fillRect(bxx, byy, tile, tile); g.strokeRect(bxx, byy, tile, tile);
          g.fillStyle = C.c2; g.font = `500 ${Math.max(8, Math.min(11, tile / 5))}px "DM Mono", monospace`; g.textAlign = 'center'; g.fillText(TEXT[j].slice(0, Math.max(2, Math.floor(tile / 7))), bxx + tile / 2, byy + tile / 2 + 4); g.textAlign = 'left';
          strip(bxx, byy + tile + 2, tile, vecH, textVec[j], 1.2);
        }
        const rowsN = Math.ceil(total / cols); g.font = FONT; g.fillStyle = C.c2; g.fillText('one sequence of tokens → the same transformer as text', sx, Math.min(bottom + 2, sy + rowsN * (tile + vecH + 8) + 12));
      }
    }

    // ---------- audio ----------
    const SR = 8000; const DUR = 1.6; const NS = Math.floor(SR * DUR); const wave = new Float32Array(NS);
    { const r = rng(4); let ph = 0;
      for (let i = 0; i < NS; i++) {
        const t = i / SR; let v = 0;
        const note = t < 0.4 ? 440 : t < 0.8 ? 660 : null;
        if (note) { const env = Math.min(1, (t % 0.4) * 30) * Math.exp(-(t % 0.4) * 4); v += env * (0.6 * Math.sin(2 * Math.PI * note * t) + 0.25 * Math.sin(2 * Math.PI * note * 2 * t)); }
        if (t >= 0.85 && t < 1.25) { const f = 300 + 2400 * ((t - 0.85) / 0.4); ph += (2 * Math.PI * f) / SR; v += 0.5 * Math.sin(ph) * Math.sin(Math.PI * (t - 0.85) / 0.4); }
        if (t >= 1.3 && t < 1.45) v += (r() - 0.5) * 0.8 * Math.exp(-(t - 1.3) * 20);
        wave[i] = v * 0.8;
      } }
    const FR = 256; const HOP = 128; const NF = Math.floor((NS - FR) / HOP) + 1; const spec = [];
    for (let f = 0; f < NF; f++) {
      const re = new Float64Array(FR); const im = new Float64Array(FR);
      for (let i = 0; i < FR; i++) re[i] = wave[f * HOP + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FR - 1)));
      fft(re, im); spec.push(Array.from({ length: FR / 2 }, (_, k) => Math.log10(1e-4 + Math.hypot(re[k], im[k]))));
    }
    const smin = Math.min(...spec.flat()); const smax = Math.max(...spec.flat());
    const PER = 4; let play = null; let playT = -1; let actx = null;
    function drawAudio(w, h) {
      const bottom = h - 56; const L = 8; const W = w - 16;
      g.font = FONT; g.fillStyle = C.muted; g.textAlign = 'left';
      const h1 = bottom * 0.22; const h2 = bottom * 0.46; const y1 = 22; const y2 = y1 + h1 + 30; const y3 = y2 + h2 + 26;
      g.fillText('1. waveform: air pressure over time (8,000 samples per second)', L, y1 - 8);
      g.strokeStyle = C.c5; g.lineWidth = 1; g.beginPath();
      for (let x = 0; x < W; x++) { const i0 = Math.floor((x / W) * NS); const i1 = Math.floor(((x + 1) / W) * NS); let mn = 1; let mx = -1; for (let i = i0; i < i1; i++) { mn = Math.min(mn, wave[i]); mx = Math.max(mx, wave[i]); } g.moveTo(L + x, y1 + h1 / 2 - mx * h1 / 2); g.lineTo(L + x, y1 + h1 / 2 - mn * h1 / 2 + 0.5); }
      g.stroke();
      g.fillStyle = C.muted; g.fillText(`2. spectrogram: ${NF} short frames, each split into frequencies (low at bottom)`, L, y2 - 8);
      const fw = W / NF; const bins = FR / 2; const bh = h2 / bins;
      for (let f = 0; f < NF; f++) for (let k = 0; k < bins; k++) {
        const v = (spec[f][k] - smin) / (smax - smin); if (v < 0.35) continue;
        g.fillStyle = `hsla(${280 - v * 230}, 90%, ${20 + v * 50}%, ${Math.min(1, (v - 0.35) * 2.2)})`; g.fillRect(L + f * fw, y2 + h2 - (k + 1) * bh, fw + 0.5, bh + 0.5);
      }
      g.strokeStyle = C.border; g.strokeRect(L, y2, W, h2);
      g.fillStyle = C.muted; g.fillText(`3. groups of ${PER} frames become one audio token (a vector each)`, L, y3 - 8);
      const nt = Math.ceil(NF / PER); const tw = W / nt; const r = rng(2);
      for (let t = 0; t < nt; t++) {
        g.strokeStyle = C.c2; g.globalAlpha = 0.7; g.strokeRect(L + t * tw + 1, y3, tw - 2, Math.min(36, bottom - y3)); g.globalAlpha = 1;
        const v = Array.from({ length: 6 }, (_, j) => { const f0 = t * PER; let s = 0; for (let f = f0; f < Math.min(NF, f0 + PER); f++) s += spec[f][j * 20 + 4] - smin; return (s / PER / (smax - smin)) * 2 - 0.6 + (r() - 0.5) * 0.2; });
        strip(L + t * tw + 3, y3 + 4, tw - 6, Math.min(28, bottom - y3 - 8), v, 1);
      }
      if (playT >= 0) { const x = L + playT * W; g.strokeStyle = C.text; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y1); g.lineTo(x, y3 + 36); g.stroke(); }
    }

    // ---------- shared space ----------
    const KINDS = ['sun', 'cat', 'car', 'tree', 'fish', 'house', 'moon', 'flower'];
    const CAPS = ['bright sun', 'black cat', 'red car', 'green tree', 'orange fish', 'small house', 'crescent moon', 'pink flower'];
    // Toy vectors: each concept = its group direction + its own direction; pictures and captions are noisy copies.
    const GROUP = { sun: 0, moon: 0, cat: 1, fish: 1, tree: 2, flower: 2, car: 3, house: 3 };
    const sr = rng(21); const DD = 12;
    const gdir = [0, 1, 2, 3].map(() => unit(Array.from({ length: DD }, () => randn(sr))));
    const base = KINDS.map((k) => unit(Array.from({ length: DD }, (_, i) => gdir[GROUP[k]][i] * 0.8 + randn(sr) * 0.17)));
    const imgOff = Array.from({ length: DD }, () => randn(sr) * 0.04); const txtOff = imgOff.map((x) => -x);
    const imgE = base.map((b) => unit(b.map((x, i) => x + randn(sr) * 0.09 + imgOff[i])));
    const txtE = base.map((b) => unit(b.map((x, i) => x + randn(sr) * 0.09 + txtOff[i])));
    // Map positions are placed by hand to mirror those groups: sky, animals, plants, made things.
    const CENT = { sun: [0.12, 0.12], moon: [0.37, 0.18], cat: [0.63, 0.12], fish: [0.88, 0.18], tree: [0.12, 0.6], flower: [0.37, 0.66], car: [0.63, 0.6], house: [0.88, 0.66] };
    const pos = KINDS.map((k) => CENT[k]).concat(KINDS.map((k) => [CENT[k][0], CENT[k][1] + 0.15]));
    const sim = imgE.map((a) => txtE.map((b) => dot(a, b)));
    let pick = { t: 'img', i: 1 }; let hits = [];
    function drawSpace(w, h) {
      const bottom = h - 56; const wide = w >= 640;
      const mA = wide ? { x: 0, y: 18, w: w * 0.6, h: bottom - 18 } : { x: 0, y: 18, w, h: bottom * 0.5 };
      const xA = wide ? { x: w * 0.62, y: 18, w: w * 0.38, h: bottom - 18 } : { x: 0, y: mA.y + mA.h + 8, w, h: bottom - mA.h - 26 };
      hits = [];
      const th = Math.min(52, mA.w / 7, mA.h / 5.5);
      const S = ([a, b]) => [mA.x + 8 + a * (mA.w - 16), mA.y + th * 0.6 + (b / 0.81) * (mA.h - th * 1.2)];
      g.font = FONT; g.fillStyle = C.muted; g.textAlign = 'left'; g.fillText('shared space (2D map): pictures and captions', 4, 10);
      const selRow = pick.t === 'img' ? pick.i : null; const selCol = pick.t === 'txt' ? pick.i : null;
      const best = selRow != null ? sim[selRow].indexOf(Math.max(...sim[selRow])) : sim.map((r) => r[selCol]).indexOf(Math.max(...sim.map((r) => r[selCol])));
      const pi = selRow != null ? selRow : best; const pt = selCol != null ? selCol : best;
      for (let k = 0; k < 8; k++) { const a = S(pos[k]); const b = S(pos[8 + k]); g.strokeStyle = k === pi && k === pt ? C.c2 : C.border; g.lineWidth = k === pi && k === pt ? 2 : 1; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]); }
      for (let k = 0; k < 8; k++) {
        const [x, y] = S(pos[k]); icon(g, KINDS[k], x - th / 2, y - th / 2, th);
        g.strokeStyle = k === pi ? C.c2 : C.borderStrong; g.lineWidth = k === pi ? 2 : 1; g.strokeRect(x - th / 2, y - th / 2, th, th);
        hits.push({ t: 'img', i: k, x: x - th / 2, y: y - th / 2, w: th, h: th });
      }
      for (let k = 0; k < 8; k++) {
        const [x, y] = S(pos[8 + k]); g.font = w < 500 ? '500 10px "DM Mono", monospace' : k === pt ? '500 12px "DM Mono", monospace' : FONT; const tw = g.measureText(CAPS[k]).width;
        g.fillStyle = k === pt ? 'rgba(251,191,36,.18)' : 'rgba(20,20,20,.85)'; g.fillRect(x - tw / 2 - 5, y - 10, tw + 10, 19);
        g.strokeStyle = k === pt ? C.c2 : C.border; g.strokeRect(x - tw / 2 - 5, y - 10, tw + 10, 19);
        g.fillStyle = k === pt ? C.text : C.text2; g.textAlign = 'center'; g.fillText(CAPS[k], x, y + 4); g.textAlign = 'left';
        hits.push({ t: 'txt', i: k, x: x - tw / 2 - 5, y: y - 10, w: tw + 10, h: 19 });
      }
      // similarity matrix
      const lab = Math.min(30, xA.w * 0.12); const cs = Math.min((xA.w - lab - 6) / 8, (xA.h - lab - 24) / 8);
      const mx = xA.x + lab + 4; const my = xA.y + lab + 6;
      g.font = FONT; g.fillStyle = C.muted; g.fillText('similarity: picture rows × caption columns', xA.x, xA.y + 2);
      for (let r = 0; r < 8; r++) {
        icon(g, KINDS[r], mx - lab, my + r * cs + (cs - Math.min(lab - 4, cs - 2)) / 2, Math.min(lab - 4, cs - 2));
        for (let c = 0; c < 8; c++) {
          const v = Math.max(0, sim[r][c]); g.fillStyle = C.c1; g.globalAlpha = 0.06 + 0.94 * v ** 2; g.fillRect(mx + c * cs + 0.5, my + r * cs + 0.5, cs - 1, cs - 1); g.globalAlpha = 1;
          if (cs > 26) { g.fillStyle = v > 0.6 ? '#0A0A0A' : C.muted; g.font = '500 9.5px "DM Mono", monospace'; g.textAlign = 'center'; g.fillText(sim[r][c].toFixed(2).replace(/^0/, '').replace(/^-0/, '-'), mx + c * cs + cs / 2, my + r * cs + cs / 2 + 3); g.textAlign = 'left'; }
        }
        hits.push({ t: 'img', i: r, x: mx - lab, y: my + r * cs, w: lab, h: cs });
      }
      for (let c = 0; c < 8; c++) { g.save(); g.translate(mx + c * cs + cs / 2 + 3, my - 4); g.rotate(-Math.PI / 2.6); g.fillStyle = c === pt ? C.c2 : C.muted; g.font = '500 9.5px "DM Mono", monospace'; g.fillText(CAPS[c].split(' ').pop(), 0, 0); g.restore(); hits.push({ t: 'txt', i: c, x: mx + c * cs, y: my - lab, w: cs, h: lab }); }
      g.strokeStyle = C.c2; g.lineWidth = 1.5;
      if (selRow != null) g.strokeRect(mx, my + selRow * cs, cs * 8, cs); else g.strokeRect(mx + selCol * cs, my, cs, cs * 8);
      const top = pick.t === 'img' ? `best caption for the ${KINDS[pi]} picture: "${CAPS[best]}" (${sim[pi][best].toFixed(2)})` : `best picture for "${CAPS[pt]}": ${KINDS[best]} (${sim[best][pt].toFixed(2)})`;
      g.font = FONT; g.fillStyle = C.c2; g.fillText(top, xA.x, Math.min(h - 50, my + cs * 8 + 16));
    }

    function draw() {
      const w = cv.w; const h = cv.h; if (!w) return;
      g.clearRect(0, 0, w, h);
      if (mode === 'image') drawImage(w, h); else if (mode === 'audio') drawAudio(w, h); else drawSpace(w, h);
    }
    cv.onResize(draw);
    ctx.loop((t, dt) => {
      if (mode === 'image' && Math.abs(phase - target) > 0.001) { phase += Math.sign(target - phase) * Math.min(Math.abs(target - phase), dt * (reduce ? 50 : 1.4)); draw(); }
      if (mode === 'audio' && play) { playT = (play.ac.currentTime - play.t0) / DUR; if (playT > 1) { playT = -1; play = null; } draw(); }
    });
    cv.el.addEventListener('pointerdown', (e) => {
      if (mode !== 'space') return;
      const r = cv.el.getBoundingClientRect(); const x = e.clientX - r.left; const y = e.clientY - r.top;
      const hh = [...hits].reverse().find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      if (hh) { pick = { t: hh.t, i: hh.i }; draw(); }
    }, { signal: ctx.signal });

    const dock = ctx.h('<div class="dock"><div class="grp glass"><span>Show</span></div></div>');
    ctx.stage.append(dock);
    const mseg = ctx.seg([['image', 'Image'], ['audio', 'Audio'], ['space', 'Shared space']], mode, (v) => { mode = v; ctx.store.set('mm:mode', v); sync(); draw(); });
    mseg.style.border = '0'; dock.firstChild.append(mseg);

    // Panel
    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">Multimodal models</h2>'), ctx.h('<p class="lede">A transformer only needs a sequence of vectors. Turn a picture or a sound into such a sequence and the same machinery that reads text can read it too.</p>'));
    const imgBox = ctx.h('<div class="card"><b class="mono small">Image to tokens</b></div>');
    const phSeg = ctx.seg([[0, 'Image'], [1, 'Patches'], [2, 'Sequence'], [3, 'Vectors'], [4, '+ Text']], target, (v) => { target = +v; ctx.store.set('mm:phase', target); });
    const pSeg = ctx.seg([[8, '8 px'], [12, '12 px'], [16, '16 px'], [24, '24 px'], [32, '32 px']], patch, (v) => { patch = +v; ctx.store.set('mm:patch', patch); draw(); });
    imgBox.append(phSeg, ctx.h('<span class="hint">Patch size</span>'), pSeg, ctx.h('<p class="small">Each patch’s pixels (patch × patch × 3 colours) are flattened and multiplied by a learned matrix, giving one vector per patch: a "patch embedding". The coloured strips show 8 numbers from a random projection here; real models use hundreds or thousands.</p>'));
    const audBox = ctx.h('<div class="card"><b class="mono small">Audio to tokens</b><div class="row"><button class="btn sm">Play the sound</button></div><p class="small">A synthetic clip: two notes, a rising sweep, a click. The spectrogram is computed live with a Fourier transform over short overlapping windows.</p></div>');
    audBox.querySelector('button').onclick = () => {
      try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!actx) actx = new AC(); const ac = actx; if (ac.state === 'suspended') ac.resume();
        const buf = ac.createBuffer(1, NS, SR); buf.copyToChannel(wave, 0);
        const src = ac.createBufferSource(); src.buffer = buf; src.connect(ac.destination); src.start();
        play = { ac, t0: ac.currentTime };
      } catch (err) { audBox.querySelector('p').textContent = 'Sound could not play in this browser, but the pictures above are computed the same way.'; }
    };
    const spBox = ctx.h('<div class="card"><b class="mono small">Shared space (CLIP style)</b><p class="small">Click a picture or a caption. Its best match is highlighted. Pictures sit near their captions, and related things (sun and moon, cat and fish) sit near each other. The grid shows every picture against every caption: training makes the diagonal (true pairs) bright and everything else dim.</p></div>');
    const sync = () => { imgBox.hidden = mode !== 'image'; audBox.hidden = mode !== 'audio'; spBox.hidden = mode !== 'space'; };
    P.append(imgBox, audBox, spBox); sync();
    P.append(
      ctx.h(`<div class="card tip"><p>Text becomes tokens, then vectors. Images are cut into a grid of small square patches and each patch becomes a vector. Audio is turned into a spectrogram (which frequencies are loud at each moment) and short slices become vectors. Video is a series of images over time, usually sampled a few frames per second, often with neighbouring frames merged to save tokens. Put all those vectors in one sequence and the transformer can attend across them: the word "roof" can attend to the patches that show a roof.</p></div>`),
      ctx.h(`<div class="card try"><ol>
        <li>In <b>Image</b>, step from Image to + Text and watch the picture become a sequence.</li>
        <li>Change the patch size to 8 px: four times as many tokens as 16 px. Images are expensive in tokens.</li>
        <li>In <b>Audio</b>, press play and match the sounds to shapes in the spectrogram.</li>
        <li>In <b>Shared space</b>, click the cat picture, then the caption "a red car".</li>
      </ol></div>`),
      ctx.h(`<div class="card deep">
        <p><b>Numbers:</b> the Vision Transformer (ViT) classic setup cuts a 224×224 image into 16×16 patches, giving 14×14 = 196 patch tokens. Whisper, a speech model, turns audio into 80 channel log-mel spectrogram frames, one every 10 ms from 25 ms windows, then a small convolutional stack before the transformer.</p>
        <p><b>CLIP</b> (2021) trained an image encoder and a text encoder together on about 400 million image and caption pairs from the web. The training goal (contrastive learning): in each batch, make every true pair’s vectors similar and every mismatched pair dissimilar. That is exactly the bright diagonal in the grid. The result is a shared space useful for search, zero-shot classification and guiding image generators.</p>
        <p><b>Honest label:</b> the shared space here uses hand-made toy vectors (each concept gets a group direction plus its own random direction, and pictures and captions are noisy copies of it), not a trained model, and the map positions are placed by hand to mirror the groups. Real image and text vectors also tend to sit in slightly separate regions, a known "modality gap", which the toy imitates with a small offset.</p>
        <p>Many chat models that accept images pair a vision encoder with a language model: the encoder’s patch vectors are projected into the language model’s embedding space and placed in the sequence next to the text tokens, as in the + Text step.</p>
      </div>`),
    );

    ctx.quiz([
      { q: 'How does a vision transformer turn an image into tokens?', choices: ['It describes the image in words first', 'It cuts the image into patches and maps each patch to a vector', 'It uses one token per pixel', 'It converts the image to sound'], answer: 1, why: 'Patches are flattened and projected into vectors, one token each.' },
      { q: 'What does a spectrogram show?', choices: ['The words being spoken', 'Which frequencies are loud at each moment', 'The file size', 'The speaker’s identity'], answer: 1, why: 'Time runs left to right, frequency bottom to top, brightness is loudness.' },
      { q: 'In a CLIP-style model, what does training try to do?', choices: ['Make matching pictures and captions land close together, and mismatched ones far apart', 'Generate captions word by word', 'Compress images', 'Sort images by colour'], answer: 0, why: 'Contrastive training pulls true pairs together and pushes others apart.' },
    ]);
    return () => { if (actx) { try { actx.close(); } catch { /* already closed */ } } };
  },
};
