// Chapter 1: the cell. Animal, plant and bacterial cells drawn on canvas with tappable organelles.
import { MONO, DISP, fit, pointer, dock, rgba, reduced, injectStyle } from './_shared.js';

const LW = 1000; const LH = 680;

const INFO = {
  membrane: ['Plasma membrane', 'A phospholipid bilayer studded with proteins. It is selectively permeable: small nonpolar molecules slip through, while ions and sugars need channels, carriers or pumps. Receptors on its surface pick up hormones and other signals.'],
  cytoplasm: ['Cytoplasm', 'Everything inside the membrane except the nucleus: the watery cytosol plus the organelles. Glycolysis, the first stage of breaking down glucose, happens in the cytosol.'],
  nucleus: ['Nucleus', 'Holds the DNA, packed with histone proteins as chromatin. A double membrane, the nuclear envelope, wraps it, and nuclear pores let mRNA out and proteins in. Transcription and mRNA processing (capping, splicing, adding a poly A tail) happen here.'],
  nucleolus: ['Nucleolus', 'A dense region inside the nucleus with no membrane of its own. It makes ribosomal RNA and assembles the two ribosome subunits, which then leave through the nuclear pores.'],
  rer: ['Rough ER', 'Flattened membrane sacs covered in ribosomes, continuous with the nuclear envelope. Proteins made here are threaded into the ER as they are built: proteins for secretion, for membranes and for lysosomes. They fold and start being glycosylated inside. Cells that secrete a lot, like plasma cells making antibodies, are packed with rough ER.'],
  ser: ['Smooth ER', 'Tubular ER without ribosomes. It makes lipids and steroid hormones, detoxifies drugs (liver cells have a lot, with cytochrome P450 enzymes) and stores calcium. In muscle it is called the sarcoplasmic reticulum.'],
  ribo: ['Ribosomes', 'The machines that translate mRNA into protein. Eukaryotic ribosomes are 80S (a 60S and a 40S subunit). Free ribosomes make proteins that stay in the cytosol, ribosomes on the rough ER make proteins that will be secreted or sent to membranes.'],
  golgi: ['Golgi apparatus', 'A stack of flattened sacs that receives proteins from the ER at its cis face, modifies them (for example finishing their sugar chains), sorts them and ships them from its trans face in vesicles. It tags enzymes bound for lysosomes with mannose 6 phosphate.'],
  mito: ['Mitochondria', 'Where aerobic respiration finishes. The Krebs cycle runs in the matrix and the electron transport chain on the folded inner membrane (the cristae) makes most of the cell\'s ATP. They have their own small circular DNA, inherited from the mother, and they help trigger apoptosis.'],
  lyso: ['Lysosomes', 'Membrane sacs of digestive (hydrolytic) enzymes that work best at an acidic pH of about 4.5 to 5. They break down worn out organelles (autophagy) and material taken in by the cell. A missing enzyme causes a lysosomal storage disease, such as Tay Sachs disease.'],
  perox: ['Peroxisome', 'A small sac that breaks down very long chain fatty acids by oxidation, which makes hydrogen peroxide. The enzyme catalase then splits the peroxide into water and oxygen. Liver and kidney cells have many.'],
  centro: ['Centrosome', 'The main microtubule organising centre, holding a pair of centrioles at right angles. It duplicates before cell division and the two centrosomes build the spindle that pulls chromosomes apart. Most plant cells have no centrioles.'],
  cyto: ['Cytoskeleton', 'Protein filaments that give the cell its shape and move things around: microtubules (tracks for motor proteins, the spindle, cilia), actin microfilaments (cell movement, the contractile ring in division) and intermediate filaments (strength, such as keratin).'],
  vesicle: ['Vesicles', 'Small membrane bubbles that carry cargo between the ER, the Golgi and the plasma membrane. Fusing with the membrane releases their contents outside the cell (exocytosis).'],
  wall: ['Cell wall (plant)', 'A rigid layer of cellulose outside the membrane. It gives shape and lets the cell build up turgor pressure without bursting when water flows in.'],
  chloro: ['Chloroplasts', 'Where photosynthesis happens. The light reactions run on the stacked thylakoid membranes (grana) and the Calvin cycle fixes carbon dioxide in the fluid stroma. Like mitochondria they have their own DNA and double membrane, evidence that both came from engulfed bacteria (endosymbiosis).'],
  vacuole: ['Central vacuole', 'A large sac of water, ions and stored compounds, wrapped in a membrane called the tonoplast. Water pressing out from it keeps the cell firm (turgor). In mature plant cells it can fill most of the cell volume.'],
  capsule: ['Capsule', 'A slimy polysaccharide coat outside the wall of some bacteria. It helps them stick to surfaces and resist being eaten by phagocytes, so it is an important virulence factor (for example in Streptococcus pneumoniae).'],
  pwall: ['Cell wall (bacterial)', 'Made of peptidoglycan. Gram positive bacteria have a thick layer, Gram negative bacteria a thin one plus an outer membrane. Penicillins and cephalosporins kill bacteria by blocking peptidoglycan cross linking.'],
  pmem: ['Plasma membrane (bacterial)', 'Bacteria have no mitochondria, so the electron transport chain that makes ATP sits in this membrane.'],
  nucleoid: ['Nucleoid', 'The region holding the single circular chromosome. There is no nuclear membrane, so transcription and translation can happen at the same time.'],
  plasmid: ['Plasmids', 'Small extra rings of DNA that copy themselves. They often carry antibiotic resistance genes and can pass between bacteria through a pilus (conjugation).'],
  pribo: ['Ribosomes (70S)', 'Bacterial ribosomes are 70S, made of a 50S and a 30S subunit. The difference from human 80S ribosomes is why many antibiotics can target them: aminoglycosides and tetracyclines act on the 30S subunit, macrolides on the 50S.'],
  flag: ['Flagellum', 'A whip that spins like a propeller, driven by a rotary motor in the membrane powered by the flow of protons. Bacterial flagella are built from the protein flagellin and are unrelated to the flagellum of a sperm cell.'],
  pili: ['Pili (fimbriae)', 'Short hair-like protein fibres for sticking to surfaces and host cells. A longer sex pilus links two bacteria for conjugation.'],
  pcyto: ['Cytoplasm (bacterial)', 'With no membrane-bound organelles, almost everything happens here: glycolysis, protein synthesis and DNA replication.'],
};

