const TARGET_SAMPLE_RATE = 16000;

export class MicPermissionError extends Error {
  constructor() {
    super("Microphone permission denied");
    this.name = "MicPermissionError";
  }
}

function floatTo16BitPcmBase64(samples: Float32Array): string {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Linear-interpolation downsample for browsers that refuse a 16kHz AudioContext.
function downsample(samples: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const length = Math.floor(samples.length / ratio);
  const result = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const pos = i * ratio;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, samples.length - 1);
    const frac = pos - left;
    result[i] = samples[left] * (1 - frac) + samples[right] * frac;
  }
  return result;
}

export class PcmRecorder {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;

  async start(onChunk: (base64Pcm16: string) => void): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (e) {
      if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError")) {
        throw new MicPermissionError();
      }
      throw e;
    }

    try {
      this.context = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE });
    } catch {
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") await this.context.resume();

    await this.context.audioWorklet.addModule("/worklets/pcm-recorder.worklet.js");

    this.source = this.context.createMediaStreamSource(this.stream);
    this.worklet = new AudioWorkletNode(this.context, "pcm-recorder");

    const contextRate = this.context.sampleRate;
    this.worklet.port.onmessage = (event: MessageEvent<Float32Array>) => {
      const resampled = downsample(event.data, contextRate, TARGET_SAMPLE_RATE);
      onChunk(floatTo16BitPcmBase64(resampled));
    };

    this.source.connect(this.worklet);
  }

  stop(): void {
    this.worklet?.port.close();
    this.worklet?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close().catch(() => {});
    this.worklet = null;
    this.source = null;
    this.stream = null;
    this.context = null;
  }
}
