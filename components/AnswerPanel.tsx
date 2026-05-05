import type { SupportLevel } from "@/lib/types";
import type { CitationId, InvestigationResult, StructuredClaim } from "@/lib/types/investigation";
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

function findSource(result: InvestigationResult, citation: string) {
  return result.docEvidence.find((item) => item.id === citation) ?? result.toolEvidence.find((item) => item.id === citation);
}

function getSourceTitle(result: InvestigationResult, citation: string) {
  const source = findSource(result, citation);

  if (!source) {
    return "Missing source";
  }

  if (source.sourceType === "doc") {
    return source.sectionTitle ? `${source.filename} · ${source.sectionTitle}` : source.filename;
  }

  return `${source.toolName} · ${source.title}`;
}

function getSourceExcerpt(result: InvestigationResult, citation: string) {
  const source = findSource(result, citation);

  if (!source) {
    return null;
  }

  return source.sourceType === "doc" ? source.excerpt : source.excerpt;
}

function collectCitations(claims: StructuredClaim[]) {
  return Array.from(new Set(claims.flatMap((claim) => claim.citations)));
}

function normalizeClaimText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getDistinctInternalClaims(customerClaims: StructuredClaim[], internalClaims: StructuredClaim[]) {
  const customerTexts = new Set(customerClaims.map((claim) => normalizeClaimText(claim.text)));
  const customerTokenSets = customerClaims.map((claim) => new Set(normalizeClaimText(claim.text).split(" ").filter(Boolean)));

  return internalClaims.filter((claim) => {
    const normalized = normalizeClaimText(claim.text);

    if (customerTexts.has(normalized)) {
      return false;
    }

    const tokens = normalized.split(" ").filter(Boolean);
    if (tokens.length < 5) {
      return true;
    }

    return !customerTokenSets.some((customerTokens) => {
      const overlap = tokens.filter((token) => customerTokens.has(token)).length;
      return overlap / tokens.length >= 0.82;
    });
  });
}

function CitationMarker({
  citation,
  result
}: {
  citation: CitationId;
  result: InvestigationResult;
}) {
  const source = findSource(result, citation);
  const title = getSourceTitle(result, citation);
  const excerpt = getSourceExcerpt(result, citation);

  return (
    <span className="group/source relative inline-flex align-baseline">
      <button
        type="button"
        className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold leading-none transition focus:outline-none focus:ring-2 focus:ring-zinc-300 ${
          citation.startsWith("S")
            ? "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
            : "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300"
        }`}
        aria-label={`Show source ${citation}`}
      >
        {citation}
      </button>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-[min(340px,calc(100vw-48px))] -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-xl group-hover/source:block group-focus-within/source:block">
        <span className="flex items-center gap-2">
          <Badge variant={citation.startsWith("S") ? "outline" : "warn"}>{citation}</Badge>
          {source?.sourceType === "doc" ? (
            <span className="text-[11px] font-medium text-zinc-500">{Math.round(source.score * 100)}% match</span>
          ) : null}
        </span>
        <span className="mt-2 block text-xs font-semibold leading-5 text-zinc-950">{title}</span>
        {excerpt ? <span className="mt-1.5 line-clamp-5 block text-xs leading-5 text-zinc-600">{excerpt}</span> : null}
      </span>
    </span>
  );
}

function SourceLedger({
  result,
  showDebugDetails
}: {
  result: InvestigationResult;
  showDebugDetails: boolean;
}) {
  const citations = collectCitations([...result.customerReply.claims, ...result.internalDiagnosis.claims]);

  if (!showDebugDetails || !citations.length) {
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
  emptyMessage,
  result
}: {
  claims: StructuredClaim[];
  emptyMessage: string;
  result: InvestigationResult;
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
                <span className="inline-flex flex-wrap gap-1 align-baseline">
                  {claim.citations.map((citation) => (
                    <CitationMarker key={`${claim.text}-${citation}`} citation={citation} result={result} />
                  ))}
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
  claims: StructuredClaim[];
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
  showDebugDetails
}: {
  isInvestigating: boolean;
  investigationContext: string;
  isReviewAcknowledged: boolean;
  isReviewRetryActive: boolean;
  onMarkReviewed: () => void;
  onRetryWithContext: () => void;
  result: InvestigationResult | null;
  showDebugDetails: boolean;
}) {
  if (isInvestigating) {
    return (
      <Card className="surface-shell">
        <CardContent className="flex min-h-[260px] items-center justify-center p-8 text-center">
          <div className="max-w-lg">
            <p className="eyebrow">Investigating</p>
            <h2 className="mt-3 text-2xl font-semibold text-zinc-950">Checking evidence...</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Support Copilot is retrieving docs, checking context, and drafting cited claims.
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
            <p className="eyebrow">Answer</p>
            <h2 className="mt-3 text-2xl font-semibold text-zinc-950">Run a ticket to see the answer.</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              The result will show the customer reply, internal findings, citations, and any review action.
            </p>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="surface-muted p-4 text-left">
              <p className="eyebrow">1 · Ingest</p>
              <p className="mt-2 text-xs leading-5 text-zinc-700">Add focused docs.</p>
            </div>
            <div className="surface-muted p-4 text-left">
              <p className="eyebrow">2 · Investigate</p>
              <p className="mt-2 text-xs leading-5 text-zinc-700">Paste the ticket and run it.</p>
            </div>
            <div className="surface-muted p-4 text-left">
              <p className="eyebrow">3 · Validate</p>
              <p className="mt-2 text-xs leading-5 text-zinc-700">Check citations before replying.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const reviewAction = getReviewAction(result);
  const showOpenQuestions = result.internalDiagnosis.openQuestions.length > 0;
  const showRoutingReason = showDebugDetails || result.reviewStatus === "needs_human_review";
  const distinctInternalClaims = getDistinctInternalClaims(result.customerReply.claims, result.internalDiagnosis.claims);

  return (
    <div className="space-y-4">
      <Card className="surface-shell">
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
          {showDebugDetails && investigationContext.trim() ? (
            <div className="rounded-lg border border-amber-200/80 bg-amber-50/70 p-3">
              <p className="eyebrow">Provided context</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{investigationContext}</p>
            </div>
          ) : null}

          <AnswerSection
            claims={result.customerReply.claims}
            emptyMessage="No grounded answer was produced for this run."
            result={result}
          />

          <InternalFindings
            claims={distinctInternalClaims}
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
