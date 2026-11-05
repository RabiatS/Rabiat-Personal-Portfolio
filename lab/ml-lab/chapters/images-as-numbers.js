// Images are numbers: a drawable 28x28 grid, a zoom lens with pixel values, RGB channels and a 3D height map.
import * as THREE from '../../study/kit/three.min.js';

const MONO = '500 11px "DM Mono", monospace';
const N = 28; const CN = 48; // grayscale grid size, colour picture size

function makeColourPicture() {
  // a small procedural landscape: sky gradient, sun, hills, water with reflections
  const px = new Uint8ClampedArray(CN * CN * 3);
  for (let y = 0; y < CN; y++) for (let x = 0; x < CN; x++) {
    const u = x / (CN - 1); const v = y / (CN - 1);
    let r = 70 + 185 * v; let g = 40 + 90 * v; let b = 150 - 80 * v; // violet to orange sky
    const dx = u - 0.66; const dy = v - 0.42; const d = Math.hypot(dx, dy);
    if (d < 0.13) { r = 255; g = 220 - d * 300; b = 90; } else if (d < 0.2) { const k = (0.2 - d) / 0.07; r += (255 - r) * k * 0.6; g += (200 - g) * k * 0.5; }
    const hill1 = 0.55 + 0.08 * Math.sin(u * 7 + 1) + 0.04 * Math.sin(u * 17);
    const hill2 = 0.62 + 0.05 * Math.sin(u * 5 + 3);
    if (v > hill1) { r = 40 + 30 * u; g = 120 + 50 * (1 - u); b = 60; }
    if (v > hill2) { r = 30; g = 95 + 20 * Math.sin(u * 9); b = 55; }
    if (v > 0.74) { // water: reflect the sky and the sun
      const rv = 0.74 - (v - 0.74) * 0.9; let sr = 70 + 185 * rv; let sg = 40 + 90 * rv; let sb = 150 - 80 * rv;
      if (Math.abs(u - 0.66) < 0.08 + (v - 0.74) * 0.4 && Math.sin(y * 2.3) > -0.2) { sr = 255; sg = 200; sb = 110; }
      r = sr * 0.35 + 20; g = sg * 0.45 + 40; b = sb * 0.5 + 110;
    }
    const o = (y * CN + x) * 3; px[o] = r; px[o + 1] = g; px[o + 2] = b;
  }
  return px;
}

function sample(kind) {
  const a = new Float32Array(N * N);
  if (kind === 'clear') return a;
  if (kind === 'gradient') { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) a[y * N + x] = x / (N - 1); return a; }
  if (kind === 'checker') { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) a[y * N + x] = ((x >> 2) + (y >> 2)) % 2; return a; }
  const c = document.createElement('canvas'); c.width = N; c.height = N; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, N, N); g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  if (kind === 'smile') {
    g.lineWidth = 2.2; g.beginPath(); g.arc(14, 14, 10.5, 0, 7); g.stroke();
    g.beginPath(); g.arc(10, 11, 1.8, 0, 7); g.arc(18, 11, 1.8, 0, 7); g.fill();
    g.beginPath(); g.arc(14, 15, 6, 0.2, Math.PI - 0.2); g.stroke();
  } else {
    g.font = '600 24px "DM Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(kind, 14, 15);
  }
  const d = g.getImageData(0, 0, N, N).data;
  for (let i = 0; i < N * N; i++) a[i] = d[i * 4] / 255;
  return a;
}

