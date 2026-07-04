import { AlertTriangle, CheckCircle2, FileSearch, ScanSearch } from "lucide-react";
import type { InvestigationResult } from "@/lib/types/investigation";
import type { SupportLevel } from "@/lib/types";

const supportLabel: Record<SupportLevel, string> = {
  high: "High support",
  medium: "Medium support",
  low: "Low support",
  insufficient_support: "Insufficient support",
};

type VerdictTone = {
  band: string;
  surface: string;
  title: string;
  icon: string;
};

const tones = {
  grounded: {
    band: "bg-sage",
    surface: "border-sage/25 bg-sage/5",
    title: "text-sage",
    icon: "text-sage",
  },
  caution: {
    band: "bg-copper",
    surface: "border-copper/25 bg-copper/5",
    title: "text-copper",
    icon: "text-copper",
  },
  review: {
    band: "bg-ember",
    surface: "border-ember/25 bg-ember/5",
    title: "text-ember",
    icon: "text-ember",
  },
} satisfies Record<string, VerdictTone>;

function resolveVerdict(result: InvestigationResult, isReviewAcknowledged: boolean) {
  if (result.executionMode === "evidence_only") {
    const sourceCount = result.docEvidence.length + result.toolEvidence.length;
    return {
      tone: tones.caution,
      Icon: FileSearch,
      title: "Evidence gathered",
      detail: `${sourceCount} source${sourceCount === 1 ? "" : "s"} retrieved. Drafting was skipped for this run.`,
    };
  }

  if (result.reviewStatus === "needs_human_review") {
    return {
      tone: isReviewAcknowledged ? tones.grounded : tones.review,
      Icon: isReviewAcknowledged ? CheckCircle2 : AlertTriangle,
      title: isReviewAcknowledged ? "Reviewed by a human" : "Needs human review",
      detail: result.routingReason,
    };
  }

  if (result.supportLevel === "high") {
    return {
      tone: tones.grounded,
      Icon: CheckCircle2,
      title: "Grounded answer ready",
      detail: result.routingReason,
    };
  }

  return {
    tone: tones.caution,
    Icon: ScanSearch,
    title: "Answer ready — verify citations",
    detail: result.routingReason,
  };
}

function ClaimMeter({ result }: { result: InvestigationResult }) {
  const grounding = result.qualityCheck?.grounding;

  if (!grounding || grounding.totalClaims === 0) {
    return null;
  }

  const segments = [
    ...Array<string>(grounding.supportedClaims).fill("bg-sage"),
    ...Array<string>(grounding.weakClaims).fill("bg-copper"),
    ...Array<string>(grounding.unsupportedClaims).fill("bg-ember"),
  ];

  while (segments.length < grounding.totalClaims) {
    segments.push("bg-zinc-200");
  }

  return (
    <div className="shrink-0 text-right">
      <p className="font-mono text-sm font-semibold text-graphite">
        {grounding.supportedClaims}/{grounding.totalClaims}
      </p>
      <p className="mt-0.5 text-[11px] leading-4 text-zinc-500">claims supported</p>
      <div className="mt-1.5 flex justify-end gap-1" aria-hidden>
        {segments.slice(0, 12).map((color, index) => (
          <span key={index} className={`h-1.5 w-4 rounded-full ${color}`} />
        ))}
      </div>
    </div>
  );
}

export function VerdictStrip({
  result,
  isReviewAcknowledged,
}: {
  result: InvestigationResult;
  isReviewAcknowledged: boolean;
}) {
  const verdict = resolveVerdict(result, isReviewAcknowledged);
  const { Icon } = verdict;

  return (
    <section className={`relative overflow-hidden rounded-xl border ${verdict.tone.surface}`}>
      <span className={`absolute inset-y-0 left-0 w-1.5 ${verdict.tone.band}`} aria-hidden />
      <div className="flex flex-wrap items-start justify-between gap-4 py-4 pl-5 pr-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${verdict.tone.icon}`} />
            <h2 className={`font-display text-2xl tracking-[-0.02em] ${verdict.tone.title}`}>
              {verdict.title}
            </h2>
          </div>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-700">{verdict.detail}</p>
          <p className="mt-1.5 text-xs text-zinc-500">
            {result.executionMode === "evidence_only"
              ? `Route: ${result.mode.replaceAll("_", " ")}`
              : `${supportLabel[result.supportLevel]} · route: ${result.mode.replaceAll("_", " ")}`}
          </p>
        </div>
        {result.executionMode !== "evidence_only" ? <ClaimMeter result={result} /> : null}
      </div>
    </section>
  );
}
