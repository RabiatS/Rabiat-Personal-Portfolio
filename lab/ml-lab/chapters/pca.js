// PCA: find the directions of greatest spread in a 3D cloud, then project onto the top ones.
import * as THREE from '../../study/kit/three.min.js';

const MONO = '500 11px "DM Mono", monospace';
const PCC = ['#5EEAD4', '#FBBF24', '#A78BFA'];

function gauss() { let u = 0; let v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

function rotMat(a, b, c) {
  const ca = Math.cos(a); const sa = Math.sin(a); const cb = Math.cos(b); const sb = Math.sin(b); const cc = Math.cos(c); const sc = Math.sin(c);
  const X = [[1, 0, 0], [0, ca, -sa], [0, sa, ca]]; const Y = [[cb, 0, sb], [0, 1, 0], [-sb, 0, cb]]; const Z = [[cc, -sc, 0], [sc, cc, 0], [0, 0, 1]];
  const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  return mul(Z, mul(Y, X));
}

function makeData(kind, n = 320) {
  const P = [];
  if (kind === 'body') {
    for (let i = 0; i < n; i++) {
      const h = 170 + gauss() * 9; const arm = h + gauss() * 3.5; const shoe = 42 + (h - 175) * 0.2 + gauss() * 1.1;
      P.push([h, arm, shoe]);
    }
    // standardise each column (z-scores) so centimetres and shoe sizes are comparable
    const m = [0, 1, 2].map((k) => P.reduce((s, p) => s + p[k], 0) / n);
    const sd = [0, 1, 2].map((k) => Math.sqrt(P.reduce((s, p) => s + (p[k] - m[k]) ** 2, 0) / n));
    return { P: P.map((p) => p.map((v, k) => (v - m[k]) / sd[k] * 0.95)), axes: ['height', 'arm span', 'shoe size'] };
  }
  const sds = kind === 'pancake' ? [1.5, 0.8, 0.12] : [0.85, 0.85, 0.85];
  const R = rotMat(0.6, 0.9, 0.35);
  for (let i = 0; i < n; i++) {
    const v = sds.map((s) => gauss() * s);
    P.push([0, 1, 2].map((r) => R[r][0] * v[0] + R[r][1] * v[1] + R[r][2] * v[2]));
  }
  return { P, axes: ['x', 'y', 'z'] };
}

// Eigen decomposition of a symmetric 3x3 matrix by cyclic Jacobi rotations
function eigSym3(A) {
  const a = A.map((r) => [...r]); const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0; for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) off += a[p][q] ** 2;
    if (off < 1e-14) break;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) {
      if (Math.abs(a[p][q]) < 1e-15) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]); const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1); const s = t * c;
      for (let k = 0; k < 3; k++) { const akp = a[k][p]; const akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
      for (let k = 0; k < 3; k++) { const apk = a[p][k]; const aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < 3; k++) { const vkp = V[k][p]; const vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
  }
  const out = [0, 1, 2].map((i) => ({ val: a[i][i], vec: [V[0][i], V[1][i], V[2][i]] }));
  out.sort((x, y) => y.val - x.val);
  return out;
}

