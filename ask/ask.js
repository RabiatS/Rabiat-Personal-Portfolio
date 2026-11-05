// Ask my portfolio: a search box that answers questions about Rabiat and this
// site with passages quoted from the site itself. Retrieval only: it never
// writes a sentence of its own, so it cannot make anything up.
//
// The /ask/ page uses it, and any other page can mount it on its own markup:
//
//   import { createAsk } from '/ask/ask.js';
//   const ask = createAsk({
//     input:   document.querySelector('#q'),        // required: a text input
//     results: document.querySelector('#answers'),  // required: an empty element
//     chips:   document.querySelector('#chips'),    // optional: suggested questions go here
//     smartToggle: document.querySelector('#smart'),// optional: a button for "Smarter search"
//     syncUrl: true,                                // optional: keep ?q= in the address bar
//   });
//   ask.ask('Where did Rabiat study?');
//
// index.json and answers.json load on first use (focus, typing or a chip), so
// mounting it costs nothing until someone asks. Styles come from ask/ask.css,
// added to the page automatically unless css: false.

import { createEngine, snippet } from './search.js';

const HERE = new URL('./', import.meta.url);
const SITE = new URL('../', HERE);

export const DEFAULT_SUGGESTIONS = [
  'What does Rabiat work on?',
  'Where did Rabiat study?',
  'What XR projects has she built?',
  'How is this site built?',
  'What is the Lab?',
  'What is the Study Lab?',
  'What is Magic Mitts?',
  'What did she do at PlayStation?',
  'Tell me about the Amazon Music capstone',
];

// Cosine similarity at which a passage BM25 missed is still shown in smart mode.
// TODO: tune once the model can be tried on the live site (leaf-search shows its scores).
const SMART_MIN = 0.55;

// ---------- data, loaded once per page ----------
let dataP = null;
export function loadData() {
  return (dataP ??= Promise.all([
    fetch(new URL('index.json', HERE)).then((r) => {
      if (!r.ok) throw new Error(`Could not load the site index (${r.status})`);
      return r.json();
    }),
    // Revalidate answers so an edit shows up on the next visit.
    fetch(new URL('answers.json', HERE), { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : { answers: [] }))
      .catch(() => ({ answers: [] })),
  ]).then(([ix, an]) => ({ docs: ix.docs, engine: createEngine(ix.docs, an.answers || []) }))
    .catch((err) => { dataP = null; throw err; }));
}

