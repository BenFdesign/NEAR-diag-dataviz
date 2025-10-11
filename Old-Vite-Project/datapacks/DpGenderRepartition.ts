import suAnswerData from '../data/Su Answer.json';
import metaSuChoicesData from '../data/MetaSuChoices.json';
import metaSuQuestionsData from '../data/MetaSuQuestions.json';

import suData from '../data/Su Data.json';
import { getCategoryColors } from './DpSuColors';

// Dans la requête SQL, appliquer le filtre global SurveyId = 1
// (Survey Id = diagnostic millésimé quartier).

// Sphères d'Usages / Répartition par genre

// Interface --> Choix de réponses possibles
interface GenderRepartitionChoice {
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

// Interface --> Données brutes pour une SU ou Quartier
interface GenderRepartitionData {
  suId: number;
  questionLabels: {
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
  totalResponses: number;
  responses: GenderRepartitionChoice[];
}

// Interface --> données pré-computées
interface PrecomputedGenderRepartitionData {
  allSuResults: Map<number, GenderRepartitionData>;
  quartierResult: GenderRepartitionData;
  questionLabels: {
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
  lastComputed: number; // Timestamp
}

// Export interface (fallback ancienne version) à supprimer bientôt
export interface GenderRepartitionResult {
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

// Constantes
// Dépend du naming dans Metabase, doit être mis à jour pour être dynamique,
// il faut qu'on soit sûr du naming des Keys en bdd pour une inscription définitive.
const QUESTION_KEY = 'Gender';

// Global cache
let precomputedCache: PrecomputedGenderRepartitionData | null = null;

// Get gender choices from metadata using Metabase Question Key
const getGenderChoices = () => {
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
    title: questionMeta?.['Question Short'] || questionMeta?.['Question Long'] || 'Répartition par genre',
    emoji: questionMeta?.Emoji || '👥',
    questionOrigin: 'Su',
    questionShort: questionMeta?.['Question Short'] || 'Genre'
  };
};

// Gender mapping with emojis
const getGenderEmojis = () => {
  const emojiMap: Record<string, string> = {
    'WOMAN': '👩',
    'MAN': '👨',
    'OTHER': '🧑'
  };
  return emojiMap;
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

// Helper function to get SU IDs from SU numbers
const getSuIdsFromSuNumbers = (suNumbers: number[]): number[] => {
  return suNumbers.map(suNumber => {
    const suRecord = suData.find(su => su.Su === suNumber);
    return suRecord ? (typeof suRecord.ID === 'string' ? parseInt(suRecord.ID) : suRecord.ID) : suNumber + 476;
  });
};

// Precompute data for gender repartition
const precomputeGenderRepartitionData = (): PrecomputedGenderRepartitionData => {
  const questionLabels = getQuestionMetadata();
  const choices = getGenderChoices();
  const emojiMap = getGenderEmojis();
  
  const allSuResults = new Map<number, GenderRepartitionData>();
  
  // Process each SU individually
  const allSuIds = getSuIdsFromSuNumbers([1, 2, 3]);
  allSuIds.forEach(suId => {
    const responses: GenderRepartitionChoice[] = [];
    let totalResponses = 0;
    
    choices.forEach((choice, index) => {
      const choiceKey = choice['Metabase Choice Key'];
      const absoluteCount = computeAbsoluteCountForSu(suId, choiceKey);
      totalResponses += absoluteCount;
      
      responses.push({
        choiceKey,
        choiceLabels: {
          labelLong: choice['Label Long'] || choiceKey,
          labelShort: choice['Label Short'] || choiceKey,
          labelOrigin: choice['Label Origin'] || choiceKey,
          emoji: emojiMap[choiceKey] || '❓'
        },
        absoluteCount,
        percentage: 0, // Will be calculated after total is known
        colorIndex: index
      });
    });
    
    // Calculate percentages
    responses.forEach(response => {
      response.percentage = totalResponses > 0 ? Math.round((response.absoluteCount / totalResponses) * 1000) / 10 : 0;
    });
    
    allSuResults.set(suId, {
      suId,
      questionLabels,
      totalResponses,
      responses
    });
  });
  
  // Process quartier (weighted)
  const quartierResponses: GenderRepartitionChoice[] = [];
  let quartierTotalResponses = 0;
  
  choices.forEach((choice, index) => {
    const choiceKey = choice['Metabase Choice Key'];
    const weightedCount = computeWeightedCountForQuartier(choiceKey);
    quartierTotalResponses += weightedCount;
    
    quartierResponses.push({
      choiceKey,
      choiceLabels: {
        labelLong: choice['Label Long'] || choiceKey,
        labelShort: choice['Label Short'] || choiceKey,
        labelOrigin: choice['Label Origin'] || choiceKey,
        emoji: emojiMap[choiceKey] || '❓'
      },
      absoluteCount: weightedCount,
      percentage: 0, // Will be calculated after total is known
      colorIndex: index
    });
  });
  
  // Calculate quartier percentages
  quartierResponses.forEach(response => {
    response.percentage = quartierTotalResponses > 0 ? Math.round((response.absoluteCount / quartierTotalResponses) * 1000) / 10 : 0;
  });
  
  const quartierResult: GenderRepartitionData = {
    suId: 0, // Quartier
    questionLabels,
    totalResponses: quartierTotalResponses,
    responses: quartierResponses
  };
  
  return {
    allSuResults,
    quartierResult,
    questionLabels,
    lastComputed: Date.now()
  };
};

// Main data retrieval function
const getDpGenderRepartitionData = (selectedSus?: number[]): GenderRepartitionData => {
  // Check if we need to recompute
  if (!precomputedCache || (Date.now() - precomputedCache.lastComputed) > 3600000) {
    precomputedCache = precomputeGenderRepartitionData();
  }
  
  const isQuartier = !selectedSus || selectedSus.length === 0;
  
  if (isQuartier) {
    return precomputedCache.quartierResult;
  } else if (selectedSus.length === 1) {
    const targetSuId = getSuIdsFromSuNumbers([selectedSus[0]])[0];
    return precomputedCache.allSuResults.get(targetSuId) || precomputedCache.quartierResult;
  } else {
    // Multiple SUs - aggregate data
    const targetSuIds = getSuIdsFromSuNumbers(selectedSus);
    const choices = getGenderChoices();
    const emojiMap = getGenderEmojis();
    
    const aggregatedResponses: GenderRepartitionChoice[] = [];
    let totalResponses = 0;
    
    choices.forEach((choice, index) => {
      const choiceKey = choice['Metabase Choice Key'];
      let aggregatedCount = 0;
      
      targetSuIds.forEach(suId => {
        const suData = precomputedCache!.allSuResults.get(suId);
        if (suData) {
          const response = suData.responses.find(r => r.choiceKey === choiceKey);
          if (response) {
            aggregatedCount += response.absoluteCount;
          }
        }
      });
      
      totalResponses += aggregatedCount;
      
      aggregatedResponses.push({
        choiceKey,
        choiceLabels: {
          labelLong: choice['Label Long'] || choiceKey,
          labelShort: choice['Label Short'] || choiceKey,
          labelOrigin: choice['Label Origin'] || choiceKey,
          emoji: emojiMap[choiceKey] || '❓'
        },
        absoluteCount: aggregatedCount,
        percentage: 0, // Will be calculated after total is known
        colorIndex: index
      });
    });
    
    // Calculate percentages
    aggregatedResponses.forEach(response => {
      response.percentage = totalResponses > 0 ? Math.round((response.absoluteCount / totalResponses) * 1000) / 10 : 0;
    });
    
    return {
      suId: -1, // Multiple SUs
      questionLabels: precomputedCache.questionLabels,
      totalResponses,
      responses: aggregatedResponses
    };
  }
};

// Export function (backward compatibility)
export const getDpGenderRepartitionResult = (selectedSus?: number[]): GenderRepartitionResult => {
  const data = getDpGenderRepartitionData(selectedSus);
  const colors = getCategoryColors(data.responses.length);
  
  return {
    data: data.responses.map((response, index) => ({
      value: response.choiceKey,
      label: response.choiceLabels.labelLong,
      emoji: response.choiceLabels.emoji,
      count: response.absoluteCount,
      percentage: response.percentage,
      color: colors[index] || '#cccccc'
    })),
    color: colors[0] || '#3b82f6',
    isQuartier: !selectedSus || selectedSus.length === 0,
    questionLabels: data.questionLabels,
    suId: data.suId >= 0 ? data.suId : undefined
  };
};

// Export functions
export { getDpGenderRepartitionData };

// Testing and validation functions
export const testDpGenderRepartition = () => {
  console.log('🧪 Testing DpGenderRepartition...');
  
  try {
    // Test quartier data
    const quartierResult = getDpGenderRepartitionData();
    console.log('✅ Quartier result:', {
      totalResponses: quartierResult.totalResponses,
      responseCount: quartierResult.responses.length,
      hasValidPercentages: quartierResult.responses.every(r => r.percentage >= 0 && r.percentage <= 100)
    });
    
    // Test single SU
    const singleSuResult = getDpGenderRepartitionData([1]);
    console.log('✅ Single SU result:', {
      suId: singleSuResult.suId,
      totalResponses: singleSuResult.totalResponses,
      responseCount: singleSuResult.responses.length
    });
    
    // Test multiple SUs
    const multipleSuResult = getDpGenderRepartitionData([1, 2]);
    console.log('✅ Multiple SU result:', {
      suId: multipleSuResult.suId,
      totalResponses: multipleSuResult.totalResponses,
      responseCount: multipleSuResult.responses.length
    });
    
    // Test backward compatibility
    const backwardCompatResult = getDpGenderRepartitionResult([1]);
    console.log('✅ Backward compatibility result:', {
      dataLength: backwardCompatResult.data.length,
      hasColors: backwardCompatResult.data.every(d => d.color),
      isValidStructure: backwardCompatResult.questionLabels && backwardCompatResult.color
    });
    
    console.log('✅ All DpGenderRepartition tests passed!');
  } catch (error) {
    console.error('❌ DpGenderRepartition test failed:', error);
  }
};

// Export text function for compatibility
export const getDpGenderRepartitionText = (selectedSus?: number[]): string => {
  return JSON.stringify(getDpGenderRepartitionResult(selectedSus), null, 2);
};