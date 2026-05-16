"use client";

import { ChevronDown, FileText, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DocumentRecord } from "@/lib/types";

const bundledSampleFilename = "paybridge-api-support-guide.md";

function statusTone(status: DocumentRecord["status"]) {
  if (status === "ready") {
    return "success" as const;
  }

  if (status === "failed") {
    return "danger" as const;
  }

  return "warn" as const;
}

export function SessionDocsList({
  docsExpanded,
  documents,
  maxSessionDocs,
  onClearDocuments,
  onDeleteDocument,
  onToggleDocs,
}: {
  docsExpanded: boolean;
  documents: DocumentRecord[];
  maxSessionDocs: number;
  onClearDocuments: () => void;
  onDeleteDocument: (documentId: string) => void;
  onToggleDocs: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow">Session docs</p>
            <p className="mt-1 text-sm text-zinc-500">
              {documents.length
                ? documents.some(
                    (document) =>
                      document.status === "uploaded" || document.status === "processing",
                  )
                  ? "Processing uploads."
                  : "Ready for retrieval."
                : "No docs loaded yet."}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {documents.length}/{maxSessionDocs}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {documents.length ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClearDocuments}>
              Clear all
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onToggleDocs}
            aria-label={docsExpanded ? "Hide session docs" : "Show session docs"}
          >
            <ChevronDown className={`h-4 w-4 transition ${docsExpanded ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </div>

      {docsExpanded ? (
        <ScrollArea className="h-[190px]">
          <div className="space-y-3">
            {documents.length ? (
              documents.map((document) => (
                <div key={document.id} className="surface-muted p-3">
                  <div className="grid gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-zinc-500" />
                        <p className="truncate text-sm font-medium text-zinc-950">
                          {document.filename}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={statusTone(document.status)}>{document.status}</Badge>
                      {document.filename === bundledSampleFilename ? (
                        <Badge variant="outline">sample</Badge>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteDocument(document.id)}
                        aria-label={`Remove ${document.filename}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="surface-muted p-4 text-sm text-zinc-500">No docs loaded yet.</div>
            )}
          </div>
        </ScrollArea>
      ) : null}
    </div>
  );
}
