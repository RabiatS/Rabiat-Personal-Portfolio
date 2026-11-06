// Onset and duration: the time numbers each FDA label gives, on one axis, for up to four drugs.
import { loadDrugs, esc, fmtTL, fmtMin, srcLink, CAT_COLOR, NOT_STATED } from '../shared.js';

const PRESETS = {
  nmb: ['succinylcholine', 'rocuronium', 'vecuronium', 'cisatracurium'],
  induction: ['propofol', 'etomidate', 'ketamine', 'methohexital'],
  pressors: ['epinephrine', 'norepinephrine', 'vasopressin', 'dobutamine'],
  reversal: ['naloxone', 'flumazenil', 'sugammadex', 'glycopyrrolate'],
};
const KINDS = [['onset', 'Onset'], ['peak', 'Peak'], ['duration', 'Duration'], ['offset', 'Offset after stopping']];

export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas();
    const g = cv.ctx;
    let drugs = []; let sel = ctx.store.get('tl:sel', PRESETS.nmb); let scale = ctx.store.get('tl:scale', 'log'); let sketch = true;
    let hits = []; let focus = null; let anim = 0;
    const lanesCol = [C.c1, C.c2, C.c3, C.c5];

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Onset and duration</h2>'),
      ctx.h('<p class="lede">How fast does it work, when is it strongest, how long does it last? Here are the numbers each FDA label actually gives, on one time axis.</p>'),
    );
    const presetSeg = ctx.seg([['nmb', 'NMBs'], ['induction', 'Induction'], ['pressors', 'Pressors'], ['reversal', 'Reversal']], '', (v) => { sel = PRESETS[v].slice(); save(); renderPicker(); });
    const pickRow = ctx.h('<div class="row"></div>');
    const addSel = ctx.h('<select class="sel" aria-label="Add a drug"></select>');
    const scaleSeg = ctx.seg([['log', 'Log time'], ['lin', 'Linear time']], scale, (v) => { scale = v; ctx.store.set('tl:scale', v); anim = 0; });
    const sketchChk = ctx.h('<label class="check"><input type="checkbox" checked> Show a schematic effect curve</label>');
    sketchChk.querySelector('input').addEventListener('change', (e) => { sketch = e.target.checked; }, { signal: ctx.signal });
    const info = ctx.h('<div class="card" style="min-height:70px"><span class="eyebrow">Selected</span><b style="font:700 18px/1.1 var(--f-display);text-transform:uppercase">Tap a bar</b><p class="small muted">Tap or hover any bar or marker to read the label sentence it comes from.</p></div>');
    ctx.panel.append(ctx.h('<span class="eyebrow">Presets</span>'), presetSeg, ctx.h('<span class="eyebrow">Compare up to 4</span>'), pickRow, addSel, ctx.h('<div class="row"></div>'), scaleSeg, sketchChk, info);
    ctx.panel.append(
      ctx.h('<div class="legend"><span><i style="background:#F5F5F0;opacity:.85"></i>onset</span><span><i style="background:#F5F5F0;border-radius:2px;transform:rotate(45deg)"></i>peak</span><span><i style="background:#5A5A55"></i>duration</span><span><i style="border:1.5px dashed #A0A09A;background:transparent"></i>offset after stopping</span></div>'),
      ctx.h('<div class="card tip"><p><b>Onset</b> is when the effect starts, <b>peak</b> when it is strongest, <b>duration</b> how long one dose works. For infusions, labels often give the <b>offset</b>: how fast the effect fades after you stop.</p><p>Bars show ranges. A soft fading start means the label only gives an upper bound, such as "within 1 minute". A drug without a bar has no number in its label for that, which is common.</p></div>'),
      ctx.h('<div class="card try"><ol><li>Load <b>NMBs</b>. Succinylcholine starts and ends first; rocuronium and vecuronium last tens of minutes.</li><li>Switch to <b>Linear time</b>: short drugs crowd together on the left, which is why the log axis is the default.</li><li>Load <b>Pressors</b>. Most give onset or offset only, because they are run as infusions.</li><li>Tap a bar and read the exact sentence and its context.</li></ol></div>'),
      ctx.h(`<details class="more"><summary>Going deeper: reading time numbers safely</summary><div>
        <p class="small">Every number here was copied by hand from a sentence in the chosen label and checked by the build script, which drops any number whose sentence is not found in the current label text. The context tag (IM, epidural, 0.6 mg/kg, after stopping) is part of the number: a fentanyl duration from a 100 mcg IV dose is not the duration of a large opioid technique, and a bupivacaine dental injection is not an epidural.</p>
        <p class="small">Time course depends on dose, route, patient and the other drugs on board. Clinical duration of a neuromuscular blocker in a label usually means time to 25% recovery of twitch height, not full recovery.</p>
        <p class="small">The schematic curve only joins the label times with a smooth shape so the eye can compare them. Its height and shape are not data.</p>
      </div></details>`),
    );
    function save() { ctx.store.set('tl:sel', sel); anim = 0; focus = null; }
    function renderPicker() {
      pickRow.innerHTML = sel.map((id, i) => { const d = drugs.find((x) => x.id === id); return d ? `<button class="chip on" data-id="${id}" style="outline-color:${lanesCol[i]}">${esc(d.name)} ×</button>` : ''; }).join('');
      pickRow.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { sel = sel.filter((x) => x !== b.dataset.id); save(); renderPicker(); }, { signal: ctx.signal }));
      const withData = drugs.filter((d) => Object.keys(d.timeline || {}).length);
      const without = drugs.filter((d) => !Object.keys(d.timeline || {}).length);
      addSel.innerHTML = `<option value="">${sel.length >= 4 ? 'Remove one to add another' : 'Add a drug...'}</option><optgroup label="Label gives time numbers">${withData.map((d) => `<option value="${d.id}" ${sel.includes(d.id) ? 'disabled' : ''}>${esc(d.name)}</option>`).join('')}</optgroup><optgroup label="No time numbers in label">${without.map((d) => `<option value="${d.id}" ${sel.includes(d.id) ? 'disabled' : ''}>${esc(d.name)}</option>`).join('')}</optgroup>`;
      addSel.disabled = sel.length >= 4;
    }
    addSel.addEventListener('change', () => { if (addSel.value && sel.length < 4) { sel.push(addSel.value); save(); renderPicker(); } addSel.value = ''; }, { signal: ctx.signal });

    function showInfo(d, kind) {
      const t = d.timeline[kind];
      const field = kind === 'offset' ? d.offset : d[kind];
      const sent = Array.isArray(field) ? field[0] : null;
      info.querySelector('.eyebrow').textContent = `${d.name} · ${KINDS.find((k) => k[0] === kind)[1]}`;
      info.querySelector('b').textContent = `${fmtTL(t)}${t.context ? ` (${t.context})` : ''}`;
      info.querySelector('p').innerHTML = `${esc(sent ? sent.text : t.quote)}<br>${srcLink(d, t.src || (sent && sent.src))}`;
      info.querySelector('p').classList.remove('muted');
    }

    // Time axis
    const T0 = 0.1; const T1 = 720;
    function maxT() {
      let m = 5;
      for (const id of sel) { const d = drugs.find((x) => x.id === id); if (!d) continue; for (const k in d.timeline) m = Math.max(m, d.timeline[k].max || d.timeline[k].min); }
      const steps = [5, 10, 20, 30, 60, 120, 240, 480, 720];
      return steps.find((s) => s >= m * 1.08) || 720;
    }
    function draw(t, dt) {
      const W = cv.w; const H = cv.h; if (!W) return;
      anim = Math.min(1, anim + dt * 1.6);
      const e = 1 - Math.pow(1 - anim, 3);
      g.clearRect(0, 0, W, H);
      const padL = W < 520 ? 12 : 24; const padR = 18; const top = 8; const axisH = 34; const labelW = 0;
      const x0 = padL + labelW; const x1 = W - padR;
      const tMax = scale === 'lin' ? maxT() : T1;
      const X = (m) => {
        if (scale === 'lin') return x0 + (Math.max(0, m) / tMax) * (x1 - x0);
        const v = Math.max(T0, m); return x0 + (Math.log(v / T0) / Math.log(T1 / T0)) * (x1 - x0);
      };
      // ticks
      const ticks = scale === 'lin'
        ? Array.from({ length: 6 }, (_, i) => (tMax / 5) * i)
        : [10 / 60, 0.5, 1, 2, 5, 10, 30, 60, 120, 360, 720];
      const laneTop = top; const laneH = Math.max(60, (H - axisH - top - 6) / 4);
      g.font = '500 11px "DM Mono", monospace'; g.textBaseline = 'top'; g.textAlign = 'center';
      for (const tk of ticks) {
        const x = X(tk);
        g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, laneTop); g.lineTo(x, H - axisH); g.stroke();
        if (W < 620 && scale === 'log' && ![10 / 60, 1, 10, 60, 720].includes(tk)) continue;
        if (W < 620 && scale === 'lin' && ticks.indexOf(tk) % 2 === 1) continue;
        g.fillStyle = C.muted; g.fillText(tk === 0 ? '0' : fmtMin(tk), x, H - axisH + 8);
      }
      g.textAlign = 'right'; g.fillStyle = C.subtle; g.fillText(scale === 'log' ? 'time after dose (log scale)' : 'time after dose', x1, H - 14);
      if (sketch) { g.textBaseline = 'top'; g.fillText('curve = schematic shape, not data', x1, 2); }
      hits = [];
      sel.slice(0, 4).forEach((id, i) => {
        const d = drugs.find((x) => x.id === id); if (!d) return;
        const col = lanesCol[i];
        const yT = laneTop + i * laneH; const yM = yT + laneH * 0.58;
        // lane label
        g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        g.fillStyle = col; g.font = '700 16px Rajdhani, sans-serif'; g.fillText(d.name.toUpperCase(), x0, yT + 18);
        const tl = d.timeline || {};
        const ctxs = [...new Set(Object.values(tl).map((v) => v.context).filter(Boolean))];
        g.font = '500 10.5px "DM Mono", monospace'; g.fillStyle = C.muted;
        const miss = KINDS.filter(([k]) => k !== 'offset' && !tl[k]).map(([, l]) => l.toLowerCase());
        const sub = [ctxs.join('; '), miss.length ? `${miss.join(', ')}: not in label` : ''].filter(Boolean).join(' · ');
        const nameW = g.measureText ? (g.font = '700 16px Rajdhani, sans-serif', g.measureText(d.name.toUpperCase()).width) : 80;
        g.font = '500 10.5px "DM Mono", monospace';
        if (W > 700) g.fillText(sub.slice(0, 110), x0 + nameW + 12, yT + 17);
        else g.fillText(sub.slice(0, Math.floor((W - 30) / 6.3)), x0, yT + 32);
        // baseline
        g.strokeStyle = C.border; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, yM); g.lineTo(x1, yM); g.stroke();
        if (!Object.keys(tl).length) {
          g.fillStyle = C.subtle; g.font = 'italic 13px Lora, serif'; g.fillText('This label gives no onset, peak or duration numbers.', x0, yM - 8);
          return;
        }
        const band = (k, y, hgt, style) => {
          const v = tl[k]; if (!v) return;
          const a = v.qual === 'within' || v.qual === 'lt' || v.qual === 'upto' ? 0 : v.min; const b = v.max;
          let xa = X(a); let xb = X(b);
          if (xb - xa < 6) { xa -= 3; xb += 3; }
          xb = xa + (xb - xa) * e;
          if (style === 'dur') {
            const xs = X(tl.onset ? (tl.onset.qual === 'range' || tl.onset.qual === 'about' ? tl.onset.min : 0) : 0);
            const xm = X(v.qual === 'range' ? v.min : (v.qual === 'about' ? v.min : v.max * 0.999));
            g.fillStyle = 'rgba(160,160,154,.20)'; g.fillRect(xs, y, (Math.max(xs, xm) - xs) * e, hgt);
            if (v.qual === 'range') { g.fillStyle = 'rgba(160,160,154,.10)'; g.fillRect(xm, y, (X(v.max) - xm) * e, hgt); }
            g.fillStyle = col; g.fillRect(X(v.qual === 'about' ? v.min : v.max) - 1, y - 3, 2, hgt + 6);
            hits.push({ d, k, x0: xs, x1: X(v.max) + 4, y0: y - 4, y1: y + hgt + 4 });
            return;
          }
          if (style === 'off') {
            g.setLineDash([4, 3]); g.strokeStyle = col; g.lineWidth = 1.4; g.strokeRect(X(0.1), y, X(v.max) - X(0.1), hgt); g.setLineDash([]);
            g.fillStyle = C.muted; g.font = '500 10px "DM Mono", monospace'; g.fillText('after stopping', X(v.max) + 6, y + hgt - 1);
            hits.push({ d, k, x0: X(0.1), x1: X(v.max) + 4, y0: y - 4, y1: y + hgt + 4 });
            return;
          }
          const grad = g.createLinearGradient(xa, 0, xb, 0);
          if (a === 0 && (v.qual === 'within' || v.qual === 'lt' || v.qual === 'upto')) { grad.addColorStop(0, 'rgba(245,245,240,0)'); grad.addColorStop(1, style === 'peak' ? col : 'rgba(245,245,240,.85)'); } else { grad.addColorStop(0, style === 'peak' ? col : 'rgba(245,245,240,.85)'); grad.addColorStop(1, style === 'peak' ? col : 'rgba(245,245,240,.85)'); }
          g.fillStyle = grad;
          g.beginPath(); g.roundRect(xa, y, Math.max(3, xb - xa), hgt, 3); g.fill();
          if (style === 'peak' && v.qual === 'about') { g.save(); g.translate(X(v.min), y + hgt / 2); g.rotate(Math.PI / 4); g.fillStyle = col; g.fillRect(-5, -5, 10, 10); g.restore(); }
          if (tl[k].mid) { g.fillStyle = '#0A0A0A'; g.fillRect(X(tl[k].mid) - 1, y, 2, hgt); }
          hits.push({ d, k, x0: xa - 4, x1: X(b) + 4, y0: y - 4, y1: y + hgt + 4 });
        };
        // schematic curve
        if (sketch && (tl.onset || tl.peak) && (tl.duration || tl.peak)) {
          const on = tl.onset ? (tl.onset.qual === 'range' || tl.onset.qual === 'about' ? tl.onset.min : Math.max(T0, tl.onset.max * 0.35)) : null;
          const pk = tl.peak ? (tl.peak.qual === 'range' ? (tl.peak.min + tl.peak.max) / 2 : (tl.peak.qual === 'about' ? tl.peak.min : tl.peak.max)) : null;
          const du = tl.duration ? (tl.duration.qual === 'range' ? (tl.duration.min + tl.duration.max) / 2 : tl.duration.max || tl.duration.min) : null;
          const pts = [];
          const s0 = on ?? Math.max(T0, (pk || 1) * 0.3);
          const s1 = pk ?? Math.max(s0 * 1.6, tl.onset ? tl.onset.max : s0 * 2);
          const s2 = du ?? null;
          const amp = laneH * 0.34;
          const N = 80;
          for (let j = 0; j <= N; j++) {
            const tt = scale === 'log' ? T0 * Math.pow((s2 || s1 * 3) * 1.25 / T0, j / N) : ((s2 || s1 * 3) * 1.25) * j / N;
            let y;
            if (tt <= s0) y = 0;
            else if (tt <= s1) { const u = (tt - s0) / Math.max(1e-6, s1 - s0); y = Math.sin(u * Math.PI / 2); }
            else if (s2) { const u = (tt - s1) / Math.max(1e-6, s2 - s1); y = u >= 1 ? Math.max(0, 1 - (u - 1) * 4) * 0.25 : 1 - 0.75 * Math.pow(u, 1.6); }
            else y = Math.max(0, 1 - (tt - s1) / (s1 * 2));
            pts.push([X(tt), yM - y * amp]);
          }
          g.strokeStyle = col; g.globalAlpha = 0.55; g.lineWidth = 1.6; g.setLineDash(s2 ? [] : [5, 4]);
          g.beginPath(); const lim = Math.floor(pts.length * e);
          pts.slice(0, Math.max(2, lim)).forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y)));
          g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
        }
        band('duration', yM + 6, 7, 'dur');
        band('onset', yM - 4, 8, 'onset');
        band('peak', yM - 15, 8, 'peak');
        band('offset', yM + 17, 7, 'off');
        if (focus && focus.d === d) { const hh = hits.find((q) => q.d === d && q.k === focus.k); if (hh) { g.strokeStyle = C.teal; g.lineWidth = 1.5; g.strokeRect(hh.x0, hh.y0, hh.x1 - hh.x0, hh.y1 - hh.y0); } }
      });
    }
    ctx.loop(draw);
    const pickAt = (e) => {
      const r = cv.el.getBoundingClientRect(); const x = e.clientX - r.left; const y = e.clientY - r.top;
      return hits.find((q) => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
    };
    cv.el.addEventListener('pointerdown', (e) => { const hh = pickAt(e); if (hh) { focus = hh; showInfo(hh.d, hh.k); } }, { signal: ctx.signal });
    cv.el.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const hh = pickAt(e); cv.el.style.cursor = hh ? 'pointer' : ''; if (hh && (!focus || focus.d !== hh.d || focus.k !== hh.k)) { focus = hh; showInfo(hh.d, hh.k); } }, { signal: ctx.signal });

    loadDrugs().then((doc) => { if (ctx.signal.aborted) return; drugs = doc.drugs; sel = sel.filter((id) => drugs.some((d) => d.id === id)).slice(0, 4); renderPicker(); });

    ctx.quiz([
      { q: 'Per its label, what is the median time to 80% block for intubation after rocuronium 0.6 mg/kg?', choices: ['About 1 minute (range 0.4 to 6)', 'About 10 minutes', 'Within 15 seconds', 'The label does not say'], answer: 0, why: 'Section 2.2 of the rocuronium label: block sufficient for intubation is attained in a median (range) time of 1 (0.4 to 6) minute(s).' },
      { q: 'The succinylcholine label says one IV dose of paralysis lasts about how long?', choices: ['4 to 6 minutes', '30 to 60 minutes', '2 to 3 hours', 'Not stated'], answer: 0, why: 'Section 12.1: onset less than one minute, and a single administration lasts approximately 4 to 6 minutes.' },
      { q: 'Why does this chart use a log time axis by default?', choices: ['Labels are written in logs', 'Drug times span seconds to hours, so a log axis keeps short and long drugs readable together', 'It makes drugs look faster', 'Because duration is always exponential'], answer: 1, why: 'A log axis spaces 10 s, 1 min, 10 min and 1 h evenly, so propofol and ketorolac fit on the same picture.' },
    ]);
  },
};
