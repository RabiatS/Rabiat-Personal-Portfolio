// A simplified dermatome map, drawn by rule on this model's skin (metres, y up, +z anterior, +x the body's left).
// It follows standard clinical charts in anatomical position (palms forward). Real dermatomes overlap and vary.

export const LEVEL_NOTE = {
  V1: 'Ophthalmic division of the trigeminal nerve (cranial nerve V): forehead, upper eyelid and nose. Face skin is supplied by cranial nerve V, not spinal dermatomes.',
  V2: 'Maxillary division of the trigeminal nerve: cheek, upper lip, side of the nose.',
  V3: 'Mandibular division of the trigeminal nerve: lower lip, chin, jaw (except its angle) and in front of the ear.',
  C2: 'Back of the head and the angle of the jaw. There is no C1 dermatome in most people.',
  C3: 'The neck.',
  C4: 'Lower neck, top of the shoulders and the upper chest to about the second rib. Also the level of the phrenic nerve.',
  C5: 'Lateral upper arm, over the deltoid (the regimental badge area).',
  C6: 'Lateral forearm, thumb and index finger.',
  C7: 'Middle finger and the middle of the back of the hand.',
  C8: 'Little finger, ring finger and the medial forearm near the wrist.',
  T1: 'Medial forearm and medial arm above the elbow.',
  T2: 'Medial upper arm into the armpit, and the chest at the sternal angle.',
  T3: 'Chest at the third intercostal space.', T4: 'The nipple line.', T5: 'Chest below the nipples.',
  T6: 'The level of the xiphoid process.', T7: 'Below the costal margin at the front.', T8: 'Upper abdomen.', T9: 'Upper abdomen above the umbilicus.',
  T10: 'The umbilicus (navel).', T11: 'Lower abdomen.', T12: 'Just above the inguinal ligament.',
  L1: 'The groin, over the inguinal ligament, and the top of the front of the thigh.',
  L2: 'Front and inner thigh, and the upper buttock.', L3: 'Lower front thigh and the inner side of the knee.',
  L4: 'Medial leg and the medial side of the foot and ankle (medial malleolus).',
  L5: 'Lateral leg, the top (dorsum) of the foot and the big toe.',
  S1: 'Lateral edge of the foot, little toe, sole and heel.',
  S2: 'A strip down the back of the thigh and calf, and the popliteal fossa.',
  S3: 'The buttock near the natal cleft and the inner buttock.',
  S4: 'Around the anus (with S5). Saddle numbness here is a red flag for cauda equina syndrome.',
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// Trunk bands: front and back heights where each level starts (upper edge), from the model's landmarks
const TRUNK = [
  ['T2', 1.395, 1.43], ['T3', 1.345, 1.405], ['T4', 1.305, 1.38], ['T5', 1.27, 1.355], ['T6', 1.235, 1.33], ['T7', 1.2, 1.305], ['T8', 1.16, 1.28],
  ['T9', 1.115, 1.255], ['T10', 1.07, 1.225], ['T11', 1.025, 1.195], ['T12', 0.98, 1.165], ['L1', 0.94, 1.135], ['L2', 0.0, 1.105], ['L3', 0.0, 1.07], ['L4', 0.0, 1.03], ['L5', 0.0, 0.99], ['S1', 0.0, 0.955], ['S2', 0.0, 0.925], ['S3', 0.0, 0.0],
];

export function dermatomeAt(x, y, z) {
  const ax = Math.abs(x);
  // head and neck
  if (y > 1.5) {
    if (z > 0.035 || (z > 0.0 && ax < 0.045 && y > 1.53)) {
      if (y > 1.622) return z > 0.02 || y < 1.66 ? 'V1' : 'C2';
      if (y > 1.566) return 'V2';
      return ax > 0.045 && z < 0.06 ? 'C2' : 'V3';
    }
    if (y > 1.555) return z > 0.0 && y > 1.6 ? 'V1' : 'C2';
    return y > 1.528 && z < -0.02 ? 'C2' : 'C3';
  }
  if (y > 1.455) return 'C3';
  // upper limb: lateral to the trunk, from the shoulder down to the fingertips
  const armEdge = y > 1.3 ? 0.165 : 0.17;
  if (ax > armEdge && y > 0.66 && y < 1.44) {
    if (y > 1.36 && ax < 0.2) return y > 1.405 ? 'C4' : 'C5';
    const cx = y > 1.11 ? lerp(0.205, 0.215, (1.4 - y) / 0.29) : y > 0.88 ? lerp(0.215, 0.248, (1.11 - y) / 0.23) : 0.262;
    const dx = ax - cx;
    if (y > 1.11) return dx > -0.004 ? 'C5' : (y > 1.27 ? 'T2' : 'T1');
    if (y > 0.88) { if (z < -0.012 && Math.abs(dx) < 0.008) return 'C7'; return dx > 0 ? 'C6' : (y < 1.0 ? 'C8' : 'T1'); }
    if (ax > 0.283) return 'C6';
    if (ax > 0.265) return 'C7';
    return 'C8';
  }
  if (y > 1.405 + clamp(-z, 0, 0.1) * 0.25) return 'C4';
  // lower limb
  const legEdge = y < 0.86 || (y < 0.94 && z > 0.02 && ax > 0.035 && ax < 0.17);
  if (legEdge && !(y > 0.8 && ax < 0.03 && z < 0.03)) {
    const cx = y > 0.46 ? lerp(0.075, 0.1, (y - 0.46) / 0.45) : y > 0.08 ? 0.078 : 0.1;
    const dx = ax - cx;
    if (y < 0.075) {
      if (y < 0.014 || z < -0.035) return 'S1';
      if (ax < cx - 0.018) return 'L4';
      if (ax > cx + 0.026) return 'S1';
      return 'L5';
    }
    if (y < 0.46) {
      if (z < -0.035 && Math.abs(dx) < 0.022 && y > 0.25) return 'S2';
      if (z < -0.03 && dx > -0.01) return 'S1';
      return dx < -0.004 ? 'L4' : 'L5';
    }
    if (z < -0.03 && Math.abs(dx) < 0.03) return 'S2';
    if (y > 0.82) return 'L1';
    if (y > 0.6 + clamp(dx, -0.05, 0.05) * 0.6) return 'L2';
    return 'L3';
  }
  // trunk, with bands that slope down from back to front
  if (y < 0.95 && z < -0.05 && ax < 0.03 && y > 0.8) return 'S4';
  const w = clamp((z + 0.1) / 0.21, 0, 1);
  for (let i = 0; i < TRUNK.length - 1; i++) {
    const [lv, f, b] = TRUNK[i];
    const nb = TRUNK[i + 1];
    const hi = f ? lerp(b, f, w) : b; // levels below L1 exist only on the back
    let lo = nb[1] ? lerp(nb[2], nb[1], w) : nb[2];
    if (!nb[1] && w > 0.6) lo = -1;
    if (y <= hi && y > lo) {
      if (!f && w > 0.6) return 'L1';
      if (lv === 'S3' || (lv === 'S2' && ax < 0.04)) return 'S3';
      return lv;
    }
  }
  if (y > 1.395) return 'C4';
  return w > 0.5 ? 'L1' : 'S3';
}
