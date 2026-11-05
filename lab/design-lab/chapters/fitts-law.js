import { linfit, mean, shuffle, drawPlot } from './_shared.js';

const WS = [16, 32, 64];
const DF = [0.22, 0.48, 0.9];

export default {
  mount(ctx) {
    const cv = ctx.canvas(); const g = cv.ctx; const C = ctx.colors;
    let trials = []; let ti = -1; let state = 'idle'; let start = null; let tgt = null; let t0 = 0; let misses = []; let flash = 0;
    let data = ctx.store.get('fitts', []); // [{id, mt, d, w}]

    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">Fitts\'s law</h2>'), ctx.h('<p class="lede">How long it takes to hit a target depends on how far it is and how big it is. Small and far is slow, big and near is fast, and the trade off is precise.</p>'));
    const row = ctx.h('<div class="row"><button class="btn">Start 18 trials</button><button class="btn ghost sm">Clear</button></div>');
    const prog = ctx.h('<p class="hint">Not started</p>');
    const plotHost = ctx.h('<div class="dl-plot" style="height:220px;background:var(--surface-2);border-radius:10px"></div>');
    const fitBox = ctx.h('<div class="formula"></div>');
    const stat = ctx.h('<div class="stat"></div>');
    P.append(row, prog, plotHost, fitBox, stat);
    const pcv = ctx.canvas({ parent: plotHost });
    P.append(ctx.h('<div class="card tip"><p>Aiming is a series of corrections: a fast ballistic move toward the target, then smaller and smaller adjustments. The ratio of distance to width decides how many corrections you need. Doubling the distance costs about the same as halving the size.</p><p>That is why big buttons near where your hand already is feel effortless, and tiny icons in the far corner feel fiddly.</p></div>'));
    P.append(ctx.h('<div class="card try"><p>Press <b>Start</b>. Click the teal circle, then the amber target as fast as you can while staying accurate. Each trial changes the distance and size. After 18 trials, your own line is fitted to the plot. A high R² (close to 1) means the law describes your hand well.</p></div>'));
    P.append(ctx.h(`<div class="card deep"><div class="formula">MT = a + b · log2(D / W + 1)<span>ID = log2(D / W + 1) is the index of difficulty, in bits.</span></div>
      <p>Paul Fitts published the law in 1954, based on tapping between metal plates. The <b>D / W + 1</b> form is the Shannon formulation proposed by Scott MacKenzie (1992), now standard in HCI and in ISO 9241-411 tests of pointing devices. <b>Throughput</b> (ID / MT, in bits per second) lets you compare a mouse, trackpad and finger fairly.</p>
      <p><b>Design consequences:</b> make primary actions large; put related controls close together; use screen edges and corners (the cursor stops there, so the effective width is huge, which is why macOS puts its menu bar at the top edge); make the whole row clickable, not just the text; pop up menus at the pointer. On touch, use targets of at least 44 by 44 points (Apple) or 48 by 48 dp (Material). WCAG 2.2 sets a minimum of 24 by 24 CSS pixels (2.5.8).</p></div>`));

    function renderPlot() {
      const fit = data.length >= 3 ? linfit(data.map((d) => d.id), data.map((d) => d.mt)) : null;
      const ids = [...new Set(data.map((d) => d.id.toFixed(2)))];
      const means = ids.map((k) => { const s = data.filter((d) => d.id.toFixed(2) === k); return [+k, mean(s.map((d) => d.mt))]; });
      drawPlot(pcv, C, { xs: data.map((d) => d.id), ys: data.map((d) => d.mt), means, fit, xMin: 0, xMax: Math.max(6, ...data.map((d) => d.id + 0.3)), xTicks: [1, 2, 3, 4, 5, 6], xLabel: 'ID (bits)', yLabel: 'ms', empty: 'Your trials will appear here' });
      fitBox.innerHTML = fit ? `MT ≈ ${Math.round(fit.a)} ${fit.b < 0 ? '-' : '+'} ${Math.abs(Math.round(fit.b))} · ID ms<span>R² = ${fit.r2.toFixed(2)} from ${data.length} trials</span>` : 'MT = a + b · log2(D / W + 1)<span>Your fit appears after a few trials.</span>';
      const tp = data.length ? mean(data.map((d) => d.id / (d.mt / 1000))) : 0;
      stat.innerHTML = `<div><b>${data.length}</b><span>Trials</span></div><div><b>${tp ? tp.toFixed(1) : '-'}</b><span>Bits / s</span></div><div><b>${data.length ? Math.round(mean(data.map((d) => d.mt))) : '-'}</b><span>Mean ms</span></div>`;
    }
    pcv.onResize(renderPlot);

    function place() {
      const { w, h } = cv; const pad = 40;
      const maxD = Math.min(Math.hypot(w - 2 * pad, h - 2 * pad) * 0.92, Math.max(w, h) - 2 * pad);
      const tr = trials[ti]; const D = tr.df * maxD; const W = tr.w;
      for (let k = 0; k < 400; k++) {
        const sx = pad + Math.random() * (w - 2 * pad); const sy = pad + 30 + Math.random() * (h - 2 * pad - 30);
        const a = Math.random() * Math.PI * 2; const tx = sx + Math.cos(a) * D; const ty = sy + Math.sin(a) * D;
        if (tx > pad && tx < w - pad && ty > pad + 30 && ty < h - pad) { start = { x: sx, y: sy }; tgt = { x: tx, y: ty, r: W / 2, D, W }; return; }
      }
      // fallback: horizontal through the middle with a shorter distance
      const Dd = Math.min(D, w - 2 * pad); start = { x: w / 2 - Dd / 2, y: h / 2 }; tgt = { x: w / 2 + Dd / 2, y: h / 2, r: W / 2, D: Dd, W };
    }
    function next() {
      ti++;
      if (ti >= trials.length) { state = 'idle'; start = tgt = null; ctx.store.set('fitts', data); prog.textContent = 'Done. Your results are saved in this browser. Run again to add more points.'; row.firstChild.textContent = 'Run 18 more'; ctx.done(); return; }
      place(); state = 'start'; misses = [];
      prog.textContent = `Trial ${ti + 1} of ${trials.length}`;
    }
    row.children[0].addEventListener('click', () => {
      trials = shuffle(WS.flatMap((w) => DF.map((df) => ({ w, df })))); trials = shuffle([...trials, ...trials]);
      ti = -1; next();
    }, { signal: ctx.signal });
    row.children[1].addEventListener('click', () => { data = []; ctx.store.set('fitts', data); renderPlot(); }, { signal: ctx.signal });

    cv.el.style.touchAction = 'none';
    cv.el.addEventListener('pointerdown', (e) => {
      const r = cv.el.getBoundingClientRect(); const x = e.clientX - r.left; const y = e.clientY - r.top;
      if (state === 'start' && Math.hypot(x - start.x, y - start.y) <= 18) { state = 'aim'; t0 = performance.now(); return; }
      if (state === 'aim') {
        if (Math.hypot(x - tgt.x, y - tgt.y) <= tgt.r) {
          const mt = performance.now() - t0; const id = Math.log2(tgt.D / tgt.W + 1);
          data.push({ id, mt: Math.round(mt), d: Math.round(tgt.D), w: tgt.W, miss: misses.length });
          flash = 1; renderPlot(); next();
        } else misses.push({ x, y, t: 1 });
      }
    }, { signal: ctx.signal });

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    ctx.loop((t, dt) => {
      const { w, h } = cv; if (!w) return;
      g.clearRect(0, 0, w, h);
      flash = Math.max(0, flash - dt * 3);
      if (state === 'idle') {
        g.fillStyle = C.muted; g.font = '500 12px "DM Mono", monospace'; g.textAlign = 'center';
        g.fillText(data.length ? 'Press Start in the panel to run more trials' : 'Press Start in the panel to begin', w / 2, h / 2);
        // a demonstration of the two factors
        const y = h / 2 + 50; g.fillStyle = 'rgba(94,234,212,.5)';
        [[w / 2 - 120, 8], [w / 2 - 40, 18], [w / 2 + 60, 32]].forEach(([x, r]) => { g.beginPath(); g.arc(x, y + 20, r, 0, Math.PI * 2); g.fill(); });
        return;
      }
      g.font = '500 11px "DM Mono", monospace'; g.textAlign = 'left'; g.fillStyle = C.muted;
      g.fillText(`D = ${Math.round(tgt.D)}px   W = ${tgt.W}px   ID = ${Math.log2(tgt.D / tgt.W + 1).toFixed(2)} bits`, 10, 18);
      // guide line
      g.setLineDash([3, 6]); g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(start.x, start.y); g.lineTo(tgt.x, tgt.y); g.stroke(); g.setLineDash([]);
      if (state === 'start') {
        const pulse = reduce ? 0 : Math.sin(t * 5) * 2;
        g.beginPath(); g.arc(start.x, start.y, 18 + pulse, 0, Math.PI * 2); g.fillStyle = C.c1; g.fill();
        g.fillStyle = C.bg; g.textAlign = 'center'; g.fillText('start', start.x, start.y + 4);
        g.beginPath(); g.arc(tgt.x, tgt.y, tgt.r, 0, Math.PI * 2); g.strokeStyle = 'rgba(251,191,36,.35)'; g.lineWidth = 1.5; g.stroke();
      } else {
        g.beginPath(); g.arc(start.x, start.y, 5, 0, Math.PI * 2); g.fillStyle = 'rgba(94,234,212,.5)'; g.fill();
        g.beginPath(); g.arc(tgt.x, tgt.y, tgt.r, 0, Math.PI * 2); g.fillStyle = C.c2; g.fill();
      }
      for (const m of misses) { m.t = Math.max(0.3, m.t - dt); g.strokeStyle = `rgba(251,113,133,${m.t})`; g.lineWidth = 2; g.beginPath(); g.moveTo(m.x - 5, m.y - 5); g.lineTo(m.x + 5, m.y + 5); g.moveTo(m.x + 5, m.y - 5); g.lineTo(m.x - 5, m.y + 5); g.stroke(); }
      if (flash > 0) { g.fillStyle = `rgba(74,222,128,${flash * 0.12})`; g.fillRect(0, 0, w, h); }
    });
    renderPlot();

    ctx.quiz([
      { q: 'A target doubles in distance and doubles in width. What happens to the index of difficulty?', choices: ['It doubles', 'It stays the same', 'It halves'], answer: 1, why: 'ID depends on D / W, and that ratio is unchanged.' },
      { q: 'Why are screen edges and corners fast to hit with a mouse?', choices: ['They are brighter', 'The pointer stops at the edge, so the target is effectively infinitely deep', 'Browsers prioritise them'], answer: 1, why: 'Overshooting is impossible at an edge, so the effective width is huge.' },
      { q: 'Which change best applies Fitts\'s law to a list of settings?', choices: ['Make only the small text label clickable', 'Make the whole row clickable', 'Move the toggle to the far corner'], answer: 1, why: 'A larger hit area lowers the index of difficulty and the time to acquire it.' },
    ]);
  },
};
