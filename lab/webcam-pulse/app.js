// ME-rPPG: look at the camera and see your pulse. On every frame (up to 30 a
// second) the page finds the face (face.js), cuts out a 36 x 36 crop and sends
// it to the model in the Lab worker (adapter.js), which answers with one
// sample of the pulse wave. pulse.js turns the samples into a heart rate, the
// way the official web demo does. Frames are never stored or sent anywhere.
import { mountLab, veil } from '../frame/frame.js';
import { PulseTracker } from './pulse.js';
import { loadFaceFinder, FaceBox, cropFace } from './face.js';
import { paintedPortrait } from './portrait.js';

const $ = (id) => document.getElementById(id);
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const HAS_RVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
const SAMPLE = new URL('./samples/portrait.jpg', import.meta.url).href;

const lab = await mountLab({
  slug: 'webcam-pulse',
  adapter: new URL('./adapter.js', import.meta.url).href,
  gate: $('gate'), stats: $('labStats'), verb: 'start',
});

const video = $('video');
const tracker = new PulseTracker();
const faceBox = new FaceBox();
let detector = null;
let source = null;        // { kind: 'camera' | 'portrait', stream, stop, bpm? }
let session = 0;          // bumps on every start and stop; late callbacks check it
let measure = 0;          // bumps when a measurement restarts (new face, long gap)

// ---------- getting ready ----------
async function prepare() {
  const finding = loadFaceFinder(); // in parallel with the model download
  await lab.ensure();
  if (!detector) {
    veil('Getting the face finder', null, 'MediaPipe, about 3 MB, once');
    detector = await finding;
    veil(null);
  }
}
function failed(err) {
  veil('That did not work', null, err?.message || String(err), { label: 'Close', onClick: () => veil(null) });
}

async function startCamera() {
  if (lab.state === 'blocked') return;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 }, facingMode: 'user' }, audio: false,
    });
  } catch {
    window.rkToast?.('The camera is off for this page. Try my portrait');
    return;
  }
  try { await prepare(); } catch (err) { stream.getTracks().forEach((t) => t.stop()); failed(err); return; }
  begin({ kind: 'camera', stream, stop: () => stream.getTracks().forEach((t) => t.stop()) });
}

async function startPortrait() {
  if (lab.state === 'blocked') return;
  try { await prepare(); } catch (err) { failed(err); return; }
  const bpm = 62 + Math.floor(Math.random() * 23);
  let p;
  try { p = await paintedPortrait(SAMPLE, bpm); } catch { window.rkToast?.('Could not load the portrait'); return; }
  begin({ kind: 'portrait', ...p });
}

async function begin(src) {
  stopSource();
  const my = ++session;
  source = src;
  $('viewBox').classList.toggle('mirror', src.kind === 'camera');
  video.srcObject = src.stream;
  try { await video.play(); } catch { /* muted inline video plays; a refusal shows as no frames */ }
  if (my !== session) return;
  restart();
  live = { stopped: false };
  document.body.classList.add('running');
  document.body.classList.remove('stopped');
  $('dock').hidden = false;
  $('toggle').textContent = 'Stop';
  $('swap').textContent = src.kind === 'camera' ? 'Portrait' : 'Camera';
  $('hint').textContent = src.kind === 'portrait'
    ? `My portrait, with a painted pulse: ${src.bpm} BPM.`
    : 'Hold still. Good light helps.';
  schedule(my);
}

function stopSource() {
  session++;
  if (!source) return;
  source.stop();
  video.pause();
  video.srcObject = null;
}

function stop() {
  stopSource();
  document.body.classList.add('stopped');
  if (live) live.stopped = performance.now() / 1000;
  $('toggle').textContent = 'Start';
  $('state').textContent = shownBpm ? 'Last reading' : 'Stopped';
  box.alpha = 0;
}

// A new measurement: fresh model state, filters and buffers.
function restart() {
  measure++;
  tracker.reset();
  faceBox.reset();
  wave.clear();
  inFlight = 0;
  firstFace = null;
  lastFace = null;
  showRate(null);
  lab.run({ op: 'reset' }).catch(() => {});
}

// ---------- frames ----------
// requestVideoFrameCallback gives each new frame once; at most 30 a second are
// used. Without it, the demo's own way: poll on animation frames at 30 a second.
let lastCall = 0, inFlight = 0, firstFace = null, lastFace = null, live = null;
function schedule(my) {
  if (HAS_RVFC) video.requestVideoFrameCallback((now) => onFrame(my, now));
  else requestAnimationFrame((now) => onFrame(my, now));
}
function onFrame(my, now) {
  if (my !== session) return;
  schedule(my);
  const elapsed = now - lastCall;
  if (HAS_RVFC ? elapsed < 25 : elapsed <= 1000 / 30) return;
  lastCall = HAS_RVFC ? now : now - (elapsed % (1000 / 30));
  process(now / 1000);
}

