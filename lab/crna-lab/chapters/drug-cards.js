// Drug cards: browse every drug, each field read from its FDA label with a link to the exact section.
import { loadDrugs, esc, NOT_STATED, stated, items, CATS, CAT_COLOR, srcLink, labelText, fmtTL, fmtDate, disclaimerCard } from '../shared.js';

export function renderCard(d, { store } = {}) {
  const f = (title, field, opts = {}) => {
    const list = items(field);
    if (!stated(field)) {
      const na = field && field.na;
      return `<div class="dfield"><h4>${esc(title)}</h4><p class="ns">${esc(na ? field.text : NOT_STATED)}</p></div>`;
    }
    return `<div class="dfield"><h4>${esc(title)}</h4>${list.map((x) => `<div>${opts.raw ? `<p>${esc(x.text)}</p>` : labelText(x.text)}${x.excerpt ? '<span class="xnote">Excerpt. Full text in the label. </span>' : ''}${srcLink(d, x.src)}</div>`).join('')}</div>`;
  };
  const tl = d.timeline || {};
  const tlLine = ['onset', 'peak', 'duration', 'offset'].filter((k) => tl[k]).map((k) => `<span><b>${k === 'offset' ? 'Offset after stopping' : k[0].toUpperCase() + k.slice(1)}</b> ${esc(fmtTL(tl[k]))}${tl[k].context ? ` <span class="muted">(${esc(tl[k].context)})</span>` : ''}</span>`).join(' · ');
  const dosing = d.dosing.map((x) => (x.src
    ? `<div class="dose"><b>${esc(x.title)}</b>${labelText(x.text)}${x.excerpt ? '<span class="xnote">Excerpt. Read the full section in the label before use.</span>' : ''}${srcLink(d, x.src)}</div>`
    : `<p class="ns">${esc(NOT_STATED)}</p>`)).join('');
  return `<article class="dcard">
    <div style="display:grid;gap:6px">
      <span class="eyebrow"><i class="dot" style="background:${CAT_COLOR[d.category]}"></i>${esc(CATS[d.category])} · ${esc(d.group)} <span class="muted">(study grouping)</span></span>
      <h3>${esc(d.name)}</h3>
      <div class="meta">Label: <a href="${esc(d.label.url)}" target="_blank" rel="noopener">${esc(d.label.brand || d.label.generic)} (${esc(d.label.manufacturer)}) on DailyMed</a><br>Set id ${esc(d.label.setid)} · version ${esc(d.label.version)} · effective ${esc(fmtDate(d.label.effective))}${d.label.application ? ` · ${esc(d.label.application)}` : ''}</div>
    </div>
    ${f('Class (label wording)', d.class, { raw: true })}
    ${d.epc && d.epc.text !== d.class.text ? f('FDA established pharmacologic class', d.epc, { raw: true }) : ''}
    ${f('Mechanism of action', d.mechanism)}
    ${f('Indications', d.indications)}
    ${tlLine ? `<div class="dfield"><h4>Time course at a glance</h4><p class="small">${tlLine}</p><p class="hint">Numbers read from the label sentences below. Context matters: route, dose and setting differ between labels.</p></div>` : ''}
    ${f('Onset', d.onset)}
    ${f('Peak', d.peak)}
    ${f('Duration', d.duration)}
    ${d.offset ? f('Offset after stopping', d.offset) : ''}
    ${f('Half-life', d.halfLife)}
    <div class="dfield"><h4>Dosing (adult, from section 2)</h4><p class="small">Route on the label: ${esc(d.route.text)}</p>${dosing}</div>
    ${d.boxedWarning ? f('Boxed warning', d.boxedWarning) : ''}
    ${f('Key adverse effects', d.adverse)}
    ${f('Contraindications', d.contraindications)}
    ${f('Reversal or antidote', d.reversal)}
    ${d.notes ? `<div class="dfield"><h4>Course notes</h4><p>${esc(d.notes)}</p></div>` : ''}
    ${store ? `<div class="dfield"><h4>Your notes</h4><textarea class="txt notes-box" rows="3" placeholder="Add what your course says (saved in this browser only)">${esc(store.get(`note:${d.id}`, ''))}</textarea></div>` : ''}
  </article>`;
}

