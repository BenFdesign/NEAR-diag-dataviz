'use client'

import { BOARD_REGISTRY } from './'

type RightSidebarProps = {
  selectedBoard: string
  onBoardChange: (boardId: string) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export default function RightSidebar({ selectedBoard, onBoardChange, isCollapsed, onToggleCollapse }: RightSidebarProps) {
  return (
    <div className="sidebar-base sidebar-right">
      {/* Collapse trigger */}
      <div 
        className="collapse-trigger right"
        onClick={onToggleCollapse}
        title={isCollapsed ? 'Étendre la sidebar' : 'Réduire la sidebar'}
      />
      
      {/* Expanded content */}
      <div className={`sidebar-content ${isCollapsed ? 'collapsed' : 'expanded'}`}>
        <div className="mb-5">
          <h3 className="menu-main-title">
            📊 Que voulez-vous découvrir ?
          </h3>
        </div>
        <div className="flex flex-col gap-2 mb-4 text-[#2c3e50]">
          {/* Boards */}
          {BOARD_REGISTRY.map((board) => (
            <button
              key={board.id}
              onClick={() => onBoardChange(board.id)}
              className={`
                block w-full text-left border border-gray-300 rounded-md p-3 cursor-pointer
                text-sm transition-all duration-500 hover:translate-y-0
                ${board.id === selectedBoard 
                  ? 'bg-[#6e6eb9ff] text-white shadow-[0_2px_4px_rgba(0,123,255,0.3)]' 
                  : 'bg-white text-[#6e6eb9ff] shadow-[0_1px_2px_rgba(0,0,0,0.1)] hover:bg-[#6e6eb9ff] hover:text-white'
                }
              `}
            >
              <div className="font-semibold mb-1">
                {board.emoji} {board.name}
              </div>
              <div className="text-xs leading-tight">
                {board.description}
              </div>
            </button>
          ))}
        </div>
      </div>
      
      {/* Collapsed buttons */}
      <div className={`collapsed-buttons ${isCollapsed ? 'visible' : ''}`}>
        {BOARD_REGISTRY.map((board) => (
          <div
            key={board.id}
            className={`collapsed-button ${board.id === selectedBoard ? 'active' : ''}`}
            onClick={() => onBoardChange(board.id)}
            title={board.name}
          >
            <div className="emoji">
              {board.emoji}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}