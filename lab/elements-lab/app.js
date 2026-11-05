// Elements Lab: table, atom and study flow. Facts and question generators live in quiz.js.
import { ELEMENTS } from './data.js';
import { AtomView } from './atom3d.js';
import {
  BY_Z, CAP, FILL, FLASHCARDS, OBJECTIVES, PARTS, RANGES, SUPER, aufbau, cfgText, drawFrom, examSet, findQ, fmtMass, gen, gradeLewis,
  isRegular, major, massNumber, nameQ, realCfg, shells, shuffle, typeName, valence,
} from './quiz.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const store = {
  get(k, d) { try { const v = localStorage.getItem(`elements:${k}`); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`elements:${k}`, JSON.stringify(v)); } catch { /* private window */ } },
};
const stats = store.get('stats', {});
function record(q, ok) {
  const bump = (k) => { const s = stats[k] || { c: 0, n: 0 }; s.n++; if (ok) s.c++; stats[k] = s; };
  if (q.obj) bump(q.obj);
  if (q.obj && q.sub) bump(`${q.obj}.${q.sub}`);
  if (q.z) bump(`z${q.z}`);
  store.set('stats', stats);
}
const rate = (k) => { const s = stats[k]; return s && s.n ? s.c / s.n : -1; };
const mastered = (k) => { const s = stats[k]; return !!s && s.n >= 4 && s.c / s.n >= 0.8; };

const TABS = [['explore', 'Explore'], ['find', 'Find it'], ['name', 'Name it'], ['math', 'Math'], ['electrons', 'Electrons'], ['lewis', 'Lewis'], ['trends', 'Trends'], ['cards', 'Flashcards'], ['exam', 'Exam']];
const S = {
  tab: 'explore', z: 6, massNum: null, seg: 'element', sub: null, emph: null,
  color: 'type', table: true, mode: 'shells', labels: true,
  range: store.get('range', 36),
  round: null, q: null, answered: false,
};

const panel = $('#panel');
const atom = new AtomView($('#gl'), $('#labels'));
const isPhone = () => matchMedia('(max-width: 860px)').matches;

// ---------- Table ----------
function position(e) {
  if (e.z >= 57 && e.z <= 71) return { col: 3 + (e.z - 57), row: 9 };
  if (e.z >= 89 && e.z <= 103) return { col: 3 + (e.z - 89), row: 10 };
  return { col: e.g, row: e.p };
}
const cells = {};
function buildTable() {
  const t = $('#ptable');
  const add = (html, col, row, cls = 'ph') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; d.style.gridColumn = col; d.style.gridRow = row; t.append(d); };
  // Group numbers sit on top of each column's first square, period numbers on the left.
  const firstRow = { 1: 1, 2: 2, 13: 2, 14: 2, 15: 2, 16: 2, 17: 2, 18: 1 };
  for (let g = 1; g <= 18; g++) add(String(g), g + 1, (firstRow[g] || 4) === 1 ? 1 : (firstRow[g] || 4));
  for (let p = 1; p <= 7; p++) add(String(p), 1, p + 1);
  add('57–71', 4, 7, 'ph-f');
  add('89–103', 4, 8, 'ph-f');
  for (const e of ELEMENTS) {
    const { col, row } = position(e);
    const b = document.createElement('button');
    b.className = 'el';
    b.dataset.z = e.z;
    b.style.gridColumn = col + 1;
    b.style.gridRow = row + 1;
    b.innerHTML = `<span class="z">${e.z}</span><span class="s">${e.s}</span><span class="m">${fmtMass(e)}</span>`;
    b.setAttribute('aria-label', `${e.s}, ${e.z}`);
    b.addEventListener('click', () => tapCell(e.z));
    b.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse') showTip(e, b); });
    b.addEventListener('pointerleave', () => { $('#tip').hidden = true; });
    t.append(b);
    cells[e.z] = b;
  }
  const leg = document.createElement('div');
  leg.className = 't-legend';
  leg.id = 'tLegend';
  t.append(leg);
}
function showTip(e, cell) {
  const tip = $('#tip');
  if (S.tab !== 'explore') { tip.hidden = true; return; }
  const r = cell.getBoundingClientRect(); const st = $('#stage').getBoundingClientRect();
  tip.textContent = e.n;
  tip.hidden = false;
  tip.style.left = `${Math.max(4, r.left - st.left + r.width / 2 - tip.offsetWidth / 2)}px`;
  tip.style.top = `${r.top - st.top - 28}px`;
}
function mix(t) { // void to bone ramp
  const a = [30, 30, 30]; const b = [245, 245, 240];
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}
const SCALES = {
  size: { list: ELEMENTS.filter((e) => e.r), get: (e) => e.r, lo: 'Small', hi: 'Large' },
  en: { list: ELEMENTS.filter((e) => e.en), get: (e) => e.en, lo: 'Low', hi: 'High' },
};
for (const k of Object.keys(SCALES)) {
  const vals = SCALES[k].list.map(SCALES[k].get);
  SCALES[k].min = Math.min(...vals); SCALES[k].max = Math.max(...vals);
}
function paintTable() {
  for (const e of ELEMENTS) {
    const c = cells[e.z];
    c.classList.remove('metal', 'nonmetal', 'metalloid', 'none');
    c.style.removeProperty('--fill'); c.style.removeProperty('--ink');
    const mass = $('.m', c);
    mass.textContent = fmtMass(e);
    if (S.color === 'type') c.classList.add(e.t);
    else if (S.color === 'valence') {
      const v = valence(e);
      if (v == null) c.classList.add('none');
      else { const t = v / 8; c.style.setProperty('--fill', mix(t)); c.style.setProperty('--ink', t > 0.4 ? '#0A0A0A' : '#F5F5F0'); mass.textContent = `${v}e`; }
    } else if (S.color === 'score') {
      const r = rate(`z${e.z}`);
      if (r < 0) c.classList.add('none');
      else { c.style.setProperty('--fill', r >= 0.8 ? '#4ade80' : r >= 0.5 ? '#e5b84b' : '#a78bfa'); c.style.setProperty('--ink', '#0A0A0A'); }
    } else {
      const sc = SCALES[S.color]; const raw = sc.get(e);
      if (raw == null) c.classList.add('none');
      else {
        const t = (raw - sc.min) / (sc.max - sc.min);
        c.style.setProperty('--fill', mix(t)); c.style.setProperty('--ink', t > 0.4 ? '#0A0A0A' : '#F5F5F0');
        mass.textContent = S.color === 'en' ? raw.toFixed(2) : mass.textContent;
      }
    }
  }
  const leg = $('#tLegend');
  if (S.color === 'type') leg.innerHTML = `<span><i style="background:#1E1E1E;outline:1px solid #3A3A38"></i>Metal</span><span><i style="background:#F5F5F0"></i>Nonmetal</span><span><i style="background:#3A3A38 repeating-linear-gradient(135deg,rgba(255,255,255,.22) 0 2px,transparent 2px 4px)"></i>Metalloid</span>`;
  else if (S.color === 'size' || S.color === 'en') leg.innerHTML = `<div class="bar-h"></div><span class="ends"><em style="font-style:normal">${SCALES[S.color].lo}</em><em style="font-style:normal">${SCALES[S.color].hi}</em></span><span>${S.color === 'en' ? 'Electronegativity' : 'Atom size'}</span>`;
  else if (S.color === 'valence') leg.innerHTML = '<span>Valence electrons, main groups</span>';
  else leg.innerHTML = '<span>Your score by element</span>';
  $$('[data-color]').forEach((b) => b.classList.toggle('on', b.dataset.color === S.color));
}
function mark(zs = {}) {
  for (const c of Object.values(cells)) c.classList.remove('sel', 'hi', 'good', 'miss');
  for (const [cls, list] of Object.entries(zs)) for (const z of [].concat(list)) cells[z]?.classList.add(cls);
}

