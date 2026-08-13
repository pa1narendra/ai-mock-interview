import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { scoreTone } from "@/lib/utils";

const CATEGORIES = [
  "Communication Skills",
  "Technical Knowledge",
  "Problem Solving",
  "Cultural Fit",
  "Confidence and Clarity",
] as const;

function delta(points: ScorePoint[], pick: (p: ScorePoint) => number) {
  if (points.length < 2) return 0;
  return Math.round(pick(points[points.length - 1]) - pick(points[0]));
}

const DeltaBadge = ({ value }: { value: number }) => {
  if (value > 0)
    return <span className="flex items-center gap-0.5 text-xs font-semibold text-success"><TrendingUp className="size-3" />+{value}</span>;
  if (value < 0)
    return <span className="flex items-center gap-0.5 text-xs font-semibold text-danger"><TrendingDown className="size-3" />{value}</span>;
  return <span className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground"><Minus className="size-3" />0</span>;
};

// Dependency-free inline SVG line of overall score over time.
const Sparkline = ({ values }: { values: number[] }) => {
  const w = 600;
  const h = 120;
  const pad = 8;
  const n = values.length;
  const x = (i: number) => (n === 1 ? w / 2 : pad + (i * (w - 2 * pad)) / (n - 1));
  const y = (v: number) => h - pad - (Math.max(0, Math.min(100, v)) / 100) * (h - 2 * pad);
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L ${x(n - 1).toFixed(1)} ${h - pad} L ${x(0).toFixed(1)} ${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full text-primary" preserveAspectRatio="none" role="img" aria-label="Overall score over time">
      <path d={area} fill="currentColor" fillOpacity="0.06" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="currentColor" />
      ))}
    </svg>
  );
};

const ScoreTrends = ({ points }: { points: ScorePoint[] }) => {
  if (points.length < 2) return null;

  const latest = points[points.length - 1];

  return (
    <section className="panel flex flex-col gap-6 px-8 py-6 fade-up">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl">Your progress</h2>
        <span className="text-sm text-mist-500">{points.length} interviews scored</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-sm text-mist-500">Overall score</span>
          <span className={`font-display text-2xl font-bold ${scoreTone(latest.totalScore)}`}>{latest.totalScore}</span>
          <DeltaBadge value={delta(points, (p) => p.totalScore)} />
        </div>
        <Sparkline values={points.map((p) => p.totalScore)} />
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 max-sm:grid-cols-1">
        {CATEGORIES.map((name) => {
          const score = (p: ScorePoint) => p.categoryScores.find((c) => c.name === name)?.score ?? 0;
          const current = score(latest);
          return (
            <div key={name} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-mist-300">{name}</span>
              <span className="flex items-center gap-2">
                <span className={`font-medium ${scoreTone(current)}`}>{current}</span>
                <DeltaBadge value={delta(points, score)} />
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ScoreTrends;
