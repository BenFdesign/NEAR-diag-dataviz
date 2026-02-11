/**
 * DATAPACK COULEURS - Gestionnaire centralisé des palettes de couleurs
 * 
 * Ce datapack fournit un accès optimisé aux couleurs depuis Su Bank.json pour les Dataviz.
 * Il suit les mêmes principes que le template avec cache côté client et données réelles.
 * 
 * Utilisation des données :
 * - Su Bank.json : Contient toutes les palettes de couleurs par SU et quartier
 * 
 * Fonctionnalités :
 * 1. Chargement et cache des palettes complètes par SU
 * 2. Fonctions utilitaires pour sélectionner des couleurs spécifiques
 * 3. Palettes pré-définies pour différents types de visualisations
 * 4. Gestion des couleurs par défaut en cas d'erreur
 */

// =====================================
// INTERFACES ET TYPES
// =====================================

export interface SuColors {
  colorMain: string
  colorDark1: string
  colorDark2: string
  colorDark3: string
  colorDark4: string
  colorDark5: string
  colorLight1: string
  colorLight2: string
  colorLight3: string
  colorLight4: string
  colorLight5: string
  colorComp1: string
  colorComp2: string
  colorGraph1: string
  colorGraph2: string
  colorGraph3: string
  colorGraph4: string
  colorGraph5: string
  colorGraph6: string
  colorGraph7: string
  colorGraph8: string
  colorGraph9: string
  colorGraph10: string
}

interface ColorData {
  suColors: Map<number, SuColors>
  quartierColors: SuColors
  lastComputed: number
}

// Interface pour les palettes pré-définies
export type PaletteType = 
  | 'gradient'         // Dégradé du clair au foncé  
  | 'graph'           // Couleurs colorGraph1-10
  | 'comp'            // Couleur principale + complémentaire

// =====================================
// CONSTANTES ET CONFIGURATION
// =====================================

const DATAPACK_NAME = 'DpColor'

// Cache côté client pour les couleurs
let colorCache: ColorData | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 3600000 // 1 heure

// Couleurs par défaut en cas d'erreur
const DEFAULT_QUARTIER_COLORS: SuColors = {
  colorMain: '#002878',
  colorDark1: '#001F60',
  colorDark2: '#001748', 
  colorDark3: '#000F30',
  colorDark4: '#000818',
  colorDark5: '#000410',
  colorLight1: '#003599',
  colorLight2: '#3355BB',
  colorLight3: '#6677DD',
  colorLight4: '#99AAFF',
  colorLight5: '#CCD9FF',
  colorComp1: '#FFD700',
  colorComp2: '#FFF0AA',
  colorGraph1: '#6E6EB9',
  colorGraph2: '#96E6B4',
  colorGraph3: '#00BE8C',
  colorGraph4: '#FFB4C8',
  colorGraph5: '#FFDCE6',
  colorGraph6: '#FF9B9B',
  colorGraph7: '#FF3228',
  colorGraph8: '#00A1FF',
  colorGraph9: '#FF8C00',
  colorGraph10: '#8C00FF'
}

// =====================================
// FONCTIONS DE CHARGEMENT DES DONNÉES
// =====================================

// Interface pour les données Su Bank
interface SuBankItem {
  Id: number
  colorMain?: string
  colorDark1?: string
  colorDark2?: string
  colorDark3?: string
  colorDark4?: string
  colorDark5?: string
  colorLight1?: string
  colorLight2?: string
  colorLight3?: string
  colorLight4?: string
  colorLight5?: string
  colorComp1?: string
  colorComp2?: string
  colorGraph1?: string
  colorGraph2?: string
  colorGraph3?: string
  colorGraph4?: string
  colorGraph5?: string
  colorGraph6?: string
  colorGraph7?: string
  colorGraph8?: string
  colorGraph9?: string
  colorGraph10?: string
}

/**
 * Charge les données de couleurs depuis Su Bank.json
 */
import { loadSuBankData as loadSuBankDataRaw } from '~/lib/data-loader'

const loadSuBankData = async (): Promise<SuBankItem[]> => {
  try {
    const data = await loadSuBankDataRaw() as SuBankItem[]
    console.log(`🎨 Chargé ${data.length} palettes de couleurs`)
    return data
  } catch (error) {
    console.error('Erreur lors du chargement des couleurs Su Bank:', error)
    return []
  }
}

/**
 * Pré-calcul et cache de toutes les palettes de couleurs
 */
