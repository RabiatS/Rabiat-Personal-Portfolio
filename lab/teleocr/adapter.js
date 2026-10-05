// TeleOCR inside the Lab worker: RGB pixels and a task in, the page's text out.
// Text streams back to the page over a BroadcastChannel as it is written, and
// the page can stop a long read on the same channel.
import { resizeBicubicPIL, smartResize } from './pil_resize.js';

// Task prompts from the TeleOCR model card.
const PROMPTS = {
  text: 'Please output the text content from the image.',
  table: 'This is the image of a table. Please output the table in OTSL format.',
  formula: 'Please write out the expression of the formula in the image using LaTeX format.',
};
const FACTOR = 28;
const MIN_PIXELS = 3136;
// The model allows 12.8 megapixels; its full-attention layers would need gigabytes
// for that. About 1.25 megapixels (1600 image tokens) keeps print legible and the tab alive.
const MAX_PIXELS = 1600 * FACTOR * FACTOR;
const MAX_NEW_TOKENS = 2048;

export async function load(T, { model, device, dtype, progress_callback }) {
  const [processor, net] = await Promise.all([
    T.AutoProcessor.from_pretrained(model, { progress_callback }),
    T.Qwen2_5_VLForConditionalGeneration.from_pretrained(model, { device, dtype, progress_callback }),
  ]);
  return { processor, net };
}

// A tiny blank page and two tokens: compiles the GPU shaders before the first real photo.
export async function warm(pipe, T) {
  const w = 56, h = 56;
  await read(pipe, T, { rgb: new Uint8ClampedArray(w * h * 3).fill(255), w, h, task: 'text' }, { max_new_tokens: 2 });
}

export async function run(pipe, input, T) {
  return { output: await read(pipe, T, input) };
}

async function read({ processor, net }, T, { rgb, w, h, task, channel, id }, { max_new_tokens = MAX_NEW_TOKENS } = {}) {
  const bc = channel ? new BroadcastChannel(channel) : null;
  const stop = new T.InterruptableStoppingCriteria();
  if (bc) bc.onmessage = (e) => { if (e.data?.id === id && e.data.stop) stop.interrupt(); };
  try {
    // Pillow's bicubic resize to the processor's own target size, so its resize is a no-op.
    const [h2, w2] = smartResize(h, w, FACTOR, MIN_PIXELS, MAX_PIXELS);
    const px = w2 === w && h2 === h ? rgb : resizeBicubicPIL(rgb, w, h, 3, w2, h2);
    const image = new T.RawImage(px, w2, h2, 3);
    const messages = [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: [{ type: 'image' }, { type: 'text', text: PROMPTS[task] || PROMPTS.text }] },
    ];
    const prompt = processor.apply_chat_template(messages, { add_generation_prompt: true });
    const inputs = await processor(prompt, image);
    const t0 = performance.now();
    let firstMs = 0, tokens = 0, pending = [];
    // Every token goes out as soon as it decodes to whole characters. (TextStreamer
    // waits for a space, which OTSL tables and LaTeX rarely have, and re-decodes
    // everything since the last line break on every token.) Byte-level tokens
    // decode the same alone as in context, so only the new ones are decoded.
    const streamer = new (class extends T.BaseStreamer {
      prompt = true;
      put([toks]) {
        if (this.prompt) { this.prompt = false; return; }
        if (!firstMs) { firstMs = performance.now() - t0; bc?.postMessage({ id, firstMs }); }
        tokens += toks.length;
        if (!bc) return;
        pending.push(...toks);
        const piece = processor.tokenizer.decode(pending, { skip_special_tokens: true });
        if (piece.endsWith('�') && pending.length < 8) return; // half a character so far
        pending = [];
        if (piece) bc.postMessage({ id, text: piece });
      }
      end() {}
    })();
    const out = await net.generate({
      ...inputs, max_new_tokens, do_sample: false, repetition_penalty: 1.05, streamer, stopping_criteria: stop,
    });
    const text = processor.batch_decode(out.slice(null, [inputs.input_ids.dims[1], null]), { skip_special_tokens: true })[0];
    return {
      text, tokens, firstMs, decodeMs: performance.now() - t0 - firstMs,
      size: [w2, h2], imageTokens: (w2 * h2) / (FACTOR * FACTOR),
      stopped: stop.interrupted, capped: tokens >= max_new_tokens,
    };
  } finally {
    bc?.close();
  }
}
