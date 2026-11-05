import { MONO, MONO_S, chart, text, tag, pointer, rk4, stepper, fmt, rgba, clamp, rrect } from './_util.js';

// Pendulums and springs: RK4 at 600 steps per simulated second.
const G = 9.81;
const H = 1 / 600;

export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas();
    const g = cv.ctx;
    let mode = 'pend';
    const st = { L: 1, m: 1, b: 0, k: 20 };
    let s = [0.5, 0]; // pendulum [θ, ω] or spring [x, v]
    let d1 = [2.2, 0, 2.6, 0]; let d2 = [2.2, 0, 2.601, 0];
    let t = 0; let hist = []; let trail = []; let trail2 = [];
    let drag = 0; let lastUp = null; let periods = []; let lastCross = null; let amp0 = 0.5;
    const lay = {};

    cv.onResize((w, h) => {
      const wide = w > h * 1.1 && w > 640;
      if (wide) {
        lay.view = { x: 0, y: 0, w: w * 0.5, h };
        const cw = w * 0.5 - 8; const ch = (h - 10) / 2;
        lay.c1 = { x: w * 0.5 + 6, y: 0, w: cw, h: ch };
        lay.c2 = { x: w * 0.5 + 6, y: ch + 10, w: cw, h: ch };
      } else {
        const vh = h * 0.56;
        lay.view = { x: 0, y: 0, w, h: vh };
        const cw = (w - 10) / 2;
        lay.c1 = { x: 2, y: vh + 6, w: cw, h: h - vh - 8 };
        lay.c2 = { x: cw + 8, y: vh + 6, w: cw, h: h - vh - 8 };
      }
    });

    function pivot() {
      if (mode === 'double') return { x: lay.view.x + lay.view.w / 2, y: lay.view.y + lay.view.h / 2 + 10 };
      return { x: lay.view.x + lay.view.w / 2, y: lay.view.y + 46 };
    }
    // fixed pixels per metre, so a longer pendulum really looks longer (2.5 m fills the view)
    function pscale() {
      if (mode === 'double') return (Math.min(lay.view.w, lay.view.h - 30) / 2 - 16) / 2.5;
      if (mode === 'spring') return (lay.view.h - 90) / 1.6;
      return Math.min(lay.view.h - 90, lay.view.w * 0.9) / 2.5;
    }

    const fPend = (q) => [q[1], -(G / st.L) * Math.sin(q[0]) - (st.b / st.m) * q[1]];
    const fSpring = (q) => [q[1], -(st.k / st.m) * q[0] - (st.b / st.m) * q[1]];
    // double pendulum, equal masses and lengths (L/2 each), standard equations of motion
    const fDouble = (q) => {
      const [a1, w1, a2, w2] = q; const m1 = 1; const m2 = 1; const l1 = st.L / 2; const l2 = st.L / 2;
      const dd = a1 - a2; const den = 2 * m1 + m2 - m2 * Math.cos(2 * dd);
      const A1 = (-G * (2 * m1 + m2) * Math.sin(a1) - m2 * G * Math.sin(a1 - 2 * a2) - 2 * Math.sin(dd) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(dd))) / (l1 * den);
      const A2 = (2 * Math.sin(dd) * (w1 * w1 * l1 * (m1 + m2) + G * (m1 + m2) * Math.cos(a1) + w2 * w2 * l2 * m2 * Math.cos(dd))) / (l2 * den);
      return [w1, A1, w2, A2];
    };

    function reset() { t = 0; hist = []; trail = []; trail2 = []; periods = []; lastCross = null; }

    const step = stepper(H, 200);
    function physics(h) {
      if (drag) return;
      if (mode === 'pend') {
        const prev = s[0];
        s = rk4(s, fPend, h);
        if (prev < 0 && s[0] >= 0) { const tc = t + h * (-prev / (s[0] - prev)); if (lastCross != null) { periods.push(tc - lastCross); if (periods.length > 4) periods.shift(); } lastCross = tc; }
      } else if (mode === 'spring') {
        const prev = s[0];
        s = rk4(s, fSpring, h);
        if (prev < 0 && s[0] >= 0) { const tc = t + h * (-prev / (s[0] - prev)); if (lastCross != null) { periods.push(tc - lastCross); if (periods.length > 4) periods.shift(); } lastCross = tc; }
      } else {
        d1 = rk4(d1, fDouble, h);
        d2 = rk4(d2, fDouble, h);
        if (st.b > 0) { const k = 1 - st.b * h * 0.5; d1[1] *= k; d1[3] *= k; d2[1] *= k; d2[3] *= k; }
      }
      t += h;
    }

    function bobs(q) {
      const p = pivot(); const sc = pscale(st.L);
      const l = (st.L / 2) * sc;
      const x1 = p.x + l * Math.sin(q[0]); const y1 = p.y + l * Math.cos(q[0]);
      return [x1, y1, x1 + l * Math.sin(q[2]), y1 + l * Math.cos(q[2])];
    }
    function springY() { const p = pivot(); return p.y + (lay.view.h - 90) * 0.5 + s[0] * pscale(); }

    pointer(cv.el, {
      down(p) {
        if (mode === 'pend') {
          const pv = pivot(); const sc = pscale(st.L);
          const bx = pv.x + st.L * sc * Math.sin(s[0]); const by = pv.y + st.L * sc * Math.cos(s[0]);
          if (Math.hypot(p.x - bx, p.y - by) > 40) return false;
          drag = 1;
        } else if (mode === 'spring') {
          const pv = pivot();
          if (Math.abs(p.x - pv.x) > 60) return false;
          drag = 1;
        } else {
          const [x1, y1, x2, y2] = bobs(d1);
          const a = Math.hypot(p.x - x1, p.y - y1); const b = Math.hypot(p.x - x2, p.y - y2);
          if (Math.min(a, b) > 40) return false;
          drag = a < b ? 1 : 2;
        }
      },
      move(p) {
        const pv = pivot();
        if (mode === 'pend') { s = [Math.atan2(p.x - pv.x, p.y - pv.y), 0]; amp0 = Math.abs(s[0]); }
        else if (mode === 'spring') { s = [clamp((p.y - (pv.y + (lay.view.h - 90) * 0.5)) / pscale(), -0.5, 0.5), 0]; amp0 = Math.abs(s[0]); }
        else if (drag === 1) { d1[0] = Math.atan2(p.x - pv.x, p.y - pv.y); d1[1] = 0; d1[3] = 0; }
        else { const [x1, y1] = bobs(d1); d1[2] = Math.atan2(p.x - x1, p.y - y1); d1[1] = 0; d1[3] = 0; }
        if (mode === 'double') { d2 = [d1[0], 0, d1[2] + 0.001, 0]; }
        reset();
      },
      up() { drag = 0; },
    }, ctx.signal);

    function draw() {
      const w = cv.w; const h = cv.h;
      g.clearRect(0, 0, w, h);
      const pv = pivot();
      g.save(); g.beginPath(); g.rect(lay.view.x, lay.view.y, lay.view.w, lay.view.h); g.clip();
      g.fillStyle = '#3A3A38'; g.fillRect(pv.x - 40, pv.y - 6, 80, 4);
      if (mode === 'pend') {
        const sc = pscale(st.L);
        const bx = pv.x + st.L * sc * Math.sin(s[0]); const by = pv.y + st.L * sc * Math.cos(s[0]);
        g.strokeStyle = 'rgba(255,255,255,.08)'; g.setLineDash([2, 4]); g.beginPath(); g.moveTo(pv.x, pv.y); g.lineTo(pv.x, pv.y + st.L * sc); g.stroke(); g.setLineDash([]);
        g.strokeStyle = C.text; g.lineWidth = 1.5; g.beginPath(); g.moveTo(pv.x, pv.y); g.lineTo(bx, by); g.stroke();
        const r = 8 + Math.cbrt(st.m) * 6;
        g.fillStyle = drag ? C.c2 : C.c1; g.beginPath(); g.arc(bx, by, r, 0, 7); g.fill();
        tag(g, `θ ${fmt(s[0] * 180 / Math.PI, 1)}°`, lay.view.x + 12, 16, C.c1, 'left');
        tag(g, `L ${fmt(st.L, 2)} m`, lay.view.x + 12, 32, C.muted, 'left');
      } else if (mode === 'spring') {
        const y = springY();
        const top = pv.y; const coils = 14; const amp = 12;
        g.strokeStyle = C.text; g.lineWidth = 1.4; g.beginPath(); g.moveTo(pv.x, top);
        for (let i = 1; i <= coils * 2; i++) { const yy = top + 10 + (y - top - 26) * (i / (coils * 2)); g.lineTo(pv.x + (i % 2 ? amp : -amp), yy); }
        g.lineTo(pv.x, y - 16); g.lineTo(pv.x, y - 12); g.stroke();
        const eq = pv.y + (lay.view.h - 90) * 0.5;
        g.strokeStyle = 'rgba(255,255,255,.12)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(pv.x - 70, eq); g.lineTo(pv.x + 70, eq); g.stroke(); g.setLineDash([]);
        text(g, 'equilibrium', pv.x + 74, eq + 3, '#5A5A55', 'left', 'alphabetic', MONO_S);
        const sz = 18 + Math.cbrt(st.m) * 10;
        g.fillStyle = drag ? C.c2 : C.c1; rrect(g, pv.x - sz / 2, y - 12, sz, sz, 5); g.fill();
        tag(g, `x ${fmt(s[0] * 100, 1)} cm`, lay.view.x + 12, 16, C.c1, 'left');
      } else {
        // trails
        for (const [tr, col] of [[trail2, C.c4], [trail, C.c1]]) {
          g.lineWidth = 1.2;
          for (let i = 1; i < tr.length; i++) { g.strokeStyle = rgba(col, (i / tr.length) * 0.7); g.beginPath(); g.moveTo(tr[i - 1][0], tr[i - 1][1]); g.lineTo(tr[i][0], tr[i][1]); g.stroke(); }
        }
        for (const [q, col] of [[d2, C.c4], [d1, C.c1]]) {
          const [x1, y1, x2, y2] = bobs(q);
          g.strokeStyle = rgba(C.text, 0.8); g.lineWidth = 1.5; g.beginPath(); g.moveTo(pv.x, pv.y); g.lineTo(x1, y1); g.lineTo(x2, y2); g.stroke();
          g.fillStyle = col; g.beginPath(); g.arc(x1, y1, 7, 0, 7); g.fill(); g.beginPath(); g.arc(x2, y2, 7, 0, 7); g.fill();
        }
        tag(g, 'two pendulums, started 0.001 rad apart', lay.view.x + 12, 16, C.muted, 'left');
      }

      g.restore();
      // charts
      const xmin = Math.max(0, t - 10); const xmax = Math.max(10, t);
      if (mode !== 'double') {
        const isP = mode === 'pend';
        const A = Math.max(0.05, ...hist.map((q) => Math.abs(q[1]))) * 1.15;
        const V = Math.max(0.05, ...hist.map((q) => Math.abs(q[2]))) * 1.15;
        chart(g, lay.c1, [{ data: hist.map((q) => [q[0], q[1]]), color: C.c1, dot: true }], { xmin, xmax, ymin: -A, ymax: A, title: isP ? 'angle θ (rad) vs time' : 'displacement x (m) vs time', titleColor: C.c1, xstep: 1, yd: 2 });
        chart(g, lay.c2, [{ data: hist.map((q) => [q[1], q[2]]), color: C.c3, dot: true }], { xmin: -A, xmax: A, ymin: -V, ymax: V, title: isP ? 'phase space: ω vs θ' : 'phase space: v vs x', titleColor: C.c3, yd: 2 });
      } else {
        const brk = (k) => { const o = []; for (let i = 0; i < hist.length; i++) { if (i && Math.abs(hist[i][k] - hist[i - 1][k]) > Math.PI) o.push([hist[i][0], NaN]); o.push([hist[i][0], hist[i][k]]); } return o; };
        chart(g, lay.c1, [
          { data: brk(1), color: C.c4 },
          { data: brk(2), color: C.c1 },
        ], { xmin, xmax, ymin: -Math.PI * 1.3, ymax: Math.PI * 1.3, title: 'lower arm angle (rad)', yd: 1 });
        chart(g, lay.c2, [{ data: hist.map((q) => [q[0], q[3]]), color: C.c2, dot: true }], { xmin, xmax, ymin: -4, ymax: 1, title: 'log₁₀ gap between them (m)', titleColor: C.c2, yd: 0 });
      }
    }

    let acc = 0;
    ctx.loop((tt, dt) => {
      step(dt, physics);
      acc += dt;
      if (acc > 1 / 50) {
        acc = 0;
        if (mode === 'double') {
          const [, , xa, ya] = bobs(d1); const [, , xb, yb] = bobs(d2);
          trail.push([xa, ya]); trail2.push([xb, yb]); if (trail.length > 300) { trail.shift(); trail2.shift(); }
          const sc = pscale(st.L);
          const gap = Math.max(1e-6, Math.hypot(xa - xb, ya - yb) / sc);
          const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
          hist.push([t, wrap(d2[2]), wrap(d1[2]), Math.log10(gap)]);
        } else hist.push([t, s[0], s[1]]);
        while (hist.length && hist[0][0] < t - 10) hist.shift();
        if (mode !== 'double') readout();
      }
      draw();
    });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Pendulums and springs</h2>'),
      ctx.h('<p class="lede">Pull something away from its resting place, let go, and it swings back and forth with a rhythm set by physics, not by how hard you pulled.</p>'),
    );
    const seg = ctx.seg([['pend', 'Pendulum'], ['spring', 'Spring'], ['double', 'Double pendulum']], mode, (m) => {
      mode = m; reset();
      if (m === 'pend') s = [0.5, 0]; if (m === 'spring') s = [0.2, 0];
      if (m === 'double') { d1 = [2.2, 0, 2.6, 0]; d2 = [2.2, 0, 2.601, 0]; st.L = 2; }
      amp0 = Math.abs(s[0]); controls();
    });
    ctx.panel.append(seg);
    const ctl = ctx.h('<div style="display:grid;gap:10px"></div>');
    const out = ctx.h('<div class="stat"></div>');
    ctx.panel.append(ctl, out);
    function controls() {
      ctl.innerHTML = '';
      if (mode !== 'spring') ctl.append(ctx.slider({ label: mode === 'double' ? 'Total length' : 'Length L', min: 0.25, max: 2.5, step: 0.05, value: st.L, unit: ' m', onInput: (q) => { st.L = q; reset(); } }));
      if (mode === 'spring') ctl.append(ctx.slider({ label: 'Spring stiffness k', min: 5, max: 100, step: 1, value: st.k, unit: ' N/m', onInput: (q) => { st.k = q; reset(); } }));
      if (mode !== 'double') ctl.append(ctx.slider({ label: 'Mass m', min: 0.1, max: 5, step: 0.1, value: st.m, unit: ' kg', onInput: (q) => { st.m = q; reset(); } }));
      ctl.append(ctx.slider({ label: 'Damping b', min: 0, max: 1, step: 0.01, value: st.b, unit: ' kg/s', onInput: (q) => { st.b = q; } }));
      const row = ctx.h(`<div class="row"><button class="btn sm">${mode === 'double' ? 'Release from high up' : 'Release from rest'}</button></div>`);
      row.children[0].onclick = () => {
        reset();
        if (mode === 'pend') s = [amp0 || 0.5, 0];
        else if (mode === 'spring') s = [amp0 || 0.2, 0];
        else { const a = 1.6 + Math.random() * 1.2; const b = a + 0.4 * (Math.random() - 0.5); d1 = [a, 0, b, 0]; d2 = [a, 0, b + 0.001, 0]; }
      };
      ctl.append(row);
      ctl.append(ctx.h(`<p class="hint">${mode === 'double' ? 'Drag either bob to set the start. The rose twin starts 0.001 rad away.' : mode === 'spring' ? 'Drag the block up or down and let go.' : 'Drag the bob sideways and let go.'}</p>`));
      out.innerHTML = '';
    }
    controls();
    function readout() {
      const meas = periods.length ? periods.reduce((a, b) => a + b, 0) / periods.length : NaN;
      if (mode === 'pend') {
        const T0 = 2 * Math.PI * Math.sqrt(st.L / G);
        const a = amp0;
        const Tex = T0 * (1 + a * a / 16 + 11 * a ** 4 / 3072);
        out.innerHTML = `<div><b>${fmt(meas, 3)} s</b><span>measured period</span></div><div><b>${fmt(T0, 3)} s</b><span>2π√(L/g)</span></div><div><b>${fmt(Tex, 3)} s</b><span>large angle fix</span></div>`;
      } else {
        const T0 = 2 * Math.PI * Math.sqrt(st.m / st.k);
        out.innerHTML = `<div><b>${fmt(meas, 3)} s</b><span>measured period</span></div><div><b>${fmt(T0, 3)} s</b><span>2π√(m/k)</span></div>`;
      }
    }

    ctx.panel.append(
      ctx.h(`<div class="card tip"><p>A pendulum and a mass on a spring both have a <b>restoring force</b>: the further you pull them, the harder they are pulled back. That gives a smooth back and forth called <b>simple harmonic motion</b>, a sine wave in time.</p><p>The time for one full swing is the <b>period</b>. For a pendulum it depends on the length, not the mass. For a spring it depends on the mass and how stiff the spring is.</p><p>The <b>phase space</b> plot shows position against speed. A steady swing traces a closed loop. Damping makes it spiral in to the middle.</p></div>`),
      ctx.h(`<div class="card try"><ul>
        <li>Pendulum: change the mass. The period does not move. Change the length to 4 times as long: the period doubles.</li>
        <li>Pull the pendulum to 10°, then to 80°. At small angles the measured period matches 2π√(L/g). At large angles it runs slower, and the phase loop stops being an ellipse.</li>
        <li>Spring: quadruple the mass and the period doubles. Add damping and watch the phase loop become a spiral.</li>
        <li>Double pendulum: the two twins start almost identical, then follow completely different paths. The gap graph climbs roughly in a straight line on a log scale until they are fully apart: exponential growth of tiny differences, the signature of chaos.</li>
      </ul></div>`),
      ctx.h(`<div class="card deep">
        <div class="formula">θ'' = −(g/L) sin θ − (b/m) θ'<span>pendulum, as simulated (no small angle shortcut)</span></div>
        <div class="formula">T ≈ 2π√(L/g) &nbsp; T = 2π√(m/k)<span>pendulum (small swings) and spring</span></div>
        <div class="formula">T ≈ T₀ (1 + θ₀²/16 + 11θ₀⁴/3072)<span>pendulum period at amplitude θ₀ (radians)</span></div>
        <p class="small">For small angles sin θ ≈ θ, which turns the pendulum into the same equation as the spring: x'' = −ω²x, whose solution is a sine wave with ω = 2π/T.</p>
        <p class="small muted">Every model here is stepped with fourth order Runge-Kutta at 600 steps per simulated second. A hanging spring also stretches by mg/k under gravity, which only shifts the equilibrium point and leaves the period unchanged, so the picture is drawn around equilibrium. The double pendulum uses two equal masses on equal arms. Its motion is deterministic, yet unpredictable in practice because any tiny error grows exponentially.</p>
      </div>`),
    );

    ctx.quiz([
      { q: 'You double the mass of a pendulum bob. What happens to its period?', choices: ['It doubles', 'It stays the same', 'It halves'], answer: 1, why: 'For a simple pendulum the period depends on length and g, not mass.' },
      { q: 'How must a pendulum\'s length change to double its period?', choices: ['Double it', 'Make it four times longer', 'Halve it'], answer: 1, why: 'T is proportional to √L, so doubling T needs 4 times the length.' },
      { q: 'What does a damped oscillator look like in phase space?', choices: ['A closed loop', 'A spiral toward the centre', 'A straight line'], answer: 1, why: 'Each swing loses energy, so both the position and speed amplitudes shrink and the path spirals in.' },
    ]);
  },
};
