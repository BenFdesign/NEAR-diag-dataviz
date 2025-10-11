import { useMemo, useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'

type TreeMapNode = {
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

type Props = {
  data: string
}

/**
 * DvCarbonTreeMap - Responsive Carbon TreeMap component using D3.js
 * Fits 100% to parent zoneCarboneSankey dimensions with left-aligned title
 */
export default function DvCarbonTreeMap({ data }: Props) {
  const payload = useMemo(() => {
    try {
      return JSON.parse(data)
    } catch {
      return {}
    }
  }, [data])

  const { treeData, selectedView, warnings = [] } = payload
  
  // Track container dimensions for responsive layout
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [dimensions, setDimensions] = useState({ width: 400, height: 270 })

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: rect.width || 400,
          height: rect.height || 270
        })
      }
    }

    const timer = setTimeout(updateDimensions, 0)
    window.addEventListener('resize', updateDimensions)
    
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateDimensions)
    }
  }, [])

  // Use the hierarchical tree data from the new datapack
  const treeMapData = useMemo(() => {
    if (!treeData) {
      return null
    }
    return treeData
  }, [treeData])

  // D3 TreeMap Layout Effect
  useEffect(() => {
    if (!treeMapData || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove() // Clear previous render

    // Minimal margins for maximum TreeMap area usage
    const margin = { 
      top: Math.max(20, dimensions.height * 0.05), 
      right: Math.max(4, dimensions.width * 0.01), 
      bottom: Math.max(15, dimensions.height * 0.04), 
      left: Math.max(4, dimensions.width * 0.01) 
    }
    
    const width = dimensions.width - margin.left - margin.right
    const height = dimensions.height - margin.top - margin.bottom

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    // Create D3 TreeMap layout - maximize space usage
    const treemap = d3.treemap<TreeMapNode>()
      .size([width, height])
      .padding(1) // Minimal padding for better space utilization
      .paddingInner(1)
      .paddingOuter(2)
      .round(true)

    // Create hierarchy from data - ensure leaf nodes have values
    const root = d3.hierarchy(treeMapData, d => d.children)
      .sum(d => {
        // Only sum leaf nodes (nodes without children) to avoid double counting
        return d.children && d.children.length > 0 ? 0 : d.value
      })
      .sort((a, b) => (b.value || 0) - (a.value || 0))

    // Generate TreeMap layout
    const treeMapRoot = treemap(root)

    // Color scale for different levels
    const colorScale = d3.scaleOrdinal<number, string>()
      .domain([0, 1, 2, 3])
      .range([
        selectedView.color || "#6c757d",
        d3.color(selectedView.color || "#6c757d")?.brighter(0.3)?.toString() || "#8a92a6",
        d3.color(selectedView.color || "#6c757d")?.brighter(0.6)?.toString() || "#a8b0c3",
        d3.color(selectedView.color || "#6c757d")?.brighter(0.9)?.toString() || "#c6cde0"
      ])

    // Create TreeMap rectangles for all nodes (including internal nodes)
    const cell = g.selectAll(".cell")
      .data(treeMapRoot.descendants())
      .enter().append("g")
      .attr("class", "cell")
      .attr("transform", d => `translate(${d.x0},${d.y0})`)

    // Rectangle backgrounds - different styles for leaves vs internal nodes
    cell.append("rect")
      .attr("width", d => Math.max(0, d.x1 - d.x0))
      .attr("height", d => Math.max(0, d.y1 - d.y0))
      .style("fill", d => {
        if (d.children) {
          // Parent nodes: lighter fill
          return d3.color(colorScale(d.data.depth))?.brighter(0.5)?.toString() || "#f0f0f0"
        } else {
          // Leaf nodes: full color
          return colorScale(d.data.depth)
        }
      })
      .style("fill-opacity", d => d.children ? 0.3 : 0.8)
      .style("stroke", "#ffffff")
      .style("stroke-width", d => d.children ? 2 : 1)
      .style("rx", 1)

    // Add text only to leaf nodes to avoid clutter
    const leafCells = cell.filter(d => !d.children)

    // Add emoji (if rectangle is large enough)
    leafCells.append("text")
      .attr("x", (d: d3.HierarchyRectangularNode<TreeMapNode>) => (d.x1 - d.x0) / 2)
      .attr("y", (d: d3.HierarchyRectangularNode<TreeMapNode>) => Math.min(20, (d.y1 - d.y0) / 3))
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", (d: d3.HierarchyRectangularNode<TreeMapNode>) => {
        const rectWidth = d.x1 - d.x0
        const rectHeight = d.y1 - d.y0
        const minDim = Math.min(rectWidth, rectHeight)
        return Math.max(8, Math.min(16, minDim / 4)) + "px"
      })
      .style("opacity", (d: d3.HierarchyRectangularNode<TreeMapNode>) => (d.x1 - d.x0) > 30 && (d.y1 - d.y0) > 30 ? 1 : 0)
      .text((d: d3.HierarchyRectangularNode<TreeMapNode>) => d.data.emoji)

    // Add labels (if rectangle is large enough)
    leafCells.append("text")
      .attr("x", (d: d3.HierarchyRectangularNode<TreeMapNode>) => (d.x1 - d.x0) / 2)
      .attr("y", (d: d3.HierarchyRectangularNode<TreeMapNode>) => Math.min(35, (d.y1 - d.y0) / 2))
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", (d: d3.HierarchyRectangularNode<TreeMapNode>) => {
        const rectWidth = d.x1 - d.x0
        const rectHeight = d.y1 - d.y0
        const minDim = Math.min(rectWidth, rectHeight)
        return Math.max(6, Math.min(10, minDim / 8)) + "px"
      })
      .style("font-weight", "600")
      .style("fill", "#ffffff")
      .style("text-shadow", "0 1px 2px rgba(0,0,0,0.6)")
      .style("opacity", (d: d3.HierarchyRectangularNode<TreeMapNode>) => (d.x1 - d.x0) > 50 && (d.y1 - d.y0) > 40 ? 1 : 0)
      .text((d: d3.HierarchyRectangularNode<TreeMapNode>) => {
        const rectWidth = d.x1 - d.x0
        const maxLen = Math.floor(rectWidth / 6)
        return d.data.label.length > maxLen ? 
          d.data.label.substring(0, maxLen - 2) + '..' : 
          d.data.label
      })

    // Add values (if rectangle is large enough)
    leafCells.append("text")
      .attr("x", (d: d3.HierarchyRectangularNode<TreeMapNode>) => (d.x1 - d.x0) / 2)
      .attr("y", (d: d3.HierarchyRectangularNode<TreeMapNode>) => Math.min(50, (d.y1 - d.y0) - 8))
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", (d: d3.HierarchyRectangularNode<TreeMapNode>) => {
        const rectWidth = d.x1 - d.x0
        const rectHeight = d.y1 - d.y0
        const minDim = Math.min(rectWidth, rectHeight)
        return Math.max(6, Math.min(9, minDim / 10)) + "px"
      })
      .style("fill", "#ffffff")
      .style("text-shadow", "0 1px 2px rgba(0,0,0,0.6)")
      .style("opacity", (d: d3.HierarchyRectangularNode<TreeMapNode>) => (d.x1 - d.x0) > 60 && (d.y1 - d.y0) > 50 ? 0.9 : 0)
      .text((d: d3.HierarchyRectangularNode<TreeMapNode>) => `${(d.data.value / 1000).toFixed(1)}t`)

    // Add tooltips on hover to all cells
    cell.append("title")
      .text((d: d3.HierarchyRectangularNode<TreeMapNode>) => `${d.data.label}\n${(d.data.value / 1000).toFixed(1)}t CO₂eq\n${d.data.percentage.toFixed(1)}%`)

  }, [treeMapData, dimensions, selectedView])

  // Early return for no data
  if (!treeData || treeData.value === 0) {
    return (
      <div ref={containerRef} style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: '#6c757d',
        fontSize: '0.9em'
      }}>
        Aucune donnée d'empreinte carbone disponible
      </div>
    )
  }

  const titleText = selectedView.isQuartier ? 
    'Empreinte Carbone - Vue Quartier' : 
    `Empreinte Carbone - SU ${selectedView.suIds?.join(', ')}`

  return (
    <div 
      ref={containerRef} 
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        boxSizing: 'border-box',
        overflow: 'hidden',
        padding: '4px'
      }}
    >
      {/* Left-aligned title */}
      <div style={{
        fontSize: Math.max(10, dimensions.width / 35) + 'px',
        fontWeight: '700',
        color: selectedView.color || '#6c757d',
        marginBottom: '4px',
        textAlign: 'left',
        height: 'max-content'
      }}>
        {titleText}
      </div>

      {/* D3 TreeMap SVG */}
      <div style={{ flex: 1, width: '100%', height: '100%' }}>
        <svg 
          ref={svgRef}
          width="100%" 
          height="100%" 
          viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          style={{ overflow: 'hidden' }}
        />
      </div>

      {/* Compact legend */}
      <div style={{
        display: 'flex',
        justifyContent: 'left',
        gap: '0.8em',
        fontSize: '0.55em',
        color: '#6c757d',
        marginTop: '0.1em',
        height: '12px',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2em' }}>
          <div style={{
            width: '8px',
            height: '6px',
            backgroundColor: selectedView.color || '#6c757d',
            opacity: 0.8
          }} />
          <span>tonnes CO₂eq/an</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2em' }}>
          <div style={{
            width: '6px',
            height: '6px',
            backgroundColor: selectedView.color || '#6c757d',
            opacity: 0.5
          }} />
          <span>surface ∝ émissions</span>
        </div>
      </div>

      {/* Warning indicator */}
      {warnings.length > 0 && (
        <div style={{
          marginTop: '0.1em',
          padding: '0.1em',
          backgroundColor: '#fff3cd',
          borderRadius: '2px',
          fontSize: '0.5em',
          color: '#856404',
          textAlign: 'center'
        }}>
          ⚠ {warnings.length} avertissement{warnings.length > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}