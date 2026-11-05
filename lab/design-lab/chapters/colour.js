import { scrollStage, makeKit, injectCSS, hslHex, hslToRgb, hexToRgb, rgbToHsl, contrast, badge, clamp } from './_shared.js';

const RULES = {
  complementary: { name: 'Complementary', hues: [0, 180], about: 'Opposite on the wheel. Maximum contrast and energy. Use one as the main colour and the other only as an accent.' },
  analogous: { name: 'Analogous', hues: [0, -30, 30], about: 'Neighbours on the wheel. Calm and natural, like a sunset. Needs a contrast of lightness to avoid mush.' },
  triadic: { name: 'Triadic', hues: [0, 120, 240], about: 'Three hues evenly spaced. Lively and balanced, but hard to control. Let one dominate.' },
  split: { name: 'Split complementary', hues: [0, 150, 210], about: 'The two neighbours of the complement. Nearly as much contrast as complementary, less tension.' },
  square: { name: 'Square (tetradic)', hues: [0, 90, 180, 270], about: 'Four hues, evenly spaced. Rich, and the hardest to balance. Mostly for illustration.' },
};

export default {
  mount(ctx) {
    const { center } = scrollStage(ctx);
    const board = ctx.h(`<div class="dl-board">
      <div class="dl-sheet"><h4>1 · Pick a base colour and a harmony rule</h4><div class="co-top"><div class="co-wheel"></div><div><div class="co-row co-sws"></div><p class="dl-mono co-about"></p></div></div></div>
      <div class="dl-sheet"><h4>2 · The palette applied with 60-30-10</h4><div class="co-kit" style="display:flex;justify-content:center"></div><div style="margin-top:10px;display:grid;gap:6px"><div class="co-bar"></div><p class="dl-mono co-meas"></p></div></div>
      <div class="dl-sheet"><h4>3 · WCAG contrast checker</h4>
        <div class="co-pick"><label>Text <input type="color" class="fgc"></label><input class="txt fgt" type="text" spellcheck="false"><label>Background <input type="color" class="bgc"></label><input class="txt bgt" type="text" spellcheck="false"><button class="btn ghost sm co-swap">Swap</button></div>
        <div class="co-check" style="margin-top:12px"><div class="big">Large text, 24px bold</div><div class="body">Body text at 16px. The quick brown fox jumps over the lazy dog, and the contrast ratio decides whether everyone can read it.</div></div>
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:12px"><div class="dl-big co-ratio"></div><table class="dl-tbl" style="flex:1;min-width:220px"><tbody class="co-res"></tbody></table></div>
        <div class="row" style="margin-top:10px"><span class="dl-mono">Load a pair from the palette:</span><button class="chip" data-p="text">Text on page</button><button class="chip" data-p="muted">Muted on page</button><button class="chip" data-p="accent">Button label</button><button class="chip" data-p="raw">Accent on page</button></div>
        <div class="row" style="margin-top:8px"><button class="btn sm co-fix">Fix the text colour for AA</button><button class="btn ghost sm co-fix7">Fix for AAA</button></div>
      </div></div>`);
    center.append(board);
    const $ = (s) => board.querySelector(s);

    let H = 205; let S = 70; let L = 50; let rule = 'complementary'; let mode = 'light';
    let pal = {};

    // wheel
    const wheelHost = $('.co-wheel');
    const cv = ctx.canvas({ parent: wheelHost }); const g = cv.ctx;
    const disc = document.createElement('canvas');
    let discL = -1;
    function drawDisc(size) {
      const dpr = cv.dpr; const N = Math.round(size * dpr); disc.width = N; disc.height = N;
      const dg = disc.getContext('2d'); const img = dg.createImageData(N, N); const r0 = N / 2;
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = x - r0; const dy = y - r0; const d = Math.hypot(dx, dy); const i = (y * N + x) * 4;
        if (d > r0) { img.data[i + 3] = 0; continue; }
        const hue = (Math.atan2(dy, dx) * 180) / Math.PI + 90; const [r, gg, b] = hslToRgb(hue, (d / r0) * 100, L);
        img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = d > r0 - 1 ? 128 : 255;
      }
      dg.putImageData(img, 0, 0); discL = L;
    }
    const pos = (hue, sat, R) => { const a = ((hue - 90) * Math.PI) / 180; return [cv.w / 2 + Math.cos(a) * R * (sat / 100), cv.h / 2 + Math.sin(a) * R * (sat / 100)]; };
    function drawWheel() {
      const { w, h } = cv; if (!w) return;
      const R = Math.min(w, h) / 2 - 8;
      if (discL !== L || disc.width !== Math.round(R * 2 * cv.dpr)) drawDisc(R * 2);
      g.clearRect(0, 0, w, h);
      g.drawImage(disc, w / 2 - R, h / 2 - R, R * 2, R * 2);
      const hues = RULES[rule].hues.map((o) => H + o);
      hues.forEach((hu, i) => {
        const [x, y] = pos(hu, S, R);
        g.strokeStyle = 'rgba(10,10,10,.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(x, y); g.stroke();
        g.beginPath(); g.arc(x, y, i === 0 ? 11 : 7, 0, Math.PI * 2); g.fillStyle = hslHex(hu, S, L); g.fill();
        g.lineWidth = i === 0 ? 3 : 2; g.strokeStyle = '#fff'; g.stroke(); g.lineWidth = 1; g.strokeStyle = 'rgba(0,0,0,.6)'; g.stroke();
      });
    }
    cv.onResize(drawWheel);
    const pick = (e) => {
      const r = cv.el.getBoundingClientRect(); const R = Math.min(r.width, r.height) / 2 - 8;
      const dx = e.clientX - r.left - r.width / 2; const dy = e.clientY - r.top - r.height / 2;
      H = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360; S = clamp((Math.hypot(dx, dy) / R) * 100, 0, 100);
      sh.value = H; ss.value = S; upd();
    };
    cv.el.style.touchAction = 'none'; cv.el.style.cursor = 'crosshair';
    cv.el.addEventListener('pointerdown', (e) => { cv.el.setPointerCapture(e.pointerId); pick(e); }, { signal: ctx.signal });
    cv.el.addEventListener('pointermove', (e) => { if (cv.el.hasPointerCapture(e.pointerId)) pick(e); }, { signal: ctx.signal });

    // kit with a generated palette style
    const kit = makeKit(ctx, 'palette', $('.co-kit'));

    // panel
    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">Colour</h2>'), ctx.h('<p class="lede">Pick one colour, let a harmony rule find its partners, spread them 60-30-10, then check that every pair can actually be read.</p>'));
    const sh = ctx.slider({ label: 'Hue', min: 0, max: 359, step: 1, value: H, unit: '°', onInput: (v) => { H = v; upd(); } });
    const ss = ctx.slider({ label: 'Saturation', min: 0, max: 100, step: 1, value: S, unit: '%', onInput: (v) => { S = v; upd(); } });
    const sl = ctx.slider({ label: 'Lightness', min: 15, max: 85, step: 1, value: L, unit: '%', onInput: (v) => { L = v; upd(); } });
    P.append(sh, ss, sl);
    P.append(ctx.seg(Object.entries(RULES).map(([k, v]) => [k, v.name.split(' ')[0]]), rule, (v) => { rule = v; upd(); }));
    P.append(ctx.seg([['light', 'Light theme'], ['dark', 'Dark theme']], mode, (v) => { mode = v; upd(); }));
    const tbl = ctx.h('<table class="dl-tbl"></table>');
    P.append(ctx.h('<h3>Your palette, checked</h3>'), tbl);
    P.append(ctx.h('<div class="card tip"><p><b>HSL</b> describes a colour the way people think about it: <b>hue</b> (which colour, an angle round the wheel), <b>saturation</b> (how intense) and <b>lightness</b> (how close to black or white).</p><p><b>Harmony rules</b> are angles on that wheel. <b>60-30-10</b> is a proportion: about 60% a calm dominant colour, 30% a secondary colour, 10% an accent for the things you want clicked. <b>Contrast</b> is the one that is not taste: WCAG gives numbers.</p></div>'));
    P.append(ctx.h('<div class="card try"><p>Drag on the wheel and watch the whole sample UI recolour. Switch harmony rules and note which colour becomes the accent (the buttons and the switch). Then, in the checker, load <b>Accent on page</b> for a yellow hue (around 55°): it almost always fails. Press <b>Fix</b> and see how much darker the colour must be.</p></div>'));
    P.append(ctx.h(`<div class="card deep"><p><b>The WCAG 2 ratio.</b> Each colour is turned into relative luminance L (linearise each sRGB channel, then <code>L = 0.2126 R + 0.7152 G + 0.0722 B</code>). The ratio is <code>(L1 + 0.05) / (L2 + 0.05)</code>, from 1:1 to 21:1.</p>
      <div class="formula">AA: 4.5:1 normal text, 3:1 large text<span>AAA: 7:1 normal, 4.5:1 large. Large = 24px, or 18.66px bold. UI parts and graphics: 3:1.</span></div>
      <p><b>Why yellow fails.</b> Green contributes 72% of luminance, blue only 7%. Yellow (red plus green) is very bright even at full saturation, so text on it or in it needs to be much darker than the same hue in blue.</p>
      <p><b>Limits.</b> The WCAG 2 formula ignores font weight and polarity. A newer model, APCA, is being explored for future guidelines, but WCAG 2 ratios are what laws and audits use today.</p></div>`));
    P.append(ctx.h('<details class="more"><summary>Where the rules come from</summary><div><p>The colour wheel goes back to Isaac Newton (1704), who bent the spectrum into a circle. Harmony rules were developed by painters and colour theorists such as Johannes Itten at the Bauhaus. 60-30-10 comes from interior design. None are laws of nature: they are reliable starting points that keep one colour in charge.</p><p>Remember that about 1 in 12 men and 1 in 200 women have some form of colour vision deficiency, most often red-green. Never use colour as the only signal: add text, icons or patterns.</p></div></details>'));

    // contrast checker state
    let fg = '#1d1d1b'; let bg = '#ffffff';
    const fgc = $('.fgc'); const bgc = $('.bgc'); const fgt = $('.fgt'); const bgt = $('.bgt');
    const norm = (v) => { v = v.trim(); if (!v.startsWith('#')) v = `#${v}`; return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? (v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v).toLowerCase() : null; };
    function check() {
      fgc.value = fg; bgc.value = bg; if (document.activeElement !== fgt) fgt.value = fg; if (document.activeElement !== bgt) bgt.value = bg;
      const box = $('.co-check'); box.style.color = fg; box.style.background = bg;
      const r = contrast(fg, bg);
      $('.co-ratio').textContent = `${r.toFixed(2)}:1`;
      $('.co-res').innerHTML = [['Normal text', 4.5, 7], ['Large text', 3, 4.5], ['UI components', 3, null]].map(([n, aa, aaa]) => `<tr><td>${n}</td><td>${badge(r >= aa, `AA ${aa}:1`)}</td><td>${aaa ? badge(r >= aaa, `AAA ${aaa}:1`) : '<span class="dl-mono">n/a</span>'}</td></tr>`).join('');
    }
    fgc.addEventListener('input', () => { fg = fgc.value; check(); }, { signal: ctx.signal });
    bgc.addEventListener('input', () => { bg = bgc.value; check(); }, { signal: ctx.signal });
    fgt.addEventListener('input', () => { const v = norm(fgt.value); if (v) { fg = v; check(); } }, { signal: ctx.signal });
    bgt.addEventListener('input', () => { const v = norm(bgt.value); if (v) { bg = v; check(); } }, { signal: ctx.signal });
    $('.co-swap').addEventListener('click', () => { [fg, bg] = [bg, fg]; check(); }, { signal: ctx.signal });
    board.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.p;
      if (k === 'text') { fg = pal.text; bg = pal.dom; } else if (k === 'muted') { fg = pal.muted; bg = pal.dom; } else if (k === 'accent') { fg = pal.accInk; bg = pal.acc; } else { fg = pal.acc; bg = pal.dom; }
      check();
    }, { signal: ctx.signal }));
    const fix = (target) => {
      const [h, s, l0] = rgbToHsl(...hexToRgb(fg));
      if (contrast(fg, bg) >= target) return;
      // search lightness in both directions, keep hue and saturation, pick the smallest change that passes
      let best = null;
      for (let d = 0; d <= 100; d += 0.5) {
        for (const l of [l0 - d, l0 + d]) { if (l < 0 || l > 100) continue; const c = hslHex(h, s, l); if (contrast(c, bg) >= target) { best = c; break; } }
        if (best) break;
      }
      if (best) { fg = best; check(); }
    };
    $('.co-fix').addEventListener('click', () => fix(4.5), { signal: ctx.signal });
    $('.co-fix7').addEventListener('click', () => fix(7), { signal: ctx.signal });

    function measure() {
      const R = kit.root.getBoundingClientRect(); const tot = R.width * R.height; if (!tot) return;
      const area = (sel) => [...kit.root.querySelectorAll(sel)].reduce((a, e) => { const r = e.getBoundingClientRect(); return a + r.width * r.height; }, 0);
      const acc = area('.button.primary') + area('.switch[aria-checked="true"]') + area('.fill') + area('.thumb') + area('.tab.on');
      const sec = area('.nav') + area('.card.sec') + area('.media') - area('.nav .tab.on') - area('.card.sec .button.primary') - area('.card.sec .switch[aria-checked="true"]') - area('.card.sec .range');
      const dom = tot - sec - acc;
      const p = [dom, sec, acc].map((v) => (v / tot) * 100);
      $('.co-bar').innerHTML = `<span style="flex-grow:${p[0]};background:${pal.dom};color:${pal.text}">${Math.round(p[0])}%</span><span style="flex-grow:${p[1]};background:${pal.sec};color:${pal.text}">${Math.round(p[1])}%</span><span style="flex-grow:${p[2]};background:${pal.acc};color:${pal.accInk}">${Math.round(p[2])}%</span>`;
      $('.co-meas').textContent = `Measured from the rendered layout: dominant ${Math.round(p[0])}%, secondary ${Math.round(p[1])}%, accent ${Math.round(p[2])}%. The target is roughly 60 / 30 / 10.`;
    }

    let first = true;
    function upd() {
      const hues = RULES[rule].hues.map((o) => (H + o + 360) % 360);
      const secH = hues.length > 2 ? hues[1] : hues[0]; const accH = hues.length > 2 ? hues[2] : hues[1];
      const lt = mode === 'light';
      pal = {
        dom: hslHex(H, Math.min(S, 40) * 0.5, lt ? 96 : 9),
        card: hslHex(H, Math.min(S, 40) * 0.4, lt ? 99 : 13),
        sec: hslHex(secH, Math.min(S, 70) * 0.55, lt ? 87 : 22),
        acc: hslHex(accH, Math.max(S, 45), lt ? Math.min(L, 50) : Math.max(L, 60)),
        text: hslHex(H, 25, lt ? 13 : 94),
        muted: hslHex(H, 12, lt ? 38 : 70),
      };
      pal.accInk = contrast('#ffffff', pal.acc) >= contrast('#111111', pal.acc) ? '#ffffff' : '#111111';
      const base = hslHex(H, S, L);
      injectCSS('palette', `.dl-ui.s-palette { background: ${pal.dom}; color: ${pal.text}; font-family: "Inter", system-ui, sans-serif; }
.dl-ui.s-palette .nav, .dl-ui.s-palette .card.sec { background: ${pal.sec}; border-radius: 14px; }
.dl-ui.s-palette .card { background: ${pal.card}; border-radius: 14px; }
.dl-ui.s-palette .text, .dl-ui.s-palette .label, .dl-ui.s-palette .field, .dl-ui.s-palette .tab { color: ${pal.muted}; }
.dl-ui.s-palette .card.sec .label, .dl-ui.s-palette .card.sec .field, .dl-ui.s-palette .setting, .dl-ui.s-palette .nav .tab { color: ${pal.text}; }
.dl-ui.s-palette .tab { border-radius: 8px; }
.dl-ui.s-palette .tab.on { background: ${pal.acc}; color: ${pal.accInk}; }
.dl-ui.s-palette .media { border-radius: 10px; --sky: ${pal.sec}; --sun: ${pal.acc}; --hill1: ${hslHex(H, S * 0.5, lt ? 60 : 38)}; --hill2: ${hslHex(H, S * 0.55, lt ? 40 : 28)}; --path: ${pal.dom}; }
.dl-ui.s-palette .button { border-radius: 10px; color: ${pal.text}; background: transparent; border: 1.5px solid ${pal.muted}; }
.dl-ui.s-palette .button.primary { background: ${pal.acc}; color: ${pal.accInk}; border-color: ${pal.acc}; }
.dl-ui.s-palette .input { border-radius: 10px; border: 1.5px solid ${pal.muted}; background: ${pal.card}; color: ${pal.text}; }
.dl-ui.s-palette .switch { border-radius: 13px; background: ${pal.muted}; }
.dl-ui.s-palette .switch[aria-checked="true"] { background: ${pal.acc}; }
.dl-ui.s-palette .knob { border-radius: 50%; background: ${pal.card}; }
.dl-ui.s-palette .track { border-radius: 3px; background: ${pal.dom}; }
.dl-ui.s-palette .fill, .dl-ui.s-palette .thumb { background: ${pal.acc}; }`);
      kit.root.querySelectorAll('.card')[1].classList.add('sec');
      $('.co-sws').innerHTML = [['Base', base], ...hues.slice(1).map((hh, i) => [`Harmony ${i + 1}`, hslHex(hh, S, L)])].map(([n, c]) => `<div class="co-sw" style="background:${c};color:${contrast('#fff', c) > contrast('#111', c) ? '#fff' : '#111'}"><span>${n}</span><span>${c}</span></div>`).join('');
      $('.co-about').textContent = RULES[rule].about;
      const rows = [['Text on page', pal.text, pal.dom, 4.5], ['Muted on page', pal.muted, pal.dom, 4.5], ['Muted on card', pal.muted, pal.card, 4.5], ['Button label', pal.accInk, pal.acc, 4.5], ['Accent on page (UI)', pal.acc, pal.dom, 3]];
      tbl.innerHTML = '<tr><th>Pair</th><th>Ratio</th><th>Need</th></tr>' + rows.map(([n, a, b, need]) => { const r = contrast(a, b); return `<tr><td><span class="dl-sw" style="background:${a};outline:2px solid ${b}"></span>${n}</td><td>${r.toFixed(2)}</td><td>${badge(r >= need, `${need}:1`)}</td></tr>`; }).join('');
      drawWheel();
      if (first) { fg = pal.text; bg = pal.dom; first = false; }
      check();
      clearTimeout(upd.t); upd.t = setTimeout(measure, 80);
    }
    const ro = new ResizeObserver(() => measure()); ro.observe(kit.root);
    upd();

    ctx.quiz([
      { q: 'Which pair is complementary?', choices: ['Blue and orange', 'Blue and teal', 'Red, yellow and blue'], answer: 0, why: 'Complementary colours sit opposite each other on the wheel (180° apart). Blue and orange are a classic pair.' },
      { q: 'Body text at 16px has a contrast ratio of 3.8:1. What does WCAG AA say?', choices: ['Pass', 'Fail: normal text needs 4.5:1', 'Pass, because 3:1 is enough for all text'], answer: 1, why: 'AA needs 4.5:1 for normal text. 3:1 is only enough for large text and UI components.' },
      { q: 'In 60-30-10, what is the 10% for?', choices: ['The page background', 'An accent for the things you want people to notice and click', 'Body text'], answer: 1, why: 'The accent is used sparingly, so calls to action and active states stand out.' },
    ]);
    return () => ro.disconnect();
  },
};
