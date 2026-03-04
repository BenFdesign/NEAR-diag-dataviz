// Export principal pour les datapacks d'usages
// Facilite les imports et centralise les exports

// Export du datapack agrégateur principal
export { 
  getDpUsagesDatapack,
  SU_USAGES_QUESTIONS,
  type SuUsagesData,
  type QuestionMetadata
} from './DpUsages'

// Export des datapacks individuels pour usage avancé
export { 
  fetchMeatFrequencyData,
  clearMeatFrequencyCache,
  type MeatFrequencyResult
} from './DpUsagesMeatFrequency'

export { 
  fetchTransportationModeData,
  clearTransportationModeCache,
  type TransportationModeResult
} from './DpUsagesTransportationMode'

export { 
  fetchDigitalIntensityData,
  clearDigitalIntensityCache,
  type DigitalIntensityResult
} from './DpUsagesDigitalIntensity'

export { 
  fetchPurchasingStrategyData,
  clearPurchasingStrategyCache,
  type PurchasingStrategyResult
} from './DpUsagesPurchasingStrategy'

export { 
  fetchAirTravelFrequencyData,
  clearAirTravelFrequencyCache,
  type AirTravelFrequencyResult
} from './DpUsagesAirTravelFrequency'

export { 
  fetchHeatSourceData,
  clearHeatSourceCache,
  type HeatSourceResult
} from './DpUsagesHeatSource'