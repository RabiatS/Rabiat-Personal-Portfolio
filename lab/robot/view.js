// Drawing the robot with three.js. The meshes are g1.xml's own (meshes.js),
// hung on the same bodies MuJoCo simulates, and each body is posed from the
// simulation every frame. MuJoCo is z-up: one group turns it to y-up.
import * as THREE from 'three';

const COL = { void: 0x0a0a0a, bone: 0xf5f5f0, graphite: 0x2b2b2a, teal: 0x5eead4 };
const FLOOR = 60;          // metres; it follows the robot in whole-metre steps
const SHADOW = 2.6;        // half-size of the shadow camera, metres

function gridTexture(renderer) {
  const s = 256, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#0d0d0d'; g.fillRect(0, 0, s, s);
  g.fillStyle = 'rgba(245,245,240,.035)';
  for (const p of [64, 128, 192]) { g.fillRect(p, 0, 1, s); g.fillRect(0, p, s, 1); }
  g.fillStyle = 'rgba(245,245,240,.11)';
  g.fillRect(0, 0, 2, s); g.fillRect(0, 0, s, 2);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(FLOOR, FLOOR);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture() {
  const s = 128, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(94,234,212,.22)'); r.addColorStop(0.45, 'rgba(94,234,212,.07)'); r.addColorStop(1, 'rgba(94,234,212,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createView(canvas, data, { phone = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    throw new Error('This browser cannot draw in 3D (no WebGL2).');
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.xr.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.void);
  scene.fog = new THREE.Fog(COL.void, 7, 22);
  const stage = new THREE.Group();          // everything; moved as one in VR
  scene.add(stage);
  const world = new THREE.Group();          // MuJoCo's frame
  world.rotation.x = -Math.PI / 2;
  stage.add(world);

  // ---------- light: a soft key with shadows, and a teal rim from behind ----------
  stage.add(new THREE.HemisphereLight(0xf5f5f0, 0x0a0a0a, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.castShadow = true;
  key.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -SHADOW, right: SHADOW, top: SHADOW, bottom: -SHADOW, near: 0.5, far: 14 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  const rim = new THREE.DirectionalLight(COL.teal, 2.6);
  stage.add(key, key.target, rim, rim.target);

  // ---------- floor: a soft grid that fades into the void ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR, FLOOR),
    new THREE.MeshStandardMaterial({ color: 0xffffff, map: gridTexture(renderer), roughness: 0.94, metalness: 0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  stage.add(floor);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2),
    new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = 0.002; glow.renderOrder = 1;
  stage.add(glow);

  // ---------- the robot ----------
  const bone = new THREE.MeshStandardMaterial({ color: COL.bone, roughness: 0.42, metalness: 0.06 });
  const dark = new THREE.MeshStandardMaterial({ color: COL.graphite, roughness: 0.5, metalness: 0.25 });
  const bodies = [];
  for (let b = 0; b < data.nbody; b++) { const g = new THREE.Group(); world.add(g); bodies.push(g); }
  const geometries = data.meshes.map((m) => {
    if (!m) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(m.pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(m.nrm, 3));
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    return geo;
  });
  const pickables = [];
  for (const g of data.geoms) {
    const lum = 0.3 * g.rgba[0] + 0.59 * g.rgba[1] + 0.11 * g.rgba[2];
    const mesh = new THREE.Mesh(geometries[g.mesh], lum < 0.4 ? dark : bone);
    mesh.position.set(g.pos[0], g.pos[1], g.pos[2]);
    mesh.quaternion.set(g.quat[1], g.quat[2], g.quat[3], g.quat[0]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.body = g.body;
    bodies[g.body].add(mesh);
    pickables.push(mesh);
  }
  const pelvis = bodies[data.pelvis], torso = bodies[data.torso];

  // ---------- name plate on the chest ----------
  // Sized from the torso's own meshes (body frame, MuJoCo axes: x forward, z up),
  // so it sits just proud of the chest and moves with every step.
  (function namePlate() {
    const box = new THREE.Box3();
    for (const m of torso.children) {
      if (!m.geometry?.boundingBox) continue;
      m.updateMatrix();
      box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrix));
    }
    if (box.isEmpty()) return;
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const draw = () => {
      const x = c.getContext('2d');
      x.clearRect(0, 0, c.width, c.height);
      x.font = '700 92px Rajdhani, "Barlow Condensed", sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = '#d62828';
      x.fillText('RABIAT', c.width / 2, c.height / 2 + 6);
      tex.needsUpdate = true;
    };
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    draw();
    document.fonts?.load('700 92px Rajdhani').then(draw, () => {});
    const w = (box.max.y - box.min.y) * 0.8;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    // text runs along +y (the viewer's right when facing the robot), reads upward along +z, faces +x
    plate.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
    plate.position.set(box.max.x + 0.004, (box.min.y + box.max.y) / 2, box.min.z + (box.max.z - box.min.z) * 0.42);
    torso.add(plate);
  })();

  // ---------- push feedback, in teal ----------
  const tealLine = new THREE.MeshBasicMaterial({ color: COL.teal, transparent: true, opacity: 0.9, depthTest: false, fog: false });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 10).translate(0, 0.5, 0), tealLine);
  const dotA = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 12), tealLine);
  const dotB = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 10), tealLine);
  for (const o of [rod, dotA, dotB]) { o.visible = false; o.renderOrder = 5; world.add(o); }
  const rings = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.185, 64),
      new THREE.MeshBasicMaterial({ color: COL.teal, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    m.visible = false; m.renderOrder = 4; stage.add(m);
    return m;
  });
  let shoveFx = null;

  // ---------- camera: follows the pelvis; drag empty space to orbit ----------
  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 60);
  const orbit = { az: 0.95, el: 0.3, dist: 3.9 };
  const focus = new THREE.Vector3(0, 0.78, 0);
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.8 ? 44 : 36;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);

  function placeCamera() {
    const d = orbit.dist * (camera.aspect < 0.8 ? 1.15 : 1);
    camera.position.set(focus.x + d * Math.cos(orbit.el) * Math.sin(orbit.az), focus.y + d * Math.sin(orbit.el),
      focus.z + d * Math.cos(orbit.el) * Math.cos(orbit.az));
    camera.lookAt(focus);
  }

  // ---------- VR: the robot stands a couple of metres in front of you ----------
  const vr = { on: false, controllers: [] };
  for (let i = 0; i < 2; i++) {
    const c = renderer.xr.getController(i);
    c.addEventListener('select', () => vr.onSelect?.(c));
    scene.add(c);
    vr.controllers.push(c);
  }
  renderer.xr.addEventListener('sessionstart', () => { vr.on = true; vr.placed = false; });
  renderer.xr.addEventListener('sessionend', () => { vr.on = false; stage.position.set(0, 0, 0); });

  const api = {
    renderer, camera,
    get vr() { return vr.on; },
    setPose(pose) {
      for (let b = 0; b < bodies.length; b++) {
        const o = 7 * b;
        bodies[b].position.set(pose[o], pose[o + 1], pose[o + 2]);
        bodies[b].quaternion.set(pose[o + 4], pose[o + 5], pose[o + 6], pose[o + 3]);
      }
    },
    // A point on the robot under the pointer: which body, where on it (body frame), and how high.
    pick(ndc) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(pickables, false)[0];
      if (!hit) return null;
      const body = hit.object.userData.body;
      const local = bodies[body].worldToLocal(hit.point.clone());
      return { body, local: [local.x, local.y, local.z], height: hit.point.y };
    },
    // Where the pointer meets the level plane at the grab height, in MuJoCo's frame.
    groundPoint(ndc, height) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -height);
      const p = ray.ray.intersectPlane(plane, new THREE.Vector3());
      if (!p) return null;
      world.worldToLocal(p);
      return [p.x, p.y, p.z];
    },
    // The camera's forward direction along the ground, in MuJoCo's x-y plane.
    groundForward() {
      tmp.subVectors(focus, camera.position); tmp.y = 0;
      if (tmp.lengthSq() < 1e-6) return [1, 0];
      tmp.normalize();
      return [tmp.x, -tmp.z];
    },
    setDrag(anchor, target, strength) {
      const on = !!(anchor && target);
      rod.visible = dotA.visible = dotB.visible = on;
      if (!on) return;
      tmp.set(anchor[0], anchor[1], anchor[2]); tmp2.set(target[0], target[1], target[2]);
      dotA.position.copy(tmp); dotB.position.copy(tmp2);
      const len = tmp.distanceTo(tmp2);
      rod.position.copy(tmp);
      rod.scale.set(1, Math.max(len, 1e-4), 1);
      rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmp2.sub(tmp).normalize());
      tealLine.opacity = 0.55 + 0.45 * Math.min(1, strength);
    },
    // Rings that burst from the torso in the direction of a shove (MuJoCo x-y).
    shove(dir) { shoveFx = { t: 0, dir: dir.slice() }; },
    orbitBy(dx, dy) {
      orbit.az -= dx * 0.006;
      orbit.el = Math.min(1.25, Math.max(0.04, orbit.el + dy * 0.004));
    },
    zoomBy(f) { orbit.dist = Math.min(9, Math.max(1.6, orbit.dist * f)); },
    snapFocus() { pelvis.getWorldPosition(tmp); focus.x = tmp.x; focus.z = tmp.z; },
    async enterVR(onSelect) {
      vr.onSelect = onSelect;
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] });
      renderer.xr.setReferenceSpaceType('local-floor');
      await renderer.xr.setSession(session);
    },
    controllerForward(c) {
      c.getWorldDirection(tmp).negate(); tmp.y = 0;
      if (tmp.lengthSq() < 1e-6) return [1, 0];
      tmp.normalize();
      return [tmp.x, -tmp.z];
    },
    loop(fn) { renderer.setAnimationLoop(fn); },
    // follow: false holds the camera still (while you hold the robot, so the floor stays put under the pointer).
    update(dt, { follow = true } = {}) {
      pelvis.getWorldPosition(tmp);
      if (vr.on) {
        // Keep the robot about 2 m ahead of where you started, drifting gently, never jumping.
        const want = tmp2.set(-(tmp.x - stage.position.x), 0, -(tmp.z - stage.position.z) - 2.2);
        if (!vr.placed) { stage.position.copy(want); vr.placed = true; }
        else stage.position.lerp(want, 1 - Math.exp(-dt * 0.6));
      }
      const k = follow ? 1 - Math.exp(-dt * 3.5) : 0;
      focus.x += (tmp.x - focus.x) * k; focus.z += (tmp.z - focus.z) * k;
      focus.y += (Math.min(0.85, Math.max(0.35, tmp.y + 0.05)) - focus.y) * k;
      placeCamera();
      // floor, glow and lights travel with the robot
      floor.position.set(Math.round(focus.x), 0, Math.round(focus.z));
      glow.position.set(tmp.x, 0.002, tmp.z);
      // from above and to the camera's right, so the shadow falls where you can see it
      key.position.set(focus.x + 3.2 * Math.sin(orbit.az + 1.1), 5.4, focus.z + 3.2 * Math.cos(orbit.az + 1.1)); key.target.position.set(focus.x, 0, focus.z);
      // low and behind the robot, so it edges the robot and barely touches the floor
      rim.position.set(focus.x - 3 * Math.sin(orbit.az), focus.y + 0.25, focus.z - 3 * Math.cos(orbit.az)); rim.target.position.set(focus.x, focus.y + 0.25, focus.z);
      if (shoveFx) {
        shoveFx.t += dt;
        torso.getWorldPosition(tmp);
        const d3 = tmp2.set(shoveFx.dir[0], 0, -shoveFx.dir[1]);
        rings.forEach((r, i) => {
          const p = Math.max(0, Math.min(1, (shoveFx.t - i * 0.08) / 0.5));
          r.visible = p > 0 && p < 1;
          r.position.copy(tmp).addScaledVector(d3, -0.25 + 0.35 * p);
          r.lookAt(tmp.x + d3.x, tmp.y, tmp.z + d3.z);
          r.scale.setScalar(0.6 + 1.8 * p);
          r.material.opacity = 0.9 * (1 - p);
        });
        if (shoveFx.t > 0.7) { shoveFx = null; rings.forEach((r) => { r.visible = false; }); }
      }
      renderer.render(scene, camera);
    },
  };
  return api;
}
