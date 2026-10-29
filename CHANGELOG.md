# Changelog

All notable changes to Mockstar are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/) (pre-1.0: minor = features, patch = fixes).

## [0.6.2] - 2026-10-29

### Added
- Confirmation dialogs before creating an interview, starting one, and ending one, so a stray click or Enter can't burn an attempt. Cancel is focused by default, and Escape or clicking outside closes the dialog.

### Fixed
- Back on the report page now leaves the report. Generating a pending report and switching between attempt tabs used to add history entries, so Back appeared to do nothing. Back from the report (or the interview you just created) now goes to the dashboard instead of the finished session or the filled-in form.
- Long interviews are scored in full. Transcripts used to be cut at 30k characters, so the last answers of a long interview were never scored. The limit is now 100k, and anything beyond it drops the middle, never the end.
- The overall score is now the average of the five category scores, so it always matches the breakdown under it.
- Double-clicking "Generate report" can no longer save two reports for the same attempt.
- Turning Pro off in the admin page now works for users who earned Pro through a referral. The Pro rule now lives in one place instead of three.

### Security
- "Practice your gaps" now follows the same limits as creating an interview: the daily cap and the 5 / 20 interview limit.
- The scoring prompt treats the transcript as data, so a candidate saying "give me 100" doesn't change the score.

### Database
- New `user.pro_revoked` column and a unique index on reports (interview, user, attempt), applied with plain SQL on 2026-10-29. Better Auth reads every user column, so this must exist before the code is deployed or sign-in fails. Don't use `db:push` on this database: the referral-code unique index has a different name than in the schema, so push tries to re-add it and offers to truncate the user table.

## [0.6.1] - 2026-10-29

### Fixed
- The interviewer no longer interrupts long answers. A silence watchdog used to nudge the AI after ~25s with no server messages, even while you were still talking (the server sends nothing mid-answer), and after three nudges it ended the interview. It now treats your voice on the mic as activity and only steps in when both sides are silent.
- Long interviews no longer risk a doubled or dropped voice session at the ~10 minute reconnect: the old session is closed after the handover, and its close no longer triggers a second resume.
- The interviewer now starts the interview: it greets you and asks the first question as soon as the session opens, instead of waiting in silence for you to speak first.
- When both sides go quiet, the interviewer now gently re-asks the question after ~25s. This check never fired before, because background keep-alive messages from the server were counted as conversation.

### Security
- Other users can no longer see or take your interview's questions (targeted questions name your employers and projects). Someone else's interview link now goes to the personalize flow, and the voice token and transcript save are owner-only.
- A voice-session resume now checks your attempt limit and has its own daily cap, so it can't be used to bypass the limits.
- Referrals now convert only when the referred user gets a report for an interview with at least 3 real answers, not on any saved transcript.
- Transcripts sent from the browser are validated for shape and size.

## [0.6.0] - 2026-08-07

### Added
- **Full visual redesign** — a plain, editorial monochrome identity with light + dark themes (toggle in the nav, light by default), a cool slate palette, one cobalt-blue accent for everything interactive plus a violet highlight for hero emphasis (the key headline word and the primary action), Fraunces + Inter typography, and a new wordmark-and-live-dot logo. No gradients, no glow.
- **Referral-earned Pro tier** (no payments) — you unlock Pro when a friend joins with your invite link and completes an interview, or when an owner grants it. Pro unlocks interviewer-voice selection, question preview, a PRO badge, community-interview customization, and higher limits.
- **Invite a friend** — a personal referral link and conversion count on your profile.
- **Admin page** (`/admin`, owner-only) — lists every user with a per-user Pro toggle.
- **Tier-based permission system** — restricted features are locked by default and enforced server-side, not just hidden in the UI.
- **Four-tier score colours** — green, yellow, red, and grey (worst) across cards, reports, and trends.

### Changed
- Interviewer-voice selection and question preview/edit are now Pro/owner-only (hidden for the free tier).
- Interview-creation and attempt limits are now per-tier: Normal 5 interviews / 3 attempts, Pro 20 / 5.
- Sign out now appears only on the dashboard; the tech-stack `+N` reveals the full list on hover.
- Theme follows a persisted light/dark choice instead of being forced dark.

