// EdgeTAM: pick a photo, tap anything in it, and it lifts out as a cut-out.
// The worker (adapter.js) reads the photo once; each tap only runs the small
// decoder, which hands back a 256 x 256 mask that is scaled up here.
import { mountLab, veil } from '../frame/frame.js';

const $ = (id) => document.getElementById(id);
const WORK = 1280;    // the cut-out on screen is worked out at this size
const EXPORT = 2048;  // the saved PNG is at most this many pixels on its long side
const HOLD = 450;     // a press this long takes away instead of adding
const ENC = 1024;     // the encoder's input size

const lab = await mountLab({
  slug: 'edgetam',
  adapter: new URL('./adapter.js', import.meta.url).href,
  gate: $('gate'), stats: $('labStats'), verb: 'pick a photo',
});

const frame = $('frame'), photoC = $('photo'), liftC = $('lift');
const hover = matchMedia('(hover: hover)').matches;

// ---------- the photo ----------
let photo = null;      // { name, full, work, workPx, fullPx }
let token = 0;         // bumps with every new photo
let ready = false;     // the features for this photo are in the worker
let points = [];       // { x, y, label } with x, y from 0 to 1
let shown = null;      // the mask on screen: { key, logits, w, h }
let peekAt = null;     // where the mouse is, before any tap

function canvasOf(src, max) {
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(src.width * k)); c.height = Math.max(1, Math.round(src.height * k));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
async function decodeImage(blob) {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch { return createImageBitmap(blob); }
}

async function take(blob, name = 'photo') {
  if (lab.state === 'blocked' || !blob) return;
  let bitmap;
  try { bitmap = await decodeImage(blob); }
  catch {
    window.rkToast?.(/hei[cf]/i.test(blob.type || '') ? 'This browser cannot open HEIC. Try a JPEG' : "That file isn't a photo I can read");
    return;
  }
  const t = ++token;
  const full = canvasOf(bitmap, EXPORT);
  const work = canvasOf(full, WORK);
  photo = { name, full, work, workPx: work.getContext('2d').getImageData(0, 0, work.width, work.height).data, fullPx: null };
  ready = false; points = []; shown = null; peekAt = null; busy = false;

  frame.style.setProperty('--ar', `${work.width / work.height}`);
  for (const c of [photoC, liftC]) { c.width = work.width; c.height = work.height; }
  photoC.getContext('2d').drawImage(work, 0, 0);
  liftC.getContext('2d').clearRect(0, 0, liftC.width, liftC.height);
  frame.classList.remove('lifted', 'peek');
  frame.classList.add('reading');
  drawDots(); syncButtons(); $('readout').textContent = '';
  document.body.classList.add('has-photo');
  $('dock').hidden = false;
  hint(null);

  // The encoder wants 1024 x 1024; the stretch is undone when the mask comes back.
  const sq = document.createElement('canvas');
  sq.width = sq.height = ENC;
  const sctx = sq.getContext('2d', { willReadFrequently: true });
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(full, 0, 0, ENC, ENC);
  const rgba = sctx.getImageData(0, 0, ENC, ENC).data;

  try {
    await lab.ensure();
    if (t !== token) return;
    const { ms } = await lab.run({ op: 'encode', rgba, w: ENC, h: ENC }, [rgba.buffer]);
    if (t !== token) return; // a newer photo arrived meanwhile
    ready = true;
    frame.classList.remove('reading');
    $('readout').textContent = `${(ms / 1000).toFixed(2)} s`;
    $('readout').title = `Photo read in ${(ms / 1000).toFixed(2)} s on ${lab.where}`;
    if (!points.length) hint(hover ? 'Click anything' : 'Tap anything');
    pump();
  } catch (err) {
    if (t !== token) return;
    frame.classList.remove('reading');
    veil('That did not work', null, err?.message || String(err), { label: 'Close', onClick: () => veil(null) });
  }
}

