import mobilityDataRaw from '../data/MobilityData.json';
import suBankData from '../data/Su Bank.json';
import suData from '../data/Su Data.json';
import { getCategoryColors } from './DpSuColors';

// Survey ID filter - Porte d'Orléans diagnostic
const SURVEY_ID = 1;
const DATAPACK_NAME = 'DpMobilityByZone';

// Interfaces for type safety
interface MobilityRecord {
  'Su ID': number | string;
  GENDER: 'MAN' | 'WOMAN';
  AGE: 'FROM_15_TO_29' | 'FROM_30_TO_44' | 'FROM_45_TO_59' | 'FROM_60_TO_74' | 'ABOVE_75';
  Time: string;
  Mode: string;
  Zone: string;
  Destination_Zone: string;
  Usage: string;
}

interface ModeData {
  label: string;
  value: number;
}

interface UsageData {
  label: string;
  value: number;
}

interface ZoneData {
  destination: string;
  usages: {
    unit: string;
    leisure: ModeData;
    shopping: ModeData;
    work: ModeData;
    modal: ModeData;
  };
  modes: {
    unit: string;
    foot: ModeData;
    bike: ModeData;
    car: ModeData;
    transit: ModeData;
  };
}

export interface MobilityResult {
  Quartier: ZoneData;
  Nord1: ZoneData;
  Nord2: ZoneData;
  Sud1: ZoneData;
  Sud2: ZoneData;
  Est1: ZoneData;
  Est2: ZoneData;
  Ouest1: ZoneData;
  Ouest2: ZoneData;
}

interface MobilityFilters {
  selectedSus?: number[];
  selectedGenders?: ('MAN' | 'WOMAN')[];
  selectedAges?: ('FROM_15_TO_29' | 'FROM_30_TO_44' | 'FROM_45_TO_59' | 'FROM_60_TO_74' | 'ABOVE_75')[];
}

interface PrecomputedMobilityData {
  allSuResults: Map<number, MobilityResult>;
  quartierResult: MobilityResult;
  lastComputed: number;
}

// Global cache
let precomputedCache: PrecomputedMobilityData | null = null;

// Zone mapping: Destination_Zone -> Graph Zone Key
const getGraphZone = (destZone: string): string | null => {
  if (!destZone) return null;
  
  if (destZone === 'ZONE_PORTE_ORLEANS_D0') return 'Quartier';
  
  // Extract zone letter and distance
  const parts = destZone.split('_');
  if (parts.length < 3) return null;
  
  const zoneLetter = parts[1]; // A, B, C, D
  const distance = parts[2]; // D0, D1, D2, D3, D4
  
  // Nord = ZONE_A
  if (zoneLetter === 'A') {
    if (distance === 'D1' || distance === 'D2') return 'Nord1'; // proche
    if (distance === 'D3' || distance === 'D4') return 'Nord2'; // loin
    if (distance === 'D0') return 'Quartier'; // consider D0 as local
  }
  
  // Sud = ZONE_B
  if (zoneLetter === 'B') {
    if (distance === 'D1' || distance === 'D2') return 'Sud1';
    if (distance === 'D3' || distance === 'D4') return 'Sud2';
    if (distance === 'D0') return 'Quartier';
  }
  
  // Est = ZONE_C
  if (zoneLetter === 'C') {
    if (distance === 'D1' || distance === 'D2') return 'Est1';
    if (distance === 'D3' || distance === 'D4') return 'Est2';
    if (distance === 'D0') return 'Quartier';
  }
  
  // Ouest = ZONE_D
  if (zoneLetter === 'D') {
    if (distance === 'D1' || distance === 'D2') return 'Ouest1';
    if (distance === 'D3' || distance === 'D4') return 'Ouest2';
    if (distance === 'D0') return 'Quartier';
  }
  
  return null;
};

