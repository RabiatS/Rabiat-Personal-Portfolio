// Chapter 6: cell division. Mitosis and meiosis as keyframed layouts of individual chromatids that animate between stages.
import { MONO, DISP, fit, rgba, ease, lerp, clamp, injectStyle, reduced } from './_shared.js';

const LW = 880; const LH = 500; const CX = 440; const CY = 250;
const COLM = '#FB7185'; const COLP = '#60A5FA';
const LEN = { L: 66, S: 40 };
const CHR = ['L', 'S'];
const ORI = ['m', 'p'];
const ALL = []; for (const c of CHR) for (const o of ORI) for (const s of ['a', 'b']) ALL.push(c + o + s);

const MITOSIS = [
  ['G1 (interphase)', 'The cell grows and does its normal work. Each chromosome is one long DNA molecule, unwound as loose chromatin inside the nucleus.', [1, 4, 46, '2c', 1]],
  ['S and G2 (interphase)', 'In S phase every chromosome is copied. The two identical copies, called sister chromatids, stay joined. In G2 the cell checks the copies and gets ready to divide.', [1, 4, 46, '4c', 2]],
  ['Prophase', 'Chromatin coils up into short, thick chromosomes you could see under a microscope, each an X of two sister chromatids. The two centrosomes move apart and start building the spindle.', [1, 4, 46, '4c', 2]],
  ['Prometaphase', 'The nuclear envelope breaks down. Spindle microtubules grab each chromosome at its kinetochore, a protein patch on the centromere.', [1, 4, 46, '4c', 2]],
  ['Metaphase', 'Chromosomes line up single file across the middle (the metaphase plate), each sister attached to the opposite pole. A checkpoint waits until every one is attached.', [1, 4, 46, '4c', 2]],
  ['Anaphase', 'The glue between sisters (cohesin) is cut and the sisters are pulled to opposite poles. Each separated chromatid now counts as a chromosome of its own.', [1, 8, 92, '4c', 1]],
  ['Telophase and cytokinesis', 'A nuclear envelope forms around each set and the chromosomes loosen. A ring of actin pinches the cell in two (the cleavage furrow).', [2, 4, 46, '2c', 1]],
  ['Two daughter cells', 'Two cells, genetically identical to each other and to the parent, each diploid: 4 chromosomes here, 46 in a human.', [2, 4, 46, '2c', 1]],
];
const MEIOSIS = [
  ['G1 (interphase)', 'A diploid cell in the testis or ovary, with one copy of each chromosome from the mother (red) and one from the father (blue).', [1, 4, 46, '2c', 1]],
  ['S and G2 (interphase)', 'DNA is copied once, exactly as before mitosis. Each chromosome now has two sister chromatids.', [1, 4, 46, '4c', 2]],
  ['Prophase I', 'Homologous chromosomes, the mother\'s and father\'s versions, pair up along their length (synapsis) to form a bivalent of four chromatids. Non-sister chromatids swap matching segments at chiasmata: crossing over. Look at the swapped tips.', [1, 4, 46, '4c', 2]],
  ['Metaphase I', 'Pairs, not single chromosomes, line up on the plate. Which parent\'s copy faces which pole is random for every pair (independent assortment). Press Shuffle to flip them.', [1, 4, 46, '4c', 2]],
  ['Anaphase I', 'Homologues are pulled apart, but sisters stay joined. Each pole gets one of each kind of chromosome. This is the reduction division.', [1, 4, 46, '4c', 2]],
  ['Telophase I', 'Two cells, each now haploid: 2 chromosomes here, 23 in a human. Each chromosome still has two chromatids, and thanks to crossing over they are no longer identical.', [2, 2, 23, '2c', 2]],
  ['Metaphase II', 'No DNA copying happens in between. In each cell the chromosomes line up single file, just like mitosis.', [2, 2, 23, '2c', 2]],
  ['Anaphase II', 'Sister chromatids finally separate and move to opposite poles.', [2, 4, 46, '2c', 1]],
  ['Four haploid cells', 'Four cells, each with one set of chromosomes (n) and 1c of DNA, and every one genetically different. In females only one becomes the egg; the others become polar bodies.', [4, 2, 23, '1c', 1]],
];

// positions inside a cell for loose chromosomes (relative, scaled by cell radius)
const LOOSE = { Lm: [-0.28, -0.18, 0.7], Lp: [0.22, 0.2, -0.5], Sm: [-0.12, 0.32, 1.4], Sp: [0.3, -0.28, 2.3] };

