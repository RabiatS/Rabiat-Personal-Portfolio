// Chapter 9: EQ and mixing. A synthesised band with per track faders, pan, mute and solo,
// and a 5 band EQ with draggable handles drawn over the live spectrum.
import { makeAudio, meter } from '../lib/audio.js';
import { createBand, TRACKS, TRACK_LABEL } from '../lib/music.js';
import { C, txt, box, hexA, fmtHz, logPos, logFreq, freqGrid, spectrum, drag } from '../lib/draw.js';

const F0 = 20; const F1 = 20000; const GMAX = 15; const NF = 300;
const BANDS0 = [
  { type: 'lowshelf', f: 80, gain: 0, q: 0.707, name: 'Low' },
  { type: 'peaking', f: 250, gain: 0, q: 1, name: 'Low mid' },
  { type: 'peaking', f: 1000, gain: 0, q: 1, name: 'Mid' },
  { type: 'peaking', f: 4000, gain: 0, q: 1, name: 'Presence' },
  { type: 'highshelf', f: 10000, gain: 0, q: 0.707, name: 'Air' },
];
const PRESETS = {
  flat: [0, 0, 0, 0, 0],
  smile: [6, -2, -3, 2, 6],
  mud: [0, -6, 0, 1, 0],
  radio: [-15, -4, 6, 3, -15],
  bright: [-2, -1, 0, 4, 7],
};

