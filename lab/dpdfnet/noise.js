// Noise to put under the voice, all made here: no recordings. The cafe's
// chatter is the voice clip itself, played backwards and at other speeds, so
// it sounds like people talking without any words in it.
// Each comes back at an RMS of 1, as long as the voice.

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const onePole = (fc, sr) => 1 - Math.exp(-2 * Math.PI * fc / sr);

function pink(L, rand) {
  const y = new Float32Array(L);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < L; i++) {
    const w = rand() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    y[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return y;
}
function lowpass(x, fc, sr) { const a = onePole(fc, sr); let s = 0; for (let i = 0; i < x.length; i++) { s += a * (x[i] - s); x[i] = s; } return x; }
function highpass(x, fc, sr) { const a = onePole(fc, sr); let s = 0; for (let i = 0; i < x.length; i++) { s += a * (x[i] - s); x[i] -= s; } return x; }
function normalise(x) {
  let e = 0; for (let i = 0; i < x.length; i++) e += x[i] * x[i];
  const k = 1 / Math.sqrt(e / x.length + 1e-12);
  for (let i = 0; i < x.length; i++) x[i] *= k;
  return x;
}

function cafe(voice, sr, rand) {
  const L = voice.length, y = new Float32Array(L);
  // six people at other tables
  for (let p = 0; p < 6; p++) {
    const rate = 0.8 + rand() * 0.45, back = p % 3 !== 2, off = rand() * L, gain = 0.6 + rand() * 0.6;
    for (let i = 0; i < L; i++) {
      let pos = (off + i * rate) % (L - 1);
      if (back) pos = L - 2 - pos;
      const j = Math.max(0, Math.floor(pos)), f = Math.max(0, pos - j);
      y[i] += gain * (voice[j] + (voice[j + 1] - voice[j]) * f);
    }
  }
  lowpass(y, 3200, sr);
  // a little room, so they sound across the room rather than in your ear
  const room = new Float32Array(L);
  for (const ms of [23.1, 31.7, 41.3, 47.9]) {
    const d = Math.round(ms * sr / 1000), buf = new Float32Array(L);
    for (let i = 0; i < L; i++) { buf[i] = y[i] + (i >= d ? buf[i - d] * 0.62 : 0); room[i] += buf[i] * 0.25; }
  }
  for (let i = 0; i < L; i++) y[i] = y[i] * 0.45 + room[i];
  // cups and spoons
  const clinks = Math.round((L / sr) * 0.7);
  for (let c = 0; c < clinks; c++) {
    const at = Math.floor(rand() * L), f0 = 2400 + rand() * 2600, amp = 0.6 + rand() * 1.2, tau = (0.05 + rand() * 0.08) * sr;
    for (let i = 0; i < 0.4 * sr && at + i < L; i++) {
      const t = i / sr, env = Math.exp(-i / tau) * Math.min(1, i / 24);
      y[at + i] += amp * env * (Math.sin(2 * Math.PI * f0 * t) + 0.5 * Math.sin(2 * Math.PI * f0 * 2.76 * t) + 0.25 * Math.sin(2 * Math.PI * f0 * 5.4 * t));
    }
  }
  const hum = lowpass(pink(L, rand), 500, sr);
  normalise(hum);
  normalise(y);
  for (let i = 0; i < L; i++) y[i] += hum[i] * 0.35;
  return normalise(y);
}

function fan(L, sr, rand) {
  const air = lowpass(lowpass(pink(L, rand), 1400, sr), 2200, sr);
  normalise(air);
  const blade = 17.5, y = new Float32Array(L);
  let drift = 0;
  for (let i = 0; i < L; i++) {
    const t = i / sr;
    drift += (rand() - 0.5) * 0.0004; drift *= 0.9999;
    const am = 1 + 0.18 * Math.sin(2 * Math.PI * blade * t + drift * 40);
    const motor = 0.18 * Math.sin(2 * Math.PI * 120 * t) + 0.1 * Math.sin(2 * Math.PI * 240 * t + 0.4) + 0.05 * Math.sin(2 * Math.PI * 360 * t + 1.1);
    y[i] = air[i] * am + motor;
  }
  return normalise(y);
}

function rain(L, sr, rand) {
  const hiss = highpass(pink(L, rand), 900, sr);
  normalise(hiss);
  const y = new Float32Array(L);
  let level = 0.8;
  for (let i = 0; i < L; i++) {
    if (i % 480 === 0) level = Math.min(1, Math.max(0.6, level + (rand() - 0.5) * 0.06));
    y[i] = hiss[i] * 0.55 * level;
  }
  // drops: short bright ticks, and now and then a bigger one
  const drops = Math.round((L / sr) * 160);
  for (let d = 0; d < drops; d++) {
    const at = Math.floor(rand() * L), big = rand() < 0.08;
    const amp = (big ? 2.5 : 0.6) * -Math.log(1 - rand() * 0.98), tau = (big ? 0.012 : 0.0025 + rand() * 0.004) * sr;
    const f0 = 1500 + rand() * 3500;
    let lp = 0;
    for (let i = 0; i < 8 * tau && at + i < L; i++) {
      const env = Math.exp(-i / tau);
      const n = rand() * 2 - 1;
      lp += 0.5 * (n - lp);
      y[at + i] += amp * env * (big ? Math.sin(2 * Math.PI * f0 * i / sr) * 0.7 + (n - lp) * 0.3 : (n - lp));
    }
  }
  const rumble = lowpass(lowpass(pink(L, rand), 180, sr), 180, sr);
  normalise(rumble);
  for (let i = 0; i < L; i++) y[i] += rumble[i] * 0.25;
  return normalise(y);
}

export const KINDS = ['cafe', 'fan', 'rain'];
export function makeNoise(kind, voice, sr) {
  const rand = rng(kind === 'cafe' ? 11 : kind === 'fan' ? 23 : 37);
  if (kind === 'fan') return fan(voice.length, sr, rand);
  if (kind === 'rain') return rain(voice.length, sr, rand);
  return cafe(voice, sr, rand);
}

export function rms(x) { let e = 0; for (let i = 0; i < x.length; i++) e += x[i] * x[i]; return Math.sqrt(e / x.length); }
