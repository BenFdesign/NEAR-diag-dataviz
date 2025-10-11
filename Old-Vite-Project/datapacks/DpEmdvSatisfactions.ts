import wayOfLifeAnswerData from '../data/Way Of Life Answer.json';
import metaEmdvQuestionsData from '../data/MetaEmdvQuestions.json';
import metaEmdvChoicesData from '../data/MetaEmdvChoices.json';
import suBankData from '../data/Su Bank.json';
import suData from '../data/Su Data.json';
import { getCategoryColors } from './DpSuColors';

// ===== ÉTAPE 1: CONSTANTES ET CONFIGURATION =====

const DATAPACK_NAME = 'DpEmdvSatisfactions';

// ===== ÉTAPE 2: INTERFACES =====

// Interface pour un choix de réponse
interface EmdvSatisfactionChoice {
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

// Interface pour une question spécifique
interface EmdvSatisfactionQuestionData {
  questionKey: string;
  questionLabels: {
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
  totalResponses: number;
  responses: EmdvSatisfactionChoice[];
}

// Interface pour les données d'un SU ou quartier
interface EmdvSatisfactionData {
  suId: number;
  questions: EmdvSatisfactionQuestionData[];
}

// Interface pour les données pré-calculées
interface PrecomputedEmdvSatisfactionData {
  allSuResults: Map<number, EmdvSatisfactionData>;
  quartierResult: EmdvSatisfactionData;
  lastComputed: number;
}

// Interface d'export (backward compatibility)
export interface EmdvSatisfactionResult {
  data: {
    questionKey: string;
    title: string;
    emoji: string;
    satisfiedCount: number;
    satisfiedPercentage: number;
    neutralCount: number;
    neutralPercentage: number;
    dissatisfiedCount: number;
    dissatisfiedPercentage: number;
    totalCount: number;
  }[];
  color: string;
  isQuartier: boolean;
}

// ===== ÉTAPE 3: CACHE ET UTILITAIRES =====

let precomputedCache: PrecomputedEmdvSatisfactionData | null = null;

// 🔧 Fonction de conversion ID selon les nouvelles règles
const getSuIdFromNumber = (suNumber: number): number => {
  const suEntry = suData.find(su => su.Su === suNumber);
  if (suEntry) {
    return suEntry.ID;
  }
  console.warn(`Local SU number ${suNumber} not found in Su Data`);
  return suNumber;
};

// 🔍 Fonction pour récupérer les questions de satisfaction EMDV
const getEmdvSatisfactionQuestions = () => {
  const questions = metaEmdvQuestionsData.filter(q => 
    q['Metabase Question Key'] && 
    q.Category === 'EmdvSatisfaction'
  );
  
  // Log de débogage pour vérifier le filtrage
  console.log(`[${DATAPACK_NAME}] Found ${questions.length} satisfaction questions with Category='EmdvSatisfaction'`);
  if (questions.length > 0) {
    console.log(`[${DATAPACK_NAME}] First question: ${questions[0]['Metabase Question Key']}`);
  }
  
  return questions;
};

// 🎯 Fonction pour récupérer les choix pour une question spécifique
const getChoicesForQuestion = (questionKey: string) => {
  return metaEmdvChoicesData.filter(choice => 
    choice['Metabase Question Key'] === questionKey &&
    choice['Metabase Choice Key'] &&
    choice.Category === 'EmdvSatisfaction'
  );
};

// ===== ÉTAPE 4: CALCULS =====

// 📊 Calcul pour une question dans un SU spécifique
const calculateSatisfactionForSuQuestion = (suLocalId: number, questionKey: string): EmdvSatisfactionQuestionData => {
  const choices = getChoicesForQuestion(questionKey);
  const suAnswers = wayOfLifeAnswerData.filter(answer => answer['Su ID'] === suLocalId);
  
  const responses: EmdvSatisfactionChoice[] = [];
  let totalResponses = 0;

  choices.forEach((choice, index) => {
    const choiceKey = String(choice['Metabase Choice Key']);
    
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
        labelOrigin: String(choice['Label Origin'] || ''),
        emoji: choice.Emoji || '😐'
      },
      absoluteCount,
      percentage: 0,
      colorIndex: index
    });
  });

  // Calculer les pourcentages
  responses.forEach(response => {
    response.percentage = totalResponses > 0 
      ? Math.round((response.absoluteCount / totalResponses) * 1000) / 10
      : 0;
  });

  const questionMeta = metaEmdvQuestionsData.find(q => q['Metabase Question Key'] === questionKey);

  return {
    questionKey,
    questionLabels: {
      title: questionMeta?.['Question Short'] || questionMeta?.['Question Long'] || questionKey,
      emoji: questionMeta?.Emoji || '❓',
      questionOrigin: questionMeta?.['Question Origin'] || '',
      questionShort: questionMeta?.['Question Short'] || questionKey
    },
    totalResponses,
    responses
  };
};