// ---------- Layout: the atom sits in the gap at the top of the table ----------
function layout() {
  const stage = $('#stage'); const wrap = $('#tableWrap'); const ptable = $('#ptable');
  const W = stage.clientWidth; const H = stage.clientHeight;
  const headerH = $('header.top').offsetHeight;
  wrap.hidden = !S.table;
  if (isPhone()) {
    document.documentElement.style.setProperty('--cw', '42px');
    document.documentElement.style.setProperty('--ch', '42px');
    wrap.style.cssText = '';
    ptable.classList.remove('compact');
    atom.setRegion({ x: 0, y: 8, w: W, h: H - 60 });
    return;
  }
  const dockH = $('.dock').offsetHeight + 26;
  const availW = W - 430 - 18;
  if (!S.table) { atom.setRegion({ x: 0, y: headerH, w: availW, h: H - headerH - dockH }); return; }
  const pw = 16;
  const cw = Math.min(62, (availW - pw) / 18);
  const ch = Math.max(26, Math.min(46, cw * 0.82, (H - headerH - dockH - 60) / 9.6));
  document.documentElement.style.setProperty('--cw', `${cw}px`);
  document.documentElement.style.setProperty('--ch', `${ch}px`);
  ptable.classList.toggle('compact', ch < 33 || cw < 38);
  const tableH = 12 + 7 + ch * 9; const tableW = pw + cw * 18;
  const left = 18 + Math.max(0, (availW - tableW) / 2); const top = H - dockH - tableH;
  wrap.style.cssText = `left:${left}px;top:${top}px`;
  // Columns 3 to 12 are empty for the top three rows.
  const x = left + pw + cw * 2; const notchBottom = top + 12 + ch * 3;
  atom.setRegion({ x, y: headerH - 8, w: cw * 10, h: Math.max(120, notchBottom - headerH) });
}
addEventListener('resize', layout);
// The dock and header wrap differently once the fonts arrive, which moves the table.
new ResizeObserver(() => layout()).observe($('.dock'));
new ResizeObserver(() => layout()).observe($('header.top'));
new ResizeObserver(() => layout()).observe($('#stage'));
document.fonts?.ready.then(layout);

// ---------- Atom helpers ----------
function showAtom(z, o = {}) {
  atom.show(z, { mode: S.mode, labels: S.labels, sub: S.sub, emph: S.emph, massNum: S.massNum, ...o });
}
function select(z) {
  S.z = z; S.massNum = null; S.sub = null;
  mark({ sel: z });
  showAtom(z);
}

function tapCell(z) {
  const q = S.q;
  if (q && !S.answered && q.kind === 'table') return answerTable(z);
  if (q && !S.answered && q.zOptions?.includes(z)) return answerChoice(BY_Z[z].n);
  if (q) return;
  if (S.tab === 'explore' || S.tab === 'cards') {
    select(z);
    if (isPhone()) { S.table = false; syncDock(); layout(); }
    if (S.tab === 'explore') { S.seg = 'element'; render(); }
  }
}

