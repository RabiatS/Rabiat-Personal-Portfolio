// Search my work: the query is embedded in the Lab worker (adapter.js) and
// compared with index.json, which build-index.mjs embedded ahead of time with
// the same model file. Rows glide to their new rank as the query changes.
import { mountLab, veil } from '../frame/frame.js';

const $ = (id) => document.getElementById(id);
const SHOW = 8;           // rows on screen
const WAIT = 110;         // ms of quiet typing before a search

const lab = await mountLab({
  slug: 'leaf-search',
  adapter: new URL('./adapter.js', import.meta.url).href,
  gate: $('gate'), stats: $('labStats'), verb: 'search',
});

// ---------- the index: one 768-number vector per project or piece of writing ----------
let indexP = null;
function getIndex() {
  return (indexP ??= fetch(new URL('./index.json', import.meta.url)).then((r) => {
    if (!r.ok) throw new Error(`Could not load the search index (${r.status})`);
    return r.json();
  }).then((ix) => {
    if (ix.sha !== lab.model.source.sha || ix.dtype !== lab.variant?.dtype) {
      console.warn('index.json was built with a different model file than this page loads. Run build-index.mjs again.');
    }
    ix.docs.forEach((d) => { d.v = Float32Array.from(d.v); });
    return ix;
  }));
}

// Closest first. A project and its essay share one page, so each page shows once,
// under whichever of the two is the closer match.
function rank(ix, q) {
  const best = new Map();
  for (const d of ix.docs) {
    let s = 0;
    for (let i = 0; i < q.length; i++) s += q[i] * d.v[i];
    const b = best.get(d.u);
    if (!b || b.score < s) best.set(d.u, { doc: d, score: s });
  }
  return [...best.values()].sort((a, b) => b.score - a.score);
}

// ---------- searching as you type ----------
let timer = 0, busy = false, wanted = '', shown = '';
function schedule(now = false) {
  clearTimeout(timer);
  wanted = $('q').value.trim();
  markExample();
  if (!wanted) { shown = ''; render([]); $('took').classList.remove('on'); return; }
  timer = setTimeout(pump, now ? 0 : WAIT);
}

async function pump() {
  if (busy || wanted === shown || !wanted) return;
  busy = true;
  const text = wanted;
  try {
    const [ix] = await Promise.all([getIndex(), lab.ensure()]);
    const { output, ms } = await lab.run({ text });
    const t0 = performance.now();
    const ranked = rank(ix, output.vec);
    const rankMs = performance.now() - t0;
    if (text === wanted) {
      shown = text;
      render(ranked.slice(0, SHOW));
      took(ms, rankMs, ix.docs.length);
    }
  } catch (err) {
    veil('That did not work', null, err?.message || String(err), { label: 'Close', onClick: () => veil(null) });
  } finally {
    busy = false;
    if (wanted !== shown) pump(); // she kept typing while that ran
  }
}

function took(ms, rankMs, n) {
  const el = $('took');
  el.replaceChildren(`${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`);
  const tier = document.createElement('span');
  tier.className = 'tier'; tier.textContent = ` · ${lab.variant.tier.toUpperCase()}`;
  el.append(tier);
  el.title = `Your words were embedded on ${lab.where} in ${ms.toFixed(1)} ms, then ranked against ${n} entries in ${rankMs.toFixed(2)} ms`;
  el.classList.add('on');
}

// ---------- results, with the rows sliding to their new places ----------
const rows = new Map(); // url -> <li>
const siteRoot = new URL('../../', import.meta.url);
const external = (u) => /^https?:/i.test(u);

function rowFor(doc) {
  let li = rows.get(doc.u);
  if (li) return li;
  li = document.createElement('li');
  li.className = 'r new';
  li.addEventListener('animationend', () => li.classList.remove('new'), { once: true });
  const a = document.createElement('a');
  a.href = external(doc.u) ? doc.u : new URL(doc.u, siteRoot).href;
  if (external(doc.u) || /\.pdf$/i.test(doc.u)) { a.target = '_blank'; a.rel = 'noopener'; }
  a.innerHTML = '<span class="meta"></span><span class="t"></span><span class="s"></span><span class="score"></span>';
  li.append(a);
  rows.set(doc.u, li);
  return li;
}

function fill(li, { doc, score }) {
  const a = li.firstChild;
  a.querySelector('.meta').textContent = [doc.k, doc.y].filter(Boolean).join(' · ');
  const t = a.querySelector('.t');
  t.textContent = doc.t;
  if (a.target === '_blank') {
    const out = document.createElement('span');
    out.className = 'out'; out.textContent = '↗'; out.setAttribute('aria-hidden', 'true');
    t.append(out);
  }
  a.querySelector('.s').textContent = doc.s;
  a.querySelector('.score').textContent = score.toFixed(2);
  a.setAttribute('aria-label', `${doc.t}, ${doc.k}, match ${score.toFixed(2)}`);
}

function render(list) {
  const ol = $('results');
  document.body.classList.toggle('searching', list.length > 0 || !!wanted);
  // FLIP: remember where every row was, move them, then animate from there.
  const before = new Map([...rows].map(([u, li]) => [u, li.getBoundingClientRect().top]));
  const keep = new Set(list.map((r) => r.doc.u));
  for (const [u, li] of rows) if (!keep.has(u)) { li.remove(); rows.delete(u); }
  const top = list[0]?.score ?? 0;
  list.forEach((r, i) => {
    const li = rowFor(r.doc);
    fill(li, r);
    // The weaker the match next to the best one, the fainter the row.
    li.style.opacity = String(Math.max(0.32, Math.min(1, 1 - (top - r.score) * 5)));
    if (!li.classList.contains('new')) li.style.animationDelay = '';
    else li.style.animationDelay = `${i * 35}ms`;
    if (ol.children[i] !== li) ol.insertBefore(li, ol.children[i] || null);
  });
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (const [u, li] of rows) {
    const was = before.get(u);
    if (was == null) continue;
    const dy = was - li.getBoundingClientRect().top;
    if (!dy) continue;
    li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }],
      { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}

function markExample() {
  document.querySelectorAll('.ex').forEach((b) => b.classList.toggle('is-selected', b.textContent === wanted));
}

// ---------- ways in: typing, or an example ----------
$('q').addEventListener('input', () => schedule());
$('q').addEventListener('focus', () => { if (lab.state !== 'blocked') getIndex().catch(() => {}); }, { once: true });
$('q').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); schedule(true); if (lab.device.phone) $('q').blur(); }
  if (e.key === 'Escape' && $('q').value) { $('q').value = ''; schedule(); }
});
document.querySelectorAll('.ex').forEach((b) => b.addEventListener('click', () => {
  $('q').value = b.textContent;
  schedule(true);
}));
