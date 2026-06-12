import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileBarChart } from 'lucide-react';
import VoiceSession from '@/components/voice-session';
import TechBadges from '@/components/tech-badges';
import { getCurrentUser } from '@/lib/actions/auth';
import { getInterview } from '@/lib/actions/interviews';
import { getAttemptsUsed } from '@/lib/actions/transcripts';
import { MAX_INTERVIEW_ATTEMPTS } from '@/lib/schemas';
import { roleAccent, roleInitials } from '@/lib/utils';

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
  if (!interview) redirect('/');

  const attemptsUsed = await getAttemptsUsed(id);
  const attemptsExhausted = attemptsUsed >= MAX_INTERVIEW_ATTEMPTS;

  const accent = roleAccent(interview.role);

  return (
    <>
      <div className="flex flex-row items-center justify-between gap-6 max-sm:flex-col max-sm:items-start">
        <div className="flex flex-row items-center gap-4">
          <div
            className="flex size-11 items-center justify-center rounded-xl font-display text-base font-bold text-ink-950"
            style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
          >
            {roleInitials(interview.role)}
          </div>
          <div className="space-y-1.5">
            <h3 className="capitalize">{interview.role} Interview</h3>
            <TechBadges stack={interview.techstack} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-sm font-medium capitalize text-mist-300">
            {interview.type}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-1.5 text-sm font-medium text-mist-300">
            Attempt {Math.min(attemptsUsed + 1, MAX_INTERVIEW_ATTEMPTS)} of {MAX_INTERVIEW_ATTEMPTS}
          </span>
        </div>
      </div>

      {interview.fitSnapshot && <FitSnapshotPanel snapshot={interview.fitSnapshot} />}

      {attemptsExhausted ? (
        <section className="panel mt-8 flex flex-col items-center gap-4 px-8 py-12 text-center fade-up">
          <h3>All {MAX_INTERVIEW_ATTEMPTS} attempts used</h3>
          <p className="max-w-md">
            You&apos;ve completed this interview {MAX_INTERVIEW_ATTEMPTS} times. Check your progress
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
        <VoiceSession userName={user.name} interviewId={id} />
      )}
    </>
  );
};

const scoreTone = (score: number) =>
  score >= 75 ? 'text-spark-400' : score >= 50 ? 'text-ember-400' : 'text-alert-400';

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
            <span key={skill} className="rounded-full border border-spark-500/25 bg-spark-500/10 px-2.5 py-1 text-xs font-medium text-spark-300">
              {skill}
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-mist-100">Gaps the interviewer will probe</p>
        <div className="flex flex-wrap gap-1.5">
          {snapshot.missingSkills.length > 0 ? snapshot.missingSkills.map((skill) => (
            <span key={skill} className="rounded-full border border-ember-400/25 bg-ember-400/10 px-2.5 py-1 text-xs font-medium text-ember-400">
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
