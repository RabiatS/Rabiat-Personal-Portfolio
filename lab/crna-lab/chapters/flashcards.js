// Flashcards with spaced repetition (Leitner boxes), built from the label data.
import { loadDrugs, esc, stated, items, srcLink, CATS, namedAgent, mask } from '../shared.js';

const INTERVAL = [0, 10, 60 * 24, 60 * 24 * 3, 60 * 24 * 7, 60 * 24 * 21]; // minutes per box
const TYPES = [['class', 'Class'], ['mech', 'Mechanism'], ['which', 'Which drug?'], ['rev', 'Reversal'], ['cat', 'Category']];

function firstSentences(t, n = 2, max = 360) {
  const s = t.replace(/\n/g, ' ').match(/[^.!?]+[.!?]+(\s|$)/g) || [t];
  let out = s.slice(0, n).join('').trim();
  if (out.length > max) out = `${out.slice(0, max).replace(/\s+\S*$/, '')} ...`;
  return out;
}

function buildCards(drugs) {
  const cards = [];
  for (const d of drugs) {
    if (stated(d.class)) cards.push({ id: `class:${d.id}`, type: 'class', d, front: d.name, ask: 'What class is it? (label wording)', back: `<p class="a">${esc(d.class.text)}</p>${d.epc && d.epc.text !== d.class.text ? `<p class="small muted">FDA established class: ${esc(d.epc.text)}</p>` : ''}${srcLink(d, d.class.src)}` });
    if (stated(d.mechanism)) {
      cards.push({ id: `mech:${d.id}`, type: 'mech', d, front: d.name, ask: 'How does it work?', back: `<p class="a">${esc(firstSentences(d.mechanism.text))}</p>${srcLink(d, d.mechanism.src)}` });
      const m = mask(d, firstSentences(d.mechanism.text, 2, 300));
      if (m.includes('____')) cards.push({ id: `which:${d.id}`, type: 'which', d, front: 'Which drug?', ask: `<span class="small" style="text-transform:none;font:400 16px/1.5 var(--f-body)">"${esc(m)}"</span>`, askHtml: true, back: `<p class="a" style="font:700 30px var(--f-display);text-transform:uppercase">${esc(d.name)}</p>${srcLink(d, d.mechanism.src)}` });
    }
    const na = namedAgent(d);
    if (na) cards.push({ id: `rev:${d.id}`, type: 'rev', d, front: d.name, ask: 'Which reversal agent or antidote does its label name?', back: `<p class="a" style="font:700 26px var(--f-display);text-transform:uppercase">${esc(na.agent)}</p><p class="small">${esc(na.item.text)}</p>${srcLink(d, na.item.src)}` });
    cards.push({ id: `cat:${d.id}`, type: 'cat', d, front: d.name, ask: 'Which category and group?', back: `<p class="a" style="font:700 26px var(--f-display);text-transform:uppercase">${esc(CATS[d.category])}</p><p class="a">${esc(d.group)}</p><p class="hint">This is the lab's study grouping, not label text.</p>` });
  }
  return cards;
}

