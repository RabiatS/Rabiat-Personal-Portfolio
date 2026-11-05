import { MONO, MONO_S, chart, text, tag, arrow, pointer, stepper, clamp, fmt, rgba, rrect } from './_util.js';

// Motion graphs: a runner on a 10 m track. Position comes from your finger (or from a constant
// acceleration program), velocity and acceleration are measured from it every 1/120 s.
export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas();
    const g = cv.ctx;
    const H = 1 / 120;
    const L = 10; // metres
    const WIN = 10; // seconds shown

    let mode = 'free';
    let matchKind = 'x';
    let t = 0; let x = 2; let v = 0; let a = 0; let goal = 2;
    let dragging = false; let running = true; let finished = false; let score = null;
    let hx = []; let hv = []; let ha = [];
    let target = [];
    let prog = { x0: 1, v0: 1, a: 0 };

    const lay = {};
    cv.onResize((w, h) => {
      lay.pad = Math.max(24, Math.min(54, w * 0.06));
      lay.trackY = Math.max(64, Math.min(110, h * 0.2));
      const top = lay.trackY + 42;
      const gap = 8;
      const ch = (h - top - gap * 2 - 4) / 3;
      lay.boxes = [0, 1, 2].map((i) => ({ x: 4, y: top + i * (ch + gap), w: w - 8, h: ch }));
    });
    const X = (m) => lay.pad + (m / L) * (cv.w - lay.pad * 2);
    const M = (px) => clamp(((px - lay.pad) / (cv.w - lay.pad * 2)) * L, 0, L);

    function reset(keepX) {
      t = 0; hx = []; hv = []; ha = []; finished = false; score = null; v = 0; a = 0;
      if (!keepX) x = goal = 2;
      running = mode !== 'match';
      if (mode === 'program') { x = goal = prog.x0; v = prog.v0; a = prog.a; running = false; }
      if (mode === 'match') { newTarget(); x = goal = target[0][1]; if (matchKind === 'v') x = goal = 1; }
      updateReadout();
    }

    function newTarget() {
      // Piecewise linear position, or piecewise constant velocity, over 10 s.
      target = [];
      if (matchKind === 'x') {
        const pts = [[0, 1 + Math.random() * 3]];
        let tt = 0;
        while (tt < WIN) {
          tt = Math.min(WIN, tt + 2 + Math.random() * 2.2);
          const prev = pts[pts.length - 1][1];
          let nx = Math.random() < 0.25 ? prev : 1 + Math.random() * 8;
          if (Math.abs(nx - prev) / (tt - pts[pts.length - 1][0]) > 2.5) nx = prev + Math.sign(nx - prev) * 2.5 * (tt - pts[pts.length - 1][0]);
          pts.push([tt, clamp(nx, 0.5, 9.5)]);
        }
        target = pts;
      } else {
        // velocity steps that keep the runner on the track starting from x = 1
        let pos = 1; let tt = 0; const segs = [];
        while (tt < WIN) {
          const d = Math.min(WIN - tt, 2 + Math.random() * 2);
          let vv = [-1.5, -1, -0.5, 0, 0.5, 1, 1.5][Math.floor(Math.random() * 7)];
          if (pos + vv * d > 9.3 || pos + vv * d < 0.7) vv = -vv;
          if (pos + vv * d > 9.3 || pos + vv * d < 0.7) vv = 0;
          segs.push([tt, tt + d, vv]); pos += vv * d; tt += d;
        }
        for (const [a0, b0, vv] of segs) { target.push([a0, vv], [b0, vv]); }
      }
    }
    const targetAt = (tt) => {
      for (let i = 1; i < target.length; i++) {
        if (tt <= target[i][0]) { const [t0, y0] = target[i - 1]; const [t1, y1] = target[i]; return t1 === t0 ? y1 : y0 + (y1 - y0) * (tt - t0) / (t1 - t0); }
      }
      return target[target.length - 1][1];
    };

    const step = stepper(H);
    function physics(h) {
      if (!running) return;
      if (mode === 'program') {
        // semi-implicit Euler with constant acceleration, stopping at the ends of the track
        v += prog.a * h; x += v * h; a = prog.a;
        if (x <= 0 || x >= L) { x = clamp(x, 0, L); v = 0; a = 0; }
      } else {
        const xp = x;
        x += (goal - x) * (1 - Math.exp(-h / 0.05));
        const vp = v;
        v += ((x - xp) / h - v) * (1 - Math.exp(-h / 0.1));
        a += ((v - vp) / h - a) * (1 - Math.exp(-h / 0.12));
      }
      t += h;
      hx.push([t, x]); hv.push([t, v]); ha.push([t, a]);
      if (mode === 'free') {
        const cut = t - WIN; while (hx.length && hx[0][0] < cut) { hx.shift(); hv.shift(); ha.shift(); }
      } else if (t >= WIN) {
        running = false; finished = true;
        if (mode === 'match') grade();
      }
    }

    function grade() {
      const src = matchKind === 'x' ? hx : hv;
      let se = 0;
      for (const [tt, y] of src) { const d = y - targetAt(tt); se += d * d; }
      const rms = Math.sqrt(se / Math.max(1, src.length));
      score = Math.round(clamp(100 - rms * (matchKind === 'x' ? 22 : 55), 0, 100));
      updateReadout();
    }

    pointer(cv.el, {
      down(p) {
        if (mode === 'program') return false;
        if (p.y > lay.trackY + 40) return false;
        dragging = true; goal = M(p.x);
        if (mode === 'match' && !running && !finished) { running = true; t = 0; }
        if (mode === 'free') running = true;
      },
      move(p) { if (dragging) goal = M(p.x); },
      up() { dragging = false; },
    }, ctx.signal);

    function draw() {
      const w = cv.w; const h = cv.h;
      g.clearRect(0, 0, w, h);
      // track
      const ty = lay.trackY;
      g.strokeStyle = '#3A3A38'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(X(0), ty + 14); g.lineTo(X(L), ty + 14); g.stroke();
      for (let m = 0; m <= L; m++) {
        g.strokeStyle = m % 5 === 0 ? '#5A5A55' : '#2A2A2A';
        g.beginPath(); g.moveTo(X(m), ty + 14); g.lineTo(X(m), ty + (m % 5 === 0 ? 24 : 20)); g.stroke();
        if (cv.w > 420 || m % 2 === 0) text(g, `${m}`, X(m), ty + 36, '#5A5A55', 'center', 'alphabetic', MONO_S);
      }
      text(g, 'm', X(L) + 10, ty + 36, '#5A5A55', 'left', 'alphabetic', MONO_S);
      if (mode === 'match' && matchKind === 'x' && (running || finished)) {
        const gx = X(targetAt(Math.min(t, WIN)));
        g.strokeStyle = rgba(C.c3, 0.7); g.setLineDash([3, 3]); g.beginPath(); g.moveTo(gx, ty - 30); g.lineTo(gx, ty + 14); g.stroke(); g.setLineDash([]);
      }
      // runner
      const rx = X(x);
      g.fillStyle = rgba(C.c1, dragging ? 0.25 : 0.12);
      g.beginPath(); g.arc(rx, ty - 6, 22, 0, 7); g.fill();
      g.strokeStyle = C.c1; g.lineWidth = 2.2; g.lineCap = 'round';
      const ph = t * 9 * Math.min(1, Math.abs(v)); const sw = Math.sin(ph) * Math.min(1, Math.abs(v) * 0.8);
      g.beginPath(); g.arc(rx, ty - 26, 4.5, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(rx, ty - 21); g.lineTo(rx, ty - 4);
      g.moveTo(rx, ty - 4); g.lineTo(rx + 7 * sw, ty + 12);
      g.moveTo(rx, ty - 4); g.lineTo(rx - 7 * sw, ty + 12);
      g.moveTo(rx, ty - 16); g.lineTo(rx - 7 * sw, ty - 7);
      g.moveTo(rx, ty - 16); g.lineTo(rx + 7 * sw, ty - 7);
      g.stroke();
      // velocity and acceleration arrows above the runner
      const vs = 18; const as = 4;
      if (Math.abs(v) > 0.05) { arrow(g, rx, ty - 42, rx + clamp(v * vs, -120, 120), ty - 42, C.c2, 2, 7); }
      if (Math.abs(a) > 0.1) { arrow(g, rx, ty - 52, rx + clamp(a * as, -120, 120), ty - 52, C.c4, 2, 7); }
      tag(g, `x ${fmt(x, 2)} m`, 10, 16, C.c1, 'left', 'middle');
      tag(g, `v ${fmt(v, 2)} m/s`, 10, 32, C.c2, 'left', 'middle');
      tag(g, `a ${fmt(a, 2)} m/s²`, 10, 48, C.c4, 'left', 'middle');
      if (mode !== 'free') {
        const msg = mode === 'match'
          ? (finished ? `score ${score}%` : running ? `${fmt(WIN - t, 1)} s left` : 'drag the runner to start the clock')
          : (finished ? 'done' : running ? `t = ${fmt(t, 1)} s` : 'press play');
        tag(g, msg, w - 10, 16, C.text, 'right', 'middle');
      } else if (!hx.length) {
        tag(g, 'drag the runner along the track', w - 10, 16, C.muted, 'right', 'middle');
      }

      // graphs
      const xmin = mode === 'free' ? Math.max(0, t - WIN) : 0; const xmax = xmin + WIN;
      const tser = (k) => (mode === 'match' && matchKind === k && target.length ? [{ data: target, color: rgba(C.c3, 0.9), dash: [5, 4], width: 2 }] : []);
      const [b1, b2, b3] = lay.boxes;
      chart(g, b1, [...tser('x'), { data: hx, color: C.c1, dot: true }], { xmin, xmax, ymin: 0, ymax: L, title: 'position x (m)', titleColor: C.c1, xstep: 1, yd: 0 });
      chart(g, b2, [...tser('v'), { data: hv, color: C.c2, dot: true }], { xmin, xmax, ymin: -4, ymax: 4, title: 'velocity v (m/s)', titleColor: C.c2, xstep: 1, yd: 0 });
      chart(g, b3, [{ data: ha.map(([p, q]) => [p, clamp(q, -10, 10)]), color: C.c4, dot: true }], { xmin, xmax, ymin: -10, ymax: 10, title: 'acceleration a (m/s²)', titleColor: C.c4, xstep: 1, yd: 0, xlab: `time ${fmt(xmin, 0)} to ${fmt(xmax, 0)} s` });
    }

    ctx.loop((now, dt) => { step(dt, physics); draw(); });

    // Panel
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Motion graphs</h2>'),
      ctx.h('<p class="lede">Move a runner with your finger and three graphs tell the story of that motion while it happens.</p>'),
    );
    const modeSeg = ctx.seg([['free', 'Free run'], ['program', 'Set a, play'], ['match', 'Match the graph']], mode, (m) => { mode = m; showControls(); reset(); });
    ctx.panel.append(modeSeg);
    const ctl = ctx.h('<div style="display:grid;gap:10px"></div>');
    ctx.panel.append(ctl);
    const out = ctx.h('<div class="stat"></div>');
    ctx.panel.append(out);

    function updateReadout() {
      if (mode === 'match' && score != null) out.innerHTML = `<div><b>${score}%</b><span>match score</span></div><div><b>${score > 85 ? 'Great' : score > 65 ? 'Close' : 'Keep at it'}</b><span>verdict</span></div>`;
      else out.innerHTML = '';
    }

    function showControls() {
      ctl.innerHTML = '';
      if (mode === 'free') {
        ctl.append(ctx.h('<p class="hint">Drag the runner on the track. The graphs scroll and show the last 10 s.</p>'));
      } else if (mode === 'program') {
        const s1 = ctx.slider({ label: 'Start position x₀', min: 0, max: 10, step: 0.5, value: prog.x0, unit: ' m', onInput: (v2) => { prog.x0 = v2; reset(); } });
        const s2 = ctx.slider({ label: 'Start velocity v₀', min: -3, max: 3, step: 0.25, value: prog.v0, unit: ' m/s', onInput: (v2) => { prog.v0 = v2; reset(); } });
        const s3 = ctx.slider({ label: 'Acceleration a', min: -2, max: 2, step: 0.1, value: prog.a, unit: ' m/s²', onInput: (v2) => { prog.a = v2; reset(); } });
        const row = ctx.h('<div class="row"><button class="btn sm">Play 10 s</button></div>');
        row.querySelector('button').onclick = () => { reset(); running = true; };
        ctl.append(s1, s2, s3, row);
      } else {
        const kind = ctx.seg([['x', 'Match position'], ['v', 'Match velocity']], matchKind, (k) => { matchKind = k; reset(); });
        const row = ctx.h('<div class="row"><button class="btn sm">New graph</button><button class="btn ghost sm">Retry</button></div>');
        row.children[0].onclick = () => reset();
        row.children[1].onclick = () => { t = 0; hx = []; hv = []; ha = []; finished = false; score = null; running = false; x = goal = matchKind === 'x' ? target[0][1] : 1; v = 0; a = 0; updateReadout(); };
        ctl.append(kind, ctx.h('<p class="hint">The violet dashed line is the target. The clock starts when you grab the runner and stops after 10 s.</p>'), row);
      }
    }
    showControls();
    reset();

    ctx.panel.append(
      ctx.h(`<div class="card tip"><p><b>Position</b> says where you are. <b>Velocity</b> says how fast position is changing, and in which direction. <b>Acceleration</b> says how fast velocity is changing.</p><p>So each graph is the <i>slope</i> of the one above it. A steady walk is a straight sloped line on the position graph, a flat line on the velocity graph, and zero acceleration.</p></div>`),
      ctx.h(`<div class="card try"><ul>
        <li>Walk slowly to the right at a steady pace. Watch the velocity line sit flat above zero.</li>
        <li>Now walk back to the left. Velocity goes negative, because direction matters.</li>
        <li>Stand still: the position line goes flat, velocity drops to zero.</li>
        <li>In <b>Set a, play</b>, try x₀ = 8, v₀ = −2, a = +0.6. The runner slows, turns around and speeds back up. At the turn, v is zero but a is not.</li>
      </ul></div>`),
      ctx.h(`<div class="card deep">
        <div class="formula">v = dx/dt &nbsp; a = dv/dt<span>slope of x(t) is v, slope of v(t) is a</span></div>
        <div class="formula">x = x₀ + v₀t + ½at²<span>constant acceleration</span></div>
        <p class="small">Going the other way, the area under the velocity graph is the change in position, and the area under the acceleration graph is the change in velocity.</p>
        <p class="small muted">How it is measured: every 1/120 s the runner's position is sampled and velocity is the change in position divided by the time step, lightly smoothed. Acceleration is computed the same way from velocity. Differentiating amplifies jitter, which is why the acceleration trace is the noisiest of the three. Real motion sensors face the same problem.</p>
      </div>`),
    );

    ctx.quiz([
      { q: 'The position graph is a straight line sloping upward. What does the velocity graph look like?', choices: ['A straight line sloping upward', 'A flat line above zero', 'A flat line at zero'], answer: 1, why: 'A constant slope on x(t) means a constant velocity, so v(t) is flat at that value.' },
      { q: 'A ball thrown straight up is at its highest point. Which is true?', choices: ['v = 0 and a = 0', 'v = 0 but a is not zero', 'v is not zero but a = 0'], answer: 1, why: 'For an instant it stops, but gravity is still changing its velocity, so the acceleration is about 9.8 m/s² downward.' },
      { q: 'What does the area under a velocity time graph tell you?', choices: ['The acceleration', 'The change in position (displacement)', 'The average speed'], answer: 1, why: 'Velocity times time is distance moved, so the area adds up the displacement.' },
    ]);
  },
};
