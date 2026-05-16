"use client";

import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChangeEventHandler, DragEventHandler, RefObject } from "react";

export function IntakeDropzone({
  inputId,
  inputRef,
  isAtSessionLimit,
  isDragActive,
  isUploading,
  onChange,
  onDragLeave,
  onDragOver,
  onDrop,
}: {
  inputId: string;
  inputRef: RefObject<HTMLInputElement | null>;
  isAtSessionLimit: boolean;
  isDragActive: boolean;
  isUploading: boolean;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
}) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
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
        onChange={onChange}
        disabled={isUploading || isAtSessionLimit}
      />
    </div>
  );
}
