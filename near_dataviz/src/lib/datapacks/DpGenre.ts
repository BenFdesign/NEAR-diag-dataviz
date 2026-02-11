/**
 * DATAPACK - Distribution des genres
 * 
 * Ce datapack charge les données réelles de distribution de genre depuis :
 * - Su Answer.json : Réponses individuelles pour les SUs spécifiques
 * - Quartiers.json : Données agrégées INSEE pour la vue quartier
 * - MetaSuQuestions.json et MetaSuChoices.json : Métadonnées
 */

/* import { getCacheStatus } from '~/lib/data-loader' */ 

import { loadMetaSuChoices, loadMetaSuQuestions, loadQuartiersForCurrentSurvey, loadSuAnswer } from '~/lib/data-loader'
import type { DatapackRequest, DatapackResponse } from '~/lib/datapacks/contracts'
import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'

// =====================================
// INTERFACES ET TYPES
// =====================================

// Interface pour les réponses individuelles (Su Answer.json)
interface SuAnswer {
  ID: number
  "Su ID": number
  "Gender": string
  "Age Category"?: string
  [key: string]: unknown
}

// Interface pour les données de quartier (Quartiers.json)
interface QuartierData {
  "Survey ID": number
  "Population Sum": number
  "Population Femme Sum": number    // Femmes
  "Population Homme Sum": number    // Hommes
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

// Export interface
export interface GenreDistributionResult {
  data: {
    value: string         // Clé du choix (ex: "HOMME", "FEMME")
    label: string         // Label affiché (ex: "Homme", "Femme")
    emoji: string         // Emoji associé
    count: number         // Nombre absolu de réponses
    percentage: number    // Pourcentage
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

const DATAPACK_NAME = 'DpGenre'

// Cache côté client pour éviter les recalculs
const dataCache = new Map<string, GenreDistributionResult>()
let cacheTimestamp = 0
const CACHE_DURATION = 3600000 // 1 heure en millisecondes

// Mappage des genres INSEE vers nos codes
const INSEE_GENRE_MAPPING = {
  'Population Femme Sum': 'FEMME',
  'Population Homme Sum': 'HOMME'
}

// =====================================
// FONCTIONS DE CHARGEMENT DES DONNÉES
// =====================================

/**
 * Charge les réponses individuelles depuis Su Answer.json
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
 * Charge les données de quartier depuis Quartiers.json
 */
const loadQuartierData = async (): Promise<QuartierData[]> => {
  try {
    const data = await loadQuartiersForCurrentSurvey() as QuartierData[]
    console.log(`🏘️ Chargé ${data.length} quartiers (filtrés par SurveyID courant)`)
    return data
  } catch (error) {
    console.error('Erreur lors du chargement des quartiers:', error)
    return []
  }
}

/**
 * Charge les métadonnées des questions depuis MetaSuQuestions.json
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
 * Charge les métadonnées des choix depuis MetaSuChoices.json
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
 * Extrait les métadonnées de la question "Gender"
 */
const getGenreQuestionMetadata = (metaQuestions: MetaQuestion[]) => {
  const genreQuestion = metaQuestions.find(q => q["Metabase Question Key"] === "Gender")
  
  if (!genreQuestion) {
    console.warn('⚠️ Métadonnées de question genre non trouvées, utilisation des valeurs par défaut')
    return {
      title: 'Distribution par genre',
      emoji: '👨👩',
      questionOrigin: 'Quel est votre genre ?',
      questionShort: 'Genre'
    }
  }

  return {
    title: genreQuestion["Question Short"] || 'Distribution par genre',
    emoji: genreQuestion.Emoji || '👨👩',
    questionOrigin: genreQuestion["Question Origin"] || 'Quel est votre genre ?',
    questionShort: genreQuestion["Question Short"] || 'Genre'
  }
}

/**
 * Crée un dictionnaire des choix de genre avec leurs métadonnées
 */
const getGenreChoicesMetadata = (metaChoices: MetaChoice[]) => {
  const genreChoices = metaChoices.filter(c => c["Metabase Question Key"] === "Gender")
  
  if (genreChoices.length === 0) {
    console.warn('⚠️ Métadonnées de choix genre non trouvées, utilisation des valeurs par défaut')
    return {
      HOMME: { label: 'Homme', emoji: '👨' },
      FEMME: { label: 'Femme', emoji: '👩' }
    }
  }

  const choicesMap: Record<string, { label: string; emoji: string }> = {}
  
  genreChoices.forEach(choice => {
    const key = choice["Metabase Choice Key"]
    choicesMap[key] = {
      label: choice["Label Origin"] || choice["Label Short"] || key,
      emoji: choice.Emoji || (key === 'HOMME' ? '👨' : '👩')
    }
  })

  return choicesMap
}

// =====================================
// FONCTIONS DE TRAITEMENT DES DONNÉES
// =====================================

/**
 * Traite les réponses individuelles pour calculer la distribution de genre
 */
const processGenreDistribution = (
  answers: SuAnswer[],
  choicesMetadata: Record<string, { label: string; emoji: string }>
): GenreDistributionResult['data'] => {
  
  // Compter les réponses par genre
  const genreCounts: Record<string, number> = {}
  const totalAnswers = answers.length

  // Initialiser les compteurs
  Object.keys(choicesMetadata).forEach(key => {
    genreCounts[key] = 0
  })

  // Compter les réponses valides
  answers.forEach(answer => {
    const gender = answer.Gender
    if (gender && genreCounts.hasOwnProperty(gender)) {
      genreCounts[gender] = (genreCounts[gender] ?? 0) + 1
    }
  })

  // Calculer les pourcentages et créer les données finales
  return Object.entries(genreCounts).map(([key, count]) => {
    const percentage = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0
    const metadata = choicesMetadata[key] ?? { label: key, emoji: '👤' }
    
    return {
      value: key,
      label: metadata.label,
      emoji: metadata.emoji,
      count,
      percentage: Math.round(percentage * 10) / 10 // Arrondir à 1 décimale
    }
  }).filter(item => item.count > 0) // Exclure les catégories vides
}

/**
 * Traite les données de quartier INSEE pour la distribution de genre
 */
const processQuartierGenreDistribution = (
  quartiers: QuartierData[]
): GenreDistributionResult['data'] => {
  
  console.log(`📊 Traitement de ${quartiers.length} quartiers pour la distribution de genre`)

  // Agréger les données INSEE par genre
  const aggregatedData: Record<string, number> = {}
  
  // Initialiser les compteurs
  Object.values(INSEE_GENRE_MAPPING).forEach(genreKey => {
    aggregatedData[genreKey] = 0
  })

  // Sommer les populations par genre
  quartiers.forEach(quartier => {
    Object.entries(INSEE_GENRE_MAPPING).forEach(([inseeKey, genreKey]) => {
      const population = quartier[inseeKey as keyof QuartierData] as number || 0
      aggregatedData[genreKey] = (aggregatedData[genreKey] ?? 0) + Math.round(population)
    })
  })

  // Calculer le total pour les pourcentages
  const totalPopulation = Object.values(aggregatedData).reduce((sum, count) => sum + count, 0)

  // Métadonnées par défaut pour les quartiers
  const defaultChoicesMetadata = {
    FEMME: { label: 'Femmes', emoji: '👩' },
    HOMME: { label: 'Hommes', emoji: '👨' }
  }

  // Créer les données finales
  return Object.entries(aggregatedData).map(([key, count]) => {
    const percentage = totalPopulation > 0 ? (count / totalPopulation) * 100 : 0
    const metadata = defaultChoicesMetadata[key as keyof typeof defaultChoicesMetadata] || { label: key, emoji: '👤' }
    
    return {
      value: key,
      label: metadata.label,
      emoji: metadata.emoji,
      count: Math.round(count), // Arrondir le nombre sans décimales
      percentage: Math.round(percentage * 10) / 10 // Arrondir à 1 décimale
    }
  }).filter(item => item.count > 0) // Exclure les genres vides
}

// =====================================
// FONCTION PRINCIPALE
// =====================================

export const getDpGenreData = async (selectedSus?: number[]): Promise<GenreDistributionResult> => {
  try {
    const cacheKey = JSON.stringify(selectedSus ?? [])
    
    // Vérifier le cache
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

      // Filtrer les réponses pour le SU sélectionné
      const filteredAnswers = suAnswers.filter(answer => 
        answer["Su ID"] === targetSuId
      )

      console.log(`🎯 ${filteredAnswers.length} réponses trouvées pour le SU ${targetSuId}`)

      // Récupérer les métadonnées
      const questionMetadata = getGenreQuestionMetadata(metaQuestions)
      const choicesMetadata = getGenreChoicesMetadata(metaChoices)

      // Traiter la distribution de genre
      const genreData = processGenreDistribution(filteredAnswers, choicesMetadata)

      const result: GenreDistributionResult = {
        data: genreData,
        isQuartier: false,
        questionLabels: questionMetadata,
        suId: targetSuId,
        totalResponses: filteredAnswers.length,
        dataSource: 'Su Answer'
      }
      
      // Mettre en cache le résultat
      dataCache.set(cacheKey, result)
      cacheTimestamp = Date.now()
      
      console.log(`✅ Données de distribution de genre calculées et mises en cache`)
      return result
      
    } else {
      // Traitement des données de quartier INSEE
      console.log(`🏘️ Traitement des données de quartier`)
      
      const quartiers = await loadQuartierData()
      
      // Traiter la distribution de genre des quartiers
      const quartierGenreData = processQuartierGenreDistribution(quartiers)
      
      // Calculer le total des réponses
      const totalPopulation = quartierGenreData.reduce((sum, item) => sum + item.count, 0)
      
      const result: GenreDistributionResult = {
        data: quartierGenreData,
        isQuartier: true,
        questionLabels: {
          title: 'Répartition par genre',
          emoji: '👨👩',
          questionOrigin: 'Répartition par genre (Données INSEE)',
          questionShort: 'Genre'
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

export const testDpGenre = async () => {
  console.log(`🧪 Test de ${DATAPACK_NAME} avec données réelles...`)
  
  try {
    // Test des données de quartier
    const quartierResult = await getDpGenreData()
    console.log('✅ Résultat quartier:', {
      isQuartier: quartierResult.isQuartier,
      dataPoints: quartierResult.data.length,
      totalResponses: quartierResult.totalResponses,
      dataSource: quartierResult.dataSource,
      totalPercentage: quartierResult.data.reduce((sum, item) => sum + item.percentage, 0).toFixed(1)
    })
    
    // Test SU individuel
    const singleSuResult = await getDpGenreData([1])
    console.log('✅ Résultat SU individuel:', {
      isQuartier: singleSuResult.isQuartier,
      suId: singleSuResult.suId,
      dataPoints: singleSuResult.data.length,
      totalResponses: singleSuResult.totalResponses,
      dataSource: singleSuResult.dataSource,
      totalPercentage: singleSuResult.data.reduce((sum, item) => sum + item.percentage, 0).toFixed(1)
    })
    
    console.log('✅ Test de distribution de genre terminé avec succès!')
  } catch (error) {
    console.error(`❌ Test ${DATAPACK_NAME} échoué:`, error)
  }
}

// Clear cache utility
export const clearGenreCache = (): void => {
  dataCache.clear()
  cacheTimestamp = 0
  console.log(`🧹 ${DATAPACK_NAME} cache cleared`)
}

// =====================================
// CONTRAT DATAPACK STANDARDISÉ
// =====================================

export const getDpGenreDatapack = async (
  request: DatapackRequest
): Promise<DatapackResponse<GenreDistributionResult>> => {
  const selectedSus = request.selectedSus

  const data = await getDpGenreData(selectedSus)

  const isQuartier = data.isQuartier
  const view: 'su' | 'quartier' = isQuartier ? 'quartier' : 'su'

  const context = {
    view,
    selectedSus: selectedSus ?? [],
    resolvedSuIds: isQuartier ? undefined : (data.suId !== undefined ? [data.suId] : undefined),
    isPartial: false
  }

  const response: DatapackResponse<GenreDistributionResult> = {
    id: DATAPACK_NAME,
    version: '1.0.0',
    data,
    context,
    meta: {
      totalResponses: data.totalResponses,
      dataSource: data.dataSource
    }
  }

  return response
}