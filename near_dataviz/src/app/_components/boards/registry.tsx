/**
 * REGISTRE DES BOARDS / BOARDS REGISTRY 
 * =====================================
 * Ce fichier contient uniquement les définitions et configurations des boards,
 * sans logique de composant. Les composants sont définis dans des fichiers séparés.
 */

import type { Board } from '~/lib/types'
import { FicheSuBoard} from './FicheSuBoard'
// import TestBoard from './TestBoard' // Décommentez si vous voulez utiliser le TestBoard

// Board registry - Configuration centrale des tableaux de bord
export const BOARD_REGISTRY: Board[] = [
  FicheSuBoard,
]

// Utility functions
export const getBoardById = (id: string): Board | undefined => {
  return BOARD_REGISTRY.find(board => board.id === id)
}

export const getDefaultBoard = (): Board => {
  return BOARD_REGISTRY[0]!
}