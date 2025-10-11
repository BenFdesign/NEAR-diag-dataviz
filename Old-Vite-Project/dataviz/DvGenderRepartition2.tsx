import React, { useRef } from 'react'
import { getDpGenderRepartitionResult, type GenderRepartitionResult } from '../datapacks/DpGenderRepartition'

// Support both legacy data prop and new selectedSus prop
type Props = {
  data?: string | GenderRepartitionResult
  selectedSus?: number[]
}

/**
 * DvGenderRepartition2 - Responsive Gender Repartition component following CSS Grid rules
 * Grid CSS defines size, Dv fills the space with proper responsive scaling
 */
export default function DvGenderRepartition2({ data, selectedSus }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get data - support both new selectedSus and legacy data prop
  let genderResult: GenderRepartitionResult | null = null;
  
  if (selectedSus !== undefined) {
    // New approach - get data directly from datapack
    genderResult = getDpGenderRepartitionResult(selectedSus);
  } else if (data) {
    // Legacy approach - parse provided data
    if (typeof data === 'string') {
      try {
        genderResult = JSON.parse(data) as GenderRepartitionResult;
      } catch {
        console.error('Failed to parse gender data JSON');
      }
    } else {
      genderResult = data;
    }
  }


  // Container takes 100% of parent dimensions
  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.2em',
    padding: '0.8em',
    backgroundColor: '#ffffff',
    borderRadius: '0.4em',
    boxShadow: '0 0.1em 0.4em rgba(0, 0, 0, 0.1)',
    border: `0.1em solid ${genderResult?.color || '#e1e5e9'}`,
    boxSizing: 'border-box',
    overflow: 'hidden'
  }

  // Responsive gender row style
  const genderRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.3em',
    color: genderResult?.color || '#6c757d',
    fontSize: '0.8em',
    fontWeight: '600',
    width: '100%',
    lineHeight: 1.2
  }

  const emojiStyle: React.CSSProperties = {
    fontSize: '1.2em',
    flexShrink: 0
  }

  const percentageStyle: React.CSSProperties = {
    fontSize: '0.9em',
    fontWeight: '700',
    flexShrink: 0
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.7em',
    fontWeight: '500',
    color: '#6c757d',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    textAlign: 'left'
  }

  // Validation - check if we have data
  if (!genderResult || !genderResult.data || genderResult.data.length === 0) {
    return (
      <div ref={containerRef} style={containerStyle}>
        <div style={{ 
          color: '#6c757d', 
          fontSize: '0.6em',
          textAlign: 'center'
        }}>
          Aucune donnée disponible
        </div>
      </div>
    )
  }

  // Process gender data from the new format
  const genderData = genderResult.data;
  const totalCount = genderData.reduce((sum, item) => sum + item.count, 0);
  
  if (totalCount === 0) {
    return (
      <div ref={containerRef} style={containerStyle}>
        <div style={{ 
          color: '#6c757d', 
          fontSize: '0.6em',
          textAlign: 'center'
        }}>
          Aucune réponse trouvée
        </div>
      </div>
    )
  }

  // Map data to expected format
  const womenData = genderData.find(item => item.value === 'WOMAN' || item.label.toLowerCase().includes('femme'));
  const menData = genderData.find(item => item.value === 'MAN' || item.label.toLowerCase().includes('homme'));
  const otherData = genderData.find(item => !['WOMAN', 'MAN'].includes(item.value));

  return (
    <div ref={containerRef} style={containerStyle}>
      {/* Women percentage */}
      {womenData && (
        <div style={genderRowStyle}>
          <span style={emojiStyle}>{womenData.emoji}</span>
          <span style={percentageStyle}>{womenData.percentage.toFixed(1)}%</span>
          <span style={labelStyle}>{womenData.label}</span>
        </div>
      )}

      {/* Men percentage */}
      {menData && (
        <div style={genderRowStyle}>
          <span style={emojiStyle}>{menData.emoji}</span>
          <span style={percentageStyle}>{menData.percentage.toFixed(1)}%</span>
          <span style={labelStyle}>{menData.label}</span>
        </div>
      )}

      {/* Other percentage - only show if significant */}
      {otherData && otherData.percentage > 0.1 && (
        <div style={genderRowStyle}>
          <span style={emojiStyle}>{otherData.emoji}</span>
          <span style={percentageStyle}>{otherData.percentage.toFixed(1)}%</span>
          <span style={labelStyle}>{otherData.label}</span>
        </div>
      )}
    </div>
  )
}