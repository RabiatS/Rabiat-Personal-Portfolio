// RF-DETR Nano: point a camera and boxes follow what it sees. Every source,
// the camera, the moving sample or a still photo, goes the same way:
//   frame() -> a 384 x 384 copy for the worker (adapter.js) -> detections
//   -> tracks that glide toward each new answer -> drawn over the frame.
// While the model is busy, newer frames are drawn but not sent: it always
// works on the latest one and never builds a queue.
import { mountLab, veil } from '../frame/frame.js';

const $ = (id) => document.getElementById(id);
const IN = 384;                      // the model's input; the processor stretches to it anyway
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

const lab = await mountLab({
  slug: 'rf-detr',
  adapter: new URL('./adapter.js', import.meta.url).href,
  gate: $('gate'), stats: $('labStats'), verb: 'start',
});

const SAMPLES = [
  { src: 'samples/street.jpg', moving: true },
  { src: 'samples/cars.jpg' },
  { src: '../../assets/img/projects/magic-mitts/glove.jpg' },
  { src: '../../assets/img/projects/visionpro/hero-pinch.jpg' },
].map((s) => ({ ...s, url: new URL(s.src, import.meta.url).href }));

const canvas = $('stage');
const ctx = canvas.getContext('2d');
const grab = document.createElement('canvas');
grab.width = grab.height = IN;
const gctx = grab.getContext('2d', { willReadFrequently: true });
const header = document.querySelector('.top'), dock = $('dock'), video = $('cam');

// ---------- sources ----------
// { kind: 'camera' | 'moving' | 'photo', live, mirror, el, done }
let source = null;
let stream = null;
let facing = lab.device.phone ? 'environment' : 'user';
let camFresh = false, lastVideoTime = -1;

function frame(now) {
  if (!source) return null;
  const el = source.el;
  if (source.kind === 'camera') {
    if (!video.videoWidth) return null;
    return { el, sx: 0, sy: 0, sw: video.videoWidth, sh: video.videoHeight };
  }
  if (source.kind === 'moving') {
    // A slow drift and zoom along a still street, like a phone held while
    // walking. It stays low, where the people and cars are.
    const t = (now / 1000) * (still ? 0.35 : 1);
    const W = el.width, H = el.height;
    const z = 0.6 + 0.07 * Math.sin(t * 0.23);
    const sw = W * z, sh = H * z;
    return { el, sw, sh, sx: ((W - sw) / 2) * (1 + Math.sin(t * 0.31)), sy: (H - sh) * (0.8 + 0.2 * Math.sin(t * 0.19 + 1.3)) };
  }
  return { el, sx: 0, sy: 0, sw: el.width, sh: el.height };
}

function setSource(s, { keepBoxes = false } = {}) {
  source = s;
  if (!keepBoxes) { tracks = []; raw = []; }
  fps = 0; lastDone = 0; saidAt = 0;
  $('fps').textContent = '';
  document.body.classList.add('live');
  dock.hidden = false;
  $('camBtn').textContent = s.kind === 'camera' ? 'Stop' : 'Camera';
  $('camBtn').setAttribute('aria-pressed', String(s.kind === 'camera'));
  kick();
}

// The first action is the consent to download; the model loads while the source starts.
function ensure() {
  return lab.ensure().then(kick, () => {}); // the frame's veil already says what went wrong
}

async function startCamera() {
  ensure();
  stopCamera();
  if (!navigator.mediaDevices?.getUserMedia) return noCamera('No camera here. Here is a moving sample');
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
    });
  } catch (err) {
    return noCamera(err?.name === 'NotAllowedError' ? 'The camera is off for this page. Here is a moving sample' : 'No camera found. Here is a moving sample');
  }
  video.srcObject = stream;
  try { await video.play(); } catch { /* starts once frames arrive */ }
  const set = stream.getVideoTracks()[0]?.getSettings?.() || {};
  // Selfie view mirrors, like every camera app; the model always sees the real frame.
  const mirror = set.facingMode ? set.facingMode === 'user' : !lab.device.phone;
  setSource({ kind: 'camera', live: true, mirror, el: video });
  watchFrames();
  if (lab.device.phone) {
    const cams = (await navigator.mediaDevices.enumerateDevices().catch(() => [])).filter((d) => d.kind === 'videoinput');
    $('flipBtn').hidden = cams.length < 2;
  }
}
function noCamera(msg) {
  window.rkToast?.(msg);
  return useSample(0);
}
function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  video.srcObject = null;
  $('flipBtn').hidden = true;
}
// Stopping keeps the last frame and its boxes on screen as a still.
function freezeCamera() {
  const f = frame(performance.now());
  if (f) {
    const c = document.createElement('canvas');
    c.width = f.sw; c.height = f.sh;
    const cx = c.getContext('2d');
    if (source.mirror) { cx.translate(c.width, 0); cx.scale(-1, 1); }
    cx.drawImage(video, 0, 0);
    if (source.mirror) {
      tracks.forEach((t) => { t.box = mirrorBox(t.box); t.target = mirrorBox(t.target); });
      raw = raw.map((d) => ({ ...d, box: mirrorBox(d.box) }));
    }
    stopCamera();
    setSource({ kind: 'photo', el: c, done: true }, { keepBoxes: true });
  } else stopCamera();
}
const mirrorBox = ([x0, y0, x1, y1]) => [1 - x1, y0, 1 - x0, y1];

