/**
 * DATAPACK - Mobility (Way Of Life Answer)
 *
 * Analyse les déplacements des répondants selon trois axes :
 *   - Déplacements domicile ↔ travail     (Work)
 *   - Déplacements domicile ↔ loisirs     (Hobby)
 *   - Déplacements domicile ↔ alimentation (BuyFood)
 *
 * Pour chaque axe, chaque répondant est classifié en catégorie A, B ou NSP
 * à partir du mode et du temps de trajet (voir `classifyTrip`).
 *
 * - Vue SU    : utilise les réponses filtrées sur le `Su ID` correspondant
 * - Vue Quartier : agrégation pondérée (Pop Percentage) — distribution déférée à une phase ultérieure
 *
 * Données utilisées :
 * - /public/data/Way Of Life Answer.json   (réponses par répondant)
 * - /public/data/Su Data.json              (mapping Su number ↔ ID + poids de population)
 */

import {
  loadWayOfLifeData,
  loadSuDataForCurrentSurvey as loadSuDataFromLoader,
} from '~/lib/data-loader'
import type { DatapackRequest, DatapackResponse } from './contracts'

// ===========================
// POIDS PAR USAGE (déplacements/semaine)
// ===========================

/** Nombre de déplacements alimentaires par semaine (fixe) */
export const BASE_WEIGHT_FOOD = 1
/** Nombre de jours de travail en présentiel par semaine (avant soustraction du télétravail) */
export const BASE_WEIGHT_WORK = 5
/** Nombre de déplacements loisirs par semaine (fixe) */
export const BASE_WEIGHT_HOBBY = 1.2

// ===========================
// TYPES EXPORTÉS
// ===========================

/** Catégorie de déplacement issue de la combinaison mode × temps */
export type TripCategory = 'A' | 'B' | 'NSP'

/** Répartition des catégories pour un axe de déplacement */
export type CategoryDistribution = {
  A: number
  B: number
  NSP: number
  total: number
  /** Pourcentages arrondis à 2 décimales */
  pct: {
    A: number
    B: number
    NSP: number
  }
}

/** Entrée de mobilité traitée pour un répondant */
export type MobilityEntry = {
  suId: number
  remoteWorkingWeeklyFrequency: number | null
  /** Poids effectif travail pour ce répondant : max(0, BASE_WEIGHT_WORK − remoteFreq) */
  effectiveWorkWeight: number
  // --- Work ---
  workZone: string | null
  transportModeToWork: string | null
  transportTimeToWork: string | null
  categoryWork: TripCategory
  // --- Hobby ---
  hobbyZone: string | null
  transportModeToHobby: string | null
  transportTimeToHobby: string | null
  categoryHobby: TripCategory
  // --- Buy Food ---
  foodMarketZone: string | null
  transportModeToBuyFood: string | null
  transportTimeToBuyFood: string | null
  categoryBuyFood: TripCategory
}

/**
 * Une cellule zone × catégorie de trajet : ventilation pondérée des motifs.
 *
 * Clés possibles :
 *   "ZONE_PORTE_ORLEANS"          ← quartier local, toutes catégories fusionnées
 *   "ZONE_A_A" | "ZONE_A_B"       ← zone A, trajet A ou B
 *   "ZONE_B_A" | "ZONE_B_B"
 *   "ZONE_C_A" | "ZONE_C_B"
 *   "ZONE_D_A" | "ZONE_D_B"
 *
 * Les entrées NSP pour les zones hors PORTE_ORLEANS sont exclues.
 */
