// How LLMs are trained: the pipeline, with a live next-character model trained by gradient descent for the pretraining stage.

const TEXT = 'it was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of light, it was the season of darkness, it was the spring of hope, it was the winter of despair. alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do. once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it. call me ishmael. some years ago, having little or no money in my purse, and nothing particular to interest me on shore, i thought i would sail about a little and see the watery part of the world.';

const STAGES = [
  { id: 'pre', n: '1', name: 'Pretraining', sub: 'predict the next token' },
  { id: 'sft', n: '2', name: 'Instruction tuning', sub: 'learn to follow requests' },
  { id: 'pref', n: '3', name: 'Preference tuning', sub: 'learn what people prefer' },
  { id: 'eval', n: '4', name: 'Evaluation', sub: 'test before release' },
];

const COMPARE = [
  {
    p: 'Write a haiku about the sea.',
    base: 'Write a haiku about the sea.\nWrite a haiku about the mountains.\nWrite a haiku about autumn leaves.\n\nThese prompts are part of our poetry worksheet for year 6. Students should',
    tuned: 'Grey waves fold and break,\nsalt wind carries gull voices,\nthe tide keeps its time.',
  },
  {
    p: 'What is the boiling point of water at sea level?',
    base: 'What is the boiling point of water at sea level? What is the freezing point? Answer these questions in your lab notebook before Thursday.\n\nQ: What is the boiling point of',
    tuned: 'At sea level (standard atmospheric pressure), water boils at 100 °C, which is 212 °F. At higher altitudes the pressure is lower, so it boils at a lower temperature.',
  },
  {
    p: 'Can you help me write a polite email declining a meeting?',
    base: 'Can you help me write a polite email declining a meeting? asked by jenny_k on the forum\n\n12 replies\n\nRe: I always just say I am busy lol',
    tuned: 'Of course. Here is a short version:\n\nHi Sam,\nThank you for the invitation. Unfortunately I can’t make Thursday’s meeting. Could you share the notes afterwards? Happy to follow up by email.\nBest,\nAlex',
  },
];

const PAIRS = [
  { p: 'How do I get a stain out of a cotton shirt?', a: 'Blot it, rinse from the back with cold water, rub in a little washing up liquid or stain remover, wait 10 minutes, then wash as usual. Check the stain is gone before drying, because heat can set it.', b: 'Stains are a common problem that many people face. There are many types of stains and many ways to remove them. It depends on the stain. You could try various products available in shops.', better: 'a', why: 'A is specific and actionable. B is vague filler.' },
  { p: 'Is it safe to eat raw cookie dough?', a: 'Yes, totally fine, people do it all the time!', b: 'It carries some risk: raw flour and raw eggs can carry bacteria such as E. coli and Salmonella. Dough sold as "safe to eat" uses heat-treated flour and no raw egg, so that kind is fine.', better: 'b', why: 'B is accurate and helpful. A sounds friendly but is wrong.' },
  { p: 'Summarise: "The meeting moved from Tuesday to Thursday at 3pm in room 4."', a: 'The meeting is now Thursday at 3pm in room 4.', b: 'The meeting, which was originally scheduled for Tuesday, has been rescheduled. It will now take place on Thursday. The time is 3pm. The location is room 4. Please update your calendars accordingly and let me know if you have any questions about this change.', better: 'a', why: 'A is a summary. B is longer than the original.' },
];

