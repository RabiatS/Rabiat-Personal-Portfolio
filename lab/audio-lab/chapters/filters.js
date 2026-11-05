// Chapter 8: bandwidth and filters. BiquadFilter types with a draggable cutoff and Q, the real frequency and
// phase response from getFrequencyResponse, live input and output spectra, and a telephone band.
import { makeAudio } from '../lib/audio.js';
import { createBand } from '../lib/music.js';
import { C, txt, box, hexA, fmtHz, logPos, logFreq, freqGrid, spectrum, drag } from '../lib/draw.js';

const F0 = 20; const F1 = 20000; const RMIN = -48; const RMAX = 24; const NF = 360;

export default {
  mount(ctx) {
    const A = makeAudio(ctx);
    const cv = ctx.canvas(); const g = cv.ctx;
    let type = 'lowpass'; let fc = 1000; let Q = 0.707; let gain = 9; let mode = 'single'; let bypass = false; let src = 'pink';
    let biq = null; let tel = []; let srcNode = null; let inAn = null; let outAn = null; let ib = null; let ob = null;

    // Response math uses an OfflineAudioContext, so it works before any sound starts (no user gesture needed).
    const oc = new OfflineAudioContext(1, 128, 48000);
    const rb = oc.createBiquadFilter();
    const rtel = [['highpass', 300], ['highpass', 300], ['lowpass', 3400], ['lowpass', 3400]].map(([t, f]) => { const b = oc.createBiquadFilter(); b.type = t; b.frequency.value = f; b.Q.value = -3.01; return b; });
    const freqs = new Float32Array(NF); for (let i = 0; i < NF; i++) freqs[i] = logFreq(i / (NF - 1), F0, F1);
    const mag = new Float32Array(NF); const pha = new Float32Array(NF); const tm = new Float32Array(NF); const tp = new Float32Array(NF);
    function response() {
      if (mode === 'tel') {
        mag.fill(1); pha.fill(0);
        for (const b of rtel) { b.getFrequencyResponse(freqs, tm, tp); for (let i = 0; i < NF; i++) { mag[i] *= tm[i]; pha[i] += tp[i]; } }
      } else {
        rb.type = type; rb.frequency.value = fc; rb.Q.value = qParam(); rb.gain.value = gain;
        rb.getFrequencyResponse(freqs, mag, pha);
      }
      if (bypass) { mag.fill(1); pha.fill(0); }
    }
    // Web Audio takes Q in dB for low pass and high pass, and as a plain ratio for the other types.
    const qParam = () => (type === 'lowpass' || type === 'highpass' ? 20 * Math.log10(Q) : Q);
    const usesGain = () => type === 'peaking' || type === 'lowshelf' || type === 'highshelf';

    const L = () => { const W = cv.w; const H = cv.h; const h1 = Math.round(H * 0.7); return { W, H, a: { x: 0, y: 0, w: W, h: h1 }, b: { x: 0, y: h1 + 12, w: W, h: H - h1 - 12 } }; };
    const P = (r) => ({ x: r.x + 14, y: r.y + 30, w: r.w - 56, h: r.h - 66 });
    const RY = (p, d) => p.y + (1 - (Math.max(RMIN, Math.min(RMAX, d)) - RMIN) / (RMAX - RMIN)) * p.h;

    ctx.loop(() => {
      response();
      const l = L(); g.clearRect(0, 0, l.W, l.H);
      const r = l.a; box(g, r.x, r.y, r.w, r.h, mode === 'tel' ? 'Telephone band: 300 Hz to 3.4 kHz' : `${type} filter response`);
      const p = P(r);
      freqGrid(g, p.x, p.y, p.w, p.h, F0, F1);
      for (let d = RMIN; d <= RMAX; d += 12) { const y = Math.round(RY(p, d)) + 0.5; g.strokeStyle = d === 0 ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(p.x, y); g.lineTo(p.x + p.w, y); g.stroke(); txt(g, `${d > 0 ? '+' : ''}${d}`, p.x + p.w + 6, y + 4, { font: '500 10px "DM Mono", monospace', color: C.subtle }); }
      txt(g, 'dB', p.x + p.w + 6, p.y - 8, { font: '500 10px "DM Mono", monospace', color: C.subtle });
      if (inAn) {
        // spectra share the plot: input faint, output bright (their own -110..-10 dBFS scale)
        spectrum(g, inAn, ib, p.x, p.y, p.w, p.h, { f0: F0, f1: F1, dmin: -120, dmax: -20, color: '#5A5A55', fill: false });
        spectrum(g, outAn, ob, p.x, p.y, p.w, p.h, { f0: F0, f1: F1, dmin: -120, dmax: -20, color: C.c5, fill: true });
      }
      if (mode === 'tel' && !bypass) { for (const [a, b] of [[F0, 300], [3400, F1]]) { const xa = p.x + logPos(a, F0, F1) * p.w; const xb = p.x + logPos(b, F0, F1) * p.w; g.fillStyle = 'rgba(251,113,133,.06)'; g.fillRect(xa, p.y, xb - xa, p.h); } }
      // response curve
      g.beginPath(); for (let i = 0; i < NF; i++) { const x = p.x + (i / (NF - 1)) * p.w; const y = RY(p, 20 * Math.log10(mag[i] + 1e-9)); if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); }
      g.strokeStyle = bypass ? C.muted : C.c2; g.lineWidth = 2.2; g.stroke();
      if (mode === 'single' && !bypass) {
        const hx = p.x + logPos(fc, F0, F1) * p.w; const i = Math.round(logPos(fc, F0, F1) * (NF - 1)); const hy = RY(p, 20 * Math.log10(mag[i] + 1e-9));
        g.strokeStyle = hexA(C.c2, 0.3); g.setLineDash([3, 3]); g.beginPath(); g.moveTo(hx + 0.5, p.y); g.lineTo(hx + 0.5, p.y + p.h); g.stroke(); g.setLineDash([]);
        g.fillStyle = C.bg; g.strokeStyle = C.c2; g.lineWidth = 2; g.beginPath(); g.arc(hx, hy, 7, 0, Math.PI * 2); g.fill(); g.stroke();
        txt(g, `${fmtHz(fc)}  Q ${Q.toFixed(2)}${usesGain() ? `  ${gain > 0 ? '+' : ''}${gain.toFixed(0)} dB` : ''}`, Math.min(hx + 12, p.x + p.w - 150), Math.max(p.y + 12, hy - 12), { color: C.text });
      }
      const ly = r.y + r.h - 6; txt(g, 'response', r.x + 14, ly, { color: C.c2, font: '500 10px "DM Mono", monospace' });
      if (inAn) { txt(g, 'input', r.x + 84, ly, { color: C.muted, font: '500 10px "DM Mono", monospace' }); txt(g, 'output', r.x + 134, ly, { color: C.c5, font: '500 10px "DM Mono", monospace' }); }

      // phase
      const q = l.b; box(g, q.x, q.y, q.w, q.h, 'Phase shift (a side effect of filtering)');
      const pp = { x: q.x + 14, y: q.y + 28, w: q.w - 56, h: q.h - 40 };
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(pp.x, pp.y + pp.h / 2 + 0.5); g.lineTo(pp.x + pp.w, pp.y + pp.h / 2 + 0.5); g.stroke();
      txt(g, '+180°', pp.x + pp.w + 6, pp.y + 8, { font: '500 10px "DM Mono", monospace', color: C.subtle }); txt(g, '-180°', pp.x + pp.w + 6, pp.y + pp.h, { font: '500 10px "DM Mono", monospace', color: C.subtle });
      g.beginPath(); let prev = null;
      for (let i = 0; i < NF; i++) {
        let ph = pha[i]; ph = Math.atan2(Math.sin(ph), Math.cos(ph));
        const x = pp.x + (i / (NF - 1)) * pp.w; const y = pp.y + (0.5 - ph / (2 * Math.PI)) * pp.h;
        if (prev === null || Math.abs(y - prev) > pp.h * 0.6) g.moveTo(x, y); else g.lineTo(x, y); prev = y;
      }
      g.strokeStyle = C.c3; g.lineWidth = 1.4; g.stroke();
    });

    drag(cv.el, (x, y, e, phase) => {
      if ((phase !== 'down' && phase !== 'move') || mode !== 'single') return;
      const l = L(); const p = P(l.a); if (phase === 'down' && y > l.a.y + l.a.h) return;
      fc = logFreq(Math.max(0, Math.min(1, (x - p.x) / p.w)), F0, F1); fc = Math.max(30, Math.min(18000, fc));
      const v = 1 - Math.max(0, Math.min(1, (y - p.y) / p.h));
      if (usesGain()) gain = Math.round(-24 + v * 48); else Q = Math.pow(10, -1 + v * 2.3);
      sync(); apply();
    }, ctx.signal);

    function apply() {
      if (!biq) return; const t = A.ac.currentTime;
      biq.type = type; biq.frequency.setTargetAtTime(fc, t, 0.01); biq.Q.setTargetAtTime(qParam(), t, 0.01); biq.gain.setTargetAtTime(gain, t, 0.01);
    }
    function route() {
      if (!srcNode) return;
      try { srcNode.disconnect(); } catch { /* ok */ }
      srcNode.connect(inAn);
      if (bypass) srcNode.connect(outAn); else if (mode === 'tel') srcNode.connect(tel[0]); else srcNode.connect(biq);
    }
    const start = async () => {
      const ac = A.ac;
      inAn = A.analyser(8192, 0.85); outAn = A.analyser(8192, 0.85); ib = new Float32Array(inAn.frequencyBinCount); ob = new Float32Array(outAn.frequencyBinCount);
      const out = A.gain(1); outAn.connect(out); out.connect(A.out);
      biq = ac.createBiquadFilter(); A.add(biq); biq.connect(outAn);
      tel = [['highpass', 300], ['highpass', 300], ['lowpass', 3400], ['lowpass', 3400]].map(([t, f]) => { const b = ac.createBiquadFilter(); b.type = t; b.frequency.value = f; b.Q.value = -3.01; A.add(b); return b; });
      for (let i = 0; i < 3; i++) tel[i].connect(tel[i + 1]); tel[3].connect(outAn);
      srcNode = A.gain(1);
      if (src === 'pink') { A.noise('pink').connect(srcNode); srcNode.gain.value = 0.55; }
      else if (src === 'white') { A.noise('white').connect(srcNode); srcNode.gain.value = 0.12; }
      else if (src === 'saw') { const o = A.osc('sawtooth', 110); o.connect(srcNode); srcNode.gain.value = 0.18; }
      else createBand(A, srcNode, { level: 0.7 });
      apply(); route();
    };
    const play = A.toggle('Play', start, () => { biq = null; srcNode = null; inAn = null; outAn = null; });
    const byp = ctx.h('<button class="btn ghost">Bypass</button>');
    byp.addEventListener('click', () => { bypass = !bypass; byp.classList.toggle('live', bypass); byp.textContent = bypass ? 'Bypassed' : 'Bypass'; route(); }, { signal: ctx.signal });
    const bar = A.bar([play, byp]);

    const typeSeg = ctx.seg([['lowpass', 'Low pass'], ['highpass', 'High pass'], ['bandpass', 'Band pass'], ['notch', 'Notch'], ['peaking', 'Peak']], type, (v) => { type = v; if (mode !== 'single') { mode = 'single'; modeSeg.set('single'); route(); } if (v === 'bandpass' || v === 'notch') Q = Math.max(Q, 1.5); sync(); apply(); });
    const modeSeg = ctx.seg([['single', 'One filter'], ['tel', 'Telephone band']], mode, (v) => { mode = v; route(); });
    const toS = (v) => Math.round(logPos(v, F0, F1) * 1000);
    const fsl = ctx.slider({ label: 'Cutoff / centre', min: 0, max: 1000, step: 1, value: toS(fc), fmt: (v) => fmtHz(logFreq(v / 1000, F0, F1)), onInput: (v) => { fc = logFreq(v / 1000, F0, F1); apply(); } });
    const qsl = ctx.slider({ label: 'Q (sharpness)', min: -1, max: 1.3, step: 0.01, value: Math.log10(Q), fmt: (v) => Math.pow(10, v).toFixed(2), onInput: (v) => { Q = Math.pow(10, v); apply(); } });
    const gsl = ctx.slider({ label: 'Gain (peak only)', min: -24, max: 24, step: 1, value: gain, unit: ' dB', onInput: (v) => { gain = v; apply(); } });
    function sync() { fsl.value = toS(fc); qsl.value = Math.log10(Q); gsl.value = gain; }

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Bandwidth and filters</h2>'),
      ctx.h('<p class="lede">A filter lets some frequencies through and holds others back. It is the most used tool in all of audio.</p>'),
      bar,
      ctx.seg([['pink', 'Pink noise'], ['white', 'White noise'], ['saw', 'Saw 110 Hz'], ['music', 'Music loop']], src, (v) => { src = v; play.restart(); }),
      typeSeg, fsl, qsl, gsl,
      ctx.h('<div class="card tip"><p>A <b>low pass</b> filter keeps the lows and cuts the highs: it sounds muffled, like music through a wall. A <b>high pass</b> does the opposite and sounds thin. A <b>band pass</b> keeps only a slice. A <b>notch</b> removes a narrow slice and leaves the rest.</p><p>The <b>cutoff</b> is where the filter starts working. <b>Q</b> sets how sharp it is: high Q means a narrow band or a resonant peak at the cutoff. The range of frequencies a system lets through is its <b>bandwidth</b>.</p></div>'),
      ctx.h('<div class="card try"><p>1. Play pink noise, pick Low pass, and drag the handle on the stage left and right. Hear the hiss darken.</p><p>2. Drag the handle up to raise Q. A resonant peak appears: that whistling sweep is the classic synth filter sound.</p><p>3. Switch to Notch on the saw wave and sweep slowly: you can hear single harmonics vanish.</p><p>4. Play the music loop and pick <b>Telephone band</b>. Everything below 300 Hz and above 3.4 kHz is gone. Press Bypass to compare.</p></div>'),
      ctx.h('<h3>Telephone</h3>'), modeSeg,
      ctx.h(`<div class="card deep"><p>These are <b>biquad</b> filters: second order recursive filters that compute each output sample from the last two inputs and the last two outputs:</p>
        <div class="formula">y[n] = b0·x[n] + b1·x[n−1] + b2·x[n−2] − a1·y[n−1] − a2·y[n−2]<span>the five coefficients come from type, cutoff, Q and gain</span></div>
        <p>A second order low pass falls off at 12 dB per octave above the cutoff. Stack filters for steeper slopes: the telephone band here is two high pass and two low pass sections, 24 dB per octave on each side. Q = 0.707 gives the flattest pass band (Butterworth). One quirk: for low pass and high pass, Web Audio takes Q in decibels, so 0.707 becomes about −3 dB. This page converts it for you.</p>
        <p>Traditional landline voice uses about 300 Hz to 3.4 kHz, sampled at 8 kHz. Your voice's fundamental is often below 300 Hz, yet you still hear the right pitch from the harmonics. Newer "HD voice" calls carry about 50 Hz to 7 kHz, which is why they sound so much clearer.</p>
        <p>The purple curve is phase. Filters like these delay some frequencies more than others. Usually you do not hear it on its own, but it matters when a filtered and an unfiltered copy are mixed together.</p></div>`),
    );

    ctx.quiz([
      { q: 'You want to remove rumble below 80 Hz and keep everything else. Which filter?', choices: ['Low pass at 80 Hz', 'High pass at 80 Hz', 'Notch at 8 kHz'], answer: 1, why: 'A high pass lets the highs pass and cuts below the cutoff.' },
      { q: 'What does raising Q do to a band pass filter?', choices: ['Makes the band narrower', 'Makes the band wider', 'Changes the centre frequency'], answer: 0, why: 'Q is centre frequency divided by bandwidth, so higher Q means a narrower band.' },
      { q: 'Classic telephone audio passes roughly…', choices: ['20 Hz to 20 kHz', '300 Hz to 3.4 kHz', '3 kHz to 30 kHz'], answer: 1, why: 'That band keeps speech understandable while using little bandwidth.' },
    ]);
  },
};
