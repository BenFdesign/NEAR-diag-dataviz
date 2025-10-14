// DpMobilityByZone - Données de mobilité par zone/quartier
// Adapté pour le projet NEAR-diag-dataviz

// Import des données depuis le répertoire public
import mobilityDataImport from '../../../public/data/MobilityData.json'
import suDataImport from '../../../public/data/Su Data.json'

// Cast des données avec types appropriés
interface MobilityEntry {
  'Su ID': number
  Zone: string
  Mode: string
  Time: string
  Usage: string
}

const mobilityData = mobilityDataImport as MobilityEntry[]

interface SuDataEntry {
  ID: number
  Su: number
  'Pop Percentage': string
}

const suData = suDataImport as SuDataEntry[]

// ===== INTERFACES =====

interface UsageStats {
  label: string
  value: number
}

interface ModeStats {
  label: string
  value: number
}

interface ZoneStats {
  destination: string
  usages: {
    unit: string
    leisure: UsageStats
    shopping: UsageStats
    work: UsageStats
  }
  modes: {
    unit: string
    foot: ModeStats
    bike: ModeStats
    car: ModeStats
    transit: ModeStats
  }
}

type MobilityByZoneResult = Record<string, ZoneStats>

interface PrecomputedMobilityData {
  allSuResults: Map<number, MobilityByZoneResult>
  quartierResult: MobilityByZoneResult
  lastComputed: number
}

// ===== CONSTANTES =====

const DATAPACK_NAME = 'DpMobilityByZone'

// Mapping des zones vers les noms de quartiers de base
const BASE_ZONE_MAPPING: Record<string, string> = {
  'ZONE_A': 'Nord',
  'ZONE_B': 'Est',
  'ZONE_C': 'Sud',
  'ZONE_D': 'Ouest',
  'ZONE_PORTE_ORLEANS': 'Quartier'
}


// Mapping des temps (< 30min = proche, >= 30min = loin)
const TIME_THRESHOLD: Record<string, 'proche' | 'loin'> = {
  'LESS_THAN_10_MIN': 'proche',
  'BETWEEN_10_AND_20_MIN': 'proche',
  'BETWEEN_20_AND_30_MIN': 'proche',
  'BETWEEN_30_AND_45_MIN': 'loin',
  'BETWEEN_45_MIN_AND_1_HOUR': 'loin',
  'MORE_THAN_1_HOUR': 'loin'
}

// Mapping des usages
const USAGE_MAPPING: Record<string, keyof ZoneStats['usages']> = {
  'Hobby': 'leisure',
  'Food': 'shopping', 
  'Work': 'work'
}

// Mapping des modes de transport
const MODE_MAPPING: Record<string, keyof ZoneStats['modes']> = {
  'WALKING': 'foot',
  'PERSONAL_BICYCLE': 'bike',
  'SHARED_BICYCLE': 'bike',
  'PUBLIC_TRANSPORT': 'transit',
  'CAR': 'car',
  'ELECTRIC_CAR': 'car',
  'TAXI_VTC': 'car'
  //'NONE_I_DONT_MOVE': 'foot' // Traité comme piéton par défaut
}

// Labels pour les usages
const USAGE_LABELS: Record<keyof ZoneStats['usages'], string> = {
  unit: '%',
  leisure: 'Sorties, sports, loisirs',
  shopping: 'Courses alimentaires',
  work: 'Travail, études'
}

// Labels pour les modes
const MODE_LABELS: Record<keyof ZoneStats['modes'], string> = {
  unit: '%',
  foot: 'Piéton',
  bike: 'Vélo',
  car: 'Voiture, moto',
  transit: 'Bus, tram, métro'
}

let precomputedCache: PrecomputedMobilityData | null = null

// ===== FONCTIONS UTILITAIRES =====

const getSuPopPercentage = (suId: number): number => {
  const suEntry = suData.find((su: SuDataEntry) => su.ID === suId)
  return suEntry ? parseFloat(suEntry['Pop Percentage']) : 0
}

const initializeZoneStats = (zoneName: string): ZoneStats => ({
  destination: `Vers ${zoneName}`,
  usages: {
    unit: '%',
    leisure: { label: USAGE_LABELS.leisure, value: 0 },
    shopping: { label: USAGE_LABELS.shopping, value: 0 },
    work: { label: USAGE_LABELS.work, value: 0 }
  },
  modes: {
    unit: '%',
    foot: { label: MODE_LABELS.foot, value: 0 },
    bike: { label: MODE_LABELS.bike, value: 0 },
    car: { label: MODE_LABELS.car, value: 0 },
    transit: { label: MODE_LABELS.transit, value: 0 }
  }
})

// ===== CALCULS =====

