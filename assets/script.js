// ============================================
// GLASS LEVEL — one continuous control, 0 (plain glass) to 100 (heavy frost).
// Defined early so the settings popover and the pre-paint inline script in each
// page head agree on the same mapping.
// ============================================
window.applyGlassLevel = function (value) {
  const t = Math.min(100, Math.max(0, Number(value) || 0)) / 100;
  const r = document.documentElement.style;
  // At t=0 this is the css.glass "plain pane" recipe: barely any blur, no fill,
  // just a hairline edge. At t=1 it is a heavy frosted panel.
  r.setProperty('--glass-blur', (1.6 + t * 38).toFixed(2) + 'px');
  r.setProperty('--glass-saturate', (1.05 + t * 1.05).toFixed(3));
  r.setProperty('--glass-alpha-boost', (-0.055 + t * 0.2).toFixed(4));
  // Drives the specular rim: strongest when clear, where a real pane would
  // catch light on its edges instead of diffusing it.
  r.setProperty('--glass-lens', (1 - t).toFixed(3));
};

// THEME TOGGLE with SECRET RAINBOW MODE
(function(){
  const btn = document.getElementById('themeToggle');
  let hoverTimeout = null;
  let secretTooltip = null;
  let isRainbowMode = localStorage.getItem('rainbowMode') === 'true';
  
  const setTheme = (mode) => {
    // Check if plain mode is active - disable dark mode toggle
    const isPlainMode = document.documentElement.classList.contains('plain-mode');
    if (isPlainMode && mode !== 'rainbow') {
      return;
    }
    
    if (mode === 'rainbow') {
      document.documentElement.classList.add('rainbow-mode');
      document.body.classList.add('rainbow-mode');
      isRainbowMode = true;
      localStorage.setItem('rainbowMode', 'true');
      localStorage.setItem('theme', 'rainbow');
      // Trigger rainbow nebula mode
      window.dispatchEvent(new CustomEvent('rainbowMode', { detail: { enabled: true } }));
      return;
    }
    
    document.documentElement.classList.remove('rainbow-mode');
    document.body.classList.remove('rainbow-mode');
    isRainbowMode = false;
    localStorage.setItem('rainbowMode', 'false');
    
    const dark = mode === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    document.body.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    window.dispatchEvent(new CustomEvent('rainbowMode', { detail: { enabled: false } }));
    // Readable brand tokens depend on the page background — re-derive them.
    window.dispatchEvent(new CustomEvent('themechange', { detail: { dark } }));
  };
  
  const createSecretTooltip = () => {
    if (secretTooltip) return;
    secretTooltip = document.createElement('div');
    secretTooltip.className = 'secret-mode-tooltip';
    secretTooltip.innerHTML = '🌈 Secret Mode';
    secretTooltip.style.cssText = `
      position: absolute;
      top: -45px;
      right: 0;
      background: linear-gradient(135deg, #ff006e, #8338ec, #3a86ff, #06ffa5, #ffbe0b, #ff006e);
      background-size: 200% 200%;
      animation: rainbowShift 2s linear infinite;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
    `;
    btn.style.position = 'relative';
    btn.appendChild(secretTooltip);
  };
  
  const showSecretTooltip = () => {
    if (!secretTooltip) createSecretTooltip();
    secretTooltip.style.opacity = '1';
    secretTooltip.style.transform = 'translateY(0)';
  };
  
  const hideSecretTooltip = () => {
    if (secretTooltip) {
      secretTooltip.style.opacity = '0';
      secretTooltip.style.transform = 'translateY(10px)';
    }
  };
  
  const showPartyModePopup = () => {
    // Remove existing popup if any
    const existing = document.querySelector('.party-mode-popup');
    if (existing) existing.remove();
    
    const popup = document.createElement('div');
    popup.className = 'party-mode-popup';
    popup.innerHTML = '🎉 Party Mode Activated! 🌈';
    popup.style.cssText = `
      position: fixed;
      top: 100px;
      left: 50%;
      transform: translateX(-50%) translateY(-20px);
      background: linear-gradient(135deg, #ff006e, #8338ec, #3a86ff, #06ffa5, #ffbe0b, #ff006e);
      background-size: 200% 200%;
      animation: rainbowShift 1s ease infinite, partyFadeIn 0.5s ease forwards, partyFadeOut 0.5s ease 2.5s forwards;
      color: white;
      padding: 16px 32px;
      border-radius: 50px;
      font-size: 18px;
      font-weight: 700;
      white-space: nowrap;
      z-index: 10001;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 60px rgba(255,0,110,0.5);
      pointer-events: none;
      opacity: 0;
    `;
    document.body.appendChild(popup);
    
    // Remove after animation completes
    setTimeout(() => {
      if (popup.parentNode) {
        popup.remove();
      }
    }, 3000);
  };
  
  const initial = localStorage.getItem('theme') ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  
  if (initial === 'rainbow' || isRainbowMode) {
    setTheme('rainbow');
  } else {
    setTheme(initial);
  }
  
  if (btn){
    // Long hover detection (3 seconds)
    btn.addEventListener('mouseenter', () => {
      hoverTimeout = setTimeout(() => {
        showSecretTooltip();
      }, 3000);
    });
    
    btn.addEventListener('mouseleave', () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
      hideSecretTooltip();
    });
    
    btn.addEventListener('click', (e) => {
      // Check if plain mode is active - disable theme toggle
      const isPlainMode = document.documentElement.classList.contains('plain-mode');
      if (isPlainMode) {
        const tooltip = document.createElement('div');
        tooltip.textContent = document.documentElement.classList.contains('plain-mode--rabiat')
          ? 'Theme is fixed while Rabiat minimal mode is on'
          : 'Dark mode disabled in Minimalist Mode';
        tooltip.style.cssText = `
          position: fixed;
          top: 100px;
          left: 50%;
          transform: translateX(-50%);
          background: #000000;
          color: #ffffff;
          padding: 12px 24px;
          border-radius: 4px;
          font-size: 13px;
          z-index: 10003;
          pointer-events: none;
        `;
        document.body.appendChild(tooltip);
        setTimeout(() => {
          tooltip.style.opacity = '0';
          tooltip.style.transition = 'opacity 0.3s ease';
          setTimeout(() => tooltip.remove(), 300);
        }, 2000);
        return;
      }
      
      // If secret tooltip is visible, activate rainbow mode
      if (secretTooltip && secretTooltip.style.opacity === '1') {
        e.stopPropagation();
        setTheme('rainbow');
        hideSecretTooltip();
        // Fun animation
        btn.style.transform = 'scale(1.3) rotate(360deg)';
        setTimeout(() => {
          btn.style.transform = '';
        }, 600);
        
        // Show party mode popup
        showPartyModePopup();
        
        // Add rainbow effects to VR headset for 3 seconds only
        const vrEye = document.getElementById('vrEye');
        if (vrEye) {
          vrEye.classList.add('rainbow-vr-temp');
          setTimeout(() => {
            vrEye.classList.remove('rainbow-vr-temp');
          }, 3000);
        }
        
        return;
      }
      
      // Normal toggle between light/dark
      if (isRainbowMode) {
        setTheme('dark');
      } else {
        const now = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        setTheme(now);
      }
    });
  }
})();

