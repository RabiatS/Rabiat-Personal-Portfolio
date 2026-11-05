// A tiny procedural band for Audio Lab: kick, snare, hats, bass and chords, all synthesised, no audio files.
// createBand(A, dest) must be called after A.ready(). It schedules notes slightly ahead with the audio clock
// and stops itself whenever the chapter stops its sound.
import { noiseBuffer } from './audio.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// Am, F, C, G (one bar each)
const CHORDS = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];
const ROOTS = [45, 41, 36, 43];
const BASS = [[0, 0], [3, 0], [6, 12], [8, 0], [10, 7], [14, 12]];

export const TRACKS = ['kick', 'snare', 'hats', 'bass', 'chords'];
export const TRACK_LABEL = { kick: 'Kick', snare: 'Snare', hats: 'Hats', bass: 'Bass', chords: 'Chords' };

export function createBand(A, dest, { bpm = 100, level = 0.8 } = {}) {
  const ac = A.ac; const nb = noiseBuffer(ac);
  const bus = ac.createGain(); bus.gain.value = level; bus.connect(dest); A.add(bus);
  const tracks = {};
  const defaults = { kick: 0.9, snare: 0.55, hats: 0.35, bass: 0.6, chords: 0.38 };
  for (const name of TRACKS) {
    const gain = ac.createGain(); gain.gain.value = defaults[name];
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    const an = ac.createAnalyser(); an.fftSize = 1024;
    if (pan) { gain.connect(pan); pan.connect(bus); } else gain.connect(bus);
    gain.connect(an);
    A.add(gain); if (pan) A.add(pan); A.add(an);
    tracks[name] = { gain, pan, an, mute: false, solo: false, level: defaults[name] };
  }

  const env = (t, a, d, peak = 1) => { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); return g; };

  function kick(t) {
    const o = ac.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const e = env(t, 0.003, 0.42, 1); o.connect(e).connect(tracks.kick.gain); o.start(t); o.stop(t + 0.5);
  }
  function snare(t) {
    const n = ac.createBufferSource(); n.buffer = nb; const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
    const e = env(t, 0.002, 0.2, 0.8); n.connect(hp).connect(e).connect(tracks.snare.gain); n.start(t, Math.random() * 2); n.stop(t + 0.25);
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    const e2 = env(t, 0.002, 0.1, 0.6); o.connect(e2).connect(tracks.snare.gain); o.start(t); o.stop(t + 0.15);
  }
  function hat(t, open, acc) {
    const n = ac.createBufferSource(); n.buffer = nb; const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const e = env(t, 0.001, open ? 0.28 : 0.045, acc ? 0.7 : 0.4); n.connect(hp).connect(e).connect(tracks.hats.gain); n.start(t, Math.random() * 2); n.stop(t + 0.35);
  }
  function bass(t, m, dur) {
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 5; lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(220, t + 0.18);
    const e = ac.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.7, t + 0.006); e.gain.setTargetAtTime(0.0001, t + dur * 0.8, 0.03);
    o.connect(lp).connect(e).connect(tracks.bass.gain); o.start(t); o.stop(t + dur + 0.2);
  }
  function chord(t, notes, dur) {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1700; lp.Q.value = 0.6;
    const e = ac.createGain(); e.gain.setValueAtTime(0.0001, t); e.gain.exponentialRampToValueAtTime(0.32, t + 0.06); e.gain.setTargetAtTime(0.18, t + 0.1, 0.3); e.gain.setTargetAtTime(0.0001, t + dur, 0.12);
    lp.connect(e).connect(tracks.chords.gain);
    for (const m of notes) for (const det of [-7, 7]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.8);
    }
  }

  const spb = 60 / bpm; const s16 = spb / 4;
  let step = 0; let next = ac.currentTime + 0.08; let timer = null;
  function schedule() {
    while (next < ac.currentTime + 0.15) {
      const bar = Math.floor(step / 16) % 4; const s = step % 16; const t = next;
      if (s === 0 || s === 8 || (s === 10 && bar % 2 === 1)) kick(t);
      if (s === 4 || s === 12) snare(t);
      if (s % 2 === 0) hat(t, s === 14, s % 4 === 0);
      for (const [bs, off] of BASS) if (bs === s) bass(t, ROOTS[bar] + off, s16 * 1.6);
      if (s === 0) chord(t, CHORDS[bar], spb * 3.5);
      next += s16; step++;
    }
  }
  timer = setInterval(schedule, 25); schedule();
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  A.onKill.add(stop);

  function applyMix() {
    const anySolo = TRACKS.some((n) => tracks[n].solo);
    for (const n of TRACKS) {
      const tr = tracks[n]; const on = !tr.mute && (!anySolo || tr.solo);
      tr.gain.gain.setTargetAtTime(on ? tr.level : 0, ac.currentTime, 0.02);
    }
  }
  return { tracks, bus, stop, applyMix, bpm, defaults };
}
