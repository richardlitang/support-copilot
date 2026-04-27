import type { SupportLevel } from "@/lib/types";
import type { InvestigationResultV2, StructuredClaimV2 } from "@/lib/types/investigation-v2";
import { AlertTriangle, CheckCircle2, ClipboardCheck, RotateCcw } from "lucide-react";
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

function ClaimsSection({
  claims,
  result,
  title,
  emptyMessage,
  showDebugDetails
}: {
  claims: StructuredClaimV2[];
  result: InvestigationResultV2;
  title: string;
  emptyMessage: string;
  showDebugDetails: boolean;
}) {
  return (
    <Card className="surface-shell">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">{title}</p>
            <CardTitle className="mt-2 text-lg tracking-[-0.03em]">{title}</CardTitle>
          </div>
          <Badge variant="outline">{claims.length} claim{claims.length === 1 ? "" : "s"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {claims.length ? (
          claims.map((claim, index) => (
            <div key={`${title}-${claim.text}-${index}`} className="surface-muted p-4">
              <p className="text-sm leading-7 text-zinc-800">{claim.text}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {claim.citations.map((citation) => (
                  <Badge key={`${claim.text}-${citation}`} variant="outline">
                    {citation}
                  </Badge>
                ))}
              </div>
              {showDebugDetails ? (
                <div className="mt-4 space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
                  <p className="eyebrow">Debug sources</p>
                  {claim.citations.map((citation) => {
                    const source = findSource(result, citation);

                    return (
                      <div key={`${title}-${claim.text}-${citation}-source`} className="rounded-lg border border-zinc-200 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                            {source
                              ? source.sourceType === "doc"
                                ? `${citation} · ${source.filename} · ${source.sectionTitle ?? "General section"}`
                                : `${citation} · ${source.toolName} · ${source.title}`
                              : `${citation} · Missing source`}
                          </p>
                          {source && source.sourceType === "doc" ? (
                            <Badge variant="secondary">{Math.round(source.score * 100)}% match</Badge>
                          ) : null}
                        </div>
                        {source ? (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-xs uppercase tracking-[0.16em] text-zinc-500">
                              View source content
                            </summary>
                            <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                              {source.sourceType === "doc" ? source.excerpt : JSON.stringify(source.raw, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="surface-muted border-dashed p-4 text-sm text-zinc-500">{emptyMessage}</div>
        )}
      </CardContent>
    </Card>
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

  return (
    <div className="space-y-4">
      <Card className="surface-shell">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Investigation synthesis</p>
              <CardTitle className="mt-2 text-[2rem] tracking-[-0.05em]">Customer reply and internal diagnosis</CardTitle>
              <CardDescription className="mt-2 max-w-2xl text-sm leading-6">
                Grounded support investigation with visible evidence, explicit routing, and a separate internal diagnosis.
              </CardDescription>
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
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className={`surface-muted p-4 ${investigationContext.trim() ? "" : "md:col-span-1"}`}>
            <p className="eyebrow">Ticket</p>
            <p className="mt-3 text-sm leading-6 text-zinc-700">{ticket}</p>
          </div>
          {investigationContext.trim() ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
              <p className="eyebrow">Provided context</p>
              <p className="mt-3 text-sm leading-6 text-zinc-700">{investigationContext}</p>
            </div>
          ) : null}
          <div className="surface-muted p-4">
            <p className="eyebrow">Routing reason</p>
            <p className="mt-3 text-sm leading-6 text-zinc-700">{result.routingReason}</p>
          </div>
          <div className="surface-muted p-4">
            <p className="eyebrow">Evidence mix</p>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              {result.docEvidence.length} doc source{result.docEvidence.length === 1 ? "" : "s"} and {result.toolEvidence.length} tool
              source{result.toolEvidence.length === 1 ? "" : "s"} contributed to this run.
            </p>
          </div>
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

      <ClaimsSection
        title="Customer-facing draft"
        claims={result.customerReply.claims}
        result={result}
        emptyMessage="No grounded customer-facing draft was produced for this run."
        showDebugDetails={showDebugDetails}
      />

      <ClaimsSection
        title="Internal diagnosis"
        claims={result.internalDiagnosis.claims}
        result={result}
        emptyMessage="No grounded internal diagnosis claims were produced for this run."
        showDebugDetails={showDebugDetails}
      />

      <Card className="surface-shell">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">Open questions</p>
              <CardDescription className="mt-2 text-sm leading-6">
                {result.internalDiagnosis.openQuestions.length
                  ? "These remain unresolved after the current docs and tool calls."
                  : "No unresolved questions were recorded for this run."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.internalDiagnosis.openQuestions.length ? (
            result.internalDiagnosis.openQuestions.map((question) => (
              <div key={question} className="surface-muted p-4 text-sm leading-6 text-zinc-700">
                {question}
              </div>
            ))
          ) : (
            <div className="surface-muted p-4 text-sm leading-6 text-zinc-500">
              The current evidence set closed without open investigative gaps.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
