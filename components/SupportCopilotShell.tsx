"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { AnswerPanel } from "@/components/AnswerPanel";
import { EvidencePanel } from "@/components/EvidencePanel";
import { TicketForm } from "@/components/TicketForm";
import { UploadPanel } from "@/components/UploadPanel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DocumentRecord, UploadOutcome } from "@/lib/types";
import type { AccountRecord, InvestigationResultV2 } from "@/lib/types/investigation-v2";

type UploadResponse = {
  documents: DocumentRecord[];
  outcomes: UploadOutcome[];
  error?: string;
};

type DocumentsResponse = {
  documents: DocumentRecord[];
};

type AccountsResponse = {
  accounts: AccountRecord[];
  error?: string;
};

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
  demoScenarios
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
  const [result, setResult] = useState<InvestigationResultV2 | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ragEnabled, setRagEnabled] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isInvestigating, setIsInvestigating] = useState(false);

  const showDebugToggle = process.env.NEXT_PUBLIC_DEBUG_RAG === "true";
  const hasRunState = Boolean(result) || isInvestigating;
  const activeStep = documents.length === 0 ? "docs" : ticket.trim() ? "investigate" : "ticket";

  const refreshDocuments = useCallback(async (options?: { silent?: boolean }) => {
    const response = await fetch("/api/documents");
    const payload = (await response.json()) as DocumentsResponse & { error?: string };

    if (!response.ok) {
      if (!options?.silent) {
        throw new Error(payload.error ?? "Failed to refresh documents.");
      }

      return;
    }

    setDocuments(payload.documents);
  }, []);

  const refreshAccounts = useCallback(async (options?: { silent?: boolean }) => {
    if (!showDebugToggle) {
      return;
    }

    const response = await fetch("/api/debug/accounts");
    const payload = (await response.json()) as AccountsResponse;

    if (!response.ok) {
      if (!options?.silent) {
        throw new Error(payload.error ?? "Failed to refresh debug accounts.");
      }

      return;
    }

    setAccounts(payload.accounts);
  }, [showDebugToggle]);

  useEffect(() => {
    void refreshDocuments({ silent: true });

    if (showDebugToggle) {
      void refreshAccounts({ silent: true });
    }
  }, [refreshAccounts, refreshDocuments, showDebugToggle]);

  async function handleDeleteDocument(documentId: string) {
    setError(null);

    try {
      const response = await fetch("/api/documents", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ documentId })
      });
      const payload = (await response.json()) as DocumentsResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete document.");
      }

      setDocuments(payload.documents);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete document.");
    }
  }

  async function handleClearDocuments() {
    setError(null);

    try {
      const response = await fetch("/api/documents", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ clearAll: true })
      });
      const payload = (await response.json()) as DocumentsResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to clear documents.");
      }

      setDocuments(payload.documents);
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
    const formData = new FormData();

    files.forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });
      const payload = (await response.json()) as UploadResponse;
      const requestId = response.headers.get("x-request-id");

      if (!response.ok && !payload.outcomes) {
        throw new Error(
          requestId ? `${payload.error ?? "Upload failed."} (requestId: ${requestId})` : payload.error ?? "Upload failed."
        );
      }

      setDocuments(payload.documents ?? []);
      setUploadOutcomes(payload.outcomes ?? []);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleInvestigate() {
    if (!ticket.trim() || isInvestigating) {
      return;
    }

    setError(null);
    setIsInvestigating(true);

    try {
      const response = await fetch("/api/investigate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ticket,
          ragEnabled,
          selectedAccountId,
          investigationContext
        })
      });
      const payload = (await response.json()) as InvestigationResultV2 & { error?: string };
      const requestId = response.headers.get("x-request-id");

      if (!response.ok) {
        throw new Error(
          requestId
            ? `${payload.error ?? "Investigation failed."} (requestId: ${requestId})`
            : payload.error ?? "Investigation failed."
        );
      }

      setResult(payload);
      await refreshDocuments();
    } catch (investigateError) {
      setError(investigateError instanceof Error ? investigateError.message : "Investigation failed.");
    } finally {
      setIsInvestigating(false);
    }
  }

  function handleLoadScenario(scenario: DemoScenario) {
    setTicket(scenario.rawText);
    setInvestigationContext(scenario.investigationContext ?? "");
    setSelectedAccountId(scenario.selectedAccountId ?? null);
    setResult(null);
    setError(null);
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
                  Grounded investigation
                </Badge>
                <h1 className="mt-2 text-xl font-semibold text-zinc-950">Support Copilot</h1>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-600">
                  Upload docs, paste a ticket, and inspect cited evidence before trusting the answer.
                </p>
              </div>

              <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 xl:justify-end">
                {showDebugToggle ? <Badge variant={ragEnabled ? "default" : "outline"}>{ragEnabled ? "RAG On" : "RAG Off"}</Badge> : null}
              </div>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <Card className="border-red-200 bg-red-50 text-red-700">
            <CardContent className="p-4 text-sm">{error}</CardContent>
          </Card>
        ) : null}

        <section className={hasRunState ? "workbench-layout" : "workbench-layout workbench-layout--start"}>
          <UploadPanel
            documents={documents}
            uploadOutcomes={uploadOutcomes}
            isUploading={isUploading}
            isActiveStep={activeStep === "docs" && !hasRunState}
            onFilesSelected={handleUpload}
            onDeleteDocument={handleDeleteDocument}
            onClearDocuments={handleClearDocuments}
          />

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
              showDebugToggle={showDebugToggle}
              accountHint={
                result?.reviewStatus === "needs_human_review" &&
                result.routingReason.toLowerCase().includes("none was provided")
                  ? "Paste plan, feature, or recent error context to unlock a deeper investigation path."
                  : null
              }
              onSelectAccount={setSelectedAccountId}
              onInvestigationContextChange={setInvestigationContext}
              onToggleRag={setRagEnabled}
              onTicketChange={setTicket}
              onLoadScenario={handleLoadScenario}
              onSubmit={handleInvestigate}
            />

            {hasRunState ? (
              <AnswerPanel
                isInvestigating={isInvestigating}
                investigationContext={investigationContext}
                result={result}
                ticket={ticket}
                showDebugDetails={showDebugToggle}
              />
            ) : null}
          </div>

          {hasRunState ? <EvidencePanel result={result} isInvestigating={isInvestigating} /> : null}
        </section>
      </div>
    </main>
  );
}
