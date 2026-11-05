// Shared sound engine for Audio Lab.
// One AudioContext for the whole lab, a master volume with mute, and a gentle safety limiter.
// Each chapter gets its own bus through makeAudio(ctx). Leaving the chapter (ctx.signal abort)
// stops every source the chapter started, closes the microphone and disconnects the bus, so nothing keeps playing.

let AC = null; let master = null;
const state = { vol: 0.35, muted: false, subs: new Set() };
try { const v = JSON.parse(localStorage.getItem('audio:vol')); if (typeof v === 'number') state.vol = v; } catch { /* no storage */ }
try { state.muted = JSON.parse(localStorage.getItem('audio:muted')) === true; } catch { /* no storage */ }

const level = () => (state.muted ? 0 : state.vol * state.vol);

export function getAC() {
  if (!AC) {
    const C = window.AudioContext || window.webkitAudioContext;
    AC = new C({ latencyHint: 'interactive' });
    master = AC.createGain();
    master.gain.value = level();
    // Safety limiter: keeps sudden peaks from getting harsh. Normal levels pass untouched.
    const lim = AC.createDynamicsCompressor();
    lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.2;
    master.connect(lim).connect(AC.destination);
  }
  return AC;
}

function apply() {
  if (master) master.gain.setTargetAtTime(level(), AC.currentTime, 0.02);
  try { localStorage.setItem('audio:vol', JSON.stringify(state.vol)); localStorage.setItem('audio:muted', JSON.stringify(state.muted)); } catch { /* private */ }
  for (const f of state.subs) f();
}

// Quantise one sample to n bits (mid rise: exactly 2^n evenly spaced levels between -1 and 1).
export function quantize(v, bits) {
  if (bits >= 24) return v;
  const L = 2 ** (bits - 1);
  let k = Math.floor(v * L);
  if (k < -L) k = -L; if (k > L - 1) k = L - 1;
  return (k + 0.5) / L;
}

// AudioWorklet that does sample and hold at a lower rate plus bit quantisation, optional TPDF dither,
// and can output only the error (what quantisation added). Loaded from a Blob, so no extra file is fetched.
const WORKLET = `
class LabCrush extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [
    { name: 'rate', defaultValue: 48000, minValue: 20, maxValue: 192000, automationRate: 'k-rate' },
    { name: 'bits', defaultValue: 24, minValue: 1, maxValue: 24, automationRate: 'k-rate' },
    { name: 'dither', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    { name: 'error', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
  ]; }
  constructor() { super(); this.ph = 1; this.hold = [0, 0]; this.err = [0, 0]; }
  q(v, bits, dith) {
    if (bits >= 24) return v;
    const L = Math.pow(2, bits - 1);
    if (dith) v += (Math.random() - Math.random()) / L;
    let k = Math.floor(v * L);
    if (k < -L) k = -L; if (k > L - 1) k = L - 1;
    return (k + 0.5) / L;
  }
  process(inputs, outputs, p) {
    const inp = inputs[0]; const out = outputs[0];
    const step = Math.min(1, p.rate[0] / sampleRate); const bits = Math.round(p.bits[0]);
    const dith = p.dither[0] > 0.5; const showErr = p.error[0] > 0.5;
    let endPh = this.ph;
    for (let c = 0; c < out.length; c++) {
      const y = out[c]; const x = inp && inp.length ? (inp[c] || inp[0]) : null;
      if (!x) { y.fill(0); continue; }
      let ph = this.ph; let hold = this.hold[c] || 0; let err = this.err[c] || 0;
      for (let i = 0; i < y.length; i++) {
        ph += step;
        if (ph >= 1) { ph -= 1; const v = x[i]; hold = this.q(v, bits, dith); err = hold - v; }
        y[i] = showErr ? err : hold;
      }
      this.hold[c] = hold; this.err[c] = err; endPh = ph;
    }
    this.ph = endPh;
    return true;
  }
}
registerProcessor('lab-crush', LabCrush);
`;
let workletP = null;
export function loadWorklet(ac) {
  if (!workletP) {
    if (!ac.audioWorklet) { workletP = Promise.resolve(false); return workletP; }
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    workletP = ac.audioWorklet.addModule(url).then(() => true, () => false);
  }
  return workletP;
}

// Noise buffers (white and pink), 3 seconds, made once.
const noiseCache = {};
export function noiseBuffer(ac, kind = 'white') {
  if (noiseCache[kind]) return noiseCache[kind];
  const n = ac.sampleRate * 3; const b = ac.createBuffer(1, n, ac.sampleRate); const d = b.getChannelData(0);
  if (kind === 'pink') {
    // Paul Kellet's refined pink noise filter
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
  } else {
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  noiseCache[kind] = b;
  return b;
}

const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };

