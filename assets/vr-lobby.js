// VR portfolio for vr.html, built on plain three.js and WebXR.
// Curved glass panels sit around the viewer at about 2.2 m. Every label is drawn
// into a canvas texture with the site's system font stack, so text stays crisp
// in a headset. The sky is a nebula baked once into a texture, the floor is a
// shader grid that fades into the horizon, and the homepage headset mascot
// floats above the hero and watches whatever you point at.
// Inputs: XR controllers or hands (laser + pinch), mouse drag and click,
// arrow keys and Tab, touch drag, and phone motion.
// Content lives in assets/vr-lobby.json, project details in assets/projects.json.
import * as THREE from 'three';

const R = 2.2; // main radius in metres
const EYE = 1.6; // standing eye height the layout is designed for
const PPM = 900; // canvas pixels per metre of panel
const MAX_TEX = 2048;
const DEG = Math.PI / 180;
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, "Helvetica Neue", Arial, sans-serif';
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const damp = (k, dt) => 1 - Math.exp(-k * dt);

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------
function store(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
const colorCtx = document.createElement('canvas').getContext('2d');
function rgb(str, fallback) {
  colorCtx.fillStyle = fallback;
  colorCtx.fillStyle = (str || '').trim() || fallback;
  const v = colorCtx.fillStyle;
  if (v[0] === '#') return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const m = v.match(/[\d.]+/g) || [0, 0, 0];
  return m.slice(0, 3).map((n) => +n / 255);
}
const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const css = (c, a = 1) => `rgba(${c.map((v) => Math.round(v * 255)).join(',')},${a})`;
const saturation = (c) => Math.max(...c) - Math.min(...c);
const v3 = (c) => new THREE.Vector3(c[0], c[1], c[2]);
const v4 = (c, a) => new THREE.Vector4(c[0], c[1], c[2], a);

function readTheme() {
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const plain = store('plainMode') === 'true';
  const variant = store('plainModeVariant');
  let p = rgb(cs.getPropertyValue('--primary'), '#7c3aed');
  let a = rgb(cs.getPropertyValue('--accent'), '#ec4899');
  if (!plain && store('rainbowMode') === 'true') { p = rgb('#ff006e'); a = rgb('#8338ec'); }
  if (plain && variant === 'rabiat') { p = rgb('#d62828'); a = rgb('#5eead4'); }
  if (saturation(p) < 0.08 && saturation(a) < 0.08) { p = rgb('#7c3aed'); a = rgb('#ec4899'); }
  const dark = root.classList.contains('dark') || (plain && variant === 'rabiat');
  const W = [1, 1, 1];
  const K = [0, 0, 0];
  if (dark) {
    return {
      dark, p, a,
      gradA: mixRgb(p, W, 0.38), gradB: mixRgb(a, W, 0.28),
      text: '#f7f5fb', muted: '#bfb9ce', soft: '#8e889f', onFill: '#ffffff',
      accentText: css(mixRgb(a, W, 0.35)),
      chip: 'rgba(255,255,255,0.09)', chipEdge: 'rgba(255,255,255,0.12)', chipText: '#ebe7f3',
      rule: 'rgba(255,255,255,0.09)',
      glassA: mixRgb([0.16, 0.14, 0.22], p, 0.06), glassB: mixRgb([0.08, 0.07, 0.12], p, 0.04), glassAlpha: [0.74, 0.8],
      btn: [1, 1, 1], btnAlpha: [0.1, 0.07],
      hoverTint: [0.3, 0.27, 0.4], edge: 0.26, glow: 0.12, sheen: 0.07,
      skyTop: [0.024, 0.02, 0.043], skyHor: mixRgb([0.1, 0.075, 0.16], p, 0.12), skyLow: [0.035, 0.03, 0.05],
      floor: [0.06, 0.05, 0.085], grid: mixRgb([0.6, 0.55, 0.8], p, 0.3), neb: 1,
    };
  }
  return {
    dark, p, a,
    gradA: mixRgb(p, K, 0.05), gradB: mixRgb(a, K, 0.12),
    text: '#1b1726', muted: '#544f63', soft: '#7a7489', onFill: '#ffffff',
    accentText: css(mixRgb(a, K, 0.25)),
    chip: 'rgba(124,58,237,0.08)', chipEdge: 'rgba(124,58,237,0.14)', chipText: '#2e2840',
    rule: 'rgba(27,23,38,0.09)',
    glassA: [1, 1, 1], glassB: mixRgb([0.97, 0.96, 0.99], p, 0.02), glassAlpha: [0.8, 0.86],
    btn: mixRgb([1, 1, 1], p, 0.04), btnAlpha: [0.92, 0.9],
    hoverTint: mixRgb([1, 1, 1], p, 0.1), edge: 0.32, glow: 0.1, sheen: 0.0,
    skyTop: mixRgb([0.78, 0.74, 0.93], p, 0.08), skyHor: [0.975, 0.965, 0.99], skyLow: [0.92, 0.9, 0.95],
    floor: [0.9, 0.88, 0.94], grid: mixRgb([0.45, 0.4, 0.6], p, 0.3), neb: 0.55,
  };
}

// ---------------------------------------------------------------------------
// Text and drawing helpers. Layout works in metres; drawing scales by px/m.
// ---------------------------------------------------------------------------
const fontOf = (size, weight = 400) => `${weight} ${size}px ${FONT}`;
const measureCtx = document.createElement('canvas').getContext('2d');
function mw(str, size, weight = 400) {
  measureCtx.font = fontOf(size * 1000, weight);
  return measureCtx.measureText(str).width / 1000;
}
function fitSize(str, weight, size, min, maxW) {
  let s = size;
  while (s > min && mw(str, s, weight) > maxW) s *= 0.97;
  return Math.max(s, min);
}
function ellipsize(str, size, weight, maxW) {
  if (mw(str, size, weight) <= maxW) return str;
  let s = str;
  while (s.length > 1 && mw(`${s}...`, size, weight) > maxW) s = s.slice(0, -1).trimEnd();
  return `${s.replace(/[,.;:]$/, '')}...`;
}
function wrap(str, size, weight, maxW, maxLines = 99) {
  const words = String(str).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (mw(test, size, weight) <= maxW || !line) { line = test; continue; }
    lines.push(line);
    line = words[i];
    if (lines.length === maxLines) {
      lines[maxLines - 1] = ellipsize(`${lines[maxLines - 1]} ${words.slice(i).join(' ')}`, size, weight, maxW);
      return lines;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) lines.length = maxLines;
  return lines;
}
// Copy from projects.json can contain dashes; the site rule is to show none.
function clean(str) {
  return String(str || '')
    .replace(/(\d|[A-Z][a-z]{2})\s*[\u2013\u2014]\s*(\d|[A-Z][a-z]{2}|now|present)/g, '$1 to $2')
    .replace(/\s+[\u2013\u2014]\s+/g, ', ')
    .replace(/[\u2013\u2014]/g, '-');
}

function rrPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Stroke icons from the site's icon set (24 x 24 viewBox)
const ICONS = {
  home: ['M3.5 10.6 12 3.75l8.5 6.85', 'M5.75 9v10.25a1 1 0 0 0 1 1h3.5v-6h3.5v6h3.5a1 1 0 0 0 1-1V9'],
  rocket: ['M12 2.75c3.1 2.2 4.75 5.4 4.75 9.1 0 1.7-.35 3.4-1 5h-7.5c-.65-1.6-1-3.3-1-5 0-3.7 1.65-6.9 4.75-9.1Z', 'M13.75 9.5a1.75 1.75 0 1 1-3.5 0a1.75 1.75 0 1 1 3.5 0', 'm7.6 12.6-2.85 3v3.65l3.5-2.4', 'm16.4 12.6 2.85 3v3.65l-3.5-2.4', 'M10.25 19.5v1.75', 'M13.75 19.5v1.75'],
  cap: ['M12 4.5 2.75 9 12 13.5 21.25 9 12 4.5Z', 'M6.5 11v4.75c0 1.6 2.6 3 5.5 3s5.5-1.4 5.5-3V11', 'M21.25 9v5.5'],
  flask: ['M9.5 3.25h5', 'M10.5 3.25v6.6L4.9 18.5A1.6 1.6 0 0 0 6.25 21h11.5a1.6 1.6 0 0 0 1.35-2.5l-5.6-8.65v-6.6', 'M7.75 15h8.5'],
  sparkle: ['M11 4.5c.8 4.5 3.5 7.2 8 8-4.5.8-7.2 3.5-8 8-.8-4.5-3.5-7.2-8-8 4.5-.8 7.2-3.5 8-8Z', 'M19 2.75v3.5', 'M17.25 4.5h3.5'],
  mail: ['M5 5.25h14a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9.5a2 2 0 0 1 2-2Z', 'm3.5 7 8.5 6.25L20.5 7'],
  document: ['M7 3.25h7l4.5 4.5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.25a1 1 0 0 1 1-1Z', 'M13.75 3.5V8h4.5', 'M9 13h6', 'M9 16.5h6'],
  back: ['M19 12H5.5', 'M11 6l-6 6 6 6'],
  chevL: ['M14.5 5.5 8 12l6.5 6.5'],
  chevR: ['M9.5 5.5 16 12l-6.5 6.5'],
  close: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'],
  external: ['M14 4.5h5.5V10', 'M19.5 4.5 11 13', 'M17.5 14v4.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1H10'],
  code: ['M8.5 7 3.5 12l5 5', 'M15.5 7l5 5-5 5', 'M13.5 4.5l-3 15'],
  link: ['M10 13.5a4.5 4.5 0 0 0 6.4.4l2.8-2.8a4.5 4.5 0 0 0-6.4-6.4l-1.3 1.3', 'M14 10.5a4.5 4.5 0 0 0-6.4-.4l-2.8 2.8a4.5 4.5 0 0 0 6.4 6.4l1.3-1.3'],
};
const pathCache = new Map();
function drawIcon(ctx, name, x, y, size, color, weight = 1.9) {
  const list = ICONS[name];
  if (!list) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = weight;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of list) {
    if (!pathCache.has(d)) pathCache.set(d, new Path2D(d));
    ctx.stroke(pathCache.get(d));
  }
  ctx.restore();
}

// Images: loaded once, drawn into rounded boxes. Portrait or square shots are
// shown whole over a blurred copy of themselves instead of being cropped.
const imageCache = new Map();
function loadImage(src) {
  if (!src) return null;
  if (imageCache.has(src)) return imageCache.get(src);
  const img = new Image();
  img.decoding = 'async';
  const entry = { img, ok: false, waiters: [] };
  img.onload = () => { entry.ok = true; entry.waiters.splice(0).forEach((f) => f()); };
  img.onerror = () => { entry.failed = true; entry.waiters.splice(0).forEach((f) => f()); };
  img.src = encodeURI(src);
  imageCache.set(src, entry);
  return entry;
}
function drawImageBox(ctx, entry, x, y, w, h, r, pal, fallbackLabel) {
  ctx.save();
  rrPath(ctx, x, y, w, h, r);
  ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, css(pal.p, pal.dark ? 0.55 : 0.25));
  g.addColorStop(1, css(pal.a, pal.dark ? 0.45 : 0.2));
  ctx.fillStyle = pal.dark ? '#1a1724' : '#efeaf7';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  if (entry && entry.ok) {
    const img = entry.img;
    const ia = img.naturalWidth / img.naturalHeight;
    const ba = w / h;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (ia / ba < 0.7 || ia / ba > 1.5) {
      // Blurred backdrop, then the whole image
      ctx.save();
      ctx.filter = `blur(${Math.round(h * 0.06)}px) saturate(1.2)`;
      const bh = Math.max(h * 1.2, (w * 1.2) / ia);
      const bw = bh * ia;
      ctx.drawImage(img, x + (w - bw) / 2, y + (h - bh) / 2, bw, bh);
      ctx.restore();
      ctx.fillStyle = pal.dark ? 'rgba(10,8,16,0.45)' : 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y, w, h);
      let dh = h * 0.92;
      let dw = dh * ia;
      if (dw > w * 0.92) { dw = w * 0.92; dh = dw / ia; }
      ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    } else {
      let sw = img.naturalWidth;
      let sh = img.naturalHeight;
      let sx = 0;
      let sy = 0;
      if (ia > ba) { sw = sh * ba; sx = (img.naturalWidth - sw) / 2; } else { sh = sw / ba; sy = (img.naturalHeight - sh) * 0.4; }
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    }
  } else if (fallbackLabel) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = fontOf(h * 0.28, 700);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fallbackLabel.slice(0, 2).toUpperCase(), x + w / 2, y + h / 2);
  }
  ctx.restore();
  // Hairline so the image edge reads cleanly against the glass
  ctx.save();
  rrPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.strokeStyle = pal.dark ? 'rgba(255,255,255,0.10)' : 'rgba(27,23,38,0.08)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

