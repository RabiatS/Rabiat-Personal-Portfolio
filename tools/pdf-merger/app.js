// PDF Merger. pdf-lib does the merging; pdf.js (loaded lazily) draws first-page thumbnails.
const { PDFDocument } = window.PDFLib;
const $ = (id) => document.getElementById(id);
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/';

const docs = []; // { id, name, size, bytes, pages, error, range, thumb }
let nextId = 1;
let pdfjs = null;

const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

async function loadPdfjs() {
  if (pdfjs) return pdfjs;
  pdfjs = await import(`${PDFJS}pdf.min.mjs`);
  pdfjs.GlobalWorkerOptions.workerSrc = `${PDFJS}pdf.worker.min.mjs`;
  return pdfjs;
}

// "1-3, 5, 8-" -> zero-based page indices
function parseRange(text, count) {
  const t = (text || '').trim();
  if (!t) return [...Array(count).keys()];
  const out = [];
  for (const part of t.split(/[,\s]+/).filter(Boolean)) {
    const m = part.match(/^(\d*)-(\d*)$/);
    let a, b;
    if (m) { a = m[1] ? +m[1] : 1; b = m[2] ? +m[2] : count; }
    else if (/^\d+$/.test(part)) a = b = +part;
    else throw new Error(`"${part}" isn't a page`);
    if (a > b) [a, b] = [b, a];
    for (let p = Math.max(1, a); p <= Math.min(count, b); p++) out.push(p - 1);
  }
  if (!out.length) throw new Error('no pages in that range');
  return out;
}
const pickedCount = (d) => { if (d.error) return 0; try { return parseRange(d.range, d.pages).length; } catch { return 0; } };

async function addFiles(list) {
  const fresh = [];
  for (const f of list) {
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') continue;
    const d = { id: nextId++, name: f.name, size: f.size, bytes: null, pages: 0, error: '', range: '', thumb: null };
    docs.push(d); fresh.push(d);
    try {
      d.bytes = new Uint8Array(await f.arrayBuffer());
      d.pages = (await PDFDocument.load(d.bytes, { ignoreEncryption: true })).getPageCount();
    } catch { d.error = "Couldn't read this PDF"; }
  }
  if (!fresh.length) return;
  render();
  // thumbnails after first paint, one at a time
  try {
    const lib = await loadPdfjs();
    for (const d of fresh) {
      if (d.error) continue;
      try {
        const task = lib.getDocument({ data: d.bytes.slice() });
        const pdf = await task.promise;
        const page = await pdf.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        const scale = 360 / vp.width;
        const v = page.getViewport({ scale });
        const c = document.createElement('canvas');
        c.width = Math.round(v.width); c.height = Math.round(v.height);
        // 'print' intent renders without requestAnimationFrame, so thumbnails
        // still finish if the tab is in the background.
        await page.render({ canvasContext: c.getContext('2d'), viewport: v, canvas: c, intent: 'print' }).promise;
        d.thumb = c;
        task.destroy(); // pdf.js 6: destroy lives on the loading task, not the document
        const slot = document.querySelector(`.doc[data-id="${d.id}"] .thumb`);
        if (slot) { slot.innerHTML = ''; slot.appendChild(c); }
      } catch (err) { console.warn('thumbnail failed for', d.name, err); }
    }
  } catch (err) { console.warn('pdf.js unavailable, cards will show without thumbnails', err); }
}

