// Background Remover. Paste in, copy out. Inference runs in bg.worker.js.
const $ = (id) => document.getElementById(id);
const SIZE = 1024;          // model input
const MAX_SIDE = 5000;      // keep huge photos inside canvas and memory limits
const PRESETS = [
  { id: 'clear', label: 'Transparent' },
  { id: '#FFFFFF', label: 'White' },
  { id: '#000000', label: 'Black' },
  { id: '#F5F5F0', label: 'Bone' },
  { id: '#D62828', label: 'Red' },
  { id: '#5EEAD4', label: 'Teal' },
];

// ---------- worker ----------
const worker = new Worker(new URL('./bg.worker.js', import.meta.url), { type: 'module' });
let jobId = 0;
const jobs = new Map();
worker.onmessage = (e) => {
  const job = jobs.get(e.data.id);
  if (!job) return;
  if (e.data.type === 'progress') return job.onProgress(e.data);
  jobs.delete(e.data.id);
  e.data.type === 'done' ? job.resolve(e.data) : job.reject(new Error(e.data.message));
};
function runModel(rgba, onProgress) {
  return new Promise((resolve, reject) => {
    const id = ++jobId;
    jobs.set(id, { resolve, reject, onProgress });
    worker.postMessage({ id, type: 'run', rgba }, [rgba.buffer]);
  });
}

// ---------- state ----------
const state = { name: 'image', w: 0, h: 0, orig: null, alpha: null, bg: 'clear', custom: [43, 89, 195], edges: 40, busy: false, token: 0 };
const view = $('view'), vctx = view.getContext('2d', { willReadFrequently: true });
const origCanvas = $('orig'), octx = origCanvas.getContext('2d');

// ---------- intake ----------
async function take(blob, name) {
  if (!blob || !/^image\//.test(blob.type || 'image/')) return;
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) { window.rkToast?.("That file isn't an image I can read"); return; }
  const token = ++state.token;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  origCanvas.width = view.width = w;
  origCanvas.height = view.height = h;
  octx.drawImage(bitmap, 0, 0, w, h);
  Object.assign(state, { w, h, alpha: null, orig: octx.getImageData(0, 0, w, h), name: (name || 'image').replace(/\.[^.]+$/, '') });
  vctx.clearRect(0, 0, w, h);
  $('intake').hidden = true;
  $('work').hidden = false;
  fit();
  $('corner').textContent = `${w} × ${h}`;
  setOutputs(false);

  // model input: stretch to 1024 x 1024
  const small = new OffscreenCanvas(SIZE, SIZE);
  const sctx = small.getContext('2d');
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(bitmap, 0, 0, SIZE, SIZE);
  const rgba = new Uint8ClampedArray(sctx.getImageData(0, 0, SIZE, SIZE).data);

  veil('Removing the background', 0, '');
  try {
    const res = await runModel(rgba, (p) => {
      if (token !== state.token) return;
      if (p.phase === 'download') {
        const mb = (p.got / 1048576).toFixed(0), tot = p.total ? (p.total / 1048576).toFixed(0) : '…';
        veil('Getting the model, just this once', p.total ? p.got / p.total : 0, `${mb} of ${tot} MB · then it stays on your device`);
      } else if (p.phase === 'compile') veil('Preparing the model', 1, 'on your device');
      else if (p.phase === 'run') veil('Removing the background', 1, p.backend === 'gpu' ? 'on your GPU' : 'on your CPU, about 20 seconds');
    });
    if (token !== state.token) return; // a newer image arrived while this one ran
    state.alpha = upscale(res.mask, res.mw, res.mh, w, h);
    $('corner').textContent = `${w} × ${h} · ${(res.ms / 1000).toFixed(1)} s on your ${res.backend === 'gpu' ? 'GPU' : 'CPU'}`;
    veil(null);
    render();
    setOutputs(true);
  } catch (err) {
    veil('That did not work', 0, err.message);
  }
}

// Size both canvases to fit the stage here, not with CSS max-width/max-height:
// inside the stage's grid, Chrome (and Arc) grew the row to the photo's full
// height first, so tall phone photos showed only their top third.
const PAD = 36; // the .layer padding, both sides
function fit() {
  if (!state.w) return;
  const s = $('stage');
  const k = Math.min(1, (s.clientWidth - PAD) / state.w, (s.clientHeight - PAD) / state.h);
  const cw = `${Math.max(1, Math.floor(state.w * k))}px`, ch = `${Math.max(1, Math.floor(state.h * k))}px`;
  for (const c of [view, origCanvas]) { c.style.width = cw; c.style.height = ch; }
}
new ResizeObserver(fit).observe($('stage'));

