/**
 * Builder-mode scroll extras — toned down (desktop, unlocked only)
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

/* ── Featured Projects — quick staggered settle (no flying parallax) ── */
function initWorkGallery() {
  const section = document.querySelector('#work');
  if (!section) return;

  const cards = gsap.utils.toArray('#work .cards-3 .card');
  const head = section.querySelector('.section-head');
  if (!cards.length) return;

  section.classList.add('launch-work');

  if (head) {
    gsap.from(head, {
      y: 32,
      opacity: 0,
      duration: 0.7,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: section,
        start: 'top 80%',
        toggleActions: 'play none none none',
      },
    });
  }

  cards.forEach((card, i) => {
    card.classList.add('launch-card');

    gsap.from(card, {
      opacity: 0,
      y: 36,
      duration: 0.65,
      ease: 'power2.out',
      delay: i * 0.07,
      scrollTrigger: {
        trigger: card,
        start: 'top 92%',
        toggleActions: 'play none none none',
      },
    });
  });
}

/* ── Education — simple fade stagger (3D tilt retired) ── */
function initEducationCards() {
  const section = document.querySelector('#education');
  if (!section) return;

  const cards = gsap.utils.toArray('#education .cards-3 .card');
  const head = section.querySelector('.section-head');
  if (!cards.length) return;

  section.classList.add('launch-education');

  if (head) {
    gsap.from(head, {
      y: 24,
      opacity: 0,
      duration: 0.65,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: section,
        start: 'top 80%',
        toggleActions: 'play none none none',
      },
    });
  }

  cards.forEach((card, i) => {
    card.classList.add('launch-card');

    gsap.from(card, {
      opacity: 0,
      y: 28,
      duration: 0.6,
      ease: 'power2.out',
      delay: i * 0.06,
      scrollTrigger: {
        trigger: card,
        start: 'top 93%',
        toggleActions: 'play none none none',
      },
    });
  });
}

/* ── Skills — gentle grid fade (scatter retired) ── */
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
      y: 24,
      duration: 0.65,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: section,
        start: 'top 82%',
        toggleActions: 'play none none none',
      },
    });
  }

  cards.forEach((card, i) => {
    card.classList.add('launch-card');

    gsap.from(card, {
      opacity: 0,
      y: 24,
      duration: 0.55,
      ease: 'power2.out',
      delay: (i % 3) * 0.05,
      scrollTrigger: {
        trigger: card,
        start: 'top 94%',
        toggleActions: 'play none none none',
      },
    });
  });
}
