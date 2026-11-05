import { createBoard, tasks } from '../board.js';
import { path } from '../presets.js';

const bat = () => ({ id: 'B', type: 'battery', pts: [[1, 5], [1, 2]], V: 6, r: 0.1 });
const bulb = (a, c) => ({ id: 'L', type: 'bulb', pts: [a, c], R: 12, rated: 3 });
const CIRCUITS = {
  and: { cols: 9, rows: 6, parts: [bat(), ...path([1, 2], [2, 2]), { id: 'SA', type: 'switch', pts: [[2, 2], [4, 2]], closed: false, label: 'A' }, { id: 'SB', type: 'switch', pts: [[4, 2], [6, 2]], closed: false, label: 'B' }, ...path([6, 2], [7, 2]), bulb([7, 2], [7, 5]), ...path([7, 5], [1, 5])] },
  or: { cols: 9, rows: 6, parts: [bat(), ...path([1, 2], [3, 2]), ...path([3, 2], [3, 1]), ...path([3, 2], [3, 3]),
    { id: 'SA', type: 'switch', pts: [[3, 1], [5, 1]], closed: false, label: 'A' }, { id: 'SB', type: 'switch', pts: [[3, 3], [5, 3]], closed: false, label: 'B' },
    ...path([5, 1], [5, 2]), ...path([5, 3], [5, 2]), ...path([5, 2], [7, 2]), bulb([7, 2], [7, 5]), ...path([7, 5], [1, 5])] },
  stair: { cols: 9, rows: 6, parts: [{ id: 'B', type: 'battery', pts: [[1, 5], [1, 3]], V: 6, r: 0.1 }, { id: 'SA', type: 'spdt', pts: [[1, 3], [3, 2], [3, 4]], pos: 0, label: 'A' },
    ...path([3, 2], [6, 2]), ...path([3, 4], [6, 4]), { id: 'SB', type: 'spdt', pts: [[8, 3], [6, 2], [6, 4]], pos: 0, label: 'B' }, bulb([8, 3], [8, 5]), ...path([8, 5], [1, 5])] },
};

