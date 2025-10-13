import { loadWayOfLifeData, loadMetaEmdvQuestions, loadMetaEmdvChoices, loadSuData } from '~/lib/data-loader'

// Types for result
export interface EmdvChoice {
  choiceKey: string
  absoluteCount: number
  percentage: number
  emoji: string
}

export interface EmdvQuestionResult {
  questionKey: string
  questionTitle: string
  emoji: string
  totalResponses: number
  responses: EmdvChoice[]
}

export interface EmdvSubcategoryResult {
  subcategory: string
  subcategoryLabel: string
  subcategoryEmoji: string
  questions: EmdvQuestionResult[]
}

export interface EmdvByCategoryPayload {
  subcategories: EmdvSubcategoryResult[]
  availableSubcategories: string[]
  isQuartier: boolean
}

type WayOfLifeAnswer = Record<string, unknown> & { ['Su ID']?: number }
type MetaQuestion = Record<string, unknown> & {
  ['Metabase Question Key']?: string
  Category?: string
  Subcategory?: string
  ['Question Short']?: string
  ['Question Long']?: string
  Emoji?: string
}
type MetaChoice = Record<string, unknown> & {
  ['Metabase Question Key']?: string
  ['Metabase Choice Key']?: string | number
  Category?: string
  Emoji?: string
  ['Label Long']?: string
  ['Label Short']?: string
}
type SuDataRow = { ID: number; Su: number; ['Pop Percentage']?: string }

// no explicit cache needed; using global data-loader cache

const normalizeSuId = (suNumber: number, suData: SuDataRow[]): number => {
  const found = suData.find(s => s.Su === suNumber)
  return found ? found.ID : suNumber
}

const getAvailableSubcategories = (questions: MetaQuestion[]): string[] => {
  const set = new Set<string>()
  for (const q of questions) {
    if (q.Category === 'EmdvSatisfaction' && q.Subcategory && q.Subcategory.trim() !== '') {
      set.add(q.Subcategory)
    }
  }
  return Array.from(set).sort()
}

const getSubcategoryInfo = (subcategory: string) => {
  const map: Record<string, { label: string; emoji: string }> = {
    Food: { label: 'Alimentation', emoji: '🍽️' },
    Politics: { label: 'Politique', emoji: '🏛️' },
    NghLife: { label: 'Vie de quartier', emoji: '🏘️' },
    Services: { label: 'Services', emoji: '🏢' },
    Mobility: { label: 'Mobilité', emoji: '🚌' },
    Housing: { label: 'Logement', emoji: '🏠' },
  }
  return map[subcategory] ?? { label: subcategory, emoji: '📊' }
}

const buildForSu = (
  suLocalId: number,
  questions: MetaQuestion[],
  choices: MetaChoice[],
  wolAnswers: WayOfLifeAnswer[]
) => {
  const byQuestion: Record<string, EmdvQuestionResult> = {}
  for (const q of questions) {
    const qKey = String(q['Metabase Question Key']!)
    const qChoices = choices.filter(c => c['Metabase Question Key'] === qKey)
    const answers = wolAnswers.filter(a => a['Su ID'] === suLocalId)
    let total = 0
    const resp: EmdvChoice[] = qChoices.map((c) => {
      const ck = String(c['Metabase Choice Key'])
      let count = 0
      for (const ans of answers) {
        const v = ans[qKey]
        if (v === ck) count++
      }
      total += count
      return {
        choiceKey: ck,
        absoluteCount: count,
        percentage: 0,
        emoji: c.Emoji ? String(c.Emoji) : '😐',
      }
    })
    for (const r of resp) {
      r.percentage = total > 0 ? Math.round((r.absoluteCount / total) * 1000) / 10 : 0
    }
    byQuestion[qKey] = {
      questionKey: qKey,
  questionTitle: (q['Question Short'] ?? q['Question Long'] ?? qKey),
  emoji: (q.Emoji ?? '❓'),
      totalResponses: total,
      responses: resp,
    }
  }
  return byQuestion
}

