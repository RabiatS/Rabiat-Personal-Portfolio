/**
 * Builder cube fall — click-to-drop from panel to footer
 */
import gsap from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js';

const FALL_DURATION = 1.75;
const FACE_NORMALS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export function createCubeFallController(ctx) {
  const {
    host,
    cube,
    cubeGroup,
    materials,
    edgeLines,
    glowLines,
    renderer,
    prefersReducedMotion,
    onFallStart,
    onFallComplete,
  } = ctx;

  let state = 'idle'; // idle | falling | landed
  let dustEl = null;
  let hintEl = null;
  let wiggleTween = null;
  let landingFaceIndex = 2; // ENGINEER (+Y) default

  function getFooter() {
    return document.querySelector('footer.footer');
  }

  function computeLandingCoords() {
    const footer = getFooter();
    if (!footer) return null;

    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const hostW = host.offsetWidth || 320;
    const hostH = host.offsetHeight || 400;

    const footerDocTop = footer.getBoundingClientRect().top + window.scrollY;
    const landTop = footerDocTop - hostH * 0.72 - 12;
    const landLeft = Math.max(24, window.innerWidth - hostW - 48);

    return { landTop, landLeft, maxScroll, hostW, hostH };
  }

  function pinHostAbsolute(startRect) {
    host.classList.add('builder-cube-host--falling');
    host.style.position = 'absolute';
    host.style.top = `${startRect.top + window.scrollY}px`;
    host.style.left = `${startRect.left}px`;
    host.style.right = 'auto';
    host.style.width = `${startRect.width}px`;
    host.style.height = `${startRect.height}px`;
    host.style.opacity = '1';
  }

  function setHeavyMaterials() {
    materials.forEach((mat) => {
      mat.metalness = 0.97;
      mat.roughness = 0.14;
      mat.envMapIntensity = Math.max(0.2, mat.envMapIntensity * 0.5);
      mat.emissiveIntensity = 0;
    });
    edgeLines.material.opacity = 0.32;
    glowLines.material.opacity = 0;
  }

  function spawnDust(x, y) {
    dustEl = document.createElement('div');
    dustEl.className = 'builder-cube-dust';
    dustEl.setAttribute('aria-hidden', 'true');
    dustEl.style.left = `${x}px`;
    dustEl.style.top = `${y}px`;
    document.body.appendChild(dustEl);
    dustEl.addEventListener('animationend', () => dustEl?.remove(), { once: true });
    setTimeout(() => dustEl?.remove(), 1200);
  }

  function ensureHintEl() {
    if (hintEl) return hintEl;
    hintEl = document.createElement('div');
    hintEl.className = 'builder-cube-heavy-hint';
    hintEl.textContent = 'Too heavy.';
    hintEl.setAttribute('aria-hidden', 'true');
    host.appendChild(hintEl);
    return hintEl;
  }

  function microShake() {
    document.documentElement.classList.add('builder-cube-impact-shake');
    setTimeout(() => document.documentElement.classList.remove('builder-cube-impact-shake'), 320);
  }

  function settleCube(finalFaceIndex) {
    landingFaceIndex = finalFaceIndex;
    const n = FACE_NORMALS[finalFaceIndex];
    const targetY = Math.atan2(n[0], n[2]);
    const targetX = Math.asin(Math.max(-1, Math.min(1, -n[1])));

    gsap.to(cube.rotation, {
      x: targetX,
      y: targetY,
      z: 0,
      duration: 0.35,
      ease: 'back.out(1.4)',
    });

    materials.forEach((mat, i) => {
      gsap.fromTo(
        mat,
        { emissiveIntensity: i === finalFaceIndex ? 0.06 : 0 },
        { emissiveIntensity: 0, duration: 0.5, ease: 'power2.out' }
      );
    });
  }

  function instantLand() {
    const coords = computeLandingCoords();
    if (!coords) return;

    const startRect = host.getBoundingClientRect();
    pinHostAbsolute(startRect);
    setHeavyMaterials();
    onFallStart?.();

    window.scrollTo(0, coords.maxScroll);
    host.style.top = `${coords.landTop}px`;
    host.style.left = `${coords.landLeft}px`;

    state = 'landed';
    host.classList.remove('builder-cube-host--falling');
    host.classList.add('builder-cube-host--landed');
    document.documentElement.classList.add('builder-cube-fallen');

    const dustX = coords.landLeft + coords.hostW * 0.15;
    const dustY = coords.landTop + coords.hostH * 0.82;
    spawnDust(dustX, dustY);
    settleCube(2);
    onFallComplete?.({ landed: true });
  }

  function animateFall() {
    const coords = computeLandingCoords();
    if (!coords) return;

    const startRect = host.getBoundingClientRect();
    pinHostAbsolute(startRect);
    setHeavyMaterials();
    onFallStart?.();

    state = 'falling';
    document.documentElement.classList.add('builder-cube-fall-scroll-lock');

    const proxy = {
      scrollY: window.scrollY,
      top: startRect.top + window.scrollY,
      left: startRect.left,
      rotY: cube.rotation.y,
      rotX: cube.rotation.x,
      rotZ: cube.rotation.z,
      squash: 1,
    };

    const tumbleRotY = proxy.rotY + Math.PI * 2.4;
    const tumbleRotX = proxy.rotX + Math.PI * 0.85;
    const baseScale = cubeGroup.scale.x;

    const tl = gsap.timeline({
      onComplete: () => {
        document.documentElement.classList.remove('builder-cube-fall-scroll-lock');
        state = 'landed';
        host.classList.remove('builder-cube-host--falling');
        host.classList.add('builder-cube-host--landed');
        document.documentElement.classList.add('builder-cube-fallen');

        const dustX = coords.landLeft + coords.hostW * 0.15;
        const dustY = coords.landTop + coords.hostH * 0.82;
        spawnDust(dustX, dustY);
        microShake();
        settleCube(2);
        onFallComplete?.({ landed: true });
      },
    });

    tl.to(
      proxy,
      {
        scrollY: coords.maxScroll,
        top: coords.landTop,
        left: coords.landLeft,
        rotY: tumbleRotY,
        rotX: tumbleRotX,
        rotZ: proxy.rotZ + Math.PI * 0.35,
        duration: FALL_DURATION,
        ease: 'power3.in',
        onUpdate: () => {
          window.scrollTo(0, proxy.scrollY);
          host.style.top = `${proxy.top}px`;
          host.style.left = `${proxy.left}px`;
          cube.rotation.y = proxy.rotY;
          cube.rotation.x = proxy.rotX;
          cube.rotation.z = proxy.rotZ;
        },
      },
      0
    );

    tl.to(
      proxy,
      {
        squash: 0.88,
        duration: 0.12,
        ease: 'power2.in',
        onUpdate: () => {
          cubeGroup.scale.setScalar(baseScale * proxy.squash);
        },
      },
      FALL_DURATION - 0.12
    );

    tl.to(
      proxy,
      {
        squash: 1,
        duration: 0.22,
        ease: 'elastic.out(1, 0.5)',
        onUpdate: () => {
          cubeGroup.scale.setScalar(baseScale * proxy.squash);
        },
      },
      FALL_DURATION
    );
  }

  function triggerFall() {
    if (state !== 'idle') return false;
    if (prefersReducedMotion) {
      instantLand();
      return true;
    }
    animateFall();
    return true;
  }

  function showHeavyHint() {
    const el = ensureHintEl();
    el.classList.add('is-visible');
    clearTimeout(showHeavyHint._t);
    showHeavyHint._t = setTimeout(() => el.classList.remove('is-visible'), 2200);
  }

  function wiggleRefusal() {
    if (wiggleTween) wiggleTween.kill();
    wiggleTween = gsap.timeline();
    wiggleTween.to(cubeGroup.rotation, { z: 0.04, duration: 0.06, ease: 'power1.inOut' });
    wiggleTween.to(cubeGroup.rotation, { z: -0.04, duration: 0.08, ease: 'power1.inOut' });
    wiggleTween.to(cubeGroup.rotation, { z: 0.025, duration: 0.06, ease: 'power1.inOut' });
    wiggleTween.to(cubeGroup.rotation, { z: 0, duration: 0.08, ease: 'power2.out' });
    showHeavyHint();
  }

  function handleClick() {
    if (state === 'idle') return triggerFall();
    if (state === 'landed') {
      wiggleRefusal();
      return true;
    }
    return false;
  }

  return {
    get state() {
      return state;
    },
    get isLanded() {
      return state === 'landed';
    },
    get isFalling() {
      return state === 'falling';
    },
    handleClick,
    triggerFall,
    wiggleRefusal,
    dispose() {
      wiggleTween?.kill();
      dustEl?.remove();
      hintEl?.remove();
    },
  };
}
