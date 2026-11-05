import { createBoard, tasks, split, plot } from '../board.js';
import { fmt } from '../solver.js';
import { path } from '../presets.js';

const CIRCUIT = {
  cols: 9, rows: 6,
  parts: [
    { id: 'B', type: 'battery', pts: [[1, 5], [1, 1]], V: 6, r: 0.01 },
    ...path([1, 1], [2, 1]),
    { id: 'SW', type: 'spdt', pts: [[4, 2], [2, 1], [2, 3]], pos: 0 },
    ...path([2, 3], [2, 5]),
    { id: 'R', type: 'resistor', pts: [[4, 2], [6, 2]], R: 10000 },
    ...path([6, 2], [7, 2]),
    { id: 'C', type: 'capacitor', pts: [[7, 2], [7, 4]], C: 220e-6 },
    ...path([7, 4], [7, 5], [2, 5], [1, 5]),
    ...path([7, 2], [8, 2]), { id: 'VM', type: 'voltmeter', pts: [[8, 2], [8, 4]] }, ...path([8, 4], [7, 4]),
  ],
};

export default {
  mount(ctx) {
    const Cc = ctx.colors;
    let side = null; let rec = null; let sampleT = 0;
    const flags = { charged: false, discharged: false, bigC: false };
    const tau = () => { const R = b.part('R'); const C = b.part('C'); return R && C ? R.R * C.C : 1; };
    function restart(bb) {
      const SW = bb.part('SW'); const C = bb.part('C'); if (!SW || !C) return;
      rec = { t0: bb.time, mode: SW.pos ? 'discharge' : 'charge', v0: C.v || 0, R: bb.part('R').R, C: C.C, Vs: bb.part('B').V, data: [] };
    }
    const b = createBoard(ctx, {
      circuit: CIRCUIT, editable: false, dotScale: 8000,
      onReset() { sR.value = 4; sC.value = Math.log10(220e-6); },
      layout(avail) { const s = split(avail, 0.44, 250); side = s.side; return s.circuit; },
      onLoad(bb) { rec = null; requestAnimationFrame(() => restart(bb)); },
      onStep(bb, h) {
        const SW = bb.part('SW'); const C = bb.part('C'); const R = bb.part('R'); const B = bb.part('B'); if (!SW || !C || !R || !B) return;
        if (!rec || (SW.pos ? 'discharge' : 'charge') !== rec.mode || rec.R !== R.R || rec.C !== C.C || rec.Vs !== B.V) restart(bb);
        const t = bb.time - rec.t0; sampleT += h;
        if (sampleT >= Math.max(0.01, (rec.R * rec.C) / 120) && t <= 5.2 * rec.R * rec.C) { sampleT = 0; rec.data.push([t, C.v, C.i]); }
        const T = rec.R * rec.C;
        if (rec.mode === 'charge' && t >= T && rec.v0 < 0.1 * rec.Vs) { flags.charged = true; if (C.C >= 440e-6) flags.bigC = true; }
        if (rec.mode === 'discharge' && t >= T && rec.v0 > 0.5 * rec.Vs) flags.discharged = true;
      },
      draw(g) {
        if (!side || !rec) return;
        const T = rec.R * rec.C; const Vs = rec.Vs || 1; const I0 = Vs / rec.R;
        const r = { x: side.x + 34, y: side.y + 32, w: side.w - 50, h: side.h - 74 };
        const theory = [];
        for (let k = 0; k <= 100; k++) { const t = (k / 100) * 5 * T; theory.push([t, rec.mode === 'charge' ? Vs + (rec.v0 - Vs) * Math.exp(-t / T) : rec.v0 * Math.exp(-t / T)]); }
        const pr = plot(g, r, {
          xmin: 0, xmax: 5 * T, ymin: rec.mode === 'charge' ? 0 : -Vs, ymax: Vs * 1.05, colors: Cc,
          xticks: [1, 2, 3, 4, 5].map((k) => [k * T, `${k}τ`]),
          yticks: [[Vs, fmt(Vs, 'V')], [0.632 * Vs, '63%'], [0.368 * Vs, '37%'], [0, '0']],
          ylabel: rec.mode === 'charge' ? 'charging: capacitor voltage' : 'discharging: capacitor voltage',
          xlabel: `time, τ = RC = ${fmt(T, 's')}`,
          series: [
            { data: theory, color: '#5A5A55', width: 1.5, dash: [5, 4] },
            { data: rec.data.map(([t, , i]) => [t, (i / I0) * Vs]), color: Cc.c2, width: 1.6 },
            { data: rec.data.map(([t, v]) => [t, v]), color: Cc.c1, width: 2.4 },
          ],
        });
        const last = rec.data[rec.data.length - 1];
        g.save(); g.font = '500 11px "DM Mono", monospace';
        if (last) { g.fillStyle = Cc.c1; g.beginPath(); g.arc(pr.X(last[0]), pr.Y(last[1]), 4, 0, Math.PI * 2); g.fill(); }
        g.textAlign = 'left'; g.textBaseline = 'top';
        const ly = r.y + r.h + 30;
        g.fillStyle = Cc.c1; g.fillText('voltage', r.x, ly);
        g.fillStyle = Cc.c2; g.fillText(rec.mode === 'charge' ? 'current (scaled)' : 'current (scaled, flows back)', r.x + 66, ly);
        g.fillStyle = '#7A7A75'; if (side.w > 300) g.fillText('theory', r.x + (rec.mode === 'charge' ? 196 : 270), ly);
        g.restore();
      },
    });
    b.segDock('Speed', [[1, '1×'], [4, '4×']], 1, (v) => { b.opt.timeScale = v; });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Capacitors</h2>'),
      ctx.h('<p class="lede">A capacitor is two metal plates with a gap. It stores charge, and it fills up along a curve, fast at first and then slower and slower.</p>'),
    );
    const mode = ctx.seg([[0, 'Charge'], [1, 'Discharge']], 0, (v) => { b.part('SW').pos = v; });
    const sR = ctx.slider({ label: 'Resistance R', min: 3, max: Math.log10(47000), step: 0.01, value: 4, fmt: (v) => fmt(10 ** v, 'Ω'), onInput: (v) => { b.part('R').R = +(10 ** v).toPrecision(2); } });
    const sC = ctx.slider({ label: 'Capacitance C', min: Math.log10(22e-6), max: -3, step: 0.01, value: Math.log10(220e-6), fmt: (v) => fmt(10 ** v, 'F'), onInput: (v) => { b.part('C').C = +(10 ** v).toPrecision(2); } });
    const stat = ctx.h('<div class="stat"><div><b class="v">0</b><span>Capacitor V</span></div><div><b class="i">0</b><span>Current</span></div><div><b class="t">0</b><span>τ = RC</span></div></div>');
    ctx.panel.append(mode, sR, sC, stat);
    ctx.loop(() => {
      const C = b.part('C'); const SW = b.part('SW'); if (!C || !SW) return;
      mode.set(SW.pos);
      stat.querySelector('.v').textContent = fmt(C.v, 'V');
      stat.querySelector('.i').textContent = fmt(Math.abs(C.i), 'A');
      stat.querySelector('.t').textContent = fmt(tau(), 's');
    });
    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>When you start charging, the empty capacitor offers no push back, so current rushes in (look at the dots). As charge piles up on the plates, the capacitor's own voltage grows and opposes the battery, so the current shrinks.</p>
      <p>The result is the curve on the graph. The <b>time constant τ = R × C</b> sets its pace: after one τ the capacitor is about 63% full, after five τ it is practically full and the current has stopped.</p>
      <p>Flip to discharge and the stored charge flows back out through the resistor, the other way, along the mirror image curve.</p>
    </div>`));
    ctx.panel.append(tasks(ctx, [
      { text: 'Watch a full charge. At 1τ the voltage passes the 63% line.', check: () => flags.charged },
      { text: 'Press <b>Discharge</b> (or tap the two way switch). After 1τ it is down to 37%.', check: () => flags.discharged },
      { text: 'Discharge, then double C to 440 µF or more and charge again. Everything takes twice as long.', check: () => flags.bigC },
    ]));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div>
      <div class="formula">V(t) = V<sub>s</sub> (1 − e<sup>−t/RC</sup>)<span>charging from empty. Discharging: V(t) = V<sub>0</sub> e<sup>−t/RC</sup></span></div>
      <p><b>Capacitance</b> is charge stored per volt: Q = C V, measured in farads. One farad is a lot; most capacitors are microfarads (µF) or smaller. The energy stored is ½ C V².</p>
      <p><b>How the simulator does it.</b> Each frame is split into small time steps of a few milliseconds. In each step the capacitor is replaced by a resistor of h/C in parallel with a current source that remembers the last voltage (the backward Euler method), and the whole circuit is solved again. The dashed line is the exact formula, so you can see how closely the steps follow it.</p>
      <p><b>Uses.</b> RC timing sets the delay in many simple timers and blinking circuits. Capacitors smooth out ripples in power supplies, block steady (DC) current while letting changing signals through, and dump their energy quickly, as in a camera flash.</p>
    </div></details>`));
    ctx.quiz([
      { q: 'R = 10 kΩ and C = 100 µF. What is the time constant?', choices: ['0.1 s', '1 s', '10 s'], answer: 1, why: 'τ = R C = 10 000 × 0.0001 = 1 second.' },
      { q: 'Charging from empty, how full is the capacitor after one time constant?', choices: ['About 37%', 'About 63%', '100%'], answer: 1, why: '1 − e<sup>−1</sup> ≈ 0.63, so about 63% of the battery voltage.' },
      { q: 'A capacitor in a DC circuit has been charging for a long time. What is the current now?', choices: ['Almost zero', 'Its largest value', 'It keeps rising'], answer: 0, why: 'Once the capacitor voltage matches the battery there is no push left to drive current.' },
    ]);
  },
};
