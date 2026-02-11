# Refactoring des Datapacks - Standardisation de l'accès aux données

**Date** : 11 février 2026  
**Objectif** : Harmoniser les datapacks pour utiliser exclusivement `data-loader` pour l'accès aux données JSON.

---

## Problématique initiale

Les datapacks utilisaient trois modes d'accès différents aux données :

1. ✅ Via `data-loader` + API `/api/data` (recommandé)
2. ❌ Via `fetch('/api/data/...')` direct dans le datapack
3. ⚠️ Via `import` direct depuis `public/data` (cas spécifique)

Cette hétérogénéité créait :
- des comportements de cache divergents
- des difficultés de test
- une dépendance forte aux URLs codées en dur

---

## Fichiers refactorés

### 1. `DpAgeDistribution.ts`

**Avant** :
```typescript
const loadSuAnswerData = async (): Promise<SuAnswer[]> => {
  const response = await fetch('/api/data/Su%20Answer')
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const data = await response.json() as SuAnswer[]
  return data
}
```

**Après** :
```typescript
import { loadSuAnswer, loadQuartiers, loadMetaSuQuestions, loadMetaSuChoices } from '~/lib/data-loader'

const loadSuAnswerData = async (): Promise<SuAnswer[]> => {
  const data = await loadSuAnswer() as SuAnswer[]
  return data
}
```

**Changements** :
- 4 fonctions de chargement refactorisées : `loadSuAnswerData`, `loadQuartierData`, `loadMetaQuestions`, `loadMetaChoices`
- Ajout du commentaire "Mode d'accès aux données : data-loader (standardisé)" dans l'en-tête
- Suppression de tous les appels `fetch` directs

---

### 2. `DpCarbonSankey.ts`

**Avant** :
```typescript
async function loadCarbonAnswers(): Promise<CarbonAnswer[]> {
  const res = await fetch('/api/data/Carbon%20Footprint%20Answer')
  const json = (await res.json()) as unknown[]
  return json.filter(isCarbonAnswer)
}
```

**Après** :
```typescript
import { loadCarbonFootprintData, loadMetaCarbon as loadMetaCarbonData, loadSuData as loadSuDataFromLoader } from '~/lib/data-loader'

async function loadCarbonAnswers(): Promise<CarbonAnswer[]> {
  const json = await loadCarbonFootprintData()
  return json.filter(isCarbonAnswer)
}
```

**Changements** :
- 3 fonctions de chargement refactorisées : `loadCarbonAnswers`, `loadMetaCarbon`, `loadSuData`
- Utilisation d'alias pour éviter les conflits de noms (`loadMetaCarbonData`, `loadSuDataFromLoader`)
- Ajout du commentaire "Mode d'accès aux données : data-loader (standardisé)" dans l'en-tête
- Suppression de tous les appels `fetch` directs

---

### 3. `suIdMapping.ts`

**Avant** :
```typescript
const loadSuIdMapping = async (): Promise<SuIdMapping[]> => {
  const response = await fetch('/api/data/Su%20Bank')
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const suBankData = await response.json() as SuBankItem[]
  // ...
}
```

**Après** :
```typescript
import { loadSuBankData } from '~/lib/data-loader'

const loadSuIdMapping = async (): Promise<SuIdMapping[]> => {
  const suBankData = await loadSuBankData() as SuBankItem[]
  // ...
}
```

**Changements** :
- Fonction `loadSuIdMapping` refactorisée pour utiliser `loadSuBankData()`
- Ajout du commentaire "Mode d'accès aux données : data-loader (standardisé)" dans l'en-tête
- Suppression de l'appel `fetch` direct

---

## Documentation mise à jour

Le fichier `docs/datapacks.md` a été mis à jour :

- Section **5.1** : ajout d'un état "RÉSOLU ✅" indiquant la standardisation effectuée
- Documentation des bénéfices : cache unifié, tests simplifiés, maintenance facilitée
- État actuel : tous les datapacks principaux utilisent maintenant `data-loader`

---

## Bénéfices

### Uniformité
- Tous les datapacks principaux utilisent maintenant le même pattern d'accès aux données
- Code plus cohérent et prévisible

### Cache
- Comportement de cache unifié via `data-loader`
- Un seul point de contrôle pour la gestion du cache (via `clearDataCache()`)

### Tests
- Plus facile à tester : un seul point d'entrée à mocker (`data-loader`)
- Possibilité de tester les datapacks sans serveur HTTP

### Maintenance
- Réduction des dépendances aux URLs `/api/data/*` dispersées dans le code
- Si l'API change, un seul fichier à modifier (`data-loader.ts`)

---

## Cas restants

### DpUsages et sous-datapacks

Les `DpUsages*` (MeatFrequency, TransportationMode, etc.) utilisent toujours des `import` directs depuis `public/data` :

```typescript
import suAnswerData from '~/../../public/data/Su Answer.json'
```

**Raison** : ces datapacks font des pré-calculs au build avec des imports statiques. C'est un pattern spécifique mais documenté qui apporte des avantages de performance (données déjà chargées en mémoire).

**Action future** : à évaluer si nécessaire de migrer vers `data-loader` ou garder ce pattern optimisé.

---

## Vérifications

✅ Aucune erreur TypeScript après refactoring  
✅ Les signatures des fonctions publiques restent inchangées (compatibilité backward)  
✅ Les types de retour sont préservés  
✅ Les comportements métier sont identiques  

---

## Prochaines étapes recommandées

1. **Tests** : ajouter des tests unitaires pour les datapacks refactorés
2. **DpColor** : vérifier et refactoriser si nécessaire (utilise probablement `loadSuBankData` déjà)
3. **DpUsages** : évaluer l'opportunité de migrer vers `data-loader` ou documenter le pattern actuel
4. **Performance** : mesurer l'impact du cache centralisé sur les performances
5. **Documentation des nouveaux datapacks** : s'assurer que tous les futurs datapacks suivent ce pattern

---

## Commit message suggéré

```
refactor(datapacks): standardize data access with data-loader

- Replace direct fetch calls with data-loader in DpAgeDistribution
- Replace direct fetch calls with data-loader in DpCarbonSankey  
- Replace direct fetch calls with data-loader in suIdMapping
- Update documentation to reflect standardization
- Benefits: unified cache, easier testing, simplified maintenance

Resolves issue #5.1 from datapacks.md documentation
```
