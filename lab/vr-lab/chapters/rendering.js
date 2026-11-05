// Chapter 7: the rendering pipeline. Real multi resolution rendering: the scene is rendered at full, half and
// low resolution and composited around the gaze point (the mouse), plus a frame budget and pixels per degree.
import { THREE, makeGL, makeRoom, addLights, std, mesh, boxGeo, clamp, DEG, MONO, pill, reduced } from '../lib/xr.js';

export default {
  mount(ctx) {
    const C = ctx.colors;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#0d0d0d');
    addLights(scene);
    const room = makeRoom();
    scene.add(room.group);
    // fine detail so resolution changes are easy to see: a striped board and small objects
    const board = new THREE.Group();
    for (let i = 0; i < 24; i++) board.add(mesh(boxGeo(0.03, 1.0, 0.02), std(i % 2 ? '#f5f5f0' : '#1a1a1a'), -0.69 + i * 0.06, 1.55, -3.95));
    scene.add(board);
    const balls = [];
    for (let i = 0; i < 9; i++) { const b = mesh(new THREE.SphereGeometry(0.05, 20, 14), std([C.c1, C.c2, C.c3, C.c4, C.c5, C.c6][i % 6], { roughness: 0.3 })); scene.add(b); balls.push(b); }
    const camera = new THREE.PerspectiveCamera(80, 1, 0.05, 60);
    camera.position.set(0, 1.5, 2.0); camera.lookAt(0, 1.15, -2);

    const gl = makeGL(ctx, { offscreen: true, preserve: true });
    const cv = ctx.canvas();
    const full = document.createElement('canvas'); const fg = full.getContext('2d');
    const mid = document.createElement('canvas'); const mg = mid.getContext('2d');
    const low = document.createElement('canvas'); const lg = low.getContext('2d');

    let eyeTrack = true; let inner = 12; let rate = 4; let showZones = true; let hz = 90;
    let pxPerEye = 2064; let fovH = 110;
    const gaze = { x: 0.5, y: 0.45, tx: 0.5, ty: 0.45, over: false };
    cv.el.style.touchAction = 'none';
    const setGaze = (e) => { const r = cv.el.getBoundingClientRect(); gaze.tx = (e.clientX - r.left) / r.width; gaze.ty = (e.clientY - r.top) / r.height; gaze.over = true; };
    cv.el.addEventListener('pointermove', setGaze, { signal: ctx.signal });
    cv.el.addEventListener('pointerdown', setGaze, { signal: ctx.signal });
    cv.el.addEventListener('pointerleave', () => { gaze.over = false; }, { signal: ctx.signal });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">The rendering pipeline</h2>'),
      ctx.h('<p class="lede">A headset draws two high resolution images, many times a second, with a hard deadline. One trick that saves a lot of work: only draw sharp where you are actually looking.</p>'),
    );
    ctx.panel.append(ctx.seg([['eye', 'Eye tracked foveation'], ['fixed', 'Fixed foveation'], ['off', 'Off']], 'eye', (v) => { eyeTrack = v === 'eye'; rate = v === 'off' ? 1 : (rate === 1 ? 4 : rate); rateSeg.set(rate); }));
    ctx.panel.append(ctx.slider({ label: 'Full resolution radius', min: 4, max: 30, step: 1, value: inner, unit: '°', onInput: (v) => { inner = v; } }));
    ctx.panel.append(ctx.h('<p class="hint">Periphery resolution</p>'));
    const rateSeg = ctx.seg([[2, '1/2'], [4, '1/4'], [8, '1/8'], [1, 'Full']], rate, (v) => { rate = +v; });
    ctx.panel.append(rateSeg);
    const zl = ctx.h('<label class="check"><input type="checkbox" checked> Show zones</label>');
    zl.querySelector('input').addEventListener('change', (e) => { showZones = e.target.checked; });
    ctx.panel.append(zl);
    const stats = ctx.h('<div class="stat"><div><b class="s-s">0</b><span>Pixels shaded</span></div><div><b class="s-g">0</b><span>GPU time (model)</span></div></div>');
    ctx.panel.append(stats);
    ctx.panel.append(ctx.h(`<div class="card tip"><p>Only a tiny patch in the middle of your eye, the <b>fovea</b>, sees fine detail. A few degrees away from where you look, your vision is surprisingly blurry; you just never notice because your eyes keep jumping to whatever you want to see.</p><p><b>Foveated rendering</b> uses that. With eye tracking, the headset renders full detail only where you look and much less everywhere else. Without eye tracking, <b>fixed foveation</b> keeps the centre sharp, since the lens edges are blurry anyway.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><p>Move your mouse (or finger) over the view: that is your gaze. Stare at one ball and notice how much of the image is chunky without it bothering you much. Switch periphery to 1/8 and look at the stripes on the back wall from the corner of your eye, then look straight at them.</p></div>`));
    const ppd = ctx.h('<div class="card"><h3>Pixels per degree</h3></div>');
    const ppdOut = ctx.h('<div class="stat"><div><b class="p-v">0</b><span>Pixels per degree</span></div><div><b class="p-r">0</b><span>Pixels per second</span></div></div>');
    const ppdBar = ctx.h('<div class="bar" style="height:6px"><span></span></div>');
    ppd.append(
      ctx.slider({ label: 'Horizontal pixels per eye', min: 1000, max: 4000, step: 16, value: pxPerEye, onInput: (v) => { pxPerEye = v; } }),
      ctx.slider({ label: 'Horizontal field of view', min: 60, max: 130, step: 1, value: fovH, unit: '°', onInput: (v) => { fovH = v; } }),
      ppdOut, ppdBar,
      ctx.h('<p class="small muted">Bar: share of the roughly 60 pixels per degree that matches 20/20 vision (one arcminute per pixel).</p>'),
    );
    const hzSeg = ctx.seg([[72, '72 Hz'], [90, '90 Hz'], [120, '120 Hz']], hz, (v) => { hz = +v; });
    ppd.append(hzSeg);
    ctx.panel.append(ppd);
    ctx.panel.append(ctx.h(`<div class="card deep">
      <p class="small"><b>Per eye rendering.</b> Each frame the app renders a left and right view, usually in one pass with multiview (both eyes drawn by one set of draw calls into a texture array) rather than two full passes. The compositor then applies lens distortion, colour correction and timewarp, and the panel scans out.</p>
      <p class="small"><b>Pixels per degree</b> is roughly pixels across divided by degrees across (higher in the lens centre, lower at the edges). A panel 2064 pixels wide over about 110° gives under 20 on average, and Meta quotes about 25 at the centre of Quest 3's lenses. 20/20 vision resolves about 60. That gap is why text in VR still looks soft.</p>
      <p class="small"><b>Foveation in practice</b> uses variable rate shading or fragment density maps so the GPU shades blocks of pixels at once in the periphery, then blends the zones so the borders are invisible. Eye tracked foveation has to update within a few milliseconds of a saccade, or you catch the blur. The GPU time here is a simple model proportional to pixels shaded, for illustration.</p>
    </div>`));

    const v = new THREE.Vector3();
    ctx.loop((time, dt) => {
      const W = cv.w; const H = cv.h; const g = cv.ctx;
      if (!W) return;
      // gaze: follow the pointer with eye tracking, otherwise centre
      const gx = eyeTrack ? (gaze.over ? gaze.tx : 0.5 + Math.sin(time * 0.6) * (reduced ? 0 : 0.18)) : 0.5;
      const gy = eyeTrack ? (gaze.over ? gaze.ty : 0.47 + Math.sin(time * 0.9) * (reduced ? 0 : 0.08)) : 0.5;
      const k = Math.min(1, dt * 25); gaze.x += (gx - gaze.x) * k; gaze.y += (gy - gaze.y) * k;
      balls.forEach((b, i) => { const a = time * 0.3 + i * 0.7; b.position.set(Math.sin(a) * 1.4, 1.1 + Math.sin(a * 1.7) * 0.35, -1.0 + Math.cos(a) * 0.9); });
      camera.aspect = W / H; camera.fov = W / H < 0.9 ? 86 : 70; camera.updateProjectionMatrix();
      const r = gl.renderer; const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(W); const h = Math.round(H);
      if (gl.w !== w || gl.h !== h) { gl.w = w; gl.h = h; r.setPixelRatio(dpr); r.setSize(w, h, false); }
      const dw = r.domElement.width; const dh = r.domElement.height;
      for (const [c, s] of [[full, 1], [mid, 2], [low, rate]]) { const tw = Math.max(1, Math.round(dw / s)); const th = Math.max(1, Math.round(dh / s)); if (c.width !== tw || c.height !== th) { c.width = tw; c.height = th; } }
      // full res
      r.setScissorTest(false); r.setViewport(0, 0, w, h); r.render(scene, camera);
      fg.drawImage(r.domElement, 0, 0);
      // half res into the bottom left corner of the drawing buffer, then copied out
      const pass = (s, cg, c) => {
        const vw = w / s; const vh = h / s;
        r.setScissorTest(true); r.setScissor(0, 0, vw, vh); r.setViewport(0, 0, vw, vh); r.render(scene, camera);
        cg.drawImage(r.domElement, 0, dh - c.height, c.width, c.height, 0, 0, c.width, c.height);
        r.setScissorTest(false); r.setViewport(0, 0, w, h);
      };
      if (rate !== 1) pass(2, mg, mid);
      if (rate > 2) pass(rate, lg, low);
      // composite around the gaze point
      const fpx = (H / 2) / Math.tan((camera.fov * DEG) / 2);
      const r1 = fpx * Math.tan(inner * DEG); const r2 = fpx * Math.tan(Math.min(80, inner * 2.2) * DEG);
      const cx = gaze.x * W; const cy = gaze.y * H;
      g.imageSmoothingEnabled = false;
      if (rate === 1) g.drawImage(full, 0, 0, W, H);
      else {
        g.drawImage(rate > 2 ? low : mid, 0, 0, W, H);
        if (rate > 2) { g.save(); g.beginPath(); g.arc(cx, cy, r2, 0, Math.PI * 2); g.clip(); g.drawImage(mid, 0, 0, W, H); g.restore(); }
        g.save(); g.beginPath(); g.arc(cx, cy, r1, 0, Math.PI * 2); g.clip(); g.drawImage(full, 0, 0, W, H); g.restore();
      }
      g.imageSmoothingEnabled = true;
      if (showZones && rate !== 1) {
        g.strokeStyle = C.c1; g.lineWidth = 1.2; g.setLineDash([]); g.beginPath(); g.arc(cx, cy, r1, 0, Math.PI * 2); g.stroke();
        if (rate > 2) { g.strokeStyle = 'rgba(251,191,36,.8)'; g.setLineDash([5, 5]); g.beginPath(); g.arc(cx, cy, r2, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
        pill(g, 'full', cx, cy - r1 + 12, { color: C.c1, px: 10 });
        if (rate > 2) pill(g, '1/2', cx, cy - r2 + 12, { color: C.c2, px: 10 });
        pill(g, `1/${rate}`, 34, 18, { px: 10 });
      }
      g.fillStyle = C.text; g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();
      // shaded share: sample the screen
      let shaded = 0; let n = 0;
      for (let y = 4; y < H; y += 12) for (let x = 4; x < W; x += 12) {
        n++; const d = Math.hypot(x - cx, y - cy);
        shaded += rate === 1 ? 1 : d < r1 ? 1 : (rate > 2 && d < r2) ? 0.25 : 1 / (rate * rate);
      }
      const frac = shaded / n;
      drawBudget(g, W, H, frac);
      stats.querySelector('.s-s').textContent = `${Math.round(frac * 100)}%`;
      stats.querySelector('.s-g').textContent = `${gpuMs(frac).toFixed(1)} ms`;
      const p = pxPerEye / fovH;
      ppdOut.querySelector('.p-v').textContent = p.toFixed(1);
      const pps = 2 * pxPerEye * Math.round(pxPerEye * 1.07) * hz;
      ppdOut.querySelector('.p-r').textContent = `${(pps / 1e6).toFixed(0)} M`;
      ppdBar.firstChild.style.width = `${clamp(p / 60, 0, 1) * 100}%`;
    });

    // illustrative cost model: each eye at full resolution costs 5.5 ms of GPU time at 2064 px wide, scaling with pixels
    const gpuMs = (frac) => 2 * 5.5 * frac * (pxPerEye / 2064) ** 2;
    function drawBudget(g, W, H, frac) {
      const budget = 1000 / hz; const w = Math.min(W - 24, 460); const x0 = (W - w) / 2; const y0 = H - 50;
      const span = Math.max(budget * 1.25, 2 + gpuMs(frac) + 1.5);
      const X = (ms) => x0 + (ms / span) * w;
      g.fillStyle = 'rgba(10,10,10,.8)'; g.beginPath(); g.roundRect(x0 - 10, y0 - 22, w + 20, 60, 10); g.fill();
      const eye = gpuMs(frac) / 2;
      const segs = [['CPU', 2.0, C.c3], ['left eye', eye, C.c4], ['right eye', eye, C.c1], ['warp', 1.0, C.c5]];
      let t = 0; g.font = MONO(10); g.textBaseline = 'middle';
      for (const [lab, ms, col] of segs) {
        g.fillStyle = col; g.globalAlpha = 0.85; g.fillRect(X(t), y0, Math.max(1, X(t + ms) - X(t) - 1), 14); g.globalAlpha = 1;
        if (X(t + ms) - X(t) > 50) { g.fillStyle = '#0a0a0a'; g.textAlign = 'left'; g.fillText(lab, X(t) + 4, y0 + 7); }
        t += ms;
      }
      const over = t > budget;
      g.strokeStyle = over ? C.c4 : C.ok; g.lineWidth = 2; g.beginPath(); g.moveTo(X(budget), y0 - 6); g.lineTo(X(budget), y0 + 20); g.stroke();
      g.fillStyle = C.muted; g.textAlign = 'left'; g.fillText(`frame (model): ${t.toFixed(1)} ms`, x0, y0 - 11);
      g.textAlign = 'right'; g.fillStyle = over ? C.c4 : C.ok;
      g.fillText(`${hz} Hz budget ${budget.toFixed(1)} ms${over ? ': missed' : ''}`, x0 + w, y0 - 11);
      g.fillStyle = C.muted; g.textAlign = 'left'; g.fillText('CPU · left eye · right eye · compositor', x0, y0 + 28);
    }

    ctx.quiz([
      { q: 'What does eye tracked foveated rendering do?', choices: ['Renders full detail only where you are looking', 'Renders only one eye', 'Blurs the whole image to save power'], answer: 0, why: 'Your fovea only covers a few degrees, so the periphery can be rendered at much lower resolution.' },
      { q: 'A panel has 2000 pixels across a 100° field of view. About how many pixels per degree is that?', choices: ['2', '20', '200'], answer: 1, why: '2000 / 100 = 20 pixels per degree, about a third of what 20/20 vision can resolve.' },
      { q: 'At 120 Hz, how much time is there for one complete frame?', choices: ['8.3 ms', '11.1 ms', '13.9 ms'], answer: 0, why: '1000 / 120 is about 8.3 ms, and both eyes plus the compositor have to fit in it.' },
    ]);
  },
};
