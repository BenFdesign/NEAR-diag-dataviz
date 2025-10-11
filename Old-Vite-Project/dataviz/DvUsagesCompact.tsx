import React from 'react';
import DvUsageViolin from './DvUsageViolin';
import { fetchMeatFrequencyData } from '../datapacks/DpMeatFrequency';
import { fetchTransportationModeData } from '../datapacks/DpTransportationMode';
import { fetchDigitalIntensityData } from '../datapacks/DpDigitalIntensity';
import { fetchPurchasingStrategyData } from '../datapacks/DpPurchasingStrategy';
import { fetchAirTravelFrequencyData } from '../datapacks/DpAirTravelFrequency';
import { fetchHeatSourceData } from '../datapacks/DpHeatSource';

interface DvUsagesCompactProps {
  selectedSus?: number[];
}

/**
 * DvUsagesCompact - Complete Usages display for BoFicheSu1 board
 * Shows all 6 usage patterns (sphères d'usages) in a compact format
 * Uses the modern redesigned DvUsageViolin components with responsive sizing
 */
const DvUsagesCompact: React.FC<DvUsagesCompactProps> = ({ selectedSus }) => {
  // Fetch data for all 6 usage types
  const meatFrequencyResult = fetchMeatFrequencyData(selectedSus);
  const transportationResult = fetchTransportationModeData(selectedSus);
  const digitalIntensityResult = fetchDigitalIntensityData(selectedSus);
  const purchasingResult = fetchPurchasingStrategyData(selectedSus);
  const airTravelResult = fetchAirTravelFrequencyData(selectedSus);
  const heatSourceResult = fetchHeatSourceData(selectedSus);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '1px',
      overflow: 'hidden',
      padding: '2px'
    }}>
      {/* Title for the section */}  
      <div style={{ 
        fontSize: '11px', 
        fontWeight: 'bold', 
        color: '#333',
        textAlign: 'center',
        marginBottom: '1px',
        flexShrink: 0
      }}>
        Sphères d'Usages
      </div>

      {/* Meat Frequency */}
      <div style={{ flex: 1, minHeight: '0', overflow: 'hidden' }}>
        <DvUsageViolin 
          title="Viande"
          data={meatFrequencyResult.data}
          color={meatFrequencyResult.color}
          width="100%"
        />
      </div>

      {/* Transportation Mode */}
      <div style={{ flex: 1, minHeight: '0', overflow: 'hidden' }}>
        <DvUsageViolin 
          title="Mobilité"
          data={transportationResult.data}
          color={transportationResult.color}
          width="100%"
        />
      </div>

      {/* Digital Intensity */}
      <div style={{ flex: 1, minHeight: '0', overflow: 'hidden' }}>
        <DvUsageViolin 
          title="Écrans"
          data={digitalIntensityResult.data}
          color={digitalIntensityResult.color}
          width="100%"
        />
      </div>

      {/* Purchasing Strategy */}
      <div style={{ flex: 1, minHeight: '0', overflow: 'hidden' }}>
        <DvUsageViolin 
          title="Achats"
          data={purchasingResult.data}
          color={purchasingResult.color}
          width="100%"
        />
      </div>

      {/* Air Travel Frequency */}
      <div style={{ flex: 1, minHeight: '0', overflow: 'hidden' }}>
        <DvUsageViolin 
          title="Vols"
          data={airTravelResult.data}
          color={airTravelResult.color}
          width="100%"
        />
      </div>

      {/* Heat Source */}
      <div style={{ flex: 1, minHeight: '0', overflow: 'hidden' }}>
        <DvUsageViolin 
          title="Chauffage"
          data={heatSourceResult.data}
          color={heatSourceResult.color}
          width="100%"
        />
      </div>
    </div>
  );
};

export default DvUsagesCompact;