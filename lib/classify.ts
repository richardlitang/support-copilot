import type { EvidenceChunk } from "@/lib/types";
import type { InvestigationMode, ToolName } from "@/lib/types/investigation-v2";

export interface RoutingDecision {
  mode: InvestigationMode;
  requiredTools: ToolName[];
  routingReason: string;
}

const ACCOUNT_SPECIFIC_PATTERN =
  /\b(this customer|that customer|our workspace|my workspace|this workspace|our account|my account|this account)\b/i;
const FAILURE_PATTERN =
  /\b(fail|failing|failed|stall|stalled|stuck|not working|won't|cannot|can't|unable|error|issue|after setup)\b/i;
const PROCEDURAL_PATTERN = /\b(how do i|how to|enable|set up|setup|configure|steps|install|where can i|what is required)\b/i;
const FEATURE_FLAG_PATTERN = /\b(flag|rollout|disabled|not visible|missing feature|feature hidden|hidden feature)\b/i;
const ACCESS_PATTERN = /\b(can't access|cannot access|missing|not visible|unavailable|not showing)\b/i;
const PLAN_PATTERN = /\b(plan|tier|limit|limits|starter|basic|pro|enterprise)\b/i;

export function summarizeRetrievalStrength(evidence: EvidenceChunk[]) {
  const topScore = evidence[0]?.score ?? 0;
  const secondScore = evidence[1]?.score ?? 0;
  const strong = evidence.length > 0 && topScore >= 0.72 && (evidence.length === 1 || secondScore >= 0.58);
  const weak = !evidence.length || topScore < 0.5;

  return {
    evidenceCount: evidence.length,
    topScore,
    secondScore,
    strong,
    weak
  };
}

export function classifyInvestigation(input: {
  ticketText: string;
  selectedAccountId?: string | null;
  investigationContext?: string | null;
  evidence: EvidenceChunk[];
}): RoutingDecision {
  const ticket = input.ticketText.trim();
  const retrieval = summarizeRetrievalStrength(input.evidence);
  const hasProvidedContext = Boolean(input.investigationContext?.trim());
  const hasSeededAccount = Boolean(input.selectedAccountId);
  const mentionsAccountSpecificState = ACCOUNT_SPECIFIC_PATTERN.test(ticket);
  const mentionsFailure = FAILURE_PATTERN.test(ticket);
  const looksProcedural = PROCEDURAL_PATTERN.test(ticket);
  const needsFeatureFlags = FEATURE_FLAG_PATTERN.test(ticket);
  const needsAccessChecks = ACCESS_PATTERN.test(ticket) || (/\baccess\b/i.test(ticket) && !looksProcedural);
  const needsPlanContext = PLAN_PATTERN.test(ticket);
  const accountSpecificPlanContext = needsPlanContext && (mentionsAccountSpecificState || needsAccessChecks);
  const selectedAccountPlanContext = needsPlanContext && hasSeededAccount;
  const failureNeedsTools = mentionsFailure && (hasSeededAccount || hasProvidedContext);
  const requiresTools =
    mentionsAccountSpecificState ||
    accountSpecificPlanContext ||
    selectedAccountPlanContext ||
    needsFeatureFlags ||
    needsAccessChecks ||
    failureNeedsTools;

  const requiredTools: ToolName[] = [];

  if (hasProvidedContext) {
    requiredTools.push("getProvidedContext");
  }

  if (requiresTools && hasSeededAccount) {
    requiredTools.push("getAccountContext");
  }

  if ((needsFeatureFlags || needsAccessChecks) && hasSeededAccount) {
    requiredTools.push("getFeatureFlags");
  }

  if ((failureNeedsTools || /\b(import|export|sync|job)\b/i.test(ticket) && hasSeededAccount) && hasSeededAccount) {
    requiredTools.push("getRecentErrors");
  }

  const dedupedTools = Array.from(new Set(requiredTools));

  if (
    (mentionsAccountSpecificState || accountSpecificPlanContext || needsFeatureFlags || needsAccessChecks) &&
    !hasSeededAccount &&
    !hasProvidedContext
  ) {
    return {
      mode: "needs_human_review",
      requiredTools: dedupedTools,
      routingReason: "Structured product or account context is required for this ticket, but none was provided."
    };
  }

  if (dedupedTools.length && (hasSeededAccount || hasProvidedContext)) {
    const basis = [
      failureNeedsTools ? "failure language" : null,
      accountSpecificPlanContext || selectedAccountPlanContext ? "plan/limits language" : null,
      needsFeatureFlags ? "feature/flag language" : null,
      mentionsAccountSpecificState ? "account-specific phrasing" : null,
      hasProvidedContext ? "provided investigation context" : null
    ]
      .filter(Boolean)
      .join(", ");

    return {
      mode: "docs_plus_tools",
      requiredTools: dedupedTools,
      routingReason: `Ticket requires structured investigation context because it includes ${basis || "account-specific state"}.`
    };
  }

  if (retrieval.strong && (looksProcedural || !mentionsAccountSpecificState)) {
    return {
      mode: "docs_only",
      requiredTools: [],
      routingReason: "Strong retrieval and procedural language indicate documentation alone should be sufficient."
    };
  }

  return {
    mode: "docs_only",
    requiredTools: [],
    routingReason: retrieval.weak
      ? "Routing stayed docs-only, but retrieval support is weak and may require human review."
      : "Routing stayed docs-only because no account-specific evidence was required."
  };
}
