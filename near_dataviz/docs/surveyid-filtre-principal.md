# Filtre principal SurveyID – Où et comment il est utilisé

Ce document décrit précisément où et comment le filtre principal **SurveyID** est appliqué dans NEAR-diag-dataviz, dans son état refactoré.

L’idée clé : **SurveyID identifie un diagnostic de quartier**. Dans l’état actuel du projet, tout est filtré sur un unique diagnostic choisi via une constante de configuration centrale (`CURRENT_SURVEY_ID`, aujourd’hui = 1, Porte d’Orléans).

---

## 1. Définition et rôle métier de SurveyID

- Un **Survey** correspond à un diagnostic daté d’un quartier (ex : "Porte d’Orléans 2024").
- Côté données :
  - `Surveys.json` contient au moins `ID` (SurveyID) et `Name` (nom du quartier/diagnostic).
  - `Quartiers.json` contient des indicateurs INSEE agrégés par diagnostic, avec une colonne `"Survey ID"`.
  - D’autres fichiers exportés peuvent contenir une clé `SurveyId` (par ex. `Carbon Footprint Answer.json`).
- Côté code, **un seul SurveyID est pris en compte** : `1`, ce qui signifie que l’application est actuellement monodiagnostic.

---

## 2. Pivot central : `CURRENT_SURVEY_ID` et loaders filtrés

Fichiers clés :
- [src/lib/survey-config.ts](src/lib/survey-config.ts)
- [src/lib/data-loader.ts](src/lib/data-loader.ts)
- [src/lib/su-service.ts](src/lib/su-service.ts)

### 2.1. Configuration centrale

- Le diagnostic courant est fixé dans [src/lib/survey-config.ts](src/lib/survey-config.ts) :
  - `export const CURRENT_SURVEY_ID = 1;` (Porte d’Orléans).
- Cette constante sert de **filtre global explicite** pour l’ensemble des services/datapacks qui travaillent au niveau "quartier/diagnostic".

### 2.2. Loaders filtrés par SurveyID

Dans [src/lib/data-loader.ts](src/lib/data-loader.ts) :

1. `loadSuDataForCurrentSurvey()`
  - S’appuie sur `loadSuData()` (qui lit `Su Data.json`).
  - Filtre sur `entry["Survey ID"] === CURRENT_SURVEY_ID`.
  - Renvoie uniquement les lignes `Su Data` du diagnostic courant.

2. `loadQuartiersForCurrentSurvey()`
  - S’appuie sur `loadQuartiers()` (qui lit `Quartiers.json`).
  - Filtre sur `quartier["Survey ID"] === CURRENT_SURVEY_ID`.
  - Renvoie uniquement les indicateurs INSEE du diagnostic courant.

Ces deux loaders sont le **pivot technique principal** : tout ce qui travaille sur `Su Data` ou `Quartiers` au niveau quartier/diagnostic passe désormais par eux.

### 2.3. Usage dans su-service

Dans [src/lib/su-service.ts](src/lib/su-service.ts) :

1. `getQuartierName()`
  - Lit `Surveys.json` via `loadSurveys()`.
  - Filtre sur `survey.ID === CURRENT_SURVEY_ID`.
  - Renvoie le `Name` du Survey trouvé, ou "Quartier" par défaut.

2. `getQuartierPopulation()`
  - Utilise `loadQuartiersForCurrentSurvey()`.
  - Prend la première entrée retournée et lit `"Population Sum"`.
  - Renvoie la population totale arrondie du diagnostic courant.

3. `getSuInfo()`
  - Charge `SuBank`, `Su Data` via `loadSuDataForCurrentSurvey()` et la population totale de quartier.
  - Construit la liste des SU **uniquement pour le Survey courant**.

En résumé :
- `CURRENT_SURVEY_ID` est le **point unique de configuration** du diagnostic courant.
- Les loaders `loadSuDataForCurrentSurvey()` et `loadQuartiersForCurrentSurvey()` assurent que toutes les données SU/quartier sont déjà filtrées en amont.

---

## 3. Types et loaders qui exposent SurveyID

Plusieurs types et helpers exposent explicitement le champ `Survey ID` ou s’appuient sur `CURRENT_SURVEY_ID`.

### 3.1. Types

Fichier : [src/lib/types.ts](src/lib/types.ts).

- Déclaration des structures incluant `"Survey ID"`, par exemple :
  - `SuData` (ou équivalent) contient `"Survey ID": number`.
  - Les types de cache/global state peuvent inclure `quartiers?: Array<{ "Population Sum"?: number, "Survey ID"?: number }>`.
- **Rôle** :
  - rendre explicite dans les types que certaines données sont indexées par `Survey ID` ;
  - permettre aux services/datapacks de filtrer proprement par diagnostic.

### 3.2. Loader `loadQuartiers`

Fichier : [src/lib/data-loader.ts](src/lib/data-loader.ts).

- `loadQuartiers()` retourne `Array<{ "Population Sum"?: number, "Survey ID"?: number }>`.
- `loadQuartiersForCurrentSurvey()` filtre ensuite sur `"Survey ID" === CURRENT_SURVEY_ID`.

---

## 4. Présence de SurveyID dans les données brutes

Certaines sources JSON issues de Metabase contiennent directement un champ de type SurveyID.

