// Respiratory physiology: lung mechanics, lung volumes and closing capacity, dead space, shunt and the oxygen dissociation curve.
// The models and plots live in physio.js (through shared.js) so the pathophysiology chapter can reuse them.
import {
  esc, ventilate, lungVolumes, apnea, shuntPaO2, alveolarO2, hillSat, p50For, P50_STD,
  drawWaves, drawPV, drawVolumes, drawApnea, drawIsoShunt, drawODC, axes, line, tag, plotBoxes, disclaimerCard,
} from '../shared.js';

const TABS = [['mech', 'Mechanics'], ['vol', 'Volumes'], ['dead', 'Dead space'], ['shunt', 'Shunt'], ['odc', 'O2 curve']];

const TIPS = {
  mech: '<p>The ventilator has to push against two things. <b>Resistance</b> is the airways (tube, bronchi): it costs pressure only while gas is moving. <b>Compliance</b> is how stretchy the lungs and chest wall are: it costs pressure in proportion to the volume you put in.</p><p>So the <b>peak</b> pressure is both together, and the <b>plateau</b> (a pause with no flow) is the elastic part alone. Peak up with plateau unchanged means resistance. Both up together means stiffer lungs.</p>',
  vol: '<p>The <b>functional residual capacity</b> (FRC) is the air left in your lungs at the end of a normal breath out. It is the oxygen reservoir that keeps you saturated while you are not breathing.</p><p><b>Closing capacity</b> is the lung volume below which small airways in dependent lung start to close. It rises with age. When it rises above FRC, some airways close during normal breathing and blood passes lung that is not ventilated.</p>',
  dead: '<p>Not every breath reaches gas exchange. The airways from mouth to bronchioles hold about 150 mL in an adult (<b>anatomical dead space</b>). Alveoli that are ventilated but not perfused add <b>alveolar dead space</b>. Together they are physiological dead space.</p><p>What clears CO2 is <b>alveolar ventilation</b>: (tidal volume minus dead space) times rate. Small fast breaths waste a larger share of each breath.</p>',
  shunt: '<p>A <b>shunt</b> is blood that crosses the lung without meeting any ventilated alveolus, for example through collapsed or fluid filled lung. That blood stays at mixed venous oxygen content and dilutes the well oxygenated blood.</p><p>Extra oxygen cannot reach shunted blood, so as the shunt grows, turning up FiO2 helps less and less. Low V/Q units (poorly ventilated, still open) do respond to oxygen. That difference is a useful bedside clue.</p>',
  odc: '<p>Hemoglobin picks oxygen up in the lungs and lets it go in the tissues. The S shaped curve shows how saturated hemoglobin is at each oxygen tension. <b>P50</b> is the PO2 at 50% saturation, about 26.8 mmHg in normal adult blood.</p><p>A <b>right shift</b> (warm, acidic, high CO2, more 2,3-DPG: the conditions in working tissue) means hemoglobin gives oxygen up more easily. A <b>left shift</b> means it holds on more tightly. The flat top is why SpO2 changes little above a PaO2 of about 80, and the steep part is why it falls fast below about 60.</p>',
};
const TRIES = {
  mech: '<ol><li>Raise <b>resistance</b> to 25: peak pressure climbs, plateau does not move.</li><li>Lower <b>compliance</b> to 20: peak and plateau rise together and the PV loop lies flatter.</li><li>With resistance high, raise the <b>rate</b> to 24: expiratory flow no longer returns to zero before the next breath. That is air trapping and auto PEEP.</li></ol>',
  vol: '<ol><li>Switch <b>Supine</b>, then tick <b>General anesthesia</b>: FRC falls in steps.</li><li>Drag <b>age</b> to 70: closing capacity (dashed line) rises above FRC and turns red.</li><li>Raise <b>BMI</b> to 45 and compare the apnea curve: the smaller reservoir runs out much sooner.</li></ol>',
  dead: '<ol><li>Keep minute ventilation about the same: try 500 mL at 12, then 250 mL at 24. PaCO2 rises with the small fast breaths.</li><li>Add <b>alveolar dead space</b> (as with a pulmonary embolism or low cardiac output): end tidal CO2 falls and the PaCO2 to EtCO2 gap widens.</li></ol>',
  shunt: '<ol><li>At <b>shunt 5%</b>, move FiO2 from 0.21 to 1.0: PaO2 climbs past 500.</li><li>Set <b>shunt 40%</b> and do it again: PaO2 barely moves.</li><li>Drop <b>Hb</b> to 8 at 30% shunt: the same shunt costs more PaO2 because there is less hemoglobin to buffer the mixing.</li></ol>',
  odc: '<ol><li>Set PaO2 to 60 and watch SpO2 sit near 90%. Drop to 40 and SpO2 falls to about 75%.</li><li>Try <b>Fever and acidosis</b>: the curve moves right, P50 rises and SpO2 at the same PaO2 is lower.</li><li>Try <b>Stored blood</b> (low 2,3-DPG) and <b>Hypothermia</b>: left shifts.</li></ol>',
};

