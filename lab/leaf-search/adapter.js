// mdbr-leaf-ir inside the Lab worker: a line of text in, a 768-number vector out.
// The ONNX graph already mean-pools, projects and normalises, so the vector is
// ready for a dot product against index.json, which build-index.mjs made with
// this same file.

const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

export async function load(T, { model, device, dtype, progress_callback }) {
  const tokenizer = await T.AutoTokenizer.from_pretrained(model, { progress_callback });
  const net = await T.AutoModel.from_pretrained(model, { device, dtype, progress_callback });
  return { tokenizer, net };
}

async function embed({ tokenizer, net }, text) {
  const inputs = tokenizer(text, { truncation: true });
  const { sentence_embedding: e } = await net(inputs);
  return new Float32Array(e.data); // a copy, so it can be transferred
}

export async function warm(p) {
  await embed(p, QUERY_PREFIX + 'warm up');
}

// Queries get the model's search prefix. Documents (doc: true) do not, the
// same way the index was built.
export async function run(p, { text, doc = false }) {
  const vec = await embed(p, doc ? text : QUERY_PREFIX + text);
  return { output: { vec }, transfer: [vec.buffer] };
}
