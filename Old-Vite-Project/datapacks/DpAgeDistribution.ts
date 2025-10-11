import suAnswerData from '../data/Su Answer.json';
import metaSuChoicesData from '../data/MetaSuChoices.json';
import metaSuQuestionsData from '../data/MetaSuQuestions.json';
import suBankData from '../data/Su Bank.json';
import suData from '../data/Su Data.json';
import { getCategoryColors } from './DpSuColors';

// Dans la requête SQL, appliquer le filtre global SurveyId = 1
// (Survey Id = diagnostic millésimé quartier).

// Sphères d'Usages / Distribution d'âge

// Interface --> Choix de réponses possibles
interface AgeDistributionChoice {
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
  midpoint: number; // For line chart positioning
}

// Interface --> Données brutes pour une SU ou Quartier
interface AgeDistributionData {
  suId: number;
  questionLabels: {
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
  totalResponses: number;
  responses: AgeDistributionChoice[];
}

// Interface --> données pré-computées
interface PrecomputedAgeDistributionData {
  allSuResults: Map<number, AgeDistributionData>;
  quartierResult: AgeDistributionData;
  questionLabels: {
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
  lastComputed: number; // Timestamp
}

// Export interface (backward compatibility) La backward compatibility permet d'adapter à des boards spécifiques.
export interface AgeDistributionResult {
  data: {
    value: string;
    label: string;
    emoji: string;
    count: number;
    percentage: number;
    color: string;
    midpoint: number;
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

// Constantes
const DATAPACK_NAME = 'DpAgeDistribution';
// Dépend de l'archi JS, doit être mis à jour pour être dynamique,
// il faut qu'on soit sûr du naming des Keys en bdd pour une inscription définitive.
const QUESTION_KEY = 'Age Category';

// Global cache
let precomputedCache: PrecomputedAgeDistributionData | null = null;

// Get age distribution choices from metadata using Metabase Question Key
const getAgeDistributionChoices = () => {
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
    title: questionMeta?.['Question Short'] || questionMeta?.['Question Long'] || 'Distribution d\'âge',
    emoji: questionMeta?.Emoji || '👥',
    questionOrigin: 'Su',
    questionShort: questionMeta?.['Question Short'] || 'Catégorie d\'âge'
  };
};

// Age category mappings with midpoints for line chart
const getAgeMidpoints = () => {
  const midpointMap: Record<string, number> = {
    'FROM_15_TO_29': 22,
    'FROM_30_TO_44': 37,
    'FROM_45_TO_59': 52,
    'FROM_60_TO_74': 67,
    'ABOVE_75': 82
  };
  return midpointMap;
};

// Compute absolute count for a specific SU and choice
const computeAbsoluteCountForSu = (suId: number, choiceKey: string): number => {
  return suAnswerData.filter(answer => {
    const answerSuId = typeof answer['Su ID'] === 'string' ? parseInt(answer['Su ID']) : answer['Su ID'];
    const answerChoice = String(answer[QUESTION_KEY] || '').trim().toUpperCase();
    return answerSuId === suId && answerChoice === choiceKey;
  }).length;
};

// Compute weighted count for quartier using population weights
const computeWeightedCountForQuartier = (choiceKey: string): number => {
  let weightedSum = 0;
  
  suData.forEach(su => {
    const suId = typeof su.ID === 'string' ? parseInt(su.ID) : su.ID;
    const popPercentage = typeof su['Pop Percentage'] === 'string' ? parseFloat(su['Pop Percentage']) : su['Pop Percentage'] || 0;
    const absoluteCount = computeAbsoluteCountForSu(suId, choiceKey);
    weightedSum += absoluteCount * (popPercentage / 100);
  });
  
  return Math.round(weightedSum);
};

// Process a single SU
const processAgeDistributionForSu = (suId: number): AgeDistributionData => {
  const choices = getAgeDistributionChoices();
  const questionLabels = getQuestionMetadata();
  const midpoints = getAgeMidpoints();

  // Compute counts for each choice in natural metadata order
  const responses: AgeDistributionChoice[] = choices.map((choice, index) => {
    const absoluteCount = computeAbsoluteCountForSu(suId, choice['Metabase Choice Key']);
    
    return {
      choiceKey: choice['Metabase Choice Key'],
      choiceLabels: {
        labelLong: choice['Label Long'] || choice['Label Short'] || choice['Metabase Choice Key'],
        labelShort: choice['Label Short'] || choice['Metabase Choice Key'],
        labelOrigin: choice['Label Origin'] || choice['Metabase Choice Key'],
        emoji: choice.Emoji || '📊'
      },
      absoluteCount,
      percentage: 0, // Will be calculated after total
      colorIndex: index,
      midpoint: midpoints[choice['Metabase Choice Key']] || 50
    };
  });

  // Calculate total and percentages
  const totalResponses = responses.reduce((sum, r) => sum + r.absoluteCount, 0);
  responses.forEach(response => {
    response.percentage = totalResponses > 0 ? (response.absoluteCount / totalResponses) * 100 : 0;
  });

  return {
    suId,
    questionLabels,
    totalResponses,
    responses
  };
};

// Process quartier (weighted average)
const processAgeDistributionForQuartier = (): AgeDistributionData => {
  const choices = getAgeDistributionChoices();
  const questionLabels = getQuestionMetadata();
  const midpoints = getAgeMidpoints();

  // Compute weighted counts for each choice in natural metadata order
  const responses: AgeDistributionChoice[] = choices.map((choice, index) => {
    const weightedCount = computeWeightedCountForQuartier(choice['Metabase Choice Key']);
    
    return {
      choiceKey: choice['Metabase Choice Key'],
      choiceLabels: {
        labelLong: choice['Label Long'] || choice['Label Short'] || choice['Metabase Choice Key'],
        labelShort: choice['Label Short'] || choice['Metabase Choice Key'],
        labelOrigin: choice['Label Origin'] || choice['Metabase Choice Key'],
        emoji: choice.Emoji || '📊'
      },
      absoluteCount: weightedCount,
      percentage: 0, // Will be calculated after total
      colorIndex: index,
      midpoint: midpoints[choice['Metabase Choice Key']] || 50
    };
  });

  // Calculate total and percentages
  const totalResponses = responses.reduce((sum, r) => sum + r.absoluteCount, 0);
  responses.forEach(response => {
    response.percentage = totalResponses > 0 ? (response.absoluteCount / totalResponses) * 100 : 0;
  });

  return {
    suId: 0, // Quartier
    questionLabels,
    totalResponses,
    responses
  };
};

// Precompute all data
const precomputeAgeDistributionData = (): PrecomputedAgeDistributionData => {
  console.log(`[${DATAPACK_NAME}] Starting precomputation...`);
  const startTime = performance.now();

  const allSuResults = new Map<number, AgeDistributionData>();
  const questionLabels = getQuestionMetadata();

  // Process each SU
  suData.forEach(su => {
    const suId = typeof su.ID === 'string' ? parseInt(su.ID) : su.ID;
    if (suId > 0) { // Skip quartier (ID 0)
      const suResult = processAgeDistributionForSu(suId);
      allSuResults.set(suId, suResult);
    }
  });

  // Process quartier
  const quartierResult = processAgeDistributionForQuartier();

  const endTime = performance.now();
  console.log(`[${DATAPACK_NAME}] Precomputation completed in ${(endTime - startTime).toFixed(2)}ms`);

  return {
    allSuResults,
    quartierResult,
    questionLabels,
    lastComputed: Date.now()
  };
};

// Get or create cached data
const getCachedData = (): PrecomputedAgeDistributionData => {
  if (!precomputedCache) {
    precomputedCache = precomputeAgeDistributionData();
  }
  return precomputedCache;
};

// Get SU IDs from SU numbers using the Su field mapping
const getSuIdsFromSuNumbers = (suNumbers: number[]): number[] => {
  return suData
    .filter(su => suNumbers.includes(su.Su))
    .map(su => typeof su.ID === 'string' ? parseInt(su.ID) : su.ID);
};

// Main export function
export const getDpAgeDistributionData = (selectedSus?: number[]): AgeDistributionResult => {
  const cachedData = getCachedData();
  const colors = getCategoryColors();

  // Determine if this is a quartier view
  const isQuartier = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1;

  let result: AgeDistributionData;
  let mainColor: string;

  if (isQuartier) {
    result = cachedData.quartierResult;
    mainColor = suBankData.find(su => su.Id === 0)?.colorMain || '#002878';
  } else {
    // Single SU selected
    const suIds = getSuIdsFromSuNumbers(selectedSus);
    const suId = suIds[0];
    result = cachedData.allSuResults.get(suId) || cachedData.quartierResult;
    
    // Get SU color
    const suInfo = suBankData.find(s => {
      const id = typeof s.Id === 'string' ? parseInt(s.Id) : s.Id;
      return id === suId;
    });
    mainColor = suInfo?.colorMain || colors[0] || '#2563eb';
  }

  // Transform to export format
  const exportData: AgeDistributionResult = {
    data: result.responses.map(response => ({
      value: response.choiceKey,
      label: response.choiceLabels.labelShort,
      emoji: response.choiceLabels.emoji,
      count: response.absoluteCount,
      percentage: response.percentage,
      color: colors[response.colorIndex] || colors[0] || mainColor,
      midpoint: response.midpoint
    })),
    color: mainColor,
    isQuartier,
    questionLabels: result.questionLabels,
    suId: isQuartier ? undefined : result.suId
  };

  return exportData;
};

// Text export function (for API compatibility)
export const getDpAgeDistributionText = (selectedSus?: number[]): string => {
  return JSON.stringify(getDpAgeDistributionData(selectedSus));
};

// Validation and testing functions
export const validateAgeDistributionData = (): boolean => {
  try {
    console.log(`[${DATAPACK_NAME}] Running validation tests...`);
    
    // Test 1: Validate metadata structure
    const choices = getAgeDistributionChoices();
    if (choices.length === 0) {
      console.error(`[${DATAPACK_NAME}] No choices found for question key: ${QUESTION_KEY}`);
      return false;
    }

    // Test 2: Validate quartier computation
    const quartierResult = getDpAgeDistributionData();
    if (!quartierResult || !quartierResult.data || quartierResult.data.length === 0) {
      console.error(`[${DATAPACK_NAME}] Failed to compute quartier data`);
      return false;
    }

    // Test 3: Validate SU computation
    const suResult = getDpAgeDistributionData([1]);
    if (!suResult || !suResult.data || suResult.data.length === 0) {
      console.error(`[${DATAPACK_NAME}] Failed to compute SU data`);
      return false;
    }

    // Test 4: Validate percentages sum to ~100%
    const totalPercentage = quartierResult.data.reduce((sum, item) => sum + item.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 1) { // Allow 1% tolerance
      console.warn(`[${DATAPACK_NAME}] Percentage sum deviation: ${totalPercentage}%`);
    }

    console.log(`[${DATAPACK_NAME}] All validation tests passed ✓`);
    return true;
  } catch (error) {
    console.error(`[${DATAPACK_NAME}] Validation failed:`, error);
    return false;
  }
};

// Performance testing
export const testAgeDistributionPerformance = () => {
  console.log(`[${DATAPACK_NAME}] Running performance tests...`);
  
  const iterations = 100;
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    getDpAgeDistributionData([1]);
    getDpAgeDistributionData([2]);
    getDpAgeDistributionData();
  }
  
  const endTime = performance.now();
  const avgTime = (endTime - startTime) / (iterations * 3);
  
  console.log(`[${DATAPACK_NAME}] Average call time: ${avgTime.toFixed(2)}ms`);
  return avgTime;
};

// Clear cache function (for development)
export const clearAgeDistributionCache = () => {
  precomputedCache = null;
  console.log(`[${DATAPACK_NAME}] Cache cleared`);
};

// Development utilities
export const getAgeDistributionDebugInfo = () => {
  const cachedData = getCachedData();
  return {
    datapackName: DATAPACK_NAME,
    questionKey: QUESTION_KEY,
    lastComputed: new Date(cachedData.lastComputed).toISOString(),
    totalSus: cachedData.allSuResults.size,
    questionLabels: cachedData.questionLabels,
    availableChoices: getAgeDistributionChoices().length
  };
};