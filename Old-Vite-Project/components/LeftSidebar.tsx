import type { SuInfo } from '../types'
import { getQuartierName, getQuartierPopulation } from '../services/suService'

type LeftSidebarProps = {
  availableSus: SuInfo[]
  selectedSus: number[]
  onSusChange: (sus: number[]) => void
}

export default function LeftSidebar({ availableSus, selectedSus, onSusChange }: LeftSidebarProps) {
  // For single select mode, get the currently selected SU (or null for quartier)
  const currentSelection = selectedSus.length === 1 ? selectedSus[0] : null
  const isQuartierSelected = selectedSus.length === 0 || selectedSus.length === availableSus.length
  const quartierName = getQuartierName()
  const quartierPopulation = getQuartierPopulation()

  const handleSuSelect = (suNumber: number) => {
    onSusChange([suNumber])
  }

  const handleQuartierSelect = () => {
    onSusChange(availableSus.map(su => su.su)) // Quartier = sélectionner toutes les SUs.
  }

  return (
    <aside style={{
      width: 240,
      backgroundColor: '#6e6eb9ff',
      borderRight: '1px solid #6e6eb9ff',
      height: '100%',
      position: 'sticky',
      top: 0, // Height du top menu
      overflow: 'auto'
    }}>
      <div style={{ padding: 20 }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h3 className='menu-main-title'>
          🔍 Sur qui souhaitez-vous découvrir des choses ?
          </h3>
          <p style={{ 
            margin: 0, 
            fontSize: 13, 
            color: '#ffffffff' 
          }}>
            Vous pouvez découvrir le diag' NEAR 2025 du quartier {quartierName} au complet, ou découvrir les résultats pour les différentes Sphères d'Usages.<br />
            Une Sphère d'Usages, ou "SU", est un groupe de la population locale qui partage des habitudes quotidiennes proches. Il y en a {availableSus.length} dans ce quartier. Chaque SU portent un nom d'élément naturel (fruit, minéral, plante). À vous de les explorer et de découvrir ce qu'elles ont à dire sur le quartier !
          </p>
        </div>


        {/* ========================================== */}


        {/* Bouton Quartier avec même style que les SU */}
        <div
          onClick={handleQuartierSelect}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 14px',
            backgroundColor: isQuartierSelected ? '#002878' : 'white',
            border: `2px solid ${isQuartierSelected ? '#e1e5e9' : '#002878'}`,
            //filter: 'blur(0px)',
            borderRadius: 15,
            cursor: 'pointer',
            transition: 'all 0.5s',
            position: 'relative',
            marginBottom: 8
          }}
          onMouseEnter={(e) => {
            if (!isQuartierSelected) {
              e.currentTarget.style.borderColor = '#002878'
              e.currentTarget.style.backgroundColor = '#002878' + '08'
              //e.currentTarget.style.backgroundColor = `${su.color}08`
              //e.currentTarget.style.filter = 'blur(0.8px)'
            }
          }}
          onMouseLeave={(e) => {
            if (!isQuartierSelected) {
              e.currentTarget.style.borderColor = '#002878'
              e.currentTarget.style.backgroundColor = 'white'
              //e.currentTarget.style.filter = 'blur(0px)'
            }
          }}
        >
          {/* Radio button */}
          {/*<div style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            backgroundColor: isQuartierSelected ? '#002878' : 'transparent',
            border: `2px solid ${isQuartierSelected ? '#002878' : '#dee2e6'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {isQuartierSelected && (
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'white'
              }} />
            )}
          </div>*/}

          {/* Icône */}
          <div style={{ 
            width: 24, 
            height: 24, 
            flexShrink: 0,
            fontSize: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            🏘️
          </div>

          {/* Infos Quartier */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: isQuartierSelected ? 'white' : '#002878',
              marginBottom: 2
            }}>
              {quartierName}
            </div>
            <div style={{
              fontSize: 11,
              color: isQuartierSelected ? 'white' : '#002878',
              //display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <span>Tout le quartier • 100%</span> <br />
              <span>~{quartierPopulation} habitant·es</span>
            </div>
          </div>

          {/* Indicateur de sélection */}
          {isQuartierSelected && (
            <div style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 12,
              height: 12,
              backgroundColor: '#002878',
              borderRadius: '50%',
              border: '2px solid white'
            }} />
          )}
        </div>

        {/* Boutons SUs individuelles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {availableSus.map((su) => {
            const isSelected = currentSelection === su.su
            
            return (
              <div
                key={su.id}
                onClick={() => handleSuSelect(su.su)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  backgroundColor: isSelected ? su.color : 'white',
                  border: `2px solid ${isSelected ? '#e1e5e9' : su.color}`,
                  borderRadius: 15,
                  cursor: 'pointer',
                  transition: 'all 0.5s',
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
                {/* Radio button */}
                {/*<div style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  backgroundColor: isSelected ? su.color : 'transparent',
                  border: `2px solid ${isSelected ? su.color : '#6e6eb9ff'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {isSelected && (
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: 'white'
                    }} />
                  )}
                </div>
                */}

                {/* Icône */}
                <div 
                  dangerouslySetInnerHTML={{ __html: su.icon }}  //à rechecker
                  style={{ 
                    width: 24, 
                    height: 24, 
                    flexShrink: 0,
                    //filter: isSelected ? su.color : su.color
                    filter: isSelected ? 'invert(1)' : 'grayscale(0.5)'
                  }} 
                />

                {/* Infos Su */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: isSelected ? 'white' : su.color,
                    marginBottom: 2
                  }}>
                    {su.name}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: isSelected ? 'white' : su.color,
                    //display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <span>SU n°{su.su} • {su.popPercentage.toFixed(1)}%</span><br />
                    <span>~{su.realPopulation} habitant·es</span>
                  </div>  
                </div>

                {/* 🟢 Indicateur de sélection */}
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

        {/* Current Selection Summary */}
        {/*<div style={{
          marginTop: 20,
          padding: 12,
          backgroundColor: isQuartierSelected ? '#e3f2fd' : '#f3e5f5',
          borderRadius: 6,
          border: `1px solid ${isQuartierSelected ? '#bbdefb' : '#ce93d8'}`
        }}>
          <div style={{ 
            fontSize: 12, 
            color: isQuartierSelected ? '#1976d2' : '#7b1fa2', 
            fontWeight: 600 
          }}>
            {isQuartierSelected ? `🏘️ Vue ${quartierName.toLowerCase()}` : '🎯 Vue SU individuel'}
          </div>
          <div style={{ 
            fontSize: 11, 
            color: isQuartierSelected ? '#1565c0' : '#6a1b9a', 
            marginTop: 4 
          }}>
            {isQuartierSelected 
              ? `Affichage global du ${quartierName.toLowerCase()}` 
              : `SU ${currentSelection} sélectionné`
            }
          </div>
        </div>*/}
      </div>
    </aside>
  )
}