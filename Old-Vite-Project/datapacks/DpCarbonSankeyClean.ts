// Carbon Footprint Sankey datapack - D3 Compatible from scratch
// - Pre-calculated data with memo/cache system
// - Quartier average mean calculation
// - Clean D3 sankey data structure (nodes + links with numeric indices)

import metaCarbonRaw from '../data/MetaCarbon.json?raw'
import carbonAnswerRaw from '../data/Carbon Footprint Answer.json?raw'
import suDataRaw from '../data/Su Data.json?raw'
import { getSuColors, getQuartierColors } from './DpSuColors'

// D3 Sankey expects this exact structure
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
    suIds: number[]
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

// Utility functions
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

// Data types
type NodeMetadata = {
  Id: number | string
  'Label Long': string
  'Label Short': string
  Emoji: string
  is_node: boolean
  parent_node: string
  'Metabase Question Key': string
}

type SuDataEntry = {
  ID: number | string
  'Su Bank ID': number | string
  'Pop Percentage': number | string
}

// Pre-computed cache structure
interface CarbonSankeyCache {
  nodeMetadata: NodeMetadata[]
  suResults: Map<number, D3SankeyData>
  quartierResult: D3SankeyData
  lastComputed: number
}

let cache: CarbonSankeyCache | null = null

// Get SU ID from SU number (1-based index)
function getSuIdFromNumber(suNumber: number): number {
  const suData = parseJSON<Array<SuDataEntry>>(suDataRaw)
  const availableSus = suData
    .filter(su => toNumber(su.ID) !== null)
    .sort((a, b) => toNumber(a.ID)! - toNumber(b.ID)!)
  
  if (suNumber >= 1 && suNumber <= availableSus.length) {
    return toNumber(availableSus[suNumber - 1].ID)!
  }
  
  return suNumber // Fallback
}

