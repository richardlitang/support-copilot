create table if not exists accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  plan_tier text not null,
  status text not null,
  enabled_modules_json jsonb not null default '[]'::jsonb,
  limits_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists feature_flags (
  id uuid primary key default extensions.gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  flag_key text not null,
  flag_value boolean not null,
  description text,
  rollout_notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists error_events (
  id uuid primary key default extensions.gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  product_area text,
  error_code text not null,
  summary text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table investigations
  add column if not exists mode text check (mode in ('docs_only', 'docs_plus_tools', 'needs_human_review')),
  add column if not exists review_status text check (review_status in ('ready', 'needs_human_review')),
  add column if not exists routing_reason text,
  add column if not exists account_id uuid references accounts(id) on delete set null,
  add column if not exists customer_reply_json jsonb,
  add column if not exists internal_diagnosis_json jsonb;

create table if not exists investigation_tool_calls (
  id uuid primary key default extensions.gen_random_uuid(),
  investigation_id uuid not null references investigations(id) on delete cascade,
  tool_name text not null,
  tool_input_json jsonb not null default '{}'::jsonb,
  tool_output_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists feature_flags_account_id_flag_key_idx
  on feature_flags (account_id, flag_key);

create index if not exists accounts_plan_tier_idx
  on accounts (plan_tier);

create index if not exists error_events_account_id_occurred_at_idx
  on error_events (account_id, occurred_at desc);

create index if not exists investigations_mode_review_status_idx
  on investigations (mode, review_status, created_at desc);

create index if not exists investigation_tool_calls_investigation_id_idx
  on investigation_tool_calls (investigation_id, created_at asc);
