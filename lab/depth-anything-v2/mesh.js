// A photo on a grid of vertices, each pushed forward or back by the depth map,
// drawn with plain WebGL2. Displacement is worked out on the CPU (it only
// changes once per photo) so it doesn't depend on float textures, which iOS
// handles unevenly. Strength and the depth view are uniforms, so the slider and
// the reveal never re-upload anything.

const VS = `#version 300 es
in vec2 aUv;
in float aZ;
in float aN;
uniform mat4 uMvp;
uniform vec2 uHalf;
uniform float uStrength;
out vec2 vUv;
out float vN;
void main() {
  vUv = aUv; vN = aN;
  vec3 p = vec3((aUv.x - .5) * 2. * uHalf.x, (.5 - aUv.y) * 2. * uHalf.y, aZ * uStrength);
  gl_Position = uMvp * vec4(p, 1.);
}`;

const FS = `#version 300 es
precision mediump float;
in vec2 vUv;
in float vN;
uniform sampler2D uTex;
uniform float uDepthMix;
out vec4 o;
void main() {
  vec3 photo = texture(uTex, vUv).rgb;
  vec3 ramp = mix(vec3(.039), vec3(.961, .961, .941), vN); // void to bone
  o = vec4(mix(photo, ramp, uDepthMix), 1.);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

// ---------- tiny column-major matrix helpers ----------
const mul = (a, b) => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
};
const perspective = (fovy, aspect, near, far) => {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
};
const translateZ = (z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, z, 1]);
const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); };
const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); };

const FOV = 32 * Math.PI / 180;
export const DEPTH_SCALE = 0.55; // z range at strength 1, in half-heights of the photo

export function createScene(canvas, { cells = 256 } = {}) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!gl) throw new Error('This browser has no WebGL2');
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const U = (n) => gl.getUniformLocation(prog, n);
  const u = { mvp: U('uMvp'), half: U('uHalf'), strength: U('uStrength'), mix: U('uDepthMix'), tex: U('uTex') };
  const A = (n) => gl.getAttribLocation(prog, n);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const bufUv = gl.createBuffer(), bufZ = gl.createBuffer(), bufN = gl.createBuffer(), bufIdx = gl.createBuffer();
  const attr = (buf, loc, size) => { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); };
  attr(bufUv, A('aUv'), 2); attr(bufZ, A('aZ'), 1); attr(bufN, A('aN'), 1);

  const tex = gl.createTexture();
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.039, 0.039, 0.039, 1);

  const st = { aspect: 1, gw: 1, gh: 1, count: 0, strength: 0, mix: 0, tiltX: 0, tiltY: 0 };

  function grid(aspect) {
    st.aspect = aspect;
    st.gw = aspect >= 1 ? cells : Math.max(8, Math.round(cells * aspect));
    st.gh = aspect >= 1 ? Math.max(8, Math.round(cells / aspect)) : cells;
    const nx = st.gw + 1, ny = st.gh + 1;
    const uv = new Float32Array(nx * ny * 2);
    for (let j = 0, k = 0; j < ny; j++) for (let i = 0; i < nx; i++) { uv[k++] = i / st.gw; uv[k++] = j / st.gh; }
    gl.bindBuffer(gl.ARRAY_BUFFER, bufUv); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    setZ(new Float32Array(nx * ny), new Float32Array(nx * ny), null);
  }

  // z per vertex (already centred on the focal plane), n per vertex (0 far .. 1 near),
  // and which triangles to keep: a triangle spanning a big depth jump is an edge
  // between a subject and what's behind it, and stretching it looks like rubber.
  function setZ(z, n, keep) {
    gl.bindBuffer(gl.ARRAY_BUFFER, bufZ); gl.bufferData(gl.ARRAY_BUFFER, z, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufN); gl.bufferData(gl.ARRAY_BUFFER, n, gl.DYNAMIC_DRAW);
    const nx = st.gw + 1, idx = new Uint32Array(st.gw * st.gh * 6);
    let c = 0;
    for (let j = 0; j < st.gh; j++) for (let i = 0; i < st.gw; i++) {
      const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
      if (!keep || keep(a, b, d)) { idx[c++] = a; idx[c++] = d; idx[c++] = b; }
      if (!keep || keep(b, d, e)) { idx[c++] = b; idx[c++] = d; idx[c++] = e; }
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIdx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx.subarray(0, c), gl.DYNAMIC_DRAW);
    st.count = c;
  }

  function setPhoto(bitmap) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    grid(bitmap.width / bitmap.height);
  }

  // Raw depth (bigger is nearer) at any size -> per-vertex values on the grid.
  function setDepth(depth, w, h) {
    const nx = st.gw + 1, ny = st.gh + 1;
    // Robust range: the 2nd to 98th percentile, so a few stray pixels don't flatten the rest.
    const step = Math.max(1, Math.floor(depth.length / 40000));
    const sample = []; for (let i = 0; i < depth.length; i += step) sample.push(depth[i]);
    sample.sort((a, b) => a - b);
    const lo = sample[Math.floor(sample.length * 0.02)], hi = sample[Math.floor(sample.length * 0.98)];
    const span = hi - lo || 1;
    // Area-average the depth into the grid.
    let g = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      const y0 = Math.floor(Math.max(0, (j - 0.5) / st.gh) * (h - 1)), y1 = Math.ceil(Math.min(1, (j + 0.5) / st.gh) * (h - 1));
      for (let i = 0; i < nx; i++) {
        const x0 = Math.floor(Math.max(0, (i - 0.5) / st.gw) * (w - 1)), x1 = Math.ceil(Math.min(1, (i + 0.5) / st.gw) * (w - 1));
        let s = 0, c = 0;
        for (let y = y0; y <= y1; y += 1 + ((y1 - y0) >> 3)) for (let x = x0; x <= x1; x += 1 + ((x1 - x0) >> 3)) { s += depth[y * w + x]; c++; }
        g[j * nx + i] = Math.min(1, Math.max(0, (s / c - lo) / span));
      }
    }
    // Soften, then grow the near side by a cell so a subject's edge carries its
    // own pixels with it and the stretch lands on the background instead.
    const pass = (src, fn) => {
      const out = new Float32Array(src.length);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const vals = [];
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const jj = Math.min(ny - 1, Math.max(0, j + dj)), ii = Math.min(nx - 1, Math.max(0, i + di));
          vals.push(src[jj * nx + ii]);
        }
        out[j * nx + i] = fn(vals);
      }
      return out;
    };
    g = pass(g, (v) => v.reduce((a, b) => a + b) / 9);
    g = pass(g, (v) => Math.max(...v));
    const sorted = Float32Array.from(g).sort();
    const median = sorted[Math.floor(sorted.length / 2)];
    const z = new Float32Array(g.length);
    for (let k = 0; k < g.length; k++) z[k] = (g[k] - median) * DEPTH_SCALE;
    const keep = (a, b, c) => Math.max(g[a], g[b], g[c]) - Math.min(g[a], g[b], g[c]) < 0.3;
    setZ(z, g, keep);
  }

  let dpr = 1;
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  // Room the header and dock take (CSS px), so the photo fits between them
  // while the canvas itself stays full bleed.
  const insets = { top: 0, bottom: 0 };

  function draw() {
    resize();
    const cw = canvas.width, ch = canvas.height, view = cw / ch;
    gl.viewport(0, 0, cw, ch);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!st.count) return;
    const halfY = 1, halfX = st.aspect;
    const t = Math.tan(FOV / 2);
    const H = canvas.clientHeight || 1;
    const f = Math.max(0.3, (H - insets.top - insets.bottom) / H); // share of the height that is free
    const margin = 1.06; // room to turn
    const dist = Math.max(halfY / (t * f), halfX / (t * view)) * margin + DEPTH_SCALE * st.strength * 0.5;
    // Shift the picture's centre into the middle of the free space, in clip space.
    const shift = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, (insets.bottom - insets.top) / H, 0, 1]);
    const proj = mul(shift, perspective(FOV, view, 0.1, 100));
    const mvp = mul(proj, mul(translateZ(-dist), mul(rotX(st.tiltY), rotY(st.tiltX))));
    gl.uniformMatrix4fv(u.mvp, false, mvp);
    gl.uniform2f(u.half, halfX, halfY);
    gl.uniform1f(u.strength, st.strength);
    gl.uniform1f(u.mix, st.mix);
    gl.uniform1i(u.tex, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.bindVertexArray(vao);
    gl.drawElements(gl.TRIANGLES, st.count, gl.UNSIGNED_INT, 0);
  }

  return {
    setPhoto, setDepth, draw, state: st, insets,
    maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    isLost: () => gl.isContextLost(),
  };
}
