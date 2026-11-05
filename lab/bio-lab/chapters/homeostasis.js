// Chapter 12: homeostasis. Blood glucose held steady by insulin and glucagon feedback.
// A minimal model (in the spirit of Bergman's minimal model) with meals, exercise and diabetes.
import { MONO, DISP, rgba, clamp, injectStyle, arrow } from './_shared.js';

const TYPES = {
  healthy: { name: 'No diabetes', SI: 7e-4, beta: 1, Gh: 90 },
  t1: { name: 'Type 1', SI: 7e-4, beta: 0, Gh: 90 },
  t2: { name: 'Type 2', SI: 2.1e-4, beta: 0.35, Gh: 200 },
};
const BASE = { SG: 0.012, p2: 0.025, n: 0.14, Ib: 10, gamma: 0.3, V: 119, kgn: 0.006 };
const WIN = 360; // minutes shown

export default {
  mount(ctx) {
    injectStyle();
    const cv = ctx.canvas();
    const g = cv.ctx;
    let type = ctx.store.get('glu:type', 'healthy');
    let speed = 5; let unit = 'mg';
    let s; let t; let hist; let exUntil = -1; let events; let acc = 0;
    const P = () => ({ ...BASE, ...TYPES[type] });

    function deriv(st, p, ex) {
      const Ra = (0.9 * st.Q2) / 45; // mg/min absorbed from the gut
      const renal = st.G > 180 ? 0.02 * (st.G - 180) : 0;
      const exU = ex ? 0.004 * st.G : 0;
      const dG = -p.SG * (st.G - p.Gh) - st.X * st.G + Ra / p.V + p.kgn * (st.Gn - 50) - exU - renal;
      const dX = -p.p2 * st.X + p.p2 * p.SI * (ex ? 1.6 : 1) * (st.I - p.Ib);
      const sec = p.beta * (p.n * p.Ib + p.gamma * Math.max(0, st.G - 88));
      const dI = -p.n * st.I + sec + 0.012 * st.D2;
      const target = (50 * (1 + clamp((85 - st.G) / 12, 0, 3))) / (1 + Math.max(0, st.I - p.Ib) / 30) + (ex ? 25 : 0);
      const dGn = (target - st.Gn) / 8;
      const dL = clamp(0.004 * (st.I - p.Ib) * (st.G > 100 ? 1 : 0.3) - 0.004 * (st.Gn - 50) - (ex ? 0.03 : 0), -0.3, 0.3);
      return { G: dG, X: dX, I: dI, Gn: dGn, Q1: -st.Q1 / 45, Q2: st.Q1 / 45 - st.Q2 / 45, D: -0.012 * st.D, D2: 0.012 * st.D - 0.012 * st.D2, L: dL, _ra: Ra, _ren: renal, _sec: sec, _up: st.X * st.G + exU };
    }
    function integrate(mins, record) {
      const p = P(); const h = 0.5;
      acc += mins;
      while (acc >= h) {
        acc -= h;
        const ex = t < exUntil;
        const d = deriv(s, p, ex);
        for (const key of ['G', 'X', 'I', 'Gn', 'Q1', 'Q2', 'D', 'D2', 'L']) s[key] += d[key] * h;
        s.G = Math.max(20, s.G); s.I = Math.max(0, s.I); s.L = clamp(s.L, 10, 110);
        s.flux = d; t += h;
        if (record && Math.round(t * 2) % 4 === 0) hist.push([t, s.G, s.I, s.Gn]);
      }
      while (hist.length && hist[0][0] < t - WIN) hist.shift();
    }
    function reset() {
      s = { G: 90, X: 0, I: 10, Gn: 50, Q1: 0, Q2: 0, D: 0, D2: 0, L: 80 };
      t = 0; hist = []; exUntil = -1; events = []; acc = 0;
      integrate(3000, false); acc = 0; t = 0; hist = []; s.L = 80;
      hist.push([0, s.G, s.I, s.Gn]);
    }
    reset();

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Blood glucose</h2>'),
      ctx.h('<p class="lede">Your blood sugar stays in a narrow range whether you have just eaten or have not eaten for hours. Two pancreatic hormones push in opposite directions to hold it there. Eat, exercise and see the feedback at work.</p>'),
    );
    const seg = ctx.seg(Object.entries(TYPES).map(([k, v]) => [k, v.name]), type, (k) => { type = k; ctx.store.set('glu:type', k); reset(); insB.hidden = type === 'healthy'; });
    ctx.panel.append(seg);
    const row = ctx.h('<div class="row"></div>');
    const meal = ctx.h('<button class="btn sm">Eat a meal</button>');
    meal.onclick = () => { s.Q1 += 75000; events.push([t, 'meal']); };
    const snack = ctx.h('<button class="btn ghost sm">Snack</button>');
    snack.onclick = () => { s.Q1 += 25000; events.push([t, 'snack']); };
    const exB = ctx.h('<button class="btn ghost sm">Exercise 45 min</button>');
    exB.onclick = () => { exUntil = t + 45; events.push([t, 'exercise']); };
    const insB = ctx.h('<button class="btn ghost sm">Rapid insulin</button>');
    insB.onclick = () => { s.D += 600; events.push([t, 'insulin']); };
    insB.hidden = type === 'healthy';
    const rst = ctx.h('<button class="btn ghost sm">Reset</button>'); rst.onclick = reset;
    row.append(meal, snack, exB, insB, rst);
    ctx.panel.append(row,
      ctx.slider({ label: 'Speed', min: 1, max: 20, step: 1, value: speed, fmt: (v) => `${v} min per second`, onInput: (v) => { speed = v; } }),
      ctx.seg([['mg', 'mg/dL'], ['mmol', 'mmol/L']], unit, (u) => { unit = u; }));
    const stat = ctx.h('<div class="stat"></div>');
    ctx.panel.append(stat);
    ctx.panel.append(
      ctx.h('<div class="card tip"><p>After a meal, glucose rises and the pancreas\'s beta cells release insulin. Insulin tells muscle and fat to take glucose in and the liver to store it as glycogen, so the level falls back. When glucose drops, alpha cells release glucagon, which tells the liver to break glycogen down and release glucose. This is negative feedback: each change triggers a response that undoes it.</p></div>'),
      ctx.h('<div class="card try"><ol class="small"><li>Eat a meal. Glucose rises to about 140 to 150 mg/dL, insulin spikes, glucagon falls, and in two or three hours all is back to baseline.</li><li>Exercise. Muscles take in glucose even without much insulin, glucagon rises, and the liver releases stored glycogen to keep glucose from falling far.</li><li>Switch to Type 1, wait, then eat. With no insulin, glucose stays high and spills into the urine above about 180 mg/dL. Try a dose of rapid insulin. Then try Type 2: insulin is there, often high, but the body responds weakly to it.</li></ol></div>'),
      ctx.h(`<div class="card deep"><p class="small"><b>Reference values</b> (venous plasma, adults, as used by the American Diabetes Association and WHO):</p>
        <table class="bio-tbl"><tr><th></th><th>Fasting</th><th>2 h after 75 g glucose</th></tr>
        <tr><td>Normal</td><td>70 to 99 mg/dL (3.9 to 5.5 mmol/L)</td><td>under 140 mg/dL (7.8)</td></tr>
        <tr><td>Prediabetes</td><td>100 to 125 (5.6 to 6.9)</td><td>140 to 199 (7.8 to 11.0)</td></tr>
        <tr><td>Diabetes</td><td>126 or more (7.0)</td><td>200 or more (11.1)</td></tr></table>
        <p class="small">HbA1c reflects the average over about three months: 6.5% (48 mmol/mol) or more meets the diabetes threshold. To convert, mmol/L = mg/dL ÷ 18.</p>
        <p class="small"><b>Type 1</b> is autoimmune destruction of beta cells: almost no insulin, so lifelong insulin is needed. Without it, fat breakdown makes ketones and can cause diabetic ketoacidosis. <b>Type 2</b> is insulin resistance plus beta cells that cannot keep up; it is managed with lifestyle, metformin and other drugs, and sometimes insulin. Glucose above the kidney threshold (about 180 mg/dL) spills into urine and drags water with it, which is why untreated diabetes causes thirst and frequent urination.</p>
        <p class="small"><b>About this model.</b> It uses a handful of equations: glucose from the gut and liver, uptake driven by insulin action that lags insulin itself, insulin secretion rising with glucose, glucagon rising when glucose is low and insulin is low, and urinary loss above 180 mg/dL. The shapes are realistic; the numbers are illustrative. It is a teaching tool, not medical advice, and must never be used to work out real insulin doses.</p></div>`),
    );
    ctx.quiz([
      { q: 'Blood glucose falls during a long fast. Which response keeps it up?', choices: ['Beta cells release more insulin', 'Alpha cells release glucagon, and the liver breaks down glycogen', 'Muscles take up more glucose', 'The kidneys excrete more glucose'], answer: 1, why: 'Glucagon drives glycogenolysis (and later gluconeogenesis) in the liver, releasing glucose into the blood.' },
      { q: 'A fasting plasma glucose of 7.4 mmol/L (133 mg/dL), confirmed on a repeat test, is in which range?', choices: ['Normal', 'Prediabetes', 'Diabetes range', 'Hypoglycaemia'], answer: 2, why: 'A fasting value of 7.0 mmol/L (126 mg/dL) or more on two occasions meets the diagnostic threshold.' },
      { q: 'What best describes type 2 diabetes?', choices: ['No insulin at all because beta cells were destroyed', 'Insulin resistance with beta cells that cannot make enough extra insulin', 'Too much glucagon only', 'A problem with glucose absorption in the gut'], answer: 1, why: 'Tissues respond weakly to insulin, and the beta cells eventually fail to compensate. Type 1 is the autoimmune loss of beta cells.' },
    ]);

    const fmtG = (v) => (unit === 'mg' ? `${v.toFixed(0)}` : `${(v / 18).toFixed(1)}`);
    let lastStat = '';
    function renderStat() {
      const st = `<div><b>${fmtG(s.G)}</b><span>glucose ${unit === 'mg' ? 'mg/dL' : 'mmol/L'}</span></div><div><b>${s.I.toFixed(0)}</b><span>insulin µU/mL</span></div><div><b>${s.Gn.toFixed(0)}</b><span>glucagon pg/mL</span></div><div><b>${s.L.toFixed(0)} g</b><span>liver glycogen</span></div><div><b>${Math.floor(t / 60)}h ${String(Math.floor(t % 60)).padStart(2, '0')}</b><span>time</span></div>`;
      if (st !== lastStat) { stat.innerHTML = st; lastStat = st; }
    }

    function drawScheme(x0, y0, w, h) {
      const f = s.flux || {};
      const ins = clamp((s.I - 5) / 80, 0, 1); const glc = clamp((s.Gn - 30) / 100, 0, 1);
      const cx = x0 + w / 2; const cy = y0 + h * 0.5;
      // blood vessel in the middle with glucose dots
      const bw = Math.min(w * 0.36, 260); const bh = h * 0.36;
      g.fillStyle = 'rgba(251,113,133,.08)'; g.strokeStyle = 'rgba(251,113,133,.5)'; g.lineWidth = 1.5;
      g.beginPath(); g.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, bh / 2); g.fill(); g.stroke();
      const n = Math.round(clamp(s.G / 8, 2, 50));
      for (let i = 0; i < n; i++) { const a = (i * 2.399) % 6.283; const r = ((i * 37) % 100) / 100; g.fillStyle = '#FBBF24'; g.beginPath(); g.arc(cx + Math.cos(a) * r * (bw / 2 - 14) + Math.sin(t * 0.3 + i) * 3, cy + Math.sin(a) * r * (bh / 2 - 8), 2.6, 0, 7); g.fill(); }
      g.font = MONO(10.5); g.fillStyle = '#E8E8E3'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(`blood glucose ${fmtG(s.G)} ${unit === 'mg' ? 'mg/dL' : 'mmol/L'}`, cx, cy + bh / 2 + 12);
      const box = (x, y, label, col, a) => { const W = Math.min(w * 0.22, 150); g.fillStyle = rgba(col, 0.06 + 0.25 * a); g.strokeStyle = rgba(col, 0.4 + 0.6 * a); g.lineWidth = 1.2; g.beginPath(); g.roundRect(x - W / 2, y - 18, W, 36, 8); g.fill(); g.stroke(); g.fillStyle = '#F5F5F0'; g.font = DISP(clamp(w / 50, 11, 15), 700); g.fillText(label.toUpperCase(), x, y); return W; };
      const lx = x0 + Math.max(w * 0.13, 70); const rx = x0 + w - Math.max(w * 0.13, 70);
      const gutA = clamp(f._ra / 600, 0, 1); const upA = clamp(f._up / 4, 0, 1); const renA = clamp(f._ren / 3, 0, 1);
      box(lx, y0 + h * 0.2, 'Gut', '#FBBF24', gutA);
      box(lx, y0 + h * 0.8, 'Liver', '#A3E635', clamp(Math.abs(f.L || 0) * 8, 0, 1));
      box(rx, y0 + h * 0.2, 'Pancreas', '#5EEAD4', Math.max(ins, glc));
      box(rx, y0 + h * 0.8, 'Muscle, fat', '#60A5FA', upA);
      // arrows
      const flow = (x1, y1, x2, y2, a, col) => { if (a < 0.03) return; g.strokeStyle = rgba(col, 0.25 + 0.75 * a); g.fillStyle = g.strokeStyle; g.lineWidth = 1 + 3 * a; arrow(g, x1, y1, x2, y2, 8); };
      flow(lx + 30, y0 + h * 0.2 + 12, cx - bw / 2 - 6, cy - 6, gutA, '#FBBF24');
      const liverOut = (s.flux && s.flux.L < 0) ? clamp(-s.flux.L * 6, 0, 1) : 0; const liverIn = (s.flux && s.flux.L > 0) ? clamp(s.flux.L * 6, 0, 1) : 0;
      flow(lx + 30, y0 + h * 0.8 - 12, cx - bw / 2 - 6, cy + 8, liverOut, '#A3E635');
      flow(cx - bw / 2 - 6, cy + 14, lx + 34, y0 + h * 0.8 - 4, liverIn, '#A3E635');
      flow(cx + bw / 2 + 6, cy + 8, rx - 30, y0 + h * 0.8 - 12, upA, '#60A5FA');
      // hormones from pancreas
      g.font = MONO(10.5); g.textAlign = 'center';
      g.fillStyle = rgba('#5EEAD4', 0.4 + 0.6 * ins); g.fillText(`insulin ${s.I.toFixed(0)}`, rx, y0 + h * 0.2 + 30);
      g.fillStyle = rgba('#FB7185', 0.4 + 0.6 * glc); g.fillText(`glucagon ${s.Gn.toFixed(0)}`, rx, y0 + h * 0.2 + 44);
      g.fillStyle = '#A0A09A'; g.fillText(`glycogen ${s.L.toFixed(0)} g`, lx, y0 + h * 0.8 + 30);
      if (renA > 0.02) { g.fillStyle = rgba('#FBBF24', 0.5 + 0.5 * renA); g.fillText('glucose spilling into urine', cx, y0 + h * 0.08); }
      if (t < exUntil) { g.fillStyle = '#60A5FA'; g.fillText('exercising', rx, y0 + h * 0.8 + 30); }
    }

    function drawGraph(x0, y0, w, h) {
      const gx = x0 + 44; const gy = y0 + (w < 500 ? 32 : 18); const gw = w - 56; const gh = h - 40;
      const t0 = Math.max(0, t - WIN); const X = (tt) => gx + ((tt - t0) / WIN) * gw;
      const gmax = Math.max(320, ...hist.map((r) => r[1] * 1.1)); const Y = (v) => gy + gh - (v / gmax) * gh;
      g.fillStyle = 'rgba(74,222,128,.07)'; g.fillRect(gx, Y(140), gw, Y(70) - Y(140));
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.font = MONO(10); g.fillStyle = '#5A5A55'; g.textAlign = 'right'; g.textBaseline = 'middle';
      for (const v of [70, 140, 180, 250]) { g.beginPath(); g.moveTo(gx, Y(v)); g.lineTo(gx + gw, Y(v)); g.stroke(); g.fillText(unit === 'mg' ? `${v}` : (v / 18).toFixed(1), gx - 6, Y(v)); }
      g.textAlign = 'left'; g.fillStyle = 'rgba(74,222,128,.7)'; g.fillText('usual range', gx + 4, Y(140) + 9);
      g.fillStyle = '#A0A09A'; g.fillText('kidney threshold', gx + 4, Y(180) - 8);
      g.textAlign = 'center';
      for (let m = Math.ceil(t0 / 60) * 60; m <= t0 + WIN; m += 60) g.fillText(`${m / 60}h`, X(m), gy + gh + 12);
      const line = (idx, col, sc, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); hist.forEach((r, i) => { const y = Y(clamp(r[idx] * sc, 0, gmax)); if (i) g.lineTo(X(r[0]), y); else g.moveTo(X(r[0]), y); }); g.stroke(); };
      line(3, rgba('#FB7185', 0.8), 1, 1.4);
      line(2, rgba('#5EEAD4', 0.85), 1.5, 1.4);
      line(1, '#FBBF24', 1, 2.4);
      for (const [tt, lab] of events) { if (tt < t0) continue; const x = X(tt); g.strokeStyle = 'rgba(245,245,240,.3)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, gy); g.lineTo(x, gy + gh); g.stroke(); g.setLineDash([]); g.fillStyle = '#E8E8E3'; g.textAlign = 'left'; g.fillText(lab, x + 3, gy + 4); }
      let lx = gx; g.textAlign = 'left';
      let ly = y0 + 5;
      for (const [lab, col] of [[`glucose (${unit === 'mg' ? 'mg/dL' : 'mmol/L'})`, '#FBBF24'], ['insulin (scaled)', '#5EEAD4'], ['glucagon (scaled)', '#FB7185']]) { const tw = g.measureText(lab).width; if (lx + tw + 14 > x0 + w) { lx = gx; ly += 13; } g.fillStyle = col; g.fillRect(lx, ly - 2, 10, 3); g.fillStyle = '#A0A09A'; g.fillText(lab, lx + 14, ly); lx += tw + (w < 500 ? 18 : 30); }
    }

    ctx.loop((tt, dt) => {
      const { w, h } = cv; if (!w) return;
      integrate(dt * speed, true);
      renderStat();
      g.clearRect(0, 0, w, h);
      const sh = Math.min(h * 0.4, 280);
      drawScheme(0, 0, w, sh);
      drawGraph(0, sh + 6, w, h - sh - 10);
      g.font = MONO(10); g.fillStyle = '#5A5A55'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('Educational model, not medical advice', 6, 8);
    });
    return () => {};
  },
};
