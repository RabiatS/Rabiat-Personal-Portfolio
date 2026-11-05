// A single neuron: weighted sum of inputs plus a bias, passed through an activation function.
const MONO = '500 11px "DM Mono", monospace';
const LO = [251, 191, 36]; const HI = [96, 165, 250]; const BG = [20, 20, 20];
const D0 = -0.5; const D1 = 1.5; // input range shown on the plane

const ACTS = {
  step: { name: 'Step', f: (z) => (z > 0 ? 1 : 0), norm: (a) => a, lo: -0.2, hi: 1.2 },
  sigmoid: { name: 'Sigmoid', f: (z) => 1 / (1 + Math.exp(-z)), norm: (a) => a, lo: -0.2, hi: 1.2 },
  relu: { name: 'ReLU', f: (z) => Math.max(0, z), norm: (a) => Math.min(1, a / 2), lo: -0.5, hi: 4 },
  tanh: { name: 'Tanh', f: (z) => Math.tanh(z), norm: (a) => (a + 1) / 2, lo: -1.2, hi: 1.2 },
};
const TASKS = {
  and: { name: 'AND', t: [0, 0, 0, 1], sol: [1, 1, -1.5] },
  or: { name: 'OR', t: [0, 1, 1, 1], sol: [1, 1, -0.5] },
  xor: { name: 'XOR', t: [0, 1, 1, 0], sol: null },
};
const CORNERS = [[0, 0], [0, 1], [1, 0], [1, 1]];
const mix = (v) => { const c = v < 0.5 ? LO : HI; const k = Math.abs(v - 0.5) * 2; return `rgb(${BG.map((b, i) => Math.round(b + (c[i] - b) * (0.12 + 0.6 * k))).join(',')})`; };
const fmt = (v) => (v >= 0 ? ' ' : '') + v.toFixed(2);

