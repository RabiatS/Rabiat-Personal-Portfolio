import { scrollStage, linfit, mean, shuffle, drawPlot } from './_shared.js';

const OPTS = [['Red', '#fb7185'], ['Blue', '#60a5fa'], ['Green', '#4ade80'], ['Amber', '#fbbf24'], ['Violet', '#a78bfa'], ['Teal', '#5eead4'], ['Pink', '#f472b6'], ['Lime', '#a3e635']];
const NS = [1, 2, 4, 8];
const PER = 5;

export default {
  mount(ctx) {
    const { center } = scrollStage(ctx);
    const board = ctx.h(`<div class="dl-board"><div class="lx-arena"><div class="lx-center"><div class="lx-word"></div><button class="btn lx-ready">Start</button></div><p class="lx-msg hint"></p></div>
      <div class="dl-sheet"><h4>Your decision time against log2(N + 1)</h4><div class="dl-plot"></div></div></div>`);
    center.append(board);
    const arena = board.querySelector('.lx-arena'); const word = board.querySelector('.lx-word'); const ready = board.querySelector('.lx-ready'); const msg = board.querySelector('.lx-msg');
    const cv = ctx.canvas({ parent: board.querySelector('.dl-plot') });

    let data = ctx.store.get('hick', { 1: [], 2: [], 4: [], 8: [] });
    let blocks = []; let bi = -1; let trial = 0; let opts = []; let target = null; let onset = 0; let timer = 0; let state = 'idle';

    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">Hick\'s law</h2>'), ctx.h('<p class="lede">The more choices you give people, the longer they take to choose. Not linearly, but with the logarithm of the number of choices.</p>'));
    const prog = ctx.h('<p class="hint"></p>');
    const reset = ctx.h('<button class="btn ghost sm" style="align-self:flex-start">Clear my results</button>');
    const stat = ctx.h('<div class="stat" style="grid-template-columns:repeat(4,1fr)"></div>');
    const fitBox = ctx.h('<div class="formula"></div>');
    P.append(prog, stat, fitBox, reset);
    P.append(ctx.h('<div class="card tip"><p>Each decision has to rule out the other options. If you halve the options each time (is it in the top half or the bottom?), the work grows with log<sub>2</sub> of the number of choices. Going from 2 to 4 options adds about as much time as going from 4 to 8.</p></div>'));
    P.append(ctx.h(`<div class="card try"><p>Press <b>Start</b>. You will do four short blocks (1, 2, 4 and 8 options, in random order), ${PER} trials each. Rest your pointer on <b>Ready</b>, click it, wait for a colour name in the middle, then click that option as fast as you can. All options sit the same distance from the centre, so movement time is the same in every block and only the decision changes.</p></div>`));
    P.append(ctx.h(`<div class="card deep"><div class="formula">RT = a + b · log2(N + 1)<span>a: time that does not depend on choice (seeing, moving). b: time per bit of information.</span></div>
      <p>William Edmund Hick (1952) and Ray Hyman (1953) measured it with lamps and keys. The <b>+1</b> accounts for the extra uncertainty of whether a stimulus will appear at all. Lab values of b are often in the region of 150 ms per bit with practice and with compatible stimulus response mappings; yours includes moving the pointer, so expect bigger numbers.</p>
      <p><b>Where it applies.</b> Hick's law holds when options are familiar and the person knows what they want, like picking a known item from a well learned menu. When people have to read and search an unfamiliar list, time grows more like linearly with the number of items, so a long unsorted menu is worse than the log curve suggests.</p>
      <p><b>In design:</b> fewer primary actions, progressive disclosure (show advanced options later), sensible defaults, grouping and ordering menus so people can skip whole sections.</p></div>`));

    function render() {
      const xs = []; const ys = []; const means = [];
      for (const n of NS) { const x = Math.log2(n + 1); for (const t of data[n]) { xs.push(x); ys.push(t); } if (data[n].length) means.push([x, mean(data[n])]); }
      const fit = means.length >= 2 ? linfit(means.map((m) => m[0]), means.map((m) => m[1])) : null;
      drawPlot(cv, ctx.colors, { xs, ys, means, fit, xMin: 0.8, xMax: 3.4, xTicks: NS.map((n) => [Math.log2(n + 1), `N=${n}`]), xLabel: 'log2(N + 1)', yLabel: 'ms', empty: 'Press Start to measure yourself' });
      stat.innerHTML = NS.map((n) => `<div><b>${data[n].length ? Math.round(mean(data[n])) : '-'}</b><span>N = ${n} (ms)</span></div>`).join('');
      fitBox.innerHTML = fit ? `RT ≈ ${Math.round(fit.a)} + ${Math.round(fit.b)} · log2(N + 1) ms<span>R² = ${fit.r2.toFixed(2)} · ${Math.round(fit.b)} ms per bit of choice</span>` : 'RT = a + b · log2(N + 1)<span>Your fit appears after two blocks.</span>';
    }
    cv.onResize(render);

    function layout() {
      arena.querySelectorAll('.lx-opt').forEach((o) => o.remove());
      const r = arena.getBoundingClientRect(); const R = Math.min(r.width / 2 - 56, r.height / 2 - 34);
      const n = opts.length;
      opts.forEach(([name, col], i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / n + (n === 2 ? Math.PI / 2 : 0);
        const b = ctx.h(`<button class="lx-opt" data-n="${name}" style="left:${r.width / 2 + Math.cos(a) * R}px;top:${r.height / 2 + Math.sin(a) * R}px"><i style="background:${col}"></i>${name}</button>`);
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); choose(name); });
        arena.append(b);
      });
    }
    function startBlock() {
      bi++;
      if (bi >= blocks.length) { state = 'idle'; word.textContent = 'Done'; ready.textContent = 'Run again'; ready.hidden = false; msg.textContent = 'Look at the plot: does it bend or run straight against log2(N + 1)?'; opts = []; layout(); ctx.store.set('hick', data); prog.textContent = 'Finished. Your results are saved in this browser.'; ctx.done(); return; }
      const n = blocks[bi]; opts = shuffle(OPTS.slice()).slice(0, n); trial = -1; layout();
      word.textContent = `${n} option${n > 1 ? 's' : ''}`; ready.textContent = 'Ready'; ready.hidden = false; state = 'ready';
      msg.textContent = 'Click Ready, then wait for the name. The first trial of each block is practice.';
      prog.textContent = `Block ${bi + 1} of ${blocks.length}`;
    }
    function go() {
      if (state === 'idle') { blocks = shuffle(NS.slice()); bi = -1; startBlock(); return; }
      if (state !== 'ready') return;
      ready.hidden = true; word.textContent = ''; state = 'wait';
      timer = setTimeout(() => { target = opts[Math.floor(Math.random() * opts.length)][0]; word.textContent = target; onset = performance.now(); state = 'go'; }, 600 + Math.random() * 900);
    }
    function choose(name) {
      if (state === 'wait') { clearTimeout(timer); msg.textContent = 'Too early. Wait for the name to appear.'; state = 'ready'; ready.hidden = false; return; }
      if (state !== 'go') return;
      const rt = performance.now() - onset; state = 'ready';
      const n = blocks[bi];
      if (name !== target) msg.textContent = `Oops, that was ${name}. Errors are not counted.`;
      else if (trial < 0) msg.textContent = `Practice: ${Math.round(rt)} ms. Now for real.`;
      else { data[n].push(Math.round(rt)); msg.textContent = `${Math.round(rt)} ms`; render(); }
      trial++;
      prog.textContent = `Block ${bi + 1} of ${blocks.length} · trial ${Math.max(0, trial)} of ${PER}`;
      if (trial >= PER) { word.textContent = ''; setTimeout(startBlock, 500); return; }
      ready.hidden = false; word.textContent = '';
    }
    ready.addEventListener('click', go, { signal: ctx.signal });
    reset.addEventListener('click', () => { data = { 1: [], 2: [], 4: [], 8: [] }; ctx.store.set('hick', data); render(); }, { signal: ctx.signal });
    const ro = new ResizeObserver(() => { if (opts.length) layout(); }); ro.observe(arena);
    msg.textContent = 'Four short blocks, about a minute in total.';
    prog.textContent = data[1].length ? 'Showing your saved results. Run again to add more.' : 'Not started';
    render();

    ctx.quiz([
      { q: 'According to Hick\'s law, going from 4 to 8 choices adds about the same time as going from...', choices: ['1 to 2 choices', '2 to 4 choices', '8 to 64 choices'], answer: 1, why: 'Each doubling adds about one bit, so 2 to 4 and 4 to 8 add similar time (the +1 makes it approximate).' },
      { q: 'When does Hick\'s law describe menus poorly?', choices: ['When people must read and search an unfamiliar list', 'When the options are well learned', 'Never'], answer: 0, why: 'Searching unfamiliar items is closer to linear in the number of items.' },
      { q: 'Which design move uses Hick\'s law?', choices: ['Showing 20 equal buttons', 'Progressive disclosure: a few main choices first, advanced ones later', 'Making all text bold'], answer: 1, why: 'Fewer choices at each step means faster decisions.' },
    ]);
    return () => { clearTimeout(timer); ro.disconnect(); };
  },
};
