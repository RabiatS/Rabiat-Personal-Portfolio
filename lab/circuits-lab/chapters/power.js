import { createBoard, tasks, split } from '../board.js';
import { fmt } from '../solver.js';
import { path } from '../presets.js';

const BA = { id: 'LA', type: 'bulb', R: 24, rated: 6, label: 'A' };
const BB = { id: 'LB', type: 'bulb', R: 72, rated: 2, label: 'B' };
function circuit(mode) {
  const bat = { id: 'B', type: 'battery', pts: [[1, 4], [1, 1]], V: 12, r: 0.05 };
  if (mode === 'parallel') {
    return { cols: 8, rows: 5, parts: [bat, ...path([1, 1], [4, 1], [7, 1]), { ...BA, pts: [[4, 1], [4, 4]] }, { ...BB, pts: [[7, 1], [7, 4]] }, ...path([7, 4], [4, 4], [1, 4])] };
  }
  return { cols: 8, rows: 5, parts: [bat, ...path([1, 1], [2, 1]), { ...BA, pts: [[2, 1], [5, 1]] }, ...path([5, 1], [7, 1]), { ...BB, pts: [[7, 1], [7, 4]] }, ...path([7, 4], [1, 4])] };
}

export default {
  mount(ctx) {
    const C = ctx.colors;
    let side = null; let mode = 'parallel'; let energy = 0; let sawSeries = false;
    const b = createBoard(ctx, {
      circuit: circuit(mode), editable: false, dotScale: 6,
      layout(avail) { const s = split(avail, 0.32, 210); side = s.side; return s.circuit; },
      onStep(bb, h) { const B = bb.part('B'); if (B) energy += Math.max(0, -B.p) * h; },
      onReset() { energy = 0; },
      draw(g) {
        if (!side) return;
        const A = b.part('LA'); const Bb = b.part('LB'); if (!A || !Bb) return;
        g.save(); g.font = '500 11px "DM Mono", monospace';
        g.fillStyle = 'rgba(20,20,20,.55)'; g.strokeStyle = '#2A2A2A'; g.beginPath(); g.roundRect(side.x, side.y, side.w, side.h, 10); g.fill(); g.stroke();
        g.fillStyle = C.muted; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('Power in each bulb', side.x + 10, side.y + 8);
        const horiz = side.w > side.h; const pmax = 7;
        const items = [[A, C.c2], [Bb, C.c3]];
        if (horiz) {
          const L = side.x + 46; const Wd = side.w - 120; const hh = Math.min(22, (side.h - 70) / 2);
          items.forEach(([p, col], k) => {
            const y = side.y + 30 + k * (hh + 8); const P = Math.max(0, p.p);
            g.fillStyle = C.muted; g.textBaseline = 'middle'; g.fillText(p.label, side.x + 14, y + hh / 2);
            g.fillStyle = '#2A2A2A'; g.fillRect(L, y, Wd, hh); g.fillStyle = col; g.fillRect(L, y, Wd * Math.min(1, P / pmax), hh);
            g.fillStyle = C.text; g.fillText(fmt(P, 'W'), L + Wd + 8, y + hh / 2);
          });
          g.fillStyle = C.muted; g.textBaseline = 'bottom'; g.fillText(`energy from battery ${fmt(energy, 'J')}`, side.x + 10, side.y + side.h - 8);
        } else {
          const top = side.y + 36; const bot = side.y + side.h - 86; const bw = Math.min(46, (side.w - 50) / 3);
          items.forEach(([p, col], k) => {
            const x = side.x + side.w / 2 + (k ? 8 : -bw - 8); const P = Math.max(0, p.p); const hgt = (bot - top) * Math.min(1, P / pmax);
            g.fillStyle = '#242424'; g.fillRect(x, top, bw, bot - top); g.fillStyle = col; g.fillRect(x, bot - hgt, bw, hgt);
            g.fillStyle = C.text; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(fmt(P, 'W'), x + bw / 2, bot - hgt - 4);
            g.fillStyle = C.muted; g.textBaseline = 'top'; g.fillText(`bulb ${p.label}`, x + bw / 2, bot + 6); g.fillText(`${p.R} Ω`, x + bw / 2, bot + 20);
          });
          g.textAlign = 'left'; g.fillStyle = C.muted; g.textBaseline = 'bottom';
          g.fillText('energy from battery', side.x + 10, side.y + side.h - 24); g.fillStyle = C.text; g.fillText(`${fmt(energy, 'J')}  (${fmt(energy / 3600, 'Wh')})`, side.x + 10, side.y + side.h - 8);
        }
        g.restore();
      },
    });
    const seg = b.segDock('Wiring', [['parallel', 'Parallel'], ['series', 'Series']], mode, (v) => { mode = v; if (v === 'series') sawSeries = true; b.load(circuit(v)); energy = 0; });
    void seg;

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Power and energy</h2>'),
      ctx.h('<p class="lede">Power is how fast energy is delivered. A bulb\'s brightness follows its power, not just its voltage or its current.</p>'),
      ctx.h('<div class="formula">P = V × I<span>watts = volts × amps. With Ohm\'s law also P = I² R = V² / R</span></div>'),
    );
    const stat = ctx.h('<div class="stat"><div><b class="a">0</b><span>Bulb A</span></div><div><b class="b">0</b><span>Bulb B</span></div><div><b class="t">0</b><span>Battery gives</span></div></div>');
    ctx.panel.append(stat);
    ctx.loop(() => {
      const A = b.part('LA'); const Bb = b.part('LB'); const B = b.part('B'); if (!A || !Bb || !B) return;
      stat.querySelector('.a').textContent = fmt(Math.max(0, A.p), 'W');
      stat.querySelector('.b').textContent = fmt(Math.max(0, Bb.p), 'W');
      stat.querySelector('.t').textContent = fmt(Math.max(0, -B.p), 'W');
    });
    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>Each charge that passes through a bulb hands over some energy. Voltage is the energy per charge, current is how many charges pass per second, so <b>volts times amps is energy per second</b>: watts.</p>
      <p>Bulb A (24 Ω, rated 6 W) and bulb B (72 Ω, rated 2 W) are both made for 12 V. In parallel each gets 12 V, and the low resistance bulb A takes more current and shines brighter.</p>
      <p>Now switch to series. The same current flows through both, and P = I² R means the <b>bigger resistance takes more power</b>. Bulb B now outshines A.</p>
    </div>`));
    ctx.panel.append(tasks(ctx, [
      { text: 'In parallel, tap each bulb to read its power. Do they match their ratings?', check: () => mode === 'parallel' && b.selected?.type === 'bulb' },
      { text: 'Switch the wiring to <b>Series</b> with the bar at the bottom. Which bulb wins now?', check: () => sawSeries },
      { text: 'Use the calculator below to find what a 2000 W kettle costs per year.', check: () => calcW >= 2000 },
    ]));

    // kWh cost calculator
    let calcW = 60;
    const calc = ctx.h(`<div class="card">
      <h3>What does it cost to run?</h3>
      <div class="row presets"></div>
      <div class="sl"></div>
      <div class="formula out"></div>
      <p class="hint">Electricity is sold by the kilowatt hour (kWh): 1000 W running for one hour. The price varies a lot by country and supplier, so set your own.</p>
    </div>`);
    const presets = [['LED bulb', 9, 5], ['Old bulb', 60, 5], ['Laptop', 50, 6], ['TV', 100, 4], ['Kettle', 2000, 0.25], ['Heater', 2000, 4]];
    const sW = ctx.slider({ label: 'Power', min: 1, max: 3000, step: 1, value: 60, fmt: (v) => `${v} W`, onInput: (v) => { calcW = v; upd(); } });
    const sH = ctx.slider({ label: 'Hours per day', min: 0.25, max: 24, step: 0.25, value: 5, fmt: (v) => `${(+v).toFixed(2)} h`, onInput: upd });
    const sP = ctx.slider({ label: 'Price per kWh', min: 0.05, max: 0.6, step: 0.01, value: 0.25, fmt: (v) => `${(+v).toFixed(2)}`, onInput: upd });
    calc.querySelector('.sl').append(sW, sH, sP);
    calc.querySelector('.sl').style.cssText = 'display:grid;gap:8px';
    const pr = calc.querySelector('.presets');
    for (const [name, wv, hv] of presets) {
      const c = ctx.h(`<button class="chip">${name}</button>`);
      c.onclick = () => { sW.value = wv; sH.value = hv; calcW = wv; pr.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === c)); upd(); };
      pr.append(c);
    }
    function upd() {
      const kwh = (sW.value / 1000) * sH.value; const p = sP.value;
      calc.querySelector('.out').innerHTML = `${(sW.value / 1000).toFixed(3)} kW × ${sH.value} h = ${kwh.toFixed(2)} kWh a day
        <span>about ${(kwh * p).toFixed(2)} a day, ${(kwh * p * 30).toFixed(2)} a month, ${(kwh * p * 365).toFixed(0)} a year (in your currency)</span>`;
    }
    upd();
    ctx.panel.append(calc);
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div>
      <p><b>Energy</b> is power times time: E = P t. One watt for one second is one joule. One kWh is 1000 W × 3600 s = 3.6 million joules.</p>
      <p><b>Rated power</b> is what a bulb uses at its design voltage. The ratings here follow from P = V² / R: 12² / 24 = 6 W and 12² / 72 = 2 W. The simulator shows brightness as power divided by rated power.</p>
      <p><b>Why the grid uses high voltage.</b> Power lost heating a cable is I² R. Sending the same power at a much higher voltage needs much less current, so the losses fall with the square of the current. Transformers step the voltage up for long distance lines and down again near your home.</p>
      <p><b>Efficiency.</b> An old filament bulb turns only a few percent of its power into visible light, the rest is heat. An LED gives similar light for a fraction of the watts, which is why the calculator's LED bulb costs so much less than the old one.</p>
    </div></details>`));
    ctx.quiz([
      { q: 'A device takes 2 A from a 12 V supply. What is its power?', choices: ['6 W', '14 W', '24 W'], answer: 2, why: 'P = V × I = 12 × 2 = 24 W.' },
      { q: 'A 2 kW heater runs for 3 hours. How much energy does it use?', choices: ['6 kWh', '0.67 kWh', '2 kWh'], answer: 0, why: 'Energy = power × time = 2 kW × 3 h = 6 kWh.' },
      { q: 'Two bulbs with different resistances are in parallel on the same battery. Which is brighter?', choices: ['The higher resistance one', 'The lower resistance one', 'They are the same'], answer: 1, why: 'Both get the same voltage, and P = V² / R, so the lower resistance takes more power.' },
    ]);
  },
};