// New camera frames, from requestVideoFrameCallback where there is one.
function watchFrames() {
  if (!('requestVideoFrameCallback' in HTMLVideoElement.prototype)) return;
  const on = () => { camFresh = true; if (source?.kind === 'camera') video.requestVideoFrameCallback(on); };
  video.requestVideoFrameCallback(on);
}
function cameraHasNewFrame() {
  if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) return camFresh;
  return video.currentTime !== lastVideoTime;
}

let sampleAt = -1;
async function useSample(i) {
  ensure();
  stopCamera();
  sampleAt = i;
  const s = SAMPLES[i];
  let img;
  try { img = await createImageBitmap(await (await fetch(s.url)).blob()); }
  catch { window.rkToast?.('Could not load that sample'); return; }
  if (sampleAt !== i) return;
  setSource(s.moving ? { kind: 'moving', live: true, el: img } : { kind: 'photo', el: img });
}

async function usePhoto(blob) {
  if (!blob || lab.state === 'blocked') return;
  ensure();
  let bitmap;
  try { bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch {
    try { bitmap = await createImageBitmap(blob); }
    catch { window.rkToast?.(/hei[cf]/i.test(blob.type || '') ? 'This browser cannot open HEIC. Try a JPEG' : "That file isn't a photo I can read"); return; }
  }
  stopCamera();
  sampleAt = -1;
  // Through a canvas, at most 2048 px: Safari ignores createImageBitmap's resize options.
  const k = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bitmap.width * k); c.height = Math.round(bitmap.height * k);
  c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
  setSource({ kind: 'photo', el: c });
}

// ---------- detection ----------
let busy = false, raw = [], fps = 0, lastDone = 0;

function wantDetect() {
  if (!source || busy || lab.state !== 'ready') return false;
  if (source.kind === 'photo') return !source.done;
  if (source.kind === 'camera') return cameraHasNewFrame();
  return true;
}

async function detect(f) {
  busy = true;
  const src = source;
  if (src.kind === 'photo') src.done = true;
  if (src.kind === 'camera') { camFresh = false; lastVideoTime = video.currentTime; }
  gctx.drawImage(f.el, f.sx, f.sy, f.sw, f.sh, 0, 0, IN, IN);
  const rgba = gctx.getImageData(0, 0, IN, IN).data;
  try {
    const { output, ms } = await lab.run({ rgba, w: IN, h: IN }, [rgba.buffer]);
    if (src !== source) return; // the source changed while this frame ran
    raw = output.dets;
    applyThreshold();
    readout(ms);
  } catch (err) {
    // Back to the start; the veil says what happened.
    stopCamera();
    source = null;
    document.body.classList.remove('live');
    dock.hidden = true;
    veil('That did not work', null, err?.message || String(err), { label: 'Close', onClick: () => veil(null) });
  } finally {
    busy = false;
    kick();
  }
}

function readout(ms) {
  const el = $('fps');
  if (source.live) {
    const now = performance.now();
    if (lastDone) { const inst = 1000 / (now - lastDone); fps = fps ? fps * 0.85 + inst * 0.15 : inst; }
    lastDone = now;
    if (fps) el.textContent = `${fps < 10 ? fps.toFixed(1) : Math.round(fps)} FPS`;
    el.title = `${fps ? `${fps.toFixed(1)} frames a second, ` : ''}${Math.round(ms)} ms each on ${lab.where}`;
  } else {
    el.textContent = `${Math.round(ms)} ms`;
    el.title = `Found in ${Math.round(ms)} ms on ${lab.where}`;
  }
}

