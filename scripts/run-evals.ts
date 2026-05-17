import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasDatabaseConfig } from "../src/server/db";
import { investigateTicket } from "../src/server/investigation/investigate";
import { createOfflineDependencies } from "./evals/offline";
import type { EvalCase, EvalSummary } from "./evals/types";
import { countClaimCitations, formatRuntimeFailure } from "./evals/utils";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const offlineMode =
  process.argv.includes("--offline") || process.env.SUPPORT_EVAL_OFFLINE === "true";

async function main() {
  if (!offlineMode && !hasDatabaseConfig()) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. `npm run eval:demo` requires a reachable seeded Supabase project. For deterministic checks use `npm run eval:rag-contract`.",
    );
  }

  const evalPath = path.join(__dirname, "..", "demo", "evals.json");
  const cases = JSON.parse(await readFile(evalPath, "utf8")) as EvalCase[];
  const evalSessionId = process.env.EVAL_SESSION_ID ?? "demo-seeded-session";
  const summary: EvalSummary[] = [];
  const failures: string[] = [];

  for (const testCase of cases) {
    const offlineDependencies = offlineMode ? createOfflineDependencies(testCase) : null;
    const result = await investigateTicket(
      {
        ticket: testCase.ticket,
        ragEnabled: true,
        sessionId: evalSessionId,
        selectedAccountId: testCase.selectedAccountId ?? null,
      },
      offlineDependencies ?? {},
    ).catch((error: unknown) => {
      throw new Error(
        `Eval case ${testCase.id} failed before assertions:\n${formatRuntimeFailure(error)}`,
      );
    });
    const expectedEvidenceKeywords = testCase.expectedEvidenceKeywords ?? [];
    const expectedClaimKeywords = testCase.expectedClaimKeywords ?? [];
    const forbiddenClaimKeywords = testCase.forbiddenClaimKeywords ?? [];
    const evidenceHaystack = result.docEvidence
      .map((item) => `${item.filename} ${item.sectionTitle ?? ""} ${item.excerpt}`)
      .join("\n")
      .toLowerCase();
    const claimHaystack = [
      result.customerReply.summary,
      ...result.customerReply.claims.map((claim) => claim.text),
      result.internalDiagnosis.summary,
      ...result.internalDiagnosis.claims.map((claim) => claim.text),
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();
    const missingEvidenceKeywords = expectedEvidenceKeywords.filter(
      (keyword) => !evidenceHaystack.includes(keyword.toLowerCase()),
    );
    const missingClaimKeywords = expectedClaimKeywords.filter(
      (keyword) => !claimHaystack.includes(keyword.toLowerCase()),
    );
    const presentForbiddenClaimKeywords = forbiddenClaimKeywords.filter((keyword) =>
      claimHaystack.includes(keyword.toLowerCase()),
    );
    const routePassed = !testCase.expectedMode || result.mode === testCase.expectedMode;
    const reviewPassed =
      !testCase.expectedReviewStatus || result.reviewStatus === testCase.expectedReviewStatus;
    const reviewReasonCodePassed =
      !testCase.expectedReviewReasonCode ||
      result.reviewDecision.reasonCode === testCase.expectedReviewReasonCode;
    const reviewActionPassed =
      !testCase.expectedReviewAction ||
      result.reviewDecision.action === testCase.expectedReviewAction;
    const retrievalPassed =
      (testCase.minDocEvidence ?? 0) <= result.docEvidence.length &&
      missingEvidenceKeywords.length === 0;
    const claimPassed = missingClaimKeywords.length === 0;
    const forbiddenClaimPassed = presentForbiddenClaimKeywords.length === 0;
    const toolPassed = !testCase.requireToolEvidence || result.toolEvidence.length > 0;
    const requireCitedClaimsWhenReady = testCase.requireCitedClaimsWhenReady ?? true;
    const citationCount = countClaimCitations(result);
    const citationPassed =
      !requireCitedClaimsWhenReady ||
      result.reviewStatus !== "ready" ||
      (result.customerReply.claims.length > 0 &&
        result.internalDiagnosis.claims.length > 0 &&
        citationCount > 0);
    const expectedIgnoredDocStatuses = testCase.expectedIgnoredDocStatuses ?? [
      "uploaded",
      "processing",
      "failed",
    ];
    const actualIgnoredDocStatuses = result.qualityCheck.retrieval.ignoredDocStatuses;
    const ignoredStatusPassed = expectedIgnoredDocStatuses.every((status) =>
      actualIgnoredDocStatuses.includes(status),
    );

    if (!routePassed) {
      failures.push(`${testCase.id}: expected mode ${testCase.expectedMode}, got ${result.mode}`);
    }

    if (!reviewPassed) {
      failures.push(
        `${testCase.id}: expected reviewStatus ${testCase.expectedReviewStatus}, got ${result.reviewStatus}`,
      );
    }

    if (!reviewReasonCodePassed) {
      failures.push(
        `${testCase.id}: expected review reason code ${testCase.expectedReviewReasonCode}, got ${result.reviewDecision.reasonCode}`,
      );
    }

    if (!reviewActionPassed) {
      failures.push(
        `${testCase.id}: expected review action ${testCase.expectedReviewAction}, got ${result.reviewDecision.action}`,
      );
    }

    if ((testCase.minDocEvidence ?? 0) > result.docEvidence.length) {
      failures.push(
        `${testCase.id}: expected at least ${testCase.minDocEvidence} doc evidence item(s), got ${result.docEvidence.length}`,
      );
    }

    if (missingEvidenceKeywords.length) {
      failures.push(
        `${testCase.id}: missing expected evidence keyword(s): ${missingEvidenceKeywords.join(", ")}`,
      );
    }

    if (missingClaimKeywords.length) {
      failures.push(
        `${testCase.id}: missing expected claim keyword(s): ${missingClaimKeywords.join(", ")}`,
      );
    }

    if (presentForbiddenClaimKeywords.length) {
      failures.push(
        `${testCase.id}: included forbidden claim keyword(s): ${presentForbiddenClaimKeywords.join(", ")}`,
      );
    }

    if (!toolPassed) {
      failures.push(`${testCase.id}: expected tool evidence, got none`);
    }

    if (!citationPassed) {
      failures.push(
        `${testCase.id}: expected cited customer/internal claims for ready review status, got ${citationCount} citation(s)`,
      );
    }
    if (!ignoredStatusPassed) {
      failures.push(
        `${testCase.id}: expected ignored doc statuses ${expectedIgnoredDocStatuses.join(", ")}, got ${actualIgnoredDocStatuses.join(", ")}`,
      );
    }

    summary.push({
      id: testCase.id,
      bucket: testCase.bucket,
      mode: result.mode,
      reviewStatus: result.reviewStatus,
      reviewReasonCode: result.reviewDecision.reasonCode,
      reviewAction: result.reviewDecision.action,
      supportLevel: result.supportLevel,
      insufficientSupport: result.supportLevel === "insufficient_support",
      customerClaims: result.customerReply.claims.length,
      internalClaims: result.internalDiagnosis.claims.length,
      citations: countClaimCitations(result),
      docEvidence: result.docEvidence.length,
      toolEvidence: result.toolEvidence.length,
      toolCalls: result.toolCalls.length,
      selectedAccountId: testCase.selectedAccountId ?? null,
      expectedMode: testCase.expectedMode ?? null,
      expectedReviewStatus: testCase.expectedReviewStatus ?? null,
      expectedReviewReasonCode: testCase.expectedReviewReasonCode ?? null,
      expectedReviewAction: testCase.expectedReviewAction ?? null,
      expectedEvidenceKeywords,
      missingEvidenceKeywords,
      expectedClaimKeywords,
      missingClaimKeywords,
      forbiddenClaimKeywords,
      presentForbiddenClaimKeywords,
      minDocEvidence: testCase.minDocEvidence ?? null,
      requireToolEvidence: testCase.requireToolEvidence ?? false,
      routePassed,
      reviewPassed,
      reviewReasonCodePassed,
      reviewActionPassed,
      retrievalPassed,
      claimPassed,
      forbiddenClaimPassed,
      toolPassed,
      citationPassed,
      ignoredStatusPassed,
      passed:
        routePassed &&
        reviewPassed &&
        reviewReasonCodePassed &&
        reviewActionPassed &&
        retrievalPassed &&
        claimPassed &&
        forbiddenClaimPassed &&
        toolPassed &&
        citationPassed &&
        ignoredStatusPassed,
      topDocs: result.docEvidence.slice(0, 3).map((item) => ({
        id: item.id,
        filename: item.filename,
        sectionTitle: item.sectionTitle,
        score: Number(item.score.toFixed(4)),
      })),
      expectation: testCase.expectation,
    });
  }

  const passedCount = summary.filter((item) => item.passed).length;
  const routePassed = summary.filter((item) => item.routePassed).length;
  const reviewPassed = summary.filter((item) => item.reviewPassed).length;
  const reviewReasonCodePassed = summary.filter((item) => item.reviewReasonCodePassed).length;
  const reviewActionPassed = summary.filter((item) => item.reviewActionPassed).length;
  const retrievalPassed = summary.filter((item) => item.retrievalPassed).length;
  const claimPassed = summary.filter((item) => item.claimPassed).length;
  const forbiddenClaimPassed = summary.filter((item) => item.forbiddenClaimPassed).length;
  const toolPassed = summary.filter((item) => item.toolPassed).length;
  const citationPassed = summary.filter((item) => item.citationPassed).length;
  const ignoredStatusPassed = summary.filter((item) => item.ignoredStatusPassed).length;

  console.log(`Support Copilot ${offlineMode ? "RAG contract" : "live eval"} summary`);
  console.log(`Mode: ${offlineMode ? "offline mock" : "live Supabase/OpenAI"}`);
  console.log(`Cases: ${passedCount}/${summary.length} passed`);
  console.log(`Routing: ${routePassed}/${summary.length} passed`);
  console.log(`Review: ${reviewPassed}/${summary.length} passed`);
  console.log(`Review reason codes: ${reviewReasonCodePassed}/${summary.length} passed`);
  console.log(`Review actions: ${reviewActionPassed}/${summary.length} passed`);
  console.log(`Retrieval: ${retrievalPassed}/${summary.length} passed`);
  console.log(`Claim content: ${claimPassed}/${summary.length} passed`);
  console.log(`Forbidden claims: ${forbiddenClaimPassed}/${summary.length} passed`);
  console.log(`Tool evidence: ${toolPassed}/${summary.length} passed`);
  console.log(`Citation readiness: ${citationPassed}/${summary.length} passed`);
  console.log(`Ignored doc statuses: ${ignoredStatusPassed}/${summary.length} passed`);

  console.log("\nCase results:");
  for (const item of summary) {
    const status = item.passed ? "PASS" : "FAIL";
    const topDocList = item.topDocs.length
      ? item.topDocs
          .map(
            (doc) =>
              `${doc.id}:${doc.filename}${doc.sectionTitle ? `#${doc.sectionTitle}` : ""}@${doc.score}`,
          )
          .join(", ")
      : "none";
    console.log(
      `- ${status} ${item.id} [${item.bucket}] mode=${item.mode} review=${item.reviewStatus} reason=${item.reviewReasonCode} action=${item.reviewAction} docs=${item.docEvidence} tools=${item.toolEvidence} top=${topDocList}`,
    );
    if (item.missingEvidenceKeywords.length) {
      console.log(`  missing evidence keywords: ${item.missingEvidenceKeywords.join(", ")}`);
    }
    if (item.missingClaimKeywords.length) {
      console.log(`  missing claim keywords: ${item.missingClaimKeywords.join(", ")}`);
    }
    if (item.presentForbiddenClaimKeywords.length) {
      console.log(
        `  forbidden claim keywords present: ${item.presentForbiddenClaimKeywords.join(", ")}`,
      );
    }
    if (!item.reviewReasonCodePassed) {
      console.log(`  expected review reason code: ${item.expectedReviewReasonCode ?? "none"}`);
    }
    if (!item.reviewActionPassed) {
      console.log(`  expected review action: ${item.expectedReviewAction ?? "none"}`);
    }
  }

  if (failures.length) {
    console.error("\nEval failures:");
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }

  console.log(`\nAll ${cases.length} evals passed.`);
}

main().catch((error) => {
  console.error(formatRuntimeFailure(error));
  process.exit(1);
});
