import type { Metadata } from 'next';
import Link from 'next/link';
import dayjs from 'dayjs';
import { redirect } from 'next/navigation';
import { RotateCcw, LayoutDashboard, MessagesSquare } from 'lucide-react';
import { getCurrentUser } from '@/lib/actions/auth';
import { getInterview } from '@/lib/actions/interviews';
import { getReportsForInterview } from '@/lib/actions/reports';
import { getPendingTranscripts } from '@/lib/actions/transcripts';
import { getPermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import GenerateReportButton from '@/components/generate-report-button';
import PracticeGapsButton from '@/components/practice-gaps-button';
import ShareReportButton from '@/components/share-report-button';
import PrintButton from '@/components/print-button';
import ReportPlaybook from '@/components/report-playbook';

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { id } = await params;
  const interview = await getInterview(id);
  return {
    title: interview ? `Report - ${interview.role} Interview` : 'Report',
  };
}

const Page = async ({ params, searchParams }: RouteParams) => {
  const { id } = await params;
  const { attempt: attemptParam } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  const maxAttempts = getPermissions(user).maxAttempts;

  const interview = await getInterview(id);
  if (!interview) redirect('/dashboard');

  const [allReports, pendingTranscripts] = await Promise.all([
    getReportsForInterview(id),
    getPendingTranscripts(id),
  ]);
  if (!allReports.length && !pendingTranscripts.length) redirect(`/interviews/${id}`);

  const attemptsUsed = Math.max(
    allReports.length ? allReports[allReports.length - 1].attempt : 0,
    pendingTranscripts.length ? pendingTranscripts[pendingTranscripts.length - 1].attempt : 0
  );
  const canRetake = attemptsUsed < maxAttempts;

  const pendingPanel = pendingTranscripts.length > 0 && (
    <div className="panel flex flex-col gap-4 border-warning/30 px-8 py-6">
      {pendingTranscripts.map((transcript) => (
        <div key={transcript.id} className="flex items-center justify-between gap-6 max-sm:flex-col max-sm:items-start">
          <div>
            <p className="font-medium text-mist-100">Attempt {transcript.attempt} - report not generated yet</p>
            <p className="text-sm text-mist-500">
              Your answers from {dayjs(transcript.createdAt).format('MMM D, h:mm A')} are saved.
              The AI service was busy when the interview ended.
            </p>
          </div>
          <GenerateReportButton transcriptId={transcript.id} interviewId={id} />
        </div>
      ))}
    </div>
  );

  // Answers saved but no report generated yet for any attempt.
  if (!allReports.length) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 fade-up">
        <div className="text-center space-y-3">
          <h1>
            Interview report - <span className="capitalize text-highlight">{interview.role}</span>
          </h1>
          <p>Your interview is complete and your answers are safe.</p>
        </div>
        {pendingPanel}
        <div className="flex justify-center">
          <Link href="/dashboard" className="btn-outline">
            <LayoutDashboard className="size-4" /> Back to dashboard
          </Link>
        </div>
      </section>
    );
  }

  const report =
    allReports.find((candidate) => String(candidate.attempt) === attemptParam) ??
    allReports[allReports.length - 1];

  const pdfName = `Mockstar - ${interview.role} interview - attempt ${report.attempt}`;

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 fade-up print:max-w-none">
      {allReports.length > 1 && (
        <div className="no-print flex flex-wrap items-center gap-2">
          {allReports.map((candidate) => (
            <Link
              key={candidate.attempt}
              href={`/interviews/${id}/report?attempt=${candidate.attempt}`}
              replace
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                candidate.attempt === report.attempt
                  ? 'border-highlight/50 bg-highlight-soft text-highlight'
                  : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
              )}
            >
              Attempt {candidate.attempt}
            </Link>
          ))}
        </div>
      )}

      {pendingPanel && <div className="no-print">{pendingPanel}</div>}

      <ReportPlaybook
        candidateName={user.name}
        interview={interview}
        report={report}
        allReports={allReports}
        maxAttempts={maxAttempts}
      />

      <div className="no-print flex flex-wrap items-center gap-3 border-t border-border pt-8">
        <Link href={`/interviews/${id}/report/transcript?attempt=${report.attempt}`} className="btn-outline">
          <MessagesSquare className="size-4" /> Full transcript
        </Link>
        <ShareReportButton reportId={report.id} initialShareId={report.shareId ?? null} />
        <PrintButton fileName={pdfName} />
      </div>

      <div className="no-print flex flex-wrap gap-4 max-sm:flex-col">
        <Link href="/dashboard" className="btn-outline">
          <LayoutDashboard className="size-4" /> Back to dashboard
        </Link>
        {report.areasForImprovement.length > 0 && <PracticeGapsButton interviewId={id} />}
        {canRetake ? (
          <Link href={`/interviews/${id}`} className="btn-spark">
            <RotateCcw className="size-4" /> Retake interview ({maxAttempts - attemptsUsed} left)
          </Link>
        ) : (
          <Link href="/interviews/new" className="btn-spark">
            All attempts used - create a new interview
          </Link>
        )}
      </div>
    </section>
  );
};

export default Page;
