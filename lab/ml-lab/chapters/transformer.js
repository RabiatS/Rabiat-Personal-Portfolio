// The transformer: a real (tiny, untrained) transformer forward pass, drawn as an animated block diagram.

const FONT = '500 11px "DM Mono", monospace';
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const randn = (r) => { const u = Math.max(1e-9, r()); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
const mat = (r, a, b, sc) => Array.from({ length: a }, () => Array.from({ length: b }, () => randn(r) * sc));
const mm = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((s, x, k) => s + x * B[k][j], 0)));
const add = (A, B) => A.map((r, i) => r.map((x, j) => x + B[i][j]));
const lnorm = (A) => A.map((r) => { const m = r.reduce((a, b) => a + b, 0) / r.length; const v = r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length; return r.map((x) => (x - m) / Math.sqrt(v + 1e-5)); });
const gelu = (x) => 0.5 * x * (1 + Math.tanh(0.7978845608 * (x + 0.044715 * x ** 3)));
const softmax = (row) => { const m = Math.max(...row); const e = row.map((x) => Math.exp(x - m)); const s = e.reduce((a, b) => a + b, 0); return e.map((x) => x / s); };

const VOC = ['the', 'cat', 'sat', 'on', 'mat', 'dog', 'ran', 'to', 'a', 'park', '.', 'and'];
const D = 8; const HID = 32;

function build() {
  const r = rng(11);
  const E = mat(r, VOC.length, D, 1);
  const layers = Array.from({ length: 8 }, () => ({ Wq: mat(r, D, D, 0.5), Wk: mat(r, D, D, 0.5), Wv: mat(r, D, D, 0.4), Wo: mat(r, D, D, 0.4), W1: mat(r, D, HID, 0.35), W2: mat(r, HID, D, 0.2) }));
  return { E, layers };
}

function forward(M, ids, N) {
  const T = ids.length; const out = {};
  out.tokens = ids.map((id) => [id]);
  const pos = ids.map((_, p) => Array.from({ length: D }, (_, i) => (i % 2 ? Math.cos : Math.sin)(p / 10000 ** ((i - (i % 2)) / D))));
  let x = add(ids.map((id) => M.E[id].slice()), pos); out.embed = x;
  for (let l = 0; l < N; l++) {
    const L = M.layers[l];
    const Q = mm(x, L.Wq); const K = mm(x, L.Wk); const V = mm(x, L.Wv);
    const A = Q.map((q, i) => softmax(K.map((k, j) => (j > i ? -1e9 : q.reduce((s, v, d) => s + v * k[d], 0) / Math.sqrt(D)))));
    const att = mm(mm(A, V), L.Wo);
    if (l === N - 1) { out.attn = att; out.attnW = A; }
    x = lnorm(add(x, att)); if (l === N - 1) out.add1 = x;
    const h = mm(x, L.W1).map((r) => r.map(gelu)); const f = mm(h, L.W2);
    if (l === N - 1) out.mlp = f;
    x = lnorm(add(x, f)); if (l === N - 1) out.add2 = x;
  }
  const logits = M.E.map((e) => e.reduce((s, v, d) => s + v * x[T - 1][d], 0));
  out.unembed = [logits]; out.softmax = softmax(logits);
  return out;
}

