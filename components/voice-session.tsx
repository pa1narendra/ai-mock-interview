'use client'

import { createReport } from '@/lib/actions/reports';
import { saveTranscript } from '@/lib/actions/transcripts';
import { countUserTurns, LANGUAGE_OPTIONS, MIN_ANSWERS_FOR_ATTEMPT, PROBLEM_MINUTES } from '@/lib/schemas';
import { cn } from '@/lib/utils';
import { SessionStatus, useVoiceSession } from '@/hooks/use-voice-session';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Mic, PhoneOff, Loader2, RotateCcw, Timer } from 'lucide-react';
import Transcript from '@/components/transcript';
import ConfirmDialog from '@/components/confirm-dialog';
import { clearDraft, loadDraft, type InterviewDraft, type LiveUsage } from '@/lib/interview-draft';
import dayjs from 'dayjs';

// The editor (CodeMirror + one language pack) is only downloaded for DSA rounds.
const CodeEditor = dynamic(() => import('@/components/code-editor'), {
  ssr: false,
  loading: () => <div className="min-h-[360px] animate-pulse rounded-xl border border-border bg-surface-raised" />,
});

const statusLabel: Record<SessionStatus, string> = {
  [SessionStatus.IDLE]: 'Ready when you are',
  [SessionStatus.CONNECTING]: 'Connecting',
  [SessionStatus.LIVE]: 'Interview in progress',
  [SessionStatus.ENDED]: 'Interview complete',
};

const STARTER_CODE: Record<string, string> = {
  python: '# Write your solution here\n',
  javascript: '// Write your solution here\n',
  java: 'class Solution {\n    // Write your solution here\n}\n',
  cpp: '#include <bits/stdc++.h>\nusing namespace std;\n\n// Write your solution here\n',
};

const mmss = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

interface VoiceSessionProps {
  userName: string;
  interviewId: string;
  attempt: number;
  maxAttempts: number;
  format?: 'standard' | 'dsa' | 'system_design';
  // Rounds only: the problems are shown on screen as the interviewer presents them.
  problems?: string[];
  difficulty?: string | null;
  language?: string | null;
}

