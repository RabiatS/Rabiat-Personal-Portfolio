// Chapter 10: interaction. Controller ray casting, gaze and pinch, and direct touch, all with real ray to sphere
// intersection, adjustable tracking noise, and a small Fitts's law experiment measured in angles.
import { THREE, makeGL, makeRoom, addLights, overlay, std, basic, mesh, boxGeo, clamp, DEG, MONO, DISPLAY, pill, toScreen } from '../lib/xr.js';

export default {
  mount(ctx) {
    const C = ctx.colors;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#0d0d0d');
    addLights(scene);
    const room = makeRoom();
    scene.add(room.group);
    const EYE = new THREE.Vector3(0, 1.55, 2.6);
    const camera = new THREE.PerspectiveCamera(70, 1, 0.03, 60);
    camera.position.copy(EYE); camera.lookAt(0, 1.3, -1);
    camera.updateMatrixWorld();

    // targets: some within arm's reach, some across the room
    const defs = [
      [-0.13, 1.33, 2.16, 0.026], [0.0, 1.31, 2.15, 0.022], [0.13, 1.33, 2.16, 0.026],
      [-1.0, 1.6, 0.6, 0.12], [0.9, 1.1, 0.8, 0.1], [0.1, 1.9, 0.4, 0.09],
      [-2.0, 1.2, -2.0, 0.22], [1.8, 2.0, -2.5, 0.18], [0.3, 1.0, -3.2, 0.14], [-0.8, 2.3, -3.4, 0.12],
    ];
    const cols = [C.c1, C.c5, C.c3, C.c6];
    const targets = defs.map(([x, y, z, r], i) => {
      const m = mesh(new THREE.SphereGeometry(r, 28, 18), std(cols[i % 4], { roughness: 0.35, emissive: '#000000' }), x, y, z);
      scene.add(m);
      return { m, c: new THREE.Vector3(x, y, z), r, base: cols[i % 4], flash: 0, reach: EYE.distanceTo(new THREE.Vector3(x, y, z)) < 0.75 };
    });
    // controller and hand
    const ctrl = new THREE.Group();
    ctrl.add(mesh(boxGeo(0.04, 0.03, 0.12), std('#2a2c33', { roughness: 0.4 })));
    ctrl.add(mesh(new THREE.TorusGeometry(0.045, 0.008, 8, 24), std('#3a3d45'), 0, 0.0, -0.06));
    scene.add(ctrl);
    const ray = mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 6), basic(C.c1, { transparent: true, opacity: 0.85 }));
    scene.add(ray);
    const dot = mesh(new THREE.SphereGeometry(0.02, 12, 8), basic('#ffffff'));
    scene.add(dot);
    const hand = mesh(new THREE.SphereGeometry(0.018, 14, 10), std('#e7c6a8', { roughness: 0.7 }));
    scene.add(hand);

    const gl = makeGL(ctx, { onSize: (w, h) => { camera.aspect = w / h; camera.fov = w / h < 0.9 ? 82 : 66; camera.updateProjectionMatrix(); } });
    const ov = overlay(ctx);

    let mode = 'ray'; let noise = 0.4;
    const ptr = { x: 0.5, y: 0.5, in: false };
    const jit = { x: 0, y: 0, vx: 0, vy: 0 };
    let hovered = null; let fitts = null; const results = ctx.store.get('fitts', []);
    let msg = '';

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Interaction</h2>'),
      ctx.h('<p class="lede">With no mouse and no screen to touch, how do you point at things? Three answers, each with a catch.</p>'),
    );
    const modeSeg = ctx.seg([['ray', 'Controller ray'], ['gaze', 'Gaze and pinch'], ['touch', 'Direct touch']], mode, (v) => { mode = v; hint(); });
    ctx.panel.append(modeSeg);
    const hintEl = ctx.h('<p class="hint"></p>');
    ctx.panel.append(hintEl);
    ctx.panel.append(ctx.slider({ label: 'Tracking noise and hand tremor', min: 0, max: 2, step: 0.05, value: noise, unit: '°', onInput: (v) => { noise = v; } }));
    const stats = ctx.h('<div class="stat"><div><b class="s-n">0</b><span>Wobble at 5 m</span></div><div><b class="s-t">-</b><span>Hovering</span></div></div>');
    ctx.panel.append(stats);
    const fBtn = ctx.h('<button class="btn ghost sm act">Start Fitts test (10 targets)</button>');
    const fClear = ctx.h('<button class="btn ghost sm act">Clear results</button>');
    fBtn.addEventListener('click', () => startFitts());
    fClear.addEventListener('click', () => { results.length = 0; ctx.store.set('fitts', results); });
    const row = ctx.h('<div class="row"></div>'); row.append(fBtn, fClear); ctx.panel.append(row);
    const fitOut = ctx.h('<p class="hint"></p>');
    ctx.panel.append(fitOut);
    function hint() {
      hintEl.textContent = {
        ray: 'Move the pointer to aim the controller. Click to pull the trigger. A ray from your hand reaches anything in the room.',
        gaze: 'The pointer is your eyes. Look at a ball and click to pinch your fingers. Nothing is drawn where you look: the target just highlights.',
        touch: 'The pointer moves your fingertip in front of you. Only the three small balls within arm\'s reach can be touched.',
      }[mode];
    }
    hint();
    ctx.panel.append(ctx.h(`<div class="card tip"><p><b>Controllers</b> cast a laser like ray from your hand: precise buttons, reaches far, but small wobbles in your wrist swing the far end a lot. <b>Gaze and pinch</b> (the main input on Apple Vision Pro) uses eye tracking to pick what you are looking at, and a pinch to click; it is fast because your eyes already went there, but eyes are jittery and you cannot look at something without "pointing" at it (the Midas touch problem). <b>Hand tracking with direct touch</b> lets you poke virtual buttons like real ones, which feels natural but only works within reach and gives no physical feedback.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><p>Raise the noise to 1.5° and try to hover the far small ball with the controller ray: the dot dances around it. Now try the near balls in direct touch: noise matters much less up close. Then run the Fitts test in each mode and compare the fitted slopes.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card deep">
      <p class="small"><b>Fitts's law</b> says the time to hit a target grows with how far it is and how small it is:</p>
      <div class="formula">MT = a + b · log2(D / W + 1)<span>the log term is the index of difficulty (ID), in bits</span></div>
      <p class="small">In 3D, distance and size are best measured as <b>angles</b> from the viewpoint, because a ray pointer or gaze rotates rather than slides. A ball 10 cm wide at 5 m is about 1.1° wide; with 1° of jitter it is barely selectable. Designers fix this with bigger far targets, target snapping and "sticky" cursors, ray smoothing (filters such as the 1€ filter), and depth aware cursors.</p>
      <p class="small">Common guidance for eye tracked targets is to make them at least about 1° to 2° across, since eye tracker accuracy is often around half a degree to a degree. Ray based angular error grows linearly with distance: error at the target = D · tan(θ).</p>
    </div>`));

    const setPtr = (e) => { const r = gl.el.getBoundingClientRect(); ptr.x = (e.clientX - r.left) / r.width; ptr.y = (e.clientY - r.top) / r.height; ptr.in = true; };
    gl.el.style.touchAction = 'none';
    gl.el.addEventListener('pointermove', setPtr, { signal: ctx.signal });
    gl.el.addEventListener('pointerdown', (e) => { setPtr(e); update(0); select(); }, { signal: ctx.signal });

    function select() {
      if (hovered) { hovered.flash = 1; msg = 'selected'; }
      if (fitts && fitts.cur) {
        if (hovered === fitts.cur) {
          const now = performance.now();
          if (fitts.prev) {
            const a = fitts.prev.c.clone().sub(EYE).normalize(); const b = fitts.cur.c.clone().sub(EYE).normalize();
            const D = Math.acos(clamp(a.dot(b), -1, 1)) / DEG;
            const Wd = (2 * Math.atan(fitts.cur.r / EYE.distanceTo(fitts.cur.c))) / DEG;
            results.push({ id: Math.log2(D / Wd + 1), mt: (now - fitts.t0) / 1000, mode });
            ctx.store.set('fitts', results.slice(-120));
          }
          fitts.n++; fitts.prev = fitts.cur; fitts.t0 = now;
          if (fitts.n >= 11) { fitts = null; fBtn.textContent = 'Start Fitts test (10 targets)'; fit(); return; }
          nextTarget();
        } else fitts.miss++;
      }
    }
    function startFitts() {
      fitts = { n: 0, miss: 0, prev: null, cur: null, t0: performance.now() };
      fBtn.textContent = 'Test running: hit the amber ball';
      nextTarget();
    }
    function nextTarget() {
      const pool = targets.filter((t) => t !== fitts.cur && (mode === 'touch' ? t.reach : true));
      fitts.cur = pool[Math.floor(Math.random() * pool.length)];
    }
    function fit() {
      const rs = results.filter((r) => r.mode === mode);
      if (rs.length < 3) { fitOut.textContent = `${rs.length} trials so far in this mode.`; return; }
      const mx = rs.reduce((s, r) => s + r.id, 0) / rs.length; const my = rs.reduce((s, r) => s + r.mt, 0) / rs.length;
      let num = 0; let den = 0; rs.forEach((r) => { num += (r.id - mx) * (r.mt - my); den += (r.id - mx) ** 2; });
      const b = den ? num / den : 0; const a = my - b * mx;
      fitOut.textContent = `${modeName(mode)}: MT ≈ ${a.toFixed(2)} s + ${b.toFixed(2)} s/bit × ID, from ${rs.length} trials (throughput about ${(1 / Math.max(0.01, b)).toFixed(1)} bits/s).`;
    }
    const modeName = (m) => ({ ray: 'Ray', gaze: 'Gaze', touch: 'Touch' })[m];
    fit();

    const tmp = new THREE.Vector3(); const dir = new THREE.Vector3(); const Y = new THREE.Vector3(0, 1, 0);
    function raySphere(o, d, c, r) {
      const oc = tmp.copy(o).sub(c); const b = oc.dot(d); const q = oc.dot(oc) - r * r; const h = b * b - q;
      if (h < 0) return Infinity; const t = -b - Math.sqrt(h); return t > 0 ? t : Infinity;
    }
    function aimDir(px, py) { const p = new THREE.Vector3(px * 2 - 1, -(py * 2 - 1), 0.5).unproject(camera); return p.sub(camera.position).normalize(); }
    function rotateSmall(d, ax, ay) {
      // nudge a direction by small yaw and pitch angles (radians)
      const right = new THREE.Vector3().crossVectors(d, Y).normalize(); const up = new THREE.Vector3().crossVectors(right, d).normalize();
      return d.clone().addScaledVector(right, Math.tan(ax)).addScaledVector(up, Math.tan(ay)).normalize();
    }

    function update(dt) {
      // smooth random tremor
      jit.vx += (Math.random() - 0.5) * 60 * dt - jit.x * 18 * dt; jit.vy += (Math.random() - 0.5) * 60 * dt - jit.y * 18 * dt;
      jit.vx *= 0.9; jit.vy *= 0.9; jit.x += jit.vx * dt; jit.y += jit.vy * dt;
      const nx = clamp(jit.x, -1.5, 1.5) * noise * DEG; const ny = clamp(jit.y, -1.5, 1.5) * noise * DEG;
      const eyeDir = aimDir(ptr.x, ptr.y);
      hovered = null; ray.visible = false; dot.visible = false; hand.visible = false; ctrl.visible = mode === 'ray';
      if (mode === 'ray') {
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const origin = EYE.clone().addScaledVector(right, 0.2).add(new THREE.Vector3(0, -0.32, -0.3));
        // aim the controller at whatever the eye ray hits (or a point 6 m away)
        let best = Infinity; for (const t of targets) best = Math.min(best, raySphere(EYE, eyeDir, t.c, t.r));
        const aimPt = EYE.clone().addScaledVector(eyeDir, isFinite(best) ? best : 6);
        let d = aimPt.sub(origin).normalize();
        d = rotateSmall(d, nx, ny);
        let tHit = Infinity;
        for (const t of targets) { const k = raySphere(origin, d, t.c, t.r); if (k < tHit) { tHit = k; hovered = t; } }
        const len = isFinite(tHit) ? tHit : 7;
        ctrl.position.copy(origin); ctrl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), d);
        ray.visible = true; ray.position.copy(origin).addScaledVector(d, len / 2); ray.scale.set(1, len, 1); ray.quaternion.setFromUnitVectors(Y, d);
        dot.visible = true; dot.position.copy(origin).addScaledVector(d, len); dot.scale.setScalar(clamp(len / 3, 0.4, 2));
      } else if (mode === 'gaze') {
        const d = rotateSmall(eyeDir, nx, ny);
        let tHit = Infinity; for (const t of targets) { const k = raySphere(EYE, d, t.c, t.r); if (k < tHit) { tHit = k; hovered = t; } }
        gazeDir.copy(d);
      } else {
        // fingertip on a curved surface about 45 cm from the eye, with noise in centimetres
        const reach = 0.47;
        const p = EYE.clone().addScaledVector(eyeDir, reach);
        p.x += nx * reach; p.y += ny * reach;
        hand.visible = true; hand.position.copy(p);
        for (const t of targets) if (t.reach && t.c.distanceTo(p) < t.r + 0.018) hovered = t;
      }
      for (const t of targets) {
        t.flash = Math.max(0, t.flash - dt * 2.5);
        const isGoal = fitts && fitts.cur === t;
        t.m.material.color.set(isGoal ? C.c2 : t.base);
        t.m.material.emissive.set(t.flash > 0 ? '#ffffff' : t === hovered ? '#444444' : '#000000');
        t.m.material.emissiveIntensity = t.flash > 0 ? t.flash : 1;
        const s = t === hovered ? 1.12 : 1; t.m.scale.setScalar(s + t.flash * 0.3);
      }
    }
    const gazeDir = new THREE.Vector3();

    ctx.loop((time, dt) => {
      update(dt);
      gl.renderer.render(scene, camera);
      drawOverlay();
      stats.querySelector('.s-n').textContent = `${(Math.tan(noise * DEG) * 500).toFixed(1)} cm`;
      stats.querySelector('.s-t').textContent = hovered ? `${(EYE.distanceTo(hovered.c)).toFixed(1)} m` : '-';
    });

    function drawOverlay() {
      const g = ov.ctx; const W = ov.w; const H = ov.h;
      g.clearRect(0, 0, W, H);
      if (mode === 'gaze' && hovered) {
        const s = toScreen(hovered.c, camera, W, H);
        g.strokeStyle = 'rgba(245,245,240,.7)'; g.lineWidth = 1.5; g.beginPath(); g.arc(s.x, s.y, 26, 0, Math.PI * 2); g.stroke();
      }
      if (fitts && fitts.cur) pill(g, fitts.n === 0 ? 'Fitts test: hit the amber ball to start the clock' : `Fitts test: target ${Math.min(10, fitts.n)} of 10${fitts.miss ? `, ${fitts.miss} misses` : ''}`, W / 2, 16, { color: C.c2 });
      else pill(g, { ray: 'controller ray', gaze: 'gaze and pinch', touch: 'direct touch (reach about 70 cm)' }[mode], W / 2, 16);
      // results chart
      const rs = results.filter((r) => r.mode === mode);
      if (rs.length) {
        const w = Math.min(200, W * 0.4); const h = 110; const x0 = 10; const y0 = H - h - 10;
        g.fillStyle = 'rgba(10,10,10,.8)'; g.beginPath(); g.roundRect(x0, y0, w, h, 8); g.fill();
        g.font = MONO(10); g.fillStyle = C.muted; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('time vs difficulty (ID)', x0 + 8, y0 + 6);
        const maxId = Math.max(4, ...rs.map((r) => r.id)); const maxT = Math.max(1.5, ...rs.map((r) => r.mt));
        const X = (v) => x0 + 12 + (v / maxId) * (w - 24); const Yp = (v) => y0 + h - 12 - (v / maxT) * (h - 34);
        g.fillStyle = C.c2; rs.forEach((r) => { g.beginPath(); g.arc(X(r.id), Yp(Math.min(r.mt, maxT)), 2.5, 0, Math.PI * 2); g.fill(); });
        g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText(`${maxId.toFixed(1)} bits`, x0 + w - 6, y0 + h - 2);
      }
    }

    ctx.quiz([
      { q: 'You hold a controller ray steady to within 1°. How far does its end wobble on a wall 5 m away?', choices: ['About 1 mm', 'About 9 cm', 'About 1 m'], answer: 1, why: '5 m × tan(1°) ≈ 8.7 cm. Angular error grows with distance.' },
      { q: 'What is the "Midas touch" problem in gaze input?', choices: ['Everything you look at could get selected, because looking is not the same as choosing', 'Gold coloured targets are hard to see', 'Eye trackers drain the battery'], answer: 0, why: 'That is why gaze is paired with a separate confirm action, such as a pinch.' },
      { q: 'In Fitts\'s law, which change makes a target harder to hit?', choices: ['Making it bigger', 'Moving it closer', 'Making it smaller or farther away'], answer: 2, why: 'Index of difficulty is log2(D / W + 1): more distance or less width means more bits.' },
    ]);
  },
};
