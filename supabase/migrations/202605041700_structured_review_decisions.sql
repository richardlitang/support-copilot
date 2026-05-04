alter table investigations
  add column if not exists review_reason_code text
    check (review_reason_code in (
      'none',
      'weak_retrieval',
      'missing_account_context',
      'unresolved_evidence_conflict',
      'grounding_validation_failed'
    )),
  add column if not exists review_action text
    check (review_action in (
      'none',
      'add_context',
      'add_docs',
      'inspect_conflict',
      'review_claims'
    ));

create index if not exists investigations_review_decision_idx
  on investigations (review_status, review_reason_code, review_action, created_at desc);

drop function if exists create_investigation_run(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb
);

create or replace function create_investigation_run (
  p_ticket_text text,
  p_status text,
  p_answer_markdown text,
  p_support_level text,
  p_mode text,
  p_review_status text,
  p_review_reason_code text,
  p_review_action text,
  p_routing_reason text,
  p_account_id uuid,
  p_customer_reply_json jsonb,
  p_internal_diagnosis_json jsonb,
  p_sources jsonb default '[]'::jsonb,
  p_tool_calls jsonb default '[]'::jsonb
)
returns table (
  ticket_id uuid,
  investigation_id uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into tickets (raw_text)
  values (p_ticket_text)
  returning id into ticket_id;

  insert into investigations (
    ticket_id,
    status,
    answer_markdown,
    support_level,
    mode,
    review_status,
    review_reason_code,
    review_action,
    routing_reason,
    account_id,
    customer_reply_json,
    internal_diagnosis_json
  )
  values (
    ticket_id,
    p_status,
    p_answer_markdown,
    p_support_level,
    p_mode,
    p_review_status,
    p_review_reason_code,
    p_review_action,
    p_routing_reason,
    p_account_id,
    p_customer_reply_json,
    p_internal_diagnosis_json
  )
  returning id into investigation_id;

  insert into investigation_sources (
    investigation_id,
    document_chunk_id,
    rank,
    score
  )
  select
    investigation_id,
    source_row.document_chunk_id,
    source_row.rank,
    source_row.score
  from jsonb_to_recordset(coalesce(p_sources, '[]'::jsonb)) as source_row (
    document_chunk_id uuid,
    rank integer,
    score double precision
  );

  insert into investigation_tool_calls (
    investigation_id,
    tool_name,
    tool_input_json,
    tool_output_json
  )
  select
    investigation_id,
    tool_row.tool_name,
    coalesce(tool_row.tool_input_json, '{}'::jsonb),
    coalesce(tool_row.tool_output_json, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_tool_calls, '[]'::jsonb)) as tool_row (
    tool_name text,
    tool_input_json jsonb,
    tool_output_json jsonb
  );

  return next;
end;
$$;

revoke all on function create_investigation_run(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) from public;

revoke execute on function create_investigation_run(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) from anon, authenticated;

grant execute on function create_investigation_run(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) to service_role;
