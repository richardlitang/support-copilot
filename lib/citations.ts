import type { CitationReference, EvidenceChunk } from "@/lib/types";

export function formatCitationLabel(rank: number) {
  return `S${rank}` as `S${number}`;
}

export function formatToolCitationLabel(rank: number) {
  return `T${rank}` as `T${number}`;
}

const MAX_CITATION_EXCERPT_CHARS = 1200;

export function buildCitationReferences(evidence: EvidenceChunk[]): CitationReference[] {
  return evidence.map((item) => ({
    label: formatCitationLabel(item.rank),
    filename: item.filename,
    sectionTitle: item.sectionTitle,
    excerpt: item.content.slice(0, MAX_CITATION_EXCERPT_CHARS),
  }));
}

export function normalizeCitationLabels(labels: string[], allowedLabels: string[]) {
  return normalizeSourceLabels(labels, allowedLabels);
}

export function normalizeSourceLabels(labels: string[], allowedLabels: string[]) {
  const allowed = new Set(allowedLabels);
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const label of labels) {
    const cleaned = label.trim().toUpperCase();

    if (!allowed.has(cleaned) || seen.has(cleaned)) {
      continue;
    }

    normalized.push(cleaned);
    seen.add(cleaned);
  }

  return normalized;
}