export default {
  mount(ctx) {
    const C = ctx.colors;
    let stage = ctx.store.get('tl:stage', 'pre');

    // ----- tiny next-character model (logit table) trained with gradient descent -----
    const ch = [...new Set(TEXT)].sort(); const V = ch.length; const ix = Object.fromEntries(ch.map((c, i) => [c, i]));
    const N = Array.from({ length: V }, () => new Array(V).fill(0));
    for (let i = 1; i < TEXT.length; i++) N[ix[TEXT[i - 1]]][ix[TEXT[i]]]++;
    const tot = TEXT.length - 1; const rows = N.map((r) => r.reduce((a, b) => a + b, 0));
    let floor = 0; for (let a = 0; a < V; a++) for (let b = 0; b < V; b++) if (N[a][b]) floor -= (N[a][b] / tot) * Math.log(N[a][b] / rows[a]);
    let W; let losses; let stepN; let sample = '';
    const LR = 4; const MAXSTEP = 400;
    const probs = (a) => { const m = Math.max(...W[a]); const e = W[a].map((x) => Math.exp(x - m)); const s = e.reduce((x, y) => x + y, 0); return e.map((x) => x / s); };
    function resetModel() { W = Array.from({ length: V }, () => new Array(V).fill(0)); losses = [Math.log(V)]; stepN = 0; sample = makeSample(); }
    function trainStep() {
      let L = 0;
      for (let a = 0; a < V; a++) {
        if (!rows[a]) continue; const p = probs(a);
        for (let b = 0; b < V; b++) { if (N[a][b]) L -= N[a][b] * Math.log(p[b]); W[a][b] -= LR * (rows[a] * p[b] - N[a][b]) / tot; }
      }
      stepN++; losses.push(L / tot);
    }
    function makeSample() {
      let c = ix.t; let s = 't'; let seed = 12345 + stepN;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      for (let i = 0; i < 90; i++) { const p = probs(c); let r = rnd(); let k = 0; for (; k < V - 1; k++) { r -= p[k]; if (r <= 0) break; } s += ch[k]; c = k; }
      return s;
    }
    resetModel();

    ctx.tall();
    const root = ctx.h(`<div class="tl"><style>
      .tl{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:14px;padding:2px 2px 30px}
      .tl .pipe{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
      .tl .st{position:relative;text-align:left;border:1px solid #2A2A2A;background:#141414;border-radius:10px;padding:9px 10px;display:grid;gap:2px;color:#A0A09A;transition:border-color .2s,background .2s}
      .tl .st b{font:700 15px/1.05 Rajdhani,sans-serif;text-transform:uppercase;letter-spacing:.03em;color:#E8E8E3}
      .tl .st i{font:500 10.5px "DM Mono",monospace;font-style:normal}
      .tl .st small{font:500 11px "DM Mono",monospace;color:#5A5A55}
      .tl .st.on{border-color:var(--sc);background:#1E1E1E}
      .tl .st.on small{color:var(--sc)}
      .tl .body{display:flex;flex-direction:column;gap:12px}
      .tl .cvw{position:relative;height:250px;border:1px solid #2A2A2A;border-radius:10px;background:rgba(10,10,10,.5)}
      .tl .smp{font:500 13.5px/1.5 "DM Mono",monospace;color:#E8E8E3;background:#141414;border:1px solid #2A2A2A;border-radius:10px;padding:10px 12px;white-space:pre-wrap;word-break:break-word}
      .tl .lab{font:600 11px Rajdhani,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#A0A09A}
      .tl .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .tl .box{border:1px solid #2A2A2A;border-radius:10px;padding:10px 12px;background:#141414;display:flex;flex-direction:column;gap:6px}
      .tl .box p{margin:0;white-space:pre-wrap;font-size:14px}
      .tl .warn{font:500 11px "DM Mono",monospace;color:#FBBF24}
      .tl button.pick{cursor:pointer;text-align:left;color:inherit;font:inherit}
      .tl button.pick:hover{border-color:#5A5A55}
      .tl button.pick.good{border-color:#4ade80}
      .tl button.pick.meh{opacity:.55}
      @media (max-width:640px){.tl .pipe{grid-template-columns:1fr 1fr}.tl .two{grid-template-columns:1fr}}
    </style><div class="pipe"></div><div class="body"></div></div>`);
    ctx.stage.append(root);
    const pipe = root.querySelector('.pipe'); const body = root.querySelector('.body');
    const scol = { pre: C.c1, sft: C.c2, pref: C.c3, eval: C.c5 };
    STAGES.forEach((s) => {
      const b = ctx.h(`<button class="st" data-s="${s.id}" style="--sc:${scol[s.id]}"><small>STAGE ${s.n}</small><b>${s.name}</b><i>${s.sub}</i></button>`);
      b.onclick = () => { stage = s.id; ctx.store.set('tl:stage', stage); render(); };
      pipe.append(b);
    });

    let stopTrain = null; let cv = null; let ac2 = null;
    function drawLoss() {
      if (!cv || !cv.w) return; const g = cv.ctx; const w = cv.w; const h = cv.h;
      g.clearRect(0, 0, w, h);
      const L = 44; const R = 14; const T = 18; const B = 30; const y0 = 1.6; const y1 = 3.4;
      const X = (i) => L + (w - L - R) * i / MAXSTEP; const Y = (v) => T + (h - T - B) * (1 - (v - y0) / (y1 - y0));
      g.strokeStyle = C.border; g.lineWidth = 1; g.font = '500 11px "DM Mono", monospace'; g.fillStyle = C.muted; g.textAlign = 'right';
      for (let v = 1.6; v <= 3.41; v += 0.6) { g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(w - R, Y(v)); g.stroke(); g.fillText(v.toFixed(1), L - 6, Y(v) + 4); }
      g.textAlign = 'center'; g.fillText('training steps', (L + w - R) / 2, h - 8);
      g.save(); g.translate(12, (T + h - B) / 2); g.rotate(-Math.PI / 2); g.fillText('loss', 0, 0); g.restore();
      const ref = (v, col, txt) => { g.strokeStyle = col; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(w - R, Y(v)); g.stroke(); g.setLineDash([]); g.fillStyle = col; g.textAlign = 'right'; g.fillText(txt, w - R - 4, Y(v) - 5); };
      ref(Math.log(V), C.c4, `random guessing ln(${V}) = ${Math.log(V).toFixed(2)}`);
      ref(floor, C.c6, `best possible for this model = ${floor.toFixed(2)}`);
      g.strokeStyle = C.c1; g.lineWidth = 2; g.beginPath();
      losses.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)))); g.stroke();
      const lv = losses[losses.length - 1]; g.fillStyle = C.c1; g.beginPath(); g.arc(X(losses.length - 1), Y(lv), 4, 0, 7); g.fill();
      g.textAlign = 'left'; g.fillStyle = C.text; g.fillText(`step ${stepN}  loss ${lv.toFixed(3)}`, L + 6, T + 4);
    }

    function render() {
      if (stopTrain) { stopTrain(); stopTrain = null; }
      if (ac2) ac2.abort();
      ac2 = new AbortController();
      pipe.querySelectorAll('.st').forEach((b) => b.classList.toggle('on', b.dataset.s === stage));
      body.innerHTML = ''; cv = null;
      if (stage === 'pre') {
        body.append(ctx.h(`<div class="lab">A tiny model learning to predict the next character, live</div>`));
        const wrap = ctx.h('<div class="cvw"></div>'); body.append(wrap);
        cv = ctx.canvas({ parent: wrap }); cv.onResize(drawLoss);
        const ctl = ctx.h('<div class="row"><button class="btn sm" data-a="go">Train</button><button class="btn ghost sm" data-a="reset">Reset weights</button><span class="hint st2"></span></div>');
        body.append(ctl, ctx.h('<div class="lab">What it writes right now (sampled from its predictions)</div>'));
        const smp = ctx.h('<div class="smp"></div>'); body.append(smp);
        body.append(ctx.h(`<p class="small muted">Training text: ${TEXT.length} characters. The model is a table of ${V}×${V} = ${V * V} numbers: for each character, a score for every possible next one. Each step nudges every number downhill on the loss (gradient descent).</p>`));
        const upd = () => { smp.textContent = sample; ctl.querySelector('.st2').textContent = stepN >= MAXSTEP ? 'done' : ''; drawLoss(); };
        const go = ctl.querySelector('[data-a=go]');
        const stop = () => { if (stopTrain) { stopTrain(); stopTrain = null; } go.textContent = stepN >= MAXSTEP ? 'Finished' : 'Train'; };
        go.onclick = () => {
          if (stopTrain) return stop();
          if (stepN >= MAXSTEP) return;
          go.textContent = 'Pause'; let acc = 0;
          stopTrain = ctx.loop((t, dt) => {
            acc += dt * 60;
            while (acc >= 1 && stepN < MAXSTEP) { trainStep(); acc -= 1; if (stepN % 10 === 0) sample = makeSample(); }
            upd(); if (stepN >= MAXSTEP) { sample = makeSample(); upd(); stop(); }
          });
        };
        ctl.querySelector('[data-a=reset]').onclick = () => { stop(); resetModel(); go.textContent = 'Train'; upd(); };
        upd();
      } else if (stage === 'sft') {
        body.append(ctx.h(`<div class="lab">Training examples look like this</div>`));
        body.append(ctx.h(`<div class="smp" style="font-size:12.5px">&lt;user&gt; Translate "good morning" into French.\n&lt;assistant&gt; Bonjour.\n\n&lt;user&gt; Give me three names for a grey cat.\n&lt;assistant&gt; Smoke, Pebble and Ash.</div>`));
        body.append(ctx.h(`<p class="small muted">Same next-token objective as pretraining, but on many thousands of conversations written or checked by people. The model learns the format: a request, then a helpful answer, then stop.</p>`));
        body.append(ctx.h(`<div class="lab">Same prompt, before and after <span class="warn">(illustrative, written by hand)</span></div>`));
        const seg = ctx.seg(COMPARE.map((c, i) => [i, `Prompt ${i + 1}`]), 0, (v) => show(+v));
        body.append(seg);
        const cmp = ctx.h('<div style="display:grid;gap:10px"><div class="box"><span class="lab">Prompt</span><p class="pp"></p></div><div class="two"><div class="box"><span class="lab" style="color:#A0A09A">Base model (pretraining only)</span><p class="bb" style="color:#A0A09A"></p></div><div class="box" style="border-color:rgba(251,191,36,.45)"><span class="lab" style="color:#FBBF24">After instruction tuning</span><p class="tt"></p></div></div></div>');
        body.append(cmp);
        const show = (i) => { cmp.querySelector('.pp').textContent = COMPARE[i].p; cmp.querySelector('.bb').textContent = COMPARE[i].base; cmp.querySelector('.tt').textContent = COMPARE[i].tuned; };
        show(0);
      } else if (stage === 'pref') {
        body.append(ctx.h(`<div class="lab">You are the labeller. Pick the better answer.</div>`));
        let k = 0; let agree = 0;
        const box = ctx.h('<div style="display:grid;gap:10px"></div>'); body.append(box);
        const showPair = () => {
          if (k >= PAIRS.length) {
            box.innerHTML = `<div class="box"><p>You matched the usual preference on ${agree} of ${PAIRS.length}. In real preference tuning, many people make choices like these for a very large number of pairs. Those choices train a reward model, or are used directly (methods such as DPO), to shift the model toward answers people prefer.</p></div><div class="row"><button class="btn ghost sm">Again</button></div>`;
            box.querySelector('button').onclick = () => { k = 0; agree = 0; showPair(); };
            return;
          }
          const pr = PAIRS[k];
          box.innerHTML = `<div class="box"><span class="lab">Prompt ${k + 1} of ${PAIRS.length}</span><p>${ctx.esc(pr.p)}</p></div><div class="two"><button class="box pick" data-c="a"><span class="lab">Answer A</span><p>${ctx.esc(pr.a)}</p></button><button class="box pick" data-c="b"><span class="lab">Answer B</span><p>${ctx.esc(pr.b)}</p></button></div><p class="small fbk"></p>`;
          box.querySelectorAll('.pick').forEach((b) => b.addEventListener('click', () => {
            if (box.dataset.done === String(k)) return; box.dataset.done = String(k);
            if (b.dataset.c === pr.better) agree++;
            box.querySelectorAll('.pick').forEach((x) => x.classList.add(x.dataset.c === pr.better ? 'good' : 'meh'));
            box.querySelector('.fbk').innerHTML = `${ctx.esc(pr.why)} <button class="btn sm" style="margin-left:6px">Next</button>`;
            box.querySelector('.fbk button').onclick = () => { k++; showPair(); };
          }));
        };
        showPair();
        body.append(ctx.h(`<p class="small muted">Example pairs are written for this demo. Notice that preferences encode values: being accurate, concise, safe and honest about uncertainty. Done badly, the same process can reward answers that merely sound confident or flatter the user.</p>`));
      } else {
        body.append(ctx.h(`<div class="lab">How models are checked</div>`));
        const items = [
          ['Benchmarks', 'Fixed sets of questions with known answers (maths, code, science, reading). Scores are easy to compare, but a model may have seen the test questions in its training data, which inflates results.'],
          ['Held-out tests', 'Data deliberately kept out of training. Doing well only on training data means memorising, not learning.'],
          ['Human ratings', 'People compare answers side by side for helpfulness and accuracy. Slower and costly, but closer to real use.'],
          ['Red teaming', 'People and automated tools try to make the model misbehave: give dangerous instructions, leak private data, or ignore its rules.'],
          ['After release', 'Monitoring real usage, user reports and new evaluations. Problems found here feed the next round of training.'],
        ];
        const grid = ctx.h('<div class="two"></div>');
        items.forEach(([t, d]) => grid.append(ctx.h(`<div class="box"><span class="lab" style="color:${C.c5}">${t}</span><p class="small">${d}</p></div>`)));
        body.append(grid);
      }
    }
    render();
    document.fonts && document.fonts.ready.then(() => { if (!ctx.signal.aborted) drawLoss(); });

    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">How LLMs are trained</h2>'), ctx.h('<p class="lede">A chat model is built in stages. First it learns language by predicting the next token in an enormous amount of text. Then it is taught to be a helpful assistant.</p>'));
    P.append(
      ctx.h(`<div class="card tip"><p><b>Pretraining</b> is where nearly all the compute goes. The model reads text and at every position predicts the next token. The loss measures how surprised it was by the real next token; training adjusts the weights to be less surprised. Do that over trillions of tokens and grammar, facts, styles and some reasoning patterns get soaked into the weights. The result is a <b>base model</b>: it continues text, it does not yet answer you.</p><p><b>Instruction tuning</b> and <b>preference tuning</b> are much smaller stages that shape the base model into an assistant. <b>Evaluation</b> happens throughout.</p></div>`),
      ctx.h(`<div class="card try"><ol>
        <li>In <b>Pretraining</b>, press <b>Train</b>. Watch the loss fall from random guessing toward the floor, and the sample text go from noise to word-like chunks.</li>
        <li>Open <b>Instruction tuning</b> and compare base versus tuned answers. The base model treats your request as a document to continue.</li>
        <li>In <b>Preference tuning</b>, play the labeller.</li>
      </ol></div>`),
      ctx.h(`<div class="card deep">
        <p><b>The toy:</b> a character bigram model, the simplest possible next-token predictor, trained with real gradient descent on cross-entropy loss. Real LLMs use the same loss, but the predictor is a transformer that sees thousands of previous tokens instead of one character.</p>
        <div class="formula">loss = average of −log p(actual next token)<span>random guessing over V options gives ln V</span></div>
        <p><b>Data scale (published figures):</b> GPT-3 (2020) was trained on about 300 billion tokens. Llama 2 (2023) used about 2 trillion, and Llama 3 (2024) over 15 trillion. Sources are mostly filtered web pages, books, code and reference text.</p>
        <p><b>Compute:</b> a common rule of thumb is that training costs about 6 × parameters × tokens floating point operations. A 7 billion parameter model on 2 trillion tokens is about 8 × 10²² operations, which takes thousands of GPUs weeks. Research on scaling (the "Chinchilla" study) suggested roughly 20 training tokens per parameter as compute-efficient; many recent models train on far more than that.</p>
        <p><b>Preference tuning:</b> RLHF (reinforcement learning from human feedback) trains a reward model on human choices, then optimises the LLM against it. Newer methods such as DPO skip the separate reward model. Some labs also use AI feedback guided by written principles.</p>
      </div>`),
    );

    ctx.quiz([
      { q: 'What is the training task during pretraining?', choices: ['Answer questions from users', 'Predict the next token in large amounts of text', 'Classify text as good or bad', 'Copy text exactly'], answer: 1, why: 'Pretraining is next-token prediction at huge scale.' },
      { q: 'Why does a base model often continue your question instead of answering it?', choices: ['It is broken', 'It learned to continue documents, and has not been tuned on request and answer examples', 'It refuses on purpose', 'Its temperature is too low'], answer: 1, why: 'Instruction tuning teaches the assistant format; before that it just continues text.' },
      { q: 'In preference tuning, what do people provide?', choices: ['New facts', 'Choices between alternative answers', 'Source code', 'Token vocabularies'], answer: 1, why: 'Comparisons between answers are turned into a training signal toward preferred behaviour.' },
    ]);
    return () => { if (stopTrain) stopTrain(); if (ac2) ac2.abort(); };
  },
};
