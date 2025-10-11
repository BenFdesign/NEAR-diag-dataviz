import metaEmdvChoicesData from '../data/MetaEmdvChoices.json';
import metaEmdvQuestionsData from '../data/MetaEmdvQuestions.json';
import wayOfLifeAnswerData from '../data/Way Of Life Answer.json';
import suBankData from '../data/Su Bank.json';
import suData from '../data/Su Data.json';

interface WillChoiceResponse {
  choiceKey: string;
  choiceLabels: {
    labelLong: string;
    labelShort: string;
    emoji: string;
  };
  absoluteCount: number;
  percentage: number;
}

interface WillQuestionData {
  questionKey: string;
  questionLabels: {
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
  totalResponses: number;
  responses: WillChoiceResponse[];
}

interface PrecomputedWillData {
  allSuResults: Map<number, WillQuestionData[]>;
  quartierResults: WillQuestionData[];
  lastComputed: number;
}

let precomputedCache: PrecomputedWillData | null = null;

// Get all will-related questions from metadata using Metabase Keys as source of truth
const getWillQuestions = () => {
  const willChoices = metaEmdvChoicesData.filter(choice => 
    choice.is_will === true && 
    choice.TypeData === "CatChoixUnique" &&
    choice["Metabase Question Key"] && 
    choice["Metabase Choice Key"]
  );

  // Group by Metabase Question Key (source of truth)
  const questionGroups = new Map<string, typeof willChoices>();
  
  willChoices.forEach(choice => {
    const questionKey = choice['Metabase Question Key'];
    if (!questionGroups.has(questionKey)) {
      questionGroups.set(questionKey, []);
    }
    questionGroups.get(questionKey)!.push(choice);
  });

  return questionGroups;
};

// Calculate distribution for a specific SU
const calculateWillDistributionForSu = (suId: number): WillQuestionData[] => {
  const willQuestions = getWillQuestions();
  const suAnswers = wayOfLifeAnswerData.filter(answer => answer['Su ID'] === suId);
  const results: WillQuestionData[] = [];

  willQuestions.forEach((choices, questionKey) => {
    // Get question metadata using Metabase Question Key as foreign key
    const questionMeta = metaEmdvQuestionsData.find(q => q['Metabase Question Key'] === questionKey);
    const firstChoice = choices[0];
    
    // Better title fallback: Question Short → Question Declarative → Question Long → Metabase Key
    const bestTitle = questionMeta?.['Question Short'] 
      || questionMeta?.['Question Declarative'] 
      || questionMeta?.['Question Long'] 
      || questionKey;
    
    const questionLabels = {
      title: bestTitle,
      emoji: firstChoice?.Emoji || "🎯",
      questionOrigin: firstChoice?.['Label Origin'] || "",
      questionShort: bestTitle
    };

    // Calculate response distribution using Metabase Choice Keys as references
    const responses: WillChoiceResponse[] = [];
    let totalResponses = 0;

    choices.forEach(choice => {
      const choiceKey = String(choice['Metabase Choice Key']);
      
      // Count responses for this choice using Metabase Choice Key
      let absoluteCount = 0;
      suAnswers.forEach(answer => {
        const answerValue = answer[questionKey as keyof typeof answer];
        if (answerValue === choiceKey) {
          absoluteCount++;
        }
      });

      totalResponses += absoluteCount;

      responses.push({
        choiceKey,
        choiceLabels: {
          labelLong: String(choice['Label Long'] || choiceKey),
          labelShort: String(choice['Label Short'] || choice['Label Long'] || choiceKey),
          emoji: choice.Emoji || ""
        },
        absoluteCount,
        percentage: 0 // Will be calculated after we know total
      });
    });

    // Calculate percentages
    responses.forEach(response => {
      response.percentage = totalResponses > 0 
        ? Math.round((response.absoluteCount / totalResponses) * 1000) / 10 // 1 decimal precision
        : 0;
    });

    // Sort by percentage (descending)
    responses.sort((a, b) => b.percentage - a.percentage);

    results.push({
      questionKey,
      questionLabels,
      totalResponses,
      responses
    });
  });

  // Sort questions by question key for consistency
  results.sort((a, b) => a.questionKey.localeCompare(b.questionKey));

  return results;
};

// Pre-compute all will data following the established rules
const precomputeAllWillData = (): PrecomputedWillData => {
  const allSus = suBankData.filter(su => su.Id !== 0);
  const allSuResults = new Map<number, WillQuestionData[]>();
  
  // 1. Calculate for each SU individually
  allSus.forEach(su => {
    const suResult = calculateWillDistributionForSu(su.Id);
    allSuResults.set(su.Id, suResult);
  });

  // 2. Calculate quartier (weighted average by population)
  const willQuestions = getWillQuestions();
  const quartierResults: WillQuestionData[] = [];

  willQuestions.forEach((choices, questionKey) => {
    const questionMeta = metaEmdvQuestionsData.find(q => q['Metabase Question Key'] === questionKey);
    const firstChoice = choices[0];
    
    // Better title fallback: Question Short → Question Declarative → Question Long → Metabase Key
    const bestTitle = questionMeta?.['Question Short'] 
      || questionMeta?.['Question Declarative'] 
      || questionMeta?.['Question Long'] 
      || questionKey;
    
    const questionLabels = {
      title: bestTitle,
      emoji: firstChoice?.Emoji || "🎯",
      questionOrigin: firstChoice?.['Label Origin'] || "",
      questionShort: bestTitle
    };

    // Calculate weighted distribution across all SUs
    const responses: WillChoiceResponse[] = [];
    let totalWeightedResponses = 0;

    choices.forEach(choice => {
      const choiceKey = String(choice['Metabase Choice Key']);
      let totalWeightedCount = 0;

      // Weighted calculation across all SUs using Pop Percentage
      allSus.forEach(su => {
        const suDataEntry = suData.find(sd => sd.ID === su.Id);
        const popPercentage = suDataEntry ? parseFloat(suDataEntry['Pop Percentage'] || '0') : 0;
        const suAnswers = wayOfLifeAnswerData.filter(answer => answer['Su ID'] === su.Id);
        
        if (popPercentage > 0 && suAnswers.length > 0) {
          // Count responses for this choice in this SU
          let suChoiceCount = 0;
          suAnswers.forEach(answer => {
            const answerValue = answer[questionKey as keyof typeof answer];
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

      responses.push({
        choiceKey,
        choiceLabels: {
          labelLong: String(choice['Label Long'] || choiceKey),
          labelShort: String(choice['Label Short'] || choice['Label Long'] || choiceKey),
          emoji: choice.Emoji || ""
        },
        absoluteCount: Math.round(totalWeightedCount),
        percentage: 0 // Will be calculated after we know total
      });
    });

    // Calculate weighted percentages
    responses.forEach(response => {
      response.percentage = totalWeightedResponses > 0 
        ? Math.round((response.absoluteCount / totalWeightedResponses) * 1000) / 10
        : 0;
    });

    // Sort by percentage (descending)
    responses.sort((a, b) => b.percentage - a.percentage);

    quartierResults.push({
      questionKey,
      questionLabels,
      totalResponses: Math.round(totalWeightedResponses),
      responses
    });
  });

  // Sort questions by question key for consistency
  quartierResults.sort((a, b) => a.questionKey.localeCompare(b.questionKey));

  return {
    allSuResults,
    quartierResults,
    lastComputed: Date.now()
  };
};

// Cache access following established pattern
const getPrecomputedData = (): PrecomputedWillData => {
  if (!precomputedCache) {
    precomputedCache = precomputeAllWillData();
  }
  return precomputedCache;
};

// Main export function - get will data with intelligent filtering
export function fetchWillData(selectedSus?: number[]) {
  const precomputed = getPrecomputedData();
  
  const isQuartierView = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1;
  
  if (isQuartierView) {
    return {
      data: precomputed.quartierResults,
      isQuartier: true,
      suId: 0, // 0 = Quartier
      summary: {
        totalQuestions: precomputed.quartierResults.length,
        dataSource: 'MetaEmdvChoices (is_will: true) + Way of Life Answer',
        computationType: 'Weighted average by population percentage'
      }
    };
  } else {
    const selectedSuNumber = selectedSus[0];
    
    // Mapping SU Number → SU ID following established pattern
    const getSuIdFromNumber = (suNumber: number): number => {
      const availableSus = suBankData.filter(su => su.Id !== 0);
      availableSus.sort((a, b) => a.Id - b.Id);
      
      if (suNumber >= 1 && suNumber <= availableSus.length) {
        return availableSus[suNumber - 1].Id;
      }
      
      console.warn(`SU number ${suNumber} not found in Su Bank data`);
      return suNumber;
    };
    
    const suId = getSuIdFromNumber(selectedSuNumber);
    const suResult = precomputed.allSuResults.get(suId);
    
    if (suResult) {
      return {
        data: suResult,
        isQuartier: false,
        suId: suId,
        summary: {
          totalQuestions: suResult.length,
          dataSource: 'MetaEmdvChoices (is_will: true) + Way of Life Answer',
          computationType: 'Absolute count and percentage per SU'
        }
      };
    } else {
      // Fallback to quartier
      return {  
        data: precomputed.quartierResults,
        isQuartier: true,
        suId: 0,
        summary: {
          totalQuestions: precomputed.quartierResults.length,
          dataSource: 'MetaEmdvChoices (is_will: true) + Way of Life Answer',
          computationType: 'Fallback to quartier weighted average'
        }
      };
    }
  }
}

// Get specific question data
export function fetchWillDataForQuestion(questionKey: string, selectedSus?: number[]) {
  const allData = fetchWillData(selectedSus);
  const questionData = allData.data.find(q => q.questionKey === questionKey);
  
  return {
    ...allData,
    data: questionData ? [questionData] : []
  };
}

// Get available will questions list using Metabase Keys
export function getAvailableWillQuestions() {
  const precomputed = getPrecomputedData();
  
  return precomputed.quartierResults.map(q => ({
    questionKey: q.questionKey,
    title: q.questionLabels.title,
    emoji: q.questionLabels.emoji,
    responsesCount: q.responses.length,
    totalResponses: q.totalResponses
  }));
}

// Get detailed choice analysis for a specific question
export function getWillChoiceDetails(questionKey: string, selectedSus?: number[]) {
  const questionData = fetchWillDataForQuestion(questionKey, selectedSus);
  
  if (questionData.data.length === 0) {
    return null;
  }

  const question = questionData.data[0];
  
  return {
    questionKey: question.questionKey,
    questionLabels: question.questionLabels,
    totalResponses: question.totalResponses,
    isQuartier: questionData.isQuartier,
    suId: questionData.suId,
    choices: question.responses.map(response => ({
      choiceKey: response.choiceKey,
      label: response.choiceLabels.labelShort || response.choiceLabels.labelLong,
      emoji: response.choiceLabels.emoji,
      count: response.absoluteCount,
      percentage: response.percentage
    }))
  };
}

// Cache utilities following established pattern
export function clearWillCache() {
  precomputedCache = null;
  console.log('Cache des données will vidé');
}

export function getWillCacheInfo() {
  if (!precomputedCache) return null;
  
  return {
    version: 'V1 - Distribution des réponses is_will: true',
    lastComputed: new Date(precomputedCache.lastComputed).toLocaleString(),
    questionsCount: precomputedCache.quartierResults.length,
    susCount: precomputedCache.allSuResults.size,
    dataSourceKeys: 'Metabase Question Key + Metabase Choice Key'
  };
}

/*
DATAPACK DOCUMENTATION:
Data Sources Used:
- MetaEmdvChoices.json: Filtered for choices where is_will === true and TypeData === "CatChoixUnique" to identify will-related questions and their choices
- MetaEmdvQuestions.json: Used to retrieve question metadata (title, emoji) using Metabase Question Key as foreign key reference
- Way Of Life Answer.json: Survey responses data filtered by Su ID to extract actual user responses for will questions
- Su Bank.json: SU visual metadata (filtered for Su.Id !== 0) to get available SUs for calculations
- Su Data.json: Population weights (Pop Percentage) used for quartier weighted average calculations

Data Transformations:
- Groups MetaEmdvChoices by Metabase Question Key to identify distinct will questions
- Counts responses per choice for each SU individually using Metabase Choice Key matching
- Calculates weighted quartier averages using Pop Percentage from Su Data.json as weights
- Converts counts to percentages with 1 decimal precision (Math.round(percentage * 1000) / 10)
- Sorts responses by percentage (descending) and questions by questionKey for consistency
- Uses String() conversion for all Metabase Keys to ensure TypeScript string type compatibility

Output Structure:
- Returns distribution of will-related responses (not aggregated values)
- Each response includes choiceKey, choiceLabels (labelLong, labelShort, emoji), absoluteCount, percentage
- Precalculated for all individual SUs + quartier weighted average
- Intelligent filtering: empty/multi-selection returns quartier, single selection returns specific SU
- Includes isQuartier flag and suId for proper Su/Quartier identification in visualization
*/