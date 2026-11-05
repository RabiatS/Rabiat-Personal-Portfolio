// Chapter 4: field of view. A wide reference view of a room, masked to a headset's field of view,
// plus a map of the human visual field in degrees.
import { THREE, makeGL, makeRoom, addLights, overlay, drag, std, mesh, boxGeo, clamp, DEG, MONO, DISPLAY, pill, reduced, setHFov } from '../lib/xr.js';

const PRESETS = [
  { key: 'ar', label: 'AR glasses', h: 43, v: 29, note: 'Optical see-through AR such as HoloLens 2 is around 43° by 29°. Content gets cut off at the edges of a small window.' },
  { key: 'vr', label: 'Typical VR', h: 110, v: 96, note: 'Current consumer VR headsets are roughly 100° to 110° wide. Meta lists Quest 3 at 110° by 96°.' },
  { key: 'wide', label: 'Wide FOV', h: 130, v: 100, note: 'Some enthusiast headsets reach 130° or more horizontally, using bigger or angled lenses.' },
  { key: 'human', label: 'Your eyes', h: 200, v: 130, note: 'Both eyes together cover about 200° horizontally and about 130° vertically. A flat image cannot show more than 180°, so the reference view here stops short.' },
];
const BASE = 128; // horizontal fov of the reference camera, degrees

