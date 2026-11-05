import { createBoard, tasks, split } from '../board.js';
import { fmt } from '../solver.js';
import { path } from '../presets.js';

const COLS = ['#5EEAD4', '#A78BFA', '#60A5FA'];
const CIRCUIT = {
  cols: 9, rows: 6,
  parts: [
    { id: 'B', type: 'battery', pts: [[1, 5], [1, 1]], V: 6, r: 0.1 },
    ...path([1, 1], [3, 1], [5, 1], [7, 1]),
    { id: 'S1', type: 'switch', pts: [[3, 1], [3, 3]], closed: true, label: 'S1' }, { id: 'L1', type: 'bulb', pts: [[3, 3], [3, 5]], R: 12, rated: 3, label: 'L1' },
    { id: 'S2', type: 'switch', pts: [[5, 1], [5, 3]], closed: false, label: 'S2' }, { id: 'L2', type: 'bulb', pts: [[5, 3], [5, 5]], R: 12, rated: 3, label: 'L2' },
    { id: 'S3', type: 'switch', pts: [[7, 1], [7, 3]], closed: false, label: 'S3' }, { id: 'L3', type: 'bulb', pts: [[7, 3], [7, 5]], R: 12, rated: 3, label: 'L3' },
    ...path([7, 5], [5, 5], [3, 5]),
    { id: 'A', type: 'ammeter', pts: [[3, 5], [1, 5]] },
  ],
};

