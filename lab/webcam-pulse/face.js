// Finding the face and cutting out what the model reads, as the official
// ME-rPPG web demo does: MediaPipe's BlazeFace short-range detector on each
// frame (on the CPU, in video mode, confidence 0.5), its box smoothed by four
// Kalman filters, stretched 20% taller and moved up to take in the forehead,
// then cropped from the full frame and shrunk to 36 x 36 RGB, values 0 to 1.
// MediaPipe Tasks Vision and the BlazeFace model are Apache 2.0, from Google.
import { Kalman1D } from './pulse.js';

const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/';
const BLAZEFACE = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
export const SIZE = 36;

let finder = null;
// Loaded on the first Start, never before: the click is the consent to download.
export function loadFaceFinder() {
  if (!finder) hushDelegateNote();
  finder ??= (async () => {
    const { FaceDetector, FilesetResolver } = await import(`${MP}vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${MP}wasm`);
    return FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: BLAZEFACE, delegate: 'CPU' },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
    });
  })();
  finder.catch(() => { finder = null; }); // a failed download can be tried again
  return finder;
}

// MediaPipe announces its CPU delegate with an INFO line sent through
// console.error. It is not an error; drop that one line and nothing else.
let hushed = false;
function hushDelegateNote() {
  if (hushed) return;
  hushed = true;
  const error = console.error;
  console.error = function (...args) {
    if (typeof args[0] === 'string' && args[0].startsWith('INFO: Created TensorFlow Lite XNNPACK delegate')) return;
    return error.apply(this, args);
  };
}

// The demo's box smoothing: process noise 0.01, measurement noise 0.5.
export class FaceBox {
  constructor() { this.reset(); }
  reset() { this.kf = null; this.box = null; }
  update({ originX, originY, width, height }) {
    if (!this.kf) this.kf = [originX, originY, width, height].map((v) => new Kalman1D(1e-2, 5e-1, v, 1));
    else [originX, originY, width, height].forEach((v, i) => this.kf[i].update(v));
    const [x, y, w, h0] = this.kf.map((k) => k.x);
    const h = h0 * 1.2;
    this.box = { x, y: y - h * 0.2, w, h };
    return this.box;
  }
}

const crop = document.createElement('canvas');
crop.width = crop.height = SIZE;
const cctx = crop.getContext('2d', { willReadFrequently: true });

// The box, clamped the way the demo clamps it, drawn down to 36 x 36 with
// high-quality smoothing, as RGB floats in height, width, channel order.
// src is the video (or, in a test, a canvas).
export function cropFace(src, box) {
  const vw = src.videoWidth || src.width, vh = src.videoHeight || src.height;
  const x = Math.max(0, box.x), y = Math.max(0, box.y);
  const w = Math.min(box.w, vw - x), h = Math.min(box.h, vh - y);
  if (!(w >= 2 && h >= 2)) return null;
  cctx.imageSmoothingEnabled = true;
  cctx.imageSmoothingQuality = 'high';
  cctx.drawImage(src, x, y, w, h, 0, 0, SIZE, SIZE);
  const px = cctx.getImageData(0, 0, SIZE, SIZE).data;
  const out = new Float32Array(SIZE * SIZE * 3);
  for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
    out[j] = px[i] / 255; out[j + 1] = px[i + 1] / 255; out[j + 2] = px[i + 2] / 255;
  }
  return out;
}
