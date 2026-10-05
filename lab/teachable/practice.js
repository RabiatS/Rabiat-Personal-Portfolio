// The practice camera: a pretend webcam for when there is no camera, or you
// would rather not use it. Someone sits in a room and holds up whatever you
// pick; the light drifts, they sway, the hand wobbles, so no two frames are
// the same. It draws into a canvas, and the page reads frames from it exactly
// as it reads them from a real camera.

export const PROPS = [
  { key: 'thumb', label: 'Thumbs up', glyph: '👍' },
  { key: 'hand', label: 'Open hand', glyph: '✋' },
  { key: 'none', label: 'Nothing', glyph: '' },
];

const SIZE = 448;
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export function practiceCamera(canvas) {
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const grain = noise(128);
  let want = PROPS[0], held = PROPS[0], lift = 0, raf = 0, t0 = performance.now(), last = 0;

  function draw(now) {
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    // Lower what is held, swap, raise the new one.
    if (held !== want) { lift = Math.max(0, lift - dt * 4); if (lift === 0) held = want; }
    else lift = Math.min(1, lift + dt * 3);

    // the room: a wall whose light drifts between warm and cool
    const warm = 0.5 + 0.5 * Math.sin(t * 0.21), bright = 0.85 + 0.15 * Math.sin(t * 0.37 + 1);
    const wall = ctx.createLinearGradient(0, 0, 0, SIZE);
    wall.addColorStop(0, rgb(70 + 18 * warm, 66 + 4 * warm, 64 - 8 * warm, bright));
    wall.addColorStop(1, rgb(38 + 8 * warm, 36, 38 - 4 * warm, bright));
    ctx.fillStyle = wall; ctx.fillRect(0, 0, SIZE, SIZE);
    const wx = 90 + 40 * Math.sin(t * 0.13), win = ctx.createRadialGradient(wx, 70, 10, wx, 70, 260);
    win.addColorStop(0, `rgba(255,248,230,${0.22 * bright})`); win.addColorStop(1, 'rgba(255,248,230,0)');
    ctx.fillStyle = win; ctx.fillRect(0, 0, SIZE, SIZE);
    // a shelf line behind them
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, 150, SIZE, 6);

    // them: head and shoulders, swaying a little
    const sx = SIZE / 2 + 10 * Math.sin(t * 0.7) + 4 * Math.sin(t * 2.3), sy = 8 * Math.sin(t * 0.5);
    ctx.fillStyle = '#1d1c1f';
    ctx.beginPath(); ctx.ellipse(sx, 470 + sy, 190, 150, 0, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sx, 205 + sy, 62, 78, 0.04 * Math.sin(t), 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(sx - 26, 260 + sy, 52, 70);
    ctx.strokeStyle = `rgba(255,240,220,${0.12 * bright})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(sx, 205 + sy, 62, 78, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();

    // what they hold up
    if (held.glyph && lift > 0) {
      const e = 1 - Math.pow(1 - lift, 3);
      const x = 300 + 18 * Math.sin(t * 0.9) + 6 * Math.sin(t * 3.1);
      const y = 520 - e * (270 - 14 * Math.sin(t * 1.3));
      const size = 150 * (1 + 0.1 * Math.sin(t * 0.8 + 2));
      ctx.save();
      ctx.translate(x, y); ctx.rotate(0.16 * Math.sin(t * 1.1) - 0.05);
      ctx.font = `${size}px ${EMOJI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      ctx.fillText(held.glyph, 0, 0);
      ctx.restore();
    }

    // camera: grain and a soft vignette
    ctx.globalAlpha = 0.07;
    const gx = Math.floor(Math.random() * 128), gy = Math.floor(Math.random() * 128);
    for (let y = -gy; y < SIZE; y += 128) for (let x = -gx; x < SIZE; x += 128) ctx.drawImage(grain, x, y);
    ctx.globalAlpha = 1;
    const v = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.35, SIZE / 2, SIZE / 2, SIZE * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, SIZE, SIZE);
  }

  function frame(now) { draw(now); raf = requestAnimationFrame(frame); }
  return {
    canvas,
    start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } draw(performance.now()); },
    stop() { cancelAnimationFrame(raf); raf = 0; },
    hold(key) { want = PROPS.find((p) => p.key === key) || PROPS[2]; },
    get holding() { return want.key; },
    // Draws a fresh frame now, so a frame read straight after is current
    // even when the page is in the background and animation frames pause.
    tick() { draw(performance.now()); },
  };
}

function noise(n) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

const rgb = (r, g, b, k = 1) => `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
