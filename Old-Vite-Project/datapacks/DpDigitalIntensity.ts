// ===== ÉTAPE 1: IMPORTATION DES DONNÉES =====
// On importe tous les fichiers JSON qui contiennent le modèle de la base de données.

import suAnswerData from '../data/Su Answer.json';              // 📊 Les réponses des habitants au questionnaire
import metaSuChoicesData from '../data/MetaSuChoices.json';     // 📋 Les choix possibles pour chaque question (ex: "1-3h", "4-6h", etc.)
import metaSuQuestionsData from '../data/MetaSuQuestions.json'; // ❓ Les informations sur les questions elles-mêmes
import suBankData from '../data/Su Bank.json';                  // 🏛️ Les informations générales sur chaque Sphère d'Usage (couleurs, noms, etc.)
import suData from '../data/Su Data.json';                      // 🗺️ Les données sur chaque SU (population, pourcentages, etc.)
import { getCategoryColors } from './DpSuColors';               // 🎨 Une fonction qui nous donne les bonnes couleurs à utiliser


// ===== ÉTAPE 2: DÉFINITION DES STRUCTURES DE DONNÉES =====
// Les "interfaces" sont les moules qui définissent la forme de l'overhead du payload.

// Structure pour UNE réponse possible (ex: "1-3 heures d'écran par jour")
interface DigitalIntensityChoice {
  choiceKey: string;        //   L'identifiant unique de cette réponse (ex: "LOW_INTENSITY")
  choiceLabels: {           //   Tous les textes associés à cette réponse
    labelLong: string;      //   Texte long (ex: "1 à 3 heures d'écran par jour")
    labelShort: string;     //   Texte court (ex: "1-3h")
    labelOrigin: string;    //   Texte original de l'enquête
    emoji: string;          //   Emoji pour rendre c'est plus joli (ex: "📱")
  };
  absoluteCount: number;    //   Combien de gens ont choisi cette réponse (ex: 45 personnes)
  percentage: number;       //   Quel pourcentage ça représente (ex: 32.5%)
  colorIndex: number;       //   Quelle couleur utiliser pour cette réponse dans le graphique
}

// Structure pour TOUTES les données d'une SU (ou du quartier entier)
interface DigitalIntensityData {
  suId: number;             // 🆔 L'identifiant de la SU (0 = quartier entier, 1,2,3... = SU spécifique)
  questionLabels: {         // ❓ Informations sur la question posée
    title: string;          //     Titre de la question (ex: "Intensité numérique")
    emoji: string;          //     Emoji pour la question (ex: "📱💻")
    questionOrigin: string; //     Question telle que posée dans le questionnaire
    questionShort: string;  //     Version courte de la question
  };
  totalResponses: number;   // 👥 Nombre total de personnes qui ont répondu (un genre de "max")
  responses: DigitalIntensityChoice[]; // 📋 TOUTES les réponses possibles avec leurs statistiques
}

