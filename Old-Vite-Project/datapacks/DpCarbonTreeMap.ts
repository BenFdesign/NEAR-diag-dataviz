// Carbon TreeMap datapack
// - Creates proper hierarchical carbon footprint data for D3 TreeMap
// - Uses MetaCarbon.json structure with parent_node relationships
// - Builds complete tree hierarchy from is_node=true entries

import metaCarbonRaw from '../data/MetaCarbon.json?raw'
import carbonAnswerRaw from '../data/Carbon Footprint Answer.json?raw'
import suBankRaw from '../data/Su Bank.json?raw'

export type TreeMapNode = {
  id: string
  name: string
  label: string
  emoji: string
  value: number
  percentage: number
  parentId?: string
  children?: TreeMapNode[]
  depth: number
}

export type DpCarbonTreeMapData = {
  id: string
  version: string
  treeData: TreeMapNode
  selectedView: {
    suIds: number[]
    color: string
    isQuartier: boolean
  }
  warnings: Array<{
    type: 'missing_data' | 'no_carbon_data' | 'hierarchy_error'
    message: string
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

const cache: Map<string, DpCarbonTreeMapData> = new Map()

export function getDpCarbonTreeMapData(selectedSus?: number[]): DpCarbonTreeMapData {
  // Create cache key based on selected SUs
  const cacheKey = selectedSus ? selectedSus.sort().join(',') : 'quartier'
  if (cache.has(cacheKey)) return cache.get(cacheKey)!

  const metaCarbon = parseJSON<Array<{
    Id: number | string
    'Label Long': string
    'Label Short': string
    Emoji: string
    is_node: boolean
    parent_node: string
    'Metabase Question Key': string
  }>>(metaCarbonRaw)

  const carbonAnswer = parseJSON<Array<Record<string, unknown>>>(carbonAnswerRaw)
  const suBank = parseJSON<Array<{ 
    Id: number | string
    colorMain?: string
  }>>(suBankRaw)

  const warnings: DpCarbonTreeMapData['warnings'] = []

  // Determine target SU IDs based on selection
  const isQuartierView = !selectedSus || selectedSus.length === 0 || selectedSus.length > 1
  let targetSuIds: number[]
  let mainColor = '#6c757d' // Default color

  if (isQuartierView) {
    // Get all unique SU IDs for quartier view
    targetSuIds = Array.from(new Set(
      carbonAnswer
        .map(entry => toNumber(entry['Su ID']))
        .filter((id): id is number => id !== null)
    ))
    // Use quartier color (ID 0)
    const quartierInfo = suBank.find(s => toNumber(s.Id) === 0)
    mainColor = quartierInfo?.colorMain || '#002878'
  } else {
    // Map SU numbers to SU IDs (477=Myrtille, 478=Orange, 479=Kiwi)   
    const suIds = selectedSus.map(suNum => 476 + suNum)
    targetSuIds = suIds
    
    // Use first selected SU's color
    if (suIds.length > 0) {
      const suInfo = suBank.find(s => toNumber(s.Id) === suIds[0])
      mainColor = suInfo?.colorMain || '#6c757d'
    }
  }

  // Filter carbon answers for target SUs
  const relevantAnswers = carbonAnswer.filter(entry => {
    const suId = toNumber(entry['Su ID'])
    return suId !== null && targetSuIds.includes(suId)
  })

  if (relevantAnswers.length === 0) {
    warnings.push({
      type: 'no_carbon_data',
      message: 'No carbon footprint data found for selected SUs'
    })
  }

  // Get all node metadata where is_node = true
  const nodeMetadata = metaCarbon.filter(item => item.is_node === true)

  // Calculate average values for each node
  const nodeValues: Record<string, number> = {}
  
  for (const nodeMeta of nodeMetadata) {
    const questionKey = toStringSafe(nodeMeta['Metabase Question Key'])
    const values: number[] = []
    
    for (const answer of relevantAnswers) {
      const value = toNumber(answer[questionKey])
      if (value !== null && value > 0) {
        values.push(value)
      }
    }
    
    // Calculate average value for this node
    const avgValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
    nodeValues[questionKey] = avgValue
  }

  // Build flat list of nodes with their data
  const flatNodes: TreeMapNode[] = []
  let totalValue = 0

  for (const nodeMeta of nodeMetadata) {
    const questionKey = toStringSafe(nodeMeta['Metabase Question Key'])
    const value = nodeValues[questionKey] || 0
    const label = toStringSafe(nodeMeta['Label Long']) || toStringSafe(nodeMeta['Label Short'])
    const parentNode = toStringSafe(nodeMeta.parent_node)
    
    if (value > 0 || parentNode === '') { // Include root even if no direct value
      const node: TreeMapNode = {
        id: questionKey,
        name: label,
        label: label,
        emoji: toStringSafe(nodeMeta.Emoji),
        value: value,
        percentage: 0, // Will be calculated later
        parentId: parentNode || undefined,
        children: [],
        depth: 0 // Will be calculated later
      }
      
      flatNodes.push(node)
      if (!parentNode) totalValue += value // Count root level values
    }
  }

  // Calculate percentages
  for (const node of flatNodes) {
    node.percentage = totalValue > 0 ? (node.value / totalValue) * 100 : 0
  }

  // Build hierarchical structure
  const nodeMap = new Map<string, TreeMapNode>()
  flatNodes.forEach(node => {
    nodeMap.set(node.name, node) // Use name for matching (parent_node uses label names)
  })

  // Find root node (no parent)
  let rootNode = flatNodes.find(node => !node.parentId)
  
  if (!rootNode) {
    // Create artificial root if none exists
    rootNode = {
      id: 'carbon-root',
      name: 'Empreinte Carbone',
      label: 'Empreinte Carbone',
      emoji: '🌍',
      value: totalValue,
      percentage: 100,
      children: [],
      depth: 0
    }
    flatNodes.push(rootNode)
    nodeMap.set(rootNode.name, rootNode)
  }

  // Build parent-child relationships
  for (const node of flatNodes) {
    if (node.parentId && node !== rootNode) {
      const parent = nodeMap.get(node.parentId)
      if (parent) {
        parent.children = parent.children || []
        parent.children.push(node)
      } else {
        // If parent not found, attach to root
        rootNode.children = rootNode.children || []
        rootNode.children.push(node)
      }
    }
  }

  // Calculate depths
  function calculateDepth(node: TreeMapNode, depth = 0): void {
    node.depth = depth
    if (node.children) {
      for (const child of node.children) {
        calculateDepth(child, depth + 1)
      }
    }
  }
  calculateDepth(rootNode)

  // Ensure all parent nodes have values (sum of children if no direct value)
  function ensureParentValues(node: TreeMapNode): number {
    if (node.children && node.children.length > 0) {
      const childrenSum = node.children.reduce((sum, child) => sum + ensureParentValues(child), 0)
      if (node.value === 0) {
        node.value = childrenSum
      }
      return node.value
    }
    return node.value
  }
  ensureParentValues(rootNode)

  if (flatNodes.length === 0) {
    warnings.push({
      type: 'missing_data',
      message: 'No valid carbon footprint data found in survey responses'
    })
    
    // Return minimal root
    rootNode = {
      id: 'empty-root',
      name: 'Aucune donnée',
      label: 'Aucune donnée',
      emoji: '📊',
      value: 0,
      percentage: 0,
      children: [],
      depth: 0
    }
  }

  const result: DpCarbonTreeMapData = {
    id: 'DpCarbonTreeMap',
    version: '1.0.0',
    treeData: rootNode,
    selectedView: {
      suIds: targetSuIds,
      color: mainColor,
      isQuartier: isQuartierView
    },
    warnings
  }

  cache.set(cacheKey, result)
  return result
}

export function getDpCarbonTreeMapText(selectedSus?: number[]): string {
  return JSON.stringify(getDpCarbonTreeMapData(selectedSus))
}