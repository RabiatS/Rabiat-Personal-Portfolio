// Convolution: slide a 3x3 kernel over a grayscale image, multiply and sum at each spot; plus 2x2 max pooling.
const MONO = '500 11px "DM Mono", monospace';
const N = 20;
const KERNELS = {
  identity: { name: 'Identity', k: [0, 0, 0, 0, 1, 0, 0, 0, 0] },
  blur: { name: 'Blur', k: [1, 2, 1, 2, 4, 2, 1, 2, 1].map((v) => v / 16) },
  sharpen: { name: 'Sharpen', k: [0, -1, 0, -1, 5, -1, 0, -1, 0] },
  edgex: { name: 'Edge x', k: [-1, 0, 1, -2, 0, 2, -1, 0, 1] },
  edgey: { name: 'Edge y', k: [-1, -2, -1, 0, 0, 0, 1, 2, 1] },
  outline: { name: 'Outline', k: [-1, -1, -1, -1, 8, -1, -1, -1, -1] },
  emboss: { name: 'Emboss', k: [-2, -1, 0, -1, 1, 1, 0, 1, 2] },
};
const kfmt = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, ''));

function makeImage(kind) {
  const a = new Float32Array(N * N);
  if (kind === 'blank') return a;
  if (kind === 'shapes') {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let v = 0.08;
      if (x >= 2 && x <= 8 && y >= 2 && y <= 8) v = 0.9; // square
      if (Math.hypot(x - 14, y - 6) <= 3.6) v = 0.65; // disc
      if (y >= 12 && y <= 17 && Math.abs(x - 4 - (17 - y)) <= 0.6) v = 1; // diagonal line
      if (x >= 11 && x <= 18 && y >= 13 && y <= 16) v = 0.3 + (x - 11) * 0.09; // gradient bar
      a[y * N + x] = v;
    }
    return a;
  }
  const c = document.createElement('canvas'); c.width = N; c.height = N; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, N, N); g.fillStyle = '#fff';
  g.font = '700 19px "DM Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(kind === 'letter' ? 'A' : kind, 10, 11);
  const d = g.getImageData(0, 0, N, N).data; for (let i = 0; i < N * N; i++) a[i] = d[i * 4] / 255;
  return a;
}

function bigPicture(S) {
  // a procedural "photo" for the preview: sky, sun, house, stripes, noise
  const a = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S; const v = y / S;
    let val = 0.55 + 0.3 * (1 - v);
    if (Math.hypot(u - 0.78, v - 0.22) < 0.1) val = 0.98;
    if (v > 0.7) val = 0.3 + 0.08 * Math.sin(u * 60) * (v - 0.7) * 5;
    if (u > 0.15 && u < 0.5 && v > 0.45 && v < 0.75) val = 0.75; // house body
    if (v > 0.25 && v <= 0.45 && Math.abs(u - 0.325) < (v - 0.25) * 0.95) val = 0.2; // roof
    if (u > 0.22 && u < 0.3 && v > 0.52 && v < 0.6) val = 0.15; // window
    if (u > 0.36 && u < 0.44 && v > 0.58 && v < 0.75) val = 0.25; // door
    if (u > 0.6 && u < 0.92 && v > 0.45 && v < 0.68) val = (Math.floor(u * 40) % 2) ? 0.85 : 0.35; // fence stripes
    a[y * S + x] = Math.max(0, Math.min(1, val + (Math.random() - 0.5) * 0.04));
  }
  return a;
}

