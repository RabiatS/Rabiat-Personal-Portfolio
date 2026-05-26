/**
 * Builder cube — desktop-only scroll companion for index.html
 * Unlock: index.html?cube=1  or  localStorage.setItem('builderCubeMode','true')
 * Disable: index.html?cube=0  or  localStorage.removeItem('builderCubeMode')
 *
 * BoxGeometry material order (Three.js): +X, -X, +Y, -Y, +Z, -Z
 */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import {
  applyUrlUnlock,
  canUseBuilderCube,
  canUseBuilderMode,
  DESKTOP_MIN,
  enableBuilderModeClass,
} from './builder-mode.js';
import { initLaunchScroll } from './launch-scroll.js';

const FACE_LABELS = ['HARDWARE', 'SOFTWARE', 'ENGINEER', 'VR', 'AI / ML', 'RESEARCHER'];

const RAINBOW_ACCENTS = ['#ff006e', '#8338ec', '#3a86ff', '#06ffa5', '#ffbe0b', '#fb5607'];

function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function getThemeKey() {
  const html = document.documentElement;
  if (html.classList.contains('rainbow-mode') || document.body.classList.contains('rainbow-mode')) {
    return 'rainbow';
  }
  if (html.classList.contains('plain-mode')) {
    return html.classList.contains('plain-mode--rabiat') ? 'rabiat' : 'plain';
  }
  if (html.classList.contains('dark')) return 'dark';
  return 'light';
}

/** Swap palette slots 0 and 2 so accent colors follow ENGINEER (+Y) and HARDWARE (+X) */
function alignPaletteFaces(faces) {
  const next = faces.slice();
  [next[0], next[2]] = [next[2], next[0]];
  return next;
}

function buildThemePalette(themeKey) {
  const primary = cssVar('--primary', '#7c3aed');
  const accent = cssVar('--accent', '#ec4899');
  const text = cssVar('--text', '#1a1a1a');
  const bg = cssVar('--bg', '#fefefe');
  const elevated = cssVar('--bg-elevated', '#ffffff');
  const surface = cssVar('--surface', '#ffffff');
  const flowMid = cssVar('--flow-mid', '#f3f1f7');

  switch (themeKey) {
    case 'rabiat':
      return {
        faces: alignPaletteFaces([
          { bg: '#16161f', accent: '#b81e2c' },
          { bg: '#12121c', accent: '#4a8f8f' },
          { bg: '#2a2a36', accent: '#ececee' },
          { bg: '#1a1f2e', accent: '#b81e2c' },
          { bg: '#0f2a2a', accent: '#4a8f8f' },
          { bg: '#0a0a0f', accent: '#ececee' },
        ]),
        text: '#ececee',
        edge: '#b81e2c',
        glow: '#b81e2c',
        lights: { ambient: 0xffffff, ambientI: 0.5, key: 0xffffff, keyI: 1.0, rim: 0xb81e2c, rimI: 0.6, fill: 0x4a8f8f, fillI: 0.35 },
      };
    case 'plain':
      return {
        faces: alignPaletteFaces([
          { bg: '#ffffff', accent: '#000000' },
          { bg: '#f7f7f7', accent: '#333333' },
          { bg: '#ffffff', accent: '#000000' },
          { bg: '#f0f0f0', accent: '#000000' },
          { bg: '#fafafa', accent: '#333333' },
          { bg: '#ffffff', accent: '#000000' },
        ]),
        text: '#000000',
        edge: '#000000',
        glow: '#333333',
        lights: { ambient: 0xffffff, ambientI: 0.75, key: 0xffffff, keyI: 0.95, rim: 0x333333, rimI: 0.25, fill: 0xffffff, fillI: 0.2 },
      };
    case 'rainbow':
      return {
        faces: alignPaletteFaces(
          RAINBOW_ACCENTS.map((c, i) => ({
            bg: i % 2 === 0 ? '#14141f' : '#1a1a28',
            accent: c,
          }))
        ),
        text: '#ffffff',
        edge: '#ff006e',
        glow: '#8338ec',
        lights: { ambient: 0xffffff, ambientI: 0.45, key: 0xffffff, keyI: 1.0, rim: 0x8338ec, rimI: 0.7, fill: 0x06ffa5, fillI: 0.4 },
      };
    case 'dark':
      return {
        faces: alignPaletteFaces([
          { bg: '#1c1b1e', accent: primary },
          { bg: '#232225', accent: accent },
          { bg: '#2a292d', accent: primary },
          { bg: '#18171a', accent: accent },
          { bg: '#151416', accent: primary },
          { bg: '#111011', accent: accent },
        ]),
        text: cssVar('--text', '#f3f2f4'),
        edge: accent,
        glow: primary,
        lights: { ambient: 0xffffff, ambientI: 0.4, key: 0xf3f2f4, keyI: 0.85, rim: primary, rimI: 0.55, fill: accent, fillI: 0.3 },
      };
    default:
      return {
        faces: alignPaletteFaces([
          { bg: flowMid, accent: primary },
          { bg: elevated, accent: accent },
          { bg: surface, accent: primary },
          { bg: bg, accent: accent },
          { bg: flowMid, accent: primary },
          { bg: elevated, accent: accent },
        ]),
        text,
        edge: accent,
        glow: primary,
        lights: { ambient: 0xffffff, ambientI: 0.65, key: 0xffffff, keyI: 1.05, rim: primary, rimI: 0.45, fill: accent, fillI: 0.28 },
      };
  }
}