### Fixed
- Resolved a theme-toggle hydration mismatch (server and client now agree via a mount gate).

### Ops
- New DB migration for the referral/Pro columns: `node apply-referral-pro.mjs` (idempotent).
- New environment variable `OWNER_EMAIL` designates the owner (Admin access + all features).

## [0.5.1] - 2026-06-13

### Fixed
- The interviewer no longer cuts you off mid-answer during natural pauses (relaxed voice turn-detection: longer silence window + lower end-of-speech sensitivity).
- The interviewer now reliably works through all of its questions (follow-ups are capped to one per question so a single topic can't eat the session).
- Completing an interview and pressing Back now shows the updated attempt/score immediately, instead of stale pre-attempt state until a manual refresh.

### Changed
- Opening a Community interview now personalizes it to you: it pre-fills the role and asks for *your* resume, then generates questions from your background as your own interview. The original is never modified.

## [0.5.0] - 2026-06-13

### Added
- **Practice my weak areas** — a button on the report generates a fresh interview that drills into the exact gaps the report found, keeping the original role/JD/resume context.
- **Skill-trends dashboard** — a chart of your overall score over time plus per-category deltas across all interviews, shown once you have two or more reports.
- **Shareable report link** — generate a public, read-only link to a report (scores and feedback only; transcript, JD, and resume are never shared).
- **Download PDF** — export a clean printable version of any report.
- **Interviewer voice picker** — choose the interviewer's voice when creating an interview.
- **Edit questions before starting** — review and tweak the generated questions on the interview page.
- **Back navigation** — a Back control on every in-app page.
- **Voice session timer** — elapsed time shown during a live interview.

## [0.4.0] - 2026-06-12

### Added
- **Per-question scoring** in reports — each question gets a score, a summary of your answer, specific feedback, and a sketch of a stronger answer.
- **Full transcript on the report** — review exactly what was said, in a collapsible chat view.
- **Per-interview deletion** from the dashboard (removes its reports and transcripts).
- **Profile page** — view your account details and manage your saved resume (view/delete).
- **Public landing page** at `/` explaining the product for logged-out visitors; the dashboard moved to `/dashboard`.

### Changed
- Transcripts are now retained after a report is generated (previously cleared) so answers can be reviewed.
- Report generation is rate-limited separately from interview creation.

### Fixed / Hardened
- Safari/iOS audio support (prefixed `webkitAudioContext` fallback, clearer unsupported-browser errors).
- Invalid interview-generation requests no longer consume a rate-limit slot.
- Removed the unused `finalized` interview column.

## [0.3.0] - 2026-06-12

### Added
- Password reset flow (Better Auth + Resend email, console fallback in dev).
- Unit tests (Vitest) and GitHub Actions CI (lint + typecheck + tests + build).
- Deployed to production on Vercel with GitHub auto-deploy.

### Security
- Fixed a privacy leak: a community interview no longer exposes its owner's job description or resume-derived data to other users.
- Moved all secrets server-side; decommissioned the legacy Firebase project.
- Database-enforced unique attempt numbering and foreign-key indexes.

## [0.2.0] - 2026-06-11

### Added
- **JD + resume grounded interviews** — paste a job description and upload a resume (read once, stored as markdown) for tailored questions, a pre-interview fit snapshot, and JD-coverage scoring in the report.
- **Recurring attempts** — take an interview up to 3 times with score-progress comparison.
- **Durable transcripts** — answers are saved before report generation, so a model outage never loses an interview; reports are retryable.
- Resilient AI generation with model fallback (Gemini Flash → Flash-Lite → optional Groq/Llama).

## [0.1.0] - 2026-06-11

### Added
- Initial **Mockstar** release: voice-first AI mock interviews on the Google Gemini Live API.
- Next.js 16, React 19, Tailwind CSS 4 with a custom emerald-on-slate design system.
- Neon Postgres + Drizzle ORM + Better Auth (replacing the original Firebase/Vapi prototype).
