import wayOfLifeAnswerData from '../data/Way Of Life Answer.json';
import metaEmdvQuestionsData from '../data/MetaEmdvQuestions.json';
import metaEmdvChoicesData from '../data/MetaEmdvChoices.json';
import suBankData from '../data/Su Bank.json';
import suData from '../data/Su Data.json';
import { getCategoryColors } from './DpSuColors';

// ===== ÉTAPE 1: CONSTANTES ET CONFIGURATION =====

const DATAPACK_NAME = 'DpEmdvSatisfactionsByCategory';

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

// Interface pour une sous-catégorie
interface EmdvSatisfactionSubcategoryData {
  subcategory: string;
  subcategoryLabel: string;
  subcategoryEmoji: string;
  questions: EmdvSatisfactionQuestionData[];
}

// Interface pour les données d'un SU ou quartier
interface EmdvSatisfactionByCategoryData {
  suId: number;
  subcategories: EmdvSatisfactionSubcategoryData[];
  availableSubcategories: string[];
}

// Interface pour les données pré-calculées
interface PrecomputedEmdvSatisfactionByCategoryData {
  allSuResults: Map<number, EmdvSatisfactionByCategoryData>;
  quartierResult: EmdvSatisfactionByCategoryData;
  lastComputed: number;
}

// Interface d'export
export interface EmdvSatisfactionByCategoryResult {
  subcategories: EmdvSatisfactionSubcategoryData[];
  availableSubcategories: string[];
  selectedSubcategory?: string;
  color: string;
  isQuartier: boolean;
}

// ===== ÉTAPE 3: CACHE ET UTILITAIRES =====

let precomputedCache: PrecomputedEmdvSatisfactionByCategoryData | null = null;

// 🔧 Fonction de conversion ID selon les nouvelles règles
const getSuIdFromNumber = (suNumber: number): number => {
  const suEntry = suData.find(su => su.Su === suNumber);
  if (suEntry) {
    return suEntry.ID;
  }
  console.warn(`Local SU number ${suNumber} not found in Su Data`);
  return suNumber;
};

// 🔍 Fonction pour récupérer toutes les sous-catégories disponibles
const getAvailableSubcategories = (): string[] => {
  const subcategories = new Set<string>();
  metaEmdvQuestionsData.forEach(q => {
    if (q.Category === 'EmdvSatisfaction' && q.Subcategory && q.Subcategory.trim() !== '') {
      subcategories.add(q.Subcategory);
    }
  });
  return Array.from(subcategories).sort();
};

// 🎯 Fonction pour récupérer les questions d'une sous-catégorie
const getEmdvSatisfactionQuestionsBySubcategory = (subcategory: string) => {
  return metaEmdvQuestionsData.filter(q => 
    q['Metabase Question Key'] && 
    q.Category === 'EmdvSatisfaction' &&
    q.Subcategory === subcategory
  );
};

// 🎯 Fonction pour récupérer les choix pour une question spécifique
const getChoicesForQuestion = (questionKey: string) => {
  return metaEmdvChoicesData.filter(choice => 
    choice['Metabase Question Key'] === questionKey &&
    choice['Metabase Choice Key'] &&
    choice.Category === 'EmdvSatisfaction'
  );
};

