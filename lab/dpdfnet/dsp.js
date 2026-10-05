// The signal maths DPDFNet expects around it, shared by the page and the worker.
// STFT and ISTFT as in Ceva's reference code (librosa defaults): a Vorbis
// window, hop of half a window, frames centred with reflect padding. The FFT
// handles any length made of small factors (960 = 4 · 4 · 4 · 3 · 5).

export function vorbis(n) {
  const w = new Float32Array(n), h = n / 2;
  for (let i = 0; i < n; i++) { const s = Math.sin(0.5 * Math.PI * (i + 0.5) / h); w[i] = Math.sin(0.5 * Math.PI * s * s); }
  return w;
}

// Mixed-radix FFT, out of place: fft(xr, xi, yr, yi) writes the transform of x into y.
export function makeFFT(n) {
  const factors = [];
  let m = n;
  for (const p of [4, 2, 3, 5]) while (m % p === 0) { factors.push(p); m /= p; }
  if (m > 1) factors.push(m);
  const cos = new Float64Array(n), sin = new Float64Array(n);
  for (let k = 0; k < n; k++) { cos[k] = Math.cos(-2 * Math.PI * k / n); sin[k] = Math.sin(-2 * Math.PI * k / n); }
  const pmax = Math.max(...factors);
  const tr = new Float64Array(pmax), ti = new Float64Array(pmax);

  function rec(xr, xi, o, s, len, f, yr, yi, yo) {
    if (len === 1) { yr[yo] = xr[o]; yi[yo] = xi[o]; return; }
    const p = factors[f], m = len / p, step = n / len;
    for (let q = 0; q < p; q++) rec(xr, xi, o + q * s, s * p, m, f + 1, yr, yi, yo + q * m);
    for (let k = 0; k < m; k++) {
      for (let q = 0; q < p; q++) {
        const zr = yr[yo + q * m + k], zi = yi[yo + q * m + k], e = (q * k * step) % n;
        tr[q] = zr * cos[e] - zi * sin[e]; ti[q] = zr * sin[e] + zi * cos[e];
      }
      for (let r = 0; r < p; r++) {
        let sr = 0, si = 0;
        for (let q = 0; q < p; q++) {
          const e = (q * r * m * step) % n;
          sr += tr[q] * cos[e] - ti[q] * sin[e]; si += tr[q] * sin[e] + ti[q] * cos[e];
        }
        yr[yo + r * m + k] = sr; yi[yo + r * m + k] = si;
      }
    }
  }
  return (xr, xi, yr, yi) => rec(xr, xi, 0, 1, n, 0, yr, yi, 0);
}

// Frames of [re, im] per bin, laid out [frame][bin][2]: the model's spec input.
export function stft(x, n) {
  const hop = n / 2, bins = n / 2 + 1, pad = n / 2, L = x.length;
  const frames = 1 + Math.floor(L / hop);
  const win = vorbis(n), fft = makeFFT(n);
  const xr = new Float64Array(n), xi = new Float64Array(n), yr = new Float64Array(n), yi = new Float64Array(n);
  const out = new Float32Array(frames * bins * 2);
  for (let t = 0; t < frames; t++) {
    for (let i = 0; i < n; i++) {
      let j = t * hop + i - pad;
      if (j < 0) j = -j; else if (j >= L) j = 2 * (L - 1) - j;
      xr[i] = (j >= 0 && j < L ? x[j] : 0) * win[i]; xi[i] = 0;
    }
    fft(xr, xi, yr, yi);
    const o = t * bins * 2;
    for (let k = 0; k < bins; k++) { out[o + 2 * k] = yr[k]; out[o + 2 * k + 1] = yi[k]; }
  }
  return { spec: out, frames, bins };
}

// Overlap-add back to samples, then line the output up with the input the way
// the reference code does (it trims half a window, then two whole windows).
export function istft(spec, frames, n, length) {
  const hop = n / 2, bins = n / 2 + 1;
  const win = vorbis(n), fft = makeFFT(n);
  const total = n + hop * (frames - 1);
  const ola = new Float32Array(total), env = new Float32Array(total);
  const xr = new Float64Array(n), xi = new Float64Array(n), yr = new Float64Array(n), yi = new Float64Array(n);
  for (let t = 0; t < frames; t++) {
    const o = t * bins * 2;
    // inverse by the conjugate trick on the full Hermitian spectrum
    for (let k = 0; k < bins; k++) { xr[k] = spec[o + 2 * k]; xi[k] = -spec[o + 2 * k + 1]; }
    for (let k = bins; k < n; k++) { xr[k] = spec[o + 2 * (n - k)]; xi[k] = spec[o + 2 * (n - k) + 1]; }
    fft(xr, xi, yr, yi);
    const s = t * hop;
    for (let i = 0; i < n; i++) { ola[s + i] += (yr[i] / n) * win[i]; env[s + i] += win[i] * win[i]; }
  }
  const shift = n / 2 + 2 * n;
  const y = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const j = i + shift;
    if (j >= total) break;
    y[i] = env[j] > 1e-8 ? ola[j] / env[j] : ola[j];
  }
  return y;
}

// One spectrogram column for drawing: bins folded onto `rows` log-spaced bands,
// 0 to 255. Shared so the noisy and the cleaned pictures use the same scale.
export function bandMap(n, sr, rows, lo = 60, hi = 16000) {
  const bins = n / 2 + 1, edges = new Int32Array(rows + 1);
  for (let r = 0; r <= rows; r++) {
    const f = lo * Math.pow(hi / lo, r / rows);
    edges[r] = Math.min(bins - 1, Math.max(1, Math.round(f / (sr / n))));
  }
  return edges;
}
export function column(spec, o, edges, out, oo) {
  const rows = edges.length - 1;
  for (let r = 0; r < rows; r++) {
    let p = 0;
    const a = edges[r], b = Math.max(a + 1, edges[r + 1]);
    for (let k = a; k < b; k++) { const re = spec[o + 2 * k], im = spec[o + 2 * k + 1]; p += re * re + im * im; }
    const db = 10 * Math.log10(p / (b - a) + 1e-12);
    out[oo + r] = Math.max(0, Math.min(255, (db + 30) * (255 / 65)));
  }
}
