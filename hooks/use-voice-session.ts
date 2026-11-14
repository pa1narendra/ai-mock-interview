"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveConnectConfig, LiveServerMessage, Session } from "@google/genai";

// The Gemini SDK is large and only needed once the interview starts: it is
// loaded in its own chunk, fetched in the background after the page renders.
const loadGenAI = () => import("@google/genai");
import { toast } from "sonner";
import { MicPermissionError, PcmRecorder } from "@/lib/audio/recorder";
import { PcmPlayer } from "@/lib/audio/player";
import { LiveCaption } from "@/lib/audio/live-caption";
import { saveDraft, type LiveUsage } from "@/lib/interview-draft";
import { MAX_CODE_CHARS } from "@/lib/schemas";

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
  ticket?: string;
}

const emptyUsage = (): LiveUsage => ({
  turns: 0,
  promptTokens: 0,
  responseTokens: 0,
  promptByModality: {},
  responseByModality: {},
});

function addByModality(into: Record<string, number>, details?: Array<{ modality?: string; tokenCount?: number }>) {
  for (const d of details ?? []) {
    const name = d.modality ?? "UNKNOWN";
    into[name] = (into[name] ?? 0) + (d.tokenCount ?? 0);
  }
}

// Watchdog: if the interviewer goes silent (VAD missed the end of the user's
// turn, or the model produced an empty turn), nudge it back to life. Only
// counts silence on BOTH sides - the candidate talking through a long answer
// is activity, otherwise the nudge interrupts them every ~30s.
const IDLE_MS = 25_000;
const MAX_NUDGES = 3;
// In a DSA or system design round, long quiet stretches are normal (typing,
// thinking), so the interviewer only checks in after two quiet minutes.
const ROUND_IDLE_MS = 120_000;
const IDLE_NOTE =
  "(system note: there has been a long silence. If you asked a question, briefly re-ask it; otherwise continue with the next interview question. Respond in English. Do not mention this note.)";
const ROUND_IDLE_NOTE =
  "(system note: the candidate has been quiet for two minutes - they may be thinking or coding. Check in with one short, friendly question about how it is going. Do not give a hint unless they ask. Respond in English. Do not mention this note.)";

export interface RoundOptions {
  format: "standard" | "dsa" | "system_design";
  // A problem's code and latest test results, read when the interviewer calls
  // get_candidate_code (problem defaults to the one on screen).
  getCode?: (problem?: number) => { problem: number; code: string; testResults?: string };
  // Everything the candidate wrote, as saved with the attempt (crash drafts too).
  getSubmission?: () => string;
  language?: string | null;
  // The interviewer moved to problem n (1-based) - show it on screen.
  onStartProblem?: (n: number) => void;
}

// Live models wait for input before speaking, so a fresh session is kicked
// off with an invisible note - otherwise the candidate sits in silence until
// they say something first.
const KICKOFF_NOTE =
  "(system note: the candidate has joined and is ready. Start the interview now: greet them and ask the first question. Respond in English. Do not mention this note.)";

