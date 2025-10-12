/**
 * INDEX des services
 * 
 * Centralise l'export de tous les services utilitaires
 */

// Service de mappage des ID SU
export {
  mapLocalToGlobalIds,
  mapGlobalToLocalIds,
  getSuInfoByLocalId,
  getSuInfoByGlobalId,
  getAllSuMappings,
  clearSuMappingCache,
  testSuIdMapping
} from './suIdMapping'