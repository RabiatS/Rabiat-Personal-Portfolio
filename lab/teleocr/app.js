// TeleOCR: a photo of a page in, its text out, written as the model reads.
// The model runs in the Lab worker (adapter.js). Text streams back over a
// BroadcastChannel, since lab.run only answers once the whole read is done.
import { mountLab, veil } from '../frame/frame.js';
import { smartResize } from './pil_resize.js';

const $ = (id) => document.getElementById(id);
const CHANNEL = 'rabiat-lab-teleocr';
const MAX_PIXELS = 1600 * 28 * 28;   // same cap as the adapter, for the token grid
const MAX_DECODE = 4096 * 4096;      // larger photos are shrunk on a canvas before anything else

const lab = await mountLab({
  slug: 'teleocr',
  adapter: new URL('./adapter.js', import.meta.url).href,
  gate: $('gate'), stats: $('labStats'), verb: 'read your first photo',
});


// ---------- a photo in ----------
// Decoded like Pillow sees it: no colour management, no premultiplied alpha.
async function decode(blob) {
  try { return await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none', imageOrientation: 'from-image' }); }
  catch { return createImageBitmap(blob); }
}
function pixels(bitmap) {
  const k = Math.min(1, Math.sqrt(MAX_DECODE / (bitmap.width * bitmap.height)));
  const w = Math.max(1, Math.round(bitmap.width * k)), h = Math.max(1, Math.round(bitmap.height * k));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); // transparent screenshots read as ink on paper
  ctx.drawImage(bitmap, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const rgb = new Uint8ClampedArray(w * h * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) { rgb[j] = rgba[i]; rgb[j + 1] = rgba[i + 1]; rgb[j + 2] = rgba[i + 2]; }
  return { rgb, w, h };
}

let photo = null, photoUrl = null;
async function take(blob, task = 'text') {
  if (lab.state === 'blocked' || !blob) return;
  let bitmap;
  try { bitmap = await decode(blob); }
  catch {
    window.rkToast?.(/hei[cf]/i.test(blob.type || '') ? 'This browser cannot open HEIC. Try a JPEG' : "That file isn't a photo I can read");
    return;
  }
  photo = pixels(bitmap);
  bitmap.close?.();
  const [h2, w2] = smartResize(photo.h, photo.w, 28, 3136, MAX_PIXELS);
  photo.tokens = (w2 / 28) * (h2 / 28);
  $('pic').style.setProperty('--cols', w2 / 28);
  $('pic').style.setProperty('--rows', h2 / 28);
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = URL.createObjectURL(blob);
  $('img').src = photoUrl;
  document.body.classList.add('has-photo');
  scrollTo({ top: 0 });
  read(task);
}

// ---------- reading ----------
const bc = new BroadcastChannel(CHANNEL);
let running = null;   // { id, promise }
let token = 0;
let task = 'text';
let chosen = 'text';  // the mode last picked by hand; new photos are read this way
let raw = '';

bc.onmessage = (e) => {
  const m = e.data;
  if (!running || running.stopping || m?.id !== running.id) return;
  if (m.firstMs != null) writing();
  if (m.text) { raw += m.text; show(m.text); }
  // Asked for text, the model sometimes starts writing table cells instead. It
  // reads tables far better when asked for one, so switch.
  if (task === 'text' && /<(fcel|ecel|lcel|ucel|xcel|nl)>/.test(raw)) {
    window.rkToast?.('That looks like a table. Reading it as one');
    read('table');
  }
};

async function stopCurrent() {
  if (!running) return;
  running.stopping = true;   // a new read takes over: ignore what this one still sends
  bc.postMessage({ id: running.id, stop: true });
  try { await running.promise; } catch {}
}

async function read(nextTask) {
  if (!photo) return;
  const t = ++token;
  setMode(nextTask);
  await stopCurrent();
  if (t !== token) return;
  reset();
  document.body.classList.add('looking');
  status(`Looking at ${photo.tokens} image tokens`);
  $('stop').hidden = false;
  const id = crypto.randomUUID?.() ?? String(Math.random()).slice(2);
  const rgb = photo.rgb.slice();
  let res = null;
  try {
    await lab.ensure();
    if (t !== token) return;
    running = { id, promise: lab.run({ rgb, w: photo.w, h: photo.h, task, channel: CHANNEL, id }, [rgb.buffer]) };
    res = await running.promise;
  } catch (err) {
    if (t === token) veil('That did not work', null, err?.message || String(err), { label: 'Close', onClick: () => veil(null) });
  } finally {
    if (running?.id === id) running = null;
    if (t === token) { document.body.classList.remove('looking'); $('out').classList.remove('writing'); $('stop').hidden = true; }
  }
  if (!res || t !== token) return;
  finish(res.output, res.ms);
}

function writing() {
  document.body.classList.remove('looking');
  $('out').classList.add('writing');
  status('');
}

// ---------- output, per task ----------
function reset() {
  raw = ''; born.length = 0;
  const out = $('out');
  out.replaceChildren();
  out.className = `out ${task}`;
  status('');
}

function show(chunk) {
  const out = $('out');
  if (task === 'table') { drawTable(out, raw, true); return; }
  const s = document.createElement('span');
  s.className = 'new';
  s.textContent = chunk;
  out.append(s);
}

function finish(o, ms) {
  const out = $('out');
  raw = o.text;
  if (task === 'table') drawTable(out, raw, false);
  else out.textContent = raw; // one text node: the streamed spans were only for the fade
  if (!raw.trim()) out.innerHTML = '<span class="wait">I could not find anything to read here.</span>';
  const secs = (x) => `${(x / 1000).toFixed(x < 10000 ? 1 : 0)} s`;
  const rate = o.tokens > 1 && o.decodeMs > 0 ? (o.tokens - 1) / (o.decodeMs / 1000) : 0;
  const note = o.stopped ? ' · stopped' : o.capped ? ' · stopped at the length limit' : '';
  status(`${secs(ms)} · ${o.tokens} tokens${note}`,
    `Looked at ${o.imageTokens} image tokens (${o.size[0]} × ${o.size[1]}) for ${secs(o.firstMs)}, then wrote ${rate.toFixed(0)} tokens a second on ${lab.where}`);
  $('said').textContent = o.stopped ? 'Stopped reading' : 'Finished reading';
}

function status(text, title = '') {
  $('metaText').textContent = text;
  $('metaText').title = title;
}

// OTSL: a cell token starts each cell (<fcel> text, <ecel> empty), <lcel>, <ucel>
// and <xcel> merge into the cell left, above, or both, and <nl> ends a row.
const OTSL = /<(fcel|ecel|lcel|ucel|xcel|ched|rhed|srow|nl)>/g;
function parseOTSL(s, streaming) {
  if (streaming) s = s.replace(/<[a-z]{0,4}$/, ''); // a tag still arriving
  const rows = [[]];
  let cell = null, at = 0;
  for (const m of s.matchAll(OTSL)) {
    if (cell) cell.text += s.slice(at, m.index);
    at = m.index + m[0].length;
    if (m[1] === 'nl') { rows.push([]); cell = null; } else { cell = { tag: m[1], text: '' }; rows.at(-1).push(cell); }
  }
  if (cell) cell.text += s.slice(at);
  while (rows.length && !rows.at(-1).length) rows.pop();
  return rows;
}

const born = [];   // when each cell first appeared, so redraws keep its fade going
function drawTable(out, s, streaming) {
  const rows = parseOTSL(s, streaming);
  if (!rows.length) { // no cells (yet): show the words as they come
    out.textContent = streaming ? s.replace(/<[a-z]{0,4}$/, '') : s;
    return;
  }
  const cols = Math.max(...rows.map((r) => r.length));
  const at = (r, c) => rows[r]?.[c]?.tag;
  const merged = (t) => t === 'lcel' || t === 'ucel' || t === 'xcel';
  const table = document.createElement('table');
  const now = performance.now();
  let n = 0;
  rows.forEach((row, r) => {
    const tr = table.insertRow();
    if (r === 0 && rows.length > 1) tr.className = 'head';
    // Finished rows are padded to full width; the row still being written is not.
    const width = streaming && r === rows.length - 1 ? row.length : cols;
    for (let c = 0; c < width; c++) {
      const t = at(r, c) ?? 'ecel';
      if (merged(t)) continue;
      let cs = 1, rs = 1;
      while (c + cs < cols && (at(r, c + cs) === 'lcel' || at(r, c + cs) === 'xcel')) cs++;
      while (r + rs < rows.length && (at(r + rs, c) === 'ucel' || at(r + rs, c) === 'xcel')) rs++;
      const td = tr.insertCell();
      const text = (row[c]?.text || '').trim();
      td.textContent = text;
      if (cs > 1) td.colSpan = cs;
      if (rs > 1) td.rowSpan = rs;
      if (r > 0 && /^[\s$€£¥₦+\-]*\d[\d.,:%\s]*$/.test(text)) td.className = 'num';
      born[n] ??= now;
      const age = now - born[n++];
      if (age < 450) { td.classList.add('new'); td.style.animationDelay = `${-age}ms`; }
    }
  });
  out.replaceChildren(table);
}

function tableText() {
  const table = $('out').querySelector('table');
  if (!table) return null;
  // Tab-separated, with merged cells spread out, so it pastes into a spreadsheet.
  const grid = [];
  [...table.rows].forEach((tr, r) => {
    grid[r] ??= [];
    let c = 0;
    for (const td of tr.cells) {
      while (grid[r][c] !== undefined) c++;
      for (let i = 0; i < td.rowSpan; i++) for (let j = 0; j < td.colSpan; j++) {
        (grid[r + i] ??= [])[c + j] = i || j ? '' : td.textContent;
      }
      c += td.colSpan;
    }
  });
  return { tsv: grid.map((row) => [...row].map((x) => x ?? '').join('\t')).join('\n'), html: table.outerHTML };
}

// ---------- controls ----------
function setMode(next) {
  task = next;
  document.querySelectorAll('.mode').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.task === task));
    b.classList.toggle('is-selected', b.dataset.task === task);
  });
}
document.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => {
  chosen = b.dataset.task;
  if (b.dataset.task !== task || !running) read(b.dataset.task);
}));
$('stop').addEventListener('click', () => { if (running) bc.postMessage({ id: running.id, stop: true }); });
$('copy').addEventListener('click', async () => {
  const t = task === 'table' ? tableText() : null;
  const text = t ? t.tsv : $('out').textContent.trim();
  if (!text || running) { window.rkToast?.(running ? 'Still reading' : 'Nothing to copy yet'); return; }
  try {
    if (t && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([t.tsv], { type: 'text/plain' }), 'text/html': new Blob([t.html], { type: 'text/html' }) })]);
    } else await navigator.clipboard.writeText(text);
    window.rkToast?.('Copied');
  } catch { window.rkToast?.('Your browser blocked copying'); }
});

// ---------- ways in: pick, paste, drop, samples ----------
$('pick').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) take(f, chosen); e.target.value = ''; });
window.addEventListener('paste', (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
  if (item) { e.preventDefault(); take(item.getAsFile(), chosen); }
});
let depth = 0;
window.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) { depth++; document.body.classList.add('over'); } });
window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove('over'); });
window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault(); depth = 0; document.body.classList.remove('over');
  take([...e.dataTransfer.files].find((f) => f.type.startsWith('image/') || /\.hei[cf]$/i.test(f.name)), chosen);
});
document.querySelectorAll('.sample').forEach((b) => b.addEventListener('click', async () => {
  try { take(await (await fetch(b.dataset.src)).blob(), b.dataset.task); }
  catch { window.rkToast?.('Could not load that sample'); }
}));
