import type { InvestigationExecutionMode, InvestigationResult } from "@/lib/types/investigation";

export type InvestigationHistoryItem = {
  investigationId: string;
  ticket: string;
  investigationContext: string;
  selectedAccountId: string | null;
  executionMode: InvestigationExecutionMode;
  ragEnabled: boolean;
  createdAt: string;
  result: InvestigationResult;
};

export const historyStorageKey = "support-copilot:recent-investigations";
export const historyLimit = 6;

export function readStoredHistory() {
  try {
    const stored = window.localStorage.getItem(historyStorageKey);

    if (!stored) {
      return [];
    }

    return (JSON.parse(stored) as InvestigationHistoryItem[]).slice(0, historyLimit);
  } catch {
    return [];
  }
}

export function writeStoredHistory(items: InvestigationHistoryItem[]) {
  try {
    window.localStorage.setItem(historyStorageKey, JSON.stringify(items.slice(0, historyLimit)));
  } catch {
    // History is a convenience. Investigation results still work if browser storage is unavailable.
  }
}
