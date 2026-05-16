import type { investigateTicket } from "../../src/server/investigation/investigate";

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function formatRuntimeFailure(error: unknown) {
  const message = getErrorMessage(error);

  if (message.startsWith("Eval case ")) {
    return message;
  }

  if (message.includes("fetch failed")) {
    return [
      "Eval environment failure: a Supabase or OpenAI network request failed.",
      "Check that .env.local has valid keys, the Supabase project is reachable, migrations are applied, and demo data is seeded.",
      `Underlying error: ${message}`,
    ].join("\n");
  }

  if (message.includes("Missing SUPABASE_URL") || message.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    return [
      "Eval environment failure: Supabase configuration is missing.",
      "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY in .env.local.",
      `Underlying error: ${message}`,
    ].join("\n");
  }

  return message;
}

export function countClaimCitations(result: Awaited<ReturnType<typeof investigateTicket>>) {
  return new Set(
    [...result.customerReply.claims, ...result.internalDiagnosis.claims].flatMap(
      (claim) => claim.citations,
    ),
  ).size;
}
