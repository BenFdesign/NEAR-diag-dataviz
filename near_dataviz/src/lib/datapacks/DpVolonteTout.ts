/**
 * DATAPACK - Volonté (toutes les questions is_will)
 *
 * - SU spécifique: calcule la distribution des réponses par question à partir de Way Of Life Answer
 * - Quartier: moyenne pondérée des SUs avec Su Data (Pop Percentage)
 * - Métadonnées via MetaEmdvChoices (is_will: true) et MetaEmdvQuestions
 */

import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'

// =========================
// Types
// =========================

interface MetaEmdvChoice {
  Id: number
  TypeData: string
  is_will?: boolean
  Emoji?: string
  "Label Origin"?: string
  "Label Long"?: string
  "Label Short"?: string
  "Metabase Question Key": string
  "Metabase Choice Key": string
}

interface MetaEmdvQuestion {
  Id: number
  Emoji?: string
  "Question Origin"?: string
  "Question Long"?: string
  "Question Short"?: string
  "Question Declarative"?: string
  "Metabase Question Key": string
}

interface WayOfLifeAnswer {
  ID: number
  "Su ID": number
  [key: string]: unknown
}

interface SuBankRow { Id: number }

interface SuDataRow { ID: number; "Pop Percentage"?: string }

export interface VolonteChoiceResponse {
  choiceKey: string
  choiceLabels: { labelLong: string; labelShort: string; emoji: string }
  absoluteCount: number
  percentage: number
}

export interface VolonteQuestionData {
  questionKey: string
  questionLabels: {
    title: string
    emoji: string
    questionOrigin: string
    questionShort: string
  }
  totalResponses: number
  responses: VolonteChoiceResponse[]
}

export interface VolonteToutResult {
  data: VolonteQuestionData[]
  isQuartier: boolean
  suId: number
  summary: {
    totalQuestions: number
    dataSource: string
    computationType: string
  }
}

// =========================
// Cache
// =========================

const CACHE_MS = 60 * 60 * 1000
const cache = new Map<string, { ts: number; value: VolonteToutResult }>()

// =========================
// Loaders (via /api/data)
// =========================

const loadMetaEmdvChoices = async (): Promise<MetaEmdvChoice[]> => {
  try {
    const res = await fetch('/api/data/MetaEmdvChoices')
    if (!res.ok) throw new Error(String(res.status))
  return await res.json() as MetaEmdvChoice[]
  } catch (e) {
    console.warn('⚠️ MetaEmdvChoices load failed', e)
    return []
  }
}

const loadMetaEmdvQuestions = async (): Promise<MetaEmdvQuestion[]> => {
  try {
    const res = await fetch('/api/data/MetaEmdvQuestions')
    if (!res.ok) throw new Error(String(res.status))
  return await res.json() as MetaEmdvQuestion[]
  } catch (e) {
    console.warn('⚠️ MetaEmdvQuestions load failed', e)
    return []
  }
}

const loadWayOfLifeAnswers = async (): Promise<WayOfLifeAnswer[]> => {
  try {
    const res = await fetch('/api/data/Way%20Of%20Life%20Answer')
    if (!res.ok) throw new Error(String(res.status))
  return await res.json() as WayOfLifeAnswer[]
  } catch (e) {
    console.warn('⚠️ Way Of Life Answer load failed', e)
    return []
  }
}

const loadSuBank = async (): Promise<SuBankRow[]> => {
  try {
    const res = await fetch('/api/data/Su%20Bank')
    if (!res.ok) throw new Error(String(res.status))
  return await res.json() as SuBankRow[]
  } catch (e) {
    console.warn('⚠️ Su Bank load failed', e)
    return []
  }
}

const loadSuData = async (): Promise<SuDataRow[]> => {
  try {
    const res = await fetch('/api/data/Su%20Data')
    if (!res.ok) throw new Error(String(res.status))
  return await res.json() as SuDataRow[]
  } catch (e) {
    console.warn('⚠️ Su Data load failed', e)
    return []
  }
}

// =========================
// Helpers
// =========================

const getWillQuestionsGrouped = (choices: MetaEmdvChoice[]) => {
  const willChoices = choices.filter(c => c.is_will === true && c.TypeData === 'CatChoixUnique' && !!c['Metabase Question Key'] && !!c['Metabase Choice Key'])
  const map = new Map<string, MetaEmdvChoice[]>()
  for (const c of willChoices) {
    const key = c['Metabase Question Key']
    const arr = map.get(key)
    if (arr) arr.push(c); else map.set(key, [c])
  }
  return map
}

const getBestTitleForQuestion = (q: MetaEmdvQuestion | undefined, fallbackKey: string) => {
  // Project rule: prefer Question Short, fallback to Question Long, then key
  return q?.['Question Short'] ?? q?.['Question Long'] ?? fallbackKey
}

// =========================
// Core compute
// =========================

