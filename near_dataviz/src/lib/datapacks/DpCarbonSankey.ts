/**
 * DATAPACK - Carbon Sankey (D3 sankey)
 *
 * Transforme les données carbone hiérarchiques en structure attendue par D3 Sankey.
 * - Vue SU: utilise les lignes pour les SUs sélectionnées (clé "Su ID" => correspond à `Su Data.json`.`ID`)
 * - Vue Quartier: calcule une moyenne pondérée à partir des SUs (pondération: `Su Data.json`.`Pop Percentage`)
 *
 * Données utilisées:
 * - /public/data/Carbon Footprint Answer.json   (valeurs par clé carbone)
 * - /public/data/MetaCarbon.json                (métadonnées des noeuds, is_node, parent_node, labels, emoji)
 * - /public/data/Su Data.json                   (poids de population + mapping Su number <-> ID)
 */

// ===========================
// TYPES EXPORTÉS (D3 Sankey)
// ===========================
export type D3SankeyData = {
  nodes: Array<{
    id: string
    name: string
    emoji: string
    value: number
  }>
  links: Array<{
    source: number // index in nodes array
    target: number // index in nodes array
    value: number
  }>
}

export type CarbonSankeyPayload = {
  id: string
  version: string
  sankeyData: D3SankeyData
  selectedView: {
    suIds: number[] // SU numbers (1..N)
    color: string
    isQuartier: boolean
  }
  warnings: Array<{
    type: 'missing_data' | 'no_carbon_data'
    message: string
  }>
  meta: {
    totalValue: number
    maxNodeValue: number
  }
}


// INTERFACES INTERNES
// ===================
type CarbonAnswer = {
  ID?: number | string
  'Su ID': number
  [key: string]: unknown
}

type MetaCarbonItem = {
  Id: number | string
  'Label Long': string
  'Label Short': string
  Emoji: string
  is_node: boolean
  parent_node: string
  'Metabase Question Key': string
}

type SuDataEntry = {
  ID: number
  'Survey ID': number
  Su: number // SU number (1..N)
  'Pop Percentage': string // e.g. "12.25"
  'Su Bank ID': number
}


// UTILS
// =====
function toNumber(val: unknown): number | null {
  if (val == null) return null
  if (typeof val === 'number') return Number.isFinite(val) ? val : null
  if (typeof val === 'string') {
    const clean = val.replace(/,/g, '.').replace(/\s/g, '')
    const num = Number(clean)
    return Number.isFinite(num) ? num : null
  }
  return null
}

// CHARGEMENT DES DONNÉES
// ======================
async function loadCarbonAnswers(): Promise<CarbonAnswer[]> {
  try {
    const res = await fetch('/api/data/Carbon%20Footprint%20Answer')
    const json = (await res.json()) as unknown[]
    // Type guard
    const isCarbonAnswer = (r: unknown): r is CarbonAnswer => {
      return typeof r === 'object' && r !== null && 'Su ID' in r
    }
    // Filtrer les entrées vides potentielles
    return (json || []).filter(isCarbonAnswer)
  } catch (error) {
    console.error('[DpCarbonSankey] loadCarbonAnswers error:', error)
    return []
  }
}

async function loadMetaCarbon(): Promise<MetaCarbonItem[]> {
  try {
    const res = await fetch('/api/data/MetaCarbon')
    const json = (await res.json()) as Array<MetaCarbonItem | null | undefined>
    return (json || []).filter((m): m is MetaCarbonItem => Boolean(m?.['Metabase Question Key']))
  } catch (error) {
    console.error('[DpCarbonSankey] loadMetaCarbon error:', error)
    return []
  }
}

async function loadSuData(): Promise<SuDataEntry[]> {
  try {
    const res = await fetch('/api/data/Su%20Data')
    const json = (await res.json()) as SuDataEntry[]
    return json || []
  } catch (error) {
    console.error('[DpCarbonSankey] loadSuData error:', error)
    return []
  }
}


