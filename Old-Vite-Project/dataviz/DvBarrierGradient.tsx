import React, { useMemo, useRef, useEffect, useState } from 'react';
import { fetchBarrierDataForQuestion, getAvailableBarrierQuestions } from '../datapacks/DpBarrierAnalysisV2';

interface DvBarrierGradientProps {
  selectedSus?: number[];
  selectedQuestionKey: string;
  onQuestionChange?: (questionKey: string) => void;
  showHamburger?: boolean;
}

const DvBarrierGradient: React.FC<DvBarrierGradientProps> = ({
  selectedSus,
  selectedQuestionKey,
  onQuestionChange,
  showHamburger = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { data } = useMemo(() => {
    return fetchBarrierDataForQuestion(selectedQuestionKey, selectedSus);
  }, [selectedQuestionKey, selectedSus]);

  // Get available questions for hamburger menu
  const availableQuestions = useMemo(() => {
    return showHamburger ? getAvailableBarrierQuestions() : [];
  }, [showHamburger]);

  // Measure container dimensions (CSS Grid sizing)
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
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

  // Get the question data (should be only one)
  const questionData = data[0];
  
  if (!questionData || questionData.categories.length === 0) {
    return (
      <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <h2 className="H2-Dv">🚧 Barrières - Aucune donnée</h2>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6c757d' }}>
          Aucune donnée disponible pour cette question.
        </div>
      </div>
    );
  }

  // Filter out 0%, 100% categories and "Non concerné"
  const filteredCategories = questionData.categories.filter(cat => 
    cat.percentage > 0 && 
    cat.percentage < 100 && 
    cat.familleBarriere !== "Non concerné"
  );

  // Sort from highest to lowest percentage
  const sortedCategories = [...filteredCategories].sort((a, b) => b.percentage - a.percentage);

  // Generate gradient colors from light yellow to more vivid red (fixed 0-100% scale)
  const generateGradientColor = (percentage: number): string => {
    const intensity = Math.min(100, Math.max(0, percentage)) / 100;
    // Light Yellow (255, 255, 232) to Vivid Red (220, 50, 50)
    const r = Math.round(255 - (35 * intensity));
    const g = Math.round(255 - (205 * intensity));
    const b = Math.round(232 - (182 * intensity));
    return `rgb(${r}, ${g}, ${b})`;
  };

  // Calculate responsive dimensions
  const padding = Math.max(8, Math.min(dimensions.width, dimensions.height) * 0.02);
  const legendWidth = Math.max(16, dimensions.width * 0.08);
  const titleHeight = 20;
  const availableHeight = dimensions.height - padding * 2 - titleHeight - 8;

  // Calculate bar dimensions - fixed size shapes
  const fixedBarHeight = 28;
  const barGap = 2;
  const explanatoryTextHeight = 18;
  const availableHeightForBars = availableHeight - explanatoryTextHeight;
  const maxBarsCount = Math.floor((availableHeightForBars + barGap) / (fixedBarHeight + barGap));
  
  // Show only the bars that fit, keeping the highest percentages
  const visibleCategories = sortedCategories.slice(0, maxBarsCount);

  // Light background color
  const lightBgColor = 'rgb(248, 248, 248)';

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%',
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: lightBgColor
      }}
    >
      {/* Title with integrated hamburger */}
      <div style={{ 
        height: '20px', 
        display: 'flex', 
        alignItems: 'center', 
        position: 'relative',
        marginBottom: 0,
        padding: 0
      }}>
        {/* Hamburger menu */}
        {showHamburger && availableQuestions.length > 0 && (
          <div style={{ position: 'relative', marginRight: '8px' }}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '2px',
                height: '20px',
                width: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1A237E'
              }}
              title="Changer de question"
            >
              ☰
            </button>
            
            {/* Dropdown menu */}
            {isMenuOpen && (
              <div style={{
                position: 'absolute',
                top: '22px',
                left: '0',
                borderRadius: '4px',
                boxShadow: '0 2px 8px rgba(36, 36, 36, 0.15)',
                zIndex: 1000,
                minWidth: '200px',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {availableQuestions.map((question) => (
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
                      borderBottom: '1px solid rgba(254, 255, 255, 1)ff',
                      transition: 'background 0.2s, color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (question.questionKey !== selectedQuestionKey) {
                        e.currentTarget.style.backgroundColor = '#dbeaf2ff';
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
                    {question.emoji} {question.title.replace('Barrières : ', '')}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        <h2 className="H2-Dv" style={{ 
          margin: 0, 
          padding: 0,
          flexGrow: 1
        }}>
          {questionData.questionLabels.title}
        </h2>
      </div>
      
      {/* Main content area */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        padding: `0 ${padding}px ${padding}px ${padding}px`,
        alignContent: 'center',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px'
      }}>
        {/* Barriers list */}
        <div style={{ 
          flexGrow: 0.5,
          display: 'flex', 
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          {/* Shapes container */}
          <div style={{
            display: 'flex', 
            flexDirection: 'column', 
            gap: `${barGap}px`,
            overflow: 'hidden'
          }}>
            {visibleCategories.map((category) => {
              const gradientColor = generateGradientColor(category.percentage);
              
              return (
                <div 
                  key={category.familleBarriere}
                  style={{
                    backgroundColor: gradientColor,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    height: `${fixedBarHeight}px`,
                    minHeight: `${fixedBarHeight}px`,
                    maxHeight: `${fixedBarHeight}px`
                  }}
                >
                  <span style={{ marginRight: '6px', fontSize: '12px' }}>
                    {category.isOtherReasons ? '💬' : '🚧'}
                  </span>
                  <span 
                    className="p2-labels" 
                    style={{ 
                      flexGrow: 1, 
                      fontSize: '11px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontStyle: category.isOtherReasons ? 'italic' : 'normal'
                    }}
                  >
                    {category.familleBarriere}
                  </span>
                  <span 
                    className="p2-labels" 
                    style={{ 
                      fontWeight: 'bold',
                      fontSize: '11px'
                    }}
                  >
                    {category.percentage.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Explanatory text */}
          <div 
            className="p3-labels" 
            style={{ 
              marginTop: '8px',
              textAlign: 'right'
            }}
          >
            (% des répondants ayant coché une réponse dans cette catégorie)
          </div>
        </div>
        
        {/* Vertical gradient legend */}
        <div style={{ 
          width: `${legendWidth}px`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%'
        }}>
          <div style={{ position: 'relative' }}>
            {/* 100% label at top */}
            <div 
              className="p2-labels" 
              style={{ 
                fontSize: '10px', 
                textAlign: 'center', 
                marginBottom: '4px',
                fontWeight: 'bold'
              }}
            >
              100%
            </div>
            
            {/* Gradient bar */}
            <div 
              style={{
                width: `${Math.max(12, legendWidth * 0.4)}px`,
                height: `${Math.min(availableHeight * 0.6, 150)}px`,
                background: 'linear-gradient(to bottom, rgb(220, 50, 50) 0%, rgba(255, 255, 232, 1) 100%)',
                borderRadius: '10px',
                border: '2px solid #333',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                margin: '0 auto'
              }}
            />
            
            {/* 0% label at bottom */}
            <div 
              className="p2-labels" 
              style={{ 
                fontSize: '10px', 
                textAlign: 'center', 
                marginTop: '4px',
                fontWeight: 'bold'
              }}
            >
              0%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DvBarrierGradient;