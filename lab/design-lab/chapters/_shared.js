// Design Lab shared pieces: the sample UI kit, the style recipes, colour maths and the style chapter builder.
// Each style recipe is plain CSS written against generic class names (.card, .button, .switch ...).
// At runtime it is scoped to .dl-ui.s-<id> and injected, so the recipe shown in the panel is exactly what renders.

/* ---------------- Colour maths ---------------- */
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function hexToRgb(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}
export const hslHex = (h, s, l) => rgbToHex(...hslToRgb(h, s, l));
export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const l = (mx + mn) / 2;
  let h = 0; let s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0); else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}
// WCAG 2 relative luminance and contrast ratio
export function luminance(rgb) {
  const c = (rgb.map ? rgb : hexToRgb(rgb)).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a, b) {
  const la = luminance(typeof a === 'string' ? hexToRgb(a) : a); const lb = luminance(typeof b === 'string' ? hexToRgb(b) : b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
// blend a colour with alpha over a background (both rgb arrays)
export const over = (fg, a, bg) => fg.map((v, i) => v * a + bg[i] * (1 - a));
export const badge = (ok, txt) => `<span class="${ok ? 'dl-pass' : 'dl-fail'}">${txt}</span>`;

/* ---------------- The sample UI ---------------- */
const MEDIA = `<svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<rect width="320" height="180" style="fill:var(--sky,#a9cfe8)"/>
<circle cx="238" cy="58" r="24" style="fill:var(--sun,#ffd36b)"/>
<path d="M0 128 L64 72 L104 104 L168 44 L232 112 L276 86 L320 110 V180 H0Z" style="fill:var(--hill1,#6f9a7b)"/>
<path d="M0 152 C60 122 110 136 160 146 S260 128 320 140 V180 H0Z" style="fill:var(--hill2,#456e57)"/>
<path d="M148 180 C160 166 176 160 168 150" style="fill:none;stroke:var(--path,#efe2c2);stroke-width:5;stroke-linecap:round"/>
</svg>`;

export const KIT_HTML = `<div class="blobs" aria-hidden="true"><i></i><i></i><i></i></div>
<nav class="nav" aria-label="Sample app">
  <span class="logo">Fieldnote</span>
  <button class="tab on">Explore</button><button class="tab">Saved</button><button class="tab">Profile</button>
</nav>
<div class="grid">
  <article class="card">
    <div class="media">${MEDIA}</div>
    <h3 class="title">Ridge trail at dawn</h3>
    <p class="text">A 6 km loop with one steep climb and a view that is worth the early alarm.</p>
    <div class="actions"><button class="button primary">Start route</button><button class="button">Save</button></div>
  </article>
  <section class="card" aria-label="Trip settings">
    <h4 class="label">Trip settings</h4>
    <label class="field"><span>Trip name</span><input class="input" placeholder="Morning hike"></label>
    <div class="setting"><span>Offline maps</span><button class="switch" role="switch" aria-checked="true" aria-label="Offline maps"><span class="knob"></span></button></div>
    <div class="setting col"><span>Distance <output>6 km</output></span>
      <div class="range" role="slider" tabindex="0" aria-label="Distance" aria-valuemin="1" aria-valuemax="20" aria-valuenow="6"><div class="track"><div class="fill"></div></div><div class="thumb"></div></div></div>
    <button class="button primary block">Save settings</button>
  </section>
</div>`;

export const MARKUP = `<nav class="nav">
  <span class="logo">Fieldnote</span>
  <button class="tab on">Explore</button> ...
</nav>
<article class="card">
  <div class="media"><svg>...</svg></div>
  <h3 class="title">Ridge trail at dawn</h3>
  <p class="text">A 6 km loop ...</p>
  <button class="button primary">Start route</button>
  <button class="button">Save</button>
</article>
<section class="card">
  <h4 class="label">Trip settings</h4>
  <label class="field">Trip name
    <input class="input"></label>
  <button class="switch" role="switch"
    aria-checked="true"><span class="knob"></span></button>
  <div class="range" role="slider">
    <div class="track"><div class="fill"></div></div>
    <div class="thumb"></div></div>
</section>`;

// make the sample UI behave like a real one
export function wireKit(root, signal) {
  root.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    root.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
  }, { signal }));
  root.querySelectorAll('.switch').forEach((s) => s.addEventListener('click', () => {
    s.setAttribute('aria-checked', String(s.getAttribute('aria-checked') !== 'true'));
  }, { signal }));
  root.querySelectorAll('.range').forEach((sl) => {
    const out = sl.parentElement.querySelector('output');
    let v = 6; const min = 1; const max = 20;
    const set = (nv) => {
      v = Math.round(clamp(nv, min, max));
      sl.style.setProperty('--v', `${((v - min) / (max - min)) * 100}%`);
      sl.setAttribute('aria-valuenow', v);
      if (out) out.textContent = `${v} km`;
    };
    const fromX = (x) => { const r = sl.getBoundingClientRect(); set(min + ((x - r.left) / r.width) * (max - min)); };
    sl.addEventListener('pointerdown', (e) => { sl.setPointerCapture(e.pointerId); fromX(e.clientX); }, { signal });
    sl.addEventListener('pointermove', (e) => { if (sl.hasPointerCapture(e.pointerId)) fromX(e.clientX); }, { signal });
    sl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { set(v + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { set(v - 1); e.preventDefault(); }
    }, { signal });
    set(v);
  });
  root.querySelectorAll('.button').forEach((b) => b.addEventListener('pointerdown', (e) => {
    const r = b.getBoundingClientRect(); const d = Math.max(r.width, r.height) * 2.2;
    const s = document.createElement('span'); s.className = 'ripple';
    s.style.cssText = `position:absolute;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px;width:${d}px;height:${d}px;pointer-events:none`;
    b.append(s); setTimeout(() => s.remove(), 700);
  }, { signal }));
  // keep the layout sensible in a narrow stage
  const ro = new ResizeObserver(() => root.classList.toggle('narrow', root.getBoundingClientRect().width < 560));
  ro.observe(root); signal.addEventListener('abort', () => ro.disconnect());
}

