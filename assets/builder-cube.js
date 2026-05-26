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

const FACES = [
  { label: 'ENGINEER', bg: '#16161f', accent: '#b81e2c' },
  { label: 'SOFTWARE', bg: '#12121c', accent: '#4a8f8f' },
  { label: 'HARDWARE', bg: '#2a2a36', accent: '#ececee' },
  { label: 'VR', bg: '#1a1f2e', accent: '#b81e2c' },
  { label: 'AI / ML', bg: '#0f2a2a', accent: '#4a8f8f' },
  { label: 'RESEARCHER', bg: '#0a0a0f', accent: '#ececee' },
];

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function makeFaceTexture(label, bg, accent) {
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

  ctx.fillStyle = '#ececee';
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
  const host = document.createElement('div');
  host.id = 'builderCubeHost';
  host.className = 'builder-cube-host';
  host.setAttribute('aria-hidden', 'true');
  document.body.appendChild(host);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0.15, 4.2);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
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
  scene.add(cubeGroup);

  const geometry = new THREE.BoxGeometry(0.92, 0.92, 0.92);
  const materials = FACES.map((face) => {
    const map = makeFaceTexture(face.label, face.bg, face.accent);
    return new THREE.MeshStandardMaterial({
      map,
      metalness: 0.35,
      roughness: 0.45,
    });
  });

  const cube = new THREE.Mesh(geometry, materials);
  cubeGroup.add(cube);

  const edges = new THREE.EdgesGeometry(geometry);
  const edgeLines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0xb81e2c, transparent: true, opacity: 0.85 })
  );
  cube.add(edgeLines);

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
    const slideY = THREE.MathUtils.lerp(-0.35, 0.02, entryProgress);
    const idleFloat = Math.sin(idleTime * 0.0012) * 0.04;
    cubeGroup.position.set(slideX, slideY + idleFloat, 0);

    const scrollSpin = scrollProgress * Math.PI * 3.2;
    const velocityTilt = THREE.MathUtils.clamp(scrollVelocity * 0.004, -0.35, 0.35);
    const idleRotate = idleTime * 0.00035;

    cube.rotation.y = scrollSpin + entryProgress * 0.5 + idleRotate;
    cube.rotation.x = 0.22 + Math.sin(scrollProgress * Math.PI * 1.4) * 0.18 + velocityTilt;
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
