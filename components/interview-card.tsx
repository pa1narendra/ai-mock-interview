import dayjs from 'dayjs';
import Link from 'next/link';
import { Calendar, Star, ArrowUpRight } from 'lucide-react';
import { roleAccent, roleInitials, scoreTone } from '@/lib/utils';
import { MAX_INTERVIEW_ATTEMPTS } from '@/lib/schemas';
import TechBadges from './tech-badges';
import DeleteInterviewButton from './delete-interview-button';

const InterviewCard = ({
  interview,
  report,
  deletable = false,
  community = false,
}: {
  interview: Interview;
  report: InterviewReport | null;
  deletable?: boolean;
  community?: boolean;
}) => {
  const { id, role, type, techstack, createdAt } = interview;
  const normalizedType = /mix/gi.test(type) ? 'Mixed' : type;
  const formattedDate = dayjs(report?.createdAt || createdAt).format('MMM D, YYYY');
  const accent = roleAccent(role);
  // Community interviews are personalized to the viewer (their resume) rather
  // than taken verbatim, so they route through the new-interview form.
  const href = community
    ? `/interviews/new?template=${id}`
    : report ? `/interviews/${id}/report` : `/interviews/${id}`;
  const cta = community ? 'Personalize & start' : report ? 'View report' : 'Start';

  return (
    <div className="relative w-full">
      <Link
        href={href}
        className="panel panel-hover group flex h-full flex-col gap-4 p-6"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl font-display text-base font-bold text-white"
            style={{ background: accent.from }}
          >
            {roleInitials(role)}
          </div>
          <span className="rounded-full border border-border bg-surface-raised px-3 py-1 text-xs font-medium capitalize text-text-secondary">
            {normalizedType}
          </span>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg capitalize leading-snug line-clamp-2">{role} Interview</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5" /> {formattedDate}
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="size-3.5" />
              <span className={report ? scoreTone(report.totalScore) : undefined}>
                {report?.totalScore ?? '--'}
              </span>
              /100
            </span>
            {report && <span className="text-xs">try {report.attempt}/{MAX_INTERVIEW_ATTEMPTS}</span>}
          </div>
        </div>

        <p className="line-clamp-2 text-sm">
          {report?.finalAssessment ?? "You haven't taken this interview yet. Jump in and practice out loud."}
        </p>

        <div className="mt-auto flex flex-col gap-3 pt-1">
          <TechBadges stack={techstack} max={4} />
          <span className="flex items-center gap-1 text-sm font-semibold text-primary group-hover:gap-2 transition-all">
            {cta} <ArrowUpRight className="size-4" />
          </span>
        </div>
      </Link>

      {deletable && (
        <div className="absolute right-3 top-3 z-10">
          <DeleteInterviewButton id={id} />
        </div>
      )}
    </div>
  );
};

export default InterviewCard;
