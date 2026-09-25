// Noise: every sound is synthesised with the Web Audio API. No recordings, no audible loops.
const $ = (id) => document.getElementById(id);
const STORE = 'rabiat-noise-v1';

const SOUNDS = [
  { id: 'white', name: 'White', desc: 'bright, even hiss', glyph: 'W' },
  { id: 'pink', name: 'Pink', desc: 'soft, balanced', glyph: 'P' },
  { id: 'brown', name: 'Brown', desc: 'deep rumble', glyph: 'B' },
  { id: 'rain', name: 'Rain', desc: 'steady with drops', glyph: '☂' },
  { id: 'wind', name: 'Wind', desc: 'slow gusts', glyph: '≋' },
  { id: 'waves', name: 'Waves', desc: 'rolling swells', glyph: '∿' },
  { id: 'fan', name: 'Fan', desc: 'low whir', glyph: '✱' },
  { id: 'fire', name: 'Fire', desc: 'crackle and roar', glyph: '▲' },
];
const PRESETS = {
  Focus: { brown: 0.6, rain: 0.25 },
  Sleep: { pink: 0.35, waves: 0.5, fan: 0.2 },
  Rain: { rain: 0.8, wind: 0.18 },
  Deep: { brown: 0.85 },
  Campfire: { fire: 0.75, wind: 0.22 },
};
const TIMERS = [0, 15, 30, 60, 90];

// ---------- state ----------
const saved = (() => { try { return JSON.parse(localStorage.getItem(STORE)) || null; } catch { return null; } })();
const state = {
  levels: Object.fromEntries(SOUNDS.map((s) => [s.id, 0.5])),
  on: Object.fromEntries(SOUNDS.map((s) => [s.id, false])),
  master: 0.7,
  playing: false,
  timerMin: 0,
  timerEnd: 0,
};
if (saved) Object.assign(state.levels, saved.levels || {}), Object.assign(state.on, saved.on || {}), (state.master = saved.master ?? 0.7);
else applyPreset('Focus', false);
const persist = () => { try { localStorage.setItem(STORE, JSON.stringify({ levels: state.levels, on: state.on, master: state.master })); } catch { /* private mode */ } };

// ---------- audio ----------
let ctx = null, master = null, analyser = null;
const voices = {}; // id -> GainNode

// A looping buffer whose tail crossfades into its head (equal power), so the loop point is inaudible.
function loopBuffer(seconds, fill) {
  const sr = ctx.sampleRate, n = Math.floor(seconds * sr), f = Math.floor(0.5 * sr);
  const buf = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(n + f);
    fill(raw);
    const out = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) out[i] = raw[i];
    for (let i = 0; i < f; i++) {
      const t = i / f;
      out[i] = raw[i] * Math.sin(t * Math.PI / 2) + raw[n + i] * Math.cos(t * Math.PI / 2);
    }
  }
  return buf;
}
const whiteFill = (a) => { for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; };
const pinkFill = (a) => { // Paul Kellet's refined filter
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < a.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    a[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
};
const brownFill = (a) => { let last = 0; for (let i = 0; i < a.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; a[i] = last * 3.5; } };
// sparse short bursts: raindrops, or fire crackles
const burstFill = (perSecond, minMs, maxMs, sharp) => (a) => {
  const sr = ctx.sampleRate;
  a.fill(0);
  const count = Math.floor((a.length / sr) * perSecond);
  for (let k = 0; k < count; k++) {
    const at = Math.floor(Math.random() * a.length);
    const len = Math.floor(sr * (minMs + Math.random() * (maxMs - minMs)) / 1000);
    const amp = Math.pow(Math.random(), sharp) * 0.9;
    for (let j = 0; j < len && at + j < a.length; j++) a[at + j] += (Math.random() * 2 - 1) * amp * Math.exp(-6 * j / len);
  }
};

function src(buf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }
function lfo(freq, depth, target, offset = 0) {
  const o = ctx.createOscillator(); o.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = depth;
  o.connect(g).connect(target); o.start();
  if (offset) target.value = offset;
}
function filt(type, freq, q = 0.7) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; }
function gain(v) { const g = ctx.createGain(); g.gain.value = v; return g; }

