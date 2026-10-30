// Live, word-by-word caption of the candidate while they speak.
//
// Gemini Live only sends the candidate's transcription once they pause, so a
// long answer would show nothing until it ends. The browser's own speech
// recognition streams interim words instead. It is display-only: the saved
// transcript (and the report) always use Gemini's transcription, which
// replaces this text when it arrives.
//
// Chrome, Edge and Safari support it; elsewhere `supported` is false and the
// caller shows a plain "Listening..." placeholder.

interface RecognitionResult {
  0: { transcript: string };
  isFinal: boolean;
}
interface RecognitionEvent {
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  // Mobile recognisers beep on every (re)start, which we do at each pause.
  if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export class LiveCaption {
  static get supported(): boolean {
    return recognitionCtor() !== null;
  }

  private recognition: Recognition | null = null;
  private running = false;
  private onText: ((text: string) => void) | null = null;

  start(onText: (text: string) => void) {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    this.onText = onText;
    this.running = true;
    this.spawn(Ctor);
  }

  // Start a fresh utterance (a new turn): drops the words heard so far.
  reset() {
    if (!this.running) return;
    this.recognition?.abort(); // onend restarts it with empty results
  }

  stop() {
    this.running = false;
    this.onText = null;
    const recognition = this.recognition;
    this.recognition = null;
    try {
      recognition?.abort();
    } catch {
      // already stopped
    }
  }

  private spawn(Ctor: RecognitionCtor) {
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language?.startsWith("en") ? navigator.language : "en-US";
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
      this.onText?.(text.trim());
    };
    // Browsers end recognition after a pause or a time limit; keep it going
    // for the whole interview.
    recognition.onend = () => {
      if (this.running && this.recognition === recognition) this.spawn(Ctor);
    };
    recognition.onerror = (event) => {
      // Permission or service problems: give up quietly, the caption just
      // falls back to Gemini's (end-of-answer) transcription.
      if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "network") {
        this.running = false;
      }
    };
    this.recognition = recognition;
    try {
      recognition.start();
    } catch {
      this.running = false;
    }
  }
}
