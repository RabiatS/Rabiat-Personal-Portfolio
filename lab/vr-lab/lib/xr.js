// Shared helpers for VR Lab chapters: a three.js renderer bound to the stage, simple geometry the kit build
// does not export (boxes, planes), a reusable room, an orbit drag and a 2D overlay for labels and lines.
import * as THREE from '../../study/kit/three.min.js';
export { THREE };

export const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const MONO = (px = 11, w = 500) => `${w} ${px}px "DM Mono", ui-monospace, monospace`;
export const DISPLAY = (px = 14, w = 700) => `${w} ${px}px Rajdhani, system-ui, sans-serif`;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const DEG = Math.PI / 180;

// Box geometry with normals and uvs (24 vertices, 6 faces)
export function boxGeo(w = 1, h = 1, d = 1) {
  const x = w / 2, y = h / 2, z = d / 2;
  const faces = [
    [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z], [1, 0, 0]],
    [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z], [-1, 0, 0]],
    [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z], [0, 1, 0]],
    [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [0, -1, 0]],
    [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z], [0, 0, 1]],
    [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z], [0, 0, -1]],
  ];
  const pos = []; const nor = []; const uv = []; const idx = [];
  faces.forEach((f, i) => {
    for (let k = 0; k < 4; k++) { pos.push(...f[k]); nor.push(...f[4]); }
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    const o = i * 4; idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  return g;
}

// Plane facing +Y (a floor) of size w by d, with uv repeat built in
export function floorGeo(w = 1, d = 1, rep = 1) {
  const x = w / 2, z = d / 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-x, 0, z, x, 0, z, x, 0, -z, -x, 0, -z]), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, rep, 0, rep, rep, 0, rep]), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

// Plane facing +Z (a wall) of size w by h
export function wallGeo(w = 1, h = 1, rep = 1) {
  const x = w / 2, y = h / 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-x, -y, 0, x, -y, 0, x, y, 0, -x, y, 0]), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, rep, 0, rep, rep * h / w, 0, rep * h / w]), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
}