// FUN COLORS TOGGLE - Cycles through different color themes
(function(){
  const btn = document.getElementById('funToggle');
  if (!btn) return;
  
  const colorSchemes = [
    // Original themes
    { name: 'default', primary: '#7c3aed', accent: '#ec4899', hero: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #f59e0b 100%)' },
    
    // New themes from user request
    { name: 'magenta', primary: '#9b4d7d', accent: '#d4a5c9', hero: 'linear-gradient(135deg, #7a3a5c 0%, #9b4d7d 50%, #d4a5c9 100%)' },
    { name: 'bronze-copper', primary: '#b87333', accent: '#d4a574', hero: 'linear-gradient(135deg, #8b5a2b 0%, #b87333 50%, #d4a574 100%)' },
    { name: 'periwinkle', primary: '#4169a1', accent: '#a8b5d9', hero: 'linear-gradient(135deg, #2d4a7a 0%, #4169a1 50%, #a8b5d9 100%)' },
    { name: 'mint-seafoam', primary: '#3d9a8b', accent: '#98d9cd', hero: 'linear-gradient(135deg, #2a7267 0%, #3d9a8b 50%, #98d9cd 100%)' },
    { name: 'wine-burgundy', primary: '#722f37', accent: '#c9a5a5', hero: 'linear-gradient(135deg, #4a1d22 0%, #722f37 50%, #c9a5a5 100%)' },
    { name: 'turquoise', primary: '#40a4b8', accent: '#8fd4e0', hero: 'linear-gradient(135deg, #2d7a8a 0%, #40a4b8 50%, #8fd4e0 100%)' },
    { name: 'mauve-lilac', primary: '#7b5d8e', accent: '#c9b3d4', hero: 'linear-gradient(135deg, #5a4268 0%, #7b5d8e 50%, #c9b3d4 100%)' },
    { name: 'gold-mustard', primary: '#c9a227', accent: '#e8d590', hero: 'linear-gradient(135deg, #9a7b1c 0%, #c9a227 50%, #e8d590 100%)' },
    { name: 'steel-blue', primary: '#4a6d8c', accent: '#a8c0d4', hero: 'linear-gradient(135deg, #345068 0%, #4a6d8c 50%, #a8c0d4 100%)' },
    { name: 'celadon', primary: '#5b9a6f', accent: '#a8d4b4', hero: 'linear-gradient(135deg, #3d7050 0%, #5b9a6f 50%, #a8d4b4 100%)' },
    { name: 'pastel-maroon', primary: '#6b4d3a', accent: '#d4a5a5', hero: 'linear-gradient(135deg, #4a342a 0%, #6b4d3a 50%, #d4a5a5 100%)' },
    { name: 'ocean-blue', primary: '#4a7dc4', accent: '#a8c8e8', hero: 'linear-gradient(135deg, #2d5a9a 0%, #4a7dc4 50%, #a8c8e8 100%)' },
    { name: 'forest-green', primary: '#3d6b4f', accent: '#6ba87d', hero: 'linear-gradient(135deg, #2a4a36 0%, #3d6b4f 50%, #6ba87d 100%)' },
    { name: 'sunset-orange', primary: '#cc8844', accent: '#f5d4b3', hero: 'linear-gradient(135deg, #a66633 0%, #cc8844 50%, #f5d4b3 100%)' },
    { name: 'lavender-purple', primary: '#7b68c4', accent: '#c4b3e8', hero: 'linear-gradient(135deg, #5a4a9a 0%, #7b68c4 50%, #c4b3e8 100%)' },
    { name: 'coral-pink', primary: '#c94444', accent: '#e8a8a8', hero: 'linear-gradient(135deg, #a63333 0%, #c94444 50%, #e8a8a8 100%)' },
    { name: 'midnight-navy', primary: '#2d4466', accent: '#7a99bb', hero: 'linear-gradient(135deg, #1a2a40 0%, #2d4466 50%, #7a99bb 100%)' },
    { name: 'sage-mint', primary: '#5a9a6f', accent: '#b3d9c4', hero: 'linear-gradient(135deg, #3d7050 0%, #5a9a6f 50%, #b3d9c4 100%)' },
    { name: 'rose-gold', primary: '#b8756d', accent: '#e8c8b3', hero: 'linear-gradient(135deg, #9a5a52 0%, #b8756d 50%, #e8c8b3 100%)' },
    { name: 'slate-gray', primary: '#4a5568', accent: '#a0aec0', hero: 'linear-gradient(135deg, #2d3748 0%, #4a5568 50%, #a0aec0 100%)' },
    { name: 'teal-cyan', primary: '#2d8a8a', accent: '#7dd4d4', hero: 'linear-gradient(135deg, #1a6060 0%, #2d8a8a 50%, #7dd4d4 100%)' },
    { name: 'plum-berry', primary: '#8b4a8b', accent: '#d4a5d4', hero: 'linear-gradient(135deg, #6b2d6b 0%, #8b4a8b 50%, #d4a5d4 100%)' },
    { name: 'amber-honey', primary: '#cc9944', accent: '#f5e0b3', hero: 'linear-gradient(135deg, #a67a33 0%, #cc9944 50%, #f5e0b3 100%)' },
    { name: 'sky-azure', primary: '#4a8acc', accent: '#b3d4f5', hero: 'linear-gradient(135deg, #336ba6 0%, #4a8acc 50%, #b3d4f5 100%)' },
    { name: 'lime-green', primary: '#5a9a44', accent: '#a8d990', hero: 'linear-gradient(135deg, #3d7030 0%, #5a9a44 50%, #a8d990 100%)' },
    { name: 'crimson-red', primary: '#b83030', accent: '#e8a0a0', hero: 'linear-gradient(135deg, #8b2020 0%, #b83030 50%, #e8a0a0 100%)' },
    { name: 'indigo-violet', primary: '#6b5acd', accent: '#b3a8e8', hero: 'linear-gradient(135deg, #4a3da6 0%, #6b5acd 50%, #b3a8e8 100%)' },
    { name: 'peach-apricot', primary: '#cc7744', accent: '#f5d0b3', hero: 'linear-gradient(135deg, #a65a33 0%, #cc7744 50%, #f5d0b3 100%)' },
    { name: 'charcoal', primary: '#3d3d3d', accent: '#8a8a8a', hero: 'linear-gradient(135deg, #2a2a2a 0%, #3d3d3d 50%, #8a8a8a 100%)' },
    { name: 'emerald-jade', primary: '#3d9a6b', accent: '#7dd4a8', hero: 'linear-gradient(135deg, #2a7050 0%, #3d9a6b 50%, #7dd4a8 100%)' }
  ];
  
  const PLAIN_VARIANT_CLASSIC = 'classic';
  const PLAIN_VARIANT_RABIAT = 'rabiat';
  const RABIAT_VOID = '#0a0a0f';
  const RABIAT_TRAIL = 'rgba(184, 30, 44, 0.45)';

  let currentScheme = parseInt(localStorage.getItem('colorScheme') || '0');
  let isPlainMode = localStorage.getItem('plainMode') === 'true';

  /* ── Readable color derivation ────────────────────────────────────────────
     Several schemes are very light (gold #c9a227, amber accent #f5e0b3).
     Using those raw as link text, or painting white on top of them, drops
     below 4.5:1. These helpers derive two tokens the stylesheet consumes:
       --primary-readable : the brand hue, nudged until it reads on the page
       --on-primary       : black or white, whichever reads on a brand fill
     Recomputed on every scheme change and every theme flip.               */
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  }

  function rgbToHex({ r, g, b }) {
    const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${c(r)}${c(g)}${c(b)}`;
  }

  function relLuminance({ r, g, b }) {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }

  function contrast(a, b) {
    const l1 = relLuminance(a);
    const l2 = relLuminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  function mix(c, target, amount) {
    return {
      r: c.r + (target.r - c.r) * amount,
      g: c.g + (target.g - c.g) * amount,
      b: c.b + (target.b - c.b) * amount,
    };
  }

  // Walk the hue toward black (light theme) or white (dark theme) until it clears 4.5:1.
  function readableOn(colorHex, backgroundHex) {
    const bg = hexToRgb(backgroundHex);
    const target = relLuminance(bg) > 0.5 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 };
    let color = hexToRgb(colorHex);
    for (let step = 0; step <= 20; step++) {
      const candidate = mix(hexToRgb(colorHex), target, step * 0.05);
      color = candidate;
      if (contrast(candidate, bg) >= 4.5) break;
    }
    return rgbToHex(color);
  }

  // Foreground for a brand-colored fill. Checks the lighter of primary/accent
  // so it stays legible across the primary→accent gradients (.btn, .cs-hero).
  function foregroundFor(primaryHex, accentHex) {
    const white = { r: 255, g: 255, b: 255 };
    const black = { r: 17, g: 17, b: 17 };
    const lighter =
      relLuminance(hexToRgb(primaryHex)) > relLuminance(hexToRgb(accentHex))
        ? hexToRgb(primaryHex)
        : hexToRgb(accentHex);
    return contrast(white, lighter) >= contrast(black, lighter) ? '#ffffff' : '#111111';
  }

  function applyReadableTokens(primaryHex, accentHex) {
    const root = document.documentElement;
    const dark = root.classList.contains('dark');
    const pageBg = dark ? '#111011' : '#fefefe';
    root.style.setProperty('--primary-readable', readableOn(primaryHex, pageBg));
    root.style.setProperty('--accent-readable', readableOn(accentHex, pageBg));
    root.style.setProperty('--on-primary', foregroundFor(primaryHex, accentHex));
  }

  // Re-derive when the light/dark toggle flips the page background.
  window.addEventListener('themechange', () => {
    const scheme = colorSchemes[currentScheme] || colorSchemes[0];
    if (!document.documentElement.classList.contains('plain-mode')) {
      applyReadableTokens(scheme.primary, scheme.accent);
    }
  });
  let plainCursorTrailColor = '#000000';
  let hoverTimeout = null;
  let plainModePopup = null;
  let hoverStartTime = null;
  
  function applyScheme(index) {
    // Remove plain mode if active
    if (isPlainMode) {
      document.documentElement.classList.remove('plain-mode');
      document.documentElement.classList.remove('plain-mode--rabiat');
      isPlainMode = false;
      localStorage.setItem('plainMode', 'false');
      localStorage.removeItem('plainModeVariant');
      
      // Re-enable nebula canvas
      const nebula = document.getElementById('nebula');
      if (nebula) {
        nebula.style.display = '';
      }
      
      // Re-enable VR eye (combine both restorations)
      const vrEye = document.getElementById('vrEye');
      if (vrEye) {
        vrEye.style.display = '';
        vrEye.style.visibility = '';
        vrEye.style.pointerEvents = '';
      }
      
      // Remove cursor trail
      removeCursorTrail();
      
      // Re-enable the header controls that plain mode greys out
      setPlainModeControls(false);
      
      // Restore eyebrow emoji (reload page or restore from original)
      const eyebrow = document.querySelector('.eyebrow');
      if (eyebrow && !eyebrow.textContent.includes('👋')) {
        eyebrow.textContent = 'Hey there! 👋🏾';
      }
      
      // Force cleanup of ::before pseudo-elements by triggering reflow
      const sectionsWithBefore = document.querySelectorAll('#skills, #education');
      sectionsWithBefore.forEach(section => {
        // Force browser to recalculate styles
        void section.offsetHeight;
      });
      
      // Restore dark mode if it was active before plain mode
      const themeBeforePlain = localStorage.getItem('themeBeforePlain');
      if (themeBeforePlain === 'dark') {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
        localStorage.setItem('theme', 'light');
      }
      localStorage.removeItem('themeBeforePlain');
    }
    
    const scheme = colorSchemes[index];
    const root = document.documentElement;
    root.style.setProperty('--primary', scheme.primary);
    root.style.setProperty('--accent', scheme.accent);
    applyReadableTokens(scheme.primary, scheme.accent);
    
    // Theme colors drive CSS ambient orbs; clear legacy inline hero gradient
    const hero = document.querySelector('.hero--fullscreen');
    if (hero) {
      hero.style.background = '';
      hero.style.backgroundSize = '';
      hero.style.animation = '';
    }
    
    localStorage.setItem('colorScheme', index.toString());
  }
  
  function createPlainModePopup() {
    if (plainModePopup) return;
    
    plainModePopup = document.createElement('div');
    plainModePopup.className = 'plain-mode-popup';
    plainModePopup.innerHTML = `
      <div class="plain-mode-popup-content">
        <p style="margin-bottom: 8px; font-size: 14px; font-weight: 600;">Minimalist Mode</p>
        <p style="margin-bottom: 14px; font-size: 12px; color: #444; line-height: 1.4;">Pick a look. Both stay minimal (no galaxy, no VR hero).</p>
        <button type="button" id="activatePlainClassic" class="plain-mode-btn" style="
          background: #000;
          color: #fff;
          border: 1px solid #000;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 13px;
          width: 100%;
        ">Classic light</button>
        <button type="button" id="activatePlainRabiat" class="plain-mode-btn" style="
          background: #0a0a0f;
          color: #ececee;
          border: 1px solid #b81e2c;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 13px;
          width: 100%;
          margin-top: 8px;
        ">Rabiat theme (brand)</button>
        <button type="button" id="cancelPlainMode" class="plain-mode-btn" style="
          background: transparent;
          color: #000;
          border: 1px solid #000;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 13px;
          width: 100%;
          margin-top: 8px;
        ">Cancel</button>
      </div>
    `;
    plainModePopup.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ffffff;
      border: 2px solid #000000;
      padding: 24px;
      z-index: 10002;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      min-width: 200px;
    `;
    document.body.appendChild(plainModePopup);
    
    document.getElementById('activatePlainClassic').addEventListener('click', () => {
      applyPlainMode(PLAIN_VARIANT_CLASSIC);
      removePlainModePopup();
    });
    document.getElementById('activatePlainRabiat').addEventListener('click', () => {
      applyPlainMode(PLAIN_VARIANT_RABIAT);
      removePlainModePopup();
    });
    
    document.getElementById('cancelPlainMode').addEventListener('click', () => {
      removePlainModePopup();
      hoverStartTime = null;
    });
  }
  
  function removePlainModePopup() {
    if (plainModePopup) {
      plainModePopup.remove();
      plainModePopup = null;
    }
  }
  
  function applyPlainMode(variant) {
    const rabiat = variant === PLAIN_VARIANT_RABIAT;
    const wasDarkBefore =
      document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
    if (wasDarkBefore) {
      localStorage.setItem('themeBeforePlain', 'dark');
    } else {
      localStorage.removeItem('themeBeforePlain');
    }

    document.documentElement.classList.add('plain-mode');
    if (rabiat) {
      document.documentElement.classList.add('plain-mode--rabiat');
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
      plainCursorTrailColor = RABIAT_TRAIL;
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('plain-mode--rabiat');
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      plainCursorTrailColor = '#000000';
      localStorage.setItem('theme', 'light');
    }

    isPlainMode = true;
    localStorage.setItem('plainMode', 'true');
    localStorage.setItem('plainModeVariant', variant);

    const root = document.documentElement;
    if (rabiat) {
      root.style.setProperty('--primary', '#b81e2c');
      root.style.setProperty('--accent', '#4a8f8f');
      applyReadableTokens('#b81e2c', '#4a8f8f');
    } else {
      root.style.setProperty('--primary', '#000000');
      root.style.setProperty('--accent', '#000000');
      applyReadableTokens('#000000', '#000000');
    }

    const hero = document.querySelector('.hero--fullscreen');
    if (hero) {
      hero.style.background = rabiat ? RABIAT_VOID : '#ffffff';
      hero.style.backgroundSize = '100% 100%';
    }
    
    // Hide nebula canvas
    const nebula = document.getElementById('nebula');
    if (nebula) {
      nebula.style.display = 'none';
    }
    
    // Hide VR eye but keep space
    const vrEye = document.getElementById('vrEye');
    if (vrEye) {
      vrEye.style.visibility = 'hidden';
      vrEye.style.pointerEvents = 'none';
    }
    
    // Remove emojis from eyebrow
    const eyebrow = document.querySelector('.eyebrow');
    if (eyebrow) {
      eyebrow.textContent = eyebrow.textContent.replace(/[👋🏾👋]/g, '').trim();
      if (!eyebrow.textContent) {
        eyebrow.textContent = 'Hello';
      }
    }
    
    // Initialize cursor trail
    initCursorTrail();
    
    // Add exit button to header
    setPlainModeControls(true);
    
    removePlainModePopup();
  }
  
  /* Plain mode used to drop a fixed "Exit Minimalist Mode" button at top-right,
     which sat directly on top of the header controls and blocked them. Instead
     we grey out the controls that genuinely do not apply (the theme toggle is
     already a no-op in plain mode) and leave the palette button, which is what
     exits, fully usable. */
  function setPlainModeControls(active) {
    // Clear any button left over from a previously cached session.
    const stale = document.getElementById('exitPlainMode');
    if (stale) stale.remove();

    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
      themeBtn.setAttribute('data-disabled', String(active));
      themeBtn.setAttribute('aria-disabled', String(active));
      themeBtn.title = active ? 'Theme locked in minimalist mode' : '';
    }

    const funBtn = document.getElementById('funToggle');
    if (funBtn) {
      funBtn.title = active ? 'Exit minimalist mode' : 'Fun colors';
    }

    // A visible way out that does not sit on top of anything: a low-profile
    // chip in the bottom-left, away from the header controls and the nav.
    const existing = document.getElementById('plainExitChip');
    if (!active) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;

    const chip = document.createElement('button');
    chip.id = 'plainExitChip';
    chip.type = 'button';
    chip.className = 'plain-exit-chip';
    chip.innerHTML = '<span aria-hidden="true">←</span> Exit minimalist mode';
    chip.addEventListener('click', () => {
      currentScheme = 0;
      isPlainMode = false;
      localStorage.setItem('plainMode', 'false');
      localStorage.removeItem('plainModeVariant');
      applyScheme(currentScheme);
      chip.remove();
    });
    document.body.appendChild(chip);
  }

  // Cursor trail effect for plain mode
  let trailParticles = [];
  let trailMouseMoveHandler = null;
  
  function initCursorTrail() {
    if (trailMouseMoveHandler) return; // Already initialized
    
    trailMouseMoveHandler = (e) => {
      if (!isPlainMode) {
        removeCursorTrail();
        return;
      }
      
      const x = e.clientX;
      const y = e.clientY;
      
      // Create trail particle
      const particle = document.createElement('div');
      particle.className = 'cursor-trail-particle';
      particle.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        width: 3px;
        height: 3px;
        background: ${plainCursorTrailColor};
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        opacity: 0.4;
        transition: opacity 0.5s ease;
      `;
      document.body.appendChild(particle);
      trailParticles.push(particle);
      
      // Fade out and remove after delay
      setTimeout(() => {
        particle.style.opacity = '0';
        setTimeout(() => {
          if (particle.parentNode) {
            particle.remove();
          }
          const index = trailParticles.indexOf(particle);
          if (index > -1) trailParticles.splice(index, 1);
        }, 500);
      }, 200);
      
      // Keep only last 8 particles
      if (trailParticles.length > 8) {
        const old = trailParticles.shift();
        if (old && old.parentNode) {
          old.style.opacity = '0';
          setTimeout(() => old.remove(), 100);
        }
      }
    };
    
    document.addEventListener('mousemove', trailMouseMoveHandler, { passive: true });
  }
  
  function removeCursorTrail() {
    if (trailMouseMoveHandler) {
      document.removeEventListener('mousemove', trailMouseMoveHandler);
      trailMouseMoveHandler = null;
    }
    
    // Remove all trail particles
    trailParticles.forEach(particle => {
      if (particle && particle.parentNode) {
        particle.style.opacity = '0';
        setTimeout(() => particle.remove(), 100);
      }
    });
    trailParticles = [];
    
    // Also remove any remaining particles by class
    document.querySelectorAll('.cursor-trail-particle').forEach(el => el.remove());
  }
  
  // Apply saved state on load
  if (isPlainMode) {
    if (!localStorage.getItem('plainModeVariant')) {
      localStorage.setItem('plainModeVariant', PLAIN_VARIANT_CLASSIC);
    }
    const variant = localStorage.getItem('plainModeVariant') || PLAIN_VARIANT_CLASSIC;
    const rabiat = variant === PLAIN_VARIANT_RABIAT;
    document.documentElement.classList.add('plain-mode');
    if (rabiat) {
      document.documentElement.classList.add('plain-mode--rabiat');
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
      plainCursorTrailColor = RABIAT_TRAIL;
    } else {
      document.documentElement.classList.remove('plain-mode--rabiat');
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      plainCursorTrailColor = '#000000';
    }

    const root = document.documentElement;
    if (rabiat) {
      root.style.setProperty('--primary', '#b81e2c');
      root.style.setProperty('--accent', '#4a8f8f');
      applyReadableTokens('#b81e2c', '#4a8f8f');
    } else {
      root.style.setProperty('--primary', '#000000');
      root.style.setProperty('--accent', '#000000');
      applyReadableTokens('#000000', '#000000');
    }

    const hero = document.querySelector('.hero--fullscreen');
    if (hero) {
      hero.style.background = rabiat ? RABIAT_VOID : '#ffffff';
      hero.style.backgroundSize = '100% 100%';
    }
    
    // Hide nebula canvas
    const nebula = document.getElementById('nebula');
    if (nebula) {
      nebula.style.display = 'none';
    }
    
    // Hide VR eye but keep space
    const vrEye = document.getElementById('vrEye');
    if (vrEye) {
      vrEye.style.visibility = 'hidden';
      vrEye.style.pointerEvents = 'none';
    }
    
    // Remove emojis from eyebrow
    const eyebrow = document.querySelector('.eyebrow');
    if (eyebrow) {
      eyebrow.textContent = eyebrow.textContent.replace(/[👋🏾👋]/g, '').trim();
      if (!eyebrow.textContent) {
        eyebrow.textContent = 'Hello';
      }
    }
    
    // Initialize cursor trail
    initCursorTrail();
    
    // Add exit button
    setPlainModeControls(true);
  } else {
    applyScheme(currentScheme);
  }
  
  // Click handler for color scheme cycling or exiting plain mode
  btn.addEventListener('click', () => {
    // Check actual state, not just variable
    const actuallyInPlainMode = document.documentElement.classList.contains('plain-mode');
    
    if (actuallyInPlainMode) {
      // Exit plain mode - go back to first color scheme
      currentScheme = 0;
      isPlainMode = false;
      localStorage.setItem('plainMode', 'false');
      applyScheme(currentScheme);
      
      setPlainModeControls(false);
      
      // Fun animation on button
      btn.style.transform = 'scale(1.2) rotate(180deg)';
      setTimeout(() => {
        btn.style.transform = '';
      }, 300);
    } else {
      currentScheme = (currentScheme + 1) % colorSchemes.length;
      applyScheme(currentScheme);
      
      // Fun animation on button
      btn.style.transform = 'scale(1.2) rotate(180deg)';
      setTimeout(() => {
        btn.style.transform = '';
      }, 300);
    }
  });
  
  // Hover handler for plain mode unlock
  btn.addEventListener('mouseenter', () => {
    const actuallyInPlainMode = document.documentElement.classList.contains('plain-mode');
    if (actuallyInPlainMode || plainModePopup) return;
    hoverStartTime = Date.now();
    
    hoverTimeout = setTimeout(() => {
      createPlainModePopup();
    }, 5000);
  });
  
  btn.addEventListener('mouseleave', () => {
    // Only clear timeout if popup hasn't been shown yet
    if (hoverTimeout && !plainModePopup) {
      clearTimeout(hoverTimeout);
      hoverTimeout = null;
    }
    hoverStartTime = null;
    // Don't remove popup on mouse leave - let user click buttons
  });
  
  // Close popup when clicking outside
  document.addEventListener('click', (e) => {
    if (plainModePopup && !plainModePopup.contains(e.target) && e.target !== btn) {
      removePlainModePopup();
      hoverStartTime = null;
    }
  });
})();

// YEAR IN FOOTER
document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
});


// INTERACTIVE GALAXY CANVAS with SHOOTING STARS
(function(){
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.getElementById('nebula');
  if(!canvas || reduce) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  let w=0, h=0, dpr=1, stars=[], shootingStars=[];
  // smoothed mouse (current follows target)
  let target = {x:0.5, y:0.5}, cur = {x:0.5, y:0.5};
  let lastShootingStar = 0;
  let rainbowMode = localStorage.getItem('rainbowMode') === 'true';

  // Rainbow color palette
  const rainbowColors = [
    {r:255, g:0, b:110},   // Pink
    {r:131, g:56, b:236},  // Purple
    {r:58, g:134, b:255},  // Blue
    {r:6, g:255, b:165},   // Cyan
    {r:255, g:190, b:11},  // Yellow
    {r:255, g:0, b:110}    // Pink (loop)
  ];

  function getRainbowColor(t, offset = 0) {
    const index = Math.floor((t + offset) * rainbowColors.length) % rainbowColors.length;
    const nextIndex = (index + 1) % rainbowColors.length;
    const blend = ((t + offset) * rainbowColors.length) % 1;
    const c1 = rainbowColors[index];
    const c2 = rainbowColors[nextIndex];
    return {
      r: Math.round(c1.r + (c2.r - c1.r) * blend),
      g: Math.round(c1.g + (c2.g - c1.g) * blend),
      b: Math.round(c1.b + (c2.b - c1.b) * blend)
    };
  }

  function parseCssColor(str) {
    if (!str) return null;
    str = str.trim();
    if (str.startsWith('#')) {
      const h = str.slice(1);
      const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
      if (full.length !== 6) return null;
      return {
        r: parseInt(full.slice(0, 2), 16),
        g: parseInt(full.slice(2, 4), 16),
        b: parseInt(full.slice(4, 6), 16)
      };
    }
    const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    return null;
  }

  function getThemeColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      primary: parseCssColor(style.getPropertyValue('--primary')) || { r: 124, g: 58, b: 237 },
      accent: parseCssColor(style.getPropertyValue('--accent')) || { r: 236, g: 72, b: 153 }
    };
  }

  const canvasOrbs = [
    { nx: 0.2, ny: 0.3, r: 0.38, role: 'primary', phase: 0, speed: 0.11 },
    { nx: 0.78, ny: 0.25, r: 0.34, role: 'accent', phase: 2.1, speed: 0.09 },
    { nx: 0.5, ny: 0.72, r: 0.4, role: 'blend', phase: 4.3, speed: 0.08 }
  ];

  function drawCanvasOrbs(t, offsetX, offsetY) {
    const { primary, accent } = getThemeColors();
    const blend = {
      r: Math.round((primary.r + accent.r) / 2),
      g: Math.round((primary.g + accent.g) / 2),
      b: Math.round((primary.b + accent.b) / 2)
    };
    const size = Math.max(w, h);

    for (const orb of canvasOrbs) {
      const color = orb.role === 'accent' ? accent : orb.role === 'blend' ? blend : primary;
      const px = (orb.nx + Math.sin(t * orb.speed + orb.phase) * 0.07 + (cur.x - 0.5) * 0.04) * w + offsetX * 0.3;
      const py = (orb.ny + Math.cos(t * orb.speed * 0.85 + orb.phase) * 0.06 + (cur.y - 0.5) * 0.04) * h + offsetY * 0.3;
      const radius = orb.r * size * (0.92 + Math.sin(t * 0.4 + orb.phase) * 0.06);
      const g = ctx.createRadialGradient(px, py, 0, px, py, radius);
      g.addColorStop(0, `rgba(${color.r},${color.g},${color.b},0.14)`);
      g.addColorStop(0.45, `rgba(${color.r},${color.g},${color.b},0.06)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // Soft moving streak
    const streakAngle = t * 0.06;
    const sx = w * (0.35 + Math.sin(t * 0.05) * 0.12) + offsetX;
    const sy = h * (0.48 + Math.cos(t * 0.04) * 0.08) + offsetY;
    const len = size * 0.55;
    const ex = sx + Math.cos(streakAngle) * len;
    const ey = sy + Math.sin(streakAngle) * len;
    const streak = ctx.createLinearGradient(sx, sy, ex, ey);
    streak.addColorStop(0, 'rgba(0,0,0,0)');
    streak.addColorStop(0.35, `rgba(${accent.r},${accent.g},${accent.b},0.07)`);
    streak.addColorStop(0.65, `rgba(${primary.r},${primary.g},${primary.b},0.09)`);
    streak.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = streak;
    ctx.fillRect(0, 0, w, h);
  }

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.parentElement.getBoundingClientRect();
    w = canvas.width  = Math.floor(rect.width  * dpr);
    h = canvas.height = Math.floor(rect.height * dpr);
    canvas.style.width  = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    seed();
  }

  function seed(){
    const baseCount = rainbowMode ? 2000 : 9000;
    const count = Math.round((w*h)/(baseCount*dpr));
    stars = Array.from({length: count}, () => ({
      x: Math.random()*w,
      y: Math.random()*h,
      z: Math.random()*0.5 + 0.5,
      r: rainbowMode ? Math.random()*3.5 + 1.5 : Math.random()*1.8 + 0.6,
      tw: Math.random()*0.5 + 0.5,
      color: rainbowMode ? Math.random() : (Math.random() > 0.7 ? 'warm' : 'cool'),
      hue: Math.random()
    }));
  }

  // Spawn a shooting star
  function spawnShootingStar(){
    const angle = Math.PI * 0.15 + Math.random() * Math.PI * 0.2; // 15-35 degrees
    const speed = rainbowMode ? (12 + Math.random() * 18) : (8 + Math.random() * 12);
    shootingStars.push({
      x: Math.random() * w * 0.8,
      y: -20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      length: rainbowMode ? (120 + Math.random() * 180) : (80 + Math.random() * 120),
      width: rainbowMode ? (3 + Math.random() * 3) : (2 + Math.random() * 2),
      hue: Math.random() // For rainbow mode
    });
  }

  function draw(){
    const now = performance.now();
    
    // Spawn shooting stars more frequently in rainbow mode
    const spawnInterval = rainbowMode ? (500 + Math.random() * 1000) : (3000 + Math.random() * 5000);
    if (now - lastShootingStar > spawnInterval) {
      if (rainbowMode || Math.random() > 0.3) {
        spawnShootingStar();
        // Spawn multiple in rainbow mode
        if (rainbowMode && Math.random() > 0.5) {
          setTimeout(() => spawnShootingStar(), 100);
        }
      }
      lastShootingStar = now;
    }

    // ease current toward target
    cur.x += (target.x - cur.x) * 0.08;
    cur.y += (target.y - cur.y) * 0.08;

    ctx.clearRect(0,0,w,h);

    const parallaxMultiplier = rainbowMode ? 4 : 1;
    const offsetX = (cur.x - 0.5) * 18 * parallaxMultiplier;
    const offsetY = (cur.y - 0.5) * 14 * parallaxMultiplier;
    const t = now * 0.001;

    if (!rainbowMode) {
      drawCanvasOrbs(t, offsetX, offsetY);
    }

    // Light veil so stars stay subtle over the ambient field
    const veil = ctx.createLinearGradient(0, 0, w, h);
    veil.addColorStop(0, 'rgba(18,17,20,0.08)');
    veil.addColorStop(1, 'rgba(14,13,16,0.14)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, w, h);

    const twinkleSpeed = rainbowMode ? 8 : 2.5;

    // Draw stars
    for(const s of stars){
      const x = s.x + offsetX * (1.6 - s.z);
      const y = s.y + offsetY * (1.6 - s.z);
      const twinkle = 0.55 + Math.sin(t*twinkleSpeed + s.x*0.003 + s.y*0.003)*0.25*s.tw;

      const glowSize = s.r * s.z * (rainbowMode ? 4 : 2.2);
      const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
      
      if (rainbowMode) {
        const color = getRainbowColor(t * 0.5 + s.hue, s.x * 0.001);
        glowGradient.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${0.6*twinkle})`);
        glowGradient.addColorStop(0.5, `rgba(${color.r},${color.g},${color.b},${0.25*twinkle})`);
      } else if (s.color === 'warm') {
        glowGradient.addColorStop(0, `rgba(255,200,150,${0.22*twinkle})`);
        glowGradient.addColorStop(0.5, `rgba(255,150,100,${0.08*twinkle})`);
      } else {
        glowGradient.addColorStop(0, `rgba(220,230,255,${0.28*twinkle})`);
        glowGradient.addColorStop(0.5, `rgba(150,180,255,${0.1*twinkle})`);
      }
      glowGradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(x, y, glowSize, 0, Math.PI*2);
      ctx.fillStyle = glowGradient;
      ctx.fill();

      // Draw star core
      ctx.beginPath();
      ctx.arc(x, y, s.r*s.z*0.8, 0, Math.PI*2);
      if (rainbowMode) {
        const color = getRainbowColor(t * 0.5 + s.hue, s.x * 0.001);
        ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${twinkle})`;
      } else {
        ctx.fillStyle = s.color === 'warm' ? `rgba(255,240,220,${0.75*twinkle})` : `rgba(255,255,255,${0.7*twinkle})`;
      }
      ctx.fill();

      // Draw star rays for larger stars (more rays in rainbow mode)
      if (s.r > (rainbowMode ? 1.2 : 1.5)) {
        if (rainbowMode) {
          const color = getRainbowColor(t * 0.5 + s.hue, s.x * 0.001);
          ctx.strokeStyle = `rgba(${color.r},${color.g},${color.b},${0.5*twinkle})`;
        } else {
          ctx.strokeStyle = `rgba(255,255,255,${0.3*twinkle})`;
        }
        ctx.lineWidth = rainbowMode ? 1 : 0.5;
        const rayLen = s.r * s.z * (rainbowMode ? 3 : 2);
        ctx.beginPath();
        ctx.moveTo(x - rayLen, y);
        ctx.lineTo(x + rayLen, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y - rayLen);
        ctx.lineTo(x, y + rayLen);
        ctx.stroke();
        // Extra diagonal rays in rainbow mode
        if (rainbowMode) {
          ctx.beginPath();
          ctx.moveTo(x - rayLen*0.7, y - rayLen*0.7);
          ctx.lineTo(x + rayLen*0.7, y + rayLen*0.7);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + rayLen*0.7, y - rayLen*0.7);
          ctx.lineTo(x - rayLen*0.7, y + rayLen*0.7);
          ctx.stroke();
        }
      }
    }

    // Draw shooting stars
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const ss = shootingStars[i];
      
      // Update position
      ss.x += ss.vx;
      ss.y += ss.vy;
      ss.life -= 0.012;
      
      if (ss.life <= 0 || ss.x > w + 100 || ss.y > h + 100) {
        shootingStars.splice(i, 1);
        continue;
      }

      // Draw shooting star with gradient trail
      const tailX = ss.x - (ss.vx / Math.sqrt(ss.vx*ss.vx + ss.vy*ss.vy)) * ss.length;
      const tailY = ss.y - (ss.vy / Math.sqrt(ss.vx*ss.vx + ss.vy*ss.vy)) * ss.length;
      
      const gradient = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
      
      if (rainbowMode) {
        const color1 = getRainbowColor(t * 0.8 + ss.hue, 0);
        const color2 = getRainbowColor(t * 0.8 + ss.hue, 0.3);
        const color3 = getRainbowColor(t * 0.8 + ss.hue, 0.6);
        gradient.addColorStop(0, `rgba(${color1.r},${color1.g},${color1.b},0)`);
        gradient.addColorStop(0.3, `rgba(${color2.r},${color2.g},${color2.b},${0.5 * ss.life})`);
        gradient.addColorStop(0.7, `rgba(${color3.r},${color3.g},${color3.b},${0.9 * ss.life})`);
        gradient.addColorStop(1, `rgba(255,255,255,${ss.life})`);
      } else {
        gradient.addColorStop(0, 'rgba(255,255,255,0)');
        gradient.addColorStop(0.3, `rgba(200,220,255,${0.3 * ss.life})`);
        gradient.addColorStop(0.7, `rgba(255,255,255,${0.8 * ss.life})`);
        gradient.addColorStop(1, `rgba(255,255,255,${ss.life})`);
      }

      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(ss.x, ss.y);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = ss.width * ss.life;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Bright head
      ctx.beginPath();
      ctx.arc(ss.x, ss.y, ss.width * (rainbowMode ? 2 : 1.5) * ss.life, 0, Math.PI * 2);
      if (rainbowMode) {
        const color = getRainbowColor(t * 0.8 + ss.hue, 0);
        ctx.fillStyle = `rgba(${color.r},${color.g},${color.b},${ss.life})`;
      } else {
        ctx.fillStyle = `rgba(255,255,255,${ss.life})`;
      }
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  function setTargetFrom(e){
    const r = canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top)  / r.height;
    target.x = Math.max(0, Math.min(1, x));
    target.y = Math.max(0, Math.min(1, y));
    const root = document.getElementById('galaxyHero');
    if(root){
      root.style.setProperty('--mx', (target.x*100)+'%');
      root.style.setProperty('--my', (target.y*100)+'%');
    }
  }

  // Track pointer over the whole window so it never "freezes" on edges
  window.addEventListener('mousemove', setTargetFrom, {passive:true});
  canvas.addEventListener('pointermove', setTargetFrom, {passive:true});
  canvas.addEventListener('pointerleave', ()=>{ target.x=0.5; target.y=0.5; }, {passive:true});

  // Listen for rainbow mode changes
  window.addEventListener('rainbowMode', (e) => {
    rainbowMode = e.detail.enabled;
    seed(); // Reseed stars with new count
    shootingStars = []; // Clear existing shooting stars
  });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize(); requestAnimationFrame(draw);
})();

