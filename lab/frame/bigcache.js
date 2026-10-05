// The Lab's cache, on top of Cache Storage. Some browsers refuse a single
// cache entry over a few hundred MB (the desktop app's browser stops near
// 256 MB), so files larger than one part are stored as 64 MB parts plus a
// small index entry under the file's own URL. Small files are stored whole,
// exactly as before, so older cached models stay valid.
//
// It implements the match/put pair Transformers.js accepts as env.customCache,
// and the frame uses the same functions to check and forget files.

const PART = 64 * 1024 * 1024;
// A query, not a #fragment: the Cache API ignores fragments when matching.
const partUrl = (url, i) => `${url}?lab-part=${i}`;
const keyOf = (req) => (typeof req === 'string' ? req : req.url);

export async function openBigCache(name) {
  let cache = null;
  try { cache = await caches.open(name); } catch { return null; } // private windows can refuse

  async function match(req) {
    const url = keyOf(req);
    const head = await cache.match(url);
    if (!head) return undefined;
    const parts = Number(head.headers.get('x-lab-parts') || 0);
    if (!parts) return head; // stored whole
    const size = head.headers.get('x-lab-size');
    let i = 0;
    const body = new ReadableStream({
      async pull(ctrl) {
        if (i >= parts) { ctrl.close(); return; }
        const part = await cache.match(partUrl(url, i++));
        if (!part) { ctrl.error(new Error('Part of a cached model is missing; reload to download it again')); return; }
        ctrl.enqueue(new Uint8Array(await part.arrayBuffer()));
      },
    });
    return new Response(body, { headers: { 'content-length': size, 'content-type': 'application/octet-stream' } });
  }

  // Streams the body into the cache. Parts are written first and the index
  // last, so an interrupted download never looks cached.
  async function put(req, response, progress_callback) {
    try { await write(keyOf(req), response, progress_callback); }
    catch (err) { await remove(req).catch(() => {}); throw err; } // never leave half a file behind
  }

  async function write(url, response, progress_callback) {
    const total = Number(response.headers.get('content-length')) || 0;
    const reader = response.body.getReader();
    let held = [], heldBytes = 0, parts = 0, loaded = 0;
    const flush = async () => {
      if (!heldBytes) return;
      await cache.put(partUrl(url, parts++), new Response(new Blob(held)));
      held = []; heldBytes = 0;
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // A body made from one buffer can arrive as a single huge chunk, so cut
      // every chunk at the part boundary rather than trusting its size.
      for (let at = 0; at < value.length;) {
        const piece = value.subarray(at, at + (PART - heldBytes));
        held.push(piece); heldBytes += piece.length; at += piece.length;
        if (heldBytes >= PART) await flush();
      }
      loaded += value.length;
      progress_callback?.({ progress: total ? (loaded / total) * 100 : 0, loaded, total });
    }
    if (parts === 0) {
      // Small file: one ordinary entry, as Transformers.js would write it.
      await cache.put(url, new Response(new Blob(held), { headers: { 'content-length': String(loaded) } }));
      return;
    }
    await flush();
    await cache.put(url, new Response('', { headers: { 'x-lab-parts': String(parts), 'x-lab-size': String(loaded) } }));
  }

  async function remove(req) {
    const url = keyOf(req);
    const keys = await cache.keys();
    await Promise.all(keys.filter((k) => k.url === url || k.url.startsWith(`${url}?lab-part=`)).map((k) => cache.delete(k)));
  }

  return { match, put, delete: remove, keys: () => cache.keys() };
}
