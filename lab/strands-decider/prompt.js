// Prompt rendering, tokenization and option positions for strands-decider.
// A port of strands_decider/prompting.py and the _fit / _option_token_index
// parts of strands_decider/infer.py (github.com/strands-labs/strands-decider,
// Apache 2.0), checked against the reference prompts, token ids and option
// positions in the ONNX repo's conversion/fixtures/reference.json.

// The prompt separates an option from its description with an em dash, as the
// model was trained. Written as an escape so this file holds no such character.
const DASH = '\u2014';

const NOUL_LABELS = ['false', 'true'];
const NOUL_CRITERIA = {
  false: 'the statement does not hold for this state',
  true: 'the statement holds for this state',
};
const HEADERS = {
  noul: 'Decide whether the statement is true of the state.',
  choice: 'Select exactly one option.',
  score: 'Rate the state against the ordered levels below (lowest first).',
};

// Python's str.strip() and " ".join(s.split()). NFC first, as the tokenizer's
// normalizer does, so character offsets mean the same thing on both sides.
const clean = (s) => String(s ?? '').normalize('NFC').trim();
const oneLine = (s) => clean(s).split(/\s+/).filter(Boolean).join(' ');

export const renderState = (state) => `<state>\n${clean(state)}\n</state>\n`;

// question: { type: 'choice', instructions, options: [name, ...] | [[name, description], ...] }
//           { type: 'score', instructions, options: [level description, ...] }  (lowest first)
//           { type: 'noul', instructions }
export function renderQuestion(question) {
  const kind = question.type;
  let pairs;
  if (kind === 'noul') pairs = NOUL_LABELS.map((l) => [l, NOUL_CRITERIA[l]]);
  else if (kind === 'choice') pairs = question.options.map((o) => (Array.isArray(o) ? [clean(o[0]), clean(o[1])] : [clean(o), '']));
  else if (kind === 'score') pairs = question.options.map((d, i) => [String(i), d]);
  else throw new Error(`Unknown question type ${kind}`);

  const lines = [];
  const spans = [];
  let cursor = 0;
  pairs.forEach(([name, desc], i) => {
    const d = oneLine(desc);
    const line = `${i + 1}. ${name}${d ? ` ${DASH} ${d}` : ''}`;
    lines.push(line);
    spans.push([cursor, cursor + line.length]);
    cursor += line.length + 1;
  });
  const prefix = `<question type="${kind}">\n${HEADERS[kind]}\n${clean(question.instructions)}\n<options>\n`;
  return {
    kind,
    text: `${prefix}${lines.join('\n')}\n</options>\n</question>\n<answer>`,
    labels: pairs.map(([n]) => n),
    spans: spans.map(([s, e]) => [prefix.length + s, prefix.length + e]),
  };
}

// ---------- character offsets for byte-level BPE tokens ----------
// Transformers.js gives ids and token strings but no offset mapping, so each
// token is mapped back to its bytes (GPT-2 byte-to-unicode table) and the
// byte positions to UTF-16 positions in the text.
let byteOf = null;
function byteTable() {
  if (byteOf) return byteOf;
  const bs = [];
  for (let i = 33; i <= 126; i++) bs.push(i);
  for (let i = 161; i <= 172; i++) bs.push(i);
  for (let i = 174; i <= 255; i++) bs.push(i);
  const cs = [...bs];
  let n = 0;
  for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + n++); }
  byteOf = new Map(bs.map((b, i) => [String.fromCodePoint(cs[i]), b]));
  return byteOf;
}
const utf8 = new TextEncoder();
function tokenBytes(token) {
  const table = byteTable();
  let n = 0;
  for (const ch of token) n += table.has(ch) ? 1 : utf8.encode(ch).length;
  return n;
}

// [lo, hi) in UTF-16 units for every token of `text`.
function offsets(text, tokens) {
  const startOf = [];   // byte index -> UTF-16 index of the character it belongs to
  const endOf = [];     // byte index -> UTF-16 index just after that character
  let u = 0;
  for (const ch of text) {
    const nb = utf8.encode(ch).length;
    for (let k = 0; k < nb; k++) { startOf.push(u); endOf.push(u + ch.length); }
    u += ch.length;
  }
  const out = [];
  let b = 0;
  for (const t of tokens) {
    const nb = tokenBytes(t);
    out.push(nb ? [startOf[b], endOf[b + nb - 1]] : [0, 0]);
    b += nb;
  }
  if (b !== startOf.length) throw new Error('Tokenizer offsets did not line up with the text');
  return out;
}

function encode(tok, text) {
  const ids = tok.encode(text, { add_special_tokens: false });
  const tokens = tok.tokenize(text);
  if (tokens.length !== ids.length) throw new Error('Tokenizer returned mismatched ids and tokens');
  return { ids, offs: offsets(text, tokens) };
}

// Last token that lies wholly inside each option's line.
function optionPositions(offs, spans) {
  return spans.map(([a, b]) => {
    let last = -1;
    offs.forEach(([lo, hi], j) => { if (hi > lo && lo >= a && hi <= b) last = j; });
    if (last < 0) throw new Error('An option was cut off. Try a shorter question');
    return last;
  });
}

// _fit: the question gets first claim on the window; the state takes the rest.
// Returns one row per question: { ids, answerPos, optionPos }.
export function encodeRequest(tok, state, rendered, { maxLength = 4096, maxQuestionFraction = 0.75 } = {}) {
  const qs = rendered.map((r) => encode(tok, r.text));
  const longest = Math.max(...qs.map((q) => q.ids.length));
  const reserve = Math.min(longest, Math.max(1, Math.floor(maxLength * maxQuestionFraction)));
  const stateIds = tok.encode(renderState(state), { add_special_tokens: true }).slice(0, Math.max(1, maxLength - reserve));
  return qs.map((q, i) => {
    const cut = Math.max(0, q.ids.length - reserve);
    const ids = q.ids.slice(cut);
    const pos = optionPositions(q.offs.slice(cut), rendered[i].spans);
    return { ids: [...stateIds, ...ids], answerPos: stateIds.length + ids.length - 1, optionPos: pos.map((p) => stateIds.length + p) };
  });
}
