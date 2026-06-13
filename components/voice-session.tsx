'use client'

import { createReport } from '@/lib/actions/reports';
import { saveTranscript } from '@/lib/actions/transcripts';
import { cn } from '@/lib/utils';
import { SessionStatus, useVoiceSession } from '@/hooks/use-voice-session';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Mic, PhoneOff, Loader2, RotateCcw } from 'lucide-react';
import Transcript from '@/components/transcript';

const statusLabel: Record<SessionStatus, string> = {
  [SessionStatus.IDLE]: 'Ready when you are',
  [SessionStatus.CONNECTING]: 'Connecting',
  [SessionStatus.LIVE]: 'Interview in progress',
  [SessionStatus.ENDED]: 'Interview complete',
};

const VoiceSession = ({ userName, interviewId }: { userName: string; interviewId: string }) => {
  const router = useRouter();
  const { status, isSpeaking, messages, caption, start, end } = useVoiceSession(interviewId);
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const hasGeneratedReport = useRef(false);
  const transcriptIdRef = useRef<string | null>(null);

  // Save-first pipeline: the transcript is persisted before any AI call, so
  // a model outage can never lose the interview - worst case the report is
  // generated later from the stored transcript.
  const finishInterview = useCallback(async () => {
    if (messages.length === 0) {
      toast.error('No conversation was recorded, so a report could not be generated.');
      router.push('/dashboard');
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

    const report = await createReport(transcriptIdRef.current);
    if (report.success && report.reportId) {
      router.push(`/interviews/${interviewId}/report?attempt=${report.attempt}`);
    } else {
      toast.info('Your answers are saved. The AI service is busy right now - generate your report from the report page in a minute.');
      router.push(`/interviews/${interviewId}/report`);
    }
  }, [messages, interviewId, router]);

  useEffect(() => {
    if (status !== SessionStatus.ENDED || hasGeneratedReport.current) return;
    hasGeneratedReport.current = true;
    void finishInterview();
  }, [status, finishInterview]);

  const isLive = status === SessionStatus.LIVE;

  return (
    <section className="flex flex-col items-center gap-10 py-8 fade-up">
      <div className="status-pill">
        <span
          className={cn(
            'size-2 rounded-full',
            isLive ? 'bg-spark-400 animate-pulse' : status === SessionStatus.CONNECTING ? 'bg-ember-400 animate-pulse' : 'bg-mist-500'
          )}
        />
        {statusLabel[status]}
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
          className="btn-spark min-w-44"
          onClick={() => {
            hasGeneratedReport.current = false;
            transcriptIdRef.current = null;
            void start();
          }}
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
        <button className="btn-danger min-w-44" onClick={end}>
          <PhoneOff className="size-4" /> End interview
        </button>
      )}
    </section>
  );
};

export default VoiceSession;
