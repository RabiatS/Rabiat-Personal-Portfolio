// SigLIP 2's image encoder inside the Lab worker: a 224 x 224 picture in, one
// 768-number embedding out, scaled to length 1 so the page can compare
// pictures with a dot product. The classes and the guessing live in the page.

export async function load(T, { model, device, dtype, progress_callback }) {
  const [processor, vision] = await Promise.all([
    T.AutoImageProcessor.from_pretrained(model, { progress_callback }),
    T.SiglipVisionModel.from_pretrained(model, { device, dtype, progress_callback }),
  ]);
  return { processor, vision };
}

// One pass so the first real picture doesn't pay for shader compiles.
export async function warm(pipe, T) {
  await embed(pipe, T, new Uint8ClampedArray(224 * 224 * 4).fill(128), 224, 224);
}

export async function run(pipe, { rgba, w, h }, T) {
  const e = await embed(pipe, T, rgba, w, h);
  return { output: { e }, transfer: [e.buffer] };
}

async function embed({ processor, vision }, T, rgba, w, h) {
  const image = new T.RawImage(rgba, w, h, 4).rgb();
  const inputs = await processor(image);
  const { pooler_output: p } = await vision(inputs);
  const v = p.type === 'float32' ? p.data : p.to('float32').data;
  const e = new Float32Array(v.length);
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < v.length; i++) e[i] = v[i] / n;
  return e;
}
