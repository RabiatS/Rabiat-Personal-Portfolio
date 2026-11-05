// Chapter 5: the muscular layer on the full body, grouped by region, with a find it drill and links into Muscle Lab.
import { THREE, Viewer, infoCard, dock, group, loadingNote } from '../engine.js';
import { colorFor } from '../body.js';
import { describe, bareName } from '../facts.js';
import { findDrill } from '../drill.js';

// The 63 muscles that Muscle Lab teaches in depth
const ML = 'occipitofrontalis orbicularis_oculi orbicularis_oris nasalis zygomaticus_major zygomaticus_minor platysma risorius masseter temporalis buccinator sternocleidomastoid diaphragm external_intercostals internal_intercostals trapezius pectoralis_major pectoralis_minor rectus_abdominis external_oblique internal_oblique transversus_abdominis deltoid supraspinatus infraspinatus teres_minor subscapularis biceps_brachii triceps_brachii brachialis brachioradialis flexor_carpi_radialis palmaris_longus flexor_carpi_ulnaris extensor_digitorum extensor_digiti_minimi extensor_carpi_ulnaris gluteus_maximus gluteus_medius gluteus_minimus rectus_femoris vastus_medialis vastus_lateralis vastus_intermedius biceps_femoris semitendinosus semimembranosus sartorius psoas_major iliacus tensor_fasciae_latae iliotibial_tract gracilis tibialis_anterior fibularis_longus gastrocnemius soleus'.split(' ');
const mlKey = (n) => bareName(n).replace(/ muscle$/, '').replace(/\s+/g, '_');
const inML = (n) => { const k = mlKey(n); return ML.includes(k) || ML.includes(k.replace(/frontalis|occipitalis/, 'occipitofrontalis')) || (k === 'external_intercostal' && true); };

const REG = {
  head: { label: 'Head and neck', col: 0xA78BFA, re: /frontalis|occipitalis|orbicularis|nasalis|zygomaticus|platysma|risorius|masseter|temporalis|buccinator|sternocleidomastoid|levator labii|depressor|mentalis|procerus|corrugator|pterygoid|digastric|hyoid|scalen|longus (colli|capitis)|splenius|capitis|cervicis|pharyng|constrictor|temporoparietalis|levator anguli|thyro|crico|arytenoid|epicranius/i },
  trunk: { label: 'Chest and abdomen', col: 0x5EEAD4, re: /pectoralis|intercostal|rectus abdominis|oblique|transversus|pyramidalis|serratus anterior|subclavius|diaphragm|quadratus lumborum|linea alba|transversus thoracis/i },
  back: { label: 'Back', col: 0x60A5FA, re: /trapezius|latissimus|rhomboid|levator scapulae|erector|iliocostalis|longissimus|spinalis|multifidus|rotator|semispinalis|serratus posterior|interspinal|intertransvers|levatores costarum/i },
  arm: { label: 'Shoulder and arm', col: 0xFBBF24, re: /deltoid|supraspinatus|infraspinatus|teres|subscapularis|biceps brachii|triceps|brachialis|brachioradialis|coracobrachialis|anconeus|carpi|digitorum|pollicis|digiti minimi of (left|right) hand|palmaris|pronator|supinator|indicis|lumbrical(s)? of (left|right) hand|interossei of (left|right) hand|retinaculum/i },
  leg: { label: 'Hip and leg', col: 0xA3E635, re: /gluteus|piriformis|gemellus|obturator|quadratus femoris|psoas|iliacus|tensor fasciae|iliotibial|sartorius|rectus femoris|vastus|adductor|gracilis|pectineus|biceps femoris|semitendinosus|semimembranosus|tibialis|fibularis|gastrocnemius|soleus|plantaris|popliteus|hallucis|digitorum (longus|brevis)|of (left|right) foot|calcaneal|flexor accessorius|plantar/i },
  pelvic: { label: 'Pelvic floor', col: 0xFB7185, re: /levator ani|pubococcygeus|iliococcygeus|puborectalis|coccygeus|sphincter|perineal|bulbospongiosus|ischiocavernosus|tendinous arch/i },
};
const regionOf = (n) => Object.keys(REG).find((k) => REG[k].re.test(n)) || 'trunk';

