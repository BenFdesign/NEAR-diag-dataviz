# Schéma input / output / API et intégration dans une autre plateforme

Ce document donne à un futur développeur une vue **schématique** du fonctionnement de NEAR-diag-dataviz :

- quelles sont les **entrées** (inputs) ;
- quelles sont les **sorties** (outputs) ;
- quels sont les **points d’API** internes ;
- quelles modifications sont nécessaires pour :
  - se connecter proprement à **Metabase** ;
  - intégrer la dataviz comme **page-module** dans une autre application Web plus large.

---

## 1. Vue d’ensemble – pipeline input → API → datapacks → UI

### 1.1. Inputs principaux

- **Exports Metabase (actuellement en JSON)** dans [public/data](public/data) :
  - `Su Data.json`, `Su Bank.json`, `Su Answer.json` ;
  - `Way Of Life Answer.json`, `MetaEmdvQuestions.json`, `MetaEmdvChoices.json` ;
  - `Carbon Footprint Answer.json`, `MetaCarbon.json` ;
  - `Surveys.json`, `Quartiers.json` (diagnostics / quartiers) ;
  - autres fichiers décrits dans [docs/datapacks.md](docs/datapacks.md).
- **Configuration du diagnostic milésimé de quartier courant** :
  - `CURRENT_SURVEY_ID` dans [src/lib/survey-config.ts](src/lib/survey-config.ts) indique quel diagnostic/quartier est affiché.

### 1.2. API internes

- **Route Next d’accès aux données** :
  - `/api/data/[dataset]` dans [src/app/api/data/[dataset]/route.ts](src/app/api/data/%5Bdataset%5D/route.ts)
    - input : `dataset` (nom logique, ex. `Su%20Data`, `Surveys`, `emdv-by-category`) ;
    - output : JSON correspondant, soit lu depuis `public/data`, soit calculé par un datapack serveur (cas spécial EMDV).

- **Loaders côté lib** ([src/lib/data-loader.ts](src/lib/data-loader.ts)) :
  - fonctions de haut niveau :
    - `loadSuData()`, `loadSuBankData()`, `loadWayOfLifeData()`, etc. (lecture générique de dataset) ;
    - loaders filtrés par diagnostic :
      - `loadSuDataForCurrentSurvey()` → `Su Data` filtré sur `CURRENT_SURVEY_ID` ;
      - `loadQuartiersForCurrentSurvey()` → `Quartiers` filtré sur `CURRENT_SURVEY_ID`.
  - ces loaders encapsulent l’**appel HTTP** vers `/api/data/*` + un **cache mémoire** côté client/server.

### 1.3. Datapacks (couche métier)

- Fichiers `Dp*` dans [src/lib/datapacks](src/lib/datapacks) :
  - input :
    - appels aux loaders (`loadSuDataForCurrentSurvey`, `loadQuartiersForCurrentSurvey`, `loadWayOfLifeData`, etc.) ;
    - parfois `fetch('/api/data/...')` direct.
  - traitement :
    - jointures sur les clés Metabase (`"Metabase Question Key"`, `"Metabase Choice Key"`, `"Su ID"`, etc.) ;
    - agrégations, pondérations par population SU / quartier ;
    - calcul de structures prêtes à afficher (séries, labels, couleurs, métadonnées).
  - output :
    - objets `DatapackResponse` normalisés (cf. [src/lib/datapacks/contracts.ts](src/lib/datapacks/contracts.ts)) consommés par les boards UI.

### 1.4. UI (boards & dataviz)

- Entrée UI principale :
  - [src/app/page.tsx](src/app/page.tsx) → monte [DatavizDashboard](src/app/_components/DatavizDashboard.tsx).
- **Dashboard / boards** :
  - `DatavizDashboard` gère : SU sélectionnées, board actif, layout (sidebars, contenu central) ;
  - boards dans [src/app/_components/boards](src/app/_components/boards) appellent les datapacks (via hooks ou fonctions async) ;
  - composant dataviz `Dv*` consomme les `DatapackResponse` et rend les graphiques.