const precomputeColorData = async (): Promise<ColorData> => {
  console.log(`🔄 Pré-calcul des palettes de couleurs...`)
  
  const suBankData = await loadSuBankData()
  
  const suColors = new Map<number, SuColors>()
  let quartierColors: SuColors = DEFAULT_QUARTIER_COLORS

  // Traiter chaque entrée de Su Bank
  suBankData.forEach((su: SuBankItem) => {
    const colors: SuColors = {
      colorMain: su.colorMain ?? '#666666',
      colorDark1: su.colorDark1 ?? '#555555',
      colorDark2: su.colorDark2 ?? '#444444',
      colorDark3: su.colorDark3 ?? '#333333',
      colorDark4: su.colorDark4 ?? '#222222',
      colorDark5: su.colorDark5 ?? '#111111',
      colorLight1: su.colorLight1 ?? '#888888',
      colorLight2: su.colorLight2 ?? '#999999',
      colorLight3: su.colorLight3 ?? '#aaaaaa',
      colorLight4: su.colorLight4 ?? '#bbbbbb',
      colorLight5: su.colorLight5 ?? '#cccccc',
      colorComp1: su.colorComp1 ?? '#ffcc00',
      colorComp2: su.colorComp2 ?? '#ffe066',
      colorGraph1: su.colorGraph1 ?? '#1f77b4',
      colorGraph2: su.colorGraph2 ?? '#ff7f0e',
      colorGraph3: su.colorGraph3 ?? '#2ca02c',
      colorGraph4: su.colorGraph4 ?? '#d62728',
      colorGraph5: su.colorGraph5 ?? '#9467bd',
      colorGraph6: su.colorGraph6 ?? '#8c564b',
      colorGraph7: su.colorGraph7 ?? '#e377c2',
      colorGraph8: su.colorGraph8 ?? '#7f7f7f',
      colorGraph9: su.colorGraph9 ?? '#bcbd22',
      colorGraph10: su.colorGraph10 ?? '#17becf'
    }

    if (su.Id === 0) {
      quartierColors = colors // Couleurs du quartier
    } else {
      suColors.set(su.Id, colors) // Couleurs par SU ID
    }
  })

  console.log(`✅ ${suColors.size} palettes SU + 1 palette quartier pré-calculées`)
  
  return {
    suColors,
    quartierColors,
    lastComputed: Date.now()
  }
}

/**
 * Obtient ou initialise le cache des couleurs
 */
const getColorData = async (): Promise<ColorData> => {
  // Vérifier si le cache est valide
  if (colorCache && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
    return colorCache
  }

  // Recalculer et mettre en cache
  colorCache = await precomputeColorData()
  cacheTimestamp = Date.now()
  
  return colorCache
}

// =====================================
// FONCTIONS PRINCIPALES D'ACCÈS AUX COULEURS
// =====================================

/**
 * Obtient la palette complète pour une SU ou le quartier
 * @param suId - ID de la SU (0 ou undefined pour quartier)
 * @returns Palette complète de couleurs
 */
export const getSuColors = async (suId?: number): Promise<SuColors> => {
  try {
    const colorData = await getColorData()
    
    if (!suId || suId === 0) {
      return colorData.quartierColors
    }

    return colorData.suColors.get(suId) ?? colorData.quartierColors
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération des couleurs SU ${suId}:`, error)
    return DEFAULT_QUARTIER_COLORS
  }
}

/**
 * Obtient une couleur spécifique par son nom
 * @param colorName - Nom de la couleur (ex: 'colorMain', 'colorGraph1')
 * @param suId - ID de la SU (0 ou undefined pour quartier)
 * @returns Code couleur hexadécimal
 */
export const getColorByName = async (colorName: keyof SuColors, suId?: number): Promise<string> => {
  try {
    const colors = await getSuColors(suId)
    return colors[colorName]
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération de ${colorName} pour SU ${suId}:`, error)
    return DEFAULT_QUARTIER_COLORS[colorName]
  }
}

/**
 * Obtient un set de couleurs spécifiques par leurs noms
 * @param colorNames - Liste des noms de couleurs à récupérer
 * @param suId - ID de la SU (0 ou undefined pour quartier)
 * @returns Array des codes couleurs dans l'ordre demandé
 */
