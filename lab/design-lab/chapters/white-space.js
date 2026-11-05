import { scrollStage } from './_shared.js';

const ART = `<div class="ws-g"><p class="ey">Field guide</p><h3>Pack light, walk further</h3><p class="meta">6 min read · by the trail team</p></div>
<div class="ws-g"><p>Every gram you carry is a gram you lift on every step. Over a long day that adds up to tonnes, which is why experienced walkers obsess over weight.</p><p>Start with the big three: shelter, sleep system and pack. Shave there first, then look at the small things.</p></div>
<ul class="ws-g"><li><i>1</i><div><b>Under 7 kg base weight</b><span>Enough for three days in mild weather.</span></div></li><li><i>2</i><div><b>One of everything</b><span>Spares are what you leave behind.</span></div></li><li><i>3</i><div><b>Water by the map</b><span>Carry only to the next source.</span></div></li></ul>
<div class="ws-g"><button class="cta">Download the checklist</button></div>`;

const PRESETS = {
  cramped: { pad: 6, lh: 1.15, pg: 2, gg: 4 },
  balanced: { pad: 32, lh: 1.55, pg: 12, gg: 28 },
  airy: { pad: 56, lh: 1.8, pg: 18, gg: 52 },
  broken: { pad: 32, lh: 1.55, pg: 30, gg: 8 },
};

