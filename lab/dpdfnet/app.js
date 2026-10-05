// DPDFNet: a clean voice, noise made here and mixed in live, and a model that
// takes the noise back out. Cleaning runs over the whole clip in the worker,
// a chunk at a time, so the spectrogram turns clean left to right as it goes.
import { mountLab, veil } from '../frame/frame.js';
import { sample, sampleUrl } from '../samples/samples.js';
// Apollo 13's real radio static makes a good first test before any added noise.
const SAMPLE = sample('apollo13-houston.m4a');
import { stft, bandMap, column } from './dsp.js';
import { makeNoise, rms } from './noise.js';

const $ = (id) => document.getElementById(id);
const SR = 48000, N = 960, HOP = N / 2, ROWS = 128;
const DELAY = 4;       // the model's output lags its input by four hops
const CHUNK = 50;      // frames per worker call: half a second of audio
const MAX_TAKE = 15;   // seconds of recording

const lab = await mountLab({
  slug: 'dpdfnet',
  adapter: new URL('./adapter.js', import.meta.url).href,
  gate: $('gate'), stats: $('labStats'), verb: 'clean it',
});

const strip = $('strip'), noisyC = $('specNoisy'), cleanC = $('specClean');
const edges = bandMap(N, SR, ROWS);

// ---------- colour: void, through teal, to bone ----------
const LUT = (() => {
  const stops = [[0, 10, 10, 10], [0.3, 16, 30, 30], [0.55, 34, 100, 92], [0.78, 94, 234, 212], [1, 245, 245, 240]];
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let s = 0; while (s < stops.length - 2 && t > stops[s + 1][0]) s++;
    const [a, b] = [stops[s], stops[s + 1]], f = (t - a[0]) / (b[0] - a[0]);
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = a[c + 1] + (b[c + 1] - a[c + 1]) * f;
  }
  return lut;
})();
function paint(canvas, cols, x0, count) {
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(count, ROWS), px = img.data;
  for (let x = 0; x < count; x++) for (let r = 0; r < ROWS; r++) {
    const v = cols[x * ROWS + r], o = ((ROWS - 1 - r) * count + x) * 4;
    px[o] = LUT[v * 3]; px[o + 1] = LUT[v * 3 + 1]; px[o + 2] = LUT[v * 3 + 2]; px[o + 3] = 255;
  }
  ctx.putImageData(img, x0, 0);
}

// ---------- the clip ----------
let voice = null, voiceSpec = null, frames = 0;  // the clean voice at 48 kHz, and its spectrum
let kind = 'cafe', noise = null, noiseSpec = null;
const noiseCache = new Map();
let clean = null;        // { audio, buf } once cleaned, for the current mix
let everCleaned = false;

const level = () => Number($('level').value);
// 0 is a light hum under the voice (20 dB quieter), 100 is noise a little louder than the voice.
const noiseGain = () => rms(voice) * Math.pow(10, -(20 - 0.22 * level()) / 20);
const secs = (s) => { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

async function decodeAt48k(arrayBuffer) {
  const ab = await new OfflineAudioContext(1, 1, SR).decodeAudioData(arrayBuffer);
  return ab.getChannelData(0).slice();
}
function peakTo(x, target) {
  let p = 0; for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
  if (p > 1e-3) { const k = target / p; for (let i = 0; i < x.length; i++) x[i] *= k; }
  return x;
}

function setVoice(samples, label) {
  stopPlay();
  voice = samples;
  voiceSpec = stft(voice, N).spec;
  frames = 1 + Math.floor(voice.length / HOP);
  noiseCache.clear();
  for (const c of [noisyC, cleanC]) { c.width = frames; c.height = ROWS; }
  $('src').textContent = label;
  $('len').textContent = secs(voice.length / SR);
  buffers.voice = null;
  setNoise(kind);
}

function setNoise(k) {
  kind = k;
  if (!noiseCache.has(k)) {
    const n = makeNoise(k, voice, SR);
    noiseCache.set(k, { n, spec: stft(n, N).spec });
  }
  ({ n: noise, spec: noiseSpec } = noiseCache.get(k));
  buffers.noise = null;
  document.querySelectorAll('#kinds .btn').forEach((b) => {
    const on = b.dataset.kind === k;
    b.classList.toggle('is-selected', on); b.setAttribute('aria-pressed', String(on));
  });
  mixChanged();
}

// The noisy picture is the voice's and the noise's spectra added, so moving
// the slider only re-adds them (no FFTs).
let drawQueued = false;
function drawNoisy() {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => {
    drawQueued = false;
    const g = noiseGain(), size = (N / 2 + 1) * 2, mixed = new Float32Array(size);
    const cols = new Uint8Array(frames * ROWS);
    for (let t = 0; t < frames; t++) {
      const o = t * size;
      for (let k = 0; k < size; k++) mixed[k] = voiceSpec[o + k] + g * noiseSpec[o + k];
      column(mixed, 0, edges, cols, t * ROWS);
    }
    paint(noisyC, cols, 0, frames);
  });
}

