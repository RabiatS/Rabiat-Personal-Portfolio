// Chapter 5: mutations. Edit bases in the start of the human beta globin gene and see how the protein changes.
import { MONO, DISP, BASE_COL, CODE, AA3, AANAME, AACLASS, CLASS_COL, injectStyle, dock, pointer, rgba } from './_shared.js';

// First 21 codons of the human HBB coding sequence (beta globin): M V H L T P E E K S A V T A L W G K V N V
const HBB = 'ATGGTGCATCTGACTCCTGAGGAGAAGTCTGCCGTTACTGCCCTGTGGGGCAAGGTGAACGTG';

const translate = (dna) => {
  const out = [];
  for (let i = 0; i + 3 <= dna.length; i += 3) { const aa = CODE[dna.slice(i, i + 3).replace(/T/g, 'U')]; out.push(aa); if (aa === '*') break; }
  return out;
};

const PRESETS = [
  ['Sickle cell (HbS)', (s) => s.slice(0, 19) + 'T' + s.slice(20), 'GAG to GTG in codon 7 (A to T). Glutamate, charged, becomes valine, hydrophobic.'],
  ['HbC', (s) => s.slice(0, 18) + 'A' + s.slice(19), 'GAG to AAG in the same codon. Glutamate becomes lysine.'],
  ['Silent', (s) => s.slice(0, 20) + 'A' + s.slice(21), 'GAG to GAA. Both codons mean glutamate.'],
  ['Nonsense', (s) => s.slice(0, 21) + 'T' + s.slice(22), 'GAG to TAG in codon 8. A stop codon appears.'],
  ['Frameshift', (s) => s.slice(0, 19) + s.slice(20), 'One base deleted in codon 7. Every codon after it is read in the wrong frame.'],
];

function classify(orig, mut) {
  const diff = mut.length - orig.length;
  const po = translate(orig); const pm = translate(mut);
  if (mut === orig) return { kind: 'No mutation', col: '#A0A09A', text: 'The sequence matches the normal gene. Tap a base in your DNA row to change it.' };
  if (diff % 3 !== 0) {
    const stopAt = pm.indexOf('*');
    return { kind: 'Frameshift', col: '#FB7185', text: `${diff > 0 ? 'Inserting' : 'Deleting'} ${Math.abs(diff)} base${Math.abs(diff) > 1 ? 's' : ''} shifts the reading frame. Every codon after the change is read wrongly${stopAt >= 0 ? `, and a stop codon turns up at codon ${stopAt + 1}` : ''}. Frameshifts usually destroy the protein.` };
  }
  if (diff !== 0) return { kind: diff > 0 ? 'In-frame insertion' : 'In-frame deletion', col: '#FBBF24', text: `${Math.abs(diff)} bases is a whole number of codons, so the frame is kept: the protein ${diff > 0 ? 'gains' : 'loses'} ${Math.abs(diff) / 3} amino acid${Math.abs(diff) > 3 ? 's' : ''} but the rest reads normally. The most common cystic fibrosis mutation (F508del) is one of these.` };
  const changes = [];
  for (let i = 0; i < orig.length / 3; i++) {
    const a = orig.slice(i * 3, i * 3 + 3); const b = mut.slice(i * 3, i * 3 + 3);
    if (a !== b) changes.push({ i, a, b, x: CODE[a.replace(/T/g, 'U')], y: CODE[b.replace(/T/g, 'U')] });
  }
  const c = changes[0];
  const where = `Codon ${c.i + 1}: ${c.a} to ${c.b}`;
  if (changes.some((ch) => ch.y === '*' && ch.x !== '*')) return { kind: 'Nonsense', col: '#FB7185', text: `${where}. ${AA3[c.x]} becomes a stop codon, so translation ends early and the protein is cut short (truncated). The mRNA is often destroyed by nonsense mediated decay.` };
  if (changes.every((ch) => ch.x === ch.y)) return { kind: 'Silent', col: '#4ade80', text: `${where}. Both codons code for ${AANAME[c.x]}, so the protein is unchanged. The genetic code has several codons for most amino acids, usually differing in the third base.` };
  const mis = changes.filter((ch) => ch.x !== ch.y).map((ch) => `${AA3[ch.x]}${ch.i + 1}${AA3[ch.y]}`);
  let extra = '';
  if (c.i === 6 && c.y === 'V' && c.x === 'E') extra = ' This is the sickle cell mutation, HbS. Written as p.Glu7Val, or Glu6Val in the older numbering that skips the first methionine (it is removed from the finished protein).';
  else if (c.i === 6 && c.y === 'K' && c.x === 'E') extra = ' This is haemoglobin C (Glu6Lys in the older numbering), which causes a milder anaemia.';
  const ch1 = AACLASS[c.x] !== AACLASS[c.y] ? ` The side chain changes from ${CLASS_COLNAME(AACLASS[c.x])} to ${CLASS_COLNAME(AACLASS[c.y])}, which can change how the protein folds or sticks to others.` : ' The new amino acid has a similar side chain, so the effect may be mild (a conservative change).';
  return { kind: 'Missense', col: '#FBBF24', text: `${where}: ${mis.join(', ')}. One amino acid is swapped for another.${ch1}${extra}` };
}
const CLASS_COLNAME = (k) => ({ np: 'nonpolar', po: 'polar', neg: 'negatively charged', pos: 'positively charged', stop: 'stop' })[k];

