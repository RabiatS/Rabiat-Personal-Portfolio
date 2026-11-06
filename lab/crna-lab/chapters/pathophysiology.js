// Pathophysiology: what bronchospasm, COPD, laryngospasm, aspiration, upper airway obstruction and OSA do to the curves
// from the physiology chapter. Every plot reuses the shared models and drawing functions (physio.js through shared.js).
import {
  esc, ventilate, lungVolumes, apnea, shuntPaO2, hillSat, flowVolume,
  drawWaves, drawPV, drawVolumes, drawApnea, drawIsoShunt, drawODC, drawCapno, drawFlowVolume, plotBoxes, disclaimerCard,
} from '../shared.js';

const lerp = (a, b, k) => a + (b - a) * k;
const BASE = { C: 50, R: 6, VT: 500, flow: 50, peep: 5, rr: 12 };
const WHITE = 'rgba(245,245,240,.85)';

// Each scenario: what the severity slider means, which two plots, a readout, what changes, and general management principles
const SC = {
  bronch: {
    name: 'Bronchospasm and asthma', sev: 'Airway narrowing',
    lede: 'Smooth muscle in the small airways tightens, the lining swells and mucus plugs form. Resistance rises, mostly on the way out.',
    changes: ['Peak pressure rises while plateau stays close to normal (peak minus plateau is resistance times flow).', 'Expiratory flow decays slowly and may not reach zero before the next breath: air trapping and auto PEEP.', 'The capnogram loses its square shape and becomes a shark fin. End tidal CO2 underestimates PaCO2.', 'The flow volume loop shows a scooped, concave expiratory limb.'],
    mgmt: ['Give 100% oxygen and call for help if severe.', 'Rule out mechanical causes first: kinked or blocked tube, tube in a main bronchus, light anesthesia, and think of anaphylaxis.', 'Deepen anesthesia (a volatile agent or propofol) and give an inhaled short acting beta 2 agonist through the circuit.', 'Ventilate with a low rate and a long expiratory time. Accept a higher PaCO2 rather than build up auto PEEP.', 'For severe or refractory bronchospasm, IV epinephrine. Other adjuncts are used by some teams.'],
  },
  copd: {
    name: 'COPD', sev: 'Disease severity',
    lede: 'Chronic bronchitis narrows the airways; emphysema destroys alveolar walls and the elastic recoil that holds small airways open. Lungs empty slowly and hyperinflate.',
    changes: ['Resistance is high and, in emphysema, static compliance is higher than normal (floppy lungs), so the time constant is long.', 'At normal rates expiration is incomplete: dynamic hyperinflation and auto PEEP.', 'Residual volume, FRC and TLC rise (hyperinflation), and closing capacity rises too.', 'Dead space and V/Q mismatch rise; some patients retain CO2 chronically.'],
    mgmt: ['Optimize before surgery: continue inhalers, treat infection, stop smoking.', 'Prefer regional anesthesia when it suits the surgery, and avoid airway instrumentation when you can.', 'On the ventilator: low rate, short inspiratory time, long expiratory time, and watch that expiratory flow returns to zero.', 'In chronic CO2 retainers many teams target an SpO2 of about 88 to 92%.', 'After surgery: good analgesia, early mobilization and lung expansion.'],
  },
  laryngo: {
    name: 'Laryngospasm', sev: 'Oxygen before the spasm',
    lede: 'A reflex closure of the vocal cords (and often the false cords) triggered by secretions, blood or stimulation in light anesthesia, classically at induction or emergence.',
    changes: ['Partial spasm gives inspiratory stridor; complete spasm is silent with no chest rise, no capnogram trace and paradoxical chest movement.', 'With no inflow, the FRC oxygen store drains at the rate of oxygen consumption, so time to desaturation depends on FRC, preoxygenation and VO2.', 'Children desaturate fastest: small FRC, high oxygen consumption.', 'Once PaO2 falls onto the steep part of the dissociation curve, SpO2 falls quickly.'],
    mgmt: ['Remove the trigger: stop stimulation, suction blood and secretions. Call for help.', '100% oxygen with a tight mask seal and gentle CPAP.', 'Jaw thrust, with firm pressure at the laryngospasm notch behind the ear lobe (Larson maneuver).', 'Deepen anesthesia with IV propofol.', 'If it persists or SpO2 keeps falling: succinylcholine (IV, or IM if there is no IV access), then ventilate or intubate. Treat bradycardia in children.', 'Watch afterward for negative pressure pulmonary edema.'],
  },
  aspir: {
    name: 'Aspiration', sev: 'Lung injury',
    lede: 'Gastric contents enter the lungs. Acid causes a chemical pneumonitis, particles block airways, and later infection can follow.',
    changes: ['Flooded and collapsed alveoli create shunt: PaO2 falls and responds poorly to more oxygen.', 'Compliance falls, so plateau and peak pressures rise together.', 'Bronchospasm can be part of the picture early.'],
    mgmt: ['Head down or lateral tilt, suction the pharynx, give 100% oxygen.', 'Intubate if needed and suction the trachea through the tube before positive pressure ventilation when possible.', 'Use PEEP for hypoxemia. Bronchoscopy if solid material is suspected.', 'Routine prophylactic antibiotics and steroids are not recommended. Observe; most patients without new symptoms or oxygen need within about two hours are unlikely to develop pneumonitis.', 'Prevention: fasting guidance, risk assessment and rapid sequence induction when indicated.'],
  },
  obstr: {
    name: 'Upper airway obstruction', sev: 'Narrowing',
    lede: 'The tongue and soft palate falling back under anesthesia, a foreign body, swelling, tumor or a hematoma narrows the airway above the carina.',
    changes: ['A fixed obstruction flattens both limbs of the flow volume loop.', 'A variable obstruction outside the chest (for example vocal cord paralysis) flattens the inspiratory limb, because the airway collapses inward when pressure inside it falls.', 'A variable obstruction inside the chest flattens the expiratory limb.', 'Mask ventilation becomes hard and the oxygen reserve becomes the clock.'],
    mgmt: ['Open the airway: chin lift, jaw thrust, oral or nasal airway, two handed mask seal.', 'Move to a supraglottic airway or intubation as needed, limiting the number of attempts with each device.', 'If you cannot intubate and cannot oxygenate, proceed to emergency front of neck access.', 'Plan ahead with the 2022 American Society of Anesthesiologists Practice Guidelines for Management of the Difficult Airway: assess, prepare, consider awake techniques, and decide in advance when to move to the next step.'],
  },
  osa: {
    name: 'Obstructive sleep apnea', sev: 'BMI',
    lede: 'The pharynx collapses repeatedly during sleep. It is common, often undiagnosed, and tightly linked with obesity.',
    changes: ['Obesity lowers FRC, so closing capacity may sit above FRC and the oxygen reserve is small.', 'Oxygen consumption is higher, so apnea desaturation is faster.', 'Sedatives and opioids worsen pharyngeal collapse and blunt arousal, especially after surgery.', 'Mask ventilation and intubation are more often difficult.'],
    mgmt: ['Screen (STOP-Bang) and ask patients to bring their CPAP device.', 'Preoxygenate head up, with CPAP or PEEP where possible.', 'Minimize opioids and sedatives: multimodal analgesia and regional techniques.', 'Fully reverse neuromuscular blockade and extubate fully awake, semi upright.', 'Monitor oxygenation after surgery and resume CPAP.'],
  },
};
const ORDER = ['bronch', 'copd', 'laryngo', 'aspir', 'obstr', 'osa'];

