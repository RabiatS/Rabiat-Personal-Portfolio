// VR portfolio for vr.html, built on plain three.js and WebXR.
// Curved glass panels sit around the viewer at about 2.2 m. Every label is drawn
// into a canvas texture in Inter (self hosted in assets/vr/fonts, OFL), styled
// like the site's hero: weight 800 headings with tight tracking, pill tags and
// buttons. Textures are only drawn once the font has loaded, so text stays crisp
// and on brand in a headset. The sky is a nebula baked once into a texture, the floor is a
// shader grid that fades into the horizon, and the homepage headset mascot
// floats above the hero and watches whatever you point at.
// Inputs: XR controllers or hands (laser + pinch, grip to move panels, stick to
// snap turn and browse), mouse drag with inertia, wheel, click, arrow keys and
// Tab, touch drag, and phone motion. Quiet synthesized UI ticks, mutable.
// Content lives in assets/vr-lobby.json, project details in assets/projects.json.
import * as THREE from 'three';

const R = 2.2; // main radius in metres
const EYE = 1.6; // standing eye height the layout is designed for
const PPM = 900; // canvas pixels per metre of panel
const MAX_TEX = 2048;
const DEG = Math.PI / 180;
// 'InterVR' is declared with @font-face in vr.html; the rest is the site's stack
const FONT_FAMILY = 'InterVR';
const FONT = `${FONT_FAMILY}, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const FONT_WEIGHTS = [400, 500, 600, 700, 800];
const NATIVE_TRACK = typeof CanvasRenderingContext2D !== 'undefined' && 'letterSpacing' in CanvasRenderingContext2D.prototype;
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
  const rainbow = !plain && store('rainbowMode') === 'true';
  const W = [1, 1, 1];
  const K = [0, 0, 0];
  // Text on the brand gradient: black or white, whichever reads (like --on-primary)
  const lum = (c) => c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const onFill = 1.05 / (lum(mixRgb(p, a, 0.5)) + 0.05) >= 4.5 ? '#ffffff' : '#111111';
  // The site's .grad: white to #e0e7ff on the dark hero, the brand sweep in rainbow mode
  const rainbowGrad = [[1, 0, 0.43], [0.51, 0.22, 0.93], [0.23, 0.53, 1]];
  if (dark) {
    return {
      dark, p, a, onFill,
      grad: rainbow ? rainbowGrad : [[1, 1, 1], [0.878, 0.906, 1]],
      heading: '#ffffff', lead: 'rgba(255,255,255,0.86)', eyebrow: 'rgba(255,255,255,0.92)',
      text: '#f7f5fb', muted: '#bfb9ce', soft: '#8e889f',
      accentText: css(mixRgb(a, W, 0.35)),
      chip: 'rgba(255,255,255,0.05)', chipEdge: 'rgba(255,255,255,0.14)', chipText: 'rgba(255,255,255,0.94)',
      rule: 'rgba(255,255,255,0.09)',
      glassA: mixRgb([0.16, 0.14, 0.22], p, 0.06), glassB: mixRgb([0.08, 0.07, 0.12], p, 0.04), glassAlpha: [0.74, 0.8],
      btn: [1, 1, 1], btnAlpha: [0.1, 0.07],
      hoverTint: [0.3, 0.27, 0.4], edge: 0.26, glow: 0.12, sheen: 0.07,
      skyTop: [0.024, 0.02, 0.043], skyHor: mixRgb([0.1, 0.075, 0.16], p, 0.12), skyLow: [0.035, 0.03, 0.05],
      floor: [0.06, 0.05, 0.085], grid: mixRgb([0.6, 0.55, 0.8], p, 0.3), neb: 1,
    };
  }
  return {
    dark, p, a, onFill,
    grad: rainbow ? rainbowGrad : [[0.106, 0.09, 0.149], mixRgb(p, [0.106, 0.09, 0.149], 0.35)],
    heading: '#1b1726', lead: '#3d3850', eyebrow: '#544f63',
    text: '#1b1726', muted: '#544f63', soft: '#7a7489',
    accentText: css(mixRgb(a, K, 0.25)),
    chip: css(mixRgb([1, 1, 1], p, 0.09)), chipEdge: css(mixRgb([0.9, 0.9, 0.92], p, 0.22)), chipText: '#1b1726',
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
// Width in metres; `track` is letter spacing in em, as in CSS
function mw(str, size, weight = 400, track = 0) {
  measureCtx.font = fontOf(size * 1000, weight);
  return measureCtx.measureText(str).width / 1000 + track * size * Math.max(0, str.length - 1);
}
function fitSize(str, weight, size, min, maxW, track = 0) {
  let s = size;
  while (s > min && mw(str, s, weight, track) > maxW) s *= 0.97;
  return Math.max(s, min);
}
// Resolves true when every weight of the VR font is ready. `ready` gives up
// after a few seconds so the scene never waits forever; `done` settles later.
function loadFonts() {
  if (!document.fonts || !document.fonts.load) return { ready: Promise.resolve(false), done: Promise.resolve(false) };
  const done = Promise.all(FONT_WEIGHTS.map((w) => document.fonts.load(`${w} 64px ${FONT_FAMILY}`)))
    .then((list) => list.every((f) => f.length > 0))
    .catch(() => false);
  const ready = Promise.race([done, new Promise((res) => setTimeout(() => res(null), 3500))]);
  return { ready, done };
}
function ellipsize(str, size, weight, maxW, track = 0) {
  if (mw(str, size, weight, track) <= maxW) return str;
  let s = str;
  while (s.length > 1 && mw(`${s}...`, size, weight, track) > maxW) s = s.slice(0, -1).trimEnd();
  return `${s.replace(/[,.;:]$/, '')}...`;
}
function wrap(str, size, weight, maxW, maxLines = 99, track = 0) {
  const words = String(str).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (mw(test, size, weight, track) <= maxW || !line) { line = test; continue; }
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
  recenter: ['M12 5a7 7 0 1 1 0 14a7 7 0 1 1 0-14', 'M12 2.5v3', 'M12 18.5v3', 'M2.5 12h3', 'M18.5 12h3', 'M13.2 12a1.2 1.2 0 1 1-2.4 0a1.2 1.2 0 1 1 2.4 0'],
  sound: ['M4 9.5h3.5L12 5.5v13l-4.5-4H4z', 'M15.5 9.2a4 4 0 0 1 0 5.6', 'M18 6.8a7.4 7.4 0 0 1 0 10.4'],
  mute: ['M4 9.5h3.5L12 5.5v13l-4.5-4H4z', 'M16 9.5l5 5', 'M21 9.5l-5 5'],
  trigger: ['M12 3.5v6', 'M8.5 7.5 12 3.5l3.5 4', 'M7 13.5a5 5 0 0 0 10 0v-1H7z'],
  grip: ['M8 5.5v13', 'M12 4v16', 'M16 5.5v13'],
  stick: ['M12 4.5a3.2 3.2 0 1 1 0 6.4a3.2 3.2 0 1 1 0-6.4', 'M12 11v6', 'M7 19.5h10', 'M4.5 7.5 2.5 9.5l2 2', 'M19.5 7.5l2 2-2 2'],
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
      drawText(ctx, o, s);
    } else if (o.t === 'chip') {
      // Same proportions as the site's .tag: 13px text, 8px 16px padding, full pill
      rrPath(ctx, o.x * s, o.y * s, o.w * s, o.h * s, (o.h / 2) * s);
      ctx.fillStyle = pal.chip;
      ctx.fill();
      ctx.strokeStyle = pal.chipEdge;
      ctx.lineWidth = Math.max(1, 0.0024 * s);
      ctx.stroke();
      drawText(ctx, { str: o.str, x: o.x + o.w / 2, y: o.y + o.h / 2 + o.size * 0.36, size: o.size, weight: 500, color: pal.chipText, align: 'center' }, s);
    } else if (o.t === 'rule') {
      ctx.fillStyle = pal.rule;
      ctx.fillRect(o.x * s, o.y * s, Math.max(1, o.w * s), Math.max(1, (o.h || 0.002) * s));
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
// Text with CSS style letter spacing. Native canvas letterSpacing where the
// browser has it; otherwise each glyph is placed at the width of the text before
// it plus the spacing, which keeps kerning.
function drawText(ctx, o, s) {
  const size = o.size * s;
  const weight = o.weight || 400;
  const sp = (o.track || 0) * size;
  ctx.font = fontOf(size, weight);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const W = mw(o.str, o.size, weight, o.track || 0) * s;
  const x0 = o.align === 'center' ? o.x * s - W / 2 : o.align === 'right' ? o.x * s - W : o.x * s;
  const y = o.y * s;
  if (o.grad) {
    // linear-gradient(135deg, ...) across the text box, as on the site
    const H = size;
    const cx = x0 + W / 2;
    const cy = y - size * 0.36;
    const half = ((W + H) * 0.7071) / 2;
    const g = ctx.createLinearGradient(cx - half * 0.7071, cy - half * 0.7071, cx + half * 0.7071, cy + half * 0.7071);
    o.grad.forEach((c, i) => g.addColorStop(i / (o.grad.length - 1), css(c)));
    ctx.fillStyle = g;
  } else ctx.fillStyle = o.color;
  if (!sp) { ctx.fillText(o.str, x0, y); return; }
  if (NATIVE_TRACK) {
    ctx.letterSpacing = `${sp}px`;
    ctx.fillText(o.str, x0, y);
    ctx.letterSpacing = '0px';
    return;
  }
  for (let i = 0; i < o.str.length; i++) ctx.fillText(o.str[i], x0 + ctx.measureText(o.str.slice(0, i)).width + i * sp, y);
}
function text(str, x, y, size, opts = {}) { return { t: 'text', str, x, y, size, ...opts }; }
// Baseline for a line box whose top is at y (Inter cap height is about 0.73 em)
const base = (y, size, lh = 1.3) => y + size * (lh / 2 + 0.35);

function chipRow(tags, x, y, maxW, size, align = 'left') {
  const h = size * 2.4;
  const pad = size * 1.2;
  const gap = size * 0.6;
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
    this.parentPanel = parentPanel;
    // Movable group (hero, left, right, dock) this panel belongs to
    this.group = parentPanel ? parentPanel.group : o.group || null;
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
    this.rise = 0; // intro: 1 = starts lower, eases up to 0
    this.wait = 0; // intro stagger in seconds
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
    const k = REDUCE ? 30 : 11;
    this.hover += (this.hoverT - this.hover) * damp(k, dt);
    this.focus += (this.focusT - this.focus) * damp(k, dt);
    if (this.wait > 0) this.wait -= dt;
    else {
      this.fade += (this.fadeT - this.fade) * damp(REDUCE ? 40 : 7, dt);
      this.rise -= this.rise * damp(5.5, dt);
    }
    this.press = Math.max(0, this.press - dt * 4);
    const h = Math.max(this.hover, this.focus);
    const lifted = this.lift + 0.02 * h - 0.01 * Math.sin(Math.PI * this.press);
    this.item.position.copy(this.basePos).addScaledVector(this.normal, lifted);
    if (Math.abs(this.rise) > 0.0005) this.item.position.y -= 0.09 * this.rise;
    const sc = 1 + 0.018 * this.hover - 0.02 * Math.sin(Math.PI * this.press);
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
const SZ = { display: 0.14, h2: 0.082, title: 0.072, body: 0.062, label: 0.054, small: 0.052, tag: 0.046 };
// Tracking in em, matching the site: h1 -0.04, h2 and card titles a little looser
const TR = { display: -0.04, h2: -0.03, title: -0.02, eyebrow: 0.15 };

function layoutHero(d, pal, w) {
  const pad = 0.09;
  const inner = w - pad * 2;
  const cx = w / 2;
  const ops = [];
  let y = pad;
  // Eyebrow: uppercase, 600, wide tracking, like the site's .eyebrow
  ops.push(text(d.eyebrow.toUpperCase(), cx, base(y, SZ.tag), SZ.tag, { weight: 600, color: pal.eyebrow, align: 'center', track: TR.eyebrow }));
  y += SZ.tag * 1.3 + 0.03;
  // Both h1 lines share one size, weight 800 and -0.04em, as on the homepage
  const hs = Math.min(
    fitSize(d.name, 800, SZ.display, 0.08, inner, TR.display),
    fitSize(d.headline, 800, SZ.display, 0.08, inner, TR.display),
  );
  ops.push(text(d.name, cx, base(y, hs, 1.08), hs, { weight: 800, color: pal.heading, align: 'center', track: TR.display }));
  y += hs * 1.08;
  ops.push(text(d.headline, cx, base(y, hs, 1.08), hs, { weight: 800, grad: pal.grad, align: 'center', track: TR.display }));
  y += hs * 1.08 + 0.04;
  const lines = wrap(d.lead, SZ.body, 400, inner * 0.9, 3);
  for (const l of lines) {
    ops.push(text(l, cx, base(y, SZ.body, 1.5), SZ.body, { color: pal.lead, align: 'center' }));
    y += SZ.body * 1.5;
  }
  y += 0.03;
  const chips = chipRow(d.tags || [], pad, y, inner, SZ.tag, 'center');
  ops.push(...chips.ops);
  y += chips.h + 0.05;
  const buttonsTop = y;
  y += SZ.label * 2.8 + 0.08;
  return { w, h: y, ops, buttonsTop };
}

// Pill button with the site's .btn proportions (600 weight, generous padding)
function layoutButton(label, icon, pal, primary, size = SZ.label) {
  const padX = size * 1.45;
  const iconS = icon ? size * 1.1 : 0;
  const gap = icon ? size * 0.5 : 0;
  const tw = mw(label, size, 600);
  const w = padX * 2 + iconS + gap + tw;
  const h = size * 2.8;
  const color = primary ? pal.onFill : pal.text;
  const ops = [];
  if (icon) ops.push({ t: 'icon', name: icon, x: padX, y: (h - iconS) / 2, size: iconS, color, weight: 2 });
  ops.push(text(label, padX + iconS + gap, h / 2 + size * 0.36, size, { weight: 600, color }));
  return { w, h, ops };
}

function layoutCard(item, project, pal, w, h) {
  const pad = 0.032;
  const ops = [];
  const imgH = 0.27;
  const iw = w - pad * 2;
  ops.push({ t: 'img', entry: loadImage(project.image), x: pad, y: pad, w: iw, h: imgH, r: 0.026, label: project.title });
  let y = pad + imgH + 0.034;
  const ts = fitSize(item.title, 700, SZ.title, 0.058, iw, TR.title);
  ops.push(text(item.title, pad, base(y, ts, 1.15), ts, { weight: 700, color: pal.text, track: TR.title }));
  y += ts * 1.15 + 0.01;
  for (const l of wrap(item.line, SZ.body * 0.96, 400, iw, 2)) {
    ops.push(text(l, pad, base(y, SZ.body * 0.96, 1.32), SZ.body * 0.96, { color: pal.muted }));
    y += SZ.body * 0.96 * 1.32;
  }
  const chips = chipRow(project.tags.slice(0, 3), pad, h - pad - SZ.tag * 2.4, iw, SZ.tag);
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
    ops.push({ t: 'dot', x: padX + 0.012, y: y + 0.066 * 0.6, r: 0.011 });
    const tx = padX + 0.045;
    const whenW = mw(it.when, SZ.tag, 500);
    const roleW = inner - 0.045 - whenW - 0.04;
    const rs = fitSize(it.role, 700, 0.066, 0.046, roleW, -0.015);
    ops.push(text(ellipsize(it.role, rs, 700, roleW, -0.015), tx, base(y, 0.066, 1.2), rs, { weight: 700, color: pal.text, track: -0.015 }));
    ops.push(text(it.when, padX + inner, base(y, 0.066, 1.2), SZ.tag, { weight: 500, color: pal.soft, align: 'right' }));
    y += 0.066 * 1.2 + 0.006;
    const ls = fitSize(it.line, 400, 0.056, 0.048, inner - 0.045);
    ops.push(text(ellipsize(it.line, ls, 400, inner - 0.045), tx, base(y, 0.056, 1.3), ls, { color: pal.muted }));
    y += 0.056 * 1.3 + 0.052;
  });
  return { w, h: y - 0.052 + 0.05, ops };
}

function layoutLabTile(lab, pal, w, h) {
  const pad = 0.032;
  const iw = w - pad * 2;
  const imgH = h - pad * 2 - 0.27;
  const ops = [{ t: 'img', entry: loadImage(lab.image), x: pad, y: pad, w: iw, h: imgH, r: 0.026, label: lab.title }];
  let y = pad + imgH + 0.03;
  ops.push(text(lab.title, pad, base(y, SZ.title, 1.15), SZ.title, { weight: 700, color: pal.text, track: TR.title }));
  ops.push({ t: 'icon', name: 'external', x: w - pad - 0.05, y: y + 0.014, size: 0.05, color: pal.soft, weight: 2 });
  y += SZ.title * 1.15 + 0.008;
  for (const l of wrap(lab.line, 0.056, 400, iw, 2)) {
    ops.push(text(l, pad, base(y, 0.056, 1.32), 0.056, { color: pal.muted }));
    y += 0.056 * 1.32;
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
  // Leave room on the right for the close button
  const meta = [p.category, p.year].filter(Boolean).map(clean).join('  \u00b7  ');
  ops.push(text(ellipsize(meta.toUpperCase(), 0.042, 600, cw - 0.17, 0.12), x0, base(y, 0.042), 0.042, { weight: 600, color: pal.accentText, track: 0.12 }));
  y += 0.042 * 1.3 + 0.03;
  for (const l of wrap(clean(p.title), 0.09, 800, cw, 2, TR.h2)) {
    ops.push(text(l, x0, base(y, 0.09, 1.12), 0.09, { weight: 800, color: pal.heading, track: TR.h2 }));
    y += 0.09 * 1.12;
  }
  if (p.subtitle) {
    y += 0.008;
    for (const l of wrap(clean(p.subtitle), 0.058, 500, cw, 2)) {
      ops.push(text(l, x0, base(y, 0.058, 1.3), 0.058, { weight: 500, color: pal.text }));
      y += 0.058 * 1.3;
    }
  }
  y += 0.022;
  for (const l of wrap(clean(p.description), 0.055, 400, cw, 6)) {
    ops.push(text(l, x0, base(y, 0.055, 1.5), 0.055, { color: pal.muted }));
    y += 0.055 * 1.5;
  }
  y += 0.03;
  const chips = chipRow((p.tags || []).slice(0, 4), x0, y, cw, 0.044);
  ops.push(...chips.ops);
  y += chips.h + 0.045;
  y += SZ.label * 2.8 + pad;
  const h = Math.max(y, 0.88);
  ops.unshift({ t: 'img', entry: loadImage(p.image), x: pad, y: pad, w: imgW, h: h - pad * 2, r: 0.03, label: p.title });
  return { w, h, ops, x0, buttonsTop: h - pad - SZ.label * 2.8 };
}

// First visit in a headset: three short instructions
function layoutHint(pal) {
  const w = 1.36;
  const pad = 0.07;
  const ops = [];
  let y = pad;
  ops.push(text('GETTING AROUND', pad, base(y, 0.042), 0.042, { weight: 600, color: pal.accentText, track: 0.12 }));
  y += 0.042 * 1.3 + 0.03;
  const rows = [
    ['trigger', 'Point and pull the trigger to select.'],
    ['grip', 'Grip to move panels.'],
    ['stick', 'Stick to turn.'],
  ];
  for (const [icon, str] of rows) {
    ops.push({ t: 'icon', name: icon, x: pad, y: y + 0.004, size: 0.07, color: pal.text, weight: 1.9 });
    ops.push(text(str, pad + 0.1, base(y, 0.062, 1.25), 0.062, { weight: 600, color: pal.heading, track: -0.01 }));
    y += 0.062 * 1.25 + 0.03;
  }
  y += 0.01;
  ops.push(text('Hold B or Y to recenter. Pull the trigger to dismiss.', pad, base(y, 0.046), 0.046, { color: pal.muted }));
  y += 0.046 * 1.3 + pad;
  return { w, h: y, ops };
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
  // In front of the visor glass (front face at z 0.29) so the shell never cuts the eyes off
  const screen = new THREE.Mesh(bend(new THREE.PlaneGeometry(2.5, 1.2, 24, 1), 0.12, 0.305), eyeMat);
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
    update(dt, t, headPos, pointPos, happyTarget, intro = 0) {
      // Head turns toward the viewer, eyes toward whatever is being pointed at
      root.worldToLocal(local.copy(headPos));
      const ty = clamp(Math.atan2(local.x, local.z), -0.6, 0.6);
      const tp = clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.5, 0.5);
      state.yaw += (ty - state.yaw) * damp(5, dt);
      state.pitch += (tp - state.pitch) * damp(5, dt);
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
      // Intro: grows in and floats up into place
      root.scale.setScalar(1 - 0.35 * intro);
      head.position.y = -0.09 * intro;
      if (!REDUCE) {
        head.position.y += Math.sin(t * 1.4) * 0.012;
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
const hintEl = $('vrOverlayHint');
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
let dolly; // holds the camera and controllers; snap turn rotates it around the head
let ui;
let groups; // hero, left, right, dock: each can be grabbed and moved on the cylinder
let env;
let mascot;
let pal;
let styles;
let content = null;
let gallery = null;
let xrSupported = false;
let xrSession = null;
let pendingNav = null;
let dim = 0;
let dimT = 0;
let detail = null;
let closing = null;
let focused = null;
let firstHint = null;
let mascotIntro = 0;
let mascotWait = 0;
let frameId = 0;
const view = { yaw: 0, pitch: -4 * DEG, ty: 0, tp: -4 * DEG, vy: 0, vp: 0 };

// Scratch objects so the frame loop allocates nothing
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _d = new THREE.Vector3();
const _wp = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _ray = new THREE.Ray();
const _zero = new THREE.Vector3();
const _qi = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _euler = new THREE.Euler();
const _yawQ = new THREE.Quaternion();
const _hits = [];
const _targets = [];
const _hovered = [];

function setHint(t) { if (hintEl) hintEl.textContent = t; }

// ---------------------------------------------------------------------------
// Sound: tiny synthesized ticks, very quiet, muted state remembered
// ---------------------------------------------------------------------------
const sound = { ctx: null, on: store('vrSound') !== 'off', last: 0 };
function audio() {
  try {
    if (!sound.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      sound.ctx = new AC();
    }
    if (sound.ctx.state === 'suspended') sound.ctx.resume();
  } catch { return null; }
  return sound.ctx;
}
const TONES = {
  hover: { type: 'sine', f0: 1850, f1: 1500, peak: 0.014, len: 0.045 },
  click: { type: 'triangle', f0: 900, f1: 560, peak: 0.04, len: 0.08 },
  open: { type: 'sine', f0: 520, f1: 880, peak: 0.03, len: 0.14 },
  close: { type: 'sine', f0: 820, f1: 480, peak: 0.026, len: 0.12 },
  grab: { type: 'triangle', f0: 420, f1: 360, peak: 0.03, len: 0.07 },
  turn: { type: 'sine', f0: 300, f1: 240, peak: 0.018, len: 0.06 },
};
function tick(kind) {
  if (!sound.on) return;
  const ac = sound.ctx;
  if (!ac || ac.state !== 'running') return;
  const now = performance.now();
  if (kind === 'hover' && now - sound.last < 70) return;
  sound.last = now;
  const tone = TONES[kind] || TONES.click;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = tone.type;
  o.frequency.setValueAtTime(tone.f0, t);
  o.frequency.exponentialRampToValueAtTime(tone.f1, t + tone.len);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(tone.peak, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + tone.len);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + tone.len + 0.02);
}
function pulse(source, strength, ms) {
  const act = source && source.gamepad && source.gamepad.hapticActuators && source.gamepad.hapticActuators[0];
  if (!act) return;
  try { act.pulse(strength, ms); } catch { /* not supported */ }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
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
  dolly = new THREE.Group();
  scene.add(dolly);
  camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.02, 200);
  camera.position.set(0, EYE, 0);
  camera.rotation.order = 'YXZ';
  dolly.add(camera);
  resize();

  env = buildEnvironment(renderer, scene, pal);
  ui = new THREE.Group();
  scene.add(ui);
  groups = {};
  for (const k of ['hero', 'left', 'right', 'dock']) {
    const g = new THREE.Group();
    g.name = k;
    ui.add(g);
    groups[k] = g;
  }
  mascot = buildMascot(renderer, pal);
  mascot.root.position.set(0, 2.2, -2.03);
  groups.hero.add(mascot.root);
  scene.add(mascot.lights);
  camera.add(blink.mesh);
  scene.add(mouseCursor);

  detectXR();
  setupInput();
  setupControllers();
  addEventListener('resize', resize);

  const fonts = loadFonts();
  try {
    const [a, b] = await Promise.all([fetch('assets/vr-lobby.json').then((r) => r.json()), fetch('assets/projects.json').then((r) => r.json())]);
    content = { data: a, projects: b.projects || [] };
  } catch {
    setHint('Could not load the portfolio content. The 2D site still works.');
  }
  const fontState = await fonts.ready;
  if (content) {
    buildUI();
    playIntro(0.1);
    // Slow network: build with the fallback font now, then redraw in Inter
    if (fontState === null) fonts.done.then((ok) => { if (ok) rebuildUI(); });
  }
  renderer.setAnimationLoop(frame);
  window.__vrLobby.ready = true;
  window.__vrLobby.fontLoaded = fontState === true;
}

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  const aspect = w / h;
  // About 80 degrees across on wide screens, enough of the hero on phones
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
    el.addEventListener('click', () => { audio(); if (panel.onSelect) { tick('click'); panel.onSelect(); } });
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
function lookAtPanel(panel) {
  panel.item.getWorldPosition(_wp);
  camera.getWorldPosition(_v);
  const dx = _wp.x - _v.x;
  const dy = _wp.y - _v.y;
  const dz = _wp.z - _v.z;
  let yaw = Math.atan2(-dx, -dz);
  // Shortest turn from where the view is now
  while (yaw - view.ty > Math.PI) yaw -= Math.PI * 2;
  while (yaw - view.ty < -Math.PI) yaw += Math.PI * 2;
  view.ty = yaw;
  view.tp = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -1.1, 1.1);
  view.vy = view.vp = 0;
}

// Angle in degrees covered by an arc of `m` metres at radius `r`
const arcDeg = (m, r = R) => (m / r) / DEG;

function buildUI() {
  const { data, projects } = content;
  const byId = new Map(projects.map((p) => [p.id, p]));
  const HERO_W = 1.84;
  const COL_W = 0.64;
  const GAP = 0.05;
  const ARC_W = COL_W * 2 + GAP;
  const sideStart = arcDeg(HERO_W / 2) + 4.2; // degrees from centre to the side arcs
  const centerY = 1.47;

  // ----- Hero -----
  const hero = layoutHero(data.hero, pal, HERO_W);
  const heroPanel = new Panel({
    parent: groups.hero, group: groups.hero, key: 'hero', theta: 0, y: centerY, w: hero.w, h: hero.h, radius: 0.07, margin: 0.07,
    style: styles.glass, paint: (ctx, s) => runOps(ctx, s, hero.ops, pal),
  });
  mascot.root.position.y = centerY + hero.h / 2 + 0.26;

  // Shrink the button row until it fits inside the hero
  const ctaGap = 0.03;
  let ctaSize = SZ.label;
  let ctaLayouts;
  let total;
  do {
    ctaLayouts = data.ctas.map((c) => ({ c, l: layoutButton(c.label, c.icon, pal, c.primary, ctaSize) }));
    total = ctaLayouts.reduce((s, x) => s + x.l.w, 0) + ctaGap * (ctaLayouts.length - 1);
    ctaSize *= 0.98;
  } while (total > HERO_W - 0.16 && ctaSize > 0.042);
  let x = (HERO_W - total) / 2;
  const btnY = hero.h / 2 - hero.buttonsTop - ctaLayouts[0].l.h / 2;
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
  const CARD_H = 0.75;
  const blockH = CARD_H * 2 + GAP;
  const leftStart = -(sideStart + arcDeg(ARC_W));
  const colTheta = (c, startDeg) => startDeg + arcDeg(c * (COL_W + GAP) + COL_W / 2);
  const cards = [];
  gallery = { featured, cards, perPage, pages, page: 0, showPage: null };
  for (let i = 0; i < perPage; i++) {
    const row = (i / 2) | 0;
    const col = i % 2;
    const card = new Panel({
      parent: groups.left, group: groups.left, key: `card:${i}`, theta: colTheta(col, leftStart), y: centerY + blockH / 2 - CARD_H / 2 - row * (CARD_H + GAP),
      w: COL_W, h: CARD_H, radius: 0.05, margin: 0.06, lift: 0.0, style: styles.card,
      paint: (ctx, s, self) => { if (self.entry) runOps(ctx, s, layoutCard(self.entry.item, self.entry.project, pal, COL_W, CARD_H), pal); },
      onSelect: () => {},
    });
    cards.push(card);
    addA11y(card, 'card', '');
  }
  const showPage = (n, animate) => {
    const prev = gallery.page;
    gallery.page = (n + pages) % pages;
    const dir = Math.sign(n - prev) || 1;
    cards.forEach((card, i) => {
      const index = gallery.page * perPage + i;
      const entry = featured[index] || null;
      card.entry = entry;
      card.visible = !!entry;
      card.onSelect = entry ? () => openDetail(index, 'card') : null;
      if (card.a11y) {
        card.a11y.textContent = entry ? `Project: ${entry.item.title}. ${entry.item.line}` : '';
        card.a11y.hidden = !entry;
      }
      card.repaint();
      if (animate && !REDUCE) {
        // New page slides up into place, one card after another
        card.fade = 0;
        card.rise = dir > 0 ? 0.6 : -0.6;
        card.wait = i * 0.04;
      }
      const img = entry && loadImage(entry.project.image);
      if (img && !img.ok && !img.failed) img.waiters.push(() => { if (card.entry === entry) card.repaint(); });
    });
    pageLabel.repaint();
  };
  gallery.showPage = showPage;

  // Header rows above the side arcs: h2 style, 800 and tight tracking
  const headerY = centerY + blockH / 2 + 0.1;
  const headerLabel = (str, startDeg, key, group) => {
    const w = mw(str, SZ.h2, 800, TR.h2) + 0.04;
    return new Panel({
      parent: group, group, key, theta: startDeg + arcDeg(w / 2), y: headerY, w, h: 0.12, margin: 0.01, style: styles.label,
      paint: (ctx, s) => runOps(ctx, s, [text(str, 0.0, 0.09, SZ.h2, { weight: 800, color: pal.heading, track: TR.h2 })], pal),
    });
  };
  headerLabel(data.featured.title, leftStart, 'head:featured', groups.left);
  const leftEnd = -sideStart;
  const pagerSize = 0.105;
  const pageLabelW = 0.17;
  const mkRound = (icon, deg, key, label, onSelect) => {
    const p = new Panel({
      parent: groups.left, group: groups.left, key, theta: deg, y: headerY, w: pagerSize, h: pagerSize, radius: pagerSize / 2, margin: 0.03, style: styles.button,
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
    parent: groups.left, group: groups.left, key: 'pager:label', theta: labelDeg, y: headerY, w: pageLabelW, h: 0.1, margin: 0.01, style: styles.label,
    paint: (ctx, s) => runOps(ctx, s, [text(`${gallery.page + 1} / ${pages}`, pageLabelW / 2, 0.07, SZ.small, { weight: 600, color: pal.muted, align: 'center' })], pal),
  });
  if (pages > 1) {
    mkRound('chevL', prevDeg, 'pager:prev', 'Previous projects', () => pageCards(-1));
    mkRound('chevR', nextDeg, 'pager:next', 'More projects', () => pageCards(1));
  } else pageLabel.visible = false;
  showPage(0, false);

  // ----- Right arc: experience and the labs -----
  const rightStart = sideStart;
  headerLabel(data.experience.title, rightStart, 'head:experience', groups.right);
  const exp = layoutExperience(data.experience, pal, ARC_W);
  const expTop = centerY + blockH / 2;
  new Panel({
    parent: groups.right, group: groups.right, key: 'experience', theta: rightStart + arcDeg(ARC_W / 2), y: expTop - exp.h / 2, w: ARC_W, h: exp.h, radius: 0.06, margin: 0.06,
    style: styles.glass, paint: (ctx, s) => runOps(ctx, s, exp.ops, pal),
  });
  // Social links at the end of the header row
  let end = rightStart + arcDeg(ARC_W);
  [...(data.links || [])].reverse().forEach((lnk) => {
    const l = layoutButton(lnk.label, lnk.icon, pal, false, 0.046);
    const deg = end - arcDeg(l.w / 2);
    const p = new Panel({
      parent: groups.right, group: groups.right, key: `link:${lnk.label}`, theta: deg, y: headerY, w: l.w, h: l.h, radius: l.h / 2, margin: 0.03, style: styles.button,
      paint: (ctx, s) => runOps(ctx, s, l.ops, pal), onSelect: () => go(lnk), label: lnk.label,
    });
    addA11y(p, 'link', lnk.label, lnk);
    end = deg - arcDeg(l.w / 2 + 0.025);
  });
  const tileH = blockH - exp.h - GAP;
  (data.labs || []).slice(0, 2).forEach((lab, i) => {
    const entry = loadImage(lab.image);
    const tile = new Panel({
      parent: groups.right, group: groups.right, key: `lab:${lab.title}`, theta: colTheta(i, rightStart), y: expTop - exp.h - GAP - tileH / 2,
      w: COL_W, h: tileH, radius: 0.05, margin: 0.06, style: styles.card,
      paint: (ctx, s) => runOps(ctx, s, layoutLabTile(lab, pal, COL_W, tileH), pal),
      onSelect: () => go(lab), label: lab.title,
    });
    if (entry && !entry.ok) entry.waiters.push(() => tile.repaint());
    addA11y(tile, 'lab', `${lab.title}: ${lab.line}`, lab);
  });

  // ----- Navigation dock below eye level, tilted toward the viewer -----
  // Site navigation, a divider, then Recenter and the sound toggle
  const tools = [
    { label: 'Recenter', icon: 'recenter', action: () => recenter() },
    { label: 'Sound', icon: 'sound', toggle: true, action: () => toggleSound() },
  ];
  const items = [...(data.nav || []), { divider: true }, ...tools];
  const DR = 2.0;
  const itemH = 0.158;
  const dockPad = 0.018;
  const labelSize = 0.044;
  const widthOf = (n) => (n.divider ? 0.03 : Math.max(0.19, mw(n.toggle ? 'Muted' : n.label, labelSize, 600) + 0.07));
  const dockW = items.reduce((s, n) => s + widthOf(n), 0) + (items.length - 1) * 0.008 + dockPad * 2;
  const dockH = itemH + dockPad * 2;
  const dockY = Math.min(0.64, centerY - hero.h / 2 - 0.36);
  let dx = dockPad - dockW / 2;
  const dockOps = [];
  items.forEach((n) => { if (n.divider) dockOps.push({ t: 'rule', x: dx + dockW / 2 + 0.014, y: dockPad + 0.04, w: 0.0022, h: itemH - 0.08 }); dx += widthOf(n) + 0.008; });
  const dock = new Panel({
    parent: groups.dock, group: groups.dock, key: 'dock', theta: 0, y: dockY, r: DR, w: dockW, h: dockH, radius: dockH / 2, margin: 0.06,
    style: styles.glass, paint: (ctx, s) => runOps(ctx, s, dockOps, pal),
  });
  dx = dockPad - dockW / 2;
  items.forEach((n) => {
    const iw = widthOf(n);
    const cx = dx + iw / 2;
    dx += iw + 0.008;
    if (n.divider) return;
    const icon = 0.054;
    const p = new Panel({
      parent: dock, key: `dock:${n.label}`, theta: arcDeg(cx, DR), y: 0, w: iw, h: itemH, radius: 0.05, margin: 0.02, lift: 0.012,
      style: styles.ghost,
      paint: (ctx, s) => {
        const name = n.toggle ? (sound.on ? 'sound' : 'mute') : n.icon;
        const label = n.toggle ? (sound.on ? 'Sound' : 'Muted') : n.label;
        runOps(ctx, s, [
          { t: 'icon', name, x: (iw - icon) / 2, y: 0.026, size: icon, color: pal.text, weight: 1.9 },
          text(label, iw / 2, 0.132, fitSize(label, 600, labelSize, 0.036, iw - 0.024), { weight: 600, color: pal.muted, align: 'center' }),
        ], pal);
      },
      onSelect: () => (n.action ? n.action() : go(n)), label: n.label,
    });
    if (n.toggle) {
      gallery.soundItem = p;
      addA11y(p, 'tool', soundLabel());
    } else addA11y(p, n.action ? 'tool' : 'nav', n.label, n.action ? null : n);
  });
}

function rebuildUI() {
  closeDetail(true);
  finishClose();
  if (firstHint) { firstHint.dispose(); firstHint = null; }
  [...panels].forEach((p) => p.dispose());
  a11y.textContent = '';
  focused = null;
  buildUI();
  playIntro(0);
}

// Panels rise and fade in: hero first, then the side arcs from the centre out, dock last
function playIntro(base = 0) {
  for (const p of panels) {
    if (p.layer !== 'main') continue;
    const top = p.parentPanel || p;
    const theta = Math.abs(top.o.theta || 0);
    let order = 0;
    if (top.group === groups.dock) order = 0.45;
    else if (top.group !== groups.hero) order = 0.16 + (theta / 62) * 0.22 + clamp(2.4 - (top.o.y || 0), 0, 2) * 0.05;
    p.fade = 0;
    p.wait = REDUCE ? 0 : base + order + (p.parentPanel ? 0.12 : 0);
    p.rise = REDUCE || p.parentPanel ? 0 : 1;
  }
  mascotIntro = REDUCE ? 0 : 1;
  mascotWait = base + 0.15;
}

function pageCards(dir) {
  if (!gallery || gallery.pages < 2) return;
  gallery.showPage(gallery.page + dir, true);
  tick('click');
}
function soundLabel() { return sound.on ? 'Sound on. Select to mute.' : 'Sound muted. Select to unmute.'; }
function toggleSound() {
  sound.on = !sound.on;
  try { localStorage.setItem('vrSound', sound.on ? 'on' : 'off'); } catch { /* private mode */ }
  if (sound.on) { audio(); tick('click'); }
  if (gallery && gallery.soundItem) {
    gallery.soundItem.repaint();
    if (gallery.soundItem.a11y) gallery.soundItem.a11y.textContent = soundLabel();
  }
}

// ---------------------------------------------------------------------------
// Comfort: blink fade, snap turn, recenter
// ---------------------------------------------------------------------------
const blink = (() => {
  const mat = new THREE.MeshBasicMaterial({ color: 0x07060b, transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.BackSide });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 8), mat);
  mesh.renderOrder = 1000;
  mesh.frustumCulled = false;
  mesh.visible = false;
  return { mesh, mat, t: -1, fn: null };
})();
function blinkThen(fn) {
  if (blink.t >= 0) return false;
  blink.t = 0;
  blink.fn = fn;
  return true;
}
function updateBlink(dt) {
  if (blink.t < 0) return;
  blink.t += dt;
  const IN = 0.08;
  const HOLD = 0.04;
  const OUT = 0.14;
  let o;
  if (blink.t < IN) o = blink.t / IN;
  else {
    if (blink.fn) { const f = blink.fn; blink.fn = null; f(); }
    o = blink.t < IN + HOLD ? 1 : 1 - (blink.t - IN - HOLD) / OUT;
  }
  if (o <= 0) { blink.t = -1; blink.mesh.visible = false; return; }
  blink.mat.opacity = clamp(o, 0, 1);
  blink.mesh.visible = true;
}

// Rotate the viewer 30 degrees around their own head, hidden by a short blink
function snapTurn(sign) {
  const ok = blinkThen(() => {
    _v.copy(camera.position).applyMatrix4(dolly.matrixWorld);
    dolly.rotation.y += sign * 30 * DEG;
    dolly.updateMatrixWorld();
    _v2.copy(camera.position).applyMatrix4(dolly.matrixWorld);
    dolly.position.add(_v.sub(_v2));
    dolly.updateMatrixWorld();
  });
  if (ok) tick('turn');
}

// Put the layout back in front of wherever the viewer is facing
function recenter() {
  const apply = () => {
    for (const k in groups) { groups[k].rotation.y = 0; groups[k].position.y = 0; }
    if (renderer.xr.isPresenting) {
      const cam = renderer.xr.getCamera();
      _v.setFromMatrixPosition(cam.matrixWorld);
      cam.getWorldDirection(_d);
      ui.position.x = _v.x;
      ui.position.z = _v.z;
      ui.rotation.y = Math.atan2(-_d.x, -_d.z);
      env.floor.material.uniforms.uCenter.value.set(_v.x, _v.z);
    } else {
      ui.rotation.y = 0;
      view.ty = Math.round(view.ty / (Math.PI * 2)) * Math.PI * 2;
      view.tp = -4 * DEG;
      view.vy = view.vp = 0;
    }
  };
  if (renderer.xr.isPresenting) blinkThen(apply);
  else apply();
  tick('click');
}

// ---------------------------------------------------------------------------
// Project detail: flies out of its card, steps through projects, flies back
// ---------------------------------------------------------------------------
const detailRoot = new THREE.Group();
const detailFly = new THREE.Group();
detailRoot.add(detailFly);
const fly = { u: 1, target: 1, p0: new THREE.Vector3(), q0: new THREE.Quaternion(), s0: 1 };
const smoother = (u) => u * u * u * (u * (u * 6 - 15) + 10);

function cardFor(index) {
  if (!gallery) return null;
  const c = gallery.cards[index - gallery.page * gallery.perPage];
  return c && c.visible && c.entry === gallery.featured[index] ? c : null;
}
// Start transform for detailFly that lays the detail panel over `panel`
function flyFrom(panel, main) {
  detailFly.position.set(0, 0, 0);
  detailFly.quaternion.identity();
  detailFly.scale.setScalar(1);
  detailRoot.updateMatrixWorld(true);
  panel.item.updateWorldMatrix(true, false);
  _m.copy(detailRoot.matrixWorld).invert();
  _m2.copy(_m).multiply(main.item.matrixWorld).invert(); // rest of the detail, inverted
  const sc = panel.w / main.w;
  _m.multiply(panel.item.matrixWorld).multiply(new THREE.Matrix4().makeScale(sc, sc, sc)).multiply(_m2);
  _m.decompose(fly.p0, fly.q0, _s);
  fly.s0 = _s.x;
}
function applyFly() {
  const e = smoother(fly.u);
  detailFly.position.lerpVectors(fly.p0, _zero, e);
  detailFly.quaternion.slerpQuaternions(fly.q0, _qi, e);
  detailFly.scale.setScalar(fly.s0 + (1 - fly.s0) * e);
}
function updateFly(dt) {
  const speed = REDUCE ? 5 : 1 / 0.36;
  if (fly.target === 1 && fly.u < 1) { fly.u = Math.min(1, fly.u + speed * dt); applyFly(); }
  else if (fly.target === 0 && fly.u > 0) {
    fly.u = Math.max(0, fly.u - speed * dt);
    applyFly();
    if (fly.u === 0) finishClose();
  }
}
function viewerPose(pos, dir) {
  const cam = renderer.xr.isPresenting ? renderer.xr.getCamera() : camera;
  cam.getWorldPosition(pos);
  cam.getWorldDirection(dir);
  return cam;
}
function disposeDetail(d) { if (d) [d.main, ...d.buttons].forEach((p) => p.dispose()); }
function finishClose() {
  if (!closing) return;
  disposeDetail(closing);
  closing = null;
}

// mode: 'card' flies out of the card, 1 or -1 steps to the next or previous project
function openDetail(index, mode = 'card') {
  if (!gallery || !gallery.featured.length) return;
  const n = gallery.featured.length;
  index = ((index % n) + n) % n;
  const entry = gallery.featured[index];
  const active = document.activeElement;
  const keepRole = active && active.parentElement === a11y ? active.dataset.role || 'primary' : null;
  const stepping = !!detail && mode !== 'card';
  finishClose();
  disposeDetail(detail);
  detail = null;
  // The gallery follows along, so closing returns to the right card
  const pg = Math.floor(index / gallery.perPage);
  if (pg !== gallery.page) gallery.showPage(pg, false);
  const fromPanel = cardFor(index);

  const { project, item } = entry;
  const p = { ...project, title: project.title || item.title };
  const L = layoutDetail(p, pal);
  const r = 1.8;
  const k = r / R;
  if (!stepping) {
    viewerPose(_v, _d);
    if (!detailRoot.parent) scene.add(detailRoot);
    detailRoot.position.set(_v.x, 0, _v.z);
    detailRoot.rotation.set(0, Math.atan2(-_d.x, -_d.z), 0);
    detailRoot.userData.y = clamp(_v.y - 0.06, 0.9, 2.2);
  }
  const main = new Panel({
    parent: detailFly, layer: 'detail', key: 'detail', theta: 0, y: detailRoot.userData.y, r, tilt: 0, scale: k, w: L.w, h: L.h, radius: 0.07, margin: 0.08,
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
    const by = (L.h / 2 - L.buttonsTop - l.h / 2) * k;
    bx += l.w + 0.03;
    const role = lnk.primary ? 'primary' : 'github';
    const btn = new Panel({
      parent: main, layer: 'detail', key: `detail:${role}`, theta: arcDeg(cx, r), y: by, scale: k,
      w: l.w, h: l.h, radius: l.h / 2, margin: 0.04, lift: 0.02 * k, style: lnk.primary ? styles.primary : styles.button,
      paint: (ctx, s) => runOps(ctx, s, l.ops, pal), renderOrder: 6, label: lnk.label,
      onSelect: () => go(lnk),
    });
    addA11y(btn, 'detail', `${lnk.label}: ${p.title}`, lnk).dataset.role = role;
    return btn;
  });
  // Close in the top right corner; previous and next as large chevrons just
  // outside the left and right edges, with a counter underneath
  const round = (role, icon, label, cx, cy, cs, onSelect) => {
    const b = new Panel({
      parent: main, layer: 'detail', key: `detail:${role}`, theta: arcDeg(cx * k, r), y: cy * k, scale: k,
      w: cs, h: cs, radius: cs / 2, margin: 0.03, lift: 0.02 * k, style: styles.button, renderOrder: 6, label,
      paint: (ctx, s) => runOps(ctx, s, [{ t: 'icon', name: icon, x: cs * 0.22, y: cs * 0.22, size: cs * 0.56, color: pal.text, weight: 2.2 }], pal),
      onSelect,
    });
    addA11y(b, 'detail', role === 'close' ? `Close ${p.title}` : label).dataset.role = role;
    buttons.push(b);
  };
  const cs = 0.11;
  round('close', 'close', 'Close', L.w / 2 - 0.075 - cs / 2 + 0.02, L.h / 2 - 0.075 - cs / 2 + 0.02, cs, () => closeDetail());
  if (n > 1) {
    const ns = 0.14;
    round('prev', 'chevL', 'Previous project', -L.w / 2 - 0.09 - ns / 2, 0, ns, () => stepDetail(-1));
    round('next', 'chevR', 'Next project', L.w / 2 + 0.09 + ns / 2, 0, ns, () => stepDetail(1));
    const counter = `${index + 1} / ${n}`;
    const cw = mw(counter, 0.046, 600) + 0.11;
    const chH = 0.046 * 2.4;
    buttons.push(new Panel({
      parent: main, layer: 'detail', key: 'detail:counter', theta: 0, y: (-L.h / 2 - 0.035 - chH / 2) * k, scale: k, w: cw, h: chH, radius: chH / 2, margin: 0.02, lift: 0.01 * k,
      style: { ...styles.button, fillA: v4(pal.glassA, 0.9), fillB: v4(pal.glassB, 0.9) }, renderOrder: 6,
      paint: (ctx, s) => runOps(ctx, s, [text(counter, cw / 2, chH / 2 + 0.046 * 0.36, 0.046, { weight: 600, color: pal.muted, align: 'center' })], pal),
    }));
  }

  detail = { main, buttons, index };
  // Stepping swaps content quickly; opening from a card fades with the flight
  if (stepping && !REDUCE) for (const b of [main, ...buttons]) b.fade = 0.35;
  dimT = 1;
  fly.target = 1;
  if (REDUCE) { fly.u = 1; fly.p0.set(0, 0, 0); fly.q0.identity(); fly.s0 = 1; }
  else if (stepping) {
    // A short slide from the side the new project comes from
    fly.u = 0;
    fly.p0.set(mode * 0.22, 0, 0);
    fly.q0.identity();
    fly.s0 = 0.97;
  } else if (fromPanel) { flyFrom(fromPanel, main); fly.u = 0; }
  else { fly.u = 0; fly.p0.set(0, -0.04, 0.12); fly.q0.identity(); fly.s0 = 0.9; }
  applyFly();
  tick(stepping ? 'click' : 'open');
  // Keyboard users keep their place
  if (keepRole) {
    const b = buttons.find((x) => x.a11y && x.a11y.dataset.role === keepRole) || buttons[0];
    if (b && b.a11y) b.a11y.focus();
  }
}
function stepDetail(dir) {
  if (detail) openDetail(detail.index + dir, dir);
}
function closeDetail(instant) {
  if (!detail) return;
  const d = detail;
  detail = null;
  dimT = 0;
  const back = cardFor(d.index);
  const hadFocus = d.buttons.some((b) => b.a11y === document.activeElement);
  for (const b of d.buttons) if (b.a11y) { b.a11y.remove(); b.a11y = null; }
  if (focused && (focused.layer === 'detail')) focused = null;
  if (hadFocus && back && back.a11y && !instant) back.a11y.focus();
  if (instant) { disposeDetail(d); return; }
  finishClose();
  for (const p of [d.main, ...d.buttons]) p.fadeT = 0;
  if (back && !REDUCE) flyFrom(back, d.main);
  else { fly.p0.set(0, REDUCE ? 0 : -0.04, REDUCE ? 0 : 0.1); fly.q0.identity(); fly.s0 = REDUCE ? 1 : 0.92; }
  fly.u = 1;
  fly.target = 0;
  closing = d;
  tick('close');
}

// ---------------------------------------------------------------------------
// First visit in a headset: a small hint that goes away on the first select
// ---------------------------------------------------------------------------
const hintRoot = new THREE.Group();
function showFirstHint() {
  if (store('vrHintSeen') === '1' || firstHint || !content) return;
  viewerPose(_v, _d);
  if (!hintRoot.parent) scene.add(hintRoot);
  hintRoot.position.set(_v.x, 0, _v.z);
  hintRoot.rotation.set(0, Math.atan2(-_d.x, -_d.z), 0);
  const L = layoutHint(pal);
  const r = 1.45;
  const drop = 0.36;
  firstHint = new Panel({
    parent: hintRoot, layer: 'hint', key: 'hint', theta: 0, y: _v.y - drop, r, tilt: Math.atan2(drop, r), scale: r / R, w: L.w, h: L.h, radius: 0.06, margin: 0.07,
    style: { ...styles.glass, fillA: v4(pal.glassA, 0.94), fillB: v4(pal.glassB, 0.95), glow: pal.glow + 0.1 },
    paint: (ctx, s) => runOps(ctx, s, L.ops, pal), renderOrder: 7,
  });
  firstHint.wait = REDUCE ? 0 : 0.9;
  firstHint.rise = REDUCE ? 0 : 1;
}
function dismissHint() {
  if (!firstHint) return;
  try { localStorage.setItem('vrHintSeen', '1'); } catch { /* private mode */ }
  const h = firstHint;
  firstHint = null;
  h.fadeT = 0;
  setTimeout(() => h.dispose(), 800);
}

// ---------------------------------------------------------------------------
// Hit testing, shared by the mouse and the controllers
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
raycaster.far = 20;
const ndc = new THREE.Vector2();
const newHit = () => ({ panel: null, surface: null, point: new THREE.Vector3(), distance: 0 });

// Fills `out` with the nearest interactive panel (or glass surface) on the ray
function hitTest(ray, out) {
  raycaster.ray.copy(ray);
  _targets.length = 0;
  for (const p of panels) {
    if (!p.mesh.visible || !p.visible) continue;
    if (detail ? p.layer !== 'detail' : p.layer === 'detail') continue;
    if (p.onSelect || p.mat.uniforms.uFillA.value.w > 0.05) _targets.push(p.mesh);
  }
  _hits.length = 0;
  raycaster.intersectObjects(_targets, false, _hits);
  for (const h of _hits) {
    const p = h.object.userData.panel;
    if (!h.uv || !p.contains(h.uv)) continue;
    out.panel = p.onSelect ? p : null;
    out.surface = p;
    out.point.copy(h.point);
    out.distance = h.distance;
    return true;
  }
  out.panel = null;
  out.surface = null;
  return false;
}

// Where a ray meets the cylinder of radius r around the layout's axis, in ui space
function rayCylinder(ray, r, out) {
  _m.copy(ui.matrixWorld).invert();
  const o = _v2.copy(ray.origin).applyMatrix4(_m);
  const d = _d.copy(ray.direction).transformDirection(_m);
  const a = d.x * d.x + d.z * d.z;
  const b = 2 * (o.x * d.x + o.z * d.z);
  const c = o.x * o.x + o.z * o.z - r * r;
  const disc = b * b - 4 * a * c;
  if (a < 1e-6 || disc < 0) return false;
  const t = (-b + Math.sqrt(disc)) / (2 * a);
  if (t <= 0) return false;
  out.copy(o).addScaledVector(d, t);
  return true;
}

// ---------------------------------------------------------------------------
// Input: mouse, touch, wheel, keyboard, phone motion
// ---------------------------------------------------------------------------
const mouse = { active: false, has: false, hit: newHit(), down: null, dragging: false, x: 0, y: 0, lastMove: 0 };
const motion = { on: false, q: new THREE.Quaternion(), offset: 0, calibrated: false, has: false };
const wheel = { acc: 0, lock: 0, last: 0 };

function setupInput() {
  canvas.addEventListener('pointerdown', (e) => {
    audio();
    if (renderer.xr.isPresenting) return;
    canvas.setPointerCapture(e.pointerId);
    updateMouse(e);
    const onDetail = !!(detail && pointerHit() && mouse.hit.surface && mouse.hit.surface.layer === 'detail');
    const now = performance.now();
    mouse.down = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch, offset: motion.offset, lastX: e.clientX, lastY: e.clientY, lastT: now, onDetail };
    mouse.dragging = false;
    view.vy = view.vp = 0;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (renderer.xr.isPresenting) return;
    const d = mouse.down;
    if (d) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!mouse.dragging && Math.hypot(dx, dy) > 6) mouse.dragging = true;
      if (mouse.dragging && !d.onDetail) {
        const k = (camera.fov * DEG) / innerHeight;
        if (motion.on) motion.offset = d.offset + dx * k;
        else {
          view.yaw = view.ty = d.yaw + dx * k;
          view.pitch = view.tp = clamp(d.pitch + dy * k, -1.2, 1.2);
          // Velocity for the glide after release
          const now = performance.now();
          const sec = Math.max(0.004, (now - d.lastT) / 1000);
          view.vy = view.vy * 0.6 + (((e.clientX - d.lastX) * k) / sec) * 0.4;
          view.vp = view.vp * 0.6 + (((e.clientY - d.lastY) * k) / sec) * 0.4;
          d.lastX = e.clientX;
          d.lastY = e.clientY;
          d.lastT = now;
        }
        canvas.classList.add('is-dragging');
      }
    }
    updateMouse(e);
  });
  const end = (e) => {
    const d = mouse.down;
    if (!d) return;
    const wasDrag = mouse.dragging;
    mouse.down = null;
    mouse.dragging = false;
    canvas.classList.remove('is-dragging');
    if (wasDrag) {
      const dx = e.clientX - d.x;
      // Swipe across the open detail to change project
      if (d.onDetail && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - d.y)) stepDetail(dx < 0 ? 1 : -1);
      if (REDUCE || performance.now() - d.lastT > 90) view.vy = view.vp = 0;
      return;
    }
    view.vy = view.vp = 0;
    updateMouse(e);
    if (pointerHit() && mouse.hit.panel) activate(mouse.hit.panel);
    else if (detail) closeDetail();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', () => { mouse.down = null; mouse.dragging = false; canvas.classList.remove('is-dragging'); });
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !mouse.down) mouse.active = false; });

  // Wheel or trackpad: browse the project cards, or step through the open detail
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const now = performance.now();
    if (now - wheel.last > 250) wheel.acc = 0;
    wheel.last = now;
    wheel.acc += Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (now < wheel.lock || Math.abs(wheel.acc) < 60) return;
    const dir = Math.sign(wheel.acc);
    wheel.acc = 0;
    wheel.lock = now + 420;
    if (detail) stepDetail(dir);
    else pageCards(dir);
  }, { passive: false });

  addEventListener('keydown', (e) => {
    audio();
    if (renderer.xr.isPresenting || !overlay.classList.contains('is-hidden')) return;
    const step = 22 * DEG;
    if (detail && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { stepDetail(e.key === 'ArrowRight' ? 1 : -1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { view.ty += step; view.vy = 0; e.preventDefault(); }
    else if (e.key === 'ArrowRight') { view.ty -= step; view.vy = 0; e.preventDefault(); }
    else if (e.key === 'ArrowUp') { view.tp = clamp(view.tp + 10 * DEG, -1.2, 1.2); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { view.tp = clamp(view.tp - 10 * DEG, -1.2, 1.2); e.preventDefault(); }
    else if (e.key === 'PageDown' || e.key === 'PageUp') { pageCards(e.key === 'PageDown' ? 1 : -1); e.preventDefault(); }
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
// Raycast from the mouse position now (also used on press and release)
function pointerHit() {
  const r = canvas.getBoundingClientRect();
  ndc.set(((mouse.x - r.left) / r.width) * 2 - 1, -((mouse.y - r.top) / r.height) * 2 + 1);
  camera.updateMatrixWorld();
  raycaster.setFromCamera(ndc, camera);
  _ray.copy(raycaster.ray);
  mouse.has = hitTest(_ray, mouse.hit);
  return mouse.has;
}

function activate(panel, source) {
  if (!panel || !panel.onSelect) return;
  panel.press = 1;
  pulse(source, 0.5, 30);
  tick('click');
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
      dolly.add(grip);
      const hand = renderer.xr.getHand(i);
      hand.add(hf.createHandModel(hand, 'mesh'));
      dolly.add(hand);
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
    fragmentShader: 'uniform vec3 uColor; uniform float uBoost; varying float vT; void main() { gl_FragColor = vec4(mix(uColor, vec3(1.0), uBoost * 0.4), mix(0.9, 0.2, vT)); }',
    uniforms: { uColor: { value: v3(color) }, uBoost: { value: 0 } },
    transparent: true,
    depthWrite: false,
  });
  const laser = new THREE.Mesh(g, m);
  laser.renderOrder = 8;
  return laser;
}
function makeCursor(size = 1) {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.011 * size, 24), m);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.016 * size, 0.021 * size, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false }));
  dot.add(ring);
  dot.renderOrder = 9;
  ring.renderOrder = 9;
  dot.visible = false;
  return dot;
}
// A soft ring on the panel under the mouse, as on a headset
const mouseCursor = makeCursor(0.9);

function setupControllers() {
  for (let i = 0; i < 2; i++) {
    const c = renderer.xr.getController(i);
    const laser = makeLaser(i === 0 ? pal.a : pal.p);
    laser.visible = false;
    c.add(laser);
    const cursor = makeCursor();
    scene.add(cursor);
    const state = {
      c, laser, cursor, source: null, hit: newHit(), has: false, down: null, pending: false, lastHover: null,
      b: { down: false, t: 0, fired: false }, stick: { x: false, y: false }, grab: null,
    };
    c.addEventListener('connected', (e) => {
      state.source = e.data;
      laser.visible = e.data.targetRayMode === 'tracked-pointer';
    });
    c.addEventListener('disconnected', () => { endGrab(state); state.source = null; laser.visible = false; cursor.visible = false; state.has = false; });
    c.addEventListener('selectstart', () => {
      audio();
      state.down = state.has ? state.hit.panel : null;
      state.pending = !state.down;
    });
    c.addEventListener('select', () => {
      const target = state.down || (state.has && state.hit.panel);
      state.down = null;
      state.pending = false;
      const hadHint = !!firstHint;
      dismissHint();
      if (target) activate(target, state.source);
      else if (detail) closeDetail();
      else if (hadHint) tick('click');
    });
    c.addEventListener('selectend', () => { state.pending = false; });
    c.addEventListener('squeezestart', () => startGrab(state));
    c.addEventListener('squeezeend', () => endGrab(state));
    dolly.add(c);
    controllers.push(state);
  }
}

// Grip on any panel moves its whole group around the viewer, on the cylinder
function startGrab(s) {
  if (detail || !s.has || !s.hit.surface || !s.hit.surface.group) return;
  const g = s.hit.surface.group;
  ui.updateMatrixWorld();
  _v.copy(s.hit.point);
  ui.worldToLocal(_v);
  s.grab = { g, r: Math.hypot(_v.x, _v.z), a0: Math.atan2(_v.x, -_v.z), y0: _v.y, rot0: g.rotation.y, gy0: g.position.y };
  for (const p of panels) if (p.group === g && !p.parentPanel) p.focusT = 1;
  pulse(s.source, 0.6, 25);
  tick('grab');
}
function updateGrab(s) {
  const gr = s.grab;
  if (!gr || !rayCylinder(_ray, gr.r, _v)) return;
  let da = Math.atan2(_v.x, -_v.z) - gr.a0;
  if (da > Math.PI) da -= Math.PI * 2;
  if (da < -Math.PI) da += Math.PI * 2;
  gr.g.rotation.y = clamp(gr.rot0 - da, -2.6, 2.6);
  gr.g.position.y = clamp(gr.gy0 + (_v.y - gr.y0), -0.6, 0.6);
}
function endGrab(s) {
  if (!s.grab) return;
  const g = s.grab.g;
  s.grab = null;
  for (const p of panels) if (p.group === g && p !== focused) p.focusT = 0;
  pulse(s.source, 0.3, 15);
}

function updateControllers(dt) {
  for (const s of controllers) {
    if (!s.source || !renderer.xr.isPresenting) { s.cursor.visible = false; s.has = false; continue; }
    _m.identity().extractRotation(s.c.matrixWorld);
    _ray.origin.setFromMatrixPosition(s.c.matrixWorld);
    _ray.direction.set(0, 0, -1).applyMatrix4(_m);
    updateGrab(s);
    const has = hitTest(_ray, s.hit);
    s.has = has;
    const panel = has ? s.hit.panel : null;
    if (s.pending && panel) { s.down = panel; s.pending = false; }
    s.laser.scale.set(1, 1, has ? s.hit.distance : 1.2);
    s.laser.material.uniforms.uBoost.value = panel || s.grab ? 1 : 0;
    if (has) {
      s.cursor.visible = true;
      s.cursor.position.copy(s.hit.point).addScaledVector(_ray.direction, -0.006);
      s.cursor.lookAt(_ray.origin);
      s.cursor.scale.setScalar(clamp(s.hit.distance / 2, 0.4, 1.6) * (panel ? 1.15 : 0.8));
    } else s.cursor.visible = false;
    if (panel) {
      panel.hoverFrame = frameId;
      if (panel !== s.lastHover) pulse(s.source, 0.15, 12);
    }
    s.lastHover = panel;

    const gp = s.source.gamepad;
    if (!gp) continue;
    const ax = (gp.axes.length > 3 ? gp.axes[2] : gp.axes[0]) || 0;
    const ay = (gp.axes.length > 3 ? gp.axes[3] : gp.axes[1]) || 0;
    const right = s.source.handedness !== 'left';
    // Thumbstick: right stick snap turns, left stick browses the cards.
    // With a project open, left or right on either stick steps through projects.
    if (!s.stick.x && Math.abs(ax) > 0.7) {
      s.stick.x = true;
      if (detail) stepDetail(ax > 0 ? 1 : -1);
      else if (right) snapTurn(ax > 0 ? -1 : 1);
      else pageCards(ax > 0 ? 1 : -1);
    } else if (s.stick.x && Math.abs(ax) < 0.3) s.stick.x = false;
    if (!s.stick.y && Math.abs(ay) > 0.7) {
      s.stick.y = true;
      if (!right && !detail) pageCards(ay > 0 ? 1 : -1);
    } else if (s.stick.y && Math.abs(ay) < 0.3) s.stick.y = false;
    // B or Y: tap closes the detail, hold recenters
    const bp = !!(gp.buttons[5] && gp.buttons[5].pressed);
    if (bp && !s.b.down) { s.b.down = true; s.b.t = 0; s.b.fired = false; }
    else if (bp) {
      s.b.t += dt;
      if (!s.b.fired && s.b.t > 0.7) { s.b.fired = true; pulse(s.source, 0.6, 40); recenter(); }
    } else if (s.b.down) {
      s.b.down = false;
      if (!s.b.fired && detail) closeDetail();
    }
  }
}

async function enterVR() {
  audio();
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
    mouseCursor.visible = false;
    // Hide the layout until the real eye height is known, then play the intro
    for (const p of panels) if (p.layer === 'main') { p.fade = 0; p.wait = 10; }
    mascotIntro = REDUCE ? 0 : 1;
    mascotWait = 10;
  } catch (err) {
    xrSession = null;
    setHint('Could not start VR here. Try again from the headset browser over HTTPS.');
  }
}
let xrAlign = null;
function onSessionEnd() {
  xrSession = null;
  xrAlign = null;
  closeDetail(true);
  finishClose();
  ui.position.set(0, 0, 0);
  ui.rotation.set(0, 0, 0);
  for (const k in groups) { groups[k].rotation.y = 0; groups[k].position.y = 0; }
  dolly.position.set(0, 0, 0);
  dolly.rotation.set(0, 0, 0);
  env.floor.position.y = 0;
  env.floor.material.uniforms.uCenter.value.set(0, 0);
  camera.position.set(0, EYE, 0);
  controllers.forEach((s) => { endGrab(s); s.cursor.visible = false; s.has = false; });
  if (firstHint) { firstHint.dispose(); firstHint = null; }
  for (const p of panels) { if (p.wait > 5) p.wait = 0; }
  mascotWait = 0;
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
  _v.setFromMatrixPosition(cam.matrixWorld);
  cam.getWorldDirection(_d);
  // With 'local-floor' y is the real eye height (seated or standing). A plain
  // 'local' space puts the head near y = 0, so the floor goes one eye height down.
  const offY = xrAlign.floor ? clamp(_v.y - EYE, -0.7, 0.4) : _v.y - EYE;
  ui.position.set(_v.x, offY, _v.z);
  ui.rotation.set(0, Math.atan2(-_d.x, -_d.z), 0);
  env.floor.position.y = xrAlign.floor ? 0 : _v.y - EYE;
  env.floor.material.uniforms.uCenter.value.set(_v.x, _v.z);
  xrAlign.done = true;
  playIntro(0.1);
  showFirstHint();
}

// ---------------------------------------------------------------------------
// Frame loop (no allocations in here)
// ---------------------------------------------------------------------------
let last = performance.now();
const camPos = new THREE.Vector3();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  frameId++;
  const xr = renderer.xr.isPresenting;
  if (!xr) {
    if (motion.on && motion.has) {
      if (!motion.calibrated) {
        _euler.setFromQuaternion(motion.q, 'YXZ');
        motion.offset = view.yaw - _euler.y;
        motion.calibrated = true;
      }
      _yawQ.setFromAxisAngle(_up, motion.offset);
      camera.quaternion.copy(_yawQ).multiply(motion.q);
      _euler.setFromQuaternion(camera.quaternion, 'YXZ');
      view.yaw = view.ty = _euler.y;
      view.pitch = view.tp = _euler.x;
    } else {
      // Glide after a drag, then ease toward the target
      if (!mouse.dragging && (Math.abs(view.vy) > 1e-3 || Math.abs(view.vp) > 1e-3)) {
        view.ty += view.vy * dt;
        view.tp = clamp(view.tp + view.vp * dt, -1.2, 1.2);
        const decay = Math.exp(-dt * 4.2);
        view.vy *= decay;
        view.vp *= decay;
      }
      const k = damp(REDUCE ? 30 : 10, dt);
      view.yaw += (view.ty - view.yaw) * k;
      view.pitch += (view.tp - view.pitch) * k;
      camera.rotation.set(view.pitch, view.yaw, 0, 'YXZ');
    }
  } else alignToViewer();

  // Pointers mark what they hover with the frame number
  let pointPos = null;
  if (xr) {
    updateControllers(dt);
    for (const s of controllers) if (s.has) { pointPos = s.hit.point; break; }
  } else if (mouse.active && !mouse.dragging) {
    pointerHit();
    const panel = mouse.has ? mouse.hit.panel : null;
    if (panel) panel.hoverFrame = frameId;
    if (mouse.has && now - mouse.lastMove < 4000) pointPos = mouse.hit.point;
    canvas.classList.toggle('is-pointing', !!panel);
    mouseCursor.visible = !!panel;
    if (panel) {
      mouseCursor.position.copy(mouse.hit.point).addScaledVector(raycaster.ray.direction, -0.006);
      mouseCursor.lookAt(raycaster.ray.origin);
    }
  } else mouseCursor.visible = false;
  let anyHover = false;
  for (const p of interactives) {
    const on = p.hoverFrame === frameId;
    if (on && !p.hoverT) tick('hover');
    p.hoverT = on ? 1 : 0;
    anyHover = anyHover || on;
  }
  if (focused && !pointPos) { focused.item.getWorldPosition(_wp); pointPos = _wp; }

  dim += (dimT - dim) * damp(REDUCE ? 40 : 8, dt);
  updateFly(dt);
  for (const p of panels) p.update(dt, dim);
  updateBlink(dt);
  if (mascotWait > 0) mascotWait -= dt;
  else if (mascotIntro > 0.0005) mascotIntro -= mascotIntro * damp(4.5, dt);
  else mascotIntro = 0;

  const cam = xr ? renderer.xr.getCamera() : camera;
  cam.getWorldPosition(camPos);
  env.update(t, camPos);
  mascot.update(dt, t, camPos, pointPos, anyHover || focused ? 1 : 0, mascotIntro);

  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// Overlay and HUD
// ---------------------------------------------------------------------------
function startPreview() {
  audio();
  // Play the intro now that the overlay is out of the way
  if (content && overlay && !overlay.classList.contains('is-hidden')) playIntro(0.05);
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
  if (sound.ctx) sound.ctx.close();
  renderer.dispose();
});

// Small hook for automated checks: view direction and where an item is on screen
window.__vrLobby = {
  ready: false,
  view(yawDeg, pitchDeg = -4) {
    view.yaw = view.ty = yawDeg * DEG;
    view.pitch = view.tp = pitchDeg * DEG;
    view.vy = view.vp = 0;
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
  opacity: (key) => { const p = panels.find((x) => x.key === key); return p && +p.mat.uniforms.uOpacity.value.toFixed(3); },
  state: () => ({ page: gallery && gallery.page, detail: detail && detail.index, closing: !!closing, sound: sound.on, yaw: view.yaw / DEG, dollyYaw: dolly.rotation.y / DEG, groups: Object.fromEntries(Object.entries(groups).map(([k, g]) => [k, [+(g.rotation.y / DEG).toFixed(2), +g.position.y.toFixed(3)]])) }),
  // Exercises the headset code paths with the mouse ray (there is no headset in CI)
  test: {
    snapTurn: (sign) => snapTurn(sign),
    recenter: () => recenter(),
    grab(x0, y0, x1, y1) {
      const s = { hit: newHit(), has: false, grab: null, source: null };
      mouse.x = x0; mouse.y = y0;
      s.has = pointerHit();
      if (s.has) { s.hit.surface = mouse.hit.surface; s.hit.point.copy(mouse.hit.point); }
      startGrab(s);
      if (!s.grab) return false;
      mouse.x = x1; mouse.y = y1;
      pointerHit();
      _ray.copy(raycaster.ray);
      updateGrab(s);
      endGrab(s);
      return true;
    },
  },
};

boot();
