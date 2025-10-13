"use client"
import React, { useRef, useEffect, useState } from 'react'
import * as d3 from 'd3'
import { getBarrierDataForQuestion } from '~/lib/datapacks/DpBarrierAnalysisV2'
import type { BarrierQuestionData, BarrierCategoryData } from '~/lib/datapacks/DpBarrierAnalysisV2'

interface DvBarrierGradientProps {
  selectedSus?: number[]
  selectedQuestionKey: string
  onQuestionChange?: (questionKey: string) => void
  showHamburger?: boolean
}

const DvBarrierGradient: React.FC<DvBarrierGradientProps> = ({ selectedSus, selectedQuestionKey }) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const svgContainer = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number>()
  const [height, setHeight] = useState<number>()
  const [data, setData] = useState<BarrierQuestionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // This function calculates width and height of the container (like DvGenre)
  const getSvgContainerSize = () => {
    if (svgContainer.current) {
      const newWidth = svgContainer.current.clientWidth
      const newHeight = svgContainer.current.clientHeight
      setWidth(newWidth)
      setHeight(newHeight)
    }
  }

  useEffect(() => {
    // detect 'width' and 'height' on render
    getSvgContainerSize()
    // listen for resize changes
    window.addEventListener('resize', getSvgContainerSize)
    return () => window.removeEventListener('resize', getSvgContainerSize)
  }, [])

  // Ensure dimensions after data loads (like DvGenre)
  useEffect(() => {
    if (data && svgContainer.current && (!width || !height)) {
      const timer = setTimeout(() => {
        getSvgContainerSize()
      }, 10)
      return () => clearTimeout(timer)
    }
  }, [data, width, height])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await getBarrierDataForQuestion(selectedQuestionKey, selectedSus)
        setData(res.data[0] ?? null)
      } catch {
        setError("Impossible de charger les barrières")
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [selectedQuestionKey, selectedSus])

  useEffect(() => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
  if (!data || !width || !height) return

    const margin = { top: 28, right: 16, bottom: 24, left: 16 }
    const innerW = Math.max(200, width - margin.left - margin.right)
    const innerH = Math.max(140, height - margin.top - margin.bottom)
    svg.attr('width', width).attr('height', height)

    // Groupe racine
    const root = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`)

    // Titre (au-dessus des barres)
    root
      .append('text')
      .attr('x', 0)
      .attr('y', -6)
      .attr('class', 'H2-Dv')
      .style('font-size', '14px')
      .style('font-weight', '600')
      .text(data.questionLabels.title)

    // Légende verticale à droite
    const legendWidth = Math.max(16, innerW * 0.08)
    const legendHeight = Math.min(innerH * 0.6, 150)
    const barsAreaW = innerW - (legendWidth + 16)

    const rowH = 28
    const gap = 2
    const explanatoryH = 18
    const availableHForBars = innerH - 20 - explanatoryH // -20 for title padding
    const maxBarsCount = Math.floor((availableHForBars + gap) / (rowH + gap))

    const filtered = data.categories.filter(
      (c) => c.percentage > 0 && c.percentage < 100 && c.familleBarriere !== 'Non concerné'
    )
    const sorted = [...filtered].sort((a, b) => b.percentage - a.percentage)
    const visible: BarrierCategoryData[] = sorted.slice(0, maxBarsCount)

    const totalH = visible.length * (rowH + gap)
    const yStart = Math.max(12, (innerH - totalH) / 2)

    // Tooltip flottante
    // Tooltip sur le body (comme DvGenre)
    const tooltipSel = d3
      .select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('background', 'rgba(0,0,0,0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('z-index', '9999')
      .style('opacity', 0)

    const generateGradientColor = (percentage: number): string => {
      const intensity = Math.min(100, Math.max(0, percentage)) / 100
      const r = Math.round(255 - 35 * intensity)
      const g = Math.round(255 - 205 * intensity)
      const b = Math.round(232 - 182 * intensity)
      return `rgb(${r}, ${g}, ${b})`
    }

    // Barres
    const rows = root
      .append('g')
      .attr('transform', `translate(0, ${yStart})`)
      .selectAll('g.row')
      .data(visible)
      .enter()
      .append('g')
      .attr('class', 'row')
      .attr('transform', (_d, i) => `translate(0, ${i * (rowH + gap)})`)

    rows
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('width', barsAreaW)
      .attr('height', rowH)
      .attr('fill', (d) => generateGradientColor(d.percentage))
      .style('cursor', 'pointer')
      .on('mousemove', function (event: PointerEvent, d) {
        tooltipSel
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 10}px`)
          .style('opacity', 1)
          .html(`<div><strong>${d.isOtherReasons ? '💬' : '🚧'} ${d.familleBarriere}</strong></div><div>${d.percentage.toFixed(1)}%</div>`)
      })
      .on('mouseout', function () {
        tooltipSel.style('opacity', 0).remove()
      })

    // Emojis
    rows
      .append('text')
      .attr('x', 8)
      .attr('y', rowH / 2)
      .attr('dominant-baseline', 'central')
      .text((d) => (d.isOtherReasons ? '💬' : '🚧'))

    // Labels catégorie
    rows
      .append('text')
      .attr('x', 26)
      .attr('y', rowH / 2)
      .attr('dominant-baseline', 'central')
      .attr('class', 'p2-labels')
      .style('font-size', '11px')
      .style('fill', '#0f172a')
      .text((d) => d.familleBarriere)

    // Pourcentage à droite
    rows
      .append('text')
      .attr('x', barsAreaW - 8)
      .attr('y', rowH / 2)
      .attr('dominant-baseline', 'central')
      .attr('text-anchor', 'end')
      .attr('class', 'p2-labels')
      .style('font-size', '11px')
      .style('font-weight', '700')
      .text((d) => `${d.percentage.toFixed(1)}%`)

    // Texte explicatif
    root
      .append('text')
      .attr('x', barsAreaW)
      .attr('y', yStart + totalH + 12)
      .attr('text-anchor', 'end')
      .attr('class', 'p3-labels')
      .style('fill', '#334155')
      .style('font-size', '11px')
      .text("(% des répondants ayant coché une réponse dans cette catégorie)")

    // Légende verticale (100% en haut -> 0% en bas)
    const legendGroup = root.append('g').attr('transform', `translate(${barsAreaW + 16}, ${(innerH - legendHeight) / 2})`)
    legendGroup
      .append('text')
      .attr('x', legendWidth / 2)
      .attr('y', -4)
      .attr('text-anchor', 'middle')
      .attr('class', 'p2-labels')
      .style('font-size', '10px')
      .style('font-weight', '700')
      .text('100%')

    legendGroup
      .append('rect')
      .attr('x', (legendWidth - Math.max(12, legendWidth * 0.4)) / 2)
      .attr('y', 0)
      .attr('width', Math.max(12, legendWidth * 0.4))
      .attr('height', legendHeight)
      .attr('rx', 8)
      .attr('ry', 8)
      .style('stroke', '#333')
      .style('stroke-width', 2)
      .style('filter', 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))')
      .style(
        'fill',
        'url(#barrierLegendGradient)'
      )

    // Define gradient
    const defs = svg.append('defs')
    const lg = defs
      .append('linearGradient')
      .attr('id', 'barrierLegendGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%')
    lg.append('stop').attr('offset', '0%').attr('stop-color', 'rgb(220, 50, 50)')
    lg.append('stop').attr('offset', '100%').attr('stop-color', 'rgb(255, 255, 232)')

    legendGroup
      .append('text')
      .attr('x', legendWidth / 2)
      .attr('y', legendHeight + 12)
      .attr('text-anchor', 'middle')
      .attr('class', 'p2-labels')
      .style('font-size', '10px')
      .style('font-weight', '700')
      .text('0%')
  }, [data, width, height])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chargement des données…</div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        {error}
      </div>
    )
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Aucune donnée disponible
      </div>
    )
  }
  return (
    <div ref={svgContainer} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  )
}

export default DvBarrierGradient
