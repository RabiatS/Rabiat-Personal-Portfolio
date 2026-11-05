// Chapter 1: what sound is. Air particles pushed by a speaker cone, compressions and rarefactions travelling outward.
import { makeAudio, noiseBuffer } from '../lib/audio.js';
import { C, txt, title, box, hexA, fmtHz } from '../lib/draw.js';

export default {
  mount(ctx) {
    const A = makeAudio(ctx);
    const cv = ctx.canvas(); const g = cv.ctx;
    let f = 0.6; let amp = 0.7; let mode = 'tone'; let simT = 0; let showDisp = false;
    const claps = [];
    const HEAR = 220; // the audible tone is this many times faster than the picture
    let osc = null; let og = null;

    // Particles: fixed random spots in a unit field, so they keep their place on resize.
    let parts = [];
    const seed = (W, H) => {
      const n = Math.round(Math.min(2600, Math.max(500, (W * H) / 130)));
      let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      parts = Array.from({ length: n }, () => ({ u: r(), v: r() }));
    };
    cv.onResize((w, h) => seed(w, h));

    const dockH = 0;
    function layout() {
      const W = cv.w; const H = cv.h;
      const topH = Math.round((H - dockH) * 0.6);
      const top = { x: 0, y: 0, w: W, h: topH };
      const bot = { x: 0, y: topH + 12, w: W, h: H - dockH - topH - 12 };
      const fx0 = Math.min(96, W * 0.2); const fx1 = W - 14;
      return { W, H, top, bot, fx0, fx1, fy0: top.y + 34, fy1: top.y + top.h - 14 };
    }

    // Displacement s(x) and pressure p(x) (p = -ds/dx, normalised to about -1..1)
    function field(L, x) {
      const c = (L.fx1 - L.fx0) * 0.26; // picture speed of sound in px per second
      let s = 0; let p = 0;
      const lam = c / f; const k = (2 * Math.PI) / lam; const w = 2 * Math.PI * f;
      const Apx = amp * Math.min(16, 0.85 / k);
      if (mode === 'tone') {
        const ph = w * simT - k * (x - L.fx0);
        s = Apx * Math.sin(ph); p = Math.cos(ph) * amp; // -ds/dx = Apx k cos(ph); normalised by Apx k
      }
      const sig = 16; const Ap = 14 * Math.max(0.15, amp);
      for (const t0 of claps) {
        const d = x - L.fx0 - c * (simT - t0);
        if (d > -60 && d < 60) { const e = Math.exp(-(d * d) / (2 * sig * sig)); s += Ap * e; p += (d / sig) * e / 0.607 * Math.max(0.15, amp); }
      }
      return { s, p, lam, c, Apx };
    }

    ctx.loop((t, dt) => {
      simT += dt;
      while (claps.length && simT - claps[0] > 8) claps.shift();
      const L = layout(); const { W } = L;
      g.clearRect(0, 0, W, L.H);
      box(g, L.top.x, L.top.y, L.top.w, L.top.h, 'Air in front of a speaker');
      box(g, L.bot.x, L.bot.y, L.bot.w, L.bot.h, 'Air pressure along the line');

      // pressure shading bands
      const fw = L.fx1 - L.fx0;
      for (let x = L.fx0; x < L.fx1; x += 3) {
        const { p } = field(L, x);
        g.fillStyle = p > 0 ? hexA(C.c1, Math.min(0.28, p * 0.22)) : hexA(C.c3, Math.min(0.2, -p * 0.16));
        g.fillRect(x, L.fy0 - 6, 3, L.fy1 - L.fy0 + 12);
      }

      // particles
      const fh = L.fy1 - L.fy0;
      g.fillStyle = 'rgba(232,232,227,.62)';
      for (const q of parts) {
        const x0 = L.fx0 + 6 + q.u * (fw - 12); const { s } = field(L, x0);
        g.beginPath(); g.arc(x0 + s, L.fy0 + q.v * fh, 1.5, 0, Math.PI * 2); g.fill();
      }
      // tracked particles: they wiggle in place, the wave moves on
      for (const u of [0.18, 0.5, 0.82]) {
        const x0 = L.fx0 + 6 + u * (fw - 12); const y = L.fy0 + fh * 0.5; const { s } = field(L, x0);
        g.strokeStyle = hexA(C.c4, 0.5); g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y - 9); g.lineTo(x0, y + 9); g.stroke();
        g.fillStyle = C.c4; g.beginPath(); g.arc(x0 + s, y, 4, 0, Math.PI * 2); g.fill();
      }

      // speaker and cone
      const cy = (L.fy0 + L.fy1) / 2; const s0 = field(L, L.fx0).s;
      const coneH = Math.min(fh * 0.8, 150); const mx = L.fx0 - 34;
      g.fillStyle = '#2A2A2A'; g.fillRect(mx - 22, cy - 18, 20, 36);
      g.strokeStyle = C.muted; g.lineWidth = 1.5; g.strokeRect(mx - 22 + 0.5, cy - 18 + 0.5, 20, 36);
      const front = L.fx0 - 4 + s0;
      g.beginPath(); g.moveTo(mx - 2, cy - 12); g.lineTo(front, cy - coneH / 2); g.lineTo(front, cy + coneH / 2); g.lineTo(mx - 2, cy + 12); g.closePath();
      g.fillStyle = 'rgba(160,160,154,.12)'; g.fill(); g.strokeStyle = C.text2; g.stroke();
      g.strokeStyle = C.c2; g.lineWidth = 3; g.beginPath(); g.moveTo(front, cy - coneH / 2); g.lineTo(front, cy + coneH / 2); g.stroke();
      if (W > 420) txt(g, 'cone', front, cy + coneH / 2 + 14, { align: 'center', color: C.c2 });

      // wavelength bracket
      const fr = field(L, L.fx0);
      if (mode === 'tone' && amp > 0.02) {
        const k = (2 * Math.PI) / fr.lam; const w = 2 * Math.PI * f;
        let n = Math.ceil((w * simT - k * 0) / (2 * Math.PI)); let xa = L.fx0 + (w * simT - 2 * Math.PI * n) / k;
        while (xa < L.fx0 + 10) { n--; xa = L.fx0 + (w * simT - 2 * Math.PI * n) / k; }
        const xb = xa + fr.lam;
        if (xb < L.fx1 - 4) {
          const y = L.fy0 - 12;
          g.strokeStyle = C.c2; g.lineWidth = 1; g.beginPath(); g.moveTo(xa, y + 4); g.lineTo(xa, y); g.lineTo(xb, y); g.lineTo(xb, y + 4); g.stroke();
          txt(g, 'one wavelength', (xa + xb) / 2, y - 4, { align: 'center', color: C.c2 });
        }
      }
      if (W > 520) {
        txt(g, 'compression', L.top.w - 14, 18, { align: 'right', color: C.c1 });
        txt(g, 'rarefaction', L.top.w - 110, 18, { align: 'right', color: C.c3 });
      }

      // bottom graph
      const gx0 = L.fx0; const gx1 = L.fx1; const gy = L.bot.y + 30; const gh = L.bot.h - 44; const mid = gy + gh / 2;
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.beginPath(); g.moveTo(gx0, mid + 0.5); g.lineTo(gx1, mid + 0.5); g.stroke();
      txt(g, '+ more', gx0 - 8, gy + 10, { align: 'right', font: '500 10px "DM Mono", monospace' });
      txt(g, 'normal', gx0 - 8, mid + 4, { align: 'right', font: '500 10px "DM Mono", monospace' });
      txt(g, '- less', gx0 - 8, gy + gh, { align: 'right', font: '500 10px "DM Mono", monospace' });
      g.beginPath();
      for (let x = gx0; x <= gx1; x += 2) { const { p } = field(L, x); const y = mid - Math.max(-1.2, Math.min(1.2, p)) * gh * 0.42; if (x === gx0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.strokeStyle = C.c1; g.lineWidth = 1.8; g.stroke();
      if (showDisp) {
        g.beginPath();
        for (let x = gx0; x <= gx1; x += 2) { const { s, Apx } = field(L, x); const y = mid - (s / Math.max(6, Apx || 14)) * gh * 0.42 * (mode === 'tone' ? 1 : 0.5); if (x === gx0) g.moveTo(x, y); else g.lineTo(x, y); }
        g.setLineDash([5, 4]); g.strokeStyle = C.c2; g.lineWidth = 1.4; g.stroke(); g.setLineDash([]);
        txt(g, 'displacement', gx1, L.bot.y + 20, { align: 'right', color: C.c2 });
      }
    });

    // Sound
    const startTone = async () => {
      og = A.gain(0); og.connect(A.out);
      osc = A.osc('sine', f * HEAR); osc.connect(og);
      og.gain.setTargetAtTime(0.35 * amp, A.ac.currentTime, 0.03);
    };
    const play = A.toggle('Play the tone', startTone, () => { osc = null; og = null; });
    const clapBtn = ctx.h('<button class="btn ghost">Clap</button>');
    clapBtn.addEventListener('click', async () => {
      claps.push(simT);
      await A.ready(); if (!A.alive) return;
      const ac = A.ac; const s = ac.createBufferSource(); s.buffer = noiseBuffer(ac); A.add(s);
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.8;
      const e = ac.createGain(); const t = ac.currentTime; e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.9, t + 0.004); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      s.connect(bp).connect(e).connect(A.out); s.start(t, Math.random() * 2); s.stop(t + 0.2);
    }, { signal: ctx.signal });

    const stats = ctx.h('<div class="stat"><div><b class="s-f">-</b><span>Pitch heard</span></div><div><b class="s-l">-</b><span>Wavelength in air</span></div><div><b class="s-p">-</b><span>Picture speed</span></div></div>');
    const upd = () => {
      const fh = f * HEAR; stats.querySelector('.s-f').textContent = fmtHz(fh);
      stats.querySelector('.s-l').textContent = `${(343 / fh).toFixed(2)} m`;
      stats.querySelector('.s-p').textContent = `${f.toFixed(2)} Hz`;
      if (osc) osc.frequency.setTargetAtTime(fh, A.ac.currentTime, 0.02);
      if (og) og.gain.setTargetAtTime(mode === 'tone' ? 0.35 * amp : 0, A.ac.currentTime, 0.03);
    };

    ctx.panel.append(
      ctx.h('<h2 class="k-h">What sound is</h2>'),
      ctx.h('<p class="lede">Sound is a ripple of squeezed and stretched air. Nothing flies from the speaker to your ear, the push gets passed along.</p>'),
      A.bar([play, clapBtn]),
      ctx.h(`<div class="card tip"><p>A speaker cone moves forward and squeezes the air in front of it a little (a <b>compression</b>). It moves back and leaves the air a little thinner (a <b>rarefaction</b>). Each bit of air pushes on its neighbour, so the pattern travels outward at about 343 metres per second.</p><p>Watch the rose dots. Each one only wiggles back and forth around its own spot. The <i>pattern</i> travels, the air does not.</p></div>`),
      ctx.seg([['tone', 'Steady tone'], ['clap', 'Single clap']], mode, (v) => { mode = v; if (v === 'clap') claps.push(simT); upd(); }),
      ctx.slider({ label: 'Frequency (pushes per second)', min: 0.25, max: 2, step: 0.01, value: f, fmt: (v) => `${v.toFixed(2)} Hz`, onInput: (v) => { f = v; upd(); } }),
      ctx.slider({ label: 'Amplitude (how hard it pushes)', min: 0, max: 1, step: 0.01, value: amp, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => { amp = v; upd(); } }),
      stats,
    );
    const chk = ctx.h('<label class="check"><input type="checkbox"> Show displacement (how far air moves)</label>');
    chk.querySelector('input').addEventListener('change', (e) => { showDisp = e.target.checked; });
    ctx.panel.append(chk,
      ctx.h(`<div class="card try"><p>1. Press <b>Play the tone</b>. The picture is slowed down about ${HEAR} times so you can see it, the sound you hear is the real speed.</p><p>2. Raise the frequency. The compressions bunch closer together: a shorter wavelength, and a higher pitch.</p><p>3. Raise the amplitude. The waves look the same distance apart, but the squeezes get stronger and the tone gets louder.</p><p>4. Switch to <b>Single clap</b> and press Clap. One compression runs away from the speaker.</p></div>`),
      ctx.h(`<div class="card deep"><p>Sound is a <b>longitudinal</b> wave: the air moves along the same line the wave travels. Speed, frequency and wavelength are tied together:</p>
        <div class="formula">wavelength = speed / frequency<span>in air at 20 °C: 343 m/s / 343 Hz = 1 m</span></div>
        <p>The pressure changes are tiny. A sound at 94 dB SPL, which is loud, swings the pressure by only about 1 pascal, while the air around you sits at about 101,325 pascals.</p>
        <p>Turn on displacement and compare the two curves. Pressure peaks where the air on either side moves toward the same point, so the pressure wave is a quarter cycle (90 degrees) away from the displacement wave.</p>
        <p>Sound needs a medium. It moves faster in stiffer materials: about 1,480 m/s in water and several thousand m/s in steel. In a vacuum there is nothing to push, so there is no sound.</p></div>`),
    );
    upd();

    ctx.quiz([
      { q: 'When a sound passes, what does a single bit of air do?', choices: ['Travels from the speaker to your ear', 'Wiggles back and forth around its own spot', 'Stays perfectly still'], answer: 1, why: 'The pattern of pressure travels. Each bit of air only moves a tiny distance back and forth.' },
      { q: 'A compression is a place where the air is…', choices: ['Thinner than normal', 'Squeezed to slightly higher pressure', 'Moving fastest away from the speaker'], answer: 1, why: 'Compressions are higher pressure, rarefactions are lower pressure.' },
      { q: 'Sound in air travels at about 343 m/s. What is the wavelength of a 686 Hz tone?', choices: ['2 m', '0.5 m', '343 m'], answer: 1, why: 'wavelength = speed / frequency = 343 / 686 = 0.5 m.' },
    ]);
  },
};
