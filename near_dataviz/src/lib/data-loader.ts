import type { SuBankData, SuData, DataCache } from './types'

// Client-side cache for static data
let dataCache: DataCache = {}

/*
 Load data from API with client-side caching / Chargment des données avec cache côté client
 Les datas sont statiques pour un utilisateur donné, pas besoin de reload.
*/

async function loadDataWithCache<T>(endpoint: string, cacheKey: string): Promise<T> {
  if (dataCache[cacheKey]) {
    return dataCache[cacheKey] as T
  }

  try {
    const response = await fetch(`/api/data/${endpoint}`)
    if (!response.ok) {
      throw new Error(`Failed to load ${endpoint}: ${response.statusText}`)
    }
    const data = await response.json() as T
    dataCache[cacheKey] = data
    return data
  } catch (error) {
    console.error(`Error loading ${endpoint}:`, error)
    throw error
  }
}

/* Load Su Bank data (metadata: names, colors, icons) */
export async function loadSuBankData(): Promise<SuBankData[]> {
  return loadDataWithCache<SuBankData[]>('Su%20Bank', 'suBankData')
}

/* Load Su Data (field data: population percentages, etc.) */
export async function loadSuData(): Promise<SuData[]> {
  return loadDataWithCache<SuData[]>('Su%20Data', 'suData')
}

/* Load Surveys data / Nom du quartier */
export async function loadSurveys(): Promise<Array<{ ID?: number, Name?: string }>> {
  return loadDataWithCache<Array<{ ID?: number, Name?: string }>>('Surveys', 'surveys')
}

/* Load Quartiers data (demographics + IRIS + Survey ID) */
export async function loadQuartiers(): Promise<Array<{ "Population Sum"?: number, "Survey ID"?: number }>> {
  return loadDataWithCache<Array<{ "Population Sum"?: number, "Survey ID"?: number }>>('Quartiers', 'quartiers')
}

/* Load Way Of Life Answer data */
export async function loadWayOfLifeData(): Promise<unknown[]> {
  return loadDataWithCache<unknown[]>('Way%20Of%20Life%20Answer', 'wayOfLifeData')
}

/* Load Carbon Footprint Answer data */
export async function loadCarbonFootprintData(): Promise<unknown[]> {
  return loadDataWithCache<unknown[]>('Carbon%20Footprint%20Answer', 'carbonFootprintData')
}

/* Load Meta EMDV Questions data */
export async function loadMetaEmdvQuestions(): Promise<unknown[]> {
  return loadDataWithCache<unknown[]>('MetaEmdvQuestions', 'metaEmdvQuestions')
}

/* Load Meta EMDV Choices data */
export async function loadMetaEmdvChoices(): Promise<unknown[]> {
  return loadDataWithCache<unknown[]>('MetaEmdvChoices', 'metaEmdvChoices')
}

/* Load Meta Su Questions data */
export async function loadMetaSuQuestions(): Promise<unknown[]> {
  return loadDataWithCache<unknown[]>('MetaSuQuestions', 'metaSuQuestions')
}

/* Load Meta Su Choices data */
export async function loadMetaSuChoices(): Promise<unknown[]> {
  return loadDataWithCache<unknown[]>('MetaSuChoices', 'metaSuChoices')
}

/* Load Su Answer data */
export async function loadSuAnswer(): Promise<unknown[]> {
  return loadDataWithCache<unknown[]>('Su%20Answer', 'suAnswer')
}

/* Load Forms data (pas utile pour l'instant, éventuellement utile si on se met à utiliser l'API Create de Typeform) */
export async function loadForms(): Promise<unknown[]> {
  return loadDataWithCache<unknown[]>('Forms', 'forms')
}

/* Load Meta Carbon data */
export async function loadMetaCarbon(): Promise<unknown[]> {
  return loadDataWithCache<unknown[]>('MetaCarbon', 'metaCarbon')
}

/* Load Mobility Data */
export async function loadMobilityData(): Promise<unknown[]> {
  return loadDataWithCache<unknown[]>('MobilityData', 'mobilityData')
}

/* Clear data cache */
export function clearDataCache(): void {
  dataCache = {}
}

/* cache status / debug */
export function getCacheStatus(): Record<string, boolean> {
  return Object.keys(dataCache).reduce((acc, key) => {
    acc[key] = !!dataCache[key]
    return acc
  }, {} as Record<string, boolean>)
}