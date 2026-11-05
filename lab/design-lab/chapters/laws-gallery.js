import { scrollStage, shuffle, mean, clamp } from './_shared.js';

const WORDS = ['river', 'candle', 'pocket', 'garden', 'violin', 'ladder', 'pencil', 'blanket', 'mirror', 'tunnel', 'basket', 'harbor', 'lemon', 'saddle', 'kettle', 'button', 'meadow', 'anchor', 'feather', 'marble', 'window', 'carpet', 'parrot', 'helmet'];

const LAWS = {
  jakob: { name: "Jakob's law", tip: 'People spend most of their time on other sites and apps, so they expect yours to work the same way. Familiar patterns cost nothing to learn.', tryThis: 'Press <b>Start</b> and find the cart icon as fast as you can, eight times. Half the pages put it top right like most shops. The other half put it somewhere "creative". Compare the two times.', deep: 'Named by Jakob Nielsen, who wrote around 2000 that users spend most of their time on other sites. Conventions are a shared vocabulary: logo top left linking home, search at the top, cart top right, underlined links. Break them only when the gain is bigger than the learning cost, and then do it consistently.' },
  tesler: { name: "Tesler's law", tip: 'Every task has some complexity that cannot be removed, only moved. Either the user deals with it, or the system (and its designers and developers) does.', tryThis: 'Enter each requested date in both fields. The strict field makes <b>you</b> do the conversion into DD/MM/YYYY. The smart field takes "next friday", "in 2 weeks" or "3 june" and does the work itself. Watch the error counters.', deep: 'Larry Tesler, who worked at Xerox PARC and Apple, argued in the 1980s for the law of conservation of complexity: an engineer should spend an extra week on a problem rather than make millions of users spend an extra minute. The catch is the opposite failure, hiding too much and guessing wrong, so smart fields should always show their interpretation (as this one does).' },
  doherty: { name: 'Doherty threshold', tip: 'When a system answers in under about 400 ms, people stay in flow and work faster. Slower than that and attention drifts, so the interface must show it is working.', tryThis: 'Search a few times at each speed. Then turn on <b>Show progress feedback</b> and try 1500 ms again. Rate each one. The wait is identical, but feedback changes how it feels.', deep: 'Walter Doherty and Ahrvind Thadani (IBM, 1982) reported that productivity rose sharply when computer response time dropped below 400 ms, compared with the 2 second standard of the time. Common guidance (Nielsen): about 0.1 s feels instant, about 1 s keeps the flow of thought, about 10 s is the limit of attention. Tactics: optimistic UI, skeleton screens, progress indicators, and doing work in the background.' },
  aesthetic: { name: 'Aesthetic-usability effect', tip: 'People perceive attractive designs as easier to use, and are more forgiving of their problems. Looks set expectations before anyone clicks.', tryThis: 'Rate how easy each form looks to use, before touching anything. Then press <b>Reveal</b>. Both forms have the same fields, labels, order and button. Only the styling differs.', deep: 'Masaaki Kurosu and Kaori Kashimura (Hitachi, 1995) showed people 26 layouts of an ATM interface and found that apparent usability correlated more strongly with aesthetic appeal than with the layouts\' actual usability. Noam Tractinsky replicated it in Israel (1997). The flip side: beauty can mask real usability problems in tests, so watch what people do, not just what they say.' },
  serial: { name: 'Serial position effect', tip: 'In a list, people remember the first items (primacy) and the last items (recency) best. The middle gets lost.', tryThis: 'Press <b>Start</b>. Twelve words appear one at a time. Then pick the ones you saw. Run it a few times: your recall by position builds up in the chart, usually a U shape.', deep: 'Hermann Ebbinghaus noticed it in the 1880s, and Bennet Murdock (1962) charted the classic U shaped free recall curve. Primacy comes from more rehearsal of early items, recency from items still being in working memory. In design: put the most important items at the start and end of navigation and lists, and keep the middle for the less critical ones.' },
  restorff: { name: 'Von Restorff effect', tip: 'When several similar things are shown, the one that differs is the one remembered. Also called the isolation effect.', tryThis: 'Same memory test, but one word in the middle is shown in a different colour and weight. Over a few runs, compare recall of the isolated word with its neighbours.', deep: 'Hedwig von Restorff described it in 1933. It is why one primary button stands out among secondary ones, and why pricing tables highlight one plan. Use it sparingly: if everything is highlighted, nothing is. Do not rely on colour alone to make the difference, as colour blind users may miss it, so change weight, size or add a label too.' },
  peak: { name: 'Peak-end rule', tip: 'People judge an experience mostly by its most intense moment (the peak) and how it ended, not by the average of every moment.', tryThis: 'Drag the points to shape an experience, minute by minute. Compare the true average with the peak-end estimate. Then pick <b>Add a gentle ending</b>: the experience gets longer and contains more discomfort in total, yet it is remembered as better.', deep: 'Daniel Kahneman and colleagues (1993) had people hold a hand in cold water for 60 seconds, and in another trial for 60 seconds plus 30 more seconds while the water warmed slightly. Most chose to repeat the longer trial. The total amount of discomfort mattered less than the peak and the end (duration neglect). In product terms: fix the worst moment first, and make endings good (a clear success screen, a friendly confirmation).' },
};