// ---------- taps ----------
let press = null;
const at = (e) => {
  const r = frame.getBoundingClientRect();
  return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
};
frame.addEventListener('pointerdown', (e) => {
  if (!photo || (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2)) return;
  try { frame.setPointerCapture(e.pointerId); } catch { /* synthetic or already gone */ }
  const p = at(e);
  press = { ...p, cx: e.clientX, cy: e.clientY, id: e.pointerId, done: false, ring: 0, hold: 0 };
  if (e.button === 2) return; // right-click takes away on release
  const ring = $('press');
  ring.style.left = `${p.x * 100}%`; ring.style.top = `${p.y * 100}%`;
  press.ring = setTimeout(() => { ring.classList.remove('on'); void ring.offsetWidth; ring.classList.add('on'); }, 110);
  press.hold = setTimeout(() => {
    if (!press || press.done) return;
    press.done = true;
    ring.classList.remove('on');
    navigator.vibrate?.(12);
    addPoint(press.x, press.y, 0);
  }, HOLD);
});
function endPress() {
  if (!press) return;
  clearTimeout(press.ring); clearTimeout(press.hold);
  $('press').classList.remove('on');
  press = null;
}
frame.addEventListener('pointermove', (e) => {
  if (press && press.id === e.pointerId) {
    if (Math.hypot(e.clientX - press.cx, e.clientY - press.cy) > 12) { press.done = true; endPress(); }
    return;
  }
  if (e.pointerType === 'mouse' && !e.buttons && !points.length) { peekAt = at(e); pump(); }
});
frame.addEventListener('pointerup', (e) => {
  if (!press || press.id !== e.pointerId) return;
  const p = press;
  endPress();
  if (p.done) return;
  const takeAway = e.button === 2 || e.altKey || e.shiftKey || mode === 0;
  addPoint(p.x, p.y, takeAway ? 0 : 1);
});
frame.addEventListener('pointercancel', endPress);
frame.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { peekAt = null; pump(); } });
frame.addEventListener('contextmenu', (e) => e.preventDefault());

function addPoint(x, y, label) {
  if (!photo) return;
  if (!points.length && label === 0) { window.rkToast?.('Tap something to add first'); return; }
  points.push({ x, y, label });
  peekAt = null;
  hint(null);
  drawDots(); syncButtons();
  pump();
}

function drawDots() {
  $('dots').replaceChildren(...points.map((p) => {
    const d = document.createElement('i');
    d.className = p.label ? 'dot' : 'dot minus';
    d.style.left = `${p.x * 100}%`; d.style.top = `${p.y * 100}%`;
    return d;
  }));
}

// ---------- one decode at a time, always for the latest taps ----------
let busy = false, failed = null;
function wanted() {
  if (points.length) return { kind: 'tap', key: points.map((p) => `${p.x},${p.y},${p.label}`).join(';'), pts: points.slice() };
  if (peekAt && hover) return { kind: 'peek', key: `peek ${peekAt.x},${peekAt.y}`, pts: [{ ...peekAt, label: 1 }] };
  return null;
}
async function pump() {
  if (!ready || busy) return;
  const job = wanted();
  if (!job) { if (shown) clearMask(); return; }
  if (shown?.key === job.key || failed === job.key) return;
  busy = true;
  const t = token;
  try {
    const { output, ms } = await lab.run({ op: 'decode', points: job.pts.map((p) => [p.x, p.y]), labels: job.pts.map((p) => p.label) });
    if (t !== token) return;
    if (wanted()?.key === job.key) show(job, output, ms);
  } catch {
    failed = job.key; // don't retry the same taps in a loop
    if (t === token && job.kind === 'tap') window.rkToast?.('That tap did not work. Try again');
  } finally {
    if (t === token) { busy = false; pump(); }
  }
}

