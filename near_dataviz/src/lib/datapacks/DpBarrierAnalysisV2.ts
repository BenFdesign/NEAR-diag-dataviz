import { loadMetaEmdvChoices, loadMetaEmdvQuestions, loadWayOfLifeData, loadSuBankData, loadSuData } from '~/lib/data-loader'

// Types minimalistes alignés avec les données utilisées
type ChoiceRow = Record<string, unknown> & {
  ['Metabase Question Key']?: string
  ['Metabase Choice Key']?: string | number
  TypeData?: string
  is_bareer?: boolean
  famille_barriere?: string
  ['Label Origin']?: string
  Emoji?: string
  ['Label Short']?: string
  ['Label Long']?: string
}
type QuestionRow = Record<string, unknown> & {
  ['Metabase Question Key']?: string
  ['Question Short']?: string
  ['Question Long']?: string
  Emoji?: string
}
type WolRow = Record<string, unknown> & {
  ['Su ID']?: number
}
type SuBankRow = { Id: number; colorMain?: string }
type SuDataRow = { ID: number; Su: number; ['Pop Percentage']?: string }

export interface BarrierCategoryData {
  familleBarriere: string
  absoluteCount: number
  percentage: number
  maxPossible: number
  isOtherReasons?: boolean
  emoji: string
}

export interface ChoiceCategoryData {
  choiceKey: string
  labelShort: string
  labelLong: string
  absoluteCount: number
  percentage: number
  maxPossible: number
  emoji: string
  isOtherReasons?: boolean
}

export interface BarrierQuestionData {
  questionKey: string
  questionLabels: {
    title: string
    emoji: string
    questionOrigin: string
    questionShort: string
  }
  categories: BarrierCategoryData[]
  categoriesByChoice?: ChoiceCategoryData[]
}

interface PrecomputedBarrierData {
  allSuResults: Map<number, BarrierQuestionData[]>
  quartierResults: BarrierQuestionData[]
  lastComputed: number
}

let precomputedCache: PrecomputedBarrierData | null = null

const getBarrierQuestions = (choices: ChoiceRow[]) => {
  const barrierChoices = choices.filter((choice) =>
    choice.is_bareer === true &&
    choice.TypeData === 'AbsChoixMultiple' &&
    choice.famille_barriere && String(choice.famille_barriere).trim() !== ''
  )
  const questionGroups = new Map<string, ChoiceRow[]>()
  for (const choice of barrierChoices) {
    const qk = String(choice['Metabase Question Key'] ?? '')
    if (!questionGroups.has(qk)) questionGroups.set(qk, [])
    questionGroups.get(qk)!.push(choice)
  }
  return questionGroups
}

const getOtherChoicesMapping = (choices: ChoiceRow[]) => {
  const otherChoices = choices.filter((choice) =>
    choice.is_bareer === true &&
    choice.TypeData === 'AbsOther' &&
    choice.famille_barriere && String(choice.famille_barriere).trim() !== ''
  )
  const mp = new Map<string, ChoiceRow>()
  for (const c of otherChoices) {
    const qk = String(c['Metabase Question Key'] ?? '')
    mp.set(qk, c)
  }
  return mp
}