const VoiceSession = ({
  userName,
  interviewId,
  attempt,
  maxAttempts,
  format = 'standard',
  problems = [],
  difficulty,
  language,
}: VoiceSessionProps) => {
  const router = useRouter();
  const isRound = format !== 'standard';
  const coding = format === 'dsa';
  const noun = coding ? 'problem' : 'design prompt';

  // ---- Round state: which problem is on screen, its timer, the code ----
  const [shownUpTo, setShownUpTo] = useState(0); // highest problem presented so far
  const [viewing, setViewing] = useState(0); // the tab the candidate is looking at
  const [problemStartedAt, setProblemStartedAt] = useState<number | null>(null);
  const timeUpSentRef = useRef(new Set<number>());
  const [code, setCode] = useState(() => STARTER_CODE[language ?? ''] ?? '');
  const codeRef = useRef(code);

  const onStartProblem = useCallback((n: number) => {
    const number = Math.min(Math.max(1, n), Math.max(1, problems.length));
    setShownUpTo((prev) => Math.max(prev, number));
    setViewing(number);
    setProblemStartedAt(Date.now());
  }, [problems.length]);

  const round = useMemo(
    () => ({ format, language, getCode: () => codeRef.current, onStartProblem }),
    [format, language, onStartProblem]
  );
  const { status, isSpeaking, messages, caption, start, end, getTicket, getUsage, persistDraft, markActivity, sendNote } =
    useVoiceSession(interviewId, round);

  const [confirming, setConfirming] = useState<'start' | 'end' | null>(null);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [notCounted, setNotCounted] = useState(false);
  const hasGeneratedReport = useRef(false);
  const transcriptIdRef = useRef<string | null>(null);
  // An interview that was cut off (crash, refresh, closed tab) before its
  // answers reached the server - offered for scoring on the next visit.
  const [draft, setDraft] = useState<InterviewDraft | null>(null);
  useEffect(() => {
    const found = loadDraft(interviewId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    if (found && countUserTurns(found.messages) >= MIN_ANSWERS_FOR_ATTEMPT) setDraft(found);
  }, [interviewId]);

  // Save-first pipeline: the transcript is persisted before any AI call, so
  // a model outage can never lose the interview - worst case the report is
  // generated later from the stored transcript.
  const saveAndScore = useCallback(async (answers: SavedMessage[], ticket: string | null, usage?: LiveUsage, finalCode?: string) => {
    // Too short to score (usually an accidental start or end): nothing is
    // saved and no attempt is used - the candidate can simply start again.
    if (countUserTurns(answers) < MIN_ANSWERS_FOR_ATTEMPT) {
      clearDraft(interviewId);
      setNotCounted(true);
      toast.info(`This attempt wasn't counted - interviews need at least ${MIN_ANSWERS_FOR_ATTEMPT} answers to be scored. Start again whenever you're ready.`);
      return;
    }
    setIsSavingReport(true);
    setSaveFailed(false);

    if (!transcriptIdRef.current) {
      const saved = await saveTranscript({ interviewId, transcript: answers, ticket: ticket ?? '', usage, code: finalCode });
      if (!saved.success || !saved.transcriptId) {
        setIsSavingReport(false);
        if ('invalidSession' in saved && saved.invalidSession) {
          // Expired, or this attempt was already saved from another tab.
          clearDraft(interviewId);
          setDraft(null);
          toast.error('This session can no longer be saved. Please start a new attempt.');
          return;
        }
        toast.error('Could not save your answers - check your connection and retry. Do not close this tab.');
        setSaveFailed(true);
        return;
      }
      transcriptIdRef.current = saved.transcriptId;
      clearDraft(interviewId);
      setDraft(null);
    }

    // replace, not push: the finished session shouldn't be a Back target -
    // Back from the report returns to wherever the candidate came from.
    const report = await createReport(transcriptIdRef.current);
    if (report.success && report.reportId) {
      router.replace(`/interviews/${interviewId}/report?attempt=${report.attempt}`);
    } else {
      toast.info('Your answers are saved. The AI service is busy right now - generate your report from the report page in a minute.');
      router.replace(`/interviews/${interviewId}/report`);
    }
  }, [interviewId, router]);

  const finishInterview = useCallback(
    () => saveAndScore(messages, getTicket(), getUsage(), coding ? codeRef.current : undefined),
    [saveAndScore, messages, getTicket, getUsage, coding]
  );
  // Retrying a failed save must resend the same answers - the recovered
  // ones if that's what was being saved.
  const [saving, setSaving] = useState<InterviewDraft | null>(null);
  const scoreDraft = useCallback(() => {
    if (!draft) return;
    setSaving(draft);
    void saveAndScore(draft.messages, draft.ticket, draft.usage, draft.code);
  }, [draft, saveAndScore]);
  const retrySave = useCallback(
    () => (saving ? saveAndScore(saving.messages, saving.ticket, saving.usage, saving.code) : finishInterview()),
    [saving, saveAndScore, finishInterview]
  );

  useEffect(() => {
    if (status !== SessionStatus.ENDED || hasGeneratedReport.current) return;
    hasGeneratedReport.current = true;
    void finishInterview();
  }, [status, finishInterview]);

  const isLive = status === SessionStatus.LIVE;
  // Answers so far, including one still being spoken.
  const answersSoFar = countUserTurns(messages) + (caption?.role === 'user' && caption.content.trim() ? 1 : 0);

  // Answers are only saved when the interview ends, so leaving mid-session
  // (refresh, closed tab) would lose them - ask the browser to confirm.
  useEffect(() => {
    if (!isLive && !isSavingReport) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isLive, isSavingReport]);

  // One clock drives the session and problem timers.
  const [now, setNow] = useState(() => Date.now());
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!isLive) return;
    const startedAt = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- marks the moment the session went live
    setSessionStartedAt(startedAt);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(id);
      setSessionStartedAt(null);
    };
  }, [isLive]);
  const elapsed = isLive && sessionStartedAt ? Math.max(0, Math.floor((now - sessionStartedAt) / 1000)) : 0;

  // If the interviewer starts talking without presenting a problem on screen,
  // show the first one anyway - the candidate must never be left without it.
  const fallbackFirst = isRound && isLive && shownUpTo === 0 && messages.some((m) => m.role === 'assistant');
  const shown = shownUpTo > 0 ? shownUpTo : fallbackFirst ? 1 : 0;
  const view = viewing > 0 ? viewing : shown;

  // Per-problem budget. When it runs out, the interviewer is told (once) to
  // wrap the problem up, the way a real interviewer watches the clock.
  const budgetMinutes = PROBLEM_MINUTES[coding ? (difficulty ?? 'medium') : 'system_design'] ?? 25;
  const problemStart = problemStartedAt ?? (shown > 0 ? sessionStartedAt : null);
  const problemElapsed = isLive && problemStart ? Math.max(0, Math.floor((now - problemStart) / 1000)) : 0;
  const overTime = problemElapsed > budgetMinutes * 60;
  useEffect(() => {
    if (!isRound || !isLive || !overTime || shown === 0 || timeUpSentRef.current.has(shown)) return;
    timeUpSentRef.current.add(shown);
    const last = shown >= problems.length;
    sendNote(
      `(system note: the suggested ${budgetMinutes} minutes for ${noun} ${shown} are up. Wrap it up in a sentence or two, then ${last ? 'conclude the interview' : `present ${noun} ${shown + 1}`}. Do not mention this note.)`
    );
  }, [isRound, isLive, overTime, shown, problems.length, budgetMinutes, noun, sendNote]);

  // Code edits count as activity and are kept in the crash-recovery draft.
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCode = useCallback((value: string) => {
    codeRef.current = value;
    setCode(value);
    markActivity();
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(persistDraft, 2000);
  }, [markActivity, persistDraft]);
  useEffect(() => () => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
  }, []);

  const resetRound = () => {
    setShownUpTo(0);
    setViewing(0);
    setProblemStartedAt(null);
    timeUpSentRef.current = new Set();
  };

  const statusDot = (
    <span
      className={cn(
        'size-2 rounded-full',
        isLive ? 'bg-spark-400 animate-pulse' : status === SessionStatus.CONNECTING ? 'bg-ember-400 animate-pulse' : 'bg-mist-500'
      )}
    />
  );
  const statusText = status === SessionStatus.ENDED && notCounted ? 'Ended early - not scored' : statusLabel[status];

  const controlButton = saveFailed ? (
    <button className="btn-spark min-w-44" onClick={() => void retrySave()} disabled={isSavingReport}>
      <RotateCcw className="size-4" /> Retry saving your answers
    </button>
  ) : !isLive ? (
    <button
      className="btn-highlight min-w-44"
      onClick={() => setConfirming('start')}
      disabled={status === SessionStatus.CONNECTING || isSavingReport}
    >
      {isSavingReport ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Preparing your report
        </>
      ) : status === SessionStatus.CONNECTING ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Connecting
        </>
      ) : (
        <>
          <Mic className="size-4" /> Start interview
        </>
      )}
    </button>
  ) : (
    <button className="btn-danger min-w-44" onClick={() => setConfirming('end')}>
      <PhoneOff className="size-4" /> End interview
    </button>
  );

  const draftBanner = draft && status === SessionStatus.IDLE && !isSavingReport && !saveFailed && (
    <div className="panel w-full max-w-xl space-y-3 self-center p-5 text-center">
      <p className="font-semibold text-foreground">You have an unsaved interview</p>
      <p className="text-sm text-muted-foreground">
        {`Your session from ${dayjs(draft.savedAt).format('h:mm A')} ended before it was saved, with ${countUserTurns(draft.messages)} answers. `}
        Score it now, or start a fresh attempt instead (that discards it).
      </p>
      <div className="flex justify-center gap-3 max-sm:flex-col">
        <button className="btn-spark" onClick={scoreDraft}>
          Score my answers
        </button>
        <button
          className="btn-outline"
          onClick={() => {
            clearDraft(interviewId);
            setDraft(null);
          }}
        >
          Discard
        </button>
      </div>
    </div>
  );

  const dialogs = (
    <>
      <ConfirmDialog
        open={confirming === 'start'}
        icon={<Mic className="size-4" />}
        title="Start the interview?"
        description={
          isRound ? (
            <>
              The interviewer starts speaking as soon as you&apos;re connected and shows each {noun} on screen as they
              present it.{coding ? ' Write your code in the editor and talk through your thinking out loud.' : ''} It
              counts as attempt {attempt} of {maxAttempts} once you&apos;ve given {MIN_ANSWERS_FOR_ATTEMPT} answers.
            </>
          ) : (
            <>
              The interviewer starts speaking as soon as you&apos;re connected, so find a quiet spot and have your mic
              ready. It counts as attempt {attempt} of {maxAttempts} once you&apos;ve given {MIN_ANSWERS_FOR_ATTEMPT} answers.
            </>
          )
        }
        confirmLabel="Start interview"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          setConfirming(null);
          setNotCounted(false);
          hasGeneratedReport.current = false;
          transcriptIdRef.current = null;
          setSaving(null);
          setDraft(null);
          resetRound();
          void start();
        }}
      />
      <ConfirmDialog
        open={confirming === 'end' && isLive}
        tone="danger"
        icon={<PhoneOff className="size-4" />}
        title="End the interview now?"
        description={
          answersSoFar < MIN_ANSWERS_FOR_ATTEMPT ? (
            <>
              {`You've given ${answersSoFar} answer${answersSoFar === 1 ? '' : 's'} so far. Interviews with fewer than ` +
                `${MIN_ANSWERS_FOR_ATTEMPT} answers aren't scored, so ending now won't use an attempt - but this ` +
                `session can't be picked back up.`}
            </>
          ) : (
            <>
              Your answers so far{coding ? ' and your code' : ''} will be scored as attempt {attempt} of {maxAttempts}.
              You can&apos;t pick this session back up once it ends.
            </>
          )
        }
        confirmLabel="End interview"
        cancelLabel="Keep going"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          setConfirming(null);
          end();
        }}
      />
    </>
  );

  // ---------------- DSA / system design layout ----------------
  if (isRound) {
    const languageLabel = LANGUAGE_OPTIONS.find((o) => o.value === language)?.label ?? language ?? '';
    const current = view > 0 ? problems[view - 1] : null;
    return (
      <section className="flex flex-col gap-6 py-6 fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="status-pill">
              {statusDot}
              {statusText}
              {isLive && <span className="ml-1 tabular-nums text-mist-500">{mmss(elapsed)}</span>}
            </div>
            {isLive && isSpeaking && <span className="status-pill text-spark-300">Interviewer speaking</span>}
          </div>
          {controlButton}
        </div>

        {draftBanner}

        <div className={cn('grid gap-5', coding && 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]')}>
          <div className="panel flex min-h-48 flex-col gap-4 px-6 py-5 max-sm:px-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={`${noun}s`}>
                {problems.map((_, i) => {
                  const n = i + 1;
                  const unlocked = n <= shown;
                  return (
                    <button
                      key={n}
                      type="button"
                      role="tab"
                      aria-selected={view === n}
                      disabled={!unlocked}
                      onClick={() => setViewing(n)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors',
                        view === n
                          ? 'border-highlight/50 bg-highlight-soft text-foreground'
                          : 'border-border text-muted-foreground hover:text-foreground',
                        !unlocked && 'cursor-not-allowed opacity-40 hover:text-muted-foreground'
                      )}
                    >
                      {noun} {n}
                    </button>
                  );
                })}
              </div>
              {isLive && shown > 0 && (
                <span
                  className={cn('inline-flex items-center gap-1.5 text-xs tabular-nums', overTime ? 'font-semibold text-warning' : 'text-muted-foreground')}
                  title={`Suggested time for this ${noun}: ${budgetMinutes} minutes`}
                >
                  <Timer className="size-3.5" />
                  {mmss(problemElapsed)} / {budgetMinutes}:00
                </span>
              )}
            </div>
            {current ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{current}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isLive
                  ? `The interviewer will show ${noun} 1 here when they present it.`
                  : `${problems.length} ${noun}${problems.length === 1 ? '' : 's'}. Each one appears here when the interviewer presents it.`}
              </p>
            )}
          </div>

          {coding && (
            <div className="flex min-w-0 flex-col gap-2">
              <span className="field-label">Your code · {languageLabel}</span>
              <CodeEditor language={language ?? 'python'} value={code} onChange={handleCode} />
              <p className="text-xs text-muted-foreground">
                The interviewer reads your code when they review it. Keep talking through your thinking - it&apos;s
                scored too. Code isn&apos;t run; it&apos;s reviewed.
              </p>
            </div>
          )}
        </div>

        <Transcript messages={messages} caption={caption} />
        {dialogs}
      </section>
    );
  }

  // ---------------- Standard layout ----------------
  return (
    <section className="flex flex-col items-center gap-10 py-8 fade-up">
      <div className="status-pill">
        {statusDot}
        {statusText}
        {isLive && <span className="ml-1 tabular-nums text-mist-500">{mmss(elapsed)}</span>}
      </div>

      <div className="py-6">
        <div className="relative">
          {isLive && isSpeaking && (
            <>
              <span className="orb-ring" />
              <span className="orb-ring orb-ring-delayed" />
            </>
          )}
          <div
            className={cn(
              'orb',
              status === SessionStatus.IDLE && 'orb-idle',
              status === SessionStatus.CONNECTING && 'orb-connecting',
              isLive && 'orb-live',
              isLive && isSpeaking && 'orb-speaking'
            )}
          >
            <Mic className={cn('size-10 text-ink-950/70', !isLive && 'opacity-60')} strokeWidth={2.2} />
          </div>
        </div>
      </div>

      <div className="text-center space-y-1">
        <p className="text-sm uppercase tracking-widest text-mist-500">Candidate</p>
        <h3>{userName}</h3>
      </div>

      <Transcript messages={messages} caption={caption} />

      {draftBanner}

      {controlButton}
      {dialogs}
    </section>
  );
};

export default VoiceSession;
