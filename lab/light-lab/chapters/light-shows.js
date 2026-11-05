// Light shows: moving-head beams through haze, mixed additively, with patterns and colour chases.
export default {
  mount(ctx) {
    const cv = ctx.canvas(); const g = cv.ctx;
    let n = 6; let haze = 0.55; let pattern = 'fan'; let speed = 1; let colourMode = 'chase';
    const PAL = [[255, 40, 90], [40, 200, 255], [130, 60, 255], [255, 190, 40], [60, 255, 160]];
    ctx.loop((t) => {
      const { w, h } = cv; if (!w) return;
      g.globalCompositeOperation = 'source-over'; g.fillStyle = '#030306'; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      const T = t * speed;
      for (let i = 0; i < n; i++) {
        const x0 = w * (0.12 + 0.76 * (n === 1 ? 0.5 : i / (n - 1))); const y0 = h * 0.96;
        let a;
        if (pattern === 'fan') a = -Math.PI / 2 + Math.sin(T * 1.2) * 0.6 * ((i / Math.max(1, n - 1)) - 0.5) * 2;
        else if (pattern === 'wave') a = -Math.PI / 2 + Math.sin(T * 2 + i * 0.8) * 0.45;
        else a = -Math.PI / 2 + Math.sin(T * 1.6 + (i % 2) * Math.PI) * 0.5;
        const col = colourMode === 'white' ? [255, 245, 230] : PAL[(colourMode === 'chase' ? i + Math.floor(T * 2) : i) % PAL.length];
        const len = h * 1.25; const x1 = x0 + Math.cos(a) * len; const y1 = y0 + Math.sin(a) * len; const spread = 0.05;
        const grd = g.createLinearGradient(x0, y0, x1, y1);
        grd.addColorStop(0, `rgba(${col},${0.55 * haze + 0.25})`); grd.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = grd; g.beginPath(); g.moveTo(x0, y0);
        g.lineTo(x0 + Math.cos(a - spread) * len, y0 + Math.sin(a - spread) * len); g.lineTo(x0 + Math.cos(a + spread) * len, y0 + Math.sin(a + spread) * len); g.closePath(); g.fill();
        g.fillStyle = `rgba(${col},0.9)`; g.beginPath(); g.arc(x0, y0, 6, 0, Math.PI * 2); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    });
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Light shows</h2>'),
      ctx.h('<p class="lede">A beam of light is invisible in clean air. Concerts fill the room with haze so you can see the light itself, then move and colour it in time.</p>'),
      ctx.slider({ label: 'Haze', min: 0, max: 1, step: 0.01, value: haze, onInput: (v) => { haze = v; } }),
      ctx.slider({ label: 'Fixtures', min: 1, max: 12, step: 1, value: n, onInput: (v) => { n = v; } }),
      ctx.slider({ label: 'Speed', min: 0, max: 3, step: 0.05, value: speed, onInput: (v) => { speed = v; } }),
      ctx.seg([['fan', 'Fan'], ['wave', 'Wave'], ['cross', 'Cross']], 'fan', (v) => { pattern = v; }),
      ctx.seg([['chase', 'Colour chase'], ['fixed', 'Fixed colours'], ['white', 'White']], 'chase', (v) => { colourMode = v; }),
      ctx.h('<div class="card tip"><p>You only see a beam when something in the air scatters the light toward your eyes: haze, fog or dust. Turn haze to zero and the beams almost vanish. Where beams cross, their colours add, just like the spotlights in the first chapter.</p><p>Shows are built from <b>fixtures</b> (moving heads, washes, lasers) that a lighting console moves through <b>cues</b>: patterns like fans and waves, colour chases and strobes, often locked to the music tempo.</p></div>'),
      ctx.h('<details class="more"><summary>Going deeper</summary><div><p>Most fixtures speak DMX512, a simple protocol where each light listens to a block of channels for pan, tilt, colour, gobo and intensity. Lasers are a separate world with strict safety rules because a direct beam can damage eyes.</p><p>Visible beams rely on scattering: tiny haze droplets scatter light in every direction, and smaller particles scatter blue more strongly (Rayleigh scattering), the same reason the sky is blue.</p></div></details>'),
    );
    ctx.quiz([
      { q: 'Why do concerts use haze?', choices: ['To cool the stage', 'So light scatters and beams become visible', 'To change the colour'], answer: 1, why: 'Without particles to scatter it, a beam passes through clean air unseen.' },
      { q: 'Two coloured beams crossing make...', choices: ['A darker colour', 'An added, brighter colour', 'No change'], answer: 1, why: 'Light mixes additively.' },
      { q: 'What does a lighting console send to moving heads?', choices: ['Audio', 'Control data like DMX for pan, tilt and colour', 'Video only'], answer: 1, why: 'DMX channels tell each fixture where to point and what to show.' },
    ]);
  },
};
