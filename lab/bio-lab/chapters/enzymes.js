// Chapter 11: enzymes. Michaelis Menten kinetics with Km and Vmax, temperature and pH curves,
// competitive and non-competitive inhibition, and a particle simulation of enzymes at work.
import { MONO, DISP, rgba, clamp, injectStyle, pointer } from './_shared.js';

const R = 8.314;
const TEMP_E = {
  human: { name: 'Human enzyme', Ea: 50000, Tm: 47, w: 2.4 },
  taq: { name: 'Taq polymerase', Ea: 50000, Tm: 90, w: 2.8 },
};
const PH_E = {
  pepsin: { name: 'Pepsin (stomach)', p1: 1.0, p2: 3.0 },
  amylase: { name: 'Salivary amylase', p1: 5.8, p2: 7.8 },
  trypsin: { name: 'Trypsin (small intestine)', p1: 7.0, p2: 9.0 },
};
function tempRate(e, T) { const K = T + 273.15; const arr = Math.exp((-e.Ea / R) * (1 / K - 1 / 310.15)); const nat = 1 / (1 + Math.exp((T - e.Tm) / e.w)); return [arr * nat, nat]; }
function phRate(e, pH) { return 1 / (1 + 10 ** (e.p1 - pH) + 10 ** (pH - e.p2)); }

