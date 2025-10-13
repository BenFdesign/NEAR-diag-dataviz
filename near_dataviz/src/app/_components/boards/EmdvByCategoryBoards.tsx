import React from 'react'
import type { Board } from '~/lib/types'
import { DvEmdvSatisfactionsByCategory } from '../'

// Central list of EMDV subcategories we support as individual boards
const EMDV_SUBCATEGORIES: Array<{ key: string; name: string; emoji: string }> = [
  { key: 'Food', name: 'Alimentation', emoji: '🍽️' },
  { key: 'FoodStores', name: 'Magasins alimentaires', emoji: '🛒' },
  { key: 'Politics', name: 'Politique', emoji: '🏛️' },
  { key: 'NghLife', name: 'Vie de quartier', emoji: '🏘️' },
  { key: 'Solidarity', name: 'Solidarité', emoji: '🤝' },
  { key: 'Services', name: 'Services', emoji: '🏢' },
  { key: 'Mobility', name: 'Mobilité', emoji: '🚌' },
  { key: 'Housing', name: 'Logement', emoji: '🏠' },
  { key: 'Parks', name: 'Parcs et espaces verts', emoji: '🌳' },
  { key: 'Shopping', name: 'Commerces', emoji: '🛍️' },
  { key: 'General', name: 'Général', emoji: '🌟' },
]

export const EmdvByCategoryBoards: Board[] = EMDV_SUBCATEGORIES.map((cat) => ({
  id: `EMDV_${cat.key}`,
  name: `Avis EMDV – ${cat.name}`,
  emoji: cat.emoji,
  description: `Satisfactions EMDV pour la sous-catégorie « ${cat.name} »`,
  renderComponent: ({ selectedSus }: { selectedSus?: number[] }) => (
    <div className="other-board">
      <header className="board-header">
        <h2 className="board-title">
          {cat.emoji} Avis sur le cadre de vie – {cat.name}
        </h2>
        <p className="board-subtitle">
          Répartition Oui / Non / Pas d&apos;avis par question – vue {(!selectedSus || selectedSus.length !== 1) ? 'quartier (moyenne pondérée)' : 'SU (moyenne)'}
        </p>
      </header>

      <div className="dv-container" style={{ height: 520 }}>
        <DvEmdvSatisfactionsByCategory selectedSus={selectedSus} category={cat.key} />
      </div>
    </div>
  )
}))

export default EmdvByCategoryBoards
