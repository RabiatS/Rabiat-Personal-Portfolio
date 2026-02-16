// THEME TOGGLE with SECRET RAINBOW MODE
(function(){
  const btn = document.getElementById('themeToggle');
  let hoverTimeout = null;
  let secretTooltip = null;
  let isRainbowMode = localStorage.getItem('rainbowMode') === 'true';
  
  const setTheme = (mode) => {
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
  
  let currentScheme = parseInt(localStorage.getItem('colorScheme') || '0');
  
  function applyScheme(index) {
    const scheme = colorSchemes[index];
    const root = document.documentElement;
    root.style.setProperty('--primary', scheme.primary);
    root.style.setProperty('--accent', scheme.accent);
    
    // Update hero gradient
    const hero = document.querySelector('.hero--fullscreen');
    if (hero) {
      hero.style.background = scheme.hero;
      hero.style.backgroundSize = '200% 200%';
    }
    
    localStorage.setItem('colorScheme', index.toString());
  }
  
  // Apply saved scheme on load
  applyScheme(currentScheme);
  
  btn.addEventListener('click', () => {
    currentScheme = (currentScheme + 1) % colorSchemes.length;
    applyScheme(currentScheme);
    
    // Fun animation on button
    btn.style.transform = 'scale(1.2) rotate(180deg)';
    setTimeout(() => {
      btn.style.transform = '';
    }, 300);
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
    // More stars in rainbow mode, larger and brighter
    const baseCount = rainbowMode ? 2000 : 6000;
    const count = Math.round((w*h)/(baseCount*dpr));
    stars = Array.from({length: count}, () => ({
      x: Math.random()*w,
      y: Math.random()*h,
      z: Math.random()*0.5 + 0.5,
      r: rainbowMode ? Math.random()*3.5 + 1.5 : Math.random()*2.5 + 1.0,
      tw: Math.random()*0.5 + 0.5,
      color: rainbowMode ? Math.random() : (Math.random() > 0.7 ? 'warm' : 'cool'),
      hue: Math.random() // For rainbow mode
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
    // Darker, more transparent background to let stars pop
    const g = ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0,'rgba(0,0,0,0.3)');
    g.addColorStop(1,'rgba(10,10,30,0.3)');
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);

    // Double the parallax movement in rainbow mode
    const parallaxMultiplier = rainbowMode ? 4 : 1;
    const offsetX = (cur.x - 0.5) * 25 * parallaxMultiplier;
    const offsetY = (cur.y - 0.5) * 20 * parallaxMultiplier;
    const t = now * 0.001;
    const twinkleSpeed = rainbowMode ? 8 : 3; // Faster twinkling in rainbow mode

    // Draw stars
    for(const s of stars){
      const x = s.x + offsetX * (1.6 - s.z);
      const y = s.y + offsetY * (1.6 - s.z);
      const twinkle = 0.7 + Math.sin(t*twinkleSpeed + s.x*0.003 + s.y*0.003)*0.3*s.tw;

      // Draw star glow
      const glowSize = s.r * s.z * (rainbowMode ? 4 : 3);
      const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize);
      
      if (rainbowMode) {
        const color = getRainbowColor(t * 0.5 + s.hue, s.x * 0.001);
        glowGradient.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${0.6*twinkle})`);
        glowGradient.addColorStop(0.5, `rgba(${color.r},${color.g},${color.b},${0.25*twinkle})`);
      } else if (s.color === 'warm') {
        glowGradient.addColorStop(0, `rgba(255,200,150,${0.4*twinkle})`);
        glowGradient.addColorStop(0.5, `rgba(255,150,100,${0.15*twinkle})`);
      } else {
        glowGradient.addColorStop(0, `rgba(220,230,255,${0.5*twinkle})`);
        glowGradient.addColorStop(0.5, `rgba(150,180,255,${0.2*twinkle})`);
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
        ctx.fillStyle = s.color === 'warm' ? `rgba(255,240,220,${twinkle})` : `rgba(255,255,255,${twinkle})`;
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
})();


// PROJECT LOADING AND FILTERING (projects.html)
(function(){
  let grid, loadingEl, noProjectsEl, searchInput, projectCountEl;
  let allProjects = [];
  let filteredProjects = [];

  // Embedded projects data (works without server)
  const EMBEDDED_PROJECTS = [
    {id:"gazeflow",title:"GazeFlow – Mosaic of Attention",subtitle:"Tartan Hacks 2025 — XR Eye-Tracking Experience",category:"XR / Unity / Immersive",tags:["XR","VR","Research","HCI","Hackathon"],description:"XR eye-tracking experience that turns scattered glances into a living mosaic of light. Explores how fragmented visual moments can be measured and re-shaped into clearer pictures in virtual space.",github:"https://github.com/RabiatS/GazeFlow",caseStudy:null,status:"complete",images:[],year:"2025"},
    {id:"playstation-internship",title:"Gameplay Video Score Extraction Pipeline",subtitle:"Applied ML Intern — PlayStation (SIE)",category:"Applied ML / CV / Video",tags:["ML","Data","Streaming","CV","Industry"],description:"Built an end-to-end pipeline to extract on-screen gameplay scores from long-form streaming videos and align scores to timestamps.",github:null,caseStudy:"case-studies/case-study-ps.html",status:"complete",images:[],year:"2025"},
    {id:"magic-mitts",title:"Magic Mitts",subtitle:"Affordable Haptic VR Gloves — 1st Place UTSA",category:"XR / Unity / Immersive",tags:["XR","Hardware","Unity","Research"],description:"Led team to build affordable haptic glove with flex sensors and EM braking. 18% latency reduction, 24% comfort improvement.",github:"https://github.com/RabiatS/MagicMitts---Smart-VR-Gloves",caseStudy:"case-studies/case-study.html",status:"complete",images:["assets/mm.png"],year:"2024"},
    {id:"xr-pain-perception",title:"XR Pain Augmentation Research",subtitle:"CMU Augmented Perception Lab",category:"XR / Unity / Immersive",tags:["XR","Research","HCI","Perception"],description:"Multimodal XR prototypes to study pain perception; building adaptive interfaces with structured logging for ML personalization.",github:null,caseStudy:"case-studies/case-study-pain-xr.html",status:"complete",images:[],year:"2025"},
    {id:"assuage",title:"Assuage",subtitle:"ML Distress Prediction",category:"Applied ML / CV / Video",tags:["ML","Research","HCI"],description:"Logistic regression to predict distress level from HealthKit biometrics; 82% test accuracy with on-device CoreML inference.",github:"https://github.com/RabiatS/final-project-aimleaders",caseStudy:"case-study-assuage.html",status:"complete",images:[],year:"2024"},
    {id:"spotify-research",title:"Spotify vs AI Research Study",subtitle:"UX Research & Design",category:"Research / HCI",tags:["HCI","Research"],description:"UX research exploring how Spotify listeners perceive AI-generated music, and how clearer labeling can build trust.",github:"https://github.com/RabiatS/spotify-vs-ai-research-study",demo:"https://spotify-vs-ai-research-study.vercel.app/",caseStudy:"case-studies/case-study-spotify.html",status:"complete",images:[],year:"2024"},
    {id:"vr-music-visualizer",title:"VR Music Visualizer",subtitle:"Audio-Reactive 3D Environments",category:"XR / Unity / Immersive",tags:["XR","Unity","VR","Personal"],description:"Reactive 3D visuals responding to audio frequencies with hand tracking interactions. Quest 2 app.",github:"https://github.com/RabiatS/VR-music-visualizer",caseStudy:null,status:"complete",images:[],year:"2024"},
    {id:"multimodal-pipeline",title:"Multimodal Unstructured Data Pipeline",subtitle:"Production-Ready Processing",category:"Applied ML / CV / Video",tags:["ML","Data","CV","Audio","Personal"],description:"Modular pipeline converting unstructured video, audio, and sensor data into structured, timestamped events.",github:"https://github.com/RabiatS",caseStudy:null,status:"complete",images:[],year:"2024"},
    {id:"yolov5-car-detection",title:"YOLOv5 Car Detection",subtitle:"Real-Time Vehicle Detection",category:"Applied ML / CV / Video",tags:["ML","CV","Personal"],description:"Vehicle detection from video using YOLOv5 with real-time inference using OpenCV.",github:"https://github.com/RabiatS/Pytorch_car_detection_model",caseStudy:null,status:"complete",images:[],year:"2024"},
    {id:"applied-stem",title:"Applied STEM Platform",subtitle:"Co-founder / AI & Full-Stack Engineer",category:"Applied ML / CV / Video",tags:["ML","Industry"],description:"AI-powered technical interview platform with React/TypeScript canvas and FastAPI backend for circuit simulation.",github:null,caseStudy:null,status:"complete",images:[],year:"2024"},
    {id:"weeping-angel-vr",title:"Weeping Angel VR",subtitle:"Don't Blink Experience",category:"XR / Unity / Immersive",tags:["XR","Unity","VR","Personal"],description:"VR experience where objects move closer when not observed—'weeping angel' mechanic focusing on presence and tension.",github:"https://github.com/RabiatS/Weeping_angel_VR",caseStudy:null,status:"complete",images:[],year:"2024"},
    {id:"ar-guided-journeys",title:"AR Guided Journeys",subtitle:"Quest 3 Mixed Reality Navigation",category:"XR / Unity / Immersive",tags:["XR","AR","Unity","Personal"],description:"Quest 3 mixed reality indoor navigation and learning app with AR paths and informative content.",github:"https://github.com/RabiatS/AR-Guided-Journeys-Interactive-Learning",caseStudy:null,status:"complete",images:[],year:"2024"},
    {id:"vr-data-visualization",title:"VR Interactive Data Visualization",subtitle:"3D Graph Exploration",category:"XR / Unity / Immersive",tags:["XR","VR","Data","ML","Personal"],description:"VR system for exploring graphs and datasets in 3D space with grab/drag/move interaction.",github:"https://github.com/RabiatS/VR-Interactive-Data-Visualization-with-AIML",caseStudy:null,status:"complete",images:[],year:"2024"},
    {id:"hand-controlled-visuals",title:"Hand-Controlled Visuals",subtitle:"OpenCV MediaPipe Visualizer",category:"XR / Unity / Immersive",tags:["CV","XR","Personal"],description:"Python hand-tracking visualizer with four effects controlled by finger gestures.",github:"https://github.com/RabiatS/Hand-Controlled-Visuals-OpenCV-MediaPipe-",caseStudy:null,status:"complete",images:[],year:"2024"},
    {id:"vr-content-analysis",title:"VR Content Analysis",subtitle:"AI-Empowered Safety Research",category:"Research / HCI",tags:["Research","HCI","XR","ML"],description:"Research on AI-empowered VR content analysis to address harassment and safety issues.",github:null,caseStudy:null,status:"complete",images:[],year:"2023-2024"},
    {id:"talky-talky",title:"Talky Talky",subtitle:"Audio-Responsive App",category:"Software",tags:["Software","HCI"],description:"Audio-responsive app for non-verbal kids with Google Text-to-Speech integration.",github:"https://github.com/RabiatS/software-product-sprint-2022",caseStudy:null,status:"complete",images:[],year:"2022"},
    {id:"apple-nacme-projects",title:"Apple NACME AIML Intensive",subtitle:"35 Projects — 8-Week Bootcamp",category:"Early Work / Learning",tags:["ML","Early","Learning"],description:"Completed 35 projects covering Python, data analysis, ML, deep learning, and advanced ML topics.",github:"https://github.com/RabiatS",caseStudy:null,status:"complete",images:[],year:"2024"},
    {id:"task-manager",title:"Task Manager App",subtitle:"Android Journaling & Cloud Sync",category:"Software",tags:["Software"],description:"Android app with Firebase and SQLite; journaling, authentication, cloud sync.",github:"https://github.com/RabiatS/TaskManager-CS3443",caseStudy:null,status:"complete",images:[],year:"2023"},
    {id:"titanic-ml",title:"Titanic Survival Prediction",subtitle:"Classic ML Analysis",category:"Early Work / Learning",tags:["ML","Early","Learning"],description:"ML analysis predicting Titanic passenger survival with logistic regression and ensemble methods.",github:"https://github.com/RabiatS/titanic_survivers_ml",caseStudy:null,status:"complete",images:[],year:"2024"}
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

  // Load projects - use embedded data (always works)
  async function loadProjects(){
    if (!getElements()) return; // Exit if not on projects page
    
    // Use embedded projects directly - no fetch needed
    allProjects = EMBEDDED_PROJECTS;
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
      
      // Determine image/background - use gradient with icon for missing images
      let imgStyle = '';
      if (project.images && project.images.length > 0 && project.images[0]) {
        imgStyle = `--img:url('${project.images[0]}')`;
      } else {
        // Use gradient based on category with emoji/icon overlay
        const categoryStyles = {
          'Applied ML / CV / Video': { gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)', icon: '🤖' },
          'XR / Unity / Immersive': { gradient: 'linear-gradient(135deg,#06b6d4,#3b82f6)', icon: '🥽' },
          'Research / HCI': { gradient: 'linear-gradient(135deg,#3b82f6,#6366f1)', icon: '🔬' },
          'Early Work / Learning': { gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)', icon: '📚' },
          'Software': { gradient: 'linear-gradient(135deg,#10b981,#3b82f6)', icon: '💻' },
          'Hardware / Embedded': { gradient: 'linear-gradient(135deg,#10b981,#14b8a6)', icon: '⚡' },
          'Early Work / Learning': { gradient: 'linear-gradient(135deg,#64748b,#475569)', icon: '📚' }
        };
        const style = categoryStyles[project.category] || { gradient: 'linear-gradient(135deg,#6366f1,#8b5cf6)', icon: '💻' };
        imgStyle = `background:${style.gradient}`;
        
        // Add icon overlay - insert before cardBody
        const iconOverlay = document.createElement('div');
        iconOverlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:64px;opacity:0.25;pointer-events:none;z-index:1;';
        iconOverlay.textContent = style.icon;
        // Will append after cardBody is created
        card._iconOverlay = iconOverlay;
      }
      card.style.cssText += imgStyle;

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
        // Style tags for gradient cards (white text)
        if (!project.images || project.images.length === 0) {
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
        if (!project.images || project.images.length === 0) {
          templateBadge.style.color = '#ffffff';
        }
        badges.appendChild(templateBadge);
      }
      
      cardBody.appendChild(badges);

      // Links
      if (project.github || project.demo) {
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
          demoLink.textContent = 'Demo';
          demoLink.style.fontSize = '13px';
          demoLink.style.color = 'inherit';
          demoLink.style.opacity = '0.8';
          links.appendChild(demoLink);
        }
        
        if (links.children.length > 0) {
          cardBody.appendChild(links);
        }
      }

      // Append cardBody to card
      card.appendChild(cardBody);
      
      // Add icon overlay if it exists (for gradient cards without images)
      if (card._iconOverlay) {
        card.appendChild(card._iconOverlay);
        delete card._iconOverlay;
      }
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

  const initialMode = (body?.dataset?.tiltMode || 'desktop').toLowerCase();
  if (selectEl){
    selectEl.value = initialMode;
    selectEl.addEventListener('change', ()=>{
      const mode = selectEl.value;
      body.dataset.tiltMode = mode;
      apply(mode);
    }, {passive:true});
  }
  document.addEventListener('DOMContentLoaded', ()=> apply(initialMode));

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
