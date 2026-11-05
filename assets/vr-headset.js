// 3D VR headset in the home hero. It turns to follow the cursor (or phone tilt), blinks,
// squints when you hover a button, and "puts itself on" when clicked, then opens vr.html.
// Colours follow the site theme (--primary / --accent), so it changes with the palette button.
// Uses the same three.js build as the builder cube, so the browser loads it once.
// If WebGL is missing the CSS headset already in the markup stays visible.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const host = document.getElementById('vrEye');
const canvas = document.getElementById('vrHeadset');
if (host && canvas) init();

function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch { return; }
  host.classList.add('vr-eye--3d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1.8, 0.1, 50);
  const CAM_Z = 5.9;
  camera.position.set(0, 0.1, CAM_Z);

  // ---------- Theme ----------
  const parse = (str, fb) => { const c = new THREE.Color(); try { const s = (str || '').trim(); if (!s) return c.set(fb); c.setStyle(s); return c; } catch { return c.set(fb); } };
  const theme = { primary: new THREE.Color('#7c3aed'), accent: new THREE.Color('#ec4899'), dark: true, rainbow: false };
  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    theme.primary.copy(parse(cs.getPropertyValue('--primary'), '#7c3aed'));
    theme.accent.copy(parse(cs.getPropertyValue('--accent'), '#ec4899'));
    theme.dark = document.documentElement.classList.contains('dark') || matchMedia('(prefers-color-scheme: dark)').matches && !document.documentElement.classList.contains('light');
    theme.rainbow = document.documentElement.classList.contains('rainbow-mode') || host.classList.contains('rainbow-vr-temp');
  }
  readTheme();

  // ---------- Environment for reflections, repainted when the theme changes ----------
  const envC = document.createElement('canvas'); envC.width = 256; envC.height = 128;
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  function paintEnv(p, a) {
    const g = envC.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, '#1d1236'); grd.addColorStop(0.55, '#2a1440'); grd.addColorStop(1, '#07040d');
    g.fillStyle = grd; g.fillRect(0, 0, 256, 128);
    const blob = (x, y, r, col) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, 256, 128); };
    blob(60, 34, 48, 'rgba(255,255,255,.95)');
    blob(130, 20, 30, 'rgba(255,255,255,.7)');
    blob(190, 30, 60, `#${a.getHexString()}`);
    blob(30, 80, 60, `#${p.getHexString()}`);
    blob(225, 92, 40, `#${p.clone().lerp(a, 0.5).getHexString()}`);
    const tex = new THREE.CanvasTexture(envC);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const rt = pmrem.fromEquirectangular(tex);
    tex.dispose();
    if (envRT) envRT.dispose();
    envRT = rt; scene.environment = rt.texture;
  }

  // ---------- Model ----------
  function rrect(w, h, r) {
    const s = new THREE.Shape(); const x = -w / 2; const y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  }
  const wrap = (geo, k, dz = 0) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) + dz - x * x * k); } geo.computeVertexNormals(); return geo; };
  const head = new THREE.Group(); scene.add(head);

  const shellMat = new THREE.MeshPhysicalMaterial({ color: 0x241a38, roughness: 0.42, metalness: 0.1, clearcoat: 0.45, clearcoatRoughness: 0.45, sheen: 0.7, sheenRoughness: 0.5 });
  const shellGeo = new THREE.ExtrudeGeometry(rrect(3.0, 1.55, 0.62), { depth: 0.9, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.2, bevelSegments: 8, curveSegments: 20 });
  shellGeo.translate(0, 0, -0.9);
  head.add(new THREE.Mesh(wrap(shellGeo, 0.12), shellMat));

  const visorGeo = new THREE.ExtrudeGeometry(rrect(2.78, 1.36, 0.55), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 6, curveSegments: 20 });
  head.add(new THREE.Mesh(wrap(visorGeo, 0.12, 0.2), new THREE.MeshPhysicalMaterial({ color: 0x05030c, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6, transparent: true, opacity: 0.88 })));

  // Outward eye display behind the glass, redrawn each frame
  const eyeC = document.createElement('canvas'); eyeC.width = 512; eyeC.height = 256;
  const eg = eyeC.getContext('2d');
  const eyeTex = new THREE.CanvasTexture(eyeC); eyeTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(wrap(new THREE.PlaneGeometry(2.5, 1.25, 32, 1), 0.12, 0.17), new THREE.MeshBasicMaterial({ map: eyeTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  head.add(screen);

  const strapMat = new THREE.MeshStandardMaterial({ color: 0x3a2a55, roughness: 0.85 });
  const strapCurve = new THREE.CatmullRomCurve3([[-1.62, 0, -0.6], [-1.9, 0.05, -1.6], [-1.2, 0.1, -2.6], [0, 0.12, -2.95], [1.2, 0.1, -2.6], [1.9, 0.05, -1.6], [1.62, 0, -0.6]].map((v) => new THREE.Vector3(...v)));
  const strap = new THREE.Mesh(new THREE.TubeGeometry(strapCurve, 64, 0.16, 10, false), strapMat);
  strap.scale.y = 1.6; head.add(strap);
  const cushion = new THREE.Mesh(new THREE.ExtrudeGeometry(rrect(2.7, 1.25, 0.5), { depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 4 }), new THREE.MeshStandardMaterial({ color: 0x120c1c, roughness: 1 }));
  cushion.position.z = -1.35; head.add(cushion);
  const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.42, 4, 10), new THREE.MeshBasicMaterial({ color: 0xec4899 }));
  bar.rotation.z = Math.PI / 2; bar.position.set(0, 0.72, 0.18); head.add(bar);

  const hemi = new THREE.HemisphereLight(0xb9a6ff, 0x1a0b25, 0.7); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(-3, 4, 5); scene.add(key);
  const rimA = new THREE.DirectionalLight(0xec4899, 2.5); rimA.position.set(4, 1, -3); scene.add(rimA);
  const rimP = new THREE.DirectionalLight(0x7c3aed, 2.0); rimP.position.set(-4, -1, -2); scene.add(rimP);

  // Apply the theme to materials and lights
  const tmp = new THREE.Color();
  let themeKey = '';
  function applyTheme(t) {
    let p = theme.primary.clone(); let a = theme.accent.clone();
    if (theme.rainbow) { p.setHSL((t * 0.12) % 1, 0.8, 0.55); a.setHSL((t * 0.12 + 0.35) % 1, 0.85, 0.6); }
    // Pure black or white (minimalist modes) would kill the glow, so fall back to the default pair
    if (p.getHSL({}).s < 0.05 && a.getHSL({}).s < 0.05) { p = new THREE.Color('#7c3aed'); a = new THREE.Color('#ec4899'); }
    rimA.color.copy(a); rimP.color.copy(p); bar.material.color.copy(a);
    shellMat.sheenColor.copy(p).lerp(a, 0.3);
    shellMat.color.copy(theme.dark ? tmp.set(0x241a38).lerp(p, 0.12) : tmp.set(0xe9e4f2).lerp(p, 0.1));
    strapMat.color.copy(theme.dark ? tmp.set(0x3a2a55).lerp(p, 0.15) : tmp.set(0xcfc6e0).lerp(p, 0.1));
    eyeColors.iris = `#${a.getHexString()}`; eyeColors.glow = `#${p.clone().lerp(a, 0.5).getHexString()}`;
    const k = `${p.getHexString()}${a.getHexString()}${theme.dark}`;
    if (k !== themeKey && !theme.rainbow) { themeKey = k; paintEnv(p, a); }
    if (!envRT) paintEnv(p, a);
  }
  const eyeColors = { iris: '#ec4899', glow: '#a855f7' };

  // ---------- Eyes ----------
  const look = { x: 0, y: 0 }; let lid = 0; let happy = 0;
  function drawEyes() {
    eg.clearRect(0, 0, 512, 256);
    for (const cx of [168, 344]) {
      const px = cx + look.x * 30; const py = 128 + look.y * 22;
      const rg = eg.createRadialGradient(px, py, 0, px, py, 92);
      rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.18, eyeColors.iris); rg.addColorStop(0.55, `${eyeColors.glow}88`); rg.addColorStop(1, 'rgba(0,0,0,0)');
      eg.fillStyle = rg; eg.beginPath(); eg.arc(px, py, 92, 0, Math.PI * 2); eg.fill();
      eg.fillStyle = 'rgba(4,2,10,.96)'; eg.beginPath(); eg.arc(px + look.x * 8, py + look.y * 6, 27, 0, Math.PI * 2); eg.fill();
      eg.fillStyle = 'rgba(255,255,255,.95)'; eg.beginPath(); eg.arc(px + look.x * 8 + 10, py + look.y * 6 - 10, 7, 0, Math.PI * 2); eg.fill();
      eg.fillStyle = '#000';
      if (lid > 0) eg.fillRect(px - 100, py - 96, 200, 192 * lid);
      if (happy > 0.01) { eg.beginPath(); eg.ellipse(px, py + 96, 110, 96 * happy, 0, Math.PI, 0, true); eg.lineTo(px + 110, 256); eg.lineTo(px - 110, 256); eg.fill(); }
    }
    eyeTex.needsUpdate = true;
  }

  // ---------- Input ----------
  const target = { x: 0.3, y: -0.15 }; const cur = { x: 0, y: 0 }; const vel = { x: 0, y: 0 };
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    target.x = clamp((e.clientX - (r.left + r.width / 2)) / (innerWidth / 2));
    target.y = clamp((e.clientY - (r.top + r.height / 2)) / (innerHeight / 2));
  }, { passive: true });
  addEventListener('deviceorientation', (e) => {
    if (e.gamma == null || e.beta == null) return;
    target.x = clamp(e.gamma / 30); target.y = clamp((e.beta - 45) / 30);
  }, { passive: true });
  let happyT = 0;
  document.querySelectorAll('.hero .btn, .hero a.btn, .hero-cta a, .hero .badges .tag').forEach((el) => {
    el.addEventListener('pointerenter', () => { happyT = 1; });
    el.addEventListener('pointerleave', () => { happyT = 0; });
  });

  // Click: put it on (zoom into the visor), then go to the 3D portfolio
  let zoom = 0;
  host.addEventListener('click', (e) => {
    e.preventDefault(); e.stopImmediatePropagation();
    if (zoom || reduce) { location.href = 'vr.html'; return; }
    zoom = 0.0001;
  }, true);

  // ---------- Size and visibility ----------
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas); resize();
  let onScreen = true;
  new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; }).observe(canvas);

  // ---------- Loop ----------
  let last = performance.now(); let nextBlink = 1.5; let blinkT = -1; let themeTick = 0;
  renderer.setAnimationLoop((now) => {
    if (!onScreen || document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = now / 1000;
    themeTick -= dt; if (themeTick <= 0) { readTheme(); themeTick = 0.5; }
    applyTheme(t);
    for (const k of ['x', 'y']) { vel[k] += (target[k] - cur[k]) * 60 * dt; vel[k] *= Math.pow(0.0009, dt); cur[k] += vel[k] * dt * 4; }
    head.rotation.set(cur.y * 0.45, cur.x * 0.6, -cur.x * 0.06);
    head.position.y = reduce ? 0 : Math.sin(t * 1.4) * 0.05;
    look.x = cur.x; look.y = cur.y;
    if (t > nextBlink && blinkT < 0) blinkT = 0;
    if (blinkT >= 0) { blinkT += dt; lid = blinkT < 0.07 ? blinkT / 0.07 : Math.max(0, 1 - (blinkT - 0.07) / 0.08); if (blinkT > 0.15) { blinkT = -1; lid = 0; nextBlink = t + 2 + Math.random() * 3; } }
    happy += (happyT * 0.45 - happy) * Math.min(1, dt * 12);
    if (zoom > 0) {
      zoom = Math.min(1, zoom + dt * 1.6);
      const e = zoom * zoom * (3 - 2 * zoom);
      camera.position.z = CAM_Z - e * 5.4; head.rotation.set(0, 0, 0);
      if (zoom >= 1) { zoom = 0; renderer.setAnimationLoop(null); location.href = 'vr.html'; }
    }
    drawEyes();
    renderer.render(scene, camera);
  });
  // Coming back with the back button restores the page from cache with the camera zoomed in
  addEventListener('pageshow', (e) => { if (e.persisted) location.reload(); });
}
