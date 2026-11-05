import { MONO, MONO_S, chart, text, tag, fmt, rgba, clamp, rrect } from './_util.js';

// Gas laws: hard disks (argon atoms) in a 2D box. Elastic collisions with each other and the walls,
// pressure measured from the momentum delivered to the walls. Units inside: nm, ps, so 1 nm/ps = 1000 m/s.
const KB = 1.380649e-23;
const MASS = 39.948 * 1.66054e-27; // argon, kg
const RAD = 0.45; // nm, collision radius
const DT = 0.05; // ps
const BOXH = 40; // nm
const SIM_RATE = 40; // ps of simulated time per real second
const VMAX = 2.5; // nm/ps, histogram range
const BINS = 25;

export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas();
    const g = cv.ctx;
    const st = { T: 300, N: 150, W: 40, thermo: true };
    let wall = 40; // current piston position, nm (moves toward st.W)
    let wallV = 0;
    let px = []; let py = []; let vx = []; let vy = [];
    let impulse = 0; let pTime = 0; let pMeas = 0; const hist = new Float64Array(BINS); let simT = 0;
    let pHist = [];
    const lay = {};

    const vToMS = 1000;
    const tempOf = () => { let s = 0; for (let i = 0; i < px.length; i++) s += vx[i] * vx[i] + vy[i] * vy[i]; return px.length ? (MASS * (s / px.length) * vToMS * vToMS) / (2 * KB) : 0; };
    const sigma = (T) => Math.sqrt(KB * T / MASS) / vToMS; // nm/ps

    function place(n, sameSpeed) {
      px = []; py = []; vx = []; vy = [];
      const s = sigma(st.T);
      let tries = 0;
      while (px.length < n && tries < 20000) {
        tries++;
        const x = RAD + Math.random() * (wall - 2 * RAD); const y = RAD + Math.random() * (BOXH - 2 * RAD);
        let ok = true;
        for (let j = 0; j < px.length; j++) if ((px[j] - x) ** 2 + (py[j] - y) ** 2 < (2.2 * RAD) ** 2) { ok = false; break; }
        if (!ok) continue;
        const a = Math.random() * 2 * Math.PI;
        // same speed for everyone (√2 σ gives the right temperature), or a proper 2D Maxwell-Boltzmann draw
        const sp = sameSpeed ? Math.SQRT2 * s : s * Math.sqrt(-2 * Math.log(1 - Math.random()));
        px.push(x); py.push(y); vx.push(sp * Math.cos(a)); vy.push(sp * Math.sin(a));
      }
      hist.fill(0); impulse = 0; pTime = 0; pHist = []; simT = 0;
    }
    function setN(n) {
      if (n < px.length) { px.length = n; py.length = n; vx.length = n; vy.length = n; }
      else {
        const s = sigma(tempOf() || st.T);
        let tries = 0;
        while (px.length < n && tries < 5000) {
          tries++;
          const x = RAD + Math.random() * (wall - 2 * RAD); const y = RAD + Math.random() * (BOXH - 2 * RAD);
          let ok = true;
          for (let j = 0; j < px.length; j++) if ((px[j] - x) ** 2 + (py[j] - y) ** 2 < (2.2 * RAD) ** 2) { ok = false; break; }
          if (!ok) continue;
          const a = Math.random() * 2 * Math.PI; const sp = s * Math.sqrt(-2 * Math.log(1 - Math.random()));
          px.push(x); py.push(y); vx.push(sp * Math.cos(a)); vy.push(sp * Math.sin(a));
        }
      }
    }

    // spatial hash for disk collisions
    const CELL = 2 * RAD * 1.05;
    function collide() {
      const n = px.length; const nx = Math.ceil(wall / CELL) + 1; const ny = Math.ceil(BOXH / CELL) + 1;
      const head = new Int32Array(nx * ny).fill(-1); const next = new Int32Array(n);
      for (let i = 0; i < n; i++) { const c = clamp(Math.floor(py[i] / CELL), 0, ny - 1) * nx + clamp(Math.floor(px[i] / CELL), 0, nx - 1); next[i] = head[c]; head[c] = i; }
      const d2 = (2 * RAD) ** 2;
      for (let i = 0; i < n; i++) {
        const cx = clamp(Math.floor(px[i] / CELL), 0, nx - 1); const cy = clamp(Math.floor(py[i] / CELL), 0, ny - 1);
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const X = cx + ox; const Y = cy + oy; if (X < 0 || Y < 0 || X >= nx || Y >= ny) continue;
          for (let j = head[Y * nx + X]; j !== -1; j = next[j]) {
            if (j <= i) continue;
            const dx = px[j] - px[i]; const dy = py[j] - py[i]; const r2 = dx * dx + dy * dy;
            if (r2 >= d2 || r2 === 0) continue;
            const r = Math.sqrt(r2); const ux = dx / r; const uy = dy / r;
            const rel = (vx[j] - vx[i]) * ux + (vy[j] - vy[i]) * uy;
            if (rel < 0) { vx[i] += rel * ux; vy[i] += rel * uy; vx[j] -= rel * ux; vy[j] -= rel * uy; }
            const push = (2 * RAD - r) / 2; px[i] -= ux * push; py[i] -= uy * push; px[j] += ux * push; py[j] += uy * push;
          }
        }
      }
    }

    function step() {
      // piston moves slowly toward the slider position
      const target = st.W; const speed = 0.02; // nm/ps
      wallV = Math.abs(target - wall) < speed * DT ? 0 : Math.sign(target - wall) * speed;
      wall += wallV * DT;
      const n = px.length;
      for (let i = 0; i < n; i++) {
        px[i] += vx[i] * DT; py[i] += vy[i] * DT;
        if (px[i] < RAD) { px[i] = 2 * RAD - px[i]; impulse += 2 * Math.abs(vx[i]); vx[i] = Math.abs(vx[i]); }
        if (px[i] > wall - RAD) {
          // bounce off the moving piston: reverse velocity relative to the wall
          const rel = vx[i] - wallV;
          if (rel > 0) { impulse += 2 * rel; vx[i] = 2 * wallV - vx[i]; }
          px[i] = Math.min(px[i], wall - RAD);
        }
        if (py[i] < RAD) { py[i] = 2 * RAD - py[i]; impulse += 2 * Math.abs(vy[i]); vy[i] = Math.abs(vy[i]); }
        if (py[i] > BOXH - RAD) { py[i] = 2 * (BOXH - RAD) - py[i]; impulse += 2 * Math.abs(vy[i]); vy[i] = -Math.abs(vy[i]); }
      }
      collide();
      if (st.thermo && n) {
        // Berendsen thermostat: nudge the temperature toward the heat bath with a 20 ps time constant
        const T = tempOf(); if (T > 0) { const lam = Math.sqrt(1 + (DT / 20) * (st.T / T - 1)); for (let i = 0; i < n; i++) { vx[i] *= lam; vy[i] *= lam; } }
      }
      pTime += DT; simT += DT;
      if (pTime >= 25) {
        // pressure = momentum per time per length of wall (2D), in N/m
        const per = 2 * (wall + BOXH) * 1e-9; // m
        const P = (impulse * MASS * vToMS) / ((pTime * 1e-12) * per);
        pMeas = pMeas ? pMeas * 0.6 + P * 0.4 : P;
        impulse = 0; pTime = 0;
        pHist.push([simT, P, idealP()]); while (pHist.length && pHist[0][0] < simT - 1500) pHist.shift();
      }
    }
    const idealP = () => (px.length * KB * tempOf()) / (wall * BOXH * 1e-18);

    cv.onResize((w, h) => {
      const wide = w > 640 && w > h;
      if (wide) {
        lay.box = { x: 10, y: 34, w: w * 0.56 - 20, h: h - 44 };
        const cw = w * 0.44 - 8; const ch = (h - 10) / 2;
        lay.c1 = { x: w * 0.56 + 4, y: 0, w: cw, h: ch }; lay.c2 = { x: w * 0.56 + 4, y: ch + 10, w: cw, h: ch };
      } else {
        lay.box = { x: 6, y: 30, w: w - 12, h: h * 0.56 - 36 };
        const cw = (w - 10) / 2; const y0 = h * 0.56 + 4;
        lay.c1 = { x: 2, y: y0, w: cw, h: h - y0 - 2 }; lay.c2 = { x: cw + 8, y: y0, w: cw, h: h - y0 - 2 };
      }
      lay.s = Math.min(lay.box.w / 60, lay.box.h / BOXH);
    });

    function draw() {
      const w = cv.w; const h = cv.h;
      g.clearRect(0, 0, w, h);
      const s = lay.s; const bx = lay.box.x; const by = lay.box.y + (lay.box.h - BOXH * s) / 2;
      // box
      g.fillStyle = 'rgba(20,20,20,.6)'; g.fillRect(bx, by, wall * s, BOXH * s);
      g.strokeStyle = '#5A5A55'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx + wall * s, by); g.lineTo(bx, by); g.lineTo(bx, by + BOXH * s); g.lineTo(bx + wall * s, by + BOXH * s); g.stroke();
      // piston
      g.fillStyle = '#3A3A38'; g.fillRect(bx + wall * s, by - 4, 6, BOXH * s + 8);
      g.fillStyle = '#2A2A2A'; g.fillRect(bx + wall * s + 6, by + BOXH * s / 2 - 3, Math.max(0, lay.box.w - wall * s - 6), 6);
      // heat bath glow
      if (st.thermo) { g.strokeStyle = rgba(st.T > 400 ? C.c4 : st.T < 200 ? C.c5 : C.c2, 0.35); g.lineWidth = 4; g.beginPath(); g.moveTo(bx - 4, by + BOXH * s + 4); g.lineTo(bx + wall * s, by + BOXH * s + 4); g.stroke(); }
      // particles coloured by speed
      const sg = sigma(st.T);
      const rr = Math.max(1.6, RAD * s);
      for (let i = 0; i < px.length; i++) {
        const sp = Math.hypot(vx[i], vy[i]) / (2.2 * sg);
        const c = sp < 0.5 ? C.c5 : sp < 0.9 ? C.c1 : sp < 1.3 ? C.c2 : C.c4;
        g.fillStyle = c; g.beginPath(); g.arc(bx + px[i] * s, by + (BOXH - py[i]) * s, rr, 0, 7); g.fill();
      }
      tag(g, `${px.length} argon atoms   box ${fmt(wall, 1)} × ${BOXH} nm`, bx, 14, C.muted, 'left');
      tag(g, 'slow', bx, by + BOXH * s + 18, C.c5, 'left', 'middle', MONO_S); tag(g, 'fast', bx + 34, by + BOXH * s + 18, C.c4, 'left', 'middle', MONO_S);

      // speed histogram vs 2D Maxwell-Boltzmann
      const n = px.length;
      for (let b = 0; b < BINS; b++) hist[b] *= 0.97;
      for (let i = 0; i < n; i++) { const b = Math.floor(Math.hypot(vx[i], vy[i]) / VMAX * BINS); if (b < BINS) hist[b] += 0.03; }
      const T = tempOf();
      const bw = VMAX / BINS;
      const mb = []; let ymax = 0.1;
      for (let k = 0; k <= 100; k++) {
        const v = (k / 100) * VMAX; const vs = v * vToMS; const a = MASS / (KB * T);
        const f = a * vs * Math.exp(-a * vs * vs / 2) * vToMS; // per (nm/ps)
        const y = n * f * bw; mb.push([v * 1000, y]); ymax = Math.max(ymax, y);
      }
      for (let b = 0; b < BINS; b++) ymax = Math.max(ymax, hist[b]);
      const box = lay.c1;
      chart(g, box, [{ data: mb, color: C.c3, width: 2 }], { xmin: 0, xmax: VMAX * 1000, ymin: 0, ymax: ymax * 1.15, title: 'speeds: atoms (bars) vs Maxwell-Boltzmann', titleColor: C.c3, ylab: false, xlab: `speed 0 to ${VMAX * 1000} m/s` });
      g.save(); g.beginPath(); g.rect(box.x, box.y, box.w, box.h); g.clip();
      for (let b = 0; b < BINS; b++) {
        const x0 = box.x + (b / BINS) * box.w; const hh = (hist[b] / (ymax * 1.15)) * box.h;
        g.fillStyle = rgba(C.c1, 0.45); g.fillRect(x0 + 1, box.y + box.h - hh, box.w / BINS - 2, hh);
      }
      g.restore();
      chart(g, box, [{ data: mb, color: C.c3, width: 2 }], { xmin: 0, xmax: VMAX * 1000, ymin: 0, ymax: ymax * 1.15, ylab: false });
      // pressure
      const pm = Math.max(1e-6, ...pHist.map((q) => Math.max(q[1], q[2]))) * 1.2;
      chart(g, lay.c2, [
        { data: pHist.map((q) => [q[0], q[2] * 1000]), color: C.text, dash: [4, 4], width: 1.2 },
        { data: pHist.map((q) => [q[0], q[1] * 1000]), color: C.c2, dot: true },
      ], { xmin: Math.max(0, simT - 1500), xmax: Math.max(1500, simT), ymin: 0, ymax: pm * 1000, title: 'pressure (mN/m): measured vs NkT/A dashed', titleColor: C.c2, yd: 2 });
    }

    let acc = 0; let lastR = 0;
    ctx.loop((t, dt) => {
      acc += dt * SIM_RATE;
      let k = 0;
      while (acc >= DT && k < 60) { step(); acc -= DT; k++; }
      if (k >= 60) acc = 0;
      draw();
      if (t - lastR > 0.25) { lastR = t; readout(); }
    });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Gas laws and particles</h2>'),
      ctx.h('<p class="lede">A gas is a crowd of atoms flying around and bouncing. Pressure is just their drumming on the walls, and temperature is how fast they move.</p>'),
    );
    const sT = ctx.slider({ label: 'Heat bath temperature T', min: 50, max: 1000, step: 10, value: st.T, unit: ' K', onInput: (q) => { st.T = q; } });
    const sN = ctx.slider({ label: 'Number of atoms N', min: 20, max: 300, step: 10, value: st.N, onInput: (q) => { st.N = q; setN(q); } });
    const sW = ctx.slider({ label: 'Box width (move the piston)', min: 18, max: 60, step: 1, value: st.W, unit: ' nm', onInput: (q) => { st.W = q; } });
    const opt = ctx.h('<label class="check"><input type="checkbox" checked> walls in contact with the heat bath</label>');
    opt.querySelector('input').onchange = (e) => { st.thermo = e.target.checked; };
    const row = ctx.h('<div class="row"><button class="btn sm">Restart, all the same speed</button><button class="btn ghost sm">Restart, random speeds</button></div>');
    row.children[0].onclick = () => { place(st.N, true); };
    row.children[1].onclick = () => { place(st.N, false); };
    const out = ctx.h('<div class="stat"></div>');
    ctx.panel.append(sT, sN, sW, opt, row, out);
    function readout() {
      const T = tempOf(); const Pi = idealP();
      out.innerHTML = [
        ['measured T', `${fmt(T, 0)} K`], ['measured P', `${fmt(pMeas * 1000, 3)}`], ['NkT/A', `${fmt(Pi * 1000, 3)}`],
        ['PA / NkT', pMeas ? fmt(pMeas / Pi, 2) : '--'], ['rms speed', `${fmt(Math.sqrt(2 * KB * T / MASS), 0)} m/s`],
      ].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
    }
    place(st.N, true);

    ctx.panel.append(
      ctx.h(`<div class="card tip"><p>Every dot is an atom moving in a straight line until it hits another atom or a wall. Each wall hit gives the wall a tiny push. Billions of tiny pushes per second add up to a steady <b>pressure</b>.</p><p>Heat the gas and the atoms move faster: they hit the walls more often and harder, so pressure rises. Squeeze the box and they hit the walls more often too. Add atoms and there are more hits. That is the whole ideal gas law, built from collisions.</p><p>Not every atom has the same speed. Collisions shuffle energy around until speeds settle into a typical spread, the <b>Maxwell-Boltzmann distribution</b>.</p></div>`),
      ctx.h(`<div class="card try"><ul>
        <li>Press <b>Restart, all the same speed</b> and watch the histogram: one spike at first, then within a fraction of a nanosecond it spreads into the violet curve. Nobody forced it to, collisions did.</li>
        <li>Double the temperature. Pressure doubles (watch PA/NkT stay near 1). The histogram spreads to higher speeds.</li>
        <li>Halve the box width. Pressure doubles: Boyle's law.</li>
        <li>Turn off the heat bath, then push the piston in. The atoms bounce off a wall moving toward them and speed up, so the gas warms. That is why a bike pump gets hot.</li>
      </ul></div>`),
      ctx.h(`<div class="card deep">
        <div class="formula">P V = N k T<span>ideal gas law (k = 1.38 × 10⁻²³ J/K)</span></div>
        <div class="formula">P A = N k T &nbsp; ½ m ⟨v²⟩ = k T<span>the 2D version simulated here: area for volume, force per length for pressure</span></div>
        <div class="formula">f(v) = (m v / kT) e^(−m v² / 2kT)<span>2D Maxwell-Boltzmann speed distribution</span></div>
        <p class="small">In 3D, ⟨½ m v²⟩ = (3/2) k T and the speed distribution has a v² in front instead of v, but the reasoning is identical. Pressure here is measured, not computed: the simulation adds up 2 m v for every wall bounce and divides by the time and the wall length.</p>
        <p class="small muted">The atoms are argon (40 u), drawn as hard disks of radius 0.45 nm in a 40 nm tall box, stepped every 0.05 ps. Because the disks take up some room, measured pressure sits a few percent above NkT/A, more so when crowded. That is the start of the van der Waals correction for real gases. The heat bath is a Berendsen thermostat, which gently rescales speeds toward the bath temperature.</p>
      </div>`),
    );

    ctx.quiz([
      { q: 'At constant temperature, you halve the volume of a gas. What happens to its pressure?', choices: ['It halves', 'It doubles', 'It stays the same'], answer: 1, why: 'PV = NkT stays constant, so halving V doubles P (Boyle\'s law). The atoms hit the walls twice as often.' },
      { q: 'What does the temperature of a gas measure, at the particle level?', choices: ['The number of particles', 'The average kinetic energy of the particles', 'The size of the particles'], answer: 1, why: 'Temperature is proportional to the average kinetic energy per particle.' },
      { q: 'In a gas at one temperature, do all the particles have the same speed?', choices: ['Yes, temperature fixes the speed', 'No, speeds spread out in a Maxwell-Boltzmann distribution', 'Only the heavy ones do'], answer: 1, why: 'Collisions constantly trade energy, so speeds spread out, with a most likely speed and a long tail of fast particles.' },
    ]);
  },
};