// CONSTRUCTION DES VALEURS CARBONE PAR CLÉ (MOYENNES)
// ===================================================
// Calcule la moyenne par clé (kg CO2e) sur un ensemble de réponses filtrées
function buildMeanValuesFromAnswers(
  answers: CarbonAnswer[],
  meta: MetaCarbonItem[]
): Record<string, number> {
  const validKeys = new Set(
    meta.filter(m => m.is_node).map(m => m['Metabase Question Key'])
  )

  const sum: Record<string, number> = {}
  const cnt: Record<string, number> = {}
  for (const row of answers) {
    for (const [key, raw] of Object.entries(row)) {
      if (!validKeys.has(key)) continue
      const num = toNumber(raw)
      if (num == null) continue
      sum[key] = (sum[key] ?? 0) + num
      cnt[key] = (cnt[key] ?? 0) + 1
    }
  }
  const mean: Record<string, number> = {}
  for (const k of Object.keys(sum)) {
    const c = cnt[k] ?? 0
    const s = sum[k] ?? 0
    mean[k] = c > 0 ? s / c : 0
  }
  return mean
}


// CONSTRUCTION DE LA STRUCTURE D3 SANKEY
// ======================================
function buildD3SankeyData(
  carbonValues: Record<string, number>,
  nodeMetadata: MetaCarbonItem[]
): D3SankeyData {
  // Considérer tous les noeuds is_node (toutes profondeurs)
  const metas = nodeMetadata.filter(m => m.is_node)

  // Index des métadonnées par question key
  const metaByKey = new Map<string, MetaCarbonItem>()
  for (const m of metas) {
    metaByKey.set(m['Metabase Question Key'], m)
  }

  // Graphe parent -> enfants basé sur parent_node (ignorer les parents 'Total')
  const childrenByParent = new Map<string, string[]>()
  const parentOf = new Map<string, string | null>() // childKey -> parentKey|null

  for (const m of metas) {
    const key = m['Metabase Question Key']
    const parentKey = m.parent_node && m.parent_node.toLowerCase() !== 'total' ? m.parent_node : null
    parentOf.set(key, parentKey)
    if (parentKey) {
      if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, [])
      childrenByParent.get(parentKey)!.push(key)
      // Si le parent n'existe pas dans meta, créer un parent implicite minimal
      if (!metaByKey.has(parentKey)) {
        metaByKey.set(parentKey, {
          Id: parentKey,
          'Label Long': parentKey,
          'Label Short': parentKey,
          Emoji: '',
          is_node: true,
          parent_node: 'Total',
          'Metabase Question Key': parentKey
        })
      }
    }
  }

  // Valeur des feuilles: issue des carbonValues. Internal nodes: somme des descendants
  const sumCache = new Map<string, number>()
  const getChildren = (key: string) => childrenByParent.get(key) ?? []
  const hasChildren = (key: string) => getChildren(key).length > 0

  const sumFor = (key: string): number => {
    if (sumCache.has(key)) return sumCache.get(key)!
    let value: number
    if (!hasChildren(key)) {
      value = carbonValues[key] ?? 0
    } else {
      value = getChildren(key)
        .map(child => sumFor(child))
        .reduce((a, b) => a + b, 0)
    }
    sumCache.set(key, value)
    return value
  }

  // Déterminer les racines (parent null/Total) et construire l'ensemble des clés incluses (somme>0)
  const allKeys = Array.from(new Set<string>([...metaByKey.keys(), ...parentOf.keys()]))
  const roots = allKeys.filter(k => (parentOf.get(k) ?? null) === null)

  // Calculer toutes les sommes
  roots.forEach(r => sumFor(r))

  const includeKey = (key: string): boolean => sumFor(key) > 0 && (hasChildren(key) || (parentOf.get(key) ?? null) !== null)

  // Construire nodes + links en parcours depuis les racines
  const nodes: D3SankeyData['nodes'] = []
  const links: D3SankeyData['links'] = []
  const nodeIndex = new Map<string, number>()

  // Parcours DFS pour ordre naturel (racine -> feuilles)
  const visited = new Set<string>()
  const addNode = (key: string) => {
    if (visited.has(key)) return
    visited.add(key)
    const meta = metaByKey.get(key)
  const name = (meta?.['Label Short'] ?? meta?.['Label Long'] ?? key)
  const emoji = (meta?.Emoji ?? '')
    const idx = nodes.length
    nodes.push({ id: key, name, emoji, value: sumFor(key) })
    nodeIndex.set(key, idx)
  }

  const dfs = (key: string) => {
    if (!includeKey(key)) return
    addNode(key)
    for (const child of getChildren(key).sort((a, b) => {
      const ma = metaByKey.get(a), mb = metaByKey.get(b)
      const na = (ma?.['Label Short'] ?? ma?.['Label Long'] ?? a)
      const nb = (mb?.['Label Short'] ?? mb?.['Label Long'] ?? b)
      return na.localeCompare(nb)
    })) {
      if (!includeKey(child)) continue
      // Assurez-vous que l'enfant est ajouté avant de créer le lien
      addNode(child)
      links.push({ source: nodeIndex.get(key)!, target: nodeIndex.get(child)!, value: sumFor(child) })
      dfs(child)
    }
  }

  // Démarrer depuis chaque racine incluse
  roots
    .filter(includeKey)
    .sort((a, b) => {
      const ma = metaByKey.get(a), mb = metaByKey.get(b)
      const na = (ma?.['Label Short'] ?? ma?.['Label Long'] ?? a)
      const nb = (mb?.['Label Short'] ?? mb?.['Label Long'] ?? b)
      return na.localeCompare(nb)
    })
    .forEach(r => dfs(r))

  return { nodes, links }
}


