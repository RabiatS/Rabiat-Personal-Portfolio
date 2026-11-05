// Chapter 7: bit depth and quantisation. A staircase you can see, a bit crusher you can hear,
// the error signal on its own, dither, and dynamic range per bit.
import { makeAudio, quantize } from '../lib/audio.js';
import { createBand } from '../lib/music.js';
import { C, txt, box, hexA } from '../lib/draw.js';

export default {
  mount(ctx) {
    const A = makeAudio(ctx);
    const cv = ctx.canvas(); const g = cv.ctx;
    let bits = 4; let db = 0; let dither = false; let errOnly = false; let src = 'tone';
    let crush = null; let pre = null; let post = null; let pluckTimer = null;
    const noise = new Float32Array(400).map(() => Math.random() - Math.random());
    let reseed = 0;

    const L = () => { const W = cv.w; const H = cv.h; const h1 = Math.round(H * 0.48); const h2 = Math.round(H * 0.22); return { W, H, a: { x: 0, y: 0, w: W, h: h1 }, b: { x: 0, y: h1 + 10, w: W, h: h2 }, c: { x: 0, y: h1 + h2 + 20, w: W, h: H - h1 - h2 - 20 } }; };

    ctx.loop((t, dt) => {
      reseed += dt; if (dither && reseed > 0.12) { reseed = 0; for (let i = 0; i < noise.length; i++) noise[i] = Math.random() - Math.random(); }
      const l = L(); g.clearRect(0, 0, l.W, l.H);
      const levels = 2 ** bits; const a = Math.pow(10, db / 20); const LQ = 2 ** (bits - 1);
      const r = l.a; box(g, r.x, r.y, r.w, r.h, `${bits} bits = ${levels.toLocaleString()} levels`);
      const x0 = r.x + 14; const w = r.w - 28; const y0 = r.y + 32; const h = r.h - 44; const mid = y0 + h / 2; const sc = h / 2;
      if (levels <= 128) {
        for (let k = 0; k < levels; k++) { const v = (k - LQ + 0.5) / LQ; const y = Math.round(mid - v * sc) + 0.5; g.strokeStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w, y); g.stroke(); }
      } else txt(g, 'levels too close to draw', x0 + w, y0 + 10, { align: 'right', font: '500 10px "DM Mono", monospace' });
      const M = noise.length; const X = (i) => x0 + (i / (M - 1)) * w;
      const sig = (i) => a * Math.sin((i / (M - 1)) * Math.PI * 4) * 0.98;
      const qv = (i) => quantize(sig(i) + (dither ? noise[i] / LQ : 0), bits);
      // input
      g.beginPath(); for (let i = 0; i < M; i++) { const y = mid - sig(i) * sc; if (i === 0) g.moveTo(X(i), y); else g.lineTo(X(i), y); }
      g.strokeStyle = hexA(C.c1, 0.6); g.lineWidth = 1.4; g.stroke();
      // staircase
      g.beginPath(); for (let i = 0; i < M; i++) { const y = mid - qv(i) * sc; if (i === 0) g.moveTo(X(i), y); else { g.lineTo(X(i), mid - qv(i - 1) * sc); g.lineTo(X(i), y); } }
      g.strokeStyle = C.c2; g.lineWidth = 1.8; g.stroke();
      txt(g, 'input', x0 + 4, y0 + h - 4, { color: C.c1, font: '500 10px "DM Mono", monospace' });
      txt(g, 'stored value', x0 + 50, y0 + h - 4, { color: C.c2, font: '500 10px "DM Mono", monospace' });

      // error
      const q = l.b; let em = 0; const err = new Float32Array(M); for (let i = 0; i < M; i++) { err[i] = qv(i) - sig(i); em = Math.max(em, Math.abs(err[i])); }
      const zoom = 1 / Math.max(1 / LQ, em, 1e-6);
      box(g, q.x, q.y, q.w, q.h, `Error = stored minus input (zoomed ${zoom < 10 ? zoom.toFixed(1) : Math.round(zoom).toLocaleString()}×)`);
      const ey = q.y + 30; const eh = q.h - 40; const em2 = ey + eh / 2;
      g.beginPath(); for (let i = 0; i < M; i++) { const y = em2 - err[i] * zoom * eh * 0.45; if (i === 0) g.moveTo(X(i), y); else g.lineTo(X(i), y); }
      g.strokeStyle = C.c4; g.lineWidth = 1.2; g.stroke();

      // dynamic range
      const d = l.c; box(g, d.x, d.y, d.w, d.h, 'Dynamic range: about 6 dB per bit');
      const bx0 = d.x + 14; const bw = d.w - 28; const rows = [[8, 'early samplers'], [bits, 'now'], [16, 'CD'], [24, 'studio']];
      const seen = new Set(); const list = rows.filter(([b]) => (seen.has(b) ? false : seen.add(b))).sort((u, v) => u[0] - v[0]);
      const rh = Math.min(18, (d.h - 40) / list.length - 4); const maxDb = 150;
      list.forEach(([b, name], i) => {
        const y = d.y + 30 + i * (rh + 4); const dr = 6.02 * b + 1.76; const ww = (dr / maxDb) * (bw - 190);
        const now = b === bits;
        g.fillStyle = now ? C.c2 : hexA(C.c5, 0.55); g.fillRect(bx0 + 64, y, ww, rh);
        txt(g, `${b} bit`, bx0, y + rh - 4, { color: now ? C.c2 : C.muted });
        txt(g, `${dr.toFixed(0)} dB ${name === 'now' && ![8, 16, 24].includes(b) ? '' : `· ${name}`}`, bx0 + 70 + ww, y + rh - 4, { color: now ? C.text : C.muted, font: '500 10px "DM Mono", monospace' });
      });
      const ex = bx0 + 64 + (120 / maxDb) * (bw - 190);
      g.strokeStyle = hexA(C.c4, 0.7); g.setLineDash([3, 3]); g.beginPath(); g.moveTo(ex, d.y + 26); g.lineTo(ex, d.y + d.h - 8); g.stroke(); g.setLineDash([]);
      txt(g, 'about 120 dB: quiet room to pain', ex + 4, d.y + d.h - 8, { color: C.c4, font: '500 10px "DM Mono", monospace' });
    });

    function apply() {
      if (!crush) return; const t = A.ac.currentTime;
      crush.parameters.get('bits').setValueAtTime(bits, t);
      crush.parameters.get('dither').setValueAtTime(dither ? 1 : 0, t);
      crush.parameters.get('error').setValueAtTime(errOnly ? 1 : 0, t);
      const a = Math.pow(10, db / 20);
      pre.gain.setTargetAtTime(a, t, 0.02); post.gain.setTargetAtTime(Math.min(1 / a, 40) * 0.3, t, 0.02);
    }
    const start = async () => {
      crush = await A.crusher();
      if (!crush) { bar.note('This browser could not start the bit crusher. The pictures still work.', true); play.off(); return; }
      bar.note('Start with the volume low. Low bit depths are harsh.');
      crush.parameters.get('rate').value = A.ac.sampleRate;
      pre = A.gain(1); post = A.gain(0.3); pre.connect(crush); crush.connect(post); post.connect(A.out);
      if (src === 'tone') { const o = A.osc('sine', 220); const gg = A.gain(0.9); o.connect(gg).connect(pre); }
      else if (src === 'music') { createBand(A, pre, { level: 0.9 }); }
      else {
        const ac = A.ac; const hit = () => {
          const t = ac.currentTime + 0.02; const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = 330;
          const e = ac.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.95, t + 0.005); e.gain.exponentialRampToValueAtTime(0.0003, t + 2.8);
          o.connect(e).connect(pre); o.start(t); o.stop(t + 2.9);
        };
        hit(); pluckTimer = setInterval(hit, 3000); A.onKill.add(() => { clearInterval(pluckTimer); pluckTimer = null; });
      }
      apply();
    };
    const play = A.toggle('Play', start, () => { crush = null; });
    const bar = A.bar([play]);

    const bsl = ctx.slider({ label: 'Bit depth', min: 1, max: 16, step: 1, value: bits, fmt: (v) => `${v} bit${v > 1 ? 's' : ''}`, onInput: (v) => { bits = v; apply(); upd(); } });
    const lsl = ctx.slider({ label: 'Recording level', min: -40, max: 0, step: 1, value: db, unit: ' dBFS', onInput: (v) => { db = v; apply(); } });
    const stats = ctx.h('<div class="stat"><div><b class="s-l">-</b><span>Levels</span></div><div><b class="s-d">-</b><span>Dynamic range</span></div><div><b class="s-s">-</b><span>Step size</span></div></div>');
    function upd() {
      stats.querySelector('.s-l').textContent = (2 ** bits).toLocaleString();
      stats.querySelector('.s-d').textContent = `${(6.02 * bits + 1.76).toFixed(1)} dB`;
      stats.querySelector('.s-s').textContent = `${(-6.02 * (bits - 1)).toFixed(0)} dBFS`;
    }
    const opts = ctx.h('<div style="display:grid;gap:6px"><label class="check"><input type="checkbox" class="o-d"> Add dither (a little noise before rounding)</label><label class="check"><input type="checkbox" class="o-e"> Hear only the error</label></div>');
    opts.querySelector('.o-d').addEventListener('change', (e) => { dither = e.target.checked; apply(); });
    opts.querySelector('.o-e').addEventListener('change', (e) => { errOnly = e.target.checked; apply(); });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Bit depth and quantisation</h2>'),
      ctx.h('<p class="lede">Every sample has to be rounded to one of a fixed set of levels. How many levels you have is the bit depth.</p>'),
      bar,
      ctx.seg([['tone', 'Tone'], ['music', 'Music loop'], ['pluck', 'Fading note']], src, (v) => { src = v; play.restart(); }),
      bsl, lsl, stats, opts,
      ctx.h('<div class="card tip"><p>Sampling decides <i>when</i> to measure. Bit depth decides <i>how precisely</i>. With n bits you get 2ⁿ levels: 4 bits gives 16, 16 bits gives 65,536.</p><p>Each sample snaps to the nearest level, so the stored wave is a staircase. The difference between the staircase and the real wave is <b>quantisation error</b>, and you hear it as distortion or hiss. Each extra bit halves the error, which is about 6 dB quieter.</p></div>'),
      ctx.h('<div class="card try"><p>1. Press Play on the tone and drag the bit depth down from 16. Somewhere around 8 bits you start to hear grit. At 2 or 3 bits it is a buzzy square.</p><p>2. Tick <b>Hear only the error</b>. That is exactly what rounding added.</p><p>3. Try <b>Fading note</b> at 6 bits. The start sounds fine, the quiet tail breaks up, because quiet sounds only use a few levels. Lower the recording level and the whole thing gets worse.</p><p>4. Now add <b>dither</b>. The crunchy distortion turns into a smooth, steady hiss, and the tail fades into it instead of falling apart.</p></div>'),
      ctx.h(`<div class="card deep"><p>For a full scale sine, the signal to quantisation noise ratio is:</p>
        <div class="formula">SNR ≈ 6.02 × n + 1.76 dB<span>16 bit ≈ 98 dB, 24 bit ≈ 146 dB</span></div>
        <p>When the signal is loud and complex, the error behaves like random noise. When it is quiet or simple, the error follows the signal and becomes harmonic distortion, which sounds worse. <b>Dither</b> adds a tiny bit of random noise (here triangular, about one step wide) before rounding, so the error is no longer tied to the signal. You trade distortion for a little steady hiss, and quiet detail below one step can still come through on average.</p>
        <p>16 bits is enough for playback in nearly every real room. Studios record at 24 bits for headroom, so they can leave plenty of space below 0 dBFS without the noise floor coming up. Inside software, audio is usually processed as 32 bit floating point, which can go far above 0 dBFS without clipping until it is converted back.</p>
        <p>This demo uses a simple mid rise quantiser (levels sit half a step either side of zero), so silence sits on a tiny step rather than true zero.</p></div>`),
    );
    upd();

    ctx.quiz([
      { q: 'How many levels does 8 bit audio have?', choices: ['8', '64', '256'], answer: 2, why: '2 to the power 8 is 256.' },
      { q: 'Roughly how much dynamic range does each extra bit add?', choices: ['About 1 dB', 'About 6 dB', 'About 20 dB'], answer: 1, why: 'Each bit doubles the number of levels and halves the error: 20 × log10(2) ≈ 6 dB.' },
      { q: 'What does dither do?', choices: ['Removes all noise', 'Adds a little noise before rounding so the error becomes steady hiss instead of distortion', 'Raises the sample rate'], answer: 1, why: 'Dither decorrelates the error from the signal, trading distortion for a low, even noise floor.' },
    ]);
  },
};
