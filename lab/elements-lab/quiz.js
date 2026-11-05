// Facts, question generators and flashcards for Elements Lab. No DOM here, so tools can test every answer.
import { ELEMENTS } from './data.js';

export const BY_Z = Object.fromEntries(ELEMENTS.map((e) => [e.z, e]));
export const BY_SYM = Object.fromEntries(ELEMENTS.map((e) => [e.s, e]));
export const L = 'spdf';
export const CAP = { s: 2, p: 6, d: 10, f: 14 };
export const SUPER = (n) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);

// Madelung filling order, which is what the Aufbau principle teaches.
export const FILL = (() => {
  const o = [];
  for (let n = 1; n <= 7; n++) for (let l = 0; l < n && l < 4; l++) o.push([n + l, n, l]);
  o.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return o.map(([, n, l]) => `${n}${L[l]}`);
})();

export function aufbau(count) {
  const out = [];
  let left = count;
  for (const sub of FILL) {
    if (left <= 0) break;
    const c = Math.min(left, CAP[sub[1]]);
    out.push([sub, c]);
    left -= c;
  }
  return out;
}
export const cfgText = (parts) => parts.map(([sub, c]) => `${sub}${SUPER(c)}`).join(' ');
export const realCfg = (e) => e.cfg.map(([n, l, c]) => [`${n}${L[l]}`, c]);
export const isRegular = (e) => cfgText(aufbau(e.z)) === cfgText(realCfg(e));

// Group of a main-group element, or null for transition and inner transition metals.
export const isMain = (e) => e.g != null && (e.g <= 2 || e.g >= 13);
export function valence(e) {
  if (!isMain(e)) return null;
  if (e.z === 2) return 2;
  return e.g <= 2 ? e.g : e.g - 10;
}
export function shells(e) {
  const out = {};
  for (const [n, , c] of e.cfg) out[n] = (out[n] || 0) + c;
  return out;
}
export const major = (e) => (e.iso.length ? e.iso.reduce((a, b) => (b[1] > a[1] ? b : a)) : null);
// The mass number to use for "this atom": real most abundant isotope, or the rounded mass if none is natural.
export const massNumber = (e) => (major(e) ? major(e)[0] : Math.round(e.m));
export const fmtMass = (e) => (e.iso.length ? e.m.toFixed(2) : `[${Math.round(e.m)}]`);
export const typeName = { metal: 'Metal', nonmetal: 'Nonmetal', metalloid: 'Metalloid' };

// Rounding the atomic mass only predicts the top isotope when the two agree, so only ask where they do.
export const ROUNDS_TRUE = ELEMENTS.filter((e) => major(e) && Math.round(e.m) === major(e)[0] && e.iso.length > 1);

