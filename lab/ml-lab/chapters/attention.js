// Attention: each token scores every other token, softmax turns scores into weights, and the output is a weighted mix of values.

const FONT = '500 11px "DM Mono", monospace';
const softmax = (row) => { const m = Math.max(...row.filter((x) => x > -Infinity)); const e = row.map((x) => (x === -Infinity ? 0 : Math.exp(x - m))); const s = e.reduce((a, b) => a + b, 0); return e.map((x) => x / s); };
const matmul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));
const T = (A) => A[0].map((_, j) => A.map((r) => r[j]));

export default {
  mount(ctx) {
    const C = ctx.colors;
    let ending = 'tired'; let causal = false; let head = 'coref'; let sel = 7; let view = 'weights'; let step = 0;
    const words = () => ['The', 'animal', "didn't", 'cross', 'the', 'street', 'because', 'it', 'was', 'too', ending, '.'];
    const TYPE = ['det', 'noun', 'verb', 'verb', 'det', 'noun', 'other', 'noun', 'verb', 'other', 'adj', 'punct'];
    const HEADS = {
      prev: { name: 'Previous word', col: C.c5, about: 'Looks one step back. Heads like this help a model track word order and short phrases ("the street").' },
      coref: { name: 'Who is "it"?', col: C.c1, about: 'Links a pronoun to what it refers to. Switch the last word between tired and wide and watch the link move.' },
      type: { name: 'Same kind', col: C.c3, about: 'Nouns look at nouns, verbs at verbs. A loose stand in for heads that group words by grammatical role.' },
      broad: { name: 'Broad', col: C.c2, about: 'Spreads attention widely, with extra weight on the first token. Real models often park spare attention on the first token like this.' },
    };
    function scores(h) {
      const n = 12; const ref = ending === 'tired' ? 1 : 5; const other = ref === 1 ? 5 : 1;
      const S = [];
      for (let i = 0; i < n; i++) {
        const row = [];
        for (let j = 0; j < n; j++) {
          let s = 0;
          if (h === 'prev') s = j === i - 1 ? 4 : (j === i ? (i === 0 ? 3 : 0.8) : 0);
          if (h === 'type') s = j === i ? 1 : (TYPE[i] === TYPE[j] ? 2.6 : 0);
          if (h === 'broad') s = (j === 0 ? 1.6 : 0) + (TYPE[j] === 'noun' || TYPE[j] === 'verb' ? 0.5 : 0);
          if (h === 'coref') {
            s = j === i ? 2.2 : 0;
            if (i === 7) { s = j === i ? 0.8 : 0; if (causal) { if (j === 1) s = 2.6; if (j === 5) s = 2.4; } else { if (j === ref) s = 4.2; if (j === other) s = 1.4; } }
            if (i === 10) { s = j === i ? 0.6 : 0; if (j === ref) s = 3.6; if (j === 7) s = 2.6; }
          }
          if (causal && j > i) s = -Infinity;
          row.push(s);
        }
        S.push(row);
      }
      return S;
    }
    const weights = () => scores(head).map(softmax);

    // Numeric example for the Math view
    const MW = ['animal', 'street', 'it', 'tired'];
    const X = [[1, 0, 1, 0], [0, 1, 1, 0], [0, 0, 0.5, 1], [0.5, 0, 0, 0.8]];
    const Wq = [[0, 0], [0, 0], [0, 0], [2, 1]];
    const Wk = [[1, 0], [0, 0], [0, 1], [0, 0]];
    const Wv = [[1, 0], [0, 1], [0, 0], [0, 0]];
    const Q = matmul(X, Wq); const K = matmul(X, Wk); const V = matmul(X, Wv);
    const S = matmul(Q, T(K)); const Sd = S.map((r) => r.map((x) => x / Math.SQRT2)); const A = Sd.map(softmax); const O = matmul(A, V);
    const feat = ['animate', 'place', 'noun', 'pronoun'];
    const STEPS = [
      { t: 'Start: one vector per token', eq: [['X', X, MW, feat]], note: 'Each row is a token’s embedding. Here 4 numbers with readable meanings: animate, place, noun, pronoun-ness.' },
      { t: 'Queries: what is each token looking for?', eq: [['X', X, MW, feat], ['W_Q', Wq, feat, ['q1', 'q2']], ['Q', Q, MW, ['q1', 'q2']]], note: 'Q = X W_Q. Only "it" and "tired" ask a question here: roughly "is there an animate noun around?"' },
      { t: 'Keys: what does each token offer?', eq: [['X', X, MW, feat], ['W_K', Wk, feat, ['k1', 'k2']], ['K', K, MW, ['k1', 'k2']]], note: 'K = X W_K. "animal" advertises both animate and noun.' },
      { t: 'Values: what each token passes on', eq: [['X', X, MW, feat], ['W_V', Wv, feat, ['v1', 'v2']], ['V', V, MW, ['v1', 'v2']]], note: 'V = X W_V. The information that actually gets copied if someone attends to you.' },
      { t: 'Scores: every query dot every key', eq: [['Q', Q, MW, ['q1', 'q2']], ['Kᵀ', T(K), ['k1', 'k2'], MW], ['S', S, MW, MW]], note: 'S = Q Kᵀ. Row "it", column "animal": 2×1 + 1×1 = 3, the biggest score in that row.', hi: 2 },
      { t: 'Scale by √d', eq: [['S', S, MW, MW], ['S / √2', Sd, MW, MW]], note: 'Divide by √d_k (here √2). With long vectors, dot products get large and softmax would become too sharp; scaling keeps it smooth.', hi: 2 },
      { t: 'Softmax each row', eq: [['S / √2', Sd, MW, MW], ['A = softmax', A, MW, MW]], note: 'Each row becomes positive weights that sum to 1. "it" puts about 0.60 on "animal". Rows with no question (all zero) spread evenly.', hi: 2 },
      { t: 'Mix the values', eq: [['A', A, MW, MW], ['V', V, MW, ['v1', 'v2']], ['A V', O, MW, ['v1', 'v2']]], note: 'Output = A V. The new vector for "it" is mostly animal’s value: "it" now carries "animate" information. That is the whole trick.', hi: 2 },
    ];

    const cv = ctx.canvas(); const g = cv.ctx;
    const dock = ctx.h('<div class="dock"><div class="grp glass"><span>Show</span></div><div class="grp glass hd"><span>Head</span></div></div>');
    ctx.stage.append(dock);
    const vseg = ctx.seg([['weights', 'Weights'], ['math', 'Math']], view, (v) => { view = v; dock.querySelector('.hd').style.display = v === 'math' ? 'none' : ''; mathBox.hidden = v !== 'math'; draw(); });
    vseg.style.border = '0'; dock.firstChild.append(vseg);
    const hseg = ctx.seg(Object.entries(HEADS).map(([k, v]) => [k, v.name]), head, (v) => { head = v; headNote(); draw(); });
    hseg.style.border = '0'; dock.querySelector('.hd').append(hseg);

    let hit = [];
    function draw() {
      const w = cv.w; const h = cv.h; if (!w) return;
      g.clearRect(0, 0, w, h); hit = [];
      if (view === 'math') return drawMath(w, h);
      const Wt = weights(); const ws = words(); const col = HEADS[head].col;
      const wide = w >= 640; const bottom = h - 52;
      const la = wide ? { x: 0, y: 6, w: w * 0.46, h: bottom - 6 } : { x: 0, y: 4, w, h: (bottom - 4) * 0.5 };
      const ha = wide ? { x: w * 0.5, y: 6, w: w * 0.5, h: bottom - 6 } : { x: 0, y: la.y + la.h + 6, w, h: bottom - la.h - 10 };
      // lines view
      const rh = Math.min(30, (la.h - 20) / 12); const top = la.y + 18 + (la.h - 20 - rh * 12) / 2;
      const xl = la.x + Math.min(96, la.w * 0.3); const xr = la.x + la.w - Math.min(96, la.w * 0.3);
      g.font = FONT; g.fillStyle = C.muted; g.textAlign = 'left'; g.fillText('query', la.x + 2, top - 8); g.fillText('keys', xr, top - 8);
      for (let j = 0; j < 12; j++) {
        const wt = Wt[sel][j]; if (wt < 0.005) continue;
        g.strokeStyle = col; g.globalAlpha = Math.min(1, 0.15 + wt * 1.2); g.lineWidth = 0.5 + wt * 9;
        g.beginPath(); g.moveTo(xl + 6, top + sel * rh + rh / 2); g.bezierCurveTo((xl + xr) / 2, top + sel * rh + rh / 2, (xl + xr) / 2, top + j * rh + rh / 2, xr - 6, top + j * rh + rh / 2); g.stroke();
      }
      g.globalAlpha = 1;
      const fs = Math.max(10, Math.min(13, rh * 0.5));
      for (let i = 0; i < 12; i++) {
        const y = top + i * rh + rh / 2 + 4;
        g.font = `500 ${fs}px "DM Mono", monospace`; g.textAlign = 'right';
        g.fillStyle = i === sel ? C.text : C.muted;
        if (i === sel) { const tw = g.measureText(ws[i]).width; g.fillStyle = col; g.globalAlpha = 0.2; g.fillRect(xl - tw - 6, y - fs, tw + 10, fs + 6); g.globalAlpha = 1; g.fillStyle = C.text; }
        g.fillText(ws[i], xl, y); hit.push({ x: xl - 90, y: y - rh / 2 - 4, w: 96, h: rh, i });
        g.textAlign = 'left'; const wt = Wt[sel][i];
        g.fillStyle = wt > 0.15 ? C.text : (causal && i > sel ? C.subtle : C.muted); g.fillText(ws[i], xr, y);
        if (wt >= 0.01) { g.fillStyle = col; g.font = '500 10px "DM Mono", monospace'; g.fillText(wt.toFixed(2), xr + g.measureText(ws[i]).width + 22, y); }
      }
      // heatmap
      const lab = Math.min(64, ha.w * 0.2); const cell = Math.min((ha.w - lab - 8) / 12, (ha.h - lab - 6) / 12);
      const hx = ha.x + lab + (ha.w - lab - cell * 12) / 2; const hy = ha.y + lab;
      g.font = '500 10px "DM Mono", monospace';
      for (let i = 0; i < 12; i++) {
        g.textAlign = 'right'; g.fillStyle = i === sel ? C.text : C.muted; g.fillText(ws[i].slice(0, 7), hx - 5, hy + i * cell + cell / 2 + 3);
        g.save(); g.translate(hx + i * cell + cell / 2 + 3, hy - 5); g.rotate(-Math.PI / 3); g.textAlign = 'left'; g.fillStyle = C.muted; g.fillText(ws[i].slice(0, 7), 0, 0); g.restore();
        for (let j = 0; j < 12; j++) {
          const wt = Wt[i][j];
          g.fillStyle = col; g.globalAlpha = Math.pow(wt, 0.7); g.fillRect(hx + j * cell + 0.5, hy + i * cell + 0.5, cell - 1, cell - 1); g.globalAlpha = 1;
          if (causal && j > i) { g.fillStyle = '#1a1a1a'; g.fillRect(hx + j * cell + 0.5, hy + i * cell + 0.5, cell - 1, cell - 1); }
        }
        hit.push({ x: hx - lab, y: hy + i * cell, w: lab + cell * 12, h: cell, i });
      }
      g.strokeStyle = C.text; g.lineWidth = 1.5; g.strokeRect(hx, hy + sel * cell, cell * 12, cell);
      g.textAlign = 'left';
    }

    function drawMat(x, y, M, rl, cl, title, cs, hiRow) {
      g.font = '600 13px Rajdhani, sans-serif'; g.fillStyle = C.text; g.textAlign = 'left'; g.fillText(title, x, y - 22);
      const max = Math.max(...M.flat().map(Math.abs), 1e-9);
      g.font = `500 ${Math.min(11, cs * 0.3)}px "DM Mono", monospace`;
      cl.forEach((c, j) => { g.fillStyle = C.muted; g.textAlign = 'center'; g.fillText(c.slice(0, 7), x + j * cs + cs / 2, y - 6); });
      M.forEach((r, i) => r.forEach((v, j) => {
        g.fillStyle = v >= 0 ? C.c1 : C.c4; g.globalAlpha = 0.08 + 0.5 * Math.abs(v) / max; g.fillRect(x + j * cs + 1, y + i * cs * 0.62 + 1, cs - 2, cs * 0.62 - 2); g.globalAlpha = 1;
        if (hiRow === i) { g.strokeStyle = C.c2; g.lineWidth = 1.2; g.strokeRect(x + 0.5, y + i * cs * 0.62 + 0.5, cs * r.length - 1, cs * 0.62 - 1); }
        g.fillStyle = C.text; g.textAlign = 'center'; g.font = `500 ${Math.min(12, cs * 0.3)}px "DM Mono", monospace`;
        g.fillText((Math.round(v * 100) / 100).toString().replace(/^0\./, '.').replace(/^-0\./, '-.'), x + j * cs + cs / 2, y + i * cs * 0.62 + cs * 0.31 + 4);
      }));
      return { w: cs * M[0].length, h: cs * 0.62 * M.length };
    }
    function wrap(text, x, y, mw) {
      g.font = '400 15px Lora, Georgia, serif'; g.fillStyle = C.text2; g.textAlign = 'left';
      let line = '';
      for (const word of text.split(' ')) { const t = line ? `${line} ${word}` : word; if (g.measureText(t).width > mw && line) { g.fillText(line, x, y); y += 22; line = word; } else line = t; }
      if (line) g.fillText(line, x, y);
    }
    function drawMath(w, h) {
      const st = STEPS[step]; const eq = st.eq; const bottom = h - 52;
      g.font = `700 ${w < 500 ? 15 : 18}px Rajdhani, sans-serif`; g.fillStyle = C.text; g.textAlign = 'left';
      g.fillText(`Step ${step + 1} of ${STEPS.length}: ${st.t}`, 4, 20);
      const rowLab = 52; const gap = 34;
      const cols = eq.reduce((s, m) => s + m[1][0].length, 0);
      const wideFit = (w - 8 - rowLab * eq.length - gap * (eq.length - 1)) / cols;
      const hasRowLab = () => true;
      const mlabel = (m, lx, y, cs) => { g.font = FONT; g.textAlign = 'right'; m[1].forEach((_, i) => { g.fillStyle = st.hi === i && m[2] === MW ? C.c2 : C.muted; g.fillText(m[2][i], lx - 6, y + i * cs * 0.62 + cs * 0.31 + 4); }); };
      if (wideFit >= 40 || w >= 620) {
        const cs = Math.min(64, Math.max(28, wideFit));
        let x = 4; const y = 80; let maxH = 0;
        eq.forEach((m, k) => {
          const lx = x + rowLab; mlabel(m, lx, y, cs);
          const d = drawMat(lx, y, m[1], m[2], m[3], m[0], cs, m[2] === MW ? st.hi : undefined);
          x = lx + d.w + gap; maxH = Math.max(maxH, d.h);
          if (k < eq.length - 1) { g.font = '500 16px "DM Mono", monospace'; g.fillStyle = C.muted; g.textAlign = 'center'; g.fillText(k === eq.length - 2 ? '=' : '\u00d7', x - gap / 2, y + d.h / 2 + 5); }
        });
        wrap(st.note, 4, y + maxH + 44, Math.min(w - 8, 620));
      } else {
        // narrow: operands on the first line, result on the second
        const lines = eq.length === 3 ? [[0, 1], [2]] : eq.length === 2 ? [[0], [1]] : [[0]];
        const lw = (ln) => ln.reduce((s, k) => s + eq[k][1][0].length, 0);
        const csW = Math.min(...lines.map((ln) => (w - 8 - rowLab * ln.length - 10 * (ln.length - 1)) / lw(ln)));
        const csH = (bottom - 40 - lines.length * 40) / (lines.length * 4 * 0.62);
        const cs = Math.max(22, Math.min(46, csW, csH)); let y = 64;
        lines.forEach((ln, li) => {
          let x = 4; let mh = 0;
          ln.forEach((k) => {
            const m = eq[k]; const lx = x + rowLab; mlabel(m, lx, y, cs);
            const pre = li > 0 ? '= ' : k > 0 ? '\u00d7 ' : '';
            const d = drawMat(lx, y, m[1], m[2], m[3], pre + m[0], cs, m[2] === MW ? st.hi : undefined);
            x = lx + d.w + 10; mh = Math.max(mh, d.h);
          });
          y += mh + 40;
        });
      }
      g.textAlign = 'left';
    }
    cv.onResize(draw);
    cv.el.addEventListener('pointerdown', (e) => {
      if (view !== 'weights') return;
      const r = cv.el.getBoundingClientRect(); const x = e.clientX - r.left; const y = e.clientY - r.top;
      const hh = hit.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      if (hh) { sel = hh.i; draw(); }
    }, { signal: ctx.signal });
    cv.el.style.cursor = 'pointer';

    // Panel
    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">Attention</h2>'), ctx.h('<p class="lede">To understand a word you need the words around it. Attention is how each token decides which other tokens to pull information from.</p>'));
    const ctl = ctx.h('<div class="card"><div class="row"><span class="hint">Last word:</span></div><label class="check"><input type="checkbox"> Causal mask (GPT style: only look backwards)</label><p class="small hn"></p><p class="hint">Click a word in the left column or a heatmap row.</p></div>');
    ctl.querySelector('.row').append(ctx.seg([['tired', 'tired'], ['wide', 'wide']], ending, (v) => { ending = v; draw(); }));
    ctl.querySelector('input').addEventListener('change', (e) => { causal = e.target.checked; draw(); }, { signal: ctx.signal });
    const headNote = () => { ctl.querySelector('.hn').innerHTML = `<b style="color:${HEADS[head].col}">${HEADS[head].name}:</b> ${HEADS[head].about}`; };
    headNote(); P.append(ctl);
    const mathBox = ctx.h('<div class="card" hidden><div class="row"><button class="btn ghost sm" data-d="-1">‹ Back</button><button class="btn sm" data-d="1">Next step ›</button></div><p class="small mn"></p><div class="formula">Attention(Q, K, V) = softmax(Q Kᵀ / √d) V</div></div>');
    const setStep = (s) => { step = Math.max(0, Math.min(STEPS.length - 1, s)); mathBox.querySelector('.mn').textContent = STEPS[step].note; draw(); };
    mathBox.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setStep(step + +b.dataset.d)));
    setStep(0); P.append(mathBox);
    P.append(
      ctx.h(`<div class="card tip"><p>Every token makes three vectors from its embedding: a <b>query</b> ("what am I looking for?"), a <b>key</b> ("what do I contain?") and a <b>value</b> ("what I pass on"). Each query is compared with every key using a dot product. Softmax turns those scores into weights that add up to 1. The token's new vector is the weighted average of the values. So "it" can soak up meaning from "animal".</p></div>`),
      ctx.h(`<div class="card try"><ol>
        <li>With head <b>Who is "it"?</b> click <b>it</b>. Most weight goes to animal.</li>
        <li>Switch the last word to <b>wide</b>. Now it links to street, because streets are wide and animals get tired.</li>
        <li>Tick <b>Causal mask</b>. "it" can no longer see the last word, so it hedges between both nouns. Click the last word instead: it does the resolving.</li>
        <li>Press <b>Math</b> in the dock and step through the real matrix calculation.</li>
      </ol></div>`),
      ctx.h(`<div class="card deep">
        <p><b>Honest label:</b> the weight patterns in Weights view are hand-designed to show typical behaviours that researchers have found in trained models (previous-token heads, heads that track references, heads that dump weight on the first token). Real heads are messier and often do several things at once. The Math view numbers are real: every matrix is computed in your browser from the inputs shown.</p>
        <p><b>Multi-head:</b> a layer runs several heads in parallel, each with its own W_Q, W_K, W_V, so each can look for a different relationship. Their outputs are joined and mixed by one more matrix. A model has many layers, each with many heads.</p>
        <p><b>Causal mask:</b> chat models generate left to right, so during training each position is blocked from seeing the future (scores set to minus infinity before softmax). Encoder models like BERT see both directions.</p>
        <p><b>Cost:</b> every token scores every other token, so the work grows with the square of the context length. That is a major reason long contexts are expensive.</p>
      </div>`),
    );
    draw();
    document.fonts && document.fonts.ready.then(() => { if (!ctx.signal.aborted) draw(); });

    ctx.quiz([
      { q: 'In attention, what does softmax do to a row of scores?', choices: ['Sorts the words', 'Turns them into positive weights that add up to 1', 'Removes the largest score', 'Multiplies them by the values'], answer: 1, why: 'Softmax exponentiates and normalises, so each row is a set of mixing weights.' },
      { q: 'Why divide the scores by √d?', choices: ['To make them integers', 'To keep the softmax from becoming too sharp when vectors are long', 'To hide future tokens', 'It is required for tokenisation'], answer: 1, why: 'Dot products of long vectors grow large; scaling keeps gradients and weights well behaved.' },
      { q: 'What is the output of attention for one token?', choices: ['The single most similar word', 'A weighted average of the value vectors of the tokens it attends to', 'Its key vector', 'The next token'], answer: 1, why: 'Output = weights × values, a blend of information from the attended tokens.' },
    ]);
  },
};
