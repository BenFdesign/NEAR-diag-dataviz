# Datapacks NEAR-diag-dataviz

Ce document décrit le fonctionnement des *datapacks* dans l’application, leurs liens avec l’API `/api/data`, les fichiers JSON de `public/data`, ainsi que les principaux risques et incohérences à connaître pour une intégration ou une refactorisation.

---

## 1. Concept de "datapack"

Un **datapack** est un module TypeScript situé dans `src/lib/datapacks` qui :

- charge des données brutes (exports Metabase) stockées dans `public/data/*.json` ;
- applique une logique métier d’agrégation / transformation (moyennes, regroupements, pondérations, etc.) ;
- expose une API (fonctions, types) consommée par les composants de dataviz (`Dv*`) dans `src/app/_components/dataviz`.

Ces datapacks sont pensés comme une couche **d’entre-deux** entre :

- les fichiers JSON issus de Metabase (via l’API `/api/data/[dataset]`) ;
- les composants React/D3 qui dessinent les graphiques.

Il n’existe **pas encore de contrat unique** : chaque datapack a sa propre signature (sync/async, forme du retour, gestion des SU, métadonnées, etc.).

---

## 2. Données brutes et API `/api/data/[dataset]`

### 2.1. Fichiers JSON dans `public/data`

Les exports Metabase sont stockés dans `public/data` sous forme de JSON, par exemple :

- `Su Answer.json`
- `Su Data.json`
- `Su Bank.json`
- `MetaSuQuestions.json`, `MetaSuChoices.json`
- `MetaEmdvQuestions.json`, `MetaEmdvChoices.json`
- `Carbon Footprint Answer.json`, `MetaCarbon.json`
- `Way Of Life Answer.json`
- `Quartiers.json`
- `Surveys.json`

Ces fichiers représentent l’unique source de vérité côté front pour les données de diagnostic.

### 2.2. Route unifiée `/api/data/[dataset]`

Fichier clé : `src/app/api/data/[dataset]/route.ts`.

- `GET /api/data/:dataset` (où `dataset` est URL-encodé) :
  - décode `dataset` (`decodeURIComponent`) en `decodedFilename` ;
  - cas spécial [tests en attendant la bonne structure dans le questionnaire, **ne pas intégrer**]:
    - `decodedFilename === 'emdv-by-category'` → appelle le datapack `getDpEmdvSatisfactionsByCategory` (server-side) avec les paramètres de requête (`category`, `sus`) et renvoie un **payload calculé** ;
  - sinon :
    - construit un chemin `public/data/${decodedFilename}.json` ;
    - lit le fichier avec `fs.readFile` ;
    - renvoie le contenu JSON (avec un cache HTTP générique `max-age=86400`).

Cette route est donc :

- **un proxy générique** vers les JSON bruts ;
- **un point d’entrée pour certains datapacks server-side** (EMDV, mobilité).

### 2.3. Loader client-side `data-loader`

Fichier : `src/lib/data-loader.ts`.

- Fourni une API commune pour charger les données avec **cache côté client** :
  - `loadSuBankData()` → `/api/data/Su%20Bank`
  - `loadSuData()` → `/api/data/Su%20Data`
  - `loadSurveys()` → `/api/data/Surveys`
  - `loadQuartiers()` → `/api/data/Quartiers`
  - `loadWayOfLifeData()` → `/api/data/Way%20Of%20Life%20Answer`
  - `loadCarbonFootprintData()` → `/api/data/Carbon%20Footprint%20Answer`
  - `loadMetaEmdvQuestions()`, `loadMetaEmdvChoices()`
  - `loadMetaSuQuestions()`, `loadMetaSuChoices()`
  - `loadSuAnswer()` → `/api/data/Su%20Answer`
  - `loadMetaCarbon()`, etc.
- Tous ces helpers sont :
  - `async` ;
  - basés sur `fetch('/api/data/<endpoint>')` ;
  - avec un cache mémoire (objet `dataCache`) **sans expiration**.

Certains datapacks utilisent ces helpers, d’autres contournent ce loader et appellent directement `/api/data/*`.

---

## 3. Datapacks principaux

### 3.1. `DpAgeDistribution` – Distribution des âges

