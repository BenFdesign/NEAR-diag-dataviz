# Dataviz NEAR-diag-dataviz

Ce document décrit le fonctionnement des composants de dataviz (`Dv*`), leurs liens avec les datapacks (`Dp*`), l’usage des couleurs, des IDs de SU et des contrats de données, ainsi que les principaux axes d’harmonisation.

---

## 1. Concept de "dataviz" (`Dv*`)

Une **dataviz** est un composant React client situé dans `src/app/_components/dataviz` qui :

- reçoit en entrée des props de contexte (au minimum `selectedSus?: number[]`),
- charge les données métier via un ou plusieurs datapacks (`src/lib/datapacks`),
- construit un modèle interne (souvent proche du contrat du datapack),
- dessine un graphique avec D3 (ou un autre renderer) dans un `<svg>` responsive.

Ces composants sont pensés comme une couche **de présentation** qui ne doit pas :

- recoder la logique métier déjà présente dans les datapacks ;
- accéder directement aux JSON de `public/data` ;
- introduire une sémantique métier différente de celle des datapacks (labels, agrégations, types de vue, etc.).

---

## 2. Flux global : de `Board` à `Dv*`

1. Un **board** (`src/app/_components/boards/*.tsx`) choisit quelles dataviz rendre (par ex. `FicheSuBoard` rend : `DvSuTitle`, `DvGenre`, `DvAgeDistribution`, `DvCsp`, `DvUsages`, `DvCarbonSankey`).
2. Tous ces composants reçoivent les mêmes props de contexte, notamment `selectedSus: number[]` (IDs **locaux UI** des SU, gérés par le dashboard et `LeftSidebar`).
3. Chaque `Dv*` :
   - mappe éventuellement les IDs locaux → IDs globaux via `suIdMapping` (pour couleurs et/ou filtrage par `Su ID` dans les datapacks) ;
   - appelle le ou les datapacks pertinents (ex : `getDpAgeDistributionData`, `fetchSuUsagesExtendedData`, `getDpVolonteToutData`, `getDpCarbonSankeyData`…) ;
   - récupère les palettes et couleurs via `DpColor` (`getSuColors`, `getPalette`) ;
   - met à jour son état local (`useState`) et dessine la dataviz dans un `useEffect`.

**Objectif d’harmonisation** : maintenir ce schéma partout, avec un contrat clair entre `Board` → `Dv*` → `Dp*`.

---

## 3. Contrats de données attendus côté Dv*

### 3.1. Contrat minimal recommandé pour les distributions catégorielles

Pour les distributions simples (pourcentages par modalité), le format cible est :

```ts
interface CategoryPoint {
  value: string
  label: string
  emoji: string
  count: number
  percentage: number
}

interface QuestionLabels {
  title: string
  emoji: string
  questionOrigin: string
  questionShort: string
}

interface CategoricalResult {
  data: CategoryPoint[]
  isQuartier: boolean
  questionLabels: QuestionLabels
  suId?: number // ID SU (local ou global) selon le datapack
}
```

Beaucoup de datapacks usages (`DpUsages*`) et d’autres modules (âge, CSP, genre) convergent déjà vers cette structure.

**Règle d’harmonisation :**
- privilégier ce contrat minimal côté datapack, puis le consommer tel quel dans les dataviz, sans re-mapper inutilement les champs.

### 3.2. Contrats étendus (multi‑questions)

Certains datapacks retournent plusieurs questions en une fois (ex. `DpUsages` via `fetchSuUsagesExtendedData`) :

```ts
interface SuUsageQuestion {
  questionKey: string
  questionLabels: QuestionLabels
  data: CategoryPoint[]
  totalResponses: number
  fetchFunction: string
  isQuartier: boolean
  suId?: number
}
```

**Recommandation :**
- côté Dv*, ne pas enrichir/ou modifier ce modèle : l’utiliser tel quel pour dessiner (boucles sur `questions`, titres à partir de `questionLabels`, etc.) ;
- en cas de besoin d’un format plus simple (ex. pour un seul graphique), faire l’adaptation dans un helper local **purement visuel**, pas dans la logique métier.

---

## 4. Gestion des IDs de SU

### 4.1. IDs locaux vs IDs globaux

- Le dashboard et `LeftSidebar` manipulent des **IDs locaux** (1..N) pour les SU.
- Certaines données métiers (réponses individuelles, Su Data) utilisent des **IDs globaux** (`"Su ID"` ou `Id` dans les JSON).

Le service `suIdMapping` (`src/lib/services/suIdMapping.ts`) fournit les helpers :

- `mapLocalToGlobalIds(localIds: number[]): Promise<number[]>`
- `mapGlobalToLocalIds(globalIds: number[]): Promise<number[]>`

