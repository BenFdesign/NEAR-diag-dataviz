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

import type { SuBankData, SuData, SuInfo } from './types'
import { 
  loadSuBankData, 
  loadSuData, 
  loadSurveys, 
  loadQuartiers 
} from './data-loader'
import { 
  validateAndSanitizeIcon, 
  getFallbackIcon, 
  logIconValidationIssues 
} from './icon-validator'


// CONFIGURATION DU SURVEY ID
// ==========================
// surveyId = 1 correspond au diagnostic de la Porte d'Orléans
// Cette constante filtre toutes les données pour ce survey spécifique

const surveyId = 1


// RÉCUPÉRATION DU NOM DU QUARTIER
// ===============================
/** Extrait le nom du quartier depuis le fichier Surveys.json (table "Surveys" dans Metabase)
    @returns {Promise<string>} Le nom du quartier ou "Quartier" par défaut.
    À FAIRE /!\ : FILTRER POUR LE SURVEY ID DE L'UTILISATEUR CONNECTÉ */

export const getQuartierName = async (): Promise<string> => {
  try {
    const surveys = await loadSurveys()
    
    // FILTRE PAR SURVEY ID : Trouve le survey correspondant à notre surveyId
    const currentSurvey = surveys.find(survey => survey.ID === surveyId)
    
    // Retourne le nom du survey trouvé ou "Quartier" par défaut
    return currentSurvey?.Name ?? 'Quartier'
  } catch (error) {
    console.error('Error loading quartier name:', error)
    return 'Quartier'
  }
}


// RÉCUPÉRATION DE LA POPULATION TOTALE DU QUARTIER
// ================================================
/** Extrait la population totale depuis Quartiers.json pour le surveyId actuel
    @returns {Promise<number>} La population totale du quartier */

export const getQuartierPopulation = async (): Promise<number> => {
  try {
    const quartiers = await loadQuartiers()
    
    // FILTRE PAR SURVEY ID : Trouve le quartier correspondant à notre surveyId
    const currentQuartier = quartiers.find(quartier => quartier["Survey ID"] === surveyId)
    
    // Retourne la population totale arrondie ou 0 par défaut
    return Math.round(currentQuartier?.["Population Sum"] ?? 0)
  } catch (error) {
    console.error('Error loading quartier population:', error)
    return 0
  }
}


// RÉCUPÉRATION DE TOUTES LES INFORMATIONS SU
// ==========================================
/* Cette fonction principale :
 1. Charge les données depuis Su Bank.json (métadonnées) et Su Data.json (données terrain)
 2. Fait la liaison entre les deux sources via les IDs (Su Data.ID → Su Bank.Id)
 3. Construit des objets SuInfo complets avec toutes les informations nécessaires
 4. Trie les SU par numéro croissant
 ==> @returns {Promise<SuInfo[]>} Tableau de tous les SU avec leurs informations complètes */
export const getSuInfo = async (): Promise<SuInfo[]> => {
  try {
    // Load data with caching
    const [bankData, dataEntries, totalPopulation] = await Promise.all([
      loadSuBankData(),
      loadSuData(),
      getQuartierPopulation()
    ])

    // FILTRE PAR SURVEY ID : Ne garde que les données du survey spécifié
    const filteredDataEntries = dataEntries.filter(entry => 
      (entry as SuData & { "Survey ID"?: number })["Survey ID"] === surveyId
    )

    return filteredDataEntries.map(entry => {
      // LIAISON DES DONNÉES : Trouve la métadonnée correspondante dans Su Bank
      // via la clé étrangère "ID" qui relie Su Data.ID avec Su Bank.Id
      const bankEntry = bankData.find(bank => bank.Id === entry.ID)
      
      // CALCUL DE LA POPULATION RÉELLE DE LA SU
      const popPercentage = parseFloat(entry["Pop Percentage"])
      const realPopulation = Math.round((popPercentage / 100) * totalPopulation)
      
      // VALIDATION ET NETTOYAGE DE L'ICÔNE
      let validatedIcon = '📍' // Fallback par défaut
      
      if (bankEntry?.Icon2) {
        const validationResult = validateAndSanitizeIcon(bankEntry.Icon2)
        
        // Log des problèmes de validation pour monitoring
        if (!validationResult.isValid || validationResult.errors.length > 0 || validationResult.warnings.length > 0) {
          logIconValidationIssues(entry.ID, validationResult)
        }
        
        if (validationResult.isValid && validationResult.sanitizedIcon) {
          validatedIcon = validationResult.sanitizedIcon
        } else {
          // En cas d'échec de validation, utiliser une icône de fallback sécurisée
          validatedIcon = getFallbackIcon(entry.Su)
          console.warn(`🔒 Icône non sécurisée remplacée par fallback pour SU ${entry.ID} (${bankEntry["Name Fr"]})`)
        }
      } else {
        // Pas d'icône dans les données, utiliser le fallback
        validatedIcon = getFallbackIcon(entry.Su)
      }
      
      // CONSTRUCTION DE L'OBJET SuInfo COMPLET
      return {
        id: entry.ID,                                          // ID unique de la SU (477, 478, 479, etc.)
        su: entry.Su,                                          // Numéro local de la SU (1, 2, 3, etc.)
        name: bankEntry?.["Name Fr"] ?? `SU ${entry.Su}`,      // Nom français || fallback
        color: bankEntry?.colorMain ?? '#6c757d',            // Couleur principale ou gris par défaut
        popPercentage: popPercentage,                          // Pourcentage de population
        realPopulation: realPopulation,                       // Population réelle calculée (arrondie)
        icon: validatedIcon,                                   // Icône validée et sécurisée
        bankData: bankEntry!                                   // Référence complète aux métadonnées
      }
    }).sort((a, b) => a.su - b.su) // Tri par Id local des SU (1, 2, 3, 4, 5, 6, 7, 8, 9)
  } catch (error) {
    console.error('Error loading SU info:', error)
    return []
  }
}


// RECHERCHE D'UN SU PAR SON ID UNIQUE
// ===================================
/** Trouve un SU spécifique en utilisant son ID (clé primaire, 477, 478, 479, etc.)
    @param {number} id - L'ID unique du SU à rechercher
    @returns {Promise<SuInfo | undefined>} L'objet SuInfo correspondant ou undefined si non trouvé */

export const getSuById = async (id: number): Promise<SuInfo | undefined> => {
  const allSus = await getSuInfo()
  return allSus.find(su => su.id === id)
}

// RECHERCHE D'UN SU PAR SON NUMÉRO / ID LOCAL
// =========================================== 
/** Trouve un SU spécifique en utilisant son numéro (1, 2, 3, etc.)
    Utile pour la navigation et l'affichage utilisateur
 
 @param {suNumber} suNumber - Le numéro du SU à rechercher (1 à 9, rarement plus de 5 dans un quartier donné)
 @returns {Promise<SuInfo | undefined>} L'objet SuInfo correspondant ou undefined si non trouvé
  
 Exemple : getSuBySuNumber(1) retourne le SU numéro 1
*/
export const getSuBySuNumber = async (suNumber: number): Promise<SuInfo | undefined> => {
  const allSus = await getSuInfo()
  return allSus.find(su => su.su === suNumber)
}