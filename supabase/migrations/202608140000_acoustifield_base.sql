-- AcoustiField: base schema (supervisors + privileged helper).
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.supervisors (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.supervisors enable row level security;

create or replace function public.lowercase_supervisor_email()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.email = lower(new.email);
  return new;
end;
$$;

drop trigger if exists trg_supervisors_lowercase_email on public.supervisors;
create trigger trg_supervisors_lowercase_email
  before insert or update on public.supervisors
  for each row execute function public.lowercase_supervisor_email();

create or replace function private.is_supervisor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.supervisors
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function private.is_supervisor() from public, anon;
grant execute on function private.is_supervisor() to authenticated;

create or replace function public.current_user_is_supervisor()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.is_supervisor(); $$;

revoke all on function public.current_user_is_supervisor() from public, anon;
grant execute on function public.current_user_is_supervisor() to authenticated;

revoke all on table public.supervisors from anon, authenticated;
