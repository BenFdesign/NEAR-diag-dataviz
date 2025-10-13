// DpUsages - Agrégateur intelligent des sphères d'usages
// Adapté pour le projet NEAR-diag-dataviz

// Import des datapacks individuels
import { fetchMeatFrequencyData, type MeatFrequencyResult } from './DpUsagesMeatFrequency'
import { fetchTransportationModeData, type TransportationModeResult } from './DpUsagesTransportationMode'
import { fetchDigitalIntensityData, type DigitalIntensityResult } from './DpUsagesDigitalIntensity'  
import { fetchPurchasingStrategyData, type PurchasingStrategyResult } from './DpUsagesPurchasingStrategy'
import { fetchAirTravelFrequencyData, type AirTravelFrequencyResult } from './DpUsagesAirTravelFrequency'
import { fetchHeatSourceData, type HeatSourceResult } from './DpUsagesHeatSource'

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
  fetchFunction: () => unknown
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

// ===== CONSTANTES =====

const DATAPACK_NAME = 'DpUsages'

// Mapping des questions Su Usages avec leurs fetch functions
const SU_USAGES_MAPPING = {
  'Meat Frequency': {
    fetchFunction: fetchMeatFrequencyData,
    key: 'meatFrequency' as keyof SuUsagesData
  },
  'Transportation Mode': {
    fetchFunction: fetchTransportationModeData,
    key: 'transportationMode' as keyof SuUsagesData
  },
  'Digital Intensity': {
    fetchFunction: fetchDigitalIntensityData,
    key: 'digitalIntensity' as keyof SuUsagesData
  },
  'Purchasing Strategy': {
    fetchFunction: fetchPurchasingStrategyData,
    key: 'purchasingStrategy' as keyof SuUsagesData
  },
  'Air Travel Frequency': {
    fetchFunction: fetchAirTravelFrequencyData,
    key: 'airTravelFrequency' as keyof SuUsagesData
  },
  'Heat Source': {
    fetchFunction: fetchHeatSourceData,
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
const getSuUsageData = (questionKey: string, selectedSus?: number[]): SuUsageQuestion | null => {
  const mapping = SU_USAGES_MAPPING[questionKey as keyof typeof SU_USAGES_MAPPING]
  if (!mapping) {
    console.warn(`Question key "${questionKey}" not found in SU_USAGES_MAPPING`)
    return null
  }

  try {
    const result = mapping.fetchFunction(selectedSus)
    
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
const getSuUsagesData = (selectedSus?: number[]): SuUsageQuestion[] => {
  const results: SuUsageQuestion[] = []
  
  Object.keys(SU_USAGES_MAPPING).forEach(questionKey => {
    const data = getSuUsageData(questionKey, selectedSus)
    if (data) {
      results.push(data)
    }
  })
  
  return results
}

// ===== FONCTION D'EXPORT PRINCIPALE =====

// Export function (backward compatibility)
export function fetchSuUsagesData(selectedSus?: number[]): SuUsagesData {
  console.log(`[${new Date().toISOString()}] Fetching SU Usages data - ${DATAPACK_NAME}`)
  const startTime = performance.now()

  const rawData = getSuUsagesData(selectedSus)
  
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
    const mapping = SU_USAGES_MAPPING[question.questionKey as keyof typeof SU_USAGES_MAPPING]
    if (mapping) {
      result[mapping.key] = question.data
    }
  })

  const endTime = performance.now()
  console.log(`[${DATAPACK_NAME}] Data fetching completed in ${(endTime - startTime).toFixed(2)}ms`)
  
  return result
}

// Fonction pour récupérer les données étendues (non backward compatible)
export function fetchSuUsagesExtendedData(selectedSus?: number[]): SuUsageQuestion[] {
  return getSuUsagesData(selectedSus)
}

// ===== FONCTIONS UTILITAIRES =====

// Testing and validation functions
export const testSuUsages = () => {
  console.log('🧪 Testing DpUsages...')
  
  try {
    // Test quartier data
    const quartierResult = getSuUsagesData()
    console.log('✅ Quartier result:', {
      questionCount: quartierResult.length,
      hasAllQuestions: quartierResult.length === Object.keys(SU_USAGES_MAPPING).length,
      questionsFound: quartierResult.map(q => q.questionKey)
    })
    
    // Test single SU
    const singleSuResult = getSuUsagesData([1])
    console.log('✅ Single SU result:', {
      questionCount: singleSuResult.length,
      hasData: singleSuResult.every(q => q.data.length > 0)
    })
    
    // Test backward compatibility
    const backwardCompatResult = fetchSuUsagesData([1])
    console.log('✅ Backward compatibility result:', {
      hasAllKeys: Object.keys(SU_USAGES_MAPPING).every(key => {
        const mapping = SU_USAGES_MAPPING[key as keyof typeof SU_USAGES_MAPPING]
        return Array.isArray(backwardCompatResult[mapping.key])
      }),
      keysFound: Object.keys(backwardCompatResult)
    })
    
    console.log('✅ All DpUsages tests passed!')
  } catch (error) {
    console.error('❌ DpUsages test failed:', error)
  }
}

// Export des fonctions de test individuelles
export const runAllUsagesTests = () => {
  console.log('🧪 Running all usage datapack tests...')
  
  try {
    // Import des fonctions de test (dynamique pour éviter les erreurs de dépendance)
    const tests = [
      () => import('./DpUsagesMeatFrequency').then(m => m.runMeatFrequencyTests()),
      () => import('./DpUsagesTransportationMode').then(m => m.runTransportationModeTests()),
      () => import('./DpUsagesDigitalIntensity').then(m => m.runDigitalIntensityTests()),
      () => import('./DpUsagesPurchasingStrategy').then(m => m.runPurchasingStrategyTests()),
      () => import('./DpUsagesAirTravelFrequency').then(m => m.runAirTravelFrequencyTests()),
      () => import('./DpUsagesHeatSource').then(m => m.runHeatSourceTests())
    ]
    
    Promise.all(tests.map(test => test())).then(results => {
      const allPassed = results.every(Boolean)
      console.log(allPassed ? '✅ All usage tests passed!' : '❌ Some usage tests failed')
    }).catch(error => {
      console.error('❌ Error running usage datapack tests:', error)
    })
  } catch (error) {
    console.error('❌ Failed to run usage tests:', error)
  }
}