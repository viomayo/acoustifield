# AcoustiField

Application PWA mobile-first pour les fiches de pose d'enregistreurs acoustiques (suivi des chauves-souris). Elle fonctionne localement sur le terrain, puis synchronise les fiches et les photos avec Supabase.

## Fonctions disponibles

- Authentification Google avec Supabase Auth (flux PKCE). Les shells terrain sont publics et statiques ; les données locales sont verrouillées par l'identité cliente et les données distantes par Supabase Auth/RLS.
- Fiche de pose avec sections : Type d'appareil (type, n° de boîtier, n° de micro, carte SD pleine), Contexte (nom du projet obligatoire, opérateur·trice prérempli·e au prénom+nom de la personne connectée et modifiable, date de début de nuit obligatoire, nom du site, localisation WGS84 avec champs latitude/longitude éditables — on peut y coller un couple de coordonnées complet, réparti automatiquement —, commune remplie automatiquement par géocodage inverse, boutons carte et géolocalisation), Caractérisation du milieu (support, ouverture du milieu et description de l'habitat principal obligatoires, habitats principal/secondaire, gestion, éclairage, hauteur de pose, orientation de l'enregistreur réglable au curseur ou par boussole intégrée — repli automatique sur le curseur si la boussole est indisponible), Météo (température en début de nuit, type de nuit, conditions), Photos du milieu et Commentaires. Chaque choix « Autre » (support, habitat) ouvre un champ libre pour préciser la valeur. Les champs numériques (température, hauteur de pose, latitude/longitude) acceptent la virgule comme séparateur décimal (le point reste accepté).
- Brouillon sauvegardé automatiquement dans localStorage ; fiches et photos enregistrées dans IndexedDB, isolées par propriétaire. Le nom du projet est conservé pour la fiche suivante après « Sauvegarder et enregistrer une nouvelle fiche » (effacé à la réinitialisation complète).
- Synchronisation par snapshot atomique via le RPC `sync_fiche_snapshot()` : révision distante, détection de conflit et choix explicite entre version locale ou distante, photos uploadées dans le bucket privé `photos`, suppressions hors ligne conservées sous forme de tombstones.
- Récapitulatif des fiches avec recherche, filtres (toutes / en attente / conflits / synchronisées), détail, duplication (ouvre une nouvelle fiche préremplie et modifiable, photos incluses), suppression, et téléchargement de toutes les fiches : un tableau CSV par projet (une fiche = une ligne, avec les noms des photos dans la colonne `photos`), export JSON complet, ou ZIP des photos nommées « Projet - Date - Site - Opérateur - NN ».
- Mode superviseur (fonction `current_user_is_supervisor()`, table `supervisors`) : chargement des fiches des autres enregistreurs, noms affichés depuis la table `profiles`.
- Profils utilisateurs contrôlés : table `profiles` préremplie au premier sign-in (nom Google), renommable, et noms affichés dans la vue superviseur.
- Exports JSON (UTF-8) et CSV encodé Windows-1252 séparé par des points-virgules, compatible Excel au double-clic (accents lisibles), avec valeurs décimales écrites à la française (virgule) pour la localisation, la hauteur de pose et la température, `user_id`/`user_name`, `nb_photos` et la colonne `photos` listant les noms des fichiers liés, plus export ZIP des photos d'une fiche. Les fichiers téléchargés sont nommés « Projet - Date - Site - Opérateur » et les photos « Projet - Date - Site - Opérateur - NN.jpg ».
- PWA installable avec précache Serwist versionné des deux shells `/` et `/recapitulatif` et page de diagnostic `/sw-status`. Une seule ouverture en ligne prépare les deux shells ; les query strings réutilisent le shell canonique sans modifier l'URL visible.
- Indicateur discret de disponibilité terrain : « Prêt hors ligne » n'apparaît qu'après vérification par le Service Worker de la version et des deux shells, indépendamment de l'état de synchronisation.

## Routes

- `/` : nouvelle fiche
- `/recapitulatif` : récapitulatif des fiches
- `/login` et `/auth/callback` : authentification
- `/auth/auth-code-error` : page d'erreur si l'échange du code OAuth échoue, affichant la raison renvoyée par Supabase
- `/sw-status` : diagnostic PWA

## Installation

Prérequis : Node.js 20 ou plus récent.

```bash
npm ci
cp .env.example .env
npm run dev
```

