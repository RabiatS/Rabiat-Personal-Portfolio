// Invisible Me: find where I'm hiding by ear. Sonar blips speed up, rise and pan toward me.
const $ = (id) => document.getElementById(id);
const BEST = 'rabiat-find-me-best';

let ctx = null, out = null;
let spot = null;         // where I'm hiding, { x, y }
let pointer = null;      // { x, y }
let playing = false, startedAt = 0, clockTimer = 0, blipTimer = 0;
let rounds = 0;

// ---------- sound ----------
function audio() {
  if (ctx) return ctx.resume();
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  out = ctx.createGain(); out.gain.value = 0.9;
  out.connect(ctx.destination);
  return ctx.resume();
}
function blip(p, pan) {
  const t = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain(), s = ctx.createStereoPanner();
  o.type = 'sine';
  o.frequency.value = 220 * Math.pow(2, p * 2.2);           // 220 Hz far, ~1 kHz on top of it
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.12 + p * 0.4, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 0.09);
  s.pan.value = pan;
  o.connect(g).connect(s).connect(out);
  o.start(t); o.stop(t + 0.1);
}
// Found: a quick rising chime, then "You found me!". Gave up: two soft falling notes.
function chime(notes, type = 'triangle', gap = 0.09, len = 0.35, vol = 0.22) {
  const t0 = ctx.currentTime;
  notes.forEach((f, i) => {
    const t = t0 + i * gap, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    o.connect(g).connect(out); o.start(t); o.stop(t + len + 0.02);
  });
}

// The spoken line uses the device's own voice, picked for a friendly English one.
let voice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
  const liked = ['Samantha', 'Karen', 'Moira', 'Tessa', 'Google US English', 'Aria', 'Jenny'];
  voice = liked.map((n) => vs.find((v) => v.name.includes(n))).find(Boolean) || vs.find((v) => v.localService) || vs[0] || null;
}
const canSpeak = 'speechSynthesis' in window;
if (canSpeak) { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }
function say(text, delay = 0) {
  if (!canSpeak) return;
  setTimeout(() => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 1.05; u.pitch = 1.15; u.volume = 0.9;
    speechSynthesis.speak(u);
  }, delay);
}

// ---------- geometry ----------
const size = () => ({ w: innerWidth, h: innerHeight });
function proximity() {
  if (!pointer || !spot) return 0;
  const { w, h } = size();
  const d = Math.hypot(pointer.x - spot.x, pointer.y - spot.y);
  return Math.max(0, 1 - d / (Math.hypot(w, h) * 0.6));
}
const radius = () => Math.max(34, Math.min(innerWidth, innerHeight) * 0.05);

function hide() {
  const { w, h } = size();
  const m = 70;
  spot = { x: m + Math.random() * (w - m * 2), y: 110 + Math.random() * Math.max(10, h - 220) };
}

// the next blip is scheduled from the current distance, so the tempo tracks the pointer
function loop() {
  if (!playing) return;
  const p = proximity();
  if (pointer) blip(p, Math.max(-1, Math.min(1, (spot.x - pointer.x) / (innerWidth * 0.4))));
  blipTimer = setTimeout(loop, 900 - 830 * Math.pow(p, 1.6));
}

// ---------- glow (sound-free mode) ----------
const glow = $('glow'), gctx = glow.getContext('2d');
function drawGlow() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  if (glow.width !== innerWidth * dpr) { glow.width = innerWidth * dpr; glow.height = innerHeight * dpr; }
  gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  gctx.clearRect(0, 0, innerWidth, innerHeight);
  if (!pointer || !playing) return;
  const p = proximity(), r = 60 + p * 240;
  const hot = Math.pow(p, 2);
  const g = gctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, r);
  // cold is a faint teal, hot is brand red
  const c = hot > 0.35 ? '214,40,40' : '94,234,212';
  g.addColorStop(0, `rgba(${c},${0.08 + hot * 0.5})`);
  g.addColorStop(1, `rgba(${c},0)`);
  gctx.fillStyle = g; gctx.fillRect(0, 0, innerWidth, innerHeight);
}

// ---------- round ----------
const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
function tick() { $('clock').textContent = fmt(performance.now() - startedAt); }

async function start() {
  try { await audio(); } catch { setGlow(true); }
  $('start').hidden = true;
  $('dock').hidden = false;
  $('again').hidden = true; $('found').hidden = true;
  $('giveUp').hidden = false; $('glowBtn').hidden = false; $('clock').hidden = false; $('clockSep').hidden = false;
  $('meFound').classList.remove('show'); $('meHiding').classList.remove('show');
  hide();
  playing = true; rounds++;
  startedAt = performance.now();
  clearInterval(clockTimer); clockTimer = setInterval(tick, 250); tick();
  clearTimeout(blipTimer); loop();
}

function reveal(won) {
  playing = false;
  clearTimeout(blipTimer); clearInterval(clockTimer);
  const ms = performance.now() - startedAt;
  // found: the happy one. gave up: the one peeking over the laptop.
  const me = $(won ? 'meFound' : 'meHiding');
  me.style.left = spot.x + 'px'; me.style.top = spot.y + 'px';
  void me.offsetWidth; me.classList.add('show');
  const ring = document.createElement('span');
  ring.className = 'ring'; ring.style.left = spot.x + 'px'; ring.style.top = spot.y + 'px';
  document.body.appendChild(ring); setTimeout(() => ring.remove(), 1000);
  if (ctx) won ? chime([523, 659, 784, 1047]) : chime([392, 311], 'sine', 0.18, 0.5, 0.18);
  say(won ? 'You found me!' : 'I was right here.', won ? 380 : 420);
  drawGlow();
  let text = 'I was right here';
  if (won) {
    let best = Infinity; try { best = +localStorage.getItem(BEST) || Infinity; } catch {}
    if (ms < best) { try { localStorage.setItem(BEST, String(Math.round(ms))); } catch {} }
    text = ms < best && best !== Infinity ? `You found me · new best ${fmt(ms)}` : best === Infinity ? `You found me in ${fmt(ms)}` : `You found me in ${fmt(ms)} · best ${fmt(best)}`;
  }
  $('found').textContent = text; $('found').hidden = false;
  $('giveUp').hidden = true; $('glowBtn').hidden = true; $('clock').hidden = true; $('clockSep').hidden = true;
  $('again').hidden = false; $('again').focus();
}

function setGlow(on) {
  document.body.classList.toggle('glow', on);
  $('glowBtn').setAttribute('aria-pressed', String(on));
  drawGlow();
}

// ---------- input ----------
const field = $('field');
field.addEventListener('pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY }; drawGlow(); }, { passive: true });
field.addEventListener('pointerdown', (e) => {
  pointer = { x: e.clientX, y: e.clientY };
  if (!playing) return;
  if (Math.hypot(pointer.x - spot.x, pointer.y - spot.y) <= radius()) reveal(true);
  else if (ctx) blip(proximity(), 0); // a tap on touch screens is also a listen
  drawGlow();
});
$('go').addEventListener('click', start);
$('again').addEventListener('click', start);
$('giveUp').addEventListener('click', () => reveal(false));
$('glowBtn').addEventListener('click', () => setGlow(!document.body.classList.contains('glow')));
addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !playing && !/INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); start(); }
});
addEventListener('resize', () => { if (spot) { spot.x = Math.min(spot.x, innerWidth - 40); spot.y = Math.min(spot.y, innerHeight - 100); } drawGlow(); });
