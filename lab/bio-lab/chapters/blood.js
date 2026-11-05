// Chapter 9: blood and the immune system. Blood components, an ABO/Rh red cell compatibility game,
// and a small simulation of innate and adaptive immunity with primary and secondary responses.
import { MONO, DISP, fit, rgba, clamp, injectStyle, pointer, arrow, reduced } from './_shared.js';

const CELLS = {
  rbc: ['Red blood cell (erythrocyte)', 'Carries oxygen bound to haemoglobin, and some carbon dioxide. No nucleus, biconcave, about 7 to 8 µm wide, lives about 120 days before the spleen removes it.', 'Count: about 4.5 to 5.9 ×10¹²/L (men), 4.0 to 5.2 ×10¹²/L (women). Haemoglobin about 13.5 to 17.5 g/dL (men), 12.0 to 15.5 g/dL (women).'],
  neut: ['Neutrophil', 'The most common white cell and the first to arrive at a bacterial infection. It swallows bacteria (phagocytosis) and dies doing it; pus is mostly dead neutrophils. Its nucleus has 3 to 5 lobes.', 'About 2.0 to 7.5 ×10⁹/L, roughly 40 to 75% of white cells. Rises in bacterial infection.'],
  lymph: ['Lymphocyte', 'B cells (make antibodies), T cells (helper CD4 and cytotoxic CD8) and natural killer cells. A large round nucleus fills most of the cell. The adaptive immune system is built from these.', 'About 1.0 to 4.0 ×10⁹/L, roughly 20 to 40% of white cells. Often rises in viral infection.'],
  mono: ['Monocyte', 'The largest white cell, with a kidney shaped nucleus. It leaves the blood and becomes a macrophage (or dendritic cell) in the tissues, eating debris and microbes and presenting antigen to T cells.', 'About 0.2 to 1.0 ×10⁹/L, roughly 2 to 10% of white cells.'],
  eos: ['Eosinophil', 'Two lobed nucleus and orange-red granules. Fights parasites such as worms and takes part in allergy and asthma.', 'Up to about 0.5 ×10⁹/L, roughly 1 to 6% of white cells.'],
  baso: ['Basophil', 'The rarest white cell, packed with dark granules of histamine and heparin. Releases them in allergic reactions, like mast cells in tissues.', 'Up to about 0.2 ×10⁹/L, under 1% of white cells.'],
  plt: ['Platelets (thrombocytes)', 'Small fragments of megakaryocytes in the bone marrow, with no nucleus. They stick to damaged vessel walls and to each other, forming the first plug, and support the clotting cascade.', 'About 150 to 400 ×10⁹/L. Live about 7 to 10 days.'],
  plasma: ['Plasma', 'The pale yellow liquid, about 55% of blood. Mostly water (about 90%), with proteins (albumin, which holds water in the vessels, globulins including antibodies, and fibrinogen for clotting), salts, glucose, hormones and waste. Serum is plasma after clotting, without the clotting factors.', 'An adult has about 5 L of blood, roughly 70 mL per kg.'],
  buffy: ['Buffy coat', 'A thin pale layer between plasma and red cells after spinning: the white cells and platelets. Under 1% of the volume.', 'Total white cells about 4.0 to 11.0 ×10⁹/L.'],
  hct: ['Packed red cells', 'Red cells are heaviest, so they sink to the bottom. The fraction of blood volume they take up is the haematocrit.', 'Haematocrit about 41 to 50% (men), 36 to 44% (women).'],
};

