import React from 'react'

interface BoardViewerProps {
  children: React.ReactNode
}

// BoardViewer: Board central avec un canva fixe
/* - Fournit un conteneur à largeur fixe pour les Boards
   - Tous les Boards utilisent 100 % de l'espace disponible dans ce visualiseur */

const BoardViewer: React.FC<BoardViewerProps> = ({ children }) => {
  return (
    <div className="board-viewer">
      <div className="board-content">
        {children}
      </div>
    </div>
  )
}

export default BoardViewer