function buildGraph() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const white = loopBuffer(9, whiteFill), pink = loopBuffer(11, pinkFill), brown = loopBuffer(13, brownFill);
  const drops = loopBuffer(7, burstFill(45, 2, 7, 3));
  const crackle = loopBuffer(9, burstFill(7, 1, 5, 5));

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12; limiter.knee.value = 6; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.3;
  // soft clip whatever slips past the compressor, so a loud mix never distorts harshly
  const clip = ctx.createWaveShaper();
  clip.curve = Float32Array.from({ length: 2049 }, (_, i) => {
    const x = i / 1024 - 1, a = Math.abs(x);
    return a < 0.6 ? x : Math.sign(x) * (0.6 + 0.35 * Math.tanh((a - 0.6) / 0.35));
  });
  master = gain(0);
  analyser = ctx.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.85;
  master.connect(gain(1.9)).connect(limiter).connect(clip).connect(analyser).connect(ctx.destination);

  const voice = (id, base) => { const g = gain(0); g.connect(master); voices[id] = { g, base }; return g; };

  src(white).connect(gain(0.35)).connect(voice('white', 1));
  src(pink).connect(voice('pink', 1));
  src(brown).connect(voice('brown', 1));

  { // rain: steady pink hiss shaped toward 3 kHz, plus drops
    const out = voice('rain', 2.2);
    src(pink).connect(filt('highpass', 500)).connect(filt('peaking', 3200, 0.8)).connect(gain(0.55)).connect(out);
    src(drops).connect(filt('highpass', 1800)).connect(gain(0.9)).connect(out);
  }
  { // wind: band-passed noise with a wandering centre and swelling level
    const bp = filt('bandpass', 520, 0.9), g = gain(0.6);
    lfo(0.07, 260, bp.frequency, 520); lfo(0.19, 90, bp.frequency);
    lfo(0.11, 0.35, g.gain, 0.6);
    src(pink).connect(bp).connect(g).connect(gain(1.6)).connect(voice('wind', 1.8));
  }
  { // waves: brown noise that swells and opens up every ~10 s
    const lp = filt('lowpass', 800, 0.6), g = gain(0.55);
    lfo(0.095, 450, lp.frequency, 800); lfo(0.095, 0.45, g.gain, 0.55);
    src(brown).connect(lp).connect(g).connect(gain(1.4)).connect(voice('waves', 1));
  }
  { // fan: low steady air with a faint blade whir
    const out = voice('fan', 1.2), g = gain(0.8);
    lfo(7.5, 0.06, g.gain, 0.8);
    src(brown).connect(filt('lowpass', 320)).connect(g).connect(out);
    src(pink).connect(filt('bandpass', 900, 1.2)).connect(gain(0.18)).connect(out);
  }
  { // fire: low roar plus crackles
    const out = voice('fire', 1.8);
    src(brown).connect(filt('lowpass', 260)).connect(gain(0.6)).connect(out);
    src(crackle).connect(filt('bandpass', 2600, 0.8)).connect(gain(2.2)).connect(out);
  }
  applyLevels(true);
}

function applyLevels(instant) {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const s of SOUNDS) {
    const v = voices[s.id]; if (!v) continue;
    const target = state.on[s.id] ? Math.pow(state.levels[s.id], 2) * v.base : 0;
    v.g.gain.cancelScheduledValues(t);
    instant ? v.g.gain.setValueAtTime(target, t) : v.g.gain.setTargetAtTime(target, t, 0.25);
  }
}

async function play() {
  if (!ctx) buildGraph();
  await ctx.resume();
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(state.master, t + 1.5);
  state.playing = true;
  if (state.timerMin) state.timerEnd = Date.now() + state.timerMin * 60000;
  ui();
}
async function pause(fadeSeconds = 0.4) {
  if (!ctx) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(0, t + fadeSeconds);
  state.playing = false;
  state.timerEnd = 0;
  ui();
  setTimeout(() => { if (!state.playing) ctx.suspend(); }, fadeSeconds * 1000 + 50);
}
const toggle = () => (state.playing ? pause() : play());

// ---------- UI ----------
function applyPreset(name, andPlay = true) {
  for (const s of SOUNDS) state.on[s.id] = false;
  for (const [id, v] of Object.entries(PRESETS[name])) { state.on[id] = true; state.levels[id] = v; }
  if (andPlay) { applyLevels(); persist(); renderSounds(); if (!state.playing) play(); }
}

function renderSounds() {
  const wrap = $('sounds');
  if (!wrap.children.length) {
    for (const s of SOUNDS) {
      const el = document.createElement('div');
      el.className = 'sound'; el.dataset.id = s.id;
      el.innerHTML = `
        <button class="head" aria-pressed="false"><span class="glyph">${s.glyph}</span><span><div class="nm">${s.name}</div><div class="ds">${s.desc}</div></span></button>
        <input type="range" min="0" max="100" aria-label="${s.name} level">
        <span class="level"></span>`;
      el.querySelector('.head').addEventListener('click', () => {
        state.on[s.id] = !state.on[s.id];
        if (state.on[s.id] && state.levels[s.id] < 0.05) state.levels[s.id] = 0.5;
        applyLevels(); persist(); renderSounds();
        if (state.on[s.id] && !state.playing) play();
      });
      el.querySelector('input').addEventListener('input', (e) => {
        state.levels[s.id] = +e.target.value / 100;
        state.on[s.id] = state.levels[s.id] > 0.01;
        applyLevels(); persist(); renderSounds();
        if (state.on[s.id] && !state.playing) play();
      });
      wrap.appendChild(el);
    }
  }
  for (const el of wrap.children) {
    const id = el.dataset.id, on = state.on[id];
    el.classList.toggle('on', on);
    el.querySelector('.head').setAttribute('aria-pressed', String(on));
    const r = el.querySelector('input'); if (document.activeElement !== r) r.value = Math.round(state.levels[id] * 100);
    el.querySelector('.level').style.width = on ? `${state.levels[id] * 100}%` : '0';
  }
}

