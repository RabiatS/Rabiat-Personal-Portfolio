// Retrieval augmented generation: TF-IDF search over a small note collection, then the exact prompt a model would receive.

const NOTES = [
  ['Cafe opening hours', 'Harbour Street Cafe opens at 7am on weekdays and 9am on Saturday and Sunday. It closes at 6pm every day except Sunday, when it closes at 3pm.'],
  ['Refund policy', 'Online orders can be refunded within 30 days if the item is unused. Send the order number to the support team. Refunds go back to the original card within 5 working days.'],
  ['Guest wifi', 'The guest wifi network is called Lantern-Guest. The password changes every Monday and is printed on the card at reception.'],
  ['Watering houseplants', 'Most houseplants prefer to dry out slightly between waterings. Push a finger into the soil: if the top 2 cm is dry, water until it drains from the bottom of the pot.'],
  ['Flat bicycle tyre', 'To fix a flat bicycle tyre, remove the wheel, lever the tyre off the rim, find the hole by pumping up the tube and listening for air, then patch it or fit a new inner tube.'],
  ['The Moon', 'The Moon is about 384,000 km from Earth on average. Light reflected from the Moon takes a little over one second to reach us.'],
  ['Photosynthesis', 'Plants use sunlight, water and carbon dioxide to make sugar in a process called photosynthesis. Oxygen is released as a by-product.'],
  ['Design team summer break', 'The design team summer break this year runs from 4 to 15 August. Urgent design requests during the break go to Priya.'],
  ['Pancake recipe', 'For 8 pancakes, whisk 100 g flour, 2 eggs and 300 ml milk with a pinch of salt. Rest the batter for 30 minutes, then fry in a hot, lightly oiled pan.'],
  ['Sorting lists in Python', 'In Python, sorted(items) returns a new sorted list, while items.sort() sorts the list in place. Use key= to sort by a field and reverse=True for descending order.'],
  ['Library card renewal', 'Northfield library cards must be renewed every two years. Bring photo ID and proof of address to any branch. Renewal is free.'],
  ['Parking', 'Staff parking is in the north car park. Visitors should use bays 1 to 20 next to the main entrance and register their car number at reception.'],
];

const STOP = new Set('a an the and or but if of to in on at by for with from is are was were be been it its this that these those do does did i you we they he she my your our their what when where who how which can could should would will just than then so as not no into about up down over out there here me us them'.split(' '));
const stem = (w) => w.length > 5 && w.endsWith('ing') ? w.slice(0, -3) : w.length > 4 && w.endsWith('ed') ? w.slice(0, -2) : w.length > 4 && w.endsWith('es') && !w.endsWith('ses') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w;
const terms = (s) => (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => !STOP.has(w)).map(stem);