export default {
  mount(ctx) {
    const C = ctx.colors; const M = build();
    const PROMPTS = { cat: [0, 1, 2, 3], dog: [0, 5, 6, 7] };
    let prompt = 'cat'; let N = ctx.store.get('tf:N', 2); let sel = 'attn'; let out = forward(M, PROMPTS[prompt], N);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const PARTS = [
      { id: 'tokens', name: 'Input tokens', col: C.muted, shape: (o) => `${o.tokens.length} token ids`, text: 'The text has already been split into tokens. Each is just an integer id from the vocabulary. Nothing about meaning is in the number itself.' },
      { id: 'embed', name: 'Embedding + position', col: C.c5, shape: () => `${out.embed.length} tokens × ${D} numbers`, text: 'Each id picks one row of a learned embedding table, giving every token a vector. Position information is added so the model knows word order (here classic sine and cosine waves; many recent models instead rotate queries and keys by position, called RoPE). This running list of vectors is called the residual stream.' },
      { id: 'attn', name: 'Masked self-attention', col: C.c1, block: true, shape: () => `${D} in, ${D} out per token, plus a ${out.tokens.length}×${out.tokens.length} weight grid`, text: 'Each token builds a query, key and value, scores every earlier token, and pulls in a weighted mix of their values. This is the only step where tokens exchange information. The mask stops a token from seeing tokens after it, because the model is trained to predict what comes next.' },
      { id: 'add1', name: 'Add & norm', col: C.c3, block: true, shape: () => `${out.tokens.length} tokens × ${D} numbers`, text: 'Add: the attention output is added on top of the input (x + attention(x)) instead of replacing it. These residual connections let information and training signals pass through very deep stacks. Norm: each vector is rescaled to mean 0 and spread 1, which keeps numbers stable layer after layer.' },
      { id: 'mlp', name: 'MLP (feed-forward)', col: C.c2, block: true, shape: () => `${D} → ${HID} → ${D} per token`, text: 'A small two layer neural network applied to every token on its own: widen (here 8 to 32, typically about 4 times wider), apply a nonlinearity (GELU), shrink back. Most of a model’s parameters sit in these layers, and research suggests much of what a model "knows" is stored here.' },
      { id: 'add2', name: 'Add & norm', col: C.c3, block: true, shape: () => `${out.tokens.length} tokens × ${D} numbers`, text: 'Same as before: add the MLP output to the stream, then normalise. The block takes in a list of vectors and gives back a list of the same shape, which is why blocks can be stacked again and again.' },
      { id: 'unembed', name: 'Unembedding', col: C.c4, shape: () => `last token's ${D} numbers → ${VOC.length} scores`, text: 'Only the final vector of the last token is used to predict what comes next. It is multiplied by a matrix with one row per vocabulary token, giving one score (a logit) for each possible next token. Here that matrix reuses the embedding table, a common trick called weight tying.' },
      { id: 'softmax', name: 'Next-token probabilities', col: C.c6, shape: () => `${VOC.length} probabilities that sum to 1`, text: 'Softmax turns scores into probabilities. One token is picked (see the next chapter), added to the input, and the whole stack runs again for the token after that.' },
    ];

    const cv = ctx.canvas(); const g = cv.ctx;
    let boxes = []; let phase = 0; let layerShown = 0;

    function heat(x, y, w, h, A, title) {
      const rows = A.length; const cols = A[0].length;
      const lab = 34; const cs = Math.min(26, (w - lab) / cols, (h - 30) / rows);
      const max = Math.max(...A.flat().map(Math.abs), 1e-9);
      g.font = FONT; g.fillStyle = C.muted; g.textAlign = 'left'; g.fillText(title, x, y + 10);
      const y0 = y + 20;
      for (let i = 0; i < rows; i++) {
        if (rows === out.tokens.length) { g.fillStyle = C.muted; g.textAlign = 'right'; g.fillText(VOC[PROMPTS[prompt][i]], x + lab - 4, y0 + i * cs + cs / 2 + 4); }
        for (let j = 0; j < cols; j++) {
          const v = A[i][j] / max; g.fillStyle = v >= 0 ? C.c1 : C.c4; g.globalAlpha = 0.1 + 0.85 * Math.abs(v);
          g.fillRect(x + lab + j * cs + 0.5, y0 + i * cs + 0.5, cs - 1, cs - 1); g.globalAlpha = 1;
        }
      }
      g.textAlign = 'left';
      return y0 + rows * cs;
    }

    function detail(x, y, w, h) {
      const p = PARTS.find((q) => q.id === sel);
      g.font = '700 16px Rajdhani, sans-serif'; g.fillStyle = p.col === C.muted ? C.text : p.col; g.textAlign = 'left'; g.fillText(p.name.toUpperCase(), x, y + 14);
      g.font = FONT; g.fillStyle = C.muted;
      let ly = y + 32; let line = '';
      for (const wd of p.shape(out).split(' ')) { const t2 = line ? `${line} ${wd}` : wd; if (g.measureText(t2).width > w && line) { g.fillText(line, x, ly); ly += 14; line = wd; } else line = t2; }
      g.fillText(line, x, ly);
      const yy = ly + 12; const hh = h - (yy - y);
      if (sel === 'tokens') {
        PROMPTS[prompt].forEach((id, i) => { const ty = yy + 10 + i * 30; g.fillStyle = C.surface2; g.fillRect(x, ty, Math.min(w, 160), 24); g.fillStyle = C.text; g.font = '500 13px "DM Mono", monospace'; g.fillText(VOC[id], x + 8, ty + 16); g.fillStyle = C.c2; g.fillText(`id ${id}`, x + 80, ty + 16); });
      } else if (sel === 'softmax' || sel === 'unembed') {
        const vals = sel === 'softmax' ? out.softmax : out.unembed[0];
        const order = VOC.map((_, i) => i).sort((a, b) => vals[b] - vals[a]);
        const rh = Math.min(22, (hh - 20) / VOC.length); const mx = Math.max(...vals.map(Math.abs));
        order.forEach((k, i) => {
          const by = yy + 6 + i * rh; g.font = FONT; g.fillStyle = C.text; g.textAlign = 'right'; g.fillText(VOC[k], x + 44, by + rh * 0.7); g.textAlign = 'left';
          const bw = (w - 100) * Math.abs(vals[k]) / mx; g.fillStyle = sel === 'softmax' ? C.c6 : (vals[k] >= 0 ? C.c1 : C.c4); g.globalAlpha = 0.85; g.fillRect(x + 50, by + 2, Math.max(1, bw), rh - 5); g.globalAlpha = 1;
          g.fillStyle = C.muted; g.fillText(sel === 'softmax' ? `${(vals[k] * 100).toFixed(1)}%` : vals[k].toFixed(2), x + 54 + bw, by + rh * 0.7);
        });
      } else if (sel === 'attn') {
        const e = heat(x, yy, w, hh * 0.5, out.attn, 'output (last layer)');
        heat(x, e + 10, w, hh * 0.5, out.attnW, 'weights (rows sum to 1)');
      } else {
        heat(x, yy, w, hh, out[sel], `stream values${PARTS.find((q) => q.id === sel).block ? ' (last layer)' : ''}`);
      }
    }

    function draw(t = 0) {
      const w = cv.w; const h = cv.h; if (!w) return;
      g.clearRect(0, 0, w, h);
      const wide = w >= 620;
      const dw = wide ? Math.min(360, w * 0.48) : w * 0.56; const top = 6; const bottom = h - 8;
      const gapY = 8; const bh = Math.min(48, (bottom - top - gapY * 9) / 8);
      const bx = 48; const bwid = dw - bx - 8;
      boxes = PARTS.map((p, i) => ({ p, x: bx, y: top + i * (bh + gapY) + (i >= 2 ? gapY : 0) + (i >= 6 ? gapY : 0), w: bwid, h: bh }));
      // residual stream line
      const b2 = boxes[2]; const b5 = boxes[5];
      g.strokeStyle = C.borderStrong; g.lineWidth = 2; g.beginPath(); g.moveTo(bx - 16, boxes[1].y + bh); g.lineTo(bx - 16, boxes[6].y); g.stroke();
      for (const [a, b] of [[2, 3], [4, 5]]) { const ya = boxes[a].y - gapY / 2; const yb = boxes[b].y + bh / 2; g.strokeStyle = C.c3; g.globalAlpha = 0.6; g.beginPath(); g.moveTo(bx - 16, ya); g.lineTo(bx - 16, yb); g.lineTo(bx, yb); g.stroke(); g.globalAlpha = 1; }
      // block bracket
      g.strokeStyle = C.subtle; g.setLineDash([4, 4]); g.lineWidth = 1; g.strokeRect(bx - 26, b2.y - 6, bwid + 30, b5.y + bh - b2.y + 12); g.setLineDash([]);
      g.save(); g.translate(bx - 32, (b2.y + b5.y + bh) / 2); g.rotate(-Math.PI / 2); g.font = FONT; g.fillStyle = C.muted; g.textAlign = 'center'; g.fillText(`block × ${N}  (layer ${layerShown + 1})`, 0, 0); g.restore();
      // connectors
      g.strokeStyle = C.border; g.lineWidth = 1.5;
      for (let i = 0; i < boxes.length - 1; i++) { const a = boxes[i]; const b = boxes[i + 1]; g.beginPath(); g.moveTo(a.x + a.w / 2, a.y + a.h); g.lineTo(b.x + b.w / 2, b.y); g.stroke(); }
      // boxes
      for (const b of boxes) {
        const on = b.p.id === sel;
        g.fillStyle = on ? 'rgba(245,245,240,.08)' : 'rgba(20,20,20,.9)'; g.strokeStyle = on ? C.text : b.p.col; g.globalAlpha = on ? 1 : 0.75; g.lineWidth = on ? 1.6 : 1;
        g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 8); g.fill(); g.stroke(); g.globalAlpha = 1;
        g.fillStyle = b.p.col === C.muted ? C.text : b.p.col; g.fillRect(b.x + 8, b.y + b.h / 2 - 4, 8, 8);
        g.font = `600 ${b.w < 200 ? 13 : 15}px Rajdhani, sans-serif`; g.fillStyle = C.text; g.textAlign = 'left'; g.fillText(b.p.name.toUpperCase(), b.x + 24, b.y + b.h / 2 + 5);
      }
      // pulse
      if (!reduce) {
        const total = 2 + 4 * N + 2; let k = phase % total; let idx; let frac = k % 1; k = Math.floor(k);
        if (k < 2) idx = k; else if (k < 2 + 4 * N) { idx = 2 + ((k - 2) % 4); layerShown = Math.floor((k - 2) / 4); } else idx = 6 + (k - 2 - 4 * N);
        const b = boxes[Math.min(7, idx)];
        let nx = idx + 1; if (idx === 5 && layerShown < N - 1) nx = 2; const bn = boxes[Math.min(7, nx)];
        const py = b.y + b.h + (bn.y - b.y - b.h) * frac; const loop = idx === 5 && layerShown < N - 1;
        const px = loop ? b.x + b.w + 8 : b.x + b.w / 2;
        g.fillStyle = C.text; g.globalAlpha = 0.9; g.beginPath();
        if (loop) { const yy = b.y + b.h / 2 + (bn.y + bn.h / 2 - b.y - b.h / 2) * frac; g.arc(px, yy, 4, 0, 7); } else g.arc(px, Math.min(py, bn.y), 4, 0, 7);
        g.fill(); g.globalAlpha = 1;
        if (loop) { g.strokeStyle = C.subtle; g.beginPath(); g.moveTo(b.x + b.w, b.y + b.h / 2); g.lineTo(b.x + b.w + 8, b.y + b.h / 2); g.lineTo(b.x + b.w + 8, bn.y + bn.h / 2); g.lineTo(bn.x + bn.w, bn.y + bn.h / 2); g.stroke(); }
      }
      // detail area
      const dx = wide ? dw + 24 : dw + 10; const dwid = wide ? w - dw - 30 : w - dw - 12;
      g.save(); g.beginPath(); g.rect(dx, 0, dwid, h); g.clip(); detail(dx, top + 4, dwid, bottom - top - 8); g.restore();
    }
    cv.onResize(() => draw());
    ctx.loop((t, dt) => { if (!reduce) { phase += dt * 1.2; draw(t); } });
    cv.el.addEventListener('pointerdown', (e) => {
      const r = cv.el.getBoundingClientRect(); const x = e.clientX - r.left; const y = e.clientY - r.top;
      const b = boxes.find((q) => x >= q.x - 30 && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
      if (b) { sel = b.p.id; explain(); draw(); }
    }, { signal: ctx.signal });
    cv.el.style.cursor = 'pointer';

    // Panel
    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">The transformer</h2>'), ctx.h('<p class="lede">Every modern LLM is the same block repeated many times. Here is a real, tiny one running in your browser. Click any box.</p>'));
    const exp = ctx.h('<div class="card" style="border-color:#3A3A38"><b class="t" style="font:700 16px Rajdhani,sans-serif;text-transform:uppercase;letter-spacing:.06em"></b><p class="small x"></p></div>');
    const explain = () => { const p = PARTS.find((q) => q.id === sel); exp.querySelector('.t').textContent = p.name; exp.querySelector('.t').style.color = p.col === C.muted ? C.text : p.col; exp.querySelector('.x').textContent = p.text; };
    explain();
    const re = () => { out = forward(M, PROMPTS[prompt], N); stat.innerHTML = `<div><b>${N}</b><span>layers</span></div><div><b>${params(N).toLocaleString('en-US')}</b><span>parameters</span></div><div><b>${VOC[out.softmax.indexOf(Math.max(...out.softmax))]}</b><span>top guess</span></div>`; draw(); };
    const params = (n) => VOC.length * D + n * (4 * D * D + D * HID + HID * D);
    const stat = ctx.h('<div class="stat"></div>');
    const row = ctx.h('<div class="row"><span class="hint">Prompt:</span></div>');
    row.append(ctx.seg([['cat', 'the cat sat on'], ['dog', 'the dog ran to']], prompt, (v) => { prompt = v; re(); }));
    P.append(exp, row, ctx.slider({ label: 'Layers (blocks stacked)', min: 1, max: 8, step: 1, value: N, fmt: (v) => `${v}`, onInput: (v) => { N = v; ctx.store.set('tf:N', v); re(); } }), stat);
    re();
    P.append(
      ctx.h(`<div class="card tip"><p>Think of a conveyor belt of vectors, one per token (the residual stream). Each block reads from the belt and adds something back: attention adds information gathered from other tokens, the MLP adds information computed from the token itself. After the last block, the vector at the final position is turned into a score for every possible next token.</p></div>`),
      ctx.h(`<div class="card try"><ol>
        <li>Click <b>Masked self-attention</b> and look at the weight grid: the upper right is empty because of the mask.</li>
        <li>Click <b>Next-token probabilities</b>, then change the layer count. The guess changes, but it is nonsense.</li>
        <li>That is the honest point: these weights are random. Same machinery as a real LLM, but nothing has been learned yet. Training (two chapters on) is what fills the weights with useful patterns.</li>
      </ol></div>`),
      ctx.h(`<div class="card deep">
        <p><b>This toy:</b> ${VOC.length} word vocabulary, vectors of ${D} numbers, one attention head, an MLP ${D}→${HID}→${D}, random fixed weights. Every number on the right is computed live.</p>
        <p><b>Real scale (published examples):</b> GPT-2 small (2019) had 12 layers, vectors of 768 numbers, 12 heads per layer and about 124 million parameters. GPT-3 (2020) had 96 layers, vectors of 12,288 numbers, 96 heads and 175 billion parameters. Small models have a handful to a few dozen layers; the largest published ones have over a hundred.</p>
        <p><b>Norm placement:</b> the original 2017 transformer normalised after adding (as drawn). Most modern LLMs normalise before each attention and MLP step ("pre-norm"), which trains more stably. Many also use RMSNorm, a simpler variant.</p>
        <div class="formula">x = x + Attention(Norm(x))<br>x = x + MLP(Norm(x))<span>one pre-norm block; repeat N times</span></div>
      </div>`),
    );

    ctx.quiz([
      { q: 'Which part of a transformer block lets tokens share information with each other?', choices: ['The MLP', 'Self-attention', 'Layer norm', 'The unembedding'], answer: 1, why: 'The MLP works on each token separately. Attention is where tokens read from each other.' },
      { q: 'Why can blocks be stacked many times?', choices: ['Each block outputs vectors of the same shape it takes in', 'Each block halves the data', 'They are trained one at a time', 'They share the same weights'], answer: 0, why: 'Same shape in and out, with residual connections, so you can repeat the block as often as you like (each layer has its own weights).' },
      { q: 'What does the model output at the very end?', choices: ['A full sentence', 'One probability for every token in the vocabulary, for the next position', 'The embedding of the prompt', 'A yes or no answer'], answer: 1, why: 'The final vector becomes a score per vocabulary token, then softmax gives next-token probabilities.' },
    ]);
  },
};
