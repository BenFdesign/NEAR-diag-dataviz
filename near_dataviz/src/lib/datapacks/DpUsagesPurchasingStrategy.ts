// DpUsagesPurchasingStrategy - Stratégie d'achat
// Adapté pour le projet NEAR-diag-dataviz

// Import des données depuis le répertoire public
import suAnswerDataImport from '../../../public/data/Su Answer.json'
import metaSuQuestionsDataImport from '../../../public/data/MetaSuQuestions.json'
import metaSuChoicesDataImport from '../../../public/data/MetaSuChoices.json'
import suDataImport from '../../../public/data/Su Data.json'

// Cast des données avec types appropriés
interface SuAnswer {
  'Su ID': number
  'Purchasing Strategy': string
  // Add other fields as needed from Su Answer.json
}
const suAnswerData = suAnswerDataImport as SuAnswer[]
interface MetaSuQuestion {
  'Metabase Question Key': string
  'Question Short'?: string
  'Question Long'?: string
  Emoji?: string
  // Add other fields as needed from MetaSuQuestions.json
}
const metaSuQuestionsData = metaSuQuestionsDataImport as MetaSuQuestion[]
interface MetaSuChoice {
  'Metabase Question Key': string
  'Metabase Choice Key': string
  'Label Origin'?: string
  'Label Long'?: string
  'Label Short'?: string
  Emoji?: string
  TypeData?: string
  // Add other fields as needed from MetaSuChoices.json
}
const metaSuChoicesData = metaSuChoicesDataImport as MetaSuChoice[]
interface SuDataEntry {
  ID: number
  Su: number
  // Add other fields as needed from Su Data.json
}
const suData = suDataImport as SuDataEntry[]

// ===== INTERFACES =====

