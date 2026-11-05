// Drawing a boundary: logistic regression trained live by gradient descent.

const MONO = '500 11px "DM Mono", ui-monospace, monospace';
function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(hex, a) { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; }
const sig = (z) => 1 / (1 + Math.exp(-z));
function gauss() { let u = 0; let v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function preset(kind) {
  const pts = [];
  if (kind === 'ring') {
    for (let i = 0; i < 18; i++) { const a = Math.random() * 6.283; const r = Math.random() * 0.33; pts.push({ x: r * Math.cos(a), y: r * Math.sin(a), c: 1 }); }
    for (let i = 0; i < 24; i++) { const a = Math.random() * 6.283; const r = 0.6 + Math.random() * 0.25; pts.push({ x: r * Math.cos(a), y: r * Math.sin(a), c: 0 }); }
    return pts;
  }
  const s = kind === 'overlap' ? 0.3 : 0.17;
  for (let i = 0; i < 16; i++) pts.push({ x: clamp(0.38 + gauss() * s, -0.95, 0.95), y: clamp(0.3 + gauss() * s, -0.95, 0.95), c: 1 });
  for (let i = 0; i < 16; i++) pts.push({ x: clamp(-0.38 + gauss() * s, -0.95, 0.95), y: clamp(-0.32 + gauss() * s, -0.95, 0.95), c: 0 });
  return pts;
}

export default {
  mount(ctx) {
    const C = ctx.colors;
    const A = C.c1; const B = C.c4; // class 1 teal, class 0 rose
    const cv = ctx.canvas({ style: 'touch-action:none;cursor:crosshair' });
    const g = cv.ctx;
    let pts = preset('easy');
    let curved = false; let w = [0, 0, 0, 0, 0]; let bias = 0; let epochs = 0;
    let playing = true; let thr = 0.5; let addClass = 1;
    let drag = null; let outside = false;
    let P = { x0: 0, y0: 0, s: 1 };
    const GRID = 72; const shade = document.createElement('canvas'); shade.width = GRID; shade.height = GRID;
    const sg = shade.getContext('2d'); const simg = sg.createImageData(GRID, GRID);

    cv.onResize((W, H) => {
      const pad = 14; const bottom = 58;
      const s = Math.max(20, Math.min(W - pad * 2, H - pad - bottom) / 2);
      P = { cx: W / 2, cy: pad + s, s };
    });
    const sx = (x) => P.cx + x * P.s; const sy = (y) => P.cy - y * P.s;
    const ix = (px) => (px - P.cx) / P.s; const iy = (py) => (P.cy - py) / P.s;

    const feats = (x, y) => (curved ? [x, y, x * x, y * y, x * y] : [x, y, 0, 0, 0]);
    const score = (x, y) => { const f = feats(x, y); let z = bias; for (let i = 0; i < 5; i++) z += w[i] * f[i]; return z; };
    const prob = (x, y) => sig(score(x, y));

    function train(iters) {
      if (!pts.length) return;
      const lr = 1.2; const l2 = 0.002;
      for (let it = 0; it < iters; it++) {
        const gw = [0, 0, 0, 0, 0]; let gb = 0;
        for (const p of pts) {
          const f = feats(p.x, p.y); const e = sig(score(p.x, p.y)) - p.c;
          for (let i = 0; i < 5; i++) gw[i] += e * f[i];
          gb += e;
        }
        for (let i = 0; i < 5; i++) w[i] -= lr * (gw[i] / pts.length + l2 * w[i]);
        bias -= lr * gb / pts.length;
        epochs++;
      }
    }
    function resetW() { w = [0, 0, 0, 0, 0]; bias = 0; epochs = 0; }

    // ----- panel -----
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Drawing a boundary</h2>'),
      ctx.h('<p class="lede">Classification means sorting things into groups: spam or not, tumour or not, cat or dog. Logistic regression does it by learning a boundary and giving every point a probability.</p>'),
    );
    const addSeg = ctx.seg([['1', 'Tap adds teal'], ['0', 'Tap adds rose']], '1', (v) => { addClass = +v; });
    const featSeg = ctx.seg([['0', 'Straight boundary'], ['1', 'Curved (x², y², xy)']], '0', (v) => { curved = v === '1'; resetW(); playing = true; syncPlay(); });
    ctx.panel.append(addSeg, featSeg);
    const thrS = ctx.slider({ label: 'Decision threshold', min: 0.02, max: 0.98, step: 0.01, value: 0.5, fmt: (v) => v.toFixed(2), onInput: (v) => { thr = v; } });
    ctx.panel.append(thrS);
    const sigWrap = ctx.h('<div style="position:relative;height:150px;border:1px solid var(--border);border-radius:10px;background:rgba(10,10,10,.45)"></div>');
    ctx.panel.append(sigWrap);
    const sc = ctx.canvas({ parent: sigWrap });
    const stats = ctx.h('<div class="stat"><div><b data-s="acc">0</b><span>Accuracy</span></div><div><b data-s="loss">0</b><span>Log loss</span></div><div><b data-s="ep">0</b><span>Steps</span></div></div>');
    ctx.panel.append(stats);
    const eq = ctx.h('<div class="formula" style="font-size:12.5px"></div>');
    ctx.panel.append(eq);
    const st = (k) => stats.querySelector(`[data-s="${k}"]`);

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>The model gives every spot on the plane a score: a weighted sum of its coordinates. A big positive score means "surely teal", a big negative one means "surely rose".</p>
      <p>The <b>sigmoid</b> curve (the S shape above) squashes any score into a probability between 0 and 1. The background colour shows that probability everywhere. Finally, a <b>threshold</b> turns the probability into a decision: above it, say teal.</p>
      <p>Training nudges the weights with gradient descent until the probabilities match the labels as well as they can.</p>
    </div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li>Drag a rose dot deep into teal territory. The boundary turns to accommodate it, and the dot gets a white ring while it is still on the wrong side.</li>
      <li>Move the threshold. The line slides, even though the model did not change. Low threshold: say teal more often.</li>
      <li>Press <b>Ring</b>. A straight boundary cannot separate a circle. Switch on <b>Curved</b> and watch it succeed with the very same algorithm.</li>
    </ol></div>`));
    ctx.panel.append(ctx.h(`<div class="card deep">
      <div class="formula">z = w₁x + w₂y + b<span>p = σ(z) = 1 / (1 + e⁻ᶻ)</span></div>
      <p>Training minimises the <b>log loss</b> (cross entropy): for each point, −log of the probability the model gave to its true class. Being confidently wrong is punished hard: giving the true class 1% costs 4.6, giving it 50% costs 0.69.</p>
      <div class="formula">∂loss/∂wᵢ = (p − label) · featureᵢ<span>averaged over the points, then w ← w − η · gradient</span></div>
      <p>The boundary is always where z equals a constant, so with plain x and y it is a straight line. Adding x², y² and xy as extra inputs lets the same linear method draw ellipses. That trick, building richer features, is what neural networks automate.</p>
      <p>A small penalty on weight size (L2 regularisation) is applied here. Without it, perfectly separable data makes the weights grow forever as the model gets ever more certain.</p>
    </div>`));
    ctx.quiz([
      { q: 'What does the sigmoid function do?', choices: ['Sorts the points by size', 'Squashes any score into a probability between 0 and 1', 'Picks the threshold'], answer: 1, why: 'Large positive scores go toward 1, large negative ones toward 0, and a score of 0 gives exactly 0.5.' },
      { q: 'You lower the threshold from 0.5 to 0.2. What happens?', choices: ['The model retrains', 'More points get called teal, because a smaller probability is enough', 'Fewer points get called teal'], answer: 1, why: 'The probabilities do not change. You just need less evidence before saying yes.' },
      { q: 'Teal dots sit inside a ring of rose dots. Why does plain logistic regression fail?', choices: ['It needs more training steps', 'Its boundary with x and y alone is a straight line, and no line separates a circle', 'There are too few dots'], answer: 1, why: 'Give it x² and y² as extra inputs and the boundary can curve into a circle.' },
    ]);

    // ----- dock -----
    const dock = ctx.h('<div class="dock"><div class="grp glass"><button data-a="play" class="on">Pause</button><button data-a="reset">Reset</button></div><div class="grp glass"><button data-p="easy">Easy</button><button data-p="overlap">Overlap</button><button data-p="ring">Ring</button><button data-p="clear">Clear</button></div></div>');
    ctx.stage.append(dock);
    const playBtn = dock.querySelector('[data-a="play"]');
    const syncPlay = () => { playBtn.textContent = playing ? 'Pause' : 'Train'; playBtn.classList.toggle('on', playing); };
    playBtn.onclick = () => { playing = !playing; syncPlay(); };
    dock.querySelector('[data-a="reset"]').onclick = () => { resetW(); playing = true; syncPlay(); };
    dock.querySelectorAll('[data-p]').forEach((b) => { b.onclick = () => { pts = b.dataset.p === 'clear' ? [] : preset(b.dataset.p); resetW(); playing = true; syncPlay(); }; });

    // ----- pointer -----
    const pos = (e) => { const r = cv.el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    function nearest(px, py, rad) { let bi = -1; let bd = rad * rad; pts.forEach((p, i) => { const d = (sx(p.x) - px) ** 2 + (sy(p.y) - py) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; }
    cv.el.addEventListener('pointerdown', (e) => {
      const [px, py] = pos(e);
      let i = nearest(px, py, e.pointerType === 'touch' ? 24 : 14);
      if (i < 0) {
        const x = ix(px); const y = iy(py);
        if (Math.abs(x) > 1 || Math.abs(y) > 1 || pts.length > 120) return;
        pts.push({ x, y, c: addClass }); i = pts.length - 1;
      }
      drag = i; outside = false; playing = true; syncPlay();
      cv.el.setPointerCapture(e.pointerId);
    }, { signal: ctx.signal });
    cv.el.addEventListener('pointermove', (e) => {
      if (drag == null) return;
      const [px, py] = pos(e); const x = ix(px); const y = iy(py);
      outside = Math.abs(x) > 1.08 || Math.abs(y) > 1.08;
      pts[drag].x = clamp(x, -1.1, 1.1); pts[drag].y = clamp(y, -1.1, 1.1);
    }, { signal: ctx.signal });
    const up = () => { if (drag != null && outside) pts.splice(drag, 1); drag = null; outside = false; };
    cv.el.addEventListener('pointerup', up, { signal: ctx.signal });
    cv.el.addEventListener('pointercancel', up, { signal: ctx.signal });

    // marching squares for the p = level curve, on a coarse grid
    function contour(level, n) {
      const val = []; const step = 2 / n;
      for (let j = 0; j <= n; j++) { val.push([]); for (let i = 0; i <= n; i++) val[j].push(prob(-1 + i * step, -1 + j * step) - level); }
      const segs = [];
      const lerp = (a, b, va, vb) => a + (b - a) * (va / (va - vb));
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x0 = -1 + i * step; const y0 = -1 + j * step; const x1 = x0 + step; const y1 = y0 + step;
        const a = val[j][i]; const b = val[j][i + 1]; const c = val[j + 1][i + 1]; const d = val[j + 1][i];
        const e = [];
        if ((a > 0) !== (b > 0)) e.push([lerp(x0, x1, a, b), y0]);
        if ((b > 0) !== (c > 0)) e.push([x1, lerp(y0, y1, b, c)]);
        if ((c > 0) !== (d > 0)) e.push([lerp(x1, x0, c, d), y1]);
        if ((d > 0) !== (a > 0)) e.push([x0, lerp(y1, y0, d, a)]);
        if (e.length === 2) segs.push(e);
        else if (e.length === 4) { segs.push([e[0], e[1]], [e[2], e[3]]); }
      }
      return segs;
    }
    const strokeSegs = (segs) => { g.beginPath(); for (const [p, q] of segs) { g.moveTo(sx(p[0]), sy(p[1])); g.lineTo(sx(q[0]), sy(q[1])); } g.stroke(); };

    const cA = rgb(A); const cB = rgb(B);
    let lastS = '';
    ctx.loop(() => {
      if (playing) train(6);
      const { w: W, h: H } = cv; g.clearRect(0, 0, W, H);
      // probability shading
      const d = simg.data;
      for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
        const p = prob(-1 + (i + 0.5) / GRID * 2, 1 - (j + 0.5) / GRID * 2);
        const k = (j * GRID + i) * 4; const conf = Math.abs(p - 0.5) * 2;
        d[k] = cB[0] + (cA[0] - cB[0]) * p; d[k + 1] = cB[1] + (cA[1] - cB[1]) * p; d[k + 2] = cB[2] + (cA[2] - cB[2]) * p;
        d[k + 3] = 30 + conf * 70;
      }
      sg.putImageData(simg, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(shade, sx(-1), sy(1), P.s * 2, P.s * 2);
      g.strokeStyle = C.borderStrong; g.lineWidth = 1; g.strokeRect(sx(-1) + 0.5, sy(1) + 0.5, P.s * 2 - 1, P.s * 2 - 1);
      // faint grid
      g.strokeStyle = 'rgba(255,255,255,0.05)';
      for (let k = -0.5; k <= 0.5; k += 0.5) { g.beginPath(); g.moveTo(sx(k), sy(1)); g.lineTo(sx(k), sy(-1)); g.moveTo(sx(-1), sy(k)); g.lineTo(sx(1), sy(k)); g.stroke(); }

      // contours
      g.save(); g.beginPath(); g.rect(sx(-1), sy(1), P.s * 2, P.s * 2); g.clip();
      if (epochs > 0) {
        g.setLineDash([3, 5]); g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,0.28)';
        strokeSegs(contour(0.1, 48)); strokeSegs(contour(0.9, 48));
        g.setLineDash([]); g.lineWidth = 2.2; g.strokeStyle = C.text;
        strokeSegs(contour(thr, 64));
      }
      g.restore();

      // points
      let correct = 0; let ll = 0;
      for (const p of pts) {
        const pr = prob(p.x, p.y); const pred = pr >= thr ? 1 : 0;
        if (pred === p.c) correct++;
        ll += -Math.log(Math.max(1e-9, p.c ? pr : 1 - pr));
        const X = sx(p.x); const Y = sy(p.y);
        if (pred !== p.c) { g.beginPath(); g.arc(X, Y, 10, 0, 6.283); g.strokeStyle = C.text; g.lineWidth = 1.5; g.stroke(); }
        g.beginPath(); g.arc(X, Y, 6, 0, 6.283); g.fillStyle = p.c ? A : B; g.fill();
        g.lineWidth = 2; g.strokeStyle = C.bg; g.stroke();
      }
      if (drag != null && outside) {
        g.font = MONO; g.fillStyle = B; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText('release to delete', P.cx, sy(1) + 8);
      }
      if (!pts.length) { g.font = MONO; g.fillStyle = C.muted; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('tap to add dots of each colour', P.cx, P.cy); }
      // corner labels
      g.font = MONO; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillStyle = C.text2; g.fillText(`white line: p = ${thr.toFixed(2)}`, sx(-1) + 8, sy(1) + 8);
      g.fillStyle = C.muted; g.fillText('dashed: p = 0.1 and 0.9', sx(-1) + 8, sy(1) + 24);

      drawSigmoid();

      const acc = pts.length ? correct / pts.length : 0;
      const s = `${(acc * 100).toFixed(0)}|${(ll / Math.max(1, pts.length)).toFixed(3)}|${Math.floor(epochs / 30)}|${w.map((v) => v.toFixed(1)).join()}|${bias.toFixed(1)}`;
      if (s !== lastS) {
        lastS = s;
        st('acc').textContent = pts.length ? `${(acc * 100).toFixed(0)}%` : '-';
        st('loss').textContent = pts.length ? (ll / pts.length).toFixed(3) : '-';
        st('ep').textContent = epochs;
        const t = (v, name, first) => `${v < 0 ? (first ? '−' : ' − ') : (first ? '' : ' + ')}${Math.abs(v).toFixed(1)}${name}`;
        let z = `${t(w[0], 'x', true)}${t(w[1], 'y')}`;
        if (curved) z += `${t(w[2], 'x²')}${t(w[3], 'y²')}${t(w[4], 'xy')}`;
        z += `${t(bias, '')}`;
        eq.innerHTML = `score z = ${z}<span>p(teal) = σ(z). Say teal when p ≥ ${thr.toFixed(2)}.</span>`;
      }
    });

    function drawSigmoid() {
      const q = sc.ctx; const W = sc.w; const H = sc.h; if (!W) return;
      q.clearRect(0, 0, W, H);
      const L = 30; const R = W - 12; const T = 14; const Bt = H - 22;
      const zx = (z) => L + (clamp(z, -8, 8) + 8) / 16 * (R - L); const py = (p) => Bt - p * (Bt - T);
      q.strokeStyle = C.borderStrong; q.lineWidth = 1;
      q.beginPath(); q.moveTo(L, T); q.lineTo(L, Bt); q.lineTo(R, Bt); q.stroke();
      q.font = MONO; q.fillStyle = C.muted; q.textAlign = 'right'; q.textBaseline = 'middle';
      q.fillText('1', L - 6, py(1)); q.fillText('0', L - 6, py(0));
      q.textAlign = 'right'; q.textBaseline = 'top'; q.fillText('score z', R, Bt + 5); q.textAlign = 'center';
      q.fillText('0', zx(0), Bt + 5);
      // curve
      q.strokeStyle = C.text; q.lineWidth = 2; q.beginPath();
      for (let i = 0; i <= 100; i++) { const z = -8 + i * 0.16; const X = zx(z); const Y = py(sig(z)); if (i) q.lineTo(X, Y); else q.moveTo(X, Y); }
      q.stroke();
      // threshold
      const zt = Math.log(thr / (1 - thr));
      q.setLineDash([4, 4]); q.strokeStyle = rgba(C.c2, 0.8); q.lineWidth = 1;
      q.beginPath(); q.moveTo(L, py(thr)); q.lineTo(R, py(thr)); q.moveTo(zx(zt), T); q.lineTo(zx(zt), Bt); q.stroke(); q.setLineDash([]);
      q.fillStyle = C.c2; q.textAlign = 'left'; q.textBaseline = 'bottom'; q.fillText(`threshold ${thr.toFixed(2)}`, L + 4, py(thr) - 2);
      // points at their score, sitting at their true label
      for (const [i, p] of pts.entries()) {
        const z = score(p.x, p.y); const j = ((i * 37) % 9 - 4) * 0.9;
        q.beginPath(); q.arc(zx(z), py(p.c) + (p.c ? 6 : -6) + j * 0.4, 3.2, 0, 6.283); q.fillStyle = rgba(p.c ? A : B, 0.9); q.fill();
      }
    }
  },
};
