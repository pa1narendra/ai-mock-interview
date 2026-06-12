import type { Metadata } from 'next';
import Link from 'next/link';
import dayjs from 'dayjs';
import { redirect } from 'next/navigation';
import { Calendar, TrendingUp, TrendingDown, RotateCcw, LayoutDashboard, ArrowRight, Minus } from 'lucide-react';
import { getCurrentUser } from '@/lib/actions/auth';
import { getInterview } from '@/lib/actions/interviews';
import { getReportsForInterview } from '@/lib/actions/reports';
import { getPendingTranscripts } from '@/lib/actions/transcripts';
import { MAX_INTERVIEW_ATTEMPTS } from '@/lib/schemas';
import { cn } from '@/lib/utils';
import GenerateReportButton from '@/components/generate-report-button';

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { id } = await params;
  const interview = await getInterview(id);
  return {
    title: interview ? `Report - ${interview.role} Interview` : 'Report',
  };
}

const scoreTone = (score: number) =>
  score >= 75 ? 'text-spark-400' : score >= 50 ? 'text-ember-400' : 'text-alert-400';

const barTone = (score: number) =>
  score >= 75 ? 'bg-spark-500' : score >= 50 ? 'bg-ember-400' : 'bg-alert-400';

const deltaBadge = (delta: number) => {
  if (delta > 0)
    return <span className="flex items-center gap-0.5 text-xs font-semibold text-spark-400"><TrendingUp className="size-3" />+{delta}</span>;
  if (delta < 0)
    return <span className="flex items-center gap-0.5 text-xs font-semibold text-alert-400"><TrendingDown className="size-3" />{delta}</span>;
  return <span className="flex items-center gap-0.5 text-xs font-semibold text-mist-500"><Minus className="size-3" />0</span>;
};

