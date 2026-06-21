"use client";

import { Check } from "lucide-react";
import { setupSteps } from "@/lib/guidance";
import type { InvestigationResult } from "@/lib/types/investigation";

export function CaseSpine({
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
  const steps = setupSteps({ documentCount, ticketText });
  const showInvestigation = Boolean(result) || isInvestigating;

  return (
    <div className="surface p-4">
      <p className="eyebrow">{showInvestigation ? "Investigation" : "Setup"}</p>
      <ol className="mt-3 grid gap-2">
        {steps.map((step) => (
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
              {step.state === "done" ? <Check className="h-3 w-3" /> : null}
            </span>
            <span
              className={`text-sm ${step.state === "active" ? "font-semibold text-graphite" : "text-zinc-500"}`}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
