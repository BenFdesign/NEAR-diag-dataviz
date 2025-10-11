import React, { useMemo, useState, useCallback } from 'react'

type ProfessionalCategoryChoice = {
  key: string
  labelShort: string
  emoji: string
  color: string
}

type SuProfessionalCategoryData = {
  suId: number
  nameFr: string
  color: string
  total: number
  categories: Record<string, number>
}

type PayloadData = {
  id?: string
  version?: string
  questionTitle?: string
  questionEmoji?: string
  choices?: ProfessionalCategoryChoice[]
  sus?: SuProfessionalCategoryData[]
  quartier?: {
    nameFr: string
    color: string
    total: number
    categories: Record<string, number>
  }
  warnings?: Array<{
    type: string
    message: string
    suId?: number
    value?: string
  }>
}

type Props = {
  data: string | PayloadData
  width?: number | string
}

export default function DvSuProfessionalCategory({ data, width = "100%" }: Props) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  const [hoveredSu, setHoveredSu] = useState<number | null>(null)

  const payload = useMemo(() => {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data) as PayloadData
      } catch {
        return {}
      }
    }
    return data
  }, [data])

  const {
    questionTitle = 'Catégories socio-professionnelles',
    questionEmoji = '💼📋',
    choices = [],
    sus = [],
    quartier,
    warnings = []
  } = payload

  // Combine SUs and quartier for visualization
  const allItems = useMemo(() => {
    const items = [...sus]
    if (quartier) {
      items.push({
        suId: 0,
        nameFr: quartier.nameFr,
        color: quartier.color,
        total: quartier.total,
        categories: quartier.categories
      })
    }
    return items
  }, [sus, quartier])

  // Calculate layout dimensions
  const margin = { top: 60, right: 20, bottom: 10, left: 100 }
  
  // Handle responsive width
  const actualWidth = typeof width === 'string' && width.includes('%') ? 
    800 : // Default fallback for percentage widths in SVG
    (typeof width === 'number' ? width : parseInt(width as string) || 800)
  
  const chartWidth = actualWidth - margin.left - margin.right
  
  const barHeight = 40 // Fixed bar height of 40px
  const totalChartHeight = allItems.length * (barHeight + 10) - 10

  // For 100% stacked bars, we always use full width
  const xScale = useCallback((percentage: number) => (percentage / 100) * chartWidth, [chartWidth])
  
  // Ticks de pourcentage)
  const axisTicks = [0, 25, 50, 75, 100]
  
  // Stack data for each item (normalized to 100%)
  const stackedData = useMemo(() => {
    return allItems.map(item => {
      if (item.total === 0) {
        // Handle empty case
        return {
          ...item,
          segments: [],
          totalWidth: 0
        }
      }
      
      let cumulativePercentage = 0
      const segments = choices.map(choice => {
        const value = item.categories[choice.key] || 0
        const percentage = (value / item.total) * 100
        const segment = {
          key: choice.key,
          choice,
          value,
          percentage,
          x0: cumulativePercentage,
          x1: cumulativePercentage + percentage,
          width: xScale(percentage),
          x: xScale(cumulativePercentage)
        }
        cumulativePercentage += percentage
        return segment
      }).filter(segment => segment.value > 0) // Only show non-zero segments
      
      return {
        ...item,
        segments,
        totalWidth: xScale(100) // Always 100% width
      }
    })
  }, [allItems, choices, xScale])

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: 'auto',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  }

  return (
    <div style={containerStyle}>
      {/* Title */}
      <div style={{ marginBottom: 0 }}>
        <h3 className="dv-title-main">
          {questionEmoji} {questionTitle}
        </h3>
        {warnings.length > 0 && (
          <div className="dv-warning-text" style={{ color: '#b45309', marginBottom: 0 }}>
            {warnings.length} warning(s): {warnings.slice(0, 2).map(w => w.message).join(', ')}
            {warnings.length > 2 && '...'}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, width: '100%' }}>
        {/* Chart */}
        <div style={{ width: '100%', overflow: 'hidden' }}>
          <svg 
            width="100%" 
            height={totalChartHeight + margin.top + margin.bottom}
            viewBox={`0 0 ${actualWidth} ${totalChartHeight + margin.top + margin.bottom}`}
            style={{ maxWidth: '100%', height: 'auto' }}
          >
            <g transform={`translate(${margin.left}, 0)`}>
              {/* Y-axis labels */}
              {stackedData.map((item, index) => {
                const y = index * (barHeight + 10)
                const isQuartier = item.suId === 0
                const isHovered = hoveredSu === item.suId
                
                return (
                  <g key={item.suId}>
                    {/* SU Name */}
                    <text
                      x={-10}
                      y={y + barHeight / 2}
                      textAnchor="end"
                      dominantBaseline="middle"
                      style={{
                        fontSize: isQuartier ? 14 : 12,
                        fontWeight: isQuartier ? 600 : 400,
                        fill: isHovered ? item.color : '#333',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={() => setHoveredSu(item.suId)}
                      onMouseLeave={() => setHoveredSu(null)}
                    >
                      {item.nameFr}
                    </text>
                    
                    {/* Stacked bars */}
                    {item.segments.map((segment) => {
                      const isHighlighted = hoveredCategory === segment.key || hoveredSu === item.suId
                      const opacity = hoveredCategory && hoveredCategory !== segment.key ? 0.3 : 1
                      
                      return (
                        <rect
                          key={segment.key}
                          x={segment.x}
                          y={y}
                          width={segment.width}
                          height={barHeight}
                          fill={segment.choice.color}
                          opacity={opacity}
                          stroke={isHighlighted ? '#333' : 'none'}
                          strokeWidth={isHighlighted ? 2 : 0}
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={() => {
                            setHoveredCategory(segment.key)
                            setHoveredSu(item.suId)
                          }}
                          onMouseLeave={() => {
                            setHoveredCategory(null)
                            setHoveredSu(null)
                          }}
                        >
                          <title>
                            {item.nameFr} - {segment.choice.emoji} {segment.choice.labelShort}: {segment.value.toFixed(isQuartier ? 1 : 0)} ({segment.percentage.toFixed(1)}%)
                          </title>
                        </rect>
                      )
                    })}
                    
                    {/* Percentage labels for larger segments */}
                    {item.segments.map((segment) => {
                      if (segment.width < 30) return null // Skip small segments
                      if (segment.percentage < 8) return null // Skip small percentages
                      
                      return (
                        <text
                          key={`${segment.key}-label`}
                          x={segment.x + segment.width / 2}
                          y={y + barHeight / 2}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="dv-segment-label"
                          style={{
                            fill: 'white',
                            pointerEvents: 'none'
                          }}
                        >
                          {segment.percentage.toFixed(0)}%
                        </text>
                      )
                    })}
                  </g>
                )
              })}
              
              {/* X-axis */}
              <line
                x1={0}
                y1={totalChartHeight + 5}
                x2={chartWidth}
                y2={totalChartHeight + 5}
                stroke="#ccc"
              />
              
              {/* X-axis ticks */}
              {axisTicks.map(tick => (
                <g key={tick}>
                  <line
                    x1={xScale(tick)}
                    y1={totalChartHeight + 5}
                    x2={xScale(tick)}
                    y2={totalChartHeight + 10}
                    stroke="#ccc"
                  />
                  <text
                    x={xScale(tick)}
                    y={totalChartHeight + 20}
                    textAnchor="middle"
                    className="dv-axis-label"
                    style={{ fill: '#666' }}
                  >
                    {tick}%
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>

        {/* Legend - horizontal layout below chart */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap:10, 
          justifyContent: 'center', 
          paddingTop: 5,
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {choices.map((choice) => {
            const isHovered = hoveredCategory === choice.key
            const opacity = hoveredCategory && hoveredCategory !== choice.key ? 0.5 : 1
            
            return (
              <div
                key={choice.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px',
                  borderRadius: 4,
                  backgroundColor: isHovered ? '#f0f0f0' : 'transparent',
                  cursor: 'pointer',
                  opacity
                }}
                onMouseEnter={() => setHoveredCategory(choice.key)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    backgroundColor: choice.color,
                    borderRadius: 3,
                    border: isHovered ? '2px solid #333' : '1px solid #ccc'
                  }}
                />
                <span className="dv-legend-text">
                  {choice.emoji} {choice.labelShort}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}