// ---------- Helpers ----------
export const shuffle = (a) => {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const near = (x, a = 1, b = 3) => { const s = new Set(); for (let d = a; d <= b + 4; d++) { for (const v of [x + d, x - d]) if (v > 0 && s.size < 3) s.add(v); } return [...s]; };
const opts = (answer, wrong) => shuffle([answer, ...wrong.filter((w) => w !== answer)]).map(String);
const numOpts = (ans) => opts(ans, shuffle(near(ans)).slice(0, 3));

export const RANGES = { 'H to Ar': 18, 'H to Kr': 36, 'H to Xe': 54, 'All': 118 };
export const pool = (max) => ELEMENTS.filter((e) => e.z <= max);
const mainPool = (max) => pool(max).filter(isMain);
const samePairs = (list, ok) => {
  const out = [];
  for (const a of list) for (const b of list) if (a.z < b.z && ok(a, b)) out.push([a, b]);
  return out;
};

// Pairs that are in one period or one group, in the main block, and where real data matches the trend the course teaches.
const trendable = (e) => isMain(e) && e.g !== 18 && e.r && e.r2;
export function sizePairs(max) {
  return samePairs(pool(max).filter(trendable), (a, b) => {
    if (a.p === b.p) return a.g !== b.g && (a.g < b.g ? a.r > b.r && a.r2 > b.r2 : b.r > a.r && b.r2 > a.r2);
    if (a.g === b.g) return b.r > a.r && b.r2 > a.r2; // a has the lower z, so it sits higher in the group
    return false;
  });
}
export function enPairs(max) {
  return samePairs(pool(max).filter((e) => trendable(e) && e.en), (a, b) => {
    if (a.p === b.p) return a.g !== b.g && (a.g < b.g ? a.en < b.en : b.en < a.en);
    if (a.g === b.g) return a.en > b.en;
    return false;
  });
}

// ---------- Objectives from the study guide ----------
export const OBJECTIVES = [
  { key: 'particles', label: 'Compare the subatomic particles', subs: [] },
  { key: 'metals', label: 'Compare metals and nonmetals', subs: [] },
  { key: 'table', label: 'Read an element from the table', subs: [['number', 'Atomic number'], ['mass', 'Atomic mass'], ['protons', 'Number of protons'], ['isotope', 'Most abundant isotope'], ['size', 'Relative size'], ['en', 'Relative electronegativity']] },
  { key: 'electrons', label: 'Read its electrons from the table', subs: [['neutral', 'Electrons in a neutral atom'], ['valence', 'Valence electrons'], ['config', 'Electron configuration']] },
  { key: 'lewis', label: 'Draw Lewis dot structures', subs: [] },
];

// ---------- Fixed banks ----------
const PARTICLE_BANK = [
  ['What is the charge of a proton?', '+1', ['0', '−1', '+2'], 'Protons are positive, +1.'],
  ['What is the charge of a neutron?', '0', ['+1', '−1', '+2'], 'Neutrons are neutral.'],
  ['What is the charge of an electron?', '−1', ['+1', '0', '−2'], 'Electrons are negative, −1.'],
  ['Where are protons found?', 'Nucleus', ['Electron cloud', 'Outer shell', 'Between shells'], 'Protons and neutrons sit in the nucleus.'],
  ['Where are neutrons found?', 'Nucleus', ['Electron cloud', 'Outer shell', 'Between shells'], 'Protons and neutrons sit in the nucleus.'],
  ['Where are electrons found?', 'Electron cloud', ['Nucleus', 'Inside protons', 'Next to neutrons'], 'Electrons move around the nucleus in the electron cloud.'],
  ['Which particle has almost no mass?', 'Electron', ['Proton', 'Neutron', 'They are all equal'], 'An electron is about 1/1836 of a proton, so it barely counts toward mass.'],
  ['Which two particles each have a mass of about 1 amu?', 'Proton and neutron', ['Proton and electron', 'Neutron and electron', 'All three'], 'Protons and neutrons are about 1 amu each. That is why mass number only counts those two.'],
  ['Which particle decides what element an atom is?', 'Proton', ['Neutron', 'Electron', 'Whichever is most common'], 'Change the proton count and you have a different element.'],
  ['Isotopes of an element differ in their number of what?', 'Neutrons', ['Protons', 'Electrons', 'Shells'], 'Same protons, different neutrons.'],
  ['How are a proton and a neutron alike?', 'Same place, similar mass', ['Same charge', 'Same mass as an electron', 'Both orbit the nucleus'], 'Both sit in the nucleus at about 1 amu. Only their charge differs.'],
  ['How are a proton and an electron alike?', 'Equal size of charge', ['Same mass', 'Same location', 'Both neutral'], 'They carry the same size of charge with opposite signs, +1 and −1.'],
  ['In a neutral atom, which two counts are equal?', 'Protons and electrons', ['Protons and neutrons', 'Neutrons and electrons', 'All three, always'], 'Neutral means the charges cancel, so protons equal electrons.'],
  ['What are the two main regions of an atom?', 'Nucleus and electron cloud', ['Protons and neutrons', 'Shells and subshells', 'Core and crust'], 'The nucleus holds protons and neutrons. The electron cloud holds the electrons.'],
];

const METAL_BANK = [
  ['Shiny, bends without breaking, conducts electricity. Which type?', 'Metal', 'Those are the classic metal properties: lustrous, malleable, conductive.'],
  ['Dull, brittle as a solid, conducts poorly. Which type?', 'Nonmetal', 'Those are nonmetal properties.'],
  ['Which type tends to lose electrons in reactions?', 'Metal', 'Metals hold few valence electrons and give them up to form positive ions.'],
  ['Which type tends to gain electrons in reactions?', 'Nonmetal', 'Nonmetals are close to a full outer shell, so they tend to gain electrons.'],
  ['Which type sits on the left and center of the table?', 'Metal', 'Metals take up the left and center. Nonmetals are on the upper right.'],
  ['Which type sits on the upper right of the table?', 'Nonmetal', 'Nonmetals are on the upper right, with hydrogen as the odd one out at top left.'],
  ['Which type has properties between the other two, and hugs the staircase line?', 'Metalloid', 'Metalloids like silicon sit on the staircase and behave partly like each.'],
  ['Which type can be pulled into wires?', 'Metal', 'Metals are ductile.'],
  ['Which type has higher electronegativity in general?', 'Nonmetal', 'Nonmetals pull on shared electrons much harder than metals.'],
];

const ELECTRON_BANK = [
  ['How many electrons can an s subshell hold?', '2', ['1', '6', '10'], 's holds 2.'],
  ['How many electrons can a p subshell hold?', '6', ['2', '8', '10'], 'p holds 6.'],
  ['How many electrons can a d subshell hold?', '10', ['6', '8', '14'], 'd holds 10.'],
  ['How many electrons can an f subshell hold?', '14', ['6', '10', '18'], 'f holds 14.'],
  ['Which subshell fills right after 3p?', '4s', ['3d', '4p', '3s'], 'The order is 1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p. 4s comes before 3d.'],
  ['Which subshell fills right after 4s?', '3d', ['4p', '3p', '4d'], 'The order is 1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p.'],
  ['What does the Aufbau principle say?', 'Lower energy fills first', ['Higher energy fills first', 'Each shell holds 8', 'Electrons pair up first'], 'Electrons fill lower energy orbitals before higher energy ones.'],
  ['What are valence electrons?', 'Those in the outermost shell', ['All the electrons', 'Those in the nucleus', 'Those in the first shell'], 'Valence electrons are in the outermost occupied shell.'],
];

const chooseBank = (bank, obj, sub) => {
  const [prompt, answer, wrong, why] = pick(bank);
  return { obj, sub, kind: 'choice', prompt, options: opts(answer, wrong), answer, why };
};

// ---------- Generators ----------
export const gen = {
  particles() { return chooseBank(PARTICLE_BANK, 'particles'); },

  metals(max = 54) {
    if (Math.random() < 0.45) {
      const [prompt, answer, why] = pick(METAL_BANK);
      return { obj: 'metals', kind: 'choice', prompt, options: ['Metal', 'Nonmetal', 'Metalloid'], answer, why };
    }
    const e = pick(pool(max).filter((x) => x.z !== 84 && x.z !== 85));
    const answer = typeName[e.t];
    const trap = e.z === 1 ? ' Hydrogen is the trap: it sits on the left, but it is a nonmetal.' : '';
    const where = e.t === 'metalloid' ? 'on the staircase line' : e.t === 'metal' ? 'left of the staircase' : 'right of the staircase';
    return { obj: 'metals', z: e.z, kind: 'choice', prompt: `Is ${e.n} a metal, nonmetal or metalloid?`, options: ['Metal', 'Nonmetal', 'Metalloid'], answer, why: `${e.n} is ${where}, so it is a ${answer.toLowerCase()}.${trap}` };
  },

  number(max = 54) {
    const e = pick(pool(max));
    return { obj: 'table', sub: 'number', z: e.z, kind: 'number', prompt: `What is the atomic number of ${e.n}?`, fields: [{ label: 'Atomic number', answer: e.z }], why: `It is the whole number on the ${e.s} square: ${e.z}.` };
  },
  mass(max = 54) {
    const e = pick(pool(max).filter((x) => x.iso.length));
    return { obj: 'table', sub: 'mass', z: e.z, kind: 'number', prompt: `What is the atomic mass of ${e.n}? Use 2 decimals.`, fields: [{ label: 'amu', answer: +e.m.toFixed(2), tol: 0.06 }], why: `It is the decimal on the ${e.s} square: ${e.m.toFixed(2)} amu, the weighted average of its isotopes.` };
  },
  protons(max = 54) {
    const e = pick(pool(max));
    return { obj: 'table', sub: 'protons', z: e.z, kind: 'number', prompt: `How many protons does ${e.n} have?`, fields: [{ label: 'Protons', answer: e.z }], why: `Protons equal the atomic number: ${e.z}.` };
  },
  isotope(max = 54) {
    const e = pick(ROUNDS_TRUE.filter((x) => x.z <= max));
    const A = major(e)[0];
    const wrong = shuffle(near(A, 1, 2)).slice(0, 3);
    return { obj: 'table', sub: 'isotope', z: e.z, kind: 'choice', prompt: `The atomic mass of ${e.n} is ${e.m.toFixed(2)}. Which isotope is most abundant?`, options: opts(`${e.n}-${A}`, wrong.map((w) => `${e.n}-${w}`)), answer: `${e.n}-${A}`, why: `Round the atomic mass: ${e.m.toFixed(2)} rounds to ${A}. The average sits closest to the most common isotope.` };
  },
  size(max = 54) {
    const [a, b] = pick(sizePairs(max));
    const big = a.r > b.r ? a : b; const small = big === a ? b : a;
    const samePeriod = a.p === b.p;
    const why = samePeriod ? `${big.n} is further left in period ${a.p}. Going right adds protons in the same shell, which pulls the atom smaller.` : `${big.n} is lower in group ${a.g}. Going down adds a whole shell.`;
    return { obj: 'table', sub: 'size', kind: 'choice', compare: 'size', zOptions: [a.z, b.z], prompt: 'Which atom is larger?', options: [a.n, b.n], answer: big.n, small: small.n, why };
  },
  en(max = 54) {
    const [a, b] = pick(enPairs(max));
    const hi = a.en > b.en ? a : b;
    const why = a.p === b.p ? `${hi.n} is further right in period ${a.p}. More protons pull harder on shared electrons.` : `${hi.n} is higher in group ${a.g}. Its shared electrons sit closer to the nucleus.`;
    return { obj: 'table', sub: 'en', kind: 'choice', compare: 'en', zOptions: [a.z, b.z], prompt: 'Which has the higher electronegativity?', options: [a.n, b.n], answer: hi.n, why };
  },

  neutral(max = 54) {
    const e = pick(pool(max));
    return { obj: 'electrons', sub: 'neutral', z: e.z, kind: 'number', prompt: `How many electrons does a neutral atom of ${e.n} have?`, fields: [{ label: 'Electrons', answer: e.z }], why: `Neutral means electrons equal protons, and the atomic number gives ${e.z} protons.` };
  },
  valence(max = 54) {
    const e = pick(mainPool(max));
    const v = valence(e);
    const why = e.z === 2 ? 'Helium is the exception in group 18. Its only shell is full with 2.'
      : e.g <= 2 ? `${e.n} is in group ${e.g}, so it has ${v}.`
        : `${e.n} is in group ${e.g}. Drop the 1: ${v} valence electrons.`;
    return { obj: 'electrons', sub: 'valence', z: e.z, kind: 'choice', prompt: `How many valence electrons does ${e.n} have?`, options: ['1', '2', '3', '4', '5', '6', '7', '8'], grid: 4, answer: String(v), why };
  },
  config(max = 36) {
    const list = pool(Math.max(max, 10)).filter(isRegular);
    const e = pick(list);
    const answer = cfgText(aufbau(e.z));
    const mode = Math.random() < 0.5;
    const others = shuffle([e.z - 1, e.z + 1, e.z - 2, e.z + 2].filter((z) => z >= 1 && z <= 54)).slice(0, 3);
    if (mode) {
      return { obj: 'electrons', sub: 'config', z: e.z, kind: 'choice', mono: true, stack: true, prompt: `What is the electron configuration of ${e.n}?`, options: opts(answer, others.map((z) => cfgText(aufbau(z)))), answer, why: `${e.n} has ${e.z} electrons. Fill in order until they run out: ${answer}.` };
    }
    return { obj: 'electrons', sub: 'config', z: e.z, kind: 'choice', prompt: `Which element is ${answer}?`, mono: false, options: opts(e.n, others.map((z) => BY_Z[z].n)), answer: e.n, why: `Add the superscripts: ${e.z} electrons, so atomic number ${e.z}, which is ${e.n}.` };
  },
  electronFact() { return chooseBank(ELECTRON_BANK, 'electrons', 'config'); },
  build(max = 36) {
    const e = pick(pool(Math.max(max, 10)).filter(isRegular).filter((x) => x.z >= 3));
    return { obj: 'electrons', sub: 'config', z: e.z, kind: 'build', prompt: `Fill the subshells for ${e.n}`, answer: cfgText(aufbau(e.z)), why: `${e.z} electrons, in energy order: ${cfgText(aufbau(e.z))}.` };
  },

  lewis(max = 54) {
    const e = pick(mainPool(max));
    const v = valence(e);
    return { obj: 'lewis', z: e.z, kind: 'lewis', count: v, prompt: `Draw ${e.n}`, why: e.z === 2 ? 'Helium has 2 valence electrons, drawn as one pair.' : `${e.n} has ${v} valence electron${v === 1 ? '' : 's'}. One per side first, then pair up.` };
  },

  // ---------- Math ----------
  isotopeCount(max = 54) {
    const e = pick(pool(max).filter((x) => x.iso.length));
    const A = pick(e.iso)[0];
    const n = A - e.z;
    return { obj: 'table', sub: 'protons', z: e.z, massNum: A, kind: 'number', eyebrow: `Mass number ${A}`, prompt: `${e.n}-${A}, neutral atom`, fields: [{ label: 'Protons', answer: e.z }, { label: 'Neutrons', answer: n }, { label: 'Electrons', answer: e.z }], why: `Atomic number is ${e.z}, so ${e.z} protons. ${A} − ${e.z} = ${n} neutrons. Neutral, so ${e.z} electrons.` };
  },
  fromCounts(max = 54) {
    const e = pick(pool(max).filter((x) => x.iso.length));
    const A = pick(e.iso)[0];
    const n = A - e.z;
    return { obj: 'table', sub: 'protons', z: e.z, massNum: A, kind: 'number', prompt: `An atom has ${e.z} protons and ${n} neutrons.`, fields: [{ label: 'Mass number', answer: A }, { label: 'Element symbol', text: e.s }], why: `${e.z} + ${n} = ${A}. Atomic number ${e.z} is ${e.n}, ${e.s}.` };
  },
  fromMass(max = 54) {
    const e = pick(pool(max).filter((x) => x.iso.length));
    const A = pick(e.iso)[0];
    const n = A - e.z;
    return { obj: 'table', sub: 'protons', z: e.z, massNum: A, kind: 'number', prompt: `An atom has mass number ${A} and ${n} neutrons.`, fields: [{ label: 'Protons', answer: e.z }, { label: 'Element symbol', text: e.s }], why: `${A} − ${n} = ${e.z} protons, and atomic number ${e.z} is ${e.n}, ${e.s}.` };
  },
  fromElectrons(max = 54) {
    const e = pick(pool(max).filter((x) => x.iso.length));
    return { obj: 'electrons', sub: 'neutral', z: e.z, kind: 'number', prompt: `A neutral atom has ${e.z} electrons.`, fields: [{ label: 'Protons', answer: e.z }, { label: 'Element symbol', text: e.s }], why: `Neutral, so ${e.z} protons too. Atomic number ${e.z} is ${e.n}, ${e.s}.` };
  },
  weighted() {
    const e = pick(WEIGHTED.map((z) => BY_Z[z]));
    const iso = e.iso.filter((i) => i[1] >= 0.5);
    const raw = iso.reduce((s, i) => s + i[2] * (i[1] / 100), 0);
    const rows = iso.map((i) => `${i[2].toFixed(3)} × ${(i[1] / 100).toFixed(4).replace(/0+$/, '')}`).join(' + ');
    const lines = iso.map((i) => ({ label: `${e.s}-${i[0]}`, mass: i[2].toFixed(3), pct: `${i[1].toFixed(2)}%` }));
    return { obj: 'table', sub: 'mass', z: e.z, kind: 'number', weighted: lines, prompt: `Find the atomic mass of ${e.n}.`, fields: [{ label: 'amu', answer: +raw.toFixed(2), tol: 0.06 }], why: `Change each % to a decimal, multiply, then add: ${rows} = ${raw.toFixed(2)}.` };
  },
  moreAbundant() {
    const e = pick(TWO_ISO.map((z) => BY_Z[z]));
    const [a, b] = e.iso;
    const big = a[1] > b[1] ? a : b;
    return { obj: 'table', sub: 'isotope', z: e.z, kind: 'choice', prompt: `${e.n} has an atomic mass of ${e.m.toFixed(2)} and two isotopes. Which is more common?`, options: [`${e.n}-${a[0]}`, `${e.n}-${b[0]}`], answer: `${e.n}-${big[0]}`, why: `${e.m.toFixed(2)} is closer to ${big[0]}. The average leans toward the more common isotope.` };
  },
};

// Elements with a clean two or three isotope split, good for weighted average practice.
const WEIGHTED = [5, 12, 17, 29, 31, 35, 37, 47];
// Two isotopes, clearly not 50/50, and the mass sits nearer the commoner one.
const TWO_ISO = [3, 5, 7, 17, 23, 29, 31, 37, 51].filter((z) => BY_Z[z].iso.length === 2);

// Questions a tab draws from.
export const TAB_GENS = {
  math: [['isotopeCount', 4], ['fromCounts', 2], ['fromMass', 2], ['fromElectrons', 1], ['weighted', 2], ['moreAbundant', 1], ['isotope', 1]],
  electrons: [['build', 4], ['valence', 3], ['config', 2], ['electronFact', 1], ['neutral', 1]],
  lewis: [['lewis', 1]],
  trends: [['size', 1], ['en', 1]],
  concepts: [['particles', 1], ['metals', 1]],
};
export function drawFrom(tab, max) {
  const list = TAB_GENS[tab];
  const total = list.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [name, w] of list) { r -= w; if (r <= 0) return gen[name](max); }
  return gen[list[0][0]](max);
}