// ---------- Tabs ----------
function buildTabs() {
  $('.tabs').innerHTML = TABS.map(([k, t]) => `<button role="tab" data-tab="${k}">${t}</button>`).join('');
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => go(b.dataset.tab)));
}
function go(tab) {
  document.body.classList.remove('q-focus');
  S.tab = tab; S.q = null; S.round = null; S.answered = false; S.emph = null; S.sub = null; S.massNum = null;
  $$('.tabs button').forEach((b) => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  $('#tip').hidden = true;
  S.labels = true;
  S.color = 'type';
  if (tab === 'find' || tab === 'trends') S.table = true;
  syncDock();
  paintTable();
  mark(tab === 'explore' ? { sel: S.z } : {});
  layout();
  render();
}
function syncDock() {
  $$('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === S.mode));
  const tb = $('#tableBtn'); tb.classList.toggle('on', S.table); tb.setAttribute('aria-pressed', S.table);
  const lb = $('#labelsBtn'); lb.classList.toggle('on', S.labels); lb.setAttribute('aria-pressed', S.labels);
}

function rangeChips() {
  return `<div class="deck-row">${Object.entries(RANGES).map(([k, v]) => `<button class="chip ${S.range === v ? 'on' : ''}" data-range="${v}">${k}</button>`).join('')}</div>`;
}
function bindRange(after) {
  $$('[data-range]', panel).forEach((b) => b.addEventListener('click', () => { S.range = +b.dataset.range; store.set('range', S.range); after(); }));
}

// ---------- Render by tab ----------
function render() {
  panel.scrollTop = 0;
  ({ explore: renderExplore, find: renderFind, name: renderName, math: renderMath, electrons: renderElectrons, lewis: renderLewis, trends: renderTrends, cards: renderCards, exam: renderExam })[S.tab]();
}

// ---------- Explore ----------
function renderExplore() {
  const segs = [['element', 'Element'], ['particles', 'Particles'], ['metals', 'Metals'], ['formulas', 'Formulas']];
  const seg = `<div class="seg" role="group">${segs.map(([k, t]) => `<button data-seg="${k}" class="${S.seg === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const body = { element: elementSheet, particles: particleSheet, metals: metalSheet, formulas: formulaSheet }[S.seg]();
  panel.innerHTML = seg + body;
  $$('[data-seg]', panel).forEach((b) => b.addEventListener('click', () => {
    S.seg = b.dataset.seg; S.emph = null; S.sub = null;
    if (S.seg === 'metals') { S.color = 'type'; paintTable(); }
    showAtom(S.z);
    render();
  }));
  bindSheet();
  showAtom(S.z);
}

function sideDots(v) { // spread one per side, then pair
  const sides = [0, 0, 0, 0];
  for (let i = 0; i < v; i++) sides[i % 4]++;
  return sides;
}
const SLOT = [[[86, 38], [114, 38]], [[162, 86], [162, 114]], [[86, 162], [114, 162]], [[38, 86], [38, 114]]];
const SINGLE = [[100, 38], [162, 100], [100, 162], [38, 100]];
function lewisStatic(e, cls = 'static') {
  const v = valence(e);
  if (v == null) return '';
  const sides = e.z === 2 ? [2, 0, 0, 0] : sideDots(v);
  const dots = sides.flatMap((c, i) => (c === 1 ? [SINGLE[i]] : c === 2 ? SLOT[i] : []));
  return `<svg class="lewis ${cls}" viewBox="0 0 200 200" role="img" aria-label="${esc(e.n)} Lewis dot symbol, ${v} dots"><text x="100" y="102">${esc(e.s)}</text>${dots.map(([x, y]) => `<circle class="dot" cx="${x}" cy="${y}" r="8"/>`).join('')}</svg>`;
}

function elementSheet() {
  const e = BY_Z[S.z];
  const A = S.massNum || massNumber(e);
  const iso = major(e);
  const v = valence(e);
  const shellText = Object.values(shells(e)).join(', ');
  const cfg = realCfg(e);
  const irregular = !isRegular(e);
  const pct = (val, sc) => (val == null ? 0 : ((val - sc.min) / (sc.max - sc.min)) * 100);
  const isoButtons = e.iso.length > 1 ? `<div class="deck-row">${e.iso.filter((i) => i[1] >= 0.01).map((i) => `<button class="chip iso ${A === i[0] ? 'on' : ''}" data-iso="${i[0]}">${e.s}-${i[0]} <span class="mono" style="font-size:11px;opacity:.75">${i[1] < 1 ? i[1].toFixed(2) : i[1].toFixed(1)}%</span></button>`).join('')}</div>` : '';
  const isoNote = iso ? (Math.round(e.m) === iso[0]
    ? `Most abundant: ${e.s}-${iso[0]}. Round ${e.m.toFixed(2)} and you get it.`
    : `Most abundant: ${e.s}-${iso[0]}. Rounding ${e.m.toFixed(2)} misses here, since the mix of isotopes pulls the average.`)
    : 'No stable isotopes. The bracketed mass is the longest lived one.';
  return `
  <div class="head">
    <div class="sym ${e.t}">${esc(e.s)}</div>
    <div>
      <p class="eyebrow">${typeName[e.t]} · Period ${e.p}${e.g ? ` · Group ${e.g}` : ''}</p>
      <h2 style="margin:0;font:700 30px/1 var(--f-display);text-transform:uppercase">${esc(e.n)}</h2>
    </div>
  </div>
  <dl class="sheet">
    <div><dt>Atomic no.</dt><dd>${e.z}</dd><span class="how">whole number</span></div>
    <div><dt>Atomic mass</dt><dd>${fmtMass(e)}</dd><span class="how">weighted average</span></div>
    <div><dt>Protons</dt><dd>${e.z}</dd><span class="how">= atomic no.</span></div>
    <div><dt>Neutrons</dt><dd>${A - e.z}</dd><span class="how">${A} − ${e.z}</span></div>
    <div><dt>Electrons</dt><dd>${e.z}</dd><span class="how">= protons when neutral</span></div>
    <div><dt>Valence</dt><dd>${v == null ? 'varies' : v}</dd><span class="how">${v == null ? 'not a main group' : e.z === 2 ? 'helium is the exception' : e.g <= 2 ? `group ${e.g}` : `group ${e.g}, drop the 1`}</span></div>
    <div><dt>Shells</dt><dd style="grid-column:span 2">${shellText}</dd></div>
  </dl>
  ${isoButtons}
  <p class="small muted" style="margin:0">${isoNote}</p>
  <div class="subs" aria-label="Electron configuration. Tap a subshell to see its shape.">
    ${cfg.map(([sub, c]) => `<button class="sub ${S.sub === sub ? 'on' : ''}" data-sub="${sub}">${sub}${SUPER(c)}</button>`).join('')}
  </div>
  ${irregular ? `<p class="small muted" style="margin:0">An exception to the filling order. Plain Aufbau would give ${cfgText(aufbau(e.z)).split(' ').slice(-2).join(' ')}.</p>` : ''}
  <div class="row" style="align-items:center;flex-wrap:nowrap">
    ${lewisStatic(e)}
    <div style="flex:1;display:grid;gap:8px">
      <div class="meter"><span>Size</span><div class="track"><i style="width:${e.r ? pct(e.r, SCALES.size) : 0}%"></i></div></div>
      <div class="meter"><span>EN</span><div class="track"><i style="width:${e.en ? pct(e.en, SCALES.en) : 0}%"></i></div></div>
    </div>
  </div>`;
}

function particleSheet() {
  const rows = [['proton', 'Proton', '+1', '1 amu', 'Nucleus'], ['neutron', 'Neutron', '0', '1 amu', 'Nucleus'], ['electron', 'Electron', '−1', '≈ 0', 'Cloud']];
  return `<div class="card">
    <h2>Particles</h2>
    <div>${rows.map(([k, n, q, m, w]) => `<button class="partbtn ${S.emph === k ? 'on' : ''}" data-emph="${k}"><b>${n}</b><span>${w}</span><span>${q}</span><span>${m}</span></button>`).join('')}</div>
    <p class="small muted">Protons decide the element. Neutrons make isotopes. Electrons do the chemistry.</p>
    <div class="row"><button class="btn" data-drill="particles">Quiz me</button></div>
  </div>`;
}
function metalSheet() {
  return `<div class="card">
    <h2>Metals vs nonmetals</h2>
    <table class="compare"><thead><tr><th></th><th>Metal</th><th>Nonmetal</th></tr></thead><tbody>
      <tr><th>Where</th><td>Left and center</td><td>Upper right, plus H</td></tr>
      <tr><th>Look</th><td>Shiny</td><td>Dull</td></tr>
      <tr><th>Shape</th><td>Bends, makes wire</td><td>Brittle if solid</td></tr>
      <tr><th>Conducts</th><td>Well</td><td>Poorly</td></tr>
      <tr><th>Electrons</th><td>Tends to lose</td><td>Tends to gain</td></tr>
      <tr><th>EN</th><td>Low</td><td>High</td></tr>
    </tbody></table>
    <p class="small muted">Metalloids sit on the staircase line and act partly like each.</p>
    <div class="row"><button class="btn" data-drill="metals">Quiz me</button></div>
  </div>`;
}
function formulaSheet() {
  const e = BY_Z[S.z]; const A = S.massNum || massNumber(e); const n = A - e.z;
  const w = e.iso.length > 1 ? e.iso.filter((i) => i[1] >= 0.5) : null;
  return `<div class="card">
    <h2>Formulas</h2>
    <p class="eyebrow">Worked on ${esc(e.n)}-${A}. Tap the table to change it.</p>
    <p class="formula"><span>Mass number = protons + neutrons</span>${A} = ${e.z} + ${n}</p>
    <p class="formula"><span>Neutrons = mass number − atomic number</span>${n} = ${A} − ${e.z}</p>
    <p class="formula"><span>Neutral atom: protons = electrons</span>${e.z} = ${e.z}</p>
    ${w ? `<p class="formula"><span>Atomic mass = sum of (isotope mass × abundance)</span>${w.map((i) => `${i[2].toFixed(2)} × ${(i[1] / 100).toFixed(3)}`).join(' + ')} ≈ ${w.reduce((s, i) => s + i[2] * i[1] / 100, 0).toFixed(2)}</p>` : ''}
  </div>`;
}
function bindSheet() {
  $$('[data-iso]', panel).forEach((b) => b.addEventListener('click', () => { S.massNum = +b.dataset.iso; showAtom(S.z); render(); }));
  $$('[data-sub]', panel).forEach((b) => b.addEventListener('click', () => {
    const sub = b.dataset.sub;
    S.sub = S.sub === sub ? null : sub;
    S.mode = S.sub ? 'cloud' : S.mode;
    syncDock(); showAtom(S.z); render();
  }));
  $$('[data-emph]', panel).forEach((b) => b.addEventListener('click', () => {
    S.emph = S.emph === b.dataset.emph ? null : b.dataset.emph;
    S.mode = 'shells'; syncDock(); showAtom(S.z); render();
  }));
  $$('[data-drill]', panel).forEach((b) => b.addEventListener('click', () => {
    const name = b.dataset.drill;
    startRound(() => gen[name](54), 10, { title: name === 'particles' ? 'Particles' : 'Metals vs nonmetals' });
  }));
}

// ---------- Round engine ----------
function startRound(make, size = 12, opt = {}) {
  S.round = { make, size, done: 0, right: 0, retry: [], missed: [], seen: new Set(), ...opt };
  nextQ();
}
function nextQ() {
  const R = S.round;
  if (!R) return;
  if (R.done >= R.size && !R.retry.length) return endRound();
  let q;
  if (R.done >= R.size || (R.retry.length && R.retry[0].due <= R.done)) { q = R.retry.shift().q; q.again = true; } else {
    let guard = 0;
    do { q = R.make(); guard++; } while (R.seen.has(qKey(q)) && guard < 15);
    R.seen.add(qKey(q));
  }
  S.q = q; S.answered = false;
  renderQ();
}
const qKey = (q) => `${q.prompt}|${q.z || ''}|${q.answer || ''}|${(q.zOptions || []).join()}`;

function settle(ok, detail) {
  const q = S.q; const R = S.round;
  S.answered = true;
  if (!q.again) {
    record(q, ok);
    if (R) { R.done++; if (ok) R.right++; else { R.missed.push(q); if (!R.exam) R.retry.push({ q: { ...q }, due: R.done + 3 }); } }
  }
  if (R?.exam) { setTimeout(nextQ, 180); return; }
  revealStage(q);
  const fb = document.createElement('div');
  fb.className = `fb ${ok ? 'ok' : 'bad'}`;
  fb.textContent = detail ? `${detail} ${q.why}` : q.why;
  const next = document.createElement('button');
  next.className = 'btn'; next.textContent = 'Next';
  next.addEventListener('click', nextQ);
  const area = $('#qArea');
  area.append(fb);
  const row = document.createElement('div'); row.className = 'row'; row.append(next); area.append(row);
  next.focus({ preventScroll: true });
}

// After answering, the stage shows the reason.
function revealStage(q) {
  if (isPhone() && q.kind !== 'table') { S.table = false; syncDock(); layout(); }
  if (q.compare) {
    S.color = q.compare; paintTable();
    const [a, b] = q.zOptions;
    mark({ hi: [a, b] });
    atom.compare(a, b, q.compare);
    return;
  }
  if (q.z) {
    if (q.kind !== 'table') mark({ sel: q.z });
    atom.show(q.z, { mode: S.mode, labels: true, emph: q.obj === 'electrons' && q.sub === 'valence' ? 'valence' : null, sub: null, massNum: q.massNum ?? null, freeze: false, partial: null });
    return;
  }
}

function roundHeader() {
  const R = S.round;
  const pct = R ? Math.min(100, (R.done / R.size) * 100) : 0;
  const count = R ? (S.q?.again ? 'One more try' : `${Math.min(R.done + 1, R.size)} of ${R.size}`) : '';
  return `<div class="bar"><span style="width:${pct}%"></span></div><p class="eyebrow" style="margin:0">${R?.title ? `${esc(R.title)} · ` : ''}${count}</p>`;
}

function renderQ() {
  const q = S.q; const R = S.round;
  mark({});
  $('#tip').hidden = true;
  if (q.compare) { atom.hide(); if (S.color !== 'type') { S.color = 'type'; paintTable(); } mark({ hi: q.zOptions }); }
  else if (q.kind === 'name') atom.show(q.z, { mode: 'shells', labels: false, sub: null, emph: null, massNum: null, partial: null, freeze: true });
  else if (q.kind === 'build') atom.show(q.z, { mode: 'shells', labels: true, partial: 0, sub: null, emph: null, massNum: null, freeze: false });
  else if (R?.exam) atom.hide();
  // An unlabelled atom to reason from. It only gives the answer away if you count.
  else atom.show(q.z || S.z, { mode: 'shells', labels: false, emph: 'plain', sub: null, massNum: q.massNum ?? null, partial: null, freeze: true });

  const long = q.prompt.length > 34;
  let body = '';
  if (q.kind === 'choice') body = `<div class="choices ${q.grid ? 'g4' : ''} ${q.stack || q.options.some((o) => String(o).length > 22) ? 'stack' : ''}">${q.options.map((o, i) => `<button class="choice ${q.mono ? 'mono' : ''}" data-i="${i}">${esc(o)}</button>`).join('')}</div>`;
  else if (q.kind === 'number') body = numberBody(q);
  else if (q.kind === 'table') body = `<p class="small muted" style="margin:0">Tap it on the table.</p>`;
  else if (q.kind === 'name') body = nameBody(q);
  else if (q.kind === 'lewis') body = lewisBody(q);
  else if (q.kind === 'build') body = buildBody(q);

  panel.innerHTML = `${roundHeader()}<div class="card" id="qArea">
    ${q.eyebrow ? `<p class="eyebrow">${esc(q.eyebrow)}</p>` : ''}
    <p class="prompt ${long ? 'long' : ''}">${esc(q.prompt)}</p>
    ${q.weighted ? weightedTable(q) : ''}
    ${body}
  </div>`;
  if (q.kind === 'choice') bindChoice(q);
  if (q.kind === 'number') bindNumber(q);
  if (q.kind === 'name') bindName(q);
  if (q.kind === 'lewis') bindLewis(q);
  if (q.kind === 'build') bindBuild(q);
  panel.scrollTop = 0;
  if (isPhone()) {
    S.table = q.kind === 'table' || !!q.zOptions;
    document.body.classList.toggle('q-focus', !S.table);
    syncDock(); layout();
    // Keep the question in view under the sticky stage.
    const stage = $('#stage').getBoundingClientRect();
    scrollTo({ top: $('#side').getBoundingClientRect().top + scrollY - stage.height - 8 });
  }
}

// Choice
function bindChoice(q) { $$('.choice', panel).forEach((b) => b.addEventListener('click', () => answerChoice(q.options[+b.dataset.i]))); }
function answerChoice(val) {
  const q = S.q;
  if (S.answered) return;
  const ok = String(val) === String(q.answer);
  $$('.choice', panel).forEach((b) => {
    b.disabled = true;
    const v = q.options[+b.dataset.i];
    if (!S.round?.exam) { if (String(v) === String(q.answer)) b.classList.add('ok'); else if (v === val) b.classList.add('bad'); }
  });
  settle(ok);
}

// Table
function answerTable(z) {
  const q = S.q;
  const ok = q.accept.includes(z);
  if (!S.round?.exam) {
    mark({ good: q.accept.length <= 12 ? q.accept : (ok ? [z] : []), miss: ok ? [] : [z] });
  }
  const pre = ok ? `${BY_Z[z].n}.` : `That is ${BY_Z[z].n}.`;
  settle(ok, pre);
}

// Number
function numberBody(q) {
  return `<div class="fields">${q.fields.map((f, i) => `<label class="field" data-f="${i}"><span>${esc(f.label)}</span><input ${f.text ? 'autocapitalize="characters" maxlength="3"' : 'inputmode="decimal"'} autocomplete="off" data-in="${i}"></label>`).join('')}</div>
  <div class="row"><button class="btn" id="check">Check</button></div>`;
}
function weightedTable(q) {
  return `<table class="wtable"><thead><tr><th>Isotope</th><th>Mass</th><th>Abundance</th></tr></thead><tbody>${q.weighted.map((r) => `<tr><td>${esc(r.label)}</td><td>${r.mass}</td><td>${r.pct}</td></tr>`).join('')}</tbody></table>`;
}
function bindNumber(q) {
  const inputs = $$('[data-in]', panel);
  const go2 = () => {
    if (S.answered) return;
    let all = true;
    q.fields.forEach((f, i) => {
      const raw = inputs[i].value.trim().replace(',', '.').replace(/^−/, '-');
      const ok = f.text ? raw.toLowerCase() === f.text.toLowerCase() : raw !== '' && Math.abs(Number(raw) - f.answer) <= (f.tol ?? 0);
      all &&= ok;
      inputs[i].disabled = true;
      if (!S.round?.exam) {
        $(`[data-f="${i}"]`, panel).classList.add(ok ? 'ok' : 'bad');
        if (!ok) inputs[i].value = f.text || f.answer;
      }
    });
    $('#check', panel).remove();
    settle(all);
  };
  $('#check', panel).addEventListener('click', go2);
  inputs.forEach((inp, i) => inp.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (inputs[i + 1]) inputs[i + 1].focus(); else go2();
  }));
  if (!isPhone()) inputs[0].focus({ preventScroll: true });
}