export default {
  mount(ctx) {
    injectStyle();
    const cv = ctx.canvas();
    const g = cv.ctx;
    let mode = ctx.store.get('enz:mode', 'mm');
    const P = { Km: 2, Vmax: 60, S: 2, lb: false, T: 37, te: 'human', pH: 7, pe: 'amylase', I: 0, Ki: 1, it: 'comp' };

    // particle simulation
    const sim = { enz: [], sub: [], inh: [], prod: [], made: [], box: null };
    for (let i = 0; i < 10; i++) sim.enz.push({ x: Math.random(), y: Math.random(), a: Math.random() * 6.28, busy: 0, inh: 0, ninh: 0, vx: 0, vy: 0 });
    function factor() {
      if (mode === 'temp') { const e = TEMP_E[P.te]; const max = Math.max(...Array.from({ length: 101 }, (_, t) => tempRate(e, t)[0])); return tempRate(e, P.T)[0] / max; }
      if (mode === 'ph') { const e = PH_E[P.pe]; return phRate(e, P.pH) / phRate(e, (e.p1 + e.p2) / 2); }
      return P.Vmax / 60;
    }
    function natFrac() { if (mode === 'temp') return tempRate(TEMP_E[P.te], P.T)[1]; return 1; }
    function syncCounts() {
      const sTarget = Math.round(clamp(mode === 'temp' || mode === 'ph' ? 50 : 22 * P.S, 0, 220));
      while (sim.sub.length < sTarget) sim.sub.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3 });
      while (sim.sub.length > sTarget) sim.sub.pop();
      const iTarget = mode === 'inhib' ? Math.round(P.I * 12) : 0;
      while (sim.inh.length < iTarget) sim.inh.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, on: null });
      while (sim.inh.length > iTarget) { const q = sim.inh.pop(); if (q.on) { q.on.inh = 0; q.on.ninh = 0; } }
    }
    function simStep(dt, bw, bh) {
      syncCounts();
      const f = factor(); const nat = natFrac();
      const turnover = 0.5 / Math.max(0.05, f); // seconds an enzyme stays busy per substrate
      const rr = 18 / Math.min(bw, bh); // contact radius in box units
      const move = (p) => { p.vx += (Math.random() - 0.5) * 1.2 * dt; p.vy += (Math.random() - 0.5) * 1.2 * dt; p.vx *= 0.99; p.vy *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; if (p.x < 0 || p.x > 1) { p.vx *= -1; p.x = clamp(p.x, 0, 1); } if (p.y < 0 || p.y > 1) { p.vy *= -1; p.y = clamp(p.y, 0, 1); } };
      for (const e of sim.enz) { e.a += dt * 0.2; move(e); e.vx *= 0.9; e.vy *= 0.9; if (e.busy > 0) { e.busy -= dt; if (e.busy <= 0) { e.busy = 0; sim.prod.push({ x: e.x, y: e.y, life: 1.2 }); sim.made.push(performance.now()); } } }
      for (const s of sim.sub) {
        move(s);
        if (f < 0.02 || nat < 0.2) continue;
        for (const e of sim.enz) {
          if (e.busy || e.inh || (e.ninh && P.it === 'non')) continue;
          if ((s.x - e.x) ** 2 + (s.y - e.y) ** 2 < rr * rr && Math.random() < nat) { e.busy = turnover; s.x = Math.random(); s.y = Math.random() < 0.5 ? 0 : 1; break; }
        }
      }
      for (const q of sim.inh) {
        if (q.on) { q.x = q.on.x + (P.it === 'comp' ? rr * 0.6 : -rr * 0.6); q.y = q.on.y; if (Math.random() < dt * 0.8) { q.on.inh = 0; q.on.ninh = 0; q.on = null; } continue; }
        move(q);
        for (const e of sim.enz) {
          if ((q.x - e.x) ** 2 + (q.y - e.y) ** 2 < rr * rr) {
            if (P.it === 'comp' && !e.busy && !e.inh) { e.inh = 1; q.on = e; break; }
            if (P.it === 'non' && !e.ninh) { e.ninh = 1; q.on = e; break; }
          }
        }
      }
      for (let i = sim.prod.length - 1; i >= 0; i--) { sim.prod[i].life -= dt; if (sim.prod[i].life <= 0) sim.prod.splice(i, 1); }
      const now = performance.now(); while (sim.made.length && now - sim.made[0] > 4000) sim.made.shift();
    }
    function drawSim(x0, y0, bw, bh) {
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.strokeRect(x0, y0, bw, bh);
      const X = (u) => x0 + 10 + u * (bw - 20); const Y = (u) => y0 + 10 + u * (bh - 20);
      const nat = natFrac();
      for (const p of sim.prod) { g.fillStyle = rgba('#A3E635', p.life / 1.2); g.beginPath(); g.arc(X(p.x) + 8, Y(p.y) - 6, 2.4, 0, 7); g.arc(X(p.x) + 13, Y(p.y) + 2, 2.4, 0, 7); g.fill(); }
      for (const e of sim.enz) {
        const x = X(e.x); const y = Y(e.y); const r = 13;
        g.save(); g.translate(x, y); g.rotate(e.a);
        g.fillStyle = e.busy ? '#5EEAD4' : rgba('#5EEAD4', 0.55);
        g.beginPath();
        if (nat > 0.5) { g.moveTo(0, 0); g.arc(0, 0, r, 0.45, Math.PI * 2 - 0.45); g.closePath(); }
        else { for (let k = 0; k <= 24; k++) { const a = (k / 24) * Math.PI * 2; const rr = r * (1 + 0.35 * Math.sin(a * 5 + e.a * 3) * (1 - nat)); if (k) g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); }
        g.fill();
        if (e.busy) { g.fillStyle = '#FBBF24'; g.beginPath(); g.arc(r * 0.45, 0, 4, 0, 7); g.fill(); }
        g.restore();
      }
      for (const s of sim.sub) { g.fillStyle = '#FBBF24'; g.beginPath(); g.arc(X(s.x), Y(s.y), 3, 0, 7); g.fill(); }
      for (const q of sim.inh) { g.fillStyle = '#FB7185'; const x = X(q.x); const y = Y(q.y); g.beginPath(); if (P.it === 'comp') g.arc(x, y, 3.4, 0, 7); else g.rect(x - 3.5, y - 3.5, 7, 7); g.fill(); }
      const busy = sim.enz.filter((e) => e.busy).length;
      g.font = MONO(10.5); g.fillStyle = '#A0A09A'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(`${busy} of ${sim.enz.length} enzymes busy · ${(sim.made.length / 4).toFixed(1)} products per second`, x0 + 6, y0 + bh + 12);
      let lx = x0 + bw; g.textAlign = 'right';
      const lg = [['#5EEAD4', 'enzyme'], ['#FBBF24', 'substrate'], ['#A3E635', 'product']]; if (mode === 'inhib') lg.push(['#FB7185', 'inhibitor']);
      if (bw > 520) for (const [c, t] of lg.reverse()) { g.fillStyle = '#A0A09A'; g.fillText(t, lx, y0 + bh + 12); lx -= g.measureText(t).width + 8; g.fillStyle = c; g.beginPath(); g.arc(lx, y0 + bh + 12, 4, 0, 7); g.fill(); lx -= 16; }
    }

    // graph
    let gbox = null;
    const v = (S, Km, Vm) => (Vm * S) / (Km + S);
    function inhibited() { const a = 1 + P.I / P.Ki; return P.it === 'comp' ? [P.Km * a, P.Vmax] : [P.Km, P.Vmax / a]; }
    function drawGraph(x0, y0, w, h) {
      gbox = { x0, y0, w, h };
      const gx = x0 + 46; const gy = y0 + 10; const gw = w - 58; const gh = h - 40;
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx, gy + gh); g.lineTo(gx + gw, gy + gh); g.stroke();
      g.font = MONO(10.5); g.fillStyle = '#A0A09A'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const curve = (fx, fy, col, lw = 2, dash = []) => { g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash); g.beginPath(); for (let i = 0; i <= 200; i++) { const u = i / 200; const X = fx(u); const Y = fy(u); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); } g.stroke(); g.setLineDash([]); };
      if (mode === 'mm' || mode === 'inhib') {
        const [Km2, Vm2] = mode === 'inhib' ? inhibited() : [P.Km, P.Vmax];
        if (P.lb) {
          // Lineweaver Burk: 1/v against 1/[S]
          const xmin = -1 / Math.min(P.Km, Km2) * 1.3; const xmax = 4; const ymax = Math.max(1 / Vm2 + (Km2 / Vm2) * xmax, 1 / P.Vmax + (P.Km / P.Vmax) * xmax) * 1.08;
          const X = (a) => gx + ((a - xmin) / (xmax - xmin)) * gw; const Y = (b) => gy + gh - (b / ymax) * gh;
          g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(X(0), gy); g.lineTo(X(0), gy + gh); g.stroke();
          const line = (Km, Vm, col, dash) => curve((u) => X(-1 / Km + u * (xmax + 1 / Km)), (u) => Y(Math.max(0, (Km / Vm) * (-1 / Km + u * (xmax + 1 / Km)) + 1 / Vm)), col, 2, dash);
          if (mode === 'inhib') line(P.Km, P.Vmax, 'rgba(245,245,240,.45)', [5, 5]);
          line(Km2, Vm2, '#5EEAD4');
          g.fillStyle = '#F5F5F0'; g.beginPath(); g.arc(X(-1 / Km2), Y(0), 4, 0, 7); g.fill(); g.beginPath(); g.arc(X(0), Y(1 / Vm2), 4, 0, 7); g.fill();
          g.textAlign = 'left'; g.fillText(`-1/Km = ${(-1 / Km2).toFixed(2)}`, X(-1 / Km2) + 4, Y(0) - 12); g.fillText(`1/Vmax = ${(1 / Vm2).toFixed(3)}`, X(0) + 8, Y(1 / Vm2) - 10);
          g.textAlign = 'center'; g.fillText('1 / [S]', gx + gw / 2, gy + gh + 22);
          g.save(); g.translate(gx - 32, gy + gh / 2); g.rotate(-Math.PI / 2); g.fillText('1 / v', 0, 0); g.restore();
          return;
        }
        const smax = 10; const vmax = 110;
        const X = (s) => gx + (s / smax) * gw; const Y = (vv) => gy + gh - (vv / vmax) * gh;
        for (let s = 0; s <= smax; s += 2) g.fillText(`${s}`, X(s), gy + gh + 10);
        g.textAlign = 'right'; for (let vv = 0; vv <= 100; vv += 25) g.fillText(`${vv}`, gx - 6, Y(vv));
        g.textAlign = 'center'; g.fillText('[S] substrate concentration (mM)', gx + gw / 2, gy + gh + 24);
        g.save(); g.translate(gx - 34, gy + gh / 2); g.rotate(-Math.PI / 2); g.fillText('rate v (µmol/min)', 0, 0); g.restore();
        if (mode === 'inhib') curve((u) => X(u * smax), (u) => Y(v(u * smax, P.Km, P.Vmax)), 'rgba(245,245,240,.45)', 1.6, [5, 5]);
        g.strokeStyle = 'rgba(167,139,250,.6)'; g.setLineDash([4, 4]); g.lineWidth = 1;
        g.beginPath(); g.moveTo(gx, Y(Vm2)); g.lineTo(gx + gw, Y(Vm2)); g.stroke();
        g.beginPath(); g.moveTo(gx, Y(Vm2 / 2)); g.lineTo(X(Math.min(Km2, smax)), Y(Vm2 / 2)); g.lineTo(X(Math.min(Km2, smax)), gy + gh); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#A78BFA'; g.textAlign = 'left'; g.fillText(`Vmax ${Vm2.toFixed(0)}`, gx + gw - 70, Y(Vm2) - 9); g.fillText('Vmax/2', gx + 4, Y(Vm2 / 2) - 9);
        if (Km2 <= smax) { g.textAlign = 'center'; g.fillText(`Km ${Km2.toFixed(2)}`, X(Km2), gy + gh - 10); }
        curve((u) => X(u * smax), (u) => Y(v(u * smax, Km2, Vm2)), '#5EEAD4', 2.2);
        const vs = v(P.S, Km2, Vm2);
        g.fillStyle = '#FBBF24'; g.beginPath(); g.arc(X(P.S), Y(vs), 6, 0, 7); g.fill();
        g.strokeStyle = 'rgba(251,191,36,.5)'; g.beginPath(); g.moveTo(X(P.S), Y(vs)); g.lineTo(X(P.S), gy + gh); g.stroke();
        g.fillStyle = '#FBBF24'; g.textAlign = 'left'; g.fillText(`v = ${vs.toFixed(1)} (${Math.round((vs / Vm2) * 100)}% of Vmax)`, Math.min(X(P.S) + 10, gx + gw - 170), Y(vs) + 16);
        g.fillStyle = '#A0A09A'; g.fillText('drag the amber dot', gx + 6, gy + 6);
        return;
      }
      if (mode === 'temp') {
        const e = TEMP_E[P.te]; const pts = Array.from({ length: 101 }, (_, t) => tempRate(e, t)[0]); const mx = Math.max(...pts); const opt = pts.indexOf(mx);
        const X = (t) => gx + (t / 100) * gw; const Y = (r) => gy + gh - (r / 1.08) * gh;
        for (let t = 0; t <= 100; t += 20) g.fillText(`${t}`, X(t), gy + gh + 10);
        g.fillText('temperature (°C)', gx + gw / 2, gy + gh + 24);
        g.save(); g.translate(gx - 30, gy + gh / 2); g.rotate(-Math.PI / 2); g.fillText('relative rate', 0, 0); g.restore();
        g.fillStyle = 'rgba(251,113,133,.08)'; g.fillRect(X(e.Tm - 2 * e.w), gy, X(100) - X(e.Tm - 2 * e.w), gh);
        g.fillStyle = '#FB7185'; g.textAlign = 'left'; g.fillText('denaturing', Math.min(X(e.Tm - 2 * e.w) + 4, gx + gw - 74), gy + 8);
        curve((u) => X(u * 100), (u) => Y(tempRate(e, u * 100)[0] / mx), '#5EEAD4', 2.2);
        g.strokeStyle = 'rgba(167,139,250,.6)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(X(opt), gy); g.lineTo(X(opt), gy + gh); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#A78BFA'; g.textAlign = 'center'; g.fillText(`optimum about ${opt} °C`, X(opt), gy + gh - 10);
        const r = tempRate(e, P.T)[0] / mx; g.fillStyle = '#FBBF24'; g.beginPath(); g.arc(X(P.T), Y(r), 6, 0, 7); g.fill();
        return;
      }
      if (mode === 'ph') {
        const X = (p) => gx + (p / 14) * gw; const Y = (r) => gy + gh - (r / 1.08) * gh;
        for (let p = 0; p <= 14; p += 2) g.fillText(`${p}`, X(p), gy + gh + 10);
        g.fillText('pH', gx + gw / 2, gy + gh + 24);
        const cols = { pepsin: '#FB7185', amylase: '#FBBF24', trypsin: '#60A5FA' };
        for (const [k, e] of Object.entries(PH_E)) {
          const mx = phRate(e, (e.p1 + e.p2) / 2);
          curve((u) => X(u * 14), (u) => Y(phRate(e, u * 14) / mx), k === P.pe ? cols[k] : rgba(cols[k], 0.3), k === P.pe ? 2.4 : 1.4);
          g.fillStyle = cols[k]; g.textAlign = 'center'; g.fillText(e.name.split(' ')[0], X((e.p1 + e.p2) / 2), Y(1) - 10);
        }
        const e = PH_E[P.pe]; const r = phRate(e, P.pH) / phRate(e, (e.p1 + e.p2) / 2);
        g.fillStyle = '#F5F5F0'; g.beginPath(); g.arc(X(P.pH), Y(r), 6, 0, 7); g.fill();
      }
    }

    // UI
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Enzymes</h2>'),
      ctx.h('<p class="lede">Enzymes are proteins that speed up reactions, often millions of times, without being used up. Each has an active site that fits its substrate. Here is how fast they work, and what slows them down.</p>'),
    );
    const seg = ctx.seg([['mm', 'Substrate'], ['temp', 'Temperature'], ['ph', 'pH'], ['inhib', 'Inhibitors']], mode, (m) => { mode = m; ctx.store.set('enz:mode', m); show(); });
    ctx.panel.append(seg);
    const lbB = ctx.h('<label class="check"><input type="checkbox"> Lineweaver Burk plot (1/v against 1/[S])</label>');
    lbB.querySelector('input').addEventListener('change', (e) => { P.lb = e.target.checked; }, { signal: ctx.signal });
    const sS = ctx.slider({ label: '[S] substrate', min: 0, max: 10, step: 0.1, value: P.S, unit: ' mM', onInput: (x) => { P.S = x; renderStat(); } });
    const pMM = ctx.h('<div style="display:grid;gap:12px"></div>');
    pMM.append(
      ctx.slider({ label: 'Km (affinity, lower is tighter)', min: 0.2, max: 6, step: 0.1, value: P.Km, unit: ' mM', onInput: (x) => { P.Km = x; renderStat(); } }),
      ctx.slider({ label: 'Vmax (top speed)', min: 10, max: 100, step: 1, value: P.Vmax, onInput: (x) => { P.Vmax = x; renderStat(); } }),
    );
    const pT = ctx.h('<div style="display:grid;gap:12px"></div>');
    const tChips = ctx.seg(Object.entries(TEMP_E).map(([k, e]) => [k, e.name]), P.te, (k) => { P.te = k; });
    pT.append(tChips, ctx.slider({ label: 'Temperature', min: 0, max: 100, step: 1, value: P.T, unit: ' °C', onInput: (x) => { P.T = x; } }));
    const pP = ctx.h('<div style="display:grid;gap:12px"></div>');
    pP.append(ctx.seg(Object.entries(PH_E).map(([k, e]) => [k, e.name.split(' (')[0]]), P.pe, (k) => { P.pe = k; }), ctx.slider({ label: 'pH', min: 0, max: 14, step: 0.1, value: P.pH, onInput: (x) => { P.pH = x; } }));
    const pI = ctx.h('<div style="display:grid;gap:12px"></div>');
    pI.append(ctx.seg([['comp', 'Competitive'], ['non', 'Non-competitive']], P.it, (k) => { P.it = k; for (const q of sim.inh) { if (q.on) { q.on.inh = 0; q.on.ninh = 0; q.on = null; } } renderStat(); }),
      ctx.slider({ label: 'Inhibitor [I] (in units of Ki)', min: 0, max: 5, step: 0.1, value: P.I, fmt: (x) => `${x} Ki`, onInput: (x) => { P.I = x; renderStat(); } }));
    const stat = ctx.h('<div class="stat"></div>');
    ctx.panel.append(pMM, pT, pP, pI, sS, lbB, stat);
    function show() { pMM.hidden = mode !== 'mm'; pT.hidden = mode !== 'temp'; pP.hidden = mode !== 'ph'; pI.hidden = mode !== 'inhib'; sS.hidden = lbB.hidden = !(mode === 'mm' || mode === 'inhib'); renderStat(); }
    function renderStat() {
      if (mode === 'mm' || mode === 'inhib') { const [Km2, Vm2] = mode === 'inhib' ? inhibited() : [P.Km, P.Vmax]; stat.innerHTML = `<div><b>${Km2.toFixed(2)}</b><span>${mode === 'inhib' ? 'apparent ' : ''}Km (mM)</span></div><div><b>${Vm2.toFixed(0)}</b><span>${mode === 'inhib' ? 'apparent ' : ''}Vmax</span></div><div><b>${v(P.S, Km2, Vm2).toFixed(1)}</b><span>rate at [S]</span></div>`; }
      else stat.innerHTML = '';
    }
    show();

    pointer(cv.el, ctx.signal, {
      down: (x, y) => dragTo(x, y), move: (x, y) => dragTo(x, y),
    });
    function dragTo(x, y) {
      if (!gbox || y < gbox.y0) return;
      const gx = gbox.x0 + 46; const gw = gbox.w - 58; const u = clamp((x - gx) / gw, 0, 1);
      if ((mode === 'mm' || mode === 'inhib') && !P.lb) { P.S = Math.round(u * 100) / 10; sS.value = P.S; renderStat(); }
      else if (mode === 'temp') { P.T = Math.round(u * 100); }
      else if (mode === 'ph') { P.pH = Math.round(u * 140) / 10; }
    }

    ctx.panel.append(
      ctx.h('<div class="card tip"><p>More substrate means more collisions with enzymes, so the reaction speeds up, until every enzyme is busy. Then adding substrate does nothing: the enzyme is saturated and the rate is Vmax. Km is the substrate level that gives half that top speed; a low Km means the enzyme grabs its substrate even when there is little around. Heat speeds things up until the protein unfolds (denatures), and each enzyme has a pH it works best at.</p></div>'),
      ctx.h('<div class="card try"><ol class="small"><li>Substrate: drag the amber dot right. The rate climbs steeply, then flattens. In the box above, count the busy enzymes.</li><li>Inhibitors, competitive: raise [I]. The curve still reaches the same Vmax at high [S], but Km moves right. Switch to non-competitive: Vmax drops and Km stays.</li><li>Temperature: compare the human enzyme with Taq polymerase from a hot spring bacterium, the enzyme that makes PCR possible.</li></ol></div>'),
      ctx.h(`<details class="more"><summary>Going deeper</summary><div class="small">
        <div class="formula">v = Vmax [S] / (Km + [S])<span>Michaelis Menten. At [S] = Km, v = Vmax/2. Vmax = kcat [E]total.</span></div>
        <div class="formula">1/v = (Km/Vmax)(1/[S]) + 1/Vmax<span>Lineweaver Burk: a straight line. y-intercept 1/Vmax, x-intercept -1/Km.</span></div>
        <table class="bio-tbl"><tr><th>Inhibitor</th><th>Binds</th><th>Km</th><th>Vmax</th><th>LB plot</th></tr>
        <tr><td>Competitive</td><td>Active site</td><td>Up</td><td>Same</td><td>Lines cross on the y-axis</td></tr>
        <tr><td>Non-competitive</td><td>Elsewhere, E or ES</td><td>Same</td><td>Down</td><td>Lines cross on the x-axis</td></tr>
        <tr><td>Uncompetitive</td><td>ES only</td><td>Down</td><td>Down</td><td>Parallel lines</td></tr></table>
        <p><b>Drugs are often inhibitors.</b> Statins competitively inhibit HMG-CoA reductase. Methotrexate competes with folate for dihydrofolate reductase. Aspirin irreversibly acetylates cyclooxygenase, so platelets (which cannot make new protein) stay inhibited for their whole life. In methanol poisoning, ethanol or fomepizole compete for alcohol dehydrogenase.</p>
        <p><b>About the curves.</b> The temperature curve is the Arrhenius speed up (rate roughly doubles every 10 °C here) multiplied by the fraction of enzyme still folded. The pH curves use a two ionisable group model. The optimum values are typical textbook figures: pepsin about pH 2, salivary amylase about pH 7, trypsin about pH 8.</p></div></details>`),
    );
    ctx.quiz([
      { q: 'An enzyme has a Km of 2 mM. What is the rate at [S] = 2 mM?', choices: ['Vmax', 'Half of Vmax', 'A quarter of Vmax', 'Zero'], answer: 1, why: 'By definition Km is the substrate concentration that gives half the maximum rate.' },
      { q: 'Adding lots of extra substrate overcomes which kind of inhibitor?', choices: ['Competitive', 'Non-competitive', 'Irreversible', 'None of them'], answer: 0, why: 'Substrate outcompetes the inhibitor for the active site, so Vmax is still reached. Km rises.' },
      { q: 'Why does pepsin stop working when it reaches the small intestine?', choices: ['It is too cold', 'The pH rises to about 7 to 8, far from its optimum near 2', 'There is no protein left', 'Bile digests it immediately'], answer: 1, why: 'Pepsin works best in stomach acid. At the higher intestinal pH its active site loses the right charges.' },
    ]);

    ctx.loop((t, dt) => {
      const { w, h } = cv; if (!w) return;
      g.clearRect(0, 0, w, h);
      const sh = Math.min(h * 0.34, 230);
      simStep(dt, w - 20, sh);
      drawSim(10, 6, w - 20, sh);
      drawGraph(0, sh + 34, w, h - sh - 40);
    });
    return () => {};
  },
};
