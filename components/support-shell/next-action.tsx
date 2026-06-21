"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { resolveNextAction } from "@/lib/guidance";

export function NextAction({
  documentCount,
  ticketText,
  isInvestigating,
  onRun,
}: {
  documentCount: number;
  ticketText: string;
  isInvestigating: boolean;
  onRun: () => void;
}) {
  const next = resolveNextAction({ documentCount, ticketText });
  const canRun = next.stage === "investigate" && !isInvestigating;

  return (
    <div className="surface p-4">
      <p className="eyebrow">Next step</p>
      <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-graphite">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-signal/10 font-mono text-[11px] text-signal">
          {next.index}
        </span>
        {next.label}
      </p>
      <p className="mt-1 text-xs leading-5 text-zinc-600">{next.hint}</p>
      {next.stage === "investigate" ? (
        <button
          type="button"
          onClick={onRun}
          disabled={!canRun}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-graphite px-3 py-2 text-sm font-semibold text-paper transition hover:opacity-90 disabled:opacity-50"
        >
          {isInvestigating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4" />
          )}
          {isInvestigating ? "Investigating…" : "Run investigation"}
        </button>
      ) : null}
    </div>
  );
}
