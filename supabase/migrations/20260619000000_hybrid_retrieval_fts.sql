create index if not exists document_chunks_fts_english_idx
on public.document_chunks
using gin (
  to_tsvector(
    'english',
    coalesce(section_title, '') || ' ' || coalesce(content, '')
  )
);

create or replace function public.match_fts_document_chunks(
  session_id_filter text,
  query_text text,
  match_count integer default 50
)
returns table (
  id uuid,
  document_id uuid,
  filename text,
  section_title text,
  content text,
  score real,
  chunk_index integer
)
language sql
stable
set search_path = public, extensions
as $$
  with query as (
    select websearch_to_tsquery('english', query_text) as tsq
  )
  select
    document_chunks.id,
    document_chunks.document_id,
    documents.filename,
    document_chunks.section_title,
    document_chunks.content,
    ts_rank_cd(
      to_tsvector(
        'english',
        coalesce(document_chunks.section_title, '') || ' ' || coalesce(document_chunks.content, '')
      ),
      query.tsq
    )::real as score,
    document_chunks.chunk_index
  from public.document_chunks
  inner join public.documents on documents.id = document_chunks.document_id
  cross join query
  where documents.session_id = session_id_filter
    and documents.status = 'ready'
    and query.tsq @@ to_tsvector(
      'english',
      coalesce(document_chunks.section_title, '') || ' ' || coalesce(document_chunks.content, '')
    )
  order by score desc, document_chunks.chunk_index asc
  limit greatest(1, least(match_count, 50));
$$;

revoke all on function public.match_fts_document_chunks(text, text, integer) from public;
revoke execute on function public.match_fts_document_chunks(text, text, integer) from anon, authenticated;
grant execute on function public.match_fts_document_chunks(text, text, integer) to service_role;
