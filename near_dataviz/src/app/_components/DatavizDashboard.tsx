'use client'

import { useState, useEffect } from 'react'
import { LeftSidebar, RightSidebar, BoardViewer } from './'
import { getSuInfo } from '~/lib/su-service'
import { getBoardById, getDefaultBoard } from './'
import type { MenuState, SuInfo } from '~/lib/types'

export default function DatavizDashboard() {
  const [allSus, setAllSus] = useState<SuInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)

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
    // Use default board from unified BOARD_REGISTRY
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
      // For new board system, we select all SUs by default
      setMenuState(prev => ({
        ...prev,
        selectedSus: allSus.map(su => su.su),
        availableSus: allSus
      }))
    }
  }, [allSus, menuState.availableSus.length])

  // Board definition + component
  const currentBoard = getBoardById(menuState.selectedBoard)

  const handleBoardChange = (boardId: string) => {
    setMenuState(prev => ({
      ...prev,
      selectedBoard: boardId,
      selectedSus: prev.selectedSus // Keep current selection
    }))
  }

  const handleSusChange = (sus: number[]) => {
    setMenuState(prev => ({
      ...prev,
      selectedSus: sus
    }))
  }

  const toggleLeftSidebar = () => {
    setLeftSidebarCollapsed(prev => !prev)
  }

  const toggleRightSidebar = () => {
    setRightSidebarCollapsed(prev => !prev)
  }

  // Calculate board container classes based on sidebar states
  const getBoardContainerClass = () => {
    if (!leftSidebarCollapsed && !rightSidebarCollapsed) {
      return 'board-container both-expanded'
    } else if (!leftSidebarCollapsed && rightSidebarCollapsed) {
      return 'board-container left-expanded'
    } else if (leftSidebarCollapsed && !rightSidebarCollapsed) {
      return 'board-container right-expanded'
    }
    return 'board-container'
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
        <aside className={`menu-filter ${leftSidebarCollapsed ? 'collapsed' : 'expanded'}`}>
          <LeftSidebar 
            availableSus={menuState.availableSus}
            selectedSus={menuState.selectedSus}
            onSusChange={handleSusChange}
            isCollapsed={leftSidebarCollapsed}
            onToggleCollapse={toggleLeftSidebar}
          />
        </aside>

        {/* Main Board Container */}
        <main className={getBoardContainerClass()}>
          <BoardViewer>
            {currentBoard ? (
              // Render board, the board manages its own dimensions
              currentBoard.renderComponent({
                selectedSus: menuState.selectedSus
                // Remove fixed dimensions - let Board handle sizing
              })
            ) : (
              <div className="p-10 text-center text-gray-500">
                <h2 className="text-xl mb-4">Petit bug</h2>
                <p>Le board ne veut pas s&apos;afficher :(.</p>
              </div>
            )}
          </BoardViewer>
        </main>

        {/* RightSidebar.tsx - Menu des Boards */}
        <aside className={`board-selector ${rightSidebarCollapsed ? 'collapsed' : 'expanded'}`}>
          <RightSidebar 
            selectedBoard={menuState.selectedBoard}
            onBoardChange={handleBoardChange}
            isCollapsed={rightSidebarCollapsed}
            onToggleCollapse={toggleRightSidebar}
          />
        </aside>
      </div>
    </div>
  )
}