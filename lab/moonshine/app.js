// Moonshine: talk, and the words appear as you say them. Audio is cut into
// phrases by loudness; while a phrase is still going it is re-transcribed every
// half second or so, and when you pause it is transcribed once more and settles.
import { mountLab, veil } from '../frame/frame.js';
import { SAMPLES, sample, sampleUrl } from '../samples/samples.js';
// Clean readings first; then radio from the Moon, which is much harder.
const PLAYLIST = [...SAMPLES.filter((s) => s.kind === 'reading'), sample('apollo11-eagle.m4a')];

const $ = (id) => document.getElementById(id);
const RATE = 16000, FRAME = 512, FRAME_MS = (FRAME / RATE) * 1000;

const lab = await mountLab({
  slug: 'moonshine',
  adapter: new URL('./adapter.js', import.meta.url).href,
  gate: $('gate'), stats: $('labStats'), verb: 'start',
});

// ---------- audio in ----------
let ctx = null, node = null, mic = null, micSrc = null, sampleSrc = null;
// Safari only unlocks audio inside the click itself, before any await.
function unlockAudio() {
  ctx ??= new AudioContext();
  ctx.resume();
}
async function graph() {
  if (node) return;
  await ctx.audioWorklet.addModule(new URL('./capture.worklet.js', import.meta.url));
  node = new AudioWorkletNode(ctx, 'capture-16k');
  node.port.onmessage = (e) => onFrame(e.data);
  const mute = ctx.createGain(); mute.gain.value = 0;
  node.connect(mute).connect(ctx.destination); // keeps the worklet pulled
}

