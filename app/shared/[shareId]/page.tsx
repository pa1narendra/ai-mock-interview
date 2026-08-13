import type { Metadata } from "next";
import Link from "next/link";
import dayjs from "dayjs";
import { notFound } from "next/navigation";
import Logo from "@/components/logo";
import { getSharedReport } from "@/lib/actions/reports";

export const metadata: Metadata = {
  title: "Shared interview report",
  robots: { index: false },
};

const scoreTone = (score: number) =>
  score >= 75 ? "text-success" : score >= 50 ? "text-warning" : score >= 25 ? "text-danger" : "text-worst";
const barTone = (score: number) =>
  score >= 75 ? "bg-success" : score >= 50 ? "bg-warning" : score >= 25 ? "bg-danger" : "bg-worst";

const Page = async ({ params }: RouteParams) => {
  const { shareId } = await params;
  const report = await getSharedReport(shareId);
  if (!report) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-8 max-sm:px-4">
      <nav className="flex items-center justify-between">
        <Logo href="/" />
        <Link href="/sign-up" className="btn-spark !px-4 !py-2 text-xs">Try Mockstar</Link>
      </nav>

      <div className="text-center space-y-2 fade-up">
        <h1>
          Interview report - <span className="capitalize text-highlight">{report.role}</span>
        </h1>
        <p className="text-sm text-mist-500">{dayjs(report.createdAt).format("MMM D, YYYY")} · shared read-only</p>
      </div>

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
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${barTone(category.score)}`} style={{ width: `${Math.max(2, Math.min(100, category.score))}%` }} />
            </div>
            <p className="text-sm">{category.comment}</p>
          </div>
        ))}
      </div>

      {report.questionFeedback && report.questionFeedback.length > 0 && (
        <div className="panel flex flex-col gap-5 px-8 py-6">
          <h3>Question-by-question</h3>
          {report.questionFeedback.map((item, index) => (
            <div key={index} className="space-y-2 border-t border-border pt-4 first:border-0 first:pt-0">
              <div className="flex items-start justify-between gap-4">
                <p className="font-medium text-mist-100">{index + 1}. {item.question}</p>
                <span className={`shrink-0 font-semibold ${scoreTone(item.score)}`}>{item.score}/100</span>
              </div>
              <p className="text-sm"><span className="text-mist-500">Feedback:</span> {item.feedback}</p>
            </div>
          ))}
        </div>
      )}

      <footer className="mt-auto border-t border-border py-6 text-center text-sm text-mist-500">
        Generated with Mockstar - AI voice mock interviews
      </footer>
    </main>
  );
};

export default Page;