- Sorties (outputs) finales :
  - pages de dataviz interactives niveau quartier / SU ;
  - résumés par âge, genre, CSP, usages, barrières, EMDV, Sankey carbone, etc.

Résumé schématique :

- **Inputs** : exports Metabase JSON + `CURRENT_SURVEY_ID`.
- **API interne** : `/api/data/*` + loaders `data-loader`.
- **Métier** : datapacks `Dp*` (agrégations, pondérations, filtrage sur SurveyID).
- **Outputs** : composants React/Next (boards + graphiques).

---

## 2. Adaptations pour une connexion Metabase

### 2.1. Objectif

Remplacer (ou compléter) l’input "fichiers JSON statiques" par une **connexion directe ou semi-directe à Metabase**, sans casser la logique métier des datapacks.

### 2.2. Point d’extension recommandé : `/api/data/[dataset]`

Plutôt que de modifier chaque datapack :

- garder le contrat actuel côté datapacks : "je demande `/api/data/<dataset>` et je reçois un JSON au même format qu’aujourd’hui" ;
- faire évoluer **l’implémentation de `/api/data/[dataset]`** pour qu’elle se connecte à Metabase.

Approche proposée :

1. **Créer un client Metabase interne** (ou utiliser un proxy existant) dans `src/server` :
   - gérer l’auth Metabase (token, session, SSH tunnel, etc.) ;
   - exposer des appels du type : `fetchMetabaseCard(cardId, params)`, `fetchMetabaseNativeQuery(query, params)`.

2. **Adapter `/api/data/[dataset]`** pour chaque dataset critique :
   - au lieu de lire `public/data/<name>.json`, appeler le client Metabase ;
   - **mapper** la réponse Metabase vers le même schéma que les JSON actuels (mêmes clés, mêmes types) ;

3. **Paramétrer SurveyID / quartier** côté API :
   - propager `CURRENT_SURVEY_ID` ou un `surveyId` passé en query (ex. `/api/data/Su%20Data?surveyId=2`) jusqu’au client Metabase ;
   - filtrer côté Metabase sur ce `surveyId`, pour que les datapacks continuent à recevoir un dataset déjà restreint au bon diagnostic.

### 2.3. Option alternative : batch d’exports Metabase

Si une connexion live n’est pas souhaitée :

- garder la structure actuelle (JSON dans `public/data`) ;
- industrialiser un **processus d’export** (cron CI/CD ou service ETL) qui :
  - appelle Metabase pour générer les exports ;
  - écrit/écrase les fichiers JSON dans `public/data/` au bon format ;
  - déclenche un déploiement ou une invalidation de cache.

### 2.4. Points à valider avec l’équipe infra / data

- Où tourneront les appels Metabase (dans l’app Next, dans un BFF dédié, dans un service de données central) ?
- Comment sont gérés les secrets Metabase (tokens, mots de passe) ?
- Quelle est la fréquence de mise à jour des données attendue (quasi temps réel, quotidien, hebdomadaire) ?

---

## 3. Intégration comme page-module dans un autre projet

### 3.1. --> site Next/React NEAR existant

#### 3.1.1. Côté UI

- Extraire ou référencer :
  - `DatavizDashboard` + `_components/boards` + `_components/dataviz` ;
  - styles nécessaires de [src/styles/dataviz.css](src/styles/dataviz.css) (+ éventuellement une partie de `globals.css`).
- Monter une route dédiée dans la plateforme hôte :
  - ex. `app/diag/page.tsx` qui rend simplement `<DatavizDashboard />` dans le layout global de la plateforme.
- Vérifier la compatibilité CSS :
  - éviter les collisions de styles globaux ;

#### 3.1.2. Côté données / API

Deux cas principaux :

1. **La plateforme hôte peut appeler directement `/api/data/*` de ce module**
   - Garder `/api/data/[dataset]` dans ce projet ;
   - exposer ce module derrière un sous-chemin ou sous-domaine (reverse proxy) ;
   - côté frontend de la plateforme, configurer la base URL des fetchs (`NEXT_PUBLIC_DATAVIZ_API_BASE` par exemple).

