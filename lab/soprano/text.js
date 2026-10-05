// Text in, the plain lower-case text Soprano was trained on out, cut into
// sentences. A port of Soprano's own cleaner and splitter
// (soprano/utils/text_normalizer.py and text_splitter.py, Apache 2.0, both
// adapted from tortoise-tts), with two changes:
//  - the Python version folds accents with unidecode (a GPL package); this
//    uses the browser's own Unicode decomposition instead, so nothing GPL is
//    involved anywhere;
//  - sentences are found in the text as typed, so the page can light up the
//    words you wrote while they are spoken.
// Numbers are spelled out the way the Python `inflect` package does it.

// ---------- numbers ----------
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const GROUPS = ['', ' thousand', ' million', ' billion', ' trillion', ' quadrillion'];

const under100 = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''));
function under1000(n) {
  const h = Math.floor(n / 100), r = n % 100;
  return [h ? `${ONES[h]} hundred` : '', r ? under100(r) : ''].filter(Boolean).join(' ');
}
// "one million, two hundred thirty-four thousand, five hundred sixty-seven"
export function numberWords(digits) {
  digits = String(digits).replace(/^0+(?=\d)/, '');
  if (digits.length > 18) return [...digits].map((d) => ONES[+d]).join(' ');
  if (/^0+$/.test(digits)) return 'zero';
  const parts = [];
  for (let g = 0, end = digits.length; end > 0; g++, end -= 3) {
    const n = Number(digits.slice(Math.max(0, end - 3), end));
    if (n) parts.unshift(under1000(n) + GROUPS[g]);
  }
  return parts.join(', ');
}
// inflect's group=2 reading, for years: 1905 -> "nineteen oh five", 1999 -> "nineteen ninety-nine"
function pairWords(n) {
  const pair = (p) => (p >= 10 ? under100(p) : p ? `oh ${ONES[p]}` : 'oh oh');
  return `${pair(Math.floor(n / 100))} ${pair(n % 100)}`;
}
const ORDINAL = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
function ordinalWords(digits) {
  const w = numberWords(digits);
  return w.replace(/([a-z]+)$/, (last) => ORDINAL[last] || (last.endsWith('y') ? `${last.slice(0, -1)}ieth` : `${last}th`));
}
function expandNumber(s) {
  const n = Number(s);
  if (n > 1000 && n < 3000) {
    if (n === 2000) return 'two thousand';
    if (n > 2000 && n < 2010) return `two thousand ${numberWords(String(n % 100))}`;
    if (n % 100 === 0) return `${numberWords(String(n / 100))} hundred`;
    return pairWords(n);
  }
  return numberWords(s);
}

function expandTime(m) {
  const p = m.split(':');
  const oh = (x) => (x.startsWith('0') ? `oh ${x.slice(1)}` : x);
  if (p.length === 2) {
    const [h, min] = p;
    if (min === '00') return Number(h) === 0 ? '0' : Number(h) > 12 ? `${h} minutes` : `${h} o'clock`;
    return `${h} ${oh(min)}`;
  }
  const [h, min, sec] = p;
  const secs = sec === '00' ? '' : oh(sec);
  if (Number(h) !== 0) return `${h} ${min === '00' ? 'oh oh' : oh(min)} ${secs}`;
  if (min !== '00') return `${min} ${sec === '00' ? 'oh oh' : oh(sec)}`;
  return sec;
}
function expandDollars(m) {
  const parts = m.split('.');
  if (parts.length > 2) return `${m} dollars`;
  const d = parts[0] ? parseInt(parts[0].replace(/,/g, ''), 10) || 0 : 0;
  const c = parts.length > 1 && parts[1] ? parseInt(parts[1], 10) || 0 : 0;
  const du = d === 1 ? 'dollar' : 'dollars', cu = c === 1 ? 'cent' : 'cents';
  if (d && c) return `${d} ${du}, ${c} ${cu}`;
  if (d) return `${d} ${du}`;
  if (c) return `${c} ${cu}`;
  return 'zero dollars';
}

