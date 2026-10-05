// Builds lab/leaf-search/index.json: every project and piece of writing on the
// site, embedded ahead of time with mdbr-leaf-ir, so the browser only has to
// embed the query.
//
// Run it again whenever assets/projects.json or assets/writing.json changes.
// It needs Node 18 or newer and Transformers.js 4.3.0, installed OUTSIDE the
// repo (nothing here has a package.json on purpose):
//
//   npm --prefix /tmp/leaf-build install @huggingface/transformers@4.3.0
//   TJS_DIR=/tmp/leaf-build node lab/leaf-search/build-index.mjs
//
// Run from the repo root. The model files download once into
// /tmp/leaf-build/.cache. The repo, commit, dtype and file list come from
// entry.json, so these vectors come from the very same ONNX file the page
// loads (the q8 file, onnx/model_quantized.onnx).
//
// Why not Transformers.js's own Node backend: it runs the file on
// onnxruntime-node, whose int8 kernels round differently from the browser's
// WebAssembly ones (cosine about 0.99 between the two). So the tokenizer comes
// from Transformers.js, and the model runs on the onnxruntime-web build that
// Transformers.js 4.3.0 itself ships to browsers, single-threaded like a
// GitHub Pages tab. A query typed on the page then matches these numbers
// exactly, not nearly.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const entry = JSON.parse(fs.readFileSync(path.join(here, 'entry.json'), 'utf8'));
const variant = entry.variants[0];
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

// ---------- Transformers.js 4.3.0 and its onnxruntime-web, from TJS_DIR ----------
const dir = process.env.TJS_DIR && path.resolve(process.env.TJS_DIR);
if (!dir) {
  console.error('Set TJS_DIR to a folder where @huggingface/transformers@4.3.0 is installed. See the top of this file.');
  process.exit(1);
}
const pkg = (name) => JSON.parse(fs.readFileSync(path.join(dir, 'node_modules', name, 'package.json'), 'utf8'));
const version = pkg('@huggingface/transformers').version;
if (version !== '4.3.0') console.warn(`Warning: Transformers.js ${version}; the page uses 4.3.0.`);
const ortVersion = pkg('onnxruntime-web').version;
const T = await import(pathToFileURL(path.join(dir, 'node_modules/@huggingface/transformers/dist/transformers.node.mjs')).href);
const ort = await import(pathToFileURL(path.join(dir, 'node_modules/onnxruntime-web/dist/ort.node.min.mjs')).href);
ort.env.wasm.numThreads = 1;
console.log(`Transformers.js ${version}, onnxruntime-web ${ortVersion} (WebAssembly)`);

const repo = entry.source.repo;
const sha = entry.source.sha;
const cacheDir = path.join(dir, '.cache');
T.env.cacheDir = cacheDir;
// Pin every file to the commit in entry.json, the same way the Lab worker does.
T.env.remotePathTemplate = `{model}/resolve/${sha}/`;
const tokenizer = await T.AutoTokenizer.from_pretrained(repo);

// The model file and its weights, fetched once at the pinned commit.
async function file(name) {
  const local = path.join(cacheDir, repo, sha, name);
  if (!fs.existsSync(local)) {
    const res = await fetch(`https://huggingface.co/${repo}/resolve/${sha}/${name}`);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.writeFileSync(local, Buffer.from(await res.arrayBuffer()));
  }
  const bytes = new Uint8Array(fs.readFileSync(local));
  if (entry.files[name] && bytes.length !== entry.files[name]) throw new Error(`${name}: ${bytes.length} bytes, entry.json says ${entry.files[name]}`);
  return bytes;
}
const onnx = variant.files.find((f) => f.endsWith('.onnx'));
const data = variant.files.filter((f) => f.startsWith(onnx) && f !== onnx);
const session = await ort.InferenceSession.create(await file(onnx), {
  executionProviders: ['wasm'],
  externalData: await Promise.all(data.map(async (f) => ({ path: path.basename(f), data: await file(f) }))),
});

