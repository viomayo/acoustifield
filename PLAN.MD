# AcoustiField — Plan

## État livré

- [fait] Fiches de pose d'enregistreurs acoustiques : sections Type d'appareil, Contexte, Caractérisation du milieu, Météo facultative, Photos du milieu et Commentaires, avec localisation en degrés décimaux collables (répartition automatique lat/lon), commune remplie par géocodage inverse, boutons « Position GPS » et « Ma position », orientation de l'enregistreur réglable au curseur avec jauge visuelle, libellés et choix conformes au protocole d'échantillonnage (listes d'habitats, gestion, éclairage, conditions, vent, luminosité) et champ libre pour chaque choix « Autre » (support, habitat). Jour et heure de pose obligatoires, ouverture du milieu et description de l'habitat principal obligatoires. La température, la hauteur de pose et la localisation acceptent la virgule comme séparateur décimal (le point reste accepté).
- [fait] Brouillon auto-sauvegardé dans localStorage et persistance IndexedDB (fiches, photos, tombstones, cache superviseur, profil offline) avec isolation par utilisateur.
- [fait] Profil d'identité offline actif persistant, remplaçable ou désactivable sans purge des données métier.
- [fait] Provider client global distinguant identité Supabase vérifiée, profil offline, session expirée et absence d'identité, sans autorisation superviseur locale.
- [fait] Shells prérendus et consommateurs IndexedDB migrés vers l'identité cliente, avec verrouillage pendant la résolution et au changement de compte.
- [fait] PWA installable, navigation offline, précache Serwist atomique et versionné de `/` et `/recapitulatif`, statut vérifiable (`OFFLINE_STATUS`, `SW_PING`/`SW_PONG`), normalisation ciblée des query strings, diagnostic `/sw-status` et aucun faux fallback vers l'accueil.
- [fait] Cache HTTP terrain durci : aucune stratégie runtime HTML/RSC, Supabase prioritaire en `NetworkOnly` et suppression ciblée des anciens caches de pages à l'activation.
- [fait] Synchronisation atomique de snapshots via le RPC `sync_fiche_snapshot()` (révision distante, push forcé, conflit renvoyé sans écriture).
- [fait] Upload des photos vers le bucket privé `photos` (dossier par utilisateur) et enregistrement des lignes `photos` en upsert ; reprise des photos restées en attente.
- [fait] Déclencheurs de synchronisation au démarrage en ligne, au retour réseau et au clic manuel, avec revalidation Auth préalable.
- [fait] Conflits portant sur des groupes de champs (appareil, contexte, site, milieu, météo, commentaires, métadonnées), stockés localement et résolus par choix explicite local/remote.
- [fait] Suppressions offline rejouées avec tombstones et conservation des erreurs.
- [fait] Pull des fiches de l'utilisateur (import/fusion selon la révision distante) et cache superviseur local des fiches des autres enregistreurs (`remote_fiches` par compte).
- [fait] RLS propriétaire et superviseur durcie par migrations versionnées (tables `fiches`, `photos`, `profiles`, `supervisors`).
- [fait] Exports JSON (UTF-8) et CSV encodé UTF-8 avec BOM (séparateur `;`, accents et caractères spéciaux lisibles, valeurs décimales à la virgule pour lat/lon, hauteur de pose et température, `user_id`/`user_name`, `nb_photos`, colonne `photos` listant les noms des fichiers liés).
- [fait] Exports renommés « Projet - Date - Site - Opérateur », photos nommées « Projet - Date - Site - Opérateur - NN.jpg », et téléchargement depuis le récapitulatif : un tableau CSV par projet (ZIP), JSON complet ou ZIP des photos (un dossier par fiche).
- [fait] Duplication d'une fiche ouvrant une nouvelle fiche préremplie et modifiable (champs et photos copiés) ; nom du projet conservé pour la fiche suivante après « Sauvegarder et enregistrer une nouvelle fiche », sauf réinitialisation complète.
- [fait] Nom du projet obligatoire (validation + astérisque), opérateur prérempli au prénom+nom de la personne connectée et modifiable, commune remplie par géocodage inverse avec repli sur BigDataCloud si Nominatim échoue, orientation réglable au curseur avec jauge visuelle, et météo facultative avec vent (échelle de Beaufort) et luminosité en sélection unique.
- [fait] Bords et soulignés de l'interface passés au noir (anneaux de focus, onglets de la barre de navigation, survols, bandeau superviseur) ; icônes PWA régénérées avec une marge de sécurité (le motif ne touche plus les bords), version `?v=3`.
- [fait] Profils utilisateurs contrôlés : table `profiles` préremplie au premier sign-in (nom Google), renommable localement, et noms affichés dans la vue superviseur.
- [fait] Tests unitaires/intégration, scénarios Playwright et CI (qualité, couverture, build, audit, E2E, Supabase).
- [fait] Échange PKCE du code OAuth déplacé vers la route serveur `/api/auth/exchange`, stockage Supabase verrouillé sur la clé `acoustifield-auth`, et page `/auth/auth-code-error` affichant l'erreur exacte renvoyée par Supabase.
- [fait] Footer d'application mentionnant « Développé par viomayo » avec lien vers https://github.com/viomayo.
- [fait] Mise à jour vers Next.js 16.4.5, override `zod` 4.6.7 et audit production sans vulnérabilité haute ou critique (5 avis modérés résiduels via `glob`/`minimatch` de Serwist, non bloquants pour la CI).
- [fait] Corrections mobile PWA : viewport meta `width=device-width, initial-scale=1` pour le rendu correct sur iOS/Android, sélecteur de position GPS sans dépendance Leaflet (champs lat/lon + collage WGS84 + géolocalisation), orientation simplifiée au curseur sans dépendance `DeviceOrientationEvent`.
- [fait] Édition d'une fiche existante depuis le récapitulatif (bouton crayon) : formulaire prérempli avec conservation de l'identifiant, de `createdAt`, de `syncedAt` et de `lastSyncedRemoteRevision`, photos incluses.
- [fait] Nombre de nuits d'écoute recalculé en jours calendaires entre la pose et la recherche, indépendamment de l'heure.
- [fait] Parsing des coordonnées centralisé dans `lib/geo.ts` : décimales à virgule ou point, séparateurs virgule/point-virgule/espace, degrés-minutes-secondes et directions cardinales ; `parseCoordinates` et `parseWgs84` partagent la même implémentation.
- [fait] Champs « N° du boîtier » et « N° du micro » annotés « (si applicable) ».
- [fait] Liste de gestion complétée avec « Prairie - site pâturé (animaux NON présents) ».
- [fait] Commune auto-fiabilisée : repli sur BigDataCloud dès que Nominatim ne fournit pas de commune, prise en charge des hameaux, nouvelle tentative à chaque changement de coordonnées et au retour du réseau, et champ débloqué après un enregistrement ou une réinitialisation pendant une requête.
- [fait] Onglet « Métadonnées » facultatif sur la fiche, complété après la pose : programme d'enregistrement (choix combinables), collecte de données (taux d'échantillonnage 192/256/384/500 kHz avec 256 par défaut, fenêtre de fréquences de déclenchement 0–180 kHz à double curseur, durée inter-puls 0,1–15 s, gain 0–59,5 dB), filtrage/séquençage (durée max des séquences, paramètre de filtration, moulinette, destin des fichiers « bruits »). Section repliable ouverte par défaut si des métadonnées existent, champs partagés extraits dans `form-fields.tsx`/`metadata-fields.tsx`.
- [fait] Édition superviseur des métadonnées des fiches des autres enregistreurs depuis le récapitulatif (bouton crayon sur les fiches distantes) via le RPC `update_fiche_metadata()` : validations de bornes côté serveur, incrément de `sync_revision`, mise à jour du cache superviseur local, et conflit résolu par le propriétaire à la prochaine synchronisation.
- [fait] Métadonnées intégrées à la persistance locale (IndexedDB, brouillon), au snapshot synchronisé, aux exports CSV (une colonne par champ du protocole) et au détail des fiches du récapitulatif.

