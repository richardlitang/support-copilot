alter table documents enable row level security;
alter table document_chunks enable row level security;
alter table tickets enable row level security;
alter table investigations enable row level security;
alter table investigation_sources enable row level security;
alter table accounts enable row level security;
alter table feature_flags enable row level security;
alter table error_events enable row level security;
alter table investigation_tool_calls enable row level security;

revoke all on table documents from anon, authenticated;
revoke all on table document_chunks from anon, authenticated;
revoke all on table tickets from anon, authenticated;
revoke all on table investigations from anon, authenticated;
revoke all on table investigation_sources from anon, authenticated;
revoke all on table accounts from anon, authenticated;
revoke all on table feature_flags from anon, authenticated;
revoke all on table error_events from anon, authenticated;
revoke all on table investigation_tool_calls from anon, authenticated;

create index if not exists investigation_sources_document_chunk_id_idx
  on investigation_sources (document_chunk_id);

create index if not exists investigations_account_id_idx
  on investigations (account_id);

create or replace function match_document_chunks (
  query_embedding extensions.vector(1536),
  match_count integer default 5,
  match_threshold double precision default 0.58,
  session_id_filter text default null
)
returns table (
  id uuid,
  document_id uuid,
  filename text,
  section_title text,
  content text,
  score double precision,
  chunk_index integer
)
language sql
stable
set search_path = public, extensions
as $$
  select
    document_chunks.id,
    document_chunks.document_id,
    documents.filename,
    document_chunks.section_title,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as score,
    document_chunks.chunk_index
  from document_chunks
  inner join documents on documents.id = document_chunks.document_id
  where 1 - (document_chunks.embedding <=> query_embedding) >= match_threshold
    and (session_id_filter is null or documents.session_id = session_id_filter)
  order by document_chunks.embedding <=> query_embedding asc
  limit least(match_count, 20);
$$;

drop function if exists match_document_chunks(
  extensions.vector,
  integer,
  double precision
);

revoke all on function match_document_chunks(
  extensions.vector,
  integer,
  double precision,
  text
) from public;

revoke execute on function match_document_chunks(
  extensions.vector,
  integer,
  double precision,
  text
) from anon, authenticated;

grant execute on function match_document_chunks(
  extensions.vector,
  integer,
  double precision,
  text
) to service_role;

revoke all on function create_investigation_run(
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
  uuid,
  jsonb,
  jsonb,
  jsonb,
  jsonb
) to service_role;