// Anything that changes the mix makes the cleaned version stale.
let recleanTimer = 0;
function mixChanged() {
  drawNoisy();
  if (play) play.gN.gain.setTargetAtTime(noiseGain(), ctx.currentTime, 0.02);
  if (clean || job.running) {
    clean = null; job.id++; job.running = false;
    buffers.clean = null;
    strip.classList.remove('working');
    $('clean').disabled = false;
    hear(null); // back to the noisy mix until the new clean is ready
    $('speed').textContent = '';
  }
  clearTimeout(recleanTimer);
  // once someone has cleaned, keep it clean as they play with the noise
  if (everCleaned) recleanTimer = setTimeout(() => cleanIt(), 450);
}

// ---------- cleaning ----------
const job = { id: 0, running: false };
async function cleanIt() {
  if (lab.state === 'blocked' || !voice) return;
  const my = ++job.id;
  job.running = true;
  unlockAudio();
  $('clean').disabled = true;
  try {
    await lab.ensure();
    if (my !== job.id) return;
    const g = noiseGain(), mix = new Float32Array(voice.length);
    for (let i = 0; i < mix.length; i++) mix[i] = voice[i] + g * noise[i];
    const dur = mix.length / SR;

    cleanC.getContext('2d').clearRect(0, 0, cleanC.width, cleanC.height);
    setDone(0);
    strip.classList.add('working', 'clean');
    $('tag').textContent = 'Cleaning';
    $('speed').textContent = '';

    const t0 = performance.now();
    const { output: s } = await lab.run({ op: 'start', audio: mix }, [mix.buffer]);
    if (my !== job.id) return;
    for (;;) {
      const { output: r } = await lab.run({ op: 'step', count: CHUNK });
      if (my !== job.id) return;
      // draw the cleaned frames where they belong in time
      const x0 = r.from - DELAY, n = r.cols.length / ROWS;
      const skip = Math.max(0, -x0), keep = Math.min(n - skip, frames - Math.max(0, x0));
      if (keep > 0) paint(cleanC, r.cols.subarray(skip * ROWS, (skip + keep) * ROWS), Math.max(0, x0), keep);
      setDone(Math.min(1, Math.max(0, r.done - DELAY) / frames));
      if (r.done >= s.frames) break;
    }
    const { output: f } = await lab.run({ op: 'finish' });
    if (my !== job.id) return;
    const wall = (performance.now() - t0) / 1000;

    clean = { audio: f.audio };
    buffers.clean = null;
    everCleaned = true;
    job.running = false;
    setDone(1);
    strip.classList.remove('working');
    $('clean').hidden = true;
    $('flip').hidden = false;
    hear(wantClean === false ? 'noisy' : 'clean');
    const x = dur / wall;
    $('speed').textContent = `${dur.toFixed(1)} s cleaned in ${wall.toFixed(2)} s · ${x >= 10 ? Math.round(x) : x.toFixed(1)}× faster than real time`;
    $('speed').title = `Cleaned on ${lab.where}, one 10 ms step at a time`;
    if (play) restartPlay();
  } catch (err) {
    if (my !== job.id) return;
    job.running = false;
    strip.classList.remove('working');
    showWhich();
    veil('That did not work', null, err?.message || String(err), { label: 'Close', onClick: () => veil(null) });
  } finally {
    if (my === job.id) $('clean').disabled = false;
  }
}
function setDone(f) { strip.style.setProperty('--done', `${(f * 100).toFixed(2)}%`); }

