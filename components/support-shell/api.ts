import type { DocumentRecord, UploadOutcome } from "@/lib/types";
import type { AccountRecord, InvestigationResult } from "@/lib/types/investigation";

export type UploadResponse = {
  documents: DocumentRecord[];
  outcomes: UploadOutcome[];
  error?: string;
};

export type DocumentsResponse = {
  documents: DocumentRecord[];
  error?: string;
};

export type AccountsResponse = {
  accounts: AccountRecord[];
  error?: string;
};

export async function fetchDocuments() {
  const response = await fetch("/api/documents");
  const payload = (await response.json()) as DocumentsResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to refresh documents.");
  }

  return payload.documents;
}

export async function fetchAccounts() {
  const response = await fetch("/api/debug/accounts");
  const payload = (await response.json()) as AccountsResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to refresh debug accounts.");
  }

  return payload.accounts;
}

export async function uploadDocuments(files: File[]) {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });
  const payload = (await response.json()) as UploadResponse;
  const requestId = response.headers.get("x-request-id");

  if (!response.ok && !payload.outcomes) {
    throw new Error(
      requestId
        ? `${payload.error ?? "Upload failed."} (requestId: ${requestId})`
        : (payload.error ?? "Upload failed."),
    );
  }

  return {
    documents: payload.documents ?? [],
    outcomes: payload.outcomes ?? [],
  };
}

export async function deleteDocument(documentId: string) {
  const response = await fetch("/api/documents", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ documentId }),
  });
  const payload = (await response.json()) as DocumentsResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to delete document.");
  }

  return payload.documents;
}

export async function clearDocuments() {
  const response = await fetch("/api/documents", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ clearAll: true }),
  });
  const payload = (await response.json()) as DocumentsResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "Failed to clear documents.");
  }

  return payload.documents;
}

export async function runInvestigation(input: {
  ticket: string;
  executionMode: "evidence_only" | "draft_answer";
  ragEnabled: boolean;
  selectedAccountId: string | null;
  investigationContext: string;
}) {
  const response = await fetch("/api/investigate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as InvestigationResult & { error?: string };
  const requestId = response.headers.get("x-request-id");

  if (!response.ok) {
    throw new Error(
      requestId
        ? `${payload.error ?? "Investigation failed."} (requestId: ${requestId})`
        : (payload.error ?? "Investigation failed."),
    );
  }

  return payload;
}
