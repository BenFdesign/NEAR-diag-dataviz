// Demographie Board - Age, CSP, genre des échantillons par SU + données INSEE pour le quartier
import { DvAgeDistribution } from '..'
import { DvGenre } from '..'
import { DvCsp } from '..'
import type { Board } from '~/lib/types'

export const FicheSuBoard: Board = {
  id: 'SU',
  name: 'Sphères d\'Usages',
  emoji: '🔮',
  description: 'Découvrir la sociologie et les grandes habitudes du quartier et des différentes S.U. : âges, catégories socio-professionnelles et genre',
  renderComponent: ({ selectedSus }: {
    selectedSus?: number[]
  }) => (
    <div className="demographie-board">
      <header className="board-header">
        <h2 className="board-title">
          {FicheSuBoard.emoji} {FicheSuBoard.name}
        </h2>
        <p className="board-subtitle">
          {FicheSuBoard.description}
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
          />
        </div>

        {/* Row 2: Dv Âge (35% spanning 2 cols) | DvCsp (65%) */}
        <div className="dv-container age-dist">
          <DvAgeDistribution 
            selectedSus={selectedSus}
          />
        </div>

        <div className="dv-container csp-dist">
          <DvCsp 
            selectedSus={selectedSus}
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

export default FicheSuBoard