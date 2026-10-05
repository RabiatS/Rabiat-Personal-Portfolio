// Chronos-2 inside the Lab worker, on ONNX Runtime: Transformers.js has no
// forecasting pipeline. This export takes exactly 512 past values (missing
// ones as NaN with a 0 in the mask, padding on the left) and returns 21
// quantiles for each of the next 64 steps. Scaling happens inside the graph
// (the context's mean and spread, then arcsinh, undone on the way out), so
// numbers go in and come back in the series' own units. Checked against the
// PyTorch model (chronos-forecasting 2.3.2): the same 21 x 64 numbers to 1e-4,
// on WebGPU and on WebAssembly, with short series padded as below.
const FILE = 'model.onnx';
const CONTEXT = 512, HORIZON = 64;

export async function load(T, { device, fetchFile, ort }) {
  const [bytes, rt] = await Promise.all([fetchFile(FILE), ort()]);
  floatCasts(bytes);
  const session = await rt.InferenceSession.create(bytes, {
    executionProviders: [device === 'webgpu' ? 'webgpu' : 'wasm'],
    graphOptimizationLevel: 'all',
    logSeverityLevel: 3, // its notes on which ops stay on the CPU are expected
  });
  return { ort: rt, session };
}

// One pass on a small wave so the first real forecast doesn't pay for setup.
export async function warm(pipe) {
  await forecast(pipe, Array.from({ length: 96 }, (_, i) => Math.sin(i / 3)));
}

export async function run(pipe, { values }) {
  const q = await forecast(pipe, values);
  return { output: { q, quantiles: 21, horizon: HORIZON }, transfer: [q.buffer] };
}

async function forecast({ ort, session }, values) {
  const n = Math.min(values.length, CONTEXT), off = values.length - n;
  const context = new Float32Array(CONTEXT).fill(NaN);
  const mask = new Float32Array(CONTEXT);
  for (let i = 0; i < n; i++) {
    const v = values[off + i];
    if (v != null && Number.isFinite(v)) { context[CONTEXT - n + i] = v; mask[CONTEXT - n + i] = 1; }
  }
  const out = await session.run({
    context: new ort.Tensor('float32', context, [1, CONTEXT]),
    group_ids: new ort.Tensor('int64', new BigInt64Array([0n]), [1]),
    attention_mask: new ort.Tensor('float32', mask, [1, CONTEXT]),
    // Nothing is known about the future: every covariate value missing.
    future_covariates: new ort.Tensor('float32', new Float32Array(HORIZON).fill(NaN), [1, HORIZON]),
    num_output_patches: new ort.Tensor('int64', new BigInt64Array([4n]), []),
  });
  // [1, 21, 64], quantile-major. Copy out of runtime memory before transferring.
  return new Float32Array(out.quantile_preds.data);
}

// The export checks for infinities in float64 (two Cast-to-double nodes, each
// feeding only an IsInf), and ONNX Runtime Web has no float64 kernels. A float
// value is infinite in float32 exactly when it is in float64, so those two
// casts can target float32 instead: one byte each, in memory, no lengths
// change. The file in the cache stays as downloaded. Checked against the
// original graph in native ONNX Runtime: identical outputs.
function floatCasts(bytes) {
  const enc = new TextEncoder();
  for (const name of ['/model/Cast_3', '/model/Cast_6']) {
    const n = enc.encode(name);
    const at = find(bytes, [0x1a, n.length, ...n, 0x22, 0x04, 0x43, 0x61, 0x73, 0x74]); // NodeProto name, op_type "Cast"
    // attribute { name: "to", i: 11 (DOUBLE) }
    const to = at < 0 ? -1 : find(bytes, [0x0a, 0x02, 0x74, 0x6f, 0x18, 0x0b], at, at + 64);
    if (to < 0) throw new Error('This model file is not the one this page expects');
    bytes[to + 5] = 1; // FLOAT
  }
}

function find(bytes, pat, from = 0, to = bytes.length) {
  const end = Math.min(to, bytes.length) - pat.length;
  for (let i = bytes.indexOf(pat[0], from); i >= 0 && i <= end; i = bytes.indexOf(pat[0], i + 1)) {
    let j = 1;
    while (j < pat.length && bytes[i + j] === pat[j]) j++;
    if (j === pat.length) return i;
  }
  return -1;
}
