// Neural network playground: a small multilayer perceptron written from scratch, trained live with backprop and mini-batch SGD.
const MONO = '500 11px "DM Mono", monospace';
const POS = [96, 165, 250]; // sky: class 1 and positive weights
const NEG = [251, 191, 36]; // amber: class 0 and negative weights
const BG = [20, 20, 20];
const GRID = 48;

const FEATS = [
  { id: 'x1', label: 'x₁', f: (a) => a },
  { id: 'x2', label: 'x₂', f: (a, b) => b },
  { id: 'x1sq', label: 'x₁²', f: (a) => a * a },
  { id: 'x2sq', label: 'x₂²', f: (a, b) => b * b },
  { id: 'x1x2', label: 'x₁x₂', f: (a, b) => a * b },
  { id: 'sin1', label: 'sin πx₁', f: (a) => Math.sin(Math.PI * a) },
  { id: 'sin2', label: 'sin πx₂', f: (a, b) => Math.sin(Math.PI * b) },
];

const ACTS = {
  tanh: { f: (z) => Math.tanh(z), d: (z, a) => 1 - a * a, vis: (v) => v },
  relu: { f: (z) => (z > 0 ? z : 0), d: (z) => (z > 0 ? 1 : 0), vis: (v) => Math.min(1, v) },
  sigmoid: { f: (z) => 1 / (1 + Math.exp(-z)), d: (z, a) => a * (1 - a), vis: (v) => 2 * v - 1 },
  linear: { f: (z) => z, d: () => 1, vis: (v) => Math.max(-1, Math.min(1, v)) },
};

