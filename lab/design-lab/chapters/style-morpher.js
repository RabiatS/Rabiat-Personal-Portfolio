import { makeKit, scrollStage, injectCSS, scopeCSS, hexToRgb, recipeBlock, clamp } from './_shared.js';

// Every style described by the same set of numbers. The morpher interpolates between neighbours.
const F = { serif: 'Georgia, serif', inter: '"Inter", system-ui, sans-serif', roboto: '"Roboto", system-ui, sans-serif', nunito: '"Nunito", system-ui, sans-serif', grotesk: '"Space Grotesk", system-ui, sans-serif' };
const STOPS = [
  { name: 'Skeuomorphism', font: F.serif, pageA: '#7a5236', pageB: '#3b2416', tex: 0.06, card: '#f6edd5', cardA: 1, ink: '#3d2b17', muted: '#5a4630', acc: '#2b78cf', accInk: '#ffffff', btn2: '#e8e8e8', btn2A: 1, r: 12, br: 8, bw: 1, bc: '#8a7650', bcA: 0.8, sx: 0, sy: 10, sb: 22, sc: '#000000', sA: 0.5, lx: 0, lA: 0, inD: 0, inDA: 0, inL: 0, inLA: 0, gloss: 1, blur: 0, blobs: 0, tw: 700 },
  { name: 'Flat', font: F.inter, pageA: '#ecf0f1', pageB: '#ecf0f1', tex: 0, card: '#ffffff', cardA: 1, ink: '#2c3e50', muted: '#5d6d7e', acc: '#c0392b', accInk: '#ffffff', btn2: '#dfe6e9', btn2A: 1, r: 4, br: 3, bw: 0, bc: '#2c3e50', bcA: 0, sx: 0, sy: 0, sb: 0, sc: '#000000', sA: 0, lx: 0, lA: 0, inD: 0, inDA: 0, inL: 0, inLA: 0, gloss: 0, blur: 0, blobs: 0, tw: 700 },
  { name: 'Material', font: F.roboto, pageA: '#fafafa', pageB: '#f3f0fa', tex: 0, card: '#ffffff', cardA: 1, ink: '#212121', muted: '#616161', acc: '#6200ee', accInk: '#ffffff', btn2: '#ede7f6', btn2A: 1, r: 4, br: 4, bw: 0, bc: '#000000', bcA: 0, sx: 0, sy: 4, sb: 10, sc: '#000000', sA: 0.2, lx: 0, lA: 0, inD: 0, inDA: 0, inL: 0, inLA: 0, gloss: 0, blur: 0, blobs: 0, tw: 500 },
  { name: 'Neumorphism', font: F.inter, pageA: '#e0e5ec', pageB: '#e0e5ec', tex: 0, card: '#e0e5ec', cardA: 1, ink: '#4a5568', muted: '#6d7c92', acc: '#e0e5ec', accInk: '#5b4de0', btn2: '#e0e5ec', btn2A: 1, r: 22, br: 14, bw: 0, bc: '#000000', bcA: 0, sx: 9, sy: 9, sb: 18, sc: '#a3b1c6', sA: 1, lx: 9, lA: 1, inD: 0, inDA: 0, inL: 0, inLA: 0, gloss: 0, blur: 0, blobs: 0, tw: 700 },
  { name: 'Glassmorphism', font: F.inter, pageA: '#1d1240', pageB: '#1d1240', tex: 0, card: '#ffffff', cardA: 0.16, ink: '#ffffff', muted: '#ece8f6', acc: '#ffffff', accInk: '#35196e', btn2: '#ffffff', btn2A: 0.16, r: 20, br: 12, bw: 1, bc: '#ffffff', bcA: 0.4, sx: 0, sy: 8, sb: 32, sc: '#0a0028', sA: 0.28, lx: 0, lA: 0, inD: 0, inDA: 0, inL: 1, inLA: 0.4, gloss: 0, blur: 18, blobs: 1, tw: 700 },
  { name: 'Claymorphism', font: F.nunito, pageA: '#ffe8f2', pageB: '#e6edff', tex: 0, card: '#fff8fc', cardA: 1, ink: '#3b2f4a', muted: '#5f5070', acc: '#6a3fd0', accInk: '#ffffff', btn2: '#ffe3a8', btn2A: 1, r: 32, br: 18, bw: 0, bc: '#000000', bcA: 0, sx: 14, sy: 18, sb: 36, sc: '#966ea5', sA: 0.32, lx: 0, lA: 0, inD: 9, inDA: 0.55, inL: 8, inLA: 0.95, gloss: 0, blur: 0, blobs: 0, tw: 900 },
  { name: 'Neo-brutalism', font: F.grotesk, pageA: '#fff4d6', pageB: '#fff4d6', tex: 0, card: '#ffffff', cardA: 1, ink: '#000000', muted: '#000000', acc: '#ff6b6b', accInk: '#000000', btn2: '#ffffff', btn2A: 1, r: 12, br: 10, bw: 3, bc: '#000000', bcA: 1, sx: 6, sy: 6, sb: 0, sc: '#000000', sA: 1, lx: 0, lA: 0, inD: 0, inDA: 0, inL: 0, inLA: 0, gloss: 0, blur: 0, blobs: 0, tw: 700 },
  { name: 'Minimalism', font: F.inter, pageA: '#fafaf9', pageB: '#fafaf9', tex: 0, card: '#ffffff', cardA: 1, ink: '#18181b', muted: '#52525b', acc: '#18181b', accInk: '#ffffff', btn2: '#ffffff', btn2A: 1, r: 8, br: 6, bw: 1, bc: '#e4e4e7', bcA: 1, sx: 0, sy: 0, sb: 0, sc: '#000000', sA: 0, lx: 0, lA: 0, inD: 0, inDA: 0, inL: 0, inLA: 0, gloss: 0, blur: 0, blobs: 0, tw: 600 },
];
const COLOR_KEYS = ['pageA', 'pageB', 'card', 'ink', 'muted', 'acc', 'accInk', 'btn2', 'bc', 'sc'];
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

