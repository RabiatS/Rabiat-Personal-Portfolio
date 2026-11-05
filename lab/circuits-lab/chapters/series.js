import { createBoard, tasks, split } from '../board.js';
import { fmt } from '../solver.js';
import { path } from '../presets.js';

const BULB_COLORS = ['#5EEAD4', '#A78BFA', '#60A5FA'];
function circuit(n) {
  const parts = [{ id: 'B', type: 'battery', pts: [[1, 4], [1, 1]], V: 6, r: 0.05 }, ...path([1, 1], [2, 1])];
  for (let k = 0; k < 3; k++) {
    const a = [2 + 2 * k, 1]; const c = [4 + 2 * k, 1];
    parts.push(k < n ? { id: `L${k + 1}`, type: 'bulb', pts: [a, c], R: 12, rated: 3, label: `L${k + 1}` } : { type: 'wire', pts: [a, c] });
  }
  parts.push(...path([8, 1], [9, 1], [9, 4], [1, 4]));
  return { cols: 10, rows: 5, parts };
}

export default {
  mount(ctx) {
    const C = ctx.colors;
    let side = null; let n = 2;
    const b = createBoard(ctx, {
      circuit: circuit(n), palette: ['wire', 'bulb'], dotScale: 6, vcolors: true,
      layout(avail) { const s = split(avail, 0.3, 200); side = s.side; return s.circuit; },
      draw(g) {
        if (!side) return;
        const B = b.part('B'); if (!B) return;
        const bulbs = b.parts.filter((p) => p.type === 'bulb');
        const Vt = Math.max(0.01, B.vb - B.va);
        const narrow = side.w > side.h;
        g.save(); g.font = '500 11px "DM Mono", monospace';
        g.fillStyle = 'rgba(20,20,20,.55)'; g.strokeStyle = '#2A2A2A'; g.beginPath(); g.roundRect(side.x, side.y, side.w, side.h, 10); g.fill(); g.stroke();
        g.fillStyle = C.muted; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('Where the volts go', side.x + 10, side.y + 8);
        // two bars: battery voltage, and the drops across each bulb stacked
        const pad = 30; const top = side.y + pad + 4; const bot = side.y + side.h - 26;
        const H = bot - top; const scale = H / Math.max(6, B.V);
        const bw = Math.min(46, (side.w - 40) / 4);
        if (narrow) {
          // horizontal bars on small screens
          const L = side.x + 70; const Wd = side.w - 86; const sc = Wd / Math.max(6, B.V);
          const y1 = side.y + 30; const y2 = side.y + 30 + Math.min(28, (side.h - 50) / 2) + 8; const hh = Math.min(26, (side.h - 50) / 2);
          g.fillStyle = C.c4; g.globalAlpha = 0.85; g.fillRect(L, y1, Vt * sc, hh); g.globalAlpha = 1;
          g.fillStyle = C.muted; g.textBaseline = 'middle'; g.fillText('battery', side.x + 10, y1 + hh / 2);
          g.fillStyle = C.text; g.fillText(fmt(Vt, 'V'), L + Vt * sc + 6 > side.x + side.w - 50 ? L + 4 : L + Vt * sc + 6, y1 + hh / 2);
          let x = L; g.fillStyle = C.muted; g.fillText('bulbs', side.x + 10, y2 + hh / 2);
          bulbs.forEach((p, k) => { const v = Math.abs(p.v); g.fillStyle = BULB_COLORS[k % 3]; g.fillRect(x, y2, v * sc - 1, hh); g.fillStyle = '#0A0A0A'; if (v * sc > 34) g.fillText(fmt(v, 'V'), x + 4, y2 + hh / 2); x += v * sc; });
          g.restore(); return;
        }
        const x1 = side.x + side.w / 2 - bw - 8; const x2 = side.x + side.w / 2 + 8;
        g.fillStyle = C.c4; g.globalAlpha = 0.85; g.fillRect(x1, bot - Vt * scale, bw, Vt * scale); g.globalAlpha = 1;
        let y = bot;
        bulbs.forEach((p, k) => {
          const v = Math.abs(p.v); const hgt = v * scale;
          g.fillStyle = BULB_COLORS[k % 3]; g.fillRect(x2, y - hgt + 1, bw, hgt - 1);
          g.fillStyle = '#0A0A0A'; g.textAlign = 'center'; g.textBaseline = 'middle';
          if (hgt > 30) { g.fillText(p.label || `L${k + 1}`, x2 + bw / 2, y - hgt / 2 - 7); g.fillText(fmt(v, 'V'), x2 + bw / 2, y - hgt / 2 + 8); }
          y -= hgt;
        });
        g.fillStyle = C.text; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(fmt(Vt, 'V'), x1 + bw / 2, bot - Vt * scale - 4);
        g.fillStyle = C.muted; g.textBaseline = 'top'; g.fillText('battery', x1 + bw / 2, bot + 6); g.fillText('bulbs', x2 + bw / 2, bot + 6);
        g.restore();
      },
    });
    b.dock('Bulbs', [1, 2, 3].map((k) => ({ label: String(k), on: k === n, onClick: (el) => { n = k; el.parentNode.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === el)); b.load(circuit(n)); } })));

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Series circuits</h2>'),
      ctx.h('<p class="lede">Put bulbs one after another on a single path and they share the battery\'s push. Add a bulb and they all get dimmer.</p>'),
    );
    const stat = ctx.h('<div class="stat"><div><b class="i">0</b><span>Current</span></div><div><b class="r">0</b><span>Total R</span></div><div><b class="b">0</b><span>Each bulb</span></div></div>');
    ctx.panel.append(stat);
    ctx.loop(() => {
      const B = b.part('B'); if (!B) return;
      const bulbs = b.parts.filter((p) => p.type === 'bulb');
      stat.querySelector('.i').textContent = fmt(Math.abs(B.i), 'A');
      stat.querySelector('.r').textContent = bulbs.length ? fmt(bulbs.reduce((s, p) => s + p.R, 0), 'Ω') : '--';
      stat.querySelector('.b').textContent = bulbs.length ? `${Math.round(Math.min(1.5, Math.max(0, bulbs[0].p) / bulbs[0].rated) * 100)}%` : '--';
    });
    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>In series there is only one path, so <b>the same current flows through every bulb</b>. Watch the dots: they move at the same speed all the way round.</p>
      <p>The battery's voltage is <b>shared out</b>. With two identical bulbs each gets half, with three each gets a third. The wire colours show it: the voltage steps down at each bulb.</p>
      <p>More bulbs means more total resistance, so less current, so every bulb is dimmer. And if one bulb breaks, the single path is cut and they all go out.</p>
    </div>`));
    let broke = false;
    ctx.panel.append(tasks(ctx, [
      { text: 'Use the <b>Bulbs</b> buttons at the bottom to go from 1 to 3 bulbs. Watch them dim.', check: () => n === 3 },
      { text: 'Tap a bulb to read the voltage across it. Do the bulb voltages add up to the battery?', check: () => b.selected?.type === 'bulb' },
      { text: 'Delete one bulb (tap it, then Delete). Everything goes dark.', check: () => { const B = b.part('B'); if (B && b.parts.filter((p) => p.type === 'bulb').length < n && Math.abs(B.i) < 1e-3) broke = true; return broke; } },
      { text: 'Fix the gap: drag from one loose end to the other to draw a wire.', check: () => broke && Math.abs(b.part('B')?.i || 0) > 0.1 },
    ]));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div>
      <div class="formula">R<sub>total</sub> = R<sub>1</sub> + R<sub>2</sub> + R<sub>3</sub><span>resistances in series add up</span></div>
      <div class="formula">V<sub>battery</sub> = V<sub>1</sub> + V<sub>2</sub> + V<sub>3</sub><span>the drops add up to the push (Kirchhoff's voltage law)</span></div>
      <p>Each bulb here is 12 Ω and rated 3 W at 6 V. With two in series each gets about 3 V, so it uses V²/R = 0.75 W, a quarter of its rated power. With three it gets 2 V and only 0.33 W. Brightness falls much faster than the voltage.</p>
      <p>Old Christmas lights were wired in series, which is why one dead bulb could darken the whole string. Many modern strings add a shunt inside each bulb that bypasses it when the filament breaks.</p>
      <p>Real filaments are not ohmic: a dim, cooler filament has lower resistance than a bright one, so real bulbs in series do a little better than this fixed resistance model shows.</p>
    </div></details>`));
    ctx.quiz([
      { q: 'Three bulbs are in series and one breaks. What happens?', choices: ['Only that bulb goes out', 'All of them go out', 'The other two get brighter'], answer: 1, why: 'There is only one path. Break it anywhere and current stops everywhere.' },
      { q: 'Two identical bulbs in series on a 6 V battery. What voltage is across each?', choices: ['6 V', '3 V', '12 V'], answer: 1, why: 'The battery voltage is shared equally between identical bulbs.' },
      { q: 'Adding another bulb in series makes the current...', choices: ['bigger', 'smaller', 'the same'], answer: 1, why: 'Total resistance goes up, so for the same voltage the current goes down (I = V / R).' },
    ]);
  },
};