interface PurchasingStrategyChoice {
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

interface PurchasingStrategyData {
  suId: number
  questionLabels: {
    title: string
    emoji: string
    questionOrigin: string
    questionShort: string
  }
  totalResponses: number
  responses: PurchasingStrategyChoice[]
}

interface PrecomputedPurchasingStrategyData {
  allSuResults: Map<number, PurchasingStrategyData>
  quartierResult: PurchasingStrategyData
  questionLabels: {
    title: string
    emoji: string
    questionOrigin: string
    questionShort: string
  }
  lastComputed: number
}

export interface PurchasingStrategyResult {
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

const DATAPACK_NAME = 'DpUsagesPurchasingStrategy'
const QUESTION_KEY = 'Purchasing Strategy'

let precomputedCache: PrecomputedPurchasingStrategyData | null = null

// ===== FONCTIONS UTILITAIRES =====

const getPurchasingStrategyChoices = () => {
  return metaSuChoicesData.filter((choice: MetaSuChoice) => 
    choice['Metabase Question Key'] === QUESTION_KEY &&
    choice.TypeData === "CatChoixUnique" &&
    choice['Metabase Choice Key']
  )
}

const getQuestionMetadata = () => {
  const questionMeta = metaSuQuestionsData.find((q: MetaSuQuestion) => q['Metabase Question Key'] === QUESTION_KEY)
  
  return {
    title: questionMeta?.['Question Short'] ?? questionMeta?.['Question Long'] ?? 'Stratégie d\'achat',
    emoji: questionMeta?.Emoji ?? '🛒💶',
    questionOrigin: 'Su',
    questionShort: questionMeta?.['Question Short'] ?? 'Mode d\'achat principal'
  }
}

const getSuIdFromNumber = (suNumber: number): number => {
  const suEntry = suData.find((su: SuDataEntry) => su.Su === suNumber)
  if (suEntry) {
    return suEntry.ID
  }
  
  console.warn(`Local SU number ${suNumber} not found in Su Data`)
  return suNumber
}

// ===== CALCULS =====

const calculatePurchasingStrategyForSu = (suLocalId: number): PurchasingStrategyData => {
  const choices = getPurchasingStrategyChoices()
  const questionLabels = getQuestionMetadata()
  const suAnswers = suAnswerData.filter((answer: SuAnswer) => answer['Su ID'] === suLocalId)
  
  const responses: PurchasingStrategyChoice[] = []
  let totalResponses = 0

  choices.forEach((choice: MetaSuChoice, index: number) => {
    const choiceKey = String(choice['Metabase Choice Key'])
    
    let absoluteCount = 0
    suAnswers.forEach((answer: SuAnswer) => {
      if (answer['Purchasing Strategy'] === choiceKey) {
        absoluteCount++
      }
    })

    totalResponses += absoluteCount

    responses.push({
      choiceKey,
      choiceLabels: {
        labelLong: String(choice['Label Origin'] ?? choice['Label Long'] ?? choiceKey),
        labelShort: String(choice['Label Short'] ?? choice['Label Long'] ?? choiceKey),
        labelOrigin: String(choice['Label Origin'] ?? ''),
        emoji: choice.Emoji ?? '🛒💶'
      },
      absoluteCount,
      percentage: 0,
      colorIndex: index
    })
  })

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

const precomputeAllPurchasingStrategyData = (): PrecomputedPurchasingStrategyData => {
  console.log(`[${new Date().toISOString()}] Starting pre-computation - ${DATAPACK_NAME}`)
  const startTime = performance.now()

  const allSuLocalIds = suData.filter((su: SuDataEntry) => su.ID !== 0).map((su: SuDataEntry) => su.ID)
  const allSuResults = new Map<number, PurchasingStrategyData>()
  const questionLabels = getQuestionMetadata()
  
  allSuLocalIds.forEach((suLocalId: number) => {
    const suResult = calculatePurchasingStrategyForSu(suLocalId)
    allSuResults.set(suLocalId, suResult)
  })

  const choices = getPurchasingStrategyChoices()
  const quartierResponses: PurchasingStrategyChoice[] = []
  let totalQuartierResponses = 0

  choices.forEach((choice: MetaSuChoice, index: number) => {
    const choiceKey = String(choice['Metabase Choice Key'])
    let totalCount = 0

    allSuLocalIds.forEach((suLocalId: number) => {
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
        labelLong: String(choice['Label Origin'] ?? choice['Label Long'] ?? choiceKey),
        labelShort: String(choice['Label Short'] ?? choice['Label Long'] ?? choiceKey),
        labelOrigin: String(choice['Label Origin'] ?? ''),
        emoji: choice.Emoji ?? '🛒💶'
      },
      absoluteCount: totalCount,
      percentage: 0,
      colorIndex: index
    })
  })

  quartierResponses.forEach(response => {
    response.percentage = totalQuartierResponses > 0 
      ? Math.round((response.absoluteCount / totalQuartierResponses) * 1000) / 10
      : 0
  })

  const quartierResult: PurchasingStrategyData = {
    suId: 0,
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

const getPrecomputedData = (): PrecomputedPurchasingStrategyData => {
  precomputedCache ??= precomputeAllPurchasingStrategyData()
  return precomputedCache
}

// ===== FONCTION D'EXPORT PRINCIPALE =====

export function fetchPurchasingStrategyData(selectedSus?: number[]): PurchasingStrategyResult {
  const precomputed = getPrecomputedData()
  
  const isQuartierView = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1
  
  let sourceData: PurchasingStrategyData
  let suId: number | undefined
  
  if (isQuartierView) {
    sourceData = precomputed.quartierResult
    suId = 0
  } else {
    const targetSuLocalId = getSuIdFromNumber(selectedSus[0]!)
    sourceData = precomputed.allSuResults.get(targetSuLocalId) ?? precomputed.quartierResult
    suId = targetSuLocalId
  }
  
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

export function clearPurchasingStrategyCache(): void {
  precomputedCache = null
  console.log(`[${new Date().toISOString()}] Cache cleared - ${DATAPACK_NAME}`)
}

export function runPurchasingStrategyTests(): boolean {
  console.log(`[TEST] Starting tests for ${DATAPACK_NAME}`)
  let allTestsPassed = true
  
  try {
    clearPurchasingStrategyCache()
    const data1 = fetchPurchasingStrategyData()
    console.log('✅ Quartier data loaded:', data1.data.length > 0)

    const data2 = fetchPurchasingStrategyData([1])
    console.log('✅ Single SU data loaded:', data2.data.length > 0)

    const data3 = fetchPurchasingStrategyData([1, 2])
    console.log('✅ Multiple SUs return quartier:', data3.isQuartier)
    
  } catch (error) {
    console.error('❌ PurchasingStrategy test failed:', error)
    allTestsPassed = false
  }
  
  return allTestsPassed
}