// Drawing ops. A layout function returns { w, h, ops } in metres; the panel
// replays the ops at its own pixel density whenever it repaints.
function runOps(ctx, s, ops, pal) {
  for (const o of ops) {
    if (o.t === 'text') {
      ctx.font = fontOf(o.size * s, o.weight || 400);
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = 'alphabetic';
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${(o.track || 0) * o.size * s}px`;
      if (o.grad) {
        const w = mw(o.str, o.size, o.weight || 400) * s;
        const x0 = o.align === 'center' ? o.x * s - w / 2 : o.align === 'right' ? o.x * s - w : o.x * s;
        const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
        g.addColorStop(0, css(o.grad[0]));
        g.addColorStop(1, css(o.grad[1]));
        ctx.fillStyle = g;
      } else ctx.fillStyle = o.color;
      ctx.fillText(o.str, o.x * s, o.y * s);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    } else if (o.t === 'chip') {
      rrPath(ctx, o.x * s, o.y * s, o.w * s, o.h * s, (o.h / 2) * s);
      ctx.fillStyle = pal.chip;
      ctx.fill();
      ctx.strokeStyle = pal.chipEdge;
      ctx.lineWidth = Math.max(1, 0.0022 * s);
      ctx.stroke();
      ctx.font = fontOf(o.size * s, 500);
      ctx.fillStyle = pal.chipText;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(o.str, (o.x + o.w / 2) * s, (o.y + o.h / 2 + o.size * 0.04) * s);
    } else if (o.t === 'rule') {
      ctx.fillStyle = pal.rule;
      ctx.fillRect(o.x * s, o.y * s, o.w * s, Math.max(1, 0.002 * s));
    } else if (o.t === 'dot') {
      ctx.beginPath();
      ctx.arc(o.x * s, o.y * s, o.r * s, 0, Math.PI * 2);
      const g = ctx.createLinearGradient((o.x - o.r) * s, 0, (o.x + o.r) * s, 0);
      g.addColorStop(0, css(pal.p));
      g.addColorStop(1, css(pal.a));
      ctx.fillStyle = g;
      ctx.fill();
    } else if (o.t === 'img') {
      drawImageBox(ctx, o.entry, o.x * s, o.y * s, o.w * s, o.h * s, o.r * s, pal, o.label);
    } else if (o.t === 'icon') {
      drawIcon(ctx, o.name, o.x * s, o.y * s, o.size * s, o.color, o.weight);
    }
  }
}
function text(str, x, y, size, opts = {}) { return { t: 'text', str, x, y, size, ...opts }; }
// Baseline for a line box whose top is at y
const base = (y, size, lh = 1.3) => y + size * (0.78 + (lh - 1) / 2);

function chipRow(tags, x, y, maxW, size, align = 'left') {
  const h = size * 1.75;
  const pad = size * 0.75;
  const gap = size * 0.4;
  const chips = [];
  let total = 0;
  for (const t of tags) {
    const w = mw(t, size, 500) + pad * 2;
    if (total + w + (chips.length ? gap : 0) > maxW) break;
    total += w + (chips.length ? gap : 0);
    chips.push({ str: t, w });
  }
  let cx = align === 'center' ? x + (maxW - total) / 2 : x;
  const ops = chips.map((c) => {
    const op = { t: 'chip', str: c.str, x: cx, y, w: c.w, h, size };
    cx += c.w + gap;
    return op;
  });
  return { ops, h };
}

// ---------------------------------------------------------------------------
// Glass panel material: rounded rect SDF with fill, gradient border, outer
// glow and the canvas content, all in one draw. Colours are display values
// (sRGB) and the output is premultiplied, so text edges stay clean.
// ---------------------------------------------------------------------------
const PANEL_VS = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const PANEL_FS = /* glsl */`
uniform vec2 uSize;
uniform float uMargin;
uniform float uRadius;
uniform vec4 uFillA;
uniform vec4 uFillB;
uniform float uGradX;
uniform vec4 uHoverTint;
uniform vec3 uEdgeA;
uniform vec3 uEdgeB;
uniform float uEdge;
uniform float uEdgeW;
uniform vec3 uGlowA;
uniform vec3 uGlowB;
uniform float uGlow;
uniform float uSheen;
uniform float uHover;
uniform float uFocus;
uniform float uOpacity;
uniform float uHasMap;
uniform sampler2D uMap;
varying vec2 vUv;
float sdRR(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
vec4 over(vec4 top, vec4 under) { return top + under * (1.0 - top.a); }
void main() {
  vec2 full = uSize + 2.0 * uMargin;
  vec2 p = (vUv - 0.5) * full;
  float d = sdRR(p, uSize * 0.5, uRadius);
  float aa = max(fwidth(d), 1e-5);
  float inside = 1.0 - smoothstep(-aa, aa, d);
  vec2 q = p / uSize + 0.5;
  float h = clamp(uHover, 0.0, 1.0);
  vec4 fill = mix(uFillA, uFillB, mix(1.0 - q.y, q.x, uGradX));
  fill = mix(fill, vec4(uHoverTint.rgb, max(fill.a, uHoverTint.a)), h * step(0.001, uHoverTint.a));
  float sheen = uSheen * smoothstep(0.45, 1.0, q.y) * (1.0 - 0.5 * q.x);
  fill.rgb = mix(fill.rgb, vec3(1.0), sheen);
  vec4 col = vec4(fill.rgb * fill.a, fill.a) * inside;
  if (uHasMap > 0.5) {
    vec4 t = texture2D(uMap, clamp(q, 0.0, 1.0));
    col = over(t * inside, col);
  }
  float w = max(uEdgeW, aa * 1.25);
  float ring = 1.0 - smoothstep(w * 0.5 - aa * 0.5, w * 0.5 + aa * 0.5, abs(d + w * 0.5));
  float ea = clamp(uEdge * (0.45 + 0.55 * q.y) * (uEdgeW / w) + h * 0.5 + uFocus * 0.6, 0.0, 1.0) * ring;
  vec3 ec = mix(vec3(1.0), mix(uEdgeA, uEdgeB, q.x), 0.5 + 0.35 * max(h, uFocus));
  col = over(vec4(ec * ea, ea), col);
  float od = max(d, 0.0);
  float spread = 0.012 + 0.016 * max(h, uFocus);
  float g = (uGlow + h * 0.42 + uFocus * 0.4) * exp(-od / spread) * (1.0 - inside);
  g *= 1.0 - smoothstep(uMargin * 0.55, uMargin * 0.98, od);
  vec3 gc = mix(uGlowA, uGlowB, q.x);
  col = over(col, vec4(gc * g, g));
  gl_FragColor = col * uOpacity;
}`;

let maxAniso = 1;
function canvasTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.premultiplyAlpha = true;
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = maxAniso;
  return t;
}
function panelMaterial(style, w, h, margin, radius, map) {
  return new THREE.ShaderMaterial({
    vertexShader: PANEL_VS,
    fragmentShader: PANEL_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    extensions: { derivatives: true },
    uniforms: {
      uSize: { value: new THREE.Vector2(w, h) },
      uMargin: { value: margin },
      uRadius: { value: radius },
      uFillA: { value: style.fillA },
      uFillB: { value: style.fillB },
      uGradX: { value: style.gradX || 0 },
      uHoverTint: { value: style.hoverTint || new THREE.Vector4(0, 0, 0, 0) },
      uEdgeA: { value: style.edgeA },
      uEdgeB: { value: style.edgeB },
      uEdge: { value: style.edge },
      uEdgeW: { value: style.edgeW ?? 0.004 },
      uGlowA: { value: style.glowA },
      uGlowB: { value: style.glowB },
      uGlow: { value: style.glow },
      uSheen: { value: style.sheen || 0 },
      uHover: { value: 0 },
      uFocus: { value: 0 },
      uOpacity: { value: 1 },
      uHasMap: { value: map ? 1 : 0 },
      uMap: { value: map || null },
    },
  });
}

// Plane bent around a vertical axis at +r in local space, so its centre sits
// at the origin and its edges curve toward the viewer.
function curvedPlane(w, h, r) {
  const seg = Math.max(2, Math.ceil(w / r / (2.5 * DEG)));
  const g = new THREE.PlaneGeometry(w, h, seg, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const a = pos.getX(i) / r;
    pos.setXYZ(i, r * Math.sin(a), pos.getY(i), r - r * Math.cos(a));
  }
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

// ---------------------------------------------------------------------------
// Panel: one curved glass element, optionally interactive
// ---------------------------------------------------------------------------
const panels = [];
const interactives = [];
class Panel {
  constructor(o) {
    this.o = o;
    this.key = o.key || '';
    this.layer = o.layer || 'main';
    this.k = o.scale || 1;
    this.lw = o.w;
    this.lh = o.h;
    this.w = o.w * this.k;
    this.h = o.h * this.k;
    const parentPanel = o.parent instanceof Panel ? o.parent : null;
    this.r = parentPanel ? parentPanel.r : o.r || R;
    this.margin = (o.margin ?? 0.05) * this.k;
    this.pivot = new THREE.Group();
    this.item = new THREE.Group();
    this.pivot.add(this.item);
    if (parentPanel) {
      this.pivot.position.set(0, 0, this.r);
      this.item.position.set(0, o.y || 0, -this.r);
    } else {
      this.item.position.set(0, o.y, -this.r);
      const tilt = o.tilt ?? Math.atan2(EYE - o.y, this.r);
      this.item.rotation.x = -tilt;
    }
    this.pivot.rotation.y = -(o.theta || 0) * DEG;
    (parentPanel ? parentPanel.item : o.parent).add(this.pivot);
    this.basePos = this.item.position.clone();
    this.normal = new THREE.Vector3(0, 0, 1).applyEuler(this.item.rotation);
    this.lift = o.lift ?? 0;

    if (o.paint) {
      const s = Math.min(o.ppm || PPM, MAX_TEX / Math.max(o.w, o.h));
      this.canvas = document.createElement('canvas');
      this.canvas.width = Math.ceil(o.w * s);
      this.canvas.height = Math.ceil(o.h * s);
      this.s = this.canvas.width / o.w;
      this.ctx = this.canvas.getContext('2d');
      this.tex = canvasTexture(this.canvas);
    }
    const geo = curvedPlane(this.w + 2 * this.margin, this.h + 2 * this.margin, this.r);
    this.mat = panelMaterial(o.style, this.w, this.h, this.margin, (o.radius ?? 0.05) * this.k, this.tex);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.userData.panel = this;
    // Children always draw after the glass they sit on
    this.mesh.renderOrder = o.renderOrder ?? (parentPanel ? parentPanel.mesh.renderOrder + 1 : 0);
    this.item.add(this.mesh);

    this.hover = 0;
    this.hoverT = 0;
    this.focus = 0;
    this.focusT = 0;
    this.press = 0;
    this.fade = o.fadeIn === false ? 1 : 0;
    this.fadeT = 1;
    this.visible = true;
    this.onSelect = o.onSelect || null;
    this.label = o.label || '';
    this.repaint();
    panels.push(this);
    if (this.onSelect) interactives.push(this);
  }

  repaint() {
    if (!this.ctx) return;
    const { ctx } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.o.paint(ctx, this.s, this);
    this.tex.needsUpdate = true;
  }

  // Is a raycast hit inside the panel body (not the glow margin)?
  contains(uv) {
    const mx = this.margin / (this.w + 2 * this.margin);
    const my = this.margin / (this.h + 2 * this.margin);
    return uv.x > mx && uv.x < 1 - mx && uv.y > my && uv.y < 1 - my;
  }

  update(dt, dim) {
    const k = REDUCE ? 30 : 14;
    this.hover += (this.hoverT - this.hover) * damp(k, dt);
    this.focus += (this.focusT - this.focus) * damp(k, dt);
    this.fade += (this.fadeT - this.fade) * damp(REDUCE ? 40 : 9, dt);
    this.press = Math.max(0, this.press - dt * 5);
    const lifted = this.lift + 0.02 * Math.max(this.hover, this.focus) - 0.008 * this.press;
    this.item.position.copy(this.basePos).addScaledVector(this.normal, lifted);
    const sc = 1 + 0.012 * this.hover - 0.01 * this.press;
    this.item.scale.setScalar(sc);
    const u = this.mat.uniforms;
    u.uHover.value = this.hover;
    u.uFocus.value = this.focus;
    const o = this.fade * (this.layer === 'main' ? 1 - 0.85 * dim : 1);
    u.uOpacity.value = o;
    this.mesh.visible = this.visible && o > 0.003;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
    if (this.tex) this.tex.dispose();
    this.pivot.removeFromParent();
    const i = panels.indexOf(this);
    if (i >= 0) panels.splice(i, 1);
    const j = interactives.indexOf(this);
    if (j >= 0) interactives.splice(j, 1);
    if (this.a11y) this.a11y.remove();
  }
}

// Styles built from the palette
function makeStyles(pal) {
  const glow = (alpha) => ({ glowA: v3(pal.p), glowB: v3(pal.a), glow: alpha });
  const edge = { edgeA: v3(mixRgb(pal.p, [1, 1, 1], 0.3)), edgeB: v3(mixRgb(pal.a, [1, 1, 1], 0.3)) };
  return {
    glass: {
      fillA: v4(pal.glassA, pal.glassAlpha[0]), fillB: v4(pal.glassB, pal.glassAlpha[1]),
      edge: pal.edge, sheen: pal.sheen, ...edge, ...glow(pal.glow),
    },
    card: {
      fillA: v4(pal.glassA, pal.glassAlpha[0]), fillB: v4(pal.glassB, pal.glassAlpha[1]),
      hoverTint: v4(mixRgb(pal.glassA, pal.hoverTint, 0.35), pal.glassAlpha[0]),
      edge: pal.edge, sheen: pal.sheen, ...edge, ...glow(pal.glow),
    },
    button: {
      fillA: v4(pal.btn, pal.btnAlpha[0]), fillB: v4(pal.btn, pal.btnAlpha[1]),
      hoverTint: v4(pal.hoverTint, pal.dark ? 0.32 : 0.98),
      edge: pal.dark ? 0.3 : 0.36, ...edge, ...glow(0.0),
    },
    primary: {
      fillA: v4(pal.p, 1), fillB: v4(pal.a, 1), gradX: 1,
      edge: 0.35, edgeA: v3([1, 1, 1]), edgeB: v3([1, 1, 1]), ...glow(pal.dark ? 0.28 : 0.2),
    },
    ghost: {
      fillA: v4([0, 0, 0], 0), fillB: v4([0, 0, 0], 0),
      hoverTint: v4(pal.hoverTint, pal.dark ? 0.28 : 0.9),
      edge: 0, ...edge, ...glow(0),
    },
    label: {
      fillA: v4([0, 0, 0], 0), fillB: v4([0, 0, 0], 0), edge: 0, ...edge, ...glow(0),
    },
  };
}

// ---------------------------------------------------------------------------
// Layouts (all sizes in metres at R; text sizes are em heights)
// Body text 0.062 m gives a cap height of about 4.5 cm, roughly 1.2 degrees at 2.2 m.
// ---------------------------------------------------------------------------
const SZ = { display: 0.15, headline: 0.092, title: 0.074, body: 0.062, label: 0.056, small: 0.052 };

function layoutHero(d, pal, w) {
  const pad = 0.085;
  const inner = w - pad * 2;
  const cx = w / 2;
  const ops = [];
  let y = pad;
  ops.push(text(d.eyebrow, cx, base(y, SZ.small), SZ.small, { weight: 600, color: pal.accentText, align: 'center', track: 0.06 }));
  y += SZ.small * 1.3 + 0.02;
  const ns = fitSize(d.name, 700, SZ.display, 0.1, inner);
  ops.push(text(d.name, cx, base(y, ns, 1.1), ns, { weight: 700, color: pal.text, align: 'center', track: -0.015 }));
  y += ns * 1.1;
  const hs = fitSize(d.headline, 700, SZ.headline, 0.06, inner);
  ops.push(text(d.headline, cx, base(y, hs, 1.2), hs, { weight: 700, grad: [pal.gradA, pal.gradB], align: 'center', track: -0.01 }));
  y += hs * 1.2 + 0.035;
  const lines = wrap(d.lead, SZ.body, 400, inner * 0.94, 3);
  for (const l of lines) {
    ops.push(text(l, cx, base(y, SZ.body, 1.38), SZ.body, { color: pal.muted, align: 'center' }));
    y += SZ.body * 1.38;
  }
  y += 0.035;
  const chips = chipRow(d.tags || [], pad, y, inner, 0.05, 'center');
  ops.push(...chips.ops);
  y += chips.h + 0.05;
  const buttonsTop = y;
  y += 0.13 + 0.075;
  return { w, h: y, ops, buttonsTop };
}

function layoutButton(label, icon, pal, primary, size = SZ.label) {
  const padX = size * 1.05;
  const iconS = icon ? size * 1.05 : 0;
  const gap = icon ? size * 0.45 : 0;
  const tw = mw(label, size, 600);
  const w = padX * 2 + iconS + gap + tw;
  const h = size * 2.3;
  const color = primary ? pal.onFill : pal.text;
  const ops = [];
  if (icon) ops.push({ t: 'icon', name: icon, x: padX, y: (h - iconS) / 2, size: iconS, color, weight: 2 });
  ops.push(text(label, padX + iconS + gap, h / 2 + size * 0.36, size, { weight: 600, color }));
  return { w, h, ops };
}

function layoutCard(item, project, pal, w, h) {
  const pad = 0.032;
  const ops = [];
  const imgH = 0.285;
  const iw = w - pad * 2;
  ops.push({ t: 'img', entry: loadImage(project.image), x: pad, y: pad, w: iw, h: imgH, r: 0.026, label: project.title });
  let y = pad + imgH + 0.034;
  const ts = fitSize(item.title, 700, SZ.title, 0.06, iw);
  ops.push(text(ellipsize(item.title, ts, 700, iw), pad, base(y, ts, 1.15), ts, { weight: 700, color: pal.text }));
  y += ts * 1.15 + 0.012;
  for (const l of wrap(item.line, SZ.body, 400, iw, 2)) {
    ops.push(text(l, pad, base(y, SZ.body, 1.3), SZ.body, { color: pal.muted }));
    y += SZ.body * 1.3;
  }
  const chips = chipRow(project.tags.slice(0, 3), pad, h - pad - 0.0875, iw, 0.05);
  ops.push(...chips.ops);
  return ops;
}

function layoutExperience(d, pal, w) {
  const padX = 0.06;
  const ops = [];
  let y = 0.05;
  const inner = w - padX * 2;
  d.items.forEach((it, i) => {
    if (i) { ops.push({ t: 'rule', x: padX, y: y - 0.026, w: inner }); }
    ops.push({ t: 'dot', x: padX + 0.012, y: y + SZ.body * 0.62, r: 0.012 });
    const tx = padX + 0.045;
    const whenW = mw(it.when, SZ.small, 500);
    const roleW = inner - 0.045 - whenW - 0.04;
    const rs = fitSize(it.role, 700, 0.066, 0.054, roleW);
    ops.push(text(ellipsize(it.role, rs, 700, roleW), tx, base(y, 0.066, 1.2), rs, { weight: 700, color: pal.text }));
    ops.push(text(it.when, padX + inner, base(y, 0.066, 1.2), SZ.small, { weight: 500, color: pal.soft, align: 'right' }));
    y += 0.066 * 1.2 + 0.006;
    const ls = fitSize(it.line, 400, 0.058, 0.05, inner - 0.045);
    ops.push(text(ellipsize(it.line, ls, 400, inner - 0.045), tx, base(y, 0.058, 1.3), ls, { color: pal.muted }));
    y += 0.058 * 1.3 + 0.052;
  });
  return { w, h: y - 0.052 + 0.05, ops };
}

function layoutLabTile(lab, pal, w, h) {
  const pad = 0.032;
  const iw = w - pad * 2;
  const imgH = h - pad * 2 - 0.27;
  const ops = [{ t: 'img', entry: loadImage(lab.image), x: pad, y: pad, w: iw, h: imgH, r: 0.026, label: lab.title }];
  let y = pad + imgH + 0.03;
  ops.push(text(lab.title, pad, base(y, SZ.title, 1.15), SZ.title, { weight: 700, color: pal.text }));
  ops.push({ t: 'icon', name: 'external', x: w - pad - 0.052, y: y + 0.012, size: 0.052, color: pal.soft, weight: 2 });
  y += SZ.title * 1.15 + 0.008;
  for (const l of wrap(lab.line, 0.058, 400, iw, 2)) {
    ops.push(text(l, pad, base(y, 0.058, 1.3), 0.058, { color: pal.muted }));
    y += 0.058 * 1.3;
  }
  return ops;
}

function layoutDetail(p, pal) {
  const w = 1.84;
  const pad = 0.075;
  const imgW = 0.7;
  const x0 = pad + imgW + 0.065;
  const cw = w - x0 - pad;
  const ops = [];
  let y = pad;
  const meta = [p.category, p.year].filter(Boolean).map(clean).join('  ·  ');
  ops.push(text(ellipsize(meta.toUpperCase(), 0.046, 600, cw - 0.13), x0, base(y, 0.046), 0.046, { weight: 600, color: pal.accentText, track: 0.06 }));
  y += 0.046 * 1.3 + 0.018;
  for (const l of wrap(clean(p.title), 0.088, 700, cw, 2)) {
    ops.push(text(l, x0, base(y, 0.088, 1.15), 0.088, { weight: 700, color: pal.text, track: -0.01 }));
    y += 0.088 * 1.15;
  }
  if (p.subtitle) {
    y += 0.006;
    for (const l of wrap(clean(p.subtitle), 0.058, 500, cw, 2)) {
      ops.push(text(l, x0, base(y, 0.058, 1.3), 0.058, { weight: 500, color: pal.text }));
      y += 0.058 * 1.3;
    }
  }
  y += 0.022;
  for (const l of wrap(clean(p.description), 0.056, 400, cw, 6)) {
    ops.push(text(l, x0, base(y, 0.056, 1.42), 0.056, { color: pal.muted }));
    y += 0.056 * 1.42;
  }
  y += 0.03;
  const chips = chipRow((p.tags || []).slice(0, 4), x0, y, cw, 0.046);
  ops.push(...chips.ops);
  y += chips.h + 0.045;
  const buttonsTop = y;
  y += 0.13 + pad;
  const h = Math.max(y, 0.86);
  ops.unshift({ t: 'img', entry: loadImage(p.image), x: pad, y: pad, w: imgW, h: h - pad * 2, r: 0.03, label: p.title });
  return { w, h, ops, x0, buttonsTop: h - pad - 0.13 };
}

// ---------------------------------------------------------------------------
// Environment: baked nebula sky, stars, dust, floor
// ---------------------------------------------------------------------------
const NOISE = /* glsl */`
float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
`;
const SKY_BAKE_FS = /* glsl */`
uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uLow; uniform vec3 uP; uniform vec3 uA;
uniform float uNeb; uniform float uDark;
varying vec2 vUv;
${NOISE}
void main() {
  float lon = (vUv.x - 0.5) * 6.2831853;
  float lat = (vUv.y - 0.5) * 3.1415927;
  vec3 d = vec3(cos(lat) * sin(lon), sin(lat), -cos(lat) * cos(lon));
  float y = d.y;
  vec3 col = y > 0.0 ? mix(uHor, uTop, pow(smoothstep(0.0, 0.9, y), 0.55)) : mix(uHor, uLow, smoothstep(0.0, 0.2, -y));
  float haze = exp(-abs(y) * 10.0);
  vec3 hz = mix(uP, uA, 0.5 + 0.5 * sin(lon + 0.8));
  col = mix(col, col + hz * 0.16, haze * uNeb);
  vec3 bn = normalize(vec3(0.42, 0.78, 0.46));
  float band = exp(-pow(dot(d, bn) / 0.45, 2.0));
  float n1 = fbm(d * 2.3 + vec3(4.1, 1.3, 7.7));
  float n2 = fbm(d * 5.2 + vec3(n1 * 2.0, 3.0, -1.0));
  float cloud = smoothstep(0.38, 0.9, n1 * 0.7 + n2 * 0.42);
  float m = cloud * (0.25 + 0.75 * band);
  // Calmer behind the panels: in front and near eye level
  float front = smoothstep(0.15, 0.8, -d.z) * (1.0 - smoothstep(0.2, 0.62, y));
  m *= 1.0 - 0.6 * front;
  m *= smoothstep(-0.08, 0.12, y);
  vec3 neb = mix(uP, uA, smoothstep(0.35, 0.75, n2));
  if (uDark > 0.5) {
    col += neb * m * 0.5 * uNeb;
    col += vec3(0.9, 0.85, 1.0) * pow(m, 3.0) * 0.08;
    col *= 1.0 - 0.3 * smoothstep(0.58, 0.82, n2) * band * smoothstep(0.05, 0.3, y);
  } else {
    col = mix(col, mix(col, neb, 0.5), m * 0.35 * uNeb);
  }
  gl_FragColor = vec4(col, 1.0);
}`;
const SKY_FS = /* glsl */`
uniform sampler2D uSky;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float lon = atan(d.x, -d.z);
  float lat = asin(clamp(d.y, -1.0, 1.0));
  vec3 c = texture2D(uSky, vec2(lon / 6.2831853 + 0.5, lat / 3.1415927 + 0.5)).rgb;
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  gl_FragColor = vec4(c + (n - 0.5) / 255.0, 1.0);
}`;
const SKY_VS = /* glsl */`
varying vec3 vDir;
void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FLOOR_VS = /* glsl */`
varying vec3 vW;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FLOOR_FS = /* glsl */`
uniform vec3 uBase; uniform vec3 uHor; uniform vec3 uGrid; uniform vec3 uP; uniform vec3 uA;
uniform vec2 uCenter; uniform float uDark; uniform float uTime;
varying vec3 vW;
void main() {
  vec2 p = vW.xz - uCenter;
  float r = length(p);
  vec2 gp = p / 0.5;
  vec2 fw = fwidth(gp);
  vec2 gl = abs(fract(gp - 0.5) - 0.5) / max(fw, 1e-4);
  float line = 1.0 - min(min(gl.x, gl.y), 1.0);
  float lod = 1.0 - smoothstep(0.25, 0.7, max(fw.x, fw.y));
  float grid = line * lod * (1.0 - smoothstep(1.2, 7.5, r)) * smoothstep(0.75, 1.1, r);
  // Platform ring under the viewer
  float rd = abs(r - 0.62);
  float ring = (1.0 - smoothstep(0.0, 0.006 + fwidth(r), rd)) + exp(-rd * 22.0) * 0.35;
  float ang = atan(p.x, -p.y);
  vec3 ringCol = mix(uP, uA, 0.5 + 0.5 * sin(ang + uTime * 0.15));
  // Soft light pool under the panels, like their glow on a glossy floor
  float pool = exp(-pow((r - 2.0) / 0.95, 2.0)) * (1.0 - smoothstep(55.0, 72.0, abs(ang) * 57.2958));
  vec3 poolCol = mix(uP, uA, 0.5 + 0.5 * sin(ang * 1.4));
  vec3 col = uBase;
  col = mix(col, poolCol, pool * (uDark > 0.5 ? 0.22 : 0.12));
  col = mix(col, uGrid, grid * (uDark > 0.5 ? 0.22 : 0.3));
  col = mix(col, ringCol, clamp(ring, 0.0, 1.0) * (uDark > 0.5 ? 0.85 : 0.6));
  // Glossy falloff: the floor picks up the horizon glow as it recedes
  col = mix(col, uHor, pow(smoothstep(0.5, 20.0, r), 0.45));
  float a = 1.0 - smoothstep(20.0, 34.0, r);
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  gl_FragColor = vec4((col + (n - 0.5) / 255.0) * a, a);
}`;

const SPECK_VS = /* glsl */`
attribute vec2 corner;
attribute vec4 aInfo; // size, phase, brightness, speed
attribute vec3 color;
uniform float uTime; uniform float uTwinkle; uniform float uDrift; uniform float uRange;
varying vec2 vC; varying float vA; varying vec3 vCol;
void main() {
  vec3 c = position;
  if (uDrift > 0.0) c.y = mod(position.y + uTime * aInfo.w, uRange);
  vec4 mv = modelViewMatrix * vec4(c, 1.0);
  mv.xy += corner * aInfo.x;
  gl_Position = projectionMatrix * mv;
  vC = corner;
  float tw = 0.5 + 0.5 * sin(uTime * (0.7 + aInfo.y) + aInfo.y * 31.0);
  vA = aInfo.z * (1.0 - uTwinkle * 0.45 * tw);
  vCol = color;
}`;
const SPECK_FS = /* glsl */`
varying vec2 vC; varying float vA; varying vec3 vCol;
void main() {
  float r2 = dot(vC, vC);
  float a = (exp(-r2 * 9.0) * 0.6 + exp(-r2 * 45.0)) * vA * (1.0 - smoothstep(0.7, 1.0, r2));
  gl_FragColor = vec4(vCol, a);
}`;
function speckField(n, place, colorOf, sizeOf, brightOf, opts) {
  const pos = new Float32Array(n * 4 * 3);
  const corner = new Float32Array(n * 4 * 2);
  const info = new Float32Array(n * 4 * 4);
  const col = new Float32Array(n * 4 * 3);
  const idx = [];
  const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    place(p, i);
    const c = colorOf(i);
    const sz = sizeOf(i);
    const br = brightOf(i);
    const ph = Math.random() * 6.28;
    const sp = 0.03 + Math.random() * 0.06;
    for (let k = 0; k < 4; k++) {
      const v = i * 4 + k;
      pos.set([p.x, p.y, p.z], v * 3);
      corner.set(C[k], v * 2);
      info.set([sz, ph, br, sp], v * 4);
      col.set(c, v * 3);
    }
    const b = i * 4;
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('corner', new THREE.BufferAttribute(corner, 2));
  g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  const m = new THREE.ShaderMaterial({
    vertexShader: SPECK_VS,
    fragmentShader: SPECK_FS,
    transparent: true,
    depthWrite: false,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uTime: { value: 0 }, uTwinkle: { value: opts.twinkle }, uDrift: { value: opts.drift || 0 }, uRange: { value: opts.range || 1 } },
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return mesh;
}

function buildEnvironment(renderer, scene, pal) {
  const group = new THREE.Group();
  scene.add(group);
  // Bake the sky once into an equirect target
  const rt = new THREE.WebGLRenderTarget(2048, 1024, { depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
  rt.texture.wrapS = THREE.RepeatWrapping;
  const bakeMat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: SKY_BAKE_FS,
    uniforms: {
      uTop: { value: v3(pal.skyTop) }, uHor: { value: v3(pal.skyHor) }, uLow: { value: v3(pal.skyLow) },
      uP: { value: v3(pal.p) }, uA: { value: v3(pal.a) }, uNeb: { value: pal.neb }, uDark: { value: pal.dark ? 1 : 0 },
    },
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bakeMat);
  quad.frustumCulled = false;
  const bakeScene = new THREE.Scene();
  bakeScene.add(quad);
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(rt);
  renderer.render(bakeScene, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));
  renderer.setRenderTarget(prev);
  quad.geometry.dispose();
  bakeMat.dispose();

  const skyGroup = new THREE.Group();
  group.add(skyGroup);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(80, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: { uSky: { value: rt.texture } }, side: THREE.BackSide, depthWrite: false }),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  skyGroup.add(sky);

  let stars = null;
  if (pal.dark) {
    const tint = [mixRgb(pal.p, [1, 1, 1], 0.6), mixRgb(pal.a, [1, 1, 1], 0.6), [1, 1, 1], [0.85, 0.9, 1]];
    stars = speckField(1500, (p) => {
      let y;
      do { y = Math.random(); } while (y < 0.03);
      y = Math.pow(y, 0.8);
      const t = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(1 - y * y);
      p.set(Math.cos(t) * rr, y, Math.sin(t) * rr).multiplyScalar(60);
    }, () => tint[(Math.random() * 4) | 0], () => (Math.random() < 0.06 ? 0.2 + Math.random() * 0.12 : 0.07 + Math.random() * 0.08),
    () => 0.35 + Math.random() * 0.65, { additive: true, twinkle: REDUCE ? 0 : 1 });
    stars.renderOrder = -9;
    skyGroup.add(stars);
  }

  // Slow dust motes in the middle distance give the space volume
  const dust = speckField(180, (p) => {
    const t = Math.random() * Math.PI * 2;
    const rr = 3.2 + Math.random() * 7;
    p.set(Math.cos(t) * rr, Math.random() * 5, Math.sin(t) * rr);
  }, () => mixRgb(Math.random() < 0.5 ? pal.p : pal.a, [1, 1, 1], pal.dark ? 0.45 : 0.1), () => 0.008 + Math.random() * 0.012,
  () => (pal.dark ? 0.35 : 0.45) * (0.4 + Math.random() * 0.6), { additive: pal.dark, twinkle: 0, drift: REDUCE ? 0 : 1, range: 5 });
  dust.renderOrder = -4;
  group.add(dust);

  const floorMat = new THREE.ShaderMaterial({
    vertexShader: FLOOR_VS,
    fragmentShader: FLOOR_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    extensions: { derivatives: true },
    uniforms: {
      uBase: { value: v3(pal.floor) }, uHor: { value: v3(mixRgb(pal.skyHor, pal.skyLow, 0.15)) }, uGrid: { value: v3(pal.grid) },
      uP: { value: v3(pal.p) }, uA: { value: v3(pal.a) }, uCenter: { value: new THREE.Vector2() },
      uDark: { value: pal.dark ? 1 : 0 }, uTime: { value: 0 },
    },
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(36, 72), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = -5;
  group.add(floor);

  return {
    group, skyGroup, floor,
    update(t, camPos) {
      skyGroup.position.copy(camPos);
      if (stars) stars.material.uniforms.uTime.value = t;
      dust.material.uniforms.uTime.value = t;
      floorMat.uniforms.uTime.value = REDUCE ? 0 : t;
    },
    dispose() { rt.dispose(); },
  };
}

// ---------------------------------------------------------------------------
// Mascot: the homepage headset, scaled down, with shader eyes
// ---------------------------------------------------------------------------
const EYES_FS = /* glsl */`
uniform vec2 uLook; uniform float uLid; uniform float uHappy; uniform vec3 uIris; uniform vec3 uGlow;
varying vec2 vUv;
vec3 eye(vec2 p, float cx) {
  vec2 c = vec2(cx + uLook.x * 30.0, 128.0 + uLook.y * 22.0);
  float d = length(p - c) / 92.0;
  vec3 col; float a;
  if (d < 0.18) { col = mix(vec3(1.0), uIris, d / 0.18); a = 1.0; }
  else if (d < 0.55) { float t = (d - 0.18) / 0.37; col = mix(uIris, uGlow, t); a = mix(1.0, 0.53, t); }
  else { col = uGlow; a = mix(0.53, 0.0, clamp((d - 0.55) / 0.45, 0.0, 1.0)); }
  vec3 o = col * a;
  vec2 pc = c + uLook * vec2(8.0, 6.0);
  o = mix(o, vec3(0.016, 0.008, 0.04), (1.0 - smoothstep(25.5, 28.0, length(p - pc))) * 0.96);
  o = mix(o, vec3(1.0), (1.0 - smoothstep(6.0, 8.0, length(p - pc - vec2(10.0, 10.0)))) * 0.95);
  float lidEdge = c.y + 96.0 - 192.0 * uLid;
  o *= 1.0 - smoothstep(lidEdge - 1.5, lidEdge + 1.5, p.y);
  vec2 hc = vec2(c.x, c.y - 96.0);
  vec2 e = (p - hc) / vec2(110.0, max(96.0 * uHappy, 0.01));
  float under = max(step(dot(e, e), 1.0), step(p.y, hc.y));
  o *= 1.0 - under * step(0.01, uHappy);
  return o;
}
void main() {
  vec2 p = vUv * vec2(512.0, 256.0);
  gl_FragColor = vec4(eye(p, 168.0) + eye(p, 344.0), 1.0);
}`;

function buildMascot(renderer, pal) {
  const root = new THREE.Group();
  const head = new THREE.Group();
  root.add(head);
  head.scale.setScalar(0.145);
  const rrect = (w, h, r) => {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  const bend = (geo, k, dz = 0) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) + dz - x * x * k); }
    geo.computeVertexNormals();
    return geo;
  };
  const c3 = (c) => new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
  const shellBase = pal.dark ? mixRgb([0.141, 0.102, 0.22], pal.p, 0.12) : mixRgb([0.914, 0.894, 0.949], pal.p, 0.1);
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: c3(shellBase), roughness: 0.42, metalness: 0.1, clearcoat: 0.45, clearcoatRoughness: 0.45,
    sheen: 0.7, sheenRoughness: 0.5, sheenColor: c3(mixRgb(pal.p, pal.a, 0.3)),
  });
  const shellGeo = new THREE.ExtrudeGeometry(rrect(3.0, 1.55, 0.62), { depth: 0.9, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.2, bevelSegments: 6, curveSegments: 16 });
  shellGeo.translate(0, 0, -0.9);
  head.add(new THREE.Mesh(bend(shellGeo, 0.12), shellMat));
  const visorGeo = new THREE.ExtrudeGeometry(rrect(2.78, 1.36, 0.55), { depth: 0.04, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4, curveSegments: 16 });
  const visorMat = new THREE.MeshPhysicalMaterial({ color: 0x05030c, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 });
  head.add(new THREE.Mesh(bend(visorGeo, 0.12, 0.2), visorMat));
  const eyeMat = new THREE.ShaderMaterial({
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: EYES_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uLook: { value: new THREE.Vector2() }, uLid: { value: 0 }, uHappy: { value: 0 },
      uIris: { value: v3(pal.a) }, uGlow: { value: v3(mixRgb(pal.p, pal.a, 0.5)) },
    },
  });
  const screen = new THREE.Mesh(bend(new THREE.PlaneGeometry(2.5, 1.25, 24, 1), 0.12, 0.17), eyeMat);
  screen.renderOrder = 2;
  head.add(screen);
  const strapMat = new THREE.MeshStandardMaterial({ color: c3(pal.dark ? mixRgb([0.227, 0.165, 0.333], pal.p, 0.15) : mixRgb([0.81, 0.776, 0.878], pal.p, 0.1)), roughness: 0.85 });
  const strapCurve = new THREE.CatmullRomCurve3([[-1.62, 0, -0.6], [-1.9, 0.05, -1.6], [-1.2, 0.1, -2.6], [0, 0.12, -2.95], [1.2, 0.1, -2.6], [1.9, 0.05, -1.6], [1.62, 0, -0.6]].map((v) => new THREE.Vector3(...v)));
  const strap = new THREE.Mesh(new THREE.TubeGeometry(strapCurve, 48, 0.16, 8, false), strapMat);
  strap.scale.y = 1.6;
  head.add(strap);
  const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.42, 4, 10), new THREE.MeshBasicMaterial({ color: c3(pal.a) }));
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.72, 0.18);
  head.add(bar);

  // Reflections from a small painted environment, like the homepage
  const envC = document.createElement('canvas');
  envC.width = 256;
  envC.height = 128;
  const g = envC.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#1d1236'); grd.addColorStop(0.55, '#2a1440'); grd.addColorStop(1, '#07040d');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 128);
  const blob = (x, y, r, col) => { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, 256, 128); };
  blob(60, 34, 48, 'rgba(255,255,255,.95)');
  blob(130, 20, 30, 'rgba(255,255,255,.7)');
  blob(190, 30, 60, css(pal.a));
  blob(30, 80, 60, css(pal.p));
  const envTex = new THREE.CanvasTexture(envC);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromEquirectangular(envTex);
  envTex.dispose();
  pmrem.dispose();
  [shellMat, visorMat, strapMat].forEach((m) => { m.envMap = envRT.texture; m.needsUpdate = true; });

  const lights = new THREE.Group();
  lights.add(new THREE.HemisphereLight(0xb9a6ff, 0x1a0b25, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-3, 4, 5);
  const rimA = new THREE.DirectionalLight(c3(pal.a), 2.5);
  rimA.position.set(4, 1, -3);
  const rimP = new THREE.DirectionalLight(c3(pal.p), 2.0);
  rimP.position.set(-4, -1, -2);
  lights.add(key, rimA, rimP);

  const state = { yaw: 0, pitch: 0, vy: 0, vp: 0, look: new THREE.Vector2(), lid: 0, blinkT: -1, nextBlink: 2, happy: 0 };
  const tmp = new THREE.Vector3();
  const local = new THREE.Vector3();
  return {
    root, lights,
    update(dt, t, headPos, pointPos, happyTarget) {
      // Head turns toward the viewer, eyes toward whatever is being pointed at
      root.worldToLocal(local.copy(headPos));
      const ty = clamp(Math.atan2(local.x, local.z), -0.6, 0.6);
      const tp = clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.5, 0.5);
      state.vy += (ty - state.yaw) * 40 * dt; state.vy *= Math.pow(0.002, dt); state.yaw += state.vy * dt * 3;
      state.vp += (tp - state.pitch) * 40 * dt; state.vp *= Math.pow(0.002, dt); state.pitch += state.vp * dt * 3;
      head.rotation.set(state.pitch, state.yaw, -state.yaw * 0.08);
      let lx = 0;
      let ly = 0;
      if (pointPos) {
        head.worldToLocal(tmp.copy(pointPos));
        lx = clamp(Math.atan2(tmp.x, tmp.z) / 0.5, -1, 1);
        ly = clamp(Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z)) / 0.4, -1, 1);
      }
      state.look.x += (lx - state.look.x) * damp(10, dt);
      state.look.y += (ly - state.look.y) * damp(10, dt);
      eyeMat.uniforms.uLook.value.copy(state.look);
      if (!REDUCE) {
        head.position.y = Math.sin(t * 1.4) * 0.012;
        if (t > state.nextBlink && state.blinkT < 0) state.blinkT = 0;
        if (state.blinkT >= 0) {
          state.blinkT += dt;
          state.lid = state.blinkT < 0.07 ? state.blinkT / 0.07 : Math.max(0, 1 - (state.blinkT - 0.07) / 0.08);
          if (state.blinkT > 0.15) { state.blinkT = -1; state.lid = 0; state.nextBlink = t + 2 + Math.random() * 3; }
        }
      }
      state.happy += (happyTarget * 0.45 - state.happy) * damp(12, dt);
      eyeMat.uniforms.uLid.value = state.lid;
      eyeMat.uniforms.uHappy.value = state.happy;
    },
    dispose() { envRT.dispose(); },
  };
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const canvas = $('vrCanvas');
const overlay = $('vrOverlay');
const hint = $('vrOverlayHint');
const enterBtn = $('enterVrBtn');
const previewBtn = $('previewBtn');
const hudTop = $('vrHudTop');
const hudBottom = $('vrHudBottom');
const hudVrBtn = $('hudVrBtn');
const motionBtn = $('motionBtn');
const a11y = $('vrA11y');

let renderer;
let scene;
let camera;
let ui;
let env;
let mascot;
let pal;
let styles;
let xrSupported = false;
let xrSession = null;
let pendingNav = null;
let dim = 0;
let dimT = 0;
let detail = null;
let focused = null;
const view = { yaw: 0, pitch: -4 * DEG, ty: 0, tp: -4 * DEG };

function setHint(t) { if (hint) hint.textContent = t; }

async function boot() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch {
    setHint('This browser could not start WebGL, so the 3D space is unavailable.');
    previewBtn.hidden = true;
    return;
  }
  maxAniso = renderer.capabilities.getMaxAnisotropy();
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFoveation(1);

  pal = readTheme();
  styles = makeStyles(pal);
  scene = new THREE.Scene();
  scene.background = new THREE.Color().setRGB(...pal.skyHor, THREE.SRGBColorSpace);
  camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.02, 200);
  camera.position.set(0, EYE, 0);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  resize();

  env = buildEnvironment(renderer, scene, pal);
  ui = new THREE.Group();
  scene.add(ui);
  mascot = buildMascot(renderer, pal);
  mascot.root.position.set(0, 2.2, -2.03);
  ui.add(mascot.root);
  scene.add(mascot.lights);

  detectXR();
  setupInput();
  setupControllers();
  addEventListener('resize', resize);

  let data;
  let projects;
  try {
    const [a, b] = await Promise.all([fetch('assets/vr-lobby.json').then((r) => r.json()), fetch('assets/projects.json').then((r) => r.json())]);
    data = a;
    projects = b.projects || [];
  } catch {
    setHint('Could not load the portfolio content. The 2D site still works.');
  }
  if (data) buildUI(data, projects);
  renderer.setAnimationLoop(frame);
  window.__vrLobby.ready = true;
}

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  const aspect = w / h;
  // Keep about 90 degrees across on wide screens and enough of the hero on phones
  const hfov = aspect >= 1.2 ? 80 : 50;
  camera.fov = clamp(2 * Math.atan(Math.tan((hfov * DEG) / 2) / aspect) / DEG, 50, 92);
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  if (!renderer.xr.isPresenting) renderer.setSize(w, h, false);
}

// ---------------------------------------------------------------------------
// UI construction
// ---------------------------------------------------------------------------
const go = (link) => {
  if (!link || !link.href) return;
  if (xrSession) {
    // Leave the headset first; the page changes once the session has ended
    pendingNav = link.href;
    xrSession.end().catch(() => { location.href = link.href; });
    return;
  }
  if (link.external) {
    const w = window.open(link.href, '_blank', 'noopener');
    if (!w) location.href = link.href;
  } else location.href = link.href;
};

function addA11y(panel, kind, label, link) {
  const el = document.createElement(link ? 'a' : 'button');
  el.textContent = label;
  if (link) {
    el.href = link.href;
    if (link.external) { el.target = '_blank'; el.rel = 'noopener'; }
  } else {
    el.type = 'button';
    el.addEventListener('click', () => panel.onSelect && panel.onSelect());
  }
  el.dataset.kind = kind;
  el.addEventListener('focus', () => setFocus(panel, true));
  el.addEventListener('blur', () => { if (focused === panel) setFocus(null); });
  panel.a11y = el;
  a11y.appendChild(el);
  return el;
}

function setFocus(panel, turn) {
  if (focused && focused !== panel) focused.focusT = 0;
  focused = panel;
  if (panel) {
    panel.focusT = 1;
    if (turn && !renderer.xr.isPresenting) lookAtPanel(panel);
  }
}
const _wp = new THREE.Vector3();
function lookAtPanel(panel) {
  panel.item.getWorldPosition(_wp);
  const dx = _wp.x - camera.position.x;
  const dy = _wp.y - camera.position.y;
  const dz = _wp.z - camera.position.z;
  let yaw = Math.atan2(-dx, -dz);
  // Shortest turn from where the view is now
  while (yaw - view.ty > Math.PI) yaw -= Math.PI * 2;
  while (yaw - view.ty < -Math.PI) yaw += Math.PI * 2;
  view.ty = yaw;
  view.tp = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -1.1, 1.1);
}

// Angle in degrees covered by an arc of `m` metres at radius `r`
const arcDeg = (m, r = R) => (m / r) / DEG;

function buildUI(data, projects) {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const HERO_W = 1.64;
  const COL_W = 0.675;
  const GAP = 0.05;
  const ARC_W = COL_W * 2 + GAP;
  const sideStart = arcDeg(HERO_W / 2) + 4.2; // degrees from centre to the side arcs
  const centerY = 1.47;

  // ----- Hero -----
  const hero = layoutHero(data.hero, pal, HERO_W);
  const heroPanel = new Panel({
    parent: ui, key: 'hero', theta: 0, y: centerY, w: hero.w, h: hero.h, radius: 0.07, margin: 0.07,
    style: styles.glass, paint: (ctx, s) => runOps(ctx, s, hero.ops, pal),
  });
  mascot.root.position.y = centerY + hero.h / 2 + 0.26;

  // Shrink the button row until it fits inside the hero
  const ctaGap = 0.028;
  let ctaSize = SZ.label;
  let ctaLayouts;
  let total;
  do {
    ctaLayouts = data.ctas.map((c) => ({ c, l: layoutButton(c.label, c.icon, pal, c.primary, ctaSize) }));
    total = ctaLayouts.reduce((s, x) => s + x.l.w, 0) + ctaGap * (ctaLayouts.length - 1);
    ctaSize *= 0.97;
  } while (total > HERO_W - 0.14 && ctaSize > 0.042);
  let x = (HERO_W - total) / 2;
  const btnY = hero.h / 2 - hero.buttonsTop - 0.065;
  for (const { c, l } of ctaLayouts) {
    const cx = x + l.w / 2 - HERO_W / 2;
    const p = new Panel({
      parent: heroPanel, key: `cta:${c.label}`, theta: arcDeg(cx), y: btnY, w: l.w, h: l.h, radius: l.h / 2, margin: 0.04, lift: 0.02,
      style: c.primary ? styles.primary : styles.button, paint: (ctx, s) => runOps(ctx, s, l.ops, pal),
      onSelect: () => go(c), label: c.label,
    });
    addA11y(p, 'cta', c.label, c);
    x += l.w + ctaGap;
  }

  // ----- Left arc: featured projects, two by two with paging -----
  const featured = data.featured.items
    .map((it) => {
      const p = byId.get(it.id);
      if (!p) return null;
      return { item: it, project: { ...p, image: (p.images || [])[0] || '', tags: (p.tags || []).filter((t) => t !== 'Personal') } };
    })
    .filter(Boolean);
  const perPage = 4;
  const pages = Math.max(1, Math.ceil(featured.length / perPage));
  let page = 0;
  const CARD_H = 0.75;
  const blockH = CARD_H * 2 + GAP;
  const leftStart = -(sideStart + arcDeg(ARC_W));
  const colTheta = (c, startDeg) => startDeg + arcDeg(c * (COL_W + GAP) + COL_W / 2);
  const cards = [];
  for (let i = 0; i < perPage; i++) {
    const row = (i / 2) | 0;
    const col = i % 2;
    const card = new Panel({
      parent: ui, key: `card:${i}`, theta: colTheta(col, leftStart), y: centerY + blockH / 2 - CARD_H / 2 - row * (CARD_H + GAP),
      w: COL_W, h: CARD_H, radius: 0.05, margin: 0.06, lift: 0.0, style: styles.card,
      paint: (ctx, s, self) => { if (self.entry) runOps(ctx, s, layoutCard(self.entry.item, self.entry.project, pal, COL_W, CARD_H), pal); },
      onSelect: () => { if (card.entry) openDetail(card.entry, card); },
    });
    cards.push(card);
    addA11y(card, 'card', '');
  }
  const showPage = (n, animate) => {
    page = (n + pages) % pages;
    cards.forEach((card, i) => {
      const entry = featured[page * perPage + i] || null;
      card.entry = entry;
      card.visible = !!entry;
      card.onSelect = entry ? () => openDetail(entry, card) : null;
      if (card.a11y) {
        card.a11y.textContent = entry ? `Project: ${entry.item.title}. ${entry.item.line}` : '';
        card.a11y.hidden = !entry;
      }
      card.repaint();
      if (animate && !REDUCE) card.fade = 0;
      // Repaint again when the image arrives
      const img = entry && loadImage(entry.project.image);
      if (img && !img.ok && !img.failed) img.waiters.push(() => { if (card.entry === entry) card.repaint(); });
    });
    pageLabel.repaint();
  };

  // Header row above the cards
  const headerY = centerY + blockH / 2 + 0.1;
  const headerLabel = (str, startDeg, key) => {
    const w = mw(str, SZ.title + 0.004, 700) + 0.04;
    return new Panel({
      parent: ui, key, theta: startDeg + arcDeg(w / 2), y: headerY, w, h: 0.12, margin: 0.01, style: styles.label,
      paint: (ctx, s) => runOps(ctx, s, [text(str, 0.0, 0.088, SZ.title + 0.004, { weight: 700, color: pal.text, track: -0.01 })], pal),
    });
  };
  headerLabel(data.featured.title, leftStart, 'head:featured');
  const leftEnd = -sideStart;
  const pagerSize = 0.105;
  const pageLabelW = 0.17;
  const mkRound = (icon, deg, key, label, onSelect) => {
    const p = new Panel({
      parent: ui, key, theta: deg, y: headerY, w: pagerSize, h: pagerSize, radius: pagerSize / 2, margin: 0.03, style: styles.button,
      paint: (ctx, s) => runOps(ctx, s, [{ t: 'icon', name: icon, x: pagerSize * 0.2, y: pagerSize * 0.2, size: pagerSize * 0.6, color: pal.text, weight: 2.2 }], pal),
      onSelect, label,
    });
    addA11y(p, 'pager', label);
    return p;
  };
  const nextDeg = leftEnd - arcDeg(pagerSize / 2);
  const labelDeg = nextDeg - arcDeg(pagerSize / 2 + pageLabelW / 2);
  const prevDeg = labelDeg - arcDeg(pageLabelW / 2 + pagerSize / 2);
  const pageLabel = new Panel({
    parent: ui, key: 'pager:label', theta: labelDeg, y: headerY, w: pageLabelW, h: 0.1, margin: 0.01, style: styles.label,
    paint: (ctx, s) => runOps(ctx, s, [text(`${page + 1} / ${pages}`, pageLabelW / 2, 0.07, SZ.small, { weight: 600, color: pal.muted, align: 'center' })], pal),
  });
  if (pages > 1) {
    mkRound('chevL', prevDeg, 'pager:prev', 'Previous projects', () => showPage(page - 1, true));
    mkRound('chevR', nextDeg, 'pager:next', 'More projects', () => showPage(page + 1, true));
  } else pageLabel.visible = false;
  showPage(0, false);

  // ----- Right arc: experience and the labs -----
  const rightStart = sideStart;
  headerLabel(data.experience.title, rightStart, 'head:experience');
  const exp = layoutExperience(data.experience, pal, ARC_W);
  const expTop = centerY + blockH / 2;
  new Panel({
    parent: ui, key: 'experience', theta: rightStart + arcDeg(ARC_W / 2), y: expTop - exp.h / 2, w: ARC_W, h: exp.h, radius: 0.06, margin: 0.06,
    style: styles.glass, paint: (ctx, s) => runOps(ctx, s, exp.ops, pal),
  });
  // Social links at the end of the header row
  let end = rightStart + arcDeg(ARC_W);
  [...(data.links || [])].reverse().forEach((lnk) => {
    const l = layoutButton(lnk.label, lnk.icon, pal, false, 0.05);
    const deg = end - arcDeg(l.w / 2);
    const p = new Panel({
      parent: ui, key: `link:${lnk.label}`, theta: deg, y: headerY, w: l.w, h: l.h, radius: l.h / 2, margin: 0.03, style: styles.button,
      paint: (ctx, s) => runOps(ctx, s, l.ops, pal), onSelect: () => go(lnk), label: lnk.label,
    });
    addA11y(p, 'link', lnk.label, lnk);
    end = deg - arcDeg(l.w / 2 + 0.025);
  });
  const tileH = blockH - exp.h - GAP;
  (data.labs || []).slice(0, 2).forEach((lab, i) => {
    const entry = loadImage(lab.image);
    const tile = new Panel({
      parent: ui, key: `lab:${lab.title}`, theta: colTheta(i, rightStart), y: expTop - exp.h - GAP - tileH / 2,
      w: COL_W, h: tileH, radius: 0.05, margin: 0.06, style: styles.card,
      paint: (ctx, s) => runOps(ctx, s, layoutLabTile(lab, pal, COL_W, tileH), pal),
      onSelect: () => go(lab), label: lab.title,
    });
    if (entry && !entry.ok) entry.waiters.push(() => tile.repaint());
    addA11y(tile, 'lab', `${lab.title}: ${lab.line}`, lab);
  });

  // ----- Navigation dock below eye level, tilted toward the viewer -----
  const nav = data.nav || [];
  const itemW = 0.255;
  const itemH = 0.158;
  const dockPad = 0.018;
  const dockW = nav.length * itemW + (nav.length - 1) * 0.01 + dockPad * 2;
  const dockH = itemH + dockPad * 2;
  const dockY = Math.min(0.64, centerY - hero.h / 2 - 0.36);
  const dock = new Panel({
    parent: ui, key: 'dock', theta: 0, y: dockY, r: 2.0, w: dockW, h: dockH, radius: dockH / 2, margin: 0.06,
    style: styles.glass,
  });
  nav.forEach((n, i) => {
    const cx = dockPad + i * (itemW + 0.01) + itemW / 2 - dockW / 2;
    const icon = 0.054;
    const p = new Panel({
      parent: dock, key: `dock:${n.label}`, theta: arcDeg(cx, 2.0), y: 0, w: itemW, h: itemH, radius: 0.05, margin: 0.02, lift: 0.012,
      style: styles.ghost,
      paint: (ctx, s) => runOps(ctx, s, [
        { t: 'icon', name: n.icon, x: (itemW - icon) / 2, y: 0.026, size: icon, color: pal.text, weight: 1.9 },
        text(n.label, itemW / 2, 0.132, fitSize(n.label, 600, 0.046, 0.038, itemW - 0.024), { weight: 600, color: pal.muted, align: 'center' }),
      ], pal),
      onSelect: () => go(n), label: n.label,
    });
    addA11y(p, 'nav', n.label, n);
  });
}

// ---------------------------------------------------------------------------
// Project detail, opened in front of the viewer
// ---------------------------------------------------------------------------
const detailRoot = new THREE.Group();
function viewerPose(pos, dir) {
  const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  cam.getWorldPosition(pos);
  cam.getWorldDirection(dir);
  return cam;
}
function openDetail(entry, fromPanel) {
  closeDetail(true);
  const { project, item } = entry;
  const p = { ...project, title: project.title || item.title };
  const L = layoutDetail(p, pal);
  const r = 1.8;
  const k = r / R;
  const pos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  viewerPose(pos, dir);
  if (!detailRoot.parent) scene.add(detailRoot);
  detailRoot.position.set(pos.x, 0, pos.z);
  detailRoot.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
  const y = clamp(pos.y - 0.06, 0.9, 2.2);
  const main = new Panel({
    parent: detailRoot, layer: 'detail', key: 'detail', theta: 0, y, r, tilt: 0, scale: k, w: L.w, h: L.h, radius: 0.07, margin: 0.08,
    style: { ...styles.glass, fillA: v4(pal.glassA, 0.97), fillB: v4(pal.glassB, 0.98), glow: pal.glow + 0.12 },
    paint: (ctx, s) => runOps(ctx, s, L.ops, pal), renderOrder: 5,
  });
  const img = loadImage(p.image);
  if (img && !img.ok && !img.failed) img.waiters.push(() => { if (detail && detail.main === main) main.repaint(); });
  const links = [];
  if (p.caseStudy) links.push({ label: 'Open case study', href: p.caseStudy, icon: 'document', primary: true });
  else if (p.demo) links.push({ label: 'Open demo', href: p.demo, icon: 'external', primary: true, external: /^https?:/.test(p.demo) || /\.pdf$/i.test(p.demo) });
  else links.push({ label: 'View project', href: `projects.html#${p.id}`, icon: 'rocket', primary: true });
  if (p.github) links.push({ label: 'GitHub', href: p.github, icon: 'code', external: true });
  let bx = L.x0;
  const colW = L.w - L.x0 - 0.075;
  let bSize = SZ.label;
  let bl;
  do {
    bl = links.map((lnk) => layoutButton(lnk.label, lnk.icon, pal, lnk.primary, bSize));
    bSize *= 0.97;
  } while (bl.reduce((a, l) => a + l.w, 0) + 0.03 * (bl.length - 1) > colW && bSize > 0.04);
  const buttons = links.map((lnk, i) => {
    const l = bl[i];
    const cx = (bx + l.w / 2 - L.w / 2) * k;
    const by = (L.h / 2 - L.buttonsTop - 0.065) * k;
    bx += l.w + 0.03;
    const btn = new Panel({
      parent: main, layer: 'detail', key: `detail:${lnk.primary ? 'primary' : 'github'}`, theta: arcDeg(cx, r), y: by, scale: k,
      w: l.w, h: l.h, radius: l.h / 2, margin: 0.04, lift: 0.02 * k, style: lnk.primary ? styles.primary : styles.button,
      paint: (ctx, s) => runOps(ctx, s, l.ops, pal), renderOrder: 6, label: lnk.label,
      onSelect: () => go(lnk),
    });
    addA11y(btn, 'detail', `${lnk.label}: ${p.title}`, lnk);
    return btn;
  });
  // Round close button in the top right corner
  const cs = 0.11;
  const close = new Panel({
    parent: main, layer: 'detail', key: 'detail:close', theta: arcDeg((L.w / 2 - 0.075 - cs / 2 + 0.02) * k, r), y: (L.h / 2 - 0.075 - cs / 2 + 0.02) * k, scale: k,
    w: cs, h: cs, radius: cs / 2, margin: 0.03, lift: 0.02 * k, style: styles.button, renderOrder: 6, label: 'Close',
    paint: (ctx, s) => runOps(ctx, s, [{ t: 'icon', name: 'close', x: cs * 0.22, y: cs * 0.22, size: cs * 0.56, color: pal.text, weight: 2.2 }], pal),
    onSelect: () => closeDetail(),
  });
  addA11y(close, 'detail', `Close ${p.title}`);
  buttons.push(close);
  if (!REDUCE) { detailRoot.scale.setScalar(0.96); }
  detail = { main, buttons, from: fromPanel };
  dimT = 1;
  // Keyboard users land on the first action
  if (document.activeElement && document.activeElement.parentElement === a11y) buttons[0].a11y.focus();
}
function closeDetail(instant) {
  if (!detail) return;
  const d = detail;
  detail = null;
  dimT = 0;
  const back = d.from && d.from.a11y;
  const hadFocus = d.buttons.some((b) => b.a11y === document.activeElement);
  [d.main, ...d.buttons].forEach((p) => p.dispose());
  if (hadFocus && back && !instant) back.focus();
  if (focused && !panels.includes(focused)) focused = null;
}

// ---------------------------------------------------------------------------
// Input: mouse, touch, keyboard, phone motion
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const mouse = { active: false, hit: null, point: new THREE.Vector3(), down: null, dragging: false, x: 0, y: 0, lastMove: 0 };
const motion = { on: false, q: new THREE.Quaternion(), offset: 0, calibrated: false, has: false };

function pickTargets() {
  return interactives.filter((p) => p.visible && p.mesh.visible && (detail ? p.layer === 'detail' : p.layer === 'main'));
}
function hitTest(ray) {
  raycaster.ray.copy(ray);
  raycaster.far = 20;
  const list = pickTargets().map((p) => p.mesh);
  const hits = raycaster.intersectObjects(list, false);
  for (const h of hits) {
    const p = h.object.userData.panel;
    if (p && h.uv && p.contains(h.uv)) return { panel: p, point: h.point, distance: h.distance };
  }
  // Report where the ray meets any panel so the cursor can sit on it
  const all = panels.filter((p) => p.mesh.visible && p.mat.uniforms.uFillA.value.w > 0.05).map((p) => p.mesh);
  const any = raycaster.intersectObjects(all, false).find((h) => h.uv && h.object.userData.panel.contains(h.uv));
  return any ? { panel: null, point: any.point, distance: any.distance } : null;
}

function setupInput() {
  canvas.addEventListener('pointerdown', (e) => {
    if (renderer.xr.isPresenting) return;
    canvas.setPointerCapture(e.pointerId);
    mouse.down = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch, offset: motion.offset, t: performance.now() };
    mouse.dragging = false;
    updateMouse(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (renderer.xr.isPresenting) return;
    if (mouse.down) {
      const dx = e.clientX - mouse.down.x;
      const dy = e.clientY - mouse.down.y;
      if (!mouse.dragging && Math.hypot(dx, dy) > 6) mouse.dragging = true;
      if (mouse.dragging) {
        const k = (camera.fov * DEG) / innerHeight;
        if (motion.on) motion.offset = mouse.down.offset + dx * k;
        else {
          view.yaw = view.ty = mouse.down.yaw + dx * k;
          view.pitch = view.tp = clamp(mouse.down.pitch + dy * k, -1.2, 1.2);
        }
        canvas.classList.add('is-dragging');
      }
    }
    updateMouse(e);
  });
  const end = (e) => {
    if (!mouse.down) return;
    const wasDrag = mouse.dragging;
    mouse.down = null;
    mouse.dragging = false;
    canvas.classList.remove('is-dragging');
    if (wasDrag) return;
    updateMouse(e);
    const h = mouse.hit;
    if (h && h.panel) activate(h.panel);
    else if (detail) closeDetail();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', () => { mouse.down = null; mouse.dragging = false; canvas.classList.remove('is-dragging'); });
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !mouse.down) mouse.active = false; });

  addEventListener('keydown', (e) => {
    if (renderer.xr.isPresenting || !overlay.classList.contains('is-hidden')) return;
    const step = 22 * DEG;
    if (e.key === 'ArrowLeft') { view.ty += step; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { view.ty -= step; e.preventDefault(); }
    else if (e.key === 'ArrowUp') { view.tp = clamp(view.tp + 10 * DEG, -1.2, 1.2); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { view.tp = clamp(view.tp - 10 * DEG, -1.2, 1.2); e.preventDefault(); }
    else if (e.key === 'Escape' && detail) { closeDetail(); e.preventDefault(); }
    else if (e.key === 'Tab' && (document.activeElement === document.body || document.activeElement === canvas)) {
      const first = a11y.querySelector('a:not([hidden]), button:not([hidden])');
      if (first && !e.shiftKey) { first.focus(); e.preventDefault(); }
    }
  });

  // Phone motion, opt in (iOS needs a tap to grant it)
  if ('DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches) {
    motionBtn.hidden = false;
    motionBtn.addEventListener('click', async () => {
      if (motion.on) { motion.on = false; motionBtn.textContent = 'Use motion'; return; }
      try {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
          const res = await DeviceOrientationEvent.requestPermission();
          if (res !== 'granted') return;
        }
      } catch { return; }
      motion.on = true;
      motion.calibrated = false;
      motionBtn.textContent = 'Stop motion';
    });
    const zee = new THREE.Vector3(0, 0, 1);
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
    const euler = new THREE.Euler();
    addEventListener('deviceorientation', (e) => {
      if (!motion.on || e.alpha == null) return;
      const orient = ((screen.orientation && screen.orientation.angle) || window.orientation || 0) * DEG;
      euler.set(e.beta * DEG, e.alpha * DEG, -e.gamma * DEG, 'YXZ');
      motion.q.setFromEuler(euler).multiply(q1).multiply(q0.setFromAxisAngle(zee, -orient));
      motion.has = true;
    });
  }
}

function updateMouse(e) {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  mouse.active = true;
  mouse.lastMove = performance.now();
}

function activate(panel, source) {
  if (!panel || !panel.onSelect) return;
  panel.press = 1;
  if (source && source.gamepad && source.gamepad.hapticActuators && source.gamepad.hapticActuators[0]) {
    try { source.gamepad.hapticActuators[0].pulse(0.5, 30); } catch { /* not supported */ }
  }
  panel.onSelect();
}

// ---------------------------------------------------------------------------
// XR: session, controllers, hands
// ---------------------------------------------------------------------------
const controllers = [];
let addonsLoaded = null;

async function detectXR() {
  if ('xr' in navigator && window.isSecureContext) {
    try { xrSupported = await navigator.xr.isSessionSupported('immersive-vr'); } catch { xrSupported = false; }
  }
  if (xrSupported) {
    enterBtn.hidden = false;
    hudVrBtn.hidden = false;
    previewBtn.classList.remove('vr-btn--primary');
    setHint('Headset ready. Put it on and press Enter VR.');
    loadXRAddons();
  } else {
    previewBtn.classList.add('vr-btn--primary');
    setHint(!window.isSecureContext ? 'VR needs HTTPS. You can still look around in 3D.'
      : 'No VR headset found here. Open this page in a headset browser such as Quest Browser, or look around in 3D.');
  }
}

// Controller and hand models load from the WebXR input profiles CDN. They are
// optional: the lasers work without them.
function loadXRAddons() {
  if (addonsLoaded) return addonsLoaded;
  addonsLoaded = Promise.all([
    import('three/addons/webxr/XRControllerModelFactory.js'),
    import('three/addons/webxr/XRHandModelFactory.js'),
  ]).then(([cm, hm]) => {
    const cf = new cm.XRControllerModelFactory();
    const hf = new hm.XRHandModelFactory();
    controllers.forEach((c, i) => {
      const grip = renderer.xr.getControllerGrip(i);
      grip.add(cf.createControllerModel(grip));
      scene.add(grip);
      const hand = renderer.xr.getHand(i);
      hand.add(hf.createHandModel(hand, 'mesh'));
      scene.add(hand);
    });
  }).catch(() => null);
  return addonsLoaded;
}

function makeLaser(color) {
  const g = new THREE.CylinderGeometry(0.0012, 0.0024, 1, 8, 1, true);
  g.translate(0, 0.5, 0);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    vertexShader: 'varying float vT; void main() { vT = -position.z; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uColor; varying float vT; void main() { gl_FragColor = vec4(uColor, mix(0.9, 0.2, vT)); }`,
    uniforms: { uColor: { value: v3(color) } },
    transparent: true,
    depthWrite: false,
  });
  const laser = new THREE.Mesh(g, m);
  laser.renderOrder = 8;
  return laser;
}
function makeCursor() {
  const g = new THREE.CircleGeometry(0.011, 24);
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });
  const dot = new THREE.Mesh(g, m);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.016, 0.021, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false }));
  dot.add(ring);
  dot.renderOrder = 9;
  ring.renderOrder = 9;
  dot.visible = false;
  return dot;
}

