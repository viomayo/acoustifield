-- AcoustiField: onglet Métadonnées des fiches (programme d'enregistrement,
-- collecte de données, filtrage/séquençage), complété après la pose et
-- modifiable par le propriétaire ou un superviseur.
-- À appliquer APRÈS 202608190000_pose_recherche.sql.

alter table public.fiches
  add column if not exists programme_enregistrement text[] not null default '{}',
  add column if not exists taux_echantillonnage_khz integer not null default 256,
  add column if not exists freq_declenchement_min_khz integer,
  add column if not exists freq_declenchement_max_khz integer,
  add column if not exists duree_inter_puls_s double precision,
  add column if not exists gain_db double precision,
  add column if not exists duree_max_sequence_s double precision,
  add column if not exists parametre_filtration text not null default '',
  add column if not exists moulinette text not null default '',
  add column if not exists moulinette_autre text not null default '',
  add column if not exists destin_bruits text not null default '',
  add column if not exists destin_bruits_autre text not null default '';

create index if not exists idx_fiches_user on public.fiches(user_id);

-- Le snapshot complet transporte désormais les métadonnées.
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
    projet, operateur, date_heure_pose, date_heure_recherche, nb_nuits_ecoute,
    site_nom, lat, lon, commune,
    sur_element, sur_element_autre, ouverture_paysage, habitat_principal,
    habitat_secondaire, habitat_principal_autre, habitat_secondaire_autre,
    gestion, eclairage, hauteur_pose_m, orientation_deg, temperature_c,
    type_nuit, conditions_meteo, commentaires,
    programme_enregistrement, taux_echantillonnage_khz,
    freq_declenchement_min_khz, freq_declenchement_max_khz,
    duree_inter_puls_s, gain_db, duree_max_sequence_s,
    parametre_filtration, moulinette, moulinette_autre,
    destin_bruits, destin_bruits_autre,
    created_at, synced_at
  ) values (
    v_fiche_id, v_user,
    coalesce(p_snapshot -> 'fiche' ->> 'appareil_type', ''),
    coalesce(p_snapshot -> 'fiche' ->> 'boitier_num', ''),
    coalesce(p_snapshot -> 'fiche' ->> 'micro_num', ''),
    coalesce((p_snapshot -> 'fiche' ->> 'carte_sd_pleine')::boolean, false),
    coalesce(p_snapshot -> 'fiche' ->> 'projet', ''),
    coalesce(p_snapshot -> 'fiche' ->> 'operateur', ''),
    nullif(p_snapshot -> 'fiche' ->> 'date_heure_pose', '')::timestamptz,
    nullif(p_snapshot -> 'fiche' ->> 'date_heure_recherche', '')::timestamptz,
    nullif(p_snapshot -> 'fiche' ->> 'nb_nuits_ecoute', '')::integer,
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
    nullif(p_snapshot -> 'fiche' ->> 'orientation_deg', '')::double precision,
    nullif(p_snapshot -> 'fiche' ->> 'temperature_c', '')::double precision,
    nullif(p_snapshot -> 'fiche' ->> 'type_nuit', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_snapshot -> 'fiche' -> 'conditions_meteo', '[]'::jsonb))), '{}'),
    coalesce(p_snapshot -> 'fiche' ->> 'commentaires', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_snapshot -> 'fiche' -> 'programme_enregistrement', '[]'::jsonb))), '{}'),
    coalesce(nullif(p_snapshot -> 'fiche' ->> 'taux_echantillonnage_khz', ''), '256')::integer,
    nullif(p_snapshot -> 'fiche' ->> 'freq_declenchement_min_khz', '')::integer,
    nullif(p_snapshot -> 'fiche' ->> 'freq_declenchement_max_khz', '')::integer,
    nullif(p_snapshot -> 'fiche' ->> 'duree_inter_puls_s', '')::double precision,
    nullif(p_snapshot -> 'fiche' ->> 'gain_db', '')::double precision,
    nullif(p_snapshot -> 'fiche' ->> 'duree_max_sequence_s', '')::double precision,
    coalesce(p_snapshot -> 'fiche' ->> 'parametre_filtration', ''),
    coalesce(p_snapshot -> 'fiche' ->> 'moulinette', ''),
    coalesce(p_snapshot -> 'fiche' ->> 'moulinette_autre', ''),
    coalesce(p_snapshot -> 'fiche' ->> 'destin_bruits', ''),
    coalesce(p_snapshot -> 'fiche' ->> 'destin_bruits_autre', ''),
    coalesce((p_snapshot -> 'fiche' ->> 'created_at')::timestamptz, now()), now()
  ) on conflict (id) do update set
    appareil_type = excluded.appareil_type,
    boitier_num = excluded.boitier_num,
    micro_num = excluded.micro_num,
    carte_sd_pleine = excluded.carte_sd_pleine,
    projet = excluded.projet,
    operateur = excluded.operateur,
    date_heure_pose = excluded.date_heure_pose,
    date_heure_recherche = excluded.date_heure_recherche,
    nb_nuits_ecoute = excluded.nb_nuits_ecoute,
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
    orientation_deg = excluded.orientation_deg,
    temperature_c = excluded.temperature_c,
    type_nuit = excluded.type_nuit,
    conditions_meteo = excluded.conditions_meteo,
    commentaires = excluded.commentaires,
    programme_enregistrement = excluded.programme_enregistrement,
    taux_echantillonnage_khz = excluded.taux_echantillonnage_khz,
    freq_declenchement_min_khz = excluded.freq_declenchement_min_khz,
    freq_declenchement_max_khz = excluded.freq_declenchement_max_khz,
    duree_inter_puls_s = excluded.duree_inter_puls_s,
    gain_db = excluded.gain_db,
    duree_max_sequence_s = excluded.duree_max_sequence_s,
    parametre_filtration = excluded.parametre_filtration,
    moulinette = excluded.moulinette,
    moulinette_autre = excluded.moulinette_autre,
    destin_bruits = excluded.destin_bruits,
    destin_bruits_autre = excluded.destin_bruits_autre,
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

