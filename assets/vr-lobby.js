/**
 * VR portfolio — inside the website hero + featured work (A-Frame / WebXR)
 */
(function () {
  'use strict';

  const COLORS = {
    primary: '#7c3aed',
    accent: '#ec4899',
    heroBase: '#151416',
    heroWash: '#1e1828',
    heroWash2: '#221a26',
    text: '#ffffff',
    textMuted: '#cbd5e1',
    gradHi: '#ffffff',
    gradLo: '#e0e7ff',
    glass: 'rgba(255, 255, 255, 0.08)',
    glassBorder: 'rgba(255, 255, 255, 0.22)',
    glassPill: 'rgba(255, 255, 255, 0.14)',
  };

  const TEX = { star: null, heroBg: null, btnGrad: null };
  const VR_FONT = 'exo2bold';
  let lobbyData = null;

  function parseCssColor(str) {
    if (!str) return null;
    str = String(str).trim();
    if (str.startsWith('#')) {
      const h = str.slice(1);
      const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
      if (full.length !== 6) return null;
      return {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16),
      };
    }
    const m = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    return null;
  }

  function syncSiteTheme() {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    const primary = cs.getPropertyValue('--primary').trim() || COLORS.primary;
    const accent = cs.getPropertyValue('--accent').trim() || COLORS.accent;
    const flowBase = cs.getPropertyValue('--flow-base').trim() || '#faf9fc';
    Object.assign(COLORS, {
      primary,
      accent,
      heroBase: root.classList.contains('dark') ? '#151416' : flowBase,
      heroWash: root.classList.contains('dark')
        ? `color-mix(in srgb, ${primary} 12%, #151416)`
        : `color-mix(in srgb, ${primary} 18%, ${flowBase})`,
      heroWash2: root.classList.contains('dark')
        ? `color-mix(in srgb, ${accent} 10%, #151416)`
        : `color-mix(in srgb, ${accent} 14%, ${flowBase})`,
      text: root.classList.contains('dark') ? '#ffffff' : '#1a1a1a',
      textMuted: cs.getPropertyValue('--text-muted').trim() || '#94a3b8',
      glass: 'rgba(255, 255, 255, 0.1)',
      glassBorder: cs.getPropertyValue('--glass-border').trim() || 'rgba(255, 255, 255, 0.22)',
      glassPill: cs.getPropertyValue('--glass-pill').trim() || 'rgba(255, 255, 255, 0.14)',
    });
    return COLORS;
  }

  function getStarTexture() {
    if (TEX.star) return TEX.star;
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    TEX.star = new THREE.CanvasTexture(c);
    TEX.star.needsUpdate = true;
    return TEX.star;
  }

  function getHeroBgTexture(primary, accent, base) {
    if (TEX.heroBg) TEX.heroBg.dispose();
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const ctx = c.getContext('2d');
    const p = parseCssColor(primary) || { r: 124, g: 58, b: 237 };
    const a = parseCssColor(accent) || { r: 236, g: 72, b: 153 };
    const b = parseCssColor(base) || { r: 21, g: 20, b: 22 };
    const g = ctx.createLinearGradient(0, 0, 512, 512);
    g.addColorStop(0, `rgb(${b.r},${b.g},${b.b})`);
    g.addColorStop(0.38, `rgba(${p.r},${p.g},${p.b},0.35)`);
    g.addColorStop(0.62, `rgba(${a.r},${a.g},${a.b},0.28)`);
    g.addColorStop(1, `rgb(${Math.min(b.r + 8, 255)},${Math.min(b.g + 6, 255)},${Math.min(b.b + 10, 255)})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    TEX.heroBg = new THREE.CanvasTexture(c);
    return TEX.heroBg;
  }

  function getBtnGradTexture() {
    if (TEX.btnGrad) return TEX.btnGrad;
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext('2d');
    const p = parseCssColor(COLORS.primary) || { r: 124, g: 58, b: 237 };
    const a = parseCssColor(COLORS.accent) || { r: 236, g: 72, b: 153 };
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, `rgb(${p.r},${p.g},${p.b})`);
    g.addColorStop(1, `rgb(${a.r},${a.g},${a.b})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 64);
    TEX.btnGrad = new THREE.CanvasTexture(c);
    return TEX.btnGrad;
  }

  function setupRenderer() {
    const scene = document.getElementById('vrScene');
    if (!scene || !scene.renderer) return;
    const r = scene.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    r.setClearColor(0x151416, 1);
    if (r.xr) r.xr.enabled = true;
  }

  /* ——— A-Frame components ——— */

  AFRAME.registerComponent('open-link', {
    schema: {
      href: { type: 'string', default: '' },
      external: { type: 'boolean', default: false },
    },
    init: function () {
      this.el.classList.add('clickable');
      this.onClick = () => {
        const href = this.data.href;
        if (!href || href === 'vr.html') return;
        if (this.data.external || /^https?:/i.test(href)) {
          window.open(href, '_blank', 'noopener');
        } else {
          window.location.href = href;
        }
      };
      this.el.addEventListener('click', this.onClick);
    },
    remove: function () {
      this.el.removeEventListener('click', this.onClick);
    },
  });

  AFRAME.registerComponent('hover-highlight', {
    schema: {
      scale: { type: 'number', default: 1.04 },
    },
    init: function () {
      this.baseScale = this.el.object3D.scale.clone();
      this.highlighted = false;
      this.onEnter = () => {
        if (this.highlighted) return;
        this.highlighted = true;
        const s = this.data.scale;
        this.el.object3D.scale.set(
          this.baseScale.x * s,
          this.baseScale.y * s,
          this.baseScale.z * s
        );
      };
      this.onLeave = () => {
        if (!this.highlighted) return;
        this.highlighted = false;
        this.el.object3D.scale.copy(this.baseScale);
      };
      this.el.addEventListener('mouseenter', this.onEnter);
      this.el.addEventListener('mouseleave', this.onLeave);
      this.el.addEventListener('raycaster-intersected', this.onEnter);
      this.el.addEventListener('raycaster-intersected-cleared', this.onLeave);
    },
    remove: function () {
      this.el.removeEventListener('mouseenter', this.onEnter);
      this.el.removeEventListener('mouseleave', this.onLeave);
      this.el.removeEventListener('raycaster-intersected', this.onEnter);
      this.el.removeEventListener('raycaster-intersected-cleared', this.onLeave);
    },
  });

  AFRAME.registerComponent('rest-on-release', {
    init: function () {
      this.storeHome();
      this.returning = false;
      this.el.addEventListener('grab-end', () => {
        this.returning = true;
      });
    },
    storeHome: function () {
      this.homePos = this.el.object3D.position.clone();
      this.homeQuat = this.el.object3D.quaternion.clone();
      this.homeScale = this.el.object3D.scale.clone();
    },
    tick: function () {
      if (!this.returning) return;
      const p = this.el.object3D.position;
      const q = this.el.object3D.quaternion;
      const s = this.el.object3D.scale;
      p.lerp(this.homePos, 0.12);
      q.slerp(this.homeQuat, 0.12);
      s.lerp(this.homeScale, 0.12);
      if (p.distanceTo(this.homePos) < 0.008) {
        p.copy(this.homePos);
        q.copy(this.homeQuat);
        s.copy(this.homeScale);
        this.returning = false;
      }
    },
  });

  AFRAME.registerComponent('grab-feedback', {
    schema: {
      tapMs: { type: 'number', default: 480 },
    },
    init: function () {
      this.el.classList.add('grabbable');
      this.grabStart = 0;
      this.onGrabStart = () => {
        this.grabStart = Date.now();
        this.el.emit('hover-exit');
      };
      this.onGrabEnd = () => {
        const dt = Date.now() - this.grabStart;
        if (dt < this.data.tapMs && this.el.classList.contains('clickable')) {
          this.el.click();
        }
      };
      this.el.addEventListener('grab-start', this.onGrabStart);
      this.el.addEventListener('grab-end', this.onGrabEnd);
    },
    remove: function () {
      this.el.removeEventListener('grab-start', this.onGrabStart);
      this.el.removeEventListener('grab-end', this.onGrabEnd);
    },
  });

  AFRAME.registerComponent('pupil-follow', {
    schema: { maxOffset: { type: 'number', default: 0.012 } },
    init: function () {
      this.socket = this.el.parentEl;
    },
    tick: function () {
      const cam = document.getElementById('camera');
      if (!cam || !this.socket) return;
      const socketPos = new THREE.Vector3();
      const camPos = new THREE.Vector3();
      this.socket.object3D.getWorldPosition(socketPos);
      cam.object3D.getWorldPosition(camPos);
      const dx = camPos.x - socketPos.x;
      const dy = camPos.y - socketPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const move = Math.min(dist * 0.02, this.data.maxOffset);
      this.el.object3D.position.set((dx / dist) * move, (dy / dist) * move, 0.02);
    },
  });

  AFRAME.registerComponent('nebula-stars', {
    schema: {
      count: { type: 'number', default: 900 },
      spread: { type: 'number', default: 16 },
    },
    init: function () {
      const primary = parseCssColor(COLORS.primary) || { r: 124, g: 58, b: 237 };
      const accent = parseCssColor(COLORS.accent) || { r: 236, g: 72, b: 153 };
      const n = this.data.count;
      const positions = new Float32Array(n * 3);
      const colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        positions[i * 3] = (Math.random() - 0.5) * this.data.spread;
        positions[i * 3 + 1] = Math.random() * 6 + 0.3;
        positions[i * 3 + 2] = (Math.random() - 0.5) * this.data.spread - 4;
        const roll = Math.random();
        const c = roll < 0.12 ? accent : roll < 0.28 ? primary : { r: 255, g: 255, b: 255 };
        const dim = 0.35 + Math.random() * 0.65;
        colors[i * 3] = (c.r / 255) * dim;
        colors[i * 3 + 1] = (c.g / 255) * dim;
        colors[i * 3 + 2] = (c.b / 255) * dim;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mat = new THREE.PointsMaterial({
        map: getStarTexture(),
        vertexColors: true,
        size: 0.022,
        transparent: true,
        opacity: 0.85,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.points = new THREE.Points(geo, mat);
      this.el.object3D.add(this.points);
      this.t0 = performance.now();
    },
    tick: function () {
      if (!this.points) return;
      const t = (performance.now() - this.t0) * 0.00008;
      this.points.rotation.y = t * 0.35;
    },
    remove: function () {
      if (this.points) {
        this.el.object3D.remove(this.points);
        this.points.geometry.dispose();
        this.points.material.dispose();
      }
    },
  });

  AFRAME.registerComponent('drift-orb', {
    schema: {
      axis: { type: 'vec3', default: { x: 0.3, y: 0.15, z: 0.1 } },
      speed: { type: 'number', default: 0.4 },
      phase: { type: 'number', default: 0 },
    },
    init: function () {
      this.base = this.el.object3D.position.clone();
    },
    tick: function (t) {
      const s = this.data.speed;
      const p = this.data.phase;
      const a = this.data.axis;
      const time = t * 0.001;
      this.el.object3D.position.set(
        this.base.x + Math.sin(time * s + p) * a.x,
        this.base.y + Math.cos(time * s * 0.8 + p) * a.y,
        this.base.z + Math.sin(time * s * 0.6 + p) * a.z
      );
    },
  });

  /* ——— DOM helpers ——— */

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'class') node.setAttribute('class', v);
        else if (k === 'components') return;
        else node.setAttribute(k, v);
      });
      if (attrs.components) {
        Object.entries(attrs.components).forEach(([name, val]) => {
          node.setAttribute(name, typeof val === 'string' ? val : objectToComponent(val));
        });
      }
    }
    (children || []).forEach((c) => {
      if (typeof c === 'string') node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  function objectToComponent(obj) {
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ');
  }

  function addAssetImage(src, id) {
    const assets = document.getElementById('vrAssets');
    if (!assets || !src) return;
    const img = document.createElement('img');
    img.id = id;
    img.src = src;
    img.crossOrigin = 'anonymous';
    assets.appendChild(img);
  }

  function makeText(text, opts) {
    const o = opts || {};
    const node = el('a-text', {
      value: text,
      align: o.align || 'center',
      width: o.width || 2.2,
      wrapCount: o.wrapCount || 40,
      color: o.color || COLORS.text,
      position: o.position || '0 0 0',
      font: VR_FONT,
      'material-shader': 'msdf',
      'material-side': 'double',
    });
    if (o.opacity != null) node.setAttribute('material', `opacity: ${o.opacity}`);
    return node;
  }

  function makeGlassPanel(w, h, position) {
    const group = el('a-entity', { position });
    group.appendChild(
      el('a-plane', {
        width: String(w),
        height: String(h),
        position: '0 0 0',
        color: '#ffffff',
        opacity: '0.1',
        'material-transparent': 'true',
        'material-shader': 'flat',
        'material-side': 'double',
      })
    );
    group.appendChild(
      el('a-plane', {
        width: String(w + 0.02),
        height: String(h + 0.02),
        position: '0 0 -0.001',
        color: COLORS.primary,
        opacity: '0.22',
        'material-transparent': 'true',
        'material-shader': 'flat',
      })
    );
    return group;
  }

  function applyPlaneGradient(planeEl, texture) {
    const apply = () => {
      const mesh = planeEl.getObject3D('mesh');
      if (!mesh || !mesh.material) return;
      mesh.material.map = texture;
      mesh.material.transparent = true;
      mesh.material.opacity = 1;
      mesh.material.needsUpdate = true;
    };
    planeEl.addEventListener('loaded', apply);
    setTimeout(apply, 50);
  }

  function makeButton(label, href, external, primary, position) {
    const w = Math.min(0.55 + label.length * 0.018, 0.95);
    const group = el('a-entity', { position, class: 'clickable' });
    const bg = el('a-plane', {
      width: String(w),
      height: '0.14',
      position: '0 0 0.01',
      'material-transparent': 'true',
      'material-shader': 'flat',
      'material-side': 'double',
    });
    if (primary) {
      applyPlaneGradient(bg, getBtnGradTexture());
    } else {
      bg.setAttribute('color', '#ffffff');
      bg.setAttribute('opacity', '0.14');
    }
    const txt = makeText(label, { width: w - 0.1, color: '#ffffff', position: '0 0 0.02' });
    group.appendChild(bg);
    group.appendChild(txt);
    group.setAttribute('open-link', `href: ${href}; external: ${!!external}`);
    group.setAttribute('hover-highlight', 'scale: 1.04');
    group.classList.add('clickable');
    return group;
  }

  /* ——— Scene builders ——— */

  function buildAtmosphere(data, rainbow) {
    const root = document.getElementById('vrAtmosphere');
    if (!root) return;

    const primary = data.colors?.primary || COLORS.primary;
    const accent = data.colors?.accent || COLORS.accent;
    const base = data.colors?.heroBase || COLORS.heroBase;

    root.appendChild(
      el('a-sky', {
        color: rainbow ? '#2a1535' : base,
      })
    );

    const heroBg = getHeroBgTexture(primary, accent, base);
    const backdrop = el('a-plane', {
      position: '0 2 -5',
      width: '16',
      height: '10',
      'material-shader': 'flat',
      'material-side': 'double',
      opacity: '0.95',
    });
    applyPlaneGradient(backdrop, heroBg);
    root.appendChild(backdrop);

    const starCount = 900;
    const nebula = document.createElement('a-entity');
    nebula.setAttribute('nebula-stars', `count: ${starCount}; spread: 16`);
    root.appendChild(nebula);

    const orbs = [
      { pos: '-2.8 2.4 -4.8', color: primary, scale: '2.4 2.4 2.4', phase: 0 },
      { pos: '3.2 1.9 -4.2', color: accent, scale: '2 2 2', phase: 1.2 },
      { pos: '0 0.8 -5.5', color: primary, scale: '2.8 2.8 2.8', phase: 2.4 },
    ];
    orbs.forEach((o, idx) => {
      const orb = el('a-sphere', {
        position: o.pos,
        radius: '1',
        color: o.color,
        opacity: '0.14',
        'material-transparent': 'true',
        'material-shader': 'flat',
        scale: o.scale,
      });
      orb.setAttribute('drift-orb', `phase: ${o.phase}; speed: 0.28`);
      if (idx === 1) {
        orb.classList.add('grabbable');
        orb.setAttribute('grab-feedback', 'tapMs: 9999');
        orb.setAttribute('rest-on-release', '');
        orb.setAttribute('hover-highlight', 'scale: 1.06');
      }
      root.appendChild(orb);
    });

    const floor = el('a-ring', {
      position: '0 0.01 -2.2',
      rotation: '-90 0 0',
      'radius-inner': '0.14',
      'radius-outer': '0.26',
      color: accent,
      opacity: '0.35',
      'material-transparent': 'true',
      'material-shader': 'flat',
    });
    root.appendChild(floor);
    root.appendChild(
      makeText('↓ Featured work', {
        color: COLORS.textMuted,
        width: 1.2,
        position: '0 0.06 -2.2',
        wrapCount: 24,
        opacity: 0.85,
      })
    );
    root.appendChild(
      makeText('Point · pinch · or grab cards', {
        color: COLORS.textMuted,
        width: 1.5,
        position: '0 1.35 -2.1',
        wrapCount: 26,
        opacity: 0.75,
      })
    );
  }

  function buildHeadset(layout) {
    const y = layout.headsetY ?? 2.05;
    const z = layout.headsetZ ?? -1.6;
    const group = el('a-entity', { position: `0 ${y} ${z}`, id: 'vrHeadset' });

    const visor = el('a-box', {
      width: '0.52',
      height: '0.22',
      depth: '0.14',
      color: '#1a1a2e',
      position: '0 0 0',
    });
    const accentBar = el('a-box', {
      width: '0.12',
      height: '0.02',
      depth: '0.02',
      color: COLORS.primary,
      position: '0 0.1 0.08',
    });

    function makeEye(x) {
      const socket = el('a-entity', { position: `${x} 0 0.08` });
      const outer = el('a-sphere', { radius: '0.055', color: '#0a0a15' });
      const white = el('a-sphere', { radius: '0.045', color: '#e8e8e8', position: '0 0 0.01' });
      const pupil = el('a-sphere', {
        radius: '0.022',
        color: '#4a1c7a',
        position: '0 0 0.03',
      });
      pupil.setAttribute('pupil-follow', '');
      socket.appendChild(outer);
      socket.appendChild(white);
      socket.appendChild(pupil);
      return socket;
    }

    group.appendChild(visor);
    group.appendChild(accentBar);
    group.appendChild(makeEye(-0.1));
    group.appendChild(makeEye(0.1));
    return group;
  }

  function buildHero(data) {
    const root = document.getElementById('vrHero');
    if (!root) return;
    const hero = data.hero;
    const layout = data.layout || {};
    const introZ = layout.introZ ?? -2.4;

    root.appendChild(buildHeadset(layout));

    const introGroup = el('a-entity', { position: `0 1.55 ${introZ}` });
    introGroup.appendChild(makeGlassPanel(2.4, 1.35, '0 0 -0.02'));

    introGroup.appendChild(
      makeText(hero.eyebrow, {
        color: COLORS.textMuted,
        width: 2,
        position: '0 0.48 0.01',
        wrapCount: 30,
      })
    );
    introGroup.appendChild(
      makeText(hero.headlineLine1, {
        color: COLORS.text,
        width: 2.3,
        position: '0 0.22 0.01',
        wrapCount: 32,
      })
    );
    introGroup.appendChild(
      makeText(hero.headlineLine2, {
        color: COLORS.gradLo,
        width: 2.3,
        position: '0 -0.02 0.01',
        wrapCount: 32,
      })
    );
    introGroup.appendChild(
      makeText(hero.lead, {
        color: COLORS.textMuted,
        width: 2.2,
        position: '0 -0.38 0.01',
        wrapCount: 52,
      })
    );
    root.appendChild(introGroup);

    const tags = data.tags || [];
    const tagY = 0.95;
    const tagZ = introZ + 0.15;
    const tagSpread = Math.min(tags.length * 0.22, 1.8);
    tags.forEach((tag, i) => {
      const t = (i - (tags.length - 1) / 2) * (tagSpread / Math.max(tags.length - 1, 1));
      const pill = el('a-entity', { position: `${t} ${tagY} ${tagZ}` });
      const w = 0.12 + tag.length * 0.014;
      pill.appendChild(
        el('a-plane', {
          width: String(w),
          height: '0.08',
          color: '#ffffff',
          opacity: '0.14',
          'material-transparent': 'true',
          'material-shader': 'flat',
        })
      );
      pill.appendChild(
        makeText(tag, { width: w - 0.04, color: COLORS.text, position: '0 0 0.01', wrapCount: 22 })
      );
      root.appendChild(pill);
    });

    const ctas = data.ctas || [];
    const ctaY = 0.72;
    const ctaZ = introZ + 0.2;
    const ctaSpacing = 0.52;
    const startX = -((ctas.length - 1) * ctaSpacing) / 2;
    ctas.forEach((cta, i) => {
      root.appendChild(
        makeButton(cta.label, cta.href, cta.external, cta.primary, `${startX + i * ctaSpacing} ${ctaY} ${ctaZ}`)
      );
    });

    root.appendChild(
      makeButton('Back to 2D site', 'index.html', false, false, `1.35 ${ctaY} ${ctaZ}`)
    );
  }

  function buildProjectCard(project, position, rotationY) {
    const group = el('a-entity', {
      position,
      rotation: `0 ${rotationY} 0`,
      class: 'clickable grabbable',
    });
    group.setAttribute('hover-highlight', 'scale: 1.04');
    group.setAttribute('grab-feedback', '');
    group.setAttribute('rest-on-release', '');

    const cardW = 0.88;
    const imgH = cardW * (9 / 16);
    const bodyH = 0.42;
    const totalH = imgH + bodyH;

    const frame = el('a-plane', {
      width: String(cardW + 0.03),
      height: String(totalH + 0.03),
      color: '#ffffff',
      opacity: '0.1',
      position: `0 ${totalH / 2} 0`,
      'material-transparent': 'true',
      'material-shader': 'flat',
      'material-side': 'double',
    });
    group.appendChild(frame);
    const border = el('a-plane', {
      width: String(cardW + 0.05),
      height: String(totalH + 0.05),
      color: COLORS.primary,
      opacity: '0.18',
      position: `0 ${totalH / 2} -0.002`,
      'material-transparent': 'true',
      'material-shader': 'flat',
    });
    group.appendChild(border);

    addAssetImage(project.image, `img-${project.id}`);
    const imgPlane = el('a-plane', {
      width: String(cardW),
      height: String(imgH),
      position: `0 ${bodyH + imgH / 2} 0.01`,
      'material-shader': 'flat',
    });
    imgPlane.setAttribute('src', `#img-${project.id}`);
    imgPlane.setAttribute('material', 'shader: flat; side: double');
    group.appendChild(imgPlane);

    const bodyY = bodyH / 2;
    group.appendChild(
      makeText(project.title, {
        color: COLORS.text,
        width: cardW - 0.08,
        position: `0 ${bodyY + 0.12} 0.02`,
        wrapCount: 28,
        align: 'left',
      })
    );
    group.appendChild(
      makeText(project.description, {
        color: COLORS.textMuted,
        width: cardW - 0.08,
        position: `0 ${bodyY - 0.02} 0.02`,
        wrapCount: 38,
        align: 'left',
      })
    );

    const href = project.href || 'projects.html';
    const external = !!project.external;
    group.setAttribute('open-link', `href: ${href}; external: ${external}`);
    group.classList.add('clickable');

    return group;
  }

  function buildGallery(data) {
    const root = document.getElementById('vrGallery');
    if (!root) return;
    const layout = data.layout || {};
    const z = layout.galleryZ ?? -3.8;
    const radius = layout.galleryRadius ?? 2.8;
    const arc = ((layout.galleryArcDegrees ?? 70) * Math.PI) / 180;
    const projects = data.projects || [];

    const titleGroup = el('a-entity', { position: `0 1.85 ${z + 0.5}` });
    titleGroup.appendChild(
      makeText(data.galleryTitle || 'Featured Projects', {
        color: COLORS.text,
        width: 2.5,
        position: '0 0.12 0',
      })
    );
    titleGroup.appendChild(
      makeText(data.gallerySubtitle || '', {
        color: COLORS.textMuted,
        width: 2.2,
        position: '0 -0.08 0',
        wrapCount: 40,
      })
    );
    root.appendChild(titleGroup);

    const n = projects.length;
    projects.forEach((proj, i) => {
      const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * arc;
      const x = Math.sin(t) * radius;
      const dz = Math.cos(t) * radius;
      const posZ = z - (radius - dz);
      const rotY = (-t * 180) / Math.PI;
      root.appendChild(buildProjectCard(proj, `${x} 1.15 ${posZ}`, rotY));
    });

    root.appendChild(
      makeButton('View all projects', 'projects.html', false, true, `0 0.35 ${z + 0.3}`)
    );
  }

  function buildNav(data) {
    const root = document.getElementById('vrNav');
    if (!root) return;
    const layout = data.layout || {};
    const y = layout.navY ?? 2.35;
    const z = layout.navZ ?? -1.8;
    const items = data.nav || [];
    const spacing = 0.38;
    const startX = -((items.length - 1) * spacing) / 2;

    items.forEach((item, i) => {
      const x = startX + i * spacing;
      const pill = el('a-entity', { position: `${x} ${y} ${z}` });
      const w = 0.2 + item.label.length * 0.012;
      const isCurrent = !!item.current;
      const pillBg = el('a-plane', {
        width: String(w),
        height: '0.1',
        color: '#ffffff',
        opacity: isCurrent ? '0.22' : '0.12',
        'material-transparent': 'true',
        'material-shader': 'flat',
      });
      pill.appendChild(pillBg);
      if (isCurrent) {
        const activeGrad = el('a-plane', {
          width: String(w),
          height: '0.1',
          position: '0 0 0.001',
          'material-transparent': 'true',
          'material-shader': 'flat',
        });
        applyPlaneGradient(activeGrad, getBtnGradTexture());
        pill.appendChild(activeGrad);
      }
      const label = `${item.icon || ''} ${item.label}`.trim();
      pill.appendChild(
        makeText(label, {
          width: w - 0.04,
          color: '#fff',
          position: '0 0 0.01',
          wrapCount: 18,
        })
      );
      if (!item.current) {
        pill.setAttribute('open-link', `href: ${item.href}; external: ${!!item.external}`);
        pill.setAttribute('hover-highlight', '');
        pill.classList.add('clickable');
      }
      root.appendChild(pill);
    });
  }

  function applyThemeTints(data) {
    syncSiteTheme();
    data.colors = { ...data.colors, ...COLORS };
    const rainbow = localStorage.getItem('rainbowMode') === 'true';
    if (rainbow) {
      data.colors.primary = '#ff006e';
      data.colors.accent = '#8338ec';
      Object.assign(COLORS, { primary: '#ff006e', accent: '#8338ec' });
    }
    return rainbow;
  }

  async function loadLobbyData() {
    try {
      const res = await fetch('assets/vr-lobby.json');
      if (!res.ok) throw new Error('fetch failed');
      return await res.json();
    } catch {
      return null;
    }
  }

  function setupInputHands() {
    const rayOpts =
      'objects: .clickable, .grabbable; far: 12; showLine: true; lineOpacity: 0.85; cursorColor: white';

    [
      { id: 'leftHand', hand: 'left', color: '#ec4899' },
      { id: 'rightHand', hand: 'right', color: '#7c3aed' },
    ].forEach(({ id, hand, color }) => {
      const handEl = document.getElementById(id);
      if (!handEl) return;

      handEl.setAttribute('hand-tracking-controls', `hand: ${hand}`);
      handEl.setAttribute('hand-tracking-grab', '');
      handEl.setAttribute(
        'laser-controls',
        `hand: ${hand}; handTrackingEnabled: true`
      );
      handEl.setAttribute('raycaster', `${rayOpts}; lineColor: ${color}`);
      handEl.setAttribute('oculus-touch-controls', `hand: ${hand}`);

      if (AFRAME.components['gesture-detector']) {
        handEl.setAttribute('gesture-detector', '');
        handEl.addEventListener('pinchstarted', () => {
          const hits = handEl.components.raycaster?.intersectedEls;
          if (!hits || !hits.length) return;
          const target = hits[0];
          if (target.classList.contains('clickable')) target.click();
        });
      }
    });

    const scene = document.getElementById('vrScene');
    scene?.addEventListener('enter-vr', () => {
      document.body.setAttribute('data-vr-input', 'immersive');
    });
    scene?.addEventListener('exit-vr', () => {
      document.body.removeAttribute('data-vr-input');
    });
  }

  function initScene(data) {
    const rainbow = applyThemeTints(data);
    TEX.heroBg = null;
    TEX.btnGrad = null;
    setupRenderer();
    setupInputHands();
    buildAtmosphere(data, rainbow);
    buildHero(data);
    buildGallery(data);
    buildNav(data);
  }

  function setupOverlay() {
    const overlay = document.getElementById('vrOverlay');
    const enterBtn = document.getElementById('enterVrBtn');
    const hint = document.getElementById('vrOverlayHint');
    const scene = document.getElementById('vrScene');

    function hideOverlay() {
      overlay?.classList.add('is-hidden');
    }

    if (navigator.xr && navigator.xr.isSessionSupported) {
      navigator.xr.isSessionSupported('immersive-vr').then((ok) => {
        if (!ok && hint) {
          hint.textContent =
            'Immersive VR not available — explore in 3D with mouse, or use Quest Browser on HTTPS';
        }
        if (!ok && enterBtn) enterBtn.hidden = true;
        if (!ok) setTimeout(hideOverlay, 700);
      });
    } else {
      if (enterBtn) enterBtn.hidden = true;
      if (hint) hint.textContent = 'WebXR not supported in this browser — use mouse to look around';
      setTimeout(hideOverlay, 700);
    }

    enterBtn?.addEventListener('click', () => {
      if (!scene) return;
      if (scene.is('vr-mode')) {
        hideOverlay();
        return;
      }
      scene.enterVR().catch(() => {
        if (hint) hint.textContent = 'Could not enter VR — try from Quest Browser on HTTPS';
      });
    });

    scene?.addEventListener('enter-vr', hideOverlay);
  }

  async function boot() {
    lobbyData = await loadLobbyData();
    if (!lobbyData) {
      document.getElementById('vrOverlayDesc').textContent =
        'Could not load VR scene data. Return to the main site.';
      return;
    }

    const scene = document.getElementById('vrScene');
    const run = () => initScene(lobbyData);
    if (scene.hasLoaded) run();
    else scene.addEventListener('loaded', run, { once: true });

    setupOverlay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
