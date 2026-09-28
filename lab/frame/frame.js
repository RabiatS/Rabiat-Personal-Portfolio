// The Lab frame: every model page mounts it once.
//
//   const lab = await mountLab({ slug, adapter, gate, stats, verb });
//   await lab.ensure();                       // downloads once, then compiles
//   const { output, ms } = await lab.run(input, transfer);
//
// Before anything downloads, the gate line says where the model runs and how
// big it is, or that it is too big for this device (and nothing is fetched).
// The first action on the page is the consent: pages call ensure() from it.

import { checkDevice, pickVariant, variantBytes, mb } from './device.js';
import { cachedState, forget, repoOf } from './cache.js';

const $el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

// ---------- veil ----------
let veilEl = null;
export function veil(msg, frac, sub, action) {
  if (!veilEl) {
    veilEl = $el('div', 'lab-veil');
    veilEl.innerHTML = '<div class="box"><div class="msg"></div><div class="bar"><i></i></div><div class="sub"></div><div class="act"></div></div>';
    veilEl.hidden = true;
    document.body.appendChild(veilEl);
  }
  if (msg == null) { veilEl.hidden = true; return; }
  veilEl.hidden = false;
  veilEl.querySelector('.msg').textContent = msg;
  const bar = veilEl.querySelector('.bar');
  bar.hidden = frac == null;
  bar.firstChild.style.width = `${Math.round((frac || 0) * 100)}%`;
  veilEl.querySelector('.sub').textContent = sub || '';
  const act = veilEl.querySelector('.act');
  act.replaceChildren();
  if (action) {
    const b = $el('button', 'btn primary', action.label);
    b.addEventListener('click', action.onClick);
    act.appendChild(b);
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const niceDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const secs = (ms) => `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
function dtypeLabel(d) {
  if (typeof d === 'string') return d;
  return Object.entries(d).filter(([k]) => k !== 'model')
    .map(([k, v]) => `${v} ${k.replace(/_model(_merged)?$/, '')}`).join(', ');
}

let catalogue = null;
export function loadCatalogue() {
  // Always revalidate (a 304 when unchanged), so sizes and variants never lag behind a model update.
  return (catalogue ??= fetch(new URL('../models.json', import.meta.url), { cache: 'no-cache' }).then((r) => r.json()));
}

export async function mountLab({ slug, adapter, gate, stats, verb = 'start' }) {
  const data = await loadCatalogue();
  const rt = data.runtime;
  const model = data.models.find((m) => m.slug === slug);
  const dev = await checkDevice();
  let { variant, needMB } = pickVariant(model, dev);
  const where = () => (variant.tier === 'gpu' ? 'your GPU' : 'your CPU');

  const lab = {
    model, device: dev, variant, state: variant ? 'idle' : 'blocked',
    times: { load: null, runs: [] },
    get where() { return where(); },
  };

  // ---------- gate ----------
  let cached = variant ? await cachedState(rt.cacheKey, model, variant) : null;
  const missingFileBytes = () => variant.files.filter((f) => !cached.files.has(f)).reduce((n, f) => n + model.files[f], 0);
  const toDownload = () => missingFileBytes() + (cached.runtime ? 0 : rt.transferBytes);
  function drawGate() {
    if (!gate) return;
    gate.replaceChildren();
    if (!variant) {
      gate.classList.add('blocked');
      gate.append($el('strong', null, 'Too big for this device.'),
        ` It needs about ${needMB} MB of memory to run, and this ${dev.phone ? 'phone' : 'browser'} has room for about ${dev.budgetMB} MB.${dev.phone ? ' Try it on a laptop.' : ''}`);
      return;
    }
    const need = toDownload();
    gate.textContent = lab.state === 'ready' || !need
      ? `Ready on this device · runs on ${where()}`
      : `Runs on ${where()} · ${mb(need)}, downloaded once when you ${verb}`;
  }
  drawGate();
  if (!variant) { document.body.classList.add('lab-blocked'); fillStats(); return lab; }

  // ---------- host: a worker, or the main thread where workers lack WebGPU ----------
  let host = null;
  let onMsg = null;
  const pending = new Map();
  let nextId = 0;
  function dispatch(msg) {
    if (msg.id != null && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      msg.type === 'result' ? p.resolve(msg) : p.reject(new Error(msg.message));
      return;
    }
    onMsg?.(msg);
  }
  async function makeHost(mainThread) {
    if (mainThread) {
      const { handle } = await import('./engine.js');
      return { post: (msg) => handle(msg, (m) => queueMicrotask(() => dispatch(m))) };
    }
    const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    w.onmessage = (e) => dispatch(e.data);
    w.onerror = (e) => dispatch({ type: 'error', code: 'failed', message: e.message || 'The model worker stopped' });
    return { post: (msg, transfer) => w.postMessage(msg, transfer || []), worker: w };
  }
  const dropHost = () => { host?.worker?.terminate(); host = null; };

  let loading = null;
  let quiet = false; // a cached model warming up in the background shows no veil
  lab.ensure = ({ background = false } = {}) => {
    if (lab.state === 'ready') return Promise.resolve();
    if (!background && quiet) { quiet = false; veil('Preparing the model', null, `on ${where()}`); }
    if (!loading) quiet = background;
    return (loading ??= load(false).finally(() => { loading = null; quiet = false; }));
  };

  function load(mainThread) {
    return new Promise(async (resolve, reject) => {
      host ??= await makeHost(mainThread);
      const total = variantBytes(model, variant);
      const need = missingFileBytes();
      const t0 = performance.now();
      const showGetting = (got) => veil('Getting the model, just this once', got / need,
        `${mb(got)} of ${mb(need)} · then it stays on this device`);
      if (!quiet) need ? showGetting(0) : veil('Preparing the model', null, `on ${where()}`);
      onMsg = (m) => {
        if (m.type === 'progress') {
          if (quiet) return;
          // Progress counts cached files too; subtract them so the bar is only the new bytes.
          if (m.compiled || !need) veil('Preparing the model', null, `on ${where()}`);
          else showGetting(Math.min(need, Math.max(0, m.got - (total - need))));
        } else if (m.type === 'ready') {
          lab.state = 'ready';
          lab.times.load = performance.now() - t0;
          veil(null);
          drawGate(); fillStats();
          navigator.storage?.persist?.().catch(() => {});
          resolve();
        } else if (m.type === 'error') {
          dropHost();
          if (m.code === 'no-webgpu' && !mainThread) {
            // Safari can have WebGPU on the page but not in workers: same model, main thread.
            load(true).then(resolve, reject);
          } else if (quiet) {
            reject(new Error(m.message)); // background warm-up: the next real action tries again
          } else if (m.code === 'gpu-failed') {
            const cpu = model.variants.find((v) => v.tier === 'cpu' && v.memMB <= dev.budgetMB);
            if (!cpu) { veil('Your GPU could not run this model', null, m.message); reject(new Error(m.message)); return; }
            veil('Your GPU could not run this model', null, `The CPU version is ${mb(variantBytes(model, cpu))}`, {
              label: 'Use the CPU version',
              onClick: async () => {
                variant = lab.variant = cpu;
                cached = await cachedState(rt.cacheKey, model, variant);
                drawGate(); fillStats();
                load(false).then(resolve, reject);
              },
            });
          } else {
            veil('That did not work', null, m.message, { label: 'Try again', onClick: () => load(false).then(resolve, reject) });
          }
        }
      };
      const { repo, sha } = repoOf(model);
      host.post({ type: 'load', runtimeUrl: rt.url, cacheKey: rt.cacheKey, adapterUrl: adapter, repo, sha,
        device: variant.device, dtype: variant.dtype, totalBytes: total });
    });
  }

  lab.run = (input, transfer) => lab.ensure().then(() => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve: (msg) => { lab.times.runs.push(msg.ms); fillStats(); resolve(msg); }, reject });
    host.post({ type: 'run', id, input }, transfer);
  }));

  // A cached model costs nothing to fetch, so warm it up straight away.
  if (!toDownload()) lab.ensure({ background: true }).catch(() => {});

  // ---------- (i) stats ----------
  function fillStats() {
    if (!stats) return;
    const dl = $el('dl', 'lab-stats');
    const add = (k, v) => { const dd = $el('dd'); typeof v === 'string' ? (dd.textContent = v) : dd.append(v); dl.append($el('dt', null, k), dd); };
    const link = (text, href) => { const a = $el('a', null, text); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; };
    add('Model', link(`${model.name} · ${model.params}`, model.upstream.url));
    add('Licence', link(model.license.name, model.license.url));
    add('Added', niceDate(model.added));
    const { repo, sha } = repoOf(model);
    add('Files', link(`${repo} @ ${sha.slice(0, 7)}`, `https://huggingface.co/${repo}/tree/${sha}`));
    if (variant) {
      add('Download', `${mb(variantBytes(model, variant))}, ${dtypeLabel(variant.dtype)}`);
      const threads = self.crossOriginIsolated ? navigator.hardwareConcurrency : 1;
      add('Runs on', variant.tier === 'gpu'
        ? `GPU, WebGPU${dev.gpu?.vendor ? ` (${[dev.gpu.vendor, dev.gpu.architecture].filter(Boolean).join(' ')})` : ''}`
        : `CPU, WebAssembly, ${threads} thread${threads > 1 ? 's' : ''}`);
      if (lab.times.load != null) add('Load', secs(lab.times.load));
      const r = lab.times.runs;
      if (r.length) {
        const med = [...r].sort((a, b) => a - b)[Math.floor(r.length / 2)];
        add('Speed', r.length > 1 ? `${secs(r.at(-1))} last, ${secs(med)} median` : secs(r[0]));
      }
    } else {
      add('Needs', `about ${needMB} MB of memory`);
    }
    add('Runtime', `${rt.name} ${rt.version}`);
    const parts = [dl];
    if (variant && (lab.state === 'ready' || !toDownload())) {
      const b = $el('button', 'btn quiet sm lab-forget', 'Remove from this device');
      b.addEventListener('click', async () => {
        await forget(rt.cacheKey, model);
        cached = await cachedState(rt.cacheKey, model, variant);
        window.rkToast?.('Removed. It downloads again next time');
        b.remove();
      });
      parts.push(b);
    }
    stats.replaceChildren(...parts);
  }
  fillStats();
  return lab;
}
