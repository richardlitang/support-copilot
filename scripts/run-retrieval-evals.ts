import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EvidenceChunk, RetrievalBoundaryTrace } from "../lib/types";
import { retrieveEvidence } from "../src/server/retrieval/retrieve";
import type {
  RetrievalEvalCase,
  RetrievalEvalSummary,
  RetrievalGoldExpectation,
} from "./evals/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultSessionId = process.env.EVAL_SESSION_ID ?? "demo-seeded-session";

export function matchesGold(candidate: EvidenceChunk, expected: RetrievalGoldExpectation) {
  const filenamePassed =
    !expected.filenameIncludes ||
    candidate.filename.toLowerCase().includes(expected.filenameIncludes.toLowerCase());
  const sectionTitlePassed =
    !expected.sectionTitleIncludes ||
    (candidate.sectionTitle ?? "")
      .toLowerCase()
      .includes(expected.sectionTitleIncludes.toLowerCase());
  const content = candidate.content.toLowerCase();
  const contentPassed = expected.contentIncludes.every((part) =>
    content.includes(part.toLowerCase()),
  );

  return filenamePassed && sectionTitlePassed && contentPassed;
}

async function main() {
  const evalPath = path.join(__dirname, "..", "demo", "retrieval-evals.json");
  const cases = JSON.parse(await readFile(evalPath, "utf8")) as RetrievalEvalCase[];
  const summaries: RetrievalEvalSummary[] = [];

  for (const testCase of cases) {
    let trace: RetrievalBoundaryTrace | undefined;
    const finalCandidates = await retrieveEvidence({
      question: testCase.query,
      sessionId: testCase.sessionId ?? defaultSessionId,
      onTrace: (nextTrace) => {
        trace = nextTrace;
      },
    });
    const inputCandidates = trace?.rerankerInputCandidates ?? [];
    const matchedInputIds = inputCandidates
      .filter((candidate) => matchesGold(candidate, testCase.expectedGold))
      .map((candidate) => candidate.id);
    const matchedFinalIds = finalCandidates
      .filter((candidate) => matchesGold(candidate, testCase.expectedGold))
      .map((candidate) => candidate.id);

    summaries.push({
      id: testCase.id,
      slice: testCase.slice,
      query: testCase.query,
      inputRecallPassed: matchedInputIds.length > 0,
      outputRecallPassed: matchedFinalIds.length > 0,
      rerankerInputCount: inputCandidates.length,
      finalCount: finalCandidates.length,
      matchedInputIds,
      matchedFinalIds,
    });
  }

  for (const summary of summaries) {
    console.log(JSON.stringify(summary));
  }

  if (summaries.some((summary) => !summary.inputRecallPassed || !summary.outputRecallPassed)) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
