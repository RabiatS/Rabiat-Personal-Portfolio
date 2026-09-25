// Rabiat Kit behaviour: (i) popovers and a small toast. Load with <script src defer>.
(() => {
  // (i) buttons: <div class="info"><button class="info-btn" aria-controls="x">i</button><div class="pop" id="x" hidden>…</div></div>
  document.querySelectorAll('.info-btn').forEach((btn) => {
    const pop = document.getElementById(btn.getAttribute('aria-controls'));
    if (!pop) return;
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = pop.hidden;
      document.querySelectorAll('.pop').forEach((p) => { p.hidden = true; });
      document.querySelectorAll('.info-btn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      pop.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
    });
    pop.addEventListener('click', (e) => e.stopPropagation());
  });
  const closeAll = () => {
    document.querySelectorAll('.pop').forEach((p) => { p.hidden = true; });
    document.querySelectorAll('.info-btn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  };
  document.addEventListener('click', closeAll);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAll(); });

  let toastTimer = 0;
  window.rkToast = (text) => {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  };
})();
