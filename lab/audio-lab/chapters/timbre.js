// Chapter 4: waveforms and timbre. Additive synthesis with 16 draggable harmonics, presets for the classic
// waveforms and rough instrument colours, a Fourier series builder and a phase scramble.
import { makeAudio } from '../lib/audio.js';
import { C, txt, box, hexA, fmtHz, logPos, logFreq, drag, noteOf } from '../lib/draw.js';

const N = 16;
const PRESETS = {
  sine: { label: 'Sine', ideal: null, f: (n) => [n === 1 ? 1 : 0, 0] },
  square: { label: 'Square', ideal: 'square', f: (n) => [n % 2 ? 1 / n : 0, 0] },
  saw: { label: 'Saw', ideal: 'saw', f: (n) => [1 / n, n % 2 ? 0 : Math.PI] },
  triangle: { label: 'Triangle', ideal: 'triangle', f: (n) => [n % 2 ? 1 / (n * n) : 0, ((n - 1) / 2) % 2 ? Math.PI : 0] },
  flute: { label: 'Flute-like', ideal: null, f: (n) => [[1, 0.42, 0.16, 0.09, 0.04, 0.02][n - 1] || 0, 0] },
  clarinet: { label: 'Clarinet-like', ideal: null, f: (n) => [n % 2 ? Math.pow(n, -0.9) : 0.04 / n, 0] },
  brass: { label: 'Brass-like', ideal: null, f: (n) => [(n * Math.exp(-n / 3.2)) / 1.2, 0] },
  organ: { label: 'Organ', ideal: null, f: (n) => [{ 1: 1, 2: 0.75, 3: 0.55, 4: 0.5, 6: 0.32, 8: 0.3 }[n] || 0, 0] },
};
const SCALE = { square: Math.PI / 4, saw: Math.PI / 2, triangle: (Math.PI * Math.PI) / 8 };
const idealAt = (kind, th) => {
  const x = ((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  if (kind === 'square') return x < Math.PI ? 1 : -1;
  if (kind === 'saw') { const y = x <= Math.PI ? x : x - 2 * Math.PI; return y / Math.PI; }
  if (kind === 'triangle') { if (x < Math.PI / 2) return x / (Math.PI / 2); if (x < 1.5 * Math.PI) return 1 - (x - Math.PI / 2) / (Math.PI / 2); return -1 + (x - 1.5 * Math.PI) / (Math.PI / 2); }
  return 0;
};

export default {
  mount(ctx) {
    const A = makeAudio(ctx);
    const cv = ctx.canvas(); const g = cv.ctx;
    const amp = new Float32Array(N + 1); const ph = new Float32Array(N + 1);
    let ideal = null; let f0 = 220; let showParts = false; let osc = null; let og = null; let building = null; let presetName = 'square';
    let pending = false;

    function setPreset(k) {
      presetName = k; const p = PRESETS[k]; ideal = p.ideal;
      for (let n = 1; n <= N; n++) { const [a, phi] = p.f(n); amp[n] = a; ph[n] = phi; }
      const mx = Math.max(...amp); if (mx > 0) for (let n = 1; n <= N; n++) amp[n] /= mx === 1 ? 1 : mx;
      changed();
    }
    function changed() {
      if (!osc || pending) return; pending = true;
      requestAnimationFrame(() => { pending = false; if (osc) osc.setPeriodicWave(makeWave()); });
    }
    function makeWave() {
      const real = new Float32Array(N + 1); const imag = new Float32Array(N + 1);
      // a sin(nwt + phi) = a cos(phi) sin(nwt) + a sin(phi) cos(nwt)
      let any = false;
      for (let n = 1; n <= N; n++) { if (n * f0 > A.ac.sampleRate / 2) continue; imag[n] = amp[n] * Math.cos(ph[n]); real[n] = amp[n] * Math.sin(ph[n]); if (amp[n] > 0) any = true; }
      if (!any) imag[1] = 1e-6;
      return A.ac.createPeriodicWave(real, imag);
    }

    const L = () => {
      const W = cv.w; const H = cv.h; const h1 = Math.round(H * 0.52);
      return { W, H, wv: { x: 0, y: 0, w: W, h: h1 }, hb: { x: 0, y: h1 + 12, w: W, h: H - h1 - 12 } };
    };
    const barGeom = (r) => { const x0 = r.x + 20; const w = r.w - 40; const bw = w / N; return { x0, w, bw, y0: r.y + 34, h: r.h - 62 }; };

    ctx.loop(() => {
      const l = L(); g.clearRect(0, 0, l.W, l.H);
      const r = l.wv; box(g, r.x, r.y, r.w, r.h, 'Two cycles of the wave');
      const x0 = r.x + 14; const w = r.w - 28; const y0 = r.y + 32; const h = r.h - 46; const mid = y0 + h / 2; const sc = h / 2 / 1.3;
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(x0, mid + 0.5); g.lineTo(x0 + w, mid + 0.5); g.stroke();
      const M = Math.max(200, Math.floor(w));
      const sum = new Float32Array(M + 1);
      for (let i = 0; i <= M; i++) { const th = (i / M) * 4 * Math.PI; let s = 0; for (let n = 1; n <= N; n++) if (amp[n]) s += amp[n] * Math.sin(n * th + ph[n]); sum[i] = s; }
      let norm;
      if (ideal) norm = SCALE[ideal] / (amp[1] || 1); else { let mx = 0; for (const v of sum) mx = Math.max(mx, Math.abs(v)); norm = mx > 0 ? 1 / mx : 1; }
      if (showParts) {
        for (let n = 1; n <= N; n++) {
          if (amp[n] < 0.01) continue; g.beginPath();
          for (let i = 0; i <= M; i += 2) { const th = (i / M) * 4 * Math.PI; const y = mid - amp[n] * norm * Math.sin(n * th + ph[n]) * sc; if (i === 0) g.moveTo(x0, y); else g.lineTo(x0 + (i / M) * w, y); }
          g.strokeStyle = hexA(C.c3, 0.35); g.lineWidth = 1; g.stroke();
        }
      }
      if (ideal) {
        g.beginPath(); for (let i = 0; i <= M; i++) { const th = (i / M) * 4 * Math.PI; const y = mid - idealAt(ideal, th) * sc; if (i === 0) g.moveTo(x0, y); else g.lineTo(x0 + (i / M) * w, y); }
        g.setLineDash([4, 4]); g.strokeStyle = hexA(C.c2, 0.7); g.lineWidth = 1.2; g.stroke(); g.setLineDash([]);
        txt(g, `ideal ${ideal}`, r.x + r.w - 12, r.y + 20, { align: 'right', color: C.c2 });
      }
      g.beginPath(); for (let i = 0; i <= M; i++) { const y = mid - sum[i] * norm * sc; if (i === 0) g.moveTo(x0, y); else g.lineTo(x0 + (i / M) * w, y); }
      g.strokeStyle = C.c1; g.lineWidth = 2; g.lineJoin = 'round'; g.stroke();

      // harmonic bars
      const q = l.hb; box(g, q.x, q.y, q.w, q.h, 'Harmonics: drag the bars');
      const b = barGeom(q);
      for (const v of [0.25, 0.5, 0.75, 1]) { const y = b.y0 + b.h - v * b.h + 0.5; g.strokeStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(b.x0, y); g.lineTo(b.x0 + b.w, y); g.stroke(); }
      for (let n = 1; n <= N; n++) {
        const x = b.x0 + (n - 1) * b.bw; const bh = amp[n] * b.h; const above = n * f0 > 20000;
        g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x + 2, b.y0, b.bw - 4, b.h);
        g.fillStyle = above ? hexA(C.muted, 0.4) : (n === 1 ? C.c1 : C.c3); g.fillRect(x + 2, b.y0 + b.h - bh, b.bw - 4, bh);
        if (ph[n] > 0.01 && amp[n] > 0.01) { g.fillStyle = C.c2; g.fillRect(x + 2, b.y0 + b.h - bh - 3, b.bw - 4, 2); }
        txt(g, `${n}`, x + b.bw / 2, b.y0 + b.h + 13, { align: 'center', font: '500 10px "DM Mono", monospace', color: n === 1 ? C.c1 : C.muted });
        if (b.bw > 44 || n === 1 || n === N) txt(g, fmtHz(n * f0).replace(' ', ''), x + b.bw / 2, b.y0 + b.h + 25, { align: 'center', font: '500 9px "DM Mono", monospace', color: C.subtle });
      }
    });

    drag(cv.el, (x, y, e, phase) => {
      if (phase !== 'down' && phase !== 'move') return;
      const q = L().hb; if (y < q.y - 4) return;
      const b = barGeom(q); const n = Math.floor((x - b.x0) / b.bw) + 1; if (n < 1 || n > N) return;
      amp[n] = Math.max(0, Math.min(1, (b.y0 + b.h - y) / b.h)); if (amp[n] < 0.02) amp[n] = 0;
      ideal = null; presetSeg.set(''); stopBuild(); changed();
    }, ctx.signal);

    const start = async () => {
      og = A.gain(0); og.connect(A.out);
      osc = A.ac.createOscillator(); A.add(osc); osc.frequency.value = f0; osc.setPeriodicWave(makeWave()); osc.connect(og); osc.start();
      og.gain.setTargetAtTime(0.28, A.ac.currentTime, 0.03);
    };
    const play = A.toggle('Play', start, () => { osc = null; og = null; });
    const pluck = ctx.h('<button class="btn ghost">Pluck</button>');
    pluck.addEventListener('click', async () => {
      await A.ready(); if (!A.alive) return;
      const o = A.ac.createOscillator(); A.add(o); o.frequency.value = f0; o.setPeriodicWave(makeWave());
      const e = A.ac.createGain(); const t = A.ac.currentTime;
      e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.4, t + 0.005); e.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(e).connect(A.out); o.start(t); o.stop(t + 1.5);
    }, { signal: ctx.signal });

    const presetSeg = ctx.seg(Object.entries(PRESETS).map(([k, p]) => [k, p.label]), presetName, (k) => { stopBuild(); setPreset(k); });
    const toS = (v) => Math.round(logPos(v, 55, 880) * 1000);
    const fsl = ctx.slider({ label: 'Fundamental', min: 0, max: 1000, step: 1, value: toS(f0), fmt: (v) => { const f = logFreq(v / 1000, 55, 880); return `${fmtHz(f)} ${noteOf(f).name}`; }, onInput: (v) => { f0 = logFreq(v / 1000, 55, 880); if (osc) { osc.frequency.setTargetAtTime(f0, A.ac.currentTime, 0.01); changed(); } } });

    const buildBtn = ctx.h('<button class="btn ghost sm">Build a square, one harmonic at a time</button>');
    const buildMsg = ctx.h('<p class="hint"></p>');
    function stopBuild() { if (building) { clearInterval(building); building = null; buildMsg.textContent = ''; } }
    buildBtn.addEventListener('click', () => {
      stopBuild(); presetSeg.set('square'); presetName = 'square';
      for (let n = 1; n <= N; n++) { amp[n] = 0; ph[n] = 0; }
      ideal = 'square'; let n = 1; amp[1] = 1; buildMsg.textContent = 'Harmonic 1: a plain sine.'; changed();
      building = setInterval(() => {
        n += 2; if (n > 15) { stopBuild(); buildMsg.textContent = 'Odd harmonics 1 to 15 at 1/n. The corners sharpen, with a small overshoot that never goes away (the Gibbs effect).'; return; }
        amp[n] = 1 / n; buildMsg.textContent = `Added harmonic ${n} at 1/${n} of the strength.`; changed();
      }, 900);
    }, { signal: ctx.signal });
    ctx.signal.addEventListener('abort', stopBuild);

    const scramble = ctx.h('<button class="btn ghost sm">Scramble phases</button>');
    scramble.addEventListener('click', () => { stopBuild(); for (let n = 2; n <= N; n++) ph[n] = Math.random() * 2 * Math.PI; ideal = null; presetSeg.set(''); changed(); }, { signal: ctx.signal });
    const parts = ctx.h('<label class="check"><input type="checkbox"> Show each harmonic on its own</label>');
    parts.querySelector('input').addEventListener('change', (e) => { showParts = e.target.checked; });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Waveforms and timbre</h2>'),
      ctx.h('<p class="lede">A violin and a flute can play the same note and still sound nothing alike. The difference is in the harmonics.</p>'),
      A.bar([play, pluck]),
      presetSeg, fsl,
      ctx.h('<div class="card tip"><p>Almost every musical sound is a stack of sine waves. The lowest one, the <b>fundamental</b>, sets the pitch. The others sit at 2, 3, 4… times that frequency and are called <b>harmonics</b>.</p><p>How strong each harmonic is gives the sound its colour, or <b>timbre</b>. A sine has none and sounds pure. A square wave has only odd harmonics and sounds hollow. A saw has all of them and sounds bright and buzzy.</p></div>'),
      ctx.h('<div class="row"></div>'), buildMsg, parts,
      ctx.h('<div class="card try"><p>1. Press Play and step through Sine, Triangle, Square and Saw. Look at the bars: more and stronger upper harmonics means a brighter sound.</p><p>2. Press <b>Build a square</b> and watch a sine grow corners as odd harmonics are added.</p><p>3. Drag bars yourself. Turn off the fundamental (bar 1) and the pitch you hear often stays the same: your brain fills in the missing fundamental.</p><p>4. Press <b>Scramble phases</b>. The shape changes a lot, but the sound barely changes. Your ear mostly hears which harmonics are present and how strong, not how they line up.</p></div>'),
      ctx.h(`<div class="card deep"><p>Fourier showed that any repeating wave can be written as a sum of sines at whole number multiples of its frequency:</p>
        <div class="formula">x(t) = Σ aₙ sin(2π n f₀ t + φₙ)<span>square: odd n, aₙ = 1/n. saw: every n, aₙ = 1/n. triangle: odd n, aₙ = 1/n², alternating sign</span></div>
        <p>A perfect square needs infinitely many harmonics. Cut it off and you get ripples with an overshoot of about 9 percent at each jump, however many you add. That is the Gibbs phenomenon.</p>
        <p>Grey bars are above 20 kHz for the chosen fundamental, so you cannot hear them, and the synth skips any above the Nyquist limit to avoid aliasing (chapter 6). Amber marks show a harmonic with a shifted phase.</p>
        <p>The instrument presets are rough sketches. Real instruments also change over time: the attack (the scrape of a bow, the chiff of a flute), how harmonics fade at different rates, vibrato and noise. Press Pluck to hear how a quick attack and decay alone already make the same spectrum sound more like a plucked string.</p></div>`),
    );
    ctx.panel.querySelectorAll('.row')[0].append(buildBtn, scramble);
    setPreset(presetName);

    ctx.quiz([
      { q: 'Two instruments play the same note at the same loudness. What mainly makes them sound different?', choices: ['Their fundamental frequency', 'The mix of harmonics and how it changes over time', 'The speed of sound'], answer: 1, why: 'Same pitch means the same fundamental. Timbre comes from the harmonics and the envelope.' },
      { q: 'Which harmonics does a square wave contain?', choices: ['Only odd harmonics, getting weaker as 1/n', 'All harmonics equally strong', 'Only the fundamental'], answer: 0, why: 'A square wave is the sum of odd harmonics with strength 1/n.' },
      { q: 'A tone has a fundamental of 200 Hz. Where is its 3rd harmonic?', choices: ['203 Hz', '600 Hz', '800 Hz'], answer: 1, why: 'The nth harmonic sits at n times the fundamental: 3 × 200 = 600 Hz.' },
    ]);
  },
};
