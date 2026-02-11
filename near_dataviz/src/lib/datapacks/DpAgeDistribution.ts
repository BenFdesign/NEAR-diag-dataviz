/**
 * DATAPACK - Distribution des âges
 * 
 * Ce datapack charge les données réelles de distribution d'âge depuis :
 * - Su Answer.json : Réponses individuelles pour les SUs spécifiques
 * - Quartiers.json : Données agrégées INSEE pour la vue quartier
 * - MetaSuQuestions.json et MetaSuChoices.json : Métadonnées
 * 
 * Mode d'accès aux données : data-loader (standardisé)
 */


import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'
import { 
  loadSuAnswer,
  loadQuartiers,
  loadMetaSuQuestions,
  loadMetaSuChoices
} from '~/lib/data-loader'
import type { DatapackRequest, DatapackResponse, DatapackView } from './contracts'

// =====================================
// INTERFACES ET TYPES
// =====================================

// Interface pour les réponses individuelles (Su Answer.json)
interface SuAnswer {
  ID: number
  "Su ID": number
  "Age Category": string
  Gender?: string
  [key: string]: unknown
}

// Interface pour les données de quartier (Quartiers.json)
interface QuartierData {
  "Survey ID": number
  "Population Sum": number
  "P21 Pop1529 Sum": number    // 15-29 ans
  "P21 Pop3044 Sum": number    // 30-44 ans
  "P21 Pop4559 Sum": number    // 45-59 ans
  "P21 Pop6074 Sum": number    // 60-74 ans
  "P21 Pop75p Sum": number     // 75+ ans
  [key: string]: unknown
}

// Interface pour les métadonnées des questions
interface MetaQuestion {
  Id: number
  "Question Origin": string
  "Question Short": string
  "Emoji": string
  "Metabase Question Key": string
}

// Interface pour les métadonnées des choix
interface MetaChoice {
  Id: number
  "Label Origin": string
  "Label Long": string
  "Label Short": string
  "Emoji": string
  "Metabase Question Key": string
  "Metabase Choice Key": string
}

// Export interface (backward compatibility)
export interface AgeDistributionResult {
  data: {
    value: string         // Clé du choix (ex: "FROM_15_TO_29")
    label: string         // Label affiché (ex: "15-29 ans")
    emoji: string         // Emoji associé
    count: number         // Nombre absolu de réponses
    percentage: number    // Pourcentage
    midpoint: number      // Point médian de la tranche (pour calculs)
  }[]
  isQuartier: boolean     // True si vue quartier, false si SU spécifique
  questionLabels: {
    title: string
    emoji: string
    questionOrigin: string
    questionShort: string
  }
  suId?: number          // ID de la SU si vue spécifique
  totalResponses: number // Nombre total de réponses
  dataSource: string     // Source des données
}

// ===========================
// CONSTANTES ET CONFIGURATION
// ===========================

const DATAPACK_NAME = 'DpAgeDistribution'

// Cache côté client pour éviter les recalculs
const dataCache = new Map<string, AgeDistributionResult>()
let cacheTimestamp = 0
const CACHE_DURATION = 3600000 // 1 heure en millisecondes

// Mappage des tranches d'âge INSEE vers nos codes
const INSEE_AGE_MAPPING = {
  'P21 Pop1529 Sum': 'FROM_15_TO_29',
  'P21 Pop3044 Sum': 'FROM_30_TO_44', 
  'P21 Pop4559 Sum': 'FROM_45_TO_59',
  'P21 Pop6074 Sum': 'FROM_60_TO_74',
  'P21 Pop75p Sum': 'ABOVE_75'
}

// Points médians pour les calculs (ex: moyenne d'âge)
const AGE_MIDPOINTS: Record<string, number> = {
  FROM_15_TO_29: 22,
  FROM_30_TO_44: 37,
  FROM_45_TO_59: 52,
  FROM_60_TO_74: 67,
  ABOVE_75: 82
}

