/**
 * Scroll-driven cinematic sections — builder mode only (desktop, index.html)
 */
import gsap from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/index.js';
import ScrollTrigger from 'https://cdn.jsdelivr.net/npm/gsap@3.12.5/ScrollTrigger.js';
import { DESKTOP_MIN } from './builder-mode.js';

let ctx = null;
let resizeTimer = 0;

export function initLaunchScroll() {
  if (ctx) return;

  gsap.registerPlugin(ScrollTrigger);

  ctx = gsap.context(() => {
    initWorkGallery();
    initExperienceTimeline();
    initEducationCards();
    initSkillsReveal();
  });

  window.addEventListener('resize', onResize, { passive: true });
  ScrollTrigger.refresh();
}

function onResize() {
  if (window.innerWidth < DESKTOP_MIN) {
    destroyLaunchScroll();
    return;
  }
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => ScrollTrigger.refresh(), 150);
}

export function destroyLaunchScroll() {
  clearTimeout(resizeTimer);
  window.removeEventListener('resize', onResize);
  if (ctx) {
    ctx.revert();
    ctx = null;
  }
}

/* ── Featured Projects — keynote gallery drift ── */
function initWorkGallery() {
  const section = document.querySelector('#work');
  if (!section) return;

  const grid = section.querySelector('.cards-3');
  const cards = gsap.utils.toArray('#work .cards-3 .card');
  const head = section.querySelector('.section-head');
  if (!grid || !cards.length) return;

  section.classList.add('launch-work');

  if (head) {
    gsap.from(head, {
      y: 48,
      opacity: 0,
      duration: 0.9,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: section,
        start: 'top 78%',
        toggleActions: 'play none none reverse',
      },
    });
  }

  gsap.to(grid, {
    y: -48,
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      scrub: 1.8,
    },
  });

  cards.forEach((card, i) => {
    const dir = i % 2 === 0 ? -1 : 1;
    const lane = i % 3;
    card.classList.add('launch-card');

    gsap.set(card, {
      transformOrigin: '50% 50%',
      willChange: 'transform, opacity',
    });

    gsap.fromTo(
      card,
      {
        opacity: 0,
        y: 140,
        x: dir * 110,
        scale: 0.78,
        rotateY: dir * 14,
        z: -120,
      },
      {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        rotateY: 0,
        z: 0,
        duration: 1.15,
        ease: 'power3.out',
        delay: lane * 0.06,
        scrollTrigger: {
          trigger: card,
          start: 'top 94%',
          end: 'top 58%',
          toggleActions: 'play none none reverse',
        },
      }
    );

    gsap.to(card, {
      x: dir * 36,
      y: -18 - lane * 10,
      scale: 1.06,
      rotateY: dir * -4,
      ease: 'none',
      scrollTrigger: {
        trigger: card,
        start: 'top 88%',
        end: 'bottom 12%',
        scrub: 1.4,
      },
    });

    ScrollTrigger.create({
      trigger: card,
      start: 'center center',
      end: 'center center',
      onEnter: () => card.classList.add('is-spotlight'),
      onLeave: () => card.classList.remove('is-spotlight'),
      onEnterBack: () => card.classList.add('is-spotlight'),
      onLeaveBack: () => card.classList.remove('is-spotlight'),
    });
  });
}

/* ── Experience — cascade timeline ── */
function initExperienceTimeline() {
  const section = document.querySelector('#experience');
  if (!section) return;

  const items = gsap.utils.toArray('#experience .t-item');
  const head = section.querySelector('.section-head');
  const line = section.querySelector('.timeline');
  if (!items.length) return;

  section.classList.add('launch-experience');

  if (head) {
    gsap.from(head, {
      x: -40,
      opacity: 0,
      duration: 0.85,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: section,
        start: 'top 80%',
        toggleActions: 'play none none reverse',
      },
    });
  }

  if (line) {
    gsap.from(line, {
      '--line-progress': 0,
      ease: 'none',
      scrollTrigger: {
        trigger: line,
        start: 'top 75%',
        end: 'bottom 20%',
        scrub: 0.8,
      },
    });
  }

  items.forEach((item, i) => {
    const card = item.querySelector('.t-card');
    const dot = item.querySelector('.t-dot');
    const fromX = i % 2 === 0 ? -80 : 80;

    gsap.set(item, { willChange: 'transform, opacity' });

    gsap.from(item, {
      x: fromX,
      opacity: 0,
      duration: 0.95,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: item,
        start: 'top 90%',
        end: 'top 62%',
        toggleActions: 'play none none reverse',
      },
    });

    if (dot) {
      gsap.from(dot, {
        scale: 0,
        opacity: 0,
        duration: 0.5,
        ease: 'back.out(2.2)',
        scrollTrigger: {
          trigger: item,
          start: 'top 88%',
          toggleActions: 'play none none reverse',
        },
      });
    }

    if (card) {
      gsap.to(card, {
        x: fromX * -0.08,
        ease: 'none',
        scrollTrigger: {
          trigger: item,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 1.2,
        },
      });
    }

    if (i === 2) {
      ScrollTrigger.create({
        trigger: item,
        start: 'top top+=120',
        end: '+=40%',
        pin: item,
        pinSpacing: true,
        anticipatePin: 1,
      });
    }
  });
}

