// Loads one model with Transformers.js and runs it. Each page brings an
// adapter module with load(T, opts), optional warm(pipe, T) and
// run(pipe, input, T) -> { output, transfer }.

let T = null;
let pipe = null;
let adapter = null;

export async function handle(msg, post) {
  if (msg.type === 'load') return load(msg, post);
  if (msg.type === 'run') return run(msg, post);
}

async function load(m, post) {
  let got = 0;
  const seen = new Map();
  // device is 'webgpu', 'wasm', or one per file (e.g. encoder on the GPU, decoder on the CPU)
  const gpu = (typeof m.device === 'string' ? [m.device] : Object.values(m.device)).includes('webgpu');
  try {
    if (gpu && !(await self.navigator.gpu?.requestAdapter())) {
      post({ type: 'error', code: 'no-webgpu', message: 'WebGPU is not available here' });
      return;
    }
    const t0 = performance.now();
    T = await import(m.runtimeUrl);
    const { env } = T;
    env.allowLocalModels = false;
    env.cacheKey = m.cacheKey;
    // Pin every request to the commit. In 4.3.0 the pre-flight file checks
    // ignore `revision` and would otherwise ask /resolve/main/ on each load.
    env.remotePathTemplate = `{model}/resolve/${m.sha}/`;
    adapter = await import(m.adapterUrl);

    let last = 0;
    const progress_callback = (p) => {
      if (p.status !== 'progress' || !p.file) return;
      seen.set(p.file, p.loaded || 0);
      got = [...seen.values()].reduce((a, b) => a + b, 0);
      const now = performance.now();
      if (now - last > 80 || p.loaded === p.total) { last = now; post({ type: 'progress', got }); }
    };
    pipe = await adapter.load(T, { model: m.repo, device: m.device, dtype: m.dtype, progress_callback });
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
    const { output, transfer = [] } = await adapter.run(pipe, m.input, T);
    post({ type: 'result', id: m.id, output, ms: performance.now() - t0 }, transfer);
  } catch (err) {
    post({ type: 'error', id: m.id, message: err?.message || String(err) });
  }
}
