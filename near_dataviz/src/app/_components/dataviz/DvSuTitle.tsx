'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getDpSuTitleResult } from '~/lib/datapacks/DpSuTitle'
import type { SuTitleResult } from '~/lib/datapacks/DpSuTitle'
import { getSuColors } from '~/lib/datapacks/DpColor'
import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'

type Props = {
  selectedSus?: number[]
}

export default function DvSuTitle({ selectedSus }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const [payload, setPayload] = useState<SuTitleResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Colors (SU-specific like other Dv components)
  const [mainColor, setMainColor] = useState<string>('#002878')
  // Reserved for future accents if needed

  // Responsive dimensions
  const [width, setWidth] = useState<number>()
  const [height, setHeight] = useState<number>()

  const measure = () => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const w = Math.max(260, rect.width)
    const h = Math.max(100, rect.height)
    setWidth(w)
    setHeight(h)
  }

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Load SU-specific colors
  useEffect(() => {
    const loadColors = async () => {
      try {
        let globalSuId: number | undefined = undefined
        if (selectedSus && selectedSus.length === 1 && selectedSus[0] !== undefined) {
          const [gid] = await mapLocalToGlobalIds([selectedSus[0]])
          globalSuId = gid
        }
        const suColors = await getSuColors(globalSuId)
        if (suColors?.colorMain) setMainColor(suColors.colorMain)
  // We currently only use mainColor in this component
      } catch (e) {
        console.warn('[DvSuTitle] getSuColors fallback to defaults', e)
      }
    }
    void loadColors()
  }, [selectedSus])

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await getDpSuTitleResult(selectedSus)
        setPayload(result)
      } catch (err) {
        console.error('Error loading SU title data:', err)
        setError('Erreur lors du chargement des données')
      } finally {
        setLoading(false)
      }
    }
    void loadData()
  }, [selectedSus])

  const layout = useMemo(() => {
    if (!width || !height) return null
    const margin = { top: 12, right: 12, bottom: 12, left: 12 }
  const iconSize = 72
    const contentX = margin.left + iconSize + 12
    const innerWidth = Math.max(120, width - margin.left - margin.right - iconSize - 12)
    const barWidth = Math.min(320, innerWidth - 60)
    return { margin, iconSize, contentX, innerWidth, barWidth }
  }, [width, height])

  // Render SVG
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return
    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()

    if (!payload?.selectedView || !layout || !width || !height) {
      return
    }

    const { selectedView, warnings = [] } = payload
    const isQuartier = selectedView.suId === null

    // SVG size
    svg.attr('width', width).attr('height', height)

  const { margin, iconSize, contentX, innerWidth, barWidth } = layout
    const root = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`)

  // Align the icon bottom with the helper text by deriving bar position from icon size
  const iconGroupY = 0
  const helperBaselineY = iconSize
  const barY = helperBaselineY - 24

  // Left icon area (rounded rect background + ornament/emoji)
  const iconGroup = root.append('g').attr('transform', `translate(0, ${iconGroupY})`)
    iconGroup
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', iconSize)
      .attr('height', iconSize)
      .attr('rx', 10)
      .attr('ry', 10)
      .attr('fill', mainColor)
      .attr('opacity', 0.12)

    // Insert ornament SVG (quartier uses Su Bank id 0 ornament via datapack)
    const defaultQuartierIcon = `
      <g>
        <rect x="8" y="26" width="20" height="28" rx="3" fill="${mainColor}" opacity="0.95" />
        <rect x="32" y="18" width="22" height="36" rx="3" fill="${mainColor}" opacity="0.85" />
        <rect x="56" y="30" width="16" height="24" rx="3" fill="${mainColor}" opacity="0.75" />
      </g>
    `
    const ornamentMarkup = selectedView.ornament && selectedView.ornament.trim().length > 0
      ? selectedView.ornament
      : (isQuartier ? defaultQuartierIcon : '')
    if (ornamentMarkup && ornamentMarkup.trim().length > 0) {
      const holder = iconGroup.append('g').attr('class', 'ornament')
      // Inject raw SVG markup into the group
      holder.html(ornamentMarkup)
      // Fit the ornament into the icon box
      try {
        const node = holder.node()
        if (node) {
          const bb = node.getBBox()
          // Small padding so it doesn't touch edges (reduced to fit larger)
          const pad = 4
          const availW = Math.max(1, iconSize - pad * 2)
          const availH = Math.max(1, iconSize - pad * 2)
          const scale = Math.min(availW / Math.max(1, bb.width), availH / Math.max(1, bb.height))
          const cx = bb.x + bb.width / 2
          const cy = bb.y + bb.height / 2
          const tx = iconSize / 2 - cx * scale
          const ty = iconSize / 2 - cy * scale
          holder.attr('transform', `translate(${tx}, ${ty}) scale(${scale})`)
        }
      } catch {
        // If sizing fails, fallback to centered emoji
        iconGroup
          .append('text')
          .attr('x', iconSize / 2)
          .attr('y', iconSize / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .style('font-size', '26px')
          .text(isQuartier ? '🏘️' : '📍')
      }
    } else {
      iconGroup
        .append('text')
        .attr('x', iconSize / 2)
        .attr('y', iconSize / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
  .style('font-size', '26px')
        .text(isQuartier ? '🏘️' : '📍')
    }

    // Line 1: small subtitle
    const subtitle = isQuartier ? 'Quartier' : `Sphère d'Usages n°${selectedView.suNumber}`
    root
      .append('text')
      .attr('x', contentX)
      .attr('y', 12)
      .style('font-size', '11px')
      .style('fill', '#6b7280')
      .text(subtitle)

    // Line 2: main name
    root
      .append('text')
      .attr('x', contentX)
      .attr('y', 34)
      .style('font-size', '16px')
      .style('font-weight', '600')
      .style('fill', mainColor)
      .text(selectedView.nameFr)

    // Line 3: progress bar + percentage
    root
      .append('rect')
      .attr('x', contentX)
      .attr('y', barY)
      .attr('width', barWidth)
      .attr('height', 10)
      .attr('fill', '#e5e7eb')
      .attr('rx', 5)
      .attr('ry', 5)

    const pct = Math.max(0, Math.min(100, selectedView.popPercentage))
    root
      .append('rect')
      .attr('x', contentX)
      .attr('y', barY)
      .attr('width', (pct / 100) * barWidth)
      .attr('height', 10)
      .attr('fill', mainColor)
      .attr('rx', 5)
      .attr('ry', 5)

    /*
    root
      .append('text')
      .attr('x', contentX + barWidth + 10)
      .attr('y', barY + 9)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'ideographic')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('fill', mainColor)
      .text(`${selectedView.popPercentage.toFixed(1)}%`) */

    // Line 4: helper text
    root
      .append('text')
      .attr('x', contentX)
      .attr('y', barY + 24)
      .style('font-size', '11px')
      .style('fill', '#6b7280')
      .text(`${selectedView.popPercentage.toFixed(1)}% de la population totale`)

    // Warnings pill (right side)
    if ((warnings?.length ?? 0) > 0) {
      const pillGroup = root.append('g')
      const label = `⚠️ ${warnings.length} warning(s)`
      const x = contentX + innerWidth - 4
      const y = 0
      const padX = 8
      const tmp = pillGroup
        .append('text')
        .attr('x', x)
        .attr('y', y)
        .style('font-size', '11px')
        .style('fill', '#92400E')
        .text(label)
        .node()
      let textWidth = 0
      if (tmp) {
        const bb = tmp.getBBox()
        textWidth = bb.width
        d3.select(tmp).remove()
      }
      const pillW = textWidth + padX * 2
      const pillH = 18
      pillGroup
        .append('rect')
        .attr('x', x - pillW)
        .attr('y', y)
        .attr('width', pillW)
        .attr('height', pillH)
        .attr('rx', 9)
        .attr('ry', 9)
        .attr('fill', '#FEF3C7')
        .attr('stroke', '#F59E0B')
        .attr('stroke-width', 1)
      pillGroup
        .append('text')
        .attr('x', x - pillW + padX)
        .attr('y', y + 12)
        .style('font-size', '11px')
        .style('fill', '#92400E')
        .text(label)
    }
  }, [payload, layout, width, height, mainColor])

  // Loading / error / empty states similar to other Dv components
  if (loading) {
    return (
      <div ref={containerRef} className="dv-container" style={{ width: '100%', height: '100%' }}>
        <div style={{ padding: 12, color: '#666' }}>Chargement…</div>
        <svg ref={svgRef} />
      </div>
    )
  }

  if (error) {
    return (
      <div ref={containerRef} className="dv-container" style={{ width: '100%', height: '100%' }}>
        <div style={{ padding: 12, color: '#b00020' }}>{error}</div>
        <svg ref={svgRef} />
      </div>
    )
  }

  if (!payload?.selectedView) {
    return (
      <div ref={containerRef} className="dv-container" style={{ width: '100%', height: '100%' }}>
        <div style={{ padding: 12, color: '#666' }}>Aucune donnée disponible.</div>
        <svg ref={svgRef} />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="dv-container" style={{ width: '100%', height: '100%' }}>
      <svg ref={svgRef} />
    </div>
  )
}