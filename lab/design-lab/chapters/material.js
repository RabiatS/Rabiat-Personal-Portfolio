import { styleChapter, ELEV } from './_shared.js';

const LEVELS = [0, 1, 2, 4, 8, 12, 16, 24];

export default {
  mount(ctx) {
    styleChapter(ctx, {
      styles: ['material'],
      title: 'Material design',
      lede: 'Flat colour on sheets of paper that sit at real heights, lit from above, with ink that spreads when you touch it.',
      tip: '<p>Material treats every surface as a sheet of paper with a height, measured in dp (density independent pixels). Higher sheets cast bigger, softer shadows. The shadow is not decoration: it tells you what sits on top of what and what you can interact with.</p><p>When you press a button, a ripple of "ink" spreads out from your finger, confirming exactly where the touch landed.</p>',
      tryThis: '<p>Drag the elevation slider and watch the two cards lift. Read the shadow below: three layers (a sharp umbra, a softer penumbra and a wide ambient shadow). Then press and hold the buttons to see the ripple start from your pointer.</p>',
      extra(ctx2, kit, api) {
        const out = ctx.h('<pre class="code" style="font-size:11px;white-space:pre-wrap"></pre>');
        const s = ctx.slider({ label: 'Card elevation', min: 0, max: LEVELS.length - 1, step: 1, value: 1, fmt: (v) => `${LEVELS[v]} dp`, onInput: (v) => set(v) });
        const set = (i) => {
          const dp = LEVELS[i];
          kit.root.style.setProperty('--elev', ELEV[dp]);
          out.textContent = dp === 0 ? 'box-shadow: none;' : `box-shadow:\n  ${ELEV[dp].split('), ').join('),\n  ')};`;
        };
        const box = ctx.h('<div class="card"><h3 style="margin:0">Elevation</h3></div>');
        box.append(s, out, ctx.h('<p class="hint">Resting card 1dp, raised button 2dp, app bar 4dp, menus 8dp, dialogs 24dp.</p>'));
        api.extraHost.append(box);
        set(1);
      },
      when: [
        'Apps that must feel at home on Android and the web, or any product that wants a complete, documented system rather than a look.',
        'Dense interfaces with layered parts (menus over cards over pages), where elevation clarifies what is on top.',
        'Teams that benefit from shared rules: spacing on a 4dp and 8dp grid, motion curves, component states.',
      ],
      pitfalls: [
        'Shadows alone do not mark a boundary for everyone. Low vision users may not see a 1dp shadow, so key cards and fields also need a border or a fill change.',
        'Uppercase button labels with wide letter spacing are harder to read in long phrases. Keep them short, or use sentence case (as Material 3 does).',
        'The ripple is motion. Honour prefers-reduced-motion by fading instead of spreading. This lab\'s kit stylesheet already shortens animations when that setting is on.',
        'Filled text fields with only a bottom line can have too little contrast against the page. Check the line and the fill against 3:1.',
      ],
      deep: '<p>Material\'s shadows model two light sources: a key light above, which casts the directional shadow, and ambient light, which casts a soft shadow all around. That is why each elevation is three stacked box-shadows with fixed opacities (.2, .14 and .12), and why higher sheets get both bigger offsets and bigger blur.</p><p>Material 3 (2021) changed the model: in dark themes and for many components, elevation is shown with a <b>tonal</b> change (the surface gets slightly lighter and tinted with the primary colour) instead of a shadow, because shadows are nearly invisible on dark backgrounds.</p>',
      history: '<p>Google introduced Material design at Google I/O in 2014 to unify Android, the web and its own apps. The physical metaphor was quantum paper and ink: surfaces can grow, split and join, but never pass through each other. Material 2 (2018) made it easier to theme, and Material 3, also called Material You (2021), added colour schemes generated from the user\'s wallpaper.</p>',
      quiz: [
        { q: 'In Material design, what does a larger, softer shadow tell you?', choices: ['The element is disabled', 'The surface sits higher, closer to you', 'The element is a link'], answer: 1, why: 'Elevation is measured in dp. Higher surfaces cast bigger, more diffuse shadows.' },
        { q: 'Why does the ripple start where you touched?', choices: ['To confirm the exact point of contact and that the press registered', 'It is random decoration', 'To hide loading time'], answer: 0, why: 'The ink ripple is feedback: it ties the response to your finger position.' },
        { q: 'How does Material 3 often show elevation in dark themes?', choices: ['With thicker borders', 'With a lighter, tinted surface colour', 'With a red outline'], answer: 1, why: 'Shadows are hard to see on dark backgrounds, so higher surfaces get a lighter tonal colour.' },
      ],
    });
  },
};
