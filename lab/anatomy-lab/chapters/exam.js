// Chapter 11: mock exam. Ten mixed questions across systems: find it on the model, name the lit structure, or a short fact question.
// Progress (best score, per system accuracy, recent rounds) is kept with ctx.store.
import { THREE, Viewer, dock, group, loadingNote } from '../engine.js';
import { colorFor } from '../body.js';

const SYSTEMS = {
  bones: { label: 'Skeleton', pack: 'skel', pick: (it) => !/disk|cartilage|tooth|phalanx|sesamoid|cuneiform|metatarsal|metacarpal|trapez|lunate|triquetral|pisiform|capitate|hamate|nasal|lacrimal|palatine|concha|vomer|ethmoid|vertebra|rib|gingiva/i.test(it.name) && !['cranial', 'facial', 'teeth', 'larynx'].includes(it.cat) },
  skull: { label: 'Skull', pack: 'skel', pick: (it) => ['cranial', 'facial'].includes(it.cat) && !/concha|palatine|vomer|lacrimal/i.test(it.name) },
  organs: { label: 'Organs', pack: 'organs', pick: (it) => !/bronchial|bile|ear|eyeball|epiglottis|submandibular|sublingual|pineal|urethra|main bronchus|tongue/i.test(it.name) },
  vessels: { label: 'Vessels', pack: 'vessels', pick: (it) => /^(ascending aorta|arch of aorta|abdominal aorta|pulmonary trunk|superior vena cava|inferior vena cava|(left|right) (common carotid artery|internal jugular vein|subclavian artery|femoral artery|femoral vein|common iliac artery|renal artery|renal vein|brachial artery|radial artery|great saphenous vein|popliteal artery))$/i.test(it.name) },
  brain: { label: 'Brain', pack: 'brain', pick: (it) => /^(cerebellum|pons|medulla oblongata|corpus callosum|(left|right) (precentral gyrus|postcentral gyrus|occipital lobe|superior frontal gyrus|superior temporal gyrus|thalamus|insula|hippocampus|cingulate gyrus))$/i.test(it.name) },
};
const FACTS = [
  { sys: 'Nerves', q: 'Which nerve passes through the carpal tunnel?', c: ['Ulnar nerve', 'Median nerve', 'Radial nerve', 'Musculocutaneous nerve'], a: 1 },
  { sys: 'Nerves', q: 'The foot drop after a fibular neck fracture is from injury to the...', c: ['Tibial nerve', 'Femoral nerve', 'Common fibular nerve', 'Obturator nerve'], a: 2 },
  { sys: 'Nerves', q: 'C3, C4 and C5 supply the...', c: ['Diaphragm', 'Deltoid', 'Biceps', 'Trapezius only'], a: 0 },
  { sys: 'Pain', q: 'The T10 dermatome lies at the level of the...', c: ['Nipple', 'Xiphoid', 'Umbilicus', 'Groin'], a: 2 },
  { sys: 'Pain', q: 'Early appendicitis pain is usually felt...', c: ['Around the umbilicus', 'In the right shoulder', 'In the left iliac fossa', 'In the back'], a: 0 },
  { sys: 'Pain', q: 'Pain and temperature fibres ascend in the...', c: ['Dorsal columns', 'Spinothalamic tract', 'Corticospinal tract', 'Optic tract'], a: 1 },
  { sys: 'Pain', q: 'Gallbladder pain that reaches the shoulder is felt on the...', c: ['Left shoulder', 'Right shoulder', 'Both hands', 'Jaw'], a: 1 },
  { sys: 'Skull', q: 'The mandibular nerve (V3) leaves the skull through the...', c: ['Foramen rotundum', 'Foramen ovale', 'Foramen spinosum', 'Optic canal'], a: 1 },
  { sys: 'Skull', q: 'The middle meningeal artery enters through the...', c: ['Foramen spinosum', 'Jugular foramen', 'Foramen magnum', 'Carotid canal'], a: 0 },
  { sys: 'Skull', q: 'Cranial nerves IX, X and XI leave through the...', c: ['Internal acoustic meatus', 'Hypoglossal canal', 'Jugular foramen', 'Superior orbital fissure'], a: 2 },
  { sys: 'Heart', q: 'The mitral valve lies between the...', c: ['Right atrium and right ventricle', 'Left atrium and left ventricle', 'Left ventricle and aorta', 'Right ventricle and pulmonary trunk'], a: 1 },
  { sys: 'Heart', q: 'Which vessel carries oxygen poor blood to the lungs?', c: ['Pulmonary vein', 'Aorta', 'Pulmonary artery', 'Superior vena cava'], a: 2 },
  { sys: 'Joints', q: 'The knee and elbow are mainly...', c: ['Hinge joints', 'Pivot joints', 'Saddle joints', 'Plane joints'], a: 0 },
  { sys: 'Joints', q: 'The intervertebral discs form which kind of joint?', c: ['Fibrous', 'Secondary cartilaginous', 'Synovial ball and socket', 'Gomphosis'], a: 1 },
  { sys: 'Organs', q: 'The transpyloric plane is at about the level of...', c: ['T4', 'T10', 'L1', 'L4'], a: 2 },
  { sys: 'Organs', q: 'Inhaled objects most often lodge in the...', c: ['Left main bronchus', 'Right main bronchus', 'Oesophagus', 'Left upper lobe'], a: 1 },
  { sys: 'Bodies', q: 'On average, the subpubic angle is wider in...', c: ['Males', 'Females', 'Neither, it is fixed', 'Children only'], a: 1 },
  { sys: 'Bodies', q: 'Which structure is homologous to the penis?', c: ['Clitoris', 'Labia majora', 'Ovary', 'Uterus'], a: 0 },
];

