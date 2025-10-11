import suBankData from '../data/Su Bank.json';
import suData from '../data/Su Data.json';
import quartiersData from '../data/Quartiers.json';

// Dans la requête SQL, appliquer le filtre global SurveyId = 1
// (Survey Id = diagnostic millésimé quartier).

// Su Title - Informations d'en-tête pour SU sélectionnée ou Quartier

// Interface --> Données pour une SU ou Quartier
interface SuTitleData {
  suId: number;
  suNumber: number | null;
  titleLabels: {
    nameFr: string;
    color: string;
    ornament: string;
    popPercentage: number;
    totalPopulation: number;
  };
  isQuartier: boolean;
}

// Interface --> données pré-computées
interface PrecomputedSuTitleData {
  allSuResults: Map<number, SuTitleData>;
  quartierResult: SuTitleData;
  quartierName: string;
  lastComputed: number; // Timestamp
}

// Export interface (backward compatibility)
export interface SuTitleResult {
  id: string;
  version: string;
  selectedView: {
    suId: number | null;
    suNumber: number | null;
    nameFr: string;
    color: string;
    ornament: string;
    popPercentage: number;
    totalPopulation: number;
  };
  warnings: Array<{
    type: 'missing_fk' | 'missing_data';
    message: string;
    suId?: number;
  }>;
}

// Global cache
let precomputedCache: PrecomputedSuTitleData | null = null;

// Get quartier name from quartiers data
const getQuartierName = (): string => {
  if (quartiersData.length > 0 && quartiersData[0].Name) {
    return quartiersData[0].Name;
  }
  return 'Quartier';
};

// Helper function to get SU IDs from SU numbers
const getSuIdsFromSuNumbers = (suNumbers: number[]): number[] => {
  return suNumbers.map(suNumber => {
    const suRecord = suData.find(su => su.Su === suNumber);
    return suRecord ? (typeof suRecord.ID === 'string' ? parseInt(suRecord.ID) : suRecord.ID) : suNumber + 476;
  });
};

// Get SU info from Su Bank by ID
const getSuInfoFromBank = (suId: number) => {
  const suInfo = suBankData.find(su => {
    const id = typeof su.Id === 'string' ? parseInt(su.Id) : su.Id;
    return id === suId;
  });
  
  if (!suInfo) return null;
  
  return {
    nameFr: suInfo['Name Fr'] || `SU ${suId}`,
    color: suInfo.colorMain || '#666666',
    ornament: suInfo.Ornement || ''
  };
};

// Get population percentage for a SU
const getPopPercentage = (suId: number): number => {
  const suRecord = suData.find(su => {
    const id = typeof su.ID === 'string' ? parseInt(su.ID) : su.ID;
    return id === suId;
  });
  
  if (!suRecord) return 0;
  
  const popPct = typeof suRecord['Pop Percentage'] === 'string' 
    ? parseFloat(suRecord['Pop Percentage']) 
    : suRecord['Pop Percentage'];
    
  return popPct || 0;
};

// Precompute data for SU titles
const precomputeSuTitleData = (): PrecomputedSuTitleData => {
  const quartierName = getQuartierName();
  const allSuResults = new Map<number, SuTitleData>();
  
  // Process each SU individually
  const allSuIds = getSuIdsFromSuNumbers([1, 2, 3]);
  allSuIds.forEach((suId, index) => {
    const suInfo = getSuInfoFromBank(suId);
    const popPercentage = getPopPercentage(suId);
    const suNumber = index + 1; // Su numbers are 1, 2, 3
    
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
      });
    }
  });
  
  // Process quartier
  const quartierInfo = getSuInfoFromBank(0); // Quartier has ID 0
  const quartierResult: SuTitleData = {
    suId: 0,
    suNumber: null,
    titleLabels: {
      nameFr: quartierName,
      color: quartierInfo?.color || '#002878',
      ornament: quartierInfo?.ornament || '',
      popPercentage: 100,
      totalPopulation: 100
    },
    isQuartier: true
  };
  
  return {
    allSuResults,
    quartierResult,
    quartierName,
    lastComputed: Date.now()
  };
};