const COL = { mem: '#F5F5F0', nuc: '#A78BFA', rer: '#60A5FA', ser: '#5EEAD4', golgi: '#FBBF24', mito: '#FB7185', lyso: '#A3E635', perox: '#d9f99d', ribo: '#FBBF24', chloro: '#A3E635', vac: '#60A5FA', wall: '#a8a29e' };

function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

function el(x, y, rx, ry, rot = 0) { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p; }
function rrect(x, y, w, h, r) { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; }

function blob(cx, cy, rx, ry, t) {
  const p = new Path2D();
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    const k = 1 + 0.035 * Math.sin(3 * a + t * 0.6) + 0.025 * Math.cos(5 * a - t * 0.4);
    const x = cx + rx * k * Math.cos(a); const y = cy + ry * k * Math.sin(a);
    if (i) p.lineTo(x, y); else p.moveTo(x, y);
  }
  p.closePath();
  return p;
}

function mitoItem(list) {
  return {
    id: 'mito', label: list[0],
    draw(g, sel) {
      for (const [x, y, rot] of list) {
        g.save(); g.translate(x, y); g.rotate(rot);
        g.fillStyle = rgba(COL.mito, sel ? 0.4 : 0.22); g.strokeStyle = COL.mito; g.lineWidth = sel ? 2.2 : 1.4;
        g.beginPath(); g.ellipse(0, 0, 46, 22, 0, 0, Math.PI * 2); g.fill(); g.stroke();
        g.beginPath();
        for (let i = 0; i <= 8; i++) { const xx = -36 + i * 9; g.lineTo(xx, i % 2 ? 12 : -12); }
        g.lineWidth = 1.2; g.stroke();
        g.restore();
      }
    },
    hit(g, x, y) { return list.some(([mx, my, rot]) => g.isPointInPath(el(mx, my, 50, 26, rot), x, y)); },
  };
}

