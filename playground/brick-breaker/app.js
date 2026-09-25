// Break My Website: the live homepage (same-origin iframe) becomes the brick wall.
// Words are split into their own boxes; buttons, chips, pills and pictures stay whole.
const $ = (id) => document.getElementById(id);
const frame = $('site'), cv = $('game'), g = cv.getContext('2d');
const BEST = 'rabiat-bricks-best';
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

let W = 0, H = 0, FLOOR = 104, dpr = 1;
let bricks = [], total = 0;
let state = 'loading'; // loading | menu | ready | playing | paused | over | won
let score = 0, lives = 3, sound = true;
const paddle = { x: 0, w: 120, h: 12, y: 0, vx: 0 };
const ball = { x: 0, y: 0, vx: 0, vy: 0, s: 12, speed: 0, trail: [] };
const parts = [];
const flashes = [];
const keys = new Set();

// ---------- layout ----------
function resize() {
  dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  FLOOR = W < 600 ? 96 : 104;
  document.documentElement.style.setProperty('--floor', FLOOR + 'px');
  cv.width = W * dpr; cv.height = H * dpr;
  paddle.w = Math.max(84, Math.min(170, W * 0.13));
  paddle.y = H - FLOOR + 44;
  paddle.x = Math.min(Math.max(paddle.x || W / 2, paddle.w / 2), W - paddle.w / 2);
}
addEventListener('resize', () => {
  resize();
  // the site reflows at a new size, so the wall has to be measured again
  if (state === 'playing' || state === 'paused' || state === 'ready') remeasure();
});
resize();

// ---------- turning the page into bricks ----------
const BOXY = new Set(['A', 'BUTTON', 'IMG', 'SVG', 'svg', 'CANVAS', 'VIDEO', 'INPUT', 'SELECT', 'TEXTAREA', 'PICTURE']);
const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'BR', 'HEAD', 'META', 'LINK']);

function prepareSite() {
  const doc = frame.contentDocument;
  if (!doc || doc.getElementById('bb-style')) return;
  const st = doc.createElement('style');
  st.id = 'bb-style';
  st.textContent = `
    html, body { overflow: hidden !important; scroll-behavior: auto !important; }
    .bb-w { display: inline-block; }
    .bb-gone { transition: transform .8s cubic-bezier(.55,0,.85,.4), opacity .8s ease-in !important; opacity: 0 !important; }`;
  doc.head.appendChild(st);
  frame.contentWindow.scrollTo(0, 0);
}

function visible(el, win) {
  if (el.checkVisibility) return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  const cs = win.getComputedStyle(el);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05;
}
function isBoxy(el, cs) {
  if (BOXY.has(el.tagName)) return true;
  if (/chip|tag|pill|badge|btn|button/i.test(el.className?.baseVal ?? el.className ?? '')) return true;
  const bg = cs.backgroundColor.match(/[\d.]+/g);
  const hasBg = (bg && (bg.length < 4 || +bg[3] > 0.05)) || cs.backgroundImage !== 'none';
  return hasBg || parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderLeftWidth) > 0;
}

function collect() {
  const doc = frame.contentDocument, win = frame.contentWindow;
  const vw = win.innerWidth, vh = win.innerHeight, area = vw * vh;
  const out = [];
  const inView = (r) => r.width >= 6 && r.height >= 6 && r.bottom > 4 && r.top < vh - 4 && r.right > 4 && r.left < vw - 4;

  function splitText(node) {
    const text = node.nodeValue;
    if (!/\S/.test(text)) return;
    const frag = doc.createDocumentFragment();
    for (const part of text.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(part)); continue; }
      const s = doc.createElement('span'); s.className = 'bb-w'; s.textContent = part;
      frag.appendChild(s);
    }
    node.replaceWith(frag);
  }

  function walk(el) {
    for (const child of [...el.childNodes]) {
      if (child.nodeType === 3) { splitText(child); continue; }
      if (child.nodeType !== 1 || SKIP.has(child.tagName)) continue;
      if (child.classList.contains('bb-w')) continue;
      if (!visible(child, win)) continue;
      const r = child.getBoundingClientRect();
      const cs = win.getComputedStyle(child);
      if (cs.position === 'fixed' && r.width * r.height > area * 0.5) { walk(child); continue; }
      if (r.bottom < 0 || r.top > vh) continue;
      const small = r.width * r.height < area * 0.06 && r.width < vw * 0.6;
      if (small && isBoxy(child, cs) && inView(r)) { out.push(child); continue; }
      walk(child);
    }
  }
  walk(doc.body);
  for (const w of doc.querySelectorAll('.bb-w:not(.bb-gone)')) {
    const r = w.getBoundingClientRect();
    if (inView(r) && !out.some((b) => b.contains(w))) out.push(w);
  }
  // drop anything nested inside another brick
  return out.filter((el) => !out.some((o) => o !== el && o.contains(el)));
}

