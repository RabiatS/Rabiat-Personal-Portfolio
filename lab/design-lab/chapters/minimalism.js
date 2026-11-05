import { styleChapter, injectCSS, useStyle, KIT_HTML, STYLES, STYLE_ORDER } from './_shared.js';

// Count the visual "ingredients" a style uses, from the browser's computed styles.
function audit(root) {
  const colours = new Set(); const type = new Set(); const radii = new Set(); let shadows = 0; let gradients = 0;
  const visible = (c) => c && !/rgba\(.*,\s*0\)$/.test(c) && c !== 'transparent';
  root.querySelectorAll('*').forEach((el) => {
    if (el.closest('svg') || el.closest('.blobs') || el.classList.contains('grid')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none') return;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || el.tagName === 'INPUT';
    if (hasText) { colours.add(cs.color); type.add(`${cs.fontFamily.split(',')[0]} ${cs.fontSize} ${cs.fontWeight}`); }
    if (visible(cs.backgroundColor)) colours.add(cs.backgroundColor);
    if (cs.backgroundImage !== 'none') gradients++;
    if (parseFloat(cs.borderTopWidth) > 0 && visible(cs.borderTopColor)) colours.add(cs.borderTopColor);
    if (cs.boxShadow !== 'none') shadows++;
    if (parseFloat(cs.borderTopLeftRadius) > 0) radii.add(cs.borderTopLeftRadius);
  });
  return { colours: colours.size, type: type.size, radii: radii.size, shadows, gradients };
}

export default {
  mount(ctx) {
    injectCSS('audit', '.dl-ui.audit, .dl-ui.audit * { transition: none !important; animation: none !important; }');
    styleChapter(ctx, {
      styles: ['minimal', 'swiss'],
      title: 'Minimalism and Swiss style',
      lede: 'Take things away until only what matters is left. Then let a grid and good type carry the design.',
      tip: '<p><b>Minimalism</b> is reduction: one typeface, a near white page, hairline borders, and a single accent (here near black). Every element left has a job.</p><p><b>Swiss style</b> is the older, bolder parent: a strict grid, a neutral sans serif, text set flush left and ragged right, big type for contrast, photography or geometry instead of decoration, and often one strong colour (red).</p>',
      tryThis: '<p>Press <b>Audit every style</b> below. It reads the browser\'s computed CSS for the whole sample UI and counts colours, type styles, shadows, gradients and corner radii. Compare minimal with skeuomorphism. Fewer ingredients is not automatically better, but it is easier to keep consistent.</p>',
      extra(ctx2, kit, api) {
        const box = ctx.h('<div class="card"><h3 style="margin:0">Complexity audit</h3><p class="small muted">Counted live from computed styles of the sample UI.</p></div>');
        const tbl = ctx.h('<table class="dl-tbl"></table>');
        const btn = ctx.h('<button class="btn ghost sm" style="align-self:flex-start">Audit every style</button>');
        box.append(btn, tbl);
        api.extraHost.append(box);
        const head = '<tr><th>Style</th><th title="distinct colours">Col</th><th title="distinct type styles">Type</th><th title="elements with shadows">Shd</th><th title="gradients">Grad</th><th title="distinct corner radii">Rad</th></tr>';
        const row = (n, r, hi) => `<tr style="${hi ? 'color:var(--text)' : ''}"><td>${n}</td><td>${r.colours}</td><td>${r.type}</td><td>${r.shadows}</td><td>${r.gradients}</td><td>${r.radii}</td></tr>`;
        const one = () => { tbl.innerHTML = head + row(STYLES[kit.style].name, audit(kit.root), true); };
        btn.addEventListener('click', () => {
          const tmp = document.createElement('div');
          tmp.className = 'dl-ui surface audit';
          tmp.style.cssText = 'position:fixed;left:-3000px;top:0;width:700px;visibility:hidden';
          tmp.innerHTML = KIT_HTML; document.body.append(tmp);
          const rows = STYLE_ORDER.map((id) => { useStyle(id); tmp.className = `dl-ui surface audit s-${id}`; return [id, audit(tmp)]; });
          tmp.remove();
          rows.sort((x, y) => (x[1].colours + x[1].shadows + x[1].gradients) - (y[1].colours + y[1].shadows + y[1].gradients));
          tbl.innerHTML = head + rows.map(([id, r]) => row(STYLES[id].name, r, id === kit.style)).join('');
        }, { signal: ctx.signal });
        api.onStyle = () => setTimeout(one, 260);
      },
      when: [
        'Content first products: reading, documentation, portfolios, e-commerce where the products are the colour.',
        'Tools people use for hours, where calm beats novelty.',
        'Swiss style for information design: signage, data, posters, timetables and any layout that must be scanned fast.',
      ],
      pitfalls: [
        'Too minimal hides affordances: icon only buttons, borderless fields and light grey text. Keep labels and visible field edges.',
        'Hairline grey borders (#e7e5e4 on white) are about 1.3:1. They are decoration, so make sure the control is still identifiable without them (a label, placeholder or fill).',
        'Mid greys for secondary text drift below 4.5:1 easily. The recipe\'s #71717a on near white is right at the edge (about 4.6:1).',
        'Swiss red with white text needs a deep red. Bright reds like #ff3b30 fail with white text.',
      ],
      deep: '<p>Minimalism is not "less stuff", it is a lower ratio of noise to signal. A useful test: for each colour, border, shadow and font size, ask what it tells the user. If the answer is nothing, remove it. If removing it makes something ambiguous, it was signal, keep it.</p><p>Swiss designers did not see their grids as a style but as a method: measure the content, set the column and baseline grid, and let every element snap to it. The Alignment and grids chapter lets you try exactly that.</p>',
      history: '<p>The International Typographic Style grew in Switzerland in the 1950s with designers like Josef Müller-Brockmann, Armin Hofmann and Emil Ruder. Helvetica (1957, by Max Miedinger and Eduard Hoffmann) became its emblem. In product design, Dieter Rams at Braun summed up minimalism as "less, but better", and his ten principles of good design still circulate in UI teams. Flat design and most modern design systems inherit directly from both.</p>',
      quiz: [
        { q: 'Which is a hallmark of Swiss style?', choices: ['Centred script fonts and ornaments', 'A strict grid, sans serif type set flush left, ragged right', 'Glossy 3D buttons'], answer: 1, why: 'Grids, neutral sans serifs, asymmetric flush left layouts and strong type contrast define it.' },
        { q: 'What is the main risk of going too minimal?', choices: ['Pages load too fast', 'Controls lose the cues that show they are controls', 'Too many colours'], answer: 1, why: 'Removing borders, labels and contrast can strip away signifiers people need.' },
        { q: 'Dieter Rams summed up his approach as...', choices: ['More is more', 'Less, but better', 'Form follows fun'], answer: 1, why: 'Weniger, aber besser: less, but better.' },
      ],
    });
  },
};
