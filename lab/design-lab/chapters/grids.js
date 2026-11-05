import { scrollStage, clamp } from './_shared.js';

// A 960 x 640 artboard with a 12 column grid: 48px margins, 24px gutters, 50px columns.
const W = 960; const H = 640; const M = 48; const G = 24; const COLS = 12;
const CW = (W - 2 * M - (COLS - 1) * G) / COLS;
const colX = (c) => M + c * (CW + G);
const spanW = (n) => n * CW + (n - 1) * G;
const BASE = 8;

const BLOCKS = [
  { id: 'logo', c: 0, n: 2, y: 32, h: 32, dx: 6, dy: 3, html: '<b style="font:800 20px Inter;letter-spacing:-.02em">trailhead</b>' },
  { id: 'nav', c: 7, n: 5, y: 32, h: 32, dx: -9, dy: 2, html: '<div style="display:flex;justify-content:space-between;font:500 14px Inter;color:#55554f;height:100%;align-items:center"><span>Routes</span><span>Gear</span><span>Journal</span><span style="color:#1d1d1b">Sign in</span></div>' },
  { id: 'hd', c: 0, n: 6, y: 112, h: 120, dx: 4, dy: 5, html: '<div style="font:700 46px/1.04 Fraunces,Georgia,serif;letter-spacing:-.02em">Walk the long way home</div>' },
  { id: 'body', c: 0, n: 5, y: 248, h: 64, dx: -6, dy: -3, html: '<div style="font:15px/1.6 Inter;color:#55554f">Curated routes, honest gear notes and maps that work offline, for weekends that end in tired legs.</div>' },
  { id: 'btn', c: 0, n: 3, y: 328, h: 48, dx: 9, dy: 6, html: '<div style="height:100%;border-radius:10px;background:#1d1d1b;color:#fff;font:600 15px Inter;display:grid;place-items:center">Find a route</div>' },
  { id: 'img', c: 7, n: 5, y: 112, h: 264, dx: 5, dy: -4, html: '<div style="height:100%;border-radius:10px;background:linear-gradient(180deg,#9cc9e8,#cfe3d4 55%,#6f9a7b 56%,#456e57)"></div>' },
  { id: 'f1', c: 0, n: 4, y: 424, h: 168, dx: 3, dy: 7, card: 'Offline maps' },
  { id: 'f2', c: 4, n: 4, y: 424, h: 168, dx: -5, dy: -2, card: 'Gear notes' },
  { id: 'f3', c: 8, n: 4, y: 424, h: 168, dx: 7, dy: 4, card: 'Route builder' },
];
const cardHtml = (t) => `<div style="height:100%;border-radius:10px;background:#f1ece2;padding:18px;display:flex;flex-direction:column;gap:8px"><div style="width:32px;height:32px;border-radius:8px;background:#e6d2bf"></div><b style="font:600 16px Inter">${t}</b><span style="font:13.5px/1.5 Inter;color:#66665f">A short line that explains why this matters on the trail.</span></div>`;

