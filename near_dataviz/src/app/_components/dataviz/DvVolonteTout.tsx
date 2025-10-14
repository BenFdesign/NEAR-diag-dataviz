"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getDpVolonteToutData, type VolonteToutResult } from '~/lib/datapacks/DpVolonteTout'
import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'
import { getSuColors } from '~/lib/datapacks/DpColor'

interface Props {
  selectedSus?: number[]
}

// D3 event type
// no-op

const DvVolonteTout: React.FC<Props> = ({ selectedSus }) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 })
  const [data, setData] = useState<VolonteToutResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [light1, setLight1] = useState<string>('#99AAFF')

  // Responsive container size
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return
      const { clientWidth, clientHeight } = containerRef.current
      setDimensions({ width: clientWidth, height: clientHeight })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Load data
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        setError(null)
        const result = await getDpVolonteToutData(selectedSus)
        setData(result)
      } catch (e) {
        console.error('[DvVolonteTout] load error', e)
        setError("Impossible de charger les données 'Volonté'")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [selectedSus])

  // Load colors
  useEffect(() => {
    const loadColors = async () => {
      try {
        let globalSuId: number | undefined
        if (selectedSus && selectedSus.length === 1) {
          const globalIds = await mapLocalToGlobalIds([selectedSus[0]!])
          globalSuId = globalIds[0]
        }
        const colors = await getSuColors(globalSuId)
        if (colors?.colorLight1) setLight1(colors.colorLight1)
      } catch {
        /* noop fallback */
      }
    }
    void loadColors()
  }, [selectedSus])

  const allChoices = useMemo(() => {
    if (!data) return [] as { key: string; label: string; color: string }[]
    const map = new Map<string, { key: string; label: string; color: string }>()
    const colorByKey: Record<string,string> = {
      YES_I_DO: '#4CAF50',
      ALREADY_DO_IT: '#4CAF50',
      I_WISH_AND_IT_IS_PLAN: '#b2bb33ff',
      WOULD_LIKE_TO: '#b2bb33ff',
      PLAN_TO: '#b2bb33ff',
      I_WISH_BUT_CANT: '#ff8c18ff',
      WOULD_LIKE_BUT_CANT: '#ff8c18ff',
      NO: '#b31408ff',
      NOT_INTERESTED: '#b31408ff',
      DONT_WANT: '#b31408ff',
      DONT_KNOW: '#9E9E9E',
      NO_OPINION: '#9E9E9E'
    }
    data.data.forEach(q => {
      q.responses.forEach(r => {
        if (r.percentage > 0 && !map.has(r.choiceKey)) {
          const label = r.choiceLabels.labelShort || r.choiceLabels.labelLong
          map.set(r.choiceKey, { key: r.choiceKey, label, color: colorByKey[r.choiceKey] ?? '#BDBDBD' })
        }
      })
    })
    
    return Array.from(map.values())
  }, [data])

  // D3 stacked bars
useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    if (!data) return

    // Dimensions
    const margin = { top: 24, right: 16, bottom: 24, left: 16 }
    const width = Math.max(280, dimensions.width || 800)
    const innerW = Math.max(200, width - margin.left - margin.right)
    const rowH = 30
    const gap = 24
    const totalH = data.data.length * (rowH + gap)
    const headerFontSize = 14
    const headerGap = 10
    const legendGap = 10
    // Initial height
    let height = Math.max(140, margin.top + headerFontSize + headerGap + totalH + legendGap + 32 + margin.bottom)

    svg.attr('width', width).attr('height', height)
    const root = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`)

    // Main title
    const titleText = '📊 Volontés de changement'
    root
        .append('text')
        .attr('x', 0)
        .attr('y', headerFontSize)
        .style('font-size', `${headerFontSize}px`)
        .style('font-weight', '600')
        .style('fill', '#111827')
        .text(titleText)

    root
        .append('text')
        .attr('x', innerW)
        .attr('y', headerFontSize)
        .attr('text-anchor', 'end')
        .style('font-size', '12px')
        .style('fill', '#4B5563')
        .text(`${data.summary.totalQuestions} questions`)

    // Tooltip
    let tooltipNode = containerRef.current?.querySelector<HTMLDivElement>('.dv-tooltip')
    if (!tooltipNode && containerRef.current) {
        tooltipNode = document.createElement('div')
        containerRef.current.appendChild(tooltipNode)
    }
    const tooltipSel = d3
        .select(tooltipNode!)
        .attr('class', 'dv-tooltip')
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('padding', '6px 8px')
        .style('font-size', '12px')
        .style('background', 'rgba(0,0,0,0.75)')
        .style('color', '#fff')
        .style('border-radius', '4px')
        .style('opacity', 0)

    // Bars + Headers
    data.data.forEach((q, i) => {
        const g = root.append('g').attr('transform', `translate(0, ${headerFontSize + headerGap + i * (rowH + gap)})`)
        // Titre question
        const qTitle = q.questionLabels.questionShort || q.questionLabels.title
        g.append('text')
            .attr('x', 0)
            .attr('y', -5 + headerFontSize*2)
            .style('font-size', '12px')
            .style('fill', '#374151')
            .text(`${q.questionLabels.emoji ?? ''} ${qTitle}`)

        // Segments
        const segments = q.responses.filter(r => r.percentage > 0)
        const totalPct = segments.reduce((s, r) => s + r.percentage, 0) || 1
        let x = 0
        const barW = innerW
        segments.forEach((r, idx) => {
            const isLast = idx === segments.length - 1
            const segW = isLast ? (barW - x) : ((r.percentage / totalPct) * barW)
            const fillColor = allChoices.find(c => c.key === r.choiceKey)?.color ?? light1
            g.append('rect')
                .attr('x', x)
                .attr('y', 0 + headerFontSize*2)
                .attr('width', Math.max(0, segW))
                .attr('height', rowH)
                .attr('fill', fillColor)
                .style('cursor', 'pointer')
                .on('mousemove', function (event: MouseEvent) {
                    const rect = containerRef.current?.getBoundingClientRect()
                    const px = rect ? event.pageX - (rect.left + window.scrollX) : event.pageX
                    const py = rect ? event.pageY - (rect.top + window.scrollY) : event.pageY
                    const label = r.choiceLabels.labelShort || r.choiceLabels.labelLong
                    const qTitleTip = q.questionLabels.questionShort || q.questionLabels.title
                    tooltipSel
                        .style('left', `${px + 10}px`)
                        .style('top', `${py + 10}px`)
                        .style('opacity', 1)
                        .text(`${q.questionLabels.emoji ?? '🎯'} ${qTitleTip} — ${label}: ${r.percentage.toFixed(1)}%`)
                })
                .on('mouseout', function () {
                    tooltipSel.style('opacity', 0)
                })
            if (segW >= 30 && r.percentage >= 8) {
                g.append('text')
                    .attr('x', x + segW / 2)
                    .attr('y', rowH / 2)
                    .attr('text-anchor', 'middle')
                    .attr('dominant-baseline', 'middle')
                    .attr('fill', '#fff')
                    .attr('font-size', 10)
                    .attr('font-weight', 700)
                    .text(`${r.percentage.toFixed(1)}%`)
            }
            x += segW
        })
    })

    // Legend
    const legendY = headerFontSize*2 + headerGap + totalH + legendGap
    const legend = root.append('g').attr('transform', `translate(0, ${legendY})`)
    const box = { w: 14, h: 14 }
    const gapX = 12
    let lx = 0
    const ly = 0
    const lineH = 18
    let maxLegendWidth = 0

    // Legend items
    allChoices.forEach((item, idx) => {
        const itemG = legend.append('g')
        itemG
            .append('rect')
            .attr('width', box.w)
            .attr('height', box.h)
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('fill', item.color)
            .attr('stroke', 'rgba(0,0,0,0.4)')

        const text = itemG
            .append('text')
            .attr('x', box.w + 4)
            .attr('y', box.h - 3)
            .style('font-size', '12px')
            .style('fill', '#4B5563')
            .text(item.label)

        // Mesure width item
        const textW = text.node()?.getComputedTextLength?.() ?? 0
        const itemW = box.w + 4 + textW

        if (lx + itemW > innerW) {
            // Trim + "…"
            if (idx < allChoices.length - 1) {
                legend.append('text')
                    .attr('x', lx)
                    .attr('y', box.h - 3)
                    .style('font-size', '14px')
                    .style('fill', '#4B5563')
                    .text('…')
            }
            return
        }

        itemG.attr('transform', `translate(${lx}, ${ly})`)
        lx += itemW + gapX
        maxLegendWidth = Math.max(maxLegendWidth, lx)
    })

    // Legend height + ajustement height SVG
    const legendHeight = lineH
    height = margin.top + headerFontSize + headerGap + totalH + legendGap + legendHeight + margin.bottom
    svg.attr('height', height)
}, [data, dimensions.width, light1, allChoices])

  // Chargement / erreur / pas de données
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
  if (!data || data.data.length === 0) {
    return (
      <div ref={containerRef} className="dv-container" style={{ width: '100%', height: '100%' }}>
        <div style={{ padding: 12, color: '#666' }}>Aucune donnée.</div>
        <svg ref={svgRef} />
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col" style={{ position: 'relative' }}>
      <div className="flex-1 px-2 pb-2">
        <svg ref={svgRef} className="w-full" />
      </div>
    </div>
  )
}

export { DvVolonteTout }
export default DvVolonteTout
