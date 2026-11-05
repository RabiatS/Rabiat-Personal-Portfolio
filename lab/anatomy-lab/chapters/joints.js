// Chapter 4: joints and movement. Six synovial joint types, each moved on real bones about a pivot found in the model.
import { THREE, Viewer, infoCard, dock, group, loadingNote, loadPack, itemGeometry, paths, reducedMotion } from '../engine.js';
import { colorFor } from '../body.js';
import { describe } from '../facts.js';

const HAND_L = /(left (scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|\w+ metacarpal bone))|of left (thumb|index finger|middle finger|ring finger|little finger)/i;
const FOOT_L = /(left (talus|calcaneus|cuboid bone|\w+ cuneiform bone|\w+ metatarsal bone))|navicular bone of left foot|sesamoid bone of left foot|of left (big toe|second toe|third toe|fourth toe|little toe)/i;
const SKULL = (it) => ['cranial', 'facial', 'teeth'].includes(it.cat) || it.name === 'Hyoid bone';

const JOINTS = {
  hinge: {
    title: 'Hinge', where: 'Elbow (humeroulnar joint)', pivot: 'elbow_L',
    fixed: (it) => /^left (humerus|scapula|clavicle)$/i.test(it.name),
    moving: (it) => /^left (ulna|radius)$/i.test(it.name) || HAND_L.test(it.name),
    motions: { flex: { label: 'Flexion', axis: [1, 0, 0], sign: -1, min: 0, max: 145, dir: [1, 0.1, 0.2], note: 'Normal range about 0 to 145 degrees.' } },
    text: 'One axis, like a door. The trochlea of the humerus sits in the trochlear notch of the ulna, so the elbow can only bend (flex) and straighten (extend). Strong collateral ligaments on each side stop sideways movement. Other hinges: the interphalangeal joints of fingers and toes.',
    box: [[0.13, 0.8, -0.1], [0.32, 1.42, 0.42]], dir: [1, 0.1, 0.2],
  },
  pivot: {
    title: 'Pivot', where: 'Atlantoaxial joint (C1 on C2)', pivot: 'dens',
    fixed: (it) => /^(axis|third cervical vertebra|fourth cervical vertebra|fifth cervical vertebra)$/i.test(it.name),
    moving: (it) => it.name === 'Atlas' || SKULL(it),
    motions: { rot: { label: 'Rotation', axis: [0, 1, 0], sign: 1, min: -40, max: 40, dir: [0.35, 0.2, 1], note: 'About 40 degrees to each side happens here, roughly half of all head turning.' } },
    text: 'One axis along the length of a bone. The ring of the atlas, completed by the transverse ligament, turns around the dens (odontoid process) of the axis. That is the "no" movement. The other pivot in the body is the proximal radioulnar joint, which lets the radius roll over the ulna to turn the palm down.',
    box: [[-0.1, 1.44, -0.12], [0.1, 1.74, 0.11]], dir: [0.35, 0.2, 1],
  },
  ball: {
    title: 'Ball and socket', where: 'Hip joint', pivot: 'hip_L',
    fixed: (it) => /^(left hip bone|right hip bone|sacrum|fifth lumbar vertebra|fourth lumbar vertebra)$/i.test(it.name),
    moving: (it) => /^left (femur|patella|tibia|fibula)$/i.test(it.name) || FOOT_L.test(it.name),
    motions: {
      flex: { label: 'Flexion', axis: [1, 0, 0], sign: -1, min: -20, max: 90, dir: [1, 0.1, 0.15], note: 'With the knee straight, about 90 degrees forward and 20 back (extension).' },
      abd: { label: 'Abduction', axis: [0, 0, 1], sign: 1, min: -25, max: 45, dir: [0.15, 0.1, 1], note: 'About 45 degrees out (abduction) and 25 across the midline (adduction).' },
      rot: { label: 'Rotation', axis: [0, 1, 0], sign: -1, min: -45, max: 40, dir: [0.3, 0.6, 1], note: 'Medial rotation about 40 degrees, lateral rotation about 45.' },
      circ: { label: 'Circumduction', circ: true, dir: [0.8, 0.25, 1], note: 'A cone: flexion, abduction, extension and adduction in sequence.' },
    },
    text: 'Three axes. The round head of the femur sits deep in the cup shaped acetabulum, deepened further by a rim of cartilage (the labrum). It trades some range for stability: the shoulder is also a ball and socket, but its socket is shallow, so it moves more and dislocates far more often.',
    box: [[-0.12, 0.0, -0.3], [0.42, 1.05, 0.8]], dir: [1, 0.1, 0.15],
  },
  condyloid: {
    title: 'Condyloid', where: 'Wrist (radiocarpal joint)', pivot: 'wrist_L',
    fixed: (it) => /^left (radius|ulna)$/i.test(it.name),
    moving: (it) => HAND_L.test(it.name),
    motions: {
      flex: { label: 'Flexion', axis: [1, 0, 0], sign: -1, min: -70, max: 80, dir: [1, 0.1, 0.1], note: 'About 80 degrees of flexion and 70 of extension.' },
      dev: { label: 'Deviation', axis: [0, 0, 1], sign: 1, min: -35, max: 20, dir: [0.1, 0.1, 1], note: 'Radial deviation about 20 degrees, ulnar deviation about 35.' },
    },
    text: 'Two axes. An oval surface sits in an oval hollow, so it can bend forward and back and tilt side to side, and combine them into circumduction, but it cannot spin. Here the distal radius cups the scaphoid and lunate. The knuckles (metacarpophalangeal joints) are condyloid too. Also called ellipsoid.',
    box: [[0.2, 0.7, -0.12], [0.33, 0.97, 0.14]], dir: [1, 0.1, 0.1],
  },
  saddle: {
    title: 'Saddle', where: 'Thumb (carpometacarpal joint)', pivot: 'cmc_L',
    fixed: (it) => HAND_L.test(it.name) && !/first metacarpal|thumb/i.test(it.name) || /^left (radius|ulna)$/i.test(it.name),
    moving: (it) => /left first metacarpal|of left thumb/i.test(it.name),
    motions: {
      flex: { label: 'Flexion', axis: [0, 0, 1], sign: -1, min: -15, max: 45, dir: [0.4, 0.1, 1], note: 'Across the palm (flexion) and back out (extension).' },
      abd: { label: 'Abduction', axis: [1, 0, 0], sign: -1, min: 0, max: 50, dir: [1, 0.15, 0.4], note: 'Forward, away from the palm.' },
      circ: { label: 'Opposition', circ: true, dir: [0.4, 0.2, 1], note: 'Abduction, flexion and rotation together bring the thumb pad onto the fingertips.' },
    },
    text: 'Two axes, with two curved surfaces that fit like a rider on a saddle. The base of the first metacarpal sits on the trapezium. It is what lets the thumb oppose the fingers, which is why losing it costs so much hand function, and why it is a common place for osteoarthritis.',
    box: [[0.22, 0.75, -0.03], [0.32, 0.92, 0.07]], dir: [0.4, 0.1, 1],
  },
  plane: {
    title: 'Plane', where: 'Acromioclavicular joint', pivot: 'ac_L',
    fixed: (it) => /^(left clavicle|manubrium|body of sternum|left first rib|left second rib)$/i.test(it.name),
    moving: (it) => /^left (scapula|humerus)$/i.test(it.name),
    motions: { glide: { label: 'Glide', axis: [0, 0, 1], sign: 1, min: -7, max: 7, dir: [0.4, 0.4, 1], note: 'Only a few degrees of gliding and tilting, as the scapula turns when you lift the arm.' } },
    text: 'Flat surfaces that slide over each other a little, held tight by ligaments. Here the acromion of the scapula meets the end of the clavicle. Other plane joints: between the carpal bones, between the tarsal bones and the facet joints of the vertebrae.',
    box: [[0.0, 1.2, -0.12], [0.24, 1.5, 0.08]], dir: [0.5, 0.5, 1],
  },
};

