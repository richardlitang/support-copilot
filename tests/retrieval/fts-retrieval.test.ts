import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());
const withPgClientMock = vi.hoisted(() =>
  vi.fn(async (callback: (client: { query: typeof queryMock }) => Promise<unknown>) =>
    callback({ query: queryMock }),
  ),
);
const configMock = vi.hoisted(() => ({ hasDirectDatabaseConfig: vi.fn() }));
const rpcMock = vi.hoisted(() => vi.fn());

vi.mock("@/src/server/db/client", () => ({ withPgClient: withPgClientMock }));
vi.mock("@/src/server/config/env", () => configMock);
vi.mock("@/src/server/db/supabaseAdmin", () => ({
  getSupabaseAdminClient: () => ({ rpc: rpcMock }),
}));

import { matchFtsDocumentChunksDirect } from "@/src/server/db/chunks";
import { matchFtsDocumentChunksDb } from "@/src/server/db/retrieval";

const row = {
  id: "chunk-1",
  document_id: "doc-1",
  filename: "payment-methods.md",
  section_title: "Card payments",
  content: "Cards are supported.",
  score: 0.82,
  chunk_index: 3,
};

describe("FTS retrieval adapters", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("calls the direct FTS RPC with ordered parameters and maps FTS provenance", async () => {
    queryMock.mockResolvedValue({ rows: [row] });

    const candidates = await matchFtsDocumentChunksDirect({
      sessionId: "session-1",
      query: "payment methods",
      matchCount: 20,
    });

    expect(queryMock).toHaveBeenCalledWith(
      "select * from match_fts_document_chunks($1, $2, $3)",
      ["session-1", "payment methods", 20],
    );
    expect(candidates).toEqual([
      expect.objectContaining({
        id: "chunk-1",
        documentId: "doc-1",
        retrievalSource: "fts",
        ftsScore: 0.82,
        rank: 1,
      }),
    ]);
  });

  it("uses the hosted RPC and maps its rows when direct Postgres is unavailable", async () => {
    configMock.hasDirectDatabaseConfig.mockReturnValue(false);
    rpcMock.mockResolvedValue({ data: [row], error: null });

    const candidates = await matchFtsDocumentChunksDb({
      sessionId: "session-1",
      query: "payment methods",
      matchCount: 20,
    });

    expect(rpcMock).toHaveBeenCalledWith("match_fts_document_chunks", {
      session_id_filter: "session-1",
      query_text: "payment methods",
      match_count: 20,
    });
    expect(candidates[0]).toMatchObject({
      id: "chunk-1",
      retrievalSource: "fts",
      ftsScore: 0.82,
    });
  });
});

describe("FTS migration contract", () => {
  it("defines the direct adapter's callable RPC signature", () => {
    const migration = readFileSync(
      resolve(import.meta.dirname, "../../supabase/migrations/20260619000000_hybrid_retrieval_fts.sql"),
      "utf8",
    );

    expect(migration).toContain("function public.match_fts_document_chunks(");
    expect(migration).toContain("session_id_filter text");
    expect(migration).toContain("query_text text");
    expect(migration).toContain("match_count integer default 50");
  });
});