function setupControllers() {
  for (let i = 0; i < 2; i++) {
    const c = renderer.xr.getController(i);
    const laser = makeLaser(i === 0 ? pal.a : pal.p);
    laser.visible = false;
    c.add(laser);
    const cursor = makeCursor();
    scene.add(cursor);
    const state = { c, laser, cursor, source: null, hit: null, down: null, pending: false, lastHover: null, bWas: false };
    c.addEventListener('connected', (e) => {
      state.source = e.data;
      laser.visible = e.data.targetRayMode === 'tracked-pointer';
    });
    c.addEventListener('disconnected', () => { state.source = null; laser.visible = false; cursor.visible = false; state.hit = null; });
    c.addEventListener('selectstart', () => { state.down = state.hit && state.hit.panel; state.pending = !state.down; });
    c.addEventListener('select', () => {
      const target = state.down || (state.hit && state.hit.panel);
      state.down = null;
      state.pending = false;
      if (target) activate(target, state.source);
      else if (detail) closeDetail();
    });
    c.addEventListener('selectend', () => { state.pending = false; });
    scene.add(c);
    controllers.push(state);
  }
}

const _m = new THREE.Matrix4();
const _ray = new THREE.Ray();
function updateControllers() {
  const hovered = [];
  for (const s of controllers) {
    if (!s.source || !renderer.xr.isPresenting) { s.cursor.visible = false; s.hit = null; continue; }
    _m.identity().extractRotation(s.c.matrixWorld);
    _ray.origin.setFromMatrixPosition(s.c.matrixWorld);
    _ray.direction.set(0, 0, -1).applyMatrix4(_m);
    const h = hitTest(_ray);
    s.hit = h;
    if (s.pending && h && h.panel) { s.down = h.panel; s.pending = false; }
    const len = h ? h.distance : 1.2;
    s.laser.scale.set(1, 1, len);
    if (h) {
      s.cursor.visible = true;
      s.cursor.position.copy(h.point).addScaledVector(_ray.direction, -0.006);
      s.cursor.lookAt(_ray.origin);
      s.cursor.scale.setScalar(clamp(h.distance / 2, 0.4, 1.6) * (h.panel ? 1.15 : 0.8));
    } else s.cursor.visible = false;
    if (h && h.panel) hovered.push(h.panel);
    if (h && h.panel && h.panel !== s.lastHover && s.source.gamepad && s.source.gamepad.hapticActuators && s.source.gamepad.hapticActuators[0]) {
      try { s.source.gamepad.hapticActuators[0].pulse(0.15, 12); } catch { /* not supported */ }
    }
    s.lastHover = h && h.panel;
    // B or Y closes the detail panel
    const gp = s.source.gamepad;
    const b = !!(gp && gp.buttons && gp.buttons[5] && gp.buttons[5].pressed);
    if (b && !s.bWas && detail) closeDetail();
    s.bWas = b;
  }
  return hovered;
}