// Canvas textures
export function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = 'srgb';
  if (repeat) { t.wrapS = t.wrapT = 1000; }
  t.anisotropy = 4;
  return t;
}
// deterministic pseudo random
export function rng(seed = 1) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export const tex = {
  wood: () => canvasTex(512, 512, (g, w, h) => {
    const r = rng(7);
    g.fillStyle = '#6b4a33'; g.fillRect(0, 0, w, h);
    const planks = 6;
    for (let i = 0; i < planks; i++) {
      const y = (i * h) / planks; const tone = 0.82 + r() * 0.3;
      g.fillStyle = `rgb(${Math.round(120 * tone)},${Math.round(84 * tone)},${Math.round(58 * tone)})`;
      g.fillRect(0, y, w, h / planks - 2);
      for (let k = 0; k < 40; k++) {
        g.strokeStyle = `rgba(40,25,15,${0.08 + r() * 0.12})`; g.lineWidth = 0.6 + r();
        g.beginPath(); const yy = y + r() * (h / planks);
        g.moveTo(0, yy); g.bezierCurveTo(w * 0.3, yy + (r() - 0.5) * 8, w * 0.7, yy + (r() - 0.5) * 8, w, yy + (r() - 0.5) * 6); g.stroke();
      }
      g.fillStyle = 'rgba(20,12,8,.7)'; g.fillRect(0, y + h / planks - 2, w, 2);
    }
  }, true),
  plaster: (base = '#cfc8bc') => canvasTex(256, 256, (g, w, h) => {
    const r = rng(3); g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${r() * 0.05})`; g.fillRect(r() * w, r() * h, 2, 2); }
  }, true),
  grid: (line = '#5EEAD4', bg = '#07141a') => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = line; g.globalAlpha = 0.55; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
    g.globalAlpha = 0.18; g.lineWidth = 1;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo((i * w) / 4, 0); g.lineTo((i * w) / 4, h); g.moveTo(0, (i * h) / 4); g.lineTo(w, (i * h) / 4); g.stroke(); }
  }, true),
  checker: (a = '#2a2a2a', b = '#1b1b1b') => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
  }, true),
  sky: (top = '#0b1530', bottom = '#2a1f3d') => canvasTex(16, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(0.5, bottom); gr.addColorStop(1, '#05060a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }),
  rug: () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#7a2e2e'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#d9b77a'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    g.lineWidth = 2; g.strokeRect(30, 30, w - 60, h - 60);
    const r = rng(11); for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
  }),
};

export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...o });
export const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
export function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }

// A furnished room in meters. Floor at y = 0, viewer usually near z = 2.5 looking toward -z.
export function makeRoom({ size = 8, height = 3, walls = true } = {}) {
  const group = new THREE.Group();
  const floorMat = std('#ffffff', { map: tex.wood(), roughness: 0.6 });
  floorMat.map.repeat.set(size / 2, size / 2);
  const floor = mesh(floorGeo(size, size), floorMat);
  group.add(floor);
  const wallMat = std('#ffffff', { map: tex.plaster(), roughness: 0.95 });
  const wallList = [];
  if (walls) {
    const back = mesh(wallGeo(size, height), wallMat, 0, height / 2, -size / 2);
    const left = mesh(wallGeo(size, height), wallMat, -size / 2, height / 2, 0); left.rotation.y = Math.PI / 2;
    const right = mesh(wallGeo(size, height), wallMat, size / 2, height / 2, 0); right.rotation.y = -Math.PI / 2;
    const front = mesh(wallGeo(size, height), wallMat, 0, height / 2, size / 2); front.rotation.y = Math.PI;
    const ceil = mesh(floorGeo(size, size), std('#e9e5dd', { roughness: 1, emissive: '#5a554c' }), 0, height, 0); ceil.rotation.x = Math.PI;
    wallList.push(back, left, right, front, ceil);
    group.add(back, left, right, front, ceil);
    // window on back wall
    const win = mesh(wallGeo(1.8, 1.1), basic('#9cc6e6'), 1.6, 1.65, -size / 2 + 0.01);
    const frame = mesh(boxGeo(1.9, 1.2, 0.04), std('#efe9df'), 1.6, 1.65, -size / 2 + 0.005);
    const sill = mesh(boxGeo(1.9, 0.05, 0.14), std('#efe9df'), 1.6, 1.08, -size / 2 + 0.07);
    group.add(frame, win, sill);
    // picture on left wall
    const pic = mesh(boxGeo(0.04, 0.6, 0.9), std('#2b3a4a'), -size / 2 + 0.03, 1.6, -1.2);
    group.add(pic);
  }
  const rug = mesh(floorGeo(2.6, 1.8), std('#ffffff', { map: tex.rug(), roughness: 1 }), 0, 0.004, -0.6);
  group.add(rug);
  // table
  const tableMat = std('#8a6648', { roughness: 0.5 });
  const table = new THREE.Group();
  table.add(mesh(boxGeo(1.4, 0.05, 0.8), tableMat, 0, 0.74, 0));
  for (const [x, z] of [[-0.64, -0.34], [0.64, -0.34], [-0.64, 0.34], [0.64, 0.34]]) table.add(mesh(boxGeo(0.05, 0.72, 0.05), tableMat, x, 0.36, z));
  table.position.set(0, 0, -0.6);
  group.add(table);
  // things on the table
  const vase = mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.32, 24), std('#2f6f73', { roughness: 0.35 }), 0.38, 0.765 + 0.16, -0.6);
  const mug = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 20), std('#e9e4da'), -0.3, 0.815, -0.45);
  const book = mesh(boxGeo(0.24, 0.04, 0.17), std('#b5452f'), -0.1, 0.785, -0.75);
  group.add(vase, mug, book);
  // sofa
  const sofaMat = std('#46566b', { roughness: 0.95 });
  const sofa = new THREE.Group();
  sofa.add(mesh(boxGeo(2.0, 0.42, 0.85), sofaMat, 0, 0.21, 0), mesh(boxGeo(2.0, 0.5, 0.2), sofaMat, 0, 0.62, -0.33));
  sofa.add(mesh(boxGeo(0.2, 0.3, 0.85), sofaMat, -0.95, 0.55, 0), mesh(boxGeo(0.2, 0.3, 0.85), sofaMat, 0.95, 0.55, 0));
  sofa.position.set(-0.4, 0, -2.9);
  group.add(sofa);
  // lamp
  const lamp = new THREE.Group();
  lamp.add(mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.03, 24), std('#222'), 0, 0.015, 0));
  lamp.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.45, 8), std('#333'), 0, 0.74, 0));
  lamp.add(mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.3, 24, 1, true), std('#f3e6c8', { emissive: '#7a6440', side: 2 }), 0, 1.5, 0));
  lamp.position.set(1.9, 0, -2.8);
  group.add(lamp);
  // plant
  const plant = new THREE.Group();
  plant.add(mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.35, 20), std('#c8b79e'), 0, 0.175, 0));
  const leaf = std('#3f7a3a', { roughness: 0.8 });
  const r = rng(5);
  for (let i = 0; i < 14; i++) plant.add(mesh(new THREE.SphereGeometry(0.12 + r() * 0.08, 10, 8), leaf, (r() - 0.5) * 0.35, 0.5 + r() * 0.55, (r() - 0.5) * 0.35));
  plant.position.set(-2.7, 0, -2.6);
  group.add(plant);
  return { group, floor, walls: wallList, table, vase, mug, book, sofa, lamp, plant, size, height };
}

export function addLights(scene, k = 1) {
  const hemi = new THREE.HemisphereLight('#fff6e8', '#3a3530', 1.25 * k);
  const sun = new THREE.DirectionalLight('#ffffff', 1.6 * k); sun.position.set(2, 5, 3);
  scene.add(hemi, sun);
  return { hemi, sun };
}

// A WebGL renderer bound to the stage (or to an offscreen canvas when offscreen is true).
export function makeGL(ctx, { parent = ctx.stage, offscreen = false, preserve = false, alpha = false, antialias = true, onSize } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias, alpha, preserveDrawingBuffer: preserve });
  renderer.outputColorSpace = 'srgb';
  const el = renderer.domElement;
  const o = { renderer, el, w: 1, h: 1, dpr: 1 };
  if (!offscreen) {
    el.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
    parent.append(el);
  }
  o.resize = (w, h) => {
    if (!w || !h) return;
    o.w = w; o.h = h; o.dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(o.dpr);
    renderer.setSize(w, h, false);
    onSize && onSize(w, h);
  };
  if (!offscreen) ctx.onResize(o.resize);
  ctx.signal.addEventListener('abort', () => {
    try { renderer.setAnimationLoop && renderer.setAnimationLoop(null); renderer.dispose(); renderer.forceContextLoss(); } catch (e) { /* already gone */ }
    el.remove();
  });
  return o;
}

// A transparent 2D overlay canvas above everything on the stage
export function overlay(ctx, z = 2) {
  const cv = ctx.canvas({ style: `z-index:${z};pointer-events:none` });
  return cv;
}

// Drag to orbit or look. state: { yaw, pitch } in radians. Returns a function that tells if a drag is active.
export function drag(el, signal, onMove, onDown, onUp) {
  let id = null; let lx = 0; let ly = 0;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', (e) => { id = e.pointerId; lx = e.clientX; ly = e.clientY; try { el.setPointerCapture(id); } catch { /* ok */ } onDown && onDown(e); }, { signal });
  el.addEventListener('pointermove', (e) => { if (id !== e.pointerId) return; const dx = e.clientX - lx; const dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; onMove(dx, dy, e); }, { signal });
  const up = (e) => { if (id !== e.pointerId) return; id = null; onUp && onUp(e); };
  el.addEventListener('pointerup', up, { signal });
  el.addEventListener('pointercancel', up, { signal });
  return () => id !== null;
}

// Project a world point to overlay pixel coordinates
const _v = new THREE.Vector3();
export function toScreen(p, camera, w, h, x0 = 0, y0 = 0) {
  _v.set(p.x, p.y, p.z).project(camera);
  return { x: x0 + (_v.x * 0.5 + 0.5) * w, y: y0 + (-_v.y * 0.5 + 0.5) * h, behind: _v.z > 1 || _v.z < -1 };
}

// Pill label on a 2D context
export function pill(g, text, x, y, { color = '#F5F5F0', bg = 'rgba(10,10,10,.72)', align = 'center', px = 11 } = {}) {
  g.font = MONO(px);
  const w = g.measureText(text).width + 12; const hh = px + 9;
  let lx = x - w / 2; if (align === 'left') lx = x; if (align === 'right') lx = x - w;
  g.fillStyle = bg; g.beginPath(); g.roundRect(lx, y - hh / 2, w, hh, 5); g.fill();
  g.fillStyle = color; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(text, lx + 6, y + 0.5);
}

// Set horizontal fov on a perspective camera
export function setHFov(cam, hdeg, aspect) {
  cam.aspect = aspect;
  cam.fov = 2 * Math.atan(Math.tan((hdeg * DEG) / 2) / aspect) / DEG;
  cam.updateProjectionMatrix();
}

// Set every material in a group to an opacity (transparent when < 1)
export function fade(obj, a) {
  obj.visible = a > 0.003;
  obj.traverse((o) => {
    if (!o.material) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of ms) {
      if (m.userData.baseOpacity === undefined) m.userData.baseOpacity = m.opacity;
      const want = a < 0.999;
      if (m.transparent !== want) { m.transparent = want; m.needsUpdate = true; }
      m.opacity = m.userData.baseOpacity * a;
      m.depthWrite = a > 0.5;
    }
  });
}

export function addDock(ctx, html) {
  const d = ctx.h(`<div class="dock">${html}</div>`);
  ctx.stage.append(d);
  return d;
}
