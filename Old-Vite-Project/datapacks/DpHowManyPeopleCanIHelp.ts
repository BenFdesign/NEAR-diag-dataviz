import suBankData from '../data/Su Bank.json';
import suData from '../data/Su Data.json';
import wayOfLifeAnswerData from '../data/Way Of Life Answer.json';
import metaEmdvChoicesData from '../data/MetaEmdvChoices.json';
import metaEmdvQuestionsData from '../data/MetaEmdvQuestions.json';
import { getCategoryColors } from './DpSuColors';

// ===== ÉTAPE 1: CONSTANTES ET UTILITAIRES =====

const DATAPACK_NAME = 'DpHowManyPeopleCanIHelp';
const QUESTION_KEY = 'How Many People Can I Help'; // Clé de la question dans Way Of Life Answer

// 🔧 Fonction de conversion ID selon les nouvelles règles
const getSuIdFromNumber = (suNumber: number): number => {
  const suEntry = suData.find(su => su.Su === suNumber);
  if (suEntry) {
    return suEntry.ID; // Retourne l'ID local depuis Su Data
  }
  console.warn(`Local SU number ${suNumber} not found in Su Data`);
  return suNumber; // Fallback
};

// 📋 Fonction pour récupérer les métadonnées de la question
const getQuestionMetadata = () => {
  const questionMeta = metaEmdvQuestionsData.find(q => q['Metabase Question Key'] === QUESTION_KEY);
  
  return {
    title: questionMeta?.['Question Short'] || questionMeta?.['Question Long'] || 'Combien de personnes pourrais-je aider en cas d\'urgence ?',
    emoji: questionMeta?.Emoji || '🤝',
    questionOrigin: questionMeta?.['Question Origin'] || '',
    questionShort: questionMeta?.['Question Short'] || 'Aide en urgence'
  };
};

// 🔍 Fonction pour récupérer les choix possibles
const getHowManyPeopleChoices = () => {
  return metaEmdvChoicesData.filter(choice => 
    choice['Metabase Question Key'] === QUESTION_KEY &&
    choice['Metabase Choice Key']
  );
};

// Dans la requête SQL, appliquer le filtre global SurveyId = 1
// (Survey Id = diagnostic millésimé quartier).

// Way Of Life / Combien de personnes puis-je aider en cas d'urgence

// Interface --> Choix de réponses possibles
interface HowManyPeopleChoice {
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
interface HowManyPeopleData {
  suId: number;
  questionLabels: {
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
  totalResponses: number;
  responses: HowManyPeopleChoice[];
}

// Interface --> données pré-computées
interface PrecomputedHowManyPeopleData {
  allSuResults: Map<number, HowManyPeopleData>;
  quartierResult: HowManyPeopleData;
  questionLabels: {
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
  lastComputed: number; // Timestamp
}

// Export interface (backward compatibility)
export interface HowManyPeopleResult {
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
  suId?: number;
  questionLabels: {
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
}

// ===== ÉTAPE 2: CACHE ET PRÉ-CALCUL =====

let precomputedCache: PrecomputedHowManyPeopleData | null = null;

// 📊 Fonction de calcul pour un SU spécifique
const calculateHowManyPeopleForSu = (suLocalId: number): HowManyPeopleData => {
  const choices = getHowManyPeopleChoices();
  const questionLabels = getQuestionMetadata();
  const suAnswers = wayOfLifeAnswerData.filter(answer => answer['Su ID'] === suLocalId);
  
  const responses: HowManyPeopleChoice[] = [];
  let totalResponses = 0;

  // Calculer pour chaque choix
  choices.forEach((choice, index) => {
    const choiceKey = String(choice['Metabase Choice Key']);
    
    // Compter les réponses pour ce choix
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
        labelLong: String(choice['Label Long'] || choiceKey),
        labelShort: String(choice['Label Short'] || choice['Label Long'] || choiceKey),
        labelOrigin: String(choice['Label Origin'] || ''),
        emoji: choice.Emoji || '🤝'
      },
      absoluteCount,
      percentage: 0, // Calculé après
      colorIndex: index
    });
  });

  // Calculer les pourcentages
  responses.forEach(response => {
    response.percentage = totalResponses > 0 
      ? Math.round((response.absoluteCount / totalResponses) * 1000) / 10
      : 0;
  });

