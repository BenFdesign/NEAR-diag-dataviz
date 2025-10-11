import { useState, useEffect, useRef } from 'react';
import { getAvailableWillQuestions, fetchWillDataForQuestion, fetchWillData } from '../datapacks/DpWillAnalysis';

interface WillChoiceResponse {
  choiceKey: string;
  choiceLabels: {
    labelLong: string;
    labelShort: string;
    emoji: string;
  };
  absoluteCount: number;
  percentage: number;
}

interface WillQuestionData {
  questionKey: string;
  questionLabels: {
    title: string;
    emoji: string;
    questionOrigin: string;
    questionShort: string;
  };
  totalResponses: number;
  responses: WillChoiceResponse[];
}

interface WillDataResult {
  data: WillQuestionData[];
  isQuartier: boolean;
  suId: number;
  summary: {
    totalQuestions: number;
    dataSource: string;
    computationType: string;
  };
}

interface Props {
  data: WillDataResult;
  forceFilter?: number; // Optional: override Su/Quartier selection (1=Su1, 0=Quartier)
  selectedQuestionKey?: string;
  onQuestionChange?: (questionKey: string) => void;
  showHamburger?: boolean;
  selectedSus?: number[];
}

// Hauteur du chart configurable manuellement
const CHART_HEIGHT = 40; // px