// ---------- listening: noisy or clean ----------
let which = 'noisy', wantClean = null;
function hear(w) {
  which = w === 'clean' && clean ? 'clean' : 'noisy';
  if (w) wantClean = w === 'clean';
  $('hearNoisy').classList.toggle('is-selected', which === 'noisy');
  $('hearClean').classList.toggle('is-selected', which === 'clean');
  $('hearNoisy').setAttribute('aria-pressed', String(which === 'noisy'));
  $('hearClean').setAttribute('aria-pressed', String(which === 'clean'));
  if (play) {
    const t = ctx.currentTime;
    play.busN.gain.setTargetAtTime(which === 'noisy' ? 1 : 0, t, 0.012);
    play.busC.gain.setTargetAtTime(which === 'clean' ? 1 : 0, t, 0.012);
  }
  showWhich();
}
function showWhich() {
  const showClean = job.running || (clean && which === 'clean');
  strip.classList.toggle('clean', Boolean(showClean));
  strip.classList.toggle('flippable', Boolean(clean));
  if (!job.running) $('tag').textContent = clean && which === 'clean' ? 'Clean' : 'Noisy';
  $('hearClean').disabled = !clean;
}
$('hearNoisy').addEventListener('click', () => hear('noisy'));
$('hearClean').addEventListener('click', () => hear('clean'));
strip.addEventListener('click', () => { if (clean) hear(which === 'clean' ? 'noisy' : 'clean'); });

// ---------- audio ----------
let ctx = null, master = null, play = null;
const buffers = { voice: null, noise: null, clean: null };
function unlockAudio() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}
function bufferOf(samples) {
  const b = ctx.createBuffer(1, samples.length, SR);
  b.copyToChannel(samples, 0);
  return b;
}
function startPlay(offset = 0) {
  unlockAudio();
  buffers.voice ??= bufferOf(voice);
  buffers.noise ??= bufferOf(noise);
  if (clean) buffers.clean ??= bufferOf(clean.audio);
  const busN = ctx.createGain(), busC = ctx.createGain(), gN = ctx.createGain();
  busN.gain.value = which === 'noisy' ? 1 : 0; busC.gain.value = which === 'clean' ? 1 : 0;
  gN.gain.value = noiseGain();
  busN.connect(master); busC.connect(master);
  const src = (buf, to) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(to); return s; };
  const srcs = [src(buffers.voice, busN), src(buffers.noise, gN)];
  gN.connect(busN);
  if (buffers.clean) srcs.push(src(buffers.clean, busC));
  const when = ctx.currentTime + 0.03;
  srcs.forEach((s) => s.start(when, offset));
  play = { srcs, busN, busC, gN, when, offset, dur: voice.length / SR };
  strip.classList.add('playing');
  $('playLbl').textContent = 'Pause';
  $('playIcon').setAttribute('d', 'M2 1h3v10H2zM7 1h3v10H7z');
  tickHead();
}
function position() { return play ? (Math.max(0, ctx.currentTime - play.when) + play.offset) % play.dur : 0; }
function stopPlay() {
  if (!play) return 0;
  const at = position();
  play.srcs.forEach((s) => { try { s.stop(); } catch {} });
  play.busN.disconnect(); play.busC.disconnect();
  play = null;
  strip.classList.remove('playing');
  $('playLbl').textContent = 'Play';
  $('playIcon').setAttribute('d', 'M2 1l9 5-9 5z');
  return at;
}
function restartPlay() { const at = stopPlay(); startPlay(at); }
function tickHead() {
  if (!play) return;
  $('head').style.left = `${(position() / play.dur) * 100}%`;
  requestAnimationFrame(tickHead);
}
$('play').addEventListener('click', () => { if (play) stopPlay(); else if (voice) startPlay(); });
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.target.closest('button, input, a, label')) return;
  e.preventDefault();
  $('play').click();
});

// ---------- controls ----------
document.querySelectorAll('#kinds .btn').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.kind === kind) return;
  setNoise(b.dataset.kind);
  if (play) restartPlay();
}));
$('level').addEventListener('input', mixChanged);
$('clean').addEventListener('click', () => cleanIt());

