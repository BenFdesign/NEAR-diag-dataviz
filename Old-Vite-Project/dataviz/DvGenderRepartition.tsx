import React, { useMemo } from 'react'

type GenderStats = {
  women: {
    count: number
    percentage: number
    emoji: string
    label: string
  }
  men: {
    count: number
    percentage: number
    emoji: string
    label: string
  }
  other: {
    count: number
    percentage: number
    emoji: string
    label: string
  }
  total: number
}

type PayloadData = {
  id?: string
  version?: string
  genderStats?: GenderStats
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
}

export default function DvGenderRepartition({ data }: Props) {
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

  const { genderStats, selectedView, warnings = [] } = payload

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '16px 20px',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    border: `2px solid ${selectedView?.color || '#e1e5e9'}`
  }

  // Shared style for gender rows
  const genderRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: selectedView?.color || '#6c757d',
    fontSize: 16,
    fontWeight: 600
  }

  const emojiStyle: React.CSSProperties = {
    fontSize: 20
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 500,
    color: '#6c757d'
  }

  if (!genderStats || !selectedView) {
    return (
      <div style={containerStyle}>
        <div style={{ color: '#6c757d', fontSize: 14 }}>
          Aucune donnée de répartition par genre disponible
        </div>
      </div>
    )
  }

  if (genderStats.total === 0) {
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

  return (
    <div style={containerStyle}>
      {/* Women percentage */}
      <div style={genderRowStyle}>
        <span style={emojiStyle}>{genderStats.women.emoji}</span>
        <span>{genderStats.women.percentage.toFixed(1)}%</span>
        <span style={labelStyle}>{genderStats.women.label}</span>
      </div>

      {/* Men percentage */}
      <div style={genderRowStyle}>
        <span style={emojiStyle}>{genderStats.men.emoji}</span>
        <span>{genderStats.men.percentage.toFixed(1)}%</span>
        <span style={labelStyle}>{genderStats.men.label}</span>
      </div>

      {/* Other percentage */}
      <div style={genderRowStyle}>
        <span style={emojiStyle}>{genderStats.other.emoji}</span>
        <span>{genderStats.other.percentage.toFixed(1)}%</span>
        <span style={labelStyle}>{genderStats.other.label}</span>
      </div>

      {/* Total count info - COMMENTED OUT per user request */}
      {/* 
      <div style={{
        marginTop: 8,
        fontSize: 11,
        color: '#888',
        fontStyle: 'italic'
      }}>
        Basé sur {genderStats.total} réponse{genderStats.total > 1 ? 's' : ''} d'enquête
      </div>
      */}

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