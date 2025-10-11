import type { SuBankData, SuData } from '~/lib/types'
import { 
  loadSuBankData, 
  loadSuData, 
  loadQuartiers,
  getCacheStatus 
} from '~/lib/data-loader'

// Interface --> Données pour une SU ou Quartier
interface SuTitleData {
  suId: number
  suNumber: number | null
  titleLabels: {
    nameFr: string
    color: string
    ornament: string
    popPercentage: number
    totalPopulation: number
  }
  isQuartier: boolean
}

// Interface --> données pré-computées avec cache client
interface PrecomputedSuTitleData {
  allSuResults: Map<number, SuTitleData>
  quartierResult: SuTitleData
  quartierName: string
  lastComputed: number // Timestamp
}

// Export interface (backward compatibility)
export interface SuTitleResult {
  id: string
  version: string
  selectedView: {
    suId: number | null
    suNumber: number | null
    nameFr: string
    color: string
    ornament: string
    popPercentage: number
    totalPopulation: number
  }
  warnings: Array<{
    type: 'missing_fk' | 'missing_data'
    message: string
    suId?: number
  }>
}

// Client-side cache for computed data (in addition to raw data cache)
let precomputedCache: PrecomputedSuTitleData | null = null

// Get quartier name from quartiers data
const getQuartierName = async (): Promise<string> => {
  try {
    const quartiers = await loadQuartiers()
    const firstQuartier = quartiers[0]
    if (firstQuartier && typeof firstQuartier === 'object' && 'Name' in firstQuartier && firstQuartier.Name) {
      return typeof firstQuartier.Name === 'string' ? firstQuartier.Name : 'Quartier'
    }
    return 'Quartier'
  } catch (error) {
    console.error('Error loading quartier name:', error)
    return 'Quartier'
  }
}

// Helper function to get SU info from Su Bank by ID
const getSuInfoFromBank = (bankData: SuBankData[], suId: number) => {
  const suInfo = bankData.find((su) => su.Id === suId)
  
  if (!suInfo) return null
  
  return {
    nameFr: suInfo['Name Fr'] ?? `SU ${suId}`,
    color: suInfo.colorMain ?? '#666666',
    ornament: suInfo.Ornement ?? ''
  }
}

// Get population percentage for a SU
const getPopPercentage = (suDataArray: SuData[], suId: number): number => {
  const suRecord = suDataArray.find((su) => su.ID === suId)
  
  if (!suRecord) return 0
  
  const popPct = typeof suRecord['Pop Percentage'] === 'string' 
    ? parseFloat(suRecord['Pop Percentage']) 
    : Number(suRecord['Pop Percentage'])
    
  return popPct || 0
}

// Helper function to get SU IDs from SU numbers
const getSuIdsFromSuNumbers = (suDataArray: SuData[], suNumbers: number[]): number[] => {
  return suNumbers.map(suNumber => {
    const suRecord = suDataArray.find((su) => su.Su === suNumber)  
    return suRecord ? suRecord.ID : suNumber + 476
  })
}

// Precompute data for SU titles with async data loading
const precomputeSuTitleData = async (): Promise<PrecomputedSuTitleData> => {
  // Load all required data (will use cache if available)
  const [bankData, suDataArray, quartierName] = await Promise.all([
    loadSuBankData(),
    loadSuData(),
    getQuartierName()
  ])
  
  const allSuResults = new Map<number, SuTitleData>()
  
  // Get all available SU numbers from the data
  const availableSuNumbers = [...new Set(suDataArray.map((su) => su.Su))].sort((a: number, b: number) => a - b)
  
  // Process each SU individually
  const allSuIds = getSuIdsFromSuNumbers(suDataArray, availableSuNumbers)
  allSuIds.forEach((suId, index) => {
    const suInfo = getSuInfoFromBank(bankData, suId)
    const popPercentage = getPopPercentage(suDataArray, suId)
    const suNumber = availableSuNumbers[index] ?? null // Use actual Su number from data
    
    if (suInfo) {
      allSuResults.set(suId, {
        suId,
        suNumber,
        titleLabels: {
          nameFr: suInfo.nameFr,
          color: suInfo.color,
          ornament: suInfo.ornament,
          popPercentage,
          totalPopulation: 100
        },
        isQuartier: false
      })
    }
  })
  
  // Process quartier - use a special approach for quartier data
  const quartierResult: SuTitleData = {
    suId: 0,
    suNumber: null,
    titleLabels: {
      nameFr: quartierName,
      color: '#002878', 
      ornament: '',
      popPercentage: 100,
      totalPopulation: 100
    },
    isQuartier: true
  }
  
  return {
    allSuResults,
    quartierResult,
    quartierName,
    lastComputed: Date.now()
  }
}

