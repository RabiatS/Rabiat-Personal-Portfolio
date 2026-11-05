import { createBoard, tasks, split, plot } from '../board.js';
import { fmt } from '../solver.js';
import { path } from '../presets.js';

const CIRCUIT = {
  cols: 7, rows: 5,
  parts: [
    { id: 'B', type: 'battery', pts: [[1, 4], [1, 1]], V: 6, r: 0.01 },
    ...path([1, 1], [2, 1]),
    { id: 'A', type: 'ammeter', pts: [[2, 1], [4, 1]] },
    ...path([4, 1], [5, 1]),
    { id: 'R', type: 'resistor', pts: [[5, 1], [5, 3]], R: 12 },
    ...path([5, 3], [5, 4], [1, 4]),
    ...path([5, 1], [6, 1]), { id: 'VM', type: 'voltmeter', pts: [[6, 1], [6, 3]] }, ...path([6, 3], [5, 3]),
  ],
};

export default {
  mount(ctx) {
    const C = ctx.colors;
    let side = null; const trail = [];
    const b = createBoard(ctx, {
      circuit: CIRCUIT, editable: false, dotScale: 6,
      onReset() { sV.value = 6; sR.value = 12; trail.length = 0; },
      layout(avail) { const s = split(avail, 0.42, 240); side = s.side; return s.circuit; },
      draw(g) {
        if (!side) return;
        const R = b.part('R'); const A = b.part('A'); const B = b.part('B'); if (!R || !A || !B) return;
        const I = Math.abs(A.i); const Vr = Math.abs(R.v);
        const last = trail[trail.length - 1];
        if (!last || Math.abs(last[0] - Vr) > 0.05 || Math.abs(last[1] - I) > 0.005) { trail.push([Vr, I]); if (trail.length > 300) trail.shift(); }
        const imax = 1.2;
        const r = { x: side.x + 34, y: side.y + 30, w: side.w - 50, h: side.h - 70 };
        const pr = plot(g, r, {
          xmin: 0, xmax: 12, ymin: 0, ymax: imax, colors: C,
          xticks: [[0, '0'], [3, '3'], [6, '6'], [9, '9'], [12, '12 V']], yticks: [[0.3, '0.3 A'], [0.6, '0.6 A'], [0.9, '0.9 A']],
          ylabel: 'current through the resistor', xlabel: 'voltage across it',
          series: [{ data: [[0, 0], [12, 12 / R.R]], color: C.c1, width: 2 }],
        });
        g.save();
        g.fillStyle = 'rgba(251,191,36,.35)';
        for (const [x, y] of trail) { if (y > imax) continue; g.beginPath(); g.arc(pr.X(x), pr.Y(y), 2, 0, Math.PI * 2); g.fill(); }
        if (I <= imax) {
          g.fillStyle = C.c2; g.beginPath(); g.arc(pr.X(Vr), pr.Y(I), 5.5, 0, Math.PI * 2); g.fill();
        }
        g.font = '500 11px "DM Mono", monospace'; g.fillStyle = C.c1; g.textAlign = 'right'; g.textBaseline = 'bottom';
        const ex = Math.min(12, imax * R.R); g.fillText(`slope = 1 / ${fmt(R.R, 'Ω')}`, Math.min(pr.X(ex), r.x + r.w) - 4, Math.max(r.y + 14, pr.Y(ex / R.R) + 16));
        if (I > imax) { g.fillStyle = C.c2; g.textAlign = 'left'; g.fillText(`${fmt(I, 'A')} is off the top`, r.x + 8, r.y + 16); }
        g.restore();
      },
    });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Ohm\'s law</h2>'),
      ctx.h('<p class="lede">Push harder and more current flows. Make the path harder and less flows. Ohm\'s law puts exact numbers on that.</p>'),
    );
    const sV = ctx.slider({ label: 'Battery voltage V', min: 0, max: 12, step: 0.5, value: 6, fmt: (v) => `${(+v).toFixed(1)} V`, onInput: (v) => { b.part('B').V = v; } });
    const sR = ctx.slider({ label: 'Resistance R', min: 2, max: 60, step: 1, value: 12, fmt: (v) => `${v} Ω`, onInput: (v) => { b.part('R').R = v; } });
    ctx.panel.append(sV, sR);
    // The V = I R triangle: tap a letter to cover it and see what is left
    const tri = ctx.h(`<div class="card" style="align-items:center">
      <svg viewBox="0 0 220 140" width="220" height="140" role="group" aria-label="V equals I times R triangle" style="max-width:100%">
        <path d="M110 8 L212 132 L8 132 Z" fill="rgba(94,234,212,.06)" stroke="#3A3A38" stroke-width="1.5"/>
        <path d="M44 88 H176 M110 88 V132" stroke="#3A3A38" stroke-width="1.5"/>
        <g class="k" data-k="V" style="cursor:pointer"><rect x="80" y="40" width="60" height="44" fill="transparent"/><text x="110" y="74" text-anchor="middle" font-family="Rajdhani" font-weight="700" font-size="34" fill="#FB7185">V</text></g>
        <g class="k" data-k="I" style="cursor:pointer"><rect x="50" y="92" width="58" height="38" fill="transparent"/><text x="78" y="122" text-anchor="middle" font-family="Rajdhani" font-weight="700" font-size="30" fill="#FBBF24">I</text></g>
        <g class="k" data-k="R" style="cursor:pointer"><rect x="112" y="92" width="58" height="38" fill="transparent"/><text x="142" y="122" text-anchor="middle" font-family="Rajdhani" font-weight="700" font-size="30" fill="#5EEAD4">R</text></g>
      </svg>
      <p class="hint" style="text-align:center">Tap a letter to cover it. What is left tells you how to find it.</p>
      <div class="formula" style="align-self:stretch"></div>
    </div>`);
    ctx.panel.append(tri);
    let cover = 'I'; let usedTri = false;
    const fEl = tri.querySelector('.formula');
    tri.querySelectorAll('.k').forEach((k) => k.addEventListener('click', () => { cover = k.dataset.k; usedTri = true; paintTri(); }, { signal: ctx.signal }));
    function paintTri() {
      tri.querySelectorAll('.k').forEach((k) => { k.style.opacity = k.dataset.k === cover ? '0.25' : '1'; });
    }
    paintTri();
    ctx.loop(() => {
      const B = b.part('B'); const R = b.part('R'); const A = b.part('A'); if (!B || !R || !A) return;
      const V = Math.abs(R.v); const I = Math.abs(A.i);
      if (cover === 'I') fEl.innerHTML = `I = V / R = ${V.toFixed(2)} V / ${R.R} Ω = ${fmt(I, 'A')}<span>current: divide the push by the resistance</span>`;
      if (cover === 'V') fEl.innerHTML = `V = I × R = ${fmt(I, 'A')} × ${R.R} Ω = ${V.toFixed(2)} V<span>voltage: current times resistance</span>`;
      if (cover === 'R') fEl.innerHTML = `R = V / I = ${V.toFixed(2)} V / ${fmt(I, 'A')} = ${I > 1e-9 ? (V / I).toFixed(1) : '--'} Ω<span>resistance: volts per amp</span>`;
    });
    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>The ammeter (A) counts the current, the voltmeter (V) reads the push across the resistor. Their ratio never changes for a given resistor: double the voltage and the current doubles too.</p>
      <p>That fixed ratio is the resistance: <b>R = V / I</b>, measured in ohms (Ω). Written the usual way round it is <b>V = I R</b>.</p>
      <p>On the graph, each resistor is a straight line through zero. A bigger resistance gives a flatter line: more volts are needed for each amp.</p>
    </div>`));
    ctx.panel.append(tasks(ctx, [
      { text: 'Set 6 V and 12 Ω. The ammeter should read 0.5 A.', check: () => b.part('B').V === 6 && b.part('R').R === 12 && Math.abs(b.part('A').i - 0.5) < 0.01 && trail.length > 1 },
      { text: 'Double the voltage to 12 V. The current doubles to 1 A.', check: () => b.part('B').V === 12 && b.part('R').R === 12 },
      { text: 'Keep 12 V and double the resistance to 24 Ω. Back to 0.5 A.', check: () => b.part('B').V === 12 && b.part('R').R === 24 },
      { text: 'Sweep the voltage slider. The yellow trail draws the straight line.', check: () => trail.length > 25 },
      { text: 'Tap a different letter in the triangle.', check: () => usedTri },
    ]));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div>
      <p><b>Ohmic or not.</b> Ohm's law describes materials whose resistance stays fixed, like metal film resistors at steady temperature. Many things are not ohmic. A filament bulb's resistance rises several times over as it heats up, and a diode's current grows exponentially with voltage (you will see that in the LED chapter).</p>
      <p><b>What sets resistance.</b> For a wire, R = ρ L / A: longer wires resist more, thicker wires resist less, and ρ (resistivity) depends on the material. Copper is about 1.7 × 10<sup>-8</sup> Ω m at room temperature, which is why it is used for wiring.</p>
      <p><b>The meters here</b> are nearly ideal: the ammeter has almost no resistance and the voltmeter takes almost no current (10 MΩ), so they barely change the circuit they measure. The battery also has a tiny internal resistance of 0.01 Ω.</p>
    </div></details>`));
    ctx.quiz([
      { q: 'A 9 V battery drives current through a 3 Ω resistor. What is the current?', choices: ['27 A', '3 A', '0.33 A'], answer: 1, why: 'I = V / R = 9 / 3 = 3 A.' },
      { q: 'Keep the voltage the same and double the resistance. The current...', choices: ['doubles', 'halves', 'stays the same'], answer: 1, why: 'I = V / R, so twice the R gives half the I.' },
      { q: 'What voltage pushes 2 A through 5 Ω?', choices: ['10 V', '2.5 V', '0.4 V'], answer: 0, why: 'V = I R = 2 × 5 = 10 V.' },
    ]);
  },
};
