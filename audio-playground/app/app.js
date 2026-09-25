import WaveSurfer from './vendor/wavesurfer.esm.js';
import RegionsPlugin from './vendor/regions.esm.js';
import TimelinePlugin from './vendor/timeline.esm.js';
import { MODELS } from './config.js';

const $ = (id) => document.getElementById(id);
// 44.1 kHz so decoded files are already at the rate the models expect.
const audioCtx = new AudioContext({ sampleRate: 44100 });
const FADE_SEC = 0.005; // tiny fade at every join so cuts don't click
const MAX_UNDO = 30;

const STEM_COLORS = {
  vocals: '#F05454', instrumental: '#5EEAD4', drums: '#5EEAD4', bass: '#E8E8E3',
  guitar: '#E9A23B', piano: '#A78BFA', other: '#7A7A75',
  low: '#D62828', mid: '#E8E8E3', high: '#5EEAD4',
};

// ---------- State ----------
let buffer = null;          // current AudioBuffer in the editor
let fileName = 'audio';
let originalFile = null;    // the untouched upload, sent to the separator if no edits were made
let edited = false;
const undoStack = [];
const redoStack = [];
let selection = null;       // wavesurfer Region
let objectUrl = null;

// ---------- Helpers ----------
const fmt = (t) => {
  if (!isFinite(t)) t = 0;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
};
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

function encodeWav(buf) {
  const ch = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length;
  const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
  out.setUint16(22, ch, true); out.setUint32(24, sr, true);
  out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  w(36, 'data'); out.setUint32(40, len * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([out], { type: 'audio/wav' });
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// MP3 encoding happens in the browser (lamejs), loaded only when first needed.
let lamePromise;
function loadLame() {
  lamePromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@breezystack/lamejs@1.2.7/dist/lamejs.iife.js';
    s.onload = () => resolve(window.lamejs);
    s.onerror = () => reject(new Error('Couldn\'t load the MP3 encoder (are you offline?)'));
    document.head.append(s);
  });
  return lamePromise;
}

async function bufferToMp3(buf) {
  const lame = await loadLame();
  const enc = new lame.Mp3Encoder(2, buf.sampleRate, 256);
  const toI16 = (f) => { const o = new Int16Array(f.length); for (let i = 0; i < f.length; i++) { const v = Math.max(-1, Math.min(1, f[i])); o[i] = v < 0 ? v * 0x8000 : v * 0x7fff; } return o; };
  const l = toI16(buf.getChannelData(0)), r = toI16(buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0));
  const parts = [];
  for (let i = 0; i < l.length; i += 1152 * 64) {
    parts.push(enc.encodeBuffer(l.subarray(i, i + 1152 * 64), r.subarray(i, i + 1152 * 64)));
    if (i % (1152 * 64 * 40) === 0) await new Promise((res) => setTimeout(res));   // keep the page responsive
  }
  parts.push(enc.flush());
  return new Blob(parts, { type: 'audio/mpeg' });
}

// Mono envelope as alternating max/min per bucket, so wavesurfer draws it without re-decoding.
function computePeaks(buf) {
  const buckets = Math.max(2000, Math.ceil(buf.duration * 300));
  const step = buf.length / buckets;
  const chans = [...Array(buf.numberOfChannels)].map((_, c) => buf.getChannelData(c));
  const peaks = new Float32Array(buckets * 2);
  for (let b = 0; b < buckets; b++) {
    let max = 0, min = 0;
    const end = Math.min(buf.length, Math.floor((b + 1) * step));
    for (let i = Math.floor(b * step); i < end; i++) {
      let v = 0;
      for (const d of chans) v += d[i];
      v /= chans.length;
      if (v > max) max = v; else if (v < min) min = v;
    }
    peaks[b * 2] = max; peaks[b * 2 + 1] = min;
  }
  return [peaks];
}

// ---------- Audio editing ----------
function makeBuffer(ch, len, sr) {
  return new AudioBuffer({ numberOfChannels: ch, length: Math.max(1, len), sampleRate: sr });
}

