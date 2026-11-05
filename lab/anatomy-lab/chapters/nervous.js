// Chapter 7: brain and nerves. Lobes and their jobs on the BodyParts3D brain, the cord and major nerves, and a knee jerk reflex arc.
import { THREE, Viewer, infoCard, dock, group, loadingNote, loadPack, itemGeometry, paths, reducedMotion } from '../engine.js';
import { colorFor, nerveGroup, NERVE_INFO } from '../body.js';
import { describe, lobeOf } from '../facts.js';

const LOBES = {
  frontal: { label: 'Frontal lobe', col: 0x60A5FA, job: 'Reasoning, planning, decisions, self control and personality. The precentral gyrus at its back is the primary motor cortex, which starts voluntary movement. Broca\'s area (usually on the left) produces speech.' },
  parietal: { label: 'Parietal lobe', col: 0xFBBF24, job: 'Touch, pain, temperature and the sense of where your body is (primary somatosensory cortex in the postcentral gyrus). Also spatial awareness and attention.' },
  temporal: { label: 'Temporal lobe', col: 0xA3E635, job: 'Hearing (primary auditory cortex), understanding language (Wernicke\'s area, usually on the left), recognising faces and objects, and memory with the hippocampus on its inner side.' },
  occipital: { label: 'Occipital lobe', col: 0xA78BFA, job: 'Vision. The primary visual cortex at the very back receives signals from the eyes via the thalamus.' },
  insula: { label: 'Insula', col: 0xFB7185, job: 'Hidden deep in the lateral sulcus. Taste, gut feelings and awareness of heartbeat, breathing and other inner sensations.' },
  limbic: { label: 'Cingulate gyrus', col: 0x5EEAD4, job: 'Part of the limbic system: emotion, motivation, and how unpleasant a pain feels.' },
  cerebellum: { label: 'Cerebellum', col: 0xE9A6C9, job: 'Coordination, balance, posture and fine timing of movement. Damage gives an unsteady gait and clumsy, overshooting movements on the same side.' },
  brainstem: { label: 'Brainstem', col: 0xC9B79C, job: 'Midbrain, pons and medulla. Breathing, heart rate, blood pressure, swallowing, sleep and wakefulness. Ten of the twelve cranial nerves attach here.' },
  deep: { label: 'Deep structures', col: 0x9AA4B2, job: 'Thalamus (sensory relay), basal ganglia (caudate, putamen, globus pallidus: starting and smoothing movement), hippocampus (memory), amygdala (fear) and hypothalamus (temperature, hunger, hormones).' },
  white: { label: 'White matter', col: 0xE8E0D8, job: 'Bundles of insulated axons linking regions. The corpus callosum joins the two hemispheres.' },
};

