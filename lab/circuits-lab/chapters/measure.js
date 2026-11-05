import { createBoard, tasks } from '../board.js';
import { fmt } from '../solver.js';
import { path } from '../presets.js';

function circuit(mode) {
  const parts = [
    { id: 'B', type: 'battery', pts: [[1, 6], [1, 1]], V: 9, r: 0.01 },
    ...path([1, 1], [2, 1]),
    mode === 'right' ? { id: 'A1', type: 'ammeter', pts: [[2, 1], [4, 1]], label: 'A1' }
      : mode === 'vwrong' ? { id: 'VX', type: 'voltmeter', pts: [[2, 1], [4, 1]] } : { type: 'wire', pts: [[2, 1], [4, 1]] },
    { id: 'R1', type: 'resistor', pts: [[4, 1], [6, 1]], R: 100, label: 'R1', flipLabel: true },
    ...path([6, 1], [9, 1]),
    { id: 'A2', type: 'ammeter', pts: [[6, 1], [6, 3]] }, { id: 'R2', type: 'resistor', pts: [[6, 3], [6, 5]], R: 200, label: 'R2' }, ...path([6, 5], [6, 6]),
    { id: 'A3', type: 'ammeter', pts: [[9, 1], [9, 3]] }, { id: 'R3', type: 'resistor', pts: [[9, 3], [9, 5]], R: 300, label: 'R3', flipLabel: true }, ...path([9, 5], [9, 6]),
    ...path([9, 6], [6, 6], [1, 6]),
    ...path([4, 1], [4, 0]), ...path([6, 1], [6, 0]),
    mode === 'awrong' ? { id: 'AX', type: 'ammeter', pts: [[4, 0], [6, 0]] } : { id: 'V1', type: 'voltmeter', pts: [[4, 0], [6, 0]] },
    ...path([6, 3], [7, 3]), { id: 'V2', type: 'voltmeter', pts: [[7, 3], [7, 5]] }, ...path([7, 5], [6, 5]),
  ];
  return { cols: 10, rows: 6, parts };
}

