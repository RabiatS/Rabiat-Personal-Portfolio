// Chapter 1: the body map. Layers, anatomical position, planes with a draggable cut, and direction words drilled on real bones.
import { THREE, Viewer, infoCard, dock, group, loadingNote, reducedMotion } from '../engine.js';
import { Body, LAYERS, NERVE_INFO } from '../body.js';
import { describe } from '../facts.js';

const PLANES = {
  none: null,
  sagittal: { n: [-1, 0, 0], min: -0.2, max: 0.2, at: 0, cam: [1, 0.15, 0.25], label: 'Sagittal plane', note: 'Splits the body into left and right parts. The midsagittal (median) plane runs exactly down the middle.' },
  coronal: { n: [0, 0, -1], min: -0.14, max: 0.14, at: 0.0, cam: [0.25, 0.1, 1], label: 'Coronal (frontal) plane', note: 'Splits the body into front (anterior) and back (posterior) parts.' },
  transverse: { n: [0, -1, 0], min: 0.05, max: 1.7, at: 1.2, cam: [0.2, 1, 0.8], label: 'Transverse (axial) plane', note: 'A horizontal slice. Splits the body into upper (superior) and lower (inferior) parts. CT scans are usually shown this way.' },
};

const DRILL = [
  'Body of sternum', 'Manubrium', 'Left clavicle', 'Left scapula', 'Left humerus', 'Left radius', 'Left ulna', 'Left femur', 'Left patella', 'Left tibia', 'Left fibula',
  'Right humerus', 'Right radius', 'Right ulna', 'Right tibia', 'Right fibula', 'Right femur', 'Mandible', 'Frontal bone', 'Occipital bone', 'Sacrum', 'Fifth lumbar vertebra',
  'Seventh cervical vertebra', 'Left calcaneus', 'Right calcaneus', 'Left first rib', 'Left hip bone', 'Right hip bone', 'Left third metacarpal bone', 'Left first metatarsal bone', 'Hyoid bone',
];
const LIMB = { arm: ['clavicle', 'scapula', 'humerus', 'radius', 'ulna', 'metacarpal'], leg: ['hip bone', 'femur', 'patella', 'tibia', 'fibula', 'calcaneus', 'metatarsal'] };
const rank = { humerus: 1, radius: 2, ulna: 2, metacarpal: 3, femur: 1, patella: 1.5, tibia: 2, fibula: 2, calcaneus: 3, metatarsal: 4 };