// Les couleurs sont gérées par DpColor dans les composants Dv

// =====================================
// FONCTIONS DE CHARGEMENT DES DONNÉES
// =====================================

/**
 * Charge les réponses individuelles depuis Su Answer.json (via data-loader)
*/
const loadSuAnswerData = async (): Promise<SuAnswer[]> => {
  try {
    const data = await loadSuAnswer() as SuAnswer[]
    console.log(`📊 Chargé ${data.length} réponses individuelles`)
    return data
  } catch (error) {
    console.error('Erreur lors du chargement de Su Answer:', error)
    return []
  }
}

/**
 * Charge les données de quartier depuis Quartiers.json (via data-loader)
 */
const loadQuartierData = async (): Promise<QuartierData[]> => {
  try {
    const data = await loadQuartiers() as QuartierData[]
    console.log(`🏘️ Chargé ${data.length} quartiers`)
    return data
  } catch (error) {
    console.error('Erreur lors du chargement des quartiers:', error)
    return []
  }
}

/**
 * Charge les métadonnées des questions depuis MetaSuQuestions.json (via data-loader)
 */
const loadMetaQuestions = async (): Promise<MetaQuestion[]> => {
  try {
    const data = await loadMetaSuQuestions() as MetaQuestion[]
    console.log(`🔍 Chargé ${data.length} métadonnées de questions`)
    return data
  } catch (error) {
    console.error('Erreur lors du chargement des métadonnées de questions:', error)
    return []
  }
}

/**
 * Charge les métadonnées des choix depuis MetaSuChoices.json (via data-loader)
 */
const loadMetaChoices = async (): Promise<MetaChoice[]> => {
  try {
    const data = await loadMetaSuChoices() as MetaChoice[]
    console.log(`🎯 Chargé ${data.length} métadonnées de choix`)
    return data
  } catch (error) {
    console.error('Erreur lors du chargement des métadonnées de choix:', error)
    return []
  }
}



// =====================================
// FONCTIONS DE TRAITEMENT DES MÉTADONNÉES
// =====================================

/**
 * Extrait les métadonnées de la question "Age Category"
 */
const getAgeQuestionMetadata = (metaQuestions: MetaQuestion[]) => {
  const ageQuestion = metaQuestions.find(q => q["Metabase Question Key"] === "Age Category")
  
  if (!ageQuestion) {
    console.warn('⚠️ Métadonnées de question âge non trouvées, utilisation des valeurs par défaut')
    return {
      title: 'Distribution d\'âge',
      emoji: '👥',
      questionOrigin: 'Quelle est votre tranche d\'âge ?',
      questionShort: 'Tranches d\'âges'
    }
  }

  return {
    title: ageQuestion["Question Short"] || 'Distribution d\'âge',
    emoji: ageQuestion.Emoji || '👥',
    questionOrigin: ageQuestion["Question Origin"] || 'Quelle est votre tranche d\'âge ?',
    questionShort: ageQuestion["Question Short"] || 'Tranches d\'âges'
  }
}

/**
 * Crée un dictionnaire des choix d'âge avec leurs métadonnées
 */
const getAgeChoicesMetadata = (metaChoices: MetaChoice[]) => {
  const ageChoices = metaChoices.filter(c => c["Metabase Question Key"] === "Age Category")
  
  if (ageChoices.length === 0) {
    console.warn('⚠️ Métadonnées de choix âge non trouvées, utilisation des valeurs par défaut')
    return {
      FROM_15_TO_29: { label: '15-29 ans', emoji: '' },
      FROM_30_TO_44: { label: '30-44 ans', emoji: '' },
      FROM_45_TO_59: { label: '45-59 ans', emoji: '' },
      FROM_60_TO_74: { label: '60-74 ans', emoji: '' },
      ABOVE_75: { label: '75+ ans', emoji: '' }
    }
  }

  const choicesMap: Record<string, { label: string; emoji: string }> = {}
  
  ageChoices.forEach(choice => {
    const key = choice["Metabase Choice Key"]
    choicesMap[key] = {
      label: choice["Label Origin"] || choice["Label Short"] || key,
      emoji: choice.Emoji || '👥'
    }
  })

  return choicesMap
}