export default {
  mount(ctx) {
    const C = ctx.colors;
    let mode = 'right'; const seen = { awrong: false, vwrong: false };
    const b = createBoard(ctx, { circuit: circuit(mode), palette: ['wire', 'ammeter', 'voltmeter', 'resistor'], dotScale: 40 });
    b.segDock('Meters', [['right', 'Correct'], ['awrong', 'Ammeter across'], ['vwrong', 'Voltmeter in line']], mode, (v) => { mode = v; if (v !== 'right') seen[v] = true; b.load(circuit(v)); });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Measure it</h2>'),
      ctx.h('<p class="lede">An ammeter counts the current flowing through it, so it goes in the path. A voltmeter compares two points, so it goes across.</p>'),
    );
    const checks = ctx.h('<div class="card"><h3>Kirchhoff, checked live</h3><div class="kcl formula"></div><div class="kvl formula"></div><p class="small muted wrong" hidden></p></div>');
    ctx.panel.append(checks);
    const ok = (good) => `<b style="color:${good ? 'var(--ok)' : 'var(--c4)'};font-weight:500">${good ? '✓ holds' : 'does not add up'}</b>`;
    ctx.loop(() => {
      const kcl = checks.querySelector('.kcl'); const kvl = checks.querySelector('.kvl'); const wr = checks.querySelector('.wrong');
      const A1 = b.part('A1'); const A2 = b.part('A2'); const A3 = b.part('A3'); const V1 = b.part('V1'); const V2 = b.part('V2'); const B = b.part('B');
      if (mode === 'right' && A1 && A2 && A3) {
        const a = Math.abs(A1.i); const s = Math.abs(A2.i) + Math.abs(A3.i);
        kcl.innerHTML = `A1 = A2 + A3: ${fmt(a, 'A')} = ${fmt(Math.abs(A2.i), 'A')} + ${fmt(Math.abs(A3.i), 'A')} ${ok(Math.abs(a - s) <= 1e-3 * Math.max(a, 1e-6) + 1e-6)}<span>current law: what flows into a junction flows out</span>`;
      } else kcl.innerHTML = 'Current law needs A1 in the main line.<span>choose "Correct" at the bottom</span>';
      if (mode === 'right' && V1 && V2 && B) {
        const vt = B.vb - B.va; const s = Math.abs(V1.v) + Math.abs(V2.v);
        kvl.innerHTML = `battery = V1 + V2: ${fmt(vt, 'V')} = ${fmt(Math.abs(V1.v), 'V')} + ${fmt(Math.abs(V2.v), 'V')} ${ok(Math.abs(vt - s) <= 2e-3 * Math.abs(vt) + 1e-4)}<span>voltage law: the drops around any loop add up to the push</span>`;
      } else kvl.innerHTML = 'Voltage law needs V1 across R1.<span>choose "Correct" at the bottom</span>';
      wr.hidden = mode === 'right';
      if (mode === 'awrong') { const AX = b.part('AX'); const R1 = b.part('R1'); wr.innerHTML = `The ammeter sits across R1. It has almost no resistance, so current takes the ammeter instead: R1 now carries only ${fmt(Math.abs(R1?.i || 0), 'A')} and the ammeter reads ${fmt(Math.abs(AX?.i || 0), 'A')}, which is not R1's current at all. Put an ammeter straight across a battery and it is a short circuit.`; }
      if (mode === 'vwrong') { const VX = b.part('VX'); wr.innerHTML = `The voltmeter is in the main line. Its 10 MΩ blocks almost all current (${fmt(Math.abs(B?.i || 0), 'A')}), so the resistors barely carry anything and the meter just reads about the battery voltage: ${fmt(Math.abs(VX?.v || 0), 'V')}.`; }
    });
    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>An <b>ammeter</b> has almost no resistance and is placed <b>in series</b>, so the current you want to know has to pass through it. A1 measures everything leaving the battery, A2 and A3 measure each branch.</p>
      <p>A <b>voltmeter</b> has a very high resistance and is placed <b>in parallel</b>, touching both ends of the part you are measuring. It takes almost no current, so it does not disturb the circuit.</p>
      <p><b>Kirchhoff's current law:</b> at any junction, current in equals current out. <b>Kirchhoff's voltage law:</b> around any closed loop, the voltage drops add up to the voltage supplied. The box above checks both with the live readings.</p>
    </div>`));
    ctx.panel.append(tasks(ctx, [
      { text: 'Tap R3 and change its value. A1 still equals A2 + A3.', check: () => mode === 'right' && b.part('R3') && b.part('R3').R !== 300 },
      { text: 'Choose <b>Ammeter across</b> at the bottom. See how it bypasses R1.', check: () => seen.awrong },
      { text: 'Choose <b>Voltmeter in line</b>. Almost nothing flows.', check: () => seen.vwrong },
      { text: 'Back in Correct, drag a voltmeter from the parts bar and wire it across R3. It should match V2, because R2 and R3 are in parallel.', check: () => b.parts.some((p) => p.type === 'voltmeter' && p.id !== 'V1' && p.id !== 'V2' && Math.abs(p.v) > 0.5 && Math.abs(Math.abs(p.v) - Math.abs(b.part('R3')?.v || 0)) < 0.01) },
    ]));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div>
      <p><b>Why the laws hold.</b> The current law is conservation of charge: charge cannot pile up at a junction. The voltage law is conservation of energy: a charge that goes round a loop and returns to where it started must have gained and lost the same energy.</p>
      <p><b>How the simulator uses them.</b> Modified nodal analysis writes the current law at every node as one equation, using Ohm's law for each part, and adds one equation for every battery. Solving that set of linear equations gives every node voltage at once. So the checks above are not a coincidence: the solver is built on them.</p>
      <p><b>Meters are not perfect.</b> Here the ammeter is 0.1 mΩ and the voltmeter 10 MΩ, close to a good digital multimeter. A voltmeter across a very large resistor (megohms) would draw a noticeable share of the current and read low, a real effect called loading.</p>
      <p>The numbers: R2 and R3 in parallel make 120 Ω, plus R1 makes 220 Ω, so A1 reads 9 / 220 ≈ 41 mA. R1 drops about 4.1 V, leaving about 4.9 V across the branches.</p>
    </div></details>`));
    ctx.quiz([
      { q: 'How do you connect an ammeter to measure the current through a bulb?', choices: ['In series with the bulb', 'In parallel with the bulb', 'Across the battery'], answer: 0, why: 'The current must flow through the ammeter, so it goes in the same path, in series.' },
      { q: 'Why does a voltmeter need a very high resistance?', choices: ['So it can measure big voltages', 'So it takes almost no current and does not change the circuit', 'So it does not get hot'], answer: 1, why: 'It sits in parallel, and a low resistance would steal current and change what you are measuring.' },
      { q: '0.5 A flows into a junction. One branch out carries 0.2 A. What does the other carry?', choices: ['0.7 A', '0.3 A', '0.5 A'], answer: 1, why: 'Current in equals current out: 0.5 − 0.2 = 0.3 A.' },
    ]);
    void C;
  },
};
