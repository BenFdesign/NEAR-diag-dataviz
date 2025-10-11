'use client'

import { useState, useEffect } from 'react'
import type { SuInfo } from '~/lib/types'
import { getQuartierName, getQuartierPopulation } from '~/lib/su-service'

type LeftSidebarProps = {
  availableSus: SuInfo[]
  selectedSus: number[]
  onSusChange: (sus: number[]) => void
}

export default function LeftSidebar({ availableSus, selectedSus, onSusChange }: LeftSidebarProps) {
  const [quartierName, setQuartierName] = useState<string>('Quartier')
  const [quartierPopulation, setQuartierPopulation] = useState<number>(0)

  // Menu sélection SU en mode sélection unique (pas de sélection multiple), obtenir le SU actuellement sélectionné (ou null pour le quartier).
  const currentSelection = selectedSus.length === 1 ? selectedSus[0] : null
  const isQuartierSelected = selectedSus.length === 0 || selectedSus.length === availableSus.length

  useEffect(() => {
    const loadQuartierData = async () => {
      try {
        const [name, population] = await Promise.all([
          getQuartierName(),
          getQuartierPopulation()
        ])
        setQuartierName(name)
        setQuartierPopulation(population)
      } catch (error) {
        console.error('Error loading quartier data:', error)
      }
    }

    void loadQuartierData()
  }, [])

  const handleSuSelect = (suNumber: number) => {
    onSusChange([suNumber])
  }

  const handleQuartierSelect = () => {
    onSusChange(availableSus.map(su => su.su)) // Quartier = sélectionner toutes les SUs.
  }

  return (
    <aside className="w-60 bg-[#6e6eb9ff] border-r border-[#6e6eb9ff] h-full sticky top-0 overflow-auto">
      <div className="p-5">
        {/* Header */}
        <div className="mb-5">
          <h3 className="menu-main-title">
            🔍 Sur qui souhaitez-vous découvrir des choses ?
          </h3>
          <p className="menu-p">
            Vous pouvez découvrir le diag&apos; NEAR 2025 du quartier {quartierName} au complet, ou découvrir les résultats pour les différentes Sphères d&apos;Usages.<br />
            Une Sphère d&apos;Usages, ou &quot;SU&quot;, est un groupe de la population locale qui partage des habitudes quotidiennes proches. Il y en a {availableSus.length} dans ce quartier. Chaque SU portent un nom d&apos;élément naturel (fruit, minéral, plante). À vous de les explorer et de découvrir ce qu&apos;elles ont à dire sur le quartier !
          </p>
        </div>

        {/* Bouton Quartier avec même style que les SU */}
        <div
          onClick={handleQuartierSelect}
          className={`
            flex items-center gap-3 px-3.5 py-3 rounded-2xl cursor-pointer 
            transition-all duration-500 relative mb-2 border-2
            ${isQuartierSelected 
              ? 'bg-[#002878] text-white border-gray-200' 
              : 'bg-white text-[#002878] border-[#002878] hover:bg-[#002878]/8'
            }
          `}
        >
          {/* Icône */}
          <div className="w-6 h-6 flex-shrink-0 text-xl flex items-center justify-center">
            🏘️
          </div>

          {/* Infos Quartier */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold mb-0.5">
              {quartierName}
            </div>
            <div className="text-xs">
              <span>Tout le quartier • 100%</span> <br />
              <span>~{quartierPopulation} habitant·es</span>
            </div>
          </div>

          {/* Indicateur de sélection */}
          {isQuartierSelected && (
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#002878] rounded-full border-2 border-white" />
          )}
        </div>

        {/* Boutons SUs individuelles */}
        <div className="flex flex-col gap-2 mb-6">
          {availableSus.map((su) => {
            const isSelected = currentSelection === su.su
            
            return (
              <div
                key={su.id}
                onClick={() => handleSuSelect(su.su)}
                className={`
                  flex items-center gap-3 px-3.5 py-3 rounded-2xl cursor-pointer 
                  transition-all duration-500 relative border-2
                  ${isSelected 
                    ? 'text-white border-gray-200' 
                    : 'bg-white border-gray-200 hover:border-current'
                  }
                `}
                style={{
                  backgroundColor: isSelected ? su.color : 'white',
                  borderColor: isSelected ? '#e1e5e9' : su.color,
                  color: isSelected ? 'white' : su.color
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = `${su.color}08`
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'white'
                  }
                }}
              >
                {/* Icône, protection XSS avec une solution simple dans src/app/lib/icon-validator.ts passé à su-service.ts */}
                <div
                  dangerouslySetInnerHTML={{ __html: su.icon }}
                  className={`w-6 h-6 flex-shrink-0 ${isSelected ? 'invert' : 'grayscale-50'}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold mb-0.5">
                    {su.name}
                  </div>
                  <div className="text-xs">
                    <span>SU n°{su.su} • {su.popPercentage.toFixed(1)}%</span><br />
                    <span>~{su.realPopulation} habitant·es</span>
                  </div>  
                </div>

                {/* Indicateur de sélection */}
                {isSelected && (
                  <div 
                    className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                    style={{ backgroundColor: su.color }}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* Boutons d'action */}
        <div className="action-buttons-container">
          {/* Plus d'infos */}
          <button 
            onClick={() => {/* TODO: Ajouter pop-up modal infos quartier */}}
            className="action-button"
          >
            ℹ️ Plus d&apos;infos
          </button>

          {/* Quelle est ma SU */}
          <button 
            onClick={() => {/* TODO: Ajouter pop-up modal test Su */}}
            className="action-button"
          >
            🕵️‍♂️ Quelle est ma S.U. ?
          </button>

          {/* Sauvegarder */}
          <button 
            onClick={() => {/* TODO: Ajouter fonction png html2canvas */}}
            className="action-button"
          >
            📸 Sauvegarder
          </button>
        </div>
      </div>
    </aside>
  )
}