// =====================================
// FONCTIONS DE TRAITEMENT DES DONNÉES
// =====================================

/**
 * Traite les réponses individuelles pour calculer la distribution d'âge
 */
const processAgeDistribution = (
  answers: SuAnswer[],
  choicesMetadata: Record<string, { label: string; emoji: string }>
): AgeDistributionResult['data'] => {
  
  // Compter les réponses par catégorie d'âge
  const ageCounts: Record<string, number> = {}
  const totalAnswers = answers.length

  // Initialiser les compteurs
  Object.keys(choicesMetadata).forEach(key => {
    ageCounts[key] = 0
  })

  // Compter les réponses valides
  answers.forEach(answer => {
    const ageCategory = answer["Age Category"]
    if (ageCategory && ageCounts.hasOwnProperty(ageCategory)) {
      ageCounts[ageCategory] = (ageCounts[ageCategory] ?? 0) + 1
    }
  })

  // Calculer les pourcentages et créer les données finales
  return Object.entries(ageCounts).map(([key, count]) => {
    const percentage = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0
    const metadata = choicesMetadata[key] ?? { label: key, emoji: '👥' }
    
    return {
      value: key,
      label: metadata.label,
      emoji: metadata.emoji,
      count,
      percentage: Math.round(percentage * 10) / 10, // Arrondir à 1 décimale
      midpoint: AGE_MIDPOINTS[key] ?? 0
    }
  }).filter(item => item.count > 0) // Exclure les catégories vides
}

/**
 * Traite les données de quartier INSEE pour la distribution d'âge
 */
const processQuartierAgeDistribution = (
  quartiers: QuartierData[],
  selectedQuartierNames: string[]
): AgeDistributionResult['data'] => {
  
  // Filtrer les quartiers sélectionnés (ou tous si aucun spécifié)
  const targetQuartiers = selectedQuartierNames.length > 0 
    ? quartiers.filter(q => selectedQuartierNames.includes(String(q.Nom)))
    : quartiers

  console.log(`📊 Traitement de ${targetQuartiers.length} quartiers pour la distribution d'âge`)

  // Agréger les données INSEE par tranche d'âge
  const aggregatedData: Record<string, number> = {}
  
  // Initialiser les compteurs
  Object.values(INSEE_AGE_MAPPING).forEach(ageKey => {
    aggregatedData[ageKey] = 0
  })

  // Sommer les populations par tranche d'âge
  targetQuartiers.forEach(quartier => {
    Object.entries(INSEE_AGE_MAPPING).forEach(([inseeKey, ageKey]) => {
      const population = quartier[inseeKey as keyof QuartierData] as number || 0
      aggregatedData[ageKey] = (aggregatedData[ageKey] ?? 0) + population
    })
  })

  // Calculer le total pour les pourcentages
  const totalPopulation = Object.values(aggregatedData).reduce((sum, count) => sum + count, 0)

  // Métadonnées par défaut pour les quartiers
  const defaultChoicesMetadata = {
    FROM_15_TO_29: { label: '15-29 ans', emoji: '🧒' },
    FROM_30_TO_44: { label: '30-44 ans', emoji: '👨' },
    FROM_45_TO_59: { label: '45-59 ans', emoji: '👨‍💼' },
    FROM_60_TO_74: { label: '60-74 ans', emoji: '👴' },
    ABOVE_75: { label: '75+ ans', emoji: '👵' }
  }

  // Créer les données finales
  return Object.entries(aggregatedData).map(([key, count]) => {
    const percentage = totalPopulation > 0 ? (count / totalPopulation) * 100 : 0
    const metadata = defaultChoicesMetadata[key as keyof typeof defaultChoicesMetadata] || { label: key, emoji: '👥' }
    
    return {
      value: key,
      label: metadata.label,
      emoji: metadata.emoji,
      count,
      percentage: Math.round(percentage * 10) / 10, // Arrondir à 1 décimale
      midpoint: AGE_MIDPOINTS[key] ?? 0
    }
  }).filter(item => item.count > 0) // Exclure les tranches vides
}

