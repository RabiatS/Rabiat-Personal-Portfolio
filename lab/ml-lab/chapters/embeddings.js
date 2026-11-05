// Embeddings: toy word vectors built from readable features, projected with PCA, with nearest neighbours and vector arithmetic.

const FEATS = ['royal', 'gender', 'person', 'young', 'family', 'animal', 'wild', 'feline', 'canine', 'food', 'fruit', 'sweet', 'drink', 'vehicle', 'air', 'water', 'place', 'capital', 'france', 'italy', 'japan', 'germany', 'spain', 'feeling', 'valence', 'size', 'describes'];
const FI = Object.fromEntries(FEATS.map((f, i) => [f, i]));

// [word, category, features]. Gender: +0.5 male, -0.5 female.
const W = [
  ['king', 'people', { royal: 1, gender: 0.5, person: 1 }], ['queen', 'people', { royal: 1, gender: -0.5, person: 1 }],
  ['prince', 'people', { royal: 1, gender: 0.5, person: 1, young: 0.8 }], ['princess', 'people', { royal: 1, gender: -0.5, person: 1, young: 0.8 }],
  ['emperor', 'people', { royal: 1.3, gender: 0.5, person: 1 }], ['empress', 'people', { royal: 1.3, gender: -0.5, person: 1 }],
  ['man', 'people', { gender: 0.5, person: 1 }], ['woman', 'people', { gender: -0.5, person: 1 }],
  ['boy', 'people', { gender: 0.5, person: 1, young: 0.8 }], ['girl', 'people', { gender: -0.5, person: 1, young: 0.8 }],
  ['father', 'people', { gender: 0.5, person: 1, family: 1 }], ['mother', 'people', { gender: -0.5, person: 1, family: 1 }],
  ['son', 'people', { gender: 0.5, person: 1, family: 1, young: 0.8 }], ['daughter', 'people', { gender: -0.5, person: 1, family: 1, young: 0.8 }],
  ['brother', 'people', { gender: 0.5, person: 1, family: 0.9, young: 0.3 }], ['sister', 'people', { gender: -0.5, person: 1, family: 0.9, young: 0.3 }],
  ['uncle', 'people', { gender: 0.5, person: 1, family: 0.5 }], ['aunt', 'people', { gender: -0.5, person: 1, family: 0.5 }],
  ['husband', 'people', { gender: 0.5, person: 1, family: 0.6 }], ['wife', 'people', { gender: -0.5, person: 1, family: 0.6 }],
  ['cat', 'animals', { animal: 1, feline: 1 }], ['kitten', 'animals', { animal: 1, feline: 1, young: 0.8, size: -0.4 }],
  ['dog', 'animals', { animal: 1, canine: 1 }], ['puppy', 'animals', { animal: 1, canine: 1, young: 0.8, size: -0.4 }],
  ['lion', 'animals', { animal: 1, feline: 1, wild: 1, size: 0.6 }], ['tiger', 'animals', { animal: 1, feline: 1, wild: 1, size: 0.6 }],
  ['wolf', 'animals', { animal: 1, canine: 1, wild: 1 }], ['elephant', 'animals', { animal: 1, wild: 1, size: 1.4 }],
  ['mouse', 'animals', { animal: 1, size: -1 }], ['horse', 'animals', { animal: 1, size: 0.7 }], ['cow', 'animals', { animal: 1, size: 0.7, food: 0.15 }],
  ['whale', 'animals', { animal: 1, wild: 0.8, water: 1, size: 1.6 }], ['shark', 'animals', { animal: 1, wild: 1, water: 1 }],
  ['eagle', 'animals', { animal: 1, wild: 1, air: 1 }], ['sparrow', 'animals', { animal: 1, air: 1, size: -0.7 }],
  ['apple', 'food', { food: 1, fruit: 1, sweet: 0.5 }], ['banana', 'food', { food: 1, fruit: 1, sweet: 0.6 }], ['orange', 'food', { food: 1, fruit: 1, sweet: 0.5 }],
  ['grape', 'food', { food: 1, fruit: 1, sweet: 0.6 }], ['strawberry', 'food', { food: 1, fruit: 1, sweet: 0.8 }],
  ['carrot', 'food', { food: 1 }], ['potato', 'food', { food: 1 }], ['bread', 'food', { food: 1 }], ['cheese', 'food', { food: 1 }],
  ['pizza', 'food', { food: 1, italy: 0.3 }], ['rice', 'food', { food: 1 }], ['cake', 'food', { food: 1, sweet: 1 }], ['chocolate', 'food', { food: 1, sweet: 1.2 }],
  ['soup', 'food', { food: 1, drink: 0.3 }], ['coffee', 'food', { drink: 1 }], ['tea', 'food', { drink: 1 }], ['milk', 'food', { drink: 1, food: 0.3 }],
  ['juice', 'food', { drink: 1, fruit: 0.5, sweet: 0.4 }],
  ['car', 'vehicles', { vehicle: 1 }], ['bus', 'vehicles', { vehicle: 1, size: 0.6 }], ['truck', 'vehicles', { vehicle: 1, size: 0.7 }],
  ['bicycle', 'vehicles', { vehicle: 1, size: -0.5 }], ['train', 'vehicles', { vehicle: 1, size: 0.9 }], ['plane', 'vehicles', { vehicle: 1, air: 1 }],
  ['rocket', 'vehicles', { vehicle: 1, air: 1.3 }], ['boat', 'vehicles', { vehicle: 1, water: 1 }], ['ship', 'vehicles', { vehicle: 1, water: 1, size: 0.9 }],
  ['Paris', 'places', { place: 1, capital: 1, france: 1 }], ['France', 'places', { place: 1, france: 1 }],
  ['Rome', 'places', { place: 1, capital: 1, italy: 1 }], ['Italy', 'places', { place: 1, italy: 1 }],
  ['Tokyo', 'places', { place: 1, capital: 1, japan: 1 }], ['Japan', 'places', { place: 1, japan: 1 }],
  ['Berlin', 'places', { place: 1, capital: 1, germany: 1 }], ['Germany', 'places', { place: 1, germany: 1 }],
  ['Madrid', 'places', { place: 1, capital: 1, spain: 1 }], ['Spain', 'places', { place: 1, spain: 1 }],
  ['happy', 'feelings', { feeling: 1, valence: 1 }], ['joyful', 'feelings', { feeling: 1, valence: 1.2 }], ['calm', 'feelings', { feeling: 1, valence: 0.5 }],
  ['sad', 'feelings', { feeling: 1, valence: -1 }], ['angry', 'feelings', { feeling: 1, valence: -0.9 }], ['afraid', 'feelings', { feeling: 1, valence: -0.8 }],
  ['big', 'size', { describes: 1, size: 1 }], ['huge', 'size', { describes: 1, size: 1.6 }], ['small', 'size', { describes: 1, size: -1 }], ['tiny', 'size', { describes: 1, size: -1.6 }],
];

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const norm = (a) => Math.sqrt(dot(a, a));
const cos = (a, b) => dot(a, b) / (norm(a) * norm(b) || 1);