function chrom(id, x, y, ang, o = {}) { return { id, x, y, ang, cond: o.cond ?? 1, alpha: o.alpha ?? 1, tip: o.tip ?? null, pole: o.pole ?? null, cell: o.cell }; }

function looseIn(cell, keys, opts) {
  const out = [];
  const k = cell.r / 150;
  for (const key of keys) {
    const [rx, ry, ang] = LOOSE[key.slice(0, 2)];
    const x = cell.x + rx * cell.r * 0.9; const y = cell.y + ry * cell.r * 0.9;
    const px = -Math.sin(ang) * 4.5; const py = Math.cos(ang) * 4.5;
    const sis = key.slice(2);
    if (sis) { out.push(chrom(key, x, y, ang, { ...opts(key), cell: cell.id })); continue; }
    out.push(chrom(`${key}a`, x - px, y - py, ang, { ...opts(`${key}a`), cell: cell.id }));
    out.push(chrom(`${key}b`, x + px, y + py, ang, { ...opts(`${key}b`), cell: cell.id }));
  }
  return { k, out };
}

function layout(mode, i, orient, crossed) {
  const C = { id: 'A', x: CX, y: CY, r: 170, nuc: 1, spindle: 0 };
  const tipOf = (id) => {
    if (!crossed) return null;
    if (id === 'Lmb') return COLP; if (id === 'Lpa') return COLM;
    if (id === 'Smb') return COLP; if (id === 'Spa') return COLM;
    return null;
  };
  const tipM = (id) => (mode === 'meiosis' && i >= 2 ? tipOf(id) : null);
  if (i === 0) { const { out } = looseIn(C, ['Lm', 'Lp', 'Sm', 'Sp'], (id) => ({ cond: 0, alpha: id.endsWith('b') ? 0 : 1 })); out.forEach((c) => { if (c.id.endsWith('b')) { const a = out.find((x) => x.id === c.id.slice(0, 2) + 'a'); c.x = a.x; c.y = a.y; } }); return { cells: [C], chr: out }; }
  if (i === 1) { const { out } = looseIn(C, ['Lm', 'Lp', 'Sm', 'Sp'], () => ({ cond: 0 })); return { cells: [C], chr: out }; }
  if (mode === 'mitosis') {
    if (i === 2) { const { out } = looseIn(C, ['Lm', 'Lp', 'Sm', 'Sp'], () => ({ cond: 1 })); return { cells: [{ ...C, nuc: 0.6, spindle: 0.25 }], chr: out }; }
    const order = ['Lm', 'Sp', 'Lp', 'Sm'];
    const plateY = (j) => CY + (j - 1.5) * 64;
    if (i === 3) {
      const out = [];
      order.forEach((key, j) => { const x = CX + (j % 2 ? 26 : -22); const y = plateY(j) * 0.9 + CY * 0.1; const ang = Math.PI / 2 + (j % 2 ? 0.5 : -0.4); out.push(chrom(`${key}a`, x - 6, y, ang, { pole: -1, cell: 'A' }), chrom(`${key}b`, x + 6, y, ang, { pole: 1, cell: 'A' })); });
      return { cells: [{ ...C, nuc: 0, spindle: 0.7 }], chr: out };
    }
    if (i === 4) {
      const out = []; order.forEach((key, j) => { out.push(chrom(`${key}a`, CX - 6, plateY(j), Math.PI / 2, { pole: -1, cell: 'A' }), chrom(`${key}b`, CX + 6, plateY(j), Math.PI / 2, { pole: 1, cell: 'A' })); });
      return { cells: [{ ...C, nuc: 0, spindle: 1 }], chr: out };
    }
    if (i === 5) {
      const out = []; order.forEach((key, j) => { const y = CY + (plateY(j) - CY) * 0.75; out.push(chrom(`${key}a`, CX - 100, y, Math.PI / 2, { pole: -1, cell: 'A' }), chrom(`${key}b`, CX + 100, y, Math.PI / 2, { pole: 1, cell: 'A' })); });
      return { cells: [{ ...C, r: 182, nuc: 0, spindle: 1 }], chr: out };
    }
    const sep = i === 6 ? 150 : 200; const r = i === 6 ? 135 : 140;
    const A1 = { id: 'A1', x: CX - sep, y: CY, r, nuc: i === 6 ? 0.6 : 1, spindle: 0 };
    const A2 = { id: 'A2', x: CX + sep, y: CY, r, nuc: i === 6 ? 0.6 : 1, spindle: 0 };
    const cond = i === 6 ? 0.6 : 0;
    const o1 = looseIn(A1, ['Lma', 'Lpa', 'Sma', 'Spa'], () => ({ cond })).out;
    const o2 = looseIn(A2, ['Lmb', 'Lpb', 'Smb', 'Spb'], () => ({ cond })).out;
    return { cells: [A1, A2], chr: [...o1, ...o2] };
  }
  // meiosis
  if (i === 2) {
    const out = [];
    for (const [key, x, y, ang] of [['L', CX - 40, CY - 20, 0.5], ['S', CX + 50, CY + 35, -0.8]]) {
      const px = -Math.sin(ang); const py = Math.cos(ang);
      [[`${key}ma`, -10.5], [`${key}mb`, -3.5], [`${key}pa`, 3.5], [`${key}pb`, 10.5]].forEach(([id, d]) => out.push(chrom(id, x + px * d, y + py * d, ang, { tip: tipM(id), cell: 'A' })));
    }
    return { cells: [{ ...C, nuc: 0.5, spindle: 0.25 }], chr: out };
  }
  const side = (key, homolog) => (orient[key] ? 1 : -1) * (homolog === 'm' ? -1 : 1);
  if (i === 3 || i === 4) {
    const out = [];
    for (const [key, y] of [['L', CY - 62], ['S', CY + 58]]) for (const hmg of ['m', 'p']) {
      const sd = side(key, hmg); const base = i === 3 ? CX + sd * 13 : CX + sd * 104; const yy = i === 3 ? y : CY + (y - CY) * 0.7;
      out.push(chrom(`${key}${hmg}a`, base - 4, yy, Math.PI / 2, { tip: tipM(`${key}${hmg}a`), pole: sd, cell: 'A' }), chrom(`${key}${hmg}b`, base + 4, yy, Math.PI / 2, { tip: tipM(`${key}${hmg}b`), pole: sd, cell: 'A' }));
    }
    return { cells: [{ ...C, r: i === 4 ? 182 : 170, nuc: 0, spindle: 1 }], chr: out };
  }
  // after meiosis I: cell A1 (left pole) and A2 (right pole)
  const A1 = { id: 'A1', x: CX - 220, y: CY, r: 120, nuc: i === 5 ? 0.5 : 0, spindle: i === 5 ? 0 : 1 };
  const A2 = { id: 'A2', x: CX + 220, y: CY, r: 120, nuc: i === 5 ? 0.5 : 0, spindle: i === 5 ? 0 : 1 };
  const inCell = (sd) => (sd < 0 ? A1 : A2);
  if (i >= 5 && i <= 7) {
    const out = [];
    for (const [key, dy] of [['L', -38], ['S', 44]]) for (const hmg of ['m', 'p']) {
      const cell = inCell(side(key, hmg));
      for (const s of ['a', 'b']) {
        const id = `${key}${hmg}${s}`; const sp = s === 'a' ? -1 : 1;
        if (i === 5) { const [rx, ry, ang] = LOOSE[key + hmg]; const x = cell.x + rx * cell.r * 0.7 + sp * -Math.sin(ang) * 4.5; const y = cell.y + ry * cell.r * 0.7 + sp * Math.cos(ang) * 4.5; out.push(chrom(id, x, y, ang, { tip: tipM(id), cond: 0.8, cell: cell.id })); }
        else if (i === 6) out.push(chrom(id, cell.x + sp * 6, cell.y + dy, Math.PI / 2, { tip: tipM(id), pole: sp, cell: cell.id }));
        else out.push(chrom(id, cell.x + sp * 72, cell.y + dy * 0.7, Math.PI / 2, { tip: tipM(id), pole: sp, cell: cell.id }));
      }
    }
    const cells = [A1, A2].map((c) => (i === 7 ? { ...c, r: 130 } : c));
    return { cells, chr: out };
  }
  // telophase II: four cells
  const four = [];
  const cellsOut = [];
  for (const [P, sd] of [['A1', -1], ['A2', 1]]) {
    const px = CX + sd * 220;
    for (const [s, dx] of [['a', -78], ['b', 78]]) {
      const cell = { id: `${P}${s}`, x: px + dx, y: CY, r: 70, nuc: 1, spindle: 0 };
      cellsOut.push(cell);
      for (const [key, dy] of [['L', -18], ['S', 22]]) for (const hmg of ['m', 'p']) {
        if ((sd < 0) !== (side(key, hmg) < 0)) continue;
        const id = `${key}${hmg}${s}`;
        four.push(chrom(id, cell.x + (key === 'L' ? -8 : 10), cell.y + dy, key === 'L' ? 0.6 : 2.2, { tip: tipM(id), cond: 0.15, cell: cell.id }));
      }
    }
  }
  return { cells: cellsOut, chr: four };
}