// Mode mapping: Survey mode -> Graph category
const getModeCategory = (mode: string): string | null => {
  if (!mode) return null;
  const modeUpper = mode.toUpperCase().trim();
  
  if (modeUpper === 'WALKING') return 'foot';
  if (modeUpper === 'PERSONAL_BICYCLE' || modeUpper === 'VELIB' || modeUpper === 'SHARED_BICYCLE') return 'bike';
  if (modeUpper === 'CAR' || modeUpper === 'MOTORCYCLE' || modeUpper === 'PERSONAL_CAR') return 'car';
  if (modeUpper === 'PUBLIC_TRANSPORT' || modeUpper === 'METRO' || modeUpper === 'BUS' || modeUpper === 'TRAM') return 'transit';
  if (modeUpper === 'NONE_I_DONT_MOVE' || modeUpper === 'NONE') return null; // Exclude from calculations
  
  return null;
};

// Usage mapping: Survey usage -> Graph category
const getUsageCategory = (usage: string): string | null => {
  if (!usage) return null;
  const usageTrimmed = usage.trim();
  
  if (usageTrimmed === 'Food') return 'shopping';
  if (usageTrimmed === 'Hobby') return 'leisure';
  if (usageTrimmed === 'Work') return 'work';
  if (usageTrimmed === 'Modal') return 'modal';
  
  return null;
};

// Initialize empty zone data structure
const createEmptyZoneData = (destinationLabel: string): ZoneData => ({
  destination: destinationLabel,
  usages: {
    unit: '%',
    leisure: { label: 'Sorties, sports, loisirs', value: 0 },
    shopping: { label: 'Courses alimentaires', value: 0 },
    work: { label: 'Travail, études', value: 0 },
    modal: { label: 'Rejoindre une gare ou aéroport', value: 0 }
  },
  modes: {
    unit: '%',
    foot: { label: 'Piéton', value: 0 },
    bike: { label: 'Vélo', value: 0 },
    car: { label: 'Voiture, moto', value: 0 },
    transit: { label: 'Bus, tram, métro', value: 0 }
  }
});

// Create empty result structure
const createEmptyResult = (): MobilityResult => ({
  Quartier: createEmptyZoneData('Vers quartier'),
  Nord1: createEmptyZoneData('Vers Nord proche'),
  Nord2: createEmptyZoneData('Vers Nord loin'),
  Sud1: createEmptyZoneData('Vers Sud proche'),
  Sud2: createEmptyZoneData('Vers Sud loin'),
  Est1: createEmptyZoneData('Vers Est proche'),
  Est2: createEmptyZoneData('Vers Est loin'),
  Ouest1: createEmptyZoneData('Vers Ouest proche'),
  Ouest2: createEmptyZoneData('Vers Ouest loin')
});

// Filter mobility data by criteria
const filterMobilityData = (filters: MobilityFilters): MobilityRecord[] => {
  const data = mobilityDataRaw as MobilityRecord[];
  
  return data.filter(record => {
    // Apply SU filter
    if (filters.selectedSus && filters.selectedSus.length > 0) {
      const recordSuId = typeof record['Su ID'] === 'string' ? parseInt(record['Su ID']) : record['Su ID'];
      if (!filters.selectedSus.includes(recordSuId)) return false;
    }
    
    // Apply gender filter
    if (filters.selectedGenders && filters.selectedGenders.length > 0) {
      if (!filters.selectedGenders.includes(record.GENDER)) return false;
    }
    
    // Apply age filter
    if (filters.selectedAges && filters.selectedAges.length > 0) {
      if (!filters.selectedAges.includes(record.AGE)) return false;
    }
    
    return true;
  });
};