function measure(list) {
  return list.map((el) => {
    const r = el.getBoundingClientRect();
    return { el, x: r.left, y: r.top, w: r.width, h: r.height, alive: true };
  });
}
function remeasure() {
  for (const b of bricks) {
    if (!b.alive) continue;
    const r = b.el.getBoundingClientRect();
    Object.assign(b, { x: r.left, y: r.top, w: r.width, h: r.height });
  }
}

// ---------- sound: square-wave blips, like the real thing ----------
let actx = null;
function beep(freq, len = 0.05, type = 'square', vol = 0.06) {
  if (!sound || !actx) return;
  const t = actx.currentTime, o = actx.createOscillator(), gg = actx.createGain();
  o.type = type; o.frequency.value = freq;
  gg.gain.setValueAtTime(vol, t); gg.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(gg).connect(actx.destination); o.start(t); o.stop(t + len + 0.02);
}

// ---------- game ----------
function speedBase() { return Math.max(360, Math.min(520, H * 0.55)); }
function resetBall() {
  ball.speed = speedBase();
  ball.x = paddle.x; ball.y = paddle.y - ball.s;
  ball.vx = 0; ball.vy = 0; ball.trail.length = 0;
  state = 'ready';
}
function launch() {
  if (state !== 'ready') return;
  const a = (Math.random() * 0.8 - 0.4);
  ball.vx = Math.sin(a) * ball.speed; ball.vy = -Math.cos(a) * ball.speed;
  state = 'playing';
  beep(440, 0.06);
}

function start() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { sound = false; } }
  actx?.resume();
  prepareSite();
  bricks = measure(collect());
  total = bricks.length;
  score = 0; lives = 3;
  document.body.classList.remove('menu');
  $('menu').hidden = true; $('hud').hidden = false;
  resetBall(); hud();
  cv.focus?.();
}

function rebuild() {
  // a fresh copy of the site, then back to the menu
  state = 'loading';
  $('play').disabled = true; $('play').textContent = 'Loading';
  frame.contentWindow.location.reload();
}

function end(won) {
  state = won ? 'won' : 'over';
  let best = 0; try { best = +localStorage.getItem(BEST) || 0; } catch {}
  if (score > best) { best = score; try { localStorage.setItem(BEST, String(score)); } catch {} }
  document.body.classList.add('menu');
  $('hud').hidden = true;
  $('menu').hidden = false;
  $('menuTitle').textContent = won ? 'You broke it' : 'Game over';
  $('menuSub').textContent = won ? 'Every brick is gone. The real one is fine, I promise.' : `${bricks.filter((b) => b.alive).length} bricks were still standing.`;
  $('menuStat').textContent = `Score ${score} · best ${best}`;
  $('play').textContent = 'Rebuild it'; $('play').disabled = false; $('play').onclick = rebuild;
  $('real').hidden = false;
  won ? [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.12), i * 110)) : beep(110, 0.4, 'sawtooth', 0.05);
}

function hit(b) {
  b.alive = false;
  score += 10;
  ball.speed = Math.min(speedBase() * 1.9, ball.speed + 6);
  const el = b.el;
  if (!reduce) {
    const spin = (Math.random() * 60 - 30).toFixed(1);
    el.style.transform = `translateY(${Math.round(H * 0.9)}px) rotate(${spin}deg)`;
  }
  el.classList.add('bb-gone');
  flashes.push({ x: b.x, y: b.y, w: b.w, h: b.h, t: 1 });
  const n = Math.min(14, 4 + Math.round((b.w * b.h) / 400));
  for (let i = 0; i < n; i++) {
    parts.push({ x: b.x + Math.random() * b.w, y: b.y + Math.random() * b.h, vx: (Math.random() - 0.5) * 240, vy: (Math.random() - 0.8) * 220, t: 1, red: Math.random() < 0.3 });
  }
  beep(220 + Math.max(0, (H - b.y) / H) * 660, 0.045);
  hud();
  if (!bricks.some((x) => x.alive)) end(true);
}

