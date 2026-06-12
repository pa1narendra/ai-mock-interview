import { GoogleGenAI, Modality, type LiveConnectConfig } from "@google/genai";
import { getCurrentUser } from "@/lib/actions/auth";
import { getInterview } from "@/lib/actions/interviews";
import { getAttemptsUsed } from "@/lib/actions/transcripts";
import { buildInterviewerPrompt, LIVE_MODEL, LIVE_VOICE } from "@/lib/ai/prompts";
import { MAX_INTERVIEW_ATTEMPTS } from "@/lib/schemas";
import { z } from "zod";

const requestSchema = z.object({
  interviewId: z.string().min(1).max(128),
  resumeHandle: z.string().max(512).optional(),
});

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
    const attemptsUsed = await getAttemptsUsed(interview.id);
    if (attemptsUsed >= MAX_INTERVIEW_ATTEMPTS) {
      return Response.json(
        { success: false, message: `You've used all ${MAX_INTERVIEW_ATTEMPTS} attempts for this interview.` },
        { status: 403 }
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
      voiceConfig: { prebuiltVoiceConfig: { voiceName: LIVE_VOICE } },
    },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    // Tighten turn-taking: respond ~0.5s after the candidate stops
    // speaking instead of the ~0.8s default.
    realtimeInputConfig: {
      automaticActivityDetection: {
        silenceDurationMs: 500,
        prefixPaddingMs: 100,
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
