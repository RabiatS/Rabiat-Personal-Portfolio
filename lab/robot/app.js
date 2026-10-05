// Push the robot. The simulation and the policy live in the Lab worker
// (adapter.js, sim.js); this page draws (view.js) and turns pointers, keys and
// the stick into a walking command, a grab or a shove, one step per frame.
import { mountLab, veil } from '../frame/frame.js';

const $ = (id) => document.getElementById(id);
const CRUISE = 0.5;          // m/s when nobody is steering
const TOP = 1.0;             // m/s at full stick
const TURN = 1.0;            // rad/s at most
const SHOVE_N = 150;         // newtons for 0.15 s on the torso: it recovers almost every time
const GRAB_REACH = 1.4;      // metres the pull point may lead the robot
const FLICK_N = 90;          // newtons per m/s of flick when you let go
const FLICK_MAX = 380;       // a hard flick knocks it over; a gentle one it shrugs off

const lab = await mountLab({
  slug: 'robot',
  adapter: new URL('./adapter.js', import.meta.url).href,
  gate: $('gate'), stats: $('labStats'), verb: 'wake it up',
});

const canvas = $('scene');
const touch = matchMedia('(hover: none)').matches;
let view = null, port = null, info = null, live = false, busy = false;

// ---------- start: the click is the consent to download ----------
$('start').addEventListener('click', start);
async function start() {
  if (busy || live || lab.state === 'blocked') return;
  busy = true;
  try {
    const drawing = import('./view.js'); // three.js, from jsDelivr, only now
    await lab.ensure();
    const { createView } = await drawing;
    const ch = new MessageChannel();
    port = ch.port1;
    const scene = new Promise((resolve, reject) => {
      port.onmessage = (e) => (e.data.type === 'scene' ? resolve(e.data) : e.data.type === 'error' && reject(new Error(e.data.message)));
    });
    await lab.run({ op: 'connect', port: ch.port2 }, [ch.port2]);
    info = await scene;
    view = createView(canvas, info, { phone: lab.device.phone });
    port.onmessage = onState;
    live = true;
    document.body.classList.add('live');
    $('dock').hidden = false;
    $('stick').hidden = !touch;
    showHint();
    offerVR();
    view.loop(frame);
  } catch (err) {
    veil('That did not work', null, err?.message || String(err), { label: 'Close', onClick: () => veil(null) });
  } finally {
    busy = false;
  }
}

// ---------- the frame loop: one step in flight at a time ----------
let last = 0, pending = 0, inFlight = false, state = null, shoveNext = null, lastReadout = 0;
const cmd = [0, 0, 0];
function frame(t) {
  const dt = last ? Math.min(0.1, (t - last) / 1000) : 1 / 60;
  last = t;
  steer(dt);
  pending += dt;
  if (!inFlight) {
    inFlight = true;
    port.postMessage({ type: 'step', dt: pending, cmd, grab: grabMsg(), shove: shoveNext });
    pending = 0; shoveNext = null;
  }
  view.update(dt, { follow: !grab });
  if (state && t - lastReadout > 400) {
    lastReadout = t;
    const ms = state.inferMs;
    $('readout').textContent = `${ms < 1 ? ms.toFixed(2) : ms.toFixed(1)} ms · ${Math.round(state.stepsPerSec)}${innerWidth < 480 ? '/s' : ' steps/s'}`;
  }
}

let fallTimer = 0, standingUp = false;
function onState(e) {
  const m = e.data;
  if (m.type === 'error') {
    veil('The simulation stopped', null, m.message, { label: 'Reload', onClick: () => location.reload() });
    return;
  }
  if (m.type !== 'state') return;
  inFlight = false;
  state = m;
  view.setPose(m.pose);
  view.setDrag(grab && m.anchor, grab?.target, m.force / 600);
  if (standingUp && !m.fallen) standingUp = false; // a step sent before the reset can still say it is down
  if (m.fallen && !fallTimer && !standingUp) {
    window.rkToast?.('It fell. Back up in a moment');
    say('The robot fell over.');
    fallTimer = setTimeout(() => { fallTimer = 0; reset(); }, 2200);
  }
}