export type ZoneCellBreakdown = {
  /** Répondants uniques ayant coché cette cellule pour au moins un motif */
  respondentCount: number
  /** Sommes pondérées par motif (déplacements/semaine × répondants concernés) */
  workWeighted: number
  hobbyWeighted: number
  buyFoodWeighted: number
  totalWeighted: number
  /** % de chaque motif sur le total pondéré de cette cellule */
  pct: { work: number; hobby: number; buyFood: number }
  /**
   * Part de la cellule sur le maximum théorique :
   *   totalWeighted / (totalRépondants × (pWork + pHobby + pBuyFood))
   * = 100 % si tous les répondants avaient choisi cette cellule pour tous les usages.
   */
  pctOfTotal: number
  /** Répartition pondérée des modes de transport vers cette cellule (NONE_I_DONT_MOVE exclu) */
  mobilityTypeBreakdown: MobilityTypeBreakdown
}

/** Type de mobilité agrégé (4 catégories + total + %) */
export type MobilityType = 'FOOT' | 'BIKE' | 'TRANS' | 'CAR'

export type MobilityTypeBreakdown = {
  FOOT: number
  BIKE: number
  TRANS: number
  CAR: number
  total: number
  pct: { FOOT: number; BIKE: number; TRANS: number; CAR: number }
}

/** Distribution par cellule zone×catégorie (max 9 clés) */
export type ZoneDistribution = Record<string, ZoneCellBreakdown>

/** Payload complet retourné par DpMobility */
export type MobilityPayload = {
  entries: MobilityEntry[]
  categoryDistribution: {
    work: CategoryDistribution
    hobby: CategoryDistribution
    buyFood: CategoryDistribution
  }
  /** Poids effectifs en déplacements/semaine pour chaque axe */
  weights: {
    work: number
    hobby: number
    buyFood: number
  }
  /**
   * 9 cellules zone×catégorie : ZONE_PORTE_ORLEANS + ZONE_{A|B|C|D}_{A|B}.
   * Pour chaque cellule : nombre de répondants concernés et % par motif (work/hobby/buyFood).
   */
  zoneDistribution: ZoneDistribution
  meta: {
    totalResponses: number
    /** Moyenne du télétravail hebdomadaire (entrées non-nulles uniquement) */
    meanRemoteWorkFrequency: number
  }
}


// ===========================
// TYPES INTERNES
// ===========================

type WayOfLifeEntry = {
  'Su ID': number
  SurveyId?: number
  'Remote Working Weekly Frequency': number | null
  'Work Zone': string | null
  'Transport Mode To Work': string | null
  'Transport Time To Work': string | null
  'Hobby Zone': string | null
  'Transport Mode To Hobby': string | null
  'Transport Time To Hobby': string | null
  'Food Market Zone': string | null
  'Transport Mode To Buy Food': string | null
  'Transport Time To Buy Food': string | null
}

type SuDataEntry = {
  ID: number
  'Survey ID': number
  Su: number
  'Pop Percentage': string
}


// ===========================
// UTILITAIRE : classifyTrip
// ===========================

/**
 * Classifie un déplacement en catégorie A, B ou NSP selon la table :
 *
 * | Mode               | <10 min | 10–20 min | ≥20 min |
 * |--------------------|:-------:|:---------:|:-------:|
 * | WALKING            |    A    |     A     |    B    |
 * | PERSONAL_BICYCLE   |    A    |     A     |    B    |
 * | SHARE_BICYCLE      |    A    |     A     |    B    |
 * | PUBLIC_TRANSPORT   |    A    |     B     |    B    |
 * | CAR                |    A    |     B     |    B    |
 * | ELECTRIC_CAR       |    A    |     B     |    B    |
 * | TAXI_VTC           |    A    |     B     |    B    |
 * | NONE_I_DONT_MOVE   |   NSP   |    NSP    |   NSP   |
 *
 * Retourne `NSP` si mode ou temps est null ou inconnu.
 */
