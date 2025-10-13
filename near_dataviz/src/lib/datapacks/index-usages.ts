// Export principal pour les datapacks d'usages
// Facilite les imports et centralise les exports

// Export du datapack agrégateur principal
export { 
  fetchSuUsagesData, 
  fetchSuUsagesExtendedData,
  testSuUsages,
  runAllUsagesTests,
  SU_USAGES_QUESTIONS,
  type SuUsagesData,
  type QuestionMetadata
} from './DpUsages'

// Export des datapacks individuels pour usage avancé
export { 
  fetchMeatFrequencyData,
  clearMeatFrequencyCache,
  runMeatFrequencyTests,
  type MeatFrequencyResult
} from './DpUsagesMeatFrequency'

export { 
  fetchTransportationModeData,
  clearTransportationModeCache,
  runTransportationModeTests,
  type TransportationModeResult
} from './DpUsagesTransportationMode'

export { 
  fetchDigitalIntensityData,
  clearDigitalIntensityCache,
  runDigitalIntensityTests,
  type DigitalIntensityResult
} from './DpUsagesDigitalIntensity'

export { 
  fetchPurchasingStrategyData,
  clearPurchasingStrategyCache,
  runPurchasingStrategyTests,
  type PurchasingStrategyResult
} from './DpUsagesPurchasingStrategy'

export { 
  fetchAirTravelFrequencyData,
  clearAirTravelFrequencyCache,
  runAirTravelFrequencyTests,
  type AirTravelFrequencyResult
} from './DpUsagesAirTravelFrequency'

export { 
  fetchHeatSourceData,
  clearHeatSourceCache,
  runHeatSourceTests,
  type HeatSourceResult
} from './DpUsagesHeatSource'