"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { fadeRise, staggerParent } from "@/lib/motion";
import { isStepRevealed, pipelineStepAccent } from "@/lib/pipeline-presentation";
import type { InvestigationResult } from "@/lib/types/investigation";

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
      }, index * 300),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // Replay only when a new investigation lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.investigationId, reduce]);

  if (!steps.length) {
    return null;
  }

  return (
    <section className="surface p-5">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Pipeline</p>
        <Badge variant="outline">{steps.length} steps</Badge>
      </div>

      <motion.ol
        className="mt-4 grid gap-2"
        variants={staggerParent}
        initial="hidden"
        animate="show"
      >
        {steps.map((step, index) => {
          const accent = pipelineStepAccent(step.status);
          const revealed = isStepRevealed(index, visiblePlayhead);

          return (
            <motion.li
              key={step.id}
              variants={fadeRise}
              className={`grid grid-cols-[auto_1fr] gap-3 transition-opacity duration-300 ${
                revealed ? "opacity-100" : "opacity-40"
              }`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-semibold ${accent.ring} ${accent.surface} ${accent.text}`}
              >
                {index + 1}
              </span>

              <details className="min-w-0 rounded-lg border border-zinc-100 bg-parchment/40 px-3 py-2 open:bg-ledger">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-graphite">{step.label}</span>
                  <Badge
                    variant={
                      step.status === "complete"
                        ? "success"
                        : step.status === "blocked"
                          ? "danger"
                          : "outline"
                    }
                  >
                    {step.status}
                  </Badge>
                  <span className="block w-full text-xs leading-5 text-zinc-600">
                    {step.summary}
                  </span>
                </summary>
                <div className="mt-3 grid gap-3 border-t border-zinc-100 pt-3 lg:grid-cols-2">
                  <div>
                    <p className="eyebrow">Input sent</p>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-ledger p-3 text-xs leading-5 text-zinc-700">
                      {JSON.stringify(step.input ?? null, null, 2)}
                    </pre>
                  </div>
                  <div>
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