function build(mode) {
  const items = [];
  const R = rng(mode === 'animal' ? 7 : mode === 'plant' ? 11 : 13);
  if (mode === 'animal') {
    const C = [500, 340, 440, 300];
    const inside = (x, y, m = 0.9) => ((x - C[0]) / C[2]) ** 2 + ((y - C[1]) / C[3]) ** 2 < m;
    const NUC = [430, 330, 112];
    items.push({ id: 'cytoplasm', label: [250, 150], back: true, draw(g, sel, t) { g.fillStyle = rgba('#5EEAD4', sel ? 0.1 : 0.045); g.fill(blob(...C, t)); }, hit(g, x, y, t) { return g.isPointInPath(blob(...C, t), x, y); } });
    // cytoskeleton: microtubules radiating from the centrosome
    const mts = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + 0.2; let x = 620; let y = 150; const pts = [[x, y]]; for (let k = 0; k < 12; k++) { x += Math.cos(a + Math.sin(k * 0.7 + i) * 0.15) * 30; y += Math.sin(a + Math.sin(k * 0.7 + i) * 0.15) * 30; if (!inside(x, y, 0.86)) break; pts.push([x, y]); } mts.push(pts); }
    items.push({ id: 'cyto', label: [760, 90], back: true, draw(g, sel) { g.strokeStyle = rgba('#F5F5F0', sel ? 0.55 : 0.12); g.lineWidth = sel ? 1.4 : 0.8; for (const p of mts) { g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); } }, hit: () => false });
    // smooth ER
    const ser = new Path2D(); for (let k = 0; k < 4; k++) { const y0 = 450 + k * 26; ser.moveTo(170, y0); for (let x = 170; x <= 330; x += 4) ser.lineTo(x, y0 + Math.sin((x + k * 30) / 18) * 8); }
    items.push({ id: 'ser', label: [250, 445], draw(g, sel) { g.strokeStyle = rgba(COL.ser, sel ? 0.95 : 0.6); g.lineWidth = sel ? 9 : 7; g.lineCap = 'round'; g.stroke(ser); g.strokeStyle = 'rgba(10,10,10,.6)'; g.lineWidth = 2.5; g.stroke(ser); }, hit(g, x, y) { g.lineWidth = 16; return g.isPointInStroke(ser, x, y); } });
    // rough ER: arcs around the nucleus with ribosome dots
    const rer = new Path2D(); const rdots = [];
    for (let k = 0; k < 3; k++) { const r = 138 + k * 22; const a0 = -0.35 + k * 0.05; const a1 = 1.35 - k * 0.05; rer.moveTo(NUC[0] + r * Math.cos(a0), NUC[1] + r * Math.sin(a0)); rer.arc(NUC[0], NUC[1], r, a0, a1); for (let a = a0; a < a1; a += 0.07) for (const s of [-1, 1]) rdots.push([NUC[0] + (r + s * 6) * Math.cos(a), NUC[1] + (r + s * 6) * Math.sin(a)]); }
    items.push({ id: 'rer', label: [600, 250], draw(g, sel) { g.strokeStyle = rgba(COL.rer, sel ? 0.95 : 0.65); g.lineWidth = sel ? 8 : 6; g.lineCap = 'round'; g.stroke(rer); g.fillStyle = COL.ribo; for (const [x, y] of rdots) { g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); } }, hit(g, x, y) { g.lineWidth = 18; return g.isPointInStroke(rer, x, y); } });
    // nucleus and nucleolus
    items.push({ id: 'nucleus', label: [345, 245], draw(g, sel) { const p = el(NUC[0], NUC[1], NUC[2], NUC[2]); g.fillStyle = rgba(COL.nuc, sel ? 0.32 : 0.18); g.fill(p); g.strokeStyle = COL.nuc; g.lineWidth = sel ? 3 : 2; g.stroke(p); g.setLineDash([2, 7]); g.strokeStyle = '#0A0A0A'; g.lineWidth = 3; g.beginPath(); g.arc(NUC[0], NUC[1], NUC[2], 0, 7); g.stroke(); g.setLineDash([]); g.strokeStyle = rgba(COL.nuc, 0.45); g.lineWidth = 1; for (let i = 0; i < 9; i++) { g.beginPath(); const a = i * 0.7; g.moveTo(NUC[0] - 70 + i * 14, NUC[1] + 40 * Math.sin(a)); g.bezierCurveTo(NUC[0] - 40 + i * 9, NUC[1] - 60, NUC[0] + i * 6, NUC[1] + 70, NUC[0] + 40 + i * 4, NUC[1] + 30 * Math.cos(a)); g.stroke(); } }, hit(g, x, y) { return g.isPointInPath(el(NUC[0], NUC[1], NUC[2] + 4, NUC[2] + 4), x, y); } });
    items.push({ id: 'nucleolus', label: [455, 300], draw(g, sel) { g.fillStyle = sel ? '#c4b5fd' : rgba(COL.nuc, 0.75); g.fill(el(458, 305, 32, 28)); }, hit(g, x, y) { return g.isPointInPath(el(458, 305, 34, 30), x, y); } });
    // Golgi
    const golgi = new Path2D(); for (let k = 0; k < 5; k++) { const r = 70 + k * 15; golgi.moveTo(860 + r * Math.cos(2.55), 250 + r * Math.sin(2.55)); golgi.arc(860, 250, r, 2.55, 3.75); }
    items.push({ id: 'golgi', label: [745, 175], draw(g, sel) { g.strokeStyle = rgba(COL.golgi, sel ? 1 : 0.7); g.lineWidth = sel ? 9 : 7; g.lineCap = 'round'; g.stroke(golgi); }, hit(g, x, y) { g.lineWidth = 16; return g.isPointInStroke(golgi, x, y); } });
    const ves = [[700, 300, 9], [720, 330, 7], [880, 190, 8], [900, 230, 7], [655, 335, 6]];
    items.push({ id: 'vesicle', label: [905, 205], draw(g, sel) { g.strokeStyle = COL.golgi; g.fillStyle = rgba(COL.golgi, sel ? 0.5 : 0.2); g.lineWidth = 1.3; for (const [x, y, r] of ves) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); } }, hit(g, x, y) { return ves.some(([vx, vy, r]) => (x - vx) ** 2 + (y - vy) ** 2 < (r + 6) ** 2); } });
    items.push(mitoItem([[250, 250, 0.5], [700, 480, -0.3], [840, 360, 1.25], [380, 560, 0.15], [560, 600, -0.1]]));
    const lys = [[300, 370, 15], [640, 560, 12], [860, 450, 13]];
    items.push({ id: 'lyso', label: [300, 370], draw(g, sel) { for (const [x, y, r] of lys) { g.fillStyle = rgba(COL.lyso, sel ? 0.55 : 0.3); g.strokeStyle = COL.lyso; g.lineWidth = 1.4; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); g.fillStyle = COL.lyso; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x + Math.cos(i * 1.7) * r * 0.45, y + Math.sin(i * 1.7) * r * 0.45, 1.6, 0, 7); g.fill(); } } }, hit(g, x, y) { return lys.some(([vx, vy, r]) => (x - vx) ** 2 + (y - vy) ** 2 < (r + 6) ** 2); } });
    const per = [[190, 340, 15], [470, 630, 13]];
    items.push({ id: 'perox', label: [190, 340], draw(g, sel) { for (const [x, y, r] of per) { g.fillStyle = rgba(COL.perox, sel ? 0.4 : 0.15); g.strokeStyle = COL.perox; g.lineWidth = 1.3; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); g.fillStyle = rgba(COL.perox, 0.8); g.fillRect(x - 5, y - 4, 10, 8); } }, hit(g, x, y) { return per.some(([vx, vy, r]) => (x - vx) ** 2 + (y - vy) ** 2 < (r + 6) ** 2); } });
    items.push({ id: 'centro', label: [620, 150], draw(g, sel) { g.save(); g.translate(620, 150); g.fillStyle = sel ? '#F5F5F0' : '#c9c9c2'; g.fillRect(-14, -5, 22, 10); g.fillRect(4, -2, 10, 24); g.strokeStyle = '#0A0A0A'; g.lineWidth = 1; for (let i = -12; i < 8; i += 4) { g.beginPath(); g.moveTo(i, -5); g.lineTo(i, 5); g.stroke(); } g.restore(); }, hit(g, x, y) { return Math.abs(x - 622) < 22 && Math.abs(y - 158) < 24; } });
    const ribs = []; while (ribs.length < 70) { const x = 80 + R() * 840; const y = 60 + R() * 560; if (inside(x, y, 0.85) && (x - NUC[0]) ** 2 + (y - NUC[1]) ** 2 > 210 ** 2) ribs.push([x, y]); }
    items.push({ id: 'ribo', label: [860, 300], draw(g, sel) { g.fillStyle = sel ? '#FDE68A' : rgba(COL.ribo, 0.75); for (const [x, y] of ribs) { g.beginPath(); g.arc(x, y, sel ? 3 : 2.2, 0, 7); g.fill(); } }, hit(g, x, y) { return ribs.some(([vx, vy]) => (x - vx) ** 2 + (y - vy) ** 2 < 49); } });
    items.push({ id: 'membrane', label: [100, 200], draw(g, sel, t) { const p = blob(...C, t); g.strokeStyle = sel ? '#F5F5F0' : rgba('#F5F5F0', 0.75); g.lineWidth = sel ? 6 : 4.5; g.stroke(p); g.strokeStyle = '#0A0A0A'; g.lineWidth = 1.4; g.stroke(p); }, hit(g, x, y, t) { g.lineWidth = 20; return g.isPointInStroke(blob(...C, t), x, y); } });
  } else if (mode === 'plant') {
    const W = [80, 60, 840, 560];
    items.push({ id: 'cytoplasm', label: [180, 330], back: true, draw(g, sel) { g.fillStyle = rgba('#5EEAD4', sel ? 0.1 : 0.045); g.fill(rrect(W[0] + 18, W[1] + 18, W[2] - 36, W[3] - 36, 16)); }, hit(g, x, y) { return g.isPointInPath(rrect(W[0] + 18, W[1] + 18, W[2] - 36, W[3] - 36, 16), x, y); } });
    items.push({ id: 'vacuole', label: [520, 330], draw(g, sel) { const p = rrect(270, 165, 520, 350, 90); g.fillStyle = rgba(COL.vac, sel ? 0.28 : 0.13); g.fill(p); g.strokeStyle = rgba(COL.vac, 0.9); g.lineWidth = sel ? 2.5 : 1.6; g.stroke(p); }, hit(g, x, y) { return g.isPointInPath(rrect(270, 165, 520, 350, 90), x, y); } });
    const rer = new Path2D(); for (let k = 0; k < 2; k++) { const r = 86 + k * 16; rer.moveTo(185 + r * Math.cos(0.95), 185 + r * Math.sin(0.95)); rer.arc(185, 185, r, 0.95, 2.3); }
    items.push({ id: 'rer', label: [190, 280], draw(g, sel) { g.strokeStyle = rgba(COL.rer, sel ? 0.95 : 0.65); g.lineWidth = sel ? 7 : 5; g.lineCap = 'round'; g.stroke(rer); }, hit(g, x, y) { g.lineWidth = 16; return g.isPointInStroke(rer, x, y); } });
    items.push({ id: 'nucleus', label: [120, 120], draw(g, sel) { const p = el(185, 185, 72, 72); g.fillStyle = rgba(COL.nuc, sel ? 0.32 : 0.18); g.fill(p); g.strokeStyle = COL.nuc; g.lineWidth = sel ? 3 : 2; g.stroke(p); }, hit(g, x, y) { return g.isPointInPath(el(185, 185, 74, 74), x, y); } });
    items.push({ id: 'nucleolus', label: [200, 175], draw(g, sel) { g.fillStyle = sel ? '#c4b5fd' : rgba(COL.nuc, 0.75); g.fill(el(200, 175, 22, 20)); }, hit(g, x, y) { return g.isPointInPath(el(200, 175, 24, 22), x, y); } });
    const chl = [[430, 112, 0.05], [620, 112, -0.05], [850, 260, 1.5], [850, 440, 1.6], [640, 568, 0.05], [420, 568, -0.05], [150, 420, 1.55]];
    items.push({ id: 'chloro', label: [430, 112], draw(g, sel) { for (const [x, y, rot] of chl) { g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = rgba(COL.chloro, sel ? 0.35 : 0.18); g.strokeStyle = COL.chloro; g.lineWidth = sel ? 2.2 : 1.4; g.beginPath(); g.ellipse(0, 0, 58, 26, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = rgba(COL.chloro, 0.75); for (let i = -2; i <= 2; i++) for (let j = 0; j < 4; j++) g.fillRect(i * 20 - 6, -10 + j * 5.5, 12, 3.5); g.restore(); } }, hit(g, x, y) { return chl.some(([cx, cy, rot]) => g.isPointInPath(el(cx, cy, 62, 30, rot), x, y)); } });
    items.push(mitoItem([[760, 120, 0.1], [230, 560, -0.2], [800, 548, 0.3]]));
    const golgi = new Path2D(); for (let k = 0; k < 4; k++) { const r = 40 + k * 11; golgi.moveTo(190 + r * Math.cos(-0.6), 370 + r * Math.sin(-0.6)); golgi.arc(190, 370, r, -0.6, 0.6); }
    items.push({ id: 'golgi', label: [235, 365], draw(g, sel) { g.strokeStyle = rgba(COL.golgi, sel ? 1 : 0.7); g.lineWidth = sel ? 7 : 5; g.lineCap = 'round'; g.stroke(golgi); }, hit(g, x, y) { g.lineWidth = 14; return g.isPointInStroke(golgi, x, y); } });
    items.push({ id: 'perox', label: [140, 520], draw(g, sel) { g.fillStyle = rgba(COL.perox, sel ? 0.4 : 0.15); g.strokeStyle = COL.perox; g.lineWidth = 1.3; g.beginPath(); g.arc(140, 520, 14, 0, 7); g.fill(); g.stroke(); }, hit(g, x, y) { return (x - 140) ** 2 + (y - 520) ** 2 < 400; } });
    const ribs = []; while (ribs.length < 45) { const x = 110 + R() * 780; const y = 90 + R() * 500; const inVac = x > 262 && x < 798 && y > 157 && y < 523; if (!inVac && (x - 185) ** 2 + (y - 185) ** 2 > 90 ** 2) ribs.push([x, y]); }
    items.push({ id: 'ribo', label: [560, 140], draw(g, sel) { g.fillStyle = sel ? '#FDE68A' : rgba(COL.ribo, 0.75); for (const [x, y] of ribs) { g.beginPath(); g.arc(x, y, sel ? 3 : 2.2, 0, 7); g.fill(); } }, hit(g, x, y) { return ribs.some(([vx, vy]) => (x - vx) ** 2 + (y - vy) ** 2 < 49); } });
    items.push({ id: 'membrane', label: [500, 82], draw(g, sel) { const p = rrect(W[0] + 18, W[1] + 18, W[2] - 36, W[3] - 36, 16); g.strokeStyle = sel ? '#F5F5F0' : rgba('#F5F5F0', 0.75); g.lineWidth = sel ? 4 : 2.5; g.stroke(p); }, hit(g, x, y) { g.lineWidth = 10; return g.isPointInStroke(rrect(W[0] + 18, W[1] + 18, W[2] - 36, W[3] - 36, 16), x, y); } });
    items.push({ id: 'wall', label: [80, 360], draw(g, sel) { const p = rrect(...W, 22); g.strokeStyle = sel ? '#d6d3d1' : rgba(COL.wall, 0.75); g.lineWidth = 14; g.stroke(p); g.strokeStyle = 'rgba(10,10,10,.5)'; g.lineWidth = 1; g.setLineDash([10, 6]); g.stroke(p); g.setLineDash([]); }, hit(g, x, y) { g.lineWidth = 18; return g.isPointInStroke(rrect(...W, 22), x, y); } });
  } else {
    const rod = (pad) => rrect(250 - pad, 250 - pad, 500 + pad * 2, 180 + pad * 2, 90 + pad);
    items.push({ id: 'pcyto', label: [330, 300], back: true, draw(g, sel) { g.fillStyle = rgba('#5EEAD4', sel ? 0.12 : 0.05); g.fill(rod(0)); }, hit(g, x, y) { return g.isPointInPath(rod(0), x, y); } });
    items.push({ id: 'flag', label: [930, 300], draw(g, sel, t) { g.strokeStyle = sel ? '#F5F5F0' : rgba('#F5F5F0', 0.6); g.lineWidth = sel ? 3 : 2; g.beginPath(); for (let x = 0; x <= 230; x += 3) { const y = 340 + Math.sin(x / 22 - t * 6) * 14 * Math.min(1, x / 40); if (x) g.lineTo(770 + x, y); else g.moveTo(770 + x, y); } g.stroke(); }, hit(g, x, y) { return x > 765 && x < 1000 && Math.abs(y - 340) < 28; } });
    const pili = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; if (Math.abs(Math.cos(a)) > 0.9 && Math.cos(a) > 0) continue; const x = 500 + Math.cos(a) * 255; const y = 340 + Math.sin(a) * 105; pili.push([x, y, x + Math.cos(a) * 34, y + Math.sin(a) * 34]); }
    items.push({ id: 'pili', label: [500, 200], draw(g, sel) { g.strokeStyle = sel ? '#F5F5F0' : rgba('#F5F5F0', 0.4); g.lineWidth = sel ? 2 : 1.2; for (const [a, b, c, d] of pili) { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); } }, hit(g, x, y) { return pili.some(([, , c, d]) => (x - c) ** 2 + (y - d) ** 2 < 300); } });
    items.push({ id: 'capsule', label: [235, 470], draw(g, sel) { g.fillStyle = rgba('#a8a29e', sel ? 0.22 : 0.08); g.fill(rod(26)); g.strokeStyle = rgba('#a8a29e', 0.5); g.setLineDash([3, 5]); g.lineWidth = 1.2; g.stroke(rod(26)); g.setLineDash([]); }, hit(g, x, y) { return g.isPointInPath(rod(26), x, y) && !g.isPointInPath(rod(12), x, y); } });
    items.push({ id: 'pwall', label: [500, 233], draw(g, sel) { g.strokeStyle = sel ? '#e7e5e4' : rgba(COL.wall, 0.8); g.lineWidth = 9; g.stroke(rod(10)); }, hit(g, x, y) { g.lineWidth = 12; return g.isPointInStroke(rod(10), x, y); } });
    items.push({ id: 'pmem', label: [500, 445], draw(g, sel) { g.strokeStyle = sel ? '#F5F5F0' : rgba('#F5F5F0', 0.75); g.lineWidth = sel ? 3.5 : 2.2; g.stroke(rod(2)); }, hit(g, x, y) { g.lineWidth = 7; return g.isPointInStroke(rod(2), x, y); } });
    const nucl = new Path2D(); for (let i = 0; i <= 200; i++) { const a = (i / 200) * Math.PI * 2; const r = 1 + 0.25 * Math.sin(7 * a) + 0.15 * Math.cos(11 * a); const x = 480 + Math.cos(a) * 120 * r; const y = 340 + Math.sin(a) * 50 * r; if (i) nucl.lineTo(x, y); else nucl.moveTo(x, y); }
    items.push({ id: 'nucleoid', label: [480, 340], draw(g, sel) { g.fillStyle = rgba(COL.nuc, sel ? 0.18 : 0.07); g.fill(el(480, 340, 150, 64)); g.strokeStyle = sel ? '#c4b5fd' : COL.nuc; g.lineWidth = sel ? 2.2 : 1.5; g.stroke(nucl); }, hit(g, x, y) { return g.isPointInPath(el(480, 340, 150, 64), x, y); } });
    const plas = [[680, 300, 16], [330, 395, 12], [690, 385, 10]];
    items.push({ id: 'plasmid', label: [680, 300], draw(g, sel) { g.strokeStyle = sel ? '#F5F5F0' : COL.lyso; g.lineWidth = sel ? 2.4 : 1.6; for (const [x, y, r] of plas) { g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); } }, hit(g, x, y) { return plas.some(([vx, vy, r]) => (x - vx) ** 2 + (y - vy) ** 2 < (r + 7) ** 2); } });
    const ribs = []; while (ribs.length < 40) { const x = 290 + R() * 420; const y = 270 + R() * 140; if (((x - 480) / 150) ** 2 + ((y - 340) / 64) ** 2 > 1 && plas.every(([px, py, r]) => (x - px) ** 2 + (y - py) ** 2 > (r + 6) ** 2)) ribs.push([x, y]); }
    items.push({ id: 'pribo', label: [300, 300], draw(g, sel) { g.fillStyle = sel ? '#FDE68A' : rgba(COL.ribo, 0.8); for (const [x, y] of ribs) { g.beginPath(); g.arc(x, y, sel ? 3 : 2.2, 0, 7); g.fill(); } }, hit(g, x, y) { return ribs.some(([vx, vy]) => (x - vx) ** 2 + (y - vy) ** 2 < 49); } });
  }
  return items;
}