export default {
  mount(ctx) {
    injectStyle();
    const cv = ctx.canvas();
    const g = cv.ctx;
    let mut = ctx.store.get('mut:seq', HBB);
    if (!/^[ATGC]{3,90}$/.test(mut)) mut = HBB;
    let sel = 19;
    const hits = [];

    ctx.panel.append(
      ctx.h('<h2 class="k-h">Mutations</h2>'),
      ctx.h('<p class="lede">A mutation is a change in the DNA sequence. One wrong letter out of billions can be harmless, or it can change a protein enough to cause disease. Here is the start of the human beta globin gene, part of haemoglobin.</p>'),
    );
    const res = ctx.h('<div class="card bio-info"><div class="bio-big"></div><p class="small"></p></div>');
    ctx.panel.append(res);
    const pres = ctx.h('<div class="bio-chips"></div>');
    for (const [n, f, d] of PRESETS) { const b = ctx.h(`<button class="chip">${n}</button>`); b.onclick = () => { mut = f(HBB); ctx.store.set('mut:seq', mut); update(); }; pres.append(b); }
    const rs = ctx.h('<button class="chip">Normal gene</button>'); rs.onclick = () => { mut = HBB; ctx.store.set('mut:seq', mut); update(); }; pres.append(rs);
    ctx.panel.append(pres);

    dock(ctx, [
      { label: 'Base', momentary: true, items: [['A', 'A'], ['T', 'T'], ['G', 'G'], ['C', 'C']], onChange: (b) => { if (sel < mut.length) { mut = mut.slice(0, sel) + b + mut.slice(sel + 1); save(); } } },
      { label: 'Edit', momentary: true, items: [['ins', 'Insert'], ['del', 'Delete']], onChange: (v) => { if (v === 'ins' && mut.length < 90) { mut = mut.slice(0, sel + 1) + 'A' + mut.slice(sel + 1); sel++; } else if (v === 'del' && mut.length > 3) { mut = mut.slice(0, sel) + mut.slice(sel + 1); sel = Math.min(sel, mut.length - 1); } save(); } },
    ]);
    function save() { ctx.store.set('mut:seq', mut); update(); }

    ctx.panel.append(
      ctx.h('<div class="card tip"><p>Point mutations change one base. Because the code is read in threes, the result depends on which base: a <b>silent</b> change keeps the same amino acid, a <b>missense</b> change swaps one amino acid, a <b>nonsense</b> change creates a stop codon. Adding or removing bases (not in multiples of three) causes a <b>frameshift</b>, which scrambles everything after it.</p></div>'),
      ctx.h('<div class="card try"><ol class="small"><li>Press Sickle cell. Find codon 7 in your DNA row: GAG became GTG and Glu became Val.</li><li>Tap the last G of that codon and press A. GAA still means Glu: silent.</li><li>Tap any base and press Delete. Watch every amino acid after it change.</li><li>Delete two more bases nearby. Three deletions in total restore the frame.</li></ol></div>'),
      ctx.h(`<details class="more"><summary>Going deeper</summary><div class="small">
        <p><b>Sickle cell disease.</b> HbS is an A to T change (c.20A&gt;T) in HBB. Valine on the surface of deoxygenated haemoglobin sticks into a pocket on a neighbouring molecule, so HbS polymerises into long fibres that bend red cells into sickles. Sickled cells block small vessels (pain crises, stroke, organ damage) and break down early (haemolytic anaemia). It is autosomal recessive. Carriers (sickle cell trait) are usually well and have some protection against severe falciparum malaria, which is why the allele is common where malaria is or was.</p>
        <p><b>Transitions and transversions.</b> A purine to purine (A and G) or pyrimidine to pyrimidine (C and T) change is a transition, the more common kind. Purine to pyrimidine is a transversion. HbS is a transversion.</p>
        <p><b>Causes.</b> Replication errors that escape proofreading, spontaneous deamination of cytosine, UV light (thymine dimers), tobacco carcinogens and ionising radiation. Repair systems include mismatch repair, base excision and nucleotide excision repair (defective in xeroderma pigmentosum).</p>
        <p><b>Not every change is in a codon.</b> Mutations in promoters, splice sites or untranslated regions can change how much protein is made rather than its sequence. Many beta thalassaemia mutations work this way.</p>
      </div></details>`),
    );
    ctx.quiz([
      { q: 'A mutation changes the codon GAA to GAG. Both code for glutamate. What type is it?', choices: ['Missense', 'Silent', 'Nonsense', 'Frameshift'], answer: 1, why: 'The amino acid is the same, so the protein does not change.' },
      { q: 'In sickle cell disease, which amino acid replaces glutamate in beta globin?', choices: ['Lysine', 'Valine', 'Glycine', 'A stop codon'], answer: 1, why: 'GAG to GTG puts valine, a hydrophobic amino acid, where glutamate should be.' },
      { q: 'Which change is most likely to wreck the whole protein if it happens near the start of a gene?', choices: ['A silent substitution', 'A conservative missense change', 'Deleting one base', 'Deleting three bases'], answer: 2, why: 'One base shifts the reading frame, so every codon after it is wrong and a premature stop usually follows.' },
    ]);

    function update() {
      const r = classify(HBB, mut);
      res.querySelector('.bio-big').textContent = r.kind; res.querySelector('.bio-big').style.color = r.col;
      res.querySelector('p').textContent = r.text;
      draw();
    }

    pointer(cv.el, ctx.signal, { down: (x, y) => { for (const hh of hits) if (x >= hh[0] && x <= hh[0] + hh[2] && y >= hh[1] && y <= hh[1] + hh[3]) { sel = hh[4]; draw(); return; } } });

    let tt = 0;
    function draw() {
      const { w, h } = cv; if (!w) return;
      g.clearRect(0, 0, w, h);
      hits.length = 0;
      const cw = w < 500 ? 13 : w < 900 ? 16 : 19; const gap = 6; const cwid = cw * 3 + gap;
      const left = 64; const per = Math.max(3, Math.floor((w - left - 12) / cwid));
      const nCod = Math.ceil(Math.max(HBB.length, mut.length) / 3);
      const po = translate(HBB); const pm = translate(mut);
      const rowH = cw * 1.6; const blockH = rowH * 4 + 18;
      const blocks = Math.ceil(nCod / per);
      let y0 = Math.max(10, (h - 52 - blocks * blockH) / 2);
      const stoppedAt = pm.indexOf('*');
      for (let b = 0; b < blocks; b++) {
        const yy = y0 + b * blockH;
        g.font = MONO(10); g.fillStyle = '#A0A09A'; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText('normal', 4, yy + rowH * 0.5); g.fillText('protein', 4, yy + rowH * 1.5);
        g.fillStyle = '#E8E8E3'; g.fillText('your DNA', 4, yy + rowH * 2.5); g.fillText('protein', 4, yy + rowH * 3.5);
        for (let j = 0; j < per; j++) {
          const ci = b * per + j; if (ci >= nCod) break;
          const x = left + j * cwid;
          const oc = HBB.slice(ci * 3, ci * 3 + 3); const mc = mut.slice(ci * 3, ci * 3 + 3);
          g.font = MONO(10); g.fillStyle = '#5A5A55'; g.textAlign = 'center';
          g.fillText(String(ci + 1), x + cw * 1.5, yy - 6);
          // normal codon
          for (let q = 0; q < oc.length; q++) { g.fillStyle = BASE_COL[oc[q]]; g.globalAlpha = 0.7; g.font = MONO(cw * 0.9); g.fillText(oc[q], x + cw * (q + 0.5), yy + rowH * 0.5); g.globalAlpha = 1; }
          const aaTile = (aa, ty, diff, faded) => {
            if (!aa) return;
            g.fillStyle = rgba(CLASS_COL[AACLASS[aa]], faded ? 0.12 : 0.26); g.beginPath(); g.roundRect(x + 2, ty - rowH * 0.4, cw * 3 - 4, rowH * 0.8, 5); g.fill();
            if (diff) { g.strokeStyle = '#FB7185'; g.lineWidth = 1.6; g.stroke(); }
            g.fillStyle = faded ? '#5A5A55' : CLASS_COL[AACLASS[aa]]; g.font = MONO(cw * 0.72); g.fillText(AA3[aa], x + cw * 1.5, ty + 1);
          };
          aaTile(po[ci], yy + rowH * 1.5, false, false);
          // mutant codon, tappable bases
          const codonDiff = mc !== oc;
          if (codonDiff && mc) { g.strokeStyle = rgba('#FB7185', 0.6); g.lineWidth = 1; g.beginPath(); g.roundRect(x - 1, yy + rowH * 2.05, cw * 3 + 2, rowH * 0.9, 4); g.stroke(); }
          for (let q = 0; q < mc.length; q++) {
            const idx = ci * 3 + q; const bx = x + cw * q; const by = yy + rowH * 2.05;
            if (idx === sel) { g.fillStyle = '#F5F5F0'; g.beginPath(); g.roundRect(bx + 1, by + 1, cw - 2, rowH * 0.9 - 2, 3); g.fill(); }
            g.fillStyle = idx === sel ? '#0A0A0A' : BASE_COL[mc[q]]; g.font = MONO(cw * 0.9); g.fillText(mc[q], bx + cw / 2, yy + rowH * 2.5);
            hits.push([bx, by - 4, cw, rowH * 0.9 + 8, idx]);
          }
          const after = stoppedAt >= 0 && ci > stoppedAt;
          aaTile(after ? null : pm[ci], yy + rowH * 3.5, pm[ci] !== po[ci] && !after, false);
          if (after && mc.length === 3) { g.fillStyle = '#5A5A55'; g.font = MONO(10); g.fillText('·', x + cw * 1.5, yy + rowH * 3.5); }
        }
      }
      // red cell icon: sickled if HbS (valine at codon 7 with the frame intact)
      const hbs = pm[6] === 'V' && mut.length === HBB.length;
      const cx = w - 50; const cy = h - 96;
      g.save(); g.translate(cx, cy); g.scale(1.4, 1.4);
      g.fillStyle = rgba('#FB7185', 0.75); g.strokeStyle = '#FB7185'; g.lineWidth = 1.5;
      if (hbs) { g.beginPath(); g.moveTo(-26, 6); g.quadraticCurveTo(0, -30, 26, 6); g.quadraticCurveTo(0, -12, -26, 6); g.fill(); g.stroke(); }
      else { g.beginPath(); g.ellipse(0, 0, 22, 22, 0, 0, 7); g.fill(); g.fillStyle = rgba('#7f1d1d', 0.6); g.beginPath(); g.ellipse(0, 0, 9, 9, 0, 0, 7); g.fill(); }
      g.restore();
      g.font = MONO(10); g.fillStyle = '#A0A09A'; g.textAlign = 'center';
      g.fillText(hbs ? 'sickled red cell' : 'red cell', cx - 6, cy + 44);
      g.textAlign = 'left'; g.fillText('Tap a base, then use the buttons below', 4, h - 58 + (w < 500 ? 0 : 0));
    }
    cv.onResize(draw);
    update();
    return () => {};
  },
};