function pca(X, k) {
  const n = X.length; const d = X[0].length;
  const mean = new Array(d).fill(0); for (const x of X) for (let j = 0; j < d; j++) mean[j] += x[j] / n;
  const Cv = Array.from({ length: d }, () => new Array(d).fill(0));
  for (const x of X) for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) Cv[i][j] += (x[i] - mean[i]) * (x[j] - mean[j]) / n;
  const pcs = []; const r = rng(7);
  for (let c = 0; c < k; c++) {
    let v = Array.from({ length: d }, () => r() - 0.5);
    for (let it = 0; it < 300; it++) {
      const nv = Cv.map((row) => dot(row, v));
      for (const p of pcs) { const pr = dot(nv, p); for (let j = 0; j < d; j++) nv[j] -= pr * p[j]; }
      const nn = norm(nv) || 1; v = nv.map((x) => x / nn);
    }
    pcs.push(v);
  }
  return { mean, pcs };
}

// A small exact t-SNE: keeps each word's close neighbours close in 2D. Used for the default map.
function tsne(X, perp = 10, iters = 700) {
  const n = X.length; const D = [];
  for (let i = 0; i < n; i++) { D.push([]); for (let j = 0; j < n; j++) { let s = 0; for (let k = 0; k < X[i].length; k++) s += (X[i][k] - X[j][k]) ** 2; D[i].push(s); } }
  const P = Array.from({ length: n }, () => new Array(n).fill(0)); const H = Math.log(perp);
  for (let i = 0; i < n; i++) {
    let lo = 0; let hi = Infinity; let beta = 1;
    for (let it = 0; it < 60; it++) {
      let sum = 0; let hs = 0;
      for (let j = 0; j < n; j++) if (j !== i) { const p = Math.exp(-D[i][j] * beta); P[i][j] = p; sum += p; hs += D[i][j] * p; }
      const ent = Math.log(sum || 1e-12) + beta * hs / (sum || 1e-12);
      for (let j = 0; j < n; j++) P[i][j] /= sum || 1;
      if (Math.abs(ent - H) < 1e-4) break;
      if (ent > H) { lo = beta; beta = hi === Infinity ? beta * 2 : (beta + hi) / 2; } else { hi = beta; beta = (beta + lo) / 2; }
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) { const v = Math.max((P[i][j] + P[j][i]) / (2 * n), 1e-12); P[i][j] = v; P[j][i] = v; }
  const r = rng(3); const Y = Array.from({ length: n }, () => [(r() - 0.5) * 1e-2, (r() - 0.5) * 1e-2]);
  const V = Array.from({ length: n }, () => [0, 0]);
  for (let it = 0; it < iters; it++) {
    const ex = it < 120 ? 4 : 1; const mom = it < 250 ? 0.5 : 0.8;
    const Q = []; let qs = 0;
    for (let i = 0; i < n; i++) { Q.push(new Array(n).fill(0)); for (let j = 0; j < n; j++) if (i !== j) { const q = 1 / (1 + (Y[i][0] - Y[j][0]) ** 2 + (Y[i][1] - Y[j][1]) ** 2); Q[i][j] = q; qs += q; } }
    for (let i = 0; i < n; i++) {
      let gx = 0; let gy = 0;
      for (let j = 0; j < n; j++) if (i !== j) { const m = (ex * P[i][j] - Q[i][j] / qs) * Q[i][j]; gx += m * (Y[i][0] - Y[j][0]); gy += m * (Y[i][1] - Y[j][1]); }
      V[i][0] = mom * V[i][0] - 100 * 4 * gx; V[i][1] = mom * V[i][1] - 100 * 4 * gy;
    }
    for (let i = 0; i < n; i++) { Y[i][0] += V[i][0]; Y[i][1] += V[i][1]; }
  }
  // normalise to a unit box, then gently push apart words that landed on top of each other so labels stay readable
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (const [x, y] of Y) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const sc = Math.max(x1 - x0, y1 - y0) || 1;
  for (const p of Y) { p[0] = (p[0] - x0) / sc; p[1] = (p[1] - y0) / sc; }
  for (let it = 0; it < 120; it++) for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const dx = Y[j][0] - Y[i][0]; const dy = (Y[j][1] - Y[i][1]) * 1.6; const d = Math.hypot(dx, dy) || 1e-6; const m = 0.045;
    if (d < m) { const push = (m - d) / 2; const ux = (dx || 1e-3 * (j - i)) / d; const uy = dy / d; Y[i][0] -= ux * push; Y[i][1] -= uy * push / 1.6; Y[j][0] += ux * push; Y[j][1] += uy * push / 1.6; }
  }
  return Y;
}

