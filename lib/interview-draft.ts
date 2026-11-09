// Browser-side copy of an interview in progress. Answers are only saved to
// the server when the interview ends, so without this a crashed tab, a
// refresh or a dead battery would lose the whole session. The draft keeps
// the session ticket too, so the recovered transcript can still be saved
// (lib/session-ticket.ts) - and it expires with the ticket.
//
// Storage can be missing or throw (private mode, blocked site data), so
// every access is guarded and the app works without it.

export interface LiveUsage {
  turns: number;
  promptTokens: number;
  responseTokens: number;
  // Summed per modality across turns, e.g. { TEXT: 1200, AUDIO: 9000 }.
  promptByModality: Record<string, number>;
  responseByModality: Record<string, number>;
}

export interface InterviewDraft {
  messages: SavedMessage[];
  ticket: string;
  usage?: LiveUsage;
  // The editor contents in a DSA round.
  code?: string;
  savedAt: number;
}

const DRAFT_TTL_MS = 6 * 60 * 60 * 1000; // matches TICKET_TTL_MS
const key = (interviewId: string) => `mockstar:interview-draft:${interviewId}`;

export function saveDraft(interviewId: string, draft: Omit<InterviewDraft, "savedAt">): void {
  try {
    localStorage.setItem(key(interviewId), JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // storage full or unavailable - the live session still works
  }
}

export function loadDraft(interviewId: string): InterviewDraft | null {
  try {
    const raw = localStorage.getItem(key(interviewId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as InterviewDraft;
    if (!Array.isArray(draft.messages) || typeof draft.ticket !== "string" || Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(key(interviewId));
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft(interviewId: string): void {
  try {
    localStorage.removeItem(key(interviewId));
  } catch {
    // nothing to clear
  }
}