/* ---------------- Recipe scoping ---------------- */
export function scopeCSS(css, scope) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let out = ''; let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i); if (open < 0) break;
    const sel = css.slice(i, open).trim();
    let d = 1; let j = open + 1;
    while (j < css.length && d) { if (css[j] === '{') d++; else if (css[j] === '}') d--; j++; }
    const body = css.slice(open + 1, j - 1);
    if (sel.startsWith('@keyframes')) out += `${sel}{${body}}\n`;
    else if (sel.startsWith('@')) out += `${sel}{${scopeCSS(body, scope)}}\n`;
    else out += sel.split(',').map((s) => { s = s.trim(); return s.startsWith('.surface') ? `${scope}${s}` : `${scope} ${s}`; }).join(', ') + `{${body}}\n`;
    i = j;
  }
  return out;
}
export function injectCSS(id, css) {
  let el = document.getElementById(`dl-css-${id}`);
  if (!el) { el = document.createElement('style'); el.id = `dl-css-${id}`; document.head.append(el); }
  if (el.textContent !== css) el.textContent = css;
  return el;
}
export function useStyle(id) { if (STYLES[id]) injectCSS(id, scopeCSS(STYLES[id].css, `.dl-ui.s-${id}`)); }

/* ---------------- The style recipes ---------------- */
const ELEV = {
  0: 'none',
  1: '0 2px 1px -1px rgba(0,0,0,.2), 0 1px 1px 0 rgba(0,0,0,.14), 0 1px 3px 0 rgba(0,0,0,.12)',
  2: '0 3px 1px -2px rgba(0,0,0,.2), 0 2px 2px 0 rgba(0,0,0,.14), 0 1px 5px 0 rgba(0,0,0,.12)',
  4: '0 2px 4px -1px rgba(0,0,0,.2), 0 4px 5px 0 rgba(0,0,0,.14), 0 1px 10px 0 rgba(0,0,0,.12)',
  8: '0 5px 5px -3px rgba(0,0,0,.2), 0 8px 10px 1px rgba(0,0,0,.14), 0 3px 14px 2px rgba(0,0,0,.12)',
  12: '0 7px 8px -4px rgba(0,0,0,.2), 0 12px 17px 2px rgba(0,0,0,.14), 0 5px 22px 4px rgba(0,0,0,.12)',
  16: '0 8px 10px -5px rgba(0,0,0,.2), 0 16px 24px 2px rgba(0,0,0,.14), 0 6px 30px 5px rgba(0,0,0,.12)',
  24: '0 11px 15px -7px rgba(0,0,0,.2), 0 24px 38px 3px rgba(0,0,0,.14), 0 9px 46px 8px rgba(0,0,0,.12)',
};
export { ELEV };

