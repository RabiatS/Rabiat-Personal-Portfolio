// Short, textbook level notes for structures, keyed by name without left or right.
const F = {
  // skull
  'frontal bone': 'Forehead and the roofs of the orbits. Holds the frontal sinuses. Meets the parietal bones at the coronal suture.',
  'parietal bone': 'One of a pair forming the top and sides of the cranium. They meet each other at the sagittal suture.',
  'temporal bone': 'Side and base of the skull. Houses the middle and inner ear, the external acoustic meatus and the mastoid process.',
  'occipital bone': 'Back and base of the skull. The foramen magnum, where the brainstem becomes the spinal cord, passes through it.',
  'sphenoid bone': 'Butterfly shaped keystone of the skull base. Holds the pituitary in the sella turcica and carries many foramina.',
  ethmoid: 'Light, spongy bone between the orbits. Forms part of the nasal septum and roof of the nose; olfactory nerves pass through its cribriform plate.',
  maxilla: 'Upper jaw. Holds the upper teeth, forms most of the hard palate and the floor of the orbit, and contains the maxillary sinus.',
  mandible: 'Lower jaw, the only skull bone that moves (at the temporomandibular joint). The largest and strongest facial bone.',
  'zygomatic bone': 'Cheekbone. Forms the zygomatic arch with the temporal bone and part of the orbit wall.',
  'nasal bone': 'Small paired bones forming the bridge of the nose.',
  'lacrimal bone': 'The smallest facial bone, in the medial wall of the orbit. The tear duct runs along it.',
  'palatine bone': 'Forms the back of the hard palate and part of the nasal cavity.',
  'inferior nasal concha': 'A curled shelf of bone on the side wall of the nasal cavity that warms and moistens air.',
  vomer: 'Thin bone forming the lower back part of the nasal septum.',
  'hyoid bone': 'U shaped bone in the neck that touches no other bone. Anchors the tongue and helps with swallowing.',
  // axial
  atlas: 'C1. Holds up the skull and has no body. Nodding (yes) happens mostly here.',
  axis: 'C2. Its dens is the pivot the atlas turns around. Turning the head (no) happens mostly here.',
  sacrum: 'Five fused vertebrae forming the back of the pelvis. Joins the hip bones at the sacroiliac joints.',
  'body of sternum': 'Middle part of the breastbone. Costal cartilages of ribs 2 to 7 join it.',
  manubrium: 'Top part of the sternum. Joins the clavicles and first ribs. Its joint with the body is the sternal angle, level with rib 2.',
  'xiphoid process': 'Small lower tip of the sternum, cartilage in young people and bone later in life.',
  // limbs
  clavicle: 'Collarbone. The only bony link between the arm and the trunk, and one of the most often broken bones.',
  scapula: 'Shoulder blade. Its shallow glenoid cavity forms the shoulder joint with the humerus.',
  humerus: 'Upper arm bone. Ball at the shoulder, hinge and pivot surfaces at the elbow. The radial nerve spirals behind its shaft.',
  radius: 'Lateral forearm bone (thumb side in anatomical position). Rotates around the ulna to turn the palm over.',
  ulna: 'Medial forearm bone (little finger side). Its olecranon is the point of the elbow.',
  scaphoid: 'Carpal bone at the base of the thumb. The most commonly fractured carpal bone, felt in the anatomical snuffbox.',
  lunate: 'Moon shaped carpal bone in the middle of the wrist.',
  pisiform: 'Pea shaped carpal bone on the little finger side of the wrist.',
  'hip bone': 'Formed by three bones fused at the acetabulum: ilium, ischium and pubis. Also called the os coxae.',
  femur: 'Thigh bone, the longest and strongest bone in the body. Its head sits in the acetabulum.',
  patella: 'Kneecap, the largest sesamoid bone, inside the quadriceps tendon.',
  tibia: 'Shin bone, medial and weight bearing. Its lower end forms the medial malleolus.',
  fibula: 'Thin lateral leg bone. Carries little weight; its lower end is the lateral malleolus.',
  calcaneus: 'Heel bone, the largest tarsal bone. The calcaneal (Achilles) tendon attaches to it.',
  talus: 'Ankle bone that sits between the tibia, fibula and calcaneus. No muscles attach to it.',
  // organs
  liver: 'Largest internal organ, under the right ribs. Makes bile, stores glycogen, processes nutrients and clears toxins.',
  'upper lobe of right lung': 'The right lung has three lobes (upper, middle, lower) separated by the oblique and horizontal fissures.',
  'middle lobe of right lung': 'Only the right lung has a middle lobe. Its sounds are heard at the front of the right chest.',
  'lower lobe of right lung': 'Mostly at the back. Inhaled objects often end up in the right lower lobe because the right main bronchus is wider and more vertical.',
  'upper lobe of left lung': 'The left lung has two lobes. Its upper lobe includes the lingula, the counterpart of the right middle lobe.',
  'lower lobe of left lung': 'The left lower lobe sits behind the heart and above the diaphragm.',
  trachea: 'Windpipe, held open by C shaped cartilage rings. Splits into the main bronchi at the carina, about the level of T4 to T5.',
  'left main bronchus': 'Longer and more horizontal than the right, because the heart and aortic arch sit on the left.',
  'right main bronchus proper': 'Wider, shorter and more vertical than the left, so inhaled objects go here more often.',
  esophagus: 'Muscular tube from pharynx to stomach, behind the trachea, through the diaphragm at about T10.',
  stomach: 'J shaped bag in the upper left abdomen. Acid and enzymes start protein digestion.',
  duodenum: 'First 25 cm or so of the small intestine, C shaped around the head of the pancreas. Bile and pancreatic juice enter here.',
  jejunum: 'Middle part of the small intestine, mostly in the upper left abdomen. Most nutrient absorption happens here.',
  ileum: 'Last and longest part of the small intestine. Absorbs vitamin B12 and bile salts and joins the large intestine at the caecum.',
  'ascending colon': 'Runs up the right side from the caecum to the liver.',
  'transverse colon': 'Hangs across the upper abdomen from right to left.',
  'descending colon': 'Runs down the left side of the abdomen.',
  rectum: 'Stores faeces before defecation. Lies in front of the sacrum.',
  appendix: 'Narrow pouch off the caecum in the right lower abdomen. Inflamed in appendicitis.',
  pancreas: 'Behind the stomach. Makes digestive enzymes and, from its islets, insulin and glucagon.',
  gallbladder: 'Stores and concentrates bile, under the liver. Releases bile when fatty food reaches the duodenum.',
  'bile ducts': 'Carry bile from the liver and gallbladder to the duodenum.',
  spleen: 'Under the left ribs 9 to 11. Filters blood, recycles old red cells and holds immune cells.',
  thymus: 'Behind the sternum. Trains T cells. Large in children, mostly fat in adults.',
  kidney: 'Filters about 180 litres of plasma a day into 1 to 2 litres of urine. Sits against the back wall, the right slightly lower than the left because of the liver.',
  ureter: 'Muscular tube carrying urine from kidney to bladder by peristalsis.',
  'urinary bladder': 'Stores urine behind the pubic symphysis.',
  urethra: 'Carries urine out of the bladder. About 4 cm in females and about 20 cm in males.',
  'adrenal gland': 'Sits on top of each kidney. Cortex makes cortisol and aldosterone, medulla makes adrenaline.',
  'pituitary gland': 'Pea sized master gland under the brain, in the sella turcica of the sphenoid bone.',
  'pineal body': 'Small gland in the middle of the brain that releases melatonin in the dark.',
  eyeball: 'About 24 mm across. Shown here with sclera, cornea, iris and lens.',
  tongue: 'Muscular organ for taste, chewing, swallowing and speech.',
  'external ear': 'The auricle collects sound into the external acoustic meatus.',
  // heart
  'wall of ventricle': 'Muscular walls of both ventricles. The left ventricle wall is about three times thicker than the right because it pumps against higher pressure.',
  'wall of left atrium': 'Receives oxygen rich blood from the four pulmonary veins.',
  'wall of right atrium': 'Receives oxygen poor blood from the superior and inferior venae cavae and the coronary sinus. Holds the sinoatrial node, the natural pacemaker.',
  'mitral valve': 'Between left atrium and left ventricle. Two cusps, held by chordae tendineae and papillary muscles.',
  'tricuspid valve': 'Between right atrium and right ventricle. Three cusps.',
  'aortic valve': 'Between left ventricle and aorta. Three semilunar cusps; the coronary arteries start just above it.',
  'pulmonary valve': 'Between right ventricle and pulmonary trunk. Three semilunar cusps.',
  'papillary muscles': 'Pull on the chordae tendineae so the mitral and tricuspid valves do not flip back into the atria.',
  'left ventricle cavity': 'Pumps oxygen rich blood into the aorta at about 120 mmHg at peak.',
  'right ventricle cavity': 'Pumps oxygen poor blood into the pulmonary trunk at about 25 mmHg at peak.',
  'left atrium cavity': 'Collects blood from the lungs.',
  'right atrium cavity': 'Collects blood from the body.',
  // vessels
  'ascending aorta': 'Rises from the left ventricle. The left and right coronary arteries branch from its root.',
  'arch of aorta': 'Gives off the brachiocephalic trunk, left common carotid and left subclavian arteries.',
  'descending aorta': 'Runs down beside the spine through the chest and, after the diaphragm, the abdomen.',
  'abdominal aorta': 'Supplies the gut, kidneys and gonads, and splits into the common iliac arteries at about L4.',
  'pulmonary trunk': 'Carries oxygen poor blood from the right ventricle and splits into the left and right pulmonary arteries.',
  'pulmonary artery': 'Carries oxygen poor blood to a lung. The only arteries carrying deoxygenated blood after birth.',
  'superior vena cava': 'Brings blood from the head, neck and arms to the right atrium.',
  'inferior vena cava': 'Brings blood from the legs, pelvis and abdomen to the right atrium. Lies to the right of the aorta.',
  'common carotid artery': 'Runs up the neck and splits at about the upper border of the thyroid cartilage into internal and external carotids.',
  'internal carotid artery': 'Enters the skull through the carotid canal to supply most of the brain and the eye.',
  'vertebral artery': 'Climbs through holes in the cervical vertebrae and enters the skull through the foramen magnum.',
  'subclavian artery': 'Supplies the arm, and gives off the vertebral artery. Becomes the axillary artery at the first rib.',
  'brachial artery': 'Main artery of the arm. Where blood pressure is measured, felt at the elbow crease.',
  'radial artery': 'Where the pulse is usually felt, at the thumb side of the wrist.',
  'femoral artery': 'Main artery of the thigh. Its pulse is felt at the groin, midway between the anterior superior iliac spine and the pubic symphysis.',
  'popliteal artery': 'Continues the femoral artery behind the knee.',
  'internal jugular vein': 'Drains the brain, face and neck, inside the carotid sheath beside the carotid artery.',
  'great saphenous vein': 'Longest vein in the body, on the inner leg. Often used for heart bypass grafts.',
  'hepatic portal vein': 'Carries nutrient rich blood from the gut and spleen to the liver.',
  'renal artery': 'Supplies a kidney. Together the two renal arteries carry about a fifth of the resting cardiac output.',
  // brain
  cerebellum: 'Coordinates movement, balance and posture, and helps with motor learning.',
  pons: 'Part of the brainstem. Relays signals to the cerebellum and helps control breathing rhythm.',
  'medulla oblongata': 'Lowest part of the brainstem. Controls heart rate, blood pressure and breathing.',
  midbrain: 'Top of the brainstem. Eye movement and visual and auditory reflexes.',
  thalamus: 'Relay station for almost all sensation on its way to the cortex.',
  hypothalamus: 'Controls temperature, hunger, thirst and the pituitary gland.',
  hippocampus: 'Forms new long term memories and helps with spatial navigation.',
  amygdala: 'Emotional learning, especially fear.',
  'corpus callosum': 'The largest bundle of fibres linking the left and right hemispheres.',
  'precentral gyrus': 'Primary motor cortex: starts voluntary movement on the opposite side of the body.',
  'postcentral gyrus': 'Primary somatosensory cortex: touch, pain, temperature and position from the opposite side.',
  'superior frontal gyrus': 'Part of the frontal lobe: planning, reasoning, self control and working memory.',
  'middle frontal gyrus': 'Part of the frontal lobe, involved in attention and planning.',
  'inferior frontal gyrus': 'On the left side this holds Broca\'s area, needed to produce speech.',
  'occipital lobe': 'Vision. The primary visual cortex sits at its back.',
  'superior temporal gyrus': 'Hearing. On the left side its back part holds Wernicke\'s area for understanding language.',
  'middle temporal gyrus': 'Part of the temporal lobe: language and memory.',
  'inferior temporal gyrus': 'Recognising objects and faces.',
  insula: 'Hidden inside the lateral sulcus. Taste, gut feelings and awareness of the body\'s internal state.',
  'cingulate gyrus': 'Part of the limbic system: emotion, motivation and the unpleasantness of pain.',
  'optic nerve': 'Cranial nerve II, from the retina to the optic chiasm through the optic canal.',
  'optic chiasm': 'Where the fibres from the nasal half of each retina cross to the other side.',
  'ventricles of the brain': 'Four connected cavities filled with cerebrospinal fluid, made by the choroid plexus.',
};

