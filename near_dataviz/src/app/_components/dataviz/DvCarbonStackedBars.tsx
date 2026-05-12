"use client"

import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getDpCarbonSankeyDatapack, getDpCarbonGlobalMaxParentValue, type CarbonSankeyPayload } from '~/lib/datapacks'
import { getPalette, getSuColors } from '~/lib/datapacks/DpColor'
import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'

type NodeItem = CarbonSankeyPayload['sankeyData']['nodes'][number]
type ParentGroup = { root: NodeItem; children: NodeItem[] }
type Props = { selectedSus?: number[] }

const FALLBACK_PALETTE = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#76b7b2', '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac']

const LABEL_W = 200
const ROW_H = 36
const LEGEND_H = 42  // flex legend — enough for ~2 wrapped lines
const ROW_STEP = ROW_H + LEGEND_H + 18  // bar + legend + gap
const MARGIN = { top: 40, right: 20, bottom: 20, left: 20 }

const DvCarbonStackedBars: React.FC<Props> = ({ selectedSus }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [payload, setPayload] = useState<CarbonSankeyPayload | null>(null)
  const [palette, setPalette] = useState<string[]>(FALLBACK_PALETTE)
  const [mainColor, setMainColor] = useState('#002878')
  const [globalMaxVal, setGlobalMaxVal] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState<number>()

  const measure = () => {
    if (!containerRef.current) return
    const w = containerRef.current.clientWidth
    if (w > 0) setWidth(w)
  }

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        let globalSuId: number | undefined
        if (selectedSus && selectedSus.length === 1 && selectedSus[0] !== undefined) {
          const globalIds = await mapLocalToGlobalIds([selectedSus[0]])
          globalSuId = globalIds[0]
        }

        const [resp, graphPalette, suColors, globalMax] = await Promise.all([
          getDpCarbonSankeyDatapack({ selectedSus }),
          getPalette('graph', globalSuId),
          getSuColors(globalSuId),
          getDpCarbonGlobalMaxParentValue(),
        ])

        setPayload(resp.data)
        setPalette(graphPalette)
        setMainColor(suColors.colorMain)
        setGlobalMaxVal(globalMax)
      } catch (e) {
        console.error('[DvCarbonStackedBars] load error', e)
        setError('Impossible de charger les données carbone')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [selectedSus])

  useEffect(() => {
    if (!svgRef.current || !payload || !width) return

    const { nodes, links } = payload.sankeyData
    if (!nodes.length) return

    // Reconstruct parent groups: roots = nodes that are never a target
    const targetSet = new Set(links.map(l => l.target))
    const parentGroups: ParentGroup[] = nodes
      .map((node, idx) => {
        if (targetSet.has(idx)) return null
        const children = links
          .filter(l => l.source === idx)
          .map(l => nodes[l.target])
          .filter((n): n is NodeItem => !!n)
        if (!children.length) return null
        return { root: node, children }
      })
      .filter((g): g is ParentGroup => g !== null)
      .sort((a, b) => b.root.value - a.root.value)

    if (!parentGroups.length) return

    // Shared scale: 100% width = highest parent value across ALL SUs (for cross-SU comparison)
    const maxVal = globalMaxVal
    const barW = width - MARGIN.left - MARGIN.right - LABEL_W
    const svgH = MARGIN.top + parentGroups.length * ROW_STEP + MARGIN.bottom

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', svgH)

    // Tooltip
    let tooltipNode = containerRef.current?.querySelector<HTMLDivElement>('.carbon-bars-tooltip')
    if (!tooltipNode && containerRef.current) {
      tooltipNode = document.createElement('div')
      containerRef.current.appendChild(tooltipNode)
    }
    const tooltip = d3.select(tooltipNode!)
      .attr('class', 'carbon-bars-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('padding', '5px 8px')
      .style('font-size', '12px')
      .style('background', 'rgba(0,0,0,0.78)')
      .style('color', '#fff')
      .style('border-radius', '4px')
      .style('opacity', 0)
      .style('white-space', 'nowrap')
      .style('z-index', '10')

    const root = svg.append('g').attr('transform', `translate(${MARGIN.left}, ${MARGIN.top})`)

    // Grand total annotation — same value as DvCarbonSankey title (payload.meta.totalValue in tonnes)
    const totalTons = (payload.meta.totalValue / 1000).toFixed(1)
    root.append('text')
      .attr('x', LABEL_W + barW / 2)
      .attr('y', -18)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', mainColor)
      .text(`☁ Empreinte individuelle moyenne : ${totalTons} t CO₂e / an`)

    // Column header
    root.append('text')
      .attr('x', LABEL_W + barW)
      .attr('y', -18)
      .attr('text-anchor', 'end')
      .style('font-size', '11px')
      .style('fill', '#9ca3af')
      .text('kg CO₂e / an →')

    parentGroups.forEach((group, gi) => {
      const y = gi * ROW_STEP
      const g = root.append('g').attr('transform', `translate(0, ${y})`)

      // Left label: name
      g.append('text')
        .attr('x', LABEL_W - 10)
        .attr('y', ROW_H / 2 - 6)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'central')
        .style('font-size', '12px')
        .style('font-weight', '600')
        .style('fill', '#1f2937')
        .text(`${group.root.emoji} ${group.root.name}`)

      // Left sub-label: value
      g.append('text')
        .attr('x', LABEL_W - 10)
        .attr('y', ROW_H / 2 + 10)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'central')
        .style('font-size', '10px')
        .style('fill', '#6b7280')
        .text(`${group.root.value.toFixed(0)} kg`)

      // Stacked bar background track
      g.append('rect')
        .attr('x', LABEL_W)
        .attr('y', 0)
        .attr('width', barW)
        .attr('height', ROW_H)
        .attr('fill', '#f3f4f6')
        .attr('rx', 4)

      // Stacked segments
      let xCursor = 0
      // Each segment width is proportional to the shared max, not to the parent total
      const barTotalW = (group.root.value / maxVal) * barW

      group.children.forEach((child, ci) => {
        const segW = Math.max(0, (child.value / maxVal) * barW)
        const color = palette[ci % palette.length]!
        const isFirst = ci === 0

        // Build path for rounded corners on first/last segment
        const x = LABEL_W + xCursor
        const rx = 4
        // Use barTotalW to decide which segment gets the rounded right edge
        const isLastDrawn = xCursor + segW >= barTotalW - 1

        let d: string
        if (isFirst && isLastDrawn) {
          d = `M${x + rx},0 h${segW - rx * 2} a${rx},${rx} 0 0 1 ${rx},${rx} v${ROW_H - rx * 2} a${rx},${rx} 0 0 1 -${rx},${rx} h-${segW - rx * 2} a${rx},${rx} 0 0 1 -${rx},-${rx} v-${ROW_H - rx * 2} a${rx},${rx} 0 0 1 ${rx},-${rx} Z`
        } else if (isFirst) {
          d = `M${x + rx},0 h${segW - rx} v${ROW_H} h-${segW - rx} a${rx},${rx} 0 0 1 -${rx},-${rx} v-${ROW_H - rx * 2} a${rx},${rx} 0 0 1 ${rx},-${rx} Z`
        } else if (isLastDrawn) {
          d = `M${x},0 h${segW - rx} a${rx},${rx} 0 0 1 ${rx},${rx} v${ROW_H - rx * 2} a${rx},${rx} 0 0 1 -${rx},${rx} h-${segW - rx} Z`
        } else {
          d = `M${x},0 h${segW} v${ROW_H} h-${segW} Z`
        }

        g.append('path')
          .attr('d', d)
          .attr('fill', color)
          .style('cursor', 'pointer')
          .on('mousemove', function (event: MouseEvent) {
            const rect = containerRef.current?.getBoundingClientRect()
            const px = rect ? event.pageX - (rect.left + window.scrollX) : event.pageX
            const py = rect ? event.pageY - (rect.top + window.scrollY) : event.pageY
            const pct = (child.value / group.root.value * 100).toFixed(1)
            tooltip
              .style('left', `${px + 10}px`)
              .style('top', `${py - 32}px`)
              .style('opacity', 1)
              .text(`${child.emoji} ${child.name} — ${child.value.toFixed(0)} kg CO₂e (${pct}%)`)
          })
          .on('mouseout', () => tooltip.style('opacity', 0))

        // Emoji label inside segment if wide enough
        if (segW >= 28) {
          g.append('text')
            .attr('x', LABEL_W + xCursor + segW / 2)
            .attr('y', ROW_H / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'central')
            .style('font-size', '13px')
            .style('pointer-events', 'none')
            .text(child.emoji)
        }

        xCursor += segW
      })

      // Legend row: flex HTML inside foreignObject so it wraps naturally
      const fo = g.append('foreignObject')
        .attr('x', LABEL_W)
        .attr('y', ROW_H + 5)
        .attr('width', barW)
        .attr('height', LEGEND_H)

      const xmlns = 'http://www.w3.org/1999/xhtml'
      const legendDiv = document.createElementNS(xmlns, 'div') as HTMLDivElement
      legendDiv.style.cssText =
        'display:flex;flex-wrap:wrap;gap:3px 14px;font-size:10px;color:#4b5563;line-height:1.5;'

      group.children.forEach((child, ci) => {
        const color = palette[ci % palette.length]!
        const item = document.createElementNS(xmlns, 'span') as HTMLSpanElement
        item.style.cssText = 'display:inline-flex;align-items:center;gap:4px;white-space:nowrap;'

        const swatch = document.createElementNS(xmlns, 'span') as HTMLSpanElement
        swatch.style.cssText =
          `display:inline-block;width:9px;height:9px;border-radius:2px;background:${color};flex-shrink:0;`
        item.appendChild(swatch)

        const lbl = document.createElementNS(xmlns, 'span') as HTMLSpanElement
        lbl.textContent = `${child.emoji} ${child.name} — ${child.value.toFixed(0)} kg`
        item.appendChild(lbl)

        legendDiv.appendChild(item)
      })

      fo.node()!.appendChild(legendDiv)
    })
  }, [payload, palette, mainColor, globalMaxVal, width])

  if (loading) {
    return (
      <div ref={containerRef} className="dv-container" style={{ width: '100%', position: 'relative' }}>
        <div style={{ padding: 12, color: '#666' }}>Chargement…</div>
        <svg ref={svgRef} />
      </div>
    )
  }
  if (error) {
    return (
      <div ref={containerRef} className="dv-container" style={{ width: '100%', position: 'relative' }}>
        <div style={{ padding: 12, color: '#b00020' }}>{error}</div>
        <svg ref={svgRef} />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="dv-container" style={{ width: '100%', position: 'relative' }}>
      <svg ref={svgRef} />
    </div>
  )
}

export default DvCarbonStackedBars