// VR EYE THAT FOLLOWS CURSOR
(function(){
  const pupilLeft = document.getElementById('pupilLeft');
  const pupilRight = document.getElementById('pupilRight');
  const vrEye = document.getElementById('vrEye');
  
  if (!pupilLeft || !pupilRight || !vrEye) return;

  const maxMove = 8; // Maximum pixels the pupil can move

  function updateEyes(e) {
    const eyeRect = vrEye.getBoundingClientRect();
    const eyeCenterX = eyeRect.left + eyeRect.width / 2;
    const eyeCenterY = eyeRect.top + eyeRect.height / 2;
    
    // Calculate angle and distance from eye center to cursor
    const dx = e.clientX - eyeCenterX;
    const dy = e.clientY - eyeCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    
    // Limit movement
    const moveDistance = Math.min(distance * 0.03, maxMove);
    const moveX = Math.cos(angle) * moveDistance;
    const moveY = Math.sin(angle) * moveDistance;
    
    // Apply transform to both pupils
    const transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
    pupilLeft.style.transform = transform;
    pupilRight.style.transform = transform;
  }

  // Track mouse movement
  window.addEventListener('mousemove', updateEyes, { passive: true });
  
  // Reset eyes when mouse leaves
  document.addEventListener('mouseleave', () => {
    pupilLeft.style.transform = 'translate(-50%, -50%)';
    pupilRight.style.transform = 'translate(-50%, -50%)';
  });

  // Make VR headset clickable to open daily planner
  vrEye.style.cursor = 'pointer';
  vrEye.style.pointerEvents = 'auto';
  vrEye.setAttribute('title', 'Click to open HQ Daily Planner');
  vrEye.addEventListener('click', () => {
    window.location.href = 'hq-daily-planner.html';
  });
})();