const Page = async ({ params, searchParams }: RouteParams) => {
  const { id } = await params;
  const { attempt: attemptParam } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const interview = await getInterview(id);
  if (!interview) redirect('/');

  const [allReports, pendingTranscripts] = await Promise.all([
    getReportsForInterview(id),
    getPendingTranscripts(id),
  ]);
  if (!allReports.length && !pendingTranscripts.length) redirect(`/interviews/${id}`);

  const attemptsUsed = Math.max(
    allReports.length ? allReports[allReports.length - 1].attempt : 0,
    pendingTranscripts.length ? pendingTranscripts[pendingTranscripts.length - 1].attempt : 0
  );
  const canRetake = attemptsUsed < MAX_INTERVIEW_ATTEMPTS;

  const pendingPanel = pendingTranscripts.length > 0 && (
    <div className="panel flex flex-col gap-4 border-ember-400/30 px-8 py-6">
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
            Interview report - <span className="capitalize text-spark-gradient">{interview.role}</span>
          </h1>
          <p>Your interview is complete and your answers are safe.</p>
        </div>
        {pendingPanel}
        <div className="flex justify-center">
          <Link href="/" className="btn-outline">
            <LayoutDashboard className="size-4" /> Back to dashboard
          </Link>
        </div>
      </section>
    );
  }

  const report =
    allReports.find((candidate) => String(candidate.attempt) === attemptParam) ??
    allReports[allReports.length - 1];

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 fade-up">
      <div className="text-center space-y-3">
        <h1>
          Interview report - <span className="capitalize text-spark-gradient">{interview.role}</span>
        </h1>
        <div className="flex items-center justify-center gap-6 text-sm text-mist-500">
          <span className="flex items-center gap-1.5">
            <Calendar className="size-4" />
            {dayjs(report.createdAt).format('MMM D, YYYY h:mm A')}
          </span>
          <span>Attempt {report.attempt} of {MAX_INTERVIEW_ATTEMPTS}</span>
        </div>
        {allReports.length > 1 && (
          <div className="flex items-center justify-center gap-2 pt-1">
            {allReports.map((candidate) => (
              <Link
                key={candidate.attempt}
                href={`/interviews/${id}/report?attempt=${candidate.attempt}`}
                className={cn(
                  'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                  candidate.attempt === report.attempt
                    ? 'border-spark-500/50 bg-spark-500/15 text-spark-300'
                    : 'border-white/10 bg-white/[0.04] text-mist-400 hover:text-mist-200'
                )}
              >
                Attempt {candidate.attempt}
              </Link>
            ))}
          </div>
        )}
      </div>

      {pendingPanel}

      {allReports.length > 1 && (
        <div className="panel flex flex-col gap-5 px-8 py-6">
          <h3>Your progress</h3>
          <div className="flex items-center justify-center gap-3 max-sm:flex-col">
            {allReports.map((candidate, index) => {
              const previous = index > 0 ? allReports[index - 1] : null;
              return (
                <div key={candidate.attempt} className="flex items-center gap-3">
                  {index > 0 && <ArrowRight className="size-4 text-mist-500 max-sm:rotate-90" />}
                  <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3">
                    <span className="text-xs uppercase tracking-widest text-mist-500">Attempt {candidate.attempt}</span>
                    <span className={`font-display text-2xl font-bold ${scoreTone(candidate.totalScore)}`}>
                      {candidate.totalScore}
                    </span>
                    {previous && deltaBadge(candidate.totalScore - previous.totalScore)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="space-y-2.5">
            {report.categoryScores?.map((category) => {
              const history = allReports.map(
                (candidate) => candidate.categoryScores?.find((c) => c.name === category.name)?.score ?? null
              );
              const last = history[history.length - 1];
              const prev = history.length > 1 ? history[history.length - 2] : null;
              return (
                <div key={category.name} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-mist-300">{category.name}</span>
                  <span className="flex items-center gap-2">
                    {history.map((score, index) => (
                      <span key={index} className={cn('font-medium', score === null ? 'text-mist-500' : scoreTone(score))}>
                        {score ?? '-'}
                        {index < history.length - 1 && <span className="ml-2 text-mist-600">→</span>}
                      </span>
                    ))}
                    {last !== null && prev !== null && deltaBadge(last - prev)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="panel flex items-center justify-between gap-6 px-8 py-6 max-sm:flex-col">
        <div>
          <p className="text-sm uppercase tracking-widest text-mist-500">Overall score</p>
          <p className={`font-display text-5xl font-bold ${scoreTone(report.totalScore)}`}>
            {report.totalScore}<span className="text-2xl text-mist-500">/100</span>
          </p>
        </div>
        <p className="max-w-md text-sm">{report.finalAssessment}</p>
      </div>

      <div className="panel flex flex-col gap-5 px-8 py-6">
        <h3>Category breakdown</h3>
        {report.categoryScores?.map((category) => (
          <div key={category.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium text-mist-100">{category.name}</p>
              <span className={`font-semibold ${scoreTone(category.score)}`}>{category.score}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={`h-full rounded-full ${barTone(category.score)}`}
                style={{ width: `${Math.max(2, Math.min(100, category.score))}%` }}
              />
            </div>
            <p className="text-sm">{category.comment}</p>
          </div>
        ))}
      </div>

      {report.jdMatch && (
        <div className="panel flex flex-col gap-5 px-8 py-6">
          <div className="flex items-center justify-between gap-6 max-sm:flex-col max-sm:items-start">
            <h3>Job requirements coverage</h3>
            <p className={`font-display text-3xl font-bold ${scoreTone(report.jdMatch.coverageScore)}`}>
              {report.jdMatch.coverageScore}<span className="text-lg text-mist-500">/100</span>
            </p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={`h-full rounded-full ${barTone(report.jdMatch.coverageScore)}`}
              style={{ width: `${Math.max(2, Math.min(100, report.jdMatch.coverageScore))}%` }}
            />
          </div>
          <p className="text-sm">{report.jdMatch.comment}</p>
          <div className="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-mist-100">
                <TrendingUp className="size-4 text-spark-400" /> Requirements you covered
              </p>
              <ul className="space-y-1 text-sm">
                {report.jdMatch.gapsAddressed.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-mist-100">
                <TrendingDown className="size-4 text-ember-400" /> Still unproven
              </p>
              <ul className="space-y-1 text-sm">
                {report.jdMatch.gapsRemaining.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
        <div className="panel flex flex-col gap-3 px-7 py-6">
          <h3 className="flex items-center gap-2 text-lg">
            <TrendingUp className="size-5 text-spark-400" /> Strengths
          </h3>
          <ul className="space-y-1.5 text-sm">
            {report.strengths?.map((strength, index) => (
              <li key={index}>{strength}</li>
            ))}
          </ul>
        </div>

        <div className="panel flex flex-col gap-3 px-7 py-6">
          <h3 className="flex items-center gap-2 text-lg">
            <TrendingDown className="size-5 text-ember-400" /> Improve next
          </h3>
          <ul className="space-y-1.5 text-sm">
            {report.areasForImprovement?.map((area, index) => (
              <li key={index}>{area}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex justify-center gap-4 max-sm:flex-col max-sm:items-center">
        <Link href="/" className="btn-outline">
          <LayoutDashboard className="size-4" /> Back to dashboard
        </Link>
        {canRetake ? (
          <Link href={`/interviews/${id}`} className="btn-spark">
            <RotateCcw className="size-4" /> Retake interview ({MAX_INTERVIEW_ATTEMPTS - attemptsUsed} left)
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
