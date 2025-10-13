'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { sankey, sankeyLinkHorizontal, type SankeyGraph, type SankeyLink, type SankeyNode } from 'd3-sankey'
import { getDpCarbonSankeyData, type CarbonSankeyPayload } from '~/lib/datapacks'
import { getSuColors } from '~/lib/datapacks/DpColor'
import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'

type NodeData = { id: string; name: string; emoji: string; value: number }
type LinkData = { value: number; [k: string]: unknown }
type D3Node = SankeyNode<NodeData, LinkData>
type D3Link = SankeyLink<NodeData, LinkData>

interface Props {
  selectedSus?: number[]
}

const DvCarbonSankey: React.FC<Props> = ({ selectedSus }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [payload, setPayload] = useState<CarbonSankeyPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Colors - similar approach to DvGenre with sensible defaults
  const [mainColor, setMainColor] = useState('#002878')
  const [lightColor1, setLightColor1] = useState('#E6EAFF')
  const [lightColor3, setLightColor3] = useState('#99AAFF')
  const [darkColor1] = useState('#001A4D')

  // Dimensions (responsive like DvGenre)
  const [width, setWidth] = useState<number>()
  const [height, setHeight] = useState<number>()

  const measure = () => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const padding = 0
    const w = Math.max(200, rect.width - padding)
    const h = Math.max(220, rect.height - padding)
    setWidth(w)
    setHeight(h)
  }

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Load SU-specific colors (like DvGenre): colorMain for nodes and colorLight3 for links
  useEffect(() => {
    const loadSuColors = async () => {
      try {
        let globalSuId: number | undefined = undefined
        if (selectedSus && selectedSus.length === 1 && selectedSus[0] !== undefined) {
          const globalIds = await mapLocalToGlobalIds([selectedSus[0]])
          globalSuId = globalIds[0]
        }
        const suColors = await getSuColors(globalSuId)
        if (suColors?.colorMain) setMainColor(suColors.colorMain)
        if (suColors?.colorLight3) setLightColor3(suColors.colorLight3)
        if (suColors?.colorLight1) setLightColor1(suColors.colorLight1)
      } catch (e) {
        console.warn('[DvCarbonSankey] getSuColors fallback to defaults', e)
      }
    }
    void loadSuColors()
  }, [selectedSus])

  useEffect(() => {
    // Load data from datapack
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await getDpCarbonSankeyData(selectedSus)
        setPayload(data)
      } catch (e) {
        console.error('[DvCarbonSankey] load error:', e)
        setError('Impossible de charger les données du Sankey carbone')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [selectedSus])

  // Build classic horizontal Sankey graph (Left -> Right)
  const graph = useMemo(() => {
  if (!payload?.sankeyData || payload.sankeyData.nodes.length === 0) return null
    const w = width ?? 300
    const h = height ?? 260

    // Layout areas
    const sideMargin = 16
    const topSpace = 30
    const bottomSpace = 40
    const labelSpaceLeft = 140
    const labelSpaceRight = 160
    const chartWidth = Math.max(100, w - (sideMargin * 2 + labelSpaceLeft + labelSpaceRight))
    const chartHeight = Math.max(80, h - topSpace - bottomSpace)

    // Filter tiny nodes (optional)
    const minThreshold = 0
    const filteredNodes = payload.sankeyData.nodes.filter(n => n.value > minThreshold)
    const idxMap = new Map<number, number>()
    filteredNodes.forEach((n, i) => {
      const originalIndex = payload.sankeyData.nodes.findIndex(nn => nn.id === n.id)
      if (originalIndex >= 0) idxMap.set(originalIndex, i)
    })
    const filteredLinks = payload.sankeyData.links
      .filter(l => typeof l.source === 'number' && typeof l.target === 'number' && idxMap.has(l.source) && idxMap.has(l.target))
      .map(l => ({
        ...l,
        source: idxMap.get(l.source) ?? 0,
        target: idxMap.get(l.target) ?? 0
      }))

    const g: SankeyGraph<NodeData, LinkData> = {
      nodes: filteredNodes.map(n => ({ ...n })),
      links: filteredLinks as unknown as D3Link[]
    }

    // Standard horizontal extent (origin at 0,0 inside the root group)
    const s = sankey<NodeData, LinkData>()
      .nodeWidth(14)
      .nodePadding(18)
      .nodeSort(() => 0)
      .extent([[0, 0], [chartWidth, chartHeight]])

    try {
      const laidOut = s(g)
      return {
        graph: laidOut,
        dims: { sideMargin, topSpace, bottomSpace, chartWidth, chartHeight, labelSpaceLeft, labelSpaceRight, w, h }
      }
    } catch (e) {
      console.error('[DvCarbonSankey] sankey layout error:', e)
      return null
    }
  }, [payload, width, height])

  // Render
  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    if (!graph?.graph || !payload) {
      return
    }

  const { graph: g, dims } = graph
  const { sideMargin, topSpace, labelSpaceLeft, w, h } = dims

    // SVG size
    svg.attr('width', w).attr('height', h)

    // Root group
    const root = svg.append('g').attr('transform', `translate(${sideMargin + labelSpaceLeft}, ${topSpace})`)

    // Tooltip container
    d3.select(containerRef.current).selectAll('.dv-tooltip').remove()
    const tooltip = d3
      .select(containerRef.current)
      .append('div')
      .attr('class', 'dv-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('padding', '6px 8px')
      .style('font-size', '12px')
      .style('background', 'rgba(0,0,0,0.75)')
      .style('color', '#fff')
      .style('border-radius', '4px')
      .style('opacity', 0)

  // Helpers: standard horizontal sankey dimensions (safe fallbacks)
  const nx0 = (n: D3Node) => (n.x0 ?? 0)
  const nx1 = (n: D3Node) => (n.x1 ?? 0)
  const ny0 = (n: D3Node) => (n.y0 ?? 0)
  const ny1 = (n: D3Node) => (n.y1 ?? 0)
  const nodeX = (n: D3Node) => nx0(n)
  const nodeY = (n: D3Node) => ny0(n)
  const nodeW = (n: D3Node) => Math.max(1, nx1(n) - nx0(n))
  const nodeH = (n: D3Node) => Math.max(1, ny1(n) - ny0(n))

    // Link path generator (horizontal)
    const linkPath = sankeyLinkHorizontal<NodeData, LinkData>()

  // Color scales (SU-specific): nodes = colorMain, links = colorLight3
    const nodeFillColor = d3.color(mainColor) ?? d3.color('#2b6cb0')!
    const linkColor = d3.color(lightColor1) ?? d3.color(mainColor)!

  // Determine leftmost (sources) and rightmost (sinks)
  const nodes = g.nodes as D3Node[]
  const leftNodes = nodes.filter(n => (n.targetLinks?.length ?? 0) === 0)
  const rightNodes = nodes.filter(n => (n.sourceLinks?.length ?? 0) === 0)

    // Links
    root
      .append('g')
      .attr('fill', 'none')
      .attr('stroke-opacity', 0.35)
      .selectAll('path')
      .data(g.links)
      .enter()
  .append('path')
  .attr('d', (d: D3Link) => linkPath(d)!)
      .attr('stroke', linkColor.formatHex())
  .attr('stroke-width', (d: D3Link & { width?: number }) => Math.max(1, (d.width ?? 1)))
      .attr('opacity', 0.6)
      .style('cursor', 'pointer')
      .on('mousemove', function (event: MouseEvent, d: D3Link) {
        d3.select(this).attr('opacity', 0.9)
        // Compute tooltip position relative to the container to avoid misplacement
        const rect = containerRef.current?.getBoundingClientRect()
        const px = rect ? event.pageX - (rect.left + window.scrollX) : event.pageX
        const py = rect ? event.pageY - (rect.top + window.scrollY) : event.pageY
        const s = d.source as D3Node
        const t = d.target as D3Node
        tooltip
          .style('left', `${px + 12}px`)
          .style('top', `${py + 12}px`)
          .style('opacity', 1)
          .text(`${s.emoji ?? ''} ${s.name ?? s.id} → ${t.emoji ?? ''} ${t.name ?? t.id} : ${((d.value ?? 0) / 1000).toFixed(2)} t CO2e`)
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 0.6)
        tooltip.style('opacity', 0)
      })

    // Nodes (parents)
    const nodeGroup = root.append('g').attr('class', 'nodes')
    nodeGroup
      .selectAll('rect.node')
      .data(nodes)
      .enter()
      .append('rect')
      .attr('class', 'node')
      .attr('x', (d) => nodeX(d))
      .attr('y', (d) => nodeY(d))
      .attr('width', (d) => nodeW(d))
      .attr('height', (d) => nodeH(d))
  .attr('fill', () => nodeFillColor.formatHex())
      .attr('stroke', darkColor1)
      .attr('stroke-width', 0.4)
      .attr('rx', 3)
      .attr('ry', 3)
      .style('cursor', 'pointer')
      .on('mousemove', function (event: MouseEvent, d: D3Node) {
        // Compute tooltip position relative to the container to avoid misplacement
        const rect = containerRef.current?.getBoundingClientRect()
        const px = rect ? event.pageX - (rect.left + window.scrollX) : event.pageX
        const py = rect ? event.pageY - (rect.top + window.scrollY) : event.pageY
        tooltip
          .style('left', `${px + 12}px`)
          .style('top', `${py + 12}px`)
          .style('opacity', 1)
          .text(`${d.emoji ?? ''} ${d.name ?? d.id} : ${((d.value ?? 0) / 1000).toFixed(2)} t CO2e`)
      })
      .on('mouseout', function () {
        tooltip.style('opacity', 0)
      })

    // Labels for left sources (aligned left of nodes)
    nodeGroup
      .selectAll('text.left-label')
      .data(leftNodes)
      .enter()
      .append('text')
      .attr('class', 'left-label')
      .attr('x', (d) => nodeX(d) - 8)
      .attr('y', (d) => nodeY(d) + nodeH(d) / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '12px')
      .style('fill', mainColor)
      .style('cursor', 'pointer')
      .on('mousemove', function (event: MouseEvent, d: D3Node) {
        const rect = containerRef.current?.getBoundingClientRect()
        const px = rect ? event.pageX - (rect.left + window.scrollX) : event.pageX
        const py = rect ? event.pageY - (rect.top + window.scrollY) : event.pageY
        tooltip
          .style('left', `${px + 12}px`)
          .style('top', `${py + 12}px`)
          .style('opacity', 1)
          .text(`${d.emoji ?? ''} ${d.name ?? d.id} : ${((d.value ?? 0) / 1000).toFixed(2)} t CO2e`)
      })
      .on('mouseout', function () {
        tooltip.style('opacity', 0)
      })
      .text((d: D3Node) => `${d.emoji ?? ''} ${d.name ?? d.id}`)

    // Labels for right sinks (aligned right of nodes)
    nodeGroup
      .selectAll('text.right-label')
      .data(rightNodes)
      .enter()
      .append('text')
      .attr('class', 'right-label')
      .attr('x', (d) => nodeX(d) + nodeW(d) + 8)
      .attr('y', (d) => nodeY(d) + nodeH(d) / 2)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'middle')
      .style('font-size', '12px')
      .style('fill', mainColor)
      .style('cursor', 'pointer')
      .on('mousemove', function (event: MouseEvent, d: D3Node) {
        const rect = containerRef.current?.getBoundingClientRect()
        const px = rect ? event.pageX - (rect.left + window.scrollX) : event.pageX
        const py = rect ? event.pageY - (rect.top + window.scrollY) : event.pageY
        tooltip
          .style('left', `${px + 12}px`)
          .style('top', `${py + 12}px`)
          .style('opacity', 1)
          .text(`${d.emoji ?? ''} ${d.name ?? d.id} : ${((d.value ?? 0) / 1000).toFixed(2)} t CO2e`)
      })
      .on('mouseout', function () {
        tooltip.style('opacity', 0)
      })
      .text((d: D3Node) => `${d.emoji ?? ''} ${d.name ?? d.id}`)

    // Title/header
    const totalTons = (payload.meta.totalValue / 1000).toFixed(1)
    svg
      .append('text')
      .attr('x', 12)
      .attr('y', 16)
      .style('font-size', '14px')
      .style('font-weight', '600')
      .style('fill', mainColor)
      .text(`☁ Empreinte individuelle moyenne : ${totalTons} t CO2e / an`)},

[graph, payload, mainColor, lightColor1, lightColor3, darkColor1])

  // Loading / error / empty (similar to DvGenre UX)
  if (loading) {
    return (
      <div ref={containerRef} className="dv-container" style={{ width: '100%', height: '100%' }}>
        <div style={{ padding: 12, color: '#666' }}>Chargement du Sankey…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div ref={containerRef} className="dv-container" style={{ width: '100%', height: '100%' }}>
        <div style={{ padding: 12, color: '#b00020' }}>{error}</div>
      </div>
    )
  }

  if (!payload || payload.sankeyData.nodes.length === 0) {
    return (
      <div ref={containerRef} className="dv-container" style={{ width: '100%', height: '100%' }}>
        <div style={{ padding: 12, color: '#666' }}>Aucune donnée carbone disponible.</div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="dv-container" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <svg ref={svgRef} />
    </div>
  )
}

export default DvCarbonSankey
