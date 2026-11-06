// Airway anatomy: a labelled midline sagittal view from nose to carina, laryngoscope blades, and the larynx in 3D
// (reusing the Anatomy Lab engine and its BodyParts3D meshes).
import { esc } from '../shared.js';

const TISSUE = '#2B2423'; const MUC = '#C9787A'; const MUC2 = '#B5656A'; const CART = '#B9D3D6'; const BONE = '#E6DCC6'; const AIR = '#0B0B0B';

// id, name, description (plain), anesthesia note
const S = {
  nasal: ['Nasal cavity', 'Air enters through the nostrils and passes over three shelves on each side wall, the turbinates (conchae), which warm and humidify it.', 'Nasal airways and nasotracheal tubes pass along the floor of the nose, below the inferior turbinate. The mucosa bleeds easily.'],
  turb: ['Turbinates', 'Three scroll shaped bones covered in vascular mucosa: superior, middle and inferior.', 'The inferior turbinate is the one a nasal device can injure. Aim along the floor, not upward.'],
  nasoph: ['Nasopharynx', 'The space behind the nose, above the soft palate. The adenoids sit on its back wall.', 'Large adenoids can block nasal breathing in children.'],
  hard: ['Hard palate', 'The bony roof of the mouth and floor of the nose.', ''],
  soft: ['Soft palate and uvula', 'The muscular back part of the palate, ending in the uvula. It rises to close off the nasopharynx when you swallow.', 'How much of the soft palate, fauces and uvula you can see with the mouth open is the Mallampati class.'],
  tongue: ['Tongue', 'A large muscle attached to the mandible and hyoid.', 'In an unconscious patient the tongue and soft tissues fall back and are the commonest cause of upper airway obstruction. Chin lift, jaw thrust and oral airways pull it forward.'],
  oroph: ['Oropharynx', 'From the soft palate down to the tip of the epiglottis, behind the mouth.', 'An oral airway sits here, between the tongue base and the back wall.'],
  vallecula: ['Vallecula', 'The small pocket between the base of the tongue and the front of the epiglottis.', 'The tip of a curved (Macintosh) blade goes here. Pressing on the hyoepiglottic ligament lifts the epiglottis out of the way.'],
  epi: ['Epiglottis', 'A leaf of elastic cartilage behind the tongue base. It folds back over the laryngeal inlet when you swallow.', 'A straight (Miller) blade lifts it directly. If all you can see is the epiglottis, that is a Cormack-Lehane grade 3 view.'],
  hyoid: ['Hyoid bone', 'A U shaped bone in the neck, at about the level of C3, that holds up the tongue and larynx.', 'The thyroid cartilage hangs from it by the thyrohyoid membrane.'],
  laryngoph: ['Laryngopharynx', 'The lowest part of the pharynx, behind the larynx, down to the start of the esophagus at about C6. The piriform recesses sit on either side.', 'A supraglottic airway tip sits at the upper esophageal sphincter, at the bottom of this space.'],
  ary: ['Arytenoid cartilages', 'Two small pyramids on top of the cricoid at the back of the larynx. The vocal folds attach to them and they pivot to open and close the glottis.', 'The posterior landmark on laryngoscopy. Seeing only the arytenoids (or the back of the glottis) is grade 2b.'],
  ffold: ['Vestibular (false) folds', 'A pair of soft folds above the true vocal folds, separated from them by the laryngeal ventricle.', ''],
  vfold: ['Vocal folds (true cords)', 'The pale folds that vibrate to make voice. The gap between them is the rima glottidis; the folds and gap together form the glottis.', 'In adults the glottis is usually the narrowest part of the airway. The tube must pass between the cords.'],
  thyroid: ['Thyroid cartilage', 'The largest laryngeal cartilage: two plates meeting in front at the laryngeal prominence (Adam\'s apple), at about C4 to C5.', 'The top notch is a key neck landmark. Thyromental distance runs from here to the chin.'],
  ctm: ['Cricothyroid membrane', 'The gap between the lower edge of the thyroid cartilage and the cricoid ring, in the front of the neck.', 'The site for emergency front of neck access (cricothyrotomy) when you cannot intubate and cannot oxygenate. Practise finding it by touch.'],
  cricoid: ['Cricoid cartilage', 'The only complete ring of cartilage in the airway, shaped like a signet ring: narrow in front, tall at the back. It sits at about C6.', 'Cricoid pressure pushes this ring back against the esophagus. In young children the cricoid region is classically taught as the narrowest point, although imaging studies suggest it is at or just below the glottis.'],
  trachea: ['Trachea', 'The windpipe: about 16 to 20 C shaped cartilage rings, open at the back where a muscular wall touches the esophagus. It runs from the cricoid (C6) to the carina.', 'The tube tip should sit in the mid trachea, above the carina. Head flexion moves it deeper; extension pulls it up.'],
  eso: ['Esophagus', 'A collapsed muscular tube behind the trachea, starting at the cricopharyngeus at about C6.', 'Esophageal intubation is a never miss error: confirm every tube with waveform capnography.'],
  carina: ['Carina', 'The ridge where the trachea splits into the right and left main bronchi, at about the level of T4 to T5 (the sternal angle).', 'The right main bronchus is wider, shorter and more vertical, so a tube pushed too deep and aspirated material both tend to go right.'],
  spine: ['Cervical spine', 'The vertebral bodies behind the pharynx and esophagus.', 'Limited neck extension (arthritis, collar, fusion) makes direct laryngoscopy harder.'],
  mandible: ['Mandible', 'The lower jaw. The tongue hangs from its inner surface.', 'A small or receding mandible leaves less room to push the tongue into, a classic difficult laryngoscopy sign.'],
};