async function enterVR() {
  if (!xrSupported || xrSession) return;
  try {
    const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'] });
    xrSession = session;
    let floor = true;
    try { await session.requestReferenceSpace('local-floor'); } catch { floor = false; }
    renderer.xr.setReferenceSpaceType(floor ? 'local-floor' : 'local');
    session.addEventListener('end', onSessionEnd);
    await renderer.xr.setSession(session);
    xrAlign = { frames: 0, floor };
    overlay.classList.add('is-hidden');
    hudTop.classList.add('is-hidden');
    hudBottom.classList.add('is-hidden');
  } catch (err) {
    xrSession = null;
    setHint('Could not start VR here. Try again from the headset browser over HTTPS.');
  }
}
let xrAlign = null;
function onSessionEnd() {
  xrSession = null;
  xrAlign = null;
  ui.position.set(0, 0, 0);
  env.floor.position.y = 0;
  env.floor.material.uniforms.uCenter.value.set(0, 0);
  camera.position.set(0, EYE, 0);
  controllers.forEach((s) => { s.cursor.visible = false; s.hit = null; });
  if (pendingNav) { const href = pendingNav; pendingNav = null; location.href = href; return; }
  overlay.classList.remove('is-hidden');
  resize();
}
// Once the headset pose is known, centre the layout on the viewer's real eye height
function alignToViewer() {
  if (!xrAlign || xrAlign.done) return;
  xrAlign.frames++;
  if (xrAlign.frames < 4) return;
  const cam = renderer.xr.getCamera();
  const p = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
  // With 'local-floor' y is the real eye height (seated or standing). A plain
  // 'local' space puts the head near y = 0, so the floor goes one eye height down.
  const offY = xrAlign.floor ? clamp(p.y - EYE, -0.7, 0.4) : p.y - EYE;
  ui.position.set(p.x, offY, p.z);
  env.floor.position.y = xrAlign.floor ? 0 : p.y - EYE;
  env.floor.material.uniforms.uCenter.value.set(p.x, p.z);
  xrAlign.done = true;
}