const parseAnswerField = (fieldValue: unknown): string[] => {
  if (!fieldValue) return []
  if (typeof fieldValue === 'string') {
    try {
      let cleaned = fieldValue.trim()
      if (cleaned.startsWith('"') && cleaned.endsWith('"')) cleaned = cleaned.slice(1, -1)
      if (cleaned.startsWith('{') && cleaned.endsWith('}')) cleaned = cleaned.slice(1, -1)
      if (cleaned === '') return []
      return cleaned.split(',').map((it) => it.trim().replace(/"/g, '').replace(/'/g, ''))
    } catch {
      return []
    }
  }
  if (Array.isArray(fieldValue)) return fieldValue as string[]
  return []
}

const extractCustomResponses = (answerField: unknown, questionChoices: ChoiceRow[]): string[] => {
  const selected = parseAnswerField(answerField)
  const predefined = new Set(questionChoices.map((c) => String(c['Metabase Choice Key'])))
  return selected.filter((s) => !predefined.has(s) && s.trim() !== '' && s !== 'OTHER')
}

const calculateBarrierDataForSu = (
  suId: number,
  choices: ChoiceRow[],
  questions: QuestionRow[],
  wol: WolRow[]
): BarrierQuestionData[] => {
  const barrierQuestions = getBarrierQuestions(choices)
  const otherChoicesMapping = getOtherChoicesMapping(choices)
  const suAnswers = wol.filter((a) => a['Su ID'] === suId)
  const results: BarrierQuestionData[] = []

  barrierQuestions.forEach((qChoices, questionKey) => {
    const firstChoice = qChoices[0]
    const qMeta = questions.find((q) => String(q['Metabase Question Key']) === questionKey)
    const qShort = typeof qMeta?.['Question Short'] === 'string' && qMeta['Question Short'] ? qMeta['Question Short'] : undefined
  const qEmojiRaw = qMeta?.Emoji
    const qEmoji = (typeof qEmojiRaw === 'string' && qEmojiRaw.trim() !== '') ? qEmojiRaw : '🧩'
    const questionLabels = {
      title: qShort ?? `Barrières : ${questionKey}`,
      emoji: qEmoji,
      questionOrigin: String(firstChoice?.['Label Origin'] ?? ''),
      questionShort: qShort ?? questionKey,
    }

    // Group by famille_barriere
    const familleGroups = new Map<string, ChoiceRow[]>()
    for (const ch of qChoices) {
      const fam = String(ch.famille_barriere)
      if (!familleGroups.has(fam)) familleGroups.set(fam, [])
      familleGroups.get(fam)!.push(ch)
    }

  const categories: BarrierCategoryData[] = []
    const maxPossible = suAnswers.length

    // Compute per famille
    familleGroups.forEach((famChoices, familleBarriere) => {
      let absoluteCount = 0
      // pick emoji from first non-empty Emoji in famChoices
  const famEmoji = (famChoices.map((c) => String(c.Emoji ?? '')).find((e) => e && e.trim() !== '') ?? '🚧')
      for (const ans of suAnswers) {
  const answerField = (ans as Record<string, unknown>)[questionKey]
        const selected = parseAnswerField(answerField)
        const hasFromFam = famChoices.some((c) => selected.includes(String(c['Metabase Choice Key'])))
        if (hasFromFam) absoluteCount++
      }
      const pct = maxPossible > 0 ? Math.round(((absoluteCount / maxPossible) * 100) * 10) / 10 : 0
      categories.push({ familleBarriere, absoluteCount, percentage: pct, maxPossible, isOtherReasons: false, emoji: famEmoji })
    })

    // Autres raisons
    const otherChoice = otherChoicesMapping.get(questionKey)
    const categoriesByChoice: ChoiceCategoryData[] = []

    // Par choix (AbsChoixMultiple)
    for (const ch of qChoices) {
      const chKey = String(ch['Metabase Choice Key'] ?? '')
      let absoluteCount = 0
      for (const ans of suAnswers) {
        const selected = parseAnswerField((ans as Record<string, unknown>)[questionKey])
        if (selected.includes(chKey)) absoluteCount++
      }
      const pct = maxPossible > 0 ? Math.round(((absoluteCount / maxPossible) * 100) * 10) / 10 : 0
      const labelShort = ch['Label Short'] ?? ''
      const labelLong = ch['Label Long'] ?? ''
      const emoji = (ch.Emoji && ch.Emoji.trim() !== '') ? ch.Emoji : '▫️'
      categoriesByChoice.push({ choiceKey: chKey, labelShort, labelLong, absoluteCount, percentage: pct, maxPossible, emoji, isOtherReasons: false })
    }

    if (otherChoice) {
      let otherCount = 0
      for (const ans of suAnswers) {
  const answerField = (ans as Record<string, unknown>)[questionKey]
        const customs = extractCustomResponses(answerField, qChoices)
        if (customs.length > 0) otherCount++
      }
      if (otherCount > 0) {
        const pct = maxPossible > 0 ? Math.round(((otherCount / maxPossible) * 100) * 10) / 10 : 0
        const otherEmoji = (otherChoice.Emoji && otherChoice.Emoji.trim() !== '') ? otherChoice.Emoji : '💬'
        categories.push({ familleBarriere: String(otherChoice.famille_barriere), absoluteCount: otherCount, percentage: pct, maxPossible, isOtherReasons: true, emoji: otherEmoji })
        const labelShort = otherChoice['Label Short'] ?? 'Autres raisons'
        const labelLong = otherChoice['Label Long'] ?? 'Autres raisons'
        categoriesByChoice.push({ choiceKey: 'OTHER', labelShort, labelLong, absoluteCount: otherCount, percentage: pct, maxPossible, emoji: otherEmoji, isOtherReasons: true })
      }
    }

    categories.sort((a, b) => b.percentage - a.percentage)
    categoriesByChoice.sort((a, b) => b.percentage - a.percentage)
    results.push({ questionKey, questionLabels, categories, categoriesByChoice })
  })

  return results
}

const precomputeAllBarrierData = async (): Promise<PrecomputedBarrierData> => {
  const [choicesRaw, questionsRaw, wolRaw, suBankRaw, suDataRaw] = await Promise.all([
    loadMetaEmdvChoices(),
    loadMetaEmdvQuestions(),
    loadWayOfLifeData(),
    loadSuBankData(),
    loadSuData(),
  ])
  const choices = choicesRaw as ChoiceRow[]
  const questions = questionsRaw as QuestionRow[]
  const wol = wolRaw as WolRow[]
  const suBank = (suBankRaw as SuBankRow[]).filter((s) => s.Id !== 0)
  const suData = suDataRaw as SuDataRow[]

  const allSuResults = new Map<number, BarrierQuestionData[]>()
  for (const su of suBank) {
    const suResult = calculateBarrierDataForSu(su.Id, choices, questions, wol)
    allSuResults.set(su.Id, suResult)
  }

  // Quartier (pondéré)
  const barrierQuestions = getBarrierQuestions(choices)
  const otherChoicesMapping = getOtherChoicesMapping(choices)
  const quartierResults: BarrierQuestionData[] = []

  barrierQuestions.forEach((qChoices, questionKey) => {
    const firstChoice = qChoices[0]
    const qMeta = questions.find((q) => String(q['Metabase Question Key']) === questionKey)
    const qShort = typeof qMeta?.['Question Short'] === 'string' && qMeta['Question Short'] ? qMeta['Question Short'] : undefined
  const qEmojiRaw = qMeta?.Emoji
    const qEmoji = (typeof qEmojiRaw === 'string' && qEmojiRaw.trim() !== '') ? qEmojiRaw : '🧩'
    const questionLabels = {
      title: qShort ?? `Barrières : ${questionKey}`,
      emoji: qEmoji,
      questionOrigin: String(firstChoice?.['Label Origin'] ?? ''),
      questionShort: qShort ?? questionKey,
    }

    // group by famille
    const familleGroups = new Map<string, ChoiceRow[]>()
    for (const ch of qChoices) {
      const fam = String(ch.famille_barriere)
      if (!familleGroups.has(fam)) familleGroups.set(fam, [])
      familleGroups.get(fam)!.push(ch)
    }

    const categories: BarrierCategoryData[] = []
    const categoriesByChoice: ChoiceCategoryData[] = []
    familleGroups.forEach((famChoices, familleBarriere) => {
      let totalWeightedCount = 0
      let totalWeightedMaxPossible = 0
  const famEmoji = (famChoices.map((c) => String(c.Emoji ?? '')).find((e) => e && e.trim() !== '') ?? '🚧')
      for (const su of suBank) {
        const suRow = suData.find((sd) => sd.ID === su.Id)
        const popPct = suRow ? (parseFloat(String(suRow['Pop Percentage'] ?? '0')) / 100) : 0
        const suAnswers = wol.filter((a) => a['Su ID'] === su.Id)
        if (popPct > 0 && suAnswers.length > 0) {
          let suCount = 0
          const suMax = suAnswers.length
          for (const ans of suAnswers) {
            const selected = parseAnswerField((ans as Record<string, unknown>)[questionKey])
            const hasFromFam = famChoices.some((c) => selected.includes(String(c['Metabase Choice Key'])))
            if (hasFromFam) suCount++
          }
          totalWeightedCount += suCount * popPct
          totalWeightedMaxPossible += suMax * popPct
        }
      }
      const absoluteCount = Math.round(totalWeightedCount)
      const maxPossible = Math.round(totalWeightedMaxPossible)
      const pct = maxPossible > 0 ? Math.round(((totalWeightedCount / totalWeightedMaxPossible) * 100) * 10) / 10 : 0
      categories.push({ familleBarriere, absoluteCount, percentage: pct, maxPossible, isOtherReasons: false, emoji: famEmoji })
    })

    // Par choix (pondéré)
    for (const ch of qChoices) {
      const chKey = String(ch['Metabase Choice Key'] ?? '')
      let totalWeightedCount = 0
      let totalWeightedMax = 0
      for (const su of suBank) {
        const suRow = suData.find((sd) => sd.ID === su.Id)
        const popPct = suRow ? (parseFloat(String(suRow['Pop Percentage'] ?? '0')) / 100) : 0
        const suAnswers = wol.filter((a) => a['Su ID'] === su.Id)
        if (popPct > 0 && suAnswers.length > 0) {
          let suCount = 0
          const suMax = suAnswers.length
          for (const ans of suAnswers) {
            const selected = parseAnswerField((ans as Record<string, unknown>)[questionKey])
            if (selected.includes(chKey)) suCount++
          }
          totalWeightedCount += suCount * popPct
          totalWeightedMax += suMax * popPct
        }
      }
      const absoluteCount = Math.round(totalWeightedCount)
      const maxPossible = Math.round(totalWeightedMax)
      const pct = maxPossible > 0 ? Math.round(((totalWeightedCount / totalWeightedMax) * 100) * 10) / 10 : 0
      const labelShort = ch['Label Short'] ?? ''
      const labelLong = ch['Label Long'] ?? ''
      const emoji = (ch.Emoji && ch.Emoji.trim() !== '') ? ch.Emoji : '▫️'
      categoriesByChoice.push({ choiceKey: chKey, labelShort, labelLong, absoluteCount, percentage: pct, maxPossible, emoji, isOtherReasons: false })
    }

    const otherChoice = otherChoicesMapping.get(questionKey)
    if (otherChoice) {
      let totalWeightedOtherCount = 0
      let totalWeightedOtherMax = 0
      for (const su of suBank) {
        const suRow = suData.find((sd) => sd.ID === su.Id)
        const popPct = suRow ? (parseFloat(String(suRow['Pop Percentage'] ?? '0')) / 100) : 0
        const suAnswers = wol.filter((a) => a['Su ID'] === su.Id)
        if (popPct > 0 && suAnswers.length > 0) {
          let suOther = 0
          const suMax = suAnswers.length
          for (const ans of suAnswers) {
            const customs = extractCustomResponses((ans as Record<string, unknown>)[questionKey], qChoices)
            if (customs.length > 0) suOther++
          }
          totalWeightedOtherCount += suOther * popPct
          totalWeightedOtherMax += suMax * popPct
        }
      }
      if (totalWeightedOtherCount > 0) {
        const absoluteCount = Math.round(totalWeightedOtherCount)
        const maxPossible = Math.round(totalWeightedOtherMax)
        const pct = maxPossible > 0 ? Math.round(((totalWeightedOtherCount / totalWeightedOtherMax) * 100) * 10) / 10 : 0
        const otherEmoji = (otherChoice.Emoji && otherChoice.Emoji.trim() !== '') ? otherChoice.Emoji : '💬'
        categories.push({ familleBarriere: String(otherChoice.famille_barriere), absoluteCount, percentage: pct, maxPossible, isOtherReasons: true, emoji: otherEmoji })
        const labelShort = otherChoice['Label Short'] ?? 'Autres raisons'
        const labelLong = otherChoice['Label Long'] ?? 'Autres raisons'
        categoriesByChoice.push({ choiceKey: 'OTHER', labelShort, labelLong, absoluteCount, percentage: pct, maxPossible, emoji: otherEmoji, isOtherReasons: true })
      }
    }

    categories.sort((a, b) => b.percentage - a.percentage)
    categoriesByChoice.sort((a, b) => b.percentage - a.percentage)
    quartierResults.push({ questionKey, questionLabels, categories, categoriesByChoice })
  })

  return { allSuResults, quartierResults, lastComputed: Date.now() }
}

const getPrecomputedData = async (): Promise<PrecomputedBarrierData> => {
  precomputedCache ??= await precomputeAllBarrierData()
  return precomputedCache
}

// Public API
export async function getBarrierData(selectedSus?: number[]) {
  const pre = await getPrecomputedData()
  const isQuartierView = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1
  if (isQuartierView) {
    const suBank = (await loadSuBankData()) as SuBankRow[]
    return {
      data: pre.quartierResults,
      isQuartier: true,
      suId: 0,
      color: suBank.find((s) => s.Id === 0)?.colorMain ?? '#002878',
    }
  } else {
    // Mapper numéros SU locaux -> IDs
    const suData = (await loadSuData()) as SuDataRow[]
  const ids = suData.filter((row) => (selectedSus ?? []).includes(row.Su)).map((row) => row.ID)
    const suId = ids[0]
    if (suId === undefined) {
      const suBank = (await loadSuBankData()) as SuBankRow[]
  return { data: pre.quartierResults, isQuartier: true, suId: 0, color: suBank.find((s) => s.Id === 0)?.colorMain ?? '#002878' }
    }
    const suResult = pre.allSuResults.get(suId)
    const suBank = (await loadSuBankData()) as SuBankRow[]
    if (suResult) {
      const suInfo = suBank.find((s) => s.Id === suId)
  return { data: suResult, isQuartier: false, suId, color: suInfo?.colorMain ?? '#2563eb' }
    }
  return { data: pre.quartierResults, isQuartier: true, suId: 0, color: suBank.find((s) => s.Id === 0)?.colorMain ?? '#002878' }
  }
}

export async function getBarrierDataForQuestion(questionKey: string, selectedSus?: number[]) {
  if (questionKey === '__ALL_QUESTIONS_AGGREGATED__') {
    return getAggregatedBarrierData(selectedSus)
  }
  const all = await getBarrierData(selectedSus)
  const q = all.data.find((d) => d.questionKey === questionKey)
  return { ...all, data: q ? [q] : [] }
}

export async function getAggregatedBarrierData(selectedSus?: number[]) {
  const all = await getBarrierData(selectedSus)
  if (all.data.length === 0) return { ...all, data: [] }

  const map = new Map<string, { totalCount: number; totalMax: number; isOtherReasons: boolean; emoji?: string }>()
  for (const q of all.data) {
    for (const c of q.categories) {
  const cur = map.get(c.familleBarriere) ?? { totalCount: 0, totalMax: 0, isOtherReasons: !!c.isOtherReasons, emoji: undefined }
      cur.totalCount += c.absoluteCount
      cur.totalMax += c.maxPossible
      cur.isOtherReasons = cur.isOtherReasons || !!c.isOtherReasons
      if (!cur.emoji && c.emoji && c.emoji.trim() !== '') cur.emoji = c.emoji
      map.set(c.familleBarriere, cur)
    }
  }
  const categories: BarrierCategoryData[] = []
  map.forEach((v, k) => {
    const pct = v.totalMax > 0 ? Math.round(((v.totalCount / v.totalMax) * 100) * 10) / 10 : 0
    const emoji = (v.emoji && v.emoji.trim() !== '') ? v.emoji : (v.isOtherReasons ? '💬' : '🚧')
    categories.push({ familleBarriere: k, absoluteCount: v.totalCount, percentage: pct, maxPossible: v.totalMax, isOtherReasons: v.isOtherReasons, emoji })
  })
  categories.sort((a, b) => b.percentage - a.percentage)
  const aggregated: BarrierQuestionData = {
    questionKey: '__ALL_QUESTIONS_AGGREGATED__',
    questionLabels: {
      title: 'Toutes les barrières agrégées',
      emoji: '📊',
      questionOrigin: 'Agrégation de toutes les questions barriers + réponses personnalisées',
      questionShort: 'Barrières globales + autres',
    },
    categories,
  }
  return { ...all, data: [aggregated] }
}

export async function getAvailableBarrierQuestions() {
  const pre = await getPrecomputedData()
  const list = pre.quartierResults.map((q) => ({ questionKey: q.questionKey, title: q.questionLabels.title, emoji: q.questionLabels.emoji, categoriesCount: q.categories.length }))
  const aggregated = { questionKey: '__ALL_QUESTIONS_AGGREGATED__', title: 'Toutes les barrières agrégées + autres', emoji: '📊', categoriesCount: 0 }
  return [aggregated, ...list]
}

export function clearBarrierCache() {
  precomputedCache = null
}