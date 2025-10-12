'use client'

import React, { useState, useEffect } from 'react'
import { getDpSuTitleResult } from '~/lib/datapacks/DpSuTitle'
import type { SuTitleResult } from '~/lib/datapacks/DpSuTitle'

// Props for the component
type Props = {
  selectedSus?: number[]
}

export default function DvSuTitle({ selectedSus }: Props) {
  const [payload, setPayload] = useState<SuTitleResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await getDpSuTitleResult(selectedSus)
        setPayload(result)
      } catch (err) {
        console.error('Error loading SU title data:', err)
        setError('Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [selectedSus])

  if (loading) {
    return (
      <div className="w-full h-auto flex items-center overflow-hidden p-4 bg-white rounded-xl shadow-md border-2 border-gray-200">
        <div className="animate-pulse flex items-center w-full">
          <div className="w-12 h-12 bg-gray-200 rounded-lg mr-4"></div>
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-2 bg-gray-200 rounded w-full"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !payload) {
    return (
      <div className="w-full h-auto flex items-center overflow-hidden p-4 bg-white rounded-xl shadow-md border-2 border-red-200">
        <div className="text-red-600 text-sm">
          {error ?? 'Aucune donnée disponible'}
        </div>
      </div>
    )
  }

  const { selectedView, warnings = [] } = payload

  if (!selectedView) {
    return (
      <div className="w-full h-auto flex items-center overflow-hidden p-4 bg-white rounded-xl shadow-md border-2 border-gray-200">
        <div className="text-gray-500 text-sm">
          Aucune donnée disponible
        </div>
      </div>
    )
  }

  const isQuartier = selectedView.suId === null
  const barWidth = 200 // Fixed width for the progress bar

  return (
    <div 
      className="w-full h-auto flex items-center overflow-hidden p-4 bg-white rounded-xl shadow-md border-2"
      style={{ borderColor: selectedView.color || '#e1e5e9' }}
    >
      {/* Ornement à gauche */}
      <div className="mr-4 shrink-0 w-12 h-12 flex items-center justify-center">
        {selectedView.ornament ? (
          <div 
            dangerouslySetInnerHTML={{ __html: selectedView.ornament }}
            className="w-12 h-12 flex items-center justify-center opacity-80"
          />
        ) : (
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
            style={{ backgroundColor: selectedView.color + '20' }}
          >
            {isQuartier ? '🏘️' : '📍'}
          </div>
        )}
      </div>

      {/* Contenu principal */}
      <div className="flex-1 min-w-0">
        {/* Ligne 1: Sphère d'Usages (petit) */}
        <div className="text-xs text-gray-500 mb-1">
          {isQuartier 
            ? 'Quartier'
            : `Sphère d'Usages n°${selectedView.suNumber}`
          }
        </div>

        {/* Ligne 2: Nom de la SU (gros) */}
        <div 
          className="text-lg font-semibold mb-2"
          style={{ color: selectedView.color }}
        >
          {selectedView.nameFr}
        </div>

        {/* Ligne 3: Mini-graph barre horizontale */}
        <div className="flex items-center gap-3 mb-1">
          {/* Barre de progression */}
          <div 
            className="h-2.5 bg-gray-200 rounded-full relative overflow-hidden"
            style={{ width: barWidth }}
          >
            <div 
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${selectedView.popPercentage}%`,
                backgroundColor: selectedView.color
              }}
            />
          </div>
          
          {/* Pourcentage */}
          <div 
            className="text-sm font-medium"
            style={{ color: selectedView.color }}
          >
            {selectedView.popPercentage.toFixed(1)}%
          </div>
        </div>

        {/* Text explicatif sous la barre */}
        <div className="text-xs text-gray-500">
          Part de la population totale
        </div>
      </div>

      {/* Warnings (si nécessaire) */}
      {warnings.length > 0 && (
        <div className="ml-3 p-1.5 bg-yellow-100 rounded text-yellow-800 text-xs">
          ⚠️ {warnings.length} warning(s)
        </div>
      )}
    </div>
  )
}