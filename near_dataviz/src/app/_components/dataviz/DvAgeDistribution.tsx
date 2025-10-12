'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getDpAgeDistributionData, type AgeDistributionResult } from '~/lib/datapacks/DpAgeDistribution'
import { getPalette, getSuColors } from '~/lib/datapacks/DpColor'
import { mapLocalToGlobalIds } from '~/lib/services/suIdMapping'

interface DvAgeDistributionProps {
  selectedSus?: number[]
}

const DvAgeDistribution: React.FC<DvAgeDistributionProps> = ({
  selectedSus
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const svgContainer = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<AgeDistributionResult | null>(null)
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
      console.log('📐 DvAgeDistribution dimensions updated:', { width: newWidth, height: newHeight })
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

    // Use fallback dimensions if responsive dimensions not yet available
    const fallbackWidth = 400
    const fallbackHeight = 200
    
    // Dimensions following ResponsiveD3 pattern
    const dimensions = {
      width: width ?? fallbackWidth,
      height: height ?? fallbackHeight,
      margins: { top: 20, right: 20, bottom: 20, left: 20 }
    }

    const chartWidth = dimensions.width - dimensions.margins.left - dimensions.margins.right
    const chartHeight = dimensions.height - dimensions.margins.top*2 - dimensions.margins.bottom*2

    // Set SVG dimensions
    svg
      .attr('width', chartWidth)
      .attr('height', chartHeight)

    const g = svg.append('g')
      .attr('transform', `translate(
        ${dimensions.margins.left},
        ${dimensions.margins.top * 2.5}
        )`)

    // Create scales for line chart
    const xScale = d3.scalePoint()
      .domain(data.data.map(d => d.label))
      .range([0, chartWidth])
      .padding(0.1)

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data.data, d => d.percentage) ?? 100])
      .range([chartHeight, 0])

    // Create line generator
    const line = d3.line<typeof data.data[0]>()
      .x(d => xScale(d.label) ?? 0)
      .y(d => yScale(d.percentage))
      .curve(d3.curveCardinal.tension(0.3))

    // Create area generator for fill
    const area = d3.area<typeof data.data[0]>()
      .x(d => xScale(d.label) ?? 0)
      .y0(chartHeight)
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
      .attr('transform', `translate(0,${chartHeight})`)
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
      .attr('x', dimensions.margins.left)
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

  }, [data, colors, mainColor, lightColor3, width, height])

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
    <div ref={svgContainer} className="w-full h-full">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  )
}

export default DvAgeDistribution