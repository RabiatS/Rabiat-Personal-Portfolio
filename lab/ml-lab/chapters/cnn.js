// Inside a CNN: a small convolutional network on your drawing, shown layer by layer in 3D.
// The two convolution layers use hand designed kernels (strokes, then combinations of strokes).
// The dense layers are trained in your browser, in small slices, on procedurally generated shapes.
import * as THREE from '../../study/kit/three.min.js';

const MONO = '500 11px "DM Mono", monospace';
const S = 28; const P1 = 14; const P2 = 7;
const CLASSES = ['circle', 'square', 'triangle', 'cross'];
const NC1 = 4; const NC2 = 6; const NFLAT = NC2 * P2 * P2; const NH = 16;

// ---------- drawing shapes as strokes (no canvas needed, so it is identical for training and drawing) ----------
function strokeInto(img, pts, w, closed) {
  const segs = []; for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) segs.push([pts[i], pts[(i + 1) % pts.length]]);
  let x0 = S; let x1 = 0; let y0 = S; let y1 = 0;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  const m = w / 2 + 1.5;
  for (let y = Math.max(0, Math.floor(y0 - m)); y <= Math.min(S - 1, Math.ceil(y1 + m)); y++) for (let x = Math.max(0, Math.floor(x0 - m)); x <= Math.min(S - 1, Math.ceil(x1 + m)); x++) {
    const px = x + 0.5; const py = y + 0.5; let d = Infinity;
    for (const [a, b] of segs) {
      const dx = b[0] - a[0]; const dy = b[1] - a[1]; const L = dx * dx + dy * dy;
      const t = L ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / L)) : 0;
      d = Math.min(d, Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy));
    }
    const v = Math.max(0, Math.min(1, w / 2 + 0.5 - d)); const k = y * S + x; if (v > img[k]) img[k] = v;
  }
}
function shape(kind, rnd = true, img = new Float32Array(S * S)) {
  const R = (a, b) => (rnd ? a + Math.random() * (b - a) : (a + b) / 2);
  const cx = R(11.5, 16.5); const cy = R(11.5, 16.5); const w = R(1.6, 2.8); const th = R(-0.28, 0.28);
  const jit = (p) => (rnd ? [p[0] + (Math.random() - 0.5) * 1.2, p[1] + (Math.random() - 0.5) * 1.2] : p);
  const rot = (x, y) => [cx + x * Math.cos(th) - y * Math.sin(th), cy + x * Math.sin(th) + y * Math.cos(th)];
  if (kind === 'circle') {
    const r = R(6, 10); const ex = R(0.85, 1.15); const pts = [];
    for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2; pts.push(rot(Math.cos(a) * r * ex, Math.sin(a) * r / ex)); }
    strokeInto(img, pts, w, true);
  } else if (kind === 'square') {
    const s = R(5.5, 9.5); strokeInto(img, [rot(-s, -s), rot(s, -s), rot(s, s), rot(-s, s)].map(jit), w, true);
  } else if (kind === 'triangle') {
    const r = R(7.5, 11); const pts = [0, 1, 2].map((i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 3; return rot(Math.cos(a) * r, Math.sin(a) * r + r * 0.15); });
    strokeInto(img, pts.map(jit), w, true);
  } else {
    const L = R(6, 10); const L2 = rnd ? L * R(0.8, 1.2) : L;
    strokeInto(img, [rot(-L, 0), rot(L, 0)].map(jit), w, false); strokeInto(img, [rot(0, -L2), rot(0, L2)].map(jit), w, false);
  }
  return img;
}

// ---------- the fixed convolution layers ----------
// conv1: four line detectors (each sums to zero, so flat areas give nothing)
const K1 = [
  { name: 'vertical strokes', k: [-1, 2, -1, -1, 2, -1, -1, 2, -1] },
  { name: 'horizontal strokes', k: [-1, -1, -1, 2, 2, 2, -1, -1, -1] },
  { name: '/ diagonal strokes', k: [-1, -1, 2, -1, 2, -1, 2, -1, -1] },
  { name: '\\ diagonal strokes', k: [2, -1, -1, -1, 2, -1, -1, -1, 2] },
];
// conv2: 6 filters, each 3 x 3 x 4 (one 3 x 3 slice per conv1 map) plus a bias, then ReLU
function makeK2() {
  const z = () => Array.from({ length: NC1 }, () => new Float32Array(9));
  const list = [];
  const add = (name, desc, fill, bias) => { const w = z(); fill(w); list.push({ name, desc, w, bias }); };
  add('long vertical lines', 'vertical strokes in a column', (w) => { w[0][1] = w[0][4] = w[0][7] = 0.6; }, -0.35);
  add('long horizontal lines', 'horizontal strokes in a row', (w) => { w[1][3] = w[1][4] = w[1][5] = 0.6; }, -0.35);
  add('long / diagonals', '/ strokes along a / line', (w) => { w[2][6] = w[2][4] = w[2][2] = 0.6; }, -0.35);
  add('long \\ diagonals', '\\ strokes along a \\ line', (w) => { w[3][0] = w[3][4] = w[3][8] = 0.6; }, -0.35);
  add('corners and crossings', 'vertical AND horizontal nearby', (w) => { for (let i = 0; i < 9; i++) { w[0][i] = 0.3; w[1][i] = 0.3; } }, -1.1);
  add('slanted joins and curves', 'diagonal plus another direction', (w) => { for (let i = 0; i < 9; i++) { w[2][i] = 0.22; w[3][i] = 0.22; w[0][i] = 0.12; w[1][i] = 0.12; } }, -0.8);
  return list;
}
const K2 = makeK2();

