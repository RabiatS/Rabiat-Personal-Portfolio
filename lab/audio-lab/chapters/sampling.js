// Chapter 6: sampling and sample rate. A real sample and hold in an AudioWorklet, optional anti alias and
// reconstruction filters, a sinc reconstruction on screen and the folding diagram for aliasing.
import { makeAudio } from '../lib/audio.js';
import { C, txt, box, hexA, fmtHz, logPos, logFreq } from '../lib/draw.js';

const NS = 24; // samples shown

export default {
  mount(ctx) {
    const A = makeAudio(ctx);
    const cv = ctx.canvas(); const g = cv.ctx;
    let fs = 8000; let f = 1000; let aaf = false; let recon = true; let hear = 'sampled';
    let osc = null; let crush = null; let aa = []; let rc = []; let dry = null; let wet = null; let sweep = null;
    let drift = 0;

    const alias = (x) => Math.abs(x - fs * Math.round(x / fs));
    const lpMag = (x, fc) => 1 / Math.pow(1 + Math.pow(x / fc, 4), 2); // four cascaded 2nd order Butterworth sections

    const L = () => { const W = cv.w; const H = cv.h; const h1 = Math.round(H * 0.55); return { W, H, t: { x: 0, y: 0, w: W, h: h1 }, f: { x: 0, y: h1 + 12, w: W, h: H - h1 - 12 } }; };

    ctx.loop((t, dt) => {
      drift += dt * 0.25;
      const l = L(); g.clearRect(0, 0, l.W, l.H);
      const r = l.t; box(g, r.x, r.y, r.w, r.h, `${NS} samples at ${fmtHz(fs)}`);
      const x0 = r.x + 14; const w = r.w - 28; const y0 = r.y + 34; const h = r.h - 52; const mid = y0 + h / 2; const sc = h * 0.42;
      const T = NS / fs; const X = (tt) => x0 + (tt / T) * w;
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(x0, mid + 0.5); g.lineTo(x0 + w, mid + 0.5); g.stroke();
      const ga = aaf ? lpMag(f, Math.min(0.45 * fs, 20000)) : 1; const phi = drift;
      // continuous input
      const cyc = f * T;
      if (cyc / w > 0.35) { g.fillStyle = hexA(C.c1, 0.18); g.fillRect(x0, mid - sc, w, 2 * sc); txt(g, 'input too fast to draw', x0 + 6, y0 + 10, { color: C.c1 }); }
      else {
        g.beginPath(); const steps = Math.max(w, cyc * 30);
        for (let i = 0; i <= steps; i++) { const tt = (i / steps) * T; const y = mid - Math.sin(2 * Math.PI * f * tt + phi) * sc; if (i === 0) g.moveTo(x0, y); else g.lineTo(X(tt), y); }
        g.strokeStyle = hexA(C.c1, 0.55); g.lineWidth = 1.3; g.stroke();
      }
      // samples (after the optional anti alias filter, which shrinks fast inputs)
      const xs = (k) => ga * Math.sin(2 * Math.PI * f * (k / fs) + phi);
      // sinc reconstruction from the samples
      g.beginPath();
      for (let px = 0; px <= w; px += 2) {
        const tt = (px / w) * T; const u = tt * fs; let s = 0;
        for (let k = -60; k <= NS + 60; k++) { const d = u - k; s += xs(k) * (Math.abs(d) < 1e-6 ? 1 : Math.sin(Math.PI * d) / (Math.PI * d)); }
        const y = mid - s * sc; if (px === 0) g.moveTo(x0, y); else g.lineTo(x0 + px, y);
      }
      g.strokeStyle = C.c3; g.lineWidth = 2; g.stroke();
      // stems
      for (let k = 0; k <= NS; k++) { const x = X(k / fs); const y = mid - xs(k) * sc; g.strokeStyle = hexA(C.c2, 0.6); g.lineWidth = 1; g.beginPath(); g.moveTo(x, mid); g.lineTo(x, y); g.stroke(); g.fillStyle = C.c2; g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill(); }
      // legend
      const ly = r.y + r.h - 8; let lx = r.x + 14;
      for (const [col, name] of [[C.c1, 'input'], [C.c2, 'samples'], [C.c3, 'rebuilt from samples']]) { g.fillStyle = col; g.fillRect(lx, ly - 7, 10, 3); txt(g, name, lx + 14, ly - 2, { font: '500 10px "DM Mono", monospace' }); lx += 30 + g.measureText(name).width; }

      // folding diagram: input frequency vs the frequency that comes out
      const q = l.f; box(g, q.x, q.y, q.w, q.h, 'Input frequency vs frequency you get back');
      const fx0 = q.x + 50; const fw = q.w - 64; const fy0 = q.y + 34; const fh = q.h - 60; const fmax = Math.max(2 * fs, f * 1.1); const nyq = fs / 2;
      const FX = (v) => fx0 + (v / fmax) * fw; const FY = (v) => fy0 + fh - (v / nyq) * fh;
      g.fillStyle = hexA(C.c1, 0.06); g.fillRect(fx0, fy0, FX(nyq) - fx0, fh);
      g.strokeStyle = 'rgba(255,255,255,.1)'; g.strokeRect(fx0 + 0.5, fy0 + 0.5, fw, fh);
      for (let m = 1; m * nyq <= fmax + 1; m++) { const x = FX(m * nyq); g.strokeStyle = m === 1 ? C.c4 : 'rgba(255,255,255,.08)'; g.setLineDash(m === 1 ? [4, 3] : []); g.beginPath(); g.moveTo(x + 0.5, fy0); g.lineTo(x + 0.5, fy0 + fh); g.stroke(); g.setLineDash([]); if (m % 2 === 0 || m === 1) txt(g, m === 1 ? `Nyquist ${fmtHz(nyq)}` : `${m / 2}× fs`, x, fy0 + fh + 14, { align: m === 1 ? 'left' : 'center', font: '500 10px "DM Mono", monospace', color: m === 1 ? C.c4 : C.subtle }); }
      // triangle
      g.beginPath(); for (let i = 0; i <= 400; i++) { const v = (i / 400) * fmax; const y = FY(alias(v)); if (i === 0) g.moveTo(FX(v), y); else g.lineTo(FX(v), y); }
      g.strokeStyle = hexA(C.c3, 0.8); g.lineWidth = 1.6; g.stroke();
      txt(g, 'out', fx0 - 8, fy0 + 8, { align: 'right', font: '500 10px "DM Mono", monospace' });
      txt(g, fmtHz(nyq), fx0 - 8, fy0 + 4 + 14, { align: 'right', font: '500 9px "DM Mono", monospace', color: C.subtle });
      txt(g, '0', fx0 - 8, fy0 + fh, { align: 'right', font: '500 10px "DM Mono", monospace', color: C.subtle });
      const fa = alias(f); const px = FX(f); const py = FY(fa);
      g.strokeStyle = hexA(C.c1, 0.7); g.beginPath(); g.moveTo(px + 0.5, fy0 + fh); g.lineTo(px + 0.5, py); g.stroke();
      g.strokeStyle = hexA(C.c3, 0.7); g.setLineDash([3, 3]); g.beginPath(); g.moveTo(px, py + 0.5); g.lineTo(fx0, py + 0.5); g.stroke(); g.setLineDash([]);
      g.fillStyle = f > nyq ? C.c4 : C.c1; g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fill();
      const lab = f > nyq ? (aaf ? `${fmtHz(f)} is above Nyquist: the filter removes it` : `${fmtHz(f)} comes back as ${fmtHz(fa)}`) : `${fmtHz(f)} comes back as itself`;
      const right = px > fx0 + fw * 0.55; txt(g, lab, right ? px - 10 : px + 10, Math.max(fy0 + 12, py - 8), { align: right ? 'right' : 'left', color: C.text });
    });

    function setFilters() {
      if (!A.ac) return; const t = A.ac.currentTime; const cut = Math.min(0.45 * fs, A.ac.sampleRate * 0.45);
      for (const b of [...aa, ...rc]) b.frequency.setTargetAtTime(cut, t, 0.01);
    }
    function route() {
      if (!osc) return;
      const t = A.ac.currentTime;
      if (dry) dry.gain.setTargetAtTime(hear === 'original' ? 1 : 0, t, 0.02);
      if (wet) wet.gain.setTargetAtTime(hear === 'original' ? 0 : 1, t, 0.02);
      // anti alias: switch the input of the crusher between direct and filtered
      try { osc.disconnect(); } catch { /* ok */ }
      osc.connect(dry);
      if (aaf) osc.connect(aa[0]); else if (crush) osc.connect(crush);
      if (aa.length) { try { aa[aa.length - 1].disconnect(); } catch { /* ok */ } if (aaf && crush) aa[aa.length - 1].connect(crush); }
      if (crush) { try { crush.disconnect(); } catch { /* ok */ } if (recon) crush.connect(rc[0]); else crush.connect(wet); }
    }
    const start = async () => {
      const ac = A.ac; crush = await A.crusher();
      if (!crush) bar.note('This browser could not start the sampler, so you hear the plain tone. The pictures still work.', true);
      else { crush.parameters.get('rate').value = fs; bar.note('Start with the volume low. Headphones help.'); }
      osc = A.osc('sine', f); const out = A.gain(0.22); out.connect(A.out);
      dry = A.gain(0); wet = A.gain(1); dry.connect(out); wet.connect(out);
      aa = []; rc = [];
      for (let i = 0; i < 4; i++) { const b = ac.createBiquadFilter(); b.type = 'lowpass'; b.Q.value = -3.01; A.add(b); if (aa.length) aa[aa.length - 1].connect(b); aa.push(b); }
      for (let i = 0; i < 4; i++) { const b = ac.createBiquadFilter(); b.type = 'lowpass'; b.Q.value = -3.01; A.add(b); if (rc.length) rc[rc.length - 1].connect(b); rc.push(b); }
      rc[rc.length - 1].connect(wet);
      if (!crush) { hear = 'original'; }
      setFilters(); route();
    };
    const play = A.toggle('Play', start, () => { osc = null; crush = null; dry = null; wet = null; stopSweep(); });
    const bar = A.bar([play]);

    const toF = (v) => logFreq(v / 1000, 50, 24000); const fromF = (x) => Math.round(logPos(x, 50, 24000) * 1000);
    const fsl = ctx.slider({ label: 'Input tone', min: 0, max: 1000, step: 1, value: fromF(f), fmt: (v) => fmtHz(toF(v)), onInput: (v) => setF(toF(v), true) });
    const rates = [2000, 4000, 8000, 11025, 16000, 22050, 32000, 44100, 48000];
    const ssl = ctx.slider({ label: 'Sample rate', min: 0, max: rates.length - 1, step: 1, value: rates.indexOf(fs), fmt: (v) => fmtHz(rates[v]), onInput: (v) => { fs = rates[v]; if (crush) crush.parameters.get('rate').value = fs; setFilters(); upd(); } });
    const stats = ctx.h('<div class="stat"><div><b class="s-n">-</b><span>Nyquist</span></div><div><b class="s-a">-</b><span>You hear</span></div><div><b class="s-p">-</b><span>Samples per cycle</span></div></div>');
    function setF(v, fromSl) { f = v; if (!fromSl) fsl.value = fromF(v); fsl.querySelector('output').textContent = fmtHz(f); if (osc) osc.frequency.setTargetAtTime(f, A.ac.currentTime, 0.01); upd(); }
    function upd() {
      stats.querySelector('.s-n').textContent = fmtHz(fs / 2);
      const heard = hear === 'original' ? f : (f > fs / 2 && aaf ? 0 : alias(f));
      stats.querySelector('.s-a').textContent = heard ? fmtHz(heard) : 'silence';
      stats.querySelector('.s-p').textContent = (fs / f).toFixed(fs / f < 10 ? 2 : 0);
    }
    function stopSweep() { if (sweep) { sweep(); sweep = null; sweepBtn.textContent = 'Sweep the input up'; } }
    const sweepBtn = ctx.h('<button class="btn ghost">Sweep the input up</button>');
    sweepBtn.addEventListener('click', async () => {
      if (sweep) { stopSweep(); return; }
      if (!play.on) { play.click(); await new Promise((r) => setTimeout(r, 200)); }
      const t0 = performance.now(); const top = Math.min(24000, fs * 1.6); sweepBtn.textContent = 'Stop sweep';
      sweep = ctx.loop(() => { const s = (performance.now() - t0) / 9000; if (s >= 1) { stopSweep(); return; } setF(100 * Math.pow(top / 100, s)); });
    }, { signal: ctx.signal });
    bar.querySelector('.a-play').append(sweepBtn);

    const opts = ctx.h('<div style="display:grid;gap:6px"><label class="check"><input type="checkbox" class="o-aa"> Anti alias filter before sampling</label><label class="check"><input type="checkbox" class="o-rc" checked> Reconstruction filter after</label></div>');
    opts.querySelector('.o-aa').addEventListener('change', (e) => { aaf = e.target.checked; route(); upd(); });
    opts.querySelector('.o-rc').addEventListener('change', (e) => { recon = e.target.checked; route(); });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Sampling and sample rate</h2>'),
      ctx.h('<p class="lede">A computer cannot store a smooth wave. It measures the wave many times a second and keeps the numbers.</p>'),
      bar,
      ctx.seg([['sampled', 'Hear sampled'], ['original', 'Hear original']], hear, (v) => { hear = v; route(); upd(); }),
      ssl, fsl, stats, opts,
      ctx.h('<div class="card tip"><p>Each measurement is a <b>sample</b>. The number of samples per second is the <b>sample rate</b>. CD audio takes 44,100 a second.</p><p>Here is the surprising part: if the wave is slow enough, the samples hold <i>everything</i> about it, and a smooth curve (violet) can be rebuilt that matches the original exactly. The limit is the <b>Nyquist frequency</b>, half the sample rate. Anything faster than that gets confused for a slower wave. That is <b>aliasing</b>.</p></div>'),
      ctx.h('<div class="card try"><p>1. At 8 kHz, press Play and then <b>Sweep the input up</b>. The tone rises, hits 4 kHz, then <i>falls</i> while the input is still rising. The dot rides the folded line on the stage.</p><p>2. Set the input to about 7 kHz. The samples trace a 1 kHz wave. Switch between Hear sampled and Hear original.</p><p>3. Turn on the <b>anti alias filter</b> and sweep again. Above Nyquist the tone fades away instead of folding back. That is what real converters do.</p><p>4. Turn off the reconstruction filter to hear the raw steps: extra high images that a DAC would normally smooth away.</p></div>'),
      ctx.h(`<div class="card deep"><p>The Nyquist and Shannon sampling theorem: a signal with no content at or above fs/2 is fully determined by its samples, and is rebuilt by summing one sinc pulse per sample.</p>
        <div class="formula">x(t) = Σ x[n] · sinc(fs·t − n)<span>alias of f: |f − fs × round(f / fs)|</span></div>
        <p>Above Nyquist, frequencies fold around fs/2 like paper: at fs = 8 kHz, 5 kHz comes back as 3 kHz, 7 kHz as 1 kHz and 9 kHz as 1 kHz. Once aliased, it cannot be told apart from a real tone, so the filter has to come <i>before</i> sampling.</p>
        <p>Why 44.1 kHz and 48 kHz? Hearing tops out near 20 kHz, so you need over 40 kHz plus room for the anti alias filter to roll off. 44.1 kHz came from early digital recorders that stored audio on video tape, and 48 kHz became the standard for video and broadcast. Higher rates like 96 kHz mainly help in production, for processing and gentler filters.</p>
        <p>This demo samples with a simple sample and hold running inside your sound card's own rate, so timing is rounded to the nearest real sample. The filters are 8th order, steeper than a quick sketch but far gentler than the ones in a real converter.</p></div>`),
    );
    upd();

    ctx.quiz([
      { q: 'Audio is sampled at 48 kHz. What is the highest frequency it can hold?', choices: ['48 kHz', '24 kHz', '96 kHz'], answer: 1, why: 'The Nyquist frequency is half the sample rate.' },
      { q: 'At a sample rate of 10 kHz, with no filter, what do you hear from a 9 kHz tone?', choices: ['9 kHz', '1 kHz', 'Nothing'], answer: 1, why: '9 kHz folds around Nyquist (5 kHz) and comes back at 10 − 9 = 1 kHz.' },
      { q: 'Where must the anti alias filter go?', choices: ['After the DAC, before the speaker', 'Before sampling, so nothing above Nyquist reaches the converter', 'It does not matter'], answer: 1, why: 'After sampling, an alias looks exactly like a real low tone and cannot be removed.' },
    ]);
  },
};
