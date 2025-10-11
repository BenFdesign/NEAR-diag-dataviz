// Data transformer for survey answers → aggregated per SU
// - Reads JSON via Vite `?raw` imports and parses at runtime
// - Aggregates counts per "Su ID" for three datasets
// - Correlates to Su Bank (name) and Su Data (pop %)
// - Sanitizes values and memoizes the final result

import suBankRaw from '../data/Su Bank.json?raw'
import suDataRaw from '../data/Su Data.json?raw'
import formsRaw from '../data/Forms.json?raw'

import suAnswerRaw from '../data/Su Answer.json?raw'
import wayOfLifeRaw from '../data/Way Of Life Answer.json?raw'
import carbonFootprintRaw from '../data/Carbon Footprint Answer.json?raw'

export type DpTestRow = {
  suId: number
  nameFr: string
  usageSphere: number
  qualiteDeVie: number
  nosGEStesClimat: number
  popPercentage: number | null
}

export type DpTestData = {
  headers: {
    usageSphere: string
    qualiteDeVie: string
    nosGEStesClimat: string
    popPercentage: string
  }
  totals: {
    usageSphere: number
    qualiteDeVie: number
    nosGEStesClimat: number
  }
  rows: DpTestRow[]
  missingForeignKeys: Array<{
    dataset: 'Su Answer' | 'Way Of Life Answer' | 'Carbon Footprint Answer' | 'Su Data'
    suId: number
  }>
}

export type DpTestTextPayload = {
  id: string
  version: string
  labels: DpTestData['headers']
  rows: DpTestData['rows']
  totals: DpTestData['totals']
  warnings: DpTestData['missingForeignKeys']
}

type SuBankEntry = { Id: number | string; 'Name Fr'?: string | null }
type SuDataEntry = { ID: number | string; 'Pop Percentage'?: string | number | null }
type AnswerRecord = { 'Su ID'?: number | string | null; [k: string]: unknown }

let cache: DpTestData | null = null

function parseJSON<T = unknown>(raw: string): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    // Fallback to empty when malformed
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

function countBySu(records: AnswerRecord[]): Map<number, number> {
  const counts = new Map<number, number>()
  for (const r of records) {
    // Sanitize and normalize SU id
    const rawId = r['Su ID']
    const n = toNumber(rawId)
    if (n == null) continue
    const suId = Math.trunc(n)
    if (suId === 0) continue // ignore Id 0 "Quartier"
    counts.set(suId, (counts.get(suId) ?? 0) + 1)
  }
  return counts
}

export function getDpTestData(): DpTestData {
  if (cache) return cache

  const suBank = parseJSON<SuBankEntry[]>(suBankRaw)
  const suData = parseJSON<SuDataEntry[]>(suDataRaw)
  const forms = parseJSON<Array<{ Id: number; name: string }>>(formsRaw)

  const suAnswers = parseJSON<AnswerRecord[]>(suAnswerRaw)
  const wolAnswers = parseJSON<AnswerRecord[]>(wayOfLifeRaw)
  const cfAnswers = parseJSON<AnswerRecord[]>(carbonFootprintRaw)

  const suBankById = new Map<number, SuBankEntry>()
  for (const s of suBank) {
    const id = toNumber(s.Id)
    if (id == null) continue
    suBankById.set(Math.trunc(id), s)
  }

  // Build pop percentage map by SuData.ID (which matches SuBank.Id in provided data)
  const popById = new Map<number, number | null>()
  for (const d of suData) {
    const id = toNumber(d.ID)
    if (id == null) continue
    popById.set(Math.trunc(id), toNumber(d['Pop Percentage']))
  }

  const cUsage = countBySu(suAnswers)
  const cWol = countBySu(wolAnswers)
  const cCf = countBySu(cfAnswers)

  const totals = {
    usageSphere: [...cUsage.values()].reduce((a, b) => a + b, 0),
    qualiteDeVie: [...cWol.values()].reduce((a, b) => a + b, 0),
    nosGEStesClimat: [...cCf.values()].reduce((a, b) => a + b, 0),
  }

  // Collect missing FKs: any SU id found in answers but absent from Su Bank
  const allSeen = new Set<number>([
    ...cUsage.keys(),
    ...cWol.keys(),
    ...cCf.keys(),
  ])
  const missingForeignKeys: DpTestData['missingForeignKeys'] = []
  for (const suId of allSeen) {
    if (!suBankById.has(suId)) {
      if (cUsage.has(suId)) missingForeignKeys.push({ dataset: 'Su Answer', suId })
      if (cWol.has(suId)) missingForeignKeys.push({ dataset: 'Way Of Life Answer', suId })
      if (cCf.has(suId)) missingForeignKeys.push({ dataset: 'Carbon Footprint Answer', suId })
    }
  }

  // Rows for every SU present in Su Bank except 0 (Quartier)
  const rows: DpTestRow[] = []
  for (const [suId, s] of suBankById) {
    if (suId === 0) continue
    const nameFr = toStringSafe(s['Name Fr']).trim()
    rows.push({
      suId,
      nameFr,
      usageSphere: cUsage.get(suId) ?? 0,
      qualiteDeVie: cWol.get(suId) ?? 0,
      nosGEStesClimat: cCf.get(suId) ?? 0,
      popPercentage: popById.get(suId) ?? null,
    })

    // Missing FK for Su Data 'ID' → 'Pop Percentage'
    if (!popById.has(suId)) {
      missingForeignKeys.push({ dataset: 'Su Data', suId })
    }
  }

  // Sort rows by suId for consistent table
  rows.sort((a, b) => a.suId - b.suId)

  // Headers from Forms.json
  const byFormId = new Map(forms.map((f) => [f.Id, f.name]))
  const headers = {
    usageSphere: toStringSafe(byFormId.get(1) ?? "Usage's Sphere"),
    qualiteDeVie: toStringSafe(byFormId.get(2) ?? 'Qualité de Vie'),
    nosGEStesClimat: toStringSafe(byFormId.get(3) ?? 'Nos GEStes Climat'),
    popPercentage: '% pop',
  }

  cache = { headers, totals, rows, missingForeignKeys }
  return cache
}

// Optional React hook wrapper for convenience
export function useDpTest(): DpTestData {
  // Static computation, safe to reuse directly
  return getDpTestData()
}

export function getDpTestText(): string {
  const data = getDpTestData()
  const payload: DpTestTextPayload = {
    id: 'DpTest',
    version: '1.0.0',
    labels: data.headers,
    rows: data.rows,
    totals: data.totals,
    warnings: data.missingForeignKeys,
  }
  return JSON.stringify(payload)
}
