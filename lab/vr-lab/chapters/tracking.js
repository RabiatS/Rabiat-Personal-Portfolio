// Chapter 5: tracking. A physical head and the pose the headset believes, 3DoF versus 6DoF,
// inside-out feature tracking (a toy SLAM map) versus outside-in base stations, and IMU dead reckoning drift.
import { THREE, makeGL, makeRoom, addLights, overlay, drag, std, basic, mesh, boxGeo, clamp, DEG, MONO, pill, addDock, toScreen, rng } from '../lib/xr.js';

export default {
  mount(ctx) {
    const C = ctx.colors;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#0d0d0d');
    addLights(scene);
    const room = makeRoom();
    scene.add(room.group);

    // feature points scattered on walls and furniture (corners, texture, edges a camera could lock onto)
    const r = rng(21); const feats = [];
    const S = room.size / 2;
    for (let i = 0; i < 170; i++) {
      const wall = Math.floor(r() * 4); const u = (r() - 0.5) * room.size * 0.95; const y = 0.1 + r() * 2.6;
      const p = wall === 0 ? new THREE.Vector3(u, y, -S + 0.02) : wall === 1 ? new THREE.Vector3(-S + 0.02, y, u) : wall === 2 ? new THREE.Vector3(S - 0.02, y, u) : new THREE.Vector3(u, y, S - 0.02);
      feats.push({ p, mapped: 0 });
    }
    for (let i = 0; i < 40; i++) feats.push({ p: new THREE.Vector3((r() - 0.5) * 1.3, 0.77, -0.6 + (r() - 0.5) * 0.7), mapped: 0 });
    const featGeo = new THREE.BufferGeometry();
    const fpos = new Float32Array(feats.length * 3); const fcol = new Float32Array(feats.length * 3);
    feats.forEach((f, i) => { fpos.set([f.p.x, f.p.y, f.p.z], i * 3); });
    featGeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
    featGeo.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
    const featPts = new THREE.Points(featGeo, new THREE.PointsMaterial({ size: 0.03, vertexColors: true, sizeAttenuation: true }));
    scene.add(featPts);

    // base stations for outside-in tracking
    const stations = [new THREE.Vector3(-S + 0.3, 2.5, -S + 0.3), new THREE.Vector3(S - 0.3, 2.5, S - 0.3)];
    const stationMeshes = stations.map((p) => { const m = mesh(boxGeo(0.14, 0.14, 0.1), std('#222', { emissive: '#3a0000' }), p.x, p.y, p.z); m.lookAt(0, 1.4, 0); scene.add(m); return m; });

    // head models
    function headModel(color, ghost) {
      const g = new THREE.Group();
      const skin = ghost ? basic(color, { wireframe: true, transparent: true, opacity: 0.6 }) : std('#d9c3ad', { roughness: 0.8 });
      g.add(mesh(new THREE.SphereGeometry(0.1, 20, 14), skin, 0, 0, 0));
      const visor = ghost ? basic(color, { transparent: true, opacity: 0.45 }) : std('#1d1f24', { roughness: 0.4 });
      g.add(mesh(boxGeo(0.19, 0.1, 0.09), visor, 0, 0.01, -0.1));
      if (!ghost) {
        g.add(mesh(boxGeo(0.21, 0.025, 0.2), std('#30333a'), 0, 0.04, 0.0));
        for (const [x, y] of [[-0.08, 0.045], [0.08, 0.045], [-0.08, -0.025], [0.08, -0.025]]) g.add(mesh(new THREE.SphereGeometry(0.011, 8, 6), basic(C.c1), x, y + 0.01, -0.147));
      }
      // facing arrow
      g.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.35, 6), basic(ghost ? color : '#f5f5f0', { transparent: true, opacity: 0.7 }), 0, 0.01, -0.3).rotateX(Math.PI / 2));
      return g;
    }
    const phys = headModel('#ffffff', false); const ghost = headModel(C.c1, true);
    scene.add(phys, ghost);

    const obsCam = new THREE.PerspectiveCamera(50, 1, 0.05, 60);
    const eyeCam = new THREE.PerspectiveCamera(80, 1.2, 0.05, 60);
    const gl = makeGL(ctx, { onSize: (w, h) => { obsCam.aspect = w / h; obsCam.fov = w / h < 0.9 ? 66 : 50; obsCam.updateProjectionMatrix(); } });
    const ov = overlay(ctx);

    // state
    const home = new THREE.Vector3(0, 1.6, 1.4);
    const P = { pos: home.clone(), yaw: 0, pitch: 0 };
    let dof = 6; let method = 'inside'; let cams = true; let dragMode = 'rot';
    const drift = { yaw: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), t: 0, bias: new THREE.Vector3(0.05, 0, -0.02) };

    drag(gl.el, ctx.signal, (dx, dy) => {
      if (dragMode === 'rot') { P.yaw -= dx * 0.006; P.pitch = clamp(P.pitch - dy * 0.005, -1, 1); }
      else { const s = 0.006; const fw = new THREE.Vector3(-Math.sin(obsYaw), 0, -Math.cos(obsYaw)); const rt = new THREE.Vector3(Math.cos(obsYaw), 0, -Math.sin(obsYaw)); P.pos.addScaledVector(rt, dx * s).addScaledVector(fw, -dy * s); P.pos.x = clamp(P.pos.x, -3.3, 3.3); P.pos.z = clamp(P.pos.z, -1.4, 3.3); }
    });
    const obsYaw = 0.75;

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Tracking: 3DoF and 6DoF</h2>'),
      ctx.h('<p class="lede">To draw the right picture, a headset has to know where your head is, hundreds of times a second, without any markers on you. Here is how.</p>'),
    );
    const dofSeg = ctx.seg([[3, '3DoF: rotation only'], [6, '6DoF: rotation and position']], dof, (v) => { dof = +v; });
    ctx.panel.append(dofSeg);
    ctx.panel.append(ctx.h('<p class="hint">Tracking method</p>'));
    ctx.panel.append(ctx.seg([['inside', 'Inside-out cameras'], ['outside', 'Outside-in base stations']], method, (v) => { method = v; }));
    const camBtn = ctx.h('<button class="btn ghost sm act">Block optical tracking (IMU only)</button>');
    camBtn.addEventListener('click', () => { cams = !cams; camBtn.textContent = cams ? 'Block optical tracking (IMU only)' : 'Restore optical tracking'; if (!cams) { drift.t = 0; drift.vel.set(0, 0, 0); } });
    const resetBtn = ctx.h('<button class="btn ghost sm act">Reset head</button>');
    resetBtn.addEventListener('click', () => { P.pos.copy(home); P.yaw = 0; P.pitch = 0; });
    const row = ctx.h('<div class="row"></div>'); row.append(camBtn, resetBtn); ctx.panel.append(row);
    const stats = ctx.h('<div class="stat"><div><b class="s-p">0</b><span>Position error</span></div><div><b class="s-y">0</b><span>Heading error</span></div><div><b class="s-m">0</b><span>Map points</span></div></div>');
    ctx.panel.append(stats);
    ctx.panel.append(ctx.h(`<div class="card tip"><p>Your head can move in six ways: three <b>rotations</b> (turn left and right, nod up and down, tilt side to side) and three <b>translations</b> (move left and right, up and down, forward and back). Each is a <b>degree of freedom</b>.</p><p>A <b>3DoF</b> device only knows which way you are facing. Lean in to look closer and nothing happens. A <b>6DoF</b> device also knows where you are, so you can walk around and lean in, and the world stays put.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><p>Drag on the scene to turn the head. Switch the dock at the bottom to <b>Move</b> and drag again: in 6DoF the teal ghost (what the headset believes) follows you. Switch to 3DoF and walk away: the ghost stays behind, and the inset view in the corner stops changing as you move. Then press <b>Block optical tracking</b> and wait a few seconds.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card deep">
      <p class="small"><b>The IMU</b> (gyroscope plus accelerometer) runs at hundreds to thousands of samples per second and is great for fast rotation. But position from an IMU means integrating acceleration twice, so a tiny constant error grows with time squared: a bias of 0.05 m/s² (about 5 thousandths of gravity) becomes 2.5 m of error after 10 s. Block optical tracking to watch it happen. The gyro drift in this demo is exaggerated so you can see it.</p>
      <p class="small"><b>Inside-out</b> tracking puts cameras on the headset. They find distinctive points (corners, texture) in the room and track how they move between frames. <b>SLAM</b>, simultaneous localisation and mapping, solves two problems at once: build a 3D map of those points, and work out where the headset is within that map. Watch the points turn teal as they get added to the map. An estimator (often a Kalman style filter) fuses the slow but drift free camera fixes with the fast but drifting IMU.</p>
      <p class="small"><b>Outside-in</b> tracking puts sensors in the room. Valve's Lighthouse base stations sweep laser lines across the room, and photodiodes on the headset time the sweeps. Older Oculus Rift sensors were cameras watching infrared LEDs on the headset. Outside-in can be very precise but needs setup and only works where the sensors can see you.</p>
    </div>`));
    const dock = addDock(ctx, '<div class="grp glass"><span>Drag to</span><button data-m="rot" class="on">Rotate head</button><button data-m="move">Move head</button></div>');
    dock.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { dragMode = b.dataset.m; dock.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); }, { signal: ctx.signal }));

    const tracked = { pos: new THREE.Vector3(), yaw: 0, pitch: 0 };
    const neck = new THREE.Vector3(0, 0.0, 0);
    const tmp = new THREE.Vector3(); const fwd = new THREE.Vector3();
    let mappedCount = 0; const seenNow = [];

    ctx.loop((time, dt) => {
      // drift when the cameras are covered
      if (!cams) {
        drift.t += dt;
        drift.yaw += 4 * DEG * dt; // exaggerated gyro bias
        drift.vel.addScaledVector(drift.bias, dt);
        drift.pos.addScaledVector(drift.vel, dt);
      } else {
        const k = Math.min(1, dt * 5);
        drift.yaw *= 1 - k; drift.pos.multiplyScalar(1 - k); drift.vel.multiplyScalar(1 - k);
      }
      // tracked pose
      tracked.yaw = P.yaw + drift.yaw; tracked.pitch = P.pitch;
      if (dof === 6) tracked.pos.copy(P.pos).add(drift.pos);
      else tracked.pos.copy(home).add(neck);
      phys.position.copy(P.pos); phys.rotation.set(P.pitch, P.yaw, 0, 'YXZ');
      ghost.position.copy(tracked.pos); ghost.rotation.set(tracked.pitch, tracked.yaw, 0, 'YXZ');
      ghost.visible = true;

      // features seen by the headset cameras (inside-out only)
      seenNow.length = 0;
      fwd.set(0, 0, -1).applyEuler(phys.rotation);
      feats.forEach((f, i) => {
        let seen = false;
        if (method === 'inside' && cams) {
          tmp.copy(f.p).sub(P.pos); const dist = tmp.length(); tmp.normalize();
          // four wide cameras together cover a broad cone around the face
          seen = tmp.dot(fwd) > Math.cos(80 * DEG) && dist < 6.5;
          if (seen) { if (f.mapped < 1) { f.mapped = Math.min(1, f.mapped + dt * 1.5); } seenNow.push(f); }
        }
        const m = f.mapped; const c = new THREE.Color(seen ? C.c2 : m >= 1 ? C.c1 : '#5a5a55');
        fcol.set([c.r, c.g, c.b], i * 3);
      });
      featGeo.attributes.color.needsUpdate = true;
      featPts.visible = method === 'inside';
      mappedCount = feats.filter((f) => f.mapped >= 1).length;
      stationMeshes.forEach((m) => { m.visible = method === 'outside'; });

      // observer camera
      const tgt = new THREE.Vector3(P.pos.x * 0.7, 1.25, P.pos.z * 0.7 - 0.4);
      obsCam.position.set(tgt.x + Math.sin(obsYaw) * 3.3, 2.5, tgt.z + Math.cos(obsYaw) * 3.3);
      obsCam.lookAt(tgt);

      const R = gl.renderer; const W = gl.w; const H = gl.h;
      R.setScissorTest(false); R.setViewport(0, 0, W, H);
      R.render(scene, obsCam);
      // picture in picture: what the headset renders from its tracked pose
      const pw = Math.round(Math.min(W * 0.36, 300)); const ph = Math.round(pw / 1.2); const px = W - pw - 12; const py = H - ph - 12;
      eyeCam.position.copy(tracked.pos); eyeCam.rotation.set(tracked.pitch, tracked.yaw, 0, 'YXZ');
      phys.visible = false; ghost.visible = false;
      R.setScissorTest(true); R.setScissor(px, py, pw, ph); R.setViewport(px, py, pw, ph);
      R.render(scene, eyeCam);
      R.setScissorTest(false); R.setViewport(0, 0, W, H);
      phys.visible = true; ghost.visible = true;

      drawOverlay(px, H - py - ph, pw, ph);
      const perr = tracked.pos.distanceTo(P.pos);
      stats.querySelector('.s-p').textContent = perr > 1 ? `${perr.toFixed(2)} m` : `${Math.round(perr * 100)} cm`;
      stats.querySelector('.s-y').textContent = `${Math.abs(drift.yaw / DEG).toFixed(1)}°`;
      stats.querySelector('.s-m').textContent = method === 'inside' ? `${mappedCount}` : '-';
    });

    function drawOverlay(px, py, pw, ph) {
      const g = ov.ctx; const W = ov.w; const H = ov.h;
      g.clearRect(0, 0, W, H);
      const hp = toScreen(P.pos, obsCam, W, H);
      if (method === 'inside' && cams) {
        g.strokeStyle = 'rgba(251,191,36,.28)'; g.lineWidth = 1;
        seenNow.slice(0, 40).forEach((f) => { const s = toScreen(f.p, obsCam, W, H); if (s.behind) return; g.beginPath(); g.moveTo(hp.x, hp.y); g.lineTo(s.x, s.y); g.stroke(); });
      }
      if (method === 'outside') {
        stations.forEach((st, i) => {
          const s = toScreen(st, obsCam, W, H);
          g.strokeStyle = cams ? 'rgba(251,113,133,.7)' : 'rgba(251,113,133,.2)'; g.setLineDash([5, 5]); g.lineDashOffset = -performance.now() / 40;
          g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(hp.x, hp.y); g.stroke(); g.setLineDash([]);
          pill(g, `base station ${i + 1}`, s.x, s.y - 16, { color: C.c4, px: 10 });
        });
      }
      pill(g, 'your real head', hp.x, hp.y + 28, { px: 10 });
      const gp = toScreen(ghost.position, obsCam, W, H);
      if (gp.x !== hp.x && Math.hypot(gp.x - hp.x, gp.y - hp.y) > 30) pill(g, 'where the headset thinks you are', gp.x, gp.y - 26, { color: C.c1, px: 10 });
      // inset frame
      g.strokeStyle = 'rgba(245,245,240,.6)'; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, pw, ph);
      pill(g, 'what the headset shows', px + pw / 2, py + 12, { px: 10 });
      if (!cams) pill(g, `IMU only for ${drift.t.toFixed(1)} s: drifting`, W / 2, 16, { color: C.c4 });
      if (dof === 3) pill(g, '3DoF: position is not tracked', W / 2, cams ? 16 : 40, { color: C.c2 });
    }

    ctx.quiz([
      { q: 'You lean forward to read a sign in a 3DoF headset. What happens?', choices: ['The sign gets closer', 'Nothing, position is not tracked', 'The headset switches to 6DoF'], answer: 1, why: '3DoF tracks only rotation. Leaning moves your head but the rendered viewpoint stays put.' },
      { q: 'Why can\'t a headset track position with its IMU alone for long?', choices: ['IMUs only measure magnetic fields', 'Double integrating a small acceleration bias makes the error grow with time squared', 'IMUs are too slow'], answer: 1, why: 'Acceleration to velocity to position: a tiny constant bias becomes a quickly growing position error.' },
      { q: 'In SLAM, what are the two things solved at the same time?', choices: ['Sound and light', 'A map of the surroundings and the device\'s position within it', 'Frame rate and resolution'], answer: 1, why: 'Simultaneous localisation and mapping: build the map, and locate yourself in it.' },
    ]);
  },
};
