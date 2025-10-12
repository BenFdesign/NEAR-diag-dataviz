/**
 * SERVICE CENTRAL - Mappage des ID SU
 * 
 * Gère la correspondance entre :
 * - ID local (1, 2, 3...) : Pour l'UI et l'affichage
 * - ID global (477, 478, 479...) : Pour le filtrage backend
 * - Survey ID : Pour identifier les quartiers
 */

// =====================================
// INTERFACES
// =====================================

interface SuBankItem {
  Id: number           // ID global (477, 478, 479...)
  "Name Fr": string    // Nom français
  colorMain: string    // Couleur principale
  [key: string]: unknown
}

interface SuIdMapping {
  localId: number      // ID local pour l'UI (1, 2, 3...)
  globalId: number     // ID global pour les données (477, 478, 479...)
  name: string         // Nom de la SU
  color: string        // Couleur principale
  surveyId?: number    // Survey ID si applicable
}

// =====================================
// CACHE ET ÉTAT
// =====================================

let suMappingCache: SuIdMapping[] | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 3600000 // 1 heure

// =====================================
// FONCTIONS PRINCIPALES
// =====================================

/**
 * Charge et met en cache le mappage des ID depuis Su Bank.json
 */
const loadSuIdMapping = async (): Promise<SuIdMapping[]> => {
  const now = Date.now()
  
  // Vérifier le cache
  if (suMappingCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return suMappingCache
  }
  
  try {
    console.log('🔄 Chargement du mappage des ID SU...')
    
    const response = await fetch('/api/data/Su%20Bank')
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    
    const suBankData = await response.json() as SuBankItem[]
    
    // Filtrer et mapper les SU (exclure le quartier ID 0)
    const realSus = suBankData
      .filter(su => su.Id > 0)
      .sort((a, b) => a.Id - b.Id)
    
    // Créer le mappage local ↔ global
    const mapping: SuIdMapping[] = realSus.map((su, index) => ({
      localId: index + 1,          // 1, 2, 3...
      globalId: su.Id,             // 477, 478, 479...
      name: su["Name Fr"] || `SU ${su.Id}`,
      color: su.colorMain || '#002878'
    }))
    
    console.log(`✅ Mappage créé: ${mapping.length} SU`)
    console.log('📋 Correspondances:', mapping.map(m => `${m.localId}→${m.globalId}`).join(', '))
    
    // Mettre en cache
    suMappingCache = mapping
    cacheTimestamp = now
    
    return mapping
    
  } catch (error) {
    console.error('❌ Erreur lors du chargement du mappage SU:', error)
    return []
  }
}

/**
 * Convertit les ID locaux (1, 2, 3...) vers les ID globaux (477, 478, 479...)
 * @param localIds - ID locaux de l'UI
 * @returns ID globaux pour le backend
 */
export const mapLocalToGlobalIds = async (localIds: number[]): Promise<number[]> => {
  if (!localIds || localIds.length === 0) return []
  
  // Si les ID sont déjà dans la gamme globale (477+), les retourner tels quels
  if (localIds.every(id => id >= 477)) {
    console.log('🔍 ID déjà globaux:', localIds)
    return localIds
  }
  
  try {
    const mapping = await loadSuIdMapping()
    
    const globalIds = localIds.map(localId => {
      const mapped = mapping.find(m => m.localId === localId)
      
      if (mapped) {
        console.log(`🔄 Mappage: ID local ${localId} → ID global ${mapped.globalId}`)
        return mapped.globalId
      }
      
      console.warn(`⚠️ ID local ${localId} non trouvé dans le mappage`)
      return localId // Fallback
    })
    
    return globalIds
    
  } catch (error) {
    console.error('❌ Erreur lors du mappage local→global:', error)
    return localIds // Fallback
  }
}

/**
 * Convertit les ID globaux (477, 478, 479...) vers les ID locaux (1, 2, 3...)
 * @param globalIds - ID globaux du backend
 * @returns ID locaux pour l'UI
 */
export const mapGlobalToLocalIds = async (globalIds: number[]): Promise<number[]> => {
  if (!globalIds || globalIds.length === 0) return []
  
  // Si les ID sont déjà dans la gamme locale (1-10), les retourner tels quels
  if (globalIds.every(id => id >= 1 && id <= 10)) {
    console.log('🔍 ID déjà locaux:', globalIds)
    return globalIds
  }
  
  try {
    const mapping = await loadSuIdMapping()
    
    const localIds = globalIds.map(globalId => {
      const mapped = mapping.find(m => m.globalId === globalId)
      
      if (mapped) {
        console.log(`🔄 Mappage: ID global ${globalId} → ID local ${mapped.localId}`)
        return mapped.localId
      }
      
      console.warn(`⚠️ ID global ${globalId} non trouvé dans le mappage`)
      return globalId // Fallback
    })
    
    return localIds
    
  } catch (error) {
    console.error('❌ Erreur lors du mappage global→local:', error)
    return globalIds // Fallback
  }
}

/**
 * Récupère les informations complètes d'une SU par son ID local
 * @param localId - ID local (1, 2, 3...)
 * @returns Informations de la SU
 */
export const getSuInfoByLocalId = async (localId: number): Promise<SuIdMapping | null> => {
  try {
    const mapping = await loadSuIdMapping()
    return mapping.find(m => m.localId === localId) ?? null
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des infos SU:', error)
    return null
  }
}

/**
 * Récupère les informations complètes d'une SU par son ID global
 * @param globalId - ID global (477, 478, 479...)
 * @returns Informations de la SU
 */
export const getSuInfoByGlobalId = async (globalId: number): Promise<SuIdMapping | null> => {
  try {
    const mapping = await loadSuIdMapping()
    return mapping.find(m => m.globalId === globalId) ?? null
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des infos SU:', error)
    return null
  }
}

/**
 * Récupère la liste complète des SU avec leurs mappings
 * @returns Liste complète des correspondances
 */
export const getAllSuMappings = async (): Promise<SuIdMapping[]> => {
  try {
    return await loadSuIdMapping()
  } catch (error) {
    console.error('❌ Erreur lors de la récupération de tous les mappings:', error)
    return []
  }
}

/**
 * Vide le cache (pour les tests et le développement)
 */
export const clearSuMappingCache = (): void => {
  suMappingCache = null
  cacheTimestamp = 0
  console.log('🧹 Cache de mappage SU vidé')
}

/**
 * Fonction de test pour vérifier le mappage
 */
export const testSuIdMapping = async (): Promise<void> => {
  console.log('🧪 Test du service de mappage des ID SU...')
  
  try {
    // Test du chargement du mappage
    const mappings = await getAllSuMappings()
    console.log('✅ Mappings chargés:', mappings.length, 'SU')
    
    if (mappings.length === 0) {
      console.warn('⚠️ Aucun mappage trouvé')
      return
    }
    
    // Test mappage local → global
    const testLocalIds = [1, 2]
    const globalIds = await mapLocalToGlobalIds(testLocalIds)
    console.log('✅ Test local→global:', testLocalIds, '→', globalIds)
    
    // Test mappage global → local
    const localIds = await mapGlobalToLocalIds(globalIds)
    console.log('✅ Test global→local:', globalIds, '→', localIds)
    
    // Test récupération d'infos
    const suInfo = await getSuInfoByLocalId(1)
    console.log('✅ Info SU 1:', suInfo)
    
    console.log('✅ Tous les tests de mappage terminés!')
    
  } catch (error) {
    console.error('❌ Test de mappage échoué:', error)
  }
}