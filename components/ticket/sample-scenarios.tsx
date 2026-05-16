"use client";

import { ChevronDown, FlaskConical } from "lucide-react";
import type { DemoScenario } from "@/components/SupportCopilotShell";
import { Badge } from "@/components/ui/badge";

export function SampleScenarios({
  demoScenarios,
  onLoadScenario,
  showDemos,
  onToggleShowDemos,
}: {
  demoScenarios: DemoScenario[];
  onLoadScenario: (scenario: DemoScenario) => void;
  showDemos: boolean;
  onToggleShowDemos: () => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white/70">
      <button
        type="button"
        onClick={onToggleShowDemos}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium text-zinc-950">Sample test cases</p>
          <p className="mt-1 text-xs leading-5 text-zinc-600">
            Run a known case against the seeded docs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500">{demoScenarios.length} cases</span>
          <ChevronDown
            className={`h-4 w-4 text-zinc-500 transition ${showDemos ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {showDemos ? (
        <div className="grid gap-2 border-t border-zinc-200 px-4 py-3">
          {demoScenarios.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => onLoadScenario(scenario)}
              className="surface-muted flex items-start justify-between gap-3 p-3 text-left transition hover:border-zinc-300"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold text-zinc-950">
                    {scenario.label ?? scenario.rawText}
                  </p>
                  <Badge variant="outline">
                    {(scenario.bucket ?? "demo").replaceAll("_", " ")}
                  </Badge>
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-600">
                  {scenario.rawText}
                </p>
              </div>
              <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