// =====================================
// FONCTION PRINCIPALE (legacy)
// =====================================

// Fonction principale historique avec cache (signature conservée)
export const getDpAgeDistributionData = async (selectedSus?: number[]): Promise<AgeDistributionResult> => {
  try {
    const cacheKey = JSON.stringify(selectedSus ?? [])
    
    // Vérifier le cache (1 heure d'expiration)
    if (dataCache.has(cacheKey) && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
      console.log(`✅ Utilisation des données mises en cache pour ${DATAPACK_NAME}`)
      return dataCache.get(cacheKey)!
    }

    console.log(`🔄 Calcul des données pour ${DATAPACK_NAME}...`)
    
    // Déterminer si c'est une vue quartier ou SU
    const isQuartier = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1
    
    if (!isQuartier && selectedSus && selectedSus.length === 1) {
      // Mapper les ID locaux vers les ID globaux si nécessaire
      const mappedSuIds = await mapLocalToGlobalIds(selectedSus)
      const targetSuId = mappedSuIds[0]!
      
      // Traitement des données SU (réponses individuelles)
      console.log(`📋 Traitement des réponses SU: ${selectedSus[0]} → ${targetSuId}`)
      
      const [suAnswers, metaQuestions, metaChoices] = await Promise.all([
        loadSuAnswerData(),
        loadMetaQuestions(),
        loadMetaChoices()
      ])

      console.log(`📊 Total des réponses chargées: ${suAnswers.length}`)
      
      // Analyser les ID disponibles pour le debug
      const availableSuIds = [...new Set(suAnswers.map(answer => answer["Su ID"]))].sort((a, b) => a - b)
      console.log(`🔍 ID des SU disponibles dans les données:`, availableSuIds)
      console.log(`🔍 ID recherché:`, targetSuId)

      // Filtrer les réponses pour le SU sélectionné (utiliser l'ID mappé)
      const filteredAnswers = suAnswers.filter(answer => 
        answer["Su ID"] === targetSuId
      )

      console.log(`🎯 ${filteredAnswers.length} réponses trouvées pour le SU ${targetSuId}`)
      
      // Si aucune réponse trouvée, suggérer des ID valides
      if (filteredAnswers.length === 0 && availableSuIds.length > 0) {
        console.warn(`⚠️ Aucune réponse pour SU ${targetSuId}. Essayez avec: ${availableSuIds.slice(0, 3).join(', ')}`)
      }

      // Récupérer les métadonnées
      const questionMetadata = getAgeQuestionMetadata(metaQuestions)
      const choicesMetadata = getAgeChoicesMetadata(metaChoices)

      // Traiter la distribution d'âge
      const ageData = processAgeDistribution(filteredAnswers, choicesMetadata)

      const result: AgeDistributionResult = {
        data: ageData,
        isQuartier: false,
        questionLabels: questionMetadata,
        suId: targetSuId, // Utiliser l'ID mappé
        totalResponses: filteredAnswers.length,
        dataSource: 'Su Answer'
      }
      
      // Mettre en cache le résultat
      dataCache.set(cacheKey, result)
      cacheTimestamp = Date.now()
      
      console.log(`✅ Données de distribution d'âge calculées et mises en cache`)
      return result
      
    } else {
      // Traitement des données de quartier INSEE
      console.log(`🏘️ Traitement des données de quartier`)
      
      const quartiers = await loadQuartierData()
      
      // Traiter la distribution d'âge des quartiers (tous par défaut)
      const quartierAgeData = processQuartierAgeDistribution(quartiers, [])
      
      // Calculer le total des réponses
      const totalPopulation = quartierAgeData.reduce((sum, item) => sum + item.count, 0)
      
      const result: AgeDistributionResult = {
        data: quartierAgeData,
        isQuartier: true,
        questionLabels: {
          title: 'Tranches d\'âges',
          emoji: '🧒👵',
          questionOrigin: 'Tranche d\'âges (Données INSEE)',
          questionShort: 'Tranches d\'âges'
        },
        totalResponses: totalPopulation,
        dataSource: 'Quartiers INSEE'
      }

      // Mettre en cache le résultat
      dataCache.set(cacheKey, result)
      cacheTimestamp = Date.now()
      
      console.log(`✅ Données de quartier calculées et mises en cache`)
      return result
    }
    
  } catch (error) {
    console.error(`❌ Erreur dans ${DATAPACK_NAME}:`, error)
    
    // Retourner des données de fallback
    return {
      data: [],
      isQuartier: true,
      questionLabels: {
        title: 'Erreur de chargement',
        emoji: '❌',
        questionOrigin: 'Erreur', 
        questionShort: 'Erreur'
      },
      totalResponses: 0,
      dataSource: 'Erreur'
    }
  }
}