const buildForQuartier = (
  suIds: number[],
  questions: MetaQuestion[],
  choices: MetaChoice[],
  wolAnswers: WayOfLifeAnswer[],
  suData: SuDataRow[]
) => {
  const byQuestion: Record<string, EmdvQuestionResult> = {}
  for (const q of questions) {
    const qKey = String(q['Metabase Question Key']!)
    const qChoices = choices.filter(c => c['Metabase Question Key'] === qKey)
    const resp: EmdvChoice[] = qChoices.map((c) => ({
      choiceKey: String(c['Metabase Choice Key']),
      absoluteCount: 0,
      percentage: 0,
      emoji: c.Emoji ? String(c.Emoji) : '😐',
    }))
    let totalWeighted = 0
    for (const suId of suIds) {
      const suRow = suData.find(s => s.ID === suId)
      const weight = suRow ? (parseFloat(String(suRow['Pop Percentage'] ?? '0')) / 100) : 0
      const answers = wolAnswers.filter(a => a['Su ID'] === suId)
      for (const r of resp) {
        let count = 0
        for (const ans of answers) {
          const v = ans[qKey]
          if (v === r.choiceKey) count++
        }
        const wCount = count * weight
        r.absoluteCount += wCount
      }
      totalWeighted += answers.length * weight
    }
    for (const r of resp) {
      r.percentage = totalWeighted > 0 ? Math.round((r.absoluteCount / totalWeighted) * 1000) / 10 : 0
      r.absoluteCount = Math.round(r.absoluteCount)
    }
    byQuestion[qKey] = {
      questionKey: qKey,
  questionTitle: (q['Question Short'] ?? q['Question Long'] ?? qKey),
  emoji: (q.Emoji ?? '❓'),
      totalResponses: Math.round(totalWeighted),
      responses: resp,
    }
  }
  return byQuestion
}

export async function getDpEmdvSatisfactionsByCategory(
  selectedSus?: number[],
  selectedSubcategory?: string
): Promise<EmdvByCategoryPayload> {
  const [wolRaw, qRaw, cRaw, suData] = await Promise.all([
    loadWayOfLifeData(),
    loadMetaEmdvQuestions(),
    loadMetaEmdvChoices(),
    loadSuData(),
  ])
  const wol = wolRaw as WayOfLifeAnswer[]
  const questionsAll = (qRaw as MetaQuestion[]).filter(q => q.Category === 'EmdvSatisfaction' && q['Metabase Question Key'])
  const choicesAll = (cRaw as MetaChoice[]).filter(c => c.Category === 'EmdvSatisfaction' && c['Metabase Choice Key'])
  const available = getAvailableSubcategories(questionsAll)

  const isQuartier = !selectedSus || selectedSus.length !== 1
  const suLocalId = !isQuartier && selectedSus ? normalizeSuId(selectedSus[0]!, suData as SuDataRow[]) : undefined
  const suIds = (suData as SuDataRow[]).filter(s => s.ID !== 0).map(s => s.ID)

  const subcats = selectedSubcategory && selectedSubcategory !== 'all' ? [selectedSubcategory] : available
  const out: EmdvSubcategoryResult[] = []
  for (const sub of subcats) {
    const qInSub = questionsAll.filter(q => q.Subcategory === sub)
    const qChoices = choicesAll
    const map = isQuartier
      ? buildForQuartier(suIds, qInSub, qChoices, wol, suData as SuDataRow[])
      : buildForSu(suLocalId!, qInSub, qChoices, wol)
    const questions: EmdvQuestionResult[] = qInSub
      .map(q => map[String(q['Metabase Question Key'])])
      .filter((q): q is EmdvQuestionResult => !!q)
    const info = getSubcategoryInfo(sub)
    if (questions.length > 0) {
      out.push({ subcategory: sub, subcategoryLabel: info.label, subcategoryEmoji: info.emoji, questions })
    }
  }

  const payload: EmdvByCategoryPayload = { subcategories: out, availableSubcategories: available, isQuartier }
  return payload
}

export async function exportEmdvCategory(category: string, selectedSus?: number[]) {
  return getDpEmdvSatisfactionsByCategory(selectedSus, category)
}

export async function exportAllEmdvCategories(selectedSus?: number[]) {
  const payload = await getDpEmdvSatisfactionsByCategory(selectedSus, 'all')
  return payload
}

export function clearEmdvByCategoryCache() {
  // using global data-loader cache; nothing to clear locally
}