// Build D3 Sankey structure from carbon data
function buildD3SankeyData(carbonValues: Record<string, number>, nodeMetadata: NodeMetadata[]): D3SankeyData {
  // Step 1: Create lookup maps from metadata
  const nodesByQuestionKey = new Map<string, NodeMetadata>()
  const parentToChildren = new Map<string, NodeMetadata[]>()
  
  // Index all nodes by their question key
  for (const meta of nodeMetadata) {
    const questionKey = toStringSafe(meta['Metabase Question Key'])
    if (questionKey) {
      nodesByQuestionKey.set(questionKey, meta)
    }
  }
  
  // Group nodes by their parent_node field
  for (const meta of nodeMetadata) {
    const parentNode = toStringSafe(meta.parent_node).trim()
    if (parentNode) {
      if (!parentToChildren.has(parentNode)) {
        parentToChildren.set(parentNode, [])
      }
      parentToChildren.get(parentNode)!.push(meta)
    }
  }
  
  // Step 2: Build parent and child categories - Two-pass approach for clarity
  const parentCategories = new Map<string, {
    id: string
    name: string
    emoji: string
    value: number
    children: string[]
  }>()
  
  const childCategories = new Map<string, {
    id: string
    name: string
    emoji: string
    value: number
    parentKey: string
  }>()

  // First pass: Identify all parent categories (those with parent_node = "Total")
  console.log('=== FIRST PASS: Identifying Parent Categories ===')
  for (const meta of nodeMetadata) {
    const questionKey = toStringSafe(meta['Metabase Question Key'])
    const value = carbonValues[questionKey] || 0
    
    if (value <= 0) continue
    
    const name = toStringSafe(meta['Label Short']) || toStringSafe(meta['Label Long'])
    const emoji = toStringSafe(meta.Emoji)
    const parentNode = toStringSafe(meta.parent_node).trim()
    
    // Skip if no clear category
    if (!name || !questionKey) continue
    
    // Only process top-level categories in first pass
    if (parentNode.toLowerCase() === 'total') {
      parentCategories.set(questionKey, {
        id: questionKey,
        name: name,
        emoji: emoji,
        value: value,
        children: []
      })
      console.log(`🎯 Parent found: "${name}" (${questionKey})`)
    }
  }

  // Second pass: Identify children and match them to parents
  console.log('=== SECOND PASS: Matching Children to Parents ===')
  for (const meta of nodeMetadata) {
    const questionKey = toStringSafe(meta['Metabase Question Key'])
    const value = carbonValues[questionKey] || 0
    
    if (value <= 0) continue
    
    const name = toStringSafe(meta['Label Short']) || toStringSafe(meta['Label Long'])
    const emoji = toStringSafe(meta.Emoji)
    const parentNode = toStringSafe(meta.parent_node).trim()
    
    // Skip if no clear category or if this is already a parent
    if (!name || !questionKey || parentNode.toLowerCase() === 'total') continue
    
    // Find the parent this child belongs to
    let parentKey = ''
    
    // Look for parent by matching parent_node with parent Label Long/Short
    for (const [pKey, parentData] of parentCategories) {
      if (parentData.name === parentNode) {
        parentKey = pKey
        break
      }
    }
    
    if (parentKey) {
      childCategories.set(questionKey, {
        id: questionKey,
        name: name,
        emoji: emoji,
        value: value,
        parentKey: parentKey
      })
      
      parentCategories.get(parentKey)?.children.push(questionKey)
      
      const parentData = parentCategories.get(parentKey)!
      console.log(`✅ Child "${name}" (${questionKey}) → Parent "${parentData.name}" (${parentKey})`)
    } else {
      console.log(`❌ Child "${name}" (${questionKey}) could not find parent for "${parentNode}"`)
    }
  }

  // Step 3: Build D3 nodes array - ONLY nodes that will have links, sorted by parent category
  const nodes: D3SankeyData['nodes'] = []
  const nodeIndexMap = new Map<string, number>()
  
  // Filter out total/global nodes - they don't belong in sankey
  const validParents = Array.from(parentCategories.values()).filter(p => 
    !p.name.toLowerCase().includes('total') && 
    !p.id.toLowerCase().includes('global') &&
    p.children.length > 0  // Only parents that have children
  )
  
  // Sort parents by name for consistent ordering (Transport, Alimentation, Logement, etc.)
  validParents.sort((a, b) => a.name.localeCompare(b.name))
  
  // Filter children that have valid parents and group them by parent
  const childrenByParent = new Map<string, Array<{
    id: string
    name: string
    emoji: string
    value: number
    parentKey: string
  }>>()
  
  for (const child of childCategories.values()) {
    if (validParents.some(p => p.id === child.parentKey)) {
      if (!childrenByParent.has(child.parentKey)) {
        childrenByParent.set(child.parentKey, [])
      }
      childrenByParent.get(child.parentKey)!.push(child)
    }
  }
  
  // Sort children within each parent group by name for consistent ordering
  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.name.localeCompare(b.name))
  }
  
  // Create ordered list of children following parent order
  const validChildren: Array<{
    id: string
    name: string
    emoji: string
    value: number
    parentKey: string
  }> = []
  
  for (const parent of validParents) {
    const parentChildren = childrenByParent.get(parent.id) || []
    validChildren.push(...parentChildren)
  }
  
  // Debug logging (remove in production)
  console.log('=== FINAL HIERARCHY ANALYSIS ===')
  console.log('- Total parent categories found:', parentCategories.size)
  console.log('- Total child categories found:', childCategories.size)
  console.log('- Valid parents (with children):', validParents.length)
  console.log('- Valid children (with parents):', validChildren.length)
  
  console.log('=== FINAL PARENT-CHILD RELATIONSHIPS ===')
  validParents.forEach((p, pIndex) => {
    const children = validChildren.filter(c => c.parentKey === p.id)
    console.log(`📁 ${pIndex + 1}. Parent: "${p.name}" (${p.value.toFixed(1)}kg) [${p.id}]`)
    children.forEach((child, cIndex) => {
      console.log(`   ${cIndex + 1}. Child: "${child.name}" (${child.value.toFixed(1)}kg) [${child.id}]`)
    })
  })
  
  // Add parent nodes
  for (const parent of validParents) {
    const index = nodes.length
    nodeIndexMap.set(parent.id, index)
    nodes.push({
      id: parent.id,
      name: parent.name,
      emoji: parent.emoji,
      value: parent.value
    })
  }
  
  // Add child nodes
  for (const child of validChildren) {
    const index = nodes.length
    nodeIndexMap.set(child.id, index)
    nodes.push({
      id: child.id,
      name: child.name,
      emoji: child.emoji,
      value: child.value
    })
  }

  // Debug logging AFTER nodes are built
  console.log('=== FINAL NODE ORDER IN D3 (ACTUAL) ===')
  nodes.forEach((node, index) => {
    const isParent = validParents.some(p => p.id === node.id)
    const prefix = isParent ? '🔵 PARENT' : '🔸 CHILD'
    console.log(`${index}: ${prefix} "${node.name}" (${node.value.toFixed(1)}kg) [${node.id}]`)
  })

  // Step 4: Build D3 links array
  const links: D3SankeyData['links'] = []
  
  for (const child of validChildren) {
    const parentIndex = nodeIndexMap.get(child.parentKey)
    const childIndex = nodeIndexMap.get(child.id)
    
    if (parentIndex !== undefined && childIndex !== undefined) {
      links.push({
        source: parentIndex,
        target: childIndex,
        value: child.value
      })
    }
  }

  return { nodes, links }
}