function render() {
  const has = docs.length > 0;
  $('intake').hidden = has;
  $('work').hidden = !has;
  const grid = $('grid');
  grid.innerHTML = '';
  docs.forEach((d, i) => {
    const el = document.createElement('article');
    el.className = 'doc';
    el.draggable = true;
    el.dataset.id = d.id;
    el.innerHTML = `
      <div class="thumb${d.error ? ' bad' : ''}"></div>
      <span class="order">${i + 1}</span>
      <button class="remove" aria-label="Remove">✕</button>
      <div class="name"></div>
      <div class="meta"><span class="pages"></span><button class="range-btn"></button></div>`;
    el.querySelector('.name').textContent = d.name;
    el.querySelector('.name').title = d.name;
    const thumb = el.querySelector('.thumb');
    if (d.error) thumb.textContent = d.error;
    else if (d.thumb) thumb.appendChild(d.thumb);
    else thumb.innerHTML = '<span class="loading">page 1</span>';
    el.querySelector('.pages').textContent = d.error ? '' : `${d.pages} page${d.pages === 1 ? '' : 's'} · ${fmtSize(d.size)}`;
    const rb = el.querySelector('.range-btn');
    if (d.error) rb.hidden = true;
    else rb.textContent = d.range.trim() ? `pages ${d.range.trim()}` : 'All pages';
    rb.addEventListener('click', () => {
      rb.hidden = true;
      const inp = Object.assign(document.createElement('input'), { type: 'text', className: 'range-in', value: d.range, placeholder: 'e.g. 1-3, 5' });
      el.appendChild(inp);
      inp.focus();
      const commit = () => {
        try { parseRange(inp.value, d.pages); d.range = inp.value; render(); }
        catch (err) { inp.classList.add('bad'); inp.title = err.message; }
      };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') render(); });
      inp.addEventListener('blur', commit);
    });
    el.querySelector('.remove').addEventListener('click', () => { docs.splice(docs.indexOf(d), 1); render(); });
    grid.appendChild(el);
  });
  const add = document.createElement('label');
  add.className = 'add-tile';
  add.htmlFor = 'pick2';
  add.innerHTML = '<div><span>+</span>Add PDFs</div>';
  grid.appendChild(add);

  const usable = docs.filter((d) => !d.error);
  const pages = usable.reduce((n, d) => n + pickedCount(d), 0);
  $('sum').textContent = `${usable.length} file${usable.length === 1 ? '' : 's'} · ${pages} page${pages === 1 ? '' : 's'}`;
  $('merge').disabled = pages === 0;
}

// ---------- reorder by dragging ----------
let dragId = null;
const grid = $('grid');
grid.addEventListener('dragstart', (e) => {
  const el = e.target.closest('.doc'); if (!el) return;
  dragId = +el.dataset.id; el.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', 'reorder');
});
grid.addEventListener('dragend', () => { dragId = null; render(); });
const clearMarks = () => document.querySelectorAll('.doc').forEach((n) => n.classList.remove('before', 'after'));
grid.addEventListener('dragover', (e) => {
  if (dragId == null) return;
  e.preventDefault();
  const el = e.target.closest('.doc'); clearMarks(); if (!el) return;
  const r = el.getBoundingClientRect();
  el.classList.add(e.clientX < r.left + r.width / 2 ? 'before' : 'after');
});
grid.addEventListener('drop', (e) => {
  if (dragId == null) return;
  e.preventDefault(); e.stopPropagation();
  const el = e.target.closest('.doc');
  const from = docs.findIndex((d) => d.id === dragId);
  const [moved] = docs.splice(from, 1);
  if (el && +el.dataset.id !== moved.id) {
    let to = docs.findIndex((d) => d.id === +el.dataset.id);
    const r = el.getBoundingClientRect();
    if (e.clientX >= r.left + r.width / 2) to += 1;
    docs.splice(to, 0, moved);
  } else docs.splice(from, 0, moved);
  dragId = null; render();
});

// ---------- files in ----------
// copy first: clearing the input empties the live FileList while we are still reading it
$('pick').addEventListener('change', (e) => { addFiles([...e.target.files]); e.target.value = ''; });
$('pick2').addEventListener('change', (e) => { addFiles([...e.target.files]); e.target.value = ''; });
let depth = 0;
const target = () => (docs.length ? $('grid') : $('intake'));
window.addEventListener('dragenter', (e) => { if (dragId == null && e.dataTransfer?.types?.includes('Files')) { depth++; target().classList.add('over'); } });
window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) { $('grid').classList.remove('over'); $('intake').classList.remove('over'); } });
window.addEventListener('dragover', (e) => { if (dragId == null && e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  if (dragId != null || !e.dataTransfer?.files?.length) return;
  e.preventDefault(); depth = 0; $('grid').classList.remove('over'); $('intake').classList.remove('over');
  addFiles([...e.dataTransfer.files]);
});

$('sort').addEventListener('click', () => { docs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })); render(); });
$('clear').addEventListener('click', () => { docs.length = 0; render(); });

// ---------- merge ----------
$('merge').addEventListener('click', async () => {
  const btn = $('merge');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Merging';
  try {
    const out = await PDFDocument.create();
    for (const d of docs) {
      if (d.error) continue;
      const src = await PDFDocument.load(d.bytes, { ignoreEncryption: true });
      (await out.copyPages(src, parseRange(d.range, d.pages))).forEach((p) => out.addPage(p));
    }
    const bytes = await out.save();
    const name = ($('outName').value.trim() || 'merged').replace(/\.pdf$/i, '') + '.pdf';
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    window.rkToast?.(`Saved ${name} · ${out.getPageCount()} pages`);
  } catch (err) {
    window.rkToast?.(`Merge failed: ${err.message || err}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Merge';
  }
});

render();
