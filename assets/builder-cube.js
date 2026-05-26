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
import { createCubeFallController } from './cube-fall.js';

const FACE_LABELS = ['HARDWARE', 'SOFTWARE', 'ENGINEER', 'VR', 'AI / ML', 'RESEARCHER'];

const RAINBOW_ACCENTS = ['#ff006e', '#8338ec', '#3a86ff', '#06ffa5', '#ffbe0b', '#fb5607'];

const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];

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

function isDarkSteelTheme(themeKey) {
  return themeKey === 'dark' || themeKey === 'rabiat' || themeKey === 'rainbow';
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
  const darkSteel = isDarkSteelTheme(themeKey);

  const steelBase = darkSteel ? '#2a2a32' : '#b8b8be';
  const steelMid = darkSteel ? '#1c1c24' : '#d4d4da';
  const steelDeep = darkSteel ? '#121218' : '#9898a0';
  const labelInk = darkSteel ? '#e8e8ec' : '#2a2a30';
  const labelShadow = darkSteel ? '#08080c' : '#6a6a72';

  switch (themeKey) {
    case 'rabiat':
      return {
        faces: alignPaletteFaces([
          { steel: steelBase, accent: '#b81e2c' },
          { steel: steelMid, accent: '#4a8f8f' },
          { steel: steelMid, accent: '#ececee' },
          { steel: steelDeep, accent: '#b81e2c' },
          { steel: steelDeep, accent: '#4a8f8f' },
          { steel: steelDeep, accent: '#ececee' },
        ]),
        text: labelInk,
        labelShadow,
        edge: '#b81e2c',
        glow: '#b81e2c',
        steelTint: 0xc0c0c8,
        envIntensity: 0.62,
        metalness: 0.93,
        roughness: 0.2,
        lights: { ambient: 0xffffff, ambientI: 0.42, key: 0xffffff, keyI: 0.95, rim: 0xb81e2c, rimI: 0.45, fill: 0x4a8f8f, fillI: 0.28 },
      };
    case 'plain':
      return {
        faces: alignPaletteFaces([
          { steel: '#c8c8cc', accent: '#000000' },
          { steel: '#b0b0b6', accent: '#333333' },
          { steel: '#d0d0d6', accent: '#000000' },
          { steel: '#a8a8ae', accent: '#000000' },
          { steel: '#bcbcc2', accent: '#333333' },
          { steel: '#c4c4ca', accent: '#000000' },
        ]),
        text: '#1a1a1e',
        labelShadow: '#707078',
        edge: '#000000',
        glow: '#333333',
        steelTint: 0xe8e8ec,
        envIntensity: 0.88,
        metalness: 0.94,
        roughness: 0.18,
        lights: { ambient: 0xffffff, ambientI: 0.7, key: 0xffffff, keyI: 1.05, rim: 0x333333, rimI: 0.18, fill: 0xffffff, fillI: 0.22 },
      };
    case 'rainbow':
      return {
        faces: alignPaletteFaces(
          RAINBOW_ACCENTS.map((c, i) => ({
            steel: i % 2 === 0 ? steelBase : steelMid,
            accent: c,
          }))
        ),
        text: labelInk,
        labelShadow,
        edge: '#ff006e',
        glow: '#8338ec',
        steelTint: 0x909098,
        envIntensity: 0.58,
        metalness: 0.92,
        roughness: 0.22,
        lights: { ambient: 0xffffff, ambientI: 0.38, key: 0xffffff, keyI: 0.9, rim: 0x8338ec, rimI: 0.42, fill: 0x06ffa5, fillI: 0.25 },
      };
    case 'dark':
      return {
        faces: alignPaletteFaces([
          { steel: steelBase, accent: primary },
          { steel: steelMid, accent: accent },
          { steel: steelMid, accent: primary },
          { steel: steelDeep, accent: accent },
          { steel: steelDeep, accent: primary },
          { steel: steelDeep, accent: accent },
        ]),
        text: labelInk,
        labelShadow,
        edge: accent,
        glow: primary,
        steelTint: 0x888890,
        envIntensity: 0.55,
        metalness: 0.93,
        roughness: 0.21,
        lights: { ambient: 0xffffff, ambientI: 0.35, key: 0xf3f2f4, keyI: 0.82, rim: primary, rimI: 0.38, fill: accent, fillI: 0.22 },
      };
    default:
      return {
        faces: alignPaletteFaces([
          { steel: '#b4b4ba', accent: primary },
          { steel: '#c8c8ce', accent: accent },
          { steel: '#d8d8de', accent: primary },
          { steel: '#a8a8ae', accent: accent },
          { steel: '#bcbcc2', accent: primary },
          { steel: '#c0c0c6', accent: accent },
        ]),
        text: labelInk,
        labelShadow,
        edge: accent,
        glow: primary,
        steelTint: 0xe0e0e6,
        envIntensity: 0.85,
        metalness: 0.94,
        roughness: 0.19,
        lights: { ambient: 0xffffff, ambientI: 0.62, key: 0xffffff, keyI: 1.08, rim: primary, rimI: 0.32, fill: accent, fillI: 0.2 },
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

function makeEnvMap(themeKey) {
  const dark = isDarkSteelTheme(themeKey);
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  if (dark) {
    grad.addColorStop(0, '#4a4a54');
    grad.addColorStop(0.35, '#2a2a32');
    grad.addColorStop(0.7, '#1a1a22');
    grad.addColorStop(1, '#0c0c12');
  } else {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#eef0f8');
    grad.addColorStop(0.65, '#c8ccd8');
    grad.addColorStop(1, '#8890a0');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const band = ctx.createLinearGradient(0, 0, size, 0);
  band.addColorStop(0, 'rgba(255,255,255,0)');
  band.addColorStop(0.45, dark ? 'rgba(180,180,200,0.12)' : 'rgba(255,255,255,0.35)');
  band.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeFaceTexture(label, steel, accent, textColor, labelShadow) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const cx = size / 2;
  const cy = size / 2;

  const steelGrad = ctx.createLinearGradient(0, 0, size, size);
  steelGrad.addColorStop(0, mixHex(steel, '#ffffff', 0.18));
  steelGrad.addColorStop(0.45, steel);
  steelGrad.addColorStop(1, mixHex(steel, '#000000', 0.28));
  ctx.fillStyle = steelGrad;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < size; i += 4) {
    ctx.fillStyle = i % 8 === 0 ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, i, size, 1);
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, size - 36, size - 36);
  ctx.restore();

  ctx.strokeStyle = mixHex(accent, '#ffffff', 0.25);
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, size - 48, size - 48);

  const fontSize = label.length > 9 ? 38 : label.length > 7 ? 44 : 52;
  ctx.font = `700 ${fontSize}px Rajdhani, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = labelShadow;
  ctx.fillText(label, cx + 1, cy + 2);

  ctx.fillStyle = mixHex(textColor, '#000000', 0.2);
  ctx.fillText(label, cx, cy + 1);

  ctx.fillStyle = textColor;
  ctx.shadowColor = mixHex(accent, '#ffffff', 0.3);
  ctx.shadowBlur = 8;
  ctx.fillText(label, cx, cy);
  ctx.shadowBlur = 0;

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const sheen = ctx.createLinearGradient(0, 0, size * 0.6, size);
  sheen.addColorStop(0, 'rgba(255,255,255,0.28)');
  sheen.addColorStop(0.35, 'rgba(255,255,255,0.04)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.15)');
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

  let envMap = makeEnvMap(getThemeKey());

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
        metalness: 0.93,
        roughness: 0.2,
        envMap,
        envMapIntensity: 0.75,
      })
  );

  const cube = new THREE.Mesh(geometry, materials);
  cubeGroup.add(cube);

  const edges = new THREE.EdgesGeometry(geometry);
  const edgeLines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0xb81e2c, transparent: true, opacity: 0.72 })
  );
  cube.add(edgeLines);

  const glowEdges = new THREE.EdgesGeometry(geometry);
  const glowLines = new THREE.LineSegments(
    glowEdges,
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
  );
  glowLines.scale.setScalar(1.012);
  cube.add(glowLines);

  const glintMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.018),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  cube.add(glintMesh);

  let baseRimIntensity = 0.65;
  let baseEdgeOpacity = 0.72;
  let baseGlowOpacity = 0;
  let baseEnvIntensity = 0.75;
  let baseMetalness = 0.93;
  let baseRoughness = 0.2;
  let currentThemeSignature = '';
  let fallActive = false;
  let landedScale = 0.72;

  function applyTheme() {
    const signature = getThemeSignature();
    if (signature === currentThemeSignature) return;
    currentThemeSignature = signature;

    const themeKey = getThemeKey();
    if (envMap) envMap.dispose();
    envMap = makeEnvMap(themeKey);

    const palette = buildThemePalette(themeKey);
    baseEnvIntensity = palette.envIntensity;
    baseMetalness = palette.metalness;
    baseRoughness = palette.roughness;

    FACE_LABELS.forEach((label, i) => {
      const face = palette.faces[i];
      if (materials[i].map) materials[i].map.dispose();
      materials[i].map = makeFaceTexture(label, face.steel, face.accent, palette.text, palette.labelShadow);
      materials[i].envMap = envMap;
      materials[i].metalness = palette.metalness;
      materials[i].roughness = palette.roughness;
      materials[i].envMapIntensity = palette.envIntensity;
      materials[i].color.setHex(palette.steelTint);
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

    baseEdgeOpacity = 0.72;
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
  let glintPhase = 0;

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

  const fallController = createCubeFallController({
    host,
    cube,
    cubeGroup,
    materials,
    edgeLines,
    glowLines,
    renderer,
    prefersReducedMotion,
    onFallStart() {
      fallActive = true;
      pointerInside = false;
      hoverAmount = 0;
      renderer.domElement.style.cursor = 'default';
    },
    onFallComplete() {
      fallActive = true;
      landedScale = cubeGroup.scale.x;
      renderer.domElement.style.cursor = 'not-allowed';
    },
  });

  function onCubeClick(e) {
    if (window.innerWidth < DESKTOP_MIN) return;
    if (fallController.isLanded || fallController.isFalling) {
      fallController.handleClick();
      return;
    }
    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(cube, false);
    if (hits.length === 0) return;
    fallController.handleClick();
  }

  renderer.domElement.style.cursor = 'pointer';
  renderer.domElement.addEventListener('click', onCubeClick);

  if (hoverEnabled) {
    renderer.domElement.addEventListener('pointerenter', () => {
      if (fallController.isLanded || fallController.isFalling) return;
      pointerInside = true;
      hoverSnap = 1;
    });
    renderer.domElement.addEventListener('pointerleave', () => {
      pointerInside = false;
      nearestFaceIndex = -1;
    });
    renderer.domElement.addEventListener('pointermove', (e) => {
      if (fallController.isLanded || fallController.isFalling) return;
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

  function updateGlint(dt) {
    if (nearestFaceIndex < 0 || hoverAmount < 0.05 || fallActive) {
      glintMesh.material.opacity = THREE.MathUtils.lerp(glintMesh.material.opacity, 0, 0.15);
      return;
    }

    glintPhase += dt * 0.0022;
    const sweep = Math.sin(glintPhase) * 0.32;
    const normal = FACE_NORMALS[nearestFaceIndex];
    glintMesh.position.set(normal.x * 0.462, normal.y * 0.462 + sweep * 0.08, normal.z * 0.462);
    glintMesh.lookAt(
      glintMesh.position.x + normal.x,
      glintMesh.position.y + normal.y,
      glintMesh.position.z + normal.z
    );
    glintMesh.material.opacity = hoverAmount * (0.22 + Math.sin(glintPhase * 1.6) * 0.1);
  }

  function updateHover(dt) {
    if (!hoverEnabled || fallActive) {
      glintMesh.material.opacity = 0;
      return;
    }

    const target = pointerInside ? 1 : 0;
    hoverAmount = THREE.MathUtils.lerp(hoverAmount, target, 0.09);
    hoverSnap = THREE.MathUtils.lerp(hoverSnap, 0, 0.06);
    pulsePhase += dt * 0.004;

    const tiltTargetX = mouseNdc.y * 0.22 * hoverAmount;
    const tiltTargetY = mouseNdc.x * 0.28 * hoverAmount;
    hoverTilt.x = THREE.MathUtils.lerp(hoverTilt.x, tiltTargetX, 0.12);
    hoverTilt.y = THREE.MathUtils.lerp(hoverTilt.y, tiltTargetY, 0.12);

    rimLight.intensity = baseRimIntensity + hoverAmount * 0.28 + hoverSnap * 0.12;
    edgeLines.material.opacity = baseEdgeOpacity + hoverAmount * 0.08;
    glowLines.material.opacity = baseGlowOpacity + hoverAmount * 0.22;

    const pulse = 0.5 + Math.sin(pulsePhase) * 0.5;
    materials.forEach((mat, i) => {
      const isNearest = i === nearestFaceIndex;
      mat.emissiveIntensity = isNearest ? (0.04 + pulse * 0.06) * hoverAmount : 0;
      mat.envMapIntensity =
        baseEnvIntensity + hoverAmount * 0.1 + (isNearest ? pulse * 0.06 * hoverAmount : 0);
      if (!fallController.isFalling) {
        mat.metalness = baseMetalness;
        mat.roughness = baseRoughness;
      }
    });

    updateGlint(dt);
  }

  function updateCube(dt) {
    readScroll();
    idleTime += dt;
    updateHover(dt);

    if (fallController.isFalling) {
      return;
    }

    if (fallController.isLanded) {
      cubeGroup.scale.setScalar(landedScale);
      host.style.opacity = '1';
      return;
    }

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
    fallController.dispose();
    themeObserver.disconnect();
    window.removeEventListener('storage', onStorageTheme);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', readScroll, { passive: true });
    renderer.domElement.removeEventListener('click', onCubeClick);
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
    glintMesh.geometry.dispose();
    glintMesh.material.dispose();
    renderer.dispose();
  }

  resize();
  readScroll();
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', readScroll, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  rafId = requestAnimationFrame(render);
}
