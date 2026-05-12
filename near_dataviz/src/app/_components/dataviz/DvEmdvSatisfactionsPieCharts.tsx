"use client"

import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getDpEmdvSatisfactionsByCategoryDatapack, type EmdvQuestionResult, type EmdvSubcategoryResult } from '~/lib/datapacks/DpEmdvSatisfactionsByCategory'

type Props = { selectedSus?: number[] }

const CARD_SIZE = 150
const MARGIN = 10

type SliceDatum = { key: string; color: string; pct: number }

// Count visible grapheme clusters to size the emoji correctly in the donut hole
const getEmojiCount = (str: string): number => {
  try {
    return [...new Intl.Segmenter().segment(str)].length
  } catch {
    return [...str.replace(/[\uFE0F\u200D]/g, '')].length
  }
}

const EmdvPieCard: React.FC<{ question: EmdvQuestionResult }> = ({ question }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const el = svgRef.current
    const container = containerRef.current
    if (!el || !container) return

    const radius = CARD_SIZE / 2 - MARGIN
    const innerRadius = radius * 0.38

    const svg = d3.select(el)
    svg.selectAll('*').remove()
    svg.attr('width', CARD_SIZE).attr('height', CARD_SIZE)

    const g = svg.append('g')
      .attr('transform', `translate(${CARD_SIZE / 2}, ${CARD_SIZE / 2})`)

    const sliceDefs: SliceDatum[] = [
      { key: 'NO',         color: '#ffcdd2', pct: question.responses.find(r => r.choiceKey === 'NO')?.percentage ?? 0 },
      { key: 'DONT_KNOW',  color: '#e0e0e0', pct: question.responses.find(r => r.choiceKey === 'DONT_KNOW')?.percentage ?? 0 },
      { key: 'YES',        color: '#c8e6c9', pct: question.responses.find(r => r.choiceKey === 'YES')?.percentage ?? 0 },
    ]

    const pie = d3.pie<SliceDatum>()
      .value(d => d.pct)
      .sort(null)

    const arc = d3.arc<d3.PieArcDatum<SliceDatum>>()
      .innerRadius(innerRadius)
      .outerRadius(radius)

    const arcs = pie(sliceDefs)

    // Tooltip
    let tooltipNode = container.querySelector<HTMLDivElement>('.pie-tooltip')
    if (!tooltipNode) {
      tooltipNode = document.createElement('div')
      container.appendChild(tooltipNode)
    }
    const tooltip = d3.select(tooltipNode)
      .attr('class', 'pie-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('padding', '5px 7px')
      .style('font-size', '11px')
      .style('background', 'rgba(0,0,0,0.75)')
      .style('color', '#fff')
      .style('border-radius', '4px')
      .style('opacity', 0)
      .style('white-space', 'nowrap')
      .style('z-index', '10')

    // Slices
    g.selectAll<SVGPathElement, d3.PieArcDatum<SliceDatum>>('.slice')
      .data(arcs)
      .enter()
      .append('path')
      .attr('class', 'slice')
      .attr('d', arc)
      .attr('fill', d => d.data.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mousemove', function (event: MouseEvent, d) {
        const rect = container.getBoundingClientRect()
        const px = event.pageX - (rect.left + window.scrollX)
        const py = event.pageY - (rect.top + window.scrollY)
        const label = d.data.key === 'YES' ? 'Oui' : d.data.key === 'NO' ? 'Non' : "Pas d'avis"
        tooltip
          .style('left', `${px + 10}px`)
          .style('top', `${py - 28}px`)
          .style('opacity', 1)
          .text(`${label} : ${d.data.pct.toFixed(1)}%`)
      })
      .on('mouseout', function () {
        tooltip.style('opacity', 0)
      })

    // Percentage labels
    arcs.forEach(d => {
      if (d.data.pct >= 5) {
        const centroid = arc.centroid(d)
        g.append('text')
          .attr('x', centroid[0])
          .attr('y', centroid[1])
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .style('font-size', '10px')
          .style('font-weight', '600')
          .style('fill', '#333')
          .style('pointer-events', 'none')
          .text(`${d.data.pct.toFixed(0)}%`)
      }
    })

    // Emoji in donut hole — scale down if multiple glyphs
    const emojiCount = getEmojiCount(question.emoji)
    const emojiFontSize = emojiCount >= 3
      ? Math.floor(innerRadius * 0.56)
      : emojiCount === 2
      ? Math.floor(innerRadius * 0.76)
      : Math.floor(innerRadius * 1.15)
    g.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .style('font-size', `${emojiFontSize}px`)
      .style('pointer-events', 'none')
      .text(question.emoji)

  }, [question])

  return (
    <div
      ref={containerRef}
      className="dv-container"
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: CARD_SIZE + 32, padding: '8px 8px 6px' }}
    >
      <svg ref={svgRef} />
      <div style={{ fontSize: 11, color: '#374151', textAlign: 'center', lineHeight: 1.3, maxWidth: CARD_SIZE + 12, padding: '0 4px' }}>
        {question.questionTitle}
      </div>
    </div>
  )
}

const DvEmdvSatisfactionsPieCharts: React.FC<Props> = ({ selectedSus }) => {
  const [subcategories, setSubcategories] = useState<EmdvSubcategoryResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await getDpEmdvSatisfactionsByCategoryDatapack({ selectedSus, extra: { subcategory: 'all' } })
        setSubcategories(response.data.subcategories)
      } catch (e) {
        console.error('[DvEmdvSatisfactionsPieCharts] load error', e)
        setError('Impossible de charger les données EMDV')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [selectedSus])

  if (loading) return <div style={{ padding: 12, color: '#666' }}>Chargement…</div>
  if (error)   return <div style={{ padding: 12, color: '#b00020' }}>{error}</div>
  if (!subcategories.length) return <div style={{ padding: 12, color: '#666' }}>Aucune donnée.</div>

  return (
    <div style={{ padding: '8px 8px 24px' }}>
      {subcategories.map(sc => (
        <div key={sc.subcategory} className="zone-target emdv-subcategory" style={{ marginBottom: 32 }}>
          <h3 style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#1f2937',
            margin: '0 0 12px 4px',
            paddingBottom: 6,
            borderBottom: '1px solid #e5e7eb',
          }}>
            {sc.subcategoryEmoji} {sc.subcategoryLabel}
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'flex-start', paddingLeft: 4 }}>
            {sc.questions.map(q => (
              <EmdvPieCard key={q.questionKey} question={q} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default DvEmdvSatisfactionsPieCharts
