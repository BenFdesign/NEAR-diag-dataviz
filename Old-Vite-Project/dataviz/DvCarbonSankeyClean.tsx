import { useMemo, useState, useEffect, useRef } from 'react'
import { sankey, sankeyLinkHorizontal } from 'd3-sankey'
import type { SankeyNode, SankeyLink, SankeyGraph } from 'd3-sankey'

// Clean D3 Sankey data types
type D3SankeyData = {
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

type CarbonSankeyPayload = {
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

type Props = {
  data: string | CarbonSankeyPayload
}

type NodeData = { id: string; name: string; emoji: string; value: number }
type LinkData = object
type D3Node = SankeyNode<NodeData, LinkData>
type D3Link = SankeyLink<NodeData, LinkData>

export default function DvCarbonSankeyClean({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const payload = useMemo(() => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data) as CarbonSankeyPayload
      } catch {
        return null
      }
    }
    return data
  }, [data])

  // Mesure des dimensions SVG
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect()
        setDimensions({
          width: rect.width,
          height: rect.height
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Calculate layout spacing constants
  const width = dimensions.width || 800
  const height = dimensions.height || 400
  const labelSpace = 150 // Space for labels on each side
  const topSpace = 60    // Space for parent labels above
  const bottomSpace = 60 // Space for child labels below
  const sideMargin = 20  // Basic margin
  const chartWidth = width - (labelSpace * 2) - (sideMargin * 2)
  const chartHeight = height - topSpace - bottomSpace
  const chartMidpoint = sideMargin + labelSpace + chartWidth / 2

  // Generate D3 Sankey layout
  const d3SankeyGraph = useMemo(() => {
    if (!payload || !payload.sankeyData || payload.sankeyData.nodes.length === 0) {
      return null
    }

    const { sankeyData } = payload
    
    try {
      // Create D3 sankey generator with improved spacing for better category separation
      const sankeyGenerator = sankey<NodeData, LinkData>()
        .nodeWidth(12)           // Slightly wider nodes for better visibility
        .nodePadding(20)         // More padding between nodes for better separation
        .nodeSort(() => 0)       // Preserve original node order from data (no sorting)
        .extent([
          [sideMargin + labelSpace, topSpace], 
          [sideMargin + labelSpace + chartWidth, topSpace + chartHeight]
        ])

      // Filter out nodes with values < 0.1 tons (100kg)
      const minValueThreshold = 100 // 100kg = 0.1 tons
      const filteredNodes = sankeyData.nodes.filter(node => node.value >= minValueThreshold)
      
      // Create mapping from original indices to filtered indices
      const originalToFilteredIndex = new Map<number, number>()
      filteredNodes.forEach((node, newIndex) => {
        const originalIndex = sankeyData.nodes.findIndex(n => n.id === node.id)
        originalToFilteredIndex.set(originalIndex, newIndex)
      })
      
      // Filter links to only include those connecting filtered nodes
      const filteredLinks = sankeyData.links.filter(link => {
        const sourceFiltered = originalToFilteredIndex.has(link.source)
        const targetFiltered = originalToFilteredIndex.has(link.target)
        return sourceFiltered && targetFiltered
      }).map(link => ({
        ...link,
        source: originalToFilteredIndex.get(link.source)!,
        target: originalToFilteredIndex.get(link.target)!
      }))

      // Prepare graph data (D3 will mutate this)
      const graph: SankeyGraph<NodeData, LinkData> = {
        nodes: filteredNodes.map(node => ({ ...node })),
        links: filteredLinks as SankeyLink<NodeData, LinkData>[]
      }
      
      console.log('D3 Sankey setup:', {
        chartDimensions: `${chartWidth}x${chartHeight}`,
        originalNodes: sankeyData.nodes.length,
        filteredNodes: graph.nodes.length,
        filteredOut: sankeyData.nodes.length - graph.nodes.length
      })

      const result = sankeyGenerator(graph)
      
      // Post-process: ensure parent nodes are vertically centered as a group
      if (result && result.nodes) {
        const parentNodes = result.nodes.filter((_, i) => 
          graph.links.some(link => link.source === i))
        
        // Calculate total height of parent group
        if (parentNodes.length > 0) {
          const parentTotalHeight = parentNodes.reduce((sum, node) => 
            sum + ((node.y1 || 0) - (node.y0 || 0)), 0)
          const parentTotalSpacing = (parentNodes.length - 1) * 35 // nodePadding
          const parentGroupHeight = parentTotalHeight + parentTotalSpacing
          
          // Center parent group vertically
          const availableHeight = chartHeight
          const parentStartY = topSpace + (availableHeight - parentGroupHeight) / 2
          
          let currentY = parentStartY
          parentNodes.forEach(node => {
            const nodeHeight = (node.y1 || 0) - (node.y0 || 0)
            node.y0 = currentY
            node.y1 = currentY + nodeHeight
            currentY += nodeHeight + 35 // nodePadding
          })
        }
      }



      return result
    } catch (error) {
      console.error('D3 Sankey generation error:', error)
      return null
    }
  }, [payload, sideMargin, labelSpace, topSpace, chartWidth, chartHeight])

  // Utility functions
  const formatValue = (value: number) => {
    return (value / 1000).toFixed(1) + 't'
  }

  const truncateText = (text: string, maxWidth: number, fontSize: number) => {
    const avgCharWidth = fontSize * 0.6
    const maxChars = Math.floor(maxWidth / avgCharWidth)
    return text.length > maxChars ? text.slice(0, maxChars - 3) + '.' : text
  }

  // Handle no data cases
  if (!payload) {
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <h2 className="H2-Dv">Empreinte Carbone</h2>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="p2-labels" style={{ color: '#6c757d' }}>
            Erreur de chargement des données
          </div>
        </div>
      </div>
    )
  }

  const { sankeyData, selectedView, warnings, meta } = payload

  if (sankeyData.nodes.length === 0 || !d3SankeyGraph) {
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <h2 className="H2-Dv" style={{ color: selectedView.color }}>
          Empreinte Carbone
        </h2>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="p2-labels" style={{ color: '#6c757d' }}>
            Aucune donnée d'empreinte carbone disponible
          </div>
        </div>
        {warnings.length > 0 && (
          <div className="p3-dv" style={{ color: '#856404', marginTop: 4 }}>
            ⚠️ {warnings[0].message}
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Titre */}
      <h2 className="H2-Dv" style={{ color: selectedView.color, marginTop: '2%', marginLeft:'2%', marginBottom: '-2%', marginRight:'-5%' }}>
        Empreinte Carbone ({formatValue(meta.totalValue)} CO₂eq/an)
      </h2>

      {/* Zone graphique */}
      
      <div style={{ flex: 1 }}>
        <svg ref={svgRef} width="100%" height="100%">
          {/* Liens/Flows */}
          {d3SankeyGraph.links.map((link: D3Link, index: number) => {
            const linkPath = sankeyLinkHorizontal()(link)
            return (
              <path
                key={`link-${index}`}
                d={linkPath || ''}
                fill="none"
                stroke={selectedView.color}
                strokeOpacity={0.4}
                strokeWidth={Math.max(1, link.width || 0)}
              />
            )
          })}

          {/* Nœuds */}
          {d3SankeyGraph.nodes.map((node: D3Node, index: number) => {
            if (!node.x0 || !node.x1 || !node.y0 || !node.y1) return null

            const nodeWidth = node.x1 - node.x0
            const nodeHeight = node.y1 - node.y0
            const labelMargin = 10// Marge entre le node et le label

            // Déterminer si c'est un parent ou un enfant basé sur la position
            const chartMidpoint = sideMargin + labelSpace + chartWidth / 2
            const isParent = node.x0 < chartMidpoint

            return (
              <g key={`node-${index}`}>
                {/* Rectangle du nœud */}
                <rect
                  x={node.x0}
                  y={node.y0}
                  width={nodeWidth}
                  height={nodeHeight}
                  fill={selectedView.color}
                  fillOpacity={0.8}
                  rx={2}
                />

                {isParent ? (
                  /* Labels parent (à gauche) - à gauche du nœud */
                  <g>
                    {/*
                    {/* Emoji à gauche }
                    <text
                      x={node.x0 - 15}
                      y={(node.y0 + node.y1) / 2 - 20}
                      fontSize={14}
                      textAnchor="end"
                      className="p2-dv-sankey"
                      dominantBaseline="end"
                    >
                      {node.emoji}
                    </text>
                    */}
                    
                    {/* Label + Emoji à gauche */}
                    <text
                      x={node.x0 - labelMargin}
                      y={(node.y0 + node.y1) / 2 }
                      className="p2-labels-sankey"
                      fill={selectedView.color}
                      fontWeight="600"
                      textAnchor="end"
                    >
                      {`${truncateText(node.name, labelSpace - labelMargin, 12)}${node.emoji}`}
                    </text>
                    
                    {/* Valeur à gauche */}
                    <text
                      x={node.x0 - labelMargin}
                      y={(node.y0 + node.y1) / 2 + 15}
                      className="p2-labels-sankey"
                      fill={selectedView.color}
                      opacity={0.8}
                      textAnchor="end"
                    >
                      {formatValue(node.value)}
                    </text>
                  </g>
                ) : (
                  /* Labels enfant (à droite) - à droite du nœud */
                  <g>
                    {/*}
                    {// Emoji à droite}
                    <text
                      x={node.x1 + 15}
                      y={(node.y0 + node.y1) / 2 - 20}
                      className="p2-labels-sankey"
                      fontSize={12}
                      textAnchor="start"
                      dominantBaseline="middle"
                    >
                      {node.emoji}
                    </text>
                    */}
                    
                    {/* Emoji + Label à droite */}
                    <text
                      x={node.x1 + labelMargin}
                      y={(node.y0 + node.y1) / 2}
                      className="p2-labels-sankey"
                      fill={selectedView.color}
                      fontWeight="600"
                      textAnchor="start"
                    >
                        {`${node.emoji} ${truncateText(node.name, labelSpace - labelMargin, 11)}`}
                    </text>
                    
                    {/* Valeur à droite */}
                    <text
                      x={node.x1 + labelMargin}
                      y={(node.y0 + node.y1) / 2 + 15}
                      className="p2-labels-sankey"
                      fill={selectedView.color}
                      opacity={0.8}
                      textAnchor="start"
                    >
                      {formatValue(node.value)}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Avertissements */}
      {warnings.length > 0 && (
        <div className="p3-dv" style={{ color: '#856404', marginTop: 4 }}>
          ⚠️ {warnings.length} avertissement(s)
        </div>
      )}
    </div>
  )
}