function process(t) {
  if (inFlight >= 5 || video.readyState < 2 || !video.videoWidth) return; // the demo's back-pressure
  // Gone for more than two seconds (looked away, switched tabs): start over.
  if (lastFace != null && t - lastFace > 2) restart();
  tracker.tick(t);
  let found = null;
  try { found = detector.detectForVideo(video, performance.now()).detections[0]; } catch { return; }
  if (!found) { if (lastFace == null || t - lastFace > 0.4) box.alpha = 0; return; }
  const b = faceBox.update(found.boundingBox);
  const frame = cropFace(video, b);
  if (!frame) return;
  firstFace ??= t;
  lastFace = t;
  box.target = b; box.alpha = 1;
  const m = measure;
  inFlight++;
  lab.run({ op: 'step', frame, t }, [frame.buffer]).then(({ output }) => {
    inFlight = Math.max(0, inFlight - 1);
    if (m === measure) onSample(output);
  }).catch((err) => { inFlight = Math.max(0, inFlight - 1); stop(); failed(err); });
}

function onSample({ bvp, t }) {
  const r = tracker.push(bvp);
  if (r.value != null) wave.push(t, r.value);
  if (r.hr) showRate(r.hr);
}

// ---------- the number ----------
let shownBpm = null, said = 0;
function showRate(hr) {
  const ro = $('readout');
  if (!hr) {
    shownBpm = null; said = 0;
    $('bpm').textContent = '--';
    ro.style.setProperty('--c', '0');
    $('state').textContent = 'Finding your face';
    return;
  }
  shownBpm = Math.round(hr.bpm);
  $('bpm').textContent = String(shownBpm);
  // Crisper as the estimate stops moving (the demo's own measure of steadiness).
  const c = Math.max(0, Math.min(1, (0.05 - hr.err) / 0.035));
  ro.style.setProperty('--c', String(hr.steady ? 1 : Math.min(0.85, c)));
  $('state').textContent = hr.steady ? 'Steady' : 'Settling';
  if (hr.steady && Math.abs(shownBpm - said) >= 3) { said = shownBpm; $('said').textContent = `About ${shownBpm} beats a minute`; }
}

// ---------- the pulse wave ----------
const waveCanvas = $('wave'), wctx = waveCanvas.getContext('2d');
const DELAY = 0.15; // draw slightly behind the newest sample so the line moves smoothly
const wave = {
  pts: [], mean: 0, power: 0, beats: [],
  clear() { this.pts = []; this.mean = 0; this.power = 0; this.beats = []; },
  push(t, v) {
    // For drawing only: take out slow drift and keep the height steady.
    this.mean = this.pts.length ? this.mean + (v - this.mean) * 0.03 : v;
    const x = v - this.mean;
    this.power = this.power ? this.power + (x * x - this.power) * 0.02 : x * x;
    this.pts.push({ t, v: x });
    while (this.pts.length && this.pts[0].t < t - 10) this.pts.shift();
    // a beat: a local peak well above the noise, at most 180 a minute
    const n = this.pts.length, rms = Math.sqrt(this.power);
    if (n >= 3) {
      const [a, b, c] = this.pts.slice(-3);
      const lastBeat = this.beats.at(-1) ?? -1;
      if (b.v > a.v && b.v >= c.v && b.v > 0.5 * rms && b.t - lastBeat > 0.33) { this.beats.push(b.t); if (this.beats.length > 8) this.beats.shift(); }
    }
  },
};

// The intro's resting wave: a calm 60 a minute, drawn from the same beat shape.
const restBeat = (ph) => Math.exp(-(((ph - 0.18) / 0.08) ** 2)) + 0.35 * Math.exp(-(((ph - 0.48) / 0.12) ** 2));

function fit(c) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return dpr;
}

function drawWave(nowS) {
  const dpr = fit(waveCanvas);
  const W = waveCanvas.width, H = waveCanvas.height, mid = H / 2;
  wctx.clearRect(0, 0, W, H);
  if (!W || !H) return;
  const span = innerWidth < 640 ? 5 : 7;
  const end = (live?.stopped || nowS) - DELAY, startT = end - span;
  wctx.strokeStyle = 'rgba(245,245,240,.06)'; wctx.lineWidth = dpr;
  wctx.beginPath(); wctx.moveTo(0, mid); wctx.lineTo(W, mid); wctx.stroke();

  let pts;
  if (live) {
    const rms = Math.sqrt(wave.power) || 1;
    pts = wave.pts.filter((p) => p.t >= startT - 0.2 && p.t <= end)
      .map((p) => [((p.t - startT) / span) * W, mid - Math.max(-1.6, Math.min(1.6, p.v / (2.2 * rms))) * H * 0.3]);
  } else {
    pts = [];
    for (let i = 0; i <= 160; i++) {
      const t = startT + (span * i) / 160;
      pts.push([(i / 160) * W, mid - (restBeat(((t % 1) + 1) % 1) - 0.3) * H * 0.22]);
    }
  }
  if (pts.length < 2) return;
  const grad = wctx.createLinearGradient(0, 0, W, 0);
  const a = live ? 1 : 0.35;
  grad.addColorStop(0, 'rgba(94,234,212,0)');
  grad.addColorStop(0.3, `rgba(94,234,212,${0.55 * a})`);
  grad.addColorStop(1, `rgba(94,234,212,${a})`);
  wctx.save();
  wctx.strokeStyle = grad; wctx.lineWidth = 2 * dpr; wctx.lineJoin = 'round'; wctx.lineCap = 'round';
  wctx.shadowColor = `rgba(94,234,212,${0.6 * a})`; wctx.shadowBlur = 12 * dpr;
  wctx.beginPath(); wctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    wctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  wctx.lineTo(pts.at(-1)[0], pts.at(-1)[1]);
  wctx.stroke();
  // the newest point, in bone
  const [hx, hy] = pts.at(-1);
  wctx.shadowColor = `rgba(245,245,240,${0.8 * a})`; wctx.shadowBlur = 14 * dpr;
  wctx.fillStyle = `rgba(245,245,240,${a})`;
  wctx.beginPath(); wctx.arc(hx, hy, 3.5 * dpr, 0, Math.PI * 2); wctx.fill();
  wctx.restore();
}