export default {
  mount(ctx) {
    injectStyle();
    const cv = ctx.canvas();
    const g = cv.ctx;
    const hitG = document.createElement('canvas').getContext('2d');
    let mode = ctx.store.get('cell:mode', 'animal');
    let items = build(mode);
    let sel = null; let hover = null; let labels = false;
    let view = { s: 1, ox: 0, oy: 0 };
    let t = 0;

    ctx.panel.append(
      ctx.h('<h2 class="k-h">The cell</h2>'),
      ctx.h('<p class="lede">Every living thing is made of cells. Inside each one, small parts with their own jobs keep it alive. Tap any part to see what it does.</p>'),
    );
    const segEl = ctx.seg([['animal', 'Animal'], ['plant', 'Plant'], ['bact', 'Bacterium']], mode, (v) => { mode = v; ctx.store.set('cell:mode', v); items = build(v); select(null); renderChips(); });
    ctx.panel.append(segEl);
    const info = ctx.h('<div class="card bio-info"><h3>Tap a part</h3><p class="small muted">Tap a shape in the picture, or a name below.</p></div>');
    const chips = ctx.h('<div class="bio-chips"></div>');
    ctx.panel.append(info, chips);
    function renderChips() {
      chips.innerHTML = '';
      const ids = [...new Set(items.map((i) => i.id))];
      for (const id of ids) {
        const b = document.createElement('button');
        b.className = `chip${id === sel ? ' on' : ''}`; b.textContent = INFO[id][0].replace(/ \(.*\)/, '');
        b.addEventListener('click', () => select(id));
        chips.append(b);
      }
    }
    function select(id) {
      sel = id;
      if (!id) { info.innerHTML = '<h3>Tap a part</h3><p class="small muted">Tap a shape in the picture, or a name below.</p>'; }
      else { const [n, d] = INFO[id]; info.innerHTML = `<h3>${n}</h3><p class="small">${d}</p>`; }
      chips.querySelectorAll('.chip').forEach((b, i) => b.classList.toggle('on', [...new Set(items.map((x) => x.id))][i] === id));
      draw();
    }
    renderChips();

    ctx.panel.append(
      ctx.h('<div class="card tip"><p>A cell is like a tiny factory. The nucleus keeps the instructions (DNA). Ribosomes read copies of them to build proteins. The ER and Golgi finish and ship those proteins. Mitochondria turn food into usable energy (ATP). The membrane is the factory wall with guarded doors.</p></div>'),
      ctx.h('<div class="card try"><ol class="small"><li>In the animal cell, tap the rough ER, then the Golgi, then a vesicle. That is the path a secreted protein such as insulin takes.</li><li>Switch to Plant and look for three things animal cells lack: a wall, chloroplasts and a big central vacuole.</li><li>Switch to Bacterium. Where is the DNA kept, if there is no nucleus?</li></ol></div>'),
    );
    ctx.panel.append(ctx.h(`<div class="card deep"><p class="small">Prokaryotes (bacteria and archaea) and eukaryotes (animals, plants, fungi, protists) differ in more than size.</p>
      <table class="bio-tbl"><tr><th></th><th>Prokaryote</th><th>Eukaryote</th></tr>
      <tr><td>Nucleus</td><td>No, DNA in a nucleoid</td><td>Yes, double membrane</td></tr>
      <tr><td>DNA</td><td>One circular chromosome, plus plasmids</td><td>Several linear chromosomes with histones</td></tr>
      <tr><td>Organelles</td><td>No membrane-bound organelles</td><td>Mitochondria, ER, Golgi and more</td></tr>
      <tr><td>Ribosomes</td><td>70S (50S + 30S)</td><td>80S (60S + 40S)</td></tr>
      <tr><td>Size</td><td>About 1 to 5 µm</td><td>About 10 to 100 µm</td></tr>
      <tr><td>Division</td><td>Binary fission</td><td>Mitosis (and meiosis)</td></tr>
      <tr><td>Wall</td><td>Usually peptidoglycan</td><td>Cellulose in plants, chitin in fungi, none in animals</td></tr></table>
      <p class="small">Mitochondria and chloroplasts have their own circular DNA and 70S-like ribosomes and divide by fission. This is the main evidence for endosymbiosis: they started as bacteria living inside a larger cell.</p></div>`));
    ctx.quiz([
      { q: 'A cell that secretes large amounts of protein (such as a pancreatic acinar cell) will have lots of which organelle?', choices: ['Smooth ER', 'Rough ER', 'Peroxisomes', 'Central vacuole'], answer: 1, why: 'Secreted proteins are made on ribosomes bound to the rough ER, then sent to the Golgi.' },
      { q: 'Which feature is found in bacteria but not in human cells?', choices: ['Ribosomes', 'A plasma membrane', 'A peptidoglycan cell wall', 'DNA'], answer: 2, why: 'Peptidoglycan is unique to bacteria, which is why penicillin can target it without harming our cells.' },
      { q: 'Where does the electron transport chain run in a human cell?', choices: ['Inner mitochondrial membrane', 'Cytosol', 'Golgi apparatus', 'Nucleolus'], answer: 0, why: 'It sits on the folded inner membrane (cristae). In bacteria it sits in the plasma membrane instead.' },
    ]);

    dock(ctx, [{ label: 'Labels', items: [['off', 'Off'], ['on', 'All']], value: 'off', onChange: (v) => { labels = v === 'on'; draw(); } }]);

    const toL = (x, y) => [(x - view.ox) / view.s, (y - view.oy) / view.s];
    function pick(x, y) {
      const [lx, ly] = toL(x, y);
      // front to back, background items last
      const order = [...items.filter((i) => !i.back).reverse(), ...items.filter((i) => i.back)];
      for (const it of order) if (it.hit(hitG, lx, ly, t)) return it.id;
      return null;
    }
    pointer(cv.el, ctx.signal, {
      down: (x, y) => { select(pick(x, y)); },
      hover: (x, y) => { const id = pick(x, y); if (id !== hover) { hover = id; cv.el.style.cursor = id ? 'pointer' : 'default'; draw(); } },
    });
    cv.el.addEventListener('pointerleave', () => { hover = null; draw(); }, { signal: ctx.signal });

    function label(it, strong) {
      const [x, y] = it.label; const name = INFO[it.id][0].replace(/ \(.*\)/, '');
      const sx = view.ox + x * view.s; const sy = view.oy + y * view.s;
      g.font = MONO(strong ? 12 : 11);
      const w = g.measureText(name).width + 12;
      const bx = Math.min(cv.w - w - 4, Math.max(4, sx - w / 2)); const by = Math.max(4, sy - 26);
      g.fillStyle = strong ? 'rgba(245,245,240,.95)' : 'rgba(20,20,20,.85)';
      g.beginPath(); g.roundRect(bx, by, w, 19, 5); g.fill();
      g.fillStyle = strong ? '#0A0A0A' : '#E8E8E3'; g.textBaseline = 'middle'; g.textAlign = 'left';
      g.fillText(name, bx + 6, by + 10);
      if (strong) { g.strokeStyle = 'rgba(245,245,240,.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(sx, by + 19); g.lineTo(sx, sy - 2); g.stroke(); g.beginPath(); g.arc(sx, sy, 2.5, 0, 7); g.fillStyle = '#F5F5F0'; g.fill(); }
    }

    function draw() {
      const { w, h } = cv;
      if (!w) return;
      g.clearRect(0, 0, w, h);
      view = fit(w, h - 40, LW, LH, 8);
      g.save(); g.translate(view.ox, view.oy); g.scale(view.s, view.s);
      for (const it of items) { g.save(); it.draw(g, sel === it.id || hover === it.id, t); g.restore(); }
      g.restore();
      if (labels) for (const it of items) if (it.id !== sel) label(it, false);
      const s = items.find((i) => i.id === sel); if (s) label(s, true);
      g.font = MONO(10.5); g.fillStyle = '#A0A09A'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      const note = mode === 'bact' ? 'Not to scale. A bacterium is about 1 to 5 µm long.' : mode === 'plant' ? 'Plant cell, typically about 10 to 100 µm across.' : 'Animal cell, typically about 10 to 30 µm across.';
      g.fillText(note, 6, h - 50);
    }
    cv.onResize(draw);
    if (!reduced()) ctx.loop((tt, dt) => { t += dt; draw(); });
    return () => {};
  },
};
