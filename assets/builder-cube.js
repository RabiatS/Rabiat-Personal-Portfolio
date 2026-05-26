/**
 * Builder cube — desktop-only scroll companion for index.html
 * Unlock: index.html?cube=1  or  localStorage.setItem('builderCubeMode','true')
 * Disable: index.html?cube=0  or  localStorage.removeItem('builderCubeMode')
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

const FACE_LABELS = ['ENGINEER', 'SOFTWARE', 'HARDWARE', 'VR', 'AI / ML', 'RESEARCHER'];

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
        faces: [
          { bg: '#16161f', accent: '#b81e2c' },
          { bg: '#12121c', accent: '#4a8f8f' },
          { bg: '#2a2a36', accent: '#ececee' },
          { bg: '#1a1f2e', accent: '#b81e2c' },
          { bg: '#0f2a2a', accent: '#4a8f8f' },
          { bg: '#0a0a0f', accent: '#ececee' },
        ],
        text: '#ececee',
        edge: '#b81e2c',
        lights: { ambient: 0xffffff, ambientI: 0.5, key: 0xffffff, keyI: 1.0, rim: 0xb81e2c, rimI: 0.6, fill: 0x4a8f8f, fillI: 0.35 },
      };
    case 'plain':
      return {
        faces: [
          { bg: '#ffffff', accent: '#000000' },
          { bg: '#f7f7f7', accent: '#333333' },
          { bg: '#ffffff', accent: '#000000' },
          { bg: '#f0f0f0', accent: '#000000' },
          { bg: '#fafafa', accent: '#333333' },
          { bg: '#ffffff', accent: '#000000' },
        ],
        text: '#000000',
        edge: '#000000',
        lights: { ambient: 0xffffff, ambientI: 0.75, key: 0xffffff, keyI: 0.95, rim: 0x333333, rimI: 0.25, fill: 0xffffff, fillI: 0.2 },
      };
    case 'rainbow':
      return {
        faces: RAINBOW_ACCENTS.map((c, i) => ({
          bg: i % 2 === 0 ? '#14141f' : '#1a1a28',
          accent: c,
        })),
        text: '#ffffff',
        edge: '#ff006e',
        lights: { ambient: 0xffffff, ambientI: 0.45, key: 0xffffff, keyI: 1.0, rim: 0x8338ec, rimI: 0.7, fill: 0x06ffa5, fillI: 0.4 },
      };
    case 'dark':
      return {
        faces: [
          { bg: '#1c1b1e', accent: primary },
          { bg: '#232225', accent: accent },
          { bg: '#2a292d', accent: primary },
          { bg: '#18171a', accent: accent },
          { bg: '#151416', accent: primary },
          { bg: '#111011', accent: accent },
        ],
        text: cssVar('--text', '#f3f2f4'),
        edge: accent,
        lights: { ambient: 0xffffff, ambientI: 0.4, key: 0xf3f2f4, keyI: 0.85, rim: primary, rimI: 0.55, fill: accent, fillI: 0.3 },
      };
    default:
      return {
        faces: [
          { bg: flowMid, accent: primary },
          { bg: elevated, accent: accent },
          { bg: surface, accent: primary },
          { bg: bg, accent: accent },
          { bg: flowMid, accent: primary },
          { bg: elevated, accent: accent },
        ],
        text,
        edge: accent,
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

function makeFaceTexture(label, bg, accent, textColor) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, size - 16, size - 16);

  ctx.fillStyle = textColor;
  ctx.font = '600 52px Rajdhani, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (label.includes('/')) {
    const parts = label.split('/').map((p) => p.trim());
    ctx.font = '600 44px Rajdhani, system-ui, sans-serif';
    ctx.fillText(parts[0], size / 2, size / 2 - 28);
    ctx.fillText('/ ' + parts[1], size / 2, size / 2 + 28);
  } else {
    ctx.fillText(label, size / 2, size / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
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

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, -0.38, 3.85);
  camera.lookAt(0, 0.1, 0);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

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
  const materials = FACE_LABELS.map(() =>
    new THREE.MeshStandardMaterial({ metalness: 0.35, roughness: 0.45 })
  );

  const cube = new THREE.Mesh(geometry, materials);
  cubeGroup.add(cube);

  const edges = new THREE.EdgesGeometry(geometry);
  const edgeLines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0xb81e2c, transparent: true, opacity: 0.85 })
  );
  cube.add(edgeLines);

  let currentThemeSignature = '';

  function applyTheme() {
    const signature = getThemeSignature();
    if (signature === currentThemeSignature) return;
    currentThemeSignature = signature;

    const themeKey = getThemeKey();
    const palette = buildThemePalette(themeKey);

    FACE_LABELS.forEach((label, i) => {
      const face = palette.faces[i];
      if (materials[i].map) materials[i].map.dispose();
      materials[i].map = makeFaceTexture(label, face.bg, face.accent, palette.text);
      materials[i].needsUpdate = true;
    });

    edgeLines.material.color.copy(hexToThreeColor(palette.edge));

    ambient.color.copy(hexToThreeColor(palette.lights.ambient));
    ambient.intensity = palette.lights.ambientI;
    keyLight.color.copy(hexToThreeColor(palette.lights.key));
    keyLight.intensity = palette.lights.keyI;
    rimLight.color.copy(hexToThreeColor(palette.lights.rim));
    rimLight.intensity = palette.lights.rimI;
    fillLight.color.copy(hexToThreeColor(palette.lights.fill));
    fillLight.intensity = palette.lights.fillI;
  }

  applyTheme();

  const themeObserver = new MutationObserver(() => applyTheme());
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  function onStorageTheme(e) {
    if (e.key === 'theme' || e.key === 'colorScheme' || e.key === 'plainMode') applyTheme();
  }
  window.addEventListener('storage', onStorageTheme);

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

  function updateCube(dt) {
    readScroll();
    idleTime += dt;

    const slideX = THREE.MathUtils.lerp(2.4, 0.42, entryProgress);
    const slideY = THREE.MathUtils.lerp(-0.35, -0.06, entryProgress);
    const idleFloat = Math.sin(idleTime * 0.0012) * 0.04;
    cubeGroup.position.set(slideX, slideY + idleFloat, 0);

    const scrollSpin = scrollProgress * Math.PI * 3.2;
    const velocityTilt = THREE.MathUtils.clamp(scrollVelocity * 0.004, -0.35, 0.35);
    const idleRotate = idleTime * 0.00035;

    cube.rotation.y = scrollSpin + entryProgress * 0.5 + idleRotate;
    cube.rotation.x = 0.48 + Math.sin(scrollProgress * Math.PI * 1.4) * 0.16 + velocityTilt;
    cube.rotation.z = Math.sin(scrollProgress * Math.PI * 0.6) * 0.06 + Math.sin(idleTime * 0.0009) * 0.03;

    const scale = THREE.MathUtils.lerp(0.55, 0.72, entryProgress);
    cubeGroup.scale.setScalar(scale);

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
    geometry.dispose();
    edges.dispose();
    materials.forEach((m) => {
      if (m.map) m.map.dispose();
      m.dispose();
    });
    edgeLines.geometry.dispose();
    edgeLines.material.dispose();
    renderer.dispose();
  }

  resize();
  readScroll();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', readScroll, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  rafId = requestAnimationFrame(render);
}