async function startMic() {
  unlockAudio();
  stopSample();
  try {
    await lab.ensure();
    await graph();
    mic = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (err) {
    if (err?.name === 'NotAllowedError' || err?.name === 'NotFoundError') window.rkToast?.('The mic is off for this page. Try the sample');
    return;
  }
  micSrc = ctx.createMediaStreamSource(mic);
  micSrc.connect(node);
  setListening(true);
}
function stopMic() {
  micSrc?.disconnect(); micSrc = null;
  mic?.getTracks().forEach((t) => t.stop()); mic = null;
  if (speaking) end();
  setListening(false);
}

// Each press plays the next NASA clip; a file of your own plays the same way.
const buffers = new Map();
let nextSample = 0;
async function playSample(file) {
  unlockAudio();
  if (mic) stopMic();
  stopSample();
  await lab.ensure();
  await graph();
  let buf, label;
  if (file instanceof Blob) {
    try { buf = await ctx.decodeAudioData(await file.arrayBuffer()); }
    catch { window.rkToast?.("That file isn't audio I can read"); return; }
    label = file.name.replace(/\.[^.]+$/, '');
  } else {
    const clip = PLAYLIST[nextSample++ % PLAYLIST.length];
    if (!buffers.has(clip.file)) buffers.set(clip.file, await ctx.decodeAudioData(await (await fetch(sampleUrl(clip))).arrayBuffer()));
    buf = buffers.get(clip.file);
    label = clip.label;
  }
  window.rkToast?.(`Playing: ${label}`);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(node); src.connect(ctx.destination);
  src.onended = () => { if (sampleSrc === src) { sampleSrc = null; if (speaking) end(); setListening(false); } };
  sampleSrc = src;
  src.start();
  setListening(true, true);
}
function stopSample() {
  if (!sampleSrc) return;
  const s = sampleSrc; sampleSrc = null;
  try { s.stop(); } catch {}
  if (speaking) end();
}

function setListening(on, sample = false) {
  document.body.classList.add('live');
  $('dock').hidden = false;
  $('start').textContent = on && !sample ? 'Stop' : 'Start';
  $('sample').textContent = on && sample ? 'Stop' : 'Sample';
  if (!on) $('level').style.width = '0%';
  if (on && !$('lines').children.length) hint(sample ? 'Listening to the clip' : 'Listening. Say something');
}

// ---------- phrases, by loudness ----------
// Adaptive floor: it follows the room when nobody is talking. A phrase starts
// 9 dB over the floor (held for 3 frames) and ends after 400 ms back under +5 dB.
let floor = -55, speaking = false, above = 0, below = 0, seg = [], preroll = [], segId = 0;
function onFrame(f) {
  let sum = 0;
  for (let i = 0; i < f.length; i++) sum += f[i] * f[i];
  const db = 10 * Math.log10(sum / f.length + 1e-12);
  $('level').style.width = `${Math.max(0, Math.min(100, ((db + 60) / 50) * 100))}%`;
  if (!speaking) {
    preroll.push(f); if (preroll.length > 7) preroll.shift(); // about 200 ms before the start
    if (db > floor + 9) {
      if (++above >= 3) { speaking = true; seg = preroll; preroll = []; below = 0; segId++; lastLive = 0; }
    } else {
      above = 0;
      floor = Math.min(-30, Math.max(-75, floor + (db - floor) * (db < floor ? 0.3 : 0.02)));
    }
  } else {
    seg.push(f);
    below = db < floor + 5 ? below + 1 : 0;
    if (below * FRAME_MS >= 400 || seg.length * FRAME_MS >= 15000) end();
    else tick();
  }
}
const joined = (frames) => { const a = new Float32Array(frames.length * FRAME); frames.forEach((f, i) => a.set(f, i * FRAME)); return a; };

function end() {
  speaking = false; above = below = 0;
  const audio = joined(seg); seg = [];
  if (audio.length < 0.25 * RATE) { dropLine(segId); return; }
  finals.push({ id: segId, audio });
  lineFor(segId).classList.add('waiting');
  pump();
}

// ---------- transcription: finals first, live passes only when idle ----------
let busy = false, lastMs = 400, lastLive = 0;
const finals = [];
function tick() {
  const every = Math.max(lab.variant?.tier === 'gpu' ? 500 : 1000, 1.5 * lastMs);
  const now = performance.now();
  if (busy || finals.length || now - lastLive < every || seg.length * FRAME_MS < 300) return;
  lastLive = now;
  const id = segId;
  busy = true;
  lab.run({ audio: joined(seg) }).then(({ output, ms }) => {
    lastMs = ms;
    if (id === segId && speaking) show(lineFor(id), tidy(output.text));
  }).catch(() => {}).finally(() => { busy = false; pump(); });
}
function pump() {
  if (busy || !finals.length) return;
  const { id, audio } = finals.shift();
  busy = true;
  lab.run({ audio }).then(({ output, ms }) => {
    lastMs = ms;
    const text = tidy(output.text);
    if (!text) { dropLine(id); return; }
    const li = lineFor(id);
    show(li, text);
    li.classList.remove('live', 'waiting');
    const t = document.createElement('span');
    t.className = 'ms'; t.textContent = `${(ms / 1000).toFixed(2)} s`;
    t.title = `Transcribed in ${(ms / 1000).toFixed(2)} s on ${lab.where}`;
    li.append(t);
    $('said').textContent = text;
  }).catch((err) => { dropLine(id); veil('That did not work', null, err.message, { label: 'Close', onClick: () => veil(null) }); })
    .finally(() => { busy = false; pump(); });
}

// Moonshine can loop on a phrase; keep at most two repeats of any 1 to 4 word run.
function tidy(text) {
  let w = (text || '').split(/\s+/).filter(Boolean);
  for (let n = 1; n <= 4; n++) {
    const out = [];
    for (const word of w) {
      out.push(word);
      const same = () => {
        const L = out.length;
        for (let k = 0; k < n; k++) if (out[L - 1 - k] !== out[L - 1 - k - n] || out[L - 1 - k] !== out[L - 1 - k - 2 * n]) return false;
        return true;
      };
      while (out.length >= 3 * n && same()) out.splice(out.length - n, n);
    }
    w = out;
  }
  return w.join(' ');
}

// ---------- lines ----------
const lines = new Map();
function hint(text) {
  if ($('lines').querySelector('.hint')) return;
  const h = document.createElement('li'); h.className = 'hint'; h.textContent = text;
  $('lines').append(h);
}
function lineFor(id) {
  if (!lines.has(id)) {
    $('lines').querySelector('.hint')?.remove();
    const li = document.createElement('li');
    li.className = 'line live';
    $('lines').append(li);
    lines.set(id, li);
  }
  return lines.get(id);
}
function dropLine(id) { lines.get(id)?.remove(); lines.delete(id); }

// Keep the words that didn't change; new ones fade in.
function show(li, text) {
  const stick = innerHeight + scrollY >= document.documentElement.scrollHeight - 80;
  const old = [...li.querySelectorAll('.w')].map((s) => s.textContent);
  const words = text.split(' ');
  let same = 0;
  while (same < old.length && same < words.length && old[same] === words[same]) same++;
  li.querySelectorAll('.w').forEach((s, i) => { if (i >= same) s.remove(); });
  li.querySelectorAll('.w').forEach((s) => s.classList.remove('new'));
  const before = li.querySelector('.ms');
  words.slice(same).forEach((word, i) => {
    const s = document.createElement('span');
    s.className = 'w new';
    s.style.animationDelay = `${i * 40}ms`;
    s.addEventListener('animationend', () => s.classList.remove('new'), { once: true });
    s.textContent = word;
    li.insertBefore(s, before);
    li.insertBefore(document.createTextNode(' '), before);
  });
  // tidy stray spaces left by removed words
  [...li.childNodes].forEach((n, i, all) => { if (n.nodeType === 3 && (i === 0 || all[i - 1].nodeType === 3)) n.remove(); });
  if (stick) li.scrollIntoView({ block: 'nearest' }); // only moves when the line would sit under the dock
}

// ---------- controls ----------
$('startBig').addEventListener('click', startMic);
$('sampleBig').addEventListener('click', () => playSample());
$('file').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) playSample(f); });
window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith('audio/') || x.type.startsWith('video/'));
  if (!f) return;
  e.preventDefault(); playSample(f);
});
$('start').addEventListener('click', () => (mic ? stopMic() : startMic()));
$('sample').addEventListener('click', () => (sampleSrc ? (stopSample(), setListening(false)) : playSample()));
$('copy').addEventListener('click', async () => {
  const text = [...$('lines').querySelectorAll('.line:not(.live)')].map((li) => [...li.querySelectorAll('.w')].map((w) => w.textContent).join(' ')).join('\n');
  if (!text) { window.rkToast?.('Nothing to copy yet'); return; }
  try { await navigator.clipboard.writeText(text); window.rkToast?.('Copied'); } catch { window.rkToast?.('Your browser blocked copying'); }
});
$('clear').addEventListener('click', () => {
  $('lines').replaceChildren(); lines.clear();
  if (mic || sampleSrc) hint('Listening');
});