export const getColorsByNames = async (colorNames: (keyof SuColors)[], suId?: number): Promise<string[]> => {
  try {
    const colors = await getSuColors(suId)
    return colorNames.map(name => colors[name])
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération des couleurs pour SU ${suId}:`, error)
    return colorNames.map(name => DEFAULT_QUARTIER_COLORS[name])
  }
}

// =====================================
// PALETTES PRÉ-DÉFINIES POUR LES DATAVIZ
// =====================================

/**
 * Obtient une palette adaptée au type de visualisation
 * @param type - Type de palette souhaité
 * @param suId - ID de la SU (0 ou undefined pour quartier)
 * @returns Array de couleurs pour la visualisation
 */
export const getPalette = async (type: PaletteType, suId?: number): Promise<string[]> => {
  const colors = await getSuColors(suId)

  switch (type) {
    case 'gradient':
      // Dégradé complet du plus clair au plus foncé (11 nuances)
      return [
        colors.colorLight5, colors.colorLight4, colors.colorLight3, colors.colorLight2, colors.colorLight1, 
        colors.colorMain, 
        colors.colorDark1, colors.colorDark2, colors.colorDark3, colors.colorDark4, colors.colorDark5
      ]

    case 'graph':
      // Couleurs pour graphiques (10 couleurs distinctes)
      return [
        colors.colorGraph1, colors.colorGraph2, colors.colorGraph3, colors.colorGraph4, colors.colorGraph5,
        colors.colorGraph6, colors.colorGraph7, colors.colorGraph8, colors.colorGraph9, colors.colorGraph10
      ]

    case 'comp':
      // Couleur principale + complémentaire
      return [colors.colorMain, colors.colorComp1]

    default:
      return [colors.colorMain]
  }
}

// =====================================
// FONCTIONS UTILITAIRES
// =====================================

/**
 * Vide le cache des couleurs (utile pour le développement)
 */
export const clearColorCache = (): void => {
  colorCache = null
  cacheTimestamp = 0
  console.log(`🧹 Cache du ${DATAPACK_NAME} vidé`)
}

/**
 * Fonction de test pour valider le fonctionnement du datapack
 */
export const testDpColor = async () => {
  console.log(`🧪 Test du ${DATAPACK_NAME}...`)
  
  try {
    // Test 1: Couleurs quartier
    console.log('\n--- Test 1: Couleurs Quartier ---')
    const quartierColors = await getSuColors()
    console.log('✅ Couleur principale quartier:', quartierColors.colorMain)
    console.log('✅ Palette graphique quartier:', [quartierColors.colorGraph1, quartierColors.colorGraph2, quartierColors.colorGraph3])

    // Test 2: Couleurs SU spécifique
    console.log('\n--- Test 2: Couleurs SU 477 ---')
    const suColors = await getSuColors(477)
    console.log('✅ Couleur principale SU 477:', suColors.colorMain)
    
    // Test 3: Palettes pré-définies
    console.log('\n--- Test 3: Palettes Pré-définies ---')
    const gradientPalette = await getPalette('gradient')
    console.log('✅ Palette dégradé:', gradientPalette.slice(0, 3), '...')
    
    const graphPalette = await getPalette('graph', 477)
    console.log('✅ Palette graphique SU 477:', graphPalette.slice(0, 3), '...')
    
    const compPalette = await getPalette('comp')
    console.log('✅ Palette complémentaire:', compPalette)

    console.log(`\n✅ Tous les tests du ${DATAPACK_NAME} terminés avec succès!`)
    
  } catch (error) {
    console.error(`❌ Échec du test ${DATAPACK_NAME}:`, error)
  }
}

/**
 * Obtient des statistiques sur les couleurs disponibles
 */
export const getColorStats = async () => {
  try {
    const colorData = await getColorData()
    
    const stats = {
      totalSuPalettes: colorData.suColors.size,
      hasQuartierPalette: !!colorData.quartierColors,
      cacheAge: Date.now() - colorData.lastComputed,
      availableSuIds: Array.from(colorData.suColors.keys()).sort((a, b) => a - b)
    }
    
    console.log('📊 Statistiques des couleurs:', stats)
    return stats
    
  } catch (error) {
    console.error('❌ Erreur lors du calcul des statistiques couleurs:', error)
    return null
  }
}

// =====================================
// CONTRAT DATAPACK STANDARDISÉ (BASÉ SUR LA PALETTE QUARTIER)
// =====================================

import type { DatapackRequest, DatapackResponse } from '~/lib/datapacks/contracts'

export interface DpColorResult {
  quartierColors: SuColors
}

export const getDpColorDatapack = async (
  _request: DatapackRequest
): Promise<DatapackResponse<DpColorResult>> => {
  const colorData = await getColorData()

  const data: DpColorResult = {
    quartierColors: colorData.quartierColors
  }

  const context = {
    view: 'quartier' as const,
    selectedSus: [],
    resolvedSuIds: undefined,
    isPartial: false
  }

  const response: DatapackResponse<DpColorResult> = {
    id: DATAPACK_NAME,
    version: '1.0.0',
    data,
    context,
    meta: {
      totalSuPalettes: colorData.suColors.size,
      hasQuartierPalette: !!colorData.quartierColors
    }
  }

  return response
}