function hexToThreeColor(hex) {
  const c = new THREE.Color();
  if (typeof hex === 'number') {
    c.setHex(hex);
  } else {
    c.set(hex.startsWith('#') ? hex : `#${hex}`);
  }
  return c;
}

function parseHex(hex) {
  const c = hex.startsWith('#') ? hex.slice(1) : hex;
  const n = parseInt(c, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mixHex(a, b, t) {
  const ca = parseHex(a);
  const cb = parseHex(b);
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

function getThemeSignature() {
  const key = getThemeKey();
  if (key === 'light' || key === 'dark') {
    return `${key}:${cssVar('--primary', '')}:${cssVar('--accent', '')}:${cssVar('--text', '')}`;
  }
  return key;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function makeEnvMap() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.45, '#e8e4f0');
  grad.addColorStop(1, '#9080a8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFaceTexture(label, bg, accent, textColor) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const cx = size / 2;
  const cy = size / 2;
  const bgGrad = ctx.createRadialGradient(cx, cy * 0.85, size * 0.05, cx, cy, size * 0.72);
  bgGrad.addColorStop(0, mixHex(bg, accent, 0.12));
  bgGrad.addColorStop(0.55, bg);
  bgGrad.addColorStop(1, mixHex(bg, '#000000', 0.22));
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;
  ctx.strokeRect(14, 14, size - 28, size - 28);
  ctx.restore();

  ctx.strokeStyle = mixHex(accent, '#ffffff', 0.35);
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, size - 40, size - 40);

  const drawLabel = (text, y, fontSize) => {
    ctx.font = `700 ${fontSize}px Rajdhani, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText(text, cx + 2, y + 3);

    ctx.fillStyle = mixHex(textColor, '#000000', 0.15);
    ctx.fillText(text, cx, y + 1);

    ctx.fillStyle = textColor;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    ctx.fillText(text, cx, y);
    ctx.shadowBlur = 0;
  };

  if (label.includes('/')) {
    const parts = label.split('/').map((p) => p.trim());
    drawLabel(parts[0], cy - 30, 46);
    drawLabel('/ ' + parts[1], cy + 30, 46);
  } else {
    drawLabel(label, cy, label.length > 8 ? 44 : 54);
  }

  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const sheen = ctx.createLinearGradient(0, 0, size, size);
  sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
  sheen.addColorStop(0.4, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

applyUrlUnlock();
enableBuilderModeClass();

if (canUseBuilderMode()) {
  initLaunchScroll();
}

if (canUseBuilderCube()) {
  initBuilderCube();
}

function initBuilderCube() {
  let host;
  let renderer;
  try {
    host = document.createElement('div');
    host.id = 'builderCubeHost';
    host.className = 'builder-cube-host';
    host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch {
    if (host?.parentNode) host.remove();
    return;
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hoverEnabled = !prefersReducedMotion;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, -0.38, 3.85);
  camera.lookAt(0, 0.1, 0);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  host.appendChild(renderer.domElement);

  const envMap = makeEnvMap();

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
  keyLight.position.set(-2.5, 4, 3);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xb81e2c, 0.65);
  rimLight.position.set(3, 1, -2);
  scene.add(rimLight);

  const fillLight = new THREE.DirectionalLight(0x4a8f8f, 0.35);
  fillLight.position.set(0, -2, 2);
  scene.add(fillLight);

  const cubeGroup = new THREE.Group();
  cubeGroup.rotation.x = -0.12;
  scene.add(cubeGroup);

  const geometry = new THREE.BoxGeometry(0.92, 0.92, 0.92);
  const materials = FACE_LABELS.map(
    () =>
      new THREE.MeshStandardMaterial({
        metalness: 0.42,
        roughness: 0.38,
        envMap,
        envMapIntensity: 0.28,
      })
  );

  const cube = new THREE.Mesh(geometry, materials);
  cubeGroup.add(cube);

  const edges = new THREE.EdgesGeometry(geometry);
  const edgeLines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0xb81e2c, transparent: true, opacity: 0.88 })
  );
  cube.add(edgeLines);

  const glowEdges = new THREE.EdgesGeometry(geometry);
  const glowLines = new THREE.LineSegments(
    glowEdges,
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
  );
  glowLines.scale.setScalar(1.012);
  cube.add(glowLines);

  const sparkleGroup = new THREE.Group();
  cubeGroup.add(sparkleGroup);
  const sparkleCount = 10;
  const sparkles = [];
  for (let i = 0; i < sparkleCount; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.045), mat);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    sparkleGroup.add(mesh);
    sparkles.push({ mesh, phase: Math.random() * Math.PI * 2, speed: 0.8 + Math.random() * 1.2 });
  }

  let baseRimIntensity = 0.65;
  let baseEdgeOpacity = 0.88;
  let baseGlowOpacity = 0;
  let currentThemeSignature = '';

  function applyTheme() {
    const signature = getThemeSignature();
    if (signature === currentThemeSignature) return;
    currentThemeSignature = signature;

    const palette = buildThemePalette(getThemeKey());

    FACE_LABELS.forEach((label, i) => {
      const face = palette.faces[i];
      if (materials[i].map) materials[i].map.dispose();
      materials[i].map = makeFaceTexture(label, face.bg, face.accent, palette.text);
      materials[i].emissive.copy(hexToThreeColor(face.accent));
      materials[i].emissiveIntensity = 0;
      materials[i].needsUpdate = true;
    });

    edgeLines.material.color.copy(hexToThreeColor(palette.edge));
    glowLines.material.color.copy(hexToThreeColor(palette.glow));

    ambient.color.copy(hexToThreeColor(palette.lights.ambient));
    ambient.intensity = palette.lights.ambientI;
    keyLight.color.copy(hexToThreeColor(palette.lights.key));
    keyLight.intensity = palette.lights.keyI;
    rimLight.color.copy(hexToThreeColor(palette.lights.rim));
    rimLight.intensity = palette.lights.rimI;
    baseRimIntensity = palette.lights.rimI;
    fillLight.color.copy(hexToThreeColor(palette.lights.fill));
    fillLight.intensity = palette.lights.fillI;

    baseEdgeOpacity = 0.88;
    sparkles.forEach((s) => s.mesh.material.color.copy(hexToThreeColor(palette.glow)));
  }

  applyTheme();

  const themeObserver = new MutationObserver(() => applyTheme());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  function onStorageTheme(e) {
    if (e.key === 'theme' || e.key === 'colorScheme' || e.key === 'plainMode') applyTheme();
  }
  window.addEventListener('storage', onStorageTheme);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerInside = false;
  let hoverAmount = 0;
  let hoverSnap = 0;
  let nearestFaceIndex = -1;
  let mouseNdc = { x: 0, y: 0 };
  let hoverTilt = { x: 0, y: 0 };
  let pulsePhase = 0;

  function setPointerFromEvent(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    pointer.x = mouseNdc.x;
    pointer.y = mouseNdc.y;
  }

  function pickNearestFace() {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(cube, false);
    if (hits.length > 0 && hits[0].face) {
      return hits[0].face.materialIndex;
    }
    return -1;
  }

  if (hoverEnabled) {
    renderer.domElement.addEventListener('pointerenter', () => {
      pointerInside = true;
      hoverSnap = 1;
    });
    renderer.domElement.addEventListener('pointerleave', () => {
      pointerInside = false;
      nearestFaceIndex = -1;
    });
    renderer.domElement.addEventListener('pointermove', (e) => {
      setPointerFromEvent(e);
      nearestFaceIndex = pickNearestFace();
    });
  }

  let rafId = 0;
  let running = true;
  let scrollProgress = 0;
  let entryProgress = 0;
  let lastScrollY = window.scrollY;
  let scrollVelocity = 0;
  let idleTime = 0;

  function resize() {
    if (window.innerWidth < DESKTOP_MIN) {
      host.remove();
      dispose();
      return;
    }
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function readScroll() {
    const hero = document.querySelector('.hero--fullscreen');
    const heroH = hero ? hero.offsetHeight : window.innerHeight;
    const scrollY = window.scrollY;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

    scrollVelocity = THREE.MathUtils.lerp(scrollVelocity, scrollY - lastScrollY, 0.18);
    lastScrollY = scrollY;

    entryProgress = easeOutCubic(
      THREE.MathUtils.clamp((scrollY - heroH * 0.15) / (heroH * 0.85), 0, 1)
    );
    scrollProgress = THREE.MathUtils.clamp(scrollY / maxScroll, 0, 1);
  }

  function updateHover(dt) {
    if (!hoverEnabled) return;

    const target = pointerInside ? 1 : 0;
    hoverAmount = THREE.MathUtils.lerp(hoverAmount, target, 0.09);
    hoverSnap = THREE.MathUtils.lerp(hoverSnap, 0, 0.06);
    pulsePhase += dt * 0.004;

    const tiltTargetX = mouseNdc.y * 0.22 * hoverAmount;
    const tiltTargetY = mouseNdc.x * 0.28 * hoverAmount;
    hoverTilt.x = THREE.MathUtils.lerp(hoverTilt.x, tiltTargetX, 0.12);
    hoverTilt.y = THREE.MathUtils.lerp(hoverTilt.y, tiltTargetY, 0.12);

    rimLight.intensity = baseRimIntensity + hoverAmount * 0.55 + hoverSnap * 0.25;
    edgeLines.material.opacity = baseEdgeOpacity + hoverAmount * 0.12;
    glowLines.material.opacity = baseGlowOpacity + hoverAmount * 0.35;

    const pulse = 0.5 + Math.sin(pulsePhase) * 0.5;
    materials.forEach((mat, i) => {
      const isNearest = i === nearestFaceIndex;
      mat.emissiveIntensity = isNearest ? (0.08 + pulse * 0.14) * hoverAmount : 0;
      mat.envMapIntensity = 0.28 + hoverAmount * 0.12 + (isNearest ? pulse * 0.08 * hoverAmount : 0);
    });

    sparkleGroup.visible = hoverAmount > 0.02;
    sparkles.forEach((s, i) => {
      const t = idleTime * 0.001 * s.speed + s.phase;
      const r = 0.62 + Math.sin(t) * 0.08;
      const a = t + (i / sparkleCount) * Math.PI * 2;
      s.mesh.position.set(Math.cos(a) * r, Math.sin(t * 1.3) * 0.35, Math.sin(a) * r);
      s.mesh.material.opacity = hoverAmount * (0.15 + Math.sin(t * 2.2) * 0.12);
      s.mesh.lookAt(camera.position);
    });
  }

  function updateCube(dt) {
    readScroll();
    idleTime += dt;
    updateHover(dt);

    const slideX = THREE.MathUtils.lerp(2.4, 0.42, entryProgress);
    const slideY = THREE.MathUtils.lerp(-0.35, -0.06, entryProgress);
    const idleFloat = Math.sin(idleTime * 0.0012) * 0.04;
    cubeGroup.position.set(slideX, slideY + idleFloat, 0);

    const scrollSpin = scrollProgress * Math.PI * 3.2;
    const velocityTilt = THREE.MathUtils.clamp(scrollVelocity * 0.004, -0.35, 0.35);
    const idleRotate = idleTime * 0.00035;
    const snapYaw = hoverSnap * 0.18;

    cube.rotation.y = scrollSpin + entryProgress * 0.5 + idleRotate + hoverTilt.y + snapYaw;
    cube.rotation.x =
      0.48 + Math.sin(scrollProgress * Math.PI * 1.4) * 0.16 + velocityTilt + hoverTilt.x;
    cube.rotation.z =
      Math.sin(scrollProgress * Math.PI * 0.6) * 0.06 +
      Math.sin(idleTime * 0.0009) * 0.03 +
      hoverTilt.y * 0.15;

    const baseScale = THREE.MathUtils.lerp(0.55, 0.72, entryProgress);
    const hoverScale = 1 + hoverAmount * 0.07;
    cubeGroup.scale.setScalar(baseScale * hoverScale);

    host.style.opacity = String(entryProgress);
  }

  let lastFrame = performance.now();

  function render(now) {
    if (!running) return;
    const dt = Math.min(48, now - lastFrame);
    lastFrame = now;
    updateCube(dt);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(render);
  }

  function onVisibility() {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(rafId);
    } else {
      running = true;
      rafId = requestAnimationFrame(render);
    }
  }

  function dispose() {
    running = false;
    cancelAnimationFrame(rafId);
    themeObserver.disconnect();
    window.removeEventListener('storage', onStorageTheme);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', readScroll, { passive: true });
    envMap.dispose();
    geometry.dispose();
    edges.dispose();
    glowEdges.dispose();
    materials.forEach((m) => {
      if (m.map) m.map.dispose();
      m.dispose();
    });
    edgeLines.geometry.dispose();
    edgeLines.material.dispose();
    glowLines.geometry.dispose();
    glowLines.material.dispose();
    sparkles.forEach((s) => {
      s.mesh.geometry.dispose();
      s.mesh.material.dispose();
    });
    renderer.dispose();
  }

  resize();
  readScroll();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', readScroll, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  rafId = requestAnimationFrame(render);
}
