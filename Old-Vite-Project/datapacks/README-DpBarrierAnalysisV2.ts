/**
 * DpBarrierAnalysisV2 - Version améliorée du datapack d'analyse des barrières
 * 
 * Nouvelles fonctionnalités ajoutées dans cette version :
 * - Comptage des réponses personnalisées (textes libres) dans les champs JSON
 * - Catégorisation automatique de ces réponses comme "Autres raisons"
 * - Architecture évolutive ne dépendant pas de labels hardcodés
 * - Fonction d'analyse des réponses personnalisées pour le debugging
 * 
 * UTILISATION :
 * 
 * 1. Import du datapack :
 * import { fetchBarrierData, getCustomResponsesAnalysis } from './DpBarrierAnalysisV2';
 * 
 * 2. Récupération des données quartier (avec réponses personnalisées) :
 * const quartierData = fetchBarrierData();
 * 
 * 3. Récupération des données pour un SU spécifique :
 * const suData = fetchBarrierData([1]); // SU numéro 1
 * 
 * 4. Analyse des réponses personnalisées :
 * const customAnalysis = getCustomResponsesAnalysis(); // Toutes les questions
 * const specificAnalysis = getCustomResponsesAnalysis('Reasons To Not Chose Second Hand'); // Question spécifique
 * 
 * AMÉLIORATIONS PAR RAPPORT À LA VERSION V1 :
 * 
 * 1. Détection automatique des réponses personnalisées :
 *    - Parse les champs JSON dans "Way Of Life Answer.json"
 *    - Identifie les réponses qui ne correspondent pas aux choix prédéfinis dans MetaEmdvChoices
 *    - Les compte comme "Autres raisons" selon la configuration Question Id: 93
 * 
 * 2. Architecture évolutive :
 *    - Utilise les métadonnées (famille_barriere, TypeData) au lieu de labels hardcodés
 *    - S'adapte automatiquement aux nouvelles données sans modification de code
 * 
 * 3. Fonctions d'analyse avancées :
 *    - getCustomResponsesAnalysis() pour explorer les réponses personnalisées
 *    - Détails sur la fréquence des réponses personnalisées
 *    - Possibilité d'analyser question par question
 * 
 * STRUCTURE DES DONNÉES :
 * 
 * Les catégories incluent maintenant un flag `isOtherReasons` :
 * {
 *   familleBarriere: "Autres raisons",
 *   absoluteCount: 15,
 *   percentage: 8.5,
 *   maxPossible: 177,
 *   isOtherReasons: true  // Nouveau flag pour identifier les réponses personnalisées
 * }
 * 
 * EXEMPLES DE RÉPONSES PERSONNALISÉES DÉTECTÉES :
 * - "C'est très cher!" 
 * - "Neuf pour les enfants"
 * - "Coups de coeur"
 * - "difficulté à trouver de bons produits locaux et de saison"
 * - "j'aime la voiture pour me déplacer en régions"
 * 
 * COMPATIBILITÉ :
 * Cette version est rétro-compatible avec la V1, mais ajoute des données supplémentaires.
 * Les visualisations existantes fonctionneront sans modification, mais pourront
 * être améliorées pour afficher les réponses personnalisées.
 */

export default `
DpBarrierAnalysisV2.ts - Version améliorée du datapack d'analyse des barrières

PRINCIPALES AMÉLIORATIONS :

1. ✅ Comptage des réponses personnalisées dans les champs JSON
2. ✅ Catégorisation automatique comme "Autres raisons" 
3. ✅ Architecture évolutive sans labels hardcodés
4. ✅ Fonctions d'analyse détaillée des réponses personnalisées
5. ✅ Rétro-compatibilité avec l'API existante
6. ✅ Calculs pondérés par population pour les données quartier
7. ✅ Support des analyses par SU individuel

NOUVEAU DANS CETTE VERSION :
- Flag isOtherReasons dans les catégories
- Fonction getCustomResponsesAnalysis() pour l'exploration
- Parsing intelligent des réponses JSON complexes
- Comptage séparé des réponses prédéfinies vs personnalisées

Cette version respecte la demande d'évolutivité en s'appuyant sur les métadonnées
(famille_barriere, TypeData, Metabase Question Key) plutôt que sur des labels
hardcodés, permettant une adaptation automatique aux futures évolutions des données.
`;