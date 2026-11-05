import { createBoard, tasks, split, plot } from '../board.js';
import { fmt, diodeI, LED_COLORS } from '../solver.js';
import { path } from '../presets.js';

const CIRCUIT = {
  cols: 7, rows: 5,
  parts: [
    { id: 'B', type: 'battery', pts: [[1, 4], [1, 1]], V: 9, r: 0.1 },
    ...path([1, 1], [2, 1]),
    { id: 'R', type: 'resistor', pts: [[2, 1], [4, 1]], R: 330 },
    ...path([4, 1], [5, 1]),
    { id: 'D', type: 'led', pts: [[5, 1], [5, 3]], color: 'red', imax: 0.03 },
    ...path([5, 3], [5, 4]),
    { id: 'A', type: 'ammeter', pts: [[5, 4], [3, 4]] },
    ...path([3, 4], [1, 4]),
  ],
};

export default {
  mount(ctx) {
    const C = ctx.colors;
    let side = null; let noR = false; let burned = false; let flippedSeen = false; let unflipped = false; let darkLow = false;
    const forward = () => { const D = b.part('D'); return D && D.pts[0][1] === 1; };
    const b = createBoard(ctx, {
      circuit: CIRCUIT, editable: false, dotScale: 120,
      layout(avail) { const s = split(avail, 0.44, 250); side = s.side; return s.circuit; },
      onEvent(ev) { if (ev.type === 'burn') burned = true; },
      onReset() { noR = false; nrB.textContent = 'Remove resistor'; sV.value = 9; sR.value = Math.log10(330); colors.set('red'); },
      draw(g) {
        if (!side) return;
        const D = b.part('D'); const B = b.part('B'); const R = b.part('R'); if (!D || !B || !R) return;
        const r = { x: side.x + 40, y: side.y + 32, w: side.w - 56, h: side.h - 74 };
        const curve = []; for (let k = 0; k <= 160; k++) { const v = (k / 160) * 4; curve.push([v, diodeI(D, v) * 1000]); }
        const Rt = (noR ? 0 : R.R) + B.r + 1e-3;
        const load = [[0, (B.V / Rt) * 1000], [B.V, 0]];
        const pr = plot(g, r, {
          xmin: 0, xmax: 4, ymin: 0, ymax: 40, colors: C,
          xticks: [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4 V']], yticks: [[10, '10 mA'], [20, '20 mA'], [30, '30 mA']],
          ylabel: 'LED current against LED voltage', xlabel: 'voltage across the LED',
          series: [
            { data: [[0, 30], [4, 30]], color: C.c4, width: 1, dash: [4, 4] },
            { data: load, color: '#7A7A75', width: 1.4, dash: [6, 4] },
            { data: curve, color: (LED_COLORS[D.color] || LED_COLORS.red).rgb, width: 2.4 },
          ],
        });
        g.save(); g.font = '500 11px "DM Mono", monospace';
        g.fillStyle = C.c4; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText('safe limit about 30 mA', r.x + r.w - 4, pr.Y(30) - 3); g.textAlign = 'left';
        const on = forward() && !D.burnt;
        if (on && D.i * 1000 <= 40 && D.v >= 0) { g.fillStyle = C.c2; g.beginPath(); g.arc(pr.X(Math.min(4, D.v)), pr.Y(D.i * 1000), 5.5, 0, Math.PI * 2); g.fill(); }
        g.textBaseline = 'top'; g.fillStyle = C.muted;
        const ly = r.y + r.h + 30;
        const msg = D.burnt ? 'LED burnt out: no current' : !forward() ? 'LED reversed: it blocks, almost no current' : D.i > 0.04 ? `${fmt(D.i, 'A')}: far off the top of the graph` : 'yellow dot: where the LED is working';
        g.fillStyle = D.burnt || D.i > 0.03 ? C.c4 : C.muted; g.fillText(msg, r.x, ly);
        if (side.w > 300) { g.fillStyle = '#7A7A75'; g.textAlign = 'right'; g.fillText('dashed: resistor line', r.x + r.w, ly); }
        g.restore();
      },
    });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">LEDs and diodes</h2>'),
      ctx.h('<p class="lede">A diode lets current through one way only. An LED is a diode that glows, and it needs a resistor to keep it alive.</p>'),
    );
    const sV = ctx.slider({ label: 'Battery voltage', min: 0, max: 9, step: 0.1, value: 9, fmt: (v) => `${(+v).toFixed(1)} V`, onInput: (v) => { b.part('B').V = v; } });
    const sR = ctx.slider({ label: 'Resistor', min: 1, max: 3, step: 0.01, value: Math.log10(330), fmt: (v) => fmt(10 ** v, 'Ω'), onInput: (v) => { b.part('R').R = Math.round(10 ** v); } });
    const colors = ctx.seg(Object.entries(LED_COLORS).map(([k, c]) => [k, c.label]), 'red', (v) => { const D = b.part('D'); D.color = v; D.vd = 0; });
    const row = ctx.h('<div class="row"><button class="btn sm ghost fl">Flip the LED</button><button class="btn sm ghost nr">Remove resistor</button><button class="btn sm ghost nw" hidden>New LED</button></div>');
    row.querySelector('.fl').onclick = () => { b.flip(b.part('D')); if (!forward()) flippedSeen = true; else if (flippedSeen) unflipped = true; };
    const nrB = row.querySelector('.nr');
    nrB.onclick = () => { noR = !noR; const R = b.part('R'); R.type = noR ? 'wire' : 'resistor'; nrB.textContent = noR ? 'Put resistor back' : 'Remove resistor'; b.changed(); };
    row.querySelector('.nw').onclick = () => { const D = b.part('D'); D.burnt = false; D.heat = 0; D.vd = 0; };
    const stat = ctx.h('<div class="stat"><div><b class="i">0</b><span>LED current</span></div><div><b class="v">0</b><span>LED voltage</span></div><div><b class="r">0</b><span>Resistor gets</span></div></div>');
    const calc = ctx.h('<div class="formula"></div>');
    ctx.panel.append(sV, sR, colors, row, stat, calc);
    ctx.loop(() => {
      const D = b.part('D'); const B = b.part('B'); const R = b.part('R'); if (!D || !B || !R) return;
      row.querySelector('.nw').hidden = !D.burnt;
      stat.querySelector('.i').textContent = fmt(Math.max(0, D.i), 'A');
      stat.querySelector('.i').style.color = D.i > 0.03 ? C.c4 : '';
      stat.querySelector('.v').textContent = fmt(Math.abs(D.v), 'V');
      stat.querySelector('.r').textContent = noR ? 'none' : fmt(Math.abs(R.v), 'V');
      const vf = (LED_COLORS[D.color] || LED_COLORS.red).vf;
      const need = (B.V - vf) / 0.02;
      calc.innerHTML = B.V > vf ? `R = (${B.V.toFixed(1)} V − ${vf.toFixed(1)} V) / 0.02 A = ${Math.round(need)} Ω<span>resistor for about 20 mA with this battery and colour</span>` : `${B.V.toFixed(1)} V is below the ${vf.toFixed(1)} V this LED needs<span>no resistor needed, but it will not light either</span>`;
      if (forward() && !D.burnt && B.V < vf - 0.3 && D.i < 0.001) darkLow = true;
    });
    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>Point the triangle the way conventional current flows and the LED conducts. Flip it and it blocks, like a one way valve.</p>
      <p>Below its <b>forward voltage</b> (about 2 V for red, about 3 V for blue or white) an LED barely conducts. Just above it, the current shoots up very steeply. That is the bright coloured curve on the graph.</p>
      <p>So an LED cannot set its own current. The <b>resistor</b> does that job: it takes whatever voltage is left over, and Ohm's law fixes the current. Without it, the battery drives far too much current and the LED burns out.</p>
    </div>`));
    ctx.panel.append(tasks(ctx, [
      { text: 'Press <b>Flip the LED</b>. Current stops: it only goes one way.', check: () => flippedSeen },
      { text: 'Flip it back.', check: () => unflipped && forward() },
      { text: 'Lower the battery below the forward voltage. The LED goes dark even though the circuit is complete.', check: () => darkLow },
      { text: 'Press <b>Remove resistor</b> at 9 V. Too much current: the LED burns out.', check: () => burned },
      { text: 'Put the resistor back and press <b>New LED</b>.', check: () => burned && !noR && !b.part('D')?.burnt },
    ]));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div>
      <div class="formula">I = I<sub>s</sub> (e<sup>V / (n V<sub>T</sub>)</sup> − 1)<span>the Shockley diode equation used by the simulator. V<sub>T</sub> ≈ 26 mV at room temperature</span></div>
      <p>Because the curve is exponential, a few tenths of a volt more across the LED means many times more current. The simulator solves this nonlinear equation each frame with Newton's method: it guesses, replaces the diode with the straight line that touches its curve at the guess, solves, and repeats until the answer stops changing.</p>
      <p><b>Load line.</b> The dashed grey line is everything the battery and resistor allow: I = (V<sub>battery</sub> − V<sub>LED</sub>) / R. The LED must also sit on its own curve, so the circuit settles where the two lines cross. A bigger resistor makes the load line flatter and the current smaller.</p>
      <p><b>Ordinary diodes</b> made of silicon switch on at about 0.6 to 0.7 V and do not glow. They are used to stop current flowing the wrong way, for example to protect a circuit if the battery is put in backwards, and four of them make a bridge rectifier that turns AC into DC.</p>
      <p>Typical small indicator LEDs run at up to about 20 mA. The limit in this simulator is 30 mA, and the LED survives a brief overload but not a sustained one.</p>
    </div></details>`));
    ctx.quiz([
      { q: 'You put an LED in backwards. What happens?', choices: ['It glows dimly', 'Almost no current flows and it stays dark', 'It glows the other colour'], answer: 1, why: 'A diode blocks current in the reverse direction (up to its breakdown voltage).' },
      { q: 'Why does an LED need a series resistor?', choices: ['To make it brighter', 'To limit the current, because LED current rises very steeply with voltage', 'To change its colour'], answer: 1, why: 'The LED cannot limit its own current. The resistor sets it with Ohm\'s law.' },
      { q: 'A 9 V battery, a 2 V LED, and you want 20 mA. Which resistor?', choices: ['450 Ω', '350 Ω', '100 Ω'], answer: 1, why: 'R = (9 − 2) / 0.02 = 350 Ω.' },
    ]);
  },
};
