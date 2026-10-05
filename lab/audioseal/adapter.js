// AudioSeal inside the Lab worker, on ONNX Runtime (there is no
// Transformers.js class for it). Two graphs, exported unchanged from Meta's
// 16-bit base models (DarumaHQ/audioseal-onnx):
//   generator: audio [1, 1, T] at 16 kHz + message [1, 16] (0 or 1)
//              -> watermark [1, 1, T], to be added to the audio
//   detector:  audio [1, 1, T] -> prob [1, T], the chance each sample carries
//              the mark, and bits [1, 16], the chance each message bit is 1
// T must be a multiple of 320, so clips are padded with silence and the
// padding cut off again. Long clips go through in windows of up to 12 s.
//   { op: 'stamp', audio, bits }  -> { mark }
//   { op: 'detect', audio }       -> { found, bits, heat }
// found: the share of samples over 0.5 (the reference package's score).
// heat: the mean probability over every 10 ms, for drawing.

const FILES = { generator: 'audioseal_generator_16bits.onnx', detector: 'audioseal_detector_16bits.onnx' };
const HOP = 320, WINDOW = 192000, HEAT = 160;

export async function load(T, { device, fetchFile, ort }) {
  const [rt, g, d] = await Promise.all([ort(), fetchFile(FILES.generator), fetchFile(FILES.detector)]);
  const opts = { executionProviders: [device === 'webgpu' ? 'webgpu' : 'wasm'], graphOptimizationLevel: 'all', logSeverityLevel: 3 };
  const generator = await rt.InferenceSession.create(g, opts);
  const detector = await rt.InferenceSession.create(d, opts);
  return { rt, generator, detector };
}

// Compiles the GPU shaders (or warms the CPU kernels) on a second of quiet.
export async function warm(pipe) {
  const a = new Float32Array(16000);
  await stamp(pipe, a, new Array(16).fill(0));
  await detect(pipe, a);
}

export async function run(pipe, input) {
  if (input.op === 'stamp') {
    const mark = await stamp(pipe, input.audio, input.bits);
    return { output: { mark }, transfer: [mark.buffer] };
  }
  const out = await detect(pipe, input.audio);
  return { output: out, transfer: [out.heat.buffer] };
}

// Windows of at most WINDOW samples, as even as possible, each a multiple of HOP.
function windows(n) {
  const count = Math.max(1, Math.ceil(n / WINDOW));
  const size = Math.ceil(n / count / HOP) * HOP;
  const out = [];
  for (let a = 0; a < n; a += size) out.push([a, Math.min(n, a + size)]);
  return out;
}
function padded(audio, a, z) {
  const len = Math.ceil((z - a) / HOP) * HOP;
  const x = new Float32Array(len);
  x.set(audio.subarray(a, z));
  return x;
}

async function stamp({ rt, generator }, audio, bits) {
  const message = new rt.Tensor('int64', BigInt64Array.from(bits, (b) => BigInt(b ? 1 : 0)), [1, 16]);
  const mark = new Float32Array(audio.length);
  for (const [a, z] of windows(audio.length)) {
    const x = padded(audio, a, z);
    const r = await generator.run({ audio: new rt.Tensor('float32', x, [1, 1, x.length]), message });
    mark.set(r.watermark.data.subarray(0, z - a), a);
    r.watermark.dispose?.();
  }
  return mark;
}

async function detect({ rt, detector }, audio) {
  const n = audio.length;
  const heat = new Float32Array(Math.ceil(n / HEAT));
  const logit = new Float64Array(16);
  let over = 0;
  for (const [a, z] of windows(n)) {
    const x = padded(audio, a, z);
    const r = await detector.run({ audio: new rt.Tensor('float32', x, [1, 1, x.length]) });
    const p = r.prob.data;
    for (let i = 0; i < z - a; i++) {
      if (p[i] > 0.5) over++;
      heat[Math.floor((a + i) / HEAT)] += p[i];
    }
    // The bits are a mean over the window's frames; weigh windows by length
    // so the result matches one pass over the whole clip.
    const b = r.bits.data;
    for (let k = 0; k < 16; k++) { const q = Math.min(1 - 1e-6, Math.max(1e-6, b[k])); logit[k] += Math.log(q / (1 - q)) * (z - a); }
    r.prob.dispose?.(); r.bits.dispose?.();
  }
  for (let i = 0; i < heat.length; i++) heat[i] /= Math.min(HEAT, n - i * HEAT);
  const bits = Array.from(logit, (l) => 1 / (1 + Math.exp(-l / n)));
  return { found: n ? over / n : 0, bits, heat };
}
