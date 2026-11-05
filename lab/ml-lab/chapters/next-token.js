// How an LLM writes: the next-token loop with a small trigram model trained in the browser, plus temperature, top-k and top-p.

const CORPUS = `once upon a time there was a small cat . the cat lived in a little house by the sea . every morning the cat sat on the warm wall and looked at the sea . the sea was blue and the sky was bright . one day a dog came to the house . the dog was big and friendly . the dog sat next to the cat on the wall . the cat looked at the dog and the dog looked at the cat . they were friends from that day . every evening the cat and the dog walked by the sea . the sun went down and the sky was red and gold . the cat liked the sea but the cat did not like the water . the dog liked the water and the dog ran into the sea . the cat sat on the sand and waited . when the dog came back the cat was happy . at night the cat slept by the fire and the dog slept by the door . the house was quiet and warm . in the morning the sun came up and the birds sang in the trees . the cat ate fish and the dog ate bread . then they went out to play in the garden . the garden was green and full of flowers . a little bird sat in the tree and sang a song . the cat looked up at the bird . the bird looked down at the cat . the dog ran around the garden and the bird flew away . the capital of france is paris . paris is a big city by the river . the city was busy and the streets were full of people . people walked in the park and sat in the sun . the old man in the park fed the birds every day . the birds were happy and sang a song for the old man . once upon a time there was a little girl who lived by the sea . the girl had a cat and a dog . she walked with them every day by the sea and the sun was warm .`;

const tok = (s) => s.toLowerCase().replace(/([.,!?])/g, ' $1 ').split(/\s+/).filter(Boolean);

function train(words) {
  const tri = new Map(); const bi = new Map(); const uni = new Map();
  const inc = (m, k, w) => { let x = m.get(k); if (!x) { x = new Map(); m.set(k, x); } x.set(w, (x.get(w) || 0) + 1); };
  for (let i = 0; i < words.length; i++) {
    uni.set(words[i], (uni.get(words[i]) || 0) + 1);
    if (i >= 1) inc(bi, words[i - 1], words[i]);
    if (i >= 2) inc(tri, `${words[i - 2]} ${words[i - 1]}`, words[i]);
  }
  return { tri, bi, uni };
}

