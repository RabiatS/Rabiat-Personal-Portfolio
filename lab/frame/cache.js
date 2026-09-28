// The Lab's one cache. Transformers.js stores each file under its full
// resolve URL, sha included (worker.js pins the path template), so the frame
// can tell what is already on this device without touching the network.

// Rabiat's copy once it exists; the pinned upstream commit until then.
export function repoOf(model) {
  return model.mirror?.sha ? model.mirror : model.source;
}

export function fileUrl(model, path) {
  const { repo, sha } = repoOf(model);
  return `https://huggingface.co/${repo}/resolve/${sha}/${path}`;
}

async function open(cacheKey) {
  try { return await caches.open(cacheKey); } catch { return null; } // private windows can refuse
}

// { files: Set of cached paths, runtime: whether ONNX Runtime's wasm is cached }
export async function cachedState(cacheKey, model, variant) {
  const cache = await open(cacheKey);
  if (!cache) return { files: new Set(), runtime: false };
  const hits = await Promise.all(variant.files.map((f) => cache.match(fileUrl(model, f))));
  const keys = await cache.keys();
  return {
    files: new Set(variant.files.filter((_, i) => hits[i])),
    runtime: keys.some((r) => r.url.includes('/onnxruntime-web@') && r.url.endsWith('.wasm')),
  };
}

export async function forget(cacheKey, model) {
  const cache = await open(cacheKey);
  if (!cache) return;
  await Promise.all(Object.keys(model.files).map((f) => cache.delete(fileUrl(model, f))));
}
