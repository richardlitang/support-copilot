import { normalizeSourceLabels } from "@/lib/citations";
import { getRuntimeConfig } from "@/lib/env";
import { investigationAnswerSchema, type StructuredInvestigationDraft } from "@/lib/ai/schemas";
import { createStructuredJsonResponse } from "@/src/server/ai/provider";
import type {
  CitationId,
  DocEvidenceItem,
  StructuredClaim,
  StructuredClaimSet,
  StructuredClaimSetWithOpenQuestions,
  ToolEvidenceItem,
} from "@/lib/types/investigation";

type EvidenceRegistryItem = DocEvidenceItem | ToolEvidenceItem;

const claimValidationStopwords = new Set([
  "about",
  "account",
  "after",
  "also",
  "and",
  "are",
  "but",
  "can",
  "cannot",
  "customer",
  "does",
  "for",
  "from",
  "have",
  "into",
  "not",
  "only",
  "our",
  "should",
  "that",
  "the",
  "their",
  "this",
  "was",
  "with",
  "without",
  "your",
]);

function deriveSummary(claims: StructuredClaim[]) {
  if (!claims.length) {
    return undefined;
  }

  if (claims.length === 1) {
    return claims[0]?.text;
  }

  return `${claims[0]?.text} ${claims[1]?.text}`.trim();
}

function normalizeStructuredClaims(
  claims: Array<{ text: string; citations: string[] }>,
  allowedLabels: string[],
): StructuredClaim[] {
  const seenTexts = new Set<string>();
  const normalized: StructuredClaim[] = [];

  for (const claim of claims) {
    const text = claim.text.replace(/\s+/g, " ").trim();
    const key = text.toLowerCase();
    const citations = normalizeSourceLabels(claim.citations, allowedLabels) as CitationId[];

    if (!text || !citations.length || seenTexts.has(key)) {
      continue;
    }

    normalized.push({ text, citations });
    seenTexts.add(key);
  }

  return normalized;
}

function extractRequiredDiagnosticTokens(toolEvidence: ToolEvidenceItem[]) {
  const exactErrorTokens = toolEvidence
    .filter((item) => item.toolName === "getRecentErrors")
    .flatMap((item) => item.excerpt.match(/\b[A-Z][A-Z0-9]+-[A-Z0-9]+\b/g) ?? []);
  const rowTokens = toolEvidence
    .filter((item) => item.toolName === "getRecentErrors" && /\brows?\b/i.test(item.excerpt))
    .map(() => "row");

  return Array.from(new Set([...exactErrorTokens, ...rowTokens]));
}

function buildRequiredDiagnosticTokenAnswer(input: {
  token: string;
  toolEvidence: ToolEvidenceItem[];
}): {
  customerReply: StructuredClaimSet;
  internalDiagnosis: StructuredClaimSetWithOpenQuestions;
  insufficientSupport: boolean;
} | null {
  const recentError = input.toolEvidence.find(
    (item) =>
      item.toolName === "getRecentErrors" &&
      item.excerpt.toLowerCase().includes(input.token.toLowerCase()),
  );

  if (!recentError) {
    return null;
  }

  const citation = recentError.id;
  const claimText =
    input.token === "row"
      ? "The recent error evidence points to row validation near the configured row limit."
      : /\bpermission\b/i.test(recentError.excerpt)
        ? `The recent error evidence includes ${input.token}, which points to a permission issue.`
        : `The recent error evidence includes ${input.token}.`;
  const customerReply: StructuredClaimSet = {
    summary: claimText,
    claims: [{ text: claimText, citations: [citation] }],
  };
  const internalDiagnosis: StructuredClaimSetWithOpenQuestions = {
    summary: claimText,
    claims: [{ text: claimText, citations: [citation] }],
    openQuestions: [],
  };

  return {
    customerReply,
    internalDiagnosis,
    insufficientSupport: false,
  };
}

function tokenizeClaimValidationText(text: string) {
  return (
    text
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((token) => token.length > 2 && !claimValidationStopwords.has(token)) ?? []
  );
}

function validateCitationOverlap(claim: StructuredClaim, sources: EvidenceRegistryItem[]) {
  const claimTokens = Array.from(new Set(tokenizeClaimValidationText(claim.text)));

  if (!claimTokens.length) {
    return { valid: true } as const;
  }

  const evidenceTokens = new Set(
    sources.flatMap((source) => tokenizeClaimValidationText(source.excerpt)),
  );

  if (!evidenceTokens.size) {
    return { valid: true } as const;
  }

  const overlapCount = claimTokens.filter((token) => evidenceTokens.has(token)).length;
  const minimumOverlap = claimTokens.length <= 3 ? 1 : 2;
  const overlapRatio = overlapCount / claimTokens.length;

  if (overlapCount < minimumOverlap && overlapRatio < 0.25) {
    return {
      valid: false,
      reason: "Claim does not appear supported by its cited evidence.",
    } as const;
  }

  return { valid: true } as const;
}