// PROJECT LOADING AND FILTERING (projects.html)
(function(){
  let grid, loadingEl, noProjectsEl, searchInput, projectCountEl;
  let allProjects = [];
  let filteredProjects = [];

  // GENERATED from assets/projects.json - do not hand-edit.
  // Offline/file:// fallback used when fetch() of the JSON is unavailable.
  const EMBEDDED_PROJECTS = [
    {id:"amazon-music-capstone",title:"Amazon Music Adaptive UI",subtitle:"CMU MHCI Capstone · Jan – Jul 2026",category:"Research / HCI",tags:["HCI", "UX", "Research", "Product", "Industry"],description:"Seven-month Amazon Music–sponsored MHCI capstone: Adaptive UI that reshapes the artist page by listening loyalty so fans feel recognized without being asked to broadcast.",github:null,demo:"files/amazon-music/amazon-music-case-study.pdf",caseStudy:"case-studies/case-study-amazon-music.html",status:"complete",images:["assets/img/projects/amazon-music.png"],year:"2026"},
    {id:"cmu-mhci-sticky-counter",title:"CMU MHCI Sticky Note Counter",subtitle:"Interactive Physics Observatory",category:"Web / Full-Stack / Product",tags:["Web", "HCI", "Research", "Personal"],description:"A live-updating observatory estimating the total sticky notes used by every CMU MHCI cohort since 2012, complete with physics-based animations, year-by-year breakdowns, and a real-time counter.",github:null,demo:"sticky-counter.html",caseStudy:null,status:"complete",images:["assets/img/stickyobservatory.png"],year:"2026"},
    {id:"perspective",title:"Perspective",subtitle:"A Spatial Canvas for Your Data",category:"Web / Full-Stack / Product",tags:["Web", "Data", "AI", "3D", "Personal"],description:"Most data visualization tools default to 2D because it's the safe, familiar option. But a lot of data (geographic distributions, network graphs, frequency analysis, surface topologies) actually lives in three dimensions, and flattening it means losing information. Drag in a file (CSV, JSON, GeoJSON, or audio), an AI agent classifies it and maps it to the right 3D chart type, and you're immediately in a navigable scene you can orbit, zoom, and explore.",github:"https://github.com/RabiatS/PERSPECTIVE",demo:null,caseStudy:null,status:"complete",images:["assets/img/projects/perspective.png"],year:"2026"},
    {id:"true-to-hue",title:"True to Hue",subtitle:"AI-assisted color design system starter",category:"Web / Full-Stack / Product",tags:["Web", "Software", "HCI", "Personal"],description:"Web app that turns product context, color preferences, light/dark mode, and optional reference images into a structured brand color system, then refine in a studio with live CSS variables, handoff exports, and accessibility checks.",github:"https://github.com/RabiatS/True-to-hue",demo:"https://rabiats.github.io/True-to-hue/",caseStudy:null,status:"complete",images:["assets/img/projects/truetohue.png"],year:"2026"},
    {id:"ctrl-alt-elite",title:"Semi-Autonomous E-Scooter Control System",subtitle:"IXD · Interaction Design Fundamentals · Fall 2025",category:"Research / HCI",tags:["HCI", "UX", "Product", "Hardware", "Design"],description:"End-to-end interaction design for Hyundai’s Level 2 semi-autonomous electric scooter: research-driven physical controls, a child-facing rider dashboard, and a parent oversight app (geofencing, speed limits, walkie-talkie), plus CAD handlebar concepts and a functional prototype.",github:null,demo:"files/ctrl-alt-elite/ctrl-alt-elite-deliverables.pdf",ppt:"files/ctrl-alt-elite/ctrl-alt-elite-deliverables.pptx",caseStudy:null,status:"complete",images:["assets/img/projects/scooter-parental-control-ui.png", "assets/img/projects/scooter-prototype.png", "assets/img/projects/scooter-handlebar-cad-1.png", "assets/img/projects/scooter-handlebar-cad-2.png"],year:"2025"},
    {id:"gazeflow",title:"GazeFlow – Mosaic of Attention",subtitle:"Tartan Hacks 2025 · XR Eye-Tracking Experience",category:"XR / Unity / Immersive",tags:["XR", "VR", "Research", "HCI", "Hackathon"],description:"XR eye-tracking experience that turns scattered glances into a living mosaic of light. Explores how fragmented visual moments can be measured and re-shaped into clearer pictures in virtual space.",github:"https://github.com/RabiatS/GazeFlow",demo:null,caseStudy:null,status:"complete",images:["assets/img/projects/gazeflow image.png"],year:"2025"},
    {id:"playstation-internship",title:"Gameplay Video Score Extraction Pipeline",subtitle:"Applied ML Intern · PlayStation (SIE)",category:"Applied ML / CV / Video",tags:["ML", "Data", "Streaming", "CV", "Industry"],description:"Built an end-to-end pipeline to extract on-screen gameplay scores from long-form streaming videos and align scores to timestamps for validation and downstream analytics.",github:null,demo:null,caseStudy:"case-studies/case-study-ps.html",status:"complete",images:["assets/img/ps.PNG"],year:"2025"},
    {id:"multimodal-pipeline",title:"Multimodal Unstructured Data Pipeline",subtitle:"Production-Ready Video/Audio/Sensor Processing",category:"Applied ML / CV / Video",tags:["ML", "Data", "CV", "Audio", "Personal"],description:"A modular pipeline that converts unstructured video, audio, and sensor/time-series data into structured, timestamped events with metadata.",github:"https://github.com/RabiatS",demo:null,caseStudy:null,status:"complete",images:["assets/img/projects/Multimodalstructred pipleiline.png"],year:"2024"},
    {id:"yolov5-car-detection",title:"YOLOv5 Car Detection",subtitle:"Real-Time Vehicle Detection from Video",category:"Applied ML / CV / Video",tags:["ML", "CV", "Personal"],description:"Built vehicle detection from video using YOLOv5 with real-time inference using OpenCV.",github:"https://github.com/RabiatS/Pytorch_car_detection_model",demo:null,caseStudy:null,status:"complete",images:[],year:"2024"},
    {id:"magic-mitts",title:"Magic Mitts",subtitle:"Affordable Haptic VR Gloves",category:"XR / Unity / Immersive",tags:["XR", "Hardware", "Unity", "Research"],description:"Led cross-functional team to build affordable haptic glove with flex sensors and electromagnetic braking; integrated real-time interaction in Unity/C#.",github:"https://github.com/RabiatS/MagicMitts---Smart-VR-Gloves",demo:null,caseStudy:"case-studies/case-study.html",status:"complete",images:["assets/img/mm.png"],year:"2024"},
    {id:"vr-music-visualizer",title:"VR Music Visualizer",subtitle:"Audio-Reactive 3D Environments",category:"XR / Unity / Immersive",tags:["XR", "Unity", "VR", "Personal"],description:"Reactive 3D visuals that respond to audio (bass/treble/mid/vocals) with planned hand tracking interactions.",github:"https://github.com/RabiatS/VR-music-visualizer",demo:null,caseStudy:null,status:"complete",images:["assets/img/projects/VR Mussic Viz.webp"],year:"2024"},
    {id:"weeping-angel-vr",title:"Weeping Angel VR",subtitle:"Don't Blink Experience",category:"XR / Unity / Immersive",tags:["XR", "Unity", "VR", "Personal"],description:"VR experience where objects/characters move closer when not directly observed, implementing the 'weeping angel' mechanic.",github:"https://github.com/RabiatS/Weeping_angel_VR",demo:null,caseStudy:null,status:"complete",images:[],year:"2024"},
    {id:"ar-guided-journeys",title:"AR Guided Journeys",subtitle:"Quest 3 Mixed Reality Navigation",category:"XR / Unity / Immersive",tags:["XR", "AR", "Unity", "Personal"],description:"Quest 3 mixed reality indoor navigation and learning app where users follow AR paths and get informative content along the way.",github:"https://github.com/RabiatS/AR-Guided-Journeys-Interactive-Learning",demo:null,caseStudy:null,status:"complete",images:[],year:"2024"},
    {id:"vr-data-visualization",title:"VR Interactive Data Visualization",subtitle:"3D Graph Exploration with AIML",category:"XR / Unity / Immersive",tags:["XR", "VR", "Data", "ML", "Personal"],description:"VR system for exploring graphs and datasets in 3D space, aiming for immersive and collaborative data analysis.",github:"https://github.com/RabiatS/VR-Interactive-Data-Visualization-with-AIML",demo:null,caseStudy:null,status:"complete",images:[],year:"2024"},
    {id:"hand-controlled-visuals",title:"Hand-Controlled Visuals",subtitle:"OpenCV MediaPipe Visualizer",category:"XR / Unity / Immersive",tags:["CV", "XR", "Personal"],description:"Python hand-tracking visualizer with four effects (kaleidoscope particles, aurora, ripple rings, animated EKG) controlled by finger openness per hand.",github:"https://github.com/RabiatS/Hand-Controlled-Visuals-OpenCV-MediaPipe-",demo:null,caseStudy:null,status:"complete",images:[],year:"2024"},
    {id:"xr-pain-perception",title:"XR Pain Augmentation Research",subtitle:"CMU Augmented Perception Lab",category:"XR / Unity / Immersive",tags:["XR", "Research", "HCI", "Perception"],description:"Multimodal XR prototypes to study pain perception; goal includes later ML integration for personalization and analysis.",github:null,demo:null,caseStudy:"case-studies/case-study-pain-xr.html",status:"complete",images:["assets/img/projects/vr-pain-augmentation-research.png"],year:"2025"},
    {id:"assuage",title:"Assuage",subtitle:"ML Distress Prediction (iOS + HealthKit)",category:"iOS / Health / ML Deployment",tags:["ML", "iOS", "Health", "Research"],description:"Logistic regression to predict distress level from HealthKit biometrics; 82% test accuracy.",github:"https://github.com/RabiatS/final-project-aimleaders",demo:null,caseStudy:"case-studies/case-study-assuage.html",status:"complete",images:["assets/img/projects/assuage-logo.png"],year:"2024"},
    {id:"spotify-research",title:"Spotify vs AI Research Study",subtitle:"UX Research & Design",category:"Web / Full-Stack / Product",tags:["HCI", "Research", "UX", "Web"],description:"A UX research and design project exploring how Spotify listeners perceive AI-generated music, and how clearer labeling and controls can build trust in the listening experience.",github:"https://github.com/RabiatS/spotify-vs-ai-research-study",demo:"https://spotify-vs-ai-research-study.vercel.app/",caseStudy:"case-studies/case-study-spotify.html",status:"complete",images:["assets/img/projects/spotify-vs-ai-research.png"],year:"2024"},
    {id:"talky-talky",title:"Talky Talky",subtitle:"Audio-Responsive Web App",category:"Web / Full-Stack / Product",tags:["Web", "Early", "Product"],description:"Audio-responsive web app for non-verbal kids; Google Text-to-Speech integration.",github:"https://github.com/RabiatS/software-product-sprint-2022",demo:null,caseStudy:null,status:"complete",images:[],year:"2022"},
    {id:"applied-stem",title:"Applied STEM Platform",subtitle:"Co-founder / AI & Full-Stack Engineer",category:"Web / Full-Stack / Product",tags:["Web", "ML", "Product", "Industry"],description:"Built an AI-powered technical interview platform where users design circuits on an interactive React/TypeScript canvas with a FastAPI backend for simulation and analysis.",github:null,demo:null,caseStudy:null,status:"complete",images:["assets/img/projects/appliedSTEM_img.png"],year:"2024"},
    {id:"task-manager",title:"Task Manager App",subtitle:"Android Journaling & Cloud Sync",category:"Web / Full-Stack / Product",tags:["Android", "Web", "Early"],description:"Android app in Java using Firebase and SQLite; journaling, authentication, cloud sync; team project with Jira/Confluence.",github:"https://github.com/RabiatS/TaskManager-CS3443",demo:null,caseStudy:null,status:"complete",images:[],year:"2023"},
    {id:"vr-content-analysis",title:"VR Content Analysis",subtitle:"AI-Empowered Safety Research",category:"Research / HCI",tags:["Research", "HCI", "XR", "ML"],description:"Conducted research on AI-empowered VR content analysis to address harassment and safety issues across social VR platforms.",github:null,demo:null,caseStudy:null,status:"complete",images:[],year:"2023-2024"},
    {id:"apple-nacme-projects",title:"Apple NACME AIML Intensive",subtitle:"35 Projects · 8-Week Bootcamp",category:"Early Work / Learning",tags:["ML", "Early", "Learning"],description:"Completed 35 projects during 8-week intensive covering Python fundamentals, data analysis, ML foundations, regression, classification, deep learning, and advanced ML topics.",github:"https://github.com/RabiatS",demo:null,caseStudy:null,status:"complete",images:["assets/img/projects/apple-nacme.png"],year:"2024"},
    {id:"titanic-ml",title:"Titanic Survival Prediction",subtitle:"Classic ML Analysis",category:"Early Work / Learning",tags:["ML", "Early", "Learning"],description:"Machine learning analysis predicting Titanic passenger survival using logistic regression, decision trees, or ensemble methods.",github:"https://github.com/RabiatS/titanic_survivers_ml",demo:null,caseStudy:null,status:"complete",images:[],year:"2024"}
  ];

  // Get DOM elements
  function getElements(){
    grid = document.getElementById('projectsGrid');
    loadingEl = document.getElementById('projectsLoading');
    noProjectsEl = document.getElementById('noProjects');
    searchInput = document.getElementById('projectSearch');
    projectCountEl = document.getElementById('projectCount');
    return !!grid; // Return true if grid exists
  }

  // assets/projects.json is the source of truth. Fetching it means adding a
  // project only requires editing the JSON. Over file:// the fetch fails, so we
  // fall back to EMBEDDED_PROJECTS, which is generated from the same JSON.
  async function loadProjects(){
    if (!getElements()) return; // Exit if not on projects page

    allProjects = EMBEDDED_PROJECTS;
    try {
      const res = await fetch('assets/projects.json', { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.projects) && data.projects.length) {
          // `template` entries are placeholders with no real write-up yet.
          allProjects = data.projects.filter((p) => p.status !== 'template');
        }
      }
    } catch (error) {
      // file:// or offline — the embedded copy already covers us.
      console.info('projects.json unavailable, using embedded copy.', error);
    }

    filteredProjects = allProjects;
    renderProjects();
    if (projectCountEl) projectCountEl.textContent = allProjects.length;
    if (loadingEl) loadingEl.style.display = 'none';
    if (grid) grid.style.display = 'grid';
  }

  // Render project cards
  function renderProjects(){
    if (!grid) return;
    grid.innerHTML = '';
    
    if (filteredProjects.length === 0) {
      grid.style.display = 'none';
      if (noProjectsEl) noProjectsEl.style.display = 'block';
      return;
    }

    if (noProjectsEl) noProjectsEl.style.display = 'none';
    grid.style.display = 'grid';

    filteredProjects.forEach(project => {
      const card = document.createElement('article');
      card.className = 'card img-card';
      card.setAttribute('data-tags', project.tags.join(' '));
      card.setAttribute('id', project.id);
      
      const hasImage = project.images && project.images.length > 0 && project.images[0];

      // Category gradients for cards without real images
      const categoryStyles = {
        'Applied ML / CV / Video': { gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)', icon: '🤖' },
        'XR / Unity / Immersive':  { gradient: 'linear-gradient(135deg,#06b6d4,#3b82f6)', icon: '🥽' },
        'Research / HCI':          { gradient: 'linear-gradient(135deg,#3b82f6,#6366f1)', icon: '🔬' },
        'Early Work / Learning':   { gradient: 'linear-gradient(135deg,#64748b,#475569)', icon: '📚' },
        'Software':                { gradient: 'linear-gradient(135deg,#10b981,#3b82f6)', icon: '💻' },
        'Hardware / Embedded':     { gradient: 'linear-gradient(135deg,#10b981,#14b8a6)', icon: '⚡' },
        'Web / Full-Stack / Product': { gradient: 'linear-gradient(135deg,#C41230,#f5a623)', icon: '🌐' },
      };
      const catStyle = categoryStyles[project.category] || { gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)', icon: '💻' };

      if (hasImage) {
        const src = project.images[0];
        const resolved = new URL(src, document.baseURI).href;
        card.style.setProperty('--img', `url("${resolved}")`);
      } else {
        card.style.setProperty('--grad', catStyle.gradient);
      }

      // Two cards borrow the type of the product they were built for.
      const BRAND_FONTS = { 'amazon-music-capstone': 'ember', assuage: 'apple' };
      if (BRAND_FONTS[project.id]) card.setAttribute('data-font', BRAND_FONTS[project.id]);

      const cardBody = document.createElement('div');
      cardBody.className = 'card-body';

      // Title with link
      const title = document.createElement('h3');
      title.style.cssText = 'margin-bottom:8px;font-size:17px;line-height:1.3;word-wrap:break-word;';
      if (project.caseStudy) {
        const link = document.createElement('a');
        link.href = project.caseStudy;
        link.textContent = project.title;
        link.style.color = 'inherit';
        link.style.textDecoration = 'none';
        title.appendChild(link);
      } else if (project.demo) {
        const link = document.createElement('a');
        link.href = project.demo;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = project.title;
        link.style.color = 'inherit';
        link.style.textDecoration = 'none';
        link.innerHTML += ' ↗';
        title.appendChild(link);
      } else if (project.github) {
        const link = document.createElement('a');
        link.href = project.github;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = project.title;
        link.style.color = 'inherit';
        link.style.textDecoration = 'none';
        link.innerHTML += ' ↗';
        title.appendChild(link);
      } else {
        title.textContent = project.title;
      }
      cardBody.appendChild(title);

      // Subtitle
      if (project.subtitle) {
        const subtitle = document.createElement('p');
        subtitle.className = 'muted';
        subtitle.style.fontSize = '13px';
        subtitle.style.marginTop = '4px';
        subtitle.style.fontWeight = '500';
        subtitle.textContent = project.subtitle;
        cardBody.appendChild(subtitle);
      }

      // Description - limit to 2 lines
      const desc = document.createElement('p');
      desc.className = 'muted';
      desc.style.cssText = 'margin-top:8px;line-height:1.5;font-size:13px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;';
      desc.textContent = project.description;
      cardBody.appendChild(desc);

      // Badges - limit to 3 tags
      const badges = document.createElement('div');
      badges.className = 'badges';
      badges.style.cssText = 'margin-top:10px;justify-content:flex-start;flex-wrap:wrap;gap:6px;';
      const tagsToShow = project.tags.slice(0, 3); // Only show first 3 tags
      tagsToShow.forEach(tag => {
        const badge = document.createElement('span');
        badge.className = 'tag';
        badge.textContent = tag;
        // Style tags - only use white text for cards WITH images (overlay on image)
        if (hasImage) {
          badge.style.background = 'rgba(255,255,255,0.2)';
          badge.style.borderColor = 'rgba(255,255,255,0.3)';
          badge.style.color = '#ffffff';
        }
        badges.appendChild(badge);
      });
      
      // Status badge for templates
      if (project.status === 'template') {
        const templateBadge = document.createElement('span');
        templateBadge.className = 'tag';
        templateBadge.style.background = 'rgba(251,191,36,0.3)';
        templateBadge.style.borderColor = 'rgba(251,191,36,0.5)';
        templateBadge.textContent = 'Template';
        if (hasImage) {
          templateBadge.style.color = '#ffffff';
        }
        badges.appendChild(templateBadge);
      }
      
      cardBody.appendChild(badges);

      // Links
      if (project.github || project.demo || project.ppt) {
        const links = document.createElement('div');
        links.style.marginTop = '10px';
        links.style.display = 'flex';
        links.style.gap = '10px';
        links.style.flexWrap = 'wrap';
        
        if (project.github && !project.caseStudy) {
          const ghLink = document.createElement('a');
          ghLink.href = project.github;
          ghLink.target = '_blank';
          ghLink.rel = 'noopener';
          ghLink.textContent = 'GitHub';
          ghLink.style.fontSize = '13px';
          ghLink.style.color = 'inherit';
          ghLink.style.opacity = '0.8';
          links.appendChild(ghLink);
        }
        
        if (project.demo) {
          const demoLink = document.createElement('a');
          demoLink.href = project.demo;
          demoLink.target = '_blank';
          demoLink.rel = 'noopener';
          const isPdf = /\.pdf$/i.test(project.demo);
          if (isPdf && !project.github) {
            demoLink.textContent = project.caseStudy ? 'Case Study PDF ↗' : 'View Slides (PDF) ↗';
          } else {
            demoLink.textContent = '▶ Launch';
          }
          demoLink.style.fontSize = '13px';
          demoLink.style.color = 'inherit';
          demoLink.style.opacity = '0.9';
          demoLink.style.fontWeight = '600';
          links.appendChild(demoLink);
        }

        if (project.ppt) {
          const pptLink = document.createElement('a');
          pptLink.href = project.ppt;
          pptLink.target = '_blank';
          pptLink.rel = 'noopener';
          pptLink.textContent = 'Download Deck (PPT)';
          pptLink.style.fontSize = '13px';
          pptLink.style.color = 'inherit';
          pptLink.style.opacity = '0.8';
          links.appendChild(pptLink);
        }
        
        if (links.children.length > 0) {
          cardBody.appendChild(links);
        }
      }

      // Append cardBody to card
      card.appendChild(cardBody);
      
      grid.appendChild(card);
    });

    // Re-initialize tilt and shine effects
    if (window.enableTilt) window.enableTilt();
    initCardShine();
  }

  // Filter projects
  function filterProjects(){
    const activeFilter = document.querySelector('.filters .pill.is-active')?.dataset.filter || 'all';
    const searchTerm = searchInput?.value.toLowerCase() || '';

    filteredProjects = allProjects.filter(project => {
      // Tag filter
      if (activeFilter !== 'all' && !project.tags.includes(activeFilter)) {
        return false;
      }
      
      // Search filter
      if (searchTerm) {
        const searchable = `${project.title} ${project.subtitle || ''} ${project.description} ${project.tags.join(' ')} ${project.category}`.toLowerCase();
        if (!searchable.includes(searchTerm)) {
          return false;
        }
      }
      
      return true;
    });

    renderProjects();
  }

  // Initialize card shine effect
  function initCardShine(){
    const cards = document.querySelectorAll('.img-card');
    function setPos(e, el){
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', ((e.clientX - r.left)/r.width*100)+'%');
      el.style.setProperty('--my', ((e.clientY - r.top)/r.height*100)+'%');
    }
    cards.forEach(el=>{
      el.addEventListener('pointermove', (e)=>setPos(e,el), {passive:true});
      el.addEventListener('pointerleave', ()=>{ el.style.removeProperty('--mx'); el.style.removeProperty('--my'); }, {passive:true});
    });
  }

  // Initialize event handlers
  function initHandlers(){
    // Filter pill handlers
    const pills = document.querySelectorAll('.filters .pill');
    pills.forEach(p => p.addEventListener('click', () => {
      pills.forEach(x => x.classList.remove('is-active'));
      p.classList.add('is-active');
      filterProjects();
    }));

    // Search handler
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(filterProjects, 300);
      });
    }
  }

  // Load projects on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      loadProjects();
      initHandlers();
    });
  } else {
    loadProjects();
    initHandlers();
  }
})();

