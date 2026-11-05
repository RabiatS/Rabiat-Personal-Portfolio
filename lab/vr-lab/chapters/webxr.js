// Chapter 12: build for VR on the web. A live three.js scene that can enter immersive VR or AR through WebXR
// when the browser supports it, with feature detection and a minimal raw WebXR frame loop to read.
import { THREE, makeGL, addLights, drag, tex, std, basic, mesh, floorGeo, boxGeo, clamp, reduced } from '../lib/xr.js';

const CODE_RAW = `// 1. Is immersive VR available here?
const ok = navigator.xr &&
  await navigator.xr.isSessionSupported('immersive-vr');

// 2. Start a session from a click (needs HTTPS)
button.onclick = async () => {
  const session = await navigator.xr.requestSession(
    'immersive-vr', { optionalFeatures: ['local-floor'] });
  const gl = canvas.getContext('webgl2', { xrCompatible: true });
  session.updateRenderState({
    baseLayer: new XRWebGLLayer(session, gl) });
  const space = await session.requestReferenceSpace('local-floor');

  // 3. Every frame: read the head pose, draw each eye
  session.requestAnimationFrame(function frame(t, xrFrame) {
    session.requestAnimationFrame(frame);
    const pose = xrFrame.getViewerPose(space);
    if (!pose) return;
    const layer = session.renderState.baseLayer;
    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    for (const view of pose.views) {      // one per eye
      const vp = layer.getViewport(view);
      gl.viewport(vp.x, vp.y, vp.width, vp.height);
      draw(view.projectionMatrix,          // off axis frustum
           view.transform.inverse.matrix); // eye pose
    }
  });
};`;

const CODE_THREE = `renderer.xr.enabled = true;
const session = await navigator.xr.requestSession('immersive-vr');
await renderer.xr.setSession(session);
renderer.setAnimationLoop(() => renderer.render(scene, camera));`;

