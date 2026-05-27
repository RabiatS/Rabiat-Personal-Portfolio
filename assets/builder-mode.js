/**
 * Shared eligibility for builder cube mode (homepage desktop by default)
 * Opt out: index.html?cube=0  or  localStorage.setItem('builderCubeMode','false')
 * Opt back in: index.html?cube=1  or  localStorage.removeItem('builderCubeMode')
 */

export const STORAGE_KEY = 'builderCubeMode';
export const DESKTOP_MIN = 1024;

export function applyUrlUnlock() {
  const params = new URLSearchParams(window.location.search);
  const cube = params.get('cube');
  if (cube === '1') {
    localStorage.removeItem(STORAGE_KEY);
    params.delete('cube');
    const next = params.toString();
    history.replaceState({}, '', window.location.pathname + (next ? `?${next}` : '') + window.location.hash);
  } else if (cube === '0') {
    localStorage.setItem(STORAGE_KEY, 'false');
    params.delete('cube');
    const next = params.toString();
    history.replaceState({}, '', window.location.pathname + (next ? `?${next}` : '') + window.location.hash);
  }
}

export function isHomePage() {
  return document.body.classList.contains('page-home') ||
    /index\.html?$/.test(window.location.pathname) ||
    window.location.pathname.endsWith('/');
}

export function isBuilderModeUnlocked() {
  return localStorage.getItem(STORAGE_KEY) !== 'false';
}

export function canUseBuilderMode() {
  if (!isHomePage()) return false;
  if (!isBuilderModeUnlocked()) return false;
  if (window.innerWidth < DESKTOP_MIN) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  return true;
}

export function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export function canUseBuilderCube() {
  return canUseBuilderMode() && hasWebGL();
}

export function enableBuilderModeClass() {
  if (canUseBuilderMode()) {
    document.documentElement.classList.add('builder-mode');
  }
}