## Déploiement

- [fait] Nouveau projet Supabase « acoustifield » (ref `kiknpogoreznmgdtpkoh`) créé, distinct de l'ancien projet Chiroptère BXL.
- [fait] Migrations `202608140000_acoustifield_base.sql`, `202608140001_profiles.sql` et `202608140002_acoustifield_fiches.sql` appliquées manuellement au Supabase distant (fait le 14 août 2026) et vérifiées.
- [fait] Client OAuth Google mis en conformité : l'URI de redirection `https://kiknpogoreznmgdtpkoh.supabase.co/auth/v1/callback` est enregistré dans la Google Cloud Console et le secret renseigné dans Supabase (Auth > Providers > Google).
- [fait] Login Google réel concluant (fait le 14 août 2026) ; en cas de `redirect_uri_mismatch` ou d'échec d'échange de code, relire `/auth/auth-code-error` et purger le localStorage/cookies du site.
- [fait] Migrations `202608150000_habitat_autre.sql` et `202608150001_orientation_deg.sql` appliquées manuellement au Supabase distant (fait le 15 août 2026), dans cet ordre, et vérifiées (colonnes présentes dans le Table Editor).
- [à faire] Appliquer la migration `202608190000_pose_recherche.sql` au projet Supabase distant (colonnes `date_heure_pose`, `date_heure_recherche`, `nb_nuits_ecoute` et RPC `sync_fiche_snapshot` mis à jour) avant toute synchronisation de production.
- [à faire] Appliquer ensuite la migration `202611100000_metadonnees.sql` au projet Supabase distant (colonnes métadonnées, `sync_fiche_snapshot` étendu et RPC `update_fiche_metadata`), après `202608190000_pose_recherche.sql` et dans cet ordre.
- [fait] Dépôt GitHub `viomayo/acoustifield` créé (fait le 15 août 2026) et CI GitHub Actions active sur chaque push.
- [fait] Déploiement Vercel en production : [https://acoustifield.vercel.app](https://acoustifield.vercel.app) (fait le 15 août 2026), avec `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` renseignées.
- [fait] « Site URL » et « Redirect URLs » de Supabase (Auth > URL Configuration) configurées vers `https://acoustifield.vercel.app` (fait le 15 août 2026).
- [à faire] Valider le login Google en production sur `https://acoustifield.vercel.app` (en cas d'échec, relire `/auth/auth-code-error` et purger le localStorage/cookies du site).
- [à faire] Refaire une recette réelle sur iOS Safari et Android installés en PWA une fois le déploiement de production actif.

## Évolutions produit possibles

- [à faire] Ajouter une observabilité distante des erreurs de synchronisation si le projet choisit un service de suivi.

Les éléments de cette section sont planifiés et ne doivent pas être présentés comme implémentés.
