// Anatomy Lab 3D engine: loads the packed BodyParts3D meshes, draws each pack as one mesh with per structure
// colour and visibility (a small state texture read in the shader), picks structures under the pointer,
// frames the camera and draws calm labels on a 2D overlay.
import * as THREE from './vendor/three-bundle.js';

export { THREE };
const DATA = new URL('./data/', import.meta.url).href;
const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const reducedMotion = RM;

// Tissue colours (anatomical, not the UI palette). Highlights use the kit teal.
export const TISSUE = {
  bone: 0xE6DCC6, cartilage: 0xB9D3D6, teeth: 0xF4F0E6, muscle: 0xB4564C, tendon: 0xD9CDB4,
  artery: 0xD8443F, vein: 0x4F74D4, nerve: 0xF2C94C, brain: 0xD9A7A0, heart: 0xB8443E,
  liver: 0x8E3B32, lung: 0xE29C9C, gut: 0xD8A07C, stomach: 0xD58E73, kidney: 0x9C3E3A, gland: 0xC9A14A,
  spleen: 0x7E3448, skin: 0xE8C4A8, eye: 0xEDEDE8, repro: 0xC98E9A, bladder: 0xD9B36A, airway: 0xB9D3D6,
};
export const HI = 0x5EEAD4;

let manifestP = null;
const packP = new Map();

export function manifest() {
  if (!manifestP) {
    manifestP = fetch(`${DATA}meshes.json`).then((r) => { if (!r.ok) throw new Error('mesh index missing'); return r.json(); }).then((m) => {
      m.byPack = {};
      for (const it of m.items) (m.byPack[it.p] ||= []).push(it);
      return m;
    });
  }
  return manifestP;
}

let pathsP = null;
export function paths() {
  if (!pathsP) pathsP = fetch(`${DATA}paths.json`).then((r) => r.json());
  return pathsP;
}

