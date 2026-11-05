import { MONO, MONO_S, text, tag, arrow, pointer, fmt, rgba, clamp, lerp } from './_util.js';

// Orbits: a satellite around Earth, stepped with kick-drift-kick leapfrog (symplectic, so orbits stay closed).
const GM = 398600.4; // km^3/s^2
const RE = 6371; // km
const R0 = 10000; // launch radius, km
const DT = 5; // s per step

export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas();
    const g = cv.ctx;
    const vc = Math.sqrt(GM / R0); const ve = Math.sqrt(2 * GM / R0);
    const st = { v: +vc.toFixed(2), ang: 0, warp: 1200, areas: true };
    let x; let y; let vx; let vy; let t; let trail; let crashed; let sectors; let cur; let secDt; let secStart;
    let acc = 0; let lastTrail = 0;
    let view = 30000; let viewGoal = 30000;
    let stars = [];

    function elements() {
      const r = Math.hypot(x, y); const v2 = vx * vx + vy * vy;
      const E = v2 / 2 - GM / r;
      const h = x * vy - y * vx;
      const ex = (vy * h) / GM - x / r; const ey = (-vx * h) / GM - y / r;
      const e = Math.hypot(ex, ey);
      const a = -GM / (2 * E);
      const T = E < 0 ? 2 * Math.PI * Math.sqrt(a ** 3 / GM) : Infinity;
      return { r, E, h, e, ex, ey, a, T, p: h * h / GM };
    }

    function launch() {
      const a = st.ang * Math.PI / 180;
      x = 0; y = R0; vx = st.v * Math.cos(a); vy = st.v * Math.sin(a);
      t = 0; trail = [[x, y]]; crashed = false; sectors = []; lastTrail = 0; acc = 0;
      const el = elements();
      secDt = Number.isFinite(el.T) ? el.T / 16 : 1500;
      cur = [[0, 0], [x, y]]; secStart = 0;
      const apo = el.E < 0 ? el.a * (1 + el.e) : Infinity;
      viewGoal = clamp(Number.isFinite(apo) ? apo * 1.12 : 60000, 14000, 60000);
      readout();
    }

    function accel(px, py) { const r2 = px * px + py * py; const r = Math.sqrt(r2); const k = -GM / (r2 * r); return [k * px, k * py]; }
    function stepOnce() {
      let [ax, ay] = accel(x, y);
      vx += ax * DT / 2; vy += ay * DT / 2;
      x += vx * DT; y += vy * DT;
      [ax, ay] = accel(x, y);
      vx += ax * DT / 2; vy += ay * DT / 2;
      t += DT;
      if (Math.hypot(x, y) < RE) { crashed = true; readout(); }
      // equal area bookkeeping
      cur.push([x, y]);
      if (t - secStart >= secDt - 1e-9) {
        sectors.push({ pts: cur, area: polyArea(cur) });
        if (sectors.length > 16) sectors.shift();
        cur = [[0, 0], [x, y]]; secStart = t;
        readout();
      }
    }
    function polyArea(p) { let s = 0; for (let i = 0; i < p.length; i++) { const [a, b] = p[i]; const [c, d] = p[(i + 1) % p.length]; s += a * d - b * c; } return Math.abs(s) / 2; }

    cv.onResize((w, h) => {
      stars = Array.from({ length: 90 }, () => [Math.random() * w, Math.random() * h, Math.random()]);
    });
    const S = () => (Math.min(cv.w, cv.h) / 2 - 18) / view;
    const P = (px, py) => [cv.w / 2 + px * S(), cv.h / 2 - py * S()];

    pointer(cv.el, {
      down(p) {
        // drag from the launch point to set direction and speed
        const [lx, ly] = P(0, R0);
        if (Math.hypot(p.x - lx, p.y - ly) > 60) return false;
      },
      move(p) {
        const [lx, ly] = P(0, R0);
        const dx = p.x - lx; const dy = ly - p.y;
        if (Math.hypot(dx, dy) < 8) return;
        st.ang = clamp(Math.round(Math.atan2(dy, Math.max(1, dx)) * 180 / Math.PI), -60, 60);
        st.v = clamp(+(Math.hypot(dx, dy) / 14).toFixed(2), 3, 11);
        sV.value = st.v; sA.value = st.ang; launch();
      },
    }, ctx.signal);

    function draw(dt) {
      const w = cv.w; const h = cv.h;
      view = lerp(view, viewGoal, 1 - Math.exp(-dt * 3));
      g.clearRect(0, 0, w, h);
      for (const [sx, sy, b] of stars) { g.fillStyle = `rgba(245,245,240,${0.1 + b * 0.25})`; g.fillRect(sx, sy, 1, 1); }
      const sc = S();
      const [cx, cy] = [w / 2, h / 2];
      // launch radius
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.setLineDash([2, 5]); g.beginPath(); g.arc(cx, cy, R0 * sc, 0, 7); g.stroke(); g.setLineDash([]);
      // equal area sectors
      if (st.areas) {
        sectors.forEach((s, i) => {
          g.fillStyle = rgba((sectors.length - i) % 2 ? C.c3 : C.c1, 0.16);
          g.beginPath(); s.pts.forEach(([a, b], k) => { const [px, py] = P(a, b); k ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); g.fill();
        });
        g.fillStyle = rgba(C.c2, 0.18);
        g.beginPath(); cur.forEach(([a, b], k) => { const [px, py] = P(a, b); k ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); g.fill();
      }
      // predicted conic from the current state
      const el = elements();
      g.strokeStyle = 'rgba(245,245,240,.22)'; g.setLineDash([3, 5]); g.lineWidth = 1; g.beginPath();
      const w0 = Math.atan2(el.ey, el.ex);
      let first = true;
      for (let k = 0; k <= 360; k++) {
        const th = -Math.PI + (k / 360) * 2 * Math.PI;
        const den = 1 + el.e * Math.cos(th);
        if (den <= 0.02) { first = true; continue; }
        const r = el.p / den;
        if (r > view * 2) { first = true; continue; }
        const [px, py] = P(r * Math.cos(th + w0), r * Math.sin(th + w0));
        if (first) { g.moveTo(px, py); first = false; } else g.lineTo(px, py);
      }
      g.stroke(); g.setLineDash([]);
      // trail
      g.strokeStyle = rgba(C.c1, 0.85); g.lineWidth = 1.6; g.beginPath();
      trail.forEach(([a, b], k) => { const [px, py] = P(a, b); k ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
      // planet
      const grd = g.createRadialGradient(cx - RE * sc * 0.3, cy - RE * sc * 0.3, RE * sc * 0.1, cx, cy, RE * sc);
      grd.addColorStop(0, '#2a5d8a'); grd.addColorStop(1, '#0f2a44');
      g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, RE * sc, 0, 7); g.fill();
      g.strokeStyle = rgba(C.c5, 0.6); g.lineWidth = 1; g.stroke();
      text(g, 'Earth', cx, cy + 4, rgba(C.text, 0.7), 'center', 'alphabetic', MONO_S);
      // satellite with velocity and gravity arrows
      const [sx, sy] = P(x, y);
      if (!crashed) {
        const [ax, ay] = accel(x, y);
        arrow(g, sx, sy, sx + vx * 11, sy - vy * 11, C.c2, 2, 8);
        const am = Math.hypot(ax, ay); const al = clamp(am * 25000, 18, 80);
        arrow(g, sx, sy, sx + (ax / am) * al, sy - (ay / am) * al, C.c4, 2, 8);
      }
      g.fillStyle = crashed ? C.c4 : C.text; g.beginPath(); g.arc(sx, sy, 4.5, 0, 7); g.fill();
      // launch handle
      const [lx, ly] = P(0, R0);
      g.strokeStyle = rgba(C.c2, 0.5); g.beginPath(); g.arc(lx, ly, 10, 0, 7); g.stroke();
      // legend
      tag(g, 'velocity', 12, 16, C.c2, 'left'); tag(g, 'gravity pull', 12, 32, C.c4, 'left');
      tag(g, `t ${fmt(t / 3600, 2)} h`, w - 12, 16, C.muted, 'right');
      const type = crashed ? 'crashed into Earth' : el.e < 0.01 ? 'circular' : el.E < 0 ? 'ellipse' : 'escape';
      tag(g, type, w - 12, 32, crashed ? C.c4 : el.E >= 0 ? C.c2 : C.c1, 'right');
      if (!trail || trail.length < 3) tag(g, 'drag from the ring at the launch point to aim', w / 2, h - 14, C.muted, 'center');
    }

    ctx.loop((tt, dt) => {
      if (!crashed && Math.hypot(x, y) < 150000) {
        acc += dt * st.warp;
        let n = 0;
        while (acc >= DT && n < 4000 && !crashed) {
          stepOnce(); acc -= DT; n++;
          if (t - lastTrail >= 30) { trail.push([x, y]); lastTrail = t; if (trail.length > 3000) trail.shift(); }
        }
      }
      draw(dt);
      if (Math.round(tt * 4) !== Math.round((tt - dt) * 4)) liveReadout();
    });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Circular motion and orbits</h2>'),
      ctx.h('<p class="lede">An orbit is falling around the Earth: moving sideways so fast that the ground curves away before you hit it.</p>'),
    );
    const sV = ctx.slider({ label: 'Launch speed', min: 3, max: 11, step: 0.01, value: st.v, unit: ' km/s', fmt: (q) => `${q.toFixed(2)} km/s`, onInput: (q) => { st.v = q; launch(); } });
    const sA = ctx.slider({ label: 'Launch angle above sideways', min: -60, max: 60, step: 1, value: 0, unit: '°', onInput: (q) => { st.ang = q; launch(); } });
    const sW = ctx.slider({ label: 'Time warp', min: 200, max: 6000, step: 100, value: st.warp, fmt: (q) => `${q}×`, onInput: (q) => { st.warp = q; } });
    const row = ctx.h(`<div class="row"><button class="btn ghost sm">Circular ${vc.toFixed(2)}</button><button class="btn ghost sm">Ellipse 7.20</button><button class="btn ghost sm">Escape ${ve.toFixed(2)}</button></div>`);
    row.children[0].onclick = () => { st.v = +vc.toFixed(2); st.ang = 0; sV.value = st.v; sA.value = 0; launch(); };
    row.children[1].onclick = () => { st.v = 7.2; st.ang = 0; sV.value = st.v; sA.value = 0; launch(); };
    row.children[2].onclick = () => { st.v = +(ve + 0.01).toFixed(2); st.ang = 0; sV.value = st.v; sA.value = 0; launch(); };
    const opt = ctx.h('<label class="check"><input type="checkbox" checked> shade equal time slices (Kepler\'s second law)</label>');
    opt.querySelector('input').onchange = (e) => { st.areas = e.target.checked; };
    const out = ctx.h('<div class="stat"></div>');
    const live = ctx.h('<div class="stat"></div>');
    ctx.panel.append(sV, sA, row, sW, opt, out, live);

    function readout() {
      const el = elements();
      const type = el.E >= 0 ? 'escape' : el.e < 0.01 ? 'circular' : 'ellipse';
      const peri = el.E < 0 ? el.a * (1 - el.e) : el.p / (1 + el.e);
      out.innerHTML = [
        ['orbit', crashed ? 'crash' : type], ['eccentricity', fmt(el.e, 3)],
        ['period', Number.isFinite(el.T) ? `${fmt(el.T / 3600, 2)} h` : 'none'],
        ['lowest altitude', `${fmt(Math.max(0, peri - RE), 0)} km`],
        ['last slice area', sectors.length ? `${fmt(sectors[sectors.length - 1].area / 1e6, 1)} M km²` : '--'],
        ['slice before', sectors.length > 1 ? `${fmt(sectors[sectors.length - 2].area / 1e6, 1)} M km²` : '--'],
      ].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
    }
    function liveReadout() {
      const r = Math.hypot(x, y);
      live.innerHTML = [['speed now', `${fmt(Math.hypot(vx, vy), 2)} km/s`], ['altitude now', `${fmt(r - RE, 0)} km`]].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
    }
    launch();

    ctx.panel.append(
      ctx.h(`<div class="card tip"><p>Gravity always pulls the satellite toward the centre of the Earth (rose arrow). If the satellite were not moving, it would fall straight down. Moving sideways (amber arrow), it falls <b>around</b> the Earth instead.</p><p>At exactly the right speed, the pull bends the path into a circle. A bit slower and it swoops in closer, speeding up, then climbs back out: an ellipse. Fast enough and gravity can never turn it around: it escapes.</p><p>For anything moving in a circle, the pull toward the centre is called the <b>centripetal</b> force. Here gravity provides it.</p></div>`),
      ctx.h(`<div class="card try"><ul>
        <li>Press <b>Circular</b>. The velocity arrow is always at right angles to the pull, so speed never changes.</li>
        <li>Press <b>Ellipse</b>. Watch the shaded slices: each covers the same time. Near Earth they are short and fat, far away long and thin, but their areas match. Compare the two area readouts.</li>
        <li>Slide the speed down to 5 km/s. The orbit dips into the Earth: a crash, which is what a thrown ball is doing.</li>
        <li>Press <b>Escape</b>. The path opens into a curve that never closes. At exactly escape speed it is a parabola, faster gives a hyperbola.</li>
      </ul></div>`),
      ctx.h(`<div class="card deep">
        <div class="formula">a = v² / r &nbsp; and &nbsp; GM / r² = v² / r<span>circular orbit: gravity supplies the centripetal acceleration</span></div>
        <div class="formula">v_circ = √(GM / r) &nbsp; v_esc = √(2GM / r) = √2 · v_circ<span>at r = 10 000 km: ${vc.toFixed(2)} and ${ve.toFixed(2)} km/s</span></div>
        <div class="formula">T² = 4π² a³ / GM<span>Kepler's third law (a = semi-major axis)</span></div>
        <p class="small">Kepler's second law, equal areas in equal times, is conservation of angular momentum: r × v stays fixed, so the satellite must move faster when it is closer.</p>
        <p class="small muted">Numbers are for Earth (GM = 398 600 km³/s², radius 6371 km), launching from 10 000 km from the centre. The integrator is kick-drift-kick leapfrog with a 5 s step. It is symplectic, which means energy errors stay bounded instead of piling up, so orbits keep closing on themselves for a very long time. A simple Euler step would make them spiral outward.</p>
      </div>`),
    );

    ctx.quiz([
      { q: 'A satellite in a circular orbit is moving at constant speed. Is it accelerating?', choices: ['No, its speed is constant', 'Yes, toward the centre, because its direction keeps changing', 'Yes, forward along its path'], answer: 1, why: 'Velocity includes direction. Turning in a circle needs an acceleration of v²/r toward the centre, supplied by gravity.' },
      { q: 'In an elliptical orbit, where is the satellite moving fastest?', choices: ['Farthest from the planet', 'Closest to the planet', 'The speed is the same everywhere'], answer: 1, why: 'Equal areas in equal times means it must sweep faster when the radius is short, at closest approach.' },
      { q: 'How does escape speed compare to circular orbit speed at the same distance?', choices: ['They are equal', 'Escape speed is √2 (about 1.41) times larger', 'Escape speed is twice as large'], answer: 1, why: 'v_esc = √(2GM/r) and v_circ = √(GM/r), so the ratio is √2.' },
    ]);
  },
};
