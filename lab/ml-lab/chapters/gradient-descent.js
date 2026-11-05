// Gradient descent: a ball rolls downhill on the real loss surface of a line fit.
// The surface is the mean squared error for every (slope, intercept) pair on a small fixed dataset.

const MONO = '500 11px "DM Mono", ui-monospace, monospace';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Fixed dataset: x from 0 to 3, roughly y = 1.2x - 0.8 with some noise.
const XS = [0, 0.43, 0.86, 1.29, 1.71, 2.14, 2.57, 3];
const NOISE = [0.35, -0.42, 0.18, 0.5, -0.31, -0.2, 0.44, -0.27];
const DATA = XS.map((x, i) => ({ x, y: 1.2 * x - 0.8 + NOISE[i] }));
const N = DATA.length;
const S = DATA.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y, xx: a.xx + p.x * p.x, xy: a.xy + p.x * p.y, yy: a.yy + p.y * p.y }), { x: 0, y: 0, xx: 0, xy: 0, yy: 0 });
const loss = (m, b) => (S.yy - 2 * m * S.xy - 2 * b * S.y + m * m * S.xx + 2 * m * b * S.x + N * b * b) / N;
const grad = (m, b) => [2 * (m * S.xx + b * S.x - S.xy) / N, 2 * (m * S.x + b * N - S.y) / N];
// Best fit (closed form) and the largest curvature, which sets the speed limit for the learning rate.
const DET = N * S.xx - S.x * S.x;
const OPT = { m: (N * S.xy - S.x * S.y) / DET, b: (S.xx * S.y - S.x * S.xy) / DET };
const h11 = 2 * S.xx / N; const h12 = 2 * S.x / N; const h22 = 2;
const LMAX = (h11 + h22) / 2 + Math.sqrt(((h11 - h22) / 2) ** 2 + h12 * h12);
const LR_LIMIT = 2 / LMAX;
const LOSS_MIN = loss(OPT.m, OPT.b);

// View window of the parameter plane
const MR = [OPT.m - 2.6, OPT.m + 2.6];
const BR = [OPT.b - 3.6, OPT.b + 3.6];
const START = { m: OPT.m - 2.1, b: OPT.b + 2.9 };

