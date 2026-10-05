# Lab roadmap

The Lab tab (`/lab/`) is where new openly licensed ML models get tried in the browser before they go into anything else. This file tracks what is in it, what is next, and the ideas still parked. How to add a model is in the README ("Adding a Lab Model").

## Rules

- Open licences only: Apache 2.0, MIT, BSD, CC-BY-4.0 for the exact checkpoint, and no GPL dependencies (eSpeak-based phonemizers are out).
- Each model page says where it runs and how big it is before anything downloads, and refuses what the device cannot handle.
- Models are copied to huggingface.co/RabiatS and pinned to a commit before they ship (`tools-mirror-model.py`).
- Too big for a browser: a "watch the demo" card that links to the official demo, until there is a video of my own.
- The timeline shows each model's real release month. When the month that matters is when I found it, the card says so.

## Timeline

Status: **live** (on the site), **built** (done, waiting to be mirrored and shipped), **building**, **next**, **idea**.

| Released | Model | Type | What you do | Status |
|---|---|---|---|---|
| 2026-09 | Strands Decider 2B (Strands Labs) | Language | Type options, see calibrated odds for each | built |
| 2026-08 | TeleOCR (XingChen) | Vision | Photo of a page, receipt or note becomes text, tables, formulas | built |
| 2026-02 | Voxtral Mini 4B Realtime (Mistral) | Audio | Live transcription | watch card |
| 2026-01 | FLUX.2 [klein] 4B (Black Forest Labs) | Vision | Image generation | watch card |
| 2026-01 | ACE-Step 1.5 | Audio | Music generation | watch card |
| 2026-01 | Soprano 80M | Audio | Type a sentence, hear it spoken | built |
| 2025-12 | DPDFNet (Ceva) | Audio | Noisy voice in, clean voice out | built |
| 2025-12 | TRELLIS.2 (Microsoft) | Vision | Image to 3D | watch card |
| 2025-12 (found) | Teachable Machine style, SigLIP 2 (released 2025-02) | Vision | Show it a few photos of two things, it learns live | next |
| 2025-04 | EdgeTAM (Meta) | Vision | Tap to cut anything out as a sprite | built |
| 2025-11 | Depth Anything 3 Small | Vision | Upgrade the depth page: export a 3D point cloud for VR | next |
| 2025-10 | Chronos-2 (Amazon) | Data | Forecast a series with a confidence fan | next |
| 2025-09 | granite-docling 258M (IBM) | Vision | Document to Markdown | next (may be replaced by TeleOCR) |
| 2025-08 | mdbr-leaf-ir (MongoDB) | Language | Search my portfolio by meaning | built |
| 2025-08 | gpt-oss-20b (OpenAI) | Language | Reasoning chat | watch card |
| 2025-08 | Qwen-Image-Edit (Alibaba) | Vision | Image editing | watch card |
| 2025-07 | RF-DETR Nano (Roboflow) | Vision | Live camera detection | built |
| 2024-01 | AudioSeal (Meta) | Audio | Stamp and find an inaudible watermark | built |
| 2024-10 | Moonshine Tiny | Audio | Speech to text as you talk | live |
| 2024-06 | Depth Anything V2 Small | Vision | Photo to 3D tilt | live |

## Next, from the 5 Oct 2026 scouting

| Section | Model | What you do | Notes |
|---|---|---|---|
| Brain and body | ME-rPPG (MIT, Apr 2025) | Your pulse from your webcam | building |
| Space | MuJoCo WASM + mjlab G1 policy (Apache, BSD-3) | Push the robot, watch it recover | building |
| Space | Depth Anything 3 Base, 4-view (Apache) | Four photos become a 3D room in WebXR | next |
| Brain and body | CBraMod or LaBraM (Apache/MIT) on EEGMMIDB (ODC-BY) | Read a real brain: imagined left or right hand | needs a small fine-tune |
| Brain and body | Berkeley silent speech EMG (CC-BY) | Silently mouthed words, voiced | export untested; else watch card |
| Brain and body | MediaPipe hands and face (Apache) | Hands and face mesh for XR | reliable fallback |
| Science | TRM Sudoku (MIT, 5M) | Watch a tiny network think through a Sudoku | needs an ONNX export |
| Science | Searchless Chess 9M (DeepMind, CC-BY) | Play a model that never searches | ONNX ready |
| Science | ESM-2 8M (MIT) | Hide an amino acid, see what the model expects | runs in Transformers.js |
| Data | Chronos-2-small (Apache, 33 MB) | Phone variant for the forecaster | ONNX ready |
| Fun and useful | YuNet (MIT, 230 KB) | Blur every face before posting | tiny |
| Fun and useful | SwiftF0 (MIT) + Basic Pitch (Apache) | Hum a tune, get notes and MIDI | under 1 MB |
| Fun and useful | PP-OCRv6 small + OPUS-MT tiny (Apache) | Translate a menu or sign in place (camera translator proof) | needs an OPUS-MT export |
| Fun and useful | Swin2SR or Real-ESRGAN, DDColor tiny | Restore and colourise an old photo | DDColor needs an export |
| Watch cards | SmolVLA, X-VLA, Matrix-Game 3.0, FourCastNet 3, AIFS 2.0, Boltz-2, Evo 2, ZUNA1.1 | Robots, weather, proteins, DNA, EEG | official demo pages |

## Sections

Vision, Audio, Language, Data, plus three added on 5 Oct 2026: **Brain and body** (EEG, EMG, heart rate from a camera, pose and hands), **Space** (spatial intelligence, 3D, robotics, VR), **Science and surprises** (proteins, molecules, earth and climate, tiny reasoning models). A **Fun and useful** set is being scouted too: small models that make everyday life easier.

## Ideas parked

- **Camera translator (its own project, 5 Oct 2026):** point the camera at signs, menus or labels in another language and see them rewritten in place, in the language you want. A Lab proof first (photo or camera, OCR plus a small open translator, text redrawn over the original). The full live version probably belongs in an iPhone app: Apple's on-device text recognition (VisionKit Live Text) plus the Translation framework do it with no model downloads.
- **Ask me (second brain):** answers questions about me and the site from my own written answers plus projects.json and writing.json, matched with the same search model (mdbr-leaf-ir), retrieval only so it never makes things up. Waiting on my answers to the question list (in the chat of 29 Sep 2026).
- **Shrink demo:** the same model at full, half and quarter size side by side, with download size, speed and quality, to show how models fit on phones.
- **My own demo videos** for the watch cards.
- **Image to 3D in the browser** once a licence-clean model is small enough (TripoSR exports are unverified).
- **Time series** beyond Chronos-2: Chronos-2-small (28M) once exported.

## Excluded, and why

DINOv3, MobileCLIP 2, FastVLM, MetaCLIP 2, Moondream 3, SAM 3 and SAM 3D, YOLO26 and YOLOE, DEIMv2, Moirai 2, TiRex, LFM2 family, Gemma family, EmbeddingGemma, jina v3 and v5 and clip-v2, Supertonic TTS (custom or non-commercial licences); Kokoro, KittenTTS, NeuTTS Air (GPL eSpeak phonemizer); Qwen3-Embedding-0.6B, SmolLM3, Phi-4-mini (too big for the Lab's budget).

OpenAI "dots" (29 Sep 2026): always-on agents that each run on their own cloud computer. Not open and not on-device, so not a Lab entry.
