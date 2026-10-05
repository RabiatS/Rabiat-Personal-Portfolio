// The robot itself: a Unitree G1 in MuJoCo, walked by a small policy network.
//
// How the policy sees the robot and drives it is ported from mjswan
// (github.com/ttktjmt/mjswan, Apache 2.0, Tatsuki Tsujimoto and contributors),
// which runs the same policy in its own viewer. It was trained with mjlab's
// velocity task, so every 20 ms it reads 99 numbers:
//   body-frame linear velocity (3), angular velocity (3), gravity seen from
//   the pelvis (3), joint angles minus the rest pose (29), joint speeds (29),
//   its own previous output (29), and the walking command vx, vy, yaw rate (3)
// and answers with 29 numbers, one per joint. Each becomes a joint target
// (rest pose + scale * output), held by a PD loop at every 5 ms physics step:
//   torque = kp * (target - angle) - kd * speed, clamped by the motor limits.
// Gains, scales and the rest pose come from the policy's own sidecar JSON.

export const PHYS_DT = 0.005;   // g1.xml's timestep
export const DECIMATION = 4;    // policy every 4 physics steps: 50 Hz
export const GRAB_MAX = 600;    // newtons: the strongest pull a drag can give
const MAX_STEPS_PER_CALL = 40;  // 0.2 s of simulation; a slower device runs in slow motion instead of falling behind

// The floor is ours; the robot is g1.xml as the policy was trained on it,
// less its visual-only meshes (meshes.js says why; the physics is identical).
const SCENE = `<mujoco model="push the robot">
  <include file="g1.xml"/>
  <worldbody>
    <geom name="floor" type="plane" size="0 0 0.05" friction="1 0.005 0.0001" condim="3"/>
  </worldbody>
</mujoco>`;

// Rotate v by the inverse of the unit quaternion q = (w, x, y, z): world to body frame.
function rotInv(qw, qx, qy, qz, vx, vy, vz, out, o) {
  // t = 2 * cross(-q.xyz, v); v' = v + w t + cross(-q.xyz, t)
  const tx = 2 * (-qy * vz + qz * vy), ty = 2 * (-qz * vx + qx * vz), tz = 2 * (-qx * vy + qy * vx);
  out[o] = vx + qw * tx + (-qy * tz + qz * ty);
  out[o + 1] = vy + qw * ty + (-qz * tx + qx * tz);
  out[o + 2] = vz + qw * tz + (-qx * ty + qy * tx);
}

