alter table documents
  add column if not exists session_id text;

create index if not exists documents_session_id_created_at_idx
  on documents (session_id, created_at desc);

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
