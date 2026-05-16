import { getCohereApiKey, getRerankModel } from "@/src/server/ai/openai";
import type { EvidenceChunk } from "@/lib/types";

type CohereRerankResponse = {
  results?: Array<{
    index?: number;
    relevance_score?: number;
  }>;
};

export async function rerankEvidenceCandidates(input: {
  query: string;
  candidates: EvidenceChunk[];
  topN: number;
  fetcher?: typeof fetch;
}) {
  const apiKey = getCohereApiKey();

  if (!apiKey || input.candidates.length <= 1) {
    return [];
  }

  const fetcher = input.fetcher ?? fetch;
  const response = await fetcher("https://api.cohere.com/v2/rerank", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Client-Name": "support-copilot",
    },
    body: JSON.stringify({
      model: getRerankModel(),
      query: input.query,
      documents: input.candidates.map((candidate) => candidate.content),
      top_n: Math.min(input.topN, input.candidates.length),
      max_tokens_per_doc: 1200,
    }),
  });

  if (!response.ok) {
    throw new Error(`Rerank request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as CohereRerankResponse;

  return (payload.results ?? [])
    .filter((result): result is { index: number; relevance_score: number } => {
      return typeof result.index === "number" && typeof result.relevance_score === "number";
    })
    .map((result) => ({
      index: result.index,
      score: result.relevance_score,
    }));
}