// Name it
function nameBody(q) {
  return `<div class="answer"><input id="nameIn" placeholder="Name or symbol" autocomplete="off" autocapitalize="off" aria-label="Element name or symbol"><button class="btn" id="nameGo">Check</button></div>
  <div class="bank">${q.bank.map((n) => `<button class="chip" data-bank="${esc(n)}">${esc(n)}</button>`).join('')}</div>`;
}
function bindName(q) {
  const check = (val) => {
    if (S.answered) return;
    const v = val.trim().toLowerCase();
    if (!v) return;
    const e = q.e;
    const ok = v === e.n.toLowerCase() || v === e.s.toLowerCase() || (e.n === 'Aluminum' && v === 'aluminium') || (e.n === 'Cesium' && v === 'caesium') || (e.n === 'Sulfur' && v === 'sulphur');
    $$('[data-bank]', panel).forEach((b) => { b.disabled = true; });
    $('#nameIn', panel).disabled = true; $('#nameGo', panel).disabled = true;
    settle(ok, ok ? '' : `It was ${e.n}.`);
    if (ok) mark({ good: e.z }); else mark({ miss: e.z });
  };
  $('#nameGo', panel).addEventListener('click', () => check($('#nameIn', panel).value));
  $('#nameIn', panel).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); check(e.target.value); } });
  $$('[data-bank]', panel).forEach((b) => b.addEventListener('click', () => check(b.dataset.bank)));
  if (!isPhone()) $('#nameIn', panel).focus({ preventScroll: true });
}

