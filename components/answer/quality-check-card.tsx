import type { InvestigationResult } from "@/lib/types/investigation";

function normalizeQualityCheck(result: InvestigationResult) {
  const quality = result.qualityCheck;

  return {
    retrieval: quality?.retrieval ?? {
      sourceCount: result.docEvidence.length + result.toolEvidence.length,
      topK: result.docEvidence.length,
      ignoredDocStatuses: [],
    },
    grounding: quality?.grounding ?? {
      totalClaims: result.customerReply.claims.length + result.internalDiagnosis.claims.length,
      supportedClaims: 0,
      weakClaims: 0,
      unsupportedClaims: 0,
      invalidCitations: 0,
    },
    readiness: quality?.readiness ?? {
      status: result.reviewStatus === "needs_human_review" ? "needs_human_review" : "ready",
      reasons: [result.routingReason],
    },
    missingInfo: quality?.missingInfo ?? {
      hasDocsGap: Boolean(result.docsGapReport),
      missingItems: result.docsGapReport?.missingInformation ?? [],
    },
  };
}

export function QualityCheckCard({
  result,
  showDebugDetails,
}: {
  result: InvestigationResult;
  showDebugDetails: boolean;
}) {
  const quality = normalizeQualityCheck(result);
  const weakOrUnsupported = quality.grounding.weakClaims + quality.grounding.unsupportedClaims;

  const stats = [
    { label: "Evidence sources", value: quality.retrieval.sourceCount, alert: false },
    { label: "Claims checked", value: quality.grounding.totalClaims, alert: false },
    { label: "Supported", value: quality.grounding.supportedClaims, alert: false },
    { label: "Weak or unsupported", value: weakOrUnsupported, alert: weakOrUnsupported > 0 },
  ];

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-4">
      <p className="eyebrow">Grounding checks</p>

      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="text-[11px] leading-4 text-zinc-500">{stat.label}</dt>
            <dd
              className={`mt-0.5 font-mono text-lg font-semibold ${
                stat.alert ? "text-ember" : "text-zinc-950"
              }`}
            >
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3">
        {quality.readiness.reasons.map((reason) => (
          <p key={reason} className="text-sm leading-6 text-zinc-600">
            {reason}
          </p>
        ))}
        {quality.missingInfo.hasDocsGap && quality.missingInfo.missingItems.length ? (
          <p className="text-sm leading-6 text-zinc-600">
            Missing info: {quality.missingInfo.missingItems.slice(0, 2).join("; ")}
          </p>
        ) : null}
      </div>

      {showDebugDetails ? (
        <details className="mt-3">
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