// The ONNX graph already mean-pools, projects to 768 and normalises.
async function embed(text) {
  const enc = tokenizer(text, { truncation: true });
  const feeds = {};
  for (const k of session.inputNames) feeds[k] = new ort.Tensor('int64', enc[k].data, enc[k].dims);
  const { sentence_embedding: e } = await session.run(feeds);
  return Array.from(e.data);
}

// ---------- the corpus ----------
const projects = JSON.parse(fs.readFileSync(path.join(root, 'assets/projects.json'), 'utf8')).projects
  .filter((p) => p.status !== 'template'); // placeholders the projects page hides too
const pieces = JSON.parse(fs.readFileSync(path.join(root, 'assets/writing.json'), 'utf8')).pieces;

// Where a result goes: the same order the projects page uses for a card's title.
// Site pages stay relative to the site root; the page resolves them.
function linkFor(p) {
  if (p.caseStudy) return p.caseStudy;
  if (p.demo) return p.demo;
  if (p.github && !/^https:\/\/github\.com\/RabiatS\/?$/.test(p.github)) return p.github;
  return `projects.html#${p.id}`;
}

const firstSentence = (s) => (s.match(/^.*?[.!?](\s|$)/)?.[0] || s).trim();

// One passage per entry, written the way a person would describe it. The whole
// write-up fits the model's 512 tokens; splitting it into smaller passages
// ranked no better on the example queries and doubled the file.
const docs = [];
for (const p of projects) {
  docs.push({
    k: 'Project', y: String(p.year || ''), t: p.title, s: p.subtitle || '', u: linkFor(p),
    text: [
      `${p.title}: ${p.subtitle || ''}.`,
      p.description,
      p.longDescription || '',
      p.awards?.length ? `Awards: ${p.awards.join(', ')}.` : '',
      `${p.category}. ${[...(p.tags || []), ...(p.technologies || [])].join(', ')}.`,
    ].filter(Boolean).join(' '),
  });
}
for (const w of pieces) {
  docs.push({
    k: w.kind, y: (w.date || '').slice(0, 4), t: w.title, s: firstSentence(w.blurb), u: w.href,
    text: `${w.title}. ${w.kind}. ${w.blurb} Topics: ${(w.topics || []).join(', ')}.`,
  });
}

// ---------- embed ----------
const round = (x) => Math.round(x * 1e4) / 1e4;
const t0 = performance.now();
for (const d of docs) {
  const tokens = tokenizer(d.text).input_ids.dims.at(-1);
  if (tokens > 512) console.warn(`${d.t}: ${tokens} tokens, only the first 512 count`);
  d.v = (await embed(d.text)).map(round);
}
console.log(`Embedded ${docs.length} entries in ${((performance.now() - t0) / 1000).toFixed(1)} s`);

const out = {
  model: repo, sha: entry.source.sha, dtype: variant.dtype,
  file: onnx, transformers: version, onnxruntime: `web ${ortVersion}`,
  queryPrefix: QUERY_PREFIX, dims: docs[0].v.length, built: new Date().toISOString().slice(0, 10),
  docs: docs.map(({ text, ...d }) => d),
};
fs.writeFileSync(path.join(here, 'index.json'), JSON.stringify(out) + '\n');
console.log(`Wrote lab/leaf-search/index.json (${(fs.statSync(path.join(here, 'index.json')).size / 1024).toFixed(0)} KB)`);

// ---------- a quick look at what the examples on the page return ----------
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
for (const q of ['something I can wear', 'maps and navigation', 'music', 'health']) {
  const qv = await embed(QUERY_PREFIX + q);
  const best = new Map(); // a project and its essay share a page: keep the better one
  for (const d of out.docs) {
    const s = dot(qv, d.v);
    if (!best.has(d.u) || best.get(d.u).s < s) best.set(d.u, { s, t: d.t });
  }
  const top = [...best.values()].sort((a, b) => b.s - a.s).slice(0, 4);
  console.log(`\n${q}\n` + top.map((r) => `  ${r.s.toFixed(3)}  ${r.t}`).join('\n'));
}
