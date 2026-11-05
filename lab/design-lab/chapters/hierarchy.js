import { scrollStage, contrast } from './_shared.js';

const ITEMS = [
  // key, html, size, weight, colour, order when position is on, order when off
  ['ey', 'New for summer', 12, 600, '#b4441c', 0, 3],
  ['hd', 'Trail pass', 42, 800, '#1d1d1b', 1, 6],
  ['sub', 'Unlimited guided walks in 40 parks, all season long.', 16, 400, '#55554f', 2, 5],
  ['price', '£29 <span style="font-size:.5em;font-weight:500">/ season</span>', 30, 700, '#1d1d1b', 3, 2],
  ['cta', 'Get the pass', 16, 600, '#ffffff', 4, 4],
  ['link', 'Compare plans', 14, 500, '#1d1d1b', 5, 1],
  ['fine', 'Prices include VAT. Cancel any time from your account.', 12, 400, '#8a8a83', 6, 0],
];
const BG = '#fbfaf7'; const FLAT = '#6b6b66'; const ACC = '#b4441c';

export default {
  mount(ctx) {
    const { center } = scrollStage(ctx);
    const wrap = ctx.h('<div class="vh-wrap"><div class="vh-art"></div></div>');
    center.append(wrap, ctx.h('<p class="dl-cap">Numbers show a rough prediction of where the eye lands first</p>'));
    const art = wrap.firstChild;
    const els = {};
    for (const [k, html] of ITEMS) {
      const el = document.createElement(k === 'cta' ? 'button' : k === 'hd' ? 'h3' : 'p');
      el.className = k === 'cta' ? 'vh-cta' : k === 'link' ? 'vh-link' : '';
      el.innerHTML = html; art.append(el); els[k] = el;
    }
    const on = { size: true, weight: true, colour: true, position: true };
    let squint = false; let rank = true;

    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">Visual hierarchy</h2>'), ctx.h('<p class="lede">Hierarchy decides what people see first, second and third. You build it with four tools: size, weight, colour and position.</p>'));
    const box = ctx.h(`<div class="card"><h3 style="margin:0">Tools</h3>
      ${['size', 'weight', 'colour', 'position'].map((k) => `<label class="check"><input type="checkbox" data-k="${k}" checked> ${k[0].toUpperCase() + k.slice(1)}</label>`).join('')}
      <div class="row"><button class="btn ghost sm" data-a="none">All off</button><button class="btn ghost sm" data-a="all">All on</button></div></div>`);
    const tools = ctx.h(`<div class="card"><h3 style="margin:0">Tests</h3><label class="check"><input type="checkbox" data-t="squint"> Squint test (blur the page)</label><label class="check"><input type="checkbox" data-t="rank" checked> Show predicted reading order</label></div>`);
    P.append(box, tools);
    const stat = ctx.h('<div class="stat"></div>');
    P.append(stat);
    box.querySelectorAll('input').forEach((i) => i.addEventListener('change', () => { on[i.dataset.k] = i.checked; upd(); }, { signal: ctx.signal }));
    box.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { const v = b.dataset.a === 'all'; box.querySelectorAll('input').forEach((i) => { i.checked = v; on[i.dataset.k] = v; }); upd(); }, { signal: ctx.signal }));
    tools.querySelectorAll('input').forEach((i) => i.addEventListener('change', () => { if (i.dataset.t === 'squint') squint = i.checked; else rank = i.checked; upd(); }, { signal: ctx.signal }));

    P.append(ctx.h('<div class="card tip"><p>A page with no hierarchy makes the reader do the sorting. Every element shouts at the same volume, so people scan, get lost, and miss the one thing you wanted them to do.</p><p>Good hierarchy has one clear first stop (here the name and the price), one clear action (the button), and lets the small print be small.</p></div>'));
    P.append(ctx.h('<div class="card try"><p>Press <b>All off</b>: everything is the same size, weight and grey, in a jumbled order. Now switch the tools on one at a time and watch the numbers. Which single tool does the most? Then turn on the <b>squint test</b>. If you can still see the name, price and button through the blur, the hierarchy works.</p></div>'));
    P.append(ctx.h(`<div class="card deep"><p><b>The squint test</b> is an old designer trick: blur your eyes (or the screen) so you cannot read words. What remains is pure visual weight, which is what drives the first glance.</p>
      <p><b>The prediction</b> here is a simple salience model, not eye tracking. Each element scores <code>size² × weight × (contrast − 1) × position</code>, where position favours the top. It ranks the top three. Real attention also depends on faces, motion, colour pop and the reader's goal.</p>
      <p><b>Reading patterns.</b> Eye tracking studies (notably by Nielsen Norman Group) describe an F shaped scan on text heavy pages and a Z pattern on sparse ones. Strong hierarchy can override both by giving the eye a clear path.</p></div>`));

    function salience() {
      const R = art.getBoundingClientRect(); const out = [];
      for (const [k] of ITEMS) {
        const el = els[k]; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
        let fs = parseFloat(cs.fontSize); const fw = parseFloat(cs.fontWeight) || 400;
        let ink = cs.color;
        if (k === 'cta' && on.colour) { ink = ACC; fs = Math.max(fs, r.height * 0.6); }
        const rgb = ink.match(/\d+/g) ? ink.match(/\d+/g).slice(0, 3).map(Number) : [0, 0, 0];
        const c = contrast(typeof ink === 'string' && ink.startsWith('#') ? ink : rgb, BG);
        const pos = 1.25 - 0.5 * ((r.top - R.top) / R.height);
        out.push([k, fs * fs * (fw / 400) * (c - 1) * pos]);
      }
      return out.sort((a, b) => b[1] - a[1]);
    }

    function upd() {
      for (const [k, , size, weight, colour, o1, o2] of ITEMS) {
        const el = els[k];
        el.style.fontSize = `${on.size ? size : 15}px`;
        el.style.fontWeight = on.weight ? weight : 400;
        el.style.order = on.position ? o1 : o2;
        if (k === 'cta') {
          el.style.background = on.colour ? ACC : 'transparent';
          el.style.borderColor = on.colour ? ACC : FLAT;
          el.style.color = on.colour ? '#ffffff' : FLAT;
          el.style.padding = on.size ? '12px 22px' : '6px 12px';
        } else el.style.color = on.colour ? colour : FLAT;
        el.style.letterSpacing = k === 'ey' && on.size ? '.12em' : '0';
        el.style.textTransform = k === 'ey' && on.weight ? 'uppercase' : 'none';
      }
      art.style.display = 'flex';
      art.classList.toggle('squint', squint);
      art.querySelectorAll('.vh-badge').forEach((b) => b.remove());
      // measure after styles settle
      clearTimeout(upd.t);
      upd.t = setTimeout(() => {
        const s = salience();
        if (rank) s.slice(0, 3).forEach(([k], i) => els[k].append(ctx.h(`<span class="vh-badge" aria-hidden="true">${i + 1}</span>`)));
        const total = s.reduce((a, x) => a + x[1], 0);
        const top = s[0][1] / total;
        const n = Object.values(on).filter(Boolean).length;
        stat.innerHTML = `<div><b>${n} of 4</b><span>Tools on</span></div><div><b>${Math.round(top * 100)}%</b><span>Weight of #1</span></div><div><b>${(s[0][1] / s[1][1]).toFixed(1)}x</b><span>#1 vs #2</span></div>`;
      }, 340);
    }
    upd();

    ctx.quiz([
      { q: 'What does the squint test check?', choices: ['Spelling', 'Whether the most important elements still stand out when you cannot read', 'Loading speed'], answer: 1, why: 'Blurring removes the words and leaves only visual weight, which is what drives the first glance.' },
      { q: 'Which is NOT one of the main tools of hierarchy?', choices: ['Size', 'Colour and contrast', 'The file name of the image'], answer: 2, why: 'Size, weight, colour/contrast and position (plus spacing) build hierarchy.' },
      { q: 'If everything on a page is big, bold and bright, what happens?', choices: ['Everything gets noticed', 'Nothing stands out, so there is no hierarchy', 'The page loads faster'], answer: 1, why: 'Hierarchy is relative. Emphasis only works against calmer surroundings.' },
    ]);
  },
};
