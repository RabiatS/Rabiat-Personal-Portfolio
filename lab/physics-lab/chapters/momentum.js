import { MONO, MONO_S, chart, text, tag, arrow, pointer, stepper, fmt, rgba, clamp, rrect } from './_util.js';

// Momentum: two carts on a frictionless air track, collision resolved with a coefficient of restitution.
const L = 2.0; // track length, m
const CW = 0.2; // cart length, m
const H = 1 / 480;
const PRESETS = {
  elastic: { m1: 1, m2: 1, v1: 0.6, v2: 0, e: 1, label: 'Equal, elastic' },
  sticky: { m1: 1, m2: 1, v1: 0.6, v2: 0, e: 0, label: 'Sticky' },
  heavy: { m1: 2, m2: 0.5, v1: 0.5, v2: 0, e: 1, label: 'Heavy hits light' },
  light: { m1: 0.5, m2: 2, v1: 0.6, v2: 0, e: 1, label: 'Light hits heavy' },
  head: { m1: 1, m2: 1, v1: 0.5, v2: -0.5, e: 0.6, label: 'Head on' },
};

export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas();
    const g = cv.ctx;
    const st = { ...PRESETS.elastic };
    let x1 = 0.45; let x2 = 1.15; let u1 = 0; let u2 = 0;
    let phase = 'ready'; let t = 0; let before = null; let after = null; let hits = 0;
    let hv = [];
    let dragCart = 0;
    const lay = {};

    cv.onResize((w, h) => {
      lay.pad = 24;
      lay.trackY = Math.max(110, h * 0.3);
      lay.sc = (w - lay.pad * 2) / L;
      const by = lay.trackY + 34; const bh = Math.max(90, (h - by) * 0.46);
      const half = (w - 12) / 2;
      lay.b1 = { x: 2, y: by, w: half, h: bh }; lay.b2 = { x: half + 10, y: by, w: half, h: bh };
      lay.ch = { x: 2, y: by + bh + 8, w: w - 4, h: h - by - bh - 10 };
    });
    const X = (m) => lay.pad + m * lay.sc;

    function reset() {
      phase = 'ready'; t = 0; before = null; after = null; hits = 0; hv = [];
      u1 = st.v1; u2 = st.v2;
      if (x2 - x1 < CW + 0.02) x2 = x1 + CW + 0.02;
      readout();
    }
    const totals = () => ({ p: st.m1 * u1 + st.m2 * u2, ke: 0.5 * st.m1 * u1 * u1 + 0.5 * st.m2 * u2 * u2 });
    function snapshot() { return { p1: st.m1 * u1, p2: st.m2 * u2, k1: 0.5 * st.m1 * u1 * u1, k2: 0.5 * st.m2 * u2 * u2, v1: u1, v2: u2 }; }

    const step = stepper(H, 400);
    function physics(h) {
      if (phase !== 'running') return;
      x1 += u1 * h; x2 += u2 * h;
      if (x2 - x1 <= CW && u1 > u2) {
        if (!before) before = snapshot();
        const M = st.m1 + st.m2; const P = st.m1 * u1 + st.m2 * u2; const e = st.e;
        const n1 = (P + st.m2 * e * (u2 - u1)) / M;
        const n2 = (P + st.m1 * e * (u1 - u2)) / M;
        u1 = n1; u2 = n2;
        const mid = (x1 + x2) / 2; x1 = mid - CW / 2 - 1e-6; x2 = mid + CW / 2 + 1e-6;
        hits++;
        if (hits === 1) after = snapshot();
        readout();
      }
      // end stops catch the carts
      if (x1 < CW / 2) { x1 = CW / 2; u1 = 0; }
      if (x2 > L - CW / 2) { x2 = L - CW / 2; u2 = 0; }
      t += h;
      if (Math.round(t / h) % 8 === 0) hv.push([t, u1, u2, (st.m1 * u1 + st.m2 * u2) / (st.m1 + st.m2)]);
      if (t > 8) phase = 'done';
    }

    pointer(cv.el, {
      down(p) {
        if (phase === 'running' || p.y > lay.trackY + 10 || p.y < lay.trackY - 80) return false;
        const m = (p.x - lay.pad) / lay.sc;
        dragCart = Math.abs(m - x1) < Math.abs(m - x2) ? 1 : 2;
        if (phase === 'done') reset();
      },
      move(p) {
        const m = (p.x - lay.pad) / lay.sc;
        if (dragCart === 1) x1 = clamp(m, CW / 2, x2 - CW - 0.01);
        if (dragCart === 2) x2 = clamp(m, x1 + CW + 0.01, L - CW / 2);
      },
      up() { dragCart = 0; },
    }, ctx.signal);

    function cart(x, m, v, col, name) {
      const cx = X(x); const ty = lay.trackY;
      const wpx = CW * lay.sc; const hpx = 18 + m * 10;
      g.fillStyle = rgba(col, 0.18); g.strokeStyle = col; g.lineWidth = 1.5;
      rrect(g, cx - wpx / 2, ty - hpx - 4, wpx, hpx, 5); g.fill(); g.stroke();
      tag(g, `${name} ${fmt(m, 2)} kg`, cx, ty - hpx - 16, col, 'center');
      if (Math.abs(v) > 0.005) arrow(g, cx, ty - hpx / 2 - 4, cx + v * lay.sc * 0.35, ty - hpx / 2 - 4, C.text, 2, 8);
      text(g, `${fmt(v, 2)} m/s`, cx, ty + 22, col, 'center', 'alphabetic', MONO_S);
    }

    function bars(box, title, rows, max, signed) {
      const { x, y, w, h } = box;
      g.fillStyle = 'rgba(20,20,20,.55)'; rrect(g, x, y, w, h, 8); g.fill();
      g.strokeStyle = '#2A2A2A'; g.lineWidth = 1; rrect(g, x + 0.5, y + 0.5, w - 1, h - 1, 8); g.stroke();
      text(g, title, x + 8, y + 15, C.text2 || C.text);
      const top = y + 24; const rowH = Math.min(26, (h - 30) / rows.length);
      const lab = 64; const bx0 = x + lab; const bw = w - lab - 56;
      const zero = signed ? bx0 + bw / 2 : bx0;
      if (signed) { g.strokeStyle = '#3A3A38'; g.beginPath(); g.moveTo(zero, top); g.lineTo(zero, top + rows.length * rowH); g.stroke(); }
      rows.forEach(([n, val, col, dim], i) => {
        const yy = top + i * rowH;
        text(g, n, x + 8, yy + rowH * 0.7, dim ? C.muted : col, 'left', 'alphabetic', MONO_S);
        if (val == null) return;
        const len = (val / max) * (signed ? bw / 2 : bw);
        g.fillStyle = rgba(col, dim ? 0.35 : 0.85);
        g.fillRect(Math.min(zero, zero + len), yy + 2, Math.abs(len), rowH - 5);
        text(g, fmt(val, 3), x + w - 8, yy + rowH * 0.7, dim ? C.muted : col, 'right', 'alphabetic', MONO_S);
      });
    }

    function draw() {
      const w = cv.w;
      g.clearRect(0, 0, w, cv.h);
      const ty = lay.trackY;
      // track
      g.fillStyle = '#1E1E1E'; g.fillRect(X(0), ty - 4, L * lay.sc, 8);
      g.fillStyle = 'rgba(94,234,212,.25)';
      for (let m = 0.05; m < L; m += 0.05) g.fillRect(X(m) - 0.5, ty - 1, 1, 2);
      g.fillStyle = '#3A3A38'; g.fillRect(X(0) - 4, ty - 26, 4, 30); g.fillRect(X(L), ty - 26, 4, 30);
      cart(x1, st.m1, u1, C.c1, 'A');
      cart(x2, st.m2, u2, C.c2, 'B');
      const tt = totals();
      tag(g, `total momentum ${fmt(tt.p, 3)} kg·m/s    total KE ${fmt(tt.ke, 3)} J`, 12, 16, C.text, 'left');
      tag(g, phase === 'ready' ? 'drag carts to place them, then launch' : phase === 'running' ? `t ${fmt(t, 2)} s` : 'done', 12, 34, C.muted, 'left');

      // before and after bars
      const b = before || snapshot(); const a = after;
      const pmax = Math.max(0.2, Math.abs(b.p1) + Math.abs(b.p2), Math.abs(b.p1 + b.p2), a ? Math.abs(a.p1) + Math.abs(a.p2) : 0) * 1.05;
      bars(lay.b1, 'momentum p = mv', [
        ['A before', b.p1, C.c1, true], ['B before', b.p2, C.c2, true], ['total', b.p1 + b.p2, C.text, true],
        ['A after', a ? a.p1 : null, C.c1], ['B after', a ? a.p2 : null, C.c2], ['total', a ? a.p1 + a.p2 : null, C.text],
      ], pmax, true);
      const kmax = Math.max(0.05, b.k1 + b.k2) * 1.05;
      bars(lay.b2, 'kinetic energy ½mv²', [
        ['A before', b.k1, C.c1, true], ['B before', b.k2, C.c2, true], ['total', b.k1 + b.k2, C.text, true],
        ['A after', a ? a.k1 : null, C.c1], ['B after', a ? a.k2 : null, C.c2], ['total', a ? a.k1 + a.k2 : null, C.text],
      ], kmax, false);
      // velocity chart
      if (lay.ch.h > 50) {
        const vm = Math.max(0.4, Math.abs(st.v1), Math.abs(st.v2), ...hv.map((q) => Math.max(Math.abs(q[1]), Math.abs(q[2])))) * 1.15;
        chart(g, lay.ch, [
          { data: hv.map((q) => [q[0], q[3]]), color: C.text, dash: [3, 4], width: 1.2 },
          { data: hv.map((q) => [q[0], q[1]]), color: C.c1, dot: true },
          { data: hv.map((q) => [q[0], q[2]]), color: C.c2, dot: true },
        ], { xmin: 0, xmax: Math.max(4, t), ymin: -vm, ymax: vm, title: 'velocity (m/s): A, B, centre of mass dashed', yd: 2 });
      }
    }
    ctx.loop((tt, dt) => { step(dt, physics); draw(); });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Momentum and collisions</h2>'),
      ctx.h('<p class="lede">When two carts crash, energy can go missing into heat and sound, but momentum never does.</p>'),
    );
    const pre = ctx.seg(Object.entries(PRESETS).map(([k, p]) => [k, p.label]), 'elastic', (k) => {
      Object.assign(st, PRESETS[k]); x1 = 0.45; x2 = 1.15;
      if (k === 'head') { x1 = 0.4; x2 = 1.6; }
      sM1.value = st.m1; sM2.value = st.m2; sV1.value = st.v1; sV2.value = st.v2; sE.value = st.e; reset();
    });
    const sM1 = ctx.slider({ label: 'Mass A', min: 0.25, max: 3, step: 0.25, value: st.m1, unit: ' kg', onInput: (q) => { st.m1 = q; reset(); } });
    const sM2 = ctx.slider({ label: 'Mass B', min: 0.25, max: 3, step: 0.25, value: st.m2, unit: ' kg', onInput: (q) => { st.m2 = q; reset(); } });
    const sV1 = ctx.slider({ label: 'Start velocity A', min: -1, max: 1, step: 0.05, value: st.v1, unit: ' m/s', onInput: (q) => { st.v1 = q; reset(); } });
    const sV2 = ctx.slider({ label: 'Start velocity B', min: -1, max: 1, step: 0.05, value: st.v2, unit: ' m/s', onInput: (q) => { st.v2 = q; reset(); } });
    const sE = ctx.slider({ label: 'Bounciness e (restitution)', min: 0, max: 1, step: 0.05, value: st.e, fmt: (q) => `${q.toFixed(2)}${q === 1 ? ' elastic' : q === 0 ? ' sticky' : ''}`, onInput: (q) => { st.e = q; reset(); } });
    const row = ctx.h('<div class="row"><button class="btn sm">Launch</button><button class="btn ghost sm">Reset</button></div>');
    row.children[0].onclick = () => { reset(); phase = 'running'; };
    row.children[1].onclick = () => reset();
    const out = ctx.h('<div class="stat"></div>');
    ctx.panel.append(pre, sM1, sM2, sV1, sV2, sE, row, out);
    function readout() {
      if (!before || !after) { out.innerHTML = '<div><b>--</b><span>KE lost</span></div><div><b>--</b><span>Δ momentum</span></div>'; return; }
      const kb = before.k1 + before.k2; const ka = after.k1 + after.k2;
      out.innerHTML = `<div><b>${kb > 0 ? fmt(100 * (kb - ka) / kb, 0) : 0}%</b><span>KE lost</span></div><div><b>${fmt((after.p1 + after.p2) - (before.p1 + before.p2), 4)}</b><span>Δ momentum</span></div>`;
    }
    reset();

    ctx.panel.append(
      ctx.h(`<div class="card tip"><p><b>Momentum</b> is mass times velocity. It has a direction, so a cart moving left counts as negative.</p><p>When two carts collide, each pushes on the other with an equal and opposite force for the same short time. Whatever momentum one gains, the other loses. So the <b>total momentum is the same before and after</b>, every time.</p><p>Kinetic energy is different. In a perfectly bouncy (elastic) collision it is kept. In a sticky one, a lot of it turns into heat, sound and bent metal.</p></div>`),
      ctx.h(`<div class="card try"><ul>
        <li><b>Equal, elastic</b>: A stops dead and B leaves with A's speed. This is a Newton's cradle.</li>
        <li><b>Sticky</b>: the carts lock together at half the speed. Momentum is kept, but half the kinetic energy is gone.</li>
        <li><b>Light hits heavy</b>: the light cart bounces back. Its momentum goes negative, so B ends up with more momentum than A started with.</li>
        <li>Slide bounciness between 0 and 1 and watch "KE lost" change while Δ momentum stays at zero.</li>
      </ul></div>`),
      ctx.h(`<div class="card deep">
        <div class="formula">m₁v₁ + m₂v₂ = m₁v₁' + m₂v₂'<span>momentum is conserved in every collision</span></div>
        <div class="formula">e = (v₂' − v₁') / (v₁ − v₂)<span>coefficient of restitution: separation speed over approach speed</span></div>
        <div class="formula">v₁' = (m₁v₁ + m₂v₂ + m₂ e (v₂ − v₁)) / (m₁ + m₂)<span>and the same with 1 and 2 swapped</span></div>
        <p class="small">The centre of mass velocity (dashed line on the graph) is total momentum divided by total mass, so it does not change at the collision at all. Only the end stops, which belong to the outside world, can change it.</p>
        <p class="small muted">Real air track gliders have e around 0.9 or more with spring bumpers and close to 0 with velcro or putty. The carts here move at constant speed between events, so the simulation steps positions at 480 Hz and applies the collision as an instant impulse when they touch.</p>
      </div>`),
    );

    ctx.quiz([
      { q: 'A 2 kg cart at 3 m/s sticks to a 1 kg cart at rest. How fast do they move together?', choices: ['1 m/s', '2 m/s', '3 m/s'], answer: 1, why: 'Momentum before is 2 × 3 = 6 kg·m/s. Afterwards 3 kg carries it, so v = 6 / 3 = 2 m/s.' },
      { q: 'In which kind of collision is kinetic energy conserved?', choices: ['Elastic', 'Perfectly inelastic (sticky)', 'All collisions'], answer: 0, why: 'Only elastic collisions keep kinetic energy. Momentum is conserved in all of them.' },
      { q: 'Why is momentum conserved when two carts collide?', choices: ['Because no energy is lost', 'Because the forces they exert on each other are equal and opposite', 'Because the carts have equal mass'], answer: 1, why: 'Newton\'s third law: equal and opposite forces for the same time give equal and opposite changes in momentum.' },
    ]);
  },
};