// ---------- tracks: boxes glide to each new answer instead of jumping ----------
let tracks = [];
const iou = (a, b) => {
  const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
  if (w <= 0 || h <= 0) return 0;
  const i = w * h;
  return i / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i);
};

function applyThreshold() {
  const th = +$('thresh').value / 100;
  const dets = raw.filter((d) => d.score >= th);
  const free = new Set(tracks);
  for (const d of dets) {
    let best = null, bestIou = 0.2;
    for (const t of free) {
      if (t.label !== d.label) continue;
      const v = iou(t.target, d.box);
      if (v > bestIou) { bestIou = v; best = t; }
    }
    if (best) {
      free.delete(best);
      Object.assign(best, { target: d.box, score: d.score, gone: false });
    } else {
      // New boxes start a little larger and settle onto the object.
      const [x0, y0, x1, y1] = d.box, gx = (x1 - x0) * 0.08, gy = (y1 - y0) * 0.08;
      tracks.push({ label: d.label, target: d.box, box: [x0 - gx, y0 - gy, x1 + gx, y1 + gy], score: d.score, shown: d.score, alpha: 0, gone: false });
    }
  }
  free.forEach((t) => { t.gone = true; });
  say(dets);
}

function step(dt) {
  const kb = still ? 1 : 1 - Math.exp(-dt * (source?.live ? 16 : 10));
  let settled = true;
  for (const t of tracks) {
    for (let i = 0; i < 4; i++) {
      const d = t.target[i] - t.box[i];
      t.box[i] += d * kb;
      if (Math.abs(d) > 4e-4) settled = false;
    }
    t.shown += (t.score - t.shown) * kb;
    const goal = t.gone ? 0 : 1;
    t.alpha += (goal - t.alpha) * (still ? 1 : 1 - Math.exp(-dt * (t.gone ? 9 : 12)));
    if (Math.abs(goal - t.alpha) > 0.01) settled = false;
  }
  tracks = tracks.filter((t) => !(t.gone && t.alpha < 0.02));
  return settled;
}

// ---------- drawing ----------
const BONE = '245,245,240';
let fontReady = false;
document.fonts?.load('500 11px "DM Mono"').then(() => { fontReady = true; kick(); }).catch(() => {});

function fit(f) {
  const top = header.getBoundingClientRect().bottom + 6;
  const bottom = dock.hidden ? 20 : innerHeight - dock.getBoundingClientRect().top + 12;
  const aw = innerWidth - 24, ah = Math.max(80, innerHeight - top - bottom);
  const k = Math.min(aw / f.sw, ah / f.sh);
  const dw = f.sw * k, dh = f.sh * k;
  return { dx: (innerWidth - dw) / 2, dy: top + (ah - dh) / 2, dw, dh };
}

function draw(f) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const r = fit(f);
  const mirror = !!source.mirror;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(r.dx, r.dy, r.dw, r.dh, 14) : ctx.rect(r.dx, r.dy, r.dw, r.dh);
  ctx.clip();
  if (mirror) { ctx.translate(r.dx * 2 + r.dw, 0); ctx.scale(-1, 1); }
  ctx.drawImage(f.el, f.sx, f.sy, f.sw, f.sh, r.dx, r.dy, r.dw, r.dh);
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.rect(r.dx, r.dy, r.dw, r.dh); ctx.clip();
  // Faint ones first, so the surest labels sit on top.
  [...tracks].sort((a, b) => a.shown - b.shown).forEach((t) => drawBox(t, r, mirror));
  ctx.restore();
}

