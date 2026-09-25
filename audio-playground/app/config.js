// Where the model files live. By default: the `models/` folder next to this site.
// For a public site, upload the .onnx + .json files somewhere with a fast CDN
// (e.g. a Hugging Face model repo) and put that URL here, ending with a slash:
//   export const MODEL_BASE = 'https://huggingface.co/<you>/audio-playground-models/resolve/main/';
export const MODEL_BASE = new URL('../models/', import.meta.url).href;

// ONNX Runtime Web (runs the neural network on the visitor's GPU via WebGPU).
export const ORT_VERSION = '1.30.0';

export const MODELS = [
  { id: 'htdemucs', model: 'htdemucs', label: '4 stems: vocals, drums, bass, other', mb: 91 },
  { id: 'vocals', model: 'htdemucs', label: 'Vocals + instrumental', mb: 91, merge: true },
  { id: 'htdemucs_6s', model: 'htdemucs_6s', label: '6 stems: + guitar, piano', mb: 60 },
];