// xml: the robot's MJCF text, without meshes (meshes.js physicsOnly).
export function createSim(mj, { xml, cfg, session, ort }) {
  const vfs = new mj.MjVFS();
  let model;
  try {
    vfs.addBuffer('g1.xml', new TextEncoder().encode(xml));
    model = mj.MjModel.from_xml_string(SCENE, vfs);
  } finally {
    vfs.delete(); // the compiled model keeps what it needs
  }
  const data = new mj.MjData(model);
  const OBJ = mj.mjtObj;
  const id = (type, name) => {
    const i = mj.mj_name2id(model, type.value, name);
    if (i < 0) throw new Error(`The robot model has no ${name}`);
    return i;
  };

  // ---------- the policy's joint map, from its sidecar ----------
  const names = cfg.policy_joint_names;
  const term = cfg.actions.joint_pos;
  const n = names.length;
  const q0 = Float64Array.from(cfg.default_joint_pos);
  const scale = Float64Array.from(names, (j) => term.scale[j]);
  const kp = Float64Array.from(names, (j) => term.stiffness[j]);
  const kd = Float64Array.from(names, (j) => term.damping[j]);
  const qadr = Int32Array.from(names, (j) => model.jnt_qposadr[id(OBJ.mjOBJ_JOINT, j)]);
  const vadr = Int32Array.from(names, (j) => model.jnt_dofadr[id(OBJ.mjOBJ_JOINT, j)]);
  const cadr = Int32Array.from(names, (j) => id(OBJ.mjOBJ_ACTUATOR, j)); // actuators share the joint names
  const torso = id(OBJ.mjOBJ_BODY, 'torso_link');
  const pelvis = id(OBJ.mjOBJ_BODY, 'pelvis');
  const nbody = model.nbody;

  const inName = session.inputNames[0], outName = session.outputNames[0];
  const obs = new Float32Array(9 + 3 * n + 3);
  const last = new Float32Array(n);
  const target = Float64Array.from(q0);
  const cmd = new Float32Array(3);

  // ---------- pushes ----------
  // grab: a spring from a point on a body to where the pointer is, on the
  // ground plane at the height it was grabbed. shove: a short hard push.
  const GRAB_K = 800, GRAB_C = 60; // N/m, N s/m (GRAB_MAX is at the top)
  let grab = null;              // { body, local: [x,y,z], target: [x,y,z], prev: [x,y,z] | null }
  let shove = null;             // { force: [x,y,z], until }
  const anchor = new Float64Array(3);
  const force = new Float64Array(3);

  let stepIndex = 0, simTime = 0, acc = 0;
  let inferMs = 0, inferN = 0;
  let stepsWindow = [], stepsPerSec = 0;
  let fallenAt = null;

  // Back to the "stand" keyframe; in place keeps where it was and which way it faced.
  function reset({ inPlace = false } = {}) {
    const q = data.qpos;
    const x = q[0], y = q[1], yaw = Math.atan2(2 * (q[3] * q[6] + q[4] * q[5]), 1 - 2 * (q[5] * q[5] + q[6] * q[6]));
    mj.mj_resetDataKeyframe(model, data, 0);
    if (inPlace && Number.isFinite(x + y + yaw)) {
      const p = data.qpos;
      p[0] = x; p[1] = y; p[3] = Math.cos(yaw / 2); p[4] = 0; p[5] = 0; p[6] = Math.sin(yaw / 2);
    }
    mj.mj_forward(model, data);
    last.fill(0); target.set(q0);
    grab = null; shove = null; acc = 0; stepIndex = 0; simTime = 0; fallenAt = null;
  }

  async function control() {
    const q = data.qpos, v = data.qvel;
    const qw = q[3], qx = q[4], qy = q[5], qz = q[6];
    rotInv(qw, qx, qy, qz, v[0], v[1], v[2], obs, 0); // base linear velocity, body frame
    obs[3] = v[3]; obs[4] = v[4]; obs[5] = v[5];      // free-joint angular velocity is already in the body frame
    rotInv(qw, qx, qy, qz, 0, 0, -1, obs, 6);         // projected gravity
    for (let i = 0; i < n; i++) {
      obs[9 + i] = q[qadr[i]] - q0[i];
      obs[9 + n + i] = v[vadr[i]];
    }
    obs.set(last, 9 + 2 * n);
    obs.set(cmd, 9 + 3 * n);
    const t0 = performance.now();
    const out = await session.run({ [inName]: new ort.Tensor('float32', obs, [1, obs.length]) });
    const ms = performance.now() - t0;
    inferMs = inferN ? inferMs * 0.95 + ms * 0.05 : ms; inferN++;
    last.set(out[outName].data);
    for (let i = 0; i < n; i++) target[i] = q0[i] + scale[i] * last[i];
  }

  function applyForces() {
    const xfrc = data.xfrc_applied;
    xfrc.fill(0);
    force.fill(0);
    if (grab) {
      const b = grab.body, xpos = data.xpos, xmat = data.xmat, xipos = data.xipos;
      const [lx, ly, lz] = grab.local;
      for (let r = 0; r < 3; r++) {
        anchor[r] = xpos[3 * b + r] + xmat[9 * b + 3 * r] * lx + xmat[9 * b + 3 * r + 1] * ly + xmat[9 * b + 3 * r + 2] * lz;
      }
      for (let r = 0; r < 3; r++) {
        const vel = grab.prev ? (anchor[r] - grab.prev[r]) / PHYS_DT : 0;
        force[r] = GRAB_K * (grab.target[r] - anchor[r]) - GRAB_C * vel;
      }
      grab.prev = Array.from(anchor);
      const mag = Math.hypot(force[0], force[1], force[2]);
      if (mag > GRAB_MAX) for (let r = 0; r < 3; r++) force[r] *= GRAB_MAX / mag;
      // Applied at the body's centre of mass, so add the torque of pulling off-centre.
      const rx = anchor[0] - xipos[3 * b], ry = anchor[1] - xipos[3 * b + 1], rz = anchor[2] - xipos[3 * b + 2];
      const o = 6 * b;
      xfrc[o] += force[0]; xfrc[o + 1] += force[1]; xfrc[o + 2] += force[2];
      xfrc[o + 3] += ry * force[2] - rz * force[1];
      xfrc[o + 4] += rz * force[0] - rx * force[2];
      xfrc[o + 5] += rx * force[1] - ry * force[0];
    }
    if (shove) {
      if (simTime < shove.until) {
        const o = 6 * torso;
        xfrc[o] += shove.force[0]; xfrc[o + 1] += shove.force[1]; xfrc[o + 2] += shove.force[2];
      } else shove = null;
    }
  }

  function physicsStep() {
    const q = data.qpos, v = data.qvel, ctrl = data.ctrl;
    for (let i = 0; i < n; i++) ctrl[cadr[i]] = kp[i] * (target[i] - q[qadr[i]]) - kd[i] * v[vadr[i]];
    applyForces();
    mj.mj_step(model, data);
    simTime += PHYS_DT;
  }

  // Advance by dt seconds of real time; the policy runs on every 4th step.
  async function advance(dt) {
    acc += Math.min(Math.max(dt, 0), 0.25);
    let steps = 0;
    while (acc >= PHYS_DT && steps < MAX_STEPS_PER_CALL) {
      if (stepIndex % DECIMATION === 0) await control();
      physicsStep();
      stepIndex++; steps++; acc -= PHYS_DT;
    }
    if (steps >= MAX_STEPS_PER_CALL) acc = 0;
    const now = performance.now();
    stepsWindow.push([now, steps]);
    while (stepsWindow.length && now - stepsWindow[0][0] > 1000) stepsWindow.shift();
    const span = stepsWindow.length > 1 ? (now - stepsWindow[0][0]) / 1000 : 0;
    if (span > 0.25) stepsPerSec = stepsWindow.slice(1).reduce((s, [, k]) => s + k, 0) / span;
    const q = data.qpos;
    const down = q[2] < 0.45;
    if (down && fallenAt == null) fallenAt = simTime;
    if (!down) fallenAt = null;
    return steps;
  }

  // Poses for drawing: per body x y z, then quaternion w x y z.
  function snapshot() {
    const pose = new Float32Array(nbody * 7);
    const xpos = data.xpos, xquat = data.xquat;
    for (let b = 0; b < nbody; b++) {
      pose[7 * b] = xpos[3 * b]; pose[7 * b + 1] = xpos[3 * b + 1]; pose[7 * b + 2] = xpos[3 * b + 2];
      pose[7 * b + 3] = xquat[4 * b]; pose[7 * b + 4] = xquat[4 * b + 1]; pose[7 * b + 5] = xquat[4 * b + 2]; pose[7 * b + 6] = xquat[4 * b + 3];
    }
    return {
      pose,
      anchor: grab ? Array.from(anchor) : null,
      force: grab ? Math.hypot(force[0], force[1], force[2]) : 0,
      shoving: !!shove,
      fallen: fallenAt != null && simTime - fallenAt > 0.6,
      time: simTime, inferMs, stepsPerSec,
    };
  }

  const bodyNames = Array.from({ length: nbody }, (_, b) => mj.mj_id2name(model, OBJ.mjOBJ_BODY.value, b) || 'world');

  reset();
  return {
    model, data, reset, advance, snapshot, control, nbody, torso, pelvis, bodyNames,
    bodyId: (name) => id(OBJ.mjOBJ_BODY, name),
    get cmd() { return cmd; },
    setCommand(c) { cmd[0] = c[0]; cmd[1] = c[1]; cmd[2] = c[2]; },
    setGrab(g) {
      if (!g) { grab = null; return; }
      if (grab && grab.body === g.body) { grab.target = g.target; grab.local = g.local; }
      else grab = { body: g.body, local: g.local, target: g.target, prev: null };
    },
    shove(f, seconds = 0.15) { shove = { force: f, until: simTime + seconds }; },
  };
}