function reset() {
  clearTimeout(fallTimer); fallTimer = 0;
  standingUp = true;
  release();
  port?.postMessage({ type: 'reset' });
}

// ---------- steering: arrows, WASD or the stick, relative to the camera ----------
const keys = new Set();
const stick = { x: 0, y: 0 };
let walking = true;
function yawOf(pose, b) {
  const o = 7 * b, w = pose[o + 3], x = pose[o + 4], y = pose[o + 5], z = pose[o + 6];
  return Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
}
function steer(dt) {
  let ix = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0) + stick.x;
  let iy = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0) + stick.y;
  const mag = Math.min(1, Math.hypot(ix, iy));
  let vx = walking ? CRUISE : 0, wz = 0;
  if (mag > 0.12 && state && !view.vr) {
    // Turn toward where you point, and walk once it roughly faces that way.
    const [fx, fy] = view.groundForward();
    const dx = fx * iy + fy * ix, dy = fy * iy - fx * ix; // forward * iy + right * ix
    let err = Math.atan2(dy, dx) - yawOf(state.pose, info.pelvis);
    err = Math.atan2(Math.sin(err), Math.cos(err));
    wz = Math.max(-TURN, Math.min(TURN, 2.2 * err));
    vx = TOP * mag * Math.max(0, Math.cos(err)) ** 2;
  }
  // Ease toward it: the policy was trained on commands that change smoothly.
  cmd[0] += Math.max(-1.5 * dt, Math.min(1.5 * dt, vx - cmd[0]));
  cmd[2] += Math.max(-3 * dt, Math.min(3 * dt, wz - cmd[2]));
}
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
addEventListener('keydown', (e) => {
  if (!live || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea')) return;
  if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); e.preventDefault(); hideHint(); }
  else if (e.code === 'Space' && !e.target.closest?.('button')) { e.preventDefault(); shove(); }
  else if (e.code === 'KeyR') reset();
});
addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });
addEventListener('blur', () => keys.clear());

const stickEl = $('stick'), knob = stickEl.querySelector('i');
let stickId = null;
function moveStick(e) {
  const r = stickEl.getBoundingClientRect(), max = r.width * 0.36;
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const d = Math.hypot(dx, dy);
  if (d > max) { dx *= max / d; dy *= max / d; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  stick.x = dx / max; stick.y = -dy / max;
}
stickEl.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stickEl.setPointerCapture(e.pointerId); stickEl.classList.add('on'); moveStick(e); hideHint(); });
stickEl.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) moveStick(e); });
const stickUp = (e) => { if (e.pointerId !== stickId) return; stickId = null; stick.x = stick.y = 0; knob.style.transform = ''; stickEl.classList.remove('on'); };
stickEl.addEventListener('pointerup', stickUp);
stickEl.addEventListener('pointercancel', stickUp);

$('walk').addEventListener('click', () => {
  walking = !walking;
  $('walk').setAttribute('aria-pressed', String(walking));
  say(walking ? 'Walking.' : 'Standing still.');
});

// ---------- shove: a short hard push, away from you ----------
function shove(dir, newtons = SHOVE_N) {
  if (!live || !state) return;
  if (!dir) {
    const [fx, fy] = view.groundForward(), a = (Math.random() - 0.5) * 1.1;
    dir = [fx * Math.cos(a) - fy * Math.sin(a), fx * Math.sin(a) + fy * Math.cos(a)];
  }
  shoveNext = [dir[0] * newtons, dir[1] * newtons, 0];
  view.shove(dir);
  hideHint();
}
$('shove').addEventListener('click', () => shove());
$('reset').addEventListener('click', reset);