// Lewis
function lewisBody(q) {
  const e = BY_Z[q.z];
  const slots = SLOT.flat();
  return `<svg class="lewis" id="lewisPad" viewBox="0 0 200 200" role="group" aria-label="Tap around the symbol to place dots">
    <text x="100" y="102">${esc(e.s)}</text>
    ${slots.map(([x, y], i) => `<circle class="hint" cx="${x}" cy="${y}" r="8"/><circle class="dot" data-dot="${i}" cx="${x}" cy="${y}" r="0"/><circle class="hit" data-slot="${i}" cx="${x}" cy="${y}" r="17" tabindex="0" role="button" aria-pressed="false" aria-label="Dot position ${i + 1}"/>`).join('')}
  </svg>
  <p class="eyebrow" id="dotCount" style="text-align:center">0 dots</p>
  <div class="row" style="justify-content:center"><button class="btn" id="check">Check</button></div>`;
}
function bindLewis(q) {
  const e = BY_Z[q.z];
  const on = new Set();
  const toggle = (i, hit) => {
    if (S.answered) return;
    if (on.has(i)) on.delete(i); else on.add(i);
    $(`[data-dot="${i}"]`, panel).setAttribute('r', on.has(i) ? 8 : 0);
    hit.setAttribute('aria-pressed', on.has(i));
    $('#dotCount', panel).textContent = `${on.size} dot${on.size === 1 ? '' : 's'}`;
  };
  $$('[data-slot]', panel).forEach((h) => {
    h.addEventListener('click', () => toggle(+h.dataset.slot, h));
    h.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(+h.dataset.slot, h); } });
  });
  $('#check', panel).addEventListener('click', () => {
    if (S.answered) return;
    const sides = [0, 1, 2, 3].map((s) => [s * 2, s * 2 + 1].filter((i) => on.has(i)).length);
    const res = gradeLewis(sides, e);
    const pad = $('#lewisPad', panel);
    pad.classList.add('done');
    if (!S.round?.exam) pad.classList.add(res.ok ? 'ok' : 'bad');
    $('#check', panel).remove();
    settle(res.ok, res.reason || '');
    if (!res.ok && !S.round?.exam) {
      const area = $('#qArea');
      const holder = document.createElement('div');
      holder.innerHTML = lewisStatic(e, '');
      holder.firstElementChild.style.maxWidth = '130px';
      area.insertBefore(holder, area.querySelector('.fb'));
    }
  });
}

