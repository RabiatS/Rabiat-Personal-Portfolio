// Chapter 10: compression and file formats. Bitrate maths, a size chart, a masking demo you can hear,
// and a real lossy encode of the music loop with the browser's own encoder (MediaRecorder).
import { makeAudio } from '../lib/audio.js';
import { createBand } from '../lib/music.js';
import { C, txt, box, hexA, fmtHz, logPos, logFreq, drag } from '../lib/draw.js';

const F0 = 50; const F1 = 16000; const DMIN = -10; const DMAX = 100;
const bark = (f) => 13 * Math.atan(0.00076 * f) + 3.5 * Math.atan((f / 7500) ** 2);
const ath = (f) => { const k = f / 1000; return 3.64 * Math.pow(k, -0.8) - 6.5 * Math.exp(-0.6 * (k - 3.3) ** 2) + 1e-3 * k ** 4; };

export default {
  mount(ctx) {
    const A = makeAudio(ctx);
    const cv = ctx.canvas(); const g = cv.ctx;
    let fm = 1000; let Lm = 75; let fp = 1300; let Lp = 35; let maskerOn = true;
    let om = null; let op = null; let gm = null; let gp = null;
    let minutes = 3; let rate = 44100; let bits = 16; let chans = 2;

    const thr = (f) => {
      const dz = bark(f) - bark(fm);
      const spread = dz < 0 ? 27 * dz : -12 * dz; // dB per Bark below and above the masker (rough textbook values)
      const m = maskerOn ? Lm - 12 + spread : -Infinity;
      return Math.max(ath(f), m);
    };
    const audible = () => Lp > thr(fp);

    const L = () => { const W = cv.w; const H = cv.h; const h1 = Math.round(H * 0.56); return { W, H, a: { x: 0, y: 0, w: W, h: h1 }, b: { x: 0, y: h1 + 12, w: W, h: H - h1 - 12 } }; };
    const P = (r) => ({ x: r.x + 40, y: r.y + 40, w: r.w - 54, h: r.h - 60 });
    const Y = (p, d) => p.y + (1 - (d - DMIN) / (DMAX - DMIN)) * p.h;
    const X = (p, f) => p.x + logPos(f, F0, F1) * p.w;

    const FORMATS = () => {
      const pcm = (rate * bits * chans) / 1000;
      return [
        ['WAV (your settings)', pcm, pcm, C.c5],
        ['FLAC (lossless)', pcm * 0.5, pcm * 0.7, C.c1],
        ['MP3 320 kbps', 320, 320, C.c2],
        ['AAC 256 kbps', 256, 256, C.c2],
        ['MP3 128 kbps', 128, 128, C.c4],
        ['Opus 96 kbps', 96, 96, C.c3],
        ['Opus 24 kbps (voice)', 24, 24, C.c3],
      ];
    };

    ctx.loop(() => {
      const l = L(); g.clearRect(0, 0, l.W, l.H);
      const r = l.a; box(g, r.x, r.y, r.w, r.h, r.w < 500 ? 'Masking (level in dB)' : 'Masking: a loud tone hides quiet ones near it (level in dB)');
      const p = P(r);
      for (const f of [100, 200, 500, 1000, 2000, 5000, 10000]) { const x = Math.round(X(p, f)) + 0.5; g.strokeStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(x, p.y); g.lineTo(x, p.y + p.h); g.stroke(); txt(g, f >= 1000 ? `${f / 1000}k` : `${f}`, x, p.y + p.h + 13, { align: 'center', font: '500 10px "DM Mono", monospace', color: C.subtle }); }
      for (let d = 0; d <= 100; d += 20) { const y = Math.round(Y(p, d)) + 0.5; g.strokeStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(p.x, y); g.lineTo(p.x + p.w, y); g.stroke(); txt(g, `${d}`, p.x - 6, y + 4, { align: 'right', font: '500 10px "DM Mono", monospace', color: C.subtle }); }
      // threshold area
      g.beginPath(); for (let i = 0; i <= 300; i++) { const f = logFreq(i / 300, F0, F1); const y = Y(p, Math.min(DMAX, thr(f))); if (i === 0) g.moveTo(p.x, y); else g.lineTo(X(p, f), y); }
      g.lineTo(p.x + p.w, p.y + p.h); g.lineTo(p.x, p.y + p.h); g.closePath(); g.fillStyle = 'rgba(167,139,250,.12)'; g.fill();
      g.beginPath(); for (let i = 0; i <= 300; i++) { const f = logFreq(i / 300, F0, F1); const y = Y(p, Math.min(DMAX, thr(f))); if (i === 0) g.moveTo(p.x, y); else g.lineTo(X(p, f), y); }
      g.strokeStyle = C.c3; g.lineWidth = 1.6; g.stroke();
      txt(g, 'you cannot hear anything in the shaded area', p.x + 8, p.y + p.h - 8, { color: C.c3, font: '500 10px "DM Mono", monospace' });
      // masker
      const mx = X(p, fm); g.strokeStyle = maskerOn ? C.c2 : hexA(C.c2, 0.3); g.lineWidth = 4; g.beginPath(); g.moveTo(mx, p.y + p.h); g.lineTo(mx, Y(p, Lm)); g.stroke();
      txt(g, `masker ${fmtHz(fm)}`, mx, Y(p, Lm) - 8, { align: 'center', color: maskerOn ? C.c2 : C.subtle });
      // probe
      const px = X(p, fp); const ok = audible(); const col = ok ? C.c1 : C.c4;
      g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(px, p.y + p.h); g.lineTo(px, Y(p, Lp)); g.stroke();
      g.fillStyle = C.bg; g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.arc(px, Y(p, Lp), 7, 0, Math.PI * 2); g.fill(); g.stroke();
      const right = px > p.x + p.w * 0.66;
      txt(g, p.w < 500 ? (ok ? 'audible' : 'masked') : (ok ? 'quiet tone: audible, must be kept' : 'quiet tone: masked, can be dropped'), right ? px - 12 : px + 12, Y(p, Lp) + 4, { align: right ? 'right' : 'left', color: col });

      // sizes
      const q = l.b; const secs = minutes * 60;
      box(g, q.x, q.y, q.w, q.h, `File size for ${minutes} minute${minutes === 1 ? '' : 's'} of stereo audio`);
      const list = FORMATS(); const maxK = Math.max(...list.map((x) => x[2])); const rh = Math.min(26, (q.h - 40) / list.length - 4);
      const lw = Math.min(170, q.w * 0.36); const bx = q.x + 14 + lw; const bw = q.w - lw - 110;
      list.forEach(([name, lo, hi, c], i) => {
        const y = q.y + 30 + i * (rh + 4); const mb = (k) => (k * 1000 * secs) / 8 / 1e6;
        txt(g, name, q.x + 14, y + rh - 5, { color: C.text2, font: `500 ${q.w < 500 ? 9 : 11}px "DM Mono", monospace` });
        g.fillStyle = hexA(c, 0.75); g.fillRect(bx, y, Math.max(2, (lo / maxK) * bw), rh);
        if (hi > lo) { g.fillStyle = hexA(c, 0.3); g.fillRect(bx + (lo / maxK) * bw, y, ((hi - lo) / maxK) * bw, rh); }
        const label = hi > lo ? `${mb(lo).toFixed(0)} to ${mb(hi).toFixed(0)} MB` : `${mb(lo) < 10 ? mb(lo).toFixed(1) : mb(lo).toFixed(0)} MB`;
        txt(g, label, bx + (hi / maxK) * bw + 6, y + rh - 5, { color: C.muted, font: '500 10px "DM Mono", monospace' });
      });
    });

    drag(cv.el, (x, y, e, phase) => {
      if (phase !== 'down' && phase !== 'move') return;
      const l = L(); if (y > l.a.y + l.a.h) return;
      const p = P(l.a);
      fp = Math.max(F0, Math.min(F1, logFreq((x - p.x) / p.w, F0, F1)));
      Lp = Math.round(Math.max(0, Math.min(90, DMIN + (1 - (y - p.y) / p.h) * (DMAX - DMIN))));
      applyTones(); upd();
    }, ctx.signal);

    // the "dB" here is a playback scale: 100 means close to full scale
    const gainOf = (d) => Math.pow(10, (d - 100) / 20) * 0.6;
    function applyTones() {
      if (!om) return; const t = A.ac.currentTime;
      om.frequency.setTargetAtTime(fm, t, 0.02); op.frequency.setTargetAtTime(fp, t, 0.02);
      gm.gain.setTargetAtTime(maskerOn ? gainOf(Lm) : 0, t, 0.02); gp.gain.setTargetAtTime(gainOf(Lp), t, 0.02);
    }
    const startTones = async () => { om = A.osc('sine', fm); op = A.osc('sine', fp); gm = A.gain(0); gp = A.gain(0); om.connect(gm).connect(A.out); op.connect(gp).connect(A.out); applyTones(); };
    const play = A.toggle('Play the tones', startTones, () => { om = null; op = null; });
    const mBtn = ctx.h('<button class="btn ghost">Masker on</button>');
    mBtn.addEventListener('click', () => { maskerOn = !maskerOn; mBtn.textContent = maskerOn ? 'Masker on' : 'Masker off'; applyTones(); upd(); }, { signal: ctx.signal });
    const status = ctx.h('<p class="hint"></p>');
    function upd() { status.textContent = `Quiet tone ${fmtHz(fp)} at ${Lp} dB, threshold here ${thr(fp).toFixed(0)} dB: ${audible() ? 'audible' : 'masked'}.`; }

    // bitrate calculator
    const calc = ctx.h('<div class="stat"><div><b class="c-k">-</b><span>PCM bitrate</span></div><div><b class="c-m">-</b><span>Per minute</span></div><div><b class="c-r">-</b><span>vs MP3 128</span></div></div>');
    function updCalc() {
      const k = (rate * bits * chans) / 1000;
      calc.querySelector('.c-k').textContent = `${k.toLocaleString(undefined, { maximumFractionDigits: 1 })} kbps`;
      calc.querySelector('.c-m').textContent = `${((k * 1000 * 60) / 8 / 1e6).toFixed(1)} MB`;
      calc.querySelector('.c-r').textContent = `${(k / 128).toFixed(1)}×`;
    }
    const rateSeg = ctx.seg([[22050, '22.05k'], [44100, '44.1k'], [48000, '48k'], [96000, '96k']], rate, (v) => { rate = +v; updCalc(); });
    const bitSeg = ctx.seg([[16, '16 bit'], [24, '24 bit']], bits, (v) => { bits = +v; updCalc(); });
    const chSeg = ctx.seg([[1, 'Mono'], [2, 'Stereo']], chans, (v) => { chans = +v; updCalc(); });
    const minSl = ctx.slider({ label: 'Length', min: 1, max: 60, step: 1, value: minutes, unit: ' min', onInput: (v) => { minutes = v; } });

    // real encode with MediaRecorder
    const enc = ctx.h(`<div class="card"><b class="mono small">Hear a real lossy encode</b>
      <p class="small muted">Records 6 seconds of the music loop through your browser's own encoder at the bitrate you pick, then plays it back.</p>
      <div class="e-seg"></div><div class="row"><button class="btn sm e-rec">Encode</button><button class="btn ghost sm e-play" disabled>Play encoded</button><button class="btn ghost sm e-orig">Play original</button></div><p class="hint e-msg"></p></div>`);
    let encRate = 16000; let encBuf = null;
    enc.querySelector('.e-seg').append(ctx.seg([[6000, '6k'], [16000, '16k'], [32000, '32k'], [64000, '64k'], [128000, '128k']], encRate, (v) => { encRate = +v; }));
    const msg = enc.querySelector('.e-msg'); const recB = enc.querySelector('.e-rec'); const playB = enc.querySelector('.e-play'); const origB = enc.querySelector('.e-orig');
    const mime = (() => { if (typeof MediaRecorder === 'undefined') return null; for (const m of ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { /* no */ } } return null; })();
    if (!mime) { msg.textContent = 'This browser cannot record audio here, so this part is unavailable.'; recB.disabled = true; }
    let busy = false;
    recB.addEventListener('click', async () => {
      if (busy || !mime) return; busy = true; recB.disabled = true; playB.disabled = true;
      await A.fresh(); if (!A.alive) return;
      const ac = A.ac; const dest = ac.createMediaStreamDestination(); A.add(dest);
      const mix = A.gain(0.9); mix.connect(dest); createBand(A, mix, { level: 0.9 });
      let rec;
      try { rec = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: encRate }); } catch { msg.textContent = 'The encoder refused this setting.'; busy = false; recB.disabled = false; return; }
      const chunks = []; rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const t0 = performance.now();
      const tick = setInterval(() => { msg.textContent = `Encoding… ${Math.min(6, (performance.now() - t0) / 1000).toFixed(1)} s`; }, 200);
      rec.onstop = async () => {
        clearInterval(tick); A.stopAll(true);
        if (!A.alive) return;
        const blob = new Blob(chunks, { type: mime }); const secs = (performance.now() - t0) / 1000;
        const kbps = (blob.size * 8) / secs / 1000;
        try {
          encBuf = await ac.decodeAudioData(await blob.arrayBuffer());
          msg.textContent = `${(blob.size / 1024).toFixed(0)} KB for ${secs.toFixed(1)} s, about ${kbps.toFixed(0)} kbps actual (${mime.split(';')[0]}). Uncompressed would be about ${((ac.sampleRate * 16 * 2 * secs) / 8 / 1024).toFixed(0)} KB.`;
          playB.disabled = false;
        } catch { msg.textContent = `Recorded ${(blob.size / 1024).toFixed(0)} KB (about ${kbps.toFixed(0)} kbps) but this browser could not decode it for playback.`; }
        busy = false; recB.disabled = false;
      };
      ctx.signal.addEventListener('abort', () => { clearInterval(tick); try { if (rec.state !== 'inactive') rec.stop(); } catch { /* ok */ } });
      rec.start(); setTimeout(() => { try { if (rec.state !== 'inactive') rec.stop(); } catch { /* ok */ } }, 6000);
    }, { signal: ctx.signal });
    playB.addEventListener('click', async () => {
      if (!encBuf) return; await A.fresh(); const s = A.ac.createBufferSource(); s.buffer = encBuf; A.add(s); s.connect(A.out); s.start();
    }, { signal: ctx.signal });
    origB.addEventListener('click', async () => {
      await A.fresh(); createBand(A, A.out, { level: 0.9 }); const tt = setTimeout(() => A.stopAll(), 6000); A.onKill.add(() => clearTimeout(tt));
    }, { signal: ctx.signal });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Compression and file formats</h2>'),
      ctx.h('<p class="lede">Raw CD audio is about 10 MB a minute. A streaming service sends a tenth of that or less, and most people cannot tell. Here is how.</p>'),
      A.bar([play, mBtn]),
      ctx.h('<div class="card tip"><p><b>Bitrate</b> is how many bits a second the audio uses. Uncompressed audio (WAV) is simply sample rate × bit depth × channels: 44,100 × 16 × 2 = 1,411 kbps.</p><p><b>Lossless</b> formats like FLAC pack those exact numbers smaller, like a zip file. You get back every bit. <b>Lossy</b> formats like MP3, AAC and Opus throw away what your ears are unlikely to notice, and get far smaller.</p></div>'),
      ctx.h('<h3>What can be thrown away?</h3>'),
      ctx.h('<div class="card try"><p>1. Press Play the tones. You hear a loud 1 kHz tone and a quiet tone near it.</p><p>2. Drag the quiet tone on the stage. Inside the violet zone the loud tone hides it. Press <b>Masker off</b> and it suddenly appears.</p><p>3. Move it far from the masker, or above the curve, and it becomes audible again. A lossy encoder does this analysis on every slice of music and spends bits only where you can hear them.</p></div>'),
      status,
      enc,
      ctx.h('<h3>Size calculator</h3>'),
      rateSeg, bitSeg, chSeg, calc, minSl,
      ctx.h(`<div class="card deep"><p>File size is just bitrate × time:</p>
        <div class="formula">size (MB) = kbps × 1000 × seconds / 8 / 1,000,000<span>3 minutes at 128 kbps ≈ 2.9 MB. CD quality WAV ≈ 31.8 MB</span></div>
        <p>Lossless compression finds patterns and predicts each sample from the last few, storing only the small leftovers. Music varies, so FLAC is usually somewhere around half to two thirds of the WAV size, and you cannot choose a target size.</p>
        <p>Lossy codecs use a <b>psychoacoustic model</b>: masking in frequency (shown here), masking in time (a loud hit hides quiet sounds just after it and slightly before it) and the threshold of hearing. They split the sound into many frequency bands, often with a transform called the MDCT, and quantise each band only as finely as the model says is needed. The noise this adds is shaped to hide under the masking curve.</p>
        <p>Rough guide: MP3 at 128 kbps is decent, 192 to 320 kbps is hard to tell from the original for most listeners. AAC and Opus reach similar quality at lower rates. Opus covers 6 to 510 kbps and is used for voice calls and much web audio. Each time you re-encode lossy audio, more is lost, so masters are kept lossless.</p>
        <p>The masking curve here is a simplified textbook sketch (fixed slopes on the Bark scale plus the threshold in quiet), not a full codec model.</p></div>`),
    );
    upd(); updCalc();

    ctx.quiz([
      { q: 'What is the bitrate of uncompressed CD audio (44.1 kHz, 16 bit, stereo)?', choices: ['128 kbps', 'About 1,411 kbps', 'About 44 kbps'], answer: 1, why: '44,100 × 16 × 2 = 1,411,200 bits per second.' },
      { q: 'What is the key difference between FLAC and MP3?', choices: ['FLAC is lossless and gives back every sample exactly, MP3 removes information', 'MP3 is always larger', 'FLAC only works for speech'], answer: 0, why: 'FLAC is like a zip for audio. MP3 discards what a hearing model says you will not notice.' },
      { q: 'Why can an encoder drop a quiet tone right next to a loud one?', choices: ['Because of masking: the loud tone makes the quiet one inaudible', 'Because quiet tones are always noise', 'Because of the Nyquist limit'], answer: 0, why: 'The ear cannot pick out the quiet tone, so spending bits on it is wasted.' },
    ]);
  },
};
