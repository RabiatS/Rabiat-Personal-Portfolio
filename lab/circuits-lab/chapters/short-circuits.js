import { createBoard, tasks, split, plot } from '../board.js';
import { fmt } from '../solver.js';
import { path } from '../presets.js';

function circuit(fuse) {
  return {
    cols: 9, rows: 5,
    parts: [
      { id: 'B', type: 'battery', pts: [[1, 4], [1, 1]], V: 12, r: 0.2 },
      fuse ? { id: 'F', type: 'fuse', pts: [[1, 1], [3, 1]], rating: 2 } : { type: 'wire', pts: [[1, 1], [3, 1]] },
      ...path([3, 1], [5, 1]),
      { id: 'L', type: 'bulb', pts: [[5, 1], [5, 4]], R: 12, rated: 12 },
      ...path([5, 1], [7, 1]),
      { id: 'S', type: 'switch', pts: [[7, 1], [7, 4]], closed: false, label: 'short' },
      ...path([7, 4], [5, 4], [1, 4]),
    ],
  };
}

export default {
  mount(ctx) {
    const C = ctx.colors;
    let side = null; let fuse = true; const hist = []; let peak = 0; let blew = false; let replaced = false; let sampleT = 0;
    const b = createBoard(ctx, {
      circuit: circuit(fuse), editable: false, dotScale: 4, hotA: 8,
      layout(avail) { const s = split(avail, 0.4, 230); side = s.side; return s.circuit; },
      onStep(bb, h) {
        const B = bb.part('B'); if (!B) return;
        const I = Math.abs(B.i); peak = Math.max(peak, I);
        sampleT += h;
        // keep the biggest value in each sample so a short spike is never lost
        if (!hist.length || sampleT > 0.03) { hist.push([bb.time, I]); sampleT = 0; if (hist.length > 240) hist.shift(); } else hist[hist.length - 1][1] = Math.max(hist[hist.length - 1][1], I);
      },
      onLoad() { hist.length = 0; },
      onEvent(ev) { if (ev.type === 'blow') blew = true; },
      draw(g) {
        if (!side || !hist.length) return;
        const t1 = b.time; const t0 = t1 - 6;
        const L = (I) => Math.log10(Math.max(0.01, I));
        const r = { x: side.x + 40, y: side.y + 30, w: side.w - 56, h: side.h - 66 };
        const F = b.part('F');
        const pr = plot(g, r, {
          xmin: t0, xmax: t1, ymin: -2, ymax: 2, colors: C,
          yticks: [[-1, '0.1 A'], [0, '1 A'], [1, '10 A'], [2, '100 A']], ylabel: 'battery current (log scale), last 6 s',
          series: [{ data: hist.filter(([t]) => t >= t0).map(([t, I]) => [t, L(I)]), color: C.c2, width: 2 }].concat(F ? [{ data: [[t0, L(F.rating)], [t1, L(F.rating)]], color: C.c4, width: 1, dash: [4, 4] }] : []),
        });
        g.save(); g.font = '500 11px "DM Mono", monospace'; g.textAlign = 'right'; g.textBaseline = 'bottom';
        if (F) { g.fillStyle = C.c4; g.fillText(`fuse rating ${fmt(F.rating, 'A')}`, r.x + r.w - 4, pr.Y(L(F.rating)) - 3); }
        const B = b.part('B');
        if (B) {
          const heat = B.i * B.i * B.r;
          g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = heat > 50 ? C.c4 : C.muted;
          g.fillText(`heat inside battery ${fmt(heat, 'W')}`, r.x, r.y + r.h + 18);
        }
        g.restore();
      },
    });
    const fseg = b.segDock('Protection', [['fuse', 'Fuse'], ['none', 'No fuse']], 'fuse', (v) => { fuse = v === 'fuse'; b.load(circuit(fuse)); peak = 0; });
    void fseg;

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Short circuits and fuses</h2>'),
      ctx.h('<p class="lede">A short circuit is a path with almost no resistance. Current takes it, and with nothing to limit it, it becomes enormous.</p>'),
    );
    const stat = ctx.h('<div class="stat"><div><b class="i">0</b><span>Current now</span></div><div><b class="p">0</b><span>Peak</span></div><div><b class="f">ok</b><span>Fuse</span></div></div>');
    ctx.panel.append(stat);
    const rp = ctx.h('<button class="btn sm ghost" style="align-self:flex-start">Reset peak</button>'); rp.onclick = () => { peak = 0; };
    ctx.panel.append(rp);
    ctx.loop(() => {
      const B = b.part('B'); if (!B) return; const F = b.part('F');
      stat.querySelector('.i').textContent = fmt(Math.abs(B.i), 'A');
      stat.querySelector('.p').textContent = fmt(peak, 'A');
      stat.querySelector('.f').textContent = !F ? 'none' : F.blown ? 'blown' : 'ok';
      stat.querySelector('.f').style.color = !F || F.blown ? C.c4 : '';
      if (blew && F && !F.blown) replaced = true;
    });
    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>Normally the 12 Ω bulb limits the current to about 1 A. The switch on the right is a deliberate short: a plain wire straight across the bulb.</p>
      <p>Close it and current skips the bulb (which goes dark) and rushes through the wire. Now the only things limiting it are the tiny resistances of the wires and the battery itself, so it jumps to tens of amps.</p>
      <p>All that current heats the wires and the battery (power = I² R). In a house this is how fires start. A <b>fuse</b> is a deliberately thin wire in series: it melts first and breaks the circuit before anything else gets hot.</p>
    </div>`));
    let sawNoFuseShort = false;
    ctx.panel.append(tasks(ctx, [
      { text: 'Tap the <b>short</b> switch to close it. The fuse blows almost instantly.', check: () => blew },
      { text: 'Open the short again, then tap the fuse and press <b>New fuse</b>. The bulb comes back.', check: () => replaced && !b.part('S')?.closed },
      { text: 'Choose <b>No fuse</b> at the bottom and close the short. Watch the wires glow and the battery heat soar.', check: () => { if (!fuse && b.part('S')?.closed) sawNoFuseShort = true; return sawNoFuseShort; } },
      { text: 'Put the fuse back before you leave.', check: () => sawNoFuseShort && fuse },
    ]));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div>
      <p><b>The numbers.</b> With the short closed and no fuse, the current is roughly 12 V / 0.2 Ω = 60 A, set almost entirely by the battery's internal resistance. The battery turns I² r = 60² × 0.2 = 720 W into heat inside itself. Real batteries can swell, leak or catch fire when shorted.</p>
      <p><b>How a fuse decides.</b> The fuse here heats in proportion to (I / rating)², so a small overload takes a while to blow it but a short blows it in a few milliseconds. Real fuses have a similar time versus current curve, and come in fast and slow (time delay) types for loads like motors that briefly draw a surge when they start.</p>
      <p><b>Choosing a fuse.</b> Pick a rating a bit above the normal current but below what the wires can safely carry. The fuse protects the wiring, so it goes in series, close to the supply, on the live side.</p>
      <p><b>Breakers and RCDs.</b> Modern homes use circuit breakers, which trip instead of melting and can be reset. A residual current device (RCD, or GFCI in North America) is different again: it compares the current going out with the current coming back and trips if a few milliamps are leaking somewhere, for example through a person.</p>
    </div></details>`));
    ctx.quiz([
      { q: 'Why is a short circuit dangerous?', choices: ['It stops all current', 'The very large current heats wires and can start a fire', 'It makes the voltage much higher'], answer: 1, why: 'Almost no resistance means a huge current, and heating goes as I² R.' },
      { q: 'Where should a fuse go?', choices: ['In series with the circuit it protects', 'In parallel with the bulb', 'Anywhere, it does not matter'], answer: 0, why: 'In series, so that when it melts it breaks the whole path.' },
      { q: 'A circuit normally draws 5 A. A 3 A fuse is fitted. What happens?', choices: ['Nothing', 'The fuse blows', 'The current drops to 3 A'], answer: 1, why: 'The normal current is above the rating, so the fuse heats up and melts. The rating must be above the normal current.' },
    ]);
  },
};
