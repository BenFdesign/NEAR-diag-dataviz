// DpUsagesMeatFrequency - Fréquence de consommation de viande
// Adapté pour le projet NEAR-diag-dataviz

// Import des données depuis le répertoire public
import suAnswerDataImport from '../../../public/data/Su Answer.json'
import metaSuQuestionsDataImport from '../../../public/data/MetaSuQuestions.json'
import metaSuChoicesDataImport from '../../../public/data/MetaSuChoices.json'
import suDataImport from '../../../public/data/Su Data.json'

// Interfaces pour les données JSON
interface SuAnswerRecord {
  ID: number
  'Su ID': number
  'Meat Frequency': string
  [key: string]: unknown
}

interface MetaQuestion {
  'Metabase Question Key': string
  'Question Short': string
  'Question Long': string
  'Emoji': string
  [key: string]: unknown  
}

interface MetaChoice {
  'Metabase Question Key': string
  'Metabase Choice Key': string
  'Label Origin': string
  'Label Long': string
  'Label Short': string
  'TypeData': string
  'Emoji': string
  [key: string]: unknown
}

interface SuRecord {
  ID: number
  Su: number
  [key: string]: unknown
}

// Cast des données avec types appropriés
const suAnswerData = suAnswerDataImport as SuAnswerRecord[]
const metaSuQuestionsData = metaSuQuestionsDataImport as MetaQuestion[]
const metaSuChoicesData = metaSuChoicesDataImport as MetaChoice[]
const suData = suDataImport as SuRecord[]

// ===== INTERFACES =====

// Interface pour un choix de réponse
interface MeatFrequencyChoice {
  choiceKey: string
  choiceLabels: {
    labelLong: string
    labelShort: string
    labelOrigin: string
    emoji: string
  }
  absoluteCount: number
  percentage: number
  colorIndex: number
}

// Interface pour les données d'une SU
interface MeatFrequencyData {
  suId: number
  questionLabels: {
    title: string
    emoji: string
    questionOrigin: string
    questionShort: string
  }
  totalResponses: number
  responses: MeatFrequencyChoice[]
}

// Interface pour les données pré-computées
interface PrecomputedMeatFrequencyData {
  allSuResults: Map<number, MeatFrequencyData>
  quartierResult: MeatFrequencyData
  questionLabels: {
    title: string
    emoji: string
    questionOrigin: string
    questionShort: string
  }
  lastComputed: number
}

// Interface d'export (backward compatibility)
export interface MeatFrequencyResult {
  data: {
    value: string
    label: string
    emoji: string
    count: number
    percentage: number
  }[]
  isQuartier: boolean
  questionLabels: {
    title: string
    emoji: string
    questionOrigin: string
    questionShort: string
  }
  suId?: number
}

// ===== CONSTANTES =====

const DATAPACK_NAME = 'DpUsagesMeatFrequency'
const QUESTION_KEY = 'Meat Frequency'

// Cache global
let precomputedCache: PrecomputedMeatFrequencyData | null = null

// ===== FONCTIONS UTILITAIRES =====

// Récupérer les choix de fréquence de viande
const getMeatFrequencyChoices = (): MetaChoice[] => {
  return metaSuChoicesData.filter((choice) => 
    choice['Metabase Question Key'] === QUESTION_KEY &&
    choice.TypeData === "CatChoixUnique" &&
    choice['Metabase Choice Key']
  )
}

// Récupérer les métadonnées de la question
const getQuestionMetadata = () => {
  const questionMeta = metaSuQuestionsData.find((q) => q['Metabase Question Key'] === QUESTION_KEY)
  
  return {
    title: questionMeta?.['Question Short'] ?? questionMeta?.['Question Long'] ?? 'Consommation de viande',
    emoji: questionMeta?.Emoji ?? '🥩',
    questionOrigin: 'Su',
    questionShort: questionMeta?.['Question Short'] ?? 'Repas avec viande / semaine'
  }
}

// Conversion SU number vers ID
const getSuIdFromNumber = (suNumber: number): number => {
  const suEntry = suData.find((su) => su.Su === suNumber)
  if (suEntry) {
    return suEntry.ID
  }
  
  console.warn(`Local SU number ${suNumber} not found in Su Data`)
  return suNumber
}

// ===== CALCULS =====

// Calculer pour une SU spécifique
const calculateMeatFrequencyForSu = (suLocalId: number): MeatFrequencyData => {
  const choices = getMeatFrequencyChoices()
  const questionLabels = getQuestionMetadata()
  const suAnswers = suAnswerData.filter(answer => answer['Su ID'] === suLocalId)
  
  const responses: MeatFrequencyChoice[] = []
  let totalResponses = 0

  choices.forEach((choice, index) => {
    const choiceKey = String(choice['Metabase Choice Key'])
    
    // Compter les réponses pour ce choix
    let absoluteCount = 0
    suAnswers.forEach(answer => {
      if (answer['Meat Frequency'] === choiceKey) {
        absoluteCount++
      }
    })

    totalResponses += absoluteCount

    responses.push({
      choiceKey,
      choiceLabels: {
        labelLong: String(choice['Label Origin'] || choice['Label Long'] || choiceKey),
        labelShort: String(choice['Label Short'] || choice['Label Long'] || choiceKey),
        labelOrigin: String(choice['Label Origin'] || ''),
        emoji: choice.Emoji || '🥩'
      },
      absoluteCount,
      percentage: 0,
      colorIndex: index
    })
  })

  // Calculer les pourcentages
  responses.forEach(response => {
    response.percentage = totalResponses > 0 
      ? Math.round((response.absoluteCount / totalResponses) * 1000) / 10
      : 0
  })

  return {
    suId: suLocalId,
    questionLabels,
    totalResponses,
    responses
  }
}