export default {
  mount(ctx) {
    const C = ctx.colors;
    const docs = NOTES.map(([t, body]) => ({ t, body, terms: terms(`${t} ${body}`) }));
    const df = new Map(); for (const d of docs) for (const w of new Set(d.terms)) df.set(w, (df.get(w) || 0) + 1);
    const idf = (w) => Math.log((docs.length + 1) / ((df.get(w) || 0) + 1)) + 1;
    const vec = (ts) => { const m = new Map(); for (const w of ts) m.set(w, (m.get(w) || 0) + 1); const v = new Map(); for (const [w, c] of m) v.set(w, (c / ts.length) * idf(w)); return v; };
    const cos = (a, b) => { let d = 0; for (const [w, x] of a) if (b.has(w)) d += x * b.get(w); const n = (v) => Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0)); return d / ((n(a) * n(b)) || 1); };
    for (const d of docs) d.v = vec(d.terms);

    let q = ctx.store.get('rag:q', 'When does the cafe open on Sunday?'); let k = 3;

    ctx.tall();
    const root = ctx.h(`<div class="rg"><style>
      .rg{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:2px 2px 30px}
      .rg .cols{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:14px;align-items:start}
      .rg .list{display:grid;gap:6px}
      .rg .doc{border:1px solid #2A2A2A;border-radius:10px;padding:8px 10px;background:#141414;display:grid;gap:4px;transition:border-color .25s,opacity .25s}
      .rg .doc.hit{border-color:var(--hc);background:#181818}
      .rg .doc.miss{opacity:.5}
      .rg .doc .hd{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
      .rg .doc b{font:700 14px Rajdhani,sans-serif;text-transform:uppercase;letter-spacing:.04em}
      .rg .doc .sc{font:500 12px "DM Mono",monospace;color:#A0A09A;white-space:nowrap}
      .rg .doc p{margin:0;font-size:13.5px;line-height:1.45;color:#E8E8E3}
      .rg mark{background:rgba(251,191,36,.25);color:#F5F5F0;border-radius:3px;padding:0 2px}
      .rg .sbar{height:4px;border-radius:2px;background:#1E1E1E;overflow:hidden}
      .rg .sbar span{display:block;height:100%;transition:width .35s}
      .rg .lab{font:600 11px Rajdhani,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#A0A09A}
      .rg pre.code{white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.55;max-height:none}
      .rg pre .ins{color:#A78BFA}.rg pre .ctxt{color:#5EEAD4}.rg pre .qq{color:#FBBF24}
      .rg .flow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font:500 11.5px "DM Mono",monospace;color:#A0A09A}
      .rg .flow span{border:1px solid #3A3A38;border-radius:6px;padding:3px 7px}
      @media (max-width:760px){.rg .cols{grid-template-columns:1fr}}
    </style>
      <div class="row"><input class="txt" style="flex:1;min-width:200px;font-size:15px" aria-label="Question"></div>
      <div class="row pres"></div>
      <div class="flow"><span>question</span>→<span>score every note</span>→<span>take top k</span>→<span>paste into prompt</span>→<span>model answers</span></div>
      <div class="cols"><div><div class="lab" style="margin-bottom:6px">Notes ranked by similarity</div><div class="list"></div></div>
      <div><div class="lab" style="margin-bottom:6px">The exact prompt sent to the model</div><pre class="code"></pre><p class="small muted" style="margin-top:8px">The model never searches anything itself. It just reads this text and continues it, like any other prompt.</p></div></div>
    </div>`);
    ctx.stage.append(root);
    const inp = root.querySelector('input'); inp.value = q;
    const list = root.querySelector('.list'); const pre = root.querySelector('pre');
    inp.addEventListener('input', () => { q = inp.value; ctx.store.set('rag:q', q); run(); }, { signal: ctx.signal });
    for (const s of ['When does the cafe open on Sunday?', 'How do I fix a flat tyre on my bike?', 'What is the wifi password?', 'How far away is the Moon?', 'How do I repair a puncture?', 'Who is the CEO?']) {
      const b = ctx.h(`<button class="chip">${s}</button>`); b.onclick = () => { q = s; inp.value = s; ctx.store.set('rag:q', q); run(); }; root.querySelector('.pres').append(b);
    }

    function run() {
      const qt = terms(q); const qv = vec(qt); const qs = new Set(qt);
      const ranked = docs.map((d, i) => ({ d, i, s: qt.length ? cos(qv, d.v) : 0 })).sort((a, b) => b.s - a.s);
      const hits = ranked.slice(0, k).filter((r) => r.s > 0);
      const max = Math.max(ranked[0].s, 0.01);
      list.innerHTML = ranked.map((r, j) => {
        const hit = j < k && r.s > 0; const col = hit ? C.c1 : C.subtle;
        const body = ctx.esc(r.d.body).replace(/[A-Za-z0-9]+/g, (w) => (qs.has(stem(w.toLowerCase())) && !STOP.has(w.toLowerCase()) ? `<mark>${w}</mark>` : w));
        return `<div class="doc ${hit ? 'hit' : 'miss'}" style="--hc:${C.c1}"><div class="hd"><b style="color:${hit ? C.c1 : C.text2}">${hit ? `#${j + 1} ` : ''}${ctx.esc(r.d.t)}</b><span class="sc">${r.s.toFixed(3)}</span></div><div class="sbar"><span style="width:${(100 * r.s) / max}%;background:${col}"></span></div>${hit || j < k + 2 ? `<p>${body}</p>` : ''}</div>`;
      }).join('');
      const ctxText = hits.length ? hits.map((r, j) => `[${j + 1}] ${r.d.t}\n${r.d.body}`).join('\n\n') : '(no notes matched)';
      pre.innerHTML = `<span class="ins">You are a helpful assistant. Answer the question using only the notes below.
If the notes do not contain the answer, say you don't know.
Cite the note number you used, like [1].</span>

<span class="ctxt">Notes:
${ctx.esc(ctxText)}</span>

<span class="qq">Question: ${ctx.esc(q)}</span>
Answer:`;
      info.innerHTML = `Query terms after cleanup: ${qt.length ? qt.map((t) => `<code>${ctx.esc(t)}</code>`).join(' ') : '<i>none</i>'}<br>Retrieved ${hits.length} of ${docs.length} notes (notes scoring 0 are skipped). Prompt is about ${Math.round(pre.textContent.length / 4)} tokens (at roughly 4 characters per token).`;
    }

    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">Retrieval (RAG)</h2>'), ctx.h('<p class="lede">A model only knows what was in its training data, and it can misremember that. Retrieval augmented generation looks up relevant text first and pastes it into the prompt.</p>'));
    const info = ctx.h('<p class="hint"></p>');
    P.append(ctx.slider({ label: 'Notes to retrieve (k)', min: 1, max: 5, step: 1, value: k, fmt: (v) => `${v}`, onInput: (v) => { k = v; run(); } }), info);
    P.append(
      ctx.h(`<div class="card tip"><p>RAG is a search step bolted onto a chatbot. Your question is turned into a vector, compared with a vector for every stored note, and the closest few are copied into the prompt along with an instruction to answer from them. The model then reads the notes like any other text. Nothing about the model changes; it is simply given the right page to read.</p></div>`),
      ctx.h(`<div class="card try"><ol>
        <li>Pick <b>When does the cafe open on Sunday?</b> The opening hours note wins easily. Read the prompt on the right: that is literally what the model receives.</li>
        <li>Try <b>What is the wifi password?</b> The right note is found, but it does not contain the password. A good model should say so instead of inventing one.</li>
        <li>Compare <b>flat tyre on my bike</b> with <b>repair a puncture</b>. Same meaning, but this simple word matching misses the second one, because "puncture" is not in the note.</li>
        <li>Try <b>Who is the CEO?</b>: nothing relevant exists.</li>
      </ol></div>`),
      ctx.h(`<div class="card deep">
        <p><b>How this demo scores:</b> TF-IDF. Each note becomes a vector with one number per word: how often the word appears in the note, times how rare it is across all notes (rare words like "pancake" count more than common ones). Similarity is the cosine between question and note vectors. Common words are dropped and simple endings are trimmed.</p>
        <p><b>Real systems</b> usually use neural embedding models instead, which place "puncture" near "flat tyre" because they learned meaning, not spelling. Many combine both (hybrid search), split long documents into chunks, and re-rank the top results with a second model.</p>
        <p><b>Why it helps:</b> answers can come from current, private or specific documents the model never saw, and the answer can cite its source so you can check it. <b>Limits:</b> if retrieval picks the wrong chunk, the model may answer confidently from the wrong text; if the answer is spread over many documents, top-k may miss parts; and the model can still ignore or misread the notes. Retrieved text can also contain instructions written by someone else, which is a security risk (prompt injection, covered in the Agents chapter).</p>
      </div>`),
    );
    run();

    ctx.quiz([
      { q: 'What does RAG change about the model?', choices: ['It retrains the model on your documents', 'Nothing: it puts relevant text into the prompt', 'It makes the model bigger', 'It turns off sampling'], answer: 1, why: 'Retrieval only changes what the model is given to read.' },
      { q: 'Why did "repair a puncture" fail to find the bicycle note here?', choices: ['The note was deleted', 'Word-matching search needs the same words; it does not know puncture means flat tyre', 'k was too large', 'The question was too long'], answer: 1, why: 'TF-IDF matches words. Neural embeddings handle synonyms much better.' },
      { q: 'Which is a real limit of RAG?', choices: ['It can only store 12 notes', 'If the wrong text is retrieved, the answer can be confidently wrong', 'It makes answers impossible to cite', 'It only works in English'], answer: 1, why: 'The model trusts what it is given. Bad retrieval leads to bad answers.' },
    ]);
  },
};
