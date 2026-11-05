// Overfitting: polynomial fits of growing degree to noisy samples of a hidden curve.
// Train error keeps falling, test error falls then rises: the U shape.

const MONO = '500 11px "DM Mono", ui-monospace, monospace';
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function gauss() { let u = 0; let v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

const truth = (x) => 0.8 * Math.sin(2.2 * Math.PI * x + 0.4) + 0.2 * x;
const SIGMA = 0.22;
const MAXD = 15;

// Chebyshev basis on u = 2x - 1 keeps high degree fits numerically sane.
function basis(x, d) { const u = 2 * x - 1; const T = [1, u]; for (let k = 2; k <= d; k++) T.push(2 * u * T[k - 1] - T[k - 2]); return T.slice(0, d + 1); }
function solve(A, b) {
  const n = b.length; const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const v = M[c][c] || 1e-12;
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / v; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / (M[r][r] || 1e-12); }
  return x;
}
function fitPoly(pts, d, lam) {
  const m = d + 1; const A = Array.from({ length: m }, () => new Array(m).fill(0)); const b = new Array(m).fill(0);
  for (const p of pts) { const B = basis(p.x, d); for (let i = 0; i < m; i++) { b[i] += B[i] * p.y; for (let j = 0; j < m; j++) A[i][j] += B[i] * B[j]; } }
  // ridge penalty (scaled by n so it means the same thing for any sample size); never penalise the constant
  for (let i = 1; i < m; i++) A[i][i] += lam * pts.length;
  A[0][0] += 1e-12;
  return solve(A, b);
}
const evalPoly = (w, x) => { const B = basis(x, w.length - 1); let s = 0; for (let i = 0; i < w.length; i++) s += w[i] * B[i]; return s; };
const mse = (w, pts) => pts.reduce((s, p) => s + (evalPoly(w, p.x) - p.y) ** 2, 0) / pts.length;
function sample(n) { const pts = []; for (let i = 0; i < n; i++) { const x = (i + 0.15 + Math.random() * 0.7) / n; pts.push({ x, y: truth(x) + gauss() * SIGMA }); } return pts; }
function testSet() { const pts = []; for (let i = 0; i < 200; i++) { const x = (i + 0.5) / 200; pts.push({ x, y: truth(x) + gauss() * SIGMA }); } return pts; }

