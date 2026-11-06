// Airway assessment: drawn Mallampati classes and Cormack-Lehane grades (original SVG drawings, tweened live),
// a 3-3-2 sketch, an interactive LEMON and MOANS checklist and a find-it drill.
import { esc, disclaimerCard } from '../shared.js';

const ROMAN = ['I', 'II', 'III', 'IV'];
// Mallampati: tongue top (y) for classes I..IV in the 400 x 400 drawing
const MP_TY = [300, 214, 172, 104];
const MP_TXT = [
  ['Class I', 'Soft palate, fauces, uvula and the faucial pillars are all visible.'],
  ['Class II', 'Soft palate, fauces and uvula are visible. The pillars are hidden by the tongue.'],
  ['Class III', 'Soft palate and the base of the uvula are visible.'],
  ['Class IV', 'The soft palate is not visible. Only the hard palate shows.'],
];
// Cormack-Lehane: epiglottis free edge and tongue edge (y) along a continuous grade 1..4
const CL_TXT = [
  ['Grade 1', 'Most of the glottis is visible, from the anterior commissure back to the arytenoids.'],
  ['Grade 2', 'Only the posterior part of the glottis is visible (2a: part of the cords, 2b: only the arytenoids or posterior commissure).'],
  ['Grade 3', 'Only the epiglottis is visible. No part of the glottis.'],
  ['Grade 4', 'Neither the glottis nor the epiglottis is visible.'],
];
const lerp = (a, b, k) => a + (b - a) * k;
function clEdges(v) {
  // v in [1, 4]
  const epi = v <= 2 ? lerp(118, 238, v - 1) : v <= 3 ? lerp(238, 352, v - 2) : 352;
  const tongue = v <= 3 ? lerp(52, 92, (v - 1) / 2) : lerp(92, 400, v - 3);
  return { epi, tongue };
}

function mallampatiSVG() {
  return `<svg viewBox="-110 0 620 400" role="img" aria-label="Open mouth with the tongue out, drawn for Mallampati classification">
  <defs>
    <clipPath id="mp-mouth"><ellipse cx="200" cy="212" rx="146" ry="150"/></clipPath>
    <radialGradient id="mp-pw" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#B2545A"/><stop offset="1" stop-color="#6E2A30"/></radialGradient>
    <linearGradient id="mp-tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E08F92"/><stop offset="1" stop-color="#B9686C"/></linearGradient>
  </defs>
  <ellipse cx="200" cy="212" rx="166" ry="170" fill="#C77A72"/>
  <g clip-path="url(#mp-mouth)">
    <rect x="0" y="0" width="400" height="400" fill="#4A1C20"/>
    <path d="M40,60 L360,60 L360,124 C330,118 280,114 200,114 C120,114 70,118 40,124 Z" fill="#EBC0BA"/>
    <g stroke="#D7A39D" stroke-width="2" fill="none" opacity=".9"><path d="M120,78 C150,86 180,86 200,82"/><path d="M280,78 C250,86 220,86 200,82"/><path d="M110,96 C150,104 180,104 200,100"/><path d="M290,96 C250,104 220,104 200,100"/><line x1="200" y1="64" x2="200" y2="112"/></g>
    <path d="M40,124 C70,118 120,114 200,114 C280,114 330,118 360,124 L360,400 L40,400 Z" fill="#D98A8C" class="mp-soft"/>
    <path d="M118,340 L118,214 C118,166 150,136 200,136 C250,136 282,166 282,214 L282,340 Z" fill="url(#mp-pw)" class="mp-fauces"/>
    <g class="mp-pillars">
      <path d="M118,214 C118,250 120,300 128,340" stroke="#E7A3A5" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M140,224 C138,260 140,300 146,340" stroke="#C0676C" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M282,214 C282,250 280,300 272,340" stroke="#E7A3A5" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M260,224 C262,260 260,300 254,340" stroke="#C0676C" stroke-width="7" fill="none" stroke-linecap="round"/>
      <ellipse cx="131" cy="285" rx="7" ry="26" fill="#C9757A"/><ellipse cx="269" cy="285" rx="7" ry="26" fill="#C9757A"/>
    </g>
    <path class="mp-uvula" d="M190,136 C190,160 186,184 190,198 C193,208 207,208 210,198 C214,184 210,160 210,136 Z" fill="#E59A9C" stroke="#F0B7B7" stroke-width="1"/>
    <path id="mp-tongue" d="" fill="url(#mp-tg)" stroke="#F2AEB0" stroke-width="1.2"/>
    <path id="mp-groove" d="" stroke="#A85A5F" stroke-width="2" fill="none" stroke-linecap="round"/>
  </g>
  <ellipse cx="200" cy="212" rx="146" ry="150" fill="none" stroke="#9E5A55" stroke-width="10"/>
  <g id="mp-lbl"></g>
</svg>`;
}
function tonguePath(ty) {
  return `M28,402 L28,${ty + 70} C36,${ty + 6} 92,${ty} 200,${ty} C308,${ty} 364,${ty + 6} 372,${ty + 70} L372,402 Z`;
}