export default {
  mount(ctx) {
    const v = new Viewer(ctx);
    const note = loadingNote(ctx);
    ctx.panel.append(
      ctx.h('<h2 class="k-h">The muscular layer</h2>'),
      ctx.h('<p class="lede">More than 600 skeletal muscles wrap the skeleton. Together they make up roughly a third to two fifths of body weight.</p>'),
      ctx.h(`<div class="card tip"><p>A skeletal muscle joins two bones across a joint. When it contracts it gets shorter and pulls the bones together. Muscles can only <b>pull</b>, never push, so they work in opposing pairs: the biceps bends the elbow, the triceps straightens it.</p><p>There are three kinds of muscle tissue. <b>Skeletal</b> muscle is the voluntary muscle shown here. <b>Cardiac</b> muscle is the heart wall. <b>Smooth</b> muscle lines the gut, airways and blood vessels and works without you thinking about it.</p></div>`),
      ctx.h(`<div class="card try"><p>Colour the muscles by region and turn the body round to see the back. Tap any muscle to name it. Muscles with a <span style="color:var(--c1)">Muscle Lab</span> tag have full origin, insertion and action cards there.</p><p><a class="btn ghost sm" href="../muscle-lab/" style="text-decoration:none">Open Muscle Lab ›</a></p></div>`),
    );
    const info = infoCard(ctx); ctx.panel.append(info);
    const key = ctx.h('<div class="anat-chips"></div>'); ctx.panel.append(key);
    const stat = ctx.h('<div class="stat"><div><b class="m1">0</b><span>Muscle pieces here</span></div><div><b>600+</b><span>In the body</span></div><div><b>63</b><span>In Muscle Lab</span></div></div>'); ctx.panel.append(stat);
    ctx.panel.append(ctx.h(`<details class="more"><summary>How muscles get their names</summary><div>
      <p>Muscle names are short descriptions in Latin. <b>Shape</b>: deltoid (triangle), trapezius, serratus (saw toothed). <b>Size</b>: maximus, minimus, longus, brevis. <b>Position</b>: tibialis anterior, supraspinatus (above the spine of the scapula). <b>Number of heads</b>: biceps, triceps, quadriceps. <b>Action</b>: flexor, extensor, adductor, levator. <b>Attachments</b>: sternocleidomastoid runs from sternum and clavicle to the mastoid process. <b>Fibre direction</b>: rectus (straight), oblique, transversus.</p></div></details>`));
    ctx.panel.append(ctx.h(`<div class="card deep"><p>The end of a muscle that stays still is its <b>origin</b> and the end that moves is its <b>insertion</b>. The muscle that does a movement is the <b>agonist</b> (prime mover), the one that opposes it the <b>antagonist</b>, and muscles that help or steady are <b>synergists</b> and <b>fixators</b>.</p>
      <p>Each muscle is supplied by a nerve from particular spinal levels (its myotome). That is why testing a few movements (for example elbow flexion C5 to C6, knee extension L3 to L4, ankle plantarflexion S1 to S2) tells a doctor which spinal level is injured. In one MRI study skeletal muscle averaged about 38 percent of body mass in adult men and about 31 percent in adult women, with wide individual variation.</p>
      <p>This model shows many muscles as several pieces (for example the parts of the deltoid). The pieces are grouped by name when you tap them.</p></div>`));
    ctx.quiz([
      { q: 'Muscles produce movement by...', choices: ['Pushing bones apart', 'Pulling bones together as they shorten', 'Rotating around their own axis'], answer: 1, why: 'Muscles only pull. Opposing muscles reverse the movement.' },
      { q: 'Which muscle is named after the number of its heads?', choices: ['Triceps brachii', 'Deltoid', 'Gluteus maximus'], answer: 0, why: 'Triceps means three heads. Deltoid is named for its triangle shape, gluteus maximus for its size and site.' },
      { q: 'Which type of muscle tissue lines the gut and blood vessels?', choices: ['Skeletal', 'Smooth', 'Cardiac'], answer: 1, why: 'Smooth muscle is involuntary and found in the walls of hollow organs and vessels.' },
    ]);

    const full = new THREE.Box3(new THREE.Vector3(-0.33, 0, -0.15), new THREE.Vector3(0.33, 1.73, 0.15));
    v.frame(full, { dir: [0.2, 0.05, 1], pad: 1.06, dur: 0 });
    let mode = 'region'; let mu = null; let sk = null;
    const hidden = new Set();
    const mg = group(ctx, 'Colour', [['region', 'Regions'], ['plain', 'Plain'], ['ml', 'In Muscle Lab']], (k) => { mode = k; recolor(); }, { value: 'region' });
    const vg = group(ctx, 'View', [['front', 'Front'], ['side', 'Side'], ['back', 'Back']], (k) => v.frame(full, { dir: k === 'side' ? [1, 0.05, 0.05] : k === 'back' ? [0, 0.05, -1] : [0.2, 0.05, 1], pad: 1.06 }));
    dock(ctx, [mg, vg]);
    const recolor = () => {
      if (!mu) return;
      if (mode === 'plain') mu.colorAll(colorFor.muscle);
      else if (mode === 'ml') mu.colorAll((it) => (inML(it.name) ? 0x5EEAD4 : 0x6A4A46));
      else mu.colorAll((it) => (it.cat === 'tendon' ? 0xD9CDB4 : REG[regionOf(it.name)].col));
    };
    for (const [k, r] of Object.entries(REG)) {
      const b = ctx.h(`<button class="chip on" style="border-color:#${r.col.toString(16).padStart(6, '0')}">${r.label}</button>`);
      b.addEventListener('click', () => { if (hidden.has(k)) hidden.delete(k); else hidden.add(k); b.classList.toggle('on', !hidden.has(k)); mu?.filter((it) => !hidden.has(regionOf(it.name))); });
      key.append(b);
    }
    key.append(ctx.h('<span class="hint" style="align-self:center">tap a region to hide it</span>'));

    let drill = null;
    Promise.all([v.addPack('skel', { color: colorFor.skel }), v.addPack('muscle', { color: colorFor.muscle })]).then(([s, m]) => {
      note.done(); if (!m) return;
      sk = s; mu = m; recolor();
      stat.querySelector('.m1').textContent = m.items.filter((it) => it.cat === 'muscle').length;
      drill = findDrill(ctx, v, {
        key: 'muscles', title: 'Find the muscle', blurb: 'Muscles from Muscle Lab, on either side. Turn the body if you need to.',
        pool: () => m.items.filter((it) => inML(it.name) && !/intercostal|transversus|internal oblique|intermedius|minimus|subscapularis|psoas|iliacus|buccinator|brachialis|supraspinatus|soleus|semimembranosus|pectoralis minor|diaphragm|nasalis|risorius/i.test(it.name)).map((item) => ({ pv: m, item })),
        accept: (h, c) => h.item === c.item || mlKey(h.item.name) === mlKey(c.item.name),
      });
      info.after(drill.el);
    }).catch((e) => { console.error(e); note.fail(); });

    v.hover = (h) => h.item.name;
    v.onPick = (h) => {
      if (drill && drill.handle(h)) return;
      mu?.highlight(-1); sk?.highlight(-1);
      if (!h) { v.labels = []; return; }
      h.pv.highlight(h.item.k);
      const isM = h.key === 'muscle';
      const tag = isM && inML(h.item.name) ? ' <a href="../muscle-lab/" style="color:var(--c1)">Open in Muscle Lab ›</a>' : '';
      info.set(h.item.name, `${ctx.esc(describe(h.item))}${tag}`, isM ? `Muscle · ${REG[regionOf(h.item.name)].label}` : 'Bone');
      v.labels = [{ pos: h.point, text: h.item.name, on: true }]; v.dirty = true;
    };
  },
};
