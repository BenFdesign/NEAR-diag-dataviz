import suAnswerData from '../data/Su Answer.json';
import metaSuChoicesData from '../data/MetaSuChoices.json';
import metaSuQuestionsData from '../data/MetaSuQuestions.json';
import suBankData from '../data/Su Bank.json';
import suData from '../data/Su Data.json';
import { getCategoryColors } from './DpSuColors';

// Interface for a single transportation mode choice response
interface TransportationModeChoice {
  choiceKey: string;
  choiceLabels: {
    labelLong: string;
    labelShort: string;
    labelOrigin: string;
    emoji: string;
  };
  absoluteCount: number;
  percentage: number;
  colorIndex: number;
}

// Interface for transportation mode data for a single SU
interface TransportationModeData {
  suId: number;
  questionLabels: {
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
  totalResponses: number;
  responses: TransportationModeChoice[];
}

// Interface for pre-computed data following the standard
interface PrecomputedTransportationModeData {
  allSuResults: Map<number, TransportationModeData>;
  quartierResult: TransportationModeData;
  questionLabels: {
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
  lastComputed: number; // Timestamp
}

// Export interface for backward compatibility
export interface TransportationModeResult {
  data: {
    value: string;
    label: string;
    emoji: string;
    count: number;
    percentage: number;
    color: string;
  }[];
  color: string;
  isQuartier: boolean;
  questionLabels: {
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
  suId?: number;
}

// Constants
const DATAPACK_NAME = 'DpTransportationMode';
const QUESTION_KEY = 'Transportation Mode';

// Global cache
let precomputedCache: PrecomputedTransportationModeData | null = null;

// Get transportation mode choices from metadata using Metabase Question Key
const getTransportationModeChoices = () => {
  return metaSuChoicesData.filter(choice => 
    choice['Metabase Question Key'] === QUESTION_KEY &&
    choice.TypeData === "CatChoixUnique" &&
    choice['Metabase Choice Key']
  );
};

// Get question metadata
const getQuestionMetadata = () => {
  const questionMeta = metaSuQuestionsData.find(q => q['Metabase Question Key'] === QUESTION_KEY);
  
  return {
    title: questionMeta?.['Question Short'] || questionMeta?.['Question Long'] || 'Mode de transport',
    emoji: questionMeta?.Emoji || '🚶‍♂️🚗',
    questionOrigin: 'Su',
    questionShort: questionMeta?.['Question Short'] || 'Mobilité quotidienne'
  };
};

// Helper function for SU ID conversion (correct mapping: local Su → global ID)
const getSuIdFromNumber = (suNumber: number): number => {
  // Find the entry where Su field matches the local number (1, 2, 3)
  // This returns the corresponding global ID (477, 478, 479)
  const suEntry = suData.find(su => su.Su === suNumber);
  if (suEntry) {
    return suEntry.ID; // Return the global UUID (e.g., Su 1 → ID 477)
  }
  
  console.warn(`Local SU number ${suNumber} not found in Su Data`);
  return suNumber; // Fallback
};

// Calculate transportation mode distribution for a specific SU
const calculateTransportationModeForSu = (suLocalId: number): TransportationModeData => {
  const choices = getTransportationModeChoices();
  const questionLabels = getQuestionMetadata();
  const suAnswers = suAnswerData.filter(answer => answer['Su ID'] === suLocalId);
  
  const responses: TransportationModeChoice[] = [];
  let totalResponses = 0;

  // Use natural order from metadata - no hardcoded mapping
  choices.forEach((choice, index) => {
    const choiceKey = String(choice['Metabase Choice Key']);
    
    // Count responses for this choice
    let absoluteCount = 0;
    suAnswers.forEach(answer => {
      const answerValue = answer[QUESTION_KEY];
      if (answerValue === choiceKey) {
        absoluteCount++;
      }
    });

    totalResponses += absoluteCount;

    responses.push({
      choiceKey,
      choiceLabels: {
        labelLong: String(choice['Label Origin'] || choice['Label Long'] || choiceKey),
        labelShort: String(choice['Label Short'] || choice['Label Long'] || choiceKey),
        labelOrigin: String(choice['Label Origin'] || ''),
        emoji: choice.Emoji || '🚶‍♂️🚗'
      },
      absoluteCount,
      percentage: 0, // Will be calculated after we know total
      colorIndex: index // Use natural order from metadata
    });
  });

  // Calculate percentages
  responses.forEach(response => {
    response.percentage = totalResponses > 0 
      ? Math.round((response.absoluteCount / totalResponses) * 1000) / 10 // 1 decimal precision
      : 0;
  });

  // Keep natural order from metadata (no custom sorting)
  // The order is determined by MetaSuChoices.json appearance order

  return {
    suId: suLocalId,
    questionLabels,
    totalResponses,
    responses
  };
};

// Pre-compute all transportation mode data following the established rules
const precomputeAllTransportationModeData = (): PrecomputedTransportationModeData => {
  console.log(`[${new Date().toISOString()}] Starting pre-computation - ${DATAPACK_NAME}`);
  const startTime = performance.now();

  const allSuLocalIds = suData.filter(su => su.ID !== 0).map(su => su.ID);
  const allSuResults = new Map<number, TransportationModeData>();
  const questionLabels = getQuestionMetadata();
  
  // 1. Calculate for each SU individually
  allSuLocalIds.forEach(suLocalId => {
    const suResult = calculateTransportationModeForSu(suLocalId);
    allSuResults.set(suLocalId, suResult);
  });

  // 2. Calculate quartier (weighted average by population)
  const choices = getTransportationModeChoices();
  const quartierResponses: TransportationModeChoice[] = [];
  let totalWeightedResponses = 0;

  // Use natural order from metadata (same as individual SUs)
  choices.forEach((choice, index) => {
    const choiceKey = String(choice['Metabase Choice Key']);
    let totalWeightedCount = 0;

    // Weighted calculation across all SUs using Pop Percentage
    allSuLocalIds.forEach(suLocalId => {
      const suDataEntry = suData.find(sd => sd.ID === suLocalId);
      const popPercentage = suDataEntry ? parseFloat(String(suDataEntry['Pop Percentage'] || '0')) : 0;
      const suAnswers = suAnswerData.filter(answer => answer['Su ID'] === suLocalId);
      
      if (popPercentage > 0 && suAnswers.length > 0) {
        // Count responses for this choice in this SU
        let suChoiceCount = 0;
        suAnswers.forEach(answer => {
          const answerValue = answer[QUESTION_KEY];
          if (answerValue === choiceKey) {
            suChoiceCount++;
          }
        });

        // Apply population weight
        const weight = popPercentage / 100;
        totalWeightedCount += suChoiceCount * weight;
      }
    });

    totalWeightedResponses += totalWeightedCount;

    quartierResponses.push({
      choiceKey,
      choiceLabels: {
        labelLong: String(choice['Label Origin'] || choice['Label Long'] || choiceKey),
        labelShort: String(choice['Label Short'] || choice['Label Long'] || choiceKey),
        labelOrigin: String(choice['Label Origin'] || ''),
        emoji: choice.Emoji || '🚶‍♂️🚗'
      },
      absoluteCount: Math.round(totalWeightedCount),
      percentage: 0, // Will be calculated below
      colorIndex: index // Use natural order from metadata
    });
  });

  // Calculate quartier percentages
  quartierResponses.forEach(response => {
    response.percentage = totalWeightedResponses > 0 
      ? Math.round((response.absoluteCount / totalWeightedResponses) * 1000) / 10
      : 0;
  });

  // Keep natural order from metadata (no custom sorting)
  // The order is determined by MetaSuChoices.json appearance order

  const quartierResult: TransportationModeData = {
    suId: 0, // Quartier ID
    questionLabels,
    totalResponses: Math.round(totalWeightedResponses),
    responses: quartierResponses
  };

  const endTime = performance.now();
  console.log(`[${DATAPACK_NAME}] Pre-computation completed in ${(endTime - startTime).toFixed(2)}ms`);

  return {
    allSuResults,
    quartierResult,
    questionLabels,
    lastComputed: Date.now()
  };
};

// Get cached pre-computed data
const getPrecomputedData = (): PrecomputedTransportationModeData => {
  if (!precomputedCache) {
    precomputedCache = precomputeAllTransportationModeData();
  }
  return precomputedCache;
};

// Main export function following the filtering rules
export function fetchTransportationModeData(selectedSus?: number[]): TransportationModeResult {
  const precomputed = getPrecomputedData();
  
  // Determine view type following the standard rules
  const isQuartierView = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1;
  
  let sourceData: TransportationModeData;
  let suId: number | undefined;
  
  if (isQuartierView) {
    // Use pre-computed quartier data
    sourceData = precomputed.quartierResult;
    suId = 0; // Quartier
  } else {
    // Use pre-computed single SU data
    const targetSuLocalId = getSuIdFromNumber(selectedSus[0]);
    sourceData = precomputed.allSuResults.get(targetSuLocalId) || precomputed.quartierResult;
    suId = targetSuLocalId;
  }
  
  // Get colors for this SU using the centralized color system
  const colors = getCategoryColors(suId || 0);
  const mainColor = suId === 0 
    ? (suBankData.find(su => su.Id === 0)?.colorMain || '#002878')
    : colors[0] || '#2563eb';
  
  // Transform to backward-compatible format
  const transformedData = sourceData.responses.map(response => ({
    value: response.choiceKey,
    label: response.choiceLabels.labelShort,
    emoji: response.choiceLabels.emoji,
    count: response.absoluteCount,
    percentage: response.percentage,
    color: colors[response.colorIndex] || colors[0] || mainColor
  }));

  return {
    data: transformedData,
    color: mainColor,
    isQuartier: isQuartierView,
    questionLabels: sourceData.questionLabels,
    suId
  };
}

// Clear cache function for development debugging
export function clearTransportationModeCache(): void {
  precomputedCache = null;
  console.log(`[${new Date().toISOString()}] Cache cleared - ${DATAPACK_NAME}`);
}

// Test function for validation
export function runTransportationModeTests(): boolean {
  console.log(`[TEST] Starting tests for ${DATAPACK_NAME}`);
  let allTestsPassed = true;
  
  try {
    // Test 1: Cache functionality
    clearTransportationModeCache();
    const data1 = fetchTransportationModeData();
    const data2 = fetchTransportationModeData();
    if (!precomputedCache || data1.data.length !== data2.data.length) {
      console.error('[TEST] Cache not working properly');
      allTestsPassed = false;
    }
    
    // Test 2: Quartier vs SU selection
    const quartierData = fetchTransportationModeData([]);
    const suData = fetchTransportationModeData([1]);
    if (quartierData.isQuartier === suData.isQuartier) {
      console.error('[TEST] Quartier vs SU detection failed');
      allTestsPassed = false;
    }
    
    // Test 3: Data integrity
    if (quartierData.data.length === 0) {
      console.error('[TEST] No data returned');
      allTestsPassed = false;
    }
    
    // Test 4: Percentage validation
    const totalPercentage = quartierData.data.reduce((sum, item) => sum + item.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 1 && totalPercentage > 0) {
      console.warn(`[TEST] Percentages don't sum to 100%: ${totalPercentage}%`);
    }
    
    console.log(`[TEST] ${DATAPACK_NAME} tests ${allTestsPassed ? 'PASSED' : 'FAILED'}`);
  } catch (error) {
    console.error(`[TEST] ${DATAPACK_NAME} tests failed with error:`, error);
    allTestsPassed = false;
  }
  
  return allTestsPassed;
}

// Run tests manually by calling runTransportationModeTests() when needed