Variables requises :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://kiknpogoreznmgdtpkoh.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET=
```

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` et `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` sont requis pour l'app. `SUPABASE_SERVICE_ROLE_KEY` (secret `service_role`) n'est utilisée que pour les tâches d'administration ; elle ne doit jamais être exposée côté client ni committée.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
npm run test:e2e
npm audit --omit=dev --audit-level=high
```

Les tests E2E nécessitent Chromium et ses bibliothèques système :

```bash
npx playwright install --with-deps chromium
```

La CI exécute qualité, couverture, build, audit, Playwright et les tests Supabase (`.github/workflows/ci.yml`). La couverture impose au minimum 80 % des lignes et fonctions sur le stockage, la synchronisation et les exports.

## Base de données et déploiement

Le schéma versionné se trouve dans `supabase/migrations/`. Les migrations ajoutent notamment :

- schéma `private` avec `private.is_supervisor()` et la table `supervisors` inaccessible directement aux clients ;
- RPC `current_user_is_supervisor()` ;
- table `profiles` (nom contrôlé de l'utilisateur, prérempli au premier sign-in, modifiable par son propriétaire et lisible par les superviseurs) ;
- tables `fiches` et `photos` avec RLS propriétaire (+ lecture superviseur), révision incrémentale et RPC transactionnelle `sync_fiche_snapshot()` ;
- bucket de stockage privé `photos` avec politiques par dossier utilisateur.

Toutes les migrations ont été appliquées manuellement au projet Supabase distant `acoustifield` (`kiknpogoreznmgdtpkoh`) le 15 août 2026, dans l'ordre `202608140000`, `202608140001`, `202608140002`, `202608150000` (précisions libres pour les habitats « Autre ») et `202608150001` (orientation de l'enregistreur). Pour une prochaine migration :

```bash
supabase start
supabase db reset
supabase test db
supabase link --project-ref VOTRE_REFERENCE
supabase db push --dry-run
supabase db push
```

Ne pas exécuter les deux dernières commandes sans sauvegarde vérifiée et validation explicite du propriétaire du projet.

### Déploiement

- Production : [https://acoustifield.vercel.app](https://acoustifield.vercel.app)
- Dépôt : [https://github.com/viomayo/acoustifield](https://github.com/viomayo/acoustifield)
- CI : GitHub Actions (`.github/workflows/ci.yml`) — lint, typecheck, tests + couverture, build, audit npm, Playwright et tests Supabase sur chaque push.
- Vercel : projet relié au dépôt, framework Next.js auto-détecté. Deux variables d'environnement à renseigner dans Vercel : `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (copiées depuis `.env.local`). `NEXT_PUBLIC_OFFLINE_SHELL_VERSION` est injectée automatiquement par `next.config.ts`.
- Chaque push sur `main` déclenche la CI, puis Vercel redéploie automatiquement sur succès.

### Authentification Google

- Google Cloud Console : le client OAuth enregistre l'URI de redirection `https://kiknpogoreznmgdtpkoh.supabase.co/auth/v1/callback` (et `http://localhost:3000/auth/callback` en développement).
- Supabase (Auth > URL Configuration) : la Site URL doit pointer vers l'URL de production de l'app.
- Supabase (Auth > Providers > Google) : renseigner le Client ID et le Client Secret Google (ce dernier correspond à `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET`).

## Sécurité et offline

Le Service Worker n'intercepte plus les shells `/` et `/recapitulatif` autrement que via le précache : il ne lit plus leurs cookies, n'injecte plus d'identité et n'appelle plus de RPC superviseur. Le callback OAuth reste un flux en ligne : le code verifier PKCE est relu dans le stockage local persistant, puis l'échange du code est effectué par la route serveur `/api/auth/exchange` avant que la session Supabase ne soit persistée sous la clé `acoustifield-auth` (`lib/supabase/client.ts`), juste avant le retour sur `/`. Toute donnée distante reste contrôlée par Supabase Auth et les politiques RLS.

Une couche cliente globale vérifie l'utilisateur avec Supabase puis, si le serveur est injoignable ou la session expirée, expose uniquement l'identité locale active. Les shells `/` et `/recapitulatif` sont prérendus sans donnée utilisateur ; ils ne lisent IndexedDB qu'après résolution de cette identité. Cette couche ne confère aucun droit distant.

Le Service Worker précache atomiquement les deux shells et leurs assets pour la version courante du build. Le protocole `OFFLINE_STATUS` permet de vérifier la version et la présence de chaque route (`SW_PING`/`SW_PONG`, `PREPARE_OFFLINE`). Les appels vers l'origine Supabase restent strictement réseau et ne sont jamais mis en cache.

Les navigations et payloads RSC ne disposent plus de cache runtime : les shells viennent uniquement du précache versionné, et toute autre navigation reste réseau. À l'activation, le Service Worker supprime seulement les anciens caches applicatifs `pages-navigate`, `pages-rsc`, `pages-rsc-prefetch` et `pages`. Une route absente échoue explicitement sans recevoir le document d'une autre route.

Après authentification en ligne, l'interface déclenche automatiquement `PREPARE_OFFLINE`. Une confirmation réussie enregistre aussi la version préparée dans le profil local, uniquement comme métadonnée : le Service Worker reste la source de vérité du statut. En cas d'échec ou de mise à jour incomplète, un bouton « Réessayer » relance la vérification sans toucher aux données métier.

Une déconnexion volontaire verrouille immédiatement l'interface, désactive le profil offline avant de tenter la déconnexion Supabase et conserve les fiches, conflits et suppressions en attente. Une panne réseau ordinaire ne désactive pas le profil offline.

La synchronisation automatique ne démarre qu'après confirmation distante de l'identité. Au retour du réseau, le provider revalide d'abord Supabase ; les états `offline` et `expired` ne déclenchent aucun appel métier distant. Les fiches `dirty`, tombstones, révisions et conflits suivent ensuite exactement le même flux que le bouton Sync.

## Auteurs

[@viomayo](https://github.com/viomayo) · [@thedasken](https://github.com/thedasken) · Ancien déploiement du prédécesseur Chiroptère BXL : [chiroptere-bxl.vercel.app](https://chiroptere-bxl.vercel.app)
