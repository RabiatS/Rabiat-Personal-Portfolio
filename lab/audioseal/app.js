// AudioSeal: pick a 16-bit ID, stamp it into a voice clip, listen to both,
// then attack the stamped copy and watch what the detector still finds. The
// models run in the Lab worker (adapter.js); this file holds the clip, the
// attacks, playback and the drawing.
import { mountLab, veil } from '../frame/frame.js';
import { sample, sampleUrl } from '../samples/samples.js';
const SAMPLE = sample('apollo11-small-step.m4a'); // Armstrong on the Moon

const $ = (id) => document.getElementById(id);
const SR = 16000, HEAT = 160, MAX_REC = 10;

const lab = await mountLab({
  slug: 'audioseal',
  adapter: new URL('./adapter.js', import.meta.url).href,
  gate: $('gate'), stats: $('labStats'), verb: 'stamp a clip',
});

// ---------- the ID ----------
const msg = Array.from({ length: 16 }, () => (Math.random() < 0.5 ? 1 : 0));
const idDots = [], backDots = [];
function buildDots(el, list, buttons) {
  for (let byte = 0; byte < 2; byte++) {
    const g = document.createElement('span');
    g.className = 'byte';
    for (let i = 0; i < 8; i++) {
      const k = byte * 8 + i;
      const d = document.createElement(buttons ? 'button' : 'span');
      d.className = 'dot';
      if (buttons) {
        d.type = 'button';
        d.setAttribute('aria-label', `Bit ${k + 1}`);
        d.addEventListener('click', () => { msg[k] ^= 1; showId(); restampSoon(); });
      }
      g.append(d);
      list.push(d);
    }
    el.append(g);
  }
}
buildDots($('msg'), idDots, true);
buildDots($('back'), backDots, false);
function showId() {
  idDots.forEach((d, k) => { d.classList.toggle('on', !!msg[k]); d.setAttribute('aria-pressed', String(!!msg[k])); });
  $('hex').textContent = `0x${parseInt(msg.join(''), 2).toString(16).toUpperCase().padStart(4, '0')}`;
}
showId();
$('shuffle').addEventListener('click', () => { for (let k = 0; k < 16; k++) msg[k] = Math.random() < 0.5 ? 1 : 0; showId(); restampSoon(); });

// ---------- state ----------
let clip = null;        // { audio, name }
let mark = null;        // the watermark alone
let clean = null;       // clip + mark
let current = null;     // clean, after the attacks
let attacks = [];
let det = { orig: null, marked: null };
let viewing = 'marked'; // 'orig' | 'marked' | 'mark'
let times = { stamp: null, detect: null };