function fade(arr, from, to, fadeIn) {
  const n = to - from;
  for (let i = 0; i < n; i++) arr[from + i] *= fadeIn ? i / n : 1 - i / n;
}

// Remove [s, e) seconds and join the two remaining pieces.
function cutRange(buf, s, e) {
  const sr = buf.sampleRate;
  const a = Math.max(0, Math.round(s * sr));
  const b = Math.min(buf.length, Math.round(e * sr));
  const out = makeBuffer(buf.numberOfChannels, buf.length - (b - a), sr);
  const f = Math.round(FADE_SEC * sr);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c), dst = out.getChannelData(c);
    dst.set(src.subarray(0, a), 0);
    dst.set(src.subarray(b), a);
    if (a > 0 && b < buf.length) {
      fade(dst, Math.max(0, a - f), a, false);
      fade(dst, a, Math.min(dst.length, a + f), true);
    }
  }
  return out;
}

// Keep only [s, e).
function trimRange(buf, s, e) {
  const sr = buf.sampleRate;
  const a = Math.max(0, Math.round(s * sr));
  const b = Math.min(buf.length, Math.round(e * sr));
  const out = makeBuffer(buf.numberOfChannels, b - a, sr);
  const f = Math.min(Math.round(FADE_SEC * sr), Math.floor((b - a) / 2));
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const dst = out.getChannelData(c);
    dst.set(buf.getChannelData(c).subarray(a, b));
    if (a > 0) fade(dst, 0, f, true);
    if (b < buf.length) fade(dst, dst.length - f, dst.length, false);
  }
  return out;
}

// ---------- Waveform editor ----------
const regions = RegionsPlugin.create();
const ws = WaveSurfer.create({
  container: '#waveform',
  height: 170,
  waveColor: cssVar('--wave'),
  progressColor: cssVar('--wave-progress'),
  cursorColor: cssVar('--text'),
  cursorWidth: 2,
  normalize: true,
  dragToSeek: false,
  autoScroll: true,
  plugins: [regions, TimelinePlugin.create({ height: 18, style: { color: cssVar('--muted'), fontSize: '11px' } })],
});

regions.enableDragSelection({ color: cssVar('--region') }, 3);

regions.on('region-created', (r) => {
  regions.getRegions().forEach((o) => o !== r && o.remove());
  selection = r;
  updateSelectionUI();
});
regions.on('region-updated', updateSelectionUI);
regions.on('region-removed', (r) => {
  if (r === selection) { selection = null; updateSelectionUI(); }
});

ws.on('timeupdate', (t) => ($('curTime').textContent = fmt(t)));
ws.on('play', () => { $('playBtn').textContent = '❚❚'; mixer.pause(); });
ws.on('pause', () => ($('playBtn').textContent = '▶'));
ws.on('finish', () => ($('playBtn').textContent = '▶'));

function renderEditor(keepTime = false) {
  const t = keepTime ? ws.getCurrentTime() : 0;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(encodeWav(buffer));
  regions.clearRegions();
  selection = null;
  ws.load(objectUrl, computePeaks(buffer), buffer.duration).then(() => {
    if (keepTime) ws.setTime(Math.min(t, buffer.duration));
  });
  $('durTime').textContent = fmt(buffer.duration);
  $('curTime').textContent = fmt(keepTime ? Math.min(t, buffer.duration) : 0);
  $('fileMeta').textContent = `${fileName} · ${fmt(buffer.duration)} · ${buffer.sampleRate / 1000} kHz · ${buffer.numberOfChannels === 1 ? 'mono' : 'stereo'}${edited ? ' · edited' : ''}`;
  updateSelectionUI();
  updateUndoUI();
}

function updateSelectionUI() {
  const has = !!selection;
  ['playSelBtn', 'cutBtn', 'trimBtn', 'clearSelBtn'].forEach((id) => ($(id).disabled = !has));
  if (has) {
    if (document.activeElement !== $('selStart')) $('selStart').value = selection.start.toFixed(2);
    if (document.activeElement !== $('selEnd')) $('selEnd').value = selection.end.toFixed(2);
    $('selLen').textContent = `${(selection.end - selection.start).toFixed(2)} s selected`;
  } else {
    $('selStart').value = '';
    $('selEnd').value = '';
    $('selLen').textContent = 'Nothing selected';
  }
}