function upscale(mask, mw, mh, w, h) {
  const small = new OffscreenCanvas(mw, mh);
  const sctx = small.getContext('2d');
  const img = sctx.createImageData(mw, mh);
  for (let i = 0; i < mask.length; i++) {
    const v = Math.round(Math.min(1, Math.max(0, mask[i])) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(img, 0, 0);
  const big = new OffscreenCanvas(w, h);
  const bctx = big.getContext('2d');
  bctx.imageSmoothingQuality = 'high';
  bctx.drawImage(small, 0, 0, w, h);
  const px = bctx.getImageData(0, 0, w, h).data;
  const alpha = new Uint8ClampedArray(w * h);
  for (let i = 0; i < alpha.length; i++) alpha[i] = px[i * 4];
  return alpha;
}

// ---------- compositing ----------
function edgeLut() {
  const k = state.edges / 100, lo = 0.45 * k, hi = 1 - lo, lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    let t = Math.min(1, Math.max(0, (v / 255 - lo) / (hi - lo)));
    lut[v] = Math.round(t * t * (3 - 2 * t) * 255);
  }
  return lut;
}
const bgRgb = () => state.bg === 'clear' ? null : state.bg === 'custom' ? state.custom : hexToRgb(state.bg);

function compose() {
  const { w, h, orig, alpha } = state;
  const out = new ImageData(w, h), s = orig.data, d = out.data, lut = edgeLut(), bg = bgRgb();
  for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
    const a = lut[alpha[i]];
    if (!bg) { d[p] = s[p]; d[p + 1] = s[p + 1]; d[p + 2] = s[p + 2]; d[p + 3] = a; }
    else {
      const t = a / 255, u = 1 - t;
      d[p] = s[p] * t + bg[0] * u; d[p + 1] = s[p + 1] * t + bg[1] * u; d[p + 2] = s[p + 2] * t + bg[2] * u; d[p + 3] = 255;
    }
  }
  return out;
}

let raf = 0;
function render() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    if (!state.alpha) return;
    vctx.putImageData(compose(), 0, 0);
    $('stage').classList.toggle('checker', state.bg === 'clear');
    refreshDragUrl();
  });
}

// ---------- output ----------
// Always draw the current result before exporting, so a pending frame can never be missed.
function flush() { cancelAnimationFrame(raf); if (state.alpha) vctx.putImageData(compose(), 0, 0); }
const pngBlob = () => { flush(); return new Promise((r) => view.toBlob(r, 'image/png')); };
function setOutputs(on) { $('copy').disabled = $('download').disabled = !on; }

async function copyResult() {
  if (!state.alpha) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob() })]);
    window.rkToast?.('Copied. Paste it anywhere');
  } catch {
    window.rkToast?.('Your browser blocked copying. Use Download');
  }
}
async function downloadResult() {
  const url = URL.createObjectURL(await pngBlob());
  const a = Object.assign(document.createElement('a'), { href: url, download: `${state.name}-no-background.png` });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
$('copy').addEventListener('click', copyResult);
$('download').addEventListener('click', downloadResult);

// Drag the result straight out of the page (Chrome reads DownloadURL).
let dragUrl = null, dragTimer = 0;
function refreshDragUrl() {
  clearTimeout(dragTimer);
  dragTimer = setTimeout(async () => {
    const blob = await pngBlob();
    if (dragUrl) URL.revokeObjectURL(dragUrl);
    dragUrl = URL.createObjectURL(blob);
  }, 400);
}
$('stage').addEventListener('dragstart', (e) => {
  if (!dragUrl || comparing) { e.preventDefault(); return; }
  e.dataTransfer.setData('DownloadURL', `image/png:${state.name}-no-background.png:${dragUrl}`);
  e.dataTransfer.setData('text/uri-list', dragUrl);
  e.dataTransfer.setDragImage(view, 20, 20);
});

// ---------- compare ----------
let comparing = false;
function setCompare(on) {
  comparing = on;
  $('stage').classList.toggle('comparing', on);
  $('stage').draggable = !on;
  $('divider').hidden = !on;
  $('compare').setAttribute('aria-pressed', String(on));
  $('compare').classList.toggle('is-selected', on);
}
$('compare').addEventListener('click', () => setCompare(!comparing));
function setCut(e) {
  const r = view.getBoundingClientRect(), s = $('stage').getBoundingClientRect();
  const x = Math.min(r.right, Math.max(r.left, e.clientX));
  $('stage').style.setProperty('--cut', `${((x - s.left) / s.width) * 100}%`);
}
$('stage').addEventListener('pointerdown', (e) => {
  if (!comparing) return;
  $('stage').setPointerCapture(e.pointerId);
  setCut(e);
  const move = (ev) => setCut(ev);
  const up = () => { $('stage').removeEventListener('pointermove', move); $('stage').removeEventListener('pointerup', up); };
  $('stage').addEventListener('pointermove', move);
  $('stage').addEventListener('pointerup', up);
});
// hold Space to peek at the original
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat && state.alpha && !/INPUT|TEXTAREA/.test(e.target.tagName)) {
    e.preventDefault(); $('stage').classList.add('peek');
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c' && state.alpha && !window.getSelection()?.toString() && !/INPUT|TEXTAREA/.test(e.target.tagName)) {
    e.preventDefault(); copyResult();
  }
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space') $('stage').classList.remove('peek'); });