// Per chapter audio helper.
export function makeAudio(ctx) {
  const A = { ac: null, out: null, nodes: new Set(), streams: new Set(), alive: true, onStop: new Set(), onKill: new Set() };

  // Call inside a click handler. Creates or resumes the context and a fresh chapter bus.
  A.ready = async () => {
    const ac = getAC(); A.ac = ac;
    if (ac.state !== 'running') { try { await ac.resume(); } catch { /* ignore */ } }
    if (!A.out) { A.out = ac.createGain(); A.out.connect(master); }
    return ac;
  };
  // Stop everything this chapter is making and start a clean bus.
  A.fresh = async () => { A.stopAll(); return A.ready(); };
  A.add = (n) => { A.nodes.add(n); return n; };
  A.stopAll = (quiet = false) => {
    for (const n of A.nodes) { try { if (n.stop) n.stop(); } catch { /* already stopped */ } try { n.disconnect(); } catch { /* fine */ } }
    A.nodes.clear();
    for (const s of A.streams) s.getTracks().forEach((t) => t.stop());
    A.streams.clear();
    if (A.out) { try { A.out.disconnect(); } catch { /* fine */ } A.out = null; }
    for (const f of [...A.onKill]) f();
    A.onKill.clear();
    if (!quiet) for (const f of A.onStop) f();
  };

  A.osc = (type = 'sine', freq = 440) => { const o = A.ac.createOscillator(); o.type = type; o.frequency.value = freq; A.add(o); o.start(); return o; };
  A.gain = (v = 1) => { const g = A.ac.createGain(); g.gain.value = v; return A.add(g); };
  A.noise = (kind = 'white') => { const s = A.ac.createBufferSource(); s.buffer = noiseBuffer(A.ac, kind); s.loop = true; A.add(s); s.start(); return s; };
  A.analyser = (fft = 2048, smooth = 0.6) => { const a = A.ac.createAnalyser(); a.fftSize = fft; a.smoothingTimeConstant = smooth; a.minDecibels = -110; a.maxDecibels = -10; return A.add(a); };
  A.crusher = async () => {
    const ok = await loadWorklet(A.ac);
    if (!ok) return null;
    const n = new AudioWorkletNode(A.ac, 'lab-crush', { outputChannelCount: [2] });
    return A.add(n);
  };
  // Microphone. Returns a MediaStreamAudioSourceNode or null (denied, missing or unsupported). Never routed to the speakers here.
  A.mic = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      if (!A.alive) { stream.getTracks().forEach((t) => t.stop()); return null; }
      A.streams.add(stream);
      return A.add(A.ac.createMediaStreamSource(stream));
    } catch { return null; }
  };

  // The sound bar: chapter buttons, master volume and mute.
  A.bar = (buttons = [], note = 'Start with the volume low. Headphones help.') => {
    const el = h(`<div class="a-bar"><div class="a-play"></div>
      <div class="a-vol"><label>Volume</label><input type="range" min="0" max="1" step="0.01" aria-label="Master volume"><button class="chip">Mute</button></div>
      <div class="a-note">${note}</div></div>`);
    const play = el.querySelector('.a-play'); for (const b of buttons) play.append(b);
    const inp = el.querySelector('input'); const mb = el.querySelector('.chip');
    const sync = () => { inp.value = state.vol; mb.classList.toggle('on', state.muted); mb.textContent = state.muted ? 'Muted' : 'Mute'; };
    inp.addEventListener('input', () => { state.vol = +inp.value; if (state.muted && state.vol > 0) state.muted = false; apply(); });
    mb.addEventListener('click', () => { state.muted = !state.muted; apply(); });
    state.subs.add(sync); sync();
    ctx.signal.addEventListener('abort', () => state.subs.delete(sync));
    el.note = (t, warn = false) => { const n = el.querySelector('.a-note'); n.textContent = t; n.classList.toggle('warn', warn); };
    return el;
  };

  // A play and stop toggle. start() runs after the context is ready; stop() after everything is silenced.
  A.toggle = (label, start, stop, offLabel = 'Stop') => {
    const b = h(`<button class="btn">${label}</button>`);
    b.on = false;
    const set = (on) => { b.on = on; b.textContent = on ? offLabel : label; b.classList.toggle('live', on); };
    b.addEventListener('click', async () => {
      if (b.on) { set(false); A.stopAll(); if (stop) stop(); return; }
      await A.fresh(); if (!A.alive) return;
      set(true);
      try { await start(); } catch (e) { set(false); A.stopAll(); console.warn(e); }
    });
    A.onStop.add(() => { if (b.on) { b.on = false; b.textContent = label; b.classList.remove('live'); if (stop) stop(); } });
    // Rebuild the sound in place (for example after switching source) without flipping the button.
    b.restart = async () => { if (!b.on) return; A.stopAll(true); await A.ready(); if (A.alive && b.on) await start(); };
    b.off = () => { if (b.on) { set(false); A.stopAll(); if (stop) stop(); } };
    return b;
  };

  ctx.signal.addEventListener('abort', () => { A.alive = false; A.stopAll(); A.onStop.clear(); });
  return A;
}

// Read an analyser's level: { rms, peak } as linear values and dBFS.
export function meter(an, buf) {
  an.getFloatTimeDomainData(buf);
  let s = 0; let p = 0;
  for (let i = 0; i < buf.length; i++) { const v = buf[i]; s += v * v; const a = Math.abs(v); if (a > p) p = a; }
  const rms = Math.sqrt(s / buf.length);
  return { rms, peak: p, rmsDb: 20 * Math.log10(rms + 1e-9), peakDb: 20 * Math.log10(p + 1e-9) };
}
