// Decision trees: grow a tree of yes/no questions by greedy Gini splits, one split at a time.

const MONO = '500 11px "DM Mono", ui-monospace, monospace';
const MONO_S = '500 10px "DM Mono", ui-monospace, monospace';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function gauss() { let u = 0; let v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FEAT = ['x', 'y'];

function makeData(kind) {
  const pts = [];
  if (kind === 'xor') {
    for (let i = 0; i < 64; i++) {
      const x = 0.04 + Math.random() * 0.92; const y = 0.04 + Math.random() * 0.92;
      let c = (x < 0.5) === (y < 0.5) ? 0 : 1; if (Math.random() < 0.06) c = 1 - c;
      pts.push({ x, y, c });
    }
  } else if (kind === 'diag') {
    for (let i = 0; i < 60; i++) {
      const x = 0.04 + Math.random() * 0.92; const y = 0.04 + Math.random() * 0.92;
      pts.push({ x, y, c: y > x + gauss() * 0.06 ? 1 : 0 });
    }
  } else {
    const cs = [[0.27, 0.7], [0.72, 0.68], [0.5, 0.25]];
    cs.forEach(([cx, cy], c) => { for (let i = 0; i < 20; i++) pts.push({ x: clamp(cx + gauss() * 0.15, 0.02, 0.98), y: clamp(cy + gauss() * 0.15, 0.02, 0.98), c }); });
  }
  return pts;
}

function counts(pts, idx) { const c = [0, 0, 0]; for (const i of idx) c[pts[i].c]++; return c; }
function gini(c) { const n = c[0] + c[1] + c[2]; if (!n) return 0; return 1 - (c[0] / n) ** 2 - (c[1] / n) ** 2 - (c[2] / n) ** 2; }
const argmax = (c) => (c[0] >= c[1] && c[0] >= c[2] ? 0 : c[1] >= c[2] ? 1 : 2);

// Scan every threshold on one feature. Returns the curve of weighted Gini and the best cut.
function scan(pts, idx, f) {
  const key = f ? 'y' : 'x';
  const s = [...idx].sort((a, b) => pts[a][key] - pts[b][key]);
  const left = [0, 0, 0]; const right = counts(pts, idx); const n = s.length;
  const curve = []; let best = null;
  for (let i = 0; i < n - 1; i++) {
    const c = pts[s[i]].c; left[c]++; right[c]--;
    const a = pts[s[i]][key]; const b = pts[s[i + 1]][key];
    if (b - a < 1e-9) continue;
    const t = (a + b) / 2; const wg = ((i + 1) * gini(left) + (n - i - 1) * gini(right)) / n;
    curve.push([t, wg]);
    if (!best || wg < best.wg - 1e-12) best = { f, t, wg };
  }
  return { curve, best };
}

function build(pts, maxDepth) {
  const nodes = [];
  const root = { idx: pts.map((_, i) => i), depth: 0, region: [0, 1, 0, 1] };
  const queue = [root];
  while (queue.length) {
    const nd = queue.shift(); nodes.push(nd);
    nd.counts = counts(pts, nd.idx); nd.gini = gini(nd.counts); nd.cls = argmax(nd.counts);
    if (nd.depth >= maxDepth || nd.gini < 1e-9 || nd.idx.length < 2) continue;
    const sx = scan(pts, nd.idx, 0); const sy = scan(pts, nd.idx, 1);
    let best = sx.best; if (sy.best && (!best || sy.best.wg < best.wg - 1e-12)) best = sy.best;
    if (!best || nd.gini - best.wg < 1e-6) continue;
    nd.split = best; nd.scans = [sx.curve, sy.curve];
    const key = best.f ? 'y' : 'x';
    const [x0, x1, y0, y1] = nd.region;
    nd.left = { idx: nd.idx.filter((i) => pts[i][key] < best.t), depth: nd.depth + 1, region: best.f ? [x0, x1, y0, best.t] : [x0, best.t, y0, y1], parent: nd };
    nd.right = { idx: nd.idx.filter((i) => pts[i][key] >= best.t), depth: nd.depth + 1, region: best.f ? [x0, x1, best.t, y1] : [best.t, x1, y0, y1], parent: nd };
    queue.push(nd.left, nd.right);
  }
  // order internal nodes breadth first, so "next split" grows the tree level by level
  let k = 0; for (const nd of nodes) if (nd.split) nd.order = k++;
  return { root, nodes, splits: k };
}

export default {
  mount(ctx) {
    const C = ctx.colors; const COLS = [C.c1, C.c2, C.c3];
    const cv = ctx.canvas({ style: 'touch-action:none;cursor:crosshair' });
    const g = cv.ctx;
    let pts = makeData('blobs');
    let maxDepth = 4; let tree = build(pts, maxDepth); let shown = 0; let anim = 1; let addC = 0;
    let L = {};

    cv.onResize((W, H) => {
      const bottom = 56; const Hs = H - bottom;
      if (W > Hs * 1.25) {
        const s = Math.min(Hs - 26, W * 0.56);
        L.p = { x: 30, y: 4, s };
        L.t = { x: s + 56, y: 10, w: W - s - 64, h: Hs - 20 };
      } else {
        const s = Math.min(W - 40, Hs * 0.56);
        L.p = { x: (W - s) / 2 + 8, y: 2, s };
        L.t = { x: 4, y: s + 30, w: W - 8, h: Hs - s - 34 };
      }
    });
    const px = (x) => L.p.x + x * L.p.s; const py = (y) => L.p.y + (1 - y) * L.p.s;

    // ----- panel -----
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Decision trees</h2>'),
      ctx.h('<p class="lede">A decision tree is a game of twenty questions learned from data. Each question splits the examples in two, chosen to make each side as pure as possible.</p>'),
    );
    const depthS = ctx.slider({ label: 'Maximum depth', min: 0, max: 6, step: 1, value: maxDepth, fmt: (v) => String(v), onInput: (v) => { maxDepth = v; rebuild(true); } });
    ctx.panel.append(depthS);
    const btns = ctx.h('<div class="row"><button class="btn sm" data-a="next">Next split</button><button class="btn ghost sm" data-a="all">Grow all</button><button class="btn ghost sm" data-a="restart">Start over</button></div>');
    ctx.panel.append(btns);
    btns.querySelector('[data-a="next"]').onclick = () => { if (shown < tree.splits) { shown++; anim = 0; } sync(); };
    btns.querySelector('[data-a="all"]').onclick = () => { shown = tree.splits; anim = 0; sync(); };
    btns.querySelector('[data-a="restart"]').onclick = () => { shown = 0; anim = 1; sync(); };
    const addSeg = ctx.seg([['0', '+ Teal'], ['1', '+ Amber'], ['2', '+ Violet']], '0', (v) => { addC = +v; });
    ctx.panel.append(ctx.h('<p class="hint">Tap the plot to add a dot of:</p>'), addSeg);
    const info = ctx.h('<div class="formula" style="font-size:12.5px"></div>');
    ctx.panel.append(info);
    const scanWrap = ctx.h('<div style="position:relative;height:130px;border:1px solid var(--border);border-radius:10px;background:rgba(10,10,10,.45)"></div>');
    ctx.panel.append(scanWrap);
    const sc = ctx.canvas({ parent: scanWrap });
    const stats = ctx.h('<div class="stat"><div><b data-s="sp">0</b><span>Splits</span></div><div><b data-s="lv">1</b><span>Leaves</span></div><div><b data-s="acc">0</b><span>Train accuracy</span></div></div>');
    ctx.panel.append(stats);
    const st = (k) => stats.querySelector(`[data-s="${k}"]`);

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>To grow the tree, the computer tries every possible question of the form "is x less than some number?" or "is y less than some number?". For each one it checks how mixed the two resulting groups are, and keeps the question that leaves them least mixed.</p>
      <p>Then it repeats the same thing inside each group, and again, until the groups are pure or the tree hits its depth limit. To classify a new point you just answer the questions from the top down until you reach a leaf.</p>
      <p>That is why the boundaries on the plot are always made of straight horizontal and vertical pieces.</p>
    </div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li>Press <b>Next split</b> a few times and watch the plot and the tree grow together.</li>
      <li>The small chart shows how mixed the groups would be for every possible cut. The chosen split sits at the lowest point.</li>
      <li>Press <b>Diagonal</b>. A slanted boundary needs a staircase of many splits.</li>
      <li>Press <b>XOR</b>. No single first cut helps much, so the greedy first split looks almost random. Then set depth to 6: the tree carves tiny boxes around single noisy dots. That is overfitting.</li>
    </ol></div>`));
    ctx.panel.append(ctx.h(`<div class="card deep">
      <p><b>Gini impurity</b> of a group is the chance that two items picked at random (with replacement) have different labels:</p>
      <div class="formula">Gini = 1 − Σ pₖ²<span>0 means pure. Two equal classes give 0.5, three give 0.667.</span></div>
      <p>A split is scored by the Gini of each side, weighted by its size. The tree is <b>greedy</b>: it takes the best split right now, never looking ahead, which is fast but not always the best tree overall. Entropy (information gain) is a common alternative to Gini and usually picks similar splits.</p>
      <p>A single deep tree overfits easily. That is why the strongest tabular methods combine many trees: <b>random forests</b> average hundreds of trees trained on random subsets, and <b>gradient boosted trees</b> (XGBoost, LightGBM) add small trees one at a time, each fixing the last one's mistakes.</p>
    </div>`));
    ctx.quiz([
      { q: 'How does a tree choose each question?', choices: ['At random', 'It tries the possible cuts and keeps the one that leaves the two sides least mixed', 'It always splits exactly in the middle'], answer: 1, why: 'It scores every cut by the weighted impurity of the two sides and picks the lowest.' },
      { q: 'Why are the coloured regions always made of rectangles?', choices: ['Each question tests a single feature against a number, which is a horizontal or vertical cut', 'Because the screen is rectangular', 'Because the data was rectangular'], answer: 0, why: '"x < 0.4" is a vertical line, "y < 0.7" a horizontal one. Stack enough and you get boxes.' },
      { q: 'A very deep tree gets 100% accuracy on its training data. Is that good?', choices: ['Yes, it is perfect', 'Not necessarily: it may have memorised noise and do worse on new data', 'It means the data is too easy'], answer: 1, why: 'A tree can keep splitting until every training dot sits in its own box. That is memorising, not learning.' },
    ]);

    // ----- dock -----
    const dock = ctx.h('<div class="dock"><div class="grp glass"><button data-p="blobs">Blobs</button><button data-p="xor">XOR</button><button data-p="diag">Diagonal</button><button data-p="clear">Clear</button></div></div>');
    ctx.stage.append(dock);
    dock.querySelectorAll('[data-p]').forEach((b) => { b.onclick = () => { pts = b.dataset.p === 'clear' ? [] : makeData(b.dataset.p); rebuild(false); shown = 0; sync(); }; });

    function rebuild(showAll) { tree = build(pts, maxDepth); shown = showAll ? tree.splits : Math.min(shown, tree.splits); anim = 1; sync(); }
    cv.el.addEventListener('pointerdown', (e) => {
      const r = cv.el.getBoundingClientRect(); const x = (e.clientX - r.left - L.p.x) / L.p.s; const y = 1 - (e.clientY - r.top - L.p.y) / L.p.s;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      pts.push({ x, y, c: addC }); rebuild(true);
    }, { signal: ctx.signal });

    const isOpen = (nd) => nd.split && nd.order < shown; // split is revealed
    function leaves() { const out = []; const walk = (nd) => { if (isOpen(nd)) { walk(nd.left); walk(nd.right); } else out.push(nd); }; walk(tree.root); return out; }
    const latest = () => tree.nodes.find((nd) => nd.split && nd.order === shown - 1) || null;
    const nextNode = () => tree.nodes.find((nd) => nd.split && nd.order === shown) || null;

    function sync() {
      const lv = leaves();
      let right = 0; for (const nd of lv) right += nd.counts[nd.cls];
      st('sp').textContent = `${shown}/${tree.splits}`; st('lv').textContent = lv.length;
      st('acc').textContent = pts.length ? `${Math.round(right / pts.length * 100)}%` : '-';
      const nd = latest();
      if (!pts.length) info.innerHTML = 'No data. Tap the plot or pick a dataset.';
      else if (!nd) {
        const nx = nextNode();
        info.innerHTML = `Root: ${pts.length} dots, Gini ${tree.root.gini.toFixed(3)}.<span>${nx ? `Best first question: ${FEAT[nx.split.f]} &lt; ${nx.split.t.toFixed(2)}. Press Next split.` : 'Nothing to split: the data is already pure or the depth is 0.'}</span>`;
      } else {
        const l = nd.left; const r = nd.right;
        info.innerHTML = `Latest: ${FEAT[nd.split.f]} &lt; ${nd.split.t.toFixed(2)} ?<br>Gini ${nd.gini.toFixed(3)} → ${nd.split.wg.toFixed(3)} (weighted)<span>yes: ${l.idx.length} dots, Gini ${l.gini.toFixed(2)}. no: ${r.idx.length} dots, Gini ${r.gini.toFixed(2)}.</span>`;
      }
      btns.querySelector('[data-a="next"]').disabled = shown >= tree.splits;
      drawScan();
    }

    function drawScan() {
      const q = sc.ctx; const W = sc.w; const H = sc.h; if (!W) return;
      q.clearRect(0, 0, W, H);
      const nd = latest() || nextNode();
      const Lx = 30; const R = W - 10; const T = 22; const B = H - 20;
      q.font = MONO; q.textBaseline = 'top'; q.textAlign = 'left'; q.fillStyle = C.muted;
      if (!nd) { q.fillText('no split to show', Lx, H / 2 - 6); return; }
      q.fillText(`mixedness after each possible cut (${nd === latest() ? 'latest' : 'next'} split)`, 8, 5);
      const gx = (t) => Lx + t * (R - Lx); const gy = (v) => B - v / 0.7 * (B - T);
      q.strokeStyle = C.borderStrong; q.lineWidth = 1; q.beginPath(); q.moveTo(Lx, T); q.lineTo(Lx, B); q.lineTo(R, B); q.stroke();
      q.fillText('0', Lx - 12, B - 6); q.textAlign = 'right'; q.fillText('cut position 0 to 1', R, B + 5);
      const cl = [C.c5, C.c4];
      nd.scans.forEach((curve, f) => {
        q.strokeStyle = cl[f]; q.lineWidth = 1.6; q.beginPath();
        curve.forEach(([t, v], i) => { if (i) q.lineTo(gx(t), gy(v)); else q.moveTo(gx(t), gy(v)); });
        q.stroke();
      });
      q.fillStyle = C.c5; q.textAlign = 'left'; q.fillText('cut on x', Lx + 4, B + 5);
      q.fillStyle = C.c4; q.fillText('cut on y', Lx + 74, B + 5);
      const b = nd.split; q.beginPath(); q.arc(gx(b.t), gy(b.wg), 4.5, 0, 6.283); q.fillStyle = C.text; q.fill();
      q.setLineDash([3, 4]); q.strokeStyle = 'rgba(255,255,255,0.3)'; q.beginPath(); q.moveTo(Lx, gy(nd.gini)); q.lineTo(R, gy(nd.gini)); q.stroke(); q.setLineDash([]);
      q.fillStyle = C.muted; q.textAlign = 'right'; q.textBaseline = 'bottom'; q.fillText('before', R, gy(nd.gini) - 2);
    }

    // tree layout of the revealed part
    function layoutTree() {
      let leafI = 0; let maxD = 0;
      const walk = (nd) => {
        maxD = Math.max(maxD, nd.depth);
        if (isOpen(nd)) { walk(nd.left); walk(nd.right); nd._x = (nd.left._x + nd.right._x) / 2; } else { nd._x = leafI++; }
      };
      walk(tree.root);
      return { nLeaves: leafI, maxD };
    }

    sc.onResize(() => drawScan());
    sync();
    ctx.loop((t, dt) => {
      anim = RM ? 1 : Math.min(1, anim + dt * 2.2);
      const { w: W, h: H } = cv; g.clearRect(0, 0, W, H);
      if (!L.p) return;
      const S = L.p.s;
      // regions
      const lv = leaves(); const newest = latest();
      for (const nd of lv) {
        const [x0, x1, y0, y1] = nd.region;
        g.fillStyle = nd.idx.length ? rgba(COLS[nd.cls], 0.13 + 0.12 * (1 - nd.gini * 1.5)) : 'rgba(255,255,255,0.02)';
        g.fillRect(px(x0), py(y1), (x1 - x0) * S, (y1 - y0) * S);
      }
      g.strokeStyle = C.borderStrong; g.lineWidth = 1; g.strokeRect(L.p.x + 0.5, L.p.y + 0.5, S - 1, S - 1);
      // split lines
      for (const nd of tree.nodes) {
        if (!isOpen(nd)) continue;
        const [x0, x1, y0, y1] = nd.region; const f = nd.split.f; const tt = nd.split.t;
        const k = nd === newest ? anim : 1;
        g.strokeStyle = nd === newest ? C.text : 'rgba(245,245,240,0.6)'; g.lineWidth = nd === newest ? 2.2 : 1.3;
        g.beginPath();
        if (f === 0) { const m = (y0 + y1) / 2; const hh = (y1 - y0) / 2 * k; g.moveTo(px(tt), py(m - hh)); g.lineTo(px(tt), py(m + hh)); }
        else { const m = (x0 + x1) / 2; const hw = (x1 - x0) / 2 * k; g.moveTo(px(m - hw), py(tt)); g.lineTo(px(m + hw), py(tt)); }
        g.stroke();
      }
      // dots
      for (const p of pts) { g.beginPath(); g.arc(px(p.x), py(p.y), 4.5, 0, 6.283); g.fillStyle = COLS[p.c]; g.fill(); g.lineWidth = 1.5; g.strokeStyle = C.bg; g.stroke(); }
      g.font = MONO; g.fillStyle = C.muted; g.textAlign = 'center'; g.textBaseline = 'top';
      g.fillText('x', L.p.x + S / 2, L.p.y + S + 5); g.fillText('0', L.p.x, L.p.y + S + 5); g.fillText('1', L.p.x + S, L.p.y + S + 5);
      g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText('y', L.p.x - 8, L.p.y + S / 2); g.fillText('1', L.p.x - 8, L.p.y + 6);

      // tree diagram
      const T = L.t; const { nLeaves, maxD } = layoutTree();
      const colW = T.w / Math.max(1, nLeaves); const rowH = Math.min(78, T.h / (maxD + 1));
      const compact = colW < 64 || rowH < 40;
      const nx = (nd) => T.x + (nd._x + 0.5) * colW; const ny = (nd) => T.y + 14 + nd.depth * rowH;
      g.lineWidth = 1.2;
      const edges = (nd) => {
        if (!isOpen(nd)) return;
        for (const [ch, lab] of [[nd.left, 'yes'], [nd.right, 'no']]) {
          const k = nd === newest ? anim : 1;
          const x1 = nx(nd); const y1 = ny(nd); const x2 = x1 + (nx(ch) - x1) * k; const y2 = y1 + (ny(ch) - y1) * k;
          g.strokeStyle = 'rgba(245,245,240,0.35)'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
          if (!compact && k === 1) { g.font = MONO_S; g.fillStyle = C.subtle; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lab, (x1 + x2) / 2 + (lab === 'yes' ? -10 : 10), (y1 + y2) / 2); }
          edges(ch);
        }
      };
      edges(tree.root);
      const drawNode = (nd) => {
        const X = nx(nd); const Y = ny(nd);
        if (newest && (nd.parent === newest) && anim < 1) { g.globalAlpha = anim; }
        if (isOpen(nd)) {
          const txt = `${FEAT[nd.split.f]} < ${nd.split.t.toFixed(2)}`;
          if (compact) { g.beginPath(); g.arc(X, Y, 5, 0, 6.283); g.fillStyle = C.surface2; g.fill(); g.strokeStyle = nd === newest ? C.text : C.borderStrong; g.lineWidth = 1.5; g.stroke(); }
          else {
            g.font = MONO; const tw = g.measureText(txt).width + 14;
            g.fillStyle = C.surface2; g.strokeStyle = nd === newest ? C.text : C.borderStrong; g.lineWidth = 1.2;
            g.beginPath(); g.roundRect(X - tw / 2, Y - 11, tw, 22, 6); g.fill(); g.stroke();
            g.fillStyle = C.text; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, X, Y + 0.5);
          }
          g.globalAlpha = 1;
          drawNode(nd.left); drawNode(nd.right);
        } else {
          const n = nd.idx.length || 1; const bw = compact ? Math.max(8, Math.min(colW - 4, 22)) : Math.min(colW - 10, 64); const bh = compact ? 8 : 10;
          let xx = X - bw / 2;
          for (let c = 0; c < 3; c++) { const ww = bw * nd.counts[c] / n; g.fillStyle = COLS[c]; g.fillRect(xx, Y - bh / 2, ww, bh); xx += ww; }
          g.strokeStyle = C.bg; g.lineWidth = 1; g.strokeRect(X - bw / 2, Y - bh / 2, bw, bh);
          if (!compact) { g.font = MONO_S; g.fillStyle = C.muted; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(nd.counts.filter((v) => v).length > 1 ? nd.counts.join('/') : `${n}`, X, Y + 8); }
          g.globalAlpha = 1;
        }
      };
      drawNode(tree.root);
      g.font = MONO; g.fillStyle = C.muted; g.textAlign = 'left'; g.textBaseline = 'top';
      if (T.h > 220) g.fillText('the tree (left branch = yes)', T.x, T.y + T.h - 14);
    });
  },
};
