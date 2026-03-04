// DpUsagesHeatSource - Source de chauffage
// Adapté pour le projet NEAR-diag-dataviz

// Import des données via le data-loader (API /api/data)
import { loadSuAnswer, loadMetaSuQuestions, loadMetaSuChoices, loadSuDataForCurrentSurvey } from '~/lib/data-loader'
import type { DatapackRequest, DatapackResponse } from '~/lib/datapacks/contracts'

// Interfaces pour les données JSON
interface SuAnswerRecord {
  ID: number
  'Su ID': number
  'Heat Source': string
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

// Les données sont désormais chargées via data-loader, voir getPrecomputedData

// ===== INTERFACES =====

interface HeatSourceChoice {
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

interface HeatSourceData {
  suId: number
  questionLabels: {
    title: string
    emoji: string
    questionOrigin: string
    questionShort: string
  }
  totalResponses: number
  responses: HeatSourceChoice[]
}

interface PrecomputedHeatSourceData {
  allSuResults: Map<number, HeatSourceData>
  quartierResult: HeatSourceData
  questionLabels: {
    title: string
    emoji: string
    questionOrigin: string
    questionShort: string
  }
  lastComputed: number
}

export interface HeatSourceResult {
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

const DATAPACK_NAME = 'DpUsagesHeatSource'
const QUESTION_KEY = 'Heat Source'

let precomputedCache: PrecomputedHeatSourceData | null = null
let cachedSuData: SuRecord[] | null = null

// ===== FONCTIONS UTILITAIRES =====

const getHeatSourceChoices = (metaSuChoicesData: MetaChoice[]): MetaChoice[] => {
  return metaSuChoicesData.filter((choice) => 
    choice['Metabase Question Key'] === QUESTION_KEY &&
    choice.TypeData === "CatChoixUnique" &&
    choice['Metabase Choice Key']
  )
}

const getQuestionMetadata = (metaSuQuestionsData: MetaQuestion[]) => {
  const questionMeta = metaSuQuestionsData.find((q) => q['Metabase Question Key'] === QUESTION_KEY)
  
  return {
    title: questionMeta?.['Question Short'] ?? questionMeta?.['Question Long'] ?? 'Source de chauffage',
    emoji: questionMeta?.Emoji ?? '🏘️♨️',
    questionOrigin: 'Su',
    questionShort: questionMeta?.['Question Short'] ?? 'Mode de chauffage'
  }
}

const getSuIdFromNumber = (suNumber: number): number => {
  const suEntry = cachedSuData?.find((su) => su.Su === suNumber)
  if (suEntry) {
    return suEntry.ID
  }
  
  console.warn(`Local SU number ${suNumber} not found in Su Data`)
  return suNumber
}

// ===== CALCULS =====

const calculateHeatSourceForSu = (
  suAnswerData: SuAnswerRecord[],
  metaSuQuestionsData: MetaQuestion[],
  metaSuChoicesData: MetaChoice[],
  suLocalId: number
): HeatSourceData => {
  const choices = getHeatSourceChoices(metaSuChoicesData)
  const questionLabels = getQuestionMetadata(metaSuQuestionsData)
  const suAnswers = suAnswerData.filter((answer) => answer['Su ID'] === suLocalId)
  
  const responses: HeatSourceChoice[] = []
  let totalResponses = 0

  choices.forEach((choice, index: number) => {
    const choiceKey = String(choice['Metabase Choice Key'])
    
    let absoluteCount = 0
    suAnswers.forEach((answer) => {
      if (answer['Heat Source'] === choiceKey) {
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
        emoji: String(choice.Emoji ?? '🏘️♨️')
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

const precomputeAllHeatSourceData = (
  suAnswerData: SuAnswerRecord[],
  metaSuQuestionsData: MetaQuestion[],
  metaSuChoicesData: MetaChoice[],
  suData: SuRecord[]
): PrecomputedHeatSourceData => {
  console.log(`[${new Date().toISOString()}] Starting pre-computation - ${DATAPACK_NAME}`)
  const startTime = performance.now()

  const allSuLocalIds = suData.filter((su) => su.ID !== 0).map((su) => su.ID)
  const allSuResults = new Map<number, HeatSourceData>()
  const questionLabels = getQuestionMetadata(metaSuQuestionsData)
  
  allSuLocalIds.forEach((suLocalId: number) => {
    const suResult = calculateHeatSourceForSu(
      suAnswerData,
      metaSuQuestionsData,
      metaSuChoicesData,
      suLocalId
    )
    allSuResults.set(suLocalId, suResult)
  })

  const choices = getHeatSourceChoices(metaSuChoicesData)
  const quartierResponses: HeatSourceChoice[] = []
  let totalQuartierResponses = 0

  choices.forEach((choice, index: number) => {
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
        emoji: String(choice.Emoji ?? '🏘️♨️')
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

  const quartierResult: HeatSourceData = {
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

const getPrecomputedData = async (): Promise<PrecomputedHeatSourceData> => {
  if (precomputedCache) return precomputedCache

  // 1. Charger les données Su (Su Data + Su Answer)
  const [suDataRaw, suAnswerRaw] = await Promise.all([
    loadSuDataForCurrentSurvey(),
    loadSuAnswer()
  ])

  // 2. Une fois les données Su prêtes, charger les métadonnées non-Su
  const [metaSuQuestionsRaw, metaSuChoicesRaw] = await Promise.all([
    loadMetaSuQuestions(),
    loadMetaSuChoices()
  ])

  const suData = suDataRaw as SuRecord[]
  const suAnswerData = suAnswerRaw as SuAnswerRecord[]
  const metaSuQuestionsData = metaSuQuestionsRaw as MetaQuestion[]
  const metaSuChoicesData = metaSuChoicesRaw as MetaChoice[]

  cachedSuData = suData

  precomputedCache = precomputeAllHeatSourceData(
    suAnswerData,
    metaSuQuestionsData,
    metaSuChoicesData,
    suData
  )

  return precomputedCache
}

// ===== FONCTION D'EXPORT PRINCIPALE =====

export async function fetchHeatSourceData(selectedSus?: number[]): Promise<HeatSourceResult> {
  const precomputed = await getPrecomputedData()
  
  const isQuartierView = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1
  
  let sourceData: HeatSourceData
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

export function clearHeatSourceCache(): void {
  precomputedCache = null
  console.log(`[${new Date().toISOString()}] Cache cleared - ${DATAPACK_NAME}`)
}

// ===== CONTRAT DATAPACK STANDARDISÉ =====

export async function getDpUsagesHeatSourceDatapack(
  request: DatapackRequest
): Promise<DatapackResponse<HeatSourceResult>> {
  const selectedSus = request.selectedSus

  const result = await fetchHeatSourceData(selectedSus)

  const isQuartier = result.isQuartier
  const view: 'su' | 'quartier' = isQuartier ? 'quartier' : 'su'

  const context = {
    view,
    selectedSus: selectedSus ?? [],
    resolvedSuIds: isQuartier ? undefined : (result.suId !== undefined ? [result.suId] : undefined),
    isPartial: false
  }

  const response: DatapackResponse<HeatSourceResult> = {
    id: DATAPACK_NAME,
    version: '1.0.0',
    data: result,
    context,
    meta: {
      totalResponses: result.data.reduce((sum, r) => sum + r.count, 0),
      choicesCount: result.data.length
    }
  }

  return response
}