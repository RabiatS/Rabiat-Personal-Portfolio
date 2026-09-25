// Runs Demucs entirely in the visitor's browser: models are downloaded once and cached,
// the network runs on the GPU through ONNX Runtime Web (WebGPU, falling back to CPU/WASM),
// and the STFT / iSTFT / chunking is a line-for-line port of the native Swift engine.
import { MODEL_BASE, ORT_VERSION } from './config.js';

const ORT_DIST = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
let ort = null;
const CACHE = 'rabiat-audio-models-v1';
const sessions = new Map();   // model id → { session, config, backend }

async function loadOrt() {
  if (ort) return ort;
  ort = await import(`${ORT_DIST}ort.webgpu.bundle.min.mjs`);
  ort.env.wasm.wasmPaths = ORT_DIST;
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(8, navigator.hardwareConcurrency || 4) : 1;
  return ort;
}

// ---------- Model download + cache ----------
const urls = (id) => ({ onnx: `${MODEL_BASE}${id}.onnx`, json: `${MODEL_BASE}${id}.json` });

async function isCached(id) {
  const cache = await caches.open(CACHE);
  return !!(await cache.match(urls(id).onnx));
}

async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't download the model (${res.status}). Check your connection.`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(got, total);
  }
  return new Blob(chunks);
}

async function getModel(id, onProgress) {
  const cache = await caches.open(CACHE);
  const u = urls(id);
  let onnx = await cache.match(u.onnx);
  let json = await cache.match(u.json);
  if (!json) {
    const r = await fetch(u.json);
    if (!r.ok) throw new Error(`Model info not found at ${u.json}`);
    await cache.put(u.json, new Response(await r.blob()));
    json = await cache.match(u.json);
  }
  if (!onnx) {
    const blob = await fetchWithProgress(u.onnx, onProgress);
    await cache.put(u.onnx, new Response(blob));
    onnx = await cache.match(u.onnx);
  }
  return { config: await json.json(), bytes: new Uint8Array(await onnx.arrayBuffer()) };
}

async function getSession(id, onProgress) {
  if (sessions.has(id)) return sessions.get(id);
  const { config, bytes } = await getModel(id, onProgress);
  await loadOrt();
  let session = null, backend = 'webgpu';
  if (self.navigator.gpu) {
    try {
      session = await ort.InferenceSession.create(bytes, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' });
    } catch (e) { console.warn('WebGPU failed, falling back to CPU', e); }
  }
  if (!session) {
    backend = 'wasm';
    session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  }
  const s = { session, config, backend };
  sessions.set(id, s);
  return s;
}

// ---------- FFT (radix-2, precomputed tables) ----------
function makeFFT(N) {
  const levels = Math.log2(N);
  const rev = new Uint32Array(N);
  for (let i = 0; i < N; i++) rev[i] = parseInt(i.toString(2).padStart(levels, '0').split('').reverse().join(''), 2);
  const cos = new Float64Array(N / 2), sin = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / N); sin[i] = Math.sin(2 * Math.PI * i / N); }
  // sign = -1 forward, +1 inverse (unnormalized)
  return function fft(re, im, sign) {
    for (let i = 0; i < N; i++) {
      const j = rev[i];
      if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1, step = N / size;
      for (let i = 0; i < N; i += size) {
        for (let k = 0, t = 0; k < half; k++, t += step) {
          const wr = cos[t], wi = sign * sin[t];
          const a = i + k, b = a + half;
          const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
        }
      }
    }
  };
}

// ---------- Demucs STFT / iSTFT (matches torch.stft with Demucs' padding) ----------
class DemucsSTFT {
  constructor(nfft = 4096, hop = 1024) {
    this.nfft = nfft; this.hop = hop; this.freqs = nfft / 2;
    this.fft = makeFFT(nfft);
    this.win = new Float64Array(nfft);
    for (let n = 0; n < nfft; n++) this.win[n] = 0.5 - 0.5 * Math.cos(2 * Math.PI * n / nfft);  // periodic Hann
    this.re = new Float64Array(nfft); this.im = new Float64Array(nfft);
    this.scale = 1 / Math.sqrt(nfft);
  }
  frames(length) { return Math.ceil(length / this.hop); }

