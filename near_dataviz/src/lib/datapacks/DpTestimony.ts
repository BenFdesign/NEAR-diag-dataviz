/**
 * DATAPACK - Réseaux de témoignages EMDV
 * 
 * Ce datapack charge les témoignages EMDV et génère un réseau de nodes/links pour 
 * DvTestimonyNetwork.
 * 
 * Sources de données :
 * - MetaEmdvQuestions.json : Questions de type EmdvTestimony avec subcategories et emojis
 * - Way Of Life Answer.json : Témoignages textuels des répondants
 * - Su Answer.json : Métadonnées des répondants (Su, genre, âge, CSP)
 * 
 * Beaucoup de problèmes ESlint non-résolubles liés au graph D3.js, mais qui ne pose normalement pas de problème pour le build.
 */

import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'

// =====================================
// INTERFACES ET TYPES
// =====================================

// Interface pour les métadonnées des questions EMDV
interface MetaEmdvQuestion {
  Id: number
  "Form Id": number
  "Question Id": number
  "Question Origin": string
  "Question Short": string
  "Emoji": string
  "Category": string
  "Subcategory": string
  "Metabase Question Key": string
}

// Interface pour les réponses de témoignages (Way Of Life Answer.json)
interface WayOfLifeAnswer {
  ID: number
  "Su ID": number
  "Gender": string
  "Age Category": string
  "Transportation Mode"?: string
  // Tous les champs de témoignage (Other * Information)
  "Other Food Frequency Information"?: string
  "Other Food Satisfaction Information"?: string
  "Other Housing Information"?: string
  "Other Local Politic Information"?: string
  "Other Mutual Aid Information"?: string
  "Other Neighborhood Life Information"?: string
  "Other Parks Information"?: string
  "Other Repair Shop Satisfaction Information"?: string
  "Other Services Information"?: string
  "Other Transportation Information"?: string
  "Comment"?: string
  [key: string]: unknown
}

// Interface pour les réponses SU (métadonnées CSP)
interface SuAnswer {
  ID: number
  "Su ID": number
  "Gender": string
  "Age Category": string
  // Pour la CSP, on utilisera les données disponibles
  "Home Occupation Type"?: string
  "Your Volontary Work"?: string
  [key: string]: unknown
}

// Node du réseau (parent = subcategory, child = témoignage)
export interface TestimonyNode {
  id: string              // Identifiant unique
  label?: string          // Texte affiché (témoignage pour child, emoji pour parent)
  group?: string          // Groupe/catégorie 
  type: 'parent' | 'child' // Type de node
  
  // Métadonnées pour les témoignages (child nodes)
  testimony?: string      // Texte du témoignage
  suId?: number          // ID de la SU
  respondentGender?: string     // Genre du répondant
  respondentAge?: string        // Tranche d'âge
  respondentCsp?: string        // CSP du répondant
  
  // Métadonnées pour les parents
  subcategory?: string    // Subcategory pour les parents
  emoji?: string         // Emoji pour les parents
  
