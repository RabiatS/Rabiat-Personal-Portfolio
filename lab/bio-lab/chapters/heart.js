// Chapter 8: the heart. A schematic heart driven by a cardiac cycle model: chamber volumes, valves, blood flow,
// left heart pressures (a Wiggers diagram) and an ECG, all from one clock, with a heart rate slider.
import { MONO, DISP, fit, rgba, clamp, injectStyle, reduced } from './_shared.js';

const EDV = 120; const ESV = 50; const SV = EDV - ESV;
const BLUE = '#60A5FA'; const RED = '#FB7185';
const g1 = (t, mu, sd) => Math.exp(-(((t - mu) / sd) ** 2) / 2);
const smooth = (x) => { const u = clamp(x, 0, 1); return u * u * (3 - 2 * u); };

// Beat timing in seconds, t = 0 at QRS onset.
function timing(hr) {
  const T = 60 / hr;
  const QT = Math.min(0.40 * Math.sqrt(T), T * 0.62);
  const PR = clamp(0.16 - 0.04 * (hr - 75) / 85, 0.12, 0.18);
  const IVR = 0.07 * Math.sqrt(Math.min(1, T / 0.8));
  return { T, QT, PR, tMC: 0.05, tAO: 0.10, tAC: QT, tMO: QT + IVR, pOn: T - PR };
}
const wrap = (x, T) => ((x % T) + T) % T;

function model(t, k) {
  const { T, tMC, tAO, tAC, tMO, pOn } = k;
  // atrial contraction bump, starting about 50 ms after the P wave begins
  const da = wrap(t - (pOn + 0.05), T);
  const atr = da < 0.11 ? Math.sin((da / 0.11) * Math.PI) : 0;
  // ECG in mV
  const dP = wrap(t - pOn, T);
  const ecg = 0.15 * g1(dP, 0.045, 0.02) - 0.12 * g1(t, 0.015, 0.007) + 1.2 * g1(t, 0.04, 0.009) - 0.3 * g1(t, 0.065, 0.009) + 0.3 * g1(t, k.QT - 0.075, 0.035);
  let lv; let vol; let phase; let av = 0; let sl = 0;
  if (t < tMC) { lv = 9 + 3 * atr; vol = EDV; phase = 'fill'; av = 1; }
  else if (t < tAO) { const u = (t - tMC) / (tAO - tMC); lv = 10 + 70 * smooth(u); vol = EDV; phase = 'ivc'; }
  else if (t < tAC) {
    const u = (t - tAO) / (tAC - tAO);
    lv = u < 0.38 ? 80 + 40 * Math.sin((u / 0.38) * Math.PI / 2) : 120 - 22 * ((u - 0.38) / 0.62) ** 1.4;
    vol = EDV - SV * (1 - (1 - u) ** 2); phase = 'ej'; sl = 1;
  } else if (t < tMO) { const u = (t - tAC) / (tMO - tAC); lv = 98 - 92 * smooth(u); vol = ESV; phase = 'ivr'; }
  else {
    const d = t - tMO;
    lv = 6 - 3 * Math.exp(-d / 0.05) * (d / 0.05) + 2 * smooth(d / 0.3) + 3 * atr;
    const kick = 0.2 * SV;
    // passive filling, then the atrial kick tops it up
    const pass = (SV - kick) * (1 - Math.exp(-d / 0.09));
    const kp = da < 0.11 ? kick * smooth(da / 0.11) : (t > pOn + 0.05 ? kick : 0);
    vol = ESV + pass + kp; phase = atr > 0.05 ? 'atr' : 'fill'; av = 1;
  }
  // aorta
  let ao;
  if (t >= tAO && t < tAC) { const u = (t - tAO) / (tAC - tAO); ao = lv - 2 * Math.sin(u * Math.PI); }
  else {
    const D = T - tAC + tAO; const d = wrap(t - tAC, T); const tau = 0.4;
    ao = 80 + 18 * (Math.exp(-d / tau) - Math.exp(-D / tau)) / (1 - Math.exp(-D / tau)) - 4 * g1(d, 0.012, 0.006) + 1.2 * g1(d, 0.035, 0.012);
  }
  // left atrium: a wave, c wave, v wave
  const vRise = t >= tAO && t < tMO ? (t - tAO) / (tMO - tAO) : t >= tMO ? Math.exp(-(t - tMO) / 0.06) : 0;
  const la = 5 + 5 * atr + 2 * g1(t, tMC + 0.02, 0.015) + 6 * vRise;
  return { lv, ao, la, ecg, vol, atr, phase, av, sl, vRise };
}

