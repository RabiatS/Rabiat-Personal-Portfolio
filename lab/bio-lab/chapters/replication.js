// Chapter 3: DNA replication. A simulated replication fork: helicase unwinds, the leading strand grows continuously,
// the lagging strand is built in Okazaki fragments that are primed, extended, cleaned up and sealed.
import { MONO as MONOF, DISP as DISPF, fit, rgba, injectStyle, clamp } from './_shared.js';

const L = 150; // positions along the DNA shown
const FRAG = 24; // Okazaki fragment length in this model (positions)
const PR = 3; // primer length
let LW = 1000; let LH = 470; let AMP = 118;

const ENZ = {
  helicase: ['Helicase', 'A ring of six subunits that walks along the DNA and breaks the hydrogen bonds between bases, unzipping the two strands. It uses ATP.', '#F5F5F0'],
  topo: ['Topoisomerase', 'Unwinding ahead of the fork overtwists the DNA. Topoisomerase (DNA gyrase in bacteria) cuts, untwists and rejoins the strands to relieve that strain. Fluoroquinolone antibiotics block bacterial gyrase.', '#A78BFA'],
  ssb: ['Single strand binding proteins', 'They coat the exposed single strands so they do not snap back together or fold on themselves before they are copied.', '#A0A09A'],
  primase: ['Primase', 'DNA polymerase cannot start a strand from nothing, it can only add to an existing 3\' end. Primase lays down a short RNA primer to start from. The leading strand needs one, the lagging strand needs one for every fragment.', '#FB7185'],
  pol3: ['DNA polymerase III', 'The main copying enzyme in bacteria. It reads the template 3\' to 5\' and builds the new strand 5\' to 3\', adding about 1000 nucleotides a second. It proofreads with a 3\' to 5\' exonuclease and removes wrong bases.', '#5EEAD4'],
  pol1: ['DNA polymerase I', 'Removes the RNA primers with its 5\' to 3\' exonuclease and fills the gap with DNA at the same time.', '#A3E635'],
  ligase: ['DNA ligase', 'Seals the last nick in the backbone between neighbouring fragments by forming a phosphodiester bond, so the lagging strand becomes one continuous piece.', '#FBBF24'],
};

