// Shared drawing and input helpers for Physics Lab chapters.

export const MONO = '500 11px "DM Mono", ui-monospace, monospace';
export const MONO_S = '500 10px "DM Mono", ui-monospace, monospace';
export const HEAD = '700 13px Rajdhani, system-ui, sans-serif';

export const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function fmt(v, d = 2) {
  if (!Number.isFinite(v)) return '--';
  const s = v.toFixed(d);
  return s === `-${(0).toFixed(d)}` ? (0).toFixed(d) : s;
}

// Hex colour with alpha.
export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function text(g, s, x, y, color = '#A0A09A', align = 'left', base = 'alphabetic', font = MONO) {
  g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = base;
  g.fillText(s, x, y);
}

// Text with a dark halo so it stays legible on top of busy drawings.
export function tag(g, s, x, y, color = '#F5F5F0', align = 'left', base = 'middle', font = MONO) {
  g.font = font; g.textAlign = align; g.textBaseline = base;
  g.lineWidth = 3; g.strokeStyle = 'rgba(10,10,10,.85)'; g.lineJoin = 'round';
  g.strokeText(s, x, y);
  g.fillStyle = color; g.fillText(s, x, y);
}

export function arrow(g, x1, y1, x2, y2, color, lw = 2, head = 9) {
  const dx = x2 - x1; const dy = y2 - y1; const L = Math.hypot(dx, dy);
  if (L < 0.5) return;
  const ux = dx / L; const uy = dy / L; const hh = Math.min(head, L * 0.6);
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2 - ux * hh * 0.8, y2 - uy * hh * 0.8); g.stroke();
  g.beginPath(); g.moveTo(x2, y2);
  g.lineTo(x2 - ux * hh - uy * hh * 0.45, y2 - uy * hh + ux * hh * 0.45);
  g.lineTo(x2 - ux * hh + uy * hh * 0.45, y2 - uy * hh - ux * hh * 0.45);
  g.closePath(); g.fill();
}

export function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h);
}

// A small strip chart. series: [{ data: [[x, y], ...], color, dash, width }]
export function chart(g, box, series, o = {}) {
  const { x, y, w, h } = box;
  const xmin = o.xmin ?? 0; const xmax = o.xmax ?? 1;
  const ymin = o.ymin ?? -1; const ymax = o.ymax ?? 1;
  g.save();
  g.fillStyle = 'rgba(20,20,20,.55)'; rrect(g, x, y, w, h, 8); g.fill();
  g.strokeStyle = '#2A2A2A'; g.lineWidth = 1; rrect(g, x + 0.5, y + 0.5, w - 1, h - 1, 8); g.stroke();
  const px = (v) => x + ((v - xmin) / (xmax - xmin)) * w;
  const py = (v) => y + h - ((v - ymin) / (ymax - ymin)) * h;
  // grid
  g.strokeStyle = 'rgba(255,255,255,.05)';
  if (o.xstep) { for (let v = Math.ceil(xmin / o.xstep) * o.xstep; v <= xmax; v += o.xstep) { g.beginPath(); g.moveTo(px(v), y); g.lineTo(px(v), y + h); g.stroke(); } }
  if (ymin < 0 && ymax > 0) { g.strokeStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x, py(0)); g.lineTo(x + w, py(0)); g.stroke(); }
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  for (const s of series) {
    if (!s.data || s.data.length < 2) continue;
    g.strokeStyle = s.color; g.lineWidth = s.width || 1.6; g.setLineDash(s.dash || []); g.lineJoin = 'round';
    g.beginPath();
    let first = true;
    for (const [a, b] of s.data) { if (!Number.isFinite(b)) { first = true; continue; } const X = px(a); const Y = py(b); if (first) { g.moveTo(X, Y); first = false; } else g.lineTo(X, Y); }
    g.stroke();
    if (s.dot) { const [a, b] = s.data[s.data.length - 1]; g.fillStyle = s.color; g.beginPath(); g.arc(px(a), py(b), 3, 0, 7); g.fill(); }
  }
  g.setLineDash([]);
  g.restore();
  if (o.title) text(g, o.title, x + 8, y + 15, o.titleColor || '#E8E8E3');
  if (o.ylab !== false) {
    text(g, o.ytop ?? fmt(ymax, o.yd ?? 1), x + w - 6, y + 13, '#5A5A55', 'right', 'alphabetic', MONO_S);
    text(g, o.ybot ?? fmt(ymin, o.yd ?? 1), x + w - 6, y + h - 6, '#5A5A55', 'right', 'alphabetic', MONO_S);
  }
  if (o.xlab) text(g, o.xlab, x + w / 2, y + h - 6, '#5A5A55', 'center', 'alphabetic', MONO_S);
  return { px, py };
}

// Pointer helper: coordinates relative to the element, with capture so drags keep working outside it.
export function pointer(el, { down, move, up, hover }, signal) {
  el.style.touchAction = 'none';
  let active = null;
  const pos = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  el.addEventListener('pointerdown', (e) => {
    const p = pos(e);
    if (down && down(p, e) === false) return;
    active = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    e.preventDefault();
  }, { signal });
  el.addEventListener('pointermove', (e) => {
    const p = pos(e);
    if (active === e.pointerId) move && move(p, e);
    else hover && hover(p, e);
  }, { signal });
  const end = (e) => { if (active !== e.pointerId) return; active = null; up && up(pos(e), e); };
  el.addEventListener('pointerup', end, { signal });
  el.addEventListener('pointercancel', end, { signal });
  el.addEventListener('pointerleave', (e) => { if (active == null && hover) hover(null, e); }, { signal });
}

// Classic RK4 on a plain array state.
export function rk4(s, f, dt) {
  const n = s.length;
  const k1 = f(s);
  const t = new Array(n);
  for (let i = 0; i < n; i++) t[i] = s[i] + k1[i] * dt / 2;
  const k2 = f(t);
  for (let i = 0; i < n; i++) t[i] = s[i] + k2[i] * dt / 2;
  const k3 = f(t);
  for (let i = 0; i < n; i++) t[i] = s[i] + k3[i] * dt;
  const k4 = f(t);
  const o = new Array(n);
  for (let i = 0; i < n; i++) o[i] = s[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
  return o;
}

// Fixed timestep accumulator: call step(h) as many times as needed for frame time dt.
export function stepper(h, maxSteps = 2000) {
  let acc = 0;
  return (dt, step) => {
    acc += dt;
    let n = 0;
    while (acc >= h && n < maxSteps) { step(h); acc -= h; n++; }
    if (n >= maxSteps) acc = 0;
    return n;
  };
}

export function stats(el, items) {
  el.innerHTML = items.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
}
