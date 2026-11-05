// Chapter 7: genetics. Punnett squares for one gene, two genes and an X-linked trait, with simulated offspring.
import { MONO, DISP, injectStyle, pointer, rgba, clamp } from './_shared.js';

const MODES = {
  mono: {
    name: 'One gene', parents: [['PP', 'Pp', 'pp'], ['PP', 'Pp', 'pp']], def: ['Pp', 'Pp'],
    gametes: (g) => [g[0], g[1]],
    combine: (a, b) => [a, b].sort((x, y) => (x === x.toUpperCase() ? -1 : 1) - (y === y.toUpperCase() ? -1 : 1)).join(''),
    pheno: (g) => (g.includes('P') ? 'Purple' : 'White'),
    cats: ['Purple', 'White'], col: { Purple: '#A78BFA', White: '#E8E8E3' },
    label: (g) => g,
    about: 'Flower colour in Mendel\'s peas. P (purple) is dominant over p (white).',
  },
  di: {
    name: 'Two genes', parents: [['RRYY', 'RrYy', 'Rryy', 'rrYy', 'rryy'], ['RRYY', 'RrYy', 'Rryy', 'rrYy', 'rryy']], def: ['RrYy', 'RrYy'],
    gametes: (g) => { const out = []; for (const a of [g[0], g[1]]) for (const b of [g[2], g[3]]) out.push(a + b); return out; },
    combine: (a, b) => { const s = (x, y) => (x === x.toUpperCase() ? x + y : y + x); return s(a[0], b[0]) + s(a[1], b[1]); },
    pheno: (g) => `${g.includes('R') ? 'Round' : 'Wrinkled'} ${g.includes('Y') ? 'yellow' : 'green'}`,
    cats: ['Round yellow', 'Round green', 'Wrinkled yellow', 'Wrinkled green'], col: { 'Round yellow': '#FBBF24', 'Round green': '#A3E635', 'Wrinkled yellow': '#FBBF24', 'Wrinkled green': '#A3E635' },
    label: (g) => g,
    about: 'Mendel\'s pea seeds. R (round) beats r (wrinkled) and Y (yellow) beats y (green). The genes are on different chromosomes, so they assort independently.',
  },
  x: {
    name: 'X-linked', parents: [['XᴮXᴮ', 'XᴮXᵇ', 'XᵇXᵇ'], ['XᴮY', 'XᵇY']], def: ['XᴮXᵇ', 'XᴮY'],
    gametes: (g) => (g.endsWith('Y') ? [g.slice(0, 2), 'Y'] : [g.slice(0, 2), g.slice(2, 4)]),
    combine: (a, b) => { if (b === 'Y') return `${a}Y`; return a === 'Xᵇ' && b === 'Xᴮ' ? b + a : a + b; },
    pheno: (g) => { if (g.endsWith('Y')) return g.startsWith('Xᴮ') ? 'Son, typical vision' : 'Son, colour blind'; if (!g.includes('Xᴮ')) return 'Daughter, colour blind'; return g.includes('Xᵇ') ? 'Daughter, carrier' : 'Daughter, typical vision'; },
    cats: ['Daughter, typical vision', 'Daughter, carrier', 'Daughter, colour blind', 'Son, typical vision', 'Son, colour blind'],
    col: { 'Daughter, typical vision': '#A78BFA', 'Daughter, carrier': '#c4b5fd', 'Daughter, colour blind': '#FB7185', 'Son, typical vision': '#60A5FA', 'Son, colour blind': '#FB7185' },
    label: (g) => g,
    about: 'Red-green colour blindness. The gene is on the X chromosome. Xᵇ is recessive. Sons get their only X from their mother.',
  },
};

const CRIT = [0, 3.84, 5.99, 7.81, 9.49];

