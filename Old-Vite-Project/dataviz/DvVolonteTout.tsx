import { useState, useEffect, useRef } from 'react';
import { getAvailableWillQuestions, fetchWillDataForQuestion } from '../datapacks/DpWillAnalysis';

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

interface Props {
  selectedSus?: number[];
}

export default function DvVolonteTout({ selectedSus }: Props) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [allQuestionsData, setAllQuestionsData] = useState<WillQuestionData[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Get all questions and their data
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoading(true);
        const availableQuestions = getAvailableWillQuestions();
        console.log('DvVolonteTout - Available questions:', availableQuestions.length, availableQuestions);
        
        const questionsData: WillQuestionData[] = [];
        
        // Load data for each question
        for (const question of availableQuestions) {
          console.log('DvVolonteTout - Loading question:', question.questionKey);
          const questionResult = fetchWillDataForQuestion(question.questionKey, selectedSus);
          console.log('DvVolonteTout - Question result:', question.questionKey, questionResult);
          if (questionResult.data.length > 0) {
            questionsData.push(questionResult.data[0]);
            console.log('DvVolonteTout - Added question data:', question.questionKey);
          } else {
            console.log('DvVolonteTout - No data for question:', question.questionKey);
          }
        }
        
        // Sort questions in a consistent order (by questionKey)
        questionsData.sort((a, b) => a.questionKey.localeCompare(b.questionKey));
        
        setAllQuestionsData(questionsData);
        console.log('DvVolonteTout - Final loaded questions:', questionsData.length, questionsData.map(q => q.questionKey));
      } catch (error) {
        console.error('Error loading all questions data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, [selectedSus]);

  // Color mapping for consistency (exact same as DvVolonteChangement)
  const PositiveColor = "#4CAF50";
  const PositiveIntentColor = "#b2bb33ff";
  const ConstrainedColor = '#ff8c18ff';
  const NegativeColor = '#b31408ff';
  const OtherColor = '#9E9E9E';

  // LES KEYS SONT MAPPÉES EN DUR POUR CETTE DV PARCE QUE LES CHOIX DIFFERENT POUR DES MÊMES TYPES DE QUESTION,
  // DONC SOLUTION FACILE EN ATTENDANT LA CORRECTION EN BDD.
  const getColorByChoiceKey = (choiceKey: string): string => {
    const colorMap: Record<string, string> = {
      // Positive responses - green tones
      'YES_I_DO': PositiveColor,           // Green - already doing it
      'ALREADY_DO_IT': PositiveColor,      // Same as YES_I_DO

      // Positive intent - orange/yellow tones
      'I_WISH_AND_IT_IS_PLAN': PositiveIntentColor, // Orange - want to and planning
      'WOULD_LIKE_TO': PositiveIntentColor,          // Same intent
      'PLAN_TO': PositiveIntentColor,                // Same intent

      // Constrained - pink/light red tones
      'I_WISH_BUT_CANT': ConstrainedColor,    // Pink - want but can't
      'WOULD_LIKE_BUT_CANT': ConstrainedColor, // Same constraint

      // Negative - red tones
      'NO': NegativeColor,                 // Red - don't want to
      'NOT_INTERESTED': NegativeColor,     // Same negative intent
      'DONT_WANT': NegativeColor,          // Same negative intent

      // Neutral/Other - gray tones
      'DONT_KNOW': OtherColor,          // Gray - don't know
      'NO_OPINION': OtherColor,         // Same neutral
    };
    
    return colorMap[choiceKey] || '#BDBDBD'; // Default gray for unknown keys
  };

  // Update dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Get all unique choices across all questions for the legend
  const getAllUniqueChoices = () => {
    const choicesMap = new Map<string, WillChoiceResponse>();
    
    allQuestionsData.forEach(question => {
      question.responses.forEach(response => {
        if (!choicesMap.has(response.choiceKey) && response.percentage > 0) {
          choicesMap.set(response.choiceKey, response);
        }
      });
    });
    
    // Sort choices using the same order as DvVolonteChangement
    const responseOrder = ['DONT_KNOW', 'NO_OPINION', 'NO', 'NOT_INTERESTED', 'DONT_WANT', 'I_WISH_BUT_CANT', 'WOULD_LIKE_BUT_CANT', 'I_WISH_AND_IT_IS_PLAN', 'WOULD_LIKE_TO', 'PLAN_TO', 'YES_I_DO', 'ALREADY_DO_IT'];
    
    return Array.from(choicesMap.values()).sort((a, b) => {
      const aOrder = responseOrder.indexOf(a.choiceKey);
      const bOrder = responseOrder.indexOf(b.choiceKey);
      if (aOrder === -1 && bOrder === -1) return a.choiceKey.localeCompare(b.choiceKey);
      if (aOrder === -1) return 1;
      if (bOrder === -1) return -1;
      return aOrder - bOrder;
    });
  };

  // Render individual question chart
  const renderQuestionChart = (questionData: WillQuestionData, yOffset: number) => {
    const chartHeight = 30;
    const titleHeight = 40;
    
    // Sort responses using the same order as DvVolonteChangement (reversed for negative→positive)
    const responseOrder = ['DONT_KNOW', 'NO_OPINION', 'NO', 'NOT_INTERESTED', 'DONT_WANT', 'I_WISH_BUT_CANT', 'WOULD_LIKE_BUT_CANT', 'I_WISH_AND_IT_IS_PLAN', 'WOULD_LIKE_TO', 'PLAN_TO', 'YES_I_DO', 'ALREADY_DO_IT'];
    const sortedResponses = questionData.responses
      .filter(r => r.percentage > 0)
      .sort((a, b) => {
        const aOrder = responseOrder.indexOf(a.choiceKey);
        const bOrder = responseOrder.indexOf(b.choiceKey);
        if (aOrder === -1 && bOrder === -1) return a.choiceKey.localeCompare(b.choiceKey);
        if (aOrder === -1) return 1;
        if (bOrder === -1) return -1;
        return aOrder - bOrder;
      });
    
    // Calculate segments with precise width control
    let currentX = padding;
    const totalPercentage = sortedResponses.reduce((sum, r) => sum + r.percentage, 0);
    
    const segments = sortedResponses.map((response, index) => {
      let segmentWidth;
      
      // For the last segment, use remaining width to ensure total equals chartWidth
      if (index === sortedResponses.length - 1) {
        segmentWidth = padding + chartWidth - currentX;
      } else {
        segmentWidth = (chartWidth * response.percentage) / totalPercentage;
      }
      
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
      <g key={questionData.questionKey} transform={`translate(0, ${yOffset})`}>
        {/* Question title */}
        <text
          x={padding}
          y={chartHeight}
          className="h3-dv"
          style={{ fontSize: '16px', fontWeight: 'bold' }}
          fill="#333"
        >
          {questionData.questionLabels.title}
        </text>
        
        {/* Chart segments */}
        <g transform={`translate(0, ${titleHeight})`}>
          {segments.map((segment) => (
            <g key={segment.response.choiceKey}>
              {/* Rectangle segment */}
              <rect
                x={segment.x}
                y={0}
                width={segment.width}
                height={chartHeight}
                fill={segment.color}
                strokeWidth={1}
              />
              
              {/* Percentage label if segment is wide enough */}
              {segment.width >= 30 && segment.response.percentage >= 8 && (
                <text
                  x={segment.x + segment.width / 2}
                  y={chartHeight / 1.8}
                  className="p2-labels-white"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffffff"
                  //textColor="#ffffffff"
                  fontSize="10px"
                  fontWeight="bold"
                >
                  {`${segment.response.percentage.toFixed(1)}%`}
                </text>
              )}
            </g>
          ))}
          
        </g>
      </g>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#666', fontSize: '14px' }}>Chargement des données...</p>
        </div>
      </div>
    );
  }

  // No data state
  if (allQuestionsData.length === 0) {
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#666', fontSize: '14px' }}>Aucune donnée disponible</p>
        </div>
      </div>
    );
  }

  const uniqueChoices = getAllUniqueChoices();
  const chartSpacing = 80; // Space between each question chart
  const svgHeight = allQuestionsData.length * chartSpacing; // Height for just the charts
  const legendHeight = 60; // Fixed height for legend area
  
  // Calculate chart width once for consistency across all charts
  const padding = 20;
  const chartWidth = dimensions.width > 0 ? dimensions.width - (padding * 2) : 0;

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Charts area with fixed height */}
      <div style={{ height: `${svgHeight}px`, flexShrink: 0 }}>
        {dimensions.width > 0 && (
          <svg ref={svgRef} width="100%" height={svgHeight}>
            {allQuestionsData.map((questionData, index) => 
              renderQuestionChart(questionData, index * chartSpacing)
            )}
          </svg>
        )}
      </div>
      
      {/* Légende positioned right after charts */}
      <div style={{
        height: `${legendHeight}px`,
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '10px',
        padding: '10px 0',
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0
      }}>
        {uniqueChoices.map((response) => (
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
              {response.choiceLabels.labelShort || response.choiceLabels.labelLong}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}