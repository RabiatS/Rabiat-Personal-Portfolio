// Drawing shadows: a per-pixel lit sphere on a table with the zones artists name, a draggable lamp and a value-step simplifier.
export default {
  mount(ctx) {
    const cv = ctx.canvas(); const g = cv.ctx;
    let L = { x: -0.55, y: -0.6, z: 0.6 }; let steps = 0; let labels = true; let bounce = 0.25;
    let img = null; let iw = 0; let ih = 0;
    function draw() {
      const { w, h } = cv; const S = 2; iw = Math.max(1, Math.floor(w / S)); ih = Math.max(1, Math.floor(h / S));
      if (!img || img.width !== iw || img.height !== ih) img = g.createImageData(iw, ih);
      const d = img.data; const cx = iw * 0.5; const cy = ih * 0.46; const r = Math.min(iw, ih) * 0.22; const floorY = cy + r;
      const ln = Math.hypot(L.x, L.y, L.z); const lx = L.x / ln; const ly = L.y / ln; const lz = L.z / ln;
      // cast shadow centre: away from the light along the floor
      const sx = cx - lx * r * 1.4; const sw = r * (1.05 + Math.abs(lx) * 0.9);
      const q = (v) => steps ? Math.round(v * (steps - 1)) / (steps - 1) : v;
      for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
        let v; const dx = (x - cx) / r; const dy = (y - cy) / r; const rr = dx * dx + dy * dy;
        if (rr <= 1) {
          const nz = Math.sqrt(1 - rr); const lam = dx * lx + dy * ly + nz * lz;
          const spec = Math.pow(Math.max(0, 2 * lam * nz - lz), 40) * 0.9;
          const refl = Math.max(0, dy) * Math.max(0, -lam) * bounce;
          v = 0.08 + 0.82 * Math.max(0, lam) + refl + spec;
        } else if (y > floorY - r * 0.1) {
          const fx = (x - sx) / sw; const fy = (y - floorY) / (r * 0.28);
          const s = fx * fx + fy * fy; const occl = s < 1 ? 0.55 * (1 - s) + 0.12 : 0;
          v = 0.62 - occl - (y - floorY) / ih * 0.2;
        } else v = 0.32 + (y / ih) * 0.12;
        v = q(Math.max(0, Math.min(1, v)));
        const i = (y * iw + x) * 4; const c = v * 255;
        d[i] = c * 0.98; d[i + 1] = c * 0.95; d[i + 2] = c * 0.9; d[i + 3] = 255;
      }
      const off = new OffscreenCanvas(iw, ih); off.getContext('2d').putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true; g.clearRect(0, 0, w, h); g.drawImage(off, 0, 0, w, h);
      // lamp
      const lampX = cx * S + lx * r * S * 2.2; const lampY = cy * S + ly * r * S * 2.2;
      g.fillStyle = ctx.colors.c2; g.beginPath(); g.arc(lampX, lampY, 12, 0, Math.PI * 2); g.fill();
      if (labels) {
        const P = (ax, ay) => [cx * S + ax * r * S, cy * S + ay * r * S];
        const tag = (t, ax, ay, tx, ty) => { const [x0, y0] = P(ax, ay); g.strokeStyle = ctx.colors.c1; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + tx, y0 + ty); g.stroke(); g.fillStyle = '#0b0b0d'; const tw = g.measureText(t).width + 10; g.fillRect(x0 + tx - (tx < 0 ? tw : 0), y0 + ty - 9, tw, 18); g.fillStyle = ctx.colors.c1; g.fillText(t, x0 + tx + (tx < 0 ? -tw + 5 : 5), y0 + ty + 4); };
        g.font = '500 11px "DM Mono", monospace';
        tag('highlight', lx * 0.62, ly * 0.62, -90, -30);
        tag('core shadow', -lx * 0.72, -ly * 0.72 + 0.05, 80, -10);
        tag('reflected light', -lx * 0.5, 0.86, 70, 30);
        const [scx, scy] = [sx * S, (floorY + r * 0.05) * S]; g.strokeStyle = ctx.colors.c1; g.beginPath(); g.moveTo(scx, scy); g.lineTo(scx, scy + 40); g.stroke(); g.fillStyle = ctx.colors.c1; g.fillText('cast shadow', scx + 6, scy + 44);
      }
    }
    cv.onResize(draw);
    const move = (e) => {
      const r = cv.el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5; const y = (e.clientY - r.top) / r.height - 0.46;
      const m = Math.hypot(x, y) || 1; const k = Math.min(1, m * 3); L = { x: (x / m) * k, y: (y / m) * k, z: 0.35 + (1 - k) * 0.8 }; draw();
    };
    let down = false; cv.el.style.touchAction = 'none';
    cv.el.addEventListener('pointerdown', (e) => { down = true; cv.el.setPointerCapture(e.pointerId); move(e); }, { signal: ctx.signal });
    cv.el.addEventListener('pointermove', (e) => { if (down) move(e); }, { signal: ctx.signal });
    cv.el.addEventListener('pointerup', () => { down = false; }, { signal: ctx.signal });
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Drawing shadows</h2>'),
      ctx.h('<p class="lede">Every round object under one light shows the same five zones. Learn them on a sphere and you can shade anything.</p>'),
      ctx.h('<div class="card try"><p>Drag anywhere to move the lamp. Watch the highlight follow it, the core shadow wrap the far side, and the cast shadow stretch away.</p></div>'),
      ctx.seg([['0', 'Smooth'], ['5', '5 values'], ['3', '3 values']], '0', (v) => { steps = +v; draw(); }),
      ctx.slider({ label: 'Bounce light from the table', min: 0, max: 0.6, step: 0.01, value: bounce, onInput: (v) => { bounce = v; draw(); } }),
      ctx.seg([['on', 'Labels on'], ['off', 'Labels off']], 'on', (v) => { labels = v === 'on'; draw(); }),
      ctx.h('<div class="card tip"><p><b>Highlight</b>: the light source reflected. <b>Light side</b>: faces the lamp. <b>Core shadow</b>: the darkest band on the form, where it turns away from the light. <b>Reflected light</b>: a soft glow in the shadow from light bouncing off the table. It is never as bright as the light side. <b>Cast shadow</b>: on the table, darkest right under the object (the occlusion shadow) and softer further away.</p></div>'),
      ctx.h('<details class="more"><summary>Going deeper</summary><div><p>Squinting or using 3 to 5 value steps is how artists plan a drawing: get the big light and shadow shapes right first, details later. The edge between light and shadow is the terminator; soft lights make it soft, small hard lights make it sharp.</p><p>This demo uses Lambert diffuse shading (brightness follows the angle to the light) plus a specular term, the same basics used in 3D renderers.</p></div></details>'),
    );
    ctx.quiz([
      { q: 'Where is the darkest part of the object itself?', choices: ['The highlight', 'The core shadow', 'The reflected light'], answer: 1, why: 'The core shadow sits where the form turns away from the light, before bounce light lifts it.' },
      { q: 'Should reflected light be as bright as the light side?', choices: ['Yes', 'No, it stays darker', 'It does not exist'], answer: 1, why: 'Bounce light is weak, so it must stay within the shadow values.' },
      { q: 'Moving the lamp to the left makes the cast shadow go...', choices: ['Left', 'Right', 'Nowhere'], answer: 1, why: 'Cast shadows fall away from the light.' },
    ]);
  },
};
