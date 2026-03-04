// DpUsages - Agrégateur intelligent des sphères d'usages
// Adapté pour le projet NEAR-diag-dataviz

// Import des datapacks individuels
import { fetchMeatFrequencyData, type MeatFrequencyResult } from './DpUsagesMeatFrequency'
import { fetchTransportationModeData, type TransportationModeResult } from './DpUsagesTransportationMode'
import { fetchDigitalIntensityData, type DigitalIntensityResult } from './DpUsagesDigitalIntensity'  
import { fetchPurchasingStrategyData, type PurchasingStrategyResult } from './DpUsagesPurchasingStrategy'
import { fetchAirTravelFrequencyData, type AirTravelFrequencyResult } from './DpUsagesAirTravelFrequency'
import { fetchHeatSourceData, type HeatSourceResult } from './DpUsagesHeatSource'
import type { DatapackRequest, DatapackResponse, DatapackView } from './contracts'

// ===== INTERFACES =====

// Interface pour les données d'usage unifiées
interface UsageData {
  value: string
  label: string
  emoji: string
  count: number
  percentage: number
}

// Interface pour une question d'usage avec ses données
interface SuUsageQuestion {
  questionKey: string
  questionLabels: {
    title: string
    emoji: string
    questionOrigin: string
    questionShort: string
  }
  data: UsageData[]
  totalResponses: number
  fetchFunction: string
  isQuartier: boolean
  suId?: number
}

// Interface pour les métadonnées des questions
export interface QuestionMetadata {
  id: number
  title: string
  subtitle: string
  key: keyof SuUsagesData
  questionKey: string
  fetchFunction: (selectedSus?: number[]) => Promise<unknown>
}

// Interface d'export principale (backward compatibility)
export interface SuUsagesData {
  meatFrequency: UsageData[]
  transportationMode: UsageData[]
  digitalIntensity: UsageData[]
  purchasingStrategy: UsageData[]
  airTravelFrequency: UsageData[]
  heatSource: UsageData[]
}

// Type utilitaire pour les fonctions de fetch d'usages
type UsageFetchFunction = (selectedSus?: number[]) => Promise<
  | MeatFrequencyResult
  | TransportationModeResult
  | DigitalIntensityResult
  | PurchasingStrategyResult
  | AirTravelFrequencyResult
  | HeatSourceResult
>

interface SuUsagesMappingEntry {
  fetchFunction: UsageFetchFunction
  key: keyof SuUsagesData
}

// ===== CONSTANTES =====

const DATAPACK_NAME = 'DpUsages'

// Mapping des questions Su Usages avec leurs fetch functions
const SU_USAGES_MAPPING: Record<string, SuUsagesMappingEntry> = {
  'Meat Frequency': {
    fetchFunction: fetchMeatFrequencyData as UsageFetchFunction,
    key: 'meatFrequency' as keyof SuUsagesData
  },
  'Transportation Mode': {
    fetchFunction: fetchTransportationModeData as UsageFetchFunction,
    key: 'transportationMode' as keyof SuUsagesData
  },
  'Digital Intensity': {
    fetchFunction: fetchDigitalIntensityData as UsageFetchFunction,
    key: 'digitalIntensity' as keyof SuUsagesData
  },
  'Purchasing Strategy': {
    fetchFunction: fetchPurchasingStrategyData as UsageFetchFunction,
    key: 'purchasingStrategy' as keyof SuUsagesData
  },
  'Air Travel Frequency': {
    fetchFunction: fetchAirTravelFrequencyData as UsageFetchFunction,
    key: 'airTravelFrequency' as keyof SuUsagesData
  },
  'Heat Source': {
    fetchFunction: fetchHeatSourceData as UsageFetchFunction,
    key: 'heatSource' as keyof SuUsagesData
  }
}

