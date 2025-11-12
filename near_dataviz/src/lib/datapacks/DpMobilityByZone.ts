import { loadMobilityData } from '../data-loader'

const SURVEY_ID = 1
const DATAPACK_NAME = 'DpMobilityByZone'

interface MobilityRecord {
  'Su ID': number | string
  GENDER: 'MAN' | 'WOMAN'
  AGE: 'FROM_15_TO_29' | 'FROM_30_TO_44' | 'FROM_45_TO_59' | 'FROM_60_TO_74' | 'ABOVE_75'
  Time: string
  Mode: string
  Zone: string
  Destination_Zone: string
  Usage: string
}

interface ModeData {
  label: string
  value: number
}

interface UsageData {
  label: string
  value: number
}

interface ZoneData {
  destination: string
  usages: {
    unit: string
    leisure: UsageData
    shopping: UsageData
    work: UsageData
    modal: UsageData
  }
  modes: {
    unit: string
    foot: ModeData
    bike: ModeData
    car: ModeData
    transit: ModeData
  }
}

export interface MobilityResult {
  Quartier: ZoneData
  Nord1: ZoneData
  Nord2: ZoneData
  Sud1: ZoneData
  Sud2: ZoneData
  Est1: ZoneData
  Est2: ZoneData
  Ouest1: ZoneData
  Ouest2: ZoneData
}

interface MobilityFilters {
  selectedSus?: number[]
  selectedGenders?: ('MAN' | 'WOMAN')[]
  selectedAges?: ('FROM_15_TO_29' | 'FROM_30_TO_44' | 'FROM_45_TO_59' | 'FROM_60_TO_74' | 'ABOVE_75')[]
}

const getGraphZone = (destZone: string): string | null => {
  if (!destZone) return null
  if (destZone === 'ZONE_PORTE_ORLEANS_D0') return 'Quartier'
  
  const parts = destZone.split('_')
  if (parts.length < 3) return null
  
  const zoneLetter = parts[1]
  const distance = parts[2]
  
  if (zoneLetter === 'A') {
    if (distance === 'D1' || distance === 'D2') return 'Nord1'
    if (distance === 'D3' || distance === 'D4') return 'Nord2'
    if (distance === 'D0') return 'Quartier'
  }
  
  if (zoneLetter === 'B') {
    if (distance === 'D1' || distance === 'D2') return 'Sud1'
    if (distance === 'D3' || distance === 'D4') return 'Sud2'
    if (distance === 'D0') return 'Quartier'
  }
  
  if (zoneLetter === 'C') {
    if (distance === 'D1' || distance === 'D2') return 'Est1'
    if (distance === 'D3' || distance === 'D4') return 'Est2'
    if (distance === 'D0') return 'Quartier'
  }
  
  if (zoneLetter === 'D') {
    if (distance === 'D1' || distance === 'D2') return 'Ouest1'
    if (distance === 'D3' || distance === 'D4') return 'Ouest2'
    if (distance === 'D0') return 'Quartier'
  }
  
  return null
}

const getModeCategory = (mode: string): string | null => {
  if (!mode) return null
  const modeUpper = mode.toUpperCase().trim()
  
  if (modeUpper === 'WALKING') return 'foot'
  if (modeUpper === 'PERSONAL_BICYCLE' || modeUpper === 'VELIB' || modeUpper === 'SHARED_BICYCLE') return 'bike'
  if (modeUpper === 'CAR' || modeUpper === 'MOTORCYCLE' || modeUpper === 'PERSONAL_CAR') return 'car'
  if (modeUpper === 'PUBLIC_TRANSPORT' || modeUpper === 'METRO' || modeUpper === 'BUS' || modeUpper === 'TRAM') return 'transit'
  if (modeUpper === 'NONE_I_DONT_MOVE' || modeUpper === 'NONE') return null
  
  return null
}

const getUsageCategory = (usage: string): string | null => {
  if (!usage) return null
  const usageTrimmed = usage.trim()
  
  if (usageTrimmed === 'Food') return 'shopping'
  if (usageTrimmed === 'Hobby') return 'leisure'
  if (usageTrimmed === 'Work') return 'work'
  if (usageTrimmed === 'Modal') return 'modal'
  
  return null
}

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
})

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
})

