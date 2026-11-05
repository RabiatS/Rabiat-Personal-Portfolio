// Circuits Lab solver.
// Modified nodal analysis (MNA): one unknown per circuit node plus one per ideal voltage source.
// Capacitors and inductors use backward Euler companion models, diodes and LEDs use the Shockley
// equation solved with Newton iterations (with SPICE style junction voltage limiting).
// Pure module with no DOM use, so it can be tested in node.
//
// A part is a plain object: { id, type, pts: [[x, y], [x, y]], ...props }.
// pts are grid points. Two terminal parts conduct from pts[0] to pts[1].
// The battery's pts[0] is its negative terminal and pts[1] its positive terminal.
// The LED and diode conduct forward from pts[0] (anode) to pts[1] (cathode).
// The two way switch (spdt) has pts[0] common, pts[1] and pts[2] the two throws, pos picks 0 or 1.
//
// After step() every part has: va, vb (terminal voltages), v = va - vb, i (current from pts[0]
// to pts[1] through the part, for a battery that is from minus to plus inside, so positive when it
// is pushing current out of its plus end), p (power taken by the part, negative for a source).

export const VT = 0.025852;      // thermal voltage at about 27 C
export const WIRE_R = 1e-4;      // wires, closed switches, ammeters: almost ideal
export const VOLTMETER_R = 1e7;  // a typical digital meter input is around 10 Mohm
const GMIN = 1e-12;

export const LED_COLORS = {
  red: { vf: 2.0, rgb: '#ff5a4f', label: 'Red' },
  yellow: { vf: 2.1, rgb: '#ffd447', label: 'Yellow' },
  blue: { vf: 3.1, rgb: '#4f9dff', label: 'Blue' },
  white: { vf: 3.1, rgb: '#f2f4ff', label: 'White' },
};

export const DEFAULTS = {
  wire: {},
  battery: { V: 6, r: 0.1 },
  resistor: { R: 100 },
  bulb: { R: 12, rated: 3 },
  switch: { closed: true },
  spdt: { pos: 0 },
  led: { color: 'red', imax: 0.03 },
  diode: {},
  fuse: { rating: 2, R: 0.02 },
  ammeter: {},
  voltmeter: {},
  capacitor: { C: 1e-3 },
  inductor: { L: 1 },
  ldr: { light: 0.5 },
};

export const NAMES = {
  wire: 'Wire', battery: 'Battery', resistor: 'Resistor', bulb: 'Bulb', switch: 'Switch', spdt: 'Two way switch',
  led: 'LED', diode: 'Diode', fuse: 'Fuse', ammeter: 'Ammeter', voltmeter: 'Voltmeter', capacitor: 'Capacitor',
  inductor: 'Inductor', ldr: 'Light sensor (LDR)',
};

// LDR: about 100 kohm in the dark down to about 1 kohm in bright light (a log scale in between).
export const ldrR = (light) => 1e5 * Math.pow(0.01, Math.max(0, Math.min(1, light)));

export function diodeParams(p) {
  if (p.type === 'led') {
    const vf = p.vf != null ? p.vf : (LED_COLORS[p.color] || LED_COLORS.red).vf;
    const n = 2; const iref = 0.02;
    return { n, Is: iref / (Math.exp(vf / (n * VT)) - 1), vf };
  }
  const vf = p.vf != null ? p.vf : 0.7; const n = 1.8; const iref = 0.01;
  return { n, Is: iref / (Math.exp(vf / (n * VT)) - 1), vf };
}

const EXP_MAX = 80;
function dexp(x) { // exp with a linear tail so huge forward voltages never overflow
  if (x > EXP_MAX) { const e = Math.exp(EXP_MAX); return [e * (1 + x - EXP_MAX), e]; }
  const e = Math.exp(x); return [e, e];
}
export function diodeI(p, v) {
  const { n, Is } = diodeParams(p); const nvt = n * VT;
  return Is * (dexp(v / nvt)[0] - 1);
}
function pnjlim(vnew, vold, vt, vcrit) {
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = 1 + (vnew - vold) / vt;
      return arg > 0 ? vold + vt * Math.log(arg) : vcrit;
    }
    return vt * Math.log(vnew / vt);
  }
  return vnew;
}

export const key = (pt) => `${pt[0]},${pt[1]}`;

// Does this part conduct right now (for building connected groups)?
function isOpen(p) {
  return (p.type === 'switch' && !p.closed) || (p.type === 'fuse' && p.blown) || ((p.type === 'led' || p.type === 'diode') && p.burnt);
}