export default {
  mount(ctx) {
    const C = ctx.colors;
    const esc = ctx.esc;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#0b0f1a');
    addLights(scene);
    const grid = tex.grid(C.c1, '#081016'); grid.repeat.set(30, 30);
    scene.add(mesh(floorGeo(30, 30), basic('#ffffff', { map: grid })));
    // a small welcome scene placed in front of where a standing user starts (origin, looking toward -z)
    const group = new THREE.Group(); group.position.set(0, 0, -1.6);
    const ped = mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.9, 40), std('#20232b', { roughness: 0.6 }), 0, 0.45, 0);
    group.add(ped);
    const knot = mesh(new THREE.TorusGeometry(0.22, 0.07, 24, 80), std(C.c1, { roughness: 0.25, metalness: 0.2, emissive: '#0b3b35' }), 0, 1.35, 0);
    group.add(knot);
    const orbiters = [C.c2, C.c3, C.c4, C.c5].map((c, i) => { const m = mesh(new THREE.SphereGeometry(0.06, 20, 14), std(c, { emissive: c, emissiveIntensity: 0.3 })); group.add(m); return { m, i }; });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      scene.add(mesh(boxGeo(0.3, 0.3 + (i % 4) * 0.5, 0.3), std([C.c1, C.c3, C.c5][i % 3], { roughness: 0.5 }), Math.cos(a) * 5, 0.15 + (i % 4) * 0.25, Math.sin(a) * 5 - 1));
    }
    scene.add(group);
    const spawned = [];

    const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 100);
    const gl = makeGL(ctx, { onSize: (w, h) => { camera.aspect = w / h; camera.updateProjectionMatrix(); } });
    const R = gl.renderer;
    R.xr.enabled = true;
    // controllers with a short ray each, and select spawns a ball
    for (let i = 0; i < 2; i++) {
      const c = R.xr.getController(i);
      const rayM = mesh(new THREE.CylinderGeometry(0.003, 0.003, 1, 6), basic(C.c1, { transparent: true, opacity: 0.7 }));
      rayM.rotation.x = -Math.PI / 2; rayM.position.z = -0.5; c.add(rayM);
      c.addEventListener('select', () => {
        const b = mesh(new THREE.SphereGeometry(0.05, 16, 10), std([C.c2, C.c4, C.c6][spawned.length % 3]));
        b.position.setFromMatrixPosition(c.matrixWorld); scene.add(b); spawned.push(b);
      });
      scene.add(c);
    }

    const view = { yaw: 0.5, pitch: 0.25 };
    drag(gl.el, ctx.signal, (dx, dy) => { view.yaw -= dx * 0.006; view.pitch = clamp(view.pitch + dy * 0.004, 0.02, 1.1); });
    let session = null;

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Build for VR on the web</h2>'),
      ctx.h('<p class="lede">Everything in this lab runs in a browser. With the WebXR Device API, the same page can open on a headset and put you inside the scene, no app store needed.</p>'),
    );
    const sup = ctx.h(`<div class="card"><h3>Your browser</h3><div class="stat" style="grid-template-columns:repeat(2,1fr)">
      <div><b class="x-s">…</b><span>Secure context</span></div>
      <div><b class="x-x">…</b><span>navigator.xr</span></div>
      <div><b class="x-v">…</b><span>Immersive VR</span></div>
      <div><b class="x-a">…</b><span>Immersive AR</span></div></div>
      <div class="row"><button class="btn x-enter" disabled>Enter VR</button><button class="btn ghost x-ar" hidden>Enter AR</button></div>
      <p class="small muted x-note">Checking…</p></div>`);
    ctx.panel.append(sup);
    ctx.panel.append(ctx.h(`<p class="small">Want a bigger example? The site has its own WebXR scene: <a href="/vr.html">open the VR version of this portfolio</a>, built with three.js and WebXR.</p>`));
    ctx.panel.append(ctx.h(`<div class="card tip"><p><b>WebXR</b> is the browser's standard way to talk to VR and AR hardware. You ask whether a kind of session is supported, start one from a button click, and the browser hands you the head pose and one view per eye every frame. You draw each view with WebGL (or WebGPU), and the headset's compositor does the lens warp and timewarp for you.</p></div>`));
    ctx.panel.append(ctx.h('<p class="hint">The whole frame loop, in raw WebXR:</p>'));
    ctx.panel.append(ctx.h(`<pre class="code">${esc(CODE_RAW)}</pre>`));
    ctx.panel.append(ctx.h('<p class="hint">The same thing with three.js, which this page uses:</p>'));
    ctx.panel.append(ctx.h(`<pre class="code">${esc(CODE_THREE)}</pre>`));
    ctx.panel.append(ctx.h(`<div class="card try"><p>On a Quest or other standalone headset, open this page in its browser and press <b>Enter VR</b>: the knot floats in front of you and pulling a trigger drops a ball where your hand is. On a desktop without a headset, the Immersive Web Emulator browser extension can fake one for testing. On an AR capable phone, try <b>Enter AR</b>.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card deep">
      <p class="small"><b>Reference spaces</b> say what the coordinates mean: <code>viewer</code> (attached to the head), <code>local</code> (origin where the session started), <code>local-floor</code> (same, with y = 0 on the floor), <code>bounded-floor</code> (a play area) and <code>unbounded</code> (walk anywhere, for AR).</p>
      <p class="small">Each <code>XRView</code> carries its own projection matrix (the off axis frustum from chapter 2) and eye transform, so you never hardcode an IPD. The pose you get is already predicted for display time (chapter 6).</p>
      <p class="small">Optional modules add the mixed reality features from chapter 11: <b>hit test</b>, <b>anchors</b>, <b>plane detection</b>, <b>depth sensing</b>, <b>hand input</b>, <b>light estimation</b>, plus <b>layers</b> for sharp text and video. Sessions require HTTPS and a user gesture, and the user must grant permission.</p>
    </div>`));

    const set = (cls, ok) => { const el = sup.querySelector(cls); el.textContent = ok ? 'yes' : 'no'; el.style.color = ok ? C.ok : C.muted; };
    const enter = sup.querySelector('.x-enter'); const enterAR = sup.querySelector('.x-ar'); const note = sup.querySelector('.x-note');
    (async () => {
      set('.x-s', window.isSecureContext);
      const xr = navigator.xr; set('.x-x', !!xr);
      let vrOk = false; let arOk = false;
      if (xr) {
        try { vrOk = await xr.isSessionSupported('immersive-vr'); } catch { vrOk = false; }
        try { arOk = await xr.isSessionSupported('immersive-ar'); } catch { arOk = false; }
      }
      if (ctx.signal.aborted) return;
      set('.x-v', vrOk); set('.x-a', arOk);
      enter.disabled = !vrOk; enterAR.hidden = !arOk;
      note.textContent = vrOk || arOk
        ? 'Ready. Press a button to step inside. Press the headset\'s system button or Exit to come back.'
        : !xr ? (window.isSecureContext ? 'This browser has no WebXR. Try the browser on a VR headset, or Chrome or Edge with a connected PC headset.' : 'WebXR only works on HTTPS pages.')
          : 'WebXR is here, but no headset is connected. You can still drag the preview, or use the Immersive Web Emulator extension.';
    })();

    async function start(mode) {
      if (session) { session.end(); return; }
      try {
        const s = await navigator.xr.requestSession(mode, { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
        session = s;
        R.xr.setReferenceSpaceType('local-floor');
        if (mode === 'immersive-ar') scene.background = null;
        await R.xr.setSession(s);
        enter.textContent = 'Exit VR';
        s.addEventListener('end', () => { session = null; enter.textContent = 'Enter VR'; scene.background = new THREE.Color('#0b0f1a'); });
      } catch (e) {
        note.textContent = `Could not start the session: ${e.message || e}`;
      }
    }
    enter.addEventListener('click', () => start('immersive-vr'));
    enterAR.addEventListener('click', () => start('immersive-ar'));

    const t0 = performance.now();
    R.setAnimationLoop(() => {
      const t = reduced ? 0 : (performance.now() - t0) / 1000;
      knot.rotation.set(t * 0.5, t * 0.7, 0);
      orbiters.forEach(({ m, i }) => { const a = t * 0.8 + (i * Math.PI) / 2; m.position.set(Math.cos(a) * 0.45, 1.35 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.45); });
      if (!R.xr.isPresenting) {
        const tgt = new THREE.Vector3(0, 1.1, -1.6);
        const d = 3.6;
        camera.position.set(tgt.x + Math.sin(view.yaw) * Math.cos(view.pitch) * d, tgt.y + Math.sin(view.pitch) * d, tgt.z + Math.cos(view.yaw) * Math.cos(view.pitch) * d);
        camera.lookAt(tgt);
      }
      R.render(scene, camera);
    });
    ctx.quiz([
      { q: 'What must happen before a page can start an immersive WebXR session?', choices: ['Nothing, it starts automatically', 'A user gesture such as a button click, on an HTTPS page', 'Installing an app'], answer: 1, why: 'requestSession needs a secure context and user activation, and the user grants permission.' },
      { q: 'Why does each XRView come with its own projection matrix?', choices: ['Each eye needs its own (often asymmetric) frustum', 'To support different colour spaces', 'Because the left eye is always bigger'], answer: 0, why: 'The runtime knows the lens and eye geometry, so it gives a correct off axis projection per eye.' },
      { q: 'Which reference space puts y = 0 on the floor?', choices: ['viewer', 'local-floor', 'local'], answer: 1, why: 'local-floor keeps the origin near the starting point but at floor height.' },
    ]);
    return () => { if (session) session.end().catch(() => {}); };
  },
};