const computeForSu = (
  suId: number,
  willQuestions: Map<string, MetaEmdvChoice[]>,
  metaQuestions: MetaEmdvQuestion[],
  answers: WayOfLifeAnswer[]
): VolonteQuestionData[] => {
  const suAnswers = answers.filter(a => a['Su ID'] === suId)
  const results: VolonteQuestionData[] = []

  willQuestions.forEach((choices, questionKey) => {
    const questionMeta = metaQuestions.find(q => q['Metabase Question Key'] === questionKey)
    const title = getBestTitleForQuestion(questionMeta, questionKey)
    const questionLabels = {
      title,
      emoji: questionMeta?.Emoji ?? '🎯',
      questionOrigin: questionMeta?.['Question Origin'] ?? '',
      questionShort: (questionMeta?.['Question Short'] ?? questionMeta?.['Question Long'] ?? title)
    }

    let totalResponses = 0
    const responses: VolonteChoiceResponse[] = choices.map(choice => {
      const choiceKey = String(choice['Metabase Choice Key'])
      let count = 0
      for (const ans of suAnswers) {
        const val = ans[questionKey as keyof WayOfLifeAnswer]
        if (val === choiceKey) count++
      }
      totalResponses += count
      return {
        choiceKey,
        choiceLabels: {
          labelLong: String(choice['Label Long'] ?? choiceKey),
          labelShort: String(choice['Label Short'] ?? choice['Label Long'] ?? choiceKey),
          emoji: choice.Emoji ?? ''
        },
        absoluteCount: count,
        percentage: 0
      }
    })

    responses.forEach(r => {
      r.percentage = totalResponses > 0 ? Math.round((r.absoluteCount / totalResponses) * 1000) / 10 : 0
    })

    results.push({
      questionKey,
      questionLabels,
      totalResponses,
      responses
    })
  })

  results.sort((a, b) => a.questionKey.localeCompare(b.questionKey))
  return results
}

const computeQuartierWeighted = (
  willQuestions: Map<string, MetaEmdvChoice[]>,
  metaQuestions: MetaEmdvQuestion[],
  answers: WayOfLifeAnswer[],
  suBank: SuBankRow[],
  suData: SuDataRow[]
): VolonteQuestionData[] => {
  const sus = suBank.filter(su => su.Id !== 0)
  const results: VolonteQuestionData[] = []

  willQuestions.forEach((choices, questionKey) => {
    const questionMeta = metaQuestions.find(q => q['Metabase Question Key'] === questionKey)
    const title = getBestTitleForQuestion(questionMeta, questionKey)
    const questionLabels = {
      title,
      emoji: questionMeta?.Emoji ?? '🎯',
      questionOrigin: questionMeta?.['Question Origin'] ?? '',
      questionShort: (questionMeta?.['Question Short'] ?? questionMeta?.['Question Long'] ?? title)
    }

    let totalWeightedResponses = 0
    const responses: VolonteChoiceResponse[] = []

    for (const choice of choices) {
      const choiceKey = String(choice['Metabase Choice Key'])
      let weightedCount = 0
      for (const su of sus) {
        const suRow = suData.find(sd => sd.ID === su.Id)
  const popPct = suRow ? parseFloat(String(suRow['Pop Percentage'] ?? '0')) : 0
        if (popPct <= 0) continue
        const weight = popPct / 100
        const suAnswers = answers.filter(a => a['Su ID'] === su.Id)
        let suCount = 0
        for (const ans of suAnswers) {
          const val = ans[questionKey as keyof WayOfLifeAnswer]
          if (val === choiceKey) suCount++
        }
        weightedCount += suCount * weight
      }
      totalWeightedResponses += weightedCount
      responses.push({
        choiceKey,
        choiceLabels: {
          labelLong: String(choice['Label Long'] ?? choiceKey),
          labelShort: String(choice['Label Short'] ?? choice['Label Long'] ?? choiceKey),
          emoji: choice.Emoji ?? ''
        },
        absoluteCount: Math.round(weightedCount),
        percentage: 0
      })
    }

    responses.forEach(r => {
      r.percentage = totalWeightedResponses > 0 ? Math.round((r.absoluteCount / totalWeightedResponses) * 1000) / 10 : 0
    })

    results.push({
      questionKey,
      questionLabels,
      totalResponses: Math.round(totalWeightedResponses),
      responses
    })
  })

  results.sort((a, b) => a.questionKey.localeCompare(b.questionKey))
  return results
}

// =========================
// Public API
// =========================

export const getDpVolonteToutData = async (selectedSus?: number[]): Promise<VolonteToutResult> => {
  const cacheKey = JSON.stringify(selectedSus ?? [])
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && now - cached.ts < CACHE_MS) return cached.value

  const isQuartier = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1
  const [choices, questions, answers, suBank, suData] = await Promise.all([
    loadMetaEmdvChoices(),
    loadMetaEmdvQuestions(),
    loadWayOfLifeAnswers(),
    loadSuBank(),
    loadSuData()
  ])
  const willGroups = getWillQuestionsGrouped(choices)

  if (isQuartier) {
    const data = computeQuartierWeighted(willGroups, questions, answers, suBank, suData)
    const result: VolonteToutResult = {
      data,
      isQuartier: true,
      suId: 0,
      summary: {
        totalQuestions: data.length,
        dataSource: 'MetaEmdvChoices (is_will) + Way Of Life Answer',
        computationType: 'Weighted average by population percentage'
      }
    }
    cache.set(cacheKey, { ts: now, value: result })
    return result
  }

  // Single SU view
  const mapped = await mapLocalToGlobalIds(selectedSus ?? [])
  const suId = mapped[0]!
  const data = computeForSu(suId, willGroups, questions, answers)
  const result: VolonteToutResult = {
    data,
    isQuartier: false,
    suId,
    summary: {
      totalQuestions: data.length,
      dataSource: 'MetaEmdvChoices (is_will) + Way Of Life Answer',
      computationType: 'Absolute count and percentage per SU'
    }
  }
  cache.set(cacheKey, { ts: now, value: result })
  return result
}

export const clearVolonteToutCache = () => {
  cache.clear()
}
