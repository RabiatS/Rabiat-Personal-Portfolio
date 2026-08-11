/**
 * Music bits.
 *
 *  1. "On repeat" shelf  — reads assets/listening.json and renders tiles into
 *     #listeningShelf (cool.html). Covers are optional: without one, the tile
 *     draws a gradient derived from the title so every album still looks
 *     deliberate and no image files are required.
 *
 *  2. Ambient soundtrack — a slow synthesised pad built with the Web Audio API,
 *     so there is no audio file to download. Off by default, opt-in only, and
 *     started from a click so no browser ever blocks it as autoplay. The toggle
 *     lives in the header settings popover (see script.js).
 */

/* ── 1. On repeat shelf ─────────────────────────────────────────────────── */
(function () {
  const shelf = document.getElementById('listeningShelf');
  if (!shelf) return;

  // Deterministic hue from the title, so a given album always gets the same tile.
  function hueFor(text) {
    let h = 0;
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
    return h;
  }

  function tile(track) {
    const item = document.createElement(track.url ? 'a' : 'div');
    item.className = 'listen-card';
    if (track.url) {
      item.href = track.url;
      item.target = '_blank';
      item.rel = 'noopener';
    }

    const art = document.createElement('div');
    art.className = 'listen-art';
    if (track.cover) {
      art.style.backgroundImage = `url("${track.cover}")`;
      art.classList.add('has-cover');
    } else {
      const h = hueFor(track.title + track.artist);
      art.style.background =
        `linear-gradient(140deg, hsl(${h} 62% 42%), hsl(${(h + 48) % 360} 58% 26%))`;
      const initials = document.createElement('span');
      initials.className = 'listen-initials';
      initials.textContent = track.title.trim().charAt(0).toUpperCase();
      art.appendChild(initials);
    }

    const meta = document.createElement('div');
    meta.className = 'listen-meta';
    const title = document.createElement('p');
    title.className = 'listen-title';
    title.textContent = track.title;
    const artist = document.createElement('p');
    artist.className = 'listen-artist muted';
    artist.textContent = track.artist;
    meta.append(title, artist);

    if (track.note) {
      const note = document.createElement('p');
      note.className = 'listen-note muted';
      note.textContent = track.note;
      meta.appendChild(note);
    }

    item.append(art, meta);
    return item;
  }

  fetch('assets/listening.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (!data || !Array.isArray(data.tracks) || !data.tracks.length) return;
      const section = shelf.closest('[data-listening-section]');
      const head = document.getElementById('listeningHeading');
      const blurb = document.getElementById('listeningBlurb');
      if (head && data.heading) head.textContent = data.heading;
      if (blurb && data.blurb) blurb.textContent = data.blurb;
      data.tracks.forEach((t) => {
        if (t && t.title) shelf.appendChild(tile(t));
      });
      if (section) section.hidden = false;
    })
    .catch(() => {
      /* file:// or offline: leave the shelf hidden. */
    });
})();

/* ── 2. Ambient soundtrack ──────────────────────────────────────────────── */
(function () {
  const STORAGE_KEY = 'ambientSound';
  let ctx = null;
  let master = null;
  let voices = [];
  let lfoTimer = null;

  // Slow, unresolved chord. Low volume, nothing percussive.
  const NOTES = [110, 164.81, 220, 246.94, 329.63];

  function build() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    ctx = new AudioCtx();

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.6;
    filter.connect(master);

    voices = NOTES.map((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 ? 'sine' : 'triangle';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.value = 0.055 / (i + 1);

      // Detune each voice slowly so the pad never sits perfectly still.
      const drift = ctx.createOscillator();
      drift.frequency.value = 0.03 + i * 0.017;
      const driftAmount = ctx.createGain();
      driftAmount.gain.value = 1.6;
      drift.connect(driftAmount).connect(osc.detune);

      osc.connect(gain).connect(filter);
      osc.start();
      drift.start();
      return { osc, gain, drift };
    });

    // Gentle filter sweep, the "breathing" of the pad.
    let t = 0;
    lfoTimer = setInterval(() => {
      if (!ctx) return;
      t += 1;
      const target = 700 + Math.sin(t / 14) * 320;
      filter.frequency.linearRampToValueAtTime(target, ctx.currentTime + 2.4);
    }, 2200);

    return true;
  }

  function fade(to, seconds) {
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(to, now + seconds);
  }

  function stop() {
    fade(0, 1.2);
    setTimeout(() => {
      if (!ctx) return;
      clearInterval(lfoTimer);
      voices.forEach(({ osc, drift }) => {
        try { osc.stop(); drift.stop(); } catch (e) { /* already stopped */ }
      });
      voices = [];
      ctx.close();
      ctx = null;
      master = null;
    }, 1400);
  }

  const api = {
    isOn() {
      return !!ctx;
    },
    enabled() {
      return localStorage.getItem(STORAGE_KEY) === 'on';
    },
    toggle() {
      if (ctx) {
        stop();
        localStorage.setItem(STORAGE_KEY, 'off');
        return false;
      }
      if (!build()) return false;
      // Some browsers hand back a suspended context until a gesture resumes it.
      if (ctx.state === 'suspended') ctx.resume();
      fade(0.5, 3);
      localStorage.setItem(STORAGE_KEY, 'on');
      return true;
    },
  };

  window.AmbientSound = api;

  // Deliberately not auto-started: an opt-in that survives reloads still needs a
  // gesture on the new page, so the first click anywhere resumes it.
  if (api.enabled()) {
    const resume = () => {
      if (!ctx) api.toggle();
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }

  // Never keep playing into a tab nobody is looking at.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    fade(document.hidden ? 0 : 0.5, 0.8);
  });
})();