export default {
  mount(ctx) {
    const C = ctx.colors;
    let side = null;
    const b = createBoard(ctx, {
      circuit: CIRCUIT, palette: ['wire', 'bulb', 'switch'], dotScale: 3,
      layout(avail) { const s = split(avail, 0.3, 200); side = s.side; return s.circuit; },
      draw(g) {
        if (!side) return;
        const A = b.part('A'); if (!A) return;
        const ls = ['L1', 'L2', 'L3'].map((id) => b.part(id));
        const tot = Math.abs(A.i);
        g.save(); g.font = '500 11px "DM Mono", monospace';
        g.fillStyle = 'rgba(20,20,20,.55)'; g.strokeStyle = '#2A2A2A'; g.beginPath(); g.roundRect(side.x, side.y, side.w, side.h, 10); g.fill(); g.stroke();
        g.fillStyle = C.muted; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('How the current splits', side.x + 10, side.y + 8);
        const horiz = side.w > side.h;
        const maxI = 1.6;
        if (horiz) {
          const L = side.x + 70; const Wd = side.w - 90; const sc = Wd / maxI; const hh = Math.min(24, (side.h - 46) / 2);
          const y1 = side.y + 28; const y2 = y1 + hh + 8;
          g.fillStyle = C.c2; g.fillRect(L, y1, tot * sc, hh);
          g.fillStyle = C.muted; g.textBaseline = 'middle'; g.fillText('battery', side.x + 10, y1 + hh / 2); g.fillText('branches', side.x + 10, y2 + hh / 2);
          g.fillStyle = C.text; g.fillText(fmt(tot, 'A'), L + tot * sc + 6, y1 + hh / 2);
          let x = L; ls.forEach((p, k) => { if (!p) return; const v = Math.abs(p.i) * sc; g.fillStyle = COLS[k]; g.fillRect(x, y2, Math.max(0, v - 1), hh); x += v; });
        } else {
          const top = side.y + 34; const bot = side.y + side.h - 30; const sc = (bot - top) / maxI; const bw = Math.min(46, (side.w - 40) / 4);
          const x1 = side.x + side.w / 2 - bw - 8; const x2 = side.x + side.w / 2 + 8;
          g.fillStyle = C.c2; g.fillRect(x1, bot - tot * sc, bw, tot * sc);
          let y = bot;
          ls.forEach((p, k) => {
            if (!p) return; const v = Math.abs(p.i) * sc; g.fillStyle = COLS[k]; g.fillRect(x2, y - v + 1, bw, Math.max(0, v - 1));
            if (v > 28) { g.fillStyle = '#0A0A0A'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.label, x2 + bw / 2, y - v / 2 - 7); g.fillText(fmt(Math.abs(p.i), 'A'), x2 + bw / 2, y - v / 2 + 8); }
            y -= v;
          });
          g.fillStyle = C.text; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(fmt(tot, 'A'), x1 + bw / 2, bot - tot * sc - 4);
          g.fillStyle = C.muted; g.textBaseline = 'top'; g.fillText('battery', x1 + bw / 2, bot + 6); g.fillText('branches', x2 + bw / 2, bot + 6);
        }
        g.restore();
      },
    });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Parallel circuits</h2>'),
      ctx.h('<p class="lede">Give each bulb its own path back to the battery and every one shines at full brightness, however many you add.</p>'),
    );
    const stat = ctx.h('<div class="stat"><div><b class="i">0</b><span>Battery current</span></div><div><b class="r">0</b><span>Total R</span></div><div><b class="n">0</b><span>Bulbs on</span></div></div>');
    ctx.panel.append(stat);
    const fx = ctx.h('<div class="formula"></div>');
    ctx.panel.append(fx);
    ctx.loop(() => {
      const A = b.part('A'); const B = b.part('B'); if (!A || !B) return;
      const on = b.parts.filter((p) => p.type === 'bulb' && p.p > 0.3);
      const I = Math.abs(A.i); const Vt = Math.abs(B.vb - B.va);
      stat.querySelector('.i').textContent = fmt(I, 'A');
      stat.querySelector('.r').textContent = I > 1e-6 ? fmt(Vt / I, 'Ω') : 'open';
      stat.querySelector('.n').textContent = String(on.length);
      const bi = ['L1', 'L2', 'L3'].map((id) => b.part(id)).filter(Boolean).map((p) => Math.abs(p.i));
      fx.innerHTML = `${fmt(I, 'A')} = ${bi.map((x) => fmt(x, 'A')).join(' + ')}<span>battery current = sum of the branch currents</span>`;
    });
    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>In parallel, every branch connects straight across the battery, so <b>every bulb gets the full 6 V</b>. That is why each stays at full brightness.</p>
      <p>The current <b>splits</b> at the junction (the grey dot) and joins up again on the way back. The battery has to supply the total, so more branches means more current from the battery.</p>
      <p>Each branch has its own switch, and switching one off leaves the others alone. That is how the lights and sockets in a house are wired.</p>
    </div>`));
    let allOn = false;
    ctx.panel.append(tasks(ctx, [
      { text: 'Tap S2 and S3 to close them. The first bulb does not dim.', check: () => { const ok = ['S1', 'S2', 'S3'].every((id) => b.part(id)?.closed); if (ok) allOn = true; return ok; } },
      { text: 'Watch the ammeter: three bulbs draw three times the current of one.', check: () => allOn && Math.abs(b.part('A')?.i || 0) > 1.4 },
      { text: 'Open just the middle switch. The other two stay lit.', check: () => allOn && !b.part('S2')?.closed && b.part('S1')?.closed && b.part('S3')?.closed },
      { text: 'Drag a fourth bulb from the parts bar and wire it across the battery. Total resistance drops again.', check: () => b.parts.filter((p) => p.type === 'bulb' && p.p > 1).length >= 4 },
    ]));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div>
      <div class="formula">1 / R<sub>total</sub> = 1 / R<sub>1</sub> + 1 / R<sub>2</sub> + 1 / R<sub>3</sub><span>parallel resistances combine as reciprocals</span></div>
      <p>Three 12 Ω bulbs in parallel give 1/R = 3/12, so R = 4 Ω. The total is always smaller than the smallest branch: each new path gives the current another way through.</p>
      <p>For just two resistors there is a handy shortcut: R = R<sub>1</sub> R<sub>2</sub> / (R<sub>1</sub> + R<sub>2</sub>), "product over sum".</p>
      <p>The bulbs are not perfectly unaffected. This battery has 0.1 Ω of internal resistance, so drawing 1.5 A loses 0.15 V inside it and every bulb dims a tiny bit. Plug too many things into one circuit and that drop (and the heat in the wires) becomes real, which is one reason house circuits have breakers.</p>
    </div></details>`));
    ctx.quiz([
      { q: 'Three bulbs are in parallel and one breaks. What happens to the others?', choices: ['They go out', 'They stay lit at the same brightness', 'They get much brighter'], answer: 1, why: 'Each bulb has its own path across the battery, so the others are not affected.' },
      { q: 'Three 12 Ω bulbs in parallel. What is the total resistance?', choices: ['36 Ω', '12 Ω', '4 Ω'], answer: 2, why: '1/R = 1/12 + 1/12 + 1/12 = 3/12, so R = 4 Ω.' },
      { q: 'Branch currents are 0.5 A, 0.5 A and 0.2 A. What does the battery supply?', choices: ['1.2 A', '0.5 A', '0.2 A'], answer: 0, why: 'The branch currents add up to the total: 0.5 + 0.5 + 0.2 = 1.2 A.' },
    ]);
  },
};