### 4.1. `Quartiers.json`

- Contient `"Survey ID"` pour chaque ligne d’agrégation quartier.
- Utilisé indirectement via `getQuartierPopulation()`.

### 4.2. `Su Data.json`

- Contient à la fois :
  - `ID` (identifiant global de SU, utilisé pour les mappings);
  - `Su` (identifiant local UI) ;
  - `"Survey ID"` (diagnostic auquel cette SU appartient).
- Utilisé dans `getSuInfo()` pour ne garder que les SU du `surveyId` courant.

### 4.3. `Carbon Footprint Answer.json`

- Contient un champ `"SurveyId"` (sans espace).
- La logique principale du Sankey carbone (`DpCarbonSankey`) :
  - filtre toujours par `"Su ID"` pour sélectionner les réponses de la SU considérée ;
  - **et**, lorsqu’un champ `SurveyId` est présent, filtre aussi sur `SurveyId === CURRENT_SURVEY_ID`.
- **Impact** : si plusieurs diagnostics coexistent dans cet export, seules les réponses du Survey courant sont prises en compte.

---

## 5. Autres références à SurveyID

### 5.1. suIdMapping

Fichier : [src/lib/services/suIdMapping.ts](src/lib/services/suIdMapping.ts).

- Les commentaires mentionnent :
  - "Survey ID : Pour identifier les quartiers".
- Les types internes prévoient un champ optionnel `surveyId?: number`.
- **Aujourd’hui** : ce service s’occupe surtout du mapping local/global de SU ; l’usage de `surveyId` y est envisagé mais pas encore central.

### 5.2. Datapacks

Plusieurs datapacks définissent des interfaces internes avec `"Survey ID"` ou se basent sur les loaders filtrés pour travailler au bon niveau de diagnostic :

- `DpAgeDistribution`, `DpCsp`, `DpGenre` :
  - pour les vues quartier, utilisent `loadQuartiersForCurrentSurvey()` ;
  - s’appuient ainsi implicitemment sur `CURRENT_SURVEY_ID`.
- `DpSuTitle` :
  - utilise `loadSuDataForCurrentSurvey()` et `loadQuartiersForCurrentSurvey()` pour déterminer le titre, la couleur et la population du SU/quartier ;
  - repose donc entièrement sur le filtre central.
- `DpCarbonSankey` :
  - utilise `loadSuDataForCurrentSurvey()` pour les pondérations SU ;
  - filtre `Carbon Footprint Answer.json` sur `SurveyId === CURRENT_SURVEY_ID` lorsqu’un champ `SurveyId` est présent.
- `DpBarrierAnalysisV2`, `DpEmdvSatisfactionsByCategory`, `DpVolonteTout`, `DpUsages*` :
  - préchargent leurs données SU via `loadSuDataForCurrentSurvey()` ;
  - garantissent ainsi que toutes les analyses sont effectuées sur le diagnostic courant.

Dans l’état actuel :

- **le filtrage systématique par SurveyID se fait via `CURRENT_SURVEY_ID` et les loaders filtrés** ;
- les datapacks n’ont plus besoin de gérer eux-mêmes un `surveyId` en dur : ils consomment des données déjà restreintes au bon diagnostic.

---

## 6. Synthèse : comment raisonner sur SurveyID pour la suite

1. **Point unique de configuration** :
  - `CURRENT_SURVEY_ID` dans [src/lib/survey-config.ts](src/lib/survey-config.ts) est aujourd’hui la seule vraie configuration globale du diagnostic courant.

2. **Propagation du filtre** :
  - via `loadSuDataForCurrentSurvey()` et `loadQuartiersForCurrentSurvey()` → toutes les données SU/quartier sont déjà restreintes à ce SurveyID ;
  - via `getSuInfo()`, `getQuartierName()`, `getQuartierPopulation()` → le service SU ne voit que le diagnostic courant ;
  - via les datapacks listés ci-dessus → tous les calculs et visualisations quartier/diagnostic se basent sur ces données filtrées.

3. **Pour un futur multi-quartiers / multi-diagnostics** :
  - il faudra **remplacer ou surcharger la constante `CURRENT_SURVEY_ID`** par :
    - un paramètre explicite (par exemple `getSuInfo(surveyId: number)` ou `loadSuDataForSurvey(surveyId: number)`),
    - ou un contexte global (React context / server context) alimenté par la plateforme (utilisateur connecté, route courante, configuration de l’hôte, etc.).
  - la plupart des datapacks sont déjà prêts, car ils consomment simplement les loaders filtrés ; ils n’auront besoin que d’une version paramétrable de ces loaders.

En pratique, pour retrouver rapidement le filtre principal dans le code :

- ouvrir [src/lib/survey-config.ts](src/lib/survey-config.ts) pour voir `CURRENT_SURVEY_ID` ;
- ouvrir [src/lib/data-loader.ts](src/lib/data-loader.ts) pour voir `loadSuDataForCurrentSurvey()` et `loadQuartiersForCurrentSurvey()` ;
- ouvrir [src/lib/su-service.ts](src/lib/su-service.ts) pour voir comment ces loaders filtrés sont utilisés dans `getSuInfo`, `getQuartierName`, `getQuartierPopulation`.