export default function DvVolonteChangement({ 
  data, 
  forceFilter,
  selectedQuestionKey,
  onQuestionChange,
  showHamburger = false,
  selectedSus
}: Props) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Apply forceFilter if provided (override normal Su/Quartier logic)
  const displayData = forceFilter !== undefined 
    ? { ...data, isQuartier: forceFilter === 0, suId: forceFilter || data.suId }
    : data;

  // Get available questions for hamburger menu
  const availableQuestions = (() => {
    try {
      // Ensure cache is initialized by calling fetchWillData first
      fetchWillData(selectedSus);
      const questions = getAvailableWillQuestions();
      console.log('Available will questions:', questions);
      return questions;
    } catch (error) {
      console.error('Error getting available will questions:', error);
      return [];
    }
  })();

  // If a specific question is selected and hamburger is enabled, fetch that question's data
  const questionSpecificData = selectedQuestionKey
    ? fetchWillDataForQuestion(selectedQuestionKey, selectedSus)
    : null;

  console.log('Component state:', { 
    selectedQuestionKey, 
    showHamburger, 
    hasQuestionSpecificData: !!questionSpecificData,
    availableQuestionsCount: availableQuestions.length 
  });

  // Use question-specific data if available, otherwise use the provided data
  const finalDisplayData = questionSpecificData || displayData;

  // Mesure directe du SVG rendu (pas de viewBox dynamique)
  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMenuOpen && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Mapping de couleurs fixes par type de réponse (consistent across all questions)
  const getColorByChoiceKey = (choiceKey: string): string => {
    const colorMap: Record<string, string> = {
      // Positive responses - green tones
      'YES_I_DO': '#4CAF50',           // Green - already doing it
      'ALREADY_DO_IT': '#4CAF50',      // Same as YES_I_DO
      
      // Positive intent - orange/yellow tones  
      'I_WISH_AND_IT_IS_PLAN': '#d0fc69ff', // Orange - want to and planning
      'WOULD_LIKE_TO': '#d0fc69ff',          // Same intent
      'PLAN_TO': '#d0fc69ff',                // Same intent
      
      // Constrained - pink/light red tones
      'I_WISH_BUT_CANT': '#ff8c18ff',    // Pink - want but can't
      'WOULD_LIKE_BUT_CANT': '#ff8c18ff', // Same constraint
      
      // Negative - red tones
      'NO': '#b31408ff',                 // Red - don't want to
      'NOT_INTERESTED': '#b31408ff',     // Same negative intent
      'DONT_WANT': '#b31408ff',          // Same negative intent
      
      // Neutral/Other - gray tones
      'DONT_KNOW': '#9E9E9E',          // Gray - don't know
      'NO_OPINION': '#9E9E9E',         // Same neutral
    };
    
    return colorMap[choiceKey] || '#BDBDBD'; // Default gray for unknown keys
  };

  // Construction du titre dynamique
  const getTitle = (): string => {
    if (finalDisplayData.data.length === 0) return 'Volonté de Changement';
    
    const firstQuestion = finalDisplayData.data[0];
    const baseTitle = firstQuestion.questionLabels.title || 'Volonté de Changement';
    
    if (finalDisplayData.isQuartier) {
        return `${baseTitle}`;
    } else {
        return `${baseTitle}`; // Si besoin de personnaliser le titre par Su dans le futur.
    }
  };

  // Rendu du chart si les dimensions sont disponibles
  const renderChart = () => {
    if (dimensions.width === 0 || finalDisplayData.data.length === 0) return null;

    const question = finalDisplayData.data[0]; // Première question (peut être étendu pour toutes)
    
    // Sort responses by fixed order for consistency (reversed)
    const responseOrder = ['DONT_KNOW', 'NO_OPINION', 'NO', 'NOT_INTERESTED', 'DONT_WANT', 'I_WISH_BUT_CANT', 'WOULD_LIKE_BUT_CANT', 'I_WISH_AND_IT_IS_PLAN', 'WOULD_LIKE_TO', 'PLAN_TO', 'YES_I_DO', 'ALREADY_DO_IT'];
    
    const responses = question.responses
      .filter(r => r.percentage > 0)
      .sort((a, b) => {
        const aOrder = responseOrder.indexOf(a.choiceKey);
        const bOrder = responseOrder.indexOf(b.choiceKey);
        // Put unknown keys at the end
        if (aOrder === -1 && bOrder === -1) return a.choiceKey.localeCompare(b.choiceKey);
        if (aOrder === -1) return 1;
        if (bOrder === -1) return -1;
        return aOrder - bOrder;
      });
    
    if (responses.length === 0) return null;

    // Marges fixes avec padding max 2%
    const padding = Math.max(1, Math.min(dimensions.width, dimensions.height) * 0.02);
    const chartWidth = dimensions.width - (padding * 2);
    
    // Espace pour la légende simple
    const chartY = padding;
    const availableHeight = dimensions.height - (padding * 2) - 80; // Simple legend space
    const adjustedChartHeight = Math.min(CHART_HEIGHT, availableHeight * 0.7);

    // Calcul des segments empilés à 100%
    let currentX = padding;
    const segments = responses.map((response) => {
      const segmentWidth = (chartWidth * response.percentage) / 100;
      const segment = {
        x: currentX,
        width: segmentWidth,
        response,
        color: getColorByChoiceKey(response.choiceKey)
      };
      currentX += segmentWidth;
      return segment;
    });



    return (
      <g>
        {/* Segments empilés */}
        {segments.map((segment) => (
          <g key={segment.response.choiceKey}>
            {/* Rectangle du segment */}
            <rect
              x={segment.x}
              y={chartY}
              width={segment.width}
              height={adjustedChartHeight}
              fill={segment.color}
              //stroke="#ffffff"
              strokeWidth={1}
              //onMouseOver={() => {
                //segment.stroke = "#ffffff";
              //}}
            />
            
            {/* Pourcentage dans le segment si assez large */}
            {segment.width >= 30 && segment.response.percentage >= 8 && (
              <text
                x={segment.x + segment.width / 2}
                y={chartY + adjustedChartHeight / 1.8}
                className="p2-labels"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#333"
                fontSize="10px"
                fontWeight="bold"
              >
                {`${segment.response.percentage.toFixed(1)}%`}
              </text>
            )}
          </g>
        ))}



        {/* Ligne de base */}
        <line
          x1={padding}
          y1={chartY + adjustedChartHeight}
          x2={padding + chartWidth}
          y2={chartY + adjustedChartHeight}
          stroke="#ccc"
          strokeWidth={1}
        />
      </g>
    );
  };

  // Affichage conditionnel si pas de données
  if (finalDisplayData.data.length === 0) {
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <h3 className="h3-dv">Volonté de Changement</h3>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p className="p2-labels" style={{ color: '#666' }}>Aucune donnée disponible</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Titre avec hamburger intégré */}
      <div style={{ 
        height: '20px', 
        display: 'flex', 
        alignItems: 'center', 
        position: 'relative',
        marginBottom: 0,
        padding: 0
      }}>
        {/* Hamburger menu - always show for debugging */}
        <div style={{ position: 'relative', marginRight: '8px' }}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{
              background: '#f0f0f0',
              border: '1px solid #ccc',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px',
              height: '24px',
              width: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1A237E',
              borderRadius: '4px'
            }}
            title={`Changer de question (${availableQuestions.length} disponibles)`}
          >
            ☰
          </button>
            
          {/* Dropdown menu */}
          {isMenuOpen && (
            <div style={{
              position: 'absolute',
              top: '26px',
              left: '0',
              borderRadius: '4px',
              boxShadow: '0 2px 8px rgba(36, 36, 36, 0.15)',
              zIndex: 1000,
              minWidth: '200px',
              maxHeight: '300px',
              overflowY: 'auto',
              backgroundColor: 'white'
            }}>
              {availableQuestions.length > 0 ? (
                availableQuestions.map((question) => (
                  <button
                    key={question.questionKey}
                    onClick={() => {
                      if (onQuestionChange) {
                        onQuestionChange(question.questionKey);
                      }
                      setIsMenuOpen(false);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      backgroundColor: question.questionKey === selectedQuestionKey ? '#1976D2' : 'transparent',
                      color: question.questionKey === selectedQuestionKey ? '#fff' : '#1A237E',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: '12px',
                      borderBottom: '1px solid rgba(0,0,0,0.1)',
                      transition: 'background 0.2s, color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (question.questionKey !== selectedQuestionKey) {
                        e.currentTarget.style.backgroundColor = '#f0f0f0';
                        e.currentTarget.style.color = '#1A237E';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (question.questionKey !== selectedQuestionKey) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#1A237E';
                      }
                    }}
                  >
                    {question.emoji} {question.title}
                  </button>
                ))
              ) : (
                <div style={{ padding: '8px 12px', fontSize: '12px', color: '#666' }}>
                  Aucune question disponible
                </div>
              )}
            </div>
          )}
        </div>
        
        <h3 className="h3-dv" style={{ 
          margin: 0, 
          padding: 0,
          flexGrow: 1
        }}>
          {getTitle()}
        </h3>
      </div>
      
      {/* Zone graphique : flex: 1 remplit l'espace restant */}
      <div style={{ flex: 1}}>
        <svg ref={svgRef} width="100%" height="100%">
          {renderChart()}
        </svg>
      </div>
      
      {/* Légende simple */}
      {finalDisplayData.data.length > 0 && (
        <div style={{
          marginTop: '-100px',
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '10px',
          padding: '10px 0',
          justifyContent: 'center'
        }}>
          {finalDisplayData.data[0].responses
            .filter(r => r.percentage > 0)
            .sort((a, b) => {
              const responseOrder = ['DONT_KNOW', 'NO_OPINION', 'NO', 'NOT_INTERESTED', 'DONT_WANT', 'I_WISH_BUT_CANT', 'WOULD_LIKE_BUT_CANT', 'I_WISH_AND_IT_IS_PLAN', 'WOULD_LIKE_TO', 'PLAN_TO', 'YES_I_DO', 'ALREADY_DO_IT'];
              const aOrder = responseOrder.indexOf(a.choiceKey);
              const bOrder = responseOrder.indexOf(b.choiceKey);
              if (aOrder === -1 && bOrder === -1) return a.choiceKey.localeCompare(b.choiceKey);
              if (aOrder === -1) return 1;
              if (bOrder === -1) return -1;
              return aOrder - bOrder;
            })
            .map((response) => (
            <div key={response.choiceKey} style={{ 
              display: 'flex', 
              alignItems: 'center'
            }}>
              <div style={{
                width: '14px',
                height: '14px',
                backgroundColor: getColorByChoiceKey(response.choiceKey),
                marginRight: '5px',
                border: '1px solid #333',
                borderRadius: '2px'
              }} />
              <span style={{ fontSize: '12px', color: '#333' }}>
                {/*{response.choiceLabels.emoji}*/} {response.choiceLabels.labelShort || response.choiceLabels.labelLong}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}