export const STYLES = {
  skeuo: { name: 'Skeuomorphism', short: 'Skeuo', css: `/* Skeuomorphism: real materials, real light */
.surface {
  background:
    repeating-linear-gradient(45deg, rgba(255,255,255,.035) 0 2px, transparent 2px 5px),
    radial-gradient(120% 90% at 50% 0%, #7a5236, #3b2416);
  font-family: Georgia, "Times New Roman", serif;
}
.nav {
  background: linear-gradient(#fafafa, #cfcfcf);
  border: 1px solid #7d7d7d; border-radius: 10px;
  box-shadow: inset 0 1px 0 #fff, 0 3px 6px rgba(0,0,0,.5);
}
.logo { color: #333; text-shadow: 0 1px 0 #fff; }
.tab { color: #3a3a3a; border-radius: 6px; text-shadow: 0 1px 0 #fff; }
.tab.on {
  background: linear-gradient(#c4c4c4, #e2e2e2);
  box-shadow: inset 0 2px 4px rgba(0,0,0,.35);
}
.card {
  padding: 22px;
  color: #3d2b17;
  background: linear-gradient(#fdf8ea, #efe3c6);
  border: 1px solid #b29d6c; border-radius: 12px;
  outline: 2px dashed rgba(120,88,48,.45); outline-offset: -9px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.7), 0 10px 22px rgba(0,0,0,.5);
}
.media {
  --sky: #8fc6ea; --sun: #ffe08a; --hill1: #5f8f62; --hill2: #3f6b45; --path: #efe2c2;
  border: 5px solid #fff; border-radius: 3px;
  box-shadow: 0 3px 8px rgba(0,0,0,.4); transform: rotate(-1.2deg);
}
.title { color: #3d2b17; text-shadow: 0 1px 0 #fff; }
.text, .field, .setting { color: #5a4630; }
.label { color: #7a5a30; text-shadow: 0 1px 0 #fff; }
.button {
  color: #2e2e2e; text-shadow: 0 1px 0 #fff;
  background: linear-gradient(#fefefe, #d2d2d2);
  border: 1px solid #8a8a8a; border-radius: 8px;
  box-shadow: inset 0 1px 0 #fff, 0 1px 2px rgba(0,0,0,.45);
}
.button.primary {
  color: #fff; text-shadow: 0 -1px 0 rgba(0,0,0,.45);
  background: linear-gradient(#6fb6f5, #2b78cf 50%, #1d64b6 51%, #2f7fd6);
  border-color: #174f8f;
}
.button:active { box-shadow: inset 0 2px 5px rgba(0,0,0,.45); }
.input {
  color: #2b2118; background: #fffdf6;
  border: 1px solid #9c8b68; border-radius: 6px;
  box-shadow: inset 0 2px 4px rgba(0,0,0,.25);
}
.switch {
  border-radius: 13px; background: linear-gradient(#b9b9b9, #e8e8e8);
  box-shadow: inset 0 2px 4px rgba(0,0,0,.5);
}
.switch[aria-checked="true"] { background: linear-gradient(#1f6fc8, #63aef0); }
.knob {
  border-radius: 50%; background: linear-gradient(#ffffff, #cdcdcd);
  box-shadow: 0 1px 3px rgba(0,0,0,.6), inset 0 -1px 0 rgba(0,0,0,.15);
}
.track { border-radius: 3px; background: #bdb196; box-shadow: inset 0 1px 2px rgba(0,0,0,.55); }
.fill { background: linear-gradient(#6fb6f5, #2b78cf); }
.thumb {
  width: 22px; height: 22px; margin: -11px 0 0 -11px;
  background: radial-gradient(circle at 35% 30%, #fff, #c4c4c4 55%, #8d8d8d);
  box-shadow: 0 2px 4px rgba(0,0,0,.55);
}` },

  flat: { name: 'Flat', short: 'Flat', css: `/* Flat design: solid colour, no depth cues */
.surface { background: #ecf0f1; color: #2c3e50; font-family: "Inter", system-ui, sans-serif; }
.nav { background: #2c3e50; border-radius: 4px; }
.logo { color: #ffffff; }
.tab { color: #c9d3dc; border-radius: 3px; }
.tab.on { color: #ffffff; background: #117a65; }
.card { background: #ffffff; border-radius: 4px; }
.media { --sky: #3498db; --sun: #f1c40f; --hill1: #27ae60; --hill2: #16a085; --path: #ecf0f1; border-radius: 3px; }
.title { color: #2c3e50; }
.text { color: #5d6d7e; }
.label { color: #16a085; }
.button { background: #dfe6e9; color: #2c3e50; border-radius: 3px; }
.button:hover { background: #cfd8dc; }
.button.primary { background: #c0392b; color: #ffffff; }
.button.primary:hover { background: #a93226; }
.input { background: #ecf0f1; border: 2px solid transparent; border-radius: 3px; color: #2c3e50; }
.input:focus { border-color: #2980b9; }
.switch { background: #bdc3c7; border-radius: 3px; }
.switch[aria-checked="true"] { background: #16a085; }
.knob { background: #ffffff; border-radius: 2px; }
.track { background: #dfe6e9; border-radius: 3px; }
.fill { background: #16a085; }
.thumb { background: #117a65; border-radius: 3px; }` },

  material: { name: 'Material', short: 'Material', css: `/* Material design (2014 to 2018): paper, ink and elevation */
.surface { background: #fafafa; color: rgba(0,0,0,.87); font-family: "Roboto", system-ui, sans-serif; }
.nav {
  background: #6200ee; border-radius: 4px;
  box-shadow: ${ELEV[4]};
}
.logo { color: #ffffff; font-weight: 500; }
.tab {
  color: rgba(255,255,255,.78); font-size: 13px; font-weight: 500;
  text-transform: uppercase; letter-spacing: .09em;
}
.tab.on { color: #ffffff; box-shadow: inset 0 -2px 0 #ffffff; }
.card {
  background: #ffffff; border-radius: 4px;
  box-shadow: var(--elev, ${ELEV[1]});
  transition: box-shadow 280ms cubic-bezier(.4,0,.2,1);
}
.media { --sky: #b39ddb; --sun: #ffd54f; --hill1: #4db6ac; --hill2: #00897b; --path: #fff8e1;
  margin: -16px -16px 0; border-radius: 4px 4px 0 0; }
.title { font-weight: 500; }
.text { color: rgba(0,0,0,.6); }
.label { color: #6200ee; font-weight: 500; }
.button {
  border-radius: 4px; color: #6200ee; background: transparent;
  font-weight: 500; text-transform: uppercase; letter-spacing: .089em;
}
.button:hover { background: rgba(98,0,238,.06); }
.button.primary { background: #6200ee; color: #ffffff; box-shadow: ${ELEV[2]}; }
.button.primary:hover { box-shadow: ${ELEV[4]}; }
.button.primary:active { box-shadow: ${ELEV[8]}; }
.ripple {
  display: block; border-radius: 50%; background: currentColor; opacity: .28;
  transform: scale(0); animation: md-ripple 600ms cubic-bezier(.4,0,.2,1) forwards;
}
@keyframes md-ripple { to { transform: scale(1); opacity: 0; } }
.input {
  background: #f5f5f5; border: 0; border-radius: 4px 4px 0 0;
  border-bottom: 1px solid rgba(0,0,0,.42); color: rgba(0,0,0,.87);
}
.input:focus { border-bottom: 2px solid #6200ee; }
.switch {
  width: 34px; height: 14px; margin: 6px 4px; border-radius: 7px;
  background: rgba(0,0,0,.38);
}
.switch[aria-checked="true"] { background: rgba(98,0,238,.5); }
.knob {
  top: -3px; left: -3px; border-radius: 50%; background: #fafafa;
  box-shadow: ${ELEV[1]};
}
.switch[aria-checked="true"] .knob { background: #6200ee; }
.track { height: 4px; margin-top: -2px; background: rgba(98,0,238,.24); }
.fill { background: #6200ee; }
.thumb { width: 16px; height: 16px; margin: -8px 0 0 -8px; background: #6200ee; }` },

  neu: { name: 'Neumorphism', short: 'Neu', css: `/* Neumorphism: one colour, two shadows */
.surface {
  --bg: #e0e5ec; --dark: #a3b1c6; --light: #ffffff;
  --ink: #6d7c92; --accent: #5b4de0; --edge: transparent;
  background: var(--bg); color: var(--ink);
  font-family: "Inter", system-ui, sans-serif;
}
.nav, .card {
  background: var(--bg); border-radius: 22px;
  box-shadow: 9px 9px 18px var(--dark), -9px -9px 18px var(--light);
}
.card { padding: 20px; }
.logo { color: var(--ink); }
.tab { color: var(--ink); border-radius: 12px; }
.tab.on { box-shadow: inset 4px 4px 8px var(--dark), inset -4px -4px 8px var(--light); }
.media {
  --sky: #d3dbe6; --sun: #f4f6fa; --hill1: #b9c5d6; --hill2: #a7b5c9; --path: #e0e5ec;
  padding: 8px; border-radius: 16px;
  box-shadow: inset 5px 5px 10px var(--dark), inset -5px -5px 10px var(--light);
}
.media svg { border-radius: 10px; }
.title, .text, .label { color: var(--ink); }
.button {
  color: var(--ink); background: var(--bg); border-radius: 14px;
  border: 1px solid var(--edge);
  box-shadow: 6px 6px 12px var(--dark), -6px -6px 12px var(--light);
}
.button:hover { box-shadow: 3px 3px 6px var(--dark), -3px -3px 6px var(--light); }
.button:active { box-shadow: inset 4px 4px 8px var(--dark), inset -4px -4px 8px var(--light); }
.button.primary { color: var(--accent); }
.input {
  color: var(--ink); background: var(--bg); border: 1px solid var(--edge); border-radius: 14px;
  box-shadow: inset 4px 4px 8px var(--dark), inset -4px -4px 8px var(--light);
}
.input::placeholder { color: #a6b1c2; }
.switch {
  border-radius: 13px; background: var(--bg); border: 1px solid var(--edge);
  box-shadow: inset 3px 3px 6px var(--dark), inset -3px -3px 6px var(--light);
}
.knob { border-radius: 50%; background: var(--bg); box-shadow: 2px 2px 4px var(--dark), -2px -2px 4px var(--light); }
.switch[aria-checked="true"] .knob { background: var(--accent); }
.track {
  border-radius: 3px; background: var(--bg);
  box-shadow: inset 2px 2px 4px var(--dark), inset -2px -2px 4px var(--light);
}
.fill { background: var(--accent); border-radius: 3px; }
.thumb { background: var(--bg); box-shadow: 3px 3px 6px var(--dark), -3px -3px 6px var(--light); }` },

  glass: { name: 'Glassmorphism', short: 'Glass', css: `/* Glassmorphism: frosted panels over colour */
.surface {
  --glass: 255,255,255; --glass-a: .16; --glass-blur: 18px;
  background: #1d1240; color: #ffffff;
  font-family: "Inter", system-ui, sans-serif;
}
.blobs { display: block; }
.blobs i {
  position: absolute; width: 46%; aspect-ratio: 1; border-radius: 50%;
  animation: glass-drift 18s ease-in-out infinite alternate;
}
.blobs i:nth-child(1) { background: #ff4fa3; left: -8%; top: -14%; }
.blobs i:nth-child(2) { background: #3d7bff; right: -10%; top: 22%; animation-duration: 23s; animation-delay: -7s; }
.blobs i:nth-child(3) { background: #ffb347; left: 26%; bottom: -26%; animation-duration: 27s; animation-delay: -13s; }
@keyframes glass-drift {
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(16%, 10%) scale(1.12); }
  100% { transform: translate(-10%, 6%) scale(.92); }
}
.nav, .card {
  background: rgba(var(--glass), var(--glass-a));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(160%);
  backdrop-filter: blur(var(--glass-blur)) saturate(160%);
  border: 1px solid rgba(255,255,255,.35); border-radius: 20px;
  box-shadow: 0 8px 32px rgba(10,0,40,.28), inset 0 1px 0 rgba(255,255,255,.4);
}
.tab { color: rgba(255,255,255,.82); border-radius: 10px; }
.tab.on { color: #ffffff; background: rgba(255,255,255,.22); }
.media { --sky: #ffc4e1; --sun: #fff3b0; --hill1: #8f7bff; --hill2: #5a3fd1; --path: #ffe1f0; border-radius: 14px; }
.text { color: rgba(255,255,255,.88); }
.label { color: rgba(255,255,255,.78); }
.button {
  color: #ffffff; border-radius: 12px;
  background: rgba(255,255,255,.16); border: 1px solid rgba(255,255,255,.45);
}
.button:hover { background: rgba(255,255,255,.26); }
.button.primary { background: #ffffff; color: #35196e; }
.input {
  color: #ffffff; border-radius: 12px;
  background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.45);
}
.input::placeholder { color: rgba(255,255,255,.7); }
.switch { border-radius: 13px; background: rgba(255,255,255,.25); }
.switch[aria-checked="true"] { background: rgba(255,255,255,.8); }
.knob { border-radius: 50%; background: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,.3); }
.switch[aria-checked="true"] .knob { background: #6a3df0; }
.track { border-radius: 3px; background: rgba(255,255,255,.25); }
.fill { background: #ffffff; }
.thumb { background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,.35); }` },

  clay: { name: 'Claymorphism', short: 'Clay', css: `/* Claymorphism: outer shadow plus two inner shadows */
.surface {
  background: linear-gradient(160deg, #ffe8f2, #e6edff);
  color: #3b2f4a; font-family: "Nunito", system-ui, sans-serif;
}
.nav, .card {
  background: #fff8fc; border-radius: 32px;
  box-shadow:
    14px 18px 36px rgba(150,110,165,.32),
    inset -8px -10px 18px rgba(214,178,214,.55),
    inset 8px 8px 16px rgba(255,255,255,.95);
}
.nav { padding: 10px 14px; }
.card { padding: 20px; }
.logo { color: #6a3fd0; font-weight: 900; }
.tab { color: #6f5f80; font-weight: 800; border-radius: 16px; }
.tab.on {
  color: #3b2f4a; background: #ffd9ea;
  box-shadow: inset -3px -4px 8px rgba(214,150,185,.6), inset 3px 3px 6px #ffffff;
}
.media {
  --sky: #bfe3ff; --sun: #ffd36e; --hill1: #9ee6b8; --hill2: #74cf9c; --path: #fff3d6;
  border-radius: 24px; box-shadow: inset 0 -6px 14px rgba(0,0,0,.08);
}
.title { font-weight: 900; }
.text { color: #5f5070; font-weight: 600; }
.label { color: #6a3fd0; font-weight: 900; }
.field, .setting { font-weight: 700; }
.button {
  color: #3b2f4a; font-weight: 800; border-radius: 18px; background: #ffe3a8;
  box-shadow: 6px 8px 16px rgba(200,150,80,.35),
    inset -4px -5px 10px rgba(220,160,70,.45), inset 4px 4px 8px rgba(255,255,255,.8);
}
.button.primary {
  color: #ffffff; background: #6a3fd0;
  box-shadow: 6px 8px 16px rgba(110,70,200,.4),
    inset -4px -5px 10px rgba(60,20,150,.5), inset 4px 4px 8px rgba(255,255,255,.4);
}
.button:active { transform: scale(.96); }
.input {
  color: #3b2f4a; font-weight: 700; background: #ffffff; border: 0; border-radius: 16px;
  box-shadow: inset 4px 4px 10px rgba(170,140,185,.35), inset -3px -3px 8px #ffffff;
}
.switch { border-radius: 14px; background: #ece0f2; box-shadow: inset 3px 3px 6px rgba(160,130,170,.45); }
.switch[aria-checked="true"] { background: #8fdcae; }
.knob {
  border-radius: 50%; background: #ffffff;
  box-shadow: 2px 3px 6px rgba(120,90,130,.35), inset -2px -2px 4px rgba(200,180,210,.6);
}
.track { height: 10px; margin-top: -5px; border-radius: 5px; background: #ece0f2; }
.fill { background: #6a3fd0; border-radius: 5px; }
.thumb {
  width: 24px; height: 24px; margin: -12px 0 0 -12px; background: #ffffff;
  box-shadow: 2px 3px 6px rgba(120,90,130,.35), inset -2px -3px 5px rgba(200,180,210,.7);
}` },

  brutal: { name: 'Brutalism', short: 'Brutal', css: `/* Web brutalism: the browser's raw materials, on purpose */
.surface { background: #ffffff; color: #000000; border-radius: 0; font-family: "Times New Roman", Times, serif; }
.nav { padding: 0 0 6px; border-bottom: 1px solid #000; }
.logo { font-family: "Courier New", monospace; font-size: 20px; text-transform: uppercase; }
.tab { color: #0000ee; text-decoration: underline; font-size: 15px; padding: 2px 6px; }
.tab.on { color: #551a8b; }
.card { padding: 10px; border: 1px solid #000; gap: 8px; }
.media { filter: grayscale(1) contrast(1.5); border: 1px solid #000; }
.title { font-size: 26px; text-decoration: underline; }
.text { font-size: 16px; }
.label { font-family: "Courier New", monospace; letter-spacing: 0; }
.button {
  color: #000; font-family: Arial, sans-serif; font-weight: 400;
  background: #e4e4e4; border: 2px outset #cccccc; padding: 4px 10px;
}
.button:active { border-style: inset; }
.button.primary { background: #ffff00; }
.input { border: 2px inset #cccccc; padding: 4px 6px; font-family: "Courier New", monospace; }
.switch { background: #ffffff; border: 2px solid #000; }
.knob { top: 2px; left: 2px; width: 18px; height: 18px; background: #000; }
.switch[aria-checked="true"] { background: #00ff00; }
.track { height: 2px; margin-top: -1px; background: #000; }
.fill { background: #000; }
.thumb { width: 12px; height: 22px; margin: -11px 0 0 -6px; border-radius: 0; background: #fff; border: 2px solid #000; }` },

  neobrutal: { name: 'Neo-brutalism', short: 'Neo-brutal', css: `/* Neo-brutalism: thick outlines, hard shadows, loud colour */
.surface { background: #fff4d6; color: #000000; font-family: "Space Grotesk", system-ui, sans-serif; }
.nav { background: #ffffff; border: 3px solid #000; border-radius: 12px; box-shadow: 5px 5px 0 #000; }
.logo { font-size: 18px; }
.tab { font-weight: 700; border: 2px solid transparent; border-radius: 8px; }
.tab.on { background: #a3e635; border-color: #000; }
.card { background: #ffffff; border: 3px solid #000; border-radius: 12px; box-shadow: 6px 6px 0 #000; }
.media {
  --sky: #7dd3fc; --sun: #fde047; --hill1: #fb7185; --hill2: #a78bfa; --path: #ffffff;
  border: 3px solid #000; border-radius: 8px;
}
.title { font-size: 22px; }
.label { align-self: flex-start; background: #000; color: #fff; padding: 3px 8px; border-radius: 4px; }
.button {
  color: #000; font-weight: 700; background: #ffffff;
  border: 3px solid #000; border-radius: 10px; box-shadow: 4px 4px 0 #000;
}
.button:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 #000; }
.button:active { transform: translate(4px, 4px); box-shadow: 0 0 0 #000; }
.button.primary { background: #ff6b6b; }
.input { background: #ffffff; border: 3px solid #000; border-radius: 10px; box-shadow: 3px 3px 0 #000; }
.input:focus { background: #fef9c3; }
.switch { width: 52px; height: 30px; border: 3px solid #000; border-radius: 15px; background: #ffffff; }
.switch[aria-checked="true"] { background: #a3e635; }
.knob { top: 2px; left: 2px; border: 3px solid #000; border-radius: 50%; }
.track { height: 14px; margin-top: -7px; border: 3px solid #000; border-radius: 7px; background: #ffffff; }
.fill { background: #fde047; }
.thumb { width: 24px; height: 24px; margin: -12px 0 0 -12px; border: 3px solid #000; border-radius: 6px; background: #ff6b6b; box-shadow: 2px 2px 0 #000; }` },

  minimal: { name: 'Minimalism', short: 'Minimal', css: `/* Minimalism: remove until it breaks, then add one thing back */
.surface { background: #fafaf9; color: #18181b; font-family: "Inter", system-ui, sans-serif; }
.nav { padding: 4px 0 12px; border-bottom: 1px solid #e7e5e4; }
.logo { font-weight: 600; letter-spacing: -.01em; }
.tab { color: #71717a; font-weight: 500; }
.tab.on { color: #18181b; }
.card { background: #ffffff; border: 1px solid #e7e5e4; border-radius: 8px; padding: 20px; gap: 14px; }
.media { --sky: #f4f4f5; --sun: #18181b; --hill1: #d4d4d8; --hill2: #a1a1aa; --path: #fafafa; border-radius: 4px; }
.title { font-weight: 600; letter-spacing: -.015em; }
.text { color: #52525b; }
.label { color: #71717a; font-weight: 500; }
.button { color: #18181b; font-weight: 500; background: #ffffff; border: 1px solid #e4e4e7; border-radius: 6px; }
.button:hover { background: #f4f4f5; }
.button.primary { color: #ffffff; background: #18181b; border-color: #18181b; }
.input { border: 1px solid #e4e4e7; border-radius: 6px; }
.input:focus { border-color: #18181b; }
.switch { border-radius: 13px; background: #e4e4e7; }
.switch[aria-checked="true"] { background: #18181b; }
.knob { border-radius: 50%; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
.track { height: 2px; margin-top: -1px; background: #e4e4e7; }
.fill { background: #18181b; }
.thumb { width: 14px; height: 14px; margin: -7px 0 0 -7px; background: #18181b; }` },

  swiss: { name: 'Swiss style', short: 'Swiss', css: `/* Swiss (International Typographic) style: grid, sans serif, flush left */
.surface { background: #f2efe8; color: #111111; border-radius: 0; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }
.nav { padding: 0 0 10px; border-bottom: 4px solid #111; }
.logo { font-size: 26px; font-weight: 700; letter-spacing: -.04em; text-transform: lowercase; }
.tab { font-weight: 700; padding: 4px 8px; }
.tab.on { background: #d40511; color: #ffffff; }
.card { padding: 10px 0 0; gap: 10px; border-top: 1px solid #111; }
.media { --sky: #e6e1d6; --sun: #d40511; --hill1: #111111; --hill2: #3b3b3b; --path: #f2efe8; }
.title { font-size: 30px; line-height: 1; letter-spacing: -.035em; }
.text { max-width: 34ch; }
.label { font-size: 11px; letter-spacing: .02em; }
.button { border: 2px solid #111; font-weight: 700; }
.button.primary { background: #d40511; border-color: #d40511; color: #ffffff; }
.input { border: 0; border-bottom: 2px solid #111; background: transparent; padding: 8px 0; }
.switch { background: #ffffff; border: 2px solid #111; }
.switch[aria-checked="true"] { background: #d40511; }
.knob { top: 1px; left: 1px; background: #111111; }
.track { height: 4px; margin-top: -2px; background: #cfc9bc; }
.fill { background: #d40511; }
.thumb { width: 6px; height: 24px; margin: -12px 0 0 -3px; border-radius: 0; background: #111111; }` },
};
export const STYLE_ORDER = ['skeuo', 'flat', 'material', 'neu', 'glass', 'clay', 'brutal', 'neobrutal', 'minimal', 'swiss'];

