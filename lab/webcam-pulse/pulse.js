// From a stream of pulse-wave samples to a heart rate. A port of the official
// ME-rPPG web demo (github.com/Health-HCI-Group/ME-rPPG-demo, Apache 2.0):
// main.js (Kalman filters, the 300-sample buffer, the frame-rate correction,
// the steadiness test), welch_psd.onnx and get_hr.onnx (the spectrum and its
// peak). Plain JavaScript, no DOM, so it runs the same in a test.

// A one-dimensional Kalman filter, exactly as the demo writes it.
export class Kalman1D {
  constructor(q, r, x, p) { this.q = q; this.r = r; this.x = x; this.p = p; }
  update(z) {
    const p = this.p + this.q;
    const k = p / (p + this.r);
    this.x += k * (z - this.x);
    this.p = (1 - k) * p;
    return this.x;
  }
}

// ---------- Welch power spectrum, as welch_psd.onnx computes it ----------
// 300 samples (ten seconds at the 30 frames a second it assumes), five
// segments of 96 at a hop of 48 (the last 12 samples are not used), a
// symmetric Hann window, no detrending, zero-padded to 30000 points so the
// bins are 0.001 Hz apart, |FFT|^2 scaled by 2 / (fs * sum(w^2)), averaged.
// get_hr.onnx then takes the strongest bin strictly between 0.5 and 3 Hz
// (30 to 180 beats a minute): bins 501 to 2999.
export const FS = 30;
export const WINDOW = 300;
const SEG = 96, HOP = 48, NSEG = 5, NFFT = 30000, K0 = 501, K1 = 2999;
const HANN = Float64Array.from({ length: SEG }, (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (SEG - 1)));
const SCALE = 2 / (FS * HANN.reduce((a, w) => a + w * w, 0));

// Returns { bpm, k } for a 300-sample buffer (oldest first). Only the bins in
// the heart-rate band are computed, straight from the DFT sum, which is the
// same number the zero-padded FFT gives for those bins.
export function welchHeartRate(buf) {
  const xs = new Float64Array(NSEG * SEG);
  for (let s = 0; s < NSEG; s++) for (let n = 0; n < SEG; n++) xs[s * SEG + n] = buf[s * HOP + n] * HANN[n];
  const re = new Float64Array(NSEG), im = new Float64Array(NSEG);
  let best = -Infinity, bestK = K0;
  for (let k = K0; k <= K1; k++) {
    const th = (2 * Math.PI * k) / NFFT, ct = Math.cos(th), st = Math.sin(th);
    re.fill(0); im.fill(0);
    let c = 1, si = 0;
    for (let n = 0; n < SEG; n++) {
      for (let s = 0; s < NSEG; s++) { const v = xs[s * SEG + n]; re[s] += v * c; im[s] -= v * si; }
      const c2 = c * ct - si * st; si = si * ct + c * st; c = c2;
    }
    let p = 0;
    for (let s = 0; s < NSEG; s++) p += re[s] * re[s] + im[s] * im[s];
    p = (p * SCALE) / NSEG;
    if (p > best) { best = p; bestK = k; } // first maximum, like ArgMax
  }
  return { bpm: bestK * 0.001 * 60, k: bestK };
}

// ---------- the demo's main-thread bookkeeping ----------
// Per processed frame: tick(t). Per model output: push(bvp), which returns
//   { value }            the Kalman-smoothed pulse sample (null while the first 30 are dropped)
//   { hr }               every 30 samples once 90 are in: { raw, bpm, err, steady }
export class PulseTracker {
  constructor() { this.reset(); }

  reset() {
    this.drop = 30;              // the recurrent state settles over the first second
    this.kfOut = null;
    this.buf = new Array(WINDOW).fill(0);
    this.count = WINDOW - 90;    // first estimate after 90 samples, then every 30
    this.kfHr = null;
    this.err = 0.04;             // mean relative change of the estimate
    this.steady = false;
    this.times = [];
    this.samples = 0;
  }

  tick(t) {
    this.times.push(t);
    if (this.times.length > WINDOW + 1) this.times.shift();
  }

  // Frames a second over the last 300 frames, ignoring gaps over half a second.
  fps() {
    let total = 0, n = 0;
    for (let i = 1; i < this.times.length; i++) {
      const d = this.times[i] - this.times[i - 1];
      if (d <= 0.5) { total += d; n++; }
    }
    return total > 0 ? n / total : 0;
  }

  push(bvp) {
    if (this.drop) { this.drop--; return { value: null, hr: null }; }
    if (!this.kfOut) this.kfOut = new Kalman1D(1, 0.5, bvp, 1);
    else this.kfOut.update(bvp);
    const value = this.kfOut.x;
    this.buf.shift(); this.buf.push(value);
    this.samples++;
    if (++this.count < WINDOW) return { value, hr: null };
    this.count = WINDOW - 30;

    const est = welchHeartRate(this.buf);
    // A maximum on the very edge of the band (exactly 30 or 180) is not a
    // peak: the spectrum is just sloping (early on, the zeros the buffer
    // starts with). The demo shows it anyway; here it is skipped.
    if (est.k === K0 || est.k === K1) return { value, hr: null };
    let raw = est.bpm;
    // The spectrum assumes 30 frames a second; rescale by the real rate. The
    // demo waits for 300 timestamps before it does this; here it starts once
    // there are 30, so a camera running at 15 or 24 fps reads right from the
    // first estimate instead of being off for the first ten seconds.
    if (this.times.length > 30) { const f = this.fps(); if (f > 0) raw = (raw / FS) * f; }
    if (!this.kfHr) this.kfHr = new Kalman1D(1, 2, raw, 1);
    else this.kfHr.update(raw);
    const bpm = this.kfHr.x;
    this.err = 0.8 * this.err + 0.2 * Math.abs(bpm - raw) / raw;
    // The demo's steadiness test, with its hysteresis.
    if (this.err < 0.02) this.steady = true;
    else if (this.err > 0.025) this.steady = false;
    return { value, hr: { raw, bpm, err: this.err, steady: this.steady } };
  }
}
