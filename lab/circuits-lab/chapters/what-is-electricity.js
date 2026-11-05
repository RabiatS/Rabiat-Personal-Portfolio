import { createBoard, tasks, split } from '../board.js';
import { fmt } from '../solver.js';

const CIRCUIT = {
  cols: 6, rows: 4,
  parts: [
    { id: 'B', type: 'battery', pts: [[1, 3], [1, 1]], V: 6, r: 0.1 },
    { type: 'wire', pts: [[1, 1], [2, 1]] },
    { id: 'S', type: 'switch', pts: [[2, 1], [4, 1]], closed: true },
    { type: 'wire', pts: [[4, 1], [5, 1]] },
    { id: 'L', type: 'bulb', pts: [[5, 1], [5, 3]], R: 12, rated: 3 },
    { type: 'wire', pts: [[5, 3], [1, 3]] },
  ],
};

export default {
  mount(ctx) {
    const C = ctx.colors;
    let side = null; let wheel = 0; let pump = 0; let flowPh = 0;
    const b = createBoard(ctx, {
      circuit: CIRCUIT, editable: false, dotScale: 5,
      layout(avail) { const s = split(avail, 0.5, 260); side = s.side; return s.circuit; },
      draw(g, w, h, t) { drawWater(g, t); },
    });

    // Water circuit drawn from the same simulation numbers
    let lastT = 0;
    function drawWater(g, t) {
      const dt = Math.min(0.05, t - lastT || 0); lastT = t;
      if (!side) return;
      const bat = b.part('B'); const bulb = b.part('L'); const sw = b.part('S');
      if (!bat || !bulb || !sw) return;
      const I = Math.abs(bulb.i || 0); const Vb = bat.V;
      const s = side; const pw = Math.max(10, Math.min(s.w, s.h) * 0.075);
      const lw = s.w - pw * 6.4; const lh = Math.min(s.h - pw * 6, lw * 0.85);
      const x0 = s.x + (s.w - lw) / 2 - pw * 0.6; const x1 = x0 + lw; const y0 = s.y + (s.h - lh) / 2 + pw * 0.3; const y1 = y0 + lh;
      const hi = Math.min(1, Vb / 12);
      const press = (k) => { // k: 1 high, 0 low pressure
        const a = 0.18 + 0.55 * k * hi; return `rgba(${Math.round(96 + (251 - 96) * k * hi)},${Math.round(165 + (113 - 165) * k * hi)},${Math.round(250 + (133 - 250) * k * hi)},${a})`;
      };
      g.save();
      g.fillStyle = 'rgba(20,20,20,.55)'; g.strokeStyle = '#2A2A2A'; g.lineWidth = 1;
      g.beginPath(); g.roundRect(s.x, s.y, s.w, s.h, 12); g.fill(); g.stroke();
      g.font = '500 11px "DM Mono", monospace'; g.fillStyle = C.muted; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText('The same circuit, as water', s.x + 10, s.y + 8);
      g.lineCap = 'round'; g.lineJoin = 'round';
      const seg = (A, B, wdt, col) => { g.strokeStyle = col; g.lineWidth = wdt; g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke(); };
      // pipe walls then water
      const narrowF = Math.max(0.22, Math.min(0.8, 1 - bulb.R / 60));
      const ym1 = y0 + (y1 - y0) * 0.32; const ym2 = y0 + (y1 - y0) * 0.68;
      const shell = '#3A3A38';
      for (const [A, B, wd] of [[[x0, y1], [x0, y0], pw], [[x0, y0], [x1, y0], pw], [[x1, y0], [x1, ym1], pw], [[x1, ym2], [x1, y1], pw], [[x1, y1], [x0, y1], pw]]) seg(A, B, wd + 4, shell);
      seg([x1, ym1], [x1, ym2], pw * narrowF + 4, shell);
      // water with pressure colours
      const gl = g.createLinearGradient(0, y1, 0, y0); gl.addColorStop(0, press(0)); gl.addColorStop(1, press(1));
      seg([x0, y1], [x0, y0], pw, gl);
      seg([x0, y0], [x1, y0], pw, press(1));
      seg([x1, y0], [x1, ym1], pw, press(1));
      const gr = g.createLinearGradient(0, ym1, 0, ym2); gr.addColorStop(0, press(1)); gr.addColorStop(1, press(0));
      seg([x1, ym1], [x1, ym2], pw * narrowF, gr);
      seg([x1, ym2], [x1, y1], pw, press(0));
      seg([x1, y1], [x0, y1], pw, press(0));
      // flowing particles (speed from the simulated current)
      const v = 150 * Math.tanh(I / 0.9);
      flowPh += v * dt;
      const pathPts = [[x0, y1], [x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      const lens = []; let tot = 0; for (let k = 0; k < 4; k++) { const L = Math.hypot(pathPts[k + 1][0] - pathPts[k][0], pathPts[k + 1][1] - pathPts[k][1]); lens.push(L); tot += L; }
      const sp = 18; g.fillStyle = 'rgba(220,240,255,.85)';
      for (let d = ((flowPh % sp) + sp) % sp; d < tot; d += sp) {
        let k = 0; let dd = d; while (k < 3 && dd > lens[k]) { dd -= lens[k]; k++; }
        const A = pathPts[k]; const B = pathPts[k + 1]; const tt = dd / lens[k];
        const x = A[0] + (B[0] - A[0]) * tt; const y = A[1] + (B[1] - A[1]) * tt;
        g.beginPath(); g.arc(x, y, Math.max(1.6, pw * 0.13), 0, Math.PI * 2); g.fill();
      }
      // pump (battery) on the left
      pump += (Vb > 0 && sw.closed ? 2 + Vb * 0.4 : Vb > 0 ? 0 : 0) * dt * (I > 1e-4 ? 1 : 0.15);
      const pr = pw * 1.25; const pc = [x0, (y0 + y1) / 2];
      g.fillStyle = '#1E1E1E'; g.strokeStyle = C.c4; g.lineWidth = 2; g.beginPath(); g.arc(pc[0], pc[1], pr, 0, Math.PI * 2); g.fill(); g.stroke();
      g.strokeStyle = C.text; g.lineWidth = 1.6;
      for (let k = 0; k < 4; k++) { const a = pump + (k * Math.PI) / 2; g.beginPath(); g.moveTo(pc[0], pc[1]); g.lineTo(pc[0] + Math.cos(a) * pr * 0.75, pc[1] + Math.sin(a) * pr * 0.75); g.stroke(); }
      // valve (switch) on the top
      const vc = [(x0 + x1) / 2, y0];
      g.fillStyle = sw.closed ? '#2A2A2A' : C.c2; g.strokeStyle = sw.closed ? C.muted : C.c2; g.lineWidth = 2;
      if (sw.closed) { g.beginPath(); g.moveTo(vc[0], vc[1] - pw * 0.5); g.lineTo(vc[0], vc[1] - pw * 1.3); g.stroke(); g.beginPath(); g.arc(vc[0], vc[1] - pw * 1.4, 4, 0, Math.PI * 2); g.fill(); }
      else { g.fillRect(vc[0] - 3, vc[1] - pw * 0.75, 6, pw * 1.5); g.beginPath(); g.moveTo(vc[0], vc[1] - pw * 0.75); g.lineTo(vc[0], vc[1] - pw * 1.5); g.stroke(); }
      // water wheel (bulb) beside the narrow pipe
      wheel += Math.tanh(I / 0.9) * 6 * dt;
      const wc = [x1 + pw * 1.6, (ym1 + ym2) / 2]; const wr = pw * 1.25;
      const lit = Math.min(1, Math.max(0, bulb.p) / bulb.rated);
      g.strokeStyle = lit > 0.05 ? `rgba(255,214,128,${0.4 + 0.6 * lit})` : C.muted; g.lineWidth = 1.6;
      g.beginPath(); g.arc(wc[0], wc[1], wr, 0, Math.PI * 2); g.stroke();
      for (let k = 0; k < 6; k++) { const a = wheel + (k * Math.PI) / 3; g.beginPath(); g.moveTo(wc[0], wc[1]); g.lineTo(wc[0] + Math.cos(a) * wr, wc[1] + Math.sin(a) * wr); g.stroke(); }
      // labels
      g.fillStyle = C.muted; g.textBaseline = 'middle';
      g.textAlign = 'left'; g.fillText('pump', pc[0] + pr + 6, pc[1] - 7); g.fillStyle = C.c4; g.fillText('= battery', pc[0] + pr + 6, pc[1] + 8);
      g.fillStyle = C.muted; g.textAlign = 'center'; g.textAlign = 'left'; g.fillText(sw.closed ? 'valve open' : 'valve shut', vc[0] + 12, vc[1] - pw * 1.9); g.fillStyle = C.c2; g.fillText('= switch', vc[0] + 12, vc[1] - pw * 1.9 + 14);
      g.textAlign = 'right'; g.fillStyle = C.muted; g.fillText('narrow pipe', x1 - pw * 0.9, wc[1] - 7); g.fillStyle = '#FFD27A'; g.fillText('+ wheel = bulb', x1 - pw * 0.9, wc[1] + 8);
      g.textAlign = 'center'; g.fillStyle = C.muted;
      g.fillText(`flow = current  ${fmt(I, 'A')}`, (x0 + x1) / 2, y1 + pw * 1.3);
      g.fillStyle = press(1); g.textAlign = 'left'; g.fillText(Vb > 0 ? 'high pressure' : '', x0 + pw, y0 + pw * 1.1);
      g.fillStyle = 'rgba(96,165,250,.9)'; g.fillText('low pressure', x0 + pw, y1 - pw * 1.1);
      g.restore();
    }

    ctx.panel.append(
      ctx.h('<h2 class="k-h">What electricity is</h2>'),
      ctx.h('<p class="lede">A wire is already full of charge. A battery does not add any: it pushes the charge that is there around a loop.</p>'),
    );
    const sV = ctx.slider({ label: 'Battery voltage (the push)', min: 0, max: 12, step: 0.5, value: 6, fmt: (v) => `${(+v).toFixed(1)} V`, onInput: (v) => { const p = b.part('B'); if (p) p.V = v; } });
    const sR = ctx.slider({ label: 'Bulb resistance (how narrow)', min: 4, max: 48, step: 1, value: 12, fmt: (v) => `${v} Ω`, onInput: (v) => { const p = b.part('L'); if (p) p.R = v; } });
    const stat = ctx.h('<div class="stat"><div><b class="i">0</b><span>Current</span></div><div><b class="v">0</b><span>Voltage</span></div><div><b class="n">0</b><span>Electrons / s</span></div></div>');
    ctx.panel.append(sV, sR, stat);
    ctx.loop(() => {
      const L = b.part('L'); const B = b.part('B'); if (!L || !B) return;
      stat.querySelector('.i').textContent = fmt(Math.abs(L.i), 'A');
      stat.querySelector('.v').textContent = fmt(B.V, 'V');
      const n = Math.abs(L.i) / 1.602e-19;
      stat.querySelector('.n').textContent = n < 1 ? '0' : `${(n / 10 ** Math.floor(Math.log10(n))).toFixed(1)}e${Math.floor(Math.log10(n))}`;
    });
    ctx.panel.append(ctx.h(`<div class="card tip">
      <p><b>Charge</b> is a property of tiny particles. In a metal wire the movable ones are electrons, and there are huge numbers of them in every millimetre.</p>
      <p><b>Current</b> is how much charge flows past a point each second, measured in amps (A). The moving dots show it: faster dots, more current.</p>
      <p><b>Voltage</b> is the push that drives the charge, measured in volts (V). In the water picture it is the pressure the pump makes.</p>
      <p>The dots never pile up or vanish. Whatever flows out of the battery comes back to it. The bulb does not use up current, it turns the energy carried by the charge into light and heat.</p>
    </div>`));
    let sawOpen = false;
    ctx.panel.append(tasks(ctx, [
      { text: 'Tap the switch to open it. Both the dots and the water stop at once.', check: () => { const s = b.part('S'); if (s && !s.closed) sawOpen = true; return sawOpen; } },
      { text: 'Close it again.', check: () => sawOpen && b.part('S')?.closed },
      { text: 'Turn the voltage up to 10 V or more. More push, faster flow, brighter bulb.', check: () => b.part('B')?.V >= 10 },
      { text: 'Make the bulb resistance 36 Ω or more. A narrower pipe lets less through.', check: () => b.part('L')?.R >= 36 },
      { text: 'Press <b>Electrons</b> in the bottom bar to see which way electrons really drift.', check: () => b.opt.flow === 'electron' },
    ]));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div>
      <p><b>Units.</b> One amp is one coulomb of charge per second. One coulomb is the charge of about 6.24 × 10<sup>18</sup> electrons. One volt means each coulomb gains or loses one joule of energy.</p>
      <p><b>Which way does current flow?</b> Long before the electron was discovered, current was defined as flowing from + to - around the circuit. Electrons are negative, so they actually drift the other way. Both descriptions give the same answers, and circuit diagrams still use the old "conventional" direction.</p>
      <p><b>How fast?</b> The electrons themselves drift slowly. With 1 A in a copper wire 1 mm² thick they move at well under a millimetre per second. The bulb still lights instantly because the push travels through the wire as an electric field at a large fraction of the speed of light, so charges everywhere in the loop start moving at almost the same moment.</p>
      <p><b>Where the analogy breaks.</b> Water can spill from a cut pipe, but charge cannot leave a cut wire. And a real pump moves water, while a battery is a chemical reaction that keeps one terminal at a higher electrical potential than the other.</p>
    </div></details>`));
    ctx.quiz([
      { q: 'What does the voltage of a battery do?', choices: ['It stores current for later', 'It pushes charge around the circuit, like pressure from a pump', 'It creates new electrons'], answer: 1, why: 'Voltage is the push (energy per unit of charge). The charge was already in the wires.' },
      { q: 'In a single loop with one bulb, how does the current coming back to the battery compare with the current leaving it?', choices: ['It is the same', 'It is smaller, the bulb used some up', 'It is zero'], answer: 0, why: 'Charge is not used up. The bulb takes energy from it, but the same amount of charge flows all the way round.' },
      { q: 'In the water picture, what plays the part of electrical resistance?', choices: ['The pump', 'A narrow section of pipe', 'The amount of water in the pipes'], answer: 1, why: 'A narrow pipe resists the flow, the way a resistor or a thin filament resists current.' },
    ]);
  },
};