Fichier : `src/lib/datapacks/DpAgeDistribution.ts`.

**Rôle** :

- Vue SU : calcule la distribution d’âge d’une SU donnée à partir des réponses individuelles (`Su Answer.json`).
- Vue quartier : calcule la distribution d’âge agrégée à partir des données INSEE (`Quartiers.json`).

**Entrées de données** :

- `Su Answer.json` (réponses individuelles, champ `"Age Category"` + `"Su ID"` global) ;
- `MetaSuQuestions.json` (texte, emoji, labels de la question "Age Category") ;
- `MetaSuChoices.json` (labels et emojis des différentes tranches d’âge) ;
- `Quartiers.json` (colonnes INSEE : `"Population Sum"`, `"P21 Pop1529 Sum"`, `"P21 Pop3044 Sum"`, `"P21 Pop4559 Sum"`, `"P21 Pop6074 Sum"`, `"P21 Pop75p Sum"`).

**Chargement / API** :

- Vue SU :
  - reçoit `selectedSus?: number[]` (ids *locaux* de SU) ;
  - si exactement 1 SU :
    - mappe l’ID local → global via `mapLocalToGlobalIds` (service `suIdMapping`, qui lui-même lit `Su Bank.json` via `/api/data/Su%20Bank`) ;
    - charge en parallèle `Su Answer`, `MetaSuQuestions`, `MetaSuChoices` avec `fetch('/api/data/...')` (sans passer par `data-loader`) ;
    - filtre les réponses sur `"Su ID"` (global) ;
    - compte les occurrences par `"Age Category"`, calcule les pourcentages, et applique les points médians de tranche (`AGE_MIDPOINTS`).

- Vue quartier :
  - si `selectedSus` est vide ou a plus d’un élément :
    - charge `Quartiers.json` via `/api/data/Quartiers` ;
    - agrège les colonnes INSEE → codes internes (`FROM_15_TO_29`, etc.) ;
    - calcule les pourcentages et fournit des labels/emoji par défaut.

**Sortie (`AgeDistributionResult`)** :

- `data[]`: `[{ value, label, emoji, count, percentage, midpoint }]` ;
- `isQuartier: boolean` ;
- `questionLabels`: `{ title, emoji, questionOrigin, questionShort }` ;
- `suId?: number` (ID global en vue SU) ;
- `totalResponses`, `dataSource` (ex: "Su Answer" ou "Quartiers INSEE").

**Cache** :

- `Map<string, AgeDistributionResult>` + `cacheTimestamp` + `CACHE_DURATION = 1h`.
- Clé : `JSON.stringify(selectedSus ?? [])`.

**Lien avec la dataviz** :

- Composant `DvAgeDistribution` (`src/app/_components/dataviz/DvAgeDistribution.tsx`) :
  - `useEffect` client :
    - mappe `selectedSus` locaux → IDs globaux (pour les couleurs) via `mapLocalToGlobalIds` ;
    - appelle `getDpAgeDistributionData(selectedSus)` ;
    - récupère la palette et la couleur principale via `DpColor` (`getPalette`, `getSuColors`) ;
    - dessine un graphe *line/area* avec D3.

---

### 3.2. `DpBarrierAnalysisV2` – Barrières par question / famille

Fichier : `src/lib/datapacks/DpBarrierAnalysisV2.ts`.

**Rôle** :

- Construire des indicateurs de barrières :
  - par question (EMDV) ;
  - par famille de barrières (`famille_barriere`) ;
  - avec distinction des réponses « autres raisons ».
- Gérer à la fois :
  - la vue **quartier pondérée** (moyenne pondérée par la population des SU) ;
  - les vues **SU spécifiques**.

**Entrées de données** (via `data-loader`) :

- `MetaEmdvChoices.json`, `MetaEmdvQuestions.json` ;
- `Way Of Life Answer.json` (contient notamment les réponses multiples sur les barrières) ;
- `Su Bank.json` (liste des SU, exclut `Id=0` pour les SU réelles) ;
- `Su Data.json` (mapping `ID` ↔ `Su` + `"Pop Percentage"`).

**Chargement / API** :