function mix(t) {
  const i = clamp(Math.floor(t), 0, STOPS.length - 2); const f = ease(clamp(t - i, 0, 1));
  const A = STOPS[i]; const B = STOPS[i + 1]; const o = {};
  for (const k of Object.keys(A)) {
    if (k === 'name' || k === 'font') continue;
    o[k] = COLOR_KEYS.includes(k) ? hexToRgb(A[k]).map((v, j) => Math.round(lerp(v, hexToRgb(B[k])[j], f))) : lerp(A[k], B[k], f);
  }
  o.font = f < 0.5 ? A.font : B.font;
  o.from = A.name; o.to = B.name; o.f = f; o.near = f < 0.5 ? A.name : B.name;
  return o;
}
const n = (v, d = 0) => +v.toFixed(d);
const rgba = (c, a = 1) => (a >= 0.999 ? `rgb(${c.join(', ')})` : `rgba(${c.join(', ')}, ${n(a, 2)})`);

function css(p) {
  const shadow = (s, inner = true) => {
    const L = [];
    if (p.sA > 0.01) L.push(`${n(p.sx * s)}px ${n(p.sy * s)}px ${n(p.sb * s)}px ${rgba(p.sc, p.sA)}`);
    if (p.lA > 0.01) L.push(`${n(-p.lx * s)}px ${n(-p.lx * s)}px ${n(p.sb * s)}px ${rgba([255, 255, 255], p.lA)}`);
    if (inner && p.inDA > 0.01) L.push(`inset ${n(-p.inD * s)}px ${n(-p.inD * s)}px ${n(p.inD * 2 * s)}px ${rgba([214, 178, 214], p.inDA)}`);
    if (inner && p.inLA > 0.01) L.push(`inset ${n(p.inL * s)}px ${n(p.inL * s)}px ${n(p.inL * 2 * s)}px ${rgba([255, 255, 255], p.inLA)}`);
    return L.length ? L.join(',\n    ') : 'none';
  };
  const border = p.bcA > 0.01 && p.bw > 0.05 ? `${n(p.bw, 1)}px solid ${rgba(p.bc, p.bcA)}` : '0';
  const gloss = p.gloss > 0.01 ? `linear-gradient(rgba(255, 255, 255, ${n(p.gloss * 0.55, 2)}), rgba(255, 255, 255, 0) 50%, rgba(0, 0, 0, ${n(p.gloss * 0.14, 2)}))` : 'none';
  const page = p.tex > 0.002 ? `repeating-linear-gradient(45deg, rgba(255, 255, 255, ${n(p.tex, 3)}) 0 2px, transparent 2px 5px),\n    linear-gradient(160deg, ${rgba(p.pageA)}, ${rgba(p.pageB)})` : `linear-gradient(160deg, ${rgba(p.pageA)}, ${rgba(p.pageB)})`;
  const blur = p.blur > 0.2 ? `blur(${n(p.blur)}px) saturate(${n(100 + p.blur * 3.3)}%)` : 'none';
  return `.surface {
  background: ${page};
  color: ${rgba(p.ink)};
  font-family: ${p.font};
}
.blobs { display: block; opacity: ${n(p.blobs, 2)}; }
.nav, .card {
  background: ${rgba(p.card, p.cardA)};
  border: ${border};
  border-radius: ${n(p.r)}px;
  box-shadow: ${shadow(1)};
  backdrop-filter: ${blur};
}
.title { font-weight: ${Math.round(p.tw / 100) * 100}; }
.text, .label, .field, .setting, .tab { color: ${rgba(p.muted)}; }
.tab.on { color: ${rgba(p.ink)}; }
.media { border-radius: ${n(p.r * 0.6)}px; }
.button {
  color: ${rgba(p.ink)};
  background-color: ${rgba(p.btn2, p.btn2A)};
  background-image: ${gloss};
  border: ${border};
  border-radius: ${n(p.br)}px;
  box-shadow: ${shadow(0.55)};
}
.button.primary { background-color: ${rgba(p.acc)}; color: ${rgba(p.accInk)}; }
.input {
  background: ${rgba(p.card, Math.max(p.cardA, 0.12))};
  border: ${p.bw > 0.05 && p.bcA > 0.01 ? border : `1px solid ${rgba(p.muted, 0.35)}`};
  border-radius: ${n(p.br)}px;
  color: ${rgba(p.ink)};
}
.switch, .track { background: ${rgba(p.muted, 0.3)}; border-radius: ${n(Math.min(p.br, 13))}px; }
.switch[aria-checked="true"], .fill { background: ${p.acc.join() === p.card.join() ? rgba(p.accInk) : rgba(p.acc)}; }
.knob, .thumb { background: ${rgba(p.card.map((v) => Math.min(255, v + 20)))}; border-radius: ${n(Math.min(p.br, 10))}px; box-shadow: ${shadow(0.3, false)}; }`;
}

