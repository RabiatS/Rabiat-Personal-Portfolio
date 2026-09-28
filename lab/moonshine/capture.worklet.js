// Mic (or sample) audio at the device's rate -> 16 kHz mono frames of 512.
// Resampling here, not with an AudioContext at 16 kHz: Firefox refuses to
// connect a microphone to a context running at a different rate.
class Capture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / 16000; // input samples per output sample
    this.pos = 0;                   // read position into the filtered stream
    this.prev = 0;                  // last filtered sample, for interpolation
    this.lp = 0;                    // one-pole low-pass state
    this.a = Math.exp(-2 * Math.PI * 7000 / sampleRate);
    this.out = new Float32Array(512);
    this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      this.lp = (1 - this.a) * ch[i] + this.a * this.lp;
      const cur = this.lp;
      // emit every output sample that falls between prev (t = -1) and cur (t = 0)
      while (this.pos <= 1) {
        this.out[this.n++] = this.prev + (cur - this.prev) * this.pos;
        if (this.n === 512) { this.port.postMessage(this.out.slice(0)); this.n = 0; }
        this.pos += this.step;
      }
      this.pos -= 1;
      this.prev = cur;
    }
    return true;
  }
}
registerProcessor('capture-16k', Capture);