export default {
  mount(ctx) {
    const C = ctx.colors;
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#0d0d0d');
    addLights(scene);
    const room = makeRoom({ size: 10 });
    scene.add(room.group);
    // markers around the viewer at known angles so the edge of view is easy to judge
    const angles = [-60, -45, -30, -15, 0, 15, 30, 45, 60];
    const cols = [C.c3, C.c5, C.c1, C.c6, C.c2, C.c6, C.c1, C.c5, C.c3];
    const EYE = new THREE.Vector3(0, 1.5, 2.6);
    const marks = angles.map((a, i) => {
      const m = mesh(boxGeo(0.12, 0.9, 0.12), std(cols[i], { emissive: cols[i], emissiveIntensity: 0.25 }));
      const r = 2.2; m.position.set(EYE.x + Math.sin(a * DEG) * r, 0.45, EYE.z - Math.cos(a * DEG) * r);
      scene.add(m); return { a, m };
    });
    const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 60);
    camera.position.copy(EYE);
    const gl = makeGL(ctx, { onSize: (w, h) => setHFov(camera, BASE, w / h) });
    const ov = overlay(ctx);

    let preset = PRESETS[1]; let hf = preset.h; let vf = preset.v; let seeOutside = true;
    const head = { yaw: 0, pitch: 0 }; let dragging = false; let idle = 3;
    drag(gl.el, ctx.signal, (dx, dy) => { head.yaw = clamp(head.yaw - dx * 0.004, -1.2, 1.2); head.pitch = clamp(head.pitch - dy * 0.003, -0.6, 0.6); idle = 0; }, () => { dragging = true; }, () => { dragging = false; });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Field of view</h2>'),
      ctx.h('<p class="lede">Your eyes take in almost a half circle of the world. Most headsets show you a window about half that wide. Here is the difference.</p>'),
    );
    const segEl = ctx.seg(PRESETS.map((p) => [p.key, p.label]), preset.key, (k) => { preset = PRESETS.find((p) => p.key === k); hf = preset.h; vf = preset.v; sl.value = Math.min(hf, BASE); note.textContent = preset.note; });
    ctx.panel.append(segEl);
    const sl = ctx.slider({ label: 'Headset horizontal FOV', min: 20, max: BASE, step: 1, value: hf, unit: '°', onInput: (v) => { const r = vf / hf; hf = v; vf = Math.min(130, v * r); } });
    ctx.panel.append(sl);
    const note = ctx.h(`<p class="hint">${preset.note}</p>`);
    ctx.panel.append(note);
    const out = ctx.h('<label class="check"><input type="checkbox" checked> Show what lies outside, dimmed</label>');
    out.querySelector('input').addEventListener('change', (e) => { seeOutside = e.target.checked; });
    ctx.panel.append(out);
    // visual field map
    const mapBox = ctx.h('<div style="position:relative;height:190px;border:1px solid var(--border);border-radius:10px;background:rgba(10,10,10,.45)"></div>');
    ctx.panel.append(mapBox);
    const map = ctx.canvas({ parent: mapBox });
    const stats = ctx.h('<div class="stat"><div><b class="s-f">0</b><span>Headset FOV</span></div><div><b class="s-p">0</b><span>Of your field</span></div></div>');
    ctx.panel.append(stats);
    ctx.panel.append(ctx.h(`<div class="card tip"><p>Field of view (FOV) is how wide an angle you can see at once, measured in degrees. Look straight ahead and wiggle your fingers out to the side: you can see them almost level with your ears. A headset's lenses only cover the middle part of that, so wearing one feels a bit like looking through ski goggles or binoculars.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><p>Pick <b>AR glasses</b> and drag the view around: the coloured posts pop in and out at the edges of a small window. Then try <b>Typical VR</b>, and slide the FOV up and down while keeping your eyes on the centre. Notice how much of the room your side vision was using.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card deep">
      <p class="small">Each eye alone sees roughly 60° toward the nose and about 100° toward the ear. The overlap seen by both eyes, where stereo depth works, is about 120°. The rest is monocular periphery: low in detail but very sensitive to motion, which is why a wide FOV adds presence and also adds motion sickness risk (chapter 9).</p>
      <p class="small">FOV trades directly against sharpness. Angular resolution in pixels per degree is roughly panel pixels divided by FOV, so widening the lens spreads the same pixels thinner (chapter 7). Headsets also choose how much the two eyes' views overlap; angling the screens outward buys horizontal FOV at the cost of stereo overlap.</p>
      <p class="small">The demo uses one rectilinear camera at ${BASE}° and masks it, so objects keep their size when the window changes. That is what really happens: a narrower headset does not zoom in, it crops.</p>
    </div>`));

    function fieldFrac() {
      // share of the human binocular field (approximated per eye with ellipses) that the headset rectangle covers
      let inside = 0; let total = 0;
      for (let x = -105; x <= 105; x += 3) for (let y = -72; y <= 52; y += 3) {
        if (!humanField(x, y)) continue;
        total++; if (Math.abs(x) <= hf / 2 && Math.abs(y) <= vf / 2) inside++;
      }
      return inside / total;
    }
    function eyeField(x, y, side) {
      // side -1 = left eye: temporal limit to the left. Asymmetric ellipse quadrants: 100 temporal, 60 nasal, 50 up, 70 down
      const t = 100; const n = 60; const u = 50; const dn = 70;
      const ex = side < 0 ? (x < 0 ? t : n) : (x > 0 ? t : n);
      const ey = y > 0 ? u : dn;
      return (x / ex) ** 2 + (y / ey) ** 2 <= 1;
    }
    const humanField = (x, y) => eyeField(x, y, -1) || eyeField(x, y, 1);

    ctx.loop((time, dt) => {
      idle += dt;
      if (!dragging && !reduced && idle > 3) head.yaw = Math.sin(time * 0.25) * 0.55;
      camera.rotation.set(head.pitch, head.yaw, 0, 'YXZ');
      gl.renderer.render(scene, camera);
      drawMask();
      drawMap();
      stats.querySelector('.s-f').textContent = `${Math.round(hf)}° × ${Math.round(vf)}°`;
      stats.querySelector('.s-p').textContent = `${Math.round(fieldFrac() * 100)}%`;
    });

    function drawMask() {
      const g = ov.ctx; const W = ov.w; const H = ov.h;
      g.clearRect(0, 0, W, H);
      const fx = (W / 2) / Math.tan((BASE / 2) * DEG);
      const vBase = 2 * Math.atan(Math.tan((BASE / 2) * DEG) * (H / W)) / DEG;
      const hw = hf >= 179 ? W : fx * Math.tan(Math.min(89, hf / 2) * DEG);
      const hh = vf >= 179 ? H : fx * Math.tan(Math.min(89, vf / 2) * DEG);
      const cx = W / 2; const cy = H / 2;
      if (preset.key !== 'human' || hf < BASE) {
        g.save();
        g.fillStyle = seeOutside ? 'rgba(5,5,5,.78)' : '#050505';
        g.beginPath(); g.rect(0, 0, W, H);
        // two overlapping lens shaped windows (one per eye), like the outline seen inside a headset
        const r = Math.min(hw, hh) * 0.45;
        g.roundRect(cx - hw, cy - hh, hw * 2, hh * 2, r);
        g.fill('evenodd');
        g.strokeStyle = C.c2; g.lineWidth = 1.5; g.beginPath(); g.roundRect(cx - hw, cy - hh, hw * 2, hh * 2, r); g.stroke();
        g.restore();
        pill(g, `headset ${Math.round(hf)}° × ${Math.round(vf)}°`, cx, Math.max(14, cy - hh - 12), { color: C.c2 });
      }
      // angle ticks along the top edge of the reference view
      g.font = MONO(10); g.textAlign = 'center'; g.textBaseline = 'top';
      for (let a = -60; a <= 60; a += 15) {
        const x = cx + fx * Math.tan(a * DEG);
        g.fillStyle = 'rgba(245,245,240,.5)'; g.fillRect(x, H - 16, 1, 6);
        g.fillStyle = C.muted; g.fillText(`${a}°`, x, H - 30);
      }
      g.textAlign = 'left'; g.fillStyle = C.muted; g.fillText(`reference view ${BASE}° × ${Math.round(vBase)}°`, 10, 10);
    }

    function drawMap() {
      const g = map.ctx; const W = map.w; const H = map.h;
      if (!W) return;
      g.clearRect(0, 0, W, H);
      const sx = (W - 20) / 220; const sy = (H - 34) / 130; const s = Math.min(sx, sy);
      const cx = W / 2; const cy = 14 + 55 * s;
      const P = (x, y) => [cx + x * s, cy - y * s];
      // grid
      g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1;
      for (let a = -90; a <= 90; a += 30) { const [x] = P(a, 0); g.beginPath(); g.moveTo(x, cy - 55 * s); g.lineTo(x, cy + 75 * s); g.stroke(); }
      for (let b = -60; b <= 60; b += 30) { const [, y] = P(0, b); g.beginPath(); g.moveTo(cx - 108 * s, y); g.lineTo(cx + 108 * s, y); g.stroke(); }
      // eyes
      const fillEye = (side, col) => {
        g.fillStyle = col; g.beginPath();
        for (let k = 0; k <= 72; k++) {
          const th = (k / 72) * Math.PI * 2; const c = Math.cos(th); const si = Math.sin(th);
          const ex = side < 0 ? (c < 0 ? 100 : 60) : (c > 0 ? 100 : 60); const ey = si > 0 ? 50 : 70;
          const [x, y] = P(c * ex, si * ey); k ? g.lineTo(x, y) : g.moveTo(x, y);
        }
        g.fill();
      };
      fillEye(-1, 'rgba(251,113,133,.20)'); fillEye(1, 'rgba(94,234,212,.20)');
      // headset
      const [x0, y0] = P(-Math.min(hf, 210) / 2, Math.min(vf, 130) / 2);
      g.strokeStyle = C.c2; g.lineWidth = 1.6; g.strokeRect(x0, y0, Math.min(hf, 210) * s, Math.min(vf, 130) * s);
      g.font = MONO(9.5); g.fillStyle = C.muted; g.textBaseline = 'top'; g.textAlign = 'center';
      for (const a of [-90, -60, -30, 0, 30, 60, 90]) { const [x] = P(a, 0); g.fillText(`${a}°`, x, H - 14); }
      g.textAlign = 'left'; g.fillStyle = C.c4; g.fillText('left eye', 6, 4); g.fillStyle = C.c1; g.textAlign = 'right'; g.fillText('right eye', W - 6, 4);
      g.fillStyle = C.c2; g.textAlign = 'center'; g.fillText('headset', W / 2, 4);
    }

    ctx.quiz([
      { q: 'Roughly how wide is the combined horizontal field of view of both human eyes?', choices: ['About 60°', 'About 110°', 'About 200°'], answer: 2, why: 'Together the eyes cover around 200°, with about 120° seen by both eyes at once.' },
      { q: 'You keep the same display panel but fit a lens with a wider FOV. What happens to sharpness?', choices: ['It gets sharper', 'It gets softer, fewer pixels per degree', 'No change'], answer: 1, why: 'The same pixels are spread over more degrees, so pixels per degree drops.' },
      { q: 'Why does a wider FOV tend to increase motion sickness risk?', choices: ['Peripheral vision is very sensitive to motion', 'Wide lenses are heavier', 'It lowers the frame rate'], answer: 0, why: 'Motion in the periphery drives the feeling of self motion (vection), which conflicts with your inner ear.' },
    ]);
  },
};