export default {
  mount(ctx) {
    const wrap = ctx.h(`<div class="fc-wrap">
      <div class="row" style="justify-content:space-between"><span class="eyebrow fc-status"></span><span class="eyebrow fc-box"></span></div>
      <div class="fc-scene"><div class="fc" tabindex="0" role="button" aria-label="Flashcard. Press space or tap to flip.">
        <div class="face front"><span class="kind"></span><div class="q"></div><div class="ask small"></div><span class="hintline">Tap or press space to flip</span></div>
        <div class="face back"><span class="kind"></span><div class="ans"></div></div>
      </div></div>
      <div class="fc-rate"><button class="btn ghost" data-r="0">Again <span class="kbd">1</span></button><button class="btn ghost" data-r="1">Hard <span class="kbd">2</span></button><button class="btn" data-r="2">Good <span class="kbd">3</span></button><button class="btn ghost" data-r="3">Easy <span class="kbd">4</span></button></div>
    </div>`);
    ctx.stage.append(wrap);
    const fc = wrap.querySelector('.fc'); const status = wrap.querySelector('.fc-status'); const boxLbl = wrap.querySelector('.fc-box');
    const rateBtns = [...wrap.querySelectorAll('.fc-rate button')];
    let srs = ctx.store.get('srs', {});
    let all = []; let deck = []; let cur = null; let flipped = false;
    let cat = ctx.store.get('fc:cat', 'all'); let types = new Set(ctx.store.get('fc:types', ['class', 'mech', 'rev']));

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Flashcards</h2>'),
      ctx.h('<p class="lede">Short daily reviews beat long cramming. Cards you know drift to longer gaps; cards you miss come straight back.</p>'),
    );
    const catSeg = ctx.seg([['all', 'All'], ['anesthesia', 'Anesthesia'], ['cardiac', 'Cardiac'], ['supporting', 'Supporting']], cat, (v) => { cat = v; ctx.store.set('fc:cat', v); rebuild(); next(); });
    const typeRow = ctx.h(`<div class="row">${TYPES.map(([v, l]) => `<button class="chip ${types.has(v) ? 'on' : ''}" data-t="${v}">${l}</button>`).join('')}</div>`);
    typeRow.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      const t = b.dataset.t; if (types.has(t) && types.size > 1) types.delete(t); else types.add(t);
      b.classList.toggle('on', types.has(t)); typeRow.querySelectorAll('button').forEach((x) => x.classList.toggle('on', types.has(x.dataset.t)));
      ctx.store.set('fc:types', [...types]); rebuild(); next();
    }, { signal: ctx.signal }));
    const boxes = ctx.h('<div class="boxes" aria-label="Cards per box"></div>');
    const stats = ctx.h('<div class="stat"><div><b class="s-due">0</b><span>due now</span></div><div><b class="s-new">0</b><span>new</span></div><div><b class="s-done">0</b><span>reviewed today</span></div></div>');
    const reset = ctx.h('<button class="btn ghost sm" style="align-self:flex-start">Reset this deck</button>');
    reset.addEventListener('click', () => { if (!confirm('Forget your progress on these cards?')) return; for (const c of deck) delete srs[c.id]; ctx.store.set('srs', srs); next(); }, { signal: ctx.signal });
    ctx.panel.append(ctx.h('<span class="eyebrow">Deck</span>'), catSeg, ctx.h('<span class="eyebrow">Card types</span>'), typeRow, stats, ctx.h('<span class="eyebrow">Boxes: new, then 10 min, 1 day, 3 days, 1 week, 3 weeks</span>'), boxes, reset,
      ctx.h('<div class="card tip"><p>This is the Leitner system. Every card lives in a box. Rate a card <b>Good</b> and it moves up one box, so you see it again after a longer gap. <b>Again</b> sends it back to the start. Over a few weeks the cards you know well stop taking your time, and the hard ones keep coming up.</p></div>'),
      ctx.h('<div class="card try"><ol><li>Start with <b>Class</b> and <b>Mechanism</b> for <b>Anesthesia</b>.</li><li>Say the answer out loud before you flip. Be honest with the rating.</li><li>Add <b>Which drug?</b>: you get the label\'s mechanism sentence with the name hidden.</li><li>Come back tomorrow. The cards you rated Good will be due again.</li></ol></div>'),
      ctx.h('<details class="more"><summary>Going deeper: why spacing works</summary><div><p class="small">Retrieval practice (testing yourself) and spacing (reviewing at growing intervals) are two of the most reliable findings in learning research. Each successful recall at a longer gap makes the memory more durable. Rating Hard keeps the box but shortens the gap.</p><p class="small">Your boxes are saved in this browser only. Answers come from the FDA label data in this lab, except Category cards, which use the lab\'s own grouping.</p></div></details>'),
    );

    const now = () => Date.now() / 60000;
    function rebuild() {
      deck = all.filter((c) => types.has(c.type) && (cat === 'all' || c.d.category === cat));
    }
    function counts() {
      const t = now(); let due = 0; let neu = 0; const per = [0, 0, 0, 0, 0, 0];
      for (const c of deck) { const s = srs[c.id]; if (!s) { neu++; per[0]++; continue; } per[s.b]++; if (s.due <= t) due++; }
      const today = new Date().toDateString();
      const done = Object.values(srs).filter((s) => s.last && new Date(s.last * 60000).toDateString() === today).length;
      stats.querySelector('.s-due').textContent = due; stats.querySelector('.s-new').textContent = neu; stats.querySelector('.s-done').textContent = done;
      const mx = Math.max(1, ...per);
      boxes.innerHTML = per.map((n, i) => `<div class="bx"><i style="height:${Math.round((n / mx) * 44) + 2}px;background:${['#5A5A55', '#FB7185', '#FBBF24', '#A78BFA', '#60A5FA', '#5EEAD4'][i]}"></i>${n}</div>`).join('');
    }
    function next() {
      counts();
      if (!deck.length) { cur = null; show(); return; }
      const t = now();
      const due = deck.filter((c) => srs[c.id] && srs[c.id].due <= t).sort((a, b) => srs[a.id].due - srs[b.id].due);
      const fresh = deck.filter((c) => !srs[c.id]);
      let pool = due.length ? due.slice(0, 3) : fresh.length ? [fresh[Math.floor(Math.random() * Math.min(fresh.length, 12))]] : deck.slice().sort((a, b) => srs[a.id].b - srs[b.id].b || srs[a.id].due - srs[b.id].due).slice(0, 3);
      if (cur && pool.length > 1) pool = pool.filter((c) => c.id !== cur.id);
      cur = pool[Math.floor(Math.random() * pool.length)];
      status.textContent = due.length ? `${due.length} due` : fresh.length ? 'New card' : 'Nothing due: studying ahead';
      show();
    }
    function show() {
      flipped = false; fc.classList.remove('flip');
      const kind = cur ? TYPES.find((x) => x[0] === cur.type)[1] : '';
      fc.querySelectorAll('.kind').forEach((k) => { k.textContent = kind; });
      if (!cur) { fc.querySelector('.q').textContent = 'No cards'; fc.querySelector('.ask').textContent = 'Pick another deck or card type.'; return; }
      fc.querySelector('.q').textContent = cur.front;
      fc.querySelector('.ask').innerHTML = cur.askHtml ? cur.ask : esc(cur.ask);
      fc.querySelector('.ans').innerHTML = `<p class="eyebrow" style="margin-bottom:6px">${esc(cur.front === 'Which drug?' ? 'Answer' : cur.d.name)}</p>${cur.back}`;
      const s = srs[cur.id];
      boxLbl.textContent = s ? `Box ${s.b} of 5` : 'New';
      rateBtns.forEach((b) => { b.disabled = true; });
    }
    function flip() { if (!cur) return; flipped = !flipped; fc.classList.toggle('flip', flipped); if (flipped) rateBtns.forEach((b) => { b.disabled = false; }); }
    function rate(r) {
      if (!cur || !flipped) return;
      const s = srs[cur.id] || { b: 0, due: 0, n: 0 };
      if (r === 0) s.b = 1; else if (r === 2) s.b = Math.min(5, s.b + 1); else if (r === 3) s.b = Math.min(5, s.b + 2); else s.b = Math.max(1, s.b);
      const iv = INTERVAL[s.b] * (r === 1 ? 0.5 : 1);
      s.due = now() + (r === 0 ? 1 : iv); s.n = (s.n || 0) + 1; s.last = now();
      srs[cur.id] = s; ctx.store.set('srs', srs);
      if (Object.keys(srs).length >= 15) ctx.done();
      next();
    }
    fc.addEventListener('click', (e) => { if (e.target.closest('a')) return; flip(); }, { signal: ctx.signal });
    rateBtns.forEach((b) => b.addEventListener('click', () => rate(+b.dataset.r), { signal: ctx.signal }));
    document.addEventListener('keydown', (e) => {
      if (e.target.closest('input, textarea, select')) return;
      const free = document.activeElement === document.body || document.activeElement === fc;
      if ((e.key === ' ' || e.key === 'Enter') && free) { e.preventDefault(); flip(); }
      if (['1', '2', '3', '4'].includes(e.key) && free) rate(+e.key - 1);
    }, { signal: ctx.signal });

    loadDrugs().then((doc) => { if (ctx.signal.aborted) return; all = buildCards(doc.drugs); rebuild(); next(); });

    ctx.quiz([
      { q: 'You rate a card Good. What happens?', choices: ['It is deleted', 'It moves up one box and comes back after a longer gap', 'It comes back in one minute', 'Nothing'], answer: 1, why: 'Good moves the card one box up. Again sends it back to box 1, due in about a minute.' },
      { q: 'Which drug does its own label call "an essentially pure opioid antagonist"?', choices: ['Flumazenil', 'Naloxone', 'Neostigmine', 'Nalbuphine'], answer: 1, why: 'The naloxone label (Clinical Pharmacology) uses those words.' },
      { q: 'The midazolam label describes midazolam as a short-acting what?', choices: ['Barbiturate', 'Benzodiazepine CNS depressant', 'Alpha-2 agonist', 'Opioid'], answer: 1, why: 'Clinical Pharmacology: midazolam is a short-acting benzodiazepine central nervous system (CNS) depressant.' },
    ]);
  },
};