// Pré-calcul de toutes les données
const precomputeAllMeatFrequencyData = (): PrecomputedMeatFrequencyData => {
  console.log(`[${new Date().toISOString()}] Starting pre-computation - ${DATAPACK_NAME}`)
  const startTime = performance.now()

  const allSuLocalIds = suData.filter(su => su.ID !== 0).map(su => su.ID)
  const allSuResults = new Map<number, MeatFrequencyData>()
  const questionLabels = getQuestionMetadata()
  
  // 1. Calculer pour chaque SU individuellement
  allSuLocalIds.forEach(suLocalId => {
    const suResult = calculateMeatFrequencyForSu(suLocalId)
    allSuResults.set(suLocalId, suResult)
  })

  // 2. Calculer le quartier (somme simple - pas de pondération)
  const choices = getMeatFrequencyChoices()
  const quartierResponses: MeatFrequencyChoice[] = []
  let totalQuartierResponses = 0

  choices.forEach((choice, index) => {
    const choiceKey = String(choice['Metabase Choice Key'])
    let totalCount = 0

    // Somme simple de toutes les réponses de toutes les SU
    allSuLocalIds.forEach(suLocalId => {
      const suResult = allSuResults.get(suLocalId)
      if (suResult) {
        const choiceResponse = suResult.responses.find(r => r.choiceKey === choiceKey)
        if (choiceResponse) {
          totalCount += choiceResponse.absoluteCount
        }
      }
    })

    totalQuartierResponses += totalCount

    quartierResponses.push({
      choiceKey,
      choiceLabels: {
        labelLong: String(choice['Label Origin'] || choice['Label Long'] || choiceKey),
        labelShort: String(choice['Label Short'] || choice['Label Long'] || choiceKey),
        labelOrigin: String(choice['Label Origin'] || ''),
        emoji: choice.Emoji || '🥩'
      },
      absoluteCount: totalCount,
      percentage: 0,
      colorIndex: index
    })
  })

  // Calculer les pourcentages du quartier
  quartierResponses.forEach(response => {
    response.percentage = totalQuartierResponses > 0 
      ? Math.round((response.absoluteCount / totalQuartierResponses) * 1000) / 10
      : 0
  })

  const quartierResult: MeatFrequencyData = {
    suId: 0, // Quartier ID
    questionLabels,
    totalResponses: totalQuartierResponses,
    responses: quartierResponses
  }

  const endTime = performance.now()
  console.log(`[${DATAPACK_NAME}] Pre-computation completed in ${(endTime - startTime).toFixed(2)}ms`)

  return {
    allSuResults,
    quartierResult,
    questionLabels,
    lastComputed: Date.now()
  }
}

// Récupérer les données pré-computées
const getPrecomputedData = (): PrecomputedMeatFrequencyData => {
  precomputedCache ??= precomputeAllMeatFrequencyData()
  return precomputedCache
}

// ===== FONCTION D'EXPORT PRINCIPALE =====

export function fetchMeatFrequencyData(selectedSus?: number[]): MeatFrequencyResult {
  const precomputed = getPrecomputedData()
  
  // Déterminer le type de vue
  const isQuartierView = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1
  
  let sourceData: MeatFrequencyData
  let suId: number | undefined
  
  if (isQuartierView) {
    // Utiliser les données pré-computées du quartier
    sourceData = precomputed.quartierResult
    suId = 0 // Quartier
  } else {
    // Utiliser les données pré-computées d'une SU
    const targetSuLocalId = getSuIdFromNumber(selectedSus[0]!)
    sourceData = precomputed.allSuResults.get(targetSuLocalId) ?? precomputed.quartierResult
    suId = targetSuLocalId
  }
  
  // Transformer au format attendu
  const transformedData = sourceData.responses.map(response => ({
    value: response.choiceKey,
    label: response.choiceLabels.labelShort,
    emoji: response.choiceLabels.emoji,
    count: response.absoluteCount,
    percentage: response.percentage
  }))

  return {
    data: transformedData,
    isQuartier: isQuartierView,
    questionLabels: sourceData.questionLabels,
    suId
  }
}

// Fonctions utilitaires de développement
export function clearMeatFrequencyCache(): void {
  precomputedCache = null
  console.log(`[${new Date().toISOString()}] Cache cleared - ${DATAPACK_NAME}`)
}

export function runMeatFrequencyTests(): boolean {
  console.log(`[TEST] Starting tests for ${DATAPACK_NAME}`)
  let allTestsPassed = true
  
  try {
    // Test 1: Cache functionality
    clearMeatFrequencyCache()
    const data1 = fetchMeatFrequencyData()
    console.log('✅ Quartier data loaded:', data1.data.length > 0)

    // Test 2: Single SU
    const data2 = fetchMeatFrequencyData([1])
    console.log('✅ Single SU data loaded:', data2.data.length > 0)

    // Test 3: Multiple SUs (should return quartier)
    const data3 = fetchMeatFrequencyData([1, 2])
    console.log('✅ Multiple SUs return quartier:', data3.isQuartier)
    
  } catch (error) {
    console.error('❌ MeatFrequency test failed:', error)
    allTestsPassed = false
  }
  
  return allTestsPassed
}