function validateClaimBreadth(claim: StructuredClaim, registry: Map<string, EvidenceRegistryItem>) {
  let docWordBudget = 0;
  const citedSources: EvidenceRegistryItem[] = [];

  for (const citation of claim.citations) {
    const source = registry.get(citation);

    if (!source) {
      return {
        valid: false,
        reason: `Unknown citation ${citation}.`,
      } as const;
    }

    citedSources.push(source);

    if (source.sourceType === "doc") {
      const words = source.excerpt.split(/\s+/).filter(Boolean).length;
      docWordBudget = Math.max(docWordBudget, words + 30);
    }
  }

  if (claim.text.length > 360) {
    return {
      valid: false,
      reason: "Claim exceeded the allowed length.",
    } as const;
  }

  if (docWordBudget > 0) {
    const claimWordCount = claim.text.split(/\s+/).filter(Boolean).length;

    if (claimWordCount > docWordBudget) {
      return {
        valid: false,
        reason: "Claim appears broader than its cited documentation evidence.",
      } as const;
    }
  }

  const overlapValidation = validateCitationOverlap(claim, citedSources);

  if (!overlapValidation.valid) {
    return overlapValidation;
  }

  return { valid: true } as const;
}

export function buildStructuredHumanReviewFallback(input: {
  customerMessage?: string;
  internalMessage: string;
  citations?: CitationId[];
  openQuestions?: string[];
}) {
  const citations = input.citations ?? [];
  const customerReply: StructuredClaimSet = {
    claims:
      input.customerMessage && citations.length ? [{ text: input.customerMessage, citations }] : [],
  };
  const internalDiagnosis: StructuredClaimSetWithOpenQuestions = {
    claims: citations.length ? [{ text: input.internalMessage, citations }] : [],
    openQuestions: input.openQuestions ?? [input.internalMessage],
  };

  customerReply.summary = deriveSummary(customerReply.claims);
  internalDiagnosis.summary = deriveSummary(internalDiagnosis.claims);

  return {
    customerReply,
    internalDiagnosis,
    insufficientSupport: true,
  };
}