// Decode one pack into a merged geometry (with a per vertex structure id) and per structure ranges.
export function loadPack(name) {
  if (!packP.has(name)) {
    packP.set(name, (async () => {
      const [m, buf] = await Promise.all([manifest(), fetch(`${DATA}${name}.bin`).then((r) => { if (!r.ok) throw new Error(`pack ${name} missing`); return r.arrayBuffer(); })]);
      await THREE.MeshoptDecoder.ready;
      const src = new Uint8Array(buf);
      const list = m.byPack[name] || [];
      let nv = 0; let ni = 0;
      for (const it of list) { nv += it.v; ni += it.i; }
      const pos = new Float32Array(nv * 3); const pid = new Float32Array(nv); const idx = new Uint32Array(ni);
      const items = [];
      let vo = 0; let io = 0;
      for (const [k, it] of list.entries()) {
        const vq = new Uint8Array(it.v * 8);
        THREE.MeshoptDecoder.decodeVertexBuffer(vq, it.v, 8, src.subarray(it.vo, it.vo + it.vl));
        const q = new Uint16Array(vq.buffer);
        for (let i = 0; i < it.v; i++) {
          for (let a = 0; a < 3; a++) pos[(vo + i) * 3 + a] = it.mn[a] + (q[i * 4 + a] / 65535) * it.ex[a];
          pid[vo + i] = k;
        }
        const ib = new Uint8Array(it.i * it.s);
        THREE.MeshoptDecoder.decodeIndexBuffer(ib, it.i, it.s, src.subarray(it.io, it.io + it.il));
        const ix = it.s === 2 ? new Uint16Array(ib.buffer) : new Uint32Array(ib.buffer);
        for (let i = 0; i < it.i; i++) idx[io + i] = ix[i] + vo;
        const box = new THREE.Box3(new THREE.Vector3(...it.mn), new THREE.Vector3(it.mn[0] + it.ex[0], it.mn[1] + it.ex[1], it.mn[2] + it.ex[2]));
        items.push({ k, name: it.n, cat: it.c, pack: name, v0: vo, nv: it.v, i0: io, ni: it.i, box, center: new THREE.Vector3(...it.ce) });
        vo += it.v; io += it.i;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('pid', new THREE.BufferAttribute(pid, 1));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeVertexNormals();
      geo.computeBoundingBox(); geo.computeBoundingSphere();
      return { name, geo, items, byName: new Map(items.map((x) => [x.name, x])) };
    })());
  }
  return packP.get(name);
}

// A standalone geometry for one structure (for exploded views and joint animations), centred on its own centre.
export function itemGeometry(pack, item) {
  const P = pack.geo.attributes.position.array; const N = pack.geo.attributes.normal.array; const I = pack.geo.index.array;
  const pos = P.slice(item.v0 * 3, (item.v0 + item.nv) * 3); const nor = N.slice(item.v0 * 3, (item.v0 + item.nv) * 3);
  const idx = new Uint32Array(item.ni);
  for (let i = 0; i < item.ni; i++) idx[i] = I[item.i0 + i] - item.v0;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

function hexToRgb(hex) { return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]; }

// Material whose colour and visibility come per structure from the state texture.
function packMaterial(tex, W, H, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({ roughness: opts.roughness ?? 0.62, metalness: 0, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, depthWrite: opts.depthWrite ?? true, side: opts.side ?? THREE.FrontSide });
  mat.userData.u = { uState: { value: tex }, uSize: { value: new THREE.Vector2(W, H) }, uHl: { value: -1 }, uHl2: { value: -1 }, uHlCol: { value: new THREE.Color(HI) }, uRim: { value: opts.rim ?? 0.0 }, uRimCol: { value: new THREE.Color(opts.rimColor ?? 0xffffff) } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, mat.userData.u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float pid; uniform sampler2D uState; uniform vec2 uSize; uniform float uHl; uniform float uHl2; varying vec4 vSt; varying float vHl;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec2 suv = vec2((mod(pid, uSize.x) + 0.5) / uSize.x, (floor(pid / uSize.x) + 0.5) / uSize.y);
        vSt = texture2D(uState, suv);
        vHl = (abs(pid - uHl) < 0.5 || abs(pid - uHl2) < 0.5) ? 1.0 : 0.0;
        if (vSt.a < 0.02) transformed = vec3(0.0);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vSt; varying float vHl; uniform vec3 uHlCol; uniform float uRim; uniform vec3 uRimCol;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(vSt.rgb, uHlCol, vHl * 0.55);')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uHlCol * vHl * 0.28;
        float rimF = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.2);
        totalEmissiveRadiance += uRimCol * rimF * uRim;`);
  };
  mat.customProgramCacheKey = () => `anat-pack-${opts.rim ? 1 : 0}`;
  return mat;
}

export class PackView {
  constructor(viewer, pack, opts = {}) {
    this.viewer = viewer; this.pack = pack; this.items = pack.items;
    const n = pack.items.length; const W = 256; const H = Math.max(1, Math.ceil(n / W));
    this.state = new Uint8Array(W * H * 4);
    this.tex = new THREE.DataTexture(this.state, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.magFilter = THREE.NearestFilter; this.tex.minFilter = THREE.NearestFilter;
    this.mat = packMaterial(this.tex, W, H, opts);
    this.mesh = new THREE.Mesh(pack.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = opts.renderOrder || 0;
    this.base = new Array(n).fill(0xcccccc);
    this.vis = new Array(n).fill(true);
    this.pickable = opts.pickable ?? true;
    this.hl = -1;
    const col = opts.color || (() => 0xcccccc);
    for (let i = 0; i < n; i++) { this.base[i] = col(pack.items[i]); this._write(i); }
    if (opts.filter) for (let i = 0; i < n; i++) { this.vis[i] = !!opts.filter(pack.items[i]); this._write(i); }
    this.tex.needsUpdate = true;
  }
  _write(i, hex) {
    const c = hexToRgb(hex ?? this.base[i]);
    this.state[i * 4] = c[0]; this.state[i * 4 + 1] = c[1]; this.state[i * 4 + 2] = c[2]; this.state[i * 4 + 3] = this.vis[i] ? 255 : 0;
  }
  item(name) { return this.pack.byName.get(name); }
  color(i, hex) { this.base[i] = hex; this._write(i); this.tex.needsUpdate = true; this.viewer.dirty = true; }
  colorAll(fn) { for (let i = 0; i < this.items.length; i++) { this.base[i] = fn(this.items[i]); this._write(i); } this.tex.needsUpdate = true; this.viewer.dirty = true; }
  visible(i, v) { this.vis[i] = v; this._write(i); this.tex.needsUpdate = true; this.viewer.dirty = true; }
  filter(fn) { for (let i = 0; i < this.items.length; i++) { this.vis[i] = !!fn(this.items[i]); this._write(i); } this.tex.needsUpdate = true; this.viewer.dirty = true; }
  highlight(i, j = -1) { this.hl = i; this.mat.userData.u.uHl.value = i ?? -1; this.mat.userData.u.uHl2.value = j; this.viewer.dirty = true; }
  opacity(a) {
    const t = a < 0.999;
    if (this.mat.transparent !== t) { this.mat.transparent = t; this.mat.needsUpdate = true; }
    this.mat.opacity = a; this.mat.depthWrite = !t || a > 0.6; this.mesh.visible = a > 0.005; this.viewer.dirty = true;
  }
  show(v) { this.mesh.visible = v; this.viewer.dirty = true; }
  get shown() { return this.mesh.visible; }
  // World space bounds of the visible (or given) structures
  bounds(fn) {
    const b = new THREE.Box3();
    for (let i = 0; i < this.items.length; i++) if (fn ? fn(this.items[i]) : this.vis[i]) b.union(this.items[i].box);
    return b.applyMatrix4(this.mesh.matrixWorld);
  }
  worldCenter(it) { return it.center.clone().applyMatrix4(this.mesh.matrixWorld); }
}

const _ray = new THREE.Ray(); const _inv = new THREE.Matrix4();
const _a = new THREE.Vector3(); const _b = new THREE.Vector3(); const _c = new THREE.Vector3(); const _hit = new THREE.Vector3();

export class Viewer {
  constructor(ctx, opts = {}) {
    this.ctx = ctx; this.opts = opts;
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute;inset:0;touch-action:none;';
    ctx.stage.append(host); this.host = host;
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    r.localClippingEnabled = true;
    r.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;outline:none;';
    r.domElement.setAttribute('aria-label', opts.label || '3D anatomy model. Drag to turn, pinch or scroll to zoom, tap a structure to name it.');
    r.domElement.setAttribute('role', 'img');
    host.append(r.domElement); this.renderer = r;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(opts.fov || 32, 1, 0.01, 50);
    this.camera.position.set(0, 1.0, 3.6);
    this.controls = new THREE.OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.09, rotateSpeed: 0.75, zoomSpeed: 0.9, panSpeed: 0.8, screenSpacePanning: true, minDistance: opts.minDist ?? 0.12, maxDistance: opts.maxDist ?? 6 });
    this.controls.target.set(0, 0.9, 0);
    this.controls.addEventListener('change', () => { this.dirty = true; });
    // Lights: soft sky, a key from the upper front, a cool rim from behind
    this.scene.add(new THREE.HemisphereLight(0xf4f1ea, 0x2a2622, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(1.2, 2.2, 2.6); this.camera.add(key); key.target.position.set(0, 0, -1); this.camera.add(key.target);
    const fill = new THREE.DirectionalLight(0xbfd6ff, 0.55); fill.position.set(-2, 0.5, -1.5); this.scene.add(fill);
    this.scene.add(this.camera);
    this.root = new THREE.Group(); this.scene.add(this.root);
    // 2D overlay for labels
    this.ov = ctx.canvas({ parent: host, style: 'pointer-events:none;' });
    this.labels = []; this.marks = []; this.packs = {}; this.anims = new Set(); this.updaters = new Set();
    this.dirty = true; this.clip = null; this.w = 1; this.h = 1;
    this.tip = document.createElement('div');
    this.tip.style.cssText = 'position:absolute;z-index:5;pointer-events:none;font:500 11.5px "DM Mono",monospace;color:#F5F5F0;background:rgba(10,10,10,.82);border:1px solid #3A3A38;border-radius:6px;padding:4px 7px;white-space:nowrap;transform:translate(-50%,-140%);display:none;';
    host.append(this.tip);
    const ro = new ResizeObserver(() => this.resize()); ro.observe(host);
    this.resize();
    this._pointers(ctx.signal);
    ctx.loop((t, dt) => this._frame(t, dt));
    ctx.signal.addEventListener('abort', () => {
      ro.disconnect(); this.controls.dispose();
      for (const pv of Object.values(this.packs)) { pv.mat.dispose(); pv.tex.dispose(); }
      this.scene.traverse((o) => { if (o.userData.own) { o.geometry?.dispose(); o.material?.dispose?.(); } });
      r.dispose(); r.forceContextLoss();
    });
  }
  resize() {
    const rc = this.host.getBoundingClientRect();
    if (!rc.width || !rc.height) return;
    this.w = rc.width; this.h = rc.height;
    this.renderer.setSize(rc.width, rc.height, false);
    this.camera.aspect = rc.width / rc.height; this.camera.updateProjectionMatrix();
    this.dirty = true;
  }
  async addPack(name, opts = {}) {
    const pack = await loadPack(name);
    if (this.ctx.signal.aborted) return null;
    const pv = new PackView(this, pack, opts);
    if (this.clip) pv.mat.clippingPlanes = [this.clip];
    (opts.parent || this.root).add(pv.mesh);
    this.packs[opts.key || name] = pv;
    if (opts.opacity != null && opts.opacity < 1) pv.opacity(opts.opacity);
    this.dirty = true;
    return pv;
  }
  // Own meshes (procedural or per structure) get disposed with the chapter
  own(obj) { obj.traverse((o) => { o.userData.own = true; }); return obj; }
  setClip(plane) {
    this.clip = plane;
    const list = plane ? [plane] : null;
    for (const pv of Object.values(this.packs)) { pv.mat.clippingPlanes = list; pv.mat.needsUpdate = true; }
    this.scene.traverse((o) => { if (o.userData.clip && o.material) { o.material.clippingPlanes = list; o.material.needsUpdate = true; } });
    this.dirty = true;
  }
  // Camera moves
  frame(box, { dir = [0, 0, 1], pad = 1.15, dur = 0.8, up } = {}) {
    const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3());
    const d = new THREE.Vector3(...dir).normalize();
    // fit both the height and the width of the box in view
    const vf = THREE.MathUtils.degToRad(this.camera.fov);
    const hf = 2 * Math.atan(Math.tan(vf / 2) * this.camera.aspect);
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d).normalize();
    const wx = Math.abs(right.x) * s.x + Math.abs(right.z) * s.z + Math.abs(right.y) * s.y;
    const hy = s.y * Math.max(0.3, Math.sqrt(1 - d.y * d.y)) + Math.abs(d.y) * Math.max(s.x, s.z);
    const depth = Math.abs(d.x) * s.x + Math.abs(d.y) * s.y + Math.abs(d.z) * s.z;
    const dist = Math.max((hy * pad) / 2 / Math.tan(vf / 2), (wx * pad) / 2 / Math.tan(hf / 2)) + depth / 2;
    this.moveTo(c.clone().addScaledVector(d, dist), c, dur, up);
  }
  moveTo(pos, target, dur = 0.8, up) {
    const p0 = this.camera.position.clone(); const t0 = this.controls.target.clone();
    if (up) this.camera.up.set(...up);
    if (RM || dur <= 0) { this.camera.position.copy(pos); this.controls.target.copy(target); this.dirty = true; return Promise.resolve(); }
    return new Promise((res) => {
      let k = 0;
      this.anim((dt) => {
        k = Math.min(1, k + dt / dur); const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        this.camera.position.lerpVectors(p0, pos, e); this.controls.target.lerpVectors(t0, target, e);
        if (k >= 1) { res(); return false; }
        return true;
      });
    });
  }
  anim(fn) { this.anims.add(fn); this.dirty = true; }
  every(fn) { this.updaters.add(fn); return () => this.updaters.delete(fn); }
  _frame(t, dt) {
    for (const f of [...this.anims]) { if (f(dt, t) === false) this.anims.delete(f); this.dirty = true; }
    for (const f of this.updaters) if (f(dt, t) !== false) this.dirty = true;
    if (this.controls.update()) this.dirty = true;
    if (!this.dirty) return;
    this.dirty = false;
    this.renderer.render(this.scene, this.camera);
    this._drawOverlay();
  }
  // Project a world point to stage pixels
  project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x + 1) / 2 * this.w, y: (1 - p.y) / 2 * this.h, z: p.z, behind: p.z > 1 };
  }
  _drawOverlay() {
    const o = this.ov; const g = o.ctx; if (!o.w) return;
    g.clearRect(0, 0, o.w, o.h);
    if (this.onOverlay) this.onOverlay(g, o.w, o.h);
    if (!this.labels.length) return;
    g.font = '500 11px "DM Mono", ui-monospace, monospace'; g.textBaseline = 'middle';
    const L = [];
    for (const lb of this.labels) {
      if (lb.hidden) continue;
      const p = this.project(lb.pos instanceof THREE.Vector3 ? lb.pos : new THREE.Vector3(...lb.pos));
      if (p.behind) continue;
      const tw = g.measureText(lb.text).width + 12;
      const side = lb.side || (p.x > o.w / 2 ? 1 : -1);
      let lx = lb.fixed ? p.x : p.x + side * (lb.reach ?? 34);
      if (!lb.fixed) lx = side > 0 ? Math.min(lx, o.w - tw - 4) : Math.max(lx, tw + 4);
      L.push({ lb, p, tw, side, lx, ly: p.y });
    }
    // simple vertical de-overlap per side
    for (const s of [-1, 1]) {
      const col = L.filter((q) => q.side === s && !q.lb.fixed).sort((a, b) => a.ly - b.ly);
      for (let i = 1; i < col.length; i++) if (col[i].ly - col[i - 1].ly < 19) col[i].ly = col[i - 1].ly + 19;
      for (const q of col) q.ly = Math.min(Math.max(q.ly, 12), o.h - 12);
    }
    for (const q of L) {
      const c = q.lb.color || '#F5F5F0';
      g.globalAlpha = q.lb.alpha ?? 1;
      if (!q.lb.fixed) {
        g.strokeStyle = 'rgba(245,245,240,.55)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(q.p.x, q.p.y); g.lineTo(q.lx, q.ly); g.stroke();
        g.fillStyle = c; g.beginPath(); g.arc(q.p.x, q.p.y, 2.6, 0, Math.PI * 2); g.fill();
      }
      const bx = q.lb.fixed ? q.p.x - q.tw / 2 : (q.side > 0 ? q.lx : q.lx - q.tw);
      g.fillStyle = 'rgba(10,10,10,.78)'; g.strokeStyle = q.lb.on ? '#5EEAD4' : 'rgba(58,58,56,.9)';
      g.beginPath(); g.roundRect(bx, q.ly - 9, q.tw, 18, 5); g.fill(); g.stroke();
      g.fillStyle = c; g.fillText(q.lb.text, bx + 6, q.ly + 0.5);
      g.globalAlpha = 1;
    }
  }
  // Picking: ray against the boxes of visible structures, then their triangles
  pick(clientX, clientY, { packs } = {}) {
    const rc = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rc.left) / rc.width) * 2 - 1, -((clientY - rc.top) / rc.height) * 2 + 1);
    const rc2 = new THREE.Raycaster(); rc2.setFromCamera(ndc, this.camera);
    let best = null;
    const consider = (key, pv) => {
      if (!pv.mesh.visible || !pv.pickable || (pv.mat.transparent && pv.mat.opacity < 0.3)) return;
      if (packs && !packs.includes(key)) return;
      pv.mesh.updateMatrixWorld();
      _inv.copy(pv.mesh.matrixWorld).invert(); _ray.copy(rc2.ray).applyMatrix4(_inv);
      const P = pv.pack.geo.attributes.position.array; const I = pv.pack.geo.index.array;
      for (const it of pv.items) {
        if (!pv.vis[it.k] || !_ray.intersectsBox(it.box)) continue;
        for (let i = it.i0; i < it.i0 + it.ni; i += 3) {
          _a.fromArray(P, I[i] * 3); _b.fromArray(P, I[i + 1] * 3); _c.fromArray(P, I[i + 2] * 3);
          if (!_ray.intersectTriangle(_a, _b, _c, false, _hit)) continue;
          const w = _hit.clone().applyMatrix4(pv.mesh.matrixWorld);
          if (this.clip && this.clip.distanceToPoint(w) < 0) continue;
          const d = w.distanceTo(rc2.ray.origin);
          if (!best || d < best.d) best = { d, key, pv, item: it, point: w };
        }
      }
    };
    for (const [key, pv] of Object.entries(this.packs)) consider(key, pv);
    if (this.extraPick) { const e = this.extraPick(rc2.ray); if (e && (!best || e.d < best.d)) best = e; }
    return best;
  }
  _pointers(signal) {
    const el = this.renderer.domElement; let down = null; let last = 0;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { signal });
    el.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 6 || !this.onPick) return;
      this.onPick(this.pick(e.clientX, e.clientY), e);
    }, { signal });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || down || !this.hover) { if (down) this.tip.style.display = 'none'; return; }
      const now = performance.now(); if (now - last < 70) return; last = now;
      const h = this.pick(e.clientX, e.clientY);
      const txt = h ? this.hover(h) : null;
      if (!txt) { this.tip.style.display = 'none'; el.style.cursor = ''; return; }
      const rc = this.host.getBoundingClientRect();
      this.tip.textContent = txt; this.tip.style.display = 'block';
      this.tip.style.left = `${e.clientX - rc.left}px`; this.tip.style.top = `${e.clientY - rc.top}px`;
      el.style.cursor = 'pointer';
    }, { signal });
    el.addEventListener('pointerleave', () => { this.tip.style.display = 'none'; }, { signal });
  }
}

// Tubes for procedural nerves and the spinal cord (schematic paths, built from bone landmarks)
export function tube(points, radius, color, { segs, radial = 8, radiusFn, opacity = 1, emissive = 0 } = {}) {
  const pts = points.map((p) => (p instanceof THREE.Vector3 ? p : new THREE.Vector3(...p)));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const n = segs || Math.max(8, Math.round(curve.getLength() / 0.006));
  const geo = new THREE.TubeGeometry(curve, n, radius, radial, false);
  if (radiusFn) {
    // taper: scale ring vertices around the curve
    const pos = geo.attributes.position; const fr = curve.computeFrenetFrames(n, false); const v = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      const c = curve.getPointAt(i / n); const k = radiusFn(i / n);
      for (let j = 0; j <= radial; j++) { const ix = i * (radial + 1) + j; v.fromBufferAttribute(pos, ix).sub(c).multiplyScalar(k).add(c); pos.setXYZ(ix, v.x, v.y, v.z); }
    }
    geo.computeVertexNormals();
  }
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: new THREE.Color(color), emissiveIntensity: emissive, transparent: opacity < 1, opacity });
  const m = new THREE.Mesh(geo, mat); m.userData.own = true; m.userData.curve = curve;
  return m;
}

// Info card in the panel for the selected structure
export function infoCard(ctx) {
  const el = ctx.h('<div class="card" style="min-height:64px"><span class="eyebrow">Selected</span><b style="font:700 19px/1.1 var(--f-display);text-transform:uppercase;letter-spacing:.02em">Tap a structure</b><p class="small muted">Tap or click anything on the model to name it.</p></div>');
  el.set = (title, body, eyebrow = 'Selected') => {
    el.querySelector('.eyebrow').textContent = eyebrow;
    el.querySelector('b').textContent = title;
    el.querySelector('p').innerHTML = body || '';
  };
  return el;
}

// Small stage dock helper
export function dock(ctx, groups, { top = false } = {}) {
  const d = ctx.h(`<div class="dock" style="${top ? 'top:0;bottom:auto;' : ''}"></div>`);
  for (const g of groups) d.append(g);
  ctx.stage.append(d);
  return d;
}
export function group(ctx, label, buttons, onClick, { multi = false, value } = {}) {
  const g = ctx.h(`<div class="grp glass">${label ? `<span>${ctx.esc(label)}</span>` : ''}${buttons.map(([v, l]) => `<button data-v="${ctx.esc(v)}">${ctx.esc(l)}</button>`).join('')}</div>`);
  const bs = [...g.querySelectorAll('button')];
  const set = (v) => bs.forEach((b) => b.classList.toggle('on', multi ? !!(v && v[b.dataset.v]) : b.dataset.v === String(v)));
  if (value !== undefined) set(value);
  bs.forEach((b) => b.addEventListener('click', () => {
    if (!multi) set(b.dataset.v);
    onClick(b.dataset.v, b, set);
  }));
  g.set = set; g.buttons = bs;
  return g;
}

export function loadingNote(ctx, text = 'Loading 3D anatomy') {
  const n = ctx.h(`<div class="k-loading" style="pointer-events:none;z-index:4">${text}</div>`);
  ctx.stage.append(n);
  return { done: () => n.remove(), fail: (msg) => { n.textContent = msg || 'The 3D model did not load. Try refreshing.'; } };
}

// Name helpers
export const sideOf = (n) => (/^left\b/i.test(n) ? 'L' : /^right\b/i.test(n) ? 'R' : '');
export const bare = (n) => n.replace(/^(left|right)\s+/i, '');
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
