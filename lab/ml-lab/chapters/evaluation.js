// Is it any good? Threshold a score, read the confusion matrix, precision, recall, F1 and the ROC curve.

const MONO = '500 11px "DM Mono", ui-monospace, monospace';
const MONO_B = '500 15px "DM Mono", ui-monospace, monospace';
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
// standard normal CDF (Abramowitz and Stegun 7.1.26 style erf approximation)
function Phi(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2);
  return z >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}
const pdf = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
const SD = 11; const MU_N = 36;

const SCEN = {
  disease: { N: 10000, prev: 0.02, sep: 2.2, pos: 'sick', neg: 'healthy', posP: 'sick people', negP: 'healthy people', item: 'people', who: 'The test', flag: 'test says sick', clear: 'test says healthy', score: 'test reading', thr: 50 },
  spam: { N: 1000, prev: 0.3, sep: 2.6, pos: 'spam', neg: 'not spam', posP: 'spam emails', negP: 'real emails', item: 'emails', who: 'The filter', flag: 'sent to spam folder', clear: 'sent to inbox', score: 'spam score', thr: 55 },
};

export default {
  mount(ctx) {
    const C = ctx.colors; const POS = C.c2; const NEG = C.c5;
    const cv = ctx.canvas({ style: 'touch-action:none' });
    const g = cv.ctx;
    let sc = SCEN.disease; let prev = sc.prev; let sep = sc.sep; let thr = sc.thr; let sameH = false;
    let L = {}; let dragging = false;
    const muP = () => MU_N + SD * sep;

    function metrics(t = thr) {
      const P = sc.N * prev; const Ng = sc.N - P;
      const tpr = 1 - Phi((t - muP()) / SD); const fpr = 1 - Phi((t - MU_N) / SD);
      const TP = Math.round(P * tpr); const FN = Math.round(P) - TP; const FP = Math.round(Ng * fpr); const TN = Math.round(Ng) - FP;
      const acc = (TP + TN) / (TP + TN + FP + FN);
      const prec = TP + FP ? TP / (TP + FP) : NaN; const rec = TP + FN ? TP / (TP + FN) : NaN;
      const f1 = prec + rec > 0 ? 2 * prec * rec / (prec + rec) : 0;
      return { TP, FN, FP, TN, acc, prec, rec, f1, spec: TN / (TN + FP), tpr, fpr };
    }

    cv.onResize((W, H) => {
      const bottom = 56; const Hs = H - bottom; const top = Math.round(Hs * 0.47);
      L.d = { x: 14, y: 22, w: W - 28, h: top - 48 };
      const by = top + 8; const bh = Hs - by - 6;
      const cs = Math.min(bh - 24, (W - 40) / 2);
      L.m = { x: 14 + 20, y: by + 18, s: cs - 20 };
      L.r = { x: W / 2 + 34, y: by + 8, s: Math.min(cs - 30, W / 2 - 50) };
    });
    const sMin = 0; const sMax = 100;
    const dx = (s) => L.d.x + (s - sMin) / (sMax - sMin) * L.d.w;
    const idx = (px) => sMin + (px - L.d.x) / L.d.w * (sMax - sMin);

    // ----- panel -----
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Is it any good?</h2>'),
      ctx.h('<p class="lede">A model that is right 98% of the time can be completely useless. To know whether a classifier is good you have to count the different ways it can be wrong.</p>'),
    );
    const scenSeg = ctx.seg([['disease', 'Disease test'], ['spam', 'Spam filter']], 'disease', (v) => {
      sc = SCEN[v]; prev = sc.prev; sep = sc.sep; thr = sc.thr;
      prevS.value = Math.log10(prev * 100); sepS.value = sep; thrS.value = thr; syncText();
    });
    ctx.panel.append(scenSeg);
    const thrS = ctx.slider({ label: 'Threshold (flag if score is above)', min: 0, max: 100, step: 0.5, value: thr, fmt: (v) => v.toFixed(1), onInput: (v) => { thr = v; syncText(); } });
    const prevS = ctx.slider({ label: 'How common the positive class is', min: Math.log10(0.5), max: Math.log10(50), step: 0.01, value: Math.log10(prev * 100), fmt: (v) => `${(10 ** v).toFixed(10 ** v < 2 ? 1 : 0)}%`, onInput: (v) => { prev = 10 ** v / 100; syncText(); } });
    const sepS = ctx.slider({ label: 'How well the score separates them', min: 0, max: 4, step: 0.05, value: sep, fmt: (v) => (v < 0.6 ? 'barely' : v < 1.6 ? 'somewhat' : v < 2.8 ? 'well' : 'very well'), onInput: (v) => { sep = v; syncText(); } });
    ctx.panel.append(thrS, prevS, sepS);
    const row = ctx.h('<div class="row"><button class="btn ghost sm" data-a="lazy"></button><button class="btn ghost sm" data-a="f1">Best F1</button><label class="check"><input type="checkbox"> same height</label></div>');
    row.querySelector('[data-a="lazy"]').onclick = () => { thr = 100; thrS.value = thr; syncText(); };
    row.querySelector('[data-a="f1"]').onclick = () => { let best = 0; let bt = thr; for (let t = 0; t <= 100; t += 0.5) { const m = metrics(t); if (m.f1 > best) { best = m.f1; bt = t; } } thr = bt; thrS.value = thr; syncText(); };
    row.querySelector('input').onchange = (e) => { sameH = e.target.checked; };
    ctx.panel.append(row);
    const stats = ctx.h('<div class="stat" style="grid-template-columns:repeat(3,1fr)"><div><b data-s="acc">0</b><span>Accuracy</span></div><div><b data-s="prec">0</b><span>Precision</span></div><div><b data-s="rec">0</b><span>Recall</span></div><div><b data-s="f1">0</b><span>F1</span></div><div><b data-s="spec">0</b><span>Specificity</span></div><div><b data-s="auc">0</b><span>ROC AUC</span></div></div>');
    ctx.panel.append(stats);
    const story = ctx.h('<div class="card" style="gap:6px"></div>');
    ctx.panel.append(story);
    const st = (k) => stats.querySelector(`[data-s="${k}"]`);
    const pct = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : 'n/a');

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>The model gives everything a score, and we pick a <b>threshold</b>: above it, we say "yes". Each prediction then lands in one of four boxes, the <b>confusion matrix</b>: true positives and true negatives are the hits, false positives (false alarms) and false negatives (misses) are the two kinds of mistake.</p>
      <p><b>Precision</b>: when it says yes, how often is it right? <b>Recall</b>: of all the real yeses, how many did it catch? Raising the threshold usually trades recall for precision. <b>F1</b> is a single number that is only high when both are.</p>
      <p><b>Why accuracy lies:</b> if only 2 in 100 people are sick, a "test" that always says healthy is 98% accurate and catches nobody. On rare events, accuracy mostly measures how rare they are.</p>
    </div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li>Drag the white threshold line on the plot. Watch the four boxes trade counts and the dot slide along the ROC curve.</li>
      <li>Press <b>Always say healthy</b>. Accuracy is high, recall is zero.</li>
      <li>In the disease test, lower the threshold until recall is above 95%. Now look at precision: most people flagged are actually healthy, because healthy people vastly outnumber sick ones.</li>
      <li>Slide <b>how common</b> up to 50% and see precision recover, with the same test.</li>
    </ol></div>`));
    ctx.panel.append(ctx.h(`<div class="card deep">
      <div class="formula">precision = TP / (TP + FP)<span>recall (sensitivity, true positive rate) = TP / (TP + FN)</span></div>
      <div class="formula">F1 = 2 · P · R / (P + R)<span>specificity = TN / (TN + FP), false positive rate = 1 − specificity</span></div>
      <p>The <b>ROC curve</b> plots recall against false positive rate for every threshold at once. A useless model follows the diagonal. The area under it (AUC) is the chance that a random positive scores higher than a random negative, and it does not depend on how common the classes are. Precision does, which is why for rare events people also look at precision and recall curves.</p>
      <p>Which mistake is worse depends on the job. Missing a disease (false negative) can be far worse than a follow up test after a false alarm, so screening tests favour recall. A spam filter that bins a job offer (false positive) is worse than letting one spam through, so it favours precision.</p>
      <p>Here the scores come from two bell curves, so every number is exact: the counts are the areas on each side of the threshold.</p>
    </div>`));
    ctx.quiz([
      { q: '1% of transactions are fraud. A model labels everything "not fraud". Its accuracy is…', choices: ['1%', '50%', '99%, and it catches no fraud at all'], answer: 2, why: 'It is right on all the 99% that are normal. That is why accuracy alone is misleading on imbalanced data.' },
      { q: 'Precision answers which question?', choices: ['Of the real positives, how many did we catch?', 'Of the items we flagged, how many were really positive?', 'How many items did we look at?'], answer: 1, why: 'Precision is about the flagged items. "Of the real positives, how many did we catch" is recall.' },
      { q: 'You lower the threshold, so more things get flagged. What usually happens?', choices: ['Recall goes up, precision tends to go down', 'Both go down', 'Nothing changes'], answer: 0, why: 'Flagging more catches more real positives but also more false alarms.' },
    ]);

    // ----- dock -----
    const dock = ctx.h('<div class="dock"><div class="grp glass"><button data-t="20">Strict on misses</button><button data-t="50">Balanced</button><button data-t="70">Strict on false alarms</button></div></div>');
    ctx.stage.append(dock);
    dock.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => { thr = +b.dataset.t; thrS.value = thr; syncText(); }; });

    cv.el.addEventListener('pointerdown', (e) => {
      const r = cv.el.getBoundingClientRect(); const x = e.clientX - r.left; const y = e.clientY - r.top;
      if (y < L.d.y - 20 || y > L.d.y + L.d.h + 20) return;
      dragging = true; thr = Math.max(0, Math.min(100, idx(x))); thrS.value = thr; syncText();
      cv.el.setPointerCapture(e.pointerId);
    }, { signal: ctx.signal });
    cv.el.addEventListener('pointermove', (e) => {
      const r = cv.el.getBoundingClientRect(); const x = e.clientX - r.left; const y = e.clientY - r.top;
      if (!dragging) { cv.el.style.cursor = (y > L.d.y - 20 && y < L.d.y + L.d.h + 20) ? 'ew-resize' : 'default'; return; }
      thr = Math.max(0, Math.min(100, idx(x))); thrS.value = thr; syncText();
    }, { signal: ctx.signal });
    const up = () => { dragging = false; };
    cv.el.addEventListener('pointerup', up, { signal: ctx.signal });
    cv.el.addEventListener('pointercancel', up, { signal: ctx.signal });

    function syncText() {
      const m = metrics();
      row.querySelector('[data-a="lazy"]').textContent = `Always say ${sc.neg}`;
      st('acc').textContent = pct(m.acc); st('prec').textContent = pct(m.prec); st('rec').textContent = pct(m.rec);
      st('f1').textContent = m.f1.toFixed(2); st('spec').textContent = pct(m.spec); st('auc').textContent = Phi(sep / Math.SQRT2).toFixed(3);
      const P = Math.round(sc.N * prev);
      story.innerHTML = `<p class="small">Out of <b>${sc.N.toLocaleString('en')}</b> ${sc.item}, <b>${P.toLocaleString('en')}</b> are really ${sc.pos}.</p>
        <p class="small">${sc.who} flags <b>${(m.TP + m.FP).toLocaleString('en')}</b> ${sc.item} as ${sc.pos}: <b style="color:${POS}">${m.TP.toLocaleString('en')}</b> correctly and <b style="color:${NEG}">${m.FP.toLocaleString('en')}</b> by mistake. It misses <b style="color:${POS}">${m.FN.toLocaleString('en')}</b> ${sc.posP}.</p>
        <p class="small">${m.TP + m.FP ? `So a flag means "really ${sc.pos}" only <b>${pct(m.prec)}</b> of the time.` : 'Nothing is flagged, so nothing is caught.'}</p>`;
    }
    syncText();

    ctx.loop(() => {
      const { w: W, h: H } = cv; g.clearRect(0, 0, W, H);
      if (!L.d) return;
      const m = metrics(); const D = L.d;
      const P = sc.N * prev; const Ng = sc.N - P;
      const kP = sameH ? 1 : P; const kN = sameH ? 1 : Ng;
      const peak = Math.max(kP, kN) * pdf(0, 0, SD);
      const dy = (v) => D.y + D.h - v / peak * D.h * 0.92;
      const step = (sMax - sMin) / Math.max(80, D.w / 2);
      // filled areas, each class split at the threshold
      const area = (mu, k, from, to, col) => {
        if (to <= from) return;
        g.beginPath(); g.moveTo(dx(from), dy(0));
        for (let s = from; s <= to + 1e-9; s += step) g.lineTo(dx(Math.min(s, to)), dy(k * pdf(s, mu, SD)));
        g.lineTo(dx(to), dy(k * pdf(to, mu, SD))); g.lineTo(dx(to), dy(0)); g.closePath(); g.fillStyle = col; g.fill();
      };
      area(MU_N, kN, sMin, thr, rgba(NEG, 0.12)); area(MU_N, kN, thr, sMax, rgba(NEG, 0.45));
      area(muP(), kP, sMin, thr, rgba(POS, 0.16)); area(muP(), kP, thr, sMax, rgba(POS, 0.55));
      const curve = (mu, k, col) => { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); for (let s = sMin; s <= sMax; s += step) { const X = dx(s); const Y = dy(k * pdf(s, mu, SD)); if (s === sMin) g.moveTo(X, Y); else g.lineTo(X, Y); } g.stroke(); };
      curve(MU_N, kN, NEG); curve(muP(), kP, POS);
      g.strokeStyle = C.borderStrong; g.lineWidth = 1; g.beginPath(); g.moveTo(D.x, dy(0) + 0.5); g.lineTo(D.x + D.w, dy(0) + 0.5); g.stroke();
      // threshold
      const tx = dx(thr);
      g.strokeStyle = C.text; g.lineWidth = 2; g.beginPath(); g.moveTo(tx, D.y - 14); g.lineTo(tx, dy(0)); g.stroke();
      g.beginPath(); g.arc(tx, D.y - 14, 5, 0, 6.283); g.fillStyle = C.text; g.fill();
      g.font = MONO; g.textBaseline = 'middle'; g.fillStyle = C.muted;
      g.textAlign = tx > D.x + D.w - 140 ? 'right' : 'left';
      const off = g.textAlign === 'right' ? -10 : 10;
      g.fillText(`${sc.flag} →`, tx + off, D.y - 14);
      g.textAlign = 'left'; g.textBaseline = 'top';
      g.fillStyle = NEG; g.fillText(`${sc.neg} (${Math.round(Ng).toLocaleString('en')})`, D.x, dy(0) + 6);
      g.fillStyle = POS; const lt = `${sc.pos} (${Math.round(P).toLocaleString('en')})`; g.textAlign = 'right'; g.fillText(lt, D.x + D.w, dy(0) + 6);
      g.fillStyle = C.subtle; g.textAlign = 'center'; g.fillText(`${sc.score}${sameH ? ' (heights equalised)' : ''}`, D.x + D.w / 2, dy(0) + 6);
      if (!sameH && P / Ng < 0.08) { g.fillStyle = POS; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(`the small bump is the ${sc.posP}`, dx(muP()), dy(kP * pdf(muP(), muP(), SD)) - 16); }

      // confusion matrix
      const M = L.m; const cs = M.s / 2;
      if (cs > 20) {
        const cells = [
          [m.TP, 'true pos', true, 0, 0], [m.FN, 'false neg', false, 1, 0],
          [m.FP, 'false pos', false, 0, 1], [m.TN, 'true neg', true, 1, 1],
        ];
        const total = sc.N;
        for (const [v, lab, ok, col, rowI] of cells) {
          const X = M.x + col * cs; const Y = M.y + rowI * cs;
          const a = 0.08 + 0.5 * Math.sqrt(v / total);
          g.fillStyle = rgba(ok ? C.ok : C.bad, a); g.fillRect(X + 2, Y + 2, cs - 4, cs - 4);
          g.strokeStyle = rgba(ok ? C.ok : C.bad, 0.5); g.lineWidth = 1; g.strokeRect(X + 2.5, Y + 2.5, cs - 5, cs - 5);
          g.fillStyle = C.text; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.font = cs > 70 ? MONO_B : MONO; g.fillText(v.toLocaleString('en'), X + cs / 2, Y + cs / 2 - (cs > 50 ? 7 : 0));
          if (cs > 50) { g.font = MONO; g.fillStyle = C.muted; g.fillText(lab, X + cs / 2, Y + cs / 2 + 12); }
        }
        g.font = MONO; g.fillStyle = C.muted; g.textAlign = 'center'; g.textBaseline = 'bottom';
        g.fillText(cs > 95 ? `said ${sc.pos}` : 'said +', M.x + cs / 2, M.y - 2); g.fillText(cs > 95 ? `said ${sc.neg}` : 'said −', M.x + cs * 1.5, M.y - 2);
        g.save(); g.translate(M.x - 6, M.y + cs / 2); g.rotate(-Math.PI / 2); g.textBaseline = 'bottom'; g.fillStyle = POS; g.fillText(cs > 95 ? `really ${sc.pos}` : 'real +', 0, 0); g.restore();
        g.save(); g.translate(M.x - 6, M.y + cs * 1.5); g.rotate(-Math.PI / 2); g.textBaseline = 'bottom'; g.fillStyle = NEG; g.fillText(cs > 95 ? `really ${sc.neg}` : 'real −', 0, 0); g.restore();
      }

      // ROC
      const R = L.r; const rs = R.s;
      if (rs > 40) {
        const rx = (f) => R.x + f * rs; const ry = (t) => R.y + rs - t * rs;
        g.strokeStyle = C.borderStrong; g.lineWidth = 1; g.strokeRect(R.x + 0.5, R.y + 0.5, rs, rs);
        g.setLineDash([4, 5]); g.beginPath(); g.moveTo(rx(0), ry(0)); g.lineTo(rx(1), ry(1)); g.stroke(); g.setLineDash([]);
        g.beginPath(); g.moveTo(rx(1), ry(1));
        for (let t = -40; t <= 140; t += 1) { const tp = 1 - Phi((t - muP()) / SD); const fp = 1 - Phi((t - MU_N) / SD); g.lineTo(rx(fp), ry(tp)); }
        g.lineTo(rx(0), ry(0)); g.lineTo(rx(1), ry(0)); g.closePath(); g.fillStyle = 'rgba(94,234,212,0.07)'; g.fill();
        g.strokeStyle = C.c1; g.lineWidth = 2; g.beginPath();
        for (let t = -40; t <= 140; t += 1) { const tp = 1 - Phi((t - muP()) / SD); const fp = 1 - Phi((t - MU_N) / SD); if (t === -40) g.moveTo(rx(fp), ry(tp)); else g.lineTo(rx(fp), ry(tp)); }
        g.stroke();
        g.beginPath(); g.arc(rx(m.fpr), ry(m.tpr), 6, 0, 6.283); g.fillStyle = C.text; g.fill(); g.strokeStyle = C.bg; g.lineWidth = 2; g.stroke();
        g.font = MONO; g.fillStyle = C.muted; g.textAlign = 'center'; g.textBaseline = 'top';
        g.fillText('false alarm rate', R.x + rs / 2, R.y + rs + 4);
        g.save(); g.translate(R.x - 4, R.y + rs / 2); g.rotate(-Math.PI / 2); g.textBaseline = 'bottom'; g.fillText('recall', 0, 0); g.restore();
        g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillStyle = C.c1; g.fillText(`ROC, AUC ${Phi(sep / Math.SQRT2).toFixed(2)}`, R.x + rs - 4, R.y + rs - 4);
      }
    });
  },
};