/* ---------------- Stage helpers ---------------- */
// A scrolling stage. Returns { scroll, center }.
export function scrollStage(ctx) {
  ctx.tall();
  const scroll = ctx.h('<div class="dl-scroll"><div class="dl-center"></div></div>');
  ctx.stage.append(scroll);
  return { scroll, center: scroll.firstChild };
}

export function makeKit(ctx, styleId, parent) {
  const root = document.createElement('div');
  root.className = `dl-ui surface s-${styleId}`;
  root.innerHTML = KIT_HTML;
  parent.append(root);
  useStyle(styleId);
  wireKit(root, ctx.signal);
  const api = {
    root,
    set(id) { useStyle(id); root.className = root.className.replace(/\bs-[\w-]+/, `s-${id}`); api.style = id; },
    style: styleId,
  };
  return api;
}

// A code block with a copy button
export function recipeBlock(ctx, css) {
  const el = ctx.h('<div class="dl-recipe"><pre class="code"></pre><button class="btn ghost sm">Copy</button></div>');
  const pre = el.querySelector('pre'); const b = el.querySelector('button');
  el.set = (t) => { pre.textContent = t; };
  el.set(css);
  b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(pre.textContent); b.textContent = 'Copied'; } catch { b.textContent = 'Select and copy'; }
    setTimeout(() => { b.textContent = 'Copy'; }, 1400);
  }, { signal: ctx.signal });
  return el;
}

