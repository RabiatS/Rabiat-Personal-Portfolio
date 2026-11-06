// Compare drugs: label facts side by side for a group you pick.
import { loadDrugs, esc, NOT_STATED, stated, items, srcLink, labelText, fmtTL, CAT_COLOR } from '../shared.js';

const SETS = [
  ['nmb', 'NMBs', ['succinylcholine', 'rocuronium', 'vecuronium', 'cisatracurium']],
  ['induction', 'Induction', ['propofol', 'etomidate', 'ketamine', 'methohexital']],
  ['pressors', 'Vasopressors', ['phenylephrine', 'ephedrine', 'norepinephrine', 'epinephrine', 'vasopressin']],
  ['inotropes', 'Inotropes', ['dopamine', 'dobutamine', 'milrinone', 'epinephrine']],
  ['opioids', 'Opioids', ['fentanyl', 'sufentanil', 'remifentanil', 'hydromorphone', 'morphine']],
  ['locals', 'Local anesthetics', ['lidocaine', 'bupivacaine', 'ropivacaine', 'chloroprocaine']],
  ['bp', 'BP lowering', ['esmolol', 'labetalol', 'nicardipine', 'clevidipine', 'hydralazine']],
  ['reversal', 'Reversal', ['sugammadex', 'neostigmine', 'naloxone', 'flumazenil', 'protamine']],
  ['volatile', 'Inhaled', ['sevoflurane', 'desflurane', 'isoflurane', 'nitrous-oxide']],
  ['ponv', 'PONV and stomach', ['ondansetron', 'dexamethasone', 'metoclopramide', 'scopolamine', 'famotidine']],
];
const ROWS = [
  ['class', 'Class'], ['mechanism', 'Mechanism'], ['times', 'Time numbers'], ['onset', 'Onset'], ['peak', 'Peak'], ['duration', 'Duration'],
  ['halfLife', 'Half-life'], ['dosing', 'Dosing'], ['adverse', 'Adverse effects'], ['contraindications', 'Contra- indications'], ['reversal', 'Reversal or antidote'],
];