- `precomputeAllBarrierData()` :
  - appelé une seule fois ;
  - construit :
    - `allSuResults: Map<number, BarrierQuestionData[]>` (par `SuBank.Id`) ;
    - `quartierResults: BarrierQuestionData[]` (pondération par `Pop Percentage`).
- Cache interne :
  - `precomputedCache: PrecomputedBarrierData | null` (sans TTL), vidé par `clearBarrierCache()`.

**Fonctions publiques** :

- `getBarrierData(selectedSus?)` :
  - si `selectedSus` vide ou `length > 1` → vue quartier (pondérée) ;
  - sinon :
    - utilise `Su Data` pour mapper `selectedSus` (numéros locaux) → `ID` global ;
    - renvoie les données pré-calculées pour cette SU ;
  - renvoie aussi la couleur associée (via `Su Bank.colorMain`).

- `getBarrierDataForQuestion(questionKey, selectedSus?)` :
  - utilise `getBarrierData` puis filtre sur une seule question ;

- `getAggregatedBarrierData(selectedSus?)` :
  - agrège toutes les questions en une vue unique par famille ;

- `getAvailableBarrierQuestions()` :
  - renvoie la liste des questions disponibles (pour menus, sélecteurs, etc.).

**Lien avec la dataviz** :

- Utilisé par les boards et composants de barrières (`BarrierBoards`, `BarrierQuestionBoards`, etc.) qui passent `selectedSus`.

---

### 3.3. `DpCarbonSankey` – Flux carbone hiérarchiques

Fichier : `src/lib/datapacks/DpCarbonSankey.ts`.

**Rôle** :

- Transformer les données carbone par SU en une structure adaptée à D3 Sankey :
  - noeuds (catégories, sous-catégories) ;
  - liens (flux de valeur entre niveaux).

**Entrées de données** :

- `Carbon Footprint Answer.json` (valeurs carbone par clé, champ `"Su ID"`) ;
- `MetaCarbon.json` (métadonnées : `is_node`, `parent_node`, labels, emojis, `"Metabase Question Key"`) ;
- `Su Data.json` (mapping `Su` ↔ `ID`, `"Pop Percentage"`).

**Chargement** :

- `fetch('/api/data/Carbon%20Footprint%20Answer')` ;
- `fetch('/api/data/MetaCarbon')` ;
- `fetch('/api/data/Su%20Data')` ;
- ne passe pas par `data-loader`.

**Logique principale** :

- Vue SU
  - si `selectedSus` = `[n]` :
    - `effectiveSuNumber = n` ;
    - filtre `Carbon Footprint Answer` sur `"Su ID"` correspondant à `Su Data.ID` du SU `n` ;
    - calcule des moyennes par clé carbone (parmi les `is_node=true`).

- Vue quartier
  - si `selectedSus` vide ou `length > 1` :
    - calcule les valeurs moyennes par SU ;
    - les agrège via une moyenne pondérée selon `Su Data["Pop Percentage"]`.

- Construction du Sankey
  - utilise `MetaCarbon` pour :
    - identifier les noeuds (`is_node`) ;
    - reconstruire l’arbre parent/enfant via `parent_node` ;
  - calcule pour chaque clé la somme de sa sous-arborescence ;
  - crée :
    - `nodes[] = { id, name, emoji, value }` ;
    - `links[] = { sourceIndex, targetIndex, value }`.

**Sortie (`CarbonSankeyPayload`)** :

- `id: 'DpCarbonSankey'`, `version` ;
- `sankeyData: { nodes[], links[] }` ;
- `selectedView: { suIds: number[], color: string, isQuartier: boolean }` ;
- `warnings[]` (données manquantes, etc.) ;
- `meta: { totalValue, maxNodeValue }`.

**Cache** :

- `Map<string, CarbonSankeyPayload>` + `CACHE_DURATION = 30 min` ;
- clé = `DpCarbonSankey|quartier` ou `DpCarbonSankey|su-<num>`.

**Lien dataviz** :

- Consommé par le composant `DvCarbonSankey` (intégré dans le `FicheSuBoard`).

---

### 3.4. `DpUsages` et sous-datapacks d’usages

Fichiers :

