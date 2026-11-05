// What is machine learning: rules written by hand versus rules learned from examples.
// Three views on the stage: sort fruit (rule vs model), the pipeline, and the map of ML.

const MONO = '500 11px "DM Mono", ui-monospace, monospace';
const MONO_S = '500 10px "DM Mono", ui-monospace, monospace';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function rng(seed) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const sig = (z) => 1 / (1 + Math.exp(-z));
const X0 = 90; const X1 = 260; // weight range (g)
const Y0 = 0; const Y1 = 10; // bumpiness range

// Apples (label 0) and oranges (label 1), measured by weight and skin bumpiness.
function fruit(season) {
  const r = rng(season ? 78 : 12);
  const gs = () => { const u = Math.max(1e-9, r()); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
  const out = [];
  for (let i = 0; i < 34; i++) {
    const apple = i % 2 === 0;
    let w; let b;
    if (!season) { w = apple ? 148 + gs() * 18 : 190 + gs() * 20; b = apple ? 3.3 + gs() * 1.25 : 6.2 + gs() * 1.25; }
    else { w = apple ? 172 + gs() * 18 : 146 + gs() * 18; b = apple ? 5.6 + gs() * 1.1 : 7.9 + gs() * 1.1; } // a new, bumpier apple variety and small oranges
    out.push({ w: Math.max(X0 + 4, Math.min(X1 - 4, w)), b: Math.max(0.3, Math.min(9.7, b)), c: apple ? 0 : 1 });
  }
  return out;
}

const STAGES = [
  ['Data', 'A table of examples. Each row is one fruit somebody weighed and looked at.'],
  ['Features', 'The inputs, as numbers: weight and bumpiness. A model only ever sees numbers.'],
  ['Labels', 'The right answers, written down by a person for every example. Learning from labelled examples is called supervised learning.'],
  ['Model', 'A formula with adjustable knobs (weights). Training turns the knobs until the formula reproduces the labels as well as it can.'],
  ['Prediction', 'Show the trained model a new fruit it has never seen. It gives its best guess, with a confidence.'],
];
const MAP = [
  ['regression', 'Supervised', 'Learn from labelled examples to predict a number or a category.', 'house prices, spam filters'],
  ['kmeans', 'Unsupervised', 'No labels at all. Find groups and structure hidden in the data.', 'customer segments'],
  ['reinforcement', 'Reinforcement', 'Learn by trial and error, from rewards and penalties.', 'game playing, robots'],
  ['neural-net', 'Deep learning', 'Many layers of simple units that learn their own features. Used inside all three above.', 'vision, speech'],
  ['next-token', 'Generative', 'Models that make new things: text, images, sound, one piece at a time.', 'chatbots, image makers'],
];

export default {
  mount(ctx) {
    const C = ctx.colors; const CL = [C.c4, C.c2]; const NAME = ['apple', 'orange'];
    const cv = ctx.canvas({ style: 'touch-action:none' });
    const g = cv.ctx;
    let view = 'sort'; let season = 0; let data = fruit(0);
    let rule = { f: 'b', t: 5.2 }; // say orange if feature > t
    let model = null; let training = 0; let mystery = null;
    let stage = 0; let stageT = 0; let hover = -1;
    let W = 0; let H = 0;

    // ----- model: logistic regression on standardised features -----
    function stats() {
      const n = data.length; const m = [0, 0]; const s = [0, 0];
      for (const p of data) { m[0] += p.w / n; m[1] += p.b / n; }
      for (const p of data) { s[0] += (p.w - m[0]) ** 2 / n; s[1] += (p.b - m[1]) ** 2 / n; }
      return { m, s: s.map(Math.sqrt) };
    }
    function newModel() { model = { w: [0.3, -0.9], b: 0.2, st: stats(), trained: false }; }
    const zOf = (w, b) => model.w[0] * (w - model.st.m[0]) / model.st.s[0] + model.w[1] * (b - model.st.m[1]) / model.st.s[1] + model.b;
    const pOf = (w, b) => sig(zOf(w, b));
    function trainSteps(k) {
      for (let it = 0; it < k; it++) {
        const gw = [0, 0]; let gb = 0;
        for (const p of data) {
          const e = pOf(p.w, p.b) - p.c;
          gw[0] += e * (p.w - model.st.m[0]) / model.st.s[0]; gw[1] += e * (p.b - model.st.m[1]) / model.st.s[1]; gb += e;
        }
        const n = data.length; model.w[0] -= 0.6 * gw[0] / n; model.w[1] -= 0.6 * gw[1] / n; model.b -= 0.6 * gb / n;
      }
    }
    const ruleSays = (w, b) => ((rule.f === 'w' ? w : b) > rule.t ? 1 : 0);
    const acc = (fn) => data.filter((p) => fn(p.w, p.b) === p.c).length / data.length;
    newModel();
    // train once silently so the pipeline view has a real model to show
    const trainedCopy = () => { const keep = model; newModel(); trainSteps(400); const t = model; model = keep; return t; };
    let pipeModel = trainedCopy();

    // ----- panel -----
    ctx.panel.append(
      ctx.h('<h2 class="k-h">What is machine learning</h2>'),
      ctx.h('<p class="lede">A normal program follows rules a person wrote. A machine learning program is shown examples with the right answers and works out its own rules.</p>'),
      ctx.h('<h3>1. Write a rule yourself</h3>'),
      ctx.h('<p class="small muted">Sort apples from oranges. Pick one measurement and a cut off.</p>'),
    );
    const featSeg = ctx.seg([['b', 'Bumpiness'], ['w', 'Weight']], 'b', (v) => { rule.f = v; rule.t = v === 'w' ? 170 : 5.2; tS.input.min = v === 'w' ? X0 : 0; tS.input.max = v === 'w' ? X1 : 10; tS.input.step = v === 'w' ? 1 : 0.1; tS.value = rule.t; syncText(); });
    const tS = ctx.slider({ label: 'Cut off', min: 0, max: 10, step: 0.1, value: rule.t, fmt: (v) => (rule.f === 'w' ? `${Math.round(v)} g` : v.toFixed(1)), onInput: (v) => { rule.t = v; syncText(); } });
    const code = ctx.h('<pre class="code"></pre>');
    ctx.panel.append(featSeg, tS, code);
    ctx.panel.append(ctx.h('<h3>2. Let a model learn the rule</h3>'), ctx.h('<p class="small muted">The model gets the same table of labelled fruit and adjusts its own boundary to fit them.</p>'));
    const trainRow = ctx.h('<div class="row"><button class="btn sm" data-a="train">Train the model</button><button class="btn ghost sm" data-a="season">Next season</button></div>');
    ctx.panel.append(trainRow);
    const score = ctx.h('<div class="stat"><div><b data-s="rule">0</b><span>Your rule</span></div><div><b data-s="model">-</b><span>Learned model</span></div></div>');
    ctx.panel.append(score);
    const note = ctx.h('<p class="hint" style="min-height:3em"></p>');
    ctx.panel.append(note);
    const sv = (k) => score.querySelector(`[data-s="${k}"]`);
    trainRow.querySelector('[data-a="train"]').onclick = () => { setView('sort'); newModel(); training = RM ? 0 : 90; if (RM) { trainSteps(400); model.trained = true; } syncText(); };
    trainRow.querySelector('[data-a="season"]').onclick = () => {
      setView('sort'); season = 1 - season; data = fruit(season);
      const wasTrained = model.trained; newModel(); pipeModel = trainedCopy();
      model.trained = false; training = 0;
      note.textContent = season ? 'New season: a bumpier apple variety arrived and the oranges came out small. Your rule did not change. Press Train to let the model relearn from the new examples.' : 'Back to last season\'s fruit.';
      if (wasTrained && RM) { trainSteps(400); model.trained = true; }
      syncText(true);
    };

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>Machine learning is learning <b>from examples instead of rules</b>. The words you will see in every chapter:</p>
      <ul>
        <li><b>Data</b>: a table of examples, one row each.</li>
        <li><b>Features</b>: the inputs, as numbers (weight, bumpiness).</li>
        <li><b>Labels</b>: the right answers we want (apple or orange).</li>
        <li><b>Model</b>: a formula with knobs. <b>Training</b> sets the knobs from the examples.</li>
        <li><b>Prediction</b>: the model's answer for something new.</li>
      </ul>
      <p>Your hand written rule can only look at one thing at a time. The model weighs both measurements together, which is why its boundary is a slanted line. And when the fruit changes, you have to rewrite your rule, while the model just retrains on new examples.</p>
    </div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li>Move the cut off and find the best single rule you can. It will get stuck somewhere in the 80s.</li>
      <li>Press <b>Train the model</b> and watch its boundary swing into place.</li>
      <li>Tap anywhere on the plot to drop a mystery fruit. See what your rule and the model each say.</li>
      <li>Press <b>Next season</b>. Your rule breaks. Train again, and the model recovers.</li>
      <li>Open <b>Pipeline</b> and <b>ML map</b> on the stage.</li>
    </ol></div>`));
    ctx.panel.append(ctx.h('<h3>The map of machine learning</h3>'));
    const mapList = ctx.h('<div style="display:grid;gap:6px"></div>');
    for (const [id, name, desc] of MAP) {
      const b = ctx.h(`<button class="choice" style="display:grid;gap:2px"><b style="font:700 15px var(--f-display);letter-spacing:.06em;text-transform:uppercase">${name} ›</b><span class="small muted">${desc}</span></button>`);
      b.onclick = () => ctx.go(id);
      mapList.append(b);
    }
    ctx.panel.append(mapList);
    ctx.panel.append(ctx.h(`<div class="card deep">
      <p>Use plain rules when you can write them down and they will not change: tax brackets, unit conversions. Use machine learning when the rule is too fuzzy to write (what makes a face a face?), too big (thousands of interacting signals), or keeps changing (spam tactics, fruit seasons).</p>
      <p>Formally, a supervised model learns a function <code>f(features) ≈ label</code> by minimising a <b>loss</b>, a number that measures how wrong it is on the training examples. The real goal is <b>generalisation</b>: being right on new examples. That is why we always test on data the model did not train on.</p>
      <p>The model here is logistic regression, covered properly in "Drawing a boundary". The ideas of loss, gradient descent and overfitting in the next chapters apply to every model on the map, all the way up to large language models.</p>
    </div>`));
    ctx.quiz([
      { q: 'What is the key difference between a normal program and a machine learning model?', choices: ['ML runs faster', 'The rules of an ML model are learned from examples, not written by hand', 'ML does not use numbers'], answer: 1, why: 'A programmer writes the training procedure, but the actual decision rule comes from the data.' },
      { q: 'In a spam filter, the words in each email are the… and "spam / not spam" is the…', choices: ['labels, features', 'features, labels', 'model, prediction'], answer: 1, why: 'Features are the inputs the model sees. Labels are the answers it learns to give.' },
      { q: 'Finding groups of similar customers without any labels is…', choices: ['Supervised learning', 'Unsupervised learning', 'Reinforcement learning'], answer: 1, why: 'There are no right answers to copy, so the model looks for structure on its own.' },
    ]);

    // ----- dock -----
    const dock = ctx.h('<div class="dock"><div class="grp glass"><button data-v="sort" class="on">Sort fruit</button><button data-v="pipe">Pipeline</button><button data-v="map">ML map</button></div></div>');
    ctx.stage.append(dock);
    function setView(v) { view = v; dock.querySelectorAll('[data-v]').forEach((b) => b.classList.toggle('on', b.dataset.v === v)); hover = -1; stage = 0; stageT = 0; }
    dock.querySelectorAll('[data-v]').forEach((b) => { b.onclick = () => setView(b.dataset.v); });

    function syncText(force) {
      const f = rule.f === 'w' ? 'weight' : 'bumpiness'; const t = rule.f === 'w' ? `${Math.round(rule.t)}` : rule.t.toFixed(1);
      code.textContent = `if (${f} > ${t}) {\n  return "orange";\n}\nreturn "apple";`;
      sv('rule').textContent = `${Math.round(acc(ruleSays) * 100)}%`;
      if (model.trained || training > 0) sv('model').textContent = `${Math.round(acc((w, b) => (pOf(w, b) > 0.5 ? 1 : 0)) * 100)}%`; else sv('model').textContent = '-';
      if (!force && model.trained && !season) note.textContent = 'The model uses both measurements at once, so its boundary can slant.';
    }
    syncText();

    // ----- layout helpers for the fruit plot -----
    const plot = () => {
      const padL = 46; const padB = 92; const padT = 10; const padR = 12;
      const w = Math.min(W - padL - padR, (H - padT - padB) * 1.5);
      return { x: padL + (W - padL - padR - w) / 2, y: padT, w, h: H - padT - padB };
    };
    let P = { x: 0, y: 0, w: 1, h: 1 };
    const px = (w) => P.x + (w - X0) / (X1 - X0) * P.w; const py = (b) => P.y + P.h - (b - Y0) / (Y1 - Y0) * P.h;
    const iw = (x) => X0 + (x - P.x) / P.w * (X1 - X0); const ib = (y) => Y0 + (P.y + P.h - y) / P.h * (Y1 - Y0);

    cv.onResize((w, h) => { W = w; H = h; P = plot(); });

    // virtual layouts for the diagram views, scaled to fit
    let VT = { k: 1, ox: 0, oy: 0 };
    function fitVirtual(vw, vh) {
      const availH = H - 60; const k = Math.min(W / vw, availH / vh, 1.35);
      VT = { k, ox: (W - vw * k) / 2, oy: Math.max(0, (availH - vh * k) / 2) };
      g.save(); g.translate(VT.ox, VT.oy); g.scale(k, k);
    }
    const toVirtual = (x, y) => [(x - VT.ox) / VT.k, (y - VT.oy) / VT.k];
    let hitBoxes = [];

    // ----- pointer -----
    cv.el.addEventListener('pointerdown', (e) => {
      const r = cv.el.getBoundingClientRect(); const x = e.clientX - r.left; const y = e.clientY - r.top;
      if (view === 'sort') {
        if (x >= P.x && x <= P.x + P.w && y >= P.y && y <= P.y + P.h) mystery = { w: iw(x), b: ib(y), t: 0 };
        return;
      }
      const [vx, vy] = toVirtual(x, y);
      const hit = hitBoxes.find((h) => vx >= h.x && vx <= h.x + h.w && vy >= h.y && vy <= h.y + h.h);
      if (!hit) return;
      if (view === 'pipe') { stage = hit.i; stageT = 0; }
      if (view === 'map') ctx.go(hit.id);
    }, { signal: ctx.signal });
    cv.el.addEventListener('pointermove', (e) => {
      const r = cv.el.getBoundingClientRect(); const x = e.clientX - r.left; const y = e.clientY - r.top;
      if (view === 'sort') { cv.el.style.cursor = (x >= P.x && x <= P.x + P.w && y >= P.y && y <= P.y + P.h) ? 'crosshair' : 'default'; return; }
      const [vx, vy] = toVirtual(x, y);
      const i = hitBoxes.findIndex((h) => vx >= h.x && vx <= h.x + h.w && vy >= h.y && vy <= h.y + h.h);
      hover = i; cv.el.style.cursor = i >= 0 ? 'pointer' : 'default';
    }, { signal: ctx.signal });

    // ----- drawing: fruit -----
    function drawFruit(x, y, c, r = 7) {
      g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fillStyle = CL[c]; g.fill();
      g.lineWidth = 1.6; g.strokeStyle = C.bg; g.stroke();
      if (c === 0) { g.strokeStyle = '#7c5a3a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y - r + 1); g.lineTo(x + 1.5, y - r - 3.5); g.stroke(); g.fillStyle = C.c6; g.beginPath(); g.ellipse(x + 3.6, y - r - 2.2, 2.6, 1.2, -0.5, 0, 6.283); g.fill(); }
      else { g.fillStyle = 'rgba(10,10,10,0.35)'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.2, 0.9, 0, 6.283); g.arc(x + r * 0.3, y + r * 0.25, 0.9, 0, 6.283); g.arc(x + r * 0.15, y - r * 0.45, 0.8, 0, 6.283); g.fill(); }
    }
    function chip(x, y, txt, col, align) {
      g.font = MONO; const tw = g.measureText(txt).width + 14;
      let bx = align === 'right' ? x - tw : x; bx = Math.max(4, Math.min(W - tw - 4, bx));
      g.fillStyle = 'rgba(20,20,20,0.92)'; g.strokeStyle = C.borderStrong; g.lineWidth = 1; g.beginPath(); g.roundRect(bx, y, tw, 22, 6); g.fill(); g.stroke();
      g.fillStyle = col; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, bx + 7, y + 11);
    }

    function drawSort(dt) {
      P = plot();
      if (training > 0) { trainSteps(3); training--; if (!training) model.trained = true; syncText(); }
      // rule regions
      g.save(); g.beginPath(); g.rect(P.x, P.y, P.w, P.h); g.clip();
      if (rule.f === 'b') { g.fillStyle = rgba(CL[1], 0.06); g.fillRect(P.x, P.y, P.w, py(rule.t) - P.y); g.fillStyle = rgba(CL[0], 0.05); g.fillRect(P.x, py(rule.t), P.w, P.y + P.h - py(rule.t)); }
      else { g.fillStyle = rgba(CL[1], 0.06); g.fillRect(px(rule.t), P.y, P.x + P.w - px(rule.t), P.h); g.fillStyle = rgba(CL[0], 0.05); g.fillRect(P.x, P.y, px(rule.t) - P.x, P.h); }
      g.restore();
      g.strokeStyle = C.borderStrong; g.lineWidth = 1; g.strokeRect(P.x + 0.5, P.y + 0.5, P.w - 1, P.h - 1);
      // axes labels
      g.font = MONO; g.fillStyle = C.muted; g.textAlign = 'center'; g.textBaseline = 'top';
      for (let w = 100; w <= 250; w += 50) g.fillText(`${w}`, px(w), P.y + P.h + 5);
      g.fillText('weight (grams)', P.x + P.w / 2, P.y + P.h + 20);
      g.textAlign = 'right'; g.textBaseline = 'middle';
      for (let b = 0; b <= 10; b += 5) g.fillText(String(b), P.x - 6, py(b));
      g.save(); g.translate(P.x - 26, P.y + P.h / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('bumpiness', 0, 0); g.restore();
      g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = C.muted;
      g.fillText('smooth', P.x + 4, P.y + P.h - 16); g.fillText('bumpy', P.x + 4, P.y + 4);

      // your rule line
      g.setLineDash([6, 5]); g.strokeStyle = C.text; g.lineWidth = 1.6; g.beginPath();
      if (rule.f === 'b') { g.moveTo(P.x, py(rule.t)); g.lineTo(P.x + P.w, py(rule.t)); } else { g.moveTo(px(rule.t), P.y); g.lineTo(px(rule.t), P.y + P.h); }
      g.stroke(); g.setLineDash([]);
      // the model's line: z = 0, solved for bumpiness as a function of weight
      const showModel = model.trained || training > 0;
      if (showModel && Math.abs(model.w[1]) > 1e-6) {
        const bAt = (w) => model.st.m[1] - model.st.s[1] / model.w[1] * (model.w[0] * (w - model.st.m[0]) / model.st.s[0] + model.b);
        g.save(); g.beginPath(); g.rect(P.x, P.y, P.w, P.h); g.clip();
        g.strokeStyle = rgba(C.c1, 0.25); g.lineWidth = 8; g.beginPath(); g.moveTo(px(X0), py(bAt(X0))); g.lineTo(px(X1), py(bAt(X1))); g.stroke();
        g.strokeStyle = C.c1; g.lineWidth = 2.2; g.beginPath(); g.moveTo(px(X0), py(bAt(X0))); g.lineTo(px(X1), py(bAt(X1))); g.stroke();
        g.restore();
      }
      // fruit, ringed when the current sorter gets them wrong
      for (const p of data) {
        const X = px(p.w); const Y = py(p.b);
        const wrongRule = ruleSays(p.w, p.b) !== p.c;
        if (wrongRule) { g.beginPath(); g.arc(X, Y, 10, 0, 6.283); g.strokeStyle = 'rgba(245,245,240,0.55)'; g.lineWidth = 1.2; g.stroke(); }
        drawFruit(X, Y, p.c);
      }
      // mystery fruit
      if (mystery) {
        mystery.t = Math.min(1, mystery.t + dt * 3);
        const X = px(mystery.w); const Y = py(mystery.b); const r = 9 + (RM ? 0 : (1 - mystery.t) * 8);
        g.beginPath(); g.arc(X, Y, r, 0, 6.283); g.fillStyle = 'rgba(245,245,240,0.12)'; g.fill(); g.strokeStyle = C.text; g.lineWidth = 2; g.stroke();
        g.font = '700 14px Rajdhani, sans-serif'; g.fillStyle = C.text; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', X, Y + 1);
        const rs = NAME[ruleSays(mystery.w, mystery.b)];
        const ms = showModel ? (() => { const p = pOf(mystery.w, mystery.b); return p > 0.5 ? `orange ${Math.round(p * 100)}%` : `apple ${Math.round((1 - p) * 100)}%`; })() : 'not trained yet';
        const right = X > P.x + P.w * 0.6;
        chip(right ? X - 16 : X + 16, Y - 30, `your rule: ${rs}`, C.text, right ? 'right' : 'left');
        chip(right ? X - 16 : X + 16, Y - 6, `model: ${ms}`, C.c1, right ? 'right' : 'left');
      }
      // legend
      const ly = P.y + P.h + 40; let lx = P.x;
      g.font = MONO; g.textBaseline = 'middle'; g.textAlign = 'left';
      drawFruit(lx + 6, ly, 0, 5); g.fillStyle = C.text2; g.fillText('apple', lx + 16, ly); lx += 72;
      drawFruit(lx + 6, ly, 1, 5); g.fillStyle = C.text2; g.fillText('orange', lx + 16, ly); lx += 80;
      g.setLineDash([5, 4]); g.strokeStyle = C.text; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + 18, ly); g.stroke(); g.setLineDash([]); g.fillText('your rule', lx + 24, ly); lx += 100;
      if (lx + 120 < W) { g.strokeStyle = C.c1; g.lineWidth = 2; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + 18, ly); g.stroke(); g.fillStyle = C.c1; g.fillText(showModel ? 'learned boundary' : 'model (untrained)', lx + 24, ly); }
      if (season) { g.fillStyle = C.c2; g.textAlign = 'right'; g.textBaseline = 'top'; g.fillText('next season', P.x + P.w - 6, P.y + 6); }
    }

    // ----- drawing: pipeline -----
    function box(x, y, w, h, i, title) {
      const on = stage === i; const hv = hover === i;
      g.fillStyle = on ? 'rgba(94,234,212,0.08)' : 'rgba(20,20,20,0.85)';
      g.strokeStyle = on ? C.c1 : hv ? C.text2 : C.borderStrong; g.lineWidth = on ? 1.6 : 1;
      g.beginPath(); g.roundRect(x, y, w, h, 10); g.fill(); g.stroke();
      g.font = '700 13px Rajdhani, sans-serif'; g.fillStyle = on ? C.c1 : C.muted; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(`${i + 1}  ${title.toUpperCase()}`, x + 10, y + 8);
      hitBoxes.push({ x, y, w, h, i });
    }
    function arrow(x1, y1, x2, y2, active, t) {
      g.strokeStyle = active ? C.c1 : C.borderStrong; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      const an = Math.atan2(y2 - y1, x2 - x1);
      g.fillStyle = active ? C.c1 : C.borderStrong; g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - 7 * Math.cos(an - 0.5), y2 - 7 * Math.sin(an - 0.5)); g.lineTo(x2 - 7 * Math.cos(an + 0.5), y2 - 7 * Math.sin(an + 0.5)); g.closePath(); g.fill();
      if (active && !RM) for (let k = 0; k < 3; k++) { const f = (t * 0.9 + k / 3) % 1; g.beginPath(); g.arc(x1 + (x2 - x1) * f, y1 + (y2 - y1) * f, 2.5, 0, 6.283); g.fillStyle = C.c1; g.fill(); }
    }
    function wrap(txt, x, y, maxW, lh) {
      const words = txt.split(' '); let line = ''; let yy = y;
      for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = t; }
      if (line) g.fillText(line, x, yy);
    }
    function drawPipe(t, dt) {
      if (!RM) { stageT += dt; if (stageT > 3.2) { stageT = 0; stage = (stage + 1) % 5; } }
      const wide = W > 620;
      const VW = wide ? 940 : 380; const VH = wide ? 360 : 446;
      fitVirtual(VW, VH); hitBoxes = [];
      const rows = data.slice(0, wide ? 5 : 3); const pm = pipeModel;
      const newF = { w: 176, b: 5.6 };
      const pz = pm.w[0] * (newF.w - pm.st.m[0]) / pm.st.s[0] + pm.w[1] * (newF.b - pm.st.m[1]) / pm.st.s[1] + pm.b; const pp = sig(pz);
      // geometry
      let T; let F; let Lb; let M; let Pr;
      if (wide) { T = [0, 20, 300, 200]; F = [350, 20, 160, 92]; Lb = [350, 128, 160, 92]; M = [560, 20, 170, 200]; Pr = [780, 20, 160, 200]; }
      else { T = [0, 0, 380, 118]; F = [0, 136, 184, 80]; Lb = [196, 136, 184, 80]; M = [0, 234, 184, 112]; Pr = [196, 234, 184, 112]; }
      // table
      box(...T, 0, 'Data');
      const [tx, ty, tw] = T; const colX = [tx + 12, tx + tw * 0.17, tx + tw * 0.43, tx + tw * 0.72];
      g.font = MONO_S; g.textBaseline = 'top'; g.textAlign = 'left';
      const hdr = ['#', 'weight', 'bumpy', 'label'];
      hdr.forEach((h, i) => { g.fillStyle = (stage === 1 && (i === 1 || i === 2)) ? C.c1 : (stage === 2 && i === 3) ? C.c2 : C.muted; g.fillText(h, colX[i], ty + 32); });
      const rh = wide ? 26 : 19;
      rows.forEach((p, r) => {
        const y = ty + 50 + r * rh;
        g.fillStyle = (stage === 1) ? 'rgba(94,234,212,0.07)' : 'transparent'; g.fillRect(colX[1] - 4, y - 3, colX[3] - colX[1] - 6, rh - 4);
        g.fillStyle = (stage === 2) ? 'rgba(251,191,36,0.08)' : 'transparent'; g.fillRect(colX[3] - 4, y - 3, tw - (colX[3] - tx) - 8, rh - 4);
        g.font = MONO; g.fillStyle = C.muted; g.fillText(String(r + 1), colX[0], y);
        g.fillStyle = C.text; g.fillText(`${Math.round(p.w)} g`, colX[1], y); g.fillText(p.b.toFixed(1), colX[2], y);
        g.fillStyle = CL[p.c]; g.fillText(NAME[p.c], colX[3], y);
      });
      g.fillStyle = C.subtle; g.font = MONO_S; g.fillText(`… ${data.length} rows`, colX[0], ty + 50 + rows.length * rh);
      // features
      box(...F, 1, 'Features');
      g.font = MONO; g.fillStyle = C.text; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(`[${Math.round(rows[0].w)}, ${rows[0].b.toFixed(1)}]`, F[0] + 12, F[1] + 34);
      g.fillText(`[${Math.round(rows[1].w)}, ${rows[1].b.toFixed(1)}]`, F[0] + 12, F[1] + 52);
      g.fillStyle = C.subtle; g.fillText('…', F[0] + 12, F[1] + 66);
      // labels
      box(...Lb, 2, 'Labels');
      g.font = MONO; g.textBaseline = 'top';
      g.fillStyle = CL[rows[0].c]; g.fillText(`${NAME[rows[0].c]} = ${rows[0].c}`, Lb[0] + 12, Lb[1] + 34);
      g.fillStyle = CL[rows[1].c]; g.fillText(`${NAME[rows[1].c]} = ${rows[1].c}`, Lb[0] + 12, Lb[1] + 52);
      g.fillStyle = C.subtle; g.fillText('…', Lb[0] + 12, Lb[1] + 68);
      // model: a mini scatter with its learned boundary
      box(...M, 3, 'Model');
      const mx0 = M[0] + 12; const my0 = M[1] + 32; const mw = M[2] - 24; const mh = M[3] - (wide ? 76 : 44);
      g.strokeStyle = C.border; g.strokeRect(mx0, my0, mw, mh);
      const mxp = (w) => mx0 + (w - X0) / (X1 - X0) * mw; const myp = (b) => my0 + mh - b / 10 * mh;
      for (const p of data) { g.beginPath(); g.arc(mxp(p.w), myp(p.b), 2.2, 0, 6.283); g.fillStyle = CL[p.c]; g.fill(); }
      const bAt = (w) => pm.st.m[1] - pm.st.s[1] / pm.w[1] * (pm.w[0] * (w - pm.st.m[0]) / pm.st.s[0] + pm.b);
      g.save(); g.beginPath(); g.rect(mx0, my0, mw, mh); g.clip();
      g.strokeStyle = C.c1; g.lineWidth = 1.8; g.beginPath(); g.moveTo(mxp(X0), myp(bAt(X0))); g.lineTo(mxp(X1), myp(bAt(X1))); g.stroke(); g.restore();
      if (wide) {
        g.font = MONO_S; g.fillStyle = C.muted; g.textAlign = 'left'; g.textBaseline = 'top';
        g.fillText(`weights: ${pm.w[0].toFixed(2)}, ${pm.w[1].toFixed(2)}`, M[0] + 12, M[1] + M[3] - 38);
        g.fillText(`bias: ${pm.b.toFixed(2)}`, M[0] + 12, M[1] + M[3] - 22);
      }
      // prediction
      box(...Pr, 4, 'Prediction');
      g.font = MONO; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = C.muted;
      g.fillText('new fruit:', Pr[0] + 12, Pr[1] + 32);
      g.fillStyle = C.text; g.fillText(`[${newF.w} g, ${newF.b}]`, Pr[0] + 12, Pr[1] + 50);
      const big = wide ? 44 : 22; const cy = Pr[1] + (wide ? 110 : 80);
      drawFruit(Pr[0] + 26, cy, pp > 0.5 ? 1 : 0, wide ? 11 : 8);
      g.font = '700 22px Rajdhani, sans-serif'; g.fillStyle = CL[pp > 0.5 ? 1 : 0]; g.textBaseline = 'middle';
      g.fillText((pp > 0.5 ? 'ORANGE' : 'APPLE'), Pr[0] + 44, cy);
      g.font = MONO; g.fillStyle = C.muted; g.textBaseline = 'top';
      g.fillText(`${Math.round(Math.max(pp, 1 - pp) * 100)}% sure`, Pr[0] + 12, cy + big / 2 + 2);
      // arrows
      if (wide) {
        arrow(300, 66, 348, 66, stage === 1, t); arrow(300, 174, 348, 174, stage === 2, t);
        arrow(510, 66, 558, 100, stage === 3, t); arrow(510, 174, 558, 140, stage === 3, t);
        arrow(730, 120, 778, 120, stage === 4, t);
      } else {
        arrow(92, 118, 92, 134, stage === 1, t); arrow(288, 118, 288, 134, stage === 2, t);
        arrow(92, 216, 92, 232, stage === 3, t); arrow(288, 216, 140, 232, stage === 3, t);
        arrow(184, 290, 194, 290, stage === 4, t);
      }
      // caption
      const capY = wide ? 250 : 358;
      g.font = '700 18px Rajdhani, sans-serif'; g.fillStyle = C.text; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(STAGES[stage][0].toUpperCase(), 0, capY);
      g.font = wide ? '15px Lora, Georgia, serif' : '14px Lora, Georgia, serif'; g.fillStyle = C.text2;
      wrap(STAGES[stage][1], wide ? 130 : 0, wide ? capY + 2 : capY + 22, wide ? 800 : 380, wide ? 21 : 19);
      // progress pips
      if (wide) {
        for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(i * 14 + 5, VH - 6, 3.5, 0, 6.283); g.fillStyle = i === stage ? C.c1 : C.borderStrong; g.fill(); }
        g.font = MONO_S; g.fillStyle = C.subtle; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('tap a box to jump to it', 76, VH - 6);
      }
      g.restore();
    }

    // ----- drawing: map -----
    function drawMap(t) {
      const wide = W > 620;
      hitBoxes = [];
      if (wide) {
        const VW = 960; const VH = 390; fitVirtual(VW, VH);
        const cx = VW / 2;
        g.font = '700 22px Rajdhani, sans-serif'; const label = 'MACHINE LEARNING'; const lw = g.measureText(label).width + 36;
        g.fillStyle = C.surface2; g.strokeStyle = C.text2; g.lineWidth = 1.2; g.beginPath(); g.roundRect(cx - lw / 2, 6, lw, 42, 10); g.fill(); g.stroke();
        g.fillStyle = C.text; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, cx, 28);
        const cw = 178; const gap = (VW - cw * 5) / 4; const top = 120; const ch = 230;
        MAP.forEach(([id, name, desc, ex], i) => {
          const x = i * (cw + gap); const col = [C.c1, C.c3, C.c2, C.c5, C.c4][i]; const hv = hover === i;
          g.strokeStyle = rgba(col, 0.5); g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx, 48); g.bezierCurveTo(cx, 86, x + cw / 2, 80, x + cw / 2, top); g.stroke();
          if (!RM) { const f = (t * 0.4 + i * 0.2) % 1; const u = 1 - f; const bx = u * u * u * cx + 3 * u * u * f * cx + 3 * u * f * f * (x + cw / 2) + f * f * f * (x + cw / 2); const by = u * u * u * 48 + 3 * u * u * f * 86 + 3 * u * f * f * 80 + f * f * f * top; g.beginPath(); g.arc(bx, by, 2.4, 0, 6.283); g.fillStyle = col; g.fill(); }
          g.fillStyle = hv ? rgba(col, 0.12) : 'rgba(20,20,20,0.9)'; g.strokeStyle = hv ? col : rgba(col, 0.55); g.lineWidth = hv ? 1.8 : 1.2;
          g.beginPath(); g.roundRect(x, top, cw, ch, 12); g.fill(); g.stroke();
          g.fillStyle = col; g.font = '700 19px Rajdhani, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(name.toUpperCase(), x + 14, top + 14);
          g.font = '14px Lora, Georgia, serif'; g.fillStyle = C.text2; wrap(desc, x + 14, top + 46, cw - 26, 20);
          g.font = MONO_S; g.fillStyle = C.muted; wrap(`e.g. ${ex}`, x + 14, top + ch - 62, cw - 26, 14);
          g.font = '600 13px Rajdhani, sans-serif'; g.fillStyle = hv ? C.text : col; g.fillText('OPEN CHAPTER ›', x + 14, top + ch - 26);
          hitBoxes.push({ x, y: top, w: cw, h: ch, id });
        });
        g.font = MONO_S; g.fillStyle = C.subtle; g.textAlign = 'center'; g.textBaseline = 'top';
        g.fillText('deep learning is a kind of model, used inside supervised, unsupervised and reinforcement learning. Generative models are mostly deep learning too.', cx, top + ch + 16);
      } else {
        const VW = 380; const VH = 452; fitVirtual(VW, VH);
        g.font = '700 18px Rajdhani, sans-serif'; g.fillStyle = C.text; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('MACHINE LEARNING', 0, 0);
        g.strokeStyle = C.borderStrong; g.lineWidth = 1; g.beginPath(); g.moveTo(8, 26); g.lineTo(8, 26 + 5 * 84 - 44); g.stroke();
        MAP.forEach(([id, name, desc], i) => {
          const y = 30 + i * 84; const x = 22; const w = VW - 22; const h = 76; const col = [C.c1, C.c3, C.c2, C.c5, C.c4][i]; const hv = hover === i;
          g.strokeStyle = C.borderStrong; g.beginPath(); g.moveTo(8, y + h / 2); g.lineTo(x, y + h / 2); g.stroke();
          g.fillStyle = hv ? rgba(col, 0.12) : 'rgba(20,20,20,0.9)'; g.strokeStyle = rgba(col, hv ? 1 : 0.55); g.lineWidth = 1.2;
          g.beginPath(); g.roundRect(x, y, w, h, 10); g.fill(); g.stroke();
          g.fillStyle = col; g.font = '700 16px Rajdhani, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(name.toUpperCase(), x + 12, y + 9);
          g.textAlign = 'right'; g.font = '600 12px Rajdhani, sans-serif'; g.fillText('OPEN ›', x + w - 12, y + 11);
          g.textAlign = 'left'; g.font = '13px Lora, Georgia, serif'; g.fillStyle = C.text2; wrap(desc, x + 12, y + 32, w - 24, 18);
          hitBoxes.push({ x, y, w, h, id });
        });
      }
      g.restore();
    }

    ctx.loop((t, dt) => {
      if (!W) return;
      g.clearRect(0, 0, W, H);
      if (view === 'sort') drawSort(dt);
      else if (view === 'pipe') drawPipe(t, dt);
      else drawMap(t);
    });
  },
};