export default {
  mount(ctx) {
    const v = new Viewer(ctx, { minDist: 0.05 });
    const note = loadingNote(ctx);
    const C = ctx.colors;
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Brain and nerves</h2>'),
      ctx.h('<p class="lede">The central nervous system is the brain and spinal cord. Everything else, the nerves running out to every muscle and patch of skin, is the peripheral nervous system.</p>'),
      ctx.h(`<div class="card tip"><p>The outer layer of the brain, the <b>cerebral cortex</b>, is folded into ridges (gyri) and grooves (sulci) and split into lobes, each with its own main jobs. The front of the brain plans and decides, the back sees, the sides hear and the top feels.</p><p>Each side of the brain mostly controls and feels the <b>opposite</b> side of the body, because the main motor and sensory pathways cross over in the brainstem or spinal cord.</p></div>`),
      ctx.h('<div class="card try"><p>In <b>Brain</b>, tap the lobe names below to light them up, then tap the model. In <b>Nerves</b>, follow the sciatic nerve down the back of the leg. In <b>Reflex</b>, tap the patellar tendon and watch the signal go to the spinal cord and straight back.</p></div>'),
    );
    const modeSeg = ctx.seg([['brain', 'Brain'], ['nerves', 'Nerves'], ['reflex', 'Reflex arc']], 'brain', (k) => setMode(k));
    ctx.panel.append(modeSeg);
    const lobeBox = ctx.h('<div class="anat-chips"></div>'); ctx.panel.append(lobeBox);
    const reflexBox = ctx.h(`<div class="card" hidden><h3>Knee jerk (patellar reflex)</h3><p class="small">A tap stretches the quadriceps. Stretch receptors (muscle spindles) fire along fast sensory fibres in the femoral nerve to the L3 and L4 segments of the spinal cord. There they synapse directly on motor neurons, which fire back down the same nerve and make the quadriceps contract. The brain is not in the loop, which is why it is so fast.</p>
      <div class="stat"><div><b class="r1">0</b><span>Path one way (m)</span></div><div><b class="r2">0</b><span>Conduction (ms)</span></div><div><b class="r3">0</b><span>Total, about (ms)</span></div></div>
      <div class="row"><button class="btn sm rt">Tap the tendon</button><span class="hint rs" style="flex:1">Shown 60 times slower than real</span></div></div>`);
    ctx.panel.append(reflexBox);
    const vel = ctx.slider({ label: 'Fibre conduction velocity', min: 10, max: 120, step: 1, value: 80, fmt: (x) => `${Math.round(x)} m/s`, onInput: () => reflexStats() });
    reflexBox.append(vel);
    const info = infoCard(ctx); ctx.panel.append(info);
    ctx.panel.append(ctx.h(`<details class="more"><summary>The cord, roots and nerves</summary><div>
      <p>The spinal cord is shorter than the spine. In adults it ends at about the L1 to L2 level (the conus medullaris). Below that the canal holds the <b>cauda equina</b>, which is why a lumbar puncture is done at L3 to L4 or L4 to L5.</p>
      <p>There are 31 pairs of spinal nerves: 8 cervical, 12 thoracic, 5 lumbar, 5 sacral and 1 coccygeal. Each joins the cord by a dorsal (sensory) root and a ventral (motor) root. Nerves to the limbs mix in plexuses first: the brachial plexus (C5 to T1) for the arm and the lumbosacral plexus (L1 to S4) for the leg.</p>
      <p>The nerves here are schematic paths placed on this skeleton by following bone landmarks (for example the median nerve through the carpal tunnel, the ulnar behind the medial epicondyle). They are not scanned shapes, and real nerves branch far more.</p></div></details>`));
    ctx.panel.append(ctx.h(`<div class="card deep"><p><b>Conduction velocity</b> depends on fibre diameter and myelin. Large myelinated Aα and Ia fibres from muscle spindles conduct at about 70 to 120 m/s, thin myelinated Aδ pain fibres at about 5 to 30 m/s, and unmyelinated C fibres at about 0.5 to 2 m/s. Signals jump from one gap in the myelin (node of Ranvier) to the next. How the action potential itself works is in <a href="../bio-lab/#neuron">Bio Lab: The action potential</a>.</p>
      <p>Reflex levels are a quick neurological exam: biceps C5 to C6, triceps C7, knee L3 to L4, ankle S1. A brisk reflex with increased tone suggests an upper motor neuron problem (brain or cord); a weak or absent one suggests a lower motor neuron, root or nerve problem.</p></div>`));
    ctx.quiz([
      { q: 'Which lobe holds the primary visual cortex?', choices: ['Temporal', 'Occipital', 'Parietal'], answer: 1, why: 'Vision is processed at the back of the brain, in the occipital lobe.' },
      { q: 'Damage to the left precentral gyrus would most likely cause...', choices: ['Weakness of the right side of the body', 'Loss of vision in the left eye', 'Numbness of the left hand'], answer: 0, why: 'The precentral gyrus is motor cortex, and each side controls the opposite side of the body.' },
      { q: 'In an adult, the spinal cord itself usually ends at about...', choices: ['The base of the skull', 'L1 to L2', 'The tip of the coccyx'], answer: 1, why: 'Below about L1 to L2 the canal holds nerve roots, the cauda equina.' },
    ]);

    // lobe chips
    let focus = null;
    for (const [k, l] of Object.entries(LOBES)) {
      const b = ctx.h(`<button class="chip" style="border-color:#${l.col.toString(16).padStart(6, '0')}">${l.label}</button>`);
      b.addEventListener('click', () => {
        focus = focus === k ? null : k;
        lobeBox.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b && focus === k));
        recolor();
        if (focus) info.set(l.label, l.job, 'Brain region');
      });
      lobeBox.append(b);
    }

    const views = { front: [0, 0.05, 1], side: [-1, 0.1, 0.05], back: [0, 0.1, -1], top: [0, 1, 0.1] };
    const vg = group(ctx, 'View', [['front', 'Front'], ['side', 'Side'], ['back', 'Back'], ['top', 'Top']], (k) => view(k));
    dock(ctx, [vg]);
    const boxes = {
      brain: new THREE.Box3(new THREE.Vector3(-0.08, 1.5, -0.1), new THREE.Vector3(0.08, 1.7, 0.08)),
      nerves: new THREE.Box3(new THREE.Vector3(-0.34, 0, -0.15), new THREE.Vector3(0.34, 1.73, 0.15)),
      reflex: new THREE.Box3(new THREE.Vector3(-0.05, 0.2, -0.35), new THREE.Vector3(0.16, 1.2, 0.12)),
    };
    let mode = 'brain';
    const view = (k) => v.frame(boxes[mode], { dir: mode === 'reflex' && k === 'front' ? [1, 0.12, 0.25] : views[k], pad: mode === 'brain' ? 1.2 : 1.08 });
    v.frame(boxes.brain, { dir: [-1, 0.1, 0.05], pad: 1.2, dur: 0 });

    let br = null; let sk = null; let nerves = null; let mu = null; let P = null;
    const recolor = () => {
      if (!br) return;
      br.colorAll((it) => {
        if (/nerve|chiasm|optic tract|ganglion/i.test(it.name)) return 0xF2C94C;
        if (it.cat === 'ventricles') return 0x7FB6E0;
        const lb = lobeOf(it.name); const col = LOBES[lb]?.col ?? 0x9AA4B2;
        if (focus && lb !== focus) return 0x3A3A38;
        return col;
      });
    };
    // Reflex scene: the left leg turns at the knee
    const legG = new THREE.Group(); const kneePivot = new THREE.Group(); legG.add(kneePivot); v.root.add(legG); legG.visible = false;
    const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.009, 16, 12), new THREE.MeshBasicMaterial({ color: C.c2, depthTest: false, transparent: true }));
    pulse.renderOrder = 30; pulse.visible = false; v.root.add(pulse);
    const hammer = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), new THREE.MeshBasicMaterial({ color: C.c1, transparent: true, opacity: 0.9 }));
    hammer.visible = false; v.root.add(hammer);
    v.own(pulse); v.own(hammer);
    let reflex = null; let kneeBase = 60; let tendon = null; let path = null; let pathLen = 0;

    function setMode(k) {
      mode = k;
      lobeBox.hidden = k !== 'brain'; reflexBox.hidden = k !== 'reflex';
      if (!br) return;
      br.show(k !== 'reflex'); br.opacity(k === 'nerves' ? 0.85 : 1);
      sk.opacity(k === 'brain' ? 0.08 : k === 'nerves' ? 0.14 : 0);
      if (nerves) {
        nerves.visible = k !== 'brain';
        nerves.traverse((o) => { if (o.userData.nerve) o.visible = k === 'nerves' || ['cord', 'cauda', 'femoral', 'roots'].includes(o.userData.nerve) && (o.userData.nerve !== 'roots' || ['L2', 'L3', 'L4'].includes(o.userData.level)); });
      }
      legG.visible = k === 'reflex'; hammer.visible = k === 'reflex';
      if (mu) { mu.show(k === 'reflex'); }
      v.labels = [];
      view(k === 'brain' ? 'side' : 'front');
      if (k === 'reflex') reflexStats();
    }
    function reflexStats() {
      if (!pathLen) return;
      const ms = pathLen / vel.value * 1000;
      reflexBox.querySelector('.r1').textContent = pathLen.toFixed(2);
      reflexBox.querySelector('.r2').textContent = (2 * ms).toFixed(1);
      reflexBox.querySelector('.r3').textContent = Math.round(2 * ms + 1 + 6);
      reflexBox.querySelector('.rs').textContent = `Two trips of ${pathLen.toFixed(2)} m at ${Math.round(vel.value)} m/s, plus about 1 ms at the synapse and a few ms for the muscle to respond. Shown 60 times slower.`;
    }
    function tap() {
      if (!path) return;
      reflex = { t: 0, phase: 0 };
      info.set('Patellar reflex', 'Stretch, sensory signal in, one synapse, motor signal out, kick.', 'Reflex arc');
    }
    reflexBox.querySelector('.rt').addEventListener('click', tap);
    v.every((dt) => {
      if (!reflex || mode !== 'reflex') return false;
      const slow = 60; const ms = pathLen / vel.value * 1000; const T = ms * slow / 1000; // seconds per leg of the trip
      reflex.t += dt * (reducedMotion ? 0.6 : 1);
      const t = reflex.t;
      const tapT = 0.35;
      const hp = tendon.clone().add(new THREE.Vector3(0, 0, 0.05 * Math.max(0, 1 - t / tapT)));
      hammer.position.copy(hp);
      pulse.visible = t > tapT && t < tapT + 2 * T + 0.3;
      if (t > tapT && t < tapT + T) { pulse.material.color.set(C.c2); pulse.position.copy(path.getPointAt(1 - (t - tapT) / T)); }
      else if (t >= tapT + T && t < tapT + T + 0.3) { pulse.material.color.set('#ffffff'); pulse.scale.setScalar(1.6); }
      else if (t >= tapT + T + 0.3 && t < tapT + 2 * T + 0.3) { pulse.scale.setScalar(1); pulse.material.color.set(C.c1); pulse.position.copy(path.getPointAt((t - tapT - T - 0.3) / T)); }
      const tk = tapT + 2 * T + 0.3;
      let ext = 0;
      if (t > tk) { const u = (t - tk) / 0.9; ext = u < 1 ? Math.sin(Math.PI * Math.min(1, u)) * 32 : 0; }
      if (mu) mu.colorAll((it) => (/left (rectus femoris|vastus)/i.test(it.name) ? (t > tk && t < tk + 0.9 ? 0xFF7A6E : 0xB4564C) : colorFor.muscle(it)));
      kneePivot.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(kneeBase - ext));
      if (t > tk + 1.2) { reflex = null; pulse.visible = false; }
      return true;
    });

    Promise.all([
      v.addPack('brain', { color: colorFor.brain }),
      v.addPack('skel', { color: colorFor.skel, opacity: 0.08, pickable: false }),
      paths(), loadPack('skel'),
    ]).then(async ([b, s, pp, skp]) => {
      note.done(); if (!b) return;
      br = b; sk = s; P = pp; recolor();
      nerves = await nerveGroup(v); nerves.visible = false;
      const prevPick = v.extraPick;
      v.extraPick = (ray) => {
        const base = prevPick ? prevPick(ray) : null;
        if (mode !== 'reflex' || !tendon) return base;
        const d = ray.distanceToPoint(tendon);
        if (d > 0.035) return base;
        return { d: ray.origin.distanceTo(tendon) - 0.1, key: 'tendon', item: { name: 'Patellar tendon' }, point: tendon.clone() };
      };
      // reflex leg: femur and above fixed, tibia, fibula and foot turn about the knee
      const kc = new THREE.Vector3(...P.joints.knee_L.c);
      kneePivot.position.copy(kc);
      const boneM = new THREE.MeshStandardMaterial({ color: 0xE6DCC6, roughness: 0.6 });
      for (const it of skp.items) {
        const below = /^left (tibia|fibula|talus|calcaneus|cuboid bone|\w+ cuneiform bone|\w+ metatarsal bone)$|navicular bone of left foot|of left (big|second|third|fourth|little) toe|sesamoid bone of left foot/i.test(it.name);
        const above = /^(left femur|left patella|left hip bone|right hip bone|sacrum|\w+ lumbar vertebra|\w+ thoracic vertebra)$/i.test(it.name);
        if (!below && !above) continue;
        const m = new THREE.Mesh(itemGeometry(skp, it), boneM); m.userData.item = it; m.userData.own = true;
        if (below) { m.position.sub(kc); kneePivot.add(m); } else legG.add(m);
      }
      v.own(legG);
      kneePivot.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(kneeBase));
      const pat = skp.byName.get('Left patella'); tendon = pat.center.clone().add(new THREE.Vector3(0, -0.045, 0.022));
      // sensory route: tendon, up the femoral nerve to the L3 and L4 cord segments
      const fem = P.nerves.L.femoral.map((q) => new THREE.Vector3(...q)).reverse();
      const cordIn = new THREE.Vector3(...P.nerves.roots.L3L[0]);
      path = new THREE.CatmullRomCurve3([tendon.clone().add(new THREE.Vector3(0, 0.02, 0.01)), ...fem, cordIn], false, 'centripetal');
      pathLen = path.getLength();
      v.addPack('muscle', { color: colorFor.muscle, filter: (it) => /left (rectus femoris|vastus|sartorius|biceps femoris|semitendinosus|semimembranosus)/i.test(it.name) }).then((m) => { if (!m) return; mu = m; mu.show(mode === 'reflex'); });
      setMode(mode);
    }).catch((e) => { console.error(e); note.fail(); });

    v.hover = (h) => h.item.name;
    v.onPick = (h) => {
      br?.highlight(-1); mu?.highlight(-1);
      if (!h) { v.labels = []; return; }
      if (h.key === 'tendon') { tap(); return; }
      if (h.pv) h.pv.highlight(h.item.k);
      if (h.key === 'brain') {
        const lb = lobeOf(h.item.name); const L = LOBES[lb];
        info.set(h.item.name, `${ctx.esc(describe(h.item))}${L && L.label !== h.item.name ? `<br><b>${L.label}:</b> ${ctx.esc(L.job)}` : ''}`, L ? L.label : 'Brain');
      } else if (h.nerve) info.set(h.item.name, h.item.info || (NERVE_INFO[h.nerve] || [])[1] || '', 'Nerve (schematic path)');
      else info.set(h.item.name, describe(h.item), h.key === 'muscle' ? 'Muscle' : 'Structure');
      v.labels = [{ pos: h.point, text: h.item.name, on: true }]; v.dirty = true;
    };
  },
};