### 4.2. Règles côté dataviz

- Les props `selectedSus` reçues par les `Dv*` sont **toujours** des IDs locaux.
- Si la dataviz a besoin de couleurs ou d’un filtrage sur `Su ID` global, elle doit :
  - appeler `mapLocalToGlobalIds` dans son `useEffect` (comme dans `DvAgeDistribution` ou `DvUsages`) ;
  - passer les IDs globaux au datapack ou à `DpColor`.

**Anti‑pattern à éviter :**
- mélanger IDs locaux et globaux dans un même composant sans les documenter,
- dupliquer la logique de mapping dans les composants (elle doit rester dans `suIdMapping`).

---

## 5. Harmonisation de l’usage des couleurs

Les couleurs de SU et les palettes de dataviz sont fournies par `DpColor` (`src/lib/datapacks/DpColor.ts`) :

- `getSuColors(globalSuId?: number)` → palette principale pour une SU (ou palette générique quartier) ;
- `getPalette(type: 'gradient' | 'categorical' | ..., globalSuId?: number)` → tableau de couleurs pour segments/barres.

### 5.1. Règles côté Dv*

- Toujours utiliser `getSuColors` pour :
  - le titre principal ;
  - les éléments dominants du graphe (trait principal, remplissage de surface principale, etc.).
- Utiliser `getPalette` pour :
  - les séries ou catégories multiples (barres empilées, segments, violons…).
- Si la dataviz doit surcharger certaines couleurs (cas de `DvVolonteTout` avec ses codes vert/ambre/rouge), documenter clairement la table de couleurs locale et la garder limitée.

### 5.2. Incohérences actuelles à corriger

- `DvUsages` : utilise bien `getPalette('gradient', globalSuId)` et `getSuColors`, mais applique un style très spécifique (violons).
- `DvAgeDistribution` : utilise `getPalette` et `getSuColors` mais avec d’autres conventions (line + area chart, teintes différentes).
- `DvVolonteTout` : s’appuie uniquement sur `getSuColors` pour un fallback, avec une table de couleurs métier interne.

**Axe d’harmonisation :**
- définir un guide d’utilisation des couleurs par type de graphe (line, aires, barres empilées, violons) et aligner progressivement les `Dv*` sur ces règles.

---

## 6. Standardisation des classes et IDs CSS

Les styles spécifiques au dashboard et aux dataviz sont centralisés principalement dans `src/styles/dataviz.css` (layout, conteneurs, labels) et `src/styles/globals.css` (polices, fond global). L’objectif est de limiter la variété de classes/IDs utilisés dans les `Dv*` pour pouvoir **re-thémer** largement l’interface à partir d’une bibliothèque restreinte.

### 6.1. Familles de classes existantes

- **Layout global dashboard**
   - `.dataviz-dashboard`, `.dashboard-grid` : structure globale pleine hauteur.
   - `.menu-filter`, `.board-selector`, `.sidebar-base`, `.sidebar-left`, `.sidebar-right`, `.sidebar-content`, `.sidebar-scrollable` : gabarits de sidebars (gauche/droite) et comportement collapsed/expanded.
   - `.board-container`, `.board-viewer`, `.board-content` : conteneur central des boards, fond blanc, ombres, padding.

- **Layout de board**
   - `.demographie-board`, `.mobility-board`, `.other-board` : squelettes de boards (grilles internes, header, zones principales).
   - `.board-grid`, `.board-header`, `.board-title`, `.board-subtitle` : grilles et titres de board.

- **Conteneurs de dataviz**
   - `.dv-container` : conteneur de base de chaque dataviz, gère fond, arrondis, ombres.
   - Modulateurs de zone (ex. `.dv-container.genre-dist`, `.dv-container.age-dist`, `.dv-container.usages-dist`, `.dv-container.sankey-dist`) : contrôlent la position dans la grid et exposent des variables `--dv-width` / `--dv-height` pour le sizing.

- **Typographie/labels dataviz**
   - `.dv-title` : titre principal dans les `<svg>` (taille/police/gras standardisés).
   - `.dv-x-axis-label` : style par défaut des labels d’axe X.
   - Classes de tooltips/états (`.dv-tooltip`, `.loading-container`, `.error-container`, etc.) pour les états de chargement/erreur.

### 6.2. Règles de nommage pour nouvelles dataviz

- **Préfixe commun**
   - Utiliser un préfixe `dv-` pour toute nouvelle classe spécifique à une dataviz (ex. `.dv-testimony-node`, `.dv-bar-segment`) afin de faciliter la recherche et le theming.