// Calculate carbon data for a specific SU
function calculateCarbonForSu(suId: number, nodeMetadata: NodeMetadata[]): D3SankeyData {
  const carbonAnswer = parseJSON<Array<Record<string, unknown>>>(carbonAnswerRaw)
  const relevantAnswers = carbonAnswer.filter(entry => toNumber(entry['Su ID']) === suId)
  
  // Calculate average values for each question key
  const carbonValues: Record<string, number> = {}
  
  for (const meta of nodeMetadata) {
    const questionKey = toStringSafe(meta['Metabase Question Key'])
    const values: number[] = []
    
    for (const answer of relevantAnswers) {
      const value = toNumber(answer[questionKey])
      if (value !== null && value > 0) {
        values.push(value) // Keep original values (kg), DV will convert to tons for display
      }
    }
    
    const average = values.length > 0 
      ? values.reduce((a, b) => a + b, 0) / values.length 
      : 0
    
    carbonValues[questionKey] = average
  }
  
  return buildD3SankeyData(carbonValues, nodeMetadata)
}

// Get total carbon value (Global Note) for Sus or Quartier
function getTotalCarbonValue(suIds: number[], isQuartierView: boolean): number {
  const carbonAnswer = parseJSON<Array<Record<string, unknown>>>(carbonAnswerRaw)
  
  if (isQuartierView) {
    // Quartier: weighted average of Global Note across all SUs using population percentages
    const suData = parseJSON<Array<SuDataEntry>>(suDataRaw)
    
    let totalWeightedSum = 0
    let totalWeight = 0
    
    suIds.forEach(suId => {
      const suAnswers = carbonAnswer.filter(entry => toNumber(entry['Su ID']) === suId)
      const suPopInfo = suData.find(s => toNumber(s.ID) === suId)
      const weight = toNumber(suPopInfo?.['Pop Percentage']) || 1
      
      if (suAnswers.length > 0 && weight > 0) {
        // Calculate average Global Note for this SU
        const globalNoteValues = suAnswers
          .map(answer => toNumber(answer['Global Note']))
          .filter(val => val !== null && val > 0) as number[]
        
        if (globalNoteValues.length > 0) {
          const suAverage = globalNoteValues.reduce((a, b) => a + b, 0) / globalNoteValues.length // Keep in kg, DV will convert
          totalWeightedSum += suAverage * weight
          totalWeight += weight
        }
      }
    })
    
    return totalWeight > 0 ? totalWeightedSum / totalWeight : 0
  } else {
    // Single SU: average of Global Note for that SU
    const suId = suIds[0]
    const relevantAnswers = carbonAnswer.filter(entry => toNumber(entry['Su ID']) === suId)
    
    const globalNoteValues = relevantAnswers
      .map(answer => toNumber(answer['Global Note']))
      .filter(val => val !== null && val > 0) as number[]
    
    return globalNoteValues.length > 0 
      ? globalNoteValues.reduce((a, b) => a + b, 0) / globalNoteValues.length // Keep in kg, DV will convert 
      : 0
  }
}