// 🚀 Pré-calcul complet
const precomputeAllEmdvSatisfactionData = (): PrecomputedEmdvSatisfactionData => {
  console.log(`[${new Date().toISOString()}] Starting pre-computation - ${DATAPACK_NAME}`);
  const startTime = performance.now();

  const allSuLocalIds = suData.filter(su => su.ID !== 0).map(su => su.ID);
  const allSuResults = new Map<number, EmdvSatisfactionData>();
  const satisfactionQuestions = getEmdvSatisfactionQuestions();

  // 1. Calculer pour chaque SU individuellement
  allSuLocalIds.forEach(suLocalId => {
    const questions: EmdvSatisfactionQuestionData[] = [];
    
    satisfactionQuestions.forEach(question => {
      const questionKey = question['Metabase Question Key'];
      if (questionKey) {
        const questionData = calculateSatisfactionForSuQuestion(suLocalId, questionKey);
        questions.push(questionData);
      }
    });

    allSuResults.set(suLocalId, {
      suId: suLocalId,
      questions
    });
  });

  // 2. Calculer le quartier (moyenne pondérée)
  const quartierQuestions: EmdvSatisfactionQuestionData[] = [];
  
  satisfactionQuestions.forEach(question => {
    const questionKey = question['Metabase Question Key'];
    if (!questionKey) return;

    const choices = getChoicesForQuestion(questionKey);
    const quartierResponses: EmdvSatisfactionChoice[] = [];
    let totalWeightedResponses = 0;

    choices.forEach((choice, index) => {
      const choiceKey = String(choice['Metabase Choice Key']);
      let totalWeightedCount = 0;

      allSuLocalIds.forEach(suLocalId => {
        const suDataEntry = suData.find(sd => sd.ID === suLocalId);
        const popPercentage = suDataEntry ? parseFloat(String(suDataEntry['Pop Percentage'] || '0')) : 0;
        const suAnswers = wayOfLifeAnswerData.filter(answer => answer['Su ID'] === suLocalId);
        
        if (popPercentage > 0) {
          let suChoiceCount = 0;
          suAnswers.forEach(answer => {
            const answerValue = answer[questionKey as keyof typeof answer];
            if (answerValue === choiceKey) {
              suChoiceCount++;
            }
          });

          const weight = popPercentage / 100;
          totalWeightedCount += suChoiceCount * weight;
        }
      });

      totalWeightedResponses += totalWeightedCount;

      quartierResponses.push({
        choiceKey,
        choiceLabels: {
          labelLong: String(choice['Label Long'] || choiceKey),
          labelShort: String(choice['Label Short'] || choice['Label Long'] || choiceKey),
          labelOrigin: String(choice['Label Origin'] || ''),
          emoji: choice.Emoji || '�'
        },
        absoluteCount: Math.round(totalWeightedCount),
        percentage: 0,
        colorIndex: index
      });
    });

    // Calculer les pourcentages du quartier
    quartierResponses.forEach(response => {
      response.percentage = totalWeightedResponses > 0 
        ? Math.round((response.absoluteCount / totalWeightedResponses) * 1000) / 10
        : 0;
    });

    const questionMeta = metaEmdvQuestionsData.find(q => q['Metabase Question Key'] === questionKey);

    quartierQuestions.push({
      questionKey,
      questionLabels: {
        title: questionMeta?.['Question Short'] || questionMeta?.['Question Long'] || questionKey,
        emoji: questionMeta?.Emoji || '❓',
        questionOrigin: questionMeta?.['Question Origin'] || '',
        questionShort: questionMeta?.['Question Short'] || questionKey
      },
      totalResponses: Math.round(totalWeightedResponses),
      responses: quartierResponses
    });
  });

  const quartierResult: EmdvSatisfactionData = {
    suId: 0,
    questions: quartierQuestions
  };

  const endTime = performance.now();
  console.log(`[${DATAPACK_NAME}] Pre-computation completed in ${(endTime - startTime).toFixed(2)}ms`);

  return {
    allSuResults,
    quartierResult,
    lastComputed: Date.now()
  };
};

