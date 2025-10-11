import React, { useMemo, useState, useCallback } from 'react'

type ProfessionalCategorySingleChoice = {
  key: string
  labelShort: string
  emoji: string
  color: string
}

type PayloadData = {
  id?: string
  version?: string
  questionTitle?: string
  questionEmoji?: string
  choices?: ProfessionalCategorySingleChoice[]
  selectedView?: {
    suId: number | null
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

export default function DvSuProfessionalCategorySingle({ data, width = "100%" }: Props) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)

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
    selectedView,
    warnings = []
  } = payload

  // Calculate layout dimensions
  const margin = { top: 80, right: 20, bottom: 60, left: 120 }
  
  // Handle responsive width
  const actualWidth = typeof width === 'string' && width.includes('%') ? 
    800 : // Default fallback for percentage widths in SVG
    (typeof width === 'number' ? width : parseInt(width as string) || 800)
  
  const chartWidth = actualWidth - margin.left - margin.right
  
  const barHeight = 50 // Larger bar for single view
  const totalChartHeight = barHeight

  // For 100% stacked bar, we always use full width
  const xScale = useCallback((percentage: number) => (percentage / 100) * chartWidth, [chartWidth])
  
  // Percentage ticks
  const axisTicks = [0, 25, 50, 75, 100]
  
  // Stack data for the selected view (normalized to 100%)
  const stackedData = useMemo(() => {
    if (!selectedView || selectedView.total === 0) {
      return {
        ...selectedView,
        segments: [],
        totalWidth: 0
      }
    }
    
    let cumulativePercentage = 0
    const segments = choices.map(choice => {
      const value = selectedView.categories[choice.key] || 0
      // For quartier view, values are already percentages; for SU view, they're counts
      const percentage = selectedView.suId === null 
        ? value // Already percentage for quartier
        : (value / selectedView.total) * 100 // Convert count to percentage for SU
      
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
    }).filter(segment => segment.percentage > 0) // Only show non-zero segments
    
    return {
      ...selectedView,
      segments,
      totalWidth: xScale(100) // Always 100% width
    }
  }, [selectedView, choices, xScale])

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: 'auto',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  }

  if (!selectedView) {
    return (
      <div style={containerStyle}>
        <div style={{ padding: 40, textAlign: 'center', color: '#6c757d' }}>
          <h3>Aucune donnée disponible</h3>
          <p>Sélectionnez un SU ou le quartier pour afficher les données.</p>
        </div>
      </div>
    )
  }

  const isQuartier = selectedView.suId === null

  return (
    <div style={containerStyle}>
      {/* Title */}
      <div style={{ marginBottom: 20 }}>
        <h3 className="dv-title-main">
          {questionEmoji} {questionTitle}
        </h3>
        <div className="dv-subtitle" style={{ 
          color: selectedView.color,
          marginBottom: 8
        }}>
          {selectedView.nameFr}
        </div>
        {warnings.length > 0 && (
          <div className="dv-warning-text" style={{ color: '#b45309', marginBottom: 0 }}>
            {warnings.length} warning(s): {warnings.slice(0, 2).map(w => w.message).join(', ')}
            {warnings.length > 2 && '...'}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
        {/* Chart */}
        <div style={{ width: '100%', overflow: 'hidden' }}>
          <svg 
            width="100%" 
            height={totalChartHeight + margin.top + margin.bottom}
            viewBox={`0 0 ${actualWidth} ${totalChartHeight + margin.top + margin.bottom}`}
            style={{ maxWidth: '100%', height: 'auto' }}
          >
            <g transform={`translate(${margin.left}, ${margin.top})`}>
              {/* Entity Name */}
              <text
                x={-10}
                y={barHeight / 2}
                textAnchor="end"
                dominantBaseline="middle"
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  fill: selectedView.color,
                  cursor: 'default'
                }}
              >
                {selectedView.nameFr}
              </text>
              
              {/* Stacked bar */}
              {stackedData.segments?.map((segment) => {
                const isHighlighted = hoveredCategory === segment.key
                const opacity = hoveredCategory && hoveredCategory !== segment.key ? 0.3 : 1
                
                return (
                  <rect
                    key={segment.key}
                    x={segment.x}
                    y={0}
                    width={segment.width}
                    height={barHeight}
                    fill={segment.choice.color}
                    opacity={opacity}
                    stroke={isHighlighted ? '#333' : 'none'}
                    strokeWidth={isHighlighted ? 3 : 0}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredCategory(segment.key)}
                    onMouseLeave={() => setHoveredCategory(null)}
                  >
                    <title>
                      {selectedView.nameFr} - {segment.choice.emoji} {segment.choice.labelShort}: {
                        isQuartier 
                          ? segment.value.toFixed(1) + '%'
                          : segment.value.toFixed(0) + ' (' + segment.percentage.toFixed(1) + '%)'
                      }
                    </title>
                  </rect>
                )
              })}
              
              {/* Percentage labels for larger segments */}
              {stackedData.segments?.map((segment) => {
                if (segment.width < 50) return null // Skip small segments
                if (segment.percentage < 5) return null // Skip small percentages
                
                return (
                  <text
                    key={`${segment.key}-label`}
                    x={segment.x + segment.width / 2}
                    y={barHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="dv-segment-label-large"
                    style={{
                      fill: 'white',
                      pointerEvents: 'none'
                    }}
                  >
                    {segment.percentage.toFixed(0)}%
                  </text>
                )
              })}
              
              {/* X-axis */}
              <line
                x1={0}
                y1={barHeight + 10}
                x2={chartWidth}
                y2={barHeight + 10}
                stroke="#ccc"
                strokeWidth={2}
              />
              
              {/* X-axis ticks */}
              {axisTicks.map(tick => (
                <g key={tick}>
                  <line
                    x1={xScale(tick)}
                    y1={barHeight + 10}
                    x2={xScale(tick)}
                    y2={barHeight + 20}
                    stroke="#ccc"
                    strokeWidth={2}
                  />
                  <text
                    x={xScale(tick)}
                    y={barHeight + 35}
                    textAnchor="middle"
                    style={{ fontSize: 12, fill: '#666', fontWeight: 500 }}
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
          gap: 15, 
          justifyContent: 'center', 
          paddingTop: 10,
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {choices.map((choice) => {
            const isHovered = hoveredCategory === choice.key
            const opacity = hoveredCategory && hoveredCategory !== choice.key ? 0.5 : 1
            const segment = stackedData.segments?.find(s => s.key === choice.key)
            const hasData = segment && segment.percentage > 0
            
            return (
              <div
                key={choice.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 6,
                  backgroundColor: isHovered ? '#f0f0f0' : 'transparent',
                  cursor: hasData ? 'pointer' : 'default',
                  opacity: hasData ? opacity : 0.3,
                  border: hasData && isHovered ? '2px solid #333' : '2px solid transparent'
                }}
                onMouseEnter={() => hasData && setHoveredCategory(choice.key)}
                onMouseLeave={() => setHoveredCategory(null)}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    backgroundColor: choice.color,
                    borderRadius: 4,
                    border: isHovered ? '2px solid #333' : '1px solid #ccc'
                  }}
                />
                <span className="dv-legend-text" style={{ fontWeight: hasData ? 500 : 400 }}>
                  {choice.emoji} {choice.labelShort}
                </span>
                {hasData && segment && (
                  <span className="dv-value-text" style={{ color: '#666' }}>
                    {isQuartier 
                      ? `${segment.value.toFixed(1)}%`
                      : `${segment.value} (${segment.percentage.toFixed(1)}%)`
                    }
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div style={{
          marginTop: 10,
          padding: 16,
          backgroundColor: selectedView.color + '15',
          borderRadius: 8,
          border: `2px solid ${selectedView.color}`,
          textAlign: 'center'
        }}>
          <div style={{ 
            fontSize: 14, 
            color: selectedView.color, 
            fontWeight: 600,
            marginBottom: 4
          }}>
            📊 {selectedView.nameFr}
          </div>
          <div style={{ 
            fontSize: 12, 
            color: '#666',
            fontWeight: 500
          }}>
            {isQuartier 
              ? 'Moyenne pondérée de tous les SUs du quartier'
              : `${selectedView.total} réponses dans ce secteur urbain`
            }
          </div>
        </div>
      </div>
    </div>
  )
}