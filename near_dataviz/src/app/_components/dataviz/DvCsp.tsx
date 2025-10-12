'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getDpCspData, type CspDistributionResult } from '~/lib/datapacks/DpCsp'
import { getPalette, getSuColors } from '~/lib/datapacks/DpColor'
import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'

interface DvCspProps {
  selectedSus?: number[]
  containerWidth?: number
  containerHeight?: number
}

const DvCsp: React.FC<DvCspProps> = ({
  selectedSus,
  containerWidth = 400,
  containerHeight = 250
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [data, setData] = useState<CspDistributionResult | null>(null)
  const [colors, setColors] = useState<string[]>([])
  const [mainColor, setMainColor] = useState<string>('#002878')
  const [lightColor3, setLightColor3] = useState<string>('#99AAFF')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load data and colors effect
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Déterminer l'ID de SU pour les couleurs
        let globalSuId: number | undefined = undefined
        
        if (selectedSus && selectedSus.length === 1 && selectedSus[0] !== undefined) {
          // Convertir l'ID local vers l'ID global pour DpColor
          const globalIds = await mapLocalToGlobalIds([selectedSus[0]])
          globalSuId = globalIds[0]
          console.log(`🎨 Mapping couleur: SU locale ${selectedSus[0]} → SU globale ${globalSuId}`)
        }
        
        // Charger les données et les couleurs en parallèle
        const [result, palette, suColors] = await Promise.all([
          getDpCspData(selectedSus),
          getPalette('graph', globalSuId), // Using 'graph' palette for stacked bars
          getSuColors(globalSuId) // Couleur principale pour le titre avec ID global
        ])
        
        console.log(`🎨 Palette chargée pour SU ${globalSuId}:`, palette.slice(0, 3), '...')
        console.log(`🎨 Couleur principale:`, suColors.colorMain)
        console.log(`🎨 Couleur light3:`, suColors.colorLight3)
        
        setData(result)
        setColors(palette)
        setMainColor(suColors.colorMain)
        setLightColor3(suColors.colorLight3)
        
      } catch (err) {
        console.error('Failed to load CSP distribution data:', err)
        setError('Erreur lors du chargement des données')
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [selectedSus])

  // D3 Horizontal Stacked Bar Chart
  useEffect(() => {
    if (!data || !svgRef.current || colors.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove() // Clear previous content

    const margin = { top: 40, right: 20, bottom: 120, left: 20 }
    const width = containerWidth - margin.left - margin.right
    const height = containerHeight - margin.top - margin.bottom

    // Calculate cumulative values for stacking
    let cumulative = 0
    const stackedData = data.data.map(d => {
      const start = cumulative
      cumulative += d.percentage
      return {
        ...d,
        start,
        end: cumulative
      }
    })

    // Create scales
    const xScale = d3.scaleLinear()
      .domain([0, 100])
      .range([0, width])

    const barHeight = Math.min(60, height / 3) // Maximum 60px height, or 1/3 of available height

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top + (height - barHeight) / 2})`)

    // Create stacked bars
    const bars = g.selectAll('.csp-bar')
      .data(stackedData)
      .enter()
      .append('g')
      .attr('class', 'csp-bar')

    // Add rectangles
    bars.append('rect')
      .attr('x', d => xScale(d.start))
      .attr('y', 0)
      .attr('width', d => xScale(d.end - d.start))
      .attr('height', barHeight)
      .attr('fill', (d, i) => colors[i % colors.length] ?? colors[0] ?? mainColor)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseover', function(event: MouseEvent, d) {
        // Tooltip on hover
        const tooltip = d3.select('body').append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0,0,0,0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('z-index', '9999')

        tooltip.html(`
          <div><strong>${d.emoji} ${d.label}</strong></div>
          <div>${d.percentage.toFixed(1)}% (${d.count} ${data.isQuartier ? 'habitants' : 'réponses'})</div>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')

        // Highlight bar
        d3.select(this)
          .attr('stroke', '#333')
          .attr('stroke-width', 2)
      })
      .on('mouseout', function() {
        // Remove tooltip
        d3.selectAll('.tooltip').remove()
        
        // Reset bar style
        d3.select(this)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1)
      })

    // Add percentage labels on bars (only if segment is wide enough)
    bars.append('text')
      .attr('x', d => xScale(d.start + (d.end - d.start) / 2))
      .attr('y', barHeight / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .style('fill', 'white')
      .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.7)')
      .text(d => {
        const segmentWidth = xScale(d.end - d.start)
        // Only show percentage if segment is wide enough (>40px)
        return segmentWidth > 40 ? `${d.percentage.toFixed(0)}%` : ''
      })

    // Create legend below the bar chart using HTML foreignObject for natural flow
    const legend = svg.append('foreignObject')
      .attr('x', margin.left)
      .attr('y', containerHeight - margin.bottom + 20)
      .attr('width', width)
      .attr('height', margin.bottom - 20)

    const legendContainer = legend.append('xhtml:div')
      .style('display', 'flex')
      .style('flex-wrap', 'wrap')
      .style('gap', '12px')
      .style('align-items', 'center')
      .style('font-family', 'system-ui, sans-serif')
      .style('line-height', '1.4')

    // Create legend items as inline divs
    const legendItems = legendContainer.selectAll('.legend-item')
      .data(data.data)
      .enter()
      .append('xhtml:div')
      .attr('class', 'legend-item')
      .style('display', 'inline-flex')
      .style('align-items', 'center')
      .style('gap', '6px')
      .style('font-size', '11px')
      .style('font-weight', '500')
      .style('color', '#333')

    // Add color square to each legend item
    legendItems.append('xhtml:div')
      .style('width', '12px')
      .style('height', '12px')
      .style('border-radius', '2px')
      .style('border', '1px solid #ccc')
      .style('flex-shrink', '0')
      .style('background-color', (d, i) => colors[i % colors.length] ?? colors[0] ?? mainColor)

    // Add emoji and text to each legend item
    legendItems.append('xhtml:span')
      .text(d => {
        const labelText = d.label.length > 25 ? d.label.substring(0, 25) + '...' : d.label
        return `${d.emoji || ''} ${labelText}`.trim()
      })

    // Add title
    svg.append('text')
      .attr('x', margin.left)
      .attr('y', 25)
      .attr('class', 'dv-title')
      .style('fill', mainColor)
      .text(`${data.questionLabels.title} ${data.questionLabels.emoji}`)

  }, [data, colors, mainColor, lightColor3, containerWidth, containerHeight])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chargement des données CSP...</div>
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
    <div className="w-full h-full">
      <svg
        ref={svgRef}
        width={containerWidth}
        height={containerHeight}
        className="w-full h-full"
      />
    </div>
  )
}

export default DvCsp
