import React from 'react'
import type { Board } from '~/lib/types'
import DvEmdvSatisfactionsPieCharts from '../dataviz/DvEmdvSatisfactionsPieCharts'

export const EmdvPieChartsBoard: Board = {
  id: 'EMDV_PIE_ALL',
  name: 'Avis sur le Cadre de vie',
  emoji: '👍',
  description: 'Vue d\'ensemble des avis sur le cadre de vie (format camemberts)',
  renderComponent: ({ selectedSus }: { selectedSus?: number[] }) => (
    <div className="other-board">
      <header className="board-header">
        <h2 className="board-title">👍 Les avis sur le cadre de vie</h2>
        <p className="board-subtitle">
          Répartition des avis par question — 🟥 Avis négatifs · ⬜ Pas d&apos;avis · 🟩 Avis positifs
        </p>
      </header>
      <div className="dv-container" style={{ height: 'auto', minHeight: 'unset', overflow: 'visible' }}>
        <DvEmdvSatisfactionsPieCharts selectedSus={selectedSus} />
      </div>
    </div>
  ),
}

export default EmdvPieChartsBoard