export function useVoiceSession(interviewId: string, round: RoundOptions = { format: "standard" }) {
  // Read through a ref so the session callbacks never go stale.
  const roundRef = useRef(round);
  useEffect(() => {
    roundRef.current = round;
  });
  // Notes from the app (e.g. "time is up") wait until the interviewer has
  // finished speaking - client content would cut it off mid-sentence.
  const pendingNoteRef = useRef<string | null>(null);
  const [status, setStatusState] = useState<SessionStatus>(SessionStatus.IDLE);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<SavedMessage[]>([]);
  // In-progress transcript of the current turn, streamed fragment by fragment.
  const [caption, setCaption] = useState<SavedMessage | null>(null);

  const sessionRef = useRef<Session | null>(null);
  const recorderRef = useRef<PcmRecorder | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const liveCaptionRef = useRef<LiveCaption | null>(null);
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
  // Proof this session was really started - needed to save its transcript.
  const ticketRef = useRef<string | null>(null);
  // Token usage the Live API reports per turn, summed - to measure real cost.
  const usageRef = useRef<LiveUsage>(emptyUsage());

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
    liveCaptionRef.current?.stop();
    liveCaptionRef.current = null;
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
    if (!res.ok || !data.success || !data.token || !data.model || !data.config || !data.ticket) {
      throw new Error(data.message ?? "Could not start the interview session");
    }
    return data;
  }, [interviewId]);

  const handleMessage = useCallback(
    (message: LiveServerMessage) => {
      const content = message.serverContent;
      // Only real conversation counts as activity. The server also sends
      // housekeeping (sessionResumptionUpdate every few seconds while idle),
      // which would otherwise keep the silence watchdog from ever firing.
      if (content || message.toolCall) lastActivityRef.current = Date.now();

      if (message.usageMetadata) {
        const usage = usageRef.current;
        usage.turns += 1;
        usage.promptTokens += message.usageMetadata.promptTokenCount ?? 0;
        usage.responseTokens += message.usageMetadata.responseTokenCount ?? 0;
        addByModality(usage.promptByModality, message.usageMetadata.promptTokensDetails);
        addByModality(usage.responseByModality, message.usageMetadata.responseTokensDetails);
      }

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
          // Keep streaming to the old session until the new one is up, then
          // close the old one so two sessions never run side by side.
          const previous = sessionRef.current;
          try {
            await connectRef.current?.(handle);
            try {
              previous?.close();
            } catch {
              // already closed
            }
          } catch (e) {
            console.error("proactive reconnect failed", e);
          } finally {
            reconnectingRef.current = false;
          }
        })();
      }

      if (content?.inputTranscription?.text) {
        // Gemini's transcription is the one we keep: it replaces the live
        // browser caption, which then starts fresh for the next answer.
        userBufferRef.current += content.inputTranscription.text;
        setCaption({ role: "user", content: userBufferRef.current });
        liveCaptionRef.current?.reset();
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

      // A tool call splits the interviewer's speech (e.g. greeting, then the
      // problem): end the current bubble so the two parts don't run together.
      if (message.toolCall?.functionCalls?.length) flushBuffer(modelBufferRef, "assistant");

      for (const call of message.toolCall?.functionCalls ?? []) {
        if (call.name === "start_problem") {
          const n = Number((call.args as { number?: unknown } | undefined)?.number);
          if (Number.isInteger(n) && n >= 1) roundRef.current.onStartProblem?.(n);
          sessionRef.current?.sendToolResponse({
            functionResponses: [{ id: call.id, name: call.name, response: { shown: true } }],
          });
        } else if (call.name === "get_candidate_code") {
          const asked = Number((call.args as { problem?: unknown } | undefined)?.problem);
          const current = roundRef.current.getCode?.(Number.isInteger(asked) && asked >= 1 ? asked : undefined);
          const code = (current?.code ?? "").slice(0, MAX_CODE_CHARS);
          sessionRef.current?.sendToolResponse({
            functionResponses: [{
              id: call.id,
              name: call.name,
              response: {
                problem: current?.problem ?? 1,
                language: roundRef.current.language ?? "unknown",
                code: code.trim() ? code : "(the editor is empty - they have not written any code yet)",
                ...(current?.testResults ? { latestTestRun: current.testResults } : {}),
              },
            }],
          });
        }
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

  const handleClose = useCallback(async (closed: Session | null) => {
    // A session replaced during a goAway handover closing is expected - it
    // must not clear the live session or trigger another resume.
    if (closed && closed !== sessionRef.current) return;
    if (reconnectingRef.current) return;
    sessionRef.current = null;
    if (userEndedRef.current || statusRef.current !== SessionStatus.LIVE) return;

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
      // The resume handle and the full session config (system prompt
      // included) are locked into the token server-side.
      const { token, model, config, ticket } = await fetchToken(resumeHandle);
      ticketRef.current = ticket!;

      const { GoogleGenAI } = await loadGenAI();
      const ai = new GoogleGenAI({
        apiKey: token!,
        httpOptions: { apiVersion: "v1alpha" },
      });

      let session: Session | null = null;
      session = await ai.live.connect({
        model: model!,
        config: config!,
        callbacks: {
          onopen: () => {},
          onmessage: handleMessage,
          onerror: (e: ErrorEvent) => {
            console.error("voice session error", e);
          },
          onclose: () => {
            void handleClose(session);
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

  const flushNote = useCallback(() => {
    const note = pendingNoteRef.current;
    if (!note || !sessionRef.current || statusRef.current !== SessionStatus.LIVE) return;
    pendingNoteRef.current = null;
    sessionRef.current.sendClientContent({ turns: [{ role: "user", parts: [{ text: note }] }], turnComplete: true });
  }, []);

  const start = useCallback(async () => {
    if (statusRef.current === SessionStatus.CONNECTING || statusRef.current === SessionStatus.LIVE) return;

    setStatus(SessionStatus.CONNECTING);
    setMessages([]);
    setCaption(null);
    userEndedRef.current = false;
    reconnectAttemptsRef.current = 0;
    resumeHandleRef.current = undefined;
    ticketRef.current = null;
    usageRef.current = emptyUsage();
    userBufferRef.current = "";
    modelBufferRef.current = "";

    try {
      // Created inside the click handler so autoplay policy allows playback.
      const player = new PcmPlayer();
      player.init();
      player.onPlaybackStart = () => {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
        // Anything heard from here is the interviewer's own voice.
        liveCaptionRef.current?.reset();
      };
      player.onPlaybackEnd = () => {
        isSpeakingRef.current = false;
        lastActivityRef.current = Date.now();
        setIsSpeaking(false);
        flushNote();
      };
      playerRef.current = player;

      // Request the mic before minting a token so a denial fails fast.
      const recorder = new PcmRecorder();
      await recorder.start(
        (base64) => {
          sessionRef.current?.sendRealtimeInput({
            audio: { data: base64, mimeType: "audio/pcm;rate=16000" },
          });
        },
        () => {
          lastActivityRef.current = Date.now();
          // No live captions in this browser: at least show that we hear them.
          if (!LiveCaption.supported && !isSpeakingRef.current && !userBufferRef.current) {
            setCaption((current) => (current?.role === "user" ? current : { role: "user", content: "Listening..." }));
          }
        }
      );
      recorderRef.current = recorder;

      // Live word-by-word caption while the candidate talks (display only).
      const liveCaption = new LiveCaption();
      liveCaption.start((text) => {
        if (!text || isSpeakingRef.current || userBufferRef.current) return;
        setCaption({ role: "user", content: text });
      });
      liveCaptionRef.current = liveCaption;

      await connect();
      setStatus(SessionStatus.LIVE);
      // Not on resumes - those continue a conversation already under way.
      sessionRef.current?.sendClientContent({
        turns: [{ role: "user", parts: [{ text: KICKOFF_NOTE }] }],
        turnComplete: true,
      });

      lastActivityRef.current = Date.now();
      nudgeCountRef.current = 0;
      watchdogRef.current = setInterval(() => {
        if (statusRef.current !== SessionStatus.LIVE) return;
        if (isSpeakingRef.current) {
          lastActivityRef.current = Date.now();
          return;
        }
        const isRound = roundRef.current.format !== "standard";
        if (Date.now() - lastActivityRef.current < (isRound ? ROUND_IDLE_MS : IDLE_MS)) return;

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
              text: isRound ? ROUND_IDLE_NOTE : IDLE_NOTE,
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
  }, [connect, teardown, setStatus, finish, flushNote]);

  // Warm the SDK chunk while the candidate reads the page, so Start isn't slower.
  useEffect(() => {
    void loadGenAI();
  }, []);

  // Keep a local copy of the answers as they come in, so a crash or refresh
  // mid-interview can be recovered and scored (lib/interview-draft.ts).
  useEffect(() => {
    if (status !== SessionStatus.LIVE && status !== SessionStatus.ENDED) return;
    if (!ticketRef.current || messages.length === 0) return;
    saveDraft(interviewId, { messages, ticket: ticketRef.current, usage: usageRef.current, code: roundRef.current.getSubmission?.() });
  }, [messages, status, interviewId]);

  // Also called by the round UI when the code changes (debounced there).
  const persistDraft = useCallback(() => {
    if (statusRef.current !== SessionStatus.LIVE || !ticketRef.current) return;
    saveDraft(interviewId, { messages, ticket: ticketRef.current, usage: usageRef.current, code: roundRef.current.getSubmission?.() });
  }, [interviewId, messages]);

  // Typing in the editor is activity: no "are you there?" nudge mid-code.
  const markActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Tell the interviewer something the candidate doesn't say (sent as soon
  // as it isn't speaking). Not part of the transcript.
  const sendNote = useCallback((text: string) => {
    pendingNoteRef.current = text;
    if (!isSpeakingRef.current) flushNote();
  }, [flushNote]);

  const getTicket = useCallback(() => ticketRef.current, []);
  const getUsage = useCallback(() => usageRef.current, []);

  // Clean up if the component unmounts mid-session.
  useEffect(() => {
    return () => {
      userEndedRef.current = true;
      teardown();
    };
  }, [teardown]);

  return { status, isSpeaking, messages, caption, start, end, getTicket, getUsage, persistDraft, markActivity, sendNote };
}
