"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { fadeRise, staggerParent } from "@/lib/motion";
import { isStepRevealed, pipelineStepAccent } from "@/lib/pipeline-presentation";
import type { InvestigationResult } from "@/lib/types/investigation";

const statusDot: Record<string, string> = {
  complete: "bg-sage",
  blocked: "bg-ember",
  skipped: "bg-zinc-300",
};

export function PipelineTimeline({ result }: { result: InvestigationResult }) {
  const reduce = useReducedMotion();
  const steps = result.pipelineTrace;
  const [playhead, setPlayhead] = useState(0);
  const visiblePlayhead = reduce ? steps.length : playhead;

  useEffect(() => {
    if (reduce) {
      return;
    }
    setPlayhead(0);
    const timers = steps.map((_, index) =>
      window.setTimeout(() => {
        setPlayhead((current) => Math.max(current, index + 1));
      }, index * 220),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // Replay only when a new investigation lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.investigationId, reduce]);

  if (!steps.length) {
    return null;
  }

  return (
    <section className="surface p-4">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Audit trail</p>
        <span className="font-mono text-[11px] text-zinc-400">{steps.length} steps</span>
      </div>

      <motion.ol
        className="mt-3"
        variants={staggerParent}
        initial={reduce ? false : "hidden"}
        animate="show"
      >
        {steps.map((step, index) => {
          const accent = pipelineStepAccent(step.status);
          const revealed = isStepRevealed(index, visiblePlayhead);
          const isLast = index === steps.length - 1;

          return (
            <motion.li
              key={step.id}
              variants={fadeRise}
              className={`grid grid-cols-[14px_1fr] gap-x-3 transition-opacity duration-300 ${
                revealed ? "opacity-100" : "opacity-40"
              }`}
            >
              <span className="flex flex-col items-center" aria-hidden>
                <span
                  className={`mt-2 h-2 w-2 shrink-0 rounded-full ${statusDot[step.status] ?? "bg-signal"}`}
                />
                {!isLast ? <span className="w-px flex-1 bg-zinc-200" /> : null}
              </span>

              <details className={`group min-w-0 ${isLast ? "pb-0" : "pb-2.5"}`}>
                <summary className="flex cursor-pointer list-none items-baseline gap-2 rounded-md px-1 py-0.5 -mx-1 hover:bg-parchment/60">
                  <span className="text-sm font-medium text-graphite">{step.label}</span>
                  {step.status !== "complete" ? (
                    <span
                      className={`text-[11px] font-medium uppercase tracking-[0.08em] ${accent.text}`}
                    >
                      {step.status}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 truncate text-xs leading-5 text-zinc-500">
                    {step.summary}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 self-center text-zinc-400 transition group-open:rotate-180" />
                </summary>
                <div className="mb-2 mt-2 grid gap-3 rounded-lg border border-zinc-100 bg-parchment/40 p-3 lg:grid-cols-2">
                  <div className="min-w-0">
                    <p className="eyebrow">Input sent</p>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-ledger p-3 text-xs leading-5 text-zinc-700">
                      {JSON.stringify(step.input ?? null, null, 2)}
                    </pre>
                  </div>
                  <div className="min-w-0">
                    <p className="eyebrow">Output returned</p>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-ledger p-3 text-xs leading-5 text-zinc-700">
                      {JSON.stringify(step.output ?? null, null, 2)}
                    </pre>
                  </div>
                </div>
              </details>
            </motion.li>
          );
        })}
      </motion.ol>
    </section>
  );
}