export default {
  mount(ctx) {
    const { center } = scrollStage(ctx);
    const tabs = ctx.h(`<div class="dl-tabs">${Object.entries(LAWS).map(([k, v]) => `<button class="chip" data-k="${k}">${v.name}</button>`).join('')}</div>`);
    const host = ctx.h('<div class="dl-board"></div>');
    center.append(tabs, host);
    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">Laws gallery</h2>'), ctx.h('<p class="lede">Seven more findings from psychology that shape interfaces, each with a small experiment.</p>'));
    const seg = ctx.h(`<select class="sel" aria-label="Choose a law">${Object.entries(LAWS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select>`);
    P.append(seg);
    const lawBox = ctx.h('<div style="display:flex;flex-direction:column;gap:12px"></div>');
    P.append(lawBox);
    let cur = null; let clean = null;
    const timers = new Set();
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
    const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };

    function show(k) {
      if (clean) { clean(); clean = null; }
      clearTimers();
      cur = k; seg.value = k;
      tabs.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.k === k));
      const L = LAWS[k];
      lawBox.innerHTML = `<h3 style="margin:0">${L.name}</h3><div class="card tip"><p>${L.tip}</p></div><div class="card try"><p>${L.tryThis}</p></div><div class="card deep"><p>${L.deep}</p></div>`;
      host.innerHTML = '';
      clean = DEMOS[k]() || null;
    }
    tabs.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => show(c.dataset.k), { signal: ctx.signal }));
    seg.addEventListener('change', () => show(seg.value), { signal: ctx.signal });

    const sheet = (title, html) => { const el = ctx.h(`<div class="dl-sheet"><h4>${title}</h4>${html}</div>`); host.append(el); return el; };

    const DEMOS = {
      jakob() {
        const s = sheet('Find the cart', `<div class="jk-page" style="position:relative;height:300px;border-radius:10px;background:#fbfaf7;color:#1d1d1b;overflow:hidden;font-family:Inter,sans-serif"></div>
          <div class="row" style="margin-top:10px"><button class="btn sm jk-go">Start</button><span class="dl-mono jk-msg"></span></div><div class="stat jk-stat" style="margin-top:10px"></div>`);
        const page = s.querySelector('.jk-page'); const msg = s.querySelector('.jk-msg');
        const res = { usual: [], odd: [] }; let order = []; let i = -1; let t0 = 0;
        const cart = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19" r="1.6"/><circle cx="17" cy="19" r="1.6"/></svg>';
        const decoys = ['<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-4.5-9-9.5C1.6 7.6 5 4 8.5 5.5 10 6.1 11 7.3 12 8.5c1-1.2 2-2.4 3.5-3C19 4 22.4 7.6 21 11.5 19 16.5 12 21 12 21z"/></svg>', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg>'];
        const draw = (kind) => {
          const pos = kind === 'usual' ? { right: '16px', top: '14px' } : shuffle([{ left: '16px', bottom: '14px' }, { left: '45%', top: '52%' }, { right: '16px', bottom: '14px' }, { left: '16px', top: '60px' }, { left: '30%', top: '14px' }])[0];
          const css = Object.entries(pos).map(([a, b]) => `${a}:${b}`).join(';');
          page.innerHTML = `<div style="position:absolute;left:0;right:0;top:0;height:50px;border-bottom:1px solid #e7e5e4"></div>
            <b style="position:absolute;${kind === 'usual' ? 'left:16px' : 'right:16px'};top:15px;font-weight:800">shopkeep</b>
            <div style="position:absolute;left:50%;top:10px;transform:translateX(-50%);width:34%;height:30px;border:1px solid #d6d3d1;border-radius:8px"></div>
            <div style="position:absolute;left:16px;right:16px;top:70px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px">${Array.from({ length: 8 }, () => '<div style="height:90px;border-radius:8px;background:#efebe4"></div>').join('')}</div>
            ${kind === 'usual' ? `<span style="position:absolute;right:56px;top:14px;color:#55554f">${decoys[0]}</span><span style="position:absolute;right:96px;top:14px;color:#55554f">${decoys[1]}</span>` : `<span style="position:absolute;right:56px;top:14px;color:#55554f">${decoys[0]}</span><span style="position:absolute;right:96px;top:14px;color:#55554f">${decoys[1]}</span><span style="position:absolute;right:136px;top:14px;color:#55554f">${decoys[2]}</span>`}
            <button class="jk-cart" aria-label="Cart" style="position:absolute;${css};color:#1d1d1b;background:#fbfaf7;border:0;padding:4px;border-radius:6px;z-index:2">${cart}</button>`;
          page.querySelector('.jk-cart').addEventListener('pointerdown', () => { const t = performance.now() - t0; res[kind].push(t); msg.textContent = `${Math.round(t)} ms (${kind === 'usual' ? 'usual place' : 'unusual place'})`; later(step, 450); page.innerHTML = ''; });
          t0 = performance.now();
        };
        const statUpd = () => { s.querySelector('.jk-stat').innerHTML = `<div><b>${res.usual.length ? Math.round(mean(res.usual)) : '-'}</b><span>Usual (ms)</span></div><div><b>${res.odd.length ? Math.round(mean(res.odd)) : '-'}</b><span>Unusual (ms)</span></div><div><b>${res.usual.length && res.odd.length ? `${(mean(res.odd) / mean(res.usual)).toFixed(1)}x` : '-'}</b><span>Slower</span></div>`; };
        function step() { statUpd(); i++; if (i >= order.length) { msg.textContent = 'Done. Compare the two means.'; page.innerHTML = ''; return; } msg.textContent = `Page ${i + 1} of ${order.length}: click the cart`; draw(order[i]); }
        s.querySelector('.jk-go').addEventListener('click', () => { res.usual = []; res.odd = []; order = shuffle(['usual', 'usual', 'usual', 'usual', 'odd', 'odd', 'odd', 'odd']); i = -1; step(); });
        page.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:#77776f;font:500 12px DM Mono,monospace">Press Start</div>';
        statUpd();
      },

      tesler() {
        const today = new Date(); today.setHours(12, 0, 0, 0);
        const fmt = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
        const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
        const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        const nextDow = (dow, skip = 0) => { let n = (dow - today.getDay() + 7) % 7; if (n === 0) n = 7; return add(today, n + skip * 7); };
        const tasks = [['tomorrow', add(today, 1)], ['next Friday', nextDow(5)], ['in two weeks', add(today, 14)], ['the 3rd of June next year', new Date(today.getFullYear() + 1, 5, 3, 12)]];
        function parse(s) {
          s = s.toLowerCase().trim().replace(/\s+/g, ' ');
          if (!s) return null;
          if (s === 'today') return today; if (s === 'tomorrow') return add(today, 1); if (s === 'yesterday') return add(today, -1);
          let m = s.match(/^in (\d+|a|one|two|three|four) (day|week|month)s?$/);
          if (m) { const n = { a: 1, one: 1, two: 2, three: 3, four: 4 }[m[1]] ?? +m[1]; if (m[2] === 'day') return add(today, n); if (m[2] === 'week') return add(today, 7 * n); const x = new Date(today); x.setMonth(x.getMonth() + n); return x; }
          m = s.match(/^(next |this )?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)[a-z]*$/);
          if (m) { const d = DAYS.findIndex((x) => x.startsWith(m[2].slice(0, 3))); return nextDow(d); }
          m = s.match(/^(?:the )?(\d{1,2})(?:st|nd|rd|th)?(?: of)? ([a-z]+)(?: (next year|\d{4}))?$/) || s.match(/^([a-z]+) (\d{1,2})(?:st|nd|rd|th)?(?: (next year|\d{4}))?$/);
          if (m) {
            let day; let mon; let yr;
            if (/^\d/.test(m[1])) { day = +m[1]; mon = m[2]; yr = m[3]; } else { mon = m[1]; day = +m[2]; yr = m[3]; }
            const mi = MONTHS.findIndex((x) => x.startsWith(mon.slice(0, 3))); if (mi < 0) return null;
            let y = yr === 'next year' ? today.getFullYear() + 1 : yr ? +yr : today.getFullYear();
            let d = new Date(y, mi, day, 12); if (!yr && d < today) d = new Date(y + 1, mi, day, 12);
            return d.getDate() === day ? d : null;
          }
          m = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
          if (m) { let y = m[3] ? +m[3] : today.getFullYear(); if (y < 100) y += 2000; const d = new Date(y, +m[2] - 1, +m[1], 12); return d.getDate() === +m[1] ? d : null; }
          return null;
        }
        const s = sheet('Two date fields', `<p class="dl-mono tz-task" style="margin:0 0 10px;color:var(--text)"></p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">
            <div style="display:grid;gap:6px"><label class="dl-mono">Strict: DD/MM/YYYY only</label><input class="txt tz-a" placeholder="DD/MM/YYYY"><span class="dl-mono tz-ao"></span></div>
            <div style="display:grid;gap:6px"><label class="dl-mono">Smart: type it your way</label><input class="txt tz-b" placeholder="e.g. next friday"><span class="dl-mono tz-bo"></span></div></div>
          <div class="stat tz-stat" style="margin-top:12px"></div>`);
        let ti = 0; const err = { a: 0, b: 0 }; const done = { a: false, b: false };
        const task = () => { s.querySelector('.tz-task').innerHTML = ti < tasks.length ? `Task ${ti + 1} of ${tasks.length}: enter <b>${tasks[ti][0]}</b> (today is ${fmt(today)})` : 'All done. The smart field moved the complexity into code.'; };
        const st = () => { s.querySelector('.tz-stat').innerHTML = `<div><b>${err.a}</b><span>Strict errors</span></div><div><b>${err.b}</b><span>Smart errors</span></div><div><b>${Math.min(ti, tasks.length)}/${tasks.length}</b><span>Tasks</span></div>`; };
        const check = (which) => {
          if (ti >= tasks.length) return;
          const inp = s.querySelector(`.tz-${which}`); const out = s.querySelector(`.tz-${which}o`); const want = tasks[ti][1];
          let d = null;
          if (which === 'a') { const m = inp.value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/); d = m ? new Date(+m[3], +m[2] - 1, +m[1], 12) : null; if (!m) { err.a++; out.innerHTML = '<span style="color:var(--c4)">Invalid format. Use DD/MM/YYYY.</span>'; st(); return; } }
          else { d = parse(inp.value); if (!d) { err.b++; out.innerHTML = '<span style="color:var(--c4)">Sorry, I did not understand that.</span>'; st(); return; } }
          const ok = d.toDateString() === want.toDateString();
          if (!ok) { err[which]++; out.innerHTML = `<span style="color:var(--c4)">Read as ${fmt(d)}, not the date asked</span>`; st(); return; }
          out.innerHTML = `<span style="color:var(--ok)">${fmt(d)}</span>`; done[which] = true;
          if (done.a && done.b) { ti++; done.a = done.b = false; later(() => { s.querySelector('.tz-a').value = ''; s.querySelector('.tz-b').value = ''; s.querySelector('.tz-ao').textContent = ''; s.querySelector('.tz-bo').textContent = ''; task(); st(); }, 700); }
          st();
        };
        s.querySelector('.tz-b').addEventListener('input', (e) => { const d = parse(e.target.value); s.querySelector('.tz-bo').textContent = d ? `Will save: ${fmt(d)}  (Enter to submit)` : e.target.value ? 'Keep typing...' : ''; });
        ['a', 'b'].forEach((w) => s.querySelector(`.tz-${w}`).addEventListener('keydown', (e) => { if (e.key === 'Enter') check(w); }));
        s.querySelector('.tz-a').addEventListener('blur', () => { if (s.querySelector('.tz-a').value) check('a'); });
        s.querySelector('.tz-b').addEventListener('blur', () => { if (s.querySelector('.tz-b').value) check('b'); });
        task(); st();
      },

      doherty() {
        const s = sheet('A search box with a delay', `<div class="row"><span class="dl-mono">Response time</span></div><div class="dh-seg" style="margin:6px 0 10px"></div>
          <label class="check"><input type="checkbox" class="dh-fb"> Show progress feedback while waiting</label>
          <div style="display:flex;gap:8px;margin-top:12px"><input class="txt dh-q" value="waterproof jacket" aria-label="Search"><button class="btn dh-go">Search</button></div>
          <div class="dh-res" style="margin-top:12px;min-height:150px;display:grid;gap:8px"></div>
          <div class="row dh-rate" style="margin-top:6px" hidden><span class="dl-mono">How did that feel?</span><button class="chip" data-r="3">Instant</button><button class="chip" data-r="2">Fine</button><button class="chip" data-r="1">Slow</button></div>
          <table class="dl-tbl dh-tbl" style="margin-top:12px"></table>`);
        let lat = 400; let busy = false; const ratings = { 50: [], 400: [], 1500: [] }; let last = null;
        const segEl = ctx.seg([[50, '50 ms'], [400, '400 ms'], [1500, '1500 ms']], lat, (v) => { lat = +v; });
        s.querySelector('.dh-seg').append(segEl);
        const res = s.querySelector('.dh-res');
        const item = (t, sk) => `<div style="display:flex;gap:10px;align-items:center;padding:8px;border-radius:8px;background:var(--surface-2)"><div style="width:38px;height:38px;border-radius:6px;background:${sk ? 'var(--r-midnight)' : 'linear-gradient(135deg,#5eead4,#60a5fa)'}"></div><div style="flex:1;display:grid;gap:5px">${sk ? '<div style="height:10px;width:60%;border-radius:4px;background:var(--r-midnight)"></div><div style="height:8px;width:40%;border-radius:4px;background:var(--r-midnight)"></div>' : `<b style="font:600 14px Inter">${t}</b><span class="dl-mono">In stock</span>`}</div></div>`;
        const table = () => { s.querySelector('.dh-tbl').innerHTML = '<tr><th>Delay</th><th>Ratings</th><th>Felt</th></tr>' + [50, 400, 1500].map((k) => { const a = ratings[k]; const m = a.length ? mean(a) : 0; return `<tr><td>${k} ms</td><td>${a.length}</td><td>${a.length ? (m > 2.5 ? 'instant' : m > 1.5 ? 'fine' : 'slow') : '-'}</td></tr>`; }).join(''); };
        s.querySelector('.dh-go').addEventListener('click', () => {
          if (busy) return; busy = true; const t0 = performance.now(); const fb = s.querySelector('.dh-fb').checked;
          s.querySelector('.dh-rate').hidden = true;
          res.innerHTML = fb ? item('', true) + item('', true) + item('', true) : '';
          later(() => {
            const q = s.querySelector('.dh-q').value || 'jacket';
            res.innerHTML = [`${q}, lightweight`, `${q}, insulated`, `${q}, recycled shell`].map((t) => item(t)).join('') + `<span class="dl-mono">Answered in ${Math.round(performance.now() - t0)} ms</span>`;
            busy = false; last = lat; s.querySelector('.dh-rate').hidden = false;
          }, lat);
        });
        s.querySelectorAll('.dh-rate .chip').forEach((c) => c.addEventListener('click', () => { if (last == null) return; ratings[last].push(+c.dataset.r); last = null; s.querySelector('.dh-rate').hidden = true; table(); }));
        table();
      },

      aesthetic() {
        const fields = [['Full name', 'Ada Lovelace'], ['Email', 'ada@example.com'], ['Card number', '4242 4242 4242 4242']];
        const ugly = `<div style="background:#c0c0c0;padding:10px;border:2px outset #fff;font:13px 'Times New Roman',serif;color:#000;display:grid;gap:4px"><b style="font:bold 15px Arial;background:#000080;color:#fff;padding:2px 6px">PAYMENT FORM</b>${fields.map(([l, p]) => `<label>${l}:<br><input style="width:100%;border:2px inset #fff;font:13px 'Courier New';padding:2px;background:#fff;color:#000;color-scheme:light" placeholder="${p}"></label>`).join('')}<button style="justify-self:start;margin-top:4px;border:2px outset #fff;background:#c0c0c0;font:13px Arial;padding:2px 10px">Submit</button></div>`;
        const pretty = `<div style="background:#fff;padding:18px;border-radius:14px;font-family:Inter,sans-serif;color:#18181b;display:grid;gap:10px;box-shadow:0 10px 30px rgba(0,0,0,.25)"><b style="font:700 17px Inter">Payment</b>${fields.map(([l, p]) => `<label style="display:grid;gap:4px;font:500 12.5px Inter;color:#52525b">${l}<input style="border:1px solid #e4e4e7;border-radius:8px;padding:9px 10px;font:14px Inter;background:#fff;color:#18181b;color-scheme:light" placeholder="${p}"></label>`).join('')}<button style="margin-top:4px;border:0;border-radius:10px;background:#18181b;color:#fff;font:600 14px Inter;padding:11px">Submit</button></div>`;
        const s = sheet('Rate before you use', `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">
          <div style="display:grid;gap:10px">${ugly}<div class="row ae-a"><span class="dl-mono">Looks easy?</span>${[1, 2, 3, 4, 5].map((n) => `<button class="chip" data-v="${n}">${n}</button>`).join('')}</div></div>
          <div style="display:grid;gap:10px">${pretty}<div class="row ae-b"><span class="dl-mono">Looks easy?</span>${[1, 2, 3, 4, 5].map((n) => `<button class="chip" data-v="${n}">${n}</button>`).join('')}</div></div></div>
          <div class="row" style="margin-top:12px"><button class="btn sm ae-rev">Reveal</button><span class="dl-mono ae-out"></span></div>`);
        const r = { a: 0, b: 0 };
        ['a', 'b'].forEach((k) => s.querySelectorAll(`.ae-${k} .chip`).forEach((c) => c.addEventListener('click', () => { r[k] = +c.dataset.v; s.querySelectorAll(`.ae-${k} .chip`).forEach((x) => x.classList.toggle('on', x === c)); })));
        s.querySelector('.ae-rev').addEventListener('click', () => {
          s.querySelector('.ae-out').textContent = r.a && r.b ? `You rated the plain form ${r.a} and the styled form ${r.b}. Same 3 fields, same labels, same order, same single button: the only difference is the look.${r.b > r.a ? ' That gap is the aesthetic-usability effect.' : ''}` : 'Rate both forms first.';
        });
      },

      serial() { return memoryDemo(false); },
      restorff() { return memoryDemo(true); },

      peak() {
        const s = sheet('Shape an experience (drag the points)', `<div class="pk-plot" style="position:relative;height:260px"></div>
          <div class="row" style="margin-top:10px"><button class="chip" data-p="checkout">Checkout, error at the end</button><button class="chip" data-p="fixed">Same, smooth ending</button><button class="chip" data-p="cold">Add a gentle ending</button></div>
          <div class="stat pk-stat" style="margin-top:12px"></div>`);
        const cv = ctx.canvas({ parent: s.querySelector('.pk-plot') }); const g = cv.ctx; const C = ctx.colors;
        const PRE = { checkout: [1, 2, 1, 0, 1, 2, 1, 0, -2, -4], fixed: [1, 2, 1, 0, 1, 2, 1, 0, 2, 3] };
        let v = PRE.checkout.slice(); let drag = -1;
        const geo = () => { const { w, h } = cv; const L = 62; const R = 16; const T = 14; const B = 26; return { L, R, T, B, X: (i) => L + (i / Math.max(1, v.length - 1)) * (w - L - R), Y: (y) => T + ((5 - y) / 10) * (h - T - B) }; };
        function stats() {
          const avg = mean(v); let pk = v[0]; for (const x of v) if (Math.abs(x) > Math.abs(pk)) pk = x;
          const pe = (pk + v[v.length - 1]) / 2;
          s.querySelector('.pk-stat').innerHTML = `<div><b>${avg.toFixed(1)}</b><span>True average</span></div><div><b>${pk.toFixed(1)}</b><span>Peak</span></div><div><b>${v[v.length - 1].toFixed(1)}</b><span>End</span></div><div><b style="color:${pe >= 0 ? 'var(--ok)' : 'var(--c4)'}">${pe.toFixed(1)}</b><span>Remembered</span></div>`;
          return { avg, pk, pe };
        }
        function draw() {
          const { w, h } = cv; if (!w) return; g.clearRect(0, 0, w, h); const { L, R, B, X, Y } = geo();
          g.font = '500 11px "DM Mono", monospace'; g.textAlign = 'right';
          for (let y = -5; y <= 5; y += 5) { g.strokeStyle = y === 0 ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(L, Y(y)); g.lineTo(w - R, Y(y)); g.stroke(); g.fillStyle = C.muted; g.fillText(y > 0 ? `+${y} good` : y < 0 ? `${y} bad` : '0', L - 4, Y(y) + 4); }
          g.textAlign = 'center'; g.fillText('time (minutes)', (L + w - R) / 2, h - 6);
          const st = stats();
          g.setLineDash([4, 5]); g.strokeStyle = C.muted; g.beginPath(); g.moveTo(L, Y(st.avg)); g.lineTo(w - R, Y(st.avg)); g.stroke();
          g.strokeStyle = st.pe >= 0 ? C.ok : C.c4; g.beginPath(); g.moveTo(L, Y(st.pe)); g.lineTo(w - R, Y(st.pe)); g.stroke(); g.setLineDash([]);
          g.textAlign = 'left'; g.fillStyle = C.muted; g.fillText('average', L + 4, Y(st.avg) - 5); g.fillStyle = st.pe >= 0 ? C.ok : C.c4; g.fillText('remembered (peak + end) / 2', L + 70, Y(st.pe) - 5);
          g.strokeStyle = C.c1; g.lineWidth = 2; g.beginPath(); v.forEach((y, i) => (i ? g.lineTo(X(i), Y(y)) : g.moveTo(X(i), Y(y)))); g.stroke(); g.lineWidth = 1;
          v.forEach((y, i) => { g.beginPath(); g.arc(X(i), Y(y), i === drag ? 8 : 6, 0, Math.PI * 2); g.fillStyle = y === st.pk ? C.c2 : C.c1; g.fill(); });
          void B;
        }
        cv.onResize(draw);
        cv.el.style.touchAction = 'none';
        const at = (e) => { const r = cv.el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
        cv.el.addEventListener('pointerdown', (e) => { const [x] = at(e); const { X } = geo(); let best = 0; let bd = 1e9; v.forEach((_, i) => { const d = Math.abs(X(i) - x); if (d < bd) { bd = d; best = i; } }); drag = best; cv.el.setPointerCapture(e.pointerId); move(e); });
        const move = (e) => { if (drag < 0) return; const [, y] = at(e); const { h } = cv; const { T, B } = geo(); v[drag] = Math.round(clamp(5 - ((y - T) / (h - T - B)) * 10, -5, 5) * 2) / 2; draw(); };
        cv.el.addEventListener('pointermove', (e) => { if (cv.el.hasPointerCapture(e.pointerId)) move(e); });
        cv.el.addEventListener('pointerup', () => { drag = -1; draw(); });
        s.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.p; if (k === 'cold') { if (v.length === 10) v = [...v, -2, -1, -0.5]; } else v = PRE[k].slice(); s.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
        draw();
      },
    };

    // Shared memory list experiment for serial position and isolation
    function memoryDemo(isolate) {
      const key = isolate ? 'restorff' : 'serial';
      const s = sheet(isolate ? 'One word stands out' : 'Twelve words, one at a time', `<div class="mm-show" style="height:120px;display:grid;place-items:center;font:700 40px var(--f-display);letter-spacing:.04em;text-transform:uppercase"></div>
        <div class="mm-pick" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px"></div>
        <div class="row" style="margin-top:10px"><button class="btn sm mm-go">Start</button><button class="btn ghost sm mm-done" hidden>Done picking</button><span class="dl-mono mm-msg"></span></div>
        <div class="mm-plot" style="position:relative;height:190px;margin-top:12px"></div>`);
      const show = s.querySelector('.mm-show'); const pick = s.querySelector('.mm-pick'); const msg = s.querySelector('.mm-msg');
      const cv = ctx.canvas({ parent: s.querySelector('.mm-plot') }); const g = cv.ctx; const C = ctx.colors;
      let hist = ctx.store.get(`mem:${key}`, { runs: 0, hits: Array(12).fill(0), iso: 0, isoRuns: 0 });
      let list = []; let isoAt = -1;
      function plot() {
        const { w, h } = cv; if (!w) return; g.clearRect(0, 0, w, h);
        const L = 40; const B = 22; const T = 28; const bw = (w - L - 8) / 12;
        g.font = '500 11px "DM Mono", monospace';
        g.fillStyle = C.muted; g.textAlign = 'right'; g.fillText('100%', L - 6, T + 4); g.fillText('0', L - 6, h - B);
        g.strokeStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(L, T); g.lineTo(w - 8, T); g.moveTo(L, h - B); g.lineTo(w - 8, h - B); g.stroke();
        for (let i = 0; i < 12; i++) {
          const r = hist.runs ? hist.hits[i] / hist.runs : 0; const bh = r * (h - B - T);
          g.fillStyle = i < 3 ? C.c1 : i > 8 ? C.c5 : 'rgba(232,232,227,.55)';
          g.fillRect(L + i * bw + 3, h - B - bh, bw - 6, bh);
          g.fillStyle = C.muted; g.textAlign = 'center'; g.fillText(String(i + 1), L + i * bw + bw / 2, h - 6);
        }
        g.textAlign = 'left'; g.fillStyle = C.muted;
        g.fillText(hist.runs ? `recall by position over ${hist.runs} run${hist.runs > 1 ? 's' : ''}${isolate && hist.isoRuns ? ` · isolated word recalled ${Math.round((hist.iso / hist.isoRuns) * 100)}%` : ''}` : 'your recall by list position will appear here', 0, 11);
      }
      cv.onResize(plot);
      s.querySelector('.mm-go').addEventListener('click', () => {
        const pool = shuffle(WORDS.slice()); list = pool.slice(0, 12); const lures = pool.slice(12, 24);
        isoAt = isolate ? 4 + Math.floor(Math.random() * 4) : -1;
        pick.innerHTML = ''; s.querySelector('.mm-go').hidden = true; msg.textContent = 'Watch...';
        list.forEach((wd, i) => later(() => {
          show.innerHTML = `<span style="${i === isoAt ? 'color:#fb7185;font-size:46px' : ''}">${wd}</span>`;
          later(() => { show.textContent = ''; }, 750);
        }, i * 1000));
        later(() => {
          msg.textContent = 'Tap every word you saw, then Done';
          s.querySelector('.mm-done').hidden = false;
          shuffle([...list, ...lures]).forEach((wd) => { const b = ctx.h(`<button class="chip" data-w="${wd}">${wd}</button>`); b.addEventListener('click', () => b.classList.toggle('on')); pick.append(b); });
        }, 12 * 1000 + 200);
      });
      s.querySelector('.mm-done').addEventListener('click', () => {
        const chosen = new Set([...pick.querySelectorAll('.chip.on')].map((b) => b.dataset.w));
        let fa = 0; pick.querySelectorAll('.chip').forEach((b) => { const inList = list.includes(b.dataset.w); if (b.classList.contains('on') && !inList) fa++; b.style.borderColor = inList ? 'var(--ok)' : ''; b.disabled = true; });
        hist.runs++; list.forEach((wd, i) => { if (chosen.has(wd)) hist.hits[i]++; });
        if (isoAt >= 0) { hist.isoRuns++; if (chosen.has(list[isoAt])) hist.iso++; }
        ctx.store.set(`mem:${key}`, hist);
        const got = list.filter((wd) => chosen.has(wd)).length;
        msg.textContent = `${got} of 12 recalled, ${fa} false alarm${fa === 1 ? '' : 's'}. Green borders were on the list.`;
        s.querySelector('.mm-done').hidden = true; s.querySelector('.mm-go').hidden = false; s.querySelector('.mm-go').textContent = 'Run again';
        plot();
      });
      show.innerHTML = '<span class="dl-mono" style="font-size:12px;text-transform:none;letter-spacing:0">Press Start. Words appear for under a second each.</span>';
      plot();
    }

    show('jakob');
    ctx.quiz([
      { q: 'Jakob\'s law suggests putting the shopping cart...', choices: ['Somewhere surprising to delight users', 'Where most other shops put it, top right', 'Only in the footer'], answer: 1, why: 'People bring expectations from other sites. Matching them removes a learning cost.' },
      { q: 'A search takes 1.5 seconds and cannot be made faster. What does the Doherty threshold research suggest?', choices: ['Show progress feedback so the system feels responsive', 'Hide all feedback', 'Add more animations to the logo'], answer: 0, why: 'Above about 400 ms people lose flow. Skeletons and progress indicators keep them oriented.' },
      { q: 'By the peak-end rule, which change most improves how a checkout is remembered?', choices: ['Shortening a pleasant middle step', 'Fixing the worst moment and making the final screen good', 'Adding more steps'], answer: 1, why: 'Memory weights the most intense moment and the ending, not the average.' },
    ]);
    return () => { if (clean) clean(); clearTimers(); };
  },
};
