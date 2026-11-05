// Chapter 10: neurons. A live Hodgkin Huxley model (squid giant axon equations) with stimulus strength,
// paired pulses for refractoriness, ion channel animation, and a chemical synapse with summation.
import { MONO, DISP, rgba, clamp, injectStyle, reduced } from './_shared.js';

// Hodgkin Huxley rate functions, V in mV, rest about -65 mV
const am = (V) => (Math.abs(V + 40) < 1e-6 ? 1 : (0.1 * (V + 40)) / (1 - Math.exp(-(V + 40) / 10)));
const bm = (V) => 4 * Math.exp(-(V + 65) / 18);
const ah = (V) => 0.07 * Math.exp(-(V + 65) / 20);
const bh = (V) => 1 / (1 + Math.exp(-(V + 35) / 10));
const an = (V) => (Math.abs(V + 55) < 1e-6 ? 0.1 : (0.01 * (V + 55)) / (1 - Math.exp(-(V + 55) / 10)));
const bn = (V) => 0.125 * Math.exp(-(V + 65) / 80);
const GNA = 120; const GK = 36; const GL = 0.3; const ENA = 50; const EK = -77; const EL = -54.387;
const rest = () => { const V = -65; return { V, m: am(V) / (am(V) + bm(V)), h: ah(V) / (ah(V) + bh(V)), n: an(V) / (an(V) + bn(V)) }; };
const TMAX = 40; // ms shown

