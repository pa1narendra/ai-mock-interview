const OUTPUT_SAMPLE_RATE = 24000;

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const pcm = new Int16Array(bytes.buffer);
  const floats = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    floats[i] = pcm[i] / (pcm[i] < 0 ? 0x8000 : 0x7fff);
  }
  return floats;
}

// Gapless playback queue for the 24kHz PCM chunks Gemini Live streams back.
export class PcmPlayer {
  private context: AudioContext | null = null;
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();

  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;

  // Must be called from a user-gesture handler so autoplay policy allows audio.
  init(): void {
    if (!this.context) {
      this.context = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    }
    if (this.context.state === "suspended") void this.context.resume();
  }

  enqueue(base64: string): void {
    if (!this.context) return;
    const samples = base64ToFloat32(base64);
    if (!samples.length) return;

    const buffer = this.context.createBuffer(1, samples.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(new Float32Array(samples), 0);

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);

    const now = this.context.currentTime;
    const startAt = Math.max(now, this.nextStartTime);
    this.nextStartTime = startAt + buffer.duration;

    if (this.activeSources.size === 0) this.onPlaybackStart?.();
    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) this.onPlaybackEnd?.();
    };
    source.start(startAt);
  }

  // Stop everything immediately (user barge-in).
  flush(): void {
    for (const source of this.activeSources) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    const wasPlaying = this.activeSources.size > 0;
    this.activeSources.clear();
    this.nextStartTime = 0;
    if (wasPlaying) this.onPlaybackEnd?.();
  }

  // Resolves once all queued audio has finished playing.
  async drain(timeoutMs = 15000): Promise<void> {
    const start = Date.now();
    while (this.activeSources.size > 0 && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  close(): void {
    this.flush();
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