export default {
  mount(ctx) {
    const { center } = scrollStage(ctx);
    const host = ctx.h('<div class="gr-host"><div class="gr-board"><div class="gr-base"></div><div class="gr-cols"></div></div></div>');
    center.append(host, ctx.h('<p class="dl-cap">Drag the blocks. Red bands mark edges that almost line up</p>'));
    const board = host.firstChild; const cols = board.querySelector('.gr-cols'); const base = board.querySelector('.gr-base');
    for (let c = 0; c < COLS; c++) cols.append(ctx.h(`<i style="left:${colX(c)}px;width:${CW}px"></i>`));
    let scale = 1;
    const fit = () => { const w = host.getBoundingClientRect().width; scale = w / W; board.style.transform = `scale(${scale})`; host.style.height = `${H * scale}px`; };
    const ro = new ResizeObserver(fit); ro.observe(host);

    const state = BLOCKS.map((b) => ({ ...b, x: colX(b.c) + b.dx, yy: b.y + b.dy, w: spanW(b.n) }));
    const els = state.map((b) => {
      const el = ctx.h(`<div class="gr-b">${b.card ? cardHtml(b.card) : b.html}</div>`);
      board.append(el); b.el = el; return el;
    });
    const place = (b) => { b.el.style.left = `${b.x}px`; b.el.style.top = `${b.yy}px`; b.el.style.width = `${b.w}px`; b.el.style.height = `${b.h}px`; };
    state.forEach(place);

    let snap = false;
    const snapX = (x) => { let best = x; let bd = 1e9; for (let c = 0; c < COLS; c++) { const d = Math.abs(colX(c) - x); if (d < bd) { bd = d; best = colX(c); } } return best; };
    const snapY = (y) => Math.round(y / BASE) * BASE;

    // dragging
    for (const b of state) {
      let sx = 0; let sy = 0; let ox = 0; let oy = 0;
      b.el.addEventListener('pointerdown', (e) => {
        b.el.setPointerCapture(e.pointerId); b.el.classList.add('drag'); b.el.classList.remove('anim');
        sx = e.clientX; sy = e.clientY; ox = b.x; oy = b.yy; e.preventDefault();
      }, { signal: ctx.signal });
      b.el.addEventListener('pointermove', (e) => {
        if (!b.el.hasPointerCapture(e.pointerId)) return;
        let nx = ox + (e.clientX - sx) / scale; let ny = oy + (e.clientY - sy) / scale;
        nx = clamp(nx, 0, W - b.w); ny = clamp(ny, 0, H - b.h);
        if (snap) { nx = snapX(nx); ny = snapY(ny); }
        b.x = nx; b.yy = ny; place(b); check();
      }, { signal: ctx.signal });
      const end = () => { b.el.classList.remove('drag'); check(); };
      b.el.addEventListener('pointerup', end, { signal: ctx.signal });
      b.el.addEventListener('pointercancel', end, { signal: ctx.signal });
    }

    // near miss detector: edges within 1 to 10px of each other but not equal
    const lines = [];
    function check() {
      lines.forEach((l) => l.remove()); lines.length = 0;
      const v = []; const h = [];
      for (const b of state) { v.push([b.x, b], [b.x + b.w, b]); h.push([b.yy, b], [b.yy + b.h, b]); }
      let miss = 0;
      const scan = (arr, vert) => {
        for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) {
          const [a, A] = arr[i]; const [c, C] = arr[j];
          if (A === C) continue;
          const d = Math.abs(a - c);
          if (d > 0.5 && d <= 10) {
            miss++;
            const lo = vert ? Math.min(A.yy, C.yy) : Math.min(A.x, C.x);
            const hi = vert ? Math.max(A.yy + A.h, C.yy + C.h) : Math.max(A.x + A.w, C.x + C.w);
            const el = vert ? ctx.h(`<div class="gr-miss" style="left:${Math.min(a, c)}px;width:${Math.max(d, 2)}px;top:${lo - 6}px;height:${hi - lo + 12}px"></div>`)
              : ctx.h(`<div class="gr-miss h" style="top:${Math.min(a, c)}px;height:${Math.max(d, 2)}px;left:${lo - 6}px;width:${hi - lo + 12}px"></div>`);
            board.append(el); lines.push(el);
          }
        }
      };
      scan(v, true); scan(h, false);
      const lefts = new Set(state.map((b) => Math.round(b.x)));
      const onGrid = state.filter((b) => Math.abs(snapX(b.x) - b.x) < 0.5).length;
      stat.innerHTML = `<div><b style="color:${miss ? 'var(--c4)' : 'var(--ok)'}">${miss}</b><span>Near misses</span></div><div><b>${lefts.size}</b><span>Left edges</span></div><div><b>${onGrid}/${state.length}</b><span>On a column</span></div>`;
    }

    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">Alignment and grids</h2>'), ctx.h('<p class="lede">A grid is a set of invisible lines that everything lines up to. It turns a pile of boxes into a page.</p>'));
    const g1 = ctx.h('<label class="check"><input type="checkbox"> Show the 12 column grid</label>');
    const g2 = ctx.h('<label class="check"><input type="checkbox"> Show the 8px baseline</label>');
    const g3 = ctx.h('<label class="check"><input type="checkbox"> Snap while dragging</label>');
    const row = ctx.h('<div class="row"><button class="btn sm">Snap everything</button><button class="btn ghost sm">Scatter</button></div>');
    const stat = ctx.h('<div class="stat"></div>');
    P.append(g1, g2, g3, row, stat);
    g1.querySelector('input').addEventListener('change', (e) => cols.classList.toggle('on', e.target.checked), { signal: ctx.signal });
    g2.querySelector('input').addEventListener('change', (e) => base.classList.toggle('on', e.target.checked), { signal: ctx.signal });
    g3.querySelector('input').addEventListener('change', (e) => { snap = e.target.checked; }, { signal: ctx.signal });
    const animate = () => { els.forEach((e) => e.classList.add('anim')); setTimeout(() => els.forEach((e) => e.classList.remove('anim')), 420); };
    row.children[0].addEventListener('click', () => { animate(); state.forEach((b) => { b.x = snapX(b.x); b.yy = snapY(b.y); place(b); }); check(); cols.classList.add('on'); g1.querySelector('input').checked = true; }, { signal: ctx.signal });
    row.children[1].addEventListener('click', () => { animate(); state.forEach((b) => { b.x = colX(b.c) + b.dx * (0.6 + Math.random()); b.yy = b.y + b.dy * (0.6 + Math.random()); place(b); }); check(); }, { signal: ctx.signal });

    P.append(ctx.h('<div class="card tip"><p>The layout on the left is almost aligned. Every block is a few pixels off. You may not consciously spot it, but it reads as slightly messy, like a picture hanging crooked.</p><p>A 12 column grid gives you a small set of lines to use. 12 divides into halves, thirds, quarters and sixths, so the same grid fits two, three or four column layouts.</p></div>'));
    P.append(ctx.h('<div class="card try"><p>Turn on the grid. Count the red near misses, then press <b>Snap everything</b> and watch them vanish. Now turn on <b>Snap while dragging</b> and move the image: it can only land on column lines. Try to make a deliberate offset (move a block a full column) and notice that it reads as a choice, not a mistake.</p></div>'));
    P.append(ctx.h(`<div class="formula">column = (960 − 2×48 − 11×24) / 12 = ${CW}px<span>artboard 960px, margins 48px, gutters 24px</span></div>`));
    P.append(ctx.h(`<div class="card deep"><p><b>Columns, gutters, margins.</b> Columns hold content, gutters separate it, margins frame the page. Content spans whole columns and the gutters between them, so a span of n columns is <code>n × column + (n − 1) × gutter</code> wide.</p>
      <p><b>Baseline grid.</b> Vertical rhythm comes from a baseline unit (often 4 or 8px). Heights, line heights and gaps are multiples of it, so things across columns land on the same lines.</p>
      <p><b>Near misses are worse than big misses.</b> A 40px offset reads as intentional. A 4px offset reads as an error. That is why the detector flags gaps from 1 to 10px only.</p>
      <p><b>In CSS</b> this is <code>display: grid; grid-template-columns: repeat(12, 1fr); column-gap: 24px;</code> and children use <code>grid-column: 1 / span 6</code>.</p></div>`));
    P.append(ctx.h('<details class="more"><summary>A short history</summary><div><p>Grids come from print: medieval manuscripts already used ruled margins and text blocks. Swiss designers of the 1950s made them a method, and Josef Müller-Brockmann\'s book <i>Grid Systems in Graphic Design</i> (1981) is still a reference. On the web, the 960px, 12 column grid of the 960.gs framework (around 2008) shaped a decade of layouts, and CSS Grid (shipping in major browsers in 2017) finally made real grids native.</p></div></details>'));

    check();
    ctx.quiz([
      { q: 'Why are 12 column grids so common?', choices: ['12 is divisible by 2, 3, 4 and 6, so many layouts fit', 'Browsers require it', 'Screens are 12 inches wide'], answer: 0, why: 'Twelve splits evenly into halves, thirds, quarters and sixths.' },
      { q: 'Which offset looks more like a mistake?', choices: ['A block 4px off the line', 'A block a full column off the line', 'They look the same'], answer: 0, why: 'Small near misses look accidental. Large, consistent offsets look deliberate.' },
      { q: 'How wide is a span of 3 columns with 50px columns and 24px gutters?', choices: ['150px', '198px', '222px'], answer: 1, why: '3 × 50 + 2 × 24 = 198px. The gutters inside the span are included.' },
    ]);
    return () => ro.disconnect();
  },
};
