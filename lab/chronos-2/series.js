// The sample series. Three are made up here, from a fixed seed, so they look
// the same on every visit; the fourth is NOAA's monthly CO2 record.
//   { key, name, unit, step: 'day'|'hour'|'month'|null, end|start, values, view, horizon }

const DAY = 864e5, HOUR = 36e5;

function rng(seed) { // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(r) { return Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); }
const dayOfYear = (d) => (d - new Date(d.getFullYear(), 0, 1)) / DAY;

// Daily steps: a walk most weekdays, a long one on Saturdays, lazier Sundays,
// more in summer, and the odd rest day.
function steps(today) {
  const r = rng(7), n = 400, values = [];
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const week = [-1600, 300, 600, 200, 500, 900, 2600]; // Sun..Sat
  let mood = 0;
  for (let i = 0; i < n; i++) {
    const d = new Date(end.getTime() - (n - 1 - i) * DAY);
    mood = mood * 0.8 + gauss(r) * 170;
    const summer = 1100 * Math.sin(((dayOfYear(d) - 80) / 365) * 2 * Math.PI);
    let v = 7400 + week[d.getDay()] + summer + mood + i * 1.5;
    v *= Math.exp(gauss(r) * 0.06);
    if (r() < 0.015) v = 3200 + r() * 1500;
    values.push(Math.max(400, Math.round(v)));
  }
  return { key: 'steps', name: 'Daily steps', unit: 'steps', step: 'day', end, values, view: 120, horizon: 30 };
}

// Cups sold at a small café: quiet Mondays, busy weekends, a slow climb as
// people find it, a summer lift and a December bump.
function cafe(today) {
  const r = rng(11), n = 420, values = [];
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const week = [1.22, 0.7, 0.78, 0.84, 0.9, 1.08, 1.42]; // Sun..Sat
  let drift = 0;
  for (let i = 0; i < n; i++) {
    const d = new Date(end.getTime() - (n - 1 - i) * DAY);
    drift = drift * 0.9 + gauss(r) * 0.025;
    const doy = dayOfYear(d);
    const season = 1 + 0.08 * Math.sin(((doy - 100) / 365) * 2 * Math.PI) + (d.getMonth() === 11 && d.getDate() > 8 && d.getDate() < 24 ? 0.18 : 0);
    const growth = 1 + 0.32 * (i / n);
    let v = 190 * week[d.getDay()] * season * growth * (1 + drift) * Math.exp(gauss(r) * 0.07);
    if (d.getMonth() === 11 && d.getDate() === 25) v = 0;
    values.push(Math.round(v));
  }
  return { key: 'cafe', name: 'Café cups sold', unit: 'cups', step: 'day', end, values, view: 120, horizon: 28 };
}

// A small city's electricity use, hourly: a night trough, a morning and an
// evening peak, quieter weekends, and the weather nudging whole days up or down.
function power(today) {
  const r = rng(23), n = 24 * 30, values = [];
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), today.getHours() - 1);
  const shape = (h, weekend) => {
    const g = (c, w) => Math.exp(-0.5 * ((h - c) / w) ** 2);
    return weekend
      ? 0.62 + 0.24 * g(11, 3.2) + 0.3 * g(19, 2.6)
      : 0.6 + 0.3 * g(8, 1.6) + 0.16 * g(13, 3) + 0.38 * g(19, 2.2);
  };
  let weather = 0, w = 0;
  for (let i = 0; i < n; i++) {
    const d = new Date(end.getTime() - (n - 1 - i) * HOUR);
    if (d.getHours() === 0 || i === 0) w = weather = weather * 0.6 + gauss(r) * 0.05;
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const v = 400 * shape(d.getHours() + d.getMinutes() / 60, weekend) * (1 + w) * (1 + gauss(r) * 0.018);
    values.push(Math.round(v * 10) / 10);
  }
  return { key: 'power', name: 'City electricity use', unit: 'MW', step: 'hour', end, values, view: 24 * 7, horizon: 48 };
}

export async function co2() {
  const d = await (await fetch(new URL('./samples/co2-mauna-loa.json', import.meta.url))).json();
  const [y, m] = d.start.split('-').map(Number);
  const end = new Date(y, m - 1 + d.values.length - 1, 1);
  return { key: 'co2', name: 'CO₂ at Mauna Loa', unit: 'ppm', step: 'month', end, values: d.values, view: 240, horizon: 60 };
}

export function made(today = new Date()) {
  return [steps(today), cafe(today), power(today)];
}

// x position (index from the series start) to a date, for labels and the readout.
export function dateAt(s, i) {
  if (!s.step) return null;
  const k = i - (s.values.length - 1); // 0 = last point
  if (s.step === 'day') return new Date(s.end.getFullYear(), s.end.getMonth(), s.end.getDate() + k);
  if (s.step === 'hour') return new Date(s.end.getTime() + k * HOUR);
  if (s.step === 'month') return new Date(s.end.getFullYear(), s.end.getMonth() + k, 1);
  return null;
}
