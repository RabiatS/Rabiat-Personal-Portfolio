import { styleChapter, injectCSS, contrast, badge } from './_shared.js';

const FLAT2 = `
.dl-ui.s-flat.flat2 .button { box-shadow: 0 1px 2px rgba(0,0,0,.18), 0 2px 6px rgba(0,0,0,.08); }
.dl-ui.s-flat.flat2 .button.primary { box-shadow: 0 2px 6px rgba(192,57,43,.4); }
.dl-ui.s-flat.flat2 .card { box-shadow: 0 1px 3px rgba(44,62,80,.12), 0 8px 24px rgba(44,62,80,.08); }
.dl-ui.s-flat.flat2 .input { border-color: #c4ccd1; background: #fff; }
.dl-ui.s-flat.flat2 .knob, .dl-ui.s-flat.flat2 .thumb { box-shadow: 0 1px 3px rgba(0,0,0,.3); }
`;
// The well known 2013 era flat palette, with white text on top
const SWATCHES = [['Turquoise', '#1abc9c'], ['Emerald', '#2ecc71'], ['Peter river', '#3498db'], ['Amethyst', '#9b59b6'], ['Alizarin', '#e74c3c'], ['Pomegranate', '#c0392b'], ['Midnight blue', '#2c3e50']];

export default {
  mount(ctx) {
    injectCSS('flat2', FLAT2);
    styleChapter(ctx, {
      styles: ['flat'],
      title: 'Flat design',
      lede: 'No textures, no gloss, no bevels. Just shapes, solid colour and type.',
      tip: '<p>Flat design trusts layout, colour and typography to do the work that shadows and textures used to do. It is quick to build, scales to any screen and looks clean.</p><p>The catch: when nothing has depth, a button and a coloured label can look exactly the same, so people hesitate before they click.</p>',
      tryThis: '<p>Toggle <b>Flat 2.0</b> below and watch the buttons and the text field: a soft shadow and a visible border return just enough depth to say "press me" and "type here". Then look at the contrast table: many of the famous flat colours fail with white text.</p>',
      extra(ctx2, kit, api) {
        const box = ctx.h(`<div class="card"><h3 style="margin:0">Flat 2.0</h3><label class="check"><input type="checkbox"> Add subtle depth hints (shadows, field borders)</label>
          <table class="dl-tbl"><tr><th>Flat palette, white text</th><th>Ratio</th><th>AA</th></tr>
          ${SWATCHES.map(([n, c]) => { const r = contrast('#ffffff', c); return `<tr><td><span class="dl-sw" style="background:${c}"></span>${n} ${c}</td><td>${r.toFixed(2)}</td><td>${badge(r >= 4.5, r >= 4.5 ? 'pass' : r >= 3 ? 'large only' : 'fail')}</td></tr>`; }).join('')}
          </table><p class="hint">AA needs 4.5:1 for normal text and 3:1 for large text (24px, or 18.66px bold).</p></div>`);
        box.querySelector('input').addEventListener('change', (e) => kit.root.classList.toggle('flat2', e.target.checked), { signal: ctx.signal });
        api.extraHost.append(box);
      },
      when: [
        'Most product UI: dashboards, forms, content sites, design systems that must scale across many screens.',
        'When performance and consistency matter more than personality.',
        'Icons and illustration systems, where flat shapes stay readable at tiny sizes.',
      ],
      pitfalls: [
        'Weak signifiers: if buttons, tags and headings share the same flat colour block, people cannot tell what is clickable. Keep one clear button shape.',
        'Bright "flat palette" colours with white text often miss 4.5:1. The table on the left is computed live.',
        'Text fields with no border (just a light grey fill) are easy to miss, especially for people with low contrast sensitivity.',
        'Colour alone is not enough to show state. The switch should differ in knob position as well as colour, as it does here.',
      ],
      deep: '<p>An eyetracking study by Nielsen Norman Group (2017) compared weak flat signifiers with traditional ones. With weak signifiers, people took longer to find clickable elements and spent more fixations on the page. The fix most teams settled on is what people call <b>flat 2.0</b> or "almost flat": flat colour plus one or two depth cues where they carry meaning.</p><p>Flat also pushed typography forward. With no ornament, hierarchy has to come from size, weight and spacing, which is why the Principles chapters in this lab matter so much for flat work.</p>',
      history: '<p>The roots go back to Swiss graphic design of the 1950s. On screens, Microsoft led: the Zune player and Windows Phone 7 (2010) introduced the Metro language of type and coloured tiles, followed by Windows 8 (2012). Apple\'s iOS 7 (2013) made flat the default for the industry, and Google\'s Material design (2014) added rules for depth on top of it.</p>',
      quiz: [
        { q: 'What is the biggest usability risk of a purely flat interface?', choices: ['It cannot use colour', 'Clickable things stop looking clickable', 'It needs more images'], answer: 1, why: 'Without depth or borders, buttons can look like labels. Signifiers have to come from shape, colour and consistent placement instead.' },
        { q: 'White text on #1abc9c (turquoise) has a contrast ratio of about 2.4:1. Does it pass WCAG AA for body text?', choices: ['Yes, it is above 2', 'Only for large text', 'No, body text needs 4.5:1'], answer: 2, why: 'AA asks 4.5:1 for normal text and 3:1 for large text, so 2.4:1 fails both.' },
        { q: 'What does "flat 2.0" add back?', choices: ['Leather textures', 'Subtle shadows and borders where they signal interaction', 'Animated backgrounds'], answer: 1, why: 'It keeps the flat look but returns small depth cues to buttons, fields and cards.' },
      ],
    });
  },
};
