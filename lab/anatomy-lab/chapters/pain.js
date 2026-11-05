// Chapter 8: pain. A pain signal travelling from skin to cortex on this body, a dermatome map on the skin, and referred pain from organs.
import { THREE, Viewer, infoCard, dock, group, loadingNote, loadPack, itemGeometry, paths, tube, reducedMotion } from '../engine.js';
import { colorFor, nerveGroup } from '../body.js';
import { dermatomeAt, LEVEL_NOTE } from '../dermatomes.js';

const LEVELS = ['V1', 'V2', 'V3', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'L1', 'L2', 'L3', 'L4', 'L5', 'S1', 'S2', 'S3', 'S4'];
function levelColor(lv) {
  const i = LEVELS.indexOf(lv); if (i < 0) return new THREE.Color(0x777777);
  // neighbouring levels get far apart hues so each strip stands out
  return new THREE.Color().setHSL((i * 0.381966 + 0.08) % 1, 0.58, i % 2 ? 0.6 : 0.47);
}

const REFERRED = {
  heart: { label: 'Heart (angina, heart attack)', organs: { heart: () => true }, levels: 'T1 to T4', text: 'Pain from heart muscle short of oxygen enters the cord at about T1 to T4, the same segments that carry feeling from the chest wall and inner arm. It is felt as central chest pressure that can spread to the left arm, the neck and jaw.', paint: (p, d) => (d === 'T1' || d === 'C8' ? (p.x > 0 ? 1 : 0) : 0) || (p.z > 0.03 && p.y > 1.24 && p.y < 1.38 && p.x > -0.06 && p.x < 0.13 ? 1 : 0) || (p.y > 1.48 && p.y < 1.56 && p.z > 0.0 && p.x > -0.01 ? 0.8 : 0) },
  diaphragm: { label: 'Diaphragm', organs: { muscle: (it) => it.name === 'Diaphragm' }, levels: 'C3 to C5 (phrenic nerve)', text: 'The middle of the diaphragm is supplied by the phrenic nerve (C3, C4, C5). Irritation from below, such as blood or air under it, is felt at the tip of the shoulder, the C4 dermatome.', paint: (p, d) => (d === 'C4' && p.y > 1.37 && Math.abs(p.x) > 0.08 ? 1 : 0) },
  appendix: { label: 'Appendix (appendicitis)', organs: { organs: (it) => /appendix/i.test(it.name) }, levels: 'T10, then local', stages: true, text: 'Early on, the inflamed appendix stretches gut wall supplied by T10, so pain is vague and around the navel. When inflammation reaches the parietal peritoneum, which has its own somatic nerves, the pain moves to the right lower quadrant over McBurney\'s point.', paint: (p, d, stage) => (stage === 0 ? (Math.hypot(p.x, p.y - 1.05) < 0.055 && p.z > 0.04 ? 1 - Math.hypot(p.x, p.y - 1.05) / 0.055 * 0.5 : 0) : (Math.hypot(p.x + 0.075, p.y - 1.015) < 0.04 && p.z > 0.03 ? 1 - Math.hypot(p.x + 0.075, p.y - 1.015) / 0.04 * 0.5 : 0)) },
  kidney: { label: 'Kidney and ureter (renal colic)', organs: { organs: (it) => /left kidney|left ureter/i.test(it.name) }, levels: 'T10 to L1', text: 'A stone stretching the ureter gives waves of severe pain in the loin (flank) that sweeps round to the groin, following the T10 to L1 dermatomes, and in men can reach the testis.', paint: (p, d) => (p.x > 0 && ['T10', 'T11', 'T12', 'L1'].includes(d) && !(p.z > 0.06 && p.x < 0.05 && p.y > 1.0) ? (p.z < 0.02 ? 1 : 0.65) : 0) },
  gallbladder: { label: 'Gallbladder (biliary colic)', organs: { organs: (it) => /gallbladder|bile/i.test(it.name) }, levels: 'T6 to T9, and C3 to C5', text: 'Gallbladder pain sits in the right upper quadrant and the epigastrium (T6 to T9). If the inflamed gallbladder touches the diaphragm it can also be felt at the right shoulder tip or under the right shoulder blade.', paint: (p, d) => (p.z > 0.04 && p.x < 0.02 && p.x > -0.13 && p.y > 1.12 && p.y < 1.23 ? 1 : 0) || (p.x < -0.06 && p.z < -0.07 && p.y > 1.22 && p.y < 1.32 && p.x > -0.14 ? 0.85 : 0) || (d === 'C4' && p.x < -0.08 && p.y > 1.37 ? 0.7 : 0) },
  stomach: { label: 'Stomach and duodenum', organs: { organs: (it) => /stomach|duodenum/i.test(it.name) }, levels: 'T6 to T9', text: 'Foregut organs (stomach, first part of the duodenum, liver, gallbladder, pancreas) refer to the epigastrium, the upper middle abdomen, because the gut starts as a midline tube.', paint: (p) => (p.z > 0.05 && Math.abs(p.x) < 0.07 && p.y > 1.14 && p.y < 1.25 ? 1 : 0) },
};

