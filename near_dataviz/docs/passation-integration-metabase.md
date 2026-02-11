# Q&A de passation – Intégration NEAR-diag-dataviz dans une plateforme existante et connexion Metabase

Ce document prépare la passation du projet NEAR-diag-dataviz à un futur développeur dont la mission est :

- d’intégrer le module de dataviz dans une **plateforme existante** (monorepo, app Next/React, portail interne, etc.) ;
- de connecter (ou reconnecter) la dataviz à des **données issues de Metabase**.

Les questions/réponses ci-dessous sont organisées pour un rendez-vous de passation : elles couvrent l’architecture, les points d’intégration, les dépendances aux exports Metabase, et les risques connus.

---

## 1. Architecture générale

**Q1.1 – Quelle est la stack technique et où commence l’application ?**

- Application Next.js (App Router) : point d’entrée principal dans [src/app/page.tsx](src/app/page.tsx), qui monte le composant [DatavizDashboard](src/app/_components/DatavizDashboard.tsx).
- Client-side : React 19, D3 pour les graphiques, TRPC pour une API applicative (encore peu utilisée par la dataviz), NextAuth + Prisma pour l’auth (principalement sur l’exemple `post`).
- Styling : CSS custom dans [src/styles/dataviz.css](src/styles/dataviz.css) + styles globaux dans [src/styles/globals.css](src/styles/globals.css).

**Q1.2 – Quels sont les grands blocs internes ?**

- **Dashboard / UI** :
  - DatavizDashboard (gestion de l’état global : SU sélectionnées, board courant, sidebars).
  - Boards : fichiers dans [src/app/_components/boards](src/app/_components/boards) (FicheSuBoard, VolonteBoard, etc.).
  - Dataviz unitaires : `Dv*` dans `src/app/_components/dataviz` (graphiques d’âge, CSP, genre, usages, Sankey carbone, etc.).
- **Données métier** :
  - Datapacks `Dp*` dans [src/lib/datapacks](src/lib/datapacks) (Age, Genre, CSP, Usages, Barrières, Sankey, Témoignages…).
  - Services métier partagés comme [src/lib/su-service.ts](src/lib/su-service.ts) (gestion des Sphères d’Usage, Survey, population de quartier).
  - Mapping d’IDs (local UI ↔ global/metabase) via `suIdMapping` dans [src/lib/services](src/lib/services).
- **Accès aux données brutes** :
  - Fichiers JSON Metabase dans [public/data](public/data) (Su Data, Su Answer, Surveys, Quartiers, Meta*…).
  - Route Next `/api/data/[dataset]` dans [src/app/api/data/[dataset]/route.ts](src/app/api/data/%5Bdataset%5D/route.ts) qui sert de passerelle unique vers ces JSON (et certains datapacks serveur).
  - Loader client-side avec cache dans [src/lib/data-loader.ts](src/lib/data-loader.ts).

**Q1.3 – À quoi sert la partie Prisma/NextAuth aujourd’hui ?**

- Prisma et NextAuth sont installés et configurés (voir [prisma/schema.prisma](prisma/schema.prisma), [src/server/db.ts](src/server/db.ts), [src/server/auth](src/server/auth)).
- Le routeur TRPC expose un unique router `post` (voir [src/server/api/routers/post.ts](src/server/api/routers/post.ts)), qui sert surtout d’exemple (création de `Post`, message secret authentifié, etc.).
- **La dataviz actuelle ne dépend pas de la base Prisma** : elle fonctionne entièrement sur les JSON d’exports Metabase.
- Pour l’intégration dans une autre plateforme, cette partie peut être soit réutilisée telle quelle, soit remplacée par les mécanismes d’auth existants de la plateforme hôte.

---

## 2. Intégration comme module dans une autre plateforme

**Q2.1 – Quels sont les scénarios d’intégration typiques ?**

1. **Intégration “frontend only”** :
   - Importer la partie UI (DatavizDashboard + boards + dataviz) dans une app React/Next existante.
   - Rebrancher les appels `/api/data/*` sur l’API ou les assets de la plateforme hôte (serveur Node, reverse-proxy, CDN, etc.).

2. **Intégration “module Next complet”** :
   - Garder l’app Next telle quelle (avec ses routes API /app, Prisma, NextAuth) dans un monorepo ou derrière un reverse proxy.
   - La plateforme existante consomme la dataviz via un iframe ou un sous-domaine (ex. `diag.near.local`).