export default {
  mount(ctx) {
    const v = new Viewer(ctx, { label: '3D body. Drag to turn, pinch or scroll to zoom, tap a structure to name it.' });
    const body = new Body(v);
    const note = loadingNote(ctx);
    const C = ctx.colors;
    let cur = null; let frac = 0.5;

    // Panel
    ctx.panel.append(
      ctx.h('<h2 class="k-h">The body map</h2>'),
      ctx.h('<p class="lede">Before you learn any part, you need the map: one standard pose, three ways to slice, and a handful of direction words that every anatomy book uses.</p>'),
      ctx.h(`<div class="card tip"><p>Anatomists always describe the body in <b>anatomical position</b>: standing upright, facing you, arms by the sides with the <b>palms facing forward</b>, feet flat and together. Every direction word is relative to that pose, even when the person is lying down.</p><p>The body is built in layers. Skin on the outside, then muscles, then the skeleton, with organs, blood vessels and nerves woven through. Switch the layers on and off below the model.</p></div>`),
      ctx.h('<div class="card try"><p>Turn on <b>Vessels</b> and <b>Nerves</b>, switch off <b>Bones</b>, and drag to turn the body. Then pick a plane below and drag the round handle on the model to slide the cut through the body.</p></div>'),
    );
    const info = infoCard(ctx);
    ctx.panel.append(info);

    // Planes
    const planeBox = ctx.h('<div class="card"><h3>Planes and sections</h3><p class="small muted plane-note">Pick a plane to slice the model.</p></div>');
    const seg = ctx.seg([['none', 'None'], ['sagittal', 'Sagittal'], ['coronal', 'Coronal'], ['transverse', 'Transverse']], 'none', (k) => setPlane(k));
    planeBox.insertBefore(seg, planeBox.querySelector('.plane-note'));
    const sl = ctx.slider({ label: 'Cut position', min: 0, max: 1, step: 0.001, value: 0.5, fmt: (x) => planeFmt(x), onInput: (x) => movePlane(x) });
    sl.hidden = true;
    planeBox.append(sl);
    ctx.panel.append(planeBox);

    // Direction drill
    const drill = ctx.h(`<div class="card"><h3>Direction words drill</h3>
      <p class="small muted">Two bones light up on the model. Pick the word that makes the sentence true in anatomical position.</p>
      <p class="dq" style="font:600 18px/1.25 var(--f-display);letter-spacing:.02em;margin:2px 0"></p>
      <div class="choices dc"></div><div class="row"><span class="hint ds"></span><span style="flex:1"></span><button class="btn ghost sm dn">Next pair</button></div></div>`);
    ctx.panel.append(drill);

    ctx.panel.append(ctx.h(`<details class="more"><summary>The direction words</summary><div>
      <p><b>Superior</b> (cranial) means towards the head, <b>inferior</b> (caudal) towards the feet.</p>
      <p><b>Anterior</b> (ventral) is the front, <b>posterior</b> (dorsal) the back.</p>
      <p><b>Medial</b> is closer to the midline, <b>lateral</b> further from it. The thumb is lateral because the palms face forward.</p>
      <p><b>Proximal</b> and <b>distal</b> are for limbs only: closer to or further from where the limb attaches to the trunk. The wrist is distal to the elbow.</p>
      <p><b>Superficial</b> and <b>deep</b> describe distance from the skin surface. <b>Ipsilateral</b> means the same side, <b>contralateral</b> the opposite side.</p>
      <p><b>Supine</b> is lying face up, <b>prone</b> face down.</p></div></details>`));
    ctx.panel.append(ctx.h(`<div class="card deep"><p>Left and right always mean the <b>patient's</b> left and right, not yours. When you face someone, their left side is on your right. Radiology images follow the same rule: on a standard chest X ray or an axial CT slice, the patient's left is on the right of the screen (axial CT is viewed as if from the feet).</p>
      <p>This model is one adult male reference body from BodyParts3D, built from MRI and anatomical illustration. Real bodies vary. Organs shift with breathing, posture and age, and a few percent of people have variants such as an extra rib or a different branching of the aorta.</p></div>`));

    ctx.quiz([
      { q: 'In anatomical position, which way do the palms face?', choices: ['Towards the thighs', 'Forward', 'Backward'], answer: 1, why: 'Palms face forward, which is why the radius and thumb are lateral.' },
      { q: 'Which plane divides the body into front and back parts?', choices: ['Sagittal', 'Transverse', 'Coronal'], answer: 2, why: 'The coronal (frontal) plane separates anterior from posterior.' },
      { q: 'The knee is ___ to the hip.', choices: ['Proximal', 'Distal', 'Medial'], answer: 1, why: 'Distal means further from where the limb attaches to the trunk.' },
    ]);

    // Docked layer toggles
    const on = { skin: true, bones: true, muscles: false, organs: false, vessels: false, nerves: false };
    const lg = group(ctx, 'Layers', Object.entries(LAYERS).map(([k, l]) => [k, l.label]), async (k, b, set) => {
      on[k] = !on[k]; set(on);
      b.style.opacity = '0.6';
      await body.set(k, on[k]);
      b.style.opacity = '';
      for (const lb of v.labels) lb.hidden = !on.bones;
      if (on.skin && v.packs.skin) v.packs.skin.opacity(on.bones || on.muscles || on.organs || on.vessels || on.nerves ? 0.16 : 0.6);
    }, { multi: true, value: on });
    const vg = group(ctx, 'View', [['front', 'Front'], ['side', 'Side'], ['back', 'Back']], (k) => view(k));
    dock(ctx, [lg, vg]);

    const full = new THREE.Box3(new THREE.Vector3(-0.35, 0, -0.16), new THREE.Vector3(0.35, 1.73, 0.16));
    const view = (k) => v.frame(full, { dir: k === 'side' ? [1, 0.05, 0.02] : k === 'back' ? [0, 0.05, -1] : [0, 0.05, 1], pad: 1.08 });
    v.frame(full, { dir: [0, 0.05, 1], pad: 1.08, dur: 0 });

    Promise.all([body.set('skin', true), body.set('bones', true)]).then(() => {
      note.done();
      if (!ctx.signal.aborted) newPair(false);
    }).catch((e) => { console.error(e); note.fail(); });

    // Picking
    v.hover = (h) => h.item.name;
    v.onPick = (h) => {
      for (const pv of Object.values(v.packs)) pv.highlight(-1);
      if (!h) { info.set('Tap a structure', 'Tap or click anything on the model to name it.'); return; }
      if (h.pv) h.pv.highlight(h.item.k);
      const d = h.nerve ? (NERVE_INFO[h.nerve] || [])[1] : describe(h.item);
      info.set(h.item.name, d || '', layerName(h));
    };
    const layerName = (h) => ({ skel: 'Bone', muscle: 'Muscle', vessels: h.item.cat === 'venous' ? 'Vein' : 'Artery', organs: 'Organ', heart: 'Heart', brain: 'Brain and cranial nerves', nerves: 'Nerve (schematic path)' })[h.key] || 'Structure';

    // Cutting plane with a draggable handle
    const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: C.c1, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false }));
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)), new THREE.LineBasicMaterial({ color: C.c1, transparent: true, opacity: 0.7 }));
    quad.add(edge); quad.visible = false; v.own(quad); v.scene.add(quad);
    const handle = ctx.h('<button class="anat-handle" aria-label="Drag to move the cutting plane" hidden></button>');
    v.host.append(handle);
    function planeFmt(x) {
      if (!cur) return '';
      const P = PLANES[cur]; const val = P.min + (P.max - P.min) * x;
      if (cur === 'transverse') return `${Math.round(val * 100)} cm above the floor`;
      if (cur === 'sagittal') return Math.abs(val) < 0.005 ? 'midline' : `${Math.round(Math.abs(val) * 100)} cm to the ${val > 0 ? 'left' : 'right'}`;
      return Math.abs(val) < 0.005 ? 'mid coronal' : `${Math.round(Math.abs(val) * 100)} cm ${val > 0 ? 'anterior' : 'posterior'}`;
    }
    function movePlane(x) {
      frac = Math.min(1, Math.max(0, x));
      const P = PLANES[cur]; if (!P) return;
      const val = P.min + (P.max - P.min) * frac;
      plane.normal.set(...P.n); plane.constant = val; // distance = n.p + c, kept where >= 0
      // n.p + c >= 0 keeps the side opposite the normal, below val along the axis
      const ax = P.n.findIndex((q) => q !== 0);
      quad.position.set(0, 0.86, 0); quad.position.setComponent(ax, val);
      quad.rotation.set(0, 0, 0); quad.scale.set(1, 1, 1);
      if (cur === 'sagittal') { quad.rotation.y = Math.PI / 2; quad.scale.set(0.5, 1.85, 1); }
      if (cur === 'coronal') quad.scale.set(0.95, 1.85, 1);
      if (cur === 'transverse') { quad.rotation.x = -Math.PI / 2; quad.scale.set(0.95, 0.5, 1); }
      v.dirty = true; sl.value = frac;
    }
    function setPlane(k) {
      cur = PLANES[k] ? k : null;
      planeBox.querySelector('.plane-note').textContent = cur ? PLANES[k].note : 'Pick a plane to slice the model.';
      sl.hidden = !cur; handle.hidden = !cur; quad.visible = !!cur;
      for (const pv of Object.values(v.packs)) { pv.mat.side = cur ? THREE.DoubleSide : THREE.FrontSide; pv.mat.needsUpdate = true; }
      if (!cur) { v.setClip(null); v.dirty = true; return; }
      const P = PLANES[k];
      movePlane((P.at - P.min) / (P.max - P.min));
      v.setClip(plane);
      v.frame(full, { dir: P.cam, pad: 1.08 });
    }
    // Handle position follows the plane each frame
    v.every(() => {
      if (!cur) return false;
      const P = PLANES[cur]; const val = P.min + (P.max - P.min) * frac;
      const anchor = cur === 'transverse' ? new THREE.Vector3(0.36, val, 0) : cur === 'sagittal' ? new THREE.Vector3(val, 1.78, 0) : new THREE.Vector3(0, 1.78, val);
      const p = v.project(anchor);
      handle.style.left = `${p.x}px`; handle.style.top = `${p.y}px`;
      return false;
    });
    let drag = null;
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault(); handle.setPointerCapture(e.pointerId);
      const P = PLANES[cur]; const ax = new THREE.Vector3(...P.n).negate();
      const val = P.min + (P.max - P.min) * frac;
      const anchor = cur === 'transverse' ? new THREE.Vector3(0.36, val, 0) : cur === 'sagittal' ? new THREE.Vector3(val, 1.78, 0) : new THREE.Vector3(0, 1.78, val);
      const a = v.project(anchor); const b = v.project(anchor.clone().addScaledVector(ax, 0.1));
      let dir = { x: b.x - a.x, y: b.y - a.y }; let len = Math.hypot(dir.x, dir.y);
      if (len < 4) { dir = { x: 1, y: 0 }; len = 60; }
      drag = { x: e.clientX, y: e.clientY, f: frac, dir: { x: dir.x / len, y: dir.y / len }, pxPerM: len / 0.1 };
    }, { signal: ctx.signal });
    handle.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const P = PLANES[cur];
      const d = ((e.clientX - drag.x) * drag.dir.x + (e.clientY - drag.y) * drag.dir.y) / drag.pxPerM;
      movePlane(drag.f + d / (P.max - P.min));
    }, { signal: ctx.signal });
    handle.addEventListener('pointerup', () => { drag = null; }, { signal: ctx.signal });
    handle.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { movePlane(frac + 0.02); e.preventDefault(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { movePlane(frac - 0.02); e.preventDefault(); }
    }, { signal: ctx.signal });

    // Direction drill on real bone positions
    const dq = drill.querySelector('.dq'); const dc = drill.querySelector('.dc'); const ds = drill.querySelector('.ds');
    let score = ctx.store.get('dirScore', { right: 0, total: 0 });
    const showScore = () => { ds.textContent = score.total ? `${score.right} of ${score.total} right` : ''; };
    showScore();
    drill.querySelector('.dn').addEventListener('click', () => newPair(true));
    function limbOf(n) {
      const l = n.toLowerCase();
      for (const [k, list] of Object.entries(LIMB)) if (list.some((w) => l.includes(w))) return k + (l.startsWith('left') ? 'L' : l.startsWith('right') ? 'R' : '');
      return null;
    }
    function rankOf(n) { const l = n.toLowerCase(); for (const [w, r] of Object.entries(rank)) if (l.includes(w)) return r; return null; }
    function newPair(move) {
      const sk = v.packs.skel; if (!sk) return;
      sk.colorAll((it) => sk.base[it.k]); // reset
      const items = DRILL.map((n) => sk.item(n)).filter(Boolean);
      for (let tries = 0; tries < 200; tries++) {
        const a = items[Math.floor(Math.random() * items.length)]; const b = items[Math.floor(Math.random() * items.length)];
        if (a === b) continue;
        const ca = a.center; const cb = b.center;
        const opts = [];
        if (Math.abs(ca.y - cb.y) > 0.06) opts.push(ca.y > cb.y ? 'superior' : 'inferior');
        if (Math.abs(ca.z - cb.z) > 0.045 && Math.abs(ca.y - cb.y) < 0.35) opts.push(ca.z > cb.z ? 'anterior' : 'posterior');
        const sameSide = Math.sign(ca.x) === Math.sign(cb.x) || Math.abs(ca.x) < 0.01 || Math.abs(cb.x) < 0.01;
        if (sameSide && Math.abs(Math.abs(ca.x) - Math.abs(cb.x)) > 0.025 && Math.abs(ca.y - cb.y) < 0.3) opts.push(Math.abs(ca.x) < Math.abs(cb.x) ? 'medial' : 'lateral');
        const la = limbOf(a.name); const lb = limbOf(b.name); const ra = rankOf(a.name); const rb = rankOf(b.name);
        if (la && la === lb && ra && rb && ra !== rb) opts.push(ra < rb ? 'proximal' : 'distal');
        if (!opts.length) continue;
        const ans = opts[Math.floor(Math.random() * opts.length)];
        const opp = { superior: 'inferior', inferior: 'superior', anterior: 'posterior', posterior: 'anterior', medial: 'lateral', lateral: 'medial', proximal: 'distal', distal: 'proximal' };
        const pool = Object.keys(opp).filter((w) => w !== ans && w !== opp[ans] && !opts.includes(w));
        const choices = [ans, opp[ans], ...pool.sort(() => Math.random() - 0.5).slice(0, 2)].sort(() => Math.random() - 0.5);
        sk.color(a.k, 0x5EEAD4); sk.color(b.k, 0xFBBF24);
        v.labels = [{ pos: sk.worldCenter(a), text: a.name, color: C.c1 }, { pos: sk.worldCenter(b), text: b.name, color: C.c2 }];
        dq.innerHTML = `The <span style="color:var(--c1)">${ctx.esc(a.name.toLowerCase())}</span> is ____ to the <span style="color:var(--c2)">${ctx.esc(b.name.toLowerCase())}</span>.`;
        dc.innerHTML = choices.map((c) => `<button class="choice" data-c="${c}">${c}</button>`).join('');
        dc.querySelectorAll('.choice').forEach((bt) => bt.addEventListener('click', () => {
          const ok = bt.dataset.c === ans;
          dc.querySelectorAll('.choice').forEach((x) => { x.disabled = true; if (x.dataset.c === ans) x.classList.add('right'); });
          if (!ok) bt.classList.add('wrong');
          score = { right: score.right + (ok ? 1 : 0), total: score.total + 1 }; ctx.store.set('dirScore', score); showScore();
          const why = opts.length > 1 ? ` It is also ${opts.filter((o) => o !== ans).join(' and ')}.` : '';
          ds.textContent = `${ok ? 'Right.' : `It is ${ans}.`}${why} ${score.right} of ${score.total}`;
        }));
        const box = new THREE.Box3().union(a.box).union(b.box).expandByScalar(0.08);
        if (!cur && move) v.frame(box, { dir: [0.25, 0.1, 1], pad: 1.6 });
        v.dirty = true;
        return;
      }
    }
    return () => handle.remove();
  },
};
