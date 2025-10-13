# Template Datapack - Distribution des âges

## Vue d'ensemble

Ce template datapack (`DpAgeDistributionTemplate.ts`) est un exemple complet qui montre comment créer un datapack qui :

1. **Utilise les données réelles** des fichiers JSON publics
2. **Extrait les métadonnées** depuis les fichiers de configuration
3. **Calcule des distributions** pour les SUs individuelles et le quartier
4. **Implémente un cache côté client** pour optimiser les performances
5. **Calcule une moyenne pondérée** pour le quartier

## Structure des données

### Fichiers sources utilisés

- **`Su Answer.json`** : Réponses individuelles avec "Age Category" et "Su ID"
- **`Quartiers.json`** : Données agrégées INSEE (P21_Pop1529_Sum, P21_Pop3044_Sum, etc.)
- **`MetaSuQuestions.json`** : Métadonnées des questions (titres, emojis, descriptions)
- **`MetaSuChoices.json`** : Métadonnées des choix (labels, codes de correspondance)

### Interface de sortie

```typescript
interface AgeDistributionResult {
  data: {
    value: string          // Clé du choix (ex: "FROM_15_TO_29")
    label: string         // Label affiché (ex: "15-29 ans")
    emoji: string         // Emoji associé
    count: number         // Nombre absolu de réponses
    percentage: number    // Pourcentage
    color: string         // Couleur pour la visualisation
    midpoint: number      // Point médian de la tranche
  }[]
  isQuartier: boolean     // True si vue quartier
  questionLabels: {       // Métadonnées de la question
    title: string
    emoji: string
    questionOrigin: string
    questionShort: string
  }
  suId?: number          // ID de la SU si vue spécifique
  totalResponses: number // Nombre total de réponses
  dataSource: 'real' | 'fallback' // Source des données
}
```

## Logique de fonctionnement

### 1. Vue Quartier (données INSEE directes)

Lorsque aucune SU spécifique n'est sélectionnée, ou plusieurs SUs sont sélectionnées :

```typescript
// Utilise directement les données INSEE agrégées (déjà des totaux quartier)
const totalPop = 
  quartier["P21 Pop1529 Sum"] +  // 15-29 ans (total quartier)
  quartier["P21 Pop3044 Sum"] +  // 30-44 ans (total quartier)
  quartier["P21 Pop4559 Sum"] +  // 45-59 ans (total quartier)
  quartier["P21 Pop6074 Sum"] +  // 60-74 ans (total quartier)
  quartier["P21 Pop75p Sum"]     // 75+ ans (total quartier)

// Calcule les pourcentages directement
percentage = (count / totalPop) * 100
```

### 2. Vue SU spécifique

Lorsqu'une seule SU est sélectionnée :

```typescript
// Filtre les réponses individuelles pour cette SU
const suAnswers = allAnswers.filter(answer => answer["Su ID"] === suId)

// Compte les réponses par tranche d'âge
const ageCounts: Record<string, number> = {}
suAnswers.forEach(answer => {
  const ageCategory = answer["Age Category"]
  ageCounts[ageCategory] = (ageCounts[ageCategory] ?? 0) + 1
})
```

### 3. Extraction des métadonnées

```typescript
// Question metadata
const ageQuestion = metaQuestions.find(q => 
  q["Metabase Question Key"] === "Age Category"
)

// Choices metadata  
const ageChoices = metaChoices.filter(c => 
  c["Metabase Question Key"] === "Age Category"
)
```

### 4. Système de cache

```typescript
const cacheKey = JSON.stringify(selectedSus ?? [])
const CACHE_DURATION = 3600000 // 1 heure

if (dataCache.has(cacheKey) && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
  return dataCache.get(cacheKey)!
}
```

## Utilisation

### Fonction principale

```typescript
import { getDpAgeDistributionTemplateData } from '~/lib/datapacks/DpAgeDistributionTemplate'

// Vue quartier (toutes les SUs)
const quartierData = await getDpAgeDistributionTemplateData()

// Vue SU spécifique
const suData = await getDpAgeDistributionTemplateData([477])

// Plusieurs SUs (retourne vue quartier)
const multiSuData = await getDpAgeDistributionTemplateData([477, 478, 479])
```

### Fonctions utilitaires

```typescript
// Tests automatisés
await testDpAgeDistributionTemplate()

// Statistiques des données
const stats = await getAgeDistributionStats()

// Vider le cache
clearAgeDistributionTemplateCache()
```

## Test en direct

Pour tester le template datapack, visitez : `/test-template`

Cette page charge les données réelles et affiche :
- Distribution quartier (données INSEE)
- Distribution SU 477 (réponses individuelles)
- Statistiques des données sources
- Tests automatisés dans la console

## Adaptation pour d'autres questions

Ce template peut être adapté pour d'autres questions en modifiant :

1. **La clé de question** : `"Age Category"` → `"Gender"`, `"Transportation Mode"`, etc.
2. **Les données quartier** : Remplacer les champs `P21_Pop*` par les champs appropriés
3. **Les points médians** : Adapter selon le type de données (âge, revenu, etc.)
4. **Les couleurs par défaut** : Personnaliser selon la thématique