// Linear solve with partial pivoting. A is n*n row major, b length n. Returns x or null.
export function gauss(A, b, n) {
  for (let c = 0; c < n; c++) {
    let piv = c; let best = Math.abs(A[c * n + c]);
    for (let r = c + 1; r < n; r++) { const v = Math.abs(A[r * n + c]); if (v > best) { best = v; piv = r; } }
    if (best < 1e-30) return null;
    if (piv !== c) {
      for (let k = c; k < n; k++) { const t = A[c * n + k]; A[c * n + k] = A[piv * n + k]; A[piv * n + k] = t; }
      const t = b[c]; b[c] = b[piv]; b[piv] = t;
    }
    const d = A[c * n + c];
    for (let r = c + 1; r < n; r++) {
      const f = A[r * n + c] / d; if (f === 0) continue;
      for (let k = c; k < n; k++) A[r * n + k] -= f * A[c * n + k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r * n + k] * x[k];
    x[r] = s / A[r * n + r];
  }
  return x;
}

// Resistance of the simple linear parts.
export function partR(p) {
  switch (p.type) {
    case 'resistor': return Math.max(1e-6, p.R);
    case 'bulb': return Math.max(1e-6, p.R);
    case 'ldr': return ldrR(p.light);
    case 'fuse': return Math.max(WIRE_R, p.R != null ? p.R : 0.02);
    case 'voltmeter': return VOLTMETER_R;
    default: return WIRE_R; // wire, ammeter, closed switch
  }
}

// Build the node map and group the nodes into connected pieces, each with its own ground.
function topology(parts) {
  const nodes = new Map(); // key -> {key, parent}
  const add = (pt) => { const k = key(pt); if (!nodes.has(k)) nodes.set(k, { k, up: k }); return k; };
  const find = (k) => { while (nodes.get(k).up !== k) k = nodes.get(k).up; return k; };
  const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) nodes.get(ra).up = rb; };
  for (const p of parts) for (const pt of p.pts) add(pt);
  for (const p of parts) {
    if (p.type === 'spdt') { union(key(p.pts[0]), key(p.pts[1 + (p.pos ? 1 : 0)])); continue; }
    if (isOpen(p)) continue;
    union(key(p.pts[0]), key(p.pts[1]));
  }
  // ground per group: the minus end of the first battery in it, else the first node seen
  const ground = new Map(); // root -> key
  for (const p of parts) if (p.type === 'battery') { const r = find(key(p.pts[0])); if (!ground.has(r)) ground.set(r, key(p.pts[0])); }
  for (const k of nodes.keys()) { const r = find(k); if (!ground.has(r)) ground.set(r, k); }
  const gset = new Set(ground.values());
  const index = new Map(); let n = 0;
  for (const k of nodes.keys()) index.set(k, gset.has(k) ? -1 : n++);
  return { index, n };
}

