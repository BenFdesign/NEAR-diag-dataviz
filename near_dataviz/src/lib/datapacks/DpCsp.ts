/**
 * DATAPACK - Distribution des Catégories Socio-Professionnelles (CSP)
 * 
 * Ce datapack charge les données réelles de distribution CSP depuis :
 * - Su Answer.json : Réponses individuelles pour les SUs spécifiques
 * - Quartiers.json : Données agrégées INSEE pour la vue quartier
 * - MetaSuQuestions.json et MetaSuChoices.json : Métadonnées
 */

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
  "Professional Category": string
  "Age Category"?: string
  "Gender"?: string
  [key: string]: unknown
}

// Interface pour les données de quartier (Quartiers.json)
interface QuartierData {
  "Survey ID": number
  "Population Sum": number
  "C21 Pop15p Cs1 Sum": number    // Agriculteurs exploitants
  "C21 Pop15p Cs2 Sum": number    // Artisans, Commerçants, Chefs d'entreprise
  "C21 Pop15p Cs3 Sum": number    // Cadres et professions intellectuelles supérieures
  "C21 Pop15p Cs4 Sum": number    // Professions intermédiaires
  "C21 Pop15p Cs5 Sum": number    // Employés
  "C21 Pop15p Cs6 Sum": number    // Ouvriers
  "C21 Pop15p Cs7 Sum": number    // Retraités
  "C21 Pop15p Cs8 Sum": number    // Autres personnes sans activité professionnelle
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
export interface CspDistributionResult {
  data: {
    value: string         // Clé du choix (ex: "CS1", "CS2", etc.)
    label: string         // Label affiché (ex: "Agriculteurs", "Artisans")
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

const DATAPACK_NAME = 'DpCsp'

// Cache côté client pour éviter les recalculs
const dataCache = new Map<string, CspDistributionResult>()
let cacheTimestamp = 0
const CACHE_DURATION = 3600000 // 1 heure en millisecondes

// Mappage des CSP INSEE vers nos codes
const INSEE_CSP_MAPPING = {
  'C21 Pop15p Cs1 Sum': 'CS1',    // Agriculteurs exploitants
  'C21 Pop15p Cs2 Sum': 'CS2',    // Artisans, Commerçants, Chefs d'entreprise
  'C21 Pop15p Cs3 Sum': 'CS3',    // Cadres et professions intellectuelles supérieures
  'C21 Pop15p Cs4 Sum': 'CS4',    // Professions intermédiaires
  'C21 Pop15p Cs5 Sum': 'CS5',    // Employés
  'C21 Pop15p Cs6 Sum': 'CS6',    // Ouvriers
  'C21 Pop15p Cs7 Sum': 'CS7',    // Retraités
  'C21 Pop15p Cs8 Sum': 'CS8'     // Autres personnes sans activité professionnelle
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
 * Extrait les métadonnées de la question "Professional Category"
 */
const getCspQuestionMetadata = (metaQuestions: MetaQuestion[]) => {
  const cspQuestion = metaQuestions.find(q => q["Metabase Question Key"] === "Professional Category")
  
  if (!cspQuestion) {
    console.warn('⚠️ Métadonnées de question CSP non trouvées, utilisation des valeurs par défaut')
    return {
      title: 'Catégories socio-professionnelles',
      emoji: '💼',
      questionOrigin: 'Quelle est votre catégorie socio-professionnelle ?',
      questionShort: 'CSP'
    }
  }

  return {
    title: cspQuestion["Question Short"] || 'Catégories socio-professionnelles',
    emoji: cspQuestion.Emoji || '💼',
    questionOrigin: cspQuestion["Question Origin"] || 'Quelle est votre catégorie socio-professionnelle ?',
    questionShort: cspQuestion["Question Short"] || 'CSP'
  }
}

/**
 * Crée un dictionnaire des choix CSP avec leurs métadonnées
 */
const getCspChoicesMetadata = (metaChoices: MetaChoice[]) => {
  const cspChoices = metaChoices.filter(c => c["Metabase Question Key"] === "Professional Category")
  
  if (cspChoices.length === 0) {
    console.warn('⚠️ Métadonnées de choix CSP non trouvées, utilisation des valeurs par défaut')
    return {
      CS1: { label: 'Agriculteurs exploitants', emoji: '🚜' },
      CS2: { label: 'Artisans, Commerçants, Chefs d\'entreprise', emoji: '🔨' },
      CS3: { label: 'Cadres et professions intellectuelles supérieures', emoji: '👔' },
      CS4: { label: 'Professions intermédiaires', emoji: '👨‍💼' },
      CS5: { label: 'Employés', emoji: '👩‍💻' },
      CS6: { label: 'Ouvriers', emoji: '👷' },
      CS7: { label: 'Retraités', emoji: '👴' },
      CS8: { label: 'Autres personnes sans activité professionnelle', emoji: '🏠' }
    }
  }

  const choicesMap: Record<string, { label: string; emoji: string }> = {}
  
  cspChoices.forEach(choice => {
    const key = choice["Metabase Choice Key"]
    choicesMap[key] = {
      label: choice["Label Short"] || choice["Label Origin"] || key,
      emoji: choice.Emoji || '💼'
    }
  })

  return choicesMap
}

// =====================================
// FONCTIONS DE TRAITEMENT DES DONNÉES
// =====================================

/**
 * Traite les réponses individuelles pour calculer la distribution CSP
 */
const processCspDistribution = (
  answers: SuAnswer[],
  choicesMetadata: Record<string, { label: string; emoji: string }>
): CspDistributionResult['data'] => {
  
  // Compter les réponses par CSP
  const cspCounts: Record<string, number> = {}
  const totalAnswers = answers.length

  // Initialiser les compteurs
  Object.keys(choicesMetadata).forEach(key => {
    cspCounts[key] = 0
  })

  // Compter les réponses valides
  answers.forEach(answer => {
    const csp = answer["Professional Category"]
    if (csp && cspCounts.hasOwnProperty(csp)) {
      cspCounts[csp] = (cspCounts[csp] ?? 0) + 1
    }
  })

  // Calculer les pourcentages et créer les données finales
  return Object.entries(cspCounts).map(([key, count]) => {
    const percentage = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0
    const metadata = choicesMetadata[key] ?? { label: key, emoji: '💼' }
    
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
 * Traite les données de quartier INSEE pour la distribution CSP
 */
const processQuartierCspDistribution = (
  quartiers: QuartierData[]
): CspDistributionResult['data'] => {
  
  console.log(`📊 Traitement de ${quartiers.length} quartiers pour la distribution CSP`)

  // Agréger les données INSEE par CSP
  const aggregatedData: Record<string, number> = {}
  
  // Initialiser les compteurs
  Object.values(INSEE_CSP_MAPPING).forEach(cspKey => {
    aggregatedData[cspKey] = 0
  })

  // Sommer les populations par CSP
  quartiers.forEach(quartier => {
    Object.entries(INSEE_CSP_MAPPING).forEach(([inseeKey, cspKey]) => {
      const population = quartier[inseeKey as keyof QuartierData] as number || 0
      aggregatedData[cspKey] = (aggregatedData[cspKey] ?? 0) + population
    })
  })

  // Calculer le total pour les pourcentages
  const totalPopulation = Object.values(aggregatedData).reduce((sum, count) => sum + count, 0)

  // Métadonnées par défaut pour les quartiers
  const defaultChoicesMetadata = {
    CS1: { label: 'Agriculteurs exploitants', emoji: '🚜' },
    CS2: { label: 'Artisans, Commerçants, Chefs d\'entreprise', emoji: '🔨' },
    CS3: { label: 'Cadres et professions intellectuelles supérieures', emoji: '👔' },
    CS4: { label: 'Professions intermédiaires', emoji: '👨‍💼' },
    CS5: { label: 'Employés', emoji: '👩‍💻' },
    CS6: { label: 'Ouvriers', emoji: '👷' },
    CS7: { label: 'Retraités', emoji: '👴' },
    CS8: { label: 'Autres personnes sans activité professionnelle', emoji: '🏠' }
  }

  // Créer les données finales
  return Object.entries(aggregatedData).map(([key, count]) => {
    const percentage = totalPopulation > 0 ? (count / totalPopulation) * 100 : 0
    const metadata = defaultChoicesMetadata[key as keyof typeof defaultChoicesMetadata] || { label: key, emoji: '💼' }
    
    return {
      value: key,
      label: metadata.label,
      emoji: metadata.emoji,
      count,
      percentage: Math.round(percentage) // Arrondir à l'entier pour les données INSEE
    }
  }).filter(item => item.count > 0) // Exclure les CSP vides
}

// =====================================
// FONCTION PRINCIPALE
// =====================================

const getDpCspData = async (selectedSus?: number[]): Promise<CspDistributionResult> => {
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
      const questionMetadata = getCspQuestionMetadata(metaQuestions)
      const choicesMetadata = getCspChoicesMetadata(metaChoices)

      // Traiter la distribution CSP
      const cspData = processCspDistribution(filteredAnswers, choicesMetadata)

      const result: CspDistributionResult = {
        data: cspData,
        isQuartier: false,
        questionLabels: questionMetadata,
        suId: targetSuId,
        totalResponses: filteredAnswers.length,
        dataSource: 'Su Answer'
      }
      
      // Mettre en cache le résultat
      dataCache.set(cacheKey, result)
      cacheTimestamp = Date.now()
      
      console.log(`✅ Données de distribution CSP calculées et mises en cache`)
      return result
      
    } else {
      // Traitement des données de quartier INSEE
      console.log(`🏘️ Traitement des données de quartier CSP`)
      
      const quartiers = await loadQuartierData()
      
      // Traiter la distribution CSP des quartiers
      const quartierCspData = processQuartierCspDistribution(quartiers)
      
      // Calculer le total des réponses
      const totalPopulation = quartierCspData.reduce((sum, item) => sum + item.count, 0)
      
      const result: CspDistributionResult = {
        data: quartierCspData,
        isQuartier: true,
        questionLabels: {
          title: 'Catégories socio-professionnelles',
          emoji: '💼',
          questionOrigin: 'Catégories socio-professionnelles (Données INSEE)',
          questionShort: 'CSP'
        },
        totalResponses: totalPopulation,
        dataSource: 'Quartiers INSEE'
      }

      // Mettre en cache le résultat
      dataCache.set(cacheKey, result)
      cacheTimestamp = Date.now()
      
      console.log(`✅ Données de quartier CSP calculées et mises en cache`)
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

export const testDpCsp = async () => {
  console.log(`🧪 Test de ${DATAPACK_NAME} avec données réelles...`)
  
  try {
    // Test des données de quartier
    const quartierResult = await getDpCspData()
    console.log('✅ Résultat quartier CSP:', {
      isQuartier: quartierResult.isQuartier,
      dataPoints: quartierResult.data.length,
      totalResponses: quartierResult.totalResponses,
      dataSource: quartierResult.dataSource,
      totalPercentage: quartierResult.data.reduce((sum, item) => sum + item.percentage, 0).toFixed(1)
    })
    
    // Test SU individuel
    const singleSuResult = await getDpCspData([1])
    console.log('✅ Résultat SU individuel CSP:', {
      isQuartier: singleSuResult.isQuartier,
      suId: singleSuResult.suId,
      dataPoints: singleSuResult.data.length,
      totalResponses: singleSuResult.totalResponses,
      dataSource: singleSuResult.dataSource,
      totalPercentage: singleSuResult.data.reduce((sum, item) => sum + item.percentage, 0).toFixed(1)
    })
    
    console.log('✅ Test de distribution CSP terminé avec succès!')
  } catch (error) {
    console.error(`❌ Test ${DATAPACK_NAME} échoué:`, error)
  }
}

// Clear cache utility
export const clearCspCache = (): void => {
  dataCache.clear()
  cacheTimestamp = 0
  console.log(`🧹 ${DATAPACK_NAME} cache cleared`)
}

// =====================================
// CONTRAT DATAPACK STANDARDISÉ
// =====================================

export const getDpCspDatapack = async (
  request: DatapackRequest
): Promise<DatapackResponse<CspDistributionResult>> => {
  const selectedSus = request.selectedSus

  const data = await getDpCspData(selectedSus)

  const isQuartier = data.isQuartier
  const view: 'su' | 'quartier' = isQuartier ? 'quartier' : 'su'

  const context = {
    view,
    selectedSus: selectedSus ?? [],
    resolvedSuIds: isQuartier ? undefined : (data.suId !== undefined ? [data.suId] : undefined),
    isPartial: false
  }

  const response: DatapackResponse<CspDistributionResult> = {
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