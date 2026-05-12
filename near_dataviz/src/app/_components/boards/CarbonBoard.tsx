import React from 'react'
import type { Board } from '~/lib/types'
import DvCarbonStackedBars from '../dataviz/DvCarbonStackedBars'

export const CarbonBoard: Board = {
  id: 'CARBON_BARS',
  name: 'Empreinte carbone — bilan',
  emoji: '🌍',
  description: 'Bilan de l\'empreinte carbone par grande catégorie (barres empilées)',
  renderComponent: ({ selectedSus }: { selectedSus?: number[] }) => (
    <div className="other-board">
      <header className="board-header">
        <h2 className="board-title">🌍 Empreinte carbone — Bilan par catégorie</h2>
        <p className="board-subtitle">
          Empreinte moyenne par personne et par an, décomposée par sous-catégorie
        </p>
      </header>
      <div className="dv-container" style={{ height: 'auto', overflow: 'visible' }}>
        <DvCarbonStackedBars selectedSus={selectedSus} />
      </div>
    </div>
  ),
}

export default CarbonBoard
