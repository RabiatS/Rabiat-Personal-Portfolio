// Tokens: a real byte level byte-pair encoding (BPE) tokenizer, trained live on a small public domain corpus.

const CORPUS = [
  'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.',
  'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, and what is the use of a book, thought Alice, without pictures or conversations? So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.',
  'Call me Ishmael. Some years ago, never mind how long precisely, having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world. It is a way I have of driving off the spleen and regulating the circulation.',
  'Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal. Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure.',
  'It was the best of times, it was the worst of times, it was the age of wisdom, it was the age of foolishness, it was the epoch of belief, it was the epoch of incredulity, it was the season of Light, it was the season of Darkness, it was the spring of hope, it was the winter of despair.',
].join('\n');

const PRE = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+/gu;
const enc = new TextEncoder();
const MAX_MERGES = 700;

function train(text) {
  const counts = new Map();
  for (const w of text.match(PRE) || []) counts.set(w, (counts.get(w) || 0) + 1);
  const words = [...counts].map(([w, c]) => ({ seq: [...enc.encode(w)], c }));
  const merges = []; // [a, b] -> new id 256 + i
  for (let m = 0; m < MAX_MERGES; m++) {
    const pc = new Map();
    for (const { seq, c } of words) for (let i = 0; i < seq.length - 1; i++) { const k = seq[i] * 4096 + seq[i + 1]; pc.set(k, (pc.get(k) || 0) + c); }
    let best = -1; let bc = 1;
    for (const [k, c] of pc) if (c > bc || (c === bc && best >= 0 && k < best)) { if (c >= 2) { best = k; bc = c; } }
    if (best < 0) break;
    const a = Math.floor(best / 4096); const b = best % 4096; const id = 256 + merges.length;
    merges.push([a, b, bc]);
    for (const w of words) {
      const s = w.seq; const out = [];
      for (let i = 0; i < s.length; i++) { if (i < s.length - 1 && s[i] === a && s[i + 1] === b) { out.push(id); i++; } else out.push(s[i]); }
      w.seq = out;
    }
  }
  return merges;
}

