// K-means clustering: assign each point to its nearest centre, move each centre to the mean of its points, repeat.
const PAL = ['#5EEAD4', '#FBBF24', '#A78BFA', '#FB7185', '#60A5FA', '#A3E635', '#FDBA74', '#F0ABFC'];
const MONO = '500 11px "DM Mono", monospace';

function gauss() { let u = 0; let v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function makeData(kind) {
  const P = [];
  if (kind === 'blobs') {
    const n = 3 + Math.floor(Math.random() * 3);
    const centres = [];
    for (let i = 0; i < n; i++) {
      let c; let tries = 0;
      do { c = [0.15 + Math.random() * 0.7, 0.15 + Math.random() * 0.7]; tries++; } while (tries < 50 && centres.some((d) => Math.hypot(d[0] - c[0], d[1] - c[1]) < 0.25));
      centres.push(c);
      const sd = 0.04 + Math.random() * 0.035; const m = 45 + Math.floor(Math.random() * 30);
      for (let j = 0; j < m; j++) P.push([clamp(c[0] + gauss() * sd, 0.02, 0.98), clamp(c[1] + gauss() * sd, 0.02, 0.98)]);
    }
  } else if (kind === 'moons') {
    for (let i = 0; i < 220; i++) {
      const t = Math.random() * Math.PI; const up = i % 2 === 0;
      const x = up ? Math.cos(t) : 1 - Math.cos(t); const y = up ? Math.sin(t) : 0.5 - Math.sin(t);
      P.push([clamp(0.2 + x * 0.3 + gauss() * 0.025, 0.02, 0.98), clamp(0.72 - y * 0.3 + gauss() * 0.025, 0.02, 0.98)]);
    }
  } else if (kind === 'random') {
    for (let i = 0; i < 200; i++) P.push([0.04 + Math.random() * 0.92, 0.04 + Math.random() * 0.92]);
  }
  return P;
}

function seedCentres(P, k, mode) {
  const C = [];
  if (!P.length) { for (let i = 0; i < k; i++) C.push([Math.random() * 0.8 + 0.1, Math.random() * 0.8 + 0.1]); return C; }
  if (mode === 'random') {
    const used = new Set();
    for (let i = 0; i < k; i++) { let j; let t = 0; do { j = Math.floor(Math.random() * P.length); t++; } while (used.has(j) && t < 50); used.add(j); C.push([...P[j]]); }
    return C;
  }
  // k-means++: pick the next centre with probability proportional to squared distance to the nearest chosen centre
  C.push([...P[Math.floor(Math.random() * P.length)]]);
  const d2 = new Float32Array(P.length);
  while (C.length < k) {
    let sum = 0;
    for (let i = 0; i < P.length; i++) { let m = Infinity; for (const c of C) { const dx = P[i][0] - c[0]; const dy = P[i][1] - c[1]; m = Math.min(m, dx * dx + dy * dy); } d2[i] = m; sum += m; }
    let r = Math.random() * sum; let j = 0;
    for (; j < P.length - 1; j++) { r -= d2[j]; if (r <= 0) break; }
    C.push([...P[j]]);
  }
  return C;
}

function nearest(x, y, C) { let b = 0; let bd = Infinity; for (let i = 0; i < C.length; i++) { const dx = x - C[i][0]; const dy = y - C[i][1]; const d = dx * dx + dy * dy; if (d < bd) { bd = d; b = i; } } return b; }

function runToEnd(P, k, mode) {
  const C = seedCentres(P, k, mode); const A = new Int16Array(P.length);
  for (let it = 0; it < 60; it++) {
    let changed = false;
    for (let i = 0; i < P.length; i++) { const a = nearest(P[i][0], P[i][1], C); if (a !== A[i] || it === 0) { changed = changed || a !== A[i]; A[i] = a; } }
    const sx = new Float64Array(k); const sy = new Float64Array(k); const n = new Float64Array(k);
    for (let i = 0; i < P.length; i++) { sx[A[i]] += P[i][0]; sy[A[i]] += P[i][1]; n[A[i]]++; }
    for (let c = 0; c < k; c++) if (n[c]) C[c] = [sx[c] / n[c], sy[c] / n[c]];
    if (!changed && it > 0) break;
  }
  let J = 0; for (let i = 0; i < P.length; i++) { const c = C[A[i]]; J += (P[i][0] - c[0]) ** 2 + (P[i][1] - c[1]) ** 2; }
  return J;
}

export default {
  mount(ctx) {
    const C0 = ctx.colors;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cv = ctx.canvas();
    const g = cv.ctx;

    let P = makeData('blobs');
    let k = 4; let mode = 'kpp';
    let C = []; let D = []; // true centres and displayed (animated) centres
    let A = new Int16Array(0); let assigned = false;
    let next = 'assign'; let iter = 0; let converged = false; let playing = false; let acc = 0;
    let trails = []; let flash = 0; let msg = '';

    const field = document.createElement('canvas'); const FR = 140; field.width = FR; field.height = FR;
    const fg = field.getContext('2d'); const fimg = fg.createImageData(FR, FR);
    const rgb = PAL.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

    let box = { x: 0, y: 0, s: 100 };
    cv.onResize((w, h) => {
      const avail = h - 58; const s = Math.max(120, Math.min(w - 8, avail - 30));
      box = { x: (w - s) / 2, y: Math.max(26, (avail - s) / 2 + 22), s };
    });
    const toPx = (p) => [box.x + p[0] * box.s, box.y + p[1] * box.s];
    const toData = (x, y) => [(x - box.x) / box.s, (y - box.y) / box.s];

    function inertia() {
      if (!assigned) return null;
      let J = 0; for (let i = 0; i < P.length; i++) { const c = C[A[i]]; J += (P[i][0] - c[0]) ** 2 + (P[i][1] - c[1]) ** 2; }
      return J;
    }

    function reseed() {
      C = seedCentres(P, k, mode); D = C.map((c) => [...c]);
      A = new Int16Array(P.length).fill(-1); assigned = false;
      next = 'assign'; iter = 0; converged = false; trails = C.map((c) => [[...c]]);
      msg = 'Centres placed. Press Step to assign each point to its nearest centre.';
      updateStats();
    }

    function step() {
      if (!P.length) { msg = 'Add some points first: click on the stage.'; updateStats(); return; }
      if (next === 'assign') {
        let changed = 0;
        for (let i = 0; i < P.length; i++) { const a = nearest(P[i][0], P[i][1], C); if (a !== A[i]) changed++; A[i] = a; }
        assigned = true; flash = 1; next = 'update';
        if (changed === 0 && iter > 0) { converged = true; playing = false; syncPlay(); msg = `Converged after ${iter} rounds: no point changed colour, so the centres will not move again.`; }
        else msg = `Assignment: ${changed} point${changed === 1 ? '' : 's'} took the colour of the nearest centre.`;
      } else {
        const sx = new Float64Array(k); const sy = new Float64Array(k); const n = new Float64Array(k);
        for (let i = 0; i < P.length; i++) if (A[i] >= 0) { sx[A[i]] += P[i][0]; sy[A[i]] += P[i][1]; n[A[i]]++; }
        let moved = 0;
        for (let c = 0; c < k; c++) if (n[c]) { const nx = sx[c] / n[c]; const ny = sy[c] / n[c]; moved = Math.max(moved, Math.hypot(nx - C[c][0], ny - C[c][1])); C[c] = [nx, ny]; trails[c].push([nx, ny]); }
        iter++; next = 'assign';
        msg = `Update: each centre moved to the average of its points (largest move ${(moved * 100).toFixed(1)} units).`;
      }
      updateStats();
    }

    // Panel
    ctx.panel.append(
      ctx.h('<h2 class="k-h">K-means clustering</h2>'),
      ctx.h('<p class="lede">Nobody told the computer which points belong together. K-means finds groups on its own by repeating two simple moves.</p>'),
    );
    const presets = ctx.seg([['blobs', 'Blobs'], ['moons', 'Moons'], ['random', 'Random'], ['clear', 'Empty']], 'blobs', (v) => { P = makeData(v === 'clear' ? '' : v); reseed(); elbowDirty = true; });
    ctx.panel.append(ctx.h('<p class="hint">Data. Click or drag on the stage to add points. Drag a centre (the ringed dot) to move it.</p>'), presets);
    const kS = ctx.slider({ label: 'Number of clusters k', min: 1, max: 8, step: 1, value: k, onInput: (v) => { k = v; reseed(); } });
    const seedSeg = ctx.seg([['kpp', 'k-means++ start'], ['random', 'Random start']], 'kpp', (v) => { mode = v; reseed(); });
    ctx.panel.append(kS, seedSeg);
    const stats = ctx.h('<div class="stat"><div><b class="s-j">-</b><span>Inertia</span></div><div><b class="s-i">0</b><span>Rounds</span></div><div><b class="s-n">0</b><span>Points</span></div></div>');
    const msgEl = ctx.h('<p class="hint" style="min-height:3em"></p>');
    ctx.panel.append(stats, msgEl);

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>Pick how many groups you want, k. Drop k centres somewhere. Then repeat two moves:</p>
      <ol><li><b>Assign</b>: every point joins the centre closest to it.</li><li><b>Update</b>: every centre moves to the middle (the average) of the points that joined it.</li></ol>
      <p>Stop when nobody switches groups. The shaded regions show which centre owns each part of the plane.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li>Press <b>Step</b> a few times and watch colours change, then centres slide.</li>
      <li>Set k to the wrong number of blobs. K-means still splits the data into exactly k groups, it never says "this k is wrong".</li>
      <li>Choose <b>Random start</b> and press <b>Re-seed</b> several times. Sometimes two centres share one blob and another centre covers two. That is a local minimum: higher inertia, and it will never fix itself.</li>
      <li>Try <b>Moons</b>. K-means cuts them with a straight boundary because it only measures distance to a centre.</li></ol></div>`));

    ctx.panel.append(ctx.h('<h3>Elbow plot</h3>'), ctx.h('<p class="small muted">Best inertia found for each k (4 runs each). The bend, where adding a cluster stops helping much, is a common guess for a good k. The ring is your current run.</p>'));
    const ewrap = ctx.h('<div style="position:relative;height:150px"></div>');
    ctx.panel.append(ewrap);
    const ec = ctx.canvas({ parent: ewrap });

    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div class="card deep">
      <p>K-means minimises the <b>inertia</b>, the total squared distance from each point to its centre:</p>
      <div class="formula">J = &Sigma;<sub>i</sub> &#8214;x<sub>i</sub> &minus; &mu;<sub>c(i)</sub>&#8214;&sup2;<span>c(i) is the cluster of point i, &mu; is a centre</span></div>
      <p>Each assign step and each update step can only lower J or keep it the same, so the loop always stops. But it stops at a local minimum that depends on the start, which is why libraries run it several times and keep the best.</p>
      <p><b>k-means++</b> spreads the first centres out: each new centre is picked at random with probability proportional to its squared distance from the centres chosen so far. It makes bad starts much rarer.</p>
      <p>Because it uses squared straight line distance, k-means prefers round clusters of similar size. For curved or nested shapes, density methods such as DBSCAN or a Gaussian mixture can do better. Always scale your features first, or the biggest unit wins.</p>
    </div></details>`));

    // Dock on the stage
    const dock = ctx.h('<div class="dock"><div class="grp glass"><button data-a="step">Step</button><button data-a="play">Play</button><button data-a="seed">Re-seed</button><button data-a="new">New data</button></div></div>');
    ctx.stage.append(dock);
    const playBtn = dock.querySelector('[data-a=play]');
    function syncPlay() { playBtn.textContent = playing ? 'Pause' : 'Play'; playBtn.classList.toggle('on', playing); }
    dock.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a; if (!a) return;
      if (a === 'step') { playing = false; syncPlay(); step(); }
      if (a === 'play') { if (converged) reseed(); playing = !playing; acc = 1; syncPlay(); }
      if (a === 'seed') reseed();
      if (a === 'new') { const cur = presets.querySelector('.on')?.dataset.v || 'blobs'; P = makeData(cur === 'clear' ? 'blobs' : cur); if (cur === 'clear') presets.set('blobs'); reseed(); elbowDirty = true; }
    }, { signal: ctx.signal });

    function updateStats() {
      const J = inertia();
      stats.querySelector('.s-j').textContent = J == null ? '-' : J.toFixed(3);
      stats.querySelector('.s-i').textContent = String(iter);
      stats.querySelector('.s-n').textContent = String(P.length);
      msgEl.textContent = msg;
    }

    // Elbow, computed in small slices so the page never stalls
    let elbow = []; let elbowDirty = true; let elbowK = 1;
    function elbowTick() {
      if (elbowDirty) { elbow = []; elbowK = 1; elbowDirty = false; }
      if (elbowK > 8 || !P.length) return;
      let best = Infinity; for (let r = 0; r < 4; r++) best = Math.min(best, runToEnd(P, elbowK, 'kpp'));
      elbow[elbowK - 1] = best; elbowK++;
    }
    function drawElbow() {
      const G = ec.ctx; const W = ec.w; const H = ec.h; if (!W) return;
      G.clearRect(0, 0, W, H);
      const L = 40; const R = W - 10; const T = 10; const B = H - 22;
      G.strokeStyle = C0.border; G.lineWidth = 1; G.beginPath(); G.moveTo(L, T); G.lineTo(L, B); G.lineTo(R, B); G.stroke();
      G.font = MONO; G.fillStyle = C0.muted; G.textAlign = 'center';
      for (let i = 1; i <= 8; i++) G.fillText(String(i), L + (i - 1) / 7 * (R - L), B + 15);
      const J = inertia();
      const max = Math.max(1e-6, elbow[0] || 0, J || 0);
      G.textAlign = 'right'; G.fillText(max.toFixed(1), L - 6, T + 8); G.fillText('0', L - 6, B);
      const xy = (i, v) => [L + i / 7 * (R - L), B - v / max * (B - T)];
      G.strokeStyle = C0.text2; G.lineWidth = 1.5; G.beginPath();
      elbow.forEach((v, i) => { if (v == null) return; const [x, y] = xy(i, v); i ? G.lineTo(x, y) : G.moveTo(x, y); }); G.stroke();
      elbow.forEach((v, i) => { const [x, y] = xy(i, v); G.fillStyle = i === k - 1 ? C0.c2 : C0.text2; G.beginPath(); G.arc(x, y, i === k - 1 ? 4 : 2.5, 0, 7); G.fill(); });
      if (J != null && P.length) { const [x, y] = xy(k - 1, J); G.strokeStyle = C0.c4; G.lineWidth = 1.5; G.beginPath(); G.arc(x, y, 7, 0, 7); G.stroke(); }
      G.textAlign = 'left'; G.fillStyle = C0.muted; G.fillText('k', R - 8, B - 6);
    }

    // Pointer: drag centres or add points
    let drag = -1; let lastAdd = null;
    cv.el.style.touchAction = 'none';
    cv.el.addEventListener('pointerdown', (e) => {
      const r = cv.el.getBoundingClientRect(); const x = e.clientX - r.left; const y = e.clientY - r.top;
      cv.el.setPointerCapture(e.pointerId);
      drag = -1;
      for (let i = 0; i < D.length; i++) { const [px, py] = toPx(D[i]); if (Math.hypot(px - x, py - y) < 18) drag = i; }
      if (drag < 0) addAt(x, y);
    }, { signal: ctx.signal });
    cv.el.addEventListener('pointermove', (e) => {
      if (!e.buttons) return;
      const r = cv.el.getBoundingClientRect(); const x = e.clientX - r.left; const y = e.clientY - r.top;
      if (drag >= 0) {
        const [dx, dy] = toData(x, y); C[drag] = [clamp(dx, 0, 1), clamp(dy, 0, 1)]; D[drag] = [...C[drag]]; trails[drag] = [[...C[drag]]];
        next = 'assign'; converged = false; msg = 'Centre moved by hand. Step to reassign points.'; updateStats();
      } else if (lastAdd && Math.hypot(x - lastAdd[0], y - lastAdd[1]) > 12) addAt(x, y);
    }, { signal: ctx.signal });
    const up = () => { drag = -1; lastAdd = null; };
    cv.el.addEventListener('pointerup', up, { signal: ctx.signal });
    cv.el.addEventListener('pointercancel', up, { signal: ctx.signal });
    function addAt(x, y) {
      const [dx, dy] = toData(x, y); if (dx < 0 || dx > 1 || dy < 0 || dy > 1) return;
      lastAdd = [x, y];
      for (let j = 0; j < 3; j++) P.push([clamp(dx + gauss() * 0.012, 0, 1), clamp(dy + gauss() * 0.012, 0, 1)]);
      const nA = new Int16Array(P.length).fill(-1); nA.set(A.subarray(0, Math.min(A.length, P.length))); A = nA;
      next = 'assign'; converged = false; elbowDirty = true; msg = 'New points are grey until the next assign step.';
      updateStats();
    }

    reseed();

    ctx.loop((t, dt) => {
      // animate displayed centres toward true centres
      const ease = reduce ? 1 : 1 - Math.exp(-dt * 7);
      for (let i = 0; i < C.length; i++) { D[i][0] += (C[i][0] - D[i][0]) * ease; D[i][1] += (C[i][1] - D[i][1]) * ease; }
      flash = Math.max(0, flash - dt * 1.6);
      if (playing) { acc += dt; if (acc > 0.6) { acc = 0; step(); } }
      elbowTick();
      draw(); drawElbow();
    });

    function draw() {
      const W = cv.w; const H = cv.h; if (!W) return;
      g.clearRect(0, 0, W, H);
      // ownership field
      const data = fimg.data;
      for (let yy = 0; yy < FR; yy++) for (let xx = 0; xx < FR; xx++) {
        const c = nearest((xx + 0.5) / FR, (yy + 0.5) / FR, D); const o = (yy * FR + xx) * 4; const col = rgb[c];
        data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = 34;
      }
      fg.putImageData(fimg, 0, 0);
      g.imageSmoothingEnabled = true; g.drawImage(field, box.x, box.y, box.s, box.s);
      g.strokeStyle = C0.border; g.lineWidth = 1; g.strokeRect(box.x + 0.5, box.y + 0.5, box.s - 1, box.s - 1);
      // assignment lines flash
      if (flash > 0 && assigned) {
        g.globalAlpha = flash * 0.5; g.lineWidth = 0.7;
        for (let i = 0; i < P.length; i++) { if (A[i] < 0) continue; const [x, y] = toPx(P[i]); const [cx, cy] = toPx(D[A[i]]); g.strokeStyle = PAL[A[i]]; g.beginPath(); g.moveTo(x, y); g.lineTo(cx, cy); g.stroke(); }
        g.globalAlpha = 1;
      }
      // points
      const pr = box.s > 400 ? 3.2 : 2.6;
      for (let i = 0; i < P.length; i++) {
        const [x, y] = toPx(P[i]); g.fillStyle = A[i] >= 0 ? PAL[A[i]] : C0.muted;
        g.globalAlpha = A[i] >= 0 ? 0.9 : 0.6; g.beginPath(); g.arc(x, y, pr, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
      // trails and centres
      for (let i = 0; i < D.length; i++) {
        const tr = trails[i]; if (tr && tr.length > 1) { g.strokeStyle = PAL[i]; g.globalAlpha = 0.5; g.lineWidth = 1; g.setLineDash([3, 3]); g.beginPath(); tr.forEach((p, j) => { const [x, y] = toPx(p); j ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
        const [x, y] = toPx(D[i]);
        g.fillStyle = '#0A0A0A'; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill();
        g.strokeStyle = PAL[i]; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 9, 0, 7); g.stroke();
        g.fillStyle = PAL[i]; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill();
      }
      // header text
      g.font = MONO; g.fillStyle = C0.muted; g.textAlign = 'left';
      const J = inertia();
      g.fillText(`k = ${k}   round ${iter}   next: ${converged ? 'done' : next}   inertia ${J == null ? '-' : J.toFixed(3)}`, box.x, box.y - 9);
    }

    ctx.quiz([
      { q: 'What happens in the update step of k-means?', choices: ['Each point moves to its nearest centre', 'Each centre moves to the average position of the points assigned to it', 'k goes up by one'], answer: 1, why: 'Points never move. Centres jump to the mean of their own points, then points are reassigned.' },
      { q: 'You run k-means twice on the same data with random starts and get different groups. Why?', choices: ['The algorithm has a bug', 'It can settle in different local minima depending on where the centres started', 'Points were added between runs'], answer: 1, why: 'Each run only goes downhill from its start, so different starts can end in different valleys. Libraries run it several times and keep the lowest inertia.' },
      { q: 'On the elbow plot, inertia keeps falling as k grows. Why not just pick the biggest k?', choices: ['With k equal to the number of points inertia is zero, but every group is one point and tells you nothing', 'Big k is slower to draw', 'Inertia goes up after k = 3'], answer: 0, why: 'More centres always fit better. You look for the bend where extra clusters stop buying much.' },
    ]);
  },
};
