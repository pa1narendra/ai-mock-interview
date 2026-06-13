export class UnsupportedAudioError extends Error {
  constructor() {
    super("Your browser doesn't support voice interviews. Try the latest Chrome, Edge, or Safari on desktop.");
    this.name = "UnsupportedAudioError";
  }
}

type AudioContextCtor = typeof AudioContext;

// Safari (and older iOS) only expose the prefixed webkitAudioContext.
export function getAudioContextClass(): AudioContextCtor {
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!ctor) throw new UnsupportedAudioError();
  return ctor;
}