function svg() {
  const vert = Array.from({ length: 13 }, (_, i) => { const y = 150 + i * 50; return `<rect x="378" y="${y}" width="56" height="40" rx="8" fill="${BONE}" opacity=".55"/>`; }).join('');
  const rings = Array.from({ length: 11 }, (_, i) => { const y = 528 + i * 19; return `<rect x="268" y="${y}" width="14" height="9" rx="3" fill="${CART}"/>`; }).join('');
  return `<svg viewBox="0 0 620 800" role="img" aria-label="Midline sagittal view of the airway from the nose to the trachea, with a front view of the carina">
  <defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#FBBF24" stroke-width="1.4"/></pattern></defs>
  <path d="M150,30 L120,95 L52,150 L88,180 L78,205 L82,250 L100,272 L78,318 L130,352 L215,392 L236,470 L240,800 L470,800 L470,30 Z" fill="${TISSUE}" stroke="#4a3d3a"/>
  <g class="hot" data-id="spine">${vert}<rect x="370" y="140" width="70" height="660" fill="transparent"/></g>
  <g class="hot" data-id="nasal"><path d="M80,172 C88,140 110,108 150,98 C200,90 250,98 300,138 L300,198 L262,200 L100,196 C90,190 84,182 80,172 Z" fill="${AIR}"/></g>
  <g class="hot" data-id="turb"><ellipse cx="182" cy="178" rx="56" ry="8" fill="${MUC2}"/><ellipse cx="192" cy="153" rx="48" ry="7" fill="${MUC2}"/><ellipse cx="208" cy="129" rx="32" ry="6" fill="${MUC2}"/></g>
  <g class="hot" data-id="nasoph"><path d="M300,138 C320,128 345,132 356,160 C362,182 362,200 360,214 L300,212 L300,198 Z" fill="${AIR}"/></g>
  <g class="hot" data-id="oroph"><path d="M300,212 L360,214 C362,260 360,310 358,348 L326,348 C318,330 312,300 314,278 C318,262 314,240 300,224 Z" fill="${AIR}"/></g>
  <g class="hot" data-id="laryngoph"><path d="M326,348 L358,348 C357,400 352,450 344,500 L330,500 C328,470 330,450 336,438 C334,410 330,380 326,348 Z" fill="${AIR}"/></g>
  <path d="M98,212 L262,212 C282,218 296,232 304,250 C270,236 230,226 190,226 C150,228 120,236 98,240 Z" fill="${AIR}"/>
  <path d="M318,404 C310,422 292,440 284,456 L282,520 L322,520 L326,486 C326,468 330,452 336,440 Z" fill="${AIR}"/>
  <g class="hot" data-id="trachea"><rect x="282" y="520" width="40" height="216" fill="${AIR}"/>${rings}<rect x="322" y="520" width="8" height="216" fill="#5a4440"/></g>
  <g class="hot" data-id="eso"><path d="M330,505 L350,505 L354,800 L334,800 Z" fill="${MUC2}" opacity=".85"/><line x1="342" y1="512" x2="344" y2="796" stroke="#7a3f42" stroke-width="1.5"/></g>
  <g class="hot" data-id="hard"><path d="M98,197 L262,200 L262,209 L100,206 Z" fill="${BONE}"/></g>
  <g class="hot" data-id="soft"><path d="M262,200 C292,204 312,228 320,262 C322,272 311,274 308,265 C300,240 285,222 262,211 Z" fill="${MUC}"/></g>
  <g class="hot" data-id="mandible"><path d="M86,286 C80,312 90,336 118,344 C128,346 136,340 134,330 C122,322 112,308 112,288 C110,276 92,272 86,286 Z" fill="${BONE}"/><rect x="84" y="212" width="9" height="22" rx="3" fill="#F4F0E6"/><rect x="88" y="250" width="9" height="20" rx="3" fill="#F4F0E6"/></g>
  <g class="hot" data-id="tongue"><path d="M98,244 C100,230 132,218 182,218 C232,218 272,230 294,256 C308,276 312,304 308,332 C306,350 303,362 302,372 L250,388 C215,372 175,352 140,330 C115,310 100,280 98,244 Z" fill="${MUC}"/></g>
  <g class="hot" data-id="hyoid"><ellipse cx="262" cy="394" rx="15" ry="6" transform="rotate(-18 262 394)" fill="${BONE}"/></g>
  <g class="hot" data-id="vallecula"><path d="M302,366 C304,378 312,384 320,380 L322,370 C316,372 308,370 304,362 Z" fill="#FBBF24" opacity=".0"/><circle cx="311" cy="374" r="9" fill="transparent"/></g>
  <g class="hot" data-id="epi" id="epig"><path d="M296,442 C300,412 310,382 322,358 C326,349 335,345 338,351 C333,362 323,382 315,402 C309,420 305,434 301,446 Z" fill="${MUC}" stroke="#E8A0A2" stroke-width=".8"/></g>
  <g class="hot" data-id="thyroid"><path d="M262,410 C256,430 254,460 260,488 L273,488 C269,462 271,436 277,412 Z" fill="${CART}"/></g>
  <g class="hot" data-id="ctm"><rect x="257" y="488" width="17" height="12" fill="url(#hatch)"/></g>
  <g class="hot" data-id="cricoid"><rect x="261" y="500" width="16" height="16" rx="4" fill="${CART}"/><path d="M326,470 L343,468 L347,522 L330,522 Z" fill="${CART}"/></g>
  <g class="hot" data-id="ary"><path d="M327,470 L344,468 L336,436 Z" fill="#9FC1C6"/></g>
  <g class="hot" data-id="ffold"><path d="M278,453 C292,449 312,449 330,450 L330,455 C312,455 292,456 278,458 Z" fill="${MUC2}"/></g>
  <g class="hot" data-id="vfold"><path d="M280,469 C294,465 312,465 328,467 L328,474 C312,473 294,474 280,476 Z" fill="#F2D6D4"/></g>
  <g class="hot" data-id="carina"><g transform="translate(0,0)">
    <rect x="40" y="590" width="190" height="196" rx="10" fill="rgba(20,20,20,.7)" stroke="#3A3A38"/>
    <path d="M124,610 L146,610 L146,690 C160,700 190,716 206,736 L196,744 C182,728 160,712 138,702 L132,702 C118,716 104,740 96,762 L84,758 C92,734 108,708 124,690 Z" fill="${AIR}" stroke="${CART}" stroke-width="3"/>
    <circle cx="135" cy="700" r="4" fill="#5EEAD4"/>
  </g></g>
  <text x="50" y="606" class="lbl" style="font-size:10px;fill:#A0A09A">FRONT VIEW, BELOW THE NECK</text>
  <text x="56" y="780" class="lbl" style="font-size:10px;fill:#A0A09A">patient's right</text><text x="170" y="780" class="lbl" style="font-size:10px;fill:#A0A09A">left</text>
  <path d="M302,738 C290,760 250,770 232,748" fill="none" stroke="#5A5A55" stroke-dasharray="3 4"/>
  <g class="lv" style="font:500 10px 'DM Mono',monospace;fill:#A0A09A"><text x="446" y="398">C3 hyoid</text><text x="446" y="452">C4-C5 thyroid</text><text x="446" y="512">C6 cricoid</text></g>
  <g id="blade"></g>
  <g id="labels"></g>
</svg>`;
}

