"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleGenAI,
  type LiveConnectConfig,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import { toast } from "sonner";
import { MicPermissionError, PcmRecorder } from "@/lib/audio/recorder";
import { PcmPlayer } from "@/lib/audio/player";

export enum SessionStatus {
  IDLE = "IDLE",
  CONNECTING = "CONNECTING",
  LIVE = "LIVE",
  ENDED = "ENDED",
}

interface TokenResponse {
  success: boolean;
  message?: string;
  token?: string;
  model?: string;
  config?: LiveConnectConfig;
}

// Watchdog: if the interviewer goes silent (VAD missed the end of the user's
// turn, or the model produced an empty turn), nudge it back to life.
const IDLE_MS = 25_000;
const MAX_NUDGES = 3;

export function useVoiceSession(interviewId: string) {
  const [status, setStatusState] = useState<SessionStatus>(SessionStatus.IDLE);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  // In-progress transcript of the current turn, streamed fragment by fragment.
  const [caption, setCaption] = useState<SavedMessage | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const recorderRef = useRef<PcmRecorder | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const userBufferRef = useRef("");
  const modelBufferRef = useRef("");
  const resumeHandleRef = useRef<string | undefined>(undefined);
  const userEndedRef = useRef(false);
  const reconnectingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const statusRef = useRef<SessionStatus>(SessionStatus.IDLE);
  const connectRef = useRef<((resumeHandle?: string) => Promise<void>) | null>(null);
  const lastActivityRef = useRef(0);
  const nudgeCountRef = useRef(0);
  const isSpeakingRef = useRef(false);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setStatus = useCallback((next: SessionStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const flushBuffer = useCallback((ref: React.RefObject<string>, role: "user" | "assistant") => {
    const content = ref.current.trim();
    ref.current = "";
    if (content) {
      setMessages((prev) => [...prev, { role, content }]);
      setCaption((current) => (current?.role === role ? null : current));
    }
  }, []);

  const teardown = useCallback(() => {
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
    recorderRef.current?.stop();
    recorderRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
    const session = sessionRef.current;
    sessionRef.current = null;
    try {
      session?.close();
    } catch {
      // already closed
    }
  }, []);

  const finish = useCallback(() => {
    if (statusRef.current === SessionStatus.ENDED) return;
    flushBuffer(userBufferRef, "user");
    flushBuffer(modelBufferRef, "assistant");
    setCaption(null);
    teardown();
    setIsSpeaking(false);
    setStatus(SessionStatus.ENDED);
  }, [flushBuffer, teardown, setStatus]);

  const end = useCallback(() => {
    userEndedRef.current = true;
    finish();
  }, [finish]);

  const fetchToken = useCallback(async (resumeHandle?: string): Promise<TokenResponse> => {
    const res = await fetch("/api/voice/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interviewId, resumeHandle }),
    });
    const data = (await res.json().catch(() => ({}))) as TokenResponse;
    if (!res.ok || !data.success || !data.token || !data.model || !data.config) {
      throw new Error(data.message ?? "Could not start the interview session");
    }
    return data;
  }, [interviewId]);

  const handleMessage = useCallback(
    (message: LiveServerMessage) => {
      lastActivityRef.current = Date.now();
      const content = message.serverContent;

      const audio = content?.modelTurn?.parts?.find((p) => p.inlineData?.data)?.inlineData?.data;
      if (audio) playerRef.current?.enqueue(audio);
      // Model is alive again - reset the watchdog strike counter.
      if (audio || content?.outputTranscription?.text) nudgeCountRef.current = 0;

      // The server warns before terminating a connection (~10 min lifetime):
      // reconnect proactively instead of waiting for the close.
      if (message.goAway && resumeHandleRef.current && !reconnectingRef.current && !userEndedRef.current) {
        reconnectingRef.current = true;
        const handle = resumeHandleRef.current;
        void (async () => {
          try {
            sessionRef.current = null;
            await connectRef.current?.(handle);
          } catch (e) {
            console.error("proactive reconnect failed", e);
          } finally {
            reconnectingRef.current = false;
          }
        })();
      }

      if (content?.inputTranscription?.text) {
        userBufferRef.current += content.inputTranscription.text;
        setCaption({ role: "user", content: userBufferRef.current });
      }
      if (content?.outputTranscription?.text) {
        // The model replying marks the end of the user's turn.
        flushBuffer(userBufferRef, "user");
        modelBufferRef.current += content.outputTranscription.text;
        setCaption({ role: "assistant", content: modelBufferRef.current });
      }
      if (content?.interrupted) {
        playerRef.current?.flush();
        flushBuffer(modelBufferRef, "assistant");
      }
      if (content?.turnComplete) {
        flushBuffer(userBufferRef, "user");
        flushBuffer(modelBufferRef, "assistant");
      }

      if (message.sessionResumptionUpdate?.resumable && message.sessionResumptionUpdate.newHandle) {
        resumeHandleRef.current = message.sessionResumptionUpdate.newHandle;
      }

      const endCall = message.toolCall?.functionCalls?.find((fc) => fc.name === "end_interview");
      if (endCall) {
        sessionRef.current?.sendToolResponse({
          functionResponses: { id: endCall.id, name: endCall.name, response: { acknowledged: true } },
        });
        // Let the goodbye finish playing before closing.
        void (async () => {
          await playerRef.current?.drain();
          finish();
        })();
      }
    },
    [flushBuffer, finish]
  );

  const handleClose = useCallback(async () => {
    sessionRef.current = null;
    if (userEndedRef.current || statusRef.current !== SessionStatus.LIVE) return;
    if (reconnectingRef.current) return;

    // Unexpected drop (network blip or ~10 min websocket lifetime):
    // try to resume the session once with a fresh token.
    if (reconnectAttemptsRef.current < 1 && resumeHandleRef.current && connectRef.current) {
      reconnectingRef.current = true;
      reconnectAttemptsRef.current += 1;
      try {
        await connectRef.current(resumeHandleRef.current);
      } catch (e) {
        console.error("failed to resume voice session", e);
        toast.error("Connection lost - finishing the interview with what we have.");
        finish();
      } finally {
        reconnectingRef.current = false;
      }
    } else {
      toast.error("Connection lost - finishing the interview with what we have.");
      finish();
    }
  }, [finish]);

  const connect = useCallback(
    async (resumeHandle?: string) => {
      // The resume handle is baked into the token server-side; the client
      // must echo the token's config verbatim or it is ignored/rejected.
      const { token, model, config } = await fetchToken(resumeHandle);

      const ai = new GoogleGenAI({
        apiKey: token!,
        httpOptions: { apiVersion: "v1alpha" },
      });

      const session = await ai.live.connect({
        model: model!,
        config: config!,
        callbacks: {
          onopen: () => {},
          onmessage: handleMessage,
          onerror: (e: ErrorEvent) => {
            console.error("voice session error", e);
          },
          onclose: () => {
            void handleClose();
          },
        },
      });

      sessionRef.current = session;
      reconnectAttemptsRef.current = 0;
    },
    [fetchToken, handleMessage, handleClose]
  );

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const start = useCallback(async () => {
    if (statusRef.current === SessionStatus.CONNECTING || statusRef.current === SessionStatus.LIVE) return;

    setStatus(SessionStatus.CONNECTING);
    setMessages([]);
    setCaption(null);
    userEndedRef.current = false;
    reconnectAttemptsRef.current = 0;
    resumeHandleRef.current = undefined;
    userBufferRef.current = "";
    modelBufferRef.current = "";

    try {
      // Created inside the click handler so autoplay policy allows playback.
      const player = new PcmPlayer();
      player.init();
      player.onPlaybackStart = () => {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
      };
      player.onPlaybackEnd = () => {
        isSpeakingRef.current = false;
        lastActivityRef.current = Date.now();
        setIsSpeaking(false);
      };
      playerRef.current = player;

      // Request the mic before minting a token so a denial fails fast.
      const recorder = new PcmRecorder();
      await recorder.start((base64) => {
        sessionRef.current?.sendRealtimeInput({
          audio: { data: base64, mimeType: "audio/pcm;rate=16000" },
        });
      });
      recorderRef.current = recorder;

      await connect();
      setStatus(SessionStatus.LIVE);

      lastActivityRef.current = Date.now();
      nudgeCountRef.current = 0;
      watchdogRef.current = setInterval(() => {
        if (statusRef.current !== SessionStatus.LIVE) return;
        if (isSpeakingRef.current) {
          lastActivityRef.current = Date.now();
          return;
        }
        if (Date.now() - lastActivityRef.current < IDLE_MS) return;

        if (nudgeCountRef.current >= MAX_NUDGES) {
          toast.error("The interviewer stopped responding - finishing the interview.");
          finish();
          return;
        }
        nudgeCountRef.current += 1;
        lastActivityRef.current = Date.now();
        // Invisible to the transcript: sendClientContent text is not transcribed.
        sessionRef.current?.sendClientContent({
          turns: [{
            role: "user",
            parts: [{
              text: "(system note: there has been a long silence. If you asked a question, briefly re-ask it; otherwise continue with the next interview question. Respond in English. Do not mention this note.)",
            }],
          }],
          turnComplete: true,
        });
      }, 5_000);
    } catch (e) {
      teardown();
      setStatus(SessionStatus.IDLE);
      if (e instanceof MicPermissionError) {
        toast.error("Microphone access is required for the interview. Please allow it and try again.");
      } else {
        console.error("failed to start voice session", e);
        toast.error(e instanceof Error ? e.message : "Could not start the interview. Please try again.");
      }
    }
  }, [connect, teardown, setStatus, finish]);

  // Clean up if the component unmounts mid-session.
  useEffect(() => {
    return () => {
      userEndedRef.current = true;
      teardown();
    };
  }, [teardown]);

  return { status, isSpeaking, messages, caption, start, end };
}
