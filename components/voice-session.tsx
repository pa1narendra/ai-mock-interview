'use client'

import { createReport } from '@/lib/actions/reports';
import { saveTranscript } from '@/lib/actions/transcripts';
import { countUserTurns, MIN_ANSWERS_FOR_ATTEMPT } from '@/lib/schemas';
import { cn } from '@/lib/utils';
import { SessionStatus, useVoiceSession } from '@/hooks/use-voice-session';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Mic, PhoneOff, Loader2, RotateCcw } from 'lucide-react';
import Transcript from '@/components/transcript';
import ConfirmDialog from '@/components/confirm-dialog';

const statusLabel: Record<SessionStatus, string> = {
  [SessionStatus.IDLE]: 'Ready when you are',
  [SessionStatus.CONNECTING]: 'Connecting',
  [SessionStatus.LIVE]: 'Interview in progress',
  [SessionStatus.ENDED]: 'Interview complete',
};

interface VoiceSessionProps {
  userName: string;
  interviewId: string;
  attempt: number;
  maxAttempts: number;
}

const VoiceSession = ({ userName, interviewId, attempt, maxAttempts }: VoiceSessionProps) => {
  const router = useRouter();
  const { status, isSpeaking, messages, caption, start, end } = useVoiceSession(interviewId);
  const [confirming, setConfirming] = useState<'start' | 'end' | null>(null);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [notCounted, setNotCounted] = useState(false);
  const hasGeneratedReport = useRef(false);
  const transcriptIdRef = useRef<string | null>(null);

  // Save-first pipeline: the transcript is persisted before any AI call, so
  // a model outage can never lose the interview - worst case the report is
  // generated later from the stored transcript.
  const finishInterview = useCallback(async () => {
    // Too short to score (usually an accidental start or end): nothing is
    // saved and no attempt is used - the candidate can simply start again.
    if (countUserTurns(messages) < MIN_ANSWERS_FOR_ATTEMPT) {
      setNotCounted(true);
      toast.info(`This attempt wasn't counted - interviews need at least ${MIN_ANSWERS_FOR_ATTEMPT} answers to be scored. Start again whenever you're ready.`);
      return;
    }
    setIsSavingReport(true);
    setSaveFailed(false);

    if (!transcriptIdRef.current) {
      const saved = await saveTranscript({ interviewId, transcript: messages });
      if (!saved.success || !saved.transcriptId) {
        toast.error('Could not save your answers - check your connection and retry. Do not close this tab.');
        setIsSavingReport(false);
        setSaveFailed(true);
        return;
      }
      transcriptIdRef.current = saved.transcriptId;
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
  }, [messages, interviewId, router]);

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

  // Elapsed-time counter while live. Sessions can run long: context window
  // compression lifts the Live API's length cap, and resumption covers the
  // ~10 min connection resets.
  // Derived from a start timestamp so the effect never sets state synchronously.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isLive) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => {
      clearInterval(id);
      setElapsed(0);
    };
  }, [isLive]);
  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  return (
    <section className="flex flex-col items-center gap-10 py-8 fade-up">
      <div className="status-pill">
        <span
          className={cn(
            'size-2 rounded-full',
            isLive ? 'bg-spark-400 animate-pulse' : status === SessionStatus.CONNECTING ? 'bg-ember-400 animate-pulse' : 'bg-mist-500'
          )}
        />
        {status === SessionStatus.ENDED && notCounted ? 'Ended early - not scored' : statusLabel[status]}
        {isLive && <span className="ml-1 tabular-nums text-mist-500">{mmss}</span>}
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

      {saveFailed ? (
        <button className="btn-spark min-w-44" onClick={() => void finishInterview()} disabled={isSavingReport}>
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
      )}

      <ConfirmDialog
        open={confirming === 'start'}
        icon={<Mic className="size-4" />}
        title="Start the interview?"
        description={
          <>
            The interviewer starts speaking as soon as you&apos;re connected, so find a quiet spot and have your mic
            ready. It counts as attempt {attempt} of {maxAttempts} once you&apos;ve given {MIN_ANSWERS_FOR_ATTEMPT} answers.
          </>
        }
        confirmLabel="Start interview"
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          setConfirming(null);
          setNotCounted(false);
          hasGeneratedReport.current = false;
          transcriptIdRef.current = null;
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
              Your answers so far will be scored as attempt {attempt} of {maxAttempts}. You can&apos;t pick this
              session back up once it ends.
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
    </section>
  );
};

export default VoiceSession;
