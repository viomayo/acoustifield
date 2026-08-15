-- Chiroptère BXL: controlled user profiles for the supervisor view.
-- This migration is prepared for manual deployment; it must not be applied remotely automatically.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nom text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profile_select on public.profiles;
drop policy if exists profile_insert on public.profiles;
drop policy if exists profile_update on public.profiles;
create policy profile_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.is_supervisor()));
create policy profile_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profile_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Seed a profile at first sign-in from the identity provider metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, nom)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'email', ''),
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_profiles_on_signup on auth.users;
create trigger trg_profiles_on_signup
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Backfill profiles for accounts that existed before this migration.
insert into public.profiles (id, nom)
select
  id,
  coalesce(
    nullif(raw_user_meta_data ->> 'full_name', ''),
    nullif(raw_user_meta_data ->> 'name', ''),
    nullif(raw_user_meta_data ->> 'email', ''),
    ''
  )
from auth.users
on conflict (id) do nothing;

grant select, insert, update on table public.profiles to authenticated;