// Featured section on index.html: absolute --img URLs + plain-mode #work used to hide ::before
(function(){
  function resolveWorkThumbnails(){
    const work = document.getElementById('work');
    if (!work) return;
    work.querySelectorAll('.img-card').forEach(card => {
      const raw = card.style.getPropertyValue('--img').trim();
      if (!raw) return;
      const m = raw.match(/url\(\s*["']?([^"')]+)["']?\s*\)/i);
      if (!m) return;
      const path = m[1].trim();
      try {
        card.style.setProperty('--img', `url("${new URL(path, document.baseURI).href}")`);
      } catch (e) {}
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', resolveWorkThumbnails);
  } else {
    resolveWorkThumbnails();
  }
})();

// GLOBAL TILT LOADER with header UI (desktop/mobile/off)
(function(){
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  const body = document.body;
  const SELECTOR = body?.dataset?.tiltSelector || '.img-card, .card.tilt';
  const selectEl = document.getElementById('tiltModeSelect');

  function loadTilt(cb){
    if (window.VanillaTilt) return cb();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/vanilla-tilt@1.8.1/dist/vanilla-tilt.min.js';
    s.onload = cb; document.head.appendChild(s);
  }
  function nodes(){ return Array.from(document.querySelectorAll(SELECTOR)); }
  function init(useGyro){
    nodes().forEach(el => { if (!el.vanillaTilt) VanillaTilt.init(el,{
      max:12,speed:400,glare:true,"max-glare":0.22,perspective:900,scale:1.02,gyroscope:!!useGyro,reset:true
    });});
  }
  function destroy(){ nodes().forEach(el=>{ if(el.vanillaTilt) el.vanillaTilt.destroy(); }); }

  function apply(mode){
    const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints>0);
    if (mode==='off'){ destroy(); return; }
    if (mode==='desktop' && !canHover){ destroy(); return; }
    loadTilt(()=> init(mode==='all' && isTouch));
  }

  // Saved preference wins over the per-page data-tilt-mode default, so the
  // choice sticks as you move between pages.
  const savedMode = localStorage.getItem('tiltMode');
  const initialMode = (savedMode || body?.dataset?.tiltMode || 'desktop').toLowerCase();
  body.dataset.tiltMode = initialMode;

  // Legacy <select> kept working in case a page still ships one.
  if (selectEl){
    selectEl.value = initialMode;
    selectEl.addEventListener('change', ()=>{
      const mode = selectEl.value;
      body.dataset.tiltMode = mode;
      localStorage.setItem('tiltMode', mode);
      apply(mode);
    }, {passive:true});
  }

  window.setTiltMode = (mode) => {
    body.dataset.tiltMode = mode;
    localStorage.setItem('tiltMode', mode);
    if (selectEl) selectEl.value = mode;
    apply(mode);
  };

  document.addEventListener('DOMContentLoaded', ()=> apply(body.dataset.tiltMode || initialMode));

  // Helpers if you add cards dynamically
  window.enableTilt   = (mode)=>{ if(mode) body.dataset.tiltMode=mode; apply(body.dataset.tiltMode||'desktop'); };
  window.disableTilt  = ()=>{ body.dataset.tiltMode='off'; destroy(); };

  // Optional motion permission for iOS if using 'all'
  window.requestTiltMotionPermission = async (btnId='enableMotionTilt') => {
    try {
      if (typeof DeviceMotionEvent !== 'undefined' &&
          typeof DeviceMotionEvent.requestPermission === 'function') {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const res = await DeviceMotionEvent.requestPermission();
        if (res === 'granted') { apply('all'); btn.remove(); }
      }
    } catch {}
  };
})();



// Card "shine" position tracker (projects + home cards)
(function(){
  const cards = document.querySelectorAll('.img-card');
  if (!cards.length) return;
  function setPos(e, el){
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((e.clientX - r.left)/r.width*100)+'%');
    el.style.setProperty('--my', ((e.clientY - r.top)/r.height*100)+'%');
  }
  cards.forEach(el=>{
    el.addEventListener('pointermove', (e)=>setPos(e,el), {passive:true});
    el.addEventListener('pointerleave', ()=>{ el.style.removeProperty('--mx'); el.style.removeProperty('--my'); }, {passive:true});
  });
})();


