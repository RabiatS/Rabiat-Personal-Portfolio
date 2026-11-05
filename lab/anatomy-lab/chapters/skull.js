// Chapter 3: the skull. Cranial and facial bones, sutures, foramina in 3D and on a cranial base map, and an exploded view.
import { THREE, Viewer, infoCard, dock, group, loadingNote, paths, tube } from '../engine.js';
import { colorFor } from '../body.js';
import { describe } from '../facts.js';

const SKULL = new Set(['cranial', 'facial', 'teeth']);
const SUT = {
  coronal: ['Coronal suture', 'Between the frontal bone and the two parietal bones. Crosses the top of the head from side to side, like a headband.'],
  sagittal: ['Sagittal suture', 'Between the two parietal bones, along the midline. Where it meets the coronal suture is bregma, the site of the anterior fontanelle in a baby.'],
  lambdoid: ['Lambdoid suture', 'Between the parietal bones and the occipital bone, shaped like the Greek letter lambda. Its meeting with the sagittal suture is lambda, the posterior fontanelle.'],
  squamous: ['Squamous suture', 'Between the temporal and parietal bones, an overlapping, scale like joint on the side of the head. Pterion, where four bones meet nearby, overlies the middle meningeal artery.'],
};
// What passes through each opening. 3D markers use positions found where the nerve or vessel meets the bone in this model.
const HOLES = {
  cribriform: { name: 'Cribriform plate', what: 'Olfactory nerve fibres (CN I)', base: [200, 92] },
  optic: { name: 'Optic canal', what: 'Optic nerve (CN II) and ophthalmic artery', base: [176, 150], base2: [224, 150] },
  sof: { name: 'Superior orbital fissure', what: 'Oculomotor (III), trochlear (IV), ophthalmic division of trigeminal (V1) and abducens (VI) nerves, superior ophthalmic vein', base: [150, 160], base2: [250, 160] },
  rotundum: { name: 'Foramen rotundum', what: 'Maxillary nerve (V2)', base: [150, 182], base2: [250, 182] },
  ovale: { name: 'Foramen ovale', what: 'Mandibular nerve (V3)', base: [140, 204], base2: [260, 204] },
  spinosum: { name: 'Foramen spinosum', what: 'Middle meningeal artery', base: [128, 214], base2: [272, 214] },
  lacerum: { name: 'Foramen lacerum', what: 'Closed by cartilage in life. The internal carotid artery runs across its top', base: [172, 214], base2: [228, 214] },
  carotid: { name: 'Carotid canal', what: 'Internal carotid artery with its sympathetic plexus', base: [160, 226], base2: [240, 226] },
  iam: { name: 'Internal acoustic meatus', what: 'Facial (VII) and vestibulocochlear (VIII) nerves, labyrinthine artery', base: [132, 248], base2: [268, 248] },
  jugular: { name: 'Jugular foramen', what: 'Glossopharyngeal (IX), vagus (X) and accessory (XI) nerves, internal jugular vein', base: [142, 282], base2: [258, 282] },
  hypoglossal: { name: 'Hypoglossal canal', what: 'Hypoglossal nerve (XII)', base: [163, 302], base2: [237, 302] },
  magnum: { name: 'Foramen magnum', what: 'Medulla joining the spinal cord, vertebral arteries, spinal roots of the accessory nerve (XI)', base: [200, 318] },
  supraorb: { name: 'Supraorbital notch', what: 'Supraorbital nerve and vessels (from V1), to the forehead skin' },
  infraorb: { name: 'Infraorbital foramen', what: 'Infraorbital nerve (from V2), to the cheek and upper lip' },
  mental: { name: 'Mental foramen', what: 'Mental nerve (from V3), to the chin and lower lip' },
};