export default {
  mount(ctx) {
    const C0 = ctx.colors;
    const cv = ctx.canvas(); const g = cv.ctx;
    let img = sample('7'); const pic = makeColourPicture();
    let mode = 'draw'; let erase = false; let tinted = true; let source = 'draw';
    let lens = [10, 8]; let hover = null; let dirty = true;
    const LS = 7; // lens size in pixels

    let LY = null; let three = null;
    cv.onResize((W, H) => {
      const wide = W >= 640; const avail = H - 54;
      LY = { W, H, wide, avail }; dirty = true; if (three) three.resize();
    });

    const toVal = (v) => Math.round(v * 255);

    // ---------- draw mode ----------
    function gridBox() {
      const { W, avail, wide } = LY; const strip = wide ? 70 : 54;
      const s = Math.floor(Math.min(W - 10, avail - strip - 30) / N) * N;
      return { x: Math.round((W - s) / 2), y: 22, s, cs: s / N, strip };
    }
    function drawDraw() {
      const b = gridBox(); const { x, y, s, cs } = b;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const v = img[j * N + i]; const c = toVal(v);
        g.fillStyle = `rgb(${c},${c},${c})`; g.fillRect(x + i * cs, y + j * cs, cs, cs);
      }
      g.strokeStyle = 'rgba(128,128,128,.22)'; g.lineWidth = 1; g.beginPath();
      for (let k = 0; k <= N; k++) { g.moveTo(x + k * cs + 0.5, y); g.lineTo(x + k * cs + 0.5, y + s); g.moveTo(x, y + k * cs + 0.5); g.lineTo(x + s, y + k * cs + 0.5); }
      g.stroke();
      if (cs >= 19) {
        g.font = `500 ${Math.min(10, cs * 0.36)}px "DM Mono", monospace`; g.textAlign = 'center';
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
          const c = toVal(img[j * N + i]); g.fillStyle = c > 128 ? 'rgba(0,0,0,.7)' : 'rgba(255,255,255,.45)';
          g.fillText(String(c), x + (i + 0.5) * cs, y + (j + 0.5) * cs + 3.5);
        }
      }
      g.font = MONO; g.fillStyle = C0.muted; g.textAlign = 'left';
      g.fillText(LY.wide ? `28 × 28 = 784 numbers, 0 is black, 255 is white${cs >= 19 ? '' : ' (see them in the Zoom tab)'}` : '784 numbers: 0 = black, 255 = white', x, y - 8);
      // flattened strip
      const sy = y + s + 26; const sw = LY.W - 20; const sx = 10;
      g.fillStyle = C0.muted; g.fillText(LY.wide ? 'the same picture as one long row of 784 numbers, which is what a simple model reads:' : 'the same 784 numbers in one long row:', sx, sy - 8);
      const per = sw / (N * N);
      for (let k = 0; k < N * N; k++) { const c = toVal(img[k]); g.fillStyle = `rgb(${c},${c},${c})`; g.fillRect(sx + k * per, sy, Math.max(1, per + 0.3), b.strip - 46); }
      g.strokeStyle = C0.borderStrong; g.strokeRect(sx + 0.5, sy + 0.5, sw - 1, b.strip - 46);
      if (hover) {
        const k = hover[1] * N + hover[0];
        g.strokeStyle = C0.c2; g.lineWidth = 2; g.strokeRect(x + hover[0] * cs, y + hover[1] * cs, cs, cs);
        g.beginPath(); g.moveTo(sx + k * per, sy - 3); g.lineTo(sx + k * per, sy + b.strip - 43); g.stroke();
        g.fillStyle = C0.c2; g.textAlign = 'right'; g.fillText(LY.wide ? `row ${hover[1]}, col ${hover[0]} = ${toVal(img[k])}  (position ${k} in the list)` : `(${hover[1]}, ${hover[0]}) = ${toVal(img[k])}, position ${k}`, LY.W - 10, sy + b.strip - 30);
      }
    }

    // ---------- zoom mode ----------
    const srcW = () => (source === 'draw' ? N : CN);
    function zoomBoxes() {
      const { W, avail, wide } = LY;
      if (wide) {
        const s1 = Math.min(W * 0.36, avail - 40); const s2 = Math.min(W - s1 - 60, avail - 40);
        return { a: { x: 10, y: 26, s: s1 }, b: { x: W - s2 - 10, y: 26, s: s2 } };
      }
      const s1 = Math.min(W * 0.4, avail * 0.36); const s2 = Math.min(W - 20, avail - s1 - 46);
      return { a: { x: 10, y: 22, s: s1 }, b: { x: (W - s2) / 2, y: 22 + s1 + 36, s: s2 } };
    }
    const pixelAt = (i, j) => {
      if (source === 'draw') { const c = toVal(img[j * N + i]); return [c, c, c]; }
      const o = (j * CN + i) * 3; return [pic[o], pic[o + 1], pic[o + 2]];
    };
    function drawSmall(box) {
      const n = srcW(); const cs = box.s / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const [r, gg, bb] = pixelAt(i, j); g.fillStyle = `rgb(${r},${gg},${bb})`; g.fillRect(box.x + i * cs, box.y + j * cs, cs + 0.4, cs + 0.4); }
      g.strokeStyle = C0.borderStrong; g.lineWidth = 1; g.strokeRect(box.x + 0.5, box.y + 0.5, box.s - 1, box.s - 1);
      return cs;
    }
    function drawZoom() {
      const { a, b } = zoomBoxes(); const n = srcW();
      lens[0] = Math.max(0, Math.min(n - LS, lens[0])); lens[1] = Math.max(0, Math.min(n - LS, lens[1]));
      const cs = drawSmall(a);
      const lx = a.x + lens[0] * cs; const ly = a.y + lens[1] * cs;
      g.strokeStyle = C0.c2; g.lineWidth = 2; g.strokeRect(lx, ly, LS * cs, LS * cs);
      // connecting lines
      g.strokeStyle = 'rgba(251,191,36,.25)'; g.lineWidth = 1; g.beginPath();
      g.moveTo(lx + LS * cs, ly); g.lineTo(b.x, b.y); g.moveTo(lx + LS * cs, ly + LS * cs); g.lineTo(b.x, b.y + b.s); g.stroke();
      const zc = b.s / LS;
      for (let j = 0; j < LS; j++) for (let i = 0; i < LS; i++) {
        const [r, gg, bb] = pixelAt(lens[0] + i, lens[1] + j);
        g.fillStyle = `rgb(${r},${gg},${bb})`; g.fillRect(b.x + i * zc, b.y + j * zc, zc, zc);
        const lum = 0.299 * r + 0.587 * gg + 0.114 * bb; g.fillStyle = lum > 128 ? 'rgba(0,0,0,.8)' : 'rgba(255,255,255,.85)';
        g.textAlign = 'center';
        if (source === 'draw') { g.font = `500 ${Math.max(9, Math.min(16, zc * 0.3))}px "DM Mono", monospace`; g.fillText(String(r), b.x + (i + 0.5) * zc, b.y + (j + 0.5) * zc + 5); }
        else {
          const fs = Math.max(8, Math.min(13, zc * 0.2)); g.font = `500 ${fs}px "DM Mono", monospace`;
          [[r, '#ff8a8a'], [gg, '#86efac'], [bb, '#93c5fd']].forEach(([v, col], q) => { g.fillStyle = lum > 150 ? '#000' : col; g.fillText(String(v), b.x + (i + 0.5) * zc, b.y + (j + 0.5) * zc + (q - 1) * fs * 1.15 + fs * 0.35); });
        }
      }
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.beginPath();
      for (let k = 0; k <= LS; k++) { g.moveTo(b.x + k * zc, b.y); g.lineTo(b.x + k * zc, b.y + b.s); g.moveTo(b.x, b.y + k * zc); g.lineTo(b.x + b.s, b.y + k * zc); } g.stroke();
      g.font = MONO; g.fillStyle = C0.muted; g.textAlign = 'left';
      g.fillText('drag the box', a.x, a.y + a.s + 14);
      g.fillText(source === 'draw' ? 'each pixel is one number' : (LY.wide ? 'each pixel is three numbers: red, green, blue' : 'each pixel: red, green, blue'), b.x, b.y - 8);
    }

    // ---------- RGB mode ----------
    function rgbBoxes() {
      const { W, avail, wide } = LY;
      if (wide) { const s = Math.min((W - 40) / 2.6, (avail - 50) / 2); const big = s * 2 + 16; const sm = s; return { o: { x: 10, y: 26, s: big }, ch: [0, 1, 2].map((k) => ({ x: 10 + big + 24, y: 26 + k * (sm * 0.66 + 24), s: sm * 0.66 })) }; }
      const big = Math.min(W - 20, avail * 0.62); const sm = Math.min((W - 40) / 3, avail - big - 50);
      return { o: { x: (W - big) / 2, y: 22, s: big }, ch: [0, 1, 2].map((k) => ({ x: 10 + k * (sm + 10), y: 22 + big + 26, s: sm })) };
    }
    function drawRGB() {
      const { o, ch } = rgbBoxes(); const cs = o.s / CN;
      for (let j = 0; j < CN; j++) for (let i = 0; i < CN; i++) { const p = (j * CN + i) * 3; g.fillStyle = `rgb(${pic[p]},${pic[p + 1]},${pic[p + 2]})`; g.fillRect(o.x + i * cs, o.y + j * cs, cs + 0.4, cs + 0.4); }
      const names = ['red', 'green', 'blue'];
      ch.forEach((b, k) => {
        const c2 = b.s / CN;
        for (let j = 0; j < CN; j++) for (let i = 0; i < CN; i++) {
          const v = pic[(j * CN + i) * 3 + k];
          g.fillStyle = tinted ? `rgb(${k === 0 ? v : 0},${k === 1 ? v : 0},${k === 2 ? v : 0})` : `rgb(${v},${v},${v})`;
          g.fillRect(b.x + i * c2, b.y + j * c2, c2 + 0.4, c2 + 0.4);
        }
        g.font = MONO; g.fillStyle = C0.muted; g.textAlign = 'left'; g.fillText(`${names[k]} channel`, b.x, b.y - 5 + (LY.wide ? 0 : 0));
        if (hover) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(b.x + hover[0] * c2 - 1, b.y + hover[1] * c2 - 1, c2 + 2, c2 + 2); }
      });
      g.font = MONO; g.fillStyle = C0.muted; g.textAlign = 'left';
      g.fillText(`${CN} × ${CN} pixels × 3 channels = ${CN * CN * 3} numbers`, o.x, o.y - 8);
      if (hover) {
        const p = (hover[1] * CN + hover[0]) * 3;
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(o.x + hover[0] * cs - 1, o.y + hover[1] * cs - 1, cs + 2, cs + 2);
        const txt = `pixel (${hover[0]}, ${hover[1]}):  R ${pic[p]}  G ${pic[p + 1]}  B ${pic[p + 2]}`;
        g.fillStyle = 'rgba(10,10,10,.85)'; const tw = g.measureText(txt).width + 14; g.fillRect(o.x + 6, o.y + o.s - 28, tw, 22);
        g.fillStyle = C0.text; g.fillText(txt, o.x + 13, o.y + o.s - 13);
      } else { g.fillStyle = 'rgba(10,10,10,.7)'; g.fillRect(o.x + 6, o.y + o.s - 28, 170, 22); g.fillStyle = C0.text2; g.fillText('hover or tap a pixel', o.x + 13, o.y + o.s - 13); }
    }

    // ---------- 3D mode (three.js) ----------
    function start3D() {
      if (three) { three.rebuild(); return; }
      const holder = document.createElement('div'); holder.style.cssText = 'position:absolute;inset:0 0 54px 0;touch-action:none';
      ctx.stage.insertBefore(holder, dock);
      let renderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { holder.innerHTML = '<div class="k-loading">3D needs WebGL, which is not available here.</div>'; three = { holder, rebuild() {}, resize() {}, render() {}, dispose() { holder.remove(); } }; return; }
      renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); holder.append(renderer.domElement);
      const scene = new THREE.Scene(); const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 1.2)); const dl = new THREE.DirectionalLight(0xffffff, 1.6); dl.position.set(3, 6, 4); scene.add(dl);
      const root = new THREE.Group(); scene.add(root);
      const geo = new THREE.CylinderGeometry(0.62, 0.62, 1, 4, 1); geo.rotateY(Math.PI / 4); geo.translate(0, 0.5, 0);
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.05 });
      let mesh = null; const dummy = new THREE.Object3D(); const col = new THREE.Color();
      let rotX = 0.75; let rotY = -0.5; let dist = 2.6;
      function rebuild() {
        const n = source === 'draw' ? N : CN; const count = n * n;
        if (!mesh || mesh.count !== count) { if (mesh) { root.remove(mesh); mesh.dispose(); } mesh = new THREE.InstancedMesh(geo, mat, count); root.add(mesh); }
        const sc = 1 / n;
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
          let v; let r; let gg; let bb;
          if (source === 'draw') { v = img[j * n + i]; r = gg = bb = 0.15 + v * 0.85; } else { const p = (j * n + i) * 3; r = pic[p] / 255; gg = pic[p + 1] / 255; bb = pic[p + 2] / 255; v = 0.299 * r + 0.587 * gg + 0.114 * bb; }
          dummy.position.set((i - n / 2 + 0.5) * sc, 0, (j - n / 2 + 0.5) * sc); dummy.scale.set(sc * 0.95, 0.004 + v * 0.35, sc * 0.95); dummy.updateMatrix();
          mesh.setMatrixAt(j * n + i, dummy.matrix);
          if (source === 'draw') col.setRGB(0.25 + v * 0.25, 0.35 + v * 0.57, 0.35 + v * 0.48); else col.setRGB(r, gg, bb);
          mesh.setColorAt(j * n + i, col);
        }
        mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
      function resize() { const r = holder.getBoundingClientRect(); if (!r.width) return; renderer.setSize(r.width, r.height, false); renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'; cam.aspect = r.width / r.height; cam.updateProjectionMatrix(); }
      function render() {
        cam.position.set(Math.sin(rotY) * Math.cos(rotX) * dist, Math.sin(rotX) * dist, Math.cos(rotY) * Math.cos(rotX) * dist);
        cam.lookAt(0, 0.08, 0); renderer.render(scene, cam);
      }
      let drag = null;
      holder.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; holder.setPointerCapture(e.pointerId); }, { signal: ctx.signal });
      holder.addEventListener('pointermove', (e) => { if (!drag) return; rotY -= (e.clientX - drag[0]) * 0.008; rotX = Math.max(0.15, Math.min(1.45, rotX + (e.clientY - drag[1]) * 0.006)); drag = [e.clientX, e.clientY]; }, { signal: ctx.signal });
      holder.addEventListener('pointerup', () => { drag = null; }, { signal: ctx.signal });
      holder.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.max(1.4, Math.min(5, dist * (1 + e.deltaY * 0.001))); }, { passive: false, signal: ctx.signal });
      three = { holder, rebuild, resize, render, dispose() { if (mesh) mesh.dispose(); geo.dispose(); mat.dispose(); renderer.dispose(); holder.remove(); }, spin: () => { if (!drag) rotY += 0.002; } };
      resize(); rebuild();
    }
    function stop3D() { if (three) { three.dispose(); three = null; } }

    // ---------- pointer on the 2D canvas ----------
    cv.el.style.touchAction = 'none';
    let down = false; let lensGrab = null;
    function cellFromEvent(e) {
      const r = cv.el.getBoundingClientRect(); const px = e.clientX - r.left; const py = e.clientY - r.top;
      if (mode === 'draw') { const b = gridBox(); const i = (px - b.x) / b.cs; const j = (py - b.y) / b.cs; return [i, j, i >= 0 && j >= 0 && i < N && j < N]; }
      if (mode === 'rgb') { const { o } = rgbBoxes(); const cs = o.s / CN; const i = Math.floor((px - o.x) / cs); const j = Math.floor((py - o.y) / cs); return [i, j, i >= 0 && j >= 0 && i < CN && j < CN]; }
      const { a } = zoomBoxes(); const cs = a.s / srcW(); return [(px - a.x) / cs, (py - a.y) / cs, true];
    }
    function paint(fx, fy) {
      const rad = 1.4;
      for (let j = Math.floor(fy - 2); j <= Math.ceil(fy + 2); j++) for (let i = Math.floor(fx - 2); i <= Math.ceil(fx + 2); i++) {
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const d = Math.hypot(i + 0.5 - fx, j + 0.5 - fy); const k = Math.max(0, 1 - d / rad) * 0.9;
        const id = j * N + i; img[id] = erase ? Math.max(0, img[id] - k) : Math.min(1, img[id] + k);
      }
      dirty = true;
    }
    let lastP = null;
    cv.el.addEventListener('pointerdown', (e) => {
      if (!LY) return; down = true; cv.el.setPointerCapture(e.pointerId);
      const [i, j, inside] = cellFromEvent(e);
      if (mode === 'draw' && inside) { paint(i, j); lastP = [i, j]; }
      if (mode === 'zoom') { lensGrab = [i - lens[0], j - lens[1]]; if (lensGrab[0] < 0 || lensGrab[1] < 0 || lensGrab[0] > LS || lensGrab[1] > LS) lensGrab = [LS / 2, LS / 2]; moveLens(i, j); }
      if (mode === 'rgb') { hover = inside ? [i, j] : null; dirty = true; }
    }, { signal: ctx.signal });
    function centreLens() {
      // start the lens on an interesting spot: the edge of the drawing, or the rim of the sun
      if (source !== 'draw') { lens = [27, 14]; return; }
      let sx = 0; let sy = 0; let sw = 0;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const v = img[j * N + i]; sx += v * i; sy += v * j; sw += v; }
      lens = sw > 0 ? [Math.round(sx / sw - LS / 2 + 1), Math.round(sy / sw - LS / 2 - 3)] : [10, 10];
    }
    function moveLens(i, j) { lens = [Math.round(i - lensGrab[0]), Math.round(j - lensGrab[1])]; dirty = true; }
    cv.el.addEventListener('pointermove', (e) => {
      if (!LY) return; const [i, j, inside] = cellFromEvent(e);
      if (mode === 'draw') {
        const nh = inside ? [Math.floor(i), Math.floor(j)] : null; if (String(nh) !== String(hover)) { hover = nh; dirty = true; }
        if (down && inside) {
          // fill in between fast moves so strokes stay continuous
          if (lastP) { const steps = Math.ceil(Math.hypot(i - lastP[0], j - lastP[1]) / 0.4); for (let s = 1; s <= steps; s++) paint(lastP[0] + (i - lastP[0]) * s / steps, lastP[1] + (j - lastP[1]) * s / steps); } else paint(i, j);
          lastP = [i, j];
        }
      }
      if (mode === 'zoom' && down) moveLens(i, j);
      if (mode === 'rgb') { const nh = inside ? [i, j] : null; if (String(nh) !== String(hover)) { hover = nh; dirty = true; } }
    }, { signal: ctx.signal });
    const up = () => { down = false; lastP = null; };
    cv.el.addEventListener('pointerup', up, { signal: ctx.signal }); cv.el.addEventListener('pointercancel', up, { signal: ctx.signal });
    cv.el.addEventListener('pointerleave', () => { if (!down && mode !== 'zoom') { hover = null; dirty = true; } }, { signal: ctx.signal });

    // ---------- panel ----------
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Images are numbers</h2>'),
      ctx.h('<p class="lede">A computer never sees a picture. It sees a grid of numbers, one per pixel (or three for colour). Everything in computer vision starts here.</p>'),
    );
    const modeSeg = ctx.seg([['draw', 'Draw'], ['zoom', 'Zoom'], ['rgb', 'RGB'], ['3d', '3D']], mode, (v) => setMode(v));
    ctx.panel.append(modeSeg);
    const drawCtl = ctx.h(`<div style="display:grid;gap:8px"><p class="hint">Draw on the grid with your finger or mouse. Load a sample:</p><div class="row">${['0', '3', '7', 'A', 'smile', 'gradient', 'checker', 'clear'].map((k) => `<button class="chip" data-s="${k}">${k}</button>`).join('')}</div><label class="check"><input type="checkbox" class="c-er"> eraser</label></div>`);
    drawCtl.addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (!b) return; img = sample(b.dataset.s); dirty = true; if (three) three.rebuild(); });
    drawCtl.querySelector('.c-er').addEventListener('change', (e) => { erase = e.target.checked; });
    const srcCtl = ctx.h('<div style="display:grid;gap:6px"><p class="hint">Picture for Zoom and 3D:</p></div>');
    const srcSeg = ctx.seg([['draw', 'Your drawing'], ['colour', 'Colour picture']], source, (v) => { source = v; dirty = true; if (three) three.rebuild(); if (mode === 'zoom') centreLens(); });
    srcCtl.append(srcSeg);
    const rgbCtl = ctx.h('<label class="check"><input type="checkbox" checked class="c-t"> tint channels in their own colour</label>');
    rgbCtl.querySelector('.c-t').addEventListener('change', (e) => { tinted = e.target.checked; dirty = true; });
    ctx.panel.append(drawCtl, srcCtl, rgbCtl);

    ctx.panel.append(ctx.h(`<div class="card tip">
      <p>A grayscale image is a table of brightness values. In the common 8 bit format each one runs from 0 (black) to 255 (white), so a 28 × 28 picture is 784 numbers.</p>
      <p>A colour image stores three tables, one each for red, green and blue light. Mix them and you get every colour on your screen: 255, 255, 0 is bright yellow.</p>
      <p>To a model, "find the cat" really means "find a pattern in this huge table of numbers".</p></div>`));
    ctx.panel.append(ctx.h(`<div class="card try"><ol>
      <li><b>Draw</b>: scribble a digit. Hover a cell to see its value and where it lands in the long row of 784.</li>
      <li><b>Zoom</b>: drag the box over an edge of your drawing. Edges are where the numbers jump.</li>
      <li><b>RGB</b>: hover the sun. Its red and green are high and blue is low. Hover the water and blue wins. Untick the tint to see each channel as plain brightness.</li>
      <li><b>3D</b>: brightness becomes height. Drag to turn it. Your digit is a mountain range.</li></ol></div>`));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper</summary><div class="card deep">
      <p>The MNIST handwritten digit dataset is exactly this format: 70,000 grayscale images of 28 × 28 pixels (60,000 for training, 10,000 for testing). It was the standard first benchmark for decades.</p>
      <p>A 12 megapixel phone photo holds about 12 million pixels × 3 channels = 36 million numbers. Models usually shrink images first, for example to 224 × 224, and scale the values to around 0 to 1 or to zero mean before training.</p>
      <p>As an array an image has a <b>shape</b>, such as (height, width, channels) = (48, 48, 3) here. Libraries differ on the order: PyTorch uses (channels, height, width).</p>
      <p>Flattening the grid into one long row (like the strip in Draw mode) throws away which pixels are neighbours. A plain network then has to relearn that from scratch. Convolutions keep the grid shape, which is the idea of the next two chapters.</p>
    </div></details>`));

    const dock = ctx.h('<div class="dock"><div class="grp glass"><button data-m="draw" class="on">Draw</button><button data-m="zoom">Zoom</button><button data-m="rgb">RGB</button><button data-m="3d">3D</button></div></div>');
    ctx.stage.append(dock);
    dock.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) setMode(b.dataset.m); }, { signal: ctx.signal });

    function setMode(m) {
      mode = m; hover = null; dirty = true;
      modeSeg.set(m); dock.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('on', x.dataset.m === m));
      drawCtl.style.display = m === 'draw' ? '' : 'none';
      srcCtl.style.display = m === 'zoom' || m === '3d' ? '' : 'none';
      rgbCtl.style.display = m === 'rgb' ? '' : 'none';
      cv.el.style.visibility = m === '3d' ? 'hidden' : 'visible';
      if (m === '3d') start3D(); else stop3D();
      if (m === 'zoom') centreLens();
    }
    setMode('draw');

    ctx.loop(() => {
      if (mode === '3d') { if (three) { three.spin && three.spin(); three.render(); } return; }
      if (!dirty || !LY || !cv.w) return; dirty = false;
      g.clearRect(0, 0, cv.w, cv.h);
      if (mode === 'draw') drawDraw(); else if (mode === 'zoom') drawZoom(); else drawRGB();
    });

    ctx.quiz([
      { q: 'How many numbers describe a 28 × 28 grayscale image?', choices: ['56', '784', '2352'], answer: 1, why: '28 × 28 = 784, one brightness value per pixel. In colour it would be 784 × 3 = 2352.' },
      { q: 'A pixel has R = 255, G = 255, B = 255. What colour is it?', choices: ['Black', 'White', 'Grey'], answer: 1, why: 'All three lights at full strength add up to white. 0, 0, 0 is black.' },
      { q: 'What is lost when you flatten an image into one long list of numbers?', choices: ['The pixel values', 'Which pixels sit next to each other', 'The number of pixels'], answer: 1, why: 'The values are all still there, but the 2D neighbourhood is hidden. Convolutional networks keep it.' },
    ]);

    return () => stop3D();
  },
};
