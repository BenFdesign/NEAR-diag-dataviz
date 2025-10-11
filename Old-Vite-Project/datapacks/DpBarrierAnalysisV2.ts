import metaEmdvChoicesData from '../data/MetaEmdvChoices.json';
import metaEmdvQuestionsData from '../data/MetaEmdvQuestions.json';
import wayOfLifeAnswerData from '../data/Way Of Life Answer.json';
import suBankData from '../data/Su Bank.json';
import suData from '../data/Su Data.json';
import { getCategoryColors } from './DpSuColors';

// Dans la requête SQL, appliquer le filtre global SurveyId = 1
// (Survey Id = diagnostic millésimé quartier).

// EMDV / Analyse des barrières avec réponses personnalisées

// Constantes
const DATAPACK_NAME = 'DpBarrierAnalysisV2';

interface BarrierCategoryData {
  familleBarriere: string;
  absoluteCount: number;
  percentage: number;
  maxPossible: number;
  isOtherReasons?: boolean; // Distinguer les "autres raisons"
}

interface BarrierQuestionData {
  questionKey: string;
  questionLabels: {
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
  categories: BarrierCategoryData[];
}

interface PrecomputedBarrierData {
  allSuResults: Map<number, BarrierQuestionData[]>;
  quartierResults: BarrierQuestionData[];
  lastComputed: number;
}

let precomputedCache: PrecomputedBarrierData | null = null;

// Get all barrier questions from metadata
const getBarrierQuestions = () => {
  const barrierChoices = metaEmdvChoicesData.filter(choice => 
    choice.is_bareer === true && 
    choice.TypeData === "AbsChoixMultiple" &&
    choice.famille_barriere && 
    choice.famille_barriere.trim() !== ""
  );

  // Group by question
  const questionGroups = new Map<string, typeof barrierChoices>();
  
  barrierChoices.forEach(choice => {
    const questionKey = choice['Metabase Question Key'];
    if (!questionGroups.has(questionKey)) {
      questionGroups.set(questionKey, []);
    }
    questionGroups.get(questionKey)!.push(choice);
  });

  return questionGroups;
};

// Get "OTHER" choices mapping for each barrier question
const getOtherChoicesMapping = () => {
  const otherChoices = metaEmdvChoicesData.filter(choice => 
    choice.is_bareer === true && 
    choice.TypeData === "AbsOther" &&
    choice.famille_barriere && 
    choice.famille_barriere.trim() !== ""
  );

  const otherMapping = new Map<string, typeof otherChoices[0]>();
  
  otherChoices.forEach(choice => {
    const questionKey = choice['Metabase Question Key'];
    otherMapping.set(questionKey, choice);
  });

  return otherMapping;
};

// Parse JSON string from Way of Life Answer data (handles both string and array formats)
const parseAnswerField = (fieldValue: unknown): string[] => {
  if (!fieldValue) return [];
  
  if (typeof fieldValue === 'string') {
    try {
      // Remove outer quotes and braces if present
      let cleaned = fieldValue.trim();
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.slice(1, -1);
      }
      if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
        cleaned = cleaned.slice(1, -1);
      }
      
      // Split by comma and clean each item
      if (cleaned === '') return [];
      
      return cleaned.split(',').map(item => item.trim().replace(/"/g, '').replace(/'/g, ''));
    } catch (e) {
      console.warn('Error parsing answer field:', fieldValue, e);
      return [];
    }
  }
  
  if (Array.isArray(fieldValue)) {
    return fieldValue;
  }
  
  return [];
};

// Extract custom responses (text entries that are not in predefined choices)
const extractCustomResponses = (
  answerField: unknown, 
  questionChoices: typeof metaEmdvChoicesData
): string[] => {
  const selectedChoices = parseAnswerField(answerField);
  const predefinedChoiceKeys = new Set(questionChoices.map(choice => String(choice['Metabase Choice Key'])));
  
  // Filter out predefined choices, keep only custom text responses
  const customResponses = selectedChoices.filter(choice => 
    !predefinedChoiceKeys.has(choice) && 
    choice.trim() !== '' &&
    choice !== 'OTHER' // Exclude the generic "OTHER" key
  );
  
  return customResponses;
};

// Calculate barrier data for a specific SU
const calculateBarrierDataForSu = (suId: number): BarrierQuestionData[] => {
  const barrierQuestions = getBarrierQuestions();
  const otherChoicesMapping = getOtherChoicesMapping();
  const suAnswers = wayOfLifeAnswerData.filter(answer => answer['Su ID'] === suId);
  const results: BarrierQuestionData[] = [];

  barrierQuestions.forEach((choices, questionKey) => {
    // Get question metadata from first choice and MetaEmdvQuestions
    const firstChoice = choices[0];
    const questionMeta = metaEmdvQuestionsData.find(q => q['Metabase Question Key'] === questionKey);
    const questionLabels = {
      title: questionMeta?.['Question Short'] || `Barrières : ${questionKey}`,
      emoji: "🚧",
      questionOrigin: firstChoice['Label Origin'] || "",
      questionShort: questionMeta?.['Question Short'] || questionKey
    };

    // Group choices by famille_barriere
    const familleGroups = new Map<string, typeof choices>();
    choices.forEach(choice => {
      const famille = choice.famille_barriere;
      if (!familleGroups.has(famille)) {
        familleGroups.set(famille, []);
      }
      familleGroups.get(famille)!.push(choice);
    });

    // Calculate data for each famille_barriere
    const categories: BarrierCategoryData[] = [];
    const maxPossible = suAnswers.length; // Maximum number of people who could select each category

    familleGroups.forEach((familleChoices, familleBarriere) => {
      let absoluteCount = 0;

      // Count how many people selected choices from this famille_barriere
      suAnswers.forEach(answer => {
        const answerField = answer[questionKey as keyof typeof answer];
        const selectedChoices = parseAnswerField(answerField);
        
        // Check if any of the selected choices belong to this famille_barriere
        const hasChoiceFromFamily = familleChoices.some(choice => 
          selectedChoices.includes(String(choice['Metabase Choice Key']))
        );
        
        if (hasChoiceFromFamily) {
          absoluteCount++;
        }
      });

      const percentage = maxPossible > 0 ? (absoluteCount / maxPossible) * 100 : 0;

      categories.push({
        familleBarriere,
        absoluteCount,
        percentage: Math.round(percentage * 10) / 10,
        maxPossible,
        isOtherReasons: false
      });
    });

    // Add "Autres raisons" category for custom responses
    const otherChoice = otherChoicesMapping.get(questionKey);
    if (otherChoice) {
      let otherCount = 0;
      
      suAnswers.forEach(answer => {
        const answerField = answer[questionKey as keyof typeof answer];
        const customResponses = extractCustomResponses(answerField, choices);
        
        if (customResponses.length > 0) {
          otherCount++;
        }
      });

      if (otherCount > 0) {
        const otherPercentage = maxPossible > 0 ? (otherCount / maxPossible) * 100 : 0;
        
        categories.push({
          familleBarriere: otherChoice.famille_barriere, // Use the famille_barriere from metadata (should be "Autres raisons")
          absoluteCount: otherCount,
          percentage: Math.round(otherPercentage * 10) / 10,
          maxPossible,
          isOtherReasons: true
        });
      }
    }

    // Sort categories by percentage (descending)
    categories.sort((a, b) => b.percentage - a.percentage);

    results.push({
      questionKey,
      questionLabels,
      categories
    });
  });

  return results;
};

// Pre-compute all barrier data
const precomputeAllBarrierData = (): PrecomputedBarrierData => {
  const allSus = suBankData.filter(su => su.Id !== 0);
  const allSuResults = new Map<number, BarrierQuestionData[]>();
  
  // Calculate for each SU
  allSus.forEach(su => {
    const suResult = calculateBarrierDataForSu(su.Id);
    allSuResults.set(su.Id, suResult);
  });

  // Calculate quartier average (weighted by population)
  const barrierQuestions = getBarrierQuestions();
  const otherChoicesMapping = getOtherChoicesMapping();
  const quartierResults: BarrierQuestionData[] = [];

  barrierQuestions.forEach((choices, questionKey) => {
    const firstChoice = choices[0];
    const questionMeta = metaEmdvQuestionsData.find(q => q['Metabase Question Key'] === questionKey);
    const questionLabels = {
      title: questionMeta?.['Question Short'] || `Barrières : ${questionKey}`,
      emoji: "🚧", 
      questionOrigin: firstChoice['Label Origin'] || "",
      questionShort: questionMeta?.['Question Short'] || questionKey
    };

    // Group choices by famille_barriere
    const familleGroups = new Map<string, typeof choices>();
    choices.forEach(choice => {
      const famille = choice.famille_barriere;
      if (!familleGroups.has(famille)) {
        familleGroups.set(famille, []);
      }
      familleGroups.get(famille)!.push(choice);
    });

    const categories: BarrierCategoryData[] = [];

    familleGroups.forEach((familleChoices, familleBarriere) => {
      let totalWeightedCount = 0;
      let totalWeightedMaxPossible = 0;

      // Weighted calculation across all SUs
      allSus.forEach(su => {
        const suDataEntry = suData.find(sd => sd.ID === su.Id);
        const popPercentage = suDataEntry ? parseFloat(suDataEntry['Pop Percentage'] || '0') : 0;
        const suAnswers = wayOfLifeAnswerData.filter(answer => answer['Su ID'] === su.Id);
        
        if (popPercentage > 0 && suAnswers.length > 0) {
          let suAbsoluteCount = 0;
          const suMaxPossible = suAnswers.length;

          // Count for this SU
          suAnswers.forEach(answer => {
            const answerField = answer[questionKey as keyof typeof answer];
            const selectedChoices = parseAnswerField(answerField);
            
            const hasChoiceFromFamily = familleChoices.some(choice => 
              selectedChoices.includes(String(choice['Metabase Choice Key']))
            );
            
            if (hasChoiceFromFamily) {
              suAbsoluteCount++;
            }
          });

          // Weight by population
          const weight = popPercentage / 100;
          totalWeightedCount += suAbsoluteCount * weight;
          totalWeightedMaxPossible += suMaxPossible * weight;
        }
      });

      const absoluteCount = Math.round(totalWeightedCount);
      const maxPossible = Math.round(totalWeightedMaxPossible);
      const percentage = maxPossible > 0 ? (totalWeightedCount / totalWeightedMaxPossible) * 100 : 0;

      categories.push({
        familleBarriere,
        absoluteCount,
        percentage: Math.round(percentage * 10) / 10,  
        maxPossible,
        isOtherReasons: false
      });
    });

    // Add "Autres raisons" category for quartier (weighted)
    const otherChoice = otherChoicesMapping.get(questionKey);
    if (otherChoice) {
      let totalWeightedOtherCount = 0;
      let totalWeightedOtherMaxPossible = 0;

      allSus.forEach(su => {
        const suDataEntry = suData.find(sd => sd.ID === su.Id);
        const popPercentage = suDataEntry ? parseFloat(suDataEntry['Pop Percentage'] || '0') : 0;
        const suAnswers = wayOfLifeAnswerData.filter(answer => answer['Su ID'] === su.Id);
        
        if (popPercentage > 0 && suAnswers.length > 0) {
          let suOtherCount = 0;
          const suMaxPossible = suAnswers.length;

          suAnswers.forEach(answer => {
            const answerField = answer[questionKey as keyof typeof answer];
            const customResponses = extractCustomResponses(answerField, choices);
            
            if (customResponses.length > 0) {
              suOtherCount++;
            }
          });

          // Weight by population
          const weight = popPercentage / 100;
          totalWeightedOtherCount += suOtherCount * weight;
          totalWeightedOtherMaxPossible += suMaxPossible * weight;
        }
      });

      if (totalWeightedOtherCount > 0) {
        const absoluteCount = Math.round(totalWeightedOtherCount);
        const maxPossible = Math.round(totalWeightedOtherMaxPossible);
        const percentage = maxPossible > 0 ? (totalWeightedOtherCount / totalWeightedOtherMaxPossible) * 100 : 0;

        categories.push({
          familleBarriere: otherChoice.famille_barriere,
          absoluteCount,
          percentage: Math.round(percentage * 10) / 10,
          maxPossible,
          isOtherReasons: true
        });
      }
    }

    // Sort categories by percentage (descending)
    categories.sort((a, b) => b.percentage - a.percentage);

    quartierResults.push({
      questionKey,
      questionLabels,
      categories
    });
  });

  return {
    allSuResults,
    quartierResults,
    lastComputed: Date.now()
  };
};

const getPrecomputedData = (): PrecomputedBarrierData => {
  if (!precomputedCache) {
    precomputedCache = precomputeAllBarrierData();
  }
  return precomputedCache;
};

// Main export function - get barrier data with filtering
export function fetchBarrierData(selectedSus?: number[]) {
  const precomputed = getPrecomputedData();
  
  const isQuartierView = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1;
  
  if (isQuartierView) {
    return {
      data: precomputed.quartierResults,
      isQuartier: true,
      suId: 0, // 0 = Quartier
      color: suBankData.find(su => su.Id === 0)?.colorMain || '#002878',
      summary: {
        totalQuestions: precomputed.quartierResults.length,
        dataSource: 'MetaEmdvChoices + Way of Life Answer + Custom Responses',
        computationType: 'Weighted average by population + Custom responses analysis'
      }
    };
  } else {
    // Single SU selected - use Su field mapping
    const getSuIdsFromSuNumbers = (suNumbers: number[]): number[] => {
      return suData
        .filter(su => suNumbers.includes(su.Su))
        .map(su => typeof su.ID === 'string' ? parseInt(su.ID) : su.ID);
    };
    
    const suIds = getSuIdsFromSuNumbers(selectedSus);
    const suId = suIds[0];
    const suResult = precomputed.allSuResults.get(suId);
    
    if (suResult) {
      // Get SU color
      const colors = getCategoryColors();
      const suInfo = suBankData.find(s => {
        const id = typeof s.Id === 'string' ? parseInt(s.Id) : s.Id;
        return id === suId;
      });
      const mainColor = suInfo?.colorMain || colors[0] || '#2563eb';
      
      return {
        data: suResult,
        isQuartier: false,
        suId: suId,
        color: mainColor,
        summary: {
          totalQuestions: suResult.length,
          dataSource: 'MetaEmdvChoices + Way of Life Answer + Custom Responses',
          computationType: 'Absolute count per SU + Custom responses analysis'
        }
      };
    } else {
      return {  
        data: precomputed.quartierResults,
        isQuartier: true,
        suId: 0, // Fallback vers quartier
        color: suBankData.find(su => su.Id === 0)?.colorMain || '#002878',
        summary: {
          totalQuestions: precomputed.quartierResults.length,
          dataSource: 'MetaEmdvChoices + Way of Life Answer + Custom Responses',
          computationType: 'Fallback to quartier + Custom responses analysis'
        }
      };
    }
  }
}

// Get specific question data
export function fetchBarrierDataForQuestion(questionKey: string, selectedSus?: number[]) {
  // Cas spécial : toutes les questions agrégées
  if (questionKey === '__ALL_QUESTIONS_AGGREGATED__') {
    return fetchAggregatedBarrierData(selectedSus);
  }
  
  const allData = fetchBarrierData(selectedSus);
  const questionData = allData.data.find(q => q.questionKey === questionKey);
  
  return {
    ...allData,
    data: questionData ? [questionData] : []
  };
}

// Get aggregated data from all barrier questions
export function fetchAggregatedBarrierData(selectedSus?: number[]) {
  const allData = fetchBarrierData(selectedSus);
  
  if (allData.data.length === 0) {
    return {
      ...allData,
      data: []
    };
  }

  // Agrégation de toutes les familles de barrières de toutes les questions
  const familleBarriereMap = new Map<string, {
    totalCount: number;
    totalMaxPossible: number;
    questionCount: number; // Nombre de questions où cette famille apparaît
    isOtherReasons: boolean;
  }>();

  // Parcourir toutes les questions et toutes leurs catégories
  allData.data.forEach(question => {
    question.categories.forEach(category => {
      const existing = familleBarriereMap.get(category.familleBarriere) || {
        totalCount: 0,
        totalMaxPossible: 0,
        questionCount: 0,
        isOtherReasons: category.isOtherReasons || false
      };
      
      existing.totalCount += category.absoluteCount;
      existing.totalMaxPossible += category.maxPossible;
      existing.questionCount += 1;
      
      familleBarriereMap.set(category.familleBarriere, existing);
    });
  });

  // Créer les catégories agrégées
  const aggregatedCategories: BarrierCategoryData[] = [];
  familleBarriereMap.forEach((data, familleBarriere) => {
    const percentage = data.totalMaxPossible > 0 ? (data.totalCount / data.totalMaxPossible) * 100 : 0;
    
    aggregatedCategories.push({
      familleBarriere,
      absoluteCount: data.totalCount,
      percentage: Math.round(percentage * 10) / 10,
      maxPossible: data.totalMaxPossible,
      isOtherReasons: data.isOtherReasons
    });
  });

  // Trier par pourcentage décroissant
  aggregatedCategories.sort((a, b) => b.percentage - a.percentage);

  // Créer la question agrégée
  const aggregatedQuestion: BarrierQuestionData = {
    questionKey: '__ALL_QUESTIONS_AGGREGATED__',
    questionLabels: {
      title: 'Toutes les barrières agrégées',
      emoji: '📊',
      questionOrigin: 'Agrégation de toutes les questions barriers + réponses personnalisées',
      questionShort: 'Barrières globales + autres'
    },
    categories: aggregatedCategories
  };

  return {
    ...allData,
    data: [aggregatedQuestion],
    summary: {
      ...allData.summary,
      totalQuestions: allData.data.length,
      computationType: `${allData.summary.computationType} - Agrégé avec réponses personnalisées`
    }
  };
}

// Get available barrier questions list
export function getAvailableBarrierQuestions() {
  const precomputed = getPrecomputedData();
  
  // Ajouter l'option "Toutes les questions agrégées" en premier
  const aggregatedOption = {
    questionKey: '__ALL_QUESTIONS_AGGREGATED__',
    title: 'Toutes les barrières agrégées + autres',
    emoji: '📊',
    categoriesCount: 0 // Sera calculé dynamiquement
  };

  const individualQuestions = precomputed.quartierResults.map(q => ({
    questionKey: q.questionKey,
    title: q.questionLabels.title,
    emoji: q.questionLabels.emoji,
    categoriesCount: q.categories.length
  }));

  return [aggregatedOption, ...individualQuestions];
}

// Get custom responses details for debugging/analysis
export function getCustomResponsesAnalysis(questionKey?: string, selectedSus?: number[]) {
  const barrierQuestions = getBarrierQuestions();
  const isQuartierView = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1;
  
  if (questionKey && barrierQuestions.has(questionKey)) {
    // Analyze specific question
    const choices = barrierQuestions.get(questionKey)!;
    const answers = isQuartierView 
      ? wayOfLifeAnswerData 
      : wayOfLifeAnswerData.filter(answer => {
          const suId = selectedSus![0];
          const availableSus = suBankData.filter(su => su.Id !== 0);
          availableSus.sort((a, b) => a.Id - b.Id);
          const realSuId = suId >= 1 && suId <= availableSus.length 
            ? availableSus[suId - 1].Id 
            : suId;
          return answer['Su ID'] === realSuId;
        });

    const customResponsesDetails: { [key: string]: number } = {};
    let totalCustomResponses = 0;

    answers.forEach(answer => {
      const answerField = answer[questionKey as keyof typeof answer];
      const customResponses = extractCustomResponses(answerField, choices);
      
      customResponses.forEach(response => {
        customResponsesDetails[response] = (customResponsesDetails[response] || 0) + 1;
        totalCustomResponses++;
      });
    });

    return {
      questionKey,
      totalCustomResponses,
      uniqueCustomResponses: Object.keys(customResponsesDetails).length,
      responseDetails: customResponsesDetails,
      sampleSize: answers.length
    };
  }

  // Analyze all questions
  const allQuestionsAnalysis: { [questionKey: string]: ReturnType<typeof getCustomResponsesAnalysis> } = {};
  
  barrierQuestions.forEach((_, qKey) => {
    const analysis = getCustomResponsesAnalysis(qKey, selectedSus);
    if (analysis && 'totalCustomResponses' in analysis && analysis.totalCustomResponses && analysis.totalCustomResponses > 0) {
      allQuestionsAnalysis[qKey] = analysis;
    }
  });

  return {
    questionsWithCustomResponses: Object.keys(allQuestionsAnalysis).length,
    details: allQuestionsAnalysis
  };
}

// Cache utilities
export function clearBarrierCache() {
  precomputedCache = null;
  console.log('Cache des données barriers V2 vidé');
}

export function getBarrierCacheInfo() {
  if (!precomputedCache) return null;
  
  return {
    version: 'V2 - avec réponses personnalisées',
    lastComputed: new Date(precomputedCache.lastComputed).toLocaleString(),
    questionsCount: precomputedCache.quartierResults.length,
    susCount: precomputedCache.allSuResults.size
  };
}

// Validation and testing functions
export const validateBarrierAnalysisData = (): boolean => {
  try {
    console.log(`[${DATAPACK_NAME}] Running validation tests...`);
    
    // Test 1: Validate metadata structure
    const barrierQuestions = getBarrierQuestions();
    if (barrierQuestions.size === 0) {
      console.error(`[${DATAPACK_NAME}] No barrier questions found`);
      return false;
    }

    // Test 2: Validate quartier computation
    const quartierResult = fetchBarrierData();
    if (!quartierResult || !quartierResult.data || quartierResult.data.length === 0) {
      console.error(`[${DATAPACK_NAME}] Failed to compute quartier data`);
      return false;
    }

    // Test 3: Validate SU computation
    const suResult = fetchBarrierData([1]);
    if (!suResult || !suResult.data || suResult.data.length === 0) {
      console.error(`[${DATAPACK_NAME}] Failed to compute SU data`);
      return false;
    }

    // Test 4: Validate aggregated data
    const aggregatedResult = fetchAggregatedBarrierData();
    if (!aggregatedResult || !aggregatedResult.data || aggregatedResult.data.length === 0) {
      console.error(`[${DATAPACK_NAME}] Failed to compute aggregated data`);
      return false;
    }

    // Test 5: Validate custom responses analysis
    const customAnalysis = getCustomResponsesAnalysis();
    if (typeof customAnalysis !== 'object') {
      console.error(`[${DATAPACK_NAME}] Failed to analyze custom responses`);
      return false;
    }

    console.log(`[${DATAPACK_NAME}] All validation tests passed ✓`);
    return true;
  } catch (error) {
    console.error(`[${DATAPACK_NAME}] Validation failed:`, error);
    return false;
  }
};

// Performance testing
export const testBarrierAnalysisPerformance = () => {
  console.log(`[${DATAPACK_NAME}] Running performance tests...`);
  
  const iterations = 50; // Reduced because barrier analysis is more complex
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    fetchBarrierData([1]);
    fetchBarrierData([2]);
    fetchBarrierData();
    fetchAggregatedBarrierData();
  }
  
  const endTime = performance.now();
  const avgTime = (endTime - startTime) / (iterations * 4);
  
  console.log(`[${DATAPACK_NAME}] Average call time: ${avgTime.toFixed(2)}ms`);
  return avgTime;
};

// Development utilities
export const getBarrierAnalysisDebugInfo = () => {
  const cachedData = precomputedCache ? precomputedCache : null;
  const barrierQuestions = getBarrierQuestions();
  
  return {
    datapackName: DATAPACK_NAME,
    version: 'V2 - avec réponses personnalisées',
    lastComputed: cachedData ? new Date(cachedData.lastComputed).toISOString() : 'Not computed',
    totalSus: cachedData ? cachedData.allSuResults.size : 0,
    totalQuestions: cachedData ? cachedData.quartierResults.length : 0,
    metadataQuestions: barrierQuestions.size,
    features: [
      'PrecomputedData cache',
      'Population weighting',
      'Su field mapping',
      'Custom responses analysis',
      'Aggregated barrier analysis',
      'Centralized colors'
    ]
  };
};