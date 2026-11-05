// Chapter 9: organs and systems. Where each organ sits, a level slider that lists what each vertebral level cuts through, and a find it drill.
import { THREE, Viewer, infoCard, dock, group, loadingNote, paths } from '../engine.js';
import { colorFor, organColor } from '../body.js';
import { describe } from '../facts.js';
import { findDrill } from '../drill.js';

const SYS = {
  all: { label: 'All', test: () => true },
  resp: { label: 'Respiratory', test: (it) => it.pack === 'organs' && it.cat === 'resp', note: 'Air enters the nose and mouth, passes the pharynx and larynx, then the trachea, which splits at the carina into the main bronchi. The right lung has three lobes and the left two, leaving room for the heart.' },
  dig: { label: 'Digestive', test: (it) => it.pack === 'organs' && it.cat === 'dig', note: 'A tube several metres long (around 9 metres measured after death, shorter in life because of muscle tone): oesophagus, stomach, duodenum, jejunum, ileum, colon and rectum, with the liver, gallbladder and pancreas pouring in bile and enzymes.' },
  urin: { label: 'Urinary', test: (it) => it.pack === 'organs' && it.cat === 'urinary', note: 'Two kidneys high on the back wall filter the blood. Ureters carry urine down to the bladder behind the pubic bone, and the urethra carries it out.' },
  endo: { label: 'Endocrine', test: (it) => (it.pack === 'organs' && (it.cat === 'endocrine' || /pancrea|thymus/i.test(it.name))) || it.thyroid, note: 'Glands that release hormones into the blood: pituitary, pineal, thyroid, adrenals, the islets in the pancreas, and the gonads. The thyroid is drawn as a simple shape because the source model does not include it.' },
  lymph: { label: 'Lymphatic and immune', test: (it) => it.pack === 'organs' && (it.cat === 'lymphatic' || /thymus|spleen/i.test(it.name)), note: 'The spleen filters blood, the thymus trains T cells in childhood. Lymph nodes and lymph vessels (not modelled here) drain tissue fluid back into the veins near the heart.' },
  circ: { label: 'Heart', test: (it) => it.pack === 'heart', note: 'The heart sits in the middle mediastinum, two thirds of it left of the midline, its apex at about the fifth intercostal space.' },
};

