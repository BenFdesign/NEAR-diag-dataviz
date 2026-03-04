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

import { loadMetaEmdvQuestions as loadMetaEmdvQuestionsRaw, loadMetaSuChoices as loadMetaSuChoicesRaw, loadSuAnswer, loadWayOfLifeData } from '~/lib/data-loader'
import type { DatapackRequest, DatapackResponse } from '~/lib/datapacks/contracts'
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

// Interface pour MetaSuChoices (labels SU: Genre, Âge, etc.)
interface MetaSuChoice {
  Id: number
  "Form Id": number
  "Question Id": number
  "Label Origin": string
  "Label Long": string
  "Label Short": string
  "Emoji": string
  TypeSQL: string
  TypeData: string
  "Metabase Question Key": string
  "Metabase Choice Key": string
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
  respondentGenderLabel?: string // Label humain du genre
  respondentAge?: string        // Tranche d'âge
  respondentAgeLabel?: string   // Label humain de l'âge
  respondentCsp?: string        // CSP du répondant
  // Référence de question (pour l'intitulé court)
  questionShort?: string       // "Question Short" de la question de témoignage
  questionKey?: string         // Clé Metabase de la question
  
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
    const data = await loadMetaEmdvQuestionsRaw() as MetaEmdvQuestion[]
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
    const data = await loadWayOfLifeData() as WayOfLifeAnswer[]
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
    const data = await loadSuAnswer() as SuAnswer[]
    console.log(`👥 Chargé ${data.length} métadonnées des répondants`)
    return data
  } catch (error) {
    console.error('Erreur lors du chargement Su Answer:', error)
    return []
  }
}

/**
 * Charge les labels SU (ex: Genre) depuis MetaSuChoices.json
 */
const loadMetaSuChoices = async (): Promise<MetaSuChoice[]> => {
  try {
    const data = await loadMetaSuChoicesRaw() as MetaSuChoice[]
    console.log(`🧾 Chargé ${data.length} MetaSuChoices`)
    return data
  } catch (error) {
    console.error('Erreur lors du chargement MetaSuChoices:', error)
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
  selectedSuIds?: number[],
  testimonyMetaByKey?: Record<string, MetaEmdvQuestion>,
  genderLabelMap?: Record<string, string>,
  ageLabelMap?: Record<string, string>
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
  const meta = testimonyMetaByKey?.[fieldKey]
  const questionShort = meta?.["Question Short"]?.trim?.() ?? ''
  const genderRaw = answer.Gender ?? 'Non spécifié'
  const genderLabel = genderLabelMap?.[String(genderRaw)] ?? undefined
  const ageRaw = answer["Age Category"] ?? 'Non spécifié'
  const ageLabel = ageLabelMap?.[String(ageRaw)] ?? undefined

        const testimonyNode: TestimonyNode = {
          id: `testimony_${answerIndex}_${fieldKey}`,
          label: cleanTestimony.length > 100 
            ? cleanTestimony.substring(0, 100) + '...' 
            : cleanTestimony,
          group: subcategory,
          type: 'child',
          testimony: cleanTestimony,
          suId: suId,
          respondentGender: genderRaw,
          respondentGenderLabel: genderLabel,
          respondentAge: ageRaw,
          respondentAgeLabel: ageLabel,
          respondentCsp: respondent?.["Home Occupation Type"] ?? 'Non spécifié',
          questionShort: questionShort,
          questionKey: fieldKey
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

const getDpTestimonyData = async (selectedSus?: number[]): Promise<TestimonyNetworkResult> => {
  try {
    console.log(`🔄 Calcul des données pour ${DATAPACK_NAME}...`)
    
    // Charger toutes les données
    const [metaQuestions, wayOfLifeAnswers, suAnswers, metaSuChoices] = await Promise.all([
      loadMetaEmdvQuestions(),
      loadWayOfLifeAnswers(),
      loadSuAnswerData(),
      loadMetaSuChoices()
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

    // Indexer les questions de témoignage par leur clé Metabase
    const testimonyMetaByKey: Record<string, MetaEmdvQuestion> = {}
    metaQuestions
      .filter(q => q.Category === 'EmdvTestimony' && q["Metabase Question Key"])
      .forEach(q => {
        testimonyMetaByKey[q["Metabase Question Key"]] = q
      })
    
    // Construire une map Genre code -> Label humain depuis MetaSuChoices
    const genderLabelMap: Record<string, string> = {}
    metaSuChoices
      .filter(c => c["Metabase Question Key"] === 'Gender')
      .forEach(c => {
        genderLabelMap[c["Metabase Choice Key"]] = c["Label Long"] || c["Label Short"] || c["Label Origin"]
      })

    // Construire une map Âge code -> Label humain depuis MetaSuChoices
    const ageLabelMap: Record<string, string> = {}
    metaSuChoices
      .filter(c => c["Metabase Question Key"] === 'Age Category')
      .forEach(c => {
        ageLabelMap[c["Metabase Choice Key"]] = c["Label Long"] || c["Label Short"] || c["Label Origin"]
      })

    // Extraire les témoignages
    const { testimonies, subcategoriesFound } = extractTestimonies(
      wayOfLifeAnswers,
      suAnswers,
      // En mode quartier, on ignore tout filtrage SU pour exposer l'ensemble des témoignages
      isQuartier ? undefined : mappedSuIds,
      testimonyMetaByKey,
      genderLabelMap,
      ageLabelMap
    )
    
    // Créer les nodes parents
    const parentNodes = createParentNodes(subcategoriesFound, subcategoryEmojis)
    
    // Combiner tous les nodes
    const allNodes = [...parentNodes, ...testimonies]
    
    // Créer les links
    const links = createTestimonyLinks(testimonies, parentNodes)
    
    // Construire le résultat
    // Titre global: si une seule subcategory et qu'une Question Short existe pour elle, on pourrait l'utiliser.
    // Mais le besoin principal: le titre du modal par témoignage (géré côté DV). On garde un titre général ici.
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

// Clear cache utility
export const clearTestimonyCache = (): void => {
  dataCache.clear()
  cacheTimestamp = 0
  console.log(`🧹 ${DATAPACK_NAME} cache cleared`)
}

// =====================================
// CONTRAT DATAPACK STANDARDISÉ
// =====================================

export const getDpTestimonyDatapack = async (
  request: DatapackRequest
): Promise<DatapackResponse<TestimonyNetworkResult>> => {
  const selectedSus = request.selectedSus

  const data = await getDpTestimonyData(selectedSus)

  const isQuartier = data.isQuartier
  const view: 'su' | 'quartier' = isQuartier ? 'quartier' : 'su'

  const context = {
    view,
    selectedSus: selectedSus ?? [],
    resolvedSuIds: isQuartier ? undefined : (data.suId ? [data.suId] : undefined),
    isPartial: false
  }

  const response: DatapackResponse<TestimonyNetworkResult> = {
    id: DATAPACK_NAME,
    version: '1.0.0',
    data,
    context,
    meta: {
      totalNodes: data.nodes.length,
      totalLinks: data.links.length,
      totalTestimonies: data.totalTestimonies,
      subcategories: data.subcategories,
      dataSource: data.dataSource
    }
  }

  return response
}