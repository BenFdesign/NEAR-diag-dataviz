import { BOARD_REGISTRY } from '../boards/registry'

type RightSidebarProps = {
  selectedBoard: string
  onBoardChange: (boardId: string) => void
}

export default function RightSidebar({ selectedBoard, onBoardChange }: RightSidebarProps) {
  return (
    <aside className="menu-board" style={{
      width: '100%',
      backgroundColor: '#6e6eb9ff',
      borderRight: '1px solid #6e6eb9ff',
      height: '100%',
      position: 'sticky',
      top: 0, // Height du top menu
      overflow: 'auto'
    }}>
      <h3 className="menu-main-title">
        📊 Que voulez-vous découvrir ?
      </h3>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        marginBottom: '16px',
        color: '#2c3e50'
      }}>
        {BOARD_REGISTRY.map((board) => (
          <button
            key={board.id}
            onClick={() => onBoardChange(board.id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              backgroundColor: board.id === selectedBoard ? '#6e6eb9ff' : '#ffffff',
              color: board.id === selectedBoard ? 'white' : '#6e6eb9ff',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              padding: '12px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.5s',
              boxShadow: board.id === selectedBoard ? '0 2px 4px rgba(0,123,255,0.3)' : '0 1px 2px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={(e) => {
              if (board.id !== selectedBoard) {
                e.currentTarget.style.backgroundColor = '#6e6eb9ff'
                e.currentTarget.style.color = 'white'
                //e.currentTarget.style.transform = 'translateY(-1px)'
              }
            }}
            onMouseLeave={(e) => {
              if (board.id !== selectedBoard) {
                e.currentTarget.style.backgroundColor = '#ffffff'
                e.currentTarget.style.color = '#6e6eb9ff'
                //e.currentTarget.style.transform = 'translateY(0)'
              }
            }}
          >
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>
              {board.name}
            </div>
            <div style={{ fontSize: '12px', lineHeight: '1.3' }}>
              {board.description}
            </div>
          </button>
        ))}
      </div>
    </aside>
  )
}