export default {
  mount(ctx) {
    injectStyle();
    const cv = ctx.canvas();
    const g = cv.ctx;
    let mode = ctx.store.get('gen:mode', 'mono');
    let par = [...MODES[mode].def];
    let n = 200; let sim = null; let pick = null;
    const hits = [];

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Genetics</h2>'),
      ctx.h('<p class="lede">Each parent passes on one of their two copies of every gene, at random. A Punnett square lists every combination, which tells you the odds for each child.</p>'),
    );
    const seg = ctx.seg(Object.entries(MODES).map(([k, m]) => [k, m.name]), mode, (v) => { mode = v; ctx.store.set('gen:mode', v); par = [...MODES[v].def]; sim = null; pick = null; buildParents(); refresh(); });
    ctx.panel.append(seg);
    const about = ctx.h('<p class="small muted"></p>');
    const parBox = ctx.h('<div class="card"></div>');
    ctx.panel.append(about, parBox);
    function buildParents() {
      const M = MODES[mode];
      about.textContent = M.about;
      parBox.innerHTML = '';
      ['Parent 1 (mother)', 'Parent 2 (father)'].forEach((lab, i) => {
        const row = ctx.h(`<div><div class="eyebrow">${mode === 'x' ? lab : lab.replace(/ \(.*\)/, '')}</div><div class="bio-chips"></div></div>`);
        for (const gt of M.parents[i]) {
          const b = ctx.h(`<button class="chip${gt === par[i] ? ' on' : ''}" style="text-transform:none;font-family:var(--f-mono);letter-spacing:.02em">${gt}</button>`);
          b.onclick = () => { par[i] = gt; sim = null; pick = null; row.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b)); refresh(); };
          row.querySelector('.bio-chips').append(b);
        }
        parBox.append(row);
      });
    }
    const simRow = ctx.h('<div class="row"></div>');
    const simBtn = ctx.h('<button class="btn sm">Simulate offspring</button>');
    simBtn.onclick = () => runSim();
    simRow.append(simBtn);
    ctx.panel.append(simRow, ctx.slider({ label: 'Number of offspring', min: 10, max: 2000, step: 10, value: n, fmt: (v) => `${v}`, onInput: (v) => { n = v; } }));
    const stat = ctx.h('<div class="stat"></div>');
    const info = ctx.h('<p class="small muted">Tap a box in the square to read it.</p>');
    ctx.panel.append(stat, info);

    function square() {
      const M = MODES[mode];
      const ga = M.gametes(par[0]); const gb = M.gametes(par[1]);
      const cells = ga.map((a) => gb.map((b) => M.combine(a, b)));
      const counts = {}; for (const c of M.cats) counts[c] = 0;
      cells.flat().forEach((c) => { counts[M.pheno(c)]++; });
      const total = cells.flat().length;
      return { ga, gb, cells, counts, total };
    }
    let S = square();
    function refresh() { S = square(); renderStat(); info.textContent = 'Tap a box in the square to read it.'; draw(); }
    function renderStat() {
      const M = MODES[mode];
      const exp = M.cats.filter((c) => S.counts[c]).map((c) => `${S.counts[c]}`).join(':');
      let html = `<div><b>${exp}</b><span>expected ratio</span></div>`;
      if (sim) {
        const used = M.cats.filter((c) => S.counts[c] > 0);
        let chi = 0; for (const c of used) { const e = (S.counts[c] / S.total) * sim.done; chi += e ? (sim.obs[c] - e) ** 2 / e : 0; }
        const df = used.length - 1;
        html += `<div><b>${sim.done}</b><span>offspring</span></div><div><b>${chi.toFixed(2)}</b><span>chi square, df ${df}</span></div>`;
        if (df > 0 && sim.done === sim.n) html += `<div><b>${chi < CRIT[df] ? 'fits' : 'off'}</b><span>${chi < CRIT[df] ? 'p > 0.05' : 'p < 0.05'}</span></div>`;
      }
      stat.innerHTML = html;
    }

    function runSim() {
      const M = MODES[mode];
      const obs = {}; for (const c of M.cats) obs[c] = 0;
      const cellObs = S.cells.map((r) => r.map(() => 0));
      sim = { n, done: 0, obs, cellObs };
    }
    function simStep(k) {
      if (!sim || sim.done >= sim.n) return;
      const M = MODES[mode];
      for (let i = 0; i < k && sim.done < sim.n; i++) {
        const a = Math.floor(Math.random() * S.ga.length); const b = Math.floor(Math.random() * S.gb.length);
        sim.cellObs[a][b]++; sim.obs[M.pheno(S.cells[a][b])]++; sim.done++;
      }
      renderStat();
    }

    pointer(cv.el, ctx.signal, { down: (x, y) => {
      for (const [hx, hy, hw, hh, a, b] of hits) if (x > hx && x < hx + hw && y > hy && y < hy + hh) {
        pick = [a, b];
        const M = MODES[mode]; const gt = S.cells[a][b];
        info.innerHTML = `Egg ${S.ga[a]} + sperm ${S.gb[b]} gives <b>${gt}</b>: ${M.pheno(gt).toLowerCase()}. Each box is a 1 in ${S.total} chance.`;
        draw(); return;
      }
    } });

    function pea(x, y, r, round, yellow) {
      g.fillStyle = yellow ? '#FBBF24' : '#A3E635';
      g.beginPath();
      for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2; const rr = round ? r : r * (1 + 0.12 * Math.sin(a * 7)); const px = x + Math.cos(a) * rr; const py = y + Math.sin(a) * rr; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
      g.fill();
    }

    function draw() {
      const { w, h } = cv; if (!w) return;
      g.clearRect(0, 0, w, h); hits.length = 0;
      const M = MODES[mode];
      const side = w > h * 1.15;
      const gw = side ? Math.min(w * 0.55, h - 40) : Math.min(w - 20, h * 0.56);
      const nA = S.ga.length; const nB = S.gb.length;
      const head = Math.max(34, gw * 0.12);
      const cs = Math.min((gw - head) / nB, (gw - head) / nA);
      const gx = side ? 16 : (w - (head + cs * nB)) / 2; const gy = side ? (h - (head + cs * nA)) / 2 : 8;
      // headers
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = MONO(10); g.fillStyle = '#A0A09A';
      g.fillText(mode === 'x' ? 'sperm' : 'parent 2', gx + head + (cs * nB) / 2, gy - 0 + 6);
      g.save(); g.translate(gx + 6, gy + head + (cs * nA) / 2); g.rotate(-Math.PI / 2); g.fillText(mode === 'x' ? 'eggs' : 'parent 1', 0, 0); g.restore();
      g.font = MONO(clamp(cs * 0.2, 11, 16)); g.fillStyle = '#E8E8E3';
      S.gb.forEach((b, j) => g.fillText(b, gx + head + cs * (j + 0.5), gy + head * 0.62));
      S.ga.forEach((a, i) => g.fillText(a, gx + head * 0.6, gy + head + cs * (i + 0.5)));
      // cells
      S.cells.forEach((row, i) => row.forEach((gt, j) => {
        const x = gx + head + j * cs; const y = gy + head + i * cs;
        const ph = M.pheno(gt); const col = M.col[ph];
        const on = pick && pick[0] === i && pick[1] === j;
        g.fillStyle = rgba(col, on ? 0.3 : 0.12); g.strokeStyle = on ? '#F5F5F0' : 'rgba(245,245,240,.18)'; g.lineWidth = on ? 2 : 1;
        g.beginPath(); g.roundRect(x + 2, y + 2, cs - 4, cs - 4, 6); g.fill(); g.stroke();
        hits.push([x, y, cs, cs, i, j]);
        const fz = clamp(cs * (mode === 'di' ? 0.17 : 0.22), 10, 20);
        g.font = MONO(fz); g.fillStyle = '#F5F5F0'; g.fillText(gt, x + cs / 2, y + cs * 0.36);
        // icon
        const iy = y + cs * 0.68; const ir = Math.min(cs * 0.13, 12);
        if (mode === 'di') pea(x + cs / 2, iy, ir, gt.includes('R'), gt.includes('Y'));
        else if (mode === 'mono') { g.fillStyle = col; for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; g.beginPath(); g.ellipse(x + cs / 2 + Math.cos(a) * ir * 0.7, iy + Math.sin(a) * ir * 0.7, ir * 0.55, ir * 0.38, a, 0, 7); g.fill(); } g.fillStyle = '#FBBF24'; g.beginPath(); g.arc(x + cs / 2, iy, ir * 0.25, 0, 7); g.fill(); }
        else { g.font = MONO(Math.max(9, fz * 0.6)); g.fillStyle = col; g.fillText(ph.replace('Daughter, ', '♀ ').replace('Son, ', '♂ ').replace('typical vision', 'typical'), x + cs / 2, iy); }
        if (sim) { g.font = MONO(10); g.fillStyle = '#A0A09A'; g.fillText(`${sim.cellObs[i][j]}`, x + cs - 14, y + 13); }
      }));
      // bars: observed vs expected
      const cats = M.cats.filter((c) => S.counts[c] > 0);
      const bx = side ? gx + head + cs * nB + 36 : 16; const by = side ? gy + head : gy + head + cs * nA + 22;
      const bw = side ? w - bx - 16 : w - 32; const bh = side ? cs * nA : h - by - 34;
      const maxF = Math.max(...cats.map((c) => Math.max(S.counts[c] / S.total, sim && sim.done ? sim.obs[c] / sim.done : 0)));
      if (bh < 60) return;
      g.textAlign = 'left'; g.font = MONO(10.5); g.fillStyle = '#A0A09A';
      g.fillText(sim ? `observed (solid) vs expected (outline), ${sim.done} offspring` : 'expected share of offspring (outline). Press Simulate.', bx, by - 12);
      const rowH = Math.min(52, bh / cats.length);
      cats.forEach((c, k) => {
        const y = by + k * rowH; const frac = S.counts[c] / S.total;
        const labelW = Math.min(150, bw * 0.38);
        g.fillStyle = '#E8E8E3'; g.font = MONO(10.5); g.textBaseline = 'middle';
        g.fillText(c.replace('typical vision', 'typical'), bx, y + rowH * 0.4);
        const x0 = bx + labelW; const W = bw - labelW - 40;
        const obs = sim && sim.done ? sim.obs[c] / sim.done : 0;
        g.fillStyle = M.col[c]; g.globalAlpha = 0.85; g.fillRect(x0, y + rowH * 0.18, (W * obs) / maxF, rowH * 0.45); g.globalAlpha = 1;
        g.strokeStyle = '#F5F5F0'; g.lineWidth = 1.2; g.strokeRect(x0, y + rowH * 0.18, (W * frac) / maxF, rowH * 0.45);
        g.fillStyle = '#A0A09A'; g.fillText(sim ? `${sim.obs[c]}` : `${Math.round(frac * 100)}%`, x0 + (W * Math.max(frac, obs)) / maxF + 6, y + rowH * 0.4);
      });
    }

    buildParents(); refresh();
    cv.onResize(draw);
    ctx.loop((t, dt) => { if (sim && sim.done < sim.n) { simStep(Math.max(1, Math.ceil(sim.n / 90))); draw(); } });

    ctx.panel.append(
      ctx.h('<div class="card tip"><p>You have two copies (alleles) of most genes, one from each parent. A dominant allele (capital letter) shows its effect even with only one copy. A recessive allele (small letter) only shows when both copies are recessive. Two carriers (Pp × Pp) have a 1 in 4 chance of a child who shows the recessive trait.</p></div>'),
      ctx.h('<div class="card try"><ol class="small"><li>Pp × Pp: expect 3 purple to 1 white. Simulate 20 offspring, then 2000. Small families stray far from 3:1; big samples settle near it.</li><li>Two genes, RrYy × RrYy: the classic 9:3:3:1.</li><li>X-linked with a carrier mother: half her sons are colour blind, none of her daughters, but half the daughters are carriers. Then make the father XᵇY.</li></ol></div>'),
      ctx.h(`<details class="more"><summary>Going deeper</summary><div class="small">
        <p><b>Terms.</b> Genotype is the alleles (Pp); phenotype is what shows (purple). Homozygous means two identical alleles, heterozygous two different. A test cross with a homozygous recessive (pp) reveals an unknown genotype.</p>
        <p><b>Chi square.</b> χ² = Σ (observed − expected)² / expected, with degrees of freedom = number of classes − 1. If χ² is below the critical value (3.84 for df 1, 5.99 for df 2, 7.81 for df 3 at p = 0.05), the data fit the expected ratio. Simulate a few times: about 1 run in 20 will look "off" by chance alone.</p>
        <p><b>Patterns in families.</b> Autosomal dominant: affects every generation, either sex, 50% risk from an affected heterozygous parent (Huntington disease). Autosomal recessive: can skip generations, often appears in children of unaffected carriers (cystic fibrosis, sickle cell disease). X-linked recessive: mostly males, passed from carrier mothers, never father to son (haemophilia A and B, Duchenne muscular dystrophy, red-green colour blindness).</p>
        <p><b>Beyond Mendel.</b> Incomplete dominance (blends), codominance (both show, like AB blood group), linked genes that do not assort independently, and polygenic traits such as height, which spread out along a bell curve.</p>
      </div></details>`),
    );
    ctx.quiz([
      { q: 'Two carriers of cystic fibrosis (Ff × Ff) have a child. What is the chance the child has the disease?', choices: ['1 in 2', '1 in 4', '3 in 4', 'None'], answer: 1, why: 'Only ff shows the disease, which is one of the four boxes.' },
      { q: 'An unaffected child of two carriers (Ff × Ff). What is the chance this child is a carrier?', choices: ['1/2', '2/3', '1/4', '3/4'], answer: 1, why: 'Rule out ff. Of the three remaining boxes (FF, Ff, fF), two are carriers: 2/3. A classic exam trap.' },
      { q: 'A man with haemophilia A (X-linked recessive) and an unaffected non-carrier woman have children. Which is true?', choices: ['Half their sons will be affected', 'All their daughters will be carriers', 'All their sons will be carriers', 'Half their daughters will be affected'], answer: 1, why: 'Every daughter gets her father\'s X, which carries the allele. Sons get his Y, so they are unaffected and cannot be carriers.' },
    ]);
    return () => {};
  },
};
