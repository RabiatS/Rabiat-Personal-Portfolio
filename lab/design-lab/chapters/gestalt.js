// Gestalt principles as interactive dot fields on a canvas.
const INFO = {
  proximity: {
    name: 'Proximity', tip: 'Things that are close together are seen as a group. The dots are identical, only the spacing changes, and yet you see columns (or rows) instead of a grid.',
    tryThis: 'Drag <b>Extra gap</b> from 0 upward. At some point the even grid flips into pairs of columns. Tick <b>Show the groups</b> to see what a simple clustering algorithm finds with the same rule your eye uses: link any two dots closer than a threshold.',
    ui: 'Spacing in forms: a label should sit closer to its own field than to the field above.',
  },
  similarity: {
    name: 'Similarity', tip: 'Things that look alike (colour, shape, size) are seen as belonging together, even when spacing is perfectly even.',
    tryThis: 'Raise <b>Difference</b> with the colour pattern and the grid turns into columns. Switch the pattern to shape and it turns into rows. Colour usually wins over shape when both compete.',
    ui: 'All links one colour, all buttons one shape: consistency lets people recognise function at a glance.',
  },
  closure: {
    name: 'Closure', tip: 'The eye completes shapes that are not there. Three cut circles become a white triangle that is brighter than the page, though no edge is drawn.',
    tryThis: 'Drag <b>Gap</b> to widen the gaps in the dashed circle. You keep seeing a circle until well over half of it is missing. Then shrink the <b>mouth</b> of the three cut circles and watch the illusory triangle fade.',
    ui: 'Icons and logos (the WWF panda, the IBM stripes) and progress rings rely on closure. It also lets you drop borders: aligned items suggest a box.',
  },
  continuity: {
    name: 'Continuity', tip: 'The eye follows smooth paths. Where two lines cross, you see two smooth curves passing through each other, not two sharp corners touching.',
    tryThis: 'Toggle <b>Colour by path</b> between the smooth reading and the "corners" reading. Both are geometrically valid, but only the smooth one is what you saw first. Drag <b>Dot spacing</b>: even with big gaps the paths hold.',
    ui: 'Carousels that show a half visible next card, aligned rows in tables, and lines in charts all use continuity to lead the eye.',
  },
  region: {
    name: 'Common region', tip: 'Things inside the same boundary are seen as a group, and this can beat proximity. A box around two far apart dots ties them together.',
    tryThis: 'With boxes off you see pairs by proximity. Turn on <b>Boxes</b>: they are drawn around the far apart dots, and the grouping flips. Slide <b>Box shading</b> to see how faint a region can be and still work.',
    ui: 'Cards. Every card in a UI is common region: a background or border that says "these things belong together".',
  },
  figure: {
    name: 'Figure and ground', tip: 'We split every scene into a figure (the thing) and a ground (behind it). In the Rubin vase the split is ambiguous, so it flips between a vase and two faces.',
    tryThis: 'Press <b>Swap colours</b>. Usually the smaller, enclosed, lighter shape becomes the figure. Drag <b>Vase width</b>: a thinner vase looks more like the background, wider faces win.',
    ui: 'Modals use a dark scrim to push the page into "ground". Weak figure/ground (text on busy photos) makes things hard to read.',
  },
};

