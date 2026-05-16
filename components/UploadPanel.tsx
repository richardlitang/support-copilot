"use client";

import { useId, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { IntakeDropzone } from "@/components/upload/intake-dropzone";
import { LatestIngestion } from "@/components/upload/latest-ingestion";
import { SessionDocsList } from "@/components/upload/session-docs-list";
import type { DocumentRecord, UploadOutcome } from "@/lib/types";

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
          <IntakeDropzone
            inputId={inputId}
            inputRef={inputRef}
            isAtSessionLimit={isAtSessionLimit}
            isDragActive={isDragActive}
            isUploading={isUploading}
            onChange={handleChange}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />

          {isAtSessionLimit ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              You have 10 docs in this session. Remove one to upload another.
            </div>
          ) : null}

          <Separator />

          <SessionDocsList
            docsExpanded={docsExpanded}
            documents={documents}
            maxSessionDocs={maxSessionDocs}
            onClearDocuments={onClearDocuments}
            onDeleteDocument={onDeleteDocument}
            onToggleDocs={() => setShowDocs((value) => !value)}
          />

          {uploadOutcomes.length ? (
            <>
              <Separator />
              <LatestIngestion uploadOutcomes={uploadOutcomes} />
            </>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