- `src/lib/datapacks/DpUsages.ts` ;
- `DpUsagesMeatFrequency.ts`, `DpUsagesTransportationMode.ts`, `DpUsagesDigitalIntensity.ts`, `DpUsagesPurchasingStrategy.ts`, `DpUsagesAirTravelFrequency.ts`, `DpUsagesHeatSource.ts`.

**Rôle** :

- Pré-calculer les distributions d’usage (viande, transport, intensité numérique, stratégie d’achat, voyages en avion, source de chauffage) :
  - par SU ;
  - pour le quartier (agrégation).

**Entrées de données** :

- Ces sous-datapacks chargent désormais les données via `data-loader` + `/api/data`, notamment :
  - `loadSuAnswer()` → `Su Answer.json`
  - `loadSuData()` → `Su Data.json`
  - `loadMetaSuQuestions()`, `loadMetaSuChoices()` → métadonnées des questions/choix.

**Chargement / API** :

- Sous-datapacks :
  - s’appuient sur `data-loader` (cache global sans TTL) pour récupérer les données brutes ;
  - pré-calculent les structures en mémoire lors du premier appel (`precomputeAll*`) avec un cache local par datapack ;
  - exposent désormais des fonctions **asynchrones** comme `fetchMeatFrequencyData(selectedSus?)`.

- `DpUsages.ts` :
  - définit un mapping `SU_USAGES_MAPPING` (question → fonction de fetch async, clé de retour) ;
  - `getSuUsagesData(selectedSus?)` → pour chaque question du mapping, appelle en parallèle la fonction de fetch correspondante (async) ;

**Fonctions publiques** :

- `fetchSuUsagesData(selectedSus?)` (async) :
  - retourne un objet structuré par domaines (`meatFrequency`, `transportationMode`, etc.) pour compatibilité historique.

- `fetchSuUsagesExtendedData(selectedSus?)` (async) :
  - retourne un tableau `SuUsageQuestion[]` contenant :
    - `questionKey`, `questionLabels`, `data[]`, `totalResponses`, `isQuartier`, `suId?`.

**Lien dataviz** :

- `DvUsages` (`src/app/_components/dataviz/DvUsages.tsx`) :
  - dans `useEffect`, appelle `fetchSuUsagesExtendedData(selectedSus)` (fonction async, attendue via `await`) ;
  - obtient la palette et les couleurs de SU via `DpColor` + `suIdMapping` ;
  - construit un graphe en “violon” D3 par question d’usage.

---

**3.5. Autres datapacks**

- `DpCsp`, `DpGenre` :
  - distributions similaires à `DpAgeDistribution` (CSP, genre), utilisées par `DvCsp`, `DvGenre`.

- `DpEmdvSatisfactionsByCategory` :
  - appelé server-side via `/api/data/emdv-by-category` ;
  - retourne un payload structuré utilisé par un composant d’EMDV (satisfactions par catégorie).

- `DpColor` :
  - fournit `getSuColors(globalSuId?)`, `getPalette(type, globalSuId?)` ;
  - lit les infos couleur depuis `Su Bank.json` et dérive des palettes ;
  - utilisé par de nombreux composants dataviz pour garder une identité visuelle cohérente.

---

## 4. Flux global : de `public/data` jusqu’aux composants `/dataviz`

### 4.1. Entrée UI : `DatavizDashboard`

- Route : `/` → `src/app/page.tsx` → `DatavizDashboard` (`src/app/_components/DatavizDashboard.tsx`).
- `DatavizDashboard` (client) :
  - charge l’ensemble des SU via `getSuInfo()` (service SU, `src/lib/su-service.ts`) ;
  - initialise `menuState` :
    - `selectedBoard` (board courant, via `getDefaultBoard`) ;
    - `selectedSus`: tous les numéros de SU du quartier ;
    - `availableSus`: liste complète des SU (métadonnées, couleurs, icônes).
  - affiche :
    - `LeftSidebar` (sélection SU / Quartier) ;
    - `BoardViewer` (conteneur du board courant) ;
    - `RightSidebar` (sélecteur de board).

### 4.2. Services SU / mapping d’IDs

