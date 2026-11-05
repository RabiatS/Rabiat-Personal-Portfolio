/**
 * Spotlight rotator: homepage only.
 *
 * Cycles a wide card above the featured grid through projects that have an
 * image but did not make the featured six, so work like the Multimodal Pipeline
 * still gets airtime without adding a seventh permanent slot.
 *
 * Data comes from assets/projects.json (same source as the projects page). If
 * the fetch fails (file://), the card simply stays hidden.
 */
(function () {
  const root = document.getElementById('spotlight');
  if (!root) return;

  const imgEl = document.getElementById('spotlightImg');
  const titleEl = document.getElementById('spotlightTitle');
  const descEl = document.getElementById('spotlightDesc');
  const dotsEl = document.getElementById('spotlightDots');

  const INTERVAL = 6000;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Already shown as permanent cards in the featured grid.
  const FEATURED_IDS = new Set([
    'amazon-music-capstone',
    'perspective',
    'magic-mitts',
    'assuage',
    'vr-music-visualizer',
    'xr-pain-perception',
  ]);

  let items = [];
  let index = 0;
  let timer = null;
  // Rotate (and so fetch new images) only while the card is on screen, the tab is visible and nobody is hovering it.
  let onScreen = false;
  let paused = false;

  function destinationFor(p) {
    return p.caseStudy || p.demo || p.github || 'projects.html#' + p.id;
  }

  function render(i, animate) {
    const p = items[i];
    if (!p) return;

    const apply = () => {
      imgEl.src = p.images[0];
      imgEl.alt = p.title;
      titleEl.textContent = p.title;
      descEl.textContent = p.description || p.subtitle || '';
      root.href = destinationFor(p);
      Array.from(dotsEl.children).forEach((d, n) => {
        d.classList.toggle('is-active', n === i);
      });
      imgEl.classList.remove('is-fading');
    };

    if (animate && !reduceMotion) {
      imgEl.classList.add('is-fading');
      setTimeout(apply, 300);
    } else {
      apply();
    }
  }

  function advance() {
    index = (index + 1) % items.length;
    render(index, true);
  }

  function start() {
    if (reduceMotion || items.length < 2 || timer || !onScreen || paused || document.hidden) return;
    timer = setInterval(advance, INTERVAL);
  }

  function stop() {
    clearInterval(timer);
    timer = null;
  }

  function build(projects) {
    items = projects.filter(
      (p) =>
        p.status !== 'template' &&
        !FEATURED_IDS.has(p.id) &&
        Array.isArray(p.images) &&
        p.images.length > 0 &&
        p.images[0]
    );

    if (!items.length) return;

    dotsEl.innerHTML = '';
    items.forEach(() => {
      const dot = document.createElement('span');
      dot.className = 'spotlight-dot';
      dotsEl.appendChild(dot);
    });

    root.hidden = false;
    render(0, false);

    // Pause while the visitor is reading or interacting with it.
    const pause = () => { paused = true; stop(); };
    const resume = () => { paused = false; start(); };
    root.addEventListener('mouseenter', pause);
    root.addEventListener('mouseleave', resume);
    root.addEventListener('focus', pause);
    root.addEventListener('blur', resume);
    document.addEventListener('visibilitychange', () => {
      document.hidden ? stop() : start();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        onScreen = entries[entries.length - 1].isIntersecting;
        onScreen ? start() : stop();
      }).observe(root);
    } else {
      onScreen = true;
      start();
    }
  }

  fetch('assets/projects.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data && Array.isArray(data.projects)) build(data.projects);
    })
    .catch(() => {
      /* file:// or offline, leave the spotlight hidden. */
    });
})();
