export type DocumentStatus = "processing" | "ready" | "failed";
export type SupportLevel = "high" | "medium" | "low" | "insufficient_support";

export interface DocumentRecord {
  id: string;
  sessionId: string | null;
  filename: string;
  contentType: string | null;
  status: DocumentStatus;
  createdAt: string;
}

export interface ParsedSection {
  title: string | null;
  content: string;
}

export interface ParsedDocument {
  filename: string;
  contentType: string;
  rawText: string;
  sections: ParsedSection[];
  sourceType: "upload" | "demo";
}

export interface ChunkCandidate {
  chunkIndex: number;
  sectionTitle: string | null;
  content: string;
  tokenCount: number;
  metadata: Record<string, unknown>;
}

export interface StoredChunk extends ChunkCandidate {
  documentId: string;
  embedding: number[];
}

export interface EvidenceChunk {
  id: string;
  documentId: string;
  filename: string;
  sectionTitle: string | null;
  content: string;
  score: number;
  rank: number;
  chunkIndex: number;
  retrievalSource?: "vector" | "literal" | "hybrid";
  vectorScore?: number;
  literalMatches?: string[];
  rerankScore?: number;
}

export interface CitationReference {
  label: string;
  filename: string;
  sectionTitle: string | null;
  excerpt: string;
}

export interface GroundedClaim {
  text: string;
  citationIds: string[];
}

export interface StructuredAnswer {
  answer: string;
  claims: GroundedClaim[];
  supportLevel: SupportLevel;
  citations: string[];
  insufficientSupport: boolean;
}

export interface InvestigationResult {
  investigationId: string;
  ticketId: string;
  answer: string;
  claims: GroundedClaim[];
  supportLevel: SupportLevel;
  insufficientSupport: boolean;
  citations: string[];
  evidence: EvidenceChunk[];
}

export interface UploadOutcome {
  filename: string;
  status: "ready" | "failed";
  message: string;
}