// Main data retrieval function
const getDpSuTitleData = (selectedSus?: number[]): SuTitleData | null => {
  try {
    // Check if we need to recompute
    if (!precomputedCache || (Date.now() - precomputedCache.lastComputed) > 3600000) {
      precomputedCache = precomputeSuTitleData();
    }
    
    const isQuartier = !selectedSus || selectedSus.length === 0;
    
    if (isQuartier) {
      return precomputedCache.quartierResult;
    } else if (selectedSus.length === 1) {
      const targetSuId = getSuIdsFromSuNumbers([selectedSus[0]])[0];
      const result = precomputedCache.allSuResults.get(targetSuId);
      if (result) {
        return result;
      }
      // Fallback to quartier if SU not found
      console.warn(`SU ${selectedSus[0]} (ID ${targetSuId}) not found, returning quartier data`);
      return precomputedCache.quartierResult;
    } else {
      // Multiple SUs - return quartier as it represents all
      return precomputedCache.quartierResult;
    }
  } catch (error) {
    console.error('Error in getDpSuTitleData:', error);
    return null;
  }
};

// Export function (backward compatibility)
export const getDpSuTitleResult = (selectedSus?: number[]): SuTitleResult => {
  const data = getDpSuTitleData(selectedSus);
  const warnings: SuTitleResult['warnings'] = [];
  
  // Handle null data case
  if (!data) {
    warnings.push({
      type: 'missing_data',
      message: 'Failed to load SU title data'
    });
    
    // Return fallback result
    return {
      id: 'DpSuTitle',
      version: '2.0.0',
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
    };
  }
  
  // Add warnings if needed
  if (data.titleLabels.popPercentage === 0 && !data.isQuartier) {
    warnings.push({
      type: 'missing_data',
      message: `Population percentage not found for SU ${data.suNumber}`,
      suId: data.suId
    });
  }
  
  return {
    id: 'DpSuTitle',
    version: '2.0.0',
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
  };
};

// Export functions
export { getDpSuTitleData };

// Testing and validation functions
export const testDpSuTitle = () => {
  console.log('🧪 Testing DpSuTitle...');
  
  try {
    // Test quartier data
    const quartierResult = getDpSuTitleData();
    if (quartierResult) {
      console.log('✅ Quartier result:', {
        isQuartier: quartierResult.isQuartier,
        nameFr: quartierResult.titleLabels.nameFr,
        popPercentage: quartierResult.titleLabels.popPercentage,
        hasColor: !!quartierResult.titleLabels.color
      });
    } else {
      console.log('❌ Quartier result is null');
    }
    
    // Test single SU
    const singleSuResult = getDpSuTitleData([1]);
    if (singleSuResult) {
      console.log('✅ Single SU result:', {
        suId: singleSuResult.suId,
        suNumber: singleSuResult.suNumber,
        nameFr: singleSuResult.titleLabels.nameFr,
        popPercentage: singleSuResult.titleLabels.popPercentage
      });
    } else {
      console.log('❌ Single SU result is null');
    }
    
    // Test multiple SUs (should return quartier)
    const multipleSuResult = getDpSuTitleData([1, 2]);
    if (multipleSuResult) {
      console.log('✅ Multiple SU result (quartier):', {
        isQuartier: multipleSuResult.isQuartier,
        nameFr: multipleSuResult.titleLabels.nameFr
      });
    } else {
      console.log('❌ Multiple SU result is null');
    }
    
    // Test backward compatibility
    const backwardCompatResult = getDpSuTitleResult([1]);
    console.log('✅ Backward compatibility result:', {
      hasSelectedView: !!backwardCompatResult.selectedView,
      hasValidStructure: backwardCompatResult.id && backwardCompatResult.version,
      warningCount: backwardCompatResult.warnings.length
    });
    
    console.log('✅ All DpSuTitle tests completed!');
  } catch (error) {
    console.error('❌ DpSuTitle test failed:', error);
  }
};

// Export text function for compatibility
export const getDpSuTitleText = (selectedSus?: number[]): string => {
  return JSON.stringify(getDpSuTitleResult(selectedSus), null, 2);
};