export default {
  mount(ctx) {
    injectStyle();
    const cv = ctx.canvas();
    const g = cv.ctx;
    let view = ctx.store.get('neu:view', 'ap');
    let amp = 10; let pair = false; let gap = 12; let ms = 0; let st = rest(); let trace = []; let ghosts = []; let runningAP = false;
    const ions = [];

    function stimAt(t) { const p1 = t >= 2 && t < 3; const p2 = pair && t >= 2 + gap && t < 3 + gap; return p1 || p2 ? amp : 0; }
    function stepHH(dtms) {
      const dt = 0.01; const n = Math.round(dtms / dt);
      for (let i = 0; i < n && ms < TMAX; i++) {
        const { V, m, h } = st; const nn = st.n;
        const I = stimAt(ms);
        const INa = GNA * m ** 3 * h * (V - ENA); const IK = GK * nn ** 4 * (V - EK); const IL = GL * (V - EL);
        st.V += dt * (I - INa - IK - IL);
        st.m += dt * (am(V) * (1 - m) - bm(V) * m); st.h += dt * (ah(V) * (1 - h) - bh(V) * h); st.n += dt * (an(V) * (1 - nn) - bn(V) * nn);
        ms += dt;
        if (i % 5 === 0) trace.push([ms, st.V, GNA * st.m ** 3 * st.h, GK * st.n ** 4, I, INa, IK]);
      }
      if (ms >= TMAX) { runningAP = false; renderStat(); }
    }
    function fire() {
      if (trace.length) ghosts = [trace, ...ghosts].slice(0, 3);
      st = rest(); ms = 0; trace = []; runningAP = true;
      if (reduced()) { stepHH(TMAX); }
    }

    // synapse state
    const syn = { t: 0, vpost: -70, hist: [], ves: [], nt: [], ca: [], rec: [], ap: 0, ache: true, spikes: 0, pending: [] };
    for (let i = 0; i < 9; i++) syn.ves.push({ x: 0.3 + (i % 3) * 0.2 + Math.random() * 0.05, y: 0.25 + Math.floor(i / 3) * 0.1, s: 'full', p: 0 });
    for (let i = 0; i < 8; i++) syn.rec.push({ x: 0.22 + i * 0.08, bound: 0 });
    function synFire() { syn.ap = 1; syn.pending.push(0.35); }

    // UI
    ctx.panel.append(
      ctx.h('<h2 class="k-h">The action potential</h2>'),
      ctx.h('<p class="lede">Neurons talk in brief electrical spikes. A spike is ions rushing through channels in the membrane: sodium in, then potassium out. This is a real model of it, the equations Hodgkin and Huxley wrote in 1952.</p>'),
    );
    const seg = ctx.seg([['ap', 'Axon'], ['syn', 'Synapse']], view, (v) => { view = v; ctx.store.set('neu:view', v); show(); });
    ctx.panel.append(seg);
    const pAP = ctx.h('<div style="display:grid;gap:14px"></div>');
    const fireB = ctx.h('<button class="btn sm">Stimulate</button>');
    fireB.onclick = fire;
    const clr = ctx.h('<button class="btn ghost sm">Clear traces</button>');
    clr.onclick = () => { ghosts = []; };
    const pairChk = ctx.h('<label class="check"><input type="checkbox"> Second stimulus</label>');
    pairChk.querySelector('input').addEventListener('change', (e) => { pair = e.target.checked; gapS.style.opacity = pair ? 1 : 0.4; }, { signal: ctx.signal });
    const gapS = ctx.slider({ label: 'Gap between stimuli', min: 2, max: 25, step: 0.5, value: gap, fmt: (v) => `${v} ms`, onInput: (v) => { gap = v; } });
    gapS.style.opacity = 0.4;
    const statAP = ctx.h('<div class="stat"></div>');
    const r1 = ctx.h('<div class="row"></div>'); r1.append(fireB, clr);
    pAP.append(
      ctx.slider({ label: 'Stimulus strength', min: 0, max: 40, step: 0.5, value: amp, fmt: (v) => `${v} µA/cm²`, onInput: (v) => { amp = v; } }),
      r1, pairChk, gapS, statAP,
      ctx.h('<div class="card tip"><p>At rest the inside of the cell is negative. A push (stimulus) that is big enough opens voltage gated sodium channels; sodium floods in and the inside swings positive. Then sodium channels shut (inactivate) and potassium channels open, so potassium flows out and the voltage falls back, briefly overshooting. A stimulus that is too small does almost nothing; any stimulus above threshold gives the same full spike. That is "all or none".</p></div>'),
      ctx.h('<div class="card try"><ol class="small"><li>Set strength to 5 and press Stimulate. Then 7, then 30. Below threshold: a small bump. Above: the same size spike each time.</li><li>Tick Second stimulus at strength 10. Shrink the gap until the second spike fails (absolute refractory period), then raise the strength to 40 and find gaps where only a strong stimulus works (relative refractory).</li><li>Watch the lower graph: sodium conductance (amber) rises and falls first, potassium (violet) is slower and lasts longer.</li></ol></div>'),
      ctx.h(`<details class="more"><summary>Going deeper</summary><div class="small">
        <div class="formula">C dV/dt = I − g̅Na m³h (V − ENa) − g̅K n⁴ (V − EK) − gL (V − EL)<span>m, h and n are gates that open and close at voltage dependent rates. This page solves it every 0.01 ms.</span></div>
        <p><b>Resting potential.</b> Set mostly by K⁺ leaking out through open potassium channels, so it sits near EK. The Na⁺/K⁺ ATPase pumps 3 Na⁺ out and 2 K⁺ in per ATP, keeping the gradients. Textbook mammalian neurons rest near -70 mV; this squid axon model rests at -65 mV.</p>
        <p><b>Equilibrium potentials</b> come from the Nernst equation, E = (61.5 mV / z) log₁₀([out]/[in]) at body temperature. For a mammalian neuron, EK is about -90 mV and ENa about +60 mV.</p>
        <p><b>Threshold is not a fixed number.</b> It depends on how fast the membrane is pushed and on how many Na⁺ channels are inactivated. In this model a 1 ms pulse needs about 6.5 µA/cm². Textbooks often quote about -55 mV for real neurons.</p>
        <p><b>Clinical links.</b> Local anaesthetics like lidocaine block voltage gated Na⁺ channels. Tetrodotoxin (pufferfish) does too. High blood K⁺ (hyperkalaemia) depolarises cells, first making them more excitable and then inactivating Na⁺ channels, which is why it is dangerous for the heart. Myelin lets the spike jump between nodes of Ranvier (saltatory conduction); multiple sclerosis strips it.</p></div></details>`),
    );
    const pSyn = ctx.h('<div style="display:grid;gap:14px"></div>');
    const sf = ctx.h('<button class="btn sm">Fire one spike</button>'); sf.onclick = synFire;
    const sb = ctx.h('<button class="btn ghost sm">Burst of 5</button>'); sb.onclick = () => { for (let i = 0; i < 5; i++) syn.pending.push(0.35 + i * 0.22); syn.ap = 1; };
    const inh = ctx.h('<label class="check"><input type="checkbox"> Add a cholinesterase inhibitor</label>');
    inh.querySelector('input').addEventListener('change', (e) => { syn.ache = !e.target.checked; }, { signal: ctx.signal });
    const r2 = ctx.h('<div class="row"></div>'); r2.append(sf, sb);
    pSyn.append(r2, inh,
      ctx.h('<div class="card tip"><p>A spike cannot jump the gap between neurons. At the axon terminal it opens calcium channels; calcium makes vesicles fuse with the membrane and spill neurotransmitter (here acetylcholine) into the cleft. It binds receptors on the next cell, which open and let positive ions in: a small bump called an EPSP. One bump is usually not enough, but several close together add up (summation) and can reach threshold.</p></div>'),
      ctx.h('<div class="card try"><ol class="small"><li>Fire one spike and follow it: calcium (sky), vesicles, transmitter (amber), receptors lighting up, the bump on the graph.</li><li>Press Burst of 5. The bumps stack and cross threshold: temporal summation.</li><li>Tick the cholinesterase inhibitor and fire one spike. Transmitter lingers, so the bump is bigger and longer. Drugs like neostigmine use this to treat myasthenia gravis.</li></ol></div>'),
      ctx.h('<details class="more"><summary>Going deeper</summary><div class="small"><p><b>Excitatory and inhibitory.</b> Glutamate is the main excitatory transmitter in the brain (AMPA and NMDA receptors). GABA and glycine are inhibitory: they open Cl⁻ channels and make IPSPs that pull the cell away from threshold. Benzodiazepines boost GABA-A receptors.</p><p><b>Ending the signal.</b> Acetylcholinesterase breaks acetylcholine down in about a millisecond. Most other transmitters are taken back up by transporters: SSRIs block serotonin reuptake, cocaine blocks dopamine reuptake.</p><p><b>Summation.</b> Temporal summation is EPSPs from one synapse arriving close in time; spatial summation is EPSPs from many synapses at once. The decision to fire is made at the axon hillock, which has the most Na⁺ channels.</p><p><b>Timing in this view</b> is slowed down a lot so you can see each step; a real synaptic delay is about 0.5 to 1 ms.</p></div></details>'));
    ctx.panel.append(pAP, pSyn);
    function show() { pAP.hidden = view !== 'ap'; pSyn.hidden = view !== 'syn'; }
    show();
    function renderStat() {
      const peak = trace.reduce((a, x) => Math.max(a, x[1]), -100);
      let spikes = 0; let up = false; for (const x of trace) { if (!up && x[1] > 0) { spikes++; up = true; } if (x[1] < -30) up = false; }
      const minV = trace.reduce((a, x) => Math.min(a, x[1]), 0);
      statAP.innerHTML = `<div><b>${peak.toFixed(0)} mV</b><span>peak</span></div><div><b>${spikes}</b><span>spikes</span></div><div><b>${minV.toFixed(0)} mV</b><span>lowest (after hyperpolarisation)</span></div>`;
    }
    statAP.innerHTML = '<div><b>-65 mV</b><span>resting</span></div><div><b>0</b><span>spikes</span></div>';

    // ---------- drawing: axon view
    function drawAP(dt) {
      const { w, h } = cv;
      const mh = Math.min(h * 0.3, 200);
      // membrane with channels
      const my = mh * 0.55; const thick = 26;
      g.fillStyle = 'rgba(96,165,250,.05)'; g.fillRect(0, 0, w, my - thick / 2);
      g.fillStyle = 'rgba(167,139,250,.06)'; g.fillRect(0, my + thick / 2, w, mh - my - thick / 2);
      g.fillStyle = 'rgba(232,232,227,.12)'; g.fillRect(0, my - thick / 2, w, thick);
      g.font = MONO(10.5); g.fillStyle = '#A0A09A'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText('outside: high Na⁺', 8, 12); g.fillText('inside: high K⁺', 8, mh - 10);
      const V = st.V; const mOpen = st.m ** 3 * st.h; const nOpen = st.n ** 4;
      const chans = []; const nc = Math.max(4, Math.floor(w / 120));
      for (let i = 0; i < nc; i++) chans.push([(i + 0.5) * (w / nc), i % 2 ? 'K' : 'Na']);
      for (const [x, type] of chans) {
        const open = type === 'Na' ? mOpen / 0.6 : nOpen / 0.5; const o = clamp(open, 0, 1);
        const col = type === 'Na' ? '#FBBF24' : '#A78BFA';
        const pw = 9 + 9 * o;
        g.fillStyle = rgba(col, 0.75); g.fillRect(x - 12 - pw / 2, my - thick / 2 - 4, 12, thick + 8); g.fillRect(x + pw / 2, my - thick / 2 - 4, 12, thick + 8);
        if (type === 'Na') { const hb = 1 - st.h; if (hb > 0.3) { g.fillStyle = '#FBBF24'; g.beginPath(); g.arc(x, my + thick / 2 + 6 - 6 * clamp((hb - 0.3) * 2, 0, 1), 5, 0, 7); g.fill(); } }
        g.font = MONO(10); g.fillStyle = col; g.textAlign = 'center'; g.fillText(type === 'Na' ? 'Na⁺ channel' : 'K⁺ channel', x, my - thick / 2 - 14);
        // spawn ions according to current
        const last = trace[trace.length - 1];
        const cur = last ? (type === 'Na' ? -last[5] : last[6]) : 0;
        if (runningAP && Math.random() < clamp(cur / 400, 0, 0.9)) ions.push({ x: x + (Math.random() - 0.5) * pw * 0.6, y: type === 'Na' ? my - thick : my + thick, vy: type === 'Na' ? 90 : -90, col, life: 1 });
      }
      for (let i = ions.length - 1; i >= 0; i--) { const p = ions[i]; p.y += p.vy * dt; p.life -= dt * 0.9; if (p.life <= 0) { ions.splice(i, 1); continue; } g.globalAlpha = p.life; g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, 3, 0, 7); g.fill(); g.globalAlpha = 1; }
      // background ions, static
      for (let i = 0; i < 26; i++) { const x = ((i * 97) % 1000) / 1000 * w; g.fillStyle = rgba('#FBBF24', 0.35); g.beginPath(); g.arc(x, 24 + ((i * 37) % 30), 2.4, 0, 7); g.fill(); g.fillStyle = rgba('#A78BFA', 0.35); g.beginPath(); g.arc((x + 31) % w, mh - 30 - ((i * 53) % 24), 2.4, 0, 7); g.fill(); }
      g.textAlign = 'right'; g.font = MONO(12); g.fillStyle = V > -30 ? '#FBBF24' : '#E8E8E3'; g.fillText(`${V.toFixed(0)} mV`, w - 8, my);
      // graph
      const gx = 44; const gy = mh + 18; const gw = w - gx - 12; const gh = (h - gy - 26) * 0.66; const cy0 = gy + gh + 22; const ch = h - cy0 - 18;
      const X = (t) => gx + (t / TMAX) * gw; const Y = (v) => gy + ((50 - v) / 140) * gh;
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; g.font = MONO(10); g.fillStyle = '#5A5A55'; g.textAlign = 'right';
      for (const v of [40, 0, -40, -80]) { g.beginPath(); g.moveTo(gx, Y(v)); g.lineTo(gx + gw, Y(v)); g.stroke(); g.fillText(`${v}`, gx - 6, Y(v)); }
      g.textAlign = 'center'; for (let t = 0; t <= TMAX; t += 10) g.fillText(`${t} ms`, X(t), cy0 + ch + 10);
      // threshold band
      g.fillStyle = 'rgba(251,113,133,.08)'; g.fillRect(gx, Y(-55), gw, Y(-62) - Y(-55));
      g.fillStyle = '#A0A09A'; g.textAlign = 'left'; g.fillText('threshold region', gx + 4, Y(-55) - 7);
      g.fillText('rest -65', gx + gw - 60, Y(-65) + 9);
      for (const [k, gh2] of ghosts.entries()) { g.strokeStyle = `rgba(245,245,240,${0.22 - k * 0.06})`; g.lineWidth = 1.2; g.beginPath(); gh2.forEach(([t, v], i) => (i ? g.lineTo(X(t), Y(v)) : g.moveTo(X(t), Y(v)))); g.stroke(); }
      g.strokeStyle = '#5EEAD4'; g.lineWidth = 2; g.beginPath(); trace.forEach(([t, v], i) => (i ? g.lineTo(X(t), Y(v)) : g.moveTo(X(t), Y(v)))); g.stroke();
      // stimulus marks
      g.fillStyle = '#E8E8E3';
      for (const t0 of pair ? [2, 2 + gap] : [2]) if (t0 < TMAX) { g.fillRect(X(t0), gy + gh + 4, Math.max(2, X(t0 + 1) - X(t0)), 6); }
      g.font = MONO(10); g.fillStyle = '#A0A09A'; g.textAlign = 'left'; g.fillText('stimulus', gx + gw - 54, gy + gh + 7);
      // conductances
      const Yc = (v) => cy0 + ch - (v / 40) * ch;
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.strokeRect(gx, cy0, gw, ch);
      for (const [idx, col] of [[2, '#FBBF24'], [3, '#A78BFA']]) { g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); trace.forEach((r, i) => { const y = Yc(Math.min(40, r[idx])); if (i) g.lineTo(X(r[0]), y); else g.moveTo(X(r[0]), y); }); g.stroke(); }
      g.fillStyle = '#FBBF24'; g.fillText('gNa', gx + 4, cy0 + 9); g.fillStyle = '#A78BFA'; g.fillText('gK', gx + 40, cy0 + 9);
      g.fillStyle = '#5EEAD4'; g.fillText('membrane potential (mV)', gx + 4, gy + 6);
    }

    // ---------- drawing: synapse view
    function drawSyn(dt) {
      const { w, h } = cv;
      const sw = Math.min(w, 620); const ox = (w - sw) / 2;
      const gh = Math.min(170, h * 0.32);
      const top = 6; const preB = (h - gh) * 0.46; const postT = preB + Math.max(34, (h - gh) * 0.1); const bot = h - gh - 16;
      syn.t += dt;
      // AP arriving
      for (let i = syn.pending.length - 1; i >= 0; i--) { syn.pending[i] -= dt; if (syn.pending[i] <= 0) { syn.pending.splice(i, 1); calcium(); } }
      syn.ap = Math.max(0, syn.ap - dt * 1.2);
      // presynaptic terminal shape
      g.fillStyle = rgba('#5EEAD4', 0.07 + 0.2 * syn.ap); g.strokeStyle = rgba('#5EEAD4', 0.7); g.lineWidth = 2;
      g.beginPath(); g.moveTo(ox + sw * 0.42, top); g.lineTo(ox + sw * 0.42, preB - (preB - top) * 0.55); g.quadraticCurveTo(ox + sw * 0.12, preB - (preB - top) * 0.45, ox + sw * 0.12, preB - 18); g.quadraticCurveTo(ox + sw * 0.12, preB, ox + sw * 0.3, preB); g.lineTo(ox + sw * 0.7, preB); g.quadraticCurveTo(ox + sw * 0.88, preB, ox + sw * 0.88, preB - 18); g.quadraticCurveTo(ox + sw * 0.88, preB - (preB - top) * 0.45, ox + sw * 0.58, preB - (preB - top) * 0.55); g.lineTo(ox + sw * 0.58, top); g.fill(); g.stroke();
      // postsynaptic membrane
      g.fillStyle = rgba('#A78BFA', 0.07); g.strokeStyle = rgba('#A78BFA', 0.7);
      g.beginPath(); g.moveTo(ox + sw * 0.08, bot); g.lineTo(ox + sw * 0.08, postT + 14); g.quadraticCurveTo(ox + sw * 0.08, postT, ox + sw * 0.2, postT); g.lineTo(ox + sw * 0.8, postT); g.quadraticCurveTo(ox + sw * 0.92, postT, ox + sw * 0.92, postT + 14); g.lineTo(ox + sw * 0.92, bot); g.fill(); g.stroke();
      g.font = MONO(10.5); g.fillStyle = '#A0A09A'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText('axon terminal', ox + sw * 0.6 + 6, top + 12); g.textAlign = 'right'; g.fillText('synaptic cleft', ox + sw - 2, (preB + postT) / 2); g.textAlign = 'left'; g.fillText('postsynaptic cell', ox + sw * 0.08 + 6, bot - 10);
      // Ca channels
      const cax = [ox + sw * 0.22, ox + sw * 0.78];
      for (const x of cax) { g.fillStyle = rgba('#60A5FA', 0.8); g.fillRect(x - 10, preB - 8, 6, 16); g.fillRect(x + 4, preB - 8, 6, 16); }
      for (let i = syn.ca.length - 1; i >= 0; i--) { const c = syn.ca[i]; c.y -= 60 * dt; c.x += (Math.random() - 0.5) * 20 * dt; c.life -= dt; if (c.life <= 0) { syn.ca.splice(i, 1); continue; } g.fillStyle = rgba('#60A5FA', c.life); g.beginPath(); g.arc(c.x, c.y, 2.6, 0, 7); g.fill(); }
      g.fillStyle = '#60A5FA'; g.fillText('Ca²⁺', cax[0] - 34, preB + 12);
      // vesicles
      for (const v of syn.ves) {
        const vx = ox + sw * v.x; let vy = top + (preB - top) * (0.35 + v.y);
        if (v.s === 'moving') { v.p += dt * 2.2; vy = vy + (preB - 8 - vy) * Math.min(1, v.p); if (v.p >= 1) { v.s = 'empty'; v.p = 0; release(vx, preB); } }
        else if (v.s === 'empty') { v.p += dt * 0.8; if (v.p > 1) { v.s = 'full'; v.p = 0; } }
        g.strokeStyle = 'rgba(251,191,36,.8)'; g.lineWidth = 1.2; g.beginPath(); g.arc(vx, vy, 9, 0, 7); g.stroke();
        if (v.s !== 'empty') { g.fillStyle = 'rgba(251,191,36,.6)'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(vx + Math.cos(k * 1.3) * 4, vy + Math.sin(k * 1.3) * 4, 1.6, 0, 7); g.fill(); } }
      }
      // receptors
      let open = 0;
      for (const r of syn.rec) {
        const rx = ox + sw * r.x; r.bound = Math.max(0, r.bound - dt);
        const on = r.bound > 0; if (on) open++;
        g.fillStyle = on ? '#A3E635' : 'rgba(167,139,250,.8)'; g.fillRect(rx - 9, postT - 4, 6, 12); g.fillRect(rx + 3, postT - 4, 6, 12);
        if (on) { g.fillStyle = 'rgba(163,230,53,.25)'; g.beginPath(); g.arc(rx, postT + 14, 10, 0, 7); g.fill(); }
      }
      // transmitter
      for (let i = syn.nt.length - 1; i >= 0; i--) {
        const p = syn.nt[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx += (Math.random() - 0.5) * 300 * dt; p.vy += (Math.random() - 0.5) * 300 * dt + 160 * dt;
        p.vx *= 0.98; p.vy *= 0.98;
        if (p.y < preB + 3) { p.y = preB + 3; p.vy = Math.abs(p.vy); }
        if (p.y > postT - 6) {
          const r = syn.rec.find((rr) => Math.abs(ox + sw * rr.x - p.x) < 20 && rr.bound <= 0);
          if (r && Math.random() < 0.8) { r.bound = 0.5; syn.nt.splice(i, 1); continue; }
          p.y = postT - 6; p.vy = -Math.abs(p.vy);
        }
        if (p.x < ox + sw * 0.1 || p.x > ox + sw * 0.9) p.vx *= -1;
        p.life -= dt * (syn.ache ? 1.6 : 0.22);
        if (p.life <= 0) { syn.nt.splice(i, 1); continue; }
        g.fillStyle = '#FBBF24'; g.beginPath(); g.arc(p.x, p.y, 2.4, 0, 7); g.fill();
      }
      // postsynaptic potential
      const dv = (-(syn.vpost + 70) / 0.45 + 17 * open) * dt;
      syn.vpost += dv;
      if (syn.vpost > -55) { syn.spikes++; syn.hist.push([syn.t, 30]); syn.vpost = -78; }
      syn.hist.push([syn.t, syn.vpost]);
      while (syn.hist.length && syn.hist[0][0] < syn.t - 8) syn.hist.shift();
      const gx = ox + 36; const gy = h - gh; const gw = sw - 48;
      const X = (t) => gx + ((t - (syn.t - 8)) / 8) * gw; const Y = (v) => gy + 14 + clamp((-38 - v) / 42, 0, 1) * (gh - 34);
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.strokeRect(gx, gy, gw, gh - 18);
      g.fillStyle = 'rgba(251,113,133,.6)'; g.fillRect(gx, Y(-55), gw, 1); g.font = MONO(10); g.fillStyle = '#A0A09A'; g.textAlign = 'right'; g.fillText('threshold', gx + gw - 4, Y(-55) - 7); g.fillText('-70', gx - 4, Y(-70));
      g.strokeStyle = '#A78BFA'; g.lineWidth = 1.8; g.beginPath(); syn.hist.forEach(([t, v], i) => (i ? g.lineTo(X(t), Y(v)) : g.moveTo(X(t), Y(v)))); g.stroke();
      g.textAlign = 'left'; g.fillStyle = '#A78BFA'; g.fillText(`postsynaptic potential · spikes: ${syn.spikes} · AChE ${syn.ache ? 'active' : 'blocked'}`, gx + 4, gy + 8);
    }
    function calcium() {
      syn.ap = 1;
      const { w, h } = cv; const sw = Math.min(w, 620); const ox = (w - sw) / 2; const gh = Math.min(170, h * 0.32); const preB = (h - gh) * 0.46;
      for (const x of [ox + sw * 0.22, ox + sw * 0.78]) for (let i = 0; i < 6; i++) syn.ca.push({ x: x + (Math.random() - 0.5) * 8, y: preB + 6, life: 0.6 });
      const full = syn.ves.filter((v) => v.s === 'full').sort(() => Math.random() - 0.5).slice(0, 2);
      full.forEach((v) => { v.s = 'moving'; v.p = 0; });
    }
    function release(x, y) { for (let i = 0; i < 16; i++) syn.nt.push({ x: x + (Math.random() - 0.5) * 10, y: y + 4, vx: (Math.random() - 0.5) * 60, vy: 70 + Math.random() * 70, life: 1 }); }

    ctx.loop((t, dt) => {
      const { w, h } = cv; if (!w) return;
      if (view === 'ap' && runningAP) stepHH(dt * 16);
      g.clearRect(0, 0, w, h);
      if (view === 'ap') drawAP(dt); else drawSyn(dt);
    });

    ctx.quiz([
      { q: 'Which ion movement causes the rising phase of the action potential?', choices: ['K⁺ flowing out', 'Na⁺ flowing in', 'Cl⁻ flowing in', 'Ca²⁺ pumped out'], answer: 1, why: 'Voltage gated Na⁺ channels open and Na⁺ rushes in down its gradient, driving the inside positive.' },
      { q: 'Why can a second stimulus a millisecond or two after a spike not fire another one, however strong?', choices: ['The cell has run out of sodium', 'Na⁺ channels are inactivated (absolute refractory period)', 'K⁺ channels are closed', 'The pump has stopped'], answer: 1, why: 'Inactivated Na⁺ channels must reset before they can open again, which also makes spikes travel one way along the axon.' },
      { q: 'A drug blocks acetylcholinesterase. What happens at a cholinergic synapse?', choices: ['Less acetylcholine is released', 'Acetylcholine stays longer in the cleft and the response is stronger and longer', 'Receptors are blocked', 'Calcium cannot enter'], answer: 1, why: 'Acetylcholine is not broken down, so it keeps binding receptors. This is how neostigmine helps in myasthenia gravis.' },
    ]);
    return () => {};
  },
};