- **IDs HTML**
   - Éviter les `id` pour le styling pur CSS ; réserver les `id` à l’accessibilité ou à des hooks JS ciblés.
   - Préférer des classes `.dv-...` pour tout ce qui peut être re-stylé.

- **Réutilisation vs création de classes**
   - Réutiliser autant que possible :
      - `.dv-container` comme wrapper principal,
      - `.dv-title` pour les titres intégrés au SVG,
      - `.dv-x-axis-label` pour les labels d’axes,
      - les classes de layout de board existantes (`.board-grid`, `.board-header`, etc.).
   - Créer des classes supplémentaires uniquement lorsque le besoin est vraiment spécifique au type de graphique (ex. `.dv-violin-segment`, `.dv-sankey-link`).

### 6.3. Objectif de personnalisation

En respectant ce socle commun de classes :

- il devient possible de **changer la charte visuelle** (fonds, arrondis, typographies, espacements) en ne touchant qu’à `dataviz.css` et éventuellement `globals.css` ;
- les composants `Dv*` restent majoritairement indépendants du thème et se contentent de poser les bonnes classes sur les bons éléments.

---

## 7. Patterns D3 et responsivité

### 6.1. Conteneur et dimensions

Pattern commun (ex. `DvAgeDistribution`, `DvUsages`) :

- Un `div` conteneur avec `ref={svgContainer}` ;
- Un `<svg ref={svgRef}>` à l’intérieur ;
- Un effet `useEffect` pour mesurer le `clientWidth/clientHeight` du conteneur et les stocker dans un state local ;
- Un second effet `useEffect` qui :
  - écoute les changements de taille (event `resize`) ;
  - redessine le graphique quand `data` ou les dimensions changent.

**Recommandation :**
- conserver ce pattern pour **toutes** les nouvelles dataviz D3,
- centraliser si besoin un petit hook (`useResponsiveSvg`) pour éviter la duplication de code.

### 6.2. Dessin D3

- Toujours **vider** le contenu du `<svg>` avant de redessiner : `svg.selectAll('*').remove()`.
- Limiter les effets de bord au composant (pas de sélection D3 globale sur `body` sauf pour les tooltips ; si nécessaire, bien nettoyer ces nodes en `mouseout` / `unmount`).
- Encapsuler autant que possible les tooltips dans un conteneur local (cf. `DvVolonteTout` qui place sa tooltip dans un `div.dv-tooltip` sous le conteneur).

---

## 8. Incohérences actuelles entre dataviz

### 8.1. API de données utilisée

- Certaines dataviz consomment des **contrats Datapack complets** (ex. `getDpAgeDistributionData`, `getDpVolonteToutData`).
- D’autres consomment des **fonctions internes spécifiques** (ex. `fetchSuUsagesExtendedData` dans `DvUsages`) qui ne passent pas par le contrat `DatapackResponse` standard.

**Axe d’harmonisation :**
- privilégier des helpers de haut niveau `getDpXxxData()` qui renvoient tous un contrat homogène (`id`, `version`, `data`, `context`, `meta`, `warnings`, `errors`),
- et ne garder l’usage direct de fonctions internes (`fetchXxxData`) que pour les cas où c’est strictement nécessaire.

### 8.2. Existence (ou non) de dataviz dédiées

- Certains datapacks ont une dataviz dédiée (ex. âge, CSP, genre, Sankey carbone).
- D’autres, comme `DpUsagesHeatSource`, n’ont pas de `DvUsagesHeatSource.tsx` : la question "Source de chauffage" n’est visible que via `DvUsages` (agrégateur multi‑questions).

**Axe d’harmonisation :**
- pour les sujets jugés stratégiques (ex. énergie / chauffage), prévoir une dataviz dédiée sur le modèle des autres `Dv*`, réutilisant le datapack individuel (`DpUsagesHeatSource`).

### 8.3. Titres, labels et `questionLabels`

- Les `questionLabels` fournis par les datapacks (titre court, long, emoji, origine) ne sont pas exploités de manière uniforme :
  - certains composants utilisent des titres "hard‑codés" (ex. `DvUsages` : `"🔮 Habitudes de consommation"`) ;
  - d’autres utilisent `questionLabels.title`/`questionLabels.questionShort` ;
  - le placement et le style des emojis varient.

**Règles proposées :**
- titre principal du composant :
  - privilégier `questionLabels.emoji + ' ' + questionLabels.title` quand le datapack ne renvoie qu’une question ;
  - pour les composites (ex. `DvUsages`), titre global générique + sous‑titres par question basés sur `questionLabels`.

### 8.4. Stylisation CSS des Dv* (tooltips, labels, légendes)

Plusieurs incohérences existent dans la manière dont les composants Dv* appliquent les styles CSS :