/* ── Education — staggered 3D tilt ── */
function initEducationCards() {
  const section = document.querySelector('#education');
  if (!section) return;

  const cards = gsap.utils.toArray('#education .cards-3 .card');
  const head = section.querySelector('.section-head');
  if (!cards.length) return;

  section.classList.add('launch-education');

  if (head) {
    gsap.from(head, {
      y: 36,
      opacity: 0,
      rotateX: 8,
      transformOrigin: '50% 100%',
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: section,
        start: 'top 78%',
        toggleActions: 'play none none reverse',
      },
    });
  }

  cards.forEach((card, i) => {
    const tilt = (i % 2 === 0 ? -1 : 1) * 6;
    card.classList.add('launch-card');

    gsap.set(card, {
      transformPerspective: 900,
      transformOrigin: '50% 80%',
      willChange: 'transform, opacity',
    });

    gsap.fromTo(
      card,
      {
        opacity: 0,
        y: 90,
        rotateX: 18,
        rotateY: tilt * 2,
        scale: 0.9,
      },
      {
        opacity: 1,
        y: 0,
        rotateX: 0,
        rotateY: 0,
        scale: 1,
        duration: 1,
        ease: 'power3.out',
        delay: i * 0.08,
        scrollTrigger: {
          trigger: card,
          start: 'top 92%',
          end: 'top 60%',
          toggleActions: 'play none none reverse',
        },
      }
    );

    gsap.to(card, {
      y: -12 - (i % 2) * 8,
      rotateX: -4,
      rotateY: tilt,
      ease: 'none',
      scrollTrigger: {
        trigger: card,
        start: 'top 85%',
        end: 'bottom 15%',
        scrub: 1.1,
      },
    });
  });
}

/* ── Skills — scatter-to-grid spec reveal ── */
function initSkillsReveal() {
  const section = document.querySelector('#skills');
  if (!section) return;

  const cards = gsap.utils.toArray('#skills .grid > .card');
  const head = section.querySelector('.section-head');
  if (!cards.length) return;

  section.classList.add('launch-skills');

  if (head) {
    gsap.from(head, {
      opacity: 0,
      y: 32,
      duration: 0.75,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: section,
        start: 'top 80%',
        toggleActions: 'play none none reverse',
      },
    });
  }

  const scatter = [
    { x: -140, y: -60, r: -8 },
    { x: 120, y: 40, r: 6 },
    { x: -90, y: 80, r: -5 },
    { x: 160, y: -30, r: 9 },
    { x: -120, y: 20, r: -7 },
    { x: 100, y: -70, r: 5 },
    { x: -70, y: -40, r: 8 },
  ];

  cards.forEach((card, i) => {
    const s = scatter[i % scatter.length];
    const tags = card.querySelectorAll('.tag');
    card.classList.add('launch-card');

    gsap.set(card, { willChange: 'transform, opacity' });

    gsap.fromTo(
      card,
      {
        opacity: 0,
        x: s.x,
        y: s.y,
        rotate: s.r,
        scale: 0.82,
      },
      {
        opacity: 1,
        x: 0,
        y: 0,
        rotate: 0,
        scale: 1,
        duration: 1.05,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 93%',
          end: 'top 58%',
          toggleActions: 'play none none reverse',
        },
      }
    );

    gsap.to(card, {
      x: (i % 2 === 0 ? -1 : 1) * 14,
      ease: 'none',
      scrollTrigger: {
        trigger: card,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.5,
      },
    });

    if (tags.length) {
      gsap.from(tags, {
        opacity: 0,
        x: (i % 2 === 0 ? -1 : 1) * 28,
        stagger: 0.04,
        duration: 0.55,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: card,
          start: 'top 82%',
          toggleActions: 'play none none reverse',
        },
      });
    }
  });

  ScrollTrigger.create({
    trigger: section.querySelector('.grid'),
    start: 'top 70%',
    end: 'bottom 30%',
    onUpdate: (self) => {
      section.style.setProperty('--skills-scroll', self.progress.toFixed(3));
    },
  });
}
