import React from 'react'
import type { Board } from '~/lib/types'
import { DvMobility } from '../'

export const MobilityBoard: Board = {
  id: 'Mobility',
  name: 'Mobilité',
  emoji: '🚲',
  description: 'Visualisation de la mobilité des répondants.',
  renderComponent: ({ selectedSus }: { selectedSus?: number[] }) => (
    <div className="other-board">
      <header className="board-header">
        <h2 className="board-title">{MobilityBoard.emoji} {MobilityBoard.name}</h2>
        <p className="board-subtitle">{MobilityBoard.description}</p>
      </header>
      <div style={{ height: 800 }}>
        <DvMobility selectedSus={selectedSus} />
      </div>
    </div>
  )
}

export default MobilityBoard
