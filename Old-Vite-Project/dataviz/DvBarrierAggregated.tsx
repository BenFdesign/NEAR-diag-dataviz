import React from 'react';
import DvBarrierGradient from './DvBarrierGradient';

interface DvBarrierAggregatedProps {
  selectedSus?: number[];
}

/**
 * DvBarrierAggregated - Wrapper component for DvBarrierGradient
 * Automatically uses the aggregated view of all barriers
 * Designed for use in BoFicheSu1 board's "Zone Blocage"
 */
const DvBarrierAggregated: React.FC<DvBarrierAggregatedProps> = ({ selectedSus }) => {
  return (
    <DvBarrierGradient
      selectedSus={selectedSus}
      selectedQuestionKey="__ALL_QUESTIONS_AGGREGATED__"
      showHamburger={false}
    />
  );
};

export default DvBarrierAggregated;