- `su-service` (`src/lib/su-service.ts`) :
  - `getQuartierName()` : lit `Surveys.json` via `data-loader` et filtre sur `surveyId=1` ;
  - `getQuartierPopulation()` : lit `Quartiers.json` via `data-loader` pour le même `surveyId` ;
  - `getSuInfo()` :
    - lit `Su Bank.json` + `Su Data.json` via `data-loader` ;
    - filtre sur `"Survey ID" === surveyId` ;
    - recalcule `realPopulation` par SU ;
    - construit des `SuInfo` (nom, couleur, icône validée, etc.).

- `suIdMapping` (`src/lib/services/suIdMapping.ts`) :
  - lit `Su Bank.json` via `fetch('/api/data/Su%20Bank')` ;
  - construit un mapping "id local UI" (1..N) ↔ `Id` global (477, 478, ...) ;
  - expose :
    - `mapLocalToGlobalIds(localIds[])` ;
    - `mapGlobalToLocalIds(globalIds[])` ;
    - `getSuInfoByLocalId`, `getSuInfoByGlobalId`, `getAllSuMappings()`.

Ce mapping est utilisé par plusieurs datapacks (ex : `DpAgeDistribution`, `DpColor`) pour traduire `selectedSus` de l’UI en IDs utilisables sur les jeux de données.

### 4.3. Boards et composants `Dv*`

- `RightSidebar` :
  - liste les boards définis dans un registry (ex. `FicheSuBoard`, `VolonteBoard`, `BarrierBoards`, `TestimonyBoard`, etc.) ;
  - met à jour `menuState.selectedBoard`.

- `LeftSidebar` :
  - permet de :
    - sélectionner le **quartier** (toutes les SU) ;
    - ou une SU individuelle (un numéro dans `selectedSus`) ;
  - met à jour `menuState.selectedSus`.

- `BoardViewer` :
  - rend `currentBoard.renderComponent({ selectedSus: menuState.selectedSus })`.

Exemple : `FicheSuBoard` (`src/app/_components/boards/FicheSuBoard.tsx`) :

- affiche un ensemble de composants :
  - `DvSuTitle`
  - `DvGenre`
  - `DvAgeDistribution`
  - `DvCsp`
  - `DvUsages`
  - `DvCarbonSankey`
- tous reçoivent la même prop `selectedSus`.

### 4.4. De `Dv*` aux datapacks et à l’API

Pour chaque composant `Dv*` :

1. Récupère `selectedSus` (ids locaux UI).
2. Optionnellement, mappe vers les IDs globaux via `suIdMapping` (souvent pour les couleurs ou les filtres). 
3. Appelle la fonction du datapack correspondant :
   - `getDpAgeDistributionData(selectedSus)` (async) ;
   - `fetchSuUsagesExtendedData(selectedSus)` (sync) ;
   - `getDpCarbonSankeyData(selectedSus)` (async) ;
   - `getBarrierData(selectedSus)`, etc.
4. Le datapack :
   - soit utilise `data-loader` → `fetch('/api/data/…')` → `public/data/*.json` ;
   - soit fait `fetch('/api/data/...')` directement ;
   - soit importe les JSON de `public/data` au build.
5. Le résultat structuré est rendu graphiquement via D3 dans le composant `Dv*`.

---

## 5. Incohérences et risques identifiés

### 5.1. Modes d'accès aux données

**Action de standardisation effectuée** :

Les datapacks `DpAgeDistribution`, `DpCarbonSankey` et `suIdMapping` ont été refactorés pour utiliser **exclusivement `data-loader`** au lieu des appels `fetch` directs.

**État actuel** :

1. **Via `data-loader` + API `/api/data`** (pattern standard adopté) ✅ :
  - `DpAgeDistribution` : utilise `loadSuAnswer()`, `loadQuartiers()`, `loadMetaSuQuestions()`, `loadMetaSuChoices()`
  - `DpCarbonSankey` : utilise `loadCarbonFootprintData()`, `loadMetaCarbon()`, `loadSuData()`
  - `suIdMapping` : utilise `loadSuBankData()`
  - `DpBarrierAnalysisV2`, `su-service`, `DpEmdvSatisfactionsByCategory`
  - sous-datapacks d'usages (`DpUsages*`) : utilisent désormais `loadSuAnswer()`, `loadSuData()`, `loadMetaSuQuestions()`, `loadMetaSuChoices()` via `data-loader`, avec pré-calcul en mémoire.

