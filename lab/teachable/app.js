// Teach by example: a few frames of each class, then every new frame goes to
// the class whose examples it sits closest to. SigLIP 2 (adapter.js, in the
// Lab worker) turns each 224 x 224 frame into 768 numbers; the examples, the
// comparing and the guessing all happen here, and nothing leaves the page.
import { mountLab, veil } from '../frame/frame.js';
import { practiceCamera, PROPS } from './practice.js';

const $ = (id) => document.getElementById(id);
const IN = 224, MAX_EXAMPLES = 60, CAPTURE_MS = 140, GUESS_MS = 90;
const SHARP = 6; // how strongly a closer match wins (a softmax over centred similarities)

const lab = await mountLab({
  slug: 'teachable',
  adapter: new URL('./adapter.js', import.meta.url).href,
  gate: $('gate'), stats: $('labStats'), verb: 'start',
});

// ---------- frames in ----------
const crop = document.createElement('canvas');
crop.width = crop.height = IN;
const cctx = crop.getContext('2d', { willReadFrequently: true });
const video = $('video');
const practice = practiceCamera($('practice'));
let source = null;   // 'camera' | 'practice' | null
let still = false;   // a dropped photo is on show instead of the live feed

// The middle square of whatever is showing, at the model's size.
function grab() {
  let src, w, h, mirror = false;
  if (source === 'camera') { src = video; w = video.videoWidth; h = video.videoHeight; mirror = true; }
  else if (source === 'practice') { practice.tick(); src = practice.canvas; w = h = src.width; }
  if (!src || !w) return null;
  const s = Math.min(w, h);
  cctx.save();
  if (mirror) { cctx.translate(IN, 0); cctx.scale(-1, 1); } // match the mirrored preview
  cctx.drawImage(src, (w - s) / 2, (h - s) / 2, s, s, 0, 0, IN, IN);
  cctx.restore();
  return crop;
}
function fromImage(bitmap) {
  const s = Math.min(bitmap.width, bitmap.height);
  cctx.drawImage(bitmap, (bitmap.width - s) / 2, (bitmap.height - s) / 2, s, s, 0, 0, IN, IN);
  return crop;
}

// One picture at a time through the model, whoever asks.
let queue = Promise.resolve();
function embed(canvas) {
  const rgba = canvas.getContext('2d').getImageData(0, 0, IN, IN).data;
  const p = queue.then(() => lab.run({ rgba, w: IN, h: IN }, [rgba.buffer]));
  queue = p.catch(() => {});
  return p.then((r) => r.output.e);
}

// ---------- classes ----------
const NAMES = ['Thumbs up', 'Open hand', 'Nothing'];
const classes = [];
let holding = null;

function addClass() {
  const i = classes.length;
  const node = $('clsTpl').content.firstElementChild.cloneNode(true);
  const c = { node, ex: [], name: NAMES[i], full: false };
  const name = node.querySelector('.cls-name');
  name.value = c.name;
  name.placeholder = NAMES[i];
  name.addEventListener('input', () => { c.name = name.value.trim() || NAMES[i]; drawBars(); hint(); });
  name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });

  const hold = node.querySelector('.hold');
  const start = (e) => {
    if (!source || still) { window.rkToast?.(source ? 'Press Live first' : 'Start a camera first, or drop photos here'); return; }
    holding = c; hold.setAttribute('aria-pressed', 'true');
    if (e.pointerId != null) try { hold.setPointerCapture(e.pointerId); } catch { /* not a live pointer */ }
  };
  const end = () => { if (holding === c) holding = null; hold.setAttribute('aria-pressed', 'false'); };
  hold.addEventListener('pointerdown', start);
  hold.addEventListener('pointerup', end);
  hold.addEventListener('pointercancel', end);
  hold.addEventListener('lostpointercapture', end);
  hold.addEventListener('contextmenu', (e) => e.preventDefault());
  hold.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); start(e); } });
  hold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') end(); });
  hold.addEventListener('blur', end);

  node.querySelector('.pick input').addEventListener('change', (e) => { teachPhotos(c, [...e.target.files]); e.target.value = ''; });
  node.querySelector('.clear').addEventListener('click', () => {
    if (!c.ex.length && i >= 2) { removeClass(c); return; }
    c.ex = []; c.full = false; space = null;
    node.querySelector('.thumbs').replaceChildren(empty());
    count(c); drawBars(); hint();
  });
  node.addEventListener('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); node.classList.add('over'); } });
  node.addEventListener('dragleave', () => node.classList.remove('over'));

  classes.push(c);
  $('classes').append(node);
  count(c);
  $('addClass').hidden = classes.length >= 3;
  drawBars(); hint();
  return c;
}
function removeClass(c) {
  classes.splice(classes.indexOf(c), 1); space = null; shown = null;
  c.node.remove();
  $('addClass').hidden = classes.length >= 3;
  drawBars(); hint();
}
const empty = () => Object.assign(document.createElement('span'), { className: 'empty', textContent: 'Drop photos here, or hold below' });
function count(c) {
  c.node.querySelector('.cls-n').textContent = c.ex.length === 1 ? '1 example' : `${c.ex.length} examples`;
  const clear = c.node.querySelector('.clear');
  clear.textContent = !c.ex.length && classes.indexOf(c) >= 2 ? 'Remove' : 'Clear';
  clear.hidden = !c.ex.length && classes.indexOf(c) < 2;
}