// ---------- background swatches ----------
const hexToRgb = (hex) => { const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
const rgbToHex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

function selectBg(id) {
  state.bg = id;
  document.querySelectorAll('#swatches .sw').forEach((b) => {
    const on = b.dataset.bg === id;
    b.classList.toggle('is-selected', on);
    b.setAttribute('aria-checked', String(on));
  });
  render();
}
PRESETS.forEach((p) => {
  const b = document.createElement('button');
  b.className = `sw${p.id === 'clear' ? ' clear' : ''}`;
  if (p.id !== 'clear') b.style.background = p.id;
  b.dataset.bg = p.id; b.title = p.label; b.setAttribute('aria-label', p.label); b.setAttribute('role', 'radio');
  b.addEventListener('click', () => selectBg(p.id));
  $('swatches').appendChild(b);
});

// custom colour: RGB 0-255, hex, and an eyedropper where the browser has one
const picker = document.createElement('div');
picker.className = 'picker';
picker.innerHTML = `
  <button class="sw custom" data-bg="custom" role="radio" aria-label="Custom colour" title="Any colour"></button>
  <div class="pop" id="colorPop" hidden>
    <h4>Any colour</h4>
    <div class="rgb"><b class="r">R</b><input type="range" min="0" max="255" data-c="0"><input type="number" min="0" max="255" data-n="0"></div>
    <div class="rgb"><b class="g">G</b><input type="range" min="0" max="255" data-c="1"><input type="number" min="0" max="255" data-n="1"></div>
    <div class="rgb"><b class="b">B</b><input type="range" min="0" max="255" data-c="2"><input type="number" min="0" max="255" data-n="2"></div>
    <div class="hexrow"><span class="chip"></span><input type="text" maxlength="7" spellcheck="false" aria-label="Hex colour"><button class="btn sm" id="eyedrop" hidden>Pick from screen</button></div>
  </div>`;
$('swatches').appendChild(picker);
const pop = picker.querySelector('.pop'), customBtn = picker.querySelector('.sw');
function setCustom(rgb, fromHex) {
  state.custom = rgb.map((v) => Math.max(0, Math.min(255, Math.round(+v || 0))));
  pop.querySelectorAll('[data-c]').forEach((el) => { el.value = state.custom[el.dataset.c]; });
  pop.querySelectorAll('[data-n]').forEach((el) => { el.value = state.custom[el.dataset.n]; });
  const hex = rgbToHex(state.custom);
  if (!fromHex) pop.querySelector('input[type=text]').value = hex;
  pop.querySelector('.chip').style.background = hex;
  customBtn.style.setProperty('--c', hex);
  if (state.bg === 'custom') render();
}
customBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  selectBg('custom');
  pop.hidden = !pop.hidden;
});
pop.addEventListener('click', (e) => e.stopPropagation());
document.addEventListener('click', () => { pop.hidden = true; });
pop.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.c || t.dataset.n) { const v = [...state.custom]; v[t.dataset.c ?? t.dataset.n] = +t.value; setCustom(v); }
  else if (t.type === 'text') {
    const m = t.value.trim().replace('#', '').match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
    if (m) { let h = m[1]; if (h.length === 3) h = [...h].map((c) => c + c).join(''); setCustom(hexToRgb(h), true); }
  }
});
if ('EyeDropper' in window) {
  const eb = pop.querySelector('#eyedrop');
  eb.hidden = false;
  eb.addEventListener('click', async () => {
    try { const { sRGBHex } = await new window.EyeDropper().open(); setCustom(hexToRgb(sRGBHex)); } catch { /* cancelled */ }
  });
}

$('edges').addEventListener('input', (e) => { state.edges = +e.target.value; render(); });

// ---------- ways in: paste, drop, pick, sample ----------
window.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) { e.preventDefault(); take(item.getAsFile(), 'pasted-image'); }
});
let depth = 0;
window.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) { depth++; $('intake').classList.add('over'); } });
window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) $('intake').classList.remove('over'); });
window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault(); depth = 0; $('intake').classList.remove('over');
  const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'));
  if (f) take(f, f.name);
});
$('pick').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) take(f, f.name); e.target.value = ''; });
$('pick2').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) take(f, f.name); e.target.value = ''; });
$('sampleBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  const blob = await (await fetch('../../assets/img/projects/scooter-parental-control-ui.png')).blob();
  take(blob, 'scooter-app');
});

// ---------- veil ----------
function veil(msg, frac, sub) {
  if (msg == null) { $('veil').hidden = true; return; }
  $('veil').hidden = false;
  $('veilMsg').textContent = msg;
  $('veilBar').style.width = `${Math.round((frac || 0) * 100)}%`;
  $('veilSub').textContent = sub || '';
}

selectBg('clear');
setCustom(state.custom);