export function classifyTrip(
  mode: string | null | undefined,
  time: string | null | undefined,
): TripCategory {
  if (!mode || !time) return 'NSP'
  if (mode === 'NONE_I_DONT_MOVE') return 'NSP'

  if (time === 'LESS_THAN_10_MIN') return 'A'

  const slowModes = new Set(['WALKING', 'PERSONAL_BICYCLE', 'SHARE_BICYCLE'])
  if (time === 'BETWEEN_10_AND_20_MIN' && slowModes.has(mode)) return 'A'

  // All remaining valid combos: BETWEEN_10_AND_20_MIN (fast mode), BETWEEN_20_AND_30_MIN,
  // BETWEEN_30_AND_45_MIN, ABOVE_45_MIN — all → B
  return 'B'
}


// ===========================
// CHARGEMENT DES DONNÉES
// ===========================

async function loadWayOfLifeAnswers(): Promise<WayOfLifeEntry[]> {
  try {
    const json = await loadWayOfLifeData()
    const isEntry = (r: unknown): r is WayOfLifeEntry =>
      typeof r === 'object' && r !== null && 'Su ID' in r
    return json
      .filter(isEntry)
      // Filtrage par Survey ID déjà effectué par l'API
  } catch (error) {
    console.error('[DpMobility] loadWayOfLifeAnswers error:', error)
    return []
  }
}

async function loadSuData(): Promise<SuDataEntry[]> {
  try {
    const json = await loadSuDataFromLoader() as SuDataEntry[]
    return json ?? []
  } catch (error) {
    console.error('[DpMobility] loadSuData error:', error)
    return []
  }
}


// ===========================
// CALCUL DES DISTRIBUTIONS
// ===========================

function buildCategoryDistribution(
  entries: MobilityEntry[],
  key: 'categoryWork' | 'categoryHobby' | 'categoryBuyFood',
): CategoryDistribution {
  let A = 0, B = 0, NSP = 0
  for (const e of entries) {
    const cat = e[key]
    if (cat === 'A') A++
    else if (cat === 'B') B++
    else NSP++
  }
  const total = entries.length
  const safe = (n: number) => total > 0 ? Math.round((n / total) * 10000) / 100 : 0
  return {
    A,
    B,
    NSP,
    total,
    pct: { A: safe(A), B: safe(B), NSP: safe(NSP) },
  }
}

function processAnswers(answers: WayOfLifeEntry[], meanRemoteWorkFrequency: number): MobilityEntry[] {
  return answers.map(row => {
    const remoteFreq = row['Remote Working Weekly Frequency'] ?? meanRemoteWorkFrequency
    const effectiveWorkWeight = Math.max(0, BASE_WEIGHT_WORK - remoteFreq)
    return {
      suId: row['Su ID'],
      remoteWorkingWeeklyFrequency: row['Remote Working Weekly Frequency'] ?? null,
      effectiveWorkWeight,
      workZone: row['Work Zone'] ?? null,
    transportModeToWork: row['Transport Mode To Work'] ?? null,
    transportTimeToWork: row['Transport Time To Work'] ?? null,
    categoryWork: classifyTrip(row['Transport Mode To Work'], row['Transport Time To Work']),
    hobbyZone: row['Hobby Zone'] ?? null,
    transportModeToHobby: row['Transport Mode To Hobby'] ?? null,
    transportTimeToHobby: row['Transport Time To Hobby'] ?? null,
    categoryHobby: classifyTrip(row['Transport Mode To Hobby'], row['Transport Time To Hobby']),
    foodMarketZone: row['Food Market Zone'] ?? null,
    transportModeToBuyFood: row['Transport Mode To Buy Food'] ?? null,
    transportTimeToBuyFood: row['Transport Time To Buy Food'] ?? null,
      categoryBuyFood: classifyTrip(row['Transport Mode To Buy Food'], row['Transport Time To Buy Food']),
    }
  })
}

const QUARTIER_ZONE_KEY = 'ZONE_PORTE_ORLEANS'
const KNOWN_ZONES = new Set(['ZONE_PORTE_ORLEANS', 'ZONE_A', 'ZONE_B', 'ZONE_C', 'ZONE_D'])

