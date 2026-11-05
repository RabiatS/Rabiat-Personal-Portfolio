// "Smarter search": the optional upgrade. Loads the Lab's search model,
// mdbr-leaf-ir (MongoDB, 23M parameters, about 23 MB, Apache 2.0), through the
// same Lab frame and adapter that lab/leaf-search uses, so the files, the
// pinned commit and the browser cache are shared: if you already tried
// "Search my work" in the Lab, nothing downloads again.
//
// It never writes text either. It only turns the question and the passages
// into vectors so passages can be reranked by meaning as well as by words.
//
// Passage vectors are not precomputed: lab/leaf-search/build-index.mjs needs
// the model files in Node, which this index build does not. Instead the
// passages BM25 already likes are embedded first (so the current question is
// reranked within a second or two), and the rest of the site is embedded in
// the background, one passage at a time, so later questions can also find
// passages that share no words with them.
// TODO: if this feels slow on phones, precompute the vectors the way
// lab/leaf-search/build-index.mjs does (same q8 file, same tokenizer) and ship
// them in ask/index.json.

const site = new URL('../', import.meta.url);

export async function loadSmart({ onStatus = () => {} } = {}) {
  const { mountLab } = await import(new URL('lab/frame/frame.js', site).href);
  const lab = await mountLab({
    slug: 'leaf-search',
    adapter: new URL('lab/leaf-search/adapter.js', site).href,
    gate: null, stats: null, verb: 'search',
  });
  if (lab.state === 'blocked' || !lab.variant) {
    throw new Error('This device does not have room for the search model.');
  }
  onStatus('loading');
  // background: true keeps the Lab's full-screen veil away; this page shows its own status.
  await lab.ensure({ background: true });
  onStatus('ready');

  // One request at a time, questions ahead of background passages.
  let chain = Promise.resolve();
  let waiting = 0;
  const run = (input) => {
    const p = chain.then(() => lab.run(input)).then((r) => r.output.vec);
    chain = p.catch(() => {});
    return p;
  };
  return {
    where: lab.where,
    embedQuery: async (text) => { waiting++; try { return await run({ text }); } finally { waiting--; } },
    embedPassage: (text) => run({ text, doc: true }),
    get busy() { return waiting > 0; },
  };
}
