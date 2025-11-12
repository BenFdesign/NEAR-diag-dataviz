'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getDpCspData, type CspDistributionResult } from '~/lib/datapacks/DpCsp'
import { getPalette, getSuColors } from '~/lib/datapacks/DpColor'
import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'

interface DvCspProps {
  selectedSus?: number[]
}

const DvCsp: React.FC<DvCspProps> = ({
  selectedSus
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const svgContainer = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<CspDistributionResult | null>(null)
  const [colors, setColors] = useState<string[]>([])
  const [mainColor, setMainColor] = useState<string>('#002878')
  const [lightColor3, setLightColor3] = useState<string>('#99AAFF')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // State to track width and height of SVG Container
  const [width, setWidth] = useState<number>()
  const [height, setHeight] = useState<number>()

  // This function calculates width and height of the container
  const getSvgContainerSize = () => {
    if (svgContainer.current) {
      const newWidth = svgContainer.current.clientWidth
      const newHeight = svgContainer.current.clientHeight
      setWidth(newWidth)
      setHeight(newHeight)
      console.log('📐 DvCsp dimensions updated:', { width: newWidth, height: newHeight })
    }
  }

  useEffect(() => {
    // detect 'width' and 'height' on render
    getSvgContainerSize()
    // listen for resize changes, and detect dimensions again when they change
    window.addEventListener("resize", getSvgContainerSize)
    // cleanup event listener
    return () => window.removeEventListener("resize", getSvgContainerSize)
  }, [])

  // Additional effect to ensure dimensions are set after data loads
  useEffect(() => {
    if (data && svgContainer.current && (!width || !height)) {
      // Small delay to ensure DOM is fully rendered
      const timer = setTimeout(() => {
        getSvgContainerSize()
      }, 10)
      return () => clearTimeout(timer)
    }
  }, [data, width, height])

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

    // Use fallback dimensions if responsive dimensions not yet available
    const fallbackWidth = 400
    const fallbackHeight = 250
    
    // Dimensions and margins
    const dimensions = {
      width: width ?? fallbackWidth,
      height: height ?? fallbackHeight,
      margins: { top: 20, right: 20, bottom: 20, left: 20 }
    }

    const chartWidth = dimensions.width - dimensions.margins.left - dimensions.margins.right
    const chartHeight = dimensions.height - dimensions.margins.top - dimensions.margins.bottom

    // Set SVG dimensions
    svg
      .attr('width', dimensions.width)
      .attr('height', dimensions.height)

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
      .range([0, chartWidth])

    const barHeight = Math.min(50, chartHeight / 3) // Maximum 50px height ?? 1/3 du height disponible

    const g = svg.append('g')
      .attr('transform', `translate(
        ${dimensions.margins.left},
        ${dimensions.margins.top + (barHeight) / 3}
        )`)

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

    // Create legend below the bar chart using HTML foreignObject
    const legend = svg.append('foreignObject')
      .attr('x', dimensions.margins.left)
      .attr('y', (chartHeight/1.5))
      .attr('width', chartWidth)
      .attr('height', (chartHeight/3)*1+dimensions.margins.bottom*2)
12
    const legendContainer = legend.append('xhtml:div')
      .style('display', 'flex')
      .style('flex-wrap', 'wrap')
      .style('gap', '8px')
      .style('align-items', 'center')
      .style('font-family', 'system-ui, sans-serif')
      .style('line-height', '1.2')

    // Create legend items as inline divs
    const legendItems = legendContainer.selectAll('.legend-item')
      .data(data.data)
      .enter()
      .append('xhtml:div')
      .attr('class', 'legend-item')
      .style('display', 'inline-flex')
      .style('align-items', 'center')
      .style('gap', '5px')
      .style('font-size', '10px')
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
      .attr('x', dimensions.margins.left)
      .attr('y', dimensions.margins.top)
      .attr('class', 'dv-title')
      .style('fill', mainColor)
      .text(`${data.questionLabels.title} ${data.questionLabels.emoji}`)

  }, [data, colors, mainColor, lightColor3, width, height])

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
    <div ref={svgContainer} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  )
}

export default DvCsp
