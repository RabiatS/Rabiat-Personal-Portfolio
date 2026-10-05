// The portrait sample: a pretend webcam for when there is no camera, or you
// would rather not use it. My portrait, softened like a webcam image and
// grainy like a sensor, with the skin of the face darkening very slightly
// with each beat of a pulse painted in at a known rate, the way blood does.
// It draws into a canvas, and the page reads it through captureStream()
// exactly as it reads a real camera, so it runs the same code path end to end.
// It holds still on purpose: in testing, even a gentle sway or a slow change
// of light made the reading wander on a painting, where real skin copes.

const W = 480, H = 480;
// The face in samples/portrait.jpg (600 x 600): centre and radii.
const FACE = { x: 302, y: 325, rx: 140, ry: 170 };
// How skin's colour moves with blood volume: green most, then blue, then red
// (the "PBV" direction from the rPPG literature), as a fraction of the green change.
const PBV = [0.43, 1, 0.69];
const AMP = 0.02; // from trough to peak, green darkens by 2%

// A little heart-rate variability around the painted rate.
export const beatsPerSecond = (bpm, t) => (bpm / 60) * (1 + 0.02 * Math.sin(2 * Math.PI * 0.1 * t));

// One heartbeat, 0 to 1: mostly the fundamental with a little second
// harmonic, like a pulse wave seen through skin (a spikier shape puts so much
// into the second harmonic that the spectrum reads double).
function beat(phase) {
  const s = Math.sin(2 * Math.PI * phase) + 0.25 * Math.sin(4 * Math.PI * phase + 0.8);
  return (s + 1.25) / 2.5;
}

// The drawing itself: paint(phase) draws a frame with the heartbeat at phase
// (0 to 1). Kept apart from the clock so a test can step it.
// noise scales the grain (1 is strong), amp is the depth of the pulse, soften
// a blur in pixels. The defaults are the page's: the painted rate reads back
// within a beat or two for a minute and more (tested at 60 to 86 a minute).
export async function portraitPainter(src, { noise = 0.3, amp = AMP, soften = 1.2 } = {}) {
  const img = new Image();
  await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; img.src = src; });
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const iw = img.naturalWidth, ih = img.naturalHeight;
  // Softened a little, as a webcam's lens would: crisp linework sliding
  // across the pixel grid flickers, and that flicker reads like a pulse.
  const soft = document.createElement('canvas');
  soft.width = iw; soft.height = ih;
  const softCtx = soft.getContext('2d');
  if (soften) softCtx.filter = `blur(${soften}px)`;
  softCtx.drawImage(img, 0, 0);

  // The skin layer: face pixels inside a soft ellipse, leaving out the dark
  // linework and the brightest highlights, filled with the colour that
  // multiplies skin down along the PBV direction.
  const skin = document.createElement('canvas');
  skin.width = iw; skin.height = ih;
  const sctx = skin.getContext('2d', { willReadFrequently: true });
  sctx.drawImage(img, 0, 0);
  const d = sctx.getImageData(0, 0, iw, ih);
  const tint = PBV.map((k) => Math.round(255 * (1 - 0.5 * k)));
  for (let y = 0, i = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++, i += 4) {
      const e = ((x - FACE.x) / FACE.rx) ** 2 + ((y - FACE.y) / FACE.ry) ** 2;
      const lum = (0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]) / 255;
      const inside = Math.max(0, Math.min(1, (1 - e) / 0.15));
      const keep = lum > 0.16 && lum < 0.82 ? 1 : 0;
      d.data[i] = tint[0]; d.data[i + 1] = tint[1]; d.data[i + 2] = tint[2];
      d.data[i + 3] = Math.round(255 * inside * keep);
    }
  }
  sctx.putImageData(d, 0, 0);

  // Sensor noise: a few tiles of faint speckle, a different one every frame.
  const tiles = Array.from({ length: 4 }, () => {
    const t = document.createElement('canvas');
    t.width = t.height = 160;
    const c = t.getContext('2d');
    const n = c.createImageData(160, 160);
    for (let i = 0; i < n.data.length; i += 4) {
      const v = Math.random() < 0.5 ? 0 : 255;
      n.data[i] = n.data[i + 1] = n.data[i + 2] = v;
      n.data[i + 3] = Math.round(Math.random() * 16 * noise);
    }
    c.putImageData(n, 0, 0);
    return t;
  });

  let frames = 0;
  function paint(phase) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);
    const s = (W / iw) * 1.04;
    ctx.translate(W / 2, H / 2);
    ctx.scale(s, s);
    ctx.translate(-iw / 2, -ih / 2);
    ctx.drawImage(soft, 0, 0);
    // the pulse: multiply the skin down a little with each beat
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = Math.min(1, 2 * amp * beat(phase));
    ctx.drawImage(skin, 0, 0);
    ctx.restore();

    // sensor grain
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (!noise) return;
    const tile = tiles[frames++ % tiles.length];
    const ox = -Math.floor(Math.random() * 160), oy = -Math.floor(Math.random() * 160);
    for (let y = oy; y < H; y += 160) for (let x = ox; x < W; x += 160) ctx.drawImage(tile, x, y);
  }
  return { canvas, paint };
}

// The pretend webcam: the painter on the real clock, as a camera-like stream.
export async function paintedPortrait(src, bpm) {
  const { canvas, paint } = await portraitPainter(src);
  const t0 = performance.now();
  let phase = 0, last = t0, raf = 0;
  function draw(now) {
    raf = requestAnimationFrame(draw);
    const t = (now - t0) / 1000;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    phase = (phase + beatsPerSecond(bpm, t) * dt) % 1;
    paint(phase);
  }
  draw(t0);
  const stream = canvas.captureStream(30);
  return {
    stream, bpm,
    stop() { cancelAnimationFrame(raf); stream.getTracks().forEach((tr) => tr.stop()); },
  };
}
