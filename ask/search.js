// The matching engine behind "Ask my portfolio". Plain BM25 over the passages
// in index.json, with light stemming, a few phrase joins and synonym groups.
// No download, no model, and it never writes text of its own: it only ranks
// passages that are already on the site and picks out a snippet to show.
//
// Works in the browser and in Node (ask/test.mjs imports it):
//   const engine = createEngine(index.docs, answers);
//   const res = engine.search('What XR projects has she built?');
//   res.answer   a curated answer from answers.json, or null
//   res.hits     passages, best first, one per page (index.html per section)
//   res.confident  false when nothing scored well enough to show as an answer

// ---------- words ----------
// Words that say nothing about which passage answers a question. The person's
// own name is here too: every page is about her, so it cannot tell pages apart.
const STOP = new Set(`a an the of to in on for with and or but by at from as into onto about over under than then so if
it its it's is are was were be been being am do does did doing done has have had having will would could should can may might must shall
i me my mine myself you your yours we us our they them their he him his she her hers herself rabiat rabiat's rabiats sadiq
what which who whom whose where when why how whats what's there here this that these those any some each every all both
tell show give list let lets let's please also just more most very really much many lot lots up out off again any anything something
thing things kind kinds sort type types like get got know want need one ones not no yes ever only own other others such via per`.split(/\s+/));

// Phrases that mean one thing, joined before splitting into words, on both
// the passages and the question, so "virtual reality" and "VR" are the same token.
const PHRASES = [
  [/\bvirtual[\s-]+reality\b/g, ' vr '],
  [/\baugmented[\s-]+reality\b/g, ' ar '],
  [/\bmixed[\s-]+reality\b/g, ' mr '],
  [/\bextended[\s-]+reality\b/g, ' xr '],
  [/\bspatial[\s-]+computing\b/g, ' spatial xr '],
  [/\bmachine[\s-]+learning\b/g, ' ml '],
  [/\bartificial[\s-]+intelligence\b/g, ' ai '],
  [/\bhuman[\s-]+computer[\s-]+interaction\b/g, ' hci '],
  [/\bcomputer[\s-]+vision\b/g, ' cv '],
  [/\bcase[\s-]+stud(?:y|ies)\b/g, ' casestudy '],
  [/\bstudy[\s-]+labs?\b/g, ' studylab '],
  [/\bvision[\s-]*pro\b/g, ' visionpro '],
  [/\bapple[\s-]+watch\b/g, ' applewatch watch '],
  [/\bweb[\s-]*xr\b/g, ' webxr xr '],
  [/\bthree\.?js\b/g, ' threejs '],
  [/\bmatter\.?js\b/g, ' matterjs '],
  [/\btransformers\.?js\b/g, ' transformersjs '],
  [/\bonnx[\s-]*runtime\b/g, ' onnxruntime onnx '],
  [/\bgithub[\s-]+pages\b/g, ' githubpages '],
  [/\bcarnegie[\s-]+mellon(?:[\s-]+university)?\b/g, ' cmu '],
  [/\bmagic[\s-]+mitts\b/g, ' magicmitts '],
  [/\bamazon[\s-]+music\b/g, ' amazonmusic '],
  [/\bbrain[\s-]+gym\b/g, ' braingym '],
  [/\bfield[\s-]+notes?\b/g, ' fieldnotes writing '],
  [/\bplay[\s-]*station\b/g, ' playstation '],
  [/\bopen[\s-]+to[\s-]+work\b/g, ' opentowork '],
  [/\bco[\s-]+founder\b/g, ' cofounder '],
  [/\bhigh[\s-]*school\b/g, ' highschool '],
];

// Irregular forms the suffix rules below cannot reach.
const IRREGULAR = {
  built: 'build', building: 'build', builds: 'build', made: 'make', making: 'make', makes: 'make',
  wrote: 'write', written: 'write', writing: 'write', writes: 'write', won: 'win', winning: 'win', wins: 'win',
  studied: 'study', studies: 'study', studying: 'study', ran: 'run', running: 'run', runs: 'run',
  went: 'go', taught: 'teach', thought: 'think', led: 'lead', leading: 'lead', leads: 'lead',
  children: 'child', people: 'person', graduated: 'graduate', graduating: 'graduate', graduates: 'graduate',
  worked: 'work', working: 'work', works: 'work', workers: 'work',
  universities: 'university', degrees: 'degree', haptics: 'haptic', headsets: 'headset',
  ios: 'ios', aws: 'aws', gcp: 'gcp', mhci: 'mhci', utsa: 'utsa', usc: 'usc', sie: 'sie', xbox: 'xbox',
  news: 'news', glass: 'glass', class: 'class', classes: 'class', process: 'process', access: 'access', analysis: 'analysis',
  physics: 'physics', thesis: 'thesis', bias: 'bias', status: 'status', gps: 'gps', canvas: 'canvas', lens: 'lens', lenses: 'lens',
};