// FUN COLORS toggle
(function(){
  const btn = document.getElementById('funToggle');
  const saved = localStorage.getItem('fun') === '1';
  if (saved) document.body.classList.add('fun');
  if (!btn) return;
  btn.addEventListener('click', ()=>{
    document.body.classList.toggle('fun');
    localStorage.setItem('fun', document.body.classList.contains('fun') ? '1' : '0');
  });
})();

// Global reset function - can be called from console: resetPlainMode()
window.resetPlainMode = function() {
  localStorage.setItem('plainMode', 'false');
  localStorage.removeItem('plainModeVariant');
  document.documentElement.classList.remove('plain-mode');
  document.documentElement.classList.remove('plain-mode--rabiat');
  document.body.classList.remove('dark');
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = 'light';
  
  // Re-enable nebula
  const nebula = document.getElementById('nebula');
  if (nebula) nebula.style.display = '';
  
  // Re-enable VR eye
  const vrEye = document.getElementById('vrEye');
  if (vrEye) {
    vrEye.style.display = '';
    vrEye.style.visibility = '';
    vrEye.style.pointerEvents = '';
  }
  
  // Remove exit button
  const exitBtn = document.getElementById('exitPlainMode');
  if (exitBtn) exitBtn.remove();
  
  // Restore eyebrow
  const eyebrow = document.querySelector('.eyebrow');
  if (eyebrow && !eyebrow.textContent.includes('👋')) {
    eyebrow.textContent = 'Hey there! 👋🏾';
  }
  
  // Reload page to apply color scheme
  location.reload();
};

