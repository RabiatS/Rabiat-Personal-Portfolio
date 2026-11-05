// CRNA Lab shared helpers: the drug data (from FDA labels), source links, the disclaimer and media credits.
import { esc } from '../study/kit/kit.js';

export { esc };
export const NOT_STATED = 'Not stated in the FDA label';

export const DISCLAIMER = 'Educational study aid only. It is not clinical guidance and not a substitute for the current full prescribing information, your program\'s references or clinical judgment. Labels change: verify every dose and fact against the current label before use.';

export const ABOUT_HTML = `<p><b>${DISCLAIMER}</b></p>
<p>Drug facts are read from FDA drug labels (structured product labeling via openFDA and DailyMed, U.S. National Library of Medicine, public domain). Each field links to the exact label, version and section it came from. Where a label does not state something, the card says "${NOT_STATED}" instead of filling it in.</p>
<p>The difficult airway approach points to the 2022 American Society of Anesthesiologists Practice Guidelines for Management of the Difficult Airway. Read the guideline itself for the algorithm.</p>
`;

const DATA = new URL('./data/', import.meta.url).href;
const MEDIA = new URL('./media/', import.meta.url).href;
export const mediaUrl = (f) => MEDIA + f;

let drugsP = null;
export function loadDrugs() {
  if (!drugsP) drugsP = fetch(`${DATA}drugs.json`).then((r) => { if (!r.ok) throw new Error('drug data missing'); return r.json(); });
  return drugsP;
}
let mediaP = null;
export function loadMedia() {
  if (!mediaP) mediaP = fetch(`${MEDIA}media.json`).then((r) => (r.ok ? r.json() : { items: [] })).catch(() => ({ items: [] }));
  return mediaP;
}

// A field is label sourced when it has a section; lists are sourced when their first item is
export const stated = (f) => (Array.isArray(f) ? f.length > 0 && !!f[0].src : !!(f && f.src));
export const items = (f) => (Array.isArray(f) ? f : f ? [f] : []);

export const CATS = { anesthesia: 'Anesthesia', cardiac: 'Cardiac', supporting: 'Supporting' };
export const CAT_COLOR = { anesthesia: '#5EEAD4', cardiac: '#FB7185', supporting: '#FBBF24' };

export function fmtDate(d) {
  if (!d || d.length < 8) return d || '';
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+d.slice(4, 6) - 1];
  return `${m} ${+d.slice(6, 8)}, ${d.slice(0, 4)}`;
}

// Small source line: section, label version and date, linked to DailyMed
export function srcLink(drug, section, extra = '') {
  const L = drug.label;
  if (!section) return `<span class="src none">${esc(NOT_STATED)}</span>`;
  return `<a class="src" href="${esc(L.url)}" target="_blank" rel="noopener" title="Set id ${esc(L.setid)}">${esc(section)} · ${esc(L.brand || L.generic || drug.name)} label v${esc(L.version)}, ${esc(fmtDate(L.effective))}${extra}</a>`;
}

// Paragraphs and list lines from label text
export function labelText(t) {
  const lines = String(t).split('\n').map((s) => s.trim()).filter(Boolean);
  let out = ''; let inList = false;
  for (const l of lines) {
    if (/^-\s*/.test(l) && l.length > 2) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${esc(l.replace(/^-\s*/, ''))}</li>`; continue; }
    if (inList) { out += '</ul>'; inList = false; }
    if (l.includes(' | ')) out += `<p class="trow">${l.split(' | ').map((c) => `<span>${esc(c)}</span>`).join('')}</p>`;
    else out += `<p>${esc(l)}</p>`;
  }
  if (inList) out += '</ul>';
  return out;
}

// Format a curated timeline value in minutes
export function fmtMin(v) {
  if (v == null) return '';
  if (v < 1) return `${Math.round(v * 60)} s`;
  if (v >= 120 && v % 60 === 0) return `${v / 60} h`;
  if (v >= 90) return `${+(v / 60).toFixed(1)} h`;
  return `${+v.toFixed(1)} min`;
}
export function fmtTL(t) {
  if (!t) return '';
  const a = fmtMin(t.min); const b = fmtMin(t.max);
  if (t.mid != null) return `median ${fmtMin(t.mid)} (range ${a} to ${b})`;
  switch (t.qual) {
    case 'within': return `within ${b}`;
    case 'lt': return `under ${b}`;
    case 'upto': return `up to ${b}`;
    case 'about': return `about ${a}`;
    default: return t.min === t.max ? a : `${a} to ${b}`;
  }
}

// Named antidote or reversal agent inside a reversal sentence (for quizzes)
const AGENTS = [['naloxone', 'Naloxone'], ['nalmefene', 'Nalmefene'], ['flumazenil', 'Flumazenil'], ['sugammadex', 'Sugammadex'], ['neostigmine', 'Neostigmine'], ['protamine', 'Protamine'], ['dantrolene', 'Dantrolene'], ['physostigmine', 'Physostigmine'], ['digoxin immune fab', 'Digoxin immune fab'], ['acetylcysteine', 'N-acetylcysteine'], ['phentolamine', 'Phentolamine'], ['methylene blue', 'Methylene blue'], ['sodium thiosulfate', 'Sodium thiosulfate']];
export function namedAgent(drug) {
  if (!stated(drug.reversal)) return null;
  const txt = items(drug.reversal).map((x) => x.text).join(' ').toLowerCase();
  const hit = AGENTS.find(([k]) => txt.includes(k));
  return hit ? { agent: hit[1], item: items(drug.reversal).find((x) => x.text.toLowerCase().includes(hit[0])) } : null;
}

// Hide the drug's own names inside a quoted sentence
export function mask(drug, text) {
  const names = new Set([drug.name.split(' ')[0], drug.label.brand, drug.label.generic, ...(drug.label.generic || '').split(' ')].filter((n) => n && n.length > 3));
  let t = text;
  for (const n of names) t = t.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '____');
  return t.replace(/(____\s*){2,}/g, '____ ');
}

export function shuffle(a, rnd = Math.random) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
export const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Fill the credits in the about popover once media.json is known
export async function fillCredits() {
  const el = document.getElementById('crna-credits');
  if (!el) return;
  const m = await loadMedia();
  if (!m.items || !m.items.length) { el.textContent = ''; return; }
  el.innerHTML = `Laryngoscopy media (Wikimedia Commons, each under its own open licence): ${m.items.map((it) => `<a href="${esc(it.source)}" target="_blank" rel="noopener">${esc(it.title)}</a> by ${esc(it.author)}, ${esc(it.license)}`).join('; ')}.`;
}

export function disclaimerCard(h) {
  return h(`<div class="card crna-warn"><b>Study aid, not clinical guidance</b><p class="small">${esc(DISCLAIMER)}</p></div>`);
}