export default {
  mount(ctx) {
    injectStyle();
    const cv = ctx.canvas();
    const g = cv.ctx;
    let mode = ctx.store.get('div:mode', 'mitosis');
    let stage = 0; let from = null; let to = null; let p = 1; let auto = false; let autoT = 0;
    const orient = { L: false, S: false };
    const stages = () => (mode === 'mitosis' ? MITOSIS : MEIOSIS);
    const lay = (i) => layout(mode, i, orient, true);
    to = lay(0);

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Cell division</h2>'),
      ctx.h('<p class="lede">Mitosis makes two identical copies of a cell, for growth and repair. Meiosis makes four different sex cells with half the chromosomes. Step through both and count.</p>'),
    );
    const seg = ctx.seg([['mitosis', 'Mitosis'], ['meiosis', 'Meiosis']], mode, (v) => { mode = v; ctx.store.set('div:mode', v); stage = 0; from = null; to = lay(0); p = 1; render(); shuf.hidden = mode !== 'meiosis'; });
    ctx.panel.append(seg);
    const card = ctx.h('<div class="card bio-info"><div class="eyebrow st"></div><h3 class="nm"></h3><p class="small ds"></p></div>');
    const stat = ctx.h('<div class="stat"></div>');
    const row = ctx.h('<div class="row"></div>');
    const prev = ctx.h('<button class="btn ghost sm">‹ Back</button>');
    const next = ctx.h('<button class="btn sm">Next stage ›</button>');
    const play = ctx.h('<button class="btn ghost sm">Auto</button>');
    const shuf = ctx.h('<button class="btn ghost sm">Shuffle pairs</button>');
    shuf.hidden = mode !== 'meiosis';
    prev.onclick = () => go(stage - 1);
    next.onclick = () => go(stage + 1 >= stages().length ? 0 : stage + 1);
    play.onclick = () => { auto = !auto; play.textContent = auto ? 'Stop' : 'Auto'; autoT = 0; };
    shuf.onclick = () => { orient.L = Math.random() < 0.5; orient.S = Math.random() < 0.5; if (stage < 3) go(3); else { from = snapshot(); to = lay(stage); p = 0; } };
    row.append(prev, next, play, shuf);
    ctx.panel.append(card, row, stat, ctx.h(`<div class="legend"><span><i style="background:${COLM}"></i>from mother</span><span><i style="background:${COLP}"></i>from father</span><span><i style="background:#E8E8E3"></i>spindle</span></div>`));

    function go(i) {
      if (i < 0 || i >= stages().length) return;
      from = snapshot(); stage = i; to = lay(i); p = reduced() ? 1 : 0; render();
    }
    function render() {
      const [nm, ds, [cells, chr, hum, dna, cpc]] = stages()[stage];
      card.querySelector('.st').textContent = `${mode === 'mitosis' ? 'Mitosis' : 'Meiosis'} · stage ${stage + 1} of ${stages().length}`;
      card.querySelector('.nm').textContent = nm; card.querySelector('.ds').textContent = ds;
      stat.innerHTML = `<div><b>${cells}</b><span>cells</span></div><div><b>${chr}</b><span>chromosomes per cell</span></div><div><b>${hum}</b><span>in a human cell</span></div><div><b>${dna}</b><span>DNA per cell</span></div><div><b>${cpc}</b><span>chromatids per chromosome</span></div>`;
      prev.disabled = stage === 0;
      next.textContent = stage === stages().length - 1 ? 'Start again' : 'Next stage ›';
    }
    render();

    // current interpolated state
    let cur = to;
    function snapshot() { return JSON.parse(JSON.stringify(cur)); }
    function interp() {
      if (!from || p >= 1) { cur = to; return; }
      const t = ease(p);
      const cells = to.cells.map((c) => {
        let s = from.cells.find((x) => x.id === c.id) || from.cells.find((x) => c.id.startsWith(x.id)) || from.cells.find((x) => x.id.startsWith(c.id)) || c;
        return { ...c, x: lerp(s.x, c.x, t), y: lerp(s.y, c.y, t), r: lerp(s.r, c.r, t), nuc: lerp(s.nuc, c.nuc, t), spindle: lerp(s.spindle, c.spindle, t), parent: s.id !== c.id ? s : null };
      });
      const chr = to.chr.map((c) => {
        const s = from.chr.find((x) => x.id === c.id) || c;
        let da = c.ang - s.ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        return { ...c, x: lerp(s.x, c.x, t), y: lerp(s.y, c.y, t), ang: s.ang + da * t, cond: lerp(s.cond, c.cond, t), alpha: lerp(s.alpha, c.alpha, t), tip: t > 0.5 ? c.tip : s.tip };
      });
      cur = { cells, chr, t };
    }

    function drawChromatid(c, k) {
      const col = c.id[1] === 'm' ? COLM : COLP;
      const len = LEN[c.id[0]] * (1 + (1 - c.cond) * 0.5);
      const ca = Math.cos(c.ang); const sa = Math.sin(c.ang);
      const th = 2 + 6 * c.cond;
      g.globalAlpha = c.alpha;
      g.lineCap = 'round'; g.lineWidth = th;
      const pt = (u) => { const wv = (1 - c.cond) * 7 * Math.sin(u * 14); return [c.x + ca * u * len / 2 - sa * wv, c.y + sa * u * len / 2 + ca * wv]; };
      const path = (u0, u1) => { g.beginPath(); for (let u = u0; u <= u1 + 1e-6; u += 0.05) { const [x, y] = pt(u); if (u === u0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); };
      g.strokeStyle = col; path(-1, c.tip ? 0.3 : 1);
      if (c.tip) { g.strokeStyle = c.tip; path(0.3, 1); }
      g.globalAlpha = 1;
    }

    function draw() {
      const { w, h } = cv; if (!w) return;
      g.clearRect(0, 0, w, h);
      const v = fit(w, h, LW, LH, 4);
      g.save(); g.translate(v.ox, v.oy); g.scale(v.s, v.s);
      interp();
      const { cells, chr } = cur;
      // cells
      for (const c of cells) {
        g.fillStyle = 'rgba(94,234,212,.05)'; g.strokeStyle = 'rgba(245,245,240,.6)'; g.lineWidth = 2;
        g.beginPath(); g.arc(c.x, c.y, c.r, 0, 7); g.fill(); g.stroke();
      }
      // cleavage furrow look: where a parent is splitting, draw a pinch
      for (const c of cells) {
        if (c.nuc > 0.02) { g.strokeStyle = rgba('#A78BFA', 0.7 * c.nuc); g.fillStyle = rgba('#A78BFA', 0.08 * c.nuc); g.lineWidth = 1.5; g.setLineDash([5, 4]); g.beginPath(); g.arc(c.x, c.y, c.r * 0.62, 0, 7); g.fill(); g.stroke(); g.setLineDash([]); }
      }
      // spindle
      for (const c of cells) {
        if (c.spindle < 0.02) continue;
        const pl = [c.x - c.r * 0.86, c.y]; const pr = [c.x + c.r * 0.86, c.y];
        g.strokeStyle = rgba('#E8E8E3', 0.25 * c.spindle); g.lineWidth = 1;
        for (const ch of chr) { if (ch.cell !== c.id || !ch.pole) continue; const P = ch.pole < 0 ? pl : pr; g.beginPath(); g.moveTo(P[0], P[1]); g.lineTo(ch.x, ch.y); g.stroke(); }
        for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(pl[0], pl[1]); g.quadraticCurveTo(c.x, c.y + k * c.r * 0.22, pr[0], pr[1]); g.stroke(); }
        g.fillStyle = rgba('#FBBF24', c.spindle);
        for (const P of [pl, pr]) { g.beginPath(); g.arc(P[0], P[1], 6, 0, 7); g.fill(); }
      }
      // chromatids
      for (const c of chr) drawChromatid(c);
      // centromere dots where sisters are still joined
      for (const c of chr) {
        if (!c.id.endsWith('a') || c.alpha < 0.5) continue;
        const b = chr.find((x) => x.id === `${c.id.slice(0, 2)}b`);
        if (b && b.alpha > 0.5 && Math.hypot(b.x - c.x, b.y - c.y) < 16) { g.fillStyle = '#F5F5F0'; g.beginPath(); g.arc((b.x + c.x) / 2, (b.y + c.y) / 2, 3 + 1.5 * c.cond, 0, 7); g.fill(); }
      }
      g.restore();
      g.font = MONO(10.5); g.fillStyle = '#A0A09A'; g.textAlign = 'left';
      g.fillText(`A model cell with 2n = 4. Humans have 2n = 46.`, 6, h - 8);
    }

    cv.onResize(draw);
    ctx.loop((t, dt) => {
      if (p < 1) p = Math.min(1, p + dt / 1.1);
      if (auto) { autoT += dt; if (autoT > 2.6) { autoT = 0; go(stage + 1 >= stages().length ? 0 : stage + 1); } }
      draw();
    });

    ctx.panel.append(
      ctx.h('<div class="card tip"><p>Mitosis is copying: one cell becomes two identical cells with the full set of chromosomes. Meiosis is shuffling and halving: one cell becomes four sex cells (sperm or eggs), each with half the chromosomes and a unique mix, so that egg plus sperm restores the full number.</p></div>'),
      ctx.h('<div class="card try"><ol class="small"><li>In Mitosis, step to Metaphase and Anaphase. Watch the chromosome count jump from 4 to 8 while the DNA stays 4c.</li><li>Switch to Meiosis and stop at Prophase I. Find the red and blue chromatids that swapped tips.</li><li>At Metaphase I press Shuffle pairs a few times. With 2 pairs there are 4 possible combinations; with 23 pairs, over 8 million.</li></ol></div>'),
      ctx.h(`<div class="card deep"><table class="bio-tbl"><tr><th></th><th>Mitosis</th><th>Meiosis</th></tr>
        <tr><td>Purpose</td><td>Growth, repair, asexual reproduction</td><td>Making gametes</td></tr>
        <tr><td>Divisions</td><td>One</td><td>Two (I and II)</td></tr>
        <tr><td>Products</td><td>2 diploid cells (2n)</td><td>4 haploid cells (n)</td></tr>
        <tr><td>Genetics</td><td>Identical to parent</td><td>All different</td></tr>
        <tr><td>Homologues pair?</td><td>No</td><td>Yes, in prophase I</td></tr>
        <tr><td>Crossing over</td><td>No (normally)</td><td>Yes, prophase I</td></tr>
        <tr><td>Plate in metaphase</td><td>Single chromosomes</td><td>Pairs (I), singles (II)</td></tr></table>
        <p class="small"><b>Counting rule:</b> count centromeres to count chromosomes. "c" is the amount of DNA in one haploid set, so a diploid cell is 2c in G1 and 4c after S phase.</p>
        <p class="small"><b>When it goes wrong:</b> if homologues (meiosis I) or sisters (meiosis II) fail to separate, it is nondisjunction. A gamete with an extra chromosome 21 leads to trisomy 21 (Down syndrome). The risk rises with maternal age, because human eggs pause in prophase I from before birth until ovulation.</p>
        <p class="small"><b>Cell cycle control:</b> cyclins and cyclin dependent kinases drive the phases. p53 can halt the cycle at G1 when DNA is damaged; it is mutated in about half of human cancers.</p></div>`),
    );
    ctx.quiz([
      { q: 'A human cell in G2 has how many chromosomes and how much DNA?', choices: ['46 chromosomes, 4c', '92 chromosomes, 4c', '23 chromosomes, 2c', '46 chromosomes, 2c'], answer: 0, why: 'After S phase each of the 46 chromosomes has two chromatids, so the DNA doubles to 4c while the chromosome count stays 46.' },
      { q: 'In which stage do homologous chromosomes separate?', choices: ['Anaphase of mitosis', 'Anaphase I', 'Anaphase II', 'Prophase I'], answer: 1, why: 'Anaphase I pulls homologues apart. Sisters separate later, in anaphase II (and in mitotic anaphase).' },
      { q: 'Which two events in meiosis make each gamete genetically unique?', choices: ['DNA replication and cytokinesis', 'Crossing over and independent assortment', 'Spindle formation and nuclear breakdown', 'Mitosis and fertilisation'], answer: 1, why: 'Crossing over mixes alleles along chromosomes, and independent assortment shuffles which parent\'s chromosomes go together.' },
    ]);
    return () => {};
  },
};
