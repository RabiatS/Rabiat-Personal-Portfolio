// Chapter 6: motion to photon latency. The frame on screen is rendered from an old head pose.
// Prediction extrapolates the pose; timewarp (rotational reprojection) shifts the finished frame to the newest pose.
import { THREE, makeGL, makeRoom, addLights, drag, std, mesh, boxGeo, clamp, DEG, MONO, pill, reduced } from '../lib/xr.js';

export default {
  mount(ctx) {
    const C = ctx.colors;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#0d0d0d');
    addLights(scene);
    const room = makeRoom({ size: 10 });
    scene.add(room.group);
    const EYE = new THREE.Vector3(0, 1.55, 2.4);
    const posts = [];
    for (let a = -75; a <= 75; a += 15) {
      const col = a === 0 ? C.c2 : (a / 15) % 2 ? C.c5 : C.c1;
      const m = mesh(boxGeo(0.1, 1.2, 0.1), std(col, { emissive: col, emissiveIntensity: 0.25 }));
      m.position.set(EYE.x + Math.sin(a * DEG) * 2.4, 0.6 + (a === 0 ? 0.3 : 0), EYE.z - Math.cos(a * DEG) * 2.4);
      scene.add(m); posts.push(m);
    }
    const key = posts[5]; // the amber post straight ahead
    const gl = makeGL(ctx, { offscreen: true, preserve: true });
    const cv = ctx.canvas();
    const cam = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
    const camNow = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
    cam.position.copy(EYE); camNow.position.copy(EYE);

    let L = 50; let fix = 'none'; let hz = 90; let auto = !reduced;
    const head = { yaw: 0, pitch: 0 };
    const hist = []; // { t, yaw, pitch }
    const errHist = [];
    let autoT = 0; let lastNow = 0;
    drag(cv.el, ctx.signal, (dx, dy) => { auto = false; autoBtn.textContent = 'Auto head turns'; head.yaw = clamp(head.yaw - dx * 0.005, -1.1, 1.1); head.pitch = clamp(head.pitch - dy * 0.004, -0.5, 0.5); });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Motion to photon</h2>'),
      ctx.h('<p class="lede">When you turn your head, the picture has to follow almost instantly. A few hundredths of a second of delay is enough to make the whole world swim.</p>'),
    );
    ctx.panel.append(ctx.slider({ label: 'Motion to photon latency', min: 0, max: 100, step: 1, value: L, unit: ' ms', onInput: (v) => { L = v; } }));
    ctx.panel.append(ctx.h('<p class="hint">Fix</p>'));
    ctx.panel.append(ctx.seg([['none', 'None'], ['predict', 'Prediction'], ['warp', 'Timewarp'], ['both', 'Both']], fix, (v) => { fix = v; }));
    const autoBtn = ctx.h(`<button class="btn ghost sm act">${auto ? 'Stop auto head turns' : 'Auto head turns'}</button>`);
    autoBtn.addEventListener('click', () => { auto = !auto; autoBtn.textContent = auto ? 'Stop auto head turns' : 'Auto head turns'; });
    ctx.panel.append(ctx.h('<div class="row"></div>')); ctx.panel.lastChild.append(autoBtn);
    const stats = ctx.h('<div class="stat"><div><b class="s-e">0</b><span>Error now</span></div><div><b class="s-c">0</b><span>At 1 m</span></div><div><b class="s-f">0</b><span>Frames late</span></div></div>');
    ctx.panel.append(stats);
    ctx.panel.append(ctx.h(`<div class="card tip"><p><b>Motion to photon latency</b> is the time from your head moving to light from the updated picture reaching your eye. The headset has to read its sensors, render two views, and scan them out to the screen, and each step takes time. While that happens your head keeps moving, so the picture is drawn for where your head <i>was</i>.</p><p>The amber ring shows where the centre post really should be. The gap is the error your brain sees as the world sliding around.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><p>Leave the auto head turns on and set latency to 50 ms with no fix: the posts lag behind the ring. Try <b>Prediction</b>: it is good during steady turns but overshoots when the head stops. Try <b>Timewarp</b>: the image locks to the ring, and black edges appear where the old frame has no pixels. Drag on the view to turn the head yourself.</p></div>`));
    const budget = ctx.h('<div class="card"><h3>Frame budget</h3><div class="b-seg"></div><div class="stat"><div><b class="s-b">0</b><span>ms per frame</span></div><div><b class="s-b2">0</b><span>per eye, if split</span></div></div><p class="small muted">Both eyes plus everything else must fit in this budget every frame. Miss it and the compositor has to show an old frame again (reprojected, if it can).</p></div>');
    budget.querySelector('.b-seg').append(ctx.seg([[72, '72 Hz'], [90, '90 Hz'], [120, '120 Hz']], hz, (v) => { hz = +v; }));
    ctx.panel.append(budget);
    ctx.panel.append(ctx.h(`<div class="card deep">
      <p class="small">A long standing rule of thumb is to keep motion to photon latency under about 20 ms; good headsets get the effective number much lower using prediction and late reprojection. At 90 Hz a frame lasts 1000/90 = 11.1 ms, at 120 Hz 8.3 ms, at 72 Hz 13.9 ms.</p>
      <p class="small"><b>Prediction:</b> the runtime asks "where will the head be when these photons come out?" and renders for that predicted pose, extrapolating from angular velocity (and often acceleration). Head motion is smooth enough that this works well for tens of milliseconds, but it overshoots on sudden stops.</p>
      <p class="small"><b>Timewarp</b> (asynchronous timewarp, or rotational reprojection) runs just before scanout: it takes the finished frame and re-projects it using the newest head rotation. A pure rotation needs no depth, so it is cheap and exact for distant content. It cannot fix translation or animation, which needs depth based <b>positional</b> reprojection or motion vector methods such as spacewarp. Low persistence displays (each frame lit for only a couple of milliseconds) also cut the smear while your eyes track.</p>
    </div>`));

    function sample(t) {
      if (!hist.length) return { yaw: head.yaw, pitch: head.pitch, vy: 0, vp: 0 };
      if (t <= hist[0].t) return { ...hist[0], vy: 0, vp: 0 };
      for (let i = hist.length - 1; i > 0; i--) {
        const a = hist[i - 1]; const b = hist[i];
        if (a.t <= t && t <= b.t) {
          const k = (t - a.t) / (b.t - a.t || 1);
          const dtv = b.t - a.t || 1e-3;
          return { yaw: a.yaw + (b.yaw - a.yaw) * k, pitch: a.pitch + (b.pitch - a.pitch) * k, vy: (b.yaw - a.yaw) / dtv, vp: (b.pitch - a.pitch) / dtv };
        }
      }
      const z = hist[hist.length - 1]; return { ...z, vy: 0, vp: 0 };
    }
    // smoother velocity estimate over a 30 ms window, like a real pose filter
    function velAt(t) {
      const a = sample(t - 0.03); const b = sample(t);
      return { vy: (b.yaw - a.yaw) / 0.03, vp: (b.pitch - a.pitch) / 0.03 };
    }

    ctx.loop((time, dt) => {
      const now = performance.now() / 1000;
      if (auto) {
        // turn, hold, turn back: steady motion plus sudden stops
        autoT += Math.min(0.1, now - (lastNow || now));
        const cyc = autoT % 4; const seg = Math.floor(autoT / 4) % 2 ? -1 : 1;
        const s = cyc < 1.4 ? (1 - Math.cos((cyc / 1.4) * Math.PI)) / 2 : 1;
        head.yaw = seg * (-0.45 + 0.9 * s); head.pitch = Math.sin(autoT * 0.7) * 0.06;
      }
      lastNow = now;
      hist.push({ t: now, yaw: head.yaw, pitch: head.pitch });
      while (hist.length && hist[0].t < now - 1.5) hist.shift();

      const Ls = L / 1000;
      const old = sample(now - Ls);
      let rYaw = old.yaw; let rPitch = old.pitch;
      if (fix === 'predict' || fix === 'both') { const v = velAt(now - Ls); rYaw += v.vy * Ls; rPitch += v.vp * Ls; }
      // where the image ends up after optional timewarp to the newest pose
      const warp = fix === 'warp' || fix === 'both';
      const shownYaw = warp ? head.yaw : rYaw; const shownPitch = warp ? head.pitch : rPitch;

      const W = cv.w; const H = cv.h; const g = cv.ctx;
      if (!W) return;
      cam.aspect = W / H; cam.fov = W / H < 0.9 ? 80 : 62; cam.updateProjectionMatrix();
      camNow.aspect = cam.aspect; camNow.fov = cam.fov; camNow.updateProjectionMatrix();
      cam.rotation.set(rPitch, rYaw, 0, 'YXZ'); cam.updateMatrixWorld();
      camNow.rotation.set(head.pitch, head.yaw, 0, 'YXZ'); camNow.updateMatrixWorld();
      const r = gl.renderer; const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (gl.w !== Math.round(W) || gl.h !== Math.round(H)) { gl.w = Math.round(W); gl.h = Math.round(H); r.setPixelRatio(dpr); r.setSize(gl.w, gl.h, false); }
      r.render(scene, cam);
      // reprojection shift: rotating the head by d turns into a shift of f * tan(d) pixels near the centre
      const fpx = (H / 2) / Math.tan((cam.fov * DEG) / 2);
      let ox = 0; let oy = 0;
      if (warp) { ox = fpx * Math.tan(rYaw - head.yaw); oy = -fpx * Math.tan(rPitch - head.pitch); }
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.drawImage(r.domElement, ox, oy, W, H);
      if (warp && (Math.abs(ox) > 1 || Math.abs(oy) > 1)) {
        g.strokeStyle = 'rgba(251,113,133,.6)'; g.setLineDash([4, 4]); g.strokeRect(ox + 0.5, oy + 0.5, W - 1, H - 1); g.setLineDash([]);
      }
      // error ring: where the key post should be (current pose) versus where it is drawn
      const p = key.position.clone(); p.y += 0.3;
      const want = p.clone().project(camNow); const got = p.clone().project(cam);
      const wx = (want.x * 0.5 + 0.5) * W; const wy = (-want.y * 0.5 + 0.5) * H;
      const gx = (got.x * 0.5 + 0.5) * W + ox; const gy = (-got.y * 0.5 + 0.5) * H + oy;
      g.strokeStyle = C.c2; g.lineWidth = 2; g.beginPath(); g.arc(wx, wy, 16, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(251,191,36,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(wx, wy); g.lineTo(gx, gy); g.stroke();
      pill(g, 'should be here', wx, wy - 30, { color: C.c2, px: 10 });
      const errDeg = Math.hypot(shownYaw - head.yaw, shownPitch - head.pitch) / DEG;
      errHist.push(errDeg); if (errHist.length > 240) errHist.shift();
      drawTimeline(g, W, H);
      drawSpark(g, W, H);
      stats.querySelector('.s-e').textContent = `${errDeg.toFixed(1)}°`;
      stats.querySelector('.s-c').textContent = `${(Math.tan(errDeg * DEG) * 100).toFixed(1)} cm`;
      stats.querySelector('.s-f').textContent = `${(L / (1000 / hz)).toFixed(1)}`;
      budget.querySelector('.s-b').textContent = (1000 / hz).toFixed(1);
      budget.querySelector('.s-b2').textContent = (500 / hz).toFixed(1);
    });

    function drawTimeline(g, W, H) {
      const w = Math.min(W - 24, 520); const x0 = (W - w) / 2; const y0 = H - 54;
      g.fillStyle = 'rgba(10,10,10,.78)'; g.beginPath(); g.roundRect(x0 - 10, y0 - 22, w + 20, 62, 10); g.fill();
      const span = 110; const X = (ms) => x0 + (ms / span) * w;
      const fr = 1000 / hz;
      g.font = MONO(10); g.textBaseline = 'middle';
      for (let k = 0; k * fr <= span; k++) {
        g.fillStyle = k % 2 ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.09)';
        g.fillRect(X(k * fr), y0, Math.min(X((k + 1) * fr), x0 + w) - X(k * fr), 14);
      }
      g.fillStyle = C.c4; g.fillRect(X(0), y0, Math.max(2, X(L) - X(0)), 14);
      g.fillStyle = C.text; g.textAlign = 'left'; g.fillText('head moves', X(0), y0 - 10);
      g.textAlign = L > 70 ? 'right' : 'left'; g.fillStyle = C.c4; g.fillText(`photons at ${L} ms`, X(L) + (L > 70 ? -4 : 4), y0 + 26);
      g.fillStyle = C.muted; g.textAlign = 'right'; g.fillText(`frames at ${hz} Hz: ${fr.toFixed(1)} ms each`, x0 + w, y0 - 10);
    }
    function drawSpark(g, W, H) {
      const w = Math.min(180, W * 0.38); const h = 54; const x0 = 12; const y0 = 12;
      g.fillStyle = 'rgba(10,10,10,.78)'; g.beginPath(); g.roundRect(x0, y0, w, h + 20, 8); g.fill();
      g.font = MONO(10); g.fillStyle = C.muted; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('error, last 4 s', x0 + 8, y0 + 6);
      const mx = 15;
      g.strokeStyle = C.c4; g.lineWidth = 1.5; g.beginPath();
      errHist.forEach((e, i) => { const x = x0 + 6 + (i / 239) * (w - 12); const y = y0 + 18 + h - 4 - (Math.min(e, mx) / mx) * (h - 8); i ? g.lineTo(x, y) : g.moveTo(x, y); });
      g.stroke();
      g.fillStyle = C.muted; g.textAlign = 'right'; g.fillText(`${mx}°`, x0 + w - 6, y0 + 6);
    }

    ctx.quiz([
      { q: 'At 90 Hz, how long does each frame last?', choices: ['8.3 ms', '11.1 ms', '16.7 ms'], answer: 1, why: '1000 ms divided by 90 frames is about 11.1 ms. At 120 Hz it is 8.3 ms.' },
      { q: 'What does timewarp (rotational reprojection) correct?', choices: ['Head rotation that happened after the frame was rendered', 'Objects that moved in the scene', 'Low resolution'], answer: 0, why: 'It re-projects the finished frame with the newest head rotation just before scanout.' },
      { q: 'Why does pose prediction overshoot when you stop turning suddenly?', choices: ['It extrapolates the last velocity, which assumes the motion continues', 'The IMU turns off', 'The frame rate drops'], answer: 0, why: 'Prediction guesses the future from current velocity. A sudden stop breaks that guess for a moment.' },
    ]);
  },
};
