import React from 'react'
import type { Board } from '~/lib/types'
import { DvBarrierAggregated } from '../'

export const BarrierBoards: Board[] = [
  {
    id: 'BARRIERS_AGG',
    name: 'Barrières – Agrégées',
    emoji: '📊',
    description: 'Toutes les catégories de barrières, toutes questions confondues (inclut Autres)',
    renderComponent: ({ selectedSus }) => (
      <div className="other-board">
        <header className="board-header">
          <h2 className="board-title">📊 Barrières – Vue agrégée</h2>
          <p className="board-subtitle">% de répondants ayant coché une réponse dans chaque catégorie</p>
        </header>
        <div className="dv-container" style={{ height: 420 }}>
          <DvBarrierAggregated selectedSus={selectedSus} />
        </div>
      </div>
    ),
  },
]

export default BarrierBoards