const TYPES = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
const ag = (t) => ({ A: t.startsWith('A'), B: t.includes('B'), D: t.endsWith('+') });
const compatible = (donor, rec) => { const d = ag(donor); const r = ag(rec); return (!d.A || r.A) && (!d.B || r.B) && (!d.D || r.D); };
function why(donor, rec) {
  const d = ag(donor); const r = ag(rec);
  const ab = []; if (!r.A) ab.push('anti-A'); if (!r.B) ab.push('anti-B');
  const probs = [];
  if (d.A && !r.A) probs.push('donor cells carry A antigen and the recipient\'s plasma has anti-A');
  if (d.B && !r.B) probs.push('donor cells carry B antigen and the recipient\'s plasma has anti-B');
  if (probs.length) return `No. The ${probs.join(', and ')}. The antibodies bind the cells, clump them and destroy them: an acute haemolytic transfusion reaction.`;
  if (d.D && !r.D) return 'No, avoid it. The donor cells are RhD positive. An RhD negative person usually has no anti-D yet, but the transfusion can trigger it, and a later exposure (or a future pregnancy with an RhD positive baby) can cause haemolysis.';
  return `Yes. The donor cells carry ${[d.A && 'A', d.B && 'B', d.D && 'D'].filter(Boolean).join(', ') || 'no A, B or D antigen'}${d.A || d.B || d.D ? ' antigen' : ''}, and the recipient has no antibody against ${d.A || d.B || d.D ? 'them' : 'that'}.${ab.length ? ` (The recipient's plasma has ${ab.join(' and ')}, which these cells do not trigger.)` : ''}`;
}

// immune model, time in days
const IP = { r: 1.5, kI: 0.4, kT: 0.012, kA: 0.0035, s: 1.1, dE: 0.35 };
function ideriv(s) {
  const ant = s.P + s.V;
  const stim = ant / (ant + 1);
  const h = (s.P + 0.3 * s.V) / (s.P + 0.3 * s.V + 100);
  const seed = 0.03 * (1 + 1500 * s.Mem / (s.Mem + 1));
  const ab = IP.kA * (s.M + s.G);
  return {
    P: IP.r * s.P * (1 - s.P / 1e5) - IP.kI * s.I * s.P - ab * s.P - IP.kT * s.E * s.P,
    V: -0.35 * s.V - ab * s.V,
    I: 2.5 * h - 0.9 * s.I,
    E: IP.s * stim * s.E + seed * stim - IP.dE * (1 - stim) * s.E,
    S: 0.2 * stim * (1 - s.S),
    M: 0.4 * s.E * (1 - s.S) - 0.2 * s.M,
    G: 0.4 * s.E * s.S - 0.03 * s.G,
    Mem: 0.004 * s.E * stim,
  };
}
const DAYS = 90;

export default {
  mount(ctx) {
    injectStyle();
    const cv = ctx.canvas();
    const g = cv.ctx;
    let view = ctx.store.get('blood:view', 'cells');
    let selCell = null; const cellHits = [];
    // transfusion state
    let pair = null; let mixT = 0; const revealed = new Set(ctx.store.get('blood:rev', [])); let score = [0, 0]; let q = null; const mHits = [];
    const rbcs = Array.from({ length: 22 }, () => ({ a: Math.random() * 6.28, r: Math.sqrt(Math.random()), v: Math.random() * 6.28 }));
    // immune state
    let im; let hist; let tDay; let running = false; let events = [];
    function resetImm() { im = { P: 0, V: 0, I: 0, E: 0, S: 0, M: 0, G: 0, Mem: 0 }; hist = []; tDay = 0; running = false; events = []; }
    resetImm();

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Blood and immunity</h2>'),
      ctx.h('<p class="lede">Blood is a liquid tissue: cells that carry oxygen, cells that defend you and fragments that plug leaks, all floating in plasma. Explore what it is made of, who can donate to whom, and how your defences learn.</p>'),
    );
    const seg = ctx.seg([['cells', 'Components'], ['abo', 'Transfusion'], ['imm', 'Immunity']], view, (v) => { view = v; ctx.store.set('blood:view', v); showView(); draw(); });
    ctx.panel.append(seg);

    // --- components panel
    const pCells = ctx.h('<div style="display:grid;gap:14px"></div>');
    const cellInfo = ctx.h('<div class="card bio-info"><h3>Tap a cell or a layer</h3><p class="small muted">The tube shows blood after spinning in a centrifuge. The circles are the cells you would see on a stained blood smear (not to scale).</p></div>');
    pCells.append(cellInfo,
      ctx.h('<div class="card tip"><p>Spin a tube of blood and it separates: straw coloured plasma on top, a thin white layer of white cells and platelets, and packed red cells at the bottom. Red cells carry oxygen, white cells fight infection, platelets start clotting.</p></div>'),
      ctx.h('<div class="card try"><ol class="small"><li>Tap each white cell and compare their nuclei: lobed, round, kidney shaped.</li><li>Tap the layers in the tube. Which number on a blood count does the red layer give you?</li></ol></div>'),
      ctx.h('<details class="more"><summary>Going deeper</summary><div class="small"><p><b>Where they come from.</b> All blood cells come from haematopoietic stem cells in the red bone marrow. Erythropoietin from the kidney drives red cell production when oxygen is low, which is why chronic kidney disease often causes anaemia.</p><p><b>A full blood count</b> reports haemoglobin, haematocrit, red cell indices such as MCV (mean cell volume, about 80 to 100 fL; low in iron deficiency, high in B12 or folate deficiency), white count with differential, and platelets. Ranges here are typical adult values; each lab sets its own.</p><p><b>Remember the order</b> of white cells from most to least common: Never Let Monkeys Eat Bananas (neutrophils, lymphocytes, monocytes, eosinophils, basophils).</p></div></details>'));
    // --- transfusion panel
    const pAbo = ctx.h('<div style="display:grid;gap:14px"></div>');
    const qCard = ctx.h('<div class="card"><div class="eyebrow">Quick fire</div><p class="prompt q"></p><div class="row"><button class="btn sm yes">Yes, safe</button><button class="btn ghost sm no">No</button><span class="hint sc"></span></div><p class="small fb"></p></div>');
    const pairInfo = ctx.h('<p class="small muted">Tap any box in the grid to test that donor and recipient.</p>');
    const showAll = ctx.h('<button class="btn ghost sm">Reveal the whole grid</button>');
    showAll.onclick = () => { for (const d of TYPES) for (const r of TYPES) revealed.add(`${d}>${r}`); ctx.store.set('blood:rev', [...revealed]); draw(); };
    pAbo.append(qCard, pairInfo, showAll,
      ctx.h('<div class="card tip"><p>Your red cells carry markers (antigens): A, B, both or neither, and RhD (positive) or not (negative). Your plasma has antibodies against the A and B markers you lack. Red cells are safe to give only if the recipient has no antibody against any marker on them. So O negative red cells can go to almost anyone, and AB positive people can receive from anyone.</p></div>'),
      ctx.h('<div class="card try"><ol class="small"><li>Answer a few quick fire questions, then check the grid.</li><li>Find the O- column (universal red cell donor) and the AB+ row (universal recipient).</li><li>Tap A+ donor to O+ recipient and watch the cells clump.</li></ol></div>'),
      ctx.h('<details class="more"><summary>Going deeper</summary><div class="small"><p><b>Plasma is the reverse.</b> For plasma, the donor\'s antibodies matter, so AB plasma (no anti-A or anti-B) is the universal plasma donor and O is the universal plasma recipient.</p><p><b>Why anti-A and anti-B exist without exposure.</b> They are IgM antibodies made in early childhood, probably in response to similar sugars on gut bacteria. Anti-D is IgG and only forms after exposure to RhD positive cells.</p><p><b>Haemolytic disease of the newborn.</b> An RhD negative mother sensitised by an earlier RhD positive baby makes IgG anti-D, which crosses the placenta. Anti-D immunoglobulin given in pregnancy prevents the sensitisation.</p><p><b>In practice</b> blood is cross-matched before transfusion, because many other antigen systems exist (Kell, Duffy, Kidd and more).</p></div></details>'));
    // --- immunity panel
    const pImm = ctx.h('<div style="display:grid;gap:14px"></div>');
    const immRow = ctx.h('<div class="row"></div>');
    const bInf = ctx.h('<button class="btn sm">Infect</button>');
    const bVac = ctx.h('<button class="btn ghost sm">Vaccinate</button>');
    const bRst = ctx.h('<button class="btn ghost sm">Reset</button>');
    bInf.onclick = () => { im.P += 50; events.push([tDay, 'infection']); running = true; };
    bVac.onclick = () => { im.V += 400; events.push([tDay, 'vaccine']); running = true; };
    bRst.onclick = () => { resetImm(); draw(); };
    immRow.append(bInf, bVac, bRst);
    const immStat = ctx.h('<div class="stat"></div>');
    pImm.append(immRow, immStat,
      ctx.h('<div class="card tip"><p>Innate immunity is the fast, general first line: skin, inflammation, neutrophils, macrophages and complement. It acts within minutes to hours but does not learn. Adaptive immunity (B and T cells) is slow the first time, about one to two weeks, but highly specific, and it leaves memory cells, so the next encounter is quicker and stronger.</p></div>'),
      ctx.h('<div class="card try"><ol class="small"><li>Press Infect. Watch the pathogen grow, the innate response rise, then IgM and later IgG appear as the pathogen is cleared.</li><li>After it is cleared (around day 30), press Infect again. The pathogen barely gets going and IgG jumps quickly: a secondary response.</li><li>Reset, press Vaccinate, wait, then Infect. The vaccine trains memory without the illness.</li></ol></div>'),
      ctx.h(`<details class="more"><summary>Going deeper</summary><div class="small">
        <table class="bio-tbl"><tr><th></th><th>Innate</th><th>Adaptive</th></tr>
        <tr><td>Speed</td><td>Minutes to hours</td><td>Days (first time)</td></tr>
        <tr><td>Specificity</td><td>Broad patterns (PAMPs via toll-like receptors)</td><td>One antigen per clone</td></tr>
        <tr><td>Memory</td><td>No</td><td>Yes</td></tr>
        <tr><td>Cells</td><td>Neutrophils, macrophages, dendritic cells, NK cells, mast cells</td><td>B cells, plasma cells, CD4 and CD8 T cells</td></tr>
        <tr><td>Molecules</td><td>Complement, interferons, cytokines</td><td>Antibodies</td></tr></table>
        <p><b>Linking the two.</b> Dendritic cells pick up antigen and carry it to lymph nodes. They show it on MHC class II to CD4 helper T cells, which activate B cells and help them class switch from IgM to IgG. Infected cells show viral peptides on MHC class I, which CD8 cytotoxic T cells recognise and kill.</p>
        <p><b>Antibody classes.</b> IgM comes first (a pentamer, good at fixing complement). IgG dominates later responses, crosses the placenta and has a half-life of about three weeks. IgA guards mucosa and breast milk, IgE drives allergy and fights parasites.</p>
        <p><b>About this model.</b> The curves come from a small set of equations: pathogen growth, killing by innate cells, antibodies and T cells, clonal expansion and memory. The shapes are realistic, the numbers are illustrative.</p></div></details>`));
    ctx.panel.append(pCells, pAbo, pImm);
    function showView() { pCells.hidden = view !== 'cells'; pAbo.hidden = view !== 'abo'; pImm.hidden = view !== 'imm'; }
    showView();

    // quick fire question
    function newQ() { q = [TYPES[Math.floor(Math.random() * 8)], TYPES[Math.floor(Math.random() * 8)]]; qCard.querySelector('.q').textContent = `Can a ${q[1]} recipient safely receive ${q[0]} red cells?`; qCard.querySelector('.fb').textContent = ''; qCard.querySelectorAll('button').forEach((b) => (b.disabled = false)); }
    function answer(yes) {
      const ok = compatible(q[0], q[1]) === yes; score[0] += ok ? 1 : 0; score[1]++;
      qCard.querySelector('.sc').textContent = `${score[0]} of ${score[1]}`;
      qCard.querySelector('.fb').innerHTML = `${ok ? 'Right.' : 'Not quite.'} ${why(q[0], q[1])} <button class="btn ghost sm nx" style="margin-top:6px">Next</button>`;
      qCard.querySelector('.nx').onclick = newQ;
      qCard.querySelectorAll('.yes,.no').forEach((b) => (b.disabled = true));
      selectPair(q[0], q[1]);
    }
    qCard.querySelector('.yes').onclick = () => answer(true);
    qCard.querySelector('.no').onclick = () => answer(false);
    newQ();
    function selectPair(d, r) { pair = [d, r]; mixT = 0; revealed.add(`${d}>${r}`); ctx.store.set('blood:rev', [...revealed]); pairInfo.innerHTML = `<b>${d} donor to ${r} recipient.</b> ${why(d, r)}`; pairInfo.classList.remove('muted'); }

    pointer(cv.el, ctx.signal, { down: (x, y) => {
      if (view === 'cells') { for (const [hx, hy, hr, id] of cellHits) if ((x - hx) ** 2 + (y - hy) ** 2 < hr * hr || (hr < 0 && x > hx && x < hx - hr && y > hy[0] && y < hy[1])) { selCell = id; const [n, d, r] = CELLS[id]; cellInfo.innerHTML = `<h3>${n}</h3><p class="small">${d}</p><p class="small muted">${r}</p>`; draw(); return; } }
      if (view === 'abo') { for (const [hx, hy, s, d, r] of mHits) if (x > hx && x < hx + s && y > hy && y < hy + s) { selectPair(d, r); draw(); return; } }
    } });

    // drawing helpers
    function drawCell(id, x, y, R, on) {
      g.save(); g.translate(x, y);
      if (on) { g.strokeStyle = '#F5F5F0'; g.lineWidth = 1.5; g.setLineDash([3, 3]); g.beginPath(); g.arc(0, 0, R * 1.25, 0, 7); g.stroke(); g.setLineDash([]); }
      const purple = '#7c3aed';
      if (id === 'rbc') { const gr = g.createRadialGradient(0, 0, R * 0.1, 0, 0, R); gr.addColorStop(0, '#b91c1c'); gr.addColorStop(0.45, '#dc2626'); gr.addColorStop(1, '#f87171'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 0.8, 0, 7); g.fill(); }
      else if (id === 'plt') { g.fillStyle = '#c4b5fd'; for (const [dx, dy, r] of [[-R * 0.5, -R * 0.2, R * 0.22], [R * 0.3, R * 0.25, R * 0.18], [R * 0.1, -R * 0.5, R * 0.15]]) { g.beginPath(); g.arc(dx, dy, r, 0, 7); g.fill(); } }
      else {
        const size = id === 'mono' ? 1 : id === 'lymph' ? 0.72 : 0.9;
        g.fillStyle = id === 'eos' ? 'rgba(251,146,60,.28)' : 'rgba(232,232,227,.16)'; g.strokeStyle = 'rgba(232,232,227,.45)'; g.lineWidth = 1;
        g.beginPath(); g.arc(0, 0, R * size, 0, 7); g.fill(); g.stroke();
        g.fillStyle = purple;
        if (id === 'neut') { for (const [dx, dy] of [[-R * 0.38, -R * 0.1], [-R * 0.05, -R * 0.32], [R * 0.3, -R * 0.05], [R * 0.08, R * 0.3]]) { g.beginPath(); g.arc(dx, dy, R * 0.2, 0, 7); g.fill(); } g.strokeStyle = purple; g.lineWidth = R * 0.08; g.beginPath(); g.moveTo(-R * 0.38, -R * 0.1); g.lineTo(-R * 0.05, -R * 0.32); g.lineTo(R * 0.3, -R * 0.05); g.lineTo(R * 0.08, R * 0.3); g.stroke(); }
        else if (id === 'lymph') { g.beginPath(); g.arc(R * 0.04, 0, R * 0.6, 0, 7); g.fill(); }
        else if (id === 'mono') { g.beginPath(); g.ellipse(R * 0.05, 0, R * 0.55, R * 0.45, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(232,232,227,.16)'; g.beginPath(); g.arc(R * 0.5, 0, R * 0.25, 0, 7); g.fill(); }
        else if (id === 'eos') { g.beginPath(); g.arc(-R * 0.32, 0, R * 0.3, 0, 7); g.arc(R * 0.32, 0, R * 0.3, 0, 7); g.fill(); g.fillStyle = '#fb923c'; for (let i = 0; i < 16; i++) { const a = i * 2.4; const rr = R * (0.45 + 0.3 * ((i * 7) % 5) / 5); g.beginPath(); g.arc(Math.cos(a) * rr, Math.sin(a) * rr, R * 0.07, 0, 7); g.fill(); } }
        else if (id === 'baso') { g.beginPath(); g.arc(0, 0, R * 0.45, 0, 7); g.fill(); g.fillStyle = '#3b0764'; for (let i = 0; i < 22; i++) { const a = i * 2.4; const rr = R * (0.15 + 0.6 * ((i * 7) % 6) / 6); g.beginPath(); g.arc(Math.cos(a) * rr, Math.sin(a) * rr, R * 0.08, 0, 7); g.fill(); } }
      }
      g.restore();
    }

    function drawCells() {
      const { w, h } = cv; cellHits.length = 0;
      // tube
      const tw = Math.min(70, w * 0.14); const th = Math.min(h - 80, 420); const tx = Math.max(18, w * 0.06); const ty = (h - th) / 2;
      const lv = [['plasma', 0.55, 'rgba(250,204,21,.55)'], ['buffy', 0.012, 'rgba(245,245,240,.9)'], ['hct', 0.438, 'rgba(185,28,28,.9)']];
      let yy = ty + 20;
      g.strokeStyle = 'rgba(245,245,240,.7)'; g.lineWidth = 2;
      for (const [id, f, col] of lv) {
        const hh = (th - 20) * f;
        g.fillStyle = col; g.fillRect(tx, yy, tw, Math.max(hh, 3));
        if (selCell === id) { g.strokeStyle = '#F5F5F0'; g.setLineDash([3, 3]); g.strokeRect(tx - 4, yy - 2, tw + 8, Math.max(hh, 3) + 4); g.setLineDash([]); }
        cellHits.push([tx, [yy - (id === 'buffy' ? 8 : 0), yy + Math.max(hh, 3) + (id === 'buffy' ? 8 : 0)], -tw, id]);
        g.font = MONO(10.5); g.fillStyle = '#A0A09A'; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText(id === 'plasma' ? 'plasma 55%' : id === 'buffy' ? 'buffy coat <1%' : 'red cells ~45%', tx + tw + 8, yy + Math.max(hh, 3) / 2);
        yy += hh;
      }
      g.strokeStyle = 'rgba(245,245,240,.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx, ty + th - tw / 2); g.arc(tx + tw / 2, ty + th - tw / 2, tw / 2, Math.PI, 0, true); g.lineTo(tx + tw, ty); g.stroke();
      // cells grid
      const ids = ['rbc', 'neut', 'lymph', 'mono', 'eos', 'baso', 'plt'];
      const gx = tx + tw + 120; const gw = w - gx - 10;
      const cols = gw > 420 ? 4 : gw > 260 ? 3 : 2; const rows = Math.ceil(ids.length / cols);
      const cw = gw / cols; const ch = Math.min((h - 40) / rows, cw * 1.1);
      const R = Math.min(cw, ch) * 0.28;
      const y0 = (h - rows * ch) / 2;
      ids.forEach((id, i) => {
        const cx = gx + (i % cols + 0.5) * cw; const cy = y0 + (Math.floor(i / cols) + 0.42) * ch;
        drawCell(id, cx, cy, R, selCell === id);
        cellHits.push([cx, cy, R * 1.2, id]);
        g.font = MONO(10.5); g.fillStyle = selCell === id ? '#F5F5F0' : '#A0A09A'; g.textAlign = 'center';
        g.fillText(CELLS[id][0].replace(/ \(.*\)/, ''), cx, cy + R * 1.35 + 8);
      });
    }

    function drawAbo(dt) {
      const { w, h } = cv; mHits.length = 0;
      const topH = Math.min(h * 0.34, 230);
      // mixing view
      if (pair) {
        mixT += dt;
        const [d, r] = pair; const bad = !compatible(d, r); const abo = bad && (() => { const A = ag(d); const B = ag(r); return (A.A && !B.A) || (A.B && !B.B); })();
        const narrow = w < 640; const R = topH * 0.42; const cx = narrow ? w - R - 12 : w / 2; const cy = topH / 2 + 4;
        g.strokeStyle = 'rgba(245,245,240,.4)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
        g.fillStyle = 'rgba(250,204,21,.07)'; g.fill();
        const da = ag(d); const ra = ag(r);
        const clump = abo ? clamp((mixT - 0.6) / 1.6, 0, 1) : 0;
        const centers = [[-0.35, -0.2], [0.3, 0.1], [-0.05, 0.4]];
        rbcs.forEach((c, i) => {
          if (!reduced()) { c.a += Math.sin(mixT + c.v) * 0.004; }
          let x = Math.cos(c.a) * c.r * R * 0.8; let y = Math.sin(c.a) * c.r * R * 0.8;
          const ce = centers[i % 3]; const tx2 = ce[0] * R + Math.cos(i) * R * 0.12; const ty2 = ce[1] * R + Math.sin(i * 1.7) * R * 0.12;
          x += (tx2 - x) * clump; y += (ty2 - y) * clump;
          const rr = R * 0.09;
          g.fillStyle = '#dc2626'; g.beginPath(); g.arc(cx + x, cy + y, rr, 0, 7); g.fill();
          g.fillStyle = 'rgba(127,29,29,.8)'; g.beginPath(); g.arc(cx + x, cy + y, rr * 0.45, 0, 7); g.fill();
          // antigens
          const mk = []; if (da.A) mk.push('#FBBF24'); if (da.B) mk.push('#60A5FA'); if (da.D) mk.push('#A3E635');
          mk.forEach((col, k) => { const a = k * 2.1 + i; g.fillStyle = col; g.beginPath(); g.arc(cx + x + Math.cos(a) * rr * 1.05, cy + y + Math.sin(a) * rr * 1.05, rr * 0.28, 0, 7); g.fill(); });
        });
        // antibodies (Y shapes) for what the recipient lacks
        const abs = []; if (!ra.A) abs.push(['#FBBF24', 'anti-A']); if (!ra.B) abs.push(['#60A5FA', 'anti-B']);
        for (let i = 0; i < 14 && abs.length; i++) {
          const [col] = abs[i % abs.length]; const a = i * 2.39 + mixT * 0.3; const rr = R * (0.3 + 0.5 * ((i * 5) % 7) / 7);
          const x = cx + Math.cos(a) * rr; const y = cy + Math.sin(a) * rr; const s = R * 0.06;
          g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y + s); g.lineTo(x, y); g.lineTo(x - s * 0.8, y - s * 0.8); g.moveTo(x, y); g.lineTo(x + s * 0.8, y - s * 0.8); g.stroke();
        }
        g.font = MONO(10.5); g.textAlign = 'left'; g.textBaseline = 'middle';
        const lx = narrow ? 8 : Math.max(8, cx - R - 170); let ly = narrow ? 14 : cy - 30;
        g.fillStyle = '#E8E8E3'; g.fillText(`donor ${d} red cells`, lx, ly); ly += 18;
        g.fillStyle = '#A0A09A'; g.fillText(`antigens: ${[da.A && 'A', da.B && 'B', da.D && 'D'].filter(Boolean).join(' ') || 'none'}`, lx, ly); ly += 18;
        g.fillText(`recipient ${r} plasma: ${abs.map((x) => x[1]).join(' ') || 'no anti-A/B'}`, lx, ly);
        g.textAlign = narrow ? 'left' : 'right'; g.font = DISP(18, 700); g.fillStyle = bad ? '#FB7185' : '#4ade80';
        g.fillText(bad ? (abo ? 'AGGLUTINATION' : 'AVOID (RhD)') : 'COMPATIBLE', narrow ? 8 : w - 10, narrow ? ly + 26 : cy - 8);
        g.font = MONO(10); g.fillStyle = '#A0A09A'; g.textAlign = 'right';
        let kx = narrow ? 150 : w - 10; const ky = narrow ? ly + 52 : cy + 16; for (const [col, t] of [['#A3E635', 'D'], ['#60A5FA', 'B'], ['#FBBF24', 'A']]) { g.fillText(t, kx, ky); kx -= 12; g.fillStyle = col; g.beginPath(); g.arc(kx, ky, 4, 0, 7); g.fill(); g.fillStyle = '#A0A09A'; kx -= 14; }
        g.textAlign = 'right'; g.fillText('antigen', kx, ky);
      } else {
        g.font = MONO(11); g.fillStyle = '#A0A09A'; g.textAlign = 'center'; g.fillText('Pick a pair to mix donor cells with recipient plasma', w / 2, topH / 2);
      }
      // matrix
      const head = 34; const avail = Math.min(w - 20, h - topH - 30);
      const s = (avail - head) / 8; const mx = (w - (head + s * 8)) / 2; const my = topH + 18;
      g.font = MONO(clamp(s * 0.26, 9, 12)); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#A0A09A';
      TYPES.forEach((t, i) => { g.fillText(t, mx + head + s * (i + 0.5), my + head * 0.55); g.fillText(t, mx + head * 0.45, my + head + s * (i + 0.5)); });
      g.font = MONO(10); g.fillText('donor →', mx + head + s * 4, my + 6);
      g.save(); g.translate(mx - 4, my + head + s * 4); g.rotate(-Math.PI / 2); g.fillText('recipient →', 0, 0); g.restore();
      TYPES.forEach((r, i) => TYPES.forEach((d, j) => {
        const x = mx + head + j * s; const y = my + head + i * s;
        const key = `${d}>${r}`; const rev = revealed.has(key); const ok = compatible(d, r);
        const on = pair && pair[0] === d && pair[1] === r;
        g.fillStyle = rev ? (ok ? 'rgba(74,222,128,.28)' : 'rgba(251,113,133,.16)') : 'rgba(255,255,255,.05)';
        g.beginPath(); g.roundRect(x + 1.5, y + 1.5, s - 3, s - 3, 4); g.fill();
        if (on) { g.strokeStyle = '#F5F5F0'; g.lineWidth = 2; g.stroke(); }
        if (rev) { g.fillStyle = ok ? '#4ade80' : '#FB7185'; g.font = MONO(clamp(s * 0.34, 9, 14)); g.fillText(ok ? '✓' : '×', x + s / 2, y + s / 2 + 1); }
        mHits.push([x, y, s, d, r]);
      }));
    }

    function stepImm(dtDays) {
      const n = Math.ceil(dtDays / 0.005); const h = dtDays / n;
      for (let i = 0; i < n; i++) {
        const d = ideriv(im); for (const k in im) im[k] = Math.max(0, im[k] + d[k] * h);
        if (im.P < 1e-2) im.P = 0; if (im.V < 1e-2) im.V = 0;
        tDay += h;
      }
      hist.push([tDay, { ...im }]);
      if (tDay >= DAYS) running = false;
    }
    function drawImm() {
      const { w, h } = cv;
      const fh = Math.min(h * 0.42, 260);
      // flow diagram
      const nodes = [
        ['Barriers', 'skin, mucus', 0.03, 0.12, () => (im.P > 0 ? 0.6 : 0.2)],
        ['Innate cells', 'neutrophils, macrophages, NK, complement', 0.03, 0.55, () => im.I / 2.6],
        ['Dendritic cell', 'carries antigen to lymph node', 0.36, 0.55, () => (im.P + im.V) / (im.P + im.V + 1)],
        ['Helper T (CD4)', 'coordinates', 0.36, 0.12, () => im.E / 800],
        ['B cell to plasma cell', 'makes antibodies', 0.69, 0.12, () => im.E / 800],
        ['Cytotoxic T (CD8)', 'kills infected cells', 0.69, 0.55, () => im.E / 800],
      ];
      const bw = w * 0.29; const bh = fh * 0.32;
      const pos = nodes.map(([, , x, y]) => [x * w, y * fh + 6]);
      g.strokeStyle = 'rgba(245,245,240,.35)'; g.fillStyle = 'rgba(245,245,240,.35)'; g.lineWidth = 1.2;
      const ar = (a, b) => { const [ax, ay] = pos[a]; const [bx, by] = pos[b]; if (ay === by) arrow(g, ax + bw + 2, ay + bh / 2, bx - 4, by + bh / 2, 6); else arrow(g, ax + bw / 2, ay + (by > ay ? bh + 2 : -2), bx + bw / 2, by + (by > ay ? -4 : bh + 4), 6); };
      ar(0, 1); ar(1, 2); ar(2, 3); ar(3, 4); ar(3, 5);
      nodes.forEach(([t, sub, , , f], i) => {
        const [x, y] = pos[i]; const a = clamp(f(), 0, 1);
        const col = i < 2 ? '#FBBF24' : i === 2 ? '#A78BFA' : '#5EEAD4';
        g.fillStyle = rgba(col, 0.06 + 0.3 * a); g.strokeStyle = rgba(col, 0.35 + 0.65 * a); g.lineWidth = 1.2;
        g.beginPath(); g.roundRect(x, y, bw, bh, 8); g.fill(); g.stroke();
        g.fillStyle = '#F5F5F0'; g.font = DISP(clamp(w / 48, 12, 16), 700); g.textAlign = 'left'; g.textBaseline = 'top';
        g.fillText(t.toUpperCase(), x + 8, y + 7, bw - 14);
        if (bh > 44) { g.font = MONO(10); g.fillStyle = '#A0A09A'; g.fillText(sub, x + 8, y + 7 + clamp(w / 48, 12, 16) + 6, bw - 14); }
      });
      g.textBaseline = 'middle'; g.font = MONO(10); g.fillStyle = '#A0A09A'; g.textAlign = 'left';
      const memA = clamp(im.Mem / 3, 0, 1);
      g.fillStyle = rgba('#A3E635', 0.4 + 0.6 * memA); g.textAlign = 'right'; g.fillText(`memory cells: ${memA > 0.05 ? 'present' : 'none yet'}`, pos[5][0] + bw, pos[5][1] + bh + 12);
      // graph
      const gx = 40; const gy = fh + (w < 500 ? 46 : 34); const gw = w - gx - 12; const gh = h - gy - 34;
      g.strokeStyle = 'rgba(255,255,255,.1)'; g.lineWidth = 1; g.strokeRect(gx, gy, gw, gh);
      g.fillStyle = '#5A5A55'; g.textAlign = 'center';
      for (let d = 0; d <= DAYS; d += 10) { const x = gx + (d / DAYS) * gw; g.fillText(`${d}`, x, gy + gh + 10); }
      g.fillText('days', gx + gw / 2, gy + gh + 22);
      const X = (d) => gx + (d / DAYS) * gw;
      const series = [
        ['pathogen (log scale)', '#FB7185', (s) => (s.P > 0 ? clamp((Math.log10(s.P) + 1) / 6, 0, 1) : 0)],
        ['innate', '#FBBF24', (s) => s.I / 3],
        ['IgM', '#A78BFA', (s) => s.M / 900],
        ['IgG', '#5EEAD4', (s) => s.G / 900],
        ['T cells', '#60A5FA', (s) => s.E / 900],
      ];
      for (const [, col, f] of series) {
        g.strokeStyle = col; g.lineWidth = 1.8; g.beginPath();
        hist.forEach(([d, s], i) => { const x = X(d); const y = gy + gh - clamp(f(s), 0, 1) * (gh - 6); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
        g.stroke();
      }
      for (const [d, lab] of events) { const x = X(d); g.strokeStyle = 'rgba(245,245,240,.4)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, gy); g.lineTo(x, gy + gh); g.stroke(); g.setLineDash([]); g.fillStyle = '#E8E8E3'; g.textAlign = 'left'; g.fillText(lab, x + 4, gy + 9); }
      let lx = gx; g.textAlign = 'left'; let ly2 = gy - 11;
      if (w < 500) ly2 -= 14;
      for (const [lab, col] of series) { if (lx + g.measureText(lab).width + 14 > w - 4) { lx = gx; ly2 += 14; } g.fillStyle = col; g.fillRect(lx, ly2 - 1, 10, 3); g.fillStyle = '#A0A09A'; g.fillText(lab, lx + 14, ly2); lx += g.measureText(lab).width + (w < 500 ? 20 : 30); }
      if (!hist.length) { g.fillStyle = '#A0A09A'; g.textAlign = 'center'; g.font = MONO(11); g.fillText('Press Infect or Vaccinate to start the clock', gx + gw / 2, gy + gh / 2); }
    }

    let lastStat = '';
    function draw(dt = 0) {
      const { w, h } = cv; if (!w) return;
      g.clearRect(0, 0, w, h);
      if (view === 'cells') drawCells();
      else if (view === 'abo') drawAbo(dt);
      else drawImm();
    }
    cv.onResize(() => draw());
    ctx.loop((t, dt) => {
      if (view === 'imm' && running) stepImm(dt * 3);
      if (view === 'imm') {
        const st = `<div><b>${tDay.toFixed(0)}</b><span>day</span></div><div><b>${im.P > 0 ? im.P.toExponential(0) : '0'}</b><span>pathogen</span></div><div><b>${Math.round(im.M)}</b><span>IgM</span></div><div><b>${Math.round(im.G)}</b><span>IgG</span></div>`;
        if (st !== lastStat) { immStat.innerHTML = st; lastStat = st; }
      }
      if (view !== 'cells') draw(dt);
    });

    ctx.quiz([
      { q: 'A patient is blood group B negative. Which red cells can they safely receive?', choices: ['B- and O- only', 'B+, B-, O+ and O-', 'Any group', 'AB- only'], answer: 0, why: 'They have anti-A, so no A or AB cells, and as RhD negative they should get RhD negative cells: B- or O-.' },
      { q: 'Which white blood cell is the most common in normal blood and rises first in a bacterial infection?', choices: ['Lymphocyte', 'Neutrophil', 'Eosinophil', 'Basophil'], answer: 1, why: 'Neutrophils are 40 to 75% of white cells and are the first responders to bacteria.' },
      { q: 'Why is the second response to the same pathogen faster and stronger?', choices: ['The pathogen is weaker the second time', 'Memory B and T cells already exist and expand quickly, mostly making IgG', 'Innate immunity remembers the pathogen', 'Antibodies from the first time never fade'], answer: 1, why: 'Memory cells skip the slow first steps. Innate immunity has no antigen-specific memory.' },
    ]);
    return () => {};
  },
};
