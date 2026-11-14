'use client'

import dynamic from 'next/dynamic';
import { CheckCircle2, Loader2, Play, Send, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ProblemSpec } from '@/lib/problems';
import type { RunOutcome } from '@/lib/runner';

// The editor (CodeMirror + one language pack) is only downloaded for DSA rounds.
const CodeEditor = dynamic(() => import('@/components/code-editor'), {
  ssr: false,
  loading: () => <div className="min-h-[360px] animate-pulse rounded-xl border border-border bg-surface-raised" />,
});

export type RunKind = 'examples' | 'all';
export interface RunView {
  kind: RunKind;
  outcome: RunOutcome;
}

const show = (value: unknown) => {
  const text = JSON.stringify(value);
  return text === undefined ? 'undefined' : text.length > 200 ? `${text.slice(0, 200)}...` : text;
};

interface CodingWorkspaceProps {
  language: string;
  languageLabel: string;
  problemNumber: number; // 0 = no problem presented yet
  spec: ProblemSpec | null;
  code: string;
  onChange: (value: string) => void;
  runnable: boolean;
  running: RunKind | null;
  lastRun: RunView | null;
  onRun: (kind: RunKind) => void;
  pythonLoading: boolean;
}

const CodingWorkspace = ({
  language,
  languageLabel,
  problemNumber,
  spec,
  code,
  onChange,
  runnable,
  running,
  lastRun,
  onRun,
  pythonLoading,
}: CodingWorkspaceProps) => {
  const canRun = runnable && spec !== null && problemNumber > 0;
  const results = lastRun?.outcome.results ?? [];
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="field-label">
          {problemNumber > 0 ? `Problem ${problemNumber} · ` : ''}
          {languageLabel}
        </span>
        {canRun && (
          <div className="flex gap-2">
            <button type="button" className="btn-outline px-3 py-1.5 text-sm" disabled={running !== null} onClick={() => onRun('examples')}>
              {running === 'examples' ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} Run
            </button>
            <button type="button" className="btn-spark px-3 py-1.5 text-sm" disabled={running !== null} onClick={() => onRun('all')}>
              {running === 'all' ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit
            </button>
          </div>
        )}
      </div>

      <CodeEditor language={language} value={code} onChange={onChange} readOnly={problemNumber === 0} />

      {running && pythonLoading && (
        <p className="text-xs text-muted-foreground">Loading Python in your browser - only the first run takes a few seconds.</p>
      )}

      {lastRun && !running && (
        <div className="rounded-xl border border-border bg-surface-raised p-3 text-sm" role="status" aria-live="polite">
          {lastRun.outcome.problem ? (
            <p className="flex items-start gap-2 text-danger">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              <span className="whitespace-pre-wrap break-words">{lastRun.outcome.problem}</span>
            </p>
          ) : (
            <>
              <p className={cn('mb-2 flex items-center gap-2 font-semibold', passed === total ? 'text-success' : 'text-warning')}>
                {passed === total ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
                {lastRun.kind === 'all' ? 'All tests' : 'Examples'}: {passed}/{total} passed
                {lastRun.kind === 'examples' && passed === total ? ' - Submit to check the hidden tests' : ''}
              </p>
              <ul className="flex max-h-72 list-none flex-col gap-2 overflow-y-auto pl-0">
                {results.map((r, i) => {
                  // Passing hidden tests aren't listed one by one - only the failures teach anything.
                  const hidden = lastRun.kind === 'all' && spec && i >= spec.examples.length;
                  if (hidden && r.passed) return null;
                  return (
                    <li key={i} className="rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs">
                      <p className={cn('mb-1 font-sans font-semibold', r.passed ? 'text-success' : 'text-danger')}>
                        {hidden ? `Hidden test ${i + 1 - spec.examples.length}` : `Example ${i + 1}`}: {r.passed ? 'passed' : 'failed'}
                      </p>
                      {!r.passed && (
                        <div className="space-y-0.5 break-all text-text-secondary">
                          <p>input: {spec ? spec.params.map((p, j) => `${p} = ${show(r.test.args[j])}`).join(', ') : show(r.test.args)}</p>
                          <p>expected: {show(r.test.expected)}</p>
                          {r.error ? <p className="text-danger">error: {r.error}</p> : <p>got: {show(r.actual)}</p>}
                        </div>
                      )}
                      {r.output && <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap text-muted-foreground">{r.output}</pre>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {canRun
          ? 'Run checks the examples; Submit also checks hidden test cases. The interviewer can read your code and your latest results - keep talking through your thinking, it is scored too.'
          : 'The interviewer reads your code when they review it. Keep talking through your thinking - it is scored too. Code in this language is reviewed, not run.'}
      </p>
    </div>
  );
};

export default CodingWorkspace;
