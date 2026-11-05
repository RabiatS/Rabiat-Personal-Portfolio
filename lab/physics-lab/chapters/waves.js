import { MONO, MONO_S, chart, text, tag, pointer, fmt, rgba, clamp } from './_util.js';

// Waves: a 1D string solved with the leapfrog finite difference wave equation (absorbing, fixed or free far end),
// and a 2D ripple tank on a 200 x 150 grid with a damping sponge at the edges.
const N = 300; const LEN = 6; const DX = LEN / N; const DT = 0.004;
const NX = 240; const NY = 180; const TANK_DT = 1 / 240; const TANK_C = 0.5; // cells per step (Courant 0.5)
const MM = 1; // one tank cell is 1 mm

export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas();
    const g = cv.ctx;
    let mode = 'rope';
    const st = { c: 2, f: 1, A: 0.12, end: 'open', drive: true, tf: 6, sep: 40, two: true, avg: false, nodal: false };
    // 1D state
    let u = new Float64Array(N + 1); let up = new Float64Array(N + 1); let un = new Float64Array(N + 1);
    let t = 0; let pulseT = -1; let probe = [];
    // 2D state
    let a = new Float32Array(NX * NY); let ap = new Float32Array(NX * NY); let an = new Float32Array(NX * NY);
    const I = new Float32Array(NX * NY);
    const damp = new Float32Array(NX * NY);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const d = Math.min(i, j, NX - 1 - i, NY - 1 - j);
      damp[j * NX + i] = d < 34 ? 0.25 * ((34 - d) / 34) ** 2 : 0; // sponge strength σ
    }
    let tt2 = 0;
    const off = document.createElement('canvas'); off.width = NX; off.height = NY;
    const og = off.getContext('2d'); const img = og.createImageData(NX, NY);
    let hoverP = null;
    const lay = {};

    cv.onResize((w, h) => {
      lay.ropeY = h * 0.25; lay.longY = h * 0.58; lay.longH = Math.min(70, h * 0.14);
      lay.chart = { x: 2, y: h * 0.74, w: w - 4, h: h * 0.26 - 2 };
      lay.px = (w - 40) / LEN; lay.x0 = 20;
      const s = Math.min((w - 8) / NX, (h - 34) / NY);
      lay.ts = s; lay.tx = (w - NX * s) / 2; lay.ty = 26 + (h - 34 - NY * s) / 2;
    });

    // 1D wave equation step
    function stepRope() {
      const r2 = (st.c * DT / DX) ** 2;
      for (let i = 1; i < N; i++) un[i] = 2 * u[i] - up[i] + r2 * (u[i + 1] - 2 * u[i] + u[i - 1]);
      t += DT;
      let src = 0;
      if (st.drive) src = st.A * Math.sin(2 * Math.PI * st.f * t) * Math.min(1, t * st.f);
      if (pulseT >= 0) { const q = (t - pulseT - 0.25) / 0.08; src += st.A * 1.5 * Math.exp(-q * q); if (t - pulseT > 0.6) pulseT = -1; }
      un[0] = src;
      if (st.end === 'fixed') un[N] = 0;
      else if (st.end === 'free') un[N] = un[N - 1];
      else { const k = (st.c * DT - DX) / (st.c * DT + DX); un[N] = u[N - 1] + k * (un[N - 1] - u[N]); } // Mur absorbing boundary
      const tmp = up; up = u; u = un; un = tmp;
    }

    function srcs() {
      const sx = 52; const cy = NY / 2;
      return st.two ? [[sx, Math.round(cy - st.sep / 2)], [sx, Math.round(cy + st.sep / 2)]] : [[sx, Math.round(cy)]];
    }
    function stepTank() {
      const c2 = TANK_C * TANK_C;
      for (let j = 1; j < NY - 1; j++) {
        const row = j * NX;
        for (let i = 1; i < NX - 1; i++) {
          const k = row + i;
          an[k] = a[k] + (1 - damp[k]) * (a[k] - ap[k]) + c2 * (a[k + 1] + a[k - 1] + a[k + NX] + a[k - NX] - 4 * a[k]);
        }
      }
      tt2 += TANK_DT;
      const v = Math.sin(2 * Math.PI * st.tf * tt2) * Math.min(1, tt2 * 2);
      for (const [i, j] of srcs()) an[j * NX + i] = v;
      const tmp = ap; ap = a; a = an; an = tmp;
      for (let k = 0; k < a.length; k++) I[k] += (a[k] * a[k] - I[k]) * 0.01;
    }
    const lambdaMM = () => (TANK_C * MM / TANK_DT) / st.tf; // c in mm/s over f

    function resetTank() { a.fill(0); ap.fill(0); an.fill(0); I.fill(0); tt2 = 0; }

    pointer(cv.el, {
      down(p) { if (mode !== 'tank') return false; hoverP = p; },
      move(p) { hoverP = p; },
      hover(p) { hoverP = p; },
    }, ctx.signal);

    function drawRope() {
      const w = cv.w; const h = cv.h;
      const X = (i) => lay.x0 + i * DX * lay.px;
      const ys = Math.min(lay.px, h * 0.18 / 0.3);
      // transverse
      text(g, 'transverse: each bit of rope moves up and down', 12, 18, C.muted, 'left', 'alphabetic', MONO_S);
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(X(0), lay.ropeY); g.lineTo(X(N), lay.ropeY); g.stroke();
      g.strokeStyle = C.c1; g.lineWidth = 2; g.beginPath();
      for (let i = 0; i <= N; i++) { const y = lay.ropeY - u[i] * ys; i ? g.lineTo(X(i), y) : g.moveTo(X(i), y); }
      g.stroke();
      const mk = 100;
      g.fillStyle = C.c4; g.beginPath(); g.arc(X(mk), lay.ropeY - u[mk] * ys, 5, 0, 7); g.fill();
      // driver and end
      g.fillStyle = C.c2; g.fillRect(X(0) - 6, lay.ropeY - u[0] * ys - 10, 6, 20);
      if (st.end === 'fixed') { g.fillStyle = '#5A5A55'; g.fillRect(X(N), lay.ropeY - 18, 4, 36); }
      if (st.end === 'free') { g.strokeStyle = '#5A5A55'; g.beginPath(); g.moveTo(X(N) + 4, lay.ropeY - 30); g.lineTo(X(N) + 4, lay.ropeY + 30); g.stroke(); g.fillStyle = '#A0A09A'; g.beginPath(); g.arc(X(N) + 4, lay.ropeY - u[N] * ys, 3, 0, 7); g.fill(); }
      if (st.end === 'open') { g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(X(N) - 8, lay.ropeY - 40, 14, 80); }
      // wavelength bracket
      const lam = st.c / st.f;
      if (st.drive && lam < LEN * 0.8) {
        const x0 = X(Math.round(1 / DX)); const x1 = x0 + lam * lay.px; const yb = lay.ropeY + st.A * ys + 18;
        g.strokeStyle = C.c2; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, yb - 4); g.lineTo(x0, yb); g.lineTo(x1, yb); g.lineTo(x1, yb - 4); g.stroke();
        tag(g, `λ = v/f = ${fmt(lam, 2)} m`, (x0 + x1) / 2, yb + 10, C.c2, 'center');
      }
      // longitudinal
      text(g, 'longitudinal: the same wave, but each particle moves along the direction of travel', 12, lay.longY - lay.longH / 2 - 10, C.muted, 'left', 'alphabetic', MONO_S);
      const rows = 7;
      const lf = Math.min(0.6, 0.7 / Math.max(1e-6, st.A * 2 * Math.PI * st.f / st.c));
      for (let i = 0; i <= N; i += 3) {
        const x = X(i) + u[i] * lay.px * lf;
        for (let r = 0; r < rows; r++) {
          const y = lay.longY - lay.longH / 2 + (r + 0.5) * (lay.longH / rows);
          g.fillStyle = i === mk + 2 && r === 3 ? C.c4 : 'rgba(245,245,240,.6)';
          g.fillRect(x - 1, y - 1, i === mk + 2 && r === 3 ? 4 : 2, i === mk + 2 && r === 3 ? 4 : 2);
        }
      }
      chart(g, lay.chart, [{ data: probe, color: C.c4, dot: true }], { xmin: Math.max(0, t - 6), xmax: Math.max(6, t), ymin: -0.42, ymax: 0.42, title: 'the rose particle: displacement (m) vs time', titleColor: C.c4, yd: 1, xstep: 1 });
    }

    function drawTank() {
      const d = img.data;
      const lam = lambdaMM();
      const S = srcs();
      for (let k = 0, p = 0; k < a.length; k++, p += 4) {
        let r; let gg; let b;
        if (st.avg) {
          const v = Math.min(1, Math.sqrt(I[k]) * 2.2);
          r = 20 + 220 * v * 0.37; gg = 20 + 214 * v; b = 20 + 192 * v;
        } else {
          const v = (0.5 + 0.5 * clamp(a[k] * 2.2, -1, 1)) ** 1.6;
          r = 7 + 152 * v; gg = 16 + 229 * v; b = 21 + 209 * v;
        }
        if (st.nodal && S.length === 2) {
          const i = k % NX; const j = (k - i) / NX;
          const dd = Math.abs(Math.hypot(i - S[0][0], j - S[0][1]) - Math.hypot(i - S[1][0], j - S[1][1])) / lam;
          const fr = dd - Math.floor(dd);
          if (Math.abs(fr - 0.5) < 0.03 && i > S[0][0]) { r = 251; gg = 113; b = 133; }
        }
        d[p] = r; d[p + 1] = gg; d[p + 2] = b; d[p + 3] = 255;
      }
      og.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(off, lay.tx, lay.ty, NX * lay.ts, NY * lay.ts);
      for (const [i, j] of S) { g.strokeStyle = C.c2; g.lineWidth = 2; g.beginPath(); g.arc(lay.tx + (i + 0.5) * lay.ts, lay.ty + (j + 0.5) * lay.ts, 5, 0, 7); g.stroke(); }
      // scale bar 10 mm
      const sb = 20 * lay.ts; // 20 cells = 2 cm
      g.strokeStyle = C.muted; g.lineWidth = 1; g.beginPath(); g.moveTo(lay.tx + 8, lay.ty + NY * lay.ts - 10); g.lineTo(lay.tx + 8 + sb, lay.ty + NY * lay.ts - 10); g.stroke();
      tag(g, '2 cm', lay.tx + 8 + sb + 6, lay.ty + NY * lay.ts - 10, C.muted, 'left', 'middle', MONO_S);
      tag(g, `f ${st.tf} Hz   λ ${fmt(lam / 10, 2)} cm   wave speed ${fmt((TANK_C * MM / TANK_DT) / 10, 0)} cm/s`, 12, 12, C.text, 'left');
      // probe
      if (hoverP && S.length === 2) {
        const i = (hoverP.x - lay.tx) / lay.ts; const j = (hoverP.y - lay.ty) / lay.ts;
        if (i > 0 && j > 0 && i < NX && j < NY) {
          const r1 = Math.hypot(i - S[0][0], j - S[0][1]); const r2 = Math.hypot(i - S[1][0], j - S[1][1]);
          const dl = Math.abs(r1 - r2) / lam; const fr = dl - Math.floor(dl);
          const kind = fr < 0.15 || fr > 0.85 ? 'constructive (crest meets crest)' : Math.abs(fr - 0.5) < 0.15 ? 'destructive (crest meets trough)' : 'in between';
          g.strokeStyle = 'rgba(245,245,240,.35)'; g.setLineDash([3, 3]); g.lineWidth = 1;
          for (const [si, sj] of S) { g.beginPath(); g.moveTo(lay.tx + si * lay.ts, lay.ty + sj * lay.ts); g.lineTo(hoverP.x, hoverP.y); g.stroke(); }
          g.setLineDash([]);
          tag(g, `path difference ${fmt(dl, 2)} λ: ${kind}`, clamp(hoverP.x, 120, cv.w - 120), hoverP.y - 16, C.text, 'center');
        }
      }
    }

    let acc = 0;
    ctx.loop((now, dt) => {
      g.clearRect(0, 0, cv.w, cv.h);
      if (mode === 'rope') {
        acc += dt; let n = 0;
        while (acc >= DT && n < 50) { stepRope(); acc -= DT; n++; }
        probe.push([t, u[100]]); while (probe.length && probe[0][0] < t - 6) probe.shift();
        drawRope();
      } else {
        acc += dt; let n = 0;
        while (acc >= TANK_DT && n < 8) { stepTank(); acc -= TANK_DT; n++; }
        if (n >= 8) acc = 0;
        drawTank();
      }
    });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Waves</h2>'),
      ctx.h('<p class="lede">A wave carries energy from place to place while the stuff it travels through only wobbles where it is.</p>'),
    );
    const seg = ctx.seg([['rope', 'Rope and sound'], ['tank', 'Ripple tank']], mode, (m) => { mode = m; acc = 0; controls(); if (m === 'tank') resetTank(); });
    ctx.panel.append(seg);
    const ctl = ctx.h('<div style="display:grid;gap:10px"></div>');
    ctx.panel.append(ctl);
    const out = ctx.h('<div class="stat"></div>');
    ctx.panel.append(out);
    function ropeStats() { out.innerHTML = [['speed v', `${fmt(st.c, 2)} m/s`], ['frequency f', `${fmt(st.f, 2)} Hz`], ['wavelength λ', `${fmt(st.c / st.f, 2)} m`], ['period T', `${fmt(1 / st.f, 2)} s`]].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join(''); }
    function controls() {
      ctl.innerHTML = '';
      if (mode === 'rope') {
        ctl.append(
          ctx.slider({ label: 'Frequency f', min: 0.2, max: 3, step: 0.05, value: st.f, unit: ' Hz', onInput: (q) => { st.f = q; ropeStats(); } }),
          ctx.slider({ label: 'Wave speed v (tension)', min: 0.5, max: 4, step: 0.1, value: st.c, unit: ' m/s', onInput: (q) => { st.c = q; ropeStats(); } }),
          ctx.slider({ label: 'Amplitude', min: 0.02, max: 0.2, step: 0.01, value: st.A, fmt: (q) => `${Math.round(q * 100)} cm`, onInput: (q) => { st.A = q; } }),
          ctx.seg([['open', 'Far end: absorbing'], ['fixed', 'Fixed'], ['free', 'Free']], st.end, (q) => { st.end = q; }),
        );
        const row = ctx.h('<div class="row"><label class="check"><input type="checkbox" checked> keep shaking</label><button class="btn sm">Send a pulse</button><button class="btn ghost sm">Calm</button></div>');
        row.querySelector('input').onchange = (e) => { st.drive = e.target.checked; };
        row.children[1].onclick = () => { pulseT = t; };
        row.children[2].onclick = () => { u.fill(0); up.fill(0); un.fill(0); };
        ctl.append(row);
        ropeStats();
      } else {
        ctl.append(
          ctx.slider({ label: 'Frequency', min: 3, max: 12, step: 0.5, value: st.tf, unit: ' Hz', onInput: (q) => { st.tf = q; } }),
          ctx.slider({ label: 'Source separation', min: 10, max: 80, step: 2, value: st.sep, fmt: (q) => `${(q / 10).toFixed(1)} cm`, onInput: (q) => { st.sep = q; } }),
          ctx.seg([[true, 'Two sources'], [false, 'One source']], st.two, (q) => { st.two = q; }),
          ctx.seg([[false, 'Live ripples'], [true, 'Average strength']], st.avg, (q) => { st.avg = q; }),
        );
        const row = ctx.h('<div class="row"><label class="check"><input type="checkbox"> mark predicted quiet lines</label><button class="btn ghost sm">Still the water</button></div>');
        row.querySelector('input').onchange = (e) => { st.nodal = e.target.checked; };
        row.children[1].onclick = resetTank;
        ctl.append(row, ctx.h('<p class="hint">Hover or touch the water to read the path difference from the two sources.</p>'));
        out.innerHTML = '';
      }
    }
    controls();

    ctx.panel.append(
      ctx.h(`<div class="card tip"><p>Shake one end of a rope and a bump travels along it. The rope itself only moves up and down (follow the rose dot). What travels is the <b>pattern</b>, and the energy.</p><p>In a <b>transverse</b> wave the wobble is across the direction of travel, like a rope or light. In a <b>longitudinal</b> wave it is along it, making squeezes and stretches, like sound in air.</p><p>Every wave obeys one rule: <b>speed = frequency × wavelength</b>. The medium sets the speed. You set the frequency. The wavelength has to fit.</p></div>`),
      ctx.h(`<div class="card try"><ul>
        <li>Raise the frequency. The wavelength shrinks, the speed does not change.</li>
        <li>Raise the wave speed (a tighter rope) at a fixed frequency. The waves stretch out.</li>
        <li>Set the far end to <b>Fixed</b> and send a single pulse. It comes back upside down. With a <b>Free</b> end it comes back the right way up.</li>
        <li>With a fixed end and steady shaking, find a frequency where the rope settles into a standing wave with still points (nodes).</li>
        <li>Ripple tank: switch to <b>Average strength</b>. Dark fans are lines where the two waves always cancel. Move the sources apart or raise the frequency and the fans get closer together.</li>
      </ul></div>`),
      ctx.h(`<div class="card deep">
        <div class="formula">v = f λ &nbsp; T = 1/f<span>the wave equation's most used result</span></div>
        <div class="formula">∂²u/∂t² = v² ∂²u/∂x²<span>wave equation, solved here with finite differences</span></div>
        <div class="formula">|r₁ − r₂| = m λ (loud) &nbsp; (m + ½) λ (quiet)<span>two source interference</span></div>
        <p class="small">On a string, v = √(T/μ), tension over mass per metre. In the ripple tank the quiet lines are hyperbolas. Far from the sources they point at angles where d sin θ = (m + ½)λ, with d the separation. The same geometry explains Young's double slit experiment with light.</p>
        <p class="small muted">The rope is 300 points stepped every 4 ms with the leapfrog scheme. The absorbing end uses a Mur boundary condition, which lets a wave leave the grid without reflecting. The tank is a 240 × 180 grid with 1 mm cells and a sponge layer at the edges, so ripples fade instead of bouncing back. Grid waves shorter than about ten cells travel a little slower than they should (numerical dispersion), which is one reason real solvers use fine grids.</p>
      </div>`),
    );

    ctx.quiz([
      { q: 'A wave has frequency 5 Hz and wavelength 2 m. What is its speed?', choices: ['2.5 m/s', '7 m/s', '10 m/s'], answer: 2, why: 'v = f λ = 5 × 2 = 10 m/s.' },
      { q: 'Sound in air is which kind of wave?', choices: ['Transverse', 'Longitudinal', 'Neither, it is a particle'], answer: 1, why: 'Air molecules move back and forth along the direction the sound travels, making compressions and rarefactions.' },
      { q: 'At a point where the paths from two sources differ by 1.5 wavelengths, you get:', choices: ['Loud (constructive) interference', 'Quiet (destructive) interference', 'Nothing special'], answer: 1, why: 'A half-wavelength offset (1.5 is one and a half) means a crest from one source meets a trough from the other, so they cancel.' },
    ]);
  },
};
