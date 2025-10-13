"use client"
import React from 'react'
import DvBarrierGradient from './DvBarrierGradient'

interface DvBarrierAggregatedProps {
  selectedSus?: number[]
}

const DvBarrierAggregated: React.FC<DvBarrierAggregatedProps> = ({ selectedSus }) => {
  return (
    <DvBarrierGradient
      selectedSus={selectedSus}
      selectedQuestionKey="__ALL_QUESTIONS_AGGREGATED__"
      showHamburger={false}
    />
  )
}

export default DvBarrierAggregated
