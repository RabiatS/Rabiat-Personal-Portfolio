// Nearest neighbours: classify a point by asking the k closest labelled examples to vote.

const MONO = '500 11px "DM Mono", ui-monospace, monospace';
function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(hex, a) { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; }
function gauss() { let u = 0; let v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const NAMES = ['teal', 'amber', 'violet'];

function makeData(kind) {
  const centres = [[-0.45, 0.35], [0.45, 0.4], [0.02, -0.45]];
  const pts = [];
  centres.forEach(([cx, cy], c) => {
    for (let i = 0; i < 16; i++) pts.push({ x: clamp(cx + gauss() * 0.24, -0.97, 0.97), y: clamp(cy + gauss() * 0.24, -0.97, 0.97), c });
  });
  if (kind === 'noisy') {
    // a few stray points with the "wrong" label inside other groups, like typos in real data
    for (let i = 0; i < 7; i++) {
      const home = i % 3; const c = (home + 1 + (i % 2)) % 3; const [cx, cy] = centres[home];
      pts.push({ x: clamp(cx + gauss() * 0.15, -0.97, 0.97), y: clamp(cy + gauss() * 0.15, -0.97, 0.97), c });
    }
  }
  return pts;
}

export default {
  mount(ctx) {
    const C = ctx.colors;
    const COLS = [C.c1, C.c2, C.c3]; const RGB = COLS.map(rgb);
    const cv = ctx.canvas({ style: 'touch-action:none' });
    const g = cv.ctx;
    let pts = makeData('noisy');
    let q = { x: 0.05, y: 0.12 };
    let k = 5; let metric = 'euclid'; let paint = false; let tapMode = 'query';
    let drag = null; let outside = false; let dirty = true;
    let P = { cx: 0, cy: 0, s: 1 };
    const GRID = 150; const map = document.createElement('canvas'); map.width = GRID; map.height = GRID;
    const mg = map.getContext('2d'); const mimg = mg.createImageData(GRID, GRID);

    cv.onResize((W, H) => {
      const pad = 14; const bottom = 58;
      const s = Math.max(20, Math.min(W - pad * 2, H - pad - bottom) / 2);
      P = { cx: W / 2, cy: pad + s, s };
    });
    const sx = (x) => P.cx + x * P.s; const sy = (y) => P.cy - y * P.s;
    const ix = (px) => (px - P.cx) / P.s; const iy = (py) => (P.cy - py) / P.s;
    const dist = (ax, ay, bx, by) => (metric === 'euclid' ? Math.hypot(ax - bx, ay - by) : Math.abs(ax - bx) + Math.abs(ay - by));

    // k nearest of (x, y), and the vote. Ties go to the class with the closer neighbours.
    function classify(x, y, kk, withList) {
      const n = pts.length; if (!n) return { cls: -1, votes: [0, 0, 0], list: [] };
      const ds = new Array(n);
      for (let i = 0; i < n; i++) ds[i] = [dist(x, y, pts[i].x, pts[i].y), i];
      const kk2 = Math.min(kk, n);
      // partial selection sort is fine for a few dozen points
      for (let a = 0; a < kk2; a++) { let m = a; for (let b = a + 1; b < n; b++) if (ds[b][0] < ds[m][0]) m = b; const t = ds[a]; ds[a] = ds[m]; ds[m] = t; }
      const votes = [0, 0, 0]; const tb = [0, 0, 0];
      for (let a = 0; a < kk2; a++) { const c = pts[ds[a][1]].c; votes[c]++; tb[c] += kk2 - a; }
      let cls = 0; for (let c = 1; c < 3; c++) if (votes[c] > votes[cls] || (votes[c] === votes[cls] && tb[c] > tb[cls])) cls = c;
      return { cls, votes, list: withList ? ds.slice(0, kk2) : null };
    }
    function buildMap() {
      const d = mimg.data;
      for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
        const r = classify(-1 + (i + 0.5) / GRID * 2, 1 - (j + 0.5) / GRID * 2, k, false);
        const o = (j * GRID + i) * 4;
        if (r.cls < 0) { d[o + 3] = 0; continue; }
        const conf = r.votes[r.cls] / Math.min(k, pts.length);
        const [R, G, B] = RGB[r.cls]; d[o] = R; d[o + 1] = G; d[o + 2] = B; d[o + 3] = 40 + conf * 55;
      }
      mg.putImageData(mimg, 0, 0);
    }

    // ----- panel -----
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Nearest neighbours</h2>'),
      ctx.h('<p class="lede">The simplest learner of all: to label something new, find the k most similar examples you have already seen and let them vote.</p>'),
    );
    const kS = ctx.slider({ label: 'k (how many neighbours vote)', min: 1, max: 25, step: 1, value: k, fmt: (v) => String(v), onInput: (v) => { k = v; dirty = true; } });
    ctx.panel.append(kS);
    const tapSeg = ctx.seg([['query', 'Tap moves ?'], ['0', '+ Teal'], ['1', '+ Amber'], ['2', '+ Violet']], 'query', (v) => { tapMode = v; });
    ctx.panel.append(ctx.h('<p class="hint">What a tap on empty space does:</p>'), tapSeg);
    const metSeg = ctx.seg([['euclid', 'Straight line distance'], ['manhattan', 'City block distance']], 'euclid', (v) => { metric = v; dirty = true; });
    ctx.panel.append(metSeg);
    const tally = ctx.h(`<div class="card" style="gap:6px">
      ${[0, 1, 2].map((c) => `<div style="display:grid;grid-template-columns:62px 1fr 26px;gap:8px;align-items:center;font:500 12px var(--f-mono)"><span style="color:${COLS[c]}">${NAMES[c]}</span><div style="height:10px;background:var(--surface-2);border-radius:5px;overflow:hidden"><i data-b="${c}" style="display:block;height:100%;width:0;background:${COLS[c]};border-radius:5px;transition:width .2s"></i></div><b data-v="${c}" style="text-align:right">0</b></div>`).join('')}
      <p class="small" data-out style="margin-top:2px"></p></div>`);
    ctx.panel.append(tally);

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>There is no training step at all. The model <i>is</i> the data. When the question mark lands somewhere, it measures the distance to every labelled dot, picks the <b>k</b> closest, and goes with the majority.</p>
      <p>The single setting that matters is <b>k</b>. With k = 1 the model copies its one nearest neighbour, so a single mislabelled dot carves out its own little island. With a large k many voices average out the noise, but small real groups get outvoted.</p>
    </div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li>Drag the <b>?</b> around. The lines show who is voting, the ring shows how far you had to reach.</li>
      <li>Press <b>Paint map</b> to colour every spot by how it would be classified.</li>
      <li>Set k to 1. See the jagged islands around the stray dots? Now slide k up to 15 and watch them melt away.</li>
      <li>Drag a dot off the plot to delete it, or add your own with the buttons above.</li>
    </ol></div>`));
    ctx.panel.append(ctx.h(`<div class="card deep">
      <p>kNN is called a <b>lazy</b> or <b>instance based</b> learner: it stores the training set and does all the work at prediction time. Predicting means comparing against every stored example, so on big datasets people use index structures (k-d trees, or approximate nearest neighbour search) to find neighbours fast. The same search powers vector databases and retrieval for chatbots.</p>
      <p>Choice of distance changes the shape of "nearby": straight line (Euclidean) distance gives a circle, city block (Manhattan) distance gives a diamond. Features must be on comparable scales, or the one measured in the biggest numbers dominates the distance.</p>
      <p>Small k means low bias and high variance (a wiggly boundary that follows the noise). Large k means higher bias and lower variance (a smooth boundary that can miss detail). Choosing k well is exactly the trade off in the Overfitting chapter. An odd k avoids some ties with two classes. With many input dimensions, distances become less meaningful, often called the curse of dimensionality.</p>
    </div>`));
    ctx.quiz([
      { q: 'How does kNN "train"?', choices: ['It runs gradient descent', 'It just stores the labelled examples', 'It builds a tree of questions'], answer: 1, why: 'All the work happens when you ask for a prediction: find the closest stored examples and count their labels.' },
      { q: 'With k = 1, one mislabelled dot sits inside another group. What does the map show?', choices: ['Nothing changes', 'A small island of the wrong colour around that dot', 'The whole map turns that colour'], answer: 1, why: 'Every spot whose single nearest neighbour is that dot copies its label, so it gets its own island.' },
      { q: 'What usually happens as k grows very large?', choices: ['The boundary gets smoother, and eventually the biggest class wins everywhere', 'The boundary gets more jagged', 'Predictions get faster'], answer: 0, why: 'More voters average out noise. If k equals all the data, every point gets the majority label.' },
    ]);

    // ----- dock -----
    const dock = ctx.h('<div class="dock"><div class="grp glass"><button data-a="paint">Paint map</button></div><div class="grp glass"><button data-p="blobs">Clean</button><button data-p="noisy">Noisy</button><button data-p="clear">Clear</button></div></div>');
    ctx.stage.append(dock);
    const paintBtn = dock.querySelector('[data-a="paint"]');
    paintBtn.onclick = () => { paint = !paint; paintBtn.classList.toggle('on', paint); dirty = true; };
    dock.querySelectorAll('[data-p]').forEach((b) => { b.onclick = () => { pts = b.dataset.p === 'clear' ? [] : makeData(b.dataset.p); dirty = true; }; });

    // ----- pointer -----
    const pos = (e) => { const r = cv.el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.el.addEventListener('pointerdown', (e) => {
      const [px, py] = pos(e); const touch = e.pointerType === 'touch';
      const x = ix(px); const y = iy(py);
      if (Math.hypot(sx(q.x) - px, sy(q.y) - py) < (touch ? 30 : 20)) { drag = 'q'; }
      else {
        let bi = -1; let bd = (touch ? 22 : 13) ** 2;
        pts.forEach((p, i) => { const d = (sx(p.x) - px) ** 2 + (sy(p.y) - py) ** 2; if (d < bd) { bd = d; bi = i; } });
        if (bi >= 0) drag = bi;
        else if (Math.abs(x) <= 1 && Math.abs(y) <= 1) {
          if (tapMode === 'query') { q = { x, y }; drag = 'q'; } else { pts.push({ x, y, c: +tapMode }); drag = pts.length - 1; dirty = true; }
        } else return;
      }
      outside = false; cv.el.setPointerCapture(e.pointerId);
    }, { signal: ctx.signal });
    cv.el.addEventListener('pointermove', (e) => {
      const [px, py] = pos(e);
      if (drag == null) {
        const near = Math.hypot(sx(q.x) - px, sy(q.y) - py) < 20;
        cv.el.style.cursor = near ? 'grab' : 'crosshair'; return;
      }
      const x = ix(px); const y = iy(py);
      if (drag === 'q') { q = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) }; return; }
      outside = Math.abs(x) > 1.08 || Math.abs(y) > 1.08;
      pts[drag].x = clamp(x, -1.1, 1.1); pts[drag].y = clamp(y, -1.1, 1.1); dirty = true;
    }, { signal: ctx.signal });
    const up = () => { if (typeof drag === 'number' && outside) { pts.splice(drag, 1); dirty = true; } drag = null; outside = false; };
    cv.el.addEventListener('pointerup', up, { signal: ctx.signal });
    cv.el.addEventListener('pointercancel', up, { signal: ctx.signal });

    let lastT = '';
    ctx.loop((t) => {
      const { w: W, h: H } = cv; g.clearRect(0, 0, W, H);
      const X0 = sx(-1); const Y0 = sy(1); const S2 = P.s * 2;
      g.fillStyle = 'rgba(255,255,255,0.015)'; g.fillRect(X0, Y0, S2, S2);
      if (paint) { if (dirty) { buildMap(); } g.imageSmoothingEnabled = true; g.drawImage(map, X0, Y0, S2, S2); }
      dirty = false;
      g.strokeStyle = C.borderStrong; g.lineWidth = 1; g.strokeRect(X0 + 0.5, Y0 + 0.5, S2 - 1, S2 - 1);

      const r = classify(q.x, q.y, k, true);
      const kk = r.list.length;
      const qX = sx(q.x); const qY = sy(q.y);
      // reach ring (circle or diamond)
      if (kk) {
        const rad = r.list[kk - 1][0] * P.s;
        g.save(); g.beginPath(); g.rect(X0, Y0, S2, S2); g.clip();
        g.setLineDash([4, 5]); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
        g.beginPath();
        if (metric === 'euclid') g.arc(qX, qY, rad, 0, 6.283);
        else { g.moveTo(qX + rad, qY); g.lineTo(qX, qY + rad); g.lineTo(qX - rad, qY); g.lineTo(qX, qY - rad); g.closePath(); }
        g.stroke(); g.setLineDash([]); g.restore();
        // lines to neighbours
        for (const [, i] of r.list) {
          const p = pts[i];
          g.strokeStyle = rgba(COLS[p.c], 0.7); g.lineWidth = 1.4;
          g.beginPath();
          if (metric === 'euclid') { g.moveTo(qX, qY); g.lineTo(sx(p.x), sy(p.y)); } else { g.moveTo(qX, qY); g.lineTo(sx(p.x), qY); g.lineTo(sx(p.x), sy(p.y)); }
          g.stroke();
        }
      }
      // points
      const near = new Set(r.list.map((d) => d[1]));
      pts.forEach((p, i) => {
        const X = sx(p.x); const Y = sy(p.y);
        if (near.has(i)) { g.beginPath(); g.arc(X, Y, 10, 0, 6.283); g.strokeStyle = rgba(COLS[p.c], 0.9); g.lineWidth = 1.5; g.stroke(); }
        g.beginPath(); g.arc(X, Y, 5.5, 0, 6.283); g.fillStyle = (drag === i && outside) ? C.c4 : COLS[p.c]; g.fill();
        g.lineWidth = 2; g.strokeStyle = C.bg; g.stroke();
      });
      // the query
      const pulse = 1 + 0.08 * Math.sin(t * 3);
      g.beginPath(); g.arc(qX, qY, 13 * pulse, 0, 6.283);
      g.fillStyle = r.cls >= 0 ? rgba(COLS[r.cls], 0.25) : 'rgba(255,255,255,0.1)'; g.fill();
      g.lineWidth = 2.5; g.strokeStyle = r.cls >= 0 ? COLS[r.cls] : C.text; g.stroke();
      g.font = '700 15px Rajdhani, sans-serif'; g.fillStyle = C.text; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', qX, qY + 1);
      // vote chip next to the query
      if (kk) {
        const txt = r.votes.map((v, c) => (v ? `${v} ${NAMES[c]}` : '')).filter(Boolean).join('  ');
        g.font = MONO; const tw = g.measureText(txt).width + 14;
        let bx = qX + 20; if (bx + tw > X0 + S2 - 4) bx = qX - 20 - tw;
        const by = clamp(qY - 34, Y0 + 4, Y0 + S2 - 26);
        g.fillStyle = 'rgba(20,20,20,0.9)'; g.beginPath(); g.roundRect(bx, by, tw, 22, 6); g.fill();
        g.strokeStyle = C.borderStrong; g.lineWidth = 1; g.stroke();
        g.fillStyle = C.text; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(txt, bx + 7, by + 11);
      }
      if (drag != null && outside) { g.font = MONO; g.fillStyle = C.c4; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText('release to delete', P.cx, Y0 + 8); }
      g.font = MONO; g.fillStyle = C.muted; g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillText(`k = ${k}`, X0 + 8, Y0 + 8);

      const s = `${r.votes.join()}|${r.cls}|${k}`;
      if (s !== lastT) {
        lastT = s;
        for (let c = 0; c < 3; c++) {
          tally.querySelector(`[data-b="${c}"]`).style.width = `${kk ? (r.votes[c] / kk) * 100 : 0}%`;
          tally.querySelector(`[data-v="${c}"]`).textContent = r.votes[c];
        }
        const sorted = [...r.votes].sort((a, b) => b - a);
        tally.querySelector('[data-out]').innerHTML = r.cls < 0 ? 'Add some dots first.'
          : `Prediction: <b style="color:${COLS[r.cls]}">${NAMES[r.cls]}</b>${sorted[0] === sorted[1] ? ' (a tie, broken by who is closer)' : ''}, ${r.votes[r.cls]} of ${kk} votes.`;
      }
    });
  },
};
