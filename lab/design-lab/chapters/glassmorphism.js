import { styleChapter, contrast, over, hexToRgb, badge, rgbToHex } from './_shared.js';

const BACKDROP = [['Page', '#1d1240'], ['Blue blob', '#3d7bff'], ['Pink blob', '#ff4fa3'], ['Orange blob', '#ffb347']];

export default {
  mount(ctx) {
    styleChapter(ctx, {
      styles: ['glass'],
      title: 'Glassmorphism',
      lede: 'Frosted panels floating over colour. The background shows through, blurred, so you keep a sense of place.',
      tip: '<p>Each panel is a see-through tint (white at 16% here) with <code>backdrop-filter: blur()</code>, which blurs whatever is behind it, like frosted glass. A thin bright border and a top highlight sell the edge of the glass.</p><p>The problem is that the text sits on a background you do not control. When a bright blob drifts behind white text, the contrast drops.</p>',
      tryThis: '<p>Watch the orange blob pass behind the cards. Then use the controls: set the blur to 0 and see how busy the text background becomes. Raise the tint, or switch to <b>Dark glass</b>, until the worst case row passes AA.</p>',
      extra(ctx2, kit, api) {
        const R = kit.root;
        let tint = 'light'; let a = 0.16; let blur = 18;
        const box = ctx.h('<div class="card"><h3 style="margin:0">Legibility</h3></div>');
        const seg = ctx.seg([['light', 'Light glass'], ['dark', 'Dark glass']], 'light', (v) => { tint = v; upd(); });
        const s1 = ctx.slider({ label: 'Tint opacity', min: 0, max: 0.8, step: 0.01, value: a, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => { a = v; upd(); } });
        const s2 = ctx.slider({ label: 'Backdrop blur', min: 0, max: 40, step: 1, value: blur, unit: 'px', onInput: (v) => { blur = v; upd(); } });
        const pause = ctx.h('<label class="check"><input type="checkbox"> Pause the background</label>');
        pause.querySelector('input').addEventListener('change', (e) => R.querySelectorAll('.blobs i').forEach((i) => { i.style.animationPlayState = e.target.checked ? 'paused' : ''; }), { signal: ctx.signal });
        const tbl = ctx.h('<table class="dl-tbl"></table>');
        box.append(seg, s1, s2, pause, tbl, ctx.h('<p class="hint">White text over the tint over each colour behind it. Blur mixes colours, so the real value lies between these rows. Design for the worst one.</p>'));
        api.extraHost.append(box);
        function upd() {
          const t = tint === 'light' ? [255, 255, 255] : [20, 10, 40];
          R.style.setProperty('--glass', t.join(','));
          R.style.setProperty('--glass-a', a);
          R.style.setProperty('--glass-blur', `${blur}px`);
          let worst = 99;
          const rows = BACKDROP.map(([n, c]) => {
            const mix = over(t, a, hexToRgb(c)); const r = contrast([255, 255, 255], mix); worst = Math.min(worst, r);
            return `<tr><td><span class="dl-sw" style="background:${rgbToHex(...mix)}"></span>${n}</td><td>${r.toFixed(2)}</td><td>${badge(r >= 4.5, r >= 4.5 ? 'AA' : 'fail')}</td></tr>`;
          });
          tbl.innerHTML = `<tr><th>Behind the text</th><th>Ratio</th><th>4.5:1</th></tr>${rows.join('')}<tr><td><b>Worst case</b></td><td><b>${worst.toFixed(2)}</b></td><td>${badge(worst >= 4.5, worst >= 4.5 ? 'pass' : 'fail')}</td></tr>`;
        }
        api.onStyle = (id) => { if (id === 'glass') upd(); };
        upd();
      },
      when: [
        'Overlays that should keep context: sidebars, sheets, menus and toolbars floating over content or media.',
        'Backgrounds you control (a brand gradient, a blurred photo), so you can test the worst case.',
        'Sparingly: one or two glass layers. A whole page of glass becomes a muddy blur.',
      ],
      pitfalls: [
        'Contrast changes as the background moves. Test the brightest and the darkest thing that can sit behind your text.',
        'Low tint opacity looks elegant in mockups and fails in practice. A darker or more opaque tint, or a text shadow, fixes most cases.',
        'backdrop-filter is costly to render on low end phones, especially when animated content sits behind it. Provide a solid fallback with @supports.',
        'Some users turn on "reduce transparency" in their OS. Respect prefers-reduced-transparency where supported, and pause decorative motion for prefers-reduced-motion.',
      ],
      deep: '<p>The blur is what makes glass usable: without it, every edge of the background competes with the letter shapes, even when the average contrast is fine. A blur radius of 16 to 30px is typical.</p><p>A sturdy production pattern:</p><pre class="code" style="font-size:11px">.card { background: rgba(255,255,255,.9); }\n@supports (backdrop-filter: blur(1px)) {\n  .card {\n    background: rgba(255,255,255,.55);\n    backdrop-filter: blur(20px) saturate(160%);\n  }\n}</pre><p><code>saturate()</code> keeps colours lively after blurring, which otherwise greys them out.</p>',
      history: '<p>Translucent windows go back to Windows Vista\'s Aero Glass (2007). iOS 7 (2013) brought live blurred backgrounds to notification panels, Microsoft\'s Fluent design added "acrylic" (2017), and macOS Big Sur (2020) used blur widely. The word glassmorphism was popularised in 2020, again by Michal Malewicz. In 2025 Apple introduced a new "Liquid Glass" material across its platforms, which brought the same legibility debates back.</p>',
      quiz: [
        { q: 'What does backdrop-filter: blur() blur?', choices: ['The element\'s own text', 'Whatever is behind the element', 'The whole page'], answer: 1, why: 'It filters the backdrop, the pixels behind the element, which creates the frosted glass effect.' },
        { q: 'Your glass card passes contrast over the dark page, but a bright shape sometimes moves behind it. What should you check?', choices: ['Only the average colour', 'The worst case: the brightest thing that can sit behind the text', 'Nothing, blur fixes contrast'], answer: 1, why: 'Contrast must hold for every background the text can land on, not just the average.' },
        { q: 'Which change raises text contrast on light glass with white text?', choices: ['Lower the tint opacity', 'Use a darker tint or a more opaque one', 'Increase the animation speed'], answer: 1, why: 'A darker, denser tint pushes the colour behind the white text down, raising the ratio.' },
      ],
    });
  },
};
