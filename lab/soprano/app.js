// Soprano: type, press Speak, and the voice starts while the rest of the
// sentence is still being made. The worker (adapter.js) hands back audio a
// stretch at a time; each stretch is queued on the Web Audio clock as soon as
// it arrives, so the waveform shows the made-but-not-yet-heard part running
// ahead of the playhead. Words light up on an estimate of where they fall.
import { mountLab, veil } from '../frame/frame.js';
import { prepare } from './text.js';

const $ = (id) => document.getElementById(id);
const SR = 32000;
const BIN = 320;                   // waveform peaks every 10 ms
const FIRST = 12, NEXT = 20;       // tokens per call: a short first one, for a quick first sound
const SPW = 0.055 * SR;            // starting guess: samples of speech per unit of word weight
const HOP_MS = 64;                 // each audio token is 64 ms of sound

const lab = await mountLab({
  slug: 'soprano',
  adapter: new URL('./adapter.js', import.meta.url).href,
  gate: $('gate'), stats: $('labStats'), verb: 'press Speak',
});

const words = $('words'), reading = $('reading'), wave = $('wave');

// ---------- the text box ----------
function fit() {
  words.style.height = 'auto';
  words.style.height = `${words.scrollHeight}px`;
  const n = words.value.length;
  $('count').textContent = n > 450 ? `${n} / 600` : '';
}
words.addEventListener('input', () => {
  fit();
  // Changed words: the last take no longer matches them.
  if (take?.idle && words.value.trim() !== take.text) $('replay').hidden = $('save').hidden = true;
});
words.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); speak(); } });
addEventListener('resize', () => { fit(); sizeWave(); placeMark(true); });
fit();

function editMode() {
  reading.hidden = true;
  words.hidden = false;
  fit();
}
reading.addEventListener('click', () => {
  if (take && !take.idle) return;
  editMode();
  words.focus();
  words.setSelectionRange(words.value.length, words.value.length);
});

// ---------- audio out ----------
let ctx = null, out = null;
// Safari only unlocks audio inside the click itself, before any await.
function unlock() {
  ctx ??= new AudioContext();
  ctx.resume();
  if (!out) { out = ctx.createGain(); out.connect(ctx.destination); }
}

// ---------- a take: one press of Speak ----------
// One model call at a time, so a new take never starts while the last call of
// a stopped one is still running in the worker.
let chain = Promise.resolve();
function run(input) {
  const p = chain.then(() => lab.run(input));
  chain = p.catch(() => {});
  return p;
}

let take = null;
const sources = new Set();
function stopSound() {
  for (const s of sources) { try { s.stop(); } catch {} }
  sources.clear();
}

function newTake(text, parts) {
  const flat = [];
  parts.forEach((p, k) => p.words.forEach((w, i) => flat.push({ ...w, k, i })));
  flat.sort((a, b) => a.start - b.start);
  return {
    text, parts, flat, chunks: [], total: 0, peaks: [],
    sentences: parts.map((p) => ({ start: null, len: 0, done: false, weights: p.words.map((w) => w.weight), speech: null })),
    queue: [], segs: [], playing: false, nextTime: 0, complete: false, idle: false, cancelled: false,
    t0: 0, ttfs: null, genMs: null, spw: SPW, msPer: null,
  };
}

async function speak(say) {
  unlock();
  if (take && !take.idle) { stop(); return; }
  if (say != null) { words.value = say; fit(); }
  const text = words.value.trim() || words.placeholder;
  const parts = prepare(text);
  if (!parts.length) { window.rkToast?.('Type a few words first'); return; }
  stopSound();
  const t = take = newTake(text, parts);
  showReading(t);
  setBusy(true);
  try { await lab.ensure(); }
  catch { if (t === take) { take = null; setBusy(false); editMode(); } return; }
  if (t !== take) return;

  t.t0 = performance.now();
  try {
    for (let k = 0; k < parts.length; k++) {
      const s = t.sentences[k];
      s.start = t.total;
      await run({ op: 'begin', text: parts[k].clean });
      for (let call = 0; ; call++) {
        if (t !== take || t.cancelled) return;
        // Small calls first, so the first sound comes quickly and the next
        // stretch is ready before it runs out; bigger ones after that.
        const count = k === 0 && call < 2 ? FIRST : NEXT;
        const { output } = await run({ op: 'more', count });
        if (t !== take || t.cancelled) return;
        if (output.msPerToken && output.decodeMsPerToken) {
          t.msPer = (n) => n * output.msPerToken + (n + 9) * output.decodeMsPerToken; // a call of n tokens decodes n + 9
        }
        if (output.audio.length) add(t, output.audio, k === 0 && call < 1 ? FIRST : NEXT);
        if (output.done) break;
      }
      s.done = true;
      s.len = t.total - s.start;
      measure(t, s);
    }
  } catch (err) {
    if (t === take) { stop(); veil('That did not work', null, err?.message || String(err), { label: 'Close', onClick: () => veil(null) }); }
    return;
  }
  t.genMs = performance.now() - t.t0;
  t.complete = true;
  if (!t.playing) startPlaying(t);
  showNums(t);
  if (!t.total) finish(t);
}