function clSVG() {
  return `<svg viewBox="-110 0 620 400" role="img" aria-label="Laryngoscopic view of the larynx, drawn for Cormack-Lehane grading">
  <defs>
    <clipPath id="cl-c"><circle cx="200" cy="200" r="178"/></clipPath>
    <radialGradient id="cl-light" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="rgba(0,0,0,0)"/><stop offset=".75" stop-color="rgba(0,0,0,.15)"/><stop offset="1" stop-color="rgba(0,0,0,.75)"/></radialGradient>
    <linearGradient id="cl-epig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C77C7E"/><stop offset="1" stop-color="#E7A9A7"/></linearGradient>
  </defs>
  <g clip-path="url(#cl-c)">
    <rect width="400" height="400" fill="#A8585C"/>
    <ellipse cx="200" cy="372" rx="70" ry="30" fill="#5A1E24"/>
    <path d="M110,150 C112,230 130,300 160,336 L240,336 C270,300 288,230 290,150 Z" fill="#C97478"/>
    <path d="M200,156 L146,312 C170,326 230,326 254,312 Z" fill="#1A0809"/>
    <path d="M200,156 L150,306" stroke="#F4EDE6" stroke-width="7" stroke-linecap="round"/>
    <path d="M200,156 L250,306" stroke="#F4EDE6" stroke-width="7" stroke-linecap="round"/>
    <path d="M200,158 L136,300" stroke="#C25F66" stroke-width="7" stroke-linecap="round" opacity=".9"/>
    <path d="M200,158 L264,300" stroke="#C25F66" stroke-width="7" stroke-linecap="round" opacity=".9"/>
    <ellipse cx="160" cy="326" rx="20" ry="15" fill="#E3A2A0"/><ellipse cx="240" cy="326" rx="20" ry="15" fill="#E3A2A0"/>
    <circle cx="150" cy="320" r="6" fill="#F0BEBA"/><circle cx="250" cy="320" r="6" fill="#F0BEBA"/>
    <path d="M178,334 C190,340 210,340 222,334" stroke="#8E3E44" stroke-width="3" fill="none"/>
    <path id="cl-epi" d="" fill="url(#cl-epig)" stroke="#F2C2BF" stroke-width="1.5"/>
    <path id="cl-tongue" d="" fill="#C97C7A" stroke="#E3A09E" stroke-width="1.2"/>
    <rect x="0" y="0" width="400" height="40" fill="#8E969E" id="cl-blade"/>
    <rect width="400" height="400" fill="url(#cl-light)"/>
  </g>
  <circle cx="200" cy="200" r="178" fill="none" stroke="#2A2A2A" stroke-width="3"/>
  <g id="cl-lbl"></g>
</svg>`;
}
function epiPath(y) {
  // leaf shaped epiglottis whose curved free edge sits at y in the middle
  return `M0,0 L400,0 L400,${y - 70} C330,${y - 40} 280,${y + 4} 200,${y + 4} C120,${y + 4} 70,${y - 40} 0,${y - 70} Z`;
}
function tongueEdge(y) { return `M0,0 L400,0 L400,${y - 10} C300,${y + 4} 260,${y + 8} 200,${y + 8} C140,${y + 8} 100,${y + 4} 0,${y - 10} Z`; }

