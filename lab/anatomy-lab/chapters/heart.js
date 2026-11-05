// Chapter 6: heart and circulation. Chambers and valves, then blood particles moving round both circuits on the model's own vessels.
import { THREE, Viewer, infoCard, dock, group, loadingNote, paths, reducedMotion } from '../engine.js';
import { colorFor } from '../body.js';
import { describe } from '../facts.js';

const GREAT = /aorta|pulmonary|vena cava|brachiocephalic|common carotid|subclavian|coronary|cardiac vein|coronary sinus|interventricular|azygos/i;
const SUPPLY = [
  [/ascending aorta|arch of aorta/i, 'The whole body except the lungs. The coronary arteries leave the aortic root to feed the heart muscle itself.'],
  [/descending aorta|thoracic aorta/i, 'Chest wall (intercostal arteries), oesophagus and bronchi, then everything below the diaphragm.'],
  [/abdominal aorta/i, 'Gut (coeliac trunk, superior and inferior mesenteric arteries), kidneys, adrenals, gonads, then the legs.'],
  [/common carotid/i, 'Head and neck: the internal carotid to the brain and eye, the external carotid to the face, scalp and neck.'],
  [/internal carotid/i, 'Brain (anterior and middle cerebral arteries) and eye (ophthalmic artery).'],
  [/vertebral artery/i, 'Back of the brain, brainstem and cerebellum, via the basilar artery.'],
  [/subclavian artery/i, 'Arm, plus the vertebral artery to the brain and the internal thoracic artery to the chest wall.'],
  [/brachiocephalic artery/i, 'Right arm (right subclavian) and right side of the head and neck (right common carotid).'],
  [/axillary artery|brachial artery/i, 'Shoulder and arm muscles, then the forearm and hand.'],
  [/radial|ulnar artery/i, 'Forearm and hand. Together they form the palmar arches.'],
  [/common iliac artery/i, 'Pelvis (internal iliac) and leg (external iliac).'],
  [/external iliac artery|femoral artery/i, 'The leg. Becomes the femoral artery under the inguinal ligament.'],
  [/popliteal|tibial artery|dorsalis pedis|plantar/i, 'Lower leg and foot.'],
  [/renal artery/i, 'The kidney.'],
  [/celiac|splenic artery|hepatic artery|gastric/i, 'Foregut: stomach, liver, spleen, pancreas and the first part of the duodenum.'],
  [/superior mesenteric artery/i, 'Midgut: small intestine to two thirds along the transverse colon.'],
  [/inferior mesenteric artery/i, 'Hindgut: the last third of the transverse colon to the upper rectum.'],
  [/coronary/i, 'Heart muscle. Blockage of these arteries causes a heart attack.'],
  [/pulmonary trunk|pulmonary artery/i, 'Carries oxygen poor blood from the right ventricle to the lungs.'],
  [/pulmonary vein/i, 'Brings oxygen rich blood from the lungs to the left atrium.'],
  [/superior vena cava/i, 'Drains the head, neck, arms and upper chest into the right atrium.'],
  [/inferior vena cava/i, 'Drains the legs, pelvis and abdomen into the right atrium.'],
  [/jugular/i, 'Drains the brain, face and neck.'],
  [/portal vein/i, 'Carries blood from the gut, spleen and pancreas to the liver before it returns to the heart.'],
  [/saphenous|cephalic|basilic/i, 'A superficial vein, under the skin. Often used for drips, blood tests or bypass grafts.'],
];
const supplyOf = (n) => (SUPPLY.find(([re]) => re.test(n)) || [null, ''])[1];

