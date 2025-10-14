// Mobility Board - Visualisation des données de mobilité par zone avec le mega graph
import type { Board } from '~/lib/types'


export const MobilityBoard: Board = {
  id: 'MOBILITY',
  name: 'La mobilité autour du quartier',
  emoji: '🚗',
  description: 'Découvrir les modes de transport et les destinations des habitant·es du quartier',
  renderComponent: ({ selectedSus }: { selectedSus?: number[] }) => {
    const suId = selectedSus?.[0]?.toString() ?? '';
    
    return (
      <div className="other-board">
        <header className="board-header">
          <h2 className="board-title">
            {MobilityBoard.emoji} {MobilityBoard.name}
          </h2>
          <p className="board-subtitle">
           {MobilityBoard.description}
          </p>
        </header>
        <div className="dv-container" style={{ height: 1200 }}>
        </div>
      </div>
    );
  },
};

export default MobilityBoard