import { styleChapter, injectCSS } from './_shared.js';

export default {
  mount(ctx) {
    styleChapter(ctx, {
      styles: ['brutal', 'neobrutal'],
      title: 'Brutalism',
      lede: 'Show the raw materials. Default fonts, blue links, grey buttons, or their loud modern remix with thick outlines and hard shadows.',
      tip: '<p><b>Web brutalism</b> refuses polish on purpose: Times New Roman, underlined blue links, browser style grey buttons, a black and white photo. It feels honest, a bit rude, and very fast.</p><p><b>Neo-brutalism</b> keeps the rawness (thick black outlines, shadows with no blur) but adds bright flat colour and a modern grotesque typeface. It is brutalism that wants to be liked.</p>',
      tryThis: '<p>Flip between the two with the switch above. In neo-brutalism, press a button and hold: it slides into its own shadow, which is the whole affordance in one move. Drag the sliders below to change the outline and shadow, the two numbers that define the style.</p>',
      extra(ctx2, kit, a) {
        kit.root.classList.add('live');
        let bw = 3; let off = 6;
        const box = ctx.h('<div class="card"><h3 style="margin:0">Neo-brutal dials</h3></div>');
        const out = ctx.h('<pre class="code" style="font-size:11px"></pre>');
        box.append(
          ctx.slider({ label: 'Outline width', min: 1, max: 6, step: 1, value: bw, unit: 'px', onInput: (v) => { bw = v; upd(); } }),
          ctx.slider({ label: 'Hard shadow offset', min: 0, max: 14, step: 1, value: off, unit: 'px', onInput: (v) => { off = v; upd(); } }),
          out,
        );
        a.extraHost.append(box);
        function upd() {
          if (kit.style !== 'neobrutal' && out.textContent) a.setStyle('neobrutal');
          injectCSS('neobrutal-live', `.dl-ui.s-neobrutal.live .card, .dl-ui.s-neobrutal.live .nav { border-width: ${bw}px; box-shadow: ${off}px ${off}px 0 #000; }
.dl-ui.s-neobrutal.live .button, .dl-ui.s-neobrutal.live .input { border-width: ${bw}px; box-shadow: ${Math.round(off * 0.66)}px ${Math.round(off * 0.66)}px 0 #000; }
.dl-ui.s-neobrutal.live .button:active { transform: translate(${Math.round(off * 0.66)}px, ${Math.round(off * 0.66)}px); box-shadow: 0 0 0 #000; }`);
          out.textContent = `.card {\n  border: ${bw}px solid #000;\n  box-shadow: ${off}px ${off}px 0 #000; /* no blur */\n}`;
        }
        upd();
      },
      when: [
        'Brands that want to stand out from polished, interchangeable SaaS sites: indie tools, creative studios, zines, portfolios.',
        'Neo-brutalism works well for products with a playful, direct voice, and its high contrast outlines are a real accessibility plus.',
        'Raw brutalism suits text first sites where speed and honesty beat decoration.',
      ],
      pitfalls: [
        'Raw brutalism often breaks conventions on purpose (odd layouts, unlabelled controls). Breaking Jakob\'s law costs users time.',
        'Neo-brutal colour blocks with black text are usually fine, but check white text on mid tones (coral, lime) carefully.',
        'Hard shadows on everything flatten hierarchy: if every element shouts, none is the priority. Reserve the biggest shadow for the main action.',
        'Underlined blue links are actually great for accessibility. Keep link underlines even in the neo version.',
      ],
      deep: '<p>The defining trick of neo-brutalism is a shadow with zero blur: <code>box-shadow: 6px 6px 0 #000</code>. It reads as a flat cut-out sitting above the page, like a sticker or a printed block. Pressing moves the element by the same offset and removes the shadow, so it seems to land on the page.</p><p>Contrast is a strength here: black 3px outlines give every control a boundary far above the 3:1 non-text minimum, something neumorphism and glass struggle with.</p>',
      history: '<p>The name comes from Brutalist architecture of the 1950s to 1970s, from the French <i>beton brut</i>, raw concrete, a phrase linked to Le Corbusier. On the web, Pascal Deville\'s site brutalistwebsites.com (2014) collected raw, anti design sites and gave the movement a label. Neo-brutalism spread around 2021 and 2022 through product rebrands (Gumroad\'s is the one usually cited) and quickly became a recognisable startup look.</p>',
      quiz: [
        { q: 'What is the signature shadow of neo-brutalism?', choices: ['A large soft blur', 'An offset shadow with zero blur', 'An inner glow'], answer: 1, why: 'Hard, unblurred offset shadows (like 6px 6px 0 black) make elements look like cut-outs.' },
        { q: 'Where does the word brutalism come from?', choices: ['Beton brut, raw concrete in architecture', 'A JavaScript framework', 'A typeface'], answer: 0, why: 'Brutalist architecture showed raw concrete. Web brutalism shows the raw materials of the browser.' },
        { q: 'Which part of neo-brutalism helps accessibility?', choices: ['Thick high contrast outlines around controls', 'Random layouts', 'Pastel text'], answer: 0, why: 'Black outlines give every control a clear boundary, well above the 3:1 non-text contrast guideline.' },
      ],
    });
  },
};
