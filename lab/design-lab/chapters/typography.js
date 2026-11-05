import { scrollStage, recipeBlock } from './_shared.js';

const RATIOS = [[1.067, 'Minor second'], [1.125, 'Major second'], [1.2, 'Minor third'], [1.25, 'Major third'], [1.333, 'Perfect fourth'], [1.414, 'Augmented fourth'], [1.5, 'Perfect fifth'], [1.618, 'Golden ratio']];
const STEPS = [[6, 'Display'], [5, 'H1'], [4, 'H2'], [3, 'H3'], [2, 'H4'], [1, 'H5'], [0, 'Body'], [-1, 'Small'], [-2, 'Caption']];
const PAIRS = [
  { h: '"Fraunces", Georgia, serif', hw: 700, b: '"Inter", system-ui, sans-serif', name: 'Fraunces + Inter', why: 'Soft display serif over a neutral sans. Clear contrast of structure, similar proportions.' },
  { h: '"Rajdhani", sans-serif', hw: 700, b: '"Lora", Georgia, serif', name: 'Rajdhani + Lora', why: 'This site\'s pair: a condensed technical display face with a warm reading serif.' },
  { h: '"Space Grotesk", sans-serif', hw: 700, b: '"Lora", Georgia, serif', name: 'Space Grotesk + Lora', why: 'Quirky geometric grotesque for headings, calm serif for long reading.' },
  { h: 'Georgia, serif', hw: 700, b: 'system-ui, -apple-system, "Segoe UI", sans-serif', name: 'Georgia + system UI', why: 'Zero downloads. System fonts load instantly and feel native on each platform.' },
  { h: '"Inter", sans-serif', hw: 800, b: '"Inter", sans-serif', name: 'Inter + Inter', why: 'One family, contrast from weight and size only. Hard to get wrong, easy to make bland.' },
  { h: '"Nunito", sans-serif', hw: 900, b: '"Nunito", sans-serif', name: 'Nunito + Nunito', why: 'Rounded and friendly. Works for playful products, can feel childish in serious ones.' },
];
const TEXT = 'Good typography is invisible. Readers should not notice the type at all, only the words. When the line is too long the eye loses its place on the way back to the start of the next line; when it is too short the rhythm breaks every few words and reading turns into a series of jumps. Most comfortable reading sits somewhere between forty five and seventy five characters per line, including spaces, which is roughly ten to twelve words.';

