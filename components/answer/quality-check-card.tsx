import { Badge } from "@/components/ui/badge";
import type { InvestigationResult } from "@/lib/types/investigation";

const readinessVariant = {
  ready: "success",
  needs_human_review: "danger",
  blocked: "danger",
} as const;

const readinessLabel = {
  ready: "Ready",
  needs_human_review: "Needs human review",
  blocked: "Blocked",
} as const;

export function QualityCheckCard({
  result,
  showDebugDetails,
}: {
  result: InvestigationResult;
  showDebugDetails: boolean;
}) {
  const quality = result.qualityCheck;

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Answer quality</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Grounding and review checks for this investigation run.
          </p>
        </div>
        <Badge variant={readinessVariant[quality.readiness.status]}>
          {readinessLabel[quality.readiness.status]}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="surface-muted p-3">
          <p className="eyebrow">Evidence</p>
          <p className="mt-2 text-xl font-semibold text-zinc-950">
            {quality.retrieval.sourceCount}
          </p>
        </div>
        <div className="surface-muted p-3">
          <p className="eyebrow">Claims checked</p>
          <p className="mt-2 text-xl font-semibold text-zinc-950">
            {quality.grounding.totalClaims}
          </p>
        </div>
        <div className="surface-muted p-3">
          <p className="eyebrow">Supported</p>
          <p className="mt-2 text-xl font-semibold text-zinc-950">
            {quality.grounding.supportedClaims}
          </p>
        </div>
        <div className="surface-muted p-3">
          <p className="eyebrow">Weak/unsupported</p>
          <p className="mt-2 text-xl font-semibold text-zinc-950">
            {quality.grounding.weakClaims + quality.grounding.unsupportedClaims}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {quality.readiness.reasons.map((reason) => (
          <p key={reason} className="text-sm leading-6 text-zinc-700">
            {reason}
          </p>
        ))}
        {quality.missingInfo.hasDocsGap && quality.missingInfo.missingItems.length ? (
          <p className="text-sm leading-6 text-zinc-700">
            Missing info: {quality.missingInfo.missingItems.slice(0, 2).join("; ")}
          </p>
        ) : null}
      </div>

      {showDebugDetails ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
            Grounding details
          </summary>
          <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-xs leading-6 text-zinc-700">
            {JSON.stringify(quality, null, 2)}
          </pre>
        </details>
      ) : null}
    </section>
  );
}
