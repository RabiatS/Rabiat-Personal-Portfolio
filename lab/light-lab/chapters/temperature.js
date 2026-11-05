// Colour temperature: a simple still life lit by a lamp from 1800 K to 10000 K, with an optional cool fill in the shadows.
function kelvin(k) {
  // Tanner Helland's fit of blackbody colour, good enough for teaching
  const t = k / 100; let r; let g; let b;
  r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v) => Math.max(0, Math.min(255, v)) / 255;
  return [c(r), c(g), c(b)];
}
export default {
  mount(ctx) {
    const cv = ctx.canvas(); const g = cv.ctx;
    let K = 3200; let fill = true; let balance = false;
    function draw() {
      const { w, h } = cv; const L = kelvin(K); const F = kelvin(9000);
      const wb = balance ? L.map((v) => 1 / Math.max(0.2, v)) : [1, 1, 1];
      const norm = Math.max(...wb); const wbn = wb.map((v) => v / norm);
      const shade = (base, lit) => base.map((b, i) => Math.round(255 * Math.min(1, b * (lit * L[i] + (fill ? 0.22 * F[i] : 0.05)) * wbn[i] * (balance ? 1.25 : 1))));
      const wall = [0.82, 0.8, 0.76]; const table = [0.55, 0.4, 0.3]; const ball = [0.9, 0.88, 0.86];
      const sky = g.createLinearGradient(0, 0, 0, h * 0.62); sky.addColorStop(0, `rgb(${shade(wall, 0.55)})`); sky.addColorStop(1, `rgb(${shade(wall, 0.9)})`);
      g.fillStyle = sky; g.fillRect(0, 0, w, h * 0.62);
      g.fillStyle = `rgb(${shade(table, 0.85)})`; g.fillRect(0, h * 0.62, w, h);
      const cx = w * 0.5; const cy = h * 0.5; const r = Math.min(w, h) * 0.16;
      // cast shadow (filled by the cool fill only)
      g.fillStyle = `rgb(${shade(table, 0.12)})`; g.beginPath(); g.ellipse(cx + r * 0.9, cy + r * 0.95, r * 1.15, r * 0.28, 0, 0, Math.PI * 2); g.fill();
      const grd = g.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.05, cx, cy, r * 1.05);
      grd.addColorStop(0, `rgb(${shade(ball, 1.15)})`); grd.addColorStop(0.55, `rgb(${shade(ball, 0.6)})`); grd.addColorStop(1, `rgb(${shade(ball, 0.08)})`);
      g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = `rgb(${L.map((v) => Math.round(v * 255))})`; g.beginPath(); g.arc(w * 0.18, h * 0.16, 16, 0, Math.PI * 2); g.fill();
      g.font = '500 11px "DM Mono", monospace'; g.fillStyle = 'rgba(0,0,0,.65)'; g.fillText(`lamp ${K} K`, w * 0.18 + 24, h * 0.16 + 4);
    }
    cv.onResize(draw);
    const label = (k) => k < 2500 ? 'candle' : k < 3500 ? 'warm bulb' : k < 5000 ? 'neutral' : k < 6500 ? 'daylight' : 'overcast or shade';
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Warm and cool light</h2>'),
      ctx.h('<p class="lede">"White" light comes in many colours. A candle is orange, noon sun is neutral, open shade is blue. Painters use that to set a mood.</p>'),
      ctx.slider({ label: 'Lamp colour temperature', min: 1800, max: 10000, step: 100, value: K, fmt: (v) => `${v} K, ${label(v)}`, onInput: (v) => { K = v; draw(); } }),
      ctx.seg([['on', 'Cool sky fill on'], ['off', 'Fill off']], 'on', (v) => { fill = v === 'on'; draw(); }),
      ctx.seg([['off', 'Camera as is'], ['on', 'White balance']], 'off', (v) => { balance = v === 'on'; draw(); }),
      ctx.h('<div class="card tip"><p>Colour temperature is measured in kelvin. Low numbers are warm (orange), high numbers are cool (blue), a little backwards from how we talk about heat.</p><p>A classic rule for painting outdoors: <b>warm light, cool shadows</b>. The sun lights the form warmly, while the shadow side is lit only by the blue sky. Indoors under warm lamps the shadows often look cooler too, which is the fill you can toggle here.</p></div>'),
      ctx.h('<div class="card try"><p>Set the lamp to 2700 K with the fill on: warm ball, bluish shadow. Turn on white balance: the camera cancels the lamp colour, which is why photos under bulbs can look flat.</p></div>'),
      ctx.h('<details class="more"><summary>Going deeper</summary><div><p>The kelvin scale comes from blackbody radiation: an ideal object glows red, then orange, white and blue as it gets hotter. Typical values: candle about 1900 K, household bulb 2700 to 3000 K, noon daylight about 5500 K, overcast sky 6500 to 7500 K.</p><p>LEDs and fluorescents are not blackbodies, so the CRI (colour rendering index) tells you how faithfully they show colours.</p></div></details>'),
    );
    ctx.quiz([
      { q: 'Which is warmer looking light?', choices: ['2700 K', '6500 K', '9000 K'], answer: 0, why: 'Lower kelvin is warmer and more orange.' },
      { q: 'Outdoors on a sunny day, shadows usually look...', choices: ['Warmer than the light', 'Cooler, lit by the blue sky', 'Pure black'], answer: 1, why: 'Shadows are filled by skylight, which is blue.' },
      { q: 'What does white balance do?', choices: ['Makes the light brighter', 'Cancels the colour of the light so whites look white', 'Adds contrast'], answer: 1, why: 'It scales the colour channels so the light source reads as neutral.' },
    ]);
  },
};