3. **Intégration hybride** :
   - Conserver uniquement `/api/data/*` côté Next comme BFF (backend for frontend) spécialisé dataviz.
   - Le reste de la plateforme gère l’auth, le routing global, etc., et monte seulement les composants React en tant que “feature module”.

**Q2.2 – Quelles sont les dépendances minimales côté frontend pour extraire le module ?**

Pour déplacer la couche dataviz dans une autre app React/Next :

- Conserver :
  - DatavizDashboard et tous les composants dans [src/app/_components](src/app/_components).
  - Les datapacks et services métier dans [src/lib](src/lib).
  - Les styles dans [src/styles/dataviz.css](src/styles/dataviz.css) + éventuellement les parties utiles de [src/styles/globals.css](src/styles/globals.css).
- Reproduire/adapter :
  - Le provider TRPC React s’il est encore utilisé (voir [src/trpc/react.tsx](src/trpc/react.tsx)), ou le supprimer si la dataviz n’utilise finalement pas TRPC.
  - Le layout global minimal (fonts, body) inspiré de [src/app/layout.tsx](src/app/layout.tsx).

**Q2.3 – Quels sont les points de friction possibles avec une plateforme existante ?**

- **Routing / app shell** : l’app utilise l’App Router Next et suppose un `RootLayout` global.
  - Si la plateforme a déjà son layout, il faudra monter DatavizDashboard dans une route ou un composant dédié.
- **CSS global** : dataviz.css et globals.css imposent certains styles globaux (fonts, body, couleurs de fond).
  - À harmoniser avec la charte CSS de la plateforme (prévoir un namespace CSS ou un refactoring progressif vers des classes plus isolées).
- **Accès aux données** : la dataviz repose fortement sur `/api/data/[dataset]` et sur la présence de JSON dans `public/data`.
  - Sur une autre plateforme, il faudra soit reproduire ce pattern, soit exposer une API équivalente (voir section 3).

---

## 3. Connexion aux données Metabase

**Q3.1 – D’où viennent les données actuellement ?**

- Toutes les données métiers proviennent de **exports Metabase** stockés en JSON dans [public/data](public/data).
- Les exemples de fichiers :
  - `Su Data.json`, `Su Bank.json`, `Su Answer.json` (données par Sphère d’Usage, pondérations, réponses individuelles).
  - `Way Of Life Answer.json` (réponses EMDV), `MetaEmdvQuestions.json`, `MetaEmdvChoices.json`.
  - `Carbon Footprint Answer.json`, `MetaCarbon.json`.
  - `Surveys.json`, `Quartiers.json` (diagnostics et population/INSEE).
- Le document [docs/datapacks.md](docs/datapacks.md) détaille pour chaque datapack quelles tables Metabase alimentent quels JSON.

**Q3.2 – Comment la dataviz charge-t-elle ces données ?**

- Côté serveur Next :
  - Route générique `/api/data/[dataset]` (voir [src/app/api/data/[dataset]/route.ts](src/app/api/data/%5Bdataset%5D/route.ts)) :
    - décode `dataset` (ex : `Su%20Data` → `Su Data`) ;
    - lit `public/data/<decoded>.json` et renvoie le JSON ;
    - cas spécial : `dataset === 'emdv-by-category'` → appelle directement le datapack `getDpEmdvSatisfactionsByCategory`.
- Côté client/datapacks :
  - Deux patterns :
    - via le loader commun [src/lib/data-loader.ts](src/lib/data-loader.ts) (`loadSuData()`, `loadSurveys()`, etc.) ;
    - via des `fetch('/api/data/...')` ad hoc dans certains datapacks (Age, CarbonSankey, etc.).

**Q3.3 – Comment penser une connexion “live” à Metabase ?**

La structure actuelle considère Metabase comme la **source amont** :

- les JSON reflètent déjà le modèle Metabase (clés "Metabase Question Key", "Metabase Choice Key", etc.) ;
- les datapacks font des jointures et agrégations **en supposant ce schéma**.

Pour brancher directement Metabase :

- Option 1 : **continuer à utiliser des exports** mais automatiser leur mise à jour (cron/CI/CD) afin de garder `public/data/*.json` à jour.
- Option 2 : **remplacer `/api/data/[dataset]` par un proxy vers Metabase** :
  - `/api/data/<dataset>` pourrait appeler les endpoints Metabase correspondants, puis renvoyer le même format JSON que les fichiers actuels.
  - Avantage : pas besoin de toucher à la logique des datapacks, seulement au backend `/api/data`.
