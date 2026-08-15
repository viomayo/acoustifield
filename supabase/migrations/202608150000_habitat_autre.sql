-- AcoustiField: précisions libres pour les habitats « Autre ».

alter table public.fiches add column if not exists habitat_principal_autre text not null default '';
alter table public.fiches add column if not exists habitat_secondaire_autre text not null default '';

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
    habitat_secondaire, habitat_principal_autre, habitat_secondaire_autre,
    gestion, eclairage, hauteur_pose_m, temperature_c,
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
    coalesce(p_snapshot -> 'fiche' ->> 'habitat_principal_autre', ''),
    coalesce(p_snapshot -> 'fiche' ->> 'habitat_secondaire_autre', ''),
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
    habitat_principal_autre = excluded.habitat_principal_autre,
    habitat_secondaire_autre = excluded.habitat_secondaire_autre,
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
