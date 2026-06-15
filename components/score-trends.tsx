import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const scoreTone = (score: number) =>
  score >= 75 ? "text-spark-400" : score >= 50 ? "text-ember-400" : "text-alert-400";

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
    return <span className="flex items-center gap-0.5 text-xs font-semibold text-spark-400"><TrendingUp className="size-3" />+{value}</span>;
  if (value < 0)
    return <span className="flex items-center gap-0.5 text-xs font-semibold text-alert-400"><TrendingDown className="size-3" />{value}</span>;
  return <span className="flex items-center gap-0.5 text-xs font-semibold text-mist-500"><Minus className="size-3" />0</span>;
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
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" role="img" aria-label="Overall score over time">
      <defs>
        <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#trend-fill)" />
      <path d={line} fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="#5eead4" />
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