- Option 3 : **connecter directement les datapacks à Metabase** :
  - refactoriser les fonctions de chargement (actuellement `fetch('/api/data/...')` ou `data-loader`) pour appeler un client Metabase ;
  - plus invasif, mais permet de contrôler plus finement la pagination, la sécurité, etc.

**Q3.4 – Quels sont les éléments spécifiques à Metabase dans le code ?**

- Clés de mapping dans les JSON et dans les interfaces :
  - `"Metabase Question Key"`, `"Metabase Choice Key"` dans de nombreux datapacks (ex : [src/lib/datapacks/DpAgeDistribution.ts](src/lib/datapacks/DpAgeDistribution.ts), [src/lib/datapacks/DpGenre.ts](src/lib/datapacks/DpGenre.ts), [src/lib/datapacks/DpTestimony.ts](src/lib/datapacks/DpTestimony.ts), [src/lib/datapacks/DpCarbonSankey.ts](src/lib/datapacks/DpCarbonSankey.ts), etc.).
- Commentaires explicites sur Metabase dans [src/lib/su-service.ts](src/lib/su-service.ts) et dans [docs/datapacks.md](docs/datapacks.md).
- Les datamaps métier (par ex. catégories, subcategories, témoignages) dépendent directement de ces clés Metabase.

**Q3.5 – Que faut-il vérifier côté plateforme existante pour brancher Metabase ?**

- Si la plateforme a déjà un **proxy Metabase** (par ex. un service interne qui expose des endpoints agrégés) :
  - vérifier si ce proxy peut renvoyer des payloads compatibles avec les JSON actuels ;
  - sinon, prévoir un adaptateur entre les réponses du proxy et le format attendu par les datapacks.
- Si la plateforme n’a pas de proxy Metabase :
  - décider si l’app Next actuelle doit jouer ce rôle (exposer `/api/data/*` qui appelle Metabase) ;
  - ou si un service backend dédié doit être créé (que `/api/data` appellerait ensuite).

---

## 4. Gestion des SU, quartiers et IDs

**Q4.1 – Comment sont gérés les IDs de SU (local vs global vs Metabase) ?**

- **ID local** (UI) :
  - utilisé par le dashboard et les boards (`selectedSus: number[]`) ;
  - typiquement `1..N` pour les SU visibles dans un quartier.
- **ID global / Metabase** :
  - stocké dans `Su Data.json` (`ID`) et utilisé dans `Su Answer.json`, `Way Of Life Answer.json`, etc. sous la forme `"Su ID"` ;
  - représente l’ID physique de la SU côté base/Metabase.
- Le mapping entre les deux est assuré par `suIdMapping` (dans [src/lib/services](src/lib/services)) et accessoirement dans certains datapacks.

**Q4.2 – Comment la notion de quartier et de Survey est-elle gérée ?**

- Le **Survey** représente un diagnostic daté d’un quartier (voir commentaires dans [src/lib/su-service.ts](src/lib/su-service.ts)).
- `Surveys.json` contient au moins : `ID`, `Name` (nom du quartier).
- `Quartiers.json` contient les informations INSEE par quartier, avec un champ `"Survey ID"`.
- Dans `su-service` :
  - une constante `surveyId = 1` est utilisée pour filtrer les données sur un quartier spécifique (Porte d’Orléans) ;
  - `getQuartierName()` et `getQuartierPopulation()` filtrent `Surveys` et `Quartiers` sur ce `surveyId`.
- Pour une intégration dans une plateforme multi-quartiers/multi-utilisateurs, ce `surveyId` devra à terme :
  - être dérivé de l’utilisateur connecté ou du contexte de la plateforme ;
  - être passé en paramètre ou stocké dans un state/context partagé plutôt que fixé en dur.

---

## 5. Authentification, sécurité et multi-tenant

**Q5.1 – Comment est gérée l’auth aujourd’hui ?**

- NextAuth est configuré (voir [src/server/auth](src/server/auth) et [src/server/auth/config.ts](src/server/auth/config.ts) si présent) mais la dataviz ne l’utilise pas pour filtrer les données.
- Les endpoints `/api/data/*` lisent des JSON publics côté serveur et ne font pas de contrôle d’accès.

**Q5.2 – Quelles implications pour une intégration dans une plateforme existante ?**

