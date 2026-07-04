export type SetupStage = "docs" | "ticket" | "investigate" | "review";

export interface NextAction {
  stage: SetupStage;
  index: number;
  label: string;
  hint: string;
}

export interface GuidanceInput {
  documentCount: number;
  ticketText: string;
  isInvestigating?: boolean;
  hasResult?: boolean;
}

export function resolveNextAction(input: GuidanceInput): NextAction {
  if (input.documentCount === 0) {
    return {
      stage: "docs",
      index: 1,
      label: "Add support docs",
      hint: "Upload the documentation this ticket should be answered from.",
    };
  }
  if (!input.ticketText.trim()) {
    return {
      stage: "ticket",
      index: 2,
      label: "Paste the ticket",
      hint: "Drop in the customer's message to investigate.",
    };
  }
  if (input.isInvestigating || input.hasResult) {
    return {
      stage: "review",
      index: 4,
      label: input.isInvestigating ? "Investigation running" : "Review the answer",
      hint: input.isInvestigating
        ? "Retrieving evidence, routing, and drafting cited claims."
        : "Check each citation against its exhibit, then copy the reply or start a new ticket.",
    };
  }
  return {
    stage: "investigate",
    index: 3,
    label: "Run investigation",
    hint: "Retrieve evidence, route, and draft a cited answer.",
  };
}

export function setupSteps(
  input: GuidanceInput,
): Array<{ stage: SetupStage; label: string; state: "done" | "active" | "upcoming" }> {
  const active = resolveNextAction(input).stage;
  const order: Array<{ stage: SetupStage; label: string }> = [
    { stage: "docs", label: "Docs" },
    { stage: "ticket", label: "Ticket" },
    { stage: "investigate", label: "Run" },
    { stage: "review", label: "Review" },
  ];
  const activeIndex = order.findIndex((s) => s.stage === active);
  return order.map((s, i) => ({
    ...s,
    state: i < activeIndex ? "done" : i === activeIndex ? "active" : "upcoming",
  }));
}