export default {
  mount(ctx) {
    const C = ctx.colors;
    const CAT = { people: C.c4, animals: C.c2, food: C.c6, vehicles: C.c5, places: C.c3, feelings: C.c1, size: C.text2 };
    const r = rng(42);
    const words = W.map(([w, cat, f]) => {
      const v = FEATS.map(() => (r() - 0.5) * 0.1);
      for (const [k, x] of Object.entries(f)) v[FI[k]] += x;
      return { w, cat, v };
    });
    const byName = Object.fromEntries(words.map((x) => [x.w, x]));
    const { mean, pcs } = pca(words.map((x) => x.v), 3);
    const proj = (v) => pcs.map((p) => dot(v.map((x, j) => x - mean[j]), p));
    for (const x of words) x.p = proj(x.v);
    const Y = tsne(words.map((x) => x.v)); words.forEach((x, i) => { x.m = Y[i]; });

    let mode = 'map'; let ax = ctx.store.get('emb:ax', ['gender', 'royal']);
    let sel = byName.king; let hover = null;
    let yaw = 0.6; let pitch = 0.35; let arith = null;

    const cv = ctx.canvas(); const g = cv.ctx;
    const dock = ctx.h('<div class="dock"><div class="grp glass"><span>View</span></div></div>');
    ctx.stage.append(dock);
    const seg = ctx.seg([['map', 'Map'], ['pca2', 'PCA 2D'], ['pca3', 'PCA 3D'], ['axes', 'Pick axes']], mode, (v) => { mode = v; axesBox.hidden = v !== 'axes'; draw(); });
    seg.style.border = '0'; dock.querySelector('.grp').append(seg);

    let screen = [];
    function coords(x) {
      if (mode === 'axes') return [x.v[FI[ax[0]]], x.v[FI[ax[1]]], 0];
      if (mode === 'pca2') return [x.p[0], x.p[1], 0];
      if (mode === 'map') { if (x.m) return [x.m[0], x.m[1], 0]; const nb3 = neighbours(x.v).slice(0, 3); let sx = 0; let sy = 0; let sw = 0; for (const nn of nb3) { const wt = Math.max(0.01, nn.c) ** 4; sx += nn.x.m[0] * wt; sy += nn.x.m[1] * wt; sw += wt; } return [sx / sw, sy / sw, 0]; }
      const [a, b, c] = x.p;
      const x1 = a * Math.cos(yaw) - c * Math.sin(yaw); const z1 = a * Math.sin(yaw) + c * Math.cos(yaw);
      const y1 = b * Math.cos(pitch) - z1 * Math.sin(pitch); const z2 = b * Math.sin(pitch) + z1 * Math.cos(pitch);
      return [x1, y1, z2];
    }
    function layout(extra) {
      const pts = words.map(coords);
      const all = extra ? pts.concat(extra.map(coords)) : pts;
      let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
      for (const [x, y] of all) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const padT = 18; const padB = 58; const padX = 46;
      const s = Math.min((cv.w - 2 * padX) / (x1 - x0 || 1), (cv.h - padT - padB) / (y1 - y0 || 1));
      const mx = (x0 + x1) / 2; const my = (y0 + y1) / 2; const midY = padT + (cv.h - padT - padB) / 2;
      return (p) => { const [x, y, z] = coords(p); const persp = mode === 'pca3' ? 1 / (1 - z * 0.12) : 1; return [cv.w / 2 + (x - mx) * s * persp, midY - (y - my) * s * persp, z]; };
    }

    function arrow(a, b, col, dash) {
      g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.6; if (dash) g.setLineDash([5, 4]);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); g.setLineDash([]);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] - 9 * Math.cos(ang - 0.4), b[1] - 9 * Math.sin(ang - 0.4)); g.lineTo(b[0] - 9 * Math.cos(ang + 0.4), b[1] - 9 * Math.sin(ang + 0.4)); g.fill();
      g.restore();
    }

    function draw() {
      const w = cv.w; const h = cv.h; if (!w) return;
      g.clearRect(0, 0, w, h);
      const resVec = arith ? { v: arith.vec, p: proj(arith.vec) } : null;
      const P = layout(resVec ? [resVec] : null);
      // axes hint
      g.font = '500 11px "DM Mono", monospace'; g.fillStyle = C.muted;
      const axl = mode === 'map' ? 'map: t-SNE layout, near on screen means near in meaning (axes have no meaning)' : mode === 'axes' ? `x: ${ax[0]}   y: ${ax[1]}` : mode === 'pca2' ? 'x: principal component 1   y: component 2' : 'drag to rotate (3 principal components)';
      g.fillText(axl, 4, 12);
      if (mode === 'axes') { const o = P({ v: new Array(FEATS.length).fill(0), p: [0, 0, 0] }); g.strokeStyle = C.border; g.lineWidth = 1; g.beginPath(); g.moveTo(0, o[1]); g.lineTo(w, o[1]); g.moveTo(o[0], 0); g.lineTo(o[0], h - 50); g.stroke(); }
      screen = words.map((x) => ({ x, s: P(x) }));
      const order = mode === 'pca3' ? [...screen].sort((a, b) => a.s[2] - b.s[2]) : screen;
      const nb = sel ? neighbours(sel.v, [sel.w]).slice(0, 5) : [];
      // neighbour lines
      if (sel && !arith) {
        const a = P(sel);
        for (const n of nb) { const b = P(n.x); g.strokeStyle = 'rgba(245,245,240,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
      }
      const boxes = [];
      const hi = new Set([sel && sel.w, hover && hover.w, ...nb.map((n) => n.x.w), ...(arith ? [arith.a, arith.b, arith.c, arith.res[0].x.w] : [])].filter(Boolean));
      for (const { x, s } of order) {
        const on = hi.has(x.w); const col = CAT[x.cat];
        const depth = mode === 'pca3' ? Math.max(0.35, Math.min(1, 0.7 + s[2] * 0.2)) : 1;
        g.globalAlpha = (sel || arith) && !on ? 0.45 * depth : depth;
        g.fillStyle = col; g.beginPath(); g.arc(s[0], s[1], on ? 4.5 : 3, 0, 7); g.fill();
        g.font = on ? '500 12px "DM Mono", monospace' : '500 11px "DM Mono", monospace';
        const tw = g.measureText(x.w).width; const bx = [s[0] + 6, s[1] - 7, tw, 12];
        const clash = boxes.some((b) => bx[0] < b[0] + b[2] && bx[0] + bx[2] > b[0] && bx[1] < b[1] + b[3] && bx[1] + bx[3] > b[1]);
        if (clash && !on) g.globalAlpha *= 0.35;
        if (on) { g.fillStyle = 'rgba(10,10,10,.8)'; g.fillRect(bx[0] - 2, bx[1] - 1, tw + 4, 14); }
        g.fillStyle = on ? C.text : col; g.fillText(x.w, s[0] + 6, s[1] + 4);
        boxes.push(bx); g.globalAlpha = 1;
      }
      if (sel && !arith) { const s = P(sel); g.strokeStyle = C.text; g.lineWidth = 1.5; g.beginPath(); g.arc(s[0], s[1], 8, 0, 7); g.stroke(); }
      if (arith) {
        const A = P(byName[arith.a]); const B = P(byName[arith.b]); const Cc = P(byName[arith.c]); const R = P(resVec);
        if (mode !== 'map') { arrow(B, A, C.c2); arrow(Cc, R, C.c2, true); } else { g.save(); g.setLineDash([4, 4]); g.strokeStyle = C.c2; g.beginPath(); g.moveTo(Cc[0], Cc[1]); g.lineTo(R[0], R[1]); g.stroke(); g.restore(); }
        g.strokeStyle = C.c1; g.lineWidth = 1.5; g.beginPath(); g.arc(R[0], R[1], 7, 0, 7); g.stroke();
        g.fillStyle = C.c1; g.font = '500 11px "DM Mono", monospace'; g.fillText('result', R[0] + 9, R[1] - 8);
      }
      // legend
      g.font = '500 11px "DM Mono", monospace'; let lx = 4; const ly = h - 46;
      for (const [k, col] of Object.entries(CAT)) { const tw = g.measureText(k).width; if (lx + tw + 20 > w) break; g.fillStyle = col; g.beginPath(); g.arc(lx + 4, ly - 4, 4, 0, 7); g.fill(); g.fillStyle = C.muted; g.fillText(k, lx + 12, ly); lx += tw + 24; }
    }
    cv.onResize(draw);

    function neighbours(v, excl = []) {
      return words.filter((x) => !excl.includes(x.w)).map((x) => ({ x, c: cos(v, x.v) })).sort((a, b) => b.c - a.c);
    }

    // pointer
    let drag = null;
    const pick = (e) => { const r2 = cv.el.getBoundingClientRect(); const mx = e.clientX - r2.left; const my = e.clientY - r2.top; let best = null; let bd = 22; for (const { x, s } of screen) { const d = Math.hypot(s[0] - mx, s[1] - my); if (d < bd) { bd = d; best = x; } } return best; };
    cv.el.style.touchAction = 'none'; cv.el.style.cursor = 'pointer';
    cv.el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; cv.el.setPointerCapture(e.pointerId); }, { signal: ctx.signal });
    cv.el.addEventListener('pointermove', (e) => {
      if (drag) {
        const dx = e.clientX - drag.x; const dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY;
        if (mode === 'pca3') { yaw += dx * 0.01; pitch = Math.max(-1.4, Math.min(1.4, pitch + dy * 0.01)); draw(); }
        return;
      }
      const hv = pick(e); if (hv !== hover) { hover = hv; draw(); }
    }, { signal: ctx.signal });
    cv.el.addEventListener('pointerup', (e) => { if (drag && drag.moved < 6) { const p = pick(e); if (p) { sel = p; arith = null; updateNb(); draw(); } } drag = null; }, { signal: ctx.signal });

    // Panel
    const Pn = ctx.panel;
    Pn.append(ctx.h('<h2 class="k-h">Embeddings</h2>'), ctx.h('<p class="lede">Inside a model every token becomes a long list of numbers, a point in space. Words used in similar ways end up near each other.</p>'));
    const nbBox = ctx.h('<div class="card"><b class="mono small"></b><div class="nb" style="display:grid;gap:4px"></div></div>');
    Pn.append(ctx.h('<p class="hint">Click any word on the map to see its nearest neighbours.</p>'), nbBox);
    function updateNb() {
      nbBox.querySelector('b').textContent = `Closest to "${sel.w}" (cosine similarity)`;
      nbBox.querySelector('.nb').innerHTML = neighbours(sel.v, [sel.w]).slice(0, 6).map((n) => `<div style="display:grid;grid-template-columns:90px 1fr 42px;gap:8px;align-items:center;font:500 12.5px 'DM Mono',monospace"><span>${n.x.w}</span><span class="bar"><span style="width:${Math.max(0, n.c) * 100}%;background:${CAT[n.x.cat]}"></span></span><span style="text-align:right">${n.c.toFixed(2)}</span></div>`).join('');
    }
    updateNb();

    // arithmetic
    const opts = words.map((x) => `<option>${x.w}</option>`).join('');
    const ar = ctx.h(`<div class="card"><b style="font:700 15px Rajdhani,sans-serif;text-transform:uppercase;letter-spacing:.08em">Vector arithmetic</b>
      <div style="display:grid;grid-template-columns:1fr auto 1fr auto 1fr;gap:6px;align-items:center;font:500 14px 'DM Mono',monospace">
        <select class="sel" data-k="a">${opts}</select><span>-</span><select class="sel" data-k="b">${opts}</select><span>+</span><select class="sel" data-k="c">${opts}</select>
      </div><div class="row pre"></div><div class="res" style="display:grid;gap:4px"></div></div>`);
    Pn.append(ar);
    const sa = ar.querySelector('[data-k=a]'); const sb = ar.querySelector('[data-k=b]'); const sc = ar.querySelector('[data-k=c]');
    const PRESETS = [['king', 'man', 'woman'], ['Paris', 'France', 'Italy'], ['kitten', 'cat', 'dog'], ['Tokyo', 'Japan', 'Germany'], ['father', 'man', 'woman']];
    for (const p of PRESETS) { const b = ctx.h(`<button class="chip">${p[0]} - ${p[1]} + ${p[2]}</button>`); b.onclick = () => { [sa.value, sb.value, sc.value] = p; runArith(); }; ar.querySelector('.pre').append(b); }
    function runArith() {
      const a = byName[sa.value]; const b = byName[sb.value]; const c = byName[sc.value];
      const vec = a.v.map((x, i) => x - b.v[i] + c.v[i]);
      const res = neighbours(vec, [a.w, b.w, c.w]);
      arith = { a: a.w, b: b.w, c: c.w, vec, res };
      ar.querySelector('.res').innerHTML = `<span class="hint">Nearest words to the result (inputs excluded):</span>${res.slice(0, 4).map((n, i) => `<div style="display:grid;grid-template-columns:90px 1fr 42px;gap:8px;align-items:center;font:500 12.5px 'DM Mono',monospace;${i ? 'opacity:.7' : ''}"><span>${i ? '' : '= '}${n.x.w}</span><span class="bar"><span style="width:${Math.max(0, n.c) * 100}%;background:${C.c1}"></span></span><span style="text-align:right">${n.c.toFixed(2)}</span></div>`).join('')}`;
      draw();
    }
    [sa, sb, sc].forEach((s) => s.addEventListener('change', runArith, { signal: ctx.signal }));
    [sa.value, sb.value, sc.value] = PRESETS[0];

    const axesBox = ctx.h(`<div class="card" hidden><b class="mono small">Pick two features as axes</b><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><select class="sel" data-a="0">${FEATS.map((f) => `<option>${f}</option>`).join('')}</select><select class="sel" data-a="1">${FEATS.map((f) => `<option>${f}</option>`).join('')}</select></div><p class="hint">These toy vectors have readable dimensions, so you can plot any two directly.</p></div>`);
    Pn.append(axesBox);
    axesBox.querySelectorAll('select').forEach((s) => { s.value = ax[+s.dataset.a]; s.addEventListener('change', () => { ax[+s.dataset.a] = s.value; ctx.store.set('emb:ax', ax); draw(); }, { signal: ctx.signal }); });

    Pn.append(
      ctx.h(`<div class="card tip"><p>An embedding is a list of numbers that stands for a token. Nobody writes these numbers by hand in a real model: they start random and get nudged during training until words that appear in similar contexts get similar lists. Closeness is usually measured with cosine similarity, which is about the angle between two arrows: 1 means same direction, 0 means unrelated.</p></div>`),
      ctx.h(`<div class="card try"><ol>
        <li>Click <b>king</b>. Its neighbours are other royals and men.</li>
        <li>Press <b>king - man + woman</b>. The arrow from man to king (amber) is copied onto woman, and lands on queen.</li>
        <li>Try <b>Paris - France + Italy</b>: the "capital of" direction carries over.</li>
        <li>Switch to <b>PCA 2D</b> to see the analogy as two parallel arrows, or <b>Pick axes</b> and plot gender against royal: four corners appear.</li>
      </ol></div>`),
      ctx.h(`<div class="card deep">
        <p><b>Honest label:</b> these are toy vectors. Each word here has ${FEATS.length} numbers, and each number has a name (royal, gender, animal, food, size and so on) set by hand, plus a little noise. That is why the analogies work so neatly. The Map view uses t-SNE, which keeps close neighbours close but bends the space, so straight line arithmetic only shows up cleanly in the PCA views (the 2 or 3 directions with the most spread) and in Pick axes. Either way the screen is a flattened shadow: the similarity scores use all ${FEATS.length} numbers.</p>
        <p>Real embeddings are learned, have hundreds to thousands of dimensions, and their dimensions usually do not line up with human ideas one to one. Classic word vectors (word2vec, GloVe) showed analogies like king - man + woman landing near queen, though the effect is weaker and noisier than here, and the standard trick excludes the input words from the answer, as this demo does.</p>
        <div class="formula">cos(a, b) = (a · b) / (|a| |b|)<span>dot product divided by both lengths</span></div>
        <p>In an LLM the first layer is a lookup table with one learned vector per token id. Later layers keep rewriting these vectors so they also carry context: "bank" next to "river" ends up in a different place than "bank" next to "loan".</p>
      </div>`),
    );
    draw();
    document.fonts && document.fonts.ready.then(() => { if (!ctx.signal.aborted) draw(); });

    ctx.quiz([
      { q: 'What is an embedding?', choices: ['A dictionary definition', 'A list of numbers that places a token in a space where similar meanings sit close', 'A compressed image of the word', 'The token id'], answer: 1, why: 'Each token maps to a vector; geometry in that space reflects how words are used.' },
      { q: 'A cosine similarity of 0.95 between two word vectors means...', choices: ['They point in almost the same direction', 'They are opposites', 'They are unrelated', 'They have the same spelling'], answer: 0, why: 'Cosine measures the angle between vectors: near 1 is the same direction.' },
      { q: 'How do real models get their embedding numbers?', choices: ['People label each dimension', 'They are learned during training from huge amounts of text', 'They are copied from a dictionary', 'They are random and never change'], answer: 1, why: 'They start random and training adjusts them. The hand-made features here are only to make the idea visible.' },
    ]);
  },
};
