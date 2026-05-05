import type { InvestigationExecutionMode } from "@/lib/types/investigation";

export const MAX_TICKET_LENGTH = 6000;
export const MAX_INVESTIGATION_CONTEXT_LENGTH = 4000;

export type InvestigationRequest = {
  ticket: string;
  executionMode: InvestigationExecutionMode;
  ragEnabled: boolean;
  selectedAccountId: string | null;
  investigationContext: string | null;
};

export class InvestigationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvestigationRequestError";
  }
}

export function normalizeInvestigationRequest(body: unknown): InvestigationRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new InvestigationRequestError("Send a JSON object with a support ticket.");
  }

  const input = body as Record<string, unknown>;
  const ticket = typeof input.ticket === "string" ? input.ticket.trim() : "";
  const investigationContext =
    typeof input.investigationContext === "string" && input.investigationContext.trim()
      ? input.investigationContext.trim()
      : null;
  const selectedAccountId =
    typeof input.selectedAccountId === "string" && input.selectedAccountId.trim() ? input.selectedAccountId.trim() : null;
  const executionMode = input.executionMode === "evidence_only" ? "evidence_only" : "draft_answer";

  if (!ticket) {
    throw new InvestigationRequestError("Paste a support ticket before investigating.");
  }

  if (ticket.length > MAX_TICKET_LENGTH) {
    throw new InvestigationRequestError(`Ticket is too long. Keep it under ${MAX_TICKET_LENGTH.toLocaleString()} characters.`);
  }

  if (investigationContext && investigationContext.length > MAX_INVESTIGATION_CONTEXT_LENGTH) {
    throw new InvestigationRequestError(
      `Investigation context is too long. Keep it under ${MAX_INVESTIGATION_CONTEXT_LENGTH.toLocaleString()} characters.`
    );
  }

  if (selectedAccountId && selectedAccountId.length > 120) {
    throw new InvestigationRequestError("Selected account id is invalid.");
  }

  return {
    ticket,
    executionMode,
    ragEnabled: typeof input.ragEnabled === "boolean" ? input.ragEnabled : true,
    selectedAccountId,
    investigationContext
  };
}
