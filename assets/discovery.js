/**
 * Signal Lab — hidden discovery on index.html
 * Discovery: type "build" on homepage, or triple-tap scroll cue on mobile
 * Unlock URL: ?lab=1
 * Persist: localStorage signalLabUnlocked
 */
(function () {
  const STORAGE_KEY = 'signalLabUnlocked';
  const HINT_KEY = 'signalLabHintShown';
  const SECRET = 'build';
  const COLORS = {
    void: '#0a0a0f',
    bloodline: '#b81e2c',
    teal: '#4a8f8f',
    mist: '#ececee',
  };

  function isHomePage() {
    return (
      document.body.classList.contains('page-home') ||
      /index\.html?$/.test(window.location.pathname) ||
      window.location.pathname.endsWith('/')
    );
  }

  if (!isHomePage()) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  let portal = null;
  let canvas = null;
  let ctx = null;
  let rafId = null;
  let particles = [];
  let mouse = { x: 0.5, y: 0.5, active: false };
  let time = 0;
  let lastFocus = null;
  let open = false;

  function applyUrlUnlock() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('lab') === '1') {
      localStorage.setItem(STORAGE_KEY, 'true');
      params.delete('lab');
      const next = params.toString();
      history.replaceState(
        {},
        '',
        window.location.pathname + (next ? `?${next}` : '') + window.location.hash
      );
      queueMicrotask(openLab);
    }
  }

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function buildPortal() {
    portal = document.createElement('div');
    portal.id = 'signalLab';
    portal.className = 'signal-lab';
    portal.setAttribute('aria-hidden', 'true');
    portal.innerHTML = `
      <div class="signal-lab__backdrop" data-signal-close tabindex="-1" aria-hidden="true"></div>
      <div class="signal-lab__panel" role="dialog" aria-modal="true" aria-labelledby="signalLabTitle">
        <canvas class="signal-lab__canvas" aria-hidden="true"></canvas>
        <div class="signal-lab__hud">
          <p class="signal-lab__kicker">Signal Lab</p>
          <p class="signal-lab__copy" id="signalLabTitle">You found the lab. It does not ship.</p>
          <p class="signal-lab__hint">Esc to leave · click outside works too</p>
        </div>
        <button type="button" class="signal-lab__close" data-signal-close aria-label="Close Signal Lab">×</button>
      </div>
    `;
    document.body.appendChild(portal);

    canvas = portal.querySelector('.signal-lab__canvas');
    ctx = canvas.getContext('2d');

    portal.querySelectorAll('[data-signal-close]').forEach((el) => {
      el.addEventListener('click', closeLab);
    });

    canvas.addEventListener('mousemove', onPointerMove);
    canvas.addEventListener('mouseleave', () => {
      mouse.active = false;
    });

    canvas.addEventListener(
      'touchmove',
      (e) => {
        if (!open || !e.touches[0]) return;
        const rect = canvas.getBoundingClientRect();
        mouse.x = (e.touches[0].clientX - rect.left) / rect.width;
        mouse.y = (e.touches[0].clientY - rect.top) / rect.height;
        mouse.active = true;
      },
      { passive: true }
    );

    canvas.addEventListener('touchend', () => {
      mouse.active = false;
    });
  }

  function initParticles(count) {
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0008,
        vy: (Math.random() - 0.5) * 0.0008,
        r: 1 + Math.random() * 2.2,
        phase: Math.random() * Math.PI * 2,
        accent: Math.random() > 0.55 ? COLORS.teal : COLORS.bloodline,
      });
    }
  }

  function resizeCanvas() {
    if (!canvas || !portal) return;
    const panel = portal.querySelector('.signal-lab__panel');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = panel.clientWidth;
    const h = panel.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function onPointerMove(e) {
    if (!open) return;
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width;
    mouse.y = (e.clientY - rect.top) / rect.height;
    mouse.active = true;
  }

  function drawFrame() {
    if (!ctx || !canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.fillStyle = COLORS.void;
    ctx.fillRect(0, 0, w, h);

    const mx = mouse.x * w;
    const my = mouse.y * h;
    const t = time;

    if (!reducedMotion) {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;

        if (mouse.active) {
          const px = p.x * w;
          const py = p.y * h;
          const dx = mx - px;
          const dy = my - py;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 140) {
            const force = (140 - dist) / 140;
            p.vx -= (dx / dist) * force * 0.00035;
            p.vy -= (dy / dist) * force * 0.00035;
          }
        }
      }
    }

    ctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const ax = a.x * w;
        const ay = a.y * h;
        const bx = b.x * w;
        const by = b.y * h;
        const d = Math.hypot(ax - bx, ay - by);
        if (d > 120) continue;
        const alpha = (1 - d / 120) * 0.22;
        ctx.strokeStyle = `rgba(74, 143, 143, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }
    }

    for (const p of particles) {
      const px = p.x * w;
      const py = p.y * h;
      const pulse = reducedMotion ? 1 : 0.7 + Math.sin(t * 0.002 + p.phase) * 0.3;
      ctx.beginPath();
      ctx.fillStyle = p.accent;
      ctx.globalAlpha = 0.55 * pulse;
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    const waveY = h * 0.62;
    const ampBase = h * 0.06;
    const amp = ampBase * (mouse.active ? 1.35 : 1);
    const freq = 0.012 + (mouse.active ? mouse.x * 0.018 : 0.004);

    ctx.strokeStyle = COLORS.bloodline;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const y =
        waveY +
        Math.sin(x * freq + t * 0.003) * amp +
        Math.sin(x * freq * 2.4 + t * 0.005) * amp * 0.35;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = COLORS.teal;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 2) {
      const y =
        waveY +
        Math.sin(x * freq * 1.6 + t * 0.004 + 1.2) * amp * 0.55 +
        Math.cos(x * 0.008 + t * 0.002) * amp * 0.2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (mouse.active && !reducedMotion) {
      ctx.strokeStyle = 'rgba(236, 236, 238, 0.15)';
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx, h);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = COLORS.mist;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(mx, my, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function tick() {
    if (!open) return;
    time += 16;
    drawFrame();
    if (!reducedMotion) {
      rafId = requestAnimationFrame(tick);
    }
  }

  function startRender() {
    resizeCanvas();
    initParticles(isMobile ? 48 : reducedMotion ? 60 : 110);
    drawFrame();
    if (!reducedMotion) {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    }
  }

  function stopRender() {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  function openLab() {
    if (open) return;
    if (!portal) buildPortal();

    localStorage.setItem(STORAGE_KEY, 'true');
    open = true;
    lastFocus = document.activeElement;

    portal.classList.add('is-open');
    portal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    startRender();

    const closeBtn = portal.querySelector('.signal-lab__close');
    if (closeBtn) closeBtn.focus();
  }

  function closeLab() {
    if (!open || !portal) return;
    open = false;
    stopRender();

    portal.classList.remove('is-open');
    portal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus();
    }
  }

  function showReturnHint() {
    if (localStorage.getItem(STORAGE_KEY) !== 'true') return;
    if (localStorage.getItem(HINT_KEY) === 'true') return;

    localStorage.setItem(HINT_KEY, 'true');

    const toast = document.createElement('div');
    toast.className = 'signal-lab-toast';
    toast.textContent = 'You know where to look.';
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('is-visible');
    });

    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 500);
    }, 4200);
  }

  let keyBuffer = '';

  document.addEventListener('keydown', (e) => {
    if (isTypingTarget(document.activeElement)) return;
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      closeLab();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key.length !== 1) return;

    keyBuffer = (keyBuffer + e.key.toLowerCase()).slice(-SECRET.length);
    if (keyBuffer === SECRET) {
      keyBuffer = '';
      openLab();
    }
  });

  let scrollCueTaps = 0;
  let scrollCueTimer = null;

  function bindMobileTrigger() {
    const cue = document.querySelector('.scroll-cue');
    if (!cue) return;

    cue.addEventListener('click', (e) => {
      scrollCueTaps += 1;
      clearTimeout(scrollCueTimer);
      scrollCueTimer = setTimeout(() => {
        scrollCueTaps = 0;
      }, 900);

      if (scrollCueTaps >= 3) {
        scrollCueTaps = 0;
        e.preventDefault();
        openLab();
      }
    });
  }

  window.addEventListener('resize', () => {
    if (open) startRender();
  });

  applyUrlUnlock();
  bindMobileTrigger();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(showReturnHint, 2800);
    });
  } else {
    setTimeout(showReturnHint, 2800);
  }
})();