function show(job, out, ms) {
  const { work, workPx } = photo;
  const W = work.width, H = work.height;
  const logits = soften(out.logits, out.w, out.h);
  const { alpha, box } = maskAlpha(logits, out.w, out.h, W, H);
  shown = { key: job.key, logits, w: out.w, h: out.h };
  if (!box && job.kind === 'tap') {
    clearMask(false);
    shown = { key: job.key };
    hint('Nothing to lift there. Try another spot');
    syncButtons();
    return;
  }
  const ctx = liftC.getContext('2d');
  const img = ctx.createImageData(W, H);
  const px = img.data;
  for (let i = 0, j = 0; i < alpha.length; i++, j += 4) {
    const a = alpha[i];
    if (!a) continue;
    px[j] = workPx[j]; px[j + 1] = workPx[j + 1]; px[j + 2] = workPx[j + 2]; px[j + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  if (box) liftC.style.transformOrigin = `${((box[0] + box[2]) / 2 / W) * 100}% ${((box[1] + box[3]) / 2 / H) * 100}%`;

  if (job.kind === 'tap') {
    frame.classList.remove('peek');
    // drop it back down for a frame, so every change lifts again
    frame.classList.add('pop', 'lifted');
    void liftC.offsetWidth;
    frame.classList.remove('pop');
    $('readout').textContent = `${Math.round(ms)} ms`;
    $('readout').title = `Last tap took ${Math.round(ms)} ms on ${lab.where}`;
    drawSprite(box, W, H);
  } else {
    frame.classList.remove('lifted');
    frame.classList.add('peek');
  }
  syncButtons();
}

function clearMask(resetShown = true) {
  if (resetShown) shown = null;
  frame.classList.remove('lifted', 'peek');
  setTimeout(() => { if (!shown?.logits) liftC.getContext('2d').clearRect(0, 0, liftC.width, liftC.height); }, 260);
  const s = $('sprite').getContext('2d'); s.clearRect(0, 0, 68, 68);
  syncButtons();
}

// A light 3 x 3 blur on the logits: where the model is unsure it can flicker
// between in and out from pixel to pixel, and this keeps the edge in one piece.
function soften(src, w, h) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * w + x, l = x ? o - 1 : o, r = x < w - 1 ? o + 1 : o;
    tmp[o] = (src[l] + 2 * src[o] + src[r]) / 4;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * w + x, u = y ? o - w : o, d = y < h - 1 ? o + w : o;
    out[o] = (tmp[u] + 2 * tmp[o] + tmp[d]) / 4;
  }
  return out;
}

// The decoder's mask is 256 x 256 logits over the stretched square. Sample it
// back over the photo with bilinear steps; a narrow ramp around zero gives a
// clean, slightly soft edge.
function maskAlpha(logits, mw, mh, W, H) {
  const k = W / 2000 + H / 4000; // a ramp of roughly one to two pixels
  const alpha = new Uint8ClampedArray(W * H);
  const sx = mw / W, sy = mh / H;
  const ix = new Int32Array(W), fx = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const u = Math.max(0, (x + 0.5) * sx - 0.5);
    const i = Math.min(mw - 2, Math.floor(u));
    ix[x] = i; fx[x] = Math.min(1, u - i);
  }
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) {
    const v = Math.max(0, (y + 0.5) * sy - 0.5);
    const j = Math.min(mh - 2, Math.floor(v));
    const gy = Math.min(1, v - j);
    const r0 = j * mw, r1 = r0 + mw;
    let any = false;
    for (let x = 0; x < W; x++) {
      const i = ix[x], g = fx[x];
      const top = logits[r0 + i] + (logits[r0 + i + 1] - logits[r0 + i]) * g;
      const bot = logits[r1 + i] + (logits[r1 + i + 1] - logits[r1 + i]) * g;
      const a = ((top + (bot - top) * gy) * k + 0.5) * 255;
      if (a <= 0) continue;
      const o = y * W + x;
      alpha[o] = a;
      if (a > 10) { any = true; if (x < x0) x0 = x; if (x > x1) x1 = x; }
    }
    if (any) { if (y < y0) y0 = y; y1 = y; }
  }
  return { alpha, box: x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1] };
}

// ---------- the sprite ----------
function drawSprite(box, W, H) {
  const s = $('sprite').getContext('2d');
  s.clearRect(0, 0, 68, 68);
  if (!box) return;
  const bw = box[2] - box[0], bh = box[3] - box[1];
  const k = Math.min(60 / bw, 60 / bh);
  s.imageSmoothingQuality = 'high';
  s.drawImage(liftC, box[0], box[1], bw, bh, (68 - bw * k) / 2, (68 - bh * k) / 2, bw * k, bh * k);
}

