create table if not exists document_ingestion_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  queue_job_id text unique,
  status text not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  locked_at timestamptz,
  worker_id text,
  last_error_code text,
  last_error_message_safe text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint document_ingestion_jobs_status_check
    check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled'))
);

create index if not exists document_ingestion_jobs_document_created_idx
  on document_ingestion_jobs (document_id, created_at desc);

create index if not exists document_ingestion_jobs_status_created_idx
  on document_ingestion_jobs (status, created_at desc);

create or replace function set_document_ingestion_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists document_ingestion_jobs_set_updated_at on document_ingestion_jobs;

create trigger document_ingestion_jobs_set_updated_at
before update on document_ingestion_jobs
for each row
execute function set_document_ingestion_jobs_updated_at();