export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas();
    const g = cv.ctx;
    let deg = 3; let n = 14; let reg = false; let logLam = -3;
    let train = sample(n); const test = testSet();
    let showTest = false; let showTruth = true; let showGhosts = false;
    let curve = null; let ghosts = null; let ghostKey = '';
    let L = {};
    const lam = () => (reg ? 10 ** logLam : 1e-10);

    function recompute() {
      curve = [];
      for (let d = 1; d <= MAXD; d++) { const w = fitPoly(train, d, lam()); curve.push({ d, tr: mse(w, train), te: mse(w, test), w }); }
      syncText();
    }
    function ghostFits() {
      const key = `${deg}|${n}|${lam()}`;
      if (key === ghostKey && ghosts) return ghosts;
      ghostKey = key; ghosts = [];
      for (let i = 0; i < 14; i++) ghosts.push(fitPoly(sample(n), deg, lam()));
      return ghosts;
    }

    cv.onResize((W, H) => {
      const bottom = 56; const Hs = H - bottom; const top = Math.round(Hs * 0.6);
      L.m = { x: 38, y: 6, w: W - 50, h: top - 28 };
      L.e = { x: 38, y: top + 12, w: W - 50, h: Hs - top - 34 };
    });

    // ----- panel -----
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Overfitting</h2>'),
      ctx.h('<p class="lede">A model that memorises its training data can look perfect and still be useless on anything new. The skill is learning the pattern, not the noise.</p>'),
    );
    const degS = ctx.slider({ label: 'Polynomial degree (flexibility)', min: 1, max: MAXD, step: 1, value: deg, fmt: (v) => String(v), onInput: (v) => { deg = v; syncText(); } });
    const nS = ctx.slider({ label: 'Training points', min: 6, max: 60, step: 1, value: n, fmt: (v) => String(v), onInput: (v) => { n = v; train = sample(n); ghosts = null; recompute(); } });
    ctx.panel.append(degS, nS);
    const regRow = ctx.h('<label class="check"><input type="checkbox"> Regularisation (penalise big coefficients)</label>');
    const lamS = ctx.slider({ label: 'Penalty strength λ', min: -7, max: 0, step: 0.1, value: logLam, fmt: (v) => `10^${v.toFixed(1)}`, onInput: (v) => { logLam = v; recompute(); } });
    lamS.hidden = true;
    regRow.querySelector('input').onchange = (e) => { reg = e.target.checked; lamS.hidden = !reg; recompute(); };
    ctx.panel.append(regRow, lamS);
    const tg = ctx.h('<div class="row"><label class="check"><input type="checkbox" data-k="truth" checked> hidden truth</label><label class="check"><input type="checkbox" data-k="test"> test points</label><label class="check"><input type="checkbox" data-k="ghost"> 14 other samples</label></div>');
    tg.querySelectorAll('input').forEach((i) => { i.onchange = () => { const k = i.dataset.k; if (k === 'truth') showTruth = i.checked; if (k === 'test') showTest = i.checked; if (k === 'ghost') showGhosts = i.checked; }; });
    ctx.panel.append(tg);
    const stats = ctx.h('<div class="stat"><div><b data-s="tr">0</b><span>Train error</span></div><div><b data-s="te">0</b><span>Test error</span></div><div><b data-s="best">0</b><span>Best degree</span></div></div>');
    ctx.panel.append(stats);
    const verdict = ctx.h('<p class="small" style="min-height:3em"></p>');
    ctx.panel.append(verdict);
    const st = (k) => stats.querySelector(`[data-s="${k}"]`);

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>Somewhere there is a true pattern (the faint dashed curve), but we only ever see a few noisy samples of it (the white dots). We fit curves of growing flexibility: degree 1 is a straight line, degree 15 can wiggle fifteen ways.</p>
      <p>The <b>training error</b> only measures the dots the model has seen, so it keeps falling as the curve gets more flexible. The <b>test error</b> measures fresh dots it never saw. It falls at first, then climbs as the curve starts chasing noise. The bottom of that U is the sweet spot.</p>
    </div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li>Slide the degree from 1 to 15 and watch the two lines on the lower chart split apart.</li>
      <li>At degree 12 or more, press <b>New sample</b> a few times. The curve jumps wildly every time.</li>
      <li>Turn on <b>14 other samples</b>. At degree 1 the curves agree but are all wrong (bias). At degree 15 they disagree everywhere (variance).</li>
      <li>Fix the overfit two ways: raise <b>training points</b> to 60, or switch on <b>regularisation</b>.</li>
    </ol></div>`));
    ctx.panel.append(ctx.h(`<div class="card deep">
      <p>Test error splits into three parts:</p>
      <div class="formula">expected error = bias² + variance + noise<span>noise here is σ² = ${(SIGMA * SIGMA).toFixed(3)}, the dashed floor on the chart</span></div>
      <p><b>Bias</b> is being wrong on average, from a model too simple to bend the right way. <b>Variance</b> is being jumpy, giving a different answer for every sample of data. Flexible models trade bias for variance. Nothing can beat the noise floor.</p>
      <p><b>Ridge regularisation</b> adds λ·Σw² to the loss, so large wiggly coefficients cost extra. The model stays flexible but only bends when the data really insists. In practice you pick the degree or λ by holding back a <b>validation set</b> or using cross validation, never the test set, which stays untouched until the very end.</p>
      <p>Modern deep networks have far more parameters than data points and still generalise, partly thanks to implicit regularisation from how they are trained. This "double descent" behaviour is an active research topic. The U curve remains the right mental model for classic models.</p>
    </div>`));
    ctx.quiz([
      { q: 'A model has very low training error and high test error. What is going on?', choices: ['Underfitting', 'Overfitting: it learned the noise in its training data', 'The test set is broken'], answer: 1, why: 'It fits the dots it saw, including their random noise, and that noise does not repeat in new data.' },
      { q: 'Which of these usually reduces overfitting?', choices: ['A more flexible model', 'More training data, or regularisation', 'Measuring error on the training data only'], answer: 1, why: 'More data makes the noise average out. Regularisation penalises needless wiggles.' },
      { q: 'A straight line is fitted to a clearly curved pattern. Train and test error are both high. This is…', choices: ['High bias (underfitting)', 'High variance (overfitting)', 'Perfect fit'], answer: 0, why: 'The model is too simple to follow the pattern, so it is wrong everywhere in a consistent way.' },
    ]);

    // ----- dock -----
    const dock = ctx.h('<div class="dock"><div class="grp glass"><button data-a="new">New sample</button><button data-d="1">Degree 1</button><button data-d="4">Degree 4</button><button data-d="15">Degree 15</button></div></div>');
    ctx.stage.append(dock);
    dock.querySelector('[data-a="new"]').onclick = () => { train = sample(n); recompute(); };
    dock.querySelectorAll('[data-d]').forEach((b) => { b.onclick = () => { deg = +b.dataset.d; degS.value = deg; syncText(); }; });

    function syncText() {
      if (!curve) return;
      const c = curve[deg - 1]; const best = curve.reduce((a, b) => (b.te < a.te ? b : a));
      st('tr').textContent = c.tr.toFixed(3); st('te').textContent = c.te > 99 ? c.te.toExponential(0) : c.te.toFixed(3); st('best').textContent = best.d;
      let v;
      if (deg + 1 > n) v = `More coefficients (${deg + 1}) than training points (${n}): the curve can pass through every dot, and does. Pure memorising.`;
      else if (deg < best.d - 1 && c.te > best.te * 1.25) v = 'Underfitting: too stiff to follow the pattern. Both errors are high.';
      else if (c.te > best.te * 1.4 && deg > best.d) v = `Overfitting: train error is ${c.tr.toFixed(3)} but test error is ${c.te > 99 ? 'huge' : c.te.toFixed(3)}. It is chasing noise.`;
      else v = 'About right: test error is close to its lowest. The curve follows the pattern, not the noise.';
      verdict.textContent = v;
    }
    recompute();

    // ----- draw -----
    ctx.loop(() => {
      const { w: W, h: H } = cv; g.clearRect(0, 0, W, H);
      if (!L.m || !curve) return;
      const M = L.m; const Y0 = -1.6; const Y1 = 1.7;
      const mx = (x) => M.x + x * M.w; const my = (y) => M.y + M.h - (y - Y0) / (Y1 - Y0) * M.h;
      g.strokeStyle = C.borderStrong; g.lineWidth = 1; g.beginPath(); g.moveTo(M.x, M.y); g.lineTo(M.x, M.y + M.h); g.lineTo(M.x + M.w, M.y + M.h); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.05)'; g.beginPath(); g.moveTo(M.x, my(0)); g.lineTo(M.x + M.w, my(0)); g.stroke();
      g.save(); g.beginPath(); g.rect(M.x, M.y, M.w, M.h); g.clip();
      const line = (f, col, lw, dash) => {
        g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash || []); g.beginPath();
        const steps = Math.max(120, Math.round(M.w / 2));
        for (let i = 0; i <= steps; i++) { const x = i / steps; const y = Math.max(-6, Math.min(6, f(x))); if (i) g.lineTo(mx(x), my(y)); else g.moveTo(mx(x), my(y)); }
        g.stroke(); g.setLineDash([]);
      };
      if (showTest) { g.fillStyle = rgba(C.c5, 0.45); for (const p of test) { g.beginPath(); g.arc(mx(p.x), my(p.y), 2.2, 0, 6.283); g.fill(); } }
      if (showGhosts) for (const w of ghostFits()) line((x) => evalPoly(w, x), rgba(C.c3, 0.4), 1.2);
      if (showTruth) line(truth, 'rgba(245,245,240,0.45)', 1.5, [5, 6]);
      const w = curve[deg - 1].w;
      line((x) => evalPoly(w, x), rgba(C.c2, 0.25), 7);
      line((x) => evalPoly(w, x), C.c2, 2.2);
      g.restore();
      for (const p of train) { g.beginPath(); g.arc(mx(p.x), my(p.y), 4.5, 0, 6.283); g.fillStyle = C.text; g.fill(); g.lineWidth = 2; g.strokeStyle = C.bg; g.stroke(); }
      g.font = MONO; g.textAlign = 'left'; g.textBaseline = 'top';
      let lx = M.x + 8;
      const tag = (txt, col) => { g.fillStyle = col; g.fillText(txt, lx, M.y + 4); lx += g.measureText(txt).width + 16; };
      tag(`degree ${deg} fit`, C.c2); tag('training dots', C.text);
      if (showTruth) tag('truth', C.muted);
      if (showTest && M.w > 420) tag('test dots', C.c5);
      if (showGhosts && M.w > 520) tag('other samples', C.c3);

      // --- error chart ---
      const E = L.e; if (E.h < 30) return;
      const lo = Math.log10(0.002); const hi = Math.max(lo + 1, Math.min(2, Math.log10(Math.max(...curve.map((c) => c.te))) + 0.1));
      const ex = (d) => E.x + (d - 1) / (MAXD - 1) * E.w;
      const ey = (v) => E.y + E.h - (Math.max(lo, Math.min(hi, Math.log10(Math.max(v, 1e-9)))) - lo) / (hi - lo) * E.h;
      g.strokeStyle = C.borderStrong; g.lineWidth = 1; g.beginPath(); g.moveTo(E.x, E.y); g.lineTo(E.x, E.y + E.h); g.lineTo(E.x + E.w, E.y + E.h); g.stroke();
      // current degree marker
      g.fillStyle = 'rgba(251,191,36,0.08)'; g.fillRect(ex(deg) - 9, E.y, 18, E.h);
      g.setLineDash([4, 5]); g.strokeStyle = 'rgba(245,245,240,0.3)'; g.beginPath(); g.moveTo(E.x, ey(SIGMA * SIGMA)); g.lineTo(E.x + E.w, ey(SIGMA * SIGMA)); g.stroke(); g.setLineDash([]);
      const plot = (key, col) => {
        g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
        curve.forEach((c, i) => { if (i) g.lineTo(ex(c.d), ey(c[key])); else g.moveTo(ex(c.d), ey(c[key])); }); g.stroke();
        for (const c of curve) { g.beginPath(); g.arc(ex(c.d), ey(c[key]), c.d === deg ? 5 : 2.5, 0, 6.283); g.fillStyle = col; g.fill(); }
      };
      plot('tr', C.c1); plot('te', C.c4);
      g.font = MONO; g.textBaseline = 'top'; g.textAlign = 'center'; g.fillStyle = C.muted;
      for (let d = 1; d <= MAXD; d += (E.w < 360 ? 2 : 1)) g.fillText(String(d), ex(d), E.y + E.h + 5);
      g.textAlign = 'left'; g.fillStyle = C.c1; g.fillText('train error', E.x + 8, E.y + 2);
      g.fillStyle = C.c4; g.fillText('test error', E.x + 100, E.y + 2);
      g.fillStyle = C.muted; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText('noise floor', E.x + E.w, ey(SIGMA * SIGMA) - 3);
      g.save(); g.translate(E.x - 10, E.y + E.h); g.rotate(-Math.PI / 2); g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText('error (log)', 0, 0); g.restore();
    });
  },
};
