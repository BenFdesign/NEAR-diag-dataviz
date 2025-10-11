/**
 * Exemple d'utilisation de DvVolonteChangement avec datapack en props
 * 
 * Ce composant montre comment utiliser DvVolonteChangement en passant
 * les données du datapack DpWillAnalysis en props.
 */

import { fetchWillData } from '../datapacks/DpWillAnalysis';
import DvVolonteChangement from './DvVolonteChangement';

interface Props {
  selectedSus?: number[];
}

export default function ExempleDvVolonteChangement({ selectedSus }: Props) {
  // Récupération des données du datapack
  const willData = fetchWillData(selectedSus);

  return (
    <div style={{ width: '400px', height: '200px' }}>
      {/* Passage du datapack en props */}
      <DvVolonteChangement willData={willData} />
    </div>
  );
}

// Exemple d'utilisation dans une grid CSS
export function ExempleGridVolonteChangement() {
  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: '1fr 1fr', 
      gridTemplateRows: '200px 200px',
      gap: '16px',
      width: '100%',
      height: '100%'
    }}>
      
      {/* Quartier complet */}
      <DvVolonteChangement willData={fetchWillData()} />
      
      {/* SU 1 */}
      <DvVolonteChangement willData={fetchWillData([1])} />
      
      {/* SU 2 */}
      <DvVolonteChangement willData={fetchWillData([2])} />
      
      {/* SU 3 */}
      <DvVolonteChangement willData={fetchWillData([3])} />
      
    </div>
  );
}

export { DvVolonteChangement };