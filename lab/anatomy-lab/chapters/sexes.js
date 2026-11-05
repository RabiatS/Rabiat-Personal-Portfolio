// Chapter 10: female and male anatomy. Two real pelves side by side with their reproductive organs, a subpubic angle gauge, and average differences.
import { THREE, Viewer, infoCard, dock, group, loadingNote, paths } from '../engine.js';
import { colorFor } from '../body.js';

const ORG = {
  'Uterus': 'Muscular organ with a fundus, body and cervix. Its lining (endometrium) thickens each cycle and is shed in menstruation; in pregnancy it grows from about 7 cm long to reach the ribs.',
  'Cervix': 'The neck of the uterus, opening into the vagina. Cervical screening samples cells from here.',
  'Left uterine tube': 'Also called the fallopian tube. Its fimbriae catch the egg from the ovary; fertilisation usually happens in the wide ampulla.',
  'Right uterine tube': 'Also called the fallopian tube. Its fimbriae catch the egg from the ovary; fertilisation usually happens in the wide ampulla.',
  'Left ovary': 'Holds the oocytes and makes oestrogen and progesterone. Homologous to the testis.',
  'Right ovary': 'Holds the oocytes and makes oestrogen and progesterone. Homologous to the testis.',
  'Vagina': 'Muscular canal from the cervix to the outside, behind the bladder and urethra and in front of the rectum.',
  'Urinary bladder': 'Sits behind the pubic symphysis. In females the uterus rests on top of it.',
  'Left testis': 'Makes sperm and testosterone. Hangs in the scrotum, a few degrees cooler than the body, which sperm production needs. Homologous to the ovary.',
  'Right testis': 'Makes sperm and testosterone. Hangs in the scrotum, a few degrees cooler than the body, which sperm production needs. Homologous to the ovary.',
  'Left epididymis': 'A tightly coiled tube on the back of the testis where sperm mature and are stored.',
  'Right epididymis': 'A tightly coiled tube on the back of the testis where sperm mature and are stored.',
  'Left deferent duct': 'The vas deferens. Carries sperm from the epididymis up through the inguinal canal and behind the bladder. Cut in a vasectomy.',
  'Right deferent duct': 'The vas deferens. Carries sperm from the epididymis up through the inguinal canal and behind the bladder. Cut in a vasectomy.',
  'Left seminal vesicle': 'Gland behind the bladder that makes most of the fluid in semen, rich in fructose.',
  'Right seminal vesicle': 'Gland behind the bladder that makes most of the fluid in semen, rich in fructose.',
  'Prostate': 'Walnut sized gland around the first part of the urethra, below the bladder. Adds fluid to semen. Its enlargement with age can slow urine flow.',
  'Corpus cavernosum of penis': 'Two columns of erectile tissue. Homologous to the clitoris.',
  'Corpus spongiosum of penis': 'Erectile tissue around the urethra, ending as the glans.',
  'Glans penis': 'The end of the corpus spongiosum.',
  'Urethra': 'About 18 to 20 cm long in males, carrying both urine and semen. In females it is about 4 cm and carries only urine.',
  'Left hip bone': 'Ilium, ischium and pubis fused. The pelvis is the most reliable skeletal guide to sex, but there is wide overlap.',
  'Right hip bone': 'Ilium, ischium and pubis fused. The pelvis is the most reliable skeletal guide to sex, but there is wide overlap.',
  'Sacrum': 'On average shorter, wider and less curved in females, widening the birth canal.',
  'Coccyx': 'The tailbone, three to five small fused vertebrae. On average more movable in females.',
};