function setSelectionFromInputs() {
  if (!buffer) return;
  let s = parseFloat($('selStart').value), e = parseFloat($('selEnd').value);
  if (isNaN(s) || isNaN(e)) return;
  s = Math.max(0, Math.min(s, buffer.duration));
  e = Math.max(0, Math.min(e, buffer.duration));
  if (e <= s) return;
  if (selection) selection.setOptions({ start: s, end: e });
  else regions.addRegion({ start: s, end: e, color: cssVar('--region') });
  updateSelectionUI();
}
$('selStart').addEventListener('change', setSelectionFromInputs);
$('selEnd').addEventListener('change', setSelectionFromInputs);

function applyEdit(newBuf) {
  undoStack.push(buffer);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
  buffer = newBuf;
  edited = true;
  renderEditor();
}

function updateUndoUI() {
  $('undoBtn').disabled = !undoStack.length;
  $('redoBtn').disabled = !redoStack.length;
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(buffer);
  buffer = undoStack.pop();
  renderEditor();
  toast('Undone');
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(buffer);
  buffer = redoStack.pop();
  renderEditor();
  toast('Redone');
}

function cutSelection() {
  if (!selection) return;
  const { start, end } = selection;
  if (end - start >= buffer.duration - 0.001) return toast("Can't cut everything");
  applyEdit(cutRange(buffer, start, end));
  toast(`Removed ${fmt(start)} – ${fmt(end)} and joined the rest`);
}
function trimSelection() {
  if (!selection) return;
  const { start, end } = selection;
  applyEdit(trimRange(buffer, start, end));
  toast(`Kept ${fmt(start)} – ${fmt(end)}`);
}

$('playBtn').onclick = () => ws.playPause();
$('playSelBtn').onclick = () => selection && selection.play();
$('cutBtn').onclick = cutSelection;
$('trimBtn').onclick = trimSelection;
$('clearSelBtn').onclick = () => regions.clearRegions();
$('undoBtn').onclick = undo;
$('redoBtn').onclick = redo;
$('zoom').oninput = (e) => ws.zoom(Number(e.target.value));

const baseName = () => fileName.replace(/\.[^.]+$/, '');
$('exportWav').onclick = () => download(encodeWav(buffer), `${baseName()}${edited ? '-edited' : ''}.wav`);
$('exportMp3').onclick = async () => {
  toast('Encoding MP3…');
  try { download(await bufferToMp3(buffer), `${baseName()}${edited ? '-edited' : ''}.mp3`); }
  catch (err) { toast(err.message); }
};

document.addEventListener('keydown', (e) => {
  if (!buffer || e.target.matches('input, textarea, select')) return;
  const mod = e.metaKey || e.ctrlKey;
  if (e.code === 'Space') { e.preventDefault(); ws.playPause(); }
  else if ((e.key === 'Backspace' || e.key === 'Delete') && selection) { e.preventDefault(); cutSelection(); }
  else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (e.key === 'Escape') regions.clearRegions();
});

// ---------- Loading files ----------
async function loadFile(file) {
  try {
    const decoded = await audioCtx.decodeAudioData(await file.arrayBuffer());
    loadBuffer(decoded, file.name, file);
  } catch {
    toast("Couldn't read that file. Try MP3, WAV, M4A or FLAC.");
  }
}

function loadBuffer(buf, name, file = null) {
  buffer = buf;
  fileName = name;
  originalFile = file;
  edited = false;
  undoStack.length = 0;
  redoStack.length = 0;
  $('dropzone').hidden = true;
  $('workspace').hidden = false;
  $('openBtn').hidden = false;
  $('zoom').value = 0;
  renderEditor();
}

