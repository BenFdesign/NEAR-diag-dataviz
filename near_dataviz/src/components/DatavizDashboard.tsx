'use client'

import { useState, useEffect } from 'react'
import LeftSidebar from './LeftSidebar'
import RightSidebar from './RightSidebar'
import BoardViewer from './BoardViewer'
import { getSuInfo } from '~/lib/su-service'
import { getBoardById, getDefaultBoard, getNewBoardById } from './boards/registry'
import type { MenuState, SuInfo } from '~/lib/types'

export default function DatavizDashboard() {
  const [allSus, setAllSus] = useState<SuInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load SU data on mount
  useEffect(() => {
    const loadSuData = async () => {
      try {
        setLoading(true)
        const susData = await getSuInfo()
        setAllSus(susData)
      } catch (err) {
        console.error('Error loading SU data:', err)
        setError('Failed to load SU data')
      } finally {
        setLoading(false)
      }
    }

    void loadSuData()
  }, [])

  // Initialize menu state
  const [menuState, setMenuState] = useState<MenuState>(() => {
    const defaultBoard = getDefaultBoard()
    return {
      selectedBoard: defaultBoard.id,
      selectedSus: [], // Will be set once allSus is loaded
      availableSus: []
    }
  })

  // Update menu state when allSus is loaded
  useEffect(() => {
    if (allSus.length > 0 && menuState.availableSus.length === 0) {
      const defaultBoard = getDefaultBoard()
      setMenuState(prev => ({
        ...prev,
        selectedSus: defaultBoard.defaultSus ?? allSus.map(su => su.su),
        availableSus: allSus
      }))
    }
  }, [allSus, menuState.availableSus.length])

  // Board definition + component (supporting both old and new systems)
  const currentBoardDef = getBoardById(menuState.selectedBoard)
  const currentNewBoard = menuState.selectedBoard.startsWith('new-') 
    ? getNewBoardById(menuState.selectedBoard.replace('new-', ''))
    : null
  const BoardComponent = currentBoardDef?.component

  const handleBoardChange = (boardId: string) => {
    if (boardId.startsWith('new-')) {
      // New board system
      setMenuState(prev => ({
        ...prev,
        selectedBoard: boardId,
        selectedSus: prev.selectedSus // Keep current selection
      }))
    } else {
      // Old board system
      const newBoard = getBoardById(boardId)
      setMenuState(prev => ({
        ...prev,
        selectedBoard: boardId,
        selectedSus: newBoard?.defaultSus ?? prev.selectedSus
      }))
    }
  }

  const handleSusChange = (sus: number[]) => {
    setMenuState(prev => ({
      ...prev,
      selectedSus: sus
    }))
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <p className="loading-text">Chargement des données...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-content">
          <div className="error-icon">❌</div>
          <p className="error-message">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="error-retry-button"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dataviz-dashboard">
      <div className="dashboard-grid">
        {/* LeftSidebar.tsx - Menu de filtre */}
        <aside className="menu-filter">
          <LeftSidebar 
            availableSus={menuState.availableSus}
            selectedSus={menuState.selectedSus}
            onSusChange={handleSusChange}
          />
        </aside>

        {/* Main Board Container */}
        <main className="board-container">
          <BoardViewer>
            {currentNewBoard ? (
              // Render new board system
              currentNewBoard.renderComponent({
                selectedSus: menuState.selectedSus,
                containerWidth: 800, // Default width
                containerHeight: 600 // Default height
              })
            ) : BoardComponent ? (
              // Render old board system
              <BoardComponent 
                selectedSus={menuState.selectedSus}
                allSus={menuState.availableSus}
              />
            ) : (
              <div className="p-10 text-center text-gray-500">
                <h2 className="text-xl mb-4">Petit bug</h2>
                <p>Le board ne veut pas s&apos;afficher :(.</p>
              </div>
            )}
          </BoardViewer>
        </main>

        {/* RightSidebar.tsx - Menu des Boards */}
        <RightSidebar 
          selectedBoard={menuState.selectedBoard}
          onBoardChange={handleBoardChange}
        />
      </div>
    </div>
  )
}