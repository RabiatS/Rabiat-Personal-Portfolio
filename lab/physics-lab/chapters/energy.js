import { MONO, MONO_S, chart, text, tag, pointer, stepper, fmt, rgba, clamp, rrect } from './_util.js';

// Energy skate park: a bead on a reshapeable spline track, stepped with semi-implicit Euler.
const G = 9.81;
const H = 1 / 1000;
const SHAPES = {
  valley: [[0, 6.2], [2, 3.2], [4, 1.0], [6, 0.5], [8, 1.0], [10, 3.2], [12, 6.2]],
  hills: [[0, 6.0], [2, 1.0], [4, 3.6], [6, 0.6], [8, 2.6], [10, 1.0], [12, 6.0]],
  ramp: [[0, 6.5], [2, 3.0], [4, 0.8], [6, 0.4], [8, 0.4], [10, 0.6], [12, 4.0]],
};

export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas();
    const g = cv.ctx;
    let pts = SHAPES.valley.map((p) => [...p]);
    let path = []; let total = 0;
    const st = { m: 50, mu: 0, bar: true };
    let s = 0; let v = 0; let th = 0; let held = false; let dragPt = -1; let hover = -1;
    let hist = []; let t = 0;
    const lay = {};

    function build() {
      // Catmull-Rom through the control points, sampled densely, with cumulative arc length.
      path = [];
      const P = [pts[0], ...pts, pts[pts.length - 1]];
      for (let i = 1; i < P.length - 2; i++) {
        const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
        for (let k = 0; k < 80; k++) {
          const u = k / 80; const u2 = u * u; const u3 = u2 * u;
          const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
          path.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]) });
        }
      }
      const last = pts[pts.length - 1]; path.push({ x: last[0], y: last[1] });
      let acc = 0; path[0].s = 0;
      for (let i = 1; i < path.length; i++) { acc += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y); path[i].s = acc; }
      total = acc;
      // unit tangent and curvature (signed, positive where the track curves upward)
      for (let i = 0; i < path.length; i++) {
        const a = path[Math.max(0, i - 1)]; const b = path[Math.min(path.length - 1, i + 1)];
        const ds = b.s - a.s || 1e-6;
        path[i].tx = (b.x - a.x) / ds; path[i].ty = (b.y - a.y) / ds;
      }
      for (let i = 0; i < path.length; i++) {
        const a = path[Math.max(0, i - 2)]; const b = path[Math.min(path.length - 1, i + 2)];
        const ds = b.s - a.s || 1e-6;
        path[i].k = (a.tx * b.ty - a.ty * b.tx) / ds;
      }
    }
    function at(sv) {
      sv = clamp(sv, 0, total);
      let lo = 0; let hi = path.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (path[mid].s <= sv) lo = mid; else hi = mid; }
      const a = path[lo]; const b = path[hi]; const u = (sv - a.s) / ((b.s - a.s) || 1);
      return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, tx: a.tx + (b.tx - a.tx) * u, ty: a.ty + (b.ty - a.ty) * u, k: a.k + (b.k - a.k) * u };
    }
    build();
    s = 0.6;

    cv.onResize((w, h) => {
      lay.chartH = Math.max(80, Math.min(140, h * 0.2));
      const top = 54; const bottom = h - lay.chartH - 34;
      const narrow = w < 560;
      lay.barsW = narrow ? 0 : 170;
      const usableW = w - 64 - lay.barsW;
      lay.sc = Math.min(usableW / 12, (bottom - top) / 7);
      lay.ox = 48 + (usableW - 12 * lay.sc) / 2; lay.oy = bottom;
      lay.chart = { x: 2, y: h - lay.chartH - 2, w: w - 4, h: lay.chartH };
      lay.narrow = narrow;
    });
    const X = (x) => lay.ox + x * lay.sc;
    const Y = (y) => lay.oy - y * lay.sc;

    const energies = () => {
      const p = at(s);
      return { ke: 0.5 * st.m * v * v, pe: st.m * G * p.y, th };
    };

    const stepper1 = stepper(H, 120);
    function physics(h) {
      if (held || dragPt >= 0) return;
      const p = at(s);
      const dyds = p.ty; const cos = Math.abs(p.tx);
      // normal force per unit mass: gravity's perpendicular part plus the centripetal need (bead on a wire, so it can be either side)
      const N = Math.abs(G * cos + v * v * p.k);
      const fr = st.mu * N;
      let acc = -G * dyds;
      if (Math.abs(v) < 0.03 && Math.abs(acc) <= fr) { v = 0; return; }
      const dir = Math.abs(v) < 0.03 ? Math.sign(acc) : Math.sign(v);
      acc -= dir * fr;
      const vn = v + acc * h;
      if (st.mu > 0 && Math.sign(vn) !== Math.sign(v) && Math.abs(v) > 0 && Math.abs(-G * dyds) <= fr) { th += 0.5 * st.m * v * v; v = 0; return; }
      v = vn;
      const ds = v * h;
      s += ds;
      th += st.m * fr * Math.abs(ds);
      if (s < 0) { s = -s; v = -v; }
      if (s > total) { s = 2 * total - s; v = -v; }
      t += h;
    }

    function nearestS(px, py) {
      let best = 0; let bd = Infinity;
      for (const q of path) { const d = (X(q.x) - px) ** 2 + (Y(q.y) - py) ** 2; if (d < bd) { bd = d; best = q.s; } }
      return { s: best, d: Math.sqrt(bd) };
    }
    function hitPt(p) { let k = -1; let bd = 22; pts.forEach((q, i) => { const d = Math.hypot(X(q[0]) - p.x, Y(q[1]) - p.y); if (d < bd) { bd = d; k = i; } }); return k; }

    pointer(cv.el, {
      down(p) {
        const sk = at(s);
        if (Math.hypot(X(sk.x) - p.x, Y(sk.y) - 12 - p.y) < 26) { held = true; return; }
        const k = hitPt(p);
        if (k >= 0) { dragPt = k; return; }
        const n = nearestS(p.x, p.y);
        if (n.d < 30) { held = true; s = n.s; v = 0; th = 0; hist = []; return; }
        return false;
      },
      move(p) {
        if (held) { s = nearestS(p.x, p.y).s; v = 0; th = 0; hist = []; }
        if (dragPt >= 0) {
          const i = dragPt; const q = pts[i];
          q[1] = clamp((lay.oy - p.y) / lay.sc, 0.2, 7);
          if (i > 0 && i < pts.length - 1) q[0] = clamp((p.x - lay.ox) / lay.sc, pts[i - 1][0] + 0.6, pts[i + 1][0] - 0.6);
          const frac = s / total; build(); s = frac * total; v = 0; th = 0; hist = [];
        }
      },
      up() { held = false; dragPt = -1; },
      hover(p) { hover = p ? hitPt(p) : -1; cv.el.style.cursor = hover >= 0 ? 'grab' : 'default'; },
    }, ctx.signal);

    function draw() {
      const w = cv.w; const h = cv.h;
      g.clearRect(0, 0, w, h);
      // ground and height grid
      g.strokeStyle = '#3A3A38'; g.lineWidth = 1; g.beginPath(); g.moveTo(X(0) - 10, Y(0)); g.lineTo(X(12) + 10, Y(0)); g.stroke();
      for (let m = 1; m <= 7; m++) { g.strokeStyle = 'rgba(255,255,255,.04)'; g.beginPath(); g.moveTo(X(0), Y(m)); g.lineTo(X(12), Y(m)); g.stroke(); text(g, `${m} m`, X(0) - 6, Y(m) + 3, '#5A5A55', 'right', 'alphabetic', MONO_S); }
      // track
      g.strokeStyle = '#5A5A55'; g.lineWidth = 5; g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath(); path.forEach((q, i) => (i ? g.lineTo(X(q.x), Y(q.y)) : g.moveTo(X(q.x), Y(q.y)))); g.stroke();
      g.strokeStyle = C.text; g.lineWidth = 1.5; g.stroke();
      // control points
      pts.forEach((q, i) => {
        g.fillStyle = i === dragPt || i === hover ? rgba(C.c3, 0.5) : rgba(C.c3, 0.18);
        g.strokeStyle = C.c3; g.lineWidth = 1.2;
        g.beginPath(); g.arc(X(q[0]), Y(q[1]), 8, 0, 7); g.fill(); g.stroke();
      });
      // reachable height line for the current energy
      const e = energies();
      const Etot = e.ke + e.pe + e.th;
      const hMax = (e.ke + e.pe) / (st.m * G);
      if (hMax < 7.5) { g.strokeStyle = rgba(C.c1, 0.35); g.setLineDash([4, 5]); g.beginPath(); g.moveTo(X(0), Y(hMax)); g.lineTo(X(12), Y(hMax)); g.stroke(); g.setLineDash([]); tag(g, 'max height with this energy', X(12), Y(hMax) - 9, rgba(C.c1, 0.8), 'right', 'middle', MONO_S); }
      // skater
      const p = at(s);
      const nx = -p.ty; const ny = p.tx; // normal pointing up-ish
      const sx = X(p.x + nx * 0.18); const sy = Y(p.y + ny * 0.18);
      g.fillStyle = held ? C.c2 : rgba(C.c2, 0.9); g.beginPath(); g.arc(sx, sy, 10, 0, 7); g.fill();
      g.strokeStyle = '#0A0A0A'; g.lineWidth = 2; g.beginPath(); g.moveTo(sx - 5, sy); g.lineTo(sx + 5, sy); g.stroke();
      // bars
      const bars = [['KE', e.ke, C.c1], ['PE', e.pe, C.c3], ['Thermal', e.th, C.c4], ['Total', Etot, C.text]];
      const emax = Math.max(st.m * G * 7, Etot) * 1.05;
      if (!lay.narrow) {
        const bx = w - lay.barsW + 6; const by0 = 60; const bh = Math.min(260, lay.oy - by0 - 20); const bw = 28; const gap = 12;
        text(g, 'energy (J)', bx, by0 - 10, C.muted, 'left', 'alphabetic', MONO_S);
        bars.forEach(([n, val, col], i) => {
          const x0 = bx + i * (bw + gap); const hh = (val / emax) * bh;
          g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x0, by0, bw, bh);
          g.fillStyle = rgba(col, 0.85); g.fillRect(x0, by0 + bh - hh, bw, hh);
          text(g, n === 'Thermal' ? 'Th' : n === 'Total' ? 'Tot' : n, x0 + bw / 2, by0 + bh + 14, col, 'center', 'alphabetic', MONO_S);
          text(g, fmt(val, 0), x0 + bw / 2, by0 + bh - hh - 5, col, 'center', 'alphabetic', MONO_S);
        });
      } else {
        // compact horizontal bars for phones
        const bx = 10; const bw = w - 20; const by0 = 8;
        bars.forEach(([n, val, col], i) => {
          const y0 = by0 + i * 11;
          g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(bx + 44, y0, bw - 90, 7);
          g.fillStyle = rgba(col, 0.85); g.fillRect(bx + 44, y0, (bw - 90) * (val / emax), 7);
          text(g, n === 'Thermal' ? 'Th' : n, bx, y0 + 7, col, 'left', 'alphabetic', MONO_S);
          text(g, `${fmt(val, 0)} J`, bx + bw, y0 + 7, col, 'right', 'alphabetic', MONO_S);
        });
      }
      if (!lay.narrow) tag(g, `speed ${fmt(Math.abs(v), 2)} m/s   height ${fmt(p.y, 2)} m`, 14, 18, C.text, 'left');
      else tag(g, `${fmt(Math.abs(v), 1)} m/s  h ${fmt(p.y, 1)} m`, w - 10, 60, C.text, 'right');
      if (!lay.narrow) tag(g, 'drag the violet points to reshape, drag the skater to drop it anywhere', 14, 36, C.muted, 'left');
      // energy vs time chart
      const tw = 8;
      chart(g, lay.chart, [
        { data: hist.map((q) => [q[0], q[1]]), color: C.c1 },
        { data: hist.map((q) => [q[0], q[2]]), color: C.c3 },
        { data: hist.map((q) => [q[0], q[3]]), color: C.c4 },
        { data: hist.map((q) => [q[0], q[1] + q[2] + q[3]]), color: C.text, dash: [3, 3], width: 1.2 },
      ], { xmin: Math.max(0, t - tw), xmax: Math.max(tw, t), ymin: 0, ymax: emax, title: 'energy over time', yd: 0 });
    }
    let sample = 0;
    ctx.loop((tt, dt) => {
      stepper1(dt, physics);
      sample += dt;
      if (sample > 1 / 30) { sample = 0; const e = energies(); hist.push([t, e.ke, e.pe, e.th]); while (hist.length && hist[0][0] < t - 8) hist.shift(); }
      draw();
    });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Energy</h2>'),
      ctx.h('<p class="lede">Energy is never used up, only moved around. Watch it slosh between height and speed as a skater rides a track you design.</p>'),
      ctx.h('<div class="legend"><span><i style="background:var(--c1)"></i>kinetic (speed)</span><span><i style="background:var(--c3)"></i>potential (height)</span><span><i style="background:var(--c4)"></i>thermal (friction)</span></div>'),
    );
    const sMu = ctx.slider({ label: 'Friction μ', min: 0, max: 0.3, step: 0.005, value: 0, fmt: (q) => q.toFixed(3), onInput: (q) => { st.mu = q; } });
    const sM = ctx.slider({ label: 'Skater mass', min: 20, max: 100, step: 5, value: st.m, unit: ' kg', onInput: (q) => { const r = q / st.m; st.m = q; th *= r; } });
    const shape = ctx.seg([['valley', 'Valley'], ['hills', 'Hills'], ['ramp', 'Ramp']], 'valley', (k) => { pts = SHAPES[k].map((p) => [...p]); build(); s = 0.6; v = 0; th = 0; hist = []; });
    const row = ctx.h('<div class="row"><button class="btn sm">Restart from the top</button></div>');
    row.children[0].onclick = () => { s = 0.6; v = 0; th = 0; hist = []; };
    ctx.panel.append(shape, sMu, sM, row);

    ctx.panel.append(
      ctx.h(`<div class="card tip"><p>High up, the skater has <b>potential energy</b>: gravity is ready to speed it up. Moving fast, it has <b>kinetic energy</b>. Rolling down a hill turns one into the other, and rolling up turns it back.</p><p>Friction turns some energy into <b>thermal energy</b> (the track and wheels warm up a tiny bit). That energy does not come back as motion, so with friction the skater never gets as high again. The total bar stays the same height the whole time.</p></div>`),
      ctx.h(`<div class="card try"><ul>
        <li>With no friction, drop the skater from a height and watch it reach the dotted line on the other side, never higher.</li>
        <li>Drag a middle point up above the starting height. The skater cannot get over it and rolls back.</li>
        <li>Add friction (0.05) and watch thermal energy creep up while the swings shrink, until it settles at the bottom.</li>
        <li>Change the mass. Every bar scales, but the motion is identical. Mass cancels out.</li>
      </ul></div>`),
      ctx.h(`<div class="card deep">
        <div class="formula">KE = ½ m v² &nbsp; PE = m g h<span>h measured from the ground line</span></div>
        <div class="formula">KE + PE + E_thermal = constant<span>conservation of energy</span></div>
        <div class="formula">v = √(2 g Δh)<span>speed after dropping Δh with no friction, for any track shape</span></div>
        <p class="small">The skater is treated as a bead on a wire, moving along the track's arc length s. Gravity's component along the track drives it, and friction is μ times the normal force, which includes the extra push needed to curve the path (v²κ, where κ is the curvature). That is why friction bites harder at the bottom of a tight valley.</p>
        <p class="small muted">A real skater on a curved bump can fly off when the track would need to pull down on them. The bead model ignores that, like a roller coaster locked to its rail. Steps are 1 ms of simulated time using semi-implicit Euler.</p>
      </div>`),
    );

    ctx.quiz([
      { q: 'With no friction, a skater starts at rest 5 m above the lowest point. How fast is it going at the bottom?', choices: ['About 5 m/s', 'About 10 m/s', 'It depends on the mass'], answer: 1, why: 'v = √(2 g h) = √(2 × 9.81 × 5) ≈ 9.9 m/s, whatever the mass or the shape of the track.' },
      { q: 'Where does a frictionless skater have the most kinetic energy?', choices: ['At the highest point', 'At the lowest point', 'It is the same everywhere'], answer: 1, why: 'The lowest point has the least potential energy, so the most of the fixed total is kinetic.' },
      { q: 'With friction on, what happens to the total of kinetic + potential energy?', choices: ['It stays the same', 'It slowly decreases as thermal energy grows', 'It grows'], answer: 1, why: 'Friction moves energy into thermal energy. The grand total including thermal stays constant.' },
    ]);
  },
};
