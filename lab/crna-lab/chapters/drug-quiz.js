// Mock quiz: questions generated only from label sourced fields, with misses tracked by drug and field.
import { loadDrugs, esc, stated, items, srcLink, fmtTL, namedAgent, mask, shuffle, CATS } from '../shared.js';

const FIELDS = { mechanism: 'Mechanism', class: 'Class', reversal: 'Reversal', adverse: 'Adverse effects', timeline: 'Time course', contraindications: 'Contraindications' };

function sentences(t, n, max = 320) {
  const s = t.replace(/\n/g, ' ').match(/[^.!?]+[.!?]+(\s|$)/g) || [t];
  let out = s.slice(0, n).join('').trim();
  if (out.length > max) out = `${out.slice(0, max).replace(/\s+\S*$/, '')} ...`;
  return out;
}

// Each maker returns a question or null. Questions only use fields with a label section.
const MAKERS = {
  mechanism(d, pool) {
    if (!stated(d.mechanism)) return null;
    const q = mask(d, sentences(d.mechanism.text, 2));
    if (!q.includes('____') || q.length < 40) return null;
    const others = shuffle(pool.filter((x) => x.id !== d.id && x.group !== d.group)).slice(0, 3);
    return { field: 'mechanism', prompt: 'Which drug\'s label says this about its mechanism?', quote: q, choices: [d.name, ...others.map((x) => x.name)], answer: d.name, src: srcLink(d, d.mechanism.src) };
  },
  class(d, pool) {
    if (!stated(d.class)) return null;
    const others = shuffle(pool.filter((x) => x.id !== d.id && stated(x.class) && x.class.text.toLowerCase() !== d.class.text.toLowerCase() && x.group !== d.group)).slice(0, 3);
    if (others.length < 3) return null;
    return { field: 'class', prompt: `How does the ${d.name} label describe what it is?`, choices: [d.class.text, ...others.map((x) => x.class.text)], answer: d.class.text, src: srcLink(d, d.class.src) };
  },
  reversal(d) {
    const na = namedAgent(d);
    if (!na) return null;
    const agents = ['Naloxone', 'Flumazenil', 'Sugammadex', 'Neostigmine', 'Protamine', 'Dantrolene', 'Physostigmine', 'Digoxin immune fab', 'N-acetylcysteine', 'Phentolamine', 'Methylene blue', 'Sodium thiosulfate'];
    const wrong = shuffle(agents.filter((a) => a !== na.agent)).slice(0, 3);
    return { field: 'reversal', prompt: `Which agent does the ${d.name} label name in its overdose or warnings guidance?`, quote: '', choices: [na.agent, ...wrong], answer: na.agent, src: srcLink(d, na.item.src), why: na.item.text };
  },
  adverse(d, pool) {
    if (!stated(d.adverse) || !/most (common|frequent)/i.test(d.adverse.text)) return null;
    const q = mask(d, sentences(d.adverse.text, 1, 300));
    const others = shuffle(pool.filter((x) => x.id !== d.id && x.group !== d.group)).slice(0, 3);
    return { field: 'adverse', prompt: 'Whose label lists these as its most common adverse reactions?', quote: q, choices: [d.name, ...others.map((x) => x.name)], answer: d.name, src: srcLink(d, d.adverse.src) };
  },
  timeline(d, pool) {
    const ks = Object.keys(d.timeline || {});
    if (!ks.length) return null;
    const k = ks[Math.floor(Math.random() * ks.length)]; const t = d.timeline[k];
    const right = fmtTL(t);
    const opts = [...new Set(pool.filter((x) => x.id !== d.id && x.timeline && x.timeline[k]).map((x) => fmtTL(x.timeline[k])).filter((s) => s !== right))];
    if (opts.length < 3) return null;
    const label = k === 'offset' ? 'offset after stopping' : k;
    return { field: 'timeline', prompt: `Per its label, what is the ${label} of ${d.name}${t.context ? ` (${t.context})` : ''}?`, choices: [right, ...shuffle(opts).slice(0, 3)], answer: right, src: srcLink(d, t.src), why: t.quote };
  },
  contraindications(d, pool) {
    if (!stated(d.contraindications)) return null;
    const lines = d.contraindications.text.split('\n').map((s) => s.replace(/^-\s*/, '').trim()).filter((s) => s.length > 30 && !/^none/i.test(s) && !/\(\s*4\s*\)$/.test(s) && !/hypersensitivity|allerg|sensitivity to/i.test(s));
    if (!lines.length) return null;
    const q = mask(d, lines[0].slice(0, 300));
    if ((q.match(/____/g) || []).length > 2) return null;
    const others = shuffle(pool.filter((x) => x.id !== d.id && x.group !== d.group)).slice(0, 3);
    return { field: 'contraindications', prompt: 'Whose label lists this contraindication?', quote: q, choices: [d.name, ...others.map((x) => x.name)], answer: d.name, src: srcLink(d, d.contraindications.src) };
  },
};

