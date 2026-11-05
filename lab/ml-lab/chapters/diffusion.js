// Diffusion: forward noising with a real schedule, and DDPM style reverse steps driven by an "oracle" denoiser that knows the target images.

const N = 48; const T = 100;
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const randn = (r) => Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());

function schedule(kind) {
  const beta = []; const abar = [1];
  if (kind === 'linear') { for (let t = 1; t <= T; t++) beta[t] = 0.001 + (0.1 - 0.001) * (t - 1) / (T - 1); }
  else { const f = (t) => Math.cos(((t / T + 0.008) / 1.008) * Math.PI / 2) ** 2; for (let t = 1; t <= T; t++) beta[t] = Math.min(0.999, 1 - f(t) / f(t - 1)); }
  for (let t = 1; t <= T; t++) abar[t] = abar[t - 1] * (1 - beta[t]);
  return { beta, abar };
}

function target(kind) {
  const img = new Float32Array(N * N * 3);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let c = [0.12, 0.2, 0.42]; const u = (x + 0.5) / N; const v = (y + 0.5) / N;
    if (kind === 'sun') { c = [0.15, 0.32, 0.62]; const d = Math.hypot(u - 0.5, v - 0.45); if (d < 0.22) c = [1, 0.85, 0.3]; else if (d < 0.31 && Math.cos(10 * Math.atan2(v - 0.45, u - 0.5)) > 0.55) c = [0.98, 0.7, 0.2]; if (v > 0.82) c = [0.2, 0.45, 0.15]; }
    if (kind === 'square') { c = [0.9, 0.88, 0.8]; if (Math.abs(u - 0.5) < 0.27 && Math.abs(v - 0.5) < 0.27) c = [0.85, 0.15, 0.15]; if (Math.abs(u - 0.5) < 0.1 && Math.abs(v - 0.5) < 0.1) c = [0.98, 0.95, 0.9]; }
    if (kind === 'tri') { c = [0.1, 0.08, 0.15]; if (v > 0.18 && v < 0.82 && Math.abs(u - 0.5) < (v - 0.18) * 0.62) c = [0.35, 0.8, 0.3]; if (v > 0.82) c = [0.3, 0.2, 0.12]; }
    for (let k = 0; k < 3; k++) img[(y * N + x) * 3 + k] = c[k] * 2 - 1;
  }
  return img;
}

