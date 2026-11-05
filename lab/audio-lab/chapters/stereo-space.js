// Chapter 11: stereo, phase and space. Four small labs in one: equal power panning, phase cancellation and beats,
// echo and reverb with a drawn impulse response, and binaural cues with an HRTF panner.
import { makeAudio, noiseBuffer } from '../lib/audio.js';
import { createBand } from '../lib/music.js';
import { C, txt, box, hexA, fmtHz, drag } from '../lib/draw.js';

const HEAD_R = 0.0875; const SOUND = 343;

export default {
  mount(ctx) {
    const A = makeAudio(ctx);
    const cv = ctx.canvas(); const g = cv.ctx;
    let view = 'pan';
    // pan
    let pan = 0; let panNode = null;
    // phase
    let pf = 220; let phi = 180; let det = 0; let bOn = true; let oB = null; let dB = null; let gB = null; let oA = null; let phT = 0;
    // space
    let dTime = 0.32; let fb = 0.45; let dMix = 0.5; let rt = 1.8; let rMix = 0.3; let dNode = null; let fbNode = null; let dWet = null; let rWet = null; let conv = null; let hitTimer = null;
    // binaural
    let az = 60; let panner = null;

    const lateral = (a) => Math.asin(Math.abs(Math.sin((a * Math.PI) / 180)));
    const itd = (a) => { const th = lateral(a); return (HEAD_R / SOUND) * (th + Math.sin(th)); };

    function drawHead(cx, cy, R, facing = true) {
      g.fillStyle = '#1E1E1E'; g.strokeStyle = C.text2; g.lineWidth = 1.5;
      g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(cx - R, cy, R * 0.18, R * 0.32, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(cx + R, cy, R * 0.18, R * 0.32, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      if (facing) { g.beginPath(); g.moveTo(cx - R * 0.22, cy - R * 0.95); g.lineTo(cx, cy - R * 1.3); g.lineTo(cx + R * 0.22, cy - R * 0.95); g.stroke(); }
      txt(g, 'L', cx - R - R * 0.5, cy + 4, { align: 'right', color: C.muted }); txt(g, 'R', cx + R + R * 0.5, cy + 4, { color: C.muted });
    }
    function speaker(x, y, ang, col) {
      g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = '#2A2A2A'; g.strokeStyle = col; g.lineWidth = 1.5;
      g.fillRect(-10, -8, 14, 16); g.strokeRect(-10, -8, 14, 16); g.beginPath(); g.moveTo(4, -8); g.lineTo(14, -16); g.lineTo(14, 16); g.lineTo(4, 8); g.closePath(); g.stroke(); g.restore();
    }

    const panGeom = () => {
      const W = cv.w; const H = cv.h; const R = Math.min(W * 0.36, H * 0.55); const cx = W / 2; const cy = Math.min(H - 70, H * 0.5 + R * 0.6);
      return { W, H, R, cx, cy };
    };
    const binGeom = () => { const W = cv.w; const H = cv.h; const R = Math.min(W, H - 40) * 0.38; return { cx: W / 2, cy: H / 2 + 6, R }; };

    ctx.loop((t, dt) => {
      const W = cv.w; const H = cv.h; g.clearRect(0, 0, W, H);
      if (view === 'pan') {
        box(g, 0, 0, W, H, 'Stereo panning (seen from above)');
        const p = panGeom();
        const sp = (s) => { const a = (-90 + s * 30) * Math.PI / 180; return [p.cx + Math.cos(a) * p.R, p.cy + Math.sin(a) * p.R]; };
        const [lx, ly] = sp(-1); const [rx, ry] = sp(1);
        g.strokeStyle = 'rgba(255,255,255,.08)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(p.cx, p.cy); g.lineTo(lx, ly); g.moveTo(p.cx, p.cy); g.lineTo(rx, ry); g.stroke(); g.setLineDash([]);
        g.beginPath(); g.arc(p.cx, p.cy, p.R, (-120 * Math.PI) / 180, (-60 * Math.PI) / 180); g.strokeStyle = 'rgba(255,255,255,.15)'; g.stroke();
        const x = (pan + 1) / 2; const gl = Math.cos((x * Math.PI) / 2); const gr = Math.sin((x * Math.PI) / 2);
        speaker(lx, ly, Math.atan2(p.cy - ly, p.cx - lx), hexA(C.c1, 0.4 + 0.6 * gl)); speaker(rx, ry, Math.atan2(p.cy - ry, p.cx - rx), hexA(C.c2, 0.4 + 0.6 * gr));
        const [sx, sy] = sp(pan);
        g.fillStyle = C.c4; g.beginPath(); g.arc(sx, sy, 10, 0, Math.PI * 2); g.fill();
        txt(g, 'drag me', sx, sy - 16, { align: 'center', color: C.c4 });
        drawHead(p.cx, p.cy, Math.min(26, p.R * 0.12));
        // gain bars
        const bw = Math.min(160, W * 0.28); const by = 40;
        for (const [i, gv, col, nm] of [[0, gl, C.c1, 'Left'], [1, gr, C.c2, 'Right']]) {
          const bx = i === 0 ? 20 : W - 20 - bw; g.fillStyle = '#1E1E1E'; g.fillRect(bx, by, bw, 10); g.fillStyle = col; g.fillRect(i === 0 ? bx + bw - gv * bw : bx, by, gv * bw, 10);
          txt(g, `${nm} ${gv < 0.001 ? '-inf' : (20 * Math.log10(gv)).toFixed(1)} dB`, i === 0 ? bx : bx + bw, by + 26, { align: i === 0 ? 'left' : 'right', color: col });
        }
        txt(g, 'equal power: L² + R² stays 1', W / 2, H - 12, { align: 'center', color: C.subtle });
      } else if (view === 'phase') {
        if (det > 0) phT += dt * det * 2 * Math.PI;
        const ph = (phi * Math.PI) / 180 + phT;
        const top = { x: 0, y: 0, w: W, h: H * 0.62 }; const bot = { x: 0, y: H * 0.62 + 12, w: W, h: H * 0.38 - 12 };
        box(g, top.x, top.y, top.w, top.h, 'Two tones and what you hear (their sum)');
        const x0 = 14; const w = W - 28; const y0 = 34; const h = top.h - 46; const lane = h / 3;
        const draw = (fn, yc, col, lw, sc) => { g.beginPath(); for (let i = 0; i <= w; i++) { const th = (i / w) * 3 * 2 * Math.PI; const y = yc - fn(th) * sc; if (i === 0) g.moveTo(x0, y); else g.lineTo(x0 + i, y); } g.strokeStyle = col; g.lineWidth = lw; g.stroke(); };
        draw((th) => Math.sin(th), y0 + lane * 0.5, C.c1, 1.6, lane * 0.38);
        draw((th) => (bOn ? Math.sin(th + ph) : 0), y0 + lane * 1.5, C.c2, 1.6, lane * 0.38);
        draw((th) => Math.sin(th) + (bOn ? Math.sin(th + ph) : 0), y0 + lane * 2.5, C.text, 2.2, lane * 0.22);
        txt(g, 'tone A', x0 + 4, y0 + 12, { color: C.c1 }); txt(g, 'tone B', x0 + 4, y0 + lane + 12, { color: C.c2 }); txt(g, 'A + B', x0 + 4, y0 + lane * 2 + 12, { color: C.text });
        const amp = bOn ? 2 * Math.abs(Math.cos(ph / 2)) : 1;
        box(g, bot.x, bot.y, bot.w, bot.h, 'Level of the sum vs phase difference');
        const px0 = 40; const pw = W - 60; const py0 = bot.y + 30; const phh = bot.h - 48;
        g.beginPath(); for (let i = 0; i <= pw; i++) { const a = (i / pw) * 2 * Math.PI; const y = py0 + phh - (2 * Math.abs(Math.cos(a / 2)) / 2) * phh; if (i === 0) g.moveTo(px0, y); else g.lineTo(px0 + i, y); }
        g.strokeStyle = hexA(C.c3, 0.8); g.lineWidth = 1.5; g.stroke();
        for (const d of [0, 90, 180, 270, 360]) txt(g, `${d}°`, px0 + (d / 360) * pw, py0 + phh + 13, { align: 'center', font: '500 10px "DM Mono", monospace', color: C.subtle });
        txt(g, '2×', px0 - 6, py0 + 6, { align: 'right', font: '500 10px "DM Mono", monospace', color: C.subtle }); txt(g, '0', px0 - 6, py0 + phh, { align: 'right', font: '500 10px "DM Mono", monospace', color: C.subtle });
        const pd = ((((ph * 180) / Math.PI) % 360) + 360) % 360; const mx = px0 + (pd / 360) * pw; const my = py0 + phh - (amp / 2) * phh;
        g.fillStyle = C.c4; g.beginPath(); g.arc(mx, my, 5, 0, Math.PI * 2); g.fill();
        txt(g, amp < 0.02 ? 'silence' : `${(20 * Math.log10(amp)).toFixed(1)} dB vs one tone`, Math.min(W - 120, mx + 10), Math.max(py0 + 10, my - 6), { color: C.text });
      } else if (view === 'space') {
        box(g, 0, 0, W, H, 'Impulse response: what one clap turns into');
        const x0 = 20; const w = W - 40; const yb = H - 40; const h = H - 100; const T = 3;
        const X = (s) => x0 + (s / T) * w;
        for (let s = 0; s <= T; s += 0.5) { const x = X(s); g.strokeStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(x + 0.5, yb - h); g.lineTo(x + 0.5, yb); g.stroke(); txt(g, `${s} s`, x, yb + 15, { align: 'center', font: '500 10px "DM Mono", monospace', color: C.subtle }); }
        // reverb envelope: -60 dB at RT60
        if (rMix > 0.001) {
          g.beginPath(); g.moveTo(X(0.01), yb);
          for (let i = 0; i <= 300; i++) { const s = 0.01 + (i / 300) * (T - 0.01); const a = rMix * Math.pow(10, (-3 * s) / rt); g.lineTo(X(s), yb - a * h * 0.7); }
          g.lineTo(X(T), yb); g.closePath(); g.fillStyle = hexA(C.c3, 0.25); g.fill();
          let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
          g.strokeStyle = hexA(C.c3, 0.7); g.lineWidth = 1;
          for (let i = 0; i < 260; i++) { const s = 0.01 + Math.pow(rnd(), 1.3) * (T - 0.01); const a = rMix * Math.pow(10, (-3 * s) / rt) * (0.3 + 0.7 * rnd()); g.beginPath(); g.moveTo(X(s), yb); g.lineTo(X(s), yb - a * h * 0.7); g.stroke(); }
        }
        // direct and echoes
        const stem = (s, a, col) => { const x = X(s); g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, yb); g.lineTo(x, yb - a * h); g.stroke(); g.fillStyle = col; g.beginPath(); g.arc(x, yb - a * h, 4, 0, Math.PI * 2); g.fill(); };
        stem(0.004, 1, C.c1);
        let a = dMix; for (let k = 1; k * dTime <= T && a > 0.01; k++) { stem(k * dTime, a, C.c2); a *= fb; }
        g.strokeStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(x0, yb + 0.5); g.lineTo(x0 + w, yb + 0.5); g.stroke();
        let lx = 20; for (const [col, nm] of (W < 600 ? [[C.c1, 'direct'], [C.c2, 'echoes'], [C.c3, 'reverb']] : [[C.c1, 'direct sound'], [C.c2, 'echoes (delay + feedback)'], [C.c3, 'reverb (dense reflections)']])) { g.fillStyle = col; g.fillRect(lx, 33, 10, 3); txt(g, nm, lx + 14, 38, { font: '500 10px "DM Mono", monospace' }); lx += g.measureText(nm).width + 34; }
        txt(g, W < 600 ? `echo ${(dTime * 1000).toFixed(0)} ms = wall ${((dTime * SOUND) / 2).toFixed(1)} m away` : `an echo after ${(dTime * 1000).toFixed(0)} ms = a wall about ${((dTime * SOUND) / 2).toFixed(1)} m away`, W - 20, 60, { align: 'right', color: C.text2 });
      } else {
        box(g, 0, 0, W, H, 'Binaural cues: drag the sound around your head');
        const b = binGeom();
        g.strokeStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.arc(b.cx, b.cy, b.R, 0, Math.PI * 2); g.stroke();
        for (const d of [0, 90, 180, 270]) { const a = ((d - 90) * Math.PI) / 180; txt(g, `${d}°`, b.cx + Math.cos(a) * (b.R + 16), b.cy + Math.sin(a) * (b.R + 16) + 4, { align: 'center', font: '500 10px "DM Mono", monospace', color: C.subtle }); }
        const a = ((az - 90) * Math.PI) / 180; const sx = b.cx + Math.cos(a) * b.R; const sy = b.cy + Math.sin(a) * b.R;
        const HR = Math.min(34, b.R * 0.22);
        // paths to each ear
        for (const [ex, col] of [[b.cx - HR, C.c1], [b.cx + HR, C.c2]]) { g.strokeStyle = hexA(col, 0.5); g.setLineDash([4, 4]); g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, b.cy); g.stroke(); g.setLineDash([]); }
        drawHead(b.cx, b.cy, HR);
        g.fillStyle = C.c4; g.beginPath(); g.arc(sx, sy, 10, 0, Math.PI * 2); g.fill();
        const it = itd(az) * 1e6; const near = Math.sin((az * Math.PI) / 180) >= 0 ? 'right' : 'left';
        txt(g, `azimuth ${Math.round(az)}°`, 20, 40, { color: C.text });
        txt(g, `time difference ${it.toFixed(0)} µs (${Math.abs(Math.sin((az * Math.PI) / 180)) < 0.02 ? 'equal' : `${near} ear first`})`, 20, 58, { color: C.text2 });
        txt(g, 'use headphones', W - 20, 40, { align: 'right', color: C.c2 });
      }
    });

    drag(cv.el, (x, y, e, phase) => {
      if (phase !== 'down' && phase !== 'move') return;
      if (view === 'pan') {
        const p = panGeom(); const ang = (Math.atan2(y - p.cy, x - p.cx) * 180) / Math.PI + 90; pan = Math.max(-1, Math.min(1, ang / 30)); panSl.value = pan; applyPan();
      } else if (view === 'bin') {
        const b = binGeom(); az = ((Math.atan2(y - b.cy, x - b.cx) * 180) / Math.PI + 90 + 360) % 360; applyBin();
      } else if (view === 'phase') {
        const W = cv.w; if (y > cv.h * 0.62) { phi = Math.round(Math.max(0, Math.min(360, ((x - 40) / (W - 60)) * 360))); phT = 0; phSl.value = phi; applyPhase(); }
      }
    }, ctx.signal);

    function applyPan() { if (panNode) panNode.pan.setTargetAtTime(pan, A.ac.currentTime, 0.02); }
    function applyPhase() {
      if (!oB) return; const t = A.ac.currentTime;
      oA.frequency.setTargetAtTime(pf, t, 0.01); oB.frequency.setTargetAtTime(pf + det, t, 0.01);
      dB.delayTime.setTargetAtTime(((phi % 360) / 360) / pf, t, 0.01); gB.gain.setTargetAtTime(bOn ? 0.5 : 0, t, 0.01);
    }
    function applySpace() {
      if (!dNode) return; const t = A.ac.currentTime;
      dNode.delayTime.setTargetAtTime(dTime, t, 0.03); fbNode.gain.setTargetAtTime(fb, t, 0.02); dWet.gain.setTargetAtTime(dMix, t, 0.02); rWet.gain.setTargetAtTime(rMix * 1.6, t, 0.02);
    }
    function makeIR() {
      const ac = A.ac; const n = Math.floor(ac.sampleRate * Math.min(6, rt * 1.1 + 0.1)); const b = ac.createBuffer(2, n, ac.sampleRate);
      for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) { const s = i / ac.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.pow(10, (-3 * s) / rt) * Math.min(1, s / 0.004); } }
      return b;
    }
    let irTimer = null;
    function rebuildIR() { if (!conv) return; clearTimeout(irTimer); irTimer = setTimeout(() => { if (conv) conv.buffer = makeIR(); }, 150); }
    function applyBin() {
      if (!panner) return; const a = (az * Math.PI) / 180; const t = A.ac.currentTime;
      // Web Audio: x right, z towards the listener's back, so front is -z
      if (panner.positionX) { panner.positionX.setTargetAtTime(Math.sin(a) * 1.5, t, 0.02); panner.positionZ.setTargetAtTime(-Math.cos(a) * 1.5, t, 0.02); panner.positionY.value = 0; }
      else panner.setPosition(Math.sin(a) * 1.5, 0, -Math.cos(a) * 1.5);
    }

    const start = async () => {
      const ac = A.ac;
      if (view === 'pan') {
        panNode = ac.createStereoPanner(); A.add(panNode); panNode.pan.value = pan; const out = A.gain(0.8); panNode.connect(out).connect(A.out);
        if (panSrc === 'music') createBand(A, panNode, { level: 0.8 }); else { const n = A.noise('pink'); const gg = A.gain(0.35); n.connect(gg).connect(panNode); }
      } else if (view === 'phase') {
        oA = A.osc('sine', pf); oB = A.osc('sine', pf + det); dB = ac.createDelay(1); A.add(dB); gB = A.gain(0.5); const gA = A.gain(0.5); const out = A.gain(0.4);
        oA.connect(gA).connect(out); oB.connect(dB).connect(gB).connect(out); out.connect(A.out); applyPhase();
      } else if (view === 'space') {
        const dry = A.gain(1); const inp = A.gain(1); const out = A.gain(0.7); out.connect(A.out);
        dNode = ac.createDelay(2); A.add(dNode); fbNode = A.gain(fb); dWet = A.gain(dMix); rWet = A.gain(rMix * 1.6);
        conv = ac.createConvolver(); A.add(conv); conv.buffer = makeIR();
        inp.connect(dry).connect(out); inp.connect(dNode); dNode.connect(fbNode).connect(dNode); dNode.connect(dWet).connect(out); inp.connect(conv); conv.connect(rWet).connect(out);
        const hit = () => {
          const t = ac.currentTime + 0.02; const s = ac.createBufferSource(); s.buffer = noiseBuffer(ac);
          const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.7;
          const e = ac.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(1, t + 0.003); e.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
          s.connect(bp).connect(e).connect(inp); s.start(t, Math.random() * 2); s.stop(t + 0.15);
        };
        hit(); hitTimer = setInterval(hit, 2500); A.onKill.add(() => clearInterval(hitTimer));
      } else {
        panner = ac.createPanner(); A.add(panner); panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 1.5;
        const l = ac.listener; if (l.forwardZ) { l.forwardX.value = 0; l.forwardY.value = 0; l.forwardZ.value = -1; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; l.positionX.value = 0; l.positionY.value = 0; l.positionZ.value = 0; }
        // short pink bursts are easy to place
        const n = Math.floor(ac.sampleRate * 0.45); const buf = ac.createBuffer(1, n, ac.sampleRate); const src = noiseBuffer(ac, 'pink').getChannelData(0); const d = buf.getChannelData(0);
        for (let i = 0; i < n; i++) { const s = i / ac.sampleRate; d[i] = s < 0.18 ? src[i] * 2.2 * Math.min(1, s / 0.005, (0.18 - s) / 0.01) : 0; }
        const bs = ac.createBufferSource(); bs.buffer = buf; bs.loop = true; A.add(bs); bs.start();
        const out = A.gain(0.8); bs.connect(panner).connect(out).connect(A.out); applyBin();
      }
    };
    const play = A.toggle('Play', start, () => { panNode = null; oB = null; dNode = null; conv = null; panner = null; });

    // per view controls
    let panSrc = 'music';
    const panSl = ctx.slider({ label: 'Pan', min: -1, max: 1, step: 0.01, value: pan, fmt: (v) => (Math.abs(v) < 0.02 ? 'centre' : `${Math.round(Math.abs(v) * 100)}% ${v < 0 ? 'left' : 'right'}`), onInput: (v) => { pan = v; applyPan(); } });
    const phSl = ctx.slider({ label: 'Phase of tone B', min: 0, max: 360, step: 1, value: phi, unit: '°', onInput: (v) => { phi = v; phT = 0; applyPhase(); } });
    const views = {
      pan: ctx.h('<div style="display:grid;gap:12px"></div>'),
      phase: ctx.h('<div style="display:grid;gap:12px"></div>'),
      space: ctx.h('<div style="display:grid;gap:12px"></div>'),
      bin: ctx.h('<div style="display:grid;gap:12px"></div>'),
    };
    views.pan.append(ctx.seg([['music', 'Music loop'], ['noise', 'Pink noise']], panSrc, (v) => { panSrc = v; play.restart(); }), panSl,
      ctx.h('<div class="card tip"><p>Two speakers can make a sound seem to come from anywhere between them. Turn one side down and the other up, and the sound slides toward the louder side. That is <b>panning</b>. The in between spot is called a phantom image, because no speaker is there.</p></div>'),
      ctx.h('<div class="card try"><p>Drag the rose dot on the stage. Sit centred between your speakers or use headphones. With the pan at centre, both sides play at −3 dB, so the total power stays the same as hard left or right.</p></div>'));
    const bBtn = ctx.h('<label class="check"><input type="checkbox" checked> Tone B on</label>');
    bBtn.querySelector('input').addEventListener('change', (e) => { bOn = e.target.checked; applyPhase(); });
    const flip = ctx.h('<button class="btn ghost sm">Flip polarity (180°)</button>'); flip.onclick = () => { phi = phi === 180 ? 0 : 180; phT = 0; phSl.value = phi; applyPhase(); };
    views.phase.append(phSl,
      ctx.slider({ label: 'Frequency', min: 60, max: 1000, step: 1, value: pf, unit: ' Hz', onInput: (v) => { pf = v; applyPhase(); } }),
      ctx.slider({ label: 'Detune tone B', min: 0, max: 6, step: 0.1, value: det, unit: ' Hz', onInput: (v) => { det = v; applyPhase(); } }),
      ctx.h('<div class="row"></div>'), bBtn,
      ctx.h('<div class="card tip"><p>When two copies of a wave add up, what matters is their <b>phase</b>: where each one is in its cycle. In step (0°) they double. Exactly opposite (180°) they cancel to silence. That is how noise cancelling headphones work.</p></div>'),
      ctx.h('<div class="card try"><p>1. Press Play at 180°: near silence. Untick Tone B and the sound comes back, even though you removed a sound.</p><p>2. Add 1 or 2 Hz of detune. The phase keeps sliding, so the sum swells and fades: those are <b>beats</b>, at the difference frequency. Musicians use them to tune.</p></div>'));
    views.phase.querySelector('.row').append(flip);
    views.space.append(
      ctx.slider({ label: 'Echo delay', min: 0.03, max: 1, step: 0.01, value: dTime, fmt: (v) => `${Math.round(v * 1000)} ms`, onInput: (v) => { dTime = v; applySpace(); } }),
      ctx.slider({ label: 'Echo feedback', min: 0, max: 0.85, step: 0.01, value: fb, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => { fb = v; applySpace(); } }),
      ctx.slider({ label: 'Echo level', min: 0, max: 1, step: 0.01, value: dMix, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => { dMix = v; applySpace(); } }),
      ctx.slider({ label: 'Reverb time (RT60)', min: 0.2, max: 6, step: 0.1, value: rt, unit: ' s', onInput: (v) => { rt = v; rebuildIR(); } }),
      ctx.slider({ label: 'Reverb level', min: 0, max: 1, step: 0.01, value: rMix, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => { rMix = v; applySpace(); } }),
      ctx.h('<div class="card tip"><p>In a real room you hear the sound itself, then its reflections off walls, floor and ceiling. A few clear, late reflections are <b>echoes</b>. Thousands of reflections blurred together are <b>reverb</b>. Their pattern tells your brain how big the space is and what it is made of.</p></div>'),
      ctx.h('<div class="card try"><p>Press Play to hear a clap every few seconds. Turn the echo level to 0 and raise the reverb: short times sound like a small room, 3 seconds or more like a cathedral. Then set a long echo with high feedback for a canyon.</p></div>'));
    views.bin.append(
      ctx.h('<div class="card tip"><p>With only two ears you can still tell where a sound comes from. A sound on your right reaches your right ear first, and a little louder, because your head is in the way of the left ear. Your outer ears also colour the sound differently from in front, behind, above and below.</p><p>A <b>binaural</b> renderer copies these cues with filters measured on real heads (an HRTF). On headphones it can place sound outside your head, even behind you.</p></div>'),
      ctx.h('<div class="card try"><p>Put on headphones, press Play, and drag the dot slowly around the head. Left and right are easy. Front and back are harder: a generic HRTF is not shaped like your ears, so some people hear front and back swapped.</p></div>'));
    const holder = ctx.h('<div></div>');
    const setView = (v) => { view = v; holder.replaceChildren(views[v]); play.restart(); };

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Stereo, phase and space</h2>'),
      ctx.h('<p class="lede">Two ears and two speakers are enough to place a sound, cancel it, or put it in a cathedral.</p>'),
      A.bar([play]),
      ctx.seg([['pan', 'Panning'], ['phase', 'Phase'], ['space', 'Echo and reverb'], ['bin', 'Binaural']], view, setView),
      holder,
      ctx.h(`<div class="card deep"><p><b>Panning law.</b> Simply fading one side down makes the centre sound quieter. Equal power panning uses L = cos(θ) and R = sin(θ), so L² + R² = 1 and the centre sits at −3 dB on each side.</p>
        <p><b>Phase.</b> Two equal sines with a phase difference φ add to an amplitude of 2·|cos(φ/2)|. Detune them by Δf and they beat Δf times a second. Recording one source with two microphones at different distances causes partial cancellation at some frequencies (comb filtering), which is why engineers check mixes in mono.</p>
        <p><b>Reverb time.</b> RT60 is how long the reverb takes to fall by 60 dB. Living rooms are often around half a second, concert halls around 2 seconds, and big stone churches can go well past that. The reverb here is a convolution with a synthetic impulse response: exponentially decaying noise.</p>
        <p><b>Binaural cues.</b> The interaural time difference is at most about 0.6 to 0.7 ms for an adult head. Woodworth's simple model gives ITD = (r/c)(θ + sin θ). Time differences dominate below about 1.5 kHz and level differences above it, because the head shadows short wavelengths best.</p></div>`),
    );
    holder.append(views.pan);

    ctx.quiz([
      { q: 'Two identical tones are 180° out of phase. What do you hear when they are mixed?', choices: ['Twice as loud', 'Near silence: they cancel', 'One octave higher'], answer: 1, why: 'Every peak meets a trough, so they add to nothing.' },
      { q: 'An echo arrives 200 ms after the direct sound. Roughly how far away is the reflecting wall?', choices: ['About 34 m', 'About 69 m', 'About 3 m'], answer: 0, why: 'Sound travels about 69 m in 0.2 s there and back, so the wall is about half that: 34 m.' },
      { q: 'What does an equal power pan law do at centre?', choices: ['Sends each side at about −3 dB so total power stays constant', 'Sends both sides at full level', 'Mutes one side'], answer: 0, why: 'cos(45°) = sin(45°) ≈ 0.707, which is −3 dB, and 0.707² + 0.707² = 1.' },
    ]);
  },
};
