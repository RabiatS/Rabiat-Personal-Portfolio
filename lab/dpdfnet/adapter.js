// DPDFNet inside the Lab worker, on ONNX Runtime (there is no Transformers.js
// class for it). The model is streaming: one 20 ms frame of spectrum in, the
// cleaned frame out, plus a state vector carried from frame to frame. Here it
// runs over a whole clip, a chunk of frames per call so the page can draw the
// result as it goes:
//   { op: 'start', audio }   48 kHz mono samples        -> { frames }
//   { op: 'step', count }    cleans the next frames     -> { done, frames, cols }
//   { op: 'finish' }                                    -> { audio }
import { stft, istft, bandMap, column } from './dsp.js';

const FILE = 'onnx/dpdfnet2_48khz_hr.onnx';
export const ROWS = 128; // spectrogram rows sent back for drawing

export async function load(T, { fetchFile, ort }) {
  const [bytes, rt] = await Promise.all([fetchFile(FILE), ort()]);
  const meta = readMetadata(bytes);
  const n = Number(meta.n_fft), sr = Number(meta.sample_rate);
  // Starting state: zeros, with the two running norms seeded from the model's own metadata.
  const init = new Float32Array(Number(meta.state_size));
  const erb = meta.erb_norm_init.split(',').map(Number), spec = meta.spec_norm_init.split(',').map(Number);
  init.set(erb, 0);
  init.set(spec, Number(meta.erb_norm_state_size));
  const session = await rt.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  return { ort: rt, session, n, sr, init, edges: bandMap(n, sr, ROWS), job: null };
}

// Shake out first-run costs on a quarter second of silence.
export async function warm(pipe) {
  await start(pipe, { audio: new Float32Array(pipe.sr / 4) });
  await step(pipe, { count: 1e9 });
  pipe.job = null;
}

export async function run(pipe, input) {
  if (input.op === 'start') return { output: await start(pipe, input) };
  if (input.op === 'step') { const out = await step(pipe, input); return { output: out, transfer: [out.cols.buffer] }; }
  const audio = finish(pipe);
  return { output: { audio }, transfer: [audio.buffer] };
}

async function start(pipe, { audio }) {
  // The reference pads one window of silence on the end so the last words make it out.
  const x = new Float32Array(audio.length + pipe.n);
  x.set(audio);
  const { spec, frames, bins } = stft(x, pipe.n);
  pipe.job = { spec, frames, bins, out: new Float32Array(spec.length), state: pipe.init.slice(), t: 0, length: audio.length };
  return { frames };
}

async function step(pipe, { count }) {
  const job = pipe.job;
  if (!job) throw new Error('Nothing to clean');
  const { ort, session, edges } = pipe;
  const { bins } = job, size = bins * 2;
  const end = Math.min(job.frames, job.t + count), first = job.t;
  const cols = new Uint8Array((end - first) * ROWS);
  for (let t = first; t < end; t++) {
    const frame = job.spec.slice(t * size, (t + 1) * size);
    const r = await session.run({
      spec: new ort.Tensor('float32', frame, [1, 1, bins, 2]),
      state_in: new ort.Tensor('float32', job.state, [job.state.length]),
    });
    job.out.set(r.spec_e.data, t * size);
    job.state = r.state_out.data;
    column(job.out, t * size, edges, cols, (t - first) * ROWS);
  }
  job.t = end;
  return { done: end, frames: job.frames, from: first, cols };
}

function finish(pipe) {
  const job = pipe.job;
  if (!job || job.t < job.frames) throw new Error('Not finished yet');
  const audio = istft(job.out, job.frames, pipe.n, job.length);
  pipe.job = null;
  return audio;
}

// The model's settings live in the ONNX file's metadata (ModelProto field 14).
// ONNX Runtime Web doesn't expose them, so read the protobuf directly: only
// the top level, skipping the graph.
function readMetadata(b) {
  let i = 0;
  const varint = () => { let v = 0, s = 1, x; do { x = b[i++]; v += (x & 0x7f) * s; s *= 128; } while (x & 0x80); return v; };
  const meta = {};
  const dec = new TextDecoder();
  while (i < b.length) {
    const key = varint(), field = Math.floor(key / 8), wire = key & 7;
    if (wire === 0) { varint(); continue; }
    if (wire === 1) { i += 8; continue; }
    if (wire === 5) { i += 4; continue; }
    if (wire !== 2) throw new Error('This file is not an ONNX model I can read');
    const len = varint(), end = i + len;
    if (field === 14) {
      let k = '', v = '';
      while (i < end) {
        const kk = varint(), l = varint();
        const s = dec.decode(b.subarray(i, i + l));
        i += l;
        if (kk >> 3 === 1) k = s; else if (kk >> 3 === 2) v = s;
      }
      meta[k] = v;
    }
    i = end;
  }
  for (const need of ['n_fft', 'sample_rate', 'state_size', 'erb_norm_state_size', 'erb_norm_init', 'spec_norm_init']) {
    if (!(need in meta)) throw new Error(`The model file is missing ${need}`);
  }
  return meta;
}
