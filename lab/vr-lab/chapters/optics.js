// Chapter 3: lenses and the headset. A real thin lens ray trace, a radial distortion model with an exact
// inverse pre-warp, and lateral chromatic aberration with per channel correction.
import { MONO, DISPLAY, clamp, pill } from '../lib/xr.js';

export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas();
    let mode = 'rays';
    let f = 40; let d = 38.9; const er = 14; const half = 26; // mm: focal length, display distance, eye relief, display half height
    let k1 = 0.22; let prewarp = true; let disp = 1.2; let caFix = true;

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Lenses and the headset</h2>'),
      ctx.h('<p class="lede">The screens in a headset sit a few centimetres from your eyes, far too close to focus on. A lens in front of each eye makes them look big and far away.</p>'),
    );
    const segEl = ctx.seg([['rays', 'Ray diagram'], ['distort', 'Distortion'], ['chroma', 'Colour fringes']], mode, (v) => { mode = v; show(); });
    ctx.panel.append(segEl);

    const raysBox = ctx.h('<div style="display:grid;gap:12px"></div>');
    raysBox.append(
      ctx.slider({ label: 'Lens focal length', min: 25, max: 60, step: 0.5, value: f, unit: ' mm', onInput: (v) => { f = v; } }),
      ctx.slider({ label: 'Screen to lens distance', min: 15, max: 62, step: 0.1, value: d, unit: ' mm', onInput: (v) => { d = v; } }),
    );
    const stats = ctx.h('<div class="stat"><div><b class="s-v">0</b><span>Image distance</span></div><div><b class="s-m">0</b><span>Magnification</span></div><div><b class="s-a">0</b><span>Focus demand</span></div></div>');
    raysBox.append(stats);
    raysBox.append(ctx.h(`<div class="card tip"><p>A magnifying glass held close to a page makes a big, upright image that seems to float <i>behind</i> the page. A headset does exactly this. The screen sits just inside the lens's focal length, so the light leaving the lens looks as if it came from a much bigger screen far away. That far away picture is called a <b>virtual image</b>, and it is what your eye focuses on.</p></div>`));
    raysBox.append(ctx.h(`<div class="card try"><p>Slide the screen distance slowly toward the focal length. The dashed lines (where the light <i>seems</i> to come from) meet farther and farther away, and the image grows. At exactly the focal length the image is at infinity. Go past it and there is no virtual image at all: the eye cannot focus.</p></div>`));
    raysBox.append(ctx.h(`<div class="card deep">
      <div class="formula">1/v = 1/d − 1/f &nbsp;→&nbsp; v = d·f / (f − d)<span>d: screen to lens, f: focal length, v: virtual image distance (same side as the screen)</span></div>
      <div class="formula">m = v / d = f / (f − d)</div>
      <p class="small">Designers put the virtual image at a comfortable fixed distance, often somewhere around 1 to 2 m. Your eyes focus there no matter how far away a virtual object is meant to be, which sets up the vergence accommodation conflict in chapter 8.</p>
      <p class="small"><b>Fresnel lenses</b> slice a thick lens into thin rings to save weight; the ridges scatter light into the streaks people call god rays. <b>Pancake lenses</b> fold the light path two or three times using a half mirror and polarisers, so the screen can sit much closer and the headset gets thinner, at the cost of throwing away a large share of the light.</p>
    </div>`));

    const distBox = ctx.h('<div style="display:grid;gap:12px"></div>');
    distBox.append(ctx.slider({ label: 'Lens distortion strength (k1)', min: 0, max: 0.5, step: 0.01, value: k1, onInput: (v) => { k1 = v; } }));
    const pw = ctx.h('<label class="check"><input type="checkbox" checked> Pre-warp the rendered image</label>');
    pw.querySelector('input').addEventListener('change', (e) => { prewarp = e.target.checked; });
    distBox.append(pw);
    distBox.append(ctx.h(`<div class="card tip"><p>Strong magnifiers bend straight lines near the edges. A headset lens stretches the outside of the picture more than the middle, called <b>pincushion distortion</b>. So the GPU first squeezes its image the opposite way (<b>barrel</b>), and the lens stretches it back. The two cancel and you see straight lines.</p></div>`));
    distBox.append(ctx.h(`<div class="card try"><p>Untick pre-warp and watch the grid on the right bow outward. Tick it again: the left panel bulges, the right one is straight. Raise k1 and notice how much the corners of the rendered image are squeezed, which wastes rendered pixels there.</p></div>`));
    distBox.append(ctx.h(`<div class="card deep">
      <div class="formula">r′ = r · (1 + k1·r² + k2·r⁴)<span>the radial model used here, with r measured from the lens centre</span></div>
      <p class="small">The pre-warp is the exact inverse, found per point with a few Newton steps. Real runtimes calibrate a distortion mesh per lens model (often per colour channel) and apply it in the compositor after your app renders. Because the barrel warp compresses the edges, apps usually render a bigger eye buffer than the panel so the centre stays sharp after warping.</p>
    </div>`));

    const chromaBox = ctx.h('<div style="display:grid;gap:12px"></div>');
    chromaBox.append(ctx.slider({ label: 'Dispersion (red vs blue size)', min: 0, max: 3, step: 0.05, value: disp, unit: '%', onInput: (v) => { disp = v; } }));
    const cf = ctx.h('<label class="check"><input type="checkbox" checked> Correct per colour channel</label>');
    cf.querySelector('input').addEventListener('change', (e) => { caFix = e.target.checked; });
    chromaBox.append(cf);
    chromaBox.append(ctx.h(`<div class="card tip"><p>Glass bends blue light a little more than red light, the same effect that makes a prism spread out a rainbow. Through a headset lens, the red, green and blue parts of the image come out at slightly different sizes, so white edges get coloured fringes that grow toward the edge of view. This is <b>chromatic aberration</b>.</p></div>`));
    chromaBox.append(ctx.h(`<div class="card try"><p>Untick the correction and look at the outer squares: red and blue edges peel apart. Tick it: each channel is pre-scaled by the opposite amount, so the lens lines them back up.</p></div>`));
    chromaBox.append(ctx.h(`<div class="card deep"><p class="small">This sideways (lateral) colour error can be fixed in software because it is just a slightly different distortion per channel. The other kind, axial chromatic aberration where colours focus at different depths, cannot be fixed by warping the image. Software correction also cannot fix the blur that comes from a pixel's own spread of wavelengths, so lens designers still work hard to keep dispersion low.</p></div>`));

    ctx.panel.append(raysBox, distBox, chromaBox);
    function show() { raysBox.hidden = mode !== 'rays'; distBox.hidden = mode !== 'distort'; chromaBox.hidden = mode !== 'chroma'; }
    show();

    ctx.loop(() => {
      const g = cv.ctx; const W = cv.w; const H = cv.h;
      if (!W) return;
      g.clearRect(0, 0, W, H);
      if (mode === 'rays') drawRays(g, W, H);
      else if (mode === 'distort') drawDistort(g, W, H);
      else drawChroma(g, W, H);
    });

    // ---------- Ray diagram ----------
    function drawRays(g, W, H) {
      const narrow = W < 560;
      const midY = H * 0.46;
      const span = 140; // mm shown from eye side to the right
      const sc = Math.min((W - 40) / span, (H * 0.36) / half);
      const lensX = 24 + (er + 18) * sc;
      const X = (mm) => lensX + mm * sc; // mm to the right of the lens (toward and past the screen)
      const Y = (mm) => midY - mm * sc;
      const v = d < f ? (d * f) / (f - d) : Infinity;
      const m = d < f ? f / (f - d) : Infinity;
      // axis
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.setLineDash([]);
      g.beginPath(); g.moveTo(0, midY); g.lineTo(W, midY); g.stroke();
      // focal points
      for (const s of [-1, 1]) { g.fillStyle = C.muted; g.beginPath(); g.arc(X(s * f), midY, 3, 0, Math.PI * 2); g.fill(); }
      g.font = MONO(10); g.fillStyle = C.muted; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText('F', X(f), midY + 6); g.fillText('F', X(-f), midY + 6);
      // eye
      const ex = X(-er) - 14 * sc * 0.6;
      g.strokeStyle = C.text2; g.lineWidth = 1.2; g.beginPath(); g.arc(ex, midY, 12 * sc * 0.6, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#1b1b1b'; g.fill(); g.stroke();
      g.fillStyle = C.text; g.beginPath(); g.arc(X(-er), midY, 2.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.muted; g.textAlign = 'center'; g.fillText('EYE', ex, midY + 12 * sc * 0.6 + 6);
      // lens
      const lh = half * 1.35 * sc;
      g.fillStyle = 'rgba(96,165,250,.16)'; g.strokeStyle = C.c5; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(lensX, midY - lh); g.quadraticCurveTo(lensX + 12, midY, lensX, midY + lh); g.quadraticCurveTo(lensX - 12, midY, lensX, midY - lh); g.fill(); g.stroke();
      g.fillStyle = C.c5; g.textBaseline = 'bottom'; g.fillText('LENS', lensX, midY - lh - 6);
      // screen
      const sx = X(d);
      g.fillStyle = '#222'; g.fillRect(sx, Y(half), 5, half * 2 * sc);
      const pts = [{ y: half * 0.9, c: C.c4 }, { y: 0, c: C.c2 }, { y: -half * 0.6, c: C.c1 }];
      pts.forEach((p) => { g.fillStyle = p.c; g.fillRect(sx, Y(p.y) - 3, 5, 6); });
      g.fillStyle = C.text2; g.textBaseline = 'bottom'; g.fillText('SCREEN', sx + 2, Y(half) - 6);
      // rays from each screen point through the lens toward the pupil
      const pupil = 2.5;
      for (const p of pts) {
        // choose lens heights so that outgoing rays land on the pupil (x = -er)
        for (const py of [-pupil, 0, pupil]) {
          // outgoing ray passes lens at height y with slope s' (going left). In standard coords (light moving +x, object at -d):
          // s = (y - yo)/d, s' = s - y/f, height at eye: y + s'*er = py  ->  y(1 + er/d - er/f) = py + yo*er/d
          const y = (py + (p.y * er) / d) / (1 + er / d - er / f);
          const s = (y - p.y) / d; const s2 = s - y / f;
          g.strokeStyle = p.c; g.globalAlpha = 0.85; g.lineWidth = 1; g.setLineDash([]);
          g.beginPath(); g.moveTo(X(d), Y(p.y)); g.lineTo(X(0), Y(y)); g.lineTo(X(-er), Y(y + s2 * er)); g.stroke();
          // back extension: where the outgoing ray seems to come from
          if (isFinite(v)) {
            g.setLineDash([3, 4]); g.globalAlpha = 0.45;
            const far = Math.min(v, (W - lensX) / sc + 10);
            g.beginPath(); g.moveTo(X(0), Y(y)); g.lineTo(X(far), Y(y - s2 * far)); g.stroke();
          }
          g.globalAlpha = 1; g.setLineDash([]);
        }
      }
      // virtual image
      const maxMm = (W - lensX) / sc - 6;
      if (isFinite(v)) {
        if (v < maxMm) {
          g.strokeStyle = 'rgba(245,245,240,.35)'; g.setLineDash([4, 4]); g.lineWidth = 1.5;
          g.beginPath(); g.moveTo(X(v), Y(half * m)); g.lineTo(X(v), Y(-half * m)); g.stroke(); g.setLineDash([]);
          pts.forEach((p) => { g.fillStyle = p.c; g.globalAlpha = 0.6; g.beginPath(); g.arc(X(v), Y(p.y * m), 4, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; });
          pill(g, 'virtual image', X(v), Math.max(14, Y(half * m) - 12));
        } else {
          pill(g, `virtual image ${fmtDist(v)} away →`, W - 8, midY - 14, { align: 'right', color: C.c2 });
        }
      } else {
        pill(g, d === f ? 'image at infinity' : 'no virtual image: cannot focus', W - 8, midY - 14, { align: 'right', color: C.c4 });
      }
      // log scale strip
      const by = H - 46; const bx0 = 24; const bx1 = W - 24;
      const L = (mm) => bx0 + ((Math.log10(clamp(mm, 10, 10000)) - 1) / 3) * (bx1 - bx0);
      g.strokeStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.moveTo(bx0, by); g.lineTo(bx1, by); g.stroke();
      g.font = MONO(10); g.fillStyle = C.muted; g.textAlign = 'center'; g.textBaseline = 'top';
      for (const [mm, lab] of [[10, '1 cm'], [100, '10 cm'], [1000, '1 m'], [10000, '10 m']]) { g.fillRect(L(mm), by - 3, 1, 6); g.fillText(lab, L(mm), by + 6); }
      g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(narrow ? 'DISTANCE, LOG' : 'DISTANCE FROM LENS, LOG SCALE', bx0, by - 26);
      const mark = (mm, c, lab, up) => { g.fillStyle = c; g.beginPath(); g.arc(L(mm), by, 4, 0, Math.PI * 2); g.fill(); g.textAlign = 'center'; g.textBaseline = up ? 'bottom' : 'top'; g.fillText(lab, L(mm), up ? by - 7 : by + 18); };
      mark(d, C.text2, 'screen', true);
      if (isFinite(v)) mark(Math.min(v, 10000), C.c2, v > 10000 ? 'image > 10 m' : 'image', false);
      // stats
      stats.querySelector('.s-v').textContent = isFinite(v) ? fmtDist(v) : (d === f ? '∞' : 'none');
      stats.querySelector('.s-m').textContent = isFinite(m) ? `${m.toFixed(1)}×` : '-';
      stats.querySelector('.s-a').textContent = isFinite(v) ? `${(1000 / (v + er)).toFixed(2)} D` : '0 D';
    }
    function fmtDist(mm) { return mm >= 1000 ? `${(mm / 1000).toFixed(mm > 9999 ? 0 : 2)} m` : `${Math.round(mm / 10)} cm`; }

    // ---------- Distortion ----------
    const lensMap = (r) => r * (1 + k1 * r * r + 0.3 * k1 * k1 * r * r * r * r);
    function invMap(r) { let x = r; for (let i = 0; i < 8; i++) { const fx = lensMap(x) - r; const dfx = 1 + 3 * k1 * x * x + 1.5 * k1 * k1 * x ** 4; x -= fx / dfx; } return x; }
    function drawDistort(g, W, H) {
      const stack = W < 640;
      const n = 3; const gap = 14;
      const size = stack ? Math.min(W - 20, (H - 60 - gap * 2) / 3) : Math.min((W - gap * 4) / 3, H - 120);
      const titles = ['GPU renders this', 'the lens stretches it', 'your eye sees'];
      for (let i = 0; i < n; i++) {
        const cx = stack ? W / 2 : gap + size / 2 + i * (size + gap) + (W - (size * 3 + gap * 4)) / 2 + gap / 2;
        const cy = stack ? 10 + size / 2 + i * (size + gap) + 16 : H / 2 + 10;
        const R = size / 2;
        g.save();
        g.fillStyle = '#0d0d0d'; g.strokeStyle = 'rgba(255,255,255,.12)';
        g.beginPath(); g.roundRect(cx - R, cy - R, size, size, 10); g.fill(); g.stroke();
        g.beginPath(); g.roundRect(cx - R, cy - R, size, size, 10); g.clip();
        const mapPt = (x, y) => {
          // x, y in [-1, 1] screen space of the intended image
          let rr = Math.hypot(x, y) / Math.SQRT2; // normalise so corners are r = 1
          let s = 1;
          if (i === 0) s = prewarp ? invMap(rr) / (rr || 1) : 1;
          if (i === 2) { const pre = prewarp ? invMap(rr) : rr; s = lensMap(pre) / (rr || 1); }
          if (i === 1) s = 1; // the middle panel shows the lens field itself
          return [cx + x * s * R * 0.92, cy + y * s * R * 0.92];
        };
        if (i === 1) {
          // show how the lens maps a straight grid: arrows from where a point is drawn to where it appears
          g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;
          for (let a = -1; a <= 1.001; a += 0.25) {
            line(g, (t) => [cx + t * R * 0.92 * 0.85, cy + a * R * 0.92 * 0.85]);
            line(g, (t) => [cx + a * R * 0.92 * 0.85, cy + t * R * 0.92 * 0.85]);
          }
          g.strokeStyle = C.c2; g.fillStyle = C.c2; g.lineWidth = 1.2;
          for (let a = -1; a <= 1.001; a += 0.5) for (let b = -1; b <= 1.001; b += 0.5) {
            const x = a * 0.85; const y = b * 0.85; const rr = Math.hypot(x, y) / Math.SQRT2; const s = lensMap(rr) / (rr || 1);
            const x0 = cx + x * R * 0.92; const y0 = cy + y * R * 0.92; const x1 = cx + x * s * R * 0.92; const y1 = cy + y * s * R * 0.92;
            g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
            g.beginPath(); g.arc(x1, y1, 2.2, 0, Math.PI * 2); g.fill();
          }
        } else {
          g.lineWidth = 1.3;
          for (let a = -1; a <= 1.001; a += 0.125) {
            const major = Math.abs(a % 0.5) < 1e-6;
            g.strokeStyle = major ? (i === 0 ? C.c1 : C.text) : 'rgba(245,245,240,.35)';
            line(g, (t) => mapPt(t, a));
            line(g, (t) => mapPt(a, t));
          }
        }
        g.restore();
        g.font = DISPLAY(13, 700); g.fillStyle = i === 0 ? C.c1 : i === 1 ? C.c2 : C.text; g.textAlign = 'left'; g.textBaseline = 'bottom';
        g.fillText(`${i + 1}. ${titles[i].toUpperCase()}`, cx - R + 2, cy - R - 5);
      }
    }
    function line(g, fn) { g.beginPath(); for (let k = 0; k <= 48; k++) { const [x, y] = fn(-1 + (2 * k) / 48); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }

    // ---------- Chromatic aberration ----------
    function drawChroma(g, W, H) {
      const size = Math.min(W - 24, H - 60); const cx = W / 2; const cy = H / 2 + 6; const R = size / 2;
      g.fillStyle = '#000'; g.beginPath(); g.roundRect(cx - R, cy - R, size, size, 10); g.fill();
      g.save(); g.beginPath(); g.roundRect(cx - R, cy - R, size, size, 10); g.clip();
      g.globalCompositeOperation = 'lighter';
      const a = disp / 100;
      // lens scales red down and blue up relative to green (in proportion to radius); correction pre-scales the other way
      const chans = [['#ff0000', -a], ['#00ff00', 0], ['#0000ff', a]];
      for (const [col, k] of chans) {
        // the lens scales this channel by (1 + k); the correction pre-scales it by 1 / (1 + k), so they cancel
        const s2 = caFix ? (1 / (1 + k)) * (1 + k) : 1 + k;
        g.save(); g.translate(cx, cy); g.scale(s2, s2);
        g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 2 / s2;
        const n = 8; const step = (size * 0.9) / n;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          if ((i + j) % 2) g.fillRect(-size * 0.45 + i * step + step * 0.18, -size * 0.45 + j * step + step * 0.18, step * 0.64, step * 0.64);
        }
        g.beginPath(); g.arc(0, 0, size * 0.42, 0, Math.PI * 2); g.stroke();
        g.restore();
      }
      g.restore();
      g.globalCompositeOperation = 'source-over';
      pill(g, caFix ? 'corrected: channels pre-scaled' : 'uncorrected: fringes grow toward the edge', cx, cy - R + 16, { color: caFix ? C.ok : C.c2 });
      // magnified corner
      const zs = Math.min(120, size * 0.32); const zx = cx + R - zs - 10; const zy = cy + R - zs - 10;
      g.save(); g.beginPath(); g.roundRect(zx, zy, zs, zs, 8); g.clip();
      g.imageSmoothingEnabled = false;
      const dpr = cv.dpr; const src = zs / 4;
      g.drawImage(cv.el, (cx + R * 0.72 - src / 2) * dpr, (cy - R * 0.72 - src / 2) * dpr, src * dpr, src * dpr, zx, zy, zs, zs);
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.strokeRect(zx, zy, zs, zs);
      pill(g, '4× zoom: top right', zx + zs / 2, zy + 12, { px: 10 });
    }

    ctx.quiz([
      { q: 'Where is the screen placed relative to the lens\'s focal length?', choices: ['Exactly twice the focal length', 'Just inside the focal length', 'Far beyond the focal length'], answer: 1, why: 'Inside f, a convex lens forms a magnified, upright virtual image far away, which is what your eye focuses on.' },
      { q: 'Why does the GPU squeeze its image into a barrel shape?', choices: ['To save memory', 'To cancel the lens\'s pincushion distortion', 'To make the edges brighter'], answer: 1, why: 'Pre-warping with the inverse of the lens distortion makes straight lines look straight through the lens.' },
      { q: 'Lateral chromatic aberration in a headset can be reduced in software by…', choices: ['Scaling the red, green and blue channels by slightly different amounts', 'Raising the refresh rate', 'Turning down the brightness'], answer: 0, why: 'Each colour is magnified a little differently by the lens, so a per channel pre-scale (or per channel distortion mesh) lines them back up.' },
    ]);
  },
};