/**
 * Classe un mode de transport en type de mobilité agrégé.
 * Retourne null pour NONE_I_DONT_MOVE, null, ou valeurs inconnues.
 */
export function classifyMobilityType(mode: string | null | undefined): MobilityType | null {
  if (!mode) return null
  if (mode === 'WALKING') return 'FOOT'
  if (mode === 'PERSONAL_BICYCLE' || mode === 'SHARE_BICYCLE') return 'BIKE'
  if (mode === 'PUBLIC_TRANSPORT') return 'TRANS'
  if (mode === 'CAR' || mode === 'ELECTRIC_CAR' || mode === 'TAXI_VTC') return 'CAR'
  return null // NONE_I_DONT_MOVE + inconnu
}

function getCellKey(zone: string, category: TripCategory): string | null {
  if (category === 'NSP') return null
  if (!KNOWN_ZONES.has(zone)) return null
  if (zone === QUARTIER_ZONE_KEY) return QUARTIER_ZONE_KEY
  return `${zone}_${category}`
}

function buildZoneDistribution(
  entries: MobilityEntry[],
  weights: { work: number; hobby: number; buyFood: number },
  totalResponses: number,
): ZoneDistribution {
  const acc: Record<string, { work: number; hobby: number; buyFood: number }> = {}
  const respondentSets: Record<string, Set<number>> = {}
  const mobilityAcc: Record<string, { FOOT: number; BIKE: number; TRANS: number; CAR: number }> = {}

  // Maximum théorique : tous les répondants auraient choisi la même cellule pour tous les usages
  const maxPossible = totalResponses * (weights.work + weights.hobby + weights.buyFood)

  const add = (
    idx: number,
    zone: string | null,
    category: TripCategory,
    purpose: 'work' | 'hobby' | 'buyFood',
    mode: string | null,
    w: number,
  ) => {
    if (!zone) return
    const key = getCellKey(zone, category)
    if (!key) return
    acc[key] ??= { work: 0, hobby: 0, buyFood: 0 }
    acc[key][purpose] += w
    respondentSets[key] ??= new Set()
    respondentSets[key].add(idx)
    const mt = classifyMobilityType(mode)
    if (mt) {
      mobilityAcc[key] ??= { FOOT: 0, BIKE: 0, TRANS: 0, CAR: 0 }
      mobilityAcc[key][mt] += w
    }
  }

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!
    add(i, e.workZone, e.categoryWork, 'work', e.transportModeToWork, e.effectiveWorkWeight)
    add(i, e.hobbyZone, e.categoryHobby, 'hobby', e.transportModeToHobby, weights.hobby)
    add(i, e.foodMarketZone, e.categoryBuyFood, 'buyFood', e.transportModeToBuyFood, weights.buyFood)
  }

  const result: ZoneDistribution = {}
  for (const [key, counts] of Object.entries(acc)) {
    const total = counts.work + counts.hobby + counts.buyFood
    const pct = (n: number) => total > 0 ? Math.round((n / total) * 10000) / 100 : 0
    const pctOfTotal = maxPossible > 0 ? Math.round((total / maxPossible) * 10000) / 100 : 0

    const mt = mobilityAcc[key] ?? { FOOT: 0, BIKE: 0, TRANS: 0, CAR: 0 }
    const mtTotal = mt.FOOT + mt.BIKE + mt.TRANS + mt.CAR
    const mtPct = (n: number) => mtTotal > 0 ? Math.round((n / mtTotal) * 10000) / 100 : 0
    const mobilityTypeBreakdown: MobilityTypeBreakdown = {
      FOOT: mt.FOOT, BIKE: mt.BIKE, TRANS: mt.TRANS, CAR: mt.CAR,
      total: mtTotal,
      pct: { FOOT: mtPct(mt.FOOT), BIKE: mtPct(mt.BIKE), TRANS: mtPct(mt.TRANS), CAR: mtPct(mt.CAR) },
    }

    result[key] = {
      respondentCount: respondentSets[key]?.size ?? 0,
      workWeighted: counts.work,
      hobbyWeighted: counts.hobby,
      buyFoodWeighted: counts.buyFood,
      totalWeighted: total,
      pct: { work: pct(counts.work), hobby: pct(counts.hobby), buyFood: pct(counts.buyFood) },
      pctOfTotal,
      mobilityTypeBreakdown,
    }
  }
  return result
}

