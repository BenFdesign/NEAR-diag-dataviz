/**
 * TEMPLATE DATAPACK - Distribution des âges
 * 
 * Ce datapack est un modèle complet qui montre comment :
 * 1. Charger les données réelles depuis les fichiers JSON
 * 2. Extraire les métadonnées (labels, emojis) depuis les fichiers de métadonnées
 * 3. Calculer les distributions pour les SUs individuelles et utiliser les données quartier
 * 4. Implémenter un système de cache côté client
 * 5. Utiliser directement les données INSEE pour le quartier (déjà agrégées)
 * 
 * Utilisation des données :
 * - Su Answer.json : Contient les réponses individuelles avec "Age Category" et "Su ID"
 * - Quartiers.json : Contient les données agrégées par tranche d'âge (P21_Pop1529_Sum, etc.)
 * - Su Data.json : Contient les pourcentages de population par SU ("Pop Percentage")
 * - MetaSuQuestions.json : Contient les métadonnées des questions (titres, emojis)
 * - MetaSuChoices.json : Contient les métadonnées des choix (labels, codes)
 * 
 * ⚠️ IMPORTANT POUR D'AUTRES DATAPACKS :
 * Contrairement à l'âge où nous avons des données quartier INSEE directes,
 * la plupart des autres questions (Genre, Transport, etc.) nécessiteront 
 * une moyenne pondérée en utilisant les "Pop Percentage" de Su Data.json :
 * - SU 1 : 12.25% du quartier
 * - SU 2 : 79.5% du quartier  
 * - SU 3 : 8.25% du quartier
 */

import { 
  getCacheStatus 
} from '~/lib/data-loader'

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

// Interface pour le résultat final du datapack
export interface AgeDistributionResult {
  data: {
    value: string         // Clé du choix (ex: "FROM_15_TO_29")
    label: string         // Label affiché (ex: "15-29 ans")
    emoji: string         // Emoji associé
    count: number         // Nombre absolu de réponses
    percentage: number    // Pourcentage
    color: string         // Couleur pour la visualisation
    midpoint: number      // Point médian de la tranche (pour calculs)
  }[]
  color: string           // Couleur principale
  isQuartier: boolean     // True si vue quartier, false si SU spécifique
  questionLabels: {
    title: string
    emoji: string
    questionOrigin: string
    questionShort: string
  }
  suId?: number          // ID de la SU si vue spécifique
  totalResponses: number // Nombre total de réponses
  dataSource: 'real' | 'fallback' // Source des données
}

// =====================================
// CONSTANTES ET CONFIGURATION
// =====================================

const DATAPACK_NAME = 'DpAgeDistributionTemplate'

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

// Import du datapack de couleurs
import { getPalette, getColorByName } from './DpColor'

// Couleurs par défaut pour la visualisation (fallback uniquement)
const DEFAULT_COLORS = [
  '#3b82f6', // bleu
  '#10b981', // émeraude
  '#f59e0b', // ambre
  '#ef4444', // rouge
  '#8b5cf6', // violet
]

// =====================================
// FONCTIONS DE CHARGEMENT DES DONNÉES
// =====================================

/**
 * Charge les réponses individuelles depuis Su Answer.json
 */