/* ---------------- Generic style chapter ---------------- */
// cfg: { styles: [ids], title, lede, tip, tryThis, when: [], pitfalls: [], history, deep, quiz, extra(ctx, kit, api) }
export function styleChapter(ctx, cfg) {
  const { center } = scrollStage(ctx);
  // style switcher row so you can compare the same UI in any style
  const sw = ctx.h(`<div class="dl-compare" role="group" aria-label="Compare styles"><span>Same UI in</span>${STYLE_ORDER.map((id) => `<button class="chip ${id === cfg.styles[0] ? 'on' : ''}" data-s="${id}">${STYLES[id].short}</button>`).join('')}</div>`);
  center.append(sw);
  const kit = makeKit(ctx, cfg.styles[0], center);
  const cap = ctx.h('<p class="dl-cap"></p>');
  center.append(cap);

  const P = ctx.panel;
  P.append(ctx.h(`<h2 class="k-h">${cfg.title}</h2>`), ctx.h(`<p class="lede">${cfg.lede}</p>`));
  let seg = null;
  if (cfg.styles.length > 1) {
    seg = ctx.seg(cfg.styles.map((id) => [id, STYLES[id].name]), cfg.styles[0], (v) => setStyle(v));
    P.append(seg);
  }
  P.append(ctx.h(`<div class="card tip">${cfg.tip}</div>`));
  if (cfg.tryThis) P.append(ctx.h(`<div class="card try">${cfg.tryThis}</div>`));
  const extraHost = document.createElement('div');
  extraHost.style.cssText = 'display:flex;flex-direction:column;gap:12px';
  P.append(extraHost);
  const recipeHead = ctx.h('<h3>The recipe</h3>');
  const recipeNote = ctx.h('<p class="small muted">This is the exact CSS rendering the stage, written for the class names in the markup below. Copy it into your own project.</p>');
  const recipe = recipeBlock(ctx, STYLES[cfg.styles[0]].css);
  P.append(recipeHead, recipeNote, recipe);
  P.append(ctx.h(`<details class="more"><summary>The markup it styles</summary><div><pre class="code" style="font-size:11.5px">${ctx.esc(MARKUP)}</pre><p class="small muted">The layout (grid, sizes, the switch and slider mechanics) lives in a small base stylesheet. The recipe only adds the look, which is the point: a style is a skin over the same structure.</p></div></details>`));
  if (cfg.when) P.append(ctx.h(`<div class="card"><h3 style="margin:0">When to use it</h3><ul class="small">${cfg.when.map((x) => `<li>${x}</li>`).join('')}</ul></div>`));
  if (cfg.pitfalls) P.append(ctx.h(`<div class="card" style="border-color:rgba(251,113,133,.35)"><h3 style="margin:0;color:var(--c4)">Accessibility pitfalls</h3><ul class="small">${cfg.pitfalls.map((x) => `<li>${x}</li>`).join('')}</ul></div>`));
  if (cfg.deep) P.append(ctx.h(`<div class="card deep">${cfg.deep}</div>`));
  if (cfg.history) P.append(ctx.h(`<details class="more"><summary>A short history</summary><div>${cfg.history}</div></details>`));

  function setStyle(id) {
    kit.set(id);
    recipe.set(STYLES[id].css);
    sw.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.s === id));
    if (seg && cfg.styles.includes(id)) seg.set(id);
    const own = cfg.styles.includes(id);
    cap.textContent = own ? `${STYLES[id].name} · try the switch, slider, field and buttons` : `Comparing: ${STYLES[id].name}. Tap ${STYLES[cfg.styles[0]].short} to come back`;
    recipeHead.textContent = own ? 'The recipe' : `The recipe (${STYLES[id].name})`;
    extraHost.style.opacity = own ? '1' : '.45';
    if (api.onStyle) api.onStyle(id);
  }
  sw.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => setStyle(c.dataset.s), { signal: ctx.signal }));
  const api = { kit, setStyle, extraHost, onStyle: null };
  if (cfg.extra) cfg.extra(ctx, kit, api);
  setStyle(cfg.styles[0]);
  ctx.quiz(cfg.quiz);
  return api;
}