export default {
  mount(ctx) {
    const C = ctx.colors; const pal = [C.c1, C.c2, C.c3, C.c4, C.c5, C.c6];
    const merges = train(CORPUS);
    const rank = new Map(merges.map(([a, b], i) => [a * 4096 + b, i]));
    const bytesCache = new Map();
    const bytesOf = (id) => {
      if (id < 256) return [id];
      if (bytesCache.has(id)) return bytesCache.get(id);
      const [a, b] = merges[id - 256]; const r = [...bytesOf(a), ...bytesOf(b)]; bytesCache.set(id, r); return r;
    };
    const dec = new TextDecoder('utf-8', { fatal: true });
    const label = (id) => {
      const bs = bytesOf(id);
      let s;
      try { s = dec.decode(new Uint8Array(bs)); } catch { return bs.map((x) => `<${x.toString(16)}>`).join(''); }
      return s.replace(/ /g, '·').replace(/\n/g, '↵');
    };
    const encodeWord = (w, N) => {
      let s = [...enc.encode(w)];
      for (;;) {
        let br = Infinity; let bi = -1;
        for (let i = 0; i < s.length - 1; i++) { const r = rank.get(s[i] * 4096 + s[i + 1]); if (r !== undefined && r < N && r < br) { br = r; bi = i; } }
        if (bi < 0) break;
        const [a, b] = merges[br]; const id = 256 + br; const out = [];
        for (let i = 0; i < s.length; i++) { if (i < s.length - 1 && s[i] === a && s[i + 1] === b) { out.push(id); i++; } else out.push(s[i]); }
        s = out;
      }
      return s;
    };
    const encode = (text, N) => { const out = []; for (const w of text.match(PRE) || []) out.push(...encodeWord(w, N)); return out; };

    const presets = [
      ['english', 'English', 'It was the best of times, and Alice thought the book had no pictures.'],
      ['rare', 'Rare words', 'The antidisestablishmentarianism of the Quizzical Zephyr bewildered everyone.'],
      ['numbers', 'Numbers', 'In 2024 the price rose from 1,299.99 to 31415926 units (about 7.5%).'],
      ['other', 'Other languages', 'Le chat dort sur le canapé. 猫がソファで寝ています。'],
      ['code', 'Code', 'for (let i = 0; i < n; i++) { total += x[i]; }'],
    ];
    let N = Math.min(merges.length, ctx.store.get('tok:N', 220));
    let text = presets[0][2];

    ctx.tall();
    const root = ctx.h(`<div class="tk">
      <style>
        .tk{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:14px;padding:4px 4px 64px}
        .tk textarea{min-height:76px;font-size:15px}
        .tk .pres{display:flex;gap:6px;flex-wrap:wrap}
        .tk .chips{display:flex;flex-wrap:wrap;gap:5px 4px;align-content:flex-start}
        .tk .tc{display:inline-flex;flex-direction:column;align-items:center;border-radius:6px;padding:4px 6px 3px;border:1px solid;min-width:22px;animation:tkpop .25s ease}
        .tk .tc b{font:500 15px/1.15 "DM Mono",monospace;white-space:pre;color:#F5F5F0}
        .tk .tc i{font:500 10px/1.2 "DM Mono",monospace;font-style:normal;opacity:.75}
        .tk .tc.byte b{color:#A0A09A}
        @keyframes tkpop{from{transform:scale(.85);opacity:.3}}
        .tk .ml{display:flex;flex-wrap:wrap;gap:4px 10px;font:500 12px "DM Mono",monospace;color:#A0A09A}
        .tk .ml span b{color:#F5F5F0;font-weight:500}
        .tk .sec{font:600 11px Rajdhani,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#A0A09A}
        .tk .ratio{height:10px;border-radius:5px;background:#1E1E1E;overflow:hidden;display:flex}
        .tk .ratio span{display:block;height:100%}
      </style>
      <div class="pres"></div>
      <textarea class="txt" spellcheck="false" aria-label="Text to tokenise"></textarea>
      <div class="stat">
        <div><b data-k="chars">0</b><span>characters</span></div>
        <div><b data-k="bytes">0</b><span>UTF-8 bytes</span></div>
        <div><b data-k="toks">0</b><span>tokens</span></div>
        <div><b data-k="cpt">0</b><span>chars per token</span></div>
      </div>
      <div><div class="sec" style="margin-bottom:5px">Tokens versus raw bytes</div><div class="ratio"><span data-k="rb" style="background:${C.c1}"></span></div></div>
      <div class="sec">Tokens (text piece, then its id)</div>
      <div class="chips"></div>
      <div class="sec">Most recent merges learned</div>
      <div class="ml"></div>
    </div>`);
    ctx.stage.append(root);
    const ta = root.querySelector('textarea'); ta.value = text;
    const chips = root.querySelector('.chips'); const ml = root.querySelector('.ml');
    const q = (k) => root.querySelector(`[data-k="${k}"]`);
    const presWrap = root.querySelector('.pres');
    for (const [id, name, t] of presets) {
      const b = ctx.h(`<button class="chip" data-p="${id}">${name}</button>`);
      b.onclick = () => { text = t; ta.value = t; presWrap.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b)); render(); };
      presWrap.append(b);
    }
    presWrap.firstChild.classList.add('on');
    ta.addEventListener('input', () => { text = ta.value; presWrap.querySelectorAll('.chip').forEach((x) => x.classList.remove('on')); render(); }, { signal: ctx.signal });

    function render() {
      const ids = encode(text, N);
      const nb = enc.encode(text).length;
      q('chars').textContent = [...text].length; q('bytes').textContent = nb; q('toks').textContent = ids.length;
      q('cpt').textContent = ids.length ? ([...text].length / ids.length).toFixed(2) : '0';
      q('rb').style.width = `${nb ? (100 * ids.length / nb) : 0}%`;
      chips.innerHTML = ids.map((id) => {
        const col = id < 256 ? '#5A5A55' : pal[id % 6];
        return `<span class="tc ${id < 256 ? 'byte' : ''}" style="border-color:${col}88;background:${col}1f"><b>${ctx.esc(label(id))}</b><i style="color:${id < 256 ? '#A0A09A' : col}">${id}</i></span>`;
      }).join('');
      const from = Math.max(0, N - 10);
      ml.innerHTML = N === 0 ? '<span>No merges yet: every byte is its own token.</span>' : merges.slice(from, N).map(([a, b, c], i) => `<span>${ctx.esc(label(a))} + ${ctx.esc(label(b))} → <b>${ctx.esc(label(256 + from + i))}</b> <small>(${c}x)</small></span>`).reverse().join('');
      vocabOut.textContent = `Vocabulary: 256 bytes + ${N} merges = ${256 + N} tokens`;
    }

    // Panel
    const P = ctx.panel;
    P.append(
      ctx.h('<h2 class="k-h">Tokens</h2>'),
      ctx.h('<p class="lede">A language model never sees letters or words. It sees a list of numbers, one per token. Here is a real tokenizer you can train.</p>'),
    );
    const sl = ctx.slider({ label: 'Merges learned', min: 0, max: merges.length, step: 1, value: N, fmt: (v) => `${v}`, onInput: (v) => { N = v; ctx.store.set('tok:N', v); render(); } });
    const vocabOut = ctx.h('<p class="hint"></p>');
    let anim = null;
    const play = ctx.h('<button class="btn ghost sm">Watch it learn from zero</button>');
    play.onclick = () => {
      if (anim) { anim(); anim = null; play.textContent = 'Watch it learn from zero'; return; }
      N = 0; sl.value = 0; render(); play.textContent = 'Stop';
      let acc = 0;
      anim = ctx.loop((t, dt) => {
        acc += dt * 40;
        if (acc >= 1) { const k = Math.floor(acc); acc -= k; N = Math.min(merges.length, N + k); sl.value = N; render(); }
        if (N >= merges.length) { anim(); anim = null; play.textContent = 'Watch it learn from zero'; }
      });
    };
    P.append(sl, vocabOut, ctx.h('<div class="row"></div>'));
    P.lastChild.append(play);
    P.append(
      ctx.h(`<div class="card tip"><p>Text is first turned into bytes (UTF-8): plain English letters take 1 byte each, many accented letters 2, and Chinese or Japanese characters usually 3. Byte-pair encoding then looks at a pile of training text, finds the pair of neighbouring pieces that appears most often, and glues it into one new token. Repeat that a few hundred (or a hundred thousand) times and common words become single tokens, while rare words get built from smaller pieces.</p></div>`),
      ctx.h(`<div class="card try"><ol>
        <li>Drag <b>Merges learned</b> to 0. Every character is its own token (grey chips are raw bytes).</li>
        <li>Press <b>Watch it learn</b>. Watch "·t", "he", "in", then "·the", "·of" and "ing" appear early: they are the most common pairs in the training text.</li>
        <li>Try <b>Other languages</b>. The Japanese text was never in the training corpus, so each character stays 3 byte tokens.</li>
        <li>Try <b>Numbers</b> and <b>Rare words</b>: fewer characters per token means the same text costs more tokens.</li>
      </ol></div>`),
      ctx.h(`<div class="card deep">
        <p>This tokenizer learned only from about 1,800 characters of public domain text (Austen, Carroll, Melville, Lincoln, Dickens), so its vocabulary is tiny. Real tokenizers are trained on huge, mixed corpora and keep somewhere around 50,000 to 200,000 tokens. GPT-2 used 50,257; newer models often use 100,000 or more, partly so that code and many languages compress well.</p>
        <p>Why it matters: a model reads, prices and limits text in tokens, not words. A rough rule for English is about 4 characters per token. Languages, numbers and rare words that were less common in the tokenizer's training data split into more pieces, so they use more of the context window and cost more. Splitting also explains some odd failures: a model that sees "strawberry" as two or three tokens never directly sees its individual letters.</p>
        <p class="small muted">Details: this is byte level BPE like GPT-2's. Text is pre-split into word-like chunks (a leading space stays attached to the word), merges never cross chunk boundaries, and encoding applies the learned merges in the order they were learned. Some models also split numbers into single digits on purpose.</p>
      </div>`),
    );
    render();

    ctx.quiz([
      { q: 'What does byte-pair encoding merge at each training step?', choices: ['The two rarest letters', 'The most frequent pair of neighbouring tokens', 'Every word into one token', 'Tokens chosen at random'], answer: 1, why: 'BPE counts adjacent pairs across the training text and merges the most common one into a new token, then repeats.' },
      { q: 'Why does Japanese text often use more tokens than English of similar meaning in an English heavy tokenizer?', choices: ['Japanese is longer to read', 'Its characters are several UTF-8 bytes and were rarely merged during training', 'Models cannot read Japanese', 'Tokenizers delete non English text'], answer: 1, why: 'Pieces that were rare in the tokenizer training data stay split into small pieces, down to single bytes.' },
      { q: 'Roughly how big are vocabularies of real LLM tokenizers?', choices: ['26 letters', 'About 1,000 tokens', 'Around 50,000 to 200,000 tokens', 'Every English word, about 1 million'], answer: 2, why: 'Most modern models use tens of thousands to a couple of hundred thousand tokens.' },
    ]);
    return () => { if (anim) anim(); };
  },
};