export default {
  mount(ctx) {
    const C = ctx.colors;
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Pathophysiology</h2>'),
      ctx.h('<p class="lede">Six airway and lung problems you will meet in the OR, shown as the curves they bend. The dashed line is always normal; drag severity to see the disease grow.</p>'),
    );
    let sc = ctx.store.get('pp:sc', 'bronch');
    if (!SC[sc]) sc = 'bronch';
    let sev = ctx.store.get(`pp:sev:${sc}`, 0.6);
    let otype = ctx.store.get('pp:otype', 'fixed');
    const scSeg = ctx.seg(ORDER.map((k) => [k, SC[k].name.replace('Bronchospasm and asthma', 'Bronchospasm').replace('Upper airway obstruction', 'Obstruction').replace('Obstructive sleep apnea', 'OSA')]), sc, (v) => { sc = v; ctx.store.set('pp:sc', v); sev = ctx.store.get(`pp:sev:${sc}`, 0.6); render(); });
    scSeg.style.flexWrap = 'wrap';
    const head = ctx.h('<div class="card"><span class="eyebrow">Condition</span><b style="font:700 21px/1.1 var(--f-display);text-transform:uppercase"></b><p class="small" style="margin:4px 0 0"></p></div>');
    const sevHost = ctx.h('<div></div>');
    const typeSeg = ctx.seg([['fixed', 'Fixed'], ['extra', 'Variable, outside chest'], ['intra', 'Variable, inside chest']], otype, (v) => { otype = v; ctx.store.set('pp:otype', v); draw(); });
    typeSeg.style.flexWrap = 'wrap';
    const stats = ctx.h('<div class="card" style="display:grid;gap:4px"></div>');
    const changes = ctx.h('<div class="card"><span class="eyebrow">What changes in the curves</span><ul class="small" style="margin:6px 0 0;padding-left:18px;display:grid;gap:4px"></ul></div>');
    const mgmt = ctx.h('<div class="card"><span class="eyebrow">General management principles</span><ul class="small" style="margin:6px 0 0;padding-left:18px;display:grid;gap:4px"></ul><p class="small muted" style="margin:6px 0 0">Principles only. Follow your institution\'s protocols and current references for drugs and doses.</p></div>');
    ctx.panel.append(scSeg, head, sevHost, typeSeg, stats, changes, mgmt);
    ctx.panel.append(
      ctx.h('<div class="card tip"><p>Most airway and lung problems change only a few numbers: how hard it is to push gas through the tubes (resistance), how stiff the lungs are (compliance), how much air sits in the lungs at rest (FRC), and how much blood passes lung that gets no air (shunt). Learn to see which number moved and the right treatment usually follows.</p><p>Narrow tubes slow emptying, so the fix is time to breathe out. Flooded or collapsed lung needs PEEP and recruitment more than extra oxygen. A small oxygen reserve means less time, so preoxygenation and planning matter most.</p></div>'),
      ctx.h('<div class="card try"><ol><li><b>Bronchospasm</b>: slide severity up and watch peak pressure climb while plateau barely moves, then look at the shark fin capnogram.</li><li><b>COPD</b>: see FRC and closing capacity rise together, and expiratory flow fail to reach zero.</li><li><b>Laryngospasm</b>: compare the adult and the child curves. Which one gives you less time?</li><li><b>Obstruction</b>: switch between fixed and variable types and watch which limb of the loop goes flat.</li></ol></div>'),
      ctx.h(`<details class="more"><summary>Going deeper: reading the pictures</summary><div>
        <p class="small"><b>Peak and plateau.</b> In volume control, a high peak with a normal plateau points to resistance (bronchospasm, secretions, a kinked or bitten tube). High peak and high plateau point to low compliance (aspiration, edema, pneumothorax, abdominal insufflation, chest wall rigidity, endobronchial intubation).</p>
        <p class="small"><b>Auto PEEP</b> is found with an end expiratory hold. It raises intrathoracic pressure, lowers venous return and can cause hypotension; disconnecting the circuit briefly lets the trapped gas out.</p>
        <p class="small"><b>Shunt versus V/Q mismatch.</b> Low V/Q units respond to more oxygen; true shunt does not. Aspiration and atelectasis behave mostly like shunt, which is why PEEP and recruitment help more than FiO2 alone.</p>
        <p class="small"><b>Desaturation.</b> The apnea curves use a simple oxygen store model: the oxygen in the FRC plus the blood that equilibrates with it, drained by oxygen consumption with no inflow. It leaves out apneic oxygenation and shunt, so treat the times as a guide; the ranking (child and obese patient fastest) is the point.</p>
        <p class="small"><b>Difficult airway.</b> The 2022 American Society of Anesthesiologists Practice Guidelines for Management of the Difficult Airway (Anesthesiology, 2022) cover assessment, preparation, awake and asleep strategies, limiting attempts, and emergency front of neck access. Read the guideline itself for its algorithm and infographic.</p>
        <p class="small">The flow volume loops are schematic textbook shapes, drawn to show the pattern rather than measured values.</p>
      </div></details>`),
      disclaimerCard(ctx.h),
    );

    const cv = ctx.canvas(); const g = cv.ctx;
    const stat = (k, v, col) => `<div class="row" style="justify-content:space-between;font:500 12px var(--f-mono)"><span class="muted">${esc(k)}</span><b style="color:${col || 'var(--text)'}">${v}</b></div>`;

    function render() {
      const S = SC[sc];
      head.querySelector('b').textContent = S.name; head.querySelector('p').textContent = S.lede;
      sevHost.innerHTML = '';
      const fmt = sc === 'osa' ? (v) => `${Math.round(lerp(25, 55, v))} kg/m2` : sc === 'laryngo' ? (v) => `FiO2 ${lerp(0.21, 1, v).toFixed(2)}` : (v) => (v < 0.34 ? 'mild' : v < 0.67 ? 'moderate' : 'severe');
      sevHost.append(ctx.slider({ label: S.sev, min: 0, max: 1, step: 0.01, value: sev, fmt, onInput: (v) => { sev = v; ctx.store.set(`pp:sev:${sc}`, v); draw(); } }));
      typeSeg.hidden = sc !== 'obstr';
      changes.querySelector('ul').innerHTML = S.changes.map((x) => `<li>${esc(x)}</li>`).join('');
      mgmt.querySelector('ul').innerHTML = S.mgmt.map((x) => `<li>${esc(x)}</li>`).join('');
      draw();
    }

    function draw() {
      const { w, h } = cv; if (!w) return;
      g.clearRect(0, 0, w, h); g.textAlign = 'left';
      const narrow = w < 640;
      const [a, b] = plotBoxes(w, h, 2, { top: 44 });
      const base = { ...ventilate(BASE), color: WHITE, faint: true };
      let html = '';
      if (sc === 'bronch') {
        const r = { ...ventilate({ ...BASE, R: lerp(6, 40, sev) }), color: C.c4 };
        drawWaves(g, a, [base, r], { show: narrow ? ['p', 'f'] : ['p', 'f'] });
        drawCapno(g, b, [{ color: WHITE, faint: true, label: 'normal' }, { color: C.c4, rise: lerp(0.08, 0.9, sev), slope: lerp(1.5, 7, sev), etco2: lerp(38, 33, sev), label: 'bronchospasm' }]);
        html = stat('Peak pressure', `${r.ppeak.toFixed(0)} cmH2O`, C.c4) + stat('Plateau pressure', `${r.pplat.toFixed(0)} cmH2O`) + stat('Time constant', `${r.tau.toFixed(2)} s`) + stat('Auto PEEP', `${r.autoPeep.toFixed(1)} cmH2O`, r.autoPeep > 1 ? C.c4 : null);
      } else if (sc === 'copd') {
        const r = { ...ventilate({ ...BASE, R: lerp(6, 28, sev), C: lerp(50, 85, sev), rr: 14 }), color: C.c2 };
        const v = lungVolumes({ age: 65, copd: sev }); const ref = lungVolumes({ age: 65 });
        drawWaves(g, a, [{ ...ventilate({ ...BASE, rr: 14 }), color: WHITE, faint: true }, r], { show: ['p', 'f'] });
        const vb = { ...b, w: b.w - 70 };
        drawVolumes(g, vb, [{ label: 'age 65, healthy', vols: ref }, { label: 'COPD', vols: v }], { vmax: 9 });
        g.font = '500 11px "DM Mono"'; g.fillStyle = '#F5F5F0'; g.fillText('Lung volumes', vb.x, vb.y - 22);
        html = stat('Time constant', `${r.tau.toFixed(2)} s`, C.c2) + stat('Auto PEEP at rate 14', `${r.autoPeep.toFixed(1)} cmH2O`, r.autoPeep > 1 ? C.c4 : null) + stat('FRC', `${v.FRC.toFixed(1)} L (healthy ${ref.FRC.toFixed(1)})`) + stat('Residual volume', `${v.RV.toFixed(1)} L (healthy ${ref.RV.toFixed(1)})`);
      } else if (sc === 'laryngo') {
        const fio2 = lerp(0.21, 1, sev); const fa = Math.max(0.14, (fio2 * 713 - 50) / 713);
        const runs = [
          { frc: 2.3, fao2: 0.87, color: WHITE, faint: true, label: 'adult, fully preoxygenated' },
          { frc: 2.3, fao2: fa, color: C.c2, label: `adult, FiO2 ${fio2.toFixed(2)}` },
          { frc: 0.25, vo2: 65, qb: 0.4, hb: 12, fao2: fa, color: C.c4, label: `10 kg child, FiO2 ${fio2.toFixed(2)}` },
        ];
        drawApnea(g, a, runs, { tmax: 10, title: narrow ? 'SpO2 once the cords close' : 'SpO2 once the cords close completely' });
        drawODC(g, b, { curves: [{ p50: 26.8, color: C.c4 }], mark: 60, title: 'The cliff edge: below PaO2 60, SpO2 falls fast' });
        const fmt = (m) => (m < 0.05 ? 'at once' : `${m.toFixed(1)} min`);
        html = stat(`Adult to SpO2 90%`, fmt(apnea(runs[1]).t90), C.c2) + stat(`Child to SpO2 90%`, fmt(apnea(runs[2]).t90), C.c4) + stat('Adult, fully preoxygenated', fmt(apnea(runs[0]).t90));
      } else if (sc === 'aspir') {
        const s = lerp(0.03, 0.4, sev);
        const r = { ...ventilate({ ...BASE, C: lerp(50, 20, sev) }), color: C.c3 };
        drawIsoShunt(g, a, { mark: { fio2: 0.6, s }, lines: [0, 0.1, 0.2, 0.3, 0.5] });
        drawPV(g, { ...b, w: Math.min(b.w, b.h * 1.4) }, [base, r], { title: 'Pressure volume loop' });
        const sh = shuntPaO2(0.6, s);
        html = stat('Shunt', `${Math.round(s * 100)}%`, C.c3) + stat('PaO2 at FiO2 0.6', `${Math.round(sh.pa)} mmHg`) + stat('PaO2 at FiO2 1.0', `${Math.round(shuntPaO2(1, s).pa)} mmHg`) + stat('Compliance', `${Math.round(lerp(50, 20, sev))} mL/cmH2O`) + stat('Plateau pressure', `${r.pplat.toFixed(0)} cmH2O`, C.c3);
      } else if (sc === 'obstr') {
        const cap = lerp(7, 1.4, sev);
        drawFlowVolume(g, a, [{ ...flowVolume(), color: WHITE, faint: true, label: 'normal' }, { ...flowVolume({ cap, capType: otype }), color: C.c5, label: otype === 'fixed' ? 'fixed obstruction' : otype === 'extra' ? 'variable, outside chest' : 'variable, inside chest' }]);
        drawApnea(g, b, [{ frc: 2.3, vo2: 250, fao2: 0.87, color: C.c5, label: 'preoxygenated' }, { frc: 2.3, vo2: 250, fao2: 0.14, color: C.c4, label: 'room air' }], { tmax: 10, title: 'If ventilation stops completely' });
        html = stat('Flow limit', `${cap.toFixed(1)} L/s`, C.c5) + stat('Limb flattened', otype === 'fixed' ? 'both' : otype === 'extra' ? 'inspiratory' : 'expiratory') + stat('Time to SpO2 90%, preoxygenated', `${apnea({ frc: 2.3 }).t90.toFixed(1)} min`);
      } else {
        const bmi = lerp(25, 55, sev);
        const v = lungVolumes({ age: 45, pos: 'supine', ga: true, bmi }); const ref = lungVolumes({ age: 45, pos: 'supine', ga: true, bmi: 24 });
        const vb = { ...a, w: a.w - 70 };
        drawVolumes(g, vb, [{ label: 'BMI 24', vols: ref }, { label: `BMI ${Math.round(bmi)}`, vols: v }]);
        g.font = '500 11px "DM Mono"'; g.fillStyle = '#F5F5F0'; g.fillText('Supine, anesthetized, age 45', vb.x, vb.y - 22);
        const vo2 = 250 * lerp(1, 1.3, sev);
        drawApnea(g, b, [{ frc: ref.FRC, vo2: 250, fao2: 0.87, color: WHITE, faint: true, label: 'BMI 24' }, { frc: v.FRC, vo2, fao2: 0.87, color: C.c6, label: `BMI ${Math.round(bmi)}` }], { tmax: 10, title: 'Apnea after preoxygenation' });
        html = stat('FRC', `${v.FRC.toFixed(2)} L`, C.c6) + stat('Closing capacity', `${v.CC.toFixed(2)} L`, v.closes ? C.c4 : null) + stat('Oxygen consumption', `${Math.round(vo2)} mL/min (illustrative)`) + stat('Time to SpO2 90%', `${apnea({ frc: v.FRC, vo2, fao2: 0.87 }).t90.toFixed(1)} min`, C.c6);
      }
      stats.innerHTML = `<span class="eyebrow">Readout</span>${html}`;
    }
    cv.onResize(draw);
    render();

    ctx.quiz([
      { q: 'Under anesthesia, peak airway pressure rises sharply, plateau pressure is unchanged and the capnogram looks like a shark fin. Most likely?', choices: ['Pneumothorax', 'Bronchospasm', 'Aspiration with lung collapse', 'Endobronchial intubation'], answer: 1, why: 'A rise in peak with a normal plateau means resistance, and the sloping capnogram shows slow, uneven emptying. Always check the tube for kinks or secretions too.' },
      { q: 'At emergence, a child has no chest rise, no capnogram and falling SpO2 despite jaw thrust and CPAP with 100% oxygen. A reasonable next step?', choices: ['Wait for spontaneous resolution', 'Deepen with IV propofol, then succinylcholine if it persists', 'Give IV furosemide', 'Remove the mask to let the child cry'], answer: 1, why: 'Complete laryngospasm with falling saturation calls for deepening (propofol) and, if needed, a muscle relaxant such as succinylcholine, ready to ventilate or intubate. Children desaturate fast.' },
      { q: 'A patient with a variable obstruction outside the chest (for example bilateral vocal cord paralysis) has which flow volume loop?', choices: ['Flattened expiratory limb only', 'Flattened inspiratory limb only', 'Both limbs flattened', 'Scooped expiratory limb'], answer: 1, why: 'Outside the chest, the airway narrows when its inside pressure falls below atmospheric, which happens during inspiration. Fixed lesions flatten both limbs; intrathoracic variable lesions flatten expiration.' },
    ]);
  },
};
