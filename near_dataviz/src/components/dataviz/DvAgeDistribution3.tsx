'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { getDpAgeDistributionData, type AgeDistributionResult } from '~/lib/datapacks/DpAgeDistribution'

interface DvAgeDistribution3Props {
  selectedSus?: number[]
  containerWidth?: number
  containerHeight?: number
}

const DvAgeDistribution3: React.FC<DvAgeDistribution3Props> = ({
  selectedSus,
  containerWidth = 400,
  containerHeight = 300
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [data, setData] = useState<AgeDistributionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load data effect
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await getDpAgeDistributionData(selectedSus)
        setData(result)
      } catch (err) {
        console.error('Failed to load age distribution data:', err)
        setError('Erreur lors du chargement des données')
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [selectedSus])

  // D3 visualization effect
  useEffect(() => {
    if (!data || !svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove() // Clear previous content

    const margin = { top: 40, right: 20, bottom: 80, left: 60 }
    const width = containerWidth - margin.left - margin.right
    const height = containerHeight - margin.top - margin.bottom

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Create scales
    const xScale = d3.scaleBand()
      .domain(data.data.map(d => d.value))
      .range([0, width])
      .padding(0.1)

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(data.data, d => d.percentage) ?? 100])
      .range([height, 0])

    // Create bars
    g.selectAll('.bar')
      .data(data.data)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.value) ?? 0)
      .attr('width', xScale.bandwidth())
      .attr('y', d => yScale(d.percentage))
      .attr('height', d => height - yScale(d.percentage))
      .attr('fill', d => d.color)
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
          <div><strong>${d.label}</strong></div>
          <div>${d.percentage.toFixed(1)}% (${d.count})</div>
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

    // Add percentage labels on bars
    g.selectAll('.bar-label')
      .data(data.data)
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .attr('x', d => (xScale(d.value) ?? 0) + xScale.bandwidth() / 2)
      .attr('y', d => yScale(d.percentage) - 5)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .style('fill', '#333')
      .text(d => `${d.percentage.toFixed(0)}%`)

    // Add X axis
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('font-size', '10px')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)')

    // Add Y axis
    g.append('g')
      .call(d3.axisLeft(yScale).tickFormat((d: d3.NumberValue) => `${Number(d)}%`))
      .selectAll('text')
      .style('font-size', '10px')

    // Add title
    svg.append('text')
      .attr('x', containerWidth / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('font-weight', 'bold')
      .style('fill', data.color)
      .text(`${data.questionLabels.title} ${data.questionLabels.emoji}`)

    // Add subtitle showing context
    svg.append('text')
      .attr('x', containerWidth / 2)
      .attr('y', containerHeight - 5)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('fill', '#666')
      .text(data.isQuartier ? 'Ensemble du quartier' : `SU #${data.suId}`)

  }, [data, containerWidth, containerHeight])

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

export default DvAgeDistribution3