alter table documents
  add column if not exists storage_path text,
  add column if not exists size_bytes bigint,
  add column if not exists error_code text,
  add column if not exists error_message_safe text,
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists processed_at timestamptz;

alter table documents
  drop constraint if exists documents_status_check;

alter table documents
  add constraint documents_status_check
  check (status in ('uploaded', 'processing', 'ready', 'failed', 'archived'));

create unique index if not exists document_chunks_document_id_chunk_index_key
  on document_chunks (document_id, chunk_index);

create table if not exists pipeline_events (
  id uuid primary key default extensions.gen_random_uuid(),
  event_type text not null,
  status text not null,
  entity_type text not null,
  entity_id text not null,
  session_id text,
  tenant_id text,
  user_id text,
  duration_ms integer,
  metadata_json jsonb not null default '{}'::jsonb,
  error_code text,
  error_message_safe text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists pipeline_events_entity_created_at_idx
  on pipeline_events (entity_type, entity_id, created_at desc);

create index if not exists pipeline_events_session_created_at_idx
  on pipeline_events (session_id, created_at desc);

create or replace function set_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists documents_set_updated_at on documents;

create trigger documents_set_updated_at
before update on documents
for each row
execute function set_documents_updated_at();

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
  where documents.status = 'ready'
    and 1 - (document_chunks.embedding <=> query_embedding) >= match_threshold
    and (session_id_filter is null or documents.session_id = session_id_filter)
  order by document_chunks.embedding <=> query_embedding asc
  limit least(match_count, 20);
$$;
