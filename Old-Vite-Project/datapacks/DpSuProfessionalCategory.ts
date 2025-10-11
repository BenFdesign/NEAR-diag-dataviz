// Professional Category datapack
// - Aggregates Su Answer "Professional Category" data per SU
// - Calculates quartier as weighted mean by Pop Percentage
// - Returns labels, emojis, colors, and stacked data for visualization

import suBankRaw from '../data/Su Bank.json?raw'
import suDataRaw from '../data/Su Data.json?raw'
import metaSuQuestionsRaw from '../data/MetaSuQuestions.json?raw'
import metaSuChoicesRaw from '../data/MetaSuChoices.json?raw'
import suAnswerRaw from '../data/Su Answer.json?raw'

export type ProfessionalCategoryChoice = {
  key: string
  labelShort: string
  emoji: string
  color: string
}

export type SuProfessionalCategoryData = {
  suId: number
  nameFr: string
  color: string
  total: number
  categories: Record<string, number> // key -> count
}

export type DpSuProfessionalCategoryData = {
  id: string
  version: string
  questionTitle: string
  questionEmoji: string
  choices: ProfessionalCategoryChoice[]
  sus: SuProfessionalCategoryData[]
  quartier: {
    nameFr: string
    color: string
    total: number
    categories: Record<string, number> // weighted percentages
  }
  warnings: Array<{
    type: 'missing_fk' | 'unknown_choice'
    message: string
    suId?: number
    value?: string
  }>
}

function parseJSON<T = unknown>(raw: string): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return [] as unknown as T
  }
}

