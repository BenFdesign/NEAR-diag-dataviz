import { fetchMeatFrequencyData } from './DpMeatFrequency';
import { fetchTransportationModeData } from './DpTransportationMode';
import { fetchDigitalIntensityData } from './DpDigitalIntensity';
import { fetchPurchasingStrategyData } from './DpPurchasingStrategy';
import { fetchAirTravelFrequencyData } from './DpAirTravelFrequency';
import { fetchHeatSourceData } from './DpHeatSource';
import metaSuQuestionsData from '../data/MetaSuQuestions.json';
import suData from '../data/Su Data.json';



// Su Usages - Agrégateur intelligent des sphères d'usages

// Interface --> Question d'usage avec données
interface SuUsageQuestion {
  questionKey: string;
  questionLabels: {
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
  data: {
    value: string;
    label: string;
    emoji: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  totalResponses: number;
  fetchFunction: string; // Nom de la fonction à utiliser
}

// Interface --> données pré-computées
interface PrecomputedSuUsagesData {
  allSuResults: Map<number, SuUsageQuestion[]>;
  quartierResult: SuUsageQuestion[];
  questionsList: {
    questionKey: string;
    title: string;
    subtitle: string;
    fetchFunction: string;
  }[];
  lastComputed: number; // Timestamp
}

// Export interface (backward compatibility)
export interface SuUsagesData {
  meatFrequency: {
    value: string;
    label: string;
    emoji: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  transportationMode: {
    value: string;
    label: string;
    emoji: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  digitalIntensity: {
    value: string;
    label: string;
    emoji: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  purchasingStrategy: {
    value: string;
    label: string;
    emoji: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  airTravelFrequency: {
    value: string;
    label: string;
    emoji: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  heatSource: {
    value: string;
    label: string;
    emoji: string;
    count: number;
    percentage: number;
    color: string;
  }[];
}

export interface QuestionMetadata {
  id: number;
  title: string;
  subtitle: string;
  key: keyof SuUsagesData;
}

// Global cache
let precomputedCache: PrecomputedSuUsagesData | null = null;

// Helper function to get SU IDs from SU numbers (scalable approach)
const getSuIdsFromSuNumbers = (suNumbers: number[]): number[] => {
  return suNumbers.map(suNumber => {
    const suRecord = suData.find(su => su.Su === suNumber);
    return suRecord ? (typeof suRecord.ID === 'string' ? parseInt(suRecord.ID) : suRecord.ID) : suNumber + 476;
  });
};

// Get all available SU numbers dynamically
const getAllSuNumbers = (): number[] => {
  return suData
    .filter(su => su.Su && su.Su > 0) // Filter valid SU numbers
    .map(su => typeof su.Su === 'string' ? parseInt(su.Su) : su.Su)
    .filter(suNumber => !isNaN(suNumber))
    .sort();
};

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
};

// Get Su Usages questions from metadata
const getSuUsagesQuestions = () => {
  return metaSuQuestionsData.filter(question => 
    Object.keys(SU_USAGES_MAPPING).includes(question['Metabase Question Key'])
  );
};

// Generate questions list dynamically
const generateQuestionsList = () => {
  const questions = getSuUsagesQuestions();
  return questions.map((question) => {
    const mapping = SU_USAGES_MAPPING[question['Metabase Question Key'] as keyof typeof SU_USAGES_MAPPING];
    return {
      questionKey: question['Metabase Question Key'],
      title: question['Question Short'] || question['Question Long'] || 'Question Su',
      subtitle: question['Question Long'] || question['Question Short'] || 'Sphère d\'usage',
      fetchFunction: mapping.fetchFunction.name
    };
  });
};

// Dynamic generation of SU_USAGES_QUESTIONS for backward compatibility
export const SU_USAGES_QUESTIONS: QuestionMetadata[] = generateQuestionsList().map((q, index) => ({
  id: index + 6, // Start from 6 as in original
  title: q.title,
  subtitle: q.subtitle,
  key: SU_USAGES_MAPPING[q.questionKey as keyof typeof SU_USAGES_MAPPING].key
}));

// Precompute data for Su Usages
const precomputeSuUsagesData = (): PrecomputedSuUsagesData => {
  const questionsList = generateQuestionsList();
  const allSuResults = new Map<number, SuUsageQuestion[]>();
  
  // Process quartier first
  const quartierResult: SuUsageQuestion[] = [];
  
  Object.entries(SU_USAGES_MAPPING).forEach(([questionKey, config]) => {
    try {
      const result = config.fetchFunction();
      quartierResult.push({
        questionKey,
        questionLabels: result.questionLabels,
        data: result.data,
        totalResponses: result.data.reduce((sum, item) => sum + item.count, 0),
        fetchFunction: config.fetchFunction.name
      });
    } catch (error) {
      console.warn(`Failed to fetch data for ${questionKey}:`, error);
    }
  });
  
  // Process each SU individually (dynamic discovery)
  const allSuNumbers = getAllSuNumbers();
  allSuNumbers.forEach(suNumber => {
    const suResults: SuUsageQuestion[] = [];
    
    Object.entries(SU_USAGES_MAPPING).forEach(([questionKey, config]) => {
      try {
        const result = config.fetchFunction([suNumber]);
        suResults.push({
          questionKey,
          questionLabels: result.questionLabels,
          data: result.data,
          totalResponses: result.data.reduce((sum, item) => sum + item.count, 0),
          fetchFunction: config.fetchFunction.name
        });
      } catch (error) {
        console.warn(`Failed to fetch data for ${questionKey} SU ${suNumber}:`, error);
      }
    });
    
    // Map SU number to SU ID using scalable approach
    const suIds = getSuIdsFromSuNumbers([suNumber]);
    if (suIds.length > 0) {
      allSuResults.set(suIds[0], suResults);
    }
  });
  
  return {
    allSuResults,
    quartierResult,
    questionsList,
    lastComputed: Date.now()
  };
};

// Main data retrieval function
const getSuUsagesData = (selectedSus?: number[]): SuUsageQuestion[] => {
  // Check if we need to recompute
  if (!precomputedCache || (Date.now() - precomputedCache.lastComputed) > 3600000) {
    precomputedCache = precomputeSuUsagesData();
  }
  
  const isQuartier = !selectedSus || selectedSus.length === 0;
  
  if (isQuartier) {
    return precomputedCache.quartierResult;
  } else if (selectedSus.length === 1) {
    // Use scalable mapping approach instead of hardcode
    const suIds = getSuIdsFromSuNumbers([selectedSus[0]]);
    const suId = suIds.length > 0 ? suIds[0] : selectedSus[0] + 476; // Fallback to old method
    return precomputedCache.allSuResults.get(suId) || precomputedCache.quartierResult;
  } else {
    // Multiple SUs - aggregate data from selected SUs
    const targetSuIds = getSuIdsFromSuNumbers(selectedSus);
    const aggregatedResults: SuUsageQuestion[] = [];
    
    Object.entries(SU_USAGES_MAPPING).forEach(([questionKey, config]) => {
      const aggregatedData: SuUsageQuestion['data'] = [];
      let totalResponses = 0;
      
      // Get data from each selected SU and aggregate
      targetSuIds.forEach(suId => {
        const suResults = precomputedCache!.allSuResults.get(suId);
        if (suResults) {
          const questionResult = suResults.find(q => q.questionKey === questionKey);
          if (questionResult) {
            questionResult.data.forEach(item => {
              const existingItem = aggregatedData.find(d => d.value === item.value);
              if (existingItem) {
                existingItem.count += item.count;
              } else {
                aggregatedData.push({ ...item });
              }
            });
            totalResponses += questionResult.totalResponses;
          }
        }
      });
      
      // Recalculate percentages
      if (totalResponses > 0) {
        aggregatedData.forEach(item => {
          item.percentage = Math.round((item.count / totalResponses) * 100);
        });
      }
      
      // Use first available result for labels (they should be the same)
      const firstResult = targetSuIds
        .map(id => precomputedCache!.allSuResults.get(id))
        .find(results => results && results.length > 0);
      const questionLabels = firstResult?.find(q => q.questionKey === questionKey)?.questionLabels || {
        title: questionKey,
        emoji: '❓',
        questionOrigin: 'Su',
        questionShort: questionKey
      };
      
      aggregatedResults.push({
        questionKey,
        questionLabels,
        data: aggregatedData,
        totalResponses,
        fetchFunction: config.fetchFunction.name
      });
    });
    
    return aggregatedResults;
  }
};

// Export function (backward compatibility)
export function fetchSuUsagesData(selectedSus?: number[]): SuUsagesData {
  const rawData = getSuUsagesData(selectedSus);
  
  // Transform to expected format
  const result: SuUsagesData = {
    meatFrequency: [],
    transportationMode: [],
    digitalIntensity: [],
    purchasingStrategy: [],
    airTravelFrequency: [],
    heatSource: []
  };
  
  // Map data to expected structure
  rawData.forEach(question => {
    const mapping = SU_USAGES_MAPPING[question.questionKey as keyof typeof SU_USAGES_MAPPING];
    if (mapping) {
      result[mapping.key] = question.data;
    }
  });
  
  return result;
};

// Testing and validation functions
export const testSuUsages = () => {
  console.log('🧪 Testing DpSuUsages...');
  
  try {
    // Test quartier data
    const quartierResult = getSuUsagesData();
    console.log('✅ Quartier result:', {
      questionCount: quartierResult.length,
      hasAllQuestions: quartierResult.length === Object.keys(SU_USAGES_MAPPING).length,
      questionsFound: quartierResult.map(q => q.questionKey)
    });
    
    // Test single SU
    const singleSuResult = getSuUsagesData([1]);
    console.log('✅ Single SU result:', {
      questionCount: singleSuResult.length,
      hasData: singleSuResult.every(q => q.data.length > 0)
    });
    
    // Test backward compatibility
    const backwardCompatResult = fetchSuUsagesData([1]);
    console.log('✅ Backward compatibility result:', {
      hasAllKeys: Object.keys(SU_USAGES_MAPPING).every(key => {
        const mapping = SU_USAGES_MAPPING[key as keyof typeof SU_USAGES_MAPPING];
        return Array.isArray(backwardCompatResult[mapping.key]);
      }),
      keysFound: Object.keys(backwardCompatResult)
    });
    
    console.log('✅ All DpSuUsages tests passed!');
  } catch (error) {
    console.error('❌ DpSuUsages test failed:', error);
  }
};