export default {
  mount(ctx) {
    const C = ctx.colors;
    const words = tok(CORPUS); const LM = train(words);
    let prompt = ctx.store.get('nt:prompt', 'the cat'); let gen = [];
    let temp = 1; let topk = 0; let topp = 1; let last = null; let flash = 0; let auto = null;

    function dist(ctxw) {
      const n = ctxw.length; let src; let counts;
      if (n >= 2 && LM.tri.has(`${ctxw[n - 2]} ${ctxw[n - 1]}`)) { counts = LM.tri.get(`${ctxw[n - 2]} ${ctxw[n - 1]}`); src = `trigram: words that followed "${ctxw[n - 2]} ${ctxw[n - 1]}"`; }
      else if (n >= 1 && LM.bi.has(ctxw[n - 1])) { counts = LM.bi.get(ctxw[n - 1]); src = `bigram: "${n >= 2 ? `${ctxw[n - 2]} ${ctxw[n - 1]}` : ctxw[n - 1]}" never seen as a pair, so it only looks at "${ctxw[n - 1]}"`; }
      else { counts = LM.uni; src = 'unigram: never saw this word, so it falls back to overall word frequency'; }
      const total = [...counts.values()].reduce((a, b) => a + b, 0);
      const items = [...counts].map(([w, c]) => ({ w, c, p: c / total })).sort((a, b) => b.p - a.p);
      // reshape: temperature, then top-k, then top-p
      let q;
      if (temp < 0.01) q = items.map((x, i) => (i === 0 ? 1 : 0));
      else { const lg = items.map((x) => Math.log(x.p) / temp); const m = Math.max(...lg); const e = lg.map((v) => Math.exp(v - m)); const s = e.reduce((a, b) => a + b, 0); q = e.map((v) => v / s); }
      const keep = items.map(() => true);
      if (topk > 0) items.forEach((_, i) => { if (i >= topk) keep[i] = false; });
      if (topp < 1) { let cum = 0; items.forEach((_, i) => { if (!keep[i]) return; if (cum >= topp) keep[i] = false; cum += q[i]; }); }
      const ks = q.reduce((s, v, i) => s + (keep[i] ? v : 0), 0) || 1;
      items.forEach((x, i) => { x.q = keep[i] ? q[i] / ks : 0; x.keep = keep[i]; });
      return { items, src, total };
    }
    const context = () => tok(prompt).concat(gen);
    function step() {
      const d = dist(context());
      let r = Math.random(); let pick = d.items[0];
      for (const x of d.items) { if (!x.keep) continue; r -= x.q; if (r <= 0) { pick = x; break; } }
      gen.push(pick.w); last = pick.w; flash = 1; refresh();
      if (gen.length > 80) stopAuto();
    }
    function stopAuto() { if (auto) { auto(); auto = null; } autoBtn.textContent = 'Auto'; }

    const cv = ctx.canvas(); const g = cv.ctx;
    const dock = ctx.h('<div class="dock"><div class="grp glass"><button data-a="step">Next token</button><button data-a="auto">Auto</button><button data-a="reset">Reset</button></div></div>');
    ctx.stage.append(dock);
    const autoBtn = dock.querySelector('[data-a=auto]');
    dock.querySelector('[data-a=step]').onclick = () => { stopAuto(); step(); };
    dock.querySelector('[data-a=reset]').onclick = () => { stopAuto(); gen = []; last = null; refresh(); };
    autoBtn.onclick = () => {
      if (auto) return stopAuto();
      autoBtn.textContent = 'Stop'; let acc = 0;
      auto = ctx.loop((t, dt) => { acc += dt; if (acc > 0.45) { acc = 0; step(); } });
    };

    let cur = null; let ctxInfo = null;
    function draw() {
      const w = cv.w; const h = cv.h; if (!w || !cur) return;
      g.clearRect(0, 0, w, h);
      // text
      const pw = tok(prompt); const all = pw.map((x) => [x, 0]).concat(gen.map((x, i) => [x, i === gen.length - 1 ? 2 : 1]));
      g.font = '400 17px Lora, Georgia, serif';
      const lines = []; let line = []; let lw = 0; const maxW = w - 16;
      for (const [word, kind] of all) {
        const sp = /^[.,!?]$/.test(word) ? '' : ' '; const ww = g.measureText(sp + word).width;
        if (lw + ww > maxW && line.length) { lines.push(line); line = []; lw = 0; }
        line.push([word, kind, sp, ww]); lw += ww;
      }
      lines.push(line);
      const textH = Math.min(5, lines.length) * 26 + 14; const shown = lines.slice(-5);
      shown.forEach((ln, i) => {
        let x = 4; const y = 22 + i * 26;
        for (const [word, kind, sp, ww] of ln) {
          g.fillStyle = kind === 0 ? C.muted : kind === 2 ? C.c2 : C.c1;
          g.fillText((x === 4 ? '' : sp) + word, x, y); x += x === 4 ? g.measureText(word).width : ww;
        }
        if (i === shown.length - 1) { g.fillStyle = C.text; g.globalAlpha = 0.5 + 0.5 * Math.sin(performance.now() / 250); g.fillRect(x + 4, y - 14, 2, 18); g.globalAlpha = 1; }
      });
      // source
      const d = cur; const narrow = w < 640; const top0 = textH + 18; const top = narrow ? top0 + 16 : top0;
      g.font = '500 11px "DM Mono", monospace'; g.fillStyle = C.muted; g.textAlign = 'left';
      let src = d.src; const sw = narrow ? w - 8 : w - 230; let cutS = false; while (g.measureText(src).width > sw && src.length > 10) { src = src.slice(0, -2); cutS = true; }
      g.fillText(cutS ? `${src}\u2026` : src, 4, top0);
      // bars
      const n = Math.min(d.items.length, 12); const bottom = h - 56; const rh = Math.min(30, (bottom - top - 26) / n);
      const lab = 74; const bw = w - lab - 70; const maxP = Math.max(d.items[0].p, ...d.items.map((x) => x.q));
      for (let i = 0; i < n; i++) {
        const it = d.items[i]; const y = top + 14 + i * rh;
        const hl = it.w === last && flash > 0;
        g.font = '500 13px "DM Mono", monospace'; g.textAlign = 'right'; g.fillStyle = it.keep ? C.text : C.subtle; g.fillText(it.w === '.' ? '"."' : it.w, lab - 8, y + rh * 0.62);
        g.fillStyle = C.borderStrong; g.fillRect(lab, y + rh * 0.2, bw * it.p / maxP, rh * 0.6);
        g.fillStyle = hl ? C.c2 : C.c1; g.globalAlpha = it.keep ? 0.9 : 0; g.fillRect(lab, y + rh * 0.3, bw * it.q / maxP, rh * 0.4); g.globalAlpha = 1;
        if (hl) { g.strokeStyle = C.c2; g.globalAlpha = flash; g.strokeRect(lab - 70, y + 1, bw + 140, rh - 2); g.globalAlpha = 1; }
        g.textAlign = 'left'; g.font = '500 11px "DM Mono", monospace'; g.fillStyle = it.keep ? C.text : C.subtle;
        g.fillText(it.keep ? `${(it.q * 100).toFixed(it.q < 0.1 ? 1 : 0)}%` : 'cut', lab + bw * Math.max(it.p, it.q) / maxP + 6, y + rh * 0.62);
      }
      if (d.items.length > n) { g.fillStyle = C.muted; g.font = '500 11px "DM Mono", monospace'; g.fillText(`+ ${d.items.length - n} more possible words`, lab, top + 14 + n * rh + 12); }
      // legend
      const lx = narrow ? 4 : w - 210;
      g.textAlign = 'left'; g.fillStyle = C.borderStrong; g.fillRect(lx, top - 9, 12, 8); g.fillStyle = C.muted; g.fillText('raw', lx + 16, top);
      g.fillStyle = C.c1; g.fillRect(lx + 52, top - 8, 12, 5); g.fillStyle = C.muted; g.fillText('after sliders', lx + 68, top);
    }
    function refresh() { cur = dist(context()); if (ctxInfo) ctxInfo(); draw(); }
    cv.onResize(draw);
    ctx.loop((t, dt) => { if (flash > 0) flash = Math.max(0, flash - dt * 1.5); draw(); });

    // Panel
    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">How an LLM writes</h2>'), ctx.h('<p class="lede">An LLM writes one token at a time. Each step it scores every possible next token, picks one, adds it to the text, and repeats. That loop is the whole act of writing.</p>'));
    const inp = ctx.h(`<div class="card"><label class="hint" for="nt-p">Prompt</label><input id="nt-p" class="txt" value="${ctx.esc(prompt)}" autocomplete="off"><div class="row pre"></div><p class="hint ci"></p></div>`);
    const input = inp.querySelector('input');
    input.addEventListener('input', () => { prompt = input.value; ctx.store.set('nt:prompt', prompt); gen = []; last = null; refresh(); }, { signal: ctx.signal });
    for (const pr of ['the cat', 'once upon a time', 'the dog ran', 'the capital of mars is']) {
      const b = ctx.h(`<button class="chip">${pr}</button>`); b.onclick = () => { stopAuto(); prompt = pr; input.value = pr; gen = []; last = null; refresh(); }; inp.querySelector('.pre').append(b);
    }
    ctxInfo = () => { inp.querySelector('.ci').textContent = `${words.length} words of training text. ${gen.length} tokens generated.`; };
    P.append(inp,
      ctx.slider({ label: 'Temperature', min: 0, max: 2, step: 0.05, value: temp, fmt: (v) => (v < 0.01 ? '0 (greedy)' : v.toFixed(2)), onInput: (v) => { temp = v; refresh(); } }),
      ctx.slider({ label: 'Top-k', min: 0, max: 10, step: 1, value: 0, fmt: (v) => (v === 0 ? 'off' : `${v}`), onInput: (v) => { topk = v; refresh(); } }),
      ctx.slider({ label: 'Top-p (nucleus)', min: 0.05, max: 1, step: 0.05, value: 1, fmt: (v) => (v >= 1 ? 'off' : v.toFixed(2)), onInput: (v) => { topp = v; refresh(); } }),
    );
    P.append(
      ctx.h(`<div class="card tip"><p>The model here is a trigram model: it counted, in the training text, which word came after each pair of words. Given "the cat", it has a list of what followed and how often. To write, it turns those counts into probabilities, rolls a weighted die, and appends the winner. A real LLM runs exactly the same loop. The only difference is where the probabilities come from: a giant transformer that has read trillions of tokens and looks at the whole context, not just the last two words.</p></div>`),
      ctx.h(`<div class="card try"><ol>
        <li>Press <b>Next token</b> a few times and watch the bars change with each new word.</li>
        <li>Drag <b>Temperature</b> to 0: it always picks the top word and quickly loops. Push it to 2: the bars flatten and the text gets strange.</li>
        <li>Set <b>Top-k</b> to 2 or <b>Top-p</b> to 0.5: unlikely words are cut before the dice roll.</li>
        <li>Try <b>the capital of mars is</b>. It has never seen this, but it still answers fluently (maybe "paris"). That is a hallucination in miniature.</li>
      </ol></div>`),
      ctx.h(`<div class="card deep">
        <div class="formula">p_i = exp(z_i / T) / Σ_j exp(z_j / T)<span>z are the scores (logits); T is temperature. T below 1 sharpens, above 1 flattens.</span></div>
        <p><b>Top-k</b> keeps only the k most likely tokens. <b>Top-p</b> keeps the smallest set whose probabilities add up to p. Both then renormalise. Real chat products tune these settings; greedy decoding (temperature 0) is more repetitive but more predictable.</p>
        <p><b>Why models make things up:</b> the loop always produces some next token, and its job in pretraining was to produce plausible text, not to check facts. When the model has no solid pattern for a question, the most plausible-sounding continuation can be confidently wrong. Training to say "I don't know", retrieval (see the RAG chapter) and tools reduce this, but do not remove it.</p>
        <p><b>Where this toy differs:</b> an n-gram model only sees the last couple of words and can only produce word sequences it has seen in pieces. A transformer sees the whole context window and generalises to sentences it has never seen. It also works on tokens, not whole words.</p>
      </div>`),
    );
    refresh();

    ctx.quiz([
      { q: 'What does an LLM actually produce at each step?', choices: ['A whole answer at once', 'A probability for every possible next token, then one is picked', 'A search result', 'A list of facts'], answer: 1, why: 'Generation is the loop: probabilities, pick one, append, repeat.' },
      { q: 'What happens when you lower the temperature towards 0?', choices: ['Output becomes more random', 'The most likely token is chosen almost every time', 'The model gets more knowledge', 'Top-k turns off'], answer: 1, why: 'Low temperature sharpens the distribution until it becomes greedy.' },
      { q: 'Why can an LLM state false things confidently?', choices: ['It is lying on purpose', 'It always produces a plausible next token, even when it has no reliable pattern to draw on', 'It reads a broken database', 'Temperature is always too high'], answer: 1, why: 'Fluent guessing: the loop never stops to check facts by itself.' },
    ]);
    return () => stopAuto();
  },
};
