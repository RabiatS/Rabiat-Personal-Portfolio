import { MONO, MONO_S, text, tag, arrow, pointer, rk4, fmt, rgba, clamp, lerp } from './_util.js';

// Projectile motion: RK4 with optional quadratic air drag, on Earth, the Moon or Mars.
const WORLDS = {
  earth: { name: 'Earth', g: 9.81, air: 1 },
  moon: { name: 'Moon', g: 1.62, air: 0 },
  mars: { name: 'Mars', g: 3.71, air: 0.017 },
};
// Drag constant k = ½ρ C_d A / m for a light 20 cm ball of 1 kg in sea level air (ρ 1.2, C_d 0.47).
const K_AIR = 0.5 * 1.2 * 0.47 * Math.PI * 0.1 * 0.1 / 1;
const H = 1 / 240;

export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas();
    const g = cv.ctx;
    const st = { angle: 45, speed: 20, height: 0, world: 'earth', drag: false, preview: true };
    let shots = []; // { pts, landed, i, t, color }
    let flying = null;
    let target = null; let hits = 0; let tries = 0; let msg = ''; let msgT = 0;
    let scale = 10; let goal = 10;
    let aiming = false;

    function simulate(o = st) {
      const W = WORLDS[o.world];
      const k = o.drag ? K_AIR * W.air : 0;
      const a = o.angle * Math.PI / 180;
      let s = [0, o.height, o.speed * Math.cos(a), o.speed * Math.sin(a)];
      const f = (q) => { const v = Math.hypot(q[2], q[3]); return [q[2], q[3], -k * v * q[2], -W.g - k * v * q[3]]; };
      const pts = [[0, s[1], s[2], s[3], 0]];
      let t = 0; let peak = s[1];
      for (let n = 0; n < 240 * 400; n++) {
        const ns = rk4(s, f, H); t += H;
        if (ns[1] < 0) {
          const u = s[1] / (s[1] - ns[1]);
          pts.push([lerp(s[0], ns[0], u), 0, lerp(s[2], ns[2], u), lerp(s[3], ns[3], u), t - H + u * H]);
          break;
        }
        s = ns; peak = Math.max(peak, s[1]);
        pts.push([s[0], s[1], s[2], s[3], t]);
      }
      const last = pts[pts.length - 1];
      return { pts, range: last[0], peak, time: last[4], vland: Math.hypot(last[2], last[3]) };
    }
    const ideal = () => {
      const W = WORLDS[st.world]; const a = st.angle * Math.PI / 180; const v = st.speed;
      return v * Math.cos(a) * (v * Math.sin(a) + Math.sqrt((v * Math.sin(a)) ** 2 + 2 * W.g * st.height)) / W.g;
    };

    let pred = simulate();
    function refit() {
      // fit the view to the predicted path, the target and earlier shots, keeping 1:1 scale
      let xm = Math.max(20, pred.range * 1.1); let ym = Math.max(8, pred.peak * 1.15, st.height + 6);
      if (target) xm = Math.max(xm, target.x + 6);
      for (const s of shots.slice(-3)) { xm = Math.max(xm, s.sim.range * 1.05); ym = Math.max(ym, s.sim.peak * 1.1); }
      const padL = 46; const padR = 24;
      goal = Math.min((cv.w - padL - padR) / xm, (cv.h - 110) / ym);
    }
    const lay = { padL: 46 };
    cv.onResize(() => { refit(); scale = goal; });
    const X = (x) => lay.padL + x * scale;
    const Y = (y) => cv.h - 36 - y * scale;

    function fire() {
      const sim = simulate();
      const hue = [C.c1, C.c2, C.c3, C.c5, C.c6][shots.length % 5];
      flying = { sim, t: 0, color: hue, speedup: Math.max(1, sim.time / 3) };
      shots.push(flying);
      if (shots.length > 6) shots.shift();
      refit();
      if (target) tries++;
      readout(sim);
    }

    function newTarget() {
      const W = WORLDS[st.world];
      const maxR = 60 * 60 / W.g * (st.drag ? 0.5 : 1);
      target = { x: Math.round(clamp(10 + Math.random() * (Math.min(maxR, 300) - 10), 10, 280)), tol: 0 };
      target.tol = Math.max(1.2, target.x * 0.025);
      refit();
    }

    pointer(cv.el, {
      down(p) { aiming = true; aim(p); },
      move(p) { if (aiming) aim(p); },
      up() { if (aiming) { aiming = false; fire(); } },
    }, ctx.signal);
    function aim(p) {
      const dx = p.x - X(0); const dy = Y(st.height) - p.y;
      const a = clamp(Math.round(Math.atan2(dy, Math.max(1, dx)) * 180 / Math.PI), 0, 85);
      st.angle = a; sAngle.value = a; pred = simulate(); refit();
    }

    function draw(dt) {
      const w = cv.w; const h = cv.h;
      scale = lerp(scale, goal, 1 - Math.exp(-dt * 5));
      g.clearRect(0, 0, w, h);
      const W = WORLDS[st.world];
      // ground and sky tint
      const gy = Y(0);
      g.fillStyle = st.world === 'mars' ? 'rgba(251,113,133,.06)' : st.world === 'moon' ? 'rgba(160,160,154,.06)' : 'rgba(94,234,212,.04)';
      g.fillRect(0, gy, w, h - gy);
      g.strokeStyle = '#3A3A38'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, gy); g.lineTo(w, gy); g.stroke();
      // distance ticks
      const span = (w - lay.padL) / scale;
      const stepM = [1, 2, 5, 10, 20, 50, 100, 200, 500].find((s) => span / s <= 10) || 1000;
      for (let m = 0; m <= span; m += stepM) {
        g.strokeStyle = '#2A2A2A'; g.beginPath(); g.moveTo(X(m), gy); g.lineTo(X(m), gy + 5); g.stroke();
        text(g, `${m}`, X(m), gy + 17, '#5A5A55', 'center', 'alphabetic', MONO_S);
      }
      text(g, 'm', w - 8, gy + 17, '#5A5A55', 'right', 'alphabetic', MONO_S);
      // height scale
      const hspan = (gy - 50) / scale;
      for (let m = stepM; m <= hspan; m += stepM) { g.strokeStyle = 'rgba(255,255,255,.04)'; g.beginPath(); g.moveTo(lay.padL, Y(m)); g.lineTo(w, Y(m)); g.stroke(); text(g, `${m}`, lay.padL - 8, Y(m) + 3, '#5A5A55', 'right', 'alphabetic', MONO_S); }
      // tower
      if (st.height > 0) { g.fillStyle = '#1E1E1E'; g.strokeStyle = '#3A3A38'; g.fillRect(X(0) - 14, Y(st.height), 22, st.height * scale); g.strokeRect(X(0) - 14, Y(st.height), 22, st.height * scale); }
      // target
      if (target) {
        const tx = X(target.x);
        g.fillStyle = rgba(C.c4, 0.18); g.fillRect(X(target.x - target.tol), gy - 3, target.tol * 2 * scale, 6);
        g.strokeStyle = C.c4; g.lineWidth = 1.5; g.beginPath(); g.moveTo(tx, gy); g.lineTo(tx, gy - 30); g.stroke();
        g.fillStyle = C.c4; g.beginPath(); g.moveTo(tx, gy - 30); g.lineTo(tx + 14, gy - 25); g.lineTo(tx, gy - 20); g.fill();
        tag(g, `${target.x} m`, tx, gy - 40, C.c4, 'center');
      }
      // prediction
      if (st.preview && !target) {
        g.strokeStyle = 'rgba(245,245,240,.28)'; g.setLineDash([2, 5]); g.lineWidth = 1.2; g.beginPath();
        pred.pts.forEach((p, i) => { if (i % 4 && i !== pred.pts.length - 1) return; i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])); });
        g.stroke(); g.setLineDash([]);
      }
      // shots
      for (const s of shots) {
        const old = s !== flying;
        if (s === flying) {
          s.t += dt * s.speedup;
          if (s.t >= s.sim.time) { s.t = s.sim.time; flying = null; landed(s); }
        }
        const n = Math.min(s.sim.pts.length - 1, Math.floor(s.t / H));
        g.strokeStyle = rgba(s.color, old ? 0.45 : 0.95); g.lineWidth = old ? 1.2 : 2;
        g.beginPath();
        for (let i = 0; i <= n; i += 2) { const p = s.sim.pts[i]; i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])); }
        const p = s.sim.pts[n]; g.lineTo(X(p[0]), Y(p[1])); g.stroke();
        // time dots every 0.5 s on the live shot
        if (!old) {
          g.fillStyle = rgba(s.color, 0.8);
          const every = Math.round(0.5 / H);
          for (let i = 0; i <= n; i += every) { const q = s.sim.pts[i]; g.beginPath(); g.arc(X(q[0]), Y(q[1]), 2, 0, 7); g.fill(); }
        }
        g.fillStyle = s.color; g.beginPath(); g.arc(X(p[0]), Y(p[1]), old ? 3 : 6, 0, 7); g.fill();
        if (!old) {
          const vs = 3;
          arrow(g, X(p[0]), Y(p[1]), X(p[0]) + p[2] * vs, Y(p[1]), C.c5, 1.6, 7);
          arrow(g, X(p[0]), Y(p[1]), X(p[0]), Y(p[1]) - p[3] * vs, C.c4, 1.6, 7);
          arrow(g, X(p[0]), Y(p[1]), X(p[0]) + p[2] * vs, Y(p[1]) - p[3] * vs, C.text, 1.8, 8);
        }
      }
      // cannon
      const cx = X(0); const cy = Y(st.height); const a = st.angle * Math.PI / 180;
      g.save(); g.translate(cx, cy - 4); g.rotate(-a);
      g.fillStyle = '#3A3A38'; g.strokeStyle = C.text; g.lineWidth = 1.2;
      g.beginPath(); g.roundRect ? g.roundRect(-4, -6, 34, 12, 4) : g.rect(-4, -6, 34, 12); g.fill(); g.stroke();
      g.restore();
      g.fillStyle = '#1E1E1E'; g.strokeStyle = C.text; g.beginPath(); g.arc(cx, cy - 4, 8, 0, 7); g.fill(); g.stroke();
      g.strokeStyle = rgba(C.c2, 0.6); g.beginPath(); g.arc(cx, cy - 4, 46, 0, -a, true); g.stroke();
      tag(g, `${st.angle}°`, cx + 52 * Math.cos(a / 2), cy - 4 - 52 * Math.sin(a / 2), C.c2, 'left');
      // header text
      tag(g, `${W.name}  g = ${W.g} m/s²  ${st.drag && W.air ? 'with air' : 'no air'}`, 12, 14, C.muted, 'left');
      if (target) tag(g, `hits ${hits} of ${tries}`, w - 12, 14, C.c4, 'right');
      if (msgT > 0) { msgT -= dt; tag(g, msg, w / 2, 40, msg.startsWith('Hit') ? C.ok : C.text, 'center', 'middle', '600 14px "DM Mono", monospace'); }
      else if (!shots.length) tag(g, 'drag anywhere to aim, let go to fire', w / 2, 40, C.muted, 'center');
      if (flying) {
        const p = flying.sim.pts[Math.min(flying.sim.pts.length - 1, Math.floor(flying.t / H))];
        tag(g, `t ${fmt(p[4], 2)} s   vx ${fmt(p[2], 1)}   vy ${fmt(p[3], 1)} m/s`, 12, 30, C.text, 'left');
      }
    }
    function landed(s) {
      if (!target) return;
      const d = s.sim.range - target.x;
      if (Math.abs(d) <= target.tol) { hits++; msg = `Hit, ${fmt(s.sim.range, 1)} m`; msgT = 2.2; setTimeout(() => { if (!ctx.signal.aborted) newTarget(); }, 900); }
      else { msg = `${fmt(Math.abs(d), 1)} m ${d > 0 ? 'too far' : 'too short'}`; msgT = 2.2; }
    }
    ctx.loop((t, dt) => draw(dt));

    // panel
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Projectile motion</h2>'),
      ctx.h('<p class="lede">Anything thrown flies in a curve. The trick is that sideways and up-down motion are two separate stories happening at once.</p>'),
    );
    const upd = () => { pred = simulate(); refit(); readout(); };
    const sAngle = ctx.slider({ label: 'Launch angle', min: 0, max: 85, step: 1, value: st.angle, unit: '°', onInput: (v) => { st.angle = v; upd(); } });
    const sSpeed = ctx.slider({ label: 'Launch speed', min: 5, max: 60, step: 1, value: st.speed, unit: ' m/s', onInput: (v) => { st.speed = v; upd(); } });
    const sH = ctx.slider({ label: 'Launch height', min: 0, max: 40, step: 1, value: st.height, unit: ' m', onInput: (v) => { st.height = v; upd(); } });
    const wSeg = ctx.seg([['earth', 'Earth'], ['moon', 'Moon'], ['mars', 'Mars']], st.world, (v) => { st.world = v; shots = []; if (target) newTarget(); upd(); });
    const opts = ctx.h('<div class="row"><label class="check"><input type="checkbox"> air resistance</label><label class="check"><input type="checkbox" checked> show predicted path</label></div>');
    const [cDrag, cPrev] = opts.querySelectorAll('input');
    cDrag.onchange = () => { st.drag = cDrag.checked; upd(); };
    cPrev.onchange = () => { st.preview = cPrev.checked; };
    const btns = ctx.h('<div class="row"><button class="btn sm">Fire</button><button class="btn ghost sm">Target game</button><button class="btn ghost sm">Clear</button></div>');
    btns.children[0].onclick = fire;
    btns.children[1].onclick = () => { if (target) { target = null; btns.children[1].textContent = 'Target game'; refit(); } else { hits = 0; tries = 0; newTarget(); btns.children[1].textContent = 'End game'; } };
    btns.children[2].onclick = () => { shots = []; flying = null; refit(); };
    const out = ctx.h('<div class="stat"></div>');
    ctx.panel.append(sAngle, sSpeed, sH, wSeg, opts, btns, out);
    function readout(sim = pred) {
      out.innerHTML = [
        ['range', `${fmt(sim.range, 1)} m`], ['max height', `${fmt(sim.peak, 1)} m`], ['flight time', `${fmt(sim.time, 2)} s`],
        ['landing speed', `${fmt(sim.vland, 1)} m/s`], ['no-air formula', `${fmt(ideal(), 1)} m`],
      ].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
    }
    readout();

    ctx.panel.append(
      ctx.h(`<div class="card tip"><p>Once the ball leaves the cannon, the only thing pulling on it (without air) is gravity, and gravity only pulls <b>down</b>. So the sideways speed (blue arrow) never changes, while the vertical speed (rose arrow) drops by the same amount every second, goes to zero at the top, then grows downward.</p><p>The dots on the live path are half a second apart: evenly spaced sideways, bunched up near the top.</p></div>`),
      ctx.h(`<div class="card try"><ul>
        <li>With no air and zero height, fire at 30° and then at 60°. Same range. Complementary angles pair up.</li>
        <li>Find the angle with the longest range on flat ground. Then raise the launch height and find it again. It drops below 45°.</li>
        <li>Turn on air resistance and fire at 45° again. The path is no longer symmetric: it comes down steeper than it went up.</li>
        <li>Go to the Moon, same speed. Gravity is about one sixth, so the ball goes about six times as far.</li>
      </ul></div>`),
      ctx.h(`<div class="card deep">
        <div class="formula">x = v cos θ · t &nbsp; y = h + v sin θ · t − ½ g t²<span>no air: two independent motions</span></div>
        <div class="formula">R = v² sin 2θ / g<span>range on flat ground, no air, h = 0</span></div>
        <div class="formula">a = −g ŷ − k |v| v &nbsp; k = ρ C_d A / 2m<span>quadratic air drag, as simulated</span></div>
        <p class="small">The simulation steps the state (x, y, vₓ, v_y) forward 240 times per simulated second with fourth order Runge-Kutta, and finds the landing point by interpolating between the last two steps. Compare the range readout with the no-air formula: with air off they agree to the centimetre.</p>
        <p class="small muted">The ball is a light 20 cm, 1 kg ball, so drag matters a lot: its terminal speed in Earth air is about 33 m/s. Mars air is roughly 1 to 2 percent as dense as Earth's, so drag there is small, and the Moon has essentially none.</p>
      </div>`),
    );

    ctx.quiz([
      { q: 'With no air, what happens to the horizontal velocity of a projectile during flight?', choices: ['It decreases steadily', 'It stays the same', 'It is zero at the top'], answer: 1, why: 'Gravity acts only vertically, so nothing changes the horizontal velocity.' },
      { q: 'On flat ground with no air, which angle gives the same range as 20°?', choices: ['40°', '70°', '160°'], answer: 1, why: 'Range depends on sin 2θ, and sin 40° = sin 140°, so 20° and 70° give the same range.' },
      { q: 'At the very top of its path, a projectile has:', choices: ['zero velocity', 'only horizontal velocity', 'zero acceleration'], answer: 1, why: 'The vertical velocity is zero at the top, but it is still moving sideways, and gravity still accelerates it.' },
    ]);
  },
};