export default {
  mount(ctx) {
    ctx.tall();
    const wrap = ctx.h('<div class="cx-scroll"><div class="cx-bar"><input class="txt" type="search" placeholder="Search drugs, classes, words" aria-label="Search drugs"><span class="cx-count"></span></div><div class="cx-body"></div></div>');
    ctx.stage.append(wrap);
    const body = wrap.querySelector('.cx-body'); const search = wrap.querySelector('input'); const count = wrap.querySelector('.cx-count');
    let cat = ctx.store.get('cards:cat', 'all'); let group = 'all'; let drugs = []; let open = null;

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Drug cards</h2>'),
      ctx.h('<p class="lede">Every drug on one card: class, mechanism, time course, dosing, adverse effects, contraindications and reversal, each line read from the FDA label.</p>'),
      disclaimerCard(ctx.h),
    );
    const segEl = ctx.seg([['all', 'All'], ['anesthesia', 'Anesthesia'], ['cardiac', 'Cardiac'], ['supporting', 'Supporting']], cat, (v) => { cat = v; group = 'all'; ctx.store.set('cards:cat', v); renderGroups(); renderGrid(); });
    const groupsEl = ctx.h('<div class="row"></div>');
    const statEl = ctx.h('<div class="stat"></div>');
    ctx.panel.append(segEl, groupsEl, statEl);
    ctx.panel.append(
      ctx.h(`<div class="card tip"><p>A drug label (the package insert) is the legal summary the FDA approved. It is long, so this lab pulls out the parts you study most and keeps a link to where each one came from. Tap a small grey source line to open that exact label on DailyMed.</p><p>When a label simply does not give a number, for example the onset of many older drugs, the card says <i>${NOT_STATED}</i>. That is on purpose: it never fills a gap with a guess.</p></div>`),
      ctx.h('<div class="card try"><ol><li>Pick <b>Anesthesia</b>, then the <b>Neuromuscular blocker</b> chip.</li><li>Open rocuronium and find the intubating dose in section 2 and the reversal sentence in section 10.</li><li>Open succinylcholine and compare its onset and duration lines.</li><li>Type <code>cyclodextrin</code> in the search box. Which drug comes up?</li></ol></div>'),
      ctx.h(`<details class="more"><summary>Going deeper: how a label is built</summary><div>
        <p class="small">Newer labels use the PLR format (Physician Labeling Rule, 2006): a one page <b>Highlights</b>, then numbered sections. The ones used here: 1 Indications, 2 Dosage and Administration, 4 Contraindications, 5 Warnings and Precautions, 6 Adverse Reactions, 10 Overdosage, 11 Description, 12.1 Mechanism of Action, 12.2 Pharmacodynamics, 12.3 Pharmacokinetics.</p>
        <p class="small">Older labels (many generics of drugs approved long ago) have unnumbered sections like Clinical Pharmacology and Precautions, and often describe onset and duration in prose or not at all. That is why some cards cite a section without a number.</p>
        <p class="small">Each drug uses one label, chosen automatically: the reference (NDA) label when one is current, in the route used in anesthesia. Different manufacturers' labels for the same drug can differ in wording and in what they include. The build script is <code>lab/crna-lab/tools/build-drugs.py</code>.</p>
        <p class="small">"Class (label wording)" is the label's own phrase, like "nondepolarizing neuromuscular blocking agent". Where FDA indexing gives an Established Pharmacologic Class it is shown too. The category and group chips are only a study grouping.</p>
      </div></details>`),
    );

    function renderGroups() {
      const gs = [...new Set(drugs.filter((d) => cat === 'all' || d.category === cat).map((d) => d.group))];
      groupsEl.innerHTML = ['all', ...gs].map((g) => `<button class="chip ${g === group ? 'on' : ''}" data-g="${esc(g)}">${esc(g === 'all' ? 'All groups' : g)}</button>`).join('');
      groupsEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { group = b.dataset.g; renderGroups(); renderGrid(); }, { signal: ctx.signal }));
    }
    const hay = (d) => [d.name, d.group, d.class.text, d.mechanism.text, d.label.brand, d.indications.text].join(' ').toLowerCase();
    function renderGrid() {
      open = null;
      const q = search.value.trim().toLowerCase();
      const list = drugs.filter((d) => (cat === 'all' || d.category === cat) && (group === 'all' || d.group === group) && (!q || hay(d).includes(q)));
      count.textContent = `${list.length} of ${drugs.length} drugs`;
      body.innerHTML = list.length ? `<div class="dgrid">${list.map((d) => `<button class="dtile" data-id="${d.id}"><span class="g"><i class="dot" style="background:${CAT_COLOR[d.category]}"></i>${esc(d.group)}</span><b>${esc(d.name)}</b><span class="c">${esc(stated(d.class) ? d.class.text : NOT_STATED)}</span></button>`).join('')}</div>` : '<p class="muted">No drug matches that search.</p>';
      body.querySelectorAll('.dtile').forEach((b) => b.addEventListener('click', () => showDrug(b.dataset.id), { signal: ctx.signal }));
    }
    function showDrug(id) {
      const d = drugs.find((x) => x.id === id); if (!d) return;
      open = id; ctx.store.set('cards:last', id);
      body.innerHTML = `<button class="btn ghost sm back" style="margin-bottom:10px">‹ All drugs</button>${renderCard(d, { store: ctx.store })}`;
      body.querySelector('.back').addEventListener('click', () => { renderGrid(); wrap.scrollTop = 0; }, { signal: ctx.signal });
      const ta = body.querySelector('textarea');
      if (ta) ta.addEventListener('input', () => ctx.store.set(`note:${d.id}`, ta.value), { signal: ctx.signal });
      wrap.scrollTop = 0;
      if (window.innerWidth < 860) wrap.scrollIntoView({ block: 'start' });
    }
    search.addEventListener('input', () => renderGrid(), { signal: ctx.signal });

    loadDrugs().then((doc) => {
      if (ctx.signal.aborted) return;
      drugs = doc.drugs;
      const fieldsTotal = doc.stats.fields_sourced + doc.stats.fields_not_stated;
      statEl.innerHTML = `<div><b>${drugs.length}</b><span>drugs</span></div><div><b>${Math.round((doc.stats.fields_sourced / fieldsTotal) * 100)}%</b><span>fields sourced</span></div><div><b>${doc.built.slice(0, 7)}</b><span>labels read</span></div>`;
      renderGroups(); renderGrid();
    }).catch(() => { body.innerHTML = '<p class="muted">The drug data did not load. Try refreshing.</p>'; });

    ctx.quiz([
      { q: 'In a PLR format label, which section holds the doses?', choices: ['Section 2, Dosage and Administration', 'Section 6, Adverse Reactions', 'Section 12.3, Pharmacokinetics', 'Section 11, Description'], answer: 0, why: 'Section 2 is Dosage and Administration. 12.1 is Mechanism of Action and 12.3 is Pharmacokinetics.' },
      { q: 'A card says "Not stated in the FDA label" for onset. What does that mean?', choices: ['The drug has no onset', 'The label used here gives no onset value, so the lab does not invent one', 'The onset is secret', 'The drug was withdrawn'], answer: 1, why: 'Many labels, especially older ones, never give onset in clinical terms. Your course texts may; add them in your notes.' },
      { q: 'Where would you look in a label for what to do after an overdose, such as which antagonist to give?', choices: ['Section 10, Overdosage', 'Section 3, Dosage Forms', 'Section 8, Specific Populations', 'Section 16, How Supplied'], answer: 0, why: 'Overdosage (10) describes signs and management, and it is where opioid, benzodiazepine and heparin labels name their reversal agents.' },
    ]);
  },
};
