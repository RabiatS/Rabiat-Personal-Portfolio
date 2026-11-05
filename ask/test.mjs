// Checks for Ask my portfolio. Run from the repo root after changing
// index.json (build-index.mjs), answers.json or search.js:
//
//   node ask/test.mjs
//
// It asks realistic questions and checks that the right source comes first,
// that made-up questions get "not found" rather than a guess, that drafts never
// show, that every link points at a file that exists, and that no long dash
// slipped into anything under ask/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine, snippet } from './search.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const ix = JSON.parse(fs.readFileSync(path.join(here, 'index.json'), 'utf8'));
const answers = JSON.parse(fs.readFileSync(path.join(here, 'answers.json'), 'utf8')).answers;
const engine = createEngine(ix.docs, answers);

// [question, curated answer id or null, test for the first passage's url, or null for "nothing"]
const CASES = [
  ['What does Rabiat work on?', 'what-she-works-on', (u) => u === 'index.html'],
  ['Where did Rabiat study?', 'education', (u) => u === 'index.html#education'],
  ['What XR projects has she built?', 'xr-projects', (u) => /visionpro|ar-guided|vr-|pain-xr|case-study\.html|gazeflow|weeping|vr\.html/.test(u)],
  ['How is this site built?', 'how-site-is-built', () => true],
  ['What is the Lab?', 'the-lab', (u) => u === 'lab/'],
  ['What is the Study Lab?', 'study-lab', (u) => u === 'lab/study/'],
  ['What is Magic Mitts?', null, (u) => u.startsWith('case-studies/case-study.html')],
  ['What did she do at PlayStation?', null, (u) => /Applied%20ML%20Intern|case-study-ps/.test(u)],
  ['Tell me about the Amazon Music capstone', null, (u) => /amazon-music|Project%20Manager/.test(u)],
  ['What is VisionPro Wrist Spatial Feedback?', null, (u) => u.startsWith('case-studies/visionpro-wrist-haptics.html')],
  ['Has she done any machine learning internships?', 'experience', (u) => /Applied%20ML%20Intern|case-study-ps/.test(u)],
  ['What awards has Rabiat won?', 'awards', (u) => u === 'index.html#awards' || u.startsWith('case-studies/case-study.html')],
  ['How can I contact Rabiat?', 'contact', (u) => u === 'contact.html'],
  ['Does she know Python?', 'skills', () => true],
  ['What has she written about AI?', 'writing', (u) => u.startsWith('case-studies/') || u === 'writing.html'],
  ['Can I see the site in VR?', 'vr-site', (u) => u === 'vr.html'],
  ['Where can I learn about circuits?', null, (u) => u === 'lab/circuits-lab/'],
  ['What tools has she built?', 'tools', () => true],
  ['Is there a background remover?', null, (u) => u === 'tools/background-remover/'],
  ['What did she research at CMU?', null, (u) => /Research%20Assistant|pain-xr|ethics-of-meta/.test(u)],
  ['What is Ember?', null, (u) => u.startsWith('case-studies/ember.html')],
  ['What was the Spotify study about?', null, (u) => u.startsWith('case-studies/case-study-spotify.html')],
  ['Does she have experience with haptics?', null, (u) => /visionpro|case-study\.html|watch-swipe|awards/.test(u)],
  ['What is the em dash editor?', null, (u) => u === 'em-dash-remover.html'],
  ['Which Lab model does speech to text?', null, (u) => /moonshine|voxtral/.test(u)],
  // Made-up or unanswered: must say so instead of guessing.
  ['What is her favorite food?', null, null],
  ['Is Rabiat open to work?', 'open-to-work', null],
  ['How tall is Rabiat?', null, null],
  ['asdfgh qwerty', null, null],
];

let fail = 0;
const row = (ok, msg) => { if (!ok) fail++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); };

console.log(`index: ${ix.docs.length} passages, answers: ${engine.answers.length} published\n`);
for (const [q, wantAnswer, wantTop] of CASES) {
  const r = engine.search(q);
  const top = r.hits[0]?.doc;
  const got = r.answer?.answer.id || null;
  const answerOk = got === wantAnswer;
  const topOk = wantTop ? !!top && wantTop(top.url) : !r.hits.length && (wantAnswer ? true : !r.answer);
  row(answerOk && topOk, `${q}\n       answer: ${got || '-'}   top: ${top ? `[${top.kind}] ${top.title} -> ${top.url}` : 'nothing found'}`);
  if (top) {
    const snip = snippet(top.text, r.weights);
    if (!snip.some((p) => p.mark) && wantTop) console.log('       (no highlighted words in snippet)');
  }
}

// Drafts never answer, even when asked word for word.
for (const a of answers.filter((x) => x.status !== 'published')) {
  const r = engine.search(a.q[0]);
  row(r.answer?.answer.id !== a.id, `draft "${a.id}" stays hidden`);
}

// Every link resolves: a file on disk for site paths, https for the rest.
const fileFor = (u) => {
  const p = decodeURIComponent(u.split('#')[0].split('?')[0]);
  return path.join(root, p.endsWith('/') || p === '' ? `${p}index.html` : p);
};
const links = [...ix.docs.map((d) => d.url), ...answers.map((a) => a.link)];
const broken = links.filter((u) => !/^https:\/\//.test(u) && !fs.existsSync(fileFor(u)));
row(!broken.length, `all ${links.length} links resolve${broken.length ? ': ' + [...new Set(broken)].join(', ') : ''}`);

// Passage sizes.
const words = ix.docs.map((d) => d.text.split(/\s+/).length);
row(Math.max(...words) <= 160, `passages are at most 160 words (longest ${Math.max(...words)})`);

// No long dashes anywhere in ask/.
const dashed = fs.readdirSync(here).filter((f) => /\.(html|js|mjs|css|json)$/.test(f))
  .filter((f) => /[\u2013\u2014]/.test(fs.readFileSync(path.join(here, f), 'utf8')));
row(!dashed.length, `no em or en dashes in ask/${dashed.length ? ': ' + dashed.join(', ') : ''}`);

// Speed: BM25 over the whole site should be instant.
const t0 = performance.now();
for (let i = 0; i < 50; i++) engine.search(CASES[i % CASES.length][0]);
const ms = (performance.now() - t0) / 50;
row(ms < 20, `search takes ${ms.toFixed(2)} ms per question`);

console.log(`\n${fail ? `${fail} failed` : 'all passed'}`);
process.exit(fail ? 1 : 0);
