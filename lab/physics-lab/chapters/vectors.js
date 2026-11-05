import { MONO, MONO_S, text, tag, arrow, pointer, fmt, rgba } from './_util.js';

// Vectors: drag the arrow tips on a grid. Add, subtract, or split into components.
export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas();
    const g = cv.ctx;
    let mode = 'add';
    let snap = true;
    const A = { x: 4, y: 1 };
    const B = { x: 1, y: 3 };
    let target = null; let wins = 0; let flash = 0;
    let drag = null; let hover = null;
    let unit = 40; let ox = 0; let oy = 0;

    cv.onResize((w, h) => {
      unit = Math.max(20, Math.min(58, Math.min(w / 15, h / 11)));
      ox = w / 2 - unit * 1.5; oy = h / 2 + unit * 1.5;
      if (w < 520) { ox = w / 2 - unit * 1; oy = h / 2 + unit * 2; }
    });
    const P = (v) => ({ x: ox + v.x * unit, y: oy - v.y * unit });
    const W = (p) => {
      let x = (p.x - ox) / unit; let y = (oy - p.y) / unit;
      if (snap) { x = Math.round(x * 2) / 2; y = Math.round(y * 2) / 2; }
      return { x, y };
    };
    const R = () => (mode === 'sub' ? { x: A.x - B.x, y: A.y - B.y } : { x: A.x + B.x, y: A.y + B.y });
    const mag = (v) => Math.hypot(v.x, v.y);
    const ang = (v) => { let a = Math.atan2(v.y, v.x) * 180 / Math.PI; if (a < 0) a += 360; return a; };

    function handles() {
      const bt = mode === 'add' ? { x: A.x + B.x, y: A.y + B.y } : B;
      return [['A', P(A)], ['B', P(bt)]];
    }
    function hit(p) {
      let best = null; let bd = 26;
      for (const [k, q] of handles()) { const d = Math.hypot(p.x - q.x, p.y - q.y); if (d < bd) { bd = d; best = k; } }
      return best;
    }

    pointer(cv.el, {
      down(p) { drag = hit(p); if (!drag) return false; },
      move(p) {
        const q = W(p);
        if (drag === 'A') { A.x = q.x; A.y = q.y; }
        if (drag === 'B') { if (mode === 'add') { B.x = q.x - A.x; B.y = q.y - A.y; } else { B.x = q.x; B.y = q.y; } }
        check(); readout();
      },
      up() { drag = null; },
      hover(p) { hover = p ? hit(p) : null; cv.el.style.cursor = hover ? 'grab' : 'default'; },
    }, ctx.signal);

    function check() {
      if (!target) return;
      const r = R();
      if (Math.hypot(r.x - target.x, r.y - target.y) < 0.26) { wins++; flash = 1.2; newTarget(); }
    }
    function newTarget() {
      let t;
      do { t = { x: Math.round((Math.random() * 10 - 4) * 2) / 2, y: Math.round((Math.random() * 7 - 3) * 2) / 2 }; } while (mag(t) < 2);
      target = t;
      readout();
    }

    function vec(from, v, color, label, lw = 2.4, dash) {
      const a = P(from); const b = P({ x: from.x + v.x, y: from.y + v.y });
      g.save(); if (dash) g.setLineDash(dash);
      arrow(g, a.x, a.y, b.x, b.y, color, lw, 11);
      g.restore();
      if (label) {
        const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2;
        const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const nx = -(b.y - a.y) / L; const ny = (b.x - a.x) / L;
        tag(g, label, mx + nx * 14, my + ny * 14, color, 'center', 'middle', '600 13px "DM Mono", monospace');
      }
    }

    function draw(dt) {
      const w = cv.w; const h = cv.h;
      g.clearRect(0, 0, w, h);
      // grid
      g.lineWidth = 1;
      const x0 = Math.floor(-ox / unit); const x1 = Math.ceil((w - ox) / unit);
      const y0 = Math.floor((oy - h) / unit); const y1 = Math.ceil(oy / unit);
      for (let i = x0; i <= x1; i++) { g.strokeStyle = i === 0 ? '#5A5A55' : 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(ox + i * unit, 0); g.lineTo(ox + i * unit, h); g.stroke(); }
      for (let j = y0; j <= y1; j++) { g.strokeStyle = j === 0 ? '#5A5A55' : 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(0, oy - j * unit); g.lineTo(w, oy - j * unit); g.stroke(); }
      text(g, 'x', w - 12, oy - 6, '#5A5A55', 'right', 'alphabetic', MONO_S);
      text(g, 'y', ox + 6, 14, '#5A5A55', 'left', 'alphabetic', MONO_S);
      for (let i = x0; i <= x1; i++) if (i && i % 2 === 0) text(g, `${i}`, ox + i * unit, oy + 13, '#5A5A55', 'center', 'alphabetic', MONO_S);
      for (let j = y0; j <= y1; j++) if (j && j % 2 === 0) text(g, `${j}`, ox - 6, oy - j * unit + 3, '#5A5A55', 'right', 'alphabetic', MONO_S);

      const O = { x: 0, y: 0 };
      const r = R();
      if (target) {
        g.save(); g.globalAlpha = 0.55; vec(O, target, C.c3, 'goal', 6, [2, 6]); g.restore();
      }
      if (mode === 'add') {
        // parallelogram
        g.save(); g.globalAlpha = 0.35; vec(O, B, C.c2, null, 1.4, [4, 4]); vec(B, A, C.c1, null, 1.4, [4, 4]); g.restore();
        vec(O, A, C.c1, 'A'); vec(A, B, C.c2, 'B');
        vec(O, r, C.text, 'A+B', 2.8);
      } else if (mode === 'sub') {
        vec(O, A, C.c1, 'A'); vec(O, B, C.c2, 'B');
        g.save(); g.globalAlpha = 0.6; vec(A, { x: -B.x, y: -B.y }, C.c2, '−B', 1.6, [5, 4]); g.restore();
        g.save(); g.globalAlpha = 0.35; vec(B, r, C.text, null, 1.4, [3, 4]); g.restore();
        vec(O, r, C.text, 'A−B', 2.8);
      } else {
        for (const [v, col, n] of [[A, C.c1, 'A'], [B, C.c2, 'B']]) {
          g.save(); g.globalAlpha = 0.8;
          vec(O, { x: v.x, y: 0 }, col, null, 1.6, [5, 4]);
          vec({ x: v.x, y: 0 }, { x: 0, y: v.y }, col, null, 1.6, [5, 4]);
          g.restore();
          const px = P({ x: v.x / 2, y: 0 }); const py = P({ x: v.x, y: v.y / 2 });
          tag(g, `${n}x = ${fmt(v.x, 1)}`, px.x, px.y + (v.y >= 0 ? 14 : -14), col, 'center');
          tag(g, `${n}y = ${fmt(v.y, 1)}`, py.x + (v.x >= 0 ? 8 : -8), py.y, col, v.x >= 0 ? 'left' : 'right');
          vec(O, v, col, n);
          // angle arc
          const a = Math.atan2(v.y, v.x);
          g.strokeStyle = rgba(col, 0.6); g.lineWidth = 1.2;
          const rr = unit * (n === 'A' ? 0.8 : 1.1);
          g.beginPath(); g.arc(ox, oy, rr, 0, -a, a > 0); g.stroke();
          tag(g, `${fmt(ang(v), 0)}°`, ox + Math.cos(a / 2) * (rr + 14), oy - Math.sin(a / 2) * (rr + 14), col, 'center');
        }
      }
      // handles
      for (const [k, q] of handles()) {
        g.fillStyle = k === 'A' ? C.c1 : C.c2;
        g.globalAlpha = drag === k || hover === k ? 0.35 : 0.16;
        g.beginPath(); g.arc(q.x, q.y, 15, 0, 7); g.fill(); g.globalAlpha = 1;
      }
      if (flash > 0) {
        flash -= dt;
        tag(g, `hit. ${wins} so far`, w / 2, 24, C.ok, 'center', 'middle', '600 15px "DM Mono", monospace');
      } else if (target) {
        tag(g, `make ${mode === 'sub' ? 'A−B' : 'A+B'} land on the dotted goal`, w / 2, 24, C.c3, 'center', 'middle');
      } else {
        tag(g, 'drag the arrow tips', w / 2, 24, C.muted, 'center', 'middle');
      }
    }
    ctx.loop((t, dt) => draw(dt));

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Vectors</h2>'),
      ctx.h('<p class="lede">Some quantities need a direction as well as a size. An arrow carries both.</p>'),
    );
    const seg = ctx.seg([['add', 'A + B'], ['sub', 'A − B'], ['comp', 'Components']], mode, (m) => { mode = m; if (m === 'comp') target = null; readout(); });
    ctx.panel.append(seg);
    const row = ctx.h('<div class="row"><label class="check"><input type="checkbox" checked> snap to grid</label><button class="btn sm">Goal game</button><button class="btn ghost sm">Reset</button></div>');
    row.querySelector('input').onchange = (e) => { snap = e.target.checked; };
    row.children[1].onclick = () => { if (mode === 'comp') { mode = 'add'; seg.set('add'); } newTarget(); };
    row.children[2].onclick = () => { A.x = 4; A.y = 1; B.x = 1; B.y = 3; target = null; readout(); };
    ctx.panel.append(row);
    const out = ctx.h('<div class="stat"></div>');
    ctx.panel.append(out);

    function readout() {
      const r = R();
      const dot = A.x * B.x + A.y * B.y;
      const between = mag(A) && mag(B) ? Math.acos(Math.max(-1, Math.min(1, dot / (mag(A) * mag(B))))) * 180 / Math.PI : 0;
      const items = [
        ['|A|', `${fmt(mag(A), 2)}`], ['angle A', `${fmt(ang(A), 0)}°`],
        ['|B|', `${fmt(mag(B), 2)}`], ['angle B', `${fmt(ang(B), 0)}°`],
      ];
      if (mode !== 'comp') items.push([mode === 'add' ? '|A+B|' : '|A−B|', fmt(mag(r), 2)], [mode === 'add' ? 'A+B' : 'A−B', `(${fmt(r.x, 1)}, ${fmt(r.y, 1)})`]);
      else items.push(['A·B', fmt(dot, 2)], ['angle between', `${fmt(between, 0)}°`]);
      out.innerHTML = items.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
    }
    readout();

    ctx.panel.append(
      ctx.h(`<div class="card tip"><p>A <b>vector</b> is an arrow: its length is the size (like 5 m/s) and it points in a direction. Speed is just a number, velocity is a vector.</p><p>To <b>add</b> two vectors, put the tail of the second on the tip of the first. The sum goes from the start to the end. To <b>subtract</b>, add the reversed arrow.</p><p>Any arrow can be split into an <b>x part</b> and a <b>y part</b>. Physics problems get easy when you handle each part separately.</p></div>`),
      ctx.h(`<div class="card try"><ul>
        <li>Drag B's tip so it points the opposite way to A. The sum shrinks. Make them equal and opposite and the sum is zero, like balanced forces.</li>
        <li>Put A along x and B along y. The sum is the long side of a right triangle: |A+B|² = |A|² + |B|².</li>
        <li>Switch to <b>A − B</b>. Notice A − B is the arrow from B's tip to A's tip.</li>
        <li>Play the <b>goal game</b>: move only one arrow to hit each target.</li>
      </ul></div>`),
      ctx.h(`<div class="card deep">
        <div class="formula">Aₓ = |A| cos θ &nbsp; A_y = |A| sin θ<span>components from size and angle</span></div>
        <div class="formula">|A| = √(Aₓ² + A_y²) &nbsp; θ = atan2(A_y, Aₓ)<span>size and angle from components</span></div>
        <div class="formula">A + B = (Aₓ+Bₓ, A_y+B_y)<span>add component by component</span></div>
        <p class="small">The dot product A·B = AₓBₓ + A_yB_y = |A||B| cos φ measures how much two arrows point the same way. It is zero when they are perpendicular, which is why a force at right angles to motion does no work.</p>
        <p class="small muted">Vectors used in mechanics: displacement, velocity, acceleration, force, momentum. Scalars: distance, speed, mass, time, energy.</p>
      </div>`),
    );

    ctx.quiz([
      { q: 'A walker goes 3 m east then 4 m north. How far are they from the start?', choices: ['7 m', '5 m', '1 m'], answer: 1, why: 'The displacements are at right angles, so the size of the sum is √(3² + 4²) = 5 m.' },
      { q: 'Which of these is a vector?', choices: ['Speed', 'Mass', 'Force'], answer: 2, why: 'A force has a size and a direction. Speed and mass have only a size.' },
      { q: 'A vector of size 10 points 30° above the x axis. What is its x component?', choices: ['10 × sin 30° = 5', '10 × cos 30° ≈ 8.7', '10 × tan 30° ≈ 5.8'], answer: 1, why: 'The x component is the size times the cosine of the angle from the x axis.' },
    ]);
  },
};
