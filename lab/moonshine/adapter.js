// Moonshine inside the Lab worker: 16 kHz mono audio in, text out.

export function load(T, { model, device, dtype, progress_callback }) {
  return T.pipeline('automatic-speech-recognition', model, { device, dtype, progress_callback });
}

// One short pass so the first real sentence doesn't pay for shader compiles.
export async function warm(pipe) {
  await pipe(new Float32Array(16000), { max_new_tokens: 4 });
}

export async function run(pipe, { audio }) {
  // The pipeline allows 6 tokens per whole second, which is 0 for clips under
  // a second; give short clips room to say something.
  const max_new_tokens = Math.ceil((audio.length / 16000) * 6.5) + 4;
  const { text } = await pipe(audio, { max_new_tokens });
  return { output: { text: text.trim() } };
}