// =====================================
// FONCTIONS DE TEST ET UTILITAIRES
// =====================================

// Fonction pour analyser les ID de SU disponibles dans les données
export const analyzeSuIds = async () => {
  console.log('🔍 Analyse des ID de SU disponibles...')
  
  try {
    const suAnswers = await loadSuAnswerData()
    
    // Extraire les ID uniques
    const suIds = [...new Set(suAnswers.map(answer => answer["Su ID"]))].sort((a, b) => a - b)
    
    console.log('📊 ID des SU trouvés:', suIds)
    console.log('📈 Nombre total de réponses:', suAnswers.length)
    
    // Compter les réponses par SU
    const countBySu: Record<number, number> = {}
    suAnswers.forEach(answer => {
      const suId = answer["Su ID"]
      countBySu[suId] = (countBySu[suId] ?? 0) + 1
    })
    
    console.log('📋 Répartition des réponses par SU:')
    Object.entries(countBySu).forEach(([suId, count]) => {
      console.log(`  SU ${suId}: ${count} réponses`)
    })
    
    // Analyser les catégories d'âge disponibles
    const ageCategories = [...new Set(suAnswers.map(answer => answer["Age Category"]).filter(Boolean))]
    console.log('🎯 Catégories d\'âge trouvées:', ageCategories)
    
    return { suIds, countBySu, ageCategories, totalAnswers: suAnswers.length }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'analyse des SU:', error)
    return null
  }
}

// =====================================
// FONCTION CONTRAT CIBLE
// =====================================

export const getDpAgeDistributionDatapack = async (
  request: DatapackRequest
): Promise<DatapackResponse<AgeDistributionResult>> => {
  const { selectedSus, view = 'auto' } = request
  const effectiveSelectedSus = selectedSus ?? []

  const base = await getDpAgeDistributionData(effectiveSelectedSus)

  const inferredView: DatapackView = base.isQuartier ? 'quartier' : 'su'
  const effectiveView: DatapackView =
    view === 'auto' ? inferredView : view

  return {
    id: DATAPACK_NAME,
    version: '1.0.0',
    data: base,
    context: {
      view: effectiveView,
      selectedSus: effectiveSelectedSus,
      resolvedSuIds: base.suId !== undefined ? [base.suId] : undefined,
      isPartial: !base.isQuartier && effectiveSelectedSus.length > 1
    },
    meta: {
      totalResponses: base.totalResponses,
      dataSource: base.dataSource
    },
    warnings: base.data.length === 0
      ? [{ type: 'NO_DATA', message: 'Aucune donnée de distribution d\'âge disponible.' }]
      : undefined,
    errors: undefined
  }
}