// Calculate quartier average with population weighting
function calculateQuartierAverage(allSuResults: Map<number, D3SankeyData>): D3SankeyData {
  const suData = parseJSON<Array<SuDataEntry>>(suDataRaw)
  
  // Check if population percentages are available
  const hasPopWeights = suData.some(su => {
    const popPerc = toNumber(su['Pop Percentage'])
    return popPerc !== null && popPerc > 0
  })
  
  // Collect all unique node IDs and calculate weighted averages
  const allNodeIds = new Set<string>()
  allSuResults.forEach(result => {
    result.nodes.forEach(node => allNodeIds.add(node.id))
  })
  
  const weightedValues: Record<string, { totalWeightedSum: number; totalWeight: number; metadata?: { name: string; emoji: string } }> = {}
  
  // Initialize all nodes
  for (const nodeId of allNodeIds) {
    weightedValues[nodeId] = { totalWeightedSum: 0, totalWeight: 0 }
  }
  
  // Calculate weighted sums
  allSuResults.forEach((result, suId) => {
    const suInfo = suData.find(s => toNumber(s.ID) === suId)
    const weight = hasPopWeights ? (toNumber(suInfo?.['Pop Percentage']) || 0) : 1
    
    if (weight > 0) {
      result.nodes.forEach(node => {
        if (weightedValues[node.id]) {
          weightedValues[node.id].totalWeightedSum += node.value * weight
          weightedValues[node.id].totalWeight += weight
          if (!weightedValues[node.id].metadata) {
            weightedValues[node.id].metadata = { name: node.name, emoji: node.emoji }
          }
        }
      })
    }
  })
  
  // Build nodes with averaged values
  const avgNodes: Array<{ id: string; name: string; emoji: string; value: number }> = []
  const nodeIndexMap = new Map<string, number>()
  
  for (const [nodeId, data] of Object.entries(weightedValues)) {
    if (data.totalWeight > 0 && data.metadata) {
      const avgValue = data.totalWeightedSum / data.totalWeight
      const index = avgNodes.length
      
      nodeIndexMap.set(nodeId, index)
      avgNodes.push({
        id: nodeId,
        name: data.metadata.name,
        emoji: data.metadata.emoji,
        value: avgValue
      })
    }
  }
  
  // Rebuild links based on averaged data
  const avgLinks: D3SankeyData['links'] = []
  const linkMap = new Map<string, { source: string; target: string; totalValue: number; count: number }>()
  
  // Collect all links across SUs
  allSuResults.forEach(result => {
    result.links.forEach(link => {
      const sourceId = result.nodes[link.source]?.id
      const targetId = result.nodes[link.target]?.id
      
      if (sourceId && targetId) {
        const linkKey = `${sourceId}->${targetId}`
        if (!linkMap.has(linkKey)) {
          linkMap.set(linkKey, { source: sourceId, target: targetId, totalValue: 0, count: 0 })
        }
        const linkData = linkMap.get(linkKey)!
        linkData.totalValue += link.value
        linkData.count += 1
      }
    })
  })
  
  // Create averaged links
  for (const linkData of linkMap.values()) {
    const sourceIndex = nodeIndexMap.get(linkData.source)
    const targetIndex = nodeIndexMap.get(linkData.target)
    
    if (sourceIndex !== undefined && targetIndex !== undefined) {
      avgLinks.push({
        source: sourceIndex,
        target: targetIndex,
        value: linkData.totalValue / linkData.count
      })
    }
  }
  
  return { nodes: avgNodes, links: avgLinks }
}