export default {
  mount(ctx) {
    ctx.tall();
    const wrap = ctx.h('<div class="cx-scroll"><div class="cx-bar"><span class="eyebrow">Columns</span><span class="chips row"></span><select class="sel" style="max-width:220px" aria-label="Add a drug column"></select></div><div class="ctable-wrap"><table class="ctable"><thead></thead><tbody></tbody></table></div><p class="hint" style="margin-top:8px">Tap a cell to show all of its text. Every cell links to its label section.</p></div>');
    ctx.stage.append(wrap);
    const chips = wrap.querySelector('.chips'); const add = wrap.querySelector('select');
    const thead = wrap.querySelector('thead'); const tbody = wrap.querySelector('tbody');
    let drugs = []; let setId = ctx.store.get('cmp:set', 'nmb'); let cols = (SETS.find((s) => s[0] === setId) || SETS[0])[2].slice();
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Compare drugs</h2>'),
      ctx.h('<p class="lede">Put drugs that do the same job next to each other and the differences jump out. Every cell is the label\'s own words.</p>'),
    );
    const setRow = ctx.h(`<div class="row">${SETS.map(([id, l]) => `<button class="chip ${id === setId ? 'on' : ''}" data-s="${id}">${esc(l)}</button>`).join('')}</div>`);
    setRow.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      setId = b.dataset.s; ctx.store.set('cmp:set', setId);
      setRow.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      cols = SETS.find((s) => s[0] === setId)[2].slice(); render();
    }, { signal: ctx.signal }));
    ctx.panel.append(setRow,
      ctx.h('<div class="card tip"><p>Comparing is how these drugs are learned: which neuromuscular blocker starts fastest, which pressor is a pure alpha agonist, which opioid has the shortest offset. The table puts the same field from each label in one row.</p><p>Gaps are real gaps. If a label does not give a number, the cell says so rather than borrowing one from a textbook.</p></div>'),
      ctx.h('<div class="card try"><ol><li>Pick <b>NMBs</b> and read the Class row: one is depolarizing, three are not.</li><li>Pick <b>Vasopressors</b> and compare the Mechanism row: alpha-1 only, alpha and beta, or not adrenergic at all.</li><li>Pick <b>Reversal</b>: what does each one reverse, according to its own label?</li><li>Remove a column with its × and add any other drug from the list.</li></ol></div>'),
      ctx.h('<details class="more"><summary>Going deeper: comparing labels fairly</summary><div><p class="small">Labels were written at different times by different companies, so they are not uniform. A 2020s PLR label states adverse reaction rates from its own trials; a 1980s label may list effects without rates. A shorter duration on one label may come from a different dose or anesthetic background. Read the context in the sentence before you rank drugs against each other.</p><p class="small">For exam style comparisons (ED95, potency ratios, typical intubating doses in multiples of ED95) use your pharmacology text and write them in your notes on each drug card.</p></div></details>'),
    );

    function cell(d, key) {
      if (key === 'times') {
        const tl = d.timeline || {};
        const ks = ['onset', 'peak', 'duration', 'offset'].filter((k) => tl[k]);
        return ks.length ? ks.map((k) => `<p><b class="mono" style="font-size:11px;color:var(--muted)">${k === 'offset' ? 'OFFSET' : k.toUpperCase()}</b> ${esc(fmtTL(tl[k]))}${tl[k].context ? ` <span class="muted small">(${esc(tl[k].context)})</span>` : ''}</p>`).join('') : `<p class="ns">${NOT_STATED}</p>`;
      }
      if (key === 'dosing') {
        const ds = d.dosing.filter((x) => x.src);
        if (!ds.length) return `<p class="ns">${NOT_STATED}</p>`;
        return `<div class="clip">${ds.map((x) => `<p><b>${esc(x.title)}</b></p>${labelText(x.text)}`).join('')}</div>${srcLink(d, ds[0].src)}`;
      }
      const f = d[key];
      if (!stated(f)) return `<p class="ns">${esc(f && f.na ? f.text : NOT_STATED)}</p>`;
      return items(f).map((x) => `<div class="clip">${labelText(x.text)}</div>${srcLink(d, x.src)}`).join('');
    }
    function render() {
      chips.innerHTML = cols.map((id) => { const d = drugs.find((x) => x.id === id); return d ? `<button class="chip on" data-id="${id}" aria-label="Remove ${esc(d.name)}">${esc(d.name)} ×</button>` : ''; }).join('');
      chips.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { cols = cols.filter((x) => x !== b.dataset.id); render(); }, { signal: ctx.signal }));
      add.innerHTML = `<option value="">${cols.length >= 6 ? 'Six columns max' : 'Add a drug...'}</option>${drugs.filter((d) => !cols.includes(d.id)).map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}`;
      add.disabled = cols.length >= 6;
      const ds = cols.map((id) => drugs.find((x) => x.id === id)).filter(Boolean);
      thead.innerHTML = `<tr><th></th>${ds.map((d) => `<th><i class="dot" style="background:${CAT_COLOR[d.category]}"></i>${esc(d.name)}<div class="muted" style="font:500 10.5px var(--f-mono);text-transform:none;letter-spacing:0">${esc(d.label.brand || d.label.generic)} v${esc(d.label.version)}</div></th>`).join('')}</tr>`;
      tbody.innerHTML = ROWS.map(([k, l]) => `<tr><th>${esc(l)}</th>${ds.map((d) => `<td>${cell(d, k)}</td>`).join('')}</tr>`).join('');
      tbody.querySelectorAll('td').forEach((td) => td.addEventListener('click', (e) => { if (e.target.closest('a')) return; td.classList.toggle('open'); }, { signal: ctx.signal }));
    }
    add.addEventListener('change', () => { if (add.value) { cols.push(add.value); render(); } }, { signal: ctx.signal });
    loadDrugs().then((doc) => { if (ctx.signal.aborted) return; drugs = doc.drugs; render(); });

    ctx.quiz([
      { q: 'Which of these does its own label call a depolarizing neuromuscular blocker?', choices: ['Rocuronium', 'Succinylcholine', 'Cisatracurium', 'Vecuronium'], answer: 1, why: 'Succinylcholine, section 12.1. The other three labels call themselves nondepolarizing.' },
      { q: 'How does the phenylephrine (Biorphen) label describe its mechanism?', choices: ['Beta-1 agonist', 'Alpha-1 adrenergic receptor agonist', 'V1 receptor agonist', 'Phosphodiesterase 3 inhibitor'], answer: 1, why: 'Section 12.1: phenylephrine hydrochloride is an alpha-1 adrenergic receptor agonist.' },
      { q: 'What does the sugammadex (Bridion) label say the molecule is?', choices: ['A cholinesterase inhibitor', 'A modified gamma cyclodextrin', 'A muscarinic antagonist', 'An opioid antagonist'], answer: 1, why: 'Section 12.1: Bridion is a modified gamma cyclodextrin. It forms a complex with rocuronium or vecuronium.' },
    ]);
  },
};