function ui() {
  // SVG elements have no .hidden property, so set the attribute itself
  $('icoPlay').toggleAttribute('hidden', state.playing);
  $('icoPause').toggleAttribute('hidden', !state.playing);
  $('play').setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
  const active = SOUNDS.filter((s) => state.on[s.id]).map((s) => s.name.toLowerCase());
  let line = state.playing ? (active.length ? active.join(' + ') : 'nothing selected, tap a sound') : (active.length ? active.join(' + ') : 'tap a sound to begin');
  if (state.playing && state.timerEnd) {
    const left = Math.max(0, state.timerEnd - Date.now());
    line += ` · stops in ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
  }
  $('statusLine').textContent = line;
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = state.playing ? 'playing' : 'paused';
}

// presets
for (const name of Object.keys(PRESETS)) {
  const b = document.createElement('button');
  b.className = 'btn'; b.textContent = name;
  b.addEventListener('click', () => applyPreset(name));
  $('presets').appendChild(b);
}
// timer
for (const m of TIMERS) {
  const b = document.createElement('button');
  b.className = 'btn quiet'; b.textContent = m ? `${m}m` : 'Off'; b.dataset.m = m;
  b.addEventListener('click', () => {
    state.timerMin = m;
    state.timerEnd = m && state.playing ? Date.now() + m * 60000 : 0;
    document.querySelectorAll('#timer .btn').forEach((x) => x.classList.toggle('is-selected', +x.dataset.m === m));
    ui();
  });
  if (!m) b.classList.add('is-selected');
  $('timer').appendChild(b);
}
setInterval(() => {
  if (state.playing && state.timerEnd && Date.now() >= state.timerEnd) pause(10); // gentle ten second fade
  else if (state.playing && state.timerEnd) ui();
}, 1000);

$('master').value = Math.round(state.master * 100);
$('master').addEventListener('input', (e) => {
  state.master = +e.target.value / 100; persist();
  if (ctx && state.playing) master.gain.setTargetAtTime(state.master, ctx.currentTime, 0.1);
});
$('play').addEventListener('click', toggle);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !/BUTTON|INPUT|TEXTAREA/.test(e.target.tagName)) { e.preventDefault(); toggle(); }
});
if ('mediaSession' in navigator) {
  navigator.mediaSession.metadata = new MediaMetadata({ title: 'Noise', artist: "Rabiat's tools" });
  navigator.mediaSession.setActionHandler('play', play);
  navigator.mediaSession.setActionHandler('pause', () => pause());
}

// ---------- visual: a calm ring that breathes with the sound ----------
const cv = $('orb'), g2 = cv.getContext('2d');
const bins = new Uint8Array(256);
let smooth = new Float32Array(96), idle = 0;
function draw() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
  g2.setTransform(dpr, 0, 0, dpr, 0, 0);
  g2.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, R = Math.max(66, Math.min(w, h) * 0.2); // never tucked under the 112px button
  let energy = 0;
  if (analyser && state.playing) {
    analyser.getByteFrequencyData(bins);
    for (let i = 0; i < smooth.length; i++) {
      const v = bins[Math.floor(2 + i * 1.6)] / 255;
      smooth[i] += (v - smooth[i]) * 0.12;
      energy += smooth[i];
    }
    energy /= smooth.length;
  } else {
    for (let i = 0; i < smooth.length; i++) smooth[i] *= 0.94;
  }
  idle += 0.01;
  // soft glow
  const glow = g2.createRadialGradient(cx, cy, R * 0.6, cx, cy, Math.min(w, h) * 0.5); // stays inside the canvas
  glow.addColorStop(0, `rgba(214,40,40,${0.10 + energy * 0.35})`);
  glow.addColorStop(1, 'rgba(214,40,40,0)');
  g2.fillStyle = glow; g2.fillRect(0, 0, w, h);
  // rings
  for (let ring = 0; ring < 3; ring++) {
    g2.beginPath();
    const n = smooth.length;
    for (let i = 0; i <= n; i++) {
      const j = i % n, k = j < n / 2 ? j : n - 1 - j, a = (i / n) * Math.PI * 2 - Math.PI / 2; // mirrored, so the ring stays symmetric
      const wobble = Math.sin(a * 3 + idle * (1 + ring * 0.4)) * 2.5;
      const r = R * (1.05 + ring * 0.28) + energy * R * (0.7 - ring * 0.15) + (smooth[k] - energy) * R * 0.3 + wobble;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? g2.lineTo(x, y) : g2.moveTo(x, y);
    }
    g2.closePath();
    g2.strokeStyle = `rgba(245,245,240,${0.34 - ring * 0.1})`;
    g2.lineWidth = 1.4;
    g2.stroke();
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

renderSounds();
ui();