function stop() {
  if (!take) return;
  // Stopping a replay keeps the take; stopping one being made drops it.
  if (take.complete) { stopSound(); finish(take); return; }
  take.cancelled = true;
  stopSound();
  take = null;
  setBusy(false);
  editMode();
  $('replay').hidden = $('save').hidden = true;
  view.mode = 'empty';
}

function setBusy(on) {
  $('speak').textContent = on ? 'Stop' : 'Speak';
  $('speak').setAttribute('aria-label', on ? 'Stop speaking' : 'Speak the text');
  if (on) { $('replay').hidden = $('save').hidden = true; }
}

// A stretch of audio arrived: keep it, draw it, and queue it to play.
function add(t, audio, nextCount) {
  t.chunks.push(audio);
  const from = t.total;
  t.total += audio.length;
  for (let b = Math.floor(from / BIN); b * BIN < t.total; b++) {
    const lo = Math.max(b * BIN, from), hi = Math.min((b + 1) * BIN, t.total);
    let p = t.peaks[b] || 0;
    for (let i = lo; i < hi; i++) { const v = Math.abs(audio[i - from]); if (v > p) p = v; }
    t.peaks[b] = p;
  }
  t.queue.push(audio);
  if (t.playing) { flush(t); return; }
  // Start once it is clearly keeping ahead of the voice (and what is in hand
  // outlasts the next call); a slow device waits for a few seconds in hand so
  // the voice doesn't stutter.
  const inHand = (t.total / SR) * 1000;
  const keepsUp = t.msPer && (HOP_MS * NEXT) / t.msPer(NEXT) >= 1.3 && inHand >= 1.2 * t.msPer(nextCount);
  if (keepsUp || inHand >= 2500) startPlaying(t);
  showNums(t);
}

function startPlaying(t) {
  if (t.playing || !t.queue.length) return;
  t.playing = true;
  t.nextTime = ctx.currentTime + 0.04;
  t.ttfs = performance.now() - t.t0 + 40;
  reading.classList.add('playing');
  view.go('scroll');
  flush(t);
  showNums(t);
}