function forward(img, out) {
  const o = out || { c1: new Float32Array(NC1 * S * S), p1: new Float32Array(NC1 * P1 * P1), c2: new Float32Array(NC2 * P1 * P1), p2: new Float32Array(NFLAT) };
  for (let m = 0; m < NC1; m++) {
    const k = K1[m].k; const base = m * S * S;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let s = 0;
      for (let ky = 0; ky < 3; ky++) { const iy = y + ky - 1; if (iy < 0 || iy >= S) continue; for (let kx = 0; kx < 3; kx++) { const ix = x + kx - 1; if (ix < 0 || ix >= S) continue; s += img[iy * S + ix] * k[ky * 3 + kx]; } }
      o.c1[base + y * S + x] = s > 0 ? s / 4 : 0;
    }
  }
  pool(o.c1, o.p1, NC1, S);
  for (let m = 0; m < NC2; m++) {
    const { w, bias } = K2[m]; const base = m * P1 * P1;
    for (let y = 0; y < P1; y++) for (let x = 0; x < P1; x++) {
      let s = bias;
      for (let c = 0; c < NC1; c++) {
        const wc = w[c]; const pc = c * P1 * P1;
        for (let ky = 0; ky < 3; ky++) { const iy = y + ky - 1; if (iy < 0 || iy >= P1) continue; for (let kx = 0; kx < 3; kx++) { const ix = x + kx - 1; if (ix < 0 || ix >= P1) continue; const wv = wc[ky * 3 + kx]; if (wv) s += o.p1[pc + iy * P1 + ix] * wv; } }
      }
      o.c2[base + y * P1 + x] = s > 0 ? s : 0;
    }
  }
  pool(o.c2, o.p2, NC2, P1);
  return o;
}
function pool(src, dst, nm, n) {
  const h = n / 2;
  for (let m = 0; m < nm; m++) for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) {
    const b = m * n * n; const i = b + y * 2 * n + x * 2;
    dst[m * h * h + y * h + x] = Math.max(src[i], src[i + 1], src[i + n], src[i + n + 1]);
  }
}