export default {
  mount(ctx) {
    const v = new Viewer(ctx, { minDist: 0.06 });
    const note = loadingNote(ctx);
    const C = ctx.colors;
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Heart and circulation</h2>'),
      ctx.h('<p class="lede">The heart is two pumps side by side. The right pumps blood through the lungs, the left pumps it round everything else.</p>'),
      ctx.h(`<div class="card tip"><p>Blood low in oxygen (blue here) comes back from the body in the venae cavae to the <b>right atrium</b>, drops through the tricuspid valve into the <b>right ventricle</b> and is pumped out along the pulmonary arteries to the lungs. There it picks up oxygen and turns red.</p><p>It returns in the pulmonary veins to the <b>left atrium</b>, passes the mitral valve into the <b>left ventricle</b> and is pumped into the aorta, which branches to every organ. In the tiny capillaries it hands over oxygen and starts the trip back. One full loop: body, heart, lungs, heart, body.</p></div>`),
      ctx.h('<div class="card try"><p>Watch a single red dot leave the left ventricle, travel to a foot, turn blue in the capillaries and come back up the inferior vena cava. Switch to <b>Heart</b> to see the four chambers and valves, and tap any vessel to see what it supplies.</p></div>'),
    );
    const modeSeg = ctx.seg([['body', 'Whole body'], ['heart', 'Heart']], 'body', (k) => setMode(k));
    const circSeg = ctx.seg([['both', 'Both circuits'], ['pul', 'Pulmonary'], ['sys', 'Systemic']], 'both', (k) => { circ = k; });
    const row = ctx.h('<div style="display:grid;gap:8px"></div>'); row.append(modeSeg, circSeg); ctx.panel.append(row);
    const hr = ctx.slider({ label: 'Heart rate', min: 40, max: 160, step: 1, value: 70, fmt: (x) => `${Math.round(x)} bpm`, onInput: (x) => { bpm = x; stats(); } });
    ctx.panel.append(hr);
    const st = ctx.h('<div class="stat"><div><b class="s1">4.9</b><span>Litres per minute</span></div><div><b class="s2">0.86</b><span>Seconds per beat</span></div><div><b class="s3">70</b><span>ml per beat</span></div></div>');
    ctx.panel.append(st);
    ctx.panel.append(ctx.h('<div class="legend"><span><i style="background:#F05454"></i>Oxygen rich</span><span><i style="background:#5B8DEF"></i>Oxygen poor</span><span class="hint">Flow is sped up so you can follow it.</span></div>'));
    const info = infoCard(ctx); ctx.panel.append(info);
    ctx.panel.append(ctx.h(`<details class="more"><summary>Cardiac output, worked through</summary><div>
      <div class="formula">CO = HR × SV<span>cardiac output = heart rate × stroke volume</span></div>
      <p>At rest a typical adult heart beats about 70 times a minute and ejects about 70 ml each beat, so it moves roughly 5 litres a minute, about the whole blood volume. In hard exercise heart rate can pass 180 and stroke volume rises too, so output can reach 20 to 25 litres a minute.</p>
      <p>The stroke volume shown here is held at 70 ml so you can see how heart rate alone changes output. In real life very fast rates shorten filling time and stroke volume falls. The electrical side of each beat and the pressure curves are in <a href="../bio-lab/#heart">Bio Lab: The heart</a>.</p></div></details>`));
    ctx.panel.append(ctx.h(`<div class="card deep"><p><b>Arteries carry blood away from the heart, veins carry it towards the heart</b>, whatever its oxygen. So the pulmonary arteries carry oxygen poor blood and the pulmonary veins oxygen rich blood. In the fetus, the foramen ovale and ductus arteriosus bypass the lungs; they normally close soon after birth.</p>
      <p>The left ventricle wall is about three times thicker than the right because systemic pressure (about 120/80 mmHg) is much higher than pulmonary pressure (about 25/10 mmHg). Valves only let blood go one way: the atrioventricular valves (tricuspid, mitral) close at the start of systole (the first heart sound), the semilunar valves (pulmonary, aortic) at the end (the second).</p>
      <p>The routes the dots follow are traced from the centrelines of this model's own vessel meshes. Inside the heart they go through the centres of the chambers and valves.</p></div>`));
    ctx.quiz([
      { q: 'Which chamber pumps blood into the aorta?', choices: ['Right ventricle', 'Left ventricle', 'Left atrium'], answer: 1, why: 'The left ventricle pumps oxygen rich blood into the aorta and round the body.' },
      { q: 'Which vessels carry oxygen rich blood?', choices: ['Pulmonary arteries', 'Pulmonary veins', 'Venae cavae'], answer: 1, why: 'Pulmonary veins bring freshly oxygenated blood from the lungs to the left atrium.' },
      { q: 'With a heart rate of 60 per minute and a stroke volume of 80 ml, cardiac output is...', choices: ['4.8 litres per minute', '1.4 litres per minute', '140 ml per minute'], answer: 0, why: '60 × 80 ml = 4800 ml per minute.' },
    ]);
    let bpm = 70;
    function stats() {
      st.querySelector('.s1').textContent = (bpm * 0.07).toFixed(1);
      st.querySelector('.s2').textContent = (60 / bpm).toFixed(2);
    }

    let mode = 'body'; let circ = 'both';
    const fullBox = new THREE.Box3(new THREE.Vector3(-0.34, 0, -0.15), new THREE.Vector3(0.34, 1.73, 0.15));
    const heartBox = new THREE.Box3(new THREE.Vector3(-0.07, 1.22, -0.06), new THREE.Vector3(0.11, 1.42, 0.09));
    const vg = group(ctx, 'View', [['front', 'Front'], ['side', 'Side'], ['back', 'Back']], (k) => view(k));
    dock(ctx, [vg]);
    const view = (k) => v.frame(mode === 'heart' ? heartBox : fullBox, { dir: k === 'side' ? [1, 0.05, 0.1] : k === 'back' ? [0, 0.05, -1] : mode === 'heart' ? [0.15, 0.1, 1] : [0, 0.05, 1], pad: mode === 'heart' ? 1.25 : 1.06 });
    v.frame(fullBox, { dir: [0, 0.05, 1], pad: 1.06, dur: 0 });

    let packs = {};
    function setMode(k) {
      mode = k;
      if (!packs.ves) return;
      const H = k === 'heart';
      packs.sk.opacity(H ? 0.07 : 0.1);
      packs.ves.filter((it) => !H || GREAT.test(it.name));
      packs.ves.opacity(H ? 1 : 0.45);
      packs.wall.opacity(H ? 0.32 : 0.6);
      packs.lung?.opacity(H ? 0.0 : 0.13);
      v.labels = H ? chamberLabels() : [];
      view('front');
    }
    function chamberLabels() {
      const L = [];
      const add = (pv, n, text, col) => { const it = pv.item(n); if (it) L.push({ pos: pv.worldCenter(it), text, color: col }); };
      add(packs.inner, 'Right atrium cavity', 'Right atrium', '#8FB0F5'); add(packs.inner, 'Right ventricle cavity', 'Right ventricle', '#8FB0F5');
      add(packs.inner, 'Left atrium cavity', 'Left atrium', '#F59A9A'); add(packs.inner, 'Left ventricle cavity', 'Left ventricle', '#F59A9A');
      add(packs.ves, 'Arch of aorta', 'Aorta', '#F59A9A'); add(packs.ves, 'Superior vena cava', 'Superior vena cava', '#8FB0F5'); add(packs.ves, 'Pulmonary trunk', 'Pulmonary trunk', '#8FB0F5');
      return L;
    }

    // Particles
    let loops = []; let pts = null; let N = 0; const parts = [];
    const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
    function buildLoops(R) {
      const sides = ['L', 'R']; const regions = ['leg', 'arm', 'head', 'kid'];
      const out = [];
      for (const s of sides) for (const r of regions) for (const lung of sides) {
        const segs = [[R[`art_${r}_${s}`], 1, 'sys'], [R[`ven_${r}_${s}`], 0, 'sys'], [R[`pul_art_${lung}`], 0, 'pul'], [R[`pul_vein_${lung}`], 1, 'pul']];
        const P = []; const O = []; const K = []; const A = [];
        for (const [seg, ox, kind] of segs) {
          if (!seg) continue;
          for (let i = 0; i < seg.length; i++) {
            const t = i / (seg.length - 1);
            P.push(new THREE.Vector3(...seg[i])); K.push(kind);
            // colour changes in the capillaries: arteries end red then fade, lungs turn blood red
            O.push(ox === 1 ? (kind === 'sys' ? (t > 0.94 ? 1 - (t - 0.94) / 0.06 : 1) : 1) : (kind === 'pul' ? (t > 0.94 ? (t - 0.94) / 0.06 : 0) : 0));
            A.push(ox === 1 && kind === 'sys');
          }
        }
        const S = [0]; for (let i = 1; i < P.length; i++) S.push(S[i - 1] + P[i].distanceTo(P[i - 1]));
        out.push({ P, O, K, A, S, len: S[S.length - 1], w: r === 'leg' ? 3 : r === 'arm' ? 2 : r === 'head' ? 2.2 : 1.4 });
      }
      return out;
    }
    function sample(L, s, outP) {
      // binary search along cumulative length
      let lo = 0; let hi = L.S.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L.S[m] < s) lo = m; else hi = m; }
      const t = (s - L.S[lo]) / Math.max(1e-6, L.S[hi] - L.S[lo]);
      outP.lerpVectors(L.P[lo], L.P[hi], t);
      return { o: L.O[lo] + (L.O[hi] - L.O[lo]) * t, k: L.K[lo], a: L.A[lo] };
    }
    function makeParticles() {
      const totalW = loops.reduce((a, l) => a + l.w, 0);
      N = reducedMotion ? 220 : 520;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 3); const col = new Float32Array(N * 3);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      for (let i = 0; i < N; i++) {
        let r = Math.random() * totalW; let li = 0; while (r > loops[li].w && li < loops.length - 1) { r -= loops[li].w; li++; }
        parts.push({ li, s: Math.random() * loops[li].len, j: (Math.random() - 0.5) * 0.004, k: (Math.random() - 0.5) * 0.004 });
      }
      const mat = new THREE.PointsMaterial({ size: 0.011, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, alphaTest: 0.02 });
      pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 20; pts.userData.own = true;
      v.root.add(pts);
    }
    const red = new THREE.Color(0xF05454); const blue = new THREE.Color(0x5B8DEF); const tmp = new THREE.Color(); const pv3 = new THREE.Vector3();
    let clock = 0;
    v.every((dt) => {
      if (!pts) return false;
      clock += dt;
      const ph = (clock * bpm / 60) % 1;
      const pulse = ph < 0.35 ? Math.sin(Math.PI * ph / 0.35) : 0;
      const base = 0.07 * (bpm / 70) * (reducedMotion ? 0.5 : 1);
      const pos = pts.geometry.attributes.position.array; const col = pts.geometry.attributes.color.array;
      const sizeK = mode === 'heart' ? 0.45 : 1;
      pts.material.size = 0.011 * sizeK;
      for (let i = 0; i < N; i++) {
        const p = parts[i]; const L = loops[p.li];
        let r = sample(L, p.s, pv3);
        const sp = r.a ? base * (0.55 + 2.2 * pulse) : r.k === 'pul' ? base * (0.8 + 1.2 * pulse) : base * 0.85;
        p.s += sp * dt;
        if (p.s >= L.len) p.s -= L.len;
        r = sample(L, p.s, pv3);
        const show = circ === 'both' || (circ === 'pul' ? r.k === 'pul' : r.k === 'sys');
        pos[i * 3] = pv3.x + p.j * sizeK; pos[i * 3 + 1] = pv3.y + p.k * sizeK; pos[i * 3 + 2] = pv3.z + (show ? 0 : 1e4);
        tmp.copy(blue).lerp(red, r.o);
        col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
      }
      pts.geometry.attributes.position.needsUpdate = true; pts.geometry.attributes.color.needsUpdate = true;
      return true;
    });

    Promise.all([
      v.addPack('skel', { key: 'sk', color: () => 0xE6DCC6, opacity: 0.1, pickable: false }),
      v.addPack('vessels', { key: 'ves', color: colorFor.vessels, opacity: 0.45 }),
      v.addPack('heart', { key: 'wall', color: colorFor.heart, filter: (it) => it.cat === 'heart', opacity: 0.6 }),
      v.addPack('heart', { key: 'inner', color: colorFor.heart, filter: (it) => it.cat !== 'heart' }),
      v.addPack('organs', { key: 'lung', color: colorFor.organs, filter: (it) => /lung/i.test(it.name), opacity: 0.13, pickable: false }),
      paths(),
    ]).then(([sk, ves, wall, inner, lung, P]) => {
      note.done(); if (!ves) return;
      packs = { sk, ves, wall, inner, lung };
      loops = buildLoops(P.routes); makeParticles(); setMode('body');
    }).catch((e) => { console.error(e); note.fail(); });

    v.hover = (h) => h.item.name;
    v.onPick = (h) => {
      for (const pv of Object.values(packs)) pv?.highlight(-1);
      v.labels = mode === 'heart' ? chamberLabels() : [];
      if (!h) return;
      h.pv.highlight(h.item.k);
      const isV = h.key === 'ves';
      const kind = isV ? (h.item.cat === 'venous' ? 'Vein' : 'Artery') : 'Heart';
      const sup = isV ? supplyOf(h.item.name) : '';
      const supTxt = !sup ? '' : /^(Drains|Carries|Brings|A superficial)/.test(sup) ? sup : `<b>Supplies:</b> ${ctx.esc(sup)}`;
      const d = describe(h.item);
      info.set(h.item.name, `${supTxt}${supTxt && d && d !== sup ? '<br>' : ''}${d !== sup ? ctx.esc(d) : ''}`, kind);
      v.labels.push({ pos: h.point, text: h.item.name, on: true }); v.dirty = true;
    };
    return () => dotTex.dispose();
  },
};
