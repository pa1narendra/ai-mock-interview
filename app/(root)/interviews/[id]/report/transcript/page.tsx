import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions/auth';
import { getInterview } from '@/lib/actions/interviews';
import { getTranscriptTurns } from '@/lib/actions/transcripts';
import TranscriptBubbles from '@/components/transcript-bubbles';

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { id } = await params;
  const interview = await getInterview(id);
  return { title: interview ? `Transcript - ${interview.role} Interview` : 'Transcript' };
}

// The full conversation for one attempt, on its own page so the report (and
// its PDF) stays focused on feedback.
const Page = async ({ params, searchParams }: RouteParams) => {
  const { id } = await params;
  const { attempt: attemptParam } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const interview = await getInterview(id);
  if (!interview || interview.userId !== user.id) redirect('/dashboard');

  const attempt = Number(attemptParam);
  if (!Number.isInteger(attempt) || attempt < 1) redirect(`/interviews/${id}/report`);

  // Scoped to the current user inside getTranscriptTurns.
  const turns = await getTranscriptTurns(id, attempt);
  if (turns.length === 0) redirect(`/interviews/${id}/report?attempt=${attempt}`);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8 fade-up">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-highlight">Full transcript · Attempt {attempt}</p>
        <h1 className="text-3xl capitalize">{interview.role} interview</h1>
      </div>
      <div className="flex flex-col gap-3">
        <TranscriptBubbles bubbles={turns} />
      </div>
    </section>
  );
};

export default Page;