export default {
  mount(ctx) {
    const C = ctx.colors;
    ctx.panel.append(
      ctx.h('<h2 class="k-h">Respiratory physiology</h2>'),
      ctx.h('<p class="lede">Five pictures every anesthesia provider reads in their head: pressure and flow, lung volumes, dead space, shunt and the oxygen curve. Every line here is drawn from the real equation.</p>'),
    );
    let tab = ctx.store.get('rp:tab', 'mech');
    const tabs = ctx.seg(TABS, tab, (v) => { tab = v; ctx.store.set('rp:tab', v); render(); });
    tabs.style.flexWrap = 'wrap';
    const ctl = ctx.h('<div style="display:grid;gap:10px"></div>');
    const stats = ctx.h('<div class="card" style="display:grid;gap:4px"></div>');
    const tip = ctx.h('<div class="card tip"></div>');
    const tryc = ctx.h('<div class="card try"></div>');
    ctx.panel.append(tabs, ctl, stats, tip, tryc);
    ctx.panel.append(ctx.h(`<details class="more"><summary>Going deeper: the equations</summary><div>
      <p class="small"><b>Equation of motion</b> (one compartment): Paw = V/C + R x flow + PEEP. With a constant inspiratory flow, peak minus plateau equals R x flow, and plateau minus total PEEP equals VT/C (the driving pressure). Expiration is passive: V(t) = V0 e^(-t/RC), with time constant RC. About 95% of the volume leaves in three time constants.</p>
      <p class="small"><b>Typical numbers</b> in a ventilated adult: static compliance of the respiratory system about 50 to 100 mL/cmH2O, airway resistance with an endotracheal tube about 5 to 10 cmH2O/L/s.</p>
      <p class="small"><b>Volumes</b>: FRC is about 2.5 to 3 L upright in a typical adult, falls when supine and falls further under general anesthesia (atelectasis forms within minutes of induction). Closing capacity equals supine FRC around age 44 and upright FRC around age 66 (classic estimates). The bars use an illustrative 70 kg adult.</p>
      <p class="small"><b>Bohr equation</b> (Enghoff form): VD/VT = (PaCO2 - PECO2) / PaCO2, normal about 0.2 to 0.35. Alveolar ventilation equation: PaCO2 = 0.863 x VCO2 / VA (VCO2 in mL/min, VA in L/min BTPS). Here VCO2 is 200 mL/min.</p>
      <p class="small"><b>Alveolar gas equation</b>: PAO2 = FiO2 (Patm - 47) - PaCO2 / RQ, with RQ 0.8. <b>Oxygen content</b>: CaO2 = 1.34 x Hb x SaO2 + 0.003 x PaO2. The shunt plot mixes end capillary and mixed venous blood with an arteriovenous content difference of 5 mL/dL, as in the classic iso shunt diagram.</p>
      <p class="small"><b>Hill equation</b>: SO2 = PO2^n / (PO2^n + P50^n) with n about 2.7 and P50 26.8 mmHg. Shifts use the Severinghaus factors (log P50 changes by 0.024 per degree C, 0.40 per pH unit and 0.06 per tenfold change in PCO2) and a published fit for 2,3-DPG (about 0.8 mmHg per mmol/L). The Hill form is least accurate at very low saturations. Pulse oximeters estimate SaO2, so the readout here assumes SpO2 equals SaO2.</p>
    </div></details>`));
    ctx.panel.append(disclaimerCard(ctx.h));

    const cv = ctx.canvas(); const g = cv.ctx;
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const st = ctx.store.get('rp:state', null) || {};
    const S = {
      C: 50, R: 6, VT: 500, flow: 50, peep: 5, rr: 12, view: 'both',
      age: 30, pos: 'upright', ga: false, bmi: 24,
      dVT: 500, dRR: 12, vdA: 150, vdAlv: 0,
      fio2: 0.4, sh: 0.1, hb: 15,
      temp: 37, pH: 7.4, pco2: 40, dpg: 4.65, pao2: 60, fetal: false, ...st,
    };
    const save = () => ctx.store.set('rp:state', S);
    const sl = (key, o) => ctx.slider({ ...o, value: S[key], onInput: (v) => { S[key] = v; if (o.after) o.after(); save(); draw(); } });
    const stat = (k, v, col) => `<div class="row" style="justify-content:space-between;font:500 12px var(--f-mono)"><span class="muted">${esc(k)}</span><b style="color:${col || 'var(--text)'}">${v}</b></div>`;

    function render() {
      ctl.innerHTML = '';
      tip.innerHTML = TIPS[tab];
      tryc.innerHTML = TRIES[tab];
      if (tab === 'mech') {
        ctl.append(
          sl('C', { label: 'Compliance', min: 10, max: 120, step: 1, unit: ' mL/cmH2O' }),
          sl('R', { label: 'Resistance', min: 2, max: 40, step: 1, unit: ' cmH2O/L/s' }),
          sl('VT', { label: 'Tidal volume', min: 200, max: 800, step: 10, unit: ' mL' }),
          sl('flow', { label: 'Inspiratory flow', min: 20, max: 90, step: 1, unit: ' L/min' }),
          sl('rr', { label: 'Rate', min: 6, max: 30, step: 1, unit: ' /min' }),
          sl('peep', { label: 'PEEP', min: 0, max: 15, step: 1, unit: ' cmH2O' }),
          ctx.seg([['both', 'Waves and loop'], ['waves', 'Waveforms'], ['pv', 'PV loop']], S.view, (v) => { S.view = v; save(); draw(); }),
        );
      } else if (tab === 'vol') {
        const ga = ctx.h(`<label class="chip" style="cursor:pointer"><input type="checkbox" ${S.ga ? 'checked' : ''}> General anesthesia</label>`);
        ga.querySelector('input').addEventListener('change', (e) => { S.ga = e.target.checked; save(); draw(); });
        ctl.append(
          sl('age', { label: 'Age', min: 20, max: 85, step: 1, unit: ' y' }),
          ctx.seg([['upright', 'Upright'], ['supine', 'Supine'], ['trend', 'Head down']], S.pos, (v) => { S.pos = v; save(); draw(); }),
          ga,
          sl('bmi', { label: 'BMI', min: 18, max: 50, step: 1, unit: ' kg/m2' }),
        );
      } else if (tab === 'dead') {
        ctl.append(
          sl('dVT', { label: 'Tidal volume', min: 200, max: 800, step: 10, unit: ' mL' }),
          sl('dRR', { label: 'Rate', min: 6, max: 36, step: 1, unit: ' /min' }),
          sl('vdA', { label: 'Anatomical dead space', min: 80, max: 250, step: 5, unit: ' mL' }),
          sl('vdAlv', { label: 'Alveolar dead space', min: 0, max: 250, step: 5, unit: ' mL' }),
        );
      } else if (tab === 'shunt') {
        ctl.append(
          sl('fio2', { label: 'FiO2', min: 0.21, max: 1, step: 0.01, fmt: (v) => v.toFixed(2) }),
          sl('sh', { label: 'Shunt fraction', min: 0, max: 0.5, step: 0.01, fmt: (v) => `${Math.round(v * 100)}%` }),
          sl('hb', { label: 'Hemoglobin', min: 6, max: 18, step: 0.5, unit: ' g/dL' }),
        );
      } else {
        const pre = ctx.seg([['norm', 'Normal'], ['hot', 'Fever and acidosis'], ['cold', 'Hypothermia'], ['stored', 'Stored blood'], ['fetal', 'Fetal Hb']], S.preset || '', (v) => {
          Object.assign(S, { temp: 37, pH: 7.4, pco2: 40, dpg: 4.65, fetal: false, preset: v });
          if (v === 'hot') Object.assign(S, { temp: 39.5, pH: 7.25, pco2: 55 });
          if (v === 'cold') Object.assign(S, { temp: 33, pH: 7.45, pco2: 34 });
          if (v === 'stored') Object.assign(S, { dpg: 1.0 });
          if (v === 'fetal') S.fetal = true;
          save(); render();
        });
        pre.style.flexWrap = 'wrap';
        ctl.append(
          ctx.h('<span class="eyebrow">Presets</span>'), pre,
          sl('pao2', { label: 'PaO2 to read', min: 15, max: 120, step: 1, unit: ' mmHg' }),
          sl('temp', { label: 'Temperature', min: 32, max: 42, step: 0.1, unit: ' C', after: () => { S.fetal = false; S.preset = ''; } }),
          sl('pH', { label: 'pH', min: 7.0, max: 7.7, step: 0.01, fmt: (v) => v.toFixed(2), after: () => { S.fetal = false; S.preset = ''; } }),
          sl('pco2', { label: 'PCO2', min: 20, max: 90, step: 1, unit: ' mmHg', after: () => { S.fetal = false; S.preset = ''; } }),
          sl('dpg', { label: '2,3-DPG (red cell)', min: 0.5, max: 9, step: 0.05, unit: ' mmol/L', after: () => { S.fetal = false; S.preset = ''; } }),
        );
      }
      draw();
    }

    let phase = 0; let last = null;
    function draw() {
      const { w, h } = cv; if (!w) return;
      g.clearRect(0, 0, w, h); g.textAlign = 'left';
      const narrow = w < 640;
      if (tab === 'mech') {
        const r = { ...ventilate(S), color: C.c1 }; last = r;
        const ref = { ...ventilate({ ...S, C: 50, R: 6 }), color: 'rgba(245,245,240,.8)', faint: true };
        const runs = Math.abs(S.C - 50) + Math.abs(S.R - 6) > 0 ? [ref, r] : [r];
        const view = narrow && S.view === 'both' ? 'waves' : S.view;
        if (view === 'both') {
          const [a, b] = plotBoxes(w, h, 2, { top: 44 });
          a.w = (w - 80) * 0.58; b.x = a.x + a.w + 80; b.w = w - b.x - 24;
          const m = drawWaves(g, a, runs, { show: ['p', 'f', 'v'] }); cursor(m, r);
          drawPV(g, { ...b, y: b.y + 24, h: Math.min(b.h - 24, b.w * 1.1) }, runs);
        } else if (view === 'waves') {
          const [a] = plotBoxes(w, h, 1, { top: 34 });
          const m = drawWaves(g, a, runs, { show: narrow ? ['p', 'f'] : ['p', 'f', 'v'] }); cursor(m, r);
        } else {
          const [a] = plotBoxes(w, h, 1, { top: 44 }); const side = Math.min(a.w, a.h * 1.3);
          drawPV(g, { ...a, w: side }, runs);
        }
        if (runs.length > 1) tag(g, w - 24, 18, 'dashed: compliance 50, resistance 6', '#A0A09A', 'right');
        stats.innerHTML = `<span class="eyebrow">Readout</span>${stat('Peak pressure', `${r.ppeak.toFixed(1)} cmH2O`, C.c1)}${stat('Plateau pressure', `${r.pplat.toFixed(1)} cmH2O`)}${stat('Peak minus plateau (R x flow)', `${(r.ppeak - r.pplat).toFixed(1)} cmH2O`)}${stat('Driving pressure (VT / C)', `${(S.VT / S.C).toFixed(1)} cmH2O`)}${stat('Time constant RC', `${r.tau.toFixed(2)} s`)}${stat('Expiratory time', `${r.Te.toFixed(2)} s (${(r.Te / r.tau).toFixed(1)} time constants)`)}${stat('Auto PEEP', `${r.autoPeep.toFixed(1)} cmH2O`, r.autoPeep > 1 ? C.c4 : null)}`;
      } else if (tab === 'vol') {
        const v = lungVolumes(S); const ref = lungVolumes({ age: 25 });
        const bx = plotBoxes(w, h, 2, { top: 44 });
        const vb = { ...bx[0], w: bx[0].w - 70 };
        drawVolumes(g, vb, [{ label: 'age 25 upright', vols: ref }, { label: 'this patient', vols: v }]);
        g.font = '500 11px "DM Mono"'; g.fillStyle = '#F5F5F0'; g.fillText('Lung volumes and closing capacity', vb.x, vb.y - 22);
        const vo2 = 250;
        drawApnea(g, bx[1], [
          { frc: ref.FRC - 0.7, vo2, fao2: 0.87, color: 'rgba(245,245,240,.8)', faint: true, label: 'young supine' },
          { frc: v.FRC, vo2, fao2: 0.87, color: C.c5, label: 'this patient' },
        ], { tmax: 12, title: narrow ? 'Apnea after preoxygenation' : 'Apnea after preoxygenation (FRC as the O2 store)' });
        const t90 = apnea({ frc: v.FRC, vo2, fao2: 0.87 }).t90; const t90ra = apnea({ frc: v.FRC, vo2, fao2: 0.14 }).t90;
        stats.innerHTML = `<span class="eyebrow">Readout</span>${stat('FRC', `${v.FRC.toFixed(2)} L`, C.c5)}${stat('Closing capacity', `${v.CC.toFixed(2)} L`, v.closes ? C.c4 : C.c2)}${stat('FRC minus closing capacity', `${(v.FRC - v.CC).toFixed(2)} L`, v.closes ? C.c4 : null)}${stat('Time to SpO2 90%, preoxygenated', `${t90.toFixed(1)} min`)}${stat('Same on room air', `${t90ra < 0.05 ? 'under a minute' : `${t90ra.toFixed(1)} min`}`)}<p class="small muted" style="margin:4px 0 0">${v.closes ? 'Closing capacity is above FRC: small airways close during normal tidal breathing, causing low V/Q and shunt.' : 'Closing capacity is below FRC: airways stay open through normal tidal breathing.'} The apnea model counts oxygen in the FRC and the blood, used at 250 mL/min with no inflow. It leaves out apneic oxygenation and shunt, so treat the times as a guide.</p>`;
      } else if (tab === 'dead') {
        const vco2 = 200; const vd = S.vdA + S.vdAlv;
        const valv = Math.max(0.02, (S.dVT - vd) / 1000 * S.dRR); const ve = S.dVT / 1000 * S.dRR;
        const paco2 = Math.min(150, 0.863 * vco2 / valv);
        const peco2 = paco2 * Math.max(0, S.dVT - vd) / S.dVT;
        const perf = Math.max(1, S.dVT - S.vdA - S.vdAlv);
        const et = paco2 * perf / (perf + S.vdAlv);
        const [a, b] = plotBoxes(w, h, 2, { top: 44 });
        // PaCO2 vs alveolar ventilation hyperbola
        const { X, Y } = axes(g, a, { x0: 0, x1: 12, y0: 0, y1: 120, xt: [0, 2, 4, 6, 8, 10, 12], yt: [0, 20, 40, 60, 80, 100, 120], xl: 'alveolar ventilation L/min', yl: 'PaCO2 mmHg', title: 'PaCO2 = 0.863 x VCO2 / VA' });
        const pts = []; for (let x = 1.2; x <= 12; x += 0.05) pts.push([X(x), Y(Math.min(120, 0.863 * vco2 / x))]);
        line(g, pts, C.c2, 2.2);
        g.fillStyle = '#F5F5F0'; g.beginPath(); g.arc(X(Math.min(12, valv)), Y(Math.min(120, paco2)), 5, 0, 7); g.fill();
        tag(g, X(Math.min(12, valv)) + 8, Y(Math.min(120, paco2)) - 12, `VA ${valv.toFixed(1)} L/min, PaCO2 ${Math.round(paco2)}`);
        // Breath split bar
        const bw = Math.min(b.w, 520); const bx = b.x; const by = b.y + 10; const bh = 34;
        g.font = '500 11px "DM Mono"'; g.fillStyle = '#F5F5F0'; g.fillText('Where one breath goes', bx, b.y - 22);
        const k = bw / Math.max(S.dVT, 1);
        const seg = (x0, ww, col, lab) => { g.fillStyle = col; g.fillRect(x0, by, Math.max(0, ww), bh); if (ww > 44) { g.fillStyle = '#0A0A0A'; g.font = '500 10px "DM Mono"'; g.fillText(lab, x0 + 5, by + 21); } };
        const a1 = Math.min(S.vdA, S.dVT) * k; const a2 = Math.min(S.vdAlv, Math.max(0, S.dVT - S.vdA)) * k;
        seg(bx, a1, 'rgba(160,160,154,.75)', 'anatomical'); seg(bx + a1, a2, 'rgba(251,113,133,.8)', 'alveolar VD'); seg(bx + a1 + a2, bw - a1 - a2, 'rgba(94,234,212,.85)', 'gas exchange');
        g.fillStyle = '#A0A09A'; g.font = '500 10px "DM Mono"'; g.fillText(`tidal volume ${S.dVT} mL`, bx, by + bh + 16);
        // CO2 tensions side by side
        const cb = { x: b.x, y: by + bh + 70, w: Math.min(b.w, 520), h: Math.max(70, b.y + b.h - (by + bh + 70)) };
        const ym = Math.max(60, Math.ceil(paco2 / 20) * 20);
        const yt = []; for (let v = 0; v <= ym; v += 20) yt.push(v);
        const ax = axes(g, cb, { x0: 0, x1: 3, y0: 0, y1: ym, yt, yl: 'mmHg', title: 'CO2 tensions' });
        const bars = [['PaCO2', paco2, C.c2], ['EtCO2', et, C.c1], ['mixed expired', peco2, C.c3]];
        bars.forEach(([lab, v, col], i) => {
          const x0 = ax.X(i + 0.5); const bw2 = Math.min(64, cb.w / 3 - 20);
          g.fillStyle = col; g.globalAlpha = 0.85; g.fillRect(x0 - bw2 / 2, ax.Y(v), bw2, ax.Y(0) - ax.Y(v)); g.globalAlpha = 1;
          g.fillStyle = '#F5F5F0'; g.font = '500 10px "DM Mono"'; g.textAlign = 'center'; g.fillText(lab, x0, cb.y + cb.h + 14); g.fillText(String(Math.round(v)), x0, ax.Y(v) - 6); g.textAlign = 'left';
        });
        const vdvt = (paco2 - peco2) / paco2;
        stats.innerHTML = `<span class="eyebrow">Readout</span>${stat('Minute ventilation', `${ve.toFixed(1)} L/min`)}${stat('Alveolar ventilation', `${valv.toFixed(1)} L/min`, C.c1)}${stat('VD/VT (Bohr)', vdvt.toFixed(2), vdvt > 0.4 ? C.c4 : null)}${stat('PaCO2', `${Math.round(paco2)} mmHg`, C.c2)}${stat('EtCO2', `${Math.round(et)} mmHg`)}${stat('PaCO2 minus EtCO2', `${Math.round(paco2 - et)} mmHg`, paco2 - et > 8 ? C.c4 : null)}`;
      } else if (tab === 'shunt') {
        const [a] = plotBoxes(w, h, 1, { top: 44 });
        drawIsoShunt(g, { ...a, w: Math.min(a.w, 760) }, { mark: { fio2: S.fio2, s: S.sh }, hb: S.hb });
        const r = shuntPaO2(S.fio2, S.sh, { hb: S.hb });
        stats.innerHTML = `<span class="eyebrow">Readout</span>${stat('Alveolar PO2 (PAO2)', `${Math.round(r.pA)} mmHg`)}${stat('Arterial PO2 (PaO2)', `${Math.round(r.pa)} mmHg`, C.c3)}${stat('A-a gradient', `${Math.round(r.pA - r.pa)} mmHg`)}${stat('SaO2', `${(hillSat(r.pa) * 100).toFixed(1)}%`)}${stat('CaO2', `${r.ca.toFixed(1)} mL/dL`)}${stat('P/F ratio', `${Math.round(r.pa / S.fio2)}`)}`;
      } else {
        const p50 = S.fetal ? 19 : p50For(S);
        const curves = [{ p50, color: C.c4, label: S.fetal ? `fetal Hb, P50 ${p50.toFixed(1)}` : `P50 ${p50.toFixed(1)} mmHg` }];
        if (Math.abs(p50 - P50_STD) > 0.2) curves.push({ p50: P50_STD, color: 'rgba(245,245,240,.85)', faint: true, label: 'normal, P50 26.8' });
        const [a] = plotBoxes(w, h, 1, { top: 44 });
        drawODC(g, { ...a, w: Math.min(a.w, 820) }, { curves, mark: S.pao2 });
        const s = hillSat(S.pao2, p50) * 100; const s0 = hillSat(S.pao2) * 100;
        const shift = p50 > P50_STD + 0.2 ? 'right shift: hemoglobin unloads O2 more easily' : p50 < P50_STD - 0.2 ? 'left shift: hemoglobin holds O2 more tightly' : 'no shift';
        stats.innerHTML = `<span class="eyebrow">Readout</span>${stat('P50', `${p50.toFixed(1)} mmHg`, C.c4)}${stat(`SpO2 at PaO2 ${S.pao2}`, `${s.toFixed(1)}%`)}${stat('Normal curve at the same PaO2', `${s0.toFixed(1)}%`)}<p class="small muted" style="margin:4px 0 0">${shift}.</p>`;
      }
    }
    function cursor(m, r) {
      if (RM) return;
      const tt = phase % (2 * r.T); let j = Math.round(((tt % r.T) / r.T) * (r.t.length - 1));
      j = Math.max(0, Math.min(r.t.length - 1, j));
      for (const k of Object.keys(m)) {
        const arr = k === 'p' ? r.p : k === 'f' ? r.f : r.v;
        g.fillStyle = '#F5F5F0'; g.beginPath(); g.arc(m[k].X(tt), m[k].Y(arr[j]), 3.5, 0, 7); g.fill();
      }
    }
    cv.onResize(draw);
    ctx.loop((t, dt) => { if (tab !== 'mech' || RM) return; phase += dt; draw(); });
    render();

    ctx.quiz([
      { q: 'During volume control ventilation the peak pressure jumps from 20 to 35 cmH2O while the plateau stays at 15. What changed?', choices: ['Compliance fell', 'Airway resistance rose', 'PEEP was added', 'Tidal volume fell'], answer: 1, why: 'Peak minus plateau is resistance times flow. A rise in peak with an unchanged plateau points to the airways or the tube: bronchospasm, secretions, kinking or biting.' },
      { q: 'A patient has a 40% shunt. What happens to PaO2 when FiO2 goes from 0.4 to 1.0?', choices: ['It roughly doubles', 'It rises only a little', 'It falls', 'It rises above 500'], answer: 1, why: 'Shunted blood never meets the extra oxygen, and the well ventilated blood is already nearly saturated. With large shunts the iso shunt lines go almost flat.' },
      { q: 'Which change shifts the oxygen dissociation curve to the right?', choices: ['Hypothermia', 'Alkalosis', 'Fever', 'Transfusion of stored blood'], answer: 2, why: 'Higher temperature, acidosis, higher PCO2 and more 2,3-DPG raise P50 (right shift). Cold, alkalosis and stored blood (low 2,3-DPG) shift it left.' },
    ]);
  },
};
