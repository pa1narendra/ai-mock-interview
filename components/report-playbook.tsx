import dayjs from 'dayjs';
import { Check } from 'lucide-react';
import { cn, scoreBar, scoreTone } from '@/lib/utils';

// The interview report as a coach's playbook: score at a glance, then what to
// fix before the next attempt, then a rehearsal sheet per question (weakest
// first). The same layout is the on-screen report and the "Download PDF"
// document - print: variants only adjust spacing and page breaks.

// The scorer sometimes slips markdown into its prose; show it as plain text.
const plain = (text: string) => text.replace(/[*`]|__/g, '');

const verdictLabel = (score: number) =>
  score >= 75 ? 'Interview-ready' : score >= 50 ? 'Getting there' : score >= 25 ? 'Needs work' : 'Early days';

const Delta = ({ value, suffix }: { value: number; suffix?: string }) => (
  <span className={cn('text-xs font-semibold', value > 0 ? 'text-success' : value < 0 ? 'text-danger' : 'text-muted-foreground')}>
    {value > 0 ? `+${value}` : value === 0 ? '±0' : value}
    {suffix}
  </span>
);

const SectionTitle = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="mb-4 space-y-1">
    <h2 className="text-xl">{title}</h2>
    {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
  </div>
);

interface ReportPlaybookProps {
  candidateName: string;
  interview: Interview;
  report: InterviewReport;
  allReports: InterviewReport[];
  maxAttempts: number;
}

const ReportPlaybook = ({ candidateName, interview, report, allReports, maxAttempts }: ReportPlaybookProps) => {
  const index = allReports.findIndex((r) => r.attempt === report.attempt);
  const previous = index > 0 ? allReports[index - 1] : null;
  const history = allReports.slice(0, index + 1);
  const categories = report.categoryScores ?? [];
  // Weakest answers first: that's where rehearsal pays off most.
  const questions = (report.questionFeedback ?? [])
    .map((item, i) => ({ ...item, number: i + 1 }))
    .sort((a, b) => a.score - b.score);

  return (
    <div className="flex flex-col gap-10 print:gap-7">
      {/* ---------- Score strip ---------- */}
      <header className="flex flex-col gap-5 border-b border-border pb-8 print:pb-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-highlight">
            Interview playbook · Attempt {report.attempt} of {maxAttempts}
          </p>
          <h1 className="text-4xl capitalize max-sm:text-3xl print:text-3xl">{interview.role} interview</h1>
          <p className="text-sm text-muted-foreground">
            {candidateName} · <span className="capitalize">{interview.level}</span> ·{' '}
            <span className="capitalize">{interview.type}</span> · {dayjs(report.createdAt).format('D MMM YYYY')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex items-baseline gap-1">
            <span className={cn('font-display text-6xl font-bold leading-none print:text-5xl', scoreTone(report.totalScore))}>
              {report.totalScore}
            </span>
            <span className="text-lg text-muted-foreground">/100</span>
          </div>
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">{verdictLabel(report.totalScore)}</p>
            {previous && (
              <p className="text-sm text-muted-foreground">
                <Delta value={report.totalScore - previous.totalScore} /> since attempt {previous.attempt}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {categories.map((category) => {
            const before = previous?.categoryScores?.find((c) => c.name === category.name)?.score;
            return (
              <span
                key={category.name}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1 text-xs text-text-secondary"
              >
                {category.name}
                <span className={cn('font-bold', scoreTone(category.score))}>{category.score}</span>
                {before !== undefined && <Delta value={category.score - before} />}
              </span>
            );
          })}
        </div>

        <p className="leading-relaxed text-text-secondary">{plain(report.finalAssessment)}</p>
      </header>

      {/* ---------- Fix these ---------- */}
      {report.areasForImprovement.length > 0 && (
        <section className="break-inside-avoid">
          <SectionTitle
            title="Fix these before your next attempt"
            hint="Work through them in order. Tick each one off once you can do it without thinking."
          />
          <ol className="flex flex-col gap-3">
            {report.areasForImprovement.map((area, i) => (
              <li key={i} className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5 break-inside-avoid print:p-4">
                <span className="mt-0.5 size-5 shrink-0 rounded-md border-2 border-highlight/60" aria-hidden />
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Fix {i + 1}</p>
                  <p className="text-foreground">{plain(area)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ---------- Keep doing ---------- */}
      {report.strengths.length > 0 && (
        <section className="break-inside-avoid">
          <SectionTitle title="Keep doing" />
          <ul className="grid gap-2.5 sm:grid-cols-2 print:grid-cols-2">
            {report.strengths.map((strength, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                <Check className="mt-0.5 size-4 shrink-0 text-success" />
                {plain(strength)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---------- Progress ---------- */}
      {history.length > 1 && (
        <section className="break-inside-avoid">
          <SectionTitle title="Your progress" />
          <div className="flex flex-wrap items-center gap-2">
            {history.map((attempt, i) => (
              <div
                key={attempt.attempt}
                className={cn(
                  'flex items-baseline gap-2 rounded-xl border px-4 py-2',
                  attempt.attempt === report.attempt ? 'border-highlight/50 bg-highlight-soft' : 'border-border'
                )}
              >
                <span className="text-xs text-muted-foreground">Attempt {attempt.attempt}</span>
                <span className={cn('font-display text-xl font-bold', scoreTone(attempt.totalScore))}>{attempt.totalScore}</span>
                {i > 0 && <Delta value={attempt.totalScore - history[i - 1].totalScore} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---------- Job coverage ---------- */}
      {report.jdMatch && (
        <section className="break-inside-avoid">
          <SectionTitle title={`Job requirements covered: ${report.jdMatch.coverageScore}/100`} hint={plain(report.jdMatch.comment)} />
          <div className="grid gap-5 sm:grid-cols-2 print:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-success">Proven in this interview</p>
              <ul className="space-y-1.5 text-sm text-text-secondary">
                {report.jdMatch.gapsAddressed.map((item, i) => <li key={i}>{plain(item)}</li>)}
              </ul>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-warning">Still unproven - prepare a story</p>
              <ul className="space-y-1.5 text-sm text-text-secondary">
                {report.jdMatch.gapsRemaining.map((item, i) => <li key={i}>{plain(item)}</li>)}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Rehearsal sheet ---------- */}
      {questions.length > 0 && (
        <section className="print:break-before-page">
          <SectionTitle
            title="Rehearsal sheet"
            hint="Weakest answers first. Read each strong version out loud until it sounds like you."
          />
          <div className="flex flex-col gap-4">
            {questions.map((item) => (
              <article key={item.number} className="rounded-2xl border border-border bg-card p-6 break-inside-avoid print:p-4">
                <div className="flex items-start justify-between gap-4">
                  <p className="font-medium text-foreground">
                    <span className="mr-2 text-highlight">Q{item.number}</span>
                    {plain(item.question)}
                  </p>
                  <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold text-white', scoreBar(item.score))}>
                    {item.score}
                  </span>
                </div>
                <dl className="mt-4 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[7rem_1fr] print:grid-cols-[6rem_1fr]">
                  <dt className="font-medium text-muted-foreground">You said</dt>
                  <dd className="text-text-secondary">{plain(item.answerSummary)}</dd>
                  <dt className="font-medium text-muted-foreground">Feedback</dt>
                  <dd className="text-text-secondary">{plain(item.feedback)}</dd>
                </dl>
                <div className="mt-4 rounded-r-xl border-l-4 border-success bg-success-soft px-4 py-3">
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-success">Say it like this</p>
                  <p className="text-sm text-foreground">{plain(item.idealAnswer)}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ReportPlaybook;