const rms = (x) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, x.length)); };
const secs = (n) => { const s = Math.round(n / SR); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// ---------- audio ----------
let ctx = null;
function unlock() { ctx ??= new AudioContext(); ctx.resume(); }
async function decode16k(arrayBuffer) {
  const ab = await new OfflineAudioContext(1, 1, SR).decodeAudioData(arrayBuffer);
  return ab.getChannelData(0).slice();
}

// ---------- stamping and checking ----------
// One model call at a time: the worker's sessions don't take overlapping runs.
let chain = Promise.resolve();
function run(input, transfer) {
  const p = chain.then(() => lab.run(input, transfer));
  chain = p.catch(() => {});
  return p;
}
let job = 0;
async function useClip(audio, name) {
  clip = { audio, name };
  det.orig = null;
  await lab.ensure();
  await stamp();
}

async function stamp() {
  if (!clip) return;
  const j = ++job;
  busy(true);
  const copy = clip.audio.slice();
  let res;
  try { res = await run({ op: 'stamp', audio: copy, bits: msg.slice() }, [copy.buffer]); }
  catch (err) { fail(err); return; }
  if (j !== job) return;
  times.stamp = res.ms;
  mark = res.output.mark;
  clean = new Float32Array(clip.audio.length);
  for (let i = 0; i < clean.length; i++) clean[i] = clip.audio[i] + mark[i];
  current = clean.slice();
  attacks = [];
  showStage();
  await check(j);
  if (j === job && !det.orig) {
    const o = clip.audio.slice();
    try { det.orig = (await run({ op: 'detect', audio: o }, [o.buffer])).output; } catch { /* only the A/B view needs it */ }
    if (j === job && viewing === 'orig') { setBars(); reveal(); showReadout(); }
  }
}

let restampTimer = 0;
function restampSoon() {
  if (!clip) return;
  clearTimeout(restampTimer);
  restampTimer = setTimeout(stamp, 350);
}

let pending = false;
function busy(on) {
  pending = on;
  document.querySelectorAll('[data-attack]').forEach((b) => { b.disabled = on; });
}
async function check(j = job) {
  busy(true);
  const copy = current.slice();
  let res;
  try { res = await run({ op: 'detect', audio: copy }, [copy.buffer]); }
  catch (err) { fail(err); return; }
  if (j !== job) return;
  times.detect = res.ms;
  det.marked = res.output;
  busy(false);
  if (viewing !== 'orig') { setBars(); reveal(); }
  showReadout();
}

function fail(err) {
  busy(false);
  veil('That did not work', null, err?.message || String(err), { label: 'Close', onClick: () => veil(null) });
}

// ---------- attacks on the stamped copy ----------
function gauss() { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const ATTACKS = {
  noise: { label: 'noise', run(x) { const s = rms(clean) * Math.pow(10, -26 / 20); for (let i = 0; i < x.length; i++) x[i] += s * gauss(); return x; } },
  quiet: { label: 'quieter', run(x) { for (let i = 0; i < x.length; i++) x[i] *= 0.5; return x; } },
  cut: {
    label: 'cut',
    ok: (x) => x.length >= 3 * SR,
    run(x) {
      const n = SR, at = Math.floor(x.length * 0.15 + Math.random() * (x.length * 0.7 - n));
      const y = new Float32Array(x.length - n);
      y.set(x.subarray(0, at)); y.set(x.subarray(at + n), at);
      for (let i = 0; i < 80; i++) { const g = i / 80; y[at + i] = y[at + i] * g + x[at - 80 + i] * (1 - g); } // no click at the join
      return y;
    },
  },
  patch: {
    label: 'swap',
    ok: (x) => x.length >= 2 * SR,
    run(x) {
      const n = Math.round(1.5 * SR), at = Math.floor(x.length * 0.1 + Math.random() * (x.length * 0.8 - n));
      const k = clip.audio.length / x.length, g = gainNow(), F = 160; // where this moment was in the original, at today's volume
      for (let i = 0; i < n; i++) {
        const o = clip.audio[Math.min(clip.audio.length - 1, Math.round((at + i) * k))] * g;
        const w = Math.min(1, i / F, (n - 1 - i) / F); // crossfade in and out, so there is no click
        x[at + i] = x[at + i] * (1 - w) + o * w;
      }
      return x;
    },
  },
  fast: {
    label: '5% faster',
    run(x) {
      const r = 1.05, n = Math.floor(x.length / r), y = new Float32Array(n);
      for (let i = 0; i < n; i++) { const p = i * r, j = Math.floor(p), f = p - j; y[i] = x[j] * (1 - f) + (x[j + 1] ?? 0) * f; }
      return y;
    },
  },
};
// The volume the stamped copy has now, so a swapped-in piece matches it.
function gainNow() { return Math.pow(0.5, attacks.filter((a) => a === 'quiet').length); }

async function attack(kind) {
  if (!current || pending) return;
  const a = ATTACKS[kind];
  if (a.ok && !a.ok(current)) { window.rkToast?.('The clip is too short for that now'); return; }
  stopPlay();
  if (viewing !== 'marked') setView('marked'); // show what the attack did
  current = a.run(current.slice());
  attacks.push(kind);
  $('undo').disabled = false;
  $('log').textContent = attacks.map((k) => ATTACKS[k].label).join(' + ');
  $('clipLen').textContent = secs(current.length);
  setBars();
  await check();
}
document.querySelectorAll('[data-attack]').forEach((b) => b.addEventListener('click', () => attack(b.dataset.attack)));
$('undo').addEventListener('click', async () => {
  if (!clean || pending) return;
  stopPlay();
  current = clean.slice();
  attacks = [];
  $('undo').disabled = true;
  $('log').textContent = '';
  $('clipLen').textContent = secs(current.length);
  setBars();
  await check();
});

// ---------- what is on screen ----------
function showStage() {
  document.body.classList.add('stamped');
  $('stage').hidden = false;
  document.querySelectorAll('.row-back').forEach((e) => { e.hidden = false; });
  $('clipName').textContent = clip.name;
  $('clipLen').textContent = secs(current.length);
  $('undo').disabled = true;
  $('log').textContent = '';
  $('stampSample').textContent = clip.name.startsWith('Sample') ? 'Stamp again' : 'Use the sample';
  $('stampSample').classList.remove('primary');
  $('stampSample').classList.remove('lg'); $('record').classList.remove('lg'); document.querySelector('label[for=file]')?.classList.remove('lg');
  sizeWave();
  setBars();
}

function showReadout() {
  const d = viewing === 'orig' ? det.orig : det.marked;
  if (!d) return;
  let match = 0;
  d.bits.forEach((p, k) => {
    const bit = p > 0.5 ? 1 : 0, ok = bit === msg[k];
    if (ok) match++;
    const dot = backDots[k];
    dot.classList.toggle('on', !!bit);
    dot.classList.toggle('miss', !ok);
    dot.style.opacity = String(0.35 + 0.65 * Math.min(1, Math.abs(2 * p - 1) * 2)); // fainter when unsure
  });
  $('acc').textContent = `${match}/16`;
  $('bitsBig').textContent = `${match}/16`;
  $('found').textContent = `${Math.round(d.found * 100)}%`;
  $('say').textContent = d.found >= 0.5 ? 'Marked' : d.found >= 0.1 ? 'Faint' : 'No mark';
  const where = lab.variant?.tier === 'gpu' ? 'GPU' : 'CPU';
  $('ms').textContent = times.stamp != null ? `stamped in ${(times.stamp / 1000).toFixed(2)} s · checked in ${(times.detect / 1000).toFixed(2)} s · ${where}` : '';
}

// ---------- listening: original, stamped, or the mark alone ----------
function audioFor(v) {
  if (v === 'orig') return clip.audio;
  if (v === 'mark') {
    let p = 0; for (let i = 0; i < mark.length; i++) p = Math.max(p, Math.abs(mark[i]));
    const k = p ? 0.5 / p : 1, y = new Float32Array(mark.length);
    for (let i = 0; i < y.length; i++) y[i] = mark[i] * k;
    return y;
  }
  return current;
}
let src = null, startedAt = 0, offset = 0;
function play(from = 0) {
  unlock();
  stopPlay();
  const x = audioFor(viewing);
  const buf = ctx.createBuffer(1, x.length, SR);
  const y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) y[i] = Math.max(-1, Math.min(1, x[i]));
  buf.copyToChannel(y, 0);
  src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  offset = Math.min(from, buf.duration - 0.01);
  startedAt = ctx.currentTime;
  src.start(0, Math.max(0, offset));
  const me = src;
  src.onended = () => { if (src === me) { src = null; $('play').textContent = 'Play'; } };
  $('play').textContent = 'Pause';
}
function stopPlay() {
  if (!src) return;
  const s = src; src = null;
  try { s.stop(); } catch {}
  $('play').textContent = 'Play';
}
const playSecs = () => (src ? offset + (ctx.currentTime - startedAt) : null);
$('play').addEventListener('click', () => (src ? stopPlay() : play()));

function setView(v) {
  const at = playSecs();
  viewing = v;
  document.querySelectorAll('.ab .btn').forEach((b) => {
    const on = b.dataset.v === v;
    b.classList.toggle('is-selected', on);
    b.setAttribute('aria-pressed', String(on));
  });
  setBars();
  showReadout();
  if (at != null) play(at); // keep listening from the same moment
}
document.querySelectorAll('.ab .btn').forEach((b) => b.addEventListener('click', () => { if (clip) setView(b.dataset.v); }));

// ---------- the waveform and its heat ----------
const wave = $('wave');
let W = 0, H = 0, dpr = 1;
let bars = null; // { amp: Float32Array, heat: Float32Array, n, len }
let shown = null, revealAt = 0;
function sizeWave() {
  dpr = Math.min(2, devicePixelRatio || 1);
  W = wave.clientWidth; H = wave.clientHeight;
  wave.width = Math.round(W * dpr); wave.height = Math.round(H * dpr);
}
addEventListener('resize', () => { if (clip) { sizeWave(); setBars(); } });

const STEP = 3;
function setBars() {
  if (!clip || !W) return;
  const x = audioFor(viewing);
  const d = viewing === 'orig' ? det.orig : viewing === 'marked' ? det.marked : null;
  const n = Math.floor(W / STEP);
  const amp = new Float32Array(n), heat = new Float32Array(n);
  let peak = 1e-6;
  for (let b = 0; b < n; b++) {
    const a = Math.floor((b / n) * x.length), z = Math.max(a + 1, Math.floor(((b + 1) / n) * x.length));
    let p = 0; for (let i = a; i < z; i++) p = Math.max(p, Math.abs(x[i]));
    amp[b] = p; peak = Math.max(peak, p);
    if (viewing === 'mark') heat[b] = 1;
    else if (d && d.heat.length) {
      const h0 = Math.floor(a / HEAT), h1 = Math.max(h0 + 1, Math.ceil(z / HEAT));
      let s = 0, c = 0; for (let h = h0; h < h1 && h < d.heat.length; h++) { s += d.heat[h]; c++; }
      heat[b] = c ? s / c : 0;
    }
  }
  for (let b = 0; b < n; b++) amp[b] /= peak;
  const fresh = !bars || bars.n !== n;
  bars = { amp, heat, n, len: x.length };
  if (fresh || !shown || shown.length !== n) shown = heat.slice();
  if (viewing === 'mark' || !d) shown = heat.slice();
}
// A new reading sweeps across the clip from left to right.
let from = null;
function reveal() { from = shown ? shown.slice() : null; revealAt = performance.now(); }

const mix = (a, b, t) => Math.round(a + (b - a) * t);
function colour(h, alpha = 1) { // slate to teal
  const t = Math.max(0, Math.min(1, (h - 0.15) / 0.7));
  return `rgba(${mix(90, 94, t)},${mix(90, 234, t)},${mix(85, 212, t)},${alpha})`;
}

function draw(now) {
  requestAnimationFrame(draw);
  if (!bars || $('stage').hidden) return;
  const g = wave.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  const strip = 6, mid = (H - strip - 10) / 2;
  const p = from ? Math.min(1, (now - revealAt) / 900) : 1;
  const front = p * bars.n;
  for (let b = 0; b < bars.n; b++) {
    const h = from && b > front ? from[b] ?? 0 : bars.heat[b];
    shown[b] = h;
    const a = Math.max(1.5, Math.pow(bars.amp[b], 0.8) * mid * 1.9);
    g.fillStyle = colour(h);
    g.fillRect(b * STEP, mid - a / 2, 2, a);
    g.fillStyle = colour(h, 0.15 + 0.85 * Math.max(0, Math.min(1, (h - 0.15) / 0.7)));
    g.fillRect(b * STEP, H - strip, STEP, strip);
  }
  if (p >= 1) from = null;
  else { // the sweep's bright edge
    g.fillStyle = 'rgba(94,234,212,.9)';
    g.fillRect(front * STEP, 0, 2, H);
  }
  if (pending && !from) { // still listening: a soft band moving across
    const x = ((now / 1400) % 1) * (W + 120) - 60;
    const grd = g.createLinearGradient(x - 60, 0, x + 60, 0);
    grd.addColorStop(0, 'rgba(94,234,212,0)'); grd.addColorStop(0.5, 'rgba(94,234,212,.22)'); grd.addColorStop(1, 'rgba(94,234,212,0)');
    g.fillStyle = grd; g.fillRect(x - 60, 0, 120, H);
  }
  const t = playSecs();
  if (t != null) {
    const x = (t * SR / bars.len) * W;
    g.fillStyle = '#F5F5F0';
    g.fillRect(Math.round(x), 0, 2, H - strip - 4);
  }
}
requestAnimationFrame(draw);
wave.addEventListener('click', (e) => {
  if (!bars) return;
  const r = wave.getBoundingClientRect();
  play(((e.clientX - r.left) / r.width) * bars.len / SR);
});

// ---------- ways in: the sample, or your own voice ----------
let sample = null;
$('stampSample').addEventListener('click', async () => {
  unlock();
  stopPlay();
  try {
    sample ??= await decode16k(await (await fetch(sampleUrl(SAMPLE))).arrayBuffer());
  } catch { window.rkToast?.('Could not load the sample'); return; }
  await useClip(sample, `Sample · ${SAMPLE.label}`);
});

// Your own file: decoded here, never uploaded.
$('file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  unlock();
  stopPlay();
  let clip;
  try { clip = await decode16k(await f.arrayBuffer()); }
  catch { window.rkToast?.("That file isn't audio I can read"); return; }
  await useClip(clip, f.name.replace(/\.[^.]+$/, ''));
});

let rec = null;
$('record').addEventListener('click', async () => {
  if (rec) { rec.stop(); return; }
  unlock();
  stopPlay();
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false } }); }
  catch { window.rkToast?.('The mic is off for this page. Try the sample'); return; }
  lab.ensure().catch(() => {}); // fetch the model while you talk
  const chunks = [];
  const r = rec = new MediaRecorder(stream);
  r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const t0 = performance.now();
  const tick = setInterval(() => {
    const s = (performance.now() - t0) / 1000;
    $('record').textContent = `Stop · 0:${String(Math.floor(s)).padStart(2, '0')}`;
    if (s >= MAX_REC) r.stop();
  }, 200);
  r.onstop = async () => {
    clearInterval(tick);
    stream.getTracks().forEach((t) => t.stop());
    rec = null;
    $('record').textContent = 'Record again';
    try {
      const audio = await decode16k(await new Blob(chunks, { type: r.mimeType }).arrayBuffer());
      if (audio.length < SR) { window.rkToast?.('That was very short. Try again'); return; }
      await useClip(audio.slice(0, MAX_REC * SR), 'Your recording');
    } catch { window.rkToast?.('Could not read that recording'); }
  };
  r.start();
  $('record').textContent = 'Stop · 0:00';
});
