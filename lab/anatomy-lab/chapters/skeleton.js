// Chapter 2: the skeleton. Axial and appendicular divisions, regions, tap to name, and a find it drill.
import { THREE, Viewer, infoCard, dock, group, loadingNote } from '../engine.js';
import { colorFor } from '../body.js';
import { describe } from '../facts.js';
import { findDrill } from '../drill.js';

const AXIAL = new Set(['cranial', 'facial', 'teeth', 'hyoid', 'spine', 'thorax', 'larynx']);
const isBone = (it) => !/disk|cartilage|tooth/i.test(it.name) && it.cat !== 'larynx' && it.cat !== 'teeth';
const REGION = {
  skull: { label: 'Skull', col: 0xA78BFA, test: (it) => ['cranial', 'facial', 'teeth'].includes(it.cat) },
  spine: { label: 'Vertebral column', col: 0x5EEAD4, test: (it) => it.cat === 'spine' },
  thorax: { label: 'Thorax', col: 0x60A5FA, test: (it) => it.cat === 'thorax' },
  girdles: { label: 'Girdles', col: 0xFB7185, test: (it) => it.cat === 'pelvis' || /clavicle|scapula/i.test(it.name) },
  upper: { label: 'Upper limb', col: 0xFBBF24, test: (it) => it.cat === 'upper' && !/clavicle|scapula/i.test(it.name) },
  lower: { label: 'Lower limb', col: 0xA3E635, test: (it) => it.cat === 'lower' },
};
const regionOf = (it) => Object.keys(REGION).find((k) => REGION[k].test(it)) || 'other';