$('sampleBtn').addEventListener('click', async (e) => {
  e.preventDefault(); // the button sits inside the file-picker label
  e.stopPropagation();
  const blob = await (await fetch('sample.mp3')).blob();
  loadFile(new File([blob], 'sample.mp3', { type: 'audio/mpeg' }));
});

for (const id of ['fileInput', 'fileInput2']) {
  $(id).addEventListener('change', (e) => { if (e.target.files[0]) loadFile(e.target.files[0]); e.target.value = ''; });
}
document.addEventListener('dragover', (e) => { e.preventDefault(); $('dropzone').classList.add('over'); });
document.addEventListener('dragleave', () => $('dropzone').classList.remove('over'));
document.addEventListener('drop', (e) => {
  e.preventDefault();
  $('dropzone').classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f) loadFile(f);
});

// ---------- Stem mixer ----------
const mixer = {
  tracks: [],
  sources: [],
  playing: false,
  startedAt: 0,
  offset: 0,
  raf: 0,
  get duration() { return Math.max(0, ...this.tracks.map((t) => t.buffer.duration)); },
  get time() { return this.playing ? Math.min(this.duration, audioCtx.currentTime - this.startedAt) : this.offset; },

  gainFor(t) {
    const anySolo = this.tracks.some((x) => x.solo);
    const audible = anySolo ? t.solo : !t.muted;
    return audible ? t.volume : 0;
  },
  refreshGains() {
    for (const t of this.tracks) {
      t.gain.gain.setTargetAtTime(this.gainFor(t), audioCtx.currentTime, 0.01);
      t.row.classList.toggle('silent', this.gainFor(t) === 0);
      t.row.querySelector('.solo').classList.toggle('on', t.solo);
      t.row.querySelector('.mute').classList.toggle('on', t.muted);
    }
  },
  play() {
    if (!this.tracks.length) return;
    audioCtx.resume();
    if (ws.isPlaying()) ws.pause();
    if (this.offset >= this.duration - 0.01) this.offset = 0;
    this.sources = this.tracks.map((t) => {
      const src = audioCtx.createBufferSource();
      src.buffer = t.buffer;
      src.connect(t.gain);
      src.start(0, Math.min(this.offset, t.buffer.duration));
      return src;
    });
    this.startedAt = audioCtx.currentTime - this.offset;
    this.playing = true;
    // Stop via the audio clock too, since rAF is paused in background tabs.
    const longest = this.sources.reduce((a, s) => (s.buffer.duration > a.buffer.duration ? s : a));
    longest.onended = () => {
      if (!this.playing || !this.sources.includes(longest)) return;
      this.pause(); this.offset = 0; this.drawPlayheads();
    };
    $('mixPlayBtn').textContent = '❚❚';
    const tick = () => {
      this.drawPlayheads();
      if (this.time >= this.duration) { this.pause(); this.offset = 0; this.drawPlayheads(); return; }
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  },
  pause() {
    if (!this.playing) return;
    this.offset = this.time;
    this.sources.forEach((s) => { try { s.stop(); } catch {} });
    this.sources = [];
    this.playing = false;
    cancelAnimationFrame(this.raf);
    $('mixPlayBtn').textContent = '▶';
  },
  seek(t) {
    const was = this.playing;
    this.pause();
    this.offset = Math.max(0, Math.min(t, this.duration));
    this.drawPlayheads();
    if (was) this.play();
  },
  drawPlayheads() {
    const t = this.time, d = this.duration || 1;
    for (const tr of this.tracks) tr.playhead.style.left = `${(t / d) * 100}%`;
    $('mixTime').textContent = `${fmt(t)} / ${fmt(this.duration)}`;
  },
  clear() {
    this.pause();
    this.offset = 0;
    this.tracks.forEach((t) => t.gain.disconnect());
    this.tracks = [];
    $('stems').innerHTML = '';
  },
};

function drawStemWave(canvas, buf, color) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d');
  g.fillStyle = color;
  const d = buf.getChannelData(0);
  const d2 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d;
  const step = d.length / w;
  let peak = 0;
  const cols = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let m = 0;
    const end = Math.min(d.length, Math.floor((x + 1) * step));
    for (let i = Math.floor(x * step); i < end; i += 4) {
      const v = Math.abs(d[i] + d2[i]) / 2;
      if (v > m) m = v;
    }
    cols[x] = m;
    if (m > peak) peak = m;
  }
  // Scale against a fixed reference so quiet stems look quiet (not auto-normalized).
  const scale = (h / 2) * 0.95;
  for (let x = 0; x < w; x++) {
    const bh = Math.max(dpr * 0.5, Math.min(1, cols[x]) * scale);
    g.fillRect(x, h / 2 - bh, 1, bh * 2);
  }
}

