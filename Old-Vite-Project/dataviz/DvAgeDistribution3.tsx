import React, { useMemo, useRef } from 'react'
import { getDpAgeDistributionData, type AgeDistributionResult } from '../datapacks/DpAgeDistribution'

type AgeDataItem = {
  value: string
  label: string
  emoji: string
  count: number
  percentage: number
  color: string
  midpoint: number
}

type ChartPoint = {
  x: number
  y: number
  data: AgeDataItem
  percentage: number
}

type Props = {
  data?: string  // Legacy prop for backward compatibility
  selectedSus?: number[]  // Modern prop
}

/**
 * DvAgeDistribution3 - Readable curved line chart with light area
 * Fits 100% to parent while maintaining text readability
 */
export default function DvAgeDistribution3({ data, selectedSus }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Get data - support both new selectedSus and legacy data prop
  const ageResult: AgeDistributionResult | null = useMemo(() => {
    if (selectedSus !== undefined) {
      // New approach - get data directly from datapack
      return getDpAgeDistributionData(selectedSus);
    } else if (data) {
      // Legacy approach - parse provided data
      try {
        const parsed = JSON.parse(data);
        // Convert legacy format if needed
        return parsed;
      } catch {
        console.error('Failed to parse age distribution data JSON');
        return null;
      }
    }
    return null;
  }, [data, selectedSus])

  // Container that fits parent exactly - responsive to parent dimensions
  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    maxHeight: '90px', // Respect zoneAge grid row height (~1080px/12 rows)
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    overflow: 'hidden'
  }

  // Fixed viewBox dimensions for consistent chart layout
  const viewBoxWidth = 200
  const viewBoxHeight = 45

  // Validation - check if we have data
  if (!ageResult || !ageResult.data || ageResult.data.length === 0) {
    return (
      <div ref={containerRef} style={containerStyle}>
        <div style={{ 
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6c757d', 
          fontSize: '0.8em'
        }}>
          Aucune donnée disponible
        </div>
      </div>
    )
  }

  // Process age data
  const ageData = ageResult.data;
  const totalCount = ageData.reduce((sum, item) => sum + item.count, 0);

  if (totalCount === 0) {
    return (
      <div ref={containerRef} style={containerStyle}>
        <div style={{ 
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6c757d', 
          fontSize: '0.8em'
        }}>
          Aucune réponse trouvée
        </div>
      </div>
    )
  }



  // Create smooth curve points
  const createCurvePath = (points: Array<{ x: number; y: number }>) => {
    if (points.length < 2) return ''
    
    let path = `M ${points[0].x} ${points[0].y}`
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      
      // Smooth curve using control points
      const cp1x = prev.x + (curr.x - prev.x) * 0.4
      const cp2x = curr.x - (curr.x - prev.x) * 0.4
      
      path += ` C ${cp1x} ${prev.y}, ${cp2x} ${curr.y}, ${curr.x} ${curr.y}`
    }
    
    return path
  }

  // Create area under curve
  const createAreaPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length < 2) return ''
    
    const baseY = 31 // Bottom of chart area (adjusted for 45-height viewBox)
    let path = `M ${points[0].x} ${baseY}`
    path += ` L ${points[0].x} ${points[0].y}`
    
    // Follow the curve
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      
      const cp1x = prev.x + (curr.x - prev.x) * 0.4
      const cp2x = curr.x - (curr.x - prev.x) * 0.4
      
      path += ` C ${cp1x} ${prev.y}, ${cp2x} ${curr.y}, ${curr.x} ${curr.y}`
    }
    
    // Close area
    path += ` L ${points[points.length - 1].x} ${baseY} Z`
    
    return path
  }

  // Calculate data points for chart
  const maxPercentage = Math.max(...ageData.map(item => item.percentage));
  
  const chartData = ageData.map((item, index) => {
    // Map index to x position (spread across width with margins)
    const marginX = viewBoxWidth * 0.05
    const chartWidth = viewBoxWidth * 0.9
    const x = marginX + (index / (ageData.length - 1)) * chartWidth
    
    // Map percentage to y position (inverted, with margin)
    const y = 30 - ((item.percentage / maxPercentage) * 18)
    
    return {
      x,
      y,
      data: item,
      percentage: item.percentage
    }
  })

  const curvePath = createCurvePath(chartData)
  const areaPath = createAreaPath(chartData)

  return (
    <div ref={containerRef} style={containerStyle}>
      {/* Titre */}
      <div style={{ 
        color: ageResult.color,
        fontSize: '0.9em',
        fontWeight: '600',
        textAlign: 'left',
        padding: '0.2em 0.3em 0.1em',
        lineHeight: 1.1,
        minHeight: '14px'
      }}>
        Tranches d'âges
      </div>

      {/* Chart area - optimized for ~70px remaining height */}
      <div style={{ 
        flex: 1,
        position: 'relative',
        paddingTop: '1em',
        paddingBottom: '1em',
        minHeight: '60px', // Ensure minimum chart space
        //maxHeight: '70px',  // Respect remaining height after title
        //minWidth: '100px'
      }}>
        <svg 
          width="100%" 
          height="100%" 
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          style={{ overflow: 'hidden' }}
        >
          {/* Light area under curve */}
          <path
            d={areaPath}
            fill={ageResult.color}
            fillOpacity={0.15}
          />

          {/* Main curve line - thinner for compact layout */}
          <path
            d={curvePath}
            fill="none"
            stroke={ageResult.color}
            strokeWidth={1.0}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points and labels */}
          {chartData.map((point: ChartPoint, index: number) => (
            <g key={`age-${point.data.value}-${index}`}>
              {/* Data point - smaller for compact layout */}
              <circle
                cx={point.x}
                cy={point.y}
                r={3}
                fill={ageResult.color}
                stroke="#ffffff"
                strokeWidth={2}
              />
              
              {/* Percentage label - compact but readable */}
              <text
                x={point.x}
                y={point.y - 4}
                textAnchor="middle"
                fill={ageResult.color}
                fontSize={11}
                fontWeight="600"
              >
                {point.percentage.toFixed(0)}%
              </text>
              
              {/* Age range label - positioned for 45-height viewBox */}
              <text
                x={point.x}
                y={42}
                textAnchor="middle"
                fill="#8f9ca8ff"
                fontSize={10}
                fontWeight="500"
              >
                {point.data.label}
              </text>
            </g>
          ))}
        </svg>
      </div>

    </div>
  )
}