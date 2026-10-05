// RF-DETR Nano inside the Lab worker: one RGBA frame in, labelled boxes out.
//
// The model and its image processor come from the Transformers.js
// object-detection pipeline. The scoring does not: the pipeline's generic DETR
// step takes a softmax over the classes and treats the last one as "nothing",
// but RF-DETR is trained with one sigmoid per class and has no "nothing" class.
// With the softmax, a weak second guess at an object (sigmoid 0.2) can come out
// at 0.6 and show up as a duplicate box. So this does what RF-DETR's own
// post-processing does: a sigmoid on every (slot, class) score, keep the most
// likely, and stop. No non-maximum suppression: each of the 300 slots already
// claims a different object.

const FLOOR = 0.15; // the page's slider filters above this
const MAX = 100;
const LOGIT_FLOOR = Math.log(FLOOR / (1 - FLOOR));

export function load(T, { model, device, dtype, progress_callback }) {
  return T.pipeline('object-detection', model, { device, dtype, progress_callback });
}

// One pass on a blank frame so the first real one doesn't pay for shader compiles.
export async function warm(pipe, T) {
  await detect(pipe, T, new Uint8ClampedArray(384 * 384 * 4), 384, 384);
}

// The page already hands over a frame at the model's input size, so the
// processor's resize would be a slow copy (about half of each frame's time on
// a laptop GPU). Do its maths directly: scale, and normalise if the config
// asks, into the channels-first layout the model takes. Any other size, or a
// config with padding or cropping, goes through the processor as usual.
async function pixels(pipe, T, rgba, w, h) {
  const ip = pipe.processor.image_processor;
  const plain = ip.size?.width === w && ip.size?.height === h && !ip.do_pad && !ip.do_center_crop && !ip.do_flip_channel_order;
  if (!plain) return (await pipe.processor(new T.RawImage(rgba, w, h, 4).rgb())).pixel_values;
  const k = ip.do_rescale ? ip.rescale_factor : 1;
  const mean = ip.do_normalize ? ip.image_mean : [0, 0, 0], std = ip.do_normalize ? ip.image_std : [1, 1, 1];
  const n = w * h, out = new Float32Array(3 * n);
  for (let c = 0; c < 3; c++) {
    const m = mean[c], sd = std[c], o = c * n;
    for (let i = 0, j = c; i < n; i++, j += 4) out[o + i] = (rgba[j] * k - m) / sd;
  }
  return new T.Tensor('float32', out, [1, 3, h, w]);
}

const f32 = (t) => (t.type === 'float32' ? t.data : t.to('float32').data);

async function detect(pipe, T, rgba, w, h) {
  const pixel_values = await pixels(pipe, T, rgba, w, h);
  const { logits, pred_boxes } = await pipe.model({ pixel_values });
  const [, Q, C] = logits.dims;
  const L = f32(logits), B = f32(pred_boxes);
  const names = pipe.model.config.id2label;
  const dets = [];
  for (let q = 0; q < Q; q++) {
    for (let c = 0; c < C; c++) {
      const z = L[q * C + c];
      if (z < LOGIT_FLOOR || !names[c]) continue;
      // Boxes are centre, width, height as fractions of the frame.
      const cx = B[q * 4], cy = B[q * 4 + 1], w = B[q * 4 + 2], h = B[q * 4 + 3];
      const clamp = (v) => Math.min(1, Math.max(0, v));
      dets.push({
        label: names[c], score: 1 / (1 + Math.exp(-z)),
        box: [clamp(cx - w / 2), clamp(cy - h / 2), clamp(cx + w / 2), clamp(cy + h / 2)],
      });
    }
  }
  dets.sort((a, b) => b.score - a.score);
  return dets.slice(0, MAX);
}

export async function run(pipe, { rgba, w, h }, T) {
  const dets = await detect(pipe, T, rgba, w, h);
  return { output: { dets } };
}
