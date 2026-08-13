import type { Metadata } from 'next';
import InterviewForm from '@/components/interview-form';
import { getMyResumeMeta } from '@/lib/actions/resumes';
import { getInterview } from '@/lib/actions/interviews';
import { getCurrentUser } from '@/lib/actions/auth';
import { getPermissions } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'New Interview',
};

const Page = async ({ searchParams }: { searchParams: Promise<{ template?: string }> }) => {
  const { template: templateId } = await searchParams;

  const [savedResume, source, user] = await Promise.all([
    getMyResumeMeta(),
    templateId ? getInterview(templateId) : Promise.resolve(null),
    getCurrentUser(),
  ]);
  const canChooseVoice = getPermissions(user).canChooseVoice;

  // getInterview strips JD/resume for non-owners, so only public fields carry over.
  const template = source
    ? {
        role: source.role,
        level: source.level,
        type: source.type,
        techstack: source.techstack,
        voice: source.voice ?? null,
      }
    : null;

  return (
    <div className="flex flex-col items-center gap-8 fade-up">
      <div className="text-center space-y-2">
        <h1>
          {template ? (
            <>Personalize this <span className="text-highlight">interview</span></>
          ) : (
            <>Set up your <span className="text-highlight">interview</span></>
          )}
        </h1>
        <p className="max-w-md">
          {template
            ? "We'll tailor this role's questions to your resume - add it below and start."
            : "Paste the job description and add your resume - we'll build an interview that probes exactly what this job needs from you."}
        </p>
      </div>
      <InterviewForm savedResume={savedResume} template={template} canChooseVoice={canChooseVoice} />
    </div>
  );
};

export default Page;