// Questions disponibles pour backward compatibility
export const SU_USAGES_QUESTIONS: QuestionMetadata[] = [
  {
    id: 6,
    title: 'Consommation de viande',
    subtitle: 'Repas avec viande / semaine',
    key: 'meatFrequency',
    questionKey: 'Meat Frequency',
    fetchFunction: fetchMeatFrequencyData
  },
  {
    id: 7,
    title: 'Mode de transport',
    subtitle: 'Mobilité quotidienne',
    key: 'transportationMode',
    questionKey: 'Transportation Mode',
    fetchFunction: fetchTransportationModeData
  },
  {
    id: 8,
    title: 'Intensité numérique',
    subtitle: 'Heures d\'écrans / jour',
    key: 'digitalIntensity',
    questionKey: 'Digital Intensity',
    fetchFunction: fetchDigitalIntensityData
  },
  {
    id: 9,
    title: 'Stratégie d\'achat',
    subtitle: 'Mode d\'achat principal',
    key: 'purchasingStrategy',
    questionKey: 'Purchasing Strategy',
    fetchFunction: fetchPurchasingStrategyData
  },
  {
    id: 10,
    title: 'Fréquence de voyage aérien',
    subtitle: 'Vols en avion / An',
    key: 'airTravelFrequency',
    questionKey: 'Air Travel Frequency',
    fetchFunction: fetchAirTravelFrequencyData
  },
  {
    id: 11,
    title: 'Source de chauffage',
    subtitle: 'Mode de chauffage',
    key: 'heatSource',
    questionKey: 'Heat Source',
    fetchFunction: fetchHeatSourceData
  }
]

// ===== FONCTIONS PRINCIPALES =====

// Récupérer les données d'une question spécifique
const getSuUsageData = async (questionKey: string, selectedSus?: number[]): Promise<SuUsageQuestion | null> => {
  const mapping = SU_USAGES_MAPPING[questionKey]
  if (!mapping) {
    console.warn(`Question key "${questionKey}" not found in SU_USAGES_MAPPING`)
    return null
  }

  try {
    const result = await mapping.fetchFunction(selectedSus)
    
    return {
      questionKey,
      questionLabels: result.questionLabels,
      data: result.data,
      totalResponses: result.data.reduce((sum, item) => sum + item.count, 0),
      fetchFunction: mapping.fetchFunction.name,
      isQuartier: result.isQuartier,
      suId: result.suId
    }
  } catch (error) {
    console.error(`Failed to fetch data for ${questionKey}:`, error)
    return null
  }
}

// Récupérer toutes les données d'usage pour les SUs sélectionnées
const getSuUsagesData = async (selectedSus?: number[]): Promise<SuUsageQuestion[]> => {
  const entries = Object.keys(SU_USAGES_MAPPING)

  const results = await Promise.all(
    entries.map(questionKey => getSuUsageData(questionKey, selectedSus))
  )

  return results.filter((d): d is SuUsageQuestion => d !== null)
}

// ===== FONCTION D'EXPORT PRINCIPALE =====

// (backward-compat shape, used internally only)
async function fetchSuUsagesData(selectedSus?: number[]): Promise<SuUsagesData> {
  console.log(`[${new Date().toISOString()}] Fetching SU Usages data - ${DATAPACK_NAME}`)
  const startTime = performance.now()

  const rawData = await getSuUsagesData(selectedSus)
  
  // Transform to expected format
  const result: SuUsagesData = {
    meatFrequency: [],
    transportationMode: [],
    digitalIntensity: [],
    purchasingStrategy: [],
    airTravelFrequency: [],
    heatSource: []
  }
  
  // Map data to expected structure
  rawData.forEach(question => {
    const mapping = SU_USAGES_MAPPING[question.questionKey]
    if (mapping) {
      result[mapping.key] = question.data
    }
  })

  const endTime = performance.now()
  console.log(`[${DATAPACK_NAME}] Data fetching completed in ${(endTime - startTime).toFixed(2)}ms`)
  
  return result
}



// ===== CONTRAT CIBLE =====

export async function getDpUsagesDatapack(
  request: DatapackRequest
): Promise<DatapackResponse<SuUsageQuestion[]>> {
  const { selectedSus, view = 'auto' } = request
  const effectiveSelectedSus = selectedSus ?? []

  const questions = await getSuUsagesData(effectiveSelectedSus)

  const inferredView: DatapackView =
    questions.every(q => q.isQuartier) ? 'quartier' : 'su'
  const effectiveView: DatapackView =
    view === 'auto' ? inferredView : view

  const totalResponses = questions.reduce((sum, q) => sum + q.totalResponses, 0)

  return {
    id: DATAPACK_NAME,
    version: '1.0.0',
    data: questions,
    context: {
      view: effectiveView,
      selectedSus: effectiveSelectedSus,
      resolvedSuIds: undefined,
      isPartial: effectiveSelectedSus.length > 1 && effectiveView === 'su'
    },
    meta: {
      questionCount: questions.length,
      totalResponses
    },
    warnings: questions.length === 0
      ? [{ type: 'NO_DATA', message: 'Aucune donnée d\'usage disponible.' }]
      : undefined,
    errors: undefined
  }
}

