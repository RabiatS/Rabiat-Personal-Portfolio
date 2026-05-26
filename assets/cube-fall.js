/**
 * Builder cube fall — click-to-drop from panel to footer
 */
import gsap from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js';

const FALL_DURATION = 1.75;
const RESET_DURATION = 1.35;
const AUTO_RESET_DELAY = 6500;
const MANUAL_RESET_COOLDOWN = 2200;
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
    baseMaterialState,
    onFallStart,
    onFallComplete,
    onResetStart,
    onResetComplete,
  } = ctx;

  let state = 'idle'; // idle | falling | landed | resetting
  let dustEl = null;
  let hintEl = null;
  let wiggleTween = null;
  let activeTween = null;
  let autoResetTimer = 0;
  let landedAt = 0;
  let landingFaceIndex = 2;
  let scrollYBeforeFall = 0;
  let fallScale = 1;

  function getFooter() {
    return document.querySelector('footer.footer');
  }

  function computeLandingCoords() {
    const footer = getFooter();
    if (!footer) return null;

    const hostW = host.offsetWidth || 320;
    const hostH = host.offsetHeight || 400;

    const footerDocTop = footer.getBoundingClientRect().top + window.scrollY;
    const landTop = footerDocTop - hostH * 0.72 - 12;
    const landLeft = Math.max(24, window.innerWidth - hostW - 48);

    return { landTop, landLeft, hostW, hostH };
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

  function clearHostInlineStyles() {
    host.style.position = '';
    host.style.top = '';
    host.style.left = '';
    host.style.right = '';
    host.style.width = '';
    host.style.height = '';
  }

  function applyHeavyFeel() {
    materials.forEach((mat) => {
      mat.metalness = Math.min(0.96, mat.metalness + 0.02);
      mat.roughness = Math.max(0.16, mat.roughness - 0.03);
      mat.envMapIntensity = Math.max(mat.envMapIntensity * 0.82, 0.45);
      mat.emissiveIntensity = 0;
    });
    edgeLines.material.opacity = Math.max(edgeLines.material.opacity * 0.85, 0.48);
    glowLines.material.opacity = 0;
  }

  function restoreBaseMaterials() {
    const base = baseMaterialState?.();
    if (!base) return;
    materials.forEach((mat) => {
      mat.metalness = base.metalness;
      mat.roughness = base.roughness;
      mat.envMapIntensity = base.envIntensity;
      mat.emissiveIntensity = 0;
    });
    edgeLines.material.opacity = base.edgeOpacity ?? 0.72;
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
    hintEl = document.createElement('button');
    hintEl.type = 'button';
    hintEl.className = 'builder-cube-heavy-hint';
    hintEl.textContent = 'Too heavy.';
    hintEl.setAttribute('aria-label', 'Too heavy. Click to float the cube back up.');
    host.appendChild(hintEl);
    hintEl.addEventListener('click', (e) => {
      e.stopPropagation();
      hideHeavyHint();
      requestReset();
    });
    return hintEl;
  }

  function showHeavyHint() {
    const el = ensureHintEl();
    el.classList.add('is-visible');
    clearTimeout(showHeavyHint._t);
    showHeavyHint._t = setTimeout(() => el.classList.remove('is-visible'), 2200);
  }

  function hideHeavyHint() {
    hintEl?.classList.remove('is-visible');
    clearTimeout(showHeavyHint._t);
  }

  const IMPACT_SHAKE_MS = 700;

  function microShake() {
    if (prefersReducedMotion) return;
    document.documentElement.classList.add('builder-cube-impact-shake');
    host.classList.add('builder-cube-host--impact-shake');
    setTimeout(() => {
      document.documentElement.classList.remove('builder-cube-impact-shake');
      host.classList.remove('builder-cube-host--impact-shake');
    }, IMPACT_SHAKE_MS);
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
        { emissiveIntensity: i === finalFaceIndex ? 0.05 : 0 },
        { emissiveIntensity: 0, duration: 0.5, ease: 'power2.out' }
      );
    });
  }

  function clearFallClasses() {
    host.classList.remove('builder-cube-host--falling', 'builder-cube-host--landed');
    document.documentElement.classList.remove('builder-cube-fallen');
  }

  function scheduleAutoReset() {
    clearTimeout(autoResetTimer);
    autoResetTimer = window.setTimeout(() => {
      if (state === 'landed') requestReset();
    }, AUTO_RESET_DELAY);
  }

  function finishLanding(coords) {
    state = 'landed';
    landedAt = performance.now();
    host.classList.remove('builder-cube-host--falling');
    host.classList.add('builder-cube-host--landed');
    document.documentElement.classList.add('builder-cube-fallen');
    cubeGroup.scale.setScalar(fallScale);

    const dustX = coords.landLeft + coords.hostW * 0.15;
    const dustY = coords.landTop + coords.hostH * 0.82;
    spawnDust(dustX, dustY);
    microShake();
    settleCube(2);
    onFallComplete?.({ landed: true });
    scheduleAutoReset();
  }

  function instantLand() {
    const coords = computeLandingCoords();
    if (!coords) return;

    scrollYBeforeFall = window.scrollY;
    const startRect = host.getBoundingClientRect();
    fallScale = cubeGroup.scale.x;
    pinHostAbsolute(startRect);
    applyHeavyFeel();
    onFallStart?.();

    host.style.top = `${coords.landTop}px`;
    host.style.left = `${coords.landLeft}px`;

    finishLanding(coords);
  }

  function animateFall() {
    const coords = computeLandingCoords();
    if (!coords) return;

    scrollYBeforeFall = window.scrollY;
    const startRect = host.getBoundingClientRect();
    fallScale = cubeGroup.scale.x;
    pinHostAbsolute(startRect);
    applyHeavyFeel();
    onFallStart?.();

    state = 'falling';

    const proxy = {
      top: startRect.top + window.scrollY,
      left: startRect.left,
      rotY: cube.rotation.y,
      rotX: cube.rotation.x,
      rotZ: cube.rotation.z,
    };

    const tumbleRotY = proxy.rotY + Math.PI * 2.4;
    const tumbleRotX = proxy.rotX + Math.PI * 0.85;

    activeTween?.kill();
    activeTween = gsap.timeline({
      onComplete: () => {
        activeTween = null;
        finishLanding(coords);
      },
    });

    activeTween.to(
      proxy,
      {
        top: coords.landTop,
        left: coords.landLeft,
        rotY: tumbleRotY,
        rotX: tumbleRotX,
        rotZ: proxy.rotZ + Math.PI * 0.35,
        duration: FALL_DURATION,
        ease: 'power3.in',
        onUpdate: () => {
          host.style.top = `${proxy.top}px`;
          host.style.left = `${proxy.left}px`;
          cube.rotation.y = proxy.rotY;
          cube.rotation.x = proxy.rotX;
          cube.rotation.z = proxy.rotZ;
        },
      },
      0
    );
  }

  function requestReset() {
    if (state !== 'landed') return false;
    clearTimeout(autoResetTimer);
    hideHeavyHint();
    if (prefersReducedMotion) {
      instantReset();
      return true;
    }
    animateReset();
    return true;
  }

  function instantReset() {
    state = 'resetting';
    onResetStart?.();
    clearFallClasses();
    clearHostInlineStyles();
    restoreBaseMaterials();
    cubeGroup.scale.setScalar(fallScale);
    state = 'idle';
    onResetComplete?.();
  }

  function animateReset() {
    const coords = computeLandingCoords();
    if (!coords) {
      instantReset();
      return;
    }

    state = 'resetting';
    onResetStart?.();

    const hostTop = parseFloat(host.style.top) || coords.landTop;
    const hostLeft = parseFloat(host.style.left) || coords.landLeft;
    const headerHeight =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 64;
    const fixedWidth = host.offsetWidth || Math.min(window.innerWidth * 0.28, 360);
    const targetLeft = Math.max(0, window.innerWidth - fixedWidth);
    const endTop = scrollYBeforeFall + headerHeight;

    const proxy = {
      top: hostTop,
      left: hostLeft,
      rotY: cube.rotation.y,
      rotX: cube.rotation.x,
      rotZ: cube.rotation.z,
    };

    activeTween?.kill();
    activeTween = gsap.timeline({
      onComplete: () => {
        activeTween = null;
        clearFallClasses();
        clearHostInlineStyles();
        restoreBaseMaterials();
        cubeGroup.scale.setScalar(fallScale);
        cubeGroup.rotation.x = -0.12;
        state = 'idle';
        onResetComplete?.();
      },
    });

    activeTween.to(
      proxy,
      {
        top: endTop,
        left: targetLeft,
        rotY: proxy.rotY - Math.PI * 0.35,
        rotX: 0.48,
        rotZ: 0,
        duration: RESET_DURATION,
        ease: 'power2.inOut',
        onUpdate: () => {
          host.style.top = `${proxy.top}px`;
          host.style.left = `${proxy.left}px`;
          cube.rotation.y = proxy.rotY;
          cube.rotation.x = proxy.rotX;
          cube.rotation.z = proxy.rotZ;
        },
      },
      0
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
      if (performance.now() - landedAt >= MANUAL_RESET_COOLDOWN) {
        return requestReset();
      }
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
    get isResetting() {
      return state === 'resetting';
    },
    handleClick,
    triggerFall,
    requestReset,
    wiggleRefusal,
    dispose() {
      clearTimeout(autoResetTimer);
      activeTween?.kill();
      wiggleTween?.kill();
      dustEl?.remove();
      hintEl?.remove();
    },
  };
}