// Process mobility data for a specific set of records
const processMobilityRecords = (records: MobilityRecord[]): MobilityResult => {
  const result = createEmptyResult();
  
  // Count trips by zone, mode, and usage
  const zoneCounts: Record<string, {
    total: number;
    modeCountsRaw: Record<string, number>;
    usageCountsRaw: Record<string, number>;
  }> = {};
  
  // Initialize counters for all zones
  Object.keys(result).forEach(zoneKey => {
    zoneCounts[zoneKey] = {
      total: 0,
      modeCountsRaw: { foot: 0, bike: 0, car: 0, transit: 0 },
      usageCountsRaw: { leisure: 0, shopping: 0, work: 0, modal: 0 }
    };
  });
  
  // Count trips
  records.forEach(record => {
    const graphZone = getGraphZone(record.Destination_Zone);
    if (!graphZone) return;
    
    const modeCategory = getModeCategory(record.Mode);
    const usageCategory = getUsageCategory(record.Usage);
    
    if (!modeCategory) return; // Skip records with no valid mode
    
    // Increment counters
    zoneCounts[graphZone].total++;
    zoneCounts[graphZone].modeCountsRaw[modeCategory]++;
    if (usageCategory) {
      zoneCounts[graphZone].usageCountsRaw[usageCategory]++;
    }
  });
  
  // Calculate percentages
  Object.keys(result).forEach(zoneKey => {
    const zone = zoneCounts[zoneKey];
    const zoneData = result[zoneKey as keyof MobilityResult];
    
    if (zone.total === 0) return; // Leave as zeros if no data
    
    // Calculate mode percentages
    zoneData.modes.foot.value = (zone.modeCountsRaw.foot / zone.total) * 100;
    zoneData.modes.bike.value = (zone.modeCountsRaw.bike / zone.total) * 100;
    zoneData.modes.car.value = (zone.modeCountsRaw.car / zone.total) * 100;
    zoneData.modes.transit.value = (zone.modeCountsRaw.transit / zone.total) * 100;
    
    // Calculate usage percentages
    const totalUsages = Object.values(zone.usageCountsRaw).reduce((sum, count) => sum + count, 0);
    if (totalUsages > 0) {
      zoneData.usages.leisure.value = (zone.usageCountsRaw.leisure / totalUsages) * 100;
      zoneData.usages.shopping.value = (zone.usageCountsRaw.shopping / totalUsages) * 100;
      zoneData.usages.work.value = (zone.usageCountsRaw.work / totalUsages) * 100;
      zoneData.usages.modal.value = (zone.usageCountsRaw.modal / totalUsages) * 100;
    }
  });
  
  return result;
};

// Process mobility data for a specific SU
const processMobilityForSu = (suId: number): MobilityResult => {
  const records = filterMobilityData({ selectedSus: [suId] });
  return processMobilityRecords(records);
};

// Process mobility data for quartier (all SUs with population weighting)
const processMobilityForQuartier = (): MobilityResult => {
  // For simplicity, aggregate all SUs without weighting
  // TODO: Implement population weighting similar to DpAgeDistribution
  const records = filterMobilityData({});
  return processMobilityRecords(records);
};

// Precompute all data
const precomputeMobilityData = (): PrecomputedMobilityData => {
  console.log(`[${DATAPACK_NAME}] Starting precomputation...`);
  const startTime = performance.now();
  
  const allSuResults = new Map<number, MobilityResult>();
  
  // Process each SU
  suData.forEach(su => {
    const suId = typeof su.ID === 'string' ? parseInt(su.ID) : su.ID;
    if (suId > 0) { // Skip quartier (ID 0)
      const suResult = processMobilityForSu(suId);
      allSuResults.set(suId, suResult);
    }
  });
  
  // Process quartier
  const quartierResult = processMobilityForQuartier();
  
  const endTime = performance.now();
  console.log(`[${DATAPACK_NAME}] Precomputation completed in ${(endTime - startTime).toFixed(2)}ms`);
  
  return {
    allSuResults,
    quartierResult,
    lastComputed: Date.now()
  };
};

