// Additive light (RGB spotlights on a dark wall) versus subtractive paint (CMY pigments on white paper).
export default {
  mount(ctx) {
    const cv = ctx.canvas(); const g = cv.ctx;
    let mode = 'light';
    const spots = [
      { x: 0.42, y: 0.42, c: [255, 40, 40], p: [0, 190, 230] },
      { x: 0.58, y: 0.42, c: [40, 255, 60], p: [230, 0, 150] },
      { x: 0.5, y: 0.6, c: [50, 80, 255], p: [250, 220, 0] },
    ];
    let drag = null;
    const R = () => Math.min(cv.w, cv.h) * 0.22;
    function draw() {
      const { w, h } = cv; g.globalCompositeOperation = 'source-over';
      g.fillStyle = mode === 'light' ? '#050507' : '#f4f1ea'; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = mode === 'light' ? 'lighter' : 'multiply';
      for (const s of spots) {
        const col = mode === 'light' ? s.c : s.p;
        const x = s.x * w; const y = s.y * h; const r = R();
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        const a = mode === 'light' ? 1 : 0.92;
        grd.addColorStop(0, `rgba(${col},${a})`); grd.addColorStop(0.75, `rgba(${col},${a * 0.95})`); grd.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = mode === 'light' ? grd : `rgb(${col})`;
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
      g.font = '500 11px "DM Mono", monospace'; g.fillStyle = mode === 'light' ? ctx.colors.muted : '#55524c';
      g.fillText(mode === 'light' ? 'light adds: red + green + blue = white' : 'paint subtracts: cyan + magenta + yellow = near black', 16, h - 18);
    }
    cv.onResize(draw);
    const pt = (e) => { const r = cv.el.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    cv.el.style.touchAction = 'none';
    cv.el.addEventListener('pointerdown', (e) => { const [x, y] = pt(e); drag = spots.find((s) => Math.hypot((s.x - x) * cv.w, (s.y - y) * cv.h) < R()) || null; cv.el.setPointerCapture(e.pointerId); }, { signal: ctx.signal });
    cv.el.addEventListener('pointermove', (e) => { if (!drag) return; const [x, y] = pt(e); drag.x = Math.max(0, Math.min(1, x)); drag.y = Math.max(0, Math.min(1, y)); draw(); }, { signal: ctx.signal });
    cv.el.addEventListener('pointerup', () => { drag = null; }, { signal: ctx.signal });

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Light versus paint</h2>'),
      ctx.h('<p class="lede">Red and green light make yellow. Red and green paint make brown. Both are true, because light adds and paint takes away.</p>'),
      ctx.seg([['light', 'Coloured light'], ['paint', 'Paint']], 'light', (v) => { mode = v; draw(); }),
      ctx.h('<div class="card tip"><p><b>Light is additive.</b> Each spotlight adds its own wavelengths, so overlaps get brighter: red plus green looks yellow, all three make white. Screens, stage lights and projectors work this way, with red, green and blue as primaries.</p><p><b>Paint is subtractive.</b> A pigment absorbs some wavelengths and reflects the rest. Mixing pigments absorbs more, so overlaps get darker. Printers use cyan, magenta and yellow, which is why mixing every paint drifts toward a muddy near black.</p></div>'),
      ctx.h('<div class="card try"><p>Drag the circles. In light mode find yellow, cyan and magenta in the overlaps. Switch to paint and see the same idea run backwards: cyan and yellow make green.</p></div>'),
      ctx.h('<details class="more"><summary>Going deeper</summary><div><p>Your eye has three kinds of cone, roughly sensitive to long, medium and short wavelengths. "Yellow" from red plus green light is not the same light as a pure yellow wavelength, but it excites the cones the same way, so you see the same colour (a metamer).</p><p>Painters work with the traditional red, yellow and blue wheel. It is a practical simplification of the cyan, magenta and yellow subtractive primaries, which is why a true primary blue and red cannot mix a clean purple.</p></div></details>'),
    );
    ctx.quiz([
      { q: 'What do red, green and blue light make when all overlap?', choices: ['Black', 'White', 'Brown'], answer: 1, why: 'Light adds wavelengths, so all three primaries add up to white.' },
      { q: 'Why does mixing many paints get darker?', choices: ['Each pigment absorbs more light', 'Paint adds light', 'The canvas is dark'], answer: 0, why: 'Pigments subtract: every one you add absorbs another part of the spectrum.' },
      { q: 'Which primaries does a phone screen use?', choices: ['Cyan, magenta, yellow', 'Red, yellow, blue', 'Red, green, blue'], answer: 2, why: 'Screens emit light, so they use the additive primaries.' },
    ]);
  },
};
