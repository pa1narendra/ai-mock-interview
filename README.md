# Mockstar

**Rehearse interviews out loud. Get scored.**

Mockstar is a voice-first mock interview platform: describe the role you're targeting, get a tailored question set, then talk it through in a real-time voice conversation with an AI interviewer. When you hang up, you get a structured report — an overall score, five category breakdowns, strengths, and what to improve next.

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript + Tailwind CSS 4
- **Neon Postgres** + **Drizzle ORM** (typed SQL, generated migrations)
- **Better Auth** — email/password sessions stored in your own Postgres
- **Google Gemini** — `gemini-2.5-flash` for question generation and report scoring (Vercel AI SDK), `gemini-3.1-flash-live-preview` for the real-time voice session
- Deployed on **Vercel**

> Two Google AI packages are intentional, not accidental: `@ai-sdk/google` (via the Vercel AI SDK) handles structured text/JSON generation, while `@google/genai` is Google's own SDK used only for the Live API WebSocket voice session, which the AI SDK doesn't cover.

## Architecture

```
app/
  (auth)/sign-in, sign-up          # Better Auth email/password flows
  (root)/                          # dashboard
  (root)/interviews/new            # interview setup form
  (root)/interviews/[id]           # live voice session
  (root)/interviews/[id]/report    # scored report
  api/auth/[...all]                # Better Auth handler
  api/interviews/generate          # question generation (auth + zod + rate limit)
  api/voice/token                  # mints ephemeral Gemini Live tokens
db/schema.ts                       # Drizzle schema (auth + interviews + reports)
drizzle/                           # generated SQL migrations
components/                        # UI (voice orb session, cards, forms)
hooks/use-voice-session.ts         # Gemini Live session state machine
lib/audio/                         # 16kHz PCM mic capture + 24kHz playback
lib/ai/prompts.ts                  # interviewer system prompt + live model config
lib/actions/                       # server actions: auth/session, interviews, reports
```

**Voice flow:** the browser never sees the Gemini API key. `/api/voice/token` authenticates the session, builds the interviewer prompt server-side, and mints a single-use ephemeral token (30 min, model-locked). The client connects to the Gemini Live WebSocket with that token, streams mic audio up, plays the interviewer's audio back, captures both transcripts, and survives connection drops via session resumption. A client-side tool call (`end_interview`) lets the interviewer hang up gracefully after saying goodbye.

## Local setup

1. `npm install`
2. Create a free Postgres database at [neon.tech](https://neon.tech) (no card required) and copy the **pooled connection string**.
3. Copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL` — the Neon connection string
   - `BETTER_AUTH_SECRET` — generate one with `npx @better-auth/cli secret`
   - `BETTER_AUTH_URL` — `http://localhost:3000` in dev
   - `GOOGLE_GENERATIVE_AI_API_KEY` — from <https://aistudio.google.com/apikey>
4. Push the schema to your database:
   ```bash
   npm run db:push
   ```
5. `npm run dev` and open <http://localhost:3000>. Use Chrome/Edge/Safari for voice sessions (microphone + Web Audio required).

### Database scripts

| Command | Description |
| --- | --- |
| `npm run db:push` | Sync the schema in `db/schema.ts` straight to the database (dev) |
| `npm run db:generate` | Generate versioned SQL migrations into `drizzle/` |
| `npm run db:studio` | Browse your data in Drizzle Studio |

## Deploying to Vercel

- Add `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (your production URL), and `GOOGLE_GENERATIVE_AI_API_KEY` in Vercel → Project → Settings → Environment Variables.
- All four are **server-only** — never add them with a `NEXT_PUBLIC_` prefix.
- Run `npm run db:push` (or apply the generated migrations) against the production database once.

## Costs

- **Neon free tier** comfortably covers this app's data (interviews and reports are tiny rows).
- **Better Auth / Drizzle** are open-source libraries — no service fees.
- The **Gemini API free tier** covers question generation and report scoring at modest usage.
- The **Gemini Live API** (voice) has a free tier with unpublished, region-dependent quotas and a preview-status model. If the model name rotates or quota is exhausted, set `GEMINI_LIVE_MODEL` to a current Live model.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build (TypeScript enforced) |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |


Old URL is ai-mock-interview-one-cyan.vercel.app