export default {
  mount(ctx) {
    const { center } = scrollStage(ctx);
    const board = ctx.h(`<div class="dl-board">
      <div class="dl-sheet"><h4>1 · Type scale</h4><div class="ty-scale"></div></div>
      <div class="dl-sheet"><h4>2 · Line length (measure)</h4><div class="ty-measure"><div class="ty-ruler"></div><p class="ty-p"></p><p class="dl-mono ty-count" style="color:#77776f;font:500 12px DM Mono,monospace"></p></div></div>
      <div class="dl-sheet"><h4>3 · Font pairing</h4><div class="ty-pairs"></div></div></div>`);
    center.append(board);
    const $ = (s) => board.querySelector(s);
    let base = 16; let ratio = 1.25; let pair = 0; let measure = 64;
    $('.ty-p').textContent = TEXT;

    $('.ty-pairs').innerHTML = PAIRS.map((p, i) => `<button class="ty-pair" data-i="${i}"><small>${p.name}</small><h5 style="font-family:${p.h};font-weight:${p.hw}">Walk the long way home</h5><p style="font-family:${p.b}">${p.why}</p></button>`).join('');
    board.querySelectorAll('.ty-pair').forEach((b) => b.addEventListener('click', () => { pair = +b.dataset.i; upd(); }, { signal: ctx.signal }));

    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">Typography</h2>'), ctx.h('<p class="lede">Most of an interface is text. Three decisions do most of the work: the sizes, the line length and the typefaces.</p>'));
    const sb = ctx.slider({ label: 'Base size', min: 12, max: 22, step: 1, value: base, unit: 'px', onInput: (v) => { base = v; upd(); } });
    const sr = ctx.slider({ label: 'Scale ratio', min: 1.05, max: 1.65, step: 0.001, value: ratio, fmt: (v) => { const n = RATIOS.find(([r]) => Math.abs(r - v) < 0.006); return `${v.toFixed(3)}${n ? ` ${n[1]}` : ''}`; }, onInput: (v) => { ratio = v; upd(); } });
    const chips = ctx.h(`<div class="row">${RATIOS.map(([r, n]) => `<button class="chip" data-r="${r}" title="${n}">${r}</button>`).join('')}</div>`);
    chips.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => { ratio = +c.dataset.r; sr.value = ratio; upd(); }, { signal: ctx.signal }));
    const sm = ctx.slider({ label: 'Measure (line length)', min: 18, max: 130, step: 1, value: measure, unit: 'ch', onInput: (v) => { measure = v; upd(); } });
    P.append(sb, sr, chips, sm);
    const stat = ctx.h('<div class="stat"></div>');
    P.append(stat);
    P.append(ctx.h('<div class="card tip"><p>A <b>type scale</b> picks every font size from one base size multiplied by a fixed ratio, again and again. Sizes then relate to each other like notes in a chord instead of random numbers.</p><p>The <b>measure</b> is how many characters fit on one line. Too long and the eye gets lost going back, too short and reading becomes choppy. A <b>pairing</b> combines a heading face with a body face that contrast in character but agree in proportion.</p></div>'));
    P.append(ctx.h('<div class="card try"><p>Drag the ratio from 1.067 to 1.618 and watch the gap between H1 and body grow. Small ratios suit dense apps, large ones suit editorial pages. Then drag the measure until the count below the paragraph turns green (45 to 75 characters). Finally tap a pairing card: the whole scale switches typefaces.</p></div>'));
    P.append(ctx.h('<h3>Your scale as CSS</h3>'));
    const code = recipeBlock(ctx, '');
    P.append(code);
    P.append(ctx.h(`<div class="card deep"><p><b>Modular scales.</b> Size at step n is <code>base × ratio^n</code>. Many of the classic ratio names come from musical intervals (a perfect fifth is 3:2 = 1.5, a perfect fourth is 4:3 ≈ 1.333).</p>
      <p><b>Measure.</b> Robert Bringhurst\'s <i>The Elements of Typographic Style</i> gives 45 to 75 characters as the satisfactory range for a single column, with 66 often called ideal. In CSS, <code>max-width: 65ch</code> on paragraphs gets you close (1ch is the width of the "0" glyph, so the real count varies by typeface, which is why this page measures the actual lines).</p>
      <p><b>Pairing.</b> Contrast in structure (serif with sans, condensed with wide) and harmony in proportion (similar x-height) work best. Two faces that are almost but not quite the same look like a mistake.</p>
      <p><b>Responsive type.</b> Use rem units so the scale follows the user\'s browser font size setting, and consider a smaller ratio on phones, since a 1.618 scale makes H1 enormous on a 390px screen.</p></div>`));

    function lines(p) {
      const r = document.createRange(); r.selectNodeContents(p);
      const tops = new Set([...r.getClientRects()].map((x) => Math.round(x.top)));
      return Math.max(1, tops.size);
    }
    function upd() {
      const pr = PAIRS[pair];
      board.querySelectorAll('.ty-pair').forEach((b) => b.classList.toggle('on', +b.dataset.i === pair));
      chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', Math.abs(+c.dataset.r - ratio) < 0.002));
      $('.ty-scale').innerHTML = STEPS.map(([k, n]) => {
        const px = base * ratio ** k; const head = k >= 1;
        return `<div class="ty-step"><span class="k">${n}<br>${px.toFixed(1)}px<br>${(px / 16).toFixed(3)}rem</span><span class="s" style="font-size:${px}px;line-height:${head ? 1.15 : 1.5};font-family:${head ? pr.h : pr.b};font-weight:${head ? pr.hw : 400}">${head ? 'Walk the long way home' : 'Pack light and walk further every weekend'}</span></div>`;
      }).join('');
      const p = $('.ty-p'); p.style.maxWidth = `${measure}ch`; p.style.fontFamily = pr.b;
      requestAnimationFrame(() => {
        const n = lines(p); const cpl = TEXT.length / n;
        const ok = cpl >= 45 && cpl <= 75;
        const col = ok ? 'var(--ok)' : cpl < 45 ? 'var(--c2)' : 'var(--c4)';
        const rul = $('.ty-ruler'); rul.style.width = `${Math.min(100, (p.getBoundingClientRect().width / p.parentElement.getBoundingClientRect().width) * 100)}%`; rul.style.background = col;
        $('.ty-count').textContent = `${n} lines · about ${Math.round(cpl)} characters per line · ${ok ? 'comfortable' : cpl < 45 ? 'too short, choppy' : 'too long, hard to track'}`;
        stat.innerHTML = `<div><b>${(base * ratio ** 5).toFixed(0)}px</b><span>H1</span></div><div><b>${(ratio ** 5).toFixed(2)}x</b><span>H1 / body</span></div><div><b style="color:${col}">${Math.round(cpl)}</b><span>Chars / line</span></div>`;
      });
      code.set(`:root {\n  /* ${pr.name}, ratio ${ratio.toFixed(3)} */\n  --font-head: ${pr.h};\n  --font-body: ${pr.b};\n${STEPS.map(([k, n]) => `  --step-${k < 0 ? `m${-k}` : k}: ${(base * ratio ** k / 16).toFixed(3)}rem; /* ${n} */`).join('\n')}\n}\np { font-size: var(--step-0); max-width: 65ch; line-height: 1.55; }\nh1 { font: ${pr.hw} var(--step-5)/1.1 var(--font-head); }`);
    }
    const ro = new ResizeObserver(() => upd()); ro.observe($('.ty-measure'));
    document.fonts?.ready.then(() => { if (!ctx.signal.aborted) upd(); });
    upd();

    ctx.quiz([
      { q: 'With a base of 16px and a ratio of 1.25, how big is step 2?', choices: ['20px', '25px', '32px'], answer: 1, why: '16 × 1.25 × 1.25 = 25px.' },
      { q: 'What is the commonly recommended measure for body text?', choices: ['20 to 30 characters', '45 to 75 characters', '120 characters or more'], answer: 1, why: 'Around 45 to 75 characters per line keeps reading comfortable.' },
      { q: 'Which pairing approach usually works?', choices: ['Two very similar sans serifs', 'Faces that contrast in structure but share proportions', 'As many fonts as possible'], answer: 1, why: 'Contrast in character (serif vs sans) with similar proportions reads as intentional.' },
    ]);
    return () => ro.disconnect();
  },
};