// Build a configuration by tapping subshells on the diagonal chart.
const LADDER = [['1s'], ['2s', '2p'], ['3s', '3p', '3d'], ['4s', '4p', '4d', '4f'], ['5s', '5p', '5d', '5f'], ['6s', '6p', '6d'], ['7s', '7p']];
function buildBody() {
  return `<div class="cfgline" id="cfgLine" aria-live="polite">&nbsp;</div>
  <p class="eyebrow" id="cfgLeft" style="margin:0"></p>
  <div class="ladder">${LADDER.map((r) => `<div class="rung">${r.map((s) => `<button class="fill" data-fill="${s}"><span>${s}</span></button>`).join('')}</div>`).join('')}</div>`;
}
function bindBuild(q) {
  const e = BY_Z[q.z];
  let left = e.z; let idx = 0; let misses = 0; const parts = [];
  const update = () => {
    $('#cfgLine', panel).innerHTML = parts.length ? esc(cfgText(parts)) : '&nbsp;';
    $('#cfgLeft', panel).textContent = left ? `${left} electron${left === 1 ? '' : 's'} left` : 'All placed';
  };
  update();
  $$('[data-fill]', panel).forEach((b) => b.addEventListener('click', () => {
    if (S.answered || left === 0) return;
    const sub = b.dataset.fill;
    if (sub !== FILL[idx]) {
      misses++;
      b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
      return;
    }
    const c = Math.min(left, CAP[sub[1]]);
    b.style.setProperty('--level', `${(c / CAP[sub[1]]) * 100}%`);
    b.querySelector('span').textContent = `${sub}${SUPER(c)}`;
    b.disabled = true;
    parts.push([sub, c]); left -= c; idx++;
    atom.show(e.z, { mode: 'shells', labels: true, partial: e.z - left, sub: null, emph: null, massNum: null, quiet: true });
    update();
    if (left === 0) settle(misses === 0, misses ? `${misses} tap${misses === 1 ? '' : 's'} out of order.` : '');
  }));
}

function endRound() {
  const R = S.round;
  if (R.exam) return endExam();
  const pct = Math.round((R.right / Math.max(1, R.size)) * 100);
  S.q = null; S.round = null;
  document.body.classList.remove('q-focus');
  atom.show(S.z, { mode: S.mode, labels: S.labels, sub: null, emph: null, massNum: null, partial: null, freeze: false });
  mark({});
  panel.innerHTML = `<div class="card">
    <p class="eyebrow">${R.title ? esc(R.title) : 'Round'} done</p>
    <div class="score">${R.right}/${R.size}</div>
    <p class="muted">${pct >= 80 ? 'That one is sticking.' : pct >= 50 ? 'Getting there. One more round.' : 'Keep going, missed ones come back.'}</p>
    <div class="row"><button class="btn" id="again">Go again</button></div>
  </div>`;
  $('#again', panel).addEventListener('click', () => startRound(R.make, R.size, { title: R.title }));
}

