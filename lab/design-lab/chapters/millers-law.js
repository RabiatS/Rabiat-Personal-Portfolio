import { scrollStage, shuffle, mean } from './_shared.js';

// Split a digit string into readable chunks: threes, with a four at the end instead of a lonely single digit.
function chunk(s) {
  const out = []; let i = 0;
  while (i < s.length) { const left = s.length - i; const n = left === 4 ? 4 : Math.min(3, left); out.push(s.slice(i, i + n)); i += n; }
  return out.join(' ');
}

export default {
  mount(ctx) {
    const { center } = scrollStage(ctx);
    const board = ctx.h(`<div class="dl-board">
      <div class="dl-sheet" style="min-height:300px;display:grid;place-items:center;text-align:center;gap:14px">
        <div class="ml-state dl-mono"></div>
        <div class="ml-num" style="font:500 clamp(30px,6vw,52px)/1.1 'DM Mono',monospace;letter-spacing:.04em;min-height:60px;color:var(--text)"></div>
        <div class="ml-in" hidden style="display:grid;gap:10px;justify-items:center"><input class="txt" inputmode="numeric" autocomplete="off" style="font:500 26px 'DM Mono',monospace;text-align:center;max-width:320px" aria-label="Type the number you saw"><button class="btn sm ml-ok">Check</button></div>
        <div class="ml-fb" style="font:500 26px 'DM Mono',monospace;letter-spacing:.04em"></div>
        <button class="btn ml-go">Start 6 rounds</button>
      </div>
      <div class="dl-sheet"><h4>Your results</h4><div class="ml-res"></div></div></div>`);
    center.append(board);
    const $ = (s) => board.querySelector(s);
    let len = 10; let expo = 3; let rounds = []; let ri = -1; let cur = null; let timer = 0;
    let data = ctx.store.get('miller', { chunked: [], plain: [] }); // accuracy 0..1 per round

    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">Miller\'s law and chunking</h2>'), ctx.h('<p class="lede">Working memory holds only a handful of things at once. Chunking packs more into each thing.</p>'));
    P.append(ctx.slider({ label: 'Digits', min: 7, max: 14, step: 1, value: len, onInput: (v) => { len = v; } }));
    P.append(ctx.slider({ label: 'Time to look', min: 1.5, max: 6, step: 0.5, value: expo, unit: ' s', onInput: (v) => { expo = v; } }));
    const reset = ctx.h('<button class="btn ghost sm" style="align-self:flex-start">Clear my results</button>');
    P.append(reset);
    P.append(ctx.h('<div class="card tip"><p>Try holding <b>0712345678</b> in your head. Now <b>071 234 5678</b>. Same digits, but the second is three chunks instead of ten separate items. Your memory stores chunks, not characters.</p><p>That is why phone numbers, card numbers and verification codes are shown in groups.</p></div>'));
    P.append(ctx.h('<div class="card try"><p>Press <b>Start</b>. You get six rounds, three chunked and three not, in random order. Read the number, wait while it is hidden, then type it back. Compare your two bars. Turn the digits up to 12 or 14 to see the gap grow.</p></div>'));
    P.append(ctx.h(`<div class="card deep"><p>George Miller's 1956 paper "The Magical Number Seven, Plus or Minus Two" noted that people can hold about seven items in immediate memory, and that <b>chunking</b> (recoding items into bigger meaningful units) gets around the limit. Later work, notably Nelson Cowan (2001), puts the true capacity nearer <b>four chunks</b> when rehearsal and chunking are controlled.</p>
      <p><b>A common misreading:</b> Miller's law does not mean "menus must have seven items". People do not need to memorise a menu they can see. It does mean: do not make people carry information from one screen to the next (a code from an SMS, an order number), and when they must, chunk it.</p>
      <p>Chunks can be meaningful: <code>FBICIAUSA</code> is nine letters but three chunks (FBI, CIA, USA) for someone who knows the acronyms.</p></div>`));

    const setState = (t) => { $('.ml-state').textContent = t; };
    function renderRes() {
      const row = (k, label, col) => { const a = data[k]; const m = a.length ? mean(a) : 0; return `<div style="display:grid;grid-template-columns:110px 1fr 54px;gap:10px;align-items:center;margin:6px 0"><span class="dl-mono">${label}</span><div style="height:16px;border-radius:4px;background:var(--surface-2);overflow:hidden"><div style="height:100%;width:${m * 100}%;background:${col};transition:width .4s"></div></div><b class="mono" style="text-align:right">${a.length ? `${Math.round(m * 100)}%` : '-'}</b></div>`; };
      $('.ml-res').innerHTML = row('chunked', `Chunked (${data.chunked.length})`, 'var(--c1)') + row('plain', `Not chunked (${data.plain.length})`, 'var(--c4)') + '<p class="dl-mono" style="margin:8px 0 0">Digits in the right position, averaged over your rounds.</p>';
    }
    function startRun() { rounds = shuffle(['chunked', 'chunked', 'chunked', 'plain', 'plain', 'plain']); ri = -1; nextRound(); }
    function nextRound() {
      ri++; $('.ml-fb').innerHTML = ''; $('.ml-in').hidden = true;
      if (ri >= rounds.length) { setState('Done. Run again for more data.'); $('.ml-num').textContent = ''; $('.ml-go').hidden = false; $('.ml-go').textContent = 'Run 6 more'; ctx.store.set('miller', data); ctx.done(); return; }
      const digits = Array.from({ length: len }, () => Math.floor(Math.random() * 10)).join('');
      cur = { digits, mode: rounds[ri] };
      $('.ml-go').hidden = true;
      setState(`Round ${ri + 1} of 6 · memorise`);
      $('.ml-num').textContent = cur.mode === 'chunked' ? chunk(digits) : digits;
      timer = setTimeout(() => {
        $('.ml-num').textContent = '• • •'; setState('Hold it in your head...');
        timer = setTimeout(() => { $('.ml-num').textContent = ''; setState(`Round ${ri + 1} of 6 · type it`); $('.ml-in').hidden = false; const inp = $('.ml-in input'); inp.value = ''; inp.focus({ preventScroll: true }); }, 2000);
      }, expo * 1000);
    }
    function submit() {
      const typed = $('.ml-in input').value.replace(/\D/g, '');
      let ok = 0; const marks = [];
      for (let i = 0; i < cur.digits.length; i++) { const hit = typed[i] === cur.digits[i]; if (hit) ok++; marks.push(`<span style="color:${hit ? 'var(--ok)' : 'var(--c4)'}">${cur.digits[i]}</span>`); }
      const acc = ok / cur.digits.length; data[cur.mode].push(acc);
      $('.ml-in').hidden = true;
      $('.ml-fb').innerHTML = `${marks.join('')}<div class="dl-mono" style="margin-top:6px">${ok} of ${cur.digits.length} in place · ${cur.mode === 'chunked' ? 'chunked' : 'not chunked'}</div>`;
      setState(acc === 1 ? 'Perfect' : 'Green digits were in the right place');
      renderRes();
      timer = setTimeout(nextRound, 1800);
    }
    $('.ml-go').addEventListener('click', startRun, { signal: ctx.signal });
    $('.ml-ok').addEventListener('click', submit, { signal: ctx.signal });
    $('.ml-in input').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }, { signal: ctx.signal });
    reset.addEventListener('click', () => { data = { chunked: [], plain: [] }; ctx.store.set('miller', data); renderRes(); }, { signal: ctx.signal });
    setState('Six rounds, about a minute');
    $('.ml-num').textContent = '071 234 5678';
    renderRes();

    ctx.quiz([
      { q: 'What does chunking do?', choices: ['Deletes information', 'Groups items into larger meaningful units so fewer items need holding', 'Makes text bigger'], answer: 1, why: 'Grouping turns many items into a few chunks, which fit in working memory.' },
      { q: 'Modern estimates of working memory capacity are closer to...', choices: ['About 4 chunks', 'About 20 items', 'Unlimited'], answer: 0, why: 'Cowan (2001) and later work suggest about four chunks when chunking and rehearsal are controlled.' },
      { q: 'Which is a sound use of Miller\'s law?', choices: ['Limit every menu to exactly 7 items', 'Show one time codes as 482 913 rather than 482913', 'Hide the navigation'], answer: 1, why: 'People must hold the code while switching apps, so chunking helps. Visible menus do not need memorising.' },
    ]);
    return () => clearTimeout(timer);
  },
};
