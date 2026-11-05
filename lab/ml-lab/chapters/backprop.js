// Backpropagation on a 2-2-1 network: forward values, backward gradients by the chain rule, one SGD update.
const MONO = '500 11px "DM Mono", monospace';
const sig = (z) => 1 / (1 + Math.exp(-z));
const f3 = (v) => (Math.abs(v) < 0.0005 ? '0.000' : v.toFixed(3));

const INIT = { w11: 0.4, w21: -0.6, b1: 0.1, w12: 0.7, w22: 0.2, b2: -0.3, v1: 0.9, v2: -0.5, b3: 0.2 };

function compute(p, x1, x2, t) {
  const r = {};
  r.z1 = p.w11 * x1 + p.w21 * x2 + p.b1; r.h1 = sig(r.z1);
  r.z2 = p.w12 * x1 + p.w22 * x2 + p.b2; r.h2 = sig(r.z2);
  r.z3 = p.v1 * r.h1 + p.v2 * r.h2 + p.b3; r.y = sig(r.z3);
  r.L = 0.5 * (r.y - t) ** 2;
  r.dy = r.y - t;
  r.dz3 = r.dy * r.y * (1 - r.y);
  r.dv1 = r.dz3 * r.h1; r.dv2 = r.dz3 * r.h2; r.db3 = r.dz3;
  r.dh1 = r.dz3 * p.v1; r.dh2 = r.dz3 * p.v2;
  r.dz1 = r.dh1 * r.h1 * (1 - r.h1); r.dz2 = r.dh2 * r.h2 * (1 - r.h2);
  r.dw11 = r.dz1 * x1; r.dw21 = r.dz1 * x2; r.db1 = r.dz1;
  r.dw12 = r.dz2 * x1; r.dw22 = r.dz2 * x2; r.db2 = r.dz2;
  return r;
}