export default {
  mount(ctx) {
    const C = ctx.colors; const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const TARGETS = { sun: target('sun'), square: target('square'), tri: target('tri') };
    const PROMPTS = [['sun', 'a sun over a field'], ['square', 'a red square'], ['tri', 'a green triangle']];
    const uncond = new Float32Array(N * N * 3); for (const k in TARGETS) for (let i = 0; i < uncond.length; i++) uncond[i] += TARGETS[k][i] / 3;
    let mode = 'forward'; let sk = 'cosine'; let S = schedule(sk); let prompt = 'sun'; let guide = 1; let t = 40;
    const eps = new Float32Array(N * N * 3); { const r = rng(17); for (let i = 0; i < eps.length; i++) eps[i] = randn(r); }
    let seed = 99; let xt = null; let rt = T; let x0hat = null; let playing = null;

    const cv = ctx.canvas(); const g = cv.ctx;
    const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const tg = tmp.getContext('2d'); const id = tg.createImageData(N, N);
    function blit(arr, x, y, s, label, sub) {
      for (let i = 0; i < N * N; i++) for (let k = 0; k < 3; k++) id.data[i * 4 + k] = Math.max(0, Math.min(255, (arr[i * 3 + k] + 1) * 127.5));
      for (let i = 0; i < N * N; i++) id.data[i * 4 + 3] = 255;
      tg.putImageData(id, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(tmp, x, y, s, s);
      g.strokeStyle = C.borderStrong; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
      const fit = (txt) => { let o = txt; while (o.length > 3 && g.measureText(o).width > s) o = o.slice(0, -1); return o; };
      g.font = `600 ${s < 140 ? 12 : 14}px Rajdhani, sans-serif`; g.fillStyle = C.text; g.textAlign = 'left'; g.fillText(fit(label), x, y - 20);
      g.font = `500 ${s < 140 ? 10 : 11}px "DM Mono", monospace`; g.fillStyle = C.muted; g.fillText(fit(sub), x, y - 6);
    }
    const noisy = (x0, tt) => { const a = Math.sqrt(S.abar[tt]); const b = Math.sqrt(1 - S.abar[tt]); const o = new Float32Array(x0.length); for (let i = 0; i < o.length; i++) o[i] = a * x0[i] + b * eps[i]; return o; };
    const predX0 = () => { const c = TARGETS[prompt]; const o = new Float32Array(c.length); for (let i = 0; i < o.length; i++) o[i] = Math.max(-1.2, Math.min(1.2, uncond[i] + guide * (c[i] - uncond[i]))); return o; };
    function resetReverse() { const r = rng(seed++); xt = new Float32Array(N * N * 3); for (let i = 0; i < xt.length; i++) xt[i] = randn(r); rt = T; x0hat = predX0(); }
    function reverseStep() {
      if (rt <= 0) return false;
      const r = rng(seed++ * 7919); const ab = S.abar[rt]; const be = S.beta[rt]; const al = 1 - be; const abPrev = S.abar[rt - 1];
      x0hat = predX0();
      for (let i = 0; i < xt.length; i++) {
        const e = (xt[i] - Math.sqrt(ab) * x0hat[i]) / Math.sqrt(1 - ab);
        const mean = (xt[i] - (be / Math.sqrt(1 - ab)) * e) / Math.sqrt(al);
        const sig = rt > 1 ? Math.sqrt(be * (1 - abPrev) / (1 - ab)) : 0;
        xt[i] = mean + sig * randn(r);
      }
      rt--; return true;
    }
    resetReverse();

    let plot = null;
    function drawPlot(x, y, w, h, tt) {
      plot = { x, y, w, h };
      g.strokeStyle = C.border; g.lineWidth = 1; g.strokeRect(x, y, w, h);
      g.font = '500 11px "DM Mono", monospace'; g.fillStyle = C.muted; g.textAlign = 'left';
      g.fillText(`noise schedule (${sk})`, x, y - 8);
      const X = (s) => x + (s / T) * w; const Y = (v) => y + h - v * h;
      const line = (f, col) => { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); for (let s = 0; s <= T; s++) (s ? g.lineTo(X(s), Y(f(s))) : g.moveTo(X(s), Y(f(s)))); g.stroke(); };
      line((s) => Math.sqrt(S.abar[s]), C.c1); line((s) => Math.sqrt(1 - S.abar[s]), C.c4);
      g.fillStyle = C.c1; g.fillText('signal √ā', x + 6, y + 14); g.fillStyle = C.c4; g.fillText('noise √(1-ā)', x + 6, y + 28);
      g.strokeStyle = C.c2; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X(tt), y); g.lineTo(X(tt), y + h); g.stroke();
      g.fillStyle = C.c2; g.textAlign = tt > T * 0.8 ? 'right' : 'left'; g.fillText(`t = ${tt}`, X(tt) + (tt > T * 0.8 ? -5 : 5), y + h - 6);
      g.fillStyle = C.muted; g.textAlign = 'left'; g.fillText('0', x, y + h + 13); g.textAlign = 'right'; g.fillText(`${T}`, x + w, y + h + 13); g.textAlign = 'left';
    }
    function draw() {
      const w = cv.w; const h = cv.h; if (!w) return;
      g.clearRect(0, 0, w, h);
      const bottom = h - 56; const plotH = Math.min(150, bottom * 0.28);
      const imgTop = 40; const avail = bottom - plotH - 60 - imgTop;
      if (mode === 'forward') {
        const s = Math.min(avail, (w - 40) / 3); const gap = (w - 3 * s) / 2;
        const xx = noisy(TARGETS[prompt], t);
        blit(TARGETS[prompt], 0, imgTop, s, 'Clean image x0', 'a training image');
        blit(eps, gap + s, imgTop, s, 'Noise ε', 'random, fixed here');
        blit(xx, 2 * (gap + s), imgTop, s, `Noisy x_t, t = ${t}`, `signal weight ${Math.sqrt(S.abar[t]).toFixed(2)}`);
        drawPlot(0, imgTop + s + 40, w - 4, plotH, t);
      } else {
        const s = Math.min(avail, (w - 30) / 2); const gap = w - 2 * s;
        blit(xt, 0, imgTop, s, `Current x_t, t = ${rt}`, rt === T ? 'pure noise' : rt === 0 ? 'finished' : 'being denoised');
        blit(x0hat, s + gap, imgTop, s, 'Denoiser’s guess of x0', `guidance ${guide.toFixed(1)}`);
        drawPlot(0, imgTop + s + 40, w - 4, plotH, rt);
      }
    }
    cv.onResize(draw);
    let dragging = false;
    const setFromPlot = (e) => { if (mode !== 'forward' || !plot) return; const r = cv.el.getBoundingClientRect(); const x = e.clientX - r.left; const y = e.clientY - r.top; if (!dragging && (y < plot.y - 20 || y > plot.y + plot.h + 20)) return; dragging = true; t = Math.max(0, Math.min(T, Math.round(((x - plot.x) / plot.w) * T))); tSl.value = t; draw(); };
    cv.el.addEventListener('pointerdown', (e) => { setFromPlot(e); if (dragging) cv.el.setPointerCapture(e.pointerId); }, { signal: ctx.signal });
    cv.el.addEventListener('pointermove', (e) => { if (dragging) setFromPlot(e); }, { signal: ctx.signal });
    cv.el.addEventListener('pointerup', () => { dragging = false; }, { signal: ctx.signal });
    cv.el.style.touchAction = 'pan-y';

    const dock = ctx.h('<div class="dock"><div class="grp glass"><span>Process</span></div><div class="grp glass rv"><button data-a="play">Generate</button><button data-a="step">Step</button><button data-a="new">New noise</button></div></div>');
    ctx.stage.append(dock);
    const mseg = ctx.seg([['forward', 'Add noise'], ['reverse', 'Remove noise']], mode, (v) => { mode = v; stop(); sync(); draw(); });
    mseg.style.border = '0'; dock.firstChild.append(mseg);
    const playBtn = dock.querySelector('[data-a=play]');
    function stop() { if (playing) { playing(); playing = null; } playBtn.textContent = 'Generate'; }
    playBtn.onclick = () => {
      if (playing) return stop();
      if (rt <= 0) resetReverse();
      playBtn.textContent = 'Pause'; let acc = 0;
      playing = ctx.loop((tt, dt) => { acc += dt * (reduce ? 400 : 30); let n = 0; while (acc >= 1 && n < 10) { acc -= 1; n++; if (!reverseStep()) { stop(); break; } } draw(); });
    };
    dock.querySelector('[data-a=step]').onclick = () => { stop(); reverseStep(); draw(); };
    dock.querySelector('[data-a=new]').onclick = () => { stop(); resetReverse(); draw(); };

    const P = ctx.panel;
    P.append(ctx.h('<h2 class="k-h">Diffusion</h2>'), ctx.h('<p class="lede">Image generators learn to remove noise. Start from pure static, remove a little noise a hundred times, and a picture appears.</p>'));
    const tSl = ctx.slider({ label: 'Forward step t', min: 0, max: T, step: 1, value: t, fmt: (v) => `${v} of ${T}`, onInput: (v) => { t = v; draw(); } });
    const fBox = ctx.h('<div class="card"></div>'); fBox.append(tSl, ctx.h('<p class="hint">Or drag on the schedule plot.</p>'));
    const rBox = ctx.h('<div class="card"><span class="hint">Prompt (picks what the denoiser steers toward)</span></div>');
    rBox.append(ctx.seg(PROMPTS, prompt, (v) => { prompt = v; x0hat = predX0(); draw(); }));
    rBox.append(ctx.slider({ label: 'Guidance strength', min: 0, max: 3, step: 0.1, value: guide, fmt: (v) => v.toFixed(1), onInput: (v) => { guide = v; x0hat = predX0(); draw(); } }));
    rBox.append(ctx.h('<p class="hint">0 = ignore the prompt (a blurry average of everything it knows). 1 = follow it. Above 1 = exaggerate it.</p>'));
    const common = ctx.h('<div class="card"><span class="hint">Noise schedule</span></div>');
    common.append(ctx.seg([['cosine', 'Cosine'], ['linear', 'Linear']], sk, (v) => { sk = v; S = schedule(v); draw(); }));
    const sync = () => { fBox.hidden = mode !== 'forward'; rBox.hidden = mode !== 'reverse'; dock.querySelector('.rv').style.display = mode === 'reverse' ? '' : 'none'; };
    P.append(fBox, rBox, common); sync();
    P.append(
      ctx.h(`<div class="card tip"><p><b>Training:</b> take a real image, mix in a random amount of noise (the forward process, which needs no learning), and ask a neural network to predict the noise that was added. Repeat for millions of images and noise levels.</p><p><b>Generating:</b> start from pure noise. Ask the network "what noise is in here?", subtract a bit of it, add back a little fresh randomness, and repeat until t reaches 0.</p></div>`),
      ctx.h(`<div class="card try"><ol>
        <li>In <b>Add noise</b>, drag t from 0 to 100. By the end, almost nothing of the image is left.</li>
        <li>Switch the schedule to <b>Linear</b>: the image is destroyed much earlier. The cosine schedule keeps more steps useful.</li>
        <li>Go to <b>Remove noise</b> and press <b>Generate</b>. Notice that big shapes and colours appear first and fine detail last.</li>
        <li>Set guidance to <b>0</b> and generate again, then switch the prompt halfway through a run.</li>
      </ol></div>`),
      ctx.h(`<div class="card deep">
        <div class="formula">x_t = √ā_t · x_0 + √(1 − ā_t) · ε<span>ā_t is the share of the original signal left at step t; ε is Gaussian noise</span></div>
        <p><b>Honest label:</b> there is no trained network here. The "denoiser" is an oracle that already knows the three target pictures, so its noise prediction is computed exactly. A real model has to learn to predict the noise from the noisy image alone, which is the hard part; the step-by-step reverse update (DDPM sampling) is the real one.</p>
        <p><b>Text conditioning:</b> the network also receives the prompt, encoded by a text encoder (CLIP-style or a language model), usually through cross-attention. <b>Classifier-free guidance</b> runs the denoiser with and without the prompt and pushes further in the direction the prompt adds: guess = unconditional + w × (conditional − unconditional). That is what the guidance slider does here.</p>
        <p><b>In practice:</b> many systems (latent diffusion, such as Stable Diffusion) denoise a compressed latent image instead of raw pixels, then decode it. Original DDPM used 1,000 steps; modern samplers often need far fewer. Related methods (flow matching) learn a straighter path from noise to image, but the idea of iteratively turning noise into data is the same. Video models extend it over time.</p>
      </div>`),
    );
    draw();

    ctx.quiz
    document.fonts && document.fonts.ready.then(() => { if (!ctx.signal.aborted) draw(); });([
      { q: 'What does a diffusion model learn to do during training?', choices: ['Draw images stroke by stroke', 'Predict the noise that was added to a noisy image', 'Copy images from the training set', 'Sort images by style'], answer: 1, why: 'The network is trained to predict (and so remove) the added noise at many noise levels.' },
      { q: 'Where does generation start?', choices: ['From a blank white canvas', 'From pure random noise', 'From the closest training image', 'From a sketch by the user'], answer: 1, why: 'Sampling starts from Gaussian noise and denoises step by step.' },
      { q: 'What does raising guidance strength do?', choices: ['Adds more noise', 'Pushes the result harder toward the prompt, at some cost to variety and realism', 'Makes generation faster', 'Removes the text encoder'], answer: 1, why: 'Guidance amplifies the difference between the prompted and unprompted predictions.' },
    ]);
    return () => stop();
  },
};
