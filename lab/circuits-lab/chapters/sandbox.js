import { createBoard, tasks } from '../board.js';
import { PRESETS } from '../presets.js';

const ALL = ['wire', 'battery', 'resistor', 'bulb', 'switch', 'spdt', 'led', 'diode', 'fuse', 'capacitor', 'inductor', 'ldr', 'ammeter', 'voltmeter'];

export default {
  mount(ctx) {
    const last = ctx.store.get('sandbox:last', null);
    const start = last && Array.isArray(last.parts) ? last : PRESETS.find((p) => p.id === 'loop').circuit;
    let loadedPreset = null; let saved = false;
    const b = createBoard(ctx, { circuit: start, palette: ALL, dotScale: 'auto' });
    b.segDock('Dots', [['auto', 'Auto'], [4, 'Fixed']], 'auto', (v) => { b.opt.dotScale = v; });
    b.segDock('Speed', [[1, '1×'], [5, '5×']], 1, (v) => { b.opt.timeScale = v; });
    // Autosave every 1.5 s, but only write storage when the circuit actually changed.
    // Compared by snapshot because switch taps and inspector edits do not all fire onChange.
    let tick = 0; let lastSaved = JSON.stringify(start);
    ctx.loop((t, dt) => {
      tick += dt; if (tick <= 1.5) return; tick = 0;
      const snap = b.serialize(); const json = JSON.stringify(snap);
      if (json !== lastSaved) { lastSaved = json; ctx.store.set('sandbox:last', snap); }
    });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Sandbox</h2>'),
      ctx.h('<p class="lede">Everything from the earlier chapters, all in one place. Build whatever you like.</p>'),
      ctx.h(`<div class="card tip">
        <p><b>Add a part:</b> drag it from the bar at the top onto the grid, or tap it and then tap the grid.</p>
        <p><b>Wire:</b> drag from one grid point to another. Wires connect only at their ends, and a wire is split automatically where a part touches it.</p>
        <p><b>Edit:</b> tap a part to change its value, rotate, flip or delete it. Drag a part to move it, or drag its round handles to stretch it. Tap a switch to flip it. Loose ends are ringed in yellow.</p>
        <p>With <b>Auto</b> dots the speed is scaled to the biggest current on the board, so a tiny circuit still shows motion. Choose <b>Fixed</b> to compare currents between circuits fairly.</p>
      </div>`),
    );
    const pre = ctx.h('<div class="card"><h3>Start from a preset</h3><div class="row chips"></div><p class="small note muted">Your work is kept in this browser as you go.</p></div>');
    const chips = pre.querySelector('.chips'); const note = pre.querySelector('.note');
    for (const p of PRESETS) {
      const c = ctx.h(`<button class="chip">${p.name}</button>`);
      c.onclick = () => { b.load(p.circuit); loadedPreset = p.id; note.textContent = p.note; chips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === c)); };
      chips.append(c);
    }
    ctx.panel.append(pre);

    const saves = ctx.h(`<div class="card"><h3>Your circuits</h3>
      <div class="row"><input class="txt" type="text" maxlength="40" placeholder="Name this circuit" aria-label="Circuit name" style="flex:1;min-width:0"><button class="btn sm sv">Save</button></div>
      <div class="list" style="display:grid;gap:6px"></div></div>`);
    const list = saves.querySelector('.list'); const inp = saves.querySelector('input');
    function render() {
      const all = ctx.store.get('sandbox:saves', {});
      const names = Object.keys(all).sort();
      list.innerHTML = names.length ? '' : '<p class="hint">Nothing saved yet.</p>';
      for (const n of names) {
        const r = ctx.h(`<div class="row" style="justify-content:space-between"><span class="mono small">${ctx.esc(n)}</span><span class="row"><button class="btn sm ghost ld">Load</button><button class="btn sm ghost dl">Delete</button></span></div>`);
        r.querySelector('.ld').onclick = () => { b.load(all[n]); note.textContent = `Loaded "${n}".`; };
        r.querySelector('.dl').onclick = () => { const a = ctx.store.get('sandbox:saves', {}); delete a[n]; ctx.store.set('sandbox:saves', a); render(); };
        list.append(r);
      }
    }
    const doSave = () => {
      const n = inp.value.trim() || `Circuit ${new Date().toLocaleString()}`;
      const a = ctx.store.get('sandbox:saves', {}); a[n] = b.serialize(); ctx.store.set('sandbox:saves', a); inp.value = ''; saved = true; render();
      b.showToast('Saved');
    };
    saves.querySelector('.sv').onclick = doSave;
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSave(); });
    render();
    const clr = ctx.h('<div class="row"><button class="btn sm ghost">Clear the board</button></div>');
    clr.querySelector('button').onclick = () => { b.load({ cols: 14, rows: 9, parts: [] }); note.textContent = 'Empty board. Drag a battery in to start.'; };
    ctx.panel.append(saves, clr);

    ctx.panel.append(tasks(ctx, [
      { text: 'Load the <b>Light sensor divider</b>. Tap the LDR and slide the light level: watch Vout change.', check: () => loadedPreset === 'divider' && b.selected?.type === 'ldr' },
      { text: 'Load the <b>Wheatstone bridge</b> and change R4 until the middle meter reads zero (hint: R1/R2 = R3/R4).', check: () => loadedPreset === 'bridge' && b.part('R4') && Math.abs(b.part('R4').R - 300) < 8 },
      { text: 'Build something of your own with at least one battery, one bulb and a switch, and save it.', check: () => saved },
    ]));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div>
      <p><b>Voltage dividers.</b> Two resistors in series split a voltage in proportion: V<sub>out</sub> = V × R<sub>2</sub> / (R<sub>1</sub> + R<sub>2</sub>). Make R<sub>2</sub> a sensor whose resistance changes with light or temperature and V<sub>out</sub> becomes a signal a microcontroller can read.</p>
      <p><b>The Wheatstone bridge</b> is two dividers side by side. When both give the same output the meter between them reads exactly zero, whatever the battery voltage, which makes it a very sensitive way to compare resistances. Strain gauges in digital scales still use it.</p>
      <p><b>What the simulator does not model:</b> wire resistance beyond a tiny value, bulb filaments heating up, battery charge running down, and ideal switches that never spark. Batteries connected straight across each other are limited only by their small internal resistance, so expect large currents.</p>
    </div></details>`));
    ctx.quiz([
      { q: 'A 9 V divider uses 10 kΩ on top and 10 kΩ on the bottom. What is V<sub>out</sub> across the bottom one?', choices: ['9 V', '4.5 V', '0 V'], answer: 1, why: 'Equal resistors split the voltage equally: 9 × 10 / 20 = 4.5 V.' },
      { q: 'In a light sensor divider, the LDR gets brighter and its resistance falls. The voltage across the LDR...', choices: ['rises', 'falls', 'stays the same'], answer: 1, why: 'It takes a smaller share of the total resistance, so a smaller share of the voltage.' },
      { q: 'A Wheatstone bridge reads zero when...', choices: ['all four resistors are equal, and only then', 'the ratios on each side match: R1/R2 = R3/R4', 'the battery is disconnected'], answer: 1, why: 'Matching ratios put both middle points at the same voltage, so no voltage appears across the meter.' },
    ]);
  },
};
