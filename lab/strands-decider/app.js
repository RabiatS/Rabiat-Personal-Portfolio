// Strands Decider: a situation and a typed question in, a probability for
// every option out. The model runs in the Lab worker (adapter.js); the option
// rows double as its bars.
import { mountLab, veil } from '../frame/frame.js';

const $ = (id) => document.getElementById(id);
const LIMITS = { choice: [2, 6], score: [2, 7] };

const EXAMPLES = [
  {
    label: 'Which plant should I get?', kind: 'choice',
    state: 'My flat is dark, with one small north-facing window. I travel most weeks and always forget to water things.',
    question: 'Which plant should I get?',
    options: ['A snake plant', 'A sunflower', 'An orchid'],
  },
  {
    label: 'How spicy is this soup?', kind: 'score',
    state: 'Three scotch bonnets went into one small pot of pepper soup. My eyes watered from across the kitchen.',
    question: 'How spicy is the soup?',
    options: ['mild', 'warm', 'hot', 'call the fire brigade'],
  },
  {
    label: 'Is the milk still OK?', kind: 'noul',
    state: 'The milk carton says best before 2 September. Today is 5 October and it smells sour.',
    question: 'The milk is safe to drink.',
  },
];

const lab = await mountLab({
  slug: 'strands-decider',
  adapter: new URL('./adapter.js', import.meta.url).href,
  gate: $('gate'), stats: $('labStats'), verb: 'decide',
});


// ---------- the form ----------
let kind = 'choice';
const kept = { choice: [], score: [] };   // what was typed under each kind, kept across switches

function rows() { return [...$('opts').querySelectorAll('.opt')]; }
function values() { return rows().map((li) => li.querySelector('input').value); }

function render(list) {
  const fixed = kind === 'noul';
  const [min, max] = LIMITS[kind] || [2, 2];
  const ol = $('opts');
  ol.replaceChildren();
  list.forEach((v, i) => {
    const li = document.createElement('li');
    li.className = 'opt';
    li.innerHTML = '<span class="fill" aria-hidden="true"></span><span class="n"></span><input type="text" maxlength="120"><span class="pct" aria-hidden="true"></span><button type="button" class="x">×</button>';
    li.querySelector('.n').textContent = i + 1;
    const input = li.querySelector('input');
    input.value = v;
    input.readOnly = fixed;
    input.placeholder = kind === 'score' ? (i === 0 ? 'Lowest level' : i === list.length - 1 ? 'Highest level' : 'A level') : `Option ${i + 1}`;
    input.setAttribute('aria-label', kind === 'score' ? `Level ${i + 1}` : `Option ${i + 1}`);
    const x = li.querySelector('.x');
    x.hidden = fixed || list.length <= min;
    x.setAttribute('aria-label', `Remove ${kind === 'score' ? 'level' : 'option'} ${i + 1}`);
    x.addEventListener('click', () => { const l = values(); l.splice(i, 1); render(l); stale(); });
    ol.append(li);
  });
  $('add').hidden = fixed || list.length >= max;
  $('add').textContent = kind === 'score' ? 'Add level' : 'Add option';
  $('ends').hidden = kind !== 'score';
}

function setKind(next, list) {
  if (kind !== 'noul') kept[kind] = values();
  kind = next;
  document.querySelectorAll('.kind').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.kind === kind));
    b.classList.toggle('is-selected', b.dataset.kind === kind);
  });
  $('qLabel').textContent = kind === 'noul' ? 'The statement' : 'The question';
  $('question').placeholder = kind === 'noul' ? 'Something that is true or not' : kind === 'score' ? 'How much is it?' : 'What should I do?';
  render(kind === 'noul' ? ['No', 'Yes'] : list || (kept[kind].length ? kept[kind] : ['', '']));
  stale();
}

function fill(ex) {
  $('state').value = ex.state;
  $('question').value = ex.question;
  setKind(ex.kind, ex.options);
}

document.querySelectorAll('.kind').forEach((b) => b.addEventListener('click', () => { if (b.dataset.kind !== kind) setKind(b.dataset.kind); }));
$('add').addEventListener('click', () => {
  render([...values(), '']);
  rows().at(-1).querySelector('input').focus();
  stale();
});
$('form').addEventListener('input', stale);
$('form').addEventListener('submit', (e) => { e.preventDefault(); decide(); });

// ---------- deciding ----------
let busy = false, token = 0;

function stale() {
  token++;
  document.body.classList.remove('decided');
  rows().forEach((li) => { li.classList.remove('win'); li.querySelector('.fill').style.transform = ''; });
}

async function decide() {
  if (busy || lab.state === 'blocked') return;
  const state = $('state').value.trim();
  const instructions = $('question').value.trim();
  const options = values().map((v) => v.trim());
  const say = (msg) => { window.rkToast?.(msg); };
  if (!state) return say('Describe the situation first');
  if (!instructions) return say(kind === 'noul' ? 'Write a statement to check' : 'Ask a question first');
  if (kind !== 'noul') {
    if (options.some((o) => !o)) return say(kind === 'score' ? 'Fill in every level' : 'Fill in every option');
    if (new Set(options.map((o) => o.toLowerCase())).size < options.length) return say('Two options are the same');
  }
  stale();
  const t = token;
  busy = true;
  $('decide').disabled = true;
  try {
    await lab.ensure();
    const question = kind === 'noul' ? { type: 'noul', instructions } : { type: kind, instructions, options };
    const { output, ms } = await lab.run({ state, questions: [question] });
    if (t !== token) return; // edited while it ran
    show(output.answers[0], output.tokens, ms);
  } catch (err) {
    veil('That did not work', null, err?.message || String(err), { label: 'Close', onClick: () => veil(null) });
  } finally {
    busy = false;
    $('decide').disabled = false;
  }
}

function show({ probs }, tokens, ms) {
  const top = probs.indexOf(Math.max(...probs));
  const lis = rows();
  document.body.classList.add('decided');
  lis.forEach((li, i) => {
    const p = probs[i] ?? 0;
    li.classList.toggle('win', i === top);
    const f = li.querySelector('.fill');
    f.style.transitionDelay = `${i * 70}ms`;
    requestAnimationFrame(() => { f.style.transform = `scaleX(${Math.max(p, 0.004)})`; });
    count(li.querySelector('.pct'), p, i * 70);
  });
  const name = lis[top].querySelector('input').value;
  $('time').innerHTML = '';
  const b = document.createElement('b');
  b.textContent = `${(ms / 1000).toFixed(2)} s`;
  $('time').append(b, ` on ${lab.where}`);
  $('time').title = `${tokens} tokens, one pass`;
  $('said').textContent = `Top pick: ${name}, ${pct(probs[top])}`;
}

const pct = (p) => (p < 0.005 ? '<1%' : `${Math.round(p * 100)}%`);
function count(el, p, delay) {
  const t0 = performance.now() + delay;
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const step = (now) => {
    const k = Math.max(0, Math.min(1, (now - t0) / 900));
    el.textContent = k >= 1 ? pct(p) : `${Math.round(p * 100 * ease(k))}%`;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- examples ----------
EXAMPLES.forEach((ex) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn ex';
  b.textContent = ex.label;
  b.addEventListener('click', () => { if (busy) return; fill(ex); decide(); });
  $('examples').append(b);
});
fill(EXAMPLES[0]);