function ensureCss() {
  if (document.querySelector('link[data-ask-css]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = new URL('ask.css', HERE).href;
  l.dataset.askCss = '';
  document.head.append(l);
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const external = (u) => /^https?:/i.test(u);
const hrefFor = (u) => (external(u) ? u : new URL(u, SITE).href);
function link(u, text, cls) {
  const a = el('a', cls, text);
  a.href = hrefFor(u);
  if (external(u) || /\.pdf$/i.test(u)) { a.target = '_blank'; a.rel = 'noopener'; }
  return a;
}
const storage = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createAsk({
  input, results, form = input?.form || null, chips = null,
  suggestions = DEFAULT_SUGGESTIONS, smartToggle = null, smartStatus = null,
  syncUrl = false, live = true, limit = 3, compact = false, css = true, onResult = null,
} = {}) {
  if (!input || !results) throw new Error('createAsk needs an input and a results element');
  if (css) ensureCss();

  // ---------- the results region: a live status line and the answers under it ----------
  results.classList.add('ask-results');
  if (compact) results.classList.add('ask--compact');
  const status = el('p', 'ask-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const body = el('div', 'ask-body');
  results.replaceChildren(status, body);

  let data = null;
  const load = () => loadData().then((d) => (data = d));
  const warm = () => { load().catch(() => {}); };
  input.addEventListener('focus', warm, { once: true });

  // ---------- chips ----------
  function chipRow(list, into) {
    into.replaceChildren(...list.map((q) => {
      const b = el('button', 'ask-chip', q);
      b.type = 'button';
      b.addEventListener('click', () => { input.value = q; ask(q); });
      b.addEventListener('pointerenter', warm, { once: true });
      return b;
    }));
    return into;
  }
  if (chips) { chips.classList.add('ask-chips'); chipRow(suggestions, chips); }

  // ---------- smarter search (optional, on demand) ----------
  let smart = null;          // the loaded model, or null
  let smartOn = false;
  let smartLoading = null;
  const vecs = new Map();    // passage id -> vector
  const passage = (d) => `${d.title}. ${d.text}`;
  const setSmartStatus = (t) => { if (smartStatus) smartStatus.textContent = t; };

  async function enableSmart() {
    smartOn = true;
    smartToggle?.setAttribute('aria-pressed', 'true');
    storage.set('askSmart', '1');
    if (smart) { setSmartStatus(`On, running on ${smart.where}`); rerun(); return; }
    setSmartStatus('Loading the search model, about 23 MB, once...');
    smartToggle?.setAttribute('aria-busy', 'true');
    try {
      const [{ loadSmart }] = await Promise.all([import('./smart.js'), load()]);
      smart = await (smartLoading ??= loadSmart());
      if (!smartOn) return;
      setSmartStatus(`On, running on ${smart.where}`);
      rerun();
      background();
    } catch (err) {
      smartLoading = null;
      smartOn = false;
      storage.set('askSmart', null);
      smartToggle?.setAttribute('aria-pressed', 'false');
      setSmartStatus(`Could not load the model here (${err?.message || err}). Keyword search still works.`);
    } finally {
      smartToggle?.removeAttribute('aria-busy');
    }
  }
  function disableSmart() {
    smartOn = false;
    storage.set('askSmart', null);
    smartToggle?.setAttribute('aria-pressed', 'false');
    setSmartStatus('Off. Keyword search, instant and nothing to download.');
    rerun();
  }
  if (smartToggle) {
    smartToggle.setAttribute('aria-pressed', 'false');
    smartToggle.addEventListener('click', () => (smartOn ? disableSmart() : enableSmart()));
    // Turned on before: the model is cached, so it comes back without asking.
    if (storage.get('askSmart') === '1') enableSmart();
  }

  // Embed the rest of the site in the background, a passage at a time, giving
  // way whenever a question is waiting.
  let bg = false;
  async function background() {
    if (bg || !smart) return;
    bg = true;
    try {
      let n = vecs.size;
      for (const d of data.docs) {
        if (!smartOn) break;
        if (vecs.has(d.id)) continue;
        while (smart.busy) await sleep(60);
        vecs.set(d.id, await smart.embedPassage(passage(d)));
        if (++n % 25 === 0) setSmartStatus(`On, running on ${smart.where} · read ${n} of ${data.docs.length} passages`);
      }
      if (smartOn) setSmartStatus(`On, running on ${smart.where} · all ${data.docs.length} passages read`);
    } catch { /* the next question tries again */ } finally { bg = false; }
  }

  async function rerank(q, res, token) {
    const qv = await smart.embedQuery(q);
    for (const r of res.ranked.slice(0, 30)) {
      if (!vecs.has(r.doc.id)) vecs.set(r.doc.id, await smart.embedPassage(passage(r.doc)));
      if (token !== current) return null;
    }
    // Reciprocal rank fusion: no need to put BM25 scores and cosines on one scale.
    const bm = new Map(res.ranked.map((r, i) => [r.doc.id, i]));
    const cands = data.docs.filter((d) => vecs.has(d.id)).map((d) => ({ doc: d, cos: dot(qv, vecs.get(d.id)) }));
    cands.sort((a, b) => b.cos - a.cos);
    cands.forEach((c, i) => { const r = bm.get(c.doc.id); c.score = 1 / (60 + i) + (r == null ? 0 : 1 / (60 + r)); });
    cands.sort((a, b) => b.score - a.score);
    const pages = new Set();
    const hits = [];
    for (const c of cands) {
      const k = c.doc.url.startsWith('index.html') ? c.doc.url : c.doc.url.split('#')[0];
      if (pages.has(k)) continue;
      pages.add(k);
      c.coverage = data.engine.coverageOf(q, c.doc.id);
      if (c.cos >= SMART_MIN || c.coverage >= 0.48) hits.push(c);
      if (hits.length >= limit) break;
    }
    return { ...res, hits, confident: hits.length > 0, smart: true };
  }

  // ---------- asking ----------
  let current = 0;
  let lastQ = '';
  async function ask(q) {
    q = String(q || '').trim();
    const token = ++current;
    lastQ = q;
    if (syncUrl) syncAddress(q);
    if (!q) { clear(); return null; }
    try { await load(); } catch (err) {
      if (token === current) showError(err);
      return null;
    }
    if (token !== current) return null;
    let res = data.engine.search(q, { limit });
    render(res);
    if (smartOn && smart) {
      results.setAttribute('aria-busy', 'true');
      try {
        const better = await rerank(q, res, token);
        if (better && token === current) { res = better; render(res); }
      } catch { /* keep the keyword results */ }
      finally { if (token === current) results.removeAttribute('aria-busy'); }
      background();
    }
    onResult?.(res);
    return res;
  }
  const rerun = () => { if (lastQ) ask(lastQ); };

  function clear() {
    lastQ = '';
    body.replaceChildren();
    status.textContent = '';
    results.classList.remove('has-results');
    onResult?.(null);
  }

  function showError(err) {
    body.replaceChildren(el('p', 'ask-none-title', 'Search could not load. Check your connection and try again.'));
    status.textContent = err?.message || 'Search could not load.';
    results.classList.add('has-results');
  }

  // ---------- drawing ----------
  function sourceName(u) {
    const exact = data.docs.find((d) => d.url === u) || data.docs.find((d) => d.url.split('#')[0] === u.split('#')[0]);
    if (u === 'ask/') return 'this page';
    if (/github\.com\/RabiatS\/Rabiat-Personal-Portfolio/.test(u)) return 'the site\'s code on GitHub';
    if (/\.pdf$/i.test(u)) return 'Resume (PDF)';
    if (exact) return exact.title;
    return external(u) ? new URL(u).hostname : u;
  }

  function answerCard(a) {
    const box = el('section', 'ask-answer');
    box.setAttribute('aria-label', 'Answer');
    box.append(el('p', 'ask-label', 'Answer'));
    box.append(el('p', 'ask-answer-text', a.a));
    const foot = el('p', 'ask-source');
    foot.append('Source: ');
    foot.append(link(a.link, sourceName(a.link)));
    box.append(foot);
    return box;
  }

  function hitItem(h, weights) {
    const li = el('li', 'ask-hit');
    li.append(el('p', 'ask-kind', h.doc.kind));
    li.append(el('h3', 'ask-title', h.doc.title));
    const p = el('p', 'ask-snip');
    for (const part of snippet(h.doc.text, weights)) {
      p.append(part.mark ? el('mark', null, part.text) : document.createTextNode(part.text));
    }
    li.append(p);
    const more = link(h.doc.url, 'Read more', 'ask-more');
    more.setAttribute('aria-label', `Read more: ${h.doc.title}`);
    const arrow = el('span', 'ask-arrow', external(h.doc.url) ? ' ↗' : ' →');
    arrow.setAttribute('aria-hidden', 'true');
    more.append(arrow);
    li.append(more);
    return li;
  }

  function render(res) {
    const parts = [];
    const n = res.hits.length;
    if (res.answer) parts.push(answerCard(res.answer.answer));
    if (n) {
      const head = el('h2', 'ask-sub', res.answer ? 'More from the site' : 'From the site');
      const ol = el('ol', 'ask-hits');
      ol.append(...res.hits.map((h) => hitItem(h, res.weights)));
      parts.push(head, ol);
    }
    if (!res.answer && !n) {
      const box = el('div', 'ask-none');
      box.append(el('p', 'ask-none-title', 'I could not find that on the site.'));
      box.append(el('p', 'ask-none-text', 'This only quotes what Rabiat has published, so it would rather say nothing than guess. Try asking another way, or one of these:'));
      box.append(chipRow(data.engine.related(q0(res)), el('div', 'ask-chips')));
      const p = el('p', 'ask-none-text');
      p.append('Or ', link('contact.html', 'ask Rabiat directly'), '.');
      box.append(p);
      parts.push(box);
    }
    body.replaceChildren(...parts);
    results.classList.add('has-results');
    const how = res.smart ? 'smarter search' : 'keyword search';
    const msg = res.answer
      ? `An answer and ${n} passage${n === 1 ? '' : 's'} from the site, ${how}.`
      : n ? `${n} passage${n === 1 ? '' : 's'} from the site, ${how}.`
      : `Nothing on the site matches "${res.query}".`;
    status.textContent = msg;
  }
  const q0 = (res) => res.query;

  // ---------- typing, Enter, Escape ----------
  let timer = 0;
  if (live) {
    input.addEventListener('input', () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (!q) { ask(''); return; }
      if (q.length < 2) return;
      timer = setTimeout(() => ask(q), 220);
    });
  }
  const submit = (e) => { e?.preventDefault(); clearTimeout(timer); ask(input.value); };
  if (form) form.addEventListener('submit', submit);
  else input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(e); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) { e.preventDefault(); e.stopPropagation(); input.value = ''; ask(''); }
  });

  // ---------- shareable: /ask/?q=... ----------
  let urlTimer = 0;
  function syncAddress(q) {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const u = new URL(location.href);
      if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
      if (u.href !== location.href) history.replaceState(history.state, '', u);
    }, 400);
  }
  if (syncUrl) {
    const q = new URLSearchParams(location.search).get('q');
    if (q) { input.value = q; ask(q); }
  }

  return {
    ask, clear, load,
    enableSmart, disableSmart,
    get engine() { return data?.engine || null; },
  };
}
