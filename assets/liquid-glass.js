// Liquid glass for plain HTML: no build step, no framework.
//
// Each surface gets two things, drawn for its exact size and corners:
//   a lit rim, in every browser, set as --lg-rim for its background-image
//   a lens that bends what is behind its edge, set as --lg-filter for its
//   backdrop-filter. Only Chromium applies SVG filters to the live backdrop,
//   so Safari and Firefox keep the frost and the rim.
//
// A surface's CSS reads the two properties. It tunes them with --glass-bend,
// --glass-dispersion, --glass-rim, --glass-edge and --glass-lens (1 is clear,
// 0 is frost). A surface must not sit inside anything with its own filter or
// backdrop-filter, or the browser only shows it that parent's paint.
//
// The lens and rim maths are ported from Glisse by Kelvin Zhang
// (https://glisse.kelvinzhang.ca, https://github.com/0kzh/glisse):
//
//   MIT License
//
//   Copyright (c) 2026 Kelvin Zhang
//
//   Permission is hereby granted, free of charge, to any person obtaining a copy
//   of this software and associated documentation files (the "Software"), to deal
//   in the Software without restriction, including without limitation the rights
//   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//   copies of the Software, and to permit persons to whom the Software is
//   furnished to do so, subject to the following conditions:
//
//   The above copyright notice and this permission notice shall be included in all
//   copies or substantial portions of the Software.
//
//   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//   SOFTWARE.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  // Shares of the surface's shorter side: the band around the rim that bends,
  // and the sag of the dome whose slope sets how far it bends.
  const DEPTH = 0.25;
  const DOME = 0.5;
  // The rim's light fades out 1.22px in, over a 0.5px edge line.
  const RIM_WIDTH = 1.22;
  const EDGE_WIDTH = 0.5;
  const CHANNELS = ['1 0 0 0 0  0 0 0 0 0  0 0 0 0 0', '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0', '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0'];

  const refracts = /Chrom(?:e|ium)\//.test(navigator.userAgent);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const erf = (x) => Math.tanh(1.7724538509 * x); // erf(x) is close to tanh(sqrt(pi) x)

  // Signed distance to a rounded rectangle centred on the origin; negative inside.
  function edgeDistance(x, y, halfWidth, halfHeight, radius) {
    const qx = Math.abs(x) - halfWidth + radius;
    const qy = Math.abs(y) - halfHeight + radius;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
  }

  // The circular arc that sags by `sag` across `half`, scaled so its slope averages a half.
  function arc(sag, half) {
    const radius = (half * half + sag * sag) / (2 * sag);
    let sum = 0;
    for (let i = 0; i <= 200; i++) {
      const x = (i / 200) * half;
      const s = x / Math.sqrt(radius * radius - x * x);
      sum += i === 0 || i === 200 ? s / 2 : s;
    }
    const mean = sum / 200;
    return { radius, scale: mean > 0 ? 0.5 / mean : 1 };
  }
  const slope = (x, { radius, scale }) => {
    const inside = Math.min(x, 0.999 * radius);
    return (inside / Math.sqrt(radius * radius - inside * inside)) * scale;
  };

  // Keeps the newest few drawings: a resize can ask for many sizes.
  function remember(cache, key, value) {
    if (cache.size >= 32) cache.delete(cache.keys().next().value);
    cache.set(key, value);
    return value;
  }

  let canvas, context;
  function png(columns, rows, data) {
    canvas = canvas || document.createElement('canvas');
    context = context || canvas.getContext('2d');
    canvas.width = columns;
    canvas.height = rows;
    const image = context.createImageData(columns, rows);
    image.data.set(data);
    context.putImageData(image, 0, 0);
    return canvas.toDataURL();
  }

  // Three maps: greys of the pull across and the pull down (128 is none), and
  // an alpha covering where the lens bends at all. They are greys because a
  // wide-gamut display converts a map's colours before displacing by them.
  const lenses = new Map();
  function lensMaps(width, height, radius, density) {
    const key = [width, height, radius, density].join('|');
    if (lenses.has(key)) return lenses.get(key);
    const columns = Math.max(1, Math.round(width * density));
    const rows = Math.max(1, Math.round(height * density));
    const across = new Uint8ClampedArray(columns * rows * 4);
    const down = new Uint8ClampedArray(columns * rows * 4);
    const bends = new Uint8ClampedArray(columns * rows * 4);
    const grey = (data, i, value, alpha = 255) => {
      data[i] = data[i + 1] = data[i + 2] = value;
      data[i + 3] = alpha;
    };
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const share = Math.min(width, height);
    const depth = DEPTH * share;
    const innerWidth = Math.max(0, halfWidth - depth);
    const innerHeight = Math.max(0, halfHeight - depth);
    const innerRadius = clamp(radius, 0, Math.min(innerWidth, innerHeight));
    const ramp = 1 / (depth * Math.SQRT2);
    const sag = Math.max(0.01, Math.min(DOME * share, Math.min(halfWidth, halfHeight) - 1));
    const arcAcross = arc(sag, halfWidth);
    const arcDown = arc(sag, halfHeight);
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const i = (row * columns + column) * 4;
        const x = ((column + 0.5) / columns) * width - halfWidth;
        const y = ((row + 0.5) / rows) * height - halfHeight;
        const edge = edgeDistance(x, y, halfWidth, halfHeight, radius);
        if (edge >= 0) {
          grey(across, i, 128);
          grey(down, i, 128);
          grey(bends, i, 128, 0);
          continue;
        }
        const dx = Math.sign(x) * slope(Math.abs(x), arcAcross);
        const dy = Math.sign(y) * slope(Math.abs(y), arcDown);
        const falloff = 0.5 * (1 + erf(edgeDistance(x, y, innerWidth, innerHeight, innerRadius) * ramp));
        grey(across, i, Math.round((0.5 - 0.5 * dx * falloff) * 255));
        grey(down, i, Math.round((0.5 - 0.5 * dy * falloff) * 255));
        // Fully in once the pull reaches a twentieth of its strength, smoothed over the last pixel.
        grey(bends, i, 128, Math.round(255 * Math.min(1, falloff * 20, -edge)));
      }
    }
    return remember(lenses, key, {
      across: png(columns, rows, across),
      down: png(columns, rows, down),
      bends: png(columns, rows, bends),
    });
  }

  // The rim, as iOS draws it: a line brightest at the very edge and gone 1.22px
  // in. A light from the top left lights the left side and top, its reflection
  // the right side and bottom, and it fades out over the corners between.
  const rims = new Map();
  function rimImage(width, height, radius, shine, edge, density) {
    const key = [width, height, radius, shine, edge, density].join('|');
    if (rims.has(key)) return rims.get(key);
    const columns = Math.max(1, Math.round(width * density));
    const rows = Math.max(1, Math.round(height * density));
    const data = new Uint8ClampedArray(columns * rows * 4);
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const half = 0.5 / density;
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const x = ((column + 0.5) / columns) * width - halfWidth;
        const y = ((row + 0.5) / rows) * height - halfHeight;
        const depth = -edgeDistance(x, y, halfWidth, halfHeight, radius);
        if (depth < -half || depth > 2 * RIM_WIDTH) continue;
        // The nearest edge's outward normal.
        const qx = Math.abs(x) - halfWidth + radius;
        const qy = Math.abs(y) - halfHeight + radius;
        let nx = 0;
        let ny = 0;
        if (qx > 0 && qy > 0) {
          const length = Math.hypot(qx, qy);
          nx = (Math.sign(x) * qx) / length;
          ny = (Math.sign(y) * qy) / length;
        } else if (qx > qy) nx = Math.sign(x);
        else ny = Math.sign(y);
        const facing = Math.abs(nx + ny);
        const along = Math.max(0, depth) / (RIM_WIDTH * Math.sqrt(Math.max(1, facing)));
        const cover = clamp((depth + half) * density, 0, 1);
        const lined = clamp((Math.min(EDGE_WIDTH, depth + half) - Math.max(0, depth - half)) * density, 0, 1);
        const light = along < 1 ? shine * Math.min(1, facing) ** 1.5 * (1 - along ** 1.5) * cover : 0;
        const line = edge[3] * lined * (1 - light);
        const alpha = light + line;
        if (alpha <= 0) continue;
        const i = (row * columns + column) * 4;
        for (let channel = 0; channel < 3; channel++) data[i + channel] = Math.round((255 * light + edge[channel] * line) / alpha);
        data[i + 3] = Math.round(255 * alpha);
      }
    }
    return remember(rims, key, `url("${png(columns, rows, data)}")`);
  }

  function svg(name, attributes) {
    const element = document.createElementNS(NS, name);
    for (const key in attributes) element.setAttribute(key, String(attributes[key]));
    return element;
  }

  let defs;
  function filters() {
    if (defs && defs.isConnected) return defs;
    const root = svg('svg', { width: 0, height: 0, 'aria-hidden': 'true' });
    root.style.cssText = 'position:absolute;pointer-events:none';
    defs = svg('defs', {});
    root.append(defs);
    document.body.append(root);
    return defs;
  }

  // Leaves the backdrop as it is but for the rim, where it is displaced by the
  // maps once for each of red, green and blue, as the glass disperses.
  function lensFilter(maps, width, height) {
    const box = { x: 0, y: 0, width, height };
    const filter = svg('filter', { ...box, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' });
    const image = (href, result) => svg('feImage', { ...box, href, preserveAspectRatio: 'none', result });
    const matrix = (input, values, result) => svg('feColorMatrix', { in: input, type: 'matrix', values, result });
    const add = (a, b, result) => svg('feComposite', { in: a, in2: b, operator: 'arithmetic', k2: 1, k3: 1, result });
    filter.append(
      image(maps.across, 'across'),
      image(maps.down, 'down'),
      image(maps.bends, 'bends'),
      svg('feFlood', { ...box, 'flood-color': 'rgb(128, 128, 128)', result: 'neutral' }),
    );
    // Each pull reads its own grey, and takes the other direction from an alpha of one half, which is no pull.
    for (const pull of ['across', 'down']) {
      const half = svg('feComponentTransfer', { in: `${pull}-grey`, result: `${pull}-pull` });
      half.append(svg('feFuncA', { type: 'linear', slope: 0, intercept: 0.5 }));
      filter.append(svg('feComposite', { in: pull, in2: 'neutral', operator: 'over', result: `${pull}-grey` }), half);
    }
    const rays = CHANNELS.map((_, i) => {
      const across = svg('feDisplacementMap', { ...box, in: 'SourceGraphic', in2: 'across-pull', xChannelSelector: 'R', yChannelSelector: 'A', result: `across-${i}` });
      const down = svg('feDisplacementMap', { in: `across-${i}`, in2: 'down-pull', xChannelSelector: 'A', yChannelSelector: 'R', result: `ray-${i}` });
      filter.append(across, down);
      return [across, down];
    });
    // Each colour keeps a third of its alpha, so they add back up to what they were.
    CHANNELS.forEach((channel, i) => filter.append(matrix(`ray-${i}`, `${channel}  0 0 0 0.3333 0`, `light-${i}`)));
    filter.append(
      add('light-0', 'light-1', 'light-01'),
      add('light-01', 'light-2', 'spread'),
      matrix('spread', '3 0 0 0 0  0 3 0 0 0  0 0 3 0 0  0 0 0 1 0', 'bent'),
      svg('feComposite', { in: 'bent', in2: 'bends', operator: 'in', result: 'inside' }),
      svg('feComposite', { in: 'SourceGraphic', in2: 'bends', operator: 'out', result: 'outside' }),
      add('inside', 'outside', 'seen'),
    );
    return { filter, rays };
  }

  // A CSS colour as sRGB and alpha, by the canvas's own parsing.
  let palette;
  function parseColour(colour) {
    palette = palette || document.createElement('canvas').getContext('2d');
    palette.fillStyle = '#0000';
    palette.fillStyle = colour || '#0000';
    const value = String(palette.fillStyle);
    if (value.startsWith('#')) return [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16)).concat(1);
    const [r = 0, g = 0, b = 0, a = 1] = (value.match(/[\d.]+/g) || []).map(Number);
    return [r, g, b, a];
  }

  const surfaces = new Map();
  let made = 0;

  function fit(element) {
    const surface = surfaces.get(element);
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    if (!surface || !width || !height) return;
    const style = getComputedStyle(element);
    const number = (name, fallback) => {
      const value = parseFloat(style.getPropertyValue(name));
      return Number.isFinite(value) ? value : fallback;
    };
    const corner = style.borderTopLeftRadius;
    const radius = Math.min(width / 2, height / 2, corner.endsWith('%') ? (Math.min(width, height) * parseFloat(corner)) / 100 : parseFloat(corner) || 0);
    const lens = number('--glass-lens', 0.5);

    // Brightest when clear, where there is no frost to carry the shape.
    const shine = clamp(number('--glass-rim', 0.2) * (0.75 + 0.5 * lens), 0, 1);
    const edge = parseColour(style.getPropertyValue('--glass-edge').trim());
    const rimDensity = Math.min(devicePixelRatio || 1, 3);
    element.style.setProperty('--lg-rim', rimImage(width, height, radius, Number(shine.toFixed(3)), edge, rimDensity));
    element.setAttribute('data-rim', '');
    if (!refracts) return;

    // The bend eases off as the frost comes up, and is full at the default level.
    const reach = number('--glass-bend', 0.45) * clamp(lens / 0.5, 0.4, 1.25) * Math.min(width, height);
    const dispersion = Math.max(0, number('--glass-dispersion', 0.4));
    const density = Math.min(devicePixelRatio || 1, 2);
    const shape = [width, height, radius, density].join('|');
    if (surface.shape !== shape) {
      if (surface.built) surface.built.filter.remove();
      surface.built = lensFilter(lensMaps(width, height, radius, density), width, height);
      filters().append(surface.built.filter);
      surface.shape = shape;
      surface.tuned = '';
    }
    const tuned = [reach.toFixed(2), dispersion].join('|');
    if (surface.tuned === tuned) return;
    surface.tuned = tuned;
    const spectrum = [1 + 0.2 * dispersion, 1 + 0.1 * dispersion, 1];
    surface.built.rays.forEach((pair, i) => pair.forEach((ray) => ray.setAttribute('scale', String(reach * spectrum[i]))));
    // A new id, so the browser redraws from the changed filter.
    surface.built.filter.id = `lg-${surface.name}-${++surface.version}`;
    element.style.setProperty('--lg-filter', `url("#${surface.built.filter.id}")`);
  }

  // Fits at most once a frame, however many changes arrive.
  const pending = new Set();
  let frame = 0;
  function schedule(element) {
    pending.add(element);
    frame = frame || requestAnimationFrame(() => {
      frame = 0;
      const elements = [...pending];
      pending.clear();
      elements.forEach(fit);
    });
  }

  const resized = new ResizeObserver((entries) => entries.forEach((entry) => schedule(entry.target)));

  function attach(element) {
    if (surfaces.has(element)) return;
    surfaces.set(element, { name: ++made, version: 0, shape: '', tuned: '', built: null });
    resized.observe(element);
    schedule(element);
  }

  function refresh() {
    surfaces.forEach((_, element) => schedule(element));
  }

  // Light and dark change the rim and edge line, and no resize reports them.
  const theme = new MutationObserver(refresh);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  if (document.body) theme.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  window.LiquidGlass = { attach, refresh, refracts };
})();
