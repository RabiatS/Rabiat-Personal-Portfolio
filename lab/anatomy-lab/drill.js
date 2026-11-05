// Find it drill: the lab names a structure, you tap it on the model. Scores are kept with ctx.store.
export function findDrill(ctx, v, { key, pool, title = 'Find it', blurb = 'Tap the named structure on the model.', accept, onAsk }) {
  const el = ctx.h(`<div class="card"><h3>${ctx.esc(title)}</h3><p class="small muted">${ctx.esc(blurb)}</p>
    <p class="fq anat-big" style="margin:2px 0;color:var(--c1)"></p>
    <div class="row"><button class="btn sm fs">Start</button><button class="btn ghost sm fk" hidden>Skip</button><button class="btn ghost sm fh" hidden>Show me</button><span class="hint fm" style="flex:1;text-align:right"></span></div></div>`);
  const q = el.querySelector('.fq'); const msg = el.querySelector('.fm');
  const bs = el.querySelector('.fs'); const bk = el.querySelector('.fk'); const bh = el.querySelector('.fh');
  let best = ctx.store.get(`find:${key}`, 0);
  let cur = null; let streak = 0; let tries = 0; let active = false; let asked = 0; let right = 0;
  const show = () => { msg.textContent = active ? `${right} of ${asked} · streak ${streak}${best ? ` · best ${best}` : ''}` : (best ? `best streak ${best}` : ''); };
  show();
  const next = () => {
    const list = pool().filter((p) => p !== cur);
    if (!list.length) return;
    cur = list[Math.floor(Math.random() * list.length)]; tries = 0; asked++;
    q.textContent = `Find the ${cur.item.name.toLowerCase()}`;
    onAsk && onAsk(cur);
    show();
  };
  bs.addEventListener('click', () => { active = true; streak = 0; asked = 0; right = 0; bs.textContent = 'Restart'; bk.hidden = false; bh.hidden = false; next(); });
  bk.addEventListener('click', () => { streak = 0; next(); });
  bh.addEventListener('click', () => {
    if (!cur) return;
    cur.pv.highlight(cur.item.k); streak = 0; tries = 3;
    v.labels = [{ pos: cur.pv.worldCenter(cur.item), text: cur.item.name, color: '#5EEAD4', on: true }]; v.dirty = true;
    msg.textContent = 'Here it is. Press skip for the next one.';
  });
  return {
    el,
    get active() { return active; },
    // returns true when the tap was used by the drill
    handle(h) {
      if (!active || !cur) return false;
      if (!h) return true;
      const ok = accept ? accept(h, cur) : (h.item === cur.item);
      for (const pv of Object.values(v.packs)) pv.highlight(-1);
      if (h.pv) h.pv.highlight(h.item.k);
      if (ok) {
        if (tries < 3) { right++; streak++; if (streak > best) { best = streak; ctx.store.set(`find:${key}`, best); } }
        msg.textContent = `Yes, that is the ${cur.item.name.toLowerCase()}.`;
        v.labels = [{ pos: h.point, text: h.item.name, color: '#4ade80', on: true }];
        setTimeout(() => { if (active) { v.labels = []; next(); } }, 1100);
      } else {
        tries++; streak = 0;
        v.labels = [{ pos: h.point, text: `That is the ${h.item.name.toLowerCase()}`, color: '#A78BFA' }];
        msg.textContent = tries >= 2 ? 'Not that one. Try "Show me" if you are stuck.' : 'Not that one. Try again.';
      }
      v.dirty = true;
      return true;
    },
  };
}

// Name it: a structure lights up, pick its name from four.
export function nameDrill(ctx, v, { key, pool, title = 'Name it', distract }) {
  const el = ctx.h(`<div class="card"><h3>${ctx.esc(title)}</h3><p class="small muted">One structure lights up. Pick its name.</p><div class="choices nc"></div><div class="row"><button class="btn sm ns">Start</button><span class="hint nm" style="flex:1;text-align:right"></span></div></div>`);
  const nc = el.querySelector('.nc'); const nm = el.querySelector('.nm');
  let right = 0; let total = 0;
  const ask = () => {
    const list = pool(); if (list.length < 4) return;
    const cur = list[Math.floor(Math.random() * list.length)];
    for (const pv of Object.values(v.packs)) pv.highlight(-1);
    cur.pv.highlight(cur.item.k);
    v.labels = [{ pos: cur.pv.worldCenter(cur.item), text: '?', color: '#5EEAD4', on: true }];
    const names = new Set([cur.item.name]);
    const others = (distract ? distract(cur, list) : list).filter((x) => x.item.name !== cur.item.name).sort(() => Math.random() - 0.5);
    for (const o of others) { if (names.size >= 4) break; names.add(o.item.name); }
    const ch = [...names].sort(() => Math.random() - 0.5);
    nc.innerHTML = ch.map((n) => `<button class="choice">${ctx.esc(n)}</button>`).join('');
    nc.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => {
      const ok = b.textContent === cur.item.name; total++; if (ok) right++;
      nc.querySelectorAll('.choice').forEach((x) => { x.disabled = true; if (x.textContent === cur.item.name) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      v.labels = [{ pos: cur.pv.worldCenter(cur.item), text: cur.item.name, color: ok ? '#4ade80' : '#A78BFA', on: true }]; v.dirty = true;
      nm.textContent = `${right} of ${total}`;
      ctx.store.set(`name:${key}`, { right, total });
      setTimeout(ask, 1300);
    }));
    v.dirty = true;
    return cur;
  };
  el.querySelector('.ns').addEventListener('click', (e) => { e.target.textContent = 'New one'; ask(); });
  return { el, ask };
}