const filterMobilityData = (data: MobilityRecord[], filters: MobilityFilters): MobilityRecord[] => {
  return data.filter(record => {
    if (filters.selectedSus && filters.selectedSus.length > 0) {
      const recordSuId = typeof record['Su ID'] === 'string' ? parseInt(record['Su ID']) : record['Su ID']
      if (!filters.selectedSus.includes(recordSuId)) return false
    }
    
    if (filters.selectedGenders && filters.selectedGenders.length > 0) {
      if (!filters.selectedGenders.includes(record.GENDER)) return false
    }
    
    if (filters.selectedAges && filters.selectedAges.length > 0) {
      if (!filters.selectedAges.includes(record.AGE)) return false
    }
    
    return true
  })
}

const processMobilityRecords = (records: MobilityRecord[]): MobilityResult => {
  const result = createEmptyResult()
  
  const zoneCounts: Record<string, {
    total: number
    modeCountsRaw: Record<string, number>
    usageCountsRaw: Record<string, number>
  }> = {}
  
  Object.keys(result).forEach(zoneKey => {
    zoneCounts[zoneKey] = {
      total: 0,
      modeCountsRaw: { foot: 0, bike: 0, car: 0, transit: 0 },
      usageCountsRaw: { leisure: 0, shopping: 0, work: 0, modal: 0 }
    }
  })
  
  records.forEach(record => {
    const graphZone = getGraphZone(record.Destination_Zone)
    if (!graphZone || !zoneCounts[graphZone]) return
    
    const modeCategory = getModeCategory(record.Mode)
    const usageCategory = getUsageCategory(record.Usage)
    
    if (!modeCategory) return
    
    const zoneCount = zoneCounts[graphZone]
    zoneCount.total++
    zoneCount.modeCountsRaw[modeCategory] = (zoneCount.modeCountsRaw[modeCategory] ?? 0) + 1
    if (usageCategory) {
      zoneCount.usageCountsRaw[usageCategory] = (zoneCount.usageCountsRaw[usageCategory] ?? 0) + 1
    }
  })
  
  Object.keys(result).forEach(zoneKey => {
    const zone = zoneCounts[zoneKey]
    const zoneData = result[zoneKey as keyof MobilityResult]
    
    if (!zone || zone.total === 0) return
    
    zoneData.modes.foot.value = ((zone.modeCountsRaw.foot ?? 0) / zone.total) * 100
    zoneData.modes.bike.value = ((zone.modeCountsRaw.bike ?? 0) / zone.total) * 100
    zoneData.modes.car.value = ((zone.modeCountsRaw.car ?? 0) / zone.total) * 100
    zoneData.modes.transit.value = ((zone.modeCountsRaw.transit ?? 0) / zone.total) * 100
    
    const totalUsages = Object.values(zone.usageCountsRaw).reduce((sum, count) => sum + (count ?? 0), 0)
    if (totalUsages > 0) {
      zoneData.usages.leisure.value = ((zone.usageCountsRaw.leisure ?? 0) / totalUsages) * 100
      zoneData.usages.shopping.value = ((zone.usageCountsRaw.shopping ?? 0) / totalUsages) * 100
      zoneData.usages.work.value = ((zone.usageCountsRaw.work ?? 0) / totalUsages) * 100
      zoneData.usages.modal.value = ((zone.usageCountsRaw.modal ?? 0) / totalUsages) * 100
    }
  })
  
  return result
}

export const getDpMobilityByZoneData = async (filters?: MobilityFilters): Promise<MobilityResult> => {
  try {
    const mobilityDataRaw = await loadMobilityData() as MobilityRecord[]
    const filteredRecords = filterMobilityData(mobilityDataRaw, filters ?? {})
    return processMobilityRecords(filteredRecords)
  } catch (error) {
    console.error(`[${DATAPACK_NAME}] Error loading mobility data:`, error)
    return createEmptyResult()
  }
}

export const getDpMobilityByZoneText = async (filters?: MobilityFilters): Promise<string> => {
  const data = await getDpMobilityByZoneData(filters)
  return JSON.stringify(data)
}