function threeSVG() {
  // stylised profile facing left, redrawn live from the three finger counts
  return `<svg viewBox="-20 0 440 400" role="img" aria-label="Side profile showing the 3-3-2 finger measurements"><g id="t-head"></g><g id="t-fingers"></g></svg>`;
}
function headPath(mo, ch, ht, fw) {
  const g = mo * fw; const lb = 150 + g; // lower lip level
  const hx = 182 + ch * fw; const hy = lb + 66; const tx = hx + 4; const ty = hy + 16 + ht * fw;
  const d = `M400,0 L250,0 C205,4 178,36 172,70 L136,112 C134,120 146,126 158,130 L152,144 C150,148 156,150 166,150 L214,154 L214,${lb} L166,${lb} C156,${lb} 150,${lb + 3} 152,${lb + 9} L158,${lb + 36} C160,${lb + 50} 168,${lb + 56} 180,${lb + 58} L${hx},${hy} C${hx + 6},${hy + 2} ${hx + 4},${hy + 8} ${hx + 2},${hy + 12} L${tx},${ty} L${tx + 10},400 L400,400 Z`;
  return { d, lb, hx, hy, tx, ty };
}

const CHECK = [
  ['L', 'Look externally', 'Facial trauma, large incisors, a beard, a large tongue, a small or receding jaw, a short thick neck.'],
  ['E', 'Evaluate 3-3-2', 'Fewer than 3 fingers between the incisors, fewer than 3 from chin to hyoid, fewer than 2 from hyoid to thyroid notch.'],
  ['M', 'Mallampati III or IV', 'Sitting, head neutral, mouth wide open, tongue out, no phonation.'],
  ['O', 'Obstruction or obesity', 'Epiglottitis, abscess, tumour, hematoma, stridor or a muffled voice. Obesity reduces the room and the oxygen reserve.'],
  ['N', 'Neck mobility limited', 'Cervical collar, ankylosing spondylitis, rheumatoid arthritis, prior fusion or radiation.'],
];
const MOANS = [
  ['M', 'Mask seal hard', 'Beard, facial deformity, blood or secretions.'],
  ['O', 'Obesity or obstruction', 'Including obstructive sleep apnea and pregnancy.'],
  ['A', 'Age over 55', 'Loss of tissue tone.'],
  ['N', 'No teeth', 'The cheeks fall in and the mask will not seal well.'],
  ['S', 'Stiff lungs or snoring', 'High resistance or low compliance: asthma, COPD, ARDS, late pregnancy.'],
];
const OTHER = [
  ['hx', 'Previous difficult airway', 'The strongest single predictor. Ask, and read old anesthesia records.'],
  ['tmd', 'Thyromental distance under 6 cm', 'Head extended, chin to thyroid notch.'],
  ['ulbt', 'Upper lip bite test class III', 'The lower incisors cannot touch the upper lip.'],
  ['mo', 'Mouth opening under 3 cm', 'Limits blade and device insertion.'],
  ['osa', 'OSA or a high STOP-Bang score', 'Linked with difficult mask ventilation and intubation.'],
];

