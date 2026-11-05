import { MONO, MONO_S, chart, text, tag, arrow, pointer, stepper, fmt, rgba, clamp, rrect } from './_util.js';

// Newton's laws: a box on a floor with static and kinetic friction, stepped with semi-implicit Euler.
const SURF = {
  ice: { name: 'Ice', ms: 0.1, mk: 0.05 },
  wood: { name: 'Wood', ms: 0.5, mk: 0.3 },
  rubber: { name: 'Rubber', ms: 1.0, mk: 0.8 },
};
const G = 9.81;
const H = 1 / 240;

export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas();
    const g = cv.ctx;
    const st = { F: 0, m: 10, ms: 0.5, mk: 0.3 };
    let x = 0; let v = 0; let a = 0; let f = 0; let t = 0; let camX = 0;
    let moving = false;
    let dragging = false;
    const hv = []; const hf = [];
    const lay = {};
    const PX = 64; // pixels per metre in the scene

    cv.onResize((w, h) => {
      lay.sceneH = Math.round(h * 0.56);
      lay.floor = lay.sceneH - 26;
      const gy = lay.sceneH + 10; const gh = h - gy - 2;
      if (w > 560) { const cw = (w - 12) / 2; lay.c1 = { x: 2, y: gy, w: cw, h: gh }; lay.c2 = { x: cw + 10, y: gy, w: cw, h: gh }; }
      else { const ch = (gh - 8) / 2; lay.c1 = { x: 2, y: gy, w: w - 4, h: ch }; lay.c2 = { x: 2, y: gy + ch + 8, w: w - 4, h: ch }; }
    });

    const N = () => st.m * G;
    const step = stepper(H);
    function physics(h) {
      const n = N(); const Fs = st.ms * n; const Fk = st.mk * n;
      if (!moving) {
        if (Math.abs(st.F) <= Fs) { f = -st.F; a = 0; v = 0; }
        else { moving = true; f = -Math.sign(st.F) * Fk; a = (st.F + f) / st.m; }
      } else {
        f = -Math.sign(v || st.F) * Fk;
        a = (st.F + f) / st.m;
      }
      if (moving) {
        const vn = v + a * h;
        if (v !== 0 && Math.sign(vn) !== Math.sign(v)) {
          // kinetic friction cannot reverse the motion: the box stops and static friction takes over
          v = 0; moving = Math.abs(st.F) > Fs;
          if (!moving) { f = -st.F; a = 0; }
        } else v = vn;
        x += v * h;
      }
      t += h;
      if (Math.round(t / h) % 4 === 0) {
        hv.push([t, v]); hf.push([Math.abs(st.F), Math.abs(f)]);
        while (hv.length && hv[0][0] < t - 10) hv.shift();
        if (hf.length > 500) hf.shift();
      }
    }

    pointer(cv.el, {
      down(p) {
        if (p.y > lay.sceneH) return false;
        dragging = true; pull(p);
      },
      move(p) { if (dragging) pull(p); },
      up() { dragging = false; st.F = 0; sF.value = 0; },
    }, ctx.signal);
    function pull(p) {
      const bx = cv.w / 2 + (x - camX) * PX;
      st.F = clamp(Math.round((p.x - bx) * 1.2), -200, 200);
      sF.value = st.F;
    }

    function draw(dt) {
      const w = cv.w; const h = cv.h;
      g.clearRect(0, 0, w, h);
      camX += (x - camX) * (1 - Math.exp(-dt * 8));
      const fl = lay.floor;
      // floor
      const surfCol = st.ms <= 0.15 ? C.c5 : st.ms >= 0.8 ? C.c4 : C.c2;
      g.fillStyle = rgba(surfCol, 0.06); g.fillRect(0, fl, w, 26);
      g.strokeStyle = rgba(surfCol, 0.5); g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, fl); g.lineTo(w, fl); g.stroke();
      const m0 = Math.floor(camX - w / 2 / PX) - 1; const m1 = Math.ceil(camX + w / 2 / PX) + 1;
      for (let m = m0; m <= m1; m++) {
        const X = w / 2 + (m - camX) * PX;
        g.strokeStyle = '#2A2A2A'; g.lineWidth = 1; g.beginPath(); g.moveTo(X, fl); g.lineTo(X, fl + 7); g.stroke();
        if (m % 2 === 0) text(g, `${m} m`, X, fl + 19, '#5A5A55', 'center', 'alphabetic', MONO_S);
      }
      // box
      const side = clamp(40 + st.m * 1.6, 44, 110);
      const bx = w / 2 + (x - camX) * PX; const by = fl - side;
      g.fillStyle = '#1E1E1E'; g.strokeStyle = dragging ? C.text : '#5A5A55'; g.lineWidth = 1.5;
      rrect(g, bx - side / 2, by, side, side, 6); g.fill(); g.stroke();
      text(g, `${st.m} kg`, bx, by + side * 0.38, C.muted, 'center', 'alphabetic', MONO_S);
      // rope while dragging
      if (Math.abs(st.F) > 0) {
        const dir = Math.sign(st.F);
        g.strokeStyle = rgba(C.c2, 0.4); g.setLineDash([3, 3]); g.beginPath(); g.moveTo(bx + dir * side / 2, by + side / 2); g.lineTo(bx + dir * (side / 2 + 20 + Math.abs(st.F) * 0.35), by + side / 2); g.stroke(); g.setLineDash([]);
      }
      // forces drawn on the box itself
      const fsc = Math.min(0.9, (w * 0.3) / Math.max(200, st.ms * N() * 1.2));
      const cy = by + side / 2;
      if (Math.abs(st.F) > 0.5) { arrow(g, bx, cy, bx + st.F * fsc, cy, C.c2, 2.4, 9); tag(g, `F ${fmt(Math.abs(st.F), 0)} N`, bx + st.F * fsc, cy - 12, C.c2, st.F > 0 ? 'right' : 'left'); }
      if (Math.abs(f) > 0.5) { arrow(g, bx, fl - 3, bx + f * fsc, fl - 3, C.c4, 2.4, 9); tag(g, `f ${fmt(Math.abs(f), 0)} N`, bx + f * fsc, fl + 12, C.c4, f > 0 ? 'right' : 'left'); }
      const net = st.F + f;
      if (Math.abs(net) > 0.5) { arrow(g, bx, by - 14, bx + net * fsc, by - 14, C.text, 2, 8); tag(g, `net ${fmt(Math.abs(net), 0)} N`, bx + net * fsc / 2, by - 28, C.text, 'center'); }
      // free body diagram inset: every force on the box, from one dot, on one shared scale
      const R = Math.max(40, Math.min(lay.sceneH * 0.3, 110));
      const fx = w - R - 24; const fy = 52 + R;
      const big = Math.max(N(), Math.abs(st.F), Math.abs(f), 1);
      const k = R / big;
      g.fillStyle = 'rgba(20,20,20,.6)'; rrect(g, fx - R - 16, fy - R - 26, 2 * R + 32, 2 * R + 40, 8); g.fill();
      text(g, 'free body diagram', fx - R - 8, fy - R - 12, C.muted, 'left', 'alphabetic', MONO_S);
      arrow(g, fx, fy, fx, fy + N() * k, C.c5, 2, 8); tag(g, 'W', fx + 6, fy + N() * k - 6, C.c5, 'left');
      arrow(g, fx, fy, fx, fy - N() * k, C.c1, 2, 8); tag(g, 'N', fx + 6, fy - N() * k + 6, C.c1, 'left');
      if (Math.abs(st.F) > 0.5) { arrow(g, fx, fy, fx + st.F * k, fy, C.c2, 2, 8); tag(g, 'F', fx + st.F * k, fy - 10, C.c2, 'center'); }
      if (Math.abs(f) > 0.5) { arrow(g, fx, fy + 3, fx + f * k, fy + 3, C.c4, 2, 8); tag(g, 'f', fx + f * k, fy + 14, C.c4, 'center'); }
      g.fillStyle = C.text; g.beginPath(); g.arc(fx, fy, 3.5, 0, 7); g.fill();
      // header
      tag(g, moving ? 'sliding: kinetic friction' : Math.abs(st.F) > 0.5 ? 'stuck: static friction matches your push' : 'at rest', 12, 14, moving ? C.c4 : C.muted, 'left');
      tag(g, `v ${fmt(v, 2)} m/s   a ${fmt(a, 2)} m/s²`, 12, 30, C.text, 'left');
      if (w > 560 && !dragging && Math.abs(st.F) < 0.5 && Math.abs(v) < 0.01) tag(g, 'drag sideways from the box to pull it', 12, 48, C.muted, 'left');

      // charts
      const Fs = st.ms * N(); const Fk = st.mk * N();
      const Fmax = Math.max(200, Fs * 1.3);
      const fmax = Math.max(Fs, 10) * 1.25;
      const theory = [[0, 0], [Fs, Fs], [Fs, Fk], [Fmax, Fk]];
      g.save();
      chart(g, lay.c1, [{ data: theory, color: 'rgba(245,245,240,.35)', dash: [4, 4], width: 1.2 }], { xmin: 0, xmax: Fmax, ymin: 0, ymax: fmax, title: 'friction vs push (N)', titleColor: C.c4, xlab: `push 0 to ${fmt(Fmax, 0)} N`, yd: 0 });
      // history dots
      const { x: X0, y: Y0, w: W0, h: H0 } = lay.c1;
      for (let i = 0; i < hf.length; i++) {
        const [p, q] = hf[i];
        g.fillStyle = rgba(C.c4, 0.15 + 0.85 * (i / hf.length));
        g.fillRect(X0 + (p / Fmax) * W0 - 1.5, Y0 + H0 - (q / fmax) * H0 - 1.5, 3, 3);
      }
      g.restore();
      tag(g, 'static peak', X0 + (Fs / Fmax) * W0 + 4, Y0 + H0 - (Fs / fmax) * H0 + 2, C.muted, 'left', 'middle', MONO_S);
      const vm = Math.max(2, ...hv.map((q) => Math.abs(q[1]))) * 1.15;
      chart(g, lay.c2, [{ data: hv, color: C.c2, dot: true }], { xmin: Math.max(0, t - 10), xmax: Math.max(10, t), ymin: -vm, ymax: vm, title: 'velocity (m/s), last 10 s', titleColor: C.c2, yd: 1 });
    }
    ctx.loop((tt, dt) => { step(dt, physics); draw(dt); readout(); });

    // panel
    ctx.panel.append(
      ctx.h(`<h2 class="k-h">Newton's laws</h2>`),
      ctx.h('<p class="lede">Push a heavy box. At first it will not budge, then suddenly it slides. Forces explain both.</p>'),
    );
    const sF = ctx.slider({ label: 'Your push F', min: -200, max: 200, step: 1, value: 0, unit: ' N', onInput: (q) => { st.F = q; } });
    const sM = ctx.slider({ label: 'Mass m', min: 1, max: 40, step: 1, value: st.m, unit: ' kg', onInput: (q) => { st.m = q; } });
    const sMs = ctx.slider({ label: 'Static friction μs', min: 0, max: 1.2, step: 0.01, value: st.ms, fmt: (q) => q.toFixed(2), onInput: (q) => { st.ms = q; if (st.mk > q) { st.mk = q; sMk.value = q; } } });
    const sMk = ctx.slider({ label: 'Kinetic friction μk', min: 0, max: 1.2, step: 0.01, value: st.mk, fmt: (q) => q.toFixed(2), onInput: (q) => { st.mk = Math.min(q, st.ms); sMk.value = st.mk; } });
    const surf = ctx.seg(Object.entries(SURF).map(([k, s]) => [k, s.name]), 'wood', (k) => { st.ms = SURF[k].ms; st.mk = SURF[k].mk; sMs.value = st.ms; sMk.value = st.mk; });
    const row = ctx.h('<div class="row"><button class="btn ghost sm">Let go (F = 0)</button><button class="btn ghost sm">Reset</button></div>');
    row.children[0].onclick = () => { st.F = 0; sF.value = 0; };
    row.children[1].onclick = () => { st.F = 0; sF.value = 0; x = 0; v = 0; a = 0; moving = false; hv.length = 0; hf.length = 0; camX = 0; };
    const out = ctx.h('<div class="stat"></div>');
    ctx.panel.append(sF, sM, surf, sMs, sMk, row, out);
    let lastR = 0;
    function readout() {
      const now = performance.now(); if (now - lastR < 120) return; lastR = now;
      const net = st.F + f;
      out.innerHTML = [
        ['max static', `${fmt(st.ms * N(), 0)} N`], ['friction', `${fmt(Math.abs(f), 0)} N`], ['net force', `${fmt(net, 0)} N`],
        ['net / m', `${fmt(net / st.m, 2)}`], ['a (m/s²)', `${fmt(a, 2)}`], ['v (m/s)', `${fmt(v, 2)}`],
      ].map(([k, q]) => `<div><b>${q}</b><span>${k}</span></div>`).join('');
    }

    ctx.panel.append(
      ctx.h(`<div class="card tip"><p><b>First law:</b> if the forces on something balance, it keeps doing what it was doing: sitting still, or sliding at a steady speed.</p><p><b>Second law:</b> if they do not balance, it accelerates. The net force divided by the mass is the acceleration, F = m a.</p><p><b>Third law:</b> the floor pushes up on the box exactly as hard as the box presses down on it (the normal force), and friction on the box comes with an equal and opposite pull on the floor.</p><p>Friction is clever. Below a limit, static friction pushes back exactly as hard as you push, so nothing moves. Past the limit, the box breaks free and the friction drops to a smaller kinetic value.</p></div>`),
      ctx.h(`<div class="card try"><ul>
        <li>Slowly raise your push on wood. The friction arrow grows to match it and the box stays put, until the static peak.</li>
        <li>Once it slides, lower the push a little. It keeps accelerating as long as F is bigger than kinetic friction. Set F equal to kinetic friction and it glides at a steady speed: no net force, no acceleration.</li>
        <li>Switch to ice and give a short shove, then let go. It coasts a long way. On rubber it stops almost at once.</li>
        <li>Double the mass. You need twice the push to start it, because friction scales with the normal force.</li>
      </ul></div>`),
      ctx.h(`<div class="card deep">
        <div class="formula">F_net = m a<span>Newton's second law</span></div>
        <div class="formula">f_static ≤ μs N &nbsp; f_kinetic = μk N &nbsp; N = m g<span>friction model (Coulomb), on a level floor</span></div>
        <p class="small">The friction vs push chart shows the classic shape: a 45° line while static friction matches you, a peak at μs N, then a drop to the flat μk N level once the box slides.</p>
        <p class="small muted">Friction coefficients depend on the exact materials, how clean and dry they are, and even on speed, so treat the presets as rough. The simulation uses semi-implicit Euler at 240 steps per second and stops the box when kinetic friction would otherwise reverse it, which is what real friction does.</p>
      </div>`),
    );

    ctx.quiz([
      { q: 'You push a box with 50 N and it does not move. How big is the friction force?', choices: ['0 N', '50 N', 'More than 50 N'], answer: 1, why: 'The box is not accelerating, so the forces balance: static friction exactly matches your 50 N.' },
      { q: 'A 10 kg box has a net force of 30 N on it. Its acceleration is:', choices: ['3 m/s²', '30 m/s²', '300 m/s²'], answer: 0, why: 'a = F_net / m = 30 / 10 = 3 m/s².' },
      { q: 'A box slides at a steady speed while you push it. What does that tell you?', choices: ['Your push is bigger than friction', 'Your push equals friction', 'There is no friction'], answer: 1, why: 'Constant velocity means zero acceleration, so the net force is zero: push and kinetic friction balance.' },
    ]);
  },
};
