// The 3D atom: shells you can count, an electron cloud sampled from real orbital shapes, and side by side comparisons.
import * as THREE from './three.min.js';
import { BY_Z, CAP, L, massNumber, shells, isMain } from './quiz.js';

const BONE = new THREE.Color('#F5F5F0');
const ASH = new THREE.Color('#A0A09A');
const SLATE = new THREE.Color('#62625c');
const TEAL = new THREE.Color('#5EEAD4');
const DARK = new THREE.Color('#2A2A2A');

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const dummy = new THREE.Object3D();

function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.35, 'rgba(255,255,255,.55)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ---------- Orbital sampling ----------
function laguerre(k, a, x) {
  if (k === 0) return 1;
  let p0 = 1; let p1 = 1 + a - x;
  for (let i = 2; i <= k; i++) { const p2 = ((2 * i - 1 + a - x) * p1 - (i - 1 + a) * p0) / i; p0 = p1; p1 = p2; }
  return p1;
}
const ANGULAR = {
  0: [() => 1],
  1: [(x) => x, (x, y) => y, (x, y, z) => z],
  2: [(x, y) => x * y, (x, y, z) => x * z, (x, y, z) => y * z, (x, y) => x * x - y * y, (x, y, z) => 3 * z * z - 1],
  3: [(x, y, z) => z * (5 * z * z - 3), (x, y, z) => x * (5 * z * z - 1), (x, y, z) => y * (5 * z * z - 1), (x, y, z) => x * y * z, (x, y, z) => z * (x * x - y * y), (x, y) => x * (x * x - 3 * y * y), (x, y) => y * (3 * x * x - y * y)],
};
const cache = new Map();
function sampleOrbital(n, l, m, count = 1400) {
  const key = `${n}${l}${m}`;
  if (cache.has(key)) return cache.get(key);
  // Radial: r squared R squared, tabulated and inverted.
  const steps = 500; const rmax = 2.2 * n * n + 8 * n + 4; const cdf = new Float32Array(steps + 1); let sum = 0;
  for (let i = 1; i <= steps; i++) {
    const r = (i / steps) * rmax; const rho = (2 * r) / n;
    const R = rho ** l * Math.exp(-rho / 2) * laguerre(n - l - 1, 2 * l + 1, rho);
    sum += r * r * R * R; cdf[i] = sum;
  }
  // Angular: rejection on the true shape.
  const f = ANGULAR[l][m];
  let top = 0;
  for (let i = 0; i < 800; i++) {
    const u = 2 * Math.random() - 1; const a = Math.random() * 6.283; const s = Math.sqrt(1 - u * u);
    top = Math.max(top, Math.abs(f(s * Math.cos(a), s * Math.sin(a), u)));
  }
  top = (top * 1.02) ** 2;
  const pts = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const t = Math.random() * sum; let lo = 0; let hi = steps;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < t) lo = mid + 1; else hi = mid; }
    const r = (lo / steps) * rmax / (n * n); // scaled so each shell can be placed where it reads
    let x; let y; let z;
    for (let guard = 0; guard < 400; guard++) {
      const u = 2 * Math.random() - 1; const a = Math.random() * 6.283; const s = Math.sqrt(1 - u * u);
      x = s * Math.cos(a); y = s * Math.sin(a); z = u;
      if (l === 0 || Math.random() * top <= f(x, y, z) ** 2) break;
    }
    pts[i * 3] = x * r; pts[i * 3 + 1] = y * r; pts[i * 3 + 2] = z * r;
  }
  cache.set(key, pts);
  return pts;
}

