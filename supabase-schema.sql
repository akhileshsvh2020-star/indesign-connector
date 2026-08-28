create extension if not exists pgcrypto;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('queued', 'running', 'done', 'failed')),
  assigned_to text not null,
  original_name text not null,
  upload_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  log jsonb not null default '[]'::jsonb,
  result jsonb,
  error text
);

create index if not exists jobs_assigned_status_created_idx
  on public.jobs (assigned_to, status, created_at);

create or replace function public.claim_next_job(worker_id_param text)
returns setof public.jobs
language plpgsql
security definer
as $$
declare
  claimed_id uuid;
begin
  select id into claimed_id
  from public.jobs
  where status = 'queued'
    and assigned_to = worker_id_param
  order by created_at asc
  for update skip locked
  limit 1;

  if claimed_id is null then
    return;
  end if;

  update public.jobs
  set
    status = 'running',
    updated_at = now(),
    log = log || to_jsonb('Claimed by worker ' || worker_id_param)
  where id = claimed_id;

  return query select * from public.jobs where id = claimed_id;
end;
$$;

-- Create a private storage bucket named: indesign-jobs
-- In Supabase Dashboard: Storage -> New bucket -> indesign-jobs -> Private.