  static reflect(x, left, right) {
    const n = x.length, out = new Float32Array(n + left + right);
    for (let i = 0; i < left; i++) out[i] = x[left - i];
    out.set(x, left);
    for (let j = 0; j < right; j++) out[left + n + j] = x[n - 2 - j];
    return out;
  }

  /** Both channels at once (packed as one complex signal). Writes mag = [Lre, Lim, Rre, Rim] × F × T. */
  spec2(xl, xr, mag) {
    const { nfft: N, hop, freqs: F, win, re, im, scale } = this;
    const L = xl.length, T = this.frames(L), pad = hop / 2 * 3;
    const pl = DemucsSTFT.reflect(DemucsSTFT.reflect(xl, pad, pad + T * hop - L), N / 2, N / 2);
    const pr = DemucsSTFT.reflect(DemucsSTFT.reflect(xr, pad, pad + T * hop - L), N / 2, N / 2);
    const FT = F * T;
    for (let t = 0; t < T; t++) {
      const s = (t + 2) * hop;
      for (let n = 0; n < N; n++) { re[n] = pl[s + n] * win[n]; im[n] = pr[s + n] * win[n]; }
      this.fft(re, im, -1);
      for (let f = 0; f < F; f++) {
        const g = f === 0 ? 0 : N - f;
        const i = f * T + t;
        mag[i] = (re[f] + re[g]) * 0.5 * scale;              // L real
        mag[FT + i] = (im[f] - im[g]) * 0.5 * scale;         // L imag
        mag[2 * FT + i] = (im[f] + im[g]) * 0.5 * scale;     // R real
        mag[3 * FT + i] = -(re[f] - re[g]) * 0.5 * scale;    // R imag
      }
    }
  }

  /** Inverse for one source's two channels. `spec` holds [Lre, Lim, Rre, Rim] (F × T each) at `base`. */
  ispec2(spec, base, T, length, outL, outR) {
    const { nfft: N, hop, freqs: F, win, re, im } = this;
    const FT = F * T, pad = hop / 2 * 3;
    const total = N + hop * (T + 3);
    const yl = new Float32Array(total), yr = new Float32Array(total);
    const k = 1 / Math.sqrt(N);            // normalized=True × 1/N of the inverse DFT
    for (let t = 0; t < T; t++) {
      re.fill(0); im.fill(0);
      for (let f = 0; f < F; f++) {
        const i = base + f * T + t;
        const lr = spec[i], li = spec[FT + i], rr = spec[2 * FT + i], ri = spec[3 * FT + i];
        // Z = XL + i·XR, with both spectra Hermitian-extended.
        re[f] = lr - ri; im[f] = li + rr;
        if (f > 0) { re[N - f] = lr + ri; im[N - f] = -li + rr; }
      }
      this.fft(re, im, +1);
      const s = (t + 2) * hop;
      for (let n = 0; n < N; n++) { yl[s + n] += re[n] * k * win[n]; yr[s + n] += im[n] * k * win[n]; }
    }
    const env = this.envelope(T);
    const off = N / 2 + pad;
    for (let i = 0; i < length; i++) {
      const e = env[off + i];
      outL[i] = e > 1e-11 ? yl[off + i] / e : 0;
      outR[i] = e > 1e-11 ? yr[off + i] / e : 0;
    }
  }

  envelope(T) {
    if (this._env && this._envT === T) return this._env;
    const { nfft: N, hop, win } = this;
    const env = new Float64Array(N + hop * (T + 3));
    for (let t = 0; t < T + 4; t++) for (let n = 0; n < N; n++) env[t * hop + n] += win[n] * win[n];
    this._env = env; this._envT = T;
    return env;
  }
}