const CAT = {
  cranial: 'A cranial bone, part of the case around the brain.',
  facial: 'A facial bone, part of the face and jaws.',
  teeth: 'An adult (secondary) tooth. Adults have 32: 8 incisors, 4 canines, 8 premolars and 12 molars.',
  spine: 'Part of the vertebral column: 7 cervical, 12 thoracic and 5 lumbar vertebrae, then the sacrum and coccyx.',
  thorax: 'Part of the bony thorax, the cage that protects the heart and lungs.',
  upper: 'A bone of the upper limb.',
  lower: 'A bone of the lower limb.',
  pelvis: 'Part of the pelvic girdle.',
  larynx: 'A cartilage of the larynx (voice box).',
  hyoid: 'The hyoid bone.',
  muscle: 'A skeletal muscle. For origin, insertion and action, open it in Muscle Lab.',
  tendon: 'Dense connective tissue linking muscle to bone or spreading its pull.',
  arterial: 'An artery: carries blood away from the heart.',
  venous: 'A vein: carries blood back towards the heart.',
  brain: 'Part of the brain.',
};

export function bareName(n) {
  return n.replace(/^(left|right)\s+/i, '').replace(/^(.*) of (left|right) (.*)$/i, '$1 of $3').replace(/\s*\((left|right)\)/i, '').toLowerCase();
}

