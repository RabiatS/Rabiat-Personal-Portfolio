// Looping preview clips on Lab and Playground cards: <video data-preview preload="none" poster="…">.
// A clip loads and plays only while most of it is on screen, and pauses when it scrolls away.
// With reduced motion or data saver on, the poster stays and nothing downloads.
(function () {
  const vids = document.querySelectorAll('video[data-preview]');
  if (!vids.length) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData;
  if (still || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }
  }, { threshold: 0.4 });
  vids.forEach((v) => { v.muted = true; io.observe(v); });
})();
