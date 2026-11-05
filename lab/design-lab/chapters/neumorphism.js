import { styleChapter, contrast, hslHex, badge } from './_shared.js';

export default {
  mount(ctx) {
    styleChapter(ctx, {
      styles: ['neu'],
      title: 'Neumorphism',
      lede: 'Controls pressed out of, or into, the same soft material as the background. Beautiful, and famously hard to read.',
      tip: '<p>Every element is the same colour as the page. Shape comes only from two shadows: a dark one on the bottom right and a light one on the top left, as if lit from the top left. Raised things look like soft plastic, pressed things look carved in.</p><p>Because the fill is identical to the background, the edge of each button is drawn only by shadow, and shadows are low contrast by nature.</p>',
      tryThis: '<p>Use the contrast checker below. The text starts at 3.3:1, which fails. Drag <b>Text darkness</b> until it passes AA. Then look at the row "button fill vs page": it is 1:1 no matter what you do. Tick <b>Accessible fix</b> to add a visible edge and see that row change.</p>',
      extra(ctx2, kit, api) {
        const R = kit.root;
        let inkL = 75 - 45 * 0.55; let depth = 42; let fix = false;
        const box = ctx.h('<div class="card"><h3 style="margin:0">Contrast checker</h3></div>');
        const tbl = ctx.h('<table class="dl-tbl"></table>');
        const s1 = ctx.slider({ label: 'Text darkness', min: 0, max: 100, step: 1, value: 45, fmt: (v) => `${Math.round(v)}%`, onInput: (v) => { inkL = 75 - v * 0.55; upd(); } });
        const s2 = ctx.slider({ label: 'Shadow depth', min: 0, max: 100, step: 1, value: depth, fmt: (v) => `${v}%`, onInput: (v) => { depth = v; upd(); } });
        const ck = ctx.h('<label class="check"><input type="checkbox"> Accessible fix: 1px edge and darker accent</label>');
        ck.querySelector('input').addEventListener('change', (e) => { fix = e.target.checked; upd(); }, { signal: ctx.signal });
        box.append(s1, s2, ck, tbl, ctx.h('<p class="hint">Text needs 4.5:1 (AA). Component boundaries need 3:1 (WCAG 2.1, 1.4.11 non-text contrast).</p>'));
        api.extraHost.append(box);
        const bg = '#e0e5ec';
        function upd() {
          const ink = hslHex(216, 15, inkL);
          const dark = hslHex(216, 26, 88 - depth * 0.4);
          const accent = fix ? '#4033c9' : '#5b4de0';
          const edge = fix ? hslHex(216, 18, 52) : 'transparent';
          R.style.setProperty('--ink', ink); R.style.setProperty('--dark', dark);
          R.style.setProperty('--accent', accent); R.style.setProperty('--edge', edge);
          const rows = [
            ['Body text', ink, bg, 4.5],
            ['Primary label', accent, bg, 4.5],
            ['Placeholder', '#a6b1c2', bg, 4.5],
            ['Dark shadow vs page', dark, bg, 3],
            ['Light shadow vs page', '#ffffff', bg, 3],
            ['Button fill vs page', bg, bg, 3],
          ];
          if (fix) rows.push(['Button edge vs page', edge, bg, 3]);
          tbl.innerHTML = `<tr><th>Pair</th><th>Ratio</th><th>Need</th></tr>${rows.map(([n, a, b, need]) => { const r = contrast(a, b); return `<tr><td><span class="dl-sw" style="background:${a}"></span>${n}</td><td>${r.toFixed(2)}</td><td>${badge(r >= need, `${need}:1`)}</td></tr>`; }).join('')}`;
        }
        api.onStyle = (id) => { if (id === 'neu') upd(); };
        upd();
      },
      when: [
        'Small, decorative or showcase pieces: a music player concept, a smart home dial, a portfolio shot.',
        'Single controls where the pressed and unpressed states can be large and obvious.',
        'Rarely for full products. If you do, pair it with real borders, strong text colour and a clear accent for state.',
      ],
      pitfalls: [
        'Button fill equals page colour, so the boundary contrast is 1:1. Only the shadow marks the edge, and the shadow itself is usually well under 3:1.',
        'Pressed and unpressed look almost the same to many people, so toggle state is unclear. Always add a colour or icon change, never only an inset shadow.',
        'Light grey text on light grey is the default look of the style and often fails AA. Darken text even if the mockups did not.',
        'It barely works in dark mode: dark shadows on a dark surface vanish.',
      ],
      deep: '<p>The recipe is a two shadow formula: <code>x x blur dark, -x -x blur light</code>. The light shadow is lighter than the background, the dark shadow darker, and the distance and blur are usually the same. Swap both to <code>inset</code> and the element looks pressed.</p><p>Why contrast fails structurally: WCAG contrast compares two flat colours. A neumorphic edge is a gradient from the background to a slightly darker or lighter tone. Even its darkest pixel here is only about 1.7:1 against the page. You can push the shadow darker, but then the soft look is gone, which is the honest trade off of this style.</p>',
      history: '<p>Neumorphism took off around the end of 2019 from Dribbble concept shots, notably Alexander Plyuto\'s "Skeuomorph Mobile Banking". Designer Michal Malewicz wrote about it and the name stuck, a mix of "new" and "skeuomorphism". It was everywhere in concept art in 2020 and rarely shipped in real products, mostly because of the contrast problems you just measured.</p>',
      quiz: [
        { q: 'Why is a neumorphic button hard to see for many users?', choices: ['It uses too many colours', 'Its fill is the same colour as the page, so only faint shadows draw its edge', 'It is too large'], answer: 1, why: 'The fill vs page contrast is 1:1. The edge exists only as a soft shadow, usually well below 3:1.' },
        { q: 'What contrast does WCAG 2.1 ask for the visual boundary of a control, like a button outline?', choices: ['1.5:1', '3:1', '7:1'], answer: 1, why: 'Success criterion 1.4.11 (non-text contrast) asks 3:1 for parts of controls needed to identify them.' },
        { q: 'How do you make a neumorphic element look pressed in?', choices: ['Make both shadows inset', 'Remove the light shadow only', 'Add a red border'], answer: 0, why: 'The same pair of shadows, drawn inset, turns a bump into a dip.' },
      ],
    });
  },
};
