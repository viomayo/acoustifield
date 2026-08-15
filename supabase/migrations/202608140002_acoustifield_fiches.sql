-- AcoustiField: fiches de pose d'enregistreurs acoustiques, photos liées
-- (stockage privé) et synchronisation atomique par révision.

create table if not exists public.fiches (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  appareil_type text not null default '',
  boitier_num text not null default '',
  micro_num text not null default '',
  carte_sd_pleine boolean not null default false,
  projet text not null default '',
  operateur text not null default '',
  date_debut_nuit date,
  site_nom text not null default '',
  lat double precision,
  lon double precision,
  commune text not null default '',
  sur_element text not null default '',
  sur_element_autre text not null default '',
  ouverture_paysage text,
  habitat_principal text not null default '',
  habitat_secondaire text not null default '',
  gestion text not null default '',
  eclairage text,
  hauteur_pose_m double precision,
  temperature_c double precision,
  type_nuit text,
  conditions_meteo text[] not null default '{}',
  commentaires text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  synced_at timestamptz,
  sync_revision bigint not null default 0
);

alter table public.fiches add column if not exists sync_revision bigint not null default 0;

create table if not exists public.photos (
  id uuid primary key,
  fiche_id uuid not null references public.fiches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint uq_photos_fiche_position unique (fiche_id, position)
);

create index if not exists idx_fiches_user on public.fiches(user_id);
create index if not exists idx_photos_fiche on public.photos(fiche_id);
create index if not exists idx_photos_user on public.photos(user_id);

alter table public.fiches enable row level security;
alter table public.photos enable row level security;

drop policy if exists fiche_select on public.fiches;
drop policy if exists fiche_insert on public.fiches;
drop policy if exists fiche_update on public.fiches;
drop policy if exists fiche_delete on public.fiches;
create policy fiche_select on public.fiches for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_supervisor()));
create policy fiche_insert on public.fiches for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy fiche_update on public.fiches for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy fiche_delete on public.fiches for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists photo_select on public.photos;
drop policy if exists photo_insert on public.photos;
drop policy if exists photo_update on public.photos;
drop policy if exists photo_delete on public.photos;
create policy photo_select on public.photos for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_supervisor()));
create policy photo_insert on public.photos for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy photo_update on public.photos for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy photo_delete on public.photos for delete to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.update_fiche_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = clock_timestamp();
  new.sync_revision = old.sync_revision + 1;
  return new;
end;
$$;

drop trigger if exists trg_fiches_updated_at on public.fiches;
create trigger trg_fiches_updated_at before update on public.fiches
  for each row execute function public.update_fiche_updated_at();