// AI chat placeholder — double-click footer tagline to open
(function initAiChatPlaceholder() {
  const tagline = document.querySelector('.footer-tagline');
  if (!tagline) return;

  tagline.classList.add('footer-tagline--ai-trigger');

  const portal = document.createElement('div');
  portal.id = 'aiChatPortal';
  portal.className = 'ai-chat-portal';
  portal.setAttribute('aria-hidden', 'true');
  portal.innerHTML = `
    <div class="ai-chat-backdrop" data-ai-close tabindex="-1" aria-hidden="true"></div>
    <div class="ai-chat-panel" role="dialog" aria-modal="true" aria-labelledby="aiChatTitle">
      <header class="ai-chat-header">
        <div class="ai-chat-header-main">
          <div class="ai-chat-avatar" aria-hidden="true">✦</div>
          <div>
            <h2 class="ai-chat-title" id="aiChatTitle">Talk to <span class="grad">AI me</span></h2>
            <p class="ai-chat-subtitle">Ask about my work, research, and projects.</p>
          </div>
        </div>
        <button type="button" class="ai-chat-close" data-ai-close aria-label="Close">×</button>
      </header>
      <div class="ai-chat-body">
        <div class="ai-chat-bubble ai-chat-bubble--user">What XR projects have you built?</div>
        <div class="ai-chat-bubble ai-chat-bubble--assistant">
          I will learn from this portfolio and answer soon.
          <div class="ai-chat-coming-soon" role="status">
            <span class="ai-chat-coming-soon-dot" aria-hidden="true"></span>
            <span class="ai-chat-coming-soon-dot" aria-hidden="true"></span>
            <span class="ai-chat-coming-soon-dot" aria-hidden="true"></span>
            Coming soon
          </div>
        </div>
      </div>
      <footer class="ai-chat-footer">
        <div class="ai-chat-input-wrap">
          <input class="ai-chat-input" type="text" disabled placeholder="Ask about my work…" aria-disabled="true" tabindex="-1" />
          <button type="button" class="ai-chat-send" disabled aria-label="Send (coming soon)" tabindex="-1">↑</button>
        </div>
      </footer>
    </div>
  `;
  document.body.appendChild(portal);

  const closeEls = portal.querySelectorAll('[data-ai-close]');
  let lastFocus = null;

  function openPanel() {
    lastFocus = document.activeElement;
    portal.classList.add('is-open');
    portal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    const closeBtn = portal.querySelector('.ai-chat-close');
    if (closeBtn) closeBtn.focus();
  }

  function closePanel() {
    portal.classList.remove('is-open');
    portal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  tagline.addEventListener('dblclick', (e) => {
    e.preventDefault();
    openPanel();
  });

  closeEls.forEach((el) => el.addEventListener('click', closePanel));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && portal.classList.contains('is-open')) {
      e.preventDefault();
      closePanel();
    }
  });
})();