2. **La plateforme hôte a déjà son propre backend / BFF**
   - Déplacer la logique de `/api/data/[dataset]` vers ce backend existant ;
   - y recréer des endpoints compatibles (même signatures, même JSON en sortie) ;
   - adapter `data-loader` pour appeler ces nouveaux endpoints (changer la base URL, ou passer par un client HTTP custom).

### 3.2. Scénario : app séparée intégrée via iframe ou microfrontend

- Garder l’app Next telle quelle (routing, `/api/data`, etc.) ;
- l’exposer sur un domaine dédié (ex. `https://diag.example.com`) ;
- intégrer dans la plateforme via :
  - `<iframe src="https://diag.example.com" />`, ou
  - un mécanisme de microfrontend (Module Federation, import dynamique, etc.).

Avantages :

- isolation maximale (CSS, dépendances, runtime) ;
- migration plus simple au début.

Inconvénients :

- intégration UX plus limitée (navigation, header commun, etc.).

---

## 4. Risques et points de vigilance pour l’implémentation

### 4.1. Couplage au schéma Metabase

- Les datapacks supposent des champs précis :
  - `"Metabase Question Key"`, `"Metabase Choice Key"`, `"Su ID"`, `"Survey ID"` / `SurveyId`, etc.
- Tout changement dans les cartes/questions Metabase doit être **répercuté** :
  - soit côté exports (mapping en amont) ;
  - soit dans les datapacks (mises à jour des clés, des types, des jointures).

### 4.2. Gestion du SurveyID / multi-quartiers

- Le diagnostic courant est contrôlé par `CURRENT_SURVEY_ID` dans [src/lib/survey-config.ts](src/lib/survey-config.ts).
- De nombreux éléments (SU, Quartiers, Sankey carbone, etc.) s’appuient sur des loaders filtrés (`loadSuDataForCurrentSurvey`, `loadQuartiersForCurrentSurvey`).
- Pour un **multi-quartiers dynamique** dans la plateforme hôte, il faudra :
  - dériver le SurveyID du contexte (utilisateur, route, paramètres d’URL, etc.) ;
  - exposer une version **paramétrable** des loaders (ex. `loadSuDataForSurvey(surveyId: number)`) ;
  - ou alimenter `CURRENT_SURVEY_ID` à partir d’un contexte global côté serveur/client.

### 4.3. Sécurité, auth, multi-tenant

- Aujourd’hui, `/api/data/*` lit des JSON et ne gère pas d’auth stricte.

### 4.4. CSS global et collisions

- `dataviz.css` définit la mise en page complète du dashboard (flex layout, sidebars, zones scrollables).
- Risques :
  - collisions avec des classes globales de la plateforme hôte ;
  - override involontaire de styles existants.
- Mitigations :
  - préfixer les classes dataviz (`.near-dv-*`) ;
  - encapsuler le dashboard dans un conteneur avec un namespace CSS dédié ;

---

## 5. Checklist pour le futur développeur

1. **Comprendre le pipeline actuel**
   - relire ce document + [docs/datapacks.md](docs/datapacks.md) + [docs/dataviz.md](docs/dataviz.md) ;
   - tracer un exemple complet : `Way Of Life Answer.json` → `/api/data/Way%20Of%20Life%20Answer` → loader → datapack EMDV → composant dataviz.

2. **Décider du mode de connexion Metabase**
   - live via client/proxy Metabase dans `/api/data` ;
   - ou batch d’exports réguliers vers `public/data`.

3. **Choisir la stratégie d’intégration dans la plateforme**
   - module React/Next embarqué (route/page dans le site existant) ;
   - app séparée (iframe, microfrontend, sous-domaine).

4. **Planifier le traitement du SurveyID**
   - définir comment la plateforme fournit le diagnostic courant (context, query param, token) ;
   - adapter les loaders et/ou `CURRENT_SURVEY_ID` pour supporter ce mode.

5. **Sécuriser et tester**
   - ajouter la couche auth/permissions nécessaire autour des endpoints données ;
   - tester les boards critiques (barrières, Sankey carbone, usages) avec des données Metabase réelles.
