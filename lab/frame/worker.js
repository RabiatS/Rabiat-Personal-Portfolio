// The Lab's model worker. All the work is in engine.js, so the same code can
// run on the main thread in a browser that has no WebGPU inside workers.
import { handle } from './engine.js';

self.onmessage = (e) => handle(e.data, (msg, transfer) => self.postMessage(msg, transfer || []));