export default {
  mount(ctx) {
    const v = new Viewer(ctx, { minDist: 0.08 });
    const note = loadingNote(ctx);
    const C = ctx.colors;
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Mock exam</h2>'),
      ctx.h('<p class="lede">Ten mixed questions, the way a practical anatomy exam (a spot test) asks them: find it, name it, or explain it.</p>'),
      ctx.h('<div class="card tip"><p>Three kinds of question come up. <b>Find it</b>: a structure is named and you tap it on the model (two tries). <b>Name it</b>: a structure lights up and you pick its name. <b>Explain it</b>: a short fact from the chapters. Your best score and how you do in each system are saved in this browser.</p></div>'),
      ctx.h('<div class="card try"><p>Press <b>Start</b>. Turn and zoom the model freely, it is part of the test. If a system keeps tripping you up, go back to that chapter, then try again.</p></div>'),
    );
    const card = ctx.h(`<div class="card"><div class="row"><span class="eyebrow ek">Ready</span><span style="flex:1"></span><span class="eyebrow es"></span></div>
      <div class="bar"><span class="eb" style="width:0%"></span></div>
      <p class="eq anat-big" style="margin:4px 0">Ten questions across every system.</p>
      <div class="choices ec"></div><p class="small ef"></p>
      <div class="row"><button class="btn sm go">Start</button><button class="btn ghost sm nx" hidden>Next</button></div></div>`);
    ctx.panel.append(card);
    const statsEl = ctx.h('<div class="card"><h3>Your record</h3><div class="sr small"></div></div>');
    ctx.panel.append(statsEl);
    ctx.panel.append(ctx.h(`<div class="card deep"><p>Practical exams reward three habits: name the side (left or right), use the full term (superior mesenteric artery, not just mesenteric), and orientate the specimen before you answer by finding a landmark you know. Spaced practice beats cramming: a few short rounds over several days fix names far better than one long session.</p></div>`));
    ctx.quiz([
      { q: 'In a spot test, which answer is most complete?', choices: ['Artery', 'Carotid', 'Left common carotid artery'], answer: 2, why: 'Side, full name and type of structure.' },
      { q: 'Which is a sensible first step with an unfamiliar specimen?', choices: ['Guess quickly', 'Orientate it using a landmark you know', 'Skip it'], answer: 1, why: 'Working out superior, anterior and side first narrows the options.' },
      { q: 'Which study pattern fixes anatomy names best?', choices: ['One long session the night before', 'Short rounds spread over several days', 'Reading the list once'], answer: 1, why: 'Spaced retrieval practice is one of the best supported findings in learning research.' },
    ]);

    const full = new THREE.Box3(new THREE.Vector3(-0.34, 0, -0.15), new THREE.Vector3(0.34, 1.73, 0.15));
    const vg = group(ctx, 'View', [['front', 'Front'], ['side', 'Side'], ['back', 'Back'], ['all', 'Whole body']], (k) => {
      const b = curBox || full; v.frame(k === 'all' ? full : b, { dir: k === 'side' ? [1, 0.05, 0.05] : k === 'back' ? [0, 0.05, -1] : [0.15, 0.05, 1], pad: k === 'all' ? 1.06 : 1.3 });
    });
    dock(ctx, [vg]);
    v.frame(full, { dir: [0.15, 0.05, 1], pad: 1.06, dur: 0 });
    let curBox = null;

    const packs = {};
    const stats = ctx.store.get('exam:stats', { best: null, rounds: [], sys: {} });
    function renderStats() {
      const rows = Object.entries(stats.sys).sort().map(([k, s]) => `<div class="row" style="gap:6px"><span style="width:84px">${ctx.esc(k)}</span><div class="bar" style="flex:1"><span style="width:${Math.round(s.r / s.t * 100)}%;background:${s.r / s.t >= 0.7 ? 'var(--ok)' : 'var(--c2)'}"></span></div><span class="mono muted">${s.r}/${s.t}</span></div>`).join('');
      statsEl.querySelector('.sr').innerHTML = `${stats.best != null ? `<p>Best round: <b>${stats.best} of 10</b>. Recent: ${stats.rounds.slice(-5).join(', ')}</p>` : '<p class="muted">No rounds yet.</p>'}<div style="display:grid;gap:4px;margin-top:6px">${rows}</div>`;
    }
    renderStats();

    let qs = []; let qi = 0; let score = 0; let cur = null; let tries = 0; let locked = false;
    const qEl = card.querySelector('.eq'); const cEl = card.querySelector('.ec'); const fEl = card.querySelector('.ef');
    const kEl = card.querySelector('.ek'); const sEl = card.querySelector('.es'); const bar = card.querySelector('.eb');
    const go = card.querySelector('.go'); const nx = card.querySelector('.nx');

    function makeRound() {
      const out = []; const kinds = ['find', 'name', 'find', 'name', 'fact', 'find', 'name', 'fact', 'find', 'fact'].sort(() => Math.random() - 0.5);
      const sysKeys = Object.keys(SYSTEMS); const facts = [...FACTS].sort(() => Math.random() - 0.5);
      for (const kind of kinds) {
        if (kind === 'fact') { out.push({ kind, f: facts.pop() }); continue; }
        const sk = sysKeys[Math.floor(Math.random() * sysKeys.length)]; const S = SYSTEMS[sk]; const pv = packs[S.pack];
        const pool = pv.items.filter(S.pick);
        const it = pool[Math.floor(Math.random() * pool.length)];
        out.push({ kind, sk, pv, it, pool });
      }
      return out;
    }
    function focus(q) {
      for (const [k, pv] of Object.entries(packs)) {
        const mine = q && q.pv === pv;
        pv.highlight(-1);
        if (k === 'skel') pv.opacity(mine ? 1 : 0.12);
        else pv.opacity(mine ? 1 : 0.0);
        pv.pickable = mine;
        if (mine) pv.filter((it) => (q.sk === 'skull' ? ['cranial', 'facial', 'teeth'].includes(it.cat) : true));
      }
      if (q && q.it) {
        const b = q.sk === 'bones' ? full.clone() : q.it.box.clone().expandByScalar(q.sk === 'vessels' ? 0.12 : 0.08);
        if (q.sk === 'skull' || q.sk === 'brain') b.copy(new THREE.Box3(new THREE.Vector3(-0.09, 1.47, -0.11), new THREE.Vector3(0.09, 1.73, 0.1)));
        if (q.sk === 'organs') b.copy(new THREE.Box3(new THREE.Vector3(-0.2, 0.8, -0.14), new THREE.Vector3(0.2, 1.62, 0.14)));
        curBox = b; v.frame(b, { dir: [0.15, 0.05, 1], pad: q.sk === 'bones' ? 1.06 : 1.25 });
      }
      v.labels = []; v.dirty = true;
    }
    function ask() {
      cur = qs[qi]; tries = 0; locked = false; nx.hidden = true; fEl.textContent = ''; cEl.innerHTML = '';
      bar.style.width = `${qi * 10}%`; sEl.textContent = `${score} right`;
      const S = cur.sk ? SYSTEMS[cur.sk] : null;
      kEl.textContent = `Question ${qi + 1} of 10 · ${cur.kind === 'find' ? 'Find it' : cur.kind === 'name' ? 'Name it' : 'Explain it'} · ${S ? S.label : cur.f.sys}`;
      if (cur.kind === 'fact') {
        focus(null);
        qEl.textContent = cur.f.q; qEl.style.fontSize = '18px';
        cEl.innerHTML = cur.f.c.map((c, i) => `<button class="choice" data-i="${i}">${ctx.esc(c)}</button>`).join('');
        cEl.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => answer(+b.dataset.i === cur.f.a, b, cur.f.c[cur.f.a])));
      } else if (cur.kind === 'find') {
        focus(cur); qEl.style.fontSize = '';
        qEl.textContent = `Find the ${cur.it.name.toLowerCase()}`;
        fEl.textContent = 'Tap it on the model. Two tries.';
      } else {
        focus(cur); qEl.style.fontSize = '';
        qEl.textContent = 'Name the lit structure';
        cur.pv.highlight(cur.it.k);
        v.labels = [{ pos: cur.pv.worldCenter(cur.it), text: '?', color: C.c1, on: true }];
        const near = cur.pool.filter((x) => x !== cur.it).sort((a, b) => a.center.distanceTo(cur.it.center) - b.center.distanceTo(cur.it.center)).slice(0, 8).sort(() => Math.random() - 0.5);
        const names = [...new Set([cur.it.name, ...near.map((x) => x.name)])].slice(0, 4).sort(() => Math.random() - 0.5);
        cEl.innerHTML = names.map((n) => `<button class="choice">${ctx.esc(n)}</button>`).join('');
        cEl.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => answer(b.textContent === cur.it.name, b, cur.it.name)));
      }
    }
    function answer(ok, btn, correct) {
      if (locked) return; locked = true;
      if (btn) {
        cEl.querySelectorAll('.choice').forEach((x) => { x.disabled = true; if (x.textContent === correct) x.classList.add('right'); });
        if (!ok) btn.classList.add('wrong');
      }
      if (ok) score++;
      const sysName = cur.sk ? SYSTEMS[cur.sk].label : cur.f.sys;
      const s = (stats.sys[sysName] ||= { r: 0, t: 0 }); s.t++; if (ok) s.r++;
      fEl.textContent = ok ? 'Right.' : `It was the ${correct.toLowerCase()}.`;
      if (cur.it) { cur.pv.highlight(cur.it.k); v.labels = [{ pos: cur.pv.worldCenter(cur.it), text: cur.it.name, color: ok ? '#4ade80' : '#A78BFA', on: true }]; v.dirty = true; }
      sEl.textContent = `${score} right`;
      nx.hidden = false; nx.textContent = qi < 9 ? 'Next' : 'See result';
      ctx.store.set('exam:stats', stats); renderStats();
    }
    function finish() {
      bar.style.width = '100%'; focus(null); curBox = null; v.frame(full, { dir: [0.15, 0.05, 1], pad: 1.06 });
      stats.rounds.push(score); if (stats.rounds.length > 20) stats.rounds.shift();
      if (stats.best == null || score > stats.best) stats.best = score;
      ctx.store.set('exam:stats', stats); renderStats();
      if (score >= 7) ctx.done();
      kEl.textContent = 'Round complete'; qEl.textContent = `${score} of 10`; qEl.style.fontSize = '';
      cEl.innerHTML = ''; fEl.textContent = score >= 8 ? 'Excellent. You are ready for a spot test on these systems.' : score >= 5 ? 'Solid. Check the systems in amber in your record below.' : 'Keep going. Revisit the chapters for the systems you missed.';
      nx.hidden = true; go.hidden = false; go.textContent = 'New round';
      for (const pv of Object.values(packs)) { pv.opacity(pv.pack.name === 'skel' ? 1 : 0); pv.filter(() => true); }
    }
    go.addEventListener('click', () => { qs = makeRound(); qi = 0; score = 0; go.hidden = true; ask(); });
    nx.addEventListener('click', () => { qi++; if (qi >= 10) finish(); else ask(); });

    Promise.all([
      v.addPack('skel', { color: colorFor.skel }),
      v.addPack('organs', { color: colorFor.organs, opacity: 0 }),
      v.addPack('vessels', { color: colorFor.vessels, opacity: 0 }),
      v.addPack('brain', { color: colorFor.brain, opacity: 0 }),
    ]).then(([s, o, ve, b]) => {
      note.done(); if (!b) return;
      Object.assign(packs, { skel: s, organs: o, vessels: ve, brain: b });
    }).catch((e) => { console.error(e); note.fail(); });

    v.hover = (h) => (cur && cur.kind === 'find' && !locked ? null : h.item.name);
    v.onPick = (h) => {
      if (!cur || cur.kind !== 'find' || locked) {
        if (h && (!cur || locked)) { v.labels = [{ pos: h.point, text: h.item.name, on: true }]; v.dirty = true; }
        return;
      }
      if (!h) return;
      if (h.item === cur.it) { answer(tries === 0 || tries === 1, null, cur.it.name); return; }
      tries++;
      v.labels = [{ pos: h.point, text: `Not that: ${h.item.name.toLowerCase()}`, color: '#A78BFA' }]; v.dirty = true;
      if (tries >= 2) answer(false, null, cur.it.name);
      else fEl.textContent = 'Not that one. One more try.';
    };
  },
};