// The saved cut-out is redone at full size, cropped to the object, edges kept soft.
function spriteBlob() {
  return new Promise((resolve, reject) => {
    if (!shown?.logits || !points.length) { reject(new Error('Nothing lifted yet')); return; }
    const { full } = photo;
    const W = full.width, H = full.height;
    photo.fullPx ??= full.getContext('2d').getImageData(0, 0, W, H).data;
    const { alpha, box } = maskAlpha(shown.logits, shown.w, shown.h, W, H);
    if (!box) { reject(new Error('Nothing lifted yet')); return; }
    const pad = 2;
    const bx = Math.max(0, box[0] - pad), by = Math.max(0, box[1] - pad);
    const bw = Math.min(W, box[2] + pad) - bx, bh = Math.min(H, box[3] + pad) - by;
    const c = document.createElement('canvas');
    c.width = bw; c.height = bh;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(bw, bh);
    const src = photo.fullPx, px = img.data;
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const o = (by + y) * W + bx + x, j = (y * bw + x) * 4, a = alpha[o];
        if (!a) continue;
        px[j] = src[o * 4]; px[j + 1] = src[o * 4 + 1]; px[j + 2] = src[o * 4 + 2]; px[j + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the PNG'))), 'image/png');
  });
}

// ---------- controls ----------
let mode = 1;
function setMode(m) {
  mode = m;
  $('addBtn').setAttribute('aria-pressed', String(m === 1));
  $('subBtn').setAttribute('aria-pressed', String(m === 0));
}
$('addBtn').addEventListener('click', () => setMode(1));
$('subBtn').addEventListener('click', () => setMode(0));

function undo() {
  if (!points.length) return;
  points.pop();
  drawDots(); syncButtons();
  if (!points.length) { clearMask(); if (ready) hint(hover ? 'Click anything' : 'Tap anything'); }
  pump();
}
$('undoBtn').addEventListener('click', undo);
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && photo) { e.preventDefault(); undo(); }
});

function syncButtons() {
  const has = Boolean(shown?.logits && points.length && frame.classList.contains('lifted'));
  $('copyBtn').disabled = !has;
  $('saveBtn').disabled = !has;
  $('undoBtn').disabled = !points.length;
}

$('copyBtn').addEventListener('click', async () => {
  if (!navigator.clipboard?.write || !window.ClipboardItem) { window.rkToast?.('This browser cannot copy images. Use Save'); return; }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': spriteBlob() })]);
    window.rkToast?.('Copied. Paste it anywhere');
  } catch { window.rkToast?.('Your browser blocked copying. Use Save'); }
});
$('saveBtn').addEventListener('click', async () => {
  try {
    const blob = await spriteBlob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${photo.name}-cutout.png`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (err) { window.rkToast?.(err.message); }
});

let hintTimer = 0;
function hint(text) {
  clearTimeout(hintTimer);
  const h = $('hint');
  if (!text) { h.hidden = true; return; }
  h.textContent = text; h.hidden = false;
  if (/Nothing/.test(text)) hintTimer = setTimeout(() => { h.hidden = true; }, 2600);
}

// ---------- ways in: tiles, pick, paste, drop ----------
const baseName = (n) => (n || 'photo').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').slice(0, 40) || 'photo';
$('pick').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) take(f, baseName(f.name)); e.target.value = ''; });
window.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) { e.preventDefault(); take(item.getAsFile(), 'pasted'); }
});
let depth = 0;
window.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) { depth++; $('intake').classList.add('over'); } });
window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) $('intake').classList.remove('over'); });
window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault(); depth = 0; $('intake').classList.remove('over');
  const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/') || /\.hei[cf]$/i.test(x.name));
  if (f) take(f, baseName(f.name));
});
document.querySelectorAll('.tile[data-src]').forEach((b) => b.addEventListener('click', async () => {
  try { take(await (await fetch(b.dataset.src)).blob(), b.dataset.name); }
  catch { window.rkToast?.('Could not load that sample'); }
}));
