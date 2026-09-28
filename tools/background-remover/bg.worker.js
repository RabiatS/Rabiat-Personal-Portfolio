// Background removal worker. Runs ORMBG (Apache 2.0, ISNet architecture) with ONNX Runtime Web:
// the fp16 model on the GPU through WebGPU, or the int8 model on the CPU when WebGPU is missing.
// Models come from the public onnx-community repo on Hugging Face and are cached after the first load.

const ORT_VERSION = '1.30.0';
const ORT_DIST = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const BASE = 'https://huggingface.co/onnx-community/ormbg-ONNX/resolve/main/onnx/';
const MODEL = { gpu: `${BASE}model_fp16.onnx`, cpu: `${BASE}model_int8.onnx` };
export const SIZE = 1024; // ORMBG input is 1024 x 1024, RGB scaled to 0..1, no mean/std
const CACHE = 'rabiat-bg-models-v2';

let ort = null;
let session = null;
let backend = null;

async function loadOrt() {
  if (ort) return ort;
  ort = await import(`${ORT_DIST}ort.webgpu.bundle.min.mjs`);
  ort.env.wasm.wasmPaths = ORT_DIST;
  ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(8, navigator.hardwareConcurrency || 4) : 1;
  return ort;
}

async function fetchModel(url, report) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(url);
  if (hit) return new Uint8Array(await hit.arrayBuffer());
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download the model (${res.status}). Check your connection.`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    report({ phase: 'download', got, total });
  }
  const blob = new Blob(chunks);
  await cache.put(url, new Response(blob));
  return new Uint8Array(await blob.arrayBuffer());
}

// Only fetch the 84 MB GPU model when it can actually run: a real adapter that
// does half-precision maths. Some browsers expose navigator.gpu with no adapter
// (the iOS Simulator, older iPhones), which used to cost a wasted download.
async function usableGpu() {
  try {
    const a = await self.navigator.gpu?.requestAdapter();
    return !!a && a.features.has('shader-f16');
  } catch { return false; }
}

async function getSession(report) {
  if (session) return session;
  await loadOrt();
  if (await usableGpu()) {
    try {
      const bytes = await fetchModel(MODEL.gpu, report);
      report({ phase: 'compile' });
      session = await ort.InferenceSession.create(bytes, { executionProviders: ['webgpu'], graphOptimizationLevel: 'all' });
      backend = 'gpu';
      return session;
    } catch (e) {
      console.warn('WebGPU unavailable for this model, using the CPU model', e);
    }
  }
  const bytes = await fetchModel(MODEL.cpu, report);
  report({ phase: 'compile' });
  session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  backend = 'cpu';
  return session;
}

self.onmessage = async (e) => {
  const { id, type, rgba } = e.data;
  const report = (p) => self.postMessage({ id, type: 'progress', ...p });
  try {
    const s = await getSession(report);
    if (type === 'warm') { self.postMessage({ id, type: 'done', backend }); return; }
    report({ phase: 'run', backend });

    const plane = SIZE * SIZE;
    const input = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
      input[i] = rgba[i * 4] / 255;
      input[plane + i] = rgba[i * 4 + 1] / 255;
      input[2 * plane + i] = rgba[i * 4 + 2] / 255;
    }
    const t0 = performance.now();
    const out = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) });
    const ms = performance.now() - t0;
    const t = out[s.outputNames[s.outputNames.length - 1]];
    const mask = Float32Array.from(t.data);
    self.postMessage({ id, type: 'done', mask, mw: t.dims.at(-1), mh: t.dims.at(-2), backend, ms }, [mask.buffer]);
  } catch (err) {
    self.postMessage({ id, type: 'error', message: err?.message || String(err) });
  }
};