// ---------- View ----------
export class AtomView {
  constructor(canvas, labelsEl) {
    this.canvas = canvas;
    this.labelsEl = labelsEl;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setClearColor(0, 0);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
    this.camera.position.z = 12;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1a1a, 2.0));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 5, 6);
    this.scene.add(key);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.atom = new THREE.Group();
    this.root.add(this.atom);
    this.cmp = new THREE.Group();
    this.root.add(this.cmp);
    this.dotTex = softDot();

    this.region = { x: 0, y: 0, w: 1, h: 1 };
    this.state = { z: 6, mode: 'shells', emph: null, sub: null, partial: null, labels: true, massNum: null };
    this.spin = { x: -0.42, y: 0.32, vx: 0, vy: 0, zoom: 1 };
    this.pop = 1; this.popV = 0;
    this.labelNodes = [];
    this.clock = 0;
    this.last = performance.now();
    this.dirty = true;
    this.visible = true;
    this.drag();
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { this.last = performance.now(); });
    this.resize();
    const frame = (t) => { requestAnimationFrame(frame); if (!document.hidden) this.tick(t); };
    requestAnimationFrame(frame);
  }

  // The panel and table cover part of the stage, so the atom centers itself in what is left.
  setRegion(region) {
    this.region = region;
    this.resize();
  }

  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    const W = Math.max(1, r.width); const H = Math.max(1, r.height);
    this.renderer.setSize(W, H, false);
    this.camera.aspect = W / H;
    const { x, y, w, h } = this.region;
    const cx = x + w / 2; const cy = y + h / 2;
    this.camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
    const world = 2 * 12 * Math.tan((32 / 2) * Math.PI / 180);
    const pxPerWorld = H / world;
    this.fit = (Math.min(w, h) / 2 * 0.94) / pxPerWorld / 3.05;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  drag() {
    const c = this.canvas; let down = null;
    c.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; c.setPointerCapture(e.pointerId); c.style.cursor = 'grabbing'; });
    c.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x; const dy = e.clientY - down.y; down = { x: e.clientX, y: e.clientY };
      this.spin.y += dx * 0.008; this.spin.x += dy * 0.008; this.spin.vx = dy * 0.008; this.spin.vy = dx * 0.008; this.dirty = true;
    });
    const up = () => { down = null; c.style.cursor = ''; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.spin.zoom = Math.min(2.2, Math.max(0.6, this.spin.zoom * Math.exp(-e.deltaY * 0.001))); this.dirty = true; }, { passive: false });
  }

  clearGroup(g) {
    for (const o of [...g.children]) {
      g.remove(o);
      o.geometry?.dispose?.();
      if (o.material && o.material !== this.keepMat) o.material.dispose?.();
      if (o.isGroup) this.clearGroup(o);
    }
  }

  // ---------- Public ----------
  show(z, opts = {}) {
    const s = this.state;
    const changed = s.z !== z || s.massNum !== (opts.massNum ?? null) || s.partial !== (opts.partial ?? null) || this.cmpOn;
    Object.assign(s, { z, massNum: opts.massNum ?? null, partial: opts.partial ?? null });
    if (opts.mode) s.mode = opts.mode;
    if ('emph' in opts) s.emph = opts.emph;
    if ('sub' in opts) s.sub = opts.sub;
    if ('labels' in opts) s.labels = opts.labels;
    s.freeze = !!opts.freeze;
    this.cmpOn = false;
    this.hiddenAtom = false;
    this.build(changed && !opts.quiet);
  }
  set(opts) { Object.assign(this.state, opts); if (!this.hiddenAtom && !this.cmpOn) this.build(false); }
  hide() { this.hiddenAtom = true; this.cmpOn = false; this.atom.visible = false; this.cmp.visible = false; this.setLabels([]); this.dirty = true; }

  setLabels(list) {
    this.labelsEl.textContent = '';
    this.labelNodes = list.map((l) => {
      const n = document.createElement('div');
      n.className = `lab ${l.cls || ''}`;
      n.textContent = l.text;
      this.labelsEl.append(n);
      return { node: n, pos: l.pos, parent: l.parent || this.atom };
    });
  }

  build(animate) {
    const s = this.state; const e = BY_Z[s.z];
    this.clearGroup(this.atom);
    this.orbitals = null;
    this.atom.visible = true; this.cmp.visible = false;
    if (animate && !reduced()) { this.pop = 0.72; this.popV = 0; } else { this.pop = 1; }

    const A = s.massNum || massNumber(e);
    const P = e.z; const N = Math.max(0, A - P);
    const R = 0.1 * Math.cbrt(A) + 0.03;
    const nucleon = s.mode === 'cloud' ? 0.04 : 0.1;
    const scaleR = s.mode === 'cloud' ? 0.45 : 1;

    // Nucleus
    const total = Math.min(P + N, 320);
    const geo = new THREE.SphereGeometry(nucleon, 18, 14);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.05 });
    const mesh = new THREE.InstancedMesh(geo, mat, total);
    const color = new THREE.Color();
    for (let i = 0; i < total; i++) {
      const y = 1 - (2 * (i + 0.5)) / total;
      const rad = Math.sqrt(Math.max(0, 1 - y * y)); const th = i * 2.399963;
      const rr = R * scaleR * Math.cbrt((i + 0.5) / total);
      dummy.position.set(Math.cos(th) * rad * rr, y * rr, Math.sin(th) * rad * rr);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const isP = Math.floor(i * (P / (P + N || 1)) + 0.0001) !== Math.floor((i + 1) * (P / (P + N || 1)) + 0.0001) || N === 0;
      let c = isP ? BONE : SLATE;
      if (s.emph === 'proton') c = isP ? TEAL : DARK;
      else if (s.emph === 'neutron') c = isP ? DARK : TEAL;
      else if (s.emph === 'nucleus') c = isP ? TEAL : new THREE.Color('#2f9d8e');
      else if (s.emph === 'electron' || s.emph === 'valence') c = isP ? ASH : DARK;
      mesh.setColorAt(i, color.copy(c));
    }
    this.atom.add(mesh);

    const cfgCount = s.partial != null ? s.partial : e.z;
    const shellMap = s.partial != null ? partialShells(cfgCount) : shells(e);
    const ns = Object.keys(shellMap).map(Number).sort((a, b) => a - b);
    const maxN = Math.max(1, ...ns, s.partial != null ? e.p : 1);
    const r1 = Math.max(0.82, R + 0.34);
    const gap = maxN > 1 ? Math.min(0.72, (2.95 - r1) / (maxN - 1)) : 0;
    this.shellR = (n) => r1 + (n - 1) * gap;
    const valN = isMain(e) && s.partial == null && s.emph !== 'plain' ? e.p : null;
    const labels = [];

    if (s.mode === 'cloud') this.buildCloud(e, cfgCount, valN);
    else this.buildShells(shellMap, ns, valN, labels);

    if (s.labels) {
      if (s.mode !== 'cloud') labels.push({ text: `${P}p ${N}n`, pos: new THREE.Vector3(0, -R - 0.2, 0) });
      this.setLabels(labels);
    } else this.setLabels([]);
    this.orbitalLabel = null;
    if (this.orbitals) {
      const n = document.createElement('div');
      n.className = 'lab val';
      n.textContent = `${this.orbitals.name}: orbital 1 of ${this.orbitals.total}`;
      this.labelsEl.append(n);
      this.labelNodes.push({ node: n, pos: new THREE.Vector3(0, -3.0, 0), parent: this.atom });
      this.orbitalLabel = n;
    }
    this.dirty = true;
  }

  buildShells(shellMap, ns, valN, labels) {
    const s = this.state;
    const allElectrons = [];
    for (const n of ns) {
      const r = this.shellR(n);
      const isVal = n === valN;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, isVal ? 0.009 : 0.006, 6, 128),
        new THREE.MeshBasicMaterial({ color: isVal ? 0x2f9d8e : 0x4a4a46 }),
      );
      this.atom.add(ring);
      const c = shellMap[n];
      for (let i = 0; i < c; i++) allElectrons.push({ n, r, a: (i / c) * Math.PI * 2 + n * 0.7, val: isVal });
      const lab = new THREE.Vector3(Math.cos(0.9) * r, Math.sin(0.9) * r, 0);
      labels.push({ text: `${c}`, pos: lab, cls: isVal ? 'val' : '' });
    }
    this.electrons = allElectrons;
    if (!allElectrons.length) { this.eMesh = null; this.glow = null; return; }
    const geo = new THREE.SphereGeometry(0.058, 14, 10);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.3, emissive: 0x222222 });
    this.eMesh = new THREE.InstancedMesh(geo, mat, allElectrons.length);
    this.eMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const emph = s.emph;
    allElectrons.forEach((el, i) => {
      let c = el.val ? TEAL : BONE;
      if (emph === 'proton' || emph === 'neutron' || emph === 'nucleus') c = DARK;
      else if (emph === 'electron') c = TEAL;
      else if (emph === 'valence') c = el.val ? TEAL : ASH;
      this.eMesh.setColorAt(i, c);
    });
    this.atom.add(this.eMesh);
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(allElectrons.length * 3), 3));
    const colors = new Float32Array(allElectrons.length * 3);
    allElectrons.forEach((el, i) => { const k = el.val || emph === 'electron' ? 1 : 0; TEAL.toArray(colors, i * 3); colors[i * 3] *= k; colors[i * 3 + 1] *= k; colors[i * 3 + 2] *= k; });
    glowGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.glow = new THREE.Points(glowGeo, new THREE.PointsMaterial({ size: 0.42, map: this.dotTex, vertexColors: true, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.atom.add(this.glow);
    this.placeElectrons();
  }

  placeElectrons() {
    if (!this.eMesh || !this.electrons) return;
    const pos = this.glow.geometry.attributes.position;
    const t = reduced() || this.state.freeze ? 0 : this.clock;
    this.electrons.forEach((el, i) => {
      const a = el.a + (t * 0.5) / el.n;
      const x = Math.cos(a) * el.r; const y = Math.sin(a) * el.r;
      dummy.position.set(x, y, 0);
      dummy.updateMatrix();
      this.eMesh.setMatrixAt(i, dummy.matrix);
      pos.setXYZ(i, x, y, 0);
    });
    this.eMesh.instanceMatrix.needsUpdate = true;
    pos.needsUpdate = true;
  }

  buildCloud(e, count, valN) {
    this.eMesh = null; this.glow = null; this.electrons = null; this.orbitals = null;
    const s = this.state;
    const parts = count === e.z && s.partial == null ? e.cfg.map(([n, l, c]) => [n, l, c]) : partialCfg(count);
    const makePoints = (pos, col, size) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, map: this.dotTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.atom.add(pts);
      return pts;
    };
    const perElectron = parts.length > 12 ? 260 : 460;
    const rest = parts.filter(([n, l]) => s.sub !== `${n}${L[l]}`);
    const total = rest.reduce((t, [, , c]) => t + c, 0) * perElectron;
    if (total) {
      const pos = new Float32Array(total * 3); const col = new Float32Array(total * 3);
      let w = 0;
      for (const [n, l, c] of rest) {
        const isVal = n === valN;
        const base = isVal ? TEAL : BONE;
        const k = s.sub ? 0.03 : isVal ? 0.8 : 0.38;
        const filled = Math.min(c, 2 * l + 1); // Hund: one per orbital first
        const scale = this.shellR(n) * 0.56;
        for (let i = 0; i < c * perElectron; i++) {
          const src = sampleOrbital(n, l, i % filled);
          const j = Math.floor(i / filled) % (src.length / 3);
          pos[w * 3] = src[j * 3] * scale; pos[w * 3 + 1] = src[j * 3 + 1] * scale; pos[w * 3 + 2] = src[j * 3 + 2] * scale;
          col[w * 3] = base.r * k; col[w * 3 + 1] = base.g * k; col[w * 3 + 2] = base.b * k;
          w++;
        }
      }
      makePoints(pos, col, 0.1);
    }
    // A chosen subshell: its orbitals one at a time, so the true shapes can be read.
    const chosen = parts.find(([n, l]) => s.sub === `${n}${L[l]}`);
    if (chosen) {
      const [n, l, c] = chosen;
      const filled = Math.min(c, 2 * l + 1);
      const scale = this.shellR(n) * 0.56;
      const per = sampleOrbital(n, l, 0).length / 3;
      const pos = new Float32Array(per * filled * 3); const col = new Float32Array(per * filled * 3);
      for (let m = 0; m < filled; m++) {
        const src = sampleOrbital(n, l, m);
        for (let i = 0; i < per; i++) {
          const w = (m * per + i) * 3;
          pos[w] = src[i * 3] * scale; pos[w + 1] = src[i * 3 + 1] * scale; pos[w + 2] = src[i * 3 + 2] * scale;
          col[w] = TEAL.r; col[w + 1] = TEAL.g; col[w + 2] = TEAL.b;
        }
      }
      const pts = makePoints(pos, col, 0.11);
      this.orbitals = { pts, per, filled, total: 2 * l + 1, name: `${n}${L[l]}`, shown: -1 };
      this.showOrbital(0);
    }
  }

  showOrbital(i) {
    const o = this.orbitals;
    if (!o || o.shown === i) return;
    o.shown = i;
    o.pts.geometry.setDrawRange(i * o.per, o.per);
    if (this.orbitalLabel) this.orbitalLabel.textContent = `${o.name}: orbital ${i + 1} of ${o.total}`;
    this.dirty = true;
  }

  // Two atoms: true relative size, or a bond with the shared pair pulled toward the stronger atom.
  compare(a, b, mode) {
    this.hiddenAtom = false;
    this.cmpOn = true;
    this.atom.visible = false; this.cmp.visible = true;
    this.clearGroup(this.cmp);
    const A = BY_Z[a]; const B = BY_Z[b];
    const labels = [];
    const sphere = (r, x, color) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, transparent: true, opacity: 0.92 }));
      m.position.x = x; this.cmp.add(m); return m;
    };
    if (mode === 'size') {
      const biggest = Math.max(A.r, B.r);
      const ra = (A.r / biggest) * 1.55; const rb = (B.r / biggest) * 1.55;
      const space = 0.22; const total = ra * 2 + rb * 2 + space;
      const xa = -total / 2 + ra; const xb = total / 2 - rb;
      sphere(ra, xa, A.r >= B.r ? 0x5EEAD4 : 0x8a8a84); sphere(rb, xb, B.r > A.r ? 0x5EEAD4 : 0x8a8a84);
      labels.push({ text: A.n, pos: new THREE.Vector3(xa, -ra - 0.28, 0), parent: this.cmp }, { text: B.n, pos: new THREE.Vector3(xb, -rb - 0.28, 0), parent: this.cmp });
    } else {
      const xa = -1.45; const xb = 1.45; const r = 0.82;
      sphere(r, xa, A.en >= B.en ? 0xE8E8E3 : 0x6a6a64); sphere(r, xb, B.en > A.en ? 0xE8E8E3 : 0x6a6a64);
      const bond = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, xb - xa - r * 2, 12), new THREE.MeshBasicMaterial({ color: 0x5a5a55 }));
      bond.rotation.z = Math.PI / 2; this.cmp.add(bond);
      // Shift the shared pair by the real difference in electronegativity.
      const shift = Math.max(-1, Math.min(1, (B.en - A.en) / 1.6)) * 0.52;
      for (const dy of [-0.09, 0.09]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 14), new THREE.MeshStandardMaterial({ color: 0x5EEAD4, emissive: 0x2f9d8e }));
        e.position.set(shift, dy, 0.02); this.cmp.add(e);
      }
      labels.push({ text: `${A.n} ${A.en.toFixed(2)}`, pos: new THREE.Vector3(xa, -r - 0.28, 0), parent: this.cmp }, { text: `${B.n} ${B.en.toFixed(2)}`, pos: new THREE.Vector3(xb, -r - 0.28, 0), parent: this.cmp });
    }
    this.setLabels(labels);
    if (!reduced()) { this.pop = 0.72; this.popV = 0; }
    this.dirty = true;
  }

  tick(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const still = reduced();
    if (!still) this.clock += dt;
    // Spring for the pop on change.
    if (Math.abs(this.pop - 1) > 0.0005 || Math.abs(this.popV) > 0.001) {
      this.popV += (1 - this.pop) * 170 * dt; this.popV *= Math.exp(-17 * dt); this.pop += this.popV * dt; this.dirty = true;
    }
    this.spin.vx *= 0.92; this.spin.vy *= 0.92;
    const coast = Math.abs(this.spin.vx) + Math.abs(this.spin.vy) > 0.0005;
    if (coast) { this.spin.x += this.spin.vx; this.spin.y += this.spin.vy; this.dirty = true; }
    const cmp = this.cmpOn;
    const drift = still || cmp ? 0 : (this.state.mode === 'cloud' ? this.clock * 0.08 : Math.sin(this.clock * 0.3) * 0.12);
    const s = this.fit * this.spin.zoom * this.pop;
    this.root.scale.setScalar(s);
    this.root.rotation.set(cmp ? 0 : this.spin.x, (cmp ? 0 : this.spin.y) + drift, 0);
    if (!this.hiddenAtom && !cmp && this.state.mode === 'shells') { this.placeElectrons(); this.dirty = true; }
    if (this.orbitals && !still && !this.hiddenAtom && !cmp) this.showOrbital(Math.floor(this.clock / 1.5) % this.orbitals.filled);
    if (!this.hiddenAtom && !cmp && !still) this.dirty = true;
    if (!this.dirty) return;
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
  }

  placeLabels() {
    if (!this.labelNodes.length) return;
    const r = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    for (const l of this.labelNodes) {
      v.copy(l.pos); l.parent.localToWorld(v); v.project(this.camera);
      l.node.style.left = `${(v.x * 0.5 + 0.5) * r.width}px`;
      l.node.style.top = `${(-v.y * 0.5 + 0.5) * r.height}px`;
    }
  }
}

function partialCfg(count) {
  const order = [];
  for (let n = 1; n <= 7; n++) for (let l = 0; l < n && l < 4; l++) order.push([n + l, n, l]);
  order.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out = []; let left = count;
  for (const [, n, l] of order) {
    if (left <= 0) break;
    const c = Math.min(left, CAP[L[l]]);
    out.push([n, l, c]); left -= c;
  }
  return out;
}
function partialShells(count) {
  const out = {};
  for (const [n, , c] of partialCfg(count)) out[n] = (out[n] || 0) + c;
  return out;
}