export default {
  mount(ctx) {
    const A = makeAudio(ctx);
    const cv = ctx.canvas(); const g = cv.ctx;
    const bands = BANDS0.map((b) => ({ ...b }));
    let eqOn = true; let band = null; let eqNodes = []; let an = null; let fb = null; let tb = null; let sel = -1;
    const lv = Object.fromEntries(TRACKS.map((n) => [n, -120]));
    const tbuf = new Float32Array(1024);

    const oc = new OfflineAudioContext(1, 128, 48000);
    const rbs = bands.map(() => oc.createBiquadFilter());
    const freqs = new Float32Array(NF); for (let i = 0; i < NF; i++) freqs[i] = logFreq(i / (NF - 1), F0, F1);
    const mag = new Float32Array(NF); const m1 = new Float32Array(NF); const ph = new Float32Array(NF);
    const qp = (b) => (b.type === 'lowshelf' || b.type === 'highshelf' ? 0 : b.q);
    function response() {
      mag.fill(1);
      bands.forEach((b, i) => { const r = rbs[i]; r.type = b.type; r.frequency.value = b.f; r.Q.value = qp(b); r.gain.value = b.gain; r.getFrequencyResponse(freqs, m1, ph); for (let k = 0; k < NF; k++) mag[k] *= m1[k]; });
    }
    const COLS = [C.c1, C.c2, C.c3, C.c4, C.c5];

    const L = () => { const W = cv.w; const H = cv.h; const h1 = Math.round(H * 0.64); return { W, H, a: { x: 0, y: 0, w: W, h: h1 }, b: { x: 0, y: h1 + 12, w: W, h: H - h1 - 12 } }; };
    const P = (r) => ({ x: r.x + 14, y: r.y + 30, w: r.w - 50, h: r.h - 52 });
    const GY = (p, d) => p.y + (1 - (d + GMAX) / (2 * GMAX)) * p.h;

    ctx.loop((t, dt) => {
      response();
      const l = L(); g.clearRect(0, 0, l.W, l.H);
      const r = l.a; box(g, r.x, r.y, r.w, r.h, eqOn ? 'Master EQ: drag the dots' : 'Master EQ (bypassed)');
      const p = P(r);
      freqGrid(g, p.x, p.y, p.w, p.h, F0, F1);
      for (let d = -GMAX + 3; d <= GMAX; d += 6) { const y = Math.round(GY(p, d)) + 0.5; g.strokeStyle = d === 0 ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(p.x, y); g.lineTo(p.x + p.w, y); g.stroke(); txt(g, `${d > 0 ? '+' : ''}${d}`, p.x + p.w + 6, y + 4, { font: '500 10px "DM Mono", monospace', color: C.subtle }); }
      // rough region names
      const regions = [[20, 60, 'sub'], [60, 250, 'bass'], [250, 500, 'mud'], [500, 2000, 'mids'], [2000, 6000, 'presence'], [6000, 20000, 'air']];
      for (const [a, b, n] of regions) { const xa = p.x + logPos(a, F0, F1) * p.w; const xb = p.x + logPos(b, F0, F1) * p.w; if (xb - xa > 34) txt(g, n, (xa + xb) / 2, p.y + 12, { align: 'center', font: '500 10px "DM Mono", monospace', color: C.subtle }); }
      if (an) spectrum(g, an, fb, p.x, p.y, p.w, p.h, { f0: F0, f1: F1, dmin: -110, dmax: -15, color: C.c5 });
      // each band faint, then the sum
      if (eqOn) {
        g.beginPath(); for (let k = 0; k < NF; k++) { const x = p.x + (k / (NF - 1)) * p.w; const y = GY(p, Math.max(-GMAX - 2, Math.min(GMAX + 2, 20 * Math.log10(mag[k])))); if (k === 0) g.moveTo(x, y); else g.lineTo(x, y); }
        g.strokeStyle = C.text; g.lineWidth = 2.2; g.stroke();
        g.lineTo(p.x + p.w, GY(p, 0)); g.lineTo(p.x, GY(p, 0)); g.closePath(); g.fillStyle = 'rgba(245,245,240,.06)'; g.fill();
      } else { g.strokeStyle = C.muted; g.lineWidth = 2; g.beginPath(); g.moveTo(p.x, GY(p, 0)); g.lineTo(p.x + p.w, GY(p, 0)); g.stroke(); }
      bands.forEach((b, i) => {
        const x = p.x + logPos(b.f, F0, F1) * p.w; const y = GY(p, b.gain);
        g.fillStyle = sel === i ? COLS[i] : C.bg; g.strokeStyle = COLS[i]; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill(); g.stroke();
        txt(g, `${i + 1}`, x, y + 4, { align: 'center', color: sel === i ? C.bg : COLS[i], font: '600 10px "DM Mono", monospace' });
      });
      if (sel >= 0) { const b = bands[sel]; txt(g, `${b.name}: ${fmtHz(b.f)} ${b.gain > 0 ? '+' : ''}${b.gain.toFixed(1)} dB`, r.x + r.w - 14, r.y + 18, { align: 'right', color: COLS[sel] }); }

      // track meters
      const q = l.b; box(g, q.x, q.y, q.w, q.h, 'The band: level and pan per track');
      const n = TRACKS.length; const cw = (q.w - 28) / n; const my = q.y + 30; const mh = q.h - 64;
      TRACKS.forEach((name, i) => {
        let db = -120;
        if (band) { db = meter(band.tracks[name].an, tbuf).peakDb; }
        lv[name] = db > lv[name] ? db : lv[name] - dt * 30;
        const cx = q.x + 14 + i * cw + cw / 2; const bw = Math.min(26, cw * 0.3);
        g.fillStyle = '#1E1E1E'; g.fillRect(cx - bw / 2, my, bw, mh);
        const fr = Math.max(0, Math.min(1, (lv[name] + 60) / 60)); g.fillStyle = lv[name] > -3 ? C.c4 : C.c6; g.fillRect(cx - bw / 2, my + mh - fr * mh, bw, fr * mh);
        const tr = band ? band.tracks[name] : null;
        const muted = tr && (tr.mute || (TRACKS.some((x) => band.tracks[x].solo) && !tr.solo));
        txt(g, TRACK_LABEL[name], cx, my + mh + 14, { align: 'center', color: muted ? C.subtle : C.text2 });
        const pv = mix[name].pan; const px = cx + pv * (cw * 0.4);
        g.strokeStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.moveTo(cx - cw * 0.4, my + mh + 24.5); g.lineTo(cx + cw * 0.4, my + mh + 24.5); g.stroke();
        g.fillStyle = C.c2; g.beginPath(); g.arc(px, my + mh + 24.5, 3, 0, Math.PI * 2); g.fill();
      });
    });

    drag(cv.el, (x, y, e, phase) => {
      const l = L(); const p = P(l.a);
      if (phase === 'down') {
        let best = -1; let bd = 1e9;
        bands.forEach((b, i) => { const bx = p.x + logPos(b.f, F0, F1) * p.w; const by = GY(p, b.gain); const d = Math.hypot(bx - x, by - y); if (d < bd) { bd = d; best = i; } });
        sel = bd < 44 ? best : -1;
      }
      if ((phase === 'down' || phase === 'move') && sel >= 0) {
        const b = bands[sel]; b.f = Math.max(25, Math.min(18000, logFreq(Math.max(0, Math.min(1, (x - p.x) / p.w)), F0, F1)));
        b.gain = Math.round(Math.max(-GMAX, Math.min(GMAX, (1 - (y - p.y) / p.h) * 2 * GMAX - GMAX)) * 2) / 2;
        applyEq(); syncSel();
      }
    }, ctx.signal);

    function applyEq() {
      if (!eqNodes.length) return; const t = A.ac.currentTime;
      bands.forEach((b, i) => { const nd = eqNodes[i]; nd.frequency.setTargetAtTime(b.f, t, 0.01); nd.gain.setTargetAtTime(eqOn ? b.gain : 0, t, 0.01); nd.Q.value = qp(b); });
    }
    const mix = Object.fromEntries(TRACKS.map((n) => [n, { pan: 0 }]));
    const start = async () => {
      const ac = A.ac;
      eqNodes = bands.map((b) => { const f = ac.createBiquadFilter(); f.type = b.type; f.frequency.value = b.f; f.Q.value = qp(b); f.gain.value = b.gain; return A.add(f); });
      for (let i = 0; i < eqNodes.length - 1; i++) eqNodes[i].connect(eqNodes[i + 1]);
      an = A.analyser(8192, 0.8); fb = new Float32Array(an.frequencyBinCount);
      const out = A.gain(0.75); eqNodes[eqNodes.length - 1].connect(an); an.connect(out); out.connect(A.out);
      band = createBand(A, eqNodes[0], { level: 0.8 });
      for (const n of TRACKS) { const tr = band.tracks[n]; tr.level = faders[n].value; tr.mute = faders[n].mute; tr.solo = faders[n].solo; if (tr.pan) tr.pan.pan.value = mix[n].pan; }
      band.applyMix(); applyEq();
    };
    const play = A.toggle('Play the band', start, () => { band = null; eqNodes = []; an = null; });
    const eqBtn = ctx.h('<button class="btn ghost">EQ on</button>');
    eqBtn.addEventListener('click', () => { eqOn = !eqOn; eqBtn.textContent = eqOn ? 'EQ on' : 'EQ off'; applyEq(); }, { signal: ctx.signal });

    // mixer
    const faders = {};
    const mixer = ctx.h('<div class="a-mix"></div>');
    for (const n of TRACKS) {
      const row = ctx.h(`<div class="trk"><b>${TRACK_LABEL[n]}</b><input type="range" min="0" max="1.2" step="0.01" aria-label="${TRACK_LABEL[n]} level"><button class="chip">M</button><button class="chip">S</button></div>`);
      const inp = row.querySelector('input'); const [mb, sb] = row.querySelectorAll('button');
      const st = { value: 0, mute: false, solo: false };
      faders[n] = st;
      const push = () => { if (band) { const tr = band.tracks[n]; tr.level = st.value; tr.mute = st.mute; tr.solo = st.solo; band.applyMix(); } };
      inp.addEventListener('input', () => { st.value = +inp.value; push(); });
      mb.addEventListener('click', () => { st.mute = !st.mute; mb.classList.toggle('on', st.mute); push(); });
      sb.addEventListener('click', () => { st.solo = !st.solo; sb.classList.toggle('on', st.solo); push(); });
      st.reset = (v) => { st.value = v; inp.value = v; st.mute = false; st.solo = false; mb.classList.remove('on'); sb.classList.remove('on'); push(); };
      mixer.append(row);
    }
    const defaults = { kick: 0.9, snare: 0.55, hats: 0.35, bass: 0.6, chords: 0.38 };
    for (const n of TRACKS) faders[n].reset(defaults[n]);
    const panRow = ctx.h('<div class="a-mix"></div>');
    for (const n of ['hats', 'chords']) {
      const sl = ctx.slider({ label: `Pan ${TRACK_LABEL[n]}`, min: -1, max: 1, step: 0.01, value: 0, fmt: (v) => (Math.abs(v) < 0.02 ? 'centre' : `${Math.round(Math.abs(v) * 100)}% ${v < 0 ? 'L' : 'R'}`), onInput: (v) => { mix[n].pan = v; if (band && band.tracks[n].pan) band.tracks[n].pan.pan.setTargetAtTime(v, A.ac.currentTime, 0.02); } });
      panRow.append(sl);
    }

    const sl = ctx.h('<p class="hint">Click a dot on the stage to select a band.</p>');
    const qsl = ctx.slider({ label: 'Selected band Q', min: 0.3, max: 6, step: 0.1, value: 1, fmt: (v) => v.toFixed(1), onInput: (v) => { if (sel >= 0 && bands[sel].type === 'peaking') { bands[sel].q = v; applyEq(); } } });
    function syncSel() { if (sel >= 0) { const b = bands[sel]; sl.textContent = `Band ${sel + 1} (${b.name}): ${b.type === 'peaking' ? 'bell' : b.type === 'lowshelf' ? 'low shelf' : 'high shelf'} at ${fmtHz(b.f)}, ${b.gain > 0 ? '+' : ''}${b.gain} dB`; qsl.value = b.q; } }
    const presetRow = ctx.h('<div class="row"></div>');
    for (const [k, label] of [['flat', 'Flat'], ['smile', 'Smile'], ['mud', 'Clear the mud'], ['bright', 'Brighter'], ['radio', 'Old radio']]) {
      const b = ctx.h(`<button class="chip">${label}</button>`);
      b.onclick = () => { bands.forEach((bb, i) => { bb.f = BANDS0[i].f; bb.q = BANDS0[i].q; bb.gain = PRESETS[k][i]; }); applyEq(); };
      presetRow.append(b);
    }

    ctx.panel.append(
      ctx.h('<h2 class="k-h">EQ and mixing</h2>'),
      ctx.h('<p class="lede">Mixing is making several sounds fit together so each one can be heard. Level, pan and EQ do most of the work.</p>'),
      A.bar([play, eqBtn]),
      ctx.h('<div class="card tip"><p>This little band is made live in your browser: a kick drum, snare, hi hats, a bass line and chords, each from oscillators and noise.</p><p>A <b>fader</b> sets each track\'s level. <b>Pan</b> places it left or right. <b>EQ</b> (equalisation) turns frequency ranges up or down, like the bass and treble knobs on a stereo but with more control. A shelf lifts or cuts everything above or below a point. A bell boosts or cuts around one frequency.</p></div>'),
      ctx.h('<h3>Mixer</h3>'), mixer, panRow,
      ctx.h('<h3>Master EQ</h3>'), presetRow, sl, qsl,
      ctx.h('<div class="card try"><p>1. Press Play the band. Solo (S) the bass, then the kick. Both live in the lows, which is why they can fight.</p><p>2. Drag dot 2 (low mid) down a few dB around 250 to 400 Hz. The mix often gets clearer. Too much low mid sounds muddy or boxy.</p><p>3. Drag dot 5 (air) up. Hats and chords sparkle, but too much becomes harsh.</p><p>4. Pan the hats and chords to opposite sides and listen on headphones. Space opens up in the middle for kick, snare and bass.</p><p>5. Try Old radio, then toggle EQ off and on.</p></div>'),
      ctx.h(`<div class="card deep"><p>Rough map of the spectrum, not rules:</p>
        <table class="a-table"><tr><th>Range</th><th>Feels like</th></tr>
        <tr><td>20 to 60 Hz</td><td>sub bass, felt more than heard</td></tr>
        <tr><td>60 to 250 Hz</td><td>weight and warmth, kick and bass</td></tr>
        <tr><td>250 to 500 Hz</td><td>body, but too much is muddy</td></tr>
        <tr><td>500 Hz to 2 kHz</td><td>the core of most instruments and voices</td></tr>
        <tr><td>2 to 6 kHz</td><td>presence and clarity, also harshness</td></tr>
        <tr><td>6 to 20 kHz</td><td>air, sparkle, cymbals, breath</td></tr></table>
        <p>Habits engineers use: cut before you boost, make small moves, compare at the same loudness (louder almost always sounds "better" at first), and EQ a track while hearing it in the full mix, not only when soloed.</p>
        <p>A mixer sums signals. Two tracks at the same level add up to about +3 dB if they are unrelated and up to +6 dB if they are identical, so keep headroom and watch the master meter. Each band here is a biquad filter; peaking filters use a Q you can set for the selected band.</p></div>`),
    );

    ctx.quiz([
      { q: 'A mix sounds muddy. Where would you usually try a small cut first?', choices: ['Around 250 to 500 Hz', 'Around 12 kHz', 'Below 20 Hz'], answer: 0, why: 'Build up in the low mids is the most common cause of mud.' },
      { q: 'What does a high shelf at 10 kHz with +4 dB do?', choices: ['Boosts only exactly 10 kHz', 'Lifts everything above about 10 kHz by up to 4 dB', 'Cuts everything below 10 kHz'], answer: 1, why: 'A shelf raises or lowers everything past its corner frequency.' },
      { q: 'Why do engineers compare EQ settings at matched loudness?', choices: ['Louder tends to sound better, which fools the comparison', 'EQ only works at one level', 'Meters break when the level changes'], answer: 0, why: 'Ears prefer louder versions, so a boost can seem better just because it is louder.' },
    ]);
  },
};
