// Fitting a line: least squares regression you can poke.
// Tap to add points, drag to move them, drag a point off the plot to delete it.

const MONO = '500 11px "DM Mono", ui-monospace, monospace';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function fit(pts) {
  const n = pts.length;
  if (n < 2) return { m: 0, b: n ? pts[0].y : 5, ok: false };
  let sx = 0; let sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  const mx = sx / n; const my = sy / n;
  let sxy = 0; let sxx = 0;
  for (const p of pts) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; }
  if (sxx < 1e-9) return { m: 0, b: my, ok: false };
  const m = sxy / sxx;
  return { m, b: my - m * mx, ok: true };
}
const mse = (pts, m, b) => (pts.length ? pts.reduce((s, p) => s + (p.y - (m * p.x + b)) ** 2, 0) / pts.length : 0);

function seedPoints() {
  const pts = [];
  const m = 0.55 + Math.random() * 0.4; const b = 1 + Math.random() * 2;
  for (let i = 0; i < 9; i++) {
    const x = 0.8 + i * 1.05 + (Math.random() - 0.5) * 0.6;
    const y = m * x + b + (Math.random() - 0.5) * 3.4;
    pts.push({ x, y: Math.max(0.3, Math.min(9.7, y)) });
  }
  return pts;
}

export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas({ style: 'touch-action:none;cursor:crosshair' });
    const g = cv.ctx;
    let pts = seedPoints();
    let mode = 'best'; // 'best' | 'hand'
    let showSq = true; let showRes = true; let showBest = true;
    let hand = { m: 0.2, b: 4 };
    let disp = null; // displayed line, eased toward target
    let drag = null; let hoverI = -1; let outside = false;
    let P = { x0: 0, y0: 0, s: 1 }; // plot origin (bottom left, px) and px per unit

    cv.onResize((w, h) => {
      const padL = 40; const padR = 14; const padT = 14; const padB = 64;
      const s = Math.max(10, Math.min((w - padL - padR) / 10, (h - padT - padB) / 10));
      const x0 = padL + Math.max(0, (w - padL - padR - s * 10) / 2);
      P = { x0, y0: padT + s * 10, s };
    });
    const sx = (x) => P.x0 + x * P.s;
    const sy = (y) => P.y0 - y * P.s;
    const ix = (px) => (px - P.x0) / P.s;
    const iy = (py) => (P.y0 - py) / P.s;

    // ----- panel -----
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Fitting a line</h2>'),
      ctx.h('<p class="lede">Give a computer some dots and ask it for the straight line that fits them best. That is linear regression, and "best" has a precise meaning you can see.</p>'),
    );
    const modeSeg = ctx.seg([['best', 'Best fit'], ['hand', 'Fit by hand']], mode, (v) => { mode = v; syncMode(); });
    ctx.panel.append(modeSeg);
    const handBox = ctx.h('<div style="display:grid;gap:10px"></div>');
    const sM = ctx.slider({ label: 'Slope (tilt)', min: -2, max: 3, step: 0.01, value: hand.m, fmt: (v) => v.toFixed(2), onInput: (v) => { hand.m = v; } });
    const sB = ctx.slider({ label: 'Intercept (height at x = 0)', min: -4, max: 12, step: 0.01, value: hand.b, fmt: (v) => v.toFixed(2), onInput: (v) => { hand.b = v; } });
    const snap = ctx.h('<div class="row"><button class="btn ghost sm">Snap to best</button><label class="check"><input type="checkbox" checked> show best line</label></div>');
    snap.querySelector('button').onclick = () => { const f = fit(pts); hand = { m: f.m, b: f.b }; sM.value = f.m; sB.value = f.b; };
    snap.querySelector('input').onchange = (e) => { showBest = e.target.checked; };
    handBox.append(sM, sB, snap);
    ctx.panel.append(handBox);

    const toggles = ctx.h('<div class="row"><label class="check"><input type="checkbox" data-k="res" checked> errors</label><label class="check"><input type="checkbox" data-k="sq" checked> squared errors</label></div>');
    toggles.querySelectorAll('input').forEach((i) => { i.onchange = () => { if (i.dataset.k === 'res') showRes = i.checked; else showSq = i.checked; }; });
    ctx.panel.append(toggles);

    const stats = ctx.h('<div class="stat" style="grid-template-columns:repeat(4,1fr)"><div><b data-s="mse">0</b><span>MSE</span></div><div><b data-s="best">0</b><span>Best MSE</span></div><div><b data-s="m">0</b><span>Slope</span></div><div><b data-s="b">0</b><span>Intercept</span></div></div>');
    ctx.panel.append(stats);
    const verdict = ctx.h('<p class="hint" style="min-height:1.5em"></p>');
    ctx.panel.append(verdict);
    const st = (k) => stats.querySelector(`[data-s="${k}"]`);

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>For every dot, measure how far it sits above or below the line. That gap is the <b>error</b> (also called the residual). Square each error so negatives do not cancel positives and big misses count extra, then average them. That number is the <b>mean squared error</b>, or MSE.</p>
      <p>The best fit line is simply the line with the smallest MSE. On the plot, it is the line that makes the amber squares, added together, as small as they can be.</p>
    </div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li>Tap empty space to add a dot. Drag a dot and watch the line swing to follow it.</li>
      <li>Press <b>Add outlier</b> on the plot. One far away dot grows a huge square and drags the whole line toward it.</li>
      <li>Switch to <b>Fit by hand</b> and try to beat the best MSE with the sliders. You can tie it, but you can never beat it.</li>
      <li>Drag a dot off the edge of the plot to delete it.</li>
    </ol></div>`));
    ctx.panel.append(ctx.h(`<div class="card deep">
      <p>The line is <code>y = m·x + b</code>. We want the <code>m</code> and <code>b</code> that minimise</p>
      <div class="formula">MSE = (1/n) Σ (yᵢ − (m·xᵢ + b))²</div>
      <p>Because MSE is a smooth bowl shaped function of <code>m</code> and <code>b</code>, there is exactly one bottom, and calculus finds it directly:</p>
      <div class="formula">m = Σ(xᵢ − x̄)(yᵢ − ȳ) / Σ(xᵢ − x̄)²<span>b = ȳ − m·x̄ (the line always passes through the average point)</span></div>
      <p>This closed form is called ordinary least squares. With many inputs it becomes the matrix formula <code>w = (XᵀX)⁻¹Xᵀy</code>. Bigger models have no closed form, so they slide downhill on the loss instead, which is the next chapter.</p>
      <p>Squaring is a choice. It makes outliers very influential. Minimising the plain absolute error instead gives a line that is more robust to outliers, but it has no simple formula.</p>
    </div>`));
    ctx.quiz([
      { q: 'What does the best fit line make as small as possible?', choices: ['The number of dots above the line', 'The average of the squared vertical gaps between dots and line', 'The steepness of the line'], answer: 1, why: 'Least squares picks the slope and intercept with the lowest mean squared error.' },
      { q: 'Why square the errors instead of just adding them?', choices: ['So positive and negative errors do not cancel, and big misses count more', 'Because squares are easier to draw', 'To make the line steeper'], answer: 0, why: 'A dot 2 above and a dot 2 below would add to zero. Squaring makes every miss count, and a miss of 4 costs 16, not 4.' },
      { q: 'You add one dot far from all the others. What happens?', choices: ['Nothing, one dot cannot matter', 'The line tilts toward it, because its squared error is huge', 'The line ignores it as an outlier'], answer: 1, why: 'Its error gets squared, so it dominates the total and pulls the line. That is why outliers matter so much for least squares.' },
    ]);

    // ----- stage dock -----
    const dock = ctx.h(`<div class="dock"><div class="grp glass"><button data-a="rand">New dots</button><button data-a="out">Add outlier</button><button data-a="clear">Clear</button></div></div>`);
    ctx.stage.append(dock);
    dock.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.a === 'rand') pts = seedPoints();
      if (b.dataset.a === 'clear') pts = [];
      if (b.dataset.a === 'out') pts.push({ x: 8.6 + Math.random() * 0.8, y: 0.6 + Math.random() * 0.6 });
    }));

    function syncMode() {
      handBox.hidden = mode !== 'hand';
      if (mode === 'hand') { const f = fit(pts); if (!disp) disp = { ...f }; }
    }
    syncMode();

    // ----- pointer -----
    const pos = (e) => { const r = cv.el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const inPlot = (x, y) => x >= -0.3 && x <= 10.3 && y >= -0.3 && y <= 10.3;
    function nearest(px, py, rad) {
      let best = -1; let bd = rad * rad;
      pts.forEach((p, i) => { const d = (sx(p.x) - px) ** 2 + (sy(p.y) - py) ** 2; if (d < bd) { bd = d; best = i; } });
      return best;
    }
    cv.el.addEventListener('pointerdown', (e) => {
      const [px, py] = pos(e);
      let i = nearest(px, py, e.pointerType === 'touch' ? 26 : 16);
      if (i < 0) {
        const x = ix(px); const y = iy(py);
        if (!(x >= 0 && x <= 10 && y >= 0 && y <= 10) || pts.length >= 80) return;
        pts.push({ x, y }); i = pts.length - 1;
      }
      drag = i; outside = false;
      cv.el.setPointerCapture(e.pointerId);
    }, { signal: ctx.signal });
    cv.el.addEventListener('pointermove', (e) => {
      const [px, py] = pos(e);
      if (drag == null) { hoverI = nearest(px, py, 16); cv.el.style.cursor = hoverI >= 0 ? 'grab' : 'crosshair'; return; }
      const x = ix(px); const y = iy(py);
      outside = !inPlot(x, y);
      pts[drag] = { x: Math.max(-0.3, Math.min(10.3, x)), y: Math.max(-0.3, Math.min(10.3, y)) };
    }, { signal: ctx.signal });
    const up = () => {
      if (drag != null && outside) pts.splice(drag, 1);
      drag = null; outside = false;
    };
    cv.el.addEventListener('pointerup', up, { signal: ctx.signal });
    cv.el.addEventListener('pointercancel', up, { signal: ctx.signal });

    // ----- draw -----
    let lastStats = '';
    ctx.loop((t, dt) => {
      const best = fit(pts);
      const target = mode === 'hand' ? hand : best;
      if (!disp || RM) disp = { m: target.m, b: target.b };
      else { const k = 1 - Math.exp(-dt * 14); disp.m += (target.m - disp.m) * k; disp.b += (target.b - disp.b) * k; }
      const L = disp;
      const { w, h } = cv;
      g.clearRect(0, 0, w, h);
      const X0 = sx(0); const X1 = sx(10); const Y0 = sy(0); const Y1 = sy(10);

      // grid
      g.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        g.strokeStyle = i === 0 ? C.borderStrong : 'rgba(255,255,255,0.045)';
        g.beginPath(); g.moveTo(sx(i), Y0); g.lineTo(sx(i), Y1); g.stroke();
        g.beginPath(); g.moveTo(X0, sy(i)); g.lineTo(X1, sy(i)); g.stroke();
      }
      g.font = MONO; g.fillStyle = C.subtle; g.textAlign = 'center'; g.textBaseline = 'top';
      for (let i = 0; i <= 10; i += 2) g.fillText(String(i), sx(i), Y0 + 6);
      g.textAlign = 'right'; g.textBaseline = 'middle';
      for (let i = 2; i <= 8; i += 2) g.fillText(String(i), X0 - 7, sy(i));
      g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = C.muted;
      g.fillText('x  (input)', X1 - 70, Y0 + 20);
      g.save(); g.translate(X0 - 30, Y1 + 4); g.textBaseline = 'top'; g.fillText('y', 0, 0); g.restore();

      g.save();
      g.beginPath(); g.rect(X0, Y1, X1 - X0, Y0 - Y1); g.clip();

      // squares and residuals against the displayed line
      for (const p of pts) {
        const yh = L.m * p.x + L.b; const r = p.y - yh;
        const side = Math.abs(r) * P.s;
        if (showSq && side > 0.5) {
          const right = p.x < 8.5 || sx(p.x) - side < X0;
          const xL = right ? sx(p.x) : sx(p.x) - side;
          const yT = Math.min(sy(p.y), sy(yh));
          g.fillStyle = rgba(C.c2, 0.1); g.strokeStyle = rgba(C.c2, 0.45);
          g.fillRect(xL, yT, side, side); g.strokeRect(xL + 0.5, yT + 0.5, side - 1, side - 1);
        }
        if (showRes) {
          g.strokeStyle = rgba(C.c4, 0.85); g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(sx(p.x), sy(p.y)); g.lineTo(sx(p.x), sy(yh)); g.stroke();
        }
      }
      // best line ghost (hand mode)
      if (mode === 'hand' && showBest && best.ok) {
        g.setLineDash([6, 6]); g.strokeStyle = rgba(C.c1, 0.55); g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(sx(-1), sy(best.m * -1 + best.b)); g.lineTo(sx(11), sy(best.m * 11 + best.b)); g.stroke();
        g.setLineDash([]);
      }
      // the line
      if (pts.length >= 2 || mode === 'hand') {
        const col = mode === 'hand' ? C.text : C.c1;
        g.strokeStyle = rgba(col, 0.25); g.lineWidth = 7;
        g.beginPath(); g.moveTo(sx(-1), sy(L.m * -1 + L.b)); g.lineTo(sx(11), sy(L.m * 11 + L.b)); g.stroke();
        g.strokeStyle = col; g.lineWidth = 2;
        g.beginPath(); g.moveTo(sx(-1), sy(L.m * -1 + L.b)); g.lineTo(sx(11), sy(L.m * 11 + L.b)); g.stroke();
      }
      g.restore();

      // points
      pts.forEach((p, i) => {
        const active = i === drag || i === hoverI;
        g.beginPath(); g.arc(sx(p.x), sy(p.y), active ? 7.5 : 5.5, 0, Math.PI * 2);
        g.fillStyle = (i === drag && outside) ? C.c4 : C.text; g.fill();
        g.lineWidth = 2; g.strokeStyle = C.bg; g.stroke();
      });

      // label for the dragged point
      if (drag != null && pts[drag]) {
        const p = pts[drag]; const r = p.y - (L.m * p.x + L.b);
        const txt = outside ? 'release to delete' : `error ${r.toFixed(2)}   squared ${(r * r).toFixed(2)}`;
        g.font = MONO; const tw = g.measureText(txt).width + 14;
        let bx = sx(p.x) + 12; if (bx + tw > w - 4) bx = sx(p.x) - 12 - tw;
        const by = Math.max(4, sy(p.y) - 34);
        g.fillStyle = 'rgba(20,20,20,0.92)'; g.strokeStyle = C.borderStrong;
        g.beginPath(); g.roundRect(bx, by, tw, 22, 6); g.fill(); g.stroke();
        g.fillStyle = outside ? C.c4 : C.text; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, bx + 7, by + 11);
      }
      if (!pts.length) {
        g.font = MONO; g.fillStyle = C.muted; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('tap anywhere on the grid to add dots', (X0 + X1) / 2, (Y0 + Y1) / 2);
      }
      // equation chip
      if (pts.length >= 2 || mode === 'hand') {
        const eq = `y = ${L.m.toFixed(2)}x ${L.b < 0 ? '−' : '+'} ${Math.abs(L.b).toFixed(2)}`;
        g.font = MONO; const tw = g.measureText(eq).width + 16;
        g.fillStyle = 'rgba(20,20,20,0.85)'; g.beginPath(); g.roundRect(X0 + 8, Y1 + 8, tw, 24, 6); g.fill();
        g.fillStyle = mode === 'hand' ? C.text : C.c1; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(eq, X0 + 16, Y1 + 20);
      }

      // stats (only touch DOM when they change)
      const cur = mode === 'hand' ? hand : best;
      const myMse = mse(pts, cur.m, cur.b); const bMse = mse(pts, best.m, best.b);
      const s = `${myMse.toFixed(3)}|${bMse.toFixed(3)}|${cur.m.toFixed(2)}|${cur.b.toFixed(2)}|${mode}|${pts.length}`;
      if (s !== lastStats) {
        lastStats = s;
        st('mse').textContent = pts.length ? myMse.toFixed(2) : '-';
        st('best').textContent = pts.length >= 2 ? bMse.toFixed(2) : '-';
        st('m').textContent = cur.m.toFixed(2); st('b').textContent = cur.b.toFixed(2);
        if (pts.length < 2) verdict.textContent = 'Add at least two dots to fit a line.';
        else if (mode === 'best') verdict.textContent = `${pts.length} dots. This line has the lowest possible MSE.`;
        else {
          const gap = myMse - bMse;
          verdict.textContent = gap < 0.005 ? 'You matched the best fit. Nice.' : `Your line is ${gap.toFixed(2)} above the best MSE. Keep nudging.`;
        }
      }
    });
  },
};
