import { formatCitationLabel } from "@/lib/citations";
import type { EvidenceChunk, GroundedClaim } from "@/lib/types";
import type { DocEvidenceItem, StructuredClaimSet } from "@/lib/types/investigation";

export function buildAnswerMarkdownFromClaims(claims: StructuredClaimSet["claims"]) {
  return claims.map((claim) => `${claim.text} [${claim.citations.join("][")}]`).join("\n\n");
}

export function toGroundedClaims(claims: StructuredClaimSet["claims"]): GroundedClaim[] {
  return claims.map((claim) => ({
    text: claim.text,
    citationIds: claim.citations,
  }));
}

export function createDocEvidence(evidence: EvidenceChunk[]): DocEvidenceItem[] {
  return evidence.map((item) => ({
    id: formatCitationLabel(item.rank),
    sourceType: "doc",
    documentId: item.documentId,
    filename: item.filename,
    sectionTitle: item.sectionTitle,
    excerpt: item.content,
    score: item.score,
    chunkIndex: item.chunkIndex,
    ...(item.retrievalSource ? { retrievalSource: item.retrievalSource } : {}),
    ...(item.vectorScore !== undefined ? { vectorScore: item.vectorScore } : {}),
    ...(item.literalMatches?.length ? { literalMatches: item.literalMatches } : {}),
    ...(item.rerankScore !== undefined ? { rerankScore: item.rerankScore } : {}),
  }));
}

export function collectCitationIds(input: {
  customerReply: StructuredClaimSet;
  internalDiagnosis: StructuredClaimSet;
}) {
  return Array.from(
    new Set([
      ...input.customerReply.claims.flatMap((claim) => claim.citations),
      ...input.internalDiagnosis.claims.flatMap((claim) => claim.citations),
    ]),
  );
}
