import React, { useMemo } from 'react'

type AgeCategory = {
  key: string
  label: string
  shortLabel: string
  count: number
  percentage: number
  midpoint: number
}

type AgeDistribution = {
  categories: AgeCategory[]
  total: number
  maxCount: number
  maxPercentage: number
}

type PayloadData = {
  id?: string
  version?: string
  ageDistribution?: AgeDistribution
  selectedView?: {
    suIds: number[]
    color: string
    isQuartier: boolean
  }
  warnings?: Array<{
    type: string
    message: string
  }>
}

type Props = {
  data: string | PayloadData
  width?: number
  height?: number
}

export default function DvAgeDistribution({ data, width = 320, height = 180 }: Props) {
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

  const { ageDistribution, selectedView, warnings = [] } = payload

  // Chart dimensions
  const chartWidth = width
  const chartHeight = height
  const padding = { top: 20, right: 20, bottom: 40, left: 0 } // Léger padding à droite pour centrer, le centrage est fait par les labels en bas.
  const plotWidth = chartWidth - padding.left - padding.right
  const plotHeight = chartHeight - padding.top - padding.bottom

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '16px 20px',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    border: `2px solid ${selectedView?.color || '#e1e5e9'}`
  }

  if (!ageDistribution || !selectedView) {
    return (
      <div style={containerStyle}>
        <div style={{ color: '#6c757d', fontSize: 14 }}>
          Aucune donnée de distribution par âge disponible
        </div>
      </div>
    )
  }

  if (ageDistribution.total === 0) {
    return (
      <div style={containerStyle}>
        <div style={{ color: '#6c757d', fontSize: 14 }}>
          Aucune réponse d'enquête trouvée
        </div>
        {warnings.length > 0 && (
          <div style={{
            marginTop: 8,
            padding: 8,
            backgroundColor: '#fff3cd',
            borderRadius: 4,
            color: '#856404',
            fontSize: 12
          }}>
            ⚠️ {warnings[0].message}
          </div>
        )}
      </div>
    )
  }

  // Create smooth curve path
  const createSmoothPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length < 2) return ''
    
    let path = `M ${points[0].x} ${points[0].y}`
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      
      // Calculate control points for smooth curve
      const cpx1 = prev.x + (curr.x - prev.x) * 0.3
      const cpx2 = curr.x - (curr.x - prev.x) * 0.3
      
      path += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`
    }
    
    return path
  }

  // Create smooth area path (curves to baseline)
  const createSmoothAreaPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length < 2) return ''
    
    const baseline = chartHeight - padding.bottom
    const leftX = points[0].x
    const rightX = points[points.length - 1].x
    
    // Start from bottom-left
    let path = `M ${leftX} ${baseline}`
    
    // Curve up to first point
    path += ` C ${leftX} ${baseline}, ${leftX} ${points[0].y}, ${points[0].x} ${points[0].y}`
    
    // Create the main curve
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      
      // Calculate control points for smooth curve
      const cpx1 = prev.x + (curr.x - prev.x) * 0.3
      const cpx2 = curr.x - (curr.x - prev.x) * 0.3
      
      path += ` C ${cpx1} ${prev.y}, ${cpx2} ${curr.y}, ${curr.x} ${curr.y}`
    }
    
    // Curve down to bottom-right
    path += ` C ${rightX} ${points[points.length - 1].y}, ${rightX} ${baseline}, ${rightX} ${baseline}`
    
    // Close the path
    path += ' Z'
    
    return path
  }

  // Calculate coordinates for data points
  const minAge = 15
  const maxAge = 85
  const ageRange = maxAge - minAge
  
  const dataPoints = ageDistribution.categories.map(category => {
    const x = (category.midpoint - minAge) / ageRange * plotWidth
    const y = padding.top + (1 - category.percentage / ageDistribution.maxPercentage) * plotHeight
    
    return {
      x,
      y,
      category,
      percentage: category.percentage
    }
  })

  const linePath = createSmoothPath(dataPoints)

  // Create smooth area under curve
  const areaPath = createSmoothAreaPath(dataPoints)

  return (
    <div style={containerStyle}>
      {/* Title */}
      <div className="dv-title-main" style={{ color: selectedView.color }}>
        Distribution par âge
      </div>

      {/* SVG Chart */}
      <svg width={chartWidth} height={chartHeight} style={{ overflow: 'visible' }}>
        {/* Area under curve */}
        <path
          d={areaPath}
          fill={selectedView.color}
          fillOpacity={0.1}
        />

        {/* Main curve line */}
        <path
          d={linePath}
          fill="none"
          stroke={selectedView.color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {dataPoints.map((point) => (
          <g key={point.category.key}>
            {/* Point circle */}
            <circle
              cx={point.x}
              cy={point.y}
              r={5}
              fill={selectedView.color}
              stroke="#ffffff"
              strokeWidth={2}
            />
            
            {/* Age label */}
            <text
              x={point.x}
              y={chartHeight - padding.bottom + 20}
              textAnchor="middle"
              className="dv-axis-label"
              fill="#6c757d"
            >
              {point.category.shortLabel}
            </text>
            
            {/* Percentage label above point */}
            {point.percentage > 0 && (
              <text
                x={point.x}
                y={point.y - 12}
                textAnchor="middle"
                className="dv-percentage"
                fill={selectedView.color}
                fontSize={11}
                fontWeight={600}
              >
                {point.percentage.toFixed(1)}%
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Warnings (if any) */}
      {warnings.length > 0 && (
        <div style={{
          marginTop: 8,
          padding: 8,
          backgroundColor: '#fff3cd',
          borderRadius: 4,
          color: '#856404',
          fontSize: 11
        }}>
          ⚠️ {warnings.length} avertissement(s)
        </div>
      )}
    </div>
  )
}