// ---------- the trainable dense part: 294 -> 16 (ReLU) -> 4 (softmax) ----------
function gauss() { let u = 0; let v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function makeDense() {
  const p = { W1: new Float32Array(NH * NFLAT).map(() => gauss() * Math.sqrt(2 / NFLAT)), b1: new Float32Array(NH), W2: new Float32Array(4 * NH).map(() => gauss() * Math.sqrt(1 / NH)), b2: new Float32Array(4) };
  const m = {}; const v = {}; for (const k of Object.keys(p)) { m[k] = new Float32Array(p[k].length); v[k] = new Float32Array(p[k].length); }
  return { p, m, v, t: 0 };
}
function denseForward(D, x, h, out) {
  const { W1, b1, W2, b2 } = D.p;
  for (let j = 0; j < NH; j++) { let s = b1[j]; const r = j * NFLAT; for (let i = 0; i < NFLAT; i++) s += W1[r + i] * x[i]; h[j] = s > 0 ? s : 0; }
  let mx = -Infinity; for (let c = 0; c < 4; c++) { let s = b2[c]; for (let j = 0; j < NH; j++) s += W2[c * NH + j] * h[j]; out[c] = s; mx = Math.max(mx, s); }
  let z = 0; for (let c = 0; c < 4; c++) { out[c] = Math.exp(out[c] - mx); z += out[c]; } for (let c = 0; c < 4; c++) out[c] /= z;
}
function trainEpoch(D, X, Y, n) {
  const order = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const g = {}; for (const k of Object.keys(D.p)) g[k] = new Float32Array(D.p[k].length);
  const h = new Float32Array(NH); const o = new Float32Array(4); const dh = new Float32Array(NH);
  const B = 32; const lr = 0.004; const b1 = 0.9; const b2 = 0.999;
  for (let s = 0; s < n; s += B) {
    for (const k in g) g[k].fill(0);
    const m = Math.min(B, n - s);
    for (let q = 0; q < m; q++) {
      const idx = order[s + q]; const x = X.subarray(idx * NFLAT, (idx + 1) * NFLAT);
      denseForward(D, x, h, o);
      dh.fill(0);
      for (let c = 0; c < 4; c++) { const d = o[c] - (Y[idx] === c ? 1 : 0); g.b2[c] += d; for (let j = 0; j < NH; j++) { g.W2[c * NH + j] += d * h[j]; dh[j] += d * D.p.W2[c * NH + j]; } }
      for (let j = 0; j < NH; j++) { if (h[j] <= 0) continue; const d = dh[j]; g.b1[j] += d; const r = j * NFLAT; for (let i = 0; i < NFLAT; i++) g.W1[r + i] += d * x[i]; }
    }
    D.t++;
    for (const k of Object.keys(D.p)) {
      const P = D.p[k]; const G = g[k]; const M = D.m[k]; const V = D.v[k];
      for (let i = 0; i < P.length; i++) {
        const gr = G[i] / m + (k[0] === 'W' ? 1e-4 * P[i] : 0);
        M[i] = b1 * M[i] + (1 - b1) * gr; V[i] = b2 * V[i] + (1 - b2) * gr * gr;
        P[i] -= lr * (M[i] / (1 - b1 ** D.t)) / (Math.sqrt(V[i] / (1 - b2 ** D.t)) + 1e-8);
      }
    }
  }
}
export const core = { shape, forward, makeDense, denseForward, trainEpoch, NFLAT, NH, CLASSES };

// ---------- the chapter ----------
export default {
  mount(ctx) {
    const C0 = ctx.colors;
    let img = shape('triangle', false);
    let F = forward(img); const hid = new Float32Array(NH); const prob = new Float32Array(4).fill(0.25);
    const D = makeDense(); let trained = false; let selected = 'c1';
    // training data, built and used a slice at a time
    const NTR = 600; const NTE = 200; const Xtr = new Float32Array(NTR * NFLAT); const Ytr = new Uint8Array(NTR); const Xte = new Float32Array(NTE * NFLAT); const Yte = new Uint8Array(NTE);
    let built = 0; let epoch = 0; const EPOCHS = 30; let testAcc = null; const tmp = forward(new Float32Array(S * S));

    // ---------- 3D scene ----------
    const holder = document.createElement('div'); holder.style.cssText = 'position:absolute;inset:0 0 54px 0;touch-action:none'; ctx.stage.append(holder);
    let renderer = null;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); holder.append(renderer.domElement); renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'; } catch (e) { holder.innerHTML = '<div class="k-loading">This chapter needs WebGL for the 3D view.</div>'; }
    const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x202020, 1.3)); const dl = new THREE.DirectionalLight(0xffffff, 1.4); dl.position.set(5, 10, 8); scene.add(dl);
    const root = new THREE.Group(); scene.add(root);
    const disposables = [];

    function quadGeo(w, h) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-w / 2, -h / 2, 0, w / 2, -h / 2, 0, w / 2, h / 2, 0, -w / 2, -h / 2, 0, w / 2, h / 2, 0, -w / 2, h / 2, 0]), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), 2));
      disposables.push(g); return g;
    }
    function texPlane(pw, ph, w, h) {
      const c = document.createElement('canvas'); c.width = pw; c.height = ph;
      const tex = new THREE.CanvasTexture(c); tex.magFilter = 1003; tex.minFilter = 1003; tex.generateMipmaps = false; tex.colorSpace = 'srgb';
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: 2 }); disposables.push(tex, mat);
      const mesh = new THREE.Mesh(quadGeo(w, h), mat);
      const frameMat = new THREE.MeshBasicMaterial({ color: 0x3a3a38, transparent: true, side: 2 }); disposables.push(frameMat);
      const frame = new THREE.Mesh(quadGeo(w + 0.08, h + 0.08), frameMat); frame.position.z = -0.01; mesh.add(frame);
      return { mesh, c, g: c.getContext('2d'), img: null, tex, mat, frameMat };
    }

    // layers: each has a group, list of planes and a label
    const U = 0.1; // world units per pixel
    const L = {
      in: { title: 'Input', maps: [texPlane(S, S, S * U, S * U)] },
      c1: { title: 'Conv 1', maps: Array.from({ length: NC1 }, () => texPlane(S, S, S * U, S * U)) },
      p1: { title: 'Pool 1', maps: Array.from({ length: NC1 }, () => texPlane(P1, P1, P1 * U, P1 * U)) },
      c2: { title: 'Conv 2', maps: Array.from({ length: NC2 }, () => texPlane(P1, P1, P1 * U, P1 * U)) },
      p2: { title: 'Pool 2', maps: Array.from({ length: NC2 }, () => texPlane(P2, P2, P2 * U, P2 * U)) },
      fl: { title: 'Flatten', maps: [] },
      dn: { title: 'Dense', maps: [] },
      out: { title: 'Output', maps: [] },
    };
    const ORDER = ['in', 'c1', 'p1', 'c2', 'p2', 'fl', 'dn', 'out'];
    for (const k of ORDER) { L[k].group = new THREE.Group(); root.add(L[k].group); L[k].maps.forEach((m) => L[k].group.add(m.mesh)); }
    // flatten strip: 294 values in one column
    L.fl.strip = texPlane(1, NFLAT, 0.16, NFLAT * 0.0105); L.fl.group.add(L.fl.strip.mesh);
    // dense neurons as spheres
    const sg = new THREE.SphereGeometry(0.11, 16, 12); disposables.push(sg);
    L.dn.balls = Array.from({ length: NH }, () => { const m = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.5 }); disposables.push(m); const b = new THREE.Mesh(sg, m); L.dn.group.add(b); return b; });
    // output bars
    const bg = new THREE.CylinderGeometry(0.16, 0.16, 1, 4, 1); bg.rotateY(Math.PI / 4); bg.rotateZ(-Math.PI / 2); bg.translate(0.5, 0, 0); disposables.push(bg);
    L.out.bars = CLASSES.map(() => { const m = new THREE.MeshStandardMaterial({ color: 0x5a5a55, roughness: 0.4 }); disposables.push(m); const b = new THREE.Mesh(bg, m); L.out.group.add(b); return b; });

    // HTML labels
    const lab = document.createElement('div'); lab.style.cssText = 'position:absolute;inset:0 0 54px 0;pointer-events:none;font:600 12px var(--f-display);letter-spacing:.1em;text-transform:uppercase;overflow:hidden'; ctx.stage.append(lab);
    const mk = (t, col = C0.muted, font) => { const e = document.createElement('div'); e.textContent = t; e.style.cssText = `position:absolute;transform:translate(-50%,0);white-space:nowrap;color:${col};text-shadow:0 1px 8px #000;${font || ''}`; lab.append(e); return e; };
    for (const k of ORDER) L[k].label = mk(L[k].title);
    const outLabels = CLASSES.map((c) => mk(c, C0.text2, 'font:500 11px var(--f-mono);letter-spacing:0;text-transform:none;transform:translate(-100%,-50%)'));

    // layout along x (wide) or down y (tall)
    let tall = false; let W = 0; let H = 0; let center = new THREE.Vector3(); let span = 20;
    function layout() {
      const axis = tall ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(1, 0, 0);
      const gaps = tall ? { in: 0, c1: 3.1, p1: 2.4, c2: 1.9, p2: 1.6, fl: 1.0, dn: 0.75, out: 1.05 } : { in: 0, c1: 3.4, p1: 3.2, c2: 2.5, p2: 2.6, fl: 1.8, dn: 1.3, out: 2.4 };
      let pos = 0;
      for (const k of ORDER) {
        pos += gaps[k]; const g = L[k].group; g.position.copy(axis).multiplyScalar(pos);
        const n = L[k].maps.length;
        L[k].maps.forEach((m, i) => {
          const size = m.mesh.geometry.attributes.position.array[3] * 2; const j = i - (n - 1) / 2;
          // wide: a staircase going up and back so every map peeks out; tall: a row across the screen
          if (tall) m.mesh.position.set(j * (size + 0.12) * (n > 4 ? 0.58 : 0.62), 0, -Math.abs(j) * 0.05);
          else m.mesh.position.set(j * size * 0.08, j * size * 0.24, -j * (size * 0.28 + 0.25));
        });
        L[k].pos = pos;
      }
      L.fl.strip.mesh.rotation.z = tall ? Math.PI / 2 : 0;
      L.dn.balls.forEach((b, i) => { const t = (i - (NH - 1) / 2) * (tall ? 0.36 : 0.27); b.position.set(tall ? t : 0, tall ? 0 : t, 0); });
      L.out.bars.forEach((b, i) => { b.position.set(tall ? -0.6 : 0, (1.5 - i) * 0.46, 0); });
      span = pos; center = axis.clone().multiplyScalar(pos / 2 + (tall ? 0.3 : 0.5));
      if (tall) center.x += 0.5; else center.x -= 0.8;
    }
    let az = -0.3; let el = 0.26; let zoom = 1;
    function placeCam() {
      const t = Math.tan((36 / 2) * Math.PI / 180);
      const fit = tall ? (span + 2.2) / 2 / t : (span + 4.5) / 2 / t / Math.max(0.6, cam.aspect);
      const d = fit * zoom;
      cam.position.set(center.x + d * Math.cos(el) * Math.sin(az), center.y + d * Math.sin(el), center.z + d * Math.cos(el) * Math.cos(az));
      cam.lookAt(center);
    }
    ctx.onResize((w, h) => {
      W = w; H = h - 54; if (!renderer || H <= 0) return;
      renderer.setSize(w, H, false); cam.aspect = w / H; cam.updateProjectionMatrix();
      const t = w / H < 1; if (t !== tall) { tall = t; az = tall ? -0.12 : -0.3; el = tall ? 0.12 : 0.26; } layout();
    });

    // ---------- textures from activations ----------
    const ramp = (v) => { const t = Math.max(0, Math.min(1, v)); return [20 + (94 - 20) * Math.min(1, t * 1.4) + (245 - 94) * Math.max(0, t - 0.7) / 0.3, 20 + (234 - 20) * Math.min(1, t * 1.4), 20 + (212 - 20) * Math.min(1, t * 1.4) + (240 - 212) * Math.max(0, t - 0.7) / 0.3]; };
    function paintMap(tp, data, off, n, scale, gray) {
      if (!tp.img) tp.img = tp.g.createImageData(tp.c.width, tp.c.height);
      const d = tp.img.data;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const v = data[off + y * n + x] / scale; const yy = (y * n + x) * 4;
        if (gray) { const c = Math.max(0, Math.min(1, v)) * 255; d[yy] = d[yy + 1] = d[yy + 2] = 18 + c * 0.93; } else { const c = ramp(v); d[yy] = c[0]; d[yy + 1] = c[1]; d[yy + 2] = c[2]; }
        d[yy + 3] = 255;
      }
      tp.g.putImageData(tp.img, 0, 0); tp.tex.needsUpdate = true;
    }
    function maxOf(a) { let m = 1e-6; for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i]; return m; }
    function refresh() {
      F = forward(img, F);
      paintMap(L.in.maps[0], img, 0, S, 1, true);
      const m1 = Math.max(0.6, maxOf(F.c1)); const m2 = Math.max(0.4, maxOf(F.c2));
      for (let i = 0; i < NC1; i++) { paintMap(L.c1.maps[i], F.c1, i * S * S, S, m1); paintMap(L.p1.maps[i], F.p1, i * P1 * P1, P1, m1); }
      for (let i = 0; i < NC2; i++) { paintMap(L.c2.maps[i], F.c2, i * P1 * P1, P1, m2); paintMap(L.p2.maps[i], F.p2, i * P2 * P2, P2, m2); }
      // flatten strip (top of strip = first value)
      const st = L.fl.strip; if (!st.img) st.img = st.g.createImageData(1, NFLAT);
      for (let i = 0; i < NFLAT; i++) { const c = ramp(F.p2[i] / m2); const o = i * 4; st.img.data[o] = c[0]; st.img.data[o + 1] = c[1]; st.img.data[o + 2] = c[2]; st.img.data[o + 3] = 255; }
      st.g.putImageData(st.img, 0, 0); st.tex.needsUpdate = true;
      if (trained || epoch > 0) denseForward(D, F.p2, hid, prob); else { hid.fill(0); prob.fill(0.25); }
      const mh = Math.max(1e-3, ...hid);
      L.dn.balls.forEach((b, i) => { const c = ramp(hid[i] / mh); b.material.color.setRGB(c[0] / 255, c[1] / 255, c[2] / 255); b.scale.setScalar(0.7 + 0.6 * hid[i] / mh); });
      let best = 0; for (let c = 1; c < 4; c++) if (prob[c] > prob[best]) best = c;
      L.out.bars.forEach((b, i) => { b.scale.set(0.05 + prob[i] * 2.2, 1, 1); b.material.color.set(trained && i === best ? C0.c2 : '#5a5a55'); });
      updatePanel(best);
    }

    // ---------- picking ----------
    const v3 = new THREE.Vector3();
    function screenOf(obj, local = [0, 0, 0]) { v3.set(...local); obj.localToWorld(v3); v3.project(cam); return [(v3.x * 0.5 + 0.5) * W, (-v3.y * 0.5 + 0.5) * H, v3.z]; }
    function layerBox(k) {
      const pts = [];
      const add = (obj, hw, hh) => { for (const sx of [-1, 1]) for (const sy of [-1, 1]) pts.push(screenOf(obj, [sx * hw, sy * hh, 0])); };
      if (L[k].maps.length) L[k].maps.forEach((m) => { const p = m.mesh.geometry.attributes.position.array; add(m.mesh, p[3], p[7]); });
      else if (k === 'fl') add(L.fl.strip.mesh, 0.1, NFLAT * 0.0105 / 2);
      else if (k === 'dn') L.dn.balls.forEach((b) => add(b, 0.15, 0.15));
      else L.out.bars.forEach((b) => add(b, 1.2, 0.2));
      const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
      return [Math.min(...xs) - 6, Math.min(...ys) - 6, Math.max(...xs) + 6, Math.max(...ys) + 6];
    }
    function pick(x, y) {
      let best = null; let area = Infinity;
      for (const k of ORDER) { const b = layerBox(k); if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) { const a = (b[2] - b[0]) * (b[3] - b[1]); if (a < area) { area = a; best = k; } } }
      return best;
    }

    let drag = null; let moved = 0;
    holder.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; moved = 0; holder.setPointerCapture(e.pointerId); }, { signal: ctx.signal });
    holder.addEventListener('pointermove', (e) => {
      if (!drag) return; const dx = e.clientX - drag[0]; const dy = e.clientY - drag[1]; moved += Math.abs(dx) + Math.abs(dy);
      az -= dx * 0.006; el = Math.max(-0.6, Math.min(1.2, el + dy * 0.005)); drag = [e.clientX, e.clientY];
    }, { signal: ctx.signal });
    holder.addEventListener('pointerup', (e) => {
      if (drag && moved < 6) { const r = holder.getBoundingClientRect(); const k = pick(e.clientX - r.left, e.clientY - r.top); if (k) select(k); }
      drag = null;
    }, { signal: ctx.signal });
    holder.addEventListener('wheel', (e) => { e.preventDefault(); zoom = Math.max(0.45, Math.min(1.6, zoom * (1 + e.deltaY * 0.001))); }, { passive: false, signal: ctx.signal });

    // ---------- drawing pad ----------
    const pad = document.createElement('div');
    pad.style.cssText = 'position:absolute;left:0;top:0;z-index:6;border:1px solid var(--border-strong);border-radius:10px;overflow:hidden;background:#000;touch-action:none;box-shadow:0 10px 30px rgba(0,0,0,.5)';
    ctx.stage.append(pad);
    const padC = ctx.canvas({ parent: pad, style: 'cursor:crosshair' });
    const padLbl = document.createElement('div'); padLbl.textContent = 'draw here'; padLbl.style.cssText = 'position:absolute;left:6px;top:4px;font:500 10px var(--f-mono);color:var(--muted);pointer-events:none'; pad.append(padLbl);
    ctx.onResize((w) => { const s = w < 640 ? 104 : 150; pad.style.width = `${s}px`; pad.style.height = `${s}px`; });
    function drawPad() {
      const G = padC.ctx; const w = padC.w; if (!w) return; const cs = w / S;
      G.fillStyle = '#000'; G.fillRect(0, 0, w, w);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const v = img[y * S + x]; if (v > 0.02) { const c = Math.round(v * 255); G.fillStyle = `rgb(${c},${c},${c})`; G.fillRect(x * cs, y * cs, cs + 0.3, cs + 0.3); } }
    }
    padC.onResize(drawPad);
    let last = null; let dirtyIn = false;
    const padPos = (e) => { const r = padC.el.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * S, (e.clientY - r.top) / r.height * S]; };
    padC.el.addEventListener('pointerdown', (e) => { padC.el.setPointerCapture(e.pointerId); last = padPos(e); strokeInto(img, [last, last], 2.4, false); dirtyIn = true; }, { signal: ctx.signal });
    padC.el.addEventListener('pointermove', (e) => { if (!last) return; const p = padPos(e); strokeInto(img, [last, p], 2.4, false); last = p; dirtyIn = true; }, { signal: ctx.signal });
    padC.el.addEventListener('pointerup', () => { last = null; }, { signal: ctx.signal });

    // ---------- panel ----------
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Inside a CNN</h2>'),
      ctx.h('<p class="lede">A convolutional network looks at a picture in layers: first tiny strokes, then shapes made of strokes, then a decision. Draw a shape and watch every layer react.</p>'),
    );
    const shapeRow = ctx.h(`<div class="row">${CLASSES.map((c) => `<button class="chip" data-s="${c}">${c}</button>`).join('')}<button class="chip" data-s="clear">clear</button></div>`);
    shapeRow.addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (!b) return; img = b.dataset.s === 'clear' ? new Float32Array(S * S) : shape(b.dataset.s, true); dirtyIn = true; });
    ctx.panel.append(ctx.h('<p class="hint">Draw in the black square on the stage, or load a shape:</p>'), shapeRow);
    const predEl = ctx.h('<div class="card" style="gap:6px"></div>');
    ctx.panel.append(predEl);
    const layerSeg = ctx.seg(ORDER.map((k) => [k, L[k].title]), selected, (v) => select(v));
    ctx.panel.append(ctx.h('<p class="hint">Tap a layer on the stage, or pick one:</p>'), layerSeg);
    const info = ctx.h('<div class="card" style="border-color:var(--border-strong)"><b class="t" style="font:700 16px var(--f-display);text-transform:uppercase;letter-spacing:.06em"></b><p class="d small"></p><div class="viz" style="position:relative"></div></div>');
    ctx.panel.append(info);

    function updatePanel(best) {
      const status = epoch < EPOCHS ? `<p class="hint">${built < NTR + NTE ? `Making ${NTR} practice shapes: ${Math.round(built / (NTR + NTE) * 100)}%` : `Training the dense layers: epoch ${epoch} of ${EPOCHS}`}</p><div class="bar"><span style="width:${(built / (NTR + NTE) * 50 + epoch / EPOCHS * 50).toFixed(0)}%"></span></div>` : `<p class="hint">Dense layers trained on ${NTR} generated shapes. Accuracy on ${NTE} new ones: ${Math.round(testAcc * 100)}%.</p>`;
      let ink = 0; for (let i = 0; i < img.length; i++) ink += img[i];
      predEl.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:baseline"><b style="font:700 15px var(--f-display);text-transform:uppercase;letter-spacing:.08em">Prediction</b><span class="mono small">${!trained ? 'warming up' : ink < 4 ? 'draw something' : `${CLASSES[best]} ${(prob[best] * 100).toFixed(0)}%`}</span></div>` +
        CLASSES.map((c, i) => `<div style="display:grid;grid-template-columns:70px 1fr 40px;gap:8px;align-items:center"><span class="mono small">${c}</span><div style="height:8px;background:var(--surface-2);border-radius:4px;overflow:hidden"><div style="height:100%;width:${(prob[i] * 100).toFixed(1)}%;background:${trained && i === best ? 'var(--c2)' : 'var(--muted)'};transition:width .2s"></div></div><span class="mono small" style="text-align:right">${(prob[i] * 100).toFixed(0)}%</span></div>`).join('') + status;
      if (selected) renderInfo();
    }

    const INFO = {
      in: ['Input: 28 × 28 pixels', 'Your drawing, as 784 brightness values. This is all the network ever sees.'],
      c1: ['Conv 1: 4 stroke detectors', 'Each map is the image convolved with one 3 × 3 kernel, then ReLU (negatives become 0). The kernels look for thin strokes in four directions. Each output pixel sees a 3 × 3 patch of the input.'],
      p1: ['Pool 1: 2 × 2 max pooling', 'Each map shrinks from 28 to 14 by keeping the strongest value in every 2 × 2 block. Strokes survive, exact position matters a bit less. Each pixel now covers a 4 × 4 patch of the input.'],
      c2: ['Conv 2: 6 part detectors', 'Each kernel here is 3 × 3 × 4: it reads all four stroke maps at once and combines them, with a bias that sets how much evidence it needs. So it can say "vertical and horizontal strokes together": a corner. Each pixel now sees an 8 × 8 patch of the input.'],
      p2: ['Pool 2: 6 maps of 7 × 7', 'Pooled again. Each value now summarises a 10 × 10 patch of the input: where, roughly, each kind of part appears.'],
      fl: ['Flatten: 294 numbers', '6 maps × 7 × 7 = 294 values laid end to end in one long list, so ordinary dense layers can read them.'],
      dn: ['Dense: 16 neurons', 'Each neuron takes a weighted sum of all 294 values (then ReLU). These weights were learned in your browser by backprop, from 600 procedurally drawn shapes. Brighter and bigger means more active.'],
      out: ['Output: 4 classes', 'Four scores turned into probabilities with softmax. The tallest bar is the guess. It only knows these four shapes, so anything else still gets forced into one of them.'],
    };
    function select(k) {
      selected = k; layerSeg.set(k);
      for (const key of ORDER) {
        const on = key === k; const op = on ? 1 : 0.5;
        L[key].maps.forEach((m) => { m.mat.opacity = op; m.frameMat.color.set(on ? C0.c2 : '#3a3a38'); m.frameMat.opacity = on ? 1 : 0.5; });
        if (key === 'fl') L.fl.strip.mat.opacity = op;
        L[key].label.style.color = on ? C0.c2 : C0.muted;
      }
      renderInfo();
    }
    let vizC = null;
    function renderInfo() {
      const [t, d] = INFO[selected];
      info.querySelector('.t').textContent = t; info.querySelector('.d').textContent = d;
      const viz = info.querySelector('.viz');
      if (vizC && vizC.key !== selected) { viz.innerHTML = ''; vizC = null; }
      if (!vizC) {
        const rows = selected === 'c1' || selected === 'p1' ? NC1 : selected === 'c2' || selected === 'p2' ? NC2 : 0;
        if (selected === 'c2' || selected === 'p2') viz.style.height = `${rows * 50 + 4}px`; else if (rows) viz.style.height = `${rows * 64 + 4}px`; else viz.style.height = '0px';
        vizC = rows ? ctx.canvas({ parent: viz }) : { ctx: null }; vizC.key = selected;
        if (rows) { const me = vizC; requestAnimationFrame(() => { if (vizC === me) renderInfo(); }); vizC.onResize(() => { if (vizC === me && me.w) renderInfo(); }); }
      }
      if (!vizC.ctx || !vizC.w) return;
      const G = vizC.ctx; const w = vizC.w; G.clearRect(0, 0, w, vizC.h);
      const conv1 = selected === 'c1' || selected === 'p1';
      const rows = conv1 ? NC1 : NC2; const rh = conv1 ? 64 : 50; const n = selected === 'c1' ? S : selected === 'p2' ? P2 : P1;
      const src = selected === 'c1' ? F.c1 : selected === 'p1' ? F.p1 : selected === 'c2' ? F.c2 : F.p2; const sc = Math.max(conv1 ? 0.6 : 0.4, maxOf(src));
      for (let r = 0; r < rows; r++) {
        const y = r * rh + 2; const box = rh - 6;
        if (conv1) {
          const k = K1[r].k; const cs = box / 3;
          for (let i = 0; i < 9; i++) { const v = k[i]; G.fillStyle = v > 0 ? `rgba(94,234,212,${0.25 + v / 3})` : `rgba(251,113,133,${0.2 + -v / 3})`; G.fillRect((i % 3) * cs, y + Math.floor(i / 3) * cs, cs - 1, cs - 1); G.fillStyle = '#0A0A0A'; G.font = '600 10px "DM Mono", monospace'; G.textAlign = 'center'; G.fillText(String(v), (i % 3) * cs + cs / 2, y + Math.floor(i / 3) * cs + cs / 2 + 3); }
        }
        const mx = conv1 ? box + 10 : 0; const cs = box / n;
        for (let yy = 0; yy < n; yy++) for (let xx = 0; xx < n; xx++) { const c = ramp(src[r * n * n + yy * n + xx] / sc); G.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; G.fillRect(mx + xx * cs, y + yy * cs, cs + 0.3, cs + 0.3); }
        G.textAlign = 'left'; G.font = MONO; G.fillStyle = C0.text2;
        const name = conv1 ? K1[r].name : K2[r].name; G.fillText(name, mx + box + 10, y + 16);
        if (!conv1) { G.fillStyle = C0.muted; G.font = '500 10px "DM Mono", monospace'; G.fillText(K2[r].desc, mx + box + 10, y + 32); }
      }
    }

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>Each glowing square is a <b>feature map</b>: one detector slid across the whole picture, bright where it found its pattern. Early maps find strokes. The next layer combines strokes into parts such as corners, long lines and slanted joins. The dense layers at the end weigh up which parts appeared where, and vote.</p>
      <p>Drag to turn the 3D view, scroll or pinch to zoom, and tap a layer to see what it detects.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li>Load a <b>square</b>, tap <b>Conv 1</b>: vertical and horizontal stroke maps light up, the diagonal ones stay dark.</li>
      <li>Load a <b>triangle</b>: now the diagonal maps light up, and in <b>Conv 2</b> the "slanted joins" map fires at its corners.</li>
      <li>Draw your own shape slowly and watch the prediction change stroke by stroke.</li>
      <li>Draw something that is none of the four, like a letter. It still picks one: a classifier only knows its classes.</li></ol></div>`));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div class="card deep">
      <p><b>Receptive field.</b> A conv 1 pixel sees 3 × 3 input pixels. After 2 × 2 pooling and another 3 × 3 convolution, a conv 2 pixel sees 8 × 8, and after the second pool 10 × 10. Every layer looks at a wider area, built from the smaller pieces below it. That is why depth goes from edges to parts to whole objects.</p>
      <p><b>What is real here.</b> The forward pass is real arithmetic on your drawing. To keep the maps easy to read, the conv kernels are hand designed (line detectors, then combinations). The two dense layers (294 → 16 → 4) are trained live with backprop and the Adam optimiser on shapes generated in code. In a real CNN all kernels are learned too, and the first layer usually ends up looking like edge and colour detectors much like these.</p>
      <p><b>Sizes.</b> LeNet-5 (1998) read handwritten digits with about 60,000 weights and was used to read cheques. AlexNet (2012) had about 60 million and won the ImageNet challenge by a wide margin, which started the deep learning boom. Modern vision models stack dozens or hundreds of layers, often mixing convolutions with attention.</p>
      <p><b>Where CNNs run today:</b> in phones (finding faces, portrait blur, sorting your photos, reading text in the camera), in medical imaging (helping specialists spot signs of disease in X-rays, eye scans and skin photos), and in cars (driver assistance and self-driving systems that find lanes, signs, cars and people in camera images).</p>
    </div></details>`));

    // ---------- dock ----------
    const dock = ctx.h('<div class="dock"><div class="grp glass"><button data-a="reset">Reset view</button><button data-a="new">New random shape</button></div></div>');
    ctx.stage.append(dock);
    dock.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a;
      if (a === 'reset') { az = tall ? -0.12 : -0.3; el = tall ? 0.12 : 0.26; zoom = 1; }
      if (a === 'new') { img = shape(CLASSES[Math.floor(Math.random() * 4)], true); dirtyIn = true; }
    }, { signal: ctx.signal });

    // ---------- main loop ----------
    select('c1'); refresh(); drawPad();
    let lastPanel = 0;
    ctx.loop((t) => {
      // background work, a small slice per frame so the page never freezes
      if (built < NTR + NTE) {
        const t0 = performance.now();
        while (built < NTR + NTE && performance.now() - t0 < 7) {
          const i = built; const cls = i % 4; const im = shape(CLASSES[cls], true);
          forward(im, tmp);
          if (i < NTR) { Xtr.set(tmp.p2, i * NFLAT); Ytr[i] = cls; } else { Xte.set(tmp.p2, (i - NTR) * NFLAT); Yte[i - NTR] = cls; }
          built++;
        }
      } else if (epoch < EPOCHS) {
        trainEpoch(D, Xtr, Ytr, NTR); epoch++;
        if (epoch === EPOCHS) {
          trained = true; let ok = 0; const h = new Float32Array(NH); const o = new Float32Array(4);
          for (let i = 0; i < NTE; i++) { denseForward(D, Xte.subarray(i * NFLAT, (i + 1) * NFLAT), h, o); let b = 0; for (let c = 1; c < 4; c++) if (o[c] > o[b]) b = c; if (b === Yte[i]) ok++; }
          testAcc = ok / NTE;
        }
        if (epoch % 3 === 0 || epoch === EPOCHS) dirtyIn = true;
      }
      if (dirtyIn) { dirtyIn = false; refresh(); drawPad(); lastPanel = t; } else if (t - lastPanel > 0.5 && built < NTR + NTE) { lastPanel = t; updatePanel(0); }
      if (!renderer || !W) return;
      placeCam(); renderer.render(scene, cam);
      for (const k of ORDER) {
        // label each layer just outside its on-screen footprint
        const b = layerBox(k); const e = L[k].label;
        if (tall) {
          const right = b[2] < W - 66; const left = !right && b[0] > 70;
          e.style.left = `${right ? b[2] + 4 : left ? b[0] - 4 : b[2] - 4}px`; e.style.top = `${right || left ? (b[1] + b[3]) / 2 : b[3] + 2}px`;
          e.style.transform = right ? 'translate(0,-50%)' : left ? 'translate(-100%,-50%)' : 'translate(-100%,0)';
        }
        else { e.style.left = `${(b[0] + b[2]) / 2}px`; e.style.top = `${b[3] + 2}px`; e.style.transform = 'translate(-50%,0)'; }
      }
      L.out.bars.forEach((b, i) => { const p = screenOf(b, [0, 0, 0]); outLabels[i].style.left = `${p[0] - 6}px`; outLabels[i].style.top = `${p[1]}px`; outLabels[i].style.color = trained && prob[i] === Math.max(...prob) ? C0.c2 : C0.muted; });
    });

    ctx.quiz([
      { q: 'Why do the maps in Conv 2 respond to bigger things (like corners) than the maps in Conv 1?', choices: ['Their kernels are bigger numbers', 'Each Conv 2 pixel combines several Conv 1 maps over a neighbourhood that, after pooling, covers a wider patch of the input', 'Conv 2 runs on a higher resolution image'], answer: 1, why: 'Stacking convolutions and pooling grows the receptive field: from 3 × 3 pixels in Conv 1 to 8 × 8 in Conv 2 here.' },
      { q: 'What does a single feature map show?', choices: ['Where in the image one particular detector found its pattern', 'The final answer', 'The colours of the image'], answer: 0, why: 'One kernel slid over the whole input gives one map: bright where its pattern appears.' },
      { q: 'Which of these is a common real use of CNNs?', choices: ['Sorting a spreadsheet alphabetically', 'Finding faces and objects in phone camera images', 'Compressing text files'], answer: 1, why: 'CNNs are the classic tool for images: phone cameras, medical scans and the camera systems in cars.' },
    ]);

    return () => {
      disposables.forEach((d) => d.dispose && d.dispose());
      if (renderer) renderer.dispose();
    };
  },
};
