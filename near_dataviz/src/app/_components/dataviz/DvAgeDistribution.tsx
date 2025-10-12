'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getDpAgeDistributionData, type AgeDistributionResult } from '~/lib/datapacks/DpAgeDistribution'
import { getPalette, getSuColors } from '~/lib/datapacks/DpColor'
import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'

interface DvAgeDistributionProps {
  selectedSus?: number[]
  containerWidth?: number
  containerHeight?: number
}

const DvAgeDistribution: React.FC<DvAgeDistributionProps> = ({
  selectedSus,
  containerWidth = 400,
  containerHeight = 200
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [data, setData] = useState<AgeDistributionResult | null>(null)
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
          getDpAgeDistributionData(selectedSus),
          getPalette('gradient', globalSuId), // Palette pour les barres avec ID global
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
        console.error('Failed to load age distribution data:', err)
        setError('Erreur lors du chargement des données')
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [selectedSus])

  // D3 Dataviz
  useEffect(() => {
    if (!data || !svgRef.current || colors.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove() // Clear previous content

    const margin = { top: 80, right: 20, bottom: 60, left: 20 }
    const width = containerWidth - margin.left - margin.right
    const height = containerHeight - margin.top - margin.bottom

    const g = svg.append('g')
      .attr('transform', `translate(
        ${margin.left},
        ${margin.top -10}
        )`)

    // Create scales for line chart
    const xScale = d3.scalePoint()
      .domain(data.data.map(d => d.label))
      .range([0, width])
      .padding(0.1)

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data.data, d => d.percentage) ?? 100])
      .range([height, 0])

    // Create line generator
    const line = d3.line<typeof data.data[0]>()
      .x(d => xScale(d.label) ?? 0)
      .y(d => yScale(d.percentage))
      .curve(d3.curveCardinal.tension(0.3))

    // Create area generator for fill
    const area = d3.area<typeof data.data[0]>()
      .x(d => xScale(d.label) ?? 0)
      .y0(height)
      .y1(d => yScale(d.percentage))
      .curve(d3.curveCardinal.tension(0.3))

    // Add area fill
    g.append('path')
      .datum(data.data)
      .attr('class', 'area')
      .attr('d', area)
      .attr('fill', lightColor3)
      .attr('opacity', 0.6)

    // Add line
    g.append('path')
      .datum(data.data)
      .attr('class', 'line')
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', mainColor)
      .attr('stroke-width', 3)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')

    // Add data points
    g.selectAll('.dot')
      .data(data.data)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(d.label) ?? 0)
      .attr('cy', d => yScale(d.percentage))
      .attr('r', 5)
      .attr('fill', mainColor)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
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
          <div><strong>${d.label}</strong></div>
          <div>${d.percentage.toFixed(1)}% (${d.count})</div>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')

        // Highlight point
        d3.select(this)
          .attr('r', 7)
          .attr('stroke', mainColor)
          .attr('stroke-width', 3)
      })
      .on('mouseout', function() {
        // Remove tooltip
        d3.selectAll('.tooltip').remove()
        
        // Reset point style
        d3.select(this)
          .attr('r', 5)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
      })

    // Add percentage labels on points
    g.selectAll('.point-label')
      .data(data.data)
      .enter()
      .append('text')
      .attr('class', 'point-label')
      .attr('x', d => xScale(d.label) ?? 0)
      .attr('y', d => yScale(d.percentage) - 10)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .style('fill', mainColor)
      .text(d => `${d.percentage.toFixed(0)}%`)

    // Add X axis
     g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).offset(10))
      .selectAll("path,line,text")
      .attr('stroke-opacity', 0)
      .attr('class', 'dv-x-axis-label')
      .style('text-anchor', 'middle')
      .attr('margin-top', '30px')
      .attr('color', mainColor)
      .attr('dx', '-.8em')
      .attr('dy', '.50em')

    // Add Y axis
    /* g.append('g')
      .call(d3.axisLeft(yScale).tickFormat((d: d3.NumberValue) => `${Number(d)}%`))
      .selectAll('text')
      .style('font-size', '10px') */

    // Add title
    svg.append('text')
      .attr('x', 0 + margin.left)
      .attr('y', 25)
      .attr('class', 'dv-title')
      .style('fill', mainColor)
      .text(`${data.questionLabels.title} ${data.questionLabels.emoji}`)

    // Add subtitle showing context
    {/*svg.append('text')
      .attr('x', containerWidth / 2)
      .attr('y', containerHeight - 5)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#666')
      .text(data.isQuartier ? 'Ensemble du quartier' : `SU #${data.suId}`)*/}

  }, [data, colors, mainColor, lightColor3, containerWidth, containerHeight])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chargement des données d&apos;âge...</div>
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

export default DvAgeDistribution