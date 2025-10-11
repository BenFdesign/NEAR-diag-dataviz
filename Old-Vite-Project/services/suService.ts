// SERVICE SU :
// ===========
// Ce service gère toutes les opérations liées aux Sphères d'Usages (S.U.) :
// - Récupération des informations des S.U.
// - Liaison entre les données Su Bank (métadonnées) et Su Data (données terrain)
// - Recherche par ID ou numéro de SU
// - Récupération du nom du quartier depuis Surveys.json (table Surveys dans Metabase) (plus fiable que Quartiers.json)
// - Survey Id = diagnostic millésimé d'un quartier. 1 pour la Porte d'Orléans (il pourrait y avoir plusieurs diagnostics pour un même quartier).
// - Voir ici pour définition de SurveyId dans le schéma Prisma :
// - https://github.com/ABC-TransitionBasCarbone/near/blob/c4aa0794f7565a35b03aa3680a21357bec385dcf/app-near/prisma/schema.prisma#L144

import type { SuBankData, SuData, SuInfo } from '../types'
import suBankData from '../data/Su Bank.json' // Base de données des métadonnées SU (noms, couleurs, icônes)
import suData from '../data/Su Data.json' // Données terrain des SU, généré à l'issu de l'enquête S.U. locale (pourcentages population pour un survey/quartier millésimé donné, etc.)
import surveys from '../data/Surveys.json' // Informations sur les enquêtes + nom du quartier
import quartiersData from '../data/Quartiers.json' // Démographie + IRIS + Survey ID (FK vers Surveys)



// CONFIGURATION DU SURVEY ID
// ==========================
// surveyId = 1 correspond au diagnostic de la Porte d'Orléans
// Cette constante filtre toutes les données pour ce survey spécifique

const surveyId = 1



/**
 RÉCUPÉRATION DU NOM DU QUARTIER
 ===============================
 Extrait le nom du quartier depuis le fichier Surveys.json (table "Surveys" dans Metabase)
 @returns {string} Le nom du quartier ou "Quartier" par défaut.
 À FAIRE /!\ : FILTRER POUR LE SURVEY ID DE L'UTILISATEUR CONNECTÉ
 SurveyId défini ici dans le schéma Prisma :
*/
export const getQuartierName = (): string => {
  // Cast du JSON en tableau d'objets avec propriétés Survey ID et Name
  const surveysData = surveys as Array<{ ID?: number, Name?: string }>
  
  // FILTRE PAR SURVEY ID : Trouve le survey correspondant à notre surveyId
  const currentSurvey = surveysData.find(survey => survey.ID === surveyId)
  
  // Retourne le nom du survey trouvé ou "Quartier" par défaut
  return currentSurvey?.Name || 'Quartier'
}

/**
 RÉCUPÉRATION DE LA POPULATION TOTALE DU QUARTIER
 ===============================================
 Extrait la population totale depuis Quartiers.json pour le surveyId actuel
 @returns {number} La population totale du quartier
 */
export const getQuartierPopulation = (): number => {
  // Cast du JSON avec propriétés Population Sum et Survey ID
  const quartiersArray = quartiersData as Array<{ "Population Sum"?: number, "Survey ID"?: number }>
  
  // FILTRE PAR SURVEY ID : Trouve le quartier correspondant à notre surveyId
  const currentQuartier = quartiersArray.find(quartier => quartier["Survey ID"] === surveyId)
  
  // Retourne la population totale arrondie ou 0 par défaut
  return Math.round(currentQuartier?.["Population Sum"] || 0)
}



/*
 RÉCUPÉRATION DE TOUTES LES INFORMATIONS SU
 ==========================================
 Cette fonction principale :
 1. Charge les données depuis Su Bank.json (métadonnées) et Su Data.json (données terrain)
 2. Fait la liaison entre les deux sources via les IDs (Su Data.ID → Su Bank.Id)
 3. Construit des objets SuInfo complets avec toutes les informations nécessaires
 4. Trie les SU par numéro croissant
 ==> @returns {SuInfo[]} Tableau de tous les SU avec leurs informations complètes
*/
export const getSuInfo = (): SuInfo[] => {
  // Cast des données JSON en types TypeScript appropriés
  const bankData = suBankData as SuBankData[] // Métadonnées : noms, couleurs, icônes
  const dataEntries = suData as SuData[] // Données terrain : pourcentages population, etc.

  // FILTRE PAR SURVEY ID : Ne garde que les données du survey spécifié (pas optimisé mais ok pour dataset limité)
  const filteredDataEntries = dataEntries.filter(entry => 
    (entry as SuData & { "Survey ID"?: number })["Survey ID"] === surveyId
  )

  // RÉCUPÉRATION DE LA POPULATION TOTALE DU QUARTIER
  const totalPopulation = getQuartierPopulation()

  return filteredDataEntries.map(entry => {
    // LIAISON DES DONNÉES : Trouve la métadonnée correspondante dans Su Bank
    // via la clé étrangère "ID" qui relie Su Data.ID avec Su Bank.Id
    const bankEntry = bankData.find(bank => bank.Id === entry.ID)
    
    // CALCUL DE LA POPULATION RÉELLE DE LA SU
    const popPercentage = parseFloat(entry["Pop Percentage"])
    const realPopulation = Math.round((popPercentage / 100) * totalPopulation)
    
    // CONSTRUCTION DE L'OBJET SuInfo COMPLET
    return {
      id: entry.ID,                                          // ID unique de la SU (477, 478, 479, etc.)
      su: entry.Su,                                          // Numéro local de la SU (1, 2, 3, etc.)
      name: bankEntry?.["Name Fr"] || `SU ${entry.Su}`,      // Nom français || fallback
      color: bankEntry?.colorMain || '#6c757d',            // Couleur principale ou gris par défaut
      popPercentage: popPercentage,                          // Pourcentage de population
      realPopulation: realPopulation,                       // Population réelle calculée (arrondie)
      icon: bankEntry?.Icon2 || '📍',                        // Icône ou pin par défaut
      bankData: bankEntry!                                   // Référence complète aux métadonnées
    }
  }).sort((a, b) => a.su - b.su) // Tri par Id local des SU (1, 2, 3, 4, 5, 6, 7, 8, 9)
}



/**
  RECHERCHE D'UN SU PAR SON ID UNIQUE
  ===================================
  Trouve un SU spécifique en utilisant son ID (clé primaire, 477, 478, 479, etc.)
  @param {number} id - L'ID unique du SU à rechercher
  @returns {SuInfo | undefined} L'objet SuInfo correspondant ou undefined si non trouvé
*/
export const getSuById = (id: number): SuInfo | undefined => {
  return getSuInfo().find(su => su.id === id)
}



/**
 RECHERCHE D'UN SU PAR SON NUMÉRO / ID LOCAL
 =========================================== 
 Trouve un SU spécifique en utilisant son numéro (1, 2, 3, etc.)
 Utile pour la navigation et l'affichage utilisateur
 
 @param {suNumber} suNumber - Le numéro du SU à rechercher (1 à 9, rarement plus de 5 dans un quartier donné)
 @returns {SuInfo | undefined} L'objet SuInfo correspondant ou undefined si non trouvé
  
 Exemple : getSuBySuNumber(1) retourne le SU numéro 1
*/
export const getSuBySuNumber = (suNumber: number): SuInfo | undefined => {
  return getSuInfo().find(su => su.su === suNumber)
}