## 🎯 **Types de Données Disponibles**

### 📊 **Données Disponibles Directement par Quartier (INSEE)**

Ces données sont **déjà agrégées** dans `Quartiers.json` et peuvent être utilisées directement :

- **👥 Genre** : `Population Femme Sum`, `Population Homme Sum`
  - Clés Metabase : `WOMAN`, `MAN`
- **📅 Âge** : `P21 Pop1529 Sum`, `P21 Pop3044 Sum`, `P21 Pop4559 Sum`, `P21 Pop6074 Sum`, `P21 Pop75p Sum`
- **💼 Catégorie Professionnelle** : `C21 Pop15p Cs1 Sum` à `C21 Pop15p Cs8 Sum`
  - CS1 : Agriculteurs exploitants (`CS1`)
  - CS2 : Commerçants, artisans et chefs d'entreprise (`CS2`) 
    - ⚠️ **Note**: Dans Su Answer, détail supplémentaire avec `CS2_platform_entrepreneurship` (Auto-entrepreneurs de plateformes)
  - CS3 : Cadres et professions intellectuelles supérieures (`CS3`)
  - CS4 : Professions intermédiaires (`CS4`)
  - CS5 : Employés (`CS5`)
  - CS6 : Ouvriers (`CS6`)
  - CS7 : Retraités (`CS7`)
  - CS8 : Autre sans emploi (`CS8_unemployed`)
    - ⚠️ **Note**: Dans Su Answer, détail supplémentaire avec `CS8_student` (Étudiants) et `CS8_home` (Au foyer)

### 🧮 **Données Nécessitant Moyenne Pondérée**

Ces données ne sont **pas disponibles** dans `Quartiers.json` et doivent être calculées à partir des réponses individuelles :

- **🚌 Transport** : Mode de transport principal
- **😊 Satisfaction EMDV** : Niveaux de satisfaction
- **📋 Questions spécifiques** : Habitudes, préférences, opinions personnelles

### ⚠️ Important : Pondération par population des SUs

**Pour les données non-INSEE**, il faut les reconstituer avec une **moyenne pondérée** :

```typescript
/**
 * FONCTION COMPLÈTE : Moyenne pondérée pour d'autres datapacks
 * 
 * À utiliser pour Genre, Transport, Profession, etc. quand il n'y a pas
 * de données quartier directes dans Quartiers.json
 */
const calculateWeightedQuartierDistribution = async (questionKey: string): Promise<Record<string, number>> => {
  console.log(`🔢 Calcul moyenne pondérée pour ${questionKey}`)
  
  const [suAnswers, suData] = await Promise.all([
    loadSuAnswerData(),
    fetch('/api/data/Su%20Data').then(r => r.json()) as Promise<Array<{ ID: number, "Pop Percentage": string }>>
  ])

  const quartierDistribution: Record<string, number> = {}
  let totalWeight = 0

  // Pour chaque SU, calculer sa distribution et l'appliquer avec sa pondération
  for (const su of suData) {
    const weight = parseFloat(su["Pop Percentage"]) / 100  // "12.25" → 0.1225
    totalWeight += weight
    
    // Filtrer les réponses pour cette SU
    const suResponses = suAnswers.filter(answer => answer["Su ID"] === su.ID)
    
    if (suResponses.length === 0) continue
    
    // Compter les réponses par catégorie pour cette SU
    const suCounts: Record<string, number> = {}
    suResponses.forEach(answer => {
      const value = answer[questionKey] as string
      if (value) {
        suCounts[value] = (suCounts[value] ?? 0) + 1
      }
    })
    
    // Convertir en pourcentages et appliquer la pondération
    const suTotal = Object.values(suCounts).reduce((sum, count) => sum + count, 0)
    
    for (const [category, count] of Object.entries(suCounts)) {
      const suPercentage = (count / suTotal) * 100
      const weightedContribution = suPercentage * weight
      
      quartierDistribution[category] = (quartierDistribution[category] ?? 0) + weightedContribution
    }
  }

  console.log(`✅ Moyenne pondérée calculée (poids total: ${totalWeight.toFixed(3)})`)
  return quartierDistribution
}

// Exemple d'utilisation :
// const genderDistribution = await calculateWeightedQuartierDistribution("Gender")
// const transportDistribution = await calculateWeightedQuartierDistribution("Transportation Mode")
```

**Poids de population disponibles dans `Su Data.json`** :
- SU 1 : 12.25% du quartier
- SU 2 : 79.5% du quartier  
- SU 3 : 8.25% du quartier

## Architecture recommandée

```
src/lib/datapacks/
├── DpTemplate.ts              # Template générique
├── DpAgeDistribution.ts       # Spécialisé âge
├── DpGenderDistribution.ts    # Spécialisé genre
├── DpTransportation.ts        # Spécialisé transport
└── README.md                  # Documentation
```

Chaque datapack spécialisé peut hériter du template et adapter la logique métier spécifique.