**Bénéfices** :

- comportement de cache unifié via `data-loader` ;
- plus facile à tester (mock d'un seul point d'entrée) ;
- réduction des dépendances aux URLs `/api/data/*` dans les datapacks individuels ;
- maintenance simplifiée.

### 5.2. Sync vs async

- Datapacks **async** (Promesse) :
  - `getDpAgeDistributionData`, `getDpCarbonSankeyData`, `getBarrierData*`, `getDpEmdvSatisfactionsByCategory`, `getSuInfo`, helpers de `data-loader`, etc.

- Datapacks **sync** :
  - `fetchSuUsagesData`, `fetchSuUsagesExtendedData`, sous-datapacks `DpUsages*` (pré-calcul en mémoire) ;

Cela rend difficile l’introduction d’une interface commune type `useDatapack()`.

### 5.3. Gestion des IDs SU (local vs global)

- `su-service` distingue :
  - `SuData.ID` (ID global, clé primaire),
  - `SuData.Su` (numéro local dans le quartier).

- `suIdMapping` reconstruit un mapping local/global à partir de `Su Bank` (suppose un ordre trié par `Id`).

- `DpAgeDistribution` :
  - reçoit des `selectedSus` locaux → `mapLocalToGlobalIds` → filtre `Su Answer["Su ID"]` (global).

- `DpCarbonSankey` :
  - utilise `Su Data` pour mapper numéro SU (`Su`) → `ID` (pour filtrer `"Su ID"`).

- `DpUsages*` :
  - mélange potentiellement `Su`, `ID` et `"Su ID"` avec des noms de variables pas toujours explicites.

**Risques** :

- confusion entre `Su`, `ID`, `"Su ID"`, ID local vs ID global ;
- si la structure de `Su Bank`/`Su Data` change, plusieurs datapacks peuvent casser.

### 5.4. Politiques de cache hétérogènes

- `data-loader` : cache global en mémoire, **sans TTL**.
- `DpAgeDistribution` : TTL 1h.
- `DpCarbonSankey` : TTL 30 mn.
- `DpBarrierAnalysisV2` : pré-calcul persistant jusqu’à `clearBarrierCache()` ou reload.
- `DpUsages*` : pré-calcul lors du chargement de module (valide jusqu’au reload du bundle).

**Risques** :

- incohérences de fraîcheur des données ;
- comportements différents entre développement / production.

### 5.5. Couplage fort à Next.js et au projet courant

- Datapacks :
  - reposent sur `fetch` global, les routes `/api/data/*` et la présence des JSON dans `public/data` ;

- Composants `Dv*` :
  - `use client`, D3, manipulations directes du DOM (`document.body`, tooltips globaux) ;
  - styles dépendant de classes définies dans `src/styles/dataviz.css` et `src/styles/globals.css` ;

**Pour une intégration dans un autre site** :

- il faut soit répliquer l’API `/api/data` et les JSON, soit extraire la logique de transformation pour l’appeler avec des données injectées ;
- et prévoir une intégration CSS (ou réécrire le rendu des composants).

### 5.6. Surface d’export officielle incomplète

- `src/lib/datapacks/index.ts` exporte seulement :
  - `DpAgeDistribution`, `DpGenre`, `DpCsp`, `DpCarbonSankey`.

- D’autres datapacks (barrières, usages, volontés, mobilité, couleurs, titres, etc.) sont importés directement fichier par fichier.

**Conséquence** :

- le "catalogue" des datapacks n’est pas centralisé ;
- un futur refactoring ou packaging demande d’identifier les datapacks un par un.

---

## 6. Pistes pour une intégration comme composant dans un autre site

Pour réutiliser les datapacks / dataviz dans un autre projet ou un autre site, les principaux points d’attention sont :

1. **Sources de données** :
   - décider si l’on réutilise les mêmes fichiers JSON (et les mêmes clés Metabase) ;
   - ou si l’on injecte un schéma différent → cela impliquera d’adapter les interfaces de données et les mappings (par ex. colonnes INSEE, champs `"Age Category"`, `"Metabase Question Key"`, etc.).