// ⚡ Gestion du cache
const getPrecomputedData = (): PrecomputedEmdvSatisfactionData => {
  if (!precomputedCache) {
    precomputedCache = precomputeAllEmdvSatisfactionData();
  }
  return precomputedCache;
};

// ===== ÉTAPE 5: EXPORT =====

// 🎯 Fonction principale d'export (backward compatibility)
export function fetchEmdvSatisfactionsData(selectedSus?: number[]): EmdvSatisfactionResult {
  const precomputed = getPrecomputedData();
  
  const isQuartierView = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1;
  
  let sourceData: EmdvSatisfactionData;
  let suId: number | undefined;
  
  if (isQuartierView) {
    sourceData = precomputed.quartierResult;
    suId = 0;
  } else {
    const targetSuLocalId = getSuIdFromNumber(selectedSus[0]);
    sourceData = precomputed.allSuResults.get(targetSuLocalId) || precomputed.quartierResult;
    suId = targetSuLocalId;
  }
  
  const colors = getCategoryColors(suId || 0);
  const mainColor = suId === 0 
    ? (suBankData.find(su => su.Id === 0)?.colorMain || '#002878')
    : colors[0] || '#2563eb';

  // Transformer vers le format legacy
  const transformedData = sourceData.questions.map(question => {
    // Chercher les choix "satisfied", "neutral", "dissatisfied"
    const satisfiedChoice = question.responses.find(r => r.choiceKey === 'YES') || question.responses[0];
    const neutralChoice = question.responses.find(r => r.choiceKey === 'DONT_KNOW') || question.responses[1];
    const dissatisfiedChoice = question.responses.find(r => r.choiceKey === 'NO') || question.responses[2];

    return {
      questionKey: question.questionKey,
      title: question.questionLabels.title,
      emoji: question.questionLabels.emoji,
      satisfiedCount: satisfiedChoice?.absoluteCount || 0,
      satisfiedPercentage: satisfiedChoice?.percentage || 0,
      neutralCount: neutralChoice?.absoluteCount || 0,
      neutralPercentage: neutralChoice?.percentage || 0,
      dissatisfiedCount: dissatisfiedChoice?.absoluteCount || 0,
      dissatisfiedPercentage: dissatisfiedChoice?.percentage || 0,
      totalCount: question.totalResponses
    };
  });

  return {
    data: transformedData,
    color: mainColor,
    isQuartier: isQuartierView
  };
}

// 🧹 Fonction de nettoyage du cache
export function clearEmdvSatisfactionCache(): void {
  precomputedCache = null;
  console.log(`[${new Date().toISOString()}] Cache cleared - ${DATAPACK_NAME}`);
}

// 🧪 Fonction de test
export function runEmdvSatisfactionTests(): boolean {
  console.log(`[TEST] Starting tests for ${DATAPACK_NAME}`);
  let allTestsPassed = true;
  
  try {
    clearEmdvSatisfactionCache();
    const data1 = fetchEmdvSatisfactionsData();
    const data2 = fetchEmdvSatisfactionsData();
    if (!precomputedCache || data1.data.length !== data2.data.length) {
      console.error('[TEST] Cache not working properly');
      allTestsPassed = false;
    }
    
    const quartierData = fetchEmdvSatisfactionsData([]);
    const suData = fetchEmdvSatisfactionsData([1]);
    if (quartierData.isQuartier === suData.isQuartier) {
      console.error('[TEST] Quartier vs SU detection failed');
      allTestsPassed = false;
    }
    
    if (quartierData.data.length === 0) {
      console.error('[TEST] No data returned');
      allTestsPassed = false;
    }
    
    console.log(`[TEST] ${DATAPACK_NAME} tests ${allTestsPassed ? 'PASSED ✅' : 'FAILED ❌'}`);
  } catch (error) {
    console.error(`[TEST] ${DATAPACK_NAME} tests failed with error:`, error);
    allTestsPassed = false;
  }
  
  return allTestsPassed;
}