create or replace function public.sync_fiche_snapshot(
  p_snapshot jsonb,
  p_expected_revision bigint default null,
  p_force boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_fiche_id uuid := (p_snapshot -> 'fiche' ->> 'id')::uuid;
  v_owner uuid;
  v_revision bigint;
  v_photo jsonb;
  v_photo_path text;
begin
  if v_user is null then raise exception 'authentication required'; end if;

  select user_id, sync_revision into v_owner, v_revision
  from public.fiches where id = v_fiche_id for update;

  if found and v_owner <> v_user then raise exception 'fiche ownership mismatch'; end if;
  if found and not p_force and p_expected_revision is distinct from v_revision then
    return jsonb_build_object('status', 'conflict', 'revision', v_revision);
  end if;

  insert into public.fiches (
    id, user_id, appareil_type, boitier_num, micro_num, carte_sd_pleine,
    projet, operateur, date_debut_nuit, site_nom, lat, lon, commune,
    sur_element, sur_element_autre, ouverture_paysage, habitat_principal,
    habitat_secondaire, gestion, eclairage, hauteur_pose_m, temperature_c,
    type_nuit, conditions_meteo, commentaires, created_at, synced_at
  ) values (
    v_fiche_id, v_user,
    coalesce(p_snapshot -> 'fiche' ->> 'appareil_type', ''),
    coalesce(p_snapshot -> 'fiche' ->> 'boitier_num', ''),
    coalesce(p_snapshot -> 'fiche' ->> 'micro_num', ''),
    coalesce((p_snapshot -> 'fiche' ->> 'carte_sd_pleine')::boolean, false),
    coalesce(p_snapshot -> 'fiche' ->> 'projet', ''),
    coalesce(p_snapshot -> 'fiche' ->> 'operateur', ''),
    nullif(p_snapshot -> 'fiche' ->> 'date_debut_nuit', '')::date,
    coalesce(p_snapshot -> 'fiche' ->> 'site_nom', ''),
    nullif(p_snapshot -> 'fiche' ->> 'lat', '')::double precision,
    nullif(p_snapshot -> 'fiche' ->> 'lon', '')::double precision,
    coalesce(p_snapshot -> 'fiche' ->> 'commune', ''),
    coalesce(p_snapshot -> 'fiche' ->> 'sur_element', ''),
    coalesce(p_snapshot -> 'fiche' ->> 'sur_element_autre', ''),
    nullif(p_snapshot -> 'fiche' ->> 'ouverture_paysage', ''),
    coalesce(p_snapshot -> 'fiche' ->> 'habitat_principal', ''),
    coalesce(p_snapshot -> 'fiche' ->> 'habitat_secondaire', ''),
    coalesce(p_snapshot -> 'fiche' ->> 'gestion', ''),
    nullif(p_snapshot -> 'fiche' ->> 'eclairage', ''),
    nullif(p_snapshot -> 'fiche' ->> 'hauteur_pose_m', '')::double precision,
    nullif(p_snapshot -> 'fiche' ->> 'temperature_c', '')::double precision,
    nullif(p_snapshot -> 'fiche' ->> 'type_nuit', ''),
    coalesce(array(select jsonb_array_elements_text(p_snapshot -> 'fiche' -> 'conditions_meteo')), '{}'),
    coalesce(p_snapshot -> 'fiche' ->> 'commentaires', ''),
    coalesce((p_snapshot -> 'fiche' ->> 'created_at')::timestamptz, now()), now()
  ) on conflict (id) do update set
    appareil_type = excluded.appareil_type,
    boitier_num = excluded.boitier_num,
    micro_num = excluded.micro_num,
    carte_sd_pleine = excluded.carte_sd_pleine,
    projet = excluded.projet,
    operateur = excluded.operateur,
    date_debut_nuit = excluded.date_debut_nuit,
    site_nom = excluded.site_nom,
    lat = excluded.lat,
    lon = excluded.lon,
    commune = excluded.commune,
    sur_element = excluded.sur_element,
    sur_element_autre = excluded.sur_element_autre,
    ouverture_paysage = excluded.ouverture_paysage,
    habitat_principal = excluded.habitat_principal,
    habitat_secondaire = excluded.habitat_secondaire,
    gestion = excluded.gestion,
    eclairage = excluded.eclairage,
    hauteur_pose_m = excluded.hauteur_pose_m,
    temperature_c = excluded.temperature_c,
    type_nuit = excluded.type_nuit,
    conditions_meteo = excluded.conditions_meteo,
    commentaires = excluded.commentaires,
    synced_at = excluded.synced_at;

  delete from public.photos where fiche_id = v_fiche_id;
  for v_photo in select value from jsonb_array_elements(coalesce(p_snapshot -> 'photos', '[]'::jsonb)) loop
    v_photo_path := v_photo ->> 'storage_path';
    if v_photo_path is null or not (v_photo_path like (v_user::text || '/%')) then
      continue;
    end if;
    insert into public.photos (id, fiche_id, user_id, storage_path, position)
    values (
      (v_photo ->> 'id')::uuid, v_fiche_id, v_user, v_photo_path,
      coalesce((v_photo ->> 'position')::integer, 0)
    )
    on conflict (fiche_id, position) do update set
      storage_path = excluded.storage_path, id = excluded.id;
  end loop;

  select sync_revision into v_revision from public.fiches where id = v_fiche_id;
  return jsonb_build_object('status', 'ok', 'revision', v_revision);
end;
$$;

revoke all on function public.sync_fiche_snapshot(jsonb, bigint, boolean) from public, anon;
grant execute on function public.sync_fiche_snapshot(jsonb, bigint, boolean) to authenticated;

-- Stockage privé des photos (dossier par utilisateur).
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

drop policy if exists photos_owner_insert on storage.objects;
drop policy if exists photos_owner_select on storage.objects;
drop policy if exists photos_owner_update on storage.objects;
drop policy if exists photos_owner_delete on storage.objects;
create policy photos_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy photos_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or (select private.is_supervisor()))
  );
create policy photos_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy photos_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text
  );

grant select, insert, update, delete on table public.fiches to authenticated;
grant select, insert, update, delete on table public.photos to authenticated;
