"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { AnswerPanel } from "@/components/AnswerPanel";
import { EvidencePanel } from "@/components/EvidencePanel";
import { RecentInvestigations } from "@/components/RecentInvestigations";
import {
  clearDocuments,
  deleteDocument,
  fetchAccounts,
  fetchDocuments,
  runInvestigation,
  uploadDocuments,
} from "@/components/support-shell/api";
import {
  historyLimit,
  readStoredHistory,
  type InvestigationHistoryItem,
  writeStoredHistory,
} from "@/components/support-shell/history-storage";
import { TicketForm } from "@/components/TicketForm";
import { UploadPanel } from "@/components/UploadPanel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DocumentRecord, UploadOutcome } from "@/lib/types";
import type {
  AccountRecord,
  InvestigationExecutionMode,
  InvestigationResult,
} from "@/lib/types/investigation";

export type DemoScenario = {
  id: string;
  label?: string;
  bucket?: string;
  rawText: string;
  investigationContext?: string;
  selectedAccountId?: string;
};

export function SupportCopilotShell({
  initialAccounts,
  initialDocuments,
  demoScenarios,
}: {
  initialAccounts: AccountRecord[];
  initialDocuments: DocumentRecord[];
  demoScenarios: DemoScenario[];
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [investigationContext, setInvestigationContext] = useState("");
  const [ticket, setTicket] = useState("");
  const [uploadOutcomes, setUploadOutcomes] = useState<UploadOutcome[]>([]);
  const [result, setResult] = useState<InvestigationResult | null>(null);
  const [historyItems, setHistoryItems] = useState<InvestigationHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [executionMode, setExecutionMode] = useState<InvestigationExecutionMode>("draft_answer");
  const [ragEnabled, setRagEnabled] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [reviewedInvestigationId, setReviewedInvestigationId] = useState<string | null>(null);
  const [focusContextToken, setFocusContextToken] = useState(0);
  const [isReviewRetryActive, setIsReviewRetryActive] = useState(false);
  const [isComposerExpandedAfterRun, setIsComposerExpandedAfterRun] = useState(false);

  const showDebugToggle = process.env.NEXT_PUBLIC_DEBUG_RAG === "true";
  const hasRunState = Boolean(result) || isInvestigating;
  const activeStep = documents.length === 0 ? "docs" : ticket.trim() ? "investigate" : "ticket";
  const hasPendingDocuments = documents.some(
    (document) => document.status === "uploaded" || document.status === "processing",
  );

  const refreshDocuments = useCallback(async (options?: { silent?: boolean }) => {
    try {
      const documents = await fetchDocuments();
      setDocuments(documents);
    } catch (error) {
      if (!options?.silent) {
        throw error;
      }
    }
  }, []);

  const refreshAccounts = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!showDebugToggle) {
        return;
      }

      try {
        const accounts = await fetchAccounts();
        setAccounts(accounts);
      } catch (error) {
        if (!options?.silent) {
          throw error;
        }
      }
    },
    [showDebugToggle],
  );

  useEffect(() => {
    void refreshDocuments({ silent: true });

    if (showDebugToggle) {
      void refreshAccounts({ silent: true });
    }
  }, [refreshAccounts, refreshDocuments, showDebugToggle]);

  useEffect(() => {
    if (!hasPendingDocuments) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshDocuments({ silent: true });
    }, 2000);

    return () => window.clearInterval(interval);
  }, [hasPendingDocuments, refreshDocuments]);

  useEffect(() => {
    setHistoryItems(readStoredHistory());
  }, []);

  useEffect(() => {
    setReviewedInvestigationId(null);
    setIsReviewRetryActive(false);
  }, [result?.investigationId]);

  async function handleDeleteDocument(documentId: string) {
    setError(null);

    try {
      const documents = await deleteDocument(documentId);
      setDocuments(documents);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete document.");
    }
  }

  async function handleClearDocuments() {
    setError(null);

    try {
      const documents = await clearDocuments();
      setDocuments(documents);
      setUploadOutcomes([]);
      setResult(null);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Failed to clear documents.");
    }
  }

  async function handleUpload(files: File[] | null) {
    if (!files?.length) {
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const payload = await uploadDocuments(files);
      setDocuments(payload.documents);
      setUploadOutcomes(payload.outcomes);
      void refreshDocuments({ silent: true });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleInvestigate(modeOverride?: InvestigationExecutionMode) {
    if (!ticket.trim() || isInvestigating) {
      return;
    }

    const nextExecutionMode = modeOverride ?? executionMode;
    setError(null);
    setIsInvestigating(true);
    setIsReviewRetryActive(false);
    setIsComposerExpandedAfterRun(false);

    try {
      const payload = await runInvestigation({
        ticket,
        executionMode: nextExecutionMode,
        ragEnabled,
        selectedAccountId,
        investigationContext,
      });

      setResult(payload);
      setExecutionMode(payload.executionMode);
      setHistoryItems((items) => {
        const next = [
          {
            investigationId: payload.investigationId,
            ticket,
            investigationContext,
            selectedAccountId,
            executionMode: payload.executionMode,
            ragEnabled,
            createdAt: new Date().toISOString(),
            result: payload,
          },
          ...items.filter((item) => item.investigationId !== payload.investigationId),
        ].slice(0, historyLimit);

        writeStoredHistory(next);
        return next;
      });
      await refreshDocuments();
    } catch (investigateError) {
      setError(
        investigateError instanceof Error ? investigateError.message : "Investigation failed.",
      );
    } finally {
      setIsInvestigating(false);
    }
  }

  function handleRetryWithContext() {
    setFocusContextToken((value) => value + 1);
    setIsReviewRetryActive(true);
    setIsComposerExpandedAfterRun(true);

    if (!investigationContext.trim()) {
      setInvestigationContext("Plan:\nFeature state:\nRecent errors:\nSupport notes:");
    }
  }

  function handleMarkReviewed() {
    if (result) {
      setReviewedInvestigationId(result.investigationId);
    }
  }

  function handleNewTicket() {
    setTicket("");
    setInvestigationContext("");
    setSelectedAccountId(null);
    setExecutionMode("draft_answer");
    setResult(null);
    setError(null);
    setReviewedInvestigationId(null);
    setIsReviewRetryActive(false);
    setIsComposerExpandedAfterRun(false);
  }

  function handleLoadHistoryItem(item: InvestigationHistoryItem) {
    setTicket(item.ticket);
    setInvestigationContext(item.investigationContext);
    setSelectedAccountId(item.selectedAccountId);
    setExecutionMode(item.executionMode ?? item.result.executionMode ?? "draft_answer");
    setRagEnabled(item.ragEnabled);
    setResult(item.result);
    setError(null);
    setIsReviewRetryActive(false);
    setIsComposerExpandedAfterRun(false);
  }

  function handleClearHistory() {
    setHistoryItems([]);
    writeStoredHistory([]);
  }

  function handleLoadScenario(scenario: DemoScenario) {
    setTicket(scenario.rawText);
    setInvestigationContext(scenario.investigationContext ?? "");
    setSelectedAccountId(scenario.selectedAccountId ?? null);
    setExecutionMode("draft_answer");
    setResult(null);
    setError(null);
    setIsReviewRetryActive(false);
    setIsComposerExpandedAfterRun(false);
  }

  return (
    <main className="min-h-screen py-3 text-zinc-950">
      <div className="app-frame space-y-3">
        <Card className="surface-shell overflow-hidden border-zinc-200/80">
          <CardContent className="p-3 lg:p-4">
            <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <Badge variant="secondary" className="gap-1.5 rounded-md px-2 py-0.5">
                  <Sparkles className="h-3 w-3" />
                  Support workbench
                </Badge>
                <h1 className="mt-2 text-xl font-semibold text-zinc-950">Support Copilot</h1>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-600">
                  Investigate support tickets with retrieved docs, tool context, and cited answers.
                </p>
              </div>

              <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 xl:justify-end">
                <Badge variant={executionMode === "evidence_only" ? "outline" : "default"}>
                  {executionMode === "evidence_only" ? "Evidence only" : "Draft answer"}
                </Badge>
                {showDebugToggle ? (
                  <Badge variant={ragEnabled ? "secondary" : "outline"}>
                    {ragEnabled ? "Retrieval on" : "Retrieval off"}
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <Card className="border-red-200 bg-red-50 text-red-700">
            <CardContent className="p-4 text-sm">{error}</CardContent>
          </Card>
        ) : null}

        <section
          className={
            hasRunState && showDebugToggle
              ? "workbench-layout workbench-layout--with-evidence"
              : "workbench-layout"
          }
        >
          <div className="left-stack">
            <RecentInvestigations
              currentInvestigationId={result?.investigationId}
              items={historyItems}
              onClear={handleClearHistory}
              onSelect={handleLoadHistoryItem}
            />
            <UploadPanel
              documents={documents}
              uploadOutcomes={uploadOutcomes}
              isUploading={isUploading}
              isActiveStep={activeStep === "docs" && !hasRunState}
              onFilesSelected={handleUpload}
              onDeleteDocument={handleDeleteDocument}
              onClearDocuments={handleClearDocuments}
            />
          </div>

          <div className="center-stack">
            <TicketForm
              accounts={accounts}
              demoScenarios={demoScenarios}
              selectedAccountId={selectedAccountId}
              investigationContext={investigationContext}
              ticket={ticket}
              isInvestigating={isInvestigating}
              isActiveStep={activeStep !== "docs" && !hasRunState}
              ragEnabled={ragEnabled}
              executionMode={executionMode}
              showDebugToggle={showDebugToggle}
              focusContextToken={focusContextToken}
              isReviewRetryActive={isReviewRetryActive}
              isCollapsed={hasRunState && !isComposerExpandedAfterRun && !isReviewRetryActive}
              accountHint={
                result?.reviewDecision.action === "add_context"
                  ? "Paste plan, feature, or recent error context to unlock a deeper investigation path."
                  : null
              }
              onSelectAccount={setSelectedAccountId}
              onInvestigationContextChange={setInvestigationContext}
              onExecutionModeChange={setExecutionMode}
              onToggleRag={setRagEnabled}
              onTicketChange={setTicket}
              onLoadScenario={handleLoadScenario}
              onEdit={() => setIsComposerExpandedAfterRun(true)}
              onNewTicket={handleNewTicket}
              onSubmit={handleInvestigate}
            />

            {hasRunState ? (
              <AnswerPanel
                executionMode={executionMode}
                isInvestigating={isInvestigating}
                investigationContext={investigationContext}
                result={result}
                isReviewAcknowledged={Boolean(
                  result && reviewedInvestigationId === result.investigationId,
                )}
                isReviewRetryActive={isReviewRetryActive}
                onMarkReviewed={handleMarkReviewed}
                onDraftFromEvidence={() => void handleInvestigate("draft_answer")}
                onRetryWithContext={handleRetryWithContext}
                showDebugDetails={showDebugToggle}
              />
            ) : null}
          </div>

          {hasRunState && showDebugToggle ? (
            <EvidencePanel result={result} isInvestigating={isInvestigating} />
          ) : null}
        </section>
      </div>
    </main>
  );
}
