/**
 * Main-site scroll polish — timeline + section reveals (index.html, all users)
 */
import gsap from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js';
import ScrollTrigger from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollTrigger.js';

const DESKTOP_MIN = 1024;
const SECTION_IDS = ['work', 'experience', 'education', 'skills', 'awards'];

let ctx = null;
let resizeTimer = 0;

function isHomePage() {
  return (
    document.body.classList.contains('page-home') ||
    /index\.html?$/.test(window.location.pathname) ||
    window.location.pathname.endsWith('/')
  );
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isDesktop() {
  return window.innerWidth >= DESKTOP_MIN;
}

function isPlainMode() {
  return document.documentElement.classList.contains('plain-mode');
}

export function initTimelineScroll() {
  if (!isHomePage() || ctx) return;

  if (prefersReducedMotion() || isPlainMode()) {
    applyStaticTimeline();
    initSectionRevealsStatic();
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  ctx = gsap.context(() => {
    initExperienceTimeline();
    initSectionReveals();
    initChapterLabels();
    initTimelineDotGlow();
    initHeroScrollCue();
    initExperienceFootnote();
  });

  window.addEventListener('resize', onResize, { passive: true });
  ScrollTrigger.refresh();
}

function onResize() {
  if (prefersReducedMotion()) return;
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
}

export function destroyTimelineScroll() {
  clearTimeout(resizeTimer);
  window.removeEventListener('resize', onResize);
  if (ctx) {
    ctx.revert();
    ctx = null;
  }
}

function applyStaticTimeline() {
  const section = document.querySelector('#experience');
  if (!section) return;
  section.classList.add('timeline-scroll-active');
  const line = section.querySelector('.timeline');
  if (line) line.style.setProperty('--line-progress', '1');
  section.querySelectorAll('.t-item').forEach((item) => {
    item.classList.add('is-visible');
  });
}

function initSectionRevealsStatic() {
  document.querySelectorAll('main > section.container').forEach((section) => {
    section.classList.add('section-revealed');
  });
}

/* ── Experience — line draw + dot pop + item reveal ── */
function initExperienceTimeline() {
  const section = document.querySelector('#experience');
  if (!section) return;

  const items = gsap.utils.toArray('#experience .t-item');
  const head = section.querySelector('.section-head');
  const line = section.querySelector('.timeline');
  if (!items.length) return;

  section.classList.add('timeline-scroll-active');
  const mobile = !isDesktop();

  if (head) {
    gsap.from(head, {
      y: mobile ? 24 : 32,
      opacity: 0,
      duration: mobile ? 0.65 : 0.85,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: section,
        start: 'top 82%',
        toggleActions: 'play none none none',
      },
    });
  }

  if (line) {
    gsap.from(line, {
      '--line-progress': 0,
      ease: 'none',
      scrollTrigger: {
        trigger: line,
        start: 'top 78%',
        end: 'bottom 22%',
        scrub: mobile ? 0.5 : 0.75,
      },
    });
  }

  items.forEach((item, i) => {
    const card = item.querySelector('.t-card');
    const dot = item.querySelector('.t-dot');
    const fromX = mobile ? 0 : i % 2 === 0 ? -48 : 48;

    gsap.from(item, {
      x: fromX,
      y: mobile ? 20 : 0,
      opacity: 0,
      duration: mobile ? 0.7 : 0.9,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: item,
        start: 'top 92%',
        end: 'top 68%',
        toggleActions: 'play none none none',
        onEnter: () => item.classList.add('is-visible'),
      },
    });

    if (dot) {
      gsap.from(dot, {
        scale: 0,
        opacity: 0,
        duration: 0.45,
        ease: 'back.out(2)',
        scrollTrigger: {
          trigger: item,
          start: 'top 90%',
          toggleActions: 'play none none none',
        },
      });
    }

    if (card && isDesktop()) {
      card.addEventListener('mouseenter', () => item.classList.add('is-hovered'));
      card.addEventListener('mouseleave', () => item.classList.remove('is-hovered'));
    }
  });
}

/* ── Section reveal — once, settles quickly ── */
function initSectionReveals() {
  const sections = gsap.utils.toArray('main > section.container');
  sections.forEach((section) => {
    if (section.id === 'experience') return;
    gsap.from(section, {
      y: 28,
      opacity: 0,
      duration: 0.75,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: section,
        start: 'top 88%',
        toggleActions: 'play none none none',
        onEnter: () => section.classList.add('section-revealed'),
      },
    });
  });
}

/* ── Chapter labels on section headings ── */
function initChapterLabels() {
  SECTION_IDS.forEach((id, i) => {
    const section = document.getElementById(id);
    const h2 = section?.querySelector('.section-head h2');
    if (!h2 || h2.querySelector('.chapter-label')) return;

    const label = document.createElement('span');
    label.className = 'chapter-label';
    label.setAttribute('aria-hidden', 'true');
    label.textContent = String(i + 1).padStart(2, '0');
    h2.prepend(label);

    gsap.from(label, {
      opacity: 0,
      x: -12,
      duration: 0.6,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: section,
        start: 'top 85%',
        toggleActions: 'play none none none',
      },
    });
  });
}

/* ── Cursor-reactive glow on timeline dots (desktop) ── */
function initTimelineDotGlow() {
  if (!isDesktop()) return;

  const section = document.querySelector('#experience');
  const dots = section?.querySelectorAll('.t-dot');
  if (!dots?.length) return;

  let raf = 0;
  let mx = -9999;
  let my = -9999;

  function onMove(e) {
    mx = e.clientX;
    my = e.clientY;
    if (!raf) raf = requestAnimationFrame(updateGlow);
  }

  function updateGlow() {
    raf = 0;
    dots.forEach((dot) => {
      const rect = dot.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(mx - cx, my - cy);
      const glow = Math.max(0, 1 - dist / 120);
      dot.style.setProperty('--dot-glow', glow.toFixed(3));
    });
  }

  section.addEventListener('mousemove', onMove, { passive: true });
  section.addEventListener('mouseleave', () => {
    dots.forEach((dot) => dot.style.setProperty('--dot-glow', '0'));
  });
}

/* ── Hero scroll cue fades with scroll depth ── */
function initHeroScrollCue() {
  const cue = document.querySelector('.scroll-cue');
  const hero = document.querySelector('.hero--fullscreen');
  if (!cue || !hero) return;

  gsap.to(cue, {
    opacity: 0,
    y: -8,
    ease: 'none',
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: 'bottom top',
      scrub: 0.3,
    },
  });
}

/* ── Subtle deadpan footnote in experience ── */
function initExperienceFootnote() {
  const section = document.querySelector('#experience');
  const timeline = section?.querySelector('.timeline');
  if (!section || !timeline || section.querySelector('.timeline-footnote')) return;

  const note = document.createElement('p');
  note.className = 'timeline-footnote muted';
  note.textContent = 'Yes, I kept the timeline. No, it is not a LinkedIn export.';
  timeline.after(note);

  gsap.from(note, {
    opacity: 0,
    y: 12,
    duration: 0.7,
    ease: 'power2.out',
    scrollTrigger: {
      trigger: note,
      start: 'top 94%',
      toggleActions: 'play none none none',
    },
  });
}

if (isHomePage()) {
  initTimelineScroll();
}
