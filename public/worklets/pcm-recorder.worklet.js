// Captures mono mic audio and posts ~2048-sample Float32 chunks to the
// main thread, where they are converted to 16-bit PCM for Gemini Live.
class PCMRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffers = [];
    this.frames = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      this.buffers.push(new Float32Array(channel));
      this.frames += channel.length;
      if (this.frames >= 2048) {
        const merged = new Float32Array(this.frames);
        let offset = 0;
        for (const buffer of this.buffers) {
          merged.set(buffer, offset);
          offset += buffer.length;
        }
        this.port.postMessage(merged, [merged.buffer]);
        this.buffers = [];
        this.frames = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-recorder", PCMRecorder);
