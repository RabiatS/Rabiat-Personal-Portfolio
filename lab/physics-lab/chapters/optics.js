import { MONO, MONO_S, text, tag, arrow, pointer, fmt, rgba, clamp } from './_util.js';

// Light and optics: paraxial ray tracing through a thin lens or a curved mirror, and refraction at a flat surface
// with Snell's law and Fresnel reflection.
const MEDIA = { air: ['Air', 1.0], water: ['Water', 1.33], glass: ['Glass', 1.5], diamond: ['Diamond', 2.42] };

export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas();
    const g = cv.ctx;
    let mode = 'bench';
    const st = { el: 'convex', f: 8, d: 20, ho: 5, n1: 'air', n2: 'glass', th: 40, below: false };
    let drag = false;
    const lay = {};

    cv.onResize((w, h) => {
      lay.cx = w / 2; lay.cy = h * 0.52;
      lay.sc = Math.min(w / 66, h / 30); // px per cm on the bench
      lay.R = Math.min(w, h) * 0.38; // refraction view radius
    });
    const X = (x) => lay.cx + x * lay.sc;
    const Y = (y) => lay.cy - y * lay.sc;

    const isMirror = () => st.el === 'cmirror' || st.el === 'xmirror';
    const fSigned = () => (st.el === 'convex' || st.el === 'cmirror' ? st.f : -st.f);
    function image() {
      const f = fSigned(); const d = st.d;
      const di = Math.abs(d - f) < 1e-6 ? Infinity : (f * d) / (d - f);
      const m = Number.isFinite(di) ? -di / d : Infinity;
      return { di, m, hi: m * st.ho };
    }

    // trace one ray from the object tip with slope u (dy/dx); returns {inc:[p0,p1], out:[p1,p2], back:[p1,p3]|null} in cm
    function trace(u) {
      const f = fSigned();
      const x0 = -st.d; const y0 = st.ho;
      const y1 = y0 + u * st.d; // height where it meets the element
      const u2 = u - y1 / f;
      const far = 40;
      if (!isMirror()) {
        return { inc: [[x0, y0], [0, y1]], out: [[0, y1], [far, y1 + u2 * far]], back: [[0, y1], [-far, y1 - u2 * far]] };
      }
      // mirror: unfold, then reflect x
      return { inc: [[x0, y0], [0, y1]], out: [[0, y1], [-far, y1 + u2 * far]], back: [[0, y1], [far, y1 - u2 * far]] };
    }

    function line(p, q, col, lw, dash) {
      g.strokeStyle = col; g.lineWidth = lw; g.setLineDash(dash || []);
      g.beginPath(); g.moveTo(X(p[0]), Y(p[1])); g.lineTo(X(q[0]), Y(q[1])); g.stroke(); g.setLineDash([]);
    }

    function drawBench() {
      const w = cv.w; const h = cv.h;
      const f = fSigned(); const mir = isMirror();
      const im = image();
      // axis
      g.strokeStyle = '#3A3A38'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, lay.cy); g.lineTo(w, lay.cy); g.stroke();
      // focal points
      const marks = mir ? [[f, 'F'], [2 * f, 'C']] : [[f, 'F'], [-f, 'F'], [2 * f, '2F'], [-2 * f, '2F']];
      for (const [x, n] of marks) {
        const xx = mir ? -x : x;
        if (Math.abs(xx) > 33) continue;
        g.fillStyle = C.c2; g.beginPath(); g.arc(X(xx), lay.cy, 3, 0, 7); g.fill();
        text(g, n, X(xx), lay.cy + 16, C.c2, 'center', 'alphabetic', MONO_S);
      }
      // element
      const hh = 11;
      g.strokeStyle = 'rgba(96,165,250,.18)'; g.setLineDash([2, 4]); g.beginPath(); g.moveTo(X(0), 0); g.lineTo(X(0), h); g.stroke(); g.setLineDash([]);
      if (!mir) {
        const [end, mid] = st.el === 'convex' ? [0.3, 1.2] : [1.4, 0.2];
        const cL = 2 * -mid + end; const cR = 2 * mid - end;
        g.fillStyle = 'rgba(96,165,250,.16)'; g.strokeStyle = rgba(C.c5, 0.8); g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(X(-end), Y(hh)); g.quadraticCurveTo(X(cL), Y(0), X(-end), Y(-hh));
        g.lineTo(X(end), Y(-hh)); g.quadraticCurveTo(X(cR), Y(0), X(end), Y(hh));
        g.closePath(); g.fill(); g.stroke();
      } else {
        const e = st.el === 'cmirror' ? -1.2 : 1.2; // edge offset: concave edges reach toward the object
        g.strokeStyle = rgba(C.c5, 0.9); g.lineWidth = 3;
        g.beginPath(); g.moveTo(X(e), Y(hh)); g.quadraticCurveTo(X(-e), Y(0), X(e), Y(-hh)); g.stroke();
        g.strokeStyle = 'rgba(160,160,154,.35)'; g.lineWidth = 1;
        for (let y = -hh; y <= hh; y += 1.5) { const xs = e * (y / hh) ** 2 + 0.3; g.beginPath(); g.moveTo(X(xs), Y(y)); g.lineTo(X(xs + 0.8), Y(y - 0.8)); g.stroke(); }
      }
      // fan of faint rays
      const virtual = im.di < 0;
      for (let k = -4; k <= 4; k++) {
        const yTarget = k * 2.4; const u = (yTarget - st.ho) / st.d;
        const r = trace(u);
        line(r.inc[0], r.inc[1], 'rgba(251,191,36,.18)', 1);
        line(r.out[0], r.out[1], 'rgba(251,191,36,.18)', 1);
      }
      // principal rays
      const pr = [];
      pr.push([0, C.c1]); // parallel to axis
      pr.push([(0 - st.ho) / st.d, C.c4]); // through the centre (lens) or the pole (mirror)
      // through (or toward) the near focal point, leaves parallel
      { const u = -st.ho / (st.d - f); if (Number.isFinite(u) && Math.abs(u) < 5) pr.push([u, C.c3]); } // aimed through (or toward) the front focal point
      for (const [u, col] of pr) {
        const r = trace(u);
        line(r.inc[0], r.inc[1], col, 1.8);
        line(r.out[0], r.out[1], col, 1.8);
        if (virtual) line(r.back[0], r.back[1], rgba(col, 0.55), 1.2, [4, 4]);
      }
      // object
      arrow(g, X(-st.d), lay.cy, X(-st.d), Y(st.ho), C.text, 3, 11);
      g.fillStyle = rgba(C.text, drag ? 0.3 : 0.12); g.beginPath(); g.arc(X(-st.d), Y(st.ho), 14, 0, 7); g.fill();
      tag(g, 'object', X(-st.d), Y(st.ho) + (st.ho > 0 ? -18 : 18), C.text, 'center');
      // image
      if (Number.isFinite(im.di) && Math.abs(im.di) < 200) {
        const ix = mir ? -im.di : im.di;
        if (Math.abs(ix) < 36 && Math.abs(im.hi) < 30) {
          g.save(); if (virtual) { g.setLineDash([5, 4]); g.globalAlpha = 0.75; }
          g.strokeStyle = C.c6; g.lineWidth = 3; g.beginPath(); g.moveTo(X(ix), lay.cy); g.lineTo(X(ix), Y(im.hi)); g.stroke();
          g.restore();
          arrow(g, X(ix), Y(im.hi * 0.8), X(ix), Y(im.hi), virtual ? rgba(C.c6, 0.75) : C.c6, 3, 11);
          tag(g, `${virtual ? 'virtual' : 'real'} image`, X(ix), Y(im.hi) + (im.hi > 0 ? -16 : 16), C.c6, 'center');
        } else tag(g, 'image off screen', w - 12, 34, C.c6, 'right');
      } else tag(g, 'object at the focal point: no image (rays leave parallel)', w / 2, 34, C.c6, 'center');
      tag(g, 'drag the object arrow', 12, 16, C.muted, 'left');
    }

    // Fresnel reflectance for unpolarised light
    function fresnel(n1, n2, t1) {
      const s = (n1 / n2) * Math.sin(t1);
      if (s >= 1) return 1;
      const t2 = Math.asin(s);
      const rs = ((n1 * Math.cos(t1) - n2 * Math.cos(t2)) / (n1 * Math.cos(t1) + n2 * Math.cos(t2))) ** 2;
      const rp = ((n1 * Math.cos(t2) - n2 * Math.cos(t1)) / (n1 * Math.cos(t2) + n2 * Math.cos(t1))) ** 2;
      return (rs + rp) / 2;
    }
    function refr() {
      const nA = MEDIA[st.below ? st.n2 : st.n1][1]; const nB = MEDIA[st.below ? st.n1 : st.n2][1];
      const t1 = st.th * Math.PI / 180;
      const s = (nA / nB) * Math.sin(t1);
      const tir = s >= 1;
      const t2 = tir ? NaN : Math.asin(s);
      const R = fresnel(nA, nB, t1);
      const crit = nA > nB ? Math.asin(nB / nA) * 180 / Math.PI : NaN;
      return { nA, nB, t1, t2, tir, R, crit };
    }
    function beam(x1, y1, x2, y2, a) {
      g.lineCap = 'round';
      g.strokeStyle = rgba(C.c4, 0.12 * a); g.lineWidth = 9; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      g.strokeStyle = rgba(C.c4, Math.max(0.16, a)); g.lineWidth = 2.2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    }
    function drawRefraction() {
      const w = cv.w; const h = cv.h; const cx = lay.cx; const cy = lay.cy; const R = lay.R;
      const top = MEDIA[st.n1]; const bot = MEDIA[st.n2];
      g.fillStyle = `rgba(96,165,250,${0.03 + (top[1] - 1) * 0.12})`; g.fillRect(0, 0, w, cy);
      g.fillStyle = `rgba(96,165,250,${0.03 + (bot[1] - 1) * 0.12})`; g.fillRect(0, cy, w, h - cy);
      g.strokeStyle = '#5A5A55'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, cy); g.lineTo(w, cy); g.stroke();
      tag(g, `${top[0]}  n = ${top[1].toFixed(2)}`, 12, cy - 14, C.text2, 'left');
      tag(g, `${bot[0]}  n = ${bot[1].toFixed(2)}`, 12, cy + 16, C.text2, 'left');
      g.strokeStyle = 'rgba(255,255,255,.18)'; g.setLineDash([4, 5]); g.beginPath(); g.moveTo(cx, cy - R - 10); g.lineTo(cx, cy + R + 10); g.stroke(); g.setLineDash([]);
      text(g, 'normal', cx + 6, cy - R - 2, '#5A5A55', 'left', 'alphabetic', MONO_S);
      const r = refr();
      const sgn = st.below ? 1 : -1; // incident side: -1 is above
      const sx = cx - R * Math.sin(r.t1); const sy = cy + sgn * R * Math.cos(r.t1);
      // incident
      beam(sx, sy, cx, cy, 1);
      g.fillStyle = C.c4; g.save(); g.translate(sx, sy); g.rotate(Math.atan2(cy - sy, cx - sx)); g.fillRect(-22, -6, 22, 12); g.restore();
      g.fillStyle = rgba(C.c4, drag ? 0.35 : 0.15); g.beginPath(); g.arc(sx, sy, 18, 0, 7); g.fill();
      // reflected
      beam(cx, cy, cx + R * Math.sin(r.t1), cy + sgn * R * Math.cos(r.t1), r.R);
      // refracted
      if (!r.tir) beam(cx, cy, cx + R * Math.sin(r.t2), cy - sgn * R * Math.cos(r.t2), 1 - r.R);
      // angle arcs, each drawn the short way between the normal and the ray
      const arcBetween = (r0, a1, a2, col) => { let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, r0, a1, a1 + d, d < 0); g.stroke(); };
      arcBetween(46, Math.atan2(sgn, 0), Math.atan2(sy - cy, sx - cx), C.c2);
      tag(g, `θ₁ ${fmt(st.th, 1)}°`, cx - 58 * Math.sin(r.t1 / 2) - 4, cy + sgn * 58 * Math.cos(r.t1 / 2), C.c2, 'right');
      if (!r.tir) {
        arcBetween(56, Math.atan2(-sgn, 0), Math.atan2(-sgn * Math.cos(r.t2), Math.sin(r.t2)), C.c1);
        tag(g, `θ₂ ${fmt(r.t2 * 180 / Math.PI, 1)}°`, cx + 70 * Math.sin(r.t2 / 2) + 4, cy - sgn * 70 * Math.cos(r.t2 / 2), C.c1, 'left');
      } else tag(g, 'total internal reflection', cx + R * 0.5, cy - sgn * 40, C.c4, 'center', 'middle', '600 13px "DM Mono", monospace');
      if (Number.isFinite(r.crit)) {
        const ca = r.crit * Math.PI / 180;
        g.strokeStyle = rgba(C.c3, 0.5); g.setLineDash([2, 4]); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - 0.7 * R * Math.sin(ca), cy + sgn * 0.7 * R * Math.cos(ca)); g.stroke(); g.setLineDash([]);
        tag(g, `critical ${fmt(r.crit, 1)}°`, cx - 0.7 * R * Math.sin(ca) - 6, cy + sgn * 0.7 * R * Math.cos(ca), C.c3, 'right');
      }
      tag(g, 'drag the laser around the circle', w - 12, 16, C.muted, 'right');
      tag(g, `reflected ${fmt(r.R * 100, 1)}%   transmitted ${fmt((1 - r.R) * 100, 1)}%`, w - 12, 34, C.text, 'right');
    }

    pointer(cv.el, {
      down(p) {
        if (mode === 'bench' && p.x > lay.cx - 10) return false;
        drag = true; movePt(p);
      },
      move(p) { movePt(p); },
      up() { drag = false; },
    }, ctx.signal);
    function movePt(p) {
        if (!drag) return;
        if (mode === 'bench') {
          st.d = clamp(+((lay.cx - p.x) / lay.sc).toFixed(1), 1, 32);
          let ho = (lay.cy - p.y) / lay.sc; if (Math.abs(ho) < 1) ho = ho < 0 ? -1 : 1;
          st.ho = clamp(+ho.toFixed(1), -10, 10);
        } else {
          const dx = p.x - lay.cx; const dy = p.y - lay.cy;
          st.below = dy > 0;
          st.th = clamp(Math.round(Math.atan2(Math.abs(dx), Math.abs(dy)) * 180 / Math.PI * 2) / 2, 0, 89.5);
        }
        readout();
    }

    ctx.loop(() => {
      g.clearRect(0, 0, cv.w, cv.h);
      if (mode === 'bench') drawBench(); else drawRefraction();
    });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Light and optics</h2>'),
      ctx.h('<p class="lede">Light travels in straight lines until something bends or bounces it. Lenses and mirrors do both on purpose, and make images.</p>'),
    );
    const seg = ctx.seg([['bench', 'Lenses and mirrors'], ['refract', 'Refraction']], mode, (m) => { mode = m; controls(); });
    ctx.panel.append(seg);
    const ctl = ctx.h('<div style="display:grid;gap:10px"></div>');
    const out = ctx.h('<div class="stat"></div>');
    ctx.panel.append(ctl, out);
    function controls() {
      ctl.innerHTML = '';
      if (mode === 'bench') {
        ctl.append(
          ctx.seg([['convex', 'Converging lens'], ['concave', 'Diverging lens'], ['cmirror', 'Concave mirror'], ['xmirror', 'Convex mirror']], st.el, (q) => { st.el = q; readout(); }),
          ctx.slider({ label: 'Focal length', min: 3, max: 15, step: 0.5, value: st.f, unit: ' cm', onInput: (q) => { st.f = q; readout(); } }),
          ctx.h('<div class="legend"><span><i style="background:var(--c1)"></i>parallel ray</span><span><i style="background:var(--c4)"></i>centre ray</span><span><i style="background:var(--c3)"></i>focal ray</span><span><i style="background:var(--c6)"></i>image</span></div>'),
        );
      } else {
        const opts = Object.entries(MEDIA).map(([k, [n]]) => [k, n]);
        ctl.append(ctx.h('<p class="hint">Top medium</p>'), ctx.seg(opts, st.n1, (q) => { st.n1 = q; readout(); }), ctx.h('<p class="hint">Bottom medium</p>'), ctx.seg(opts, st.n2, (q) => { st.n2 = q; readout(); }));
        const row = ctx.h('<div class="row"><button class="btn ghost sm">Glass to air, from below</button></div>');
        row.children[0].onclick = () => { st.n1 = 'air'; st.n2 = 'glass'; st.below = true; st.th = 45; controls(); };
        ctl.append(row);
      }
      readout();
    }
    function readout() {
      if (mode === 'bench') {
        const im = image(); const virtual = im.di < 0;
        const ok = Number.isFinite(im.di);
        out.innerHTML = [
          ['object distance', `${fmt(st.d, 1)} cm`], ['image distance', ok ? `${fmt(im.di, 1)} cm` : '∞'],
          ['magnification', ok ? `${fmt(im.m, 2)}×` : '∞'], ['type', ok ? (virtual ? 'virtual' : 'real') : 'none'],
          ['orientation', ok ? (im.m < 0 ? 'inverted' : 'upright') : '--'], ['size', ok ? (Math.abs(im.m) > 1 ? 'bigger' : 'smaller') : '--'],
        ].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
      } else {
        const r = refr();
        out.innerHTML = [
          ['incidence θ₁', `${fmt(st.th, 1)}°`], ['refraction θ₂', r.tir ? 'none' : `${fmt(r.t2 * 180 / Math.PI, 1)}°`],
          ['reflected', `${fmt(r.R * 100, 1)}%`], ['critical angle', Number.isFinite(r.crit) ? `${fmt(r.crit, 1)}°` : 'none'],
        ].map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
      }
    }
    controls();

    ctx.panel.append(
      ctx.h(`<div class="card tip"><p>Light slows down in glass and water. When it enters at an angle, one side of the beam slows first, so the beam turns: that is <b>refraction</b>. Going into a slower medium it bends toward the normal (the dashed line), coming out it bends away.</p><p>A <b>converging lens</b> is shaped so that rays parallel to the axis all bend through one spot, the <b>focal point F</b>. Rays from each point of an object meet again on the other side and build an <b>image</b>. If they really meet, the image is <b>real</b> and you could catch it on a screen. If they only seem to come from a point (dashed lines), it is <b>virtual</b>, like your reflection.</p></div>`),
      ctx.h(`<div class="card try"><ul>
        <li>Converging lens: start the object far away and walk it in. The real, upside down image grows and moves out. At F there is no image. Inside F you get an upright, magnified virtual image: a magnifying glass.</li>
        <li>Put the object at 2F. The image is at 2F on the other side, the same size, inverted.</li>
        <li>Diverging lens and convex mirror: wherever you put the object, the image is virtual, upright and smaller. That is why shop security mirrors are convex.</li>
        <li>Refraction: press <b>Glass to air, from below</b> and drag the laser to steeper angles. Past about 42° the light cannot get out at all: total internal reflection, the trick that keeps light inside optical fibres.</li>
      </ul></div>`),
      ctx.h(`<div class="card deep">
        <div class="formula">1/f = 1/d_o + 1/d_i &nbsp; m = −d_i / d_o<span>thin lens and mirror equation (real is positive)</span></div>
        <div class="formula">n₁ sin θ₁ = n₂ sin θ₂<span>Snell's law, n = c / v</span></div>
        <div class="formula">sin θ_c = n₂ / n₁<span>critical angle, only when n₁ &gt; n₂</span></div>
        <p class="small">Every ray on the bench is actually traced: at the lens each ray's slope changes by −y/f, where y is the height it hits (the paraxial thin lens rule). A mirror does the same and then folds the ray back. The image appears where the traced rays cross, and it agrees with the formula.</p>
        <p class="small muted">The brightness of the reflected and transmitted beams comes from the Fresnel equations for unpolarised light. Straight into glass from air, about 4% reflects. At grazing angles almost everything does. Real lenses also have aberrations (rays far from the axis focus slightly differently), which the paraxial model leaves out.</p>
      </div>`),
    );

    ctx.quiz([
      { q: 'An object sits 30 cm from a converging lens with f = 10 cm. Where is the image?', choices: ['15 cm on the other side', '20 cm on the other side', '7.5 cm on the same side'], answer: 0, why: '1/d_i = 1/10 − 1/30 = 2/30, so d_i = 15 cm, and it is real and inverted.' },
      { q: 'Light goes from glass (n = 1.5) into air. When can total internal reflection happen?', choices: ['Never, because air is less dense', 'When the angle of incidence is bigger than about 42°', 'At any angle above 0°'], answer: 1, why: 'sin θ_c = 1.0 / 1.5 gives θ_c ≈ 41.8°. Beyond that, no refracted ray exists.' },
      { q: 'What kind of image does a convex (bulging) mirror always give?', choices: ['Real and inverted', 'Virtual, upright and smaller', 'Virtual and magnified'], answer: 1, why: 'A convex mirror spreads light out, so reflected rays only appear to come from a point behind it, making a small upright virtual image.' },
    ]);
  },
};
