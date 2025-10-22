import React from 'react'
import type { Board } from '~/lib/types'
import { DvEmdvSatisfactionsByCategory } from '../'

// Central list of EMDV subcategories we support as individual boards
const EMDV_SUBCATEGORIES: Array<{ key: string; name: string; emoji: string }> = [
  { key: 'Food', name: 'Alimentation', emoji: '🍽️' },
  { key: 'Politics', name: 'Politique', emoji: '🏛️' },
  { key: 'NghLife', name: 'Vie de quartier', emoji: '🏘️' },
  { key: 'Services', name: 'Services', emoji: '🏪' },
  { key: 'Mobility', name: 'Mobilité', emoji: '🚌' },
  { key: 'Housing', name: 'Logement', emoji: '🏠' },
]

export const EmdvByCategoryBoards: Board[] = EMDV_SUBCATEGORIES.map((cat) => ({
  id: `EMDV_${cat.key}`,
  name: `Avis sur ${cat.name}`,
  emoji: cat.emoji,
  description: `Satisfactions et insatisfactions pour la sous-catégorie « ${cat.name} »`,
  renderComponent: ({ selectedSus }: { selectedSus?: number[] }) => (
    <div className="other-board">
      <header className="board-header">
        <h2 className="board-title">
          {cat.emoji} Avis sur le cadre de vie - {cat.name}
        </h2>
        <p className="board-subtitle">
          Répartition entre 🟥 Avis négatifs, 🔲Pas d&apos;avis et 🟩 Avis positifs, pour différentes questions liées au thème {cat.name}.
        </p>
      </header>

      <div className="dv-container" style={{ height: 520 }}>
        <DvEmdvSatisfactionsByCategory selectedSus={selectedSus} category={cat.key} />
      </div>
    </div>
  )
}))

export default EmdvByCategoryBoards