const PHASE = {
  atr: ['Atrial systole', 'The P wave spreads through the atria and they squeeze, topping up the ventricles with the last part of their filling (the atrial kick).'],
  fill: ['Ventricular filling', 'The ventricles are relaxed. Blood flows from the veins through the atria and the open tricuspid and mitral valves.'],
  ivc: ['Isovolumetric contraction', 'The QRS has fired. The ventricles squeeze, pressure rises, and the AV valves snap shut (S1, "lub"). For a moment every valve is closed.'],
  ej: ['Ejection', 'Ventricular pressure beats the arteries, so the pulmonary and aortic valves open and blood is pushed out to the lungs and the body.'],
  ivr: ['Isovolumetric relaxation', 'After the T wave the ventricles relax. Pressure falls below the arteries and the aortic and pulmonary valves close (S2, "dub"). All valves are shut again.'],
};

export default {
  mount(ctx) {
    injectStyle();
    const cv = ctx.canvas();
    const g = cv.ctx;
    let hr = ctx.store.get('heart:hr', 75);
    let K = timing(hr);
    let tAbs = 0; let tb = 0; let slow = 1; let sound = false; let actx = null;

    // blood particles moving along two paths
    const PATH = {
      R: [[150, 0], [150, 92], [160, 150], [165, 228], [180, 325], [262, 268], [272, 232], [272, 0]],
      L: [[450, 0], [450, 92], [440, 150], [435, 228], [420, 325], [338, 268], [328, 232], [328, 0]],
    };
    const WID = [5, 6, 32, 5, 42, 14, 5, 6];
    const geo = {};
    for (const [k, pts] of Object.entries(PATH)) { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); geo[k] = { pts, cum, total: cum[cum.length - 1] }; }
    const at = (G, s) => {
      let i = 1; while (i < G.cum.length - 1 && G.cum[i] < s) i++;
      const u = clamp((s - G.cum[i - 1]) / (G.cum[i] - G.cum[i - 1]), 0, 1);
      const [ax, ay] = G.pts[i - 1]; const [bx, by] = G.pts[i];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      return [ax + (bx - ax) * u, ay + (by - ay) * u, -(by - ay) / len, (bx - ax) / len, WID[i - 1] + (WID[i] - WID[i - 1]) * u];
    };
    const parts = [];
    for (const k of ['R', 'L']) for (let i = 0; i < 46; i++) parts.push({ k, s: Math.random() * geo[k].total, off: Math.random() * 2 - 1, cap: Math.random() });

    function moveParts(dt, m) {
      for (const p of parts) {
        const G = geo[p.k]; const sAV = G.cum[3]; const sSL = G.cum[6];
        let v = 60;
        if (p.s < sAV) { v = m.av ? 130 : 35; if (!m.av) p.s = Math.min(p.s + v * dt, Math.max(p.s, sAV - 6 - p.cap * 70)); else p.s += v * dt; }
        else if (p.s < sSL) { if (m.sl) p.s += 260 * dt; else { const cap = sSL - 8 - p.cap * 110; p.s = Math.min(p.s + (m.av ? 70 : 20) * dt, Math.max(p.s, cap)); } }
        else p.s += 220 * dt;
        if (p.s > G.total) { p.s = 0; p.cap = Math.random(); }
      }
    }

    // UI
    ctx.panel.append(
      ctx.h('<h2 class="k-h">The heart</h2>'),
      ctx.h('<p class="lede">Two pumps side by side. The right heart sends blood to the lungs, the left heart sends it to the whole body. One electrical signal times every squeeze.</p>'),
    );
    const phaseCard = ctx.h('<div class="card bio-info"><div class="bio-big"></div><p class="small"></p></div>');
    ctx.panel.append(phaseCard);
    const hrS = ctx.slider({ label: 'Heart rate', min: 40, max: 160, step: 1, value: hr, fmt: (v) => `${v} bpm`, onInput: (v) => { hr = v; ctx.store.set('heart:hr', v); K = timing(hr); renderStats(); } });
    ctx.panel.append(hrS);
    const row = ctx.h('<div class="row"></div>');
    const slowB = ctx.h('<button class="btn ghost sm">Slow motion</button>');
    slowB.onclick = () => { slow = slow === 1 ? 0.25 : 1; slowB.classList.toggle('on', slow < 1); slowB.textContent = slow < 1 ? 'Normal speed' : 'Slow motion'; };
    const sndB = ctx.h('<button class="btn ghost sm">Heart sounds: off</button>');
    sndB.onclick = () => {
      sound = !sound; sndB.textContent = `Heart sounds: ${sound ? 'on' : 'off'}`;
      if (sound && !actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { actx = null; sndB.textContent = 'Sound not available'; sound = false; } }
      if (actx && actx.state === 'suspended') actx.resume();
    };
    row.append(slowB, sndB);
    ctx.panel.append(row);
    const stats = ctx.h('<div class="stat"></div>');
    ctx.panel.append(stats);
    function renderStats() {
      const sys = K.QT; const dia = K.T - K.QT;
      stats.innerHTML = `<div><b>${(K.T * 1000).toFixed(0)} ms</b><span>one beat</span></div><div><b>${(sys * 1000).toFixed(0)} ms</b><span>systole (QT)</span></div><div><b>${(dia * 1000).toFixed(0)} ms</b><span>diastole</span></div><div><b>${((hr * SV) / 1000).toFixed(1)} L/min</b><span>cardiac output</span></div><div><b>120/80</b><span>aortic pressure</span></div><div><b>${Math.round((SV / EDV) * 100)}%</b><span>ejection fraction</span></div>`;
    }
    renderStats();

    ctx.panel.append(
      ctx.h('<div class="card tip"><p>Blood loops twice. Body to right atrium to right ventricle to lungs, then lungs to left atrium to left ventricle to body. Four one way valves stop it flowing backwards. The ECG is the electrical signal: P makes the atria contract, QRS the ventricles, T is the ventricles resetting. The heart sounds are valves closing: "lub" (S1) is the AV valves at the start of systole, "dub" (S2) is the aortic and pulmonary valves at the end.</p></div>'),
      ctx.h('<div class="card try"><ol class="small"><li>Press Slow motion and follow one beat. Notice when all four valves are closed at once, twice per beat.</li><li>Find S1 and S2 on the pressure graph: S2 sits on the small notch in the aortic curve.</li><li>Drag the heart rate up to 150. Systole barely shortens but diastole shrinks a lot, which leaves less time to fill (and for the heart muscle itself to be perfused).</li></ol></div>'),
      ctx.h(`<div class="card deep"><p class="small"><b>Typical adult values at rest</b> (textbook numbers, individuals vary):</p>
        <table class="bio-tbl">
        <tr><td>Heart rate</td><td>60 to 100 bpm</td></tr>
        <tr><td>Stroke volume</td><td>about 70 mL (60 to 100)</td></tr>
        <tr><td>Cardiac output</td><td>about 5 L/min (4 to 8)</td></tr>
        <tr><td>Ejection fraction</td><td>about 55 to 70%</td></tr>
        <tr><td>LV pressure</td><td>about 120 / 5 to 12 mmHg</td></tr>
        <tr><td>RV and pulmonary artery</td><td>about 25 / 0 to 8 and 25 / 10 mmHg</td></tr>
        <tr><td>PR interval</td><td>0.12 to 0.20 s</td></tr>
        <tr><td>QRS duration</td><td>under 0.12 s</td></tr></table>
        <p class="small"><b>Cardiac output</b> = heart rate × stroke volume. This model keeps stroke volume fixed so you can see the timing change; in a real heart stroke volume also changes with filling (the Frank Starling mechanism), contractility and afterload, and it falls when the rate is so fast that filling time runs out.</p>
        <p class="small"><b>Blood pressure basics.</b> Systolic is the peak in the arteries during ejection, diastolic the lowest point just before the next ejection. Mean arterial pressure is roughly diastolic + one third of the pulse pressure: about 93 mmHg for 120/80. Under the 2017 ACC/AHA guideline, normal is below 120/80, elevated is 120 to 129 systolic with diastolic below 80, stage 1 hypertension is 130 to 139 or 80 to 89, and stage 2 is 140/90 or higher. Some guidelines, such as those used in Europe and the UK, diagnose hypertension from 140/90.</p>
        <p class="small"><b>Conduction.</b> SA node, atria, AV node (the delay that makes the PR interval), bundle of His, bundle branches, Purkinje fibres.</p></div>`),
    );
    ctx.quiz([
      { q: 'What causes the first heart sound (S1)?', choices: ['Opening of the aortic valve', 'Closure of the mitral and tricuspid valves', 'Atrial contraction', 'Closure of the aortic and pulmonary valves'], answer: 1, why: 'S1 is the AV valves closing as the ventricles start to contract. S2 is the semilunar valves closing.' },
      { q: 'During isovolumetric contraction, which valves are open?', choices: ['Mitral and tricuspid', 'Aortic and pulmonary', 'All four', 'None'], answer: 3, why: 'Pressure rises with every valve shut, so the volume cannot change. That is why it is called isovolumetric.' },
      { q: 'Heart rate 70 bpm, stroke volume 70 mL. What is the cardiac output?', choices: ['About 1 L/min', 'About 4.9 L/min', 'About 49 L/min', 'About 0.49 L/min'], answer: 1, why: '70 × 70 mL = 4900 mL per minute, about 4.9 L/min.' },
    ]);

    // sound
    function thump(freq, dur, gain) {
      if (!actx || !sound) return;
      const o = actx.createOscillator(); const gn = actx.createGain();
      o.type = 'sine'; o.frequency.value = freq; o.frequency.exponentialRampToValueAtTime(freq * 0.6, actx.currentTime + dur);
      gn.gain.setValueAtTime(0.0001, actx.currentTime); gn.gain.exponentialRampToValueAtTime(gain, actx.currentTime + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
      o.connect(gn).connect(actx.destination); o.start(); o.stop(actx.currentTime + dur + 0.02);
    }

    // heart geometry (logical 600 x 440)
    const HW = 600; const HH = 440;
    const shapes = {
      RA: [[80, 90], [230, 90], [230, 205], [80, 205]],
      LA: [[370, 90], [520, 90], [520, 205], [370, 205]],
      RV: [[80, 240], [290, 240], [290, 330], [240, 415], [80, 415]],
      LV: [[310, 240], [520, 240], [520, 415], [360, 415], [310, 330]],
    };
    const poly = (pts, sc, r = 20) => {
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length; const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      const P = pts.map(([x, y]) => [cx + (x - cx) * sc, cy + (y - cy) * sc]);
      g.beginPath();
      for (let i = 0; i < P.length; i++) { const a = P[(i - 1 + P.length) % P.length]; const b = P[i]; const c = P[(i + 1) % P.length]; const m1 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if (i === 0) g.moveTo(...m1); g.arcTo(b[0], b[1], c[0], c[1], r); }
      g.closePath();
    };
    function valve(x1, x2, y, open, dir, col) {
      // two leaflets hinged at the walls; open swings them along the flow (dir = +1 down, -1 up)
      const len = (x2 - x1) / 2 - 1; const a = open * 1.25;
      g.strokeStyle = col; g.lineWidth = 3.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x1, y); g.lineTo(x1 + Math.cos(a) * len, y + dir * Math.sin(a) * len); g.stroke();
      g.beginPath(); g.moveTo(x2, y); g.lineTo(x2 - Math.cos(a) * len, y + dir * Math.sin(a) * len); g.stroke();
    }
    let vo = { av: 1, sl: 0 };

    function drawHeart(m, box) {
      const v = fit(box.w, box.h, HW, HH, 6);
      g.save(); g.translate(box.x + v.ox, box.y + v.oy); g.scale(v.s, v.s);
      // vessels
      g.lineCap = 'butt';
      const vessel = (x1, x2, y1, y2, col) => { g.fillStyle = rgba(col, 0.16); g.strokeStyle = rgba(col, 0.7); g.lineWidth = 2; g.beginPath(); g.rect(x1, y1, x2 - x1, y2 - y1); g.fill(); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1, y2); g.moveTo(x2, y1); g.lineTo(x2, y2); g.stroke(); };
      vessel(132, 168, 0, 92, BLUE); vessel(432, 468, 0, 92, RED);
      vessel(254, 290, 0, 236, BLUE); vessel(310, 346, 0, 236, RED);
      // chambers
      const vf = (m.vol - ESV) / SV;
      const vs = 0.8 + 0.2 * vf;
      const as = 1 - 0.12 * m.atr + 0.05 * m.vRise;
      for (const [k, sc, col] of [['RA', as, BLUE], ['LA', as, RED], ['RV', vs, BLUE], ['LV', vs, RED]]) {
        poly(shapes[k], sc, 24);
        g.fillStyle = rgba(col, 0.2); g.fill();
        g.strokeStyle = rgba(col, 0.9); g.lineWidth = k === 'LV' ? 9 : k === 'RV' ? 5 : 3; g.stroke();
      }
      // particles
      for (const p of parts) {
        const [x, y, nx, ny, wd] = at(geo[p.k], p.s);
        g.fillStyle = p.k === 'R' ? '#93c5fd' : '#fda4af';
        g.beginPath(); g.arc(x + nx * p.off * wd, y + ny * p.off * wd, 2.6, 0, 7); g.fill();
      }
      // valves
      valve(125, 205, 222, vo.av, 1, '#F5F5F0'); valve(395, 475, 222, vo.av, 1, '#F5F5F0');
      valve(254, 290, 236, vo.sl, -1, '#F5F5F0'); valve(310, 346, 236, vo.sl, -1, '#F5F5F0');
      // labels
      g.font = DISP(17, 700); g.fillStyle = '#F5F5F0'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('RA', 105, 112); g.fillText('LA', 495, 112); g.fillText('RV', 120, 380); g.fillText('LV', 480, 380);
      g.font = MONO(11); g.fillStyle = '#A0A09A';
      g.textAlign = 'right'; g.fillText('from body', 126, 40); g.fillText('to lungs', 248, 40);
      g.textAlign = 'left'; g.fillText('to body', 352, 40); g.fillText('from lungs', 474, 40);
      g.textAlign = 'right'; g.fillText('tricuspid', 76, 222);
      g.textAlign = 'left'; g.fillText('mitral', 524, 222);
      for (const [x, lab] of [[272, 'pulmonary valve'], [328, 'aortic valve']]) { g.save(); g.translate(x, 150); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillStyle = '#E8E8E3'; g.fillText(lab, 0, 0); g.restore(); }
      g.textAlign = 'center'; g.fillStyle = '#A0A09A';
      g.font = MONO(10); g.fillText('(patient\'s right)', 155, 430); g.fillText('(patient\'s left)', 445, 430);
      g.restore();
    }

    function drawTraces(box, now) {
      const { x, y, w, h } = box;
      const win = 3; // seconds
      const pH = h * 0.62; const eH = h - pH - 8;
      const px = (tt) => x + 40 + ((wrap(tt, win)) / win) * (w - 50);
      // axes
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1;
      g.font = MONO(10); g.fillStyle = '#5A5A55'; g.textAlign = 'right'; g.textBaseline = 'middle';
      for (const mm of [0, 40, 80, 120]) { const yy = y + pH - (mm / 135) * (pH - 14); g.beginPath(); g.moveTo(x + 40, yy); g.lineTo(x + w - 10, yy); g.stroke(); g.fillText(`${mm}`, x + 34, yy); }
      g.save(); g.translate(x + 8, y + pH / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText('mmHg', 0, 0); g.restore();
      const series = [['ao', RED, 'aorta'], ['lv', '#FBBF24', 'left ventricle'], ['la', BLUE, 'left atrium']];
      const step = 1 / 240;
      const gap = 0.12;
      const gy = (v) => y + pH - (v / 135) * (pH - 14);
      const ey = (v) => y + pH + 8 + eH * 0.62 - v * eH * 0.45;
      for (const [key, col] of [...series, ['ecg', '#5EEAD4']]) {
        g.strokeStyle = col; g.lineWidth = key === 'ecg' ? 1.6 : 1.8; g.beginPath();
        let started = false; let lastX = -1;
        for (let tt = now - win + gap; tt <= now; tt += step) {
          const mm = model(wrap(tt, K.T), K);
          const X = px(tt); const Y = key === 'ecg' ? ey(mm.ecg) : gy(mm[key]);
          if (!started || X < lastX) { g.moveTo(X, Y); started = true; } else g.lineTo(X, Y);
          lastX = X;
        }
        g.stroke();
      }
      // sweep head
      const hx = px(now); g.fillStyle = '#F5F5F0'; g.fillRect(hx - 1, y, 2, h);
      // S1/S2 ticks in the visible window
      g.font = MONO(10); g.textAlign = 'center';
      const b0 = Math.floor((now - win) / K.T) - 1;
      for (let b = b0; b <= Math.floor(now / K.T) + 1; b++) {
        for (const [tt, lab] of [[b * K.T + K.tMC, 'S1'], [b * K.T + K.tAC, 'S2']]) {
          if (tt > now || tt < now - win + gap) continue;
          const X = px(tt); g.fillStyle = '#A0A09A'; g.fillText(lab, X, y + 6);
          g.strokeStyle = 'rgba(255,255,255,.18)'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(X, y + 12); g.lineTo(X, y + pH); g.stroke(); g.setLineDash([]);
        }
      }
      // legend
      g.textAlign = 'left'; let lx = x + 44; const ly = y + h + 2;
      for (const [, col, lab] of [...series, [0, '#5EEAD4', 'ECG']]) { g.fillStyle = col; g.fillRect(lx, ly - 2, 12, 3); g.fillStyle = '#A0A09A'; g.fillText(lab, lx + 16, ly); lx += g.measureText(lab).width + (w < 500 ? 22 : 34); }
    }

    let lastPh = '';
    function frame(dt) {
      const { w, h } = cv; if (!w) return;
      const prevTb = tb;
      tAbs += dt * slow; tb = wrap(tAbs, K.T);
      const m = model(tb, K);
      // sounds when crossing S1 and S2
      if (prevTb < K.tMC && tb >= K.tMC) thump(55, 0.14, 0.5);
      if (prevTb < K.tAC && tb >= K.tAC) thump(80, 0.09, 0.35);
      const rate = reduced() ? 1 : clamp(dt * 18, 0, 1);
      vo.av += (m.av - vo.av) * rate; vo.sl += (m.sl - vo.sl) * rate;
      moveParts(dt * slow, m);
      if (m.phase !== lastPh) { lastPh = m.phase; const [n, d] = PHASE[m.phase]; phaseCard.querySelector('.bio-big').textContent = n; phaseCard.querySelector('p').textContent = d; }
      g.clearRect(0, 0, w, h);
      const hh = h * 0.57;
      drawHeart(m, { x: 0, y: 0, w, h: hh });
      drawTraces({ x: 0, y: hh + 8, w, h: h - hh - 28 }, tAbs);
      g.font = DISP(15, 700); g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#F5F5F0';
      g.fillText(PHASE[m.phase][0].toUpperCase(), 8, 18);
    }
    ctx.loop((t, dt) => frame(dt));
    return () => { if (actx) actx.close(); };
  },
};
