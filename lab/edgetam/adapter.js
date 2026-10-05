// EdgeTAM inside the Lab worker. A photo is read once by the image encoder and
// its features are kept here; every tap after that only runs the small prompt
// decoder against them, so taps come back fast.
//   { op: 'encode', rgba, w, h }        -> { ok }
//   { op: 'decode', points, labels }    -> { logits (256 x 256), score, present }
// Points are 0 to 1 across the photo; labels are 1 (add) or 0 (take away).

const SIDE = 1024; // the encoder sees every photo stretched to 1024 x 1024

export async function load(T, { model, device, dtype, progress_callback }) {
  const [processor, net] = await Promise.all([
    T.AutoProcessor.from_pretrained(model, { progress_callback }),
    T.EdgeTamModel.from_pretrained(model, { device, dtype, progress_callback }),
  ]);
  return { processor, net, feats: null, gpu: JSON.stringify(device).includes('webgpu') };
}

// On the GPU, compile the shaders once on a plain grey frame so the first photo
// is quick. The CPU has nothing to compile, so it skips this.
export async function warm(pipe, T) {
  if (!pipe.gpu) return;
  const grey = new Uint8ClampedArray(64 * 64 * 4).fill(128);
  await encode(pipe, { rgba: grey, w: 64, h: 64 }, T);
  await decode(pipe, { points: [[0.5, 0.5]], labels: [1] }, T);
  pipe.feats = null;
}

export async function run(pipe, input, T) {
  if (input.op === 'encode') return { output: await encode(pipe, input, T) };
  const out = await decode(pipe, input, T);
  return { output: out, transfer: [out.logits.buffer] };
}

async function encode(pipe, { rgba, w, h }, T) {
  const image = new T.RawImage(rgba, w, h, 4).rgb();
  const { pixel_values } = await pipe.processor(image);
  disposeFeats(pipe);
  pipe.feats = await pipe.net.get_image_embeddings({ pixel_values });
  return { ok: true };
}

async function decode(pipe, { points, labels }, T) {
  if (!pipe.feats) throw new Error('Pick a photo first');
  const n = points.length;
  const xy = new Float32Array(n * 2);
  points.forEach(([x, y], i) => { xy[i * 2] = x * SIDE; xy[i * 2 + 1] = y * SIDE; });
  const input_points = new T.Tensor('float32', xy, [1, 1, n, 2]);
  const input_labels = new T.Tensor('int64', BigInt64Array.from(labels, (l) => BigInt(l)), [1, 1, n]);
  const out = await pipe.net({ ...pipe.feats, input_points, input_labels });

  // Three candidate masks; keep the one the model rates highest.
  const scores = f32(out.iou_scores);
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
  const [mh, mw] = out.pred_masks.dims.slice(-2);
  const all = f32(out.pred_masks);
  // Copy out: the tensor may sit on WebAssembly memory, which can't be transferred.
  const logits = new Float32Array(all.subarray(best * mh * mw, (best + 1) * mh * mw));
  const present = out.object_score_logits ? f32(out.object_score_logits)[0] : 1;
  return { logits, w: mw, h: mh, score: scores[best], present };
}

function f32(t) { return t.type === 'float32' ? t.data : t.to('float32').data; }

function disposeFeats(pipe) {
  if (!pipe.feats) return;
  for (const t of Object.values(pipe.feats)) t?.dispose?.();
  pipe.feats = null;
}