export default {
  mount(ctx) {
    const { center } = scrollStage(ctx);
    const wrap = ctx.h(`<div class="ws-wrap">
      <div class="ws-col ws-before"><p class="dl-cap">Before: cramped</p><article class="ws-art"></article></div>
      <div class="ws-col"><p class="dl-cap ws-cap">Yours</p><article class="ws-art"></article></div></div>`);
    center.append(wrap);
    const [before, mine] = wrap.querySelectorAll('.ws-art');
    before.innerHTML = ART; mine.innerHTML = ART;
    const apply = (el, v) => { el.style.setProperty('--pad', `${v.pad}px`); el.style.setProperty('--lh', v.lh); el.style.setProperty('--pg', `${v.pg}px`); el.style.setProperty('--gg', `${v.gg}px`); };
    apply(before, PRESETS.cramped);
    const v = { ...PRESETS.balanced };

    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">White space</h2>'), ctx.h('<p class="lede">Empty space is not wasted space. It is what lets the eye find the groups, the order and the rest stops in a layout.</p>'));
    const seg = ctx.seg([['cramped', 'Cramped'], ['balanced', 'Balanced'], ['airy', 'Airy'], ['broken', 'Broken groups']], 'balanced', (k) => { Object.assign(v, PRESETS[k]); sync(); });
    P.append(seg);
    const sl = {
      pad: ctx.slider({ label: 'Padding (inside the card)', min: 0, max: 72, step: 1, value: v.pad, unit: 'px', onInput: (x) => { v.pad = x; upd(); } }),
      lh: ctx.slider({ label: 'Line height', min: 1, max: 2.2, step: 0.05, value: v.lh, fmt: (x) => `${x.toFixed(2)} (${Math.round(15 * x)}px)`, onInput: (x) => { v.lh = x; upd(); } }),
      pg: ctx.slider({ label: 'Space inside a group', min: 0, max: 40, step: 1, value: v.pg, unit: 'px', onInput: (x) => { v.pg = x; upd(); } }),
      gg: ctx.slider({ label: 'Space between groups', min: 0, max: 72, step: 1, value: v.gg, unit: 'px', onInput: (x) => { v.gg = x; upd(); } }),
    };
    P.append(sl.pad, sl.lh, sl.pg, sl.gg);
    const show = ctx.h('<label class="check"><input type="checkbox"> Show the spacing (pink padding, teal gaps between groups, violet gaps inside)</label>');
    const cmp = ctx.h('<label class="check"><input type="checkbox" checked> Compare with the cramped version</label>');
    P.append(show, cmp);
    const stat = ctx.h('<div class="stat"></div>');
    P.append(stat);
    show.querySelector('input').addEventListener('change', (e) => { before.classList.toggle('show', e.target.checked); mine.classList.toggle('show', e.target.checked); }, { signal: ctx.signal });
    cmp.querySelector('input').addEventListener('change', (e) => { wrap.querySelector('.ws-before').hidden = !e.target.checked; }, { signal: ctx.signal });

    P.append(ctx.h('<div class="card tip"><p>White space (also called negative space) does three jobs. It <b>groups</b>: things close together read as one unit. It <b>separates</b>: a bigger gap says "new topic". And it <b>paces</b> reading: generous line height lets the eye find the start of the next line.</p><p>The rule of thumb is simple: space inside a group should be smaller than space between groups.</p></div>'));
    P.append(ctx.h('<div class="card try"><p>Pick <b>Broken groups</b>. The paragraphs are now further apart from each other than from the heading above, so the heading seems to float. Drag <b>Space between groups</b> above <b>Space inside a group</b> and watch the structure snap back. Turn on <b>Show the spacing</b> to see each gap as colour.</p></div>'));
    P.append(ctx.h(`<div class="card deep">
      <p><b>Micro and macro.</b> Micro white space is line height, letter spacing and the padding inside buttons. Macro white space is margins, gutters and the space between sections. Most layouts feel off because of micro spacing, not macro.</p>
      <p><b>Line height.</b> Body text usually reads well around 1.4 to 1.6 times the font size. Long lines want more, headings want less (1.1 to 1.25) because big type already has big gaps.</p>
      <p><b>Spacing scales.</b> Teams pick spacing from a fixed scale (4, 8, 12, 16, 24, 32, 48...) so gaps are consistent and meaningful. A gap of 13px next to one of 16px looks like a mistake, not a decision.</p>
      <p><b>Accessibility.</b> WCAG 2.1 success criterion 1.4.12 (text spacing) says content must still work when a reader overrides spacing to line height 1.5, paragraph spacing 2 times the font size, letter spacing 0.12 and word spacing 0.16 times the font size. Layouts with fixed height boxes often clip text when that happens.</p></div>`));
    P.append(ctx.h('<details class="more"><summary>Why it works</summary><div><p>This is the Gestalt law of proximity at work (see the Gestalt chapter): we group by distance before we read a single word. White space is how you control that grouping without adding lines or boxes, which keeps the page quieter.</p><p>Research on reading also links generous margins and line spacing with better comprehension and a sense of quality, which is one reason premium brands use so much of it.</p></div></details>'));

    function upd() {
      apply(mine, v);
      const ok = v.gg > v.pg;
      wrap.querySelector('.ws-cap').textContent = ok ? 'Yours' : 'Yours: groups are blurring together';
      stat.innerHTML = `<div><b>${Math.round(15 * v.lh)}px</b><span>Line spacing</span></div><div><b>${(v.gg / Math.max(1, v.pg)).toFixed(1)}x</b><span>Between / inside</span></div><div><b style="color:${ok ? 'var(--ok)' : 'var(--c4)'}">${ok ? 'Clear' : 'Muddled'}</b><span>Grouping</span></div>`;
    }
    function sync() { for (const k of Object.keys(sl)) sl[k].value = v[k]; upd(); }
    upd();

    ctx.quiz([
      { q: 'Which spacing rule keeps groups readable?', choices: ['Space inside a group should be smaller than space between groups', 'All gaps should be equal', 'Space between groups should be smaller'], answer: 0, why: 'Smaller internal gaps and larger external gaps let proximity do the grouping.' },
      { q: 'A comfortable line height for body text is usually around...', choices: ['1.0', '1.4 to 1.6', '3.0'], answer: 1, why: 'Body copy reads well around 1.4 to 1.6. Headings can be tighter.' },
      { q: 'What does WCAG 1.4.12 (text spacing) require?', choices: ['Line height must be exactly 2', 'Content still works when users increase line, paragraph, letter and word spacing', 'No white space in forms'], answer: 1, why: 'Users may override spacing for readability, and layouts must not clip or overlap text when they do.' },
    ]);
  },
};
