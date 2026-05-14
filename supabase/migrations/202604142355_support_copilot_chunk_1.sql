create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then
    create role anon;
  end if;

  if not exists (select from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;

  if not exists (select from pg_roles where rolname = 'service_role') then
    create role service_role;
  end if;
end
$$;

create table if not exists documents (
  id uuid primary key default extensions.gen_random_uuid(),
  filename text not null,
  content_type text,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists document_chunks (
  id uuid primary key default extensions.gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index integer not null,
  section_title text,
  content text not null,
  token_count integer not null,
  metadata_json jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists tickets (
  id uuid primary key default extensions.gen_random_uuid(),
  raw_text text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists investigations (
  id uuid primary key default extensions.gen_random_uuid(),
  ticket_id uuid not null references tickets(id) on delete cascade,
  status text not null,
  answer_markdown text not null,
  support_level text not null check (support_level in ('high', 'medium', 'low', 'insufficient_support')),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists investigation_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  investigation_id uuid not null references investigations(id) on delete cascade,
  document_chunk_id uuid not null references document_chunks(id) on delete cascade,
  rank integer not null,
  score double precision not null
);

create index if not exists document_chunks_document_id_idx on document_chunks (document_id, chunk_index);
create index if not exists investigations_ticket_id_idx on investigations (ticket_id);
create index if not exists investigation_sources_investigation_id_idx on investigation_sources (investigation_id, rank);

create or replace function match_document_chunks (
  query_embedding extensions.vector(1536),
  match_count integer default 5,
  match_threshold double precision default 0.58
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
  order by document_chunks.embedding <=> query_embedding asc
  limit least(match_count, 20);
$$;
