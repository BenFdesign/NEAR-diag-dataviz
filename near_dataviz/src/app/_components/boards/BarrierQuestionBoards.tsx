import React from 'react'
import type { Board } from '~/lib/types'
import DvBarrierGradient from '../dataviz/DvBarrierGradient'

// Static metadata import to build boards at module load
// Note: relative path from src/app/_components/boards -> project root -> public/data
// src/app/_components/boards -> ../../../../public/data
import Questions from '../../../../public/data/MetaEmdvQuestions.json'
import Choices from '../../../../public/data/MetaEmdvChoices.json'

type QuestionRow = Record<string, unknown> & {
  ['Metabase Question Key']?: string
  ['Question Declarative']?: string
  ['Question Short']?: string
  ['Question Long']?: string
  Emoji?: string
}

type ChoiceRow = Record<string, unknown> & {
  ['Metabase Question Key']?: string
  is_bareer?: boolean
  TypeData?: string
  famille_barriere?: string
}

const questions = (Questions as unknown as QuestionRow[])
const choices = (Choices as unknown as ChoiceRow[])

// Collect barrier question keys from choices metadata
const barrierQuestionKeys = Array.from(
  new Set(
    choices
      .filter(c => c.is_bareer === true && (c.TypeData === 'AbsChoixMultiple' || c.TypeData === 'AbsOther') && (c.famille_barriere ?? '') !== '')
      .map(c => String(c['Metabase Question Key'] ?? ''))
      .filter(k => k.length > 0)
  )
)

const getQuestionTitle = (key: string) => {
  const q = questions.find(qr => String(qr['Metabase Question Key'] ?? '') === key)
  if (!q) return key
  const declarative = q['Question Declarative']?.trim()
  const short = q['Question Short']?.trim()
  const long = q['Question Long']?.trim()
  return declarative && declarative.length > 0
    ? declarative
    : (short && short.length > 0
      ? short
      : (long && long.length > 0 ? long : key))
}

const getQuestionEmoji = (key: string) => {
  const q = questions.find(qr => String(qr['Metabase Question Key'] ?? '') === key)
  return q?.Emoji ?? '🧩'
}

export const BarrierQuestionBoards: Board[] = barrierQuestionKeys.map((key) => {
  const title = getQuestionTitle(key)
  const emoji = getQuestionEmoji(key)
  const id = `BARRIERS_Q_${encodeURIComponent(key)}`
  return {
    id,
    name: `${title}`,
    emoji,
    description: `% des répondants ayant indiqué des barrières à la transition`,
    renderComponent: ({ selectedSus }) => (
      <div className="other-board">
        <header className="board-header">
          <h2 className="board-title">{emoji} Barrières {title}</h2>
          <p className="board-subtitle">% de répondants ayant coché les différentes réponses</p>
        </header>
        <div className="dv-container" style={{ height: 460 }}>
          <DvBarrierGradient selectedSus={selectedSus} selectedQuestionKey={key} />
        </div>
      </div>
    )
  }
})

export default BarrierQuestionBoards
