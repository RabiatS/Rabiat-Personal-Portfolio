// The robot's looks, kept apart from its physics. In g1.xml the meshes are
// visual only (no mass, no collisions: the body has its own inertia and
// capsule colliders), and MuJoCo takes many seconds to process 390 thousand
// triangles it would never collide with. So MuJoCo gets g1.xml without them,
// which simulates exactly the same, and the meshes are read here for drawing.

// g1.xml minus its visual meshes: what MuJoCo compiles.
export function physicsOnly(xml) {
  return xml
    .replace(/<mesh\b[^>]*\/>\s*/g, '')
    .replace(/<geom\b[^>]*\bclass="visual"[^>]*\/>\s*/g, '');
}

const attrs = (tag) => Object.fromEntries([...tag.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const nums = (s, d) => (s ? s.trim().split(/\s+/).map(Number) : d);

// Every visual mesh in g1.xml: which body it hangs on, which file, its colour.
export function visualGeoms(xml) {
  const meshFile = {};
  for (const m of xml.matchAll(/<mesh\b[^>]*\/>/g)) {
    const a = attrs(m[0]);
    meshFile[a.name || a.file.replace(/\.[^.]+$/, '')] = a.file;
  }
  const rgba = {};
  for (const m of xml.matchAll(/<material\b[^>]*\/>/g)) { const a = attrs(m[0]); rgba[a.name] = nums(a.rgba, [1, 1, 1, 1]); }
  // Defaults for class="visual" (its material), read from the <default> block.
  const vis = xml.match(/<default class="visual">\s*<geom\b[^>]*\/>/);
  const visDefault = vis ? attrs(vis[0].slice(vis[0].indexOf('<geom'))) : {};
  const out = [];
  const stack = [];
  for (const m of xml.matchAll(/<body\b[^>]*>|<\/body>|<geom\b[^>]*\/>/g)) {
    const tag = m[0];
    if (tag.startsWith('</body')) { stack.pop(); continue; }
    if (tag.startsWith('<body')) { stack.push(attrs(tag).name); continue; }
    const a = attrs(tag);
    if (a.class !== 'visual' || !a.mesh) continue;
    out.push({
      body: stack.at(-1), name: a.mesh, file: meshFile[a.mesh],
      pos: nums(a.pos, [0, 0, 0]), quat: nums(a.quat, [1, 0, 0, 0]),
      rgba: rgba[a.material || visDefault.material] || [0.7, 0.7, 0.7, 1],
    });
  }
  return out;
}

// A binary STL as triangles, with smooth normals that keep hard edges hard:
// at each corner, the average of the faces around that point that bend less
// than about 35 degrees from this one (three.js calls this creased normals).
export function stlTriangles(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = view.getUint32(80, true);
  if (84 + 50 * n !== bytes.byteLength) throw new Error('Expected a binary STL file');
  const pos = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) {
    const o = 84 + 50 * i + 12;
    for (let k = 0; k < 9; k++) pos[9 * i + k] = view.getFloat32(o + 4 * k, true);
  }
  // Face normals, and each corner's shared point (merged at 0.1 mm).
  const fn = new Float32Array(n * 3);
  const vid = new Int32Array(n * 3);
  const ids = new Map();
  for (let i = 0; i < n; i++) {
    const p = 9 * i;
    const ux = pos[p + 3] - pos[p], uy = pos[p + 4] - pos[p + 1], uz = pos[p + 5] - pos[p + 2];
    const vx = pos[p + 6] - pos[p], vy = pos[p + 7] - pos[p + 1], vz = pos[p + 8] - pos[p + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    fn[3 * i] = nx / l; fn[3 * i + 1] = ny / l; fn[3 * i + 2] = nz / l;
    for (let c = 0; c < 3; c++) {
      const q = p + 3 * c;
      const key = ((Math.round(pos[q] * 1e4) + 32768) * 65536 + (Math.round(pos[q + 1] * 1e4) + 32768)) * 65536 + (Math.round(pos[q + 2] * 1e4) + 32768);
      let id = ids.get(key);
      if (id === undefined) { id = ids.size; ids.set(key, id); }
      vid[3 * i + c] = id;
    }
  }
  // Faces around each point.
  const count = new Int32Array(ids.size + 1);
  for (let k = 0; k < vid.length; k++) count[vid[k] + 1]++;
  for (let k = 1; k < count.length; k++) count[k] += count[k - 1];
  const fill = count.slice(0, -1), around = new Int32Array(vid.length);
  for (let k = 0; k < vid.length; k++) around[fill[vid[k]]++] = (k / 3) | 0;
  const COS = Math.cos(35 * Math.PI / 180);
  const nrm = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) {
    const ax = fn[3 * i], ay = fn[3 * i + 1], az = fn[3 * i + 2];
    for (let c = 0; c < 3; c++) {
      const v = vid[3 * i + c];
      let sx = 0, sy = 0, sz = 0;
      for (let k = count[v]; k < count[v + 1]; k++) {
        const f = around[k], bx = fn[3 * f], by = fn[3 * f + 1], bz = fn[3 * f + 2];
        if (ax * bx + ay * by + az * bz >= COS) { sx += bx; sy += by; sz += bz; }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      const o = 9 * i + 3 * c;
      nrm[o] = sx / l; nrm[o + 1] = sy / l; nrm[o + 2] = sz / l;
    }
  }
  return { pos, nrm };
}
