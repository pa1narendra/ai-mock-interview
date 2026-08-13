import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileBarChart } from 'lucide-react';
import VoiceSession from '@/components/voice-session';
import TechBadges from '@/components/tech-badges';
import EditQuestions from '@/components/edit-questions';
import { getCurrentUser } from '@/lib/actions/auth';
import { getInterview } from '@/lib/actions/interviews';
import { getAttemptsUsed } from '@/lib/actions/transcripts';
import { roleAccent, roleInitials, scoreTone } from '@/lib/utils';
import { getPermissions } from '@/lib/permissions';

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { id } = await params;
  const interview = await getInterview(id);
  return {
    title: interview ? `${interview.role} Interview` : 'Interview',
  };
}

const Page = async ({ params }: RouteParams) => {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const interview = await getInterview(id);
  if (!interview) redirect('/dashboard');

  const perms = getPermissions(user);
  const maxAttempts = perms.maxAttempts;
  const attemptsUsed = await getAttemptsUsed(id);
  const attemptsExhausted = attemptsUsed >= maxAttempts;

  const accent = roleAccent(interview.role);

  return (
    <>
      <div className="flex flex-row items-center justify-between gap-6 max-sm:flex-col max-sm:items-start">
        <div className="flex flex-row items-center gap-4">
          <div
            className="flex size-11 items-center justify-center rounded-xl font-display text-base font-bold text-white"
            style={{ background: accent.from }}
          >
            {roleInitials(interview.role)}
          </div>
          <div className="space-y-1.5">
            <h3 className="capitalize">{interview.role} Interview</h3>
            <TechBadges stack={interview.techstack} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-border bg-surface-raised px-4 py-1.5 text-sm font-medium capitalize text-mist-300">
            {interview.type}
          </span>
          <span className="rounded-full border border-border bg-surface-raised px-4 py-1.5 text-sm font-medium text-mist-300">
            Attempt {Math.min(attemptsUsed + 1, maxAttempts)} of {maxAttempts}
          </span>
        </div>
      </div>

      {interview.fitSnapshot && <FitSnapshotPanel snapshot={interview.fitSnapshot} />}

      {attemptsExhausted ? (
        <section className="panel mt-8 flex flex-col items-center gap-4 px-8 py-12 text-center fade-up">
          <h3>All {maxAttempts} attempts used</h3>
          <p className="max-w-md">
            You&apos;ve completed this interview {maxAttempts} times. Check your progress
            across attempts in the report, or create a fresh interview to keep practicing.
          </p>
          <div className="flex gap-4 max-sm:flex-col">
            <Link href={`/interviews/${id}/report`} className="btn-spark">
              <FileBarChart className="size-4" /> View progress report
            </Link>
            <Link href="/interviews/new" className="btn-outline">
              New interview
            </Link>
          </div>
        </section>
      ) : (
        <>
          {perms.canPreviewQuestions && (
            <EditQuestions
              interviewId={id}
              questions={interview.questions}
              canEdit={perms.canEditQuestions && interview.userId === user.id}
            />
          )}
          <VoiceSession userName={user.name} interviewId={id} />
        </>
      )}
    </>
  );
};

const FitSnapshotPanel = ({ snapshot }: { snapshot: FitSnapshot }) => (
  <section className="panel flex flex-col gap-5 px-8 py-6 mt-8 fade-up">
    <div className="flex items-center justify-between gap-6 max-sm:flex-col max-sm:items-start">
      <div>
        <p className="text-sm uppercase tracking-widest text-mist-500">Resume vs job description</p>
        <p className={`font-display text-4xl font-bold ${scoreTone(snapshot.matchScore)}`}>
          {snapshot.matchScore}<span className="text-xl text-mist-500">/100 match</span>
        </p>
      </div>
      <p className="max-w-md text-sm">{snapshot.verdict}</p>
    </div>

    <div className="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
      <div className="space-y-2">
        <p className="text-sm font-medium text-mist-100">Matched skills</p>
        <div className="flex flex-wrap gap-1.5">
          {snapshot.matchedSkills.map((skill) => (
            <span key={skill} className="rounded-full border border-success/30 bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
              {skill}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-mist-100">Gaps the interviewer will probe</p>
        <div className="flex flex-wrap gap-1.5">
          {snapshot.missingSkills.length > 0 ? snapshot.missingSkills.map((skill) => (
            <span key={skill} className="rounded-full border border-warning/30 bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning">
              {skill}
            </span>
          )) : <span className="text-sm text-mist-500">No major gaps found</span>}
        </div>
      </div>
    </div>

    {snapshot.talkingPoints.length > 0 && (
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-mist-100">Prepare to talk about</p>
        <ul className="space-y-1 text-sm">
          {snapshot.talkingPoints.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
      </div>
    )}
  </section>
);

export default Page;
