import { fetchEmdvSatisfactionsData } from '../datapacks/DpEmdvSatisfactions';

interface DvEmdvSatisfactionsProps {
  selectedSus?: number[];
}

export default function DvEmdvSatisfactions({ selectedSus }: DvEmdvSatisfactionsProps) {
  const { data } = fetchEmdvSatisfactionsData(selectedSus);

  if (!data || data.length === 0) {
    return (
      <div className="dv-emdv-satisfactions">
        <h3 className="dv-title">Satisfactions EMDV</h3>
        <p className="dv-description">Aucune donnée de satisfaction disponible</p>
      </div>
    );
  }

  return (
    <div className="dv-emdv-satisfactions">
      <h3 className="dv-title">Avis sur le cadre de vie</h3>
      <h4 className="dv-subtitle" style={{ textAlign: "center" }}>👎🟥 🤷‍♂️⬜ 👍🟩</h4>
      <br></br>
      
      <div className="satisfactions-grid">
        {data.map((item) => {
          // Calculate bar widths based on percentages
          const totalPercentage = item.satisfiedPercentage + item.neutralPercentage + item.dissatisfiedPercentage;
          
          // Normalize to 100% if needed (due to rounding)
          const normalizedSatisfied = totalPercentage > 0 ? (item.satisfiedPercentage / totalPercentage) * 100 : 0;
          const normalizedNeutral = totalPercentage > 0 ? (item.neutralPercentage / totalPercentage) * 100 : 0;
          const normalizedDissatisfied = totalPercentage > 0 ? (item.dissatisfiedPercentage / totalPercentage) * 100 : 0;

          return (
            <div key={item.questionKey} className="satisfaction-item" style={{ display: 'flex', flexDirection: 'column', marginBottom: '16px' }}>
              {/* Title above the graph */}
              <div className="satisfaction-header" style={{ marginBottom: '8px' }}>
                <span className="question-title">{item.emoji} {item.title}</span>
              </div>
              
              {/* Stacked bar chart below title */}
              <div className="stacked-bar-container">
                <div className="stacked-bar">
                  {/* Dissatisfied (👎) - Left */}
                  <div 
                    className="bar-segment dissatisfied"
                    style={{ 
                      width: `${normalizedDissatisfied}%`,
                      backgroundColor: '#ffcdd2', // Light red
                    }}
                    title={`Non: ${item.dissatisfiedPercentage}% (${item.dissatisfiedCount})`}
                  >
                    {normalizedDissatisfied >= 24 && (
                      <span className="bar-label">{item.dissatisfiedPercentage}%</span>
                    )}
                  </div>
                  
                  {/* Neutral (🤷‍♂️) - Middle */}
                  <div 
                    className="bar-segment neutral"
                    style={{ 
                      width: `${normalizedNeutral}%`,
                      backgroundColor: '#f5f5f5', // Very light grey
                    }}
                    title={`Pas d'avis: ${item.neutralPercentage}% (${item.neutralCount})`}
                  >
                    {normalizedNeutral >= 24 && (
                      <span className="bar-label">{item.neutralPercentage}%</span>
                    )}
                  </div>
                  
                  {/* Satisfied (👍) - Right */}
                  <div 
                    className="bar-segment satisfied"
                    style={{ 
                      width: `${normalizedSatisfied}%`,
                      backgroundColor: '#c8e6c9', // Light green
                    }}
                    title={`Oui: ${item.satisfiedPercentage}% (${item.satisfiedCount})`}
                  >
                    {normalizedSatisfied >= 24 && (
                      <span className="bar-label">{item.satisfiedPercentage}%</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}