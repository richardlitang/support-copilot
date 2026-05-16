import { hasDirectDatabaseConfig } from "@/lib/env";
import type {
  InvestigationMode,
  ReviewDecision,
  ReviewStatus,
  StructuredClaimSet,
  StructuredClaimSetWithOpenQuestions,
  ToolCallRecord,
} from "@/lib/types/investigation";
import type { SupportLevel } from "@/lib/types";
import { withPgClient } from "@/src/server/db/client";
import { getSupabaseAdminClient } from "@/src/server/db/supabaseAdmin";

type InvestigationJsonPayload = StructuredClaimSet | StructuredClaimSetWithOpenQuestions;

function isSchemaCompatibilityError(message: string) {
  return (
    message.includes("schema cache") ||
    message.includes("Could not find the") ||
    message.includes("does not exist") ||
    message.includes("column") ||
    message.includes("relation")
  );
}

export async function createInvestigationDirect(input: {
  ticketId: string;
  status: string;
  answerMarkdown: string;
  supportLevel: SupportLevel;
  mode?: InvestigationMode | null;
  reviewStatus?: ReviewStatus | null;
  reviewDecision?: ReviewDecision | null;
  routingReason?: string | null;
  accountId?: string | null;
  customerReplyJson?: StructuredClaimSet | null;
  internalDiagnosisJson?: StructuredClaimSetWithOpenQuestions | null;
}) {
  const supabase = getSupabaseAdminClient();
  const primaryInsert = await supabase
    .from("investigations")
    .insert({
      ticket_id: input.ticketId,
      status: input.status,
      answer_markdown: input.answerMarkdown,
      support_level: input.supportLevel,
      mode: input.mode ?? null,
      review_status: input.reviewStatus ?? null,
      review_reason_code: input.reviewDecision?.reasonCode ?? null,
      review_action: input.reviewDecision?.action ?? null,
      routing_reason: input.routingReason ?? null,
      account_id: input.accountId ?? null,
      customer_reply_json: (input.customerReplyJson ?? null) as InvestigationJsonPayload | null,
      internal_diagnosis_json: (input.internalDiagnosisJson ??
        null) as InvestigationJsonPayload | null,
    })
    .select("id")
    .single();

  if (!primaryInsert.error && primaryInsert.data) {
    return primaryInsert.data.id as string;
  }

  if (primaryInsert.error && isSchemaCompatibilityError(primaryInsert.error.message)) {
    throw new Error(
      `Failed to create investigation: ${primaryInsert.error.message}. Apply the structured investigation schema migration before running investigations.`,
    );
  }

  throw new Error(
    `Failed to create investigation: ${primaryInsert.error?.message ?? "Unknown error"}`,
  );
}

export async function insertInvestigationSourcesDirect(
  rows: Array<{
    investigationId: string;
    documentChunkId: string;
    rank: number;
    score: number;
  }>,
) {
  if (!rows.length) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("investigation_sources").insert(
    rows.map((row) => ({
      investigation_id: row.investigationId,
      document_chunk_id: row.documentChunkId,
      rank: row.rank,
      score: row.score,
    })),
  );

  if (error) {
    throw new Error(`Failed to save investigation sources: ${error.message}`);
  }
}

export async function insertInvestigationToolCallsDirect(
  rows: Array<{
    investigationId: string;
    toolName: ToolCallRecord["toolName"];
    input: Record<string, unknown>;
    output: unknown;
  }>,
) {
  if (!rows.length) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("investigation_tool_calls").insert(
    rows.map((row) => ({
      investigation_id: row.investigationId,
      tool_name: row.toolName,
      tool_input_json: row.input,
      tool_output_json: row.output,
    })),
  );

  if (error) {
    throw new Error(`Failed to save investigation tool calls: ${error.message}`);
  }
}

export async function persistInvestigationRunDirect(input: {
  ticketText: string;
  status: string;
  answerMarkdown: string;
  supportLevel: SupportLevel;
  mode: InvestigationMode;
  reviewStatus: ReviewStatus;
  reviewDecision: ReviewDecision;
  routingReason: string;
  accountId?: string | null;
  customerReplyJson: StructuredClaimSet;
  internalDiagnosisJson: StructuredClaimSetWithOpenQuestions;
  sources: Array<{
    documentChunkId: string;
    rank: number;
    score: number;
  }>;
  toolCalls: Array<{
    toolName: ToolCallRecord["toolName"];
    input: Record<string, unknown>;
    output: unknown;
  }>;
}) {
  if (hasDirectDatabaseConfig()) {
    return withPgClient(async (client) => {
      const result = await client.query<{ ticket_id: string; investigation_id: string }>(
        `
          select *
          from create_investigation_run(
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11::jsonb,
            $12::jsonb,
            $13::jsonb,
            $14::jsonb
          )
        `,
        [
          input.ticketText,
          input.status,
          input.answerMarkdown,
          input.supportLevel,
          input.mode,
          input.reviewStatus,
          input.reviewDecision.reasonCode,
          input.reviewDecision.action,
          input.routingReason,
          input.accountId ?? null,
          JSON.stringify(input.customerReplyJson),
          JSON.stringify(input.internalDiagnosisJson),
          JSON.stringify(
            input.sources.map((source) => ({
              document_chunk_id: source.documentChunkId,
              rank: source.rank,
              score: source.score,
            })),
          ),
          JSON.stringify(
            input.toolCalls.map((toolCall) => ({
              tool_name: toolCall.toolName,
              tool_input_json: toolCall.input,
              tool_output_json: toolCall.output,
            })),
          ),
        ],
      );
      const row = result.rows[0];

      if (!row) {
        throw new Error("Failed to persist investigation run: no row returned.");
      }

      return {
        ticketId: row.ticket_id,
        investigationId: row.investigation_id,
      };
    });
  }

  const supabase = getSupabaseAdminClient();
  const rpcResult = await supabase
    .rpc("create_investigation_run", {
      p_ticket_text: input.ticketText,
      p_status: input.status,
      p_answer_markdown: input.answerMarkdown,
      p_support_level: input.supportLevel,
      p_mode: input.mode,
      p_review_status: input.reviewStatus,
      p_review_reason_code: input.reviewDecision.reasonCode,
      p_review_action: input.reviewDecision.action,
      p_routing_reason: input.routingReason,
      p_account_id: input.accountId ?? null,
      p_customer_reply_json: input.customerReplyJson as InvestigationJsonPayload,
      p_internal_diagnosis_json: input.internalDiagnosisJson as InvestigationJsonPayload,
      p_sources: input.sources.map((source) => ({
        document_chunk_id: source.documentChunkId,
        rank: source.rank,
        score: source.score,
      })),
      p_tool_calls: input.toolCalls.map((toolCall) => ({
        tool_name: toolCall.toolName,
        tool_input_json: toolCall.input,
        tool_output_json: toolCall.output,
      })),
    })
    .single();

  if (!rpcResult.error && rpcResult.data) {
    const data = rpcResult.data as { ticket_id: string; investigation_id: string };

    return {
      ticketId: data.ticket_id,
      investigationId: data.investigation_id,
    };
  }

  const errorMessage = rpcResult.error?.message ?? "Unknown error";

  if (
    !rpcResult.error ||
    (!errorMessage.includes("create_investigation_run") &&
      !errorMessage.toLowerCase().includes("schema cache"))
  ) {
    throw new Error(`Failed to persist investigation run: ${errorMessage}`);
  }

  throw new Error(
    `Failed to persist investigation run: ${errorMessage}. Apply the atomic investigation-run migration.`,
  );
}