// ---------- Tap the table ----------
export function findQ(max = 36) {
  const elems = pool(max);
  const kinds = ['name', 'name', 'name', 'name', 'z', 'pos', 'pos', 'valence', 'type', 'extreme'];
  const kind = pick(kinds);
  const e = pick(elems);
  if (kind === 'z') return { obj: 'table', sub: 'number', z: e.z, kind: 'table', prompt: `Atomic number ${e.z}`, accept: [e.z], why: `${e.n} is number ${e.z}.` };
  if (kind === 'pos' && e.g) return { obj: 'table', sub: 'number', z: e.z, kind: 'table', prompt: `Period ${e.p}, group ${e.g}`, accept: [e.z], why: `Period is the row, group is the column. That is ${e.n}.` };
  if (kind === 'valence') {
    const m = pick(elems.filter((x) => isMain(x) && x.z !== 2));
    const v = valence(m);
    const acc = elems.filter((x) => isMain(x) && valence(x) === v && x.p === m.p).map((x) => x.z);
    return { obj: 'electrons', sub: 'valence', z: m.z, kind: 'table', prompt: `${v} valence electron${v === 1 ? '' : 's'}, period ${m.p}`, accept: acc, why: `${m.n} is in group ${m.g}, so it has ${v}.` };
  }
  if (kind === 'type') {
    const t = pick(['metalloid', 'nonmetal', 'metal']);
    const acc = elems.filter((x) => x.t === t && x.z !== 84 && x.z !== 85).map((x) => x.z);
    if (acc.length) return { obj: 'metals', kind: 'table', prompt: `Any ${t}`, accept: acc, why: t === 'metalloid' ? 'Metalloids hug the staircase line, like B, Si and Ge.' : t === 'nonmetal' ? 'Nonmetals are on the upper right, plus hydrogen.' : 'Metals fill the left and center.' };
  }
  if (kind === 'extreme') {
    const m = pick(elems.filter((x) => isMain(x) && x.g !== 18 && x.en));
    const opt = pick(['biggest', 'en']);
    if (opt === 'biggest') {
      const row = elems.filter((x) => x.p === m.p && isMain(x) && x.g !== 18 && x.r);
      const top = row.reduce((a, b) => (b.r > a.r ? b : a));
      if (row.length > 1 && top.g === Math.min(...row.map((x) => x.g))) return { obj: 'table', sub: 'size', z: top.z, kind: 'table', prompt: `Largest atom in period ${m.p}`, accept: [top.z], why: `Size shrinks going right across a period, so it is the far left: ${top.n}.` };
    } else {
      const row = elems.filter((x) => x.p === m.p && isMain(x) && x.g !== 18 && x.en);
      const top = row.reduce((a, b) => (b.en > a.en ? b : a));
      if (row.length > 1 && top.g === Math.max(...row.map((x) => x.g))) return { obj: 'table', sub: 'en', z: top.z, kind: 'table', prompt: `Highest electronegativity in period ${m.p}`, accept: [top.z], why: `Electronegativity rises going right, leaving out noble gases, so ${top.n}.` };
    }
  }
  return { obj: 'table', sub: 'number', z: e.z, kind: 'table', prompt: e.n, accept: [e.z], why: `${e.n} is ${e.s}, number ${e.z}.` };
}