// ---------- your own voice ----------
let take = null, workletReady = null;
$('rec').addEventListener('click', () => (take ? stopTake() : startTake()));
async function startTake() {
  unlockAudio();
  stopPlay();
  let stream;
  try {
    // the browser's own noise suppression would spoil the comparison
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: true } });
    workletReady ??= ctx.audioWorklet.addModule(new URL('./record.worklet.js', import.meta.url));
    await workletReady;
  } catch (err) {
    stream?.getTracks().forEach((t) => t.stop());
    if (stream) workletReady = null;
    window.rkToast?.(err?.name === 'NotAllowedError' || err?.name === 'NotFoundError' ? 'The mic is off for this page' : 'Recording is not available here');
    return;
  }
  const srcNode = ctx.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(ctx, 'take-raw');
  const mute = ctx.createGain(); mute.gain.value = 0;
  srcNode.connect(node); node.connect(mute).connect(ctx.destination);
  const rate = ctx.sampleRate, max = MAX_TAKE * rate;
  // live spectrogram of the take, at the mic's own rate
  const liveEdges = bandMap(N, rate, ROWS), liveW = Math.ceil(max / HOP);
  noisyC.width = liveW; noisyC.height = ROWS;
  noisyC.getContext('2d').fillStyle = '#0A0A0A'; noisyC.getContext('2d').fillRect(0, 0, liveW, ROWS);
  cleanC.getContext('2d').clearRect(0, 0, cleanC.width, cleanC.height);
  clean = null; job.id++; job.running = false; showWhich();
  take = { stream, srcNode, node, chunks: [], n: 0, rate, drawn: 0, edges: liveEdges, t0: performance.now() };
  node.port.onmessage = (e) => {
    if (!take) return;
    take.chunks.push(e.data); take.n += e.data.length;
    liveColumns();
    $('speed').textContent = `Recording ${secs(take.n / rate)} of ${secs(MAX_TAKE)}`;
    if (take.n >= max) stopTake();
  };
  $('rec').setAttribute('aria-pressed', 'true');
  $('recLbl').textContent = 'Stop';
  $('src').textContent = 'Your recording';
  $('len').textContent = secs(MAX_TAKE);
  $('tag').textContent = 'Listening';
}
function liveColumns() {
  const all = joined(take.chunks, take.n);
  const fr = Math.floor((all.length - N) / HOP) + 1;
  if (fr <= take.drawn) return;
  const seg = all.subarray(take.drawn * HOP, (fr - 1) * HOP + N);
  // frames of this stretch only, without centring
  const { spec } = stft(seg, N);
  const cols = new Uint8Array((fr - take.drawn) * ROWS), size = (N / 2 + 1) * 2;
  for (let t = 0; t < fr - take.drawn; t++) column(spec, (t + 1) * size, take.edges, cols, t * ROWS);
  paint(noisyC, cols, take.drawn, fr - take.drawn);
  take.drawn = fr;
}
const joined = (chunks, n) => { const a = new Float32Array(n); let o = 0; for (const c of chunks) { a.set(c, o); o += c.length; } return a; };
async function stopTake() {
  if (!take) return;
  const t = take; take = null;
  t.node.port.onmessage = null;
  t.srcNode.disconnect(); t.node.disconnect();
  t.stream.getTracks().forEach((x) => x.stop());
  $('rec').setAttribute('aria-pressed', 'false');
  $('recLbl').textContent = 'Record again';
  $('speed').textContent = '';
  const raw = joined(t.chunks, t.n);
  if (raw.length < 0.5 * t.rate) { window.rkToast?.('That was too short'); setVoice(sampleVoice, SAMPLE.label); return; }
  // resample the whole take to 48 kHz in one go
  const off = new OfflineAudioContext(1, Math.ceil(raw.length * SR / t.rate), SR);
  const b = off.createBuffer(1, raw.length, t.rate); b.copyToChannel(raw, 0);
  const s = off.createBufferSource(); s.buffer = b; s.connect(off.destination); s.start();
  const out = (await off.startRendering()).getChannelData(0).slice();
  setVoice(peakTo(out, 0.5), 'Your recording');
  $('useSample').hidden = false;
  if (!everCleaned) $('speed').textContent = '';
}
$('useSample').addEventListener('click', () => { $('useSample').hidden = true; $('recLbl').textContent = 'Record your own'; setVoice(sampleVoice, SAMPLE.label); });

// Your own file: decoded here, never uploaded.
$('file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try { setVoice(peakTo(await decodeAt48k(await f.arrayBuffer()), 0.5), f.name.replace(/\.[^.]+$/, '')); $('useSample').hidden = false; }
  catch { window.rkToast?.("That file isn't audio I can read"); }
});

// ---------- start: the sample, with cafe noise under it ----------
let sampleVoice = null;
try {
  sampleVoice = peakTo(await decodeAt48k(await (await fetch(sampleUrl(SAMPLE))).arrayBuffer()), 0.5);
  setVoice(sampleVoice, SAMPLE.label);
} catch {
  $('gate').textContent = 'This browser could not open the sample clip.';
}
