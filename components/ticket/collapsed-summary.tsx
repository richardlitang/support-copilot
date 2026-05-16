"use client";

import { Pencil, Plus, SearchCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { InvestigationExecutionMode } from "@/lib/types/investigation";

export function CollapsedTicketSummary({
  executionMode,
  investigationContext,
  isInvestigating,
  onEdit,
  onNewTicket,
  ticket,
}: {
  executionMode: InvestigationExecutionMode;
  investigationContext: string;
  isInvestigating: boolean;
  onEdit: () => void;
  onNewTicket: () => void;
  ticket: string;
}) {
  return (
    <Card className="surface-shell overflow-hidden">
      <CardContent className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">Case input</p>
              {isInvestigating ? (
                <Badge variant="warn">Investigating</Badge>
              ) : (
                <Badge variant="secondary">Submitted</Badge>
              )}
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-800">{ticket}</p>
            {investigationContext.trim() ? (
              <p className="mt-1 text-xs text-zinc-500">Context added</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isInvestigating ? (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                <SearchCheck className="h-4 w-4 animate-pulse" />
                {executionMode === "evidence_only" ? "Finding evidence" : "Drafting answer"}
              </div>
            ) : null}
            {!isInvestigating ? (
              <Button type="button" variant="outline" size="sm" onClick={onNewTicket}>
                <Plus className="h-4 w-4" />
                New ticket
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </div>
        </div>
        {isInvestigating ? (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full w-1/2 animate-[case-progress_1.4s_ease-in-out_infinite] rounded-full bg-zinc-950" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
