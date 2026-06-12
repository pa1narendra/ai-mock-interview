import type { Metadata } from 'next';
import InterviewForm from '@/components/interview-form';
import { getMyResumeMeta } from '@/lib/actions/resumes';

export const metadata: Metadata = {
  title: 'New Interview',
};

const Page = async () => {
  const savedResume = await getMyResumeMeta();

  return (
    <div className="flex flex-col items-center gap-8 fade-up">
      <div className="text-center space-y-2">
        <h1>Set up your interview</h1>
        <p className="max-w-md">
          Paste the job description and add your resume - we&apos;ll build an interview
          that probes exactly what this job needs from you.
        </p>
      </div>
      <InterviewForm savedResume={savedResume} />
    </div>
  );
};

export default Page;
