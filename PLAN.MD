# AcoustiField — Plan

## État livré

- [fait] Fiches de pose d'enregistreurs acoustiques : sections Type d'appareil, Contexte, Caractérisation du milieu, Météo, Photos du milieu et Commentaires, avec localisation en degrés décimaux collables (répartition automatique lat/lon), commune remplie par géocodage inverse, boutons carte et « Ma position », orientation de l'enregistreur réglable au curseur ou par boussole du téléphone, libellés et choix conformes au protocole d'échantillonnage (listes d'habitats, gestion, éclairage, type de nuit, conditions) et champ libre pour chaque choix « Autre » (support, habitat). Date de début de nuit, ouverture du milieu et description de l'habitat principal obligatoires.
- [fait] Brouillon auto-sauvegardé dans localStorage et persistance IndexedDB (fiches, photos, tombstones, cache superviseur, profil offline) avec isolation par utilisateur.
- [fait] Profil d'identité offline actif persistant, remplaçable ou désactivable sans purge des données métier.
- [fait] Provider client global distinguant identité Supabase vérifiée, profil offline, session expirée et absence d'identité, sans autorisation superviseur locale.
- [fait] Shells prérendus et consommateurs IndexedDB migrés vers l'identité cliente, avec verrouillage pendant la résolution et au changement de compte.
- [fait] PWA installable, navigation offline, précache Serwist atomique et versionné de `/` et `/recapitulatif`, statut vérifiable (`OFFLINE_STATUS`, `SW_PING`/`SW_PONG`), normalisation ciblée des query strings, diagnostic `/sw-status` et aucun faux fallback vers l'accueil.
- [fait] Cache HTTP terrain durci : aucune stratégie runtime HTML/RSC, Supabase prioritaire en `NetworkOnly` et suppression ciblée des anciens caches de pages à l'activation.
- [fait] Synchronisation atomique de snapshots via le RPC `sync_fiche_snapshot()` (révision distante, push forcé, conflit renvoyé sans écriture).
- [fait] Upload des photos vers le bucket privé `photos` (dossier par utilisateur) et enregistrement des lignes `photos` en upsert ; reprise des photos restées en attente.
- [fait] Déclencheurs de synchronisation au démarrage en ligne, au retour réseau et au clic manuel, avec revalidation Auth préalable.
- [fait] Conflits portant sur des groupes de champs (appareil, contexte, site, milieu, météo, commentaires), stockés localement et résolus par choix explicite local/remote.
- [fait] Suppressions offline rejouées avec tombstones et conservation des erreurs.
- [fait] Pull des fiches de l'utilisateur (import/fusion selon la révision distante) et cache superviseur local des fiches des autres enregistreurs (`remote_fiches` par compte).
- [fait] RLS propriétaire et superviseur durcie par migrations versionnées (tables `fiches`, `photos`, `profiles`, `supervisors`).
- [fait] Exports JSON, CSV (UTF-8 avec BOM, séparateur `;`, `user_id`/`user_name`, `nb_photos`) et ZIP des photos.
- [fait] Profils utilisateurs contrôlés : table `profiles` préremplie au premier sign-in (nom Google), renommable localement, et noms affichés dans la vue superviseur.
- [fait] Tests unitaires/intégration, scénarios Playwright et CI (qualité, couverture, build, audit, E2E, Supabase).
- [fait] Échange PKCE du code OAuth déplacé vers la route serveur `/api/auth/exchange`, stockage Supabase verrouillé sur la clé `acoustifield-auth`, et page `/auth/auth-code-error` affichant l'erreur exacte renvoyée par Supabase.
- [fait] Footer d'application mentionnant « Développé par viomayo » avec lien vers https://github.com/viomayo.
- [fait] Mise à jour vers Next.js 16.3 et audit production sans vulnérabilité connue.

## Déploiement

- [fait] Nouveau projet Supabase « acoustifield » (ref `kiknpogoreznmgdtpkoh`) créé, distinct de l'ancien projet Chiroptère BXL.
- [fait] Migrations `202608140000_acoustifield_base.sql`, `202608140001_profiles.sql` et `202608140002_acoustifield_fiches.sql` appliquées manuellement au Supabase distant (fait le 14 août 2026) et vérifiées.
- [fait] Client OAuth Google mis en conformité : l'URI de redirection `https://kiknpogoreznmgdtpkoh.supabase.co/auth/v1/callback` est enregistré dans la Google Cloud Console et le secret renseigné dans Supabase (Auth > Providers > Google).
- [fait] Login Google réel concluant (fait le 14 août 2026) ; en cas de `redirect_uri_mismatch` ou d'échec d'échange de code, relire `/auth/auth-code-error` et purger le localStorage/cookies du site.
- [à faire] Appliquer les migrations distantes dans l'ordre : `202608150000_habitat_autre.sql` (colonnes `habitat_principal_autre` / `habitat_secondaire_autre` + RPC `sync_fiche_snapshot` mis à jour), puis `202608150001_orientation_deg.sql` (colonne `orientation_deg` + RPC mis à jour), puis vérifier un push/pull.
- [à faire] Déployer l'application AcoustiField sur Vercel (nouveau projet, distinct de `chiroptere-bxl`), puis mettre à jour dans Supabase la « Site URL » et les « Redirect URLs » vers le domaine de production.
- [à faire] Refaire une recette réelle sur iOS Safari et Android installés en PWA une fois le déploiement de production actif.

## Évolutions produit possibles

- [à faire] Ajouter une observabilité distante des erreurs de synchronisation si le projet choisit un service de suivi.

Les éléments de cette section sont planifiés et ne doivent pas être présentés comme implémentés.
