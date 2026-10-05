// Push the robot, inside the Lab worker. MuJoCo's WebAssembly build simulates
// a Unitree G1 and ONNX Runtime runs its walking policy (sim.js); the page
// only draws. The frame downloads and caches every file; after one
// { op: 'connect', port } run, the page and the simulation talk over that
// MessagePort, a step per animation frame:
//   page -> { type: 'step', dt, cmd: [vx, vy, yaw], grab, shove } -> state
//   page -> { type: 'reset' }
import { createSim } from './sim.js';
import { physicsOnly, visualGeoms, stlTriangles } from './meshes.js';

// Libraries, not model files: pinned on jsDelivr.
const MUJOCO = 'https://cdn.jsdelivr.net/npm/@mujoco/mujoco@3.14.0/mujoco.js';
const DIR = 'scenes/unitree_g1/';
const HIDDEN = new Set(['logo_link']); // an unbranded robot: the maker's logo plate stays off

export async function load(T, { fetchFile, ort }) {
  const engine = import(MUJOCO).then((m) => m.default());
  const runtime = ort();
  const text = (bytes) => new TextDecoder().decode(bytes);
  const [cfg, xml, policy] = await Promise.all([
    fetchFile('policies/locomotion.json').then(text), fetchFile(`${DIR}g1.xml`).then(text), fetchFile('policies/locomotion.onnx'),
  ]);
  // Every mesh downloads (and caches) together; each becomes triangles as it lands.
  const visuals = visualGeoms(xml).filter((v) => !HIDDEN.has(v.name));
  const files = [...new Set(visuals.map((v) => v.file))];
  const tris = Object.fromEntries(await Promise.all(files.map(async (f) => [f, stlTriangles(await fetchFile(`${DIR}assets/${f}`))])));
  const [mj, rt] = await Promise.all([engine, runtime]);
  const session = await rt.InferenceSession.create(policy, { executionProviders: ['wasm'] });
  const sim = createSim(mj, { xml: physicsOnly(xml), cfg: JSON.parse(cfg), session, ort: rt });

  // What the page needs to draw: each mesh once, and which body it rides on.
  const meshes = files.map((f) => tris[f]);
  const geoms = visuals.map((v) => ({
    body: sim.bodyId(v.body), mesh: files.indexOf(v.file), name: v.name, pos: v.pos, quat: v.quat, rgba: v.rgba,
  }));
  const transfer = meshes.flatMap((m) => [m.pos.buffer, m.nrm.buffer]);
  const scene = { output: { nbody: sim.nbody, torso: sim.torso, pelvis: sim.pelvis, bodyNames: sim.bodyNames, geoms, meshes }, transfer };
  return { sim, port: null, scene };
}

// A moment of simulated standing, so the first frame isn't the slow one.
export async function warm({ sim }) {
  await sim.advance(0.1);
  sim.reset();
}

// The robot's meshes go to the page over the port. What the frame times here
// is one policy decision, so its Speed line means what it says.
export async function run(pipe, input) {
  if (input.op !== 'connect') throw new Error(`Unknown op ${input.op}`);
  if (!pipe.scene) throw new Error('Reload the page to draw the robot again');
  pipe.port?.close();
  const port = pipe.port = input.port;
  const { sim } = pipe;
  // One message at a time: a step awaits the policy, and two must never interleave.
  let queue = Promise.resolve();
  port.onmessage = (e) => { queue = queue.then(() => handle(sim, port, e.data)); };
  const { output, transfer } = pipe.scene;
  pipe.scene = null; // the buffers move to the page
  port.postMessage({ type: 'scene', ...output }, transfer);
  sim.reset();
  await sim.control();
  sim.reset();
  return { output: { connected: true } };
}

async function handle(sim, port, m) {
  try {
    if (m.type === 'reset') { sim.reset({ inPlace: true }); return; }
    if (m.type !== 'step') return;
    if (m.cmd) sim.setCommand(m.cmd);
    sim.setGrab(m.grab || null);
    if (m.shove) sim.shove(m.shove);
    await sim.advance(m.dt);
    const s = sim.snapshot();
    port.postMessage({ type: 'state', ...s }, [s.pose.buffer]);
  } catch (err) {
    port.postMessage({ type: 'error', message: err?.message || String(err) });
  }
}