- Si la plateforme est déjà authentifiée et multi-tenant :
  - il faudra décider si `/api/data/*` devient protégé (via un middleware auth) ;
  - ou si les données retournées sont déjà filtrées par un backend de la plateforme avant d’être exposées à la dataviz.
- Il faudra également décider :
  - comment le `surveyId` ou le périmètre géographique de l’utilisateur est déterminé (paramètre de route, token, header, etc.) ;
  - si la dataviz doit pouvoir afficher plusieurs diagnostics dans la même session.

---

## 6. Risques connus et questions pour le futur développeur

**Q6.1 – Quelles sont les principales zones de fragilité ?**

- **Couplage fort au schéma Metabase actuel** :
  - les champs `"Metabase Question Key"`, `"Metabase Choice Key"`, la structure des exports et les noms de colonnes INSEE sont hardcodés dans les datapacks.
- **Duplications dans le chargement des données** :
  - certains datapacks utilisent `data-loader`, d’autres des `fetch('/api/data/...')` manuels ;
  - pour une intégration propre, prévoir une unification (au moins par type de source : Metabase live vs JSON statiques).
- **Configuration en dur du `surveyId`** dans `su-service` :
  - non compatible avec un contexte multi-quartiers sans refactor.
- **CSS global** :
  - la feuille [src/styles/dataviz.css](src/styles/dataviz.css) définit beaucoup de styles de layout globaux (sidebars, board container, etc.) qui peuvent entrer en conflit avec ceux de la plateforme.

**Q6.2 – Quelles questions poser au product owner / équipe métier lors de la passation ?**

1. Comment la plateforme existante gère-t-elle les diagnostics (équivalent du `surveyId`) ?
2. Souhaite-t-on :
   - continuer à utiliser des exports Metabase (et les rafraîchir régulièrement) ;
   - ou basculer sur une connexion live aux questions Metabase ?
3. La dataviz doit-elle être :
   - un module embarqué (route/feature React) ;
   - ou une app séparée (iframe/sous-domaine) ?
4. Quels sont les besoins d’auth et d’autorisation autour des données de diagnostic (qui peut voir quel quartier) ?
5. Y a-t-il déjà un service interne/proxy pour Metabase que l’on doit réutiliser ?

**Q6.3 – Quelles questions techniques anticiper pour l’équipe de la plateforme ?**

1. Où seront stockées les données brutes : fichiers JSON, base de données, Metabase, autre ?
2. Qui est responsable de la mise à jour des données : équipe Metabase, batch ETL, CI/CD ?
3. Comment versionner ou tracer les diagnostics (équivalent de `surveyId`) dans le système global ?
4. Y a-t-il des contraintes particulières de performance (nombre d’utilisateurs simultanés, taille des datasets) ou de sécurité (données sensibles) ?

---

## 7. Prochaines étapes concrètes pour le futur développeur

Pour préparer l’intégration dans une plateforme existante, un plan possible :

1. **Cartographier les données** :
   - lire attentivement [docs/datapacks.md](docs/datapacks.md) et [docs/dataviz.md](docs/dataviz.md) ;
   - dresser une table de correspondance entre les fichiers `public/data/*.json` et les tables / questions Metabase actuelles.

2. **Choisir la stratégie d’accès aux données** :
   - décider si `/api/data/*` doit être :
     - un proxy vers Metabase ;
     - un proxy vers un backend interne ;
     - ou un simple lecteur de JSON stockés par la plateforme.

3. **Isoler le module dataviz** :
   - extraire (ou encapsuler) DatavizDashboard + `_components` + `lib/datapacks` + `lib/su-service` ;
   - vérifier que les dépendances extérieures (TRPC, Prisma, NextAuth) ne sont pas critiques pour le fonctionnement.

4. **Adapter auth et multi-quartiers** :
   - remplacer la constante `surveyId` de [src/lib/su-service.ts](src/lib/su-service.ts) par un paramètre/context dérivé de l’utilisateur ou de la route ;
   - introduire un contrat clair entre la plateforme et la dataviz pour le périmètre de données à afficher.

5. **Tester avec un flux Metabase réel** :
   - mettre en place un environnement de test (préproduction Metabase, copie de données anonymisées) ;
   - valider les datapacks les plus sensibles (Sankey carbone, barrières, usages, témoignages).

Ce Q&A peut servir de trame pour le rendez-vous de passation, en guidant la discussion sur l’architecture, les contraintes Metabase et les décisions d’intégration à prendre avec l’équipe existante.
