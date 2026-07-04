"use client";

import { Check, Loader2 } from "lucide-react";
import { resolveNextAction, setupSteps } from "@/lib/guidance";
import type { InvestigationResult } from "@/lib/types/investigation";

export function CaseProgress({
  documentCount,
  ticketText,
  result,
  isInvestigating,
}: {
  documentCount: number;
  ticketText: string;
  result: InvestigationResult | null;
  isInvestigating: boolean;
}) {
  const guidanceInput = {
    documentCount,
    ticketText,
    isInvestigating,
    hasResult: Boolean(result),
  };
  const steps = setupSteps(guidanceInput);
  const next = resolveNextAction(guidanceInput);

  return (
    <div className="surface p-4">
      <p className="eyebrow">Case progress</p>
      <ol className="mt-3 grid gap-2">
        {steps.map((step) => {
          const isRunning = isInvestigating && step.stage === "review";

          return (
            <li key={step.stage} className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
                  step.state === "done"
                    ? "border-sage/30 bg-sage/10 text-sage"
                    : step.state === "active"
                      ? "border-signal/40 bg-signal/10 text-signal"
                      : "border-zinc-200 bg-parchment/40 text-zinc-400"
                }`}
              >
                {step.state === "done" ? (
                  <Check className="h-3 w-3" />
                ) : isRunning && step.state === "active" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : null}
              </span>
              <span
                className={`text-sm ${step.state === "active" ? "font-semibold text-graphite" : "text-zinc-500"}`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 border-t border-zinc-100 pt-3">
        <p className="text-sm font-semibold text-graphite">{next.label}</p>
        <p className="mt-1 text-xs leading-5 text-zinc-600">{next.hint}</p>
      </div>
    </div>
  );
}