export function validateInvestigationAnswer(input: {
  answer: StructuredInvestigationDraft;
  docEvidence: DocEvidenceItem[];
  toolEvidence: ToolEvidenceItem[];
}) {
  const registry = new Map<string, EvidenceRegistryItem>();

  for (const item of input.docEvidence) {
    registry.set(item.id, item);
  }

  for (const item of input.toolEvidence) {
    registry.set(item.id, item);
  }

  const allowedLabels = Array.from(registry.keys());
  const customerClaims = normalizeStructuredClaims(input.answer.customerReplyClaims, allowedLabels);
  const internalClaims = normalizeStructuredClaims(
    input.answer.internalDiagnosisClaims,
    allowedLabels,
  );

  if (input.answer.customerReplyClaims.length > 0 && customerClaims.length === 0) {
    return {
      valid: false,
      reason: "Customer reply claims did not contain any valid citations.",
    } as const;
  }

  if (input.answer.internalDiagnosisClaims.length > 0 && internalClaims.length === 0) {
    return {
      valid: false,
      reason: "Internal diagnosis claims did not contain any valid citations.",
    } as const;
  }

  for (const claim of [...customerClaims, ...internalClaims]) {
    const validation = validateClaimBreadth(claim, registry);

    if (!validation.valid) {
      return validation;
    }
  }

  if (!input.answer.insufficientSupport) {
    const claimText = [...customerClaims, ...internalClaims].map((claim) => claim.text).join("\n");
    const missingDiagnosticTokens = extractRequiredDiagnosticTokens(input.toolEvidence).filter(
      (token) => !claimText.includes(token),
    );

    if (missingDiagnosticTokens.length) {
      return {
        valid: false,
        reason: `Missing required diagnostic token ${missingDiagnosticTokens[0]}.`,
      } as const;
    }
  }

  return {
    valid: true,
    answer: {
      customerReply: {
        summary: deriveSummary(customerClaims),
        claims: customerClaims,
      },
      internalDiagnosis: {
        summary: deriveSummary(internalClaims),
        claims: internalClaims,
        openQuestions: input.answer.openQuestions
          .map((item) => item.replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .slice(0, 5),
      },
      insufficientSupport: input.answer.insufficientSupport,
    },
  } as const;
}

async function requestInvestigationAnswer(input: {
  ticket: string;
  mode: string;
  routingReason: string;
  docEvidence: DocEvidenceItem[];
  toolEvidence: ToolEvidenceItem[];
  stricterRetry: boolean;
}) {
  if (getRuntimeConfig().aiProvider === "mock") {
    const firstDoc = input.docEvidence[0];
    const firstTool = input.toolEvidence[0];

    if (!firstDoc && !firstTool) {
      return {
        customerReplyClaims: [],
        internalDiagnosisClaims: [],
        openQuestions: ["Add ready documentation or support context for this case."],
        insufficientSupport: true,
      } satisfies StructuredInvestigationDraft;
    }

    if (firstDoc) {
      const claimText = firstDoc.excerpt.slice(0, 180);
      return {
        customerReplyClaims: [
          {
            text: claimText,
            citations: [firstDoc.id],
          },
        ],
        internalDiagnosisClaims: [
          {
            text: claimText,
            citations: [firstDoc.id],
          },
        ],
        openQuestions: [],
        insufficientSupport: false,
      } satisfies StructuredInvestigationDraft;
    }

    return {
      customerReplyClaims: [
        {
          text: `The available support context points to ${firstTool?.title ?? "the selected account context"}.`,
          citations: [firstTool?.id ?? "T1"],
        },
      ],
      internalDiagnosisClaims: [
        {
          text: `The investigation used support context from ${firstTool?.title ?? "the selected account context"}.`,
          citations: [firstTool?.id ?? "T1"],
        },
      ],
      openQuestions: [],
      insufficientSupport: false,
    } satisfies StructuredInvestigationDraft;
  }

  const docBlock = input.docEvidence.length
    ? input.docEvidence
        .map(
          (item) =>
            `${item.id} | ${item.filename}${item.sectionTitle ? ` | ${item.sectionTitle}` : ""} | score ${Math.round(item.score * 100)}%\n${item.excerpt}`,
        )
        .join("\n\n")
    : "None";
  const toolBlock = input.toolEvidence.length
    ? input.toolEvidence
        .map((item) => `${item.id} | ${item.toolName} | ${item.title}\n${item.excerpt}`)
        .join("\n\n")
    : "None";
  const requiredDiagnosticTokens = extractRequiredDiagnosticTokens(input.toolEvidence);

  return createStructuredJsonResponse<StructuredInvestigationDraft>({
    schema: investigationAnswerSchema,
    emptyResponseMessage: "The investigation model returned an empty response.",
    messages: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: input.stricterRetry
              ? "You are Support Copilot. Produce only grounded structured claims. Every claim must cite at least one valid source ID from the provided documentation evidence or tool evidence. Customer reply must stay short and cautious. Internal diagnosis may be more explicit. Preserve exact plan tiers, limits, row counts, feature flag names, and error codes from cited evidence when they explain the case. If support is insufficient or unresolved, set insufficientSupport to true and prefer fewer claims over speculation."
              : "You are Support Copilot. Use only the provided documentation evidence and tool evidence. Do not use outside knowledge. Produce concise structured claims for a customer-facing reply and a separate internal diagnosis. Every claim must cite at least one valid source ID. Preserve exact plan tiers, limits, row counts, feature flag names, and error codes from cited evidence when they explain the case. If evidence is incomplete or conflicting, set insufficientSupport to true.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              `Support ticket:\n${input.ticket}\n\n` +
              `Routing mode:\n${input.mode}\n\n` +
              `Routing reason:\n${input.routingReason}\n\n` +
              `Documentation evidence:\n${docBlock}\n\n` +
              `Tool evidence:\n${toolBlock}\n\n` +
              `Required exact diagnostic tokens:\n${requiredDiagnosticTokens.length ? requiredDiagnosticTokens.join(", ") : "None"}`,
          },
        ],
      },
    ],
  });
}

export async function generateInvestigationAnswer(input: {
  ticket: string;
  mode: string;
  routingReason: string;
  docEvidence: DocEvidenceItem[];
  toolEvidence: ToolEvidenceItem[];
}) {
  if (!input.docEvidence.length && !input.toolEvidence.length) {
    return buildStructuredHumanReviewFallback({
      internalMessage: "No documentation or tool evidence was available for this investigation.",
    });
  }

  const firstPass = await requestInvestigationAnswer({
    ...input,
    stricterRetry: false,
  });
  const firstValidation = validateInvestigationAnswer({
    answer: firstPass,
    docEvidence: input.docEvidence,
    toolEvidence: input.toolEvidence,
  });

  if (firstValidation.valid) {
    return firstValidation.answer;
  }

  const secondPass = await requestInvestigationAnswer({
    ...input,
    stricterRetry: true,
  });
  const secondValidation = validateInvestigationAnswer({
    answer: secondPass,
    docEvidence: input.docEvidence,
    toolEvidence: input.toolEvidence,
  });

  if (secondValidation.valid) {
    return secondValidation.answer;
  }

  const requiredDiagnosticTokens = extractRequiredDiagnosticTokens(input.toolEvidence);
  const missingDiagnosticToken = secondValidation.reason.match(
    /^Missing required diagnostic token (.+)\.$/,
  )?.[1];
  const diagnosticToken = missingDiagnosticToken ?? requiredDiagnosticTokens[0];
  const diagnosticTokenAnswer = diagnosticToken
    ? buildRequiredDiagnosticTokenAnswer({
        token: diagnosticToken,
        toolEvidence: input.toolEvidence,
      })
    : null;

  if (diagnosticTokenAnswer) {
    return diagnosticTokenAnswer;
  }

  return {
    ...buildStructuredHumanReviewFallback({
      internalMessage:
        "The model could not produce a fully grounded structured response from the available evidence.",
    }),
    validationFailed: true,
  };
}