// Main data retrieval function with caching
const getDpSuTitleData = async (selectedSus?: number[]): Promise<SuTitleData | null> => {
  try {
    // Check if we need to recompute (cache for 1 hour or if data not cached)
    if (!precomputedCache || (Date.now() - precomputedCache.lastComputed) > 3600000) {
      console.log('🔄 Computing SU title data (cache miss or expired)...')
      precomputedCache = await precomputeSuTitleData()
      console.log('✅ SU title data computed and cached')
    } else {
      console.log('✅ Using cached SU title data')
    }
    
    const isQuartier = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1
    
    if (isQuartier) {
      return precomputedCache.quartierResult
    } else if (selectedSus.length === 1) {
      // For single SU, find the corresponding data
      const targetSuNumber = selectedSus[0]!
      const suDataArray = await loadSuData() // This will use cache
      const targetSuId = getSuIdsFromSuNumbers(suDataArray, [targetSuNumber])[0]!
      
      const result = precomputedCache.allSuResults.get(targetSuId)
      if (result) {
        return result
      }
      // Fallback to quartier if SU not found
      console.warn(`SU ${targetSuNumber} (ID ${targetSuId}) not found, returning quartier data`)
      return precomputedCache.quartierResult
    } else {
      // Multiple SUs - return quartier as it represents all
      return precomputedCache.quartierResult
    }
  } catch (error) {
    console.error('Error in getDpSuTitleData:', error)
    return null
  }
}

// Export function (backward compatibility) 
export const getDpSuTitleResult = async (selectedSus?: number[]): Promise<SuTitleResult> => {
  const data = await getDpSuTitleData(selectedSus)
  const warnings: SuTitleResult['warnings'] = []
  
  // Handle null data case
  if (!data) {
    warnings.push({
      type: 'missing_data',
      message: 'Failed to load SU title data'
    })
    
    // Return fallback result
    return {
      id: 'DpSuTitle',
      version: '2.0.0-async',
      selectedView: {
        suId: null,
        suNumber: null,
        nameFr: 'Erreur de chargement',
        color: '#666666',
        ornament: '',
        popPercentage: 0,
        totalPopulation: 100
      },
      warnings
    }
  }
  
  // Add warnings if needed
  if (data.titleLabels.popPercentage === 0 && !data.isQuartier) {
    warnings.push({
      type: 'missing_data',
      message: `Population percentage not found for SU ${data.suNumber}`,
      suId: data.suId
    })
  }
  
  return {
    id: 'DpSuTitle',
    version: '2.0.0-async',
    selectedView: {
      suId: data.isQuartier ? null : data.suId,
      suNumber: data.suNumber,
      nameFr: data.titleLabels.nameFr,
      color: data.titleLabels.color,
      ornament: data.titleLabels.ornament,
      popPercentage: data.titleLabels.popPercentage,
      totalPopulation: data.titleLabels.totalPopulation
    },
    warnings
  }
}

// Export functions
export { getDpSuTitleData }

// Testing and validation functions
export const testDpSuTitle = async () => {
  console.log('🧪 Testing DpSuTitle (async version)...')
  
  try {
    // Show cache status
    console.log('📊 Cache status:', getCacheStatus())
    
    // Test quartier data
    const quartierResult = await getDpSuTitleData()
    if (quartierResult) {
      console.log('✅ Quartier result:', {
        isQuartier: quartierResult.isQuartier,
        nameFr: quartierResult.titleLabels.nameFr,
        popPercentage: quartierResult.titleLabels.popPercentage,
        hasColor: !!quartierResult.titleLabels.color
      })
    } else {
      console.log('❌ Quartier result is null')
    }
    
    // Test single SU
    const singleSuResult = await getDpSuTitleData([1])
    if (singleSuResult) {
      console.log('✅ Single SU result:', {
        suId: singleSuResult.suId,
        suNumber: singleSuResult.suNumber,
        nameFr: singleSuResult.titleLabels.nameFr,
        popPercentage: singleSuResult.titleLabels.popPercentage
      })
    } else {
      console.log('❌ Single SU result is null')
    }
    
    // Test multiple SUs (should return quartier)
    const multipleSuResult = await getDpSuTitleData([1, 2])
    if (multipleSuResult) {
      console.log('✅ Multiple SU result (quartier):', {
        isQuartier: multipleSuResult.isQuartier,
        nameFr: multipleSuResult.titleLabels.nameFr
      })
    } else {
      console.log('❌ Multiple SU result is null')
    }
    
    // Test backward compatibility
    const backwardCompatResult = await getDpSuTitleResult([1])
    console.log('✅ Backward compatibility result:', {
      hasSelectedView: !!backwardCompatResult.selectedView,
      hasValidStructure: backwardCompatResult.id && backwardCompatResult.version,
      warningCount: backwardCompatResult.warnings.length,
      version: backwardCompatResult.version
    })
    
    console.log('✅ All DpSuTitle tests completed!')
  } catch (error) {
    console.error('❌ DpSuTitle test failed:', error)
  }
}

// Export text function for compatibility
export const getDpSuTitleText = async (selectedSus?: number[]): Promise<string> => {
  const result = await getDpSuTitleResult(selectedSus)
  return JSON.stringify(result, null, 2)
}

// Clear cache utility (for development)
export const clearSuTitleCache = (): void => {
  precomputedCache = null
  console.log('🧹 SU title cache cleared')
}