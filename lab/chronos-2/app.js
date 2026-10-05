// Chronos-2: pick a series, and the forecast fans out from the last point.
// The model (adapter.js, in the Lab worker) sees up to the last 512 values
// and returns 21 quantiles for the next 64 steps; the slider shows 4 to 64.
import { mountLab, veil } from '../frame/frame.js';
import { made, co2, dateAt } from './series.js';
import { readTable } from './table.js';

const $ = (id) => document.getElementById(id);
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const Q10 = 2, Q25 = 5, Q50 = 10, Q75 = 15, Q90 = 18, HORIZON = 64;

const lab = await mountLab({
  slug: 'chronos-2',
  adapter: new URL('./adapter.js', import.meta.url).href,
  gate: $('gate'), stats: $('labStats'), verb: 'forecast',
});

const samples = made();
try { samples.push(await co2()); } catch { /* offline: three series are enough */ }
const SUB = {
  steps: 'Steps a day · made up',
  cafe: 'Cups a day · made up',
  power: 'Megawatts each hour · made up',
  co2: 'Parts per million, monthly · NOAA, Mauna Loa',
};
const UNIT_STEP = { day: ['day', 'days'], hour: ['hour', 'hours'], week: ['week', 'weeks'], month: ['month', 'months'], year: ['year', 'years'] };

let cur = null;            // the series on screen
let yours = null;          // the last CSV, as { table, col }
let fc = null;             // { q, s }
let live = false;          // after the first forecast, every pick forecasts
let token = 0;
let ranMs = null;

// ---------- picking ----------
function drawChoices() {
  $('choices').replaceChildren(...samples.map((s) => {
    const b = document.createElement('button');
    b.className = 'btn choice'; b.textContent = { steps: 'Steps', cafe: 'Café', power: 'Power', co2: 'CO₂' }[s.key];
    b.dataset.key = s.key;
    b.addEventListener('click', () => pick(s));
    return b;
  }));
}
function pick(s) {
  cur = s; fc = null; ranMs = null;
  let lo = Infinity, hi = -Infinity;
  for (const v of s.values) if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  s.span = hi > lo ? hi - lo : Math.abs(hi) || 1;
  s.whole = s.values.every((v) => !Number.isFinite(v) || Number.isInteger(v));
  document.querySelectorAll('.choice').forEach((b) => b.classList.toggle('is-selected', b.dataset.key === s.key || (s.key === 'yours' && b.id === 'yours')));
  $('col').hidden = s.key !== 'yours' || yours.table.cols.length < 2;
  $('name').textContent = s.name;
  $('horizon').value = s.horizon;
  showSub(); showHorizon(); readout(null);
  chart.reset(s);
  placeAsk();
  if (live) forecast();
}
function showSub() {
  const base = cur.key === 'yours' ? cur.sub : SUB[cur.key];
  $('sub').textContent = ranMs == null ? base : `${base} · forecast in ${(ranMs / 1000).toFixed(2)} s on ${lab.where}`;
}
const horizon = () => +$('horizon').value;
function steps(n) {
  const u = UNIT_STEP[cur.step] || ['step', 'steps'];
  return `${n} ${n === 1 ? u[0] : u[1]}`;
}
function showHorizon() { $('hval').textContent = steps(horizon()); }

// ---------- forecasting ----------
async function forecast() {
  if (lab.state === 'blocked') return;
  const s = cur, t = ++token;
  try {
    await lab.ensure();
    const values = Float32Array.from(s.values.slice(-512), (v) => (v == null ? NaN : v));
    const slow = setTimeout(() => t === token && veil('Forecasting', null, `on ${lab.where}`), 400);
    let res;
    try { res = await lab.run({ values }, [values.buffer]); } finally { clearTimeout(slow); }
    if (t !== token || s !== cur) return;
    veil(null);
    live = true;
    document.body.classList.add('forecasting');
    fc = { q: res.output.q, s };
    ranMs = res.ms;
    showSub(); readout(null);
    chart.fan();
  } catch (err) {
    if (t === token) veil('That did not work', null, err?.message || String(err), { label: 'Close', onClick: () => veil(null) });
  }
}
$('go').addEventListener('click', forecast);
$('horizon').addEventListener('input', () => { showHorizon(); readout(null); chart.kick(); });