const loadSuAnswerData = async (): Promise<SuAnswer[]> => {
  try {
    const response = await fetch('/api/data/Su%20Answer')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json() as SuAnswer[]
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
    const response = await fetch('/api/data/Quartiers')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json() as QuartierData[]
    console.log(`🏘️ Chargé ${data.length} quartiers`)
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
    const response = await fetch('/api/data/MetaSuQuestions')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json() as MetaQuestion[]
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
    const response = await fetch('/api/data/MetaSuChoices')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json() as MetaChoice[]
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
      FROM_15_TO_29: { label: '15-29 ans', emoji: '🧒' },
      FROM_30_TO_44: { label: '30-44 ans', emoji: '👨' },
      FROM_45_TO_59: { label: '45-59 ans', emoji: '👨‍💼' },
      FROM_60_TO_74: { label: '60-74 ans', emoji: '👴' },
      ABOVE_75: { label: '75+ ans', emoji: '👵' }
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
// FONCTIONS DE CALCUL POUR LES SU
// =====================================

/**
 * Calcule la distribution d'âge pour une SU spécifique
 * Utilise les réponses individuelles de Su Answer.json
 */
const calculateSuAgeDistribution = async (suId: number, allAnswers: SuAnswer[], choicesMetadata: Record<string, { label: string; emoji: string }>) => {
  console.log(`🔢 Calcul distribution âge pour SU ${suId}`)
  
  // Filtrer les réponses pour cette SU
  const suAnswers = allAnswers.filter(answer => answer["Su ID"] === suId)
  console.log(`📝 ${suAnswers.length} réponses trouvées pour SU ${suId}`)
  
  if (suAnswers.length === 0) {
    console.warn(`⚠️ Aucune réponse trouvée pour SU ${suId}`)
    return []
  }

  // Compter les réponses par tranche d'âge
  const ageCounts: Record<string, number> = {}
  
  suAnswers.forEach(answer => {
    const ageCategory = answer["Age Category"]
    if (ageCategory && typeof ageCategory === 'string') {
      ageCounts[ageCategory] = (ageCounts[ageCategory] ?? 0) + 1
    }
  })

  const totalResponses = suAnswers.length

  // Obtenir les couleurs depuis le datapack DpColor
  const paletteColors = await getPalette('graph', suId)
  
  // Transformer en format de sortie avec métadonnées
  const result = Object.entries(ageCounts).map(([ageKey, count], index) => {
    const metadata = choicesMetadata[ageKey] ?? { label: ageKey, emoji: '👥' }
    
    return {
      value: ageKey,
      label: metadata.label,
      emoji: metadata.emoji,
      count,
      percentage: (count / totalResponses) * 100,
      color: paletteColors[index] ?? DEFAULT_COLORS[index] ?? DEFAULT_COLORS[0]!,
      midpoint: AGE_MIDPOINTS[ageKey] ?? 50
    }
  })

  console.log(`✅ Distribution calculée: ${result.length} tranches d'âge`)
  return result
}

// =====================================
// FONCTIONS DE CALCUL POUR LE QUARTIER
// =====================================

/**
 * Utilise directement la distribution d'âge du quartier
 * Les données de Quartiers.json sont déjà agrégées au niveau quartier (INSEE)
 */
const getQuartierAgeDistribution = async (quartierData: QuartierData[], choicesMetadata: Record<string, { label: string; emoji: string }>) => {
  console.log('🏘️ Récupération distribution âge quartier (données INSEE agrégées)')
  
  if (quartierData.length === 0) {
    console.warn('⚠️ Aucune donnée de quartier disponible')
    return []
  }

  // Prendre le premier quartier (les données sont déjà agrégées)
  const quartier = quartierData[0]!
  
  // Les données INSEE sont déjà des totaux par tranche d'âge pour tout le quartier
  const totalPop = 
    (quartier["P21 Pop1529 Sum"] ?? 0) +
    (quartier["P21 Pop3044 Sum"] ?? 0) +
    (quartier["P21 Pop4559 Sum"] ?? 0) +
    (quartier["P21 Pop6074 Sum"] ?? 0) +
    (quartier["P21 Pop75p Sum"] ?? 0)

  console.log(`👥 Population totale du quartier (INSEE): ${totalPop.toFixed(0)}`)

  if (totalPop === 0) {
    console.warn('⚠️ Population totale nulle dans les données quartier')
    return []
  }

  // Obtenir les couleurs depuis le datapack DpColor (pour le quartier)
  const paletteColors = await getPalette('graph', 0)
  
  // Utiliser directement les données INSEE agrégées (pas de calcul de moyenne nécessaire)
  const result = Object.entries(INSEE_AGE_MAPPING).map(([inseeKey, ageKey], index) => {
    const count = quartier[inseeKey] as number ?? 0
    const metadata = choicesMetadata[ageKey] ?? { label: ageKey, emoji: '👥' }
    
    return {
      value: ageKey,
      label: metadata.label,
      emoji: metadata.emoji,
      count: Math.round(count), // Population réelle INSEE
      percentage: (count / totalPop) * 100,
      color: paletteColors[index] ?? DEFAULT_COLORS[index] ?? DEFAULT_COLORS[0]!,
      midpoint: AGE_MIDPOINTS[ageKey] ?? 50
    }
  })

  console.log(`✅ Distribution quartier extraite: ${result.length} tranches d'âge (INSEE)`)
  return result
}

// =====================================
// FONCTION PRINCIPALE DU DATAPACK
// =====================================

/**
 * Fonction principale qui retourne les données de distribution d'âge
 * 
 * @param selectedSus - Liste des SUs sélectionnées (optionnel)
 * @returns Distribution d'âge avec métadonnées complètes
 */
export const getDpAgeDistributionTemplateData = async (selectedSus?: number[]): Promise<AgeDistributionResult> => {
  try {
    const cacheKey = JSON.stringify(selectedSus ?? [])
    
    // 1. VÉRIFICATION DU CACHE
    if (dataCache.has(cacheKey) && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
      console.log(`✅ Utilisation du cache pour la distribution d'âge`)
      return dataCache.get(cacheKey)!
    }

    console.log(`🔄 Calcul de la distribution d'âge (cache manqué)...`)
    
    // 2. CHARGEMENT DES DONNÉES EN PARALLÈLE
    const [suAnswers, quartierData, metaQuestions, metaChoices] = await Promise.all([
      loadSuAnswerData(),
      loadQuartierData(),
      loadMetaQuestions(),
      loadMetaChoices()
    ])

    // 3. EXTRACTION DES MÉTADONNÉES
    const questionMetadata = getAgeQuestionMetadata(metaQuestions)
    const choicesMetadata = getAgeChoicesMetadata(metaChoices)

    // 4. DÉTERMINATION DU TYPE DE VUE
    const isQuartier = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1
    console.log(`📊 Type de vue: ${isQuartier ? 'Quartier' : `SU ${selectedSus[0]}`}`)

    let distributionData: AgeDistributionResult['data'] = []
    let totalResponses = 0
    let mainColor = '#002878'
    let suId: number | undefined

    // 5. CALCUL DE LA DISTRIBUTION
    if (isQuartier) {
      // VUE QUARTIER : Utiliser les données agrégées INSEE
      distributionData = await getQuartierAgeDistribution(quartierData, choicesMetadata)
      totalResponses = distributionData.reduce((sum, item) => sum + item.count, 0)
      
      // Couleur du quartier depuis le datapack DpColor
      try {
        mainColor = await getColorByName('colorMain', 0)
      } catch {
        console.warn('Impossible de charger la couleur du quartier')
        mainColor = '#002878'
      }
    } else {
      // VUE SU SPÉCIFIQUE : Utiliser les réponses individuelles
      suId = selectedSus[0]!
      distributionData = await calculateSuAgeDistribution(suId, suAnswers, choicesMetadata)
      totalResponses = distributionData.reduce((sum, item) => sum + item.count, 0)
      
      // Couleur de la SU depuis le datapack DpColor
      try {
        mainColor = await getColorByName('colorMain', suId)
      } catch {
        console.warn(`Impossible de charger la couleur pour SU ${suId}`)
        mainColor = DEFAULT_COLORS[0]!
      }
    }

    // 6. CONSTRUCTION DU RÉSULTAT FINAL
    const result: AgeDistributionResult = {
      data: distributionData,
      color: mainColor,
      isQuartier,
      questionLabels: questionMetadata,
      suId,
      totalResponses,
      dataSource: distributionData.length > 0 ? 'real' : 'fallback'
    }

    // 7. MISE EN CACHE
    dataCache.set(cacheKey, result)
    cacheTimestamp = Date.now()
    
    console.log(`✅ Distribution d'âge calculée et mise en cache (${totalResponses} réponses)`)
    return result

  } catch (error) {
    console.error(`❌ Erreur dans ${DATAPACK_NAME}:`, error)
    
    // 8. DONNÉES DE SECOURS EN CAS D'ERREUR
    return {
      data: [
        { value: 'FROM_15_TO_29', label: '15-29 ans', emoji: '🧒', count: 0, percentage: 0, color: DEFAULT_COLORS[0]!, midpoint: 22 },
        { value: 'FROM_30_TO_44', label: '30-44 ans', emoji: '👨', count: 0, percentage: 0, color: DEFAULT_COLORS[1]!, midpoint: 37 },
        { value: 'FROM_45_TO_59', label: '45-59 ans', emoji: '👨‍💼', count: 0, percentage: 0, color: DEFAULT_COLORS[2]!, midpoint: 52 },
        { value: 'FROM_60_TO_74', label: '60-74 ans', emoji: '👴', count: 0, percentage: 0, color: DEFAULT_COLORS[3]!, midpoint: 67 },
        { value: 'ABOVE_75', label: '75+ ans', emoji: '👵', count: 0, percentage: 0, color: DEFAULT_COLORS[4]!, midpoint: 82 }
      ],
      color: '#6c757d',
      isQuartier: true,
      questionLabels: {
        title: 'Distribution d\'âge',
        emoji: '👥',
        questionOrigin: 'Quelle est votre tranche d\'âge ?',
        questionShort: 'Tranches d\'âges'
      },
      totalResponses: 0,
      dataSource: 'fallback'
    }
  }
}

// =====================================
// FONCTIONS UTILITAIRES
// =====================================

/**
 * Fonction de test pour valider le fonctionnement du datapack
 */
export const testDpAgeDistributionTemplate = async () => {
  console.log(`🧪 Test du ${DATAPACK_NAME}...`)
  
  try {
    // Afficher le statut du cache
    console.log('📊 Statut du cache:', getCacheStatus())
    
    // Test 1: Vue quartier
    console.log('\n--- Test 1: Vue Quartier ---')
    const quartierResult = await getDpAgeDistributionTemplateData()
    console.log('✅ Résultat quartier:', {
      isQuartier: quartierResult.isQuartier,
      tranches: quartierResult.data.length,
      totalReponses: quartierResult.totalResponses,
      sourceData: quartierResult.dataSource,
      couleurPrincipale: quartierResult.color
    })
    
    // Afficher le détail des tranches
    quartierResult.data.forEach(tranche => {
      console.log(`  ${tranche.emoji} ${tranche.label}: ${tranche.percentage.toFixed(1)}% (${tranche.count})`)
    })
    
    // Test 2: Vue SU spécifique
    console.log('\n--- Test 2: SU Spécifique (ID 477) ---')
    const suResult = await getDpAgeDistributionTemplateData([477])
    console.log('✅ Résultat SU:', {
      isQuartier: suResult.isQuartier,
      suId: suResult.suId,
      tranches: suResult.data.length,
      totalReponses: suResult.totalResponses,
      sourceData: suResult.dataSource
    })
    
    // Afficher le détail des tranches
    suResult.data.forEach(tranche => {
      console.log(`  ${tranche.emoji} ${tranche.label}: ${tranche.percentage.toFixed(1)}% (${tranche.count})`)
    })
    
    console.log(`\n✅ Tous les tests du ${DATAPACK_NAME} terminés avec succès!`)
    
  } catch (error) {
    console.error(`❌ Échec du test ${DATAPACK_NAME}:`, error)
  }
}

/**
 * Vide le cache (utile pour le développement)
 */
export const clearAgeDistributionTemplateCache = (): void => {
  dataCache.clear()
  cacheTimestamp = 0
  console.log(`🧹 Cache du ${DATAPACK_NAME} vidé`)
}

/**
 * Fonction pour obtenir des statistiques sur les données
 */
export const getAgeDistributionStats = async () => {
  try {
    const [suAnswers, quartierData] = await Promise.all([
      loadSuAnswerData(),
      loadQuartierData()
    ])
    
    const stats = {
      totalIndividualAnswers: suAnswers.length,
      uniqueSUs: new Set(suAnswers.map(a => a["Su ID"])).size,
      quartierDataPoints: quartierData.length,
      ageCategories: new Set(suAnswers.map(a => a["Age Category"]).filter(Boolean)).size
    }
    
    console.log('📊 Statistiques des données âge:', stats)
    return stats
    
  } catch (error) {
    console.error('❌ Erreur lors du calcul des statistiques:', error)
    return null
  }
}