-- Mise à jour ciblée des seules métadonnées, pour le propriétaire ou un
-- superviseur (la politique fiche_update reste limitée au propriétaire).
-- security definer : le déclencheur met à jour updated_at/sync_revision,
-- la révision distante est renvoyée pour les prochaines synchronisations.
create or replace function public.update_fiche_metadata(
  p_fiche_id uuid,
  p_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_owner uuid;
  v_revision bigint;
  v_taux integer;
  v_freq_min integer;
  v_freq_max integer;
  v_inter_puls double precision;
  v_gain double precision;
  v_seq_max double precision;
begin
  if v_user is null then raise exception 'authentication required'; end if;

  select user_id into v_owner from public.fiches where id = p_fiche_id for update;
  if not found then raise exception 'fiche not found'; end if;
  if v_owner <> v_user and not (select private.is_supervisor()) then
    raise exception 'supervisor required';
  end if;

  v_taux := coalesce(nullif(p_snapshot ->> 'taux_echantillonnage_khz', ''), '256')::integer;
  v_freq_min := nullif(p_snapshot ->> 'freq_declenchement_min_khz', '')::integer;
  v_freq_max := nullif(p_snapshot ->> 'freq_declenchement_max_khz', '')::integer;
  v_inter_puls := nullif(p_snapshot ->> 'duree_inter_puls_s', '')::double precision;
  v_gain := nullif(p_snapshot ->> 'gain_db', '')::double precision;
  v_seq_max := nullif(p_snapshot ->> 'duree_max_sequence_s', '')::double precision;

  if v_taux not in (192, 256, 384, 500) then
    raise exception 'taux d''échantillonnage invalide';
  end if;
  if v_freq_min is not null and (v_freq_min < 0 or v_freq_min > 180) then
    raise exception 'fréquence min hors bornes';
  end if;
  if v_freq_max is not null and (v_freq_max < 0 or v_freq_max > 180) then
    raise exception 'fréquence max hors bornes';
  end if;
  if v_freq_min is not null and v_freq_max is not null and v_freq_min > v_freq_max then
    raise exception 'fréquence min supérieure à la fréquence max';
  end if;
  if v_inter_puls is not null and (v_inter_puls < 0 or v_inter_puls > 15.001) then
    raise exception 'durée inter-puls hors bornes';
  end if;
  if v_gain is not null and (v_gain < -0.001 or v_gain > 59.501) then
    raise exception 'gain hors bornes';
  end if;
  if v_seq_max is not null and v_seq_max <= 0 then
    raise exception 'durée max de séquence invalide';
  end if;

  update public.fiches set
    programme_enregistrement = coalesce(array(select jsonb_array_elements_text(coalesce(p_snapshot -> 'programme_enregistrement', '[]'::jsonb))), '{}'),
    taux_echantillonnage_khz = v_taux,
    freq_declenchement_min_khz = v_freq_min,
    freq_declenchement_max_khz = v_freq_max,
    duree_inter_puls_s = v_inter_puls,
    gain_db = v_gain,
    duree_max_sequence_s = v_seq_max,
    parametre_filtration = coalesce(p_snapshot ->> 'parametre_filtration', ''),
    moulinette = coalesce(p_snapshot ->> 'moulinette', ''),
    moulinette_autre = coalesce(p_snapshot ->> 'moulinette_autre', ''),
    destin_bruits = coalesce(p_snapshot ->> 'destin_bruits', ''),
    destin_bruits_autre = coalesce(p_snapshot ->> 'destin_bruits_autre', '')
  where id = p_fiche_id;

  select sync_revision into v_revision from public.fiches where id = p_fiche_id;
  return jsonb_build_object('status', 'ok', 'revision', v_revision);
end;
$$;

revoke all on function public.update_fiche_metadata(uuid, jsonb) from public, anon;
grant execute on function public.update_fiche_metadata(uuid, jsonb) to authenticated;