function flush(t) {
  while (t.queue.length) {
    const a = t.queue.shift();
    const buf = ctx.createBuffer(1, a.length, SR);
    buf.copyToChannel(a, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(out);
    const when = Math.max(t.nextTime, ctx.currentTime + 0.02);
    src.start(when);
    sources.add(src);
    src.onended = () => sources.delete(src);
    const from = t.segs.length ? t.segs.at(-1).from + t.segs.at(-1).n : 0;
    t.segs.push({ when, from, n: a.length });
    t.nextTime = when + a.length / SR;
  }
}

// Where the voice is now, in samples from the start of the take.
function playPos(t) {
  if (!t?.segs.length) return 0;
  const now = ctx.currentTime;
  let seg = t.segs[0];
  if (now < seg.when) return 0;
  for (const s of t.segs) { if (s.when <= now) seg = s; else break; }
  return Math.min(seg.from + seg.n, seg.from + (now - seg.when) * SR);
}

function finish(t) {
  t.idle = true;
  reading.classList.remove('playing');
  reading.querySelectorAll('.w').forEach((w) => { w.classList.add('said'); w.classList.remove('now'); });
  setBusy(false);
  const has = t.total > 0;
  $('replay').hidden = $('save').hidden = !has;
  view.go(has ? 'fit' : 'empty');
}

function replay() {
  const t = take;
  if (!t?.complete) return;
  unlock();
  stopSound();
  const all = joined(t);
  t.queue = [all]; t.segs = []; t.playing = false; t.idle = false;
  reading.hidden = false; words.hidden = true;
  reading.querySelectorAll('.w').forEach((w) => w.classList.remove('said', 'now'));
  current = -1;
  setBusy(true);
  startPlaying(t);
}

// ---------- words, roughly in time ----------
// A finished sentence: find where the voice starts and stops in it.
function measure(t, s) {
  const b0 = Math.floor(s.start / BIN), b1 = Math.ceil((s.start + s.len) / BIN);
  let peak = 0;
  for (let b = b0; b < b1; b++) peak = Math.max(peak, t.peaks[b] || 0);
  const on = (b) => (t.peaks[b] || 0) > peak * 0.12;
  let a = b0, z = b1 - 1;
  while (a < z && !on(a)) a++;
  while (z > a && !on(z)) z--;
  s.speech = [a * BIN, (z + 1) * BIN];
  const sum = s.weights.reduce((x, y) => x + y, 0);
  const done = t.sentences.filter((x) => x.speech);
  const spoke = done.reduce((n, x) => n + (x.speech[1] - x.speech[0]), 0);
  const weight = done.reduce((n, x) => n + x.weights.reduce((p, q) => p + q, 0), 0);
  if (weight && sum) t.spw = spoke / weight;
}

// The word being spoken at sample `pos`, as an index into take.flat.
function wordAt(t, pos) {
  let k = -1;
  for (let i = 0; i < t.sentences.length; i++) if (t.sentences[i].start != null && t.sentences[i].start <= pos) k = i;
  if (k < 0) return -1;
  const s = t.sentences[k];
  const sum = s.weights.reduce((x, y) => x + y, 0);
  let a, z;
  if (s.speech) [a, z] = s.speech;
  else { a = s.start + 0.08 * SR; z = Math.max(a + sum * t.spw, s.start + (t.total - s.start) * 0.9); }
  if (pos < a) return t.flat.findIndex((w) => w.k === k) - 1;
  const f = Math.min(0.999, (pos - a) / Math.max(1, z - a));
  let acc = 0, i = 0;
  for (; i < s.weights.length; i++) { acc += s.weights[i] / sum; if (f < acc) break; }
  return t.flat.findIndex((w) => w.k === k && w.i === Math.min(i, s.weights.length - 1));
}

let spans = [], current = -1;
function showReading(t) {
  reading.replaceChildren();
  spans = [];
  current = -1;
  let pos = 0;
  for (const w of t.flat) {
    if (w.start > pos) reading.append(Object.assign(document.createElement('span'), { className: 'gap', textContent: t.text.slice(pos, w.start) }));
    const s = document.createElement('span');
    s.className = 'w';
    s.textContent = w.text;
    reading.append(s);
    spans.push(s);
    pos = w.end;
  }
  if (pos < t.text.length) reading.append(Object.assign(document.createElement('span'), { className: 'gap', textContent: t.text.slice(pos) }));
  const mark = document.createElement('i');
  mark.className = 'mark';
  reading.append(mark);
  reading.hidden = false;
  words.hidden = true;
}

function highlight(t) {
  const i = wordAt(t, playPos(t));
  if (i === current) return;
  for (let j = 0; j < spans.length; j++) {
    spans[j].classList.toggle('said', j < i);
    spans[j].classList.toggle('now', j === i);
  }
  current = i;
  placeMark();
}
function placeMark(instant) {
  const mark = reading.querySelector('.mark');
  const s = spans[current];
  if (!mark || !s) return;
  const box = reading.getBoundingClientRect(), r = s.getBoundingClientRect();
  if (instant) mark.style.transition = 'none';
  mark.style.transform = `translate(${r.left - box.left}px, ${r.bottom - box.top - 2}px)`;
  mark.style.width = `${r.width}px`;
  if (instant) requestAnimationFrame(() => { mark.style.transition = ''; });
}

// ---------- the waveform ----------
// Two views: 'scroll' keeps the playhead still and moves the sound past it;
// 'fit' shows the whole take. Switching eases from one to the other.
const view = {
  mode: 'empty', from: null, since: 0,
  go(mode) { if (mode === this.mode) return; this.from = this.current ? { ...this.current } : null; this.since = performance.now(); this.mode = mode; },
  current: null,
};
let W = 0, Hh = 0, dpr = 1;
function sizeWave() {
  dpr = Math.min(2, devicePixelRatio || 1);
  W = wave.clientWidth; Hh = wave.clientHeight;
  wave.width = Math.round(W * dpr); wave.height = Math.round(Hh * dpr);
}
sizeWave();
const ease = (p) => 1 - Math.pow(1 - p, 3);

function target(t, pos) {
  if (view.mode === 'scroll') {
    const pps = Math.max(70, Math.min(160, W / 6));
    return { t0: pos / SR - (W * 0.28) / pps, pps };
  }
  const secs = Math.max(1, (t?.total || 0) / SR);
  return { t0: 0, pps: W / secs };
}

function draw() {
  const g = wave.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, Hh);
  const t = take;
  const mid = Hh / 2;
  if (!t || view.mode === 'empty' || !t.total) {
    g.fillStyle = '#2A2A2A';
    g.fillRect(0, mid - 0.5, W, 1);
    view.current = null;
    return;
  }
  const pos = t.playing && !t.idle ? playPos(t) : (t.idle ? t.total : 0);
  let v = target(t, pos);
  if (view.from) {
    const p = Math.min(1, (performance.now() - view.since) / 650);
    const e = ease(p);
    v = { t0: view.from.t0 + (v.t0 - view.from.t0) * e, pps: Math.exp(Math.log(view.from.pps) + (Math.log(v.pps) - Math.log(view.from.pps)) * e) };
    if (p >= 1) view.from = null;
  }
  view.current = v;
  const step = 3;
  for (let x = 0; x < W; x += step) {
    const a = (v.t0 + x / v.pps) * SR, z = (v.t0 + (x + step) / v.pps) * SR;
    if (z <= 0 || a >= t.total) continue;
    let p = 0;
    for (let b = Math.max(0, Math.floor(a / BIN)); b * BIN < Math.min(z, t.total); b++) p = Math.max(p, t.peaks[b] || 0);
    const h = Math.max(1.5, Math.pow(Math.min(1, p / 0.45), 0.75) * (Hh * 0.92));
    g.fillStyle = (a + z) / 2 <= pos ? '#F5F5F0' : '#5A5A55';
    g.fillRect(x, mid - h / 2, 2, h);
  }
  if (t.playing && !t.idle) {
    const x = (pos / SR - v.t0) * v.pps;
    g.fillStyle = '#5EEAD4';
    g.fillRect(Math.round(x) - 1, 4, 2, Hh - 8);
  }
}

