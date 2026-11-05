// Projection mapping: draw content onto the faces of a box using perspective (homography) warps, and show keystone distortion.
function homography(src, dst) {
  // Solve the 3x3 projective transform mapping 4 src points to 4 dst points (h33 = 1)
  const A = []; const b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]; const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
  }
  return b.map((v, i) => v / A[i][i]).concat(1);
}
export default {
  mount(ctx) {
    const cv = ctx.canvas(); const g = cv.ctx;
    let content = 'grid'; let mapped = true; let keystone = 0.35;
    const tex = document.createElement('canvas'); tex.width = tex.height = 256; const tg = tex.getContext('2d');
    function paintTex(t) {
      tg.fillStyle = '#0a0812'; tg.fillRect(0, 0, 256, 256);
      if (content === 'grid') { tg.strokeStyle = '#5EEAD4'; tg.lineWidth = 3; for (let i = 0; i <= 8; i++) { tg.beginPath(); tg.moveTo(i * 32, 0); tg.lineTo(i * 32, 256); tg.stroke(); tg.beginPath(); tg.moveTo(0, i * 32); tg.lineTo(256, i * 32); tg.stroke(); } }
      else if (content === 'waves') { for (let y = 0; y < 256; y += 8) { tg.fillStyle = `hsl(${(y + t * 80) % 360},80%,60%)`; tg.fillRect(0, y + Math.sin(t * 2 + y * 0.05) * 4, 256, 4); } }
      else { const r = 40 + (Math.sin(t * 3) + 1) * 60; const grd = tg.createRadialGradient(128, 128, 0, 128, 128, r); grd.addColorStop(0, '#fff'); grd.addColorStop(0.4, '#ec4899'); grd.addColorStop(1, 'rgba(124,58,237,0)'); tg.fillStyle = grd; tg.fillRect(0, 0, 256, 256); }
    }
    // Draw tex into quad q (TL, TR, BR, BL) by warping through small triangles of the homography
    function drawQuad(q) {
      const H = homography([[0, 0], [256, 0], [256, 256], [0, 256]], q);
      const map = (x, y) => { const d = H[6] * x + H[7] * y + 1; return [(H[0] * x + H[1] * y + H[2]) / d, (H[3] * x + H[4] * y + H[5]) / d]; };
      const N = 8; const s = 256 / N;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const u0 = i * s; const v0 = j * s; const u1 = u0 + s; const v1 = v0 + s;
        tri([u0, v0], [u1, v0], [u1, v1], map); tri([u0, v0], [u1, v1], [u0, v1], map);
      }
    }
    function tri(a, b, c, map) {
      const [x0, y0] = map(...a); const [x1, y1] = map(...b); const [x2, y2] = map(...c);
      g.save(); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.closePath();
      g.lineWidth = 0.8; g.clip();
      const den = (a[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (a[1] - c[1]);
      const m11 = ((x0 - x2) * (b[1] - c[1]) - (x1 - x2) * (a[1] - c[1])) / den;
      const m12 = ((y0 - y2) * (b[1] - c[1]) - (y1 - y2) * (a[1] - c[1])) / den;
      const m21 = ((x1 - x2) * (a[0] - c[0]) - (x0 - x2) * (b[0] - c[0])) / den;
      const m22 = ((y1 - y2) * (a[0] - c[0]) - (y0 - y2) * (b[0] - c[0])) / den;
      const dx = x2 - m11 * c[0] - m21 * c[1]; const dy = y2 - m12 * c[0] - m22 * c[1];
      g.transform(m11, m12, m21, m22, dx, dy); g.drawImage(tex, 0, 0); g.restore();
    }
    ctx.loop((t) => {
      const { w, h } = cv; if (!w) return;
      g.fillStyle = '#121016'; g.fillRect(0, 0, w, h);
      paintTex(t);
      const cx = w * 0.5; const cy = h * 0.55; const s = Math.min(w, h) * 0.24;
      // an isometric box: top, left and right faces
      const top = [[cx, cy - s * 1.1], [cx + s, cy - s * 0.55], [cx, cy], [cx - s, cy - s * 0.55]];
      const left = [[cx - s, cy - s * 0.55], [cx, cy], [cx, cy + s * 1.05], [cx - s, cy + s * 0.5]];
      const right = [[cx, cy], [cx + s, cy - s * 0.55], [cx + s, cy + s * 0.5], [cx, cy + s * 1.05]];
      for (const [q, shade] of [[top, '#2a2733'], [left, '#1d1b24'], [right, '#24212c']]) { g.fillStyle = shade; g.beginPath(); q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); }
      if (mapped) { drawQuad(top); drawQuad(left); drawQuad(right); }
      else {
        // unmapped: one flat image from a projector off to the side, stretched by keystone
        const k = keystone; const W = s * 2.6; const Hh = s * 2.2; const x0 = cx - W / 2; const y0 = cy - Hh / 2;
        const q = [[x0 + W * k * 0.3, y0], [x0 + W - W * k * 0.3, y0], [x0 + W + W * k * 0.15, y0 + Hh], [x0 - W * k * 0.15, y0 + Hh]];
        g.globalAlpha = 0.85; drawQuad(q); g.globalAlpha = 1;
      }
      g.font = '500 11px "DM Mono", monospace'; g.fillStyle = ctx.colors.muted;
      g.fillText(mapped ? 'mapped: each face gets its own warped image' : 'not mapped: one image, keystoned, spills over the edges', 16, h - 18);
    });
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Projection mapping</h2>'),
      ctx.h('<p class="lede">Point a projector at a building or a box and the picture smears across it. Projection mapping warps the image so it fits every surface exactly.</p>'),
      ctx.seg([['on', 'Mapped'], ['off', 'Plain projector']], 'on', (v) => { mapped = v === 'on'; }),
      ctx.seg([['grid', 'Grid'], ['waves', 'Colour waves'], ['pulse', 'Pulse']], 'grid', (v) => { content = v; }),
      ctx.slider({ label: 'Keystone (projector off axis)', min: 0, max: 0.8, step: 0.01, value: keystone, onInput: (v) => { keystone = v; } }),
      ctx.h('<div class="card tip"><p>A projector throws a rectangle. If it is not pointed straight at a flat wall, the rectangle lands as a trapezoid: that is <b>keystone</b> distortion. Projectors fix it by pre-warping the image the opposite way.</p><p>Mapping takes that idea further. You mark the corners of every surface, the software works out a perspective warp for each one, and the content lands exactly on each face. That is how a building facade appears to crumble or a box seems to glow from inside.</p></div>'),
      ctx.h('<div class="card try"><p>Switch to Plain projector and raise the keystone: the grid stretches and spills off the box. Switch back to Mapped: the same grid now sits neatly on each face.</p></div>'),
      ctx.h('<details class="more"><summary>Going deeper</summary><div><p>Each face uses a homography: a 3x3 matrix that maps any four corner points to any other four, which is exactly what a flat surface viewed in perspective needs. This demo solves it from the corners and draws the image through small triangles.</p><p>Real shows also blend several projectors with soft edges, match brightness and colour, and use a 3D model of the building so animation can follow its windows and ledges.</p></div></details>'),
    );
    ctx.quiz([
      { q: 'What is keystone distortion?', choices: ['A colour shift', 'An off-axis projector making a rectangle land as a trapezoid', 'Flicker'], answer: 1, why: 'Tilting the projector stretches one side of the image.' },
      { q: 'How many corner points define the warp for one flat surface?', choices: ['Two', 'Three', 'Four'], answer: 2, why: 'A homography is fixed by four point pairs.' },
      { q: 'Why map each face separately?', choices: ['Each face sits at a different angle, so each needs its own warp', 'To save power', 'Projectors need it'], answer: 0, why: 'Different planes need different perspective transforms.' },
    ]);
  },
};
