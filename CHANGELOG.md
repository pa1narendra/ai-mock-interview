# Changelog

All notable changes to Mockstar are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/) (pre-1.0: minor = features, patch = fixes).

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
