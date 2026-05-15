"use client";

import { useId, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { ChevronDown, FileText, Trash2, UploadCloud } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { DocumentRecord, UploadOutcome } from "@/lib/types";

function statusTone(status: DocumentRecord["status"]) {
  if (status === "ready") {
    return "success" as const;
  }

  if (status === "failed") {
    return "danger" as const;
  }

  return "warn" as const;
}

const bundledSampleFilename = "paybridge-api-support-guide.md";

export function UploadPanel({
  documents,
  uploadOutcomes,
  isUploading,
  isActiveStep,
  onFilesSelected,
  onDeleteDocument,
  onClearDocuments,
}: {
  documents: DocumentRecord[];
  uploadOutcomes: UploadOutcome[];
  isUploading: boolean;
  isActiveStep: boolean;
  onFilesSelected: (files: File[] | null) => void;
  onDeleteDocument: (documentId: string) => void;
  onClearDocuments: () => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showIntake, setShowIntake] = useState(true);
  const [showDocs, setShowDocs] = useState(true);
  const maxSessionDocs = 10;
  const isAtSessionLimit = documents.length >= maxSessionDocs;
  const docsExpanded = showDocs || uploadOutcomes.length > 0;

  function toUploadableFiles(files: FileList | null) {
    if (!files?.length) {
      return null;
    }

    return Array.from(files);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onFilesSelected(toUploadableFiles(event.target.files));
    event.target.value = "";
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!isUploading && !isAtSessionLimit) {
      setIsDragActive(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);

    if (isUploading || isAtSessionLimit) {
      return;
    }

    onFilesSelected(toUploadableFiles(event.dataTransfer.files));
  }

  return (
    <Card
      className={`surface-shell sidebar-scroll overflow-hidden xl:sticky xl:top-4 ${
        isActiveStep ? "border-zinc-950/40 shadow-[0_18px_42px_rgba(15,23,42,0.11)]" : ""
      }`}
    >
      <CardHeader className={showIntake ? "relative pb-3 pr-14" : "relative p-3 pr-14"}>
        <div>
          <div className="min-w-0">
            <p className="eyebrow">Case intake</p>
            <CardTitle className="mt-2 text-lg">Docs for this case</CardTitle>
            <CardDescription className="mt-2 text-xs leading-5">
              Start with the PayBridge sample doc, remove it, or add your own focused docs.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="absolute right-3 top-3"
            onClick={() => setShowIntake((value) => !value)}
            aria-label={showIntake ? "Collapse case intake" : "Expand case intake"}
          >
            <ChevronDown className={`h-4 w-4 transition ${showIntake ? "rotate-180" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      {showIntake ? (
        <CardContent className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-lg border border-dashed p-4 transition ${
              isAtSessionLimit
                ? "cursor-not-allowed border-zinc-200 bg-zinc-100/80 opacity-75"
                : isDragActive
                  ? "border-zinc-950 bg-zinc-50"
                  : "border-zinc-300 bg-zinc-50/70"
            }`}
          >
            <UploadCloud className="h-4 w-4 text-zinc-500" />
            <p className="mt-3 text-sm font-medium text-zinc-950">Add docs</p>
            <p className="mt-2 text-xs leading-5 text-zinc-600">
              Drop files here, or choose `.md`, `.txt`, or text-based `.pdf` files.
            </p>
            <Button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading || isAtSessionLimit}
              size="sm"
              className="mt-3 rounded-md"
            >
              {isAtSessionLimit ? "Limit reached" : isUploading ? "Uploading..." : "Choose files"}
            </Button>
            <input
              ref={inputRef}
              id={inputId}
              className="hidden"
              type="file"
              multiple
              accept=".md,.txt,.pdf,application/pdf,text/markdown,text/plain"
              onChange={handleChange}
              disabled={isUploading || isAtSessionLimit}
            />
          </div>

          {isAtSessionLimit ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              You have 10 docs in this session. Remove one to upload another.
            </div>
          ) : null}

          <Separator />

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
                  onClick={() => setShowDocs((value) => !value)}
                  aria-label={docsExpanded ? "Hide session docs" : "Show session docs"}
                >
                  <ChevronDown
                    className={`h-4 w-4 transition ${docsExpanded ? "rotate-180" : ""}`}
                  />
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
                    <div className="surface-muted p-4 text-sm text-zinc-500">
                      No docs loaded yet.
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : null}
          </div>

          {uploadOutcomes.length ? (
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <p className="eyebrow">Latest ingestion</p>
                  <p className="mt-1 text-sm text-zinc-500">Last upload</p>
                </div>
                <div className="space-y-2">
                  {uploadOutcomes.map((outcome) => (
                    <div
                      key={`${outcome.filename}-${outcome.status}`}
                      className="surface-muted p-3 text-sm"
                    >
                      <div className="grid gap-2">
                        <p className="truncate text-zinc-700">{outcome.filename}</p>
                        <p
                          className={
                            outcome.status === "failed" ? "text-red-700" : "text-emerald-700"
                          }
                        >
                          {outcome.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
