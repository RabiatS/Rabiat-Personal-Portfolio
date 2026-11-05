/* Easter egg: click "Rabiat Sadiq" (top left) 10 times on the homepage and the page has an earthquake.
   The header pieces tip off, then everything on screen drops one by one, some swinging on a hinge first,
   and piles up on the floor. The galaxy background stays. Drag the pieces around, then "Put it back".
   Physics: Matter.js (MIT), loaded only when the egg is close to triggering. */
(function () {
  'use strict';
  const brand = document.querySelector('.header .brand');
  if (!brand || !document.body.classList.contains('page-home')) return;

  const MATTER_URL = 'https://cdn.jsdelivr.net/npm/matter-js@0.19.0/build/matter.min.js';
  const NEEDED = 10;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let clicks = 0; let lastClick = 0; let busy = false; let fallen = null; let matterP = null;

  const css = document.createElement('style');
  css.textContent = `
    @keyframes qk-wobble { 0%,100% { transform: rotate(0) } 25% { transform: rotate(var(--qk-a)) } 75% { transform: rotate(calc(var(--qk-a) * -1)) } }
    .qk-wobble { animation: qk-wobble .28s ease-in-out; }
    @keyframes qk-shake { 0%,100% { transform: translate(0,0) } 10% { transform: translate(-7px,3px) rotate(-.4deg) } 20% { transform: translate(8px,-4px) rotate(.5deg) } 30% { transform: translate(-9px,2px) } 40% { transform: translate(7px,5px) rotate(-.5deg) } 50% { transform: translate(-6px,-5px) } 60% { transform: translate(6px,3px) rotate(.3deg) } 70% { transform: translate(-4px,-2px) } 80% { transform: translate(3px,2px) } 90% { transform: translate(-2px,1px) } }
    @keyframes qk-tremor { 0%,100% { transform: translate(0,0) } 25% { transform: translate(-1.5px,1px) } 75% { transform: translate(1.5px,-1px) } }
    .qk-shake { animation: qk-shake .55s cubic-bezier(.36,.07,.19,.97) both; }
    .qk-tremor { animation: qk-tremor .16s linear 2; }
    .qk-grab { position: fixed; inset: 0; z-index: 9990; cursor: grab; touch-action: none; }
    .qk-grab:active { cursor: grabbing; }
    .qk-back { position: fixed; z-index: 9999; left: 50%; top: max(18px, env(safe-area-inset-top, 0px)); transform: translate(-50%, -14px); opacity: 0;
      transition: opacity .4s ease, transform .5s cubic-bezier(.2,1.4,.4,1); padding: 12px 20px; border-radius: 999px; border: 1px solid rgba(255,255,255,.22);
      background: rgba(20,16,30,.55); -webkit-backdrop-filter: blur(14px) saturate(1.4); backdrop-filter: blur(14px) saturate(1.4); color: #fff;
      font: 600 14px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif; letter-spacing: .02em; cursor: pointer; box-shadow: 0 10px 30px rgba(0,0,0,.35); }
    .qk-back.in { opacity: 1; transform: translate(-50%, 0); }
    .header.qk-bare { transition: background-color .45s ease, box-shadow .45s ease, border-color .45s ease, -webkit-backdrop-filter .45s ease, backdrop-filter .45s ease, clip-path .5s cubic-bezier(.6,0,.4,1);
      background: transparent !important; box-shadow: none !important; border-color: transparent !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
    .qk-back small { display: block; margin-top: 4px; font-weight: 500; font-size: 11px; opacity: .7; }
  `;
  document.head.append(css);

  function loadMatter() {
    if (window.Matter) return Promise.resolve(window.Matter);
    if (!matterP) {
      matterP = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = MATTER_URL; s.async = true;
        s.onload = () => res(window.Matter); s.onerror = rej;
        document.head.append(s);
      });
    }
    return matterP;
  }

  // Clicking the name on the homepage scrolls to the top instead of reloading, so clicks can be counted.
  brand.addEventListener('click', (e) => {
    e.preventDefault();
    if (busy) return;
    if (fallen) { restore(); return; }
    const now = performance.now();
    clicks = now - lastClick < 1500 ? clicks + 1 : 1;
    lastClick = now;
    if (clicks === 1 && window.scrollY > 0) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    if (clicks >= 3 && !reduce) loadMatter().catch(() => {});
    if (clicks >= 4 && clicks < NEEDED) {
      brand.style.setProperty('--qk-a', `${Math.min(10, (clicks - 3) * 1.6)}deg`);
      brand.classList.remove('qk-wobble'); void brand.offsetWidth; brand.classList.add('qk-wobble');
      if (clicks >= 7 && !reduce) { const m = document.querySelector('main'); m.classList.remove('qk-tremor'); void m.offsetWidth; m.classList.add('qk-tremor'); }
    }
    if (clicks >= NEEDED) { clicks = 0; setTimeout(() => window.rkEgg?.('quake'), 2600); quake(); }
  });

  // The Konami code does it too: up up down down left right left right B A (or the short up up down down left right B A)
  const CODES = [
    ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'],
    ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'b', 'a'],
  ];
  const keys = [];
  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    keys.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    if (keys.length > 10) keys.shift();
    if (keys.length >= 4 && keys.slice(-4).join() === 'ArrowUp,ArrowUp,ArrowDown,ArrowDown' && !reduce) loadMatter().catch(() => {});
    const hit = CODES.some((c) => keys.length >= c.length && keys.slice(-c.length).join() === c.join());
    if (hit && !busy && !fallen) { keys.length = 0; setTimeout(() => window.rkEgg?.('konami'), 2600); quake(); }
  });

  // ---------- Which pieces fall ----------
  const PIECES = [
    '.header .brand', '.header .nav', '.header-controls > *',
    '#vrEye', '.hero .eyebrow', '.hero h1 .qk-line', '.hero h1 .grad', '.hero .lead', '.hero .badges .tag', '.hero .cta-row .btn', '.scroll-cue',
    'main .section-head h2', 'main .section-head p', 'main .card', 'main .t-dot', 'main .t-card', 'main h2', 'main h3', 'main p', 'main .tag', 'main .btn', 'main img',
    'footer .container > *', 'footer p', 'footer a',
  ];
  function splitHeadline() {
    const h1 = document.querySelector('.hero h1');
    if (!h1 || h1.querySelector('.qk-line')) return;
    for (const n of [...h1.childNodes]) {
      if (n.nodeType === 3 && n.textContent.trim()) {
        const s = document.createElement('span'); s.className = 'qk-line'; s.style.display = 'inline-block';
        n.replaceWith(s); s.append(n);
      }
    }
    const g = h1.querySelector('.grad'); if (g) g.style.display = 'inline-block';
  }
  function pick() {
    splitHeadline();
    const vw = innerWidth; const vh = innerHeight; const chosen = [];
    const inside = (el) => chosen.some((c) => c.contains(el) || el.contains(c));
    for (const sel of PIECES) {
      for (const el of document.querySelectorAll(sel)) {
        if (inside(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 6 || r.height < 6 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
        if (r.width * r.height > vw * vh * 0.55) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
        chosen.push(el);
      }
    }
    return chosen;
  }

  // ---------- The quake ----------
  async function quake() {
    busy = true;
    const els = pick();
    if (!els.length) { busy = false; return; }
    const root = document.documentElement;
    const lock = { html: root.style.overflow, body: document.body.style.overflow };
    root.style.overflow = 'hidden'; document.body.style.overflow = 'hidden';

    // Let pieces leave their boxes: open up clipping ancestors for the duration
    const opened = new Map();
    for (const el of els) {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        if (opened.has(a)) continue;
        const cs = getComputedStyle(a);
        if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.contain !== 'none') {
          opened.set(a, { o: a.style.overflow, c: a.style.contain });
          a.style.overflow = 'visible'; a.style.contain = 'none';
        }
      }
    }
    // Lift the sections that hold falling pieces above the sections painted after them
    const lifted = new Map();
    for (const el of els) {
      const sec = el.closest('main > section, footer');
      if (!sec || lifted.has(sec)) continue;
      lifted.set(sec, { z: sec.style.zIndex, p: sec.style.position });
      if (getComputedStyle(sec).position === 'static') sec.style.position = 'relative';
      sec.style.zIndex = '40';
    }
    const items = els.map((el) => {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return { el, r, cx: r.left + r.width / 2, cy: r.top + r.height / 2, base: cs.transform === 'none' ? '' : cs.transform,
        inline: { t: el.style.transform, tr: el.style.transition, wc: el.style.willChange, z: el.style.zIndex, pos: el.style.position, pe: el.style.pointerEvents } };
    });
    for (const it of items) {
      it.el.style.transition = 'none'; it.el.style.willChange = 'transform';
      if (getComputedStyle(it.el).position === 'static') it.el.style.position = 'relative';
      // Fallen pieces paint above the sections below the hero (the header keeps its own stacking)
      if (!it.el.closest('.header')) it.el.style.zIndex = '60';
    }
    fallen = { items, opened, lifted, lock, engine: null, runner: null, raf: 0, grab: null, back: null };

    // The header's glass bar goes away so its pieces fall out of it
    const header = document.querySelector('.header');
    if (header) setTimeout(() => header.classList.add('qk-bare'), reduce ? 0 : 300);
    // Shake first, the whole page including the sky
    if (!reduce) {
      root.classList.remove('qk-shake'); void root.offsetWidth; root.classList.add('qk-shake');
      setTimeout(() => root.classList.remove('qk-shake'), 600);
    }
    let M = null;
    if (!reduce) { try { M = await loadMatter(); } catch { M = null; } }
    await new Promise((r) => setTimeout(r, reduce ? 0 : 380));
    if (!M) { softDrop(items); busy = false; showBack(); return; }
    physicsDrop(M, items);
    busy = false;
    setTimeout(showBack, 2200);
  }

  function softDrop(items) {
    // Reduced motion or no physics: a calm slide down and fade
    items.forEach((it, i) => {
      it.el.style.transition = `transform .6s ease ${i * 12}ms, opacity .6s ease ${i * 12}ms`;
      it.el.style.transform = `translateY(${Math.max(0, innerHeight - it.r.bottom - 6)}px) ${it.base}`;
      it.el.style.opacity = '.85';
    });
  }

  function physicsDrop(M, items) {
    const { Engine, Bodies, Body, Composite, Constraint, Mouse, MouseConstraint, Sleeping } = M;
    const vw = innerWidth; const vh = innerHeight;
    const engine = Engine.create({ enableSleeping: true });
    engine.gravity.y = 2.1;
    const T = 200;
    Composite.add(engine.world, [
      Bodies.rectangle(vw / 2, vh + T / 2, vw * 3, T, { isStatic: true, friction: 0.9 }),
      Bodies.rectangle(-T / 2, vh / 2, T, vh * 4, { isStatic: true }),
      Bodies.rectangle(vw + T / 2, vh / 2, T, vh * 4, { isStatic: true }),
    ]);
    // Order: header first, then top to bottom, with a little randomness so it feels like a cascade
    const order = items.map((it, i) => ({ it, i, k: (it.el.closest('.header') ? -1000 : it.r.top) + Math.random() * 60 })).sort((a, b) => a.k - b.k);
    for (const it of items) {
      const w = Math.max(8, it.r.width * 0.96 - 2); const h = Math.max(8, it.r.height * 0.92 - 2);
      const radius = Math.min(h / 2, parseFloat(getComputedStyle(it.el).borderTopLeftRadius) || 0, 24);
      it.body = Bodies.rectangle(it.cx, it.cy, w, h, { chamfer: radius > 1 ? { radius } : undefined, restitution: 0.18, friction: 0.65, frictionAir: 0.012, density: 0.0012, isStatic: true });
      Composite.add(engine.world, it.body);
    }
    let t0 = performance.now();
    order.forEach(({ it }, n) => {
      const delay = 30 + n * (n < 8 ? 60 : 30) + Math.random() * 35;
      setTimeout(() => {
        if (!fallen) return;
        Body.setStatic(it.body, false);
        Sleeping.set(it.body, false);
        const wide = it.r.width > 260 && it.r.width < innerWidth * 0.95;
        if (wide && Math.random() < 0.8) {
          // Hinge: hang from one top corner, swing, then let go
          const left = Math.random() < 0.5;
          const px = left ? -it.r.width / 2 + 6 : it.r.width / 2 - 6; const py = -it.r.height / 2 + 4;
          const hinge = Constraint.create({ pointA: { x: it.cx + px, y: it.cy + py }, bodyB: it.body, pointB: { x: px, y: py }, length: 0, stiffness: 0.9, damping: 0.02 });
          Composite.add(engine.world, hinge);
          Body.setAngularVelocity(it.body, (left ? 1 : -1) * 0.02);
          setTimeout(() => Composite.remove(engine.world, hinge), 300 + Math.random() * 420);
        } else {
          Body.setVelocity(it.body, { x: (Math.random() - 0.5) * 2.2, y: Math.random() * 0.8 });
          Body.setAngularVelocity(it.body, (Math.random() - 0.5) * 0.08);
        }
      }, delay);
    });

    // Drag pieces around once they have fallen
    const grab = document.createElement('div'); grab.className = 'qk-grab'; grab.setAttribute('aria-hidden', 'true');
    document.body.append(grab);
    const mouse = Mouse.create(grab); mouse.pixelRatio = 1;
    const mc = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.2, render: { visible: false } } });
    Composite.add(engine.world, mc);
    // Matter listens for wheel on the element; let the page ignore it while fallen
    grab.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

    let last = performance.now(); let acc = 0;
    const step = (now) => {
      if (!fallen) return;
      // Fixed 60 Hz steps, up to 4 per frame, so slow devices stay in real time instead of slow motion
      acc = Math.min(acc + (now - last), 1000 / 15); last = now;
      while (acc >= 1000 / 60) { Engine.update(engine, 1000 / 60); acc -= 1000 / 60; }
      for (const it of items) {
        const b = it.body;
        it.el.style.transform = `translate(${(b.position.x - it.cx).toFixed(2)}px, ${(b.position.y - it.cy).toFixed(2)}px) rotate(${b.angle.toFixed(4)}rad) ${it.base}`;
      }
      fallen.raf = requestAnimationFrame(step);
    };
    fallen.engine = engine; fallen.grab = grab;
    fallen.raf = requestAnimationFrame(step);
    void t0;
  }

  function showBack() {
    if (!fallen || fallen.back) return;
    const b = document.createElement('button');
    b.className = 'qk-back'; b.type = 'button';
    b.innerHTML = 'Put it back<small>or press Esc</small>';
    b.addEventListener('click', restore);
    document.body.append(b); fallen.back = b;
    requestAnimationFrame(() => b.classList.add('in'));
  }
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && fallen) restore(); });

  function restore() {
    if (!fallen || busy) return;
    busy = true;
    const f = fallen; fallen = null;
    cancelAnimationFrame(f.raf);
    if (f.grab) f.grab.remove();
    if (f.back) { f.back.classList.remove('in'); setTimeout(() => f.back.remove(), 400); }
    const n = f.items.length;
    f.items.forEach((it, i) => {
      const d = reduce ? 0 : (n - i) * 14;
      it.el.style.transition = `transform ${reduce ? 0.2 : 0.75}s cubic-bezier(.2,1.25,.35,1) ${d}ms, opacity .4s ease ${d}ms`;
      it.el.style.transform = it.base || 'none';
      it.el.style.opacity = '';
    });
    setTimeout(() => {
      for (const it of f.items) {
        Object.assign(it.el.style, { transform: it.inline.t, transition: it.inline.tr, willChange: it.inline.wc, zIndex: it.inline.z, position: it.inline.pos, pointerEvents: it.inline.pe });
      }
      for (const [a, s] of f.opened) { a.style.overflow = s.o; a.style.contain = s.c; }
      for (const [a, s] of f.lifted) { a.style.zIndex = s.z; a.style.position = s.p; }
      document.querySelector('.header')?.classList.remove('qk-bare');
      document.documentElement.style.overflow = f.lock.html; document.body.style.overflow = f.lock.body;
      busy = false;
    }, reduce ? 250 : 800 + n * 14);
  }
})();