function addTrack({ name, buffer: buf, url }) {
  const color = STEM_COLORS[name] || '#8f8a80';
  const row = document.createElement('div');
  row.className = 'stem';
  row.innerHTML = `
    <div>
      <div class="stem-name"><span class="stem-dot" style="background:${color}"></span>${name}</div>
      <div class="stem-controls">
        <button class="btn sm toggle solo" title="Solo: hear only soloed stems">S</button>
        <button class="btn sm toggle mute" title="Mute">M</button>
        <input type="range" min="0" max="1.5" step="0.01" value="1" title="Volume">
      </div>
    </div>
    <div class="stem-wave"><canvas></canvas><div class="playhead"></div></div>
    <div class="stem-actions">
      <button class="btn sm listen" title="Play just this stem">▶ Only this</button>
      <button class="btn sm wav">WAV</button>
      <button class="btn sm mp3">MP3</button>
      <button class="btn sm edit" title="Open this stem in the editor">Edit</button>
    </div>`;
  $('stems').appendChild(row);

  const gain = audioCtx.createGain();
  gain.connect(audioCtx.destination);
  const t = { name, buffer: buf, url, gain, row, solo: false, muted: false, volume: 1, playhead: row.querySelector('.playhead') };
  mixer.tracks.push(t);

  requestAnimationFrame(() => drawStemWave(row.querySelector('canvas'), buf, color));
  row.querySelector('.stem-wave').onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mixer.seek(((e.clientX - r.left) / r.width) * mixer.duration);
  };
  row.querySelector('.solo').onclick = () => { t.solo = !t.solo; mixer.refreshGains(); };
  row.querySelector('.mute').onclick = () => { t.muted = !t.muted; mixer.refreshGains(); };
  row.querySelector('input[type=range]').oninput = (e) => { t.volume = Number(e.target.value); mixer.refreshGains(); };
  row.querySelector('.listen').onclick = () => {
    mixer.tracks.forEach((x) => (x.solo = x === t));
    mixer.refreshGains();
    if (!mixer.playing) mixer.play();
  };
  const stemFile = `${baseName()}-${name}`;
  t.fileBase = stemFile;
  row.querySelector('.wav').onclick = () => download(encodeWav(buf), `${stemFile}.wav`);
  row.querySelector('.mp3').onclick = async () => {
    toast('Encoding MP3…');
    try { download(await stemMp3(t), `${stemFile}.mp3`); } catch (err) { toast(err.message); }
  };
  row.querySelector('.edit').onclick = () => {
    mixer.pause();
    undoStack.push(buffer);
    redoStack.length = 0;
    buffer = buf;
    fileName = `${stemFile}.wav`;
    edited = true;
    renderEditor();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast(`Editing the ${name} stem · Undo to go back`);
  };
  mixer.refreshGains();
}