// Light stemming: plural and verb endings only, so "projects" finds "project"
// and "visualizing" finds "visualization" is NOT attempted (that is what the
// optional model is for).
export function stem(w) {
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (w.length <= 3 || /\d/.test(w)) return w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('sses')) return w.slice(0, -2);
  if (/(ches|shes|xes|zes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith('s') && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ing')) { w = w.slice(0, -3); if (/(.)\1$/.test(w) && !/(ll|ss)$/.test(w)) w = w.slice(0, -1); return w; }
  if (w.length > 4 && w.endsWith('ed')) { w = w.slice(0, -2); if (/(.)\1$/.test(w) && !/(ll|ss)$/.test(w)) w = w.slice(0, -1); return w; }
  return w;
}

const fold = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[‘’]/g, "'");

// Text to tokens. keepStop: true keeps stop words (used for highlighting).
export function tokenize(s, { keepStop = false } = {}) {
  let t = ' ' + fold(s) + ' ';
  for (const [re, to] of PHRASES) t = t.replace(re, to);
  const out = [];
  for (let w of t.split(/[^a-z0-9#+']+/)) {
    w = w.replace(/^'+|'+$/g, '').replace(/'s$/, '');
    if (!w || (!keepStop && STOP.has(w))) continue;
    if (w.length === 1 && !/[0-9]/.test(w)) continue;
    out.push(stem(w));
  }
  return out;
}

// Synonym groups. A question word pulls in the rest of its group at half
// weight, so "XR projects" also finds "VR" and "AR" work, and "Where did she
// study" finds the education section. Words are stemmed below.
const GROUPS = [
  ['xr', 'vr', 'ar', 'mr', 'spatial', 'immersive', 'headset', 'webxr', 'quest', 'visionpro', 'unity'],
  ['ml', 'ai', 'model', 'neural', 'deep', 'llm', 'cv'],
  ['study', 'education', 'university', 'college', 'degree', 'graduate', 'bachelor', 'master', 'school', 'highschool', 'academic', 'mhci'],
  ['job', 'role', 'intern', 'internship', 'experience', 'career', 'employ', 'company', 'position'],
  ['award', 'prize', 'win', 'winner', 'honor', 'scholarship', 'recognition', 'scholar'],
  ['contact', 'email', 'reach', 'linkedin', 'touch', 'message', 'connect'],
  ['music', 'audio', 'song', 'sound', 'listen', 'spotify', 'amazonmusic'],
  ['health', 'medical', 'pain', 'biometric', 'healthkit', 'premed', 'body'],
  ['haptic', 'glove', 'vibration', 'tactile', 'magicmitts'],
  ['watch', 'wearable', 'wrist', 'watchos', 'applewatch'],
  ['site', 'website', 'portfolio', 'page'],
  ['build', 'make', 'create', 'develop', 'code'],
  ['write', 'essay', 'article', 'blog', 'fieldnotes', 'post'],
  ['tool', 'app', 'utility'],
  ['game', 'gaming', 'gameplay', 'videogame'],
  ['skill', 'technology', 'stack', 'language', 'framework'],
  ['research', 'researcher'],
  ['resume', 'cv'],
  ['hobby', 'fun', 'free', 'playground', 'cool'],
  ['learn', 'teach', 'lesson', 'chapter', 'course', 'studylab'],
  ['work', 'project', 'focus'],
];
const SYN = new Map();
for (const g of GROUPS) {
  const s = [...new Set(g.map((w) => stem(w)))];
  for (const w of s) {
    const set = SYN.get(w) || new Set();
    for (const o of s) if (o !== w) set.add(o);
    SYN.set(w, set);
  }
}
// "resume" and "cv" share a group only one way: asking for a CV should not
// pull in every computer vision project, so cv -> resume is dropped.
SYN.get('cv')?.delete('resume');
const EXPANSION = 0.45;

// ---------- the index ----------
const K1 = 1.2, B = 0.75;

export function createEngine(docs, answers = []) {
  const N = docs.length;
  const df = new Map();
  const rows = docs.map((d) => {
    // The title counts twice: a question that names a project should land on it.
    const toks = [...tokenize(d.title), ...tokenize(d.title), ...tokenize(d.kind), ...tokenize(d.text), ...tokenize(d.meta || '')];
    const tf = new Map();
    for (const t of toks) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    return { doc: d, tf, len: toks.length };
  });
  const avg = rows.reduce((s, r) => s + r.len, 0) / Math.max(1, N);
  const idf = (t) => { const n = df.get(t) || 0; return Math.log(1 + (N - n + 0.5) / (n + 0.5)); };
  const maxIdf = idf('\u0000never');

  // A question to weighted terms: its own words at 1, synonyms at EXPANSION.
  function terms(q) {
    const base = [...new Set(tokenize(q))];
    const w = new Map();
    for (const t of base) w.set(t, 1);
    for (const t of base) for (const s of SYN.get(t) || []) if (!w.has(s)) w.set(s, EXPANSION);
    return { base, weights: w };
  }

  // How much of the question a set of tokens covers, weighted by how rare each
  // word is. A word nowhere on the site counts at full rarity, so "favourite
  // food" scores near zero instead of matching some passage about food trucks.
  function coverage(base, has) {
    let total = 0, got = 0;
    for (const t of base) {
      const w = df.has(t) ? idf(t) : maxIdf;
      total += w;
      if (has(t)) got += w;
      else if ([...(SYN.get(t) || [])].some(has)) got += w * 0.6;
    }
    return total ? got / total : 0;
  }

  // A passage really is about the question when a question word is in its
  // title, or the question words occur more than once. One passing mention of
  // "tall" in a design essay is not an answer to "How tall is she?".
  const titleToks = new WeakMap();
  function strong(base, row) {
    let t = titleToks.get(row);
    if (!t) { t = new Set([...tokenize(row.doc.title), ...tokenize(row.doc.meta || '')]); titleToks.set(row, t); }
    let n = 0;
    for (const b of base) {
      if (t.has(b) || [...(SYN.get(b) || [])].some((s) => t.has(s))) return true;
      n += row.tf.get(b) || 0;
    }
    return n >= 2;
  }

  function score(row, weights) {
    let s = 0;
    for (const [t, w] of weights) {
      const f = row.tf.get(t);
      if (!f) continue;
      s += w * idf(t) * (f * (K1 + 1)) / (f + K1 * (1 - B + (B * row.len) / avg));
    }
    return s;
  }

  // ---------- curated answers ----------
  const published = answers.filter((a) => a && a.status === 'published' && a.a && Array.isArray(a.q));
  const answerRows = published.map((a) => ({ a, variants: a.q.map((q) => new Set(tokenize(q))) }));

  // Best curated answer: the question and one of its phrasings must cover each
  // other (both ways), so "What is the Lab?" does not answer "What is the Study Lab?".
  function bestAnswer(base) {
    if (!base.length) return null;
    let best = null;
    for (const r of answerRows) {
      for (const v of r.variants) {
        if (!v.size) continue;
        const has = (t) => v.has(t);
        const recall = coverage(base, has);
        const qs = new Set(base);
        const precision = coverage([...v], (t) => qs.has(t) || [...(SYN.get(t) || [])].some((s) => qs.has(s)));
        const f = recall && precision ? (2 * recall * precision) / (recall + precision) : 0;
        if (!best || f > best.score) best = { answer: r.a, score: f };
      }
    }
    return best && best.score >= 0.62 ? best : null;
  }

  // ---------- search ----------
  // Pages with several passages show once, under their best one. The home page
  // is the exception: experience, education and skills are different answers.
  const pageKey = (u) => (u.startsWith('index.html') ? u : u.split('#')[0]);

  function search(q, { limit = 3, minCoverage = 0.6 } = {}) {
    const { base, weights } = terms(q);
    const answer = bestAnswer(base);
    if (!base.length) return { query: q, terms: [], answer, hits: [], loose: [], confident: false, ranked: [] };
    const ranked = [];
    for (const row of rows) {
      const s = score(row, weights);
      if (s > 0) ranked.push({ doc: row.doc, score: s, row });
    }
    ranked.sort((a, b) => b.score - a.score);
    // Best passage per page, then keep the ones that cover enough of the question.
    const pool = [];
    const seenPages = new Set();
    for (const r of ranked) {
      const k = pageKey(r.doc.url);
      if (seenPages.has(k)) continue;
      seenPages.add(k);
      r.coverage = coverage(base, (t) => r.row.tf.has(t));
      r.strong = strong(base, r.row);
      pool.push(r);
      if (pool.length >= limit * 5) break;
    }
    // Confident when some passage covers most of the question. Then passages
    // that cover a little less can sit under it; on their own they would not show.
    const confident = pool.some((h) => h.coverage >= minCoverage && h.strong);
    // Among those, a passage that answers all of the question beats a longer one that answers half.
    const rankKey = (h) => h.score * (0.4 + 0.6 * h.coverage);
    const hits = confident
      ? pool.filter((h) => h.coverage >= minCoverage * 0.8).sort((x, y) => rankKey(y) - rankKey(x)).slice(0, limit)
      : [];
    // Loose: passages that do contain the words, but only in passing. Shown
    // as "loose matches" under an honest "not found", never as an answer.
    const loose = confident ? [] : pool.filter((h) => h.coverage >= minCoverage).slice(0, limit);
    return {
      query: q, terms: base, weights, answer, confident,
      hits: hits.map(({ row, ...h }) => h),
      loose: loose.map(({ row, ...h }) => h),
      ranked: ranked.map(({ row, ...h }) => h),
    };
  }

  // Questions from answers.json that share at least one word with q: offered
  // when nothing matched. Falls back to the first few when nothing overlaps.
  function related(q, n = 4) {
    const base = new Set(tokenize(q));
    const scored = published.map((a) => {
      const v = new Set(a.q.flatMap((x) => tokenize(x)));
      let s = 0;
      for (const t of base) { if (v.has(t)) s += 1; else if ([...(SYN.get(t) || [])].some((x) => v.has(x))) s += 0.5; }
      return { q: a.q[0], s };
    }).sort((x, y) => y.s - x.s);
    const hit = scored.filter((x) => x.s > 0).map((x) => x.q);
    return [...new Set([...hit, ...scored.map((x) => x.q)])].slice(0, n);
  }

  // Coverage of a question by one passage, for the optional model reranker.
  const byId = new Map(rows.map((r) => [r.doc.id, r]));
  function coverageOf(q, id) {
    const r = byId.get(id);
    return r ? coverage(terms(q).base, (t) => r.tf.has(t)) : 0;
  }

  return { search, related, terms, coverageOf, tokenize, size: N, answers: published };
}

// ---------- snippets ----------
// The passage window (about `size` words) with the most question words in it,
// as [{ text, mark }] parts. The words are the passage's own; nothing is reworded.
export function snippet(text, weights, size = 34) {
  const want = weights instanceof Map ? weights : new Map([...weights].map((t) => [t, 1]));
  // Words that only exist joined (virtual reality -> vr) light up too.
  const extra = new Set();
  if (want.has('vr')) extra.add('virtual').add('reality');
  if (want.has('ar')) extra.add('augmented').add('reality');
  if (want.has('ml')) extra.add('machine').add('learning');
  if (want.has('ai')) extra.add('artificial').add('intelligence');
  if (want.has('casestudy')) extra.add('case');
  if (want.has('studylab')) extra.add('study').add('lab');
  const parts = text.split(/(\s+)/);
  const wordsAt = [];
  parts.forEach((p, i) => { if (p.trim()) wordsAt.push(i); });
  const hitW = wordsAt.map((i) => {
    const raw = fold(parts[i]).replace(/[^a-z0-9#+']+/g, ' ').trim();
    if (!raw) return 0;
    let w = 0;
    for (const t of raw.split(' ')) {
      if (extra.has(t)) { w = Math.max(w, 0.5); continue; }
      const toks = tokenize(t);
      for (const s of toks) if (want.has(s)) w = Math.max(w, want.get(s));
    }
    return w;
  });
  // Two-word names joined into one token ("Magic Mitts" -> magicmitts) light up both words.
  for (let k = 0; k + 1 < wordsAt.length; k++) {
    const pair = parts[wordsAt[k]] + ' ' + parts[wordsAt[k + 1]];
    const one = new Set([...tokenize(parts[wordsAt[k]]), ...tokenize(parts[wordsAt[k + 1]])]);
    for (const s of tokenize(pair)) {
      if (!one.has(s) && want.has(s)) {
        const w = want.get(s);
        hitW[k] = Math.max(hitW[k], w); hitW[k + 1] = Math.max(hitW[k + 1], w);
      }
    }
  }
  let best = 0, bestAt = 0, sum = 0;
  for (let i = 0; i < hitW.length; i++) {
    sum += hitW[i];
    if (i >= size) sum -= hitW[i - size];
    if (sum > best) { best = sum; bestAt = Math.max(0, i - size + 1); }
  }
  // Start the window at a sentence start when one is close, so it reads well.
  let from = bestAt;
  for (let k = bestAt; k > Math.max(0, bestAt - 8); k--) {
    if (k === 0 || /[.!?]["')]?$/.test(parts[wordsAt[k - 1]])) { from = k; break; }
  }
  // Never let the step back to a sentence start push the best words out of view.
  const to = Math.min(wordsAt.length, Math.max(from + size, bestAt + size));
  const out = [];
  if (from > 0) out.push({ text: '... ', mark: false });
  for (let k = from; k < to; k++) {
    const i = wordsAt[k];
    out.push({ text: parts[i], mark: hitW[k] > 0 });
    if (k < to - 1) out.push({ text: ' ', mark: false });
  }
  if (to < wordsAt.length) out.push({ text: ' ...', mark: false });
  return out;
}