const calculateMobilityForSu = (suId: number): MobilityByZoneResult => {
  const suMobilityData = mobilityData.filter((entry: MobilityEntry) => 
    entry['Su ID'] === suId && entry.Zone.trim() !== ''
  )
  
  const result: MobilityByZoneResult = {}
  
  // Générer toutes les combinaisons de zones (base + proche/loin)
  const allZones: string[] = []
  Object.values(BASE_ZONE_MAPPING).forEach(baseZone => {
    if (baseZone === 'Quartier') {
      // Le quartier central n'a pas de proche/loin
      allZones.push(baseZone)
    } else {
      allZones.push(`${baseZone}_proche`)
      allZones.push(`${baseZone}_loin`)
    }
  })
  
  // Initialiser les stats pour chaque zone
  allZones.forEach(zoneName => {
    result[zoneName] = initializeZoneStats(zoneName)
  })
  
  // Compter les occurrences par zone (avec proche/loin), usage et mode
  const zoneUsageCounts: Record<string, Record<string, number>> = {}
  const zoneModeCounts: Record<string, Record<string, number>> = {}
  const zoneTotals: Record<string, number> = {}
  
  suMobilityData.forEach((entry: MobilityEntry) => {
    const baseZone = BASE_ZONE_MAPPING[entry.Zone]
    if (!baseZone) return
    
    // Déterminer si c'est proche ou loin basé sur Time
    const timeCategory = TIME_THRESHOLD[entry.Time]
    
    // Construire le nom de zone final
    let finalZoneName: string
    if (baseZone === 'Quartier') {
      finalZoneName = baseZone
    } else if (timeCategory) {
      finalZoneName = `${baseZone}_${timeCategory}`
    } else {
      // Si pas de catégorie de temps définie, on skip
      return
    }
    
    const usageKey = USAGE_MAPPING[entry.Usage]
    const modeKey = MODE_MAPPING[entry.Mode]
    
    if (!zoneUsageCounts[finalZoneName]) {
      zoneUsageCounts[finalZoneName] = { leisure: 0, shopping: 0, work: 0 }
      zoneModeCounts[finalZoneName] = { foot: 0, bike: 0, car: 0, transit: 0 }
      zoneTotals[finalZoneName] = 0
    }
    
    if (usageKey) {
      const zoneCounts = zoneUsageCounts[finalZoneName]!
      zoneCounts[usageKey] = (zoneCounts[usageKey] ?? 0) + 1
      zoneTotals[finalZoneName] = (zoneTotals[finalZoneName] ?? 0) + 1
    }
    
    if (modeKey) {
      const modeCounts = zoneModeCounts[finalZoneName]!
      modeCounts[modeKey] = (modeCounts[modeKey] ?? 0) + 1
    }
  })
  
  // Calculer les pourcentages
  Object.entries(result).forEach(([zoneName, zoneStats]) => {
    const totalUsages = zoneTotals[zoneName] ?? 0
    const usageCounts = zoneUsageCounts[zoneName] ?? { leisure: 0, shopping: 0, work: 0 }
    const modeCounts = zoneModeCounts[zoneName] ?? { foot: 0, bike: 0, car: 0, transit: 0 }
    
    const totalModes = Object.values(modeCounts).reduce((sum, count) => sum + count, 0)
    
    if (totalUsages > 0) {
      zoneStats.usages.leisure.value = Math.round(((usageCounts.leisure ?? 0) / totalUsages) * 100)
      zoneStats.usages.shopping.value = Math.round(((usageCounts.shopping ?? 0) / totalUsages) * 100)
      zoneStats.usages.work.value = Math.round(((usageCounts.work ?? 0) / totalUsages) * 100)
    }
    
    if (totalModes > 0) {
      zoneStats.modes.foot.value = Math.round(((modeCounts.foot ?? 0) / totalModes) * 100)
      zoneStats.modes.bike.value = Math.round(((modeCounts.bike ?? 0) / totalModes) * 100)
      zoneStats.modes.car.value = Math.round(((modeCounts.car ?? 0) / totalModes) * 100)
      zoneStats.modes.transit.value = Math.round(((modeCounts.transit ?? 0) / totalModes) * 100)
    }
  })
  
  return result
}