export default {
  mount(ctx) {
    let mode = 'and'; const done = { and: false, or: false, stair: false }; let lastStair = null;
    const lit = () => { const L = b.part('L'); return !!L && L.p > 0.5 * L.rated; };
    const b = createBoard(ctx, {
      circuit: CIRCUITS[mode], editable: false, editValues: false, dotScale: 4,
      onToggle(p) {
        if (mode !== 'stair') return;
        // check after the next solve
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const now = lit();
          if (lastStair && lastStair.id !== p.id && !lastStair.lit && now) done.stair = true;
          lastStair = { id: p.id, lit: now };
        }));
      },
    });
    const seg = b.segDock('Circuit', [['and', 'AND'], ['or', 'OR'], ['stair', 'Staircase']], mode, (v) => { mode = v; lastStair = null; b.load(CIRCUITS[v]); renderTable(); });
    void seg;

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Switches and logic</h2>'),
      ctx.h('<p class="lede">How you wire two switches decides when the light comes on. That simple idea is the root of every computer.</p>'),
    );
    const tbl = ctx.h('<div class="card"><h3 class="tt"></h3><table style="width:100%;border-collapse:collapse;font:500 13px var(--f-mono);text-align:center"></table><p class="small muted note"></p></div>');
    ctx.panel.append(tbl);
    const NOTES = {
      and: 'Series: current has to get through A <b>and</b> B. Either one open breaks the only path.',
      or: 'Parallel: current can go through A <b>or</b> B (or both). The light is off only when both are open.',
      stair: 'Each two way switch sends current down one of two wires. The light is on when both switches pick the same wire. Flip either one and you change the answer.',
    };
    let rowsEls = [];
    function renderTable() {
      tbl.querySelector('.tt').textContent = mode === 'and' ? 'AND: series switches' : mode === 'or' ? 'OR: parallel switches' : 'Staircase: two way switches';
      const st = mode === 'stair';
      const cell = (v) => (st ? (v ? 'down' : 'up') : v ? 'closed' : 'open');
      const rows = [[0, 0], [0, 1], [1, 0], [1, 1]];
      const out = (a, c) => (mode === 'and' ? a && c : mode === 'or' ? a || c : a === c);
      tbl.querySelector('table').innerHTML = `<tr style="color:var(--muted)"><th style="padding:4px">A</th><th>B</th><th>Light</th></tr>${rows.map(([a, c]) => `<tr data-r="${a}${c}"><td style="padding:5px;border-top:1px solid var(--border)">${cell(a)}</td><td style="border-top:1px solid var(--border)">${cell(c)}</td><td style="border-top:1px solid var(--border);color:${out(a, c) ? 'var(--c2)' : 'var(--muted)'}">${out(a, c) ? 'ON' : 'off'}</td></tr>`).join('')}`;
      rowsEls = [...tbl.querySelectorAll('tr[data-r]')];
      tbl.querySelector('.note').innerHTML = NOTES[mode];
    }
    renderTable();
    ctx.loop(() => {
      const A = b.part('SA'); const B = b.part('SB'); if (!A || !B) return;
      const a = mode === 'stair' ? A.pos : A.closed ? 1 : 0; const c = mode === 'stair' ? B.pos : B.closed ? 1 : 0;
      for (const r of rowsEls) r.style.background = r.dataset.r === `${a}${c}` ? 'rgba(251,191,36,.12)' : '';
      if (mode === 'and' && lit()) done.and = true;
      if (mode === 'or' && lit() && A.closed !== B.closed) done.or = true;
    });
    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>A switch is just a gap you can open or close. Tap a switch on the circuit to flip it, and the row of the table that matches lights up.</p>
      <p>Two switches <b>in series</b> make an AND: both must be closed. Two <b>in parallel</b> make an OR: either will do.</p>
      <p>The staircase circuit uses two way switches, so you can switch a light on at the bottom of the stairs and off at the top. It acts as "on when A and B match", which logic designers call XNOR.</p>
    </div>`));
    ctx.panel.append(tasks(ctx, [
      { text: 'In <b>AND</b>, get the bulb to light.', check: () => done.and },
      { text: 'Switch to <b>OR</b> and light the bulb with only one switch closed.', check: () => done.or },
      { text: 'In <b>Staircase</b>, turn the light off with one switch, then back on with the other.', check: () => done.stair },
    ]));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div>
      <p><b>From switches to computers.</b> A transistor is a switch flipped by a voltage instead of a finger. Wire transistors in series and you get an AND gate, in parallel an OR gate. A modern processor has billions of them, switching billions of times a second.</p>
      <p><b>NOT.</b> You can make a light that goes off when you press a switch by putting the switch across the bulb, but that shorts the supply unless there is a resistor in series to limit the current. Real NOT gates use a transistor and a resistor in just this way.</p>
      <p><b>Real staircase wiring</b> is the same idea at mains voltage: the two wires between the switches are called strappers or travellers. Add intermediate (four way) switches between them and you can control one light from as many places as you like.</p>
    </div></details>`));
    ctx.quiz([
      { q: 'Two switches in series control a bulb. When is it on?', choices: ['When either switch is closed', 'Only when both are closed', 'Only when both are open'], answer: 1, why: 'There is only one path, through both switches, so both must be closed. That is AND.' },
      { q: 'Two switches in parallel control a bulb. When is it off?', choices: ['When either one is open', 'Only when both are open', 'Never'], answer: 1, why: 'Either path will do, so it is off only when both are open. That is OR.' },
      { q: 'In a staircase circuit the light is on. You flip the switch at the top. What happens?', choices: ['The light goes off', 'Nothing, the bottom switch is in control', 'The light gets brighter'], answer: 0, why: 'Flipping either two way switch always changes the state of the light.' },
    ]);
  },
};
