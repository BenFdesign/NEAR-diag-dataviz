'use client'

import { BOARD_REGISTRY, NEW_BOARD_REGISTRY } from './boards/registry'

type RightSidebarProps = {
  selectedBoard: string
  onBoardChange: (boardId: string) => void
}

export default function RightSidebar({ selectedBoard, onBoardChange }: RightSidebarProps) {
  return (
    <aside className="w-full bg-[#6e6eb9ff] border-r border-[#6e6eb9ff] h-full sticky top-0 overflow-auto">
        <div className="p-5">
          <h3 className="menu-main-title">
            📊 Que voulez-vous découvrir ?
          </h3>
        </div>
      <div className="flex flex-col gap-2 mb-4 px-5 text-[#2c3e50]">
        {/* Old boards */}
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
              {board.name}
            </div>
            <div className="text-xs leading-tight">
              {board.description}
            </div>
          </button>
        ))}
        
        {/* New boards */}
        {NEW_BOARD_REGISTRY.map((board) => (
          <button
            key={`new-${board.id}`}
            onClick={() => onBoardChange(`new-${board.id}`)}
            className={`
              block w-full text-left border border-gray-300 rounded-md p-3 cursor-pointer
              text-sm transition-all duration-500 hover:translate-y-0
              ${`new-${board.id}` === selectedBoard 
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
      
    </aside>
  )
}