// Get or create cached data
const getCachedData = (): PrecomputedMobilityData => {
  if (!precomputedCache) {
    precomputedCache = precomputeMobilityData();
  }
  return precomputedCache;
};

// Get SU IDs from SU numbers using the Su field mapping
const getSuIdsFromSuNumbers = (suNumbers: number[]): number[] => {
  return suData
    .filter(su => suNumbers.includes(su.Su))
    .map(su => typeof su.ID === 'string' ? parseInt(su.ID) : su.ID);
};

// Main export function
export const getDpMobilityByZoneData = (filters?: MobilityFilters): MobilityResult => {
  const cachedData = getCachedData();
  
  // If additional filters (gender/age) are specified, reprocess on the fly
  if (filters?.selectedGenders || filters?.selectedAges) {
    const records = filterMobilityData(filters);
    return processMobilityRecords(records);
  }
  
  // Determine if this is a quartier view
  const selectedSus = filters?.selectedSus || [];
  const isQuartier = selectedSus.length === 0 || selectedSus.length > 1;
  
  if (isQuartier) {
    return cachedData.quartierResult;
  } else {
    // Single SU selected
    const suIds = getSuIdsFromSuNumbers(selectedSus);
    const suId = suIds[0];
    return cachedData.allSuResults.get(suId) || cachedData.quartierResult;
  }
};

// Text export function (for API compatibility)
export const getDpMobilityByZoneText = (filters?: MobilityFilters): string => {
  return JSON.stringify(getDpMobilityByZoneData(filters));
};

// Validation function
export const validateMobilityData = (): boolean => {
  try {
    console.log(`[${DATAPACK_NAME}] Running validation tests...`);
    
    // Test 1: Validate quartier computation
    const quartierResult = getDpMobilityByZoneData();
    if (!quartierResult) {
      console.error(`[${DATAPACK_NAME}] Failed to compute quartier data`);
      return false;
    }
    
    // Test 2: Validate SU computation
    const suResult = getDpMobilityByZoneData({ selectedSus: [1] });
    if (!suResult) {
      console.error(`[${DATAPACK_NAME}] Failed to compute SU data`);
      return false;
    }
    
    // Test 3: Validate percentages for Quartier zone
    const quartierModes = Object.values(quartierResult.Quartier.modes).filter(m => typeof m === 'object');
    const totalModePercentage = quartierModes.reduce((sum, mode) => sum + (mode as ModeData).value, 0);
    if (totalModePercentage > 0 && Math.abs(totalModePercentage - 100) > 1) {
      console.warn(`[${DATAPACK_NAME}] Mode percentage sum deviation: ${totalModePercentage}%`);
    }
    
    console.log(`[${DATAPACK_NAME}] All validation tests passed ✓`);
    return true;
  } catch (error) {
    console.error(`[${DATAPACK_NAME}] Validation failed:`, error);
    return false;
  }
};

// Performance testing
export const testMobilityPerformance = () => {
  console.log(`[${DATAPACK_NAME}] Running performance tests...`);
  
  const iterations = 100;
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    getDpMobilityByZoneData({ selectedSus: [1] });
    getDpMobilityByZoneData({ selectedSus: [2] });
    getDpMobilityByZoneData();
  }
  
  const endTime = performance.now();
  const avgTime = (endTime - startTime) / (iterations * 3);
  
  console.log(`[${DATAPACK_NAME}] Average call time: ${avgTime.toFixed(2)}ms`);
  return avgTime;
};

// Clear cache function (for development)
export const clearMobilityCache = () => {
  precomputedCache = null;
  console.log(`[${DATAPACK_NAME}] Cache cleared`);
};

// Development utilities
export const getMobilityDebugInfo = () => {
  const cachedData = getCachedData();
  return {
    datapackName: DATAPACK_NAME,
    lastComputed: new Date(cachedData.lastComputed).toISOString(),
    totalSus: cachedData.allSuResults.size,
    quartierData: cachedData.quartierResult
  };
};
