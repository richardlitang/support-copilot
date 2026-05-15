"use client";

import { History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

function formatHistoryTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function RecentInvestigations({
  currentInvestigationId,
  items,
  onClear,
  onSelect,
}: {
  currentInvestigationId?: string | null;
  items: InvestigationHistoryItem[];
  onClear: () => void;
  onSelect: (item: InvestigationHistoryItem) => void;
}) {
  return (
    <Card className="surface-shell">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <History className="h-4 w-4 shrink-0 text-zinc-500" />
            <div className="min-w-0">
              <p className="eyebrow">Recent</p>
              <p className="mt-1 text-xs text-zinc-500">
                {items.length
                  ? `${items.length} recent run${items.length === 1 ? "" : "s"}`
                  : "No runs yet"}
              </p>
            </div>
          </div>
          {items.length ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              Clear history
            </Button>
          ) : null}
        </div>

        <div className="mt-3 grid gap-2">
          {items.length ? (
            items.map((item) => {
              const isCurrent = item.investigationId === currentInvestigationId;

              return (
                <button
                  key={item.investigationId}
                  type="button"
                  onClick={() => onSelect(item)}
                  className={`surface-muted min-w-0 p-3 text-left transition hover:border-zinc-300 ${
                    isCurrent ? "border-zinc-950/40 bg-white" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-500">
                      {formatHistoryTime(item.createdAt)}
                    </span>
                    <Badge
                      variant={
                        item.result.executionMode === "evidence_only"
                          ? "outline"
                          : item.result.reviewStatus === "needs_human_review"
                            ? "danger"
                            : "secondary"
                      }
                    >
                      {item.result.executionMode === "evidence_only"
                        ? "Evidence"
                        : item.result.reviewStatus === "needs_human_review"
                          ? "Review"
                          : "Ready"}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-5 text-zinc-800">{item.ticket}</p>
                </button>
              );
            })
          ) : (
            <div className="surface-muted border-dashed p-3 text-xs leading-5 text-zinc-500">
              Run a ticket to save it here.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