const precomputeAllMobilityData = (): PrecomputedMobilityData => {
  console.log(`[${new Date().toISOString()}] Starting pre-computation - ${DATAPACK_NAME}`)
  const startTime = performance.now()

  const allSuIds = suData.filter((su: SuDataEntry) => su.ID !== 0).map((su: SuDataEntry) => su.ID)
  const allSuResults = new Map<number, MobilityByZoneResult>()
  
  // Calculer les données pour chaque Su
  allSuIds.forEach((suId: number) => {
    const suResult = calculateMobilityForSu(suId)
    allSuResults.set(suId, suResult)
  })
  
  // Calculer les données agrégées pour le quartier (moyenne pondérée)
  const quartierResult: MobilityByZoneResult = {}
  
  // Générer toutes les combinaisons de zones (base + proche/loin)
  const allZones: string[] = []
  Object.values(BASE_ZONE_MAPPING).forEach(baseZone => {
    if (baseZone === 'Quartier') {
      // Le quartier central n'a pas de proche/loin
      allZones.push(baseZone)
    } else {
      allZones.push(`${baseZone}_proche`)
      allZones.push(`${baseZone}_loin`)
    }
  })
  
  // Initialiser les zones
  allZones.forEach(zoneName => {
    quartierResult[zoneName] = initializeZoneStats(zoneName)
  })
  
  // Calculer les moyennes pondérées par Pop Percentage
  const totalPopPercentage = allSuIds.reduce((sum, suId) => sum + getSuPopPercentage(suId), 0)
  
  if (totalPopPercentage > 0) {
    Object.keys(quartierResult).forEach(zoneName => {
      let weightedUsageLeisure = 0, weightedUsageShopping = 0, weightedUsageWork = 0
      let weightedModeFoot = 0, weightedModeBike = 0, weightedModeCar = 0, weightedModeTransit = 0
      
      allSuIds.forEach(suId => {
        const suResult = allSuResults.get(suId)
        const popPercentage = getSuPopPercentage(suId)
        const weight = popPercentage / totalPopPercentage
        
        if (suResult?.[zoneName]) {
          const zoneData = suResult[zoneName]
          
          weightedUsageLeisure += zoneData.usages.leisure.value * weight
          weightedUsageShopping += zoneData.usages.shopping.value * weight
          weightedUsageWork += zoneData.usages.work.value * weight
          
          weightedModeFoot += zoneData.modes.foot.value * weight
          weightedModeBike += zoneData.modes.bike.value * weight
          weightedModeCar += zoneData.modes.car.value * weight
          weightedModeTransit += zoneData.modes.transit.value * weight
        }
      })
      
      if (quartierResult[zoneName]) {
        quartierResult[zoneName].usages.leisure.value = Math.round(weightedUsageLeisure)
        quartierResult[zoneName].usages.shopping.value = Math.round(weightedUsageShopping)
        quartierResult[zoneName].usages.work.value = Math.round(weightedUsageWork)
        
        quartierResult[zoneName].modes.foot.value = Math.round(weightedModeFoot)
        quartierResult[zoneName].modes.bike.value = Math.round(weightedModeBike)
        quartierResult[zoneName].modes.car.value = Math.round(weightedModeCar)
        quartierResult[zoneName].modes.transit.value = Math.round(weightedModeTransit)
      }
    })
  }

  const endTime = performance.now()
  console.log(`[${DATAPACK_NAME}] Pre-computation completed in ${(endTime - startTime).toFixed(2)}ms`)

  return {
    allSuResults,
    quartierResult,
    lastComputed: Date.now()
  }
}

const getPrecomputedData = (): PrecomputedMobilityData => {
  precomputedCache ??= precomputeAllMobilityData()
  return precomputedCache
}

// ===== FONCTION D'EXPORT PRINCIPALE =====

export function fetchMobilityByZoneData(selectedSus?: number[]): MobilityByZoneResult {
  const precomputed = getPrecomputedData()
  
  const isQuartierView = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1
  
  if (isQuartierView) {
    return precomputed.quartierResult
  } else {
    // Convertir le numéro Su en ID
    const targetSu = selectedSus[0]!
    const suEntry = suData.find((su: SuDataEntry) => su.Su === targetSu)
    const targetSuId = suEntry ? suEntry.ID : targetSu
    
    return precomputed.allSuResults.get(targetSuId) ?? precomputed.quartierResult
  }
}

export function clearMobilityByZoneCache(): void {
  precomputedCache = null
  console.log(`[${new Date().toISOString()}] Cache cleared - ${DATAPACK_NAME}`)
}

export function runMobilityByZoneTests(): boolean {
  console.log(`[TEST] Starting tests for ${DATAPACK_NAME}`)
  let allTestsPassed = true
  
  try {
    clearMobilityByZoneCache()
    const data1 = fetchMobilityByZoneData()
    console.log('✅ Quartier data loaded:', Object.keys(data1).length > 0)

    const data2 = fetchMobilityByZoneData([1])
    console.log('✅ Single SU data loaded:', Object.keys(data2).length > 0)

    const data3 = fetchMobilityByZoneData([1, 2])
    console.log('✅ Multiple SUs return quartier data:', Object.keys(data3).length > 0)
    
    // Test structure des données
    const firstZone = Object.values(data1)[0]
    if (firstZone) {
      console.log('✅ Data structure valid:', 
        'usages' in firstZone && 
        'modes' in firstZone &&
        'destination' in firstZone)
    }
    
  } catch (error) {
    console.error('❌ MobilityByZone test failed:', error)
    allTestsPassed = false
  }
  
  return allTestsPassed
}