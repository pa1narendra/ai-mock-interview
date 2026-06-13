import dayjs from 'dayjs';
import Link from 'next/link';
import { Calendar, Star, ArrowUpRight } from 'lucide-react';
import { roleAccent, roleInitials } from '@/lib/utils';
import { MAX_INTERVIEW_ATTEMPTS } from '@/lib/schemas';
import TechBadges from './tech-badges';
import DeleteInterviewButton from './delete-interview-button';

const InterviewCard = ({
  interview,
  report,
  deletable = false,
}: {
  interview: Interview;
  report: InterviewReport | null;
  deletable?: boolean;
}) => {
  const { id, role, type, techstack, createdAt } = interview;
  const normalizedType = /mix/gi.test(type) ? 'Mixed' : type;
  const formattedDate = dayjs(report?.createdAt || createdAt).format('MMM D, YYYY');
  const accent = roleAccent(role);

  return (
    <div className="relative w-[360px] max-sm:w-full">
      <Link
        href={report ? `/interviews/${id}/report` : `/interviews/${id}`}
        className="panel panel-hover group flex h-full flex-col gap-5 p-6"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex size-14 items-center justify-center rounded-2xl font-display text-lg font-bold text-ink-950"
            style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
          >
            {roleInitials(role)}
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium capitalize text-mist-300">
            {normalizedType}
          </span>
        </div>

        <div className="space-y-1">
          <h3 className="text-xl capitalize">{role} Interview</h3>
          <div className="flex items-center gap-4 text-sm text-mist-500">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5" /> {formattedDate}
            </span>
            <span className="flex items-center gap-1.5">
              <Star className="size-3.5 text-spark-400" /> {report?.totalScore ?? '--'}/100
            </span>
            {report && <span className="text-xs">try {report.attempt}/{MAX_INTERVIEW_ATTEMPTS}</span>}
          </div>
        </div>

        <p className="line-clamp-2 text-sm">
          {report?.finalAssessment ?? "You haven't taken this interview yet. Jump in and practice out loud."}
        </p>

        <div className="mt-auto flex items-center justify-between">
          <TechBadges stack={techstack} max={3} />
          <span className="flex items-center gap-1 text-sm font-semibold text-spark-300 group-hover:gap-2 transition-all">
            {report ? 'View report' : 'Start'} <ArrowUpRight className="size-4" />
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