// ---------- Name it ----------
export function nameQ(max = 36) {
  const e = pick(pool(max));
  const neighbours = pool(Math.max(max, 18)).filter((x) => x.z !== e.z && Math.abs(x.z - e.z) <= 4);
  const wrong = shuffle(neighbours).slice(0, 3).map((x) => x.n);
  const n = shells(e);
  const counts = Object.values(n).join(', ');
  return { obj: 'electrons', sub: 'neutral', z: e.z, kind: 'name', hideLabels: true, prompt: 'Count the electrons. Which element?', e, bank: shuffle([e.n, ...wrong]), why: `Shells of ${counts} add up to ${e.z}, so it is ${e.n}, ${e.s}.` };
}

// ---------- Mock exam ----------
export function examSet(max = 36) {
  const plan = [
    ...Array(5).fill('particles'), ...Array(3).fill('metals'),
    'number', 'mass', 'protons', 'isotope', 'isotopeCount', 'isotopeCount', 'size', 'en', 'size',
    'neutral', 'valence', 'valence', 'config', 'build',
    'lewis', 'lewis', 'lewis',
  ];
  const seen = new Set();
  const out = [];
  for (const name of plan) {
    let q; let guard = 0;
    do { q = gen[name](max); guard++; } while (seen.has(q.prompt + (q.z || '') + (q.answer || '')) && guard < 12);
    seen.add(q.prompt + (q.z || '') + (q.answer || ''));
    out.push(q);
  }
  return shuffle(out);
}