export default {
  mount(ctx) {
    const v = new Viewer(ctx, { minDist: 0.08 });
    const note = loadingNote(ctx);
    const C = ctx.colors;
    let org = null; let ghost = null; let ht = null; let htG = null; let P = null; let canal = []; let sys = 'all';
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Organs and systems</h2>'),
      ctx.h('<p class="lede">Organs are packed into three cavities: the skull, the chest and the abdominopelvic cavity, each one fitted round the others.</p>'),
      ctx.h(`<div class="card tip"><p>Organs work in <b>systems</b>. The respiratory system brings in oxygen, the digestive system brings in food, the urinary system clears waste from the blood and the endocrine glands send hormone messages.</p><p>Their position matters. Doctors find organs from the outside using bony landmarks: the vertebral levels, the ribs and the pelvis. The slider below moves a slice up the body and lists what it cuts through.</p></div>`),
      ctx.h('<div class="card try"><p>Choose a system below the model. Then drag <b>Slice level</b> from the pelvis up to the neck and read which organs appear at each vertebral level. Try L1: the transpyloric plane.</p></div>'),
    );
    const sysSeg = ctx.seg(Object.entries(SYS).map(([k, s]) => [k, s.label]), 'all', (k) => setSys(k));
    ctx.panel.append(sysSeg);
    const sysNote = ctx.h('<p class="small muted"></p>'); ctx.panel.append(sysNote);
    const lvl = ctx.slider({ label: 'Slice level', min: 0.85, max: 1.56, step: 0.002, value: 1.127, fmt: (y) => levelName(y), onInput: (y) => slice(y) });
    ctx.panel.append(lvl);
    const lvlList = ctx.h('<p class="small" style="min-height:42px"></p>'); ctx.panel.append(lvlList);
    const info = infoCard(ctx); ctx.panel.append(info);
    ctx.panel.append(ctx.h(`<details class="more"><summary>Landmarks worth knowing</summary><div>
      <p><b>T4 to T5</b> (sternal angle): the trachea splits, the aortic arch begins and ends. <b>T8</b>: the inferior vena cava passes the diaphragm. <b>T10</b>: the oesophagus passes. <b>T12</b>: the aorta passes.</p>
      <p><b>L1</b> (transpyloric plane, halfway between the top of the sternum and the pubic symphysis): the pylorus, the neck of the pancreas, the renal hila and the end of the spinal cord in many adults.</p>
      <p><b>Kidneys</b> lie from about T12 to L3, the right a little lower than the left. The <b>liver</b> fills the right upper quadrant under ribs 7 to 11. The <b>spleen</b> sits under left ribs 9 to 11. The <b>bladder</b> sits behind the pubic symphysis and rises into the abdomen when full.</p></div></details>`));
    ctx.panel.append(ctx.h(`<div class="card deep"><p>The four abdominal quadrants (split by vertical and horizontal lines through the umbilicus) are the everyday clinical map: right upper (liver, gallbladder), left upper (stomach, spleen), right lower (caecum, appendix) and left lower (sigmoid colon). Nine regions use two vertical midclavicular lines and the subcostal and intertubercular planes.</p>
      <p>Positions in this chapter are measured from the model: the slice lists every organ whose bounding box crosses the plane, and the level name comes from the vertebra whose canal centre is closest. Organs move up and down a few centimetres with breathing and posture, so landmarks are guides, not exact addresses. The lungs and liver come from BodyParts3D 3.0 and were moved into the 4.0 frame, so they can overlap neighbours slightly.</p></div>`));
    ctx.quiz([
      { q: 'Which lung has three lobes?', choices: ['Left', 'Right', 'Both'], answer: 1, why: 'The right lung has upper, middle and lower lobes. The left has two, with a notch for the heart.' },
      { q: 'At about which vertebral level do the kidneys sit?', choices: ['C7 to T2', 'T12 to L3', 'L5 to S2'], answer: 1, why: 'They lie high on the back wall of the abdomen, partly protected by the lower ribs.' },
      { q: 'Which of these is an endocrine gland?', choices: ['Adrenal gland', 'Gallbladder', 'Spleen'], answer: 0, why: 'The adrenal glands release cortisol, aldosterone and adrenaline into the blood.' },
    ]);

    const torso = new THREE.Box3(new THREE.Vector3(-0.2, 0.8, -0.14), new THREE.Vector3(0.2, 1.62, 0.14));
    const vg = group(ctx, 'View', [['front', 'Front'], ['side', 'Side'], ['back', 'Back']], (k) => v.frame(torso, { dir: k === 'side' ? [1, 0.05, 0.05] : k === 'back' ? [0, 0.05, -1] : [0, 0.05, 1], pad: 1.08 }));
    dock(ctx, [vg]);
    v.frame(torso, { dir: [0, 0.05, 1], pad: 1.08, dur: 0 });

    const thyroid = new THREE.Group(); v.root.add(thyroid);
    const thyItem = { name: 'Thyroid gland (drawn as a simple shape)', thyroid: true, info: 'Two lobes either side of the trachea joined by an isthmus over the 2nd to 4th tracheal rings, just below the cricoid cartilage. Makes thyroxine (T4), triiodothyronine (T3) and calcitonin. Not part of the source model, so drawn here as a simple shape at its usual place.' };
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.34), new THREE.MeshBasicMaterial({ color: C.c1, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }));
    plane.rotation.x = -Math.PI / 2; plane.add(new THREE.LineSegments(new THREE.EdgesGeometry(plane.geometry), new THREE.LineBasicMaterial({ color: C.c1, transparent: true, opacity: 0.8 })));
    v.root.add(plane); v.own(plane);

    function levelName(y) {
      if (!canal.length) return '';
      let best = canal[0];
      for (const c of canal) if (Math.abs(c[1][1] - y) < Math.abs(best[1][1] - y)) best = c;
      if (y < canal[canal.length - 1][1][1] - 0.03) return 'sacrum';
      const n = best[0].replace(' vertebra', '').replace(/^(\w+) (cervical|thoracic|lumbar)$/, (m, o, r) => `${r[0].toUpperCase()}${['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth'].indexOf(o) + 1}`);
      return n === 'Atlas' ? 'C1' : n === 'Axis' ? 'C2' : n;
    }
    function slice(y) {
      plane.position.set(0, y, 0);
      if (!org) return;
      const hits = [];
      for (const pv of [org, ht]) for (const it of pv.items) if (pv.vis[it.k] && it.box.min.y <= y && it.box.max.y >= y) hits.push(it.name.replace(/ cavity$/, ''));
      if (thyroid.visible && y > 1.43 && y < 1.485) hits.push('Thyroid gland');
      const uniq = [...new Set(hits.map((n) => (/bronchial tree/i.test(n) ? 'Bronchi' : /ileum|jejunum/i.test(n) ? n : n)))];
      lvlList.innerHTML = `<b>${levelName(y)}</b>: ${uniq.length ? ctx.esc(uniq.slice(0, 14).join(', ')) : 'no organs of this system at this level'}${uniq.length > 14 ? ', ...' : ''}`;
      v.dirty = true;
    }
    function setSys(k) {
      sys = k; const S = SYS[k];
      sysNote.textContent = S.note || 'Every organ in the model. Tap one to name it.';
      if (!org) return;
      const t = (it) => S.test(it);
      org.filter(t); ghost.filter((it) => !t(it));
      ht.filter(t); htG.filter((it) => !t(it));
      thyroid.visible = k === 'all' || k === 'endo';
      slice(lvl.value);
      v.labels = [];
    }

    Promise.all([
      v.addPack('skel', { color: () => 0xE6DCC6, opacity: 0.1, pickable: false }),
      v.addPack('organs', { key: 'org', color: colorFor.organs }),
      v.addPack('organs', { key: 'ghost', color: colorFor.organs, opacity: 0.12, pickable: false }),
      v.addPack('heart', { key: 'ht', color: colorFor.heart, filter: (it) => it.cat === 'heart' || it.cat === 'valve' }),
      v.addPack('heart', { key: 'htG', color: colorFor.heart, opacity: 0.12, pickable: false, filter: () => false }),
      paths(),
    ]).then(([sk, o, g, h, hg, pp]) => {
      note.done(); if (!o) return;
      org = o; ghost = g; ht = h; htG = hg; P = pp; canal = P.canal;
      // thyroid: two lobes and an isthmus around the trachea below the cricoid cartilage
      const cric = sk.item('Cricoid cartilage'); const tr = org.item('Trachea');
      if (cric && tr) {
        const top = cric.box.min.y; const cz = cric.center.z; const mat = new THREE.MeshStandardMaterial({ color: 0xC9A14A, roughness: 0.6 });
        for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), mat); l.scale.set(0.009, 0.022, 0.011); l.position.set(sx * 0.017, top - 0.016, cz + 0.004); l.userData.item = thyItem; thyroid.add(l); }
        const ist = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), mat); ist.scale.set(0.012, 0.006, 0.005); ist.position.set(0, top - 0.022, cz + 0.014); ist.userData.item = thyItem; thyroid.add(ist);
        v.own(thyroid);
      }
      const prev = v.extraPick;
      v.extraPick = (ray) => {
        const b = prev ? prev(ray) : null;
        if (!thyroid.visible) return b;
        const r = new THREE.Raycaster(); r.ray.copy(ray); const hh = r.intersectObjects(thyroid.children, false)[0];
        if (!hh) return b;
        const hit = { d: hh.distance, key: 'thyroid', item: thyItem, point: hh.point };
        return !b || hit.d < b.d ? hit : b;
      };
      setSys('all');
      const drill = findDrill(ctx, v, {
        key: 'organs', title: 'Find the organ', blurb: 'An organ is named. Tap it. Switch the system to All first.',
        pool: () => org.items.filter((it) => org.vis[it.k] && !/bronchial|bile|ear|eyeball|epiglottis|tongue|submandibular|sublingual|pineal|pituitary|urethra|left main|right main/i.test(it.name)).map((item) => ({ pv: org, item })),
      });
      info.after(drill.el);
      v.onPick = (hh) => {
        if (drill.handle(hh)) return;
        org.highlight(-1); ht.highlight(-1);
        if (!hh) { v.labels = []; return; }
        if (hh.pv) hh.pv.highlight(hh.item.k);
        const sysName = Object.entries(SYS).find(([k, s]) => k !== 'all' && (s.test({ ...hh.item, pack: hh.pv?.pack.name || 'organs' }) || (hh.item.thyroid && k === 'endo')))?.[1].label || '';
        info.set(hh.item.name, hh.item.info || describe(hh.item), sysName || 'Organ');
        v.labels = [{ pos: hh.point, text: hh.item.name, on: true }]; v.dirty = true;
      };
    }).catch((e) => { console.error(e); note.fail(); });
    slice(lvl.value);
    v.hover = (h) => h.item.name;
    void organColor;
  },
};