export default {
  mount(ctx) {
    const C0 = ctx.colors;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cv = ctx.canvas(); const g = cv.ctx;
    let img = makeImage('shapes'); let kname = 'edgex'; let K = [...KERNELS.edgex.k];
    let stride = 1; let pad = 0; let mode = 'conv'; let playing = !reduce; let rate = 14; let drawing = false;
    let pos = 0; let acc = 0; let out = null; let OW = 0; let OH = 0; let pooled = null; let PW = 0; let PH = 0; let ppos = 0;

    function conv() {
      OW = Math.floor((N + 2 * pad - 3) / stride) + 1; OH = OW;
      out = new Float32Array(OW * OH);
      for (let oy = 0; oy < OH; oy++) for (let ox = 0; ox < OW; ox++) {
        let s = 0;
        for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 3; kx++) { const iy = oy * stride + ky - pad; const ix = ox * stride + kx - pad; if (iy >= 0 && ix >= 0 && iy < N && ix < N) s += img[iy * N + ix] * K[ky * 3 + kx]; }
        out[oy * OW + ox] = s;
      }
      PW = Math.floor(OW / 2); PH = Math.floor(OH / 2); pooled = new Float32Array(PW * PH);
      for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
        let m = 0; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) m = Math.max(m, out[(y * 2 + dy) * OW + x * 2 + dx]);
        pooled[y * PW + x] = m;
      }
    }
    const positive = () => K.every((v) => v >= 0);
    function colourOf(v, scale) {
      if (positive()) { const c = Math.round(Math.max(0, Math.min(1, v)) * 255); return `rgb(${c},${c},${c})`; }
      const t = Math.max(-1, Math.min(1, v / scale)); const c = t >= 0 ? [94, 234, 212] : [251, 113, 133]; const k = Math.abs(t);
      return `rgb(${Math.round(18 + (c[0] - 18) * k)},${Math.round(18 + (c[1] - 18) * k)},${Math.round(18 + (c[2] - 18) * k)})`;
    }
    const outScale = () => { let m = 1e-6; for (let i = 0; i < out.length; i++) m = Math.max(m, Math.abs(out[i])); return m; };

    // ---------- layout ----------
    let LY = null;
    cv.onResize((W, H) => {
      const wide = W >= 640; const dock = 54;
      if (wide) {
        const compH = 150; const s = Math.min((W - 70) / 2, H - dock - compH - 50);
        LY = { wide, a: { x: (W - 2 * s - 50) / 2, y: 26, s }, b: { x: (W - 2 * s - 50) / 2 + s + 50, y: 26, s }, comp: { x: 10, y: 26 + s + 22, w: W - 20, h: compH } };
      } else {
        const s = Math.min((W - 30) / 2, H * 0.42);
        LY = { wide, a: { x: 8, y: 22, s }, b: { x: W - s - 8, y: 22, s }, comp: { x: 6, y: 22 + s + 18, w: W - 12, h: H - dock - s - 46 } };
      }
    });

    // ---------- drawing ----------
    function drawGrid(box, n, valAt, colour, padCells = 0) {
      const tot = n + 2 * padCells; const cs = box.s / tot;
      for (let y = 0; y < tot; y++) for (let x = 0; x < tot; x++) {
        const ix = x - padCells; const iy = y - padCells; const inPad = ix < 0 || iy < 0 || ix >= n || iy >= n;
        if (inPad) { g.fillStyle = '#0d0d0d'; g.fillRect(box.x + x * cs, box.y + y * cs, cs, cs); g.strokeStyle = 'rgba(160,160,154,.25)'; g.setLineDash([2, 2]); g.strokeRect(box.x + x * cs + 0.5, box.y + y * cs + 0.5, cs - 1, cs - 1); g.setLineDash([]); continue; }
        const v = valAt(ix, iy); if (v == null) { g.fillStyle = '#121212'; } else g.fillStyle = colour(v);
        g.fillRect(box.x + x * cs, box.y + y * cs, cs + 0.3, cs + 0.3);
      }
      g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.beginPath();
      for (let k = 0; k <= tot; k++) { g.moveTo(box.x + k * cs + 0.5, box.y); g.lineTo(box.x + k * cs + 0.5, box.y + tot * cs); g.moveTo(box.x, box.y + k * cs + 0.5); g.lineTo(box.x + tot * cs, box.y + k * cs + 0.5); }
      g.stroke();
      return cs;
    }

    function drawConv() {
      const { a, b, comp, wide } = LY; const sc = outScale();
      const total = OW * OH; const p = Math.min(pos, total - 1); const oy = Math.floor(p / OW); const ox = p % OW;
      const csA = drawGrid(a, N, (x, y) => img[y * N + x], (v) => { const c = Math.round(v * 255); return `rgb(${c},${c},${c})`; }, pad);
      const csB = drawGrid({ x: b.x, y: b.y, s: Math.min(b.s, (b.s / (N + 2 * pad)) * OW) }, OW, (x, y) => (y * OW + x <= pos ? out[y * OW + x] : null), (v) => colourOf(v, sc));
      // window on input
      const wx = a.x + ox * stride * csA; const wy = a.y + oy * stride * csA;
      g.strokeStyle = C0.c2; g.lineWidth = 2.5; g.strokeRect(wx, wy, csA * 3, csA * 3);
      // current output cell
      const bx = b.x + ox * csB; const by = b.y + oy * csB;
      g.strokeStyle = C0.c2; g.strokeRect(bx, by, csB, csB);
      // link line
      g.strokeStyle = 'rgba(251,191,36,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(wx + csA * 3, wy + csA * 1.5); g.lineTo(bx, by + csB / 2); g.stroke();
      g.font = MONO; g.fillStyle = C0.muted; g.textAlign = 'left';
      g.fillText(wide ? `input ${N} × ${N}${pad ? ', padded with zeros' : ''}` : `input ${N}×${N}`, a.x, a.y - 8);
      g.fillText(wide ? `feature map ${OW} × ${OH}` : `output ${OW}×${OH}`, b.x, b.y - 8);
      // multiply and sum
      const items = [];
      for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 3; kx++) {
        const iy = oy * stride + ky - pad; const ix = ox * stride + kx - pad; const inside = iy >= 0 && ix >= 0 && iy < N && ix < N;
        items.push([inside ? img[iy * N + ix] : 0, K[ky * 3 + kx]]);
      }
      drawComp(items, out[p], `position (${oy}, ${ox})`, sc);
      void comp;
    }

    function drawComp(items, result, where, sc) {
      const { comp, wide } = LY; const isPool = mode === 'pool';
      const n = isPool ? 2 : 3; const cell = Math.min(wide ? 44 : 34, (comp.h - 24) / n);
      const x0 = comp.x + 4; const y0 = comp.y + 18;
      g.font = MONO; g.textAlign = 'left'; g.fillStyle = C0.muted;
      g.fillText(isPool ? `2 × 2 window at ${where}: keep the biggest` : `at ${where}: multiply each pixel by its kernel weight, then add`, comp.x + 4, comp.y + 6);
      const fs = wide ? 11 : 9.5;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const [v, k] = items[j * n + i]; const c = Math.round(v * 255);
        const px = x0 + i * cell * (isPool ? 1 : wide ? 1.9 : 1.75); const py = y0 + j * cell;
        const w = isPool ? cell : cell * (wide ? 1.9 : 1.75) - 3;
        g.fillStyle = isPool ? colourOf(v, sc) : `rgb(${c},${c},${c})`; g.fillRect(px, py, w, cell - 3);
        g.font = `500 ${fs}px "DM Mono", monospace`; g.textAlign = 'center';
        const lum = isPool ? 0 : c; g.fillStyle = lum > 140 ? '#000' : '#fff';
        g.fillText(isPool ? v.toFixed(2) : `${v.toFixed(2)}×${kfmt(+k.toFixed(3))}`, px + w / 2, py + cell / 2 + 2);
        if (isPool && v === result && v > 0) { g.strokeStyle = C0.c2; g.lineWidth = 2; g.strokeRect(px + 1, py + 1, w - 2, cell - 5); }
      }
      const rx = x0 + n * cell * (isPool ? 1 : wide ? 1.9 : 1.75) + 14;
      g.textAlign = 'left'; g.font = wide ? '600 15px "DM Mono", monospace' : '600 12px "DM Mono", monospace';
      g.fillStyle = C0.text; g.fillText(isPool ? `max = ${result.toFixed(2)}` : `sum = ${result.toFixed(2)}`, rx, y0 + cell * n / 2 + 4);
      if (!isPool && wide) {
        const products = items.map(([v, k]) => v * k);
        g.font = MONO; g.fillStyle = C0.muted;
        g.fillText(products.filter((v) => Math.abs(v) > 1e-9).map((v) => v.toFixed(2)).join(' + ').replace(/\+ -/g, '− ') || '0', rx, y0 + cell * n / 2 + 24);
      }
    }

    function drawPool() {
      const { a, b } = LY; const sc = outScale();
      const relu = (v) => Math.max(0, v);
      const total = PW * PH; const p = Math.min(ppos, total - 1); const py = Math.floor(p / PW); const px = p % PW;
      const csA = drawGrid({ x: a.x, y: a.y, s: a.s }, OW, (x, y) => relu(out[y * OW + x]), (v) => colourOf(v, sc));
      const csB = drawGrid({ x: b.x, y: b.y, s: (a.s / OW) * PW * 1.6 > b.s ? b.s : (a.s / OW) * PW * 1.6 }, PW, (x, y) => (y * PW + x <= ppos ? pooled[y * PW + x] : null), (v) => colourOf(v, sc));
      g.strokeStyle = C0.c2; g.lineWidth = 2.5; g.strokeRect(a.x + px * 2 * csA, a.y + py * 2 * csA, csA * 2, csA * 2);
      g.strokeRect(b.x + px * csB, b.y + py * csB, csB, csB);
      g.font = MONO; g.fillStyle = C0.muted; g.textAlign = 'left';
      g.fillText(LY.wide ? `feature map after ReLU ${OW} × ${OH}` : `after ReLU ${OW}×${OH}`, a.x, a.y - 8);
      g.fillText(LY.wide ? `max pooled ${PW} × ${PH}` : `pooled ${PW}×${PH}`, b.x, b.y - 8);
      const items = []; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) items.push([relu(out[(py * 2 + dy) * OW + px * 2 + dx]), 0]);
      drawComp(items, pooled[p], `(${py}, ${px})`, sc);
    }

    function draw() {
      if (!LY || !cv.w) return;
      g.clearRect(0, 0, cv.w, cv.h);
      if (mode === 'conv') drawConv(); else drawPool();
    }

    // ---------- pointer: draw on the input ----------
    cv.el.style.touchAction = 'pan-y';
    let down = false;
    function paint(e) {
      const r = cv.el.getBoundingClientRect(); const { a } = LY; const cs = a.s / (N + 2 * pad);
      const fx = (e.clientX - r.left - a.x) / cs - pad; const fy = (e.clientY - r.top - a.y) / cs - pad;
      for (let y = Math.floor(fy - 1); y <= Math.floor(fy + 1); y++) for (let x = Math.floor(fx - 1); x <= Math.floor(fx + 1); x++) {
        if (x < 0 || y < 0 || x >= N || y >= N) continue; const d = Math.hypot(x + 0.5 - fx, y + 0.5 - fy); const k = Math.max(0, 1 - d / 1.3);
        img[y * N + x] = Math.min(1, img[y * N + x] + k);
      }
      conv(); updatePreview(false);
    }
    cv.el.addEventListener('pointerdown', (e) => { if (!drawing || mode !== 'conv') return; down = true; cv.el.setPointerCapture(e.pointerId); paint(e); }, { signal: ctx.signal });
    cv.el.addEventListener('pointermove', (e) => { if (down) paint(e); }, { signal: ctx.signal });
    cv.el.addEventListener('pointerup', () => { down = false; }, { signal: ctx.signal });

    // ---------- panel ----------
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Convolution</h2>'),
      ctx.h('<p class="lede">Slide a tiny 3 × 3 grid of weights across an image. At every spot, multiply and add. Pick the right weights and edges, blurs and outlines fall out.</p>'),
    );
    const kSeg = ctx.seg([...Object.entries(KERNELS).map(([k, v]) => [k, v.name]), ['custom', 'Custom']], kname, (v) => { kname = v; if (v !== 'custom') K = [...KERNELS[v].k]; syncKernel(); restart(); });
    ctx.panel.append(ctx.h('<p class="hint">Kernel (the 3 × 3 weights):</p>'), kSeg);
    const kEd = ctx.h(`<div style="display:grid;grid-template-columns:repeat(3,64px);gap:4px">${Array.from({ length: 9 }, (_, i) => `<input class="txt mono" data-i="${i}" inputmode="decimal" style="text-align:center;padding:6px 4px">`).join('')}</div>`);
    const kIn = [...kEd.querySelectorAll('input')];
    kIn.forEach((inp) => inp.addEventListener('input', () => { const v = parseFloat(inp.value); if (!Number.isFinite(v)) return; K[+inp.dataset.i] = v; kname = 'custom'; kSeg.set('custom'); restart(); }));
    function syncKernel() { kIn.forEach((inp, i) => { inp.value = kfmt(+K[i].toFixed(4)); }); }
    ctx.panel.append(kEd, ctx.h('<p class="hint">Type in any box to make your own kernel.</p>'));

    const imgRow = ctx.h('<div class="row"><button class="chip" data-im="shapes">Shapes</button><button class="chip" data-im="letter">Letter A</button><button class="chip" data-im="7">Digit 7</button><button class="chip" data-im="blank">Blank, then draw</button></div>');
    imgRow.addEventListener('click', (e) => { const b = e.target.closest('[data-im]'); if (!b) return; img = makeImage(b.dataset.im); if (b.dataset.im === 'blank') setDraw(true); restart(); });
    ctx.panel.append(ctx.h('<p class="hint">Image:</p>'), imgRow);
    ctx.panel.append(ctx.seg([[1, 'Stride 1'], [2, 'Stride 2']], stride, (v) => { stride = +v; restart(); }));
    ctx.panel.append(ctx.seg([[0, 'No padding'], [1, 'Pad 1 (same size)']], pad, (v) => { pad = +v; restart(); }));
    ctx.panel.append(ctx.slider({ label: 'Speed', min: 1, max: 60, step: 1, value: rate, unit: ' steps/s', onInput: (v) => { rate = v; } }));
    const sizeNote = ctx.h('<div class="formula"></div>');
    ctx.panel.append(sizeNote);

    ctx.panel.append(ctx.h('<h3>The same kernel on a bigger picture</h3>'));
    const pvWrap = ctx.h('<div style="position:relative;aspect-ratio:2/1"></div>');
    ctx.panel.append(pvWrap);
    const pv = ctx.canvas({ parent: pvWrap });
    const PS = 128; const big = bigPicture(PS); const pvOff = document.createElement('canvas'); pvOff.width = PS * 2; pvOff.height = PS;
    function updatePreview() {
      const pg = pvOff.getContext('2d'); const im = pg.createImageData(PS * 2, PS); const d = im.data;
      const res = new Float32Array(PS * PS); let m = 1e-6;
      for (let y = 0; y < PS; y++) for (let x = 0; x < PS; x++) {
        let s = 0; for (let ky = 0; ky < 3; ky++) for (let kx = 0; kx < 3; kx++) { const iy = Math.min(PS - 1, Math.max(0, y + ky - 1)); const ix = Math.min(PS - 1, Math.max(0, x + kx - 1)); s += big[iy * PS + ix] * K[ky * 3 + kx]; }
        res[y * PS + x] = s; m = Math.max(m, Math.abs(s));
      }
      const pos = positive();
      for (let y = 0; y < PS; y++) for (let x = 0; x < PS; x++) {
        const o1 = (y * PS * 2 + x) * 4; const c = big[y * PS + x] * 255; d[o1] = d[o1 + 1] = d[o1 + 2] = c; d[o1 + 3] = 255;
        const o2 = (y * PS * 2 + x + PS) * 4; const v = res[y * PS + x];
        if (pos) { const cc = Math.max(0, Math.min(1, v)) * 255; d[o2] = d[o2 + 1] = d[o2 + 2] = cc; } else { const t = Math.max(-1, Math.min(1, v / m)); const col = t >= 0 ? [94, 234, 212] : [251, 113, 133]; const k = Math.abs(t) ** 0.7; for (let q = 0; q < 3; q++) d[o2 + q] = 14 + (col[q] - 14) * k; }
        d[o2 + 3] = 255;
      }
      pg.putImageData(im, 0, 0);
      drawPreview();
    }
    function drawPreview() { const G = pv.ctx; if (!pv.w) return; G.imageSmoothingEnabled = false; G.drawImage(pvOff, 0, 0, pv.w, pv.h); G.font = MONO; G.fillStyle = 'rgba(10,10,10,.7)'; G.fillRect(4, 4, 52, 16); G.fillRect(pv.w / 2 + 4, 4, 64, 16); G.fillStyle = C0.text2; G.fillText('before', 9, 16); G.fillText('after', pv.w / 2 + 9, 16); }
    pv.onResize(drawPreview);

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>The kernel is a little stencil of 9 weights. Put it on top of 9 pixels, multiply each pixel by the weight above it, add the 9 results, and write that one number in the output. Then slide over and do it again.</p>
      <p>The output is called a <b>feature map</b>. It lights up wherever the patch looks like the kernel. Edge x has negative weights on the left and positive on the right, so it fires where the image gets brighter from left to right: a vertical edge. <span style="color:#5EEAD4">Teal</span> is positive, <span style="color:#FB7185">rose</span> negative.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li>Watch Edge x sweep the shapes. The left side of the square goes one colour and the right side the other, and flat areas give 0.</li>
      <li>Switch to Edge y: now the top and bottom of the square light up instead.</li>
      <li>Try Blur on the bigger picture below. Each pixel becomes a weighted average of its neighbours.</li>
      <li>Set stride 2. The kernel jumps two pixels at a time and the output is about half as wide.</li>
      <li>Press <b>Pooling</b> on the stage to see how a 2 × 2 max pool shrinks the feature map but keeps the strong responses.</li></ol></div>`));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div class="card deep">
      <div class="formula">out[i, j] = Σ<sub>u,v</sub> K[u, v] · in[i·s + u − p, j·s + v − p]<span>output size = ⌊(n + 2p − k) / s⌋ + 1</span></div>
      <p>Strictly, this is <b>cross-correlation</b>: textbook convolution flips the kernel first. Deep learning libraries skip the flip and still call it convolution, which makes no difference when the weights are learned.</p>
      <p>The big ideas: the same 9 weights are reused at every position (<b>weight sharing</b>), so a 3 × 3 filter has 9 weights (plus a bias) whatever the image size. And each output only looks at a small patch (<b>local connectivity</b>). A fully connected layer from a 224 × 224 image to one neuron already needs 50,176 weights.</p>
      <p><b>Max pooling</b> takes the largest value in each 2 × 2 block. It halves width and height, keeps the strongest signal, and makes the result a little less sensitive to small shifts. Many newer networks use stride 2 convolutions instead.</p>
      <p>On colour images a kernel is 3 × 3 × 3 (one slice per channel), and in a CNN a layer has many kernels, each making its own feature map. In a CNN the kernel weights are not hand picked like these: they are learned by backprop.</p>
    </div></details>`));

    // ---------- dock ----------
    const dock = ctx.h(`<div class="dock"><div class="grp glass"><button data-a="play">Pause</button><button data-a="step">Step</button><button data-a="fill">Finish</button><button data-a="draw">Draw</button></div>
      <div class="grp glass"><button data-m="conv" class="on">Convolve</button><button data-m="pool">Pooling</button></div></div>`);
    ctx.stage.append(dock);
    const playB = dock.querySelector('[data-a=play]'); const drawB = dock.querySelector('[data-a=draw]');
    const syncPlay = () => { playB.textContent = playing ? 'Pause' : 'Play'; playB.classList.toggle('on', playing); };
    function setDraw(v) { drawing = v; drawB.classList.toggle('on', v); cv.el.style.cursor = v ? 'crosshair' : 'default'; cv.el.style.touchAction = v ? 'none' : 'pan-y'; }
    dock.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'play') { playing = !playing; if (playing && curPos() >= curTotal() - 1) setPos(0); syncPlay(); }
      if (b.dataset.a === 'step') { playing = false; syncPlay(); setPos(Math.min(curTotal() - 1, curPos() + 1)); }
      if (b.dataset.a === 'fill') { playing = false; syncPlay(); setPos(curTotal() - 1); }
      if (b.dataset.a === 'draw') { setDraw(!drawing); if (drawing && mode !== 'conv') setMode('conv'); }
      if (b.dataset.m) setMode(b.dataset.m);
    }, { signal: ctx.signal });
    function setMode(m) { mode = m; dock.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('on', x.dataset.m === m)); ppos = 0; if (m === 'pool') { pos = OW * OH - 1; playing = !reduce; syncPlay(); } }
    const curPos = () => (mode === 'conv' ? pos : ppos); const curTotal = () => (mode === 'conv' ? OW * OH : PW * PH);
    const setPos = (v) => { if (mode === 'conv') pos = v; else ppos = v; };

    function restart() {
      conv(); pos = 0; ppos = 0; acc = 0; if (!reduce) playing = true; syncPlay(); updatePreview();
      sizeNote.innerHTML = `output size = ⌊(${N} + 2×${pad} − 3) / ${stride}⌋ + 1 = ${OW}<span>${N} × ${N} input, 3 × 3 kernel, stride ${stride}, padding ${pad}</span>`;
    }
    syncKernel(); restart(); syncPlay();
    if (reduce) pos = OW * OH - 1;

    ctx.loop((t, dt) => {
      if (playing) {
        acc += dt * rate;
        while (acc >= 1) { acc -= 1; if (curPos() < curTotal() - 1) setPos(curPos() + 1); else { playing = false; syncPlay(); break; } }
      }
      draw();
    });

    ctx.quiz([
      { q: 'A 3 × 3 kernel sits on a patch where every pixel is 0.5. The kernel is Edge x (its weights add up to 0). What is the output?', choices: ['0', '0.5', '4.5'], answer: 0, why: 'Each pixel is 0.5, so the sum is 0.5 times the sum of the weights, which is 0. Flat areas give no edge response.' },
      { q: 'You convolve a 20 × 20 image with a 3 × 3 kernel, stride 1, no padding. How big is the output?', choices: ['20 × 20', '18 × 18', '10 × 10'], answer: 1, why: '(20 − 3) / 1 + 1 = 18. The kernel cannot hang over the edge without padding, so you lose one pixel on each side.' },
      { q: 'What does 2 × 2 max pooling do to a feature map?', choices: ['Doubles its size', 'Halves its width and height, keeping the largest value in each 2 × 2 block', 'Blurs it with a 2 × 2 kernel'], answer: 1, why: 'Pooling summarises each block by its strongest response, shrinking the map by 4 times while keeping the important signals.' },
    ]);
  },
};