// label anchor points
const ANCH = {
  nasal: [130, 150], turb: [200, 129], nasoph: [330, 168], hard: [180, 203], soft: [300, 240], tongue: [190, 280], oroph: [338, 300],
  vallecula: [310, 374], epi: [324, 362], hyoid: [262, 394], laryngoph: [346, 420], ary: [336, 452], ffold: [300, 452], vfold: [300, 470],
  thyroid: [262, 440], ctm: [262, 494], cricoid: [268, 508], trachea: [300, 640], eso: [344, 650], carina: [135, 700], spine: [406, 300], mandible: [100, 310],
};

export default {
  mount(ctx) {
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Airway anatomy</h2>'),
      ctx.h('<p class="lede">From nostrils to carina in one picture. Tap any part to name it and see why it matters when you manage an airway.</p>'),
    );
    let view = 'sag';
    const viewSeg = ctx.seg([['sag', 'Sagittal view'], ['3d', 'Larynx in 3D']], 'sag', (v) => setView(v));
    const info = ctx.h('<div class="card" style="min-height:96px"><span class="eyebrow">Selected</span><b style="font:700 19px/1.1 var(--f-display);text-transform:uppercase;letter-spacing:.02em">Tap a structure</b><p class="small"></p><p class="small muted an"></p></div>');
    const modeSeg = ctx.seg([['explore', 'Explore'], ['labels', 'All labels'], ['find', 'Find it']], 'explore', (m) => setMode(m));
    const bladeSeg = ctx.seg([['none', 'No blade'], ['mac', 'Macintosh'], ['miller', 'Miller']], 'none', (b) => setBlade(b));
    const findBox = ctx.h('<div class="card" hidden><span class="eyebrow">Find it</span><p class="prompt" style="font-size:20px"></p><p class="small fres"></p><div class="row"><button class="btn sm skip">Next</button><span class="hint score"></span></div></div>');
    const sagCtl = ctx.h('<div style="display:grid;gap:10px"></div>');
    sagCtl.append(ctx.h('<span class="eyebrow">Mode</span>'), modeSeg, ctx.h('<span class="eyebrow">Laryngoscope blade</span>'), bladeSeg, findBox);
    ctx.panel.append(viewSeg, sagCtl, info);
    const bladeNote = ctx.h('<p class="small muted" hidden></p>');
    sagCtl.append(bladeNote);
    ctx.panel.append(
      ctx.h('<div class="card tip"><p>Air goes nose (or mouth), pharynx, larynx, trachea, then splits at the carina. The pharynx is a shared corridor for air and food, and the larynx is the valve at the bottom that keeps food out of the lungs.</p><p>For intubation the landmarks run front to back: tongue, vallecula, epiglottis, then the glottis between the vocal folds, with the arytenoids behind. The esophagus lies right behind the trachea, which is why the tube can go to the wrong place.</p></div>'),
      ctx.h('<div class="card try"><ol><li>Tap the <b>vallecula</b>, then switch the blade to <b>Macintosh</b>: its tip sits there and the epiglottis tips up.</li><li>Switch to <b>Miller</b>: the straight blade picks up the epiglottis itself.</li><li>Find the <b>cricothyroid membrane</b> between the thyroid and cricoid cartilages.</li><li>Try <b>Find it</b> and get ten in a row.</li><li>Open <b>Larynx in 3D</b>, pick the <b>From above</b> view and compare it with what a laryngoscopist sees.</li></ol></div>'),
      ctx.h(`<details class="more"><summary>Going deeper: levels, sizes and why the right bronchus</summary><div>
        <p class="small">Vertebral levels in adults: hyoid about C3, thyroid cartilage C4 to C5, cricoid and the start of the trachea and esophagus about C6, carina about T4 to T5 at the sternal angle. These move with neck position and body build.</p>
        <p class="small">The larynx is supplied by the vagus: the superior laryngeal nerve (external branch to cricothyroid, internal branch sensory above the cords) and the recurrent laryngeal nerve (all other intrinsic muscles, sensory below the cords). Posterior cricoarytenoid is the only muscle that opens the cords.</p>
        <p class="small">The drawing is a schematic midline section with some depth added (the vocal folds lie to the sides of the midline). The 3D model comes from BodyParts3D (Database Center for Life Science, CC BY-SA 2.1 Japan), shared with Anatomy Lab.</p>
      </div></details>`),
    );
    ctx.quiz([
      { q: 'Where does the tip of a Macintosh blade go?', choices: ['Under the epiglottis', 'Into the vallecula', 'Between the vocal folds', 'Into the piriform recess'], answer: 1, why: 'The curved blade sits in the vallecula and tensions the hyoepiglottic ligament, which lifts the epiglottis. A Miller blade lifts the epiglottis directly.' },
      { q: 'Which cartilage is a complete ring?', choices: ['Thyroid', 'Cricoid', 'Tracheal rings', 'Epiglottis'], answer: 1, why: 'The cricoid is the only complete ring. Tracheal cartilages are C shaped, open at the back.' },
      { q: 'Why does a tube pushed too far usually enter the right main bronchus?', choices: ['The right bronchus is wider, shorter and more vertical', 'The left lung is bigger', 'The carina points left', 'The esophagus pushes it right'], answer: 0, why: 'The right main bronchus leaves the trachea at a steeper angle and is wider, so a deep tube (and aspirated material) tends to go right.' },
    ]);

    // Sagittal stage
    const sag = ctx.h(`<div class="svgwrap">${svg()}</div>`);
    ctx.stage.append(sag);
    const root = sag.querySelector('svg'); const labelsG = root.querySelector('#labels'); const bladeG = root.querySelector('#blade'); const epig = root.querySelector('#epig');
    let mode = 'explore'; let sel = null; let target = null; let streak = 0; let total = 0; let right = 0;
    const NS = 'http://www.w3.org/2000/svg';
    function label(id, on) {
      const [x, y] = ANCH[id]; const name = S[id][0];
      const g = document.createElementNS(NS, 'g'); g.setAttribute('class', on ? 'lbl-on' : '');
      const left = x > 300 && id !== 'carina' && id !== 'mandible';
      const lx = left ? Math.min(x + 40, 560) : Math.max(x - 40, 40);
      const w = name.length * 6.7 + 12;
      const bx = left ? lx : lx - w;
      g.innerHTML = `<line x1="${x}" y1="${y}" x2="${lx}" y2="${y}" stroke="rgba(245,245,240,.55)"/><circle cx="${x}" cy="${y}" r="2.6" fill="${on ? '#5EEAD4' : '#F5F5F0'}"/><rect class="lblbox" x="${bx}" y="${y - 9}" width="${w}" height="18" rx="5"/><text class="lbl" x="${bx + 6}" y="${y + 4}">${esc(name)}</text>`;
      labelsG.append(g);
    }
    function drawLabels() {
      labelsG.innerHTML = '';
      if (mode === 'labels') {
        const ids = Object.keys(ANCH);
        // spread: alternate a few to avoid overlap
        for (const id of ids) label(id, id === sel);
      } else if (sel && mode === 'explore') label(sel, true);
    }
    function select(id) {
      sel = id; const [n, d, a] = S[id];
      info.querySelector('.eyebrow').textContent = 'Selected';
      info.querySelector('b').textContent = n; info.querySelector('p').textContent = d; info.querySelector('.an').textContent = a ? `Why it matters: ${a}` : '';
      root.querySelectorAll('.hot').forEach((g) => g.style.filter = g.dataset.id === id ? 'drop-shadow(0 0 6px rgba(94,234,212,.9)) brightness(1.2)' : '');
      drawLabels();
    }
    const findPool = Object.keys(S).filter((k) => k !== 'turb');
    function newTarget() { let t; do { t = findPool[Math.floor(Math.random() * findPool.length)]; } while (t === target); target = t; findBox.querySelector('.prompt').textContent = `Tap the ${S[t][0].toLowerCase()}`; findBox.querySelector('.fres').textContent = ''; }
    function setMode(m) {
      mode = m; findBox.hidden = m !== 'find';
      if (m === 'find') { streak = 0; total = 0; right = 0; findBox.querySelector('.score').textContent = ''; newTarget(); sel = null; root.querySelectorAll('.hot').forEach((g) => { g.style.filter = ''; }); }
      drawLabels();
    }
    findBox.querySelector('.skip').addEventListener('click', newTarget, { signal: ctx.signal });
    root.addEventListener('click', (e) => {
      const g = e.target.closest('.hot'); if (!g) return;
      const id = g.dataset.id;
      if (mode === 'find') {
        total++;
        const ok = id === target || (target === 'turb' && id === 'nasal');
        if (ok) { right++; streak++; findBox.querySelector('.fres').innerHTML = `<span style="color:var(--ok)">Yes, that is the ${esc(S[id][0].toLowerCase())}.</span>`; select(id); setTimeout(() => { if (mode === 'find') newTarget(); }, 900); if (streak >= 10) ctx.done(); }
        else { streak = 0; findBox.querySelector('.fres').innerHTML = `<span style="color:var(--c3)">That is the ${esc(S[id][0].toLowerCase())}. Try again.</span>`; }
        findBox.querySelector('.score').textContent = `${right} of ${total} · streak ${streak}`;
        return;
      }
      select(id);
    }, { signal: ctx.signal });
    root.addEventListener('pointermove', (e) => { const g = e.target.closest('.hot'); root.style.cursor = g ? 'pointer' : ''; }, { signal: ctx.signal });

    // Blades: Macintosh tip in the vallecula tips the epiglottis up; Miller lifts it directly
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let epiAng = 0; let epiTarget = 0; let bladeK = 0; let bladeType = 'none';
    function setBlade(b) {
      bladeType = b; bladeK = 0;
      epiTarget = b === 'mac' ? -14 : b === 'miller' ? -30 : 0;
      bladeNote.hidden = b === 'none';
      bladeNote.textContent = b === 'mac' ? 'Macintosh (curved): the tip sits in the vallecula. Lifting along the handle tightens the hyoepiglottic ligament, which tips the epiglottis up and shows the glottis.' : b === 'miller' ? 'Miller (straight): the tip passes beneath the epiglottis and lifts it directly. Useful when the epiglottis is long or floppy, as in many children.' : '';
      if (b !== 'none') select(b === 'mac' ? 'vallecula' : 'epi');
    }
    ctx.loop((t, dt) => {
      if (view !== 'sag') return;
      const k = RM ? 1 : Math.min(1, dt * 4);
      bladeK = Math.min(1, bladeK + (RM ? 1 : dt * 1.4));
      epiAng += (epiTarget * Math.min(1, bladeK * 1.3) - epiAng) * k;
      epig.setAttribute('transform', `rotate(${epiAng.toFixed(2)} 298 442)`);
      if (bladeType === 'none') { bladeG.innerHTML = ''; return; }
      const e = 1 - Math.pow(1 - bladeK, 3);
      const path = bladeType === 'mac' ? 'M58,226 C150,224 250,246 292,296 C304,314 310,345 309,366' : 'M58,226 L318,406';
      bladeG.innerHTML = `<path d="${path}" fill="none" stroke="#9AA3AD" stroke-width="7" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${(1 - e).toFixed(3)}"/><path d="M58,226 L40,120" stroke="#6B737C" stroke-width="16" stroke-linecap="round" opacity="${e.toFixed(2)}"/>`;
    });

    // 3D view (lazy)
    let v3 = null; let host3 = null;
    async function setView(v) {
      view = v;
      sag.hidden = v !== 'sag'; sagCtl.hidden = v !== 'sag';
      if (host3) host3.hidden = v !== '3d';
      if (v === '3d' && !v3) build3d();
    }
    async function build3d() {
      host3 = ctx.h('<div style="position:absolute;inset:0"></div>');
      ctx.stage.append(host3);
      let eng;
      try { eng = await import('../../anatomy-lab/engine.js'); } catch (e) { host3.innerHTML = '<div class="k-loading">The 3D model did not load.</div>'; return; }
      if (ctx.signal.aborted) return;
      const { THREE, Viewer, loadingNote, dock, group } = eng;
      const sub = { ...ctx, stage: host3 };
      v3 = new Viewer(sub, { minDist: 0.03, maxDist: 1.2, fov: 30, label: '3D larynx and trachea. Drag to turn, pinch or scroll to zoom, tap a part to name it.' });
      const note = loadingNote(sub, 'Loading the 3D larynx');
      const LAR = /thyroid cartilage|cricoid|arytenoid cartilage|hyoid|epiglottis|^trachea$|main bronchus|tongue|mandible|vocalis|thyro-arytenoid|posterior crico-arytenoid|lateral crico-arytenoid|transverse arytenoid|cricothyroid muscle/i;
      const MAP = { 'Thyroid cartilage': 'thyroid', 'Cricoid cartilage': 'cricoid', 'Epiglottis': 'epi', 'Hyoid bone': 'hyoid', 'Trachea': 'trachea', 'Tongue': 'tongue', 'Mandible': 'mandible', 'Left arytenoid cartilage': 'ary', 'Right arytenoid cartilage': 'ary', 'Left vocalis muscle': 'vfold', 'Right vocalis muscle': 'vfold' };
      const col = (it) => (/cartilage|epiglottis/i.test(it.name) ? 0xB9D3D6 : /hyoid|mandible/i.test(it.name) ? 0xE6DCC6 : /trachea|bronch/i.test(it.name) ? 0xC9D9DB : /tongue/i.test(it.name) ? 0xC9787A : 0xB4564C);
      try {
        const [sk, org, mus] = await Promise.all([
          v3.addPack('skel', { color: col, filter: (it) => LAR.test(it.name) }),
          v3.addPack('organs', { color: col, filter: (it) => LAR.test(it.name) }),
          v3.addPack('muscle', { color: () => 0xB4564C, filter: (it) => /vocalis|thyro-arytenoid|crico-arytenoid|transverse arytenoid|cricothyroid muscle/i.test(it.name) }),
        ]);
        note.done(); if (!sk) return;
        const ghost = (pv, re, a) => { for (const it of pv.items) if (re.test(it.name)) pv.color(it.k, a); };
        ghost(sk, /mandible/i, 0x8a8478); ghost(org, /tongue/i, 0x8f5a5c);
        const tr = org.item('Trachea'); const th = sk.item('Thyroid cartilage');
        const box = new THREE.Box3().copy(th.box).union(tr.box).union(sk.item('Hyoid bone').box).union(org.item('Epiglottis').box);
        box.min.y = tr.box.min.y - 0.01;
        const carina = new THREE.Vector3(tr.center.x, tr.box.min.y + 0.004, tr.center.z);
        v3.labels = [{ pos: carina, text: 'Carina', side: 1 }, { pos: th.center.clone().add(new THREE.Vector3(0, 0.012, 0.012)), text: 'Thyroid cartilage', side: 1 }];
        const views = { front: [0, 0.08, 1], side: [1, 0.05, 0], back: [0, 0.08, -1], top: [0, 1, 0.12] };
        const vg = group(sub, 'View', [['front', 'Front'], ['side', 'Side'], ['back', 'Back'], ['top', 'From above']], (k) => {
          if (k === 'top') { const lb = new THREE.Box3().copy(th.box).union(sk.item('Cricoid cartilage').box).union(org.item('Epiglottis').box); v3.frame(lb, { dir: views.top, pad: 1.25 }); } else v3.frame(box, { dir: views[k], pad: 1.12 });
        }, { value: 'front' });
        const lay = group(sub, 'Show', [['jaw', 'Jaw and tongue'], ['mus', 'Cord muscles']], (k, b) => {
          b.classList.toggle('on');
          if (k === 'jaw') { const on = b.classList.contains('on'); for (const it of sk.items) if (/mandible/i.test(it.name)) sk.visible(it.k, on); for (const it of org.items) if (/tongue/i.test(it.name)) org.visible(it.k, on); }
          if (k === 'mus') mus.show(b.classList.contains('on'));
        });
        lay.buttons[1].classList.add('on');
        for (const it of sk.items) if (/mandible/i.test(it.name)) sk.visible(it.k, false);
        for (const it of org.items) if (/tongue/i.test(it.name)) org.visible(it.k, false);
        dock(sub, [vg, lay]);
        v3.frame(box, { dir: views.front, pad: 1.12, dur: 0 });
        v3.hover = (h) => h.item.name;
        v3.onPick = (h) => {
          for (const pv of [sk, org, mus]) pv.highlight(-1);
          if (!h) return;
          h.pv.highlight(h.item.k);
          const key = MAP[h.item.name] || (/main bronchus/i.test(h.item.name) ? 'carina' : /vocalis|thyro-arytenoid/i.test(h.item.name) ? 'vfold' : null);
          const extra = /posterior crico-arytenoid/i.test(h.item.name) ? 'The only muscle that opens (abducts) the vocal folds. Supplied by the recurrent laryngeal nerve.' : /lateral crico-arytenoid|transverse arytenoid/i.test(h.item.name) ? 'Closes (adducts) the vocal folds. Recurrent laryngeal nerve.' : /cricothyroid muscle/i.test(h.item.name) ? 'Tilts the thyroid cartilage forward to tense and lengthen the cords. Supplied by the external branch of the superior laryngeal nerve.' : '';
          info.querySelector('.eyebrow').textContent = '3D model';
          info.querySelector('b').textContent = h.item.name;
          info.querySelector('p').textContent = key ? S[key][1] : extra;
          info.querySelector('.an').textContent = key && S[key][2] ? `Why it matters: ${S[key][2]}` : (key ? '' : '');
          if (!key && extra) info.querySelector('.an').textContent = '';
          v3.labels = [{ pos: h.point, text: h.item.name, on: true }]; v3.dirty = true;
        };
      } catch (e) { console.error(e); note.fail(); }
    }
    drawLabels();
  },
};
