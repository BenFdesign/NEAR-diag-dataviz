import { useState, useMemo } from 'react'
import './App.css'
import './styles/dashboard.css'
import TopMenu from './components/TopMenu'
import LeftSidebar from './components/LeftSidebar'
import RightSidebar from './components/RightSidebar'
import BoardViewer from './components/BoardViewer'
import { getSuInfo } from './services/suService'
import { getBoardById, getDefaultBoard } from './boards/registry'
import type { MenuState } from './types'

function App() {
  // Initalisation SuData
  const allSus = useMemo(() => getSuInfo(), [])
  
  // Initialisation du MenuState
  const [menuState, setMenuState] = useState<MenuState>(() => {
    const defaultBoard = getDefaultBoard()
    return {
      selectedBoard: defaultBoard.id,
      selectedSus: defaultBoard.defaultSus || allSus.map(su => su.su), // Vue quartier par défaut
      availableSus: allSus
    }
  })

  // Board definition + component
  const currentBoardDef = getBoardById(menuState.selectedBoard)
  const BoardComponent = currentBoardDef?.component

  const handleBoardChange = (boardId: string) => {
    const newBoard = getBoardById(boardId)
    setMenuState(prev => ({
      ...prev,
      selectedBoard: boardId,
      selectedSus: newBoard?.defaultSus || prev.selectedSus
    }))
  }

  const handleSusChange = (sus: number[]) => {
    setMenuState(prev => ({
      ...prev,
      selectedSus: sus
    }))
  }

  return (
    <div className="center-dashboard">
      <div className="dashboard">

        {/* Header */}
        {/*<header className="header">
          <TopMenu 
            selectedBoard={menuState.selectedBoard}
            onBoardChange={handleBoardChange}
          />
        </header>*/}

        {/* Footer */}
        {/*}
        <footer className="footer">
          Footer en prévision
        </footer>
        */}

        {/* LeftSidebar.tsx - Menu de filtre */}
        <aside className="menu-filter">
          <LeftSidebar 
            availableSus={menuState.availableSus}
            selectedSus={menuState.selectedSus}
            onSusChange={handleSusChange}
          />
        </aside>

        {/* RightSidebar.tsx - Menu des Boards */}
        <RightSidebar 
          selectedBoard={menuState.selectedBoard}
          onBoardChange={handleBoardChange}
        />

        {/* Main Board Container */}
        <main className="board-container">
          <BoardViewer>
            {BoardComponent ? (
              <BoardComponent 
                selectedSus={menuState.selectedSus}
                allSus={menuState.availableSus}
              />
            ) : (
              <div style={{ 
                padding: 40, 
                textAlign: 'center',
                color: '#6c757d'
              }}>
                <h2>Petit bug</h2>
                <p>Le board ne veut pas s'afficher :(.</p>
              </div>
            )}
          </BoardViewer>
        </main>
      </div>
    </div>
  )
}

export default App