function addExample(c, e, picture) {
  if (!classes.includes(c)) return;
  if (c.ex.length >= MAX_EXAMPLES) {
    if (!c.full) { c.full = true; window.rkToast?.('That is plenty for this class'); }
    return;
  }
  c.ex.push(e); space = null;
  const th = document.createElement('canvas');
  th.width = th.height = 112;
  th.getContext('2d').drawImage(picture, 0, 0, 112, 112);
  th.className = 'new';
  th.addEventListener('animationend', () => th.classList.remove('new'), { once: true });
  const strip = c.node.querySelector('.thumbs');
  strip.querySelector('.empty')?.remove();
  strip.prepend(th);
  strip.scrollLeft = 0;
  count(c); drawBars(); hint();
  $('feed').classList.add('snap');
  clearTimeout(addExample.t);
  addExample.t = setTimeout(() => $('feed').classList.remove('snap'), 110);
}

async function teachPhotos(c, files) {
  files = files.filter((f) => f.type.startsWith('image/'));
  if (!files.length || lab.state === 'blocked') return;
  try {
    await lab.ensure();
    for (const f of files) {
      let bitmap;
      try { bitmap = await decode(f); } catch { window.rkToast?.("That file isn't a photo I can read"); continue; }
      const picture = fromImage(bitmap);
      const e = await embed(picture);
      addExample(c, e, picture);
    }
    if (source && !still) loop();
  } catch (err) { failed(err); }
}

// ---------- guessing ----------
// Every example of every class shares the room, the light, the person; the
// differences that matter are small. So take away the average of all the
// examples first, then compare directions (cosine similarity). Each class
// scores the mean of its three closest examples; a softmax turns the scores
// into the bars.
let space = null; // { mean, cls: centred examples per class }, rebuilt when examples change
let shown = null; // smoothed probabilities, one per class
function centre(e, mean) {
  const o = new Float32Array(e.length);
  let n = 0;
  for (let i = 0; i < e.length; i++) { o[i] = e[i] - mean[i]; n += o[i] * o[i]; }
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < o.length; i++) o[i] /= n;
  return o;
}
function rebuild() {
  const all = classes.flatMap((c) => c.ex), mean = new Float32Array(all[0]?.length || 0);
  for (const e of all) for (let i = 0; i < e.length; i++) mean[i] += e[i] / all.length;
  space = { mean, cls: classes.map((c) => c.ex.map((e) => centre(e, mean))) };
}
function guess(e, smooth = true) {
  const ready = classes.filter((c) => c.ex.length);
  if (ready.length < 2) { shown = null; showBars(null); return; }
  if (!space || space.cls.length !== classes.length) rebuild();
  const q = centre(e, space.mean);
  const scores = space.cls.map((list) => {
    if (!list.length) return -Infinity;
    const sims = list.map((x) => dot(x, q)).sort((a, b) => b - a).slice(0, 3);
    return sims.reduce((a, b) => a + b, 0) / sims.length;
  });
  const top = Math.max(...scores);
  const w = scores.map((v) => (Number.isFinite(v) ? Math.exp((v - top) * SHARP) : 0));
  const sum = w.reduce((a, b) => a + b, 0);
  const p = w.map((x) => x / sum);
  shown = smooth && shown?.length === p.length ? shown.map((v, i) => v * 0.35 + p[i] * 0.65) : p;
  showBars(shown);
}
const dot = (a, b) => { let v = 0; for (let i = 0; i < a.length; i++) v += a[i] * b[i]; return v; };

function drawBars() {
  $('bars').replaceChildren(...classes.map((c) => {
    const row = document.createElement('div');
    row.className = 'barrow';
    row.innerHTML = '<span class="nm"></span><span class="pc">·</span><span class="track"><i></i></span>';
    row.querySelector('.nm').textContent = c.name;
    return row;
  }));
  if (shown?.length === classes.length) showBars(shown); else showBars(null);
}
function showBars(p) {
  const rows = [...$('bars').children];
  const best = p ? p.indexOf(Math.max(...p)) : -1;
  rows.forEach((row, i) => {
    const v = p ? p[i] : 0;
    row.classList.toggle('best', i === best);
    row.querySelector('.pc').textContent = p ? `${Math.round(v * 100)}%` : '·';
    row.querySelector('.track i').style.width = `${(v * 100).toFixed(1)}%`;
  });
  const call = $('call');
  call.classList.toggle('on', best >= 0);
  if (best >= 0) { $('callName').textContent = classes[best].name; $('callPc').textContent = `${Math.round(p[best] * 100)}%`; }
}

