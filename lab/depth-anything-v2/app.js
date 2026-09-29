// Depth Anything V2: a photo in, a scene you can tilt out. The model runs in
// the Lab worker (adapter.js); mesh.js draws the result.
import { mountLab, veil } from '../frame/frame.js';
import { createScene } from './mesh.js';

const $ = (id) => document.getElementById(id);
const MAX_IN = 1024;                      // model input; it resizes to 518 anyway
const MAX_TILT = 12 * Math.PI / 180;
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

const lab = await mountLab({
  slug: 'depth-anything-v2',
  adapter: new URL('./adapter.js', import.meta.url).href,
  gate: $('gate'), stats: $('labStats'), verb: 'pick a photo',
});

let scene = null;
try { scene = createScene($('scene'), { cells: lab.device.phone ? 160 : 256 }); }
catch { $('gate').textContent = 'This browser cannot draw in 3D (no WebGL2).'; document.body.classList.add('lab-blocked'); }
const s = scene?.state;
const header = document.querySelector('.top'), dock = $('dock');

// ---------- a photo in ----------
let token = 0;
// Resize through a canvas: Safari ignores createImageBitmap's resize options.
function resized(bitmap, max) {
  const k = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(bitmap.width * k)); c.height = Math.max(1, Math.round(bitmap.height * k));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  return c;
}
async function decode(blob) {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch { return createImageBitmap(blob); } // older engines only know 'none' and 'flipY'
}

async function take(blob) {
  if (!scene || lab.state === 'blocked' || !blob) return;
  try { await takeOrThrow(blob); }
  catch (err) { veil('That did not work', null, err?.message || String(err), { label: 'Close', onClick: () => veil(null) }); }
}
async function takeOrThrow(blob) {
  let bitmap;
  try { bitmap = await decode(blob); }
  catch {
    window.rkToast?.(/hei[cf]/i.test(blob.type || '') ? 'This browser cannot open HEIC. Try a JPEG' : "That file isn't a photo I can read");
    return;
  }
  const t = ++token;
  scene.setPhoto(resized(bitmap, Math.min(2048, scene.maxTexture)));
  s.strength = 0; reveal = null;
  document.body.classList.add('has-photo');
  $('dock').hidden = false; $('readout').hidden = true;
  startLoop();
  autoGyro();

  const c = resized(bitmap, MAX_IN);
  const rgba = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;

  await lab.ensure();
  const slow = setTimeout(() => t === token && veil('Measuring depth', null, `on ${lab.where}`), 300);
  let res;
  try { res = await lab.run({ rgba, w: c.width, h: c.height }, [rgba.buffer]); }
  finally { clearTimeout(slow); }
  if (t !== token) return; // a newer photo arrived while this one ran
  veil(null);
  scene.setDepth(res.output.depth, res.output.w, res.output.h);
  reveal = { t0: performance.now() };
  $('readout').textContent = `${(res.ms / 1000).toFixed(2)} s · ${lab.variant.tier.toUpperCase()}`;
  $('readout').title = `Depth measured in ${(res.ms / 1000).toFixed(2)} s on ${lab.where}, from a ${c.width} × ${c.height} copy`;
  $('readout').hidden = false;
}

// ---------- motion ----------
const target = { x: 0, y: 0 };
let lastInput = -1e9, reveal = null, depthView = false, gyro = null;
const strengthOf = () => (+$('strength').value) / 50;
const ease = (p) => 1 - Math.pow(1 - p, 3);