  return {
    suId: suLocalId,
    questionLabels,
    totalResponses,
    responses
  };
};

// 🚀 Fonction de pré-calcul complète
const precomputeAllHowManyPeopleData = (): PrecomputedHowManyPeopleData => {
  console.log(`[${new Date().toISOString()}] Starting pre-computation - ${DATAPACK_NAME}`);
  const startTime = performance.now();

  const allSuLocalIds = suData.filter(su => su.ID !== 0).map(su => su.ID);
  const allSuResults = new Map<number, HowManyPeopleData>();
  const questionLabels = getQuestionMetadata();
  
  // 1. Calculer pour chaque SU individuellement
  allSuLocalIds.forEach(suLocalId => {
    const suResult = calculateHowManyPeopleForSu(suLocalId);
    allSuResults.set(suLocalId, suResult);
  });

  // 2. Calculer le quartier (moyenne pondérée par population)
  const choices = getHowManyPeopleChoices();
  const quartierResponses: HowManyPeopleChoice[] = [];
  let totalWeightedResponses = 0;

  choices.forEach((choice, index) => {
    const choiceKey = String(choice['Metabase Choice Key']);
    let totalWeightedCount = 0;

    // Calcul pondéré sur tous les SUs
    allSuLocalIds.forEach(suLocalId => {
      const suDataEntry = suData.find(sd => sd.ID === suLocalId);
      const popPercentage = suDataEntry ? parseFloat(String(suDataEntry['Pop Percentage'] || '0')) : 0;
      const suAnswers = wayOfLifeAnswerData.filter(answer => answer['Su ID'] === suLocalId);
      
      if (popPercentage > 0 && suAnswers.length > 0) {
        // Compter les réponses pour ce choix dans ce SU
        let suChoiceCount = 0;
        suAnswers.forEach(answer => {
          const answerValue = answer[QUESTION_KEY];
          if (answerValue === choiceKey) {
            suChoiceCount++;
          }
        });

        // Appliquer le poids de population
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
        emoji: choice.Emoji || '🤝'
      },
      absoluteCount: Math.round(totalWeightedCount),
      percentage: 0, // Calculé après
      colorIndex: index
    });
  });

  // Calculer les pourcentages du quartier
  quartierResponses.forEach(response => {
    response.percentage = totalWeightedResponses > 0 
      ? Math.round((response.absoluteCount / totalWeightedResponses) * 1000) / 10
      : 0;
  });

  const quartierResult: HowManyPeopleData = {
    suId: 0,
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

// ⚡ Fonction de gestion du cache
const getPrecomputedData = (): PrecomputedHowManyPeopleData => {
  if (!precomputedCache) {
    precomputedCache = precomputeAllHowManyPeopleData();
  }
  return precomputedCache;
};



// 🎯 Fonction principale d'export
export function fetchHowManyPeopleCanIHelpData(selectedSus?: number[]): HowManyPeopleResult {
  const precomputed = getPrecomputedData();
  
  // Déterminer le type de vue selon les règles standard
  const isQuartierView = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1;
  
  let sourceData: HowManyPeopleData;
  let suId: number | undefined;
  
  if (isQuartierView) {
    // Vue quartier : utiliser les données pondérées pré-calculées
    sourceData = precomputed.quartierResult;
    suId = 0;
  } else {
    // Vue SU individuel : récupérer depuis le cache
    const targetSuLocalId = getSuIdFromNumber(selectedSus[0]);
    sourceData = precomputed.allSuResults.get(targetSuLocalId) || precomputed.quartierResult;
    suId = targetSuLocalId;
  }
  
  // Récupérer les couleurs pour ce SU
  const colors = getCategoryColors(suId || 0);
  const mainColor = suId === 0 
    ? (suBankData.find(su => su.Id === 0)?.colorMain || '#002878')
    : colors[0] || '#2563eb';
  
  // Transformer vers le format de compatibilité
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

// 🧹 Fonction de nettoyage du cache
export function clearHowManyPeopleCache(): void {
  precomputedCache = null;
  console.log(`[${new Date().toISOString()}] Cache cleared - ${DATAPACK_NAME}`);
}

// 🧪 Fonction de test pour validation
export function runHowManyPeopleTests(): boolean {
  console.log(`[TEST] Starting tests for ${DATAPACK_NAME}`);
  let allTestsPassed = true;
  
  try {
    // Test 1: Vérification du cache
    clearHowManyPeopleCache();
    const data1 = fetchHowManyPeopleCanIHelpData();
    const data2 = fetchHowManyPeopleCanIHelpData();
    if (!precomputedCache || data1.data.length !== data2.data.length) {
      console.error('[TEST] Cache not working properly');
      allTestsPassed = false;
    }
    
    // Test 2: Quartier vs SU selection
    const quartierData = fetchHowManyPeopleCanIHelpData([]);
    const suData = fetchHowManyPeopleCanIHelpData([1]);
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
    
    console.log(`[TEST] ${DATAPACK_NAME} tests ${allTestsPassed ? 'PASSED ✅' : 'FAILED ❌'}`);
  } catch (error) {
    console.error(`[TEST] ${DATAPACK_NAME} tests failed with error:`, error);
    allTestsPassed = false;
  }
  
  return allTestsPassed;
}