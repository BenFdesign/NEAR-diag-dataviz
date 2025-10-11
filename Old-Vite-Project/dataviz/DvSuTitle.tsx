import React, { useMemo } from 'react'
import { getDpSuTitleResult } from '../datapacks/DpSuTitle'

// Legacy interface for backward compatibility
type PayloadData = {
  id?: string
  version?: string
  selectedView?: {
    suId: number | null
    suNumber: number | null
    nameFr: string
    color: string
    ornament: string
    popPercentage: number
    totalPopulation: number
  }
  warnings?: Array<{
    type: string
    message: string
    suId?: number
  }>
}

// Support both legacy data prop and new selectedSus prop
type Props = {
  data?: string | PayloadData
  selectedSus?: number[]
}

export default function DvSuTitle({ data, selectedSus }: Props) {
  const payload = useMemo(() => {
    // If new selectedSus prop is provided, use it directly with the datapack
    if (selectedSus !== undefined) {
      return getDpSuTitleResult(selectedSus);
    }
    
    // Otherwise, use legacy data prop
    if (typeof data === 'string') {
      try {
        return JSON.parse(data) as PayloadData
      } catch {
        return {}
      }
    }
    return data || {}
  }, [data, selectedSus])

  const { selectedView, warnings = [] } = payload

  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: 'auto',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
    padding: '16px 20px',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    border: `2px solid ${selectedView?.color || '#e1e5e9'}`
  }

  if (!selectedView) {
    return (
      <div style={containerStyle}>
        <div style={{ color: '#6c757d', fontSize: 14 }}>
          Aucune donnée disponible
        </div>
      </div>
    )
  }

  const isQuartier = selectedView.suId === null
  const barWidth = Math.min(200, 150) // Maximum 200px width for the mini bar

  return (
    <div style={containerStyle}>
      {/* Ornement à gauche */}
      <div style={{ 
        marginRight: 16, 
        flexShrink: 0,
        width: 48,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {selectedView.ornament ? (
          <div 
            dangerouslySetInnerHTML={{ __html: selectedView.ornament }}
            style={{ 
              width: 48, 
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.8
            }}
          />
        ) : (
          <div style={{
            width: 48,
            height: 48,
            backgroundColor: selectedView.color + '20',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24
          }}>
            {isQuartier ? '🏘️' : '📍'}
          </div>
        )}
      </div>

      {/* Contenu principal */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Ligne 1: Sphère d'Usages (petit) */}
        <div className="dv-label-sphere dv-text-secondary">
          {isQuartier 
            ? 'Quartier'
            : `Sphère d'Usages n°${selectedView.suNumber}`
          }
        </div>

        {/* Ligne 2: Nom de la SU (gros) */}
        <div 
          className="dv-title-su"
          style={{ color: selectedView.color }}
        >
          {selectedView.nameFr}
        </div>

        {/* Ligne 3: Mini-graph barre horizontale */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Barre de progression */}
          <div style={{
            width: barWidth,
            height: 10,
            backgroundColor: '#e9ecef',
            borderRadius: 5,
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${selectedView.popPercentage}%`,
              height: '100%',
              backgroundColor: selectedView.color,
              borderRadius: 5,
              transition: 'width 0.3s ease'
            }} />
          </div>
          
          {/* Pourcentage */}
          <div 
            className="dv-percentage"
            style={{ color: selectedView.color }}
          >
            {selectedView.popPercentage.toFixed(1)}%
          </div>
        </div>

        {/* Text explicatif sous la barre */}
        <div className="dv-description dv-text-muted">
          Part de la population totale
        </div>
      </div>

      {/* Warnings (si nécessaire) */}
      {warnings.length > 0 && (
        <div className="dv-warning-text" style={{
          marginLeft: 12,
          padding: 6,
          backgroundColor: '#fff3cd',
          borderRadius: 4,
          color: '#856404'
        }}>
          ⚠️ {warnings.length} warning(s)
        </div>
      )}
    </div>
  )
}