// ---------------------------------------------------------------------------
// Frame loop
// ---------------------------------------------------------------------------
let last = performance.now();
const camPos = new THREE.Vector3();
const _dir = new THREE.Vector3();
const yawQ = new THREE.Quaternion();
const up = new THREE.Vector3(0, 1, 0);
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  const xr = renderer.xr.isPresenting;
  if (!xr) {
    if (motion.on && motion.has) {
      if (!motion.calibrated) {
        const e = new THREE.Euler().setFromQuaternion(motion.q, 'YXZ');
        motion.offset = view.yaw - e.y;
        motion.calibrated = true;
      }
      yawQ.setFromAxisAngle(up, motion.offset);
      camera.quaternion.copy(yawQ).multiply(motion.q);
      const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      view.yaw = view.ty = e.y;
      view.pitch = view.tp = e.x;
    } else {
      const k = damp(REDUCE ? 30 : 9, dt);
      view.yaw += (view.ty - view.yaw) * k;
      view.pitch += (view.tp - view.pitch) * k;
      camera.rotation.set(view.pitch, view.yaw, 0, 'YXZ');
    }
  } else alignToViewer();

  // Pointers
  let hovered = [];
  let pointPos = null;
  if (xr) {
    hovered = updateControllers();
    const h = controllers.find((s) => s.hit);
    if (h) pointPos = h.hit.point;
  } else if (mouse.active && !mouse.dragging) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((mouse.x - r.left) / r.width) * 2 - 1, -((mouse.y - r.top) / r.height) * 2 + 1);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(ndc, camera);
    const h = hitTest(raycaster.ray);
    mouse.hit = h;
    if (h && h.panel) hovered.push(h.panel);
    if (h && performance.now() - mouse.lastMove < 4000) pointPos = h.point;
    canvas.classList.toggle('is-pointing', !!(h && h.panel));
  }
  for (const p of interactives) p.hoverT = hovered.includes(p) ? 1 : 0;
  if (focused && !pointPos) { focused.item.getWorldPosition(_wp); pointPos = _wp; }

  dim += (dimT - dim) * damp(REDUCE ? 40 : 8, dt);
  if (detail) detailRoot.scale.lerp(new THREE.Vector3(1, 1, 1), damp(REDUCE ? 40 : 12, dt));
  for (const p of panels) p.update(dt, dim);

  const cam = xr ? renderer.xr.getCamera() : camera;
  cam.getWorldPosition(camPos);
  env.update(t, camPos);
  mascot.update(dt, t, camPos, pointPos, hovered.length || (focused ? 1 : 0) ? 1 : 0);

  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// Overlay and HUD
