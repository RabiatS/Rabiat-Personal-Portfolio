// Depth Anything V2 inside the Lab worker: RGBA pixels in, a depth map out.

export function load(T, { model, device, dtype, progress_callback }) {
  return T.pipeline('depth-estimation', model, { device, dtype, progress_callback });
}

export async function run(pipe, { rgba, w, h }, T) {
  const image = new T.RawImage(rgba, w, h, 4).rgb();
  const { predicted_depth: d } = await pipe(image);
  const [dh, dw] = d.dims.slice(-2);
  // Copy out: the tensor may sit on WebAssembly memory, which can't be transferred.
  const depth = new Float32Array(d.type === 'float32' ? d.data : d.to('float32').data);
  return { output: { depth, w: dw, h: dh }, transfer: [depth.buffer] };
}