function buildPayload(entries: MobilityEntry[], meanRemoteWorkFrequency: number): MobilityPayload {
  // Poids travail moyen effectif = moyenne des poids individuels (pour affichage)
  const meanEffectiveWorkWeight =
    entries.length > 0
      ? entries.reduce((sum, e) => sum + e.effectiveWorkWeight, 0) / entries.length
      : Math.max(0, BASE_WEIGHT_WORK - meanRemoteWorkFrequency)

  const weights = {
    work: meanEffectiveWorkWeight,
    hobby: BASE_WEIGHT_HOBBY,
    buyFood: BASE_WEIGHT_FOOD,
  }

  return {
    entries,
    categoryDistribution: {
      work: buildCategoryDistribution(entries, 'categoryWork'),
      hobby: buildCategoryDistribution(entries, 'categoryHobby'),
      buyFood: buildCategoryDistribution(entries, 'categoryBuyFood'),
    },
    weights,
    zoneDistribution: buildZoneDistribution(entries, weights, entries.length),
    meta: {
      totalResponses: entries.length,
      meanRemoteWorkFrequency,
    },
  }
}


// ===========================
// CACHE SIMPLE
// ===========================

const dpCache = new Map<string, MobilityPayload>()
let cacheTimestamp = 0
const CACHE_DURATION = 30 * 60 * 1000 // 30 min

export function clearMobilityCache() {
  dpCache.clear()
  cacheTimestamp = 0
}


// ===========================
// POINT D'ENTRÉE PRINCIPAL
// ===========================