// Pre-compute all data
function precomputeAllData(): CarbonSankeyCache {
  const metaCarbon = parseJSON<Array<NodeMetadata>>(metaCarbonRaw)
  const nodeMetadata = metaCarbon.filter(item => item.is_node === true)
  
  const suData = parseJSON<Array<SuDataEntry>>(suDataRaw)
  const allSuIds = suData
    .map(su => toNumber(su.ID))
    .filter((id): id is number => id !== null)
    .sort()
  
  // Calculate for each SU
  const suResults = new Map<number, D3SankeyData>()
  for (const suId of allSuIds) {
    const result = calculateCarbonForSu(suId, nodeMetadata)
    if (result.nodes.length > 0) {
      suResults.set(suId, result)
    }
  }
  
  // Calculate quartier average
  const quartierResult = calculateQuartierAverage(suResults)
  
  return {
    nodeMetadata,
    suResults,
    quartierResult,
    lastComputed: Date.now()
  }
}

// Get cached data
function getCachedData(): CarbonSankeyCache {
  if (!cache) {
    cache = precomputeAllData()
  }
  return cache
}

// Main export function
export function getCarbonSankeyD3Data(selectedSus?: number[]): CarbonSankeyPayload {
  console.log('getCarbonSankeyD3Data called with selectedSus:', selectedSus)
  const cached = getCachedData()
  console.log('Got cached data, cache timestamp:', new Date(cached.lastComputed))
  
  // Determine if quartier view
  const isQuartierView = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1
  
  let sankeyData: D3SankeyData
  let targetSuIds: number[]
  let mainColor: string
  
  if (isQuartierView) {
    sankeyData = cached.quartierResult
    targetSuIds = Array.from(cached.suResults.keys())
    
    // Quartier color using DpSuColors
    const quartierColors = getQuartierColors()
    mainColor = quartierColors.colorMain
  } else {
    // Single SU view
    const suId = getSuIdFromNumber(selectedSus[0])
    sankeyData = cached.suResults.get(suId) || cached.quartierResult
    targetSuIds = [suId]
    
    // SU color using DpSuColors
    // Use the Su ID directly, as DpSuColors maps by Su Bank Id (which matches Su ID in Su Bank.json)
    const suColors = getSuColors(suId)
    mainColor = suColors.colorMain
  }
  
  // Calculate metadata - use Global Note for total, not sum of categories
  const totalValue = getTotalCarbonValue(targetSuIds, isQuartierView)
  const maxNodeValue = Math.max(...sankeyData.nodes.map(node => node.value))
  
  // Warnings
  const warnings: CarbonSankeyPayload['warnings'] = []
  if (sankeyData.nodes.length === 0) {
    warnings.push({
      type: 'no_carbon_data',
      message: 'No carbon footprint data found'
    })
  }
  
  return {
    id: 'CarbonSankeyD3',
    version: '2.0.0',
    sankeyData,
    selectedView: {
      suIds: targetSuIds,
      color: mainColor,
      isQuartier: isQuartierView
    },
    warnings,
    meta: {
      totalValue,
      maxNodeValue
    }
  }
}

export function getCarbonSankeyD3Text(selectedSus?: number[]): string {
  return JSON.stringify(getCarbonSankeyD3Data(selectedSus))
}

// Debug/dev functions
export function clearCarbonCache() {
  cache = null
}

export function debugCarbonCache() {
  const cached = getCachedData()
  console.log('Carbon Cache Debug:', {
    nodeMetadata: cached.nodeMetadata.length,
    suResults: cached.suResults.size,
    quartierNodes: cached.quartierResult.nodes.length,
    quartierLinks: cached.quartierResult.links.length,
    lastComputed: new Date(cached.lastComputed)
  })
  return cached
}