// ---------- grab: drag the robot to push it; drag anywhere else to look around ----------
// Holding pulls on a spring. Letting go mid-flick adds a shove the way you
// flicked, as strong as the flick was fast.
let grab = null;          // { id, body, local, height, target, trail }
const pointers = new Map();
let pinch = 0;
const ndc = (e) => {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
};
function grabMsg() { return grab?.target ? { body: grab.body, local: grab.local, target: grab.target } : null; }
function aimGrab(e) {
  const p = view.groundPoint(ndc(e), grab.height);
  if (!p || !state) return;
  // Keep the pull point within reach of the robot so a far drag is a strong pull, not a teleport.
  const o = 7 * grab.body, ax = state.pose[o], ay = state.pose[o + 1];
  const anchor = state.anchor || [ax, ay, p[2]];
  grab.trail.push([performance.now(), p[0], p[1]]);
  if (grab.trail.length > 12) grab.trail.shift();
  let dx = p[0] - anchor[0], dy = p[1] - anchor[1];
  const d = Math.hypot(dx, dy);
  if (d > GRAB_REACH) { dx *= GRAB_REACH / d; dy *= GRAB_REACH / d; }
  grab.target = [anchor[0] + dx, anchor[1] + dy, p[2]];
}
function flick() {
  const now = performance.now(), recent = grab.trail.filter(([t]) => now - t < 120);
  if (recent.length < 2) return;
  const [t0, x0, y0] = recent[0], [t1, x1, y1] = recent.at(-1);
  const dt = (t1 - t0) / 1000, speed = Math.hypot(x1 - x0, y1 - y0) / Math.max(dt, 1e-3);
  if (dt > 0.02 && speed > 0.5) shove([(x1 - x0) / (speed * dt), (y1 - y0) / (speed * dt)], Math.min(FLICK_MAX, FLICK_N * speed));
}
function release() {
  grab = null;
  canvas.classList.remove('grabbing');
  view?.setDrag(null);
}
canvas.addEventListener('pointerdown', (e) => {
  if (!live) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.setPointerCapture(e.pointerId);
  if (pointers.size === 2) {
    release();
    const [a, b] = [...pointers.values()];
    pinch = Math.hypot(a.x - b.x, a.y - b.y);
    return;
  }
  const hit = view.pick(ndc(e));
  if (hit) {
    grab = { id: e.pointerId, ...hit, target: null, trail: [] };
    aimGrab(e); // hold it where you caught it; moving pulls
    canvas.classList.add('grabbing');
    hideHint();
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!live) return;
  const prev = pointers.get(e.pointerId);
  if (!prev) { hover(e); return; }
  const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch) view.zoomBy(pinch / d);
    pinch = d;
  } else if (grab && grab.id === e.pointerId) aimGrab(e);
  else if (!grab) view.orbitBy(dx, dy);
});
const up = (e) => {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = 0;
  if (grab && grab.id === e.pointerId) { if (e.type === 'pointerup') flick(); release(); }
};
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
canvas.addEventListener('wheel', (e) => { if (live) { e.preventDefault(); view.zoomBy(Math.exp(e.deltaY * 0.0012)); } }, { passive: false });
// A grab cursor over the robot (mouse only; checked a few times a second).
let hoverAt = 0;
function hover(e) {
  if (e.pointerType !== 'mouse' || performance.now() - hoverAt < 90) return;
  hoverAt = performance.now();
  canvas.classList.toggle('can-grab', !!view.pick(ndc(e)));
}

// ---------- VR, where the browser has it ----------
async function offerVR() {
  try {
    if (!(await navigator.xr?.isSessionSupported('immersive-vr'))) return;
  } catch { return; }
  const b = $('vr');
  b.hidden = false;
  b.addEventListener('click', () => {
    walking = false; $('walk').setAttribute('aria-pressed', 'false');
    // Pull a trigger to shove the robot the way the controller points.
    view.enterVR((c) => shove(view.controllerForward(c))).catch(() => window.rkToast?.('VR did not start'));
  });
}

// ---------- small words ----------
let hintTimer = 0;
function showHint() { $('hint').classList.remove('gone'); hintTimer = setTimeout(hideHint, 9000); }
function hideHint() { clearTimeout(hintTimer); $('hint').classList.add('gone'); }
function say(text) { $('said').textContent = text; }
