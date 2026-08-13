import { GoogleGenAI, Modality, EndSensitivity, type LiveConnectConfig } from "@google/genai";
import { getCurrentUser } from "@/lib/actions/auth";
import { getInterview } from "@/lib/actions/interviews";
import { getAttemptsUsed } from "@/lib/actions/transcripts";
import { checkRateLimit } from "@/lib/rateLimit";
import { getPermissions } from "@/lib/permissions";
import { buildInterviewerPrompt, LIVE_MODEL, LIVE_VOICE } from "@/lib/ai/prompts";
import { z } from "zod";

const requestSchema = z.object({
  interviewId: z.string().min(1).max(128),
  resumeHandle: z.string().max(512).optional(),
});

// Per-user daily voice-session cap (Live API is the main cost driver).
const DAILY_VOICE_SESSIONS = 10;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ success: false, message: "Invalid input" }, { status: 400 });
  }

  const interview = await getInterview(parsed.data.interviewId);
  if (!interview) {
    return Response.json({ success: false, message: "Interview not found" }, { status: 404 });
  }

  // Resuming an in-progress session (resumeHandle) is not a new attempt.
  if (!parsed.data.resumeHandle) {
    const maxAttempts = getPermissions(user).maxAttempts;
    const attemptsUsed = await getAttemptsUsed(interview.id);
    if (attemptsUsed >= maxAttempts) {
      return Response.json(
        { success: false, message: `You've used all ${maxAttempts} attempts for this interview.` },
        { status: 403 }
      );
    }

    // Daily cap on voice sessions - the Live API is the expensive path, so
    // bound per-user cost even across many interviews.
    const voiceLimit = await checkRateLimit(user.id, "voice_day", DAILY_VOICE_SESSIONS, "1 day");
    if (!voiceLimit.ok) {
      return Response.json(
        { success: false, message: `You've reached today's limit of ${DAILY_VOICE_SESSIONS} interviews. Come back tomorrow.` },
        { status: 429 }
      );
    }
  }

  // IMPORTANT: the full session config must be baked into the token's
  // liveConnectConstraints - config supplied only by the browser client is
  // ignored on tokened connections (observed: no system prompt, no
  // transcription, and 1011 closes on some models).
  const config: LiveConnectConfig = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: buildInterviewerPrompt(interview, user.name),
    speechConfig: {
      voiceConfig: { prebuiltVoiceConfig: { voiceName: interview.voice ?? LIVE_VOICE } },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    // Turn-taking: wait for a real pause (~1.5s of silence) and use low
    // end-of-speech sensitivity so natural pauses mid-answer don't get
    // mistaken for the candidate finishing their turn.
    realtimeInputConfig: {
      automaticActivityDetection: {
        silenceDurationMs: 1500,
        prefixPaddingMs: 300,
        endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
      },
    },
    contextWindowCompression: { slidingWindow: {} },
    sessionResumption: parsed.data.resumeHandle
      ? { handle: parsed.data.resumeHandle }
      : {},
    tools: [
      {
        functionDeclarations: [
          {
            name: "end_interview",
            description:
              "Call this once you have thanked the candidate and said goodbye, to end the interview session.",
          },
        ],
      },
    ],
  };

  try {
    const client = new GoogleGenAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    });

    const token = await client.authTokens.create({
      config: {
        uses: 1, // session resumption does not count as a use; reconnects mint a fresh token
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config,
        },
        httpOptions: { apiVersion: "v1alpha" },
      },
    });

    // The client echoes this exact config into ai.live.connect().
    return Response.json({
      success: true,
      token: token.name,
      model: LIVE_MODEL,
      config,
    });
  } catch (error) {
    console.error("failed to mint voice session token", error);
    return Response.json(
      { success: false, message: "Could not start the interview session" },
      { status: 500 }
    );
  }
}
