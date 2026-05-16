import { Copy, FileWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DocsGapReport } from "@/lib/types/investigation";

function formatDocsGapReport(report: DocsGapReport) {
  const missingInformation = report.missingInformation.length
    ? report.missingInformation.map((item) => `- ${item}`).join("\n")
    : "- No specific missing information was identified.";
  const evidence = report.evidenceSnapshot.length
    ? report.evidenceSnapshot
        .map(
          (item) =>
            `- [${item.id}] ${item.title}${item.score !== undefined ? ` (${Math.round(item.score * 100)}%)` : ""}`,
        )
        .join("\n")
    : "- No evidence was available.";

  return [
    `Gap type: ${report.gapType.replaceAll("_", " ")}`,
    `Ticket need: ${report.whatTicketNeeded}`,
    `Why docs failed: ${report.whyDocsFailed}`,
    `Next action: ${report.suggestedNextAction}`,
    "Missing information:",
    missingInformation,
    "Evidence checked:",
    evidence,
  ].join("\n");
}

export function DocsGapReportCard({ report }: { report: DocsGapReport }) {
  async function handleCopyReport() {
    await navigator.clipboard?.writeText(formatDocsGapReport(report));
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/75 p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <FileWarning className="h-4 w-4 text-amber-700" />
            <p className="eyebrow text-amber-800">Documentation gap report</p>
            <Badge variant="warn">{report.gapType.replaceAll("_", " ")}</Badge>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-zinc-950">
            The docs do not support a customer-ready answer.
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-700">{report.whyDocsFailed}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 bg-white/80"
          onClick={handleCopyReport}
        >
          <Copy className="h-4 w-4" />
          Copy report
        </Button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-amber-100 bg-white/70 p-3">
          <p className="eyebrow">Next documentation fix</p>
          <p className="mt-2 text-sm leading-6 text-zinc-800">{report.suggestedNextAction}</p>
        </div>
        <div className="rounded-lg border border-amber-100 bg-white/70 p-3">
          <p className="eyebrow">Missing information</p>
          {report.missingInformation.length ? (
            <div className="mt-2 grid gap-2">
              {report.missingInformation.slice(0, 3).map((item) => (
                <p key={item} className="text-sm leading-6 text-zinc-800">
                  {item}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              No specific missing information was identified.
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-amber-100 bg-white/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Evidence checked</p>
          <Badge variant="outline">
            {report.evidenceSnapshot.length} source{report.evidenceSnapshot.length === 1 ? "" : "s"}
          </Badge>
        </div>
        <div className="mt-3 grid gap-2">
          {report.evidenceSnapshot.slice(0, 4).map((item) => (
            <div key={item.id} className="rounded-lg border border-zinc-100 bg-zinc-50/70 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={item.sourceType === "doc" ? "outline" : "warn"}>{item.id}</Badge>
                <span className="text-xs font-medium text-zinc-600">{item.title}</span>
                {item.score !== undefined ? (
                  <span className="text-xs text-zinc-500">{Math.round(item.score * 100)}%</span>
                ) : null}
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-600">{item.excerpt}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