2. **Couche API** :
   - soit recréer une route `/api/data/[dataset]` compatible et stocker les JSON dans `public/data` ;
   - soit modifier les datapacks pour qu’ils reçoivent directement les données (fonctions pures) au lieu de faire des `fetch` internes.

3. **Gestion des SU** :
   - choisir si le nouveau site garde :
     - `Su Bank`, `Su Data`, `Su Answer`, `Way Of Life Answer`, etc. ;
     - le mapping local/global via `suIdMapping` ;
   - ou si l’on simplifie en n’ayant qu’un seul type d’ID → adapter la logique des datapacks concernés.

4. **Rendu graphique & CSS** :
   - les composants `Dv*` sont aujourd’hui très liés à D3 + CSS maison ;
   - pour un usage en "lib", il peut être pertinent de :
     - isoler une API "données" (datapacks) ;
     - laisser chaque projet implémenter son rendu graphique propre.

5. **Interface commune des datapacks** (éventuelle refacto) :
   - converger vers une signature homogène du type :
     - `get<NomDatapack>Data(options: { selectedSus?: number[], view?: 'su' | 'quartier', ... }): Promise<{ meta, data }>` ;
   - documenter systématiquement :
     - les dépendances (`public/data/*`, API, services) ;
     - la structure exacte du retour (`types.ts`).

---

Ce document pourra servir de base pour :

- documenter les comportements existants ;
- préparer une standardisation de l’interface des datapacks ;
- évaluer l’impact d’une intégration dans un autre site (ou d’une extraction en librairie).

---

## 7. Contrat cible pour standardiser les datapacks

Cette section propose un contrat cible pour harmoniser les datapacks. L’objectif est de faciliter :

- la compréhension et la documentation ;
- la réutilisation dans d’autres projets ;
- la mise en place de tests et de hooks génériques (par ex. `useDatapack`).

### 7.1. Signature commune recommandée

Pour les datapacks qui dépendent des données SU (cas majoritaire) :

- Fonction principale :
  - `get<NomDatapack>Data(options: DatapackRequest): Promise<DatapackResponse<SpecificPayload>>`

- Type générique d’entrée :
  - `DatapackRequest` :
    - `selectedSus?: number[]` – IDs de SU tels qu’ils sont manipulés par l’UI (convention locale unique) ;
    - `view?: 'auto' | 'quartier' | 'su'` –
      - `auto` (défaut) :
        - 0 SU → quartier ;
        - 1 SU → vue SU ;
        - >1 SU → stratégie spécifique (ex. quartier pondéré, multi-SU non supporté, etc.) ;
      - `quartier` : forcer la vue agrégée ;
      - `su` : forcer la vue SU, même si plusieurs IDs sont passés (le datapack peut choisir la première SU et signaler un warning).
    - `signal?: AbortSignal` – pour annuler les appels asynchrones si nécessaire ;
    - `extra?: Record<string, unknown>` – pour des paramètres spécifiques au datapack (ex. `category` pour EMDV).

- Type générique de sortie :
  - `DatapackResponse<TData>` :
    - `id: string` – identifiant unique du datapack (ex. `"DpAgeDistribution"`) ;
    - `version: string` – version du contrat de données ;
    - `data: TData` – payload spécifique à la dataviz (par ex. distribution, network, sankey, etc.) ;
    - `context: {`  
      `view: 'quartier' | 'su'` – vue réellement utilisée ;  
      `selectedSus: number[]` – IDs tels que reçus en entrée (convention UI) ;  
      `resolvedSuIds?: number[]` – IDs résolus après mapping (si local/global distincts) ;  
      `color?: string` – couleur principale utilisée (optionnel) ;  
      `isPartial?: boolean` – indique si les données sont partielles (ex. multi-SU réduit à 1 SU) ;  
    `}` ;
    - `meta?: Record<string, unknown>` – informations complémentaires (totaux, moyennes, bornes min/max, etc.) ;
    - `warnings?: Array<{ type: string; message: string }>` – liste des avertissements métier ou techniques ;
    - `errors?: Array<{ type: string; message: string }>` – liste des erreurs non bloquantes (si le datapack choisit de renvoyer un fallback plutôt que de throw).