let raf = 0, last = 0;
function frame(now) {
  raf = 0;
  const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
  let tx = target.x, ty = target.y;
  if (!still && !gyro && now - lastInput > 1600) { const t = now / 1000; tx = Math.sin(t * 0.55) * 0.45; ty = Math.sin(t * 0.4 + 1) * 0.3; }
  const k = 1 - Math.exp(-dt * 5);
  s.tiltX += (-tx * MAX_TILT - s.tiltX) * k;  // pointer right: look from the right
  s.tiltY += (ty * MAX_TILT - s.tiltY) * k;
  if (reveal) {
    const p = Math.min(1, (now - reveal.t0) / 900);
    s.strength = strengthOf() * ease(p);
    if (p >= 1) reveal = null;
  } else if (s.count) s.strength += (strengthOf() - s.strength) * (1 - Math.exp(-dt * 12));
  s.mix += ((depthView ? 1 : 0) - s.mix) * (1 - Math.exp(-dt * 10));
  scene.insets.top = header.getBoundingClientRect().bottom + 6;
  scene.insets.bottom = dock.hidden ? 20 : innerHeight - dock.getBoundingClientRect().top + 14;
  scene.draw();
  if (!document.hidden) raf = requestAnimationFrame(frame);
}
function startLoop() { if (!raf && scene) { last = 0; raf = requestAnimationFrame(frame); } }
document.addEventListener('visibilitychange', () => { if (!document.hidden && document.body.classList.contains('has-photo')) startLoop(); });

function aim(x, y) {
  target.x = Math.max(-1, Math.min(1, (x / innerWidth - 0.5) * 2));
  target.y = Math.max(-1, Math.min(1, (0.5 - y / innerHeight) * 2));
  lastInput = performance.now();
}
window.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) aim(e.clientX, e.clientY); });
document.documentElement.addEventListener('pointerleave', () => { target.x = target.y = 0; });
$('scene').addEventListener('pointerdown', (e) => { $('scene').setPointerCapture(e.pointerId); aim(e.clientX, e.clientY); });
$('scene').addEventListener('pointerup', () => { if (!gyro) { target.x = target.y = 0; } });

// Phone tilt: relative to how the phone was held when it started.
function onOrient(e) {
  if (e.beta == null) return;
  if (!gyro.base) gyro.base = { b: e.beta, g: e.gamma };
  let dx = e.gamma - gyro.base.g, dy = e.beta - gyro.base.b;
  const a = screen.orientation?.angle ?? window.orientation ?? 0;
  if (a === 90) [dx, dy] = [dy, -dx]; else if (a === -90 || a === 270) [dx, dy] = [-dy, dx]; else if (a === 180) [dx, dy] = [-dx, -dy];
  target.x = Math.max(-1, Math.min(1, dx / 20));
  target.y = Math.max(-1, Math.min(1, -dy / 20));
}
function gyroOn() { gyro = { base: null }; window.addEventListener('deviceorientation', onOrient); $('tiltBtn').setAttribute('aria-pressed', 'true'); }
function gyroOff() { window.removeEventListener('deviceorientation', onOrient); gyro = null; target.x = target.y = 0; $('tiltBtn').setAttribute('aria-pressed', 'false'); }
const needsAsk = typeof window.DeviceOrientationEvent?.requestPermission === 'function';
// Android gives tilt freely; iOS asks, so it gets a button.
function autoGyro() { if (lab.device.phone && !needsAsk && !gyro && 'DeviceOrientationEvent' in window) gyroOn(); }
if (needsAsk && lab.device.phone) $('tiltBtn').hidden = false;
$('tiltBtn').addEventListener('click', async () => {
  if (gyro) return gyroOff();
  try { if ((await DeviceOrientationEvent.requestPermission()) === 'granted') gyroOn(); else window.rkToast?.('Motion is turned off for this site'); }
  catch { window.rkToast?.('Motion is not available here'); }
});

// ---------- controls ----------
$('depthBtn').addEventListener('click', () => {
  depthView = !depthView;
  $('depthBtn').setAttribute('aria-pressed', String(depthView));
});
$('strength').addEventListener('input', () => { reveal = null; });

// ---------- ways in: pick, paste, drop, samples ----------
$('pick').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) take(f); e.target.value = ''; });
window.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) { e.preventDefault(); take(item.getAsFile()); }
});
let depth = 0;
window.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) { depth++; $('intake').classList.add('over'); } });
window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) $('intake').classList.remove('over'); });
window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault(); depth = 0; $('intake').classList.remove('over');
  take([...e.dataTransfer.files].find((f) => f.type.startsWith('image/') || /\.hei[cf]$/i.test(f.name)));
});
document.querySelectorAll('.sample').forEach((b) => b.addEventListener('click', async () => {
  try { take(await (await fetch(b.dataset.src)).blob()); }
  catch { window.rkToast?.('Could not load that sample'); }
}));
