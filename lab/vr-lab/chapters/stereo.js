// Chapter 2: two eyes, depth. Real stereo rendering with two cameras separated by the IPD.
import { THREE, makeGL, makeRoom, addLights, drag, std, mesh, boxGeo, clamp, DEG, MONO, DISPLAY, pill } from '../lib/xr.js';

export default {
  mount(ctx) {
    const C = ctx.colors;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d0d0d');
    // (the anaglyph pass swaps this for a manual clear)
    addLights(scene);
    const room = makeRoom();
    scene.add(room.group);
    const EYE = new THREE.Vector3(0, 1.45, 3.0);
    // Three depth markers straight ahead of the viewer
    const targets = [
      { key: 'near', name: 'Near ball', d: 0.6, color: C.c4, obj: mesh(new THREE.SphereGeometry(0.05, 32, 20), std(C.c4, { roughness: 0.35 })) },
      { key: 'mid', name: 'Mid cube', d: 1.5, color: C.c2, obj: mesh(boxGeo(0.22, 0.22, 0.22), std(C.c2, { roughness: 0.45 })) },
      { key: 'far', name: 'Far ring', d: 4.0, color: C.c1, obj: mesh(new THREE.TorusGeometry(0.22, 0.05, 16, 48), std(C.c1, { roughness: 0.4 })) },
    ];
    const offs = { near: [-0.16, -0.17], mid: [0.32, -0.12], far: [-0.55, 0.0] };
    for (const tg of targets) {
      const [ox, oy] = offs[tg.key];
      tg.obj.position.set(EYE.x + ox, EYE.y + oy, EYE.z - Math.sqrt(Math.max(0.01, tg.d * tg.d - ox * ox - oy * oy)));
      tg.dist = tg.obj.position.distanceTo(EYE);
      scene.add(tg.obj);
    }

    const gl = makeGL(ctx, { offscreen: true, preserve: true });
    const cv = ctx.canvas();
    const camL = new THREE.PerspectiveCamera(60, 1, 0.03, 60);
    const camR = new THREE.PerspectiveCamera(60, 1, 0.03, 60);

    let mode = ctx.store.get('stereo:mode', 'sbs');
    let ipd = 63; let fix = 'mid'; let swap = false; let colour = false;
    const head = { yaw: 0, pitch: 0 };
    drag(cv.el, ctx.signal, (dx, dy) => { head.yaw = clamp(head.yaw - dx * 0.003, -0.7, 0.7); head.pitch = clamp(head.pitch - dy * 0.003, -0.5, 0.5); });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Two eyes, depth</h2>'),
      ctx.h('<p class="lede">Your eyes sit about 6 cm apart, so each one sees the world from a slightly different spot. Your brain turns that tiny difference into depth. A headset fakes it by drawing the scene twice.</p>'),
    );
    const modeSeg = ctx.seg([['sbs', 'Side by side'], ['overlay', 'Both eyes overlaid'], ['ana', 'Anaglyph'], ['wiggle', 'Wiggle']], mode, (v) => { mode = v; ctx.store.set('stereo:mode', v); updateNotes(); });
    ctx.panel.append(modeSeg);
    const note = ctx.h('<p class="hint"></p>');
    ctx.panel.append(note);
    ctx.panel.append(ctx.slider({ label: 'IPD (eye separation)', min: 0, max: 200, step: 1, value: ipd, unit: ' mm', onInput: (v) => { ipd = v; } }));
    ctx.panel.append(ctx.h('<p class="hint">Look at (your eyes converge here)</p>'));
    ctx.panel.append(ctx.seg(targets.map((t) => [t.key, `${t.name} ${t.d} m`]), fix, (v) => { fix = v; }));
    const extra = ctx.h('<div class="row"></div>');
    const sw = ctx.h('<label class="check"><input type="checkbox"> Swap eyes (cross-eyed viewing)</label>');
    sw.querySelector('input').addEventListener('change', (e) => { swap = e.target.checked; });
    const col = ctx.h('<label class="check"><input type="checkbox"> Full colour anaglyph</label>');
    col.querySelector('input').addEventListener('change', (e) => { colour = e.target.checked; });
    extra.append(sw, col);
    ctx.panel.append(extra);
    const stats = ctx.h('<div class="stat"><div><b class="s-v">0</b><span>Vergence</span></div><div><b class="s-n">0</b><span>Near disparity</span></div><div><b class="s-f">0</b><span>Far disparity</span></div></div>');
    ctx.panel.append(stats);
    function updateNotes() {
      note.textContent = {
        sbs: 'What each eye gets in a headset: the left half goes to the left eye, the right half to the right eye. Relax your eyes as if looking far away to fuse them, or tick swap and cross your eyes.',
        overlay: 'Both eye images at half strength. Whatever you are looking at lines up. Everything nearer or farther splits into a double image: that offset is the disparity.',
        ana: 'Wear red and cyan glasses with red over the left eye. The object you choose to look at sits on the screen surface, nearer things float out, farther things sink in.',
        wiggle: 'Flicks between the two eye views. No glasses needed: depth shows up as how much each object jumps. Near things jump most.',
      }[mode];
      sw.style.display = mode === 'sbs' ? '' : 'none';
      col.style.display = mode === 'ana' ? '' : 'none';
    }
    updateNotes();

    ctx.panel.append(ctx.h(`<div class="card tip"><p>Hold a finger in front of your nose and close one eye, then the other. The finger jumps against the background. That jump is <b>binocular disparity</b>. The closer the finger, the bigger the jump. Your brain reads the size of the jump as distance.</p><p>A headset has one screen (or one half of a screen) per eye. It renders the scene from two virtual cameras placed one IPD apart, and the lenses make sure each eye only sees its own image.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><p>Choose <b>Both eyes overlaid</b>, then pick each target in turn: the one you look at becomes sharp and single, the others split. Now drag IPD to 0 mm: every double image collapses and depth is gone. Push it to 200 mm and the room feels like a toy model, because your brain assumes normal eye spacing.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card deep">
      <p class="small"><b>Vergence</b> is the angle between your two lines of sight. Looking at something at distance D with eye separation I:</p>
      <div class="formula">vergence = 2 · atan(I / 2D)<span>63 mm at 0.6 m is about 6°. At 4 m it is under 1°.</span></div>
      <p class="small"><b>Relative disparity</b> between a fixated point at D and another at d is about I · (1/d − 1/D) radians. Because it falls off with 1/d², stereo is a strong depth cue up close and a weak one past roughly 10 to 20 m, where perspective, motion parallax and size take over.</p>
      <p class="small">Real headsets render each eye with <b>parallel</b> cameras and an <b>off axis</b> (asymmetric) frustum that matches where that eye sits behind its lens. Toed in cameras that rotate to converge cause vertical disparities at the edges and eye strain. The anaglyph view here uses the same off axis trick to put your chosen target at zero parallax.</p>
      <p class="small">Adult IPD averages about 63 mm, with most people between roughly 50 and 75 mm. A wrong IPD setting changes perceived scale and can cause strain, which is why headsets have IPD adjustment and some measure it with eye tracking.</p>
    </div>`));

    const v = new THREE.Vector3(); const right = new THREE.Vector3();
    function poseEye(cam, side, aspect, w, h, converge) {
      cam.aspect = aspect; cam.fov = aspect < 0.8 ? 72 : 60;
      cam.position.copy(EYE);
      cam.rotation.set(head.pitch, head.yaw, 0, 'YXZ');
      cam.updateMatrixWorld();
      right.set(1, 0, 0).applyQuaternion(cam.quaternion);
      cam.position.addScaledVector(right, (side * ipd) / 2000);
      if (converge) {
        const D = targets.find((t) => t.key === fix).dist;
        const fpx = (h / 2) / Math.tan((cam.fov * DEG) / 2);
        const s = ((ipd / 2000) * fpx) / D;
        cam.setViewOffset(w, h, -side * s, 0, w, h);
      } else cam.clearViewOffset();
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
    }
    function renderEye(cam, w, h) {
      const r = gl.renderer;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (gl.w !== w || gl.h !== h || gl.dpr !== dpr) { gl.w = w; gl.h = h; gl.dpr = dpr; r.setPixelRatio(dpr); r.setSize(w, h, false); }
      if (cam) r.render(scene, cam);
      return r.domElement;
    }

    // Shared grey switch for every material, so the anaglyph can be monochrome (less retinal rivalry)
    const gray = { value: 0 };
    scene.traverse((o) => {
      if (!o.material) return;
      o.material.onBeforeCompile = (sh) => {
        sh.uniforms.uGray = gray;
        sh.fragmentShader = 'uniform float uGray;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(lum), uGray);');
      };
      o.material.needsUpdate = true;
    });
    const bg = new THREE.Color('#0d0d0d');
    function renderAnaglyph(w, h) {
      const r = gl.renderer; const raw = r.getContext();
      renderEye(null, w, h);
      r.autoClear = false;
      r.setClearColor(bg, 1); r.clear(true, true, true);
      scene.background = null;
      raw.colorMask(true, false, false, true); r.render(scene, camL);
      r.clearDepth();
      raw.colorMask(false, true, true, true); r.render(scene, camR);
      raw.colorMask(true, true, true, true);
      scene.background = bg; r.autoClear = true;
      return r.domElement;
    }

    let wig = 0;
    ctx.loop((time, dt) => {
      const W = cv.w; const H = cv.h; const g = cv.ctx;
      if (!W) return;
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none';
      g.fillStyle = '#0a0a0a'; g.fillRect(0, 0, W, H);
      if (mode === 'sbs') {
        const gap = 8; const hw = (W - gap) / 2; const hh = Math.min(H, hw * 1.05); const y0 = (H - hh) / 2;
        const sides = swap ? [1, -1] : [-1, 1];
        sides.forEach((side, i) => {
          const cam = side < 0 ? camL : camR;
          poseEye(cam, side, hw / hh, hw, hh, false);
          const img = renderEye(cam, Math.round(hw), Math.round(hh));
          const x = i * (hw + gap);
          g.drawImage(img, x, y0, hw, hh);
          pill(g, side < 0 ? 'LEFT EYE' : 'RIGHT EYE', x + hw / 2, y0 + 16, { color: side < 0 ? C.c4 : C.c1 });
          // fusion dots
          g.fillStyle = 'rgba(245,245,240,.8)'; g.beginPath(); g.arc(x + hw / 2, y0 + hh - 14, 3, 0, Math.PI * 2); g.fill();
        });
      } else {
        const converge = true;
        poseEye(camL, -1, W / H, W, H, converge);
        poseEye(camR, 1, W / H, W, H, converge);
        if (mode === 'wiggle') {
          wig += dt; const side = Math.floor(wig / 0.14) % 2 ? 1 : -1;
          g.drawImage(renderEye(side < 0 ? camL : camR, Math.round(W), Math.round(H)), 0, 0, W, H);
          pill(g, side < 0 ? 'LEFT' : 'RIGHT', W - 40, 18, { color: side < 0 ? C.c4 : C.c1 });
        } else if (mode === 'overlay') {
          g.drawImage(renderEye(camL, Math.round(W), Math.round(H)), 0, 0, W, H);
          g.globalAlpha = 0.5;
          g.drawImage(renderEye(camR, Math.round(W), Math.round(H)), 0, 0, W, H);
          g.globalAlpha = 1;
        } else {
          // anaglyph in one GL pass: red channel from the left eye, green and blue from the right eye
          gray.value = colour ? 0 : 1;
          g.drawImage(renderAnaglyph(Math.round(W), Math.round(H)), 0, 0, W, H);
          gray.value = 0;
        }
      }
      drawInset(g, W, H);
      updateStats();
    });

    function updateStats() {
      const I = ipd / 1000; const D = targets.find((t) => t.key === fix).dist;
      const verg = (2 * Math.atan(I / (2 * D))) / DEG;
      const disp = (d) => (I * (1 / d - 1 / D)) / DEG * 60;
      stats.querySelector('.s-v').textContent = `${verg.toFixed(2)}°`;
      stats.querySelector('.s-n').textContent = `${disp(targets[0].dist).toFixed(0)}′`;
      stats.querySelector('.s-f').textContent = `${disp(targets[2].dist).toFixed(0)}′`;
    }

    // Top down diagram: two eyes, lines of sight converging on the chosen target
    function drawInset(g, W, H) {
      const iw = Math.min(210, W * 0.5); let ih = 150;
      if (mode === 'sbs' && W < 600) { const hw = (W - 8) / 2; const free = (H - Math.min(H, hw * 1.05)) / 2; ih = clamp(free - 12, 96, 150); }
      const x0 = 10; const y0 = H - ih - 10;
      g.fillStyle = 'rgba(10,10,10,.78)'; g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1;
      g.beginPath(); g.roundRect(x0, y0, iw, ih, 10); g.fill(); g.stroke();
      g.font = MONO(10); g.fillStyle = C.muted; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText('TOP VIEW', x0 + 10, y0 + 8);
      const ex = x0 + iw / 2; const ey = y0 + ih - 22;
      const sep = clamp(ipd / 63, 0, 3.2) * 9;
      const depth = (d) => ey - (Math.sqrt(d) / Math.sqrt(4.2)) * (ih - 46);
      const D = targets.find((t) => t.key === fix);
      const fy = depth(D.dist);
      // sight lines
      g.strokeStyle = 'rgba(245,245,240,.55)';
      g.beginPath(); g.moveTo(ex - sep, ey); g.lineTo(ex, fy); g.lineTo(ex + sep, ey); g.stroke();
      for (const t of targets) {
        const ty = depth(t.dist);
        g.fillStyle = t.color; g.beginPath(); g.arc(ex + (t.key === 'mid' ? 14 : t.key === 'near' ? -6 : -22), ty, t.key === fix ? 5 : 3.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = C.muted; g.textAlign = 'right'; g.textBaseline = 'middle';
        g.fillText(`${t.d} m`, x0 + iw - 8, ty);
      }
      g.fillStyle = C.c4; g.beginPath(); g.arc(ex - sep, ey, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.c1; g.beginPath(); g.arc(ex + sep, ey, 4, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.text; g.textAlign = 'center'; g.textBaseline = 'top'; g.font = MONO(10);
      g.fillText(`IPD ${ipd} mm`, ex, ey + 7);
    }

    ctx.quiz([
      { q: 'Why does a VR headset render the scene twice every frame?', choices: ['To double the frame rate', 'Each eye needs its own view from a slightly different position', 'One image is a backup if the first is late'], answer: 1, why: 'Two cameras one IPD apart produce the disparity your brain turns into depth.' },
      { q: 'You set the virtual IPD much wider than your real eyes. How does the world look?', choices: ['Bigger, like a giant landscape', 'Smaller, like a miniature model', 'Exactly the same'], answer: 1, why: 'Extra disparity reads as things being closer and smaller, the so called hyperstereo or miniature effect.' },
      { q: 'Which pair is easier to tell apart in depth using stereo alone?', choices: ['Two cups at 0.5 m and 0.6 m', 'Two trees at 50 m and 50.1 m', 'Both are equally easy'], answer: 0, why: 'Relative disparity goes as I · (1/d1 − 1/d2). Up close that is a big angle, far away it shrinks to almost nothing.' },
    ]);
  },
};