export default {
  mount(ctx) {
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Airway assessment</h2>'),
      ctx.h('<p class="lede">Before you induce, you predict. Slide through the Mallampati classes and Cormack-Lehane grades, then test yourself until you can name any view at a glance.</p>'),
    );
    let view = ctx.store.get('aa:view', 'mp');
    const viewSeg = ctx.seg([['mp', 'Mallampati'], ['cl', 'Cormack-Lehane'], ['332', '3-3-2'], ['drill', 'Find it']], view, (v) => { view = v; ctx.store.set('aa:view', v); show(); });
    viewSeg.style.flexWrap = 'wrap';
    const gradeSl = ctx.slider({ label: 'Class', min: 1, max: 4, step: 0.01, value: 1, fmt: (v) => (view === 'cl' ? `Grade ${Math.round(v)}` : `Class ${ROMAN[Math.round(v) - 1]}`), onInput: (v) => { target = v; } });
    const snap = ctx.h('<div class="row" style="gap:6px"></div>');
    for (let i = 1; i <= 4; i++) { const b = ctx.h(`<button class="btn ghost sm">${i}</button>`); b.addEventListener('click', () => { target = i; gradeSl.value = i; }); snap.append(b); }
    const lblBtn = ctx.h('<label class="chip" style="cursor:pointer;justify-self:start"><input type="checkbox" checked> Labels</label>');
    let labels = true; lblBtn.querySelector('input').addEventListener('change', (e) => { labels = e.target.checked; drawn = -1; });
    const desc = ctx.h('<div class="card" style="min-height:84px"><span class="eyebrow"></span><b style="font:700 20px/1.1 var(--f-display);text-transform:uppercase"></b><p class="small" style="margin:4px 0 0"></p></div>');
    const ctl = ctx.h('<div style="display:grid;gap:10px"></div>');
    ctl.append(gradeSl, snap, lblBtn);
    // 3-3-2 controls
    const f332 = { mo: 3, ch: 3, ht: 2 };
    const t332 = ctx.h('<div style="display:grid;gap:10px" hidden></div>');
    const s1 = ctx.slider({ label: 'Mouth opening', min: 1, max: 4, step: 0.5, value: 3, unit: ' fingers', onInput: (v) => { f332.mo = v; draw332(); } });
    const s2 = ctx.slider({ label: 'Chin to hyoid', min: 1, max: 4, step: 0.5, value: 3, unit: ' fingers', onInput: (v) => { f332.ch = v; draw332(); } });
    const s3 = ctx.slider({ label: 'Hyoid to thyroid notch', min: 0.5, max: 3, step: 0.5, value: 2, unit: ' fingers', onInput: (v) => { f332.ht = v; draw332(); } });
    t332.append(s1, s2, s3);
    // drill
    const drill = ctx.h('<div class="card" hidden><span class="eyebrow">Find it</span><p class="prompt" style="font-size:19px;margin:2px 0 8px">What is this?</p><div class="choices"></div><p class="small fres" style="min-height:20px"></p><div class="row"><button class="btn sm nx">Next view</button><span class="hint score"></span></div><div class="miss small muted"></div></div>');
    ctx.panel.append(viewSeg, ctl, t332, drill, desc);

    // Checklist
    const saved = ctx.store.get('aa:check', {});
    const box = (list, pre) => list.map(([k, t, d]) => `<label class="aa-ck"><input type="checkbox" data-k="${pre}${k}" ${saved[pre + k] ? 'checked' : ''}><span><b>${pre === 'o' ? '' : `${esc(k)} `}</b>${esc(t)}<small>${esc(d)}</small></span></label>`).join('');
    const checklist = ctx.h(`<div class="card aa-list"><span class="eyebrow">Bedside checklist (tap what you find)</span>
      <h4>LEMON: hard to intubate</h4>${box(CHECK, 'l')}
      <h4>MOANS: hard to mask ventilate</h4>${box(MOANS, 'm')}
      <h4>Other predictors</h4>${box(OTHER, 'o')}
      <div class="aa-sum"></div><button class="btn ghost sm clr" style="justify-self:start">Clear</button></div>`);
    const sum = checklist.querySelector('.aa-sum');
    function summarise() {
      const st = {}; checklist.querySelectorAll('input').forEach((i) => { if (i.checked) st[i.dataset.k] = 1; });
      ctx.store.set('aa:check', st);
      const nl = Object.keys(st).filter((k) => k[0] === 'l').length; const nm = Object.keys(st).filter((k) => k[0] === 'm').length; const no = Object.keys(st).filter((k) => k[0] === 'o').length;
      const any = nl + nm + no;
      sum.innerHTML = `<div class="row" style="gap:8px;flex-wrap:wrap"><span class="chip ${nl ? 'on' : ''}">LEMON ${nl}/5</span><span class="chip ${nm ? 'on' : ''}">MOANS ${nm}/5</span><span class="chip ${no ? 'on' : ''}">Other ${no}/5</span></div>
        <p class="small" style="margin:8px 0 0">${!any ? 'Nothing flagged yet. No single test rules difficulty in or out, so every plan still needs a backup.' : nm && nl ? 'Both intubation and mask ventilation may be difficult. This is the combination that most needs a prepared plan: consider whether the airway should be secured awake, and have the second device and the front of neck kit in the room.' : nl ? 'Intubation may be difficult. Prepare a video laryngoscope, a bougie, a supraglottic airway and a plan for failure, and preoxygenate well.' : nm ? 'Mask ventilation may be difficult. Have oral and nasal airways, a two handed technique and a supraglottic airway ready.' : 'Flagged predictors raise the chance of difficulty. Plan a primary approach and a backup before induction.'} See the 2022 ASA difficult airway guideline for the full approach.</p>`;
    }
    checklist.addEventListener('change', summarise, { signal: ctx.signal });
    checklist.querySelector('.clr').addEventListener('click', () => { checklist.querySelectorAll('input').forEach((i) => { i.checked = false; }); summarise(); });
    summarise();

    ctx.panel.append(
      checklist,
      ctx.h('<div class="card tip"><p><b>Mallampati</b> is what you see in the mouth when the patient sits up and sticks the tongue out: the more the tongue hides the back of the throat, the higher the class. <b>Cormack-Lehane</b> is what you actually see through the laryngoscope: grade 1 is the whole glottis, grade 4 is nothing you recognise.</p><p>A high Mallampati class makes a poor laryngoscopic view more likely, but it does not guarantee one. That is why the bedside tests are combined, and why the history of a past difficult airway matters most.</p></div>'),
      ctx.h('<div class="card try"><ol><li>Drag the <b>Mallampati</b> slider slowly from I to IV and watch which structure disappears at each step.</li><li>Switch to <b>Cormack-Lehane</b> and stop between 2 and 3: you can see the arytenoids but no cords (grade 2b).</li><li>Open <b>3-3-2</b> and shrink the chin to hyoid distance: less room to push the tongue into.</li><li>Play <b>Find it</b> until you can name 10 in a row.</li></ol></div>'),
      ctx.h(`<details class="more"><summary>Going deeper: origins, accuracy and modifications</summary><div>
        <p class="small">Mallampati described three classes in 1985. Samsoon and Young added class IV in 1987, giving the modified Mallampati used today. Some describe a class 0, where the tip of the epiglottis can be seen.</p>
        <p class="small">Cormack and Lehane described their four grades in 1984. Yentis and Lee split grade 2 into 2a (part of the cords visible) and 2b (only the arytenoids or posterior commissure). Cook split grade 3 into 3a (epiglottis can be lifted) and 3b (epiglottis stuck to the posterior pharyngeal wall). The percentage of glottic opening (POGO) score is another way to describe the view.</p>
        <p class="small">Each bedside test alone has modest sensitivity and specificity. Combinations (for example Mallampati with thyromental distance) perform better, and a known previous difficult airway is the strongest predictor. Video laryngoscopes often improve the view, so a direct laryngoscopy grade does not transfer one to one.</p>
        <p class="small">Related mnemonics for other devices: RODS for a difficult supraglottic airway (Restricted mouth opening, Obstruction, Disrupted or distorted airway, Stiff lungs or cervical spine) and SMART for a difficult cricothyrotomy (Surgery, Mass, Access or anatomy problems, Radiation, Tumour).</p>
        <p class="small">All three drawings are schematic, made for this lab.</p>
      </div></details>`),
      disclaimerCard(ctx.h),
    );

    // Stage
    const wrap = ctx.h('<div class="svgwrap aa-stage"><div class="aa-pic"></div><div class="aa-cap"></div></div>');
    ctx.stage.append(wrap);
    const pic = wrap.querySelector('.aa-pic'); const cap = wrap.querySelector('.aa-cap');
    pic.innerHTML = mallampatiSVG() + clSVG() + threeSVG();
    const [mp, cl, th] = pic.querySelectorAll('svg');
    const NS = 'http://www.w3.org/2000/svg';
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let target = 1; let cur = 1; let drawn = -1;
    let drillItem = null;

    function lblTo(g, x, y, lx, text, col = '#F5F5F0') {
      const w = text.length * 6.6 + 12; const left = lx < x; const bx = left ? lx - w : lx;
      const e = document.createElementNS(NS, 'g');
      e.innerHTML = `<line x1="${x}" y1="${y}" x2="${lx}" y2="${y}" stroke="rgba(245,245,240,.6)"/><circle cx="${x}" cy="${y}" r="2.6" fill="${col}"/><rect class="lblbox" x="${bx}" y="${y - 9}" width="${w}" height="18" rx="5"/><text class="lbl" x="${bx + 6}" y="${y + 4}">${esc(text)}</text>`;
      g.append(e);
    }
    function mpTy(v) { const i = Math.min(2, Math.floor(v - 1)); return lerp(MP_TY[i], MP_TY[i + 1], v - 1 - i); }
    function drawMP(v, showLabels) {
      const ty = mpTy(v);
      mp.querySelector('#mp-tongue').setAttribute('d', tonguePath(ty));
      mp.querySelector('#mp-groove').setAttribute('d', `M200,${ty + 26} L200,${Math.min(400, ty + 120)}`);
      const g = mp.querySelector('#mp-lbl'); g.innerHTML = '';
      if (!showLabels) return;
      lblTo(g, 200, 90, 300, 'Hard palate');
      if (ty > 128) lblTo(g, 150, 124, 60, 'Soft palate');
      if (ty > 150) lblTo(g, 200, Math.min(190, ty - 10), 300, ty > 205 ? 'Uvula' : 'Base of uvula');
      if (ty > 200) lblTo(g, 236, Math.min(250, ty - 12), 330, 'Fauces');
      if (ty > 262) lblTo(g, 125, 300, 50, 'Pillars');
    }
    function drawCL(v, showLabels) {
      const { epi, tongue } = clEdges(v);
      cl.querySelector('#cl-epi').setAttribute('d', epiPath(epi));
      cl.querySelector('#cl-tongue').setAttribute('d', tongueEdge(tongue));
      const g = cl.querySelector('#cl-lbl'); g.innerHTML = '';
      if (!showLabels) return;
      if (tongue < 330) lblTo(g, 300, Math.min(epi - 30, tongue + 60) > tongue + 10 ? Math.max(tongue + 26, epi - 40) : tongue + 26, 350, 'Epiglottis');
      if (epi < 200) lblTo(g, 230, 240, 330, 'Vocal cord');
      if (epi < 300 && tongue < 300) lblTo(g, 240, 326, 330, 'Arytenoid');
      if (epi < 210) lblTo(g, 186, 250, 70, 'Glottis');
      if (tongue < 200 && epi < 190) lblTo(g, 120, 220, 40, 'Aryepiglottic fold');
      if (tongue > 330) lblTo(g, 200, 200, 300, 'Tongue base only');
    }
    function draw332() {
      const fw = 18; const P = headPath(f332.mo, f332.ch, f332.ht, fw);
      th.querySelector('#t-head').innerHTML = `<path d="${P.d}" fill="#2B2423" stroke="#6a5753" stroke-width="1.2"/><path d="M166,150 L214,154 L214,${P.lb} L166,${P.lb} Z" fill="#3A1418"/><rect x="160" y="148" width="12" height="9" rx="2" fill="#F4F0E6"/><rect x="160" y="${P.lb - 8}" width="12" height="9" rx="2" fill="#F4F0E6"/>
        <circle cx="${P.hx}" cy="${P.hy}" r="4" fill="#E6DCC6"/><path d="M${P.tx - 2},${P.ty - 7} l8,7 l-8,7" stroke="#B9D3D6" stroke-width="3" fill="none"/>`;
      // fingers seen end on, as rounded tips
      const tip = (x, y, d, part) => `<rect x="${x}" y="${y}" width="${d}" height="${d}" rx="${d / 2.3}" fill="#D9B8A5" stroke="#8a6f62" stroke-width="1" opacity="${part < 1 ? 0.6 : 1}"/>`;
      const stack = (n, f) => { let o = ''; for (let i = 0; i < Math.ceil(n - 1e-6); i++) o += f(i, Math.min(1, n - i)); return o; };
      const lab = (x, y, t, n, ok, anchor = 'end') => `<text x="${x}" y="${y}" text-anchor="${anchor}" style="font:500 11px 'DM Mono',monospace;fill:#A0A09A">${t}</text><text x="${x}" y="${y + 15}" text-anchor="${anchor}" style="font:500 11px 'DM Mono',monospace;fill:${ok ? '#4ade80' : '#FB7185'}">${n} finger${n === 1 ? '' : 's'}, ${ok ? 'ok' : 'short'}</text>`;
      const d = fw - 2; let o = '';
      o += stack(f332.mo, (i, part) => tip(178, 151 + i * fw, part < 1 ? d * part + 1 : d, part));
      o += stack(f332.ch, (i, part) => tip(182 + i * fw, P.lb + 62 + (i / Math.max(1, f332.ch)) * 6, part < 1 ? d * part + 1 : d, part));
      o += stack(f332.ht, (i, part) => tip(P.hx - fw - 2, P.hy + 16 + i * fw, part < 1 ? d * part + 1 : d, part));
      o += lab(166, 150 + (f332.mo * fw) / 2, 'mouth opening', f332.mo, f332.mo >= 3);
      o += lab(176, P.lb + 66, 'chin to hyoid', f332.ch, f332.ch >= 3);
      o += lab(P.hx - fw - 10, P.hy + 34 + (f332.ht * fw) / 2, 'hyoid to thyroid notch', f332.ht, f332.ht >= 2);
      o += `<text x="${P.hx + 10}" y="${P.hy - 6}" style="font:500 10px 'DM Mono',monospace;fill:#E6DCC6">hyoid</text><text x="${P.tx + 14}" y="${P.ty + 4}" style="font:500 10px 'DM Mono',monospace;fill:#B9D3D6">thyroid notch</text>`;
      th.querySelector('#t-fingers').innerHTML = o;
      const ok = f332.mo >= 3 && f332.ch >= 3 && f332.ht >= 2;
      setDesc('3-3-2 rule', ok ? 'All three distances are adequate' : 'At least one distance is short', 'Mouth opening (3) tells you whether a blade fits. Chin to hyoid (3) is the space the tongue is pushed into. Hyoid to thyroid notch (2) shows how high the larynx sits: a high larynx is harder to see.');
    }
    function setDesc(eb, title, txt) { desc.querySelector('.eyebrow').textContent = eb; desc.querySelector('b').textContent = title; desc.querySelector('p').textContent = txt; }

    // Drill
    const misses = ctx.store.get('aa:miss', {});
    let streak = 0; let right = 0; let total = 0;
    function newDrill() {
      const kind = Math.random() < 0.5 ? 'mp' : 'cl'; let n;
      do { n = 1 + Math.floor(Math.random() * 4); } while (drillItem && drillItem.kind === kind && drillItem.n === n);
      drillItem = { kind, n, answered: false };
      drill.querySelector('.prompt').textContent = kind === 'mp' ? 'Which Mallampati class?' : 'Which Cormack-Lehane grade?';
      const ch = drill.querySelector('.choices'); ch.innerHTML = '';
      for (let i = 1; i <= 4; i++) {
        const b = ctx.h(`<button class="choice">${kind === 'mp' ? `Class ${ROMAN[i - 1]}` : `Grade ${i}`}</button>`);
        b.addEventListener('click', () => answer(i, b)); ch.append(b);
      }
      drill.querySelector('.fres').textContent = '';
      mp.style.display = kind === 'mp' ? '' : 'none'; cl.style.display = kind === 'cl' ? '' : 'none'; th.style.display = 'none';
      if (kind === 'mp') drawMP(n, false); else drawCL(n === 2 ? 1.9 : n, false);
      cap.textContent = '';
      setDesc('Find it', 'Name the view', 'Labels are hidden. Pick the class or grade, then read why.');
    }
    function answer(i, b) {
      if (!drillItem || drillItem.answered) return;
      drillItem.answered = true; total++;
      const ok = i === drillItem.n; const key = `${drillItem.kind === 'mp' ? 'Mallampati' : 'Cormack-Lehane'} ${drillItem.kind === 'mp' ? ROMAN[drillItem.n - 1] : drillItem.n}`;
      drill.querySelectorAll('.choice').forEach((x, j) => { x.disabled = true; if (j + 1 === drillItem.n) x.classList.add('right'); });
      if (ok) { right++; streak++; if (streak >= 10) ctx.done(); } else { streak = 0; b.classList.add('wrong'); misses[key] = (misses[key] || 0) + 1; ctx.store.set('aa:miss', misses); }
      const T = drillItem.kind === 'mp' ? MP_TXT : CL_TXT;
      drill.querySelector('.fres').innerHTML = `<span style="color:${ok ? 'var(--ok)' : 'var(--c3)'}">${ok ? 'Right.' : 'Not quite.'}</span> ${esc(T[drillItem.n - 1][0])}: ${esc(T[drillItem.n - 1][1])}`;
      drill.querySelector('.score').textContent = `${right} of ${total} · streak ${streak}`;
      if (drillItem.kind === 'mp') drawMP(drillItem.n, true); else drawCL(drillItem.n === 2 ? 1.9 : drillItem.n, true);
      const top = Object.entries(misses).sort((a, c) => c[1] - a[1]).slice(0, 3);
      drill.querySelector('.miss').textContent = top.length ? `Most missed: ${top.map(([k, v]) => `${k} (${v})`).join(', ')}` : '';
    }
    drill.querySelector('.nx').addEventListener('click', newDrill);

    function show() {
      const isDrill = view === 'drill';
      ctl.hidden = !(view === 'mp' || view === 'cl'); t332.hidden = view !== '332'; drill.hidden = !isDrill;
      if (view === 'mp' || view === 'cl') {
        mp.style.display = view === 'mp' ? '' : 'none'; cl.style.display = view === 'cl' ? '' : 'none'; th.style.display = 'none';
        gradeSl.querySelector('label').textContent = view === 'mp' ? 'Mallampati class' : 'Cormack-Lehane grade';
        gradeSl.value = target; drawn = -1;
      } else if (view === '332') {
        mp.style.display = 'none'; cl.style.display = 'none'; th.style.display = ''; cap.textContent = 'Fingers are the patient\'s own. Schematic profile.'; draw332();
      } else newDrill();
    }
    ctx.loop((t, dt) => {
      if (view !== 'mp' && view !== 'cl') return;
      const k = RM ? 1 : Math.min(1, dt * 7);
      cur += (target - cur) * k; if (Math.abs(target - cur) < 0.002) cur = target;
      const key = `${view}:${cur.toFixed(3)}:${labels}`;
      if (key === drawn) return; drawn = key;
      const n = Math.round(cur);
      if (view === 'mp') { drawMP(cur, labels); setDesc('Mallampati (modified)', MP_TXT[n - 1][0], MP_TXT[n - 1][1]); cap.textContent = 'Patient sitting, mouth wide open, tongue out. Schematic drawing.'; } else { drawCL(cur, labels); setDesc('Cormack-Lehane', CL_TXT[n - 1][0], CL_TXT[n - 1][1]); cap.textContent = 'View through a direct laryngoscope: epiglottis at the top, arytenoids at the bottom. Schematic drawing.'; }
    });
    show();

    ctx.quiz([
      { q: 'With the tongue out you see the soft palate and only the base of the uvula. Which Mallampati class?', choices: ['Class I', 'Class II', 'Class III', 'Class IV'], answer: 2, why: 'Class III: soft palate and base of the uvula. Class II still shows the uvula and fauces; class IV shows no soft palate at all.' },
      { q: 'Through the laryngoscope you see the epiglottis but no part of the glottis. Which grade?', choices: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4'], answer: 2, why: 'Grade 3 is epiglottis only. Grade 4 is when not even the epiglottis can be seen.' },
      { q: 'Which single finding best predicts a difficult intubation?', choices: ['Mallampati class II', 'A documented previous difficult intubation', 'Age over 55', 'Thyromental distance of 7 cm'], answer: 1, why: 'A known previous difficult airway is the strongest predictor. Age over 55 is a MOANS item for mask ventilation, and a 7 cm thyromental distance is normal.' },
    ]);
  },
};
