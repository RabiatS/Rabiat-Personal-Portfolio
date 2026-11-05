// Chapter 2: DNA structure. A 3D B-DNA helix built from the sequence you type, plus a base pairing exercise.
import * as THREE from '../../study/kit/three.min.js';
import { BASE_COL, PAIR, complement, cleanDNA, injectStyle, reduced, pointer } from './_shared.js';

const BP_TURN = 10.5; // base pairs per turn in B-DNA
const RISE = 0.34; // nm per base pair
const RAD = 1.0; // nm, so the helix is 2 nm wide
const GROOVE = 2.35; // angle between the two backbones in radians, which makes the minor and major grooves

const seqHTML = (s) => s.split('').map((b) => `<i style="color:${BASE_COL[b] || '#A0A09A'}">${b}</i>`).join('');

export default {
  mount(ctx) {
    injectStyle();
    let seq = ctx.store.get('dna:seq', 'ATGCGTACCTAGGCTTACGAATCG');
    const wrap = ctx.h('<div style="position:absolute;inset:0"></div>');
    ctx.stage.append(wrap);
    const lbl = ctx.h('<div style="position:absolute;inset:0;pointer-events:none;font:500 12px \'DM Mono\',monospace;color:#E8E8E3"></div>');
    ctx.stage.append(lbl);

    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { renderer = null; }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    const root = new THREE.Group(); scene.add(root);
    const helix = new THREE.Group(); root.add(helix);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(4, 6, 8); scene.add(key);
    const rim = new THREE.DirectionalLight(0x5eead4, 0.6); rim.position.set(-6, -3, -4); scene.add(rim);
    if (renderer) { renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); wrap.append(renderer.domElement); renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none'; }
    else wrap.append(ctx.h('<div class="k-loading">3D needs WebGL, which this browser has turned off. The pairing exercise still works.</div>'));

    const ends = [];
    const mats = {};
    const mat = (hex) => (mats[hex] ||= new THREE.MeshStandardMaterial({ color: hex, roughness: 0.45, metalness: 0.05 }));
    function clear() { helix.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); helix.clear(); }

    function build() {
      clear();
      const n = seq.length; const y0 = ((n - 1) * RISE) / 2;
      const p1 = []; const p2 = [];
      for (let i = 0; i < n; i++) {
        const a = (i * 2 * Math.PI) / BP_TURN; const y = y0 - i * RISE;
        p1.push(new THREE.Vector3(RAD * Math.cos(a), y, RAD * Math.sin(a)));
        p2.push(new THREE.Vector3(RAD * Math.cos(a + GROOVE), y, RAD * Math.sin(a + GROOVE)));
      }
      const sph = new THREE.SphereGeometry(0.11, 14, 10);
      const seg = new THREE.CylinderGeometry(0.07, 0.07, 1, 8);
      for (const [pts, col] of [[p1, 0xe8e8e3], [p2, 0xa0a09a]]) {
        // backbone: short cylinders between neighbouring phosphates
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1]; const b = pts[i]; const len = a.distanceTo(b);
          const m = new THREE.Mesh(seg, mat(col));
          m.scale.set(1, len, 1); m.position.copy(a).lerp(b, 0.5);
          m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
          helix.add(m);
        }
        for (const p of pts) { const m = new THREE.Mesh(sph, mat(col === 0xe8e8e3 ? 0xffffff : 0xc8c8c0)); m.position.copy(p); m.scale.setScalar(0.9); helix.add(m); }
      }
      const cyl = new THREE.CylinderGeometry(0.075, 0.075, 1, 10);
      const dot = new THREE.SphereGeometry(0.035, 8, 6);
      for (let i = 0; i < n; i++) {
        const b = seq[i]; const c = PAIR[b];
        const a = p1[i]; const z = p2[i];
        const mid = a.clone().lerp(z, 0.5);
        for (const [from, base] of [[a, b], [z, c]]) {
          const len = from.distanceTo(mid) * 0.92;
          const m = new THREE.Mesh(cyl, mat(BASE_COL[base]));
          m.scale.set(1, len, 1);
          const dir = mid.clone().sub(from).normalize();
          m.position.copy(from.clone().add(dir.clone().multiplyScalar(len / 2 + 0.04)));
          m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          helix.add(m);
        }
        // hydrogen bonds: two for A-T, three for G-C
        const hb = b === 'G' || b === 'C' ? 3 : 2;
        const perp = new THREE.Vector3(0, 1, 0);
        for (let k = 0; k < hb; k++) { const d = new THREE.Mesh(dot, mat(0xffffff)); d.position.copy(mid).add(perp.clone().multiplyScalar((k - (hb - 1) / 2) * 0.09)); helix.add(d); }
      }
      ends.length = 0;
      if (n) {
        ends.push([p1[0], "5'", '#E8E8E3'], [p1[n - 1], "3'", '#E8E8E3'], [p2[0], "3'", '#A0A09A'], [p2[n - 1], "5'", '#A0A09A']);
      }
      lbl.innerHTML = ends.map(([, t, c]) => `<span style="position:absolute;color:${c};text-shadow:0 1px 6px #000;transform:translate(-50%,-50%)">${t}</span>`).join('');
      fitCam();
    }

    let W = 1; let H = 1;
    function fitCam() {
      const len = Math.max(4, seq.length * RISE + 1.2);
      const vfov = (camera.fov * Math.PI) / 180;
      const dv = (len / 2) / Math.tan(vfov / 2);
      const dh = 2.8 / (Math.tan(vfov / 2) * camera.aspect);
      camera.position.set(0, 0, Math.max(dv, dh) * 1.1);
      camera.lookAt(0, 0, 0);
    }
    ctx.onResize((w, h) => { W = w; H = h; camera.aspect = w / h; camera.updateProjectionMatrix(); if (renderer) renderer.setSize(w, h, false); fitCam(); });

    let yaw = 0; let pitch = 0.12; let drag = null; let auto = !reduced();
    if (renderer) pointer(renderer.domElement, ctx.signal, {
      down: (x, y) => { drag = [x, y, yaw, pitch]; },
      move: (x, y) => { if (!drag) return; yaw = drag[2] + (x - drag[0]) * 0.01; pitch = Math.max(-1.2, Math.min(1.2, drag[3] + (y - drag[1]) * 0.006)); },
      up: () => { drag = null; },
    });
    const v = new THREE.Vector3();
    ctx.loop((t, dt) => {
      if (!renderer) return;
      if (auto && !drag) yaw += dt * 0.35;
      root.rotation.set(pitch, yaw, 0);
      renderer.render(scene, camera);
      root.updateMatrixWorld();
      const spans = lbl.children;
      ends.forEach(([p, , ], i) => {
        v.copy(p).applyMatrix4(root.matrixWorld).project(camera);
        const off = i % 2 === 0 ? -14 : 14;
        spans[i].style.left = `${(v.x * 0.5 + 0.5) * W}px`;
        spans[i].style.top = `${(-v.y * 0.5 + 0.5) * H + off}px`;
      });
    });

    // Panel
    ctx.panel.append(
      ctx.h('<h2 class="k-h">DNA structure</h2>'),
      ctx.h('<p class="lede">DNA is two long strands twisted around each other. The order of four letters along them is the genetic code. Type your own sequence and the helix rebuilds.</p>'),
      ctx.h(`<div class="legend"><span><i style="background:${BASE_COL.A}"></i>A adenine</span><span><i style="background:${BASE_COL.T}"></i>T thymine</span><span><i style="background:${BASE_COL.G}"></i>G guanine</span><span><i style="background:${BASE_COL.C}"></i>C cytosine</span><span><i style="background:#E8E8E3"></i>sugar phosphate backbone</span></div>`),
    );
    const box = ctx.h(`<div class="card"><label class="eyebrow" for="dna-in">Your strand, read 5' to 3' (up to 40 bases)</label>
      <input id="dna-in" class="txt mono" maxlength="60" autocomplete="off" spellcheck="false">
      <div class="bio-seq" aria-live="polite"></div><div class="stat"></div></div>`);
    ctx.panel.append(box);
    const inp = box.querySelector('input'); inp.value = seq;
    const out = box.querySelector('.bio-seq'); const st = box.querySelector('.stat');
    function showSeq() {
      const comp = complement(seq);
      out.innerHTML = `<span class="muted">5'</span> ${seqHTML(seq)} <span class="muted">3'</span><br><span class="muted">3'</span> ${seqHTML(comp)} <span class="muted">5'</span>`;
      const gc = seq.split('').filter((b) => b === 'G' || b === 'C').length;
      const hb = gc * 3 + (seq.length - gc) * 2;
      st.innerHTML = `<div><b>${seq.length}</b><span>base pairs</span></div><div><b>${seq.length ? Math.round((gc / seq.length) * 100) : 0}%</b><span>GC content</span></div><div><b>${hb}</b><span>H bonds</span></div><div><b>${(seq.length / BP_TURN).toFixed(1)}</b><span>turns</span></div>`;
    }
    inp.addEventListener('input', () => {
      const s = cleanDNA(inp.value).slice(0, 40);
      seq = s || 'A'; ctx.store.set('dna:seq', seq); build(); showSeq();
    }, { signal: ctx.signal });
    const ctrl = ctx.h('<div class="row"></div>');
    const spin = ctx.h(`<button class="btn ghost sm">${auto ? 'Stop spin' : 'Spin'}</button>`);
    spin.onclick = () => { auto = !auto; spin.textContent = auto ? 'Stop spin' : 'Spin'; };
    const rnd = ctx.h('<button class="btn ghost sm">Random sequence</button>');
    rnd.onclick = () => { seq = Array.from({ length: 24 }, () => 'ATGC'[Math.floor(Math.random() * 4)]).join(''); inp.value = seq; ctx.store.set('dna:seq', seq); build(); showSeq(); };
    const gcb = ctx.h('<button class="btn ghost sm">GC rich</button>');
    gcb.onclick = () => { seq = 'GCGGCCGCGCCGGCGCGGCC'; inp.value = seq; build(); showSeq(); };
    ctrl.append(spin, rnd, gcb); box.append(ctrl);
    build(); showSeq();

    ctx.panel.append(ctx.h('<div class="card tip"><p>Think of a twisted ladder. The sides are sugar and phosphate, the rungs are pairs of bases. A always pairs with T, and G always pairs with C, so one strand tells you the other. The two sides run in opposite directions, like two lanes of a road.</p></div>'));

    // Practice
    const pr = ctx.h(`<div class="card"><h3>Pairing practice</h3><p class="small">Type the complementary strand, lined up base by base under the top strand. It reads 3' to 5'.</p>
      <div class="bio-seq q"></div><input class="txt mono" maxlength="12" autocomplete="off" spellcheck="false" aria-label="Complementary strand">
      <div class="row"><button class="btn sm chk">Check</button><button class="btn ghost sm nw">New strand</button></div><p class="small fbk" aria-live="polite"></p></div>`);
    ctx.panel.append(pr);
    let task = '';
    const pq = pr.querySelector('.q'); const pin = pr.querySelector('input'); const pf = pr.querySelector('.fbk');
    const newTask = () => { task = Array.from({ length: 10 }, () => 'ATGC'[Math.floor(Math.random() * 4)]).join(''); pq.innerHTML = `<span class="muted">5'</span> ${seqHTML(task)} <span class="muted">3'</span>`; pin.value = ''; pf.textContent = ''; };
    pr.querySelector('.nw').onclick = newTask;
    pr.querySelector('.chk').onclick = () => {
      const a = cleanDNA(pin.value); const want = complement(task);
      let right = 0; let html = '';
      for (let i = 0; i < want.length; i++) { const ok = a[i] === want[i]; if (ok) right++; html += `<i style="color:${ok ? '#4ade80' : '#a78bfa'}">${a[i] || '_'}</i>`; }
      pf.innerHTML = `<span class="bio-seq"><span class="muted">3'</span> ${html} <span class="muted">5'</span></span><br>${right === want.length ? 'All 10 correct. Every A faces a T and every G faces a C.' : `${right} of ${want.length} right. The answer is ${want}.`}`;
    };
    pin.addEventListener('keydown', (e) => { if (e.key === 'Enter') pr.querySelector('.chk').click(); }, { signal: ctx.signal });
    newTask();

    ctx.panel.append(
      ctx.h('<div class="card try"><ol class="small"><li>Drag the helix to turn it. Find the wide major groove and the narrow minor groove.</li><li>Press GC rich and count the white dots between bases: three hydrogen bonds per G-C pair, two per A-T.</li><li>Look at the labels. Where one strand starts at 5\', its partner ends at 3\'.</li></ol></div>'),
      ctx.h(`<details class="more"><summary>Going deeper</summary><div class="small">
        <p><b>Numbers for B-DNA</b>, the common form in cells: about 2 nm wide, 0.34 nm between base pairs and about 10.5 base pairs per turn (about 3.4 to 3.6 nm per turn). The helix is right handed.</p>
        <p><b>Purines pair with pyrimidines.</b> A and G are purines (two rings), C and T are pyrimidines (one ring). A purine always faces a pyrimidine, so the ladder keeps an even width. That is why in double stranded DNA A equals T and G equals C (Chargaff's rules).</p>
        <p><b>Direction.</b> Each nucleotide's sugar links its 3' carbon to the next one's 5' phosphate through a phosphodiester bond. One end of a strand has a free 5' phosphate, the other a free 3' OH. The strands are antiparallel, and sequences are written 5' to 3' by convention.</p>
        <p><b>Stability.</b> G-C pairs have three hydrogen bonds and stack more strongly, so GC rich DNA needs more heat to separate (a higher melting temperature). Base stacking contributes more to stability than the hydrogen bonds themselves.</p>
        <p><b>Packing.</b> A human cell has about 6 billion base pairs (two sets of about 3.1 billion), roughly 2 m of DNA. It winds around histone octamers as nucleosomes (about 147 bp each) and folds further into chromatin. RNA differs from DNA by using ribose instead of deoxyribose and U instead of T.</p>
      </div></details>`),
    );
    ctx.quiz([
      { q: 'One strand reads 5\'-ATGC-3\'. What is the complementary strand, written 5\' to 3\'?', choices: ['5\'-TACG-3\'', '5\'-GCAT-3\'', '5\'-CGTA-3\'', '5\'-ATGC-3\''], answer: 1, why: 'The complement is 3\'-TACG-5\'. Read 5\' to 3\' it becomes GCAT, the reverse complement.' },
      { q: 'If a DNA sample is 30% adenine, how much guanine does it contain?', choices: ['30%', '20%', '40%', '70%'], answer: 1, why: 'A = T = 30%, so A + T = 60%. The other 40% is split equally between G and C: 20% each.' },
      { q: 'Why does GC rich DNA need a higher temperature to separate?', choices: ['G-C pairs have three hydrogen bonds and stack more strongly', 'G and C are heavier', 'GC rich DNA has no phosphates', 'GC rich DNA is single stranded'], answer: 0, why: 'Three hydrogen bonds plus stronger stacking make G-C pairs harder to pull apart than A-T pairs.' },
    ]);

    return () => { clear(); Object.values(mats).forEach((m) => m.dispose()); if (renderer) { renderer.dispose(); renderer.forceContextLoss?.(); } };
  },
};