// ---------- Tab views ----------
function renderFind() {
  panel.innerHTML = `<div class="card"><h2>Find it</h2><p class="muted small">A clue, then you tap the square.</p>${rangeChips()}<div class="row"><button class="btn" id="start">Start</button></div></div>`;
  atom.show(S.z, { mode: S.mode, labels: false, sub: null, emph: null, massNum: null, partial: null });
  bindRange(renderFind);
  $('#start', panel).addEventListener('click', () => { S.table = true; syncDock(); layout(); startRound(() => findQ(S.range), 12, { title: 'Find it' }); });
}
function renderName() {
  panel.innerHTML = `<div class="card"><h2>Name it</h2><p class="muted small">Count the electrons on the atom. That number is the atomic number.</p>${rangeChips()}<div class="row"><button class="btn" id="start">Start</button></div></div>`;
  atom.show(S.z, { mode: 'shells', labels: true, sub: null, emph: null, massNum: null, partial: null });
  bindRange(renderName);
  $('#start', panel).addEventListener('click', () => { S.mode = 'shells'; syncDock(); if (isPhone()) { S.table = false; syncDock(); layout(); } startRound(() => nameQ(S.range), 10, { title: 'Name it' }); });
}
function renderMath() {
  const e = BY_Z[17];
  panel.innerHTML = `<div class="card"><h2>Math</h2>
    <p class="formula"><span>Mass number = protons + neutrons</span></p>
    <p class="formula"><span>Neutrons = mass number − atomic number</span></p>
    <p class="formula"><span>Neutral atom: protons = electrons</span></p>
    <p class="formula"><span>Atomic mass = sum of (isotope mass × abundance)</span>${e.iso.map((i) => `${i[2].toFixed(2)} × ${(i[1] / 100).toFixed(3)}`).join(' + ')} = ${e.m.toFixed(2)}</p>
    ${rangeChips()}
    <div class="row"><button class="btn" id="start">Start</button></div></div>`;
  atom.show(17, { mode: S.mode, labels: true, sub: null, emph: 'nucleus', massNum: null, partial: null });
  bindRange(renderMath);
  $('#start', panel).addEventListener('click', () => startRound(() => drawFrom('math', S.range), 12, { title: 'Math' }));
}
function renderElectrons() {
  panel.innerHTML = `<div class="card"><h2>Electrons</h2>
    <p class="muted small">Tap subshells in energy order. On the chart, follow the diagonals down and to the left. That is why 4s comes before 3d.</p>
    <p class="formula">1s 2s 2p 3s 3p 4s 3d 4p<span>s holds 2, p holds 6, d holds 10, f holds 14</span></p>
    ${rangeChips()}
    <div class="row"><button class="btn" id="start">Start</button></div></div>`;
  atom.show(S.z, { mode: S.mode, labels: true, sub: null, emph: 'valence', massNum: null, partial: null });
  bindRange(renderElectrons);
  $('#start', panel).addEventListener('click', () => startRound(() => drawFrom('electrons', Math.min(S.range, 54)), 12, { title: 'Electrons' }));
}
function renderLewis() {
  const e = BY_Z[8];
  panel.innerHTML = `<div class="card"><h2>Lewis dots</h2>
    <div class="row" style="align-items:center;flex-wrap:nowrap">${lewisStatic(e)}<p class="muted small">Oxygen is in group 16, so 6 dots. One per side, then pair up.</p></div>
    ${rangeChips()}
    <div class="row"><button class="btn" id="start">Start</button></div></div>`;
  atom.show(8, { mode: 'shells', labels: true, sub: null, emph: 'valence', massNum: null, partial: null });
  bindRange(renderLewis);
  $('#start', panel).addEventListener('click', () => startRound(() => gen.lewis(S.range), 8, { title: 'Lewis' }));
}
function renderTrends() {
  panel.innerHTML = `<div class="card"><h2>Trends</h2>
    <table class="compare"><thead><tr><th></th><th>Across, left to right</th><th>Down a group</th></tr></thead><tbody>
      <tr><th><button class="chip ${S.color === 'size' ? 'on' : ''}" data-heat="size">Size</button></th><td>Smaller. More protons pull the same shells in.</td><td>Larger. Each row adds a shell.</td></tr>
      <tr><th><button class="chip ${S.color === 'en' ? 'on' : ''}" data-heat="en">EN</button></th><td>Higher, up to fluorine.</td><td>Lower. Shared electrons sit further out.</td></tr>
    </tbody></table>
    <p class="small muted">Electronegativity is how hard an atom pulls on shared electrons. Noble gases are left out.</p>
    ${rangeChips()}
    <div class="row"><button class="btn" id="start">Start</button></div></div>`;
  $$('[data-heat]', panel).forEach((b) => b.addEventListener('click', () => {
    S.color = b.dataset.heat; paintTable(); renderTrends();
    const pair = S.color === 'size' ? [11, 17] : [9, 53];
    atom.compare(pair[0], pair[1], S.color);
  }));
  bindRange(renderTrends);
  $('#start', panel).addEventListener('click', () => {
    S.table = true; syncDock(); layout();
    startRound(() => drawFrom('trends', S.range), 10, { title: 'Trends' });
  });
  if (S.color !== 'size' && S.color !== 'en') {
    S.color = 'size'; paintTable();
    $('[data-heat="size"]', panel).classList.add('on');
    atom.compare(11, 17, 'size');
  }
}

// ---------- Flashcards ----------
let cardFilter = new Set(store.get('parts', PARTS));
let deck = []; let cardIdx = 0; let weakFirst = store.get('weak', false);
function renderCards() {
  S.q = null;
  const chips = `<div class="deck-row">${PARTS.map((p) => `<button class="chip ${cardFilter.has(p) ? 'on' : ''}" data-part="${esc(p)}">${esc(p)}</button>`).join('')}</div>`;
  const cards = FLASHCARDS.filter((c) => cardFilter.has(c.part));
  panel.innerHTML = `${chips}<label class="check"><input type="checkbox" id="weak" ${weakFirst ? 'checked' : ''}> Weakest first</label><div id="cardHost"></div>`;
  $$('[data-part]', panel).forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.part;
    if (cardFilter.has(p)) { if (cardFilter.size > 1) cardFilter.delete(p); } else cardFilter.add(p);
    store.set('parts', [...cardFilter]);
    renderCards();
  }));
  $('#weak', panel).addEventListener('change', (e) => { weakFirst = e.target.checked; store.set('weak', weakFirst); renderCards(); });
  deck = shuffle(cards);
  if (weakFirst) deck.sort((a, b) => rate(`card${a.id}`) - rate(`card${b.id}`));
  cardIdx = 0;
  drawCard();
}
function drawCard() {
  const host = $('#cardHost', panel);
  if (!host) return;
  if (cardIdx >= deck.length) {
    host.innerHTML = `<div class="card"><p class="eyebrow">Deck done</p><h2>${deck.length} cards</h2><div class="row"><button class="btn" id="again">Shuffle again</button></div></div>`;
    $('#again', host).addEventListener('click', renderCards);
    return;
  }
  const c = deck[cardIdx];
  host.innerHTML = `<div class="bar" style="margin-bottom:10px"><span style="width:${(cardIdx / deck.length) * 100}%"></span></div>
    <button class="flash" id="flash" aria-label="Flip card">
      <div class="inner">
        <div class="face"><p class="eyebrow" style="margin:0">${esc(c.part)} · ${cardIdx + 1}/${deck.length}</p><p class="txt">${esc(c.q)}</p></div>
        <div class="face back"><p class="eyebrow" style="margin:0">Answer</p><p class="txt">${esc(c.a)}</p></div>
      </div>
    </button>
    <div class="row" id="cardBtns" style="margin-top:10px"><button class="btn" id="flip">Show answer</button></div>`;
  S.emph = null; S.sub = null;
  if (S.color !== 'type') { S.color = 'type'; paintTable(); }
  atom.show(S.z, { mode: S.mode === 'cloud' ? 'shells' : S.mode, labels: S.labels, emph: null, sub: null, massNum: null, partial: null, quiet: true });
  const flip = () => {
    const f = $('#flash', host);
    if (f.classList.contains('flipped')) return;
    f.classList.add('flipped');
    applyCardFx(c);
    $('#cardBtns', host).innerHTML = '<button class="btn" id="knew">Knew it</button><button class="btn ghost" id="again">Again</button>';
    const grade = (ok) => {
      const s = stats[`card${c.id}`] || { c: 0, n: 0 }; s.n++; if (ok) s.c++; stats[`card${c.id}`] = s; store.set('stats', stats);
      if (!ok) deck.splice(Math.min(deck.length, cardIdx + 5), 0, c);
      cardIdx++; drawCard();
    };
    $('#knew', host).addEventListener('click', () => grade(true));
    $('#again', host).addEventListener('click', () => grade(false));
  };
  $('#flash', host).addEventListener('click', flip);
  $('#flip', host).addEventListener('click', flip);
}
function applyCardFx(c) {
  const fx = c.fx;
  if (fx.color) { S.color = fx.color; paintTable(); }
  const z = fx.z || S.z;
  if (fx.z) mark({ sel: fx.z });
  if (fx.sub) atom.show(z, { mode: 'cloud', labels: false, sub: fx.sub, emph: null, massNum: null, partial: null });
  else if (fx.cloud) atom.show(z, { mode: 'cloud', labels: false, sub: null, emph: null, massNum: null, partial: null });
  else atom.show(fx.lewis || z, { mode: 'shells', labels: S.labels, emph: fx.emph || (fx.lewis ? 'valence' : null), sub: null, massNum: null, partial: null });
}

