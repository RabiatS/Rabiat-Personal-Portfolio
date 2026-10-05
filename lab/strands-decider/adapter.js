// strands-decider inside the Lab worker: a situation and typed questions in,
// one probability per option out. The ONNX graph is a single fused pass
// (input_ids, attention_mask, answer_pos, option_pos -> logits), so it runs on
// ONNX Runtime directly; only the tokenizer comes from Transformers.js.
import { renderQuestion, encodeRequest } from './prompt.js';

const GRAPH = 'onnx/model_q4f16.onnx';
const DATA = 'model_q4f16.onnx_data';

export async function load(T, { model, progress_callback, fetchFile, ort }) {
  const json = async (p) => JSON.parse(new TextDecoder().decode(await fetchFile(p)));
  const [tok, config, rt] = await Promise.all([
    T.AutoTokenizer.from_pretrained(model, { progress_callback }),
    json('config.json'),
    ort(),
  ]);
  const graph = await fetchFile(GRAPH);
  const data = await fetchFile(`onnx/${DATA}`); // stored in parts if the cache refuses one big entry
  const session = await rt.InferenceSession.create(graph, {
    executionProviders: ['webgpu'],
    externalData: [{ path: DATA, data }],
    logSeverityLevel: 3, // ORT warns that shape ops stay on the CPU, which is by design
  });
  return { tok, rt, session, cfg: config.decider, padId: config.pad_token_id ?? tok.pad_token_id ?? 0 };
}

// Compiles the GPU shaders on a short question, so the first real one is quick.
export async function warm(pipe) {
  await decide(pipe, { state: 'strawberry', questions: [{ type: 'noul', instructions: "Are there three r's in this word?" }] });
}

export async function run(pipe, input) {
  return { output: await decide(pipe, input) };
}

async function decide({ tok, rt, session, cfg, padId }, { state, questions }) {
  const rendered = questions.map(renderQuestion);
  const rows = encodeRequest(tok, state, rendered, { maxLength: cfg.max_length, maxQuestionFraction: cfg.max_question_fraction });
  // All questions about one situation go in one right-padded batch.
  const B = rows.length;
  const L = Math.max(...rows.map((r) => r.ids.length));
  const K = Math.max(...rows.map((r) => r.optionPos.length));
  const ids = new BigInt64Array(B * L).fill(BigInt(padId));
  const mask = new BigInt64Array(B * L);
  const answer = new BigInt64Array(B);
  const options = new BigInt64Array(B * K);
  rows.forEach((r, b) => {
    r.ids.forEach((t, j) => { ids[b * L + j] = BigInt(t); mask[b * L + j] = 1n; });
    answer[b] = BigInt(r.answerPos);
    r.optionPos.forEach((p, k) => { options[b * K + k] = BigInt(p); });
  });
  const out = await session.run({
    input_ids: new rt.Tensor('int64', ids, [B, L]),
    attention_mask: new rt.Tensor('int64', mask, [B, L]),
    answer_pos: new rt.Tensor('int64', answer, [B]),
    option_pos: new rt.Tensor('int64', options, [B, K]),
  });
  const logits = toFloat(out.logits);
  // Logits are before temperature: one temperature per question type, then a softmax over its options.
  const answers = rendered.map((r, b) => {
    const t = cfg.temperature_by_kind?.[r.kind] ?? cfg.temperature ?? 1;
    const z = r.labels.map((_, k) => logits[b * K + k] / t);
    const m = Math.max(...z);
    const e = z.map((v) => Math.exp(v - m));
    const s = e.reduce((a, v) => a + v, 0);
    return { kind: r.kind, labels: r.labels, probs: e.map((v) => v / s) };
  });
  return { answers, tokens: L };
}

function toFloat(t) {
  if (t.type === 'float32') return Float32Array.from(t.data);
  if (t.type !== 'float16') throw new Error(`Unexpected output type ${t.type}`);
  if (typeof Float16Array !== 'undefined' && t.data instanceof Float16Array) return Float32Array.from(t.data);
  const u = t.data;
  const f = new Float32Array(u.length);
  for (let i = 0; i < u.length; i++) {
    const h = u[i], s = h & 0x8000 ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff;
    f[i] = e === 0 ? s * 2 ** -14 * (m / 1024) : e === 31 ? (m ? NaN : s * Infinity) : s * 2 ** (e - 15) * (1 + m / 1024);
  }
  return f;
}