// ---------- the camera view: face outline, beat glow, ten-second ring ----------
const overlay = $('overlay'), octx = overlay.getContext('2d');
const box = { target: null, shown: null, alpha: 0, a: 0 };
function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function drawOverlay(nowS) {
  const dpr = fit(overlay);
  const W = overlay.width, H = overlay.height;
  octx.clearRect(0, 0, W, H);
  if (!live || W < 60 || H < 60) return;

  // How long we have had a face, out of ten seconds, traced around the edge.
  const p = live.stopped || firstFace == null ? 0 : Math.min(1, (nowS - firstFace) / 10);
  if (p > 0) {
    const r = 24 * dpr, inset = 1.5 * dpr, w = W - 2 * inset, h = H - 2 * inset, rr = r - inset;
    const L = 2 * (w + h) - 8 * rr + 2 * Math.PI * rr;
    octx.save();
    octx.strokeStyle = `rgba(245,245,240,${p < 1 ? 0.85 : 0.35})`; octx.lineWidth = 2 * dpr;
    octx.setLineDash([L * p, L]);
    roundRect(octx, inset, inset, w, h, rr);
    octx.stroke();
    octx.restore();
  }

  // The face, softly outlined where the model is reading.
  box.a += (box.alpha - box.a) * (still ? 1 : 0.15);
  if (!box.target || box.a < 0.01 || !video.videoWidth) return;
  const t = box.target;
  box.shown = box.shown ? Object.fromEntries(Object.entries(box.shown).map(([k, v]) => [k, v + (t[k] - v) * 0.35])) : { ...t };
  const vw = video.videoWidth, vh = video.videoHeight, s = Math.max(W / vw, H / vh);
  const ox = (W - vw * s) / 2, oy = (H - vh * s) / 2;
  let x = ox + box.shown.x * s, y = oy + box.shown.y * s;
  const w = box.shown.w * s, h = box.shown.h * s;
  if (source?.kind === 'camera') x = W - x - w;
  // glow on each beat, timed to when the peak reaches the head of the wave
  const since = nowS - DELAY - (wave.beats.at(-1) ?? -9);
  const g = since >= 0 && !live.stopped ? Math.max(0, 1 - since / 0.45) : 0;
  const grow = (still ? 0 : 5 * g) * dpr;
  octx.save();
  roundRect(octx, x - grow, y - grow, w + 2 * grow, h + 2 * grow, Math.min(w, h) * 0.42);
  octx.lineWidth = 1.5 * dpr;
  octx.strokeStyle = `rgba(245,245,240,${0.42 * box.a})`;
  octx.stroke();
  if (g > 0) {
    octx.strokeStyle = `rgba(94,234,212,${0.85 * g * box.a})`;
    octx.shadowColor = 'rgba(94,234,212,.9)'; octx.shadowBlur = 18 * dpr * g;
    octx.lineWidth = 2 * dpr;
    octx.stroke();
  }
  octx.restore();
  $('beat').classList.toggle('on', g > 0.6);
}

function frame(now) {
  requestAnimationFrame(frame);
  const s = now / 1000;
  drawWave(s);
  drawOverlay(s);
  if (live && !live.stopped && source) {
    const gone = lastFace == null || s - lastFace > 0.6;
    if (shownBpm == null) $('state').textContent = gone ? 'Finding your face' : 'Reading';
    if (source.kind === 'camera') $('hint').textContent = gone ? 'Looking for your face' : 'Hold still. Good light helps.';
  }
}
requestAnimationFrame(frame);

// ---------- controls ----------
$('startBig').addEventListener('click', startCamera);
$('portraitBig').addEventListener('click', startPortrait);
$('toggle').addEventListener('click', () => {
  if (source && !document.body.classList.contains('stopped')) stop();
  else (source?.kind === 'portrait' ? startPortrait : startCamera)();
});
$('swap').addEventListener('click', () => (source?.kind === 'camera' ? startPortrait : startCamera)());