// CALCUL VUE SU ET QUARTIER
// =========================
// (helper removed: multi-SU non supporté)

function getPopulationWeights(suData: SuDataEntry[]): Map<number, number> {
  // Retourne Map<SU number, weight (0..1)>
  const weights = new Map<number, number>()
  for (const su of suData) {
    const w = toNumber(su['Pop Percentage'])
    if (w != null) weights.set(su.Su, w / 100)
  }
  return weights
}

// Calcule la distribution carbone agrégée pondérée pour la vue quartier
function computeWeightedQuartierValues(
  perSuValues: Array<{ suNumber: number; values: Record<string, number> }>,
  weights: Map<number, number>
): Record<string, number> {
  const agg: Record<string, number> = {}
  let weightSum = 0

  for (const { suNumber, values } of perSuValues) {
    const w = weights.get(suNumber) ?? 0
    if (w <= 0) continue
    weightSum += w
    for (const [key, val] of Object.entries(values)) {
      agg[key] = (agg[key] ?? 0) + (val * w)
    }
  }

  // Normaliser pour obtenir une moyenne pondérée
  if (weightSum > 0) {
    for (const k of Object.keys(agg)) agg[k] = (agg[k] ?? 0) / weightSum
  }
  return agg
}

// Valeur titre: moyenne de "Global Note" (ou fallback)
function computeTotalValue(values: Record<string, number>): number {
  const global = values['Global Note']
  if (typeof global === 'number' && Number.isFinite(global)) return global
  let total = 0
  for (const v of Object.values(values)) total += v
  return total
}


// CACHE SIMPLE
// ============
const dataCache = new Map<string, CarbonSankeyPayload>()
let cacheTimestamp = 0
const CACHE_DURATION = 30 * 60 * 1000 // 30 min

export function clearCarbonSankeyCache() {
  dataCache.clear()
  cacheTimestamp = 0
}


