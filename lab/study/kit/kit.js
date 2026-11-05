// Study kit: the shared frame for every Study Lab subject.
// A lab is a list of chapters. Each chapter is an ES module that draws on the stage and writes its lesson in the panel.
//
//   import { createLab } from '../study/kit/kit.js';
//   createLab({
//     id: 'ml', title: 'ML Lab', intro: 'One line about the subject.', about: '<p>...</p>',
//     chapters: [ { id: 'knn', title: 'Nearest neighbours', group: 'Supervised', blurb: 'Short line', load: () => import('./chapters/knn.js') } ],
//   });
//
// A chapter module's default export is { mount(ctx) } and mount may return a cleanup function.
// ctx gives you:
//   ctx.stage        the element to draw in (fills the stage, already sized, position: relative children are fine)
//   ctx.panel        the element for the lesson text and controls
//   ctx.h(html)      parse an HTML string into a DocumentFragment-like element (first child returned when it is one node)
//   ctx.canvas(opts) a HiDPI canvas filling the stage; returns { el, ctx: 2d context, w, h, dpr, onResize(fn) }
//   ctx.onResize(fn) called with (w, h) whenever the stage changes size
//   ctx.loop(fn)     requestAnimationFrame loop with (t, dt seconds); stops on cleanup and pauses when the tab is hidden
//   ctx.slider({ label, min, max, step, value, unit, fmt, onInput }) returns the element; .value getter and setter
//   ctx.seg(options, value, onChange) a segmented control; options is [[value, label], ...]
//   ctx.quiz(questions) appends a "Check yourself" block; each question is { q, choices: [...], answer: index, why }
//                       finishing it with 2 of 3 or better marks the chapter done
//   ctx.store.get(k, d) / ctx.store.set(k, v) small per lab storage in this browser
//   ctx.done()       mark the chapter as done by hand
//   ctx.signal       an AbortSignal that fires on cleanup (pass to addEventListener)
//   ctx.colors       { c1..c6, text, muted, border, ok, bad, teal, bg, surface } as hex strings, for canvas drawing
//   ctx.go(id)       jump to another chapter
//   ctx.tall()       on phones, let the stage grow with its content instead of a fixed sticky height
//   ctx.full()       hide the side panel on wide screens (rarely needed)

const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const COLORS = {
  c1: '#5EEAD4', c2: '#FBBF24', c3: '#A78BFA', c4: '#FB7185', c5: '#60A5FA', c6: '#A3E635',
  text: '#F5F5F0', text2: '#E8E8E3', muted: '#A0A09A', subtle: '#5A5A55', border: '#2A2A2A', borderStrong: '#3A3A38',
  ok: '#4ade80', bad: '#a78bfa', teal: '#5EEAD4', brand: '#D62828', bg: '#0A0A0A', surface: '#141414', surface2: '#1E1E1E',
};

function makeStore(id) {
  return {
    get(k, d) { try { const v = localStorage.getItem(`${id}:${k}`); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(`${id}:${k}`, JSON.stringify(v)); } catch { /* private window */ } },
  };
}

function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.childNodes.length === 1 ? t.content.firstChild : t.content;
}

const CHEV = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';

