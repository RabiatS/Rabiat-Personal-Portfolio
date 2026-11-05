// Chapter 11: passthrough and mixed reality. The room is drawn as a grainy camera feed, a virtual ball rolls through it
// with or without depth occlusion, plane detection finds surfaces over time, and clicks place anchors on them.
import { THREE, makeGL, makeRoom, addLights, overlay, drag, tex, std, basic, mesh, floorGeo, wallGeo, boxGeo, clamp, DEG, MONO, pill, toScreen, reduced } from '../lib/xr.js';

export default {
  mount(ctx) {
    const C = ctx.colors;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#0d0d0d');
    addLights(scene);
    const room = makeRoom();
    scene.add(room.group);
    // camera feed look for every real material: slight desaturation, grain and a cool cast
    const pt = { value: 1 }; const time = { value: 0 };
    room.group.traverse((o) => {
      if (!o.material) return;
      o.material.onBeforeCompile = (sh) => {
        sh.uniforms.uPT = pt; sh.uniforms.uTime = time;
        sh.fragmentShader = 'uniform float uPT;\nuniform float uTime;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
  float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
  vec2 q = floor(gl_FragCoord.xy / 1.5);
  float n = fract(sin(dot(q + floor(uTime * 24.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  vec3 feed = mix(gl_FragColor.rgb, vec3(lum), 0.35) * vec3(0.94, 0.98, 1.04) + n * 0.07;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, feed, uPT);`);
      };
      o.material.needsUpdate = true;
    });
    // virtual environment for the passthrough off view
    const vr = new THREE.Group();
    const g2 = tex.grid(C.c3, '#0d0a18'); g2.repeat.set(60, 60);
    vr.add(mesh(floorGeo(60, 60), basic('#ffffff', { map: g2 }), 0, 0.001, 0));
    vr.add(mesh(new THREE.SphereGeometry(28, 24, 12), basic('#ffffff', { map: tex.sky('#140c2a', '#2b1c45'), side: 1 })));
    scene.add(vr);

    // virtual ball
    const ballMat = std(C.c2, { roughness: 0.25, emissive: '#3a2600' });
    const ball = mesh(new THREE.SphereGeometry(0.13, 28, 18), ballMat);
    const shadow = mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.002, 24), basic('#000000', { transparent: true, opacity: 0.35 }));
    scene.add(ball, shadow);

    // detected planes
    const planeTex = tex.grid(C.c1, 'rgba(94,234,212,0.16)');
    const pmat = () => basic('#ffffff', { map: planeTex, transparent: true, opacity: 0.8, depthWrite: false, side: 2 });
    const S = room.size / 2;
    const planes = [
      { name: 'floor', y: 0, kind: 'h', x0: -S, x1: S, z0: -S, z1: S, m: mesh(floorGeo(room.size, room.size, room.size), pmat(), 0, 0.01, 0), at: 0 },
      { name: 'table', y: 0.765, kind: 'h', x0: -0.7, x1: 0.7, z0: -1.0, z1: -0.2, m: mesh(floorGeo(1.4, 0.8, 2), pmat(), 0, 0.775, -0.6), at: 1.2 },
      { name: 'seat', y: 0.42, kind: 'h', x0: -1.4, x1: 0.6, z0: -3.3, z1: -2.5, m: mesh(floorGeo(2.0, 0.6, 2), pmat(), -0.4, 0.43, -2.8), at: 2.2 },
      { name: 'wall', kind: 'v', z: -S, x0: -S, x1: S, y0: 0, y1: room.height, m: mesh(wallGeo(room.size, room.height, room.size), pmat(), 0, room.height / 2, -S + 0.015), at: 0.6 },
    ];
    planes.forEach((p) => { p.m.visible = false; p.m.renderOrder = 5; scene.add(p.m); });
    let scanT = -1;

    const anchors = [];
    function addAnchor(p, normal, label) {
      const g = new THREE.Group();
      const body = mesh(boxGeo(0.14, 0.14, 0.14), std(C.c3, { roughness: 0.3, emissive: '#1a1033' }));
      body.position.copy(normal).multiplyScalar(0.07);
      g.add(body);
      const ax = (col, rot) => { const c = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 6), basic(col)); c.position.y = 0.11; const h = new THREE.Group(); h.add(c); h.rotation.set(...rot); return h; };
      g.add(ax('#ff5a5a', [0, 0, -Math.PI / 2]), ax('#5aff7a', [0, 0, 0]), ax('#5aa0ff', [Math.PI / 2, 0, 0]));
      g.position.copy(p);
      if (normal.z > 0.5) g.rotation.x = Math.PI / 2;
      scene.add(g); anchors.push({ g, label, body });
    }

    const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80);
    const gl = makeGL(ctx, { onSize: (w, h) => { camera.aspect = w / h; camera.fov = w / h < 0.9 ? 78 : 60; camera.updateProjectionMatrix(); } });
    const ov = overlay(ctx);

    let view = 'mr'; let occlusion = true;
    const head = { yaw: 0.15, pitch: 0.18 }; let moved = 0; let msg = ''; let msgT = 0;
    drag(gl.el, ctx.signal, (dx, dy) => { moved += Math.abs(dx) + Math.abs(dy); head.yaw = clamp(head.yaw - dx * 0.004, -0.9, 0.9); head.pitch = clamp(head.pitch + dy * 0.003, -0.05, 0.6); }, () => { moved = 0; }, (e) => { if (moved < 6) place(e); });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Passthrough and mixed reality</h2>'),
      ctx.h('<p class="lede">Mixed reality headsets film the room with cameras and show it to you live, then draw virtual things into it. Making those things feel like they are really there is the hard part.</p>'),
    );
    ctx.panel.append(ctx.seg([['mr', 'Passthrough on'], ['vr', 'Passthrough off']], view, (v) => { view = v; }));
    const occ = ctx.h('<label class="check"><input type="checkbox" checked> Depth occlusion (real things hide virtual things)</label>');
    occ.querySelector('input').addEventListener('change', (e) => { occlusion = e.target.checked; });
    ctx.panel.append(occ);
    const scanBtn = ctx.h('<button class="btn ghost sm act">Scan the room</button>');
    scanBtn.addEventListener('click', () => { scanT = 0; planes.forEach((p) => { p.m.visible = false; }); });
    const clr = ctx.h('<button class="btn ghost sm act">Remove anchors</button>');
    clr.addEventListener('click', () => { anchors.splice(0).forEach((a) => scene.remove(a.g)); });
    const row = ctx.h('<div class="row"></div>'); row.append(scanBtn, clr); ctx.panel.append(row);
    const stats = ctx.h('<div class="stat"><div><b class="s-p">0</b><span>Planes found</span></div><div><b class="s-a">0</b><span>Anchors</span></div></div>');
    ctx.panel.append(stats);
    ctx.panel.append(ctx.h(`<div class="card tip"><p><b>Passthrough</b> means the headset's outward cameras show you the real room on its screens, so you can see while wearing it. On top of that video, the headset draws virtual objects.</p><p>To make them believable it needs to understand the room: <b>occlusion</b> (a real sofa should hide a virtual ball behind it), <b>plane detection</b> (where are the floor, walls and table, so things can sit on them), and <b>anchors</b> (a pin in the real world, so a virtual object stays in place when you move).</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><p>Watch the yellow ball roll behind the sofa. Untick depth occlusion: it now floats in front of everything, which instantly looks fake. Press <b>Scan the room</b>, then click on the floor, table or wall to drop anchored cubes. Drag to move your head: the cubes stay pinned to the real surfaces.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card deep">
      <p class="small"><b>Camera to eye reprojection.</b> The cameras are a few centimetres away from your eyes, so the video must be re-projected to each eye's viewpoint using depth. Errors show up as warping near your hands and close objects. It also adds latency, so passthrough pipelines run on dedicated hardware.</p>
      <p class="small"><b>Occlusion</b> comes from a depth map of the room (from stereo cameras or a depth sensor) or from a coarse scene mesh. Depth maps are noisy at edges, so occlusion boundaries often shimmer, especially around hands and hair.</p>
      <p class="small"><b>Scene understanding</b> combines SLAM feature points into planes, meshes and labelled objects (table, couch, wall). <b>Anchors</b> are poses the tracking system keeps refining as its map improves; spatial anchors can be saved and shared so several people see the same object in the same place. In WebXR these map to the plane detection, hit test, anchors and depth sensing modules.</p>
      <p class="small">Also note <b>lighting</b>: a believable virtual object needs light estimation (matching the room's brightness and colour) and contact shadows, like the soft shadow under the ball here.</p>
    </div>`));

    const ray = new THREE.Vector3();
    function place(e) {
      const r = gl.el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 2 - 1; const y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      ray.set(x, y, 0.5).unproject(camera).sub(camera.position).normalize();
      const o = camera.position; let best = null;
      for (const p of planes) {
        if (!p.m.visible || p.m.scale.x < 0.98) continue;
        if (p.kind === 'h') {
          if (Math.abs(ray.y) < 1e-4) continue; const t = (p.y - o.y) / ray.y; if (t <= 0) continue;
          const hx = o.x + ray.x * t; const hz = o.z + ray.z * t;
          if (hx < p.x0 || hx > p.x1 || hz < p.z0 || hz > p.z1) continue;
          if (!best || t < best.t) best = { t, p, pos: new THREE.Vector3(hx, p.y, hz), n: new THREE.Vector3(0, 1, 0) };
        } else {
          const t = (p.z - o.z) / ray.z; if (t <= 0) continue;
          const hx = o.x + ray.x * t; const hy = o.y + ray.y * t;
          if (hx < p.x0 || hx > p.x1 || hy < p.y0 || hy > p.y1) continue;
          if (!best || t < best.t) best = { t, p, pos: new THREE.Vector3(hx, hy, p.z + 0.01), n: new THREE.Vector3(0, 0, 1) };
        }
      }
      if (best) { addAnchor(best.pos, best.n, best.p.name); msg = `anchored to ${best.p.name}`; }
      else msg = planes.some((p) => p.m.visible) ? 'no detected surface there' : 'scan the room first to find surfaces';
      msgT = 2;
    }

    let bt = 0;
    ctx.loop((t, dt) => {
      time.value = t;
      const mr = view === 'mr';
      pt.value = 1;
      room.group.visible = mr; vr.visible = !mr;
      // the ball circles the room, passing behind the sofa and under the table
      if (!reduced) bt += dt;
      const a = bt * 0.45;
      const bx = -0.2 + Math.cos(a) * 1.7; const bz = -2.2 + Math.sin(a) * 1.25;
      ball.position.set(bx, 0.13 + Math.abs(Math.sin(bt * 3)) * 0.25, bz);
      shadow.position.set(bx, 0.003, bz); shadow.material.opacity = 0.35 - (ball.position.y - 0.13) * 0.6;
      for (const m of [ballMat]) { m.depthTest = occlusion || !mr; }
      ball.renderOrder = occlusion || !mr ? 0 : 20; shadow.visible = mr && occlusion;
      anchors.forEach((an) => { an.g.traverse((o) => { if (o.material) { o.material.depthTest = occlusion || !mr; } o.renderOrder = occlusion || !mr ? 0 : 20; }); });
      // scanning grows the planes one after another
      if (scanT >= 0) {
        scanT += dt;
        planes.forEach((p) => {
          const k = clamp((scanT - p.at) / 1.4, 0, 1);
          p.m.visible = k > 0 && mr; p.m.scale.set(Math.max(0.001, k), 1, Math.max(0.001, k));
          if (p.kind === 'v') p.m.scale.set(Math.max(0.001, k), Math.max(0.001, k), 1);
          p.m.material.opacity = 0.6 + 0.4 * (1 - k);
        });
        if (scanT > 4.5) scanT = -2;
      } else if (scanT === -2) planes.forEach((p) => { p.m.visible = mr; });
      const tgt = new THREE.Vector3(-0.1, 0.8, -1.6);
      camera.position.set(tgt.x + Math.sin(head.yaw) * 4.2, tgt.y + 0.9 + Math.sin(head.pitch) * 2, tgt.z + Math.cos(head.yaw) * 4.2);
      camera.lookAt(tgt);
      gl.renderer.render(scene, camera);
      drawOverlay(dt);
      stats.querySelector('.s-p').textContent = `${planes.filter((p) => p.m.visible && p.m.scale.x > 0.98).length}`;
      stats.querySelector('.s-a').textContent = `${anchors.length}`;
    });

    function drawOverlay(dt) {
      const g = ov.ctx; const W = ov.w; const H = ov.h;
      g.clearRect(0, 0, W, H);
      if (view === 'mr') {
        planes.forEach((p) => {
          if (!p.m.visible || p.m.scale.x < 0.3) return;
          const c = p.kind === 'h' ? new THREE.Vector3((p.x0 + p.x1) / 2, p.y, (p.z0 + p.z1) / 2) : new THREE.Vector3(1.6, 2.4, p.z);
          if (p.name === 'floor') c.set(1.8, 0, 0.6);
          const s = toScreen(c, camera, W, H); if (!s.behind) pill(g, p.name, s.x, s.y, { color: C.c1, px: 10 });
        });
        if (scanT >= 0) {
          // feature sparkle while scanning
          g.fillStyle = C.c2;
          for (let i = 0; i < 60; i++) { g.globalAlpha = Math.random(); g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
          g.globalAlpha = 1;
          pill(g, 'scanning: finding surfaces', W / 2, 16, { color: C.c2 });
        } else pill(g, occlusion ? 'passthrough with depth occlusion' : 'passthrough, no occlusion', W / 2, 16);
      } else pill(g, 'passthrough off: fully virtual', W / 2, 16, { color: C.c3 });
      anchors.forEach((an) => { const s = toScreen(an.g.position, camera, W, H); if (!s.behind) pill(g, 'anchor', s.x, s.y + 16, { color: C.c3, px: 9 }); });
      if (msgT > 0) { msgT -= dt; pill(g, msg, W / 2, H - 24, { color: C.text }); }
    }

    ctx.quiz([
      { q: 'What is needed for a real sofa to correctly hide a virtual ball behind it?', choices: ['A brighter display', 'Depth information about the real room', 'A higher refresh rate'], answer: 1, why: 'Occlusion needs to know how far away the real surfaces are, from a depth map or scene mesh.' },
      { q: 'What does an anchor do?', choices: ['Locks a virtual object to a real world position, refined as tracking improves', 'Stops the headset from moving', 'Turns passthrough off'], answer: 0, why: 'Anchors keep content pinned to the world even as you move and the map is updated.' },
      { q: 'Why does passthrough video need to be re-projected?', choices: ['The cameras are not exactly where your eyes are', 'Cameras record upside down', 'To add colour'], answer: 0, why: 'The camera viewpoints differ from your eyes, so the image is warped using depth to match each eye.' },
    ]);
  },
};
