// Chapter 1: the reality to virtuality continuum (Milgram and Kishino, 1994) as a live slider.
import { THREE, makeGL, makeRoom, addLights, overlay, drag, tex, std, basic, mesh, boxGeo, floorGeo, fade, smooth, lerp, clamp, MONO, DISPLAY, reduced, addDock } from '../lib/xr.js';

const STAGES = [
  { at: 0, end: 0.12, key: 'real', name: 'Real environment', body: 'Only the physical room. Nothing is computer generated. This is the left end of the continuum.', eg: 'Your eyes, or a plain camera feed.' },
  { at: 0.12, end: 0.42, key: 'ar', name: 'Augmented reality', body: 'Virtual content is drawn on top of the real world. Here the floating object ignores the vase in front of it, because simple AR has no idea what is in the room.', eg: 'Phone AR, smart glasses, heads up displays.' },
  { at: 0.42, end: 0.64, key: 'mr', name: 'Mixed reality (AR that understands the room)', body: 'The device knows where the table and vase are, so the virtual robot stands on the real table, casts a shadow and is hidden behind the vase. Today most people mean this when they say MR.', eg: 'Headsets with colour passthrough and scene understanding.' },
  { at: 0.64, end: 0.88, key: 'av', name: 'Augmented virtuality', body: 'Now the world is mostly virtual, and a few real things are brought in: the table stays so you do not walk into it.', eg: 'VR with a passthrough window for your desk or keyboard.' },
  { at: 0.88, end: 1.01, key: 'vr', name: 'Virtual reality', body: 'Everything you see is rendered. The real room is fully replaced. This is the right end of the continuum.', eg: 'A VR headset in full immersion.' },
];

