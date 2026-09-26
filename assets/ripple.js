// Water ripples on a canvas. Used by /playground/ripple/ and the top of cool.html.
//
// The wave simulation runs in JS on a coarse grid (classic two-buffer height
// field). Each frame the grid's slopes are uploaded as a small texture and a
// WebGL shader draws the water at full resolution, so edges stay crisp.
//
//   mode 'refract': bends a background you draw (opts.texture) and lights it
//   mode 'shade':   transparent overlay, only highlights and shadows, so it can
//                   sit on top of any page without covering it
//
// The loop sleeps when the water is still, so an idle page costs nothing.

const VERT = `
attribute vec2 p;
varying vec2 uv;
void main() { uv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;

const FRAG = `
precision mediump float;
varying vec2 uv;
uniform sampler2D slope;
uniform sampler2D bg;
uniform vec2 res;
uniform float bend;
uniform float light;
uniform int mode;
void main() {
  vec4 s = texture2D(slope, uv);
  vec2 n = (s.rg * 255. - 128.) / 127.;   // byte 128 is exactly flat
  vec3 N = normalize(vec3(n * 1.4, 1.));
  vec3 L = normalize(vec3(-.45, -.6, .9));
  float diff = dot(N, L) - L.z;                      // 0 on flat water
  float spec = pow(max(dot(reflect(-L, N), vec3(0., 0., 1.)), 0.), 90.)
             - pow(max(dot(reflect(-L, vec3(0., 0., 1.)), vec3(0., 0., 1.)), 0.), 90.);
  spec = max(spec, 0.);
  if (mode == 0) {
    vec3 col = texture2D(bg, uv + n * bend / res).rgb;
    col += diff * .55 * light + spec * .8 * light;
    gl_FragColor = vec4(col, 1.);
  } else {
    float hi = clamp(max(diff, 0.) * 2.2 * light + spec * light, 0., .55);
    float lo = clamp(max(-diff, 0.) * 1.6 * light, 0., .35);
    // premultiplied: white light over dark shadow
    float a = hi + lo * (1. - hi);
    gl_FragColor = vec4(vec3(hi), a);
  }
}`;

export function createRipple(canvas, opts = {}) {
  const o = {
    mode: 'refract',
    texture: null,           // (ctx, w, h) => draw the background, css pixels
    input: canvas,           // element that receives pointer events
    damping: 0.986,
    bend: 26,                // refraction, in css pixels per unit slope
    light: 1,
    trail: true,             // ripples follow the pointer
    maxCells: 150000,
    dpr: null,               // canvas resolution; defaults to the screen, capped at 2
    onLost: null,            // called if the browser drops the WebGL context
    ...opts,
  };
  const gl = canvas.getContext('webgl', { alpha: o.mode === 'shade', premultipliedAlpha: true, antialias: false });
  if (!gl) return null;
  // If the browser reclaims the GPU context (it does under memory pressure on
  // phones), stop for good and let the page remove the canvas, rather than
  // leaving a blank or black layer on top of it.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    destroyed = true; cancelAnimationFrame(raf);
    o.onLost?.();
  });

  const prog = link(gl, VERT, FRAG);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  gl.uniform1i(U('slope'), 0);
  gl.uniform1i(U('bg'), 1);
  gl.uniform1i(U('mode'), o.mode === 'refract' ? 0 : 1);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  const slopeTex = makeTex(gl, 0);
  const bgTex = makeTex(gl, 1);

  let W = 0, H = 0, cell = 2, cols = 0, rows = 0;
  let cur, prev, bytes;
  let raf = 0, awake = false, destroyed = false;
  let last = null;

  function resize() {
    if (destroyed) return;
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w === W && h === H) return;
    W = w; H = h;
    const dpr = o.dpr ?? Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    cell = Math.max(2, Math.ceil(Math.sqrt((W * H) / o.maxCells)));
    cols = Math.ceil(W / cell) + 2; rows = Math.ceil(H / cell) + 2;
    cur = new Float32Array(cols * rows); prev = new Float32Array(cols * rows);
    // RGBA (4 bytes a texel) so every row is aligned; 2-byte formats were read
    // skewed by WebKit and showed up as diagonal streaks on iPhone.
    bytes = new Uint8Array(cols * rows * 4);
    for (let i = 0; i < bytes.length; i += 4) { bytes[i] = 128; bytes[i + 1] = 128; bytes[i + 3] = 255; }
    // allocate once per size; every frame after this only overwrites it
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, slopeTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    gl.uniform2f(U('res'), W, H);
    gl.uniform1f(U('bend'), o.bend);
    gl.uniform1f(U('light'), o.light);
    redrawTexture();
    upload(); draw();
  }

  function redrawTexture() {
    if (o.mode !== 'refract' || destroyed) return;
    const dpr = o.dpr ?? Math.min(2, window.devicePixelRatio || 1);
    const c = document.createElement('canvas');
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    o.texture?.(ctx, W, H);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, c);
    if (!awake) draw();
  }

  // Wave equation step. Returns the largest height, so the loop can sleep.
  function step() {
    let peak = 0;
    const d = o.damping;
    for (let y = 1; y < rows - 1; y++) {
      let i = y * cols + 1;
      for (let x = 1; x < cols - 1; x++, i++) {
        const v = ((cur[i - 1] + cur[i + 1] + cur[i - cols] + cur[i + cols]) * 0.5 - prev[i]) * d;
        prev[i] = v;
        const a = v < 0 ? -v : v;
        if (a > peak) peak = a;
      }
    }
    const t = cur; cur = prev; prev = t;
    return peak;
  }

  function upload() {
    for (let y = 1; y < rows - 1; y++) {
      let i = y * cols + 1;
      for (let x = 1; x < cols - 1; x++, i++) {
        const dx = (cur[i - 1] - cur[i + 1]) * 2.5;
        const dy = (cur[i - cols] - cur[i + cols]) * 2.5;
        bytes[i * 4] = dx > 127 ? 255 : dx < -127 ? 1 : 128 + dx;
        bytes[i * 4 + 1] = dy > 127 ? 255 : dy < -127 ? 1 : 128 + dy;
      }
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, slopeTex);
    // update in place: re-creating the texture every frame piles up GPU memory on iPhone
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  }

  function draw() {
    if (destroyed) return;
    if (o.mode === 'shade') { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  let quiet = 0;
  function frame() {
    if (destroyed) return;
    const peak = step();
    upload(); draw();
    o.onFrame?.();
    quiet = peak < 0.4 ? quiet + 1 : 0;
    if (quiet > 30 && !o.keepAwake) {
      awake = false;
      cur.fill(0); prev.fill(0); upload(); draw();
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  function wake() {
    if (awake || destroyed || !cur) return;
    awake = true; quiet = 0;
    raf = requestAnimationFrame(frame);
  }

  // x, y in css pixels relative to the canvas. radius in css pixels.
  function drop(x, y, radius = 14, force = 60) {
    const cx = x / cell + 1, cy = y / cell + 1, r = Math.max(1.5, radius / cell);
    const x0 = Math.max(1, Math.floor(cx - r)), x1 = Math.min(cols - 2, Math.ceil(cx + r));
    const y0 = Math.max(1, Math.floor(cy - r)), y1 = Math.min(rows - 2, Math.ceil(cy + r));
    for (let yy = y0; yy <= y1; yy++) {
      for (let xx = x0; xx <= x1; xx++) {
        const dist = Math.hypot(xx - cx, yy - cy) / r;
        if (dist < 1) cur[yy * cols + xx] -= force * (Math.cos(dist * Math.PI) + 1) * 0.5;
      }
    }
    wake();
  }

  // ---------- input ----------
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function onMove(e) {
    if (!o.trail) return;
    const [x, y] = local(e);
    if (x < 0 || y < 0 || x > W || y > H) { last = null; return; }
    if (last) {
      const dist = Math.hypot(x - last[0], y - last[1]);
      const steps = Math.min(12, Math.floor(dist / 7));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        drop(last[0] + (x - last[0]) * t, last[1] + (y - last[1]) * t, 9, 7 + Math.min(10, dist * 0.2));
      }
    }
    last = [x, y];
  }
  function onDown(e) {
    const [x, y] = local(e);
    if (x < 0 || y < 0 || x > W || y > H) return;
    drop(x, y, 26, 80);
  }
  const onLeave = () => { last = null; };
  o.input.addEventListener('pointermove', onMove, { passive: true });
  o.input.addEventListener('pointerdown', onDown, { passive: true });
  o.input.addEventListener('pointerleave', onLeave, { passive: true });
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();

  return {
    drop,
    redrawTexture,
    set(k, v) {
      o[k] = v;
      if (k === 'bend') gl.uniform1f(U('bend'), v);
      if (k === 'light') gl.uniform1f(U('light'), v);
      if (k === 'keepAwake' && v) wake();
    },
    get size() { return { w: W, h: H }; },
    destroy() {
      destroyed = true; cancelAnimationFrame(raf); ro.disconnect();
      o.input.removeEventListener('pointermove', onMove);
      o.input.removeEventListener('pointerdown', onDown);
      o.input.removeEventListener('pointerleave', onLeave);
    },
  };
}

function makeTex(gl, unit) {
  const t = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([10, 10, 10]));
  return t;
}

function link(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  return p;
}
