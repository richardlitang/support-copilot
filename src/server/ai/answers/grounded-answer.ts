import { buildCitationReferences, normalizeCitationLabels } from "@/lib/citations";
import { getRuntimeConfig } from "@/src/server/config/env";
import { answerSchema } from "@/src/server/ai/answers/schemas";
import { createStructuredJsonResponse } from "@/src/server/ai/provider";
import type { EvidenceChunk, GroundedClaim, StructuredAnswer } from "@/lib/types";

export function buildInsufficientSupportAnswer(): StructuredAnswer {
  return {
    answer:
      "I do not have enough support in the uploaded docs to answer this confidently. This needs human review or additional documentation.",
    claims: [],
    supportLevel: "insufficient_support",
    citations: [],
    insufficientSupport: true,
  };
}

function normalizeClaims(claims: GroundedClaim[], allowedLabels: string[]) {
  const seenTexts = new Set<string>();
  const normalized: GroundedClaim[] = [];

  for (const claim of claims) {
    const text = claim.text.replace(/\s+/g, " ").trim();
    const key = text.toLowerCase();
    const citationIds = normalizeCitationLabels(claim.citationIds, allowedLabels);

    if (!text || seenTexts.has(key) || !citationIds.length) {
      continue;
    }

    normalized.push({
      text,
      citationIds,
    });
    seenTexts.add(key);
  }

  return normalized;
}

function buildAnswerFromClaims(claims: GroundedClaim[]) {
  return claims.map((claim) => `${claim.text} [${claim.citationIds.join("][")}]`).join("\n\n");
}

export function validateGroundedAnswer(input: {
  answer: StructuredAnswer;
  evidence: EvidenceChunk[];
}) {
  const allowedByLabel = new Map(input.evidence.map((item) => [`S${item.rank}`, item]));
  const claims = normalizeClaims(input.answer.claims, Array.from(allowedByLabel.keys()));

  if (input.answer.insufficientSupport) {
    return {
      valid: true,
      answer: buildInsufficientSupportAnswer(),
    } as const;
  }

  if (!claims.length) {
    return {
      valid: false,
      reason: "No valid grounded claims were returned.",
    } as const;
  }

  for (const claim of claims) {
    if (claim.text.length > 360) {
      return {
        valid: false,
        reason: "Claim exceeded the allowed length.",
      } as const;
    }

    for (const citationId of claim.citationIds) {
      const evidence = allowedByLabel.get(citationId);

      if (!evidence) {
        return {
          valid: false,
          reason: `Claim cited unknown evidence ${citationId}.`,
        } as const;
      }

      const evidenceWordCount = evidence.content.split(/\s+/).filter(Boolean).length;
      const claimWordCount = claim.text.split(/\s+/).filter(Boolean).length;

      if (claimWordCount > evidenceWordCount + 30) {
        return {
          valid: false,
          reason: "Claim appears broader than its cited evidence.",
        } as const;
      }
    }
  }

  const citations = normalizeCitationLabels(
    claims.flatMap((claim) => claim.citationIds),
    Array.from(allowedByLabel.keys()),
  );

  return {
    valid: true,
    answer: {
      ...input.answer,
      claims,
      citations,
      answer: buildAnswerFromClaims(claims),
    } satisfies StructuredAnswer,
  } as const;
}

async function requestGroundedAnswer(input: {
  ticket: string;
  evidence: EvidenceChunk[];
  stricterRetry: boolean;
}) {
  if (getRuntimeConfig().aiProvider === "mock") {
    const citations = buildCitationReferences(input.evidence);
    const firstCitation = citations[0];

    if (!firstCitation) {
      return buildInsufficientSupportAnswer();
    }

    const claimText = firstCitation.excerpt.slice(0, 180);

    return {
      answer: claimText,
      claims: [
        {
          text: claimText,
          citationIds: [firstCitation.label],
        },
      ],
      supportLevel: "medium",
      citations: [firstCitation.label],
      insufficientSupport: false,
    } satisfies StructuredAnswer;
  }

  const citations = buildCitationReferences(input.evidence);

  return createStructuredJsonResponse<StructuredAnswer>({
    schema: answerSchema,
    emptyResponseMessage: "The answer model returned an empty response.",
    messages: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: input.stricterRetry
              ? "You are Support Copilot. Return claims directly supported by evidence. Include all materially distinct causes/checks/fixes present in evidence (especially troubleshooting tables), but do not infer beyond cited text. Every claim must include at least one valid citation ID. If evidence is insufficient, set insufficientSupport to true and return no claims."
              : "You are Support Copilot. Answer only from provided evidence. Do not use outside knowledge. Return a short summary answer plus a claims array that captures all materially distinct supported points (including multiple causes/fixes when present). Every claim must include at least one valid citation ID. If evidence is weak or incomplete, set insufficientSupport to true and return no claims.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Support ticket:\n${input.ticket}\n\nEvidence:\n${citations
              .map(
                (item) =>
                  `${item.label} | ${item.filename}${item.sectionTitle ? ` | ${item.sectionTitle}` : ""}\n${item.excerpt}`,
              )
              .join("\n\n")}`,
          },
        ],
      },
    ],
  });
}

export async function generateGroundedAnswer(input: { ticket: string; evidence: EvidenceChunk[] }) {
  if (!input.evidence.length) {
    return buildInsufficientSupportAnswer();
  }

  const firstPass = await requestGroundedAnswer({
    ticket: input.ticket,
    evidence: input.evidence,
    stricterRetry: false,
  });
  const firstValidation = validateGroundedAnswer({
    answer: firstPass,
    evidence: input.evidence,
  });

  if (firstValidation.valid) {
    return firstValidation.answer;
  }

  const secondPass = await requestGroundedAnswer({
    ticket: input.ticket,
    evidence: input.evidence,
    stricterRetry: true,
  });
  const secondValidation = validateGroundedAnswer({
    answer: secondPass,
    evidence: input.evidence,
  });

  if (secondValidation.valid) {
    return secondValidation.answer;
  }

  return buildInsufficientSupportAnswer();
}
