import { useState, useEffect, useRef } from 'react'
import { getDpSuTitleData } from '../datapacks/DpSuTitle'

// Interface for the SU Title data (updated to match DpSuTitle)
interface SuTitleData {
  suId: number;
  suNumber: number | null;
  titleLabels: {
    nameFr: string;
    color: string;
    ornament: string;
    popPercentage: number;
    totalPopulation: number;
  };
  isQuartier: boolean;
}

type Props = {
  selectedSus?: number[]
}

/**
 * DvSuTitle2 - Responsive SU Title component following CSS Grid rules
 * Grid CSS defines size, Dv fills the space with proper responsive scaling
 */
export default function DvSuTitle2({ selectedSus }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  // Get data directly from the datapack (new approach)
  const data: SuTitleData | null = getDpSuTitleData(selectedSus);
  
  // Measure container dimensions for responsive scaling
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
    const resizeObserver = new ResizeObserver(updateDimensions);
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
      resizeObserver.disconnect();
    };
  }, []);

  // Base font size calculated from container dimensions (responsive scaling)
  const baseFontSize = Math.max(12, Math.min(dimensions.width, dimensions.height) * 0.08);
  const padding = Math.max(8, Math.min(dimensions.width, dimensions.height) * 0.06);

  // Validation - if no data, show error state
  if (!data) {
    return (
      <div 
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          border: '2px solid #e1e5e9',
          padding: `${padding}px`,
          boxSizing: 'border-box',
          color: '#6c757d',
          fontSize: Math.max(12, baseFontSize * 0.8)
        }}
      >
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        border: `2px solid ${data.titleLabels.color}`,
        padding: `${padding}px`,
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      {/* Fixed-height title section following H2-Dv rules */}
      <div style={{ 
        height: Math.max(20, baseFontSize * 1.2),
        display: 'flex',
        alignItems: 'center',
        marginBottom: padding * 0.5
      }}>
        <h2 className="H2-Dv" style={{
          fontSize: Math.max(14, baseFontSize * 0.8),
          color: '#6c757d',
          margin: 0,
          fontWeight: 500
        }}>
          {data.isQuartier 
            ? 'Quartier'
            : `Sphère d'Usages n°${data.suNumber}`
          }
        </h2>
      </div>

      {/* Main content area (flex: 1) */}
      <div style={{ 
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: padding * 0.8
      }}>
        {/* Ornament section - fixed proportion */}
        <div style={{ 
          width: Math.max(40, baseFontSize * 2.5),
          height: Math.max(40, baseFontSize * 2.5),
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {data.titleLabels.ornament ? (
            <div 
              dangerouslySetInnerHTML={{ __html: data.titleLabels.ornament }}
              style={{ 
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.8
              }}
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              backgroundColor: data.titleLabels.color + '20',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: Math.max(16, baseFontSize * 1.2)
            }}>
              {data.isQuartier ? '🏘️' : '📍'}
            </div>
          )}
        </div>

        {/* Text and progress section */}
        <div style={{ 
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: padding * 0.3
        }}>
          {/* SU name - main title */}
          <div style={{
            fontSize: Math.max(16, baseFontSize),
            fontWeight: 600,
            color: data.titleLabels.color,
            lineHeight: 1.1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {data.titleLabels.nameFr}
          </div>

          {/* Progress bar container */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: padding * 0.4
          }}>
            {/* Progress bar */}
            <div style={{
              flex: 1,
              height: Math.max(6, baseFontSize * 0.4),
              backgroundColor: '#e9ecef',
              borderRadius: Math.max(3, baseFontSize * 0.2),
              position: 'relative',
              overflow: 'hidden',
              minWidth: 60
            }}>
              <div style={{
                width: `${data.titleLabels.popPercentage}%`,
                height: '100%',
                backgroundColor: data.titleLabels.color,
                borderRadius: Math.max(3, baseFontSize * 0.2),
                transition: 'width 0.3s ease'
              }} />
            </div>
            
            {/* Percentage text */}
            <div style={{
              fontSize: Math.max(12, baseFontSize * 0.8),
              fontWeight: 600,
              color: data.titleLabels.color,
              flexShrink: 0,
              minWidth: 40
            }}>
              {data.titleLabels.popPercentage.toFixed(1)}%
            </div>
          </div>

          {/* Description text - fixed size */}
          <div className="p2-labels" style={{
            fontSize: Math.max(10, baseFontSize * 0.6),
            color: '#6c757d',
            lineHeight: 1.2
          }}>
            Part de la population totale
          </div>
        </div>
      </div>
    </div>
  );
}