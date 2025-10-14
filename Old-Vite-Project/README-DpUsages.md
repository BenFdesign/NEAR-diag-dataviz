# 📊 DpUsages - Datapacks des Sphères d'Usages

Ce module regroupe tous les datapacks relatifs aux sphères d'usages du projet NEAR-diag-dataviz.

## 🏗️ Architecture

### Datapacks Individuels
Chaque usage possède son propre datapack dédié :

- **`DpUsagesMeatFrequency`** - Fréquence de consommation de viande
- **`DpUsagesTransportationMode`** - Mode de transport principal  
- **`DpUsagesDigitalIntensity`** - Intensité numérique (écrans/jour)
- **`DpUsagesPurchasingStrategy`** - Stratégie d'achat (neuf/occasion/mixte)
- **`DpUsagesAirTravelFrequency`** - Fréquence de voyage aérien  
- **`DpUsagesHeatSource`** - Source de chauffage

### Datapack Agrégateur
- **`DpUsages`** - Agrégateur intelligent qui unifie tous les usages

## 📋 Interfaces Principales

### SuUsagesData (Backward Compatible)
```typescript
interface SuUsagesData {
  meatFrequency: UsageData[]
  transportationMode: UsageData[]
  digitalIntensity: UsageData[]
  purchasingStrategy: UsageData[]
  airTravelFrequency: UsageData[]
  heatSource: UsageData[]
}
```

### UsageData
```typescript
interface UsageData {
  value: string      // Clé de la réponse (ex: "REGULAR")
  label: string      // Label court (ex: "Régulier")
  emoji: string      // Emoji associé (ex: "🥩")
  count: number      // Nombre absolu de réponses
  percentage: number // Pourcentage (ex: 45.2)
  color: string      // Couleur hex (ex: "#3b82f6")
}
```

## 🚀 Utilisation

### Import Principal
```typescript
import { fetchSuUsagesData, SU_USAGES_QUESTIONS } from '~/lib/datapacks/DpUsages'
```

### Récupération des Données

#### Données du Quartier (toutes SUs agrégées par somme simple)
```typescript
const quartierData = fetchSuUsagesData()
// Retourne toutes les sphères d'usage pour le quartier entier
```

#### Données d'une SU Spécifique
```typescript
const su1Data = fetchSuUsagesData([1])
// Retourne les données de la SU n°1
```

#### Données Multi-SUs (retourne automatiquement le quartier)
```typescript
const multiSuData = fetchSuUsagesData([1, 2, 3])
// Retourne les données du quartier (agrégées)
```

### Usage avec Questions Metadata
```typescript
import { SU_USAGES_QUESTIONS } from '~/lib/datapacks/DpUsages'

SU_USAGES_QUESTIONS.forEach(question => {
  console.log(question.title)      // "Consommation de viande"
  console.log(question.subtitle)   // "Repas avec viande / semaine"
  console.log(question.key)        // "meatFrequency"
})
```

## 🎯 Spécificités Techniques

### Agrégation Quartier
**Important** : Contrairement au projet précédent, ce projet utilise une **somme simple** au lieu d'une pondération par population pour les données quartier.

```typescript
// Somme simple de toutes les réponses de toutes les SU
totalCount = su1Count + su2Count + su3Count
// Au lieu de : 
// totalCount = (su1Count * su1Weight) + (su2Count * su2Weight) + ...
```

### Cache et Performance
- Chaque datapack individuel possède son propre système de cache
- Pré-calcul de toutes les données au premier appel
- Cache invalidation possible via les fonctions `clear*Cache()`

### Sources de Données
- **`Su Answer.json`** - Réponses des enquêtés
- **`MetaSuQuestions.json`** - Métadonnées des questions
- **`MetaSuChoices.json`** - Choix de réponses possibles
- **`Su Data.json`** - Informations sur les SUs

## 🧪 Tests et Validation

### Tests Individuels
```typescript
import { runMeatFrequencyTests } from '~/lib/datapacks/DpUsagesMeatFrequency'
runMeatFrequencyTests() // ✅ Tests passed
```

### Tests Globaux
```typescript
import { testSuUsages, runAllUsagesTests } from '~/lib/datapacks/DpUsages'

testSuUsages()      // Test l'agrégateur
runAllUsagesTests() // Test tous les datapacks individuels
```

## 🎨 Système de Couleurs

Chaque datapack utilise un système de couleurs cohérent :
```typescript
const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']
```

## 📊 Format de Retour Unifié

Chaque fonction `fetch*Data()` retourne :
```typescript
{
  data: UsageData[],           // Données formatées
  color: string,               // Couleur principale de la SU
  isQuartier: boolean,         // true si données quartier
  questionLabels: {            // Métadonnées de la question
    title: string,
    emoji: string,
    questionOrigin: string,
    questionShort: string
  },
  suId?: number               // ID de la SU (absent si quartier)
}
```

## 🔧 Maintenance

### Ajout d'un Nouvel Usage
1. Créer `DpUsages[NomUsage].ts` selon le template existant
2. Ajouter l'import dans `DpUsages.ts`
3. Mettre à jour `SU_USAGES_MAPPING`
4. Ajouter l'entrée dans `SU_USAGES_QUESTIONS`
5. Ajouter la propriété dans l'interface `SuUsagesData`

### Cache Management
```typescript
// Vider tous les caches
import { clearMeatFrequencyCache } from '~/lib/datapacks/DpUsagesMeatFrequency'
// ... autres imports
clearMeatFrequencyCache()
// ... autres clear
```

## ⚠️ Notes Importantes

1. **Pas de pondération** : Agrégation par somme simple pour le quartier
2. **TypeScript Strict** : Utilisation d'`any` temporaire pour les données JSON
3. **Backward Compatibility** : Interface `SuUsagesData` maintenue
4. **Performance** : Pré-calcul et cache pour optimiser les performances
5. **Extensibilité** : Architecture modulaire pour faciliter l'ajout de nouveaux usages