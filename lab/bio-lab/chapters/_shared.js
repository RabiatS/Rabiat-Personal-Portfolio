// Shared helpers for Bio Lab chapters: fonts, layout fitting, pointer input and the standard genetic code.

export const MONO = (s = 11, w = 500) => `${w} ${s}px "DM Mono", ui-monospace, monospace`;
export const DISP = (s = 14, w = 600) => `${w} ${s}px Rajdhani, system-ui, sans-serif`;
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// Fit a logical lw x lh drawing into w x h, centred. Returns scale and offsets.
export function fit(w, h, lw, lh, pad = 0) {
  const s = Math.min((w - pad * 2) / lw, (h - pad * 2) / lh);
  return { s, ox: (w - lw * s) / 2, oy: (h - lh * s) / 2 };
}

// Pointer helper: calls down/move/up with stage local coordinates.
export function pointer(el, signal, { down, move, up, hover }) {
  const pos = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  let dragging = false;
  el.addEventListener('pointerdown', (e) => { dragging = true; try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ } down && down(...pos(e), e); }, { signal });
  el.addEventListener('pointermove', (e) => { if (dragging) move && move(...pos(e), e); else hover && hover(...pos(e), e); }, { signal });
  const end = (e) => { if (!dragging) return; dragging = false; up && up(...pos(e), e); };
  el.addEventListener('pointerup', end, { signal });
  el.addEventListener('pointercancel', end, { signal });
}

// A dock of overlay buttons on the stage. groups: [{ label, items: [[value, text]], value, onChange }]
export function dock(ctx, groups) {
  const d = ctx.h('<div class="dock"></div>');
  for (const g of groups) {
    const grp = ctx.h(`<div class="grp glass">${g.label ? `<span>${g.label}</span>` : ''}</div>`);
    for (const [v, t] of g.items) {
      const b = document.createElement('button');
      b.textContent = t; b.dataset.v = v;
      if (String(v) === String(g.value)) b.classList.add('on');
      b.addEventListener('click', () => {
        if (!g.momentary) grp.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
        g.onChange && g.onChange(v);
      });
      grp.append(b);
    }
    g.el = grp;
    g.set = (v) => grp.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === String(v)));
    d.append(grp);
  }
  ctx.stage.append(d);
  return d;
}

export function arrow(g, x1, y1, x2, y2, head = 7) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  g.beginPath(); g.moveTo(x2, y2);
  g.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45));
  g.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45));
  g.closePath(); g.fill();
}

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Base colours used across the molecular chapters.
export const BASE_COL = { A: '#A3E635', T: '#FB7185', U: '#FB7185', G: '#FBBF24', C: '#60A5FA' };
export const PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' };
export const complement = (s) => s.split('').map((b) => PAIR[b] || '?').join('');
export const revcomp = (s) => complement(s).split('').reverse().join('');
export const cleanDNA = (s) => s.toUpperCase().replace(/U/g, 'T').replace(/[^ATGC]/g, '');

// Standard genetic code, first, second, third base in the order U C A G.
const B = 'UCAG';
const AAS = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
export const CODE = {};
for (let i = 0; i < 64; i++) CODE[B[i >> 4] + B[(i >> 2) & 3] + B[i & 3]] = AAS[i];
export const AA3 = { A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', Q: 'Gln', E: 'Glu', G: 'Gly', H: 'His', I: 'Ile', L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser', T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val', '*': 'Stop' };
export const AANAME = { A: 'alanine', R: 'arginine', N: 'asparagine', D: 'aspartate', C: 'cysteine', Q: 'glutamine', E: 'glutamate', G: 'glycine', H: 'histidine', I: 'isoleucine', L: 'leucine', K: 'lysine', M: 'methionine', F: 'phenylalanine', P: 'proline', S: 'serine', T: 'threonine', W: 'tryptophan', Y: 'tyrosine', V: 'valine', '*': 'stop' };
// Side chain class, for colouring amino acids.
export const AACLASS = { A: 'np', V: 'np', L: 'np', I: 'np', M: 'np', F: 'np', W: 'np', P: 'np', G: 'np', S: 'po', T: 'po', C: 'po', Y: 'po', N: 'po', Q: 'po', D: 'neg', E: 'neg', K: 'pos', R: 'pos', H: 'pos', '*': 'stop' };
export const CLASS_COL = { np: '#FBBF24', po: '#5EEAD4', neg: '#FB7185', pos: '#60A5FA', stop: '#A0A09A' };
export const CLASS_NAME = { np: 'nonpolar', po: 'polar', neg: 'acidic (negative)', pos: 'basic (positive)', stop: 'stop' };

// Codon table as HTML: 16 blocks, each holding the four codons that share the first two bases.
export function codonTableHTML() {
  let html = '<div class="bio-ct">';
  for (const a of B) for (const b of B) {
    html += '<div class="blk">';
    for (const c of B) {
      const k = a + b + c; const aa = CODE[k];
      html += `<span data-c="${k}" class="${aa === '*' ? 'stop' : ''}${k === 'AUG' ? ' start' : ''}"><b>${k}</b> ${AA3[aa]}</span>`;
    }
    html += '</div>';
  }
  return `${html}</div>`;
}

// Small style block shared by chapters, injected once.
export function injectStyle() {
  if (document.getElementById('bio-style')) return;
  const s = document.createElement('style');
  s.id = 'bio-style';
  s.textContent = `
  .bio-ct { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3px; font: 500 10.5px/1.35 var(--f-mono); }
  .bio-ct .blk { background: var(--surface-2); border-radius: 6px; padding: 4px 5px; display: grid; }
  .bio-ct span { color: var(--muted); border-radius: 3px; padding: 0 2px; white-space: nowrap; }
  .bio-ct span b { font-weight: 500; color: var(--text-2); }
  .bio-ct span.stop { color: #FB7185; }
  .bio-ct span.start b { color: var(--c6); }
  .bio-ct span.on { background: var(--r-bone); color: var(--r-void); }
  .bio-ct span.on b { color: var(--r-void); }
  .bio-tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
  .bio-tbl th, .bio-tbl td { text-align: left; padding: 5px 6px; border-bottom: 1px solid var(--border); vertical-align: top; }
  .bio-tbl th { font: 600 11px var(--f-display); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .bio-seq { font: 500 14px/1.6 var(--f-mono); word-break: break-all; letter-spacing: .04em; }
  .bio-seq i { font-style: normal; }
  .bio-info { min-height: 92px; }
  .bio-info h3 { color: var(--text); }
  .bio-chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .bio-mut { display: grid; gap: 4px; }
  .bio-big { font: 700 22px/1.1 var(--f-display); letter-spacing: .02em; text-transform: uppercase; }
  `;
  document.head.append(s);
}
