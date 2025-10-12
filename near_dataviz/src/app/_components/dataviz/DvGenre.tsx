'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getDpGenreData, type GenreDistributionResult } from '~/lib/datapacks/DpGenre'
import { getPalette, getSuColors } from '~/lib/datapacks/DpColor'
import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'

interface DvGenreProps {
  selectedSus?: number[]
  containerWidth?: number
  containerHeight?: number
}

const DvGenre: React.FC<DvGenreProps> = ({
  selectedSus,
  containerWidth = 400,
  containerHeight = 300
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [data, setData] = useState<GenreDistributionResult | null>(null)
  const [colors, setColors] = useState<string[]>([])
  const [mainColor, setMainColor] = useState<string>('#002878')
  const [lightColor3, setLightColor3] = useState<string>('#99AAFF')
  const [lightColor1, setLightColor1] = useState<string>('#E6EAFF')
  const [darkColor1, setDarkColor1] = useState<string>('#001A4D')
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
          getDpGenreData(selectedSus),
          getPalette('gradient', globalSuId), // Palette pour les secteurs avec ID global
          getSuColors(globalSuId) // Couleur principale pour le titre avec ID global
        ])
        
        console.log(`🎨 Palette chargée pour SU ${globalSuId}:`, palette.slice(0, 3), '...')
        console.log(`🎨 Couleur principale:`, suColors.colorMain)
        console.log(`🎨 Couleur light3:`, suColors.colorLight3)
        console.log(`🎨 Couleur light1:`, suColors.colorLight1)
        console.log(`🎨 Couleur dark1:`, suColors.colorDark1)
        
        setData(result)
        setColors(palette)
        setMainColor(suColors.colorMain)
        setLightColor3(suColors.colorLight3)
        setLightColor1(suColors.colorLight1)
        setDarkColor1(suColors.colorDark1)
        
      } catch (err) {
        console.error('Failed to load genre distribution data:', err)
        setError('Erreur lors du chargement des données')
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [selectedSus])

  // D3 Pie Chart
  useEffect(() => {
    if (!data || !svgRef.current || colors.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove() // Clear previous content

    const margin = { top: 20, right: 20, bottom: 40, left: 20 }
    const width = containerWidth
    const height = containerHeight
    const radius = height*0.25

    const g = svg.append('g')
      .attr('transform', `translate(
        ${containerWidth/2},
        ${containerHeight/2-10}
        )`)

    // Create pie generator
    const pie = d3.pie<typeof data.data[0]>()
      .value(d => d.count)
      .sort(null) // Keep original order

    // Create arc generator
    const arc = d3.arc<d3.PieArcDatum<typeof data.data[0]>>()
      .innerRadius(0)
      .outerRadius(radius)

    // Create arc data
    const arcs = pie(data.data)

    // Create pie slices
    const slices = g.selectAll('.slice')
      .data(arcs)
      .enter()
      .append('g')
      .attr('class', 'slice')

    // Add paths for pie slices
    slices.append('path')
      .attr('d', arc)
      .attr('fill', (d, i) => i === 0 ? lightColor1 : darkColor1)
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
          <div><strong>${d.data.label}</strong></div>
          <div>${d.data.percentage.toFixed(1)}% (${d.data.count})</div>
        `)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')

        // Highlight slice
        d3.select(this)
          .attr('stroke', mainColor)
          .attr('stroke-width', 3)
      })
      .on('mouseout', function() {
        // Remove tooltip
        d3.selectAll('.tooltip').remove()
        
        // Reset slice style
        d3.select(this)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
      })

    // Add percentage labels on slices
    slices.append('text')
      .attr('transform', d => {
        const centroid = arc.centroid(d)
        return `translate(${centroid[0]}, ${centroid[1]})`
      })
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .style('fill', 'white')
      .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.7)')
      .text(d => d.data.percentage > 5 ? `${d.data.emoji} ${d.data.percentage.toFixed(0)}%` : '') // Only show percentage if > 5%

    // Create legend below the pie chart
    /* Ne pas décocmmenter, pas utile pour l'instant.
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${containerWidth/2}, ${containerHeight - margin.bottom + 10})`)

    const legendItems = legend.selectAll('.legend-item')
      .data(data.data)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (d, i) => `translate(0, ${i * 25 - (data.data.length - 1) * 12.5})`)
      // .attr('justify-content', 'middle')
      .attr('margin-right', '50%')
      .attr('margin-left', '50%')

    // Legend color squares
    legendItems.append('rect')
      .attr('x', -80)
      .attr('y', 0)
      .attr('width', 16)
      .attr('height', 16)
      .attr('fill', (d, i) => i === 0 ? lightColor1 : darkColor1)
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1)
      .attr('rx', 2)

    // Legend text
    legendItems.append('text')
      .attr('x', -58)
      .attr('y', 8)
      .attr('dy', '0.35em')
      .style('font-size', '14px')
      .text(d => d.emoji)

    // Legend text
    legendItems.append('text')
      .attr('x', -40)
      .attr('y', 8)
      .attr('dy', '0.35em')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .style('fill', '#333')
      .text(d => `${d.label} (${d.percentage.toFixed(1)}%)`)
    */  
    // Add title
    svg.append('text')
      .attr('x', margin.left)
      .attr('y', 25)
      .attr('class', 'dv-title')
      .style('fill', mainColor)
      .text(`${data.questionLabels.title} ${data.questionLabels.emoji}`)
    

    // Add subtitle showing context
    /* svg.append('text')
      .attr('x', containerWidth / 2)
      .attr('y', containerHeight - 5)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#666')
      .text(data.isQuartier ? 'Ensemble du quartier' : `SU #${data.suId}`) */

  }, [data, colors, mainColor, lightColor3, lightColor1, darkColor1, containerWidth, containerHeight])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chargement des données de genre...</div>
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

export default DvGenre