function showStems(stems, sourceLabel) {
  mixer.clear();
  $('stemsCard').hidden = false;
  $('stemsSource').textContent = `· ${sourceLabel}`;
  stems.forEach(addTrack);
  mixer.drawPlayheads();
  $('stemsCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Download all / download mix ----------
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Minimal uncompressed ("stored") ZIP writer; audio doesn't compress much anyway.
async function makeZip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let offset = 0;
  for (const { name, blob } of files) {
    const data = new Uint8Array(await blob.arrayBuffer());
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true);
    local.setUint32(14, crc, true); local.setUint32(18, data.length, true); local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(local, nameBytes, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true);
    cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
    cd.setUint16(28, nameBytes.length, true); cd.setUint32(42, offset, true);
    central.push(cd, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

const stemMp3 = (t) => bufferToMp3(t.buffer);

async function downloadAllStems(format) {
  if (!mixer.tracks.length) return;
  toast(format === 'mp3' ? 'Encoding MP3s and zipping…' : 'Zipping…');
  try {
    const files = await Promise.all(mixer.tracks.map(async (t) => ({
      name: `${baseName()}-${t.name}.${format}`,
      blob: format === 'mp3' ? await stemMp3(t) : encodeWav(t.buffer),
    })));
    download(await makeZip(files), `${baseName()}-stems-${format}.zip`);
  } catch (err) { toast(err.message); }
}

// Render exactly what the mixer plays (solo/mute/volume) into one buffer.
async function renderMix() {
  const len = Math.max(...mixer.tracks.map((t) => t.buffer.length));
  const sr = mixer.tracks[0].buffer.sampleRate;
  const ctx = new OfflineAudioContext(2, len, sr);
  for (const t of mixer.tracks) {
    const g = mixer.gainFor(t);
    if (!g) continue;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = t.buffer; gain.gain.value = g;
    src.connect(gain).connect(ctx.destination);
    src.start();
  }
  return ctx.startRendering();
}

function mixName() {
  const audible = mixer.tracks.filter((t) => mixer.gainFor(t) > 0).map((t) => t.name);
  if (audible.length === mixer.tracks.length) return `${baseName()}-mix`;
  return `${baseName()}-${audible.join('+') || 'silence'}`;
}

async function downloadMix(format) {
  if (!mixer.tracks.length) return;
  if (!mixer.tracks.some((t) => mixer.gainFor(t) > 0)) return toast('Everything is muted');
  const mix = await renderMix();
  try { download(format === 'mp3' ? await bufferToMp3(mix) : encodeWav(mix), `${mixName()}.${format}`); }
  catch (err) { toast(err.message); }
}

$('zipWav').onclick = () => downloadAllStems('wav');
$('zipMp3').onclick = () => downloadAllStems('mp3');
$('mixWav').onclick = () => downloadMix('wav');
$('mixMp3').onclick = () => { toast('Encoding MP3…'); downloadMix('mp3'); };

$('mixPlayBtn').onclick = () => (mixer.playing ? mixer.pause() : mixer.play());
$('unsoloBtn').onclick = () => { mixer.tracks.forEach((t) => { t.solo = false; t.muted = false; }); mixer.refreshGains(); };
window.addEventListener('resize', () => mixer.tracks.forEach((t) =>
  drawStemWave(t.row.querySelector('canvas'), t.buffer, STEM_COLORS[t.name] || '#8f8a80')));


// ---------- AI separation (runs in this browser) ----------
// The model runs in a Web Worker so the page stays responsive. See separator.worker.js.
const worker = new Worker(new URL('./separator.worker.js', import.meta.url), { type: 'module' });
let nextId = 1;
const pending = new Map();
worker.onmessage = ({ data }) => {
  const p = pending.get(data.id);
  if (!p) return;
  if (data.type === 'progress') p.onProgress?.(data);
  else { pending.delete(data.id); data.type === 'done' ? p.resolve(data.result) : p.reject(new Error(data.message)); }
};
function call(cmd, args = {}, onProgress, transfer = []) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress });
    worker.postMessage({ id, cmd, ...args }, transfer);
  });
}

const cached = {};          // model id → downloaded on this device?
let device = { gpu: false, label: 'checking…' };
let busy = false;

async function checkDevice() {
  let gpu = false, name = '';
  try {
    const adapter = await navigator.gpu?.requestAdapter();
    gpu = !!adapter;
    name = adapter?.info?.description || adapter?.info?.vendor || '';
  } catch {}
  const mem = navigator.deviceMemory;       // Chrome/Edge only, rounded, capped at 8
  device = { gpu, label: gpu ? 'your GPU' : 'your CPU' };
  $('deviceCheck').innerHTML = (gpu
    ? `Your device: <b>GPU ready</b>${name ? ` (${name})` : ''}.`
    : `Your device: <b>no WebGPU</b>, so it runs on the CPU (slower). Chrome, Edge or Safari 26+ are fastest.`)
    + (mem && mem < 8 ? ` Only ${mem} GB of memory reported: try shorter songs.` : '');
  refreshStatusTag();
}