/* ---------------- Measurement helpers ---------------- */
export function linfit(xs, ys) {
  const n = xs.length; if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n; const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  if (!sxx) return null;
  const b = sxy / sxx; const a = my - b * mx;
  return { a, b, r2: syy ? (sxy * sxy) / (sxx * syy) : 1 };
}
export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
export function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// A scatter plot with a fitted line, drawn on a kit canvas.
// opts: { xs, ys, means: [[x, y]], fit, xLabel, yLabel, xMin, xMax, colors }
export function drawPlot(cv, C, o) {
  const g = cv.ctx; const { w, h } = cv; if (!w) return;
  g.clearRect(0, 0, w, h);
  const L = 46; const R = 14; const T = 24; const B = 34;
  const xMin = o.xMin ?? Math.min(...o.xs, 0); const xMax = o.xMax ?? Math.max(...o.xs, 1);
  const yMaxRaw = Math.max(...(o.ys.length ? o.ys : [1]), ...(o.means || []).map((m) => m[1]), 1);
  const yStep = [50, 100, 200, 250, 500, 1000, 2000].find((s) => yMaxRaw / s <= 5) || 2000;
  const yMax = Math.ceil(yMaxRaw / yStep) * yStep;
  const X = (x) => L + ((x - xMin) / (xMax - xMin)) * (w - L - R);
  const Y = (y) => h - B - (y / yMax) * (h - T - B);
  g.font = '500 11px "DM Mono", monospace'; g.lineWidth = 1;
  for (let y = 0; y <= yMax + 1e-6; y += yStep) {
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(L, Y(y)); g.lineTo(w - R, Y(y)); g.stroke();
    g.fillStyle = C.muted; g.textAlign = 'right'; g.fillText(`${y}`, L - 6, Y(y) + 4);
  }
  const xt = o.xTicks || []; g.textAlign = 'center';
  for (const t of xt) { g.fillStyle = C.muted; g.fillText(typeof t === 'number' ? t.toFixed(1) : t[1], X(typeof t === 'number' ? t : t[0]), h - B + 16); }
  g.fillStyle = C.muted; g.textAlign = 'right'; g.fillText(o.xLabel || '', w - R, h - 4);
  g.textAlign = 'left'; g.fillText(o.yLabel || '', 4, 11);
  if (o.fit) {
    g.strokeStyle = C.c2; g.lineWidth = 2; g.beginPath(); g.moveTo(X(xMin), Y(o.fit.a + o.fit.b * xMin)); g.lineTo(X(xMax), Y(o.fit.a + o.fit.b * xMax)); g.stroke();
  }
  o.xs.forEach((x, i) => { g.beginPath(); g.arc(X(x), Y(o.ys[i]), 3, 0, Math.PI * 2); g.fillStyle = 'rgba(94,234,212,.45)'; g.fill(); });
  (o.means || []).forEach(([x, y]) => { g.beginPath(); g.arc(X(x), Y(y), 6, 0, Math.PI * 2); g.fillStyle = C.c1; g.fill(); g.strokeStyle = C.bg; g.lineWidth = 2; g.stroke(); });
  if (!o.xs.length && !(o.means || []).length) { g.fillStyle = C.muted; g.textAlign = 'center'; g.fillText(o.empty || 'No data yet', (L + w - R) / 2, (T + h - B) / 2); }
}