// ---------- Separation (same algorithm as native/Sources/SeparationKit/Demucs.swift) ----------
async function separate(id, left, right, post) {
  const { session, config, backend } = await getSession(id, (got, total) => post({ phase: 'download', got, total }));
  post({ phase: 'ready', backend });
  const n = left.length, S = config.sources.length;
  const L = config.segment_samples, T = config.frames, F = config.nfft / 2;
  const stft = new DemucsSTFT(config.nfft, config.hop);

  // Whole-track normalization.
  let mean = 0;
  for (let i = 0; i < n; i++) mean += (left[i] + right[i]) / 2;
  mean /= Math.max(1, n);
  let v = 0;
  for (let i = 0; i < n; i++) { const d = (left[i] + right[i]) / 2 - mean; v += d * d; }
  const std = Math.max(1.1920929e-7, Math.sqrt(v / Math.max(1, n - 1)));
  const ml = new Float32Array(n), mr = new Float32Array(n);
  for (let i = 0; i < n; i++) { ml[i] = (left[i] - mean) / std; mr[i] = (right[i] - mean) / std; }

  // Triangle cross-fade weights.
  const tri = new Float32Array(L), half = L >> 1;
  for (let k = 0; k < half; k++) tri[k] = k + 1;
  for (let k = half; k < L; k++) tri[k] = L - k;
  for (let k = 0; k < L; k++) tri[k] /= half;

  const out = Array.from({ length: S }, () => [new Float32Array(n), new Float32Array(n)]);
  const sumW = new Float32Array(n);
  const stride = Math.floor(0.75 * L);
  const offsets = [];
  for (let o = 0; o < Math.max(n, 1); o += stride) offsets.push(o);

  const mix = new Float32Array(2 * L), mag = new Float32Array(4 * F * T);
  const al = new Float32Array(L), ar = new Float32Array(L);
  for (let ci = 0; ci < offsets.length; ci++) {
    const offset = offsets[ci];
    const chunkLen = Math.min(L, n - offset), delta = L - chunkLen, start = offset - (delta >> 1);
    mix.fill(0);
    for (let k = 0; k < L; k++) {
      const idx = start + k;
      if (idx >= 0 && idx < n) { mix[k] = ml[idx]; mix[L + k] = mr[idx]; }
    }
    stft.spec2(mix.subarray(0, L), mix.subarray(L), mag);

    const res = await session.run({
      mix: new ort.Tensor('float32', mix, [1, 2, L]),
      mag: new ort.Tensor('float32', mag, [1, 4, F, T]),
    });
    const spec = await res.spec.getData(), wave = await res.wave.getData();

    const trim = delta >> 1;
    for (let s = 0; s < S; s++) {
      stft.ispec2(spec, s * 4 * F * T, T, L, al, ar);
      const wl = (s * 2) * L, wr = (s * 2 + 1) * L;
      const [ol, or] = out[s];
      for (let k = 0; k < chunkLen; k++) {
        ol[offset + k] += tri[k] * (al[trim + k] + wave[wl + trim + k]);
        or[offset + k] += tri[k] * (ar[trim + k] + wave[wr + trim + k]);
      }
    }
    for (let k = 0; k < chunkLen; k++) sumW[offset + k] += tri[k];
    post({ phase: 'separate', value: (ci + 1) / offsets.length });
  }

  for (const [ol, or] of out) {
    for (let i = 0; i < n; i++) { ol[i] = ol[i] / sumW[i] * std + mean; or[i] = or[i] / sumW[i] * std + mean; }
  }
  return { backend, stems: config.sources.map((name, s) => ({ name, left: out[s][0], right: out[s][1] })) };
}

// ---------- Messages ----------
self.onmessage = async ({ data: msg }) => {
  const post = (payload) => self.postMessage({ id: msg.id, type: 'progress', ...payload });
  try {
    let result;
    switch (msg.cmd) {
      case 'cached':
        result = Object.fromEntries(await Promise.all(msg.models.map(async (m) => [m, await isCached(m)])));
        break;
      case 'download':
        await getModel(msg.model, (got, total) => post({ phase: 'download', got, total }));
        result = true;
        break;
      case 'delete': {
        const cache = await caches.open(CACHE);
        await cache.delete(urls(msg.model).onnx); await cache.delete(urls(msg.model).json);
        sessions.delete(msg.model);
        result = true;
        break;
      }
      case 'separate': {
        const r = await separate(msg.model, msg.left, msg.right, post);
        const transfer = r.stems.flatMap((s) => [s.left.buffer, s.right.buffer]);
        self.postMessage({ id: msg.id, type: 'done', result: r }, transfer);
        return;
      }
    }
    self.postMessage({ id: msg.id, type: 'done', result });
  } catch (e) {
    self.postMessage({ id: msg.id, type: 'error', message: e.message || String(e) });
  }
};