// ============================================
// SETTINGS POPOVER — tilt mode + glass level
// Replaces the old always-visible "Tilt: ..." <select> in the header.
// ============================================
(function () {
  const controls = document.querySelector('.header .header-controls');
  if (!controls || controls.querySelector('.settings-wrap')) return;

  const TILT_MODES = ['off', 'desktop', 'all'];

  const wrap = document.createElement('div');
  wrap.className = 'settings-wrap';
  wrap.innerHTML = `
    <button type="button" class="toggle settings-btn" id="settingsBtn"
            aria-expanded="false" aria-haspopup="dialog" title="Settings" aria-label="Settings">⚙</button>
    <div class="settings-panel" role="dialog" aria-label="Display settings">
      <div class="settings-group">
        <span class="settings-label" id="tiltLabel">Card tilt</span>
        <div class="settings-seg" role="group" aria-labelledby="tiltLabel" data-seg="tilt">
          <button type="button" data-value="off">Off</button>
          <button type="button" data-value="desktop">Desktop</button>
          <button type="button" data-value="all">All</button>
        </div>
      </div>
      <div class="settings-group">
        <span class="settings-label" id="glassLabel">Glass</span>
        <input type="range" class="glass-slider" id="glassSlider" min="0" max="100" step="1"
               aria-labelledby="glassLabel" aria-valuetext="Default">
        <div class="settings-scale" aria-hidden="true"><span>Clear</span><span>Frosted</span></div>
        <p class="settings-hint">How frosted the nav and header panels look.</p>
      </div>
      <div class="settings-group">
        <span class="settings-label" id="soundLabel">Ambient sound</span>
        <div class="settings-seg settings-seg--two" role="group" aria-labelledby="soundLabel" data-seg="sound">
          <button type="button" data-value="off">Off</button>
          <button type="button" data-value="on">On</button>
        </div>
        <p class="settings-hint">A quiet synth pad. Off unless you ask for it.</p>
      </div>
    </div>
  `;

  // Retire the old select if the page still has one.
  const legacySelect = controls.querySelector('.tilt-select');
  const legacyLabel = controls.querySelector('label[for="tiltModeSelect"]');
  if (legacyLabel) legacyLabel.remove();
  if (legacySelect) legacySelect.style.display = 'none';

  const themeToggle = controls.querySelector('#themeToggle');
  controls.insertBefore(wrap, themeToggle || null);

  const btn = wrap.querySelector('.settings-btn');
  const panel = wrap.querySelector('.settings-panel');

  function paint(seg, value) {
    wrap.querySelectorAll(`[data-seg="${seg}"] button`).forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.value === value));
    });
  }

  // Stored as 0-100. Older builds stored 'clear' | 'default' | 'frosted'.
  function currentGlass() {
    const saved = localStorage.getItem('glassLevel');
    const legacy = { clear: 0, default: 50, frosted: 100 };
    if (saved in legacy) return legacy[saved];
    const n = parseInt(saved, 10);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 50;
  }

  function applyGlass(value) {
    window.applyGlassLevel(value);
    localStorage.setItem('glassLevel', String(value));
  }

  function currentTilt() {
    const saved = localStorage.getItem('tiltMode');
    if (TILT_MODES.includes(saved)) return saved;
    const attr = (document.body.dataset.tiltMode || 'desktop').toLowerCase();
    return TILT_MODES.includes(attr) ? attr : 'desktop';
  }

  paint('tilt', currentTilt());

  const slider = wrap.querySelector('#glassSlider');
  slider.value = String(currentGlass());
  const describe = (v) => (v < 20 ? 'Clear' : v < 45 ? 'Light' : v < 70 ? 'Default' : v < 88 ? 'Frosted' : 'Heavy frost');
  slider.setAttribute('aria-valuetext', describe(Number(slider.value)));
  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    applyGlass(v);
    slider.setAttribute('aria-valuetext', describe(v));
  });

  wrap.querySelectorAll('[data-seg="tilt"] button').forEach((b) => {
    b.addEventListener('click', () => {
      const mode = b.dataset.value;
      paint('tilt', mode);
      // setTiltMode is defined by the tilt loader; fall back to storage only
      // when reduced-motion made that block bail out early.
      if (typeof window.setTiltMode === 'function') window.setTiltMode(mode);
      else {
        localStorage.setItem('tiltMode', mode);
        document.body.dataset.tiltMode = mode;
      }
    });
  });

  // Ambient sound lives in assets/music.js. If that file is not on the page,
  // hide the control rather than showing one that does nothing.
  const soundGroup = wrap.querySelector('[data-seg="sound"]').closest('.settings-group');
  if (!window.AmbientSound) {
    soundGroup.hidden = true;
  } else {
    paint('sound', window.AmbientSound.enabled() ? 'on' : 'off');
    wrap.querySelectorAll('[data-seg="sound"] button').forEach((b) => {
      b.addEventListener('click', () => {
        const wantOn = b.dataset.value === 'on';
        if (wantOn !== window.AmbientSound.isOn()) window.AmbientSound.toggle();
        paint('sound', window.AmbientSound.isOn() ? 'on' : 'off');
      });
    });
  }

  function open() {
    panel.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
  }

  function close() {
    panel.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.contains('is-open') ? close() : open();
  });

  document.addEventListener('click', (e) => {
    if (panel.classList.contains('is-open') && !wrap.contains(e.target)) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('is-open')) {
      close();
      btn.focus();
    }
  });
})();

// Mobile navigation menu
(function () {
  const header = document.querySelector('.header');
  const nav = header?.querySelector('.nav');
  const controls = header?.querySelector('.header-controls');
  if (!header || !nav || !controls || header.querySelector('.nav-toggle')) return;

  const mq = window.matchMedia('(max-width: 900px)');

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-toggle';
  toggle.setAttribute('aria-label', 'Open menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'primary-nav');
  toggle.innerHTML =
    '<span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span><span class="nav-toggle-bar"></span>';

  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'nav-backdrop';
  backdrop.setAttribute('aria-label', 'Close menu');
  backdrop.hidden = true;

  nav.id = 'primary-nav';
  controls.appendChild(toggle);
  document.body.appendChild(backdrop);

  const setOpen = (open) => {
    header.classList.toggle('nav-open', open);
    document.body.classList.toggle('nav-menu-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    backdrop.hidden = !open;
  };

  const closeMenu = () => setOpen(false);

  toggle.addEventListener('click', () => {
    setOpen(!header.classList.contains('nav-open'));
  });

  backdrop.addEventListener('click', closeMenu);

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  mq.addEventListener('change', (e) => {
    if (!e.matches) closeMenu();
  });
})();

// Nav: single sliding glass pill (active page only)
(function () {
  const nav = document.querySelector('.nav');
  if (!nav || document.documentElement.classList.contains('plain-mode')) return;

  const glider = document.createElement('span');
  glider.className = 'nav-glider';
  glider.setAttribute('aria-hidden', 'true');
  nav.prepend(glider);

  const pills = [...nav.querySelectorAll('.nav-pill')];
  const internalPills = pills.filter((p) => {
    const href = p.getAttribute('href');
    return href && !href.startsWith('http') && !p.classList.contains('nav-external');
  });

  function getPageKey(path) {
    const u = new URL(path, window.location.origin);
    const parts = u.pathname.split('/').filter(Boolean);
    const file = parts.pop();
    if (!file || u.pathname.endsWith('/')) return 'index.html';
    return file;
  }

  function getActivePill() {
    const marked =
      nav.querySelector('.nav-pill[aria-current="page"]') ||
      nav.querySelector('.nav-pill.active');
    if (marked && internalPills.includes(marked)) return marked;

    const currentKey = getPageKey(window.location.pathname);
    return internalPills.find((pill) => {
      const href = pill.getAttribute('href');
      return href && getPageKey(href) === currentKey;
    });
  }

  let gliderTarget = getActivePill();

  function setUnderGlider(pill) {
    pills.forEach((p) => p.classList.toggle('is-under-glider', p === pill));
  }

  function moveGlider(pill, animate) {
    if (!pill || document.documentElement.classList.contains('plain-mode')) return;

    const navRect = nav.getBoundingClientRect();
    const rect = pill.getBoundingClientRect();

    if (!animate) {
      glider.style.transition = 'none';
    }

    glider.style.width = `${rect.width}px`;
    glider.style.height = `${rect.height}px`;
    glider.style.transform = `translate(${rect.left - navRect.left}px, ${rect.top - navRect.top}px)`;

    setUnderGlider(pill);
    gliderTarget = pill;

    if (!animate) {
      glider.offsetHeight;
      glider.style.transition = '';
    }
  }

  function initGlider() {
    const active = getActivePill();
    if (!active) {
      glider.style.opacity = '0';
      return;
    }
    moveGlider(active, false);
    nav.classList.add('is-glider-ready');
  }

  initGlider();

  // Every pill gets the glider on hover, external links included. LinkedIn is
  // still an outbound link, but it should light up like the rest of the nav.
  pills.forEach((pill) => {
    pill.addEventListener('mouseenter', () => moveGlider(pill, true));
    pill.addEventListener('focus', () => moveGlider(pill, true));
  });

  nav.addEventListener('mouseleave', () => {
    const active = getActivePill();
    if (active) moveGlider(active, true);
  });

  pills.forEach((pill) => {
    pill.addEventListener('blur', () => {
      window.requestAnimationFrame(() => {
        if (!nav.contains(document.activeElement)) {
          const active = getActivePill();
          if (active) moveGlider(active, true);
        }
      });
    });
  });

  window.addEventListener('resize', () => moveGlider(gliderTarget || getActivePill(), false));

  const header = nav.closest('.header');
  if (header) {
    const mo = new MutationObserver(() => {
      window.requestAnimationFrame(() => moveGlider(gliderTarget || getActivePill(), true));
    });
    mo.observe(header, { attributes: true, attributeFilter: ['class'] });
  }
})();

// Home page: smooth hero ↔ content scroll blend + header glass transition
(function () {
  const hero = document.querySelector('.hero--fullscreen');
  if (!hero || !document.body.classList.contains('page-home')) return;

  const root = document.documentElement;
  let ticking = false;

  function updateScrollBlend() {
    const rect = hero.getBoundingClientRect();
    const vh = window.innerHeight;
    const blendZone = vh * 0.55;
    const progress = Math.min(1, Math.max(0, rect.bottom / blendZone));

    root.style.setProperty('--hero-scroll', progress.toFixed(3));
    document.body.classList.toggle('on-hero', rect.bottom > vh * 0.12);
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateScrollBlend);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', updateScrollBlend, { passive: true });
  updateScrollBlend();
})();

// View in VR — header entry when immersive WebXR is available
(function () {
  const controls = document.querySelector('.header .header-controls');
  if (!controls || controls.querySelector('.btn-view-vr')) return;

  function insertVrLink() {
    if (controls.querySelector('.btn-view-vr')) return;
    const link = document.createElement('a');
    link.href = 'vr.html';
    link.className = 'btn-view-vr';
    link.textContent = 'View in VR';
    link.setAttribute('aria-label', 'Step inside the portfolio in VR');
    controls.insertBefore(link, controls.firstChild);
  }

  if (!navigator.xr || typeof navigator.xr.isSessionSupported !== 'function') return;

  navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
    if (supported) insertVrLink();
  }).catch(() => {});
})();

// Cool page — VR site card copy for XR vs regular browsers
(function () {
  const card = document.getElementById('vrSiteCard');
  if (!card) return;

  const hint = card.querySelector('[data-vr-hint]');
  const tips = card.querySelector('[data-vr-tips]');
  const cta = card.querySelector('[data-vr-cta]');

  // Short on purpose: this is the Cool page, not a manual. The long setup
  // instructions live in vr.html itself.
  function setRegularDevice() {
    if (hint) {
      hint.textContent =
        "The whole portfolio, rebuilt in 3D. Open it on a headset browser to step inside, or take the 3D preview here.";
    }
    if (tips) tips.hidden = true;
    if (cta) cta.textContent = '▶ Open VR space ↗';
  }

  function setXrDevice() {
    if (hint) {
      hint.textContent = 'Your browser can do this. Step inside and grab things.';
    }
    if (tips) tips.hidden = true;
    if (cta) cta.textContent = '▶ Enter VR ↗';
  }

  setRegularDevice();

  if (!navigator.xr || typeof navigator.xr.isSessionSupported !== 'function') return;

  navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
    if (supported) setXrDevice();
  }).catch(() => {});
})();
