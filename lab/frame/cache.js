// The Lab's one cache. Transformers.js stores each file under its full
// resolve URL, sha included (worker.js pins the path template), so the frame
// can tell what is already on this device without touching the network.

import { openBigCache } from './bigcache.js';

// Rabiat's copy once it exists; the pinned upstream commit until then.
export function repoOf(model) {
  return model.mirror?.sha ? model.mirror : model.source;
}

// Where a file lives. Hugging Face by default (pinned by commit); small
// models that only exist elsewhere can come from GitHub (pinned by commit)
// or a fixed, versioned URL ("host": "url", "base": "https://.../1/"). Files gathered
// from several places are staged with "host": "local", "dir": "lab/<slug>/.assets/" and
// mirrored into one Hugging Face repo before they ship.
export function fileUrl(model, path) {
  const { repo, sha, host = 'hf', base } = repoOf(model);
  if (host === 'github') return `https://raw.githubusercontent.com/${repo}/${sha}/${path}`;
  if (host === 'url') return `${base}${path}`;
  // Development only: files staged in the worktree (git-ignored) until they are mirrored.
  if (host === 'local') return new URL(`/${repoOf(model).dir}${path}`, self.location.origin).href;
  return `https://huggingface.co/${repo}/resolve/${sha}/${path}`;
}

// Files may be stored whole or in parts (bigcache.js); match() and delete() handle both.
const open = (cacheKey) => openBigCache(cacheKey);

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
  for (const f of Object.keys(model.files)) await cache.delete(fileUrl(model, f));
}
