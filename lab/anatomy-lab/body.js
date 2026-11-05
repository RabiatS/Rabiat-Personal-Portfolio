// The layered whole body used by several chapters: skin, bones, muscles, organs, vessels and nerves.
// Packs load lazily the first time a layer is switched on.
import { THREE, TISSUE, paths, tube } from './engine.js';

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };
const shade = (hex, k) => {
  const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(0.92, Math.max(0.05, hsl.l * k)));
  return c.getHex();
};

export const colorFor = {
  skel: (it) => {
    const n = it.name.toLowerCase();
    if (it.cat === 'teeth') return TISSUE.teeth;
    if (it.cat === 'larynx' || /disk|costal cartilage|cartilage/.test(n)) return TISSUE.cartilage;
    return shade(TISSUE.bone, 0.94 + hash(it.name) * 0.1);
  },
  muscle: (it) => (it.cat === 'tendon' ? TISSUE.tendon : shade(TISSUE.muscle, 0.86 + hash(it.name) * 0.28)),
  vessels: (it) => (it.cat === 'venous' ? TISSUE.vein : TISSUE.artery),
  heart: (it) => {
    const n = it.name.toLowerCase();
    if (it.cat === 'cavity') return /left/.test(n) ? 0xE0524C : 0x5A7BD8;
    if (it.cat === 'valve') return 0xF0E2C8;
    if (/papillary/.test(n)) return 0xC2685C;
    return shade(TISSUE.heart, 0.9 + hash(it.name) * 0.2);
  },
  organs: (it) => organColor(it.name),
  brain: (it) => (it.cat === 'ventricles' ? 0x7FB6E0 : /nerve|chiasm|optic tract|ganglion/i.test(it.name) ? TISSUE.nerve : shade(TISSUE.brain, 0.88 + hash(it.name) * 0.22)),
  skin: () => TISSUE.skin,
  male: (it) => (/testis|epididymis/i.test(it.name) ? 0xD9A089 : /prostate|seminal/i.test(it.name) ? 0xC9906A : /deferent/i.test(it.name) ? 0xE6D2A0 : TISSUE.repro),
  female: (it) => (it.cat === 'fbone' ? TISSUE.bone : it.cat === 'furin' ? TISSUE.bladder : /ovary/i.test(it.name) ? 0xE3B48C : /tube/i.test(it.name) ? 0xE0A0A8 : TISSUE.repro),
};

export function organColor(name) {
  const n = name.toLowerCase();
  if (/liver/.test(n)) return TISSUE.liver;
  if (/lung/.test(n)) return TISSUE.lung;
  if (/bronch|trachea|epiglottis/.test(n)) return TISSUE.airway;
  if (/stomach/.test(n)) return TISSUE.stomach;
  if (/kidney/.test(n)) return TISSUE.kidney;
  if (/spleen/.test(n)) return TISSUE.spleen;
  if (/eyeball/.test(n)) return TISSUE.eye;
  if (/ear/.test(n)) return TISSUE.skin;
  if (/adrenal|pituitary|pineal|thymus|gland/.test(n)) return TISSUE.gland;
  if (/pancrea/.test(n)) return 0xD9B074;
  if (/gallbladder|bile/.test(n)) return 0x5E8C4A;
  if (/bladder|ureter|urethra/.test(n)) return TISSUE.bladder;
  if (/tongue/.test(n)) return 0xC8706A;
  if (/colon|rectum|appendix|cecum|caecum/.test(n)) return 0xC99272;
  return TISSUE.gut;
}

// Which packs make up each layer
export const LAYERS = {
  skin: { label: 'Skin', packs: ['skin'] },
  bones: { label: 'Bones', packs: ['skel'] },
  muscles: { label: 'Muscles', packs: ['muscle'] },
  organs: { label: 'Organs', packs: ['organs', 'heart'] },
  vessels: { label: 'Vessels', packs: ['vessels'] },
  nerves: { label: 'Nerves', packs: ['brain'], procedural: true },
};

export const SKIN_OPTS = { color: colorFor.skin, opacity: 0.16, rim: 0.55, rimColor: 0xF5E6D8, pickable: false, renderOrder: 5, roughness: 0.9 };

export class Body {
  constructor(viewer) { this.v = viewer; this.on = {}; this.loading = new Map(); this.nerves = null; }
  async ensurePack(p, opts = {}) {
    if (this.v.packs[p]) return this.v.packs[p];
    if (!this.loading.has(p)) this.loading.set(p, this.v.addPack(p, { color: colorFor[p], ...(p === 'skin' ? SKIN_OPTS : {}), ...opts }));
    return this.loading.get(p);
  }
  async set(layer, on) {
    this.on[layer] = on;
    const L = LAYERS[layer];
    if (on) await Promise.all(L.packs.map((p) => this.ensurePack(p)));
    if (this.on[layer] !== on) return;
    for (const p of L.packs) this.v.packs[p]?.show(on);
    if (L.procedural) { if (on && !this.nerves) this.nerves = await nerveGroup(this.v); if (this.nerves) this.nerves.visible = on; }
    this.v.dirty = true;
  }
}