function step(dt) {
  // paddle
  const kx = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
  if (kx) paddle.x += kx * Math.max(700, W * 0.9) * dt;
  paddle.x = Math.min(Math.max(paddle.x, paddle.w / 2), W - paddle.w / 2);

  if (state === 'ready') { ball.x = paddle.x; ball.y = paddle.y - ball.s; return; }
  if (state !== 'playing') return;

  // move in small substeps so a fast ball cannot skip through a thin word
  const dist = ball.speed * dt;
  const n = Math.max(1, Math.ceil(dist / (ball.s * 0.5)));
  const sdt = dt / n;
  for (let i = 0; i < n && state === 'playing'; i++) {
    ball.x += ball.vx * sdt; ball.y += ball.vy * sdt;
    const hs = ball.s / 2;
    if (ball.x - hs < 0) { ball.x = hs; ball.vx = Math.abs(ball.vx); beep(330, 0.03); }
    if (ball.x + hs > W) { ball.x = W - hs; ball.vx = -Math.abs(ball.vx); beep(330, 0.03); }
    if (ball.y - hs < 0) { ball.y = hs; ball.vy = Math.abs(ball.vy); beep(330, 0.03); }

    // paddle: angle from where it lands, up to 60 degrees off vertical
    if (ball.vy > 0 && ball.y + hs >= paddle.y && ball.y + hs <= paddle.y + paddle.h + 10 &&
        ball.x > paddle.x - paddle.w / 2 - hs && ball.x < paddle.x + paddle.w / 2 + hs) {
      const off = Math.max(-1, Math.min(1, (ball.x - paddle.x) / (paddle.w / 2)));
      const a = off * (Math.PI / 3);
      ball.vx = Math.sin(a) * ball.speed; ball.vy = -Math.cos(a) * ball.speed;
      ball.y = paddle.y - hs;
      beep(523, 0.04);
    }

    // bricks: one per substep, bounce off the shallower side
    for (const b of bricks) {
      if (!b.alive) continue;
      if (ball.x + hs < b.x || ball.x - hs > b.x + b.w || ball.y + hs < b.y || ball.y - hs > b.y + b.h) continue;
      const ox = Math.min(ball.x + hs - b.x, b.x + b.w - (ball.x - hs));
      const oy = Math.min(ball.y + hs - b.y, b.y + b.h - (ball.y - hs));
      if (ox < oy) ball.vx = ball.x < b.x + b.w / 2 ? -Math.abs(ball.vx) : Math.abs(ball.vx);
      else ball.vy = ball.y < b.y + b.h / 2 ? -Math.abs(ball.vy) : Math.abs(ball.vy);
      // keep the speed in step with the rising pace
      const k = ball.speed / Math.hypot(ball.vx, ball.vy); ball.vx *= k; ball.vy *= k;
      hit(b);
      break;
    }
    // never let it settle into a flat, endless horizontal line
    if (Math.abs(ball.vy) < ball.speed * 0.2) { ball.vy = Math.sign(ball.vy || -1) * ball.speed * 0.2; const k = ball.speed / Math.hypot(ball.vx, ball.vy); ball.vx *= k; ball.vy *= k; }

    if (ball.y - hs > H) {
      lives--; hud();
      beep(140, 0.25, 'sawtooth', 0.05);
      if (lives <= 0) { end(false); return; }
      resetBall();
      return;
    }
  }
  ball.trail.unshift({ x: ball.x, y: ball.y });
  if (ball.trail.length > 8) ball.trail.pop();
}