export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas({ style: 'touch-action:none' });
    const g = cv.ctx;
    let lr = +(LR_LIMIT * 0.75).toFixed(3);
    let pos = { ...START };
    let path = [{ ...START }];
    let shown = { ...START };
    let playing = false; let acc = 0; let steps = 0; let last = null; let diverged = false;
    let L = {}; // layout
    let heat = null; // offscreen heatmap canvas

    // ----- layout -----
    cv.onResize((w, h) => {
      const bottom = 58; const gap = 14; const H = h - bottom;
      if (w > H * 1.15) {
        const cs = Math.min(w * 0.62, H);
        L.c = { x: 34, y: 4, w: cs - 34, h: H - 30 };
        const rx = cs + gap; const rw = w - rx;
        const half = (H - gap) / 2;
        L.d = { x: rx + 28, y: 4, w: rw - 34, h: half - 26 };
        L.l = { x: rx + 28, y: half + gap + 4, w: rw - 34, h: half - 30 };
      } else {
        const ch = Math.round(H * 0.6);
        L.c = { x: 34, y: 4, w: w - 40, h: ch - 30 };
        const bw = (w - gap) / 2; const by = ch + 8; const bh = H - by - 22;
        L.d = { x: 26, y: by, w: bw - 30, h: bh };
        L.l = { x: bw + gap + 26, y: by, w: bw - 30, h: bh };
      }
      buildHeat();
    });
    const cm = (m) => L.c.x + (m - MR[0]) / (MR[1] - MR[0]) * L.c.w;
    const cb = (b) => L.c.y + L.c.h - (b - BR[0]) / (BR[1] - BR[0]) * L.c.h;
    const icm = (px) => MR[0] + (px - L.c.x) / L.c.w * (MR[1] - MR[0]);
    const icb = (py) => BR[0] + (L.c.y + L.c.h - py) / L.c.h * (BR[1] - BR[0]);

    function buildHeat() {
      const dpr = cv.dpr; const W = Math.max(2, Math.round(L.c.w * dpr / 2)); const H = Math.max(2, Math.round(L.c.h * dpr / 2));
      heat = document.createElement('canvas'); heat.width = W; heat.height = H;
      const hg = heat.getContext('2d'); const img = hg.createImageData(W, H); const d = img.data;
      const lo = Math.log(LOSS_MIN); const hi = Math.log(Math.max(loss(MR[0], BR[0]), loss(MR[0], BR[1]), loss(MR[1], BR[0]), loss(MR[1], BR[1])));
      const stops = [[0, 18, 92, 86], [0.3, 16, 52, 64], [0.65, 38, 30, 66], [1, 62, 26, 58]];
      for (let j = 0; j < H; j++) {
        const b = BR[1] - (j + 0.5) / H * (BR[1] - BR[0]);
        for (let i = 0; i < W; i++) {
          const m = MR[0] + (i + 0.5) / W * (MR[1] - MR[0]);
          const v = Math.max(0, Math.min(1, (Math.log(loss(m, b)) - lo) / (hi - lo)));
          let s = 1; while (s < stops.length - 1 && stops[s][0] < v) s++;
          const A = stops[s - 1]; const B = stops[s]; const f = (v - A[0]) / (B[0] - A[0]);
          const k = (j * W + i) * 4;
          d[k] = A[1] + (B[1] - A[1]) * f; d[k + 1] = A[2] + (B[2] - A[2]) * f; d[k + 2] = A[3] + (B[3] - A[3]) * f; d[k + 3] = 255;
        }
      }
      hg.putImageData(img, 0, 0);
    }
    // Contour lines: the loss is an exact quadratic bowl, so every level set is an ellipse around the minimum.
    const EIG = (() => {
      const tr = h11 + h22; const dt = Math.sqrt(((h11 - h22) / 2) ** 2 + h12 * h12);
      const l1 = tr / 2 + dt; const l2 = tr / 2 - dt;
      const v1 = Math.abs(h12) > 1e-12 ? [l1 - h22, h12] : [1, 0]; const n1 = Math.hypot(...v1);
      return { l1, l2, v1: [v1[0] / n1, v1[1] / n1], v2: [-v1[1] / n1, v1[0] / n1] };
    })();
    function contours() {
      g.lineWidth = 1;
      for (let k = 0; k < 16; k++) {
        const dl = 0.04 * 1.75 ** k;
        const a = Math.sqrt(2 * dl / EIG.l1); const c = Math.sqrt(2 * dl / EIG.l2);
        g.strokeStyle = `rgba(255,255,255,${0.16 - k * 0.006})`;
        g.beginPath();
        for (let i = 0; i <= 96; i++) {
          const t = i / 96 * Math.PI * 2;
          const m = OPT.m + a * Math.cos(t) * EIG.v1[0] + c * Math.sin(t) * EIG.v2[0];
          const b = OPT.b + a * Math.cos(t) * EIG.v1[1] + c * Math.sin(t) * EIG.v2[1];
          if (i) g.lineTo(cm(m), cb(b)); else g.moveTo(cm(m), cb(b));
        }
        g.stroke();
      }
    }

    // ----- panel -----
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Gradient descent</h2>'),
      ctx.h('<p class="lede">Most models cannot solve for their best settings with a formula. Instead they feel which way is downhill on the error and take a small step. Then they do it again, thousands of times.</p>'),
    );
    const lrS = ctx.slider({ label: 'Learning rate (step size)', min: Math.log(0.002), max: Math.log(LR_LIMIT * 1.35), step: 0.001, value: Math.log(lr), fmt: (v) => Math.exp(v).toFixed(3), onInput: (v) => { lr = Math.exp(v); } });
    ctx.panel.append(lrS);
    const presets = ctx.h('<div class="row"><button class="chip" data-f="0.04">Too small</button><button class="chip on" data-f="0.75">Good</button><button class="chip" data-f="1.12">Too big</button></div>');
    presets.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      presets.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      lr = LR_LIMIT * +b.dataset.f; lrS.value = Math.log(lr); reset(); playing = true; syncPlay();
    }));
    ctx.panel.append(presets);
    ctx.panel.append(ctx.h(`<p class="hint">On this data, any learning rate above ${LR_LIMIT.toFixed(3)} makes the ball overshoot further each step and fly off.</p>`));
    const rule = ctx.h('<div class="formula"></div>');
    ctx.panel.append(rule);
    const stats = ctx.h('<div class="stat"><div><b data-s="step">0</b><span>Steps</span></div><div><b data-s="loss">0</b><span>Loss (MSE)</span></div><div><b data-s="best">0</b><span>Lowest possible</span></div></div>');
    ctx.panel.append(stats);
    const st = (k) => stats.querySelector(`[data-s="${k}"]`);
    st('best').textContent = LOSS_MIN.toFixed(3);

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>The big map shows every possible line at once. Left to right is the slope, bottom to top is the intercept, and the colour is how wrong that line is (its mean squared error). Dark teal is good. The model wants to reach the darkest spot, marked with a ring.</p>
      <p>It cannot see the whole map. It only knows the slope of the ground right under the ball, called the <b>gradient</b>. So it steps the opposite way, downhill, by an amount set by the <b>learning rate</b>. Too small and it crawls. Too big and it jumps over the valley and lands higher up the other side, again and again.</p>
    </div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li>Press <b>Play</b>. Watch the line on the small plot tilt into place as the ball rolls.</li>
      <li>Pick <b>Too small</b>: still crawling after a hundred steps.</li>
      <li>Pick <b>Too big</b>: the ball zigzags across the valley and the loss explodes.</li>
      <li>Tap anywhere on the map to drop the ball somewhere new.</li>
    </ol></div>`));
    ctx.panel.append(ctx.h(`<div class="card deep">
      <p>The update rule, for every parameter at once:</p>
      <div class="formula">θ ← θ − η · ∇L(θ)<span>θ = (m, b), η = learning rate, ∇L = gradient of the loss</span></div>
      <p>For mean squared error on a line, the gradient is</p>
      <div class="formula">∂L/∂m = (2/n) Σ (ŷᵢ − yᵢ)·xᵢ<span>∂L/∂b = (2/n) Σ (ŷᵢ − yᵢ)</span></div>
      <p>The valley here is a long thin bowl because the slope and intercept affect the error in related ways. Steps that are safe across the steep direction are tiny along the shallow one, which is why the path curves. For a bowl like this, descent diverges once η exceeds 2 divided by the largest curvature. That is the ${LR_LIMIT.toFixed(3)} quoted above, computed from this data.</p>
      <p>Real training uses <b>stochastic</b> gradient descent (the gradient from a small random batch of data, not all of it) plus tricks such as momentum and Adam that adapt the step size. The idea is the same.</p>
    </div>`));
    ctx.quiz([
      { q: 'What does the gradient tell the model?', choices: ['Which direction makes the loss go up fastest, so it steps the other way', 'The exact location of the best answer', 'How many steps are left'], answer: 0, why: 'The gradient points uphill. Gradient descent steps against it, downhill, a little at a time.' },
      { q: 'The loss bounces higher every step and shoots off. What should you change?', choices: ['Raise the learning rate', 'Lower the learning rate', 'Add more steps'], answer: 1, why: 'Each step overshoots the valley by more than the last. Smaller steps fix it.' },
      { q: 'Why not always use a tiny learning rate to be safe?', choices: ['It gives a worse final answer', 'It can take a very long time to reach the bottom', 'Tiny steps go uphill'], answer: 1, why: 'Tiny steps are safe but slow. Training large models costs real time and money, so picking the step size well matters.' },
    ]);

    // ----- dock -----
    const dock = ctx.h('<div class="dock"><div class="grp glass"><button data-a="play">Play</button><button data-a="step">Step</button><button data-a="reset">Reset</button></div></div>');
    ctx.stage.append(dock);
    const playBtn = dock.querySelector('[data-a="play"]');
    const syncPlay = () => { playBtn.textContent = playing ? 'Pause' : 'Play'; playBtn.classList.toggle('on', playing); };
    dock.querySelector('[data-a="play"]').onclick = () => { if (diverged || steps > 400) reset(); playing = !playing; syncPlay(); };
    dock.querySelector('[data-a="step"]').onclick = () => { playing = false; syncPlay(); step(); };
    dock.querySelector('[data-a="reset"]').onclick = () => { playing = false; syncPlay(); reset(); };

    function reset(at) {
      pos = at ? { ...at } : { ...START }; shown = { ...pos }; path = [{ ...pos }]; steps = 0; last = null; diverged = false; acc = 0;
      updateText();
    }
    function step() {
      if (diverged) return;
      const [gm, gb] = grad(pos.m, pos.b);
      last = { m: pos.m, b: pos.b, gm, gb };
      pos = { m: pos.m - lr * gm, b: pos.b - lr * gb };
      steps++; path.push({ ...pos });
      if (path.length > 600) path.shift();
      if (!isFinite(pos.m) || Math.abs(pos.m) > 1e6 || loss(pos.m, pos.b) > 1e8) { diverged = true; playing = false; syncPlay(); }
      if (RM) shown = { ...pos };
      updateText();
    }
    const fmt = (v) => (Math.abs(v) >= 1e4 ? v.toExponential(1) : v.toFixed(2));
    function updateText() {
      st('step').textContent = steps;
      const lv = loss(pos.m, pos.b);
      st('loss').textContent = diverged ? 'huge' : (lv >= 1e4 ? lv.toExponential(1) : lv.toFixed(3));
      if (!last) {
        rule.innerHTML = `m ← m − η · ∂L/∂m<br>b ← b − η · ∂L/∂b<span>Press Step to see the numbers. Now m = ${fmt(pos.m)}, b = ${fmt(pos.b)}.</span>`;
      } else {
        rule.innerHTML = `m ← ${fmt(last.m)} − ${lr.toFixed(3)} × ${fmt(last.gm)} = ${fmt(pos.m)}<br>b ← ${fmt(last.b)} − ${lr.toFixed(3)} × ${fmt(last.gb)} = ${fmt(pos.b)}<span>${diverged ? 'Diverged: every step overshoots more. Lower the learning rate and press Reset.' : 'Each line is old value minus step size times gradient.'}</span>`;
      }
    }
    updateText();

    // tap the map to move the start
    cv.el.addEventListener('pointerdown', (e) => {
      const r = cv.el.getBoundingClientRect(); const px = e.clientX - r.left; const py = e.clientY - r.top;
      if (px < L.c.x || px > L.c.x + L.c.w || py < L.c.y || py > L.c.y + L.c.h) return;
      reset({ m: icm(px), b: icb(py) });
    }, { signal: ctx.signal });

    // ----- draw helpers -----
    function axes(R, xl, yl) {
      g.strokeStyle = C.borderStrong; g.lineWidth = 1;
      g.beginPath(); g.moveTo(R.x, R.y); g.lineTo(R.x, R.y + R.h); g.lineTo(R.x + R.w, R.y + R.h); g.stroke();
      g.font = MONO; g.fillStyle = C.muted; g.textBaseline = 'top'; g.textAlign = 'right';
      g.fillText(xl, R.x + R.w, R.y + R.h + 6);
      g.save(); g.translate(R.x - 8, R.y); g.rotate(-Math.PI / 2); g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText(yl, 0, 0); g.restore();
    }

    ctx.loop((t, dt) => {
      if (playing) {
        acc += dt * 7;
        while (acc >= 1) { acc -= 1; step(); }
        if (steps >= 400) { playing = false; syncPlay(); }
      }
      if (!RM) { const k = 1 - Math.exp(-dt * 16); shown.m += (pos.m - shown.m) * k; shown.b += (pos.b - shown.b) * k; } else shown = { ...pos };
      if (!isFinite(shown.m) || !isFinite(shown.b)) shown = { ...pos };
      const { w, h } = cv; g.clearRect(0, 0, w, h);
      if (!L.c) return;

      // --- contour map ---
      const R = L.c;
      if (heat) { g.imageSmoothingEnabled = true; g.drawImage(heat, R.x, R.y, R.w, R.h); }
      g.save(); g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip(); contours(); g.restore();
      g.strokeStyle = C.borderStrong; g.strokeRect(R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1);
      g.font = MONO; g.fillStyle = C.muted; g.textAlign = 'center'; g.textBaseline = 'top';
      for (let m = Math.ceil(MR[0]); m <= MR[1]; m++) g.fillText(String(m), cm(m), R.y + R.h + 5);
      g.textAlign = 'right'; g.textBaseline = 'middle';
      for (let b = Math.ceil(BR[0]); b <= BR[1]; b++) g.fillText(String(b), R.x - 6, cb(b));
      g.textAlign = 'right'; g.textBaseline = 'top'; g.fillStyle = C.text2;
      g.fillText('slope m', R.x + R.w - 6, R.y + R.h - 18);
      g.save(); g.translate(R.x + 16, R.y + 8); g.rotate(Math.PI / 2); g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('intercept b', 0, 0); g.restore();
      // the minimum
      g.strokeStyle = C.c1; g.lineWidth = 1.5;
      g.beginPath(); g.arc(cm(OPT.m), cb(OPT.b), 9, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(cm(OPT.m), cb(OPT.b), 2.5, 0, Math.PI * 2); g.fillStyle = C.c1; g.fill();

      g.save(); g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip();
      // path
      g.strokeStyle = rgba(C.c2, 0.75); g.lineWidth = 1.5; g.beginPath();
      path.forEach((p, i) => { const X = cm(p.m); const Y = cb(p.b); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
      g.stroke();
      g.fillStyle = rgba(C.c2, 0.9);
      for (const p of path) { g.beginPath(); g.arc(cm(p.m), cb(p.b), 2.2, 0, Math.PI * 2); g.fill(); }
      // ball and downhill arrow
      const bx = cm(shown.m); const by = cb(shown.b);
      const [gm, gb] = grad(shown.m, shown.b);
      const glen = Math.hypot(gm, gb);
      if (glen > 1e-3 && !diverged) {
        const ax = -gm / glen; const ay = -gb / glen; // downhill in parameter space
        const ux = ax * R.w / (MR[1] - MR[0]); const uy = -ay * R.h / (BR[1] - BR[0]);
        const ul = Math.hypot(ux, uy); const len = Math.min(70, 18 + glen * 6);
        const ex = bx + ux / ul * len; const ey = by + uy / ul * len;
        g.strokeStyle = C.text; g.lineWidth = 1.5; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
        const an = Math.atan2(ey - by, ex - bx);
        g.beginPath(); g.moveTo(ex, ey); g.lineTo(ex - 8 * Math.cos(an - 0.45), ey - 8 * Math.sin(an - 0.45)); g.lineTo(ex - 8 * Math.cos(an + 0.45), ey - 8 * Math.sin(an + 0.45)); g.closePath(); g.fillStyle = C.text; g.fill();
      }
      g.beginPath(); g.arc(bx, by, 8, 0, Math.PI * 2);
      const grd = g.createRadialGradient(bx - 3, by - 3, 1, bx, by, 9); grd.addColorStop(0, '#fff'); grd.addColorStop(1, C.c2);
      g.fillStyle = grd; g.fill(); g.strokeStyle = C.bg; g.lineWidth = 2; g.stroke();
      g.restore();
      if (bx < R.x || bx > R.x + R.w || by < R.y || by > R.y + R.h || diverged) {
        g.font = '600 13px Rajdhani, sans-serif'; g.fillStyle = C.c4; g.textAlign = 'center'; g.textBaseline = 'top';
        g.fillText(R.w < 420 ? 'STEPS TOO BIG: FLYING OFF' : 'THE BALL FLEW OFF THE MAP: THE STEPS ARE TOO BIG', R.x + R.w / 2, R.y + 10);
      }
      // legend
      g.font = MONO; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = C.text2;
      g.fillText('loss landscape', R.x + 8, R.y + R.h - 18);

      // --- data pane ---
      const D = L.d;
      const dx = (x) => D.x + (x + 0.3) / 3.6 * D.w;
      const dy = (y) => D.y + D.h - (y + 1.6) / 4.8 * D.h;
      axes(D, 'x', 'y');
      g.save(); g.beginPath(); g.rect(D.x, D.y, D.w, D.h); g.clip();
      for (const p of DATA) {
        const yh = shown.m * p.x + shown.b;
        g.strokeStyle = rgba(C.c4, 0.75); g.lineWidth = 1.2; g.beginPath(); g.moveTo(dx(p.x), dy(p.y)); g.lineTo(dx(p.x), dy(yh)); g.stroke();
      }
      g.strokeStyle = C.c2; g.lineWidth = 2; g.beginPath(); g.moveTo(dx(-0.3), dy(shown.m * -0.3 + shown.b)); g.lineTo(dx(3.3), dy(shown.m * 3.3 + shown.b)); g.stroke();
      g.restore();
      for (const p of DATA) { g.beginPath(); g.arc(dx(p.x), dy(p.y), 4, 0, Math.PI * 2); g.fillStyle = C.text; g.fill(); }
      g.font = MONO; g.fillStyle = C.text2; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(D.w < 220 ? 'data + line' : 'the data and the current line', D.x + 6, D.y + 2);

      // --- loss over steps ---
      const Q = L.l; axes(Q, 'step', 'loss (log)');
      const n = path.length; const vals = path.map((p) => Math.log10(loss(p.m, p.b)));
      const lo = Math.log10(LOSS_MIN) - 0.15; const hi = Math.max(lo + 1, Math.min(6, Math.max(...vals)));
      const qx = (i) => Q.x + (n <= 1 ? 0 : i / Math.max(20, n - 1)) * Q.w;
      const qy = (v) => Q.y + Q.h - (Math.min(hi, v) - lo) / (hi - lo) * Q.h;
      g.setLineDash([4, 4]); g.strokeStyle = rgba(C.c1, 0.6); g.lineWidth = 1;
      g.beginPath(); g.moveTo(Q.x, qy(Math.log10(LOSS_MIN))); g.lineTo(Q.x + Q.w, qy(Math.log10(LOSS_MIN))); g.stroke(); g.setLineDash([]);
      g.strokeStyle = C.c2; g.lineWidth = 1.8; g.beginPath();
      vals.forEach((v, i) => { if (i) g.lineTo(qx(i), qy(v)); else g.moveTo(qx(i), qy(v)); }); g.stroke();
      g.fillStyle = C.text2; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(Q.w < 220 ? 'loss per step' : 'loss after each step', Q.x + 6, Q.y + 2);
      g.fillStyle = rgba(C.c1, 0.8); g.textBaseline = 'bottom'; g.textAlign = 'right';
      g.fillText('lowest possible', Q.x + Q.w - 2, qy(Math.log10(LOSS_MIN)) - 3);
    });
  },
};