function normalizeNumbers(t) {
  t = t.replace(/#\d/g, (m) => `number ${m[1]}`);
  t = t.replace(/\b\d+(K|M|B|T)\b/gi, (m) => `${m.slice(0, -1)} ${{ K: 'thousand', M: 'million', B: 'billion', T: 'trillion' }[m.at(-1).toUpperCase()]}`);
  t = t.replace(/(\d[\d,]+\d)/g, (m) => m.replace(/,/g, ''));
  t = t.replace(/(^|[^/])(\d\d?[/-]\d\d?[/-]\d\d(?:\d\d)?)($|[^/])/g, (_, a, d, b) => a + d.split(/[./-]/).join(' dash ') + b);
  t = t.replace(/(\(?\d{3}\)?[-.\s]\d{3}[-.\s]?\d{4})/g, (m) => {
    const d = m.replace(/\D/g, '');
    return `${[...d.slice(0, 3)].join(' ')}, ${[...d.slice(3, 6)].join(' ')}, ${[...d.slice(6)].join(' ')}`;
  });
  t = t.replace(/(\d\d?:\d\d(?::\d\d)?)/g, expandTime);
  t = t.replace(/\u00A3([\d,]*\d+)/g, '$1 pounds');
  t = t.replace(/\$([\d.,]*\d+)/g, (_, m) => expandDollars(m));
  t = t.replace(/(\d+(?:\.\d+)+)/g, (m) => { const p = m.split('.'); return `${p[0]} point ${p.slice(1).map((x) => [...x].join(' ')).join(' point ')}`; });
  t = t.replace(/(\d\s?\*\s?\d)/g, (m) => m.split('*').join(' times '));
  t = t.replace(/(\d\s?\/\s?\d)/g, (m) => m.split('/').join(' over '));
  t = t.replace(/(\d\s?\+\s?\d)/g, (m) => m.split('+').join(' plus '));
  t = t.replace(/(\d?\s?-\s?\d)/g, (m) => m.split('-').join(' minus '));
  t = t.replace(/(\d+(?:\/\d+)+)/g, (m) => { const p = m.split('/'); return p.join(p.length === 2 ? ' over ' : ' slash '); });
  t = t.replace(/\d+(st|nd|rd|th)/g, (m) => ordinalWords(m.replace(/\D/g, '')));
  for (let i = 0; i < 2; i++) t = t.replace(/(\d[a-z]|[a-z]\d)/gi, (m) => `${m[0]} ${m[1]}`);
  return t.replace(/\d+/g, expandNumber);
}

// ---------- words, abbreviations, symbols ----------
const ABBR = [['mrs', 'misess'], ['ms', 'miss'], ['mr', 'mister'], ['dr', 'doctor'], ['st', 'saint'], ['co', 'company'],
  ['jr', 'junior'], ['maj', 'major'], ['gen', 'general'], ['drs', 'doctors'], ['rev', 'reverend'], ['lt', 'lieutenant'],
  ['hon', 'honorable'], ['sgt', 'sergeant'], ['capt', 'captain'], ['esq', 'esquire'], ['ltd', 'limited'], ['col', 'colonel'],
  ['ft', 'fort']].map(([a, b]) => [new RegExp(`\\b${a}\\.`, 'gi'), b]);
const CASED = [['Hz', 'hertz'], ['kHz', 'kilohertz'], ['KBs', 'kilobytes'], ['KB', 'kilobyte'], ['MBs', 'megabytes'],
  ['MB', 'megabyte'], ['GBs', 'gigabytes'], ['GB', 'gigabyte'], ['TBs', 'terabytes'], ['TB', 'terabyte'],
  ['APIs', "a p i's"], ['API', 'a p i'], ['CLIs', "c l i's"], ['CLI', 'c l i'], ['CPUs', "c p u's"], ['CPU', 'c p u'],
  ['GPUs', "g p u's"], ['GPU', 'g p u'], ['Ave', 'avenue'], ['etc', 'et cetera'], ['Mon', 'monday'], ['Tues', 'tuesday'],
  ['Wed', 'wednesday'], ['Thurs', 'thursday'], ['Fri', 'friday'], ['Sat', 'saturday'], ['Jan', 'january'],
  ['Feb', 'february'], ['Mar', 'march'], ['Apr', 'april'], ['Aug', 'august'], ['Sept', 'september'], ['Oct', 'october'],
  ['Nov', 'november'], ['Dec', 'december'], ['and/or', 'and or']].map(([a, b]) => [new RegExp(`\\b${a.replace('/', '\\/')}\\b`, 'g'), b]);
const SYMBOLS = [[/@/g, ' at '], [/&/g, ' and '], [/%/g, ' percent '], [/:/g, '.'], [/;/g, ','], [/\+/g, ' plus '],
  [/\\/g, ' backslash '], [/~/g, ' about '], [/(^| )<3/g, ' heart '], [/<=/g, ' less than or equal to '],
  [/>=/g, ' greater than or equal to '], [/</g, ' less than '], [/>/g, ' greater than '], [/=/g, ' equals '],
  [/\//g, ' slash '], [/_/g, ' '], [/\*/g, ' ']];

function splitMixedCase(m) {
  const caps = m.match(/[A-Z][a-z]*/g) || [];
  if (caps.length === 1 || caps.length === m.length) return m;
  if (caps.length === m.length - 1 && m.endsWith('s')) return `${m.slice(0, -1)}'s`;
  return caps.join(' ');
}

// Accents off and typographic marks to plain ones, without unidecode.
function toAscii(t) {
  return t
    .replace(/\u2014/g, ' - ')
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'").replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2010-\u2013\u2212]/g, '-').replace(/\u00A0/g, ' ')
    .normalize('NFKD').replace(/[\u0300-\u036F]/g, '');
}

function normalizeNewlines(t) {
  return t.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => (/[.!?]$/.test(l) ? l : `${l}.`)).join(' ');
}

export function clean(text) {
  let t = toAscii(text);
  t = normalizeNewlines(t);
  t = normalizeNumbers(t);
  t = t.replace(/(https?:\/\/)/g, 'h t t p s colon slash slash ');
  t = t.replace(/(. - .)/g, (m) => `${m[0]}, ${m[4]}`);
  t = t.replace(/([A-Z]\.[A-Z])/gi, (m) => `${m[0]} dot ${m[2]}`);
  t = t.replace(/[([{].*[)\]}](.|$)/g, (m) => m.replace(/[([{]/g, ', ').replace(/[)\]}][^$.!?,]/g, ', ').replace(/[)\]}]/g, ''));
  for (const [re, to] of [...ABBR, ...CASED]) t = t.replace(re, to);
  t = t.replace(/\b([A-Z][a-z]*)+\b/g, splitMixedCase);
  for (const [re, to] of SYMBOLS) t = t.replace(re, to);
  t = t.toLowerCase();
  t = t.replace(/[^A-Za-z !$%&'*+,\-./0-9<>?_]/g, '').replace(/[<>/_+]/g, '');
  t = t.replace(/\s+/g, ' ').replace(/ [.?!,]/g, (m) => m[1]).trim();
  t = t.replace(/\.\.\.+/g, '\u0000').replace(/,+/g, ',').replace(/[.,]*\.[.,]*/g, '.')
    .replace(/[.,!]*![.,!]*/g, '!').replace(/[.,!?]*\?[.,!?]*/g, '?').replace(/\u0000/g, '...');
  return t.replace(/(\w)\1{2,}/g, (m) => m.slice(0, 2));
}

// ---------- sentences ----------
// The upstream splitter's rules (a break after ! ? or a line break, or a full
// stop before a space; runs of !?. stay together; nothing over 300
// characters), applied to the text as typed so every word keeps its place.
// Full stops after short titles and initials don't end a sentence, since the
// cleaner would have turned those into words before splitting.
const NOT_AN_END = /(?:^|[\s(])(?:mrs|ms|mr|dr|st|co|jr|maj|gen|drs|rev|lt|hon|sgt|capt|esq|ltd|col|ft|vs|e\.g|i\.e|[a-z])$/i;
const MAX = 300, MIN = 30;

function ranges(text) {
  const out = [];
  let start = 0, inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === '\u201C' || c === '\u201D') inQuote = !inQuote;
    let end = -1;
    if (!inQuote && (c === '!' || c === '?' || c === '\n' || (c === '.' && (i + 1 >= text.length || /\s/.test(text[i + 1])) && !NOT_AN_END.test(text.slice(start, i))))) {
      end = i + 1;
      while (end < text.length && /[!?.]/.test(text[end])) end++;
      while (end < text.length && /["'\u201D\u2019)\]]/.test(text[end])) end++;
    } else if (i - start >= MAX) {
      const sp = text.lastIndexOf(' ', i);
      end = sp > start ? sp + 1 : i + 1;
    }
    if (end > 0) { out.push([start, end]); start = end; i = end - 1; }
  }
  if (start < text.length) out.push([start, text.length]);
  return out;
}

// [{ clean, words: [{ text, start, end, weight }] }], ready to speak one by one.
export function prepare(text) {
  const parts = [];
  for (const [a, b] of ranges(text)) {
    const words = [];
    for (const m of text.slice(a, b).matchAll(/\S+/g)) {
      const w = m[0];
      const said = clean(w).replace(/[^a-z' -]/g, '').length;
      const pause = /[,;:]$/.test(w) ? 3 : /[.!?]$/.test(w) ? 4 : 0;
      words.push({ text: w, start: a + m.index, end: a + m.index + w.length, weight: Math.max(1, said) + 1 + pause });
    }
    const c = clean(text.slice(a, b));
    if (!c || /^[\s.,;:!?]*$/.test(c)) { if (parts.length) parts.at(-1).words.push(...words); continue; }
    parts.push({ clean: c, words });
  }
  // Like upstream: sentences under 30 characters join the one before (or the next one).
  const merged = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.clean.length < MIN && parts.length > 1) {
      if (merged.length) { const q = merged.at(-1); q.clean = `${q.clean} ${p.clean}`; q.words.push(...p.words); continue; }
      if (i + 1 < parts.length) { const n = parts[i + 1]; n.clean = `${p.clean} ${n.clean}`; n.words.unshift(...p.words); continue; }
    }
    merged.push(p);
  }
  return merged;
}