// Advance the circuit by h seconds. Mutates parts (state and readings). Returns { ok, V: Map key -> volts, events }.
export function step(parts, h) {
  const { index, n: nNodes } = topology(parts);
  const idx = (pt) => index.get(key(pt));
  // extra unknowns: an internal node per battery with internal resistance, and one current per battery
  let n = nNodes;
  const bats = parts.filter((p) => p.type === 'battery');
  const bInfo = new Map();
  for (const p of bats) { const m = p.r > 0 ? n++ : null; bInfo.set(p, { m }); }
  for (const p of bats) bInfo.get(p).k = n++;
  const diodes = parts.filter((p) => (p.type === 'led' || p.type === 'diode') && !p.burnt);
  for (const p of diodes) if (p.vd == null || !isFinite(p.vd)) p.vd = 0;

  let x = null;
  const A = new Float64Array(n * n); const b = new Float64Array(n);
  const G = (a, c, g) => {
    if (a >= 0) A[a * n + a] += g;
    if (c >= 0) A[c * n + c] += g;
    if (a >= 0 && c >= 0) { A[a * n + c] -= g; A[c * n + a] -= g; }
  };
  const I = (a, c, i) => { if (a >= 0) b[a] -= i; if (c >= 0) b[c] += i; };

  for (let it = 0; it < 100; it++) {
    A.fill(0); b.fill(0);
    for (let k = 0; k < nNodes; k++) A[k * n + k] += GMIN;
    for (const p of parts) {
      const a = idx(p.pts[0]); const c = idx(p.pts[1]);
      switch (p.type) {
        case 'wire': case 'ammeter': case 'resistor': case 'bulb': case 'ldr': case 'voltmeter':
          G(a, c, 1 / partR(p)); break;
        case 'switch': if (p.closed) G(a, c, 1 / WIRE_R); break;
        case 'fuse': if (!p.blown) G(a, c, 1 / partR(p)); break;
        case 'spdt': G(a, idx(p.pts[1 + (p.pos ? 1 : 0)]), 1 / WIRE_R); break;
        case 'capacitor': { const g = p.C / h; G(a, c, g); I(a, c, -g * (p.vc || 0)); break; }
        case 'inductor': { const g = h / p.L; G(a, c, g); I(a, c, p.il || 0); break; }
        case 'battery': {
          const { m, k } = bInfo.get(p);
          const plus = m == null ? c : m;
          if (plus >= 0) { A[plus * n + k] += 1; A[k * n + plus] += 1; }
          if (a >= 0) { A[a * n + k] -= 1; A[k * n + a] -= 1; }
          b[k] += p.V;
          if (m != null) G(m, c, 1 / p.r);
          break;
        }
        case 'led': case 'diode': {
          if (p.burnt) break;
          const { n: nn, Is } = diodeParams(p); const nvt = nn * VT;
          const [e, de] = dexp(p.vd / nvt);
          const id = Is * (e - 1); const gd = Is * de / nvt + GMIN;
          G(a, c, gd); I(a, c, id - gd * p.vd);
          break;
        }
        default: break;
      }
    }
    x = gauss(A, b, n);
    if (!x) break;
    if (!diodes.length) break;
    let conv = true;
    for (const p of diodes) {
      const a = idx(p.pts[0]); const c = idx(p.pts[1]);
      const vnew = (a >= 0 ? x[a] : 0) - (c >= 0 ? x[c] : 0);
      const { n: nn, Is } = diodeParams(p); const nvt = nn * VT;
      const vcrit = nvt * Math.log(nvt / (Math.SQRT2 * Is));
      const vl = pnjlim(vnew, p.vd, nvt, vcrit);
      if (Math.abs(vnew - p.vd) > 1e-7 + 1e-6 * Math.abs(vnew)) conv = false;
      p.vd = vl;
    }
    if (conv) break;
  }
  const V = new Map();
  if (!x || !x.every(Number.isFinite)) {
    // reset reactive state so a bad step cannot poison the next one
    for (const p of parts) { if (p.type === 'capacitor') p.vc = 0; if (p.type === 'inductor') p.il = 0; }
    return { ok: false, V, events: [] };
  }
  for (const [k, i] of index) V.set(k, i >= 0 ? x[i] : 0);
  const vOf = (pt) => V.get(key(pt)) || 0;
  const events = [];
  for (const p of parts) {
    p.va = vOf(p.pts[0]); p.vb = vOf(p.pts[1]); p.v = p.va - p.vb;
    let i = 0;
    switch (p.type) {
      case 'wire': case 'ammeter': case 'resistor': case 'bulb': case 'ldr': case 'voltmeter': i = p.v / partR(p); break;
      case 'switch': i = p.closed ? p.v / WIRE_R : 0; break;
      case 'fuse': i = p.blown ? 0 : p.v / partR(p); break;
      case 'spdt': { const t = p.pts[1 + (p.pos ? 1 : 0)]; p.vb = vOf(t); p.v = p.va - p.vb; i = p.v / WIRE_R; break; }
      case 'capacitor': { const g = p.C / h; i = g * (p.v - (p.vc || 0)); p.vc = p.v; break; }
      case 'inductor': { i = (p.il || 0) + (h / p.L) * p.v; p.il = i; break; }
      case 'battery': i = -x[bInfo.get(p).k]; break;
      case 'led': case 'diode': i = p.burnt ? 0 : diodeI(p, p.v); break;
      default: break;
    }
    p.i = i;
    p.p = p.type === 'battery' ? -(p.V * i - i * i * p.r) : p.v * i; // battery: minus the power it delivers to the circuit
    if (p.type === 'fuse' && !p.blown) {
      const rate = p.rating || 1; const over = (i / rate) ** 2 - 1;
      p.heat = Math.max(0, (p.heat || 0) + (over > 0 ? over : -0.5) * h);
      if (p.heat > 0.25) { p.blown = true; p.heat = 0; events.push({ type: 'blow', id: p.id }); }
    }
    if (p.type === 'led' && !p.burnt) {
      const over = (i / (p.imax || 0.03)) ** 2 - 1;
      p.heat = Math.max(0, (p.heat || 0) + (over > 0 ? over : -0.5) * h);
      if (p.heat > 0.3) { p.burnt = true; p.heat = 0; p.vd = 0; events.push({ type: 'burn', id: p.id }); }
    }
  }
  return { ok: true, V, events };
}

// Format a number with an SI prefix, for example fmt(0.0123, 'A') -> '12.3 mA'.
export function fmt(v, unit = '', digits = 3) {
  if (!isFinite(v)) return `-- ${unit}`;
  const a = Math.abs(v);
  if (a < 5e-10) return `0 ${unit}`.trim(); // leakage below a nanoamp reads as zero
  const pre = [[1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n']];
  let [s, p] = pre[pre.length - 1];
  for (const [ss, pp] of pre) if (a >= ss * 0.9995) { s = ss; p = pp; break; }
  const x = v / s;
  const d = Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? Math.max(0, digits - 2) : Math.max(0, digits - 1);
  return `${x.toFixed(d)} ${p}${unit}`.trim();
}
