/**
 * VR portfolio — inside the website hero + featured work (A-Frame / WebXR)
 */
(function () {
  'use strict';

  const COLORS = {
    primary: '#7c3aed',
    accent: '#ec4899',
    heroBase: '#14121f',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    glass: '#1a1f2e',
  };

  let lobbyData = null;

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
    init: function () {
      this.baseScale = this.el.object3D.scale.clone();
      this.onMouseEnter = () => {
        this.el.object3D.scale.set(
          this.baseScale.x * 1.04,
          this.baseScale.y * 1.04,
          this.baseScale.z * 1.04
        );
      };
      this.onMouseLeave = () => {
        this.el.object3D.scale.copy(this.baseScale);
      };
      this.el.addEventListener('mouseenter', this.onMouseEnter);
      this.el.addEventListener('mouseleave', this.onMouseLeave);
    },
    remove: function () {
      this.el.removeEventListener('mouseenter', this.onMouseEnter);
      this.el.removeEventListener('mouseleave', this.onMouseLeave);
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

  AFRAME.registerComponent('nebula-points', {
    schema: {
      count: { type: 'number', default: 500 },
      spread: { type: 'number', default: 14 },
      color: { type: 'color', default: '#7c3aed' },
    },
    init: function () {
      const n = this.data.count;
      const positions = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        positions[i * 3] = (Math.random() - 0.5) * this.data.spread;
        positions[i * 3 + 1] = Math.random() * 5 + 0.2;
        positions[i * 3 + 2] = (Math.random() - 0.5) * this.data.spread - 3;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: this.data.color,
        size: 0.035,
        transparent: true,
        opacity: 0.55,
        sizeAttenuation: true,
        depthWrite: false,
      });
      this.points = new THREE.Points(geo, mat);
      this.el.object3D.add(this.points);
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
    return el('a-text', {
      value: text,
      align: o.align || 'center',
      width: o.width || 2.2,
      wrapCount: o.wrapCount || 40,
      color: o.color || COLORS.text,
      position: o.position || '0 0 0',
      'material-opacity': o.opacity != null ? o.opacity : 1,
    });
  }

  function makeGlassPanel(w, h, position) {
    return el('a-plane', {
      position,
      width: String(w),
      height: String(h),
      color: COLORS.glass,
      opacity: '0.82',
      'material-shader': 'flat',
      'material-transparent': 'true',
      'material-side': 'double',
    });
  }

  function makeButton(label, href, external, primary, position) {
    const w = Math.min(0.55 + label.length * 0.018, 0.95);
    const group = el('a-entity', { position, class: 'clickable' });
    const bg = el('a-plane', {
      width: String(w),
      height: '0.14',
      position: '0 0 0.01',
      color: primary ? COLORS.primary : '#2a2f42',
      opacity: primary ? '0.95' : '0.75',
      'material-transparent': 'true',
      'material-shader': 'flat',
    });
    const txt = makeText(label, { width: w - 0.1, color: '#ffffff', position: '0 0 0.02' });
    group.appendChild(bg);
    group.appendChild(txt);
    group.setAttribute('open-link', `href: ${href}; external: ${!!external}`);
    group.setAttribute('hover-highlight', '');
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
        'material-opacity': '1',
      })
    );

    const nebula = document.createElement('a-entity');
    nebula.setAttribute('nebula-points', `count: 500; spread: 14; color: ${rainbow ? '#ff006e' : primary}`);
    root.appendChild(nebula);

    const orbs = [
      { pos: '-3 2.5 -5', color: primary, scale: '2.2 2.2 2.2', phase: 0 },
      { pos: '3.5 2 -4', color: accent, scale: '1.8 1.8 1.8', phase: 1.2 },
      { pos: '0 0.5 -6', color: primary, scale: '2.5 2.5 2.5', phase: 2.4 },
    ];
    orbs.forEach((o) => {
      const orb = el('a-sphere', {
        position: o.pos,
        radius: '1',
        color: o.color,
        opacity: '0.28',
        'material-transparent': 'true',
        'material-shader': 'flat',
        scale: o.scale,
      });
      orb.setAttribute('drift-orb', `phase: ${o.phase}; speed: 0.35`);
      root.appendChild(orb);
    });

    const floor = el('a-ring', {
      position: '0 0.01 -2.2',
      'rotation': '-90 0 0',
      'radius-inner': '0.12',
      'radius-outer': '0.22',
      color: accent,
      opacity: '0.5',
      'material-transparent': 'true',
      'material-shader': 'flat',
    });
    root.appendChild(floor);
    const cue = makeText('↓ Featured work', {
      color: COLORS.textMuted,
      width: 1.2,
      position: '0 0.06 -2.2',
      wrapCount: 24,
    });
    root.appendChild(cue);
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
        color: COLORS.accent,
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
          opacity: '0.12',
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
      class: 'clickable',
    });
    group.setAttribute('hover-highlight', '');

    const cardW = 0.88;
    const imgH = cardW * (9 / 16);
    const bodyH = 0.42;
    const totalH = imgH + bodyH;

    const frame = el('a-plane', {
      width: String(cardW + 0.04),
      height: String(totalH + 0.04),
      color: COLORS.glass,
      opacity: '0.9',
      position: `0 ${totalH / 2} 0`,
      'material-transparent': 'true',
      'material-shader': 'flat',
    });
    group.appendChild(frame);

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
      pill.appendChild(
        el('a-plane', {
          width: String(w),
          height: '0.1',
          color: isCurrent ? COLORS.primary : '#ffffff',
          opacity: isCurrent ? '0.85' : '0.14',
          'material-transparent': 'true',
          'material-shader': 'flat',
        })
      );
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
    const rainbow = localStorage.getItem('rainbowMode') === 'true';
    if (rainbow) {
      data.colors = { ...data.colors, primary: '#ff006e', accent: '#8338ec' };
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

  function initScene(data) {
    const rainbow = applyThemeTints(data);
    if (data.colors) {
      Object.assign(COLORS, {
        primary: data.colors.primary || COLORS.primary,
        accent: data.colors.accent || COLORS.accent,
      });
    }
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
    if (scene.hasLoaded) initScene(lobbyData);
    else scene.addEventListener('loaded', () => initScene(lobbyData), { once: true });

    setupOverlay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
