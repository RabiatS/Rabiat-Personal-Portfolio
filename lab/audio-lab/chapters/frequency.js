// Chapter 2: frequency and pitch. A live oscillator on a log slider, the wave in a fixed time window,
// the range of hearing, a keyboard, and a sweep to find your own upper limit.
import { makeAudio } from '../lib/audio.js';
import { C, txt, title, box, hexA, fmtHz, logPos, logFreq, freqGrid, noteOf, midiHz, drag } from '../lib/draw.js';

const F0 = 20; const F1 = 20000;

export default {
  mount(ctx) {
    const A = makeAudio(ctx);
    const cv = ctx.canvas(); const g = cv.ctx;
    let f = 440; let osc = null; let og = null;
    let sweep = null; let limit = ctx.store.get('hearing-limit', null);
    const WIN = 0.01; // 10 ms window

    const L = () => {
      const W = cv.w; const H = cv.h;
      const h1 = Math.round(H * 0.46); const h2 = Math.round(H * 0.3); const h3 = H - h1 - h2 - 24;
      return { W, H, wv: { x: 0, y: 0, w: W, h: h1 }, rg: { x: 0, y: h1 + 12, w: W, h: h2 }, kb: { x: 0, y: h1 + h2 + 24, w: W, h: h3 } };
    };

    // keyboard: A0 (21) to C8 (108)
    const isBlack = (m) => [1, 3, 6, 8, 10].includes(m % 12);
    const whites = []; for (let m = 21; m <= 108; m++) if (!isBlack(m)) whites.push(m);
    function keyRects(r) {
      const x0 = r.x + 12; const w = r.w - 24; const y = r.y + 28; const hh = r.h - 40; const ww = w / whites.length; const out = [];
      whites.forEach((m, i) => out.push({ m, x: x0 + i * ww, y, w: ww, h: hh, black: false }));
      whites.forEach((m, i) => { if (m + 1 <= 108 && isBlack(m + 1)) out.push({ m: m + 1, x: x0 + (i + 1) * ww - ww * 0.32, y, w: ww * 0.64, h: hh * 0.6, black: true }); });
      return out;
    }

    ctx.loop(() => {
      const l = L(); const { W } = l;
      g.clearRect(0, 0, W, l.H);
      // 1. waveform in a fixed 10 ms window
      const r = l.wv; box(g, r.x, r.y, r.w, r.h, 'Air pressure over 10 milliseconds');
      const px0 = r.x + 14; const pw = r.w - 28; const py = r.y + 34; const ph = r.h - 58; const mid = py + ph / 2;
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(px0, mid + 0.5); g.lineTo(px0 + pw, mid + 0.5); g.stroke();
      for (let i = 0; i <= 10; i++) { const x = px0 + (i / 10) * pw; g.beginPath(); g.moveTo(x + 0.5, py); g.lineTo(x + 0.5, py + ph); g.strokeStyle = 'rgba(255,255,255,.04)'; g.stroke(); if (i % 2 === 0 || W > 600) txt(g, `${i} ms`, x, py + ph + 14, { align: i === 0 ? 'left' : i === 10 ? 'right' : 'center', font: '500 10px "DM Mono", monospace', color: C.subtle }); }
      const cyc = f * WIN; const perPx = cyc / pw;
      if (perPx > 0.35) {
        // too many cycles to draw one by one: show the filled band the wave sweeps through
        g.fillStyle = hexA(C.c1, 0.35); g.fillRect(px0, mid - ph * 0.42, pw, ph * 0.84);
        txt(g, `${Math.round(cyc)} cycles squeezed into 10 ms, too many to draw one by one`, px0 + pw / 2, mid + 4, { align: 'center', color: C.text });
      } else {
        g.beginPath();
        const steps = Math.min(4000, Math.max(pw, cyc * 40));
        for (let i = 0; i <= steps; i++) { const tt = (i / steps) * WIN; const x = px0 + (i / steps) * pw; const y = mid - Math.sin(2 * Math.PI * f * tt) * ph * 0.42; if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
        g.strokeStyle = C.c1; g.lineWidth = 1.8; g.stroke();
        // mark one period
        const T = 1 / f; if (T <= WIN) { const xa = px0; const xb = px0 + (T / WIN) * pw; if (xb - xa > 18) { const y = py + 2; g.strokeStyle = C.c2; g.beginPath(); g.moveTo(xa, y + 4); g.lineTo(xa, y); g.lineTo(xb, y); g.lineTo(xb, y + 4); g.stroke(); txt(g, `period ${(T * 1000).toFixed(T < 0.001 ? 3 : 2)} ms`, xb + 6, y + 6, { color: C.c2 }); } }
      }
      txt(g, `${cyc < 10 ? cyc.toFixed(1) : Math.round(cyc)} cycles shown`, r.x + r.w - 12, r.y + 20, { align: 'right' });

      // 2. hearing range
      const q = l.rg; box(g, q.x, q.y, q.w, q.h, 'The range of hearing (log scale)');
      const ax0 = q.x + 14; const aw = q.w - 28; const ay = q.y + 30; const ah = q.h - 50;
      freqGrid(g, ax0, ay, aw, ah, F0, F1);
      const bands = [
        ['Speaking voice (fundamental)', 85, 255, C.c3],
        ['Telephone', 300, 3400, C.c5],
        ['Piano', 27.5, 4186, C.c6],
        ['Typical adult top end', 12000, 17000, C.c2],
      ];
      const bh = Math.max(9, Math.min(16, (ah - 8) / bands.length - 4));
      bands.forEach(([name, a, b, col], i) => {
        const xa = ax0 + logPos(a, F0, F1) * aw; const xb = ax0 + logPos(b, F0, F1) * aw; const y = ay + 4 + i * (bh + 4);
        g.fillStyle = hexA(col, 0.22); g.fillRect(xa, y, xb - xa, bh); g.fillStyle = col; g.fillRect(xa, y, 2, bh);
        const label = W < 520 && name.length > 18 ? name.replace(' (fundamental)', '').replace('Typical adult top end', 'Adult top') : name;
        const tw = g.measureText(label).width;
        const fits = xb - xa - 10 > tw;
        txt(g, label, fits ? xa + 6 : (xa > ax0 + aw / 2 ? xa - 6 : xb + 6), y + bh - 3, { color: col, align: fits ? 'left' : (xa > ax0 + aw / 2 ? 'right' : 'left'), font: '500 10px "DM Mono", monospace' });
      });
      if (limit) { const x = ax0 + logPos(limit, F0, F1) * aw; g.strokeStyle = C.c4; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, ay); g.lineTo(x, ay + ah); g.stroke(); g.setLineDash([]); txt(g, `your limit ${fmtHz(limit)}`, x - 4, ay + ah - 4, { align: 'right', color: C.c4 }); }
      const fx = ax0 + logPos(f, F0, F1) * aw;
      g.strokeStyle = C.text; g.lineWidth = 2; g.beginPath(); g.moveTo(fx, ay - 4); g.lineTo(fx, ay + ah); g.stroke();
      g.fillStyle = C.text; g.beginPath(); g.moveTo(fx - 5, ay - 9); g.lineTo(fx + 5, ay - 9); g.lineTo(fx, ay - 3); g.fill();
      txt(g, fmtHz(f), Math.min(q.x + q.w - 50, Math.max(q.x + 60, fx)), q.y + 20, { align: 'center', color: C.text });

      // 3. keyboard
      const k = l.kb; box(g, k.x, k.y, k.w, k.h, 'Piano keys (A0 to C8)');
      const n = noteOf(f); const keys = keyRects(k);
      for (const key of keys) {
        const on = key.m === n.midi && f >= 26 && f <= 4300;
        g.fillStyle = key.black ? (on ? C.c1 : '#1a1a1a') : (on ? C.c1 : '#d8d8d2');
        g.fillRect(key.x + 0.5, key.y, key.w - 1, key.h);
        if (!key.black && key.m % 12 === 0 && key.w > 6) txt(g, `C${key.m / 12 - 1}`, key.x + key.w / 2, key.y + key.h - 4, { align: 'center', font: '500 8px "DM Mono", monospace', color: '#555' });
      }
      txt(g, `${n.name} ${n.cents >= 0 ? '+' : ''}${n.cents} cents`, k.x + k.w - 12, k.y + 20, { align: 'right', color: C.c1 });
    });

    // interaction: drag on the range axis or click keys
    drag(cv.el, (x, y, e, phase) => {
      if (phase === 'hover' || phase === 'up') return;
      const l = L();
      if (y >= l.rg.y && y <= l.rg.y + l.rg.h) { setF(logFreq(Math.max(0, Math.min(1, (x - 14) / (l.rg.w - 28))), F0, F1)); }
      else if (y >= l.kb.y && phase === 'down' || (y >= l.kb.y && phase === 'move')) {
        const keys = keyRects(l.kb); const hit = keys.filter((kk) => kk.black).find((kk) => x >= kk.x && x <= kk.x + kk.w && y >= kk.y && y <= kk.y + kk.h) || keys.find((kk) => !kk.black && x >= kk.x && x <= kk.x + kk.w);
        if (hit) setF(midiHz(hit.m));
      }
    }, ctx.signal);

    const toS = (v) => Math.round(logPos(v, F0, F1) * 1000);
    const sl = ctx.slider({ label: 'Frequency', min: 0, max: 1000, step: 1, value: toS(f), fmt: (v) => fmtHz(logFreq(v / 1000, F0, F1)), onInput: (v) => setF(logFreq(v / 1000, F0, F1), true) });
    const stats = ctx.h('<div class="stat"><div><b class="s-n">-</b><span>Nearest note</span></div><div><b class="s-t">-</b><span>Period</span></div><div><b class="s-l">-</b><span>Wavelength</span></div></div>');
    function setF(v, fromSlider) {
      f = Math.max(F0, Math.min(F1, v));
      if (!fromSlider) sl.value = toS(f);
      sl.querySelector('output').textContent = fmtHz(f);
      if (osc) osc.frequency.setTargetAtTime(f, A.ac.currentTime, 0.015);
      const n = noteOf(f);
      stats.querySelector('.s-n').textContent = `${n.name} ${n.cents >= 0 ? '+' : ''}${n.cents}`;
      const T = 1000 / f; stats.querySelector('.s-t').textContent = T >= 1 ? `${T.toFixed(2)} ms` : `${(T * 1000).toFixed(0)} µs`;
      const lam = 343 / f; stats.querySelector('.s-l').textContent = lam >= 1 ? `${lam.toFixed(2)} m` : `${(lam * 100).toFixed(1)} cm`;
    }

    const startTone = async () => {
      og = A.gain(0); og.connect(A.out); osc = A.osc('sine', f); osc.connect(og);
      og.gain.setTargetAtTime(0.25, A.ac.currentTime, 0.03);
    };
    const play = A.toggle('Play tone', startTone, () => { osc = null; og = null; stopSweep(false); });

    // hearing limit sweep: 8 kHz up to 20 kHz over about 24 seconds
    const testBtn = ctx.h('<button class="btn ghost">Find my upper limit</button>');
    const stopBtn = ctx.h('<button class="btn" hidden>I can no longer hear it</button>');
    const res = ctx.h(`<p class="hint">${limit ? `Last result: about ${fmtHz(limit)}` : 'No result yet.'}</p>`);
    function stopSweep(record) {
      if (!sweep) return;
      if (record) { limit = Math.round(f); ctx.store.set('hearing-limit', limit); res.textContent = `Your result: about ${fmtHz(limit)} on this device.`; }
      sweep.stop(); sweep = null; stopBtn.hidden = true; testBtn.hidden = false;
    }
    testBtn.addEventListener('click', async () => {
      if (!play.on) play.click();
      await new Promise((r) => setTimeout(r, 120));
      const t0 = performance.now(); setF(8000);
      testBtn.hidden = true; stopBtn.hidden = false;
      const stop = ctx.loop(() => {
        const s = (performance.now() - t0) / 1000; const v = 8000 * Math.pow(20000 / 8000, Math.min(1, s / 24));
        setF(v); if (s > 24.5) { stopSweep(false); res.textContent = 'The sweep reached 20 kHz. Your device may not play that high, or you hear very well.'; }
      });
      sweep = { stop };
    }, { signal: ctx.signal });
    stopBtn.addEventListener('click', () => stopSweep(true), { signal: ctx.signal });

    const presets = ctx.h('<div class="row"></div>');
    for (const [label, v] of [['A2 110', 110], ['Middle C', 261.63], ['A4 440', 440], ['1 kHz', 1000], ['4 kHz', 4000], ['10 kHz', 10000]]) {
      const b = ctx.h(`<button class="chip">${label}</button>`); b.onclick = () => setF(v); presets.append(b);
    }

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Frequency and pitch</h2>'),
      ctx.h('<p class="lede">How many times the air pushes back and forth each second decides how high a sound feels.</p>'),
      A.bar([play]),
      ctx.h('<div class="card tip"><p><b>Frequency</b> is the number of full back and forth cycles per second, measured in <b>hertz</b> (Hz). 440 Hz means 440 pushes a second. Your brain hears frequency as <b>pitch</b>: more cycles, higher note.</p><p>Young healthy ears hear roughly 20 Hz to 20,000 Hz (20 kHz). Below that you feel rumble, above it is ultrasound.</p></div>'),
      sl, presets, stats,
      ctx.h('<div class="card try"><p>1. Press Play tone and drag the slider slowly. Notice the slider is logarithmic: each equal step multiplies the frequency.</p><p>2. Click A2, then A4. A4 is four times A2 and sounds two octaves higher. Every doubling is one octave.</p><p>3. Drag along the hearing range strip or tap a piano key on the stage.</p></div>'),
      ctx.h('<h3>Your upper limit</h3>'),
      ctx.h('<p class="small muted">Keep the volume low. The tone climbs from 8 kHz to 20 kHz. Press the button the moment it disappears. Laptop and phone speakers often stop well before 20 kHz, so headphones give a fairer result.</p>'),
      ctx.h('<div class="row"></div>'),
      res,
      ctx.h(`<div class="card deep"><p>Pitch is logarithmic. Western music splits each octave (a doubling) into 12 equal semitones, so each semitone multiplies the frequency by 2<sup>1/12</sup>, about 1.0595. A cent is a hundredth of a semitone.</p>
        <div class="formula">f = 440 × 2^((n − 69) / 12)<span>n is the MIDI note number, A4 = 69</span></div>
        <p>The upper limit drops with age (presbycusis) and with noise exposure. Many adults over 40 no longer hear much above about 14 to 15 kHz. The low end is less clear cut, because very low tones are felt as much as heard, and loudness changes what you can detect.</p>
        <p>Real instruments are not single sines. A note's pitch usually comes from its lowest repeating rate (the fundamental), even when other frequencies are louder. More on that in Waveforms and timbre.</p></div>`),
    );
    ctx.panel.querySelectorAll('.row')[1].append(testBtn, stopBtn);
    setF(f);

    ctx.quiz([
      { q: 'What does 1,000 Hz mean?', choices: ['1,000 cycles of pressure every second', 'A sound 1,000 times louder', 'A wave 1,000 metres long'], answer: 0, why: 'Hertz counts cycles per second.' },
      { q: 'You go up one octave from 220 Hz. Where do you land?', choices: ['230 Hz', '440 Hz', '330 Hz'], answer: 1, why: 'An octave is a doubling of frequency.' },
      { q: 'Roughly what range can young healthy humans hear?', choices: ['2 Hz to 2 kHz', '20 Hz to 20 kHz', '200 Hz to 200 kHz'], answer: 1, why: 'About 20 Hz to 20 kHz, with the top end falling as we age.' },
    ]);
  },
};