// ---------- Exam and checklist ----------
const OBJ_TAB = { particles: () => { S.seg = 'particles'; go('explore'); }, metals: () => { S.seg = 'metals'; go('explore'); }, number: () => go('find'), mass: () => go('math'), protons: () => go('math'), isotope: () => go('math'), size: () => go('trends'), en: () => go('trends'), neutral: () => go('name'), valence: () => go('electrons'), config: () => go('electrons'), lewis: () => go('lewis') };
function checklist() {
  const row = (key, label, jump) => {
    const r = rate(key); const done = mastered(key);
    return `<button class="ck ${done ? 'done' : ''}" data-jump="${jump}"><span class="box">${done ? '✓' : ''}</span>${esc(label)}<span class="pct">${r < 0 ? '' : `${Math.round(r * 100)}%`}</span></button>`;
  };
  return `<ul class="checklist">${OBJECTIVES.map((o) => `<li>${o.subs.length
    ? `<button class="ck ${o.subs.every(([s]) => mastered(`${o.key}.${s}`)) ? 'done' : ''}" tabindex="-1" style="pointer-events:none"><span class="box">${o.subs.every(([s]) => mastered(`${o.key}.${s}`)) ? '✓' : ''}</span>${esc(o.label)}</button><ul>${o.subs.map(([s, l]) => `<li>${row(`${o.key}.${s}`, l, s)}</li>`).join('')}</ul>`
    : row(o.key, o.label, o.key)}</li>`).join('')}</ul>`;
}
function bindChecklist() { $$('[data-jump]', panel).forEach((b) => b.addEventListener('click', () => OBJ_TAB[b.dataset.jump]())); }
function renderExam() {
  panel.innerHTML = `<div class="card"><h2>Exam</h2>
    <p class="muted small">Your study guide. A box ticks at 80% over at least 4 tries. Tap a line to practice it.</p>
    ${checklist()}
    <div class="deck-row" style="margin-top:4px">${Object.entries(RANGES).slice(0, 3).map(([k, v]) => `<button class="chip ${Math.min(S.range, 54) === v ? 'on' : ''}" data-range="${v}">${k}</button>`).join('')}</div>
    <div class="row"><button class="btn" id="start">Start mock exam</button></div>
    <p class="small muted">25 questions, answers at the end.</p>
  </div>`;
  atom.show(S.z, { mode: S.mode, labels: S.labels, sub: null, emph: null, massNum: null, partial: null });
  bindChecklist();
  bindRange(renderExam);
  $('#start', panel).addEventListener('click', () => {
    const set = examSet(Math.min(S.range, 54));
    let i = 0;
    S.color = 'type'; paintTable();
    startRound(() => set[i++], set.length, { title: 'Mock exam', exam: true, plan: set });
  });
}
function endExam() {
  const R = S.round;
  S.q = null; S.round = null;
  const by = {};
  for (const q of R.plan) { const b = by[q.obj] || { n: 0, c: 0 }; b.n++; if (!R.missed.includes(q)) b.c++; by[q.obj] = b; }
  atom.show(S.z, { mode: S.mode, labels: S.labels, sub: null, emph: null, massNum: null, partial: null, freeze: false });
  mark({});
  panel.innerHTML = `<div class="card">
    <p class="eyebrow">Mock exam</p>
    <div class="score">${R.right}/${R.plan.length}</div>
    <table class="compare"><tbody>${OBJECTIVES.map((o) => `<tr><td>${esc(o.label)}</td><td class="mono" style="text-align:right">${by[o.key]?.c ?? 0}/${by[o.key]?.n ?? 0}</td></tr>`).join('')}</tbody></table>
    <div class="row"><button class="btn" id="retake">Take another</button><button class="btn ghost" id="toList">Study guide</button></div>
  </div>
  ${R.missed.length ? `<div class="card"><h3>Review</h3><div class="review">${R.missed.map((q) => `<div class="item"><b>${esc(q.prompt)}</b>${q.answer ? `<span class="mono" style="font-size:12.5px">${esc(q.answer)}</span><br>` : ''}${esc(q.why)}</div>`).join('')}</div></div>` : ''}`;
  $('#retake', panel).addEventListener('click', () => { const set = examSet(Math.min(S.range, 54)); let i = 0; startRound(() => set[i++], set.length, { title: 'Mock exam', exam: true, plan: set }); });
  $('#toList', panel).addEventListener('click', renderExam);
}

// ---------- Dock and chrome ----------
$$('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  S.mode = b.dataset.mode;
  if (S.mode === 'shells') S.sub = null;
  syncDock();
  if (S.q || S.round) { atom.set({ mode: S.mode }); return; }
  atom.set({ mode: S.mode, sub: S.sub });
  if (S.tab === 'explore') render();
}));
$('#tableBtn').addEventListener('click', () => { S.table = !S.table; syncDock(); layout(); });
$('#labelsBtn').addEventListener('click', () => { S.labels = !S.labels; syncDock(); atom.set({ labels: S.labels }); });
$$('[data-color]').forEach((b) => b.addEventListener('click', () => { S.color = b.dataset.color; paintTable(); }));
$('#resetStats').addEventListener('click', () => {
  if (!confirm('Reset all your Elements Lab scores?')) return;
  for (const k of Object.keys(stats)) delete stats[k];
  store.set('stats', stats);
  paintTable(); render();
});
const infoBtn = $('#infoBtn'); const about = $('#about');
infoBtn.addEventListener('click', (e) => { e.stopPropagation(); about.hidden = !about.hidden; infoBtn.setAttribute('aria-expanded', !about.hidden); });
document.addEventListener('click', (e) => { if (!about.hidden && !about.contains(e.target)) { about.hidden = true; infoBtn.setAttribute('aria-expanded', false); } });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !about.hidden) { about.hidden = true; infoBtn.setAttribute('aria-expanded', false); }
});

// ---------- Start ----------
buildTable();
buildTabs();
const hash = location.hash.slice(1);
go(TABS.some(([k]) => k === hash) ? hash : 'explore');
