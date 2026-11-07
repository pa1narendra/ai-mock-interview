// Model names, kept free of server-only imports so the scoring eval
// (evals/scoring) runs the same model as the app.
//
// gemini-2.5-flash is deprecated: from 2026-12-01 Google silently routes it
// to gemini-3.5-flash-lite, at the same price. Using that model by name means
// the scorer is calibrated on the model that actually runs.
export const PRIMARY_MODEL = "gemini-3.5-flash-lite";
export const FALLBACK_MODEL = "gemini-3.1-flash-lite";