- **Préfixes et noms de classes de tooltips non standardisés**
   - Certains composants créent des tooltips avec la classe générique `tooltip` directement dans `body` (ex. DvCsp, DvGenre, DvAgeDistribution, DvUsages).
   - D’autres utilisent une classe `dv-tooltip` ancrée dans le conteneur React (ex. DvCarbonSankey, DvVolonteTout).
   - Conséquence : difficile de styler toutes les tooltips via un seul ensemble de règles CSS.

- **Mélange entre styles globaux et styles inline**
   - Beaucoup d’éléments SVG/HTML sont stylés directement dans le code D3 (`.style('font-size', '11px')`, `.style('fill', '#333')`, etc.).
   - Les classes communes comme `.dv-title`, `.dv-x-axis-label`, ou des classes potentielles pour les labels et légendes ne sont pas toujours utilisées.
   - Pour re-thémer, il faut donc modifier à la fois le CSS central et de nombreux styles inline dans les Dv*.

- **Classes hétérogènes ou absentes sur les éléments internes**
   - Des classes génériques non préfixées sont utilisées (`container`, `slice`, `legend-item`, `csp-bar`, `nodes`, `node`, etc.), sans préfixe `dv-`.
   - D’autres parties (par exemple dans DvSuTitle) reposent presque uniquement sur des styles inline, sans classes dédiées.
   - Cela limite la possibilité d’écrire des règles CSS transverses par type d’élément (labels, légendes, segments, nœuds…).

- **Patrons de tooltip et de positionnement non unifiés**
   - Certains composants positionnent les tooltips en coordonnées globales (`event.pageX/Y`), d’autres recalculent la position relative au `containerRef`.
   - Les durées de transition, paddings, border-radius et opacités varient car définies à la main dans chaque composant.

- **Usage non systématique des classes communes**
   - Les titres internes aux SVG n’emploient pas tous la classe `.dv-title` alors qu’elle existe dans `dataviz.css`.
   - Les légendes HTML internes (`foreignObject`, `xhtml:div`) n’utilisent pas une classe unifiée (par exemple `.dv-legend`), mais des styles inline (`display: flex`, `gap`, etc.).

**Axes d’harmonisation CSS :**

- Normaliser les classes de tooltips (`.dv-tooltip`), labels (`.dv-label` ou dérivés) et légendes (`.dv-legend`, `.dv-legend-item`).
- Réduire progressivement les styles inline dans les Dv* au profit de classes CSS déclarées dans `dataviz.css`.
- Introduire un préfixe `dv-` pour toutes les nouvelles classes internes aux dataviz afin de simplifier le theming global.

---

## 9. Checklist pour toute nouvelle dataviz

1. **Entrée**
   - [ ] Prop `selectedSus?: number[]` acceptée (IDs locaux UI).
   - [ ] Conversion éventuelle en IDs globaux via `suIdMapping` si nécessaire.

2. **Données**
   - [ ] Les données sont chargées via un datapack, pas directement depuis `/api/data` ni `public/data`.
   - [ ] Le contrat de données respecte ou étend le modèle `CategoricalResult` / `QuestionLabels`.

3. **Couleurs**
   - [ ] `getSuColors(globalSuId?)` appelé pour la couleur principale du graphe.
   - [ ] `getPalette(type, globalSuId?)` utilisé pour les séries/catégories.

4. **D3 & responsivité**
   - [ ] Mesure du conteneur via un `ref` + écoute de l’événement `resize`.
   - [ ] Nettoyage du `<svg>` avant redessin.
   - [ ] Tooltips encapsulées et nettoyées correctement.

5. **Accessibilité & lisibilité**
   - [ ] Labels de catégories lisibles (taille de police suffisante, contrastes corrects).
   - [ ] Pourcentages arrondis de manière cohérente (aligné sur le datapack).

---

## 10. Prochaines étapes d’harmonisation

1. **Standardiser l’accès aux datapacks** côté dataviz :
   - Introduire des helpers `getDpXxxData()` homogènes pour les principaux modules (usages, barrières, témoignages…).

2. **Créer des dataviz dédiées** pour certains datapacks individuels :
   - `DvUsagesHeatSource` basé sur `DpUsagesHeatSource`.

3. **Aligner l’usage des couleurs** :
   - Documenter un mini "design system" dataviz (guidelines pour l’utilisation de `DpColor`).

4. **Factoriser le code responsive D3** :
   - Créer un hook `useResponsiveSvg` et l’utiliser dans les nouveaux `Dv*`.

5. **Documenter les contrats de données**
   - Étendre ce document avec une section par grand type de contrat (distributions, séries temporelles, graphes, réseaux) au fur et à mesure que de nouvelles dataviz sont ajoutées.