// ---------------------------------------------------------------------------
function startPreview() {
  overlay.classList.add('is-hidden');
  hudTop.classList.remove('is-hidden');
  hudBottom.classList.remove('is-hidden');
  if (matchMedia('(pointer: coarse)').matches) $('vrTip').textContent = 'Drag to look around. Tap a card to open it.';
  setTimeout(() => hudBottom.classList.add('is-hidden'), 7000);
  canvas.focus({ preventScroll: true });
}
previewBtn.addEventListener('click', startPreview);
enterBtn.addEventListener('click', enterVR);
hudVrBtn.addEventListener('click', enterVR);
addEventListener('pagehide', (e) => {
  if (e.persisted || !renderer) return;
  renderer.setAnimationLoop(null);
  [...panels].forEach((p) => p.dispose());
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) [].concat(o.material).forEach((m) => m.dispose());
  });
  if (env) env.dispose();
  if (mascot) mascot.dispose();
  renderer.dispose();
});

// Small hook for automated checks: view direction and where an item is on screen
window.__vrLobby = {
  ready: false,
  view(yawDeg, pitchDeg = -4) {
    view.yaw = view.ty = yawDeg * DEG;
    view.pitch = view.tp = pitchDeg * DEG;
  },
  screen(key) {
    const p = panels.find((x) => x.key === key);
    if (!p) return null;
    camera.updateMatrixWorld();
    p.item.getWorldPosition(_wp);
    _wp.project(camera);
    return { x: ((_wp.x + 1) / 2) * innerWidth, y: ((1 - _wp.y) / 2) * innerHeight, z: _wp.z };
  },
  keys: () => panels.map((p) => p.key),
  detailOpen: () => !!detail,
};

boot();
