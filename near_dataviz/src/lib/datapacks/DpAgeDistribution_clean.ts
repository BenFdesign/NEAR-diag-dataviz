// Simplified Age Distribution Datapack - Data Only (Colors handled by DpColor)
import { getCacheStatus } from '~/lib/data-loader'

// Export interface - NO COLORS (handled by DpColor)
export interface AgeDistributionResult {
  data: {
    value: string
    label: string
    emoji: string
    count: number
    percentage: number
    midpoint: number
    // ❌ NO color property - handled by Dataviz + DpColor
  }[]
  isQuartier: boolean
  questionLabels: {
    title: string
    emoji: string
    questionOrigin: string
    questionShort: string
  }
  suId?: number
  // ❌ NO color property - handled by Dataviz + DpColor
}

// Constants
const DATAPACK_NAME = 'DpAgeDistribution'

// Client-side cache for computed data
const dataCache = new Map<string, AgeDistributionResult>()
let cacheTimestamp = 0

// Mock age distribution data (for demonstration) - NO COLORS
const getMockAgeData = (isQuartier: boolean): AgeDistributionResult['data'] => {
  const baseData = [
    { key: 'FROM_15_TO_29', label: '15-29 ans', midpoint: 22, quartierPct: 18, suPct: 25 },
    { key: 'FROM_30_TO_44', label: '30-44 ans', midpoint: 37, quartierPct: 32, suPct: 35 },
    { key: 'FROM_45_TO_59', label: '45-59 ans', midpoint: 52, quartierPct: 28, suPct: 22 },
    { key: 'FROM_60_TO_74', label: '60-74 ans', midpoint: 67, quartierPct: 15, suPct: 12 },
    { key: 'ABOVE_75', label: '75+ ans', midpoint: 82, quartierPct: 7, suPct: 6 },
  ]

  return baseData.map((item) => {
    const percentage = isQuartier ? item.quartierPct : item.suPct
    return {
      value: item.key,
      label: item.label,
      emoji: '👥',
      count: Math.round(percentage * 10), // Mock count
      percentage,
      // ❌ NO color property - handled by Dataviz + DpColor
      midpoint: item.midpoint
    }
  })
}

// Main export function with caching
export const getDpAgeDistributionData = async (selectedSus?: number[]): Promise<AgeDistributionResult> => {
  try {
    const cacheKey = JSON.stringify(selectedSus ?? [])
    
    // Check cache (1 hour expiry)
    if (dataCache.has(cacheKey) && (Date.now() - cacheTimestamp) < 3600000) {
      console.log(`✅ Using cached age distribution data`)
      return dataCache.get(cacheKey)!
    }

    console.log(`🔄 Computing age distribution data (mock)...`)
    
    // Determine if this is a quartier view
    const isQuartier = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1
    


    const result: AgeDistributionResult = {
      data: getMockAgeData(isQuartier),
      isQuartier,
      questionLabels: {
        title: 'Distribution d\'âge',
        emoji: '👥',
        questionOrigin: 'Su',
        questionShort: 'Catégorie d\'âge'
      },
      suId: isQuartier ? undefined : selectedSus?.[0]
    }

    // Cache the result
    dataCache.set(cacheKey, result)
    cacheTimestamp = Date.now()
    
    console.log(`✅ Age distribution data computed and cached`)
    return result
    
  } catch (error) {
    console.error(`Error in ${DATAPACK_NAME}:`, error)
    
    // Return fallback data
    return {
      data: getMockAgeData(true),
      isQuartier: true,
      questionLabels: {
        title: 'Distribution d\'âge',
        emoji: '👥',
        questionOrigin: 'Su', 
        questionShort: 'Catégorie d\'âge'
      }
    }
  }
}

// Testing function
export const testDpAgeDistribution = async () => {
  console.log(`🧪 Testing ${DATAPACK_NAME} (mock version)...`)
  
  try {
    // Show cache status
    console.log('📊 Cache status:', getCacheStatus())
    
    // Test quartier data
    const quartierResult = await getDpAgeDistributionData()
    console.log('✅ Quartier result:', {
      isQuartier: quartierResult.isQuartier,
      dataPoints: quartierResult.data.length,
      totalPercentage: quartierResult.data.reduce((sum, item) => sum + item.percentage, 0).toFixed(1)
    })
    
    // Test single SU
    const singleSuResult = await getDpAgeDistributionData([1])
    console.log('✅ Single SU result:', {
      isQuartier: singleSuResult.isQuartier,
      suId: singleSuResult.suId,
      dataPoints: singleSuResult.data.length,
      totalPercentage: singleSuResult.data.reduce((sum, item) => sum + item.percentage, 0).toFixed(1)
    })
    
    console.log('✅ All age distribution tests completed!')
  } catch (error) {
    console.error(`❌ ${DATAPACK_NAME} test failed:`, error)
  }
}

// Clear cache utility (for development)
export const clearAgeDistributionCache = (): void => {
  dataCache.clear()
  cacheTimestamp = 0
  console.log(`🧹 ${DATAPACK_NAME} cache cleared`)
}