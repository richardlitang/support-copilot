export type SetupStage = "docs" | "ticket" | "investigate";

export interface NextAction {
  stage: SetupStage;
  index: number;
  label: string;
  hint: string;
}

export function resolveNextAction(input: {
  documentCount: number;
  ticketText: string;
}): NextAction {
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
  return {
    stage: "investigate",
    index: 3,
    label: "Run investigation",
    hint: "Retrieve evidence, route, and draft a cited answer.",
  };
}

export function setupSteps(input: {
  documentCount: number;
  ticketText: string;
}): Array<{ stage: SetupStage; label: string; state: "done" | "active" | "upcoming" }> {
  const active = resolveNextAction(input).stage;
  const order: Array<{ stage: SetupStage; label: string }> = [
    { stage: "docs", label: "Docs" },
    { stage: "ticket", label: "Ticket" },
    { stage: "investigate", label: "Run" },
  ];
  const activeIndex = order.findIndex((s) => s.stage === active);
  return order.map((s, i) => ({
    ...s,
    state: i < activeIndex ? "done" : i === activeIndex ? "active" : "upcoming",
  }));
}
