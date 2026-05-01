import type { SupportLevel } from "@/lib/types";
import type { CitationId, InvestigationResultV2, StructuredClaimV2 } from "@/lib/types/investigation-v2";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  MessageSquareText,
  RotateCcw,
  Stethoscope
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getReviewAction } from "@/lib/review-actions";

const supportVariant: Record<SupportLevel, "success" | "warn" | "danger"> = {
  high: "success",
  medium: "warn",
  low: "warn",
  insufficient_support: "danger"
};

const supportLabel: Record<SupportLevel, string> = {
  high: "High support",
  medium: "Medium support",
  low: "Low support",
  insufficient_support: "Insufficient support"
};

function findSource(result: InvestigationResultV2, citation: string) {
  return result.docEvidence.find((item) => item.id === citation) ?? result.toolEvidence.find((item) => item.id === citation);
}

function getSourceTitle(result: InvestigationResultV2, citation: string) {
  const source = findSource(result, citation);

  if (!source) {
    return "Missing source";
  }

  if (source.sourceType === "doc") {
    return source.sectionTitle ? `${source.filename} · ${source.sectionTitle}` : source.filename;
  }

  return `${source.toolName} · ${source.title}`;
}

function getSourceExcerpt(result: InvestigationResultV2, citation: string) {
  const source = findSource(result, citation);

  if (!source) {
    return null;
  }

  return source.sourceType === "doc" ? source.excerpt : source.excerpt;
}

function collectCitations(claims: StructuredClaimV2[]) {
  return Array.from(new Set(claims.flatMap((claim) => claim.citations)));
}

function SourceLedger({
  result,
  showDebugDetails
}: {
  result: InvestigationResultV2;
  showDebugDetails: boolean;
}) {
  const citations = collectCitations([...result.customerReply.claims, ...result.internalDiagnosis.claims]);

  if (!citations.length) {
    return null;
  }

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Sources used</p>
        <Badge variant="outline">
          {citations.length} source{citations.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <div className="mt-4 grid gap-2">
        {citations.map((citation) => {
          const source = findSource(result, citation);
          const title = getSourceTitle(result, citation);
          const excerpt = getSourceExcerpt(result, citation);

          return (
            <details
              key={citation}
              className="group rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3 py-2 open:bg-white"
              open={showDebugDetails || undefined}
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <span className="flex min-w-0 items-start gap-2">
                  <Badge variant={citation.startsWith("S") ? "outline" : "warn"} className="mt-0.5 shrink-0">
                    {citation}
                  </Badge>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-zinc-900">{title}</span>
                    {source?.sourceType === "doc" ? (
                      <span className="mt-0.5 block text-[11px] text-zinc-500">{Math.round(source.score * 100)}% retrieval match</span>
                    ) : null}
                  </span>
                </span>
                <span className="mt-1 shrink-0 text-[11px] font-medium text-zinc-400 group-open:hidden">open</span>
              </summary>
              {excerpt ? (
                <p className="mt-2 line-clamp-4 border-t border-zinc-100 pt-2 text-xs leading-5 text-zinc-600">{excerpt}</p>
              ) : (
                <p className="mt-2 border-t border-zinc-100 pt-2 text-xs leading-5 text-zinc-500">No source content was returned.</p>
              )}
            </details>
          );
        })}
      </div>
    </section>
  );
}