// 🏷️ Fonction pour obtenir le label et emoji d'une sous-catégorie
const getSubcategoryInfo = (subcategory: string) => {
  const subcategoryMap: Record<string, { label: string; emoji: string }> = {
    'Food': { label: 'Alimentation', emoji: '🍽️' },
    'FoodStores': { label: 'Magasins alimentaires', emoji: '🛒' },
    'Politics': { label: 'Politique', emoji: '🏛️' },
    'NghLife': { label: 'Vie de quartier', emoji: '🏘️' },
    'Solidarity': { label: 'Solidarité', emoji: '🤝' },
    'Services': { label: 'Services', emoji: '🏢' },
    'Mobility': { label: 'Mobilité', emoji: '🚌' },
    'Housing': { label: 'Logement', emoji: '🏠' },
    'Parks': { label: 'Parcs et espaces verts', emoji: '🌳' },
    'Shopping': { label: 'Commerces', emoji: '🛍️' },
    'General': { label: 'Général', emoji: '🌟' }
  };
  
  return subcategoryMap[subcategory] || { label: subcategory, emoji: '📊' };
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

// 🚀 Pré-calcul complet par catégories
const precomputeAllEmdvSatisfactionByCategoryData = (): PrecomputedEmdvSatisfactionByCategoryData => {
  console.log(`[${new Date().toISOString()}] Starting pre-computation - ${DATAPACK_NAME}`);
  const startTime = performance.now();

  const allSuLocalIds = suData.filter(su => su.ID !== 0).map(su => su.ID);
  const allSuResults = new Map<number, EmdvSatisfactionByCategoryData>();
  const availableSubcategories = getAvailableSubcategories();

  // 1. Calculer pour chaque SU individuellement
  allSuLocalIds.forEach(suLocalId => {
    const subcategoriesData: EmdvSatisfactionSubcategoryData[] = [];
    
    availableSubcategories.forEach(subcategory => {
      const questions = getEmdvSatisfactionQuestionsBySubcategory(subcategory);
      const questionsData: EmdvSatisfactionQuestionData[] = [];
      
      questions.forEach(question => {
        const questionKey = question['Metabase Question Key'];
        if (questionKey) {
          const questionData = calculateSatisfactionForSuQuestion(suLocalId, questionKey);
          if (questionData.totalResponses > 0) { // Ne garder que les questions avec des réponses
            questionsData.push(questionData);
          }
        }
      });

      if (questionsData.length > 0) { // Ne garder que les sous-catégories avec des données
        const subcategoryInfo = getSubcategoryInfo(subcategory);
        subcategoriesData.push({
          subcategory,
          subcategoryLabel: subcategoryInfo.label,
          subcategoryEmoji: subcategoryInfo.emoji,
          questions: questionsData
        });
      }
    });

    allSuResults.set(suLocalId, {
      suId: suLocalId,
      subcategories: subcategoriesData,
      availableSubcategories
    });
  });

  // 2. Calculer le quartier (moyenne pondérée)
  const quartierSubcategoriesData: EmdvSatisfactionSubcategoryData[] = [];
  
  availableSubcategories.forEach(subcategory => {
    const questions = getEmdvSatisfactionQuestionsBySubcategory(subcategory);
    const quartierQuestionsData: EmdvSatisfactionQuestionData[] = [];
    
    questions.forEach(question => {
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
            emoji: choice.Emoji || '😐'
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

      if (totalWeightedResponses > 0) { // Ne garder que les questions avec des réponses
        const questionMeta = metaEmdvQuestionsData.find(q => q['Metabase Question Key'] === questionKey);

        quartierQuestionsData.push({
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
      }
    });

    if (quartierQuestionsData.length > 0) { // Ne garder que les sous-catégories avec des données
      const subcategoryInfo = getSubcategoryInfo(subcategory);
      quartierSubcategoriesData.push({
        subcategory,
        subcategoryLabel: subcategoryInfo.label,
        subcategoryEmoji: subcategoryInfo.emoji,
        questions: quartierQuestionsData
      });
    }
  });

  const quartierResult: EmdvSatisfactionByCategoryData = {
    suId: 0,
    subcategories: quartierSubcategoriesData,
    availableSubcategories
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
const getPrecomputedData = (): PrecomputedEmdvSatisfactionByCategoryData => {
  if (!precomputedCache) {
    precomputedCache = precomputeAllEmdvSatisfactionByCategoryData();
  }
  return precomputedCache;
};

// ===== ÉTAPE 5: EXPORT =====

// 🎯 Fonction principale d'export
export function fetchEmdvSatisfactionsByCategoryData(
  selectedSus?: number[], 
  selectedSubcategory?: string
): EmdvSatisfactionByCategoryResult {
  const precomputed = getPrecomputedData();
  
  const isQuartierView = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1;
  
  let sourceData: EmdvSatisfactionByCategoryData;
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

  // Filtrer par sous-catégorie si spécifiée
  let filteredSubcategories = sourceData.subcategories;
  if (selectedSubcategory && selectedSubcategory !== 'all') {
    filteredSubcategories = sourceData.subcategories.filter(
      sub => sub.subcategory === selectedSubcategory
    );
  }

  return {
    subcategories: filteredSubcategories,
    availableSubcategories: sourceData.availableSubcategories,
    selectedSubcategory,
    color: mainColor,
    isQuartier: isQuartierView
  };
}

// 🧹 Fonction de nettoyage du cache
export function clearEmdvSatisfactionByCategoryCache(): void {
  precomputedCache = null;
  console.log(`[${new Date().toISOString()}] Cache cleared - ${DATAPACK_NAME}`);
}

// 🧪 Fonction de test
export function runEmdvSatisfactionByCategoryTests(): boolean {
  console.log(`[TEST] Starting tests for ${DATAPACK_NAME}`);
  let allTestsPassed = true;
  
  try {
    clearEmdvSatisfactionByCategoryCache();
    const data1 = fetchEmdvSatisfactionsByCategoryData();
    const data2 = fetchEmdvSatisfactionsByCategoryData();
    if (!precomputedCache || data1.subcategories.length !== data2.subcategories.length) {
      console.error('[TEST] Cache not working properly');
      allTestsPassed = false;
    }
    
    const quartierData = fetchEmdvSatisfactionsByCategoryData([]);
    const suData = fetchEmdvSatisfactionsByCategoryData([1]);
    if (quartierData.isQuartier === suData.isQuartier) {
      console.error('[TEST] Quartier vs SU detection failed');
      allTestsPassed = false;
    }
    
    if (quartierData.availableSubcategories.length === 0) {
      console.error('[TEST] No subcategories found');
      allTestsPassed = false;
    }
    
    console.log(`[TEST] ${DATAPACK_NAME} tests ${allTestsPassed ? 'PASSED ✅' : 'FAILED ❌'}`);
  } catch (error) {
    console.error(`[TEST] ${DATAPACK_NAME} tests failed with error:`, error);
    allTestsPassed = false;
  }
  
  return allTestsPassed;
}