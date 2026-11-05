import { styleChapter, injectCSS } from './_shared.js';

export default {
  mount(ctx) {
    styleChapter(ctx, {
      styles: ['clay'],
      title: 'Claymorphism',
      lede: 'Soft, inflated shapes in pastel colours, like modelling clay. Friendly and tactile, with better contrast than neumorphism.',
      tip: '<p>Clay surfaces use three shadows at once. An <b>outer</b> drop shadow lifts the shape off the page. An <b>inner dark</b> shadow on the bottom right and an <b>inner light</b> shadow on the top left make the surface itself look rounded, like a pillow.</p><p>Unlike neumorphism, clay shapes have their own colour, so they stand apart from the background and from each other.</p>',
      tryThis: '<p>Switch the three shadows on and off below. With only the outer shadow, the cards look like flat stickers. Add the two inner shadows and they swell. Then drag <b>Puffiness</b> to see how radius and shadow size work together.</p>',
      extra(ctx2, kit, api) {
        const R = kit.root; R.classList.add('live');
        const on = { outer: true, dark: true, light: true }; let puff = 1;
        const box = ctx.h(`<div class="card"><h3 style="margin:0">The three shadows</h3>
          <label class="check"><input type="checkbox" data-k="outer" checked> Outer drop shadow</label>
          <label class="check"><input type="checkbox" data-k="dark" checked> Inner shadow, dark (bottom right)</label>
          <label class="check"><input type="checkbox" data-k="light" checked> Inner shadow, light (top left)</label></div>`);
        const out = ctx.h('<pre class="code" style="font-size:11px;white-space:pre-wrap"></pre>');
        const s = ctx.slider({ label: 'Puffiness', min: 0.2, max: 2, step: 0.05, value: 1, fmt: (v) => `${v.toFixed(2)}x`, onInput: (v) => { puff = v; upd(); } });
        box.append(s, out);
        box.querySelectorAll('input[type=checkbox]').forEach((i) => i.addEventListener('change', () => { on[i.dataset.k] = i.checked; upd(); }, { signal: ctx.signal }));
        api.extraHost.append(box);
        function upd() {
          const p = puff; const f = (v) => Math.round(v * p);
          const parts = [];
          if (on.outer) parts.push(`${f(14)}px ${f(18)}px ${f(36)}px rgba(150,110,165,.32)`);
          if (on.dark) parts.push(`inset -${f(8)}px -${f(10)}px ${f(18)}px rgba(214,178,214,.55)`);
          if (on.light) parts.push(`inset ${f(8)}px ${f(8)}px ${f(16)}px rgba(255,255,255,.95)`);
          const shadow = parts.length ? parts.join(',\n    ') : 'none';
          const radius = Math.round(8 + 24 * p);
          injectCSS('clay-live', `.dl-ui.s-clay.live .nav, .dl-ui.s-clay.live .card { border-radius: ${radius}px; box-shadow: ${shadow}; }`);
          out.textContent = `border-radius: ${radius}px;\nbox-shadow:\n    ${shadow};`;
        }
        upd();
      },
      when: [
        'Playful products: kids\' apps, onboarding, games, wellbeing and finance apps that want to feel gentle.',
        'Illustration heavy landing pages, often paired with 3D clay style icons.',
        'Cards, badges and big buttons. It suits large, few elements better than dense tables.',
      ],
      pitfalls: [
        'Pastel on pastel is easy to make too light. Keep body text dark (the recipe uses #3b2f4a, about 12:1 on the cards).',
        'Heavy rounding and inner shadows eat space: in dense UIs, labels get cramped.',
        'White text on mid tone pastels often fails. The primary button here uses a deeper violet so white text passes AA.',
        'Pressed states need more than a shadow change. Scale or colour change helps (the recipe shrinks the button slightly).',
      ],
      deep: '<p>Why clay reads as 3D: our visual system assumes light from above. A light inner edge at the top left and a dark inner edge at the bottom right is exactly the shading of a convex bump lit from the top left. Turn the image upside down and it would look dented.</p><p>Compared with neumorphism, the outer shadow is offset further and coloured with the hue of the surface (a pinkish violet here, not grey), which keeps the scene soft instead of dirty.</p>',
      history: '<p>Claymorphism grew around 2021 alongside the trend for soft 3D illustrations made in tools like Blender and Spline. Design writers gave it the name as a friendlier, more colourful sibling of neumorphism. It is still mostly a marketing and illustration style rather than a full product system.</p>',
      quiz: [
        { q: 'Which shadows make a clay card look rounded rather than just lifted?', choices: ['Only a drop shadow', 'The two inner shadows (dark bottom right, light top left)', 'A thick black border'], answer: 1, why: 'The inner light and dark shading models the curved surface. The outer shadow only lifts it off the page.' },
        { q: 'Why does claymorphism usually have better contrast than neumorphism?', choices: ['Shapes have their own colours, distinct from the background', 'It uses no shadows', 'It is always dark mode'], answer: 0, why: 'Neumorphic elements share the background colour. Clay elements are their own colour, so edges are visible.' },
        { q: 'Where does claymorphism fit best?', choices: ['Dense data tables', 'Playful, friendly products with few large elements', 'Legal documents'], answer: 1, why: 'Rounded, puffy shapes need room. They shine in onboarding, kids\' apps and illustration heavy pages.' },
      ],
    });
  },
};
