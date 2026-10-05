// ME-rPPG inside the Lab worker, on ONNX Runtime (there is no Transformers.js
// class for it). The model is recurrent: each call takes one 36 x 36 RGB crop
// of a face (values 0 to 1), the time since the last crop, and 36 state
// tensors, and gives back one sample of the pulse wave plus the new state.
// The starting state ships with the model as state.json. As in the official
// web demo, the time step is max(seconds since the last frame, 1/90), and
// 1/30 for the first frame.
//   { op: 'reset' }                         fresh state, as for a new face
//   { op: 'step', frame, t }                frame: Float32Array(36 * 36 * 3), t in seconds -> { bvp, t }

const SIZE = 36;

export async function load(T, { fetchFile, ort }) {
  const [modelBytes, stateBytes, rt] = await Promise.all([fetchFile('model.onnx'), fetchFile('state.json'), ort()]);
  const json = JSON.parse(new TextDecoder().decode(stateBytes));
  const init = Object.entries(json).map(([name, v]) => ({ name, dims: shapeOf(v), data: new Float32Array(v.flat(Infinity)) }));
  // WebAssembly, not WebGPU: for one tiny frame at a time the CPU is about
  // twice as fast here (5.5 ms against 11.5 ms a step on an M-series Mac).
  const session = await rt.InferenceSession.create(modelBytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  const { inputNames, outputNames } = session;
  // Input 0 is the face, 1 to 36 the state (in state.json's order), 37 the time step.
  // Output 0 is the pulse sample, 1 to 36 the new state, in the same order.
  if (inputNames.length !== init.length + 2 || inputNames.slice(1, -1).some((n, i) => n !== init[i].name)) {
    throw new Error('The model and its starting state do not match');
  }
  const pipe = { ort: rt, session, init, inputNames, outputNames, state: null, last: null };
  reset(pipe);
  return pipe;
}

// One pass on a grey face so the first real frame doesn't pay for setup.
export async function warm(pipe) {
  await step(pipe, { frame: new Float32Array(SIZE * SIZE * 3).fill(0.5), t: 0 });
  reset(pipe);
}

export async function run(pipe, input) {
  if (input.op === 'reset') { reset(pipe); return { output: { ok: true } }; }
  return { output: await step(pipe, input) };
}

function reset(pipe) {
  pipe.state = pipe.init.map(({ data, dims }) => new pipe.ort.Tensor('float32', data, dims));
  pipe.last = null;
}

async function step(pipe, { frame, t }) {
  const { ort, session, inputNames, outputNames } = pipe;
  const dt = Math.max(pipe.last == null ? 1 / 30 : t - pipe.last, 1 / 90);
  pipe.last = t;
  const feeds = { [inputNames[0]]: new ort.Tensor('float32', frame, [1, 1, SIZE, SIZE, 3]) };
  pipe.state.forEach((s, i) => { feeds[inputNames[i + 1]] = s; });
  feeds[inputNames[inputNames.length - 1]] = new ort.Tensor('float32', new Float32Array([dt]), []);
  const out = await session.run(feeds);
  pipe.state = outputNames.slice(1).map((n) => out[n]);
  return { bvp: out[outputNames[0]].data[0], t };
}

function shapeOf(a) {
  const dims = [];
  for (let x = a; Array.isArray(x); x = x[0]) dims.push(x.length);
  return dims;
}
