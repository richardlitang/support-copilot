"use client";

import { History } from "lucide-react";
import { RecentInvestigations } from "@/components/RecentInvestigations";
import type { InvestigationHistoryItem } from "@/components/support-shell/history-storage";

export function HistoryDrawer(props: {
  items: InvestigationHistoryItem[];
  currentInvestigationId?: string;
  onClear: () => void;
  onSelect: (item: InvestigationHistoryItem) => void;
}) {
  if (!props.items.length) {
    return null;
  }

  return (
    <details className="surface px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-graphite">
        <History className="h-4 w-4 text-zinc-500" />
        Recent investigations
        <span className="font-mono text-[11px] text-zinc-400">({props.items.length})</span>
      </summary>
      <div className="mt-3">
        <RecentInvestigations
          currentInvestigationId={props.currentInvestigationId}
          items={props.items}
          onClear={props.onClear}
          onSelect={props.onSelect}
        />
      </div>
    </details>
  );
}