export default {
  mount(ctx) {
    injectStyle();
    const cv = ctx.canvas();
    const g = cv.ctx;
    let st; let playing = true; let speed = 1; let target = null; let focus = null;

    function reset() {
      st = { f: 18, lead: PR, frags: [], t: 0, nextPrime: 10, events: 0 };
      // leading strand primer at the origin
      st.leadPrimer = [0, PR];
      prime();
    }
    function prime() {
      const s = st.f - 9;
      st.frags.push({ start: s, end: s - PR, state: 'ext', primerRep: 0, sealed: false, born: st.t });
      st.lastPrime = s;
    }
    reset();

    function step(dt) {
      const v = 7 * speed;
      st.t += dt;
      if (st.f < L - 14) st.f = Math.min(L - 14, st.f + v * dt);
      st.lead = Math.min(st.f - 9, st.lead + v * 1.4 * dt);
      if (st.f - 9 - st.lastPrime >= FRAG && st.f < L - 16) prime();
      st.frags.forEach((fr, k) => {
        const stop = k === 0 ? 0 : st.frags[k - 1].start;
        if (fr.state === 'ext') {
          fr.end = Math.max(stop, fr.end - v * 1.7 * dt);
          if (fr.end <= stop) { fr.state = 'done'; fr.doneAt = st.t; }
        }
        // when the next fragment reaches this one, pol I replaces this fragment's primer, then ligase seals
        const nxt = st.frags[k + 1];
        if (nxt && nxt.state === 'done') {
          fr.primerRep = Math.min(1, fr.primerRep + dt * 1.6 * speed);
          if (fr.primerRep >= 1 && !fr.sealed) { fr.sealAt ??= st.t; if (st.t - fr.sealAt > 0.5 / speed) fr.sealed = true; }
        }
      });
      if (target != null && st.f >= target) { playing = false; target = null; playBtn.textContent = 'Play'; }
    }

    // Panel
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Replication</h2>'),
      ctx.h('<p class="lede">Before a cell divides it copies all of its DNA. The two strands unzip and each one becomes the template for a new partner. Watch one replication fork at work.</p>'),
    );
    const ctrl = ctx.h('<div class="row"></div>');
    const playBtn = ctx.h('<button class="btn sm">Pause</button>');
    playBtn.onclick = () => { playing = !playing; target = null; playBtn.textContent = playing ? 'Pause' : 'Play'; };
    const stepBtn = ctx.h('<button class="btn ghost sm">Step one fragment</button>');
    stepBtn.onclick = () => { target = Math.min(L - 14, st.f + FRAG); playing = true; playBtn.textContent = 'Pause'; };
    const resetBtn = ctx.h('<button class="btn ghost sm">Reset</button>');
    resetBtn.onclick = () => { reset(); };
    ctrl.append(playBtn, stepBtn, resetBtn);
    ctx.panel.append(ctrl, ctx.slider({ label: 'Speed', min: 0.25, max: 2.5, step: 0.25, value: 1, fmt: (x) => `${x}×`, onInput: (x) => { speed = x; } }));
    const stat = ctx.h('<div class="stat"></div>');
    ctx.panel.append(stat);
    const info = ctx.h('<div class="card bio-info"><h3>Tap an enzyme</h3><p class="small muted">Each one has a single job at the fork. Pick one to highlight it.</p></div>');
    const chips = ctx.h('<div class="bio-chips"></div>');
    for (const [k, [n]] of Object.entries(ENZ)) {
      const b = ctx.h(`<button class="chip">${n.replace('Single strand binding proteins', 'SSB proteins')}</button>`);
      b.onclick = () => { focus = focus === k ? null : k; chips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === b && focus)); info.innerHTML = focus ? `<h3>${ENZ[k][0]}</h3><p class="small">${ENZ[k][1]}</p>` : '<h3>Tap an enzyme</h3><p class="small muted">Each one has a single job at the fork.</p>'; };
      chips.append(b);
    }
    ctx.panel.append(info, chips);
    ctx.panel.append(
      ctx.h('<div class="card tip"><p>DNA polymerase can only build in one direction, 5\' to 3\'. The two template strands point opposite ways, so one new strand (leading) can follow the fork smoothly, while the other (lagging) has to be made backwards in short pieces called Okazaki fragments, which are then stitched together.</p></div>'),
      ctx.h('<div class="card try"><ol class="small"><li>Press Pause, then Step one fragment a few times. Each step, primase lays a new red primer on the lagging strand.</li><li>Watch a fragment grow left until it meets the one before it. Then the red primer it ran into turns to DNA (polymerase I) and the gap mark closes (ligase).</li><li>Compare the leading strand: one primer at the start, then one long piece.</li></ol></div>'),
      ctx.h(`<details class="more"><summary>Going deeper</summary><div class="small">
        <p><b>Semiconservative.</b> Each daughter molecule keeps one old strand and one new one, as Meselson and Stahl showed in 1958 with heavy nitrogen.</p>
        <p><b>Origins and forks.</b> Replication starts at origins and runs both ways, so each origin makes a bubble with two forks. E. coli has one origin; a human cell uses many thousands so the whole genome can be copied in the S phase of a few hours.</p>
        <p><b>Real numbers.</b> Bacterial forks move at about 1000 nucleotides per second and Okazaki fragments are about 1000 to 2000 nucleotides long. Human forks are slower, roughly 50 nucleotides per second, with fragments of about 100 to 200.</p>
        <p><b>Eukaryotic enzymes.</b> Pol α with primase starts each primer, pol ε mainly makes the leading strand and pol δ the lagging strand. RNase H and FEN1 remove primers and DNA ligase I seals. The sliding clamp (PCNA in eukaryotes) keeps the polymerase attached.</p>
        <p><b>Accuracy.</b> Base pairing, proofreading and mismatch repair together bring errors down to roughly one in a billion bases per copy. Defects in mismatch repair genes cause Lynch syndrome (hereditary colorectal cancer).</p>
        <p><b>Ends.</b> The last lagging primer at a chromosome tip leaves a gap that cannot be filled, so linear chromosomes shorten each round. Telomerase, a reverse transcriptase with its own RNA template, extends telomeres in stem cells, germ cells and most cancers.</p>
      </div></details>`),
    );
    ctx.quiz([
      { q: 'Why is the lagging strand made in pieces?', choices: ['Polymerase only adds nucleotides to a 3\' end, so on this template it must work away from the fork', 'The lagging template is damaged', 'Helicase only opens short stretches', 'Ligase cuts it into pieces'], answer: 0, why: 'Synthesis is always 5\' to 3\'. On the lagging template that direction points away from the fork, so it restarts in fragments.' },
      { q: 'Which enzyme seals the nick between two Okazaki fragments?', choices: ['Primase', 'Helicase', 'DNA ligase', 'Topoisomerase'], answer: 2, why: 'Ligase forms the final phosphodiester bond between neighbouring fragments.' },
      { q: 'Ciprofloxacin blocks bacterial DNA gyrase. What job is then left undone?', choices: ['Adding RNA primers', 'Relieving the overtwisting ahead of the fork', 'Proofreading', 'Removing primers'], answer: 1, why: 'Gyrase is a topoisomerase. Without it, strain builds ahead of the fork and replication stalls.' },
    ]);

    let view = { s: 1, ox: 0, oy: 0 };
    function X(p) { return 40 + (p / L) * (LW - 80); }

    function draw(time) {
      const { w, h } = cv; if (!w) return;
      g.clearRect(0, 0, w, h);
      LW = w < 640 ? 560 : 1000;
      LH = clamp(LW * h / w, 420, 900); AMP = Math.min(150, LH * 0.25);
      view = fit(w, h, LW, LH, 6);
      const k1 = 1 / Math.min(1, view.s * 1.15);
      const MONO = (n) => MONOF(n * k1); const DISP = (n, wt) => DISPF(n * k1, wt);
      g.save(); g.translate(view.ox, view.oy); g.scale(view.s, view.s);
      const cy = LH / 2 + 10;
      const f = st.f;
      const sm = (x) => x * x * (3 - 2 * x);
      // vertical offset of each template strand at position p: open (70) behind the fork, closed (12) ahead
      const open = (p) => { const u = clamp((f - p) / 8, 0, 1); return 14 + (AMP - 14) * sm(u); };
      const twist = (p) => (p > f ? Math.sin(p * 0.6 - time * 2.4) * 0 : 0);
      const yA = (p) => cy - open(p) + twist(p);
      const yB = (p) => cy + open(p) + twist(p);

      // base pair rungs in the duplex ahead of the fork
      g.lineWidth = 1.2;
      for (let p = Math.ceil(f) + 1; p < L; p += 1.5) { g.strokeStyle = 'rgba(160,160,154,.35)'; g.beginPath(); g.moveTo(X(p), yA(p) + 2); g.lineTo(X(p), yB(p) - 2); g.stroke(); }
      // templates
      const strand = (yf, col, lw) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); for (let p = 0; p <= L; p += 0.5) { const x = X(p); const y = yf(p); if (p) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); };
      strand(yA, '#E8E8E3', 3); strand(yB, '#E8E8E3', 3);

      // new strands sit 20 units inside each template
      const nA = (p) => yA(p) + 28; const nB = (p) => yB(p) - 28;
      const seg = (yf, a, b, col, lw = 4) => { if (b <= a) return; g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); for (let p = a; p <= b + 0.01; p += 0.5) { const q = Math.min(p, b); if (p === a) g.moveTo(X(q), yf(q)); else g.lineTo(X(q), yf(q)); } g.stroke(); };
      const rungs = (yf, yt, a, b) => { g.strokeStyle = 'rgba(94,234,212,.28)'; g.lineWidth = 1; for (let p = Math.ceil(a); p < b; p += 1.5) { g.beginPath(); g.moveTo(X(p), yt(p) + (yt(p) < yf(p) ? 2 : -2)); g.lineTo(X(p), yf(p)); g.stroke(); } };
      // leading strand (under the top template), grows rightwards
      rungs(nA, yA, 0, st.lead);
      seg(nA, 0, PR, '#FB7185'); seg(nA, PR, st.lead, '#5EEAD4');
      // arrow at the 3' end of the leading strand
      g.fillStyle = '#5EEAD4'; g.beginPath(); const lx = X(st.lead); const ly = nA(st.lead); g.moveTo(lx + 8, ly); g.lineTo(lx - 2, ly - 6); g.lineTo(lx - 2, ly + 6); g.fill();
      // lagging strand fragments, grow leftwards
      for (const [k, fr] of st.frags.entries()) {
        const pStart = fr.start - PR; // primer occupies [start - PR, start]
        rungs(nB, yB, fr.end, fr.start);
        seg(nB, fr.end + 0.3, pStart, '#5EEAD4');
        // primer, partly replaced by DNA (pol I works from the left side of it)
        const rep = fr.primerRep * PR;
        seg(nB, pStart, fr.start - rep, '#FB7185');
        seg(nB, fr.start - rep, fr.start, '#A3E635');
        // arrow at the 3' end (left)
        if (fr.state === 'ext') { g.fillStyle = '#5EEAD4'; const ax = X(fr.end); const ay = nB(fr.end); g.beginPath(); g.moveTo(ax - 8, ay); g.lineTo(ax + 2, ay - 6); g.lineTo(ax + 2, ay + 6); g.fill(); }
        // nick between this fragment's left end and the previous one, until sealed by ligase
        const prev = st.frags[k - 1];
        if (prev && fr.state === 'done' && !prev.sealed) { const nx = X(prev.start - prev.primerRep * PR); const ny = nB(prev.start); g.strokeStyle = '#0A0A0A'; g.lineWidth = 3; g.beginPath(); g.moveTo(nx, ny - 5); g.lineTo(nx, ny + 5); g.stroke(); }
        // label fragment number
        if (fr.start - fr.end > 8) { g.font = MONO(10); g.fillStyle = '#A0A09A'; g.textAlign = 'center'; g.fillText(`${k + 1}`, X((fr.start + fr.end) / 2), nB(fr.start) - 10); }
      }
      // SSBs on the exposed lagging template between last primer and the fork
      const lastS = st.lastPrime;
      for (let p = lastS + 2.5; p < f - 6; p += 3.2) { g.fillStyle = hl('ssb') ? '#F5F5F0' : 'rgba(160,160,154,.75)'; g.beginPath(); g.arc(X(p), yB(p) + 9, 5, 0, 7); g.fill(); }

      // enzymes
      const ring = (x, y, r, k) => { if (!hl(k)) return; g.strokeStyle = ENZ[k][2]; g.lineWidth = 1.5; g.setLineDash([4, 4]); g.beginPath(); g.arc(x, y, r + 8 + Math.sin(time * 5) * 2, 0, 7); g.stroke(); g.setLineDash([]); };
      const tag = (x, y, text, col) => { g.font = MONO(11); g.textAlign = 'center'; g.fillStyle = col; g.fillText(text, x, y); };
      // topoisomerase ahead
      const tx = X(Math.min(L - 3, f + 16)); g.fillStyle = rgba('#A78BFA', 0.85); g.beginPath(); g.ellipse(tx, cy, 16, 26, 0, 0, 7); g.fill(); ring(tx, cy, 26, 'topo'); tag(tx, cy - 38, 'topoisomerase', '#A78BFA');
      // helicase at the fork
      const hx = X(f) + 4; g.save(); g.translate(hx, cy); g.rotate(time * 2); g.strokeStyle = '#F5F5F0'; g.lineWidth = 7; g.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2; g.lineTo(Math.cos(a) * 17, Math.sin(a) * 17); } g.stroke(); g.restore(); ring(hx, cy, 20, 'helicase'); tag(hx + 52, cy + 44, 'helicase', '#F5F5F0');
      // primase near the newest primer while it is young
      const nf = st.frags[st.frags.length - 1];
      if (nf && st.t - nf.born < 1.2 / speed) { const px = X(nf.start - 1.5); const py = nB(nf.start) - 14; g.fillStyle = rgba('#FB7185', 0.9); g.beginPath(); g.arc(px, py, 10, 0, 7); g.fill(); ring(px, py, 10, 'primase'); tag(px, py - 16, 'primase', '#FB7185'); }
      else if (hl('primase') && nf) { ring(X(nf.start - 1.5), nB(nf.start), 6, 'primase'); }
      // pol III on leading and on the growing lagging fragment
      const pol = (x, y, up) => { g.fillStyle = rgba('#5EEAD4', 0.9); g.beginPath(); g.roundRect(x - 16, y - 11, 32, 22, 9); g.fill(); g.fillStyle = '#0A0A0A'; g.font = MONO(9.5); g.textAlign = 'center'; g.fillText('III', x, y + 3.5); ring(x, y, 14, 'pol3'); if (up != null) tag(x, y + up, 'pol III', '#5EEAD4'); };
      pol(X(st.lead) - 6, nA(st.lead) + 2, 28);
      const grow = st.frags.find((x) => x.state === 'ext');
      if (grow) pol(X(grow.end) + 6, nB(grow.end) - 2, -18);
      // pol I and ligase where cleanup is happening
      for (const fr of st.frags) {
        if (fr.primerRep > 0 && fr.primerRep < 1) { const x = X(fr.start - fr.primerRep * PR); const y = nB(fr.start) - 18; g.fillStyle = rgba('#A3E635', 0.9); g.beginPath(); g.roundRect(x - 12, y - 9, 24, 18, 7); g.fill(); g.fillStyle = '#0A0A0A'; g.font = MONO(9.5); g.textAlign = 'center'; g.fillText('I', x, y + 3.5); ring(x, y, 10, 'pol1'); tag(x, y - 14, 'pol I', '#A3E635'); }
        if (fr.primerRep >= 1 && !fr.sealed) { const x = X(fr.start - PR); const y = nB(fr.start) - 18; g.fillStyle = '#FBBF24'; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); ring(x, y, 8, 'ligase'); tag(x, y - 14, 'ligase', '#FBBF24'); }
      }
      // end labels
      g.font = MONO(12); g.textAlign = 'center';
      g.fillStyle = '#E8E8E3';
      g.fillText("3'", X(0) - 16, yA(0) + 4); g.fillText("5'", X(L) + 18, yA(L) + 4);
      g.fillText("5'", X(0) - 16, yB(0) + 4); g.fillText("3'", X(L) + 18, yB(L) + 4);
      g.fillStyle = '#5EEAD4'; g.fillText("5'", X(0) - 16, nA(0) + 4); g.fillText("3'", X(0) - 16, nB(0) + 4);
      g.font = DISP(15, 700); g.textAlign = 'left'; g.fillStyle = '#5EEAD4';
      g.fillText('LEADING STRAND', X(0), yA(0) - 16);
      g.fillText('LAGGING STRAND', X(0), yB(0) + 28);
      g.font = MONO(10.5); g.fillStyle = '#A0A09A';
      g.fillText('fork moves this way →', Math.min(X(f) + 40, LW - 170), cy - 70);
      // legend
      const lg = [['#E8E8E3', 'template (parent)'], ['#5EEAD4', 'new DNA'], ['#FB7185', 'RNA primer'], ['#A3E635', 'DNA filled in by pol I']];
      let lx2 = 40; g.font = MONO(10.5);
      let ly2 = LH - 12 - (LW < 700 ? 22 * k1 : 0);
      for (const [c, t] of lg) { const tw = g.measureText(t).width; if (lx2 + tw + 20 > LW) { lx2 = 40; ly2 += 22 * k1; } g.fillStyle = c; g.fillRect(lx2, ly2 - 6, 14, 4); g.fillStyle = '#A0A09A'; g.fillText(t, lx2 + 20, ly2); lx2 += tw + 46; }
      g.restore();
      const sealed = st.frags.filter((x) => x.sealed).length;
      const sh = `<div><b>${Math.round(st.lead)}</b><span>leading length</span></div><div><b>${st.frags.length}</b><span>Okazaki fragments</span></div><div><b>${sealed}</b><span>joins sealed</span></div>`;
      if (sh !== lastStat) { stat.innerHTML = sh; lastStat = sh; }
    }
    const hl = (k) => focus === k;
    let lastStat = '';

    cv.onResize(() => draw(0));
    let tt = 0;
    ctx.loop((t, dt) => { if (playing) step(dt); tt += dt; draw(tt); });
    return () => {};
  },
};
