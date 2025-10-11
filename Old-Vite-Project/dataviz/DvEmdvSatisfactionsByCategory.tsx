import { useState } from 'react';
import { fetchEmdvSatisfactionsByCategoryData } from '../datapacks/DpEmdvSatisfactionsByCategory';

interface DvEmdvSatisfactionsByCategoryProps {
  selectedSus?: number[];
}

export default function DvEmdvSatisfactionsByCategory({ selectedSus }: DvEmdvSatisfactionsByCategoryProps) {
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');
  
  const { subcategories, availableSubcategories } = fetchEmdvSatisfactionsByCategoryData(
    selectedSus, 
    selectedSubcategory
  );

  if (!subcategories || subcategories.length === 0) {
    return (
      <div className="dv-emdv-satisfactions-by-category">
        <h3 className="dv-title">Satisfactions EMDV par catégorie</h3>
        <p className="dv-description">Aucune donnée de satisfaction disponible</p>
      </div>
    );
  }

  return (
    <div className="dv-emdv-satisfactions-by-category">
      <h3 className="dv-title">Avis sur le cadre de vie par catégorie</h3>
      
      {/* Sélecteur de sous-catégorie */}
      <div className="category-selector" style={{ marginBottom: '20px', textAlign: 'center' }}>
        <label htmlFor="subcategory-select" style={{ marginRight: '10px', fontWeight: 'bold' }}>
          Catégorie :
        </label>
        <select
          id="subcategory-select"
          value={selectedSubcategory}
          onChange={(e) => setSelectedSubcategory(e.target.value)}
          style={{
            padding: '8px 12px',
            fontSize: '14px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            backgroundColor: 'white'
          }}
        >
          <option value="all">🌟 Toutes les catégories</option>
          {availableSubcategories.map(subcategory => {
            const subcategoryData = subcategories.find(s => s.subcategory === subcategory);
            const label = subcategoryData ? 
              `${subcategoryData.subcategoryEmoji} ${subcategoryData.subcategoryLabel}` : 
              subcategory;
            return (
              <option key={subcategory} value={subcategory}>
                {label}
              </option>
            );
          })}
        </select>
      </div>
      
      <h4 className="dv-subtitle" style={{ textAlign: "center" }}>👎🟥 🤷‍♂️⬜ 👍🟩</h4>
      <br />
      
      {/* Affichage des catégories */}
      <div className="categories-container">
        {subcategories.map((subcategoryData) => (
          <div key={subcategoryData.subcategory} className="category-section" style={{ marginBottom: '30px' }}>
            {/* Titre de la catégorie */}
            {selectedSubcategory === 'all' && (
              <h4 className="category-title" style={{ 
                marginBottom: '15px',
                padding: '10px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: 'bold'
              }}>
                {subcategoryData.subcategoryEmoji} {subcategoryData.subcategoryLabel}
              </h4>
            )}
            
            {/* Questions de la catégorie */}
            <div className="satisfactions-grid">
              {subcategoryData.questions.map((item) => {
                // Find specific response types
                const satisfiedChoice = item.responses.find(r => r.choiceKey === 'YES');
                const neutralChoice = item.responses.find(r => r.choiceKey === 'DONT_KNOW');
                const dissatisfiedChoice = item.responses.find(r => r.choiceKey === 'NO');
                
                // Calculate normalized percentages
                const satisfiedPercentage = satisfiedChoice?.percentage || 0;
                const neutralPercentage = neutralChoice?.percentage || 0;
                const dissatisfiedPercentage = dissatisfiedChoice?.percentage || 0;
                
                const normalizedTotal = satisfiedPercentage + neutralPercentage + dissatisfiedPercentage;
                const normalizedSatisfied = normalizedTotal > 0 ? (satisfiedPercentage / normalizedTotal) * 100 : 0;
                const normalizedNeutral = normalizedTotal > 0 ? (neutralPercentage / normalizedTotal) * 100 : 0;
                const normalizedDissatisfied = normalizedTotal > 0 ? (dissatisfiedPercentage / normalizedTotal) * 100 : 0;

                return (
                  <div key={item.questionKey} className="satisfaction-item" style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    marginBottom: '16px',
                    marginLeft: selectedSubcategory === 'all' ? '20px' : '0px' // Indentation si toutes les catégories
                  }}>
                    {/* Title above the graph */}
                    <div className="satisfaction-header" style={{ marginBottom: '8px' }}>
                      <span className="question-title">{item.questionLabels.emoji} {item.questionLabels.title}</span>
                    </div>
                    
                    {/* Stacked bar chart below title */}
                    <div className="stacked-bar-container">
                      <div className="stacked-bar" style={{ 
                        display: 'flex', 
                        height: '30px', 
                        borderRadius: '4px', 
                        overflow: 'hidden',
                        border: '1px solid #e0e0e0'
                      }}>
                        {/* Dissatisfied (👎) - Left */}
                        <div 
                          className="bar-segment dissatisfied"
                          style={{ 
                            width: `${normalizedDissatisfied}%`,
                            backgroundColor: '#ffcdd2', // Light red
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                          title={`Non: ${dissatisfiedPercentage.toFixed(1)}% (${dissatisfiedChoice?.absoluteCount || 0})`}
                        >
                          {normalizedDissatisfied >= 24 && (
                            <span className="bar-label">{dissatisfiedPercentage.toFixed(0)}%</span>
                          )}
                        </div>
                        
                        {/* Neutral (🤷‍♂️) - Middle */}
                        <div 
                          className="bar-segment neutral"
                          style={{ 
                            width: `${normalizedNeutral}%`,
                            backgroundColor: '#f5f5f5', // Very light grey
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                          title={`Pas d'avis: ${neutralPercentage.toFixed(1)}% (${neutralChoice?.absoluteCount || 0})`}
                        >
                          {normalizedNeutral >= 24 && (
                            <span className="bar-label">{neutralPercentage.toFixed(0)}%</span>
                          )}
                        </div>
                        
                        {/* Satisfied (👍) - Right */}
                        <div 
                          className="bar-segment satisfied"
                          style={{ 
                            width: `${normalizedSatisfied}%`,
                            backgroundColor: '#c8e6c9', // Light green
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}
                          title={`Oui: ${satisfiedPercentage.toFixed(1)}% (${satisfiedChoice?.absoluteCount || 0})`}
                        >
                          {normalizedSatisfied >= 24 && (
                            <span className="bar-label">{satisfiedPercentage.toFixed(0)}%</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}