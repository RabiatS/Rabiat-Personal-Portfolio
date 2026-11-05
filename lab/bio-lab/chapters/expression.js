// Chapter 4: from gene to protein. Transcribe a coding strand into mRNA, then a ribosome reads it codon by codon.
import { MONO, DISP, BASE_COL, CODE, AA3, AANAME, AACLASS, CLASS_COL, complement, cleanDNA, codonTableHTML, injectStyle, clamp, ease, rgba } from './_shared.js';

const PRESETS = [
  ['Textbook', 'ATGGCCATTGTAATGGGCCGCTGAAAGGGTGCCCGATAG', 'A short made up gene that ends in a stop codon.'],
  ['Beta globin', 'ACATTTGCTTCTGACACAACTGTGTTCACTAGCAACCTCAAACAGACACCATGGTGCATCTGACTCCTGAGGAGAAGTCTGCC', 'The start of human beta globin (HBB) mRNA, written as DNA: the 5\' untranslated leader, then the first 11 codons. No stop yet, the real gene goes on for 147 codons.'],
  ['Early stop', 'ATGAAACGCTAGTTTGGCCCATAA', 'A stop codon appears early, so the protein is cut short.'],
];

export default {
  mount(ctx) {
    injectStyle();
    const cv = ctx.canvas();
    const g = cv.ctx;
    let dna = ctx.store.get('expr:seq', PRESETS[0][1]);
    let mrna; let start; let phase; let tx; let k; let u; let chain; let done; let playing = true; let speed = 1; let stopAt = null;

    function setup() {
      mrna = dna.replace(/T/g, 'U');
      start = mrna.indexOf('AUG');
      phase = 'tx'; tx = 0; k = 0; u = 0; chain = []; done = false; stopAt = null;
      renderOut(); highlight(null);
    }

    // Panel
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Gene to protein</h2>'),
      ctx.h('<p class="lede">A gene is a recipe written in DNA. The cell copies it into messenger RNA, then a ribosome reads the RNA three letters at a time and strings amino acids into a protein.</p>'),
    );
    const inBox = ctx.h(`<div class="card"><label class="eyebrow" for="ex-in">Coding strand, 5' to 3'</label><textarea id="ex-in" class="txt" rows="2" spellcheck="false"></textarea><div class="bio-chips"></div><p class="small muted pre-note"></p></div>`);
    const ta = inBox.querySelector('textarea'); ta.value = dna;
    const pc = inBox.querySelector('.bio-chips'); const note = inBox.querySelector('.pre-note');
    for (const [n, s, d] of PRESETS) { const b = ctx.h(`<button class="chip">${n}</button>`); b.onclick = () => { dna = s; ta.value = s; note.textContent = d; ctx.store.set('expr:seq', s); setup(); }; pc.append(b); }
    const rb = ctx.h('<button class="chip">Random gene</button>');
    rb.onclick = () => { const sense = Object.keys(CODE).filter((c) => CODE[c] !== '*'); let s = 'ATG'; for (let i = 0; i < 9; i++) s += sense[Math.floor(Math.random() * sense.length)].replace(/U/g, 'T'); s += ['TAA', 'TAG', 'TGA'][Math.floor(Math.random() * 3)]; dna = s; ta.value = s; note.textContent = 'ATG, nine random codons, then a stop.'; setup(); };
    pc.append(rb);
    ta.addEventListener('input', () => { const s = cleanDNA(ta.value).slice(0, 150); if (s.length >= 3) { dna = s; ctx.store.set('expr:seq', s); setup(); } }, { signal: ctx.signal });
    ctx.panel.append(inBox);

    const ctrl = ctx.h('<div class="row"></div>');
    const playBtn = ctx.h('<button class="btn sm">Pause</button>');
    playBtn.onclick = () => { if (done) { setup(); } playing = !playing || done; playBtn.textContent = playing ? 'Pause' : 'Play'; stopAt = null; };
    const stepBtn = ctx.h('<button class="btn ghost sm">Step</button>');
    stepBtn.onclick = () => {
      if (phase === 'tx') { tx = mrna.length; phase = 'tl'; playing = false; }
      else if (!done) { stopAt = k + 1; playing = true; }
      playBtn.textContent = playing ? 'Pause' : 'Play';
    };
    const resetBtn = ctx.h('<button class="btn ghost sm">Restart</button>');
    resetBtn.onclick = () => { setup(); playing = true; playBtn.textContent = 'Pause'; };
    ctrl.append(playBtn, stepBtn, resetBtn);
    ctx.panel.append(ctrl, ctx.slider({ label: 'Speed', min: 0.25, max: 3, step: 0.25, value: 1, fmt: (x) => `${x}×`, onInput: (x) => { speed = x; } }));
    const out = ctx.h('<div class="card"><div class="eyebrow">Now</div><p class="small now"></p><div class="eyebrow">Protein (N to C)</div><div class="bio-seq prot"></div></div>');
    ctx.panel.append(out);
    const nowEl = out.querySelector('.now'); const protEl = out.querySelector('.prot');
    function renderOut() {
      protEl.innerHTML = chain.length ? chain.map((a) => `<i style="color:${CLASS_COL[AACLASS[a]]}">${AA3[a]}</i>`).join('-') : '<span class="muted">nothing yet</span>';
    }
    function say(t) { if (nowEl.textContent !== t) nowEl.textContent = t; }
    const table = ctx.h(`<div class="card"><div class="eyebrow">The genetic code (mRNA codons)</div>${codonTableHTML()}<p class="hint">Green AUG is the start codon (Met). Red are stops.</p></div>`);
    ctx.panel.append(table);
    let lastHi = null;
    function highlight(c) { if (c === lastHi) return; lastHi = c; table.querySelectorAll('[data-c]').forEach((s) => s.classList.toggle('on', s.dataset.c === c)); }

    ctx.panel.append(
      ctx.h('<div class="card tip"><p>Transcription copies the gene into mRNA, swapping T for U. Translation reads that mRNA in groups of three letters called codons. Each codon matches one amino acid, carried in by a transfer RNA (tRNA) whose anticodon pairs with it. Reading starts at AUG and stops at UAA, UAG or UGA.</p></div>'),
      ctx.h('<div class="card try"><ol class="small"><li>Watch the mRNA letters: they match the coding strand, with U where the DNA has T.</li><li>Press Step during translation to move one codon at a time and find it lit in the table.</li><li>Pick Beta globin. The ribosome skips the leader and starts at the first AUG. Then try Early stop.</li></ol></div>'),
      ctx.h(`<details class="more"><summary>Going deeper</summary><div class="small">
        <p><b>Which strand?</b> RNA polymerase reads the template strand 3' to 5' and builds mRNA 5' to 3'. So the mRNA has the same sequence as the coding (sense) strand, with U for T.</p>
        <p><b>Processing in eukaryotes.</b> The first transcript gets a 5' cap (7-methylguanosine) and a 3' poly A tail, and its introns are spliced out by the spliceosome. Only the mature mRNA leaves the nucleus. This model skips introns.</p>
        <p><b>Starting.</b> The small ribosomal subunit binds the cap and scans to the first AUG, often in a Kozak context (gccRccAUGG). Initiator tRNA carries methionine (formyl methionine in bacteria, which find the start using a Shine Dalgarno sequence).</p>
        <p><b>Sites.</b> The ribosome has A (aminoacyl), P (peptidyl) and E (exit) sites. The large subunit's rRNA forms the peptide bond, so the ribosome is a ribozyme. Elongation costs GTP. At a stop codon a release factor, not a tRNA, binds and the chain is freed.</p>
        <p><b>The code.</b> 64 codons code for 20 amino acids and 3 stops, so it is redundant (degenerate): most amino acids have several codons, often differing only in the third base (wobble). It is almost universal across life.</p>
      </div></details>`),
    );
    ctx.quiz([
      { q: 'The coding strand reads 5\'-ATG TTC-3\'. What is the mRNA?', choices: ['5\'-UAC AAG-3\'', '5\'-AUG UUC-3\'', '5\'-ATG TTC-3\'', '3\'-AUG UUC-5\''], answer: 1, why: 'mRNA matches the coding strand, with U in place of T, and is written 5\' to 3\'.' },
      { q: 'A codon on the mRNA is 5\'-GCU-3\'. Which anticodon pairs with it?', choices: ['3\'-CGA-5\'', '5\'-GCU-3\'', '3\'-GCU-5\'', '5\'-CGT-3\''], answer: 0, why: 'The anticodon is complementary and antiparallel: 3\'-CGA-5\' (written 5\' to 3\' it is AGC).' },
      { q: 'What happens when the ribosome reaches UAA?', choices: ['A tRNA brings tyrosine', 'A release factor binds and the protein is freed', 'Translation restarts at the next AUG', 'The mRNA is spliced'], answer: 1, why: 'Stop codons have no matching tRNA. A release factor binds and the finished chain is released.' },
    ]);

    setup();

    function advance(dt) {
      if (phase === 'tx') {
        tx += dt * 9 * speed;
        say('Transcription: RNA polymerase reads the template strand and builds mRNA 5\' to 3\'.');
        if (tx >= mrna.length) { tx = mrna.length; phase = 'gap'; u = 0; }
        return;
      }
      if (phase === 'gap') { u += dt * speed; if (u > 0.8) { phase = 'tl'; u = 0; } return; }
      if (phase !== 'tl' || done) return;
      if (start < 0) { say('No AUG start codon here, so the ribosome has nowhere to begin. Add ATG to the sequence.'); done = true; return; }
      const ci = start + k * 3;
      const codon = mrna.slice(ci, ci + 3);
      if (codon.length < 3) { say('The mRNA ran out before a stop codon. A real ribosome would stall here.'); done = true; highlight(null); return; }
      const aa = CODE[codon];
      highlight(codon);
      u += dt * 0.9 * speed;
      if (aa === '*') {
        say(`Codon ${codon} is a stop. A release factor binds and the finished chain of ${chain.length} amino acids is released.`);
        if (u >= 1) { done = true; playing = false; playBtn.textContent = 'Play again'; }
        return;
      }
      say(`Codon ${codon} → ${AA3[aa]} (${AANAME[aa]}). The tRNA with anticodon ${complement(codon.replace(/U/g, 'T')).replace(/T/g, 'U')} (3' to 5') brings it in.`);
      if (u >= 0.55 && chain.length === k) { chain.push(aa); renderOut(); }
      if (u >= 1) { u = 0; k++; if (stopAt != null && k >= stopAt) { playing = false; stopAt = null; playBtn.textContent = 'Play'; } }
    }

    function draw() {
      const { w, h } = cv; if (!w) return;
      g.clearRect(0, 0, w, h);
      const n = mrna.length;
      const cw = clamp(w / 30, 15, 25);
      const margin = 46;
      const focus = phase === 'tx' ? tx : phase === 'gap' ? n : (start < 0 ? 0 : start + k * 3 + 1.5);
      const total = n * cw + margin * 2;
      const off = clamp(focus * cw - w / 2 + margin, 0, Math.max(0, total - w));
      const X = (i) => margin + i * cw - off;
      const yC = Math.max(26, h * 0.08); const yT = yC + cw * 1.15; const yM = Math.max(yT + cw * 6.5, h * 0.56);
      const letter = (b, x, y, a = 1) => { g.globalAlpha = a; g.fillStyle = BASE_COL[b]; g.fillText(b, x, y); g.globalAlpha = 1; };
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = MONO(Math.round(cw * 0.66));
      const tmpl = complement(dna);
      for (let i = 0; i < n; i++) {
        const x = X(i + 0.5); if (x < -cw || x > w + cw) continue;
        letter(dna[i], x, yC, 0.85); letter(tmpl[i], x, yT, 0.85);
      }
      g.strokeStyle = 'rgba(160,160,154,.25)'; g.lineWidth = 1;
      for (let i = 0; i < n; i++) { const x = X(i + 0.5); if (x < -cw || x > w + cw) continue; g.beginPath(); g.moveTo(x, yC + cw * 0.38); g.lineTo(x, yT - cw * 0.38); g.stroke(); }
      g.font = MONO(10.5); g.fillStyle = '#A0A09A'; g.textAlign = 'left';
      g.fillText("coding 5'", 6, yC - cw * 0.85); g.fillText("template 3'", 6, yT + cw * 0.85);
      g.fillText("mRNA 5'", 6, yM + cw * 0.95);
      // RNA polymerase during transcription
      if (phase === 'tx') { const x = X(tx); g.fillStyle = rgba('#A78BFA', 0.35); g.strokeStyle = '#A78BFA'; g.beginPath(); g.ellipse(x, (yC + yT) / 2, cw * 2.2, cw * 1.6, 0, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#c4b5fd'; g.font = MONO(10.5); g.textAlign = 'center'; g.fillText('RNA polymerase', x, yT + cw * 1.7); }
      // mRNA row
      const shown = Math.floor(tx);
      if (start >= 0 && phase !== 'tx') {
        for (let c = start; c + 3 <= n; c += 3) { const ci = (c - start) / 3; g.fillStyle = ci % 2 ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.08)'; g.fillRect(X(c) + 1, yM - cw * 0.55, cw * 3 - 2, cw * 1.1); }
      }
      g.textAlign = 'center'; g.font = MONO(Math.round(cw * 0.66));
      for (let i = 0; i < Math.min(n, shown); i++) { const x = X(i + 0.5); if (x < -cw || x > w + cw) continue; letter(mrna[i], x, yM); }
      g.strokeStyle = 'rgba(232,232,227,.5)'; g.beginPath(); g.moveTo(X(0), yM + cw * 0.62); g.lineTo(X(Math.min(n, tx)), yM + cw * 0.62); g.stroke();
      if (phase === 'tx' && shown > 0) { g.strokeStyle = 'rgba(167,139,250,.4)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(X(tx), yT + cw * 0.6); g.lineTo(X(tx), yM - cw * 0.6); g.stroke(); g.setLineDash([]); }
      if (start >= 0 && phase !== 'tx') { g.font = MONO(10); g.fillStyle = '#A3E635'; g.fillText('start', X(start + 1.5), yM + cw * 1.05); }

      // ribosome, tRNA and chain
      if (phase === 'tl' && start >= 0) {
        const ci = start + k * 3; const codon = mrna.slice(ci, ci + 3);
        const isStop = CODE[codon] === '*';
        // the ribosome slides to the next codon in the last part of each cycle
        const slide = u > 0.7 && !isStop ? ease((u - 0.7) / 0.3) : 0;
        const ax = X(ci + 1.5 + slide * 3); // A site centre
        const px = ax - cw * 3; // P site centre
        const rx = (ax + px) / 2;
        g.fillStyle = rgba('#5EEAD4', 0.16); g.strokeStyle = rgba('#5EEAD4', 0.8); g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(rx, yM + cw * 1.05, cw * 4.1, cw * 0.95, 0, 0, 7); g.fill(); g.stroke();
        g.beginPath(); g.ellipse(rx, yM - cw * 2.1, cw * 4.6, cw * 2.2, 0, 0, 7); g.fill(); g.stroke();
        g.font = MONO(10); g.fillStyle = '#5EEAD4'; g.textAlign = 'center';
        g.fillText('E', px - cw * 3, yM - cw * 3.6); g.fillText('P', px, yM - cw * 3.6); g.fillText('A', ax, yM - cw * 3.6);
        const tRNA = (x, cod, aa, alpha, dy) => {
          const ac = complement(cod.replace(/U/g, 'T')).replace(/T/g, 'U');
          g.globalAlpha = alpha;
          g.fillStyle = 'rgba(232,232,227,.12)'; g.strokeStyle = 'rgba(232,232,227,.7)'; g.lineWidth = 1.2;
          g.beginPath(); g.roundRect(x - cw * 1.4, yM - cw * 1.6 + dy, cw * 2.8, cw * 0.95, 4); g.fill(); g.stroke();
          g.beginPath(); g.moveTo(x, yM - cw * 1.6 + dy); g.lineTo(x, yM - cw * 2.6 + dy); g.stroke();
          g.font = MONO(Math.round(cw * 0.55)); g.textAlign = 'center';
          for (let j = 0; j < 3; j++) { g.fillStyle = BASE_COL[ac[j]]; g.fillText(ac[j], x + (j - 1) * cw, yM - cw * 1.12 + dy); }
          if (aa) { g.fillStyle = CLASS_COL[AACLASS[aa]]; g.beginPath(); g.arc(x, yM - cw * 3.05 + dy, cw * 0.55, 0, 7); g.fill(); g.fillStyle = '#0A0A0A'; g.font = MONO(Math.round(cw * 0.42)); g.fillText(AA3[aa], x, yM - cw * 3.05 + dy); }
          g.globalAlpha = 1;
        };
        // tRNA in the P site holding the chain (previous codon)
        if (k > 0) tRNA(X(ci - 1.5), mrna.slice(ci - 3, ci), null, u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1, 0);
        // incoming tRNA in the A site
        if (!isStop) { const inT = clamp(u / 0.35, 0, 1); tRNA(X(ci + 1.5), codon, u < 0.55 ? CODE[codon] : null, inT, -(1 - ease(inT)) * cw * 4); }
        else { g.fillStyle = rgba('#FB7185', clamp(u * 3, 0, 1) * 0.85); g.beginPath(); g.roundRect(ax - cw * 1.3, yM - cw * 2.2, cw * 2.6, cw * 1.5, 6); g.fill(); g.fillStyle = '#0A0A0A'; g.font = MONO(10); g.fillText('RF', ax, yM - cw * 1.45); }
        // chain: last residue sits on the P site tRNA (or the A site one after the peptide bond)
        const anchorX = u >= 0.55 && !isStop ? X(ci + 1.5) : X(ci - 1.5);
        const release = isStop ? clamp(u * 1.4 - 0.3, 0, 1) : 0;
        const cR = cw * 0.55;
        for (let i = chain.length - 1, j = 0; i >= 0; i--, j++) {
          const x = anchorX - j * cR * 1.9 - release * cw * 6;
          const y = yM - cw * 3.05 - j * cR * 0.5 - (j % 2) * cR * 0.6 - release * cw * 3;
          if (x < -cR) break;
          g.fillStyle = CLASS_COL[AACLASS[chain[i]]];
          g.globalAlpha = 1 - release * 0.4;
          g.beginPath(); g.arc(x, y, cR, 0, 7); g.fill();
          g.fillStyle = '#0A0A0A'; g.font = MONO(Math.round(cw * 0.42)); g.textAlign = 'center'; g.fillText(AA3[chain[i]], x, y);
          g.globalAlpha = 1;
        }
      } else if (done && start >= 0) {
        g.font = MONO(11); g.fillStyle = '#A0A09A'; g.textAlign = 'center'; g.fillText(`${chain.length} amino acids made`, w / 2, yM - cw * 3);
      }
      // legend
      g.textAlign = 'left'; g.font = MONO(10.5); let lx = 8; const ly = h - 12;
      for (const [c, t] of [['np', 'nonpolar'], ['po', 'polar'], ['neg', 'acidic'], ['pos', 'basic']]) { g.fillStyle = CLASS_COL[c]; g.beginPath(); g.arc(lx + 5, ly, 5, 0, 7); g.fill(); g.fillStyle = '#A0A09A'; g.fillText(t, lx + 14, ly + 1); lx += g.measureText(t).width + 30; }
    }

    cv.onResize(draw);
    ctx.loop((t, dt) => { if (playing) advance(dt); draw(); });
    return () => {};
  },
};
