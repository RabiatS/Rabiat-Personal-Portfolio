// Chapter 3: amplitude and loudness. A live level in dBFS with a linear bar next to a dB bar,
// and a dB SPL ladder with a safe listening time calculator.
import { makeAudio, meter } from '../lib/audio.js';
import { C, txt, box, hexA, wave, trigger, drag } from '../lib/draw.js';

const LADDER = [
  [0, 'Threshold of hearing'], [30, 'Whisper, quiet room'], [60, 'Normal conversation'], [70, 'Vacuum cleaner'],
  [85, 'Heavy traffic'], [100, 'Loud club'], [110, 'Front row at a rock concert'], [120, 'Thunder close by'], [130, 'Threshold of pain'], [140, 'Jet engine nearby'],
];

export default {
  mount(ctx) {
    const A = makeAudio(ctx);
    const cv = ctx.canvas(); const g = cv.ctx;
    let db = -12; let src = 'tone'; let spl = 94;
    let an = null; let tbuf = null; let level = null; let srcGain = null;
    const sm = { rms: -120, peak: -120, hold: -120, holdT: 0 };

    const L = () => {
      const W = cv.w; const H = cv.h; const h1 = Math.round(H * 0.55);
      return { W, H, top: { x: 0, y: 0, w: W, h: h1 }, lad: { x: 0, y: h1 + 12, w: W, h: H - h1 - 12 } };
    };
    const ladX = (r, v) => r.x + 16 + (v / 140) * (r.w - 32);

    ctx.loop((t, dt) => {
      const l = L(); const { W } = l;
      g.clearRect(0, 0, W, l.H);
      const r = l.top; box(g, r.x, r.y, r.w, r.h, 'Signal level (digital, dBFS)');
      const mw = Math.min(150, r.w * 0.3); const wx = r.x + 14; const ww = r.w - mw - 40; const wy = r.y + 34; const wh = r.h - 50;
      // full scale lines
      g.strokeStyle = 'rgba(251,113,133,.35)'; g.setLineDash([4, 4]); g.lineWidth = 1;
      for (const y of [wy + 0.5, wy + wh - 0.5]) { g.beginPath(); g.moveTo(wx, y); g.lineTo(wx + ww, y); g.stroke(); }
      g.setLineDash([]); txt(g, 'full scale (0 dBFS)', wx + ww, wy - 4, { align: 'right', color: C.c4, font: '500 10px "DM Mono", monospace' });
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(wx, wy + wh / 2 + 0.5); g.lineTo(wx + ww, wy + wh / 2 + 0.5); g.stroke();

      let rmsDb; let peakDb;
      if (an) {
        const m = meter(an, tbuf); rmsDb = m.rmsDb; peakDb = m.peakDb;
        const i0 = trigger(tbuf, tbuf.length / 2); wave(g, tbuf, wx, wy, ww, wh, { from: i0, count: Math.min(tbuf.length - i0, 1024), color: src === 'mic' ? C.c2 : C.c1 });
      } else {
        const a = Math.pow(10, db / 20); const arr = new Float32Array(400);
        for (let i = 0; i < arr.length; i++) arr[i] = a * Math.sin((i / arr.length) * Math.PI * 2 * 4);
        wave(g, arr, wx, wy, ww, wh, { color: hexA(C.c1, 0.6) });
        rmsDb = db - 3.01; peakDb = db;
        txt(g, 'press Play to hear it', wx + 6, wy + wh - 6, { font: '500 10px "DM Mono", monospace' });
      }
      // smoothing like a real meter: fast attack, slow release
      const k = 1 - Math.exp(-dt / 0.3);
      sm.rms = rmsDb > sm.rms ? rmsDb : sm.rms + (rmsDb - sm.rms) * k;
      sm.peak = peakDb > sm.peak ? peakDb : sm.peak + (peakDb - sm.peak) * k;
      if (peakDb >= sm.hold) { sm.hold = peakDb; sm.holdT = t; } else if (t - sm.holdT > 1.5) sm.hold -= dt * 20;

      // meters
      const mx = r.x + r.w - mw - 14; const bw = Math.min(28, mw / 4); const by = wy; const bh = wh;
      const lin = Math.pow(10, sm.peak / 20);
      const drawBar = (x, frac, label, col, ticks) => {
        g.fillStyle = '#1E1E1E'; g.fillRect(x, by, bw, bh);
        const fh = Math.max(0, Math.min(1, frac)) * bh; g.fillStyle = col; g.fillRect(x, by + bh - fh, bw, fh);
        g.strokeStyle = C.border; g.strokeRect(x + 0.5, by + 0.5, bw - 1, bh - 1);
        for (const [fr, lab] of ticks) { const y = by + bh - fr * bh; g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x + bw, y, 4, 1); txt(g, lab, x + bw + 6, y + 3, { font: '500 9px "DM Mono", monospace', color: C.subtle }); }
        txt(g, label, x + bw / 2, by + bh + 13, { align: 'center', font: '500 9px "DM Mono", monospace' });
      };
      drawBar(mx, lin, 'linear', C.c5, [[1, '1.0'], [0.5, '0.5'], [0.1, '0.1']]);
      const dbFrac = (v) => (v + 60) / 60;
      drawBar(mx + bw + 40, dbFrac(sm.peak), 'dB', C.c1, [[1, '0'], [dbFrac(-6), '-6'], [dbFrac(-20), '-20'], [dbFrac(-40), '-40'], [0, '-60']]);
      const hy = by + bh - Math.max(0, Math.min(1, dbFrac(sm.hold))) * bh; g.fillStyle = C.text; g.fillRect(mx + bw + 40, hy, bw, 2);
      txt(g, `peak ${sm.peak < -99 ? '-inf' : sm.peak.toFixed(1)} dBFS`, r.x + 14, r.y + r.h - 6, { color: C.text });
      txt(g, `rms ${sm.rms < -99 ? '-inf' : sm.rms.toFixed(1)}`, r.x + 170, r.y + r.h - 6, { color: C.muted });

      // ladder
      const q = l.lad; box(g, q.x, q.y, q.w, q.h, 'Sound in the world (dB SPL, typical rough values)');
      const ay = q.y + q.h - 30;
      // danger gradient
      const gr = g.createLinearGradient(ladX(q, 0), 0, ladX(q, 140), 0);
      gr.addColorStop(0, hexA(C.c1, 0.5)); gr.addColorStop(80 / 140, hexA(C.c6, 0.5)); gr.addColorStop(85 / 140, hexA(C.c2, 0.6)); gr.addColorStop(110 / 140, hexA(C.c4, 0.7)); gr.addColorStop(1, hexA(C.c4, 0.9));
      g.fillStyle = gr; g.fillRect(ladX(q, 0), ay, ladX(q, 140) - ladX(q, 0), 4);
      for (let v = 0; v <= 140; v += 10) { const x = ladX(q, v); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x, ay + 6, 1, 4); if (v % 20 === 0 || W > 600) txt(g, `${v}`, x, ay + 22, { align: 'center', font: '500 10px "DM Mono", monospace', color: C.subtle }); }
      const avail = ay - (q.y + 32); const rows = W < 520 ? 5 : 4; const rowH = Math.min(36, avail / (rows + 0.3));
      LADDER.forEach(([v, name], i) => {
        const x = ladX(q, v); const row = i % rows; const y = ay - 8 - (rows - 1 - row) * rowH;
        g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(x + 0.5, y + 2); g.lineTo(x + 0.5, ay); g.stroke();
        const right = x > q.x + q.w * 0.62;
        txt(g, W < 520 ? name.split(',')[0].replace('Front row at a rock concert', 'Rock concert').replace('Threshold of ', '') : name, right ? x - 4 : x + 4, y, { align: right ? 'right' : 'left', font: '500 10px "DM Mono", monospace', color: v >= 85 ? C.text2 : C.muted });
      });
      const px = ladX(q, spl);
      g.fillStyle = C.text; g.beginPath(); g.arc(px, ay + 2, 7, 0, Math.PI * 2); g.fill(); g.fillStyle = C.bg; g.beginPath(); g.arc(px, ay + 2, 3, 0, Math.PI * 2); g.fill();
    });

    drag(cv.el, (x, y, e, phase) => {
      if (phase !== 'down' && phase !== 'move') return;
      const q = L().lad; if (phase === 'down' && y < q.y) return;
      setSpl(Math.round(Math.max(0, Math.min(140, ((x - q.x - 16) / (q.w - 32)) * 140))));
    }, ctx.signal);

    // safe time per NIOSH: 85 dBA for 8 hours, halve the time for every 3 dB more
    const safe = ctx.h('<div class="stat"><div><b class="s-spl">-</b><span>Level</span></div><div><b class="s-time">-</b><span>Daily limit (NIOSH)</span></div><div><b class="s-x">-</b><span>Pressure vs 0 dB</span></div></div>');
    const splSl = ctx.slider({ label: 'Sound level for the calculator', min: 0, max: 140, step: 1, value: spl, unit: ' dB SPL', onInput: (v) => setSpl(v, true) });
    function setSpl(v, fromSl) {
      spl = v; if (!fromSl) splSl.value = v;
      safe.querySelector('.s-spl').textContent = `${v} dB`;
      const hrs = 8 / Math.pow(2, (v - 85) / 3);
      let s;
      if (v < 85) s = 'over 8 h'; else if (hrs >= 1) s = `${hrs.toFixed(hrs < 2 ? 1 : 0)} h`; else if (hrs * 60 >= 1) s = `${Math.round(hrs * 60)} min`; else s = `${Math.max(1, Math.round(hrs * 3600))} s`;
      safe.querySelector('.s-time').textContent = s;
      const ratio = Math.pow(10, v / 20); safe.querySelector('.s-x').textContent = ratio >= 1e6 ? `${(ratio / 1e6).toFixed(ratio < 1e7 ? 1 : 0)}M×` : ratio >= 1000 ? `${Math.round(ratio / 1000)}k×` : `${ratio.toFixed(ratio < 10 ? 1 : 0)}×`;
    }

    const lvl = ctx.slider({ label: 'Level', min: -60, max: 0, step: 1, value: db, unit: ' dBFS', onInput: (v) => { db = v; apply(); } });
    const apply = () => { if (level) level.gain.setTargetAtTime(Math.pow(10, db / 20), A.ac.currentTime, 0.02); };

    const start = async () => {
      an = A.analyser(2048, 0); tbuf = new Float32Array(an.fftSize);
      if (src === 'mic') {
        const m = await A.mic();
        if (!m) { play.off(); bar.note('Microphone not available or permission denied. Try the tone or noise instead.', true); return; }
        m.connect(an); bar.note('Mic level in dBFS. This is relative to your device, not a calibrated dB SPL reading.');
        return;
      }
      level = A.gain(Math.pow(10, db / 20)); srcGain = A.gain(1);
      const s = src === 'tone' ? A.osc('sine', 440) : A.noise('pink');
      if (src === 'noise') srcGain.gain.value = 1.4;
      s.connect(srcGain).connect(level); level.connect(an); level.connect(A.out);
      bar.note('Start with the volume low. Headphones help.');
    };
    const play = A.toggle('Play', start, () => { an = null; level = null; });
    const bar = A.bar([play]);
    const steps = ctx.h('<div class="row"></div>');
    for (const [lab, d] of [['-20 dB', -20], ['-6 dB', -6], ['-3 dB', -3], ['+3 dB', 3], ['+6 dB', 6]]) {
      const b = ctx.h(`<button class="chip">${lab}</button>`); b.onclick = () => { db = Math.max(-60, Math.min(0, db + d)); lvl.value = db; apply(); }; steps.append(b);
    }

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Amplitude and loudness</h2>'),
      ctx.h('<p class="lede">Your ears handle a range of pressures over a million to one. Decibels squash that into numbers you can work with.</p>'),
      bar,
      ctx.seg([['tone', 'Tone 440 Hz'], ['noise', 'Pink noise'], ['mic', 'Microphone']], src, (v) => { src = v; play.restart(); }),
      lvl, steps,
      ctx.h('<div class="card tip"><p><b>Amplitude</b> is how big the pressure swing is. <b>Loudness</b> is how big it feels. They are related, but not in a straight line: your hearing works in ratios.</p><p>That is why we use <b>decibels</b> (dB). A decibel scale counts ratios: every +6 dB doubles the amplitude, and every +20 dB makes it ten times bigger. Around +10 dB tends to feel about twice as loud.</p></div>'),
      ctx.h('<div class="card try"><p>1. Press Play and click <b>-20 dB</b> twice. The linear bar nearly vanishes, but you can still hear the tone clearly, and the dB bar still has room. That is why meters use dB.</p><p>2. Click -6 dB and +6 dB. The wave halves and doubles in height.</p><p>3. Pick Microphone, allow access, and talk, clap or stay silent to see your room on the meter.</p></div>'),
      ctx.h('<h3>How long is safe?</h3>'),
      splSl, safe,
      ctx.h('<p class="small muted">Drag along the bottom scale on the stage too. Limits follow the US NIOSH guide: 85 dB(A) for 8 hours, and half the time for every 3 dB more. This is a guide for adults at work, not medical advice. Ringing ears after a gig are a warning sign.</p>'),
      ctx.h(`<div class="card deep"><p>Sound pressure level compares pressure to 20 micropascals, about the quietest sound a young ear hears at 1 kHz:</p>
        <div class="formula">dB SPL = 20 × log10(p / 20 µPa)<span>use 20 × log for amplitude (pressure, voltage), 10 × log for power or intensity</span></div>
        <p>So +3 dB is double the power, +6 dB double the amplitude. 0 dB SPL to 120 dB SPL is a million times the pressure and a trillion times the power.</p>
        <p><b>dBFS</b> (decibels relative to full scale) is the digital version: 0 dBFS is the largest number the file can hold, and every real level is negative. A digital meter does not know how loud your speakers are, so dBFS cannot be turned into dB SPL without calibration.</p>
        <p>Loudness also depends on frequency. Ears are most sensitive around 2 to 5 kHz and much less sensitive at low frequencies, which is what equal loudness contours and the A weighting in dB(A) try to capture. For whole songs, streaming services measure loudness in LUFS, which models this.</p></div>`),
    );
    setSpl(spl);

    ctx.quiz([
      { q: 'A signal goes up by 6 dB. What happened to its amplitude?', choices: ['It roughly doubled', 'It went up by 6 percent', 'It went up ten times'], answer: 0, why: '20 × log10(2) is about 6 dB, so +6 dB is double the amplitude.' },
      { q: 'Why do audio meters use a dB scale instead of a straight line?', choices: ['It looks nicer', 'Hearing works in ratios across a huge range, so a log scale matches what we hear', 'Digital audio cannot store linear numbers'], answer: 1, why: 'Quiet sounds would be invisible on a linear bar even though you can hear them.' },
      { q: 'Using the NIOSH guide, 85 dB is safe for about 8 hours a day. What about 91 dB?', choices: ['About 7 hours', 'About 2 hours', 'About 4 hours'], answer: 1, why: 'Every +3 dB halves the time: 88 dB is 4 hours, 91 dB is 2 hours.' },
    ]);
  },
};
