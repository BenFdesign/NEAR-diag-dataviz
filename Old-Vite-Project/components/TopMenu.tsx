import { BOARD_REGISTRY } from '../boards/registry'

type TopMenuProps = {
  selectedBoard: string
  onBoardChange?: (boardId: string) => void // Optional since we're not using it anymore
}

export default function TopMenu({ selectedBoard }: TopMenuProps) {
  const currentBoard = BOARD_REGISTRY.find(board => board.id === selectedBoard)

  return (
    <header style={{
      backgroundColor: '#2c3e50',
      color: 'white',
      padding: '0 20px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 60,
        maxWidth: '100%',
        margin: '0 auto'
      }}>
        {/* Logo/Title - Centered */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{ fontSize: 24 }}>📊</div>
          <h1 style={{ 
            margin: 0, 
            fontSize: 20, 
            fontWeight: 600 
          }}>
            Chantier Dataviz NEAR
          </h1>
          {currentBoard && (
            <span style={{
              fontSize: 16,
              fontWeight: 400,
              color: '#ecf0f1',
              marginLeft: 16
            }}>
            {/*  - {currentBoard.name}*/}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}