export default {
  mount(ctx) {
    const v = new Viewer(ctx);
    const note = loadingNote(ctx);
    let mode = 'division';
    ctx.panel.append(
      ctx.h('<h2 class="k-h">The skeleton</h2>'),
      ctx.h('<p class="lede">About 206 bones hold you up, protect your organs, anchor your muscles and make your blood cells.</p>'),
      ctx.h(`<div class="card tip"><p>The skeleton splits into two parts. The <b>axial skeleton</b> is the central column: skull, vertebral column, ribs and sternum. It protects the brain, spinal cord, heart and lungs. The <b>appendicular skeleton</b> is everything attached to it: the shoulder and pelvic girdles and the limbs. It is built for movement.</p><p>Bones also store calcium and phosphate, and the red marrow inside flat bones and the ends of long bones makes around 2 million new red blood cells every second.</p></div>`),
      ctx.h('<div class="card try"><p>Switch the colours between <b>Divisions</b> and <b>Regions</b> below the model, then tap any bone to name it. When you are ready, start the find it drill and see how long a streak you can build.</p></div>'),
    );
    const info = infoCard(ctx); ctx.panel.append(info);
    const counts = ctx.h('<div class="stat"><div><b>80</b><span>Axial</span></div><div><b>126</b><span>Appendicular</span></div><div><b class="cm">0</b><span>In this model</span></div></div>');
    ctx.panel.append(counts);
    const key = ctx.h('<div class="anat-key"></div>'); ctx.panel.append(key);
    let drill = null;
    ctx.panel.append(ctx.h(`<details class="more"><summary>Counting to 206</summary><div>
      <p><b>Axial (80):</b> skull 22 (8 cranial, 14 facial), 6 ear ossicles, hyoid 1, vertebral column 26 (7 cervical, 12 thoracic, 5 lumbar, sacrum, coccyx), sternum 1 and 24 ribs.</p>
      <p><b>Appendicular (126):</b> each upper limb 32 (clavicle, scapula, humerus, radius, ulna, 8 carpals, 5 metacarpals, 14 phalanges) and each lower limb 31 (hip bone, femur, patella, tibia, fibula, 7 tarsals, 5 metatarsals, 14 phalanges).</p>
      <p>A newborn has around 270 to 300 bony pieces. Many fuse in childhood: the sacrum from five vertebrae, each hip bone from the ilium, ischium and pubis. Adults vary too: extra sesamoid bones, sutural bones in the skull, or a cervical rib.</p>
      <p>This model has no ear ossicles or coccyx, and counts the sesamoid bones of each foot as one piece, so its count is lower than 206.</p></div></details>`));
    ctx.panel.append(ctx.h(`<div class="card deep"><p>Bones are classified by shape: <b>long</b> (femur, phalanges), <b>short</b> (carpals), <b>flat</b> (skull vault, sternum, ribs, scapula), <b>irregular</b> (vertebrae, hip bone) and <b>sesamoid</b> (patella, which sits inside a tendon).</p>
      <p>A long bone has a shaft (diaphysis) of compact bone around a marrow cavity and two ends (epiphyses) of spongy bone capped with articular cartilage. In children the growth plate (physis) between them lets the bone lengthen; it closes in the late teens.</p>
      <p>Clinically, a fall on an outstretched hand classically breaks the distal radius or the scaphoid, and the femoral neck is the classic fracture of older people with osteoporosis.</p></div>`));

    ctx.quiz([
      { q: 'Which of these belongs to the axial skeleton?', choices: ['Clavicle', 'Sternum', 'Patella'], answer: 1, why: 'The sternum is part of the thorax, which is axial. The clavicle is part of the shoulder girdle, which is appendicular.' },
      { q: 'Which bone is the only bony link between the upper limb and the trunk?', choices: ['Scapula', 'Humerus', 'Clavicle'], answer: 2, why: 'The scapula is held on by muscles. The clavicle joins the sternum at the sternoclavicular joint.' },
      { q: 'Each hip bone is formed by the fusion of which three bones?', choices: ['Ilium, ischium and pubis', 'Ilium, sacrum and coccyx', 'Femur, pubis and ischium'], answer: 0, why: 'They meet in the acetabulum, the socket of the hip joint.' },
    ]);

    const full = new THREE.Box3(new THREE.Vector3(-0.33, 0, -0.14), new THREE.Vector3(0.33, 1.73, 0.14));
    v.frame(full, { dir: [0.18, 0.05, 1], pad: 1.06, dur: 0 });
    const mg = group(ctx, 'Colour', [['division', 'Divisions'], ['region', 'Regions'], ['plain', 'Plain']], (k) => { mode = k; recolor(); }, { value: 'division' });
    const vg = group(ctx, 'View', [['front', 'Front'], ['side', 'Side'], ['back', 'Back']], (k) => v.frame(full, { dir: k === 'side' ? [1, 0.05, 0.05] : k === 'back' ? [0, 0.05, -1] : [0.18, 0.05, 1], pad: 1.06 }));
    dock(ctx, [mg, vg]);

    let sk = null;
    const recolor = () => {
      if (!sk) return;
      if (mode === 'plain') sk.colorAll(colorFor.skel);
      else if (mode === 'division') sk.colorAll((it) => (!isBone(it) ? 0x8A9A9C : AXIAL.has(it.cat) ? 0x5EEAD4 : 0xFBBF24));
      else sk.colorAll((it) => (!isBone(it) ? 0x8A9A9C : REGION[regionOf(it)]?.col || 0xcccccc));
      key.innerHTML = mode === 'division' ? '<span><i style="background:#5EEAD4"></i>Axial</span><span><i style="background:#FBBF24"></i>Appendicular</span><span><i style="background:#8A9A9C"></i>Cartilage and teeth</span>'
        : mode === 'region' ? Object.values(REGION).map((r) => `<span><i style="background:#${r.col.toString(16).padStart(6, '0')}"></i>${r.label}</span>`).join('') : '';
    };
    v.addPack('skel', { color: colorFor.skel }).then((pv) => {
      note.done(); if (!pv) return;
      sk = pv; recolor();
      counts.querySelector('.cm').textContent = pv.items.filter(isBone).length;
      drill = findDrill(ctx, v, {
        key: 'skeleton', title: 'Find the bone', blurb: 'A bone is named. Tap it on the model. Turn the model if it is hidden.',
        pool: () => sk.items.filter((it) => isBone(it) && !/phalanx|sesamoid|cuneiform|metatarsal|metacarpal|vertebra|rib|trapez|lunate|triquetral|pisiform|capitate|hamate|nasal|lacrimal|palatine|concha|vomer|ethmoid/i.test(it.name)).map((item) => ({ pv: sk, item })),
        accept: (h, c) => h.item === c.item,
      });
      info.after(drill.el);
    }).catch((e) => { console.error(e); note.fail(); });

    v.hover = (h) => h.item.name;
    v.onPick = (h) => {
      if (drill && drill.handle(h)) return;
      if (!h) { sk?.highlight(-1); v.labels = []; return; }
      sk.highlight(h.item.k);
      const div = !isBone(h.item) ? (h.item.cat === 'teeth' ? 'Tooth' : 'Cartilage') : `${AXIAL.has(h.item.cat) ? 'Axial' : 'Appendicular'} · ${REGION[regionOf(h.item)]?.label || ''}`;
      info.set(h.item.name, describe(h.item), div);
      v.labels = [{ pos: h.point, text: h.item.name, on: true }];
    };
  },
};