// The voice keeps going in a background tab, where animation frames stop, so
// the words and the end of the take run on a timer too.
function tick() {
  const t = take;
  if (!t || !t.playing || t.idle) return false;
  highlight(t);
  if (t.complete && !sources.size && ctx.currentTime >= t.nextTime - 0.01) finish(t);
  return true;
}
setInterval(tick, 120);

let lastDrawn = null;
function frame() {
  const live = tick();
  // Only redraw while something moves.
  const key = `${view.mode}|${take?.total}|${W}`;
  if (live || view.from || key !== lastDrawn) { draw(); lastDrawn = key; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---------- numbers ----------
function showNums(t) {
  if (t.ttfs == null) return;
  $('nums').hidden = false;
  $('ttfs').textContent = `${(t.ttfs / 1000).toFixed(2)} s`;
  const spent = (t.genMs ?? performance.now() - t.t0) / 1000;
  $('rtf').textContent = `${(t.total / SR / spent).toFixed(1)}×`;
  $('rtf').parentElement.title = `${(t.total / SR).toFixed(1)} s of speech made in ${spent.toFixed(1)} s on ${lab.where}`;
}

// ---------- download ----------
function joined(t) {
  const all = new Float32Array(t.total);
  let o = 0;
  for (const c of t.chunks) { all.set(c, o); o += c.length; }
  return all;
}
function wav(x) {
  const n = x.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), true);
  return new Blob([buf], { type: 'audio/wav' });
}
$('save').addEventListener('click', () => {
  if (!take?.complete) return;
  const name = take.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').slice(0, 5).join('-') || 'speech';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(wav(joined(take)));
  a.download = `soprano-${name}.wav`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
});

// ---------- controls ----------
$('speak').addEventListener('click', () => speak());
$('replay').addEventListener('click', replay);
document.querySelectorAll('.ex').forEach((b) => b.addEventListener('click', () => {
  if (take && !take.idle) stop();
  speak(b.textContent.trim());
}));
