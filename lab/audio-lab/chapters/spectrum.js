// Chapter 5: the spectrum. Time domain, FFT spectrum and a scrolling spectrogram, from test signals or the microphone.
import { makeAudio } from '../lib/audio.js';
import { C, txt, box, hexA, fmtHz, logPos, logFreq, freqGrid, dbGrid, spectrum, wave, trigger, heat, noteOf } from '../lib/draw.js';

const F0 = 30; const F1 = 20000; const DMIN = -110; const DMAX = -10;

export default {
  mount(ctx) {
    const A = makeAudio(ctx);
    const cv = ctx.canvas(); const g = cv.ctx;
    let src = 'sine'; let fft = 4096; let freq = 440; let an = null; let fbuf = null; let tbuf = null; let oscs = [];
    let sg = null; let sgx = null; // offscreen spectrogram
    let paused = false;

    const L = () => {
      const W = cv.w; const H = cv.h; const h1 = Math.round(H * 0.22); const h2 = Math.round(H * 0.38);
      return { W, H, td: { x: 0, y: 0, w: W, h: h1 }, sp: { x: 0, y: h1 + 10, w: W, h: h2 }, sg: { x: 0, y: h1 + h2 + 20, w: W, h: H - h1 - h2 - 20 } };
    };
    const plot = (r, top = 30, bottom = 20) => ({ x: r.x + 14, y: r.y + top, w: r.w - 28, h: r.h - top - bottom });

    function ensureSg(w, h) {
      w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
      if (sg && sg.width === w && sg.height === h) return;
      const old = sg; sg = document.createElement('canvas'); sg.width = w; sg.height = h; sgx = sg.getContext('2d');
      sgx.fillStyle = '#0A0A0A'; sgx.fillRect(0, 0, w, h);
      if (old) sgx.drawImage(old, 0, 0, w, h);
    }

    ctx.loop(() => {
      const l = L(); g.clearRect(0, 0, l.W, l.H);
      // time domain
      box(g, l.td.x, l.td.y, l.td.w, l.td.h, 'Time domain: pressure over time');
      const tp = plot(l.td, 26, 8);
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(tp.x, tp.y + tp.h / 2 + 0.5); g.lineTo(tp.x + tp.w, tp.y + tp.h / 2 + 0.5); g.stroke();
      // spectrum
      box(g, l.sp.x, l.sp.y, l.sp.w, l.sp.h, 'Frequency domain: how much of each frequency');
      const sp = plot(l.sp, 28, 22);
      freqGrid(g, sp.x, sp.y, sp.w, sp.h, F0, F1); dbGrid(g, sp.x, sp.y, sp.w, sp.h, DMIN, DMAX, 20, { unit: ' dB' });
      // spectrogram
      box(g, l.sg.x, l.sg.y, l.sg.w, l.sg.h, 'Spectrogram: time runs left to right, frequency goes up');
      const sgp = plot(l.sg, 28, 10);
      ensureSg(sgp.w, sgp.h);

      if (an) {
        an.getFloatTimeDomainData(tbuf);
        const i0 = trigger(tbuf, tbuf.length / 2); const cnt = Math.min(tbuf.length - i0, 1200);
        wave(g, tbuf, tp.x, tp.y, tp.w, tp.h, { from: i0, count: cnt, gain: 1.6, color: src === 'mic' ? C.c2 : C.c1, lw: 1.3 });
        txt(g, `${((cnt / an.context.sampleRate) * 1000).toFixed(1)} ms`, l.td.x + l.td.w - 12, l.td.y + 18, { align: 'right' });
        an.getFloatFrequencyData(fbuf);
        spectrum(g, an, fbuf, sp.x, sp.y, sp.w, sp.h, { f0: F0, f1: F1, dmin: DMIN, dmax: DMAX, color: src === 'mic' ? C.c2 : C.c1, read: false });
        // peak
        let pi = 1; for (let i = 2; i < fbuf.length - 1; i++) if (fbuf[i] > fbuf[pi]) pi = i;
        if (fbuf[pi] > -75) {
          const a = fbuf[pi - 1]; const b = fbuf[pi]; const c = fbuf[pi + 1]; const d = (a - c) / (2 * (a - 2 * b + c) || 1);
          const pf = (pi + d) * an.context.sampleRate / an.fftSize;
          if (pf > F0 && pf < F1) {
            const x = sp.x + logPos(pf, F0, F1) * sp.w; const y = sp.y + (1 - (b - DMIN) / (DMAX - DMIN)) * sp.h;
            g.fillStyle = C.text; g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
            const right = x > sp.x + sp.w * 0.7;
            txt(g, `peak ${fmtHz(pf)} ${pf < 4500 ? noteOf(pf).name : ''}`, right ? x - 8 : x + 8, Math.max(sp.y + 10, y - 6), { align: right ? 'right' : 'left', color: C.text });
          }
        }
        // spectrogram column
        if (!paused) {
          const H = sg.height; const dx = 2;
          sgx.drawImage(sg, -dx, 0);
          const img = sgx.createImageData(dx, H); const binHz = an.context.sampleRate / an.fftSize;
          for (let y = 0; y < H; y++) {
            const f = logFreq(1 - y / H, F0, F1); const b = Math.min(fbuf.length - 1, Math.round(f / binHz));
            const v = (fbuf[b] - (DMIN + 10)) / (DMAX - DMIN - 20); const [r, gg, bb] = heat(v);
            for (let k = 0; k < dx; k++) { const o = (y * dx + k) * 4; img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = bb; img.data[o + 3] = 255; }
          }
          sgx.putImageData(img, sg.width - dx, 0);
        }
      } else {
        txt(g, 'Pick a source and press Listen', tp.x + tp.w / 2, tp.y + tp.h / 2 + 4, { align: 'center' });
      }
      g.drawImage(sg, sgp.x, sgp.y, sgp.w, sgp.h);
      for (const f of [100, 1000, 10000]) { const y = sgp.y + (1 - logPos(f, F0, F1)) * sgp.h; g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(sgp.x, y, 6, 1); txt(g, f >= 1000 ? `${f / 1000}k` : `${f}`, sgp.x + 9, y + 4, { font: '500 10px "DM Mono", monospace', color: C.muted }); }
    });

    const start = async () => {
      an = A.analyser(fft, 0.55); fbuf = new Float32Array(an.frequencyBinCount); tbuf = new Float32Array(an.fftSize); oscs = [];
      if (src === 'mic') {
        const m = await A.mic();
        if (!m) { bar.note('Microphone not available or permission denied. The other sources still work.', true); play.off(); return; }
        m.connect(an); bar.note('Listening to your microphone. It is analysed here and not played back. Try whistling, humming or saying "sss" then "ooo".');
        return;
      }
      bar.note('Start with the volume low. Headphones help.');
      const out = A.gain(0.22); out.connect(an); out.connect(A.out);
      const ac = A.ac;
      if (src === 'sine' || src === 'square' || src === 'saw') { const o = A.osc(src === 'saw' ? 'sawtooth' : src, freq); o.connect(out); oscs.push(o); if (src !== 'sine') out.gain.value = 0.12; }
      else if (src === 'two') { for (const [m, gn] of [[1, 0.6], [1.5, 0.4]]) { const o = A.osc('sine', freq * m); const gg = A.gain(gn); o.connect(gg).connect(out); oscs.push(o); } }
      else if (src === 'white' || src === 'pink') { const s = A.noise(src); s.connect(out); out.gain.value = src === 'white' ? 0.12 : 0.5; }
      else if (src === 'sweep') {
        const o = A.osc('sine', 50); o.connect(out); const t = ac.currentTime;
        for (let i = 0; i < 30; i++) { o.frequency.setValueAtTime(50, t + i * 6); o.frequency.exponentialRampToValueAtTime(16000, t + i * 6 + 5.99); }
      }
    };
    const play = A.toggle('Listen', start, () => { an = null; });
    const bar = A.bar([play]);
    const pause = ctx.h('<button class="btn ghost">Freeze spectrogram</button>');
    pause.addEventListener('click', () => { paused = !paused; pause.textContent = paused ? 'Resume' : 'Freeze spectrogram'; }, { signal: ctx.signal });
    bar.querySelector('.a-play').append(pause);

    const fsl = ctx.slider({ label: 'Tone frequency', min: 0, max: 1000, step: 1, value: Math.round(logPos(freq, 50, 8000) * 1000), fmt: (v) => fmtHz(logFreq(v / 1000, 50, 8000)), onInput: (v) => {
      freq = logFreq(v / 1000, 50, 8000);
      oscs.forEach((o, i) => o.frequency.setTargetAtTime(freq * (src === 'two' && i === 1 ? 1.5 : 1), A.ac.currentTime, 0.02));
    } });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">The spectrum</h2>'),
      ctx.h('<p class="lede">The same sound can be drawn two ways: as pressure over time, or as a list of the frequencies inside it.</p>'),
      bar,
      ctx.seg([['sine', 'Sine'], ['two', 'Two tones'], ['square', 'Square'], ['saw', 'Saw'], ['white', 'White noise'], ['pink', 'Pink noise'], ['sweep', 'Sweep'], ['mic', 'Microphone']], src, (v) => { src = v; play.restart(); }),
      fsl,
      ctx.h('<div class="card tip"><p>The top plot is the <b>time domain</b>: what a microphone measures, moment by moment. The middle one is the <b>frequency domain</b>: how strong each frequency is right now. A pure sine is a single spike. A square or saw is a row of spikes, one per harmonic. Noise is spread over everything.</p><p>The bottom plot stacks spectra over time. Brightness shows strength. Speech, birdsong and music all draw their own patterns there.</p></div>'),
      ctx.h('<div class="card try"><p>1. Listen to Sine and move the slider. One spike moves along the axis.</p><p>2. Switch to Square, then Saw. Count the spikes: the square skips every other one.</p><p>3. Try White noise then Pink noise. White has equal power per hertz, so each bin is level, yet it sounds hissy because the top octave alone holds half of all the hertz. Pink falls 3 dB per octave, giving each octave equal power, and sounds more even.</p><p>4. Pick Microphone and say "sss" then "ooo". Hissing sounds are high and spread out, vowels are stacks of harmonics.</p></div>'),
      ctx.h('<h3>Analysis size</h3>'),
      ctx.seg([[1024, '1024'], [4096, '4096'], [16384, '16384']], fft, (v) => { fft = +v; play.restart(); }),
      ctx.h(`<div class="card deep"><p>The spectrum comes from the <b>Fast Fourier Transform</b> (FFT). It takes a block of N samples and returns N/2 frequency bins, each sample rate / N hertz wide. At 48 kHz with N = 4096 that is about 11.7 Hz per bin, and the block lasts about 85 ms.</p>
        <div class="formula">bin width = sample rate / N<span>block length = N / sample rate. You cannot shrink both.</span></div>
        <p>That is the time and frequency trade off. Pick 16384 and low notes become sharp spikes, but a fast drum hit smears across time. Pick 1024 and drums are crisp but low notes blur into wide humps. Try both on your voice.</p>
        <p>Before the FFT, each block is shaped by a window (the Web Audio analyser uses a Blackman window) to reduce leakage, the skirts you see around a pure tone. The display then smooths over time and shows level in dB.</p></div>`),
    );

    ctx.quiz([
      { q: 'What does a pure sine wave look like on a spectrum?', choices: ['A single narrow spike', 'A flat line across all frequencies', 'A row of evenly spaced spikes'], answer: 0, why: 'A sine has one frequency only, so all its energy is in one place.' },
      { q: 'You make the FFT block longer. What happens?', choices: ['Finer frequency detail, but blurrier timing', 'Finer timing, but blurrier frequency', 'Both get better for free'], answer: 0, why: 'Bin width is sample rate / N. A bigger N gives narrower bins but each analysis covers more time.' },
      { q: 'In a spectrogram, what do the three axes show?', choices: ['Time across, frequency up, brightness for strength', 'Frequency across, time up, colour for pitch', 'Amplitude across, phase up, colour for loudness'], answer: 0, why: 'Time runs along, frequency goes up, and brightness shows how strong each frequency is.' },
    ]);
  },
};