export default {
  mount(ctx) {
    ctx.tall();
    const wrap = ctx.h('<div class="cx-scroll"><div class="qboard"></div></div>');
    ctx.stage.append(wrap);
    const board = wrap.querySelector('.qboard');
    let drugs = []; let cat = ctx.store.get('mq:cat', 'all'); let focusMisses = false;
    let misses = ctx.store.get('misses', {}); let session = null;

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Mock quiz</h2>'),
      ctx.h('<p class="lede">Ten questions at a time, written from the label data only. Every miss is counted by drug and by field, so you can see your weak spots.</p>'),
    );
    const catSeg = ctx.seg([['all', 'All'], ['anesthesia', 'Anesthesia'], ['cardiac', 'Cardiac'], ['supporting', 'Supporting']], cat, (v) => { cat = v; ctx.store.set('mq:cat', v); start(); });
    const focusChk = ctx.h('<label class="check"><input type="checkbox"> Focus on drugs I have missed</label>');
    focusChk.querySelector('input').addEventListener('change', (e) => { focusMisses = e.target.checked; start(); }, { signal: ctx.signal });
    const missBox = ctx.h('<div class="card"><span class="eyebrow">Your misses</span><div class="mlist" style="display:grid;gap:5px"></div><button class="btn ghost sm clr" style="justify-self:start">Clear misses</button></div>');
    missBox.querySelector('.clr').addEventListener('click', () => { misses = {}; ctx.store.set('misses', misses); renderMisses(); }, { signal: ctx.signal });
    ctx.panel.append(catSeg, focusChk, missBox,
      ctx.h('<div class="card tip"><p>Each question is built from one field of one label: the mechanism sentence with the name hidden, the label\'s class wording, a reversal agent named in Overdosage, the most common adverse reactions, a time number, or a contraindication. Fields a label does not state are never used, so there are no made up answers.</p></div>'),
      ctx.h('<div class="card try"><ol><li>Take a full round of ten in <b>All</b>.</li><li>Look at <b>Your misses</b>: is it one drug, or one kind of field?</li><li>Tick <b>Focus on drugs I have missed</b> and go again.</li><li>Open the source link after a miss and read the sentence in the label.</li></ol></div>'),
      ctx.h('<details class="more"><summary>Going deeper: how to use a mock quiz</summary><div><p class="small">Board style exams test applied judgment, not label sentences, so treat this as the factual base under that judgment. Wrong choices are real values from other drugs\' labels, which makes them plausible on purpose.</p><p class="small">Misses are stored in this browser only. Clear them when you start a new block.</p></div></details>'),
    );

    function renderMisses() {
      const rows = [];
      for (const [id, f] of Object.entries(misses)) for (const [k, n] of Object.entries(f)) rows.push([id, k, n]);
      rows.sort((a, b) => b[2] - a[2]);
      const ml = missBox.querySelector('.mlist');
      if (!rows.length) { ml.innerHTML = '<p class="small muted">No misses yet.</p>'; return; }
      const mx = rows[0][2];
      ml.innerHTML = rows.slice(0, 10).map(([id, k, n]) => { const d = drugs.find((x) => x.id === id); return `<div class="missrow"><span>${esc(d ? d.name : id)}<br><span class="muted">${esc(FIELDS[k] || k)}</span></span><i style="width:${Math.max(8, (n / mx) * 100)}%"></i><span>${n}</span></div>`; }).join('');
      const byField = {};
      for (const [, k, n] of rows) byField[k] = (byField[k] || 0) + n;
      ml.insertAdjacentHTML('beforeend', `<p class="hint">By field: ${Object.entries(byField).map(([k, n]) => `${esc(FIELDS[k] || k)} ${n}`).join(' · ')}</p>`);
    }

    function makeQuestions(n = 10) {
      let pool = drugs.filter((d) => cat === 'all' || d.category === cat);
      const all = drugs;
      let order = shuffle(pool);
      if (focusMisses) {
        const missed = pool.filter((d) => misses[d.id]);
        if (missed.length) order = shuffle([...missed, ...missed, ...shuffle(pool).slice(0, 4)]);
      }
      const qs = []; const used = new Set();
      let guard = 0;
      while (qs.length < n && guard++ < 400) {
        const d = order[guard % order.length];
        const kinds = shuffle(Object.keys(MAKERS));
        const prefer = focusMisses && misses[d.id] ? Object.keys(misses[d.id]) : [];
        for (const k of [...prefer, ...kinds]) {
          const key = `${d.id}:${k}`; if (used.has(key)) continue;
          const q = MAKERS[k](d, all);
          if (q) { used.add(key); q.d = d; q.choices = shuffle([...new Set(q.choices)]); qs.push(q); break; }
        }
      }
      return qs;
    }

    function start() {
      if (!drugs.length) return;
      session = { qs: makeQuestions(10), i: 0, right: 0 };
      renderQ();
    }
    function renderQ() {
      const s = session; const q = s.qs[s.i];
      if (!q) {
        const pct = Math.round((s.right / s.qs.length) * 100);
        if (s.right >= 7) ctx.done();
        board.innerHTML = `<div class="qcard"><span class="eyebrow">Round done</span><p class="prompt">${s.right} of ${s.qs.length} right (${pct}%)</p><p class="small muted">${s.right >= 8 ? 'Strong round.' : 'Check the misses list, then go again.'}</p><div class="row"><button class="btn again">New round</button></div></div>`;
        board.querySelector('.again').addEventListener('click', start, { signal: ctx.signal });
        return;
      }
      board.innerHTML = `<div class="qcard"><div class="row" style="justify-content:space-between"><span class="eyebrow">Question ${s.i + 1} of ${s.qs.length} · ${esc(FIELDS[q.field])} · ${esc(CATS[q.d.category])}</span><span class="eyebrow">${s.right} right</span></div>
        <p class="prompt">${esc(q.prompt)}</p>${q.quote ? `<div class="quote">"${esc(q.quote)}"</div>` : ''}
        <div class="choices">${q.choices.map((c, j) => `<button class="choice" data-j="${j}">${esc(c)}</button>`).join('')}</div><div class="after"></div></div>`;
      board.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => answer(q, b), { signal: ctx.signal }));
      wrap.scrollTop = 0;
    }
    function answer(q, b) {
      const s = session; const pickd = q.choices[+b.dataset.j]; const ok = pickd === q.answer;
      board.querySelectorAll('.choice').forEach((x) => { x.disabled = true; if (q.choices[+x.dataset.j] === q.answer) x.classList.add('right'); });
      if (ok) s.right++; else {
        b.classList.add('wrong');
        misses[q.d.id] = misses[q.d.id] || {}; misses[q.d.id][q.field] = (misses[q.d.id][q.field] || 0) + 1;
        ctx.store.set('misses', misses); renderMisses();
      }
      const after = board.querySelector('.after');
      after.innerHTML = `<div class="fb ${ok ? 'ok' : 'bad'}">${ok ? 'Right.' : `Not quite. It is <b>${esc(q.answer)}</b>.`} ${q.why ? `<br><span class="small">Label: "${esc(q.why)}"</span>` : ''}<br>${q.src}</div><div class="row" style="margin-top:8px"><button class="btn sm nx">${s.i + 1 < s.qs.length ? 'Next question' : 'See score'}</button></div>`;
      after.querySelector('.nx').addEventListener('click', () => { s.i++; renderQ(); }, { signal: ctx.signal });
    }

    loadDrugs().then((doc) => { if (ctx.signal.aborted) return; drugs = doc.drugs; renderMisses(); start(); });

    ctx.quiz([
      { q: 'Why does this quiz never ask for the onset of drugs like phenylephrine?', choices: ['Phenylephrine has no onset', 'The phenylephrine label used here gives no onset number, and the quiz only uses label sourced fields', 'It is too easy', 'Onset is not tested'], answer: 1, why: 'Fields that say "Not stated in the FDA label" are skipped, so every answer can be traced to a label sentence.' },
      { q: 'Which label names dantrolene in its guidance for suspected malignant hyperthermia?', choices: ['Sevoflurane', 'Propofol', 'Dexmedetomidine', 'Ondansetron'], answer: 0, why: 'The volatile anesthetic labels (and succinylcholine) tell you to stop triggering agents and give IV dantrolene if malignant hyperthermia is suspected.' },
      { q: 'Which agent does the heparin label say will neutralize heparin when bleeding requires reversal?', choices: ['Vitamin K', 'Protamine sulfate', 'Sugammadex', 'Naloxone'], answer: 1, why: 'Heparin label, Overdosage: protamine sulfate (1% solution) by slow infusion will neutralize heparin sodium.' },
    ]);
  },
};
