import { styleChapter, injectCSS } from './_shared.js';

// Overrides that switch individual skeuomorphic cues off, so you can see what each one contributes.
const LAYERS = `
.dl-ui.s-skeuo.no-tex { background: #4a2f1e; }
.dl-ui.s-skeuo.no-gloss .nav, .dl-ui.s-skeuo.no-gloss .button { background: #e4e4e4; }
.dl-ui.s-skeuo.no-gloss .button.primary, .dl-ui.s-skeuo.no-gloss .fill { background: #2b78cf; }
.dl-ui.s-skeuo.no-gloss .card { background: #f6eedb; }
.dl-ui.s-skeuo.no-gloss .thumb, .dl-ui.s-skeuo.no-gloss .knob { background: #d6d6d6; }
.dl-ui.s-skeuo.no-gloss .switch { background: #c9c9c9; }
.dl-ui.s-skeuo.no-gloss .switch[aria-checked="true"] { background: #2b78cf; }
.dl-ui.s-skeuo.no-stitch .card { outline: none; }
.dl-ui.s-skeuo.no-stitch .media { transform: none; border: 0; }
.dl-ui.s-skeuo.no-shadow *, .dl-ui.s-skeuo.no-shadow { box-shadow: none !important; text-shadow: none !important; }
`;

export default {
  mount(ctx) {
    injectCSS('skeuo-layers', LAYERS);
    styleChapter(ctx, {
      styles: ['skeuo'],
      title: 'Skeuomorphism',
      lede: 'Make the screen look like the physical thing it replaces, so people already know how to use it.',
      tip: '<p>A skeuomorph is a design that keeps the look of an older material even though it no longer needs it. Here the card is stitched paper, the photo is a print taped down at an angle, the buttons are glossy plastic you could press, and the switch sits in a groove.</p><p>Every one of those cues answers a question for a new user: <i>can I press this?</i> Yes, it bulges. <i>Is it on?</i> Yes, it is lit blue.</p>',
      tryThis: '<p>Turn the cues off one by one below. Notice which one makes the buttons stop looking pressable. Then press and hold a button: the shadow flips inward, like a real key going down.</p>',
      extra(ctx2, kit, api) {
        const box = ctx.h(`<div class="card"><h3 style="margin:0">Peel off the layers</h3>
          <label class="check"><input type="checkbox" data-c="no-tex" checked> Texture (leather and linen)</label>
          <label class="check"><input type="checkbox" data-c="no-gloss" checked> Gradients and gloss</label>
          <label class="check"><input type="checkbox" data-c="no-stitch" checked> Stitching and the taped photo</label>
          <label class="check"><input type="checkbox" data-c="no-shadow" checked> Shadows and embossed text</label>
          <p class="hint">With everything off you are most of the way to flat design.</p></div>`);
        box.querySelectorAll('input').forEach((i) => i.addEventListener('change', () => kit.root.classList.toggle(i.dataset.c, !i.checked), { signal: ctx.signal }));
        api.extraHost.append(box);
      },
      when: [
        'Teaching a brand new interaction, where a familiar physical metaphor lowers the learning cost (the first touchscreen phones, music apps with knobs and faders).',
        'Playful or premium products where craft is part of the message: games, audio plugins, watch faces.',
        'Small doses inside a calmer UI: a single tactile switch or dial can be lovely.',
      ],
      pitfalls: [
        'Busy textures behind text lower contrast unevenly. Check text against the lightest and darkest parts of the texture, not the average.',
        'Embossed text (a white 1px shadow) looks crisp to designers but blurs letter shapes for low vision users at small sizes.',
        'Metaphors can mislead: a "page curl" or a fake bookshelf invites gestures that may not work.',
        'Heavy imagery costs bandwidth and memory. Today, CSS gradients like the ones in the recipe are far cheaper than the bitmap textures of 2010.',
      ],
      deep: '<p>The functional part of skeuomorphism is the <b>signifier</b>, Don Norman\'s word for a perceivable cue that tells you what action is possible. Highlights on the top edge plus a shadow below say "raised, pressable". An inset shadow says "a slot you type into". Flat design removed the decoration but had to keep some signifiers, which is why most "flat" interfaces today still use subtle shadows.</p><p>Notice the light source in the recipe is consistent: every highlight is on top, every shadow falls downward. Mixing light directions is the most common way a skeuomorphic design looks fake.</p>',
      history: '<p>The word comes from Greek <i>skeuos</i> (container, tool) and <i>morphe</i> (shape). Long before screens, early plastic radios were moulded to look like wooden cabinets.</p><p>In software it peaked with Apple: Mac OS X\'s glossy Aqua buttons (2001), then iPhone OS and iOS up to version 6, with a leather and torn paper calendar, a felt Game Center and a yellow legal pad Notes app. iOS 7 (2013) replaced almost all of it with a flat look, and most of the industry followed. Neumorphism (2019) and Apple\'s later glass materials are both, in part, a return to physical cues.</p>',
      quiz: [
        { q: 'What is the main usability benefit of skeuomorphic cues?', choices: ['They load faster than flat designs', 'They tell people what is pressable or typeable by borrowing from physical objects', 'They always have better contrast'], answer: 1, why: 'Bulges, grooves and glossy highlights are signifiers: they map screen controls onto things people already know how to use.' },
        { q: 'A button has its highlight on the bottom edge and its shadow above it. What happens?', choices: ['It reads as pressed in, or the lighting looks wrong', 'Nothing, light direction does not matter', 'It reads as more clickable'], answer: 0, why: 'We assume light from above. Reversing it makes the shape read as sunken or simply fake.' },
        { q: 'Which change in 2013 is usually seen as the end of mainstream skeuomorphism?', choices: ['Material design', 'Windows Vista', 'iOS 7'], answer: 2, why: 'iOS 7 dropped the leather, felt and gloss for flat colour, thin type and translucency.' },
      ],
    });
  },
};