export default {
  mount(ctx) {
    const v = new Viewer(ctx, { minDist: 0.08 });
    const note = loadingNote(ctx);
    const C = ctx.colors;
    ctx.panel.append(
      ctx.h('<h2 class="k-h">The skull</h2>'),
      ctx.h('<p class="lede">Twenty two bones, locked together, with a door for every nerve and vessel that needs to get in or out.</p>'),
      ctx.h(`<div class="card tip"><p>The skull has two parts. The <b>cranium</b> (neurocranium) is the box around the brain: 8 bones, the frontal, two parietals, two temporals, the occipital, the sphenoid and the ethmoid. The <b>face</b> (viscerocranium) has 14: two each of maxilla, zygomatic, nasal, lacrimal, palatine and inferior nasal concha, plus the vomer and the mandible.</p><p>Apart from the mandible, the bones are joined by <b>sutures</b>, wavy fibrous joints that barely move in adults. Holes called <b>foramina</b> let cranial nerves and blood vessels through.</p></div>`),
      ctx.h('<div class="card try"><p>Drag <b>Explode</b> to pull the bones apart, then tap each one. Switch on <b>Sutures</b> and look from the top and the back. Then open the <b>Base map</b> and tap each hole to see what passes through it.</p></div>'),
    );
    const info = infoCard(ctx); ctx.panel.append(info);
    const ex = ctx.slider({ label: 'Explode', min: 0, max: 1, step: 0.01, value: 0, fmt: (x) => `${Math.round(x * 100)}%`, onInput: (k) => explode(k) });
    ctx.panel.append(ex);
    const showRow = ctx.h('<div class="row"></div>');
    const colSeg = ctx.seg([['group', 'Cranial and facial'], ['bone', 'Bone colour']], 'group', (k) => recolor(k));
    showRow.append(colSeg); ctx.panel.append(showRow);
    ctx.panel.append(ctx.h('<div class="anat-key"><span><i style="background:#8FB3E6"></i>Cranial</span><span><i style="background:#F0C67A"></i>Facial</span><span><i style="background:#FBBF24"></i>Sutures</span><span><i style="background:#5EEAD4"></i>Foramina</span></div>'));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Fontanelles and growth</summary><div>
      <p>At birth the skull bones are separate plates joined by membrane. The soft spots are fontanelles. The <b>anterior fontanelle</b> (diamond shaped, at bregma) usually closes by about 18 months, the <b>posterior</b> (at lambda) within the first few months. A sunken fontanelle can be a sign of dehydration and a bulging one of raised pressure inside the skull.</p>
      <p>Early fusion of a suture (craniosynostosis) stops growth across it, so the skull grows in a distorted shape.</p></div></details>`));
    ctx.panel.append(ctx.h(`<div class="card deep"><p><b>Pterion</b>, on the side of the head where the frontal, parietal, temporal and sphenoid bones meet, is the thinnest part of the skull wall. The anterior branch of the middle meningeal artery runs just inside it, so a blow here can tear the artery and cause an extradural haematoma: a lucid interval, then rapid decline.</p>
      <p>The <b>foramen magnum</b> sits at the base of the occipital bone. If pressure inside the skull rises, the cerebellar tonsils can be pushed down through it (coning), compressing the medulla and its breathing centres.</p>
      <p>The three facial foramina (supraorbital, infraorbital, mental) sit roughly on one vertical line on each side, one for each division of the trigeminal nerve. They are used to place nerve blocks.</p></div>`));
    ctx.quiz([
      { q: 'Which suture lies between the frontal and parietal bones?', choices: ['Sagittal', 'Coronal', 'Lambdoid'], answer: 1, why: 'The coronal suture runs across the top like a headband, between the frontal and the two parietal bones.' },
      { q: 'The maxillary nerve (V2) leaves the skull through the...', choices: ['Foramen ovale', 'Foramen rotundum', 'Foramen spinosum'], answer: 1, why: 'V1 through the superior orbital fissure, V2 through the foramen rotundum, V3 through the foramen ovale. "Standing Room Only" is a common memory aid.' },
      { q: 'Which is a facial bone rather than a cranial bone?', choices: ['Sphenoid', 'Ethmoid', 'Zygomatic'], answer: 2, why: 'The zygomatic is a facial bone. The sphenoid and ethmoid are cranial bones.' },
    ]);

    // Stage controls
    const SK = new THREE.Box3(new THREE.Vector3(-0.08, 1.48, -0.11), new THREE.Vector3(0.08, 1.72, 0.1));
    const views = { front: [0, 0.05, 1], side: [1, 0.05, 0.05], top: [0, 1, 0.12], back: [0, 0.1, -1], base: [0, -1, 0.15] };
    const vg = group(ctx, 'View', [['front', 'Front'], ['side', 'Side'], ['top', 'Top'], ['back', 'Back'], ['base', 'Below']], (k) => v.frame(SK, { dir: views[k], pad: 1.18 }));
    const tg = group(ctx, '', [['sut', 'Sutures'], ['for', 'Foramina'], ['see', 'See through'], ['map', 'Base map']], (k, b) => {
      if (k === 'sut') { showSut = !showSut; b.classList.toggle('on', showSut); refresh(); }
      if (k === 'for') { showFor = !showFor; b.classList.toggle('on', showFor); refresh(); }
      if (k === 'map') { mapOn = !mapOn; b.classList.toggle('on', mapOn); svgHost.hidden = !mapOn; v.renderer.domElement.style.visibility = mapOn ? 'hidden' : ''; v.ov.el.style.visibility = mapOn ? 'hidden' : ''; }
      if (k === 'see') { see = !see; b.classList.toggle('on', see); sk?.opacity(see ? 0.28 : 1); }
    }, { multi: true });
    dock(ctx, [vg, tg]);
    v.frame(SK, { dir: [0.45, 0.08, 1], pad: 1.18, dur: 0 });

    let showSut = false; let showFor = false; let mapOn = false; let see = false; let sk = null; let P = null;
    const sutG = new THREE.Group(); const forG = new THREE.Group(); v.root.add(sutG, forG);
    const forMarks = [];
    const center = new THREE.Vector3(0, 1.6, -0.005);

    function recolor(k) {
      if (!sk) return;
      if (k === 'bone') sk.colorAll(colorFor.skel);
      else sk.colorAll((it) => (it.cat === 'cranial' ? 0x8FB3E6 : it.cat === 'facial' ? 0xF0C67A : it.cat === 'teeth' ? 0xF4F0E6 : colorFor.skel(it)));
    }
    function explode(k) {
      if (!sk) return;
      sk.explode(k * 0.75);
      sutG.visible = showSut && k < 0.02; forG.visible = showFor && k < 0.02;
      if (k > 0.02) v.labels = v.labels.filter((l) => !l.hole);
      v.dirty = true;
    }
    function refresh() {
      sutG.visible = showSut && ex.value < 0.02; forG.visible = showFor && ex.value < 0.02;
      v.labels = v.labels.filter((l) => !l.hole);
      v.dirty = true;
    }

    Promise.all([v.addPack('skel', { color: colorFor.skel, filter: (it) => SKULL.has(it.cat) }), paths()]).then(([pv, pp]) => {
      note.done(); if (!pv) return;
      sk = pv; P = pp; recolor('group');
      // explode offsets: outward from the skull centre; teeth travel with their jaw
      const jaw = { upper: sk.item('Left maxilla'), lower: sk.item('Mandible') };
      sk.setOffsets((it) => {
        if (!SKULL.has(it.cat)) return null;
        let ref = it;
        if (it.cat === 'teeth') ref = /lower/i.test(it.name) ? jaw.lower : sk.item(/left/i.test(it.name) ? 'Left maxilla' : 'Right maxilla');
        const d = ref.center.clone().sub(center);
        if (/ethmoid|sphenoid|vomer|concha|palatine/i.test(ref.name)) d.multiplyScalar(1.2).add(new THREE.Vector3(0, -0.02, 0.01));
        d.multiplyScalar(1.1).add(d.clone().normalize().multiplyScalar(0.035));
        return [d.x, d.y, d.z];
      });
      // sutures
      for (const [k, list] of Object.entries(P.sutures)) for (const pts of list) { const t = tube(pts, 0.0011, C.c2, { emissive: 0.5 }); t.userData.suture = k; sutG.add(t); }
      // foramina markers from the model's own nerves and vessels
      const L = P.landmarks;
      const mk = (key, p) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.0026, 16, 12), new THREE.MeshBasicMaterial({ color: C.c1, depthTest: false, transparent: true, opacity: 0.95 }));
        m.renderOrder = 10;
        const hit = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 6), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
        hit.userData.hole = HOLES[key]; m.add(hit);
        m.position.set(...p); m.userData.hole = HOLES[key]; m.userData.own = true; forG.add(m); forMarks.push(m);
      };
      mk('magnum', L.foramen_magnum);
      for (const s of ['L', 'R']) { mk('optic', L[`optic_canal_${s}`]); mk('sof', L[`sof_${s}`]); mk('supraorb', L[`supraorb_${s}`]); mk('carotid', L[`carotid_canal_${s}`]); }
      // facial foramina from the bone surface: the most anterior surface point near a given height
      const surfAt = (item, x, y) => {
        const pos = sk.pack.geo.attributes.position.array; let best = null;
        for (let i = item.v0; i < item.v0 + item.nv; i++) {
          const px = pos[i * 3]; const py = pos[i * 3 + 1]; const pz = pos[i * 3 + 2];
          if (Math.abs(px - x) < 0.004 && Math.abs(py - y) < 0.004 && (!best || pz > best[2])) best = [px, py, pz];
        }
        return best;
      };
      for (const [s, sx] of [['L', 1], ['R', -1]]) {
        const so = L[`supraorb_${s}`];
        const mx = sk.item(sx > 0 ? 'Left maxilla' : 'Right maxilla');
        const io = surfAt(mx, so[0] - sx * 0.002, so[1] - 0.043); if (io) mk('infraorb', [io[0], io[1], io[2] + 0.0015]);
        const pm = sk.item(`${sx > 0 ? 'Left' : 'Right'} lower second secondary premolar tooth`);
        const mf = pm && surfAt(sk.item('Mandible'), pm.center.x + sx * 0.004, pm.center.y - 0.012); if (mf) mk('mental', [mf[0], mf[1], mf[2] + 0.0015]);
      }
      sutG.visible = false; forG.visible = false;
      v.own(sutG); v.own(forG); v.dirty = true;
    }).catch((e) => { console.error(e); note.fail(); });

    // Picking: bones, sutures and foramina markers
    v.extraPick = (ray) => {
      const rc = new THREE.Raycaster(); rc.ray.copy(ray); rc.params.Line = { threshold: 0.002 };
      const objs = [...(sutG.visible ? sutG.children : []), ...(forG.visible ? forG.children : [])];
      const hit = rc.intersectObjects(objs, true)[0];
      if (!hit) return null;
      const o = hit.object;
      if (o.userData.hole) return { d: hit.distance - 0.05, key: 'hole', item: { name: o.userData.hole.name, info: `Passes through: ${o.userData.hole.what}.` }, point: o.getWorldPosition(new THREE.Vector3()) };
      const s = SUT[o.userData.suture]; return { d: hit.distance - 0.005, key: 'suture', item: { name: s[0], info: s[1] }, point: hit.point };
    };
    v.hover = (h) => h.item.name;
    v.onPick = (h) => {
      sk?.highlight(-1);
      v.labels = v.labels.filter((l) => l.hole);
      if (!h) return;
      if (h.pv) sk.highlight(h.item.k);
      const eb = h.key === 'hole' ? 'Foramen' : h.key === 'suture' ? 'Suture' : h.item.cat === 'cranial' ? 'Cranial bone' : h.item.cat === 'facial' ? 'Facial bone' : h.item.cat === 'teeth' ? 'Tooth' : 'Bone';
      info.set(h.item.name, describe(h.item), eb);
      if (h.key !== 'hole') v.labels.push({ pos: h.point, text: h.item.name, on: true });
      v.dirty = true;
    };

    // Cranial base map: a labelled diagram of the floor of the skull seen from above
    const svgHost = ctx.h('<div style="position:absolute;inset:0;z-index:3;display:grid;place-items:center" hidden></div>');
    ctx.stage.append(svgHost);
    const dot = (key, [x, y]) => `<g class="hole" data-k="${key}" style="cursor:pointer"><circle cx="${x}" cy="${y}" r="${key === 'magnum' ? 24 : key === 'cribriform' ? 9 : 6}" fill="rgba(94,234,212,.18)" stroke="#5EEAD4" stroke-width="1.4"/></g>`;
    let holes = '';
    for (const [k, hh] of Object.entries(HOLES)) {
      if (!hh.base) continue; holes += dot(k, hh.base); if (hh.base2) holes += dot(k, hh.base2);
      const [x, y] = hh.base2 ? hh.base2 : hh.base; const lx = hh.base2 ? x + 12 : x + (k === 'magnum' ? 30 : 14);
      holes += `<text x="${lx}" y="${y + 3}" style="font-size:7.5px;fill:#A0A09A;pointer-events:none">${hh.name.replace('Foramen ', 'F. ').replace('Superior orbital fissure', 'Sup. orbital fissure').replace('Internal acoustic meatus', 'Int. acoustic meatus')}</text>`;
    }
    svgHost.innerHTML = `<svg class="anat-svg" viewBox="0 0 400 400" role="img" aria-label="Diagram of the cranial base seen from above, with its foramina" style="max-width:min(100%,560px);max-height:100%;font-size:9px">
      <ellipse cx="200" cy="205" rx="150" ry="178" fill="#141414" stroke="#3A3A38" stroke-width="2"/>
      <path d="M86 140 Q200 108 314 140" fill="none" stroke="#5A5A55" stroke-width="1.5"/>
      <path d="M92 236 Q150 236 182 200 M308 236 Q250 236 218 200" fill="none" stroke="#5A5A55" stroke-width="1.5"/>
      <path d="M100 248 L176 214 M300 248 L224 214" fill="none" stroke="#7A7A72" stroke-width="5" stroke-linecap="round" opacity=".55"/>
      <rect x="186" y="170" width="28" height="24" rx="10" fill="none" stroke="#5A5A55" stroke-width="1.4"/>
      <text x="200" y="64" text-anchor="middle">anterior fossa</text>
      <text x="96" y="186" text-anchor="middle">middle fossa</text>
      <text x="200" y="372" text-anchor="middle">posterior fossa</text>
      <text x="200" y="186" text-anchor="middle" style="font-size:8px">sella</text>
      <text x="96" y="268" text-anchor="middle" style="font-size:8px">petrous ridge</text>
      <rect x="195" y="78" width="10" height="28" rx="4" fill="none" stroke="#5A5A55" stroke-width="1"/>
      ${holes}
      <text x="200" y="396" text-anchor="middle" style="font-size:8px;fill:#A0A09A">Diagram, not to scale. Front of the head at the top. Tap a hole.</text>
    </svg>`;
    svgHost.querySelectorAll('.hole').forEach((g) => g.addEventListener('click', () => {
      const hh = HOLES[g.dataset.k];
      svgHost.querySelectorAll('.hole circle').forEach((c) => c.setAttribute('fill', 'rgba(94,234,212,.18)'));
      svgHost.querySelectorAll(`.hole[data-k="${g.dataset.k}"] circle`).forEach((c) => c.setAttribute('fill', '#5EEAD4'));
      info.set(hh.name, `Passes through: ${hh.what}.`, 'Foramen');
    }, { signal: ctx.signal }));
  },
};
