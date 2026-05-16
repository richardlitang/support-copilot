import { Badge } from "@/components/ui/badge";
import type { CitationId, InvestigationResult, StructuredClaim } from "@/lib/types/investigation";

function findSource(result: InvestigationResult, citation: string) {
  return (
    result.docEvidence.find((item) => item.id === citation) ??
    result.toolEvidence.find((item) => item.id === citation)
  );
}

function getSourceTitle(result: InvestigationResult, citation: string) {
  const source = findSource(result, citation);

  if (!source) {
    return "Missing source";
  }

  if (source.sourceType === "doc") {
    return source.sectionTitle ? `${source.filename} · ${source.sectionTitle}` : source.filename;
  }

  return `${source.toolName} · ${source.title}`;
}

function getSourceExcerpt(result: InvestigationResult, citation: string) {
  const source = findSource(result, citation);

  if (!source) {
    return null;
  }

  return source.sourceType === "doc" ? source.excerpt : source.excerpt;
}

function getFormattedExcerptLines(excerpt: string) {
  return excerpt
    .replace(/\r/g, "")
    .replace(/\*\*([^*]+):\*\*/g, "\n$1:\n")
    .replace(/\s+-\s+/g, "\n- ")
    .split(/\n+/)
    .map((line) => line.trim().replace(/\*\*/g, ""))
    .filter(Boolean);
}

function SourcePreview({
  citation,
  excerpt,
  result,
  title,
}: {
  citation: CitationId;
  excerpt: string | null;
  result: InvestigationResult;
  title: string;
}) {
  const source = findSource(result, citation);
  const lines = excerpt ? getFormattedExcerptLines(excerpt) : [];

  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-[min(360px,calc(100vw-48px))] -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-xl group-hover/source:block group-focus-within/source:block">
      <span className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold leading-none ${
            citation.startsWith("S")
              ? "border-zinc-200 bg-white text-zinc-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {citation}
        </span>
        {source?.sourceType === "doc" ? (
          <span className="text-[11px] font-medium text-zinc-500">
            {Math.round(source.score * 100)}%{" "}
            {source.rerankScore !== undefined ? "rerank" : "match"}
          </span>
        ) : null}
      </span>
      <span className="mt-2 block text-xs font-semibold leading-5 text-zinc-950">{title}</span>
      {lines.length ? (
        <span className="mt-2 block max-h-56 overflow-y-auto rounded-md border border-zinc-100 bg-zinc-50/70 p-2.5">
          {lines.slice(0, 8).map((line, index) => {
            const isHeading = line.endsWith(":");
            const isBullet = line.startsWith("- ");

            if (isHeading) {
              return (
                <span
                  key={`${line}-${index}`}
                  className="mt-2 first:mt-0 block text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500"
                >
                  {line.slice(0, -1)}
                </span>
              );
            }

            return (
              <span
                key={`${line}-${index}`}
                className="mt-1.5 block text-xs leading-5 text-zinc-700"
              >
                {isBullet ? <span className="mr-1 text-zinc-400">-</span> : null}
                {isBullet ? line.slice(2) : line}
              </span>
            );
          })}
        </span>
      ) : (
        <span className="mt-2 block rounded-md border border-zinc-100 bg-zinc-50/70 p-2.5 text-xs leading-5 text-zinc-500">
          No source content was returned.
        </span>
      )}
    </span>
  );
}

function collectCitations(claims: StructuredClaim[]) {
  return Array.from(new Set(claims.flatMap((claim) => claim.citations)));
}

export function CitationMarker({
  citation,
  result,
}: {
  citation: CitationId;
  result: InvestigationResult;
}) {
  const title = getSourceTitle(result, citation);
  const excerpt = getSourceExcerpt(result, citation);

  return (
    <span className="group/source relative inline-flex align-baseline">
      <button
        type="button"
        className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold leading-none transition focus:outline-none focus:ring-2 focus:ring-zinc-300 ${
          citation.startsWith("S")
            ? "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"
            : "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300"
        }`}
        aria-label={`Show source ${citation}`}
      >
        {citation}
      </button>
      <SourcePreview citation={citation} excerpt={excerpt} result={result} title={title} />
    </span>
  );
}

export function SourceLedger({
  result,
  showDebugDetails,
}: {
  result: InvestigationResult;
  showDebugDetails: boolean;
}) {
  const citations = collectCitations([
    ...result.customerReply.claims,
    ...result.internalDiagnosis.claims,
  ]);

  if (!showDebugDetails || !citations.length) {
    return null;
  }

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Sources used</p>
        <Badge variant="outline">
          {citations.length} source{citations.length === 1 ? "" : "s"}
        </Badge>
      </div>
      <div className="mt-4 grid gap-2">
        {citations.map((citation) => {
          const source = findSource(result, citation);
          const title = getSourceTitle(result, citation);
          const excerpt = getSourceExcerpt(result, citation);

          return (
            <details
              key={citation}
              className="group rounded-lg border border-zinc-200/80 bg-zinc-50/70 px-3 py-2 open:bg-white"
              open={showDebugDetails || undefined}
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <span className="flex min-w-0 items-start gap-2">
                  <Badge
                    variant={citation.startsWith("S") ? "outline" : "warn"}
                    className="mt-0.5 shrink-0"
                  >
                    {citation}
                  </Badge>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-zinc-900">
                      {title}
                    </span>
                    {source?.sourceType === "doc" ? (
                      <span className="mt-0.5 block text-[11px] text-zinc-500">
                        {Math.round(source.score * 100)}%{" "}
                        {source.rerankScore !== undefined ? "rerank score" : "retrieval match"}
                        {source.retrievalSource ? ` · ${source.retrievalSource}` : ""}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="mt-1 shrink-0 text-[11px] font-medium text-zinc-400 group-open:hidden">
                  open
                </span>
              </summary>
              {excerpt ? (
                <p className="mt-2 line-clamp-4 border-t border-zinc-100 pt-2 text-xs leading-5 text-zinc-600">
                  {excerpt}
                </p>
              ) : (
                <p className="mt-2 border-t border-zinc-100 pt-2 text-xs leading-5 text-zinc-500">
                  No source content was returned.
                </p>
              )}
            </details>
          );
        })}
      </div>
    </section>
  );
}

function normalizeClaimText(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getDistinctInternalClaims(
  customerClaims: StructuredClaim[],
  internalClaims: StructuredClaim[],
) {
  const customerTexts = new Set(customerClaims.map((claim) => normalizeClaimText(claim.text)));
  const customerTokenSets = customerClaims.map(
    (claim) => new Set(normalizeClaimText(claim.text).split(" ").filter(Boolean)),
  );

  return internalClaims.filter((claim) => {
    const normalized = normalizeClaimText(claim.text);

    if (customerTexts.has(normalized)) {
      return false;
    }

    const tokens = normalized.split(" ").filter(Boolean);
    if (tokens.length < 5) {
      return true;
    }

    return !customerTokenSets.some((customerTokens) => {
      const overlap = tokens.filter((token) => customerTokens.has(token)).length;
      return overlap / tokens.length >= 0.82;
    });
  });
}