// Spinal cord, roots and the major peripheral nerves, drawn as tubes on schematic paths fitted to this skeleton
export const NERVE_INFO = {
  cord: ['Spinal cord', 'Runs from the medulla to about the L1 to L2 disc, where it tapers into the conus. 31 pairs of spinal nerves leave it.'],
  cauda: ['Cauda equina', 'Lumbar and sacral nerve roots that run down the canal below the end of the cord, like a horse tail.'],
  median: ['Median nerve', 'C6 to T1. Down the front of the arm, through the carpal tunnel. Thumb side palm feeling and most forearm flexors.'],
  ulnar: ['Ulnar nerve', 'C8 to T1. Behind the medial epicondyle (the funny bone) to the little finger side of the hand.'],
  radial: ['Radial nerve', 'C5 to T1. Spirals behind the humerus. Extends the elbow, wrist and fingers.'],
  femoral: ['Femoral nerve', 'L2 to L4. Under the inguinal ligament into the front of the thigh. Extends the knee.'],
  saphenous: ['Saphenous nerve', 'The longest sensory branch of the femoral nerve, down the inner leg.'],
  sciatic: ['Sciatic nerve', 'L4 to S3. The thickest nerve in the body, down the back of the thigh. Splits near the knee.'],
  tibial: ['Tibial nerve', 'Back of the leg, behind the medial malleolus into the sole.'],
  fibular: ['Common fibular nerve', 'Wraps around the neck of the fibula, where it is easy to injure. Lifts the foot.'],
  phrenic: ['Phrenic nerve', 'C3, C4 and C5 keep the diaphragm alive. Runs down beside the heart to the diaphragm.'],
  vagus: ['Vagus nerve', 'Cranial nerve X. Leaves the skull, runs beside the carotid and follows the oesophagus to the gut. Slows the heart.'],
  brachial: ['Brachial plexus', 'C5 to T1 roots mix behind the clavicle and become the nerves of the arm.'],
  intercostal: ['Intercostal nerve', 'Thoracic spinal nerves running under each rib, supplying a band of skin and muscle.'],
  roots: ['Spinal nerve', 'Each leaves the canal through an intervertebral foramen, carrying sensory and motor fibres.'],
};

export async function nerveGroup(v, { color = 0xF2C94C, roots = true, scale = 1 } = {}) {
  const P = (await paths()).nerves;
  const g = new THREE.Group(); g.name = 'nerves';
  const add = (pts, r, key, extra = {}) => {
    const m = tube(pts, r * scale, color, extra); m.userData.nerve = key; m.userData.clip = true; g.add(m); return m;
  };
  const cord = add(P.cord, 0.0052, 'cord', { radiusFn: (t) => (t < 0.06 ? 1.25 : t < 0.38 && t > 0.14 ? 1.22 : t > 0.8 && t < 0.92 ? 1.12 : t > 0.95 ? Math.max(0.25, (1 - t) * 14) : 1) });
  cord.userData.nerve = 'cord';
  for (const dx of [-0.0025, 0, 0.0025]) add(P.cauda.map((p, i) => [p[0] + dx * (i > 0 ? 1 : 0.3), p[1], p[2]]), 0.0011, 'cauda');
  for (const s of ['L', 'R']) {
    const S = P[s];
    for (const k of ['median', 'ulnar', 'radial', 'femoral', 'sciatic', 'tibial', 'fibular', 'phrenic', 'vagus', 'saphenous']) {
      const r = k === 'sciatic' ? 0.0042 : k === 'tibial' || k === 'femoral' ? 0.003 : k === 'phrenic' || k === 'saphenous' ? 0.0014 : 0.0024;
      add(S[k], r, k, { radiusFn: (t) => 1 - 0.45 * t });
    }
    for (const pts of S.brachial) add(pts, 0.0022, 'brachial');
    for (const pts of Object.values(S.intercostal)) add(pts, 0.0012, 'intercostal');
    if (roots) for (const [lv, pts] of Object.entries(P.roots)) if (lv.endsWith(s)) { const m = add(pts, 0.0016, 'roots'); m.userData.level = lv.slice(0, -1); }
  }
  g.traverse((o) => { o.userData.own = true; });
  v.root.add(g);
  // Picking for tubes: nearest tube within a few pixels
  const prev = v.extraPick;
  v.extraPick = (ray) => {
    const base = prev ? prev(ray) : null;
    if (!g.visible) return base;
    const rc = new THREE.Raycaster(); rc.ray.copy(ray);
    const hits = rc.intersectObjects(g.children, false).filter((h) => h.object.visible && (!v.clip || v.clip.distanceToPoint(h.point) >= 0));
    if (!hits.length) return base;
    const h = hits[0]; const key = h.object.userData.nerve; const info = NERVE_INFO[key] || [key, ''];
    const lvl = h.object.userData.level;
    const hit = { d: h.distance, key: 'nerves', nerve: key, item: { name: lvl ? `${lvl} spinal nerve` : info[0], cat: 'nerve', info: info[1] }, point: h.point, object: h.object };
    return !base || hit.d < base.d ? hit : base;
  };
  v.dirty = true;
  return g;
}