function drawBox(t, r, mirror) {
  let [x0, y0, x1, y1] = t.box;
  if (mirror) [x0, x1] = [1 - x1, 1 - x0];
  const X0 = r.dx + x0 * r.dw, Y0 = r.dy + y0 * r.dh, X1 = r.dx + x1 * r.dw, Y1 = r.dy + y1 * r.dh;
  const w = X1 - X0, h = Y1 - Y0, a = t.alpha;
  if (w < 2 || h < 2 || a < 0.01) return;

  ctx.fillStyle = `rgba(${BONE},${0.05 * a})`;
  ctx.fillRect(X0, Y0, w, h);
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(${BONE},${0.3 * a})`;
  ctx.strokeRect(X0 + 0.5, Y0 + 0.5, w - 1, h - 1);

  // Viewfinder corners, stronger the surer it is, with a soft shadow so they read on bright scenes too.
  const c = Math.min(18, w * 0.28, h * 0.28);
  ctx.shadowColor = `rgba(0,0,0,${0.55 * a})`;
  ctx.shadowBlur = 4;
  ctx.lineWidth = 2;
  ctx.lineCap = 'square';
  ctx.strokeStyle = `rgba(${BONE},${a * (0.55 + 0.45 * t.shown)})`;
  ctx.beginPath();
  ctx.moveTo(X0, Y0 + c); ctx.lineTo(X0, Y0); ctx.lineTo(X0 + c, Y0);
  ctx.moveTo(X1 - c, Y0); ctx.lineTo(X1, Y0); ctx.lineTo(X1, Y0 + c);
  ctx.moveTo(X1, Y1 - c); ctx.lineTo(X1, Y1); ctx.lineTo(X1 - c, Y1);
  ctx.moveTo(X0 + c, Y1); ctx.lineTo(X0, Y1); ctx.lineTo(X0, Y1 - c);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  // Name and how sure, on a small dark tab above the box (inside it at the top edge).
  ctx.font = fontReady ? '500 11px "DM Mono", monospace' : '500 11px ui-monospace, monospace';
  const text = `${t.label} ${Math.round(t.shown * 100)}`;
  const tw = ctx.measureText(text).width + 10, th = 18;
  const lx = Math.min(Math.max(X0, r.dx), r.dx + r.dw - tw);
  const ly = Y0 - th - 3 >= r.dy ? Y0 - th - 3 : Y0 + 3;
  ctx.fillStyle = `rgba(10,10,10,${0.74 * a})`;
  ctx.fillRect(lx, ly, tw, th);
  ctx.fillStyle = `rgba(${BONE},${a})`;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, lx + 5, ly + th / 2 + 0.5);
}

// For screen readers: what it sees, at most every few seconds.
let saidAt = 0, saidText = '';
function say(dets) {
  const now = performance.now();
  if (now - saidAt < 3000) return;
  const n = new Map();
  dets.forEach((d) => n.set(d.label, (n.get(d.label) || 0) + 1));
  const plural = (w, k) => (k === 1 ? w : w === 'person' ? 'people' : /(s|sh|ch)$/.test(w) ? `${w}es` : `${w}s`);
  const text = n.size ? `I see ${[...n].map(([w, k]) => `${k} ${plural(w, k)}`).join(', ')}` : 'Nothing I am sure about';
  if (text !== saidText) { $('said').textContent = saidText = text; saidAt = now; }
}

// ---------- the loop ----------
let raf = 0, last = 0;
function loop(now) {
  raf = 0;
  const dt = Math.min(0.05, (now - (last || now)) / 1000);
  last = now;
  if (!source) return;
  const f = frame(now);
  if (!f) { raf = requestAnimationFrame(loop); return; }
  if (wantDetect()) detect(f);
  const settled = step(dt);
  draw(f);
  // Stills stop drawing once every box has settled.
  if (source.live || !settled || busy) raf = requestAnimationFrame(loop);
}
function kick() {
  if (!raf && source && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); }
}
document.addEventListener('visibilitychange', kick);
window.addEventListener('resize', kick);

// ---------- controls ----------
$('camBig').addEventListener('click', startCamera);
$('camBtn').addEventListener('click', () => (source?.kind === 'camera' ? freezeCamera() : startCamera()));
$('flipBtn').addEventListener('click', () => { facing = facing === 'user' ? 'environment' : 'user'; startCamera(); });
$('nextBtn').addEventListener('click', () => useSample((sampleAt + 1) % SAMPLES.length));
document.querySelectorAll('.sample').forEach((b) => b.addEventListener('click', () => useSample(+b.dataset.i)));
$('thresh').addEventListener('input', () => {
  $('threshVal').textContent = `${$('thresh').value}%`;
  applyThreshold();
  kick();
});
$('pick').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) usePhoto(f); e.target.value = ''; });
window.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) { e.preventDefault(); usePhoto(item.getAsFile()); }
});
window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault();
  usePhoto([...e.dataTransfer.files].find((f) => f.type.startsWith('image/')));
});
