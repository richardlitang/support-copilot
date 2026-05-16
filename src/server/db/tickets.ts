import { getSupabaseAdminClient } from "@/src/server/db/supabaseAdmin";

export async function createTicketDirect(rawText: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tickets")
    .insert({ raw_text: rawText })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create ticket: ${error?.message ?? "Unknown error"}`);
  }

  return data.id as string;
}