export default {
  mount(ctx) {
    const v = new Viewer(ctx, { minDist: 0.08 });
    const note = loadingNote(ctx);
    const C = ctx.colors;
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Female and male anatomy</h2>'),
      ctx.h('<p class="lede">Most of the body is built the same way in everyone. The clearest differences are in the pelvis and the reproductive organs, and even there people overlap.</p>'),
      ctx.h(`<div class="card tip"><p>The <b>female pelvis</b> is on average wider and shallower, with a rounder inlet and a wider angle under the pubic bones, because a baby\'s head has to pass through it. The <b>male pelvis</b> is on average narrower and taller, with a heart shaped inlet and a narrower pubic arch.</p><p>Reproductive organs develop from the same starting tissue in the embryo, so each has a counterpart: ovary and testis, clitoris and penis, labia majora and scrotum.</p></div>`),
      ctx.h('<div class="card try"><p>Look from the <b>Front</b> and drag each gauge until its lines run along that pelvis\'s pubic arch. Then look from <b>Above</b> to compare the inlets. Tap any structure to name it.</p></div>'),
    );
    const gm = ctx.slider({ label: 'Male gauge', min: 30, max: 130, step: 1, value: 60, fmt: (x) => `${Math.round(x)} deg`, onInput: () => { v.dirty = true; } });
    const gf = ctx.slider({ label: 'Female gauge', min: 30, max: 130, step: 1, value: 90, fmt: (x) => `${Math.round(x)} deg`, onInput: () => { v.dirty = true; } });
    const gaugeCard = ctx.h('<div class="card"><h3>Subpubic angle</h3><p class="small muted">The angle between the two inferior pubic rami, under the pubic symphysis. Textbook values: about 50 to 60 degrees in males and about 80 to 90 degrees or more in females.</p></div>');
    gaugeCard.append(gm, gf); ctx.panel.append(gaugeCard);
    const info = infoCard(ctx); ctx.panel.append(info);
    ctx.panel.append(ctx.h(`<div class="card"><h3>Pelvis: average differences</h3><table class="small" style="border-collapse:collapse;width:100%">
      <tr><th style="text-align:left;padding:3px 4px" class="anat-tag"></th><th style="text-align:left" class="anat-tag">Female</th><th style="text-align:left" class="anat-tag">Male</th></tr>
      <tr><td>Inlet</td><td>Round or oval</td><td>Heart shaped</td></tr>
      <tr><td>Pubic arch</td><td>Wide, about 80 to 90 deg</td><td>Narrow, about 50 to 60 deg</td></tr>
      <tr><td>Greater sciatic notch</td><td>Wide</td><td>Narrow</td></tr>
      <tr><td>Pelvic cavity</td><td>Shallow, wide</td><td>Deep, narrow</td></tr>
      <tr><td>Obturator foramen</td><td>Oval or triangular</td><td>Round</td></tr>
      <tr><td>Sacrum</td><td>Short, wide, flatter</td><td>Long, narrow, curved</td></tr></table></div>`));
    ctx.panel.append(ctx.h(`<details class="more"><summary>Other average differences</summary><div>
      <p><b>Height and build:</b> adult men are on average about 10 to 15 cm taller, depending on the population, with broader shoulders and more muscle mass. Women on average carry more essential body fat, and more of it on the hips and thighs.</p>
      <p><b>Skull:</b> on average larger brow ridges, mastoid processes and a squarer chin in males; a more vertical forehead and sharper upper orbit margins in females.</p>
      <p><b>Larynx:</b> after puberty the male larynx grows more, giving the laryngeal prominence (Adam\'s apple) and longer vocal folds, so a lower voice.</p>
      <p><b>Limbs:</b> the carrying angle at the elbow and the Q angle at the knee are on average a few degrees larger in females, partly because of the wider pelvis.</p>
      <p><b>Blood and heart:</b> reference ranges for haemoglobin are lower for women (roughly 120 to 155 g/L against 130 to 175 g/L, varying by laboratory). Women\'s hearts are on average smaller, and their corrected QT interval on the ECG is slightly longer.</p>
      <p><b>Urethra:</b> about 4 cm in females, which is one reason urinary infections are more common, and about 18 to 20 cm in males.</p></div></details>`));
    ctx.panel.append(ctx.h(`<div class="card deep"><p><b>Natural variation.</b> Every difference on this page is an average with wide overlap. Many women have a narrow pubic arch and many men a wide one, and forensic sexing from a pelvis is a probability, not a certainty. Some people have differences of sex development, where chromosomes, gonads and anatomy do not all follow one typical pattern. Clinical care starts from the person in front of you, not the average.</p>
      <p>The two pelves come from different sources: the male from BodyParts3D (one adult man, MRI based), the female from the Human Reference Atlas (built on the Visible Human Female, one adult woman). They are shown at the same scale but are two individuals, so not every difference you see between them is a sex difference.</p></div>`));
    ctx.quiz([
      { q: 'On average, the subpubic angle is...', choices: ['Wider in females', 'Wider in males', 'The same in both'], answer: 0, why: 'About 80 to 90 degrees or more in females and about 50 to 60 in males, with overlap.' },
      { q: 'Which structure in males is homologous to the ovary?', choices: ['Prostate', 'Testis', 'Seminal vesicle'], answer: 1, why: 'Both gonads develop from the same tissue in the embryo.' },
      { q: 'Fertilisation most often happens in the...', choices: ['Uterus', 'Ampulla of the uterine tube', 'Cervix'], answer: 1, why: 'The egg meets sperm in the wide ampulla, then the embryo travels to the uterus to implant.' },
    ]);

    const Mg = new THREE.Group(); const Fg = new THREE.Group(); v.root.add(Mg, Fg);
    const box = new THREE.Box3(new THREE.Vector3(-0.36, -0.13, -0.12), new THREE.Vector3(0.36, 0.12, 0.12));
    const views = { front: [0, 0.02, 1], above: [0, 1, 0.25], side: [1, 0.1, 0.2], back: [0, 0.1, -1] };
    const vg = group(ctx, 'View', [['front', 'Front'], ['above', 'Above'], ['side', 'Side'], ['back', 'Back']], (k) => { view = k; v.frame(box, { dir: views[k], pad: 1.1 }); });
    let showOrg = true;
    const og = group(ctx, '', [['org', 'Organs']], (k, b) => { showOrg = !showOrg; b.classList.toggle('on', showOrg); apply(); }, { multi: true, value: { org: true } });
    dock(ctx, [vg, og]);
    let view = 'front';
    v.frame(box, { dir: views.front, pad: 1.1, dur: 0 });
    let packs = {}; let LM = null;
    const apply = () => {
      if (!packs.f) return;
      packs.fo.show(showOrg); packs.m.show(showOrg); packs.mu.show(showOrg);
      packs.mb.opacity(showOrg ? 0.5 : 1); packs.f.opacity(showOrg ? 0.5 : 1);
      v.dirty = true;
    };

    Promise.all([
      v.addPack('skel', { key: 'mb', color: colorFor.skel, filter: (it) => /hip bone|sacrum/i.test(it.name), parent: Mg }),
      v.addPack('male', { key: 'm', color: colorFor.male, parent: Mg }),
      v.addPack('organs', { key: 'mu', color: colorFor.organs, filter: (it) => /urinary bladder|urethra/i.test(it.name), parent: Mg }),
      v.addPack('female', { key: 'f', color: colorFor.female, filter: (it) => it.cat === 'fbone', parent: Fg }),
      v.addPack('female', { key: 'fo', color: colorFor.female, filter: (it) => it.cat !== 'fbone', parent: Fg }),
      paths(),
    ]).then(([mb, m, mu, f, fo, P]) => {
      note.done(); if (!f) return;
      packs = { mb, m, mu, f, fo }; LM = P.landmarks;
      // put each pelvis centre at the same height, side by side
      const mc = mb.bounds().getCenter(new THREE.Vector3()); const fc = f.bounds((it) => it.cat === 'fbone').getCenter(new THREE.Vector3());
      Mg.position.set(-0.18 - mc.x, -mc.y, -mc.z); Fg.position.set(0.18 - fc.x, -fc.y, -fc.z);
      Mg.updateMatrixWorld(true); Fg.updateMatrixWorld(true);
      apply();
      v.labels = [{ pos: new THREE.Vector3(-0.18, 0.15, 0), text: 'Male (BodyParts3D)', fixed: true, color: C.c5 }, { pos: new THREE.Vector3(0.18, 0.15, 0), text: 'Female (Human Reference Atlas)', fixed: true, color: C.c4 }];
    }).catch((e) => { console.error(e); note.fail(); });

    // subpubic gauges, drawn from each pubic symphysis in the front view
    v.onOverlay = (g) => {
      if (!LM || view !== 'front') return;
      for (const [k, grp, sl, col] of [['male', Mg, gm, C.c5], ['female', Fg, gf, C.c4]]) {
        const a = LM[`subpubic_${k}`]; if (!a) continue;
        const apex = new THREE.Vector3(...a.apex).applyMatrix4(grp.matrixWorld);
        const p = v.project(apex); const ang = THREE.MathUtils.degToRad(sl.value) / 2; const L = Math.min(v.w, v.h) * 0.12;
        g.strokeStyle = col; g.lineWidth = 1.6; g.setLineDash([5, 4]);
        g.beginPath(); g.moveTo(p.x - Math.sin(ang) * L, p.y + Math.cos(ang) * L); g.lineTo(p.x, p.y); g.lineTo(p.x + Math.sin(ang) * L, p.y + Math.cos(ang) * L); g.stroke();
        g.setLineDash([]);
        g.beginPath(); g.arc(p.x, p.y, L * 0.3, Math.PI / 2 - ang, Math.PI / 2 + ang); g.stroke();
        g.font = '500 11px "DM Mono", monospace'; g.fillStyle = col; g.textAlign = 'center'; g.fillText(`${Math.round(sl.value)} deg`, p.x, p.y + L * 0.3 + 14); g.textAlign = 'start';
      }
    };
    v.hover = (h) => h.item.name;
    v.onPick = (h) => {
      for (const pv of Object.values(packs)) pv.highlight(-1);
      v.labels = v.labels.filter((l) => l.fixed);
      if (!h) return;
      h.pv.highlight(h.item.k);
      const who = h.key === 'f' || h.key === 'fo' ? 'Female' : 'Male';
      info.set(h.item.name, ORG[h.item.name] || '', `${who} · ${h.key === 'mb' || h.item.cat === 'fbone' ? 'Bone' : 'Organ'}`);
      v.labels.push({ pos: h.point, text: h.item.name, on: true }); v.dirty = true;
    };
  },
};