const SITES = {
  hand: { label: 'Left index finger', nerve: 'median', root: 'C6', side: 'L' },
  foot: { label: 'Right big toe', nerve: 'tibial', root: 'L5', side: 'R' },
  chest: { label: 'Left chest wall', nerve: 'intercostal', root: 'T5', side: 'L' },
};

export default {
  mount(ctx) {
    const v = new Viewer(ctx, { minDist: 0.06 });
    const note = loadingNote(ctx);
    const C = ctx.colors;
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Pain</h2>'),
      ctx.h('<p class="lede">Pain is not in the finger you hit. It is a signal that travels to the spinal cord, then the thalamus, then the cortex, and only there becomes something you feel.</p>'),
      ctx.h(`<div class="card tip"><p>Free nerve endings called <b>nociceptors</b> respond to damage: heat, crushing, chemicals from injured cells. The signal runs along a peripheral nerve to the spinal cord, crosses to the other side, climbs the <b>spinothalamic tract</b> to the <b>thalamus</b> and reaches the <b>somatosensory cortex</b> of the opposite hemisphere.</p><p>Each spinal nerve feels a strip of skin called a <b>dermatome</b>. Organs have far fewer pain fibres, and their signals share spinal segments with skin, so the brain often blames the skin: that is <b>referred pain</b>.</p></div>`),
      ctx.h('<div class="card try"><p>In <b>Pathway</b>, pick a place and press <b>Hurt it</b>: a fast pulse (sharp first pain) and a slow pulse (dull second pain) set off together. In <b>Dermatomes</b>, hover or tap the skin to read its spinal level. In <b>Referred</b>, pick an organ and see where its pain is felt.</p></div>'),
    );
    const modeSeg = ctx.seg([['path', 'Pathway'], ['derm', 'Dermatomes'], ['ref', 'Referred']], 'path', (k) => setMode(k));
    ctx.panel.append(modeSeg);
    // pathway card
    const pc = ctx.h(`<div class="card"><h3>Follow one signal</h3><div class="row ps"></div>
      <ol class="small pl" style="margin:4px 0 0;padding-left:20px;display:grid;gap:3px"></ol>
      <div class="stat"><div><b class="p1">0</b><span>Path (m)</span></div><div><b class="p2">0</b><span>A delta (ms)</span></div><div><b class="p3">0</b><span>C fibre (s)</span></div></div>
      <div class="row"><button class="btn sm pg">Hurt it</button><span class="hint pn" style="flex:1"></span></div></div>`);
    ctx.panel.append(pc);
    const slow = ctx.seg([['fast', 'Watch fast fibres'], ['slow', 'Watch slow fibres']], 'fast', (k) => { speedMode = k; });
    pc.querySelector('.row:last-child').before(slow);
    // dermatome card
    const dc = ctx.h('<div class="card" hidden><h3>Dermatome map</h3><p class="small muted">Hover or tap the skin. Tap a level to light up its strip and its spinal nerve.</p><div class="anat-chips dl"></div><p class="small dd"></p></div>');
    ctx.panel.append(dc);
    // referred card
    const rc = ctx.h('<div class="card" hidden><h3>Referred pain</h3><div class="anat-list rl"></div><p class="small rd"></p><div class="row"><button class="btn ghost sm rs" hidden>Hours later</button></div></div>');
    ctx.panel.append(rc);
    const info = infoCard(ctx); ctx.panel.append(info);
    ctx.panel.append(ctx.h(`<details class="more"><summary>Why the signal crosses, and what it tells a doctor</summary><div>
      <p>First order neurons have their cell bodies in the dorsal root ganglion and end in the dorsal horn. Second order neurons cross in the anterior white commissure within a segment or two and ascend in the anterolateral (spinothalamic) tract. Third order neurons go from the ventral posterolateral nucleus of the thalamus to the postcentral gyrus, where the body is mapped upside down: legs near the midline at the top, face low on the side.</p>
      <p>Touch and vibration take a different route (the dorsal columns) that crosses higher, in the medulla. So a half cut of the cord (Brown Sequard syndrome) loses pain and temperature on the opposite side but touch and position on the same side below the lesion.</p>
      <p>The brain can turn the signal down. Descending pathways from the periaqueductal grey release endogenous opioids and other transmitters in the dorsal horn, and rubbing a knock activates touch fibres that inhibit pain transmission (the gate control idea).</p></div></details>`));
    ctx.panel.append(ctx.h(`<div class="card deep"><p><b>Fast and slow pain.</b> Thin myelinated A delta fibres conduct at roughly 5 to 30 m/s and carry sharp, well localised first pain. Unmyelinated C fibres conduct at about 0.5 to 2 m/s and carry dull, burning second pain. The times on this page use 20 m/s and 1 m/s and the path length measured along this model's own nerves and cord, so stubbing a toe gives a sharp pain well under a tenth of a second later and an ache a second or two after that.</p>
      <p>Dermatome maps differ between textbooks and between people, and neighbouring dermatomes overlap, so losing one root rarely numbs a whole strip. The map here is simplified from standard clinical charts and drawn by rule on this skin, not measured. Landmarks worth knowing: C6 thumb, C7 middle finger, C8 little finger, T4 nipple, T10 umbilicus, L1 groin, L4 medial leg, L5 dorsum of the foot and big toe, S1 lateral foot and heel.</p>
      <p>Referred pain zones also vary. A heart attack can cause no pain at all, especially in older people and people with diabetes, and many women describe breathlessness, nausea or tiredness more than chest pain.</p></div>`));
    ctx.quiz([
      { q: 'A cut on the left hand is consciously felt mainly in the...', choices: ['Left postcentral gyrus', 'Right postcentral gyrus', 'Left cerebellum'], answer: 1, why: 'The spinothalamic pathway crosses in the cord, so the right somatosensory cortex feels the left hand.' },
      { q: 'Which dermatome covers the skin at the level of the umbilicus?', choices: ['T4', 'T10', 'L1'], answer: 1, why: 'T4 is the nipple line, T10 the umbilicus and L1 the groin.' },
      { q: 'Irritation of the diaphragm is often felt at the tip of the shoulder because...', choices: ['The phrenic nerve comes from C3 to C5, which also supply shoulder skin', 'The diaphragm attaches to the shoulder', 'Pain fibres from the diaphragm run in the vagus nerve to the arm'], answer: 0, why: 'C4 carries both diaphragm and shoulder tip sensation, so the brain blames the shoulder.' },
    ]);

    const full = new THREE.Box3(new THREE.Vector3(-0.34, 0, -0.15), new THREE.Vector3(0.34, 1.73, 0.15));
    const vg = group(ctx, 'View', [['front', 'Front'], ['side', 'Side'], ['back', 'Back']], (k) => v.frame(full, { dir: k === 'side' ? [1, 0.05, 0.05] : k === 'back' ? [0, 0.05, -1] : [0, 0.05, 1], pad: 1.06 }));
    dock(ctx, [vg]);
    v.frame(full, { dir: [0, 0.05, 1], pad: 1.06, dur: 0 });

    let mode = 'path'; let speedMode = 'fast'; let site = 'hand'; let refKey = null; let refStage = 0;
    let skinPack = null; let skinMesh = null; let skinItem = null; let skinCol = null; let skinDerm = null; let nerves = null; let br = null; let sk = null; let P = null; let skinGhost = null;
    const xray = new THREE.Group(); v.root.add(xray);
    const pathG = new THREE.Group(); v.root.add(pathG);
    const pulseF = new THREE.Mesh(new THREE.SphereGeometry(0.008, 16, 12), new THREE.MeshBasicMaterial({ color: C.c2, depthTest: false, transparent: true }));
    const pulseS = new THREE.Mesh(new THREE.SphereGeometry(0.008, 16, 12), new THREE.MeshBasicMaterial({ color: C.c4, depthTest: false, transparent: true }));
    for (const p of [pulseF, pulseS]) { p.renderOrder = 30; p.visible = false; v.root.add(p); v.own(p); }
    let curve = null; let stages = []; let len = 0; let run = null;

    // site buttons
    const ps = pc.querySelector('.ps');
    for (const [k, s] of Object.entries(SITES)) {
      const b = ctx.h(`<button class="chip ${k === site ? 'on' : ''}">${s.label}</button>`);
      b.addEventListener('click', () => { site = k; ps.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b)); buildPath(); });
      ps.append(b);
    }
    pc.querySelector('.pg').addEventListener('click', () => { if (curve) run = { t: 0 }; });

    function V(a) { return new THREE.Vector3(...a); }
    function buildPath() {
      if (!P || !br) return;
      pathG.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); pathG.clear();
      const S = SITES[site]; const N = P.nerves; const sd = S.side; const other = sd === 'L' ? 'R' : 'L'; const sx = sd === 'L' ? 1 : -1;
      let periph = [];
      if (S.nerve === 'median') periph = [...N[sd].median].reverse().concat([...N[sd].brachial[1]].reverse().slice(1));
      if (S.nerve === 'tibial') periph = [...N[sd].tibial].reverse().concat([...N[sd].sciatic].reverse().slice(1));
      if (S.nerve === 'intercostal') periph = [...N[sd].intercostal.T5].reverse();
      const root = N.roots[`${S.root}${sd}`];
      const cordPts = N.cord.map(V); // from the medulla down
      // nearest cord point to the root's entry (for L5 the root climbs the cauda equina to the conus)
      let entry = V(root[0]);
      let ci = 0; let best = 1e9;
      const target = S.root === 'L5' ? cordPts[cordPts.length - 2] : entry;
      cordPts.forEach((q, i) => { const d = q.distanceTo(target); if (d < best) { best = d; ci = i; } });
      const pre = periph.map(V); pre.push(V(root[2]), V(root[1]));
      if (S.root === 'L5') { for (const q of [...N.cauda].reverse().slice(1, -1)) pre.push(V(q).add(new THREE.Vector3(sx * 0.002, 0, 0))); }
      const horn = cordPts[ci].clone().add(new THREE.Vector3(sx * 0.003, 0, -0.002));
      pre.push(horn);
      const cross = cordPts[Math.max(0, ci - 1)].clone().add(new THREE.Vector3(-sx * 0.003, 0, 0.002));
      const up = [cross];
      for (let i = ci - 2; i >= 0; i--) up.push(cordPts[i].clone().add(new THREE.Vector3(-sx * 0.003, 0, 0.002)));
      const thal = br.item(`${other === 'L' ? 'Left' : 'Right'} thalamus`);
      const thalP = thal.center.clone();
      up.push(thalP);
      // cortex point on the opposite postcentral gyrus: foot near the midline at the top, hand lower and lateral
      const pg = br.item(`${other === 'L' ? 'Left' : 'Right'} postcentral gyrus`);
      const pos = br.pack.geo.attributes.position.array; let cbest = null; let cs = -1e9;
      for (let i = pg.v0; i < pg.v0 + pg.nv; i++) {
        const x = Math.abs(pos[i * 3]); const y = pos[i * 3 + 1];
        const score = S.root === 'L5' ? y * 3 - x * 4 : S.root === 'T5' ? y * 2 - Math.abs(x - 0.03) * 8 : -Math.abs(x - 0.055) * 6 - Math.abs(y - 1.66) * 2;
        if (score > cs) { cs = score; cbest = new THREE.Vector3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); }
      }
      const all = [...pre, ...up, cbest];
      curve = new THREE.CatmullRomCurve3(all, false, 'centripetal');
      len = curve.getLength();
      // stage boundaries as fractions of length
      const lenTo = (pt) => { const c2 = new THREE.CatmullRomCurve3(all.slice(0, all.indexOf(pt) + 1), false, 'centripetal'); return c2.getLength() / len; };
      stages = [
        { f: 0, t: 'Nociceptor fires in the skin' },
        { f: lenTo(pre[pre.length - 2]), t: `Through the dorsal root ganglion (${S.root})` },
        { f: lenTo(horn), t: 'Synapse 1: dorsal horn of the cord' },
        { f: lenTo(cross), t: 'Crosses to the other side' },
        { f: lenTo(thalP), t: `Synapse 2: ${other === 'L' ? 'left' : 'right'} thalamus` },
        { f: 1, t: `Synapse 3 area: ${other === 'L' ? 'left' : 'right'} somatosensory cortex. Felt.` },
      ];
      const pl = pc.querySelector('.pl');
      pl.innerHTML = stages.map((s, i) => `<li data-i="${i}">${s.t} <span class="mono muted st"></span></li>`).join('');
      pathG.add(tube(curve.getPoints(Math.max(60, Math.round(len / 0.008))), 0.0016, 0xF5F5F0, { opacity: 0.5 }));
      for (const p of [thalP, cbest, horn]) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 12, 10), new THREE.MeshBasicMaterial({ color: C.c1, depthTest: false })); m.position.copy(p); m.renderOrder = 25; pathG.add(m); }
      const startM = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 10), new THREE.MeshBasicMaterial({ color: C.c4, depthTest: false })); startM.position.copy(pre[0]); startM.renderOrder = 25; pathG.add(startM);
      v.own(pathG);
      pc.querySelector('.p1').textContent = len.toFixed(2);
      pc.querySelector('.p2').textContent = Math.round(len / 20 * 1000);
      pc.querySelector('.p3').textContent = (len / 1).toFixed(1);
      br.colorAll((it) => (it === thal || it === pg ? 0x5EEAD4 : 0xD9A7A0));
      v.labels = [{ pos: pre[0], text: S.label, color: C.c4 }, { pos: thalP, text: 'Thalamus', color: C.c1 }, { pos: cbest, text: 'Somatosensory cortex', color: C.c1 }, { pos: horn, text: 'Dorsal horn', color: C.c1 }];
      run = null; pulseF.visible = pulseS.visible = false;
      v.dirty = true;
    }
    v.every((dt) => {
      if (!run || !curve || mode !== 'path') return false;
      run.t += dt * (reducedMotion ? 0.5 : 1);
      const scale = speedMode === 'fast' ? 40 : 3; // times slower than real
      const tf = run.t / scale; // real seconds elapsed
      const ff = Math.min(1, tf * 20 / len); const fs = Math.min(1, tf * 1 / len);
      pulseF.visible = ff < 1 || run.t < 0.3 + len / 20 * scale; pulseS.visible = true;
      pulseF.position.copy(curve.getPointAt(ff)); pulseS.position.copy(curve.getPointAt(fs));
      pulseF.scale.setScalar(ff >= 1 ? 1.8 : 1);
      const lis = pc.querySelectorAll('.pl li');
      stages.forEach((s, i) => {
        const msF = s.f * len / 20 * 1000; const sS = s.f * len / 1;
        const reachedF = ff >= s.f; const reachedS = fs >= s.f;
        lis[i].style.color = reachedF ? 'var(--text)' : 'var(--muted)';
        lis[i].querySelector('.st').textContent = reachedF ? ` ${Math.round(msF)} ms${reachedS ? `, ${sS.toFixed(2)} s` : ''}` : '';
      });
      pc.querySelector('.pn').textContent = speedMode === 'fast' ? 'Fast (A delta, amber) shown 40 times slower than real.' : 'Slow (C fibre, rose) shown 3 times slower than real.';
      if (fs >= 1 && run.t > 2) run = null;
      return true;
    });

    // dermatome chips
    const dl = dc.querySelector('.dl'); let dSel = null;
    for (const lv of LEVELS) {
      const c = levelColor(lv);
      const b = ctx.h(`<button class="chip" style="border-color:#${c.getHexString()};padding:4px 7px">${lv}</button>`);
      b.addEventListener('click', () => { dSel = dSel === lv ? null : lv; dl.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x.textContent === dSel)); paintDerm(); dermInfo(dSel); });
      dl.append(b);
    }
    function dermInfo(lv) {
      dc.querySelector('.dd').textContent = lv ? `${lv}: ${LEVEL_NOTE[lv] || ''}` : '';
      if (nerves) nerves.traverse((o) => { if (o.userData.nerve === 'roots') { o.material = o.material.clone(); o.material.color.set(lv && o.userData.level === lv ? 0x5EEAD4 : 0xF2C94C); o.material.emissiveIntensity = lv && o.userData.level === lv ? 0.8 : 0; } });
    }
    function paintDerm() {
      if (!skinMesh) return;
      const pos = skinMesh.geometry.attributes.position.array; const col = skinCol;
      const base = new THREE.Color(0xE8C4A8);
      for (let i = 0; i < pos.length / 3; i++) {
        const d = skinDerm[i]; let c;
        if (mode === 'derm') { c = levelColor(d); if (dSel && d !== dSel) c = c.clone().lerp(new THREE.Color(0x2A2A2A), 0.82); }
        else if (mode === 'ref' && refKey) {
          const p = { x: pos[i * 3], y: pos[i * 3 + 1], z: pos[i * 3 + 2] };
          const k = REFERRED[refKey].paint(p, d, refStage) || 0;
          c = base.clone().lerp(new THREE.Color(0xF0466A), Math.min(1, k) * 0.9);
        } else c = base;
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      skinMesh.geometry.attributes.color.needsUpdate = true; v.dirty = true;
    }

    // referred list
    const rl = rc.querySelector('.rl');
    for (const [k, r] of Object.entries(REFERRED)) {
      const b = ctx.h(`<button class="btn ghost sm" style="justify-content:flex-start">${r.label}</button>`);
      b.addEventListener('click', () => setRef(k));
      rl.append(b);
    }
    rc.querySelector('.rs').addEventListener('click', () => { refStage = 1 - refStage; rc.querySelector('.rs').textContent = refStage ? 'Back to the start' : 'Hours later'; paintDerm(); });
    async function setRef(k) {
      refKey = k; refStage = 0; const r = REFERRED[k];
      rl.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', Object.keys(REFERRED)[i] === k));
      rc.querySelector('.rd').innerHTML = `<b>${ctx.esc(r.levels)}.</b> ${ctx.esc(r.text)}`;
      rc.querySelector('.rs').hidden = !r.stages; rc.querySelector('.rs').textContent = 'Hours later';
      paintDerm();
      // show the organ as an x-ray overlay
      xray.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); xray.clear();
      for (const [pk, fn] of Object.entries(r.organs)) {
        const pack = await loadPack(pk); if (ctx.signal.aborted || refKey !== k) return;
        for (const it of pack.items) if (fn(it)) {
          const m = new THREE.Mesh(itemGeometry(pack, it), new THREE.MeshBasicMaterial({ color: pk === 'heart' ? 0xE0524C : 0xFBBF24, transparent: true, opacity: 0.55, depthTest: false }));
          m.renderOrder = 15; m.userData.own = true; xray.add(m);
        }
      }
      v.dirty = true;
    }

    function setMode(k) {
      mode = k;
      pc.hidden = k !== 'path'; dc.hidden = k !== 'derm'; rc.hidden = k !== 'ref';
      if (!skinMesh) return;
      skinMesh.visible = k !== 'path'; skinGhost.show(k === 'path');
      pathG.visible = k === 'path'; pulseF.visible = pulseS.visible = false; run = null;
      br.show(k === 'path'); sk.opacity(k === 'path' ? 0.1 : 0);
      if (nerves) { nerves.visible = k !== 'ref'; nerves.traverse((o) => { if (o.userData.nerve) o.visible = k === 'path' ? o.userData.nerve !== 'roots' : o.userData.nerve === 'roots' || o.userData.nerve === 'cord' || o.userData.nerve === 'cauda'; }); }
      xray.visible = k === 'ref';
      skinMesh.material.opacity = k === 'ref' ? 0.82 : 1; skinMesh.material.transparent = k === 'ref'; skinMesh.material.needsUpdate = true;
      v.labels = [];
      if (k === 'path') buildPath(); else paintDerm();
      if (k === 'ref' && !refKey) setRef('heart');
      if (k === 'derm') dermInfo(dSel);
    }

    Promise.all([
      loadPack('skin'), v.addPack('brain', { color: colorFor.brain, opacity: 0.5 }), v.addPack('skel', { color: () => 0xE6DCC6, opacity: 0.1, pickable: false }),
      v.addPack('skin', { key: 'skinGhost', color: colorFor.skin, opacity: 0.12, rim: 0.5, rimColor: 0xF5E6D8, pickable: false, renderOrder: 5, roughness: 0.9 }), paths(),
    ]).then(async ([sp, b, s, sg, pp]) => {
      if (!b) return;
      note.done();
      skinPack = sp; br = b; sk = s; skinGhost = sg; P = pp;
      skinItem = sp.items[0];
      const geo = itemGeometry(sp, skinItem);
      const n = geo.attributes.position.count; skinCol = new Float32Array(n * 3); skinDerm = new Array(n);
      const pa = geo.attributes.position.array;
      for (let i = 0; i < n; i++) skinDerm[i] = dermatomeAt(pa[i * 3], pa[i * 3 + 1], pa[i * 3 + 2]);
      geo.setAttribute('color', new THREE.BufferAttribute(skinCol, 3));
      skinMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
      skinMesh.userData.own = true; skinMesh.visible = false; v.root.add(skinMesh);
      nerves = await nerveGroup(v);
      const prev = v.extraPick;
      v.extraPick = (ray) => {
        if (mode === 'path') return prev ? prev(ray) : null;
        const r = new THREE.Raycaster(); r.ray.copy(ray);
        const h = r.intersectObject(skinMesh, false)[0];
        if (!h) return null;
        const d = dermatomeAt(h.point.x, h.point.y, h.point.z);
        return { d: h.distance, key: 'skin', item: { name: `${d} dermatome`, info: LEVEL_NOTE[d] || '' }, point: h.point, derm: d };
      };
      setMode(mode);
    }).catch((e) => { console.error(e); note.fail(); });

    v.hover = (h) => (h.derm ? `${h.derm}` : h.item.name);
    v.onPick = (h) => {
      br?.highlight(-1);
      if (!h) return;
      if (h.pv) h.pv.highlight(h.item.k);
      info.set(h.item.name, h.item.info || '', h.derm ? 'Dermatome' : h.nerve ? 'Nerve (schematic path)' : 'Brain');
      if (h.derm && mode === 'derm') { dSel = h.derm; dl.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x.textContent === dSel)); paintDerm(); dermInfo(dSel); }
      v.dirty = true;
    };
  },
};
