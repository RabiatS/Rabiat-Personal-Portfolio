// Loads one model and runs it. Each page brings an adapter module with
//   load(T, opts)            -> pipe (anything the adapter wants to keep)
//   warm(pipe, T)            optional
//   run(pipe, input, T, emit) -> { output, transfer }; emit(data) streams partial
//                               results to lab.run(..., { onPartial })
// T is Transformers.js. opts has { model, device, dtype, progress_callback }
// for Transformers.js pipelines, plus two helpers for models it can't run:
//   opts.fetchFile(path)     -> Uint8Array, cached like Transformers.js files
//                               (same cache, same pinned URL; Hugging Face, GitHub
//                               or a versioned URL, see cache.js), with progress
//   opts.ort()               -> ONNX Runtime Web 1.30.0, the Background Remover's
//                               version, for graphs with no Transformers.js class

import { openBigCache } from './bigcache.js';

const ORT_DIST = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';

let T = null;
let pipe = null;
let adapter = null;
let ortModule = null;

export async function handle(msg, post) {
  if (msg.type === 'load') return load(msg, post);
  if (msg.type === 'run') return run(msg, post);
}

async function getOrt() {
  if (ortModule) return ortModule;
  ortModule = await import(`${ORT_DIST}ort.webgpu.bundle.min.mjs`);
  ortModule.env.wasm.wasmPaths = ORT_DIST;
  ortModule.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(8, navigator.hardwareConcurrency || 4) : 1;
  return ortModule;
}

async function load(m, post) {
  let got = 0;
  const seen = new Map();
  let last = 0;
  const tally = (file, loaded) => {
    seen.set(file, loaded || 0);
    got = [...seen.values()].reduce((a, b) => a + b, 0);
    const now = performance.now();
    if (now - last > 80) { last = now; post({ type: 'progress', got }); }
  };
  // device is 'webgpu', 'wasm', or one per file (e.g. encoder on the GPU, decoder on the CPU)
  const gpu = (typeof m.device === 'string' ? [m.device] : Object.values(m.device)).includes('webgpu');
  try {
    if (gpu && !(await self.navigator.gpu?.requestAdapter())) {
      post({ type: 'error', code: 'no-webgpu', message: 'WebGPU is not available here' });
      return;
    }
    const t0 = performance.now();
    // One cache for everything, stored in parts when a file is too big for a
    // single Cache Storage entry (bigcache.js).
    const cache = await openBigCache(m.cacheKey);
    // Models on ONNX Runtime alone skip Transformers.js (T is null for them);
    // a few still borrow its tokenizers.
    if (m.needsTransformers !== false) {
      T = await import(m.runtimeUrl);
      const { env } = T;
      env.allowLocalModels = false;
      env.cacheKey = m.cacheKey;
      // Pin every request to the commit. In 4.3.0 the pre-flight file checks
      // ignore `revision` and would otherwise ask /resolve/main/ on each load.
      env.remotePathTemplate = `{model}/resolve/${m.sha}/`;
      if (cache) { env.useCustomCache = true; env.customCache = cache; }
    }
    adapter = await import(m.adapterUrl);

    const progress_callback = (p) => { if (p.status === 'progress' && p.file) tally(p.file, p.loaded); };

    // Same cache and URL scheme as Transformers.js, so the frame's "already on
    // this device" check and "Remove from this device" cover these files too.
    // Reads a response into one buffer sized from content-length, so a 1 GB
    // file costs 1 GB of memory, not the 2 to 3 GB that piecing it together would.
    const readAll = async (res, path) => {
      const total = Number(res.headers.get('content-length')) || 0;
      const reader = res.body.getReader();
      let out = new Uint8Array(total || 1 << 20), n = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (n + value.length > out.length) { const grown = new Uint8Array(Math.max(out.length * 2, n + value.length)); grown.set(out.subarray(0, n)); out = grown; }
        out.set(value, n); n += value.length; tally(path, n);
      }
      return n === out.length ? out : out.slice(0, n);
    };
    const fetchFile = async (path) => {
      const url = (m.fileBase || `https://huggingface.co/${m.repo}/resolve/${m.sha}/`) + path;
      const hit = await cache?.match(url);
      if (hit) return readAll(hit, path);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Could not download ${path} (${res.status}). Check your connection.`);
      const bytes = await readAll(res, path);
      // A failed cache write (full disk, private window) only costs a re-download next visit.
      await cache?.put(url, new Response(bytes, { headers: { 'content-length': String(bytes.length) } })).catch(() => {});
      return bytes;
    };

    pipe = await adapter.load(T, { model: m.repo, device: m.device, dtype: m.dtype, progress_callback, fetchFile, ort: getOrt });
    const t1 = performance.now();
    post({ type: 'progress', got: m.totalBytes, compiled: true });
    if (adapter.warm) await adapter.warm(pipe, T);
    post({ type: 'ready', loadMs: t1 - t0, warmMs: performance.now() - t1 });
  } catch (err) {
    // A failure after every byte arrived is the GPU refusing the model, not the network.
    const code = gpu && got >= m.totalBytes * 0.98 ? 'gpu-failed' : 'failed';
    post({ type: 'error', code, message: err?.message || String(err) });
  }
}

async function run(m, post) {
  try {
    const t0 = performance.now();
    const emit = (data, transfer) => post({ type: 'partial', id: m.id, data }, transfer);
    const { output, transfer = [] } = await adapter.run(pipe, m.input, T, emit);
    post({ type: 'result', id: m.id, output, ms: performance.now() - t0 }, transfer);
  } catch (err) {
    post({ type: 'error', id: m.id, message: err?.message || String(err) });
  }
}
