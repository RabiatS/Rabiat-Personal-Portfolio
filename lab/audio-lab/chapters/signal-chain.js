// Chapter 12: in and out. The signal chain from voice to ear as an animated diagram, a latency budget,
// a tap pad that answers after the chosen latency, and an optional delayed mic monitor.
import { makeAudio, noiseBuffer } from '../lib/audio.js';
import { C, txt, rr, box, hexA, reduced } from '../lib/draw.js';

const SLOW = 40; // the animation runs 40 times slower than real time

export default {
  mount(ctx) {
    const A = makeAudio(ctx);
    const cv = ctx.canvas(); const g = cv.ctx;
    let buf = 256; let sr = 48000; let proc = 2; let dist = 1.5; let micMon = false; let monDelay = null;
    const pulses = [];

    const stages = () => {
      const b = (buf / sr) * 1000;
      return [
        { name: 'Voice', sub: 'air', ms: 0.3, kind: 'analog', col: C.c1 },
        { name: 'Mic', sub: 'pressure to volts', ms: 0, kind: 'analog', col: C.c1 },
        { name: 'Preamp', sub: 'boost', ms: 0, kind: 'analog', col: C.c1 },
        { name: 'ADC', sub: 'filter + sample', ms: 0.5, kind: 'conv', col: C.c2 },
        { name: 'Input buffer', sub: `${buf} samples`, ms: b, kind: 'buffer', col: C.c3 },
        { name: 'Software', sub: 'effects, mixing', ms: proc, kind: 'digital', col: C.c3 },
        { name: 'Output buffer', sub: `${buf} samples`, ms: b, kind: 'buffer', col: C.c3 },
        { name: 'DAC', sub: 'numbers to volts', ms: 0.5, kind: 'conv', col: C.c2 },
        { name: 'Amp', sub: 'power', ms: 0, kind: 'analog', col: C.c1 },
        { name: 'Speaker', sub: `${dist} m of air`, ms: (dist / 343) * 1000, kind: 'analog', col: C.c1 },
      ];
    };
    const total = () => stages().reduce((a, s) => a + s.ms, 0);
    const roundTrip = () => total() - stages()[0].ms; // from the mic onward (what a musician hears back)

    const L = () => { const W = cv.w; const H = cv.h; const h1 = Math.round(Math.max(H * 0.62, H - 140)); return { W, H, a: { x: 0, y: 0, w: W, h: h1 }, b: { x: 0, y: h1 + 12, w: W, h: H - h1 - 12 } }; };
    // node rectangles in a snake: top row left to right, bottom row right to left
    function nodes(r) {
      const n = 5; const pad = 14; const gap = r.w < 600 ? 8 : 18; const nw = (r.w - pad * 2 - gap * (n - 1)) / n; const nh = Math.min(74, (r.h - 120) / 2);
      const y1 = r.y + 44; const y2 = r.y + r.h - nh - 46;
      return stages().map((s, i) => { const row = i < 5 ? 0 : 1; const col = row === 0 ? i : 9 - i; return { ...s, x: r.x + pad + col * (nw + gap), y: row ? y2 : y1, w: nw, h: nh }; });
    }

    ctx.loop((t, dt) => {
      const l = L(); g.clearRect(0, 0, l.W, l.H);
      const r = l.a; box(g, r.x, r.y, r.w, r.h, `The signal chain (animation ${SLOW}× slower than real time)`);
      const ns = nodes(r); const small = r.w < 600;
      // wires
      for (let i = 0; i < ns.length - 1; i++) {
        const a = ns[i]; const b = ns[i + 1]; g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 1.5; g.beginPath();
        if (i === 4) { const x = a.x + a.w / 2; g.moveTo(x, a.y + a.h); g.lineTo(x, b.y); }
        else if (i < 4) { g.moveTo(a.x + a.w, a.y + a.h / 2); g.lineTo(b.x, b.y + b.h / 2); }
        else { g.moveTo(a.x, a.y + a.h / 2); g.lineTo(b.x + b.w, b.y + b.h / 2); }
        g.stroke();
      }
      // domain labels
      txt(g, 'analog (voltage)', ns[0].x, ns[0].y - 10, { color: C.c1, font: '500 10px "DM Mono", monospace' });
      txt(g, 'digital (numbers)', ns[4].x + ns[4].w, ns[4].y - 10, { align: 'right', color: C.c3, font: '500 10px "DM Mono", monospace' });
      txt(g, 'analog again', ns[9].x, ns[9].y + ns[9].h + 16, { color: C.c1, font: '500 10px "DM Mono", monospace' });
      for (const nd of ns) {
        rr(g, nd.x + 0.5, nd.y + 0.5, nd.w - 1, nd.h - 1, 8); g.fillStyle = hexA(nd.col, 0.08); g.fill(); g.strokeStyle = hexA(nd.col, 0.6); g.lineWidth = 1; g.stroke();
        txt(g, nd.name, nd.x + nd.w / 2, nd.y + nd.h / 2 - (small ? 2 : 6), { align: 'center', color: C.text, font: `600 ${small ? 11 : 14}px "Rajdhani", sans-serif` });
        if (!small) txt(g, nd.sub, nd.x + nd.w / 2, nd.y + nd.h / 2 + 10, { align: 'center', font: '500 10px "DM Mono", monospace' });
        txt(g, nd.ms ? `${nd.ms < 1 ? nd.ms.toFixed(1) : nd.ms.toFixed(1)} ms` : '~0', nd.x + nd.w / 2, nd.y + nd.h - 6, { align: 'center', color: nd.ms > 2 ? C.c2 : C.subtle, font: `500 ${small ? 9 : 10}px "DM Mono", monospace` });
      }
      // what the signal looks like at each step, drawn in the gap between the rows
      const gapTop = ns[0].y + ns[0].h + 12; const gapBot = ns[5].y - 12; const gh = Math.min(70, (gapBot - gapTop) / 2 - 6);
      if (gh > 16) {
        const kinds = ['wave:.45', 'wave:.2', 'wave:.85', 'stems', 'blocks', 'blocks', 'blocks', 'stairs', 'wave:1', 'wave:.8'];
        ns.forEach((nd, i) => {
          const top = i < 5; const gy = top ? gapTop : gapBot - gh; const gx = nd.x + 8; const gw = nd.w - 16; const mid = gy + gh / 2; const [k, a] = kinds[i].split(':');
          const col = hexA(nd.col, 0.75); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.4;
          const ph = reduced ? 0 : t * 2;
          if (k === 'wave') { g.beginPath(); for (let x = 0; x <= gw; x += 2) { const y = mid - Math.sin((x / gw) * Math.PI * 4 - ph) * (gh / 2 - 2) * +a; if (x === 0) g.moveTo(gx + x, y); else g.lineTo(gx + x, y); } g.stroke(); }
          else if (k === 'stems') { for (let j = 0; j <= 12; j++) { const x = gx + (j / 12) * gw; const y = mid - Math.sin((j / 12) * Math.PI * 4 - ph) * (gh / 2 - 3) * 0.85; g.beginPath(); g.moveTo(x, mid); g.lineTo(x, y); g.stroke(); g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill(); } }
          else if (k === 'stairs') { g.beginPath(); let py0 = 0; for (let j = 0; j <= 12; j++) { const x = gx + (j / 12) * gw; const y = mid - (Math.round(Math.sin((j / 12) * Math.PI * 4 - ph) * 3) / 3) * (gh / 2 - 3) * 0.85; if (j === 0) g.moveTo(x, y); else { g.lineTo(x, py0); g.lineTo(x, y); } py0 = y; } g.stroke(); }
          else { const nb = 3; const bw = (gw - (nb - 1) * 4) / nb; for (let j = 0; j < nb; j++) { const x = gx + j * (bw + 4); g.strokeRect(x + 0.5, mid - 8.5, bw - 1, 16); for (let d = 0; d < 6; d++) { g.beginPath(); g.arc(x + 4 + (d / 5) * (bw - 8), mid - 0.5, 1.4, 0, Math.PI * 2); g.fill(); } } }
        });
        if (gapBot - gapTop > 2 * gh + 30) txt(g, 'what the signal is at each step', r.x + r.w / 2, (gapTop + gapBot) / 2 + 4, { align: 'center', color: C.subtle, font: '500 10px "DM Mono", monospace' });
      }
      // pulses: each stage takes its latency (slowed down), wires take a fixed short time
      const WIRE = 0.12; const now = performance.now() / 1000;
      for (let k = pulses.length - 1; k >= 0; k--) {
        let e = now - pulses[k]; let done = true; let px = 0; let py = 0; let inBuf = -1; let frac = 0;
        for (let i = 0; i < ns.length; i++) {
          const nd = ns[i]; const dur = Math.max(0.05, (nd.ms / 1000) * SLOW);
          if (e < dur) { frac = e / dur; px = nd.x + nd.w / 2; py = nd.y + nd.h / 2 - 24 * 0; if (nd.kind === 'buffer') inBuf = i; done = false; if (nd.kind !== 'buffer') { px = nd.x + 10 + frac * (nd.w - 20); py = nd.y + 12; } break; }
          e -= dur;
          if (i < ns.length - 1) {
            if (e < WIRE) {
              const b = ns[i + 1]; const f = e / WIRE; let ax; let ay; let bx; let by;
              if (i === 4) { ax = nd.x + nd.w / 2; ay = nd.y + nd.h; bx = ax; by = b.y; } else if (i < 4) { ax = nd.x + nd.w; ay = nd.y + nd.h / 2; bx = b.x; by = b.y + b.h / 2; } else { ax = nd.x; ay = nd.y + nd.h / 2; bx = b.x + b.w; by = b.y + b.h / 2; }
              px = ax + (bx - ax) * f; py = ay + (by - ay) * f; done = false; break;
            }
            e -= WIRE;
          }
        }
        if (done) { pulses.splice(k, 1); continue; }
        if (inBuf >= 0) {
          // a buffer fills up, then moves on as one block
          const nd = ns[inBuf]; const bw = (nd.w - 16) * frac; g.fillStyle = hexA(C.c3, 0.55); g.fillRect(nd.x + 8, nd.y + 8, bw, 6);
          g.strokeStyle = hexA(C.c3, 0.8); g.strokeRect(nd.x + 8.5, nd.y + 8.5, nd.w - 17, 5);
        } else { g.fillStyle = C.c4; g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = hexA(C.c4, 0.25); g.beginPath(); g.arc(px, py, 10, 0, Math.PI * 2); g.fill(); }
      }
      if (!pulses.length) txt(g, 'tap the pad to send a sound through', r.x + r.w / 2, r.y + r.h / 2 + 4, { align: 'center', color: C.subtle });

      // latency budget
      const q = l.b; box(g, q.x, q.y, q.w, q.h, 'Latency budget');
      const st = stages(); const tot = total(); const scaleMax = Math.max(30, tot * 1.15);
      const bx = q.x + 14; const bw = q.w - 28; const by = q.y + 40; const bh = Math.min(26, q.h - 80);
      let x = bx;
      for (const s of st) { if (!s.ms) continue; const w = (s.ms / scaleMax) * bw; g.fillStyle = hexA(s.col, s.kind === 'buffer' ? 0.7 : 0.45); g.fillRect(x, by, Math.max(1, w - 1), bh); if (w > 54) txt(g, s.name.replace(' buffer', ''), x + 4, by + bh / 2 + 4, { color: C.bg, font: '600 10px "DM Mono", monospace' }); x += w; }
      for (const [ms, lab] of [[10, '10 ms'], [20, '20 ms']]) { const mx = bx + (ms / scaleMax) * bw; g.strokeStyle = hexA(C.c4, 0.7); g.setLineDash([3, 3]); g.beginPath(); g.moveTo(mx + 0.5, by - 8); g.lineTo(mx + 0.5, by + bh + 8); g.stroke(); g.setLineDash([]); txt(g, lab, mx, by - 12, { align: 'center', color: C.c4, font: '500 10px "DM Mono", monospace' }); }
      txt(g, `total ${tot.toFixed(1)} ms  ·  same as standing ${((tot / 1000) * 343).toFixed(1)} m from the sound`, bx, by + bh + 24, { color: C.text });
    });

    // tap pad: the click comes back after the total latency
    function click(at) {
      const ac = A.ac; const s = ac.createBufferSource(); s.buffer = noiseBuffer(ac);
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2500; bp.Q.value = 1.2;
      const e = ac.createGain(); e.gain.setValueAtTime(0.0001, at); e.gain.exponentialRampToValueAtTime(1, at + 0.001); e.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
      const o = ac.createOscillator(); o.frequency.setValueAtTime(900, at); o.frequency.exponentialRampToValueAtTime(300, at + 0.04);
      const e2 = ac.createGain(); e2.gain.setValueAtTime(0.0001, at); e2.gain.exponentialRampToValueAtTime(0.5, at + 0.001); e2.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
      s.connect(bp).connect(e).connect(A.out); o.connect(e2).connect(A.out); s.start(at, Math.random() * 2); s.stop(at + 0.08); o.start(at); o.stop(at + 0.08);
    }
    const pad = ctx.h('<button class="btn" style="justify-content:center;padding:18px 16px;font-size:16px;touch-action:manipulation">Tap pad</button>');
    pad.addEventListener('pointerdown', async (e) => {
      e.preventDefault();
      if (!reduced || pulses.length < 6) pulses.push(performance.now() / 1000);
      await A.ready(); if (!A.alive) return;
      click(A.ac.currentTime + roundTrip() / 1000);
    }, { signal: ctx.signal });

    // mic monitor with the same delay
    const startMon = async () => {
      const m = await A.mic();
      if (!m) { bar.note('Microphone not available or permission denied. The tap pad still works.', true); mon.off(); return; }
      monDelay = A.ac.createDelay(1); A.add(monDelay); monDelay.delayTime.value = roundTrip() / 1000;
      const gg = A.gain(0.9); m.connect(monDelay).connect(gg).connect(A.out);
      bar.note('Use headphones, or you will get feedback. You now hear yourself with the latency above.', true);
    };
    const mon = A.toggle('Hear yourself (headphones)', startMon, () => { monDelay = null; bar.note('Start with the volume low. Headphones help.'); });
    const bar = A.bar([mon]);
    const upd = () => {
      if (monDelay) monDelay.delayTime.setTargetAtTime(roundTrip() / 1000, A.ac.currentTime, 0.02);
      const b = (buf / sr) * 1000;
      stats.querySelector('.s-b').textContent = `${b.toFixed(2)} ms`;
      stats.querySelector('.s-r').textContent = `${roundTrip().toFixed(1)} ms`;
      stats.querySelector('.s-t').textContent = `${total().toFixed(1)} ms`;
    };
    const stats = ctx.h('<div class="stat"><div><b class="s-b">-</b><span>One buffer</span></div><div><b class="s-r">-</b><span>Mic to speaker</span></div><div><b class="s-t">-</b><span>Voice to ear</span></div></div>');
    const dev = ctx.h('<p class="hint">Press the pad once to read your own device\'s latency.</p>');
    pad.addEventListener('pointerup', () => {
      if (!A.ac) return; const bl = A.ac.baseLatency; const ol = A.ac.outputLatency;
      dev.textContent = `This browser reports: sample rate ${A.ac.sampleRate} Hz${bl ? `, base latency ${(bl * 1000).toFixed(1)} ms` : ''}${ol ? `, output latency ${(ol * 1000).toFixed(1)} ms` : ''}.`;
    }, { signal: ctx.signal });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">In and out</h2>'),
      ctx.h('<p class="lede">From your voice to someone\'s ear, sound changes form several times. Each step is quick, but buffers add up.</p>'),
      bar,
      pad,
      ctx.h('<div class="card tip"><p>A <b>microphone</b> turns air pressure into a tiny voltage. A <b>preamp</b> boosts it. The <b>ADC</b> (analog to digital converter) filters out anything above Nyquist and samples it into numbers. Software processes those numbers in small blocks called <b>buffers</b>. The <b>DAC</b> turns numbers back into voltage, an <b>amp</b> makes it strong enough to move a <b>speaker</b>, and the speaker pushes the air again.</p><p>The delay from one end to the other is <b>latency</b>. Most of it comes from buffers, because the computer waits for a whole block of samples before it works on them.</p></div>'),
      ctx.h('<div class="card try"><p>1. Tap the pad in a steady rhythm. With small buffers it feels instant.</p><p>2. Raise the buffer size to 1024 or 2048 and tap again. The click lags behind your finger and drumming in time gets hard.</p><p>3. Find the point where you first notice the lag. Many players start to feel it somewhere around 10 to 20 ms.</p><p>4. With headphones on, press <b>Hear yourself</b> and talk. Big latency makes speaking surprisingly hard.</p></div>'),
      ctx.seg([[32, '32'], [64, '64'], [128, '128'], [256, '256'], [512, '512'], [1024, '1024'], [2048, '2048']], buf, (v) => { buf = +v; upd(); }),
      ctx.h('<p class="hint" style="margin-top:-6px">buffer size in samples</p>'),
      ctx.seg([[44100, '44.1 kHz'], [48000, '48 kHz'], [96000, '96 kHz']], sr, (v) => { sr = +v; upd(); }),
      ctx.slider({ label: 'Software processing', min: 0, max: 40, step: 0.5, value: proc, unit: ' ms', onInput: (v) => { proc = v; upd(); } }),
      ctx.slider({ label: 'Speaker to ear distance', min: 0.1, max: 10, step: 0.1, value: dist, unit: ' m', onInput: (v) => { dist = v; upd(); } }),
      stats, dev,
      ctx.h(`<div class="card deep"><p>One buffer lasts buffer size / sample rate. 256 samples at 48 kHz is 5.3 ms. A simple round trip needs at least one input and one output buffer, plus converter filters (often well under a millisecond each, more for some designs) and any extra work in software.</p>
        <div class="formula">buffer time = N / sample rate<span>256 / 48,000 = 5.33 ms. 64 / 48,000 = 1.33 ms</span></div>
        <p>Why not always use tiny buffers? The computer must finish each block before the next one is due. If it is late even once, you hear a click or dropout. Smaller buffers mean less slack, so heavy projects need bigger ones. Musicians use small buffers while recording and big ones while mixing.</p>
        <p>Air is latency too: about 2.9 ms per metre. A guitarist 3 m from their amp already hears it about 9 ms late, which is why a small amount of digital latency often goes unnoticed.</p>
        <p>The tap pad here schedules its click exactly that much later on the audio clock. Your browser and device add their own latency on top (shown after the first tap), so the real delay is a little longer than the number on screen.</p></div>`),
    );
    upd();

    ctx.quiz([
      { q: 'What does an ADC do?', choices: ['Turns a voltage into numbers by sampling it', 'Turns numbers into a voltage', 'Makes the signal louder for the speaker'], answer: 0, why: 'Analog to digital: filter, sample and quantise the voltage.' },
      { q: 'How long is one buffer of 512 samples at 48 kHz?', choices: ['About 1 ms', 'About 10.7 ms', 'About 512 ms'], answer: 1, why: '512 / 48,000 = 0.0107 s, about 10.7 ms.' },
      { q: 'Why do music apps not always use the smallest buffer?', choices: ['Small buffers sound worse even when nothing goes wrong', 'With less time per block the computer is more likely to miss a deadline and cause dropouts', 'Small buffers use more disk space'], answer: 1, why: 'Smaller buffers lower latency but leave less slack, so glitches become more likely under heavy load.' },
    ]);
  },
};