export default {
  mount(ctx) {
    const cv = ctx.canvas(); const g = cv.ctx; const C = ctx.colors;
    let mode = 'proximity';
    const st = { gap: 0, orient: 'cols', show: false, diff: 0.8, pattern: 'colour', cgap: 0.35, mouth: 60, cont: true, spacing: 16, boxes: true, shade: 0.5, swap: false, vw: 1 };

    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">Gestalt principles</h2>'), ctx.h('<p class="lede">Before you read a single word, your brain has already grouped what is on the screen. These are the rules it uses.</p>'));
    const seg = ctx.seg(Object.entries(INFO).map(([k, v]) => [k, v.name]), mode, (v) => { mode = v; build(); draw(); });
    P.append(seg);
    const ctrl = ctx.h('<div style="display:flex;flex-direction:column;gap:10px"></div>');
    const tip = ctx.h('<div class="card tip"></div>');
    const tr = ctx.h('<div class="card try"></div>');
    const ui = ctx.h('<div class="card"></div>');
    P.append(ctrl, tip, tr, ui);
    P.append(ctx.h(`<div class="card deep"><p>Gestalt psychology began in Germany in the 1910s and 1920s with Max Wertheimer, Kurt Koffka and Wolfgang Köhler. Their core claim: perception organises the whole before the parts ("the whole is other than the sum of its parts", as Koffka put it). Wertheimer\'s 1923 paper laid out proximity, similarity and good continuation. Figure and ground was studied by Edgar Rubin (1915), and common region was added much later by Stephen Palmer (1992).</p><p>The principles compete. In the common region demo, region beats proximity. In similarity, colour usually beats shape. Designing a layout means making them agree, so every cue points to the same grouping.</p></div>`));

    function build() {
      const I = INFO[mode];
      tip.innerHTML = `<p>${I.tip}</p>`; tr.innerHTML = `<p>${I.tryThis}</p>`;
      ui.innerHTML = `<h3 style="margin:0">In interfaces</h3><p class="small">${I.ui}</p>`;
      ctrl.innerHTML = '';
      const add = (el) => ctrl.append(el);
      const chk = (label, key) => { const el = ctx.h(`<label class="check"><input type="checkbox" ${st[key] ? 'checked' : ''}> ${label}</label>`); el.querySelector('input').addEventListener('change', (e) => { st[key] = e.target.checked; draw(); }); return el; };
      if (mode === 'proximity') {
        add(ctx.slider({ label: 'Extra gap', min: -10, max: 50, step: 1, value: st.gap, unit: 'px', onInput: (v) => { st.gap = v; draw(); } }));
        add(ctx.seg([['cols', 'Columns'], ['rows', 'Rows']], st.orient, (v) => { st.orient = v; draw(); }));
        add(chk('Show the groups (single link clustering)', 'show'));
      } else if (mode === 'similarity') {
        add(ctx.slider({ label: 'Difference', min: 0, max: 1, step: 0.01, value: st.diff, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => { st.diff = v; draw(); } }));
        add(ctx.seg([['colour', 'Colour'], ['shape', 'Shape'], ['size', 'Size'], ['both', 'Colour vs shape']], st.pattern, (v) => { st.pattern = v; draw(); }));
      } else if (mode === 'closure') {
        add(ctx.slider({ label: 'Gap in the circle', min: 0, max: 0.9, step: 0.01, value: st.cgap, fmt: (v) => `${Math.round(v * 100)}% missing`, onInput: (v) => { st.cgap = v; draw(); } }));
        add(ctx.slider({ label: 'Mouth of the cut circles', min: 0, max: 90, step: 1, value: st.mouth, unit: '°', onInput: (v) => { st.mouth = v; draw(); } }));
      } else if (mode === 'continuity') {
        add(chk('Colour by path (smooth reading)', 'cont'));
        add(ctx.slider({ label: 'Dot spacing', min: 6, max: 40, step: 1, value: st.spacing, unit: 'px', onInput: (v) => { st.spacing = v; draw(); } }));
      } else if (mode === 'region') {
        add(chk('Boxes', 'boxes'));
        add(ctx.slider({ label: 'Box shading', min: 0.05, max: 1, step: 0.01, value: st.shade, fmt: (v) => `${Math.round(v * 100)}%`, onInput: (v) => { st.shade = v; draw(); } }));
      } else if (mode === 'figure') {
        const b = ctx.h('<button class="btn ghost sm" style="align-self:flex-start">Swap colours</button>');
        b.addEventListener('click', () => { st.swap = !st.swap; draw(); });
        add(b);
        add(ctx.slider({ label: 'Vase width', min: 0.5, max: 1.5, step: 0.01, value: st.vw, fmt: (v) => `${v.toFixed(2)}x`, onInput: (v) => { st.vw = v; draw(); } }));
      }
    }

    const dot = (x, y, r, col) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = col; g.fill(); };
    const label = (t, x, y, align = 'center') => { g.font = '500 11px "DM Mono", monospace'; g.fillStyle = C.muted; g.textAlign = align; g.fillText(t, x, y); };

    function draw() {
      const { w, h } = cv; if (!w) return;
      g.clearRect(0, 0, w, h);
      const cx = w / 2; const cy = h / 2 - 10; const S = Math.min(w, h);
      if (mode === 'proximity') {
        const n = 8; const base = Math.max(18, S / 16); const pts = [];
        const step = (i) => i * base + Math.floor(i / 2) * st.gap;
        const span = step(n - 1);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const a = step(i); const b = j * base;
          const x = st.orient === 'cols' ? a : b; const y = st.orient === 'cols' ? b : a;
          pts.push([cx - (st.orient === 'cols' ? span : (n - 1) * base) / 2 + x, cy - (st.orient === 'cols' ? (n - 1) * base : span) / 2 + y]);
        }
        if (st.show) {
          // single link clustering: link points closer than 1.15 x the smallest neighbour distance
          let dmin = 1e9;
          for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) dmin = Math.min(dmin, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
          const par = pts.map((_, i) => i); const f = (i) => (par[i] === i ? i : (par[i] = f(par[i])));
          for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) <= dmin * 1.15) par[f(i)] = f(j);
          const groups = {}; pts.forEach((p, i) => { (groups[f(i)] ||= []).push(p); });
          const list = Object.values(groups); const pal = [C.c1, C.c2, C.c3, C.c4, C.c5, C.c6];
          list.forEach((ps, k) => {
            const xs = ps.map((p) => p[0]); const ys = ps.map((p) => p[1]);
            g.strokeStyle = pal[k % 6]; g.lineWidth = 1.5; g.globalAlpha = 0.9;
            g.beginPath(); g.roundRect(Math.min(...xs) - 9, Math.min(...ys) - 9, Math.max(...xs) - Math.min(...xs) + 18, Math.max(...ys) - Math.min(...ys) + 18, 10); g.stroke(); g.globalAlpha = 1;
          });
          label(`${list.length} group${list.length === 1 ? '' : 's'} found`, cx, h - 24);
        }
        pts.forEach(([x, y]) => dot(x, y, Math.max(4, base * 0.2), C.text2));
      } else if (mode === 'similarity') {
        const n = 8; const base = Math.max(20, S / 14);
        const mixc = (a, b, t) => { const p = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)); const A = p(a); const B = p(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; };
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          const x = cx - ((n - 1) * base) / 2 + i * base; const y = cy - ((n - 1) * base) / 2 + j * base;
          const r = base * 0.22; const alt = i % 2 === 1; const altRow = j % 2 === 1;
          let col = C.text2; let shape = 'dot'; let rr = r;
          if (st.pattern === 'colour' || st.pattern === 'both') col = alt ? mixc('#e8e8e3', '#fb7185', st.diff) : mixc('#e8e8e3', '#5eead4', st.diff);
          if (st.pattern === 'shape' || st.pattern === 'both') shape = altRow && st.diff > 0.15 ? 'sq' : 'dot';
          if (st.pattern === 'size') rr = r * (alt ? 1 + st.diff * 0.8 : 1 - st.diff * 0.45);
          g.fillStyle = col;
          if (shape === 'sq') { const s2 = rr * (1 + st.diff * 0.3); g.fillRect(x - s2, y - s2, s2 * 2, s2 * 2); } else dot(x, y, rr, col);
        }
        label(st.pattern === 'both' ? 'colour groups columns, shape groups rows: which wins?' : 'spacing is perfectly even', cx, h - 24);
      } else if (mode === 'closure') {
        const R = S * 0.16; const ax = w < 560 ? cx : cx - S * 0.26; const ay = w < 560 ? cy - S * 0.2 : cy;
        // dashed circle
        const segs = 12; const frac = 1 - st.cgap;
        g.strokeStyle = C.text2; g.lineWidth = 6; g.lineCap = 'round';
        for (let i = 0; i < segs; i++) { const a0 = (i / segs) * Math.PI * 2 - Math.PI / 2; g.beginPath(); g.arc(ax, ay, R, a0, a0 + (Math.PI * 2 / segs) * frac); g.stroke(); }
        label(`${Math.round(st.cgap * 100)}% of the outline missing`, ax, ay + R + 28);
        // Kanizsa triangle
        const bx = w < 560 ? cx : cx + S * 0.24; const by = w < 560 ? cy + S * 0.22 : cy + S * 0.02; const T = S * 0.17; const pr = S * 0.088;
        const v = [[bx, by - T], [bx - T * 0.87, by + T * 0.5], [bx + T * 0.87, by + T * 0.5]];
        v.forEach(([x, y]) => {
          const toC = Math.atan2(by - y, bx - x); const m = (st.mouth * Math.PI) / 180;
          g.beginPath(); g.moveTo(x, y); g.arc(x, y, pr, toC + m / 2, toC - m / 2 + Math.PI * 2); g.closePath(); g.fillStyle = C.text2; g.fill();
        });
        label(st.mouth > 0 ? 'no triangle is drawn' : 'mouths closed: the triangle is gone', bx, by + T * 0.5 + pr + 28);
      } else if (mode === 'continuity') {
        const L = Math.min(w * 0.8, 560); const x0 = cx - L / 2; const amp = S * 0.22;
        const curve1 = (t) => [x0 + t * L, cy + (t - 0.5) * amp * 1.4];
        const curve2 = (t) => [x0 + t * L, cy - Math.sin((t - 0.5) * Math.PI) * amp];
        const sample = (fn) => { const out = []; let acc = 0; let prev = fn(0); out.push([prev, 0]); for (let k = 1; k <= 600; k++) { const t = k / 600; const p = fn(t); acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]); if (acc >= st.spacing) { out.push([p, t]); acc = 0; } prev = p; } return out; };
        const a = sample(curve1); const b = sample(curve2);
        // smooth reading: colour per curve. Corner reading: swap colours at each crossing (t = 0.5)
        a.forEach(([p, t]) => dot(p[0], p[1], 4.5, st.cont ? C.c1 : (t < 0.5 ? C.c1 : C.c2)));
        b.forEach(([p, t]) => dot(p[0], p[1], 4.5, st.cont ? C.c2 : (t < 0.5 ? C.c2 : C.c1)));
        label(st.cont ? 'a line and a curve crossing' : 'the same dots read as two bent shapes touching at a corner', cx, h - 24);
      } else if (mode === 'region') {
        const n = 10; const L = Math.min(w * 0.86, 620); const x0 = cx - L / 2;
        // dots in pairs by proximity: 0-1 close, 1-2 far, ...
        const xs = []; let x = 0; for (let i = 0; i < n; i++) { xs.push(x); x += i % 2 === 0 ? L * 0.06 : L * 0.16; }
        const scale = L / xs[n - 1];
        const P2 = xs.map((v) => x0 + v * scale);
        if (st.boxes) {
          for (let i = 1; i < n - 1; i += 2) {
            const a = P2[i] - 16; const b = P2[i + 1] + 16;
            g.fillStyle = `rgba(167,139,250,${0.28 * st.shade})`; g.strokeStyle = `rgba(167,139,250,${0.9 * st.shade})`; g.lineWidth = 1.5;
            g.beginPath(); g.roundRect(a, cy - 34, b - a, 68, 12); g.fill(); g.stroke();
          }
        }
        P2.forEach((px) => dot(px, cy, 8, C.text2));
        label(st.boxes ? 'boxes tie the far apart dots together' : 'close dots pair up by proximity', cx, cy + 70);
      } else if (mode === 'figure') {
        const Hh = Math.min(h * 0.78, 520); const top = cy - Hh / 2; const Wd = Math.min(w * 0.86, Hh * 1.05);
        const A = st.swap ? '#f5f5f0' : '#141414'; const B = st.swap ? '#141414' : '#f5f5f0';
        // half width profile of the vase (fraction of the box width) from top to bottom: brow, eye, nose, lips, chin
        const prof = [[0, 0.3], [0.07, 0.3], [0.15, 0.22], [0.3, 0.165], [0.37, 0.21], [0.48, 0.085], [0.54, 0.15], [0.6, 0.11], [0.64, 0.15], [0.68, 0.115], [0.76, 0.19], [0.84, 0.14], [0.92, 0.22], [1, 0.3]];
        const ext = [prof[0], ...prof, prof[prof.length - 1]]; const curve = [];
        for (let i = 1; i < ext.length - 2; i++) {
          const [p0, p1, p2, p3] = [ext[i - 1], ext[i], ext[i + 1], ext[i + 2]];
          for (let k = 0; k < 12; k++) {
            const u = k / 12; const u2 = u * u; const u3 = u2 * u;
            const cr = (a0, a1, a2, a3) => 0.5 * (2 * a1 + (-a0 + a2) * u + (2 * a0 - 5 * a1 + 4 * a2 - a3) * u2 + (-a0 + 3 * a1 - 3 * a2 + a3) * u3);
            curve.push([cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])]);
          }
        }
        curve.push(prof[prof.length - 1]);
        g.fillStyle = A; g.beginPath(); g.roundRect(cx - Wd / 2, top, Wd, Hh, 14); g.fill();
        g.save(); g.beginPath(); g.roundRect(cx - Wd / 2, top, Wd, Hh, 14); g.clip();
        g.fillStyle = B; g.beginPath();
        curve.forEach(([t, v]) => g.lineTo(cx - Math.min(Wd / 2, v * st.vw * Wd * 0.75), top + t * Hh));
        [...curve].reverse().forEach(([t, v]) => g.lineTo(cx + Math.min(Wd / 2, v * st.vw * Wd * 0.75), top + t * Hh));
        g.closePath(); g.fill(); g.restore();
        label('a vase, or two faces?', cx, top + Hh + 22);
      }
    }
    cv.onResize(draw);
    build(); draw();

    ctx.quiz([
      { q: 'A form label sits exactly halfway between two fields. Which principle is broken?', choices: ['Proximity', 'Closure', 'Figure and ground'], answer: 0, why: 'The label should be closer to its own field so proximity groups them correctly.' },
      { q: 'Cards with a background colour grouping a title, image and button use which principle?', choices: ['Continuity', 'Common region', 'Closure'], answer: 1, why: 'A shared boundary or background is common region, and it can override proximity.' },
      { q: 'Why does a dark scrim behind a modal dialog help?', choices: ['It strengthens figure and ground, pushing the page back', 'It adds similarity', 'It speeds up the page'], answer: 0, why: 'The scrim turns the page into ground so the dialog clearly reads as the figure.' },
    ]);
  },
};
