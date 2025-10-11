import React from 'react'

interface BoardViewerProps {
  children: React.ReactNode
}

/*
 * BoardViewer: Board central avec un canva fixe
 * - Fournit un conteneur à largeur fixe pour les Boards
 * - Tous les Boards utilisent 100 % de l'espace disponible dans ce visualiseur
 */

const BoardViewer: React.FC<BoardViewerProps> = ({ children }) => {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      overflowX: 'hidden',
      overflowY: 'auto',
      padding: '20px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '1200px', // Fixed max width
        minHeight: '100%',
        boxSizing: 'border-box'
      }}>
        {children}
      </div>
    </div>
  )
}

export default BoardViewer