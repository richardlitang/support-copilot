"use client";

import { useEffect, useState } from "react";
import type { InvestigationResult, StructuredClaim } from "@/lib/types/investigation";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  MessageSquareText,
  RotateCcw,
  Stethoscope,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { fadeRise, springSoft, staggerParent } from "@/lib/motion";
import { reviewTone } from "@/lib/review-presentation";
import { DocsGapReportCard } from "@/components/answer/docs-gap-report-card";
import { PipelineTimeline } from "@/components/answer/pipeline-timeline";
import { QualityCheckCard } from "@/components/answer/quality-check-card";
import { VerdictStrip } from "@/components/answer/verdict-strip";
import {
  CitationMarker,
  SourceLedger,
  getDistinctInternalClaims,
} from "@/components/answer/source-citations";
import { getReviewAction } from "@/lib/review-actions";

function CopyReplyButton({ claims }: { claims: StructuredClaim[] }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(claims.map((claim) => claim.text).join("\n\n"));
      setCopied(true);
    } catch {
      // Clipboard access denied; leave the button in its default state.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
    >
      {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy reply"}
    </button>
  );
}

function AnswerSection({
  claims,
  emptyMessage,
  result,
}: {
  claims: StructuredClaim[];
  emptyMessage: string;
  result: InvestigationResult;
}) {
  return (
    <section className="rounded-xl border border-zinc-900 bg-zinc-950 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-zinc-400" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            Customer reply
          </p>
        </div>
        {claims.length ? <CopyReplyButton claims={claims} /> : null}
      </div>

      {claims.length ? (
        <div className="mt-5 space-y-4">
          {claims.map((claim, index) => (
            <div key={`${claim.text}-${index}`} className="text-base leading-8 text-zinc-50">
              {claim.text}{" "}
              <span className="inline-flex flex-wrap gap-1 align-baseline">
                {claim.citations.map((citation) => (
                  <CitationMarker
                    key={`${claim.text}-${citation}`}
                    citation={citation}
                    result={result}
                  />
                ))}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-zinc-700 bg-zinc-900/70 p-4 text-sm text-zinc-300">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

function InternalFindings({
  claims,
  emptyMessage,
}: {
  claims: StructuredClaim[];
  emptyMessage: string;
}) {
  if (!claims.length) {
    return null;
  }

  return (
    <section className="surface p-4">
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
                <Badge
                  key={`${claim.text}-${citation}`}
                  variant={citation.startsWith("S") ? "outline" : "warn"}
                >
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

function EvidenceOnlySummary({ onDraftFromEvidence }: { onDraftFromEvidence: () => void }) {
  return (
    <section className="surface p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-[-0.02em] text-zinc-950">
            Review the exhibits, then draft.
          </h3>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-600">
            The retrieved sources are in the evidence rail. Draft a cited reply when they look
            strong enough.
          </p>
        </div>
        <Button type="button" className="shrink-0" onClick={onDraftFromEvidence}>
          Draft answer from evidence
        </Button>
      </div>
    </section>
  );
}

export function AnswerPanel({
  executionMode,
  isInvestigating,
  investigationContext,
  isReviewAcknowledged,
  isReviewRetryActive,
  onDraftFromEvidence,
  onMarkReviewed,
  onRetryWithContext,
  result,
  showDebugDetails,
}: {
  executionMode: "evidence_only" | "draft_answer";
  isInvestigating: boolean;
  investigationContext: string;
  isReviewAcknowledged: boolean;
  isReviewRetryActive: boolean;
  onDraftFromEvidence: () => void;
  onMarkReviewed: () => void;
  onRetryWithContext: () => void;
  result: InvestigationResult | null;
  showDebugDetails: boolean;
}) {
  const reduce = useReducedMotion();

  if (isInvestigating || !result) {
    return (
      <Card className="surface-shell">
        <CardContent className="flex min-h-[260px] items-center justify-center p-8 text-center">
          <div className="max-w-lg">
            <p className="eyebrow">Investigating</p>
            <h2 className="mt-3 text-2xl font-semibold text-zinc-950">
              {executionMode === "evidence_only" ? "Finding evidence..." : "Checking evidence..."}
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {executionMode === "evidence_only"
                ? "Support Copilot is retrieving docs, checking context, and recording the pipeline trace."
                : "Support Copilot is retrieving docs, checking context, and drafting cited claims."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const reviewAction = getReviewAction(result);
  const reviewToneStyles = reviewTone({
    reviewStatus: result.reviewStatus,
    acknowledged: isReviewAcknowledged,
  });
  const showOpenQuestions = result.internalDiagnosis.openQuestions.length > 0;
  const distinctInternalClaims = getDistinctInternalClaims(
    result.customerReply.claims,
    result.internalDiagnosis.claims,
  );

  return (
    <motion.div
      key={result.investigationId}
      className="space-y-4"
      variants={staggerParent}
      initial={reduce ? false : "hidden"}
      animate="show"
    >
      <motion.div variants={fadeRise}>
        <Card className="surface-shell">
          <CardContent className="space-y-4 p-4">
            <VerdictStrip result={result} isReviewAcknowledged={isReviewAcknowledged} />

            {showDebugDetails && investigationContext.trim() ? (
              <div className="rounded-lg border border-amber-200/80 bg-amber-50/70 p-3">
                <p className="eyebrow">Provided context</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                  {investigationContext}
                </p>
              </div>
            ) : null}

            {result.executionMode === "evidence_only" ? (
              <EvidenceOnlySummary onDraftFromEvidence={onDraftFromEvidence} />
            ) : (
              <>
                <AnswerSection
                  claims={result.customerReply.claims}
                  emptyMessage="No grounded answer was produced for this run."
                  result={result}
                />

                <QualityCheckCard result={result} showDebugDetails={showDebugDetails} />
                {result.docsGapReport ? <DocsGapReportCard report={result.docsGapReport} /> : null}

                <InternalFindings
                  claims={distinctInternalClaims}
                  emptyMessage="No grounded internal diagnosis claims were produced for this run."
                />
              </>
            )}

            <SourceLedger result={result} showDebugDetails={showDebugDetails} />
            <PipelineTimeline result={result} />
          </CardContent>
        </Card>
      </motion.div>

      {reviewAction && result.executionMode !== "evidence_only" ? (
        <motion.div variants={fadeRise}>
          <Card className={reviewToneStyles.surface}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 gap-3">
                  <motion.span
                    initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={springSoft}
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${reviewToneStyles.icon}`}
                  >
                    {isReviewAcknowledged ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <AlertTriangle className="h-4 w-4" />
                    )}
                  </motion.span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="eyebrow">
                        {isReviewAcknowledged
                          ? "Review acknowledged"
                          : isReviewRetryActive
                            ? "Retry staged"
                            : "Human-review queue"}
                      </p>
                      <Badge variant={isReviewAcknowledged ? "success" : "danger"}>
                        {isReviewAcknowledged
                          ? "Marked reviewed"
                          : isReviewRetryActive
                            ? "Awaiting rerun"
                            : "Reply blocked"}
                      </Badge>
                    </div>
                    <h3
                      className={`font-display mt-2 text-2xl tracking-[-0.02em] ${reviewToneStyles.accent}`}
                    >
                      {reviewAction.title}
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-700">
                      {reviewAction.description}
                    </p>
                    {result.internalDiagnosis.openQuestions.length ? (
                      <div className="mt-3 grid gap-2">
                        {result.internalDiagnosis.openQuestions.slice(0, 2).map((question) => (
                          <div
                            key={question}
                            className="rounded-lg border border-white/80 bg-white/65 px-3 py-2 text-sm leading-6 text-zinc-700"
                          >
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
                  <Button
                    type="button"
                    variant={isReviewAcknowledged ? "secondary" : "default"}
                    onClick={onMarkReviewed}
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    {isReviewAcknowledged ? "Reviewed" : "Mark reviewed"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}

      {showOpenQuestions ? (
        <motion.div variants={fadeRise}>
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
        </motion.div>
      ) : null}
    </motion.div>
  );
}