// Structure pour stocker TOUTES les données calculées (cache/mémoire)
// C'est comme un carnet où on note tous nos calculs pour ne pas les refaire à chaque fois
interface PrecomputedDigitalIntensityData {
  allSuResults: Map<number, DigitalIntensityData>; // 📚 Un "dictionnaire" avec les résultats de chaque SU
                                                   //     Map = comme un carnet d'adresses : SU 1 → ses données, SU 2 → ses données, etc.
  quartierResult: DigitalIntensityData;            // 🏙️ Les données calculées pour le quartier entier
  questionLabels: {                                // ❓ Informations sur la question (pareil qu'au-dessus)
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
  lastComputed: number;                            // ⏰ Quand est-ce qu'on a fait ces calculs (timestamp)
}

// 📦 Structure finale que les autres parties du code vont recevoir
// C'est comme l'emballage final d'un cadeau - tout propre et prêt à utiliser
export interface DigitalIntensityResult {
  data: {                   // 📊 Liste de toutes les réponses avec leurs statistiques
    value: string;          //     Identifiant de la réponse (ex: "LOW_INTENSITY")
    label: string;          //     Texte à afficher (ex: "1-3h")
    emoji: string;          //     Emoji (ex: "📱")
    count: number;          //     Nombre de personnes (ex: 45)
    percentage: number;     //     Pourcentage (ex: 32.5)
    color: string;          //     Couleur pour le graphique (ex: "#ff6b6b")
  }[];
  color: string;            // 🎨 Couleur principale à utiliser pour cette SU/quartier
  isQuartier: boolean;      // 🏙️ Est-ce qu'on montre le quartier entier (true) ou une SU spécifique (false) ?
  questionLabels: {         // ❓ Informations sur la question
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
  suId?: number;           // 🆔 Identifiant de la SU (optionnel - absent si c'est le quartier)
}


// ===== ÉTAPE 3: CONSTANTES ET VARIABLES GLOBALES =====

// Constantes : des valeurs qui ne changent jamais (comme des paramètres fixes)
const DATAPACK_NAME = 'DpDigitalIntensity';  // 📝 Le nom de ce module (pour les logs/debug)
const QUESTION_KEY = 'Digital Intensity';    // 🔑 La clé de la question dans la base de données
// Attention, ici "question" est au sens de "question du questionnaire" et non "question Metabase" :)

// 💾 Cache global : une "mémoire" qui stocke nos calculs pour ne pas les refaire
// Au début elle est vide (null), mais une fois qu'on a calculé, on garde le résultat ici
let precomputedCache: PrecomputedDigitalIntensityData | null = null;


// ===== ÉTAPE 4: FONCTIONS UTILITAIRES =====
// Ces fonctions font des tâches spécifiques qu'on réutilise plusieurs fois

// 🔍 Fonction qui trouve tous les choix possibles pour notre question
// Va chercher toutes les réponses possibles dans MetaSuChoices.json pour l'Id défini dans QUESTION_KEY.
const getDigitalIntensityChoices = () => {
  // On filtre (= on garde seulement) les choix qui correspondent à nos critères :
  return metaSuChoicesData.filter(choice => 
    choice['Metabase Question Key'] === QUESTION_KEY &&  // ✅ C'est bien notre question "Digital Intensity"
    choice.TypeData === "CatChoixUnique" &&              // ✅ C'est un choix unique (pas multiple)
    choice['Metabase Choice Key']                        // ✅ Il y a bien un identifiant pour ce choix
  );
  // Résultat : une liste des choiks comme ["LOW_INTENSITY", "MEDIUM_INTENSITY", "HIGH_INTENSITY"]
};

// 📋 QUESTION
// Fonction qui récupère les informations sur la question elle-même
const getQuestionMetadata = () => {
  // On cherche dans notre liste de questions celle qui correspond à notre clé déclarée en constante.
  const questionMeta = metaSuQuestionsData.find(q => q['Metabase Question Key'] === QUESTION_KEY);
  
  // On retourne un objet bien formaté avec toutes les infos utiles
  return {
    // Ici, on utilise le label 'Question Short', si rien 'Question Long', et si absent un fallback.
    title: questionMeta?.['Question Short'] || questionMeta?.['Question Long'] || 'Intensité numérique',
    emoji: questionMeta?.Emoji || '🤳💻',           // Emoji enregistré dans le json, si absent un fallback.
    questionOrigin: questionMeta?.['Question Origin'] || '',  // 📝 Question telle que posée dans le questionnaire original
    questionShort: questionMeta?.['Question Short'] || 'Heures d\'écrans / jour'
  };
};

// 🔄 Fonction de conversion des identifiants SU
// - Numéro local simple : SU 1, SU 2, SU 3 (ce que l'utilisateur voit)
// - ID global complexe : 477, 478, 479 (ce qui est dans la base de données)
const getSuIdFromNumber = (suNumber: number): number => {
  // On cherche dans notre tableau de correspondances
  const suEntry = suData.find(su => su.Su === suNumber);  // su.Su = numéro simple, su.ID = ID complexe
  
  if (suEntry) {
    return suEntry.ID; // ✅ On a trouvé ! On retourne l'ID complexe (ex: SU 1 → ID 477)
  }
  
  // ⚠️ Si on ne trouve pas, on affiche un warning et on retourne le numéro tel quel
  console.warn(`Local SU number ${suNumber} not found in Su Data`);
  return suNumber; // Solution de secours
};


// ===== ÉTAPE 5: TRANSFORMATION / CALCUL DES DONNÉES =====

// 📊 Fonction principale de calcul pour un SU spécifique
const calculateDigitalIntensityForSu = (suLocalId: number): DigitalIntensityData => {

  // 1️⃣ On récupère les informations de base dont on va avoir besoin
  const choices = getDigitalIntensityChoices();   // Toutes les réponses possibles ("Jamais", "Parfois", etc.)
  const questionLabels = getQuestionMetadata();   // Les infos sur la question (titre, description)
  const suAnswers = suAnswerData.filter(answer => answer['Su ID'] === suLocalId);  // Filtrer les réponses par SU
  
  // 2️⃣ On prépare nos variables pour stocker les résultats
  const responses: DigitalIntensityChoice[] = [];  // Tableau final avec tous les choix et leurs comptages
  let totalResponses = 0;                          // Compteur total de réponses (pour calculer les pourcentages)

  // 3️⃣ On boucle sur chaque choix possible (comme "Jamais", "Parfois", etc.)
  // On utilise l'ordre naturel des métadonnées (l'ordre de base du Sheet)
  choices.forEach((choice, index) => {
    const choiceKey = String(choice['Metabase Choice Key']);  // La clé unique pour ce choix
    
    // 4️⃣ On compte combien de personnes ont choisi cette réponse
    let absoluteCount = 0;  // Compteur pour cette réponse spécifique
    suAnswers.forEach(answer => {
      const answerValue = answer[QUESTION_KEY];  // La réponse de cette personne
      if (answerValue === choiceKey) {           // Si ça correspond à notre choix actuel
        absoluteCount++;                         // On ajoute 1 au compteur !
      }
    });

    totalResponses += absoluteCount;  // On ajoute au total général

    // 5️⃣ On crée un objet complet avec toutes les infos pour ce choix
    // On met tous les labels pour laisser la possibilité de créer des dataviz qui font
    // leur choix dans le marché du pack de données sans avoir à recréer d'appels en BDD.
    responses.push({
      choiceKey,                                  // La key en bdd ("never", "sometimes")
      choiceLabels: {                             // Tous les textes d'affichage possibles
        labelLong: String(choice['Label Long'] || choice['Label Short'] || choiceKey),     // Texte complet ("Jamais")
        labelShort: String(choice['Label Short'] || choice['Label Long'] || choiceKey),    // Texte court ("Jamais")
        labelOrigin: String(choice['Label Origin'] || choice['Label Long'] || choice['Label Short'] || choiceKey),                                 // Texte original
        emoji: choice.Emoji || '🤳💻'             
      },
      absoluteCount,                              // Nombre brut de réponses
      percentage: 0,                              // Pourcentage (on calculera après quand on aura le total)
      colorIndex: index                           // Index pour choisir la couleur d'affichage
    });
  });

  // 6️⃣ Maintenant qu'on a le total, on peut calculer les pourcentages
  responses.forEach(response => {
    response.percentage = totalResponses > 0 
      ? Math.round((response.absoluteCount / totalResponses) * 1000) / 10  // *1000 puis /10 = 1 chiffre après la virgule
      : 0;  // Si personne n'a répondu, 0%
  });

  // 7️⃣ On garde l'ordre naturel des métadonnées (pas de tri custom qui demanderait du hardcode)
  // L'ordre est déterminé par l'apparition dans MetaSuChoices.json

  // 8️⃣ On retourne tout emballé dans notre interface DigitalIntensityData
  return {
    suId: suLocalId,        // L'ID du SU qu'on a analysé
    questionLabels,         // Les infos sur la question
    totalResponses,         // Le nombre total de personnes qui ont répondu
    responses               // Le détail de chaque choix avec son comptage et pourcentage
  };
};

// 🚀 Fonction de pré-calcul pour optimiser les performances
// Au lieu de calculer à chaque fois, on calcule tout UNE FOIS au démarrage ! ⚡
const precomputeAllDigitalIntensityData = (): PrecomputedDigitalIntensityData => {
  // console.log(`[${new Date().toISOString()}] Starting pre-computation - ${DATAPACK_NAME}`); // Log de debug
  // const startTime = performance.now();  // Log mesure du temps que ça prend

  // 1️⃣ On récupère la liste de tous les SU (sauf l'ID 0 qui est un SU fictif)
  const allSuLocalIds = suData.filter(su => su.ID !== 0).map(su => su.ID);  // [477, 478, 479]
  const allSuResults = new Map<number, DigitalIntensityData>();  // Map pour stocker les résultats de chaque SU
  const questionLabels = getQuestionMetadata();  // Les infos sur la question (une seule fois)
  
  // 2️⃣ On calcule les données pour chaque SU individuellement
  allSuLocalIds.forEach(suLocalId => {
    const suResult = calculateDigitalIntensityForSu(suLocalId);  // On appelle notre fonction de calcul
    allSuResults.set(suLocalId, suResult);  // On stocke le résultat dans la Map (cache)
  });

  // 3️⃣ Maintenant on calcule pour le quartier entier (moyenne pondérée par population)
  // Problème : les SU n'ont pas la même taille ! SU 1 = 1000 habitants, SU 2 = 500, etc.
  // Solution : on pondère par la population (plus de poids aux gros SU) 📊
  const choices = getDigitalIntensityChoices();  // On récupère les choix possibles
  const quartierResponses: DigitalIntensityChoice[] = [];  // Résultats pour tout le quartier
  let totalWeightedResponses = 0;  // Total pondéré (pas juste une addition simple)

  // 4️⃣ On boucle sur chaque choix possible (même ordre que pour les SU individuels)
  choices.forEach((choice, index) => {
    const choiceKey = String(choice['Metabase Choice Key']);  // La clé de ce choix
    let totalWeightedCount = 0;  // Compteur pondéré pour ce choix dans tout le quartier

    // 5️⃣ Calcul pondéré à travers tous les SU en utilisant le pourcentage de population
    allSuLocalIds.forEach(suLocalId => {
      const suDataEntry = suData.find(sd => sd.ID === suLocalId);  // Les infos de ce SU
      const popPercentage = suDataEntry ? parseFloat(String(suDataEntry['Pop Percentage'] || '0')) : 0;  // Son poids démographique
      const suAnswers = suAnswerData.filter(answer => answer['Su ID'] === suLocalId);  // Ses réponses
      
      if (popPercentage > 0 && suAnswers.length > 0) {  // Si ce SU a des données valides
        // 6️⃣ On compte combien de gens de ce SU ont choisi cette réponse
        let suChoiceCount = 0;
        suAnswers.forEach(answer => {
          const answerValue = answer[QUESTION_KEY];
          if (answerValue === choiceKey) {  // Si ça correspond au choix qu'on étudie
            suChoiceCount++;                // +1 !
          }
        });

        // 7️⃣ On applique le poids démographique
        const weight = popPercentage / 100;  // 35% --> 0.35
        totalWeightedCount += suChoiceCount * weight;  // Ex: 10 réponses × 0.35 = 3.5 réponses pondérées
      }
    });

    totalWeightedResponses += totalWeightedCount;  // On ajoute au total pondéré du quartier

    // 8️⃣ On crée l'objet final pour ce choix au niveau quartier
    quartierResponses.push({
      choiceKey,
      choiceLabels: {
        labelLong: String(choice['Label Origin'] || choice['Label Long'] || choiceKey),
        labelShort: String(choice['Label Short'] || choice['Label Long'] || choiceKey),
        labelOrigin: String(choice['Label Origin'] || ''),
        emoji: choice.Emoji || '🤳💻'
      },
      absoluteCount: Math.round(totalWeightedCount),   // On arrondit le nombre pondérée
      percentage: 0,                                   // On calculera les % après
      colorIndex: index                                // Même couleur que pour les SU individuels
    });
  });

  // 9️⃣ On calcule les pourcentages pour le quartier (même technique que pour les SU)
  quartierResponses.forEach(response => {
    response.percentage = totalWeightedResponses > 0 
      ? Math.round((response.absoluteCount / totalWeightedResponses) * 1000) / 10  // 1 chiffre après la virgule
      : 0;
  });

  // 🔟 On garde l'ordre naturel des métadonnées (cohérence avec les SU individuels)
  // L'ordre est déterminé par MetaSuChoices.json

  // 1️⃣1️⃣ On crée l'objet final pour tout le quartier
  const quartierResult: DigitalIntensityData = {
    suId: 0,                                          // ID spécial 0 = quartier entier
    questionLabels,                                   // Même question que les SU individuels
    totalResponses: Math.round(totalWeightedResponses),  // Total pondéré arrondi
    responses: quartierResponses                      // Tous les choix avec leurs stats pondérées
  };

 
  // 1.3 Retourner les datas dans le cache structuré
  return {
    allSuResults,      // Map avec les résultats de chaque SU individuel
    quartierResult,    // Résultat pondéré pour tout le quartier
    questionLabels,    // Métadonnées de la question
    lastComputed: Date.now()  // Timestamp pour savoir quand on a calculé (debug/cache)
  };
};

// Fonction de gestion du cache
const getPrecomputedData = (): PrecomputedDigitalIntensityData => {
  if (!precomputedCache) {                                   // Si c'est la première fois qu'on appelle
    precomputedCache = precomputeAllDigitalIntensityData();  // On calcule tout et on stocke
  }
  return precomputedCache;                                   // Sinon on retourne directement le cache.
};

// FONCTIONS D'EXPORTS / RECUPERATION DU COMPOSANT - À RENOMMER en plus court et harmoniser avec le reste
export function fetchDigitalIntensityData(selectedSus?: number[]): DigitalIntensityResult {
  const precomputed = getPrecomputedData();  // On récupère les données pré-calculées (cache)
  
  // 1. On détermine le type de vue selon les règles standard
  // Règle : si aucun SU sélectionné OU plusieurs SU → vue quartier
  // Sinon : vue SU individuel
  const isQuartierView = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1;
  
  // 2. Variables pour stocker les données qu'on va retourner
  let sourceData: DigitalIntensityData;  // Les données calculées
  let suId: number | undefined;          // L'ID du SU (ou undefined pour quartier)
  
  // 3. On choisit les bonnes données selon le type de vue
  if (isQuartierView) {
    // Vue quartier : on utilise les données pondérées pré-calculées
    sourceData = precomputed.quartierResult;
    suId = 0;  // ID spécial 0 = quartier entier
  } else {
    // Vue SU individuel : on va chercher dans notre cache
    const targetSuLocalId = getSuIdFromNumber(selectedSus[0]);  // On convertit le numéro simple en ID complexe
    sourceData = precomputed.allSuResults.get(targetSuLocalId) || precomputed.quartierResult;  // Fallback sur quartier si problème
    suId = targetSuLocalId;
  }
  
  // 4. On récupère les couleurs pour ce SU (système de couleurs centralisé)
  const colors = getCategoryColors(suId || 0);  // Palette de couleurs spécifique au SU
  const mainColor = suId === 0 
    ? (suBankData.find(su => su.Id === 0)?.colorMain || '#002878')  // Couleur spéciale quartier (bleu foncé)
    : colors[0] || '#2563eb';  // Couleur principale du SU ou bleu par défaut
  
  // 5. On transforme les données vers le format attendu par les composants
  // (pour compatibilité avec l'ancienne interface)
  const transformedData = sourceData.responses.map(response => ({
    value: response.choiceKey,                    // Clé technique ("never", "sometimes")
    label: response.choiceLabels.labelShort,      // Texte d'affichage ("Jamais", "Parfois")
    emoji: response.choiceLabels.emoji,           // Emoji pour l'interface
    count: response.absoluteCount,                // Nombre de réponses
    percentage: response.percentage,              // Pourcentage calculé
    color: colors[response.colorIndex] || colors[0] || mainColor  // Couleur de la catégorie
  }));

  // 6. On retourne l'objet final dans le format DigitalIntensityResult
  return {
    data: transformedData,                     // Les données transformées pour les composants
    color: mainColor,                          // Couleur principale pour ce SU/quartier
    isQuartier: isQuartierView,               // Boolean pour savoir si c'est une vue quartier
    questionLabels: sourceData.questionLabels, // Métadonnées de la question (titre, description)
    suId                                       // ID du SU (ou undefined pour quartier)
  };
}

// Fonction de nettoyage du cache (dev/debug)
export function clearDigitalIntensityCache(): void {
  precomputedCache = null;  // On remet le cache à null
  console.log(`[${new Date().toISOString()}] Cache cleared - ${DATAPACK_NAME}`);  // Log pour confirmer
}

// Test / dev / debug
export function runDigitalIntensityTests(): boolean {
  console.log(`[TEST] Starting tests for ${DATAPACK_NAME}`);
  let allTestsPassed = true;  // Flag pour suivre si tous les tests passent
  
  try {
    // Test 1 : Vérification du système de cache
    clearDigitalIntensityCache();      // On vide le cache
    const data1 = fetchDigitalIntensityData();  // Premier appel (calcul complet)
    const data2 = fetchDigitalIntensityData();  // Deuxième appel (devrait utiliser le cache)
    if (!precomputedCache || data1.data.length !== data2.data.length) {
      console.error('[TEST] Cache not working properly');  // Le cache ne marche pas !
      allTestsPassed = false;
    }
    
    // Test 2 : Vérification de la logique quartier vs SU individuel
    const quartierData = fetchDigitalIntensityData([]);     // Pas de SU sélectionné → quartier
    const suData = fetchDigitalIntensityData([1]);          // SU 1 sélectionné → individuel
    if (quartierData.isQuartier === suData.isQuartier) {    // Ils devraient être différents !
      console.error('[TEST] Quartier vs SU detection failed');
      allTestsPassed = false;
    }
    
    // Test 3 : Vérification de l'intégrité des données
    if (quartierData.data.length === 0) {                  // On devrait avoir des données !
      console.error('[TEST] Pas de données retournées !');
      allTestsPassed = false;
    }
    
    // Test 4 : Validation des pourcentages (ils devraient sommer à 100%)
    const totalPercentage = quartierData.data.reduce((sum, item) => sum + item.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 1 && totalPercentage > 0) {  // Tolérance de 1% pour les arrondis
      console.warn(`[TEST] Percentages don't sum to 100%: ${totalPercentage}%`);
    }
    
    console.log(`[TEST] ${DATAPACK_NAME} tests ${allTestsPassed ? 'OK ✅' : 'PAS OK ❌'}`);
  } catch (error) {
    console.error(`[TEST] ${DATAPACK_NAME}, ERREURS:`, error);
    allTestsPassed = false;  // En cas d'erreur inattendue
  }
  
  return allTestsPassed;  // true = tous les tests OK, false = au moins un échec
}

// 🎯 Comment utiliser ce DataPack :
// Pour utiliser en Dv : fetchDigitalIntensityData() avec ou sans selectedSus
// Pour débugger : clearDigitalIntensityCache() pour forcer le recalcul
// Pour tester : runDigitalIntensityTests() dans la console


// Composantes du script :
// - Interfaces TypeScript pour structurer les données
// - System de cache avec Map() pour les performances (tout calculer une seule fois) 
// - Calculs pondérés par population
// - Gestion des erreurs avec fallbacks
// - Tests automatisés pour valider le code