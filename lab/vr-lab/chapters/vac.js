// Chapter 8: the vergence accommodation conflict. Top down eyes converging on an object while the lens of the eye
// focuses: on the object in the real world, on the fixed virtual image plane in a headset.
import { MONO, DISPLAY, clamp, pill } from '../lib/xr.js';

export default {
  mount(ctx) {
    const C = ctx.colors;
    const cv = ctx.canvas();
    let d = 0.5; let F = 1.4; const ipd = 0.063; let anim = 0; let animOn = false;

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Vergence and focus</h2>'),
      ctx.h('<p class="lede">In the real world your eyes aim and focus at the same distance. In almost every headset they cannot, and your visual system notices.</p>'),
    );
    const dSl = ctx.slider({ label: 'Virtual object distance', min: Math.log10(0.2), max: Math.log10(10), step: 0.001, value: Math.log10(d), fmt: (v) => fmtM(10 ** v), onInput: (v) => { d = 10 ** v; animOn = false; } });
    ctx.panel.append(dSl);
    ctx.panel.append(ctx.slider({ label: 'Headset focal distance', min: 0.5, max: 3, step: 0.05, value: F, fmt: (v) => fmtM(v), onInput: (v) => { F = v; } }));
    const animBtn = ctx.h('<button class="btn ghost sm act">Throw a ball at me</button>');
    animBtn.addEventListener('click', () => { animOn = true; anim = 0; });
    ctx.panel.append(ctx.h('<div class="row"></div>')); ctx.panel.lastChild.append(animBtn);
    const stats = ctx.h('<div class="stat"><div><b class="s-v">0</b><span>Aim (vergence)</span></div><div><b class="s-a">0</b><span>Focus (headset)</span></div><div><b class="s-c">0</b><span>Conflict</span></div></div>');
    ctx.panel.append(stats);
    ctx.panel.append(ctx.h(`<div class="card tip"><p>Two things happen when you look at something. Your eyes <b>turn</b> so both point at it (vergence), and the lens inside each eye <b>changes shape</b> to bring it into focus (accommodation). Your brain links the two: aim close, focus close.</p><p>In a headset, the picture always sits at the lens's fixed focal distance, often around a metre or two. So for a virtual object 30 cm from your face, your eyes aim at 30 cm but must focus much farther away to keep it sharp. That mismatch is the <b>vergence accommodation conflict</b>, and it is one cause of eye strain and of virtual things up close looking oddly blurry.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><p>Drag the object distance down to 0.3 m. In the real world panel, aim and focus move together. In the headset panel, the focus stays on the dashed plane and the red gap grows. Push the object out to the focal distance: the conflict disappears. Press <b>Throw a ball at me</b> to watch it spike as something comes close.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card deep">
      <p class="small">Distances are easiest to compare in <b>diopters</b> (1 / metres). Vergence demand is 1/d, accommodation demand in a headset is fixed at 1/F, and the conflict is the difference. Going from 2 m to 1 m is 0.5 D, but 50 cm to 25 cm is 2 D: the conflict explodes up close.</p>
      <div class="formula">conflict = | 1/d − 1/F | diopters</div>
      <p class="small">Comfort studies (for example Shibata and colleagues, 2011) mapped a zone where the mismatch is tolerable; a common design rule of thumb is to keep it within roughly half a diopter for content people look at for long. That is why many design guides keep UI panels at around 1 to 2 m, and avoid holding content very close to the face.</p>
      <p class="small">Fixes in research and some products: <b>varifocal</b> displays move the screen or lens to follow eye tracked gaze (Meta's Half Dome prototypes), <b>multifocal</b> displays show several focal planes, and <b>light field</b> and <b>holographic</b> displays try to recreate real focus cues. Rendering defocus blur by depth (where the gaze is not) can help a little but does not fix accommodation.</p>
    </div>`));

    function fmtM(m) { return m < 1 ? `${Math.round(m * 100)} cm` : `${m.toFixed(m < 3 ? 2 : 1)} m`; }

    ctx.loop((time, dt) => {
      if (animOn) {
        anim += dt / 2.2;
        const t = clamp(anim, 0, 1);
        d = 10 ** (Math.log10(8) + (Math.log10(0.22) - Math.log10(8)) * (t * t));
        dSl.value = Math.log10(d);
        if (anim > 1.6) { animOn = false; }
      }
      draw();
      const verg = (2 * Math.atan(ipd / (2 * d)) * 180) / Math.PI;
      stats.querySelector('.s-v').textContent = `${(1 / d).toFixed(2)} D`;
      stats.querySelector('.s-a').textContent = `${(1 / F).toFixed(2)} D`;
      const conf = Math.abs(1 / d - 1 / F);
      stats.querySelector('.s-c').textContent = `${conf.toFixed(2)} D`;
      stats.querySelector('.s-c').style.color = conf > 0.5 ? C.c4 : C.ok;
      stats.querySelector('.s-v').title = `vergence angle ${verg.toFixed(2)}°`;
    });

    function draw() {
      const g = cv.ctx; const W = cv.w; const H = cv.h;
      if (!W) return;
      g.clearRect(0, 0, W, H);
      const stack = W < 300;
      const pw = stack ? W - 16 : (W - 36) / 2; const ph = stack ? (H - 100) / 2 : H - 96;
      const panels = [{ x: 8, y: 8, title: 'Real world', headset: false }, { x: stack ? 8 : 8 + pw + 20, y: stack ? 8 + ph + 8 : 8, title: 'In a headset', headset: true }];
      for (const p of panels) drawPanel(g, p.x, p.y, pw, ph, p.title, p.headset, stack);
      drawDiopters(g, 16, H - 74, W - 32);
    }

    function drawPanel(g, x0, y0, w, h, title, headset, compact) {
      g.fillStyle = 'rgba(10,10,10,.6)'; g.strokeStyle = 'rgba(255,255,255,.1)';
      g.beginPath(); g.roundRect(x0, y0, w, h, 10); g.fill(); g.stroke();
      g.font = DISPLAY(w < 260 ? 12 : 15, 700); g.fillStyle = headset ? C.c3 : C.c1; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(title.toUpperCase(), x0 + 12, y0 + 10);
      const cx = x0 + w / 2; const eyeY = y0 + h - 34; const top = y0 + 36;
      // distance axis: log from 0.15 m to 12 m
      const Y = (m) => eyeY - 18 - ((Math.log10(clamp(m, 0.15, 12)) - Math.log10(0.15)) / (Math.log10(12) - Math.log10(0.15))) * (eyeY - 18 - top);
      g.font = MONO(10); g.fillStyle = C.subtle; g.textAlign = 'right'; g.textBaseline = 'middle';
      for (const m of [0.25, 0.5, 1, 2, 5, 10]) { const y = Y(m); g.fillText(m < 1 ? `${m * 100} cm` : `${m} m`, x0 + w - 8, y); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(x0 + 10, y, w - 70, 1); g.fillStyle = C.subtle; }
      const sep = Math.min(34, w * 0.08);
      const eyes = [cx - sep, cx + sep];
      const oy = Y(d);
      // focal plane in the headset
      if (headset) {
        const fy = Y(F);
        g.strokeStyle = C.c3; g.setLineDash([6, 5]); g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(x0 + 14, fy); g.lineTo(x0 + w - 64, fy); g.stroke(); g.setLineDash([]);
        g.font = MONO(10); g.fillStyle = C.c3; g.textAlign = 'left'; g.textBaseline = 'top';
        g.fillText('virtual image plane', x0 + 14, fy + 5);
      }
      const focusY = headset ? Y(F) : oy;
      // vergence lines
      g.strokeStyle = C.c1; g.lineWidth = 1.4;
      for (const ex of eyes) { g.beginPath(); g.moveTo(ex, eyeY); g.lineTo(cx, oy); g.stroke(); }
      // focus cones: light focused from the accommodation distance
      g.fillStyle = 'rgba(251,191,36,.10)'; g.strokeStyle = 'rgba(251,191,36,.6)'; g.lineWidth = 1;
      for (const ex of eyes) {
        g.beginPath(); g.moveTo(ex - 6, eyeY - 6); g.lineTo(cx, focusY); g.lineTo(ex + 6, eyeY - 6); g.closePath(); g.fill();
      }
      g.strokeStyle = C.c2; g.lineWidth = 2;
      g.beginPath(); g.arc(cx, focusY, 9, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
      g.beginPath(); g.arc(cx, focusY, 9, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
      // the object
      g.fillStyle = C.c4; g.beginPath(); g.arc(cx, oy, 6, 0, Math.PI * 2); g.fill();
      // conflict marker
      if (headset && Math.abs(focusY - oy) > 4) {
        const conf = Math.abs(1 / d - 1 / F);
        g.strokeStyle = conf > 0.5 ? C.c4 : 'rgba(163,230,53,.8)'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(cx + 22, oy); g.lineTo(cx + 22, focusY); g.stroke();
        pill(g, w < 300 ? `${conf.toFixed(1)} D` : `${conf.toFixed(2)} D mismatch`, cx + 26, (oy + focusY) / 2, { align: 'left', color: conf > 0.5 ? C.c4 : C.c6, px: 10 });
      }
      // eyes with lens thickness showing accommodation
      const acc = 1 / (headset ? F : d);
      for (const ex of eyes) {
        g.fillStyle = '#1b1b1b'; g.strokeStyle = C.text2; g.lineWidth = 1.2;
        g.beginPath(); g.arc(ex, eyeY + 8, 14, 0, Math.PI * 2); g.fill(); g.stroke();
        const th = 2 + clamp(acc, 0, 5) * 1.5;
        g.fillStyle = 'rgba(251,191,36,.85)'; g.beginPath(); g.ellipse(ex, eyeY - 2, 7, th, 0, 0, Math.PI * 2); g.fill();
      }
      g.font = MONO(10); g.fillStyle = C.muted; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText('lens shape = focus', cx, eyeY + 24);
      pill(g, 'aim', cx - 30, oy, { color: C.c1, px: 10, align: 'right' });
      if (Math.abs(focusY - oy) > 14 || !headset) pill(g, 'focus', cx - 30, focusY + (headset ? -16 : 18), { color: C.c2, px: 10, align: 'right' });
    }

    function drawDiopters(g, x0, y0, w) {
      g.fillStyle = 'rgba(10,10,10,.7)'; g.beginPath(); g.roundRect(x0 - 8, y0 - 6, w + 16, 66, 10); g.fill();
      const maxD = 5; const X = (D) => x0 + 10 + (clamp(D, 0, maxD) / maxD) * (w - 20); const y = y0 + 26;
      // comfort zone around the focal plane
      const a = X(Math.max(0, 1 / F - 0.5)); const b = X(1 / F + 0.5);
      g.fillStyle = 'rgba(163,230,53,.12)'; g.fillRect(a, y - 9, b - a, 18);
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(X(0), y); g.lineTo(X(maxD), y); g.stroke();
      g.font = MONO(10); g.fillStyle = C.muted; g.textAlign = 'center'; g.textBaseline = 'top';
      for (let D = 0; D <= maxD; D++) { g.fillRect(X(D), y - 3, 1, 6); g.fillText(`${D} D`, X(D), y + 11); }
      g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(w < 520 ? 'diopters. ▲ aim  ● focus' : 'diopters (1 / metres).  ▲ aim   ● headset focus   green: within about 0.5 D of focus', x0 + 4, y0 + 14);
      g.fillStyle = C.c3; g.beginPath(); g.arc(X(1 / F), y, 5, 0, Math.PI * 2); g.fill();
      g.fillStyle = C.c1; g.beginPath(); g.moveTo(X(1 / d), y - 4); g.lineTo(X(1 / d) - 6, y - 13); g.lineTo(X(1 / d) + 6, y - 13); g.closePath(); g.fill();
    }

    ctx.quiz([
      { q: 'In a typical headset, what distance do your eyes focus at?', choices: ['Whatever distance the virtual object is at', 'The fixed distance of the lens\'s virtual image', 'Always infinity'], answer: 1, why: 'The optics put the screen at one virtual image distance, so accommodation is stuck there.' },
      { q: 'Which change makes the conflict much worse?', choices: ['Moving an object from 2 m to 1.5 m', 'Moving an object from 50 cm to 25 cm', 'Both are the same'], answer: 1, why: 'In diopters, 2 m to 1.5 m is about 0.17 D, but 50 cm to 25 cm is 2 D.' },
      { q: 'Which display approach aims to fix the conflict directly?', choices: ['Higher refresh rate', 'Varifocal or light field displays', 'Wider field of view'], answer: 1, why: 'They change or recreate focus cues so accommodation can follow vergence.' },
    ]);
  },
};