export default {
  mount(ctx) {
    const C = ctx.colors;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 100);
    const lights = addLights(scene);
    const room = makeRoom();
    scene.add(room.group);

    // Virtual world
    const vworld = new THREE.Group();
    const grid = tex.grid(C.c1, '#06121a'); grid.repeat.set(120, 120);
    vworld.add(mesh(floorGeo(60, 60), basic('#ffffff', { map: grid }), 0, 0.002, 0));
    const sky = mesh(new THREE.SphereGeometry(30, 32, 16), basic('#ffffff', { map: tex.sky('#0c1838', '#3a2350'), side: 1 }));
    vworld.add(sky);
    const vcols = [C.c1, C.c2, C.c3, C.c4, C.c5, C.c6];
    const floaters = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2; const r = 6 + (i % 3) * 3;
      const m = mesh(i % 2 ? new THREE.TorusGeometry(0.5, 0.14, 12, 40) : new THREE.SphereGeometry(0.5, 24, 16), std(vcols[i % 6], { emissive: vcols[i % 6], emissiveIntensity: 0.35, roughness: 0.3 }), Math.cos(a) * r, 1.2 + (i % 4) * 0.8, Math.sin(a) * r - 2);
      floaters.push(m); vworld.add(m);
    }
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      vworld.add(mesh(boxGeo(0.25, 4, 0.25), basic(C.c3, { transparent: true, opacity: 0.55 }), Math.cos(a) * 12, 2, Math.sin(a) * 12));
    }
    scene.add(vworld);

    // AR hologram: floats slightly behind the vase
    const holo = new THREE.Group();
    const holoMat = basic(C.c1, { wireframe: true, transparent: true, opacity: 0.9 });
    const holoMat2 = basic(C.c2, { transparent: true, opacity: 0.85 });
    holo.add(mesh(new THREE.SphereGeometry(0.16, 16, 10), holoMat));
    holo.add(mesh(new THREE.TorusGeometry(0.24, 0.012, 8, 48), holoMat2));
    holo.position.set(0.42, 1.0, -0.95);
    scene.add(holo);

    // MR robot: stands on the table, partly behind the vase, with a contact shadow
    const robot = new THREE.Group();
    const rb = std(C.c5, { roughness: 0.35, emissive: '#10306a', emissiveIntensity: 0.4 });
    robot.add(mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.14, 20), rb, 0, 0.07, 0));
    robot.add(mesh(new THREE.SphereGeometry(0.075, 20, 14), rb, 0, 0.21, 0));
    robot.add(mesh(new THREE.SphereGeometry(0.014, 8, 6), basic('#ffffff'), -0.026, 0.225, 0.064));
    robot.add(mesh(new THREE.SphereGeometry(0.014, 8, 6), basic('#ffffff'), 0.026, 0.225, 0.064));
    robot.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6), std('#ddd'), 0, 0.31, 0));
    robot.add(mesh(new THREE.SphereGeometry(0.016, 8, 6), basic(C.c2), 0, 0.35, 0));
    const shadow = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.002, 24), basic('#000000', { transparent: true, opacity: 0.35 }), 0, 0.002, 0);
    robot.add(shadow);
    robot.position.set(0.5, 0.765, -0.72);
    scene.add(robot);

    const gl = makeGL(ctx, { onSize: (w, h) => { camera.aspect = w / h; camera.fov = w / h < 0.9 ? 72 : 55; camera.updateProjectionMatrix(); } });
    const ov = overlay(ctx);

    let t = ctx.store.get('continuum:t', 0.3);
    let opticalAR = false;
    const view = { yaw: 0.22, pitch: 0.12, dist: 2.6 };
    let dragging = false; let idle = 0;
    drag(gl.el, ctx.signal, (dx, dy) => { view.yaw -= dx * 0.006; view.pitch = clamp(view.pitch + dy * 0.004, -0.15, 0.6); idle = 0; }, () => { dragging = true; }, () => { dragging = false; });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">VR, AR, MR and XR</h2>'),
      ctx.h('<p class="lede">These are not four separate things. They are points on one line that runs from the real world to a fully virtual one.</p>'),
    );
    const sl = ctx.slider({ label: 'Real to virtual', min: 0, max: 1, step: 0.001, value: t, fmt: (v) => `${Math.round(v * 100)}% virtual`, onInput: (v) => { t = v; ctx.store.set('continuum:t', v); sync(); } });
    ctx.panel.append(sl);
    const stageCard = ctx.h('<div class="card"><h3 class="st-name"></h3><p class="st-body small"></p><p class="hint st-eg"></p></div>');
    ctx.panel.append(stageCard);
    ctx.panel.append(ctx.h(`<div class="card tip"><p><b>XR</b> (extended reality) is the umbrella word for all of it. <b>VR</b> replaces what you see. <b>AR</b> adds things on top of what you see. <b>MR</b> is AR where the virtual things know about the room: they sit on tables, hide behind sofas and stay put when you walk around.</p></div>`));
    ctx.panel.append(ctx.h('<div class="card try"><p>Drag the slider slowly from left to right. At about 25% watch the yellow ring float <i>in front of</i> the vase even though it is behind it. Then slide to 50% and see the robot correctly hidden by the vase. Drag on the scene to walk around the table.</p></div>'));
    const arSeg = ctx.seg([['video', 'Video passthrough'], ['optical', 'Optical see-through']], 'video', (v) => { opticalAR = v === 'optical'; sync(); });
    ctx.panel.append(ctx.h('<p class="hint">How the AR display mixes light</p>'), arSeg);
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div>
      <p class="small">The continuum comes from Paul Milgram and Fumio Kishino's 1994 paper <i>A taxonomy of mixed reality visual displays</i>. In their definition, <b>mixed reality is everything strictly between the two ends</b>, including both AR and augmented virtuality. Industry usage has drifted: "MR" now usually means video passthrough AR with scene understanding.</p>
      <p class="small"><b>Optical see-through</b> displays (waveguides, birdbath combiners) add light to the real view. They can make things brighter but cannot draw black or darken the world, so virtual objects look like glowing ghosts. Switch the toggle above to see the additive look. <b>Video see-through</b> (passthrough) captures the world with cameras and composites it, so it can draw opaque, dark and occluded content, at the cost of camera latency, resolution and a small viewpoint offset.</p>
      <p class="small">A newer refinement (Skarbez, Smith and Whitton, 2021) argues the right end is unreachable: as long as your body is real and you feel the floor, no display is fully virtual. Everything we build is some kind of mixed reality.</p>
    </div></details>`));

    // Dock with presets
    const dock = addDock(ctx, `<div class="grp glass"><span>Jump</span>${STAGES.map((s) => `<button data-at="${(s.at + Math.min(1, s.end)) / 2}">${s.key.toUpperCase()}</button>`).join('')}</div>`);
    dock.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { goal = +b.dataset.at; }, { signal: ctx.signal }));
    let goal = null;

    function stageOf(v) { return STAGES.find((s) => v >= s.at && v < s.end) || STAGES[STAGES.length - 1]; }
    let lastKey = '';
    function sync() {
      const s = stageOf(t);
      if (s.key !== lastKey) {
        lastKey = s.key;
        stageCard.querySelector('.st-name').textContent = s.name;
        stageCard.querySelector('.st-body').textContent = s.body;
        stageCard.querySelector('.st-eg').textContent = `Example: ${s.eg}`;
        dock.querySelectorAll('button').forEach((b) => b.classList.toggle('on', stageOf(+b.dataset.at).key === s.key));
      }
      // AR hologram: appears at 0.12, drawn over everything until scene understanding kicks in
      const aHolo = smooth(0.1, 0.18, t) * (1 - smooth(0.9, 0.97, t));
      fade(holo, aHolo);
      const occl = t >= 0.42;
      holo.traverse((o) => { if (o.material) { o.material.depthTest = occl; o.material.blending = !occl && opticalAR ? 2 : 1; o.renderOrder = occl ? 0 : 10; } });
      // MR robot
      const aBot = smooth(0.42, 0.5, t) * (1 - smooth(0.9, 0.97, t));
      fade(robot, aBot);
      robot.traverse((o) => { if (o.material) o.material.depthTest = true; });
      // Real room fades as the virtual world arrives; the table and things on it stay for augmented virtuality
      const aVirtual = smooth(0.6, 0.72, t);
      const aRoom = 1 - aVirtual;
      for (const k of ['floor', 'sofa', 'lamp', 'plant']) fade(room[k], aRoom);
      room.walls.forEach((w) => fade(w, aRoom));
      room.group.children.forEach((c) => { if (![room.table, room.vase, room.mug, room.book].includes(c) && c !== room.floor && c !== room.sofa && c !== room.lamp && c !== room.plant && !room.walls.includes(c)) fade(c, aRoom); });
      const aTable = 1 - smooth(0.86, 0.95, t);
      for (const k of ['table', 'vase', 'mug', 'book']) fade(room[k], aTable);
      fade(vworld, aVirtual);
      scene.background = new THREE.Color('#0a0a0a').lerp(new THREE.Color('#0c1838'), aVirtual);
      lights.hemi.intensity = lerp(1.25, 0.9, aVirtual);
    }
    sync();

    const target = new THREE.Vector3(0.1, 0.85, -0.65);
    ctx.loop((time, dt) => {
      if (goal != null) { t += (goal - t) * Math.min(1, dt * 4); if (Math.abs(goal - t) < 0.002) { t = goal; goal = null; ctx.store.set('continuum:t', t); } sl.value = t; sync(); }
      idle += dt;
      if (!dragging && !reduced && idle > 2) view.yaw += dt * 0.05 * Math.sin(time * 0.15);
      const y = view.yaw; const p = view.pitch;
      camera.position.set(target.x + Math.sin(y) * Math.cos(p) * view.dist, target.y + 0.35 + Math.sin(p) * view.dist, target.z + Math.cos(y) * Math.cos(p) * view.dist);
      camera.lookAt(target);
      holo.rotation.y = time * 0.8; holo.position.y = 1.0 + Math.sin(time * 1.6) * 0.03;
      robot.rotation.y = Math.sin(time * 0.7) * 0.6;
      floaters.forEach((m, i) => { m.rotation.x = time * 0.3 + i; m.rotation.y = time * 0.2; });
      gl.renderer.render(scene, camera);
      drawBar();
    });

    function drawBar() {
      const g = ov.ctx; const W = ov.w; const H = ov.h;
      g.clearRect(0, 0, W, H);
      const pad = 16; const bw = Math.min(W - pad * 2, 760); const x0 = (W - bw) / 2; const y0 = 18;
      // panel
      g.fillStyle = 'rgba(10,10,10,.66)'; g.strokeStyle = 'rgba(255,255,255,.12)';
      g.beginPath(); g.roundRect(x0 - 12, y0 - 10, bw + 24, 92, 12); g.fill(); g.stroke();
      // gradient bar
      const gr = g.createLinearGradient(x0, 0, x0 + bw, 0);
      gr.addColorStop(0, '#c8b79e'); gr.addColorStop(0.5, C.c1); gr.addColorStop(1, C.c3);
      g.fillStyle = gr; g.globalAlpha = 0.85; g.fillRect(x0, y0 + 26, bw, 6); g.globalAlpha = 1;
      // Milgram's MR bracket and XR umbrella
      g.strokeStyle = 'rgba(245,245,240,.5)'; g.lineWidth = 1;
      const bx0 = x0 + bw * 0.06; const bx1 = x0 + bw * 0.94;
      g.beginPath(); g.moveTo(bx0, y0 + 16); g.lineTo(bx0, y0 + 11); g.lineTo(bx1, y0 + 11); g.lineTo(bx1, y0 + 16); g.stroke();
      g.font = MONO(10); g.fillStyle = C.muted; g.textAlign = 'center'; g.textBaseline = 'bottom';
      g.fillText(W < 520 ? 'Mixed reality (Milgram)' : 'Mixed reality, in Milgram\'s original sense', (bx0 + bx1) / 2, y0 + 9);
      g.textAlign = 'left'; g.fillText('XR', x0, y0 + 9);
      // stage labels
      const narrow = W < 560;
      STAGES.forEach((s, i) => {
        const cx = x0 + bw * ((s.at + Math.min(1, s.end)) / 2);
        const on = stageOf(t).key === s.key;
        g.font = on ? DISPLAY(narrow ? 12 : 14, 700) : DISPLAY(narrow ? 11 : 13, 600);
        g.fillStyle = on ? C.text : C.muted; g.textAlign = 'center'; g.textBaseline = 'top';
        const label = narrow ? s.key.toUpperCase() : ['REAL', 'AR', 'MR (today)', 'AUGMENTED VIRTUALITY', 'VR'][i];
        g.fillText(label, cx, y0 + 42);
        if (i > 0) { const tx = x0 + bw * s.at; g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(tx, y0 + 24, 1, 10); }
      });
      // marker
      const mx = x0 + bw * t;
      g.fillStyle = C.text; g.beginPath(); g.arc(mx, y0 + 29, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.bg; g.beginPath(); g.arc(mx, y0 + 29, 3, 0, Math.PI * 2); g.fill();
      g.font = MONO(10); g.fillStyle = C.muted; g.textAlign = 'left'; g.fillText('Real world', x0, y0 + 62); g.textAlign = 'right'; g.fillText('Fully virtual', x0 + bw, y0 + 62);
    }

    ctx.quiz([
      { q: 'In Milgram and Kishino\'s original continuum, what does "mixed reality" cover?', choices: ['Only headsets with passthrough cameras', 'Everything between the fully real and fully virtual ends', 'Only fully virtual worlds'], answer: 1, why: 'In the 1994 taxonomy MR is the whole middle of the line, AR and augmented virtuality included.' },
      { q: 'A floating label is drawn on top of a vase that is actually in front of it. What is missing?', choices: ['Occlusion from an understanding of the real scene', 'A higher refresh rate', 'Stereo rendering'], answer: 0, why: 'Without depth of the real room, the device cannot hide virtual content behind real objects.' },
      { q: 'Why can an optical see-through display not show a black virtual object?', choices: ['Black pixels use too much power', 'It can only add light to the light already coming from the world', 'Its cameras cannot see black'], answer: 1, why: 'Waveguides and combiners are additive. Black means no added light, so you just see the room.' },
    ]);
  },
};
