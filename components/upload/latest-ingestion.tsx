"use client";

import { UploadOutcome } from "@/lib/types";

export function LatestIngestion({ uploadOutcomes }: { uploadOutcomes: UploadOutcome[] }) {
  if (!uploadOutcomes.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="eyebrow">Latest ingestion</p>
        <p className="mt-1 text-sm text-zinc-500">Last upload</p>
      </div>
      <div className="space-y-2">
        {uploadOutcomes.map((outcome) => (
          <div key={`${outcome.filename}-${outcome.status}`} className="surface-muted p-3 text-sm">
            <div className="grid gap-2">
              <p className="truncate text-zinc-700">{outcome.filename}</p>
              <p className={outcome.status === "failed" ? "text-red-700" : "text-emerald-700"}>
                {outcome.message}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
