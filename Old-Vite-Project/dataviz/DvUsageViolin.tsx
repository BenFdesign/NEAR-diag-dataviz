import suBankData from '../data/Su Bank.json';

interface UsageData {
  value: string;
  label: string;
  emoji: string;
  count: number;
  percentage: number;
}

interface DvUsageViolinProps {
  title: string;
  data: UsageData[];
  color?: string;
  suId?: number; // Compatibilité  ancienne version (falback ID locaux)
  width?: string;  // Hardcode width passée en props optionnellement
}

export default function DvUsageViolin({ title, data, color, suId, width }: DvUsageViolinProps) {
  // Use provided color or fallback to suId-based color lookup
  const palette = color || suBankData.find(su => su.Id === suId)?.colorMain || '#2563eb';

  // Generate violin path for each usage level
  const generateViolinPath = (data: UsageData[], centerX: number, maxHeight: number, svgWidth: number) => {
    if (data.length !== 3) return '';

    // Get percentages for the three segments (left, middle, right)
    const [left, middle, right] = data.map(d => d.percentage);
    
    // Use absolute percentage scaling (0-100%) instead of relative scaling
    // This ensures that actual percentage values are reflected in height
    const leftWidth = (left / 100) * maxHeight;
    const middleWidth = (middle / 100) * maxHeight;
    const rightWidth = (right / 100) * maxHeight;
    
    // Scale the spacing based on SVG width - much wider to use full space
    const wideSpacing = (svgWidth * 180) / 400;  // Increased from 120 to 180
    const narrowSpacing = (svgWidth * 90) / 400; // Increased from 60 to 90
    
    // Violin shape: curved surface mirrored on horizontal axis
    // Wider spacing between segments scaled to new width
    const path = `
      M ${centerX - wideSpacing} ${60 - leftWidth}
      Q ${centerX - narrowSpacing} ${60 - middleWidth} ${centerX} ${60 - middleWidth}
      Q ${centerX + narrowSpacing} ${60 - middleWidth} ${centerX + wideSpacing} ${60 - rightWidth}
      L ${centerX + wideSpacing} ${60 + rightWidth}
      Q ${centerX + narrowSpacing} ${60 + middleWidth} ${centerX} ${60 + middleWidth}
      Q ${centerX - narrowSpacing} ${60 + middleWidth} ${centerX - wideSpacing} ${60 + leftWidth}
      Z
    `;
    
    return path.replace(/\s+/g, ' ').trim();
  };

  // Calculate SVG dimensions based on width prop
  const svgWidth = width && width.endsWith('px') ? parseInt(width) : 800; // Default to 800px if not specified
  const centerX = svgWidth / 2;
  const violinPath = generateViolinPath(data, centerX, 45, svgWidth);

  return (
    <div className="dv-usage-violin-redesigned" style={{ 
      width: width || '100%', 
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'flex-start',
      marginBottom: '1px' // Very small gap
    }}>
      {/* Title column on the left
      <div style={{ 
        width: '40px',
        textAlign: 'left',
        paddingRight: '1px',
        flexShrink: 0,
        paddingTop: 0 // Align with violin center
      }}>
        <h3 style={{
          fontSize: '10px',
          fontWeight: '600',
          margin: '0',
          color: '#333',
          lineHeight: '1.1'
        }}>
          {title}
        </h3>
        
      </div>
      */}
      {/* Violin visualization */}
      <div className="violin-container" style={{ flex: 1 }}>
        <svg width="100%" height="200" viewBox={`0 0 ${svgWidth} 200`} style={{ maxWidth: '100%' }}>
          {/* Violin shape */}
          <path
            d={violinPath}
            fill={palette}
            opacity={0.8}
          />
          
          {/* Center horizon line
          <line
            x1={svgWidth * 0.05}
            y1="60"
            x2={svgWidth * 0.95}
            y2="60"
            stroke={palette}
            strokeWidth="1"
            opacity={0}
            strokeDasharray="2,2"
          />*/}
          
          {/* Data points and labels */}
          {data.map((item, index) => {
            // Position labels at the horizontal center of each segment (extended to use more width)
            const segmentPositions = [svgWidth * 0.2, svgWidth * 0.5, svgWidth * 0.8]; // Left, middle, right segment centers
            const x = segmentPositions[index];
            
            return (
              <g key={item.value}>
                {/* Smaller emoji on center line */}
                <text
                  x={x}
                  y="65"
                  textAnchor="middle"
                  fontSize="10"
                  fill={palette}
                  fontWeight="bold"
                >
                  {item.emoji}
                </text>
                
                {/* Bigger labels at the bottom */}
                <text
                  x={x}
                  y="105"
                  textAnchor="middle"
                  fontSize="18"
                  fill="#333"
                  fontWeight="700"
                >
                  {item.label}
                </text>
                
                {/* Percentage at the very bottom */}
                <text
                  x={x}
                  y="118"
                  textAnchor="middle"
                  fontSize="14"
                  fill={palette}
                  fontWeight="bold"
                >
                  {item.percentage}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}