export default {
  mount(ctx) {
    const C0 = ctx.colors;
    const cv = ctx.canvas(); const g = cv.ctx;
    let w1 = 0.8; let w2 = -0.6; let b = 0.1; let x1 = 0.9; let x2 = 0.3;
    let act = 'sigmoid'; let task = 'and'; let view = '2d'; let yaw = -0.6; let dirty = true;

    const field = document.createElement('canvas'); const FR = 120; field.width = FR; field.height = FR;
    const fg = field.getContext('2d'); const fimg = fg.createImageData(FR, FR);

    let LY = null;
    cv.onResize((W, H) => {
      const wide = W >= 640; const dock = 50;
      if (wide) {
        const s = Math.min(W * 0.55, H - dock - 50);
        LY = { wide, plane: { x: 30, y: 34, s }, side: { x: 30 + s + 40, y: 34, w: W - s - 74, h: H - dock - 44 } };
      } else {
        const s = Math.max(140, Math.min(W - 44, H - dock - 140));
        LY = { wide, plane: { x: (W - s) / 2 + 10, y: 24, s }, side: { x: 0, y: 24 + s + 26, w: W, h: H - dock - s - 56 } };
      }
      dirty = true;
    });

    const z = () => w1 * x1 + w2 * x2 + b;
    const A = () => ACTS[act];

    // ---------- drawing ----------
    function toPx(u, v) { const { x, y, s } = LY.plane; return [x + (u - D0) / (D1 - D0) * s, y + (1 - (v - D0) / (D1 - D0)) * s]; }
    function fromPx(px, py) { const { x, y, s } = LY.plane; return [D0 + (px - x) / s * (D1 - D0), D0 + (1 - (py - y) / s) * (D1 - D0)]; }

    function drawPlane() {
      const { x, y, s } = LY.plane; const f = A();
      const d = fimg.data;
      for (let j = 0; j < FR; j++) for (let i = 0; i < FR; i++) {
        const u = D0 + (i + 0.5) / FR * (D1 - D0); const v = D1 - (j + 0.5) / FR * (D1 - D0);
        const n = f.norm(f.f(w1 * u + w2 * v + b)); const c = n < 0.5 ? LO : HI; const k = Math.min(1, Math.abs(n - 0.5) * 2);
        const o = (j * FR + i) * 4; for (let q = 0; q < 3; q++) d[o + q] = BG[q] + (c[q] - BG[q]) * (0.1 + 0.5 * k); d[o + 3] = 255;
      }
      fg.putImageData(fimg, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(field, x, y, s, s);
      // grid and axes
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.beginPath();
      for (let t = -0.5; t <= 1.5; t += 0.5) { const [ax, ay] = toPx(t, D0); const [bx, by] = toPx(t, D1); g.moveTo(ax, ay); g.lineTo(bx, by); const [cx, cy] = toPx(D0, t); const [dx, dy] = toPx(D1, t); g.moveTo(cx, cy); g.lineTo(dx, dy); }
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.beginPath(); { const [ax, ay] = toPx(0, D0); const [bx, by] = toPx(0, D1); g.moveTo(ax, ay); g.lineTo(bx, by); const [cx, cy] = toPx(D0, 0); const [dx, dy] = toPx(D1, 0); g.moveTo(cx, cy); g.lineTo(dx, dy); } g.stroke();
      g.strokeStyle = C0.borderStrong; g.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
      g.font = MONO; g.fillStyle = C0.muted; g.textAlign = 'center';
      for (const t of [0, 1]) { const [px, py] = toPx(t, D0); g.fillText(String(t), px, py + 14); const [qx, qy] = toPx(D0, t); g.textAlign = 'right'; g.fillText(String(t), qx - 5, qy + 4); g.textAlign = 'center'; }
      g.fillText('x₁', x + s - 8, y + s + 14); g.textAlign = 'left'; g.fillText('x₂', x - 22, y + 12);
      // decision line w1 x1 + w2 x2 + b = 0
      g.save(); g.beginPath(); g.rect(x, y, s, s); g.clip();
      if (Math.abs(w1) > 1e-6 || Math.abs(w2) > 1e-6) {
        let p1; let p2;
        if (Math.abs(w2) > Math.abs(w1)) { p1 = [D0, -(w1 * D0 + b) / w2]; p2 = [D1, -(w1 * D1 + b) / w2]; } else { p1 = [-(w2 * D0 + b) / w1, D0]; p2 = [-(w2 * D1 + b) / w1, D1]; }
        const [ax, ay] = toPx(...p1); const [bx, by] = toPx(...p2);
        g.strokeStyle = C0.text; g.lineWidth = 2; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        // weight vector arrow from the line point nearest the centre, pointing to the side that fires
        const n2 = w1 * w1 + w2 * w2; const c = [0.5, 0.5]; const t = (w1 * c[0] + w2 * c[1] + b) / n2; const foot = [c[0] - w1 * t, c[1] - w2 * t];
        const L = 0.28 / Math.sqrt(n2); const tip = [foot[0] + w1 * L, foot[1] + w2 * L];
        const [fx, fy] = toPx(...foot); const [tx, ty] = toPx(...tip);
        g.strokeStyle = C0.c6; g.fillStyle = C0.c6; g.lineWidth = 2; g.beginPath(); g.moveTo(fx, fy); g.lineTo(tx, ty); g.stroke();
        const ang = Math.atan2(ty - fy, tx - fx); g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - 9 * Math.cos(ang - 0.4), ty - 9 * Math.sin(ang - 0.4)); g.lineTo(tx - 9 * Math.cos(ang + 0.4), ty - 9 * Math.sin(ang + 0.4)); g.fill();
        g.font = MONO; g.fillText('w', tx + 6, ty - 4);
      }
      g.restore();
      drawCorners((u, v) => toPx(u, v));
      // draggable input
      const [px, py] = toPx(x1, x2);
      g.strokeStyle = C0.text; g.lineWidth = 2; g.beginPath(); g.arc(px, py, 9, 0, 7); g.stroke();
      g.fillStyle = C0.text; g.beginPath(); g.arc(px, py, 2.5, 0, 7); g.fill();
      g.font = MONO; g.textAlign = 'left'; g.fillStyle = C0.muted;
      g.fillText(LY.wide ? 'top view: colour = neuron output, white line = where the sum is 0' : 'colour = output, line: z = 0', x, y - 10);
    }

    function drawCorners(P, rad = 8) {
      const T = TASKS[task];
      CORNERS.forEach(([u, v], i) => {
        const [px, py] = P(u, v); const tgt = T.t[i]; const fires = w1 * u + w2 * v + b > 0; const ok = fires === (tgt === 1);
        g.fillStyle = tgt ? C0.c5 : C0.c2; g.strokeStyle = '#0A0A0A'; g.lineWidth = 2; g.beginPath(); g.arc(px, py, rad, 0, 7); g.fill(); g.stroke();
        g.strokeStyle = ok ? C0.ok : C0.c4; g.lineWidth = 2; g.beginPath(); g.arc(px, py, rad + 4, 0, 7); g.stroke();
        g.fillStyle = '#0A0A0A'; g.font = '600 10px "DM Mono", monospace'; g.textAlign = 'center'; g.fillText(String(tgt), px, py + 3.5);
      });
    }

    function drawSurface() {
      const { x, y, s } = LY.plane; const f = A(); const N = 26; const e = 0.95;
      const cx = x + s / 2; const cy = y + s * 0.56; const S = s * 0.42;
      const cosY = Math.cos(yaw); const sinY = Math.sin(yaw);
      const proj = (u, v, h) => { const X = (u - 0.5) / 2; const Y = (v - 0.5) / 2; const xr = X * cosY - Y * sinY; const yr = X * sinY + Y * cosY; return [cx + xr * S * 2, cy + (yr * Math.sin(e) - h * Math.cos(e) * 0.75) * S * 2, -yr]; };
      const H = (u, v) => f.norm(f.f(w1 * u + w2 * v + b));
      const quads = [];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const u0 = D0 + i / N * 2; const u1 = D0 + (i + 1) / N * 2; const v0 = D0 + j / N * 2; const v1 = D0 + (j + 1) / N * 2;
        const hs = [H(u0, v0), H(u1, v0), H(u1, v1), H(u0, v1)];
        const pts = [proj(u0, v0, hs[0]), proj(u1, v0, hs[1]), proj(u1, v1, hs[2]), proj(u0, v1, hs[3])];
        quads.push({ pts, d: (pts[0][2] + pts[2][2]) / 2, h: (hs[0] + hs[1] + hs[2] + hs[3]) / 4 });
      }
      quads.sort((a, c) => c.d - a.d);
      g.lineWidth = 0.6;
      for (const q of quads) {
        g.fillStyle = mix(q.h); g.strokeStyle = 'rgba(255,255,255,.12)';
        g.beginPath(); q.pts.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); g.stroke();
      }
      // base outline
      g.strokeStyle = C0.borderStrong; g.beginPath(); [[D0, D0], [D1, D0], [D1, D1], [D0, D1], [D0, D0]].forEach(([u, v], k) => { const p = proj(u, v, 0); k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); }); g.stroke();
      drawCorners((u, v) => { const p = proj(u, v, H(u, v)); return [p[0], p[1]]; }, 6);
      const ip = proj(x1, x2, H(x1, x2)); g.strokeStyle = C0.text; g.lineWidth = 2; g.beginPath(); g.arc(ip[0], ip[1], 7, 0, 7); g.stroke();
      g.font = MONO; g.textAlign = 'left'; g.fillStyle = C0.muted;
      g.fillText(LY.wide ? '3D: height = neuron output. Drag to turn.' : 'height = output, drag to turn', x, y - 10);
    }

    function drawSide() {
      const { side, wide } = LY; const f = A(); const zz = z(); const a = f.f(zz);
      g.font = MONO; g.textAlign = 'left';
      let gy = side.y;
      if (wide) {
        // little neuron diagram
        const dx = side.x; const dw = side.w; const r = 15;
        const inX = dx + 18; const sx = dx + dw * 0.55; const ax = dx + dw - 26; const cy = gy + 80;
        const ins = [['x₁', x1, w1, cy - 52], ['x₂', x2, w2, cy], ['1', 1, b, cy + 52]];
        for (const [lab, val, w, yy] of ins) {
          const c = w >= 0 ? HI : LO; g.strokeStyle = `rgba(${c.join(',')},${0.35 + Math.min(1, Math.abs(w) / 3) * 0.6})`; g.lineWidth = 1 + Math.min(5, Math.abs(w) * 1.3);
          g.beginPath(); g.moveTo(inX + r, yy); g.lineTo(sx - r, cy); g.stroke();
          g.fillStyle = C0.surface2; g.strokeStyle = C0.borderStrong; g.lineWidth = 1; g.beginPath(); g.arc(inX, yy, r, 0, 7); g.fill(); g.stroke();
          g.fillStyle = C0.text; g.textAlign = 'center'; g.fillText(lab, inX, yy + 4);
          g.fillStyle = C0.muted; g.fillText(lab === '1' ? `b=${b.toFixed(2)}` : `w=${w.toFixed(2)}`, (inX + sx) / 2, (yy + cy) / 2 - 8);
          if (lab !== '1') { g.textAlign = 'left'; g.fillText(val.toFixed(2), inX - 8, yy + 30); }
        }
        g.fillStyle = C0.surface2; g.strokeStyle = C0.text2; g.beginPath(); g.arc(sx, cy, r + 4, 0, 7); g.fill(); g.stroke();
        g.fillStyle = C0.text; g.textAlign = 'center'; g.font = '600 15px "DM Mono", monospace'; g.fillText('Σ', sx, cy + 5); g.font = MONO;
        g.strokeStyle = C0.text2; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx + r + 4, cy); g.lineTo(ax - r, cy); g.stroke();
        g.fillStyle = C0.muted; g.fillText(`z=${zz.toFixed(2)}`, (sx + ax) / 2, cy - 10);
        g.fillStyle = C0.surface2; g.strokeStyle = C0.c6; g.beginPath(); g.arc(ax, cy, r + 2, 0, 7); g.fill(); g.stroke();
        g.fillStyle = C0.text; g.fillText('f', ax, cy + 4);
        g.fillStyle = C0.c6; g.fillText(`a=${a.toFixed(2)}`, ax - 4, cy + 36);
        gy = cy + 76;
      }
      // equation
      g.textAlign = 'left'; g.fillStyle = C0.text2; g.font = MONO;
      const lines = wide ? [`z = w₁x₁ + w₂x₂ + b`, `  = ${w1.toFixed(2)}×${x1.toFixed(2)} + ${w2.toFixed(2)}×${x2.toFixed(2)} + ${b.toFixed(2)}`, `  = ${zz.toFixed(3)}`, `a = ${f.name.toLowerCase()}(z) = ${a.toFixed(3)}`]
        : [`z = ${zz.toFixed(3)}`, `a = ${a.toFixed(3)}`, `f = ${f.name.toLowerCase()}`];
      const lx = wide ? side.x : side.x + 8;
      lines.forEach((l, i) => g.fillText(l, lx, gy + 12 + i * 16));
      if (wide) gy += lines.length * 16 + 10;
      // activation plot
      const ph = wide ? Math.max(60, Math.min(220, side.y + side.h - gy - 10)) : Math.max(50, side.h);
      const pw = wide ? side.w : side.w - 130; const px0 = wide ? lx : side.x + 122;
      const zr = 6; const X = (zv) => px0 + (zv + zr) / (2 * zr) * pw; const Y = (av) => gy + ph - (av - f.lo) / (f.hi - f.lo) * ph;
      g.strokeStyle = C0.border; g.lineWidth = 1; g.strokeRect(px0 + 0.5, gy + 0.5, pw - 1, ph - 1);
      g.strokeStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.moveTo(X(0), gy); g.lineTo(X(0), gy + ph); g.moveTo(px0, Y(0)); g.lineTo(px0 + pw, Y(0)); g.stroke();
      g.strokeStyle = C0.c6; g.lineWidth = 2; g.beginPath();
      for (let i = 0; i <= 160; i++) { const zv = -zr + i / 160 * 2 * zr; const yv = Math.max(f.lo, Math.min(f.hi, f.f(zv))); const px = X(zv); const py = Y(yv); if (act === 'step' && i && Math.sign(zv) !== Math.sign(zv - 2 * zr / 160)) g.moveTo(px, py); i ? g.lineTo(px, py) : g.moveTo(px, py); }
      g.stroke();
      const zc = Math.max(-zr, Math.min(zr, zz)); const ac = Math.max(f.lo, Math.min(f.hi, a));
      g.setLineDash([3, 3]); g.strokeStyle = C0.muted; g.lineWidth = 1; g.beginPath(); g.moveTo(X(zc), gy + ph); g.lineTo(X(zc), Y(ac)); g.lineTo(px0, Y(ac)); g.stroke(); g.setLineDash([]);
      g.fillStyle = C0.text; g.beginPath(); g.arc(X(zc), Y(ac), 4.5, 0, 7); g.fill();
      g.fillStyle = C0.muted; g.fillText(`${f.name} activation`, px0 + 6, gy + 14); g.textAlign = 'right'; g.fillText('z', px0 + pw - 6, Y(0) - 5);
    }

    function draw() {
      if (!LY || !cv.w) return;
      g.clearRect(0, 0, cv.w, cv.h);
      if (view === '2d') drawPlane(); else drawSurface();
      drawSide();
    }

    // ---------- pointer ----------
    let mode = null; let lastX = 0;
    cv.el.style.touchAction = 'none';
    cv.el.addEventListener('pointerdown', (e) => {
      const r = cv.el.getBoundingClientRect(); const px = e.clientX - r.left; const py = e.clientY - r.top; const { x, y, s } = LY.plane;
      if (px < x || px > x + s || py < y - 10 || py > y + s + 10) return;
      cv.el.setPointerCapture(e.pointerId); mode = view === '2d' ? 'drag' : 'turn'; lastX = px;
      if (mode === 'drag') moveInput(px, py);
    }, { signal: ctx.signal });
    cv.el.addEventListener('pointermove', (e) => {
      if (!mode) return; const r = cv.el.getBoundingClientRect(); const px = e.clientX - r.left; const py = e.clientY - r.top;
      if (mode === 'drag') moveInput(px, py); else { yaw += (px - lastX) * 0.01; lastX = px; dirty = true; }
    }, { signal: ctx.signal });
    const end = () => { mode = null; };
    cv.el.addEventListener('pointerup', end, { signal: ctx.signal }); cv.el.addEventListener('pointercancel', end, { signal: ctx.signal });
    function moveInput(px, py) { const [u, v] = fromPx(px, py); x1 = Math.round(Math.max(D0, Math.min(D1, u)) * 100) / 100; x2 = Math.round(Math.max(D0, Math.min(D1, v)) * 100) / 100; sX1.value = x1; sX2.value = x2; changed(); }

    // ---------- panel ----------
    ctx.panel.append(
      ctx.h('<h2 class="k-h">A single neuron</h2>'),
      ctx.h('<p class="lede">The building block of every neural network is tiny: multiply each input by a weight, add them up with a bias, then squash the result.</p>'),
    );
    const sW1 = ctx.slider({ label: 'Weight w₁', min: -5, max: 5, step: 0.1, value: w1, onInput: (v) => { w1 = v; changed(); } });
    const sW2 = ctx.slider({ label: 'Weight w₂', min: -5, max: 5, step: 0.1, value: w2, onInput: (v) => { w2 = v; changed(); } });
    const sB = ctx.slider({ label: 'Bias b', min: -5, max: 5, step: 0.1, value: b, onInput: (v) => { b = v; changed(); } });
    const sX1 = ctx.slider({ label: 'Input x₁', min: D0, max: D1, step: 0.01, value: x1, onInput: (v) => { x1 = v; changed(); } });
    const sX2 = ctx.slider({ label: 'Input x₂', min: D0, max: D1, step: 0.01, value: x2, onInput: (v) => { x2 = v; changed(); } });
    ctx.panel.append(sW1, sW2, sB);
    ctx.panel.append(ctx.seg(Object.entries(ACTS).map(([k, v]) => [k, v.name]), act, (v) => { act = v; changed(); }));
    const zline = ctx.h('<div class="formula"></div>');
    ctx.panel.append(zline, sX1, sX2, ctx.h('<p class="hint">Or drag the white ring on the plane to move the input.</p>'));

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>Think of a neuron as a tiny voter. Each input gets a weight that says how much it matters (negative weights vote against). The bias is how easily it fires on its own.</p>
      <p>The sum z = w₁x₁ + w₂x₂ + b is zero exactly on a straight line. On one side the neuron is "on", on the other it is "off". The activation decides how sharp that switch is: a hard step, a smooth S curve, or a ramp.</p></div>`));

    ctx.panel.append(ctx.h('<h3>Exercise: teach it logic</h3>'), ctx.h('<p class="small">The four dots are the inputs (0,0), (0,1), (1,0), (1,1). Their colour and number are the answer we want. A green ring means the neuron gets that dot right (it fires when z &gt; 0).</p>'));
    const taskSeg = ctx.seg(Object.entries(TASKS).map(([k, v]) => [k, v.name]), task, (v) => { task = v; changed(); });
    const score = ctx.h('<p class="hint"></p>');
    const solRow = ctx.h('<div class="row"><button class="btn sm ghost s-sol">Show a solution</button><button class="btn sm ghost s-net">See a network solve XOR ›</button></div>');
    solRow.querySelector('.s-sol').onclick = () => {
      const s = TASKS[task].sol;
      if (!s) { score.textContent = 'No weights can do XOR. The two blue dots sit on opposite corners, and one straight line cannot separate them from the two amber dots.'; return; }
      [w1, w2, b] = s; sW1.value = w1; sW2.value = w2; sB.value = b; changed();
    };
    solRow.querySelector('.s-net').onclick = () => ctx.go('neural-net');
    ctx.panel.append(taskSeg, score, solRow);

    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li>Pick <b>AND</b> and move the sliders until all four rings are green. Hint: both weights positive, bias negative enough that one input alone is not enough.</li>
      <li>Now <b>OR</b>: make the bias less negative so one input is enough.</li>
      <li>Now <b>XOR</b>. However you set the line, at least one dot is wrong. One neuron can only cut the plane with one straight line.</li>
      <li>Switch to <b>3D surface</b> and drag. Step makes a cliff, sigmoid a smooth ramp, ReLU a slope that keeps rising.</li></ol></div>`));

    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div class="card deep">
      <div class="formula">a = f(w · x + b)<span>w and x are vectors, so this works for any number of inputs</span></div>
      <p>The weight vector w points across the line toward the side that fires (the lime arrow). Bigger weights make the switch sharper, because z changes faster as you cross the line. The bias slides the line without turning it.</p>
      <p>This is the perceptron from 1958 (Frank Rosenblatt) when f is a step. In 1969 Minsky and Papert showed a single layer cannot compute XOR, which cooled interest for years. Stacking layers fixes it: one hidden layer of two neurons can carve XOR.</p>
      <p>Why the different activations? The step has zero slope almost everywhere, so gradient descent cannot learn with it. Sigmoid and tanh are smooth but flatten out for large |z|, which slows learning in deep nets. ReLU, max(0, z), is cheap and keeps a slope of 1 for positive z, which is why most modern networks use it or a close relative.</p>
    </div></details>`));

    // ---------- dock ----------
    const dock = ctx.h('<div class="dock"><div class="grp glass"><button data-v="2d" class="on">Top view</button><button data-v="3d">3D surface</button></div></div>');
    ctx.stage.append(dock);
    dock.addEventListener('click', (e) => { const bt = e.target.closest('button'); if (!bt) return; view = bt.dataset.v; dock.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === bt)); dirty = true; }, { signal: ctx.signal });

    function changed() {
      dirty = true;
      const zz = z(); const a = A().f(zz);
      zline.innerHTML = `z = ${fmt(w1)}×${x1.toFixed(2)} + ${fmt(w2)}×${x2.toFixed(2)} + ${fmt(b)} = ${zz.toFixed(2)}<span>output a = ${A().name.toLowerCase()}(z) = ${a.toFixed(3)}</span>`;
      const T = TASKS[task]; const right = CORNERS.filter(([u, v], i) => (w1 * u + w2 * v + b > 0) === (T.t[i] === 1)).length;
      score.textContent = right === 4 ? `${T.name} solved: all 4 dots right. This neuron is a logic gate.` : `${T.name}: ${right} of 4 dots right.${task === 'xor' ? ' (3 is the best one line can do.)' : ''}`;
    }
    changed();

    ctx.loop(() => { if (dirty) { dirty = false; draw(); } });
    // the kit's "Next" button does not wrap, and the next title is long, so let it wrap on phones
    setTimeout(() => { const nb = ctx.panel.parentElement && ctx.panel.parentElement.querySelector('.k-nav .k-f'); if (nb) { nb.style.whiteSpace = 'normal'; nb.style.textAlign = 'center'; } }, 0);

    ctx.quiz([
      { q: 'A neuron has w₁ = 2, w₂ = 1, b = −1 and inputs x₁ = 1, x₂ = 0. What is the weighted sum z?', choices: ['1', '2', '3'], answer: 0, why: 'z = 2×1 + 1×0 + (−1) = 1.' },
      { q: 'What shape is the boundary where a single neuron switches from off to on, with two inputs?', choices: ['A circle', 'A straight line', 'Any curve it likes'], answer: 1, why: 'The boundary is where w₁x₁ + w₂x₂ + b = 0, which is the equation of a line.' },
      { q: 'Why can a single neuron not compute XOR?', choices: ['Its weights are too small', 'XOR needs the two "true" corners on one side and the two "false" corners on the other, which no single straight line can do', 'XOR needs a sigmoid activation'], answer: 1, why: 'The true cases (0,1) and (1,0) sit on opposite corners. You need at least two lines, so at least two neurons feeding a third.' },
    ]);
  },
};