// ---------- Lewis grading ----------
// sides is four counts, one for each side of the symbol.
export function gradeLewis(sides, e) {
  const v = valence(e);
  const total = sides.reduce((a, b) => a + b, 0);
  if (total !== v) return { ok: false, reason: `That is ${total} dot${total === 1 ? '' : 's'}. ${e.n} needs ${v}.` };
  const pairsEarly = sides.some((c) => c === 2) && sides.some((c) => c === 0);
  if (pairsEarly && !(e.z === 2 || e.g === 2)) return { ok: false, reason: `Right count. Now spread them: one on each side before you pair any.` };
  return { ok: true };
}

// ---------- Flashcards: the 38 from the module, then the guide items they did not cover ----------
export const PARTS = ['Atomic structure', 'Isotopes and mass', 'Periodic table', 'Trends', 'Configurations', 'Formulas', 'Guide extras'];
export const FLASHCARDS = [
  ['Atomic structure', 'What is an atom?', 'The smallest unit of an element that retains its chemical properties.'],
  ['Atomic structure', 'What are the two main regions of an atom?', 'Nucleus and electron cloud.'],
  ['Atomic structure', 'What are the three subatomic particles?', 'Protons, neutrons and electrons.'],
  ['Atomic structure', 'What is the charge of a proton?', 'Positive (+1).', { emph: 'proton' }],
  ['Atomic structure', 'What is the charge of a neutron?', 'Neutral (0).', { emph: 'neutron' }],
  ['Atomic structure', 'What is the charge of an electron?', 'Negative (−1).', { emph: 'electron' }],
  ['Atomic structure', 'Where are protons and neutrons located?', 'In the nucleus.', { emph: 'nucleus' }],
  ['Atomic structure', 'Where are electrons located?', 'In the electron cloud.', { cloud: true }],
  ['Atomic structure', 'Which particles have about 1 amu of mass?', 'Protons and neutrons.', { emph: 'nucleus' }],
  ['Atomic structure', 'What does atomic number represent?', 'The number of protons.', { emph: 'proton' }],
  ['Atomic structure', 'What is mass number?', 'The total number of protons and neutrons.', { emph: 'nucleus' }],
  ['Atomic structure', 'How do you calculate the number of neutrons?', 'Mass number − atomic number.', { emph: 'neutron' }],
  ['Atomic structure', 'How many electrons does a neutral atom have?', 'The same number as protons.', { emph: 'electron' }],
  ['Isotopes and mass', 'What are isotopes?', 'Atoms of the same element with different numbers of neutrons.', { emph: 'neutron' }],
  ['Isotopes and mass', 'What is atomic mass?', "The weighted average mass of an element's naturally occurring isotopes."],
  ['Isotopes and mass', 'How is atomic mass different from mass number?', 'Atomic mass is a weighted average. Mass number is protons + neutrons in one atom.'],
  ['Isotopes and mass', 'What determines the identity of an element?', 'The number of protons.', { emph: 'proton' }],
  ['Periodic table', 'Where are metals located on the periodic table?', 'Left side and center.', { color: 'type' }],
  ['Periodic table', 'Where are nonmetals located?', 'Right side. Hydrogen is the exception, at top left.', { color: 'type' }],
  ['Periodic table', 'What are valence electrons?', 'Electrons in the outermost occupied shell.', { emph: 'valence' }],
  ['Periodic table', 'How many valence electrons do Group 1 elements have?', '1', { color: 'valence', z: 11 }],
  ['Periodic table', 'How many valence electrons do Group 2 elements have?', '2', { color: 'valence', z: 12 }],
  ['Periodic table', 'How many valence electrons do Group 17 elements have?', '7', { color: 'valence', z: 17 }],
  ['Periodic table', 'How many valence electrons do Group 18 elements have?', '8, except helium, which has 2.', { color: 'valence', z: 18 }],
  ['Periodic table', 'What is a Lewis dot symbol?', 'An element symbol surrounded by dots representing valence electrons.', { lewis: 8 }],
  ['Trends', 'What happens to atomic radius from left to right across a period?', 'It decreases.', { color: 'size' }],
  ['Trends', 'What happens to atomic radius as you move down a group?', 'It increases.', { color: 'size' }],
  ['Trends', 'What is electronegativity?', "An atom's ability to attract shared electrons in a chemical bond.", { color: 'en' }],
  ['Trends', 'What happens to electronegativity from left to right?', 'It generally increases.', { color: 'en' }],
  ['Trends', 'What happens to electronegativity as you move down a group?', 'It generally decreases.', { color: 'en' }],
  ['Trends', 'Which element has the highest electronegativity?', 'Fluorine.', { color: 'en', z: 9 }],
  ['Configurations', 'What is an electron configuration?', "A representation of how electrons are arranged in an atom's orbitals.", { cloud: true }],
  ['Configurations', 'What is the Aufbau principle?', 'Electrons fill lower energy orbitals before higher energy orbitals.'],
  ['Configurations', 'How many electrons can an s subshell hold?', '2', { z: 4, sub: '2s' }],
  ['Configurations', 'How many electrons can a p subshell hold?', '6', { z: 10, sub: '2p' }],
  ['Configurations', 'How many electrons can a d subshell hold?', '10', { z: 30, sub: '3d' }],
  ['Configurations', 'How many electrons can an f subshell hold?', '14', { z: 70, sub: '4f' }],
  ['Configurations', 'What is the order of orbital filling?', '1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p.'],
  ['Formulas', 'Mass number = ?', 'Protons + neutrons', { emph: 'nucleus' }],
  ['Formulas', 'Number of neutrons = ?', 'Mass number − atomic number', { emph: 'neutron' }],
  ['Formulas', 'In a neutral atom, protons = ?', 'Electrons'],
  ['Formulas', 'Atomic mass from isotopes = ?', 'Add up (isotope mass × abundance as a decimal) for every isotope.'],
  ['Guide extras', 'How do you find the most abundant isotope from the table?', 'Round the atomic mass to a whole number. It works when one isotope dominates. Bromine (79.90) is a known miss: its isotopes are 79 and 81.'],
  ['Guide extras', 'Properties of metals?', 'Shiny, malleable, ductile, good conductors. They tend to lose electrons.', { color: 'type' }],
  ['Guide extras', 'Properties of nonmetals?', 'Dull, brittle as solids, poor conductors. They tend to gain electrons.', { color: 'type' }],
  ['Guide extras', 'What is a metalloid?', 'An element on the staircase line with properties of both, like silicon.', { color: 'type', z: 14 }],
  ['Guide extras', 'How do you draw a Lewis dot symbol?', 'Write the symbol. Count valence electrons from the group. One dot per side, then pair up.', { lewis: 7 }],
  ['Guide extras', 'Mass of an electron compared with a proton?', 'About 1/1836, so it is left out of mass number.', { emph: 'electron' }],
].map(([part, q, a, fx], i) => ({ id: i, part, q, a, fx: fx || {} }));