  // Position pour D3 (sera calculée dynamiquement)
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

// Link du réseau
export interface TestimonyLink {
  source: string         // ID du node source (témoignage)
  target: string         // ID du node target (parent subcategory)
}

// Résultat du datapack
export interface TestimonyNetworkResult {
  nodes: TestimonyNode[]
  links: TestimonyLink[]
  isQuartier: boolean
  questionLabels: {
    title: string
    emoji: string
    questionOrigin: string
    questionShort: string
  }
  suId?: number
  totalTestimonies: number
  subcategories: string[]  // Liste des subcategories trouvées
  dataSource: string
}

// ===========================
// CONSTANTES ET CONFIGURATION
// ===========================

const DATAPACK_NAME = 'DpTestimony'

// Cache côté client
const dataCache = new Map<string, TestimonyNetworkResult>()
let cacheTimestamp = 0
const CACHE_DURATION = 3600000 // 1 heure

// Mapping des champs de témoignage vers les subcategories
const TESTIMONY_FIELD_MAPPING: Record<string, string> = {
  "Other Food Frequency Information": "Food",
  "Other Food Satisfaction Information": "Food", 
  "Other Housing Information": "Housing",
  "Other Local Politic Information": "Politics",
  "Other Mutual Aid Information": "Solidarity",
  "Other Neighborhood Life Information": "NghLife",
  "Other Parks Information": "Parks",
  "Other Repair Shop Satisfaction Information": "Shopping",
  "Other Services Information": "Services",
  "Other Transportation Information": "Mobility",
  "Comment": "General"
}

// Emojis par défaut pour les subcategories
const DEFAULT_SUBCATEGORY_EMOJIS: Record<string, string> = {
  "Food": "🍝🗣️",
  "Housing": "🏘️🗣️", 
  "Politics": "🙋‍♂️🗣️",
  "Solidarity": "🧑‍🤝‍🧑🗣️",
  "NghLife": "🏙️🗣️",
  "Parks": "🌳🗣️",
  "Shopping": "🔧🗣️",
  "Services": "🏛️🗣️",
  "Mobility": "🚦🗣️",
  "General": "🏙️💬"
}

// =====================================
// FONCTIONS DE CHARGEMENT DES DONNÉES
// =====================================

/**
 * Charge les métadonnées EMDV depuis MetaEmdvQuestions.json
 */
const loadMetaEmdvQuestions = async (): Promise<MetaEmdvQuestion[]> => {
  try {
    const response = await fetch('/api/data/MetaEmdvQuestions')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json() as MetaEmdvQuestion[]
    console.log(`📝 Chargé ${data.length} métadonnées EMDV questions`)
    return data
  } catch (error) {
    console.error('Erreur lors du chargement MetaEmdvQuestions:', error)
    return []
  }
}

/**
 * Charge les témoignages depuis Way Of Life Answer.json
 */
const loadWayOfLifeAnswers = async (): Promise<WayOfLifeAnswer[]> => {
  try {
    const response = await fetch('/api/data/Way%20Of%20Life%20Answer')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json() as WayOfLifeAnswer[]
    console.log(`💬 Chargé ${data.length} réponses Way Of Life`)
    return data
  } catch (error) {
    console.error('Erreur lors du chargement Way Of Life Answer:', error)
    return []
  }
}

/**
 * Charge les métadonnées des répondants depuis Su Answer.json
 */
const loadSuAnswerData = async (): Promise<SuAnswer[]> => {
  try {
    const response = await fetch('/api/data/Su%20Answer')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json() as SuAnswer[]
    console.log(`👥 Chargé ${data.length} métadonnées des répondants`)
    return data
  } catch (error) {
    console.error('Erreur lors du chargement Su Answer:', error)
    return []
  }
}

// =====================================
// FONCTIONS DE TRAITEMENT DES MÉTADONNÉES
// =====================================

/**
 * Extrait les questions EmdvTestimony et crée un mapping subcategory -> emoji
 */
const getTestimonySubcategories = (metaQuestions: MetaEmdvQuestion[]): Record<string, string> => {
  const testimonyQuestions = metaQuestions.filter(q => q.Category === "EmdvTestimony")
  
  console.log(`🎯 Trouvé ${testimonyQuestions.length} questions de témoignage`)
  
  const subcategoryEmojis: Record<string, string> = {}
  
  testimonyQuestions.forEach(question => {
    if (question.Subcategory && question.Emoji) {
      subcategoryEmojis[question.Subcategory] = question.Emoji
    }
  })
  
  // Ajouter les emojis par défaut pour les subcategories manquantes
  Object.entries(DEFAULT_SUBCATEGORY_EMOJIS).forEach(([subcategory, emoji]) => {
    subcategoryEmojis[subcategory] ??= emoji
  })
  
  console.log(`📊 Subcategories trouvées:`, Object.keys(subcategoryEmojis))
  return subcategoryEmojis
}

// =====================================
// FONCTIONS DE TRAITEMENT DES DONNÉES
// =====================================

/**
 * Extrait les témoignages depuis les réponses Way Of Life
 */
const extractTestimonies = (
  wayOfLifeAnswers: WayOfLifeAnswer[],
  suAnswers: SuAnswer[],
  selectedSuIds?: number[]
): { testimonies: TestimonyNode[], subcategoriesFound: Set<string> } => {
  
  // Créer un dictionnaire pour les métadonnées des répondants
  const respondentMetadata: Record<number, SuAnswer> = {}
  suAnswers.forEach(answer => {
    respondentMetadata[answer["Su ID"]] = answer
  })
  
  const testimonies: TestimonyNode[] = []
  const subcategoriesFound = new Set<string>()
  
  // Filtrer par SU si spécifié
  const filteredAnswers = selectedSuIds && selectedSuIds.length > 0 
    ? wayOfLifeAnswers.filter(answer => selectedSuIds.includes(answer["Su ID"]))
    : wayOfLifeAnswers
  
  console.log(`🔍 Traitement de ${filteredAnswers.length} réponses pour extraire les témoignages`)
  
  filteredAnswers.forEach((answer, answerIndex) => {
    const suId = answer["Su ID"]
    const respondent = respondentMetadata[suId]
    
    // Parcourir tous les champs de témoignage
    Object.entries(TESTIMONY_FIELD_MAPPING).forEach(([fieldKey, subcategory]) => {
      const testimony = answer[fieldKey as keyof WayOfLifeAnswer] as string
      
      // Vérifier que le témoignage existe et n'est pas vide
      if (testimony && typeof testimony === 'string' && testimony.trim().length > 0) {
        
        // Filtrer les témoignages trop courts ou non informatifs
        const cleanTestimony = testimony.trim()
        if (cleanTestimony.length < 3 || 
            cleanTestimony.toLowerCase() === 'non' || 
            cleanTestimony.toLowerCase() === 'null' ||
            cleanTestimony === '{}') {
          return
        }
        
        subcategoriesFound.add(subcategory)
        
        // Créer le node de témoignage
        const testimonyNode: TestimonyNode = {
          id: `testimony_${answerIndex}_${fieldKey}`,
          label: cleanTestimony.length > 100 
            ? cleanTestimony.substring(0, 100) + '...' 
            : cleanTestimony,
          group: subcategory,
          type: 'child',
          testimony: cleanTestimony,
          suId: suId,
          respondentGender: answer.Gender ?? 'Non spécifié',
          respondentAge: answer["Age Category"] ?? 'Non spécifié',
          respondentCsp: respondent?.["Home Occupation Type"] ?? 'Non spécifié'
        }
        
        testimonies.push(testimonyNode)
      }
    })
  })
  
  console.log(`💭 Extrait ${testimonies.length} témoignages de ${subcategoriesFound.size} subcategories`)
  return { testimonies, subcategoriesFound }
}

/**
 * Crée les nodes parents à partir des subcategories
 */
const createParentNodes = (
  subcategoriesFound: Set<string>,
  subcategoryEmojis: Record<string, string>
): TestimonyNode[] => {
  
  const parentNodes: TestimonyNode[] = []
  
  subcategoriesFound.forEach(subcategory => {
    const emoji = subcategoryEmojis[subcategory] ?? DEFAULT_SUBCATEGORY_EMOJIS[subcategory] ?? '🗣️'
    
    const parentNode: TestimonyNode = {
      id: `parent_${subcategory}`,
      label: emoji, // Afficher seulement l'emoji
      group: subcategory,
      type: 'parent',
      subcategory: subcategory,
      emoji: emoji
    }
    
    parentNodes.push(parentNode)
  })
  
  console.log(`👨‍👩‍👧‍👦 Créé ${parentNodes.length} nodes parents`)
  return parentNodes
}

/**
 * Crée les links entre témoignages et leurs parents
 */
const createTestimonyLinks = (
  testimonies: TestimonyNode[],
  parentNodes: TestimonyNode[]
): TestimonyLink[] => {
  
  const links: TestimonyLink[] = []
  
  // Créer un dictionnaire des parents par subcategory
  const parentsBySubcategory: Record<string, string> = {}
  parentNodes.forEach(parent => {
    if (parent.subcategory) {
      parentsBySubcategory[parent.subcategory] = parent.id
    }
  })
  
  // Créer les liens
  testimonies.forEach(testimony => {
    if (testimony.group) {
      const parentId = parentsBySubcategory[testimony.group]
      if (parentId) {
        links.push({
          source: testimony.id,
          target: parentId
        })
      }
    }
  })
  
  console.log(`🔗 Créé ${links.length} liens`)
  return links
}

// =====================================
// FONCTION PRINCIPALE
// =====================================

export const getDpTestimonyData = async (selectedSus?: number[]): Promise<TestimonyNetworkResult> => {
  try {
    console.log(`🔄 Calcul des données pour ${DATAPACK_NAME}...`)
    
    // Charger toutes les données
    const [metaQuestions, wayOfLifeAnswers, suAnswers] = await Promise.all([
      loadMetaEmdvQuestions(),
      loadWayOfLifeAnswers(),
      loadSuAnswerData()
    ])
    
    // Déterminer si c'est une vue quartier ou SU
    const isQuartier = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1

    // Construire une clé de cache cohérente avec la logique (quartier = toutes SU)
    const cacheKey = isQuartier ? 'quartier' : JSON.stringify(selectedSus ?? [])

    // Vérifier le cache
    if (dataCache.has(cacheKey) && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
      console.log(`✅ Utilisation des données mises en cache pour ${DATAPACK_NAME} (key=${cacheKey})`)
      return dataCache.get(cacheKey)!
    }
    let mappedSuIds = selectedSus
    
    // Mapper les IDs si nécessaire pour SU spécifique
    if (!isQuartier && selectedSus && selectedSus.length === 1) {
      mappedSuIds = await mapLocalToGlobalIds(selectedSus)
      console.log(`🔄 Mapping SU: ${selectedSus[0]} → ${mappedSuIds[0]}`)
    }
    
    // Extraire les métadonnées des subcategories
    const subcategoryEmojis = getTestimonySubcategories(metaQuestions)
    
    // Extraire les témoignages
    const { testimonies, subcategoriesFound } = extractTestimonies(
      wayOfLifeAnswers,
      suAnswers,
      // En mode quartier, on ignore tout filtrage SU pour exposer l'ensemble des témoignages
      isQuartier ? undefined : mappedSuIds
    )
    
    // Créer les nodes parents
    const parentNodes = createParentNodes(subcategoriesFound, subcategoryEmojis)
    
    // Combiner tous les nodes
    const allNodes = [...parentNodes, ...testimonies]
    
    // Créer les links
    const links = createTestimonyLinks(testimonies, parentNodes)
    
    // Construire le résultat
    const result: TestimonyNetworkResult = {
      nodes: allNodes,
      links: links,
      isQuartier: isQuartier,
      questionLabels: {
        title: 'Réseau de témoignages EMDV',
        emoji: '🗣️💬',
        questionOrigin: 'Témoignages des répondants sur leur quartier',
        questionShort: 'Témoignages'
      },
      suId: !isQuartier && mappedSuIds ? mappedSuIds[0] : undefined,
      totalTestimonies: testimonies.length,
      subcategories: Array.from(subcategoriesFound).sort(),
      dataSource: isQuartier ? 'Tous témoignages' : 'Témoignages SU'
    }
    
    // Mettre en cache
  dataCache.set(cacheKey, result)
    cacheTimestamp = Date.now()
    
    console.log(`✅ Réseau de témoignages calculé: ${allNodes.length} nodes, ${links.length} links`)
    return result
    
  } catch (error) {
    console.error(`❌ Erreur dans ${DATAPACK_NAME}:`, error)
    
    // Retourner des données de fallback
    return {
      nodes: [],
      links: [],
      isQuartier: true,
      questionLabels: {
        title: 'Erreur de chargement',
        emoji: '❌',
        questionOrigin: 'Erreur', 
        questionShort: 'Erreur'
      },
      totalTestimonies: 0,
      subcategories: [],
      dataSource: 'Erreur'
    }
  }
}

// =====================================
// FONCTIONS DE TEST ET UTILITAIRES
// =====================================

export const testDpTestimony = async () => {
  console.log(`🧪 Test de ${DATAPACK_NAME} avec données réelles...`)
  
  try {
    // Test des données de quartier (tous les témoignages)
    const quartierResult = await getDpTestimonyData()
    console.log('✅ Résultat quartier:', {
      isQuartier: quartierResult.isQuartier,
      totalNodes: quartierResult.nodes.length,
      totalLinks: quartierResult.links.length,
      totalTestimonies: quartierResult.totalTestimonies,
      subcategories: quartierResult.subcategories,
      dataSource: quartierResult.dataSource
    })
    
    // Test SU individuel
    const singleSuResult = await getDpTestimonyData([1])
    console.log('✅ Résultat SU individuel:', {
      isQuartier: singleSuResult.isQuartier,
      suId: singleSuResult.suId,
      totalNodes: singleSuResult.nodes.length,
      totalLinks: singleSuResult.links.length,
      totalTestimonies: singleSuResult.totalTestimonies,
      subcategories: singleSuResult.subcategories,
      dataSource: singleSuResult.dataSource
    })
    
    console.log('✅ Test de réseau de témoignages terminé avec succès!')
  } catch (error) {
    console.error(`❌ Test ${DATAPACK_NAME} échoué:`, error)
  }
}

// Clear cache utility
export const clearTestimonyCache = (): void => {
  dataCache.clear()
  cacheTimestamp = 0
  console.log(`🧹 ${DATAPACK_NAME} cache cleared`)
}