function AnswerSection({
  claims,
  emptyMessage
}: {
  claims: StructuredClaimV2[];
  emptyMessage: string;
}) {
  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-zinc-500" />
          <p className="eyebrow">Answer</p>
        </div>
        <Badge variant="outline">
          {claims.length} claim{claims.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {claims.length ? (
        <div className="mt-4 space-y-4">
          <div className="space-y-3 rounded-lg bg-zinc-50/70 p-4">
            {claims.map((claim, index) => (
              <p key={`${claim.text}-${index}`} className="text-[15px] leading-7 text-zinc-900">
                {claim.text}{" "}
                <span className="whitespace-nowrap text-xs font-semibold text-zinc-500">
                  {claim.citations.map((citation) => `[${citation}]`).join(" ")}
                </span>
              </p>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-zinc-200 bg-zinc-50/70 p-4 text-sm text-zinc-500">{emptyMessage}</div>
      )}
    </section>
  );
}

function InternalFindings({
  claims,
  emptyMessage
}: {
  claims: StructuredClaimV2[];
  emptyMessage: string;
}) {
  if (!claims.length) {
    return null;
  }

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-zinc-500" />
          <p className="eyebrow">Why this answer</p>
        </div>
        <Badge variant="outline">
          {claims.length} note{claims.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="mt-4 divide-y divide-zinc-100 rounded-lg border border-zinc-100 bg-zinc-50/50">
        {claims.map((claim, index) => (
          <div key={`${claim.text}-${index}`} className="grid gap-3 p-4 lg:grid-cols-[1fr_180px]">
            <p className="text-sm leading-6 text-zinc-800">{claim.text}</p>
            <div className="flex flex-wrap content-start gap-1.5 lg:justify-end">
              {claim.citations.map((citation) => (
                <Badge key={`${claim.text}-${citation}`} variant={citation.startsWith("S") ? "outline" : "warn"}>
                  {citation}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="sr-only">{emptyMessage}</p>
    </section>
  );
}

export function AnswerPanel({
  isInvestigating,
  investigationContext,
  isReviewAcknowledged,
  isReviewRetryActive,
  onMarkReviewed,
  onRetryWithContext,
  result,
  ticket,
  showDebugDetails
}: {
  isInvestigating: boolean;
  investigationContext: string;
  isReviewAcknowledged: boolean;
  isReviewRetryActive: boolean;
  onMarkReviewed: () => void;
  onRetryWithContext: () => void;
  result: InvestigationResultV2 | null;
  ticket: string;
  showDebugDetails: boolean;
}) {
  if (isInvestigating) {
    return (
      <Card className="surface-shell">
        <CardContent className="flex min-h-[260px] items-center justify-center p-8 text-center">
          <div className="max-w-lg">
            <p className="eyebrow">Investigation running</p>
            <h2 className="mt-3 text-2xl font-semibold text-zinc-950">Retrieving evidence and assembling claims...</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Routing, retrieval, and any required context analysis are being assembled before the final structured answer renders.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className="surface-shell">
        <CardContent className="p-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">Investigation synthesis</p>
            <h2 className="mt-3 text-2xl font-semibold text-zinc-950">Grounded answer output appears here.</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              This center canvas stays quiet until an investigation runs so you can clearly inspect routing, evidence, and fallback behavior.
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="surface-muted p-4 text-left">
              <p className="eyebrow">1 · Ingest</p>
              <p className="mt-2 text-xs leading-5 text-zinc-700">Upload a corpus or load a canonical demo.</p>
            </div>
            <div className="surface-muted p-4 text-left">
              <p className="eyebrow">2 · Investigate</p>
              <p className="mt-2 text-xs leading-5 text-zinc-700">Run retrieval with context only when needed.</p>
            </div>
            <div className="surface-muted p-4 text-left">
              <p className="eyebrow">3 · Validate</p>
              <p className="mt-2 text-xs leading-5 text-zinc-700">Inspect citations and human-review fallback.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const reviewAction = getReviewAction(result);
  const showOpenQuestions = result.internalDiagnosis.openQuestions.length > 0;
  const showRoutingReason = showDebugDetails || result.reviewStatus === "needs_human_review";

  return (
    <div className="space-y-4">
      <Card className="surface-shell overflow-hidden">
        <CardHeader className="border-b border-zinc-100 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Case brief</p>
              <CardTitle className="mt-2 text-2xl tracking-[-0.04em]">
                {result.reviewStatus === "needs_human_review" ? "Review needed before replying" : "Answer ready"}
              </CardTitle>
              {showRoutingReason ? (
                <CardDescription className="mt-2 max-w-2xl text-sm leading-6">{result.routingReason}</CardDescription>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={supportVariant[result.supportLevel]}>{supportLabel[result.supportLevel]}</Badge>
              <Badge variant={result.reviewStatus === "needs_human_review" ? "danger" : "secondary"}>
                {isReviewAcknowledged ? "Reviewed" : result.reviewStatus === "needs_human_review" ? "Needs human review" : "Ready"}
              </Badge>
              <Badge variant="outline">{result.mode.replaceAll("_", " ")}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/70 p-3">
            <p className="eyebrow">Ticket</p>
            <p className="mt-2 text-sm leading-6 text-zinc-700">{ticket}</p>
          </div>

          {showDebugDetails && investigationContext.trim() ? (
            <div className="rounded-lg border border-amber-200/80 bg-amber-50/70 p-3">
              <p className="eyebrow">Provided context</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{investigationContext}</p>
            </div>
          ) : null}

          <AnswerSection
            claims={result.customerReply.claims}
            emptyMessage="No grounded answer was produced for this run."
          />

          <InternalFindings
            claims={result.internalDiagnosis.claims}
            emptyMessage="No grounded internal diagnosis claims were produced for this run."
          />

          <SourceLedger result={result} showDebugDetails={showDebugDetails} />
        </CardContent>
      </Card>

      {reviewAction ? (
        <Card className={isReviewAcknowledged ? "border-emerald-200 bg-emerald-50/80" : "border-red-200 bg-red-50/80"}>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 gap-3">
                <div
                  className={
                    isReviewAcknowledged
                      ? "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700"
                      : "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700"
                  }
                >
                  {isReviewAcknowledged ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="eyebrow">
                      {isReviewAcknowledged ? "Review acknowledged" : isReviewRetryActive ? "Retry staged" : "Human-review queue"}
                    </p>
                    <Badge variant={isReviewAcknowledged ? "success" : "danger"}>
                      {isReviewAcknowledged ? "Marked reviewed" : isReviewRetryActive ? "Awaiting rerun" : "Reply blocked"}
                    </Badge>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-zinc-950">{reviewAction.title}</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-700">{reviewAction.description}</p>
                  {result.internalDiagnosis.openQuestions.length ? (
                    <div className="mt-3 grid gap-2">
                      {result.internalDiagnosis.openQuestions.slice(0, 2).map((question) => (
                        <div key={question} className="rounded-lg border border-white/80 bg-white/65 px-3 py-2 text-sm leading-6 text-zinc-700">
                          {question}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                <Button type="button" variant="outline" onClick={onRetryWithContext}>
                  <RotateCcw className="h-4 w-4" />
                  {isReviewRetryActive ? "Retry staged" : reviewAction.primaryActionLabel}
                </Button>
                <Button type="button" variant={isReviewAcknowledged ? "secondary" : "default"} onClick={onMarkReviewed}>
                  <ClipboardCheck className="h-4 w-4" />
                  {isReviewAcknowledged ? "Reviewed" : "Mark reviewed"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showOpenQuestions ? (
        <Card className="surface-shell">
          <CardHeader className="pb-4">
            <div>
              <p className="eyebrow">Open questions</p>
              <CardDescription className="mt-2 text-sm leading-6">
                These remain unresolved after the current docs and tool calls.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.internalDiagnosis.openQuestions.map((question) => (
              <div key={question} className="surface-muted p-4 text-sm leading-6 text-zinc-700">
                {question}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