export function createLab(cfg) {
  const store = makeStore(cfg.id);
  const done = new Set(store.get('done', []));
  const chapters = cfg.chapters;
  const idx = (id) => chapters.findIndex((c) => c.id === id);

  document.body.innerHTML = `
  <div class="k-app">
    <header class="k-top">
      <a class="brand" href="../study/"><span class="b1">Study Lab</span><span class="b2">${esc(cfg.title)}</span></a>
      <nav class="k-chap glass" aria-label="Chapters">
        <button class="k-prev" aria-label="Previous chapter">‹</button>
        <button class="k-cur" aria-haspopup="dialog"><span class="n"></span><span class="t"></span>${CHEV}</button>
        <button class="k-next" aria-label="Next chapter">›</button>
      </nav>
      <div class="spacer"></div>
      <div class="info">
        <button class="info-btn" aria-controls="k-about" aria-expanded="false" aria-label="About ${esc(cfg.title)}">i</button>
        <div class="pop" id="k-about" hidden><h4>${esc(cfg.title)}</h4>${cfg.about || ''}<p class="fine">Everything runs on your device. Your progress stays in this browser.</p></div>
      </div>
      <a class="site-link" href="https://www.rabiatsadiq.com/lab/">rabiatsadiq.com</a>
    </header>
    <main class="k-main">
      <section class="k-stage" aria-label="Interactive"><div class="k-inner"></div></section>
      <aside class="k-side glass"><div class="k-panel" aria-live="polite"></div></aside>
      <div class="k-over" hidden></div>
    </main>
  </div>`;

  const stageEl = $('.k-stage');
  const inner = $('.k-inner');
  const side = $('.k-side');
  const panelHost = $('.k-panel');
  const over = $('.k-over');

  // Info popover
  const ib = $('.info-btn'); const pop = $('#k-about');
  ib.addEventListener('click', (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; ib.setAttribute('aria-expanded', String(!pop.hidden)); });
  document.addEventListener('click', (e) => { if (!pop.hidden && !pop.contains(e.target)) { pop.hidden = true; ib.setAttribute('aria-expanded', 'false'); } });

  // Drawer
  function openDrawer() {
    const groups = [];
    for (const [i, c] of chapters.entries()) {
      let g = groups.find((x) => x.name === (c.group || ''));
      if (!g) { g = { name: c.group || '', items: [] }; groups.push(g); }
      g.items.push([i, c]);
    }
    const d = h(`<div class="k-drawer" role="dialog" aria-label="Chapters"><div class="scrim"></div><div class="sheet">
      <div class="hd"><b>${esc(cfg.title)}</b><button class="k-x" aria-label="Close">×</button></div>
      <button class="k-item ${cur === -1 ? 'on' : ''}" data-i="-1"><span class="n">00</span><span class="t">Overview<small>${esc(cfg.intro || 'Every chapter at a glance')}</small></span><span></span></button>
      ${groups.map((g) => `${g.name ? `<h3>${esc(g.name)}</h3>` : ''}${g.items.map(([i, c]) => `<button class="k-item ${i === cur ? 'on' : ''}" data-i="${i}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${esc(c.title)}${c.blurb ? `<small>${esc(c.blurb)}</small>` : ''}</span><span class="tick ${done.has(c.id) ? 'done' : ''}" title="${done.has(c.id) ? 'Done' : ''}"></span></button>`).join('')}`).join('')}
    </div></div>`);
    document.body.append(d);
    const close = () => d.remove();
    d.querySelector('.scrim').onclick = close;
    d.querySelector('.k-x').onclick = close;
    d.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    d.querySelectorAll('.k-item').forEach((b) => b.addEventListener('click', () => { close(); show(+b.dataset.i); }));
    (d.querySelector('.k-item.on') || d.querySelector('.k-item')).focus();
    d.querySelector('.k-item.on')?.scrollIntoView({ block: 'center' });
  }
  $('.k-cur').addEventListener('click', openDrawer);
  $('.k-prev').addEventListener('click', () => show(cur - 1));
  $('.k-next').addEventListener('click', () => show(cur + 1));

  // Overview
  function renderOverview() {
    const groups = [];
    for (const [i, c] of chapters.entries()) {
      let g = groups.find((x) => x.name === (c.group || ''));
      if (!g) { g = { name: c.group || '', items: [] }; groups.push(g); }
      g.items.push([i, c]);
    }
    const n = chapters.filter((c) => done.has(c.id)).length;
    over.innerHTML = `<h1>${esc(cfg.title)}</h1><p>${cfg.overview || esc(cfg.intro || '')}</p>
      <div class="k-path"><button class="btn" data-i="${firstUndone()}">${n ? 'Continue' : 'Start at the beginning'}</button><span class="hint">${n} of ${chapters.length} chapters done</span></div>
      ${groups.map((g) => `${g.name ? `<h2>${esc(g.name)}</h2>` : ''}<div class="k-grid">${g.items.map(([i, c]) => `<button class="k-tile" data-i="${i}"><span class="n"><span>${String(i + 1).padStart(2, '0')}</span><span class="tick ${done.has(c.id) ? 'done' : ''}"></span></span><b>${esc(c.title)}</b>${c.blurb ? `<span class="d">${esc(c.blurb)}</span>` : ''}</button>`).join('')}</div>`).join('')}`;
    over.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => show(+b.dataset.i)));
  }
  const firstUndone = () => { const i = chapters.findIndex((c) => !done.has(c.id)); return i < 0 ? 0 : i; };

  // Chapter lifecycle
  let cur = -2; let cleanup = null; let ac = null; let token = 0;
  const resizeFns = new Set();
  const ro = new ResizeObserver(() => { const r = inner.getBoundingClientRect(); for (const f of resizeFns) f(r.width, r.height); });
  ro.observe(inner);

  function markDone(id) {
    if (done.has(id)) return;
    done.add(id); store.set('done', [...done]);
  }

  async function show(i) {
    if (i < -1 || i >= chapters.length) return;
    const my = ++token;
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    if (ac) ac.abort();
    resizeFns.clear();
    inner.innerHTML = ''; panelHost.innerHTML = '';
    stageEl.classList.remove('full', 'tall');
    cur = i;
    $('.k-prev').disabled = i <= -1;
    $('.k-next').disabled = i >= chapters.length - 1;
    const c = chapters[i];
    $('.k-cur .n').textContent = i < 0 ? '00' : String(i + 1).padStart(2, '0');
    $('.k-cur .t').textContent = i < 0 ? 'Overview' : c.title;
    history.replaceState(null, '', i < 0 ? location.pathname : `#${c.id}`);
    window.scrollTo(0, 0);
    if (i < 0) {
      stageEl.hidden = true; side.hidden = true; over.hidden = false;
      document.title = `${cfg.title} · Rabiat's Lab`;
      renderOverview(); return;
    }
    stageEl.hidden = false; side.hidden = false; over.hidden = true;
    document.title = `${c.title} · ${cfg.title}`;
    inner.innerHTML = '<div class="k-loading">Loading…</div>';
    let mod;
    try { mod = await c.load(); } catch (e) {
      console.error(e);
      inner.innerHTML = '<div class="k-loading">This chapter did not load. Try refreshing.</div>';
      return;
    }
    if (my !== token) return;
    inner.innerHTML = '';
    ac = new AbortController();
    const ctx = makeCtx(c, ac.signal);
    const head = h(`<div><p class="eyebrow">${esc(c.group || cfg.title)} · Chapter ${i + 1} of ${chapters.length}</p></div>`);
    panelHost.append(head);
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:14px';
    panelHost.append(body);
    ctx.panel = body;
    try {
      const r = (mod.default || mod).mount(ctx);
      cleanup = typeof r === 'function' ? r : (r && typeof r.then === 'function' ? null : null);
      if (r && typeof r.then === 'function') r.then((f) => { if (my === token && typeof f === 'function') cleanup = f; });
    } catch (e) {
      console.error(e);
      body.append(h('<p class="muted">Something went wrong drawing this chapter.</p>'));
    }
    // Next chapter footer
    const nav = h(`<div class="k-nav">${i > 0 ? '<button class="btn ghost k-b">‹ Back</button>' : ''}${i < chapters.length - 1 ? `<button class="btn k-f">Next: ${esc(chapters[i + 1].title)} ›</button>` : '<button class="btn k-o">All chapters</button>'}</div>`);
    panelHost.append(nav);
    nav.querySelector('.k-b')?.addEventListener('click', () => show(i - 1));
    nav.querySelector('.k-f')?.addEventListener('click', () => { markDone(c.id); show(i + 1); });
    nav.querySelector('.k-o')?.addEventListener('click', () => { markDone(c.id); show(-1); });
    // First resize tick so canvases size themselves
    requestAnimationFrame(() => { const rr = inner.getBoundingClientRect(); for (const f of resizeFns) f(rr.width, rr.height); });
  }

  function makeCtx(c, signal) {
    const ctx = {
      stage: inner, panel: null, h, esc, store, signal, colors: COLORS,
      go: (id) => { const j = idx(id); if (j >= 0) show(j); },
      done: () => markDone(c.id),
      tall: () => stageEl.classList.add('tall'),
      full: () => { stageEl.classList.add('full'); side.hidden = true; },
      onResize(fn) { resizeFns.add(fn); const r = inner.getBoundingClientRect(); if (r.width) fn(r.width, r.height); },
      canvas(opts = {}) {
        const el = document.createElement('canvas');
        el.style.cssText = `position:absolute;inset:0;width:100%;height:100%;${opts.style || ''}`;
        (opts.parent || inner).append(el);
        const g = el.getContext('2d');
        const o = { el, ctx: g, w: 0, h: 0, dpr: 1, fns: [] };
        o.onResize = (fn) => { o.fns.push(fn); if (o.w) fn(o.w, o.h); };
        const fit = () => {
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          o.dpr = Math.min(2, window.devicePixelRatio || 1);
          o.w = r.width; o.h = r.height;
          el.width = Math.round(r.width * o.dpr); el.height = Math.round(r.height * o.dpr);
          g.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
          for (const f of o.fns) f(o.w, o.h);
        };
        const rob = new ResizeObserver(fit); rob.observe(el);
        signal.addEventListener('abort', () => rob.disconnect());
        fit();
        return o;
      },
      loop(fn) {
        let raf = 0; let last = performance.now(); let alive = true;
        const tick = (t) => { if (!alive) return; const dt = Math.min(0.05, (t - last) / 1000); last = t; if (!document.hidden) fn(t / 1000, dt); raf = requestAnimationFrame(tick); };
        raf = requestAnimationFrame(tick);
        const stop = () => { alive = false; cancelAnimationFrame(raf); };
        signal.addEventListener('abort', stop);
        return stop;
      },
      slider({ label, min = 0, max = 1, step = 0.01, value = 0, unit = '', fmt, onInput }) {
        const id = `s${Math.random().toString(36).slice(2, 8)}`;
        const f = fmt || ((v) => `${+(+v).toFixed(4)}${unit}`);
        const el = h(`<div class="slider"><label for="${id}">${esc(label)}</label><output>${esc(f(value))}</output><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></div>`);
        const inp = el.querySelector('input'); const out = el.querySelector('output');
        inp.addEventListener('input', () => { out.textContent = f(+inp.value); onInput && onInput(+inp.value); });
        Object.defineProperty(el, 'value', { get: () => +inp.value, set: (v) => { inp.value = v; out.textContent = f(+inp.value); } });
        el.input = inp;
        return el;
      },
      seg(options, value, onChange) {
        const el = h(`<div class="seg" role="group">${options.map(([v, l]) => `<button data-v="${esc(v)}" class="${String(v) === String(value) ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`);
        el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
          el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
          const opt = options.find(([v]) => String(v) === b.dataset.v);
          onChange && onChange(opt ? opt[0] : b.dataset.v);
        }));
        el.set = (v) => el.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === String(v)));
        return el;
      },
      quiz(questions) {
        const box = h('<div class="k-quiz"><div class="qh"><b>Check yourself</b><span class="eyebrow"></span></div><div class="qb"></div></div>');
        ctx.panel.append(box);
        let k = 0; let right = 0;
        const qb = box.querySelector('.qb'); const ctr = box.querySelector('.eyebrow');
        const best = store.get(`quiz:${c.id}`, null);
        const render = () => {
          ctr.textContent = `${Math.min(k + 1, questions.length)} of ${questions.length}${best != null ? ` · best ${best}/${questions.length}` : ''}`;
          if (k >= questions.length) {
            const pass = right >= Math.ceil(questions.length * 2 / 3);
            if (pass) markDone(c.id);
            const prev = store.get(`quiz:${c.id}`, 0); if (right > prev) store.set(`quiz:${c.id}`, right);
            qb.innerHTML = `<div class="fb ${pass ? 'ok' : 'neutral'}">${right} of ${questions.length} right. ${pass ? 'Chapter done.' : 'Play with the demo a bit more and try again.'}</div><div class="row"><button class="btn ghost sm">Again</button></div>`;
            qb.querySelector('button').onclick = () => { k = 0; right = 0; render(); };
            return;
          }
          const q = questions[k];
          qb.innerHTML = `<p class="prompt ${q.q.length > 70 ? 'small' : ''}" style="${q.q.length > 70 ? 'font-size:17px' : ''}">${q.q}</p><div class="choices">${q.choices.map((x, j) => `<button class="choice" data-j="${j}">${x}</button>`).join('')}</div>`;
          qb.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => {
            const j = +b.dataset.j; const ok = j === q.answer; if (ok) right++;
            qb.querySelectorAll('.choice').forEach((x) => { x.disabled = true; if (+x.dataset.j === q.answer) x.classList.add('right'); });
            if (!ok) b.classList.add('wrong');
            const fb = h(`<div class="fb ${ok ? 'ok' : 'bad'}">${ok ? 'Right. ' : 'Not quite. '}${q.why || ''}</div>`);
            const nx = h(`<div class="row"><button class="btn sm">${k + 1 < questions.length ? 'Next question' : 'See score'}</button></div>`);
            qb.append(fb, nx);
            nx.querySelector('button').onclick = () => { k++; render(); };
          }));
        };
        render();
        return box;
      },
    };
    return ctx;
  }

  // Keyboard: [ and ] step chapters
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    if (document.querySelector('.k-drawer')) return;
    if (e.key === ']') show(cur + 1);
    if (e.key === '[') show(cur - 1);
  });

  const start = idx(location.hash.slice(1));
  show(start >= 0 ? start : -1);
  return { show };
}
