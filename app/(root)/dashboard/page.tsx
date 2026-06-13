import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AudioLines, Sparkles } from 'lucide-react';
import InterviewCard from '@/components/interview-card';
import { getCurrentUser } from '@/lib/actions/auth';
import { getMyInterviews, getCommunityInterviews } from '@/lib/actions/interviews';
import { getMyReportsByInterview } from '@/lib/actions/reports';

export const metadata: Metadata = {
  title: 'Dashboard',
};

const Page = async () => {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const [myInterviews, communityInterviews] = await Promise.all([
    getMyInterviews(),
    getCommunityInterviews(),
  ]);

  const allInterviews = [...(myInterviews ?? []), ...(communityInterviews ?? [])];
  const reports = await getMyReportsByInterview(allInterviews.map((interview) => interview.id));

  return (
    <>
      <section className="panel relative overflow-hidden px-12 py-14 max-sm:px-6 fade-up">
        <div
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full opacity-25 blur-3xl"
          style={{ background: 'radial-gradient(circle, #10b981, transparent 65%)' }}
        />
        <div className="relative flex flex-col gap-5 max-w-2xl">
          <span className="status-pill w-fit">
            <AudioLines className="size-3.5 text-spark-400" /> Voice-first practice
          </span>
          <h1 className="text-5xl max-sm:text-4xl leading-tight">
            Nail your next interview, <span className="text-spark-gradient">out loud</span>.
          </h1>
          <p className="text-lg">
            Hey {user.name.split(' ')[0]} - spin up a tailored mock interview, talk it through with an
            AI interviewer in real time, and get a scored report on exactly what to improve.
          </p>
          <Link href="/interviews/new" className="btn-spark w-fit">
            <Sparkles className="size-4" /> New mock interview
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2>Your interviews</h2>
        <div className="flex flex-wrap gap-5 max-lg:flex-col items-stretch">
          {(myInterviews ?? []).length > 0 ? (
            myInterviews?.map((interview) => (
              <InterviewCard interview={interview} report={reports[interview.id] ?? null} deletable key={interview.id} />
            ))
          ) : (
            <p className="text-mist-500">Nothing here yet - create your first interview above.</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2>From the community</h2>
        <div className="flex flex-wrap gap-5 max-lg:flex-col items-stretch">
          {(communityInterviews ?? []).length > 0 ? (
            communityInterviews?.map((interview) => (
              <InterviewCard interview={interview} report={reports[interview.id] ?? null} key={interview.id} />
            ))
          ) : (
            <p className="text-mist-500">No community interviews yet - yours could be the first.</p>
          )}
        </div>
      </section>
    </>
  );
};

export default Page;
