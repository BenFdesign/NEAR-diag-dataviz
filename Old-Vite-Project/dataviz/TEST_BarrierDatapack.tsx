// 🧪 Test du nouveau Datapack DpBarrierAnalysis
import { 
  fetchBarrierData, 
  fetchBarrierDataForQuestion,
  getAvailableBarrierQuestions,
  getBarrierCacheInfo,
  clearBarrierCache 
} from '../datapacks/DpBarrierAnalysisV2';

// Test 1: Récupérer toutes les questions barriers disponibles
console.log('=== Questions Barriers Disponibles ===');
const availableQuestions = getAvailableBarrierQuestions();
availableQuestions.forEach(q => {
  console.log(`📊 ${q.emoji} ${q.title} (${q.categoriesCount} catégories)`);
});

// Test 2: Données quartier (tous les barriers)
console.log('\n=== Données Quartier ===');
const quartierData = fetchBarrierData();
console.log(`Type: ${quartierData.isQuartier ? 'Quartier' : 'SU Individuelle'}`);
console.log(`Nombre de questions: ${quartierData.data.length}`);
console.log(`Summary:`, quartierData.summary);

// Afficher les premières données de la première question
if (quartierData.data.length > 0) {
  const firstQuestion = quartierData.data[0];
  console.log(`\n📋 Première question: ${firstQuestion.questionLabels.title}`);
  console.log('Top 3 familles de barrières:');
  firstQuestion.categories.slice(0, 3).forEach(cat => {
    console.log(`  - ${cat.familleBarriere}: ${cat.percentage}% (${cat.absoluteCount}/${cat.maxPossible})`);
  });
}

// Test 3: Données pour une SU spécifique
console.log('\n=== Données SU 1 ===');
const su1Data = fetchBarrierData([1]);
console.log(`Type: ${su1Data.isQuartier ? 'Quartier' : 'SU Individuelle'}`);
console.log(`SU ID: ${su1Data.suId}`);
console.log(`Nombre de questions: ${su1Data.data.length}`);

// Test 4: Données agrégées (toutes les questions)
console.log('\n=== Données Agrégées (Toutes les Questions) ===');
const aggregatedData = fetchBarrierDataForQuestion('__ALL_QUESTIONS_AGGREGATED__');

if (aggregatedData.data.length > 0) {
  const questionData = aggregatedData.data[0];
  console.log(`${questionData.questionLabels.emoji} ${questionData.questionLabels.title}`);
  console.log(`Summary: ${aggregatedData.summary.computationType}`);
  console.log('Top 5 familles de barrières agrégées:');
  questionData.categories.slice(0, 5).forEach(cat => {
    console.log(`  - ${cat.familleBarriere}: ${cat.percentage}% (${cat.absoluteCount}/${cat.maxPossible})`);
  });
}

// Test 5: Données pour une question spécifique
if (availableQuestions.length > 1) { // Prendre la 2ème question (après l'agrégée)
  const firstQuestionKey = availableQuestions[1].questionKey;
  console.log(`\n=== Question Spécifique: ${firstQuestionKey} ===`);
  const specificData = fetchBarrierDataForQuestion(firstQuestionKey);
  
  if (specificData.data.length > 0) {
    const questionData = specificData.data[0];
    console.log(`${questionData.questionLabels.emoji} ${questionData.questionLabels.title}`);
    console.log('Toutes les familles de barrières:');
    questionData.categories.forEach(cat => {
      console.log(`  - ${cat.familleBarriere}: ${cat.percentage}% (${cat.absoluteCount}/${cat.maxPossible})`);
    });
  }
}

// Test 6: Informations du cache
console.log('\n=== Informations Cache ===');
const cacheInfo = getBarrierCacheInfo();
if (cacheInfo) {
  console.log(`Dernière computation: ${cacheInfo.lastComputed}`);
  console.log(`Nombre de questions: ${cacheInfo.questionsCount}`);
  console.log(`Nombre de SUs: ${cacheInfo.susCount}`);
}

export default function TestBarrierDatapack() {
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>🧪 Test DpBarrierAnalysis</h2>
      <p>Ouvrez la console pour voir les résultats des tests.</p>
      
      <div style={{ marginTop: '20px' }}>
        <h3>📊 Fonctionnalités testées :</h3>
        <ul>
          <li>✅ <code>getAvailableBarrierQuestions()</code> - Liste des questions</li>
          <li>✅ <code>fetchBarrierData()</code> - Données quartier</li>
          <li>✅ <code>fetchBarrierData([1])</code> - Données SU spécifique</li>
          <li>✅ <code>fetchBarrierDataForQuestion('__ALL_QUESTIONS_AGGREGATED__')</code> - Toutes questions agrégées</li>
          <li>✅ <code>fetchBarrierDataForQuestion()</code> - Question spécifique</li>
          <li>✅ <code>getBarrierCacheInfo()</code> - Infos cache</li>
        </ul>
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
        <h4>🎯 Structure des données retournées :</h4>
        <pre style={{ fontSize: '12px', overflow: 'auto' }}>
{`{
  data: BarrierQuestionData[],
  isQuartier: boolean,
  suId: number,
  summary: {
    totalQuestions: number,
    dataSource: string,
    computationType: string
  }
}

BarrierQuestionData {
  questionKey: string,
  questionLabels: { title, emoji, ... },
  categories: BarrierCategoryData[]
}

BarrierCategoryData {
  familleBarriere: string,
  absoluteCount: number,
  percentage: number, 
  maxPossible: number
}`}
        </pre>
      </div>

      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={() => clearBarrierCache()}
          style={{ padding: '10px 15px', backgroundColor: '#ff6b6b', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          🗑️ Vider le Cache
        </button>
      </div>
    </div>
  );
}