export function describe(it) {
  if (!it) return '';
  if (it.info) return it.info;
  const b = bareName(it.name);
  if (F[b]) return F[b];
  for (const [k, v] of Object.entries(F)) if (b.endsWith(k) || b.startsWith(k)) return v;
  if (/vertebra/.test(b)) return CAT.spine;
  if (/rib|costal/.test(b)) return 'Ribs 1 to 7 are true ribs (own cartilage to the sternum), 8 to 10 false ribs, 11 and 12 floating ribs.';
  if (/disk/.test(b)) return 'Intervertebral disc: a tough ring (annulus fibrosus) around a gel core (nucleus pulposus). Absorbs load between vertebrae.';
  if (/phalanx/.test(b)) return 'A phalanx. Each finger and toe has three, the thumb and big toe two.';
  if (/metacarpal/.test(b)) return 'One of five metacarpals forming the palm.';
  if (/metatarsal/.test(b)) return 'One of five metatarsals forming the arch of the foot.';
  if (/cuneiform|cuboid|navicular/.test(b)) return 'A tarsal bone of the midfoot.';
  if (/trapezi|capitate|hamate|triquetral/.test(b)) return 'One of the eight carpal bones of the wrist.';
  if (/bronch/.test(b)) return 'Bronchi divide about 23 times, from main bronchi to the tiny bronchioles that end in alveoli.';
  if (/gyrus|lobule|lobe/.test(b)) return 'A fold of the cerebral cortex.';
  if (/artery/.test(b)) return CAT.arterial;
  if (/vein/.test(b)) return CAT.venous;
  return CAT[it.cat] || '';
}

// Brain lobes from the BodyParts3D gyri
export function lobeOf(name) {
  const n = name.toLowerCase();
  if (/frontal gyrus|orbital gyrus|precentral/.test(n)) return 'frontal';
  if (/postcentral|parietal|supramarginal|angular/.test(n)) return 'parietal';
  if (/temporal|fusiform|parahippocampal/.test(n)) return 'temporal';
  if (/occipital/.test(n)) return 'occipital';
  if (/insula/.test(n)) return 'insula';
  if (/cingulate/.test(n)) return 'limbic';
  if (/cerebellum/.test(n)) return 'cerebellum';
  if (/pons|medulla|midbrain|peduncle|colliculus|interpeduncular/.test(n)) return 'brainstem';
  if (/white matter/.test(n)) return 'white';
  return 'deep';
}