export default {
  mount(ctx) {
    const v = new Viewer(ctx, { minDist: 0.08 });
    const note = loadingNote(ctx);
    const C = ctx.colors;
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Joints and movement</h2>'),
      ctx.h('<p class="lede">The shape of the two bone ends decides how a joint can move. Six shapes cover every freely moving joint you have.</p>'),
      ctx.h(`<div class="card tip"><p>A joint is wherever two bones meet. Most of the ones that move freely are <b>synovial joints</b>: the bone ends are capped with smooth cartilage, wrapped in a capsule and bathed in slippery synovial fluid.</p><p>Count the <b>axes</b> a joint can turn around. A hinge has one, a saddle two, a ball and socket three. Each joint below moves on the real bones of this model, turning about its own centre.</p></div>`),
      ctx.h('<div class="card try"><p>Pick a joint type, then drag the angle slider or press <b>Play</b>. Watch the teal axis line: the bones turn around it. On the hip, try <b>Circumduction</b> and follow the foot drawing a cone.</p></div>'),
    );
    const typeSeg = ctx.seg(Object.entries(JOINTS).map(([k, j]) => [k, j.title]), 'hinge', (k) => setJoint(k));
    ctx.panel.append(typeSeg);
    const jc = ctx.h('<div class="card"><span class="eyebrow jw"></span><b class="anat-big jt"></b><p class="small jx"></p><div class="row jm"></div><div class="js"></div><div class="row"><button class="btn sm jp">Play</button><span class="hint jn" style="flex:1"></span></div></div>');
    ctx.panel.append(jc);
    const info = infoCard(ctx); ctx.panel.append(info);
    ctx.panel.append(ctx.h(`<details class="more"><summary>The three structural classes</summary><div>
      <p><b>Fibrous</b> joints are held by dense connective tissue and barely move: the skull sutures, the syndesmosis between the lower tibia and fibula, and the gomphosis that holds each tooth in its socket.</p>
      <p><b>Cartilaginous</b> joints are held by cartilage. Primary ones use hyaline cartilage (the growth plates, the first rib with the sternum). Secondary ones use fibrocartilage and move a little: the pubic symphysis and the intervertebral discs.</p>
      <p><b>Synovial</b> joints move freely and are the six types on this page. Function is also described as synarthrosis (immovable), amphiarthrosis (slightly movable) and diarthrosis (freely movable).</p></div></details>`));
    ctx.panel.append(ctx.h(`<div class="card deep"><p>Movement words come in pairs, all measured from anatomical position: <b>flexion</b> and <b>extension</b> in the sagittal plane, <b>abduction</b> and <b>adduction</b> in the coronal plane, <b>medial</b> and <b>lateral rotation</b> around a long axis. The forearm adds <b>pronation</b> and <b>supination</b>, the foot <b>inversion</b> and <b>eversion</b>, and the ankle <b>dorsiflexion</b> and <b>plantarflexion</b>.</p>
      <p>Ranges quoted here are typical adult values measured with a goniometer. They vary with age, sex and training. Each moving bone in this chapter is rotated rigidly about a centre found in the model itself: the femoral head is a sphere fitted to its surface (about 23 mm radius here), the elbow axis runs between the two epicondyles.</p></div>`));
    ctx.quiz([
      { q: 'Which joint type allows movement around three axes?', choices: ['Hinge', 'Saddle', 'Ball and socket'], answer: 2, why: 'Ball and socket joints (hip, shoulder) flex, abduct and rotate.' },
      { q: 'The atlantoaxial joint, which turns the head, is a...', choices: ['Pivot joint', 'Plane joint', 'Condyloid joint'], answer: 0, why: 'The atlas rotates around the dens of the axis.' },
      { q: 'The carpometacarpal joint of the thumb is a saddle joint. What does it make possible?', choices: ['Opposition of the thumb', 'Pronation of the forearm', 'Flexion of the elbow'], answer: 0, why: 'Two curved surfaces give the thumb two axes, combined with a little rotation for opposition.' },
    ]);

    const vg = group(ctx, 'View', [['front', 'Front'], ['side', 'Side'], ['top', 'Top']], (k) => frame(k));
    dock(ctx, [vg]);

    let pack = null; let P = null; let cur = null; let motion = null; let angle = 0; let playing = false; let tt = 0;
    const scene = new THREE.Group(); v.root.add(scene);
    const mats = { fix: new THREE.MeshStandardMaterial({ color: colorFor.skel({ name: 'x', cat: 'upper' }), roughness: 0.6 }), mov: new THREE.MeshStandardMaterial({ color: 0xF0C67A, roughness: 0.55 }), ghost: new THREE.MeshStandardMaterial({ color: 0xF0C67A, roughness: 0.55, transparent: true, opacity: 0.22, depthWrite: false }) };
    v.own(new THREE.Group().add(new THREE.Mesh(new THREE.BufferGeometry(), mats.fix), new THREE.Mesh(new THREE.BufferGeometry(), mats.mov)));
    let pivotG = null; let axisLine = null; let trail = null;

    function frame(k) {
      if (!cur) return;
      const j = JOINTS[cur]; const b = new THREE.Box3(new THREE.Vector3(...j.box[0]), new THREE.Vector3(...j.box[1]));
      v.frame(b, { dir: k === 'side' ? [1, 0.1, 0.1] : k === 'top' ? [0.2, 1, 0.3] : j.dir, pad: 1.15 });
    }
    function clear() {
      scene.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.dispose(); });
      scene.clear();
    }
    function setJoint(k) {
      if (!pack) return;
      cur = k; clear(); angle = 0; playing = false; tt = 0;
      const j = JOINTS[k];
      jc.querySelector('.jw').textContent = j.where; jc.querySelector('.jt').textContent = j.title; jc.querySelector('.jx').textContent = j.text;
      const pc = new THREE.Vector3(...P.joints[j.pivot].c);
      pivotG = new THREE.Group(); pivotG.position.copy(pc); scene.add(pivotG);
      for (const it of pack.items) {
        const fx = j.fixed(it); const mv = !fx && j.moving(it);
        if (!fx && !mv) continue;
        const m = new THREE.Mesh(itemGeometry(pack, it), mv ? (k === 'pivot' && it.name !== 'Atlas' ? mats.ghost : mats.mov) : mats.fix);
        m.userData.item = it; m.userData.own = true;
        if (mv) { m.position.sub(pc); pivotG.add(m); } else scene.add(m);
      }
      // joint centre marker
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.005, 16, 12), new THREE.MeshBasicMaterial({ color: C.c1, depthTest: false, transparent: true }));
      dot.position.copy(pc); dot.renderOrder = 9; scene.add(dot);
      const ms = jc.querySelector('.jm'); ms.innerHTML = '';
      const keys = Object.keys(j.motions);
      const seg = ctx.seg(keys.map((m) => [m, j.motions[m].label]), keys[0], (m) => setMotion(m));
      if (keys.length > 1) ms.append(seg);
      setMotion(keys[0]);
      info.set('Tap a bone', 'Moving bones are amber, fixed bones ivory.');
    }
    let slider = null;
    function setMotion(m) {
      const j = JOINTS[cur]; motion = m; const mo = j.motions[m];
      const host = jc.querySelector('.js'); host.innerHTML = '';
      pivotG.rotation.set(0, 0, 0); angle = 0; tt = 0;
      if (axisLine) { scene.remove(axisLine); axisLine.geometry.dispose(); axisLine = null; }
      if (trail) { scene.remove(trail); trail.geometry.dispose(); trail = null; }
      if (!mo.circ) {
        slider = ctx.slider({ label: `${mo.label} angle`, min: mo.min, max: mo.max, step: 1, value: 0, fmt: (x) => `${Math.round(x)} deg`, onInput: (x) => { playing = false; pose(x); } });
        host.append(slider);
        const ax = new THREE.Vector3(...mo.axis).multiplyScalar(0.06);
        const g = new THREE.BufferGeometry().setFromPoints([pivotG.position.clone().sub(ax), pivotG.position.clone().add(ax)]);
        axisLine = new THREE.Line(g, new THREE.LineBasicMaterial({ color: C.c1, depthTest: false, transparent: true }));
        axisLine.renderOrder = 8; scene.add(axisLine);
      } else {
        slider = null;
        trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: C.c2, transparent: true, opacity: 0.8 }));
        trail.userData.pts = []; scene.add(trail);
        playing = true;
      }
      jc.querySelector('.jn').textContent = mo.note;
      if (mo.dir) { const b = new THREE.Box3(new THREE.Vector3(...j.box[0]), new THREE.Vector3(...j.box[1])); v.frame(b, { dir: mo.dir, pad: 1.12 }); }
      jc.querySelector('.jp').textContent = playing ? 'Pause' : 'Play';
      pose(0);
    }
    function pose(a) {
      const j = JOINTS[cur]; const mo = j.motions[motion];
      angle = a;
      if (mo.circ) {
        const motions = j.motions; const r = THREE.MathUtils.degToRad;
        const f = motions.flex; const ab = motions.abd;
        const ph = a; // phase in radians
        pivotG.rotation.set(0, 0, 0);
        const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...f.axis), f.sign * r(28 + 26 * Math.sin(ph)));
        const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...ab.axis), ab.sign * r(16 * Math.cos(ph) + 8));
        pivotG.quaternion.copy(q1).multiply(q2);
        // draw the cone traced by the end of the moving chain
        const tip = new THREE.Vector3(0, cur === 'ball' ? -0.82 : -0.07, cur === 'ball' ? 0.08 : 0.01).applyQuaternion(pivotG.quaternion).add(pivotG.position);
        const pts = trail.userData.pts; pts.push(tip); if (pts.length > 160) pts.shift();
        trail.geometry.dispose(); trail.geometry = new THREE.BufferGeometry().setFromPoints(pts);
      } else {
        pivotG.quaternion.setFromAxisAngle(new THREE.Vector3(...mo.axis), mo.sign * THREE.MathUtils.degToRad(a));
        if (slider) slider.value = a;
      }
      v.dirty = true;
    }
    jc.querySelector('.jp').addEventListener('click', () => { playing = !playing; jc.querySelector('.jp').textContent = playing ? 'Pause' : 'Play'; });
    v.every((dt) => {
      if (!playing || !cur) return false;
      const mo = JOINTS[cur].motions[motion];
      tt += dt * (reducedMotion ? 0.4 : 1);
      if (mo.circ) pose(tt * 1.6);
      else { const k = (1 - Math.cos(tt * 1.4)) / 2; pose(mo.min < 0 ? mo.min + (mo.max - mo.min) * k : mo.max * k); }
      return true;
    });

    v.extraPick = (ray) => {
      const rc = new THREE.Raycaster(); rc.ray.copy(ray);
      const h = rc.intersectObjects(scene.children, true).find((x) => x.object.userData.item);
      return h ? { d: h.distance, key: 'bone', item: h.object.userData.item, point: h.point, object: h.object } : null;
    };
    let lastMat = null;
    v.hover = (h) => h.item.name;
    v.onPick = (h) => {
      if (lastMat) { lastMat.o.material = lastMat.m; lastMat = null; }
      if (!h) { v.labels = []; return; }
      lastMat = { o: h.object, m: h.object.material };
      h.object.material = new THREE.MeshStandardMaterial({ color: C.c1, roughness: 0.5 }); h.object.material.userData = {}; h.object.userData.own = true;
      info.set(h.item.name, describe(h.item), lastMat.m === mats.fix ? 'Fixed bone' : 'Moving bone');
      v.labels = [{ pos: h.point, text: h.item.name, on: true }]; v.dirty = true;
    };

    Promise.all([loadPack('skel'), paths()]).then(([pk, pp]) => {
      if (ctx.signal.aborted) return;
      note.done(); pack = pk; P = pp; setJoint('hinge');
    }).catch((e) => { console.error(e); note.fail(); });
    return () => { clear(); mats.fix.dispose(); mats.mov.dispose(); mats.ghost.dispose(); };
  },
};
