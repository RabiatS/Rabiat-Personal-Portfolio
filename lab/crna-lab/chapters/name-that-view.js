// Name that view: real laryngoscopy and endoscopy media from Wikimedia Commons (each under its own open licence, credited
// under every item and in the about popover). Pick the diagnosis from four choices; misses are tracked per diagnosis.
import { esc, loadMedia, mediaUrl, shuffle, disclaimerCard } from '../shared.js';

// Names used as distractors, so every round has four choices even when the media set is small
const NAMES = ['Normal larynx', 'Vocal fold nodules', 'Vocal fold polyp', 'Vocal fold cyst', 'Recurrent respiratory papillomatosis', 'Vocal fold paralysis', "Reinke's edema", 'Laryngeal granuloma', 'Laryngeal cancer', 'Laryngomalacia', 'Epiglottitis', 'Subglottic stenosis', 'Laryngeal web'];

export default {
  async mount(ctx) {
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Name that view</h2>'),
      ctx.h('<p class="lede">Real endoscopic views of the larynx. Look, decide, then read why. The ones you miss come back more often.</p>'),
    );
    const scoreCard = ctx.h('<div class="card"><span class="eyebrow">Score</span><div class="stat"><div><span>Right</span><b class="r">0</b></div><div><span>Seen</span><b class="n">0</b></div><div><span>Streak</span><b class="s">0</b></div></div><div class="misses" style="display:grid;gap:5px;margin-top:10px"></div><button class="btn ghost sm reset" style="justify-self:start;margin-top:8px">Reset misses</button></div>');
    const setNote = ctx.h('<p class="small muted"></p>');
    ctx.panel.append(scoreCard, setNote,
      ctx.h('<div class="card tip"><p>Laryngoscopy pictures are read like a map. Find the epiglottis (anterior), the arytenoids (posterior), and the two pale vocal folds between them. Then ask: are both folds smooth, straight and moving? Is something sitting on them, hanging from them, or narrowing the airway above or below?</p><p>Mind the orientation. Through a laryngoscope from behind the head, the epiglottis is at the top and the arytenoids at the bottom. Many ENT pictures, taken with the patient sitting up facing the examiner, are the other way round. Find the arytenoids first.</p><p>Nodules are usually small, paired and at the junction of the front and middle thirds. Polyps and cysts are usually one sided. Papillomas look like clusters of grapes. A paralysed fold does not move and may sit near the midline.</p></div>'),
      ctx.h('<div class="card try"><ol><li>Before choosing, name the landmarks out loud: epiglottis, folds, arytenoids.</li><li>After each answer, read the teaching note and look again at the picture.</li><li>Play until your miss list is short, then reset it and play again tomorrow.</li></ol></div>'),
      ctx.h(`<details class="more"><summary>Going deeper: why these matter in anesthesia</summary><div>
        <p class="small">Most of these lesions are found by ENT teams with a flexible scope or stroboscopy, but they change anesthesia plans: large polyps, papillomas, tumours and webs narrow the glottis and can need a smaller tube or jet ventilation; subglottic stenosis can stop a tube that passes the cords; epiglottitis is an airway emergency where examination and anxiety can trigger complete obstruction; and a paralysed cord may be a sign of recurrent laryngeal nerve injury after neck or chest surgery.</p>
        <p class="small">Each image or clip is from Wikimedia Commons under the licence shown in its caption. Videos were shortened and re-encoded without audio; images were resized. Nothing else was changed.</p>
      </div></details>`),
      disclaimerCard(ctx.h),
    );

    const wrap = ctx.h('<div class="lg-wrap"><div class="lg-media"></div><div class="lg-bottom" style="display:grid;gap:8px"><p class="lg-cap"></p><div class="lg-q" style="font:700 18px var(--f-display);text-transform:uppercase;letter-spacing:.03em">What is this?</div><div class="lg-choices"></div><div class="lg-fb small"></div><div class="row"><button class="btn sm lg-next">Next</button></div></div></div>');
    ctx.stage.append(wrap);
    ctx.tall();
    const media = wrap.querySelector('.lg-media'); const cap = wrap.querySelector('.lg-cap'); const choices = wrap.querySelector('.lg-choices'); const fb = wrap.querySelector('.lg-fb');

    let data;
    try { data = await loadMedia(); } catch { data = { items: [] }; }
    if (ctx.signal.aborted) return;
    const items = (data.items || []).filter((it) => it.file && it.diagnosis && it.license && it.author && it.source);
    if (!items.length) {
      media.innerHTML = '<div class="k-loading">The media set did not load.</div>';
      wrap.querySelector('.lg-bottom').hidden = true;
      return;
    }
    const dx = [...new Set(items.map((it) => it.diagnosis))];
    setNote.textContent = `This set has ${items.length} openly licensed item${items.length === 1 ? '' : 's'} covering ${dx.length} diagnos${dx.length === 1 ? 'is' : 'es'}: ${dx.join(', ')}. ${data.note || ''}`;

    const S = ctx.store.get('ntv:score', { r: 0, n: 0 });
    const miss = ctx.store.get('ntv:miss', {});
    let streak = 0; let cur = null; let last = null; let answered = false;
    function showScore() {
      scoreCard.querySelector('.r').textContent = S.r; scoreCard.querySelector('.n').textContent = S.n; scoreCard.querySelector('.s').textContent = streak;
      const top = Object.entries(miss).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const mx = Math.max(1, ...top.map(([, v]) => v));
      scoreCard.querySelector('.misses').innerHTML = top.length ? `<span class="eyebrow">Missed most</span>${top.map(([k, v]) => `<div class="missrow"><span>${esc(k)}</span><i style="width:${(v / mx) * 100}%"></i><span>${v}</span></div>`).join('')}` : '<span class="hint">No misses yet.</span>';
    }
    scoreCard.querySelector('.reset').addEventListener('click', () => { for (const k of Object.keys(miss)) delete miss[k]; ctx.store.set('ntv:miss', miss); showScore(); });

    function pickItem() {
      // weight items by how often their diagnosis was missed
      const w = items.map((it) => (it === last && items.length > 1 ? 0 : 1 + 2 * (miss[it.diagnosis] || 0)));
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
      return items[0];
    }
    // Credit is always shown; the file title (which often names the diagnosis) appears once the round is answered
    function setCap(reveal) {
      const lic = cur.licenseUrl ? `<a href="${esc(cur.licenseUrl)}" target="_blank" rel="noopener">${esc(cur.license)}</a>` : esc(cur.license);
      const what = reveal ? `<a href="${esc(cur.source)}" target="_blank" rel="noopener">${esc(cur.title)}</a>` : `<a href="${esc(cur.source)}" target="_blank" rel="noopener" title="Opens the file page, which names the diagnosis">${cur.kind === 'video' ? 'Video' : 'Image'}</a>`;
      cap.innerHTML = `${what} by ${esc(cur.author)}, ${lic}, via Wikimedia Commons${cur.modified ? `. ${esc(cur.modified)}` : ''}${reveal ? '' : '. The file name shows after you answer.'}`;
    }
    function round() {
      cur = pickItem(); last = cur; answered = false;
      const isVid = /\.(mp4|webm)$/i.test(cur.file);
      media.innerHTML = isVid
        ? `<video src="${esc(mediaUrl(cur.file))}" autoplay muted loop playsinline aria-label="Laryngoscopy video"></video>`
        : `<img src="${esc(mediaUrl(cur.file))}" alt="Laryngoscopy view to identify" draggable="false">`;
      const vid = media.querySelector('video'); if (vid) vid.play().catch(() => {});
      const img = media.querySelector('img');
      if (img) img.addEventListener('load', () => { img.style.maxWidth = `min(100%, ${Math.round(img.naturalWidth * 2.2)}px)`; img.style.maxHeight = `min(100%, ${Math.round(img.naturalHeight * 2.2)}px)`; });
      setCap(false);
      const others = shuffle([...new Set([...dx, ...NAMES])].filter((n) => n !== cur.diagnosis && !(cur.notWith || []).includes(n)));
      // prefer distractors that are in the media set, so choices stay plausible
      const pool = [...others.filter((n) => dx.includes(n)), ...others.filter((n) => !dx.includes(n))].slice(0, 3);
      const opts = shuffle([cur.diagnosis, ...pool]);
      choices.innerHTML = '';
      for (const o of opts) {
        const b = ctx.h(`<button class="choice">${esc(o)}</button>`);
        b.addEventListener('click', () => answer(o, b));
        choices.append(b);
      }
      fb.innerHTML = ''; wrap.querySelector('.lg-next').hidden = true;
    }
    function answer(o, b) {
      if (answered) return; answered = true;
      const ok = o === cur.diagnosis; S.n++;
      if (ok) { S.r++; streak++; if (streak >= 8) ctx.done(); } else { streak = 0; miss[cur.diagnosis] = (miss[cur.diagnosis] || 0) + 1; b.classList.add('wrong'); }
      ctx.store.set('ntv:score', S); ctx.store.set('ntv:miss', miss);
      choices.querySelectorAll('.choice').forEach((x) => { x.disabled = true; if (x.textContent === cur.diagnosis) x.classList.add('right'); });
      fb.innerHTML = `<div class="fb ${ok ? 'ok' : 'bad'}">${ok ? 'Right.' : `It is ${esc(cur.diagnosis.toLowerCase())}.`} ${esc(cur.note)}</div>`;
      wrap.querySelector('.lg-next').hidden = false;
      setCap(true);
      showScore();
    }
    wrap.querySelector('.lg-next').addEventListener('click', round);
    showScore(); round();

    ctx.quiz([
      { q: 'Small, paired swellings at the junction of the anterior and middle thirds of both vocal folds in a teacher with a hoarse voice. Most likely?', choices: ['Vocal fold nodules', 'Laryngeal cancer', 'Laryngomalacia', 'Epiglottitis'], answer: 0, why: 'Nodules come from repeated voice strain and sit where the folds collide hardest. They are usually bilateral and symmetric.' },
      { q: 'An infant has inspiratory stridor that is worse when feeding or lying supine, with an omega shaped epiglottis on endoscopy. Most likely?', choices: ['Subglottic stenosis', 'Laryngomalacia', 'Vocal fold cyst', 'Reinke\'s edema'], answer: 1, why: 'Laryngomalacia is the commonest cause of stridor in infants: floppy supraglottic tissue is drawn in during inspiration. Most cases resolve as the child grows.' },
      { q: 'Why does subglottic stenosis matter for intubation?', choices: ['It hides the epiglottis', 'A tube that passes the cords may not pass below them', 'It causes bronchospasm', 'It only matters for nasal tubes'], answer: 1, why: 'The narrowing lies below the glottis, so the view can look normal while the tube meets resistance just beyond the cords. Smaller tubes and an ENT plan may be needed.' },
    ]);
  },
};
