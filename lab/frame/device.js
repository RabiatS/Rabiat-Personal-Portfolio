// What this device can run. Asks the browser only; nothing is downloaded here.
//   tier:   'gpu' when WebGPU gives a real adapter with half-precision maths
//           (the same test as the Background Remover), otherwise 'cpu'
//   budget: a conservative guess at the memory a model may use before the tab
//           is at risk. Phones don't report memory, so they get a fixed floor.
// Test overrides: ?tier=cpu and ?budget=<MB>.

const params = new URLSearchParams(location.search);

function isPhone() {
  if (navigator.userAgentData) return navigator.userAgentData.mobile;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod|Android/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

let checked = null;
export function checkDevice() {
  return (checked ??= (async () => {
    const phone = isPhone();
    let tier = 'cpu', gpu = null;
    if (params.get('tier') !== 'cpu') {
      try {
        const a = await navigator.gpu?.requestAdapter();
        const fallback = a?.info?.isFallbackAdapter ?? a?.isFallbackAdapter;
        if (a && !fallback && a.features.has('shader-f16')) {
          tier = 'gpu';
          gpu = { vendor: a.info?.vendor || '', architecture: a.info?.architecture || '' };
        }
      } catch { /* no WebGPU */ }
    }
    const gb = navigator.deviceMemory; // Chrome only, capped at 8
    let budgetMB = gb ? Math.round(gb * 1024 * 0.25) : (phone ? 450 : 2000);
    if (params.has('budget')) budgetMB = Number(params.get('budget')) || 0;
    let freeMB = null;
    try { const e = await navigator.storage?.estimate(); if (e) freeMB = Math.round((e.quota - e.usage) / 1048576); } catch {}
    return { tier, phone, gpu, budgetMB, freeMB };
  })());
}

// First variant this device can use, or null with the smallest need for the message.
// A GPU device may fall back to a CPU variant; a CPU device never gets a GPU one.
export function pickVariant(model, dev) {
  const usable = model.variants.filter((v) =>
    (v.tier === 'cpu' || dev.tier === 'gpu') && (v.phone === undefined || v.phone === dev.phone));
  const fits = usable.find((v) => v.memMB <= dev.budgetMB);
  const needMB = Math.min(...(usable.length ? usable : model.variants).map((v) => v.memMB));
  return { variant: fits || null, needMB };
}

export function variantBytes(model, variant) {
  return variant.files.reduce((n, f) => n + (model.files[f] || 0), 0);
}

export const mb = (bytes) => {
  const v = bytes / 1e6;
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} MB`;
};
