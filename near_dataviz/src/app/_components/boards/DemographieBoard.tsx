// Demographie Board - Age, CSP, genre des échantillons par SU + données INSEE pour le quartier
import { DvAgeDistribution } from '../'
import { DvGenre } from '../'
import { DvCsp } from '../'
import type { Board } from '~/lib/types'

export const DemographieBoard: Board = {
  id: 'demographie',
  name: 'Démographie',
  emoji: '📊',
  description: 'Découvrir la composition sociologique du quartier : âges, catégories socio-professionnelles et genre',
  renderComponent: ({ selectedSus }: {
    selectedSus?: number[]
  }) => (
    <div className="demographie-board">
      <header className="board-header">
        <h2 className="board-title">
          {DemographieBoard.emoji} {DemographieBoard.name}
        </h2>
        <p className="board-subtitle">
          {DemographieBoard.description}
        </p>
      </header>
      
      {/* CSS Grid Layout for multiple Dv components */}
      <div className="board-grid">
        {/* Row 1: Dv Titre (30%) | Empty (30%) | Dv Genre (30%) */}
        <div className="dv-container title-dist">
          {/* TODO: Implement DvTitre component */}
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            DvTitre (à implémenter)
          </div>
        </div>
        
        <div className="dv-container empty-dist">
          {/* Empty */}
        </div>
        
        <div className="dv-container genre-dist">
          <DvGenre 
            selectedSus={selectedSus}
            containerWidth={300}
            containerHeight={250}
          />
        </div>

        {/* Row 2: Dv Âge (35% spanning 2 cols) | DvCsp (65%) */}
        <div className="dv-container age-dist">
          <DvAgeDistribution 
            selectedSus={selectedSus}
            containerWidth={400}
            containerHeight={250}
          />
        </div>

        <div className="dv-container csp-dist">
          <DvCsp 
            selectedSus={selectedSus}
            containerWidth={590}
            containerHeight={250}
          />
        </div>

        {/* Row 3: Espace vide (35% spanning 2 cols) | DvUsages (65%) */}
        <div className="dv-container space-dist">
          {/* Empty */}
        </div>

        <div className="dv-container usages-dist">
          {/* TODO: Implement DvUsages component */}
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            DvUsages (à implémenter)
          </div>
        </div>
      </div>
    </div>
  )
}

export default DemographieBoard