// EXPORT PRINCIPAL
// ================
export async function getDpCarbonSankeyData(selectedSus?: number[]): Promise<CarbonSankeyPayload> {
  const requested = Array.isArray(selectedSus) ? [...selectedSus].filter(n => typeof n === 'number') : []
  let isQuartier = requested.length === 0
  let effectiveSuNumber: number | null = null
  const warnings: CarbonSankeyPayload['warnings'] = []

  if (!isQuartier && requested.length > 1) {
    // Multi-SU non supporté: bascule en Quartier (moyenne pondérée)
    isQuartier = true
    warnings.push({ type: 'missing_data', message: 'Sélection multi-SU non supportée: affichage Quartier (moyenne pondérée).' })
  } else if (!isQuartier && requested.length === 1) {
    effectiveSuNumber = Number(requested[0])
  }

  const cacheKey = `DpCarbonSankey|${isQuartier ? 'quartier' : `su-${effectiveSuNumber}`}`

  // Cache valid?
  if (dataCache.has(cacheKey) && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return dataCache.get(cacheKey)!
  }

  const [answers, meta, suData] = await Promise.all([
    loadCarbonAnswers(),
    loadMetaCarbon(),
    loadSuData()
  ])

  // warnings éventuellement alimentés plus haut

  if (meta.length === 0) {
    warnings.push({ type: 'missing_data', message: 'Métadonnées carbone manquantes (MetaCarbon.json)' })
  }
  if (answers.length === 0) {
    warnings.push({ type: 'missing_data', message: 'Réponses carbone manquantes (Carbon Footprint Answer.json)' })
  }
  if (suData.length === 0) {
    warnings.push({ type: 'missing_data', message: 'Données SU manquantes (Su Data.json)' })
  }

  // Aucune donnée exploitable
  if (meta.length === 0 || answers.length === 0 || suData.length === 0) {
    const empty: CarbonSankeyPayload = {
      id: 'DpCarbonSankey',
      version: '1.0.0',
      sankeyData: { nodes: [], links: [] },
      selectedView: { suIds: isQuartier || effectiveSuNumber == null ? [] : [effectiveSuNumber], color: '#002878', isQuartier },
      warnings,
      meta: { totalValue: 0, maxNodeValue: 0 }
    }
    dataCache.set(cacheKey, empty)
    cacheTimestamp = Date.now()
    return empty
  }

  // Mapping SU number -> Su Data.ID (pour filtrer answers["Su ID"])
  const suIdByNumber = new Map<number, number>()
  for (const su of suData) suIdByNumber.set(su.Su, su.ID)

  // Préparer calculs
  let carbonValues: Record<string, number>

  if (isQuartier) {
    // Vue quartier: moyenne pondérée des moyennes par SU
    const weights = getPopulationWeights(suData)
    const perSu: Array<{ suNumber: number; values: Record<string, number> }> = []

    for (const su of suData) {
      const suId = su.ID
      const suNumber = su.Su
      const suAnswers = answers.filter(a => a['Su ID'] === suId)
      const suMeans = buildMeanValuesFromAnswers(suAnswers, meta)
      perSu.push({ suNumber, values: suMeans })
    }

    carbonValues = computeWeightedQuartierValues(perSu, weights)
  } else {
    // Vue SU: moyenne par SU uniquement (pas d'agrégation multi-SU)
    const suId = effectiveSuNumber != null ? suIdByNumber.get(effectiveSuNumber) : undefined
    const suAnswers = suId != null ? answers.filter(a => a['Su ID'] === suId) : []
    carbonValues = buildMeanValuesFromAnswers(suAnswers, meta)
  }

  // Construire structure D3 Sankey
  const sankeyData = buildD3SankeyData(carbonValues, meta)

  // Metadonnées diverses
  const totalValue = computeTotalValue(carbonValues)
  const maxNodeValue = sankeyData.nodes.reduce((m, n) => Math.max(m, n.value), 0)

  if (sankeyData.nodes.length === 0) {
    warnings.push({ type: 'no_carbon_data', message: 'Aucune valeur carbone exploitable pour la sélection.' })
  }

  const payload: CarbonSankeyPayload = {
    id: 'DpCarbonSankey',
    version: '1.0.0',
    sankeyData,
    selectedView: {
      suIds: isQuartier || effectiveSuNumber == null ? [] : [effectiveSuNumber],
      color: '#002878',
      isQuartier
    },
    warnings,
    meta: {
      totalValue,
      maxNodeValue
    }
  }

  dataCache.set(cacheKey, payload)
  cacheTimestamp = Date.now()
  return payload
}


// DEV/TEST
// ========
export async function testDpCarbonSankey() {
  // Simple smoke test
  const quartier = await getDpCarbonSankeyData([])
  const su1 = await getDpCarbonSankeyData([1])
  return { quartier, su1 }
}