function draw(dt) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  if (state === 'loading' || state === 'menu') return;

  // flashes where bricks were
  for (const f of flashes) {
    g.fillStyle = `rgba(245,245,240,${f.t * 0.55})`;
    g.fillRect(f.x - 2, f.y - 2, f.w + 4, f.h + 4);
    f.t -= dt * 4;
  }
  for (let i = flashes.length - 1; i >= 0; i--) if (flashes[i].t <= 0) flashes.splice(i, 1);

  // particles
  for (const p of parts) {
    p.vy += 600 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt * 1.4;
    g.fillStyle = p.red ? `rgba(214,40,40,${Math.max(0, p.t)})` : `rgba(245,245,240,${Math.max(0, p.t)})`;
    g.fillRect(p.x, p.y, 4, 4);
  }
  for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t <= 0) parts.splice(i, 1);

  // paddle
  g.fillStyle = '#D62828';
  g.fillRect(paddle.x - paddle.w / 2, paddle.y, paddle.w, paddle.h);
  g.fillStyle = 'rgba(255,255,255,.18)';
  g.fillRect(paddle.x - paddle.w / 2, paddle.y, paddle.w, 3);

  // ball: a square, the way the original drew it
  ball.trail.forEach((t, i) => {
    g.fillStyle = `rgba(245,245,240,${0.18 - i * 0.02})`;
    g.fillRect(t.x - ball.s / 2, t.y - ball.s / 2, ball.s, ball.s);
  });
  g.fillStyle = '#F5F5F0';
  g.shadowColor = 'rgba(245,245,240,.8)'; g.shadowBlur = 12;
  g.fillRect(ball.x - ball.s / 2, ball.y - ball.s / 2, ball.s, ball.s);
  g.shadowBlur = 0;

  if (state === 'ready') {
    g.fillStyle = 'rgba(160,160,154,.9)';
    g.font = '500 12px "DM Mono", monospace'; g.textAlign = 'center';
    g.fillText(matchMedia('(hover: none)').matches ? 'TAP TO LAUNCH' : 'SPACE OR CLICK TO LAUNCH', W / 2, paddle.y - 34);
  }
  if (state === 'paused') {
    g.fillStyle = 'rgba(10,10,10,.5)'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#F5F5F0'; g.font = '700 42px Rajdhani, sans-serif'; g.textAlign = 'center';
    g.fillText('PAUSED', W / 2, H / 2);
  }
}

function hud() {
  $('score').textContent = score;
  $('left').textContent = bricks.filter((b) => b.alive).length;
  $('lives').innerHTML = [0, 1, 2].map((i) => `<i class="${i < lives ? '' : 'lost'}"></i>`).join('');
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
  if (state !== 'paused') step(dt);
  draw(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- input ----------
cv.addEventListener('pointermove', (e) => { if (state !== 'paused') paddle.x = e.clientX; }, { passive: true });
cv.addEventListener('pointerdown', (e) => { paddle.x = e.clientX; if (state === 'ready') launch(); });
addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  if ((e.key === ' ' || e.key === 'Enter') && ['menu', 'over', 'won'].includes(state) && !$('play').disabled) { e.preventDefault(); $('play').click(); return; }
  if (e.key === ' ' && state === 'ready') launch();
  if ((e.key === 'p' || e.key === 'P') && (state === 'playing' || state === 'paused')) togglePause();
  if (e.key === 'Escape' && (state === 'playing' || state === 'paused' || state === 'ready')) rebuild();
});
addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
function togglePause() {
  state = state === 'paused' ? 'playing' : 'paused';
  $('pauseBtn').textContent = state === 'paused' ? 'Resume' : 'Pause';
}
$('pauseBtn').addEventListener('click', togglePause);
$('soundBtn').addEventListener('click', () => {
  sound = !sound;
  $('soundBtn').textContent = sound ? 'Sound on' : 'Sound off';
  $('soundBtn').setAttribute('aria-pressed', String(sound));
});
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') togglePause(); });

// ---------- boot ----------
frame.addEventListener('load', () => {
  // give the homepage a moment for its entrance animations to settle
  setTimeout(() => {
    prepareSite();
    state = 'menu';
    document.body.classList.add('menu');
    $('menu').hidden = false; $('hud').hidden = true;
    $('menuTitle').textContent = 'Break my website';
    $('menuSub').innerHTML = 'Every word is a brick. <span class="keys"><kbd>←</kbd><kbd>→</kbd> and <kbd>Space</kbd></span>';
    $('menuStat').textContent = '';
    $('real').hidden = true;
    $('play').textContent = 'Play'; $('play').disabled = false; $('play').onclick = start;
    $('play').focus();
  }, 900);
});