export default {
  mount(ctx) {
    const C0 = ctx.colors;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cv = ctx.canvas(); const g = cv.ctx;
    let P = { ...INIT }; let x1 = 1; let x2 = 0.5; let t = 0; let lr = 1;
    let R = compute(P, x1, x2, t); let prevL = null;
    let step = 0; let anim = 0; let auto = false; let autoAcc = 0;
    let hist = [R.L];
    let shownP = { ...P }; // weights drawn on edges, animated toward P after an update

    // graph: nodes and edges
    const N = { x1: {}, x2: {}, h1: {}, h2: {}, y: {}, L: {} };
    const E = [
      ['x1', 'h1', 'w11'], ['x2', 'h1', 'w21'], ['x1', 'h2', 'w12'], ['x2', 'h2', 'w22'],
      ['h1', 'y', 'v1'], ['h2', 'y', 'v2'], ['y', 'L', null],
    ];

    // steps: what is lit, which edges carry a pulse, and the text
    const STEPS = [
      { ph: 'F', lit: ['x1', 'x2'], fw: [], title: 'Forward 1: the inputs', body: () => `The example comes in: x₁ = ${x1.toFixed(2)}, x₂ = ${x2.toFixed(2)}. We want the network to output the target t = ${t.toFixed(2)}.` },
      { ph: 'F', lit: ['h1'], fw: [['x1', 'h1'], ['x2', 'h1']], title: 'Forward 2: hidden neuron h₁', body: () => `z₁ = w₁₁x₁ + w₂₁x₂ + b₁ = ${P.w11.toFixed(2)}×${x1.toFixed(2)} + ${P.w21.toFixed(2)}×${x2.toFixed(2)} + ${P.b1.toFixed(2)} = <b>${f3(R.z1)}</b><br>h₁ = σ(z₁) = <b>${f3(R.h1)}</b>` },
      { ph: 'F', lit: ['h2'], fw: [['x1', 'h2'], ['x2', 'h2']], title: 'Forward 3: hidden neuron h₂', body: () => `z₂ = w₁₂x₁ + w₂₂x₂ + b₂ = ${P.w12.toFixed(2)}×${x1.toFixed(2)} + ${P.w22.toFixed(2)}×${x2.toFixed(2)} + ${P.b2.toFixed(2)} = <b>${f3(R.z2)}</b><br>h₂ = σ(z₂) = <b>${f3(R.h2)}</b>` },
      { ph: 'F', lit: ['y'], fw: [['h1', 'y'], ['h2', 'y']], title: 'Forward 4: the output', body: () => `z₃ = v₁h₁ + v₂h₂ + b₃ = ${P.v1.toFixed(2)}×${f3(R.h1)} + ${P.v2.toFixed(2)}×${f3(R.h2)} + ${P.b3.toFixed(2)} = <b>${f3(R.z3)}</b><br>y = σ(z₃) = <b>${f3(R.y)}</b>` },
      { ph: 'F', lit: ['L'], fw: [['y', 'L']], title: 'Forward 5: the loss', body: () => `L = ½(y − t)² = ½(${f3(R.y)} − ${t.toFixed(2)})² = <b>${R.L.toFixed(4)}</b><br>One number for how wrong we are. Now: how should each weight change to make it smaller?` },
      { ph: 'B', lit: ['y'], bw: [['L', 'y']], title: 'Backward 1: blame on the output', body: () => `∂L/∂y = y − t = <b>${f3(R.dy)}</b><br>${R.dy > 0 ? 'Positive: the output is too high, so pushing y down lowers the loss.' : 'Negative: the output is too low, so pushing y up lowers the loss.'}` },
      { ph: 'B', lit: ['y'], bw: [], grads: ['v1', 'v2'], title: 'Backward 2: through the sigmoid, onto v₁ and v₂', body: () => `Chain rule: ∂L/∂z₃ = ∂L/∂y × σ′(z₃) = ${f3(R.dy)} × y(1−y) = ${f3(R.dy)} × ${f3(R.y * (1 - R.y))} = <b>${f3(R.dz3)}</b><br>∂L/∂v₁ = ∂L/∂z₃ × h₁ = ${f3(R.dz3)} × ${f3(R.h1)} = <b>${f3(R.dv1)}</b><br>∂L/∂v₂ = ∂L/∂z₃ × h₂ = ${f3(R.dz3)} × ${f3(R.h2)} = <b>${f3(R.dv2)}</b><br>∂L/∂b₃ = <b>${f3(R.db3)}</b>` },
      { ph: 'B', lit: ['h1', 'h2'], bw: [['y', 'h1'], ['y', 'h2']], title: 'Backward 3: blame flows to the hidden neurons', body: () => `Each hidden neuron gets blame in proportion to the weight that connects it to the output.<br>∂L/∂h₁ = ∂L/∂z₃ × v₁ = ${f3(R.dz3)} × ${P.v1.toFixed(2)} = <b>${f3(R.dh1)}</b><br>∂L/∂h₂ = ∂L/∂z₃ × v₂ = ${f3(R.dz3)} × ${P.v2.toFixed(2)} = <b>${f3(R.dh2)}</b>` },
      { ph: 'B', lit: ['x1', 'x2'], bw: [['h1', 'x1'], ['h1', 'x2'], ['h2', 'x1'], ['h2', 'x2']], grads: ['w11', 'w21', 'w12', 'w22'], title: 'Backward 4: onto the first layer weights', body: () => `∂L/∂z₁ = ∂L/∂h₁ × h₁(1−h₁) = <b>${f3(R.dz1)}</b><br>∂L/∂z₂ = ∂L/∂h₂ × h₂(1−h₂) = <b>${f3(R.dz2)}</b><br>∂L/∂w₁₁ = ∂L/∂z₁ × x₁ = <b>${f3(R.dw11)}</b><br>∂L/∂w₂₁ = ∂L/∂z₁ × x₂ = <b>${f3(R.dw21)}</b><br>∂L/∂w₁₂ = ∂L/∂z₂ × x₁ = <b>${f3(R.dw12)}</b><br>∂L/∂w₂₂ = ∂L/∂z₂ × x₂ = <b>${f3(R.dw22)}</b><br>Every weight now knows its share of the blame.` },
      { ph: 'U', lit: ['L'], fw: [], title: 'Update: one step of gradient descent', body: () => (prevL == null ? `Each weight moves a little against its gradient: w ← w − η × ∂L/∂w with η = ${lr}. Press Next to apply it.` : `All 9 parameters moved: w ← w − ${lr} × ∂L/∂w. For example v₁ went from ${(P.v1 + lr * prevR.dv1).toFixed(3)} to ${P.v1.toFixed(3)}.<br>Loss before: ${prevL.toFixed(4)} → after: <b>${R.L.toFixed(4)}</b>. ${R.L < prevL ? 'It went down.' : 'It went up: the learning rate is too big for this spot.'}`) },
    ];
    let prevR = R;
    const grad = { w11: 'dw11', w21: 'dw21', w12: 'dw12', w22: 'dw22', v1: 'dv1', v2: 'dv2' };
    const showVal = (n) => step >= { x1: 0, x2: 0, h1: 1, h2: 2, y: 3, L: 4 }[n];
    const showGrad = (key) => {
      const need = { y: 5, L: 5, v1: 6, v2: 6, h1: 7, h2: 7, w11: 8, w21: 8, w12: 8, w22: 8 }[key];
      return need != null && step >= need && !(step === 9 && prevL != null);
    };

    // ---------- layout ----------
    let LY = null;
    cv.onResize((W, H) => {
      const wide = W >= 620; const dock = 50;
      const chartH = wide ? 110 : 54;
      const gh = H - dock - chartH - (wide ? 40 : 34);
      const nw = wide ? 118 : 100; const nh = wide ? 92 : 70;
      const top = wide ? 30 : 24;
      if (wide) {
        const cx = [0.1, 0.4, 0.7, 0.92].map((f) => Math.max(nw / 2 + 2, Math.min(W - nw / 2 - 2, f * W)));
        N.x1 = { x: cx[0], y: top + gh * 0.25 }; N.x2 = { x: cx[0], y: top + gh * 0.75 };
        N.h1 = { x: cx[1], y: top + gh * 0.25 }; N.h2 = { x: cx[1], y: top + gh * 0.75 };
        N.y = { x: cx[2], y: top + gh * 0.5 }; N.L = { x: cx[3], y: top + gh * 0.5 };
      } else {
        // phones: the graph flows top to bottom
        const r0 = top + 20; const r2 = top + gh - nh / 2; const r1 = (r0 + r2) / 2;
        const cl = Math.max(nw / 2 + 2, W * 0.25); const cr = Math.min(W - nw / 2 - 2, W * 0.75);
        N.x1 = { x: cl, y: r0 }; N.x2 = { x: cr, y: r0 }; N.h1 = { x: cl, y: r1 }; N.h2 = { x: cr, y: r1 };
        N.y = { x: Math.max(nw / 2 + 2, W * 0.32), y: r2 }; N.L = { x: cr, y: r2 };
      }
      LY = { wide, nw, nh, chart: { x: 8, y: H - dock - chartH - 4, w: W - 16, h: chartH } };
    });

    const nhOf = (k) => (!LY.wide && (k === 'x1' || k === 'x2') ? 40 : LY.nh);
    const edgePts = (a, b) => {
      const A = N[a]; const B = N[b]; const { nw, nh } = LY;
      if (LY.wide || (a === 'y' && b === 'L')) return [A.x + nw / 2, A.y, B.x - nw / 2, B.y];
      return [A.x, A.y + nhOf(a) / 2, B.x, B.y - nhOf(b) / 2];
    };

    function drawArrow(x0, y0, x1, y1, col, w) {
      g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    }

    function draw(time) {
      if (!LY || !cv.w) return;
      g.clearRect(0, 0, cv.w, cv.h);
      const S = STEPS[step]; const { nw, nh, wide } = LY;
      const ease = Math.min(1, anim);
      // edges
      g.font = MONO;
      for (const [a, b, key] of E) {
        const [x0, y0, x1, y1] = edgePts(a, b);
        const fwOn = S.fw && S.fw.some(([p, q]) => p === a && q === b);
        const bwOn = S.bw && S.bw.some(([p, q]) => p === b && q === a);
        const gOn = key && S.grads && S.grads.includes(key);
        const w = key ? shownP[key] : 1;
        const base = key ? (w >= 0 ? '96,165,250' : '251,191,36') : '160,160,154';
        drawArrow(x0, y0, x1, y1, `rgba(${base},${fwOn || bwOn || gOn ? 0.95 : 0.4})`, key ? 1 + Math.min(4, Math.abs(w) * 3) : 1.5);
        // moving pulse
        if ((fwOn || bwOn) && ease < 1) {
          const u = bwOn ? 1 - ease : ease; const px = x0 + (x1 - x0) * u; const py = y0 + (y1 - y0) * u;
          g.fillStyle = bwOn ? C0.c4 : C0.c1; g.shadowColor = g.fillStyle; g.shadowBlur = 12; g.beginPath(); g.arc(px, py, 5, 0, 7); g.fill(); g.shadowBlur = 0;
        }
        if (bwOn && ease >= 1) { // arrow head pointing backward
          const ang = Math.atan2(y0 - y1, x0 - x1); const hx = x0 + Math.cos(ang) * -14; const hy = y0 + Math.sin(ang) * -14;
          g.fillStyle = C0.c4; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx - 8 * Math.cos(ang - 0.45), hy - 8 * Math.sin(ang - 0.45)); g.lineTo(hx - 8 * Math.cos(ang + 0.45), hy - 8 * Math.sin(ang + 0.45)); g.fill();
        }
        if (key) {
          const f = a === 'x1' || a === 'x2' ? (wide ? (b === 'h1' ? 0.3 : 0.62) : ((a === 'x1') === (b === 'h1') ? 0.66 : 0.24)) : 0.5;
          const lx = x0 + (x1 - x0) * f; const ly = y0 + (y1 - y0) * f;
          const name = { w11: 'w₁₁', w21: 'w₂₁', w12: 'w₁₂', w22: 'w₂₂', v1: 'v₁', v2: 'v₂' }[key];
          const txt = wide ? `${name} ${shownP[key].toFixed(2)}` : shownP[key].toFixed(2);
          const gtxt = showGrad(key) ? (wide ? `∂ ${f3(R[grad[key]])}` : f3(R[grad[key]])) : null;
          const tw = Math.max(g.measureText(txt).width, gtxt ? g.measureText(gtxt).width : 0) + 8;
          g.fillStyle = 'rgba(10,10,10,.85)'; g.fillRect(lx - tw / 2, ly - 11, tw, gtxt ? 28 : 16);
          g.textAlign = 'center'; g.fillStyle = C0.text2; g.fillText(txt, lx, ly + 1);
          if (gtxt) { g.fillStyle = C0.c4; g.fillText(gtxt, lx, ly + 14); }
        }
      }
      // nodes
      const rows = {
        x1: () => [['x₁', null], [x1.toFixed(2), 'v']],
        x2: () => [['x₂', null], [x2.toFixed(2), 'v']],
        h1: () => [['h₁', null], [`z ${f3(R.z1)}`, 'v'], [`σ ${f3(R.h1)}`, 'v'], [`∂h ${f3(R.dh1)}`, 'g', 'h1'], [`∂z ${f3(R.dz1)}`, 'g', 'w11']],
        h2: () => [['h₂', null], [`z ${f3(R.z2)}`, 'v'], [`σ ${f3(R.h2)}`, 'v'], [`∂h ${f3(R.dh2)}`, 'g', 'h2'], [`∂z ${f3(R.dz2)}`, 'g', 'w12']],
        y: () => [['y', null], [`z ${f3(R.z3)}`, 'v'], [`σ ${f3(R.y)}`, 'v'], [`∂y ${f3(R.dy)}`, 'g', 'y'], [`∂z ${f3(R.dz3)}`, 'g', 'v1']],
        L: () => [['loss', null], [R.L.toFixed(4), 'v'], [`t ${t.toFixed(2)}`, 't']],
      };
      for (const k of Object.keys(N)) {
        const n = N[k]; const lit = S.lit.includes(k);
        const hh = nhOf(k); const x = n.x - nw / 2; const y = n.y - hh / 2;
        g.fillStyle = lit ? 'rgba(30,30,30,.98)' : 'rgba(20,20,20,.95)';
        g.strokeStyle = lit ? (S.ph === 'B' ? C0.c4 : S.ph === 'U' ? C0.c6 : C0.c1) : C0.borderStrong; g.lineWidth = lit ? 2 : 1;
        g.beginPath(); g.roundRect(x, y, nw, hh, 10); g.fill(); g.stroke();
        const lines = rows[k]();
        const lh = wide ? 15 : 12.5;
        g.textAlign = 'left';
        let yy = y + 17;
        for (const [txt, kind, gk] of lines) {
          if (kind === 'v' && !showVal(k)) { g.fillStyle = C0.subtle; g.font = wide ? MONO : '500 10px "DM Mono", monospace'; g.fillText('···', x + 9, yy); yy += lh; continue; }
          if (kind === 'g' && !showGrad(gk)) { yy += lh; continue; }
          if (kind == null) { g.font = '700 14px Rajdhani, sans-serif'; g.fillStyle = C0.text; } else { g.font = wide ? MONO : '500 10px "DM Mono", monospace'; g.fillStyle = kind === 'g' ? C0.c4 : kind === 't' ? C0.c2 : C0.text2; }
          g.fillText(txt, x + 9, yy); yy += lh;
        }
      }
      // phase label
      g.font = MONO; g.textAlign = 'left';
      g.fillStyle = S.ph === 'B' ? C0.c4 : S.ph === 'U' ? C0.c6 : C0.c1;
      g.fillText(`${step + 1}/${STEPS.length}  ${S.ph === 'F' ? 'forward pass' : S.ph === 'B' ? 'backward pass' : 'update'}`, 8, 14);
      drawChart();
    }

    function drawChart() {
      const { x, y, w, h } = LY.chart;
      g.strokeStyle = C0.border; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      g.font = MONO; g.fillStyle = C0.muted; g.textAlign = 'left';
      g.fillText(`loss over updates (${hist.length - 1} so far)   now ${R.L.toFixed(4)}`, x + 8, y + 15);
      if (hist.length < 2) return;
      const max = Math.max(...hist) * 1.05 || 1;
      g.strokeStyle = C0.c6; g.lineWidth = 1.8; g.beginPath();
      hist.forEach((v, i) => { const px = x + 8 + i / (hist.length - 1) * (w - 16); const py = y + h - 8 - v / max * (h - 30); i ? g.lineTo(px, py) : g.moveTo(px, py); });
      g.stroke();
    }

    // ---------- control ----------
    function goto(s) {
      step = (s + STEPS.length) % STEPS.length; anim = reduce ? 1 : 0;
      card.querySelector('b.t').textContent = STEPS[step].title;
      card.querySelector('.b').innerHTML = STEPS[step].body();
      prog.style.width = `${(step + 1) / STEPS.length * 100}%`;
    }
    function next() {
      if (step === 9 && prevL == null) { applyUpdate(); goto(9); return; }
      if (step === 9) { prevL = null; goto(0); return; }
      goto(step + 1);
    }
    function applyUpdate() {
      prevR = R; prevL = R.L;
      for (const k of Object.keys(P)) P[k] -= lr * R['d' + k];
      R = compute(P, x1, x2, t); hist.push(R.L);
    }
    function recompute() { R = compute(P, x1, x2, t); hist = [R.L]; prevL = null; goto(step === 9 ? 0 : step); }

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Backpropagation</h2>'),
      ctx.h('<p class="lede">A network learns by asking every weight one question: if you changed a little, how much would the error change? Backprop answers it for all weights in one backward sweep.</p>'),
    );
    const card = ctx.h('<div class="card" style="border-color:var(--border-strong)"><b class="t" style="font:700 16px var(--f-display);text-transform:uppercase;letter-spacing:.06em"></b><div class="b formula" style="font-size:12.5px"></div><div class="bar"><span></span></div></div>');
    const prog = card.querySelector('.bar span');
    ctx.panel.append(card);
    const nav = ctx.h('<div class="row"><button class="btn ghost sm p-prev">‹ Back</button><button class="btn sm p-next">Next step ›</button><button class="btn ghost sm p-auto">Auto</button></div>');
    nav.querySelector('.p-prev').onclick = () => { auto = false; syncAuto(); if (step === 9 && prevL != null) { goto(9); return; } goto(Math.max(0, step - 1)); };
    nav.querySelector('.p-next').onclick = () => { auto = false; syncAuto(); next(); };
    const autoB = nav.querySelector('.p-auto');
    const syncAuto = () => { autoB.textContent = auto ? 'Stop' : 'Auto'; };
    autoB.onclick = () => { auto = !auto; autoAcc = 0; syncAuto(); };
    ctx.panel.append(nav);

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p><b>Forward</b> (teal): numbers flow left to right and produce a guess y, and the loss says how far it is from the target.</p>
      <p><b>Backward</b> (rose): starting from the loss, each node passes blame to whatever fed it, multiplying by how sensitive it is. That multiplying is the chain rule. Each weight ends up with a gradient, shown in rose under its value.</p>
      <p><b>Update</b>: every weight takes a small step against its gradient, and the loss goes down.</p></div>`));

    ctx.panel.append(ctx.h('<h3>Your example</h3>'));
    const sx1 = ctx.slider({ label: 'Input x₁', min: -2, max: 2, step: 0.1, value: x1, onInput: (v) => { x1 = v; recompute(); } });
    const sx2 = ctx.slider({ label: 'Input x₂', min: -2, max: 2, step: 0.1, value: x2, onInput: (v) => { x2 = v; recompute(); } });
    const st = ctx.slider({ label: 'Target t', min: 0, max: 1, step: 0.05, value: t, onInput: (v) => { t = v; recompute(); } });
    const sl = ctx.slider({ label: 'Learning rate η', min: 0.1, max: 10, step: 0.1, value: lr, onInput: (v) => { lr = v; } });
    ctx.panel.append(sx1, sx2, st, sl);
    const tr = ctx.h('<div class="row"><button class="btn ghost sm t-50">Train 50 updates</button><button class="btn ghost sm t-reset">Reset weights</button></div>');
    let training = 0;
    tr.querySelector('.t-50').onclick = () => { training = 50; };
    tr.querySelector('.t-reset').onclick = () => { P = { ...INIT }; shownP = { ...P }; recompute(); goto(0); };
    ctx.panel.append(tr);

    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li>Press <b>Next step</b> through all ten steps once and read the numbers on the right.</li>
      <li>At the update step, press Next again to apply it, and check the loss went down.</li>
      <li>Press <b>Train 50 updates</b> and watch the curve at the bottom drop, and the edge colours and thickness shift.</li>
      <li>Set the learning rate to 10 and train again. Big steps can overshoot.</li>
      <li>Change the target to 1. The sign of ∂L/∂y flips, and so does the direction every weight moves.</li></ol></div>`));

    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div class="card deep">
      <p>The chain rule says that if L depends on y, y on z, and z on w, then</p>
      <div class="formula">∂L/∂w = ∂L/∂y · ∂y/∂z · ∂z/∂w<span>multiply the local slopes along the path</span></div>
      <p>For a sigmoid, σ′(z) = σ(z)(1 − σ(z)), at most 0.25. Multiply many of those together in a deep network and the gradient shrinks toward zero: the <b>vanishing gradient</b> problem, one reason ReLU took over.</p>
      <p>The trick of backprop is reuse. ∂L/∂z₃ is computed once and shared by v₁, v₂, h₁ and h₂. That makes the backward pass cost about the same as the forward pass, instead of one pass per weight. This is <b>reverse mode automatic differentiation</b>, which PyTorch, JAX and TensorFlow do for you.</p>
      <p>Here we update on a single example. In practice gradients are averaged over a mini-batch before each step (see the playground chapter).</p>
    </div></details>`));

    goto(0);

    ctx.loop((time, dt) => {
      anim = Math.min(1.2, anim + dt * 1.3);
      for (const k of Object.keys(P)) shownP[k] += (P[k] - shownP[k]) * (reduce ? 1 : Math.min(1, dt * 6));
      if (training > 0) { for (let i = 0; i < 2 && training > 0; i++) { applyUpdate(); training--; } prevL = null; if (training === 0) goto(0); else card.querySelector('.b').innerHTML = `Training... loss ${R.L.toFixed(4)}`; }
      if (auto) { autoAcc += dt; if (autoAcc > 2.2) { autoAcc = 0; next(); } }
      draw(time);
    });

    ctx.quiz([
      { q: 'In which direction does the backward pass move through the network?', choices: ['From the inputs to the loss', 'From the loss back toward the inputs', 'Randomly'], answer: 1, why: 'Gradients start at the loss and flow backward, each layer reusing the gradient of the layer after it.' },
      { q: 'If ∂L/∂w for some weight is positive, what does gradient descent do to that weight?', choices: ['Increases it', 'Decreases it', 'Leaves it alone'], answer: 1, why: 'w ← w − η · ∂L/∂w. A positive slope means increasing w raises the loss, so we lower w.' },
      { q: 'Why is ∂L/∂z₃ so useful during the backward pass here?', choices: ['It is the final answer', 'It is computed once and reused for v₁, v₂, b₃ and both hidden neurons', 'It is always zero'], answer: 1, why: 'Reusing shared pieces of the chain rule is what makes backprop cheap.' },
    ]);
  },
};