function toNumber(val: unknown): number | null {
  if (val == null) return null
  if (typeof val === 'number' && Number.isFinite(val)) return val
  if (typeof val === 'string') {
    const n = parseFloat(val.trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}

function toStringSafe(val: unknown): string {
  if (val == null) return ''
  return String(val)
}

const cache: Map<string, DpSuProfessionalCategoryData> = new Map()

export function getDpSuProfessionalCategoryData(selectedSus?: number[]): DpSuProfessionalCategoryData {
  // Create cache key based on selected SUs
  const cacheKey = selectedSus ? selectedSus.sort().join(',') : 'all'
  if (cache.has(cacheKey)) return cache.get(cacheKey)!

  const suBank = parseJSON<Array<{ Id: number | string; 'Name Fr'?: string; colorMain?: string }>>(suBankRaw)
  const suData = parseJSON<Array<{ ID: number | string; Su?: number | string; 'Pop Percentage'?: string | number }>>(suDataRaw)
  const metaQuestions = parseJSON<Array<{ Id: number; 'Question Short': string; Emoji: string; 'Metabase Question Key': string }>>(metaSuQuestionsRaw)
  const metaChoices = parseJSON<Array<{ 
    Id: number
    'Question Id': number
    'Label Short': string
    Emoji: string
    'Metabase Question Key': string
    'Metabase Choice Key': string
  }>>(metaSuChoicesRaw)
  const suAnswers = parseJSON<Array<{ 'Su ID'?: number | string; 'Professional Category'?: string; [k: string]: unknown }>>(suAnswerRaw)

  const warnings: DpSuProfessionalCategoryData['warnings'] = []

  // Find Professional Category question
  const profQuestion = metaQuestions.find(q => q['Metabase Question Key'] === 'Professional Category')
  const questionTitle = profQuestion?.['Question Short'] || 'Catégories socio-professionnelles'
  const questionEmoji = profQuestion?.Emoji || '💼📋'

  // Build choices map
  const profChoices = metaChoices.filter(c => c['Metabase Question Key'] === 'Professional Category')
  const choicesByKey = new Map<string, { labelShort: string; emoji: string }>()
  
  profChoices.forEach(choice => {
    choicesByKey.set(choice['Metabase Choice Key'], {
      labelShort: choice['Label Short'],
      emoji: choice.Emoji
    })
  })

  // Build SU maps
  const suBankById = new Map<number, { nameFr: string; color: string }>()
  for (const s of suBank) {
    const id = toNumber(s.Id)
    if (id == null || id === 0) continue // skip quartier
    suBankById.set(Math.trunc(id), {
      nameFr: toStringSafe(s['Name Fr']).trim(),
      color: toStringSafe(s.colorMain).trim() || '#666666'
    })
  }

  const popById = new Map<number, number>()
  const suNumberToIdMap = new Map<number, number>()
  for (const d of suData) {
    const id = toNumber(d.ID)
    const suNumber = toNumber(d.Su)
    const popPct = toNumber(d['Pop Percentage'])
    if (id != null && popPct != null) {
      popById.set(Math.trunc(id), popPct)
    }
    if (id != null && suNumber != null) {
      suNumberToIdMap.set(Math.trunc(suNumber), Math.trunc(id))
    }
  }

  // Aggregate counts per SU and professional category
  const suCounts = new Map<number, Map<string, number>>()
  
  for (const answer of suAnswers) {
    const suId = toNumber(answer['Su ID'])
    const profCategory = toStringSafe(answer['Professional Category']).trim()
    
    if (suId == null || suId === 0) continue // skip invalid or quartier
    
    if (!profCategory) continue // skip empty categories
    
    const suIdInt = Math.trunc(suId)
    
    // Check if SU exists in Su Bank
    if (!suBankById.has(suIdInt)) {
      warnings.push({
        type: 'missing_fk',
        message: `Su ID ${suIdInt} not found in Su Bank`,
        suId: suIdInt
      })
      continue
    }
    
    // Check if professional category is known
    if (!choicesByKey.has(profCategory)) {
      warnings.push({
        type: 'unknown_choice',
        message: `Unknown professional category: ${profCategory}`,
        suId: suIdInt,
        value: profCategory
      })
      continue
    }
    
    if (!suCounts.has(suIdInt)) {
      suCounts.set(suIdInt, new Map())
    }
    
    const categoryMap = suCounts.get(suIdInt)!
    categoryMap.set(profCategory, (categoryMap.get(profCategory) || 0) + 1)
  }

  // Build SU data (with optional filtering)
  const sus: SuProfessionalCategoryData[] = []
  const allChoiceKeys = Array.from(choicesByKey.keys())
  
  for (const [suId, suInfo] of suBankById) {
    // Skip SUs not in selected list (if filtering is enabled)
    if (selectedSus && selectedSus.length > 0) {
      // Convert selected Su numbers to Su IDs for comparison
      const selectedSuIds = selectedSus.map(suNumber => suNumberToIdMap.get(suNumber)).filter(id => id != null)
      if (selectedSuIds.length > 0 && !selectedSuIds.includes(suId)) {
        continue
      }
    }
    
    const categoryMap = suCounts.get(suId) || new Map()
    const categories: Record<string, number> = {}
    let total = 0
    
    for (const key of allChoiceKeys) {
      const count = categoryMap.get(key) || 0
      categories[key] = count
      total += count
    }
    
    sus.push({
      suId,
      nameFr: suInfo.nameFr,
      color: suInfo.color,
      total,
      categories
    })
  }

  // Calculate quartier weighted averages (for ALL SUs, not just filtered ones)
  const quartierCategories: Record<string, number> = {}
  let totalWeight = 0
  
  for (const key of allChoiceKeys) {
    quartierCategories[key] = 0
  }
  
  // Iterate through ALL SUs for quartier calculation
  for (const [suId] of suBankById) {
    const categoryMap = suCounts.get(suId) || new Map()
    const popWeight = popById.get(suId) || 0
    
    if (popWeight === 0) continue // Skip SUs without population data
    
    let suTotal = 0
    for (const key of allChoiceKeys) {
      suTotal += categoryMap.get(key) || 0
    }
    
    if (suTotal === 0) continue // Skip SUs with no data
    
    totalWeight += popWeight
    
    // Add weighted percentages (not raw counts)
    for (const key of allChoiceKeys) {
      const count = categoryMap.get(key) || 0
      const percentage = (count / suTotal) * 100
      quartierCategories[key] += percentage * popWeight
    }
  }
  
  // Normalize by total weight to get weighted average percentages
  let quartierTotal = 0
  if (totalWeight > 0) {
    for (const key of allChoiceKeys) {
      quartierCategories[key] = quartierCategories[key] / totalWeight
      quartierTotal += quartierCategories[key]
    }
  }

  // Build choices for output with colors
  const choices: ProfessionalCategoryChoice[] = allChoiceKeys.map((key, index) => {
    const choice = choicesByKey.get(key)!
    // Use Su Bank colorGraph1-10 in rotation for categories
    const quartierSu = suBank.find(s => toNumber(s.Id) === 0)
    const colorKey = `colorGraph${(index % 10) + 1}` as keyof typeof quartierSu
    const color = (quartierSu?.[colorKey] as unknown as string) || '#666666'
    
    return {
      key,
      labelShort: choice.labelShort,
      emoji: choice.emoji,
      color: toStringSafe(color).trim() || '#666666'
    }
  })

  // Sort SUs by ID for consistent output
  sus.sort((a, b) => a.suId - b.suId)

  const result = {
    id: 'DpSuProfessionalCategory',
    version: '1.0.0',
    questionTitle,
    questionEmoji,
    choices,
    sus,
    quartier: {
      nameFr: 'Quartier',
      color: toStringSafe(suBank.find(s => toNumber(s.Id) === 0)?.colorMain).trim() || '#002878',
      total: quartierTotal,
      categories: quartierCategories
    },
    warnings
  }

  cache.set(cacheKey, result)
  return result
}

export function getDpSuProfessionalCategoryText(selectedSus?: number[]): string {
  return JSON.stringify(getDpSuProfessionalCategoryData(selectedSus))
}