Chaque datapack définit ensuite son propre type `SpecificPayload` (par ex. `AgeDistributionResult['data']`, `BarrierQuestionData[]`, `D3SankeyData`, etc.).

### 7.2. Conventions de gestion des SU

Pour éviter la confusion entre IDs locaux/globaux :

- **Convention** :
  - partout dans les composants et l’UI, `selectedSus` représente des IDs **logiques** (locaux à l’interface) ;
  - tout mapping vers des IDs "physiques" (global, Metabase, etc.) est géré **à l’intérieur du datapack** (ou d’un service partagé comme `suIdMapping`).

- Recommandations :
  - exposer dans `context.resolvedSuIds` la liste des IDs réellement utilisés pour filtrer les données (ex. `Su Answer["Su ID"]`) ;
  - en cas de multi-SU non supporté, soit :
    - forcer la vue quartier (`view: 'quartier'`) et ajouter un warning ;
    - soit sélectionner la première SU, l’indiquer dans `warnings` et marquer `isPartial: true`.

### 7.3. Conventions de chargement des données

Pour homogénéiser l’accès aux JSON :

- **Préférer** l’utilisation de `data-loader` (`loadSuBankData`, `loadSuData`, `loadSuAnswer`, `loadMeta*`, etc.) dans les datapacks,
  - plutôt que des appels `fetch('/api/data/...')` en dur ;
  - ou des `import` directs de `public/data`.

- Si un datapack a besoin d’un accès très spécifique (ex. serveur uniquement, gros volumes) :
  - documenter explicitement dans ce fichier :
    - les endpoints utilisés ;
    - le type d’exécution attendu (`client` / `server`).

- À terme, envisager une séparation claire :
  - **couche Data** (fonctions pures) : prend en entrée des tableaux typés (rows) et retourne `DatapackResponse<T>` ;
  - **couche IO** : responsable de `fetch`/`data-loader` et de la lecture des JSON.

### 7.4. Conventions de cache

Pour éviter des comportements imprévisibles :

- définir un comportement de cache explicite par datapack :
  - `noCache` – toujours recalculé (utile en dev ou pour des données très légères) ;
  - `memory` – cache en mémoire process avec TTL documenté (ex. `30 min`, `1 h`) ;
  - `delegated` – pas de cache dans le datapack, la responsabilité est déléguée au backend ou à un loader supérieur.

- exposer éventuellement dans `meta` :
  - `cacheStrategy`, `cacheExpiresAt` ;

- harmoniser progressivement les caches existants :
  - `DpAgeDistribution`, `DpCarbonSankey`, `DpBarrierAnalysisV2`, `DpUsages*`, `data-loader`.

### 7.5. Conventions d’erreurs et de warnings

- Ne pas masquer complètement les erreurs critiques :
  - en cas de données indispensables manquantes (ex. `MetaCarbon`, `Su Data`), soit :
    - retourner un `DatapackResponse` vide avec un `errors[]` explicite ;
    - soit lancer une exception claire (gestion par le composant appelant).

- Utiliser `warnings[]` pour :
  - les situations dégradées mais encore exploitables :
    - multi-SU non supporté → fallback Quartier ;
    - IDs de SU inconnus → ignorés ;
    - colonnes manquantes mais subsituables.

- Minimiser les `console.log`/`console.warn` en production au profit d’un reporting structuré via `warnings`/`errors`.

### 7.6. Documentation minimale par datapack

Chaque fichier de datapack devrait documenter en en-tête :

- **Nom** et **finalité** métier ;
- **Sources de données** :
  - fichiers JSON (`public/data/*`) et colonnes clés utilisées ;
  - services ou loaders (`data-loader`, `suIdMapping`, etc.) ;
- **Signature de l’API** :
  - forme de `DatapackRequest` supportée ;
  - type de `DatapackResponse<T>` (avec la définition de `T`) ;
- **Hypothèses importantes** :
  - sur le format des IDs SU ;
  - sur l’environnement d’exécution (`client`/`server`) ;
  - sur le comportement de cache.

Cette standardisation pourra se faire progressivement, datapack par datapack, en veillant à préserver la compatibilité de surface (`getXxxData`) tout en introduisant le contrat commun (`DatapackRequest` / `DatapackResponse`).