// Brain Gym: shared helpers. Best scores stay on this device.
const KEY = 'rabiat-gym-v1';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };

export const best = {
  get: (id) => read()[id] ?? null,
  // keeps the higher score; returns true when this one is a new best
  offer(id, score) {
    const all = read(), prev = all[id];
    if (prev != null && prev >= score) return false;
    all[id] = score;
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
    return prev != null;
  },
};

export function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

// progress bar of n dots; mark(i, 'ok' | 'no'), at(i) highlights the current one
export function dots(el, n) {
  el.innerHTML = '<i></i>'.repeat(n);
  const all = [...el.children];
  return {
    at(i) { all.forEach((d, k) => d.classList.toggle('now', k === i && !d.classList.contains('ok') && !d.classList.contains('no'))); },
    mark(i, state) { all[i].classList.remove('now'); all[i].classList.add(state); },
  };
}

// result screen: { big, of, line, bench: { title, text, src }, again }
export function showResult(card, { big, of, line, bench, again }) {
  card.innerHTML = `
    <div class="gym-result">
      <div class="big">${big}${of ? `<small> / ${of}</small>` : ''}</div>
      <div class="line"></div>
      ${bench ? '<div class="bench"><h4></h4><div class="txt"></div><div class="src"></div></div>' : ''}
      <div class="acts">
        <button class="btn primary lg" data-again>Go again</button>
        <a class="btn quiet lg" href="https://www.rabiatsadiq.com/cool.html#brain-gym">More exercises</a>
      </div>
    </div>`;
  card.querySelector('.line').textContent = line || '';
  if (bench) {
    card.querySelector('.bench h4').textContent = bench.title;
    card.querySelector('.bench .txt').textContent = bench.text;
    card.querySelector('.bench .src').textContent = bench.src || '';
  }
  card.querySelector('[data-again]').addEventListener('click', again);
  card.querySelector('[data-again]').focus();
}

export const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
