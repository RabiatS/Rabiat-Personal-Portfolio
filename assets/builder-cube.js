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
const LABEL_FONT_STACK = "'Share Tech Mono', monospace";
let labelFontReady = null;

function ensureLabelFontReady() {
  if (!labelFontReady) {
    labelFontReady =
      document.fonts?.load?.(`16px ${LABEL_FONT_STACK}`)?.catch(() => undefined) ??
      Promise.resolve();
  }
  return labelFontReady;
}

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
  const isDark =
    html.classList.contains('dark') ||
    document.body.classList.contains('dark') ||
    html.style.colorScheme === 'dark';
  return isDark ? 'dark' : 'light';
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

  const steelBase = darkSteel ? '#2a2a32' : '#e8e8ee';
  const steelMid = darkSteel ? '#1c1c24' : '#f2f2f6';
  const steelDeep = darkSteel ? '#121218' : '#d8d8de';
  const labelInk = darkSteel ? '#ffffff' : '#121218';
  const labelShadow = darkSteel ? '#000000' : '#484850';

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
        envIntensity: 0.52,
        metalness: 0.93,
        roughness: 0.19,
        lights: { ambient: 0xffffff, ambientI: 0.42, key: 0xffffff, keyI: 0.95, rim: 0xb81e2c, rimI: 0.45, fill: 0x4a8f8f, fillI: 0.28 },
      };
    case 'plain':
      return {
        faces: alignPaletteFaces([
          { steel: '#e4e4e8', accent: '#000000' },
          { steel: '#d8d8dc', accent: '#333333' },
          { steel: '#ececee', accent: '#000000' },
          { steel: '#d0d0d4', accent: '#000000' },
          { steel: '#dedee2', accent: '#333333' },
          { steel: '#e8e8ec', accent: '#000000' },
        ]),
        text: '#141418',
        labelShadow: '#606068',
        edge: '#000000',
        glow: '#333333',
        steelTint: 0xffffff,
        envIntensity: 1.12,
        metalness: 0.96,
        roughness: 0.09,
        lights: { ambient: 0xffffff, ambientI: 0.82, key: 0xffffff, keyI: 0.85, rim: 0x333333, rimI: 0.12, fill: 0xffffff, fillI: 0.28 },
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
        envIntensity: 0.5,
        metalness: 0.92,
        roughness: 0.2,
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
        envIntensity: 0.48,
        metalness: 0.93,
        roughness: 0.19,
        lights: { ambient: 0xffffff, ambientI: 0.35, key: 0xf3f2f4, keyI: 0.82, rim: primary, rimI: 0.38, fill: accent, fillI: 0.22 },
      };
    default:
      return {
        faces: alignPaletteFaces([
          { steel: '#e0e0e6', accent: primary },
          { steel: '#eaeaf0', accent: accent },
          { steel: '#f0f0f4', accent: primary },
          { steel: '#d4d4da', accent: accent },
          { steel: '#e4e4ea', accent: primary },
          { steel: '#ececf0', accent: accent },
        ]),
        text: labelInk,
        labelShadow,
        edge: accent,
        glow: primary,
        steelTint: 0xffffff,
        envIntensity: 1.18,
        metalness: 0.96,
        roughness: 0.08,
        lights: { ambient: 0xffffff, ambientI: 0.85, key: 0xffffff, keyI: 0.78, rim: primary, rimI: 0.16, fill: accent, fillI: 0.22 },
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

function paintEnvMapCanvas(ctx, size, dark, shineAngle, shineStrength) {
  ctx.clearRect(0, 0, size, size);

  const grad = ctx.createLinearGradient(0, 0, 0, size);
  if (dark) {
    grad.addColorStop(0, '#585862');
    grad.addColorStop(0.28, '#3a3a44');
    grad.addColorStop(0.55, '#24242c');
    grad.addColorStop(0.82, '#16161e');
    grad.addColorStop(1, '#0a0a10');
  } else {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.18, '#fafbfe');
    grad.addColorStop(0.42, '#eef0f6');
    grad.addColorStop(0.68, '#d8dce8');
    grad.addColorStop(0.88, '#c4c8d4');
    grad.addColorStop(1, '#aeb4c2');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const studioBand = ctx.createLinearGradient(0, 0, size, size * 0.35);
  studioBand.addColorStop(0, 'rgba(255,255,255,0)');
  studioBand.addColorStop(0.38, dark ? 'rgba(210,210,225,0.18)' : 'rgba(255,255,255,0.72)');
  studioBand.addColorStop(0.62, dark ? 'rgba(180,180,200,0.08)' : 'rgba(255,255,255,0.28)');
  studioBand.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = studioBand;
  ctx.fillRect(0, 0, size, size);

  const rimBand = ctx.createLinearGradient(size, 0, 0, size);
  rimBand.addColorStop(0, 'rgba(255,255,255,0)');
  rimBand.addColorStop(0.5, dark ? 'rgba(140,140,160,0.1)' : 'rgba(255,255,255,0.38)');
  rimBand.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rimBand;
  ctx.fillRect(0, 0, size, size);

  if (shineStrength > 0.008) {
    const cx = size * 0.5;
    const cy = size * 0.5;
    const streakPeak = dark ? 0.42 * shineStrength : 0.98 * shineStrength;
    const streakWidth = dark ? 0.09 : 0.065;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(shineAngle);
    const streak = ctx.createLinearGradient(-size, 0, size, 0);
    streak.addColorStop(0, 'rgba(255,255,255,0)');
    streak.addColorStop(0.5 - streakWidth, 'rgba(255,255,255,0)');
    streak.addColorStop(0.5 - streakWidth * 0.35, `rgba(255,255,255,${streakPeak * 0.55})`);
    streak.addColorStop(0.5, `rgba(255,255,255,${streakPeak})`);
    streak.addColorStop(0.5 + streakWidth * 0.35, `rgba(255,255,255,${streakPeak * 0.55})`);
    streak.addColorStop(0.5 + streakWidth, 'rgba(255,255,255,0)');
    streak.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = streak;
    ctx.fillRect(-size, -size * 0.5, size * 2, size);
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(shineAngle + Math.PI * 0.5);
    const crossPeak = streakPeak * (dark ? 0.28 : 0.22);
    const cross = ctx.createLinearGradient(-size * 0.5, 0, size * 0.5, 0);
    cross.addColorStop(0, 'rgba(255,255,255,0)');
    cross.addColorStop(0.46, 'rgba(255,255,255,0)');
    cross.addColorStop(0.5, `rgba(255,255,255,${crossPeak})`);
    cross.addColorStop(0.54, 'rgba(255,255,255,0)');
    cross.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cross;
    ctx.fillRect(-size * 0.5, -size * 0.22, size, size * 0.44);
    ctx.restore();

    const hotspotX = cx + Math.cos(shineAngle) * size * 0.22;
    const hotspotY = cy + Math.sin(shineAngle) * size * 0.22;
    const hotspot = ctx.createRadialGradient(hotspotX, hotspotY, 0, hotspotX, hotspotY, size * 0.34);
    const hotPeak = dark ? 0.24 * shineStrength : 0.52 * shineStrength;
    hotspot.addColorStop(0, `rgba(255,255,255,${hotPeak})`);
    hotspot.addColorStop(0.45, `rgba(255,255,255,${hotPeak * 0.35})`);
    hotspot.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hotspot;
    ctx.fillRect(0, 0, size, size);
  }
}

function createEnvMap(themeKey) {
  const dark = isDarkSteelTheme(themeKey);
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  paintEnvMapCanvas(ctx, size, dark, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  return {
    texture: tex,
    themeKey,
    update(shineAngle, shineStrength) {
      paintEnvMapCanvas(ctx, size, dark, shineAngle, shineStrength);
      tex.needsUpdate = true;
    },
    dispose() {
      tex.dispose();
    },
  };
}

function drawLabelPlate(ctx, cx, cy, w, h, darkSteel) {
  const r = 12;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 + r, cy - h / 2);
  ctx.lineTo(cx + w / 2 - r, cy - h / 2);
  ctx.quadraticCurveTo(cx + w / 2, cy - h / 2, cx + w / 2, cy - h / 2 + r);
  ctx.lineTo(cx + w / 2, cy + h / 2 - r);
  ctx.quadraticCurveTo(cx + w / 2, cy + h / 2, cx + w / 2 - r, cy + h / 2);
  ctx.lineTo(cx - w / 2 + r, cy + h / 2);
  ctx.quadraticCurveTo(cx - w / 2, cy + h / 2, cx - w / 2, cy + h / 2 - r);
  ctx.lineTo(cx - w / 2, cy - h / 2 + r);
  ctx.quadraticCurveTo(cx - w / 2, cy - h / 2, cx - w / 2 + r, cy - h / 2);
  ctx.closePath();
  ctx.fillStyle = darkSteel ? 'rgba(8, 8, 12, 0.92)' : 'rgba(255, 255, 255, 0.94)';
  ctx.fill();
  ctx.strokeStyle = darkSteel ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawEngravedLabel(ctx, label, cx, cy, fontSize, textColor, labelShadow, darkSteel) {
  ctx.font = `400 ${fontSize}px ${LABEL_FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  if (darkSteel) {
    const plateW = Math.min(440, label.length * (fontSize * 0.58) + 52);
    const plateH = fontSize * 1.65;
    drawLabelPlate(ctx, cx, cy, plateW, plateH, darkSteel);

    ctx.fillStyle = labelShadow;
    ctx.fillText(label, cx + 2, cy + 3);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth = 2;
    ctx.strokeText(label, cx, cy);

    ctx.fillStyle = textColor;
    ctx.fillText(label, cx, cy);
    return;
  }

  ctx.fillStyle = labelShadow;
  ctx.fillText(label, cx + 2, cy + 2.5);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = 4;
  ctx.strokeText(label, cx, cy);

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.lineWidth = 2.25;
  ctx.strokeText(label, cx, cy);

  ctx.fillStyle = textColor;
  ctx.fillText(label, cx, cy);
}

function makeLabelOverlayTexture(label, textColor, labelShadow, darkSteel) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const fontSize = label.length > 9 ? 46 : label.length > 7 ? 52 : 60;
  drawEngravedLabel(ctx, label, size / 2, size / 2, fontSize, textColor, labelShadow, darkSteel);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makeFaceTexture(steel, accent, darkSteel) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const cx = size / 2;
  const cy = size / 2;

  const steelGrad = ctx.createLinearGradient(0, 0, size, size);
  steelGrad.addColorStop(0, mixHex(steel, '#ffffff', darkSteel ? 0.18 : 0.42));
  steelGrad.addColorStop(0.45, steel);
  steelGrad.addColorStop(1, mixHex(steel, '#000000', darkSteel ? 0.28 : 0.06));
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

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  const sheen = ctx.createLinearGradient(0, 0, size * 0.6, size);
  sheen.addColorStop(0, darkSteel ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.42)');
  sheen.addColorStop(0.35, darkSteel ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.1)');
  sheen.addColorStop(1, darkSteel ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.06)');
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

  let envMap = createEnvMap(getThemeKey());

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

  let shineStrength = 0;
  let shineAngle = 0;

  const cubeGroup = new THREE.Group();
  cubeGroup.rotation.x = -0.12;
  scene.add(cubeGroup);

  const geometry = new THREE.BoxGeometry(0.92, 0.92, 0.92);
  const materials = FACE_LABELS.map(
    () =>
      new THREE.MeshStandardMaterial({
        metalness: 0.93,
        roughness: 0.2,
        envMap: envMap.texture,
        envMapIntensity: 0.75,
      })
  );

  const cube = new THREE.Mesh(geometry, materials);
  cubeGroup.add(cube);

  const labelOffset = 0.462;
  const labelPlanes = FACE_LABELS.map((label, i) => {
    const normal = FACE_NORMALS[i];
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.76), mat);
    plane.position.set(normal.x * labelOffset, normal.y * labelOffset, normal.z * labelOffset);
    plane.lookAt(
      plane.position.x + normal.x,
      plane.position.y + normal.y,
      plane.position.z + normal.z
    );
    plane.userData.label = label;
    plane.renderOrder = 2;
    cube.add(plane);
    return plane;
  });

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

  let baseRimIntensity = 0.65;
  let baseEdgeOpacity = 0.72;
  let baseGlowOpacity = 0;
  let baseEnvIntensity = 0.75;
  let baseMetalness = 0.93;
  let baseRoughness = 0.2;
  let currentThemeSignature = '';
  let fallActive = false;

  function applyTheme() {
    const signature = getThemeSignature();
    if (signature === currentThemeSignature) return;
    currentThemeSignature = signature;

    const themeKey = getThemeKey();
    const darkSteel = isDarkSteelTheme(themeKey);
    if (envMap) envMap.dispose();
    envMap = createEnvMap(themeKey);

    const palette = buildThemePalette(themeKey);
    baseEnvIntensity = palette.envIntensity;
    baseMetalness = palette.metalness;
    baseRoughness = palette.roughness;

    FACE_LABELS.forEach((label, i) => {
      const face = palette.faces[i];
      if (materials[i].map) materials[i].map.dispose();
      materials[i].map = makeFaceTexture(face.steel, face.accent, darkSteel);
      materials[i].envMap = envMap.texture;
      materials[i].metalness = palette.metalness;
      materials[i].roughness = palette.roughness;
      materials[i].envMapIntensity = palette.envIntensity;
      materials[i].color.setHex(palette.steelTint);
      materials[i].emissive.copy(hexToThreeColor(face.accent));
      materials[i].emissiveIntensity = 0;
      materials[i].needsUpdate = true;

      const labelMat = labelPlanes[i].material;
      if (labelMat.map) labelMat.map.dispose();
      labelMat.map = makeLabelOverlayTexture(label, palette.text, palette.labelShadow, darkSteel);
      labelMat.needsUpdate = true;
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

    renderer.toneMappingExposure = darkSteel ? 1.08 : 1.18;
    envMap.update(shineAngle, shineStrength);
  }

  ensureLabelFontReady().then(() => applyTheme());

  const themeObserver = new MutationObserver(() => {
    ensureLabelFontReady().then(() => applyTheme());
  });
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
  let mouseNdc = { x: 0, y: 0 };
  let hoverTilt = { x: 0, y: 0 };

  function setPointerFromEvent(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    pointer.x = mouseNdc.x;
    pointer.y = mouseNdc.y;
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
    baseMaterialState: () => ({
      envIntensity: baseEnvIntensity,
      metalness: baseMetalness,
      roughness: baseRoughness,
      edgeOpacity: baseEdgeOpacity,
    }),
    onFallStart() {
      fallActive = true;
      pointerInside = false;
      hoverAmount = 0;
      shineStrength = 0;
      envMap.update(shineAngle, 0);
      renderer.domElement.style.cursor = 'default';
    },
    onFallComplete() {
      fallActive = true;
      renderer.domElement.style.cursor = 'not-allowed';
    },
    onResetStart() {
      fallActive = true;
      pointerInside = false;
      hoverAmount = 0;
    },
    onResetComplete() {
      fallActive = false;
      idleTime = 0;
      renderer.domElement.style.cursor = 'pointer';
    },
  });

  function onCubeClick(e) {
    if (window.innerWidth < DESKTOP_MIN) return;
    if (fallController.isLanded || fallController.isFalling || fallController.isResetting) {
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

  renderer.domElement.addEventListener('pointerenter', () => {
    if (fallController.isLanded || fallController.isFalling || fallController.isResetting) return;
    pointerInside = true;
    if (hoverEnabled) hoverSnap = 1;
  });
  renderer.domElement.addEventListener('pointerleave', () => {
    pointerInside = false;
  });
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (fallController.isLanded || fallController.isFalling || fallController.isResetting) return;
    setPointerFromEvent(e);
  });

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

  function updateMetalShine() {
    if (fallActive || fallController.isLanded || fallController.isFalling || fallController.isResetting) {
      shineStrength = THREE.MathUtils.lerp(shineStrength, 0, 0.14);
    } else {
      const darkSteel = isDarkSteelTheme(getThemeKey());
      const targetStrength = pointerInside ? (darkSteel ? 0.72 : 1) : 0;
      shineStrength = THREE.MathUtils.lerp(shineStrength, targetStrength, 0.12);
    }

    const targetAngle = Math.atan2(mouseNdc.y, mouseNdc.x);
    let angleDelta = targetAngle - shineAngle;
    while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
    shineAngle += angleDelta * (pointerInside ? 0.14 : 0.08);

    envMap.update(shineAngle, shineStrength);
  }

  function updateHover(dt) {
    if (!hoverEnabled || fallActive) return;

    const target = pointerInside ? 1 : 0;
    hoverAmount = THREE.MathUtils.lerp(hoverAmount, target, 0.09);
    hoverSnap = THREE.MathUtils.lerp(hoverSnap, 0, 0.06);

    const tiltTargetX = mouseNdc.y * 0.16 * hoverAmount;
    const tiltTargetY = mouseNdc.x * 0.2 * hoverAmount;
    hoverTilt.x = THREE.MathUtils.lerp(hoverTilt.x, tiltTargetX, 0.12);
    hoverTilt.y = THREE.MathUtils.lerp(hoverTilt.y, tiltTargetY, 0.12);

    rimLight.intensity = baseRimIntensity + hoverAmount * 0.12;
    edgeLines.material.opacity = baseEdgeOpacity + hoverAmount * 0.04;

    materials.forEach((mat) => {
      mat.emissiveIntensity = 0;
      if (!fallController.isFalling) {
        mat.metalness = baseMetalness;
        mat.roughness = baseRoughness;
        const darkSteel = isDarkSteelTheme(getThemeKey());
        const envBoost = shineStrength * (darkSteel ? 0.14 : 0.32);
        mat.envMapIntensity = baseEnvIntensity + envBoost;
      }
    });
  }

  function updateCube(dt) {
    readScroll();
    idleTime += dt;
    updateMetalShine();
    updateHover(dt);

    if (fallController.isFalling || fallController.isResetting) {
      return;
    }

    if (fallController.isLanded) {
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
    labelPlanes.forEach((plane) => {
      if (plane.material.map) plane.material.map.dispose();
      plane.geometry.dispose();
      plane.material.dispose();
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