export async function getDpMobilityDatapack(
  request: DatapackRequest,
): Promise<DatapackResponse<MobilityPayload>> {
  const requested = Array.isArray(request.selectedSus)
    ? [...request.selectedSus].filter(n => typeof n === 'number')
    : []

  let isQuartier = requested.length === 0
  let effectiveSuNumber: number | null = null
  const warnings: Array<{ type: string; message: string }> = []

  if (!isQuartier && requested.length > 1) {
    isQuartier = true
    warnings.push({
      type: 'multi_su_not_supported',
      message: 'Sélection multi-SU non supportée : affichage Quartier (agrégation).',
    })
  } else if (!isQuartier && requested.length === 1) {
    effectiveSuNumber = Number(requested[0])
  }

  const view = isQuartier ? 'quartier' : 'su'
  const cacheKey = `DpMobility|${isQuartier ? 'quartier' : `su-${effectiveSuNumber}`}`

  if (dpCache.has(cacheKey) && Date.now() - cacheTimestamp < CACHE_DURATION) {
    const cached = dpCache.get(cacheKey)!
    return {
      id: 'DpMobility',
      version: '1.0.0',
      data: cached,
      context: {
        view,
        selectedSus: requested,
        resolvedSuIds: isQuartier ? [] : effectiveSuNumber != null ? [effectiveSuNumber] : [],
      },
      warnings,
    }
  }

  const [answers, suData] = await Promise.all([
    loadWayOfLifeAnswers(),
    loadSuData(),
  ])

  if (answers.length === 0) {
    warnings.push({ type: 'missing_data', message: 'Réponses Way of Life manquantes (Way Of Life Answer.json).' })
  }
  if (suData.length === 0) {
    warnings.push({ type: 'missing_data', message: 'Données SU manquantes (Su Data.json).' })
  }

  // Mapping Su number → Su Data.ID
  const suIdByNumber = new Map<number, number>()
  for (const su of suData) suIdByNumber.set(su.Su, su.ID)

  let payload: MobilityPayload

  if (isQuartier) {
    // -----------------------------------------------------------------------
    // Vue Quartier : calculer un payload par SU, puis agrégation pondérée
    // -----------------------------------------------------------------------
    const suPayloads: Array<{ payload: MobilityPayload; weight: number }> = []

    for (const su of suData) {
      const suAnswers = answers.filter(a => a['Su ID'] === su.ID)
      if (suAnswers.length === 0) continue

      const popPct = parseFloat(String(su['Pop Percentage'] ?? '0'))
      if (!Number.isFinite(popPct) || popPct <= 0) continue

      const remoteFreqs = suAnswers
        .map(a => a['Remote Working Weekly Frequency'])
        .filter((v): v is number => v != null)
      const suMeanRemote =
        remoteFreqs.length > 0
          ? remoteFreqs.reduce((sum, v) => sum + v, 0) / remoteFreqs.length
          : 0

      const suEntries = processAnswers(suAnswers, suMeanRemote)
      const suPayload = buildPayload(suEntries, suMeanRemote)
      suPayloads.push({ payload: suPayload, weight: popPct / 100 })
    }

    if (suPayloads.length === 0) {
      warnings.push({ type: 'missing_data', message: 'Aucune donnée SU disponible pour calculer l\'agrégation Quartier.' })
      // Return empty payload
      payload = buildPayload([], 0)
    } else {
      const totalWeight = suPayloads.reduce((s, sp) => s + sp.weight, 0)
      const normalize = totalWeight > 0 ? 1 / totalWeight : 1

      // Helper: weighted mean of a scalar field
      const wmean = (getValue: (p: MobilityPayload) => number) =>
        suPayloads.reduce((sum, { payload: p, weight: w }) => sum + getValue(p) * w, 0) * normalize

      // Aggregate categoryDistribution — weighted mean of pct values
      const aggCatDist = (key: 'work' | 'hobby' | 'buyFood') => {
        const pctA = wmean(p => p.categoryDistribution[key].pct.A)
        const pctB = wmean(p => p.categoryDistribution[key].pct.B)
        const pctNSP = wmean(p => p.categoryDistribution[key].pct.NSP)
        const total = suPayloads.reduce((s, sp) => s + sp.payload.categoryDistribution[key].total, 0)
        return {
          A: 0, B: 0, NSP: 0,
          total,
          pct: { A: Math.round(pctA * 100) / 100, B: Math.round(pctB * 100) / 100, NSP: Math.round(pctNSP * 100) / 100 },
        } as CategoryDistribution
      }

      // Aggregate zoneDistribution — weighted mean of pct + pctOfTotal + mobilityTypeBreakdown.pct
      const allZoneKeys = new Set<string>()
      for (const { payload: p } of suPayloads)
        for (const k of Object.keys(p.zoneDistribution)) allZoneKeys.add(k)

      const aggZoneDist: ZoneDistribution = {}
      for (const zk of allZoneKeys) {
        const cells = suPayloads.filter(({ payload: p }) => zk in p.zoneDistribution)
        if (cells.length === 0) continue
        const cw = cells.reduce((s, sp) => s + sp.weight, 0)
        const cn = cw > 0 ? 1 / cw : 1
        const cwmean = (getValue: (c: ZoneCellBreakdown) => number) =>
          cells.reduce((sum, { payload: p, weight: w }) => sum + getValue(p.zoneDistribution[zk]!) * w, 0) * cn

        const pctWork = cwmean(c => c.pct.work)
        const pctHobby = cwmean(c => c.pct.hobby)
        const pctBuyFood = cwmean(c => c.pct.buyFood)
        const pctOfTotal = cwmean(c => c.pctOfTotal)
        const mtPctFOOT = cwmean(c => c.mobilityTypeBreakdown.pct.FOOT)
        const mtPctBIKE = cwmean(c => c.mobilityTypeBreakdown.pct.BIKE)
        const mtPctTRANS = cwmean(c => c.mobilityTypeBreakdown.pct.TRANS)
        const mtPctCAR = cwmean(c => c.mobilityTypeBreakdown.pct.CAR)
        const respondentCount = cells.reduce((s, sp) => s + sp.payload.zoneDistribution[zk]!.respondentCount, 0)

        aggZoneDist[zk] = {
          respondentCount,
          workWeighted: 0,
          hobbyWeighted: 0,
          buyFoodWeighted: 0,
          totalWeighted: 0,
          pct: {
            work: Math.round(pctWork * 100) / 100,
            hobby: Math.round(pctHobby * 100) / 100,
            buyFood: Math.round(pctBuyFood * 100) / 100,
          },
          pctOfTotal: Math.round(pctOfTotal * 100) / 100,
          mobilityTypeBreakdown: {
            FOOT: 0, BIKE: 0, TRANS: 0, CAR: 0, total: 0,
            pct: {
              FOOT: Math.round(mtPctFOOT * 100) / 100,
              BIKE: Math.round(mtPctBIKE * 100) / 100,
              TRANS: Math.round(mtPctTRANS * 100) / 100,
              CAR: Math.round(mtPctCAR * 100) / 100,
            },
          },
        }
      }

      payload = {
        entries: [], // omitted for quartier (too large, use per-SU view for entries)
        categoryDistribution: {
          work: aggCatDist('work'),
          hobby: aggCatDist('hobby'),
          buyFood: aggCatDist('buyFood'),
        },
        weights: {
          work: Math.round(wmean(p => p.weights.work) * 10000) / 10000,
          hobby: Math.round(wmean(p => p.weights.hobby) * 10000) / 10000,
          buyFood: Math.round(wmean(p => p.weights.buyFood) * 10000) / 10000,
        },
        zoneDistribution: aggZoneDist,
        meta: {
          totalResponses: suPayloads.reduce((s, sp) => s + sp.payload.meta.totalResponses, 0),
          meanRemoteWorkFrequency: Math.round(wmean(p => p.meta.meanRemoteWorkFrequency) * 10000) / 10000,
        },
      }
    }
  } else {
    // -----------------------------------------------------------------------
    // Vue SU individuelle
    // -----------------------------------------------------------------------
    const suId = effectiveSuNumber != null ? suIdByNumber.get(effectiveSuNumber) : undefined
    let filteredAnswers: WayOfLifeEntry[]
    if (suId == null) {
      warnings.push({ type: 'unknown_su', message: `SU ${effectiveSuNumber} introuvable dans Su Data.json.` })
      filteredAnswers = []
    } else {
      filteredAnswers = answers.filter(a => a['Su ID'] === suId)
    }

    const remoteFreqs = filteredAnswers
      .map(a => a['Remote Working Weekly Frequency'])
      .filter((v): v is number => v != null)
    const meanRemoteWorkFrequency =
      remoteFreqs.length > 0
        ? remoteFreqs.reduce((sum, v) => sum + v, 0) / remoteFreqs.length
        : 0

    const entries = processAnswers(filteredAnswers, meanRemoteWorkFrequency)
    payload = buildPayload(entries, meanRemoteWorkFrequency)
  }

  dpCache.set(cacheKey, payload)
  cacheTimestamp = Date.now()

  return {
    id: 'DpMobility',
    version: '1.0.0',
    data: payload,
    context: {
      view,
      selectedSus: requested,
      resolvedSuIds: isQuartier
        ? suData.map(s => s.ID)
        : effectiveSuNumber != null
          ? [suIdByNumber.get(effectiveSuNumber) ?? -1].filter(id => id !== -1)
          : [],
    },
    warnings,
  }
}
