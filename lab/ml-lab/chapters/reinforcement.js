// Reinforcement learning: tabular Q-learning with an epsilon-greedy agent in an editable gridworld.
const MONO = '500 11px "DM Mono", monospace';
const COLS = 9; const ROWS = 7;
const EMPTY = 0; const WALL = 1; const PIT = 2; const GOAL = 3;
const DX = [0, 1, 0, -1]; const DY = [-1, 0, 1, 0]; // up, right, down, left
const STEP_R = -0.01; const MAX_STEPS = 120;

function defaultMap() {
  const m = new Uint8Array(COLS * ROWS);
  const set = (x, y, v) => { m[y * COLS + x] = v; };
  [[2, 1], [2, 2], [2, 3], [2, 4], [5, 2], [5, 3], [5, 4], [5, 5], [6, 2], [7, 4]].forEach(([x, y]) => set(x, y, WALL));
  [[3, 4], [4, 1], [7, 5], [8, 2]].forEach(([x, y]) => set(x, y, PIT));
  set(8, 0, GOAL);
  return m;
}

export default {
  mount(ctx) {
    const C0 = ctx.colors;
    const cv = ctx.canvas(); const g = cv.ctx;
    let map = defaultMap(); let start = [0, 6];
    let Q = new Float32Array(COLS * ROWS * 4);
    let eps = 0.2; let alpha = 0.5; let gamma = 0.9; let speed = 'medium';
    let playing = false; let tool = 'wall';
    let ax = start[0]; let ay = start[1]; let dispX = ax; let dispY = ay;
    let epR = 0; let epSteps = 0; let episodes = 0; let totalSteps = 0;
    let rewards = []; let outcomes = []; let trail = [[ax, ay]]; let acc = 0;

    const cell = (x, y) => map[y * COLS + x];
    const qi = (x, y, a) => (y * COLS + x) * 4 + a;
    const maxQ = (x, y) => Math.max(Q[qi(x, y, 0)], Q[qi(x, y, 1)], Q[qi(x, y, 2)], Q[qi(x, y, 3)]);
    function argmax(x, y) {
      let best = -Infinity; const ties = [];
      for (let a = 0; a < 4; a++) { const v = Q[qi(x, y, a)]; if (v > best + 1e-9) { best = v; ties.length = 0; ties.push(a); } else if (Math.abs(v - best) <= 1e-9) ties.push(a); }
      return ties[Math.floor(Math.random() * ties.length)];
    }

    function resetAgent() { ax = start[0]; ay = start[1]; dispX = ax; dispY = ay; epR = 0; epSteps = 0; trail = [[ax, ay]]; }

    function envStep() {
      const a = Math.random() < eps ? Math.floor(Math.random() * 4) : argmax(ax, ay);
      let nx = ax + DX[a]; let ny = ay + DY[a];
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || cell(nx, ny) === WALL) { nx = ax; ny = ay; }
      const c = cell(nx, ny);
      const r = c === GOAL ? 1 : c === PIT ? -1 : STEP_R;
      const done = c === GOAL || c === PIT;
      // Q-learning: move Q(s,a) toward r + gamma * max_a' Q(s',a')
      const target = r + (done ? 0 : gamma * maxQ(nx, ny));
      const k = qi(ax, ay, a); Q[k] += alpha * (target - Q[k]);
      ax = nx; ay = ny; epR += r; epSteps++; totalSteps++;
      trail.push([ax, ay]); if (trail.length > 60) trail.shift();
      if (done || epSteps >= MAX_STEPS) {
        episodes++; rewards.push(epR); outcomes.push(c === GOAL ? 1 : 0);
        if (rewards.length > 400) { rewards.shift(); outcomes.shift(); }
        resetAgent(); return true;
      }
      return false;
    }

    // ---------- layout ----------
    let LY = null;
    cv.onResize((W, H) => {
      const s = Math.floor(Math.min((W - 8) / COLS, (H - 50 - 28) / ROWS));
      LY = { s, x: Math.round((W - s * COLS) / 2), y: Math.max(22, Math.round((H - 50 - s * ROWS) / 2) + 6) };
    });

    function qColor(v, a = 1) {
      const t = Math.max(-1, Math.min(1, v));
      const c = t >= 0 ? [94, 234, 212] : [251, 113, 133];
      return `rgba(${c[0]},${c[1]},${c[2]},${Math.abs(t) * 0.75 * a})`;
    }

    function draw() {
      if (!LY || !cv.w) return;
      g.clearRect(0, 0, cv.w, cv.h);
      const { s, x: X0, y: Y0 } = LY;
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const px = X0 + x * s; const py = Y0 + y * s; const c = cell(x, y);
        g.fillStyle = '#121212'; g.fillRect(px, py, s, s);
        if (c === WALL) { g.fillStyle = '#3A3A38'; g.fillRect(px + 1, py + 1, s - 2, s - 2); continue; }
        if (c === GOAL || c === PIT) {
          g.fillStyle = c === GOAL ? 'rgba(163,230,53,.22)' : 'rgba(251,113,133,.18)'; g.fillRect(px + 1, py + 1, s - 2, s - 2);
          g.fillStyle = c === GOAL ? C0.c6 : C0.c4; g.font = `700 ${Math.max(11, s * 0.24)}px Rajdhani, sans-serif`; g.textAlign = 'center';
          g.fillText(c === GOAL ? '+1' : '−1', px + s / 2, py + s / 2 + s * 0.08);
          g.font = MONO; g.fillText(c === GOAL ? 'goal' : 'pit', px + s / 2, py + s - 6);
          continue;
        }
        // four wedges, one per action
        const cx = px + s / 2; const cy = py + s / 2;
        const corners = [[px, py], [px + s, py], [px + s, py + s], [px, py + s]];
        for (let a = 0; a < 4; a++) {
          const p1 = corners[a === 0 ? 0 : a === 1 ? 1 : a === 2 ? 2 : 3]; const p2 = corners[(a === 0 ? 1 : a === 1 ? 2 : a === 2 ? 3 : 0)];
          g.fillStyle = qColor(Q[qi(x, y, a)]); g.beginPath(); g.moveTo(cx, cy); g.lineTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.closePath(); g.fill();
        }
        g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, py); g.lineTo(px + s, py + s); g.moveTo(px + s, py); g.lineTo(px, py + s); g.stroke();
        // greedy arrow
        const m = maxQ(x, y);
        if (Math.abs(m) > 1e-4 || Q[qi(x, y, 0)] !== Q[qi(x, y, 1)]) {
          let a = 0; for (let k = 1; k < 4; k++) if (Q[qi(x, y, k)] > Q[qi(x, y, a)]) a = k;
          const L = s * 0.26; const ex = cx + DX[a] * L; const ey = cy + DY[a] * L;
          g.strokeStyle = 'rgba(245,245,240,.85)'; g.fillStyle = 'rgba(245,245,240,.85)'; g.lineWidth = Math.max(1.2, s / 40);
          g.beginPath(); g.moveTo(cx - DX[a] * L * 0.6, cy - DY[a] * L * 0.6); g.lineTo(ex, ey); g.stroke();
          const ang = Math.atan2(DY[a], DX[a]); const hs = Math.max(4, s * 0.09);
          g.beginPath(); g.moveTo(ex + Math.cos(ang) * hs * 0.6, ey + Math.sin(ang) * hs * 0.6); g.lineTo(ex - Math.cos(ang - 0.6) * hs, ey - Math.sin(ang - 0.6) * hs); g.lineTo(ex - Math.cos(ang + 0.6) * hs, ey - Math.sin(ang + 0.6) * hs); g.fill();
          if (s >= 56) { g.font = '500 9.5px "DM Mono", monospace'; g.fillStyle = C0.muted; g.textAlign = 'right'; g.fillText(m.toFixed(2), px + s - 4, py + s - 4); }
        }
      }
      // grid lines
      g.strokeStyle = '#2A2A2A'; g.lineWidth = 1; g.beginPath();
      for (let x = 0; x <= COLS; x++) { g.moveTo(X0 + x * s + 0.5, Y0); g.lineTo(X0 + x * s + 0.5, Y0 + ROWS * s); }
      for (let y = 0; y <= ROWS; y++) { g.moveTo(X0, Y0 + y * s + 0.5); g.lineTo(X0 + COLS * s, Y0 + y * s + 0.5); }
      g.stroke();
      // start
      g.strokeStyle = C0.c2; g.lineWidth = 2; g.strokeRect(X0 + start[0] * s + 3, Y0 + start[1] * s + 3, s - 6, s - 6);
      g.font = MONO; g.fillStyle = C0.c2; g.textAlign = 'left'; g.fillText('start', X0 + start[0] * s + 7, Y0 + start[1] * s + 16);
      // greedy path from start
      let gx = start[0]; let gy = start[1]; const seen = new Set();
      g.strokeStyle = 'rgba(251,191,36,.6)'; g.setLineDash([5, 4]); g.lineWidth = 2; g.beginPath(); g.moveTo(X0 + (gx + 0.5) * s, Y0 + (gy + 0.5) * s);
      for (let i = 0; i < 60; i++) {
        if (seen.has(gy * COLS + gx)) break; seen.add(gy * COLS + gx);
        let a = 0; for (let k = 1; k < 4; k++) if (Q[qi(gx, gy, k)] > Q[qi(gx, gy, a)]) a = k;
        if (maxQ(gx, gy) === 0 && Q[qi(gx, gy, 0)] === 0 && Q[qi(gx, gy, 2)] === 0) break;
        const nx = gx + DX[a]; const ny = gy + DY[a];
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || cell(nx, ny) === WALL) break;
        gx = nx; gy = ny; g.lineTo(X0 + (gx + 0.5) * s, Y0 + (gy + 0.5) * s);
        if (cell(gx, gy) === GOAL || cell(gx, gy) === PIT) break;
      }
      g.stroke(); g.setLineDash([]);
      // agent trail and body
      if (speed !== 'turbo') {
        g.strokeStyle = 'rgba(167,139,250,.35)'; g.lineWidth = 2; g.beginPath();
        trail.forEach(([tx, ty], i) => { const px = X0 + (tx + 0.5) * s; const py = Y0 + (ty + 0.5) * s; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
      }
      const px = X0 + (dispX + 0.5) * s; const py = Y0 + (dispY + 0.5) * s;
      g.fillStyle = C0.c3; g.shadowColor = C0.c3; g.shadowBlur = 14; g.beginPath(); g.arc(px, py, s * 0.17, 0, 7); g.fill(); g.shadowBlur = 0;
      g.fillStyle = '#0A0A0A'; g.beginPath(); g.arc(px - s * 0.05, py - s * 0.03, s * 0.03, 0, 7); g.arc(px + s * 0.05, py - s * 0.03, s * 0.03, 0, 7); g.fill();
      g.font = MONO; g.fillStyle = C0.muted; g.textAlign = 'left';
      g.fillText(`episode ${episodes + 1}   step ${epSteps}   reward so far ${epR.toFixed(2)}`, X0, Y0 - 8);
    }

    // ---------- panel ----------
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Learning by reward</h2>'),
      ctx.h('<p class="lede">No examples, no labels. Just an agent, a maze, and a score. By trying things and remembering what paid off, it works out the way to the goal.</p>'),
    );
    const stats = ctx.h('<div class="stat"><div><b class="s-e">0</b><span>Episodes</span></div><div><b class="s-w">-</b><span>Goal rate (last 50)</span></div><div><b class="s-r">-</b><span>Last reward</span></div></div>');
    ctx.panel.append(stats);
    const chartWrap = ctx.h('<div style="position:relative;height:130px"></div>');
    ctx.panel.append(chartWrap, ctx.h('<p class="hint">Total reward per episode (dots) and the average of the last 20 (line). Higher is better, +1 minus a little for each step is the best you can get.</p>'));
    const chart = ctx.canvas({ parent: chartWrap });

    ctx.panel.append(ctx.slider({ label: 'Exploration ε', min: 0, max: 1, step: 0.01, value: eps, onInput: (v) => { eps = v; } }));
    ctx.panel.append(ctx.slider({ label: 'Learning rate α', min: 0.01, max: 1, step: 0.01, value: alpha, onInput: (v) => { alpha = v; } }));
    ctx.panel.append(ctx.slider({ label: 'Discount γ', min: 0, max: 0.99, step: 0.01, value: gamma, onInput: (v) => { gamma = v; } }));
    ctx.panel.append(ctx.h('<p class="hint">Speed</p>'), ctx.seg([['slow', 'Slow'], ['medium', 'Medium'], ['fast', 'Fast'], ['turbo', 'Turbo']], speed, (v) => { speed = v; }));
    const btns = ctx.h('<div class="row"><button class="btn ghost sm b-q">Forget everything</button><button class="btn ghost sm b-m">Reset maze</button></div>');
    btns.querySelector('.b-q').onclick = () => { Q.fill(0); rewards = []; outcomes = []; episodes = 0; totalSteps = 0; resetAgent(); };
    btns.querySelector('.b-m').onclick = () => { map = defaultMap(); start = [0, 6]; Q.fill(0); rewards = []; outcomes = []; episodes = 0; resetAgent(); };
    ctx.panel.append(btns);

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>The agent (violet) can move up, down, left or right. Reaching the goal gives +1, falling in a pit gives −1, and every step costs a tiny bit, so shorter is better.</p>
      <p>It keeps a table of scores called <b>Q values</b>: for every square and every move, "how good is it to make this move from here?" Each little triangle in a square is one move, coloured <span style="color:#5EEAD4">teal</span> when it looks good and <span style="color:#FB7185">rose</span> when it looks bad. The white arrow is its current favourite. The dashed amber line is the route it would take right now.</p>
      <p>Good news spreads backwards: first the square next to the goal learns, then the one before it, and so on.</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li>Press <b>Play</b> on Medium. The first episodes are random wandering. Watch teal creep back from the goal.</li>
      <li>Switch to <b>Turbo</b> for a few seconds, then back to Slow to watch the trained agent.</li>
      <li>Set ε to 0 from the start (press Forget everything). With no exploring it can get stuck repeating its first idea.</li>
      <li>Paint a wall across its favourite route. It has to unlearn and find a new one.</li>
      <li>Set γ near 0. The agent becomes short sighted: only squares right next to the goal learn anything.</li></ol></div>`));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div class="card deep">
      <p>After each move from state s with action a, landing in s′ with reward r, Q-learning updates one number:</p>
      <div class="formula">Q(s,a) ← Q(s,a) + α [ r + γ max<sub>a′</sub> Q(s′,a′) − Q(s,a) ]<span>the bracket is the "temporal difference" error</span></div>
      <p>α is how far to move toward the new estimate. γ discounts the future: a reward n steps away is worth γ<sup>n</sup> of one right now. ε-greedy picks a random move with probability ε, otherwise the best known move. That trade off between exploring and exploiting is at the heart of RL.</p>
      <p>Q-learning is <b>off-policy</b>: it learns the value of acting greedily even while it explores. With enough exploring and a suitable decaying α, tabular Q-learning is proven to converge to the best policy (Watkins and Dayan, 1992).</p>
      <p>A table works for 63 squares. For a video game screen there are far too many states, so DeepMind's DQN (2015) replaced the table with a neural network that reads pixels and outputs Q values, and learned dozens of Atari games. Reinforcement learning from human feedback, used to fine tune chat models, is a different flavour of the same reward idea.</p>
    </div></details>`));

    // ---------- dock: play and editing tools ----------
    const dock = ctx.h(`<div class="dock"><div class="grp glass"><button data-a="play">Play</button><button data-a="step">Step</button></div>
      <div class="grp glass"><span>Paint</span>${[['wall', 'Wall'], ['pit', 'Pit'], ['goal', 'Goal'], ['start', 'Start'], ['erase', 'Erase']].map(([v, l]) => `<button data-t="${v}" class="${v === tool ? 'on' : ''}">${l}</button>`).join('')}</div></div>`);
    ctx.stage.append(dock);
    const playBtn = dock.querySelector('[data-a=play]');
    const syncPlay = () => { playBtn.textContent = playing ? 'Pause' : 'Play'; playBtn.classList.toggle('on', playing); };
    dock.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.a === 'play') { playing = !playing; syncPlay(); }
      if (b.dataset.a === 'step') { playing = false; syncPlay(); envStep(); dispX = ax; dispY = ay; }
      if (b.dataset.t) { tool = b.dataset.t; dock.querySelectorAll('[data-t]').forEach((x) => x.classList.toggle('on', x === b)); }
    }, { signal: ctx.signal });

    // ---------- painting ----------
    cv.el.style.touchAction = 'none';
    let painting = false; let lastCell = -1;
    function paintAt(e) {
      const r = cv.el.getBoundingClientRect(); const { s, x: X0, y: Y0 } = LY;
      const x = Math.floor((e.clientX - r.left - X0) / s); const y = Math.floor((e.clientY - r.top - Y0) / s);
      if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return;
      const id = y * COLS + x; if (id === lastCell) return; lastCell = id;
      if (tool === 'start') { if (cell(x, y) === EMPTY) { start = [x, y]; resetAgent(); } return; }
      if (x === start[0] && y === start[1]) return;
      map[id] = { wall: WALL, pit: PIT, goal: GOAL, erase: EMPTY }[tool];
      for (let a = 0; a < 4; a++) Q[id * 4 + a] = 0;
      if (ax === x && ay === y) resetAgent();
    }
    cv.el.addEventListener('pointerdown', (e) => { if (!LY) return; painting = true; lastCell = -1; cv.el.setPointerCapture(e.pointerId); paintAt(e); }, { signal: ctx.signal });
    cv.el.addEventListener('pointermove', (e) => { if (painting) paintAt(e); }, { signal: ctx.signal });
    const stop = () => { painting = false; };
    cv.el.addEventListener('pointerup', stop, { signal: ctx.signal }); cv.el.addEventListener('pointercancel', stop, { signal: ctx.signal });

    function drawChart() {
      const G = chart.ctx; const W = chart.w; const H = chart.h; if (!W) return;
      G.clearRect(0, 0, W, H);
      const L = 30; const R = W - 6; const T = 6; const B = H - 16;
      const lo = -1.5; const hi = 1;
      const Y = (v) => B - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (B - T);
      G.strokeStyle = C0.border; G.lineWidth = 1; G.beginPath(); G.moveTo(L, T); G.lineTo(L, B); G.lineTo(R, B); G.stroke();
      G.setLineDash([2, 3]); G.beginPath(); G.moveTo(L, Y(0)); G.lineTo(R, Y(0)); G.stroke(); G.setLineDash([]);
      G.font = MONO; G.fillStyle = C0.muted; G.textAlign = 'right'; G.fillText('+1', L - 4, Y(1) + 8); G.fillText('0', L - 4, Y(0) + 4); G.fillText('−1', L - 4, Y(-1) + 4);
      const n = rewards.length; if (!n) return;
      const X = (i) => L + 3 + (n === 1 ? 0 : i / (n - 1)) * (R - L - 6);
      for (let i = 0; i < n; i++) { G.fillStyle = outcomes[i] ? 'rgba(163,230,53,.6)' : 'rgba(251,113,133,.5)'; G.fillRect(X(i) - 1, Y(rewards[i]) - 1, 2.2, 2.2); }
      G.strokeStyle = C0.text2; G.lineWidth = 1.5; G.beginPath();
      for (let i = 0; i < n; i++) { let s = 0; let c = 0; for (let j = Math.max(0, i - 19); j <= i; j++) { s += rewards[j]; c++; } const y = Y(s / c); i ? G.lineTo(X(i), y) : G.moveTo(X(i), y); }
      G.stroke();
      G.textAlign = 'left'; G.fillText(`${episodes} episodes`, L + 4, H - 3);
    }

    let lastStats = 0;
    ctx.loop((t, dt) => {
      if (playing) {
        if (speed === 'slow' || speed === 'medium') {
          acc += dt; const per = speed === 'slow' ? 0.16 : 0.035;
          while (acc > per) { acc -= per; envStep(); }
        } else {
          const n = speed === 'fast' ? 25 : 800; for (let i = 0; i < n; i++) envStep();
        }
      }
      const k = speed === 'slow' ? Math.min(1, dt * 14) : 1;
      if (Math.abs(dispX - ax) > 1.5 || Math.abs(dispY - ay) > 1.5) { dispX = ax; dispY = ay; } // teleported back to start
      dispX += (ax - dispX) * k; dispY += (ay - dispY) * k;
      draw();
      if (t - lastStats > 0.2) {
        lastStats = t; drawChart();
        const last = outcomes.slice(-50);
        stats.querySelector('.s-e').textContent = String(episodes);
        stats.querySelector('.s-w').textContent = last.length ? `${Math.round(last.reduce((a, b) => a + b, 0) / last.length * 100)}%` : '-';
        stats.querySelector('.s-r').textContent = rewards.length ? rewards[rewards.length - 1].toFixed(2) : '-';
      }
    });

    ctx.quiz([
      { q: 'What does the exploration rate ε control?', choices: ['How much future rewards count', 'How often the agent tries a random move instead of its current best one', 'How big each Q update is'], answer: 1, why: 'With probability ε it explores randomly. Without exploring it might never discover a better route.' },
      { q: 'Why do the squares next to the goal learn first?', choices: ['They are closer to the start', 'The reward arrives there first, and each update only looks one step ahead, so value spreads backward from the goal a square at a time', 'Walls block learning elsewhere'], answer: 1, why: 'Q(s,a) is pulled toward r + γ max Q(s′). Only squares whose neighbour already has value can pick some up.' },
      { q: 'What is different about reinforcement learning compared with supervised learning?', choices: ['It learns from rewards for its own actions, not from labelled right answers', 'It never uses numbers', 'It needs a teacher to label every move'], answer: 0, why: 'Nobody tells the agent the correct move. It only gets a score and must work out which actions led to it.' },
    ]);
  },
};
