import { ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InvestigationResult } from "@/lib/types/investigation";

export function PipelineTrace({ result }: { result: InvestigationResult }) {
  if (!result.pipelineTrace.length) {
    return null;
  }

  return (
    <details className="group rounded-xl border border-zinc-200/80 bg-white/80 p-4 open:bg-white">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-zinc-500" />
          <span className="eyebrow">Pipeline trace</span>
        </span>
        <span className="flex items-center gap-2">
          <Badge variant="outline">{result.pipelineTrace.length} steps</Badge>
          <span className="text-[11px] font-medium text-zinc-400 group-open:hidden">inspect</span>
        </span>
      </summary>

      <div className="mt-4 grid gap-2">
        {result.pipelineTrace.map((step, index) => (
          <details
            key={step.id}
            className="group rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3 py-2 open:bg-white"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
              <span className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-[11px] font-semibold text-zinc-500">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-950">{step.label}</span>
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
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-zinc-600">{step.summary}</span>
                </span>
              </span>
              <span className="mt-1 shrink-0 text-[11px] font-medium text-zinc-400 group-open:hidden">
                inspect
              </span>
            </summary>
            <div className="mt-3 grid gap-3 border-t border-zinc-100 pt-3 lg:grid-cols-2">
              <div>
                <p className="eyebrow">Input sent</p>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-700">
                  {JSON.stringify(step.input ?? null, null, 2)}
                </pre>
              </div>
              <div>
                <p className="eyebrow">Output returned</p>
                <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-700">
                  {JSON.stringify(step.output ?? null, null, 2)}
                </pre>
              </div>
            </div>
          </details>
        ))}
      </div>
    </details>
  );
}