// ---------- numbers ----------
function fmt(v) {
  if (!Number.isFinite(v)) return '·';
  const span = cur.span || 1;
  const d = Math.max(0, Math.min(3, 3 - Math.floor(Math.log10(span))));
  if (cur.whole && Number.isInteger(v)) return v.toLocaleString();
  return v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function when(i) {
  const d = dateAt(cur, i);
  if (!d) return i < cur.values.length ? `row ${i + 1}` : `${steps(i - cur.values.length + 1)} ahead`;
  const hh = String(d.getHours()).padStart(2, '0');
  if (cur.step === 'hour') return `${WD[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}, ${hh}:00`;
  if (cur.step === 'month') return `${MON[d.getMonth()]} ${d.getFullYear()}`;
  if (cur.step === 'year') return `${d.getFullYear()}`;
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
}
const unit = () => (cur.unit ? ` ${cur.unit}` : '');

// The readout: the point under the pointer, or a summary when there is none.
function readout(i) {
  const el = $('readout'), n = cur.values.length;
  if (i == null) {
    if (fc) {
      const h = horizon(), k = h - 1;
      return el.replaceChildren(big(fmt(fc.q[Q50 * HORIZON + k]) + unit(), true),
        `in ${steps(h)}, likely ${fmt(fc.q[Q10 * HORIZON + k])} to ${fmt(fc.q[Q90 * HORIZON + k])}`);
    }
    let j = n - 1; while (j > 0 && !Number.isFinite(cur.values[j])) j--;
    return el.replaceChildren(big(fmt(cur.values[j]) + unit()), `${when(j)}, the latest`);
  }
  if (i < n) return el.replaceChildren(big(fmt(cur.values[i]) + unit()), when(i));
  const k = i - n;
  el.replaceChildren(big(fmt(fc.q[Q50 * HORIZON + k]) + unit(), true),
    `${when(i)}, likely ${fmt(fc.q[Q10 * HORIZON + k])} to ${fmt(fc.q[Q90 * HORIZON + k])}`);
}
function big(text, f) { const b = document.createElement('b'); b.textContent = text; if (f) b.className = 'f'; return b; }

// ---------- the chart ----------
const chart = (() => {
  const cv = $('chart'), ctx = cv.getContext('2d');
  const PAD = { l: 8, r: 58, t: 14, b: 30 };
  const BONE = '245,245,240', TEAL = '94,234,212';
  let W = 0, H = 0, dpr = 1;
  const dom = { x0: 0, x1: 1, y0: 0, y1: 1 };   // what is drawn (eases towards the target)
  let histT = 0, fanT = 0, hover = null, raf = 0;

  function size() {
    const r = cv.getBoundingClientRect(), was = W;
    dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (!was && cur) Object.assign(dom, target());
  }
  new ResizeObserver(() => { size(); kick(); }).observe(cv);

  function target() {
    const s = cur, n = s.values.length, h = horizon();
    const view = Math.round(s.view * Math.min(1, Math.max(0.5, W / 900))); // less history on a phone
    const x0 = Math.max(0, n - Math.min(n, view));
    const x1 = n - 1 + h;
    let lo = Infinity, hi = -Infinity;
    for (let i = Math.floor(x0); i < n; i++) { const v = s.values[i]; if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
    if (fc) for (let k = 0; k < h; k++) { lo = Math.min(lo, fc.q[Q10 * HORIZON + k]); hi = Math.max(hi, fc.q[Q90 * HORIZON + k]); }
    if (!(hi > lo)) { hi = (Number.isFinite(hi) ? hi : 0) + 1; lo = hi - 2; }
    const pad = (hi - lo) * 0.1;
    return { x0, x1, y0: lo - pad, y1: hi + pad };
  }
  const plotW = () => W - PAD.l - PAD.r, plotH = () => H - PAD.t - PAD.b;
  const X = (i) => PAD.l + ((i - dom.x0) / (dom.x1 - dom.x0)) * plotW();
  const Y = (v) => PAD.t + (1 - (v - dom.y0) / (dom.y1 - dom.y0)) * plotH();
  const I = (px) => dom.x0 + ((px - PAD.l) / plotW()) * (dom.x1 - dom.x0);

  function reset() {
    Object.assign(dom, target()); // a new series snaps; the horizon and the forecast ease
    histT = still ? -1e9 : performance.now();
    hover = null;
    kick();
  }
  function fan() { fanT = still ? -1e9 : performance.now(); kick(); }

  function kick() { if (!raf && W) raf = requestAnimationFrame(frame); }
  let last = 0;
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    const t = target(), k = still ? 1 : 1 - Math.exp(-dt * 9);
    let moving = false;
    for (const key of ['x0', 'x1', 'y0', 'y1']) {
      const d = t[key] - dom[key];
      if (Math.abs(d) > 1e-6 * (Math.abs(t[key]) + 1)) { dom[key] += d * k; moving = true; } else dom[key] = t[key];
    }
    const ph = Math.min(1, (now - histT) / 900), pf = Math.min(1, (now - fanT) / 1200);
    draw(ease(ph), pf, now);
    if (moving || ph < 1 || (fc && pf < 1) || breathing()) { last = now; raf = requestAnimationFrame(frame); }
    else last = 0;
  }
  const ease = (p) => 1 - Math.pow(1 - p, 3);
  // The last point pulses while a forecast is still possible.
  const breathing = () => !fc && !still && lab.state !== 'blocked';

  function draw(ph, pf, now) {
    const s = cur, n = s.values.length;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const nowX = X(n - 1);

    // y grid and labels
    ctx.font = '11px "DM Mono", ui-monospace, monospace';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const step = nice((dom.y1 - dom.y0) / 5);
    const big = Math.max(Math.abs(dom.y0), Math.abs(dom.y1));
    for (let v = Math.ceil(dom.y0 / step) * step; v <= dom.y1; v += step) {
      const y = Math.round(Y(v)) + 0.5;
      if (y < PAD.t - 4 || y > H - PAD.b + 4) continue;
      ctx.strokeStyle = 'rgba(255,255,255,.05)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.l, y); ctx.lineTo(W - PAD.r + 6, y); ctx.stroke();
      ctx.fillStyle = 'rgba(160,160,154,.85)';
      if (y > 8 && y < H - PAD.b - 4) ctx.fillText(short(v, step, big), W - PAD.r + 12, y);
    }
    // x labels
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (const { i, label } of xticks(s, dom.x0, dom.x1, plotW() / (dom.x1 - dom.x0))) {
      const x = X(i);
      if (x < PAD.l + 14 || x > W - PAD.r - 14) continue;
      ctx.fillStyle = 'rgba(160,160,154,.75)';
      ctx.fillText(label, x, H - 9);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(Math.round(x), H - PAD.b + 2, 1, 4);
    }

    ctx.save();
    ctx.beginPath(); ctx.rect(PAD.l, 0, plotW(), H); ctx.clip();

    // the future, before there is a forecast: a soft unknown
    if (!fc) {
      const g = ctx.createLinearGradient(nowX, 0, W - PAD.r, 0);
      g.addColorStop(0, `rgba(${TEAL},.07)`); g.addColorStop(1, `rgba(${TEAL},0)`);
      ctx.fillStyle = g; ctx.fillRect(nowX, PAD.t, W - PAD.r - nowX, plotH());
    }
    // now
    ctx.strokeStyle = `rgba(${BONE},.22)`; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Math.round(nowX) + 0.5, PAD.t); ctx.lineTo(Math.round(nowX) + 0.5, H - PAD.b); ctx.stroke();
    ctx.setLineDash([]);

    // history, drawn in from the left
    const a = Math.max(0, Math.floor(dom.x0) - 1);
    const reach = a + (n - 1 - a) * ph;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, X(reach) + 1, H); ctx.clip();
    const area = ctx.createLinearGradient(0, PAD.t, 0, H - PAD.b);
    area.addColorStop(0, `rgba(${BONE},.08)`); area.addColorStop(1, `rgba(${BONE},0)`);
    let run = [];
    const flush = () => {
      if (run.length > 1) {
        ctx.beginPath(); run.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.lineTo(run.at(-1)[0], H - PAD.b); ctx.lineTo(run[0][0], H - PAD.b); ctx.closePath();
        ctx.fillStyle = area; ctx.fill();
        ctx.beginPath(); run.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.strokeStyle = `rgb(${BONE})`; ctx.lineWidth = 1.5; ctx.lineJoin = 'round'; ctx.stroke();
      }
      run = [];
    };
    for (let i = a; i < n; i++) {
      const v = s.values[i];
      if (Number.isFinite(v)) run.push([X(i), Y(v)]); else flush();
    }
    flush();
    ctx.restore();

    // the last point, breathing until there is a forecast
    let li = n - 1; while (li > 0 && !Number.isFinite(s.values[li])) li--;
    const lx = X(li), ly = Y(s.values[li]);
    if (ph >= 1) {
      if (breathing()) {
        const p = (now / 1600) % 1;
        ctx.fillStyle = `rgba(${TEAL},${0.35 * (1 - p)})`;
        ctx.beginPath(); ctx.arc(lx, ly, 4 + 14 * p, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = `rgb(${BONE})`;
      ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill();
    }

    // the forecast, fanning out from the last point
    if (fc && ph >= 1) {
      const h = horizon(), q = fc.q;
      const grow = ease(Math.min(1, pf * 1.15)), open = ease(pf);
      const kmax = Math.min(h, HORIZON);
      const xs = [lx], mid = [ly];
      for (let k = 0; k < kmax; k++) { xs.push(X(n + k)); mid.push(Y(q[Q50 * HORIZON + k])); }
      const at = (row, k) => (k === 0 ? ly : mid[k] + (Y(q[row * HORIZON + k - 1]) - mid[k]) * open);
      const edge = lx + (xs.at(-1) - lx) * grow;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, edge + 1, H); ctx.clip();
      const band = (lo, hi, alpha) => {
        ctx.beginPath();
        for (let k = 0; k < xs.length; k++) (k ? ctx.lineTo(xs[k], at(hi, k)) : ctx.moveTo(xs[k], at(hi, k)));
        for (let k = xs.length - 1; k >= 0; k--) ctx.lineTo(xs[k], at(lo, k));
        ctx.closePath(); ctx.fillStyle = `rgba(${TEAL},${alpha})`; ctx.fill();
      };
      band(Q10, Q90, 0.13);
      band(Q25, Q75, 0.13);
      ctx.beginPath(); xs.forEach((x, k) => (k ? ctx.lineTo(x, mid[k]) : ctx.moveTo(x, mid[k])));
      ctx.strokeStyle = `rgb(${TEAL})`; ctx.lineWidth = 2; ctx.lineJoin = 'round';
      ctx.shadowColor = `rgba(${TEAL},.55)`; ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // what is under the pointer
    if (hover != null) {
      const i = hover, x = X(i);
      ctx.strokeStyle = `rgba(${BONE},.28)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, PAD.t); ctx.lineTo(Math.round(x) + 0.5, H - PAD.b); ctx.stroke();
      const v = i < n ? s.values[i] : fc.q[Q50 * HORIZON + i - n];
      if (Number.isFinite(v)) {
        ctx.fillStyle = i < n ? `rgb(${BONE})` : `rgb(${TEAL})`;
        ctx.beginPath(); ctx.arc(x, Y(v), 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // pointer: the readout follows it
  function at(e) {
    const r = cv.getBoundingClientRect();
    const n = cur.values.length, last = fc ? n - 1 + horizon() : n - 1;
    const i = Math.round(I(e.clientX - r.left));
    return Math.max(Math.ceil(dom.x0), Math.min(last, i));
  }
  cv.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && !e.buttons) return;
    hover = at(e); readout(hover); kick();
  });
  cv.addEventListener('pointerdown', (e) => { hover = at(e); readout(hover); kick(); });
  const leave = () => { hover = null; readout(null); kick(); };
  cv.addEventListener('pointerleave', leave);
  cv.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') leave(); });

  return { reset, fan, kick, X, nowX: () => X(cur.values.length - 1) };
})();

// The Forecast button sits over the empty future on wide screens.
const wide = matchMedia('(min-width: 701px)');
function placeAsk() {
  const ask = $('ask');
  if (!wide.matches || lab.state === 'blocked') { ask.style.left = ''; return; }
  ask.style.left = `${Math.max(0, Math.min(chart.nowX(), $('stage').clientWidth - 280))}px`;
}
new ResizeObserver(placeAsk).observe($('stage'));
$('horizon').addEventListener('input', placeAsk);

// ---------- axis helpers ----------
function nice(x) {
  const p = Math.pow(10, Math.floor(Math.log10(x))), f = x / p;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
}
// Axis numbers, all in the same style: 2k 4k 6k, or 380 400 420, or 0.5 1.0 1.5.
function short(v, step, big) {
  const fix = (x, s) => x.toLocaleString(undefined, { minimumFractionDigits: s, maximumFractionDigits: s });
  const dp = (s) => Math.max(0, -Math.floor(Math.log10(s) + 1e-9));
  if (Math.abs(v) < step / 1e6) v = 0;
  if (big >= 1e6 && step >= 1e5) return `${fix(v / 1e6, dp(step / 1e6))}M`;
  if (big >= 1e4 && step >= 1e3) return `${fix(v / 1e3, dp(step / 1e3))}k`;
  return fix(v, dp(step));
}
const dayNo = (d) => Math.floor((d.getTime() - d.getTimezoneOffset() * 6e4) / 864e5);
const LEVELS = {
  day: [
    [1, dayNo, (d) => `${d.getDate()} ${MON[d.getMonth()]}`],
    [7, (d) => Math.floor((dayNo(d) + 3) / 7), (d) => `${d.getDate()} ${MON[d.getMonth()]}`],
    [30.4, (d) => d.getFullYear() * 12 + d.getMonth(), (d) => (d.getMonth() ? MON[d.getMonth()] : `${d.getFullYear()}`)],
    [91, (d) => Math.floor((d.getFullYear() * 12 + d.getMonth()) / 3), (d) => (d.getMonth() ? MON[d.getMonth()] : `${d.getFullYear()}`)],
    [365, (d) => d.getFullYear(), (d) => `${d.getFullYear()}`],
  ],
  hour: [
    [3, (d) => dayNo(d) * 8 + Math.floor(d.getHours() / 3), (d) => (d.getHours() ? `${String(d.getHours()).padStart(2, '0')}:00` : WD[d.getDay()])],
    [6, (d) => dayNo(d) * 4 + Math.floor(d.getHours() / 6), (d) => (d.getHours() ? `${String(d.getHours()).padStart(2, '0')}:00` : WD[d.getDay()])],
    [12, (d) => dayNo(d) * 2 + Math.floor(d.getHours() / 12), (d) => (d.getHours() ? '12:00' : WD[d.getDay()])],
    [24, dayNo, (d) => `${WD[d.getDay()]} ${d.getDate()}`],
    [48, (d) => Math.floor(dayNo(d) / 2), (d) => `${d.getDate()} ${MON[d.getMonth()]}`],
    [168, (d) => Math.floor((dayNo(d) + 3) / 7), (d) => `${d.getDate()} ${MON[d.getMonth()]}`],
  ],
  week: [
    [4.35, (d) => d.getFullYear() * 12 + d.getMonth(), (d) => (d.getMonth() ? MON[d.getMonth()] : `${d.getFullYear()}`)],
    [13, (d) => Math.floor((d.getFullYear() * 12 + d.getMonth()) / 3), (d) => (d.getMonth() ? MON[d.getMonth()] : `${d.getFullYear()}`)],
    [52, (d) => d.getFullYear(), (d) => `${d.getFullYear()}`],
  ],
  month: [
    [1, (d) => d.getFullYear() * 12 + d.getMonth(), (d) => (d.getMonth() ? MON[d.getMonth()] : `${d.getFullYear()}`)],
    [3, (d) => Math.floor((d.getFullYear() * 12 + d.getMonth()) / 3), (d) => (d.getMonth() ? MON[d.getMonth()] : `${d.getFullYear()}`)],
    [12, (d) => d.getFullYear(), (d) => `${d.getFullYear()}`],
    [24, (d) => Math.floor(d.getFullYear() / 2), (d) => `${d.getFullYear()}`],
    [60, (d) => Math.floor(d.getFullYear() / 5), (d) => `${d.getFullYear()}`],
    [120, (d) => Math.floor(d.getFullYear() / 10), (d) => `${d.getFullYear()}`],
  ],
  year: [
    [1, (d) => d.getFullYear(), (d) => `${d.getFullYear()}`],
    [5, (d) => Math.floor(d.getFullYear() / 5), (d) => `${d.getFullYear()}`],
    [10, (d) => Math.floor(d.getFullYear() / 10), (d) => `${d.getFullYear()}`],
    [50, (d) => Math.floor(d.getFullYear() / 50), (d) => `${d.getFullYear()}`],
  ],
};
function xticks(s, x0, x1, pxPerStep) {
  const a = Math.ceil(x0), b = Math.floor(x1), out = [];
  const levels = LEVELS[s.step];
  if (!levels) {
    const st = nice(70 / pxPerStep);
    for (let i = Math.ceil(a / st) * st; i <= b; i += st) out.push({ i: i - 1, label: String(i) });
    return out;
  }
  const level = levels.find(([steps]) => steps * pxPerStep >= 64) || levels.at(-1);
  let prev = null;
  for (let i = a - 1; i <= b; i++) {
    const d = dateAt(s, i), key = level[1](d);
    if (prev != null && key !== prev && i >= a) out.push({ i, label: level[2](d) });
    prev = key;
  }
  return out;
}

// ---------- your own data ----------
function useTable(table, label) {
  if (!table) { window.rkToast?.("I couldn't find a column of numbers in that"); return; }
  yours = { table, label, col: table.pick };
  $('col').replaceChildren(...table.cols.map((c, j) => { const o = document.createElement('option'); o.value = j; o.textContent = c.name; return o; }));
  $('col').value = String(table.pick);
  pick(yoursSeries());
}
function yoursSeries() {
  const { table, label, col } = yours, c = table.cols[col];
  const name = table.cols.length > 1 || !label ? c.name : label;
  const every = UNIT_STEP[table.step] ? `, one per ${UNIT_STEP[table.step][0]}` : '';
  return {
    key: 'yours', name, unit: '', step: table.step, end: table.end, values: c.values,
    view: Math.min(c.values.length, 240), horizon: Math.min(HORIZON, Math.max(8, Math.round(Math.min(c.values.length, 240) / 4))),
    sub: `Your data · ${c.values.length} values${every}`,
  };
}
$('col').addEventListener('change', () => { yours.col = +$('col').value; pick(yoursSeries()); });
async function readFile(f) {
  if (!f) return;
  if (f.size > 20e6) { window.rkToast?.('That file is too big for this page'); return; }
  useTable(readTable(await f.text()), f.name.replace(/\.[^.]+$/, ''));
}
$('yours').addEventListener('click', () => (yours && cur.key !== 'yours' ? pick(yoursSeries()) : $('file').click()));
$('file').addEventListener('change', (e) => { readFile(e.target.files[0]); e.target.value = ''; });
window.addEventListener('paste', (e) => {
  if (e.target.closest?.('input, textarea, select')) return;
  const text = e.clipboardData?.getData('text/plain');
  if (text && /\d/.test(text)) { e.preventDefault(); useTable(readTable(text), 'Pasted'); }
});
let depth = 0;
window.addEventListener('dragenter', (e) => { if (e.dataTransfer?.types?.includes('Files')) { depth++; document.body.classList.add('drop-over'); } });
window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove('drop-over'); });
window.addEventListener('dragover', (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  if (!e.dataTransfer?.files?.length) return;
  e.preventDefault(); depth = 0; document.body.classList.remove('drop-over');
  readFile(e.dataTransfer.files[0]);
});

drawChoices();
pick(samples[0]);
placeAsk();
