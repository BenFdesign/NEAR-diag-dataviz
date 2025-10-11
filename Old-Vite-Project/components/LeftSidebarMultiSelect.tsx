import type { SuInfo } from '../types'

type LeftSidebarProps = {
  availableSus: SuInfo[]
  selectedSus: number[]
  onSusChange: (sus: number[]) => void
}

export default function LeftSidebarMultiSelect({ availableSus, selectedSus, onSusChange }: LeftSidebarProps) {
  
  const handleSuToggle = (suNumber: number) => {
    if (selectedSus.includes(suNumber)) {
      onSusChange(selectedSus.filter(su => su !== suNumber))
    } else {
      onSusChange([...selectedSus, suNumber])
    }
  }

  const handleSelectAll = () => {
    onSusChange(availableSus.map(su => su.su))
  }

  const handleDeselectAll = () => {
    onSusChange([])
  }

  return (
    <aside style={{
      width: 240,
      backgroundColor: '#f8f9fa',
      borderRight: '1px solid #e1e5e9',
      height: '100vh',
      position: 'sticky',
      top: 60, // Height of top menu
      overflow: 'auto'
    }}>
      <div style={{ padding: 20 }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ 
            margin: '0 0 8px 0', 
            fontSize: 16, 
            fontWeight: 600, 
            color: '#2c3e50' 
          }}>
            📍 Sélection des SUs
          </h3>
          <p style={{ 
            margin: 0, 
            fontSize: 12, 
            color: '#6c757d' 
          }}>
            Choisissez les Sphères d'Usages à afficher
          </p>
        </div>

        {/* Control Buttons */}
        <div style={{ 
          display: 'flex', 
          gap: 8, 
          marginBottom: 16 
        }}>
          <button
            onClick={handleSelectAll}
            style={{
              flex: 1,
              padding: '6px 10px',
              backgroundColor: selectedSus.length === availableSus.length ? '#e9ecef' : '#007bff',
              color: selectedSus.length === availableSus.length ? '#6c757d' : 'white',
              border: 'none',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 500,
              cursor: selectedSus.length === availableSus.length ? 'default' : 'pointer',
              transition: 'all 0.2s'
            }}
            disabled={selectedSus.length === availableSus.length}
          >
            Tout
          </button>
          <button
            onClick={handleDeselectAll}
            style={{
              flex: 1,
              padding: '6px 10px',
              backgroundColor: selectedSus.length === 0 ? '#e9ecef' : '#6c757d',
              color: selectedSus.length === 0 ? '#6c757d' : 'white',
              border: 'none',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 500,
              cursor: selectedSus.length === 0 ? 'default' : 'pointer',
              transition: 'all 0.2s'
            }}
            disabled={selectedSus.length === 0}
          >
            Aucun
          </button>
        </div>

        {/* SU List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {availableSus.map((su) => {
            const isSelected = selectedSus.includes(su.su)
            
            return (
              <div
                key={su.id}
                onClick={() => handleSuToggle(su.su)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  backgroundColor: isSelected ? `${su.color}15` : 'white',
                  border: `2px solid ${isSelected ? su.color : '#e1e5e9'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = su.color
                    e.currentTarget.style.backgroundColor = `${su.color}08`
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = '#e1e5e9'
                    e.currentTarget.style.backgroundColor = 'white'
                  }
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: 3,
                  backgroundColor: isSelected ? su.color : 'transparent',
                  border: `2px solid ${isSelected ? su.color : '#dee2e6'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {isSelected && (
                    <div style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
                      ✓
                    </div>
                  )}
                </div>

                {/* Icon */}
                <div 
                  dangerouslySetInnerHTML={{ __html: su.icon }} 
                  style={{ 
                    width: 24, 
                    height: 24, 
                    flexShrink: 0,
                    filter: isSelected ? 'none' : 'grayscale(0.5)'
                  }} 
                />

                {/* SU Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: isSelected ? su.color : '#2c3e50',
                    marginBottom: 2
                  }}>
                    {su.name}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: '#6c757d',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <span>SU {su.su}</span>
                    <span>•</span>
                    <span>{su.popPercentage.toFixed(1)}%</span>
                  </div>
                </div>

                {/* Selected indicator */}
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 12,
                    height: 12,
                    backgroundColor: su.color,
                    borderRadius: '50%',
                    border: '2px solid white'
                  }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Summary */}
        {selectedSus.length > 0 && (
          <div style={{
            marginTop: 20,
            padding: 12,
            backgroundColor: '#e3f2fd',
            borderRadius: 6,
            border: '1px solid #bbdefb'
          }}>
            <div style={{ fontSize: 12, color: '#1976d2', fontWeight: 600 }}>
              📊 {selectedSus.length} SU{selectedSus.length > 1 ? 's' : ''} sélectionnée{selectedSus.length > 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 11, color: '#1565c0', marginTop: 4 }}>
              {availableSus
                .filter(su => selectedSus.includes(su.su))
                .reduce((sum, su) => sum + su.popPercentage, 0)
                .toFixed(1)}% de la population totale
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}