function refreshStatusTag() {
  $('statusText').textContent = busy ? `Separating on ${device.label}` : `In your browser · ${device.gpu ? 'WebGPU' : 'CPU'}`;
  $('statusTag').classList.toggle('busy', busy);
  $('statusTag').title = 'Processing happens on this device; nothing is uploaded';
}

function renderPresets() {
  const checked = document.querySelector('input[name=preset]:checked')?.value || MODELS[0].id;
  $('presets').innerHTML = MODELS.map((m) => `
    <label class="preset">
      <input type="radio" name="preset" value="${m.id}" ${m.id === checked ? 'checked' : ''}>
      <div><div class="p-label">${m.label}</div></div>
      <div class="p-meta" data-model="${m.model}">
        ${cached[m.model]
          ? `<span class="size ok">✓ ready</span><button type="button" class="btn ghost sm" data-remove="${m.model}">Remove</button>`
          : `<span class="size">${m.mb} MB</span><button type="button" class="btn sm" data-download="${m.model}">Download</button>`}
      </div>
    </label>`).join('');
  $('presets').querySelectorAll('[data-download]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); downloadModel(b.dataset.download); }));
  $('presets').querySelectorAll('[data-remove]').forEach((b) => (b.onclick = async (e) => {
    e.preventDefault();
    await call('delete', { model: b.dataset.remove });
    cached[b.dataset.remove] = false;
    renderPresets();
    toast('Model removed from this browser');
  }));
}

function showDownloadProgress(id, got, total) {
  const pct = total ? Math.round(got / total * 100) : 0;
  document.querySelectorAll(`.p-meta[data-model="${id}"]`).forEach((meta) => {
    meta.innerHTML = `<span class="size">${(got / 1e6).toFixed(0)} / ${(total / 1e6 || 0).toFixed(0)} MB</span><div class="dl-bar"><i style="width:${pct}%"></i></div>`;
  });
}

async function downloadModel(id) {
  try {
    navigator.storage?.persist?.();          // ask the browser not to evict the cache
    await call('download', { model: id }, (p) => showDownloadProgress(id, p.got, p.total));
    cached[id] = true;
    toast('Model saved on this device');
  } catch (err) {
    toast(err.message);
  }
  renderPresets();
}

async function initModels() {
  renderPresets();
  try { Object.assign(cached, await call('cached', { models: [...new Set(MODELS.map((m) => m.model))] })); } catch {}
  renderPresets();
  checkDevice();
}
initModels();

function setStatus(html, isError = false) {
  $('sepStatus').innerHTML = html;
  $('sepStatus').classList.toggle('error', isError);
  $('sepStatus').classList.remove('ok');
}

$('separateBtn').onclick = async () => {
  if (!buffer || busy) return;
  const model = MODELS.find((m) => m.id === document.querySelector('input[name=preset]:checked').value);
  busy = true; refreshStatusTag();
  $('separateBtn').disabled = true;
  const started = performance.now();
  let runStart = started;
  try {
    const left = buffer.getChannelData(0).slice();
    const right = (buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : buffer.getChannelData(0)).slice();
    setStatus('<span class="spinner"></span>Preparing…');
    const result = await call('separate', { model: model.model, left, right }, (p) => {
      if (p.phase === 'download') {
        showDownloadProgress(model.model, p.got, p.total);
        setStatus(`<span class="spinner"></span>Downloading model ${(p.got / 1e6).toFixed(0)} / ${(p.total / 1e6).toFixed(0)} MB (once only)`);
      } else if (p.phase === 'ready') {
        runStart = performance.now();
        cached[model.model] = true; renderPresets();
        setStatus(`<span class="spinner"></span>Separating on ${p.backend === 'webgpu' ? 'your GPU' : 'your CPU'}…`);
      } else if (p.phase === 'separate') {
        const secs = (performance.now() - runStart) / 1000;
        const eta = p.value > 0 ? secs / p.value - secs : 0;
        setStatus(`<span class="spinner"></span>Separating ${Math.round(p.value * 100)}% · ${secs.toFixed(0)}s${p.value > 0.05 && p.value < 1 ? ` · ~${Math.ceil(eta)}s left` : ''}`);
      }
    }, [left.buffer, right.buffer]);

    let parts = result.stems;
    if (model.merge) {
      // Vocals + instrumental: the instrumental is everything that isn't vocals, added back together.
      const vocals = parts.find((s) => s.name === 'vocals');
      const inst = { name: 'instrumental', left: new Float32Array(vocals.left.length), right: new Float32Array(vocals.right.length) };
      for (const s of parts) if (s !== vocals) for (let i = 0; i < inst.left.length; i++) { inst.left[i] += s.left[i]; inst.right[i] += s.right[i]; }
      parts = [vocals, inst];
    }
    const stems = parts.map((s) => {
      const b = new AudioBuffer({ numberOfChannels: 2, length: s.left.length, sampleRate: buffer.sampleRate });
      b.copyToChannel(s.left, 0); b.copyToChannel(s.right, 1);
      return { name: s.name, buffer: b };
    });
    showStems(stems, model.label);
    const secs = (performance.now() - runStart) / 1000;
    setStatus(`✓ Done in ${secs.toFixed(1)}s on ${result.backend === 'webgpu' ? 'your GPU' : 'your CPU'} · ${(buffer.duration / secs).toFixed(1)}× real time`);
    $('sepStatus').classList.add('ok');
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    busy = false; refreshStatusTag();
    $('separateBtn').disabled = false;
  }
};

// ---------- Frequency (EQ) split ----------
async function renderBand(buf, filters) {
  const ctx = new OfflineAudioContext(buf.numberOfChannels, buf.length, buf.sampleRate);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  let node = src;
  // Two cascaded 12 dB/oct Butterworth stages = 24 dB/oct Linkwitz-Riley-style crossover.
  for (const [type, freq] of filters) {
    for (let i = 0; i < 2; i++) {
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = Math.SQRT1_2;
      node.connect(f); node = f;
    }
  }
  node.connect(ctx.destination);
  src.start();
  return ctx.startRendering();
}

$('eqBtn').onclick = async () => {
  if (!buffer) return;
  const lo = Number($('xLow').value), hi = Number($('xHigh').value);
  if (!(lo > 0 && hi > lo)) return toast('The mid/high point must be above the low/mid point');
  $('eqBtn').disabled = true;
  try {
    const [low, mid, high] = await Promise.all([
      renderBand(buffer, [['lowpass', lo]]),
      renderBand(buffer, [['highpass', lo], ['lowpass', hi]]),
      renderBand(buffer, [['highpass', hi]]),
    ]);
    showStems([
      { name: 'low', buffer: low }, { name: 'mid', buffer: mid }, { name: 'high', buffer: high },
    ], `frequency split at ${lo} Hz / ${hi} Hz`);
  } finally {
    $('eqBtn').disabled = false;
  }
};

// ---------- "i" tips: hidden until the info button is clicked ----------
function closeInfos(except) {
  document.querySelectorAll('.info[aria-expanded="true"]').forEach((b) => {
    if (b === except) return;
    b.setAttribute('aria-expanded', 'false');
    document.getElementById(b.getAttribute('aria-controls')).hidden = true;
  });
}
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.info');
  if (e.target.closest('.info-pop')) return;
  closeInfos(btn);
  if (!btn) return;
  e.preventDefault();
  const open = btn.getAttribute('aria-expanded') !== 'true';
  btn.setAttribute('aria-expanded', String(open));
  document.getElementById(btn.getAttribute('aria-controls')).hidden = !open;
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeInfos(); });
