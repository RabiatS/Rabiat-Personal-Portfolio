// Chapter 9: motion sickness and comfort. A first person walk through a field of posts with smooth or teleport
// locomotion, smooth or snap turning, and a dynamic vignette (tunnelling) that closes in while you move.
import { THREE, makeGL, addLights, overlay, tex, basic, std, mesh, floorGeo, clamp, lerp, DEG, MONO, pill, reduced } from '../lib/xr.js';

export default {
  mount(ctx) {
    const C = ctx.colors;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#0b1220');
    addLights(scene, 0.9);
    const grid = tex.grid(C.c1, '#0a1418'); grid.repeat.set(200, 200);
    const floor = mesh(floorGeo(200, 200), basic('#ffffff', { map: grid }));
    scene.add(floor);
    const sky = mesh(new THREE.SphereGeometry(90, 24, 12), basic('#ffffff', { map: tex.sky('#0b1838', '#24304a'), side: 1 }));
    scene.add(sky);
    // posts that wrap around the viewer so the field never ends
    const N = 260; const L = 40;
    const base = []; let s = 7;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < N; i++) base.push([(rnd() - 0.5) * L, (rnd() - 0.5) * L, 0.6 + rnd() * 2.2]);
    const cols = [C.c1, C.c3, C.c5, C.c2, C.c6];
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.12, 1, 8), std('#ffffff', { roughness: 0.6 }), N);
    const dummy = new THREE.Object3D(); const col = new THREE.Color();
    for (let i = 0; i < N; i++) { col.set(cols[i % cols.length]); posts.setColorAt(i, col); }
    scene.add(posts);
    // teleport arc and target
    const arcGeo = new THREE.BufferGeometry(); const arcPos = new Float32Array(40 * 3);
    arcGeo.setAttribute('position', new THREE.BufferAttribute(arcPos, 3));
    const arc = new THREE.Points(arcGeo, new THREE.PointsMaterial({ color: C.c2, size: 5, sizeAttenuation: false }));
    const ring = mesh(new THREE.TorusGeometry(0.35, 0.03, 8, 40), basic(C.c2)); ring.rotation.x = Math.PI / 2;
    scene.add(arc, ring);

    const camera = new THREE.PerspectiveCamera(80, 1, 0.05, 200);
    const gl = makeGL(ctx, { onSize: (w, h) => { camera.aspect = w / h; camera.fov = w / h < 0.9 ? 90 : 75; camera.updateProjectionMatrix(); } });
    const ov = overlay(ctx);

    let loco = 'smooth'; let turn = 'smooth'; let speed = 2.5; let vig = 0.6; let playing = !reduced;
    const me = { x: 0, z: 0, yaw: 0 };
    let tClock = 0; let blink = 0; let tp = null; let snapAcc = 0; let lastTurnRate = 0; let lastSpeed = 0;

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Motion sickness and comfort</h2>'),
      ctx.h('<p class="lede">Your eyes say you are moving. Your inner ear says you are standing still. For many people that disagreement ends in nausea, and good VR design works around it.</p>'),
    );
    const playBtn = ctx.h(`<button class="btn ghost sm act">${playing ? 'Pause' : 'Play the walk'}</button>`);
    playBtn.addEventListener('click', () => { playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play the walk'; });
    ctx.panel.append(ctx.h('<div class="row"></div>')); ctx.panel.lastChild.append(playBtn);
    if (reduced) ctx.panel.append(ctx.h('<p class="hint">Your device asks for reduced motion, so the walk starts paused.</p>'));
    ctx.panel.append(ctx.h('<p class="hint">Moving</p>'));
    ctx.panel.append(ctx.seg([['smooth', 'Smooth locomotion'], ['teleport', 'Teleport']], loco, (v) => { loco = v; tp = null; }));
    ctx.panel.append(ctx.h('<p class="hint">Turning</p>'));
    ctx.panel.append(ctx.seg([['smooth', 'Smooth turn'], ['snap', 'Snap turn 30°']], turn, (v) => { turn = v; }));
    ctx.panel.append(ctx.slider({ label: 'Walking speed', min: 0.5, max: 6, step: 0.1, value: speed, unit: ' m/s', onInput: (v) => { speed = v; } }));
    ctx.panel.append(ctx.slider({ label: 'Comfort vignette', min: 0, max: 1, step: 0.01, value: vig, fmt: (v) => (v ? `${Math.round(v * 100)}%` : 'off'), onInput: (v) => { vig = v; } }));
    const meter = ctx.h('<div class="card"><h3>Peripheral motion</h3><div class="bar" style="height:8px"><span></span></div><p class="small muted">A rough index: how fast the scene is flowing past, times how much of your side vision can see it.</p></div>');
    ctx.panel.append(meter);
    ctx.panel.append(ctx.h(`<div class="card tip"><p>The balance organs in your inner ear (the vestibular system) sense acceleration and rotation. When your eyes report motion that your body does not feel, the brain gets conflicting signals. The leading explanation, <b>sensory conflict theory</b>, says that conflict is what makes people feel sick.</p><p>The feeling of moving that comes only from vision is called <b>vection</b>. Your peripheral vision drives it most strongly, which is why big screens and VR cause it more than a phone.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><p>Watch the walk with the vignette off and smooth turning. Then raise the vignette: the edges darken only while you move or turn, and the peripheral motion meter drops. Switch to <b>snap turn</b>: rotation happens instantly, with no visual flow to disagree with your ears. Then try <b>Teleport</b>: you aim, blink and arrive, with no continuous motion at all.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card deep">
      <p class="small"><b>Comfort options</b> in shipping games: teleport and dash movement, snap turning, dynamic vignettes or tunnelling, a stable cockpit or "rest frame" that does not move with the world, seated modes, and adjustable speed. Physical movement (roomscale walking) is the most comfortable of all because vision and the vestibular system agree.</p>
      <p class="small">Changes in speed and smooth rotation are the usual worst triggers, because the vestibular system responds to acceleration and rotation. Never move the camera without the user's input (no camera shake, no forced head bob), and never let the frame rate drop: judder and latency are their own sources of discomfort.</p>
      <p class="small">Susceptibility varies a lot between people and tends to fall with exposure. Comfort settings should be choices, not a single default. The original sensory conflict account is Reason and Brand (1975); the postural instability theory (Riccio and Stoffregen) is a competing explanation that links sickness to losing postural control.</p>
    </div>`));

    const fwd = new THREE.Vector3();
    function placePosts() {
      for (let i = 0; i < N; i++) {
        const [bx, bz, h] = base[i];
        const x = bx + Math.round((me.x - bx) / L) * L; const z = bz + Math.round((me.z - bz) / L) * L;
        dummy.position.set(x, h / 2, z); dummy.scale.set(1, h, 1); dummy.updateMatrix();
        posts.setMatrixAt(i, dummy.matrix);
      }
      posts.instanceMatrix.needsUpdate = true;
      floor.position.set(Math.round(me.x), 0, Math.round(me.z));
      sky.position.set(me.x, 0, me.z);
    }

    ctx.loop((time, dt) => {
      let turnRate = 0; let v = 0;
      if (playing) {
        tClock += dt;
        // a route: walk, then turn 60 degrees, alternating sides
        const phase = tClock % 6; const side = Math.floor(tClock / 6) % 2 ? 1 : -1;
        const turning = phase > 4 && phase < 5;
        if (turning) {
          const rate = 60 * DEG; // 60 degrees over one second
          if (turn === 'smooth') { me.yaw += side * rate * dt; turnRate = rate; }
          else { snapAcc += rate * dt; if (snapAcc >= 30 * DEG) { snapAcc -= 30 * DEG; me.yaw += side * 30 * DEG; } }
        } else snapAcc = 0;
        fwd.set(-Math.sin(me.yaw), 0, -Math.cos(me.yaw));
        if (loco === 'smooth') {
          const ease = clamp(phase < 0.6 ? phase / 0.6 : 1, 0, 1);
          v = speed * ease; me.x += fwd.x * v * dt; me.z += fwd.z * v * dt;
          tp = null;
        } else {
          // teleport: aim for a moment, then blink to the target
          const cyc = tClock % 2.4;
          if (!tp && cyc < 1.5) tp = { x: me.x + fwd.x * speed * 2.4, z: me.z + fwd.z * speed * 2.4, done: false };
          if (tp && cyc > 1.5 && !tp.done) { blink = 1; tp.done = true; me.x = tp.x; me.z = tp.z; }
          if (tp && tp.done && cyc < 1.5) tp = null;
        }
      }
      blink = Math.max(0, blink - dt * 7);
      lastTurnRate = lerp(lastTurnRate, turnRate, Math.min(1, dt * 8));
      lastSpeed = lerp(lastSpeed, v, Math.min(1, dt * 8));
      camera.position.set(me.x, 1.6, me.z);
      camera.rotation.set(-0.08, me.yaw, 0, 'YXZ');
      // teleport arc
      const showArc = loco === 'teleport' && tp && !tp.done;
      arc.visible = ring.visible = !!showArc;
      if (showArc) {
        const r = new THREE.Vector3(Math.cos(me.yaw), 0, -Math.sin(me.yaw));
        const start = new THREE.Vector3(me.x, 1.2, me.z).addScaledVector(r, 0.25).addScaledVector(fwd, 0.6);
        const end = new THREE.Vector3(tp.x, 0.02, tp.z);
        for (let i = 0; i < 40; i++) { const t = i / 39; const p = start.clone().lerp(end, t); p.y = lerp(start.y, end.y, t) + Math.sin(t * Math.PI) * 1.1; arcPos.set([p.x, p.y, p.z], i * 3); }
        arcGeo.attributes.position.needsUpdate = true;
        ring.position.set(tp.x, 0.03, tp.z);
      }
      placePosts();
      gl.renderer.render(scene, camera);
      drawOverlay();
    });

    function drawOverlay() {
      const g = ov.ctx; const W = ov.w; const H = ov.h;
      g.clearRect(0, 0, W, H);
      const motion = clamp(lastSpeed / 3 + lastTurnRate / (60 * DEG), 0, 1.4);
      const close = vig * clamp(motion, 0, 1);
      if (close > 0.01) {
        const R = Math.hypot(W, H) / 2;
        const inner = R * lerp(0.95, 0.32, close); const outer = R * lerp(1.05, 0.62, close);
        const gr = g.createRadialGradient(W / 2, H / 2, inner, W / 2, H / 2, outer);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.97)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
      if (blink > 0) { g.fillStyle = `rgba(0,0,0,${Math.min(1, blink * 1.4)})`; g.fillRect(0, 0, W, H); }
      // horizon cross for reference
      g.strokeStyle = 'rgba(245,245,240,.35)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(W / 2 - 8, H / 2); g.lineTo(W / 2 + 8, H / 2); g.moveTo(W / 2, H / 2 - 8); g.lineTo(W / 2, H / 2 + 8); g.stroke();
      const lab = !playing ? 'paused' : loco === 'teleport' ? 'teleport: aim, blink, arrive' : lastTurnRate > 0.1 ? 'smooth turning' : turn === 'snap' && (tClock % 6) > 4 && (tClock % 6) < 5 ? 'snap turning' : `walking ${speed.toFixed(1)} m/s`;
      pill(g, lab, W / 2, 18);
      const flow = clamp(motion * (1 - 0.85 * close), 0, 1.4) / 1.4;
      meter.querySelector('.bar span').style.width = `${Math.round(flow * 100)}%`;
      meter.querySelector('.bar span').style.background = flow > 0.6 ? C.c4 : flow > 0.3 ? C.c2 : C.ok;
    }

    ctx.quiz([
      { q: 'According to sensory conflict theory, what causes VR sickness?', choices: ['Bright screens', 'Your eyes and your inner ear disagreeing about motion', 'Heavy headsets'], answer: 1, why: 'Vision reports self motion that the vestibular system does not feel.' },
      { q: 'Why does a comfort vignette help?', choices: ['It hides motion in peripheral vision, which drives vection most', 'It raises the frame rate', 'It makes the scene brighter'], answer: 0, why: 'Narrowing the view during movement cuts the peripheral optic flow.' },
      { q: 'Which locomotion is usually the most comfortable?', choices: ['Fast smooth movement with smooth turns', 'Really walking in roomscale, or teleporting', 'Camera shake for realism'], answer: 1, why: 'Real walking keeps senses in agreement; teleporting removes continuous visual motion entirely.' },
    ]);
  },
};