const BLOB_CSS = `.dl-ui.s-morph .blobs i { position: absolute; width: 46%; aspect-ratio: 1; border-radius: 50%; animation: glass-drift 18s ease-in-out infinite alternate; }
.dl-ui.s-morph .blobs i:nth-child(1) { background: #ff4fa3; left: -8%; top: -14%; }
.dl-ui.s-morph .blobs i:nth-child(2) { background: #3d7bff; right: -10%; top: 22%; animation-duration: 23s; animation-delay: -7s; }
.dl-ui.s-morph .blobs i:nth-child(3) { background: #ffb347; left: 26%; bottom: -26%; animation-duration: 27s; animation-delay: -13s; }
@keyframes glass-drift { 0% { transform: translate(0, 0) scale(1); } 50% { transform: translate(16%, 10%) scale(1.12); } 100% { transform: translate(-10%, 6%) scale(.92); } }
.dl-ui.s-morph .button, .dl-ui.s-morph .switch, .dl-ui.s-morph .knob { transition: none; }`;

export default {
  mount(ctx) {
    const { center } = scrollStage(ctx);
    const label = ctx.h('<div style="text-align:center;display:grid;gap:2px"><div class="dl-big"></div><div class="dl-cap"></div></div>');
    center.append(label);
    const kit = makeKit(ctx, 'morph', center);
    injectCSS('morph-blobs', BLOB_CSS);

    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">Style morpher</h2>'), ctx.h('<p class="lede">Every style in this lab is the same handful of numbers: radius, border, shadow, blur, colour. Slide between them.</p>'));
    let t = 0;
    const slider = ctx.slider({ label: 'Style', min: 0, max: STOPS.length - 1, step: 0.01, value: 0, fmt: (v) => mix(v).near, onInput: (v) => { stopAuto(); t = v; render(); } });
    const stops = ctx.h(`<div class="row">${STOPS.map((s, i) => `<button class="chip" data-i="${i}">${s.name.replace('morphism', '').replace('Neo-brutalism', 'Neo-brutal').replace('Minimalism', 'Minimal')}</button>`).join('')}</div>`);
    const play = ctx.h('<button class="btn ghost sm">Play the whole tour</button>');
    const stat = ctx.h('<div class="stat"></div>');
    P.append(slider, stops, ctx.h('<div class="row"></div>'), stat);
    P.lastElementChild.previousElementSibling.append(play);
    P.append(ctx.h('<div class="card tip"><p>A visual style is not magic. Under the surface it is a few dials: how round the corners are, whether there is a border, where the light comes from (the shadow), how see-through the surface is, and the palette. Change the dials and the "personality" of the same interface changes completely.</p></div>'));
    P.append(ctx.h('<div class="card try"><p>Drag slowly from <b>Flat</b> to <b>Material</b>: only the shadow appears. From <b>Material</b> to <b>Neumorphism</b>: the page and card become the same colour and a second, white shadow grows. From <b>Clay</b> to <b>Neo-brutal</b>: the blur collapses to zero and a border appears. Watch the numbers on the right change.</p></div>'));
    P.append(ctx.h('<h3>Live CSS</h3>'));
    const code = recipeBlock(ctx, '');
    P.append(code);
    P.append(ctx.h('<div class="card deep"><p>The morpher interpolates each number linearly between neighbouring styles, with a smoothstep easing so each style "settles" near its stop. Colours are mixed in sRGB. A perceptual space such as OKLab would give more even midpoints (sRGB mixes of complementary colours pass through muddy greys). Fonts cannot be interpolated, so the typeface switches at the halfway point.</p><p>This is the same idea as <b>design tokens</b>: a design system stores radius, spacing, colour and elevation as named values, and a theme is just a different set of values.</p></div>'));
    P.append(ctx.h('<details class="more"><summary>The dials per style</summary><div><table class="dl-tbl"><tr><th>Style</th><th>Radius</th><th>Border</th><th>Shadow blur</th><th>Backdrop blur</th></tr>' + STOPS.map((s) => `<tr><td>${s.name}</td><td>${s.r}px</td><td>${s.bcA ? s.bw : 0}px</td><td>${s.sA ? s.sb : 0}px</td><td>${s.blur}px</td></tr>`).join('') + '</table></div></details>'));

    let auto = 0;
    const stopAuto = () => { auto = 0; play.textContent = 'Play the whole tour'; };
    play.addEventListener('click', () => { if (auto) { stopAuto(); return; } auto = 1; if (t >= STOPS.length - 1.01) t = 0; play.textContent = 'Pause'; }, { signal: ctx.signal });
    stops.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => { stopAuto(); t = +b.dataset.i; slider.value = t; render(); }, { signal: ctx.signal }));
    ctx.loop((time, dt) => {
      if (!auto) return;
      // linger on each stop, then glide to the next
      const i = Math.floor(t); const f = t - i;
      t += dt * (f < 0.02 || f > 0.98 ? 0.6 : 0.42);
      if (t >= STOPS.length - 1) { t = STOPS.length - 1; stopAuto(); }
      slider.value = t; render();
    });

    let lastCss = '';
    function render() {
      const p = mix(t);
      const text = css(p);
      if (text !== lastCss) { injectCSS('morph', scopeCSS(text, '.dl-ui.s-morph')); code.set(text); lastCss = text; }
      label.firstChild.textContent = p.near;
      label.lastChild.textContent = p.f < 0.01 || p.f > 0.99 ? 'drag the style slider' : `${Math.round((1 - p.f) * 100)}% ${p.from} · ${Math.round(p.f * 100)}% ${p.to}`;
      stops.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', STOPS[+b.dataset.i].name === p.near));
      stat.innerHTML = [['Radius', `${n(p.r)}px`], ['Border', `${p.bcA > 0.01 ? n(p.bw, 1) : 0}px`], ['Shadow', `${p.sA > 0.01 ? n(p.sb) : 0}px`], ['Blur', `${n(p.blur)}px`], ['Opacity', `${Math.round(p.cardA * 100)}%`], ['Weight', Math.round(p.tw / 100) * 100]].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
    }
    render();

    ctx.quiz([
      { q: 'Moving from Flat to Material, which property changes the most?', choices: ['Typeface only', 'The drop shadow (elevation) appears', 'A backdrop blur is added'], answer: 1, why: 'Material is largely flat design plus meaningful elevation shadows.' },
      { q: 'What makes Neumorphism different from Material in these numbers?', choices: ['The card colour equals the page colour and a second, light shadow is added', 'It has a thick black border', 'It uses no radius'], answer: 0, why: 'Neumorphism uses the background colour for surfaces and pairs a dark and a light shadow.' },
      { q: 'A design system stores radius, colours and elevation as named values so themes can swap them. These values are called...', choices: ['Design tokens', 'Breakpoints', 'Wireframes'], answer: 0, why: 'Design tokens are the named variables a theme is built from, exactly the dials this morpher moves.' },
    ]);
  },
};