// One line of help that follows where you are.
function hint() {
  const [a, b] = classes;
  const ready = classes.filter((c) => c.ex.length).length;
  let text = '';
  if (!source || still) text = ''; // the photo path needs no coaching
  else if (!a.ex.length && !b.ex.length) text = source === 'practice' ? `Hold “Hold to add” under ${a.name} for a second.` : `Show it ${a.name.toLowerCase()}, and hold “Hold to add” under it.`;
  else if (ready < 2) {
    const next = classes.find((c) => !c.ex.length);
    const prop = source === 'practice' ? PROPS.find((x) => x.key === (next === b ? 'hand' : 'none')) : null;
    text = prop ? `Now hold up ${prop.glyph || 'nothing'} and add it to ${next.name}.` : `Now show it something else, and add it to ${next.name}.`;
  } else text = source === 'practice' ? 'Switch what is held up, and watch it guess.' : 'Move around and watch it guess. Add more where it slips.';
  $('hint').textContent = text;
}

// ---------- the live loop ----------
let looping = false;
async function loop() {
  if (looping) return;
  looping = true;
  try {
    while (source && !still) {
      const t = performance.now();
      const target = holding;
      const picture = grab();
      if (!picture) { await wait(100); continue; }
      const e = await embed(picture);
      if (still || !source) break;
      if (target) addExample(target, e, picture);
      guess(e);
      await wait((target ? CAPTURE_MS : GUESS_MS) - (performance.now() - t));
    }
  } catch (err) { failed(err); }
  finally { looping = false; }
}
const wait = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

function failed(err) {
  veil('That did not work', null, err?.message || String(err), { label: 'Close', onClick: () => veil(null) });
}

// ---------- ways in ----------
function goLive(kind) {
  source = kind; still = false;
  document.body.classList.add('live');
  $('still').hidden = true; $('liveBtn').hidden = true;
  video.hidden = kind !== 'camera';
  $('practice').hidden = kind !== 'practice';
  $('props').hidden = kind !== 'practice';
  if (kind === 'practice') practice.start(); else practice.stop();
  hint();
  loop();
}

$('camBtn').addEventListener('click', async () => {
  if (lab.state === 'blocked') return;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  } catch {
    window.rkToast?.('The camera is off for this page. Try the practice camera');
    return;
  }
  try { await lab.ensure(); } catch (err) { stream.getTracks().forEach((t) => t.stop()); failed(err); return; }
  video.srcObject = stream;
  await video.play().catch(() => {});
  goLive('camera');
});
$('practiceBtn').addEventListener('click', async () => {
  if (lab.state === 'blocked') return;
  try { await lab.ensure(); } catch (err) { failed(err); return; }
  goLive('practice');
});

// What the practice camera's person holds up.
$('props').append(...PROPS.map((p) => {
  const b = document.createElement('button');
  b.className = 'btn';
  b.setAttribute('aria-label', `Hold up: ${p.label}`);
  if (p.glyph) b.append(Object.assign(document.createElement('span'), { className: 'em', textContent: p.glyph }));
  else b.textContent = p.label;
  b.dataset.key = p.key;
  b.addEventListener('click', () => { practice.hold(p.key); markProp(); });
  return b;
}));
function markProp() { $('props').querySelectorAll('.btn').forEach((b) => b.classList.toggle('is-selected', b.dataset.key === practice.holding)); }
markProp();

// A photo on the picture: test it. A photo on a class: teach it.
async function testPhoto(file) {
  if (!file || lab.state === 'blocked') return;
  let bitmap;
  try { bitmap = await decode(file); } catch { window.rkToast?.("That file isn't a photo I can read"); return; }
  try {
    await lab.ensure();
    still = true;
    document.body.classList.add('live');
    const img = $('still');
    if (img.src) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(file);
    img.hidden = false; video.hidden = true; $('practice').hidden = true; $('props').hidden = true;
    $('liveBtn').hidden = false;
    const e = await embed(fromImage(bitmap));
    if (!classes.filter((c) => c.ex.length).length) window.rkToast?.('Teach it first: add examples to two classes');
    guess(e, false);
  } catch (err) { failed(err); }
}
$('liveBtn').addEventListener('click', () => {
  $('still').hidden = true; $('liveBtn').hidden = true; still = false;
  if (source) goLive(source);
  else { document.body.classList.remove('live'); showBars(null); hint(); }
});

const hasFiles = (e) => e.dataTransfer?.types?.includes('Files');
window.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault();
  document.querySelectorAll('.cls.over').forEach((n) => n.classList.remove('over'));
  const files = [...e.dataTransfer.files];
  const card = e.target.closest?.('.cls');
  const c = card && classes.find((x) => x.node === card);
  if (c) teachPhotos(c, files);
  else if (e.target.closest?.('#feed')) testPhoto(files.find((f) => f.type.startsWith('image/')));
  else window.rkToast?.('Drop on a class to teach it, or on the picture to test it');
});
window.addEventListener('paste', (e) => {
  if (e.target.closest?.('input')) return;
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) { e.preventDefault(); testPhoto(item.getAsFile()); }
});

async function decode(blob) {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch { return createImageBitmap(blob); }
}

$('addClass').addEventListener('click', () => { addClass().node.querySelector('.cls-name').focus(); });
addClass(); addClass();