function gauss() { let u = 0; let v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

function makeData(kind, noise, n = 400) {
  const X = []; const Y = [];
  const push = (x, y, c) => { X.push([Math.max(-1, Math.min(1, x)), Math.max(-1, Math.min(1, y))]); Y.push(c); };
  const s = noise * 0.35;
  if (kind === 'circle') {
    for (let i = 0; i < n; i++) {
      const inner = i % 2 === 0; const r = inner ? Math.random() * 0.4 : 0.6 + Math.random() * 0.35; const t = Math.random() * Math.PI * 2;
      push(r * Math.cos(t) + gauss() * s, r * Math.sin(t) + gauss() * s, inner ? 1 : 0);
    }
  } else if (kind === 'xor') {
    for (let i = 0; i < n; i++) {
      let x = Math.random() * 1.9 - 0.95; let y = Math.random() * 1.9 - 0.95;
      x += x > 0 ? 0.04 : -0.04; y += y > 0 ? 0.04 : -0.04;
      push(x + gauss() * s, y + gauss() * s, x * y > 0 ? 1 : 0);
    }
  } else if (kind === 'gauss') {
    for (let i = 0; i < n; i++) {
      const c = i % 2; const m = c ? 0.42 : -0.42; const sd = 0.17 + noise * 0.3;
      push(m + gauss() * sd, m + gauss() * sd, c);
    }
  } else {
    const half = n / 2;
    for (let i = 0; i < n; i++) {
      const c = i % 2; const k = Math.floor(i / 2); const r = (k / half) * 0.92 + 0.04; const t = 1.75 * (k / half) * 2 * Math.PI + c * Math.PI;
      push(r * Math.sin(t) + gauss() * s, r * Math.cos(t) + gauss() * s, c);
    }
  }
  // shuffle then split
  for (let i = X.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [X[i], X[j]] = [X[j], X[i]]; [Y[i], Y[j]] = [Y[j], Y[i]]; }
  return { X, Y };
}

// Diverging colour lookup: index 0 = -1 (amber), 255 = +1 (sky), 128 = background
const LUT = new Uint8ClampedArray(256 * 3);
for (let i = 0; i < 256; i++) {
  const v = i / 255 * 2 - 1; const c = v < 0 ? NEG : POS; const a = Math.min(1, Math.abs(v)) ** 0.85 * 0.92;
  for (let k = 0; k < 3; k++) LUT[i * 3 + k] = BG[k] + (c[k] - BG[k]) * a;
}
const lutIdx = (v) => Math.max(0, Math.min(255, Math.round((v + 1) * 127.5)));

export default {
  mount(ctx) {
    const C0 = ctx.colors;
    const cv = ctx.canvas();
    const g = cv.ctx;

    // ---------- state ----------
    let dataset = 'circle'; let noise = 0.1; let trainFrac = 0.7;
    let hidden = [4, 2]; let actName = 'tanh'; let lr = 0.03; let batch = 10; let l2 = 0;
    let feats = new Set(['x1', 'x2']);
    let showTest = false; let discretize = false; let playing = false;
    let data; let nTrain = 0; let nTest = 0; let Ftr; let Ytr; let Fte; let Yte; let order;
    let net; let epoch = 0; let hist = []; let lossTr = 0; let lossTe = 0;
    let hoverNode = null; let pinNode = null;

    const featList = () => FEATS.filter((f) => feats.has(f.id));

    function buildData() {
      data = makeData(dataset, noise);
      nTrain = Math.round(data.X.length * trainFrac); nTest = data.X.length - nTrain;
      buildFeatures();
    }
    function buildFeatures() {
      const fl = featList(); const nf = fl.length;
      Ftr = new Float32Array(nTrain * nf); Ytr = new Float32Array(nTrain);
      Fte = new Float32Array(nTest * nf); Yte = new Float32Array(nTest);
      data.X.forEach(([a, b], i) => {
        const tgt = i < nTrain ? Ftr : Fte; const r = i < nTrain ? i : i - nTrain;
        fl.forEach((f, k) => { tgt[r * nf + k] = f.f(a, b); });
        (i < nTrain ? Ytr : Yte)[r] = data.Y[i];
      });
      order = new Uint32Array(nTrain).map((_, i) => i);
      // grid features
      gridF = new Float32Array(GRID * GRID * nf);
      for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
        const a = (gx + 0.5) / GRID * 2 - 1; const b = 1 - (gy + 0.5) / GRID * 2;
        fl.forEach((f, k) => { gridF[(gy * GRID + gx) * nf + k] = f.f(a, b); });
      }
    }
    let gridF;

    function buildNet() {
      const sizes = [featList().length, ...hidden, 1];
      const L = sizes.length - 1;
      const W = []; const B = []; const gW = []; const gB = [];
      for (let l = 0; l < L; l++) {
        const nin = sizes[l]; const nout = sizes[l + 1];
        const sc = Math.sqrt((actName === 'relu' && l < L - 1 ? 2 : 1) / nin);
        W.push(new Float32Array(nin * nout).map(() => gauss() * sc));
        B.push(new Float32Array(nout).fill(actName === 'relu' && l < L - 1 ? 0.05 : 0));
        gW.push(new Float32Array(nin * nout)); gB.push(new Float32Array(nout));
      }
      const A = sizes.map((s) => new Float32Array(s)); const Z = sizes.map((s) => new Float32Array(s)); const D = sizes.map((s) => new Float32Array(s));
      net = { sizes, L, W, B, gW, gB, A, Z, D };
      // per neuron grid maps for drawing
      maps = sizes.map((s) => Array.from({ length: s }, () => new Float32Array(GRID * GRID)));
      tiles = sizes.map((s) => Array.from({ length: s }, () => { const c = document.createElement('canvas'); c.width = GRID; c.height = GRID; return c; }));
      epoch = 0; hist = []; computeLoss(); layout(); evalGrid();
    }
    let maps = []; let tiles = [];

    function forward(F, off) {
      const { L, W, B, A, Z, sizes } = net; const act = ACTS[actName].f;
      const a0 = A[0]; for (let i = 0; i < sizes[0]; i++) a0[i] = F[off + i];
      for (let l = 0; l < L; l++) {
        const nin = sizes[l]; const nout = sizes[l + 1]; const w = W[l]; const b = B[l]; const ai = A[l]; const ao = A[l + 1]; const zo = Z[l + 1];
        const last = l === L - 1;
        for (let j = 0; j < nout; j++) {
          let z = b[j]; const r = j * nin;
          for (let i = 0; i < nin; i++) z += w[r + i] * ai[i];
          zo[j] = z; ao[j] = last ? 1 / (1 + Math.exp(-z)) : act(z);
        }
      }
      return A[L][0];
    }

    function trainEpoch() {
      const { L, W, B, gW, gB, A, Z, D, sizes } = net; const dact = ACTS[actName].d; const nf = sizes[0];
      for (let i = nTrain - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t; }
      for (let s = 0; s < nTrain; s += batch) {
        const m = Math.min(batch, nTrain - s);
        for (let l = 0; l < L; l++) { gW[l].fill(0); gB[l].fill(0); }
        for (let q = 0; q < m; q++) {
          const idx = order[s + q];
          const p = forward(Ftr, idx * nf);
          D[L][0] = p - Ytr[idx]; // sigmoid + cross entropy gives this simple error
          for (let l = L - 1; l >= 0; l--) {
            const nin = sizes[l]; const nout = sizes[l + 1]; const w = W[l]; const gw = gW[l]; const gb = gB[l]; const ai = A[l]; const dOut = D[l + 1];
            for (let j = 0; j < nout; j++) { const dj = dOut[j]; gb[j] += dj; const r = j * nin; for (let i = 0; i < nin; i++) gw[r + i] += dj * ai[i]; }
            if (l > 0) {
              const dIn = D[l]; const zi = Z[l];
              for (let i = 0; i < nin; i++) { let sum = 0; for (let j = 0; j < nout; j++) sum += w[j * nin + i] * dOut[j]; dIn[i] = sum * dact(zi[i], ai[i]); }
            }
          }
        }
        const k = lr / m;
        for (let l = 0; l < L; l++) {
          const w = W[l]; const gw = gW[l]; for (let i = 0; i < w.length; i++) w[i] -= k * gw[i] + lr * l2 * w[i];
          const b = B[l]; const gb = gB[l]; for (let i = 0; i < b.length; i++) b[i] -= k * gb[i];
        }
      }
      epoch++;
      computeLoss();
    }

    function lossOn(F, Y, n) {
      const nf = net.sizes[0]; let s = 0;
      for (let i = 0; i < n; i++) { const p = Math.min(1 - 1e-7, Math.max(1e-7, forward(F, i * nf))); s -= Y[i] ? Math.log(p) : Math.log(1 - p); }
      return n ? s / n : 0;
    }
    function computeLoss() {
      lossTr = lossOn(Ftr, Ytr, nTrain); lossTe = lossOn(Fte, Yte, nTest);
      hist.push([lossTr, lossTe]);
      if (hist.length > 600) hist = hist.filter((_, i) => i % 2 === 0);
      updateReadout();
    }

    function evalGrid() {
      const { L, A, sizes } = net; const nf = sizes[0]; const vis = ACTS[actName].vis;
      const max = sizes.map(() => 1e-6);
      for (let p = 0; p < GRID * GRID; p++) {
        forward(gridF, p * nf);
        for (let l = 0; l <= L; l++) { const a = A[l]; const m = maps[l]; for (let j = 0; j < a.length; j++) { m[j][p] = a[j]; if (Math.abs(a[j]) > max[l]) max[l] = Math.abs(a[j]); } }
      }
      for (let l = 0; l <= L; l++) for (let j = 0; j < sizes[l]; j++) {
        const c = tiles[l][j]; const cg = c.getContext('2d'); const img = cg.createImageData(GRID, GRID); const d = img.data; const m = maps[l][j];
        for (let p = 0; p < GRID * GRID; p++) {
          let v;
          if (l === L) v = discretize ? (m[p] > 0.5 ? 1 : -1) : 2 * m[p] - 1;
          else if (l === 0) v = m[p] / max[0 + 0] * 1; // features are already in [-1, 1]
          else if (actName === 'relu' || actName === 'linear') v = m[p] / Math.max(1, max[l]);
          else v = vis(m[p]);
          const k = lutIdx(v) * 3; d[p * 4] = LUT[k]; d[p * 4 + 1] = LUT[k + 1]; d[p * 4 + 2] = LUT[k + 2]; d[p * 4 + 3] = 255;
        }
        cg.putImageData(img, 0, 0);
      }
    }

    // ---------- layout ----------
    let LY = null;
    const ctlWrap = document.createElement('div');
    ctlWrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5';
    ctx.stage.append(ctlWrap);
    function layout() {
      const W = cv.w; const H = cv.h; if (!W || !net) return;
      const wide = W >= 640;
      const dockH = 50;
      let dg; let out; let loss;
      if (wide) {
        const outS = Math.min(W * 0.4, H - dockH - 150);
        out = { x: W - outS - 4, y: 30, s: outS };
        loss = { x: out.x, y: out.y + outS + 36, w: outS, h: Math.min(110, H - dockH - (out.y + outS + 36) - 6) };
        dg = { x: 4, y: 52, w: out.x - 40, h: H - dockH - 64 };
      } else {
        const outS = Math.min(W * 0.52, H * 0.42);
        dg = { x: 0, y: 40, w: W, h: H - outS - dockH - 64 };
        out = { x: 0, y: H - dockH - outS - 4, s: outS };
        loss = { x: outS + 12, y: out.y + 18, w: W - outS - 14, h: outS - 24 };
      }
      const cols = net.sizes.length; const colW = dg.w / cols;
      const maxN = Math.max(...net.sizes);
      const box = Math.max(16, Math.min(wide ? 62 : 40, colW * 0.42, (dg.h / maxN) * 0.72));
      const nodes = net.sizes.map((s, l) => {
        const x = dg.x + colW * (l + 0.5); const gap = Math.min(box * 1.45, dg.h / Math.max(1, s));
        const y0 = dg.y + dg.h / 2 - (gap * (s - 1)) / 2;
        return Array.from({ length: s }, (_, j) => ({ x, y: y0 + j * gap }));
      });
      LY = { wide, dg, out, loss, nodes, box, colW };
      // layer +/- controls over each hidden column
      ctlWrap.innerHTML = '';
      hidden.forEach((n, i) => {
        const x = nodes[i + 1][0].x;
        const el = document.createElement('div');
        el.style.cssText = `position:absolute;left:${x}px;top:${dg.y - 40}px;transform:translateX(-50%);display:flex;align-items:center;gap:2px;pointer-events:auto;font:500 11px var(--f-mono);color:var(--muted)`;
        const bs = 'width:22px;height:22px;border-radius:6px;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text);padding:0;font:500 14px/1 var(--f-mono)';
        el.innerHTML = `<button aria-label="Fewer neurons in layer ${i + 1}" style="${bs}">−</button><span style="min-width:16px;text-align:center">${n}</span><button aria-label="More neurons in layer ${i + 1}" style="${bs}">+</button>`;
        const [mi, pl] = el.querySelectorAll('button');
        mi.onclick = () => { if (hidden[i] > 1) { hidden[i]--; rebuild(); } };
        pl.onclick = () => { if (hidden[i] < 8) { hidden[i]++; rebuild(); } };
        ctlWrap.append(el);
      });
    }
    cv.onResize(() => layout());

    // ---------- drawing ----------
    function drawNet(t) {
      const { nodes, box } = LY; const { W } = net; const half = box / 2;
      // edges
      for (let l = 0; l < net.L; l++) {
        const nin = net.sizes[l]; const a = nodes[l]; const b = nodes[l + 1];
        for (let j = 0; j < b.length; j++) for (let i = 0; i < nin; i++) {
          const w = W[l][j * nin + i]; const mag = Math.min(1, Math.abs(w) / 2);
          const c = w >= 0 ? POS : NEG;
          g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${0.18 + mag * 0.7})`;
          g.lineWidth = 0.5 + mag * 4.5;
          const x0 = a[i].x + half; const y0 = a[i].y; const x1 = b[j].x - half; const y1 = b[j].y; const mx = (x0 + x1) / 2;
          g.beginPath(); g.moveTo(x0, y0); g.bezierCurveTo(mx, y0, mx, y1, x1, y1); g.stroke();
          if (playing && mag > 0.08) {
            // a dot that drifts along the edge while training, speed tied to weight size
            const u = ((t * (0.25 + mag * 0.5) + (i * 0.37 + j * 0.61)) % 1);
            const iu = 1 - u; const px = iu * iu * iu * x0 + 3 * iu * iu * u * mx + 3 * iu * u * u * mx + u * u * u * x1; const py = iu * iu * iu * y0 + 3 * iu * iu * u * y0 + 3 * iu * u * u * y1 + u * u * u * y1;
            g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.9)`; g.beginPath(); g.arc(px, py, 1.4 + mag, 0, 7); g.fill();
          }
        }
      }
      // nodes
      g.imageSmoothingEnabled = true;
      const fl = featList();
      for (let l = 0; l < nodes.length; l++) for (let j = 0; j < nodes[l].length; j++) {
        const n = nodes[l][j]; const x = n.x - half; const y = n.y - half;
        g.drawImage(tiles[l][j], x, y, box, box);
        const sel = (hoverNode && hoverNode[0] === l && hoverNode[1] === j) || (pinNode && pinNode[0] === l && pinNode[1] === j);
        g.strokeStyle = sel ? C0.text : C0.borderStrong; g.lineWidth = sel ? 2 : 1; g.strokeRect(x + 0.5, y + 0.5, box - 1, box - 1);
        if (l > 0) { // bias as a small dot
          const bv = net.B[l - 1][j]; const c = bv >= 0 ? POS : NEG; g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
          g.beginPath(); g.arc(x, y + box, 1.2 + Math.min(box / 14, Math.abs(bv) * 1.5), 0, 7); g.fill();
        }
      }
      g.font = MONO; g.fillStyle = C0.muted; g.textAlign = 'right';
      nodes[0].forEach((n, j) => g.fillText(fl[j].label, n.x - half - 5, n.y + 4));
      g.textAlign = 'center';
      const lab = (l) => (l === 0 ? 'input' : l === nodes.length - 1 ? 'output' : `layer ${l}`);
      nodes.forEach((col, l) => g.fillText(lab(l), col[0].x, LY.dg.y - 6));
    }

    function drawOutput() {
      const { out } = LY; const node = hoverNode || pinNode; const L = net.L;
      const [l, j] = node || [L, 0];
      g.imageSmoothingEnabled = true;
      g.drawImage(tiles[l][j], out.x, out.y, out.s, out.s);
      g.fillStyle = 'rgba(10,10,10,0.42)'; g.fillRect(out.x, out.y, out.s, out.s); // calmer so the dots stay readable
      g.strokeStyle = C0.borderStrong; g.lineWidth = 1; g.strokeRect(out.x + 0.5, out.y + 0.5, out.s - 1, out.s - 1);
      // axes
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(out.x + out.s / 2, out.y); g.lineTo(out.x + out.s / 2, out.y + out.s); g.moveTo(out.x, out.y + out.s / 2); g.lineTo(out.x + out.s, out.y + out.s / 2); g.stroke();
      const r = out.s > 300 ? 3.2 : 2.4;
      const P = (i) => [out.x + (data.X[i][0] + 1) / 2 * out.s, out.y + (1 - data.X[i][1]) / 2 * out.s];
      for (let i = 0; i < nTrain; i++) {
        const [x, y] = P(i); const c = data.Y[i] ? C0.c5 : C0.c2;
        g.fillStyle = c; g.strokeStyle = '#0A0A0A'; g.lineWidth = 1; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
      }
      if (showTest) for (let i = nTrain; i < data.X.length; i++) {
        const [x, y] = P(i); g.strokeStyle = data.Y[i] ? C0.c5 : C0.c2; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, r + 0.8, 0, 7); g.stroke();
      }
      g.font = MONO; g.textAlign = 'left'; g.fillStyle = C0.muted;
      const title = node ? (l === 0 ? `input feature ${featList()[j].label}` : l === L ? 'output' : `layer ${l}, neuron ${j + 1}`) : 'output: the network’s answer';
      g.fillText(title, out.x, out.y - 9);
    }

    function drawLoss() {
      const { loss } = LY; if (loss.h < 30) return;
      const { x, y, w, h } = loss;
      g.font = MONO; g.textAlign = 'left';
      g.fillStyle = C0.text2; g.fillText(`train ${lossTr.toFixed(3)}`, x, y - 8);
      g.fillStyle = C0.c3; g.fillText(`test ${lossTe.toFixed(3)}`, x + (LY.wide ? 110 : Math.min(96, w / 2)), y - 8);
      g.strokeStyle = C0.border; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      if (hist.length < 2) return;
      const max = Math.max(0.1, ...hist.slice(0, 5).flat(), ...hist.map((v) => v[0]));
      const X = (i) => x + 2 + i / (hist.length - 1) * (w - 4); const Y = (v) => y + h - 2 - Math.min(1, v / max) * (h - 6);
      g.lineWidth = 1.5;
      g.strokeStyle = C0.c3; g.setLineDash([4, 3]); g.beginPath(); hist.forEach((v, i) => (i ? g.lineTo(X(i), Y(v[1])) : g.moveTo(X(i), Y(v[1])))); g.stroke(); g.setLineDash([]);
      g.strokeStyle = C0.text2; g.beginPath(); hist.forEach((v, i) => (i ? g.lineTo(X(i), Y(v[0])) : g.moveTo(X(i), Y(v[0])))); g.stroke();
    }

    function draw(t) {
      if (!LY || !cv.w) return;
      g.clearRect(0, 0, cv.w, cv.h);
      drawNet(t); drawOutput(); drawLoss();
      g.font = MONO; g.textAlign = 'left'; g.fillStyle = C0.muted;
      const lb = LY.loss; if (lb.h >= 30) { g.textAlign = 'right'; g.fillText(`epoch ${epoch}`, lb.x + lb.w - 6, lb.y + 16); }
    }

    // ---------- pointer: inspect a neuron ----------
    function hit(x, y) {
      if (!LY) return null; const half = LY.box / 2 + 3;
      for (let l = 0; l < LY.nodes.length; l++) for (let j = 0; j < LY.nodes[l].length; j++) { const n = LY.nodes[l][j]; if (Math.abs(n.x - x) < half && Math.abs(n.y - y) < half) return [l, j]; }
      return null;
    }
    const pos = (e) => { const r = cv.el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.el.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { hoverNode = hit(...pos(e)); cv.el.style.cursor = hoverNode ? 'pointer' : 'default'; } }, { signal: ctx.signal });
    cv.el.addEventListener('pointerleave', () => { hoverNode = null; }, { signal: ctx.signal });
    cv.el.addEventListener('click', (e) => { const h = hit(...pos(e)); pinNode = h && !(pinNode && pinNode[0] === h[0] && pinNode[1] === h[1]) ? h : null; }, { signal: ctx.signal });

    // ---------- panel ----------
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Neural network playground</h2>'),
      ctx.h('<p class="lede">Stack simple neurons into layers and the straight line from the last chapter learns to bend into circles, checkerboards and spirals. Press play and watch it learn.</p>'),
    );
    const readout = ctx.h('<div class="stat"><div><b class="r-e">0</b><span>Epoch</span></div><div><b class="r-tr">-</b><span>Train loss</span></div><div><b class="r-te">-</b><span>Test loss</span></div></div>');
    function updateReadout() {
      readout.querySelector('.r-e').textContent = String(epoch);
      readout.querySelector('.r-tr').textContent = lossTr.toFixed(3);
      readout.querySelector('.r-te').textContent = lossTe.toFixed(3);
    }
    ctx.panel.append(readout);

    ctx.panel.append(ctx.h('<h3>Data</h3>'));
    ctx.panel.append(ctx.seg([['circle', 'Circle'], ['xor', 'XOR'], ['gauss', 'Two blobs'], ['spiral', 'Spiral']], dataset, (v) => { dataset = v; buildData(); buildNet(); }));
    ctx.panel.append(ctx.slider({ label: 'Noise', min: 0, max: 0.5, step: 0.05, value: noise, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => { noise = v; buildData(); buildFeatures(); computeLoss(); evalGrid(); } }));
    const chk = ctx.h('<div class="row"><label class="check"><input type="checkbox" class="c-test"> show test data</label><label class="check"><input type="checkbox" class="c-disc"> sharp boundary</label></div>');
    chk.querySelector('.c-test').addEventListener('change', (e) => { showTest = e.target.checked; });
    chk.querySelector('.c-disc').addEventListener('change', (e) => { discretize = e.target.checked; evalGrid(); });
    ctx.panel.append(chk);

    ctx.panel.append(ctx.h('<h3>Network</h3>'), ctx.h('<p class="hint">Input features fed to the first layer:</p>'));
    const chips = ctx.h(`<div class="row">${FEATS.map((f) => `<button class="chip ${feats.has(f.id) ? 'on' : ''}" data-f="${f.id}">${f.label}</button>`).join('')}</div>`);
    chips.addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return; const id = b.dataset.f;
      if (feats.has(id)) { if (feats.size === 1) return; feats.delete(id); } else feats.add(id);
      b.classList.toggle('on', feats.has(id)); buildFeatures(); buildNet();
    });
    ctx.panel.append(chips);
    ctx.panel.append(ctx.h('<p class="hint">Hidden layers (use + and − on the stage for neurons):</p>'));
    const layersSeg = ctx.seg([0, 1, 2, 3, 4].map((n) => [n, String(n)]), hidden.length, (v) => {
      while (hidden.length < v) hidden.push(hidden.length ? Math.max(2, hidden[hidden.length - 1]) : 4);
      hidden.length = v; rebuild();
    });
    ctx.panel.append(layersSeg);
    ctx.panel.append(ctx.h('<p class="hint">Activation in hidden layers:</p>'));
    ctx.panel.append(ctx.seg([['tanh', 'Tanh'], ['relu', 'ReLU'], ['sigmoid', 'Sigmoid'], ['linear', 'Linear']], actName, (v) => { actName = v; rebuild(); }));
    ctx.panel.append(ctx.h('<p class="hint">Learning rate:</p>'));
    ctx.panel.append(ctx.seg([0.001, 0.01, 0.03, 0.1, 0.3, 1, 3].map((v) => [v, String(v)]), lr, (v) => { lr = +v; }));
    ctx.panel.append(ctx.slider({ label: 'Batch size', min: 1, max: 30, step: 1, value: batch, onInput: (v) => { batch = v; } }));
    ctx.panel.append(ctx.h('<p class="hint">L2 regularisation (weight decay):</p>'));
    ctx.panel.append(ctx.seg([0, 0.0003, 0.001, 0.003].map((v) => [v, v ? String(v) : 'off']), 0, (v) => { l2 = +v; }));

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>Each small square is one neuron. Its picture shows how strongly it fires for every spot on the plane: <span style="color:#60A5FA">blue</span> means high, <span style="color:#FBBF24">amber</span> means low.</p>
      <p>The first layer can only draw straight lines. The next layer mixes those lines into corners and bands, and the output mixes those into the final shape on the right. Lines between neurons are weights: thicker means stronger, blue positive, amber negative.</p>
      <p>Training nudges every weight a tiny bit, many times a second, in whatever direction makes the loss (the curve under the output) go down.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li>On <b>Circle</b>, set hidden layers to 0 and press play. A single line cannot wrap around a circle, so the loss stays high.</li>
      <li>Now add one layer with 3 neurons. Three straight lines are enough to fence in the middle.</li>
      <li>Back to 0 layers, but turn on the x₁² and x₂² features. A circle is a straight line in that space, so even no hidden layers can solve it.</li>
      <li>Pick <b>Spiral</b>. Try 3 layers of 8 neurons with Tanh. It takes a while and the shape grows outward.</li>
      <li>Set the learning rate to 3. Watch the loss jump around instead of settling.</li>
      <li>Hover or tap any neuron to see its picture big on the right.</li></ol></div>`));

    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div class="card deep">
      <p>Each neuron computes a = f(w · x + b). The output neuron uses a sigmoid, so it gives a probability p of the blue class, and the loss is binary cross entropy:</p>
      <div class="formula">L = −[y log p + (1 − y) log(1 − p)]<span>averaged over the training points</span></div>
      <p>Backpropagation applies the chain rule layer by layer to get ∂L/∂w for every weight (the next chapter steps through it). With a sigmoid output and this loss, the error at the output is simply p − y.</p>
      <p><b>Mini-batch SGD</b>: shuffle the training points, take them a batch at a time, average the gradients over the batch, then update w ← w − η ∂L/∂w. One <b>epoch</b> is one pass over all training points. Small batches are noisy but cheap. Large batches are smoother.</p>
      <p>Weights start random (scaled by 1/√fan-in, or 2/fan-in for ReLU) so neurons do not all learn the same thing. A <b>linear</b> activation collapses any number of layers into one straight line, which is why non linear activations matter.</p>
      <p><b>Train versus test</b>: the network only learns from the filled dots. The rings are held back. If train loss keeps falling while test loss rises, it is memorising noise. L2 regularisation pulls weights toward zero to fight that.</p>
      <p>Everything here runs in about 200 lines of plain JavaScript, with Float32Array buffers. Real libraries do the same maths on GPUs for billions of weights.</p>
    </div></details>`));

    // ---------- dock ----------
    const dock = ctx.h('<div class="dock"><div class="grp glass"><button data-a="play">Play</button><button data-a="step">Step</button><button data-a="reset">Reset</button><button data-a="data">New data</button></div></div>');
    ctx.stage.append(dock);
    const playBtn = dock.querySelector('[data-a=play]');
    const syncPlay = () => { playBtn.textContent = playing ? 'Pause' : 'Play'; playBtn.classList.toggle('on', playing); };
    dock.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'play') { playing = !playing; syncPlay(); }
      if (a === 'step') { playing = false; syncPlay(); trainEpoch(); evalGrid(); }
      if (a === 'reset') { buildNet(); }
      if (a === 'data') { buildData(); computeLoss(); evalGrid(); }
    }, { signal: ctx.signal });

    function rebuild() { pinNode = null; hoverNode = null; layersSeg.set(hidden.length); buildNet(); }

    buildData(); buildNet();
    updateReadout();

    ctx.loop((t) => {
      if (playing) {
        const t0 = performance.now(); let n = 0;
        // one epoch per frame, more if it is cheap, never more than ~9 ms
        do { trainEpoch(); n++; } while (n < 3 && performance.now() - t0 < 4);
        evalGrid();
      }
      draw(t);
    });

    ctx.quiz([
      { q: 'With zero hidden layers and only x₁, x₂ as inputs, why can the network not separate the circle data?', choices: ['The learning rate is too small', 'One neuron can only draw a straight line, and no straight line separates inside from outside of a circle', 'There are not enough training points'], answer: 1, why: 'Without hidden layers the output is a single neuron, whose boundary is a line. Hidden layers combine several lines into curved shapes.' },
      { q: 'What does one epoch mean here?', choices: ['One weight update', 'One pass through all the training points, in mini-batches', 'One hidden layer'], answer: 1, why: 'Each epoch shuffles the training set and walks through it a batch at a time, making one update per batch.' },
      { q: 'Train loss keeps going down but test loss starts going up. What is happening?', choices: ['The network is overfitting: it fits noise in the training points that does not generalise', 'The test data is broken', 'The network has stopped learning'], answer: 0, why: 'The held out test points reveal when the model memorises instead of learning the real pattern. More data, a smaller network or regularisation helps.' },
    ]);
  },
};
