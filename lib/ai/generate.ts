import "server-only";

import { generateObject, type ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";
import type { z } from "zod";

const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-flash-lite";
// Open-model safety net (Groq free tier, Llama). Only used when a
// GROQ_API_KEY is configured, and never for requests carrying file parts
// (PDF understanding is Gemini-only in our pipeline).
const OPEN_FALLBACK_MODEL = "llama-3.3-70b-versatile";

interface GenerateArgs<SCHEMA extends z.ZodType> {
  schema: SCHEMA;
  prompt?: string;
  system?: string;
  messages?: ModelMessage[];
}

function hasFileParts(messages?: ModelMessage[]): boolean {
  return Boolean(
    messages?.some(
      (message) =>
        Array.isArray(message.content) &&
        message.content.some((part) => part.type === "file")
    )
  );
}

// The AI SDK already retries transient errors with backoff (maxRetries), but
// when a model is hard-down with 503 "high demand" every retry hits the same
// wall - so after exhausting retries on the primary model, walk down a chain
// of fallbacks that rarely share the same congestion.
export async function resilientGenerateObject<SCHEMA extends z.ZodType>(
  args: GenerateArgs<SCHEMA>
): Promise<{ object: z.infer<SCHEMA> }> {
  const attempts: Array<{ label: string; run: () => Promise<{ object: unknown }> }> = [
    {
      label: PRIMARY_MODEL,
      run: () =>
        generateObject({
          model: google(PRIMARY_MODEL),
          maxRetries: 4,
          ...args,
        } as Parameters<typeof generateObject>[0]),
    },
    {
      label: FALLBACK_MODEL,
      run: () =>
        generateObject({
          model: google(FALLBACK_MODEL),
          maxRetries: 2,
          ...args,
        } as Parameters<typeof generateObject>[0]),
    },
  ];

  if (process.env.GROQ_API_KEY && !hasFileParts(args.messages)) {
    attempts.push({
      label: `groq/${OPEN_FALLBACK_MODEL}`,
      run: () =>
        generateObject({
          model: groq(OPEN_FALLBACK_MODEL),
          maxRetries: 2,
          ...args,
        } as Parameters<typeof generateObject>[0]),
    });
  }

  let lastError: unknown;
  for (const [index, attempt] of attempts.entries()) {
    try {
      const { object } = await attempt.run();
      return { object: object as z.infer<SCHEMA> };
    } catch (error) {
      lastError = error;
      const next = attempts[index + 1];
      if (next) {
        console.warn(
          `${attempt.label} failed after retries, falling back to ${next.label}`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }
  throw lastError;
}