export default {
  mount(ctx) {
    const C0 = ctx.colors;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let dataset = 'body'; let keep = 3; let prog = 0; let spin = !reduce;
    let D; let pcs; let mean; let scores; let n = 0;
    let az = 0.7; let el = 0.35; let dist = 9; let camTarget = null;

    // ---------- three.js scene ----------
    const holder = document.createElement('div'); holder.style.cssText = 'position:absolute;inset:0;touch-action:none';
    ctx.stage.append(holder);
    let renderer = null;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { holder.innerHTML = '<div class="k-loading">This chapter needs WebGL for the 3D view.</div>'; }
    const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    const root = new THREE.Group(); scene.add(root);
    if (renderer) { renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); holder.append(renderer.domElement); renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'; }

    // round sprite for points
    const sc = document.createElement('canvas'); sc.width = sc.height = 64; const sg = sc.getContext('2d');
    sg.fillStyle = '#fff'; sg.beginPath(); sg.arc(32, 32, 28, 0, 7); sg.fill();
    const spriteTex = new THREE.CanvasTexture(sc);
    const ptsGeo = new THREE.BufferGeometry();
    const ptsMat = new THREE.PointsMaterial({ size: 0.13, vertexColors: true, map: spriteTex, transparent: true, alphaTest: 0.4, sizeAttenuation: true });
    const points = new THREE.Points(ptsGeo, ptsMat); root.add(points);

    // axes as thin cylinders
    const disposables = [ptsGeo, ptsMat, spriteTex];
    function cylinderBetween(len, r, color, opacity = 1) {
      const geo = new THREE.CylinderGeometry(r, r, len, 8); geo.rotateX(Math.PI / 2); geo.translate(0, 0, len / 2);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
      disposables.push(geo, mat); return new THREE.Mesh(geo, mat);
    }
    const axisDirs = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    axisDirs.forEach((d) => {
      for (const s of [1, -1]) { const m = cylinderBetween(3, 0.008, 0x5a5a55, 0.9); m.lookAt(d[0] * s, d[1] * s, d[2] * s); root.add(m); }
    });
    // arrows for principal components
    const arrows = PCC.map((c) => {
      const g = new THREE.Group();
      const shaft = cylinderBetween(1, 0.03, c); g.add(shaft);
      const hg = new THREE.CylinderGeometry(0, 0.09, 0.26, 16); hg.rotateX(Math.PI / 2); hg.translate(0, 0, 0.13);
      const hm = new THREE.MeshBasicMaterial({ color: c }); disposables.push(hg, hm);
      const head = new THREE.Mesh(hg, hm); g.add(head); g.userData = { shaft, head };
      root.add(g); return g;
    });
    // projection plane (PC1-PC2) as a translucent quad
    const planeGeo = new THREE.BufferGeometry(); planeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
    const planeMat = new THREE.MeshBasicMaterial({ color: 0x5eead4, transparent: true, opacity: 0, side: 2, depthWrite: false });
    const plane = new THREE.Mesh(planeGeo, planeMat); root.add(plane); disposables.push(planeGeo, planeMat);

    // HTML labels over the 3D view
    const labels = document.createElement('div'); labels.style.cssText = 'position:absolute;inset:0;pointer-events:none;font:500 11px var(--f-mono)';
    ctx.stage.append(labels);
    const mkLabel = (txt, col) => { const e = document.createElement('div'); e.textContent = txt; e.style.cssText = `position:absolute;transform:translate(-50%,-50%);color:${col};white-space:nowrap;text-shadow:0 1px 6px #000`; labels.append(e); return e; };
    let axisLabels = []; const pcLabels = PCC.map((c, i) => mkLabel(`PC${i + 1}`, c));

    // 2D inset plot
    const inset = document.createElement('div');
    inset.style.cssText = 'position:absolute;right:0;bottom:54px;border:1px solid var(--border-strong);border-radius:10px;background:rgba(10,10,10,.82);pointer-events:none;transition:opacity .4s';
    ctx.stage.append(inset);
    const ic = ctx.canvas({ parent: inset });

    function build() {
      const d = makeData(dataset); D = d.P; n = D.length;
      mean = [0, 1, 2].map((k) => D.reduce((s, p) => s + p[k], 0) / n);
      const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (const p of D) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += (p[i] - mean[i]) * (p[j] - mean[j]) / (n - 1);
      pcs = eigSym3(C);
      // fix signs so PC1 points mostly "up and to the right" (purely cosmetic)
      pcs.forEach((p) => { const s = p.vec[0] + p.vec[1] + p.vec[2]; if (s < 0) p.vec = p.vec.map((v) => -v); });
      scores = D.map((p) => pcs.map((pc) => (p[0] - mean[0]) * pc.vec[0] + (p[1] - mean[1]) * pc.vec[1] + (p[2] - mean[2]) * pc.vec[2]));
      const pos = new Float32Array(n * 3); const col = new Float32Array(n * 3);
      const s1 = scores.map((s) => s[0]); const lo = Math.min(...s1); const hi = Math.max(...s1);
      const ca = new THREE.Color(C0.c5); const cb = new THREE.Color(C0.c4); const tmp = new THREE.Color();
      scores.forEach((s, i) => { tmp.copy(ca).lerp(cb, (s[0] - lo) / (hi - lo || 1)); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b; });
      ptsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      ptsGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      pcs.forEach((pc, i) => {
        const len = Math.max(0.3, 2 * Math.sqrt(Math.max(0, pc.val)));
        const a = arrows[i]; a.position.set(...mean); a.userData.shaft.scale.set(1, 1, len); a.userData.head.position.set(0, 0, len);
        a.lookAt(mean[0] + pc.vec[0], mean[1] + pc.vec[1], mean[2] + pc.vec[2]); a.userData.len = len + 0.35;
      });
      const e1 = pcs[0].vec.map((v) => v * 3.2); const e2 = pcs[1].vec.map((v) => v * 2.2);
      const corner = (s, t) => mean.map((m, k) => m + s * e1[k] + t * e2[k]);
      const quad = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, -1), corner(1, 1), corner(-1, 1)].flat();
      planeGeo.attributes.position.array.set(quad); planeGeo.attributes.position.needsUpdate = true;
      axisLabels.forEach((e) => e.remove()); axisLabels = d.axes.map((t) => mkLabel(t, C0.muted));
      prog = keep < 3 ? 1 : 0;
      updateBars(); updatePositions();
    }

    function updatePositions() {
      const pos = ptsGeo.attributes.position.array;
      for (let i = 0; i < n; i++) {
        const p = D[i]; const s = scores[i];
        for (let k = 0; k < 3; k++) {
          let proj = mean[k]; for (let c = 0; c < keep; c++) proj += s[c] * pcs[c].vec[k];
          pos[i * 3 + k] = p[k] + (proj - p[k]) * prog;
        }
      }
      ptsGeo.attributes.position.needsUpdate = true;
    }

    // ---------- layout and rendering ----------
    let W = 0; let H = 0;
    ctx.onResize((w, h) => {
      W = w; H = h; if (renderer) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      const s = Math.round(Math.max(120, Math.min(260, Math.min(w, h) * (w < 640 ? 0.38 : 0.34))));
      inset.style.width = `${s}px`; inset.style.height = `${s}px`;
      dist = w < 640 ? 10.5 : 9;
    });
    const v3 = new THREE.Vector3();
    function place(el, x, y, z) {
      v3.set(x, y, z).project(cam);
      if (v3.z > 1) { el.style.display = 'none'; return; }
      el.style.display = ''; el.style.left = `${(v3.x * 0.5 + 0.5) * W}px`; el.style.top = `${(-v3.y * 0.5 + 0.5) * H}px`;
    }
    function render() {
      if (!renderer || !W) return;
      cam.position.set(dist * Math.cos(el) * Math.sin(az), dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az));
      cam.lookAt(0, 0, 0); renderer.render(scene, cam);
      axisLabels.forEach((e, i) => { const d = axisDirs[i]; place(e, d[0] * 3.25, d[1] * 3.25, d[2] * 3.25); });
      pcLabels.forEach((e, i) => { const L = arrows[i].userData.len || 1; const v = pcs[i].vec; place(e, mean[0] + v[0] * L, mean[1] + v[1] * L, mean[2] + v[2] * L); e.style.opacity = i < keep || prog < 0.5 ? 1 : 0.25; });
    }
    function drawInset() {
      const G = ic.ctx; const w = ic.w; const h = ic.h; if (!w) return;
      G.clearRect(0, 0, w, h);
      const pad = 18; const r = Math.max(...scores.map((s) => Math.max(Math.abs(s[0]), Math.abs(s[1])))) * 1.05 || 1;
      const X = (v) => w / 2 + v / r * (w / 2 - pad); const Y = (v) => h / 2 - v / r * (h / 2 - pad);
      G.strokeStyle = 'rgba(255,255,255,.12)'; G.lineWidth = 1; G.beginPath(); G.moveTo(pad, h / 2); G.lineTo(w - pad, h / 2); G.moveTo(w / 2, pad); G.lineTo(w / 2, h - pad); G.stroke();
      const col = ptsGeo.attributes.color.array;
      for (let i = 0; i < n; i++) {
        const s = scores[i]; const y2 = keep >= 2 ? s[1] : 0;
        G.fillStyle = `rgb(${col[i * 3] * 255 | 0},${col[i * 3 + 1] * 255 | 0},${col[i * 3 + 2] * 255 | 0})`;
        G.beginPath(); G.arc(X(s[0]), Y(y2), 2, 0, 7); G.fill();
      }
      G.font = MONO; G.fillStyle = PCC[0]; G.textAlign = 'right'; G.fillText('PC1', w - 6, h / 2 - 5);
      G.fillStyle = PCC[1]; G.textAlign = 'left'; G.fillText('PC2', w / 2 + 5, 13);
      G.fillStyle = C0.muted; G.fillText(keep === 1 ? '1D: a number line' : '2D view', 6, h - 6);
    }

    // ---------- pointer: orbit ----------
    let drag = null;
    holder.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; holder.setPointerCapture(e.pointerId); camTarget = null; spin = false; syncSpin(); }, { signal: ctx.signal });
    holder.addEventListener('pointermove', (e) => { if (!drag) return; az -= (e.clientX - drag[0]) * 0.008; el = Math.max(-1.4, Math.min(1.4, el + (e.clientY - drag[1]) * 0.006)); drag = [e.clientX, e.clientY]; }, { signal: ctx.signal });
    holder.addEventListener('pointerup', () => { drag = null; }, { signal: ctx.signal });
    holder.addEventListener('pointercancel', () => { drag = null; }, { signal: ctx.signal });
    holder.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.max(5, Math.min(16, dist * (1 + e.deltaY * 0.001))); }, { passive: false, signal: ctx.signal });

    // ---------- panel ----------
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Squashing dimensions</h2>'),
      ctx.h('<p class="lede">Real data often has many columns that move together. PCA finds the few directions where the data actually spreads out, so you can drop the rest and lose very little.</p>'),
    );
    ctx.panel.append(ctx.seg([['body', 'Body sizes'], ['pancake', 'Pancake'], ['ball', 'Ball']], dataset, (v) => { dataset = v; build(); }));
    ctx.panel.append(ctx.h('<p class="hint">Keep how many principal components?</p>'));
    const keepSeg = ctx.seg([[3, 'All 3'], [2, '2 (plane)'], [1, '1 (line)']], keep, (v) => { keep = +v; prog = 0; updateBars(); });
    ctx.panel.append(keepSeg);
    const bars = ctx.h('<div style="display:grid;gap:6px"></div>');
    ctx.panel.append(ctx.h('<h3>Explained variance</h3>'), bars);
    function updateBars() {
      const tot = pcs.reduce((s, p) => s + Math.max(0, p.val), 0);
      let cum = 0;
      bars.innerHTML = pcs.map((p, i) => {
        const f = Math.max(0, p.val) / tot; cum += f;
        return `<div style="display:grid;grid-template-columns:42px 1fr 52px;gap:8px;align-items:center;opacity:${i < keep ? 1 : 0.4}"><span class="mono small" style="color:${PCC[i]}">PC${i + 1}</span><div style="height:10px;background:var(--surface-2);border-radius:5px;overflow:hidden"><div style="height:100%;width:${(f * 100).toFixed(1)}%;background:${PCC[i]};border-radius:5px;transition:width .4s"></div></div><span class="mono small" style="text-align:right">${(f * 100).toFixed(1)}%</span></div>`;
      }).join('') + `<p class="hint">Keeping ${keep} of 3 keeps ${(pcs.slice(0, keep).reduce((s, p) => s + Math.max(0, p.val), 0) / tot * 100).toFixed(1)}% of the spread. ${dataset === 'body' ? 'Height, arm span and shoe size mostly say one thing: how big someone is.' : dataset === 'pancake' ? 'The cloud is nearly flat, so the third direction is mostly noise.' : 'A ball spreads equally every way, so every direction you drop costs a third.'}</p>`;
    }

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>Imagine shining a torch on a 3D cloud of points and looking at its shadow on a wall. Some angles give a useless blob. PCA finds the angle where the shadow is as spread out as possible, so points that were far apart stay far apart.</p>
      <p>The arrows are the <b>principal components</b>: PC1 is the direction of most spread, PC2 the most spread at right angles to PC1, and so on. The bars show how much of the total spread each one carries.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li>Drag to turn the cloud. On <b>Body sizes</b>, the points lie along one long cigar.</li>
      <li>Choose <b>2 (plane)</b> and press <b>Project</b>. Every point slides straight onto the teal plane. Then press <b>Face the plane</b> to look at it head on: that is the 2D plot in the corner.</li>
      <li>Try <b>Pancake</b>: two components keep nearly everything. Then <b>Ball</b>: no direction is special, so squashing always loses a lot.</li></ol></div>`));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div class="card deep">
      <p>Steps: centre the data (subtract the mean of each column), compute the covariance matrix C, and find its eigenvectors. Each eigenvector is a principal direction and its eigenvalue is the variance along it. Here that is a 3 × 3 matrix solved with Jacobi rotations, live in your browser.</p>
      <div class="formula">C v = λ v<span>explained variance of PC i = λ<sub>i</sub> / (λ<sub>1</sub> + λ<sub>2</sub> + λ<sub>3</sub>)</span></div>
      <p>The projection of a point x is its list of scores (v₁ · (x − mean), v₂ · (x − mean), ...). Keeping the top k gives the best possible k dimensional linear summary in the squared error sense.</p>
      <p><b>Why bother?</b> To see data with dozens or thousands of columns on a 2D screen. To compress (store 2 numbers instead of 3, or 50 instead of 784 for a digit image). To remove noise that lives in the small directions. And to speed up later models.</p>
      <p>Caveats: scale your columns first (the body data here is standardised), or the column with the biggest units dominates. PCA only finds straight directions. For curved structure, people use methods such as t-SNE or UMAP for pictures, or autoencoders for learned compression.</p>
    </div></details>`));

    // ---------- dock ----------
    const dock = ctx.h('<div class="dock"><div class="grp glass"><button data-a="proj">Project</button><button data-a="face">Face the plane</button><button data-a="spin">Spin</button></div></div>');
    ctx.stage.append(dock);
    const spinB = dock.querySelector('[data-a=spin]'); const projB = dock.querySelector('[data-a=proj]');
    function syncSpin() { spinB.classList.toggle('on', spin); }
    let projDir = 0;
    dock.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'proj') { if (keep === 3) { keep = 2; keepSeg.set(2); updateBars(); prog = 0; } projDir = prog >= 0.99 ? -1 : 1; }
      if (a === 'face') {
        const v = pcs[2].vec; const d = v[1] < 0 ? v.map((x) => -x) : v; camTarget = [Math.atan2(d[0], d[2]), Math.asin(Math.max(-1, Math.min(1, d[1])))];
        spin = false; syncSpin();
      }
      if (a === 'spin') { spin = !spin; camTarget = null; syncSpin(); }
    }, { signal: ctx.signal });
    syncSpin();

    build();

    ctx.loop((t, dt) => {
      if (projDir) { prog = Math.max(0, Math.min(1, prog + projDir * dt * (reduce ? 10 : 0.8))); if (prog === 0 || prog === 1) projDir = 0; updatePositions(); }
      else if (keep < 3 && prog < 1 && !projDir && prog === 0) { /* waits for Project */ }
      projB.textContent = prog >= 0.99 ? 'Unproject' : 'Project';
      planeMat.opacity = keep === 2 ? 0.08 + 0.1 * prog : 0;
      arrows[2].visible = true;
      if (camTarget) {
        let dAz = camTarget[0] - az; dAz = Math.atan2(Math.sin(dAz), Math.cos(dAz));
        az += dAz * Math.min(1, dt * 3); el += (camTarget[1] - el) * Math.min(1, dt * 3);
        if (Math.abs(dAz) < 0.002 && Math.abs(camTarget[1] - el) < 0.002) camTarget = null;
      } else if (spin) az += dt * 0.25;
      inset.style.opacity = String(0.35 + 0.65 * prog);
      render(); drawInset();
    });

    ctx.quiz([
      { q: 'What is the first principal component?', choices: ['The column with the largest numbers', 'The direction along which the data spreads out the most', 'The average of all points'], answer: 1, why: 'PC1 is the direction of maximum variance. Each later component is the most spread direction at right angles to the earlier ones.' },
      { q: 'PC1 and PC2 explain 98% of the variance of a 3D dataset. What does that tell you?', choices: ['The data lies close to a flat plane, so 2 numbers per point describe it well', 'The data is a perfect sphere', '98% of the points are on PC1'], answer: 0, why: 'Only 2% of the spread is along PC3, so projecting onto the PC1 to PC2 plane loses very little.' },
      { q: 'Which is a good reason to use PCA?', choices: ['To add more columns to the data', 'To plot high dimensional data in 2D, or compress it while keeping most of its structure', 'To label the data'], answer: 1, why: 'PCA is unsupervised: it needs no labels and it reduces dimensions for visualising, compressing or denoising.' },
    ]);

    return () => {
      disposables.forEach((d) => d.dispose && d